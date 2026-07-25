import type { NumericFieldProps } from "../components/NumericField";

export type NumericFieldConfig = Omit<NumericFieldProps, "value">;

export const numericFieldConfigs: NumericFieldConfig[] = [
    {
        id: "minTubes",
        label: "Minimum number of tubes",
        placeholder: "e.g. 100",
        scale: 0,
        inputMode: "numeric",
        required: true,
    },
    {
        id: "tubeOD",
        label: "Tube OD",
        placeholder: "> 0",
        scale: 2,
        inputMode: "decimal",
        required: true,
        units: "mm",
    },
    {
        id: "OTLtoShell",
        label: "OTL to shell diametrical clearance",
        placeholder: "Shell ID – OTL, ≥ 0",
        scale: 2,
        inputMode: "decimal",
        required: true,
        units: "mm",
    },
    {
        id: "tubeClearance",
        label: "Tube clearance",
        placeholder: "≥ 0",
        scale: 2,
        inputMode: "decimal",
        required: true,
        units: "mm",
    },
    {
        id: "pitchRatio",
        label: "Pitch ratio",
        placeholder: "≥ 1",
        scale: 2,
        inputMode: "decimal",
        required: true,
    },
    {
        id: "shellID",
        label: "Custom shell ID",
        placeholder: "Optional override",
        scale: 2,
        inputMode: "decimal",
        units: "mm",
    },
];
