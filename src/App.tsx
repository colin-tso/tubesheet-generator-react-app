import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import packageJson from "../package.json";
import GitHubButton from "react-github-btn";
import {
    TubeSheet,
    generateTubeSheetSVG,
    ITubeSheetData,
    DRAWING_SAFE_CONTENT_RADIUS_FRACTION,
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

// Must match .viewport's base padding in index.css (desktop breakpoint).
const VIEWPORT_BASE_PADDING = 48;

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

    // Show/hide grid state (persisted)
    const [showGrid, setShowGrid] = useState<boolean>(() => {
        const stored = window.localStorage.getItem("view-options.showGrid");
        return stored === null ? true : stored === "true";
    });

    // Show/hide table state (persisted)
    const [showTable, setShowTable] = useState<boolean>(() => {
        const stored = window.localStorage.getItem("view-options.showTable");
        return stored === null ? true : stored === "true";
    });

    useEffect(() => {
        window.localStorage.setItem("view-options.showGrid", String(showGrid));
    }, [showGrid]);

    useEffect(() => {
        window.localStorage.setItem("view-options.showTable", String(showTable));
    }, [showTable]);

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

    // Keep the "Layout Preview" label centered while the option buttons move
    // from a row to a stacked column only when their actual rendered width
    // would overlap the label, using real measured child widths instead of a
    // fixed viewport threshold.
    const labelRef = useRef<HTMLSpanElement>(null);
    const optionsRef = useRef<HTMLDivElement>(null);
    const [optionsStacked, setOptionsStacked] = useState(false);
    useLayoutEffect(() => {
        const labelEl = labelRef.current;
        const optionsEl = optionsRef.current;
        if (!labelEl || !optionsEl) {
            return;
        }

        const SAFETY_MARGIN = 12; //px

        const recompute = () => {
            const labelRect = labelEl.getBoundingClientRect();
            const optionsRect = optionsEl.getBoundingClientRect();
            const buttonRects = Array.from(optionsEl.children)
                .map((child) => child.getBoundingClientRect())
                .filter((rect) => rect.width > 0 || rect.height > 0);

            if (labelRect.width <= 0 || optionsRect.width <= 0 || buttonRects.length === 0) {
                return;
            }

            // Use --options-row-gap for row spacing even when stacked, so the
            // gap stays correct without duplicating the value. see
            // .viewport-options in index.css
            const rowGap =
                parseFloat(getComputedStyle(optionsEl).getPropertyValue("--options-row-gap")) || 0;

            const buttonsWidth = buttonRects.reduce((sum, rect) => sum + rect.width, 0);
            const rowWidth = buttonsWidth + rowGap * (buttonRects.length - 1);
            const rowLeftEdge = optionsRect.right - rowWidth;

            setOptionsStacked(rowLeftEdge < labelRect.right + SAFETY_MARGIN);
        };

        recompute();

        const observer =
            typeof ResizeObserver === "undefined" ? null : new ResizeObserver(recompute);
        observer?.observe(labelEl);
        observer?.observe(optionsEl);
        Array.from(optionsEl.children).forEach((child) => observer?.observe(child));
        window.addEventListener("resize", recompute);
        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", recompute);
        };
    }, []);

    // Reserve table space only if it overlaps the drawing. The drawing is a
    // circle in a centered square, so corners are normally empty.
    const footerRef = useRef<HTMLDivElement>(null);
    const actionsRef = useRef<HTMLDivElement>(null);
    const [tableEl, setTableEl] = useState<HTMLTableElement | null>(null);
    const [actionsStacked, setActionsStacked] = useState(false);
    const [viewportBottomReserve, setViewportBottomReserve] = useState(VIEWPORT_BASE_PADDING);
    // Track sticky-reserve state. Reserve space for the footer as the viewport
    // shrinks, rather than re-testing clearance every resize. Release when the
    // viewport widens past its initial engagement or the table stops showing.
    const reservedRef = useRef(false);
    const reservedAtWidthRef = useRef(0);
    const RESERVE_RELEASE_BUFFER = 24; // px the viewport must widen past the engage point before releasing
    useLayoutEffect(() => {
        const viewportEl = containerRef.current;
        const footerEl = footerRef.current;
        const actionsEl = actionsRef.current;
        if (!viewportEl || !footerEl || !actionsEl) {
            return;
        }

        const SAFETY_MARGIN = 12; //px

        // Fresh data or table visibility means a fresh evaluation baseline;
        // stickiness (see below) should only persist across pure resizing.
        reservedRef.current = false;

        const recompute = () => {
            const viewportRect = viewportEl.getBoundingClientRect();
            const actionsRect = actionsEl?.getBoundingClientRect();
            const buttonRects = Array.from(actionsEl.children)
                .map((child) => child.getBoundingClientRect())
                .filter((rect) => rect.width > 0 || rect.height > 0);
            const tableRect = tableEl?.getBoundingClientRect();
            const tableVisible =
                !tableEl ||
                (!!tableRect &&
                    tableRect.width > 0 &&
                    tableRect.height > 0 &&
                    !tableEl.hasAttribute("hidden"));
            if (buttonRects.length === 0 || viewportRect.width <= 0 || viewportRect.height <= 0) {
                return;
            }

            const actionsRowGap =
                parseFloat(getComputedStyle(actionsEl).getPropertyValue("--actions-row-gap")) || 0;
            const footerRowGap =
                parseFloat(getComputedStyle(actionsEl).getPropertyValue("--footer-row-gap")) || 0;

            const buttonsWidth = buttonRects.reduce((sum, rect) => sum + rect.width, 0);
            const rowWidth = buttonsWidth + actionsRowGap * (buttonRects.length - 1) + footerRowGap;
            const rowLeftEdge = actionsRect.right - rowWidth;

            const footerRect = footerEl.getBoundingClientRect();

            // Size + center the drawing would have if left unshrunk (i.e.
            // reserving only the viewport's normal padding on every side).
            const contentWidth = viewportRect.width - 2 * VIEWPORT_BASE_PADDING;
            const contentHeight = viewportRect.height - 2 * VIEWPORT_BASE_PADDING;
            const drawingSize = Math.max(0, Math.min(contentWidth, contentHeight));
            const safeRadius = drawingSize * DRAWING_SAFE_CONTENT_RADIUS_FRACTION;
            const centerX = viewportRect.left + viewportRect.width / 2;
            const centerY = viewportRect.top + viewportRect.height / 2;

            const tableClearsDrawingRaw =
                !tableRect || !tableVisible || (tableRect.width === 0 && tableRect.height === 0)
                    ? true
                    : (() => {
                          const dx = centerX - tableRect.right;
                          const dy = centerY - tableRect.top;
                          const safeRadiusWithMargin = safeRadius + SAFETY_MARGIN;
                          return dx * dx + dy * dy >= safeRadiusWithMargin * safeRadiusWithMargin;
                      })();

            // Latch: decide whether to actually reserve space, using the raw
            // clearance result plus the sticky behavior described above.
            let needsReserve: boolean;
            if (!tableVisible) {
                reservedRef.current = false;
                needsReserve = false;
            } else if (!tableClearsDrawingRaw) {
                if (!reservedRef.current) {
                    reservedRef.current = true;
                    reservedAtWidthRef.current = viewportRect.width;
                }
                needsReserve = true;
            } else if (
                reservedRef.current &&
                viewportRect.width <= reservedAtWidthRef.current + RESERVE_RELEASE_BUFFER
            ) {
                needsReserve = true;
            } else {
                reservedRef.current = false;
                needsReserve = false;
            }

            setActionsStacked(rowLeftEdge < (tableRect ? tableRect.right : 0) + SAFETY_MARGIN);
            setViewportBottomReserve(
                needsReserve
                    ? Math.max(VIEWPORT_BASE_PADDING, Math.ceil(footerRect.height) + 44)
                    : VIEWPORT_BASE_PADDING,
            );
        };

        recompute();

        const observer =
            typeof ResizeObserver === "undefined" ? null : new ResizeObserver(recompute);
        observer?.observe(viewportEl);
        observer?.observe(footerEl);
        if (tableEl) {
            observer?.observe(tableEl);
        }

        observer?.observe(actionsEl);
        Array.from(actionsEl.children).forEach((child) => observer?.observe(child));

        window.addEventListener("resize", recompute);
        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", recompute);
        };
    }, [showTable, tableEl, lastSingleResult]);

    const viewportStyle = {
        "--viewport-footer-reserve": `${viewportBottomReserve}px`,
    } as CSSProperties;

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
                    style={viewportStyle}
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
                    <span className="viewport-label noselect" ref={labelRef}>
                        Layout Preview
                    </span>
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
                    <div
                        className={`viewport-options${optionsStacked ? " stacked" : ""}`}
                        ref={optionsRef}
                    >
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
                    <div className="viewport-overlay-footer" ref={footerRef}>
                        <TubeSheetDataTable
                            ref={setTableEl}
                            data={lastSingleResult}
                            layoutLabel={drawingTableLabel}
                            requestedTubes={drawingTableRequestedTubes}
                            visible={showTable}
                        />
                        <div
                            className={`viewport-actions${actionsStacked ? " stacked" : ""}`}
                            ref={actionsRef}
                            hidden={drawingSVG === placeholderSVG}
                        >
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
        </div>
    );
};

export default App;
