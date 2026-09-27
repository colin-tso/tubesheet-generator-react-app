import { numericFieldConfigs } from "@/constants/numericFieldConfigs";
import { layoutOptionRows } from "@/constants/layoutOptionRows";
import { utils } from "@/utils/";

// Bumped whenever the saved/shared shape changes in a way old files can't be
// read as-is. Not currently enforced (parseLayoutConfig ignores it and reads
// whatever fields it recognises), but recorded on every export so a future
// migration has something to branch on.
export const LAYOUT_CONFIG_SCHEMA_VERSION = 1;

// Every calculation-input field that can be saved/shared, i.e. everything in
// numericFieldConfigs. layoutOption is handled separately below since it's
// validated against layoutOptionRows rather than a min/minExclusive rule.
export const LAYOUT_CONFIG_FIELD_IDS = [
    "minTubes",
    "tubeOD",
    "OTLtoShell",
    "tubeClearance",
    "pitchRatio",
    "shellID",
] as const;
export type LayoutConfigFieldId = (typeof LAYOUT_CONFIG_FIELD_IDS)[number];

export type LayoutConfigFields = Partial<Record<LayoutConfigFieldId, number>> & {
    layoutOption?: number;
};

export interface LayoutConfigParseResult {
    fields: LayoutConfigFields;
    errors: string[];
}

export interface SerializedLayoutConfig {
    schemaVersion: number;
    generator: string;
    fields: LayoutConfigFields;
}

// Sane ceiling on any single field, independent of the live form's own
// min/minExclusive rules. Typed input can never exceed this in practice, but
// a hand-edited or malicious JSON file/URL can claim any number — an
// unbounded value here would still reach the calculation worker and could
// make it build a pathologically large tube field. This is far above any
// real tubesheet's dimensions or tube count.
const MAX_FIELD_VALUE = 1_000_000;

const validLayoutOptionValues = new Set(layoutOptionRows.map((row) => Number(row.value)));

function fieldConfigFor(id: LayoutConfigFieldId) {
    return numericFieldConfigs.find((cfg) => cfg.id === id);
}

// Validates one raw value (from parsed JSON or a URL param, so `unknown`)
// against the same min/minExclusive rule the live NumericField enforces for
// this field (see numericFieldConfigs.ts), plus the shared upper bound above.
// Returns {} for an absent/blank field -- that's not an error, just nothing to
// load for it.
function validateNumericField(
    id: LayoutConfigFieldId,
    raw: unknown,
): { value?: number; error?: string } {
    if (raw === undefined || raw === null || raw === "") return {};
    if (typeof raw !== "number" && typeof raw !== "string") {
        return { error: `"${id}" must be a number.` };
    }
    if (!utils.isNumber(raw)) {
        return { error: `"${id}" is not a valid number.` };
    }

    const value = utils.stringToNumber(String(raw));
    if (!Number.isFinite(value)) {
        return { error: `"${id}" is not a finite number.` };
    }
    if (Math.abs(value) > MAX_FIELD_VALUE) {
        return { error: `"${id}" is outside the allowed range.` };
    }

    const cfg = fieldConfigFor(id);
    if (cfg?.min !== undefined) {
        const violatesMin = cfg.minExclusive ? value <= cfg.min : value < cfg.min;
        if (violatesMin) {
            return {
                error: `"${id}" must be ${cfg.minExclusive ? "greater than" : "at least"} ${cfg.min}.`,
            };
        }
    }

    return { value };
}

// layoutOption is stored as the numeric value backing each layout row (0 for
// radial, 30/45/60/90 for the angled layouts) -- see layoutOptionRows.ts and
// useLayoutForm's triggerSingleCalculation. Anything else is rejected rather
// than passed through, since it's used to pick a worker code path.
export function validateLayoutOption(raw: unknown): { value?: number; error?: string } {
    if (raw === undefined || raw === null || raw === "") return {};
    if ((typeof raw !== "number" && typeof raw !== "string") || !utils.isNumber(raw)) {
        return { error: `"layoutOption" is not a valid number.` };
    }
    const value = utils.stringToNumber(String(raw));
    if (!validLayoutOptionValues.has(value)) {
        return { error: `"layoutOption" is not a recognised layout option.` };
    }
    return { value };
}

