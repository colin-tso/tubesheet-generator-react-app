import memoize from "lodash.memoize";
import { LRUCache } from "@/utils/LRUCache";

export interface Tube {
    x: number;
    y: number;
}
export type TubeField = Array<Tube>;
export const TUBE_SHEET_LAYOUTS = [30, 45, 60, 90, "radial"] as const;
export type TubeSheetLayout = (typeof TUBE_SHEET_LAYOUTS)[number];

/**
 * The offset option accepted by the layout functions: a boolean forces the
 * offset on/off, while "AUTO" picks whichever offset yields more tubes.
 * (`boolean | "AUTO"` collapses to `boolean` at the type level, but the alias
 * documents that "AUTO" is a first-class choice.)
 */
export type OffsetOption = boolean | "AUTO";

// The union of value kinds a memo key can hold. Shared by createMemoKey and
// the layout functions' memo defaults so the two can't drift apart.
type MemoKeyValue = number | string | boolean | undefined;

// Membership checks against the layout list happen on every call to
// generateTubeField/findMinID, both of which run repeatedly inside bisection
// and heuristic search loops. A Set gives O(1) lookups there instead of
// O(TUBE_SHEET_LAYOUTS.length) with Array#includes.
const TUBE_SHEET_LAYOUT_SET: ReadonlySet<TubeSheetLayout> = new Set(TUBE_SHEET_LAYOUTS);

export interface ITubeSheetData {
    tubeField: ReadonlyArray<Tube> | null;
    OTL: number | null;
    shellID?: number;
    minID: number | null;
    tubeOD: number;
    pitchRatio: number;
    layout: TubeSheetLayout;
    numTubes: number | null;
}

export class TubeSheet {
    private _OTLClearance: number;
    private _tubeOD: number;
    private _pitchRatio: number;
    private _layout: TubeSheetLayout;
    private _minID: number | null;
    private _numTubes: number | null;
    private _tubeField: TubeField | null;
    private _minTubes?: number;
    private _shellID?: number;
    private _OTL: number | null;

    /**
     * Construct a new TubeSheet object.
     *
     * @param {number} OTLClearance     OTL = Outer Tube Limit. The minimum
     *                                  diametrical clearance from the tube
     *                                  outer diameter to the shell ID.
     * @param {number} tubeOD           The tube outer diameter.
     * @param {number} pitchRatio       The tube pitch ratio.
     * @param {TubeSheetLayout} layout  The tube layout angle.
     * @param {number} [minTubes]       The minimum number of tubes required. If
     *                                  specified, the shell ID will be
     *                                  calculated to achieve this number of
     *                                  tubes.
     * @param {number} [shellID]        The shell ID. If specified, the number
     *                                  of tubes will be the maximum allowable
     *                                  for this shell ID.
     */
    public constructor(
        OTLClearance: number,
        tubeOD: number,
        pitchRatio: number,
        layout: TubeSheetLayout,
        minTubes?: number,
        shellID?: number,
    ) {
        this._minTubes = minTubes;
        this._shellID = shellID;
        this._OTLClearance = OTLClearance;
        this._tubeOD = tubeOD;
        this._pitchRatio = pitchRatio;
        this._layout = layout;
        this._minID = null;
        this._numTubes = null;
        this._tubeField = null;
        this._OTL = null;
        this.updateGeneratedProps();
    }

    set OTLClearance(x: number) {
        this._OTLClearance = x;
        this.updateGeneratedProps();
    }
    get OTLClearance(): number {
        return this._OTLClearance;
    }

    set tubeOD(x: number) {
        this._tubeOD = x;
        this.updateGeneratedProps();
    }
    get tubeOD(): number {
        return this._tubeOD;
    }

    set pitchRatio(x: number) {
        this._pitchRatio = x;
        this.updateGeneratedProps();
    }
    get pitchRatio(): number {
        return this._pitchRatio;
    }

    set layout(x: typeof this._layout) {
        this._layout = x;
        this.updateGeneratedProps();
    }
    get layout(): TubeSheetLayout {
        return this._layout;
    }

    set minTubes(x: number) {
        this._minTubes = x;
        this.updateGeneratedProps();
    }
    get minTubes(): number | undefined {
        return this._minTubes;
    }

    set shellID(x: number) {
        this._shellID = x;
        this.updateGeneratedProps();
    }
    get shellID(): number | undefined {
        return this._shellID;
    }

    get tubeField(): ReadonlyArray<Tube> | null {
        return this._tubeField;
    }

    get minID(): number | null {
        return this._minID;
    }

    get numTubes(): number | null {
        return this._numTubes;
    }

    get OTL(): number | null {
        return this._OTL;
    }

    get svg(): SVGSVGElement {
        return generateTubeSheetSVG(this);
    }

    private updateGeneratedProps() {
        const props = this.computeGeneratedProps();
        this._minID = props.minID;
        this._numTubes = props.numTubes;
        this._tubeField = props.tubeField;
        this._OTL = props.OTL;
    }

    private computeGeneratedProps(): {
        minID: number | null;
        numTubes: number;
        tubeField: TubeField | null;
        OTL: number | null;
    } {
        if (!TUBE_SHEET_LAYOUT_SET.has(this._layout)) {
            throw new Error(`Invalid tube layout: ${String(this._layout)}`);
        }

        let minID: number | null = null;
        let effectiveShellID: number | null = null;

        if (this._shellID) {
            effectiveShellID = this._shellID;
        } else if (this._minTubes) {
            minID = findMinID(
                this._minTubes,
                this._OTLClearance,
                this._tubeOD,
                this._pitchRatio,
                this._layout,
            );
            effectiveShellID = minID;
        }

        if (effectiveShellID === null) {
            return { minID, numTubes: 0, tubeField: null, OTL: null };
        }

        const tubeField = generateTubeField(
            effectiveShellID,
            this._OTLClearance,
            this._tubeOD,
            this._pitchRatio,
            this._layout,
        );
        const numTubes = tubeField ? tubeField.length : 0;

        if (this._shellID) {
            minID = findMinID(
                numTubes,
                this._OTLClearance,
                this._tubeOD,
                this._pitchRatio,
                this._layout,
            );
        }

        const OTL = tubeField ? OTLFromTubeField(tubeField, this._tubeOD) : null;

        return { minID, numTubes, tubeField, OTL };
    }
}

/**
 * Ceils `value` to the given number of decimal places. Exposed via
 * {@link ULP_TEST_UTILS} so the FP tolerance-analysis scripts in
 * scripts/fp-tolerance-analysis can measure noise against the real
 * implementation instead of a duplicated mirror.
 *
 * @param {number} value           The value to round up.
 * @param {number} decimalPlaces   The number of decimal places to ceil to.
 * @returns {number}               `value` ceiled to `decimalPlaces` decimals.
 */
const roundUp = (value: number, decimalPlaces: number): number => {
    const multiplier = Math.pow(10, decimalPlaces);
    return Math.ceil(value * multiplier) / multiplier;
};

const round = (num: number, decimalPlaces = 0): number => {
    const p = Math.pow(10, decimalPlaces);
    const n = num * p * (1 + Number.EPSILON);
    return Math.round(n) / p;
};

/**
 * The gap between adjacent representable doubles around `magnitude` — one unit
 * in the last place (ULP) per IEEE-754 double precision:
 * 2^(exponent(magnitude) - 52). A magnitude of 0 is treated as 1, since a value
 * that arrived at exactly 0 via prior arithmetic can still carry ULP-scale
 * error relative to the operations that produced it.
 *
 * Exposed via {@link ULP_TEST_UTILS} so the FP tolerance-analysis scripts in
 * scripts/fp-tolerance-analysis measure noise in the same units the runtime
 * guard actually uses, rather than duplicating the formula.
 *
 * @param {number} magnitude  The magnitude whose ULP size to return.
 * @returns {number}          The size of one ULP at `magnitude`.
 */
const ulpAt = (magnitude: number): number => {
    const mag = Math.abs(magnitude) || 1;
    return 2 ** (Math.floor(Math.log2(mag)) - 52);
};

/**
 * Returns an absolute tolerance sized to the floating-point noise expected
 * around the given magnitude: a small multiple of the unit-in-the-last-place
 * (ULP) at that magnitude, rather than a fixed constant. This is the same
 * reasoning already used for the ring-count epsilon in radialTubeField, applied
 * consistently to the file's other floating-point comparison guards.
 *
 * A fixed absolute tolerance (e.g. 1e-9) implicitly assumes a particular input
 * magnitude: chosen against typical mm-scale tubesheet dimensions, it has ~4
 * orders of magnitude of margin over the observed noise at that scale, but the
 * noise from a chain of floating-point operations scales with the magnitude of
 * its operands (roughly magnitude * 2^-52 per operation), so a fixed tolerance
 * quietly loses its margin as inputs grow and could in principle mask a real
 * difference at very large magnitudes, or be looser than necessary at very
 * small ones. Scaling with the operand's own ULP keeps the guard tight at every
 * magnitude.
 *
 * Empirically, the specific comparisons this is used for (differences of
 * sums/subtractions of a handful of operands) exhibit worst-case error of
 * ~1-1.25 ULPs across a wide magnitude sweep (1 to 1e10); the default of 64
 * ULPs keeps roughly the same ~50x safety margin the file's original fixed
 * constants had over their own observed worst case, while remaining valid
 * regardless of input magnitude.
 *
 * Exposed via {@link ULP_TEST_UTILS} so the FP tolerance-analysis scripts in
 * scripts/fp-tolerance-analysis can exercise the real function rather than a
 * duplicated mirror.
 *
 * @param {number} magnitude   A representative magnitude of the operands
 *                             involved in the comparison (e.g. the largest
 *                             one). A magnitude of 0 is treated as 1, since a
 *                             value that arrived at exactly 0 via prior
 *                             arithmetic can still carry ULP-scale error
 *                             relative to the operations that produced it.
 * @param {number} [ulps=64]   Number of ULPs of margin to allow.
 * @returns {number}           An absolute tolerance appropriate for
 *                             `magnitude`.
 */
const ulpTolerance = (magnitude: number, ulps = 64): number => {
    return ulpAt(magnitude) * ulps;
};

