import { useCallback, useState } from "react";
import { downloadBlob, sizedSvgString, svgToPngBlob } from "../utils/svgExport";

export type CopyState = "idle" | "copied" | "error" | "unsupported";

// Encapsulates the "Copy Image" / "Save Image" actions for a rendered
// SVGSVGElement: clipboard writes (with PNG fallback) and file download.
export function useSvgExportActions(drawingSVG: SVGSVGElement) {
    const [copyState, setCopyState] = useState<CopyState>("idle");

    const downloadSVG = useCallback(() => {
        const blob = new Blob([drawingSVG.outerHTML], { type: "image/svg+xml" });
        downloadBlob(blob, "tubesheet.svg");
    }, [drawingSVG]);

    const copySVG = useCallback(() => {
        if (
            typeof navigator === "undefined" ||
            !navigator.clipboard ||
            typeof ClipboardItem === "undefined"
        ) {
            setCopyState("unsupported");
            return;
        }

        // Clipboard writes must occur during user activation. Pass pending
        // Promises to "ClipboardItem" so browsers accept async image data.
        const { svgString } = sizedSvgString(drawingSVG);
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const pngPromise = svgToPngBlob(drawingSVG);

        const onSuccess = () => {
            setCopyState("copied");
            setTimeout(() => setCopyState("idle"), 2000);
        };
        const onFailure = (err: unknown) => {
            console.error("Copy to clipboard failed:", err);
            setCopyState("error");
            setTimeout(() => setCopyState("idle"), 2500);
        };

        // SVG with PNG fallback.
        let writePromise: Promise<void>;
        try {
            writePromise = navigator.clipboard.write([
                new ClipboardItem({ "image/svg+xml": svgBlob, "image/png": pngPromise }),
            ]);
        } catch {
            writePromise = Promise.reject();
        }

        writePromise.then(onSuccess).catch(() =>
            navigator.clipboard
                .write([new ClipboardItem({ "image/png": pngPromise })])
                .then(onSuccess)
                .catch(onFailure),
        );
    }, [drawingSVG]);

    return { copyState, downloadSVG, copySVG };
}
