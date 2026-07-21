import { ITubeSheetData, getEffectiveShellID } from "../plugins/tubesheet-layout-generator";
import { utils } from "../utils/";

export interface TubeSheetDataTableProps {
    data: (ITubeSheetData & { shellID?: number; numTubes?: number }) | null;
    layoutLabel: string;
    requestedTubes?: number;
    visible: boolean;
}

const formatDimension = (value: number | null | undefined): string => {
    if (!utils.isNumber(value)) return "—";
    const rounded = utils.round(value as number, 2).toFixed(2);
    const [intPart, decPart] = rounded.split(".");
    const sign = intPart.startsWith("-") ? "-" : "";
    const digits = sign ? intPart.slice(1) : intPart;
    return `${sign}${utils.numberWithCommas(Number(digits))}.${decPart} mm`;
};

const formatCount = (value: number | null | undefined): string => {
    if (!utils.isNumber(value)) return "—";
    return utils.numberWithCommas(Math.round(value as number));
};

export const TubeSheetDataTable = ({
    data,
    layoutLabel,
    requestedTubes,
    visible,
}: TubeSheetDataTableProps) => {
    if (!data) return null;

    const shellID = getEffectiveShellID(data);
    const tubePitch =
        utils.isNumber(data.tubeOD) && utils.isNumber(data.pitchRatio)
            ? data.tubeOD * data.pitchRatio
            : undefined;
    const tubesAvailable = data.numTubes ?? undefined;
    const tubesInstalled = utils.isNumber(requestedTubes) ? requestedTubes : tubesAvailable;

    const rows: { label: string; value: string }[] = [
        { label: "Shell ID", value: formatDimension(shellID) },
        { label: "OTL", value: formatDimension(data.OTL) },
        { label: "Tube OD", value: formatDimension(data.tubeOD) },
        { label: "Tube Pitch", value: formatDimension(tubePitch) },
        { label: "Tube Layout", value: layoutLabel },
        { label: "Tube Positions Available", value: formatCount(tubesAvailable) },
        { label: "Tubes", value: formatCount(tubesInstalled) },
    ];

    return (
        <table className="tubesheet-data-table noselect" hidden={!visible}>
            <caption className="hidden">Tubesheet layout summary</caption>
            <tbody>
                {rows.map((row) => (
                    <tr key={row.label}>
                        <th scope="row">{row.label}</th>
                        <td>{row.value}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

export default TubeSheetDataTable;
