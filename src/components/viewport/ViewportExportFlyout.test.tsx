import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Viewport } from "./Viewport";

// Minimal SVG standing in for a "real" drawing vs. the placeholder -- the
// mobile toolbar's Share button (which opens the flyout) is hidden whenever
// drawingSVG === placeholderSVG, so the two must be distinct instances.
function makeSvg() {
    return document.createElementNS("http://www.w3.org/2000/svg", "svg") as SVGSVGElement;
}

const placeholderSVG = makeSvg();

const worker = {
    drawingSVG: makeSvg(),
    lastSingleResult: null,
    isCalculating: false,
    showLoadingBadge: false,
    calcError: null,
    announcement: "",
    onDrawingRendered: () => {},
};

// The mobile toolbar's More (export) button carries a custom data-title
// tooltip rather than an aria-label, so it isn't reachable by accessible name.
function getExportToggleButton() {
    return document.querySelector('button[aria-controls="flyout-menu"]') as HTMLButtonElement;
}

function renderViewport() {
    return render(
        <Viewport.Provider
            worker={worker}
            placeholderSVG={placeholderSVG}
            drawingTableLabel=""
            drawingTableRequestedTubes={undefined}
            basePadding={48}
            layoutConfig={{}}
            onLoadLayoutConfig={() => {}}
        >
            <Viewport.Frame>
                <Viewport.Drawing />
                <Viewport.Footer>
                    <Viewport.Table />
                    <Viewport.ExportActions />
                </Viewport.Footer>
            </Viewport.Frame>
        </Viewport.Provider>,
    );
}

describe("mobile export flyout", () => {
    it("closes when the dimmed backdrop behind the panel is clicked", () => {
        renderViewport();

        fireEvent.click(getExportToggleButton());
        const flyout = document.getElementById("flyout-menu")!;
        expect(flyout).toHaveClass("expanded");

        // The wrapper itself is the backdrop: the panel (.export-card) is a
        // child that only covers part of its width, so a click whose target
        // is the wrapper (not something inside .export-card) landed on the
        // dimmed drawing/table behind the panel.
        fireEvent.click(flyout);

        expect(flyout).not.toHaveClass("expanded");
    });

    it("does not close when a non-button area inside the panel is clicked", () => {
        renderViewport();

        fireEvent.click(getExportToggleButton());
        const flyout = document.getElementById("flyout-menu")!;
        expect(flyout).toHaveClass("expanded");

        fireEvent.click(screen.getByText("Export as…"));

        expect(flyout).toHaveClass("expanded");
    });

    it("still closes when a button inside the panel is clicked", () => {
        renderViewport();

        fireEvent.click(getExportToggleButton());
        const flyout = document.getElementById("flyout-menu")!;
        expect(flyout).toHaveClass("expanded");

        fireEvent.click(screen.getByRole("button", { name: "Close" }));

        expect(flyout).not.toHaveClass("expanded");
    });
});
