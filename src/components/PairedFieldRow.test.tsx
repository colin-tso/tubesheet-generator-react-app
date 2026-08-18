import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { PairedFieldRow } from "./PairedFieldRow";
import { NumericField } from "./NumericField";
import { useLayoutForm } from "@/hooks/useLayoutForm";
import { numericFieldConfigs } from "@/constants/numericFieldConfigs";
import type { SingleResultPayload } from "@/hooks/useTubeSheetWorker";

// Exercises the tubeClearance/pitchRatio pair (synchronous preview) end to end
// through the real useLayoutForm reducer, since it needs no worker mock.
const clearancePitchRow = numericFieldConfigs.filter((cfg) => cfg.row === "clearance-pitch");
const sizeRow = numericFieldConfigs.filter((cfg) => cfg.row === "minTubes-shellID");
const tubeODConfig = numericFieldConfigs.find((cfg) => cfg.id === "tubeOD")!;
const OTLtoShellConfig = numericFieldConfigs.find((cfg) => cfg.id === "OTLtoShell")!;
// Stable reference (as the real useTubeSheetWorker's requestSingle is) so it
// doesn't itself cause the paired fields to lose memoization across renders.
const stubRequestSingle = () => 0;

// Worker stub for the minTubes/shellID pair: echoes back a distinct number
// per direction so it's obvious in assertions which preview was picked up.
const workerRequestSingle = (
    payload: Record<string, unknown>,
    callback: (payload: SingleResultPayload) => void,
) => {
    if (payload.shellID !== undefined) {
        setTimeout(() => callback({ numTubes: 777 } as SingleResultPayload), 10);
    } else if (payload.minTubes !== undefined) {
        setTimeout(() => callback({ shellID: 88 } as SingleResultPayload), 10);
    }
    return 1;
};

function WorkerHarness() {
    const form = useLayoutForm({
        lastSingleResult: null,
        postCalculateSingle: () => {},
        postCalculateAll: () => {},
    });

    const fieldValues = {
        minTubes: form.minTubes,
        tubeOD: form.tubeOD,
        OTLtoShell: form.OTLtoShell,
        tubeClearance: form.tubeClearance,
        pitchRatio: form.pitchRatio,
        shellID: form.shellID,
        actualTubes: form.actualTubes,
        layoutOption: form.layoutOption,
    };

    return (
        <>
            <NumericField
                {...tubeODConfig}
                value={form.tubeOD}
                onBlur={form.onBlur}
                onKeyDown={form.onKeyDown}
                onAccept={(value) => form.onAcceptEmpty(value, "tubeOD")}
                onSubmit={form.inputOnSubmitHandler}
            />
            <NumericField
                {...OTLtoShellConfig}
                value={form.OTLtoShell}
                onBlur={form.onBlur}
                onKeyDown={form.onKeyDown}
                onAccept={(value) => form.onAcceptEmpty(value, "OTLtoShell")}
                onSubmit={form.inputOnSubmitHandler}
            />
            <PairedFieldRow
                row={clearancePitchRow}
                fieldValues={fieldValues}
                layoutOption={form.layoutOption}
                committedResult={null}
                isCalculating={false}
                onBlur={form.onBlur}
                onKeyDown={form.onKeyDown}
                onAcceptEmpty={form.onAcceptEmpty}
                inputOnSubmitHandler={form.inputOnSubmitHandler}
                requestSingle={stubRequestSingle}
            />
            <PairedFieldRow
                row={sizeRow}
                fieldValues={fieldValues}
                layoutOption={form.layoutOption}
                committedResult={null}
                isCalculating={false}
                onBlur={form.onBlur}
                onKeyDown={form.onKeyDown}
                onAcceptEmpty={form.onAcceptEmpty}
                inputOnSubmitHandler={form.inputOnSubmitHandler}
                requestSingle={workerRequestSingle}
            />
        </>
    );
}

