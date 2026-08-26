import type { Ref } from "react";
import type { ITubeSheetData } from "@/plugins/tubesheet-layout-generator";
import { buildTubeSheetSummaryRows } from "@/utils/tubeSheetSummaryRows";

export interface TubeSheetDataTableProps {
    data: (ITubeSheetData & { numTubes?: number }) | null;
    layoutLabel: string;
    requestedTubes?: number;
    visible: boolean;
    ref?: Ref<HTMLTableElement>;
}

export function TubeSheetDataTable({
    data,
    layoutLabel,
    requestedTubes,
    visible,
    ref,
}: TubeSheetDataTableProps) {
    if (!data) return null;

    const rows = buildTubeSheetSummaryRows(data, layoutLabel, requestedTubes);

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
}

export default TubeSheetDataTable;
