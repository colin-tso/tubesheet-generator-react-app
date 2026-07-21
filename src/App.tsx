import { useRef, useState } from "react";
import packageJson from "../package.json";
import GitHubButton from "react-github-btn";
import {
    TubeSheet,
    generateTubeSheetSVG,
    ITubeSheetData,
} from "./plugins/tubesheet-layout-generator";
import { TubeSheetSVG } from "./components/TubeSheetSVG";
import { TubeSheetDataTable } from "./components/TubeSheetDataTable";
import { NumericField, NumericFieldProps } from "./components/NumericField";
import { utils } from "./utils/";
import ThemeToggle from "./components/DarkmodeToggle";
import { ContextMenu, ContextMenuItem } from "./components/context-menu";
import StarIcon from "./assets/star.svg?react";
import TableIcon from "./assets/table-icon.svg?react";
import GridIcon from "./assets/grid-icon.svg?react";
import SaveIcon from "./assets/save-icon.svg?react";
import CopyIcon from "./assets/copy-icon.svg?react";
import { useTubeSheetWorker, LayoutResults } from "./hooks/useTubeSheetWorker";
import { useLayoutForm } from "./hooks/useLayoutForm";
import { useSvgExportActions } from "./hooks/useSvgExportActions";
import { useContextMenu } from "./hooks/useContextMenu";

const emptyTubeSheet = new TubeSheet(0, 100, 1, 30, undefined, 100);
const emptyData: ITubeSheetData = {
    tubeField: emptyTubeSheet.tubeField,
    OTL: emptyTubeSheet.OTL,
    shellID: emptyTubeSheet.shellID,
    minID: emptyTubeSheet.minID,
    tubeOD: emptyTubeSheet.tubeOD,
    pitchRatio: emptyTubeSheet.pitchRatio,
    layout: emptyTubeSheet.layout,
    numTubes: emptyTubeSheet.numTubes,
};
const placeholderSVG = generateTubeSheetSVG(emptyData);

// Layout options for displaying min ID and tube counts.
const layoutOptionRows: {
    key: keyof LayoutResults;
    id: string;
    label: string;
    value: string;
    required?: boolean;
}[] = [
    { key: 30, id: "30deg", label: "30°", value: "30", required: true },
    { key: 45, id: "45deg", label: "45°", value: "45" },
    { key: 60, id: "60deg", label: "60°", value: "60" },
    { key: 90, id: "90deg", label: "90°", value: "90" },
    { key: "radial", id: "radial", label: "Radial", value: "0" },
];

