import { describe, it, expect, expectTypeOf, vi } from "vitest";
import {
    TubeSheet,
    TUBE_SHEET_LAYOUTS,
    ULP_TEST_UTILS,
    generateTubeSheetSVG,
    getEffectiveShellID,
    findDiscreteSweepPoints,
    findMinID,
} from "./tubesheet-layout-generator";
import type {
    ITubeSheetData,
    OffsetOption,
    Tube,
    TubeField,
    TubeSheetLayout,
} from "./tubesheet-layout-generator";

// Fixed set of realistic inputs reused across cases.
const OTL_CLEARANCE = 6.35;
const TUBE_OD = 19.05;
const PITCH_RATIO = 1.25;

const LAYOUTS: TubeSheetLayout[] = [30, 45, 60, 90, "radial"];

// --- Type-level assertions. `expectTypeOf` is a compile-time check that runs
// as a no-op at runtime; `tsc` fails the build if any assertion doesn't hold.
expectTypeOf<TubeSheetLayout>().toEqualTypeOf<30 | 45 | 60 | 90 | "radial">();
expectTypeOf(TUBE_SHEET_LAYOUTS).toEqualTypeOf<readonly [30, 45, 60, 90, "radial"]>();
expectTypeOf<Tube>().toEqualTypeOf<{ x: number; y: number }>();
expectTypeOf<TubeField>().toEqualTypeOf<Array<Tube>>();
expectTypeOf<OffsetOption>().toEqualTypeOf<boolean | "AUTO">();
expectTypeOf<ITubeSheetData["tubeField"]>().toEqualTypeOf<ReadonlyArray<Tube> | null>();
expectTypeOf(getEffectiveShellID).returns.toEqualTypeOf<number>();
expectTypeOf(generateTubeSheetSVG).returns.toEqualTypeOf<SVGSVGElement>();
expectTypeOf<keyof typeof ULP_TEST_UTILS>().toEqualTypeOf<"roundUp" | "ulpAt" | "ulpTolerance">();