/**
 * Exposes the floating-point tolerance helpers (`roundUp`, `ulpAt`,
 * `ulpTolerance`) to the FP tolerance-analysis scripts in
 * scripts/fp-tolerance-analysis so they exercise the real implementations
 * instead of mirrored copies, without adding those helpers to the module's
 * public API surface. Not part of the module's documented interface.
 */
export const ULP_TEST_UTILS = {
    roundUp,
    ulpAt,
    ulpTolerance,
} as const;

/**
 * Creates a memo key for a given set of arguments based on a set of defaults.
 *
 * @param {...MemoKeyValue} defaults
 * The default values for the memo key.
 * @returns {(...args: Array<MemoKeyValue>) => string}
 * A memo key generator function.
 */
const createMemoKey = (
    ...defaults: Array<MemoKeyValue>
): ((...args: Array<MemoKeyValue>) => string) => {
    return (...args: Array<MemoKeyValue>): string => {
        const normalised = defaults.map((def, i) => (args[i] === undefined ? def : args[i]));
        return normalised.map((v) => `${typeof v}:${String(v)}`).join("|");
    };
};
const MEMO_CACHE_SIZE = 5000;
const LAYOUT_FN_MEMO_DEFAULTS: Array<MemoKeyValue> = [
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    "AUTO",
];

/**
 * Shape of the per-layout lattice constants returned by getLayoutConstants.
 */
interface LayoutConstants {
    dx: number;
    dy: number;
    C: number;
}

/**
 * Type predicate for the defensive checks on tube fields that can arrive from
 * hand-built ITubeSheetData (bypassing TubeSheet's validated setters).
 */
const isTube = (value: unknown): value is Tube =>
    typeof value === "object" && value !== null && "x" in value && "y" in value;

/**
 * Bounded-memoization wrapper around lodash.memoize: applies the resolver and
 * installs a fixed-capacity LRU cache, returning a typed function whose `.cache`
 * is the LRUCache. This keeps the `as unknown as` casts the raw lodash typing
 * would otherwise force at every call site in one place.
 */
const memoizeBounded = <Args extends unknown[], R>(
    fn: (...args: Args) => R,
    resolver: (...args: Args) => string,
    cacheSize: number,
): ((...args: Args) => R) & { cache: LRUCache<string, R> } => {
    const memoized = memoize(fn, resolver) as ((...args: Args) => R) & {
        cache: LRUCache<string, R>;
    };
    memoized.cache = new LRUCache<string, R>(cacheSize);
    return memoized;
};

// Symmetry helpers used by generateTubeField's quarter-field expansion. Hoisted
// to module scope so they aren't re-created on every call: generateTubeField
// runs dozens of times inside findMinID's bisection/heuristic loops.
const normalize = (n: number): number => (n === 0 ? 0 : n);

const sortTubePositions = (tubeField: TubeField): TubeField => {
    return tubeField.sort((a, b) => {
        if (a.y === b.y) {
            return a.x - b.x; // Sort by x if y is the same
        }
        return a.y - b.y; // Otherwise, sort by y
    });
};

/**
 * Expands a quarter-plane tube field into the full 4-quadrant field by
 * partitioning the input into axis points (x===0 || y===0) and strict-quadrant
 * core points (x>0 && y>0), mirroring each partition, and sorting the result.
 *
 * Points with x<0 (the offset layout's -dx/2 column) are skipped — they are
 * auto-covered by core mirroring. Axis points are canonicalised to the positive
 * half-axis and deduped via float-keyed Sets (O(perimeter/pitch), tiny).
 *
 * Full float precision is preserved (no rounding); only −0 → 0 normalization
 * is applied to match the historical dedup behaviour.
 */
const expandQuarterField = (quarterTubeField: TubeField): TubeField => {
    const xAxisMags = new Set<number>(); // stores |x| for points on y===0
    const yAxisMags = new Set<number>(); // stores |y| for points on x===0
    const core: TubeField = [];
    let hasOrigin = false;

    for (const point of quarterTubeField) {
        const x = normalize(point.x);
        const y = normalize(point.y);
        if (x === 0 && y === 0) {
            hasOrigin = true;
            continue;
        }
        if (x === 0) {
            // y-axis point: canonicalise to positive y
            const mag = y < 0 ? -y : y;
            yAxisMags.add(mag);
        } else if (y === 0) {
            // x-axis point: canonicalise to positive x
            const mag = x < 0 ? -x : x;
            xAxisMags.add(mag);
        } else if (x > 0 && y > 0) {
            // Strict core quadrant
            core.push({ x, y });
        }
        // Else: x<0 && y>0 (offset column) — skipped, auto-covered by core mirroring.
        // (y<0 never occurs in the quarter field since scan starts at y=0 and increases.)
    }

    const result: TubeField = [];

    // Origin
    if (hasOrigin) {
        result.push({ x: 0, y: 0 });
    }

    // Axis mirrors
    for (const mag of yAxisMags) {
        result.push({ x: 0, y: mag });
        result.push({ x: 0, y: -mag });
    }
    for (const mag of xAxisMags) {
        result.push({ x: mag, y: 0 });
        result.push({ x: -mag, y: 0 });
    }

    // Core 4-way mirrors (no dedup needed; strict-quadrant copies never collide)
    for (const point of core) {
        const x = point.x;
        const y = point.y;
        result.push({ x, y });
        result.push({ x: -x, y });
        result.push({ x, y: -y });
        result.push({ x: -x, y: -y });
    }

    return sortTubePositions(result);
};

/**
 * Generates a tube field based on the provided parameters.
 *
 * @param {number} shellID                          The shell ID.
 * @param {number} OTLClearance                     The OTL clearance.
 * @param {number} tubeOD                           The tube OD.
 * @param {number} pitchRatio                       The pitch ratio.
 * @param {TubeSheetLayout} layout                  The tube sheet layout.
 * @param {OffsetOption} [offsetOption="AUTO"]       The offset option.
 * @returns {TubeField | null}                      The generated tube field, or
 *                                                  null if an error occurred.
 */
const generateTubeField = memoizeBounded(
    (
        shellID: number,
        OTLClearance: number,
        tubeOD: number,
        pitchRatio: number,
        layout: TubeSheetLayout,
        offsetOption: OffsetOption = "AUTO",
    ): TubeField | null => {
        try {
            if (shellID <= 0) {
                throw new Error("Shell ID must be greater than 0");
            }
            if (tubeOD <= 0) {
                throw new Error("Tube OD must be greater than 0");
            }
            if (pitchRatio < 1) {
                throw new Error("Pitch ratio must be 1 or greater");
            }
            if (OTLClearance < 0) {
                throw new Error("OTL clearance must be 0 or greater");
            }
            // See ulpTolerance's doc comment: this absorbs the same class of
            // spurious-violation floating-point noise a fixed epsilon would
            // (e.g. `(19.05 + 6.35) - 6.35 < 19.05` due to representation
            // error), but scaled to these operands' own magnitude.
            if (
                tubeOD >
                shellID - OTLClearance + ulpTolerance(Math.max(shellID, OTLClearance, tubeOD))
            ) {
                throw new Error("Tube OD exceeds max allowable OTL");
            }

            const DECIMAL_PLACES = 8;
            shellID = roundUp(shellID, DECIMAL_PLACES);

            const MAX_ITERATIONS = 999999;

            if (layout === "radial") {
                return radialTubeField(shellID, OTLClearance, tubeOD, pitchRatio);
            }

            const pitch = tubeOD * pitchRatio;
            const maxOTL = shellID - OTLClearance;

            const { dx, dy, C } = getLayoutConstants(pitch, layout);

            // Recursively find optimal layout if offsetOption is set to AUTO.
            // Otherwise, respect offsetOption arg input.
            let idealOffsetOption: boolean;

            if (offsetOption !== "AUTO") {
                idealOffsetOption = offsetOption;
            } else {
                idealOffsetOption =
                    tubeCount(shellID, OTLClearance, tubeOD, pitchRatio, layout, true) >
                    tubeCount(shellID, OTLClearance, tubeOD, pitchRatio, layout, false);
                return generateTubeField(
                    shellID,
                    OTLClearance,
                    tubeOD,
                    pitchRatio,
                    layout,
                    idealOffsetOption,
                );
            }

            const offset = idealOffsetOption ? dx / 2 : 0;
            let i = 0,
                j = 0,
                x = 0,
                y = 0;
            const quarterTubeField: TubeField = [];
            const maxCentreDist = (maxOTL - tubeOD) / 2;
            // Tubes that define the OTL sit exactly on this boundary by
            // construction: findMinID snaps the shell ID to
            // roundUp(OTLFromTubeField(...) + OTLClearance), and
            // OTLFromTubeField works from exact lattice coordinates (no
            // rounding is applied to the tube field), so the snapped shell ID
            // is always large enough to re-admit the boundary tube: OTL >= 2R +
            // tubeOD implies (roundUp(OTL + OC) - OC - tubeOD)/2 >= R.
            // BOUND_TOLERANCE remains as a safety net for residual sub-ulp
            // floating-point noise at the boundary, scaled to maxOTL's own
            // magnitude (see ulpTolerance) so it can't admit a tube that
            // doesn't actually belong regardless of how large the shell is.
            const BOUND_TOLERANCE = ulpTolerance(maxOTL);
            const maxCentreDistSq =
                (maxCentreDist + BOUND_TOLERANCE) * (maxCentreDist + BOUND_TOLERANCE);

            while (Math.abs(y) <= maxOTL && j < MAX_ITERATIONS) {
                y = j * dy;
                const cMult = j & 1 ? 0 : 1;
                x = 0;
                while (Math.abs(x) <= maxOTL && i < MAX_ITERATIONS) {
                    x = C * cMult + i * dx - offset;
                    i++;
                    if (x * x + y * y <= maxCentreDistSq) {
                        // same as Math.sqrt(x ** 2 + y ** 2) * 2 + tubeOD <=
                        // maxOTL
                        quarterTubeField.push({ x: x, y: y });
                    } else {
                        break;
                    }
                }
                i = 0;
                j++;
            }

            const tubeField = expandQuarterField(quarterTubeField);

            return tubeField;
        } catch (error) {
            console.error((error as Error).message);
            return null;
        }
    },
    createMemoKey(...LAYOUT_FN_MEMO_DEFAULTS),
    MEMO_CACHE_SIZE,
);