function Harness() {
    const form = useLayoutForm({
        lastSingleResult: null,
        postCalculateSingle: () => {},
        postCalculateAll: () => {},
    });

    const fieldValues = {
        minTubes: form.minTubes,
        tubeOD: form.tubeOD,
        OTLtoShell: form.OTLtoShell,
        tubeClearance: form.tubeClearance,
        pitchRatio: form.pitchRatio,
        shellID: form.shellID,
        actualTubes: form.actualTubes,
        layoutOption: form.layoutOption,
    };

    return (
        <>
            <NumericField
                {...tubeODConfig}
                value={form.tubeOD}
                onBlur={form.onBlur}
                onKeyDown={form.onKeyDown}
                onAccept={(value) => form.onAcceptEmpty(value, "tubeOD")}
                onSubmit={form.inputOnSubmitHandler}
            />
            <NumericField
                {...OTLtoShellConfig}
                value={form.OTLtoShell}
                onBlur={form.onBlur}
                onKeyDown={form.onKeyDown}
                onAccept={(value) => form.onAcceptEmpty(value, "OTLtoShell")}
                onSubmit={form.inputOnSubmitHandler}
            />
            <button type="button">elsewhere</button>
            <PairedFieldRow
                row={clearancePitchRow}
                fieldValues={fieldValues}
                layoutOption={form.layoutOption}
                committedResult={null}
                isCalculating={false}
                onBlur={form.onBlur}
                onKeyDown={form.onKeyDown}
                onAcceptEmpty={form.onAcceptEmpty}
                inputOnSubmitHandler={form.inputOnSubmitHandler}
                requestSingle={stubRequestSingle}
            />
            <PairedFieldRow
                row={sizeRow}
                fieldValues={fieldValues}
                layoutOption={form.layoutOption}
                committedResult={null}
                isCalculating={false}
                onBlur={form.onBlur}
                onKeyDown={form.onKeyDown}
                onAcceptEmpty={form.onAcceptEmpty}
                inputOnSubmitHandler={form.inputOnSubmitHandler}
                requestSingle={stubRequestSingle}
            />
        </>
    );
}

async function setTubeOD(user: ReturnType<typeof userEvent.setup>, value: string) {
    const input = screen.getByLabelText(/^Tube OD/);
    await user.click(input);
    await user.type(input, value);
    await user.tab();
}

describe("PairedFieldRow live preview (tube clearance / pitch ratio)", () => {
    it("shows an editable, muted preview in the paired field while typing, without marking it valid", async () => {
        const user = userEvent.setup();
        render(<Harness />);
        await setTubeOD(user, "25");

        const clearanceInput = screen.getByLabelText("Tube clearance") as HTMLInputElement;
        const pitchInput = screen.getByLabelText("Pitch ratio") as HTMLInputElement;

        await user.click(clearanceInput);
        await user.type(clearanceInput, "5"); // clearance=5, tubeOD=25 -> pitch preview = 1.2

        // Not yet committed: still editable text in the box, but not "valid".
        expect(Number(pitchInput.value)).toBeCloseTo(1.2, 2);
        expect(pitchInput).toHaveClass("field-preview");
        expect(pitchInput).not.toHaveClass("field-valid");

        // Still mid-edit: tubeClearance itself hasn't been committed either.
        expect(clearanceInput).not.toHaveClass("field-valid");
    });

    it("commits the pair from what was actually typed, keeping the dependent side muted", async () => {
        const user = userEvent.setup();
        render(<Harness />);
        await setTubeOD(user, "25");

        const clearanceInput = screen.getByLabelText("Tube clearance") as HTMLInputElement;
        const pitchInput = screen.getByLabelText("Pitch ratio") as HTMLInputElement;
        const elsewhere = screen.getByRole("button", { name: "elsewhere" });

        await user.click(clearanceInput);
        await user.type(clearanceInput, "5");
        await user.click(elsewhere); // leave without ever touching pitchInput

        // The real commit derives pitchRatio from the actually-typed 5, not
        // some other stale number.
        expect(Number(clearanceInput.value)).toBeCloseTo(5, 2);
        expect(Number(pitchInput.value)).toBeCloseTo(1.2, 2);

        // clearance was the field the user actually drove -> valid/green.
        // pitchRatio is the computed, dependent side of the pair -> even though
        // it now holds a real number, it stays muted so the pair still visually
        // shows which field is driving the calculation.
        expect(clearanceInput).toHaveClass("field-valid");
        expect(pitchInput).not.toHaveClass("field-valid");
        expect(pitchInput).toHaveClass("field-preview");
    });

    it("swaps which side is muted when the dependent field is overridden directly", async () => {
        const user = userEvent.setup();
        render(<Harness />);
        await setTubeOD(user, "25");

        const clearanceInput = screen.getByLabelText("Tube clearance") as HTMLInputElement;
        const pitchInput = screen.getByLabelText("Pitch ratio") as HTMLInputElement;
        const elsewhere = screen.getByRole("button", { name: "elsewhere" });

        await user.click(clearanceInput);
        await user.type(clearanceInput, "5");
        await user.click(elsewhere); // commits clearance=5 (driving), pitch=1.2 (dependent/muted)

        // Now override the (muted, but real) pitch ratio directly.
        await user.click(pitchInput);
        await user.clear(pitchInput);
        await user.type(pitchInput, "1.5");
        await user.click(elsewhere);

        // tubeClearance re-derives from the actual override (1.5), not the
        // earlier 5: (1.5 - 1) * 25 = 12.5.
        expect(Number(pitchInput.value)).toBeCloseTo(1.5, 2);
        expect(Number(clearanceInput.value)).toBeCloseTo(12.5, 2);

        // Roles have swapped: pitchRatio is now the driving field (valid),
        // tubeClearance is now the dependent one (muted).
        expect(pitchInput).toHaveClass("field-valid");
        expect(clearanceInput).not.toHaveClass("field-valid");
        expect(clearanceInput).toHaveClass("field-preview");
    });

    it("keeps accepting further keystrokes while the paired preview keeps updating", async () => {
        // Regression test: every keystroke here also updates pitchRatio's
        // controlled "value" (a fresh preview), which re-renders it. If that
        // programmatic update were misread as a real edit on pitchRatio, it
        // would flip the preview target and reset tubeClearance's own displayed
        // value mid-typing, dropping the next keystroke.
        const user = userEvent.setup();
        render(<Harness />);
        await setTubeOD(user, "25");

        const clearanceInput = screen.getByLabelText("Tube clearance") as HTMLInputElement;
        const pitchInput = screen.getByLabelText("Pitch ratio") as HTMLInputElement;

        await user.click(clearanceInput);
        await user.type(clearanceInput, "1");
        expect(clearanceInput.value).toBe("1");
        expect(Number(pitchInput.value)).toBeCloseTo(1.04, 2); // 1 + 1/25

        await user.type(clearanceInput, "2");
        expect(clearanceInput.value).toBe("12");
        expect(Number(pitchInput.value)).toBeCloseTo(1.48, 2); // 1 + 12/25

        await user.type(clearanceInput, "3");
        expect(clearanceInput.value).toBe("123");
        expect(Number(pitchInput.value)).toBeCloseTo(5.92, 2); // 1 + 123/25
    });

    it("has no Tab-focus race to guard against: the preview is synchronous", async () => {
        // compute() runs inline in the keystroke handler (no debounce/worker
        // round trip), so Tab landing on pitchRatio right after committing
        // tubeClearance can never arrive before its preview does -- typing
        // over it should always land normally.
        const user = userEvent.setup();
        render(<Harness />);
        await setTubeOD(user, "25");

        const clearanceInput = screen.getByLabelText("Tube clearance") as HTMLInputElement;
        await user.click(clearanceInput);
        await user.type(clearanceInput, "5");
        await user.tab(); // commits tubeClearance; Tab lands focus on pitchRatio next

        expect(document.activeElement?.id).toBe("pitchRatio");

        const pitchInput = screen.getByLabelText("Pitch ratio") as HTMLInputElement;
        expect(Number(pitchInput.value)).toBeCloseTo(1.2, 2); // already available, no wait needed

        // Typing on top of it lands normally.
        await user.keyboard("9");
        expect(pitchInput.value).not.toBe("");
    });
});

