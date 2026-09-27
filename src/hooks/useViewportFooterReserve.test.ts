import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { createRef } from "react";
import { useViewportFooterReserve, FOOTER_RESERVE_SAFETY_MARGIN } from "./useViewportFooterReserve";

const BASE_PADDING = 48;

// jsdom has no layout engine, so every box in these tests is a stubbed rect.
function stubRect(el: Element, rect: Partial<DOMRect>) {
    const full = {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        ...rect,
    };
    el.getBoundingClientRect = () => ({ ...full, toJSON: () => full }) as DOMRect;
}

interface Boxes {
    viewport: Partial<DOMRect>;
    table: Partial<DOMRect>;
    footer: Partial<DOMRect>;
    footerPosition?: string;
}

// Builds the three elements the hook measures and returns the rendered hook.
// The viewport is square and the table is parked at the bottom-left, mirroring
// .viewport-overlay-footer's real geometry.
function renderReserve({ viewport, table, footer, footerPosition = "absolute" }: Boxes) {
    const container = document.createElement("div");
    const footerEl = document.createElement("div");
    const tableEl = document.createElement("table");
    footerEl.appendChild(tableEl);
    container.appendChild(footerEl);
    document.body.appendChild(container);

    stubRect(container, viewport);
    stubRect(footerEl, footer);
    stubRect(tableEl, table);

    const realGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation(((el: Element) =>
        el === footerEl
            ? ({ position: footerPosition } as CSSStyleDeclaration)
            : realGetComputedStyle(el as HTMLElement)) as typeof window.getComputedStyle);

    const containerRef = createRef<HTMLDivElement>() as {
        current: HTMLDivElement | null;
    };
    const footerRef = createRef<HTMLDivElement>() as {
        current: HTMLDivElement | null;
    };
    containerRef.current = container;
    footerRef.current = footerEl;

    return renderHook(() =>
        useViewportFooterReserve({
            containerRef,
            footerRef,
            tableEl,
            showTable: true,
            lastSingleResult: null,
            basePadding: BASE_PADDING,
        }),
    );
}

// An 800x800 viewport: unshrunk drawing is 704px across, so the safe-content
// radius is ~320px around the centre at (400, 400). A table whose top-right
// corner lands inside that radius fouls the drawing.
const VIEWPORT: Partial<DOMRect> = {
    top: 0,
    left: 0,
    right: 800,
    bottom: 800,
    width: 800,
    height: 800,
};

// Bottom-left, 28px in from each edge, 120px tall, 560px wide -- its top-right
// corner sits at (588, 652), well inside the safe radius.
const FOULING_TABLE: Partial<DOMRect> = {
    top: 652,
    bottom: 772,
    left: 28,
    right: 588,
    width: 560,
    height: 120,
};

// Same table, but short and narrow enough to tuck into the empty corner.
const CLEARING_TABLE: Partial<DOMRect> = {
    top: 742,
    bottom: 772,
    left: 28,
    right: 148,
    width: 120,
    height: 30,
};

describe("useViewportFooterReserve", () => {
    beforeEach(() => {
        vi.stubGlobal("ResizeObserver", undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        document.body.innerHTML = "";
    });

    it("sizes the reserve from the data table, not the taller export button column", () => {
        // The regression: .viewport-overlay-footer wraps both the table and
        // the .viewport-actions button column, so its height is whichever is
        // taller. Here the button column wins (300px vs the table's 120px);
        // the reserve must still describe the table.
        const { result } = renderReserve({
            viewport: VIEWPORT,
            table: FOULING_TABLE,
            footer: {
                top: 472,
                bottom: 772,
                left: 28,
                right: 772,
                width: 744,
                height: 300,
            },
        });

        // 800 - 652 + 12 = 160: table height (120) + its 28px bottom inset
        // + the shared safety margin. Nothing to do with the 300px footer.
        expect(result.current.viewportBottomReserve).toBe(
            VIEWPORT.bottom! - FOULING_TABLE.top! + FOOTER_RESERVE_SAFETY_MARGIN,
        );
    });

    it("grows the reserve when the footer wraps and lifts the table onto its own row", () => {
        // Same table height, but pushed up above the button column. The
        // measured top edge rises, so the reserve rises with it.
        const wrappedTable = { ...FOULING_TABLE, top: 500, bottom: 620 };
        const { result } = renderReserve({
            viewport: VIEWPORT,
            table: wrappedTable,
            footer: {
                top: 500,
                bottom: 772,
                left: 28,
                right: 772,
                width: 744,
                height: 272,
            },
        });

        // 800 - 500 + 12 = 312, against 160 for the same table unwrapped.
        expect(result.current.viewportBottomReserve).toBe(
            VIEWPORT.bottom! - wrappedTable.top + FOOTER_RESERVE_SAFETY_MARGIN,
        );
    });

    it("stays at the base padding when the table clears the drawing", () => {
        const { result } = renderReserve({
            viewport: VIEWPORT,
            table: CLEARING_TABLE,
            footer: {
                top: 472,
                bottom: 772,
                left: 28,
                right: 772,
                width: 744,
                height: 300,
            },
        });

        expect(result.current.viewportBottomReserve).toBe(BASE_PADDING);
    });

    it("stays at the base padding when the footer is in flow (narrow-screen layout)", () => {
        // position: static means the reserve we apply would move the edge we
        // measure; that breakpoint stacks the footer below the drawing anyway.
        const { result } = renderReserve({
            viewport: VIEWPORT,
            table: FOULING_TABLE,
            footer: {
                top: 652,
                bottom: 772,
                left: 28,
                right: 772,
                width: 744,
                height: 120,
            },
            footerPosition: "static",
        });

        expect(result.current.viewportBottomReserve).toBe(BASE_PADDING);
    });

    it("stays at the base padding when the table is hidden", () => {
        const container = document.createElement("div");
        const footerEl = document.createElement("div");
        const tableEl = document.createElement("table");
        tableEl.setAttribute("hidden", "");
        footerEl.appendChild(tableEl);
        container.appendChild(footerEl);
        document.body.appendChild(container);

        stubRect(container, VIEWPORT);
        stubRect(footerEl, { height: 300, top: 472, bottom: 772 });
        stubRect(tableEl, FOULING_TABLE);
        vi.spyOn(window, "getComputedStyle").mockReturnValue({
            position: "absolute",
        } as CSSStyleDeclaration);

        const containerRef = { current: container as HTMLDivElement | null };
        const footerRef = { current: footerEl as HTMLDivElement | null };

        const { result } = renderHook(() =>
            useViewportFooterReserve({
                containerRef,
                footerRef,
                tableEl,
                showTable: false,
                lastSingleResult: null,
                basePadding: BASE_PADDING,
            }),
        );

        expect(result.current.viewportBottomReserve).toBe(BASE_PADDING);
    });
});
