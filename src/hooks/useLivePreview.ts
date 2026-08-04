import { useCallback, useEffect, useRef, useState } from "react";
import type { SingleResultPayload } from "./useTubeSheetWorker";

export type LivePreviewStatus = "idle" | "pending" | "ready" | "unavailable";
export interface LivePreviewResult {
    shellID?: number;
    numTubes?: number;
}
export interface LivePreviewRequest {
    OTLtoShell: number;
    tubeOD: number;
    pitchRatio: number;
    layoutOption: number;
    minTubes?: number;
    shellID?: number;
}

const DEBOUNCE_MS = 350;
const TIMEOUT_MS = 1500;
export const LIVE_PREVIEW_MAX_MIN_TUBES = 3000;
export const LIVE_PREVIEW_MAX_SHELL_ID = 5000;

export function useLivePreview(
    requestSingle: (
        payload: Record<string, unknown>,
        callback: (payload: SingleResultPayload) => void,
        isPreview?: boolean,
    ) => number,
) {
    const [result, setResult] = useState<LivePreviewResult | null>(null);
    const [status, setStatus] = useState<LivePreviewStatus>("idle");

    const debounceRef = useRef<number | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const seqRef = useRef(0); // increments to discard stale responses

    const clearTimers = useCallback(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const cancel = useCallback(() => {
        seqRef.current += 1; // invalidates pending callbacks
        clearTimers();
        setStatus("idle");
        setResult(null);
    }, [clearTimers]);

    const request = useCallback(
        (payload: LivePreviewRequest) => {
            clearTimers();

            // Prevent expensive calculations on extreme values
            if (
                (payload.minTubes !== undefined && payload.minTubes > LIVE_PREVIEW_MAX_MIN_TUBES) ||
                (payload.shellID !== undefined && payload.shellID > LIVE_PREVIEW_MAX_SHELL_ID)
            ) {
                seqRef.current += 1;
                setStatus("unavailable");
                setResult(null);
                return;
            }

            const seq = ++seqRef.current;
            setStatus("pending");

            debounceRef.current = window.setTimeout(() => {
                debounceRef.current = null;
                if (seq !== seqRef.current) return;

                // Use the shared worker (isPreview = true)
                requestSingle(
                    {
                        OTLtoShell: payload.OTLtoShell,
                        tubeOD: payload.tubeOD,
                        pitchRatio: payload.pitchRatio,
                        layoutOption: payload.layoutOption,
                        minTubes: payload.minTubes,
                        shellID: payload.shellID,
                    },
                    (response) => {
                        if (seq !== seqRef.current) return;
                        setResult({
                            shellID: response?.shellID ?? response?.minID ?? undefined,
                            numTubes: response?.numTubes ?? undefined,
                        });
                        setStatus("ready");
                    },
                    true,
                );

                // Safety timeout – if worker doesn't respond, mark unavailable
                timeoutRef.current = window.setTimeout(() => {
                    if (seq === seqRef.current) {
                        setStatus("unavailable");
                        setResult(null);
                    }
                }, TIMEOUT_MS);
            }, DEBOUNCE_MS);
        },
        [clearTimers, requestSingle],
    );

    useEffect(() => clearTimers, [clearTimers]);

    return { result, status, request, cancel };
}
