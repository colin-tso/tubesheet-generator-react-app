import type { ITubeSheetData } from "@/plugins/tubesheet-layout-generator";

export const TUBE_COORDINATES_CSV_HEADER = [
    "Tube_Index",
    "X_mm",
    "Y_mm",
    "Radial_Distance_mm",
    "Diameter_mm",
] as const;

const DECIMALS = 3;

// Fixed-point text for a coordinate, with "-0.000" normalised to "0.000" so a
// tube sitting on an axis doesn't come out signed in CAM/spreadsheet tools.
const fmt = (value: number): string => {
    const text = value.toFixed(DECIMALS);
    return Number(text) === 0 ? (0).toFixed(DECIMALS) : text;
};

/**
 * Builds a CSV table of tube-centre coordinates for machine-shop / CNC drilling
 * and CMM/QA use.
 *
 * - `Tube_Index` is the 1-based tube number, i.e. the same number drawn by the
 *   "Tube Labels" toggle and carried on each tube's `id` in the SVG.
 * - `X_mm` / `Y_mm` are tube-centre coordinates in mm from the shell centre,
 *   with Y pointing up. The SVG is Y-down, so Y is negated here, exactly as the
 *   DXF export does, which keeps this table in step with the DXF drawing.
 * - `Radial_Distance_mm` is each tube centre's radial distance from the shell centre
 *   (not the tube's own radius, which is half of `Diameter_mm`).
 * - `Diameter_mm` is the tube OD.
 *
 * Every position in the generated tube field is listed (all the tubes drawn),
 * not only the requested minimum. Rows end with CRLF per RFC 4180. Returns
 * `null` when there is no tube field to export.
 */
export function buildTubeCoordinatesCsv(
    data: Pick<ITubeSheetData, "tubeField" | "tubeOD"> | null,
): string | null {
    if (!data?.tubeField || data.tubeField.length === 0) return null;

    const diameter = fmt(data.tubeOD);
    const rows: string[] = [TUBE_COORDINATES_CSV_HEADER.join(",")];
    data.tubeField.forEach(({ x, y }, i) => {
        rows.push([i + 1, fmt(x), fmt(-y), fmt(Math.hypot(x, y)), diameter].join(","));
    });
    return rows.join("\r\n") + "\r\n";
}

export function buildTubeCoordinatesCsvBlob(
    data: Pick<ITubeSheetData, "tubeField" | "tubeOD"> | null,
): Blob | null {
    const csv = buildTubeCoordinatesCsv(data);
    return csv === null ? null : new Blob([csv], { type: "text/csv;charset=utf-8" });
}
