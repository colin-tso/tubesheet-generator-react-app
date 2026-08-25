import { createContext, useContext } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, RefObject } from "react";
import type { AnimationLifecycle } from "@/hooks/useContextMenu";
import type { CopyState, PngExportState } from "@/hooks/useSvgExportActions";
import type { SingleResultPayload } from "@/hooks/useTubeSheetWorker";
import type { HighlightRegion } from "@/hooks/useShellOTLHighlight";

// Generic state/actions/meta interface. Any provider that implements this shape
// can drive the Viewport.* components below -- they only depend on the
// interface, not on how the state is produced.
export interface ViewportState {
    showGrid: boolean;
    showTable: boolean;
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
    copySVG: () => void;
    downloadSVG: () => void;
    downloadPNG: () => void;
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
    const ctx = useContext(ViewportContext);
    if (!ctx) {
        throw new Error("Viewport.* components must be rendered inside <Viewport.Provider>");
    }
    return ctx;
}
