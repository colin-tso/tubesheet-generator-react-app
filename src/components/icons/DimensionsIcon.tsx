import type { SVGProps } from "react";

// Dimension-line glyph (two extension ticks joined by a double-headed arrow).
export function DimensionsIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...props}
        >
            <path d="M3 17V7M21 17V7M3 12h18M6.5 9.5L3 12l3.5 2.5M17.5 9.5L21 12l-3.5 2.5" />
        </svg>
    );
}
