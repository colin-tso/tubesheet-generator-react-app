import type { ReactNode } from "react";
import { useTableNumber } from "../context/DocsRegistryContext";
import { renderInlineMath } from "./inlineMath";

interface TableProps {
    id: string;
    caption?: string;
    children: ReactNode;
}

// Wraps a markdown table (rendered by remark-gfm from a fenced pipe table) with
// the anchor id used for deep links and cross-references (see TableRef in
// DocsRegistry.tsx, and the shared numbering in DocsRegistryContext.ts) and a
// numbered caption. Author tables in content/*.mdx as a `Table` directive
// (PascalCase so the MDX compiler routes it through the components map):
//
//     :::Table{id="pattern-constants" caption="Layout constants by pattern angle"}
//     | Layout | ... |
//     | --- | ... |
//     :::
//
// Unlike Formula, whose equation number is rendered by KaTeX itself, a table's
// number has nowhere else to come from — this component reads its own number
// from the registry (see DocsRegistryContext.ts) and renders it in the caption
// directly.
//
// The caption is a plain string (an MDX directive attribute, not markdown body
// text), so any `$...$` math in it is rendered explicitly via renderInlineMath
// rather than by the usual remark-math/rehype-katex pipeline, which never sees
// directive attributes. See inlineMath.tsx.
export function Table({ id, caption, children }: TableProps) {
    const number = useTableNumber(id);

    return (
        <figure id={`table-${id}`} data-table-id={id} className="docs-table">
            {caption && (
                <figcaption className="docs-table-caption">
                    <span className="docs-table-caption-index">Table&nbsp;{number ?? "?"}</span>{" "}
                    {renderInlineMath(caption)}
                </figcaption>
            )}
            <div className="docs-table-body">{children}</div>
        </figure>
    );
}