const App = () => {
    // Worker lifecycle, calculation results, loading/error/status state.
    const {
        layoutResults,
        drawingSVG,
        lastSingleResult,
        isCalculating,
        showLoadingBadge,
        calcError,
        announcement,
        onDrawingRendered,
        postCalculateSingle,
        postCalculateAll,
    } = useTubeSheetWorker(placeholderSVG);

    // All calculation-input field state, validation, and input handlers.
    const {
        minTubes,
        tubeOD,
        OTLtoShell,
        tubeClearance,
        pitchRatio,
        shellID,
        actualTubes,
        layoutInputsDefined,
        layoutOptionSelected,
        onAcceptEmpty,
        onBlur,
        onKeyDown,
        onLayoutOptionChange,
        formOnSubmitHandler,
        inputOnSubmitHandler,
    } = useLayoutForm({ lastSingleResult, postCalculateSingle, postCalculateAll });

    // Copy-to-clipboard / download-as-file actions for the drawing.
    const { copyState, downloadSVG, copySVG } = useSvgExportActions(drawingSVG);

    // Show/hide grid state
    const [showGrid, setShowGrid] = useState<boolean>(true);

    // Show/hide table state
    const [showTable, setShowTable] = useState<boolean>(true);

    // Input fields
    const numericFieldConfigs: NumericFieldProps[] = [
        {
            id: "minTubes",
            label: "Minimum number of tubes",
            placeholder: "e.g. 100",
            scale: 0,
            inputMode: "numeric",
            value: minTubes,
            required: true,
        },
        {
            id: "tubeOD",
            label: "Tube OD",
            placeholder: "> 0",
            scale: 2,
            inputMode: "decimal",
            value: tubeOD,
            required: true,
            units: "mm",
        },
        {
            id: "OTLtoShell",
            label: "OTL to shell diametrical clearance",
            placeholder: "Shell ID – OTL, ≥ 0",
            scale: 2,
            inputMode: "decimal",
            value: OTLtoShell,
            required: true,
            units: "mm",
        },
        {
            id: "tubeClearance",
            label: "Tube clearance",
            placeholder: "≥ 0",
            scale: 2,
            inputMode: "decimal",
            value: tubeClearance,
            required: true,
            units: "mm",
        },
        {
            id: "pitchRatio",
            label: "Pitch ratio",
            placeholder: "≥ 1",
            scale: 2,
            inputMode: "decimal",
            value: pitchRatio,
            required: true,
        },
        {
            id: "shellID",
            label: "Custom shell ID",
            placeholder: "Optional override",
            scale: 2,
            inputMode: "decimal",
            value: shellID,
            units: "mm",
        },
    ];

    // Context menu
    const containerRef = useRef<HTMLDivElement>(null);
    const {
        contextMenuPos,
        contextMenuAnimationState,
        openContextMenu,
        requestClose,
        onAnimationEnd,
    } = useContextMenu(containerRef);

    // Drawing table
    const drawingTableLabel =
        layoutOptionRows.find((row) => row.key === lastSingleResult?.layout)?.label ?? "—";
    const drawingTableRequestedTubes = utils.isNumber(shellID) ? undefined : minTubes;

    const definedMinIDs = layoutOptionRows
        .map((row) => layoutResults[row.key]?.minID)
        .filter((v): v is number => utils.isNumber(v));
    const minIDFloor = definedMinIDs.length ? Math.min(...definedMinIDs) : undefined;
    const minIDCeiling = definedMinIDs.length ? Math.max(...definedMinIDs) : undefined;

    // The shell ID basis of the last completed calculation
    const layoutResultsUseCustomShellID = layoutOptionRows.some((row) =>
        utils.isNumber(layoutResults[row.key]?.shellID),
    );

    // Convert minID to bar width percent (symlog scale, min 12%).
    const minIDBarLogPercent = (value: number | undefined) => {
        if (!utils.isNumber(value) || minIDFloor === undefined || minIDCeiling === undefined) {
            return 0;
        }
        if (minIDCeiling === minIDFloor) {
            return 100;
        }
        const c = 150;
        const logRatio =
            utils.symlog(value - minIDFloor, c) / utils.symlog(minIDCeiling - minIDFloor, c);
        return Math.max(12, 12 + logRatio * 88);
    };

    const handleContextMenuCopyAction = () => {
        copySVG();
        requestClose(); // Initiates the safe unmount fade out
    };
    const handleContextMenuSaveAction = () => {
        downloadSVG();
        requestClose(); // Initiates the safe unmount fade out
    };
    const menuConfig: ContextMenuItem[] = [
        { label: "Copy Image", icon: <CopyIcon />, onClick: () => handleContextMenuCopyAction() },
        { label: "", isDivider: true, onClick: () => {} },
        { label: "Save Image", icon: <SaveIcon />, onClick: () => handleContextMenuSaveAction() },
    ];

    // JSX return
    return (
        <div className="row-pane">
            <form
                className={`column-pane left${showGrid ? "" : " grid-hidden"}`}
                onSubmit={formOnSubmitHandler}
            >
                <div className="title-block">
                    <div>
                        <span className="eyebrow">Calculator & Visualiser for</span>
                        <h1>
                            Tubesheet Layouts
                            <small className="version-text">v{packageJson.version}</small>
                            <small>by Colin Tso</small>
                        </h1>
                    </div>
                    <ThemeToggle />
                </div>
                <hr />
                <div className="form-scroll">
                    <div className="section">
                        <h2>Calculation Inputs</h2>
                        {numericFieldConfigs.map((cfg) => (
                            <NumericField
                                key={cfg.id}
                                {...cfg}
                                readOnly={cfg.calculated || isCalculating}
                                onBlur={cfg.calculated ? undefined : onBlur}
                                onKeyDown={cfg.calculated ? undefined : onKeyDown}
                                onAccept={
                                    cfg.calculated
                                        ? undefined
                                        : (value) => onAcceptEmpty(value, cfg.id)
                                }
                                onSubmit={cfg.calculated ? undefined : inputOnSubmitHandler}
                            />
                        ))}
                    </div>

                    <div className="divider" />

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
                            {layoutOptionRows.map(({ key, id, label, value, required }) => {
                                // Hide stale values while calculating
                                const result = showLoadingBadge ? undefined : layoutResults[key];
                                const minIDValue =
                                    result && result.minID !== null
                                        ? (result.minID as number)
                                        : undefined;

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
                                                    <StarIcon
                                                        width="10"
                                                        height="10"
                                                        aria-hidden="true"
                                                    />
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
                                                    width: `${minIDBarLogPercent(minIDValue)}%`,
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
                                                    utils.numFormat3SigFigs(
                                                        result.numTubes as number,
                                                    )
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

                    {/* Disabled while a calculation is in flight */}
                    <button
                        type="submit"
                        className="generate-button"
                        disabled={!layoutInputsDefined || !layoutOptionSelected || isCalculating}
                    >
                        Regenerate Drawing
                    </button>
                </div>

                <div className="form-footer">
                    <footer>
                        <GitHubButton
                            href="https://github.com/colin-tso/tubesheet-generator-react-app"
                            data-color-scheme="light"
                            data-size="large"
                            aria-label=" View this repo on GitHub"
                        >
                            View this repo on GitHub
                        </GitHubButton>
                        <br />
                        Released under a GPL 3.0 license.{" "}
                        <a
                            href="https://www.gnu.org/licenses/gpl-3.0.en.html"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <br />
                            Find out more here.
                        </a>
                    </footer>
                </div>
            </form>
            <div className="column-pane right">
                <div
                    className={`viewport ${showGrid ? "" : "grid-hidden"}${
                        showTable && lastSingleResult ? " has-table" : ""
                    }`}
                    ref={containerRef}
                    onContextMenu={openContextMenu}
                >
                    {contextMenuAnimationState !== "idle" && (
                        <ContextMenu
                            position={contextMenuPos}
                            parentRef={containerRef}
                            items={menuConfig} // Pass layout data array down
                            animationState={
                                contextMenuAnimationState === "fading-in"
                                    ? "fading-in"
                                    : "fading-out"
                            }
                            onAnimationEnd={onAnimationEnd}
                            onRequestClose={requestClose}
                        />
                    )}
                    <span className="viewport-label noselect">Layout Preview</span>
                    {calcError ? (
                        <span className="loading-overlay error visible noselect" aria-hidden="true">
                            Calculation failed
                        </span>
                    ) : (
                        <span
                            className={`loading-overlay noselect${showLoadingBadge ? " visible" : ""}`}
                            aria-hidden="true"
                        >
                            Calculating Layout
                            <span className="loading-dots" aria-hidden="true">
                                <span />
                                <span />
                                <span />
                            </span>
                        </span>
                    )}
                    {/* Calculating/updated/error status for screen readers */}
                    <span className="hidden" role="status" aria-live="polite">
                        {announcement}
                    </span>
                    <span className="reg-tl" aria-hidden="true" />
                    <span className="reg-tr" aria-hidden="true" />
                    <span className="reg-bl" aria-hidden="true" />
                    <span className="reg-br" aria-hidden="true" />
                    <div className="viewport-options">
                        <button
                            type="button"
                            className={`table-toggle ${showTable ? "active" : ""}`}
                            onClick={() => setShowTable((v) => !v)}
                            aria-pressed={showTable}
                            title={showTable ? "Hide Table" : "Show Table"}
                        >
                            <TableIcon width="13" height="13" aria-hidden="true" />
                            Table
                        </button>
                        <button
                            type="button"
                            className={`grid-toggle ${showGrid ? "active" : ""}`}
                            onClick={() => setShowGrid((v) => !v)}
                            aria-pressed={showGrid}
                            title={showGrid ? "Hide Grid" : "Show Grid"}
                        >
                            <GridIcon width="13" height="13" aria-hidden="true" />
                            Grid
                        </button>
                    </div>
                    <TubeSheetSVG
                        src={drawingSVG}
                        className="tubesheet-svg"
                        onRendered={onDrawingRendered}
                    />
                    <TubeSheetDataTable
                        data={lastSingleResult}
                        layoutLabel={drawingTableLabel}
                        requestedTubes={drawingTableRequestedTubes}
                        visible={showTable}
                    />
                    <div className="viewport-actions" hidden={drawingSVG === placeholderSVG}>
                        <button className="copy-button" onClick={copySVG} type="button">
                            <CopyIcon width="15" height="15" aria-hidden="true" />
                            {copyState === "copied"
                                ? "Copied!"
                                : copyState === "error"
                                  ? "Copy failed"
                                  : copyState === "unsupported"
                                    ? "Copy unsupported"
                                    : "Copy Image"}
                        </button>
                        <button className="save-button" onClick={downloadSVG} type="button">
                            <SaveIcon width="15" height="15" aria-hidden="true" />
                            Save Image
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default App;
