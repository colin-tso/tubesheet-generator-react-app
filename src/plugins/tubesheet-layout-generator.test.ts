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

    it("returns null tubeField/minID and zero numTubes without throwing when neither minTubes nor shellID is given", () => {
        // Backported from the legacy standalone-module jest suite. Neither
        // sizing input is provided, so there's nothing to derive a shell size
        // from.
        const ts = new TubeSheet(OTL_CLEARANCE, TUBE_OD, PITCH_RATIO, 30);

        expect(ts.tubeField).toBeNull();
        expect(ts.minID).toBeNull();
        expect(ts.OTL).toBeNull();
        expect(ts.numTubes).toBe(0);
    });
});

describe("TubeSheet — regression: findMinID hang on sparse tube fields", () => {
    // Guards against findMinID's upper-bound search hanging when its initial
    // diameter guess yields zero tubes (large tubeOD/pitch relative to the
    // available OTL). Vitest's default per-test timeout also catches a
    // regression here; the assertions confirm the correct output values.
    const OTL_CLEARANCE_SPARSE = 150;
    const TUBE_OD_SPARSE = 90.53;
    const SHELL_ID_SPARSE = 400;

    const expected: Record<string, { numTubes: number; minID: number; OTL: number }> = {
        "30": { numTubes: 2, minID: 353.6925, OTL: 203.6925 },
        "45": { numTubes: 1, minID: 240.53, OTL: 90.53 },
        "60": { numTubes: 2, minID: 353.6925, OTL: 203.6925 },
        "90": { numTubes: 2, minID: 353.6925, OTL: 203.6925 },
        radial: { numTubes: 3, minID: 371.198799674342, OTL: 221.19879967435 },
    };

    it.each(LAYOUTS)("resolves without hanging for layout %s", (layout) => {
        const ts = new TubeSheet(
            OTL_CLEARANCE_SPARSE,
            TUBE_OD_SPARSE,
            PITCH_RATIO,
            layout,
            undefined,
            SHELL_ID_SPARSE,
        );
        const ref = expected[String(layout)];

        expect(ts.numTubes).toBe(ref.numTubes);
        expect(ts.minID).toBeCloseTo(ref.minID, 6);
        expect(ts.OTL).toBeCloseTo(ref.OTL, 6);
    });
});

