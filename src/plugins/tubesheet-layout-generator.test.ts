import { describe, it, expect, vi } from "vitest";
import { TubeSheet, getEffectiveShellID, type TubeSheetLayout } from "./tubesheet-layout-generator";

// Fixed set of realistic inputs reused across cases.
const OTL_CLEARANCE = 6.35;
const TUBE_OD = 19.05;
const PITCH_RATIO = 1.25;

const LAYOUTS: TubeSheetLayout[] = [30, 45, 60, 90, "radial"];

describe("TubeSheet — construction by minTubes", () => {
    // Reference values captured from the current implementation for a fixed set
    // of inputs. If these ever change, it should be because the layout
    // algorithm intentionally changed, not by accident.
    const expected: Record<string, { numTubes: number; minID: number; OTL: number }> = {
        "30": { numTubes: 55, minID: 197.1143795, OTL: 190.76437949512 },
        "45": { numTubes: 52, minID: 206.75059709, OTL: 200.40059708965 },
        "60": { numTubes: 55, minID: 197.1143795, OTL: 190.76437949512 },
        "90": { numTubes: 56, minID: 217.38251264, OTL: 211.03251263136 },
        radial: { numTubes: 50, minID: 404.6371870546999, OTL: 398.2871870547 },
    };

    it.each(LAYOUTS)("meets or exceeds minTubes=50 for layout %s", (layout) => {
        const ts = new TubeSheet(OTL_CLEARANCE, TUBE_OD, PITCH_RATIO, layout, 50);
        const ref = expected[String(layout)];

        expect(ts.numTubes).toBe(ref.numTubes);
        expect(ts.numTubes).toBeGreaterThanOrEqual(50);
        expect(ts.minID).toBeCloseTo(ref.minID, 6);
        expect(ts.OTL).toBeCloseTo(ref.OTL, 6);
        // tubeField length must always agree with numTubes.
        expect(ts.tubeField).not.toBeNull();
        expect(ts.tubeField!.length).toBe(ts.numTubes);
    });
});

describe("TubeSheet — construction by shellID", () => {
    const expected: Record<string, { numTubes: number; minID: number; OTL: number }> = {
        "30": { numTubes: 361, minID: 494.45185281, OTL: 488.10185280923 },
        "45": { numTubes: 316, minID: 498.06462907, OTL: 491.71462906225 },
        "60": { numTubes: 361, minID: 494.45185281, OTL: 488.10185280923 },
        "90": { numTubes: 312, minID: 499.86070126, OTL: 493.51070125065 },
        radial: { numTubes: 62, minID: 495.54591840250254, OTL: 489.19591840251 },
    };

    it.each(LAYOUTS)("fills shellID=500 with the maximum tubes for layout %s", (layout) => {
        const ts = new TubeSheet(OTL_CLEARANCE, TUBE_OD, PITCH_RATIO, layout, undefined, 500);
        const ref = expected[String(layout)];

        expect(ts.shellID).toBe(500);
        expect(ts.numTubes).toBe(ref.numTubes);
        expect(ts.minID).toBeCloseTo(ref.minID, 6);
        expect(ts.OTL).toBeCloseTo(ref.OTL, 6);
        expect(ts.tubeField!.length).toBe(ts.numTubes);
    });
});

describe("TubeSheet — tube field symmetry", () => {
    it("is symmetric about both the X and Y axes for a non-radial layout", () => {
        const ts = new TubeSheet(OTL_CLEARANCE, TUBE_OD, PITCH_RATIO, 30, 100);
        const field = ts.tubeField!;
        const EPS = 1e-6;

        const hasMirror = (x: number, y: number) =>
            field.some((p) => Math.abs(p.x - x) < EPS && Math.abs(p.y - y) < EPS);

        for (const { x, y } of field) {
            // Mirrored about the Y axis (x -> -x).
            expect(hasMirror(-x, y)).toBe(true);
            // Mirrored about the X axis (y -> -y).
            expect(hasMirror(x, -y)).toBe(true);
        }
    });
});

describe("TubeSheet — edge cases", () => {
    it("returns zero tubes without throwing when the shell is too small for the tube OD", () => {
        // shellID (15) - OTLClearance (6.35) = 8.65, which is less than tubeOD
        // (19.05), so no tube can physically fit.
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const ts = new TubeSheet(OTL_CLEARANCE, TUBE_OD, PITCH_RATIO, 30, undefined, 15);

        expect(ts.numTubes).toBe(0);
        expect(ts.tubeField).toBeNull();
        expect(ts.OTL).toBeNull();
        errorSpy.mockRestore();
    });

    it("throws for an invalid pitch ratio below 1 when shellID is specified", () => {
        // Documents current behavior: unlike the shellID-too-small case above,
        // an out-of-range pitchRatio is not caught internally when shellID is
        // explicitly provided, and propagates as a thrown error.
        expect(() => new TubeSheet(OTL_CLEARANCE, TUBE_OD, 0.5, 30, undefined, 500)).toThrow(
            /pitch ratio/i,
        );
    });
});

describe("getEffectiveShellID", () => {
    it("returns shellID when shellID is explicitly set", () => {
        expect(
            getEffectiveShellID({
                tubeField: [{ x: 0, y: 0 }],
                OTL: 10,
                shellID: 500,
                minID: null,
            }),
        ).toBe(500);
    });

    it("falls back to minID when shellID is not set", () => {
        expect(
            getEffectiveShellID({
                tubeField: [{ x: 0, y: 0 }],
                OTL: 10,
                shellID: undefined as unknown as number,
                minID: 300,
            }),
        ).toBe(300);
    });

    it("returns 0 when both tubeField and OTL are null", () => {
        expect(
            getEffectiveShellID({
                tubeField: null,
                OTL: null,
                shellID: undefined as unknown as number,
                minID: null,
            }),
        ).toBe(0);
    });
});
