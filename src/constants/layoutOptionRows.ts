import type { LayoutResults } from "@/hooks/useTubeSheetWorker";
import { TUBE_SHEET_LAYOUTS, type TubeSheetLayout } from "@/plugins/tubesheet-layout-generator";

// Layout options for displaying min ID and tube counts.
export interface LayoutOptionRow {
    key: keyof LayoutResults;
    id: string;
    label: string;
    // Industry name for the pattern, shown as a hover hint beside the glyph.
    name: string;
    value: string;
    required?: boolean;
}

const layoutOptionMeta: Record<TubeSheetLayout, Omit<LayoutOptionRow, "key">> = {
    30: { id: "30deg", label: "30°", name: "Triangular", value: "30", required: true },
    45: { id: "45deg", label: "45°", name: "Rotated square", value: "45" },
    60: { id: "60deg", label: "60°", name: "Rotated triangular", value: "60" },
    90: { id: "90deg", label: "90°", name: "Square", value: "90" },
    radial: { id: "radial", label: "Radial", name: "Radial", value: "0" },
};

export const layoutOptionRows: LayoutOptionRow[] = TUBE_SHEET_LAYOUTS.map((key) => ({
    key,
    ...layoutOptionMeta[key],
}));
