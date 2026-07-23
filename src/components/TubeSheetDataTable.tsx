import { forwardRef } from "react";
import { ITubeSheetData, getEffectiveShellID } from "../plugins/tubesheet-layout-generator";
import { utils } from "../utils/";

export interface TubeSheetDataTableProps {
    data: (ITubeSheetData & { shellID?: number; numTubes?: number }) | null;
    layoutLabel: string;
    requestedTubes?: number;
    visible: boolean;
}

const formatNumber = (
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
    return `${sign}${utils.numberWithCommas(Number(digits))}.${decPart} ${units}`;
};

export const TubeSheetDataTable = forwardRef<HTMLTableElement, TubeSheetDataTableProps>(
    ({ data, layoutLabel, requestedTubes, visible }, ref) => {
        if (!data) return null;

        const shellID = getEffectiveShellID(data);
        const tubePitch =
            utils.isNumber(data.tubeOD) && utils.isNumber(data.pitchRatio)
                ? data.tubeOD * data.pitchRatio
                : undefined;
        const pitchRatio = utils.isNumber(data.pitchRatio) ? data.pitchRatio : undefined;
        const tubesAvailable = data.numTubes ?? undefined;
        const tubesInstalled = utils.isNumber(requestedTubes) ? requestedTubes : tubesAvailable;

        const rows: { label: string; value: string }[] = [
            { label: "Shell ID", value: formatNumber(shellID, 2, "mm") },
            { label: "OTL", value: formatNumber(data.OTL, 2, "mm") },
            { label: "Tube OD", value: formatNumber(data.tubeOD, 2, "mm") },
            { label: "Tube Pitch", value: formatNumber(tubePitch, 2, "mm") },
            { label: "Pitch Ratio", value: formatNumber(pitchRatio, 2) },
            { label: "Tube Layout", value: layoutLabel },
            { label: "Tube Positions Available", value: formatNumber(tubesAvailable, 0) },
            { label: "Tubes", value: formatNumber(tubesInstalled, 0) },
        ];

        return (
            <table ref={ref} className="tubesheet-data-table" hidden={!visible}>
                <caption className="hidden">Tubesheet layout summary</caption>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.label}>
                            <th scope="row" className="noselect">
                                {row.label}
                            </th>
                            <td>{row.value}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    },
);
TubeSheetDataTable.displayName = "TubeSheetDataTable";

export default TubeSheetDataTable;
