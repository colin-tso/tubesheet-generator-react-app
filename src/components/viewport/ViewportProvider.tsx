import { useCallback, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useContextMenu } from "@/hooks/useContextMenu";
import { useSvgExportActions } from "@/hooks/useSvgExportActions";
import { useViewportFooterReserve } from "@/hooks/useViewportFooterReserve";
import { useShellOtlHighlight } from "@/hooks/useShellOTLHighlight";
import type { SingleResultPayload } from "@/hooks/useTubeSheetWorker";
import { ViewportContext, type ViewportContextValue } from "./ViewportContext";

// Reads/writes a boolean preference to localStorage, initialized lazily so the
// read only happens once per mount.
function usePersistedBoolean(key: string, initial: boolean) {
    const [value, setValue] = useState<boolean>(() => {
        const stored = window.localStorage.getItem(key);
        return stored === null ? initial : stored === "true";
    });
    const setPersisted = useCallback(
        (updater: boolean | ((prev: boolean) => boolean)) => {
            setValue((prev) => {
                const next =
                    typeof updater === "function"
                        ? (updater as (p: boolean) => boolean)(prev)
                        : updater;
                window.localStorage.setItem(key, String(next));
                return next;
            });
        },
        [key],
    );
    return [value, setPersisted] as const;
}

// The subset of useTubeSheetWorker's return value the viewport reacts to.
interface ViewportWorkerSlice {
    drawingSVG: SVGSVGElement;
    lastSingleResult: SingleResultPayload;
    isCalculating: boolean;
    showLoadingBadge: boolean;
    calcError: string | null;
    announcement: string;
    onDrawingRendered: () => void;
}

interface ViewportProviderProps {
    children: ReactNode;
    worker: ViewportWorkerSlice;
    placeholderSVG: SVGSVGElement;
    drawingTableLabel: string;
    drawingTableRequestedTubes: number | undefined;
    basePadding: number;
}

// Owns grid/table preferences, the context menu, SVG copy/export, the
// footer-overlap measurement, and shell/OTL hover highlighting. UI in
// Viewport.tsx only reads the ViewportContext interface, so any of these
// implementations can change without touching the components that render.
export function ViewportProvider({
    children,
    worker,
    placeholderSVG,
    drawingTableLabel,
    drawingTableRequestedTubes,
    basePadding,
}: ViewportProviderProps) {
    const {
        drawingSVG,
        lastSingleResult,
        isCalculating,
        showLoadingBadge,
        calcError,
        announcement,
        onDrawingRendered,
    } = worker;

    const [showGrid, setShowGrid] = usePersistedBoolean("view-options.showGrid", true);
    const [showTable, setShowTable] = usePersistedBoolean("view-options.showTable", true);

    const containerRef = useRef<HTMLDivElement>(null);
    const footerRef = useRef<HTMLDivElement>(null);
    const [tableEl, setTableEl] = useState<HTMLTableElement | null>(null);

    const {
        contextMenuPos,
        contextMenuAnimationState,
        openContextMenu,
        requestClose,
        onAnimationEnd,
    } = useContextMenu(containerRef);

    const { copyState, downloadSVG, downloadPNG, pngExportState, copySVG, copyReady } =
        useSvgExportActions(drawingSVG);

    const { viewportBottomReserve } = useViewportFooterReserve({
        containerRef,
        footerRef,
        tableEl,
        showTable,
        lastSingleResult,
        basePadding,
    });

    const { hovered, tooltipRef } = useShellOtlHighlight(
        containerRef,
        drawingSVG,
        lastSingleResult,
    );

    const viewportStyle = useMemo<CSSProperties>(
        () => ({ "--viewport-footer-reserve": `${viewportBottomReserve}px` }) as CSSProperties,
        [viewportBottomReserve],
    );

    const toggleGrid = useCallback(() => setShowGrid((v) => !v), [setShowGrid]);
    const toggleTable = useCallback(() => setShowTable((v) => !v), [setShowTable]);

    const value = useMemo<ViewportContextValue>(
        () => ({
            state: {
                showGrid,
                showTable,
                isBusy: isCalculating || copyState === "pending" || pngExportState === "pending",
                drawingSVG,
                placeholderSVG,
                lastSingleResult,
                calcError,
                showLoadingBadge,
                announcement,
                copyState,
                copyReady,
                pngExportState,
                contextMenuPos,
                contextMenuAnimationState,
                hovered,
                drawingTableLabel,
                drawingTableRequestedTubes,
                viewportStyle,
            },
            actions: {
                toggleGrid,
                toggleTable,
                copySVG,
                downloadSVG,
                downloadPNG,
                onDrawingRendered,
                openContextMenu,
                closeContextMenu: requestClose,
                onContextMenuAnimationEnd: onAnimationEnd,
                setTableEl,
            },
            meta: { containerRef, footerRef, tooltipRef },
        }),
        [
            showGrid,
            showTable,
            isCalculating,
            drawingSVG,
            placeholderSVG,
            lastSingleResult,
            calcError,
            showLoadingBadge,
            announcement,
            copyState,
            copyReady,
            pngExportState,
            contextMenuPos,
            contextMenuAnimationState,
            hovered,
            drawingTableLabel,
            drawingTableRequestedTubes,
            viewportStyle,
            toggleGrid,
            toggleTable,
            copySVG,
            downloadSVG,
            downloadPNG,
            onDrawingRendered,
            openContextMenu,
            requestClose,
            onAnimationEnd,
            tooltipRef,
        ],
    );

    return <ViewportContext value={value}>{children}</ViewportContext>;
}
