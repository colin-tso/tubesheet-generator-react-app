import { useCallback, useEffect, useRef, useState } from "react";

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

// Wait for a pause in typing before spending any CPU on a preview.
const DEBOUNCE_MS = 350;
// Defense-in-depth beyond the input caps below: some combinations of
// geometry (tight pitch, small tube OD) can still be slow even for an
// in-range count/diameter, so bail out if a preview takes too long.
const TIMEOUT_MS = 1500;
// Measured on this machine: a single-layout calculation stays comfortably
// under ~300ms up to roughly these values, then grows ~quadratically (it's a
// grid-area search) into multi-second territory. Above these, skip the
// automatic preview entirely rather than let a keystroke kick off a
// multi-second background computation — the user can still press
// Enter/Tab to run the real (uncapped) calculation.
export const LIVE_PREVIEW_MAX_MIN_TUBES = 3000;
export const LIVE_PREVIEW_MAX_SHELL_ID = 5000;

// Owns a dedicated worker for speculative, as-you-type layout previews —
// separate from the main calculation worker so previews never contend with
// (or get confused for) an actual Calculate action.
//
// The worker is created lazily and then REUSED across requests, the same
// way the main calculation worker is — spinning up a brand-new Worker per
// keystroke (parsing/evaluating the bundle every time) turned out to cost
// more than the calculation itself, making the preview slower than the real
// all-layouts calculation it's meant to get ahead of. Stale responses are
// discarded via a requestId check, same as the main worker.
//
// The only time the worker actually gets torn down and replaced is when a
// computation is genuinely still in flight (hasn't responded yet) when new
// input arrives — that's the one case where reuse isn't enough, since a
// running computation can only be interrupted by killing its worker. An
// idle worker is simply reused, so the common case (previous request
// already finished before the next keystroke's debounce fires) pays no
// respawn cost at all.
export function useLivePreview() {
    const workerRef = useRef<Worker | null>(null);
    const inFlightRef = useRef(false);
    const debounceRef = useRef<number | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const requestSeqRef = useRef(0);

    const [result, setResult] = useState<LivePreviewResult | null>(null);
    const [status, setStatus] = useState<LivePreviewStatus>("idle");

    const clearTimers = useCallback(() => {
        if (debounceRef.current !== null) {
            window.clearTimeout(debounceRef.current);
            debounceRef.current = null;
        }
        if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    // Only actually kills the worker — call sites decide whether that's
    // warranted (i.e. a computation is in flight) or whether the existing,
    // idle worker can simply be reused for the next request.
    const terminateWorker = useCallback(() => {
        workerRef.current?.terminate();
        workerRef.current = null;
        inFlightRef.current = false;
    }, []);

    const getOrCreateWorker = useCallback(() => {
        if (workerRef.current) return workerRef.current;

        const worker = new Worker(new URL("../workers/tubesheet.worker.ts", import.meta.url), {
            type: "module",
        });

        worker.onmessage = (event) => {
            const { type, requestId, payload } = event.data;
            if (requestId !== requestSeqRef.current) return; // superseded reply
            inFlightRef.current = false;
            clearTimers();
            if (type === "SINGLE_RESULT") {
                setResult({
                    shellID: payload.shellID ?? payload.minID ?? undefined,
                    numTubes: payload.numTubes ?? undefined,
                });
                setStatus("ready");
            } else {
                setStatus("unavailable");
                setResult(null);
            }
        };

        worker.onerror = () => {
            inFlightRef.current = false;
            clearTimers();
            setStatus("unavailable");
            setResult(null);
        };

        workerRef.current = worker;
        return worker;
    }, [clearTimers]);

    const cancel = useCallback(() => {
        requestSeqRef.current += 1; // invalidate any in-flight/pending request
        clearTimers();
        // Only pay for a fresh worker next time if one is actually running —
        // an idle worker is left alone and reused.
        if (inFlightRef.current) {
            terminateWorker();
        }
        setStatus("idle");
        setResult(null);
    }, [clearTimers, terminateWorker]);

    const request = useCallback(
        (payload: LivePreviewRequest) => {
            clearTimers();

            if (
                (payload.minTubes !== undefined && payload.minTubes > LIVE_PREVIEW_MAX_MIN_TUBES) ||
                (payload.shellID !== undefined && payload.shellID > LIVE_PREVIEW_MAX_SHELL_ID)
            ) {
                requestSeqRef.current += 1;
                if (inFlightRef.current) terminateWorker();
                setStatus("unavailable");
                setResult(null);
                return;
            }

            // A previous computation is still actually running — the only
            // way to truly stop it is to kill its worker; a fresh one is
            // created on demand below. Otherwise, the existing (idle,
            // already-warmed-up) worker is reused for this request.
            if (inFlightRef.current) {
                terminateWorker();
            }

            const seq = ++requestSeqRef.current;
            setStatus("pending");

            debounceRef.current = window.setTimeout(() => {
                debounceRef.current = null;
                if (seq !== requestSeqRef.current) return; // superseded while waiting

                const worker = getOrCreateWorker();
                inFlightRef.current = true;

                timeoutRef.current = window.setTimeout(() => {
                    if (seq === requestSeqRef.current) {
                        setStatus("unavailable");
                        setResult(null);
                    }
                    terminateWorker();
                }, TIMEOUT_MS);

                worker.postMessage({ type: "CALCULATE_SINGLE", requestId: seq, payload });
            }, DEBOUNCE_MS);
        },
        [clearTimers, terminateWorker, getOrCreateWorker],
    );

    // Make sure nothing keeps running, and the worker itself isn't leaked,
    // after the row unmounts.
    useEffect(() => {
        return () => {
            clearTimers();
            workerRef.current?.terminate();
            workerRef.current = null;
        };
    }, [clearTimers]);

    return { result, status, request, cancel };
}