/**
 * Counts tubes in the quarter-field scan without allocating, expanding, or
 * sorting. Mirrors generateTubeField's scan loop exactly so the returned count
 * is bit-identical to what expandQuarterField would produce. Also tracks the
 * maximum squared distance from the origin for OTL computation.
 *
 * Only valid for non-radial layouts — callers must guard on layout !== "radial".
 * offsetOption must be a boolean (not "AUTO") — callers must resolve AUTO
 * before calling.
 *
 * @param {number} shellID          The shell ID.
 * @param {number} OTLClearance     The OTL clearance.
 * @param {number} tubeOD           The tube OD.
 * @param {number} pitchRatio       The pitch ratio.
 * @param {TubeSheetLayout} layout  The tube sheet layout. Must not be
 *                                  "radial".
 * @param {boolean} offsetOption    Whether the tube field is offset. Must be
 *                                  resolved to a boolean by the caller (not
 *                                  "AUTO").
 * @returns {{ count: number; maxDistSq: number } | null}
 *                                  The tube count and the maximum squared
 *                                  distance from the origin, or null if an
 *                                  error occurred.
 */
const scanQuarterField = memoizeBounded(
    (
        shellID: number,
        OTLClearance: number,
        tubeOD: number,
        pitchRatio: number,
        layout: TubeSheetLayout,
        offsetOption: boolean,
    ): { count: number; maxDistSq: number } | null => {
        try {
            if (shellID <= 0) {
                throw new Error("Shell ID must be greater than 0");
            }
            if (tubeOD <= 0) {
                throw new Error("Tube OD must be greater than 0");
            }
            if (pitchRatio < 1) {
                throw new Error("Pitch ratio must be 1 or greater");
            }
            if (OTLClearance < 0) {
                throw new Error("OTL clearance must be 0 or greater");
            }
            if (
                tubeOD >
                shellID - OTLClearance + ulpTolerance(Math.max(shellID, OTLClearance, tubeOD))
            ) {
                throw new Error("Tube OD exceeds max allowable OTL");
            }

            const DECIMAL_PLACES = 8;
            shellID = roundUp(shellID, DECIMAL_PLACES);

            const pitch = tubeOD * pitchRatio;
            const maxOTL = shellID - OTLClearance;
            const { dx, dy, C } = getLayoutConstants(pitch, layout);

            const offset = offsetOption ? dx / 2 : 0;
            let i = 0,
                j = 0,
                x = 0,
                y = 0;
            const maxCentreDist = (maxOTL - tubeOD) / 2;
            const BOUND_TOLERANCE = ulpTolerance(maxOTL);
            const maxCentreDistSq =
                (maxCentreDist + BOUND_TOLERANCE) * (maxCentreDist + BOUND_TOLERANCE);

            let hasOrigin = false;
            const xAxisMags = new Set<number>();
            const yAxisMags = new Set<number>();
            let coreCount = 0;
            let maxDistSq = 0;

            while (Math.abs(y) <= maxOTL && j < 999999) {
                y = j * dy;
                const cMult = j & 1 ? 0 : 1;
                x = 0;
                while (Math.abs(x) <= maxOTL && i < 999999) {
                    x = C * cMult + i * dx - offset;
                    i++;
                    if (x * x + y * y <= maxCentreDistSq) {
                        const nx = normalize(x);
                        const ny = normalize(y);
                        const distSq = nx * nx + ny * ny;
                        if (distSq > maxDistSq) {
                            maxDistSq = distSq;
                        }
                        if (nx === 0 && ny === 0) {
                            hasOrigin = true;
                        } else if (nx === 0) {
                            yAxisMags.add(ny < 0 ? -ny : ny);
                        } else if (ny === 0) {
                            xAxisMags.add(nx < 0 ? -nx : nx);
                        } else if (nx > 0 && ny > 0) {
                            coreCount++;
                        }
                        // x<0 && y>0 points skipped — auto-covered by core mirroring
                    } else {
                        break;
                    }
                }
                i = 0;
                j++;
            }

            const originCount = hasOrigin ? 1 : 0;
            const count = originCount + 2 * xAxisMags.size + 2 * yAxisMags.size + 4 * coreCount;
            if (count === 0) {
                return null;
            }
            return { count, maxDistSq };
        } catch {
            return null;
        }
    },
    createMemoKey(...LAYOUT_FN_MEMO_DEFAULTS),
    MEMO_CACHE_SIZE,
);

/**
 * Innermost patterns ("seeds") for the radial layout. Each seed is either the
 * central tube (count 1) or a ring of exactly 2-5 tubes at the smallest radius
 * that keeps adjacent tubes on the ring one pitch apart (radius =
 * pitch/(2*sin(pi/count))). Outward rings are then placed one pitch further
 * out. No larger seed is worth trying: a six-tube ring at radius pitch never
 * beats the central-tube layout that fits in the same shell, and any ring
 * beyond pitch is dominated by combining an inner seed with that same ring.
 */
const RADIAL_SEED_COUNTS = [1, 2, 3, 4, 5] as const;

// Ring-placement helpers used by radialTubeField. Hoisted to module scope so
// they aren't re-created on every call: radialTubeField runs once per
// generateTubeField call, which itself executes repeatedly inside findMinID's
// monotone/bisection search over the shell ID.
const ringTubeCount = (radius: number, pitch: number): number => {
    const ratio = Math.PI / Math.asin(pitch / (2 * radius));
    // ULP (unit in the last place): the gap between adjacent doubles around
    // `x`, i.e. 2^(exponent(x) - 52). Floating-point error is a small
    // multiple of it, so an epsilon of a few ulps recovers exact integers
    // (the measured undershoot at k=1 is exactly 1 ulp) without ever
    // crossing a genuinely sub-integer ratio.
    const epsilon = ulpAt(ratio) * 4;
    let numTubes = Math.floor(ratio + epsilon);
    while (
        2 * radius * Math.sin(Math.PI / numTubes) <
        pitch - ulpTolerance(Math.max(radius, pitch))
    ) {
        numTubes--;
    }
    return numTubes;
};

const placeRing = (radius: number, tubeField: TubeField, pitch: number): void => {
    const numTubes = ringTubeCount(radius, pitch);
    const angleIncrement = (2 * Math.PI) / numTubes;
    for (let i = 0; i < numTubes; i++) {
        const angle = angleIncrement * i * -1 + Math.PI / 2;
        tubeField.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
    }
};

// Build one candidate per seed: the seed pattern itself, then full rings at
// seedRadius + k*pitch for k = 1, 2, ... . The seed ring (count 2-5) sits at
// the smallest radius admitting exactly `count` tubes one pitch apart; the
// seed ring's own within-ring chord is exactly one pitch, so no ring is ever
// stacked on a closer sub-pitch neighbour.
const buildSeedField = (count: number, pitch: number, maxCentreDist: number): TubeField => {
    const seedRadius = count === 1 ? 0 : pitch / (2 * Math.sin(Math.PI / count));
    if (seedRadius > maxCentreDist + ulpTolerance(Math.max(seedRadius, maxCentreDist))) {
        return [];
    }
    const tubeField: TubeField = [];
    if (count === 1) {
        tubeField.push({ x: 0, y: 0 });
    } else {
        placeRing(seedRadius, tubeField, pitch);
    }
    for (let k = 1; ; k++) {
        const ringRadius = seedRadius + k * pitch;
        if (ringRadius > maxCentreDist + ulpTolerance(Math.max(ringRadius, maxCentreDist))) {
            break;
        }
        placeRing(ringRadius, tubeField, pitch);
    }
    return tubeField;
};

/**
 * Counts how many tubes a given seed would produce without building the field.
 * Mirrors the exact loop and stopping conditions of {@link buildSeedField} so
 * the winning seed is chosen identically to the full-build comparison.
 */
const seedTubeCount = (count: number, pitch: number, maxCentreDist: number): number => {
    const seedRadius = count === 1 ? 0 : pitch / (2 * Math.sin(Math.PI / count));
    if (seedRadius > maxCentreDist + ulpTolerance(Math.max(seedRadius, maxCentreDist))) {
        return 0;
    }
    let total = count; // count===1 → central tube (1); else seed ring (count tubes)
    for (let k = 1; ; k++) {
        const ringRadius = seedRadius + k * pitch;
        if (ringRadius > maxCentreDist + ulpTolerance(Math.max(ringRadius, maxCentreDist))) {
            break;
        }
        total += ringTubeCount(ringRadius, pitch);
    }
    return total;
};

/**
 * Generates a radial tube field comprised of concentric rings of tubes.
 *
 * One candidate is built for each seed in {@link RADIAL_SEED_COUNTS}: the seed
 * pattern itself (the central tube, or a ring of 2-5 tubes), followed by full
 * rings placed one pitch further out at every step, each holding the greatest
 * number of tubes whose within-ring chord is at least one pitch. All rings
 * share the same start angle, so the tube pair aligned radially across two
 * adjacent rings is exactly one pitch apart and every other cross-ring pair is
 * farther, keeping the whole field pitch-clearance. The candidate holding the
 * most tubes is returned.
 *
 * @param {number} shellID      The shell ID.
 * @param {number} OTLClearance The OTL clearance.
 * @param {number} tubeOD       The tube OD.
 * @param {number} pitchRatio   The tube pitch ratio.
 * @returns {TubeField}         The generated radial tube field.
 */
