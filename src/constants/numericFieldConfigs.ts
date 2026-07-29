import type { NumericFieldProps } from "../components/NumericField";

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
};

export const numericFieldConfigs: NumericFieldConfig[] = [
    {
        id: "minTubes",
        label: "Minimum number of tubes",
        placeholder: "e.g. 100",
        scale: 0,
        inputMode: "numeric",
        required: true,
        min: 0,
        minExclusive: true,
        group: "Tube geometry",
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
        group: "Tube geometry",
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
        group: "Shell constraints",
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
        group: "Shell constraints",
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
        rowHint: "Set either value – the other is calculated automatically.",
        group: "Shell constraints",
    },
    {
        id: "shellID",
        label: "Custom shell ID",
        placeholder: "Optional override",
        scale: 2,
        inputMode: "decimal",
        units: "mm",
        group: "Overrides",
    },
];
