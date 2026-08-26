import { useCallback, useEffect, useRef, useState } from "react";
import {
    downloadBlob,
    MAX_DOWNLOAD_RASTER_DIMENSION,
    preloadPngEncodeWorker,
    sizedSvgString,
    svgToPngBlob,
} from "@/utils/svgExport";
import { buildTubeSheetPdfBlob } from "@/utils/pdfExport";
import type { ITubeSheetData } from "@/plugins/tubesheet-layout-generator";

export type CopyState = "idle" | "pending" | "copied" | "error" | "unsupported" | "downloaded";
export type PngExportState = "idle" | "pending" | "error";
export type PdfExportState = "idle" | "pending" | "error";

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

const COPY_TIMEOUT_MS = 30000; // 30s

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

export function useSvgExportActions(
    drawingSVG: SVGSVGElement,
    tableData: (ITubeSheetData & { numTubes?: number }) | null,
    tableLayoutLabel: string,
    tableRequestedTubes: number | undefined,
) {
    const [copyState, setCopyState] = useState<CopyState>("idle");
    const copyInFlightRef = useRef(false);
    const [pngExportState, setPngExportState] = useState<PngExportState>("idle");
    const pngExportInFlightRef = useRef(false);
    const [pdfExportState, setPdfExportState] = useState<PdfExportState>("idle");
    const pdfExportInFlightRef = useRef(false);

    useEffect(() => {
        preloadPngEncodeWorker();
    }, []);

    const copyReady = true;

    const downloadSVG = useCallback(() => {
        const blob = new Blob([drawingSVG.outerHTML], { type: "image/svg+xml" });
        downloadBlob(blob, "tubesheet.svg");
    }, [drawingSVG]);

    const downloadPNG = useCallback(() => {
        if (pngExportInFlightRef.current) return;

        pngExportInFlightRef.current = true;
        setPngExportState("pending");

        withTimeout(
            svgToPngBlob(drawingSVG, MAX_DOWNLOAD_RASTER_DIMENSION),
            COPY_TIMEOUT_MS,
            "PNG export timed out",
        )
            .then((blob) => {
                downloadBlob(blob, "tubesheet.png");
                pngExportInFlightRef.current = false;
                setPngExportState("idle");
            })
            .catch((err) => {
                console.error("PNG export failed:", err);
                pngExportInFlightRef.current = false;
                setPngExportState("error");
                setTimeout(() => setPngExportState("idle"), 2500);
            });
    }, [drawingSVG]);

    const downloadPDF = useCallback(() => {
        if (pdfExportInFlightRef.current) return;

        pdfExportInFlightRef.current = true;
        setPdfExportState("pending");

        withTimeout(
            buildTubeSheetPdfBlob(drawingSVG, tableData, tableLayoutLabel, tableRequestedTubes),
            COPY_TIMEOUT_MS,
            "PDF export timed out",
        )
            .then((blob) => {
                downloadBlob(blob, "tubesheet.pdf");
                pdfExportInFlightRef.current = false;
                setPdfExportState("idle");
            })
            .catch((err) => {
                console.error("PDF export failed:", err);
                pdfExportInFlightRef.current = false;
                setPdfExportState("error");
                setTimeout(() => setPdfExportState("idle"), 2500);
            });
    }, [drawingSVG, tableData, tableLayoutLabel, tableRequestedTubes]);

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

    return {
        copyState,
        downloadSVG,
        downloadPNG,
        pngExportState,
        downloadPDF,
        pdfExportState,
        copySVG,
        copyReady,
    };
}
