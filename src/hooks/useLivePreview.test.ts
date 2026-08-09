import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLivePreview } from "./useLivePreview";

describe("useLivePreview", () => {
    it("keeps showing a ready result instead of reverting to null after the safety timeout window", async () => {
        vi.useFakeTimers();

        // Worker responds almost immediately (fast, successful response).
        const requestSingle = vi.fn((_payload, callback) => {
            setTimeout(() => callback({ numTubes: 0, shellID: 20 }), 10);
            return 1;
        });

        const { result } = renderHook(() => useLivePreview(requestSingle as never));

        act(() => {
            result.current.request({
                OTLtoShell: 10,
                tubeOD: 25,
                pitchRatio: 1.2,
                layoutOption: 30,
                shellID: 20,
            });
        });

        // Advance past the debounce (350ms) + worker response (10ms).
        await act(async () => {
            vi.advanceTimersByTime(400);
        });

        expect(result.current.status).toBe("ready");
        expect(result.current.result?.numTubes).toBe(0);

        // Advance past the 1500ms safety timeout window (anchored to when the
        // debounce fired), well after the response already landed.
        await act(async () => {
            vi.advanceTimersByTime(1500);
        });

        expect(result.current.status).toBe("ready");
        expect(result.current.result?.numTubes).toBe(0);

        vi.useRealTimers();
    });

    it("still marks the preview unavailable if the worker never responds", async () => {
        vi.useFakeTimers();

        const requestSingle = vi.fn(() => 1); // never calls back

        const { result } = renderHook(() => useLivePreview(requestSingle as never));

        act(() => {
            result.current.request({
                OTLtoShell: 10,
                tubeOD: 25,
                pitchRatio: 1.2,
                layoutOption: 30,
                shellID: 20,
            });
        });

        await act(async () => {
            vi.advanceTimersByTime(350 + 1500 + 1);
        });

        expect(result.current.status).toBe("unavailable");
        expect(result.current.result).toBeNull();

        vi.useRealTimers();
    });
});
