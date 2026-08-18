import type { ReactNode } from "react";

interface SectionProps {
    id: string;
    index: string;
    title: string;
    children: ReactNode;
}

// Structural chrome only (numbered heading + anchor id). The actual prose,
// lists, tables, and diagrams for each section live in ./content/*.mdx,
// keeping content edits out of this file entirely.
export function Section({ id, index, title, children }: SectionProps) {
    return (
        <section id={id} className="docs-section">
            <h2>
                <span className="docs-section-index">{index}</span> {title}
            </h2>
            {children}
        </section>
    );
}
