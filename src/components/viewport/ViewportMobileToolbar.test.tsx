import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Viewport } from "./Viewport";

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
                <Viewport.DocsButton />
                <Viewport.Drawing />
                <Viewport.Footer>
                    <Viewport.Table />
                    <Viewport.ExportActions />
                </Viewport.Footer>
            </Viewport.Frame>
        </Viewport.Provider>,
    );
}

describe("mobile toolbar restructuring", () => {
    it("keeps exactly one Docs/Help button, outside .mobile-toolbar-actions", () => {
        renderViewport();

        // ViewportDocsButton (the top-left .viewport-help badge) is the only
        // place this control exists.
        const helpButtons = document.querySelectorAll(
            'button[aria-label="How the layout math works"]',
        );
        expect(helpButtons).toHaveLength(1);
        expect(helpButtons[0].closest(".mobile-toolbar-actions")).toBeNull();
        expect(helpButtons[0].closest(".viewport-help")).not.toBeNull();
    });

    it("shows the more_horiz icon on the export toggle", () => {
        renderViewport();

        const toggle = document.querySelector('button[aria-controls="flyout-menu"]')!;
        // The official Material Symbols Outlined more_horiz glyph is three
        // dots; assert on a fragment of its path data rather than the whole
        // string so the test isn't brittle to icon-set point releases.
        expect(toggle.querySelector("svg path")?.getAttribute("d")).toContain("207.86-432");
    });

    it("gives the view-toggle segments and the export toggle micro-labels", () => {
        renderViewport();

        const toolbar = document.querySelector(".mobile-viewport-toolbar")!;
        for (const label of ["Table", "Grid", "Labels", "More"]) {
            expect(
                Array.from(toolbar.querySelectorAll(".btn-micro-label")).some(
                    (el) => el.textContent === label,
                ),
            ).toBe(true);
        }
    });
});
