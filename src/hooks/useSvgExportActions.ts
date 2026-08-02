import { useCallback, useEffect, useRef, useState } from "react";
import {
    downloadBlob,
    preloadPngEncodeWorker,
    sizedSvgString,
    svgToPngBlob,
} from "../utils/svgExport";

export type CopyState = "idle" | "pending" | "copied" | "error" | "unsupported";

// Firefox for Android rejects navigator.clipboard.write() for images outright –
// a combined SVG+PNG ClipboardItem fails with `NotAllowedError: Type
// "image/svg+xml" not supported for write.`, and retrying with PNG alone still
// fails with a generic `NotAllowedError: Clipboard write is not allowed.`.
// Chrome/Edge on Android are unaffected. Not tested on iOS.
const isAndroidFirefox =
    typeof navigator !== "undefined" &&
    /android/i.test(navigator.userAgent) &&
    /firefox/i.test(navigator.userAgent);

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

    // Always true now that there's no preload phase to gate on — kept in the
    // return value so callers (the copy button, the context menu item) don't
    // need to change if that ever comes back.
    const copyReady = true;

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
            typeof ClipboardItem === "undefined" ||
            isAndroidFirefox
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
            // A permission denial means this browser does not support image
            // clipboard write.
            const notAllowed = err instanceof DOMException && err.name === "NotAllowedError";
            setCopyState(notAllowed ? "unsupported" : "error");
            setTimeout(() => setCopyState("idle"), 2500);
        };

        // SVG with PNG fallback.
        let writePromise: Promise<void>;
        try {
            writePromise = navigator.clipboard.write([
                new ClipboardItem({ "image/svg+xml": svgBlob, "image/png": pngPromise }),
            ]);
        } catch (err) {
            writePromise = Promise.reject(err);
        }

        withTimeout(writePromise, COPY_TIMEOUT_MS, "Copy timed out")
            .then(onSuccess)
            .catch(() => {
                // Constructing ClipboardItem/calling write() can itself throw
                // synchronously (not just reject) — wrapped so that always
                // reaches onFailure instead of going unhandled and leaving
                // copyState stuck at "pending".
                let retryWrite: Promise<void>;
                try {
                    // Fresh rasterisation, not the first attempt's promise
                    // (which may have already rejected).
                    retryWrite = navigator.clipboard.write([
                        new ClipboardItem({ "image/png": svgToPngBlob(drawingSVG) }),
                    ]);
                } catch (retryErr) {
                    onFailure(retryErr);
                    return;
                }
                withTimeout(retryWrite, COPY_TIMEOUT_MS, "Copy timed out")
                    .then(onSuccess)
                    .catch(onFailure);
            });
    }, [drawingSVG]);

    return { copyState, downloadSVG, copySVG, copyReady };
}
