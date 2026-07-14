import React, { useEffect, useRef, useState } from "react";

interface Position {
    x: number;
    y: number;
}

export interface ContextMenuItem {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    isDanger?: boolean;
    isDivider?: boolean;
}

interface ContextMenuProps {
    position: Position;
    parentRef: React.RefObject<HTMLDivElement | null>;
    animationState: "fading-in" | "fading-out";
    onAnimationEnd: () => void;
    items: ContextMenuItem[];
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
    position: points,
    parentRef,
    animationState,
    onAnimationEnd,
    items,
}) => {
    const menuRef = useRef<HTMLUListElement>(null);
    const [adjustedPoints, setAdjustedPoints] = useState<Position>(points);

    // Auto-recalculate spatial boundary limits
    useEffect(() => {
        if (!menuRef.current || !parentRef.current) return;

        const menuWidth = menuRef.current.offsetWidth;
        const menuHeight = menuRef.current.offsetHeight;
        const parentRect = parentRef.current.getBoundingClientRect();

        let { x, y } = points;

        if (x + menuWidth > parentRect.width) x = x - menuWidth;
        if (y + menuHeight > parentRect.height) y = y - menuHeight;

        setAdjustedPoints({
            x: Math.max(0, x),
            y: Math.max(0, y),
        });
    }, [points, parentRef]);

    // Combine static and animation transition styles
    const currentOpacity = animationState === "fading-in" ? 1 : 0;
    const currentScale = animationState === "fading-in" ? "scale(1)" : "scale(0.95)";

    return (
        <ul
            ref={menuRef}
            onTransitionEnd={(e) => {
                // Only trigger unmount callback if we finished transitioning opacity to 0
                if (e.propertyName === "opacity" && animationState === "fading-out") {
                    onAnimationEnd();
                }
            }}
            className="context-menu"
            style={{
                position: "absolute",
                top: `${adjustedPoints.y}px`,
                left: `${adjustedPoints.x}px`,

                // ANIMATION LOGIC: Pure inline cubic transitions
                opacity: currentOpacity,
                transform: currentScale,
                transformOrigin: "top left",
                transition:
                    "opacity 150ms cubic-bezier(0.4, 0, 0.2, 1), transform 150ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
        >
            {items.map((item, index) => {
                if (item.isDivider) {
                    return <hr key={index} className="context-menu-divider" />;
                }

                return (
                    <li
                        key={index}
                        onClick={(e) => {
                            e.stopPropagation(); // Avoid triggering App's raw context dismissals
                            item.onClick();
                        }}
                        className={item.isDanger ? "context-menu-item-danger" : ""}
                    >
                        {item.icon && <span className="context-menu-item-icon">{item.icon}</span>}
                        {item.label}
                    </li>
                );
            })}
        </ul>
    );
};
