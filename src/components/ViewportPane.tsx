import type { CSSProperties, MouseEvent as ReactMouseEvent, RefObject } from "react";
import { TubeSheetSVG } from "./TubeSheetSVG";
import { TubeSheetDataTable } from "./TubeSheetDataTable";
import { ShellOTLTooltip } from "./ShellOTLTooltip";
import { ContextMenu, ContextMenuItem } from "./context-menu";
import TableIcon from "../assets/table-icon.svg?react";
import TableOffIcon from "../assets/table-off-icon.svg?react";
import GridIcon from "../assets/grid-icon.svg?react";
import GridOffIcon from "../assets/grid-off-icon.svg?react";
import SaveIcon from "../assets/save-icon.svg?react";
import CopyIcon from "../assets/copy-icon.svg?react";
import type { AnimationLifecycle } from "../hooks/useContextMenu";
import type { CopyState } from "../hooks/useSvgExportActions";
import type { SingleResultPayload } from "../hooks/useTubeSheetWorker";
import { useShellOtlHighlight } from "../hooks/useShellOTLHighlight";

interface ViewportPaneProps {
    containerRef: RefObject<HTMLDivElement | null>;
    footerRef: RefObject<HTMLDivElement | null>;
    showGrid: boolean;
    showTable: boolean;
    onToggleGrid: () => void;
    onToggleTable: () => void;
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
    copyReady: boolean;
    onCopySVG: () => void;
    onDownloadSVG: () => void;
}

export function ViewportPane({
    containerRef,
    footerRef,
    showGrid,
    showTable,
    onToggleGrid,
    onToggleTable,
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
    copyReady,
    onCopySVG,
    onDownloadSVG,
}: ViewportPaneProps) {
    // Hover-highlight the shell/OTL circles on the drawing and drive a
    // cursor-following tooltip with their calculated values.
    const { hovered, tooltipRef } = useShellOtlHighlight(
        containerRef,
        drawingSVG,
        lastSingleResult,
    );

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
                    <div className="viewport-options-group">
                        <button
                            type="button"
                            className={`table-toggle ${showTable ? "active" : ""}`}
                            onClick={onToggleTable}
                            aria-pressed={showTable}
                            data-title={showTable ? "Hide Results Table" : "Show Results Table"}
                        >
                            {showTable ? (
                                <TableIcon
                                    className="btn-icon"
                                    width="13"
                                    height="13"
                                    aria-hidden="true"
                                />
                            ) : (
                                <TableOffIcon
                                    className="btn-icon"
                                    width="13"
                                    height="13"
                                    aria-hidden="true"
                                />
                            )}
                            <span className="btn-label">Results Table</span>
                        </button>
                        <button
                            type="button"
                            className={`grid-toggle ${showGrid ? "active" : ""}`}
                            onClick={onToggleGrid}
                            aria-pressed={showGrid}
                            data-title={showGrid ? "Hide Grid" : "Show Grid"}
                        >
                            {showGrid ? (
                                <GridIcon
                                    className="btn-icon"
                                    width="13"
                                    height="13"
                                    aria-hidden="true"
                                />
                            ) : (
                                <GridOffIcon
                                    className="btn-icon"
                                    width="13"
                                    height="13"
                                    aria-hidden="true"
                                />
                            )}
                            <span className="btn-label">Grid</span>
                        </button>
                    </div>
                </div>
                <TubeSheetSVG
                    src={drawingSVG}
                    className="tubesheet-svg"
                    onRendered={onDrawingRendered}
                />
                <ShellOTLTooltip ref={tooltipRef} hovered={hovered} data={lastSingleResult} />
                <div className="viewport-overlay-footer" ref={footerRef}>
                    <TubeSheetDataTable
                        ref={onTableRef}
                        data={lastSingleResult}
                        layoutLabel={drawingTableLabel}
                        requestedTubes={drawingTableRequestedTubes}
                        visible={showTable}
                    />
                    <div className="viewport-actions" hidden={drawingSVG === placeholderSVG}>
                        <div className="viewport-actions-group">
                            <div className="copy-button-wrap">
                                <span
                                    className={`copy-status-badge noselect${
                                        copyState !== "idle" ? " visible" : ""
                                    }${copyState === "error" || copyState === "unsupported" ? " error" : ""}
                                ${copyState === "copied" ? " success" : ""}`}
                                    role="status"
                                    aria-live="polite"
                                    aria-hidden={copyState === "idle"}
                                >
                                    {copyState === "pending"
                                        ? "Copying…"
                                        : copyState === "copied"
                                          ? "Copied!"
                                          : copyState === "error"
                                            ? "Copy failed"
                                            : copyState === "unsupported"
                                              ? "Copy unsupported on this browser"
                                              : ""}
                                </span>
                                <button
                                    className="copy-button"
                                    onClick={onCopySVG}
                                    type="button"
                                    data-title={copyReady ? "Copy Image" : "Preparing image…"}
                                    disabled={copyState === "pending" || !copyReady}
                                    aria-busy={copyState === "pending" || !copyReady}
                                >
                                    <CopyIcon
                                        className="btn-icon"
                                        width="15"
                                        height="15"
                                        aria-hidden="true"
                                    />
                                    <span className="btn-label">Copy Image</span>
                                </button>
                            </div>
                            <button
                                className="save-button"
                                onClick={onDownloadSVG}
                                type="button"
                                data-title="Save Image"
                            >
                                <SaveIcon
                                    className="btn-icon"
                                    width="15"
                                    height="15"
                                    aria-hidden="true"
                                />
                                <span className="btn-label">Save Image</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