// Accepts either the wrapped shape this app exports ({ fields: {...} }) or a
// flat object with the field names at the top level, so a hand-written JSON
// file works the same as a round-tripped export. Unknown keys are ignored
// rather than rejected, so older/newer schema versions degrade gracefully
// instead of failing outright.
function extractFieldSource(raw: Record<string, unknown>): Record<string, unknown> {
    const { fields } = raw;
    return typeof fields === "object" && fields !== null && !Array.isArray(fields)
        ? (fields as Record<string, unknown>)
        : raw;
}

export function parseLayoutConfig(raw: unknown): LayoutConfigParseResult {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        return { fields: {}, errors: ["Config must be a JSON object."] };
    }

    const source = extractFieldSource(raw as Record<string, unknown>);
    const errors: string[] = [];
    const fields: LayoutConfigFields = {};

    for (const id of LAYOUT_CONFIG_FIELD_IDS) {
        if (!(id in source)) continue;
        const { value, error } = validateNumericField(id, source[id]);
        if (error) errors.push(error);
        else if (value !== undefined) fields[id] = value;
    }

    if ("layoutOption" in source) {
        const { value, error } = validateLayoutOption(source.layoutOption);
        if (error) errors.push(error);
        else if (value !== undefined) fields.layoutOption = value;
    }

    // shellID stands in for minTubes -- see useLayoutForm's requestAllLayoutResults
    // and applyShellID. A live edit can never produce both at once, but a
    // hand-edited file/URL can; keep shellID (the more specific input) and
    // drop minTubes rather than guessing.
    if (fields.shellID !== undefined && fields.minTubes !== undefined) {
        errors.push('Both "minTubes" and "shellID" were provided; using "shellID".');
        delete fields.minTubes;
    }

    // Keep tubeClearance/pitchRatio internally consistent the same way the
    // live paired fields do (see the SET_TUBE_CLEARANCE/SET_PITCH_RATIO cases
    // in useLayoutForm's reducer), with pitchRatio as the source of truth
    // when both arrive alongside tubeOD.
    if (utils.isNumber(fields.tubeOD)) {
        if (fields.pitchRatio !== undefined) {
            const derived = utils.clearanceFromPitchRatio(fields.tubeOD, fields.pitchRatio);
            if (derived !== undefined) fields.tubeClearance = utils.round(derived, 4);
        } else if (fields.tubeClearance !== undefined) {
            const derived = utils.pitchRatioFromClearance(fields.tubeOD, fields.tubeClearance);
            if (derived !== undefined) fields.pitchRatio = utils.round(derived, 4);
        }
    }

    return { fields, errors };
}

// Only ever writes out fields that actually hold a valid number, so a
// half-filled form still produces a loadable (if partial) file/link.
export function serializeLayoutConfig(fields: LayoutConfigFields): SerializedLayoutConfig {
    const clean: LayoutConfigFields = {};
    for (const id of LAYOUT_CONFIG_FIELD_IDS) {
        if (utils.isNumber(fields[id])) clean[id] = fields[id];
    }
    if (utils.isNumber(fields.layoutOption)) clean.layoutOption = fields.layoutOption;

    return {
        schemaVersion: LAYOUT_CONFIG_SCHEMA_VERSION,
        generator: "tubesheet-generator-react-app",
        fields: clean,
    };
}

export function encodeLayoutConfigToSearchParams(fields: LayoutConfigFields): URLSearchParams {
    const params = new URLSearchParams();
    for (const id of LAYOUT_CONFIG_FIELD_IDS) {
        if (utils.isNumber(fields[id])) params.set(id, String(fields[id]));
    }
    if (utils.isNumber(fields.layoutOption)) params.set("layoutOption", String(fields.layoutOption));
    return params;
}

// Preserves the current path and hash (e.g. if the app ever shares a link
// while on a route other than the calculator) and only replaces the query
// string with the encoded fields.
export function buildShareableURL(fields: LayoutConfigFields): string {
    const params = encodeLayoutConfigToSearchParams(fields);
    const { origin, pathname, hash } = window.location;
    const qs = params.toString();
    return `${origin}${pathname}${qs ? `?${qs}` : ""}${hash}`;
}

export function parseLayoutConfigFromSearchParams(params: URLSearchParams): LayoutConfigParseResult {
    const source: Record<string, unknown> = {};
    for (const id of LAYOUT_CONFIG_FIELD_IDS) {
        const value = params.get(id);
        if (value !== null) source[id] = value;
    }
    const layoutOption = params.get("layoutOption");
    if (layoutOption !== null) source.layoutOption = layoutOption;
    return parseLayoutConfig(source);
}