describe("TubeSheet — exact tube field regression (backported from legacy jest suite)", () => {
    // These check every tube's exact (x, y), which would also catch a change
    // that preserves count and symmetry but subtly shuffles where individual
    // tubes land.

    const closeTo = (actual: number, expected: number, precision = 6) =>
        expect(Math.abs(actual - expected)).toBeLessThan(Math.pow(10, -precision) / 2);

    const OTL_CLEARANCE_LEGACY = 40;
    const TUBE_OD_LEGACY = 95.3;
    const PITCH_RATIO_LEGACY = (95.3 + 20) / 95.3;

    it("matches the exact tube field for a 30-degree layout", () => {
        const ts = new TubeSheet(OTL_CLEARANCE_LEGACY, TUBE_OD_LEGACY, PITCH_RATIO_LEGACY, 30, 12);
        const expected = [
            { x: 0, y: -199.70545811269156 },
            { x: -172.95, y: -99.85272905634578 },
            { x: -57.65, y: -99.85272905634578 },
            { x: 57.65, y: -99.85272905634578 },
            { x: 172.95, y: -99.85272905634578 },
            { x: -115.3, y: 0 },
            { x: 0, y: 0 },
            { x: 115.3, y: 0 },
            { x: -172.95, y: 99.85272905634578 },
            { x: -57.65, y: 99.85272905634578 },
            { x: 57.65, y: 99.85272905634578 },
            { x: 172.95, y: 99.85272905634578 },
            { x: 0, y: 199.70545811269156 },
        ];

        expect(ts.numTubes).toBe(13);
        expect(ts.tubeField).toHaveLength(expected.length);
        ts.tubeField!.forEach((p, i) => {
            closeTo(p.x, expected[i].x);
            closeTo(p.y, expected[i].y);
        });
        closeTo(ts.minID!, 534.71091622539);
    });

    it("matches the exact tube field for a 60-degree layout", () => {
        const ts = new TubeSheet(OTL_CLEARANCE_LEGACY, TUBE_OD_LEGACY, PITCH_RATIO_LEGACY, 60, 5);
        const expected = [
            { x: 0, y: -115.3 },
            { x: -99.85272905634578, y: -57.65 },
            { x: 99.85272905634578, y: -57.65 },
            { x: 0, y: 0 },
            { x: -99.85272905634578, y: 57.65 },
            { x: 99.85272905634578, y: 57.65 },
            { x: 0, y: 115.3 },
        ];

        expect(ts.numTubes).toBe(7);
        expect(ts.tubeField).toHaveLength(expected.length);
        ts.tubeField!.forEach((p, i) => {
            closeTo(p.x, expected[i].x);
            closeTo(p.y, expected[i].y);
        });
        closeTo(ts.minID!, 365.90000000001);
    });

    it("matches the exact tube field for a 45-degree layout", () => {
        const ts = new TubeSheet(OTL_CLEARANCE_LEGACY, TUBE_OD_LEGACY, PITCH_RATIO_LEGACY, 45, 10);
        const expected = [
            { x: -81.52941187080894, y: -163.05882374161789 },
            { x: 81.52941187080894, y: -163.05882374161789 },
            { x: -163.0588237416179, y: -81.52941187080894 },
            { x: 0, y: -81.52941187080894 },
            { x: 163.0588237416179, y: -81.52941187080894 },
            { x: -81.52941187080894, y: 0 },
            { x: 81.52941187080894, y: 0 },
            { x: -163.0588237416179, y: 81.52941187080894 },
            { x: 0, y: 81.52941187080894 },
            { x: 163.0588237416179, y: 81.52941187080894 },
            { x: -81.52941187080894, y: 163.05882374161789 },
            { x: 81.52941187080894, y: 163.05882374161789 },
        ];

        expect(ts.numTubes).toBe(12);
        expect(ts.tubeField).toHaveLength(expected.length);
        ts.tubeField!.forEach((p, i) => {
            closeTo(p.x, expected[i].x);
            closeTo(p.y, expected[i].y);
        });
        closeTo(ts.minID!, 499.91061421742);
    });

    it("matches the exact tube field for a radial layout", () => {
        const ts = new TubeSheet(
            OTL_CLEARANCE_LEGACY,
            TUBE_OD_LEGACY,
            PITCH_RATIO_LEGACY,
            "radial",
            15,
        );
        const expected = [
            { x: 0, y: 277.2811849744992 },
            { x: 112.78041836460781, y: 253.30896702321152 },
            { x: 206.06007781603927, y: 185.53732743388937 },
            { x: 263.71007781603925, y: 85.68459837754357 },
            { x: 275.7622096307997, y: -28.983776158418344 },
            { x: 240.13255017936828, y: -138.64059248724953 },
            { x: 162.98179126619192, y: -224.32519086479317 },
            { x: 57.650000000000105, y: -271.2219258114329 },
            { x: -57.64999999999995, y: -271.2219258114329 },
            { x: -162.9817912661919, y: -224.32519086479317 },
            { x: -240.13255017936822, y: -138.64059248724968 },
            { x: -275.7622096307997, y: -28.98377615841856 },
            { x: -263.7100778160393, y: 85.68459837754354 },
            { x: -206.06007781603932, y: 185.5373274338893 },
            { x: -112.78041836460801, y: 253.30896702321144 },
        ];

        expect(ts.numTubes).toBe(15);
        expect(ts.tubeField).toHaveLength(expected.length);
        ts.tubeField!.forEach((p, i) => {
            closeTo(p.x, expected[i].x);
            closeTo(p.y, expected[i].y);
        });
        closeTo(ts.minID!, 689.8623699489983);
    });
});

describe("TubeSheet — minTubes/shellID getters when unset", () => {
    it("returns undefined for shellID when constructed via minTubes", () => {
        const ts = new TubeSheet(OTL_CLEARANCE, TUBE_OD, PITCH_RATIO, 30, 50);
        expect(ts.shellID).toBeUndefined();
        expect(ts.minTubes).toBe(50);
    });

    it("returns undefined for minTubes when constructed via shellID", () => {
        const ts = new TubeSheet(OTL_CLEARANCE, TUBE_OD, PITCH_RATIO, 30, undefined, 500);
        expect(ts.minTubes).toBeUndefined();
        expect(ts.shellID).toBe(500);
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
                shellID: undefined,
                minID: 300,
            }),
        ).toBe(300);
    });

    it("returns 0 when both tubeField and OTL are null", () => {
        expect(
            getEffectiveShellID({
                tubeField: null,
                OTL: null,
                shellID: undefined,
                minID: null,
            }),
        ).toBe(0);
    });

    it("returns 0, not undefined, when neither shellID nor minID is usable", () => {
        expect(
            getEffectiveShellID({
                tubeField: [{ x: 0, y: 0 }],
                OTL: 10,
                shellID: undefined,
                minID: null,
            }),
        ).toBe(0);
    });
});
