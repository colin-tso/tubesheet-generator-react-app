import type { SVGProps } from "react";

// Export-menu icons. One glyph per format instead of a shared floppy disk with
// a tiny knocked-out label, so each row is recognisable by shape.
//
// Shared grid so the set reads as one family at any rendered size (the app
// draws these at 15-23px):
//   - 16x16 viewBox, drawn with a 1px stroke in currentColor
//   - every glyph fits the same 12x12 live area (x/y 2..14), so none looks
//     bigger than another; coordinates sit on half-pixels so 1px lines stay
//     crisp at 16px
//   - the JSON arrow is the exact arrow from the original Load JSON icon
//     (same path, same size), centred between the braces; flipped for Save
//
// The CSV icon's "XY" is live text in the app's UI font (--font-ui, Inter), so
// it matches the rest of the interface. It is centred on y = 8 using Inter's
// cap height (about 0.73em), so changing the font size means re-centring y.

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinejoin="round"
            {...props}
        >
            {children}
        </svg>
    );
}

// Arrow from the original Load JSON icon (src/assets/load-json-icon.svg).
const ARROW_PATH =
    "M8 13.5V9.20711L9.64645 10.8536L10.3536 10.1464L8 7.79289L5.64645 10.1464L6.35355 10.8536L8 9.20711V13.5H8Z";
// The arrow spans y 7.79..13.5 in its own icon. Shifting it by -2.645 centres
// it on y = 8 (the braces' midline). That upward arrow is the Load JSON icon
// (src/assets/load-json-icon.svg); Save JSON flips it about the same midline.
const ARROW_DOWN = "translate(0 8) scale(1 -1) translate(0 -10.645)";

const BRACES_PATH =
    "M6 2.5H5.5Q4 2.5 4 4V6Q4 8 2.5 8Q4 8 4 10V12Q4 13.5 5.5 13.5H6" +
    "M10 2.5H10.5Q12 2.5 12 4V6Q12 8 13.5 8Q12 8 12 10V12Q12 13.5 10.5 13.5H10";

// Vector: a curve between two anchor points.
export function SaveSvgIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <rect x="2.5" y="10.5" width="3" height="3" />
            <rect x="10.5" y="2.5" width="3" height="3" />
            <path d="M6 12C9.5 12 6.5 4 10 4" />
        </Icon>
    );
}

// Raster: picture frame with a sun and hills.
export function SavePngIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <rect x="2.5" y="2.5" width="11" height="11" rx="1" />
            <circle cx="10.5" cy="5.5" r="1" />
            <path d="M2.5 11L6 7.5L9 10.5L10.5 9L13.5 12" />
        </Icon>
    );
}

// Document: page with a folded corner and text lines.
export function SavePdfIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M3.5 2.5H9.5L12.5 5.5V13.5H3.5Z" />
            <path d="M9.5 2.5V5.5H12.5" />
            <path d="M5.5 8.5H10.5M5.5 11H10.5" />
        </Icon>
    );
}

// CAD drawing: a set square (drafting triangle).
export function SaveDxfIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M2.5 13.5V2.5L13.5 13.5Z" />
            <path d="M5.5 11.5V9L8 11.5Z" />
        </Icon>
    );
}

// Tube coordinates: "XY" in an outlined box.
export function SaveCsvIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
            <text
                x="8"
                y="10.2"
                textAnchor="middle"
                fontSize="6"
                fontWeight="600"
                fill="currentColor"
                stroke="none"
                style={{ fontFamily: "var(--font-ui)" }}
            >
                XY
            </text>
        </Icon>
    );
}

// Braces with the original Load JSON arrow, pointing down (save).
export function SaveJsonIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d={BRACES_PATH} />
            <path d={ARROW_PATH} fill="currentColor" stroke="none" transform={ARROW_DOWN} />
        </Icon>
    );
}
