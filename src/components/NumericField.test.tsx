import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { NumericField } from "./NumericField";
import { useLayoutForm } from "@/hooks/useLayoutForm";
import { numericFieldConfigs } from "@/constants/numericFieldConfigs";

// tubeOD is a plain, non-paired field -- no live-preview/pin machinery, just
// the generic NumericField + useLayoutForm wiring used throughout App.tsx.
const tubeODConfig = numericFieldConfigs.find((cfg) => cfg.id === "tubeOD")!;

function Harness() {
    const form = useLayoutForm({
        lastSingleResult: null,
        postCalculateSingle: () => {},
        postCalculateAll: () => {},
    });

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
            <button type="button">elsewhere</button>
        </>
    );
}

describe("NumericField Escape-to-cancel", () => {
    it("discards an in-progress edit on a fresh field instead of committing it", async () => {
        const user = userEvent.setup();
        render(<Harness />);

        const input = screen.getByLabelText(/^Tube OD/) as HTMLInputElement;
        await user.click(input);
        await user.type(input, "25");
        expect(input.value).toBe("25");

        await user.keyboard("{Escape}");

        // Escape remounts the field (typing is uncontrolled), so re-query it.
        const reverted = screen.getByLabelText(/^Tube OD/) as HTMLInputElement;
        expect(reverted.value).toBe(""); // back to empty, nothing committed
        expect(reverted).not.toHaveClass("field-valid");
        expect(document.activeElement).not.toBe(reverted);
    });

    it("reverts to the last committed value, not an empty/typed one", async () => {
        const user = userEvent.setup();
        render(<Harness />);

        const input = screen.getByLabelText(/^Tube OD/) as HTMLInputElement;
        await user.click(input);
        await user.type(input, "25");
        await user.tab(); // commit tubeOD = 25

        const committed = screen.getByLabelText(/^Tube OD/) as HTMLInputElement;
        expect(committed.value).toBe("25");
        expect(committed).toHaveClass("field-valid");

        // Edit it further, then back out.
        await user.click(committed);
        await user.type(committed, "9");
        await user.keyboard("{Escape}");

        const reverted = screen.getByLabelText(/^Tube OD/) as HTMLInputElement;
        expect(reverted.value).toBe("25"); // the override never committed
        expect(reverted).toHaveClass("field-valid");
        expect(document.activeElement).not.toBe(reverted);
    });

    it("lets a real commit go through normally after a prior Escape", async () => {
        const user = userEvent.setup();
        render(<Harness />);

        const input = screen.getByLabelText(/^Tube OD/) as HTMLInputElement;
        await user.click(input);
        await user.type(input, "25");
        await user.keyboard("{Escape}");

        const reverted = screen.getByLabelText(/^Tube OD/) as HTMLInputElement;
        await user.click(reverted);
        await user.type(reverted, "30");
        await user.tab();

        const committed = screen.getByLabelText(/^Tube OD/) as HTMLInputElement;
        expect(committed.value).toBe("30");
        expect(committed).toHaveClass("field-valid");
    });
});
