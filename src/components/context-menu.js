import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
export const ContextMenu = ({ position: points, parentRef, animationState, onAnimationEnd, onRequestClose, items, }) => {
    const menuRef = useRef(null);
    const [adjustedPoints, setAdjustedPoints] = useState(points);
    const selectableIndices = items.reduce((acc, item, index) => {
        if (!item.isDivider)
            acc.push(index);
        return acc;
    }, []);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    // Auto-recalculate spatial boundary limits.
    // useLayoutEffect (not useEffect) so this runs synchronously after DOM
    // mutation but before the browser paints - otherwise the menu briefly
    // renders at the raw cursor position and visibly jumps once adjusted.
    useLayoutEffect(() => {
        if (!menuRef.current || !parentRef.current)
            return;
        const menuWidth = menuRef.current.offsetWidth;
        const menuHeight = menuRef.current.offsetHeight;
        const parentRect = parentRef.current.getBoundingClientRect();
        let { x, y } = points;
        // Keep menu inset from parent edges so rounded-focus highlights remain visible.
        const EDGE_MARGIN = 8; // px
        if (x + menuWidth > parentRect.width - EDGE_MARGIN)
            x = points.x - menuWidth;
        if (y + menuHeight > parentRect.height - EDGE_MARGIN)
            y = points.y - menuHeight;
        // Clamp into parent with margin
        const maxX = Math.max(EDGE_MARGIN, parentRect.width - menuWidth - EDGE_MARGIN);
        const maxY = Math.max(EDGE_MARGIN, parentRect.height - menuHeight - EDGE_MARGIN);
        setAdjustedPoints({
            x: Math.min(Math.max(EDGE_MARGIN, x), maxX),
            y: Math.min(Math.max(EDGE_MARGIN, y), maxY),
        });
    }, [points, parentRef]);
    // Keyboard support: Escape closes, arrow keys move focus, Enter/Space activates.
    useEffect(() => {
        var _a;
        if (animationState !== "fading-in")
            return;
        (_a = menuRef.current) === null || _a === void 0 ? void 0 : _a.focus();
        const handleKeyDown = (e) => {
            var _a;
            if (e.key === "Escape") {
                e.stopPropagation();
                onRequestClose();
                return;
            }
            const currentPos = selectableIndices.indexOf(focusedIndex);
            if (e.key === "ArrowDown") {
                e.preventDefault();
                const next = currentPos === -1
                    ? selectableIndices[0]
                    : selectableIndices[(currentPos + 1) % selectableIndices.length];
                setFocusedIndex(next);
            }
            else if (e.key === "ArrowUp") {
                e.preventDefault();
                const prev = currentPos === -1
                    ? selectableIndices[selectableIndices.length - 1]
                    : selectableIndices[(currentPos - 1 + selectableIndices.length) % selectableIndices.length];
                setFocusedIndex(prev);
            }
            else if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (focusedIndex >= 0)
                    (_a = items[focusedIndex]) === null || _a === void 0 ? void 0 : _a.onClick();
            }
        };
        const node = menuRef.current;
        node === null || node === void 0 ? void 0 : node.addEventListener("keydown", handleKeyDown);
        return () => node === null || node === void 0 ? void 0 : node.removeEventListener("keydown", handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [animationState, focusedIndex]);
    // Combine static and animation transition styles
    const currentOpacity = animationState === "fading-in" ? 1 : 0;
    const currentScale = animationState === "fading-in" ? "scale(1)" : "scale(0.95)";
    return (_jsx("ul", { ref: menuRef, role: "menu", tabIndex: -1, onMouseLeave: () => setFocusedIndex(-1), onTransitionEnd: (e) => {
            // Only trigger unmount callback if we finished transitioning opacity to 0
            if (e.propertyName === "opacity" && animationState === "fading-out") {
                onAnimationEnd();
            }
        }, className: "context-menu", style: {
            position: "absolute",
            top: `${adjustedPoints.y}px`,
            left: `${adjustedPoints.x}px`,
            // ANIMATION LOGIC: Pure inline cubic transitions
            opacity: currentOpacity,
            transform: currentScale,
            transformOrigin: "top left",
            transition: "opacity 150ms cubic-bezier(0.4, 0, 0.2, 1), transform 150ms cubic-bezier(0.4, 0, 0.2, 1)",
        }, children: items.map((item, index) => {
            if (item.isDivider) {
                return _jsx("hr", { className: "context-menu-divider" }, index);
            }
            const isFirstSelectable = selectableIndices[0] === index;
            const isLastSelectable = selectableIndices[selectableIndices.length - 1] === index;
            return (_jsxs("li", { role: "menuitem", tabIndex: focusedIndex === index ? 0 : -1, onMouseEnter: () => setFocusedIndex(index), onClick: (e) => {
                    e.stopPropagation(); // Avoid triggering App's raw context dismissals
                    item.onClick();
                }, className: `context-menu-item ${item.isDanger ? "danger" : ""} ${focusedIndex === index ? "focus" : ""} ${isFirstSelectable ? "first" : ""} ${isLastSelectable ? "last" : ""}`, children: [item.icon && _jsx("span", { className: "icon", children: item.icon }), item.label] }, index));
        }) }));
};