const radialTubeField = (
    shellID: number,
    OTLClearance: number,
    tubeOD: number,
    pitchRatio: number,
): TubeField => {
    const pitch = tubeOD * pitchRatio;
    const maxOTL = shellID - OTLClearance;
    const maxCentreDist = (maxOTL - tubeOD) / 2;

    // A tube at the centre fits when maxCentreDist is non-negative, but
    // floating-point error can leave it a hair below zero at exactly shellID =
    // tubeOD + OTLClearance (e.g. `(25.4 - 6.35 - 19.05) / 2` is -1.4e-15).
    // Tolerate that, scaled to the shell's own magnitude (see ulpTolerance),
    // but reject shells with no genuine room for even the centre tube.
    if (maxCentreDist < -ulpTolerance(maxOTL)) {
        return [];
    }

    // Keep the layout holding the most tubes, matching the `offset="AUTO"`
    // "keep the better result" behaviour used elsewhere in the module. Pick
    // the winning seed by tube count (same `>` tie-break: earliest seed wins),
    // then build only the winner. The 4 discarded candidates are reduced to
    // O(rings) count scans with no array allocation.
    let bestField: TubeField = [];
    let bestCount = -1;
    for (const count of RADIAL_SEED_COUNTS) {
        const n = seedTubeCount(count, pitch, maxCentreDist);
        if (n > bestCount) {
            bestCount = n;
            bestField = buildSeedField(count, pitch, maxCentreDist);
        }
    }
    return bestField;
};

/**
 * Returns the layout constants based on the pitch and layout.
 *
 * @param {number} pitch             The pitch value.
 * @param {TubeSheetLayout} layout   The layout value.
 * @returns {LayoutConstants}        The layout constants.
 */
const SIN_60 = Math.sqrt(3) / 2;

const getLayoutConstants = (pitch: number, layout: TubeSheetLayout): LayoutConstants => {
    // Only compute the trig/division for the requested layout instead of
    // building an object with all five layouts' constants (four of which are
    // discarded) on every call. This function sits on the bisection/heuristic
    // hot path in findMinID, so avoiding the extra allocations and Math calls
    // adds up across the hundreds of calls a single search can make. The
    // formulas themselves are unchanged from the lookup-table version. Preserve
    // the exact original operation order for each formula (rather than
    // algebraically simplifying it) so results are bit-for-bit identical to the
    // previous lookup-table implementation.
    switch (layout) {
        case 30: {
            const dx = pitch;
            const dy = pitch * SIN_60;
            const C = pitch / 2;
            return { dx, dy, C };
        }
        case 60: {
            const dx = pitch * SIN_60 * 2;
            const dy = pitch / 2;
            const C = dx / 2;
            return { dx, dy, C };
        }
        case 90:
            return { dx: pitch, dy: pitch, C: 0 };
        case 45: {
            const cos45 = 1 / Math.sqrt(2);
            const dx = pitch / cos45;
            const dy = pitch / cos45 / 2;
            const C = pitch / cos45 / 2;
            return { dx, dy, C };
        }
        case "radial":
            return { dx: NaN, dy: NaN, C: NaN };
        default: {
            // Exhaustiveness guard: TubeSheetLayout's members are all handled
            // above, so layout is `never` here unless the union grows. Throw
            // rather than silently returning undefined for a future layout.
            const exhaustiveCheck: never = layout;
            throw new Error(`Unknown layout: ${String(exhaustiveCheck)}`);
        }
    }
};

/**
 * Calculates the number of tubes in a tube sheet based on the shell ID, OTL
 * clearance, tube outer diameter, pitch ratio, layout, and offset option.
 *
 * @param {number} shellID                          The shell ID of the tube
 *                                                  sheet.
 * @param {number} OTLClearance                     The minimum diametrical
 *                                                  clearance from the tube
 *                                                  outer diameter to the shell
 *                                                  ID.
 * @param {number} tubeOD                           The tube outer diameter.
 * @param {number} pitchRatio                       The tube pitch ratio.
 * @param {TubeSheetLayout} layout                  The layout of the tube
 * sheet.
 * @param {OffsetOption} [offsetOption="AUTO"]   The offset option for the
 *                                                  tube field generation.
 *                                                  Defaults to "AUTO".
 * @returns {number}                                The number of tubes in the
 *                                                  tube sheet.
 */
const tubeCount = (
    shellID: number,
    OTLClearance: number,
    tubeOD: number,
    pitchRatio: number,
    layout: TubeSheetLayout,
    offsetOption: OffsetOption = "AUTO",
    lazy = false,
): number => {
    if (lazy) {
        if (layout === "radial") {
            const pitch = tubeOD * pitchRatio;
            const maxOTL = shellID - OTLClearance;
            const maxCentreDist = (maxOTL - tubeOD) / 2;
            if (maxCentreDist < -ulpTolerance(maxOTL)) return 0;
            let best = 0;
            for (const count of RADIAL_SEED_COUNTS) {
                const n = seedTubeCount(count, pitch, maxCentreDist);
                if (n > best) best = n;
            }
            return best;
        }
        if (offsetOption === "AUTO") {
            const resultTrue = scanQuarterField(
                shellID,
                OTLClearance,
                tubeOD,
                pitchRatio,
                layout,
                true,
            );
            const resultFalse = scanQuarterField(
                shellID,
                OTLClearance,
                tubeOD,
                pitchRatio,
                layout,
                false,
            );
            const countTrue = resultTrue ? resultTrue.count : 0;
            const countFalse = resultFalse ? resultFalse.count : 0;
            return countTrue > countFalse ? countTrue : countFalse;
        }
        const result = scanQuarterField(
            shellID,
            OTLClearance,
            tubeOD,
            pitchRatio,
            layout,
            offsetOption,
        );
        return result ? result.count : 0;
    }
    const tubeField = generateTubeField(
        shellID,
        OTLClearance,
        tubeOD,
        pitchRatio,
        layout,
        offsetOption,
    );
    return tubeField ? tubeField.length : 0;
};

/**
 * Calculates the OTL (Outer Tube Limit) for a given tube field.
 *
 * @param {TubeField} tubeField            The tube field object.
 * @param {number} tubeOD                  The tube OD.
 * @param {number} [offsetOption=0]        The offset option.
 * @returns {number | null | undefined}    The calculated OTL value, or null if
 *                                         an error occurred.
 * @throws {Error}                         If the tube OD is greater than the
 *                                         max allowable OTL.
 * @throws {Error}                         If the tube field array is invalid.
 */
const OTLFromTubeField = (tubeField: ReadonlyArray<Tube>, tubeOD: number): number | null => {
    if (!tubeField || tubeField.length === 0) {
        return null;
    }
    const DECIMAL_PLACES = 11;
    let maxDistSq = 0;
    let found = false;
    tubeField.forEach((tube) => {
        if (isTube(tube)) {
            found = true;
            const distSq = tube.x * tube.x + tube.y * tube.y;
            if (distSq > maxDistSq) {
                maxDistSq = distSq;
            }
        }
    });
    if (!found) {
        return null;
    }
    const D = Math.sqrt(maxDistSq) * 2 + tubeOD;
    return roundUp(D, DECIMAL_PLACES);
};

/**
 * Calculates the OTL (Outer Tube Limit) based on tube field parameters.
 *
 * @param {number} shellID                          The shell ID.
 * @param {number} OTLClearance                     The OTL clearance.
 * @param {number} tubeOD                           The tube OD.
 * @param {number} pitchRatio                       The pitch ratio.
 * @param {TubeSheetLayout} layout                  The tube sheet layout.
 * @param {OffsetOption} [offsetOption="AUTO"]  The offset option.
 * @returns {number | null | undefined}             The calculated OTL value, or
 *                                                  null if an error occurred.
 * @throws {Error}                                  If the tube OD is greater
 *                                                  than the max allowable OTL.
 * @throws {Error}                                  If the tube field array is
 *                                                  invalid.
 */
const tubeFieldOTL = (
    shellID: number,
    OTLClearance: number,
    tubeOD: number,
    pitchRatio: number,
    layout: TubeSheetLayout,
    offsetOption: OffsetOption = "AUTO",
    lazy = false,
): number | null | undefined => {
    try {
        // See ulpTolerance's doc comment / the matching guard in
        // generateTubeField for why this is scaled rather than a fixed
        // constant.
        if (
            tubeOD >
            shellID - OTLClearance + ulpTolerance(Math.max(shellID, OTLClearance, tubeOD))
        ) {
            throw new Error("Tube OD cannot be greater than max allowable OTL.");
        }

        if (lazy) {
            if (layout === "radial") {
                const pitch = tubeOD * pitchRatio;
                const maxOTL = shellID - OTLClearance;
                const maxCentreDist = (maxOTL - tubeOD) / 2;
                if (maxCentreDist < -ulpTolerance(maxOTL)) return null;

                let bestCount = 0;
                let bestSeedRadius = 0;
                let bestNumRings = 0;

                for (const count of RADIAL_SEED_COUNTS) {
                    const seedRadius = count === 1 ? 0 : pitch / (2 * Math.sin(Math.PI / count));
                    if (
                        seedRadius >
                        maxCentreDist + ulpTolerance(Math.max(seedRadius, maxCentreDist))
                    ) {
                        continue;
                    }
                    let total = count;
                    let numRings = 1;
                    for (let k = 1; ; k++) {
                        const ringRadius = seedRadius + k * pitch;
                        if (
                            ringRadius >
                            maxCentreDist + ulpTolerance(Math.max(ringRadius, maxCentreDist))
                        ) {
                            break;
                        }
                        total += ringTubeCount(ringRadius, pitch);
                        numRings++;
                    }
                    if (total > bestCount) {
                        bestCount = total;
                        bestSeedRadius = seedRadius;
                        bestNumRings = numRings;
                    }
                }

                if (bestCount === 0) return null;
                const outermostRadius = bestSeedRadius + (bestNumRings - 1) * pitch;
                return roundUp(outermostRadius * 2 + tubeOD, 11);
            }

            const computeOTL = (
                result: { count: number; maxDistSq: number } | null,
            ): number | null => {
                if (!result || result.count === 0) return null;
                const OTL = roundUp(Math.sqrt(result.maxDistSq) * 2 + tubeOD, 11);
                return OTL;
            };

            if (offsetOption === "AUTO") {
                const resultTrue = scanQuarterField(
                    shellID,
                    OTLClearance,
                    tubeOD,
                    pitchRatio,
                    layout,
                    true,
                );
                const resultFalse = scanQuarterField(
                    shellID,
                    OTLClearance,
                    tubeOD,
                    pitchRatio,
                    layout,
                    false,
                );
                const countTrue = resultTrue ? resultTrue.count : 0;
                const countFalse = resultFalse ? resultFalse.count : 0;
                return countTrue >= countFalse ? computeOTL(resultTrue) : computeOTL(resultFalse);
            }

            return computeOTL(
                scanQuarterField(shellID, OTLClearance, tubeOD, pitchRatio, layout, offsetOption),
            );
        }

        const tubeField = generateTubeField(
            shellID,
            OTLClearance,
            tubeOD,
            pitchRatio,
            layout,
            offsetOption,
        );
        if (tubeField && tubeField.length > 0) {
            const OTL = OTLFromTubeField(tubeField, tubeOD);
            if (OTL === null) {
                throw new Error("Invalid tube field array.");
            }
            return OTL;
        }
        return null;
    } catch {
        return null;
    }
};

