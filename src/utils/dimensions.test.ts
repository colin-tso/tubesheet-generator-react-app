import { describe, it, expect } from "vitest";
import { TubeSheet, generateTubeSheetSVG } from "@/plugins/tubesheet-layout-generator";
import type { ITubeSheetData } from "@/plugins/tubesheet-layout-generator";
import { DIMENSIONS_GROUP_CLASS, removeDimensions, renderDimensions } from "./dimensions";

function build(layout: ITubeSheetData["layout"]) {
    const ts = new TubeSheet(10, 19.05, 1.333, layout, 37);
    const data = ts as unknown as ITubeSheetData;
    return { data, svg: generateTubeSheetSVG(data) };
}

const texts = (svg: SVGSVGElement) =>
    Array.from(svg.querySelectorAll(`g.${DIMENSIONS_GROUP_CLASS} text`)).map((t) => t.textContent);

describe("renderDimensions", () => {
    it("draws shell ID, OTL, pitch and scale-bar labels", () => {
        const { data, svg } = build(45);
        expect(renderDimensions(svg, data)).toBe(true);
        const t = texts(svg);
        expect(t.some((x) => x?.startsWith("Ø") && !x.includes("OTL"))).toBe(true);
        expect(t.some((x) => x?.includes("OTL"))).toBe(true);
        expect(t.some((x) => x?.startsWith("Pitch"))).toBe(true);
        expect(t.some((x) => x?.endsWith(" mm"))).toBe(true);
    });

    it("uses arrowheads rather than dots on every leader", () => {
        const { data, svg } = build(45);
        renderDimensions(svg, data);
        const g = svg.querySelector(`g.${DIMENSIONS_GROUP_CLASS}`)!;
        expect(g.querySelectorAll(":scope > g:last-child polygon").length).toBe(3);
        expect(g.querySelectorAll("circle").length).toBe(0);
    });

    it("dimensions a true pitch on radial layouts", () => {
        const { data, svg } = build("radial");
        renderDimensions(svg, data);
        const pitch = texts(svg).find((x) => x?.startsWith("Pitch"));
        expect(pitch).toBe(`Pitch ${(19.05 * 1.333).toFixed(2)} mm`);
    });

    it("keeps text a constant on-screen size as the scale changes", () => {
        const { data, svg } = build(45);
        const sizeAt = (scale: number) => {
            (svg as unknown as { getScreenCTM: () => { a: number } }).getScreenCTM = () => ({
                a: scale,
            });
            renderDimensions(svg, data);
            const fs = +svg
                .querySelector(`g.${DIMENSIONS_GROUP_CLASS} text`)!
                .getAttribute("font-size")!;
            return fs * scale;
        };
        expect(sizeAt(2)).toBeCloseTo(sizeAt(5), 6);
    });

    it("draws all knock-outs beneath all the ink so segments never cut each other", () => {
        const { data, svg } = build(45);
        renderDimensions(svg, data);
        const [halo, ink] = Array.from(svg.querySelectorAll(`g.${DIMENSIONS_GROUP_CLASS} > g`));
        expect(halo.querySelectorAll("line").length).toBe(ink.querySelectorAll("line").length);
        expect(halo.classList.contains("dim-halo")).toBe(true);
        expect(ink.classList.contains("dim-ink")).toBe(true);
        expect(halo.nextElementSibling).toBe(ink);
    });

    it("leaves styling to index.css rather than inline style attributes", () => {
        const { data, svg } = build(45);
        renderDimensions(svg, data);
        expect(svg.querySelectorAll(`g.${DIMENSIONS_GROUP_CLASS} [style]`).length).toBe(0);
        expect(svg.getAttribute("style") ?? "").not.toContain("overflow");
    });

    it("replaces rather than stacks groups, and removes cleanly", () => {
        const { data, svg } = build(45);
        renderDimensions(svg, data);
        renderDimensions(svg, data);
        expect(svg.querySelectorAll(`g.${DIMENSIONS_GROUP_CLASS}`).length).toBe(1);
        removeDimensions(svg);
        expect(svg.querySelectorAll(`g.${DIMENSIONS_GROUP_CLASS}`).length).toBe(0);
    });

    it("draws nothing without a tube field", () => {
        const { data, svg } = build(45);
        expect(renderDimensions(svg, { ...data, tubeField: null })).toBe(false);
        expect(svg.querySelector(`g.${DIMENSIONS_GROUP_CLASS}`)).toBeNull();
    });

    it("omits the in-SVG scale bar when it is shown separately", () => {
        const { data, svg } = build(45);
        renderDimensions(svg, data, { scaleBar: false });
        const t = texts(svg);
        expect(t).not.toContain("0");
        expect(t.some((x) => /^\d+(?:\.\d+)? mm$/.test(x ?? ""))).toBe(false);
        expect(t.some((x) => x?.startsWith("Pitch"))).toBe(true);
    });

    it("still draws a pitch callout when the tube field is tiny and crowded", () => {
        const ts = new TubeSheet(150, 90.53, 1.25, "radial", 11) as unknown as ITubeSheetData;
        const svg = generateTubeSheetSVG(ts);
        renderDimensions(svg, ts);
        expect(texts(svg)).toContain(`Pitch ${(90.53 * 1.25).toFixed(2)} mm`);
    });

    it("draws a pitch callout for every layout", () => {
        for (const layout of [30, 45, 60, 90, "radial"] as const) {
            const { data, svg } = build(layout);
            renderDimensions(svg, data);
            expect(texts(svg).some((x) => x?.startsWith("Pitch"))).toBe(true);
        }
    });
});
