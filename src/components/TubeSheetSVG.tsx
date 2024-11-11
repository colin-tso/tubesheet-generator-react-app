import { useEffect, useRef } from "react";

type SVGProps = {
    src: SVGSVGElement;
    className?: string;
};

export function TubeSheetSVG({ src, className }: SVGProps) {
    const svg = useRef<SVGSVGElement | null>(null); // defining useRef inside component
    useEffect(() => {
        if (svg.current) {
            // Clear SVG component
            svg.current.innerHTML = "";

            // Get the children from SVG source and append them to the SVG component
            Array.from(src.childNodes).forEach((child) => {
                if (child instanceof SVGElement) {
                    if (svg.current) {
                        svg.current.appendChild(child.cloneNode(true));
                    }
                }
            });

            // Copy required attributes
            svg.current.setAttribute("viewBox", `${src.getAttribute("viewBox")}`);
            svg.current.setAttribute("title", `${src.getAttribute("title")}`);
            svg.current.setAttribute("desc", `${src.getAttribute("desc")}`);
            svg.current.setAttribute("role", `${src.getAttribute("role")}`);
        }
    }, [src]);
    return (
        <>
            <svg ref={svg} className={className} />
        </>
    );
}