export interface ShellSweepPoint {
    shellID: number;
    numTubes: number;
    OTL: number | null;
    minID: number;
}

/**
 * Finds the next discrete shell sizes i.e. the shell IDs where the tube count
 * changes, stepping outward from a center point in whole-unit increments.
 * Returns the current result plus up to 2 transitions in each direction (5
 * points max), ordered from smallest to largest shell ID.
 *
 * Each direction's search stops early, and yields one fewer point than the max,
 * if it runs past `minShellID` (downward) or 500 steps without finding a change
 * in tube count.
 *
 * @param {number} centerShellID                The shell ID to search outward
 *                                              from.
 * @param {number} OTLClearance                 The minimum diametrical
 *                                              clearance from the tube outer
 *                                              diameter to the shell ID.
 * @param {number} tubeOD                       The tube outer diameter.
 * @param {number} pitchRatio                   The tube pitch ratio.
 * @param {TubeSheetLayout} layout              The layout of the tube sheet.
 * @param {OffsetOption} [offsetOption="AUTO"]  The offset option.
 * @returns {ShellSweepPoint[]}                 Up to 5 points — the center
 *                                              point plus any transitions found
 *                                              in each direction — sorted by
 *                                              ascending shell ID.
 */
export const findDiscreteSweepPoints = (
    centerShellID: number,
    OTLClearance: number,
    tubeOD: number,
    pitchRatio: number,
    layout: TubeSheetLayout,
    offsetOption: OffsetOption = "AUTO",
): ShellSweepPoint[] => {
    const STEP = 1;
    const minShellID = tubeOD + OTLClearance;

    const makePoint = (shellID: number): ShellSweepPoint => ({
        shellID,
        numTubes: tubeCount(shellID, OTLClearance, tubeOD, pitchRatio, layout, offsetOption, true),
        OTL:
            tubeFieldOTL(shellID, OTLClearance, tubeOD, pitchRatio, layout, offsetOption, true) ??
            null,
        minID: shellID,
    });

    const current = makePoint(centerShellID);
    if (current.numTubes > 0) {
        try {
            current.minID = findMinID(
                current.numTubes,
                OTLClearance,
                tubeOD,
                pitchRatio,
                layout,
                offsetOption,
            );
        } catch {
            current.minID = centerShellID;
        }
    }
    const findTransitionUp = (startShellID: number): ShellSweepPoint | null => {
        const startCount = tubeCount(
            startShellID,
            OTLClearance,
            tubeOD,
            pitchRatio,
            layout,
            offsetOption,
            true,
        );
        try {
            const targetID = findMinID(
                startCount + 1,
                OTLClearance,
                tubeOD,
                pitchRatio,
                layout,
                offsetOption,
            );
            const point = makePoint(targetID);
            point.minID = findMinID(
                point.numTubes,
                OTLClearance,
                tubeOD,
                pitchRatio,
                layout,
                offsetOption,
            );
            return point;
        } catch {
            return null;
        }
    };

    /**
     * Finds the discrete transition point stepping down from `startShellID` —
     * the shell ID (in whole-unit steps) closest to `startShellID` at which the
     * tube count differs from `tubeCount(startShellID)`.
     *
     * Binary searches over k = 1..stepLimit for the smallest k where
     * `tubeCount(startShellID - k) !== startCount`. Tube count is monotonic
     * non-decreasing in shell ID, so that condition is a monotonic boolean in k
     * (false, false, ..., true, true), which makes it searchable in O(log 500)
     * `tubeCount` calls instead of a linear scan.
     *
     * @param {number} startShellID       The shell ID to search downward from.
     * @returns {ShellSweepPoint | null}  The transition point closest to
     *                                    `startShellID`, or null if none is
     *                                    found within 500 whole-unit steps or
     *                                    before `minShellID` is reached.
     */

    const findTransitionDown = (startShellID: number): ShellSweepPoint | null => {
        const startCount = tubeCount(
            startShellID,
            OTLClearance,
            tubeOD,
            pitchRatio,
            layout,
            offsetOption,
            true,
        );

        // How many whole-unit steps down from startShellID are actually available
        // before hitting minShellID (same bound the old linear walk enforced),
        // capped at 500. This is pure arithmetic — no tubeCount calls — so it's
        // cheap even though it mirrors the original step-by-step subtraction
        // exactly (avoiding any float-drift difference from computing
        // startShellID - k directly).
        let stepLimit = 0;
        let probe = startShellID;
        for (let i = 0; i < 500; i++) {
            probe -= STEP;
            if (probe < minShellID) break;
            stepLimit = i + 1;
        }
        if (stepLimit === 0) return null;

        // Tube count is monotonic non-decreasing in shell ID, so stepping down
        // from startShellID it can only stay the same or fall — i.e. whether
        // tubeCount(startShellID - k) !== startCount is a monotonic boolean in
        // k. That makes the search for the first (smallest) k where it changes
        // a binary search instead of the previous linear walk of up to 500
        // tubeCount calls (each an unmemoized quarter-field scan).
        const countAtK = (k: number): number =>
            tubeCount(
                startShellID - k,
                OTLClearance,
                tubeOD,
                pitchRatio,
                layout,
                offsetOption,
                true,
            );

        if (countAtK(stepLimit) === startCount) return null; // no transition within range

        let lo = 1;
        let hi = stepLimit;
        while (lo < hi) {
            const mid = Math.floor((lo + hi) / 2);
            if (countAtK(mid) !== startCount) {
                hi = mid;
            } else {
                lo = mid + 1;
            }
        }

        const shellID = startShellID - lo;
        const point = makePoint(shellID);
        point.minID = findMinID(
            point.numTubes,
            OTLClearance,
            tubeOD,
            pitchRatio,
            layout,
            offsetOption,
        );
        return point;
    };

    const up1 = findTransitionUp(centerShellID);
    const up2 = up1 ? findTransitionUp(up1.shellID) : null;
    const down1 = findTransitionDown(centerShellID);
    const down2 = down1 ? findTransitionDown(down1.shellID) : null;

    return [down2, down1, current, up1, up2].filter((p): p is ShellSweepPoint => p !== null);
};

/**
 * Finds the minimum shell ID for a given set of parameters.
 *
 * @param {number} minTubes                         The minimum number of tubes.
 * @param {number} OTLClearance                     The outer tube length
 *                                                  clearance.
 * @param {number} tubeOD                           The outer diameter of the
 *                                                  tube.
 * @param {number} pitchRatio                       The pitch ratio.
 * @param {string | TubeSheetLayout} layout         The layout type. Can be a
 *                                                  string or a TubeSheetLayout
 *                                                  object.
 * @param {OffsetOption} [offsetOption="AUTO"]      The offset option. Can be a
 *                                                  boolean or "AUTO".
 * @returns {number}                                The minimum shell ID.
 * @throws {Error}                                  If the tube outer diameter
 *                                                  is less than or equal to 0,
 *                                                  the pitch ratio is less than
 *                                                  1, or the OTL clearance is
 *                                                  less than 0.
 * @throws {Error}                                  If the maximum number of
 *                                                  retries is reached and the
 *                                                  minimum shell ID could not
 *                                                  be found.
 */
