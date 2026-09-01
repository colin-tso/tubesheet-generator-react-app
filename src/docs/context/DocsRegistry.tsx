import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { EquationPreview } from "./EquationPreview";
import {
    EquationPreviewContext,
    useEquationPreview,
    type EquationPreviewState,
} from "./EquationPreviewContext";
import {
    EquationNumbersContext,
    TableNumbersContext,
    useEquationNumber,
    useTableNumber,
} from "./DocsRegistryContext";

// Shared numbering + deep-linking registry for the docs' cross-referenceable
// elements: equations (Formula/EqRef) and tables (Table/TableRef). Both are
// numbered by scanning their tagged elements in document order, once per
// content change, so a reference can never disagree with what's on screen.
//
// Equations are a special case: KaTeX numbers `align`/`gather` formulas itself,
// via a pure-CSS counter (`body { counter-reset: katexEqnNo }` in katex.css)
// that increments once per `.eqn-num` element in DOM order. That number is
// generated CSS content, not a real text node, so nothing in the DOM can read
// or link to it directly — the scan below over `[data-eq-id]` re-derives the
// same number for EqRef and deep-linking, in the same document order KaTeX's
// counter relies on. Tables have no such built-in counter, so the scan over
// `[data-table-id]` is simply the numbering.
//
// The number/preview contexts and hooks live in DocsRegistryContext.ts (not
// here) so this file can stay components-only for fast refresh.
export function DocsRegistryProvider({ children }: { children: ReactNode }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [equationNumbers, setEquationNumbers] = useState<Map<string, number> | null>(null);
    const [tableNumbers, setTableNumbers] = useState<Map<string, number> | null>(null);
    const [preview, setPreview] = useState<EquationPreviewState | null>(null);

    useLayoutEffect(() => {
        const root = containerRef.current;
        if (!root) return;
        setEquationNumbers(numberElementsInOrder(root, "data-eq-id"));
        setTableNumbers(numberElementsInOrder(root, "data-table-id"));
    }, [children]);

    const showPreview = useCallback((id: string, anchor: HTMLElement) => {
        setPreview({ id, anchor });
    }, []);
    const hidePreview = useCallback(() => setPreview(null), []);

    return (
        <div ref={containerRef}>
            <EquationNumbersContext value={equationNumbers}>
                <TableNumbersContext value={tableNumbers}>
                    <EquationPreviewContext value={{ preview, showPreview, hidePreview }}>
                        {children}
                        <EquationPreview />
                    </EquationPreviewContext>
                </TableNumbersContext>
            </EquationNumbersContext>
        </div>
    );
}

// Maps each element carrying `attr` to its 1-based position among other
// elements carrying that same attribute, in document order.
function numberElementsInOrder(root: HTMLElement, attr: string): Map<string, number> {
    const nodes = root.querySelectorAll<HTMLElement>(`[${attr}]`);
    const map = new Map<string, number>();
    nodes.forEach((node, i) => {
        const id = node.getAttribute(attr);
        if (id) map.set(id, i + 1);
    });
    return map;
}

interface EqRefProps {
    id: string;
}

// Cross-reference to a `Formula`, usable from anywhere in the docs (earlier or
// later sections). Renders as a link to the formula's anchor; the number
// matches what KaTeX rendered because both are derived from the same document
// order. Hovering or focusing it previews the referenced formula in place (see
// EquationPreview.tsx) so the reader doesn't have to jump away to see what it
// says.
export function EqRef({ id }: EqRefProps) {
    const number = useEquationNumber(id);
    const { preview, showPreview, hidePreview } = useEquationPreview();
    const anchorRef = useRef<HTMLAnchorElement>(null);
    const isActive = preview?.id === id;

    return (
        <a
            ref={anchorRef}
            className="docs-ref-link"
            href={`#/docs/eq-${id}`}
            aria-describedby={isActive ? "docs-eq-preview" : undefined}
            onPointerEnter={(e) => {
                // Touch taps aren't a hover intent — they navigate via the href
                // like any other link, so leave the preview to mouse and pen.
                if (e.pointerType === "touch") return;
                if (anchorRef.current) showPreview(id, anchorRef.current);
            }}
            onPointerLeave={hidePreview}
            onFocus={() => {
                if (anchorRef.current) showPreview(id, anchorRef.current);
            }}
            onBlur={hidePreview}
        >
            Eq.&nbsp;{number ?? "?"}
        </a>
    );
}

interface TableRefProps {
    id: string;
}

// Cross-reference to a `Table`, usable from anywhere in the docs. Renders as a
// link to the table's anchor; the number matches the table's own caption
// because both come from the same useTableNumber scan. Unlike EqRef, this has
// no hover preview — tables don't compress into a small floating panel the way
// a single formula does.
export function TableRef({ id }: TableRefProps) {
    const number = useTableNumber(id);

    return (
        <a className="docs-ref-link" href={`#/docs/table-${id}`}>
            Table&nbsp;{number ?? "?"}
        </a>
    );
}
