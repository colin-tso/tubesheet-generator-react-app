import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScaleBar } from "./ScaleBar";

describe("ScaleBar", () => {
    it("picks a round length at least 70 px wide", () => {
        render(<ScaleBar pxPerMm={1.4} />);
        // 70 / 1.4 = 50 mm
        expect(screen.getByRole("img", { name: "Scale bar, 50 mm" })).toBeTruthy();
        expect(screen.getByText("50 mm")).toBeTruthy();
    });

    it("rounds up to the next 1/2/5 step", () => {
        render(<ScaleBar pxPerMm={1} />);
        expect(screen.getByText("100 mm")).toBeTruthy();
    });
});
