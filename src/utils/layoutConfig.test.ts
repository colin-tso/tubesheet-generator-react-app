import { describe, it, expect } from "vitest";
import {
    parseLayoutConfig,
    parseLayoutConfigFromSearchParams,
    serializeLayoutConfig,
    encodeLayoutConfigToSearchParams,
    buildShareableURL,
    validateLayoutOption,
    LAYOUT_CONFIG_SCHEMA_VERSION,
} from "./layoutConfig";

// A realistic, fully-valid set of fields, consistent with each other
// (pitchRatio matches tubeOD/tubeClearance) the way a real save always is.
const VALID_FIELDS = {
    tubeOD: 19.05,
    OTLtoShell: 6.35,
    tubeClearance: 4.7625,
    pitchRatio: 1.25,
    minTubes: 50,
    layoutOption: 30,
};

describe("parseLayoutConfig — happy path", () => {
    it("round-trips a fully valid, wrapped export", () => {
        const serialized = serializeLayoutConfig(VALID_FIELDS);
        expect(serialized.schemaVersion).toBe(LAYOUT_CONFIG_SCHEMA_VERSION);

        const { fields, errors } = parseLayoutConfig(serialized);
        expect(errors).toEqual([]);
        expect(fields).toEqual(VALID_FIELDS);
    });

    it("accepts a flat, hand-written object with no wrapper", () => {
        const { fields, errors } = parseLayoutConfig({ tubeOD: 19.05, minTubes: 50 });
        expect(errors).toEqual([]);
        expect(fields.tubeOD).toBe(19.05);
        expect(fields.minTubes).toBe(50);
    });

    it("accepts numeric values given as strings (as URL params always are)", () => {
        const { fields, errors } = parseLayoutConfig({ tubeOD: "19.05", minTubes: "50" });
        expect(errors).toEqual([]);
        expect(fields.tubeOD).toBe(19.05);
        expect(fields.minTubes).toBe(50);
    });

    it("ignores unrecognised keys instead of erroring", () => {
        const { fields, errors } = parseLayoutConfig({
            tubeOD: 19.05,
            someFutureField: "abc",
        });
        expect(errors).toEqual([]);
        expect(fields.tubeOD).toBe(19.05);
        expect((fields as Record<string, unknown>).someFutureField).toBeUndefined();
    });
});

describe("parseLayoutConfig — per-field validation", () => {
    it("rejects a non-finite/garbage value instead of loading NaN", () => {
        const { fields, errors } = parseLayoutConfig({ tubeOD: "not-a-number" });
        expect(fields.tubeOD).toBeUndefined();
        expect(errors.length).toBe(1);
    });

    it("rejects Infinity", () => {
        const { fields, errors } = parseLayoutConfig({ tubeOD: Infinity });
        expect(fields.tubeOD).toBeUndefined();
        expect(errors.length).toBe(1);
    });

    it("enforces the same min rule the live form uses (tubeOD > 0, exclusive)", () => {
        expect(parseLayoutConfig({ tubeOD: 0 }).fields.tubeOD).toBeUndefined();
        expect(parseLayoutConfig({ tubeOD: 0 }).errors.length).toBe(1);
        expect(parseLayoutConfig({ tubeOD: 5 }).fields.tubeOD).toBe(5);
    });

    it("enforces tubeClearance's inclusive minimum of 0", () => {
        expect(parseLayoutConfig({ tubeClearance: 0 }).fields.tubeClearance).toBe(0);
        expect(parseLayoutConfig({ tubeClearance: -1 }).fields.tubeClearance).toBeUndefined();
    });

    it("enforces pitchRatio >= 1", () => {
        expect(parseLayoutConfig({ pitchRatio: 0.9 }).fields.pitchRatio).toBeUndefined();
        expect(parseLayoutConfig({ pitchRatio: 1 }).fields.pitchRatio).toBe(1);
    });

    it("rejects an absurdly large value as a guard against a hostile/corrupt file", () => {
        const { fields, errors } = parseLayoutConfig({ minTubes: 1e9 });
        expect(fields.minTubes).toBeUndefined();
        expect(errors.length).toBe(1);
    });

    it("treats an absent or blank field as simply not provided, not an error", () => {
        const { fields, errors } = parseLayoutConfig({ tubeOD: "" });
        expect(fields.tubeOD).toBeUndefined();
        expect(errors).toEqual([]);
    });
});

