import { useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { DRAWING_SAFE_CONTENT_RADIUS_FRACTION } from "../plugins/tubesheet-layout-generator";
import type { SingleResultPayload } from "./useTubeSheetWorker";

// px the viewport must widen past the engage point before releasing the reserve
const RESERVE_RELEASE_BUFFER = 0;

interface UseViewportFooterReserveOptions {
    containerRef: RefObject<HTMLDivElement | null>;
    footerRef: RefObject<HTMLDivElement | null>;
    actionsRef: RefObject<HTMLDivElement | null>;
    tableEl: HTMLTableElement | null;
    showTable: boolean;
    lastSingleResult: SingleResultPayload;
    basePadding: number;
}

// Reserve table space only if it overlaps the drawing. The drawing is a
// circle in a centered square, so corners are normally empty. Reserve
// space for the footer as the viewport shrinks, rather than re-testing
// clearance every resize. Release when the viewport widens past its
// initial engagement or the table stops showing.
export function useViewportFooterReserve({
    containerRef,
    footerRef,
    actionsRef,
    tableEl,
    showTable,
    lastSingleResult,
    basePadding,
}: UseViewportFooterReserveOptions) {
    const [actionsStacked, setActionsStacked] = useState(false);
    const [viewportBottomReserve, setViewportBottomReserve] = useState(basePadding);

    const reservedRef = useRef(false);
    const reservedAtWidthRef = useRef(0);

    useLayoutEffect(() => {
        const viewportEl = containerRef.current;
        const footerEl = footerRef.current;
        const actionsEl = actionsRef.current;
        if (!viewportEl || !footerEl || !actionsEl) {
            return;
        }

        const SAFETY_MARGIN = 12; // px

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
            const contentWidth = viewportRect.width - 2 * basePadding;
            const contentHeight = viewportRect.height - 2 * basePadding;
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
                    ? Math.max(basePadding, Math.ceil(footerRect.height) + 44)
                    : basePadding,
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
    }, [containerRef, footerRef, actionsRef, tableEl, showTable, lastSingleResult, basePadding]);

    return { actionsStacked, viewportBottomReserve };
}
