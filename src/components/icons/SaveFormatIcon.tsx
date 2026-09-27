import { useId } from "react";
import type { SVGProps } from "react";

// Floppy-disk glyph with the format name knocked out of the icon fill via
// an SVG mask, so the label reveals whatever sits behind the button (its live
// background color) instead of a hardcoded color -- that's what keeps the label
// legible across hover/error/disabled button states without any extra markup
// per state.
//
// The mask needs an id, and these icons are all mounted several times over at
// once (desktop export row, mobile flyout, mobile PDF card, right-click
// context menu -- the desktop/mobile variants coexist and are merely toggled
// with CSS `display`). A shared, hardcoded mask id would collide across those
// instances and the mask would silently fail to render for some of them,
// leaving a blank icon with no text cut into it. useId() gives every rendered
// instance its own id so masks never collide.
function SaveFormatIcon({
    text,
    textFontSize = 6.1,
    textLetterSpacing = -0.5,
    ...props
}: SVGProps<SVGSVGElement> & {
    text: string;
    textFontSize?: number;
    textLetterSpacing?: number;
}) {
    const maskId = useId();
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="16" height="16">
                <rect x="0" y="0" width="16" height="16" fill="white" />
                <text
                    x="8"
                    y="13"
                    textAnchor="middle"
                    fontFamily="Arial, Helvetica, sans-serif"
                    fontSize={textFontSize}
                    fontWeight="700"
                    letterSpacing={textLetterSpacing}
                    fill="black"
                >
                    {text}
                </text>
            </mask>
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M13.353 1.146L14.853 2.646L15 3V14.5L14.5 15H1.5L1 14.5V1.5L1.5 1H13L13.353 1.146ZM4 2H11V6H4V2Z"
                fill="currentColor"
                mask={`url(#${maskId})`}
            />
        </svg>
    );
}

export function SaveSvgIcon(props: SVGProps<SVGSVGElement>) {
    return <SaveFormatIcon text="SVG" {...props} />;
}

export function SavePngIcon(props: SVGProps<SVGSVGElement>) {
    return <SaveFormatIcon text="PNG" {...props} />;
}

export function SavePdfIcon(props: SVGProps<SVGSVGElement>) {
    return <SaveFormatIcon text="PDF" {...props} />;
}

export function SaveDxfIcon(props: SVGProps<SVGSVGElement>) {
    return <SaveFormatIcon text="DXF" {...props} />;
}

export function SaveJsonIcon(props: SVGProps<SVGSVGElement>) {
    return <SaveFormatIcon text="JSON" textFontSize={5.1} textLetterSpacing={-0.6} {...props} />;
}
