import { useCallback, useEffect, useRef, useState } from "react";
import { generateTubeSheetSVG, TUBE_SHEET_LAYOUTS } from "@/plugins/tubesheet-layout-generator";
import type { ITubeSheetData, TubeSheetLayout } from "@/plugins/tubesheet-layout-generator";

export type LayoutResults = Record<
    TubeSheetLayout,
    (ITubeSheetData & { preferred: boolean }) | null
>;
export type SingleResultPayload = (ITubeSheetData & { numTubes?: number }) | null;

const emptyLayoutResults: LayoutResults = Object.fromEntries(
    TUBE_SHEET_LAYOUTS.map((layout) => [layout, null]),
) as LayoutResults;

// Loading badge is debounced so brief calculations don't cause a flash
// and is held visible for a minimum duration once shown.
const SHOW_DELAY_MS = 150;
const MIN_VISIBLE_MS = 300;

export type SingleCallback = (payload: SingleResultPayload) => void;
export type AllCallback = (payload: LayoutResults) => void;
export type CallbackEntry =
    | { type: "single"; callback: SingleCallback; isPreview: boolean }
    | { type: "all"; callback: AllCallback; isPreview: boolean };

// Shape of a message posted back from tubesheet.worker.ts.
export interface WorkerMessage {
    type: string;
    requestId: number;
    payload: unknown;
    requestType?: "CALCULATE_ALL" | "CALCULATE_SINGLE";
}

// Everything dispatchWorkerMessage needs to apply one worker response.
// Extracted as a pure function so the completion/error accounting is
// unit-testable without mounting the hook.
export interface WorkerDispatchContext {
    pendingCallbacks: Map<number, CallbackEntry>;
    latestAllRequestId: number | null;
    latestSingleRequestId: number | null;
    completeCalculation: () => void;
    recordAllResponse: () => void;
    recordSingleResponse: () => void;
    setLayoutResults: (payload: unknown) => void;
    setDrawingSVG: (payload: unknown) => void;
    setLastSingleResult: (payload: unknown) => void;
    setCalcError: (message: string | null) => void;
    setAnnouncement: (message: string) => void;
}

// Dispatches a worker message: preview/committed callbacks take precedence, and
// worker ERRORs are handled uniformly so errors are announced, callbacks never
// receive the raw error string (which would crash result consumers), and
// completion accounting always runs so "isCalculating" can't get stuck.
export function dispatchWorkerMessage(message: WorkerMessage, ctx: WorkerDispatchContext): void {
    const { type, requestId, payload } = message;
    const entry = ctx.pendingCallbacks.get(requestId);

    if (type === "ERROR") {
        if (entry) ctx.pendingCallbacks.delete(requestId);

        const latestId =
            message.requestType === "CALCULATE_ALL"
                ? ctx.latestAllRequestId
                : ctx.latestSingleRequestId;
        const isLatest = requestId === latestId;

        // Resolve live-preview callbacks with null so they mark themselves
        // unavailable. Committed callbacks are skipped so the last good
        // drawing/results stay on screen.
        if (entry?.isPreview) {
            (entry.callback as SingleCallback)(null);
        }

        if (entry) {
            if (!entry.isPreview) ctx.completeCalculation();
        } else {
            ctx.completeCalculation();
        }

        if (isLatest) {
            console.error("Worker Error:", payload);
            const messageText = typeof payload === "string" ? payload : "Calculation failed.";
            ctx.setCalcError(messageText);
            ctx.setAnnouncement(`Calculation failed: ${messageText}`);
        }
        return;
    }

    // 1. One-off callback (live preview or committed request) takes precedence
    if (entry) {
        ctx.pendingCallbacks.delete(requestId);
        if (entry.type === "single") {
            (entry.callback as SingleCallback)(payload as SingleResultPayload);
        } else {
            (entry.callback as AllCallback)(payload as LayoutResults);
        }
        if (!entry.isPreview) ctx.completeCalculation();
        return;
    }

    // 2. Normal state updates (requests made without a callback)
    if (type === "ALL_RESULTS") {
        if (requestId === ctx.latestAllRequestId) {
            ctx.recordAllResponse();
            ctx.setLayoutResults(payload);
        } else {
            ctx.completeCalculation(); // stale
        }
    } else if (type === "SINGLE_RESULT") {
        if (requestId === ctx.latestSingleRequestId) {
            ctx.recordSingleResponse();
            ctx.setCalcError(null);
            ctx.setDrawingSVG(payload);
            ctx.setLastSingleResult(payload);
        } else {
            ctx.completeCalculation();
        }
    }
}

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

        w.onmessage = (event: MessageEvent) => {
            dispatchWorkerMessage(event.data as WorkerMessage, {
                pendingCallbacks: pendingCallbacksRef.current,
                latestAllRequestId: latestAllRequestIdRef.current,
                latestSingleRequestId: latestSingleRequestIdRef.current,
                completeCalculation,
                recordAllResponse: () => {
                    pendingAllResponsesRef.current += 1;
                },
                recordSingleResponse: () => {
                    pendingSingleResponsesRef.current += 1;
                },
                setLayoutResults: (payload) => {
                    setLayoutResults(payload as LayoutResults);
                },
                setDrawingSVG: (resultPayload) => {
                    setDrawingSVG(generateTubeSheetSVG(resultPayload as ITubeSheetData));
                },
                setLastSingleResult: (payload) => {
                    setLastSingleResult(payload as SingleResultPayload);
                },
                setCalcError,
                setAnnouncement,
            });
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
