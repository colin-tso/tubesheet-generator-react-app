import {
    createContext,
    useCallback,
    useContext,
    useLayoutEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { EquationPreview } from "./EquationPreview";
import {
    EquationPreviewContext,
    useEquationPreview,
    type EquationPreviewState,
} from "./EquationPreviewContext";

// KaTeX numbers `align`/`gather` formulas itself, via a pure-CSS counter (`body
// { counter-reset: katexEqnNo }` in katex.css) that increments once per
// `.eqn-num` element in DOM order across the whole page. That number is
// generated CSS content, not a real text node, so nothing in the DOM can read
// or link to it directly.
//
// This registry re-derives the same number for cross-referencing (EqRef) and
// deep-linking by scanning the same elements in the same document order KaTeX's
// counter relies on (every `Formula`, tagged with
// `data-eq-id`), so it can never disagree with what's rendered on screen.
const EquationNumbersContext = createContext<Map<string, number> | null>(null);

export function EquationRegistryProvider({ children }: { children: ReactNode }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [numbers, setNumbers] = useState<Map<string, number> | null>(null);
    const [preview, setPreview] = useState<EquationPreviewState | null>(null);

    useLayoutEffect(() => {
        const root = containerRef.current;
        if (!root) return;
        const nodes = root.querySelectorAll<HTMLElement>("[data-eq-id]");
        const map = new Map<string, number>();
        nodes.forEach((node, i) => {
            const id = node.dataset.eqId;
            if (id) map.set(id, i + 1);
        });
        setNumbers(map);
    }, [children]);

    const showPreview = useCallback((id: string, anchor: HTMLElement) => {
        setPreview({ id, anchor });
    }, []);
    const hidePreview = useCallback(() => setPreview(null), []);

    return (
        <div ref={containerRef}>
            <EquationNumbersContext.Provider value={numbers}>
                <EquationPreviewContext.Provider value={{ preview, showPreview, hidePreview }}>
                    {children}
                    <EquationPreview />
                </EquationPreviewContext.Provider>
            </EquationNumbersContext.Provider>
        </div>
    );
}

function useEquationNumber(id: string): number | null {
    const numbers = useContext(EquationNumbersContext);
    return numbers?.get(id) ?? null;
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
            className="docs-eq-ref"
            href={`#/docs/eq-${id}`}
            aria-describedby={isActive ? "docs-eq-preview" : undefined}
            onPointerEnter={(e) => {
                // Touch taps aren't a hover intent — they navigate via the
                // href like any other link, so leave the preview to mouse
                // and pen.
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
