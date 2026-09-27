import { describe, it, expect, vi } from "vitest";
import {
    dispatchWorkerMessage,
    resetPendingWorkOnTeardown,
    type CallbackEntry,
    type WorkerDispatchContext,
} from "./useTubeSheetWorker";

// Builds a recording dispatch context so tests can assert exactly which side
// effects ran (completion accounting, state updates, callback invocation).
function makeCtx(overrides: Partial<WorkerDispatchContext> = {}) {
    const calls: Record<string, unknown[][]> = {};
    const record =
        (name: string) =>
        (...args: unknown[]) => {
            (calls[name] ??= []).push(args);
        };

    const ctx: WorkerDispatchContext = {
        pendingCallbacks: new Map<number, CallbackEntry>(),
        latestAllRequestId: null,
        latestSingleRequestId: null,
        completeCalculation: record("completeCalculation"),
        recordAllResponse: record("recordAllResponse"),
        recordSingleResponse: record("recordSingleResponse"),
        setLayoutResults: record("setLayoutResults"),
        setDrawingSVG: record("setDrawingSVG"),
        setLastSingleResult: record("setLastSingleResult"),
        setCalcError: record("setCalcError"),
        setAnnouncement: record("setAnnouncement"),
        ...overrides,
    };
    return { ctx, calls };
}

describe("dispatchWorkerMessage — ERROR handling", () => {
    it("announces and completes for a committed single request, without handing the error string to its callback", () => {
        const { ctx, calls } = makeCtx({ latestSingleRequestId: 1 });
        const callback = vi.fn();
        ctx.pendingCallbacks.set(1, { type: "single", callback, isPreview: false });

        dispatchWorkerMessage(
            {
                type: "ERROR",
                requestId: 1,
                requestType: "CALCULATE_SINGLE",
                payload: "Invalid layout option: 999",
            },
            ctx,
        );

        // The committed callback must never see the raw error string: it would
        // treat it as a result and crash (or corrupt) downstream.
        expect(callback).not.toHaveBeenCalled();
        expect(ctx.pendingCallbacks.size).toBe(0);
        expect(calls.completeCalculation).toHaveLength(1);
        expect(calls.setCalcError).toEqual([["Invalid layout option: 999"]]);
        expect(calls.setAnnouncement).toEqual([["Calculation failed: Invalid layout option: 999"]]);
        // Last good drawing/results are left untouched.
        expect(calls.setDrawingSVG).toBeUndefined();
        expect(calls.setLastSingleResult).toBeUndefined();
    });

    it("resolves a preview callback with null and does not touch completion accounting", () => {
        const { ctx, calls } = makeCtx({ latestSingleRequestId: 2 });
        const callback = vi.fn();
        ctx.pendingCallbacks.set(2, { type: "single", callback, isPreview: true });

        dispatchWorkerMessage(
            { type: "ERROR", requestId: 2, requestType: "CALCULATE_SINGLE", payload: "boom" },
            ctx,
        );

        expect(callback).toHaveBeenCalledWith(null);
        expect(ctx.pendingCallbacks.size).toBe(0);
        expect(calls.completeCalculation).toBeUndefined();
        expect(calls.setCalcError).toEqual([["boom"]]);
        expect(calls.setAnnouncement).toEqual([["Calculation failed: boom"]]);
    });

    it("resolves a sweep callback with null on error, same as a preview", () => {
        const { ctx, calls } = makeCtx({ latestSingleRequestId: 99 });
        const callback = vi.fn();
        ctx.pendingCallbacks.set(4, { type: "sweep", callback, isPreview: true });

        dispatchWorkerMessage(
            { type: "ERROR", requestId: 4, requestType: "CALCULATE_SWEEP", payload: "bad shellID" },
            ctx,
        );

        expect(callback).toHaveBeenCalledWith(null);
        expect(ctx.pendingCallbacks.size).toBe(0);
        // Sweep is always preview-style, so it never touches completion
        // accounting.
        expect(calls.completeCalculation).toBeUndefined();
    });

    it("leaves committed all-results state untouched on error", () => {
        const { ctx, calls } = makeCtx({ latestAllRequestId: 7 });
        ctx.pendingCallbacks.set(7, { type: "all", callback: vi.fn(), isPreview: false });

        dispatchWorkerMessage(
            { type: "ERROR", requestId: 7, requestType: "CALCULATE_ALL", payload: "x" },
            ctx,
        );

        expect(calls.setLayoutResults).toBeUndefined();
        expect(calls.completeCalculation).toHaveLength(1);
        expect(calls.setCalcError).toEqual([["x"]]);
    });

    it("completes a superseded error without announcing it", () => {
        const { ctx, calls } = makeCtx({ latestSingleRequestId: 5 });
        ctx.pendingCallbacks.set(3, { type: "single", callback: vi.fn(), isPreview: false });

        dispatchWorkerMessage(
            { type: "ERROR", requestId: 3, requestType: "CALCULATE_SINGLE", payload: "stale" },
            ctx,
        );

        expect(calls.completeCalculation).toHaveLength(1);
        expect(calls.setCalcError).toBeUndefined();
        expect(calls.setAnnouncement).toBeUndefined();
    });
});

