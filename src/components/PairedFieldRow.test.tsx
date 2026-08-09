import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { PairedFieldRow } from "./PairedFieldRow";
import { NumericField } from "./NumericField";
import { useLayoutForm } from "../hooks/useLayoutForm";
import { numericFieldConfigs } from "../constants/numericFieldConfigs";

// Exercises the tubeClearance/pitchRatio pair (synchronous preview) end to end
// through the real useLayoutForm reducer, since it needs no worker mock.
const clearancePitchRow = numericFieldConfigs.filter((cfg) => cfg.row === "clearance-pitch");
const sizeRow = numericFieldConfigs.filter((cfg) => cfg.row === "minTubes-shellID");
const tubeODConfig = numericFieldConfigs.find((cfg) => cfg.id === "tubeOD")!;
const OTLtoShellConfig = numericFieldConfigs.find((cfg) => cfg.id === "OTLtoShell")!;
// Stable reference (as the real useTubeSheetWorker's requestSingle is) so it
// doesn't itself cause the paired fields to lose memoization across renders.
const stubRequestSingle = () => 0;

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

        const otlInput = screen.getByLabelText(/^OTL to shell/) as HTMLInputElement;
        await user.click(otlInput);
        await user.type(otlInput, "5");
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
