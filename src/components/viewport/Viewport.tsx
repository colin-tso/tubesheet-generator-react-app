// This file intentionally exports a compound object (`Viewport`) alongside its
// component pieces, so Fast Refresh can't isolate per-component state here --
// same tradeoff any Component.Sub-style compound export makes.
/* eslint-disable react-refresh/only-export-components */
import { useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { TubeSheetSVG } from "../TubeSheetSVG";
import { TubeSheetDataTable } from "../TubeSheetDataTable";
import { ShellOTLTooltip } from "../ShellOTLTooltip";
import { ContextMenu, type ContextMenuItem } from "../ContextMenu";
import TableIcon from "../../assets/table-icon.svg?react";
import TableOffIcon from "../../assets/table-off-icon.svg?react";
import GridIcon from "../../assets/grid-icon.svg?react";
import GridOffIcon from "../../assets/grid-off-icon.svg?react";
import SaveIcon from "../../assets/save-icon.svg?react";
import CopyIcon from "../../assets/copy-icon.svg?react";
import { useViewportContext } from "./ViewportContext";
import { ViewportProvider } from "./ViewportProvider";

// Structural shell: sizing, positioning, and the always-present viewport
// chrome (label, loading/error state, corner registration marks). Everything
// else is composed in as children.
function ViewportFrame({ children }: { children: ReactNode }) {
    const { state, actions, meta } = useViewportContext();

    return (
        <div className="column-pane right">
            <div
                className={`viewport ${state.showGrid ? "" : "grid-hidden"}${
                    state.showTable && state.lastSingleResult ? " has-table" : ""
                }`}
                style={state.viewportStyle}
                // meta.containerRef is created and owned by ViewportProvider; attaching
                // it here (not the component that created it) is the intentional
                // provider/meta pattern, not a stray ref read.
                // eslint-disable-next-line react-hooks/refs
                ref={meta.containerRef}
                onContextMenu={actions.openContextMenu}
            >
                <span className="viewport-label noselect">Layout Preview</span>
                {state.calcError ? (
                    <span className="loading-overlay error visible noselect" aria-hidden="true">
                        Calculation failed
                    </span>
                ) : (
                    <span
                        className={`loading-overlay noselect${state.showLoadingBadge ? " visible" : ""}`}
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
                    {state.announcement}
                </span>
                <span className="reg-tl" aria-hidden="true" />
                <span className="reg-tr" aria-hidden="true" />
                <span className="reg-bl" aria-hidden="true" />
                <span className="reg-br" aria-hidden="true" />
                {children}
            </div>
        </div>
    );
}

// Right-click menu over the viewport. Builds its own item list from context
// actions, so callers no longer need to hand it a pre-built config.
function ViewportContextMenu() {
    const { state, actions, meta } = useViewportContext();

    const handleCopy = useCallback(() => {
        actions.copySVG();
        actions.closeContextMenu();
    }, [actions]);
    const handleSave = useCallback(() => {
        actions.downloadSVG();
        actions.closeContextMenu();
    }, [actions]);

    const items: ContextMenuItem[] = useMemo(
        () => [
            {
                label: "Copy Image",
                icon: <CopyIcon />,
                onClick: handleCopy,
                disabled: !state.copyReady,
            },
            { label: "", isDivider: true, onClick: () => {} },
            { label: "Save Image", icon: <SaveIcon />, onClick: handleSave },
        ],
        [handleCopy, handleSave, state.copyReady],
    );

    if (state.contextMenuAnimationState === "idle") return null;

    return (
        <ContextMenu
            position={state.contextMenuPos}
            parentRef={meta.containerRef}
            items={items}
            animationState={
                state.contextMenuAnimationState === "fading-in" ? "fading-in" : "fading-out"
            }
            onAnimationEnd={actions.onContextMenuAnimationEnd}
            onRequestClose={actions.closeContextMenu}
        />
    );
}

// Grid/results-table visibility toggles.
function ViewportToolbar() {
    const { state, actions } = useViewportContext();

    return (
        <div className="viewport-options">
            <div className="viewport-options-group">
                <button
                    type="button"
                    className={`table-toggle ${state.showTable ? "active" : ""}`}
                    onClick={actions.toggleTable}
                    aria-pressed={state.showTable}
                    data-title={state.showTable ? "Hide Results Table" : "Show Results Table"}
                >
                    {state.showTable ? (
                        <TableIcon className="btn-icon" width="13" height="13" aria-hidden="true" />
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
                    className={`grid-toggle ${state.showGrid ? "active" : ""}`}
                    onClick={actions.toggleGrid}
                    aria-pressed={state.showGrid}
                    data-title={state.showGrid ? "Hide Grid" : "Show Grid"}
                >
                    {state.showGrid ? (
                        <GridIcon className="btn-icon" width="13" height="13" aria-hidden="true" />
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
    );
}

// The rendered SVG plus its cursor-following shell/OTL tooltip.
function ViewportDrawing() {
    const { state, actions, meta } = useViewportContext();

    return (
        <>
            <TubeSheetSVG
                src={state.drawingSVG}
                className="tubesheet-svg"
                onRendered={actions.onDrawingRendered}
            />
            <ShellOTLTooltip
                // meta.tooltipRef: provider-owned ref, see ViewportFrame
                // comment above.
                // eslint-disable-next-line react-hooks/refs
                ref={meta.tooltipRef}
                hovered={state.hovered}
                data={state.lastSingleResult}
            />
        </>
    );
}

// Wraps the overlay footer element that ResizeObserver measures for
// table/drawing overlap. Composes Viewport.Table / Viewport.ExportActions.
function ViewportFooter({ children }: { children: ReactNode }) {
    const { meta } = useViewportContext();
    return (
        // meta.footerRef: provider-owned ref, see ViewportFrame comment above.
        // eslint-disable-next-line react-hooks/refs
        <div className="viewport-overlay-footer" ref={meta.footerRef}>
            {children}
        </div>
    );
}

// Results table for the last committed layout.
function ViewportTable() {
    const { state, actions } = useViewportContext();
    return (
        <TubeSheetDataTable
            // actions.setTableEl: provider-owned setter, see ViewportFrame comment above.
            // eslint-disable-next-line react-hooks/refs
            ref={actions.setTableEl}
            data={state.lastSingleResult}
            layoutLabel={state.drawingTableLabel}
            requestedTubes={state.drawingTableRequestedTubes}
            visible={state.showTable}
        />
    );
}

// Copy-to-clipboard / download-as-file buttons. Hidden until a real drawing
// (not the placeholder) exists.
function ViewportExportActions() {
    const { state, actions } = useViewportContext();

    const copyStatusLabel =
        state.copyState === "pending"
            ? "Copying…"
            : state.copyState === "copied"
              ? "Copied!"
              : state.copyState === "downloaded"
                ? "Copy unsupported – image saved"
                : state.copyState === "error"
                  ? "Copy failed"
                  : state.copyState === "unsupported"
                    ? "Copy unsupported"
                    : "";

    return (
        <div className="viewport-actions" hidden={state.drawingSVG === state.placeholderSVG}>
            <div className="viewport-actions-group">
                <div className="copy-button-wrap">
                    <span
                        className={`copy-status-badge noselect${
                            state.copyState !== "idle" ? " visible" : ""
                        }${state.copyState === "error" || state.copyState === "unsupported" ? " error" : ""}${
                            state.copyState === "copied" || state.copyState === "downloaded"
                                ? " success"
                                : ""
                        }`}
                        role="status"
                        aria-live="polite"
                        aria-hidden={state.copyState === "idle"}
                    >
                        {copyStatusLabel}
                    </span>
                    <button
                        className="copy-button"
                        onClick={actions.copySVG}
                        type="button"
                        data-title={state.copyReady ? "Copy Image" : "Preparing image…"}
                        disabled={state.copyState === "pending" || !state.copyReady}
                        aria-busy={state.copyState === "pending" || !state.copyReady}
                    >
                        <CopyIcon className="btn-icon" width="15" height="15" aria-hidden="true" />
                        <span className="btn-label">Copy Image</span>
                    </button>
                </div>
                <button
                    className="save-button"
                    onClick={actions.downloadSVG}
                    type="button"
                    data-title="Save Image"
                >
                    <SaveIcon className="btn-icon" width="15" height="15" aria-hidden="true" />
                    <span className="btn-label">Save Image</span>
                </button>
            </div>
        </div>
    );
}

export const Viewport = {
    Provider: ViewportProvider,
    Frame: ViewportFrame,
    ContextMenu: ViewportContextMenu,
    Toolbar: ViewportToolbar,
    Drawing: ViewportDrawing,
    Footer: ViewportFooter,
    Table: ViewportTable,
    ExportActions: ViewportExportActions,
};
