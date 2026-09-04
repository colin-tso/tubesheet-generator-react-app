import type { ITubeSheetData } from "@/plugins/tubesheet-layout-generator";
import { buildTubeSheetSummaryRows } from "@/utils/tubeSheetSummaryRows";
import { readViewBoxSize } from "@/utils/svgExport";

// Layer names. Kept short and upper-case to match common CAD layer-naming
// conventions.
const LAYER_TUBES = "TUBES";
const LAYER_SHELL = "SHELL";
const LAYER_OTL = "OTL";
const LAYER_CENTERLINES = "CENTERLINES";
const LAYER_LABELS = "TUBE-LABELS";
const LAYER_NOTES = "NOTES";

const DASHED_LINETYPE = "DASHED";

// Mirrors the "8 4" stroke-dasharray used for the OTL/crosshair styles in
// generateTubeSheetSVG (see tubesheet-layout-generator.ts). DXF linetype
// elements alternate dash (positive) / gap (negative) lengths, in drawing
// units -- which are mm here, same as the SVG's user units.
const DASH_PATTERN = [8, -4];

// Font height used for the summary notes block, clamped so it stays legible on
// both very small and very large tubesheets.
const NOTES_MIN_HEIGHT = 2;
const NOTES_MAX_HEIGHT = 8;
const NOTES_HEIGHT_FRACTION = 0.015;
const NOTES_LINE_SPACING = 1.6;

// Fallback text height for any tube label whose group is missing a `font-size`
// attribute (shouldn't happen from generateTubeSheetSVG, but keeps the DXF
// export from throwing on a hand-built SVG).
const DEFAULT_LABEL_HEIGHT = 2;

const TEXT_STYLE_NAME = "ARIAL";
const TEXT_FONT_FILE = "arial.ttf";

/**
 * Parses a numeric SVG attribute, returning `fallback` if the attribute is
 * missing or not a finite number.
 */
const numAttr = (el: Element, name: string, fallback = 0): number => {
    const raw = el.getAttribute(name);
    if (raw === null) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
};

/**
 * Builds a DXF (R2007/AC1021) drawing from the rendered tubesheet SVG plus the
 * same summary data used by the PDF export.
 *
 * The SVG is walked rather than re-derived from `data`, so the DXF always
 * matches exactly what's on screen (and in the SVG/PNG/PDF exports) --
 * including the tube-labels toggle, since callers pass in the same
 * `labeledDrawingSVG` used for those exports.
 *
 * Circles are told apart by the markers generateTubeSheetSVG already leaves in
 * place: tube circles carry an `id` attribute (their 1-based tube number),
 * while the shell and OTL circles don't. Dashed vs solid strokes (recorded on
 * each `<g>` wrapper as a `stroke-dasharray` attribute) then separate the OTL
 * circle from the shell circle, and the crosshair lines from any future solid
 * line type.
 *
 * DXF uses a Y-up coordinate system while the source SVG is Y-down, so every Y
 * coordinate is negated on the way out -- this keeps the DXF's appearance (not
 * just its raw numbers) consistent with the on-screen drawing and the other
 * exports.
 */
