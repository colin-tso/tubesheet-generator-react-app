// Rasterises an SVG string to a PNG Blob using OffscreenCanvas, separate from
// the main thread.
self.onmessage = async (event: MessageEvent) => {
    const { svgString, width, height } = event.data as {
        svgString: string;
        width: number;
        height: number;
    };

    try {
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const bitmap = await createImageBitmap(svgBlob);

        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            throw new Error("OffscreenCanvas 2D context unavailable");
        }
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();

        const blob = await canvas.convertToBlob({ type: "image/png" });
        self.postMessage({ type: "PNG_RESULT", blob });
    } catch (err) {
        self.postMessage({
            type: "PNG_ERROR",
            message: err instanceof Error ? err.message : String(err),
        });
    }
};
