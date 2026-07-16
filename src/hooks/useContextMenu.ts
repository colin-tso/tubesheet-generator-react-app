import { useEffect, useState } from "react";
import type { MouseEvent, RefObject } from "react";

interface Position {
    x: number;
    y: number;
}

export type AnimationLifecycle = "idle" | "fading-in" | "fading-out";

// Position, open/close and fade lifecycle for the custom right-click
// context menu shown over the drawing viewport.
export function useContextMenu(containerRef: RefObject<HTMLDivElement | null>) {
    const [contextMenuPos, setContextMenuPos] = useState<Position>({ x: 0, y: 0 });
    const [contextMenuAnimationState, setContextMenuAnimationState] =
        useState<AnimationLifecycle>("idle");

    // Close the menu on an outside click or Escape while it's open.
    useEffect(() => {
        const handleContextMenuCloseTrigger = () => {
            if (contextMenuAnimationState === "fading-in") {
                setContextMenuAnimationState("fading-out");
            }
        };
        const handleEscapeKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") handleContextMenuCloseTrigger();
        };
        window.addEventListener("click", handleContextMenuCloseTrigger);
        window.addEventListener("keydown", handleEscapeKey);
        return () => {
            window.removeEventListener("click", handleContextMenuCloseTrigger);
            window.removeEventListener("keydown", handleEscapeKey);
        };
    }, [contextMenuAnimationState]);

    const openContextMenu = (e: MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        setContextMenuPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        setContextMenuAnimationState("fading-in");
    };

    const requestClose = () => setContextMenuAnimationState("fading-out");
    const onAnimationEnd = () => setContextMenuAnimationState("idle");

    return {
        contextMenuPos,
        contextMenuAnimationState,
        openContextMenu,
        requestClose,
        onAnimationEnd,
    };
}
