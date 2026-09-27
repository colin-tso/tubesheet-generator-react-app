// This file intentionally exports a compound object (`Viewport`) alongside its
// component pieces, so Fast Refresh can't isolate per-component state here --
// same tradeoff any Component.Sub-style compound export makes.
/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, ReactNode } from "react";
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
import {
    SaveSvgIcon,
    SavePngIcon,
    SavePdfIcon,
    SaveDxfIcon,
    SaveJsonIcon,
} from "@/components/icons/SaveFormatIcon";
import LoadJsonIcon from "@/assets/load-json-icon.svg?react";
import LinkIcon from "@/assets/link-icon.svg?react";
import CheckIcon from "@/assets/check-icon.svg?react";
import CopyIcon from "@/assets/copy-icon.svg?react";
import HelpIcon from "@/assets/help-icon.svg?react";
import MoreIcon from "@/assets/more-horiz-icon.svg?react";
import { loadDocsPage } from "@/docs/loadDocsPage";
import { useViewportContext } from "./ViewportContext";
import { ViewportProvider } from "./ViewportProvider";

// Structural shell: sizing, positioning, and the always-present viewport chrome
// (label, loading/error state, corner registration marks). Everything else is
// composed in as children.
//
// Also the drop target for drag-and-drop JSON config import: the whole drawing
// area accepts a dropped file, not just the "Load JSON" button in
// ViewportExportActions, so a person on an empty/placeholder drawing (where
// most of that button group stays hidden) still has an obvious way to load a
// saved design. dragDepthRef -- rather than toggling the highlight straight off
// dragenter/dragleave -- tracks nesting depth so a child element's own
// enter/leave pair (fired as the pointer crosses into e.g. the toolbar) can't
// prematurely clear the highlight while still over the frame.
function ViewportFrame({ children }: { children: ReactNode }) {
    const { state, actions, meta } = useViewportContext();
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const dragDepthRef = useRef(0);

    const isFileDrag = (e: DragEvent<HTMLDivElement>) =>
        Array.from(e.dataTransfer?.types ?? []).includes("Files");

    const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        dragDepthRef.current += 1;
        setIsDraggingFile(true);
    }, []);

    const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
    }, []);

    const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
        if (!isFileDrag(e)) return;
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) setIsDraggingFile(false);
    }, []);

    const handleDrop = useCallback(
        (e: DragEvent<HTMLDivElement>) => {
            if (!isFileDrag(e)) return;
            e.preventDefault();
            dragDepthRef.current = 0;
            setIsDraggingFile(false);
            const file = e.dataTransfer.files[0];
            if (file) actions.loadConfigFromFile(file);
        },
        [actions],
    );

    return (
        <div
            className="column-pane right"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
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
                {isDraggingFile && (
                    <div className="viewport-drop-overlay noselect" aria-hidden="true">
                        Drop a tubesheet-config.json file to load it
                    </div>
                )}
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
                <ViewportExportFlyout />
                <ViewportMobileToolbar />
            </div>
        </div>
    );
}

