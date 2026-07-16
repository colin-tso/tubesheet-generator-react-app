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

    const beginCalculation = useCallback(() => {
        pendingCompletionsRef.current += 1;
        setCalcError(null);
        setIsCalculating(true);
    }, []);

    const completeCalculation = useCallback(() => {
        pendingCompletionsRef.current = Math.max(0, pendingCompletionsRef.current - 1);
        if (pendingCompletionsRef.current === 0) {
            setIsCalculating(false);
        }
    }, []);

    // Drain counter and call completeCalculation per recorded response.
    const drainCompletions = useCallback(
        (counterRef: { current: number }) => {
            const count = counterRef.current;
            counterRef.current = 0;
            for (let i = 0; i < count; i++) {
                completeCalculation();
            }
        },
        [completeCalculation],
    );

    // Create the worker once and wire up its message handler.
    useEffect(() => {
        const w = new Worker(new URL("../workers/tubesheet.worker.ts", import.meta.url));

        w.onmessage = (event) => {
            const { type, payload } = event.data;

            if (type === "ALL_RESULTS") {
                // Count ALL_RESULTS now; an effect will drain and clear "isCalculating".
                pendingAllResponsesRef.current += 1;
                setLayoutResults(payload);
            }

            if (type === "SINGLE_RESULT") {
                // Count SINGLE_RESULT and set SVG; TubeSheetSVG's "onRendered" clears "isCalculating".
                pendingSingleResponsesRef.current += 1;
                setCalcError(null);
                setDrawingSVG(generateTubeSheetSVG(payload));
                setLastSingleResult(payload);
            }

            if (type === "ERROR") {
                console.error("Worker Error:", payload);
                setCalcError(typeof payload === "string" ? payload : "Calculation failed.");
                setAnnouncement(`Calculation failed: ${payload}`);
                // On ERROR: reset counters, show error, and stop loading.
                pendingCompletionsRef.current = 0;
                pendingAllResponsesRef.current = 0;
                pendingSingleResponsesRef.current = 0;
                setIsCalculating(false);
                loadingShownAtRef.current = null;
                setShowLoadingBadge(false);
            }
        };

        workerRef.current = w;

        return () => {
            w.terminate();
            workerRef.current = null;
        };
    }, []);

    // Debounce showing the loading badge.
    useEffect(() => {
        if (isCalculating) {
            setAnnouncement("Calculating layout…");

            const showTimer = window.setTimeout(() => {
                loadingShownAtRef.current = Date.now();
                setShowLoadingBadge(true);
            }, SHOW_DELAY_MS);

            return () => clearTimeout(showTimer);
        }

        // Calculation finished. If the badge never actually became visible
        // the cleanup above already cancelled the timer.
        if (loadingShownAtRef.current === null) {
            return;
        }

        const elapsed = Date.now() - loadingShownAtRef.current;
        const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

        const hideTimer = window.setTimeout(() => {
            setShowLoadingBadge(false);
            loadingShownAtRef.current = null;
        }, remaining);

        return () => clearTimeout(hideTimer);
    }, [isCalculating]);

    // After layoutResults commit: drain pending ALL_RESULTS count.
    useEffect(() => {
        drainCompletions(pendingAllResponsesRef);
    }, [layoutResults, drainCompletions]);

    // Stable callback for TubeSheetSVG render.
    const onDrawingRendered = useCallback(() => {
        // Drain pending SINGLE_RESULT count.
        drainCompletions(pendingSingleResponsesRef);

        // Skip initial placeholder announcement
        if (!hasRenderedOnceRef.current) {
            hasRenderedOnceRef.current = true;
            return;
        }

        setAnnouncement("Layout updated.");
    }, [drainCompletions]);

    const postCalculateSingle = useCallback(
        (payload: Record<string, unknown>) => {
            if (!workerRef.current) return;
            beginCalculation();
            workerRef.current.postMessage({ type: "CALCULATE_SINGLE", payload });
        },
        [beginCalculation],
    );

    const postCalculateAll = useCallback(
        (payload: Record<string, unknown>) => {
            if (!workerRef.current) return;
            beginCalculation();
            workerRef.current.postMessage({ type: "CALCULATE_ALL", payload });
        },
        [beginCalculation],
    );

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
    };
}
