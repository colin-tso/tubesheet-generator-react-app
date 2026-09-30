import { createContext, use } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, RefObject } from "react";
import type { AnimationLifecycle } from "@/hooks/useContextMenu";
import type {
    CopyState,
    DxfExportState,
    PdfExportState,
    PngExportState,
} from "@/hooks/useSvgExportActions";
import type {
    LoadConfigState,
    SaveConfigState,
    ShareLinkState,
} from "@/hooks/useLayoutConfigActions";
import type { SingleResultPayload } from "@/hooks/useTubeSheetWorker";
import type { HighlightRegion } from "@/hooks/useShellOTLHighlight";

// Generic state/actions/meta interface. Any provider that implements this shape
// can drive the Viewport.* components below -- they only depend on the
// interface, not on how the state is produced.
export interface ViewportState {
    showGrid: boolean;
    showTable: boolean;
    showTubeLabels: boolean;
    isBusy: boolean;
    drawingSVG: SVGSVGElement;
    placeholderSVG: SVGSVGElement;
    lastSingleResult: SingleResultPayload;
    calcError: string | null;
    showLoadingBadge: boolean;
    announcement: string;
    copyState: CopyState;
    copyReady: boolean;
    pngExportState: PngExportState;
    pdfExportState: PdfExportState;
    dxfExportState: DxfExportState;
    saveConfigState: SaveConfigState;
    loadConfigState: LoadConfigState;
    loadConfigErrors: string[];
    shareLinkState: ShareLinkState;
    // Whether the mobile "more export formats" flyout is open. Lives here
    // (rather than as local state in ViewportExportActions) so the flyout
    // panel itself can be rendered by ViewportFrame as a sibling of the
    // drawing/table -- see ViewportExportFlyout -- while the toggle button
    // that drives it stays in ViewportExportActions.
    saveMenuExpanded: boolean;
    // Which mobile "tab" is active -- Form or Drawing (see App.tsx's .row-pane
    // / data-mobile-view wiring). Unused at desktop widths, where both panes
    // are always visible side by side; CSS only reacts to it inside the mobile
    // breakpoint. Lives here (rather than local state in App) so both the
    // form's submit handler and the tab bar itself can read/set it via
    // context, matching how showGrid/showTable etc. already work.
    mobileActiveView: "form" | "drawing";
    contextMenuPos: { x: number; y: number };
    contextMenuAnimationState: AnimationLifecycle;
    hovered: HighlightRegion;
    drawingTableLabel: string;
    drawingTableRequestedTubes: number | undefined;
    viewportStyle: CSSProperties;
}

export interface ViewportActions {
    toggleGrid: () => void;
    toggleTable: () => void;
    toggleTubeLabels: () => void;
    copySVG: () => void;
    downloadSVG: () => void;
    downloadPNG: () => void;
    downloadPDF: () => void;
    downloadDXF: () => void;
    saveConfigAsJSON: () => void;
    loadConfigFromFile: (file: File) => void;
    copyShareableLink: () => void;
    toggleSaveMenu: () => void;
    closeSaveMenu: () => void;
    setMobileActiveView: (view: "form" | "drawing") => void;
    onDrawingRendered: () => void;
    openContextMenu: (e: ReactMouseEvent<HTMLDivElement>) => void;
    closeContextMenu: () => void;
    onContextMenuAnimationEnd: () => void;
    setTableEl: (el: HTMLTableElement | null) => void;
}

export interface ViewportMeta {
    containerRef: RefObject<HTMLDivElement | null>;
    footerRef: RefObject<HTMLDivElement | null>;
    tooltipRef: RefObject<HTMLDivElement | null>;
}

export interface ViewportContextValue {
    state: ViewportState;
    actions: ViewportActions;
    meta: ViewportMeta;
}

export const ViewportContext = createContext<ViewportContextValue | null>(null);

// Components that need shared viewport state just need to render inside
// Viewport.Provider -- they don't need to be visually inside Viewport.Frame.
export function useViewportContext(): ViewportContextValue {
    const ctx = use(ViewportContext);
    if (!ctx) {
        throw new Error("Viewport.* components must be rendered inside <Viewport.Provider>");
    }
    return ctx;
}
