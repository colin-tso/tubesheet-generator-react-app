export const downloadBlob = (blob: Blob | MediaSource, filename: string) => {
    const objectUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
};

const FALLBACK_VB_WIDTH = 300;
const FALLBACK_VB_HEIGHT = 150;

// Reads the viewBox's width/height, falling back to sane defaults for any
// missing, zero, or non-finite (NaN/Infinity) value. Browsers require an SVG
// passed to createImageBitmap/<img> to have a valid finite intrinsic size —
// otherwise rasterisation fails outright with "the source image could not be
// decoded", so this guards every path that derives pixel dimensions from it.
const readViewBoxSize = (svg: SVGSVGElement) => {
    const viewBox = svg.getAttribute("viewBox");
    const parts = viewBox ? viewBox.split(" ").map(Number) : [];
    const width = parts[2];
    const height = parts[3];
    return {
        vbWidth: Number.isFinite(width) && width > 0 ? width : FALLBACK_VB_WIDTH,
        vbHeight: Number.isFinite(height) && height > 0 ? height : FALLBACK_VB_HEIGHT,
    };
};

// Clone svg with explicit pixel dimensions derived from viewBox
// for SVG and PNG rasterisation.
export const sizedSvgString = (svg: SVGSVGElement, scale = 2) => {
    const { vbWidth, vbHeight } = readViewBoxSize(svg);
    const width = Math.max(1, Math.round(vbWidth * scale));
    const height = Math.max(1, Math.round(vbHeight * scale));

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", `${width}`);
    clone.setAttribute("height", `${height}`);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    return { svgString: new XMLSerializer().serializeToString(clone), width, height };
};

// Rasterisation above this size gets slow for large tubesheets with many tubes.
// This is only used for the clipboard's PNG fallback.
const MAX_RASTER_DIMENSION = 2048; // px
const MIN_RASTER_SCALE = 1; // never render below the SVG's native units
const MAX_RASTER_SCALE = 4; // cap upscaling on very small drawings

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Derives the render scale so the longest edge lands near "maxDimension",
// then serialises the sized SVG.
const prepareRaster = (svg: SVGSVGElement, maxDimension: number) => {
    const { vbWidth, vbHeight } = readViewBoxSize(svg);
    const largestDimension = Math.max(vbWidth, vbHeight);
    const scale =
        largestDimension > 0
            ? clamp(maxDimension / largestDimension, MIN_RASTER_SCALE, MAX_RASTER_SCALE)
            : MIN_RASTER_SCALE;

    return sizedSvgString(svg, scale);
};

// Encodes an already-decoded image to a PNG blob, entirely on the calling
// thread. Used as the fallback when worker encoding (below) is unavailable or
// fails. Prefers OffscreenCanvas when present since its encode isn't tied to a
// visible canvas backing store, so some browsers can still run it off the main
// thread even without a dedicated Worker.
const encodePngInline = async (
    image: HTMLImageElement,
    width: number,
    height: number,
): Promise<Blob> => {
    if (typeof OffscreenCanvas !== "undefined") {
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.drawImage(image, 0, 0, width, height);
            return canvas.convertToBlob({ type: "image/png" });
        }
    }

    // "desynchronized" lets the browser skip some of the sync-with-display work
    // a canvas normally does, which is not required for render straight to a
    // blob.
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { desynchronized: true });
    if (!ctx) {
        throw new Error("Canvas 2D context unavailable");
    }
    ctx.drawImage(image, 0, 0, width, height);

    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error("Failed to encode PNG"));
            }
        }, "image/png");
    });
};

const canUseWorkerEncode =
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof createImageBitmap !== "undefined";

// A fresh Worker per copy has a startup cost. Reuse instead, then kept alive so
// later copies skip startup. Since it's shared, requests carry an id to
// correlate responses (more than one encode could be in flight — e.g. the
// clipboard fallback retry).
let sharedWorker: Worker | null = null;
let nextRequestId = 0;
const pendingRequests = new Map<
    number,
    { resolve: (blob: Blob) => void; reject: (err: Error) => void }
>();

const getPngEncodeWorker = (): Worker => {
    if (sharedWorker) {
        return sharedWorker;
    }

    const worker = new Worker(new URL("../workers/pngEncode.worker.ts", import.meta.url), {
        type: "module",
    });

    worker.onmessage = (event) => {
        const { id, type } = event.data as { id: number; type: string };
        const pending = pendingRequests.get(id);
        if (!pending) return;
        pendingRequests.delete(id);

        if (type === "PNG_RESULT") {
            pending.resolve((event.data as { blob: Blob }).blob);
        } else {
            pending.reject(
                new Error((event.data as { message?: string }).message ?? "PNG encode failed"),
            );
        }
    };

    worker.onerror = (event) => {
        // The worker itself is now in an unknown state — discard it so the
        // next call spins up a fresh one, and fail whatever was in flight.
        sharedWorker = null;
        const err = new Error(event.message || "PNG encode worker failed");
        for (const { reject } of pendingRequests.values()) {
            reject(err);
        }
        pendingRequests.clear();
    };

    sharedWorker = worker;
    return worker;
};

// Spins up the shared PNG-encode worker ahead of time (e.g. on app mount),
// so its startup cost is paid once in the background rather than being on
// the critical path of the very first "Copy Image" click.
export const preloadPngEncodeWorker = (): void => {
    if (canUseWorkerEncode) {
        getPngEncodeWorker();
    }
};

// Draws + PNG-encodes a decoded bitmap on a worker thread. Unlike SVG decoding,
// createImageBitmap on an already-loaded <img> and canvas draw/encode are
// reliably supported in a worker.
const encodePngViaWorker = (bitmap: ImageBitmap, width: number, height: number): Promise<Blob> => {
    const worker = getPngEncodeWorker();
    const id = nextRequestId++;

    return new Promise((resolve, reject) => {
        pendingRequests.set(id, { resolve, reject });
        worker.postMessage({ id, bitmap, width, height }, [bitmap]);
    });
};

// Rasterise SVG to a PNG blob. SVG on the main thread via <img>.decode(). The
// decoded bitmap is then handed off to a worker for the draw + encode step,
// Falls back to encoding in-process if that's unsupported or fails.
export const svgToPngBlob = async (
    svg: SVGSVGElement,
    maxDimension = MAX_RASTER_DIMENSION,
): Promise<Blob> => {
    const { svgString, width, height } = prepareRaster(svg, maxDimension);

    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    try {
        const image = new Image();
        image.src = url;

        try {
            await image.decode();
        } catch {
            throw new Error("Failed to load SVG for rasterisation");
        }

        if (canUseWorkerEncode) {
            try {
                const bitmap = await createImageBitmap(image, {
                    resizeWidth: width,
                    resizeHeight: height,
                });
                return await encodePngViaWorker(bitmap, width, height);
            } catch (err) {
                console.warn("Worker PNG encode failed, falling back to inline encode:", err);
            }
        }

        return await encodePngInline(image, width, height);
    } finally {
        URL.revokeObjectURL(url);
    }
};
