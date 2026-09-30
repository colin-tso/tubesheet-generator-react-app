import { describe, it, expect, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { useAutoHideHeader } from "./useAutoHideHeader";

function scrollTo(container: HTMLElement, scrollTop: number) {
    // jsdom's scrollTop is a plain writable property (no real layout/paint),
    // so tests drive it directly rather than simulating wheel/touch input.
    Object.defineProperty(container, "scrollTop", {
        value: scrollTop,
        configurable: true,
    });
    container.dispatchEvent(new Event("scroll"));
}

function renderWithContainer() {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const containerRef = createRef<HTMLDivElement>() as { current: HTMLDivElement | null };
    containerRef.current = container;
    const rendered = renderHook(() => useAutoHideHeader(containerRef));
    return { container, ...rendered };
}

describe("useAutoHideHeader", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("starts visible", () => {
        const { result } = renderWithContainer();
        expect(result.current).toBe(false);
    });

    it("hides after scrolling down past the threshold", async () => {
        const { container, result } = renderWithContainer();

        act(() => {
            scrollTo(container, 100);
        });

        await waitFor(() => expect(result.current).toBe(true));
    });

    it("reveals again as soon as it scrolls back up", async () => {
        const { container, result } = renderWithContainer();

        act(() => {
            scrollTo(container, 200);
        });
        await waitFor(() => expect(result.current).toBe(true));

        act(() => {
            scrollTo(container, 180);
        });
        await waitFor(() => expect(result.current).toBe(false));
    });

    it("ignores small back-and-forth jitter (momentum scroll / overscroll bounce)", async () => {
        const { container, result } = renderWithContainer();

        act(() => {
            scrollTo(container, 200);
        });
        await waitFor(() => expect(result.current).toBe(true));

        // A few px of wobble in either direction shouldn't flip it back.
        act(() => {
            scrollTo(container, 203);
        });
        act(() => {
            scrollTo(container, 199);
        });
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(result.current).toBe(true);
    });

    it("stays visible near the top regardless of direction", async () => {
        const { container, result } = renderWithContainer();

        act(() => {
            scrollTo(container, 10);
        });
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(result.current).toBe(false);
    });

    it("snaps back to visible once scrolled back into the top zone", async () => {
        const { container, result } = renderWithContainer();

        act(() => {
            scrollTo(container, 300);
        });
        await waitFor(() => expect(result.current).toBe(true));

        act(() => {
            scrollTo(container, 5);
        });
        await waitFor(() => expect(result.current).toBe(false));
    });

    it("does nothing once unmounted", async () => {
        const { container, result, unmount } = renderWithContainer();
        unmount();

        act(() => {
            scrollTo(container, 500);
        });
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(result.current).toBe(false);
    });
});
