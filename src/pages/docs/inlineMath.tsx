import katex from "katex";
import type { ReactNode } from "react";

// MDX directive attributes (a Table's `caption="..."`, a Formula's
// `label="..."`) compile to plain JS string literals — they never pass through
// the remark-math/rehype-katex pipeline that turns `$...$` into KaTeX markup in
// ordinary markdown body text. Without this, `$d_x$` in an attribute string
// renders as the literal text "$d_x$" instead of math.
//
// This renders inline math ($...$, not display/$$...$$) in such a string by
// calling KaTeX directly. It's only meant for short author-written strings like
// captions and labels, not general markdown.
export function renderInlineMath(text: string): ReactNode[] {
    return text.split(/(\$[^$]+\$)/g).map((part, i) => {
        if (part.length > 2 && part.startsWith("$") && part.endsWith("$")) {
            const html = katex.renderToString(part.slice(1, -1), { throwOnError: false });
            // This app's own author-written MDX content, not user input —
            // same trust boundary as EquationPreview's cloned KaTeX markup.
            return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
        }
        return part;
    });
}
