import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useEquationPreview } from "./EquationPreviewContext";

// Gap between the EqRef link and the panel, and the minimum distance it keeps
// from the window edge — same shape as the shell/OTL hover tooltip's
// positioning (see useShellOTLHighlight.ts), anchored to an element's rect here
// instead of the cursor.
const PREVIEW_ANCHOR_GAP = 8;
const PREVIEW_EDGE_MARGIN = 12;

interface PreviewContent {
    label: string | null;
    bodyHTML: string;
}

// Reads a Formula's already-rendered KaTeX markup straight off the DOM by id,
// rather than re-invoking KaTeX: Formula.tsx's `id={`eq-${id}`}` is unique
// across the page, so this is a plain lookup, and the markup is exactly what's
// on screen for that formula (including the same document-order equation
// number, since neither side re-derives anything).
function readFormulaPreview(id: string): PreviewContent | null {
    const formulaEl = document.getElementById(`eq-${id}`);
    if (!formulaEl) return null;
    const bodyEl = formulaEl.querySelector<HTMLElement>(".docs-formula-body");
    if (!bodyEl) return null;
    const labelEl = formulaEl.querySelector<HTMLElement>(".docs-formula-label");
    return { label: labelEl?.textContent ?? null, bodyHTML: bodyEl.innerHTML };
}

function positionPreview(panel: HTMLElement, anchorRect: DOMRect) {
    const { width, height } = panel.getBoundingClientRect();

    // Centered under the anchor by default.
    let left = anchorRect.left + anchorRect.width / 2 - width / 2;
    let top = anchorRect.bottom + PREVIEW_ANCHOR_GAP;

    // Flip above the anchor if it would clip the bottom edge.
    if (top + height + PREVIEW_EDGE_MARGIN > window.innerHeight) {
        top = anchorRect.top - PREVIEW_ANCHOR_GAP - height;
    }

    // Clamp horizontally so it never runs off either edge.
    left = Math.min(
        Math.max(left, PREVIEW_EDGE_MARGIN),
        Math.max(window.innerWidth - width - PREVIEW_EDGE_MARGIN, PREVIEW_EDGE_MARGIN),
    );

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
}

// Single floating preview shared by every EqRef in the docs (see
// DocsRegistry.tsx's EquationPreviewContext) — only one can be open at a time,
// so one panel that repositions itself is simpler than each link owning a
// popover.
export function EquationPreview() {
    const { preview, hidePreview } = useEquationPreview();
    const panelRef = useRef<HTMLDivElement>(null);
    // Keeps showing the last-hovered formula while the panel fades out instead
    // of going blank the instant `preview` clears, same trick ShellOTLTooltip
    // uses for the shell/OTL hover readout.
    const [content, setContent] = useState<PreviewContent | null>(null);

    if (preview) {
        const next = readFormulaPreview(preview.id);
        if (next && (next.label !== content?.label || next.bodyHTML !== content?.bodyHTML)) {
            setContent(next);
        }
    }

    useLayoutEffect(() => {
        const panel = panelRef.current;
        if (!preview || !panel) return;
        positionPreview(panel, preview.anchor.getBoundingClientRect());
    }, [preview, content]);

    useEffect(() => {
        if (!preview) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") hidePreview();
        };
        // Scrolling or resizing can move the anchor out from under a
        // fixed-position panel; dismissing rather than re-tracking keeps this
        // simple, and pointer/focus already cover it 99% of the time.
        const onScrollOrResize = () => hidePreview();
        // Touch devices have no hover to leave, so a tap anywhere outside the
        // anchor is the only way those readers get to dismiss it.
        const onPointerDownOutside = (e: PointerEvent) => {
            if (e.target instanceof Node && !preview.anchor.contains(e.target)) {
                hidePreview();
            }
        };

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("scroll", onScrollOrResize, { passive: true, capture: true });
        window.addEventListener("resize", onScrollOrResize);
        document.addEventListener("pointerdown", onPointerDownOutside);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("scroll", onScrollOrResize, true);
            window.removeEventListener("resize", onScrollOrResize);
            document.removeEventListener("pointerdown", onPointerDownOutside);
        };
    }, [preview, hidePreview]);

    return (
        <div
            id="docs-eq-preview"
            className={`docs-eq-preview noselect${preview ? " visible" : ""}`}
            ref={panelRef}
            role="status"
            aria-live="polite"
            aria-hidden={!preview}
        >
            {content?.label && <span className="docs-formula-label">{content.label}</span>}
            {content && (
                <div
                    className="docs-formula-body"
                    // Cloning already-rendered markup from this app's own
                    // build-time rehype-katex output (see Formula.tsx and
                    // readFormulaPreview above) — not user input, so this is
                    // the same trust boundary as the original.
                    dangerouslySetInnerHTML={{ __html: content.bodyHTML }}
                />
            )}
        </div>
    );
}
