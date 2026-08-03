import { useCallback, useEffect, useRef, useState } from "react";
import { generateTubeSheetSVG, ITubeSheetData } from "../plugins/tubesheet-layout-generator";

export type LayoutResults = {
    30: (ITubeSheetData & { preferred: boolean }) | null;
    45: (ITubeSheetData & { preferred: boolean }) | null;
    60: (ITubeSheetData & { preferred: boolean }) | null;
    90: (ITubeSheetData & { preferred: boolean }) | null;
    radial: (ITubeSheetData & { preferred: boolean }) | null;
};

export type SingleResultPayload = (ITubeSheetData & { shellID?: number; numTubes?: number }) | null;

const emptyLayoutResults: LayoutResults = {
    "30": null,
    "45": null,
    "60": null,
    "90": null,
    radial: null,
};

// Loading badge is debounced so brief calculations don't cause a flash
// and is held visible for a minimum duration once shown.
const SHOW_DELAY_MS = 150;
const MIN_VISIBLE_MS = 300;

type SingleCallback = (payload: SingleResultPayload) => void;
type AllCallback = (payload: LayoutResults) => void;
type CallbackEntry =
    | { type: "single"; callback: SingleCallback; isPreview: boolean }
    | { type: "all"; callback: AllCallback; isPreview: boolean };

