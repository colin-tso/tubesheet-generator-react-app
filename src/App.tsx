import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import packageJson from "../package.json";
import {
    TubeSheet,
    generateTubeSheetSVG,
    ITubeSheetData,
} from "./plugins/tubesheet-layout-generator";
import { NumericField } from "./components/NumericField";
import { utils } from "./utils/";
import ThemeToggle from "./components/DarkmodeToggle";
import { ContextMenuItem } from "./components/context-menu";
import SaveIcon from "./assets/save-icon.svg?react";
import CopyIcon from "./assets/copy-icon.svg?react";
import { useTubeSheetWorker } from "./hooks/useTubeSheetWorker";
import { useLayoutForm } from "./hooks/useLayoutForm";
import { useSvgExportActions } from "./hooks/useSvgExportActions";
import { useContextMenu } from "./hooks/useContextMenu";
import { useViewportFooterReserve } from "./hooks/useViewportFooterReserve";
import { LayoutOptionsList } from "./components/LayoutOptionsList";
import { ViewportPane } from "./components/ViewportPane";
import { FormFooter } from "./components/FormFooter";
import { numericFieldConfigs } from "./constants/numericFieldConfigs";
import { layoutOptionRows } from "./constants/layoutOptionRows";

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

    // Input field current values, keyed to match numericFieldConfigs ids.
    const fieldValues: Record<string, number | undefined> = {
        minTubes,
        tubeOD,
        OTLtoShell,
        tubeClearance,
        pitchRatio,
        shellID,
    };

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

    // Reserve table space only if it overlaps the drawing.
    const footerRef = useRef<HTMLDivElement>(null);
    const [tableEl, setTableEl] = useState<HTMLTableElement | null>(null);
    const { viewportBottomReserve } = useViewportFooterReserve({
        containerRef,
        footerRef,
        tableEl,
        showTable,
        lastSingleResult,
        basePadding: VIEWPORT_BASE_PADDING,
    });

    const viewportStyle = {
        "--viewport-footer-reserve": `${viewportBottomReserve}px`,
    } as CSSProperties;

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
                                value={fieldValues[cfg.id]}
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
                    <LayoutOptionsList
                        rows={layoutOptionRows}
                        layoutResults={layoutResults}
                        showLoadingBadge={showLoadingBadge}
                        onLayoutOptionChange={onLayoutOptionChange}
                    />
                    {/* Disabled while a calculation is in flight */}
                    <button
                        type="submit"
                        className="generate-button"
                        disabled={!layoutInputsDefined || !layoutOptionSelected || isCalculating}
                    >
                        Regenerate Drawing
                    </button>
                </div>
                <FormFooter />
            </form>
            <ViewportPane
                containerRef={containerRef}
                footerRef={footerRef}
                showGrid={showGrid}
                showTable={showTable}
                onToggleGrid={() => setShowGrid((v) => !v)}
                onToggleTable={() => setShowTable((v) => !v)}
                viewportStyle={viewportStyle}
                onContextMenu={openContextMenu}
                contextMenuAnimationState={contextMenuAnimationState}
                contextMenuPos={contextMenuPos}
                menuConfig={menuConfig}
                onContextMenuAnimationEnd={onAnimationEnd}
                onContextMenuRequestClose={requestClose}
                calcError={calcError}
                showLoadingBadge={showLoadingBadge}
                announcement={announcement}
                drawingSVG={drawingSVG}
                placeholderSVG={placeholderSVG}
                onDrawingRendered={onDrawingRendered}
                lastSingleResult={lastSingleResult}
                drawingTableLabel={drawingTableLabel}
                drawingTableRequestedTubes={drawingTableRequestedTubes}
                onTableRef={setTableEl}
                copyState={copyState}
                onCopySVG={copySVG}
                onDownloadSVG={downloadSVG}
            />
        </div>
    );
};

export default App;
