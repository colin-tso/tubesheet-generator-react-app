import type { ChangeEvent } from "react";
import { utils } from "../utils";
import type { LayoutResults } from "../hooks/useTubeSheetWorker";
import type { LayoutOptionRow } from "../constants/layoutOptionRows";
import StarIcon from "../assets/star.svg?react";

interface LayoutOptionsListProps {
    rows: LayoutOptionRow[];
    layoutResults: LayoutResults;
    showLoadingBadge: boolean;
    onLayoutOptionChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

// Convert minID to bar width percent (symlog scale, min 12%).
function minIDBarLogPercent(
    value: number | undefined,
    floor: number | undefined,
    ceiling: number | undefined,
) {
    if (!utils.isNumber(value) || floor === undefined || ceiling === undefined) {
        return 0;
    }
    if (ceiling === floor) {
        return 100;
    }
    const c = 150;
    const logRatio = utils.symlog(value - floor, c) / utils.symlog(ceiling - floor, c);
    return Math.max(12, 12 + logRatio * 88);
}

export function LayoutOptionsList({
    rows,
    layoutResults,
    showLoadingBadge,
    onLayoutOptionChange,
}: LayoutOptionsListProps) {
    // The shell ID basis of the last completed calculation
    const layoutResultsUseCustomShellID = rows.some((row) =>
        utils.isNumber(layoutResults[row.key]?.shellID),
    );

    const definedMinIDs = rows
        .map((row) => layoutResults[row.key]?.minID)
        .filter((v): v is number => utils.isNumber(v));
    const minIDFloor = definedMinIDs.length ? Math.min(...definedMinIDs) : undefined;
    const minIDCeiling = definedMinIDs.length ? Math.max(...definedMinIDs) : undefined;

    return (
        <div className="section">
            <h2>Layout Options</h2>
            <div className="layout-list-header" aria-hidden="true">
                <span />
                <span />
                <span />
                <span className="header-stats">
                    <span className="header-minid">
                        {layoutResultsUseCustomShellID ? "Min " : ""}ID (mm)
                    </span>
                    <span className="header-tubes">Tubes</span>
                </span>
            </div>
            <div
                className="layout-list"
                role="radiogroup"
                aria-label="Tube layout angle"
                aria-busy={showLoadingBadge}
            >
                {rows.map(({ key, id, label, value, required }) => {
                    // Hide stale values while calculating
                    const result = showLoadingBadge ? undefined : layoutResults[key];
                    const minIDValue =
                        result && result.minID !== null ? (result.minID as number) : undefined;

                    return (
                        <label
                            key={id}
                            className={`layout-row ${result?.preferred ? "preferred" : ""}`}
                            htmlFor={id}
                        >
                            <input
                                type="radio"
                                id={id}
                                name="layoutOption"
                                value={value}
                                onChange={onLayoutOptionChange}
                                disabled={showLoadingBadge}
                                required={required}
                            />
                            <span className="row-angle">
                                {label}
                                {result?.preferred && (
                                    <span
                                        className="row-badge"
                                        title="Lowest minimum shell ID among the calculated layouts"
                                    >
                                        <StarIcon width="10" height="10" aria-hidden="true" />
                                        <span className="hidden">
                                            Preferred layout (lowest minimum shell ID)
                                        </span>
                                    </span>
                                )}
                            </span>
                            <span className="row-bar-track" aria-hidden="true">
                                <span
                                    className="row-bar-fill"
                                    style={{
                                        width: `${minIDBarLogPercent(minIDValue, minIDFloor, minIDCeiling)}%`,
                                    }}
                                />
                            </span>
                            <span className="row-stats">
                                <span className="row-minid">
                                    {minIDValue !== undefined ? (
                                        utils.numFormat3SigFigs(minIDValue)
                                    ) : (
                                        <span className="empty">—</span>
                                    )}
                                </span>
                                <span className="row-tubes">
                                    {result ? (
                                        utils.numFormat3SigFigs(result.numTubes as number)
                                    ) : (
                                        <span className="empty">—</span>
                                    )}{" "}
                                </span>
                            </span>
                        </label>
                    );
                })}
            </div>
        </div>
    );
}
