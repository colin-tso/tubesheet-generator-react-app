import { useCallback, useEffect, useRef, useState } from "react";
import {
    downloadBlob,
    preloadPngEncodeWorker,
    sizedSvgString,
    svgToPngBlob,
} from "../utils/svgExport";

export type CopyState = "idle" | "pending" | "copied" | "error" | "unsupported";

// No built-in ceiling on clipboard writes/PNG rasterisation, so a slow browser
// or huge tubesheet could otherwise leave the button stuck with no feedback.
// Bounds the whole operation so it always settles one way or another.
const COPY_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(message)), ms);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (err) => {
                clearTimeout(timer);
                reject(err);
            },
        );
    });
}

// Encapsulates the "Copy Image" / "Save Image" actions for a rendered
// SVGSVGElement: clipboard writes (with PNG fallback) and file download.
export function useSvgExportActions(drawingSVG: SVGSVGElement) {
    const [copyState, setCopyState] = useState<CopyState>("idle");
    // Synchronous guard against double-clicks while a copy is in flight —
    // independent of the (async) React state so it can't race a click.
    const copyInFlightRef = useRef(false);

    // Warm up the PNG-encode worker on mount so its startup cost is out of the
    // way before the first "Copy Image" click.
    useEffect(() => {
        preloadPngEncodeWorker();
    }, []);

    const downloadSVG = useCallback(() => {
        const blob = new Blob([drawingSVG.outerHTML], { type: "image/svg+xml" });
        downloadBlob(blob, "tubesheet.svg");
    }, [drawingSVG]);

    const copySVG = useCallback(() => {
        if (copyInFlightRef.current) {
            return;
        }

        if (
            typeof navigator === "undefined" ||
            !navigator.clipboard ||
            typeof ClipboardItem === "undefined"
        ) {
            setCopyState("unsupported");
            setTimeout(() => setCopyState("idle"), 2500);
            return;
        }

        copyInFlightRef.current = true;
        setCopyState("pending");

        // Clipboard writes need user activation, so pass a pending Promise for
        // the PNG rather than awaiting it first.
        const { svgString } = sizedSvgString(drawingSVG);
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const pngPromise = svgToPngBlob(drawingSVG);

        const finish = () => {
            copyInFlightRef.current = false;
        };
        const onSuccess = () => {
            finish();
            setCopyState("copied");
            setTimeout(() => setCopyState("idle"), 2000);
        };
        const onFailure = (err: unknown) => {
            finish();
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

        withTimeout(writePromise, COPY_TIMEOUT_MS, "Copy timed out")
            .then(onSuccess)
            .catch(() =>
                withTimeout(
                    // Fresh rasterisation, not the first attempt's promise
                    // (which may have already rejected).
                    navigator.clipboard.write([
                        new ClipboardItem({ "image/png": svgToPngBlob(drawingSVG) }),
                    ]),
                    COPY_TIMEOUT_MS,
                    "Copy timed out",
                )
                    .then(onSuccess)
                    .catch(onFailure),
            );
    }, [drawingSVG]);

    return { copyState, downloadSVG, copySVG };
}
