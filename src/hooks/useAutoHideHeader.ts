import { useEffect, useState } from "react";
import type { RefObject } from "react";

// Distance (px) the container must scroll in one direction, without
// reversing, before the header's visibility changes. Screens out the small
// back-and-forth jitter of momentum scrolling and elastic overscroll bounce,
// which would otherwise flicker the header open/closed on every frame.
const DIRECTION_THRESHOLD = 8;

// Stay visible until scrolled at least this far from the top, regardless of
// direction -- there's no point hiding the header over content that's still
// within a glance of the top edge.
const TOP_ZONE = 24;

// Hides a sticky header while the person scrolls down through a container's
// content, and reveals it again as soon as they scroll back up -- the
// common "auto-hiding" mobile toolbar/header pattern. Returns whether the
// header should currently be hidden; the caller is responsible for actually
// positioning the header (position: sticky) and applying a transform when
// this is true.
//
// A no-op if the container never scrolls (e.g. it's shorter than its own
// viewport, or -- as with .form-pane-group on desktop -- it's
// display: contents there and produces no scroll events at all).
export function useAutoHideHeader(containerRef: RefObject<HTMLElement | null>): boolean {
    const [hidden, setHidden] = useState(false);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return;
        }

        let lastDecisionScrollTop = container.scrollTop;
        let ticking = false;

        const evaluate = () => {
            ticking = false;
            const scrollTop = container.scrollTop;

            if (scrollTop <= TOP_ZONE) {
                lastDecisionScrollTop = scrollTop;
                setHidden(false);
                return;
            }

            const delta = scrollTop - lastDecisionScrollTop;
            if (delta > DIRECTION_THRESHOLD) {
                lastDecisionScrollTop = scrollTop;
                setHidden(true);
            } else if (delta < -DIRECTION_THRESHOLD) {
                lastDecisionScrollTop = scrollTop;
                setHidden(false);
            }
        };

        const onScroll = () => {
            if (ticking) {
                return;
            }
            ticking = true;
            requestAnimationFrame(evaluate);
        };

        container.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            container.removeEventListener("scroll", onScroll);
        };
    }, [containerRef]);

    return hidden;
}
