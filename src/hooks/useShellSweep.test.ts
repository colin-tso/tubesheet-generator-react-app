import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useShellSweep, SHELL_SWEEP_TIMING } from "./useShellSweep";

const { timeout: TIMEOUT_MS } = SHELL_SWEEP_TIMING;

const SHOW_DELAY_MS = 150;
const MIN_VISIBLE_MS = 300;

const basePayload = {
    OTLtoShell: 6.35,
    tubeOD: 19.05,
    pitchRatio: 1.25,
    layoutOption: 30 as const,
    currentNumTubes: 37,
    centerShellID: 200,
};

describe("useShellSweep", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("goes pending then ready with the resolved points, in order", () => {
        const points = [
            { shellID: 150, numTubes: 19, OTL: 130 },
            { shellID: 200, numTubes: 37, OTL: 180 },
            { shellID: 250, numTubes: 61, OTL: 230 },
        ];
        const requestSweep = vi.fn((_payload, callback) => {
            callback(points);
            return 1;
        });

        const { result } = renderHook(() => useShellSweep(requestSweep as never));

        expect(result.current.status).toBe("idle");

        act(() => {
            result.current.request(basePayload);
        });

        expect(result.current.status).toBe("ready");
        expect(result.current.points).toEqual(points);
    });

    it("forwards exactly the sweep fields to requestSweep, nothing extra", () => {
        const requestSweep = vi.fn(() => 1);
        const { result } = renderHook(() => useShellSweep(requestSweep as never));

        act(() => {
            result.current.request(basePayload);
        });

        expect(requestSweep).toHaveBeenCalledWith(basePayload, expect.any(Function));
    });

    it("preserves old points during pending (does not null them)", () => {
        const oldPoints = [
            { shellID: 150, numTubes: 19, OTL: 130 },
            { shellID: 200, numTubes: 37, OTL: 180 },
        ];
        const newPoints = [
            { shellID: 250, numTubes: 61, OTL: 230 },
        ];

        let firstCallback: ((points: unknown) => void) | undefined;
        const requestSweep = vi.fn()
            .mockImplementationOnce((_payload, callback) => {
                // Resolve first request immediately to seed old points
                callback(oldPoints);
                return 1;
            })
            .mockImplementationOnce((_payload, callback) => {
                // Second request — don't resolve yet
                firstCallback = callback;
                return 2;
            });

        const { result } = renderHook(() => useShellSweep(requestSweep as never));

        // First request resolves — seed old points
        act(() => {
            result.current.request(basePayload);
        });
        expect(result.current.points).toEqual(oldPoints);
        expect(result.current.status).toBe("ready");

        // Advance past showLoading debounce so showLoading is false
        act(() => {
            vi.advanceTimersByTime(SHOW_DELAY_MS + MIN_VISIBLE_MS + 1);
        });
        expect(result.current.showLoading).toBe(false);

        // Second request — points should still be oldPoints during pending
        act(() => {
            result.current.request({ ...basePayload, centerShellID: 999 });
        });
        expect(result.current.status).toBe("pending");
        expect(result.current.points).toEqual(oldPoints); // preserved, not nulled

        // Second request resolves — points update
        act(() => {
            firstCallback?.(newPoints);
        });
        expect(result.current.points).toEqual(newPoints);
        expect(result.current.status).toBe("ready");
    });

    it("ignores a stale response from a superseded request", () => {
        let firstCallback: ((points: unknown) => void) | undefined;
        const requestSweep = vi
            .fn()
            .mockImplementationOnce((_payload, callback) => {
                firstCallback = callback;
                return 1;
            })
            .mockImplementationOnce((_payload, callback) => {
                callback([{ shellID: 999, numTubes: 5, OTL: 100 }]);
                return 2;
            });

        const { result } = renderHook(() => useShellSweep(requestSweep as never));

        act(() => {
            result.current.request(basePayload); // first request, doesn't resolve yet
        });
        act(() => {
            result.current.request({ ...basePayload, centerShellID: 999 }); // second, resolves immediately
        });

        expect(result.current.points).toEqual([{ shellID: 999, numTubes: 5, OTL: 100 }]);

        // The first (now-stale) request finally resolves — must not clobber
        // the second request's already-landed result.
        act(() => {
            firstCallback?.([{ shellID: 1, numTubes: 1, OTL: 1 }]);
        });

        expect(result.current.points).toEqual([{ shellID: 999, numTubes: 5, OTL: 100 }]);
        expect(result.current.status).toBe("ready");
    });

    it("surfaces a null (failed) response as unavailable instead of an empty chart", () => {
        const requestSweep = vi.fn((_payload, callback) => {
            callback(null);
            return 1;
        });

        const { result } = renderHook(() => useShellSweep(requestSweep as never));

        act(() => {
            result.current.request(basePayload);
        });

        expect(result.current.status).toBe("unavailable");
        expect(result.current.points).toBeNull();
    });

    it("marks the sweep unavailable if the worker never responds", () => {
        const requestSweep = vi.fn(() => 1); // never calls back

        const { result } = renderHook(() => useShellSweep(requestSweep as never));

        act(() => {
            result.current.request(basePayload);
        });
        expect(result.current.status).toBe("pending");

        act(() => {
            vi.advanceTimersByTime(TIMEOUT_MS + 1);
        });

        expect(result.current.status).toBe("unavailable");
        expect(result.current.points).toBeNull();
    });

    it("cancel() resets to idle and invalidates any in-flight request", () => {
        let pendingCallback: ((points: unknown) => void) | undefined;
        const requestSweep = vi.fn((_payload, callback) => {
            pendingCallback = callback;
            return 1;
        });

        const { result } = renderHook(() => useShellSweep(requestSweep as never));

        act(() => {
            result.current.request(basePayload);
        });
        expect(result.current.status).toBe("pending");

        act(() => {
            result.current.cancel();
        });
        expect(result.current.status).toBe("idle");
        expect(result.current.points).toBeNull();

        // A response landing after cancel() must not resurrect the sweep.
        act(() => {
            pendingCallback?.([{ shellID: 1, numTubes: 1, OTL: 1 }]);
        });
        expect(result.current.status).toBe("idle");
        expect(result.current.points).toBeNull();
    });

    describe("showLoading debounce", () => {
        it("does not show loading badge before SHOW_DELAY_MS", () => {
            const requestSweep = vi.fn(() => 1); // never calls back
            const { result } = renderHook(() => useShellSweep(requestSweep as never));

            act(() => {
                result.current.request(basePayload);
            });

            expect(result.current.status).toBe("pending");
            expect(result.current.showLoading).toBe(false);

            // Advance 149ms — still before the 150ms threshold
            act(() => {
                vi.advanceTimersByTime(SHOW_DELAY_MS - 1);
            });
            expect(result.current.showLoading).toBe(false);
        });

        it("shows loading badge after SHOW_DELAY_MS", () => {
            const requestSweep = vi.fn(() => 1);
            const { result } = renderHook(() => useShellSweep(requestSweep as never));

            act(() => {
                result.current.request(basePayload);
            });

            act(() => {
                vi.advanceTimersByTime(SHOW_DELAY_MS);
            });
            expect(result.current.showLoading).toBe(true);
        });

        it("keeps loading badge visible for at least MIN_VISIBLE_MS after completion", () => {
            let resolveCallback: ((points: unknown) => void) | undefined;
            const requestSweep = vi.fn((_payload, callback) => {
                resolveCallback = callback;
                return 1;
            });

            const { result } = renderHook(() => useShellSweep(requestSweep as never));

            // Start request — badge appears after 150ms
            act(() => {
                result.current.request(basePayload);
            });
            expect(result.current.status).toBe("pending");

            act(() => {
                vi.advanceTimersByTime(SHOW_DELAY_MS);
            });
            expect(result.current.showLoading).toBe(true);
            expect(result.current.status).toBe("pending");

            // Resolve the sweep — badge should stay visible for min 300ms
            act(() => {
                resolveCallback?.([{ shellID: 200, numTubes: 37, OTL: 180 }]);
            });
            expect(result.current.status).toBe("ready");

            // Advance 299ms — badge still visible (min 300ms)
            act(() => {
                vi.advanceTimersByTime(MIN_VISIBLE_MS - 1);
            });
            expect(result.current.showLoading).toBe(true);

            // Advance 1 more ms — badge clears
            act(() => {
                vi.advanceTimersByTime(1);
            });
            expect(result.current.showLoading).toBe(false);
        });

        it("clears showLoading on cancel", () => {
            const requestSweep = vi.fn(() => 1);
            const { result } = renderHook(() => useShellSweep(requestSweep as never));

            act(() => {
                result.current.request(basePayload);
            });
            act(() => {
                vi.advanceTimersByTime(SHOW_DELAY_MS);
            });
            expect(result.current.showLoading).toBe(true);

            act(() => {
                result.current.cancel();
            });
            expect(result.current.showLoading).toBe(false);
        });
    });
});