export async function buildTubeSheetDxfBlob(
    svg: SVGSVGElement,
    data: (ITubeSheetData & { numTubes?: number }) | null,
    layoutLabel: string,
    requestedTubes: number | undefined,
): Promise<Blob> {
    const { DxfWriter, point3d, Units, TextHorizontalAlignment, TextVerticalAlignment } =
        await import("@tarikjabiri/dxf");

    const dxf = new DxfWriter();
    dxf.setUnits(Units.Millimeters);
    dxf.addLType(DASHED_LINETYPE, "Dashed", DASH_PATTERN);

    const textStyle = dxf.tables.addStyle(TEXT_STYLE_NAME);
    textStyle.fontFileName = TEXT_FONT_FILE;

    dxf.addLayer(LAYER_SHELL, 5); // Blue
    dxf.addLayer(LAYER_OTL, 1, DASHED_LINETYPE); // Red
    dxf.addLayer(LAYER_TUBES, 7); // White/black
    dxf.addLayer(LAYER_CENTERLINES, 8, DASHED_LINETYPE); // Grey
    dxf.addLayer(LAYER_LABELS, 3); // Green
    dxf.addLayer(LAYER_NOTES, 7);

    // Flips SVG's Y-down coordinates to DXF's Y-up, so the exported drawing
    // reads the same way up as the on-screen preview/PNG/SVG/PDF.
    const toDxfPoint = (x: number, y: number) => point3d(x, -y);

    for (const group of Array.from(svg.children)) {
        // Tag-name check rather than `instanceof SVGGElement`: some DOM
        // implementations used in tooling (e.g. jsdom) don't implement the full
        // SVG element class hierarchy, so this stays robust wherever the SVG
        // came from. This also skips the merged <style> element.
        if (group.tagName.toLowerCase() !== "g") continue;

        const dashed = group.hasAttribute("stroke-dasharray");
        const fontSize = group.hasAttribute("font-size")
            ? numAttr(group, "font-size", DEFAULT_LABEL_HEIGHT)
            : null;

        for (const el of Array.from(group.children)) {
            const tag = el.tagName.toLowerCase();

            if (tag === "circle") {
                const cx = numAttr(el, "cx");
                const cy = numAttr(el, "cy");
                const radius = numAttr(el, "r");
                const isTube = el.hasAttribute("id");

                dxf.addCircle(toDxfPoint(cx, cy), radius, {
                    layerName: isTube ? LAYER_TUBES : dashed ? LAYER_OTL : LAYER_SHELL,
                });
            } else if (tag === "line") {
                const x1 = numAttr(el, "x1");
                const y1 = numAttr(el, "y1");
                const x2 = numAttr(el, "x2");
                const y2 = numAttr(el, "y2");

                dxf.addLine(toDxfPoint(x1, y1), toDxfPoint(x2, y2), {
                    layerName: LAYER_CENTERLINES,
                    lineType: DASHED_LINETYPE,
                });
            } else if (tag === "text") {
                const x = numAttr(el, "x");
                const y = numAttr(el, "y");
                const height = fontSize ?? DEFAULT_LABEL_HEIGHT;
                const point = toDxfPoint(x, y);

                const labelText = dxf.addText(point, height, el.textContent ?? "", {
                    layerName: LAYER_LABELS,
                    horizontalAlignment: TextHorizontalAlignment.Middle,
                    verticalAlignment: TextVerticalAlignment.Middle,
                    secondAlignmentPoint: point,
                });
                labelText.textStyle = TEXT_STYLE_NAME;
            }
        }
    }

    // Summary notes block, left-aligned under the drawing's bounding box -- the
    // DXF equivalent of the PDF export's summary table, built from the same
    // rows so the two stay in sync.
    const rows = buildTubeSheetSummaryRows(data, layoutLabel, requestedTubes);
    if (rows.length > 0) {
        const { vbWidth, vbHeight } = readViewBoxSize(svg);
        const viewBox = svg.getAttribute("viewBox");
        const [vbX, vbY] = viewBox ? viewBox.split(" ").map(Number) : [0, 0];

        const noteHeight = Math.min(
            NOTES_MAX_HEIGHT,
            Math.max(NOTES_MIN_HEIGHT, Math.max(vbWidth, vbHeight) * NOTES_HEIGHT_FRACTION),
        );
        const lineHeight = noteHeight * NOTES_LINE_SPACING;
        const notesX = vbX;
        // Bottom edge of the drawing's bounding box in SVG space, converted
        // to DXF's flipped Y, minus a one-line gap before the first row.
        const notesTopY = -(vbY + vbHeight) - lineHeight;

        rows.forEach((row, i) => {
            const point = point3d(notesX, notesTopY - i * lineHeight);
            const noteText = dxf.addText(point, noteHeight, `${row.label}: ${row.value}`, {
                layerName: LAYER_NOTES,
            });
            noteText.textStyle = TEXT_STYLE_NAME;
        });

        const timestampText = dxf.addText(
            point3d(notesX, notesTopY - rows.length * lineHeight),
            noteHeight,
            `Generated ${new Date().toLocaleString()}`,
            { layerName: LAYER_NOTES },
        );
        timestampText.textStyle = TEXT_STYLE_NAME;
    }

    return new Blob([dxf.stringify()], { type: "application/dxf" });
}
