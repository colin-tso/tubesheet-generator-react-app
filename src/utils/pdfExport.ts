import type { ITubeSheetData } from "@/plugins/tubesheet-layout-generator";
import { buildTubeSheetSummaryRows } from "@/utils/tubeSheetSummaryRows";
import { readViewBoxSize } from "@/utils/svgExport";

// A4 in points (jsPDF default unit).
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

const MARGIN = 36;

// Reserve roughly the top 65% of the usable page height for the drawing; the
// summary table sits below it, matching the reference datasheet layout.
const DRAWING_AREA_RATIO = 0.62;

const TABLE_ROW_HEIGHT = 16;
const TABLE_LABEL_COL_WIDTH = 170;
const TABLE_FONT_SIZE = 9;

// jsPDF and svg2pdf.js are dynamically imported so they only load into the
// bundle when the user actually exports a PDF (mirrors the docs-page lazy chunk
// pattern already used elsewhere in the app).
export async function buildTubeSheetPdfBlob(
    svg: SVGSVGElement,
    data: (ITubeSheetData & { numTubes?: number }) | null,
    layoutLabel: string,
    requestedTubes: number | undefined,
): Promise<Blob> {
    const [{ jsPDF }, { svg2pdf }] = await Promise.all([import("jspdf"), import("svg2pdf.js")]);

    const doc = new jsPDF({ unit: "pt", format: "a4" });

    // Page border box, drawn first so it sits behind everything else.
    doc.setDrawColor(0);
    doc.setLineWidth(1);
    doc.rect(MARGIN, MARGIN, PAGE_WIDTH - MARGIN * 2, PAGE_HEIGHT - MARGIN * 2);

    const usableWidth = PAGE_WIDTH - MARGIN * 2;
    const drawingAreaHeight = (PAGE_HEIGHT - MARGIN * 2) * DRAWING_AREA_RATIO;

    // Clone the live SVG so we don't mutate what's on screen, then size it to
    // fit within the drawing area while preserving aspect ratio.
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const { vbWidth, vbHeight } = readViewBoxSize(clone);
    const scale = Math.min(usableWidth / vbWidth, drawingAreaHeight / vbHeight);
    const renderWidth = vbWidth * scale;
    const renderHeight = vbHeight * scale;
    const drawingX = MARGIN + (usableWidth - renderWidth) / 2;
    const drawingY = MARGIN;

    await svg2pdf(clone, doc, {
        x: drawingX,
        y: drawingY,
        width: renderWidth,
        height: renderHeight,
    });

    // Summary table, left-aligned, with its bottom edge anchored just above the
    // footer so it sits flush against the bottom margin regardless of how many
    // rows it has.
    const rows = buildTubeSheetSummaryRows(data, layoutLabel, requestedTubes);
    const tableWidth = TABLE_LABEL_COL_WIDTH + 130;
    const tableHeight = rows.length * TABLE_ROW_HEIGHT;
    const tableBottom = PAGE_HEIGHT - MARGIN;
    const tableTop = tableBottom - tableHeight;

    doc.setDrawColor(0);
    doc.setLineWidth(0.75);
    doc.setFontSize(TABLE_FONT_SIZE);

    rows.forEach((row, i) => {
        const rowY = tableTop + i * TABLE_ROW_HEIGHT;

        doc.rect(MARGIN, rowY, tableWidth, TABLE_ROW_HEIGHT);
        doc.line(
            MARGIN + TABLE_LABEL_COL_WIDTH,
            rowY,
            MARGIN + TABLE_LABEL_COL_WIDTH,
            rowY + TABLE_ROW_HEIGHT,
        );

        doc.setFont("helvetica", "normal");
        doc.text(row.label, MARGIN + 8, rowY + TABLE_ROW_HEIGHT / 2 + 3);
        doc.text(row.value, MARGIN + tableWidth - 8, rowY + TABLE_ROW_HEIGHT / 2 + 3, {
            align: "right",
        });
    });

    // Footer timestamp, in the viewer's local time, generated at export time.
    doc.setFontSize(7.5);
    doc.setTextColor(100);
    doc.text(`Generated ${new Date().toLocaleString()}`, MARGIN, PAGE_HEIGHT - MARGIN / 2);

    return doc.output("blob");
}
