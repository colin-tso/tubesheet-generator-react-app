import { useCallback, useEffect, useRef, useState } from "react";
import {
    downloadBlob,
    preloadPngEncodeWorker,
    sizedSvgString,
    svgToPngBlob,
} from "../utils/svgExport";

export type CopyState = "idle" | "pending" | "copied" | "error" | "unsupported" | "downloaded";

// Android Firefox: clipboard image write fails.
const isAndroidFirefox =
    typeof navigator !== "undefined" &&
    /android/i.test(navigator.userAgent) &&
    /firefox/i.test(navigator.userAgent);

// iOS: clipboard write often fails with NotAllowedError/TypeError.
const isIOS =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !("MSStream" in window);

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

export function useSvgExportActions(drawingSVG: SVGSVGElement) {
    const [copyState, setCopyState] = useState<CopyState>("idle");
    const copyInFlightRef = useRef(false);

    useEffect(() => {
        preloadPngEncodeWorker();
    }, []);

    const copyReady = true;

    const downloadSVG = useCallback(() => {
        const blob = new Blob([drawingSVG.outerHTML], { type: "image/svg+xml" });
        downloadBlob(blob, "tubesheet.svg");
    }, [drawingSVG]);

    const copySVG = useCallback(() => {
        if (copyInFlightRef.current) return;

        // Android Firefox and iOS: skip clipboard and download directly.
        if (isAndroidFirefox || isIOS) {
            downloadSVG();
            setCopyState("downloaded");
            setTimeout(() => setCopyState("idle"), 2500);
            return;
        }

        // Fallback to download if clipboard API unavailable.
        if (
            typeof navigator === "undefined" ||
            !navigator.clipboard ||
            typeof ClipboardItem === "undefined"
        ) {
            downloadSVG();
            setCopyState("downloaded");
            setTimeout(() => setCopyState("idle"), 2500);
            return;
        }

        copyInFlightRef.current = true;
        setCopyState("pending");

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
            const notAllowed = err instanceof DOMException && err.name === "NotAllowedError";
            const typeError = err instanceof DOMException && err.name === "TypeError";

            // For other browsers, show unsupported/error.
            setCopyState(notAllowed || typeError ? "unsupported" : "error");
            setTimeout(() => setCopyState("idle"), 2500);
        };

        // First attempt: write both SVG and PNG.
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
                // Retry with PNG only.
                let retryWrite: Promise<void>;
                try {
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
    }, [drawingSVG, downloadSVG]);

    return { copyState, downloadSVG, copySVG, copyReady };
}
