import type { LayoutResults } from "../hooks/useTubeSheetWorker";

// Layout options for displaying min ID and tube counts.
export interface LayoutOptionRow {
    key: keyof LayoutResults;
    id: string;
    label: string;
    value: string;
    required?: boolean;
}

export const layoutOptionRows: LayoutOptionRow[] = [
    { key: 30, id: "30deg", label: "30°", value: "30", required: true },
    { key: 45, id: "45deg", label: "45°", value: "45" },
    { key: 60, id: "60deg", label: "60°", value: "60" },
    { key: 90, id: "90deg", label: "90°", value: "90" },
    { key: "radial", id: "radial", label: "Radial", value: "0" },
];
