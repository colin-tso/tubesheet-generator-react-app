import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";

// Stacks the viewport's option buttons under the "Layout Preview" label
// once their measured row width would overlap it, using real child widths
// instead of a fixed viewport breakpoint.
export function useOptionsStackLayout(
    labelRef: RefObject<HTMLElement | null>,
    optionsRef: RefObject<HTMLElement | null>,
) {
    const [optionsStacked, setOptionsStacked] = useState(false);

    useLayoutEffect(() => {
        const labelEl = labelRef.current;
        const optionsEl = optionsRef.current;
        if (!labelEl || !optionsEl) {
            return;
        }

        const SAFETY_MARGIN = 12; // px

        const recompute = () => {
            const labelRect = labelEl.getBoundingClientRect();
            const optionsRect = optionsEl.getBoundingClientRect();
            const buttonRects = Array.from(optionsEl.children)
                .map((child) => child.getBoundingClientRect())
                .filter((rect) => rect.width > 0 || rect.height > 0);

            if (labelRect.width <= 0 || optionsRect.width <= 0 || buttonRects.length === 0) {
                return;
            }

            // Use --options-row-gap for row spacing even when stacked, so the
            // gap stays correct without duplicating the value. See
            // .viewport-options in index.css.
            const rowGap =
                parseFloat(getComputedStyle(optionsEl).getPropertyValue("--options-row-gap")) || 0;

            const buttonsWidth = buttonRects.reduce((sum, rect) => sum + rect.width, 0);
            const rowWidth = buttonsWidth + rowGap * (buttonRects.length - 1);
            const rowLeftEdge = optionsRect.right - rowWidth;

            setOptionsStacked(rowLeftEdge < labelRect.right + SAFETY_MARGIN);
        };

        recompute();

        const observer =
            typeof ResizeObserver === "undefined" ? null : new ResizeObserver(recompute);
        observer?.observe(labelEl);
        observer?.observe(optionsEl);
        Array.from(optionsEl.children).forEach((child) => observer?.observe(child));
        window.addEventListener("resize", recompute);
        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", recompute);
        };
    }, [labelRef, optionsRef]);

    return optionsStacked;
}
