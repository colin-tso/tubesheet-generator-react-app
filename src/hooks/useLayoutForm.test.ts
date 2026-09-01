import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLayoutForm } from "./useLayoutForm";

function setup() {
    const postCalculateSingle = vi.fn();
    const postCalculateAll = vi.fn();
    const { result } = renderHook(() =>
        useLayoutForm({
            lastSingleResult: null,
            postCalculateSingle,
            postCalculateAll,
        }),
    );
    return { result, postCalculateSingle, postCalculateAll };
}

// Commits every field needed for layoutInputsDefined/layoutOptionSelected to
// go true, via the same onBlur/onLayoutOptionChange path a real form uses —
// so applyShellID's guarded branches (which check layoutInputsDefined) are
// exercised the same way they would be in the app.
function fillRequiredFields(result: ReturnType<typeof setup>["result"]) {
    const commit = (name: string, value: string) => {
        act(() => {
            result.current.onBlur({
                currentTarget: { name, value },
            } as unknown as React.SyntheticEvent<HTMLInputElement>);
        });
    };
    commit("OTLtoShell", "6.35");
    commit("tubeOD", "19.05");
    commit("tubeClearance", "4.7625"); // -> pitchRatio 1.25
    commit("minTubes", "50");
    act(() => {
        result.current.onLayoutOptionChange({
            currentTarget: { name: "layoutOption", value: "30" },
        } as unknown as React.ChangeEvent<HTMLInputElement>);
    });
}

describe("useLayoutForm — applyShellID", () => {
    it("sets shellID, clears minTubes, and recalculates both the comparison and the drawing", () => {
        const { result, postCalculateSingle, postCalculateAll } = setup();
        fillRequiredFields(result);
        postCalculateSingle.mockClear();
        postCalculateAll.mockClear();

        act(() => {
            result.current.applyShellID(300);
        });

        expect(result.current.shellID).toBe(300);
        expect(result.current.minTubes).toBeUndefined();
        expect(postCalculateAll).toHaveBeenCalledWith(
            expect.objectContaining({ shellID: 300, minTubes: undefined }),
        );
        expect(postCalculateSingle).toHaveBeenCalledWith(
            expect.objectContaining({ shellID: 300, minTubes: undefined }),
        );
    });

    it("does not recalculate if applying the shell ID already in effect and minTubes is already clear", () => {
        const { result, postCalculateSingle, postCalculateAll } = setup();
        fillRequiredFields(result);

        act(() => {
            result.current.applyShellID(300);
        });
        postCalculateSingle.mockClear();
        postCalculateAll.mockClear();

        act(() => {
            result.current.applyShellID(300); // same value again
        });

        expect(postCalculateAll).not.toHaveBeenCalled();
        expect(postCalculateSingle).not.toHaveBeenCalled();
    });

    it("onBlur committing shellID produces the same result as applyShellID (shared logic)", () => {
        const a = setup();
        const b = setup();
        fillRequiredFields(a.result);
        fillRequiredFields(b.result);
        a.postCalculateSingle.mockClear();
        a.postCalculateAll.mockClear();
        b.postCalculateSingle.mockClear();
        b.postCalculateAll.mockClear();

        act(() => {
            a.result.current.applyShellID(275);
        });
        act(() => {
            b.result.current.onBlur({
                currentTarget: { name: "shellID", value: "275" },
            } as unknown as React.SyntheticEvent<HTMLInputElement>);
        });

        expect(a.result.current.shellID).toBe(b.result.current.shellID);
        expect(a.result.current.minTubes).toBe(b.result.current.minTubes);
        expect(a.postCalculateAll.mock.calls).toEqual(b.postCalculateAll.mock.calls);
        expect(a.postCalculateSingle.mock.calls).toEqual(b.postCalculateSingle.mock.calls);
    });
});