export const findMinID = memoizeBounded(
    (
        minTubes: number,
        OTLClearance: number,
        tubeOD: number,
        pitchRatio: number,
        layout: TubeSheetLayout,
        offsetOption: OffsetOption = "AUTO",
    ): number => {
        const MAX_RETRIES: number = 10;
        let retries: number = 0;

        let D_old: number;
        let D_new: number;
        let D_bestGuess: number | undefined;
        let D_check: number;
        const BETA = 1.1; // iteration multiplier when solution has not yet been bounded
        let iterations: number;
        let numTubes_old: number;
        let numTubes_new: number;
        let numTubes_bestGuess: number | undefined;
        let numTubes_check: number;
        const HEURISTIC_MAX_ITERATIONS: number = 20;
        const BISECT_MAX_ITERATIONS: number = 100;
        const DECIMAL_PLACES = 8;
        // Shared cap for any "grow/shrink the diameter guess until it works"
        // search below. Every such loop must terminate: an invalid layout (or
        // pathological inputs) previously spun forever because tubeFieldOTL
        // kept returning null. 1000 steps of the 1.1 multiplier spans an
        // astronomically wide diameter range, matching the radial path's cap.
        const BOUND_MAX_ITERATIONS: number = 1000;

        if (tubeOD <= 0) {
            throw new Error("Tube outer diameter must be greater than 0");
        }
        if (pitchRatio < 1) {
            throw new Error("Pitch ratio must be 1 or greater");
        }
        if (OTLClearance < 0) {
            throw new Error("OTL clearance must be 0 or greater");
        }
        if (!TUBE_SHEET_LAYOUT_SET.has(layout)) {
            throw new Error(`Invalid tube layout: ${String(layout)}`);
        }
        // shortcircuit when target number of tubes = 1
        if (minTubes === 1) {
            return roundUp(tubeOD + OTLClearance, DECIMAL_PLACES);
        }

        if (layout === "radial") {
            // The radial layout packs tubes into concentric rings, so there is
            // no closed-form diameter. Search monotonically for the smallest
            // shell ID whose generated radial tube field holds at least
            // `minTubes` tubes.
            const RADIAL_MAX_BOUND_ITERATIONS = 1000;
            let lowerBound = tubeOD + OTLClearance;
            // The first probe starts strictly above the one-tube lower bound:
            // at `tubeOD + OTLClearance` exactly, the validation `tubeOD >
            // shellID - OTLClearance` can spuriously hold due to floating-point
            // error (e.g. `(19.05 + 6.35) - 6.35` is less than 19.05), which
            // would log a spurious "Tube OD exceeds" error.
            let upperBound = lowerBound * BETA;
            let boundIterations = 0;
            while (
                tubeCount(upperBound, OTLClearance, tubeOD, pitchRatio, layout, "AUTO", true) <
                minTubes
            ) {
                upperBound = upperBound * BETA;
                if (!Number.isFinite(upperBound) || upperBound <= 0) {
                    throw new Error(
                        "findMinID: diameter guess became non-finite while searching for an upper bound.",
                    );
                }
                if (++boundIterations > RADIAL_MAX_BOUND_ITERATIONS) {
                    throw new Error(
                        "findMinID: unable to bound a valid diameter within the iteration limit.",
                    );
                }
            }

            while (upperBound - lowerBound > Math.pow(10, -DECIMAL_PLACES)) {
                const mid = (lowerBound + upperBound) / 2;
                if (
                    tubeCount(mid, OTLClearance, tubeOD, pitchRatio, layout, "AUTO", true) >=
                    minTubes
                ) {
                    upperBound = mid;
                } else {
                    lowerBound = mid;
                }
            }

            const OTL = tubeFieldOTL(
                upperBound,
                OTLClearance,
                tubeOD,
                pitchRatio,
                layout,
                "AUTO",
                true,
            );
            return roundUp(
                OTL !== null && OTL !== undefined ? OTL + OTLClearance : upperBound,
                DECIMAL_PLACES,
            );
        }

        while (true) {
            try {
                iterations = 0;

                if (offsetOption === "AUTO") {
                    const minID_offsetTrue = findMinID(
                        minTubes,
                        OTLClearance,
                        tubeOD,
                        pitchRatio,
                        layout,
                        true,
                    );
                    const minID_offsetFalse = findMinID(
                        minTubes,
                        OTLClearance,
                        tubeOD,
                        pitchRatio,
                        layout,
                        false,
                    );

                    if (Number.isNaN(minID_offsetTrue)) {
                        return minID_offsetFalse;
                    }
                    if (Number.isNaN(minID_offsetFalse)) {
                        return minID_offsetTrue;
                    }
                    return Math.min(minID_offsetTrue, minID_offsetFalse);
                } else {
                    // Track bounds for bisection fallback if heuristic fails to
                    // converge
                    let D_lowerBound = 0;
                    let D_upperBound = 0;
                    let haveLowerBound = false;
                    let haveUpperBound = false;

                    const updateBounds = (D: number, numTubes: number, targetTubes: number) => {
                        if (numTubes < targetTubes) {
                            if (!haveLowerBound) {
                                D_lowerBound = D;
                                haveLowerBound = true;
                            } else if (D > D_lowerBound) {
                                D_lowerBound = D;
                            }
                        } else {
                            const OTL = tubeFieldOTL(
                                D,
                                OTLClearance,
                                tubeOD,
                                pitchRatio,
                                layout,
                                offsetOption,
                                true,
                            );
                            if (OTL !== null && OTL !== undefined) {
                                const D_snap = roundUp(OTL + OTLClearance, DECIMAL_PLACES);
                                if (!haveUpperBound) {
                                    D_upperBound = D_snap;
                                    haveUpperBound = true;
                                } else if (D_snap < D_upperBound) {
                                    D_upperBound = D_snap;
                                }
                            }
                        }
                    };

                    // Initialise guesses depending on selected layout
                    const packingFactor = layout === 30 || layout === 60 ? 0.84 : 0.61;
                    if (layout === 30 || layout === 60) {
                        if (offsetOption === true) {
                            D_old = Math.max(
                                tubeOD * pitchRatio * Math.sqrt(minTubes / packingFactor) +
                                    OTLClearance,
                                tubeOD * pitchRatio * 2 + OTLClearance + 0.1,
                            );
                        } else {
                            D_old = Math.max(
                                tubeOD * pitchRatio * Math.sqrt(minTubes / packingFactor) +
                                    OTLClearance,
                                tubeOD + OTLClearance + 0.1,
                            );
                        }
                    } else {
                        if (offsetOption === true) {
                            D_old = Math.max(
                                tubeOD * pitchRatio * Math.sqrt(minTubes / packingFactor) +
                                    OTLClearance,
                                Math.sqrt(
                                    (tubeOD * pitchRatio) ** 2 + ((tubeOD * pitchRatio) / 2) ** 2,
                                ) *
                                    2 +
                                    OTLClearance +
                                    0.1,
                            );
                        } else {
                            D_old = Math.max(
                                tubeOD * pitchRatio * Math.sqrt(minTubes / packingFactor) +
                                    OTLClearance,
                                tubeOD + OTLClearance + 0.1,
                            );
                        }
                    }

                    // Increase diameter guess until valid tubefield is
                    // obtained. Bounded: previously an invalid layout (or any
                    // input that always yields an empty field) made this loop
                    // forever.
                    let growOldIterations = 0;
                    while (
                        tubeFieldOTL(
                            D_old,
                            OTLClearance,
                            tubeOD,
                            pitchRatio,
                            layout,
                            offsetOption,
                            true,
                        ) === null &&
                        growOldIterations < BOUND_MAX_ITERATIONS
                    ) {
                        D_old = D_old * BETA;
                        if (!Number.isFinite(D_old) || D_old <= 0) {
                            throw new Error(
                                "findMinID: diameter guess became non-finite while searching for a valid tubefield.",
                            );
                        }
                        growOldIterations++;
                    }
                    if (growOldIterations >= BOUND_MAX_ITERATIONS) {
                        throw new Error(
                            "findMinID: unable to find a valid diameter within the iteration limit.",
                        );
                    }

                    // Save first guess of tube count into memory
                    D_old =
                        tubeFieldOTL(
                            D_old,
                            OTLClearance,
                            tubeOD,
                            pitchRatio,
                            layout,
                            offsetOption,
                            true,
                        )! + OTLClearance;
                    numTubes_old = tubeCount(
                        D_old,
                        OTLClearance,
                        tubeOD,
                        pitchRatio,
                        layout,
                        offsetOption,
                        true,
                    );

                    // Increment diameter, save second guess of tube count into
                    // memory
                    D_new = D_old * BETA;
                    D_new =
                        tubeFieldOTL(
                            D_new,
                            OTLClearance,
                            tubeOD,
                            pitchRatio,
                            layout,
                            offsetOption,
                            true,
                        )! + OTLClearance;
                    numTubes_new = tubeCount(
                        D_new,
                        OTLClearance,
                        tubeOD,
                        pitchRatio,
                        layout,
                        offsetOption,
                        true,
                    );

                    updateBounds(D_old, numTubes_old, minTubes);
                    updateBounds(D_new, numTubes_new, minTubes);

                    while (numTubes_new !== minTubes && iterations < HEURISTIC_MAX_ITERATIONS) {
                        // Re-initialise guesses. if there has been a previous
                        // attempt, use that as a starting point.
                        if (!D_bestGuess) {
                            D_old = D_new;
                        } else {
                            D_old = D_bestGuess;
                        }

                        if (iterations > 1) {
                            // Shortcircuit by reducing the diameter by a small
                            // amount to see whether the predicted number of
                            // tubes goes below the target. if tube count
                            // reduces, then min ID has been found.
                            if (numTubes_new > minTubes) {
                                D_check = roundUp(
                                    tubeFieldOTL(
                                        D_new,
                                        OTLClearance,
                                        tubeOD,
                                        pitchRatio,
                                        layout,
                                        offsetOption,
                                        true,
                                    )! + OTLClearance,
                                    DECIMAL_PLACES,
                                );
                                numTubes_check = tubeCount(
                                    D_check - Math.pow(10, -DECIMAL_PLACES),
                                    OTLClearance,
                                    tubeOD,
                                    pitchRatio,
                                    layout,
                                    offsetOption,
                                    true,
                                );
                                updateBounds(
                                    D_check - Math.pow(10, -DECIMAL_PLACES),
                                    numTubes_check,
                                    minTubes,
                                );

                                if (numTubes_check < minTubes) {
                                    minTubes = numTubes_new;
                                    return D_check;
                                } else if (numTubes_check < numTubes_new) {
                                    D_new = D_check;
                                }
                            }
                        }

                        // Adjust the diameter guess based on the tube count
                        // comparisons
                        if (numTubes_new < minTubes && numTubes_old < minTubes) {
                            // Increment diameter guess by beta factor if both
                            // are less
                            D_new = D_old * BETA;
                        } else if (numTubes_new > minTubes && numTubes_old > minTubes) {
                            // Decrease diameter by beta factor if both are more
                            D_new = D_old / BETA;
                        } else {
                            // Average the last two guesses if one is more and
                            // one is less
                            D_new = (D_new + D_old) / 2;
                        }

                        numTubes_old = tubeCount(
                            D_old,
                            OTLClearance,
                            tubeOD,
                            pitchRatio,
                            layout,
                            offsetOption,
                            true,
                        );
                        numTubes_new = tubeCount(
                            D_new,
                            OTLClearance,
                            tubeOD,
                            pitchRatio,
                            layout,
                            offsetOption,
                            true,
                        );

                        updateBounds(D_old, numTubes_old, minTubes);
                        updateBounds(D_new, numTubes_new, minTubes);

                        if (numTubes_new > minTubes) {
                            if (!numTubes_bestGuess) {
                                numTubes_bestGuess = numTubes_new;
                                D_bestGuess = D_new;
                            } else if (numTubes_new < numTubes_bestGuess) {
                                numTubes_bestGuess = numTubes_new;
                                D_bestGuess = D_new;
                            }
                        }
                        iterations++;
                    }

                    if (numTubes_new === minTubes) {
                        return roundUp(
                            tubeFieldOTL(
                                D_new,
                                OTLClearance,
                                tubeOD,
                                pitchRatio,
                                layout,
                                offsetOption,
                                true,
                            )! + OTLClearance,
                            DECIMAL_PLACES,
                        );
                    }

                    // Bisection fallback if heuristic fails to converge
                    const minValidID = tubeOD + OTLClearance + Math.pow(10, -DECIMAL_PLACES);
                    if (!haveLowerBound) {
                        let D_shrink = haveUpperBound ? D_upperBound : D_old;
                        // Bounded, with a finiteness check: an unbounded loop
                        // here can hang forever if D_shrink never drops below
                        // the minimum valid diameter.
                        let shrinkIterations = 0;
                        while (shrinkIterations < BOUND_MAX_ITERATIONS) {
                            if (!Number.isFinite(D_shrink) || D_shrink <= 0) {
                                throw new Error(
                                    "findMinID: diameter guess became non-finite while searching for a lower bound.",
                                );
                            }
                            D_shrink = D_shrink / BETA;
                            if (D_shrink <= minValidID) {
                                D_lowerBound = minValidID;
                                haveLowerBound = true;
                                break;
                            }
                            const numTubesLower = tubeCount(
                                D_shrink,
                                OTLClearance,
                                tubeOD,
                                pitchRatio,
                                layout,
                                offsetOption,
                                true,
                            );
                            if (numTubesLower < minTubes) {
                                D_lowerBound = D_shrink;
                                haveLowerBound = true;
                                break;
                            }
                            shrinkIterations++;
                        }
                        if (!haveLowerBound) {
                            throw new Error(
                                "findMinID: unable to find a valid lower bound within the iteration limit.",
                            );
                        }
                    }

                    if (!haveUpperBound) {
                        let D_grow = haveLowerBound ? D_lowerBound : D_old;
                        // Bounded, with a finiteness check: an unbounded loop
                        // here can hang forever if D_grow ever became NaN.
                        let growIterations = 0;
                        while (growIterations < BOUND_MAX_ITERATIONS) {
                            if (!Number.isFinite(D_grow) || D_grow <= 0) {
                                throw new Error(
                                    "findMinID: diameter guess became non-finite while searching for an upper bound.",
                                );
                            }
                            D_grow = D_grow * BETA;
                            const numTubesUpper = tubeCount(
                                D_grow,
                                OTLClearance,
                                tubeOD,
                                pitchRatio,
                                layout,
                                offsetOption,
                                true,
                            );
                            if (numTubesUpper > minTubes) {
                                D_upperBound = roundUp(
                                    tubeFieldOTL(
                                        D_grow,
                                        OTLClearance,
                                        tubeOD,
                                        pitchRatio,
                                        layout,
                                        offsetOption,
                                        true,
                                    )! + OTLClearance,
                                    DECIMAL_PLACES,
                                );
                                haveUpperBound = true;
                                break;
                            }
                            growIterations++;
                        }
                        if (!haveUpperBound) {
                            throw new Error(
                                "findMinID: unable to bound a valid diameter within the iteration limit.",
                            );
                        }
                    }

                    let bisectIterations = 0;
                    while (
                        D_upperBound - D_lowerBound > Math.pow(10, -DECIMAL_PLACES) &&
                        bisectIterations < BISECT_MAX_ITERATIONS
                    ) {
                        const D_mid = (D_lowerBound + D_upperBound) / 2;
                        const numTubesMid = tubeCount(
                            D_mid,
                            OTLClearance,
                            tubeOD,
                            pitchRatio,
                            layout,
                            offsetOption,
                            true,
                        );
                        if (numTubesMid >= minTubes) {
                            D_upperBound = roundUp(
                                tubeFieldOTL(
                                    D_mid,
                                    OTLClearance,
                                    tubeOD,
                                    pitchRatio,
                                    layout,
                                    offsetOption,
                                    true,
                                )! + OTLClearance,
                                DECIMAL_PLACES,
                            );
                        } else {
                            D_lowerBound = D_mid;
                        }
                        bisectIterations++;
                    }
                    return D_upperBound;
                }
            } catch {
                if (retries < MAX_RETRIES) {
                    retries++;
                    minTubes++;
                } else {
                    throw new Error("Max number of retries reached. Min ID could not be found.");
                }
            }
        }
    },
    createMemoKey(...LAYOUT_FN_MEMO_DEFAULTS),
    MEMO_CACHE_SIZE,
);

