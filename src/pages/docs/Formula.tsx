import type { ReactNode } from "react";

interface FormulaProps {
    id: string;
    label?: string;
    children: ReactNode;
}

// Boxed container for a display formula rendered by KaTeX (via
// remark-math + rehype-katex in the MDX pipeline). Author formulas in
// content/*.mdx as a `Formula` directive (PascalCase so the MDX compiler
// routes it through the components map):
//
//     :::Formula{id="pitch" label="Pitch"}
//     $$
//     \begin{align}
//     P = D_\text{tube} \times P_\text{ratio}
//     \end{align}
//     $$
//     :::
//
// This component supplies the labelled frame plus the anchor id used for
// deep links and cross-references (see EqRef.tsx); the KaTeX markup inside,
// including the equation number, is produced by rehype-katex + katex.css's
// built-in `eqn-num` counter (an `align`/`gather` environment is required
// for a formula to be auto-numbered at all — plain `$$ ... $$` is not).
export function Formula({ id, label, children }: FormulaProps) {
    return (
        <div id={`eq-${id}`} data-eq-id={id} className="docs-formula">
            {label && <span className="docs-formula-label">{label}</span>}
            <div className="docs-formula-body">{children}</div>
        </div>
    );
}
