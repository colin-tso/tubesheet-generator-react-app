import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { LayoutOptionsList } from "./LayoutOptionsList";
import { layoutOptionRows } from "../constants/layoutOptionRows";
import type { LayoutResults } from "../hooks/useTubeSheetWorker";

// Radial can produce a NaN minID (no tubes fit at the target shell/tube count,
// so Math.sin(Math.PI / 0) is NaN). This must render as a dash, not the literal
// text "NaN".
const layoutResultsWithNaNRadialMinID: LayoutResults = {
    30: null,
    45: null,
    60: null,
    90: null,
    radial: {
        tubeField: [],
        OTL: null,
        shellID: 40,
        minID: NaN,
        tubeOD: 19.05,
        pitchRatio: 1.25,
        layout: "radial",
        numTubes: 0,
        preferred: false,
    },
};

describe("LayoutOptionsList — NaN minID display", () => {
    it("renders a dash instead of 'NaN' for the radial row's minID", () => {
        render(
            <LayoutOptionsList
                rows={layoutOptionRows}
                layoutResults={layoutResultsWithNaNRadialMinID}
                showLoadingBadge={false}
                onLayoutOptionChange={() => {}}
            />,
        );

        const radialRow = screen.getByLabelText("Radial", { exact: false }).closest("label")!;
        expect(radialRow).toHaveTextContent("—");
        expect(radialRow).not.toHaveTextContent("NaN");
    });
});
