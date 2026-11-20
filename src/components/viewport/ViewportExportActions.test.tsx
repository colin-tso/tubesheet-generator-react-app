import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

function getDesktopExportToggle() {
    return document.querySelector('button[aria-controls="desktop-export-menu"]') as HTMLButtonElement;
}

function getDesktopExportMenu() {
    return document.getElementById("desktop-export-menu") as HTMLDivElement;
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

describe("desktop export dropdown menu", () => {
    it("renders the export toggle button on the floating card", () => {
        renderViewport();

        const toggle = getDesktopExportToggle();
        expect(toggle).not.toBeNull();
        expect(toggle.getAttribute("aria-expanded")).toBe("false");
        expect(toggle.textContent).toContain("More");
    });

    it("has the dropdown menu hidden by default", () => {
        renderViewport();

        const menu = getDesktopExportMenu();
        expect(menu).not.toBeNull();
        expect(menu).toHaveAttribute("hidden");
    });

    it("opens the dropdown menu when clicking the export toggle button", () => {
        renderViewport();

        const toggle = getDesktopExportToggle();
        fireEvent.click(toggle);

        expect(toggle.getAttribute("aria-expanded")).toBe("true");
        const menu = getDesktopExportMenu();
        expect(menu).not.toHaveAttribute("hidden");
        expect(menu).toHaveClass("open");
        expect(screen.getByText("Export & Share")).toBeInTheDocument();
    });

    it("closes the dropdown menu when clicking the toggle button a second time", () => {
        renderViewport();

        const toggle = getDesktopExportToggle();
        fireEvent.click(toggle);
        expect(toggle.getAttribute("aria-expanded")).toBe("true");

        fireEvent.click(toggle);
        expect(toggle.getAttribute("aria-expanded")).toBe("false");
        expect(getDesktopExportMenu()).toHaveAttribute("hidden");
    });

    it("closes the dropdown menu when pressing Escape", () => {
        renderViewport();

        const toggle = getDesktopExportToggle();
        fireEvent.click(toggle);
        expect(getDesktopExportMenu()).not.toHaveAttribute("hidden");

        fireEvent.keyDown(document, { key: "Escape" });
        expect(getDesktopExportMenu()).toHaveAttribute("hidden");
    });

    it("closes the dropdown menu when clicking outside", () => {
        renderViewport();

        const toggle = getDesktopExportToggle();
        fireEvent.click(toggle);
        expect(getDesktopExportMenu()).not.toHaveAttribute("hidden");

        fireEvent.pointerDown(document.body);
        expect(getDesktopExportMenu()).toHaveAttribute("hidden");
    });

    it("renders export format options inside the dropdown menu", () => {
        renderViewport();

        fireEvent.click(getDesktopExportToggle());

        expect(screen.getByRole("menuitem", { name: /save as svg/i })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: /save as png/i })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: /save as pdf/i })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: /save as dxf/i })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: /save as json/i })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: /load json/i })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: /copy shareable link/i })).toBeInTheDocument();
    });

    it("closes the dropdown menu when an export option is clicked", () => {
        renderViewport();

        fireEvent.click(getDesktopExportToggle());
        const svgBtn = screen.getByRole("menuitem", { name: /save as svg/i });
        fireEvent.click(svgBtn);

        expect(getDesktopExportMenu()).toHaveAttribute("hidden");
    });
});
