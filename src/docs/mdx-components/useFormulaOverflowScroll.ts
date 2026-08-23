import { useLayoutEffect } from "react";
import type { RefObject } from "react";

// Overflow must exceed this to trigger scroll; keeps subpixel KaTeX/webfont
// rounding from flapping the scroll state on and off (see Formula Overflow
// Scroll spec SC-011 / C-006).
const OVERFLOW_TOLERANCE = 0.5;
const SCROLL_END_TOLERANCE = 0.5;

// Measures a `.docs-formula-body` element for horizontal overflow and keeps
// a small set of data attributes on it in sync so DocsPage.css can drive
// the scroll container, the pinned equation number, and the edge gradients
// purely off CSS attribute selectors:
//
//   data-overflow     - present once content is wider than the box (SC-001)
//   data-scroll-start - present while scrolled to (or before) the start
//   data-scroll-end   - present while scrolled to (or past) the end
//
// Shared by Formula.tsx (the live formula box) and EquationPreview.tsx
// (which clones a formula's rendered KaTeX markup into a floating panel —
// see Formula Overflow Scroll spec SC-012) so both get identical behavior
// from one implementation.
//
// Also resets scrollLeft to 0 whenever the element's own width changes
// (container resize, panel toggle — C-009) and re-measures once KaTeX's
// async webfonts finish loading, since font metrics can shift a formula's
// rendered width after first paint (C-005).
export function useFormulaOverflowScroll(ref: RefObject<HTMLElement | null>) {
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;

        const updateOverflow = () => {
            // Measuring the whole element's scrollWidth here would be
            // circular: the pinned equation number switches from
            // `position: absolute` (no flow-width contribution) to
            // `position: sticky` (contributes to flow width) *because of*
            // data-overflow (see DocsPage.css), so scrollWidth means
            // something different depending on the very state this is
            // trying to compute — it can latch "overflowing" permanently
            // even after the underlying cause is gone, since switching to
            // sticky only ever inflates the next measurement further.
            // Measuring the formula's own glyphs (.katex-base) and the
            // pinned tag (.katex-tag) directly sidesteps that entirely:
            // both stay stable regardless of which position mode the tag
            // is currently in, so there's no feedback loop. Reserving the
            // tag's width alongside the glyphs (rather than just checking
            // the glyphs against the box) matters too — a formula whose
            // glyphs alone fit the box can still have its tail rendered
            // right under the pinned, opaque tag otherwise, which hides
            // part of the formula rather than just looking a little tight.
            const base = el.querySelector<HTMLElement>(".katex-base");
            const tag = el.querySelector<HTMLElement>(".katex-tag");
            let isOverflowing: boolean;
            if (base) {
                const baseWidth = base.getBoundingClientRect().width;
                const tagWidth = tag ? tag.getBoundingClientRect().width : 0;
                isOverflowing = baseWidth + tagWidth - el.clientWidth >= OVERFLOW_TOLERANCE;
            } else {
                isOverflowing = el.scrollWidth - el.clientWidth >= OVERFLOW_TOLERANCE;
            }
            if (isOverflowing) {
                el.dataset.overflow = "true";
            } else {
                delete el.dataset.overflow;
            }
        };

        const updateScrollAttributes = () => {
            const { scrollLeft, clientWidth, scrollWidth } = el;
            if (scrollLeft <= 0) {
                el.dataset.scrollStart = "true";
            } else {
                delete el.dataset.scrollStart;
            }
            if (scrollLeft + clientWidth >= scrollWidth - SCROLL_END_TOLERANCE) {
                el.dataset.scrollEnd = "true";
            } else {
                delete el.dataset.scrollEnd;
            }
        };

        const handleScroll = () => updateScrollAttributes();

        let previousWidth = el.clientWidth;

        const observer = new ResizeObserver(() => {
            const currentWidth = el.clientWidth;
            if (currentWidth !== previousWidth) {
                previousWidth = currentWidth;
                el.scrollLeft = 0;
            }
            updateOverflow();
            updateScrollAttributes();
        });

        observer.observe(el);
        el.addEventListener("scroll", handleScroll, { passive: true });

        updateOverflow();
        updateScrollAttributes();

        document.fonts.ready.then(() => {
            updateOverflow();
            updateScrollAttributes();
        });

        return () => {
            observer.disconnect();
            el.removeEventListener("scroll", handleScroll);
        };
    }, [ref]);
}
