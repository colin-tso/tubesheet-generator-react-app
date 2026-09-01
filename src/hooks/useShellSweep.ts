import { useCallback, useEffect, useRef, useState } from "react";
import type { ShellSweepPoint } from "@/plugins/tubesheet-layout-generator";
import type { SweepCallback } from "./useTubeSheetWorker";

export type ShellSweepStatus = "idle" | "pending" | "ready" | "unavailable";

export interface ShellSweepRequest {
    OTLtoShell: number;
    tubeOD: number;
    pitchRatio: number;
    layoutOption: number | "radial";
    currentNumTubes: number;
    centerShellID: number;
}

type RequestSweep = (payload: Record<string, unknown>, callback: SweepCallback) => number;

// Safety net in case the worker never responds at all (e.g. it crashed) —
// mirrors useLivePreview's TIMEOUT_MS for the same reason.
const TIMEOUT_MS = 4000;
export const SHELL_SWEEP_TIMING = { timeout: TIMEOUT_MS } as const;

// Debounce timing — matches the layout options loading badge so the sweep
// panel feels consistent: 150 ms before the loading indicator appears, and
// once shown it stays visible for at least 300 ms to avoid flicker.
const SHOW_DELAY_MS = 150;
const MIN_VISIBLE_MS = 300;

/**
 * Requests a shell-size sweep (tube count/OTL vs. shell ID) and tracks its
 * status. A sweep is triggered explicitly (e.g. a "Compare shell sizes"
 * button), not on every keystroke, so — unlike useLivePreview — there's no
 * debounce here, only the same stale-response guarding: a `request` call
 * bumps a sequence number, and any earlier in-flight request's response is
 * ignored once it arrives, so a fast second click can't be clobbered by a
 * slower first one resolving after it.
 *
 * `points` are preserved across pending requests so the UI can keep showing
 * stale rows instead of flashing empty. `showLoading` debounces the loading
 * indicator (150 ms show delay, 300 ms minimum visibility).
 */
export function useShellSweep(requestSweep: RequestSweep) {
    const [points, setPoints] = useState<ShellSweepPoint[] | null>(null);
    const [status, setStatus] = useState<ShellSweepStatus>("idle");
    const [showLoading, setShowLoading] = useState(false);

    const timeoutRef = useRef<number | null>(null);
    const seqRef = useRef(0); // increments to discard stale responses
    const loadingShownAtRef = useRef<number | null>(null);

    const clearTimer = useCallback(() => {
        if (timeoutRef.current !== null) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const cancel = useCallback(() => {
        seqRef.current += 1; // invalidates any pending callback/timeout
        clearTimer();
        setStatus("idle");
        setPoints(null);
        setShowLoading(false);
        loadingShownAtRef.current = null;
    }, [clearTimer]);

    const request = useCallback(
        (payload: ShellSweepRequest) => {
            clearTimer();
            const seq = ++seqRef.current;
            setStatus("pending");

            requestSweep(
                {
                    OTLtoShell: payload.OTLtoShell,
                    tubeOD: payload.tubeOD,
                    pitchRatio: payload.pitchRatio,
                    layoutOption: payload.layoutOption,
                    currentNumTubes: payload.currentNumTubes,
                    centerShellID: payload.centerShellID,
                },
                (result) => {
                    if (seq !== seqRef.current) return; // superseded by a newer request
                    clearTimer();

                    // The worker reports a failed sweep as a null payload
                    // (never the raw error string) — surface it as
                    // unavailable instead of a bogus/empty chart.
                    if (!result) {
                        setStatus("unavailable");
                        setPoints(null);
                        return;
                    }
                    setPoints(result);
                    setStatus("ready");
                },
            );

            timeoutRef.current = window.setTimeout(() => {
                if (seq === seqRef.current) {
                    setStatus("unavailable");
                    setPoints(null);
                }
            }, TIMEOUT_MS);
        },
        [clearTimer, requestSweep],
    );

    // Show-loading debounce: mirrors useTubeSheetWorker's showLoadingBadge.
    // Only starts the timer when status transitions to "pending"; once the
    // badge is shown it stays visible for at least MIN_VISIBLE_MS to avoid
    // flicker on fast responses.
    useEffect(() => {
        if (status === "pending") {
            const timer = setTimeout(() => {
                loadingShownAtRef.current = Date.now();
                setShowLoading(true);
            }, SHOW_DELAY_MS);
            return () => clearTimeout(timer);
        }
        if (loadingShownAtRef.current === null) return;
        const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - loadingShownAtRef.current));
        const timer = setTimeout(() => {
            setShowLoading(false);
            loadingShownAtRef.current = null;
        }, remaining);
        return () => clearTimeout(timer);
    }, [status]);

    useEffect(() => clearTimer, [clearTimer]);

    return { points, status, showLoading, request, cancel };
}
