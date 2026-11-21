import { useEffect } from "react";
import type { ITubeSheetData } from "@/plugins/tubesheet-layout-generator";
import { removeDimensions, renderDimensions } from "@/utils/dimensions";

/**
 * Keeps the dimension callouts on `svg` in step with the data and the
 * drawing's on-screen size, so their text stays a constant size in px.
 * Removes them when `enabled` is false or there is no result.
 */
export function useDimensions(
    svg: SVGSVGElement,
    data: ITubeSheetData | null,
    enabled: boolean,
    scaleBarInSvg = true,
): void {
    useEffect(() => {
        if (!enabled || !data) {
            removeDimensions(svg);
            return;
        }

        const draw = () => {
            const viewport = svg.closest(".viewport");
            const rect = viewport?.getBoundingClientRect();
            // Keep labels clear of the floating toolbar on the right.
            const toolbar = viewport?.querySelector(".viewport-options")?.getBoundingClientRect();
            const bounds = rect
                ? {
                      left: rect.left,
                      right:
                          toolbar && toolbar.width > 0
                              ? Math.min(rect.right, toolbar.left)
                              : rect.right,
                      top: rect.top,
                      bottom: rect.bottom,
                  }
                : undefined;
            renderDimensions(svg, data, { bounds, scaleBar: scaleBarInSvg });
        };
        draw();

        let frame = 0;
        const schedule = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(draw);
        };
        const observer =
            typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
        observer?.observe(svg);
        const viewport = svg.closest(".viewport");
        if (viewport) observer?.observe(viewport);
        window.addEventListener("resize", schedule);

        return () => {
            cancelAnimationFrame(frame);
            observer?.disconnect();
            window.removeEventListener("resize", schedule);
            removeDimensions(svg);
        };
    }, [svg, data, enabled, scaleBarInSvg]);
}