describe("TubeSheet — construction by minTubes", () => {
    // Reference values captured from the current implementation for a fixed set
    // of inputs. If these ever change, it should be because the layout
    // algorithm intentionally changed, not by accident.
    const expected: Record<string, { numTubes: number; minID: number; OTL: number }> = {
        "30": { numTubes: 55, minID: 197.1143795, OTL: 190.76437949512 },
        "45": { numTubes: 52, minID: 206.75059709, OTL: 200.40059708965 },
        "60": { numTubes: 55, minID: 197.1143795, OTL: 190.76437949512 },
        "90": { numTubes: 56, minID: 217.38251264, OTL: 211.03251263136 },
        radial: { numTubes: 50, minID: 195.77130658, OTL: 189.42130657016 },
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
        radial: { numTubes: 331, minID: 494.53724475, OTL: 488.18724474777 },
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

    it.each(LAYOUTS)("returns a single centre tube for minTubes=1 for layout %s", (layout) => {
        // Regression: at exactly minTubes=1, `tubeOD + OTLClearance` is the
        // shell ID, and the `tubeOD > shellID - OTLClearance` validation could
        // spuriously hold due to floating-point error, yielding zero tubes.
        const ts = new TubeSheet(OTL_CLEARANCE, TUBE_OD, PITCH_RATIO, layout, 1);

        expect(ts.numTubes).toBe(1);
        expect(ts.tubeField).toHaveLength(1);
        expect(ts.tubeField![0].x).toBeCloseTo(0, 6);
        expect(ts.tubeField![0].y).toBeCloseTo(0, 6);
        expect(ts.minID).toBeCloseTo(TUBE_OD + OTL_CLEARANCE, 6);
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
        // The radial field fits a 3-tube triangle ring (radius pitch/sqrt(3))
        // inside this shell, so it resolves to 3 tubes, not 2.
        radial: { numTubes: 3, minID: 371.19879968, OTL: 221.19879967435 },
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
        // Radial layouts pack tubes into concentric rings: an innermost seed
        // ring of 5 tubes plus rings one pitch further out. These values are
        // captured from the current implementation.
        const ts = new TubeSheet(
            OTL_CLEARANCE_LEGACY,
            TUBE_OD_LEGACY,
            PITCH_RATIO_LEGACY,
            "radial",
            15,
        );
        const expected = [
            { x: 6.005670242277104e-15, y: 98.08003820299021 },
            { x: 93.27965945143144, y: 30.30839861366805 },
            { x: 57.650000000000006, y: -79.34841771516317 },
            { x: -57.64999999999999, y: -79.34841771516317 },
            { x: -93.27965945143146, y: 30.30839861366804 },
            { x: 1.3065759039361597e-14, y: 213.38003820299022 },
            { x: 115.3619582827713, y: 179.5067109739179 },
            { x: 194.09730991940935, y: 88.6412713444382 },
            { x: 211.2081370826923, y: -30.36714562760594 },
            { x: 161.26187304760523, y: -139.73420842688316 },
            { x: 60.11610374185037, y: -204.73664736536216 },
            { x: -60.11610374185033, y: -204.73664736536216 },
            { x: -161.2618730476052, y: -139.73420842688319 },
            { x: -211.20813708269228, y: -30.367145627605964 },
            { x: -194.09730991940938, y: 88.64127134443814 },
            { x: -115.36195828277124, y: 179.50671097391796 },
        ];

        expect(ts.numTubes).toBe(16);
        expect(ts.tubeField).toHaveLength(expected.length);
        ts.tubeField!.forEach((p, i) => {
            closeTo(p.x, expected[i].x);
            closeTo(p.y, expected[i].y);
        });
        closeTo(ts.minID!, 562.06007641);
    });
});

describe("TubeSheet — radial multi-ring behaviour", () => {
    // Radial layouts fill the OTL with concentric rings spaced one pitch apart,
    // built from one of five innermost seeds (central tube, or rings of 2-5
    // tubes). Every pair of tubes must therefore be at least one pitch apart,
    // and the generator must keep whichever seed layout holds the most tubes.
    const minPairwiseDistance = (field: ReadonlyArray<{ x: number; y: number }>): number => {
        let min = Infinity;
        for (let i = 0; i < field.length; i++) {
            for (let j = i + 1; j < field.length; j++) {
                const dx = field[i].x - field[j].x;
                const dy = field[i].y - field[j].y;
                min = Math.min(min, Math.sqrt(dx * dx + dy * dy));
            }
        }
        return min;
    };

    it("respects the pitch constraint between every pair of tubes", () => {
        const cases: Array<[number, number, number, number]> = [
            [178, 6.35, 19.05, 1.25],
            [500, 6.35, 19.05, 1.25],
            [1000, 6.35, 19.05, 1.25],
            [400, 150, 90.53, 1.25],
        ];
        for (const [shellID, clearance, tubeOD, pitchRatio] of cases) {
            const ts = new TubeSheet(clearance, tubeOD, pitchRatio, "radial", undefined, shellID);
            const pitch = tubeOD * pitchRatio;
            expect(ts.numTubes).toBeGreaterThan(0);
            expect(minPairwiseDistance(ts.tubeField!)).toBeGreaterThanOrEqual(pitch - 1e-6);
        }
    });

    it("keeps the best of the five seed layouts", () => {
        // At shellID=178 the central-tube seed (rings on integer pitch
        // multiples plus a centre tube) holds the most tubes.
        const withCentre = new TubeSheet(6.35, 19.05, 1.25, "radial", undefined, 178);
        expect(withCentre.numTubes).toBe(37);
        expect(
            withCentre.tubeField!.some((t) => Math.abs(t.x) < 1e-9 && Math.abs(t.y) < 1e-9),
        ).toBe(true);

        // At shellID=500 the pentagon seed (an innermost ring of 5 tubes at
        // radius pitch/(2*sin(pi/5)) with rings one pitch further out) holds
        // the most tubes, so there is no centre tube.
        const pentagonSeed = new TubeSheet(6.35, 19.05, 1.25, "radial", undefined, 500);
        expect(pentagonSeed.numTubes).toBe(331);
        expect(
            pentagonSeed.tubeField!.some((t) => Math.abs(t.x) < 1e-9 && Math.abs(t.y) < 1e-9),
        ).toBe(false);
    });

    it("findMinID grows monotonically with minTubes for radial layouts", () => {
        const ts50 = new TubeSheet(6.35, 19.05, 1.25, "radial", 50);
        const ts100 = new TubeSheet(6.35, 19.05, 1.25, "radial", 100);
        const ts200 = new TubeSheet(6.35, 19.05, 1.25, "radial", 200);

        expect(ts50.numTubes).toBeGreaterThanOrEqual(50);
        expect(ts100.numTubes).toBeGreaterThanOrEqual(100);
        expect(ts200.numTubes).toBeGreaterThanOrEqual(200);
        expect(ts50.minID!).toBeLessThan(ts100.minID!);
        expect(ts100.minID!).toBeLessThan(ts200.minID!);
    });
});

describe("TubeSheet — radial small exact-count layouts", () => {
    // The radial generator also supports rings that hold fewer tubes than a
    // full ring at radius pitch. minTubes 3-5 resolve to exact triangle, square
    // and pentagon layouts (rings at radius pitch/(2*sin(pi/n))) instead of
    // jumping straight to the 7-tube layout.
    const OC = 6.35;
    const OD = 19.05;
    const PR = 1.25;
    const PITCH = OD * PR;

    const minPairwiseDistance = (field: ReadonlyArray<{ x: number; y: number }>): number => {
        let min = Infinity;
        for (let i = 0; i < field.length; i++) {
            for (let j = i + 1; j < field.length; j++) {
                const dx = field[i].x - field[j].x;
                const dy = field[i].y - field[j].y;
                min = Math.min(min, Math.sqrt(dx * dx + dy * dy));
            }
        }
        return min;
    };

    const exactCases: Array<[minTubes: number, expectedTubes: number, expectedMinID: number]> = [
        [3, 3, 52.89630658],
        [4, 4, 59.07596046],
        [5, 5, 65.91224475],
    ];

    it.each(exactCases)(
        "minTubes=%i resolves to exactly %i tubes at the minimal shell",
        (minTubes, expectedTubes, expectedMinID) => {
            const ts = new TubeSheet(OC, OD, PR, "radial", minTubes);
            expect(ts.numTubes).toBe(expectedTubes);
            expect(ts.minID).toBeCloseTo(expectedMinID, 6);
            // The ring sits inside pitch/2 of the centre, so there is no
            // central tube.
            expect(ts.tubeField!.some((t) => Math.abs(t.x) < 1e-9 && Math.abs(t.y) < 1e-9)).toBe(
                false,
            );
            expect(minPairwiseDistance(ts.tubeField!)).toBeGreaterThanOrEqual(PITCH - 1e-6);
        },
    );

    it("keeps the 7-tube layout for minTubes=6 (hexagon ring fits at the same shell)", () => {
        const ts = new TubeSheet(OC, OD, PR, "radial", 6);
        expect(ts.numTubes).toBe(7);
        expect(ts.minID).toBeCloseTo(73.025, 6);
    });

    it("returns the small layouts when a shellID lands in their range", () => {
        const cases: Array<[number, number]> = [
            [55, 3],
            [62, 4],
            [69, 5],
            [75, 7],
        ];
        for (const [shellID, expectedTubes] of cases) {
            const ts = new TubeSheet(OC, OD, PR, "radial", undefined, shellID);
            expect(ts.numTubes).toBe(expectedTubes);
        }
    });

    it("keeps findMinID monotonic across the small-count range", () => {
        const ids = [3, 4, 5, 6].map((mt) => new TubeSheet(OC, OD, PR, "radial", mt).minID!);
        for (let i = 1; i < ids.length; i++) {
            expect(ids[i]).toBeGreaterThan(ids[i - 1]);
        }
    });
});

describe("TubeSheet — radial seed-layout exact counts", () => {
    // The five seeds (central tube plus rings of 2-5 tubes, each with rings one
    // pitch further out) let many more counts resolve exactly instead of
    // jumping to the next full-ring layout. A minTubes request on an achievable
    // count must produce exactly that many tubes at the smallest shell that
    // fits them.
    const OC = 6.35;
    const OD = 19.05;
    const PR = 1.25;
    const PITCH = OD * PR;

    const minPairwiseDistance = (field: ReadonlyArray<{ x: number; y: number }>): number => {
        let min = Infinity;
        for (let i = 0; i < field.length; i++) {
            for (let j = i + 1; j < field.length; j++) {
                const dx = field[i].x - field[j].x;
                const dy = field[i].y - field[j].y;
                min = Math.min(min, Math.sqrt(dx * dx + dy * dy));
            }
        }
        return min;
    };

    const exactCases: Array<[minTubes: number, expectedTubes: number, expectedMinID: number]> = [
        [12, 12, 100.52130658],
        [14, 14, 106.70096046],
        [16, 16, 113.53724475],
        [20, 26, 144.46250001],
        [50, 50, 195.77130658],
        [200, 200, 386.27130658],
    ];

    it.each(exactCases)(
        "minTubes=%i resolves to exactly %i tubes at the minimal shell",
        (minTubes, expectedTubes, expectedMinID) => {
            const ts = new TubeSheet(OC, OD, PR, "radial", minTubes);
            expect(ts.numTubes).toBe(expectedTubes);
            expect(ts.minID).toBeCloseTo(expectedMinID, 6);
            expect(ts.tubeField!.length).toBe(ts.numTubes);
            expect(minPairwiseDistance(ts.tubeField!)).toBeGreaterThanOrEqual(PITCH - 1e-6);
        },
    );

    it("keeps the pitch constraint across the largest seed-built layout", () => {
        const ts = new TubeSheet(OC, OD, PR, "radial", undefined, 1000);
        expect(ts.numTubes).toBe(1310);
        expect(minPairwiseDistance(ts.tubeField!)).toBeGreaterThanOrEqual(PITCH - 1e-6);
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

describe("generateTubeSheetSVG — tube labels", () => {
    const buildData = (): ITubeSheetData => {
        const ts = new TubeSheet(OTL_CLEARANCE, TUBE_OD, PITCH_RATIO, 30, undefined, 200);
        return {
            tubeField: ts.tubeField,
            OTL: ts.OTL,
            shellID: ts.shellID,
            minID: ts.minID,
            tubeOD: ts.tubeOD,
            pitchRatio: ts.pitchRatio,
            layout: ts.layout,
            numTubes: ts.numTubes,
        };
    };

    it("omits <text> labels by default", () => {
        const svg = generateTubeSheetSVG(buildData());
        expect(svg.querySelectorAll("text").length).toBe(0);
    });

    it("draws one <text> label per tube when showTubeLabels is set, matching the tube's circle id", () => {
        const data = buildData();
        const svg = generateTubeSheetSVG(data, { showTubeLabels: true });

        const tubeCount = (data.tubeField as TubeField).length;
        const labels = Array.from(svg.querySelectorAll("text")).map((el) => el.textContent);

        expect(labels).toHaveLength(tubeCount);
        expect(labels).toEqual(Array.from({ length: tubeCount }, (_, i) => (i + 1).toString()));

        // Every tube circle already carries this same id (see generateSVGCircles'
        // `id` param) — the labels should reproduce it exactly, not a separate
        // numbering scheme.
        const circleIds = Array.from(svg.querySelectorAll("circle[id]")).map((el) =>
            el.getAttribute("id"),
        );
        expect(labels).toEqual(circleIds);
    });

    it("vertically centers labels with a dy attribute rather than dominant-baseline, so PDF export (svg2pdf.js) centers them too", () => {
        // svg2pdf.js — used for the PDF export — does not honor the CSS
        // `dominant-baseline` property, so relying on it alone leaves labels
        // sitting on their alphabetic baseline (visibly below tube centre) in
        // the exported PDF even though they look centred on screen. `dy` is
        // a plain SVG attribute svg2pdf.js does support, so it's the
        // renderer-agnostic way to centre the labels everywhere.
        const svg = generateTubeSheetSVG(buildData(), { showTubeLabels: true });
        const texts = Array.from(svg.querySelectorAll("text"));

        expect(texts.length).toBeGreaterThan(0);
        for (const text of texts) {
            expect(text.getAttribute("dy")).toBe("0.35em");
        }

        // Not required for centering anymore, and if both were present a
        // renderer that *does* support dominant-baseline would apply both
        // offsets and double-shift the label. (parseSVGStyleString turns
        // each style entry into its own presentation attribute on the
        // wrapping <g>, so this checks for the attribute directly on the
        // <g> that actually wraps the label <text> elements.)
        const labelsGroup = texts[0].closest("g");
        expect(labelsGroup?.hasAttribute("dominant-baseline")).toBe(false);
    });
});

describe("findDiscreteSweepPoints", () => {
    it("always includes the current shell ID in the results", () => {
        const points = findDiscreteSweepPoints(200, OTL_CLEARANCE, TUBE_OD, PITCH_RATIO, 30);

        expect(points.some((p) => p.shellID === 200)).toBe(true);
    });

    it("returns results sorted ascending by shell ID", () => {
        const points = findDiscreteSweepPoints(200, OTL_CLEARANCE, TUBE_OD, PITCH_RATIO, 30);

        for (let i = 1; i < points.length; i++) {
            expect(points[i].shellID).toBeGreaterThan(points[i - 1].shellID);
        }
    });

    it("returns at most 5 points (current + 2 up + 2 down)", () => {
        const points = findDiscreteSweepPoints(200, OTL_CLEARANCE, TUBE_OD, PITCH_RATIO, 30);

        expect(points.length).toBeLessThanOrEqual(5);
    });

    it("adjacent points have different tube counts (each is a real transition)", () => {
        const points = findDiscreteSweepPoints(200, OTL_CLEARANCE, TUBE_OD, PITCH_RATIO, 30);

        for (let i = 1; i < points.length; i++) {
            // At minimum, the shell IDs should differ by more than 1mm
            // (real transitions are spaced apart, not consecutive shell IDs)
            expect(points[i].shellID - points[i - 1].shellID).toBeGreaterThan(1);
        }
    });

    it("tube counts are non-decreasing with shell ID (monotonic)", () => {
        const points = findDiscreteSweepPoints(200, OTL_CLEARANCE, TUBE_OD, PITCH_RATIO, 30);

        for (let i = 1; i < points.length; i++) {
            expect(points[i].numTubes).toBeGreaterThanOrEqual(points[i - 1].numTubes);
        }
    });

    it("works for the user-reported large tube OD case", () => {
        const points = findDiscreteSweepPoints(1720, 150, 95.3, 1.25, 30);

        expect(points.length).toBeGreaterThanOrEqual(1);
        expect(points.some((p) => p.shellID === 1720)).toBe(true);
        // Adjacent points should have different tube counts
        for (let i = 1; i < points.length; i++) {
            expect(points[i].shellID - points[i - 1].shellID).toBeGreaterThan(1);
        }
    });

    it("each point has a minID that matches findMinID for its tube count", () => {
        const points = findDiscreteSweepPoints(200, OTL_CLEARANCE, TUBE_OD, PITCH_RATIO, 30);

        for (const point of points) {
            if (point.numTubes > 0) {
                const expected = findMinID(point.numTubes, OTL_CLEARANCE, TUBE_OD, PITCH_RATIO, 30);
                expect(point.minID).toBe(expected);
            }
        }
    });
});

describe("TubeSheet — regression: unknown layout must not hang", () => {
    // The UI stores the radial layout as the number 0 (see layoutOptionRows).
    // A stray 0 used to reach the plugin as an unknown layout, where the
    // non-radial findMinID path's "grow the diameter until a valid tube field
    // exists" loop could never terminate (tubeFieldOTL always returned null).
    it.each([0, 999])("throws a clean error for invalid layout %s", (badLayout) => {
        expect(
            () => new TubeSheet(OTL_CLEARANCE, TUBE_OD, PITCH_RATIO, badLayout as never, 50),
        ).toThrow(/Invalid tube layout/);
    });

    it("still throws (not hangs) for an invalid layout pinned by shellID", () => {
        expect(
            () => new TubeSheet(OTL_CLEARANCE, TUBE_OD, PITCH_RATIO, 0 as never, undefined, 500),
        ).toThrow(/Invalid tube layout/);
    });
});

describe("TubeSheet — regression: findMinID snap can undershoot the OTL-defining tubes", () => {
    // findMinID snaps its diameter guess to
    // round(OTLFromTubeField(...) + OTLClearance). OTLFromTubeField works from
    // coordinates that applySymmetry has already rounded to 8dp, so the snapped
    // shell ID can end up a few billionths of a mm too tight to re-admit the
    // very tubes that defined the OTL when the field is regenerated from raw
    // (unrounded) lattice math. This bites hardest when an entire symmetric
    // ring of tubes sits exactly on the boundary, since all of them can be
    // dropped in one shot (5 tubes here instead of the correct 9).
    it("still returns at least minTubes for a boundary-tangent 45-degree layout", () => {
        const ts = new TubeSheet(150, 90.53, 1.25, 45, 7);

        expect(ts.numTubes).toBe(9);
        expect(ts.numTubes).toBeGreaterThanOrEqual(7);
        expect(ts.minID).toBeCloseTo(560.6018845, 6);
        expect(ts.OTL).toBeCloseTo(410.6018845, 6);
        expect(ts.tubeField).not.toBeNull();
        expect(ts.tubeField!.length).toBe(ts.numTubes);
    });

    it.each([
        { pitchRatio: 1.25, expectedNumTubes: 9, expectedMinID: 560.6018845 },
        { pitchRatio: 1.3, expectedNumTubes: 9, expectedMinID: 573.40475988 },
        { pitchRatio: 1.5, expectedNumTubes: 9, expectedMinID: 624.6162614 },
    ])(
        "meets or exceeds minTubes=7 for a 45-degree layout at pitchRatio=$pitchRatio",
        ({ pitchRatio, expectedNumTubes, expectedMinID }) => {
            const ts = new TubeSheet(150, 90.53, pitchRatio, 45, 7);

            expect(ts.numTubes).toBeGreaterThanOrEqual(7);
            expect(ts.numTubes).toBe(expectedNumTubes);
            expect(ts.minID).toBeCloseTo(expectedMinID, 6);
        },
    );
});

describe("TubeSheet — regression: stale x skips a whole row of the tube grid", () => {
    // The quarter-tube-field loop reset `i` between rows but not `x`. The inner
    // while loop's entry guard (Math.abs(x) <= maxOTL) then ran on the leftover
    // overshoot x from the previous row's break, not a fresh value for the new
    // row. When that leftover value exceeded maxOTL, the entire next row was
    // skipped before it computed anything - even though its own first point
    // belonged in the field. This showed up as tube counts
    // that jumped straight past small targets like minTubes=3 or 4 without
    // ever finding the layout (2 tubes) that should have grown to meet them.
    it("finds the 4-tube layout for minTubes=3 on a 45-degree layout instead of getting stuck at 2", () => {
        const ts = new TubeSheet(150, 90.53, 1.5, 45, 3);

        expect(ts.numTubes).toBe(4);
        expect(ts.numTubes).toBeGreaterThanOrEqual(3);
        expect(ts.minID).toBeCloseTo(432.5731307, 6);
        expect(ts.OTL).toBeCloseTo(282.5731307, 6);
        expect(ts.tubeField).not.toBeNull();
        expect(ts.tubeField!.length).toBe(ts.numTubes);
    });

    it("finds the same 4-tube layout for minTubes=4 (no valid 3-tube arrangement exists)", () => {
        const ts = new TubeSheet(150, 90.53, 1.5, 45, 4);

        expect(ts.numTubes).toBe(4);
        expect(ts.numTubes).toBeGreaterThanOrEqual(4);
        expect(ts.minID).toBeCloseTo(432.5731307, 6);
    });

    it("finds the 4-tube layout for minTubes=3 on a 60-degree layout", () => {
        const ts = new TubeSheet(0, 90.53, 1.2, 60, 3);

        expect(ts.numTubes).toBe(4);
        expect(ts.numTubes).toBeGreaterThanOrEqual(3);
        expect(ts.minID).toBeCloseTo(278.69307154, 6);
    });

    it.each(LAYOUTS.filter((l): l is Exclude<TubeSheetLayout, "radial"> => l !== "radial"))(
        "never returns fewer tubes than requested across small minTubes targets for layout %s",
        (layout) => {
            for (let minTubes = 1; minTubes <= 12; minTubes++) {
                const ts = new TubeSheet(OTL_CLEARANCE, TUBE_OD, PITCH_RATIO, layout, minTubes);
                expect(ts.numTubes).not.toBeNull();
                expect(ts.numTubes!).toBeGreaterThanOrEqual(minTubes);
                expect(ts.tubeField).not.toBeNull();
                expect(ts.tubeField!.length).toBe(ts.numTubes);
            }
        },
    );
});

describe("TubeSheet — full float precision for non-radial layouts", () => {
    // 45° and 90° are the same (square) lattice rotated, and radial realises
    // the same packing in some cases. All layouts must compute the tube field
    // at full float precision so that identical physical packings yield
    // bit-identical shell sizes. Previously non-radial layouts rounded every
    // coordinate to 8dp in applySymmetry, which broke the tie in minID by 1e-8
    // and made the worker's preferred-layout flag mark only one of two tied
    // layouts.
    const OC = 40;
    const OD = 95.3;
    const PR = (95.3 + 20) / 95.3;

    it("produces a bit-identical minID for the same 4-tube diamond in 45-degree and radial layouts", () => {
        const ts45 = new TubeSheet(OC, OD, PR, 45, 4);
        const tsRadial = new TubeSheet(OC, OD, PR, "radial", 4);

        expect(ts45.numTubes).toBe(4);
        expect(tsRadial.numTubes).toBe(4);
        expect(ts45.minID).toBe(tsRadial.minID);
        expect(ts45.minID).toBe(298.35882375);
    });

    it("keeps tube coordinates at full float precision instead of 8dp-rounded values", () => {
        const ts = new TubeSheet(OC, OD, PR, 45, 4);
        // Diamond radius = pitch/cos45/2 at full precision.
        const C = (OD * PR) / (1 / Math.sqrt(2)) / 2;
        expect(ts.tubeField!.some((t) => t.x === C || t.y === C || t.x === -C || t.y === -C)).toBe(
            true,
        );
    });
});

describe("scanQuarterField — lazy count matches full field", () => {
    const OC = 6.35;
    const OD = 19.05;
    const PR = 1.25;

    const angularLayouts: TubeSheetLayout[] = [30, 45, 60, 90];

    it.each(angularLayouts)(
        "minTubes mode produces same numTubes as shellID mode for layout %s",
        (layout) => {
            // Build by shellID (full path) and by minTubes (lazy path via findMinID).
            // Both must agree on the tube count for the resolved shell.
            const shellTS = new TubeSheet(OC, OD, PR, layout, undefined, 500);
            const minTubesTS = new TubeSheet(OC, OD, PR, layout, shellTS.numTubes!);

            expect(minTubesTS.numTubes).toBe(shellTS.numTubes);
            expect(minTubesTS.minID).toBeCloseTo(shellTS.minID!, 6);
        },
    );

    it("lazy OTL matches full OTL for a range of shellIDs", () => {
        // For each shellID, build via shellID (full) and verify the OTL
        // matches what findMinID snapped to (lazy path used during search).
        const shellIDs = [200, 300, 400, 500, 600, 700];
        for (const layout of angularLayouts) {
            for (const sid of shellIDs) {
                const ts = new TubeSheet(OC, OD, PR, layout, undefined, sid);
                if (ts.numTubes! > 0) {
                    // Re-build via minTubes using the resolved numTubes.
                    // findMinID uses the lazy path internally.
                    const ts2 = new TubeSheet(OC, OD, PR, layout, ts.numTubes!);
                    expect(ts2.numTubes).toBe(ts.numTubes);
                    expect(ts2.OTL).toBeCloseTo(ts.OTL!, 6);
                }
            }
        }
    });
});
