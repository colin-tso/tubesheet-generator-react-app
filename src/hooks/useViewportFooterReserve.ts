import { useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { DRAWING_SAFE_CONTENT_RADIUS_FRACTION } from "@/plugins/tubesheet-layout-generator";
import type { SingleResultPayload } from "./useTubeSheetWorker";

// px the viewport must widen past the engage point before releasing the reserve
const RESERVE_RELEASE_BUFFER = 0;

// Single slack value, used both for the "does the table foul the drawing?"
// clearance test and for the gap left between the drawing and the table once
// the reserve engages.
export const FOOTER_RESERVE_SAFETY_MARGIN = 12; // px

interface UseViewportFooterReserveOptions {
    containerRef: RefObject<HTMLDivElement | null>;
    footerRef: RefObject<HTMLDivElement | null>;
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
//
// The reserve is measured from the *table*, not from the footer wrapper.
// .viewport-overlay-footer is a wrapping flex row holding the table and the
// .viewport-actions export button column, so its height is whichever of the
// two is taller (or their sum once they wrap). At desktop widths where the
// button column outgrows the table, a footer-height reserve tracks the
// buttons -- a number unrelated to the obstacle the clearance test above
// actually measured. The button column is deliberately *not* an obstacle
// here: like .viewport-options and .viewport-help it is treated as corner
// chrome the drawing is allowed to sit behind.
export function useViewportFooterReserve({
    containerRef,
    footerRef,
    tableEl,
    showTable,
    lastSingleResult,
    basePadding,
}: UseViewportFooterReserveOptions) {
    const [viewportBottomReserve, setViewportBottomReserve] = useState(basePadding);

    const reservedRef = useRef(false);
    const reservedAtWidthRef = useRef(0);

    useLayoutEffect(() => {
        const viewportEl = containerRef.current;
        const footerEl = footerRef.current;
        if (!viewportEl || !footerEl) {
            return;
        }

        // Fresh data or table visibility means a fresh evaluation baseline;
        // stickiness (see below) should only persist across pure resizing.
        reservedRef.current = false;

        const recompute = () => {
            const viewportRect = viewportEl.getBoundingClientRect();
            const tableRect = tableEl?.getBoundingClientRect();
            const tableVisible =
                !tableEl ||
                (!!tableRect &&
                    tableRect.width > 0 &&
                    tableRect.height > 0 &&
                    !tableEl.hasAttribute("hidden"));
            if (viewportRect.width <= 0 || viewportRect.height <= 0) {
                return;
            }

            // Reading the table's top edge is only padding-independent while
            // the footer is anchored to the viewport's padding box. Under the
            // narrow-screen rules .viewport.has-table switches the footer to
            // position: static, which puts it back in flow -- there the
            // reserve we apply would move the very edge we measure, and the
            // two would chase each other. That breakpoint stacks the footer
            // below the drawing anyway, so no reserve is wanted.
            const footerPosition =
                footerEl.ownerDocument.defaultView?.getComputedStyle(footerEl).position;
            if (footerPosition === "static") {
                reservedRef.current = false;
                setViewportBottomReserve(basePadding);
                return;
            }

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
                          const safeRadiusWithMargin =
                              safeRadius + FOOTER_RESERVE_SAFETY_MARGIN;
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

            // Distance from the table's top edge down to the viewport's bottom
            // edge. This already carries the footer's own bottom inset, and it
            // grows on its own if the footer wraps and pushes the table onto a
            // row of its own -- no hand-tuned offset needed.
            const tableClearance = tableRect
                ? viewportRect.bottom - tableRect.top + FOOTER_RESERVE_SAFETY_MARGIN
                : basePadding;

            setViewportBottomReserve(
                needsReserve ? Math.max(basePadding, Math.ceil(tableClearance)) : basePadding,
            );
        };

        recompute();

        const observer =
            typeof ResizeObserver === "undefined" ? null : new ResizeObserver(recompute);
        observer?.observe(viewportEl);
        // The footer wrapper itself is deliberately not observed: it resizes
        // when the export button column changes (copy status label, PDF card),
        // which has no bearing on the reserve and only causes churn.
        if (tableEl) {
            observer?.observe(tableEl);
        }

        window.addEventListener("resize", recompute);
        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", recompute);
        };
    }, [containerRef, footerRef, tableEl, showTable, lastSingleResult, basePadding]);

    return { viewportBottomReserve };
}