describe("resetPendingWorkOnTeardown", () => {
    it("clears pending callbacks, zeroes the completion counter, and clears isCalculating", () => {
        const pendingCallbacks = new Map<number, CallbackEntry>([
            [1, { type: "single", callback: vi.fn(), isPreview: false }],
            [2, { type: "all", callback: vi.fn(), isPreview: false }],
        ]);
        const pendingCompletionsRef = { current: 2 };
        const setIsCalculating = vi.fn();

        resetPendingWorkOnTeardown({ pendingCallbacks, pendingCompletionsRef, setIsCalculating });

        expect(pendingCallbacks.size).toBe(0);
        expect(pendingCompletionsRef.current).toBe(0);
        expect(setIsCalculating).toHaveBeenCalledWith(false);
    });

    it("is a no-op-safe reset when nothing was in flight", () => {
        const pendingCallbacks = new Map<number, CallbackEntry>();
        const pendingCompletionsRef = { current: 0 };
        const setIsCalculating = vi.fn();

        expect(() =>
            resetPendingWorkOnTeardown({
                pendingCallbacks,
                pendingCompletionsRef,
                setIsCalculating,
            }),
        ).not.toThrow();
        expect(setIsCalculating).toHaveBeenCalledWith(false);
    });

    // Reproduces the StrictMode mount -> cleanup -> mount sequence, which
    // orphans a pending count: a request is sent (pendingCompletionsRef +1),
    // the worker it was sent to is torn down before responding (triggered here
    // by a mount effect that posts a worker request -- see useLayoutForm's
    // shared-link URL bootstrap), and a second request is then sent to -- and
    // answered by -- the replacement worker. Without the reset, the counter
    // would settle at 1 instead of 0.
    it("lets pendingCompletionsRef return to zero after an abandoned request is followed by a completed one", () => {
        const pendingCompletionsRef = { current: 0 };
        const setIsCalculating = vi.fn();
        const completeCalculation = () => {
            pendingCompletionsRef.current = Math.max(0, pendingCompletionsRef.current - 1);
            if (pendingCompletionsRef.current === 0) setIsCalculating(false);
        };

        // First worker instance: a request goes out, then the worker is torn
        // down before it can ever respond.
        pendingCompletionsRef.current += 1;
        setIsCalculating(true);
        resetPendingWorkOnTeardown({
            pendingCallbacks: new Map(),
            pendingCompletionsRef,
            setIsCalculating,
        });
        expect(pendingCompletionsRef.current).toBe(0);

        // Second (replacement) worker instance: a fresh request goes out and
        // this time gets a real response (postCalculateAll/postCalculateSingle
        // both register a committed callback, so this is the "entry found" path
        // in dispatchWorkerMessage, which completes directly).
        pendingCompletionsRef.current += 1;
        setIsCalculating(true);
        const pendingCallbacks = new Map<number, CallbackEntry>([
            [1, { type: "all", callback: vi.fn(), isPreview: false }],
        ]);
        dispatchWorkerMessage(
            { type: "ALL_RESULTS", requestId: 1, payload: {} },
            {
                pendingCallbacks,
                latestAllRequestId: 1,
                latestSingleRequestId: null,
                completeCalculation,
                recordAllResponse: () => {},
                recordSingleResponse: () => {},
                setLayoutResults: () => {},
                setDrawingSVG: () => {},
                setLastSingleResult: () => {},
                setCalcError: () => {},
                setAnnouncement: () => {},
            },
        );

        expect(pendingCompletionsRef.current).toBe(0);
        expect(setIsCalculating).toHaveBeenLastCalledWith(false);
    });
});

describe("dispatchWorkerMessage — success paths", () => {
    it("invokes a committed callback and completes exactly once", () => {
        const { ctx, calls } = makeCtx();
        const callback = vi.fn();
        ctx.pendingCallbacks.set(9, { type: "single", callback, isPreview: false });

        dispatchWorkerMessage({ type: "SINGLE_RESULT", requestId: 9, payload: { minID: 50 } }, ctx);

        expect(callback).toHaveBeenCalledWith({ minID: 50 });
        expect(ctx.pendingCallbacks.size).toBe(0);
        expect(calls.completeCalculation).toHaveLength(1);
    });

    it("invokes a sweep callback with the results array and never touches completion accounting", () => {
        const { ctx, calls } = makeCtx();
        const callback = vi.fn();
        ctx.pendingCallbacks.set(10, { type: "sweep", callback, isPreview: true });

        const points = [{ shellID: 200, numTubes: 37, OTL: 180.5 }];
        dispatchWorkerMessage({ type: "SWEEP_RESULTS", requestId: 10, payload: points }, ctx);

        expect(callback).toHaveBeenCalledWith(points);
        expect(ctx.pendingCallbacks.size).toBe(0);
        expect(calls.completeCalculation).toBeUndefined();
    });

    it("updates state for the latest request made without a callback", () => {
        const { ctx, calls } = makeCtx({ latestSingleRequestId: 1 });

        dispatchWorkerMessage(
            { type: "SINGLE_RESULT", requestId: 1, payload: { minID: 100 } },
            ctx,
        );

        expect(calls.recordSingleResponse).toHaveLength(1);
        expect(calls.setDrawingSVG).toEqual([[{ minID: 100 }]]);
        expect(calls.setLastSingleResult).toEqual([[{ minID: 100 }]]);
        expect(calls.setCalcError).toEqual([[null]]);
        expect(calls.completeCalculation).toBeUndefined();
    });

    it("records stale results but never overwrites state", () => {
        const { ctx, calls } = makeCtx({ latestSingleRequestId: 2 });

        dispatchWorkerMessage({ type: "SINGLE_RESULT", requestId: 1, payload: {} }, ctx);
        dispatchWorkerMessage({ type: "ALL_RESULTS", requestId: 1, payload: {} }, ctx);

        expect(calls.completeCalculation).toHaveLength(2);
        expect(calls.recordSingleResponse).toBeUndefined();
        expect(calls.recordAllResponse).toBeUndefined();
        expect(calls.setDrawingSVG).toBeUndefined();
        expect(calls.setLayoutResults).toBeUndefined();
    });
});
