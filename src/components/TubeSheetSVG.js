import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
export function TubeSheetSVG({ src, className, onRendered }) {
    const containerRef = useRef(null);
    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            if (className) {
                src.setAttribute("class", className);
            }
            container.replaceChildren(src);
        }
        onRendered === null || onRendered === void 0 ? void 0 : onRendered();
    }, [src, className, onRendered]);
    return _jsx("div", { ref: containerRef, style: { display: "contents" } });
}
