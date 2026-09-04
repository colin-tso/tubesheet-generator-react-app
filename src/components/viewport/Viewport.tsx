// This file intentionally exports a compound object (`Viewport`) alongside its
// component pieces, so Fast Refresh can't isolate per-component state here --
// same tradeoff any Component.Sub-style compound export makes.
/* eslint-disable react-refresh/only-export-components */
import { useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { TubeSheetSVG } from "@/components/TubeSheetSVG";
import { TubeSheetDataTable } from "@/components/TubeSheetDataTable";
import { ShellOTLTooltip } from "@/components/ShellOTLTooltip";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import TableIcon from "@/assets/table-icon.svg?react";
import TableOffIcon from "@/assets/table-off-icon.svg?react";
import GridIcon from "@/assets/grid-icon.svg?react";
import GridOffIcon from "@/assets/grid-off-icon.svg?react";
import TubeLabelsIcon from "@/assets/tube-labels-icon.svg?react";
import TubeLabelsOffIcon from "@/assets/tube-labels-off-icon.svg?react";
import SaveSvgIcon from "@/assets/save-svg-icon.svg?react";
import SavePngIcon from "@/assets/save-png-icon.svg?react";
import SavePdfIcon from "@/assets/save-pdf-icon.svg?react";
import SaveDxfIcon from "@/assets/save-dxf-icon.svg?react";
import CopyIcon from "@/assets/copy-icon.svg?react";
import HelpIcon from "@/assets/help-icon.svg?react";
import { loadDocsPage } from "@/docs/loadDocsPage";
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
                    <span
                        className="loading-overlay error visible noselect"
                        title={state.calcError}
                        aria-hidden="true"
                    >
                        Calculation failed: {state.calcError}
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
    const handleSaveSVG = useCallback(() => {
        actions.downloadSVG();
        actions.closeContextMenu();
    }, [actions]);
    const handleSavePNG = useCallback(() => {
        actions.downloadPNG();
        actions.closeContextMenu();
    }, [actions]);
    const handleSavePDF = useCallback(() => {
        actions.downloadPDF();
        actions.closeContextMenu();
    }, [actions]);
    const handleSaveDXF = useCallback(() => {
        actions.downloadDXF();
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
            { label: "Save as SVG", icon: <SaveSvgIcon />, onClick: handleSaveSVG },
            {
                label: "Save as PNG",
                icon: <SavePngIcon />,
                onClick: handleSavePNG,
                disabled: state.pngExportState === "pending",
            },
            {
                label: "Save as PDF",
                icon: <SavePdfIcon />,
                onClick: handleSavePDF,
                disabled: state.pdfExportState === "pending",
            },
            {
                label: "Save as DXF",
                icon: <SaveDxfIcon />,
                onClick: handleSaveDXF,
                disabled: state.dxfExportState === "pending",
            },
        ],
        [
            handleCopy,
            handleSaveSVG,
            handleSavePNG,
            handleSavePDF,
            handleSaveDXF,
            state.copyReady,
            state.pngExportState,
            state.pdfExportState,
            state.dxfExportState,
        ],
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

// Grid/results-table/tube-label visibility toggles.
function ViewportToolbar() {
    const { state, actions } = useViewportContext();

    return (
        <div className="viewport-options" data-no-context-menu>
            <div className="floating-card">
                <button
                    type="button"
                    className={`icon-btn-vertical focus-ring table-toggle ${state.showTable ? "active" : ""}`}
                    onClick={actions.toggleTable}
                    aria-pressed={state.showTable}
                    data-title={state.showTable ? "Hide Results Table" : "Show Results Table"}
                >
                    {state.showTable ? (
                        <TableIcon className="btn-icon" width="19" height="19" aria-hidden="true" />
                    ) : (
                        <TableOffIcon
                            className="btn-icon"
                            width="19"
                            height="19"
                            aria-hidden="true"
                        />
                    )}
                    <span className="btn-micro-label" aria-hidden="true">
                        Table
                    </span>
                    <span className="btn-label">Results Table</span>
                </button>
                <button
                    type="button"
                    className={`icon-btn-vertical focus-ring grid-toggle ${state.showGrid ? "active" : ""}`}
                    onClick={actions.toggleGrid}
                    aria-pressed={state.showGrid}
                    data-title={state.showGrid ? "Hide Grid" : "Show Grid"}
                >
                    {state.showGrid ? (
                        <GridIcon className="btn-icon" width="19" height="19" aria-hidden="true" />
                    ) : (
                        <GridOffIcon
                            className="btn-icon"
                            width="19"
                            height="19"
                            aria-hidden="true"
                        />
                    )}
                    <span className="btn-micro-label" aria-hidden="true">
                        Grid
                    </span>
                    <span className="btn-label">Grid</span>
                </button>
                <button
                    type="button"
                    className={`icon-btn-vertical focus-ring tube-labels-toggle ${state.showTubeLabels ? "active" : ""}`}
                    onClick={actions.toggleTubeLabels}
                    aria-pressed={state.showTubeLabels}
                    data-title={state.showTubeLabels ? "Hide Tube Labels" : "Show Tube Labels"}
                >
                    {state.showTubeLabels ? (
                        <TubeLabelsIcon
                            className="btn-icon"
                            width="19"
                            height="19"
                            aria-hidden="true"
                        />
                    ) : (
                        <TubeLabelsOffIcon
                            className="btn-icon"
                            width="19"
                            height="19"
                            aria-hidden="true"
                        />
                    )}
                    <span className="btn-micro-label" aria-hidden="true">
                        Labels
                    </span>
                    <span className="btn-label">Tube Labels</span>
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

// Docs-link "?" button, top-left of the viewport. Icon-only, with the label
// shown as a hover/focus tooltip (mirror of the grid/table toggles).
function ViewportDocsButton() {
    return (
        <div className="viewport-help" data-no-context-menu>
            <div className="floating-card">
                <button
                    type="button"
                    className="focus-ring help-button"
                    onClick={() => {
                        window.location.hash = "#/docs";
                    }}
                    aria-label="How the layout math works"
                    data-title="How the layout math works"
                    onMouseEnter={loadDocsPage}
                    onFocus={loadDocsPage}
                >
                    <HelpIcon className="btn-icon" width="15" height="15" aria-hidden="true" />
                    <span className="btn-micro-label" aria-hidden="true">
                        Docs
                    </span>
                    <span className="btn-label">How the layout math works</span>
                </button>
            </div>
        </div>
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

    const pngButtonTitle =
        state.pngExportState === "pending"
            ? "Rendering PNG…"
            : state.pngExportState === "error"
              ? "PNG export failed"
              : "Save as PNG";

    const pdfButtonTitle =
        state.pdfExportState === "pending"
            ? "Rendering PDF…"
            : state.pdfExportState === "error"
              ? "PDF export failed"
              : "Save as PDF";

    const dxfButtonTitle =
        state.dxfExportState === "pending"
            ? "Rendering DXF…"
            : state.dxfExportState === "error"
              ? "DXF export failed"
              : "Save as DXF";

    return (
        <div
            className="viewport-actions"
            data-no-context-menu
            hidden={state.drawingSVG === state.placeholderSVG}
        >
            <div className="floating-card">
                <div className="copy-btn-wrap">
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
                        className="icon-btn-vertical focus-ring copy-button"
                        onClick={actions.copySVG}
                        type="button"
                        data-title={state.copyReady ? "Copy Image" : "Preparing image…"}
                        disabled={state.copyState === "pending" || !state.copyReady}
                        aria-busy={state.copyState === "pending" || !state.copyReady}
                    >
                        <CopyIcon className="btn-icon" width="19" height="19" aria-hidden="true" />
                        <span className="btn-micro-label" aria-hidden="true">
                            Copy
                        </span>
                        <span className="btn-label">Copy Image</span>
                    </button>
                </div>
                <div className="save-buttons-group">
                    <button
                        className="focus-ring export-btn save-svg-button"
                        onClick={actions.downloadSVG}
                        type="button"
                        data-title="Save as SVG"
                    >
                        <SaveSvgIcon
                            className="btn-icon"
                            width="19"
                            height="19"
                            aria-hidden="true"
                        />
                        <span className="btn-label">Save as SVG</span>
                    </button>
                    <button
                        className={`focus-ring export-btn save-png-button${
                            state.pngExportState === "error" ? " error" : ""
                        }`}
                        onClick={actions.downloadPNG}
                        type="button"
                        data-title={pngButtonTitle}
                        disabled={state.pngExportState === "pending"}
                        aria-busy={state.pngExportState === "pending"}
                    >
                        <SavePngIcon
                            className="btn-icon"
                            width="19"
                            height="19"
                            aria-hidden="true"
                        />
                        <span className="btn-label">{pngButtonTitle}</span>
                    </button>
                    <button
                        className={`focus-ring export-btn save-pdf-button${
                            state.pdfExportState === "error" ? " error" : ""
                        }`}
                        onClick={actions.downloadPDF}
                        type="button"
                        data-title={pdfButtonTitle}
                        disabled={state.pdfExportState === "pending"}
                        aria-busy={state.pdfExportState === "pending"}
                    >
                        <SavePdfIcon
                            className="btn-icon"
                            width="19"
                            height="19"
                            aria-hidden="true"
                        />
                        <span className="btn-label">{pdfButtonTitle}</span>
                    </button>
                    <button
                        className={`focus-ring export-btn save-dxf-button${
                            state.dxfExportState === "error" ? " error" : ""
                        }`}
                        onClick={actions.downloadDXF}
                        type="button"
                        data-title={dxfButtonTitle}
                        disabled={state.dxfExportState === "pending"}
                        aria-busy={state.dxfExportState === "pending"}
                    >
                        <SaveDxfIcon
                            className="btn-icon"
                            width="19"
                            height="19"
                            aria-hidden="true"
                        />
                        <span className="btn-label">{dxfButtonTitle}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export const Viewport = {
    Provider: ViewportProvider,
    Frame: ViewportFrame,
    ContextMenu: ViewportContextMenu,
    Toolbar: ViewportToolbar,
    DocsButton: ViewportDocsButton,
    Drawing: ViewportDrawing,
    Footer: ViewportFooter,
    Table: ViewportTable,
    ExportActions: ViewportExportActions,
};
