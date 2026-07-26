import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { getEffectiveShellID } from "../plugins/tubesheet-layout-generator";
import type { SingleResultPayload } from "./useTubeSheetWorker";
import { utils } from "../utils/";

export type HighlightRegion = "shell" | "OTL" | null;

// Hit tolerance in screen px.
const HIT_TOLERANCE_PX = 8;

// Hover stroke-width scales up from each ring's own base width.
const HIGHLIGHT_STROKE_MULTIPLIER = 2;
const HIGHLIGHT_STROKE_MIN_INCREASE = 1;

// Tooltip cursor offset and minimum distance from the window edge.
const TOOLTIP_CURSOR_OFFSET = 16;
const TOOLTIP_EDGE_MARGIN = 8;

/**
 * Tracks the pointer over the tubesheet drawing to determine whether it's
 * hovering the shell or OTL to trigger highlight and tooltip.
 *
 * Shell/OTL are the only circles without an "id" (every tube gets one), so
 * they're found via `circle:not([id])`. Hit-testing uses the SVG's own
 * user-space "getScreenCTM" to stay accurate at any zoom, since the circles use
 * "vector-effect: non-scaling-stroke" and can be just a px or two wide.
 */
export function useShellOtlHighlight(
    containerRef: RefObject<HTMLDivElement | null>,
    drawingSVG: SVGSVGElement,
    lastSingleResult: SingleResultPayload,
) {
    const [hovered, setHovered] = useState<HighlightRegion>(null);
    const tooltipRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !lastSingleResult) return;

        const shellDiameter = getEffectiveShellID(lastSingleResult);
        const OTLDiameter = lastSingleResult.OTL;
        if (!utils.isNumber(shellDiameter) || !utils.isNumber(OTLDiameter)) return;

        const shellR = shellDiameter / 2;
        const OTLR = OTLDiameter / 2;

        // Draw order is shell, then OTL, then (id-bearing) tube circles.
        const [shellCircle, OTLCircle] = Array.from(
            drawingSVG.querySelectorAll<SVGCircleElement>("circle:not([id])"),
        );

        // Expose each circle's scaled-up hover width to CSS as a custom property.
        const applyHighlightWidth = (circle: SVGCircleElement | undefined) => {
            if (!circle) return;
            const base = parseFloat(circle.getAttribute("stroke-width") ?? "") || 1;
            const hoverWidth = Math.max(
                base * HIGHLIGHT_STROKE_MULTIPLIER,
                base + HIGHLIGHT_STROKE_MIN_INCREASE,
            );
            circle.style.setProperty("--region-hover-stroke-width", hoverWidth.toString());
        };
        applyHighlightWidth(shellCircle);
        applyHighlightWidth(OTLCircle);

        const setActiveRegion = (region: HighlightRegion) => {
            shellCircle?.classList.toggle("region-hovered", region === "shell");
            OTLCircle?.classList.toggle("region-hovered", region === "OTL");
            container.style.cursor = region ? "pointer" : "";
        };

        const positionTooltip = (clientX: number, clientY: number) => {
            const tooltip = tooltipRef.current;
            if (!tooltip) return;

            const { width, height } = tooltip.getBoundingClientRect();

            // Default: down-right of the cursor.
            let left = clientX + TOOLTIP_CURSOR_OFFSET;
            let top = clientY + TOOLTIP_CURSOR_OFFSET;

            // Flip to the opposite side if it would clip the right/bottom edge.
            if (left + width + TOOLTIP_EDGE_MARGIN > window.innerWidth) {
                left = clientX - TOOLTIP_CURSOR_OFFSET - width;
            }
            if (top + height + TOOLTIP_EDGE_MARGIN > window.innerHeight) {
                top = clientY - TOOLTIP_CURSOR_OFFSET - height;
            }

            // Clamp in case flipping still isn't enough (e.g. small window).
            left = Math.min(
                Math.max(left, TOOLTIP_EDGE_MARGIN),
                Math.max(window.innerWidth - width - TOOLTIP_EDGE_MARGIN, TOOLTIP_EDGE_MARGIN),
            );
            top = Math.min(
                Math.max(top, TOOLTIP_EDGE_MARGIN),
                Math.max(window.innerHeight - height - TOOLTIP_EDGE_MARGIN, TOOLTIP_EDGE_MARGIN),
            );

            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
        };

        const handlePointerMove = (e: PointerEvent) => {
            if (!drawingSVG.isConnected) return;

            const ctm = drawingSVG.getScreenCTM();
            if (!ctm) return;

            // Pointer position in SVG user-space (rings are centered at origin).
            const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
            const distFromCentre = Math.hypot(pt.x, pt.y);

            const scale = ctm.a || 1;
            const tolerance = HIT_TOLERANCE_PX / scale;

            const shellDelta = Math.abs(distFromCentre - shellR);
            const OTLDelta = Math.abs(distFromCentre - OTLR);

            let region: HighlightRegion = null;
            if (shellDelta <= tolerance || OTLDelta <= tolerance) {
                region = shellDelta <= OTLDelta ? "shell" : "OTL";
            }

            setActiveRegion(region);
            positionTooltip(e.clientX, e.clientY);
            setHovered((prev) => (prev === region ? prev : region));
        };

        const handlePointerLeave = () => {
            setActiveRegion(null);
            setHovered(null);
        };

        container.addEventListener("pointermove", handlePointerMove);
        container.addEventListener("pointerleave", handlePointerLeave);

        return () => {
            container.removeEventListener("pointermove", handlePointerMove);
            container.removeEventListener("pointerleave", handlePointerLeave);
            container.style.cursor = "";
        };
    }, [containerRef, drawingSVG, lastSingleResult]);

    return { hovered, tooltipRef };
}
