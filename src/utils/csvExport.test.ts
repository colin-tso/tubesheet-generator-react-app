import { describe, it, expect } from "vitest";
import { buildTubeCoordinatesCsv, buildTubeCoordinatesCsvBlob } from "./csvExport";
import { TubeSheet } from "@/plugins/tubesheet-layout-generator";

describe("buildTubeCoordinatesCsv", () => {
    it("returns null when there is no tube field", () => {
        expect(buildTubeCoordinatesCsv(null)).toBeNull();
        expect(buildTubeCoordinatesCsv({ tubeField: null, tubeOD: 19.05 })).toBeNull();
        expect(buildTubeCoordinatesCsv({ tubeField: [], tubeOD: 19.05 })).toBeNull();
        expect(buildTubeCoordinatesCsvBlob(null)).toBeNull();
    });

    it("writes a header and one CRLF-terminated row per tube, Y-up, 3 decimals", () => {
        const csv = buildTubeCoordinatesCsv({
            tubeField: [
                { x: 0, y: 0 },
                { x: 3, y: 4 },
                { x: -19.05, y: -0.0004 },
            ],
            tubeOD: 19.05,
        });
        expect(csv).toBe(
            [
                "Tube_Index,X_mm,Y_mm,Radius_mm,Diameter_mm",
                "1,0.000,0.000,0.000,19.050",
                "2,3.000,-4.000,5.000,19.050",
                "3,-19.050,0.000,19.050,19.050",
                "",
            ].join("\r\n"),
        );
    });

    it("never emits negative zero", () => {
        const csv = buildTubeCoordinatesCsv({
            tubeField: [{ x: -0, y: 0 }],
            tubeOD: 10,
        })!;
        expect(csv).not.toContain("-0.000");
    });

    it("lists every tube of a real layout, matching its numbering", () => {
        const ts = new TubeSheet(10, 19.05, 1.25, 30, 50);
        const field = ts.tubeField!;
        const lines = buildTubeCoordinatesCsv(ts)!.trimEnd().split("\r\n");
        expect(lines).toHaveLength(field.length + 1);
        const last = lines[lines.length - 1].split(",");
        expect(last[0]).toBe(String(field.length));
        expect(Number(last[1])).toBeCloseTo(field[field.length - 1].x, 3);
        expect(Number(last[2])).toBeCloseTo(-field[field.length - 1].y, 3);
    });

    it("blob is text/csv", () => {
        const blob = buildTubeCoordinatesCsvBlob({
            tubeField: [{ x: 1, y: 1 }],
            tubeOD: 5,
        })!;
        expect(blob.type).toContain("text/csv");
    });
});
