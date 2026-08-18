import type { NumericFieldProps } from "@/components/NumericField";
import type { PairPreviewContext } from "./pairPreviewConfigs";
import { utils } from "@/utils";

export type NumericFieldConfig = Omit<NumericFieldProps, "value" | "pairedValue"> & {
    // Fields sharing the same "row" id are rendered side-by-side as a pair.
    row?: string;
    // Id of another field that satisfies this field's "required" rule once it
    // has a value, for fields where only one of a pair is actually needed.
    pairedWith?: string;
    // Shown once beneath a paired row, explaining the either/or relationship.
    rowHint?: string;
    // Fields sharing the same "group" label are rendered together inside one
    // titled card, so related inputs read as a set rather than a flat list.
    group?: string;
    // Overrides the static min/minExclusive once enough sibling values are
    // known to compute a tighter, physically-derived minimum.
    dynamicMin?: (ctx: PairPreviewContext) => { min: number; minExclusive: boolean } | undefined;
};

export const numericFieldConfigs: NumericFieldConfig[] = [
    {
        id: "minTubes",
        label: "Min # of tubes",
        placeholder: "e.g. 100",
        scale: 0,
        inputMode: "numeric",
        required: true,
        min: 0,
        minExclusive: true,
        row: "minTubes-shellID",
        pairedWith: "shellID",
        pairedLabel: "Shell ID",
        group: "Design Constraint",
    },
    {
        id: "shellID",
        label: "Shell ID",
        placeholder: "e.g. 500",
        scale: 2,
        inputMode: "decimal",
        required: true,
        units: "mm",
        min: 0,
        minExclusive: true,
        row: "minTubes-shellID",
        pairedWith: "minTubes",
        pairedLabel: "Min # of tubes",
        group: "Design Constraint",
        // Physical minimum is tubeOD + OTLtoShell once both are known.
        dynamicMin: (ctx) =>
            utils.isNumber(ctx.tubeOD) && utils.isNumber(ctx.OTLtoShell)
                ? { min: utils.round(ctx.tubeOD + ctx.OTLtoShell, 2), minExclusive: false }
                : undefined,
    },
    {
        id: "tubeOD",
        label: "Tube OD",
        placeholder: "> 0",
        scale: 2,
        inputMode: "decimal",
        required: true,
        units: "mm",
        min: 0,
        minExclusive: true,
        group: "Layout Parameters",
    },
    {
        id: "OTLtoShell",
        label: "OTL to shell diametrical clearance",
        placeholder: "Shell ID – OTL, ≥ 0",
        scale: 2,
        inputMode: "decimal",
        required: true,
        units: "mm",
        min: 0,
        group: "Layout Parameters",
    },
    {
        id: "tubeClearance",
        label: "Tube clearance",
        placeholder: "≥ 0",
        scale: 2,
        inputMode: "decimal",
        required: true,
        units: "mm",
        min: 0,
        row: "clearance-pitch",
        pairedWith: "pitchRatio",
        pairedLabel: "pitch ratio",
        group: "Tube Spacing",
    },
    {
        id: "pitchRatio",
        label: "Pitch ratio",
        placeholder: "≥ 1",
        scale: 2,
        inputMode: "decimal",
        required: true,
        min: 1,
        row: "clearance-pitch",
        pairedWith: "tubeClearance",
        pairedLabel: "tube clearance",
        group: "Tube Spacing",
    },
];
