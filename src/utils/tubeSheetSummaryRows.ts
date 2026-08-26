import { getEffectiveShellID } from "@/plugins/tubesheet-layout-generator";
import type { ITubeSheetData } from "@/plugins/tubesheet-layout-generator";
import { utils } from "@/utils/";

export interface TubeSheetSummaryRow {
    label: string;
    value: string;
}

export const formatSummaryNumber = (
    value: number | null | undefined,
    decimals: number,
    units: string = "",
): string => {
    if (!utils.isNumber(value)) return "—";
    if (decimals === 0) return utils.numberWithCommas(Math.round(value as number));

    const rounded = utils.round(value as number, 2).toFixed(2);
    const [intPart, decPart] = rounded.split(".");
    const sign = intPart.startsWith("-") ? "-" : "";
    const digits = sign ? intPart.slice(1) : intPart;
    return units
        ? `${sign}${utils.numberWithCommas(Number(digits))}.${decPart} ${units}`
        : `${sign}${utils.numberWithCommas(Number(digits))}.${decPart}`;
};

// Builds the Shell ID / OTL / Tube OD / ... summary rows for a committed
// layout result. Shared by TubeSheetDataTable (on-screen) and pdfExport (PDF
// download) so both render identical figures from identical logic.
export function buildTubeSheetSummaryRows(
    data: (ITubeSheetData & { numTubes?: number }) | null,
    layoutLabel: string,
    requestedTubes: number | undefined,
): TubeSheetSummaryRow[] {
    if (!data) return [];

    const shellID = getEffectiveShellID(data);
    const tubePitch =
        utils.isNumber(data.tubeOD) && utils.isNumber(data.pitchRatio)
            ? data.tubeOD * data.pitchRatio
            : undefined;
    const pitchRatio = utils.isNumber(data.pitchRatio) ? data.pitchRatio : undefined;
    const tubesAvailable = data.numTubes ?? undefined;
    const tubesInstalled = utils.isNumber(requestedTubes) ? requestedTubes : tubesAvailable;

    return [
        { label: "Shell ID", value: formatSummaryNumber(shellID, 2, "mm") },
        { label: "OTL", value: formatSummaryNumber(data.OTL, 2, "mm") },
        { label: "Tube OD", value: formatSummaryNumber(data.tubeOD, 2, "mm") },
        { label: "Tube Pitch", value: formatSummaryNumber(tubePitch, 2, "mm") },
        { label: "Pitch Ratio", value: formatSummaryNumber(pitchRatio, 2) },
        { label: "Tube Layout", value: layoutLabel },
        { label: "Tube Positions Available", value: formatSummaryNumber(tubesAvailable, 0) },
        { label: "Tubes", value: formatSummaryNumber(tubesInstalled, 0) },
    ];
}
