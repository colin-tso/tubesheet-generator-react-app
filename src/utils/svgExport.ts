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

// Clone svg with explicit pixel dimensions derived from viewBox
// for SVG and PNG rasterisation.
export const sizedSvgString = (svg: SVGSVGElement, scale = 2) => {
    const viewBox = svg.getAttribute("viewBox");
    const parts = viewBox ? viewBox.split(" ").map(Number) : [0, 0, 300, 150];
    const vbWidth = parts[2] || 300;
    const vbHeight = parts[3] || 300;
    const width = Math.max(1, Math.round(vbWidth * scale));
    const height = Math.max(1, Math.round(vbHeight * scale));

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", `${width}`);
    clone.setAttribute("height", `${height}`);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    return { svgString: new XMLSerializer().serializeToString(clone), width, height };
};

// Rasterisation above this size gets slow (and can hang on some browsers)
// for large tubesheets with many tubes, so PNG output always targets this
// long-edge size rather than a fixed multiplier of the SVG's viewBox.
const MAX_RASTER_DIMENSION = 4096; // px
const MIN_RASTER_SCALE = 1; // never render below the SVG's native units
const MAX_RASTER_SCALE = 4; // cap upscaling on very small drawings

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Shared by both rasterisation paths: derive the render scale so the
// longest edge lands near `maxDimension`, then serialise the sized SVG.
const prepareRaster = (svg: SVGSVGElement, maxDimension: number) => {
    const viewBox = svg.getAttribute("viewBox");
    const parts = viewBox ? viewBox.split(" ").map(Number) : [0, 0, 300, 150];
    const vbWidth = parts[2] || 300;
    const vbHeight = parts[3] || 300;
    const largestDimension = Math.max(vbWidth, vbHeight);
    const scale =
        largestDimension > 0
            ? clamp(maxDimension / largestDimension, MIN_RASTER_SCALE, MAX_RASTER_SCALE)
            : MIN_RASTER_SCALE;

    return sizedSvgString(svg, scale);
};

const canUseWorkerRasterisation =
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof createImageBitmap !== "undefined";

// Decode + drawImage + PNG-encode entirely on a worker thread (via
// OffscreenCanvas) so a large tubesheet's raster work can't block the main
// thread — and, in particular, can't stall the "Copying…" badge's own
// animation while it runs.
const svgToPngBlobViaWorker = (svgString: string, width: number, height: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL("../workers/pngRaster.worker.ts", import.meta.url), {
            type: "module",
        });

        const cleanup = () => worker.terminate();

        worker.onmessage = (event) => {
            const { type } = event.data as { type: string };
            if (type === "PNG_RESULT") {
                cleanup();
                resolve((event.data as { blob: Blob }).blob);
            } else {
                cleanup();
                reject(
                    new Error((event.data as { message?: string }).message ?? "PNG encode failed"),
                );
            }
        };
        worker.onerror = (event) => {
            cleanup();
            reject(new Error(event.message || "PNG rasterisation worker failed"));
        };

        worker.postMessage({ svgString, width, height });
    });
};

// Main-thread fallback for browsers without OffscreenCanvas/createImageBitmap
// worker support (e.g. older Safari).
const svgToPngBlobMainThread = (
    svgString: string,
    width: number,
    height: number,
): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);

        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            URL.revokeObjectURL(url);
            if (!ctx) {
                reject(new Error("Canvas 2D context unavailable"));
                return;
            }
            ctx.drawImage(image, 0, 0, width, height);
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("Failed to encode PNG"));
                }
            }, "image/png");
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to load SVG for rasterisation"));
        };
        image.src = url;
    });
};

// Rasterise SVG to a PNG blob. The render scale is derived dynamically to
// "maxDimension" bounded by MAX_RASTER_SCALE
export const svgToPngBlob = async (
    svg: SVGSVGElement,
    maxDimension = MAX_RASTER_DIMENSION,
): Promise<Blob> => {
    const { svgString, width, height } = prepareRaster(svg, maxDimension);

    if (canUseWorkerRasterisation) {
        try {
            return await svgToPngBlobViaWorker(svgString, width, height);
        } catch (err) {
            console.error("Worker PNG rasterisation failed, falling back to main thread:", err);
        }
    }

    return svgToPngBlobMainThread(svgString, width, height);
};
