import type { CSSProperties, MouseEvent as ReactMouseEvent, RefObject } from "react";
import { TubeSheetSVG } from "./TubeSheetSVG";
import { TubeSheetDataTable } from "./TubeSheetDataTable";
import { ContextMenu, ContextMenuItem } from "./context-menu";
import TableIcon from "../assets/table-icon.svg?react";
import GridIcon from "../assets/grid-icon.svg?react";
import SaveIcon from "../assets/save-icon.svg?react";
import CopyIcon from "../assets/copy-icon.svg?react";
import type { AnimationLifecycle } from "../hooks/useContextMenu";
import type { CopyState } from "../hooks/useSvgExportActions";
import type { SingleResultPayload } from "../hooks/useTubeSheetWorker";

interface ViewportPaneProps {
    containerRef: RefObject<HTMLDivElement | null>;
    labelRef: RefObject<HTMLSpanElement | null>;
    optionsRef: RefObject<HTMLDivElement | null>;
    footerRef: RefObject<HTMLDivElement | null>;
    actionsRef: RefObject<HTMLDivElement | null>;
    showGrid: boolean;
    showTable: boolean;
    onToggleGrid: () => void;
    onToggleTable: () => void;
    optionsStacked: boolean;
    actionsStacked: boolean;
    viewportStyle: CSSProperties;
    onContextMenu: (e: ReactMouseEvent<HTMLDivElement>) => void;
    contextMenuAnimationState: AnimationLifecycle;
    contextMenuPos: { x: number; y: number };
    menuConfig: ContextMenuItem[];
    onContextMenuAnimationEnd: () => void;
    onContextMenuRequestClose: () => void;
    calcError: string | null;
    showLoadingBadge: boolean;
    announcement: string;
    drawingSVG: SVGSVGElement;
    placeholderSVG: SVGSVGElement;
    onDrawingRendered: () => void;
    lastSingleResult: SingleResultPayload;
    drawingTableLabel: string;
    drawingTableRequestedTubes: number | undefined;
    onTableRef: (el: HTMLTableElement | null) => void;
    copyState: CopyState;
    onCopySVG: () => void;
    onDownloadSVG: () => void;
}

export function ViewportPane({
    containerRef,
    labelRef,
    optionsRef,
    footerRef,
    actionsRef,
    showGrid,
    showTable,
    onToggleGrid,
    onToggleTable,
    optionsStacked,
    actionsStacked,
    viewportStyle,
    onContextMenu,
    contextMenuAnimationState,
    contextMenuPos,
    menuConfig,
    onContextMenuAnimationEnd,
    onContextMenuRequestClose,
    calcError,
    showLoadingBadge,
    announcement,
    drawingSVG,
    placeholderSVG,
    onDrawingRendered,
    lastSingleResult,
    drawingTableLabel,
    drawingTableRequestedTubes,
    onTableRef,
    copyState,
    onCopySVG,
    onDownloadSVG,
}: ViewportPaneProps) {
    return (
        <div className="column-pane right">
            <div
                className={`viewport ${showGrid ? "" : "grid-hidden"}${
                    showTable && lastSingleResult ? " has-table" : ""
                }`}
                style={viewportStyle}
                ref={containerRef}
                onContextMenu={onContextMenu}
            >
                {contextMenuAnimationState !== "idle" && (
                    <ContextMenu
                        position={contextMenuPos}
                        parentRef={containerRef}
                        items={menuConfig} // Pass layout data array down
                        animationState={
                            contextMenuAnimationState === "fading-in" ? "fading-in" : "fading-out"
                        }
                        onAnimationEnd={onContextMenuAnimationEnd}
                        onRequestClose={onContextMenuRequestClose}
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
                        onClick={onToggleTable}
                        aria-pressed={showTable}
                        title={showTable ? "Hide Table" : "Show Table"}
                    >
                        <TableIcon width="13" height="13" aria-hidden="true" />
                        Table
                    </button>
                    <button
                        type="button"
                        className={`grid-toggle ${showGrid ? "active" : ""}`}
                        onClick={onToggleGrid}
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
                        ref={onTableRef}
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
                        <button className="copy-button" onClick={onCopySVG} type="button">
                            <CopyIcon width="15" height="15" aria-hidden="true" />
                            {copyState === "copied"
                                ? "Copied!"
                                : copyState === "error"
                                  ? "Copy failed"
                                  : copyState === "unsupported"
                                    ? "Copy unsupported"
                                    : "Copy Image"}
                        </button>
                        <button className="save-button" onClick={onDownloadSVG} type="button">
                            <SaveIcon width="15" height="15" aria-hidden="true" />
                            Save Image
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