describe("PairedFieldRow live preview (min tubes / shell ID)", () => {
    // Commits tubeOD/OTLtoShell/tubeClearance and minTubes=500 so shellID is
    // ready to live-preview off the worker stub (shellID -> 88).
    async function commitMinTubes(user: ReturnType<typeof userEvent.setup>) {
        await setTubeOD(user, "25");

        const OTLInput = screen.getByLabelText(/^OTL to shell/) as HTMLInputElement;
        await user.click(OTLInput);
        await user.type(OTLInput, "5");
        await user.tab();

        // Commit tubeClearance so pitchRatio (required for the size-row live
        // preview to be considered "ready") is actually defined.
        const clearanceInput = screen.getByLabelText("Tube clearance") as HTMLInputElement;
        await user.click(clearanceInput);
        await user.type(clearanceInput, "5");
        await user.tab();

        const minTubesInput = screen.getByLabelText("Min # of tubes") as HTMLInputElement;
        await user.click(minTubesInput);
        await user.type(minTubesInput, "500");
        await user.tab();
        expect(Number(minTubesInput.value)).toBe(500);
    }

    it("live-previews the paired minTubes value while shellID is still being typed, before commit", async () => {
        const user = userEvent.setup();
        render(<WorkerHarness />);
        await commitMinTubes(user);

        const minTubesInput = screen.getByLabelText("Min # of tubes") as HTMLInputElement;
        const shellIDInput = screen.getByLabelText("Shell ID") as HTMLInputElement;

        // Now start typing into shellID (still uncommitted).
        await user.click(shellIDInput);
        await user.type(shellIDInput, "40");

        // Wait past the 350ms debounce for the worker's mocked response.
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 400));
        });

        // minTubes should now live-preview the worker's computed value (777),
        // not keep showing the stale committed 500.
        expect(Number(minTubesInput.value)).toBe(777);
        expect(minTubesInput).toHaveClass("field-preview");
    });

    it("Escape cancels an in-progress edit and restores the prior live preview", async () => {
        const user = userEvent.setup();
        render(<WorkerHarness />);
        await commitMinTubes(user);

        const minTubesInput = screen.getByLabelText("Min # of tubes") as HTMLInputElement;
        const shellIDInput = screen.getByLabelText("Shell ID") as HTMLInputElement;

        // Pre-edit: minTubes is its own committed, non-muted value.
        expect(minTubesInput).toHaveClass("field-valid");
        expect(minTubesInput).not.toHaveClass("field-preview");

        // Start typing into shellID, then back out before committing.
        await user.click(shellIDInput);
        await user.type(shellIDInput, "40");
        expect(shellIDInput.value).toBe("40");
        await user.keyboard("{Escape}");

        // The Escape revert remounts the input (typing is uncontrolled, so a
        // fresh mount is what forces the DOM text to reset) -- re-query it.
        const revertedShellIDInput = screen.getByLabelText("Shell ID") as HTMLInputElement;

        // Nothing from the cancelled edit was committed, and focus is released.
        expect(revertedShellIDInput.value).not.toBe("40");
        expect(revertedShellIDInput).not.toHaveClass("field-valid");
        expect(document.activeElement).not.toBe(revertedShellIDInput);

        // minTubes goes back to its own committed, non-muted display -- the
        // in-progress "shellID is driving" flip is undone.
        expect(Number(minTubesInput.value)).toBe(500);
        expect(minTubesInput).not.toHaveClass("field-preview");
        expect(minTubesInput).toHaveClass("field-valid");

        // The cancelled edit's debounced request doesn't resurrect itself.
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 400));
        });
        expect(Number(minTubesInput.value)).toBe(500);

        // A real commit still works normally afterwards.
        await user.click(revertedShellIDInput);
        await user.type(revertedShellIDInput, "45");
        await user.tab();
        expect(Number(revertedShellIDInput.value)).toBe(45);
        expect(revertedShellIDInput).toHaveClass("field-valid");
    });

    it("pins the dependent field retroactively when Tab-focus arrives before its preview resolves", async () => {
        // Regression test for the Tab-focus race: committing minTubes via Tab
        // moves focus straight to shellID, before its debounced preview has
        // resolved. Pinning must retry once the preview arrives, or the first
        // keystroke gets wiped when previewTargetId flips away from shellID.
        const user = userEvent.setup();
        render(<WorkerHarness />);
        await commitMinTubes(user);

        expect(document.activeElement?.id).toBe("shellID"); // Tab landed here

        // Let the debounced worker preview resolve while shellID stays focused.
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 400));
        });
        const shellIDInput = screen.getByLabelText("Shell ID") as HTMLInputElement;
        expect(Number(shellIDInput.value)).toBe(88);

        // Type directly on top of the now-settled preview.
        await user.keyboard("4");
        expect(shellIDInput.value).not.toBe(""); // the keystroke must land, not vanish
    });
});

