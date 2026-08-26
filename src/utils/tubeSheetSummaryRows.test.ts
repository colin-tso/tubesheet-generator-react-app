import { describe, expect, it } from "vitest";
import { buildTubeSheetSummaryRows, formatSummaryNumber } from "./tubeSheetSummaryRows";
import type { ITubeSheetData } from "@/plugins/tubesheet-layout-generator";

describe("formatSummaryNumber", () => {
    it("formats decimal values with commas and units", () => {
        expect(formatSummaryNumber(461.24, 2, "mm")).toBe("461.24 mm");
    });

    it("formats whole numbers without decimals or units", () => {
        expect(formatSummaryNumber(10, 0)).toBe("10");
    });

    it("returns an em dash for missing values", () => {
        expect(formatSummaryNumber(undefined, 2, "mm")).toBe("—");
        expect(formatSummaryNumber(null, 0)).toBe("—");
    });
});

describe("buildTubeSheetSummaryRows", () => {
    const baseData: ITubeSheetData & { numTubes?: number } = {
        tubeField: [],
        OTL: 441.24,
        shellID: 461.24,
        minID: null,
        tubeOD: 95.3,
        pitchRatio: 1.21,
        layout: "radial" as ITubeSheetData["layout"],
        numTubes: 11,
    };

    it("returns an empty array when there is no data", () => {
        expect(buildTubeSheetSummaryRows(null, "Radial", 10)).toEqual([]);
    });

    it("matches the reference datasheet's row values", () => {
        const rows = buildTubeSheetSummaryRows(baseData, "Radial", 10);

        expect(rows).toEqual([
            { label: "Shell ID", value: "461.24 mm" },
            { label: "OTL", value: "441.24 mm" },
            { label: "Tube OD", value: "95.30 mm" },
            { label: "Tube Pitch", value: "115.31 mm" },
            { label: "Pitch Ratio", value: "1.21" },
            { label: "Tube Layout", value: "Radial" },
            { label: "Tube Positions Available", value: "11" },
            { label: "Tubes", value: "10" },
        ]);
    });

    it("falls back to positions-available when requestedTubes is not provided", () => {
        const rows = buildTubeSheetSummaryRows(baseData, "Radial", undefined);
        expect(rows.find((r) => r.label === "Tubes")?.value).toBe("11");
    });
});