/**
 * Extra margin around the final SVG viewBox.
 */
export const VIEWBOX_PADDING_AS_FRACTION = 0.1;

/**
 * SVG viewBox is padded by `VIEWBOX_PADDING_AS_FRACTION`, and the crosshair
 * extends 10% beyond the shell circle.
 */
export const DRAWING_SAFE_CONTENT_RADIUS_FRACTION = 0.5 / (1 + VIEWBOX_PADDING_AS_FRACTION);

/**
 * Returns the effective shell ID for a given TubeSheetData object.
 *
 * @param {Pick<ITubeSheetData, "tubeField" | "OTL" | "shellID" | "minID">} ts
 * The TubeSheetData object.
 * @returns {number}
 * The effective shell ID. Returns 0 if both `ts.tubeField` and `ts.OTL` are
 * null. If `ts.shellID` is defined and non-zero, or `ts.minID` is null, 0, or
 * NaN, returns `ts.shellID` (or 0 if `ts.shellID` is also unusable).
 * Otherwise, returns `ts.minID`.
 */
export const getEffectiveShellID = (
    ts: Pick<ITubeSheetData, "tubeField" | "OTL" | "shellID" | "minID">,
): number => {
    if (ts.tubeField === null && ts.OTL === null) {
        return 0;
    }

    if (ts.shellID || ts.minID === null || ts.minID === 0 || Number.isNaN(ts.minID)) {
        // ts.shellID may be undefined here if minID is also unusable.
        return ts.shellID ?? 0;
    }

    if (ts.shellID === undefined || ts.shellID === 0 || Number.isNaN(ts.shellID)) {
        return ts.minID;
    }

    return 0;
};

/**
 * Generates an SVG element containing circles based on the provided data.
 *
 * @param {ITubeSheetData} ts  The TubeSheetData object.
 * @returns {SVGSVGElement}    The generated SVG element.
 */
/**
 * Parses a `key:value; key:value` inline-style string into a lookup object.
 * Hoisted out of {@link generateTubeSheetSVG} so it isn't redefined on every
 * SVG render, and shared between the circle and crosshair generators so the
 * parsing logic isn't duplicated.
 *
 * @param {string} svgStyles                The style string to parse.
 * @returns {{ [key: string]: string }}      The parsed style lookup.
 */
const parseSVGStyleString = (svgStyles: string): { [key: string]: string } => {
    return svgStyles.split(";").reduce(
        (acc, style) => {
            const [key, value] = style.split(":");
            if (key && value) acc[key.trim()] = value.trim();
            return acc;
        },
        {} as { [key: string]: string },
    );
};

/**
 * Options accepted by {@link generateTubeSheetSVG}.
 */
export interface TubeSheetSVGOptions {
    /**
     * When true, draws each tube's number at its centre. The number matches the
     * `id` attribute already assigned to that tube's `<circle>` (its 1-based
     * position in `ts.tubeField`), so labels always match what
     * `document.getElementById` / the drawing's own tube IDs report. Off by
     * default since it adds a text element per tube.
     */
    showTubeLabels?: boolean;
}

