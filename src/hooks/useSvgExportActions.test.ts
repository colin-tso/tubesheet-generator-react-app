import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "@/utils/svgExport";
import { useSvgExportActions } from "./useSvgExportActions";

vi.mock("@/utils/svgExport", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/utils/svgExport")>();
    return {
        ...actual,
        downloadBlob: vi.fn(),
        preloadPngEncodeWorker: vi.fn(),
    };
});

function makeDrawing() {
    const drawing = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    drawing.setAttribute("viewBox", "0 0 100 100");
    return drawing;
}

function renderExportActions() {
    return renderHook(() =>
        useSvgExportActions(makeDrawing(), null, "", undefined),
    );
}

describe("useSvgExportActions SVG fallback", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        vi.mocked(downloadBlob).mockReset();
    });

    it("returns success and sets downloaded state when the fallback download succeeds", () => {
        vi.stubGlobal("ClipboardItem", undefined);
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: undefined,
        });

        const { result } = renderExportActions();

        act(() => {
            result.current.copySVG();
        });

        expect(downloadBlob).toHaveBeenCalledOnce();
        expect(result.current.copyState).toBe("downloaded");
        expect(result.current.svgExportState).toBe("success");
    });

    it("returns failure and sets error state when the fallback download throws", () => {
        vi.stubGlobal("ClipboardItem", undefined);
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: undefined,
        });
        vi.mocked(downloadBlob).mockImplementation(() => {
            throw new Error("download blocked");
        });
        vi.spyOn(console, "error").mockImplementation(() => {});

        const { result } = renderExportActions();

        act(() => {
            result.current.copySVG();
        });

        expect(downloadBlob).toHaveBeenCalledOnce();
        expect(result.current.copyState).toBe("error");
        expect(result.current.svgExportState).toBe("error");
    });
});
