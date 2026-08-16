import {
    createContext,
    useContext,
    useLayoutEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";

// KaTeX numbers `align`/`gather` formulas itself, via a pure-CSS counter
// (`body { counter-reset: katexEqnNo }` in katex.css) that increments once
// per `.eqn-num` element in DOM order across the whole page. That number is
// generated CSS content, not a real text node, so nothing in the DOM can
// read or link to it directly.
//
// This registry re-derives the same number for cross-referencing (EqRef)
// and deep-linking by scanning the same elements in the same document
// order KaTeX's counter relies on (every `Formula`, tagged with
// `data-eq-id`), so it can never disagree with what's rendered on screen.
const EquationNumbersContext = createContext<Map<string, number> | null>(null);

export function EquationRegistryProvider({ children }: { children: ReactNode }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [numbers, setNumbers] = useState<Map<string, number> | null>(null);

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

    return (
        <div ref={containerRef}>
            <EquationNumbersContext.Provider value={numbers}>
                {children}
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

// Cross-reference to a `Formula`, usable from anywhere in the docs
// (earlier or later sections). Renders as a link to the formula's anchor;
// the number matches what KaTeX rendered because both are derived from the
// same document order.
export function EqRef({ id }: EqRefProps) {
    const number = useEquationNumber(id);
    return (
        <a className="docs-eq-ref" href={`#/docs/eq-${id}`}>
            Eq.&nbsp;{number ?? "?"}
        </a>
    );
}
