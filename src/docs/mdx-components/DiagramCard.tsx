import type { ReactNode } from "react";

export function DiagramGrid({ children }: { children: ReactNode }) {
    return <div className="docs-diagram-grid">{children}</div>;
}

interface DiagramCardProps {
    title: string;
    formula: string;
    children: ReactNode;
}

export function DiagramCard({ title, formula, children }: DiagramCardProps) {
    return (
        <div className="docs-diagram-card">
            <span className="docs-diagram-card-title">{title}</span>
            {children}
            <span className="docs-diagram-card-formula">{formula}</span>
        </div>
    );
}
