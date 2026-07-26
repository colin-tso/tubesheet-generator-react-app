/// <reference lib="webworker" />

// Draws a decoded ImageBitmap (rasterised on the main thread, where SVG
// decoding is reliable) and encodes it to PNG off the main thread. This worker
// never decodes SVG itself — createImageBitmap's SVG-source decoding is what's
// unreliable across browsers.
//
// This worker is reused across calls (see getPngEncodeWorker in svgExport.ts)
// rather than created fresh per copy, so requests carry an id to correlate each
// response — more than one encode could be in flight at once.

export {};

type EncodeRequest = {
    id: number;
    bitmap: ImageBitmap;
    width: number;
    height: number;
};

self.onmessage = async (event: MessageEvent<EncodeRequest>) => {
    const { id, bitmap, width, height } = event.data;

    try {
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            throw new Error("OffscreenCanvas 2D context unavailable");
        }

        ctx.drawImage(bitmap, 0, 0, width, height);
        const blob = await canvas.convertToBlob({ type: "image/png" });

        self.postMessage({ id, type: "PNG_RESULT", blob });
    } catch (err) {
        self.postMessage({
            id,
            type: "PNG_ERROR",
            message: err instanceof Error ? err.message : "PNG encode failed",
        });
    } finally {
        bitmap.close();
    }
};