describe("PairedFieldRow shell ID minimum", () => {
    it("falls back to the generic '> 0' minimum when tubeOD/OTLtoShell aren't known yet", async () => {
        const user = userEvent.setup();
        render(<Harness />);

        const shellIDInput = screen.getByLabelText("Shell ID") as HTMLInputElement;
        const elsewhere = screen.getByRole("button", { name: "elsewhere" });

        await user.click(shellIDInput);
        await user.type(shellIDInput, "0");
        await user.click(elsewhere);

        expect(screen.getByText("Must be greater than 0")).toBeInTheDocument();
    });

    it("uses tubeOD + OTLtoShell as the shell ID minimum once both are known", async () => {
        const user = userEvent.setup();
        render(<Harness />);

        await setTubeOD(user, "25");

        const OTLInput = screen.getByLabelText(/^OTL to shell/) as HTMLInputElement;
        await user.click(OTLInput);
        await user.type(OTLInput, "5");
        await user.tab();

        const shellIDInput = screen.getByLabelText("Shell ID") as HTMLInputElement;
        const elsewhere = screen.getByRole("button", { name: "elsewhere" });

        // Below tubeOD (25) + OTLtoShell (5) = 30, so it should be flagged.
        await user.click(shellIDInput);
        await user.type(shellIDInput, "20");
        await user.click(elsewhere);

        expect(screen.getByText("Must be at least 30")).toBeInTheDocument();

        // Exactly at the minimum is allowed (inclusive).
        await user.click(shellIDInput);
        await user.clear(shellIDInput);
        await user.type(shellIDInput, "30");
        await user.click(elsewhere);

        expect(screen.queryByText("Must be at least 30")).not.toBeInTheDocument();
        expect(shellIDInput).toHaveClass("field-valid");
    });
});