describe("parseLayoutConfig — layoutOption", () => {
    it("accepts every value layoutOptionRows defines", () => {
        for (const value of [0, 30, 45, 60, 90]) {
            expect(validateLayoutOption(value).value).toBe(value);
            expect(validateLayoutOption(value).error).toBeUndefined();
        }
    });

    it("rejects a value with no matching layout row", () => {
        const result = validateLayoutOption(999);
        expect(result.value).toBeUndefined();
        expect(result.error).toBeDefined();
    });
});

describe("parseLayoutConfig — cross-field rules", () => {
    it("keeps shellID and drops minTubes when both are present, with a warning", () => {
        const { fields, errors } = parseLayoutConfig({ minTubes: 50, shellID: 200 });
        expect(fields.shellID).toBe(200);
        expect(fields.minTubes).toBeUndefined();
        expect(errors.some((e) => e.includes("shellID"))).toBe(true);
    });

    it("derives tubeClearance from pitchRatio when only pitchRatio is given alongside tubeOD", () => {
        const { fields } = parseLayoutConfig({ tubeOD: 19.05, pitchRatio: 1.25 });
        expect(fields.tubeClearance).toBeCloseTo(4.7625, 4);
    });

    it("derives pitchRatio from tubeClearance when only tubeClearance is given alongside tubeOD", () => {
        const { fields } = parseLayoutConfig({ tubeOD: 19.05, tubeClearance: 4.7625 });
        expect(fields.pitchRatio).toBeCloseTo(1.25, 4);
    });

    it("prefers pitchRatio as the source of truth when both arrive inconsistent with each other", () => {
        // tubeClearance here does NOT match a pitchRatio of 1.25 for this tubeOD;
        // pitchRatio should win and tubeClearance should be recomputed from it.
        const { fields } = parseLayoutConfig({
            tubeOD: 19.05,
            pitchRatio: 1.25,
            tubeClearance: 999,
        });
        expect(fields.pitchRatio).toBe(1.25);
        expect(fields.tubeClearance).toBeCloseTo(4.7625, 4);
    });
});

describe("parseLayoutConfig — malformed input", () => {
    it("rejects a non-object payload outright", () => {
        expect(parseLayoutConfig(null).fields).toEqual({});
        expect(parseLayoutConfig("hello").fields).toEqual({});
        expect(parseLayoutConfig(42).fields).toEqual({});
        expect(parseLayoutConfig([1, 2, 3]).fields).toEqual({});
    });

    it("rejects a boolean or object value for a numeric field", () => {
        const { fields, errors } = parseLayoutConfig({ tubeOD: true });
        expect(fields.tubeOD).toBeUndefined();
        expect(errors.length).toBe(1);
    });
});

describe("URL round-trip", () => {
    it("encodes and re-parses back to the same fields", () => {
        const params = encodeLayoutConfigToSearchParams(VALID_FIELDS);
        const { fields, errors } = parseLayoutConfigFromSearchParams(params);
        expect(errors).toEqual([]);
        expect(fields).toEqual(VALID_FIELDS);
    });

    it("builds a shareable URL containing every provided field", () => {
        const url = buildShareableURL(VALID_FIELDS);
        const parsed = new URL(url);
        expect(parsed.searchParams.get("tubeOD")).toBe("19.05");
        expect(parsed.searchParams.get("layoutOption")).toBe("30");
    });

    it("omits fields that were never provided", () => {
        const url = buildShareableURL({ tubeOD: 19.05 });
        const parsed = new URL(url);
        expect(parsed.searchParams.has("minTubes")).toBe(false);
        expect(parsed.searchParams.has("shellID")).toBe(false);
    });
});
