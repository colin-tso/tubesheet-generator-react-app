import { useEffect, useState } from "react";

/** Screen px per drawing unit (mm) for `svg`, kept current as it is resized. */
export function useScreenScale(svg: SVGSVGElement, enabled: boolean): number | null {
    const [scale, setScale] = useState<number | null>(null);

    useEffect(() => {
        if (!enabled) return;
        const measure = () => {
            const a = svg.getScreenCTM?.()?.a;
            setScale(a && Number.isFinite(a) && a > 0 ? a : null);
        };
        measure();
        if (typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(measure);
        observer.observe(svg);
        return () => observer.disconnect();
    }, [svg, enabled]);

    return enabled ? scale : null;
}
