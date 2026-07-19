import { useEffect, useRef } from "react";

type SVGProps = {
    src: SVGSVGElement;
    className?: string;
    onRendered?: () => void;
};

export function TubeSheetSVG({ src, className, onRendered }: SVGProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            if (className) {
                src.setAttribute("class", className);
            }
            container.replaceChildren(src);
        }

        onRendered?.();
    }, [src, className, onRendered]);

    return <div ref={containerRef} style={{ display: "contents" }} />;
}