export const generateTubeSheetSVG = (
    ts: ITubeSheetData,
    options?: TubeSheetSVGOptions,
): SVGSVGElement => {
    /**
     * Generates an SVG element containing circles based on the provided data.
     *
     * @param {T[]} circles        An array of objects representing the
     *                             coordinates of the circles.
     * @param {number} diameter    The diameter of the circles.
     * @param {string} svgStyles   The styles to apply to the circles.
     * @param {boolean} [id=false] The whether to assign an ID to each circle.
     * @returns {SVGSVGElement}    The generated SVG element.
     */
    const generateSVGCircles = <T extends { x: number; y: number }>(
        circles: ReadonlyArray<T>,
        diameter: number,
        svgStyles: string,
        id: boolean = false,
    ): SVGSVGElement => {
        // Create an SVG element
        const svgNamespace = "http://www.w3.org/2000/svg";

        // Create variables to define bounding box based on coordinates and
        // diameter
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;

        const svg = document.createElementNS(svgNamespace, "svg");

        // Predefine tube style
        const styleEntries = Object.entries(parseSVGStyleString(svgStyles));
        const radius = diameter / 2;
        const radiusStr = radius.toString();

        // Create a <g> wrapper to hold style attributes once (inherited by all circles)
        const group = document.createElementNS(svgNamespace, "g");
        for (const [key, value] of styleEntries) {
            group.setAttribute(key, value);
        }

        // Build circles in a detached DocumentFragment and append it once to the group.
        const fragment = document.createDocumentFragment();

        // Loop through each tube to create circles. A tube field can hold
        // thousands of tubes, so this is the hottest loop in SVG generation: an
        // indexed for-loop over a cached length avoids the per-element
        // callback-invocation overhead of Array#forEach, and direct comparisons
        // avoid a Math.min/Math.max call per coordinate.
        const { length } = circles;
        for (let i = 0; i < length; i++) {
            const c = circles[i];
            const cx = c.x;
            const cy = c.y;

            const circle = document.createElementNS(svgNamespace, "circle");
            circle.setAttribute("cx", cx.toString());
            circle.setAttribute("cy", cy.toString());
            circle.setAttribute("r", radiusStr);
            if (id) {
                circle.setAttribute("id", (i + 1).toString());
            }

            // Calculate bounding box based on coordinates and diameter.
            // Deliberately kept as Math.min/Math.max rather than a direct `<` /
            // `>` comparison: this data can come from a hand-built
            // ITubeSheetData passed straight to this exported function
            // (bypassing TubeSheet's validated setters), and Math.min/max
            // propagate a NaN coordinate into a visibly broken viewBox rather
            // than silently dropping it from the bounding box, matching this
            // file's fail-loud-on-invalid-input approach used elsewhere.
            minX = Math.min(minX, cx - radius);
            minY = Math.min(minY, cy - radius);
            maxX = Math.max(maxX, cx + radius);
            maxY = Math.max(maxY, cy + radius);

            // Append each circle to the SVG fragment
            fragment.appendChild(circle);
        }

        group.appendChild(fragment);
        svg.appendChild(group);

        const viewBox = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;

        // Set SVG attributes
        svg.setAttribute("xmlns", svgNamespace);
        svg.setAttribute("height", "100dvh");
        svg.setAttribute("viewBox", viewBox);

        return svg;
    };

    /**
     * Generates an SVG element containing one text label per tube, centred on
     * that tube's coordinates. Each label is the tube's 1-based index in
     * `circles` — identical to the `id` attribute generateSVGCircles assigns
     * that same tube (see the `id` param there) — so the visible number always
     * matches the circle's own id. Mirrors generateSVGCircles'
     * bounding-box/merge conventions so it can be fed straight into mergeSVGs.
     *
     * @param {T[]} circles        Tube coordinates.
     * @param {number} diameter    Tube diameter (used only for the bounding box).
     * @param {string} svgStyles   The styles to apply to the labels.
     * @returns {SVGSVGElement}    The generated SVG element.
     */
    const generateSVGLabels = <T extends { x: number; y: number }>(
        circles: ReadonlyArray<T>,
        diameter: number,
        svgStyles: string,
    ): SVGSVGElement => {
        const svgNamespace = "http://www.w3.org/2000/svg";

        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;

        const svg = document.createElementNS(svgNamespace, "svg");
        const radius = diameter / 2;

        const styleEntries = Object.entries(parseSVGStyleString(svgStyles));
        const group = document.createElementNS(svgNamespace, "g");
        for (const [key, value] of styleEntries) {
            group.setAttribute(key, value);
        }

        const fragment = document.createDocumentFragment();
        const { length } = circles;
        for (let i = 0; i < length; i++) {
            const c = circles[i];
            const cx = c.x;
            const cy = c.y;

            const text = document.createElementNS(svgNamespace, "text");
            text.setAttribute("x", cx.toString());
            text.setAttribute("y", cy.toString());
            // Vertical centering is done via `dy` rather than the
            // `dominant-baseline: central` CSS property: browsers honor
            // dominant-baseline fine, but svg2pdf.js (used for the PDF
            // export) ignores it and falls back to the text's default
            // alphabetic baseline, which visibly drops each label below the
            // tube's centre in the exported PDF only. `dy="0.35em"` is the
            // standard baseline-based vertical-centering offset — computed
            // from the font's own metrics rather than a CSS property engines
            // are free to skip — so it renders identically in the live SVG,
            // the PNG export (canvas), and the PDF export.
            text.setAttribute("dy", "0.35em");
            // Matches the id generateSVGCircles assigns this same tube.
            text.textContent = (i + 1).toString();
            fragment.appendChild(text);

            minX = Math.min(minX, cx - radius);
            minY = Math.min(minY, cy - radius);
            maxX = Math.max(maxX, cx + radius);
            maxY = Math.max(maxY, cy + radius);
        }

        group.appendChild(fragment);
        svg.appendChild(group);

        const viewBox = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;

        svg.setAttribute("xmlns", svgNamespace);
        svg.setAttribute("height", "100dvh");
        svg.setAttribute("viewBox", viewBox);

        return svg;
    };

    /**
     * Generates an SVG element containing a centered cross.
     *
     * @returns {SVGSVGElement}    The generated SVG element.
     */
    const generateSVGCenteredCross = (diameter: number, svgStyles: string): SVGSVGElement => {
        // Create an SVG element
        const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

        // Create variables to define bounding box based on coordinates and
        // diameter
        const minX = (-diameter / 2) * 1.1,
            minY = (-diameter / 2) * 1.1,
            maxX = (diameter / 2) * 1.1,
            maxY = (diameter / 2) * 1.1;

        // Interpret SVG styles
        const styleEntries = Object.entries(parseSVGStyleString(svgStyles));

        const svg = document.createElementNS(SVG_NAMESPACE, "svg");

        // Create a <g> wrapper to hold style attributes once (inherited by both lines)
        const group = document.createElementNS(SVG_NAMESPACE, "g");
        for (const [key, value] of styleEntries) {
            group.setAttribute(key, value);
        }

        // Horizontal line
        const horzLine = document.createElementNS(SVG_NAMESPACE, "line");
        horzLine.setAttribute("x1", minX.toString());
        horzLine.setAttribute("y1", "0");
        horzLine.setAttribute("x2", maxX.toString());
        horzLine.setAttribute("y2", "0");
        group.appendChild(horzLine);

        // Vertical line
        const vertLine = document.createElementNS(SVG_NAMESPACE, "line");
        vertLine.setAttribute("x1", "0");
        vertLine.setAttribute("y1", minY.toString());
        vertLine.setAttribute("x2", "0");
        vertLine.setAttribute("y2", maxY.toString());
        group.appendChild(vertLine);

        svg.appendChild(group);

        const viewBox = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;

        // Set SVG attributes
        svg.setAttribute("xmlns", SVG_NAMESPACE);
        svg.setAttribute("height", "100dvh");
        svg.setAttribute("viewBox", viewBox);

        return svg;
    };

    /**
     * Merges multiple SVG elements into a single SVG element.
     * @param {SVGSVGElement[]} svgs The SVG elements to merge.
     * @returns {SVGSVGElement} The merged SVG element.
     */
    const mergeSVGs = (svgs: SVGSVGElement[], viewBoxPaddingAsFraction: number): SVGSVGElement => {
        const VIEWBOX_PADDING = 1 + viewBoxPaddingAsFraction;
        const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

        // Create a new SVG element to serve as the container
        const mergedSVG = document.createElementNS(SVG_NAMESPACE, "svg");
        mergedSVG.setAttribute("xmlns", SVG_NAMESPACE);
        mergedSVG.setAttribute("height", "100dvh");
        mergedSVG.setAttribute("class", "tubesheet-svg");
        mergedSVG.setAttribute("margin", "0");
        mergedSVG.setAttribute("padding", "0");

        // Calculate the bounding box to set the viewBox of the merged SVG
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;

        for (const svg of svgs) {
            // Read the viewBox from the source SVG before moving its children
            const viewBox = svg.getAttribute("viewBox");
            if (viewBox) {
                const [x, y, width, height] = viewBox.split(" ").map(Number);
                // Kept as Math.min/Math.max for the same fail-loud reason as
                // generateSVGCircles above: an unparseable/NaN viewBox on any
                // merged SVG should stay visible in the result, not be quietly
                // excluded from the bounding box.
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x + width);
                maxY = Math.max(maxY, y + height);
            }

            // Move the <g> wrapper (first child) into the merged SVG.
            // Each source SVG now has a single <g> containing all its elements.
            const group = svg.firstElementChild;
            if (group instanceof SVGElement) {
                mergedSVG.appendChild(group);
            }
        }

        // Add a <style> element for non-inherited vector-effect (applies to all circles/lines)
        const style = document.createElementNS(SVG_NAMESPACE, "style");
        style.textContent =
            ".tubesheet-svg circle, .tubesheet-svg line { vector-effect: non-scaling-stroke; }";
        mergedSVG.appendChild(style);

        // Set the viewBox of the merged SVG to encompass all contained SVGs
        mergedSVG.setAttribute(
            "viewBox",
            `${minX * VIEWBOX_PADDING} ${minY * VIEWBOX_PADDING} ${(maxX - minX) * VIEWBOX_PADDING} ${
                (maxY - minY) * VIEWBOX_PADDING
            }`,
        );

        return mergedSVG;
    };

    const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
    if (!ts.tubeField || !ts.OTL) {
        return document.createElementNS(SVG_NAMESPACE, "svg");
    }

    // getEffectiveShellID is a pure function of `ts`, so compute it once
    // instead of calling it three times below.
    const effectiveShellID = getEffectiveShellID(ts);

    const TUBE_STYLE = "stroke:black; fill:none; stroke-width:1; vector-effect:non-scaling-stroke;";
    const SHELL_STYLE =
        "stroke:black; fill:none; stroke-width:2; vector-effect:non-scaling-stroke;";
    const OTL_STYLE =
        "stroke:black; fill:none; stroke-dasharray:8 4; stroke-width:0.5; vector-effect:non-scaling-stroke;";
    const CROSSHAIRS_STYLE =
        "stroke:black; fill:none; stroke-dasharray:8 4; stroke-width:0.5; vector-effect:non-scaling-stroke;";
    const TUBE_LABEL_STYLE = `stroke:none; font-family:sans-serif; font-size:${(
        ts.tubeOD * 0.28
    ).toFixed(4)}; text-anchor:middle; pointer-events:none;`;

    const tubeFieldSVG = generateSVGCircles(ts.tubeField, ts.tubeOD, TUBE_STYLE, true);
    const shellSVG = generateSVGCircles([{ x: 0, y: 0 }], effectiveShellID, SHELL_STYLE);
    const OTLSVG = generateSVGCircles([{ x: 0, y: 0 }], ts.OTL, OTL_STYLE);
    const crossHairs = generateSVGCenteredCross(effectiveShellID, CROSSHAIRS_STYLE);

    const svgsToMerge = [shellSVG, OTLSVG, tubeFieldSVG, crossHairs];
    if (options?.showTubeLabels) {
        svgsToMerge.push(generateSVGLabels(ts.tubeField, ts.tubeOD, TUBE_LABEL_STYLE));
    }

    const mergedSVG = mergeSVGs(svgsToMerge, VIEWBOX_PADDING_AS_FRACTION);

    mergedSVG.setAttribute("title", "Tubesheet Layout Drawing");
    mergedSVG.setAttribute("aria-label", "Tubesheet Layout Drawing");
    mergedSVG.setAttribute(
        "desc",
        `Shell ID: ${round(effectiveShellID, 2)} mm; OTL: ${round(ts.OTL, 2)} mm; Tube OD: ${
            ts.tubeOD
        } mm; Pitch: ${round((ts.pitchRatio - 1) * ts.tubeOD, 2)}; Pitch Ratio: ${round(
            ts.pitchRatio,
            2,
        )}; Pitch Layout: ${ts.layout}; Number of Tubes: ${ts.numTubes};`,
    );
    mergedSVG.setAttribute("role", "img");
    return mergedSVG;
};
