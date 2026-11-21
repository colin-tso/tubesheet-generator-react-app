import type { TubeSheetLayout } from "@/plugins/tubesheet-layout-generator";

// Literal outline of each layout's geometry, drawn on a 16x16 grid: a triangle
// for 30°, a rhombus for 45°, an inverted triangle for 60°, a square for 90°
// and concentric circles for radial. Decorative: the row's text label carries
// the name.
const SHAPES: Record<TubeSheetLayout, React.ReactNode> = {
    30: <polygon points="8,2 14.5,13.5 1.5,13.5" />,
    45: <polygon points="8,1.5 14.5,8 8,14.5 1.5,8" />,
    60: <polygon points="1.5,2.5 14.5,2.5 8,13.5" />,
    90: <rect x="2" y="2" width="12" height="12" />,
    radial: (
        <>
            <circle cx="8" cy="8" r="6" />
            <circle cx="8" cy="8" r="3" />
        </>
    ),
};

export function LayoutGlyph({
    layout,
    ...rest
}: { layout: TubeSheetLayout } & React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 16 16"
            width="12.8"
            height="12.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
            {...rest}
        >
            {SHAPES[layout]}
        </svg>
    );
}