// Owns the tubesheet.worker.ts Web Worker.
// Request/response handling, error/loading state, and announcements.
// Supports concurrent CALCULATE_ALL/CALCULATE_SINGLE requests.
// "isCalculating" only clears once all finish.
export function useTubeSheetWorker(placeholderSVG: SVGSVGElement) {
    const [layoutResults, setLayoutResults] = useState<LayoutResults>(emptyLayoutResults);
    const [drawingSVG, setDrawingSVG] = useState<SVGSVGElement>(placeholderSVG);
    const [lastSingleResult, setLastSingleResult] = useState<SingleResultPayload>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [showLoadingBadge, setShowLoadingBadge] = useState(false);
    const [calcError, setCalcError] = useState<string | null>(null);
    const [announcement, setAnnouncement] = useState("");

    const workerRef = useRef<Worker | null>(null);
    const loadingShownAtRef = useRef<number | null>(null);
    const hasRenderedOnceRef = useRef(false);

    // Track outstanding calculations so "isCalculating" clears only when all finish.
    const pendingCompletionsRef = useRef(0);
    // Worker responses increment below refs synchronously. Effects drain them
    // once the corresponding state update has actually committed.
    const pendingAllResponsesRef = useRef(0);
    const pendingSingleResponsesRef = useRef(0);

    // Registry for one‑off callbacks (live preview)
    const pendingCallbacksRef = useRef<Map<number, CallbackEntry>>(new Map());

    const nextRequestIdRef = useRef(0);
    const latestAllRequestIdRef = useRef<number | null>(null);
    const latestSingleRequestIdRef = useRef<number | null>(null);

    const beginCalculation = useCallback(() => {
        pendingCompletionsRef.current += 1;
        setCalcError(null);
        setIsCalculating(true);
        setAnnouncement("Calculating layout…");
    }, []);

    const completeCalculation = useCallback(() => {
        pendingCompletionsRef.current = Math.max(0, pendingCompletionsRef.current - 1);
        if (pendingCompletionsRef.current === 0) setIsCalculating(false);
    }, []);

    // Drain counter and call completeCalculation per recorded response.
    const drainCompletions = useCallback(
        (counterRef: { current: number }) => {
            const count = counterRef.current;
            counterRef.current = 0;
            for (let i = 0; i < count; i++) completeCalculation();
        },
        [completeCalculation],
    );

    // Core dispatcher – stores callback for preview requests, skips loading badge for previews.
    const makeRequest = useCallback(
        (
            type: "CALCULATE_SINGLE" | "CALCULATE_ALL",
            payload: Record<string, unknown>,
            callback?: SingleCallback | AllCallback,
            isPreview = false,
        ): number => {
            if (!workerRef.current) {
                throw new Error("Worker not initialized");
            }
            const requestId = ++nextRequestIdRef.current;
            if (type === "CALCULATE_SINGLE") {
                latestSingleRequestIdRef.current = requestId;
            } else {
                latestAllRequestIdRef.current = requestId;
            }

            if (callback) {
                if (type === "CALCULATE_SINGLE") {
                    pendingCallbacksRef.current.set(requestId, {
                        type: "single",
                        callback: callback as SingleCallback,
                        isPreview,
                    });
                } else {
                    pendingCallbacksRef.current.set(requestId, {
                        type: "all",
                        callback: callback as AllCallback,
                        isPreview,
                    });
                }
            }
            if (!isPreview) beginCalculation();
            workerRef.current.postMessage({ type, requestId, payload });
            return requestId;
        },
        [beginCalculation],
    );

    // Public API for live preview (callback‑based, no loading badge)
    const requestSingle = useCallback(
        (payload: Record<string, unknown>, callback: SingleCallback, isPreview = true): number =>
            makeRequest("CALCULATE_SINGLE", payload, callback, isPreview),
        [makeRequest],
    );

    const requestAll = useCallback(
        (payload: Record<string, unknown>, callback: AllCallback, isPreview = true): number =>
            makeRequest("CALCULATE_ALL", payload, callback, isPreview),
        [makeRequest],
    );

    // Legacy wrappers for committed calculations
    const postCalculateSingle = useCallback(
        (payload: Record<string, unknown>) => {
            requestSingle(
                payload,
                (result) => {
                    setCalcError(null);
                    if (result) {
                        setDrawingSVG(generateTubeSheetSVG(result));
                        setLastSingleResult(result);
                    }
                },
                false,
            );
        },
        [requestSingle],
    );

    const postCalculateAll = useCallback(
        (payload: Record<string, unknown>) => {
            requestAll(
                payload,
                (result) => {
                    setLayoutResults(result);
                },
                false,
            );
        },
        [requestAll],
    );

    // Worker lifecycle
    useEffect(() => {
        const w = new Worker(new URL("../workers/tubesheet.worker.ts", import.meta.url), {
            type: "module",
        });

        w.onmessage = (event) => {
            const { type, requestId, payload } = event.data;

            // 1. One‑off callback (preview) takes precedence
            const entry = pendingCallbacksRef.current.get(requestId);
            if (entry) {
                pendingCallbacksRef.current.delete(requestId);
                if (entry.type === "single") {
                    (entry.callback as SingleCallback)(payload as SingleResultPayload);
                } else {
                    (entry.callback as AllCallback)(payload as LayoutResults);
                }
                if (!entry.isPreview) completeCalculation();
                return;
            }

            // 2. Normal state updates (committed results)
            if (type === "ALL_RESULTS") {
                if (requestId === latestAllRequestIdRef.current) {
                    pendingAllResponsesRef.current += 1;
                    setLayoutResults(payload);
                } else {
                    completeCalculation(); // stale
                }
            } else if (type === "SINGLE_RESULT") {
                if (requestId === latestSingleRequestIdRef.current) {
                    pendingSingleResponsesRef.current += 1;
                    setCalcError(null);
                    setDrawingSVG(generateTubeSheetSVG(payload));
                    setLastSingleResult(payload);
                } else {
                    completeCalculation();
                }
            } else if (type === "ERROR") {
                const latestId =
                    event.data.requestType === "CALCULATE_ALL"
                        ? latestAllRequestIdRef.current
                        : latestSingleRequestIdRef.current;
                // Discard error if superseded.
                if (requestId !== latestId) {
                    completeCalculation();
                    return;
                }
                console.error("Worker Error:", payload);
                setCalcError(typeof payload === "string" ? payload : "Calculation failed.");
                setAnnouncement(`Calculation failed: ${payload}`);
                completeCalculation();
            }
        };

        workerRef.current = w;
        return () => {
            w.terminate();
            workerRef.current = null;
        };
    }, [completeCalculation]);

    // Loading badge: debounce show, minimum visibility
    useEffect(() => {
        if (isCalculating) {
            const timer = setTimeout(() => {
                loadingShownAtRef.current = Date.now();
                setShowLoadingBadge(true);
            }, SHOW_DELAY_MS);
            return () => clearTimeout(timer);
        }
        if (loadingShownAtRef.current === null) return;
        const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - loadingShownAtRef.current));
        const timer = setTimeout(() => {
            setShowLoadingBadge(false);
            loadingShownAtRef.current = null;
        }, remaining);
        return () => clearTimeout(timer);
    }, [isCalculating]);

    // Drain pending completions after results arrive
    useEffect(() => {
        drainCompletions(pendingAllResponsesRef);
    }, [layoutResults, drainCompletions]);

    const onDrawingRendered = useCallback(() => {
        drainCompletions(pendingSingleResponsesRef);
        if (!hasRenderedOnceRef.current) {
            hasRenderedOnceRef.current = true;
            return;
        }
        setAnnouncement("Layout updated.");
    }, [drainCompletions]);

    return {
        layoutResults,
        drawingSVG,
        lastSingleResult,
        isCalculating,
        showLoadingBadge,
        calcError,
        announcement,
        setAnnouncement,
        onDrawingRendered,
        postCalculateSingle,
        postCalculateAll,
        requestSingle,
        requestAll,
    };
}
