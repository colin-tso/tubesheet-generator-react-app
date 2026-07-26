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

// Reads the viewBox's width/height, falling back to sane defaults if missing,
// zero, or non-finite. An invalid intrinsic size makes SVG rasterisation fail
// outright, so this guards every path that derives pixel dimensions from it.
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

// Clones the SVG with explicit pixel width/height derived from its viewBox, for
// SVG and PNG output.
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

// Only used for the clipboard's PNG fallback (not the SVG download), so it
// targets a lower ceiling than a full-resolution export would need.
const MAX_RASTER_DIMENSION = 2048; // px
const MAX_RASTER_SCALE = 4; // cap upscaling on very small drawings

// Scales so the longest edge lands at (or under) maxDimension. Only caps the
// upscale side — a large tubesheet must be free to scale down as far as needed
// to stay under maxDimension.
const prepareRaster = (svg: SVGSVGElement, maxDimension: number) => {
    const { vbWidth, vbHeight } = readViewBoxSize(svg);
    const largestDimension = Math.max(vbWidth, vbHeight);
    const scale =
        largestDimension > 0 ? Math.min(maxDimension / largestDimension, MAX_RASTER_SCALE) : 1;

    return sizedSvgString(svg, scale);
};

// Fallback for when worker encoding is unavailable or fails. Prefers
// OffscreenCanvas, since some browsers can run its encode off the main thread
// even without a Worker.
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

    // Skips the canvas's usual sync-with-display work, unneeded for a render
    // that goes straight to a blob.
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

// Reused across calls to avoid paying Worker startup cost every copy. Requests
// carry an id since more than one encode can be in flight (e.g. the clipboard
// fallback retry).
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
        // Worker's in an unknown state — discard it so the next call gets a
        // fresh one, and fail whatever was in flight.
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

// Spins up the shared worker ahead of time (e.g. on app mount), so its startup
// cost isn't on the critical path of the first "Copy Image" click.
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

// Rasterises the SVG to a PNG blob: decode happens on the main thread via
// <img>.decode(), then the decoded bitmap is handed to a worker for the draw +
// encode step. Falls back to encoding in-process if that fails.
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
