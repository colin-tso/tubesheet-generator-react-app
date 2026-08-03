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

export function useShellOtlHighlight(
    containerRef: RefObject<HTMLDivElement | null>,
    drawingSVG: SVGSVGElement,
    lastSingleResult: SingleResultPayload,
) {
    const [hovered, setHovered] = useState<HighlightRegion>(null);
    const tooltipRef = useRef<HTMLDivElement | null>(null);

    // Cache the shell/OTL circle elements so we don't query the DOM on every mouse move.
    const circleRefs = useRef<{
        shell: SVGCircleElement | null;
        OTL: SVGCircleElement | null;
    }>({ shell: null, OTL: null });

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !lastSingleResult) return;

        const shellDiameter = getEffectiveShellID(lastSingleResult);
        const OTLDiameter = lastSingleResult.OTL;
        if (!utils.isNumber(shellDiameter) || !utils.isNumber(OTLDiameter)) return;

        // Query once when drawing changes.
        const [shellCircle, OTLCircle] = Array.from(
            drawingSVG.querySelectorAll<SVGCircleElement>("circle:not([id])"),
        );
        circleRefs.current = { shell: shellCircle || null, OTL: OTLCircle || null };

        // Apply hover stroke width as a CSS custom property.
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
            const { shell, OTL } = circleRefs.current;
            shell?.classList.toggle("region-hovered", region === "shell");
            OTL?.classList.toggle("region-hovered", region === "OTL");
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

            const { shell, OTL } = circleRefs.current;
            if (!shell || !OTL) return; // should not happen

            const shellR = shellDiameter / 2;
            const OTLR = OTLDiameter / 2;
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
