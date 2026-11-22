import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Viewport } from "./Viewport";
import { downloadBlob } from "@/utils/svgExport";

vi.mock("@/utils/svgExport", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/utils/svgExport")>()),
    downloadBlob: vi.fn(),
}));

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

function renderViewport(workerOverride: Partial<typeof worker> = {}) {
    return render(
        <Viewport.Provider
            worker={{ ...worker, ...workerOverride } as typeof worker}
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
        expect(
            screen.getByRole("menuitem", { name: /save coordinates \(csv\)/i }),
        ).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: /save as json/i })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: /load json/i })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: /copy shareable link/i })).toBeInTheDocument();
    });

    it("keeps the dropdown menu open when an export option is clicked (so status feedback is visible)", () => {
        renderViewport();

        fireEvent.click(getDesktopExportToggle());
        const svgBtn = screen.getByRole("menuitem", { name: /save as svg/i });
        fireEvent.click(svgBtn);

        expect(getDesktopExportMenu()).not.toHaveAttribute("hidden");
        expect(getDesktopExportToggle().getAttribute("aria-expanded")).toBe("true");
    });
});

describe("Save Coordinates (CSV)", () => {
    beforeEach(() => vi.mocked(downloadBlob).mockClear());

    it("downloads tubesheet-coordinates.csv from the committed tube field", () => {
        renderViewport({
            lastSingleResult: {
                tubeField: [
                    { x: 0, y: 0 },
                    { x: 25, y: 0 },
                ],
                OTL: 44.05,
                shellID: 60,
                minID: 54.05,
                tubeOD: 19.05,
                pitchRatio: 1.25,
                layout: 90,
                numTubes: 2,
            } as never,
        });

        fireEvent.click(getDesktopExportToggle());
        fireEvent.click(screen.getByRole("menuitem", { name: /save coordinates \(csv\)/i }));

        expect(downloadBlob).toHaveBeenCalledTimes(1);
        const [blob, filename] = vi.mocked(downloadBlob).mock.calls[0] as [Blob, string];
        expect(filename).toBe("tubesheet-coordinates.csv");
        expect(blob.type).toContain("text/csv");
    });
});

describe("Save Coordinates (CSV) availability", () => {
    it("is disabled until a layout with tubes has been calculated", () => {
        renderViewport();
        fireEvent.click(getDesktopExportToggle());
        expect(screen.getByRole("menuitem", { name: /save coordinates \(csv\)/i })).toBeDisabled();
    });
});