// Right-click menu over the viewport. Builds its own item list from context
// actions, so callers just hand it the context.
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
    const handleSaveJSON = useCallback(() => {
        actions.saveConfigAsJSON();
        actions.closeContextMenu();
    }, [actions]);
    const handleCopyLink = useCallback(() => {
        actions.copyShareableLink();
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
            { label: "", isDivider: true, onClick: () => {} },
            { label: "Save as JSON", icon: <SaveJsonIcon />, onClick: handleSaveJSON },
            { label: "Copy Shareable Link", icon: <LinkIcon />, onClick: handleCopyLink },
        ],
        [
            handleCopy,
            handleSaveSVG,
            handleSavePNG,
            handleSavePDF,
            handleSaveDXF,
            handleSaveJSON,
            handleCopyLink,
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

// Mobile-only bottom toolbar, covering the view/grid/label toggles and the
// export entry point that .viewport-options / .viewport-actions carry on
// desktop -- see index.css for the display:none rules hiding those at this
// breakpoint. A segmented Table/Grid/Labels group covers the same three
// toggles as .viewport-options; Help opens the same docs page as
// ViewportDocsButton; More opens ViewportExportFlyout, which holds Copy,
// every image format, JSON save/load, and share link behind one entry point.
// Hidden via CSS at desktop widths.
function ViewportMobileToolbar() {
    const { state, actions } = useViewportContext();
    return (
        <div className="mobile-viewport-toolbar" data-no-context-menu>
            <div className="view-toggle-segmented" role="group" aria-label="View options">
                <button
                    type="button"
                    className={`view-toggle-segment focus-ring${state.showTable ? " active" : ""}`}
                    onClick={actions.toggleTable}
                    aria-pressed={state.showTable}
                    data-title={state.showTable ? "Hide Results Table" : "Show Results Table"}
                >
                    {state.showTable ? (
                        <TableIcon className="btn-icon" width="18" height="18" aria-hidden="true" />
                    ) : (
                        <TableOffIcon
                            className="btn-icon"
                            width="18"
                            height="18"
                            aria-hidden="true"
                        />
                    )}
                    <span className="btn-micro-label" aria-hidden="true">
                        Table
                    </span>
                </button>
                <button
                    type="button"
                    className={`view-toggle-segment focus-ring${state.showGrid ? " active" : ""}`}
                    onClick={actions.toggleGrid}
                    aria-pressed={state.showGrid}
                    data-title={state.showGrid ? "Hide Grid" : "Show Grid"}
                >
                    {state.showGrid ? (
                        <GridIcon className="btn-icon" width="18" height="18" aria-hidden="true" />
                    ) : (
                        <GridOffIcon className="btn-icon" width="18" height="18" aria-hidden="true" />
                    )}
                    <span className="btn-micro-label" aria-hidden="true">
                        Grid
                    </span>
                </button>
                <button
                    type="button"
                    className={`view-toggle-segment focus-ring${
                        state.showTubeLabels ? " active" : ""
                    }`}
                    onClick={actions.toggleTubeLabels}
                    aria-pressed={state.showTubeLabels}
                    data-title={state.showTubeLabels ? "Hide Tube Labels" : "Show Tube Labels"}
                >
                    {state.showTubeLabels ? (
                        <TubeLabelsIcon
                            className="btn-icon"
                            width="18"
                            height="18"
                            aria-hidden="true"
                        />
                    ) : (
                        <TubeLabelsOffIcon
                            className="btn-icon"
                            width="18"
                            height="18"
                            aria-hidden="true"
                        />
                    )}
                    <span className="btn-micro-label" aria-hidden="true">
                        Labels
                    </span>
                </button>
            </div>

            <div className="mobile-toolbar-actions">
                <button
                    type="button"
                    className="focus-ring mobile-toolbar-button"
                    onClick={actions.toggleSaveMenu}
                    aria-expanded={state.saveMenuExpanded}
                    aria-controls="flyout-menu"
                    data-title={state.saveMenuExpanded ? "Hide export options" : "Export"}
                    hidden={state.drawingSVG === state.placeholderSVG}
                >
                    <MoreIcon className="btn-icon" width="18" height="18" aria-hidden="true" />
                    <span className="btn-micro-label" aria-hidden="true">
                        More
                    </span>
                </button>
            </div>
        </div>
    );
}

// Mobile-only consolidated export/share sheet -- Copy, every image format,
// and JSON save/load/share-link all in one place, opened from the More icon
// in ViewportMobileToolbar. On mobile .viewport-actions is hidden entirely at
// this breakpoint -- see ViewportExportActions and ViewportMobileToolbar.
// Deliberately rendered by ViewportFrame as a sibling of the drawing/table
// (see the call site below) rather than nested inside .viewport-actions: that
// wrapper only spans its own button row, so a flyout positioned against it
// can only ever be as tall as that row. Anchoring here instead makes
// .viewport -- the same box the drawing and table render into -- the panel's
// containing block, so it can slide out and cover that content directly via
// plain CSS (position: absolute; inset: 0 in the mobile stylesheet). This
// relies on .viewport having a real, stable height on mobile, which it gets
// from Form and Drawing being separate full-screen tabs (see App.tsx's
// .row-pane / data-mobile-view wiring).
function ViewportExportFlyout() {
    const { state, actions } = useViewportContext();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const noDrawing = state.drawingSVG === state.placeholderSVG;

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
                    : "Copy Image";

    const pngButtonTitle =
        state.pngExportState === "pending"
            ? "Rendering PNG…"
            : state.pngExportState === "success"
              ? "Saved!"
              : state.pngExportState === "error"
                ? "PNG export failed"
                : "Save as PNG";

    const pdfButtonTitle =
        state.pdfExportState === "pending"
            ? "Rendering PDF…"
            : state.pdfExportState === "success"
              ? "Saved!"
              : state.pdfExportState === "error"
                ? "PDF export failed"
                : "Save as PDF";

    const dxfButtonTitle =
        state.dxfExportState === "pending"
            ? "Rendering DXF…"
            : state.dxfExportState === "success"
              ? "Saved!"
              : state.dxfExportState === "error"
                ? "DXF export failed"
                : "Save as DXF";

    const jsonButtonTitle =
        state.saveConfigState === "success"
            ? "Saved!"
            : state.saveConfigState === "error"
              ? "Save failed"
              : "Save as JSON";

    const loadJsonButtonTitle =
        state.loadConfigState === "pending"
            ? "Loading…"
            : state.loadConfigState === "error"
              ? (state.loadConfigErrors[0] ?? "Load failed")
              : state.loadConfigState === "success"
                ? state.loadConfigErrors.length > 0
                    ? `Loaded — ${state.loadConfigErrors.length} field${
                          state.loadConfigErrors.length > 1 ? "s" : ""
                      } skipped`
                    : "Loaded!"
                : "Load JSON";

    const shareLinkButtonTitle =
        state.shareLinkState === "copied"
            ? "Link copied!"
            : state.shareLinkState === "unsupported"
              ? "Copy unsupported"
              : state.shareLinkState === "error"
                ? "Copy failed"
                : "Copy Shareable Link";

    const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.currentTarget.files?.[0];
        if (file) actions.loadConfigFromFile(file);
        // Reset so choosing the same filename again still fires a change event.
        e.currentTarget.value = "";
    };

    return (
        <div
            id="flyout-menu"
            className={`export-flyout${state.saveMenuExpanded ? " expanded" : ""}`}
            onClick={(e) => {
                const target = e.target as HTMLElement;
                // Close on a button inside the panel (close-after-action
                // behavior) or on a click that isn't
                // inside .export-card at all -- .export-card only covers
                // part of the panel's width, so anywhere else within this
                // wrapper is the dimmed drawing/table behind it, same as
                // the "click outside" affordance .floating-card gets on
                // desktop (see ViewportExportActions).
                if (target.closest("button") || !target.closest(".export-card")) {
                    actions.closeSaveMenu();
                }
            }}
        >
            <div className="action-card export-card">
                <div className="export-flyout-header">
                    <span>Export as…</span>
                    <button
                        type="button"
                        className="focus-ring export-flyout-close"
                        onClick={actions.closeSaveMenu}
                        data-title="Close"
                    >
                        <span aria-hidden="true">×</span>
                        <span className="hidden">Close</span>
                    </button>
                </div>
                <button
                    className={`focus-ring export-btn copy-button${
                        state.copyState === "copied" || state.copyState === "downloaded"
                            ? " success"
                            : ""
                    }`}
                    onClick={actions.copySVG}
                    type="button"
                    data-title={state.copyReady ? copyStatusLabel : "Preparing image…"}
                    disabled={state.copyState === "pending" || !state.copyReady}
                    aria-busy={state.copyState === "pending" || !state.copyReady}
                    hidden={noDrawing}
                >
                    {state.copyState === "copied" || state.copyState === "downloaded" ? (
                        <CheckIcon className="btn-icon" width="19" height="19" aria-hidden="true" />
                    ) : (
                        <CopyIcon className="btn-icon" width="19" height="19" aria-hidden="true" />
                    )}
                    <span className="btn-label">
                        {state.copyReady ? copyStatusLabel : "Preparing image…"}
                    </span>
                </button>

                <p className="export-flyout-section-label">Image formats</p>
                <button
                    className={`focus-ring export-btn save-pdf-button${
                        state.pdfExportState === "success"
                            ? " success"
                            : state.pdfExportState === "error"
                              ? " error"
                              : ""
                    }`}
                    onClick={actions.downloadPDF}
                    type="button"
                    data-title={pdfButtonTitle}
                    disabled={state.pdfExportState === "pending"}
                    aria-busy={state.pdfExportState === "pending"}
                    hidden={noDrawing}
                >
                    <SavePdfIcon className="btn-icon" width="19" height="19" aria-hidden="true" />
                    <span className="btn-label">{pdfButtonTitle}</span>
                </button>
                <button
                    className={`focus-ring export-btn save-png-button${
                        state.pngExportState === "success"
                            ? " success"
                            : state.pngExportState === "error"
                              ? " error"
                              : ""
                    }`}
                    onClick={actions.downloadPNG}
                    type="button"
                    data-title={pngButtonTitle}
                    disabled={state.pngExportState === "pending"}
                    aria-busy={state.pngExportState === "pending"}
                    hidden={noDrawing}
                >
                    <SavePngIcon className="btn-icon" width="19" height="19" aria-hidden="true" />
                    <span className="btn-label">{pngButtonTitle}</span>
                </button>
                <button
                    className="focus-ring export-btn save-svg-button"
                    onClick={actions.downloadSVG}
                    type="button"
                    data-title="Save as SVG"
                    hidden={noDrawing}
                >
                    <SaveSvgIcon className="btn-icon" width="19" height="19" aria-hidden="true" />
                    <span className="btn-label">Save as SVG</span>
                </button>
                <button
                    className={`focus-ring export-btn save-dxf-button${
                        state.dxfExportState === "success"
                            ? " success"
                            : state.dxfExportState === "error"
                              ? " error"
                              : ""
                    }`}
                    onClick={actions.downloadDXF}
                    type="button"
                    data-title={dxfButtonTitle}
                    disabled={state.dxfExportState === "pending"}
                    aria-busy={state.dxfExportState === "pending"}
                    hidden={noDrawing}
                >
                    <SaveDxfIcon className="btn-icon" width="19" height="19" aria-hidden="true" />
                    <span className="btn-label">{dxfButtonTitle}</span>
                </button>

                <p className="export-flyout-section-label">Config</p>
                <button
                    className={`focus-ring export-btn save-json-button${
                        state.saveConfigState === "success"
                            ? " success"
                            : state.saveConfigState === "error"
                              ? " error"
                              : ""
                    }`}
                    onClick={actions.saveConfigAsJSON}
                    type="button"
                    data-title={jsonButtonTitle}
                    hidden={noDrawing}
                >
                    <SaveJsonIcon className="btn-icon" width="19" height="19" aria-hidden="true" />
                    <span className="btn-label">{jsonButtonTitle}</span>
                </button>
                <button
                    className={`focus-ring export-btn load-json-button${
                        state.loadConfigState === "error" ? " error" : ""
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                    data-title={loadJsonButtonTitle}
                    disabled={state.loadConfigState === "pending"}
                    aria-busy={state.loadConfigState === "pending"}
                >
                    <LoadJsonIcon className="btn-icon" width="19" height="19" aria-hidden="true" />
                    <span className="btn-label">{loadJsonButtonTitle}</span>
                </button>
                <button
                    className={`focus-ring export-btn share-link-button${
                        state.shareLinkState === "copied"
                            ? " success"
                            : state.shareLinkState === "error" ||
                                state.shareLinkState === "unsupported"
                              ? " error"
                              : ""
                    }`}
                    onClick={actions.copyShareableLink}
                    type="button"
                    data-title={shareLinkButtonTitle}
                    hidden={noDrawing}
                >
                    {state.shareLinkState === "copied" ? (
                        <CheckIcon className="btn-icon" width="19" height="19" aria-hidden="true" />
                    ) : (
                        <LinkIcon className="btn-icon" width="19" height="19" aria-hidden="true" />
                    )}
                    <span className="btn-label">{shareLinkButtonTitle}</span>
                </button>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    hidden
                    onChange={handleFileInputChange}
                />
            </div>
        </div>
    );
}

// Copy-to-clipboard / download-as-file / save-load-share buttons.
// The drawing-export buttons (Copy/SVG/PNG/PDF/DXF/JSON/Link) are hidden
// until a real drawing exists -- there's nothing meaningful to export from
// the placeholder. Load JSON is the one exception: it stays visible even on
// a first-run, drawing-less session, since loading a saved design is exactly
// how someone in that state gets to a real drawing without re-typing six
// fields (see also the ViewportFrame drop zone above, which accepts the same
// file for the same reason).
function ViewportExportActions() {
    const { state, actions } = useViewportContext();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { saveMenuExpanded } = state;
    const noDrawing = state.drawingSVG === state.placeholderSVG;

    // Close flyout when clicking outside the floating card or the flyout
    // panel itself (the panel renders in ViewportExportFlyout, outside
    // .floating-card -- see that component for why).
    useEffect(() => {
        if (!saveMenuExpanded) return;
        const handleClose = (e: PointerEvent) => {
            if (!(e.target as HTMLElement).closest(".floating-card, .export-flyout")) {
                actions.closeSaveMenu();
            }
        };
        document.addEventListener("pointerdown", handleClose);
        return () => document.removeEventListener("pointerdown", handleClose);
    }, [saveMenuExpanded, actions]);

    // Close flyout on Escape key
    useEffect(() => {
        if (!saveMenuExpanded) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") actions.closeSaveMenu();
        };
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [saveMenuExpanded, actions]);

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
            : state.pngExportState === "success"
              ? "Saved!"
              : state.pngExportState === "error"
                ? "PNG export failed"
                : "Save as PNG";

    const pdfButtonTitle =
        state.pdfExportState === "pending"
            ? "Rendering PDF…"
            : state.pdfExportState === "success"
              ? "Saved!"
              : state.pdfExportState === "error"
                ? "PDF export failed"
                : "Save as PDF";

    const dxfButtonTitle =
        state.dxfExportState === "pending"
            ? "Rendering DXF…"
            : state.dxfExportState === "success"
              ? "Saved!"
              : state.dxfExportState === "error"
                ? "DXF export failed"
                : "Save as DXF";

    const jsonButtonTitle =
        state.saveConfigState === "success"
            ? "Saved!"
            : state.saveConfigState === "error"
              ? "Save failed"
              : "Save as JSON";

    const loadJsonButtonTitle =
        state.loadConfigState === "pending"
            ? "Loading…"
            : state.loadConfigState === "error"
              ? (state.loadConfigErrors[0] ?? "Load failed")
              : state.loadConfigState === "success"
                ? state.loadConfigErrors.length > 0
                    ? `Loaded — ${state.loadConfigErrors.length} field${
                          state.loadConfigErrors.length > 1 ? "s" : ""
                      } skipped`
                    : "Loaded!"
                : "Load JSON";

    const shareLinkButtonTitle =
        state.shareLinkState === "copied"
            ? "Link copied!"
            : state.shareLinkState === "unsupported"
              ? "Copy unsupported"
              : state.shareLinkState === "error"
                ? "Copy failed"
                : "Copy Shareable Link";

    const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.currentTarget.files?.[0];
        if (file) actions.loadConfigFromFile(file);
        // Reset so choosing the same filename again still fires a change event.
        e.currentTarget.value = "";
    };

    return (
        <div className="viewport-actions" data-no-context-menu>
            <div className="floating-card">
                <div className="copy-btn-wrap" hidden={noDrawing}>
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
                        className={`icon-btn-vertical focus-ring copy-button${
                            state.copyState === "copied" || state.copyState === "downloaded"
                                ? " success"
                                : ""
                        }`}
                        onClick={actions.copySVG}
                        type="button"
                        data-title={state.copyReady ? "Copy Image" : "Preparing image…"}
                        disabled={state.copyState === "pending" || !state.copyReady}
                        aria-busy={state.copyState === "pending" || !state.copyReady}
                    >
                        {state.copyState === "copied" || state.copyState === "downloaded" ? (
                            <CheckIcon className="btn-icon" width="19" height="19" aria-hidden="true" />
                        ) : (
                            <CopyIcon className="btn-icon" width="19" height="19" aria-hidden="true" />
                        )}
                        <span className="btn-micro-label" aria-hidden="true">
                            {state.copyState === "copied" || state.copyState === "downloaded" ? "Copied" : "Copy"}
                        </span>
                        <span className="btn-label">Copy Image</span>
                    </button>
                </div>

                <div className="save-buttons-group">
                    {/* Export card: SVG/PNG/PDF/DXF (visible on desktop, hidden on mobile) */}
                    <div className="action-card export-card">
                        <button
                            className="focus-ring export-btn save-svg-button"
                            onClick={actions.downloadSVG}
                            type="button"
                            data-title="Save as SVG"
                            hidden={noDrawing}
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
                                state.pngExportState === "success"
                                    ? " success"
                                    : state.pngExportState === "error"
                                      ? " error"
                                      : ""
                            }`}
                            onClick={actions.downloadPNG}
                            type="button"
                            data-title={pngButtonTitle}
                            disabled={state.pngExportState === "pending"}
                            aria-busy={state.pngExportState === "pending"}
                            hidden={noDrawing}
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
                                state.pdfExportState === "success"
                                    ? " success"
                                    : state.pdfExportState === "error"
                                      ? " error"
                                      : ""
                            }`}
                            onClick={actions.downloadPDF}
                            type="button"
                            data-title={pdfButtonTitle}
                            disabled={state.pdfExportState === "pending"}
                            aria-busy={state.pdfExportState === "pending"}
                            hidden={noDrawing}
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
                                state.dxfExportState === "success"
                                    ? " success"
                                    : state.dxfExportState === "error"
                                      ? " error"
                                      : ""
                            }`}
                            onClick={actions.downloadDXF}
                            type="button"
                            data-title={dxfButtonTitle}
                            disabled={state.dxfExportState === "pending"}
                            aria-busy={state.dxfExportState === "pending"}
                            hidden={noDrawing}
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

                    {/* PDF/Copy/JSON/Load/Share also render inside
                        ViewportExportFlyout for mobile, where this whole
                        .viewport-actions cluster is hidden in favor of the
                        toolbar + consolidated sheet -- see
                        ViewportMobileToolbar and ViewportExportFlyout. */}

                    {/* Config card: JSON save, JSON load, share link */}
                    <div className="action-card config-card">
                        <button
                            className={`focus-ring export-btn save-json-button${
                                state.saveConfigState === "success"
                                    ? " success"
                                    : state.saveConfigState === "error"
                                      ? " error"
                                      : ""
                            }`}
                            onClick={actions.saveConfigAsJSON}
                            type="button"
                            data-title={jsonButtonTitle}
                            hidden={noDrawing}
                        >
                            <SaveJsonIcon
                                className="btn-icon"
                                width="19"
                                height="19"
                                aria-hidden="true"
                            />
                            <span className="btn-label">{jsonButtonTitle}</span>
                        </button>
                        <button
                            className={`focus-ring export-btn load-json-button${
                                state.loadConfigState === "error" ? " error" : ""
                            }`}
                            onClick={() => fileInputRef.current?.click()}
                            type="button"
                            data-title={loadJsonButtonTitle}
                            disabled={state.loadConfigState === "pending"}
                            aria-busy={state.loadConfigState === "pending"}
                        >
                            <LoadJsonIcon
                                className="btn-icon"
                                width="19"
                                height="19"
                                aria-hidden="true"
                            />
                            <span className="btn-label">{loadJsonButtonTitle}</span>
                        </button>
                        <button
                            className={`focus-ring export-btn share-link-button${
                                state.shareLinkState === "copied"
                                    ? " success"
                                    : state.shareLinkState === "error" ||
                                        state.shareLinkState === "unsupported"
                                      ? " error"
                                      : ""
                            }`}
                            onClick={actions.copyShareableLink}
                            type="button"
                            data-title={shareLinkButtonTitle}
                            hidden={noDrawing}
                        >
                            {state.shareLinkState === "copied" ? (
                                <CheckIcon
                                    className="btn-icon"
                                    width="19"
                                    height="19"
                                    aria-hidden="true"
                                />
                            ) : (
                                <LinkIcon
                                    className="btn-icon"
                                    width="19"
                                    height="19"
                                    aria-hidden="true"
                                />
                            )}
                            <span className="btn-label">{shareLinkButtonTitle}</span>
                        </button>
                    </div>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    hidden
                    onChange={handleFileInputChange}
                />
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
