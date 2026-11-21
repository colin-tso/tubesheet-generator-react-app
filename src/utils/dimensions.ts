import { getEffectiveShellID } from "@/plugins/tubesheet-layout-generator";
import type { ITubeSheetData } from "@/plugins/tubesheet-layout-generator";

// Drawing annotations: Shell ID and OTL diameter leaders, a pitch callout and
// a scale bar, drawn into the tubesheet SVG in the same millimetre coordinates
// as the tubes.
//
// Every size below is specified in screen pixels and converted to drawing
// units with `k` (user units per screen px, from the SVG's current CTM), so
// text and arrowheads keep a constant on-screen size however the drawing is
// scaled. Callers re-run renderDimensions when the SVG is resized.

const NS = "http://www.w3.org/2000/svg";
export const DIMENSIONS_GROUP_CLASS = "tubesheet-dims";

// Keep `.viewport-scale-bar` font-size in index.css equal to this.
const FONT_PX = 13;
const ARROW_PX = 11;
const LEADER_PX = 26;
const LANDING_PX = 16;
const GAP_PX = 5;
// Advance width of the mono face (~0.61 em), used to estimate label widths.
const CHAR_WIDTH_PX = FONT_PX * 0.61;
// Gap between the scale bar ticks and its labels' centre line.
const SCALE_LABEL_OFFSET_PX = FONT_PX / 2 + 6;
const EDGE_MARGIN_PX = 8;
export const SCALE_BAR_MIN_PX = 70;
// Used when the SVG has no layout (jsdom, detached SVG): assume it is shown
// about this wide on screen.
const FALLBACK_SVG_WIDTH_PX = 800;

// Theme colours and the font live in index.css (`.tubesheet-dims`). The plain
// colours below are only export fallbacks: a saved SVG/PNG has no stylesheet,
// and the CSS rules override them in the app.
const INK = "#1d4f91";
const HALO = "#ffffff";
// Knock-out around text and strokes so they stay legible over tubes.
const HALO_TEXT_PX = 7;
const HALO_LINE_PX = 4;

export interface DimensionsBounds {
    /** Visible drawing area in client px (the viewport minus any overlays). */
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export interface RenderDimensionsOptions {
    bounds?: DimensionsBounds;
    /** Draw the scale bar inside the SVG (false when it is shown as a separate overlay). */
    scaleBar?: boolean;
}

type Pt = readonly [number, number];

export const removeDimensions = (svg: SVGSVGElement): void => {
    svg.querySelectorAll(`:scope > g.${DIMENSIONS_GROUP_CLASS}`).forEach((g) => g.remove());
};

const polar = (r: number, deg: number): Pt => {
    const a = (deg * Math.PI) / 180;
    return [r * Math.cos(a), r * Math.sin(a)];
};

const segDist = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
};

export const niceLength = (minMm: number): number => {
    for (let e = 0.001; e < 1e9; e *= 10) {
        for (const m of [1, 2, 5]) {
            if (m * e >= minMm) return m * e;
        }
    }
    return minMm;
};

export const fmtMm = (v: number): string =>
    Number.isInteger(v) ? String(v) : String(+v.toFixed(3));

/**
 * Draws (or redraws) the dimension group on `svg` for the given result.
 * Returns false and leaves nothing behind if there is nothing to dimension.
 */
export function renderDimensions(
    svg: SVGSVGElement,
    data: ITubeSheetData,
    options: RenderDimensionsOptions = {},
): boolean {
    removeDimensions(svg);

    const shellID = getEffectiveShellID(data);
    const otlDia = data.OTL;
    const field = data.tubeField;
    const [vbX, vbY, vbW, vbH] = (svg.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
    if (
        !shellID ||
        !(shellID > 0) ||
        !field ||
        field.length === 0 ||
        ![vbX, vbY, vbW, vbH].every(Number.isFinite) ||
        vbW <= 0
    ) {
        return false;
    }
    const vb = { x: vbX, y: vbY, width: vbW, height: vbH };

    const R = shellID / 2;
    const tubeR = data.tubeOD / 2;
    const pitch = data.tubeOD * data.pitchRatio;
    const radial = data.layout === "radial";

    // Screen px per user unit.
    let s = svg.getScreenCTM?.()?.a ?? NaN;
    if (!Number.isFinite(s) || s <= 0) s = FALLBACK_SVG_WIDTH_PX / vb.width;
    const k = 1 / s;

    // Drawing area in user units.
    let xMin = vb.x + EDGE_MARGIN_PX * k;
    let xMax = vb.x + vb.width - EDGE_MARGIN_PX * k;
    const b = options.bounds;
    if (b) {
        const sr = svg.getBoundingClientRect();
        xMin = vb.x + (b.left - sr.left) * k + EDGE_MARGIN_PX * k;
        xMax = vb.x + (b.right - sr.left) * k - EDGE_MARGIN_PX * k;
    }

    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", DIMENSIONS_GROUP_CLASS);

    // Two layers: every knock-out first, then all the ink on top, so one
    // segment's halo never cuts into another's line.
    const haloLayer = document.createElementNS(NS, "g");
    const inkLayer = document.createElementNS(NS, "g");
    haloLayer.setAttribute("class", "dim-halo");
    inkLayer.setAttribute("class", "dim-ink");
    g.append(haloLayer, inkLayer);

    const make = (
        layer: SVGGElement,
        name: string,
        attrs: Record<string, string | number>,
        text?: string,
    ) => {
        const e = document.createElementNS(NS, name);
        for (const key in attrs) e.setAttribute(key, String(attrs[key]));
        if (text != null) e.textContent = text;
        layer.appendChild(e);
        return e;
    };
    const el = (name: string, attrs: Record<string, string | number>, text?: string) =>
        make(inkLayer, name, attrs, text);
    const line = (x1: number, y1: number, x2: number, y2: number, width = 1) => {
        const geometry = { x1, y1, x2, y2, "vector-effect": "non-scaling-stroke" };
        make(haloLayer, "line", {
            ...geometry,
            stroke: HALO,
            "stroke-width": width + HALO_LINE_PX,
            "stroke-linecap": "round",
        });
        return el("line", { ...geometry, stroke: INK, "stroke-width": width });
    };
    const text = (x: number, y: number, t: string, anchor: "start" | "middle" | "end") => {
        const attrs = {
            x,
            y,
            "text-anchor": anchor,
            "dominant-baseline": "central",
            "font-size": FONT_PX * k,
            "font-family": "monospace",
        };
        make(
            haloLayer,
            "text",
            {
                ...attrs,
                fill: HALO,
                stroke: HALO,
                "stroke-width": HALO_TEXT_PX * k,
                "stroke-linejoin": "round",
            },
            t,
        );
        return make(inkLayer, "text", { ...attrs, fill: INK, stroke: "none" }, t);
    };
    // Closed filled arrow, tip at (tx, ty), (ux, uy) pointing back along the leader.
    const arrow = (tx: number, ty: number, ux: number, uy: number) => {
        const len = ARROW_PX * k;
        const half = len / 6;
        const bx = tx + ux * len;
        const by = ty + uy * len;
        const points = [
            tx,
            ty,
            bx - uy * half,
            by + ux * half,
            bx + uy * half,
            by - ux * half,
        ].join(" ");
        make(haloLayer, "polygon", {
            points,
            fill: HALO,
            stroke: HALO,
            "stroke-width": HALO_LINE_PX * k,
            "stroke-linejoin": "round",
        });
        el("polygon", { points, fill: INK, stroke: "none" });
    };
    const cross = (x: number, y: number) => {
        const c = 3.5 * k;
        line(x - c, y - c, x + c, y + c);
        line(x - c, y + c, x + c, y - c);
    };
    const fits = (ex: number, label: string) => {
        const dir = ex >= 0 ? 1 : -1;
        const end = ex + dir * (LANDING_PX + GAP_PX + label.length * CHAR_WIDTH_PX) * k;
        return end <= xMax && end >= xMin;
    };
    // Leader: arrow on the object, straight segment, horizontal landing, text.
    const leaderTo = (tx: number, ty: number, ex: number, ey: number, label: string) => {
        const d = Math.hypot(ex - tx, ey - ty) || 1;
        const dir = ex >= 0 ? 1 : -1;
        const lx = ex + dir * LANDING_PX * k;
        line(tx, ty, ex, ey);
        line(ex, ey, lx, ey);
        arrow(tx, ty, (ex - tx) / d, (ey - ty) / d);
        text(lx + dir * GAP_PX * k, ey, label, dir > 0 ? "start" : "end");
    };
    // Radial leader on a circle of radius r, trying fallback angles until the label fits.
    const radialLeader = (r: number, angles: number[], label: string) => {
        const deg =
            angles.find((a) => fits(polar(r, a)[0] + polar(1, a)[0] * LEADER_PX * k, label)) ??
            angles[0];
        const [x, y] = polar(r, deg);
        const [ux, uy] = polar(1, deg);
        leaderTo(x, y, x + ux * LEADER_PX * k, y + uy * LEADER_PX * k, label);
    };

    radialLeader(R, [135, 120, 105, 90], `Ø${shellID.toFixed(2)} mm`);
    if (otlDia && otlDia > 0) {
        radialLeader(otlDia / 2, [-45, -60, -75, -90], `Ø${otlDia.toFixed(2)} mm OTL`);
    }

    drawPitch();

    // Scale bar, bottom-right of the shell.
    if (options.scaleBar !== false) {
        const len = niceLength(SCALE_BAR_MIN_PX * k);
        const x1 = R;
        const x0 = x1 - len;
        const y0 = vb.y + vb.height - EDGE_MARGIN_PX * k;
        line(x0, y0, x1, y0, 2);
        for (let i = 0; i <= 5; i++) {
            line(x0 + (i * len) / 5, y0 - 4 * k, x0 + (i * len) / 5, y0 + 4 * k);
        }
        text(x0, y0 - SCALE_LABEL_OFFSET_PX * k, "0", "middle");
        text(x1, y0 - SCALE_LABEL_OFFSET_PX * k, `${fmtMm(len)} mm`, "middle");
    }

    svg.appendChild(g);
    return true;

    // Pitch: pick a neighbouring pair near the upper left whose leader crosses
    // no tubes; radial layouts use a pair lying along a radius so the
    // dimensioned distance is the true pitch.
    function drawPitch() {
        if (!(pitch > 0)) return;
        const eps = Math.max(pitch * 0.002, 1e-6);
        const rr = (t: { x: number; y: number }) => Math.hypot(t.x, t.y);

        // Small fields are searched whole. For big ones only tubes near the
        // shell are considered, since only they can have a short outward leader.
        const SMALL_FIELD = 400;
        const pool = field!.length <= SMALL_FIELD ? field! : field!.filter((t) => rr(t) > R * 0.55);
        const target = polar(R * 0.8, -135);
        const near =
            pool.length <= SMALL_FIELD
                ? pool
                : [...pool]
                      .sort(
                          (a, b) =>
                              Math.hypot(a.x - target[0], a.y - target[1]) -
                              Math.hypot(b.x - target[0], b.y - target[1]),
                      )
                      .slice(0, 48);
        const outer = pool;

        const pairsWithin = (tol: number, radialOnly: boolean) => {
            const found: Array<[Pt, Pt]> = [];
            for (let i = 0; i < near.length; i++) {
                for (let j = i + 1; j < near.length; j++) {
                    const a = near[i];
                    const c = near[j];
                    if (Math.abs(Math.hypot(a.x - c.x, a.y - c.y) - pitch) > tol) continue;
                    if (radialOnly && Math.abs(Math.abs(rr(a) - rr(c)) - pitch) > tol) continue;
                    found.push([
                        [a.x, a.y],
                        [c.x, c.y],
                    ]);
                }
            }
            return found;
        };
        // Exact pairs first (a radial pair for radial layouts), then looser
        // ones, so a pitch callout is always shown when two tubes exist.
        let pairs = pairsWithin(eps, radial);
        if (pairs.length === 0 && radial) pairs = pairsWithin(eps, false);
        if (pairs.length === 0) pairs = pairsWithin(pitch * 0.25, false);
        if (pairs.length === 0) {
            let bestD = Infinity;
            for (let i = 0; i < near.length; i++) {
                for (let j = i + 1; j < near.length; j++) {
                    const d = Math.hypot(near[i].x - near[j].x, near[i].y - near[j].y);
                    if (d < bestD) {
                        bestD = d;
                        pairs = [
                            [
                                [near[i].x, near[i].y],
                                [near[j].x, near[j].y],
                            ],
                        ];
                    }
                }
            }
        }
        if (pairs.length === 0) return;

        const label = `Pitch ${pitch.toFixed(2)} mm`;
        const reach = R + 16 * k;
        let best: {
            score: number;
            a: Pt;
            c: Pt;
            mx: number;
            my: number;
            ex: number;
            ey: number;
        } | null = null;

        for (const [a, c] of pairs) {
            const mx = (a[0] + c[0]) / 2;
            const my = (a[1] + c[1]) / 2;
            const axis = (Math.atan2(c[1] - a[1], c[0] - a[0]) * 180) / Math.PI;
            let dTarget = Math.abs((Math.atan2(my, mx) * 180) / Math.PI + 135);
            if (dTarget > 180) dTarget = 360 - dTarget;
            for (const base of [axis + 90, axis - 90]) {
                for (let off = -45; off <= 45; off += 5) {
                    const th = ((base + off) * Math.PI) / 180;
                    const ux = Math.cos(th);
                    const uy = Math.sin(th);
                    const bq = mx * ux + my * uy;
                    const cq = mx * mx + my * my - reach * reach;
                    const t = -bq + Math.sqrt(Math.max(0, bq * bq - cq));
                    if (t <= 0) continue;
                    const ex = mx + ux * t;
                    const ey = my + uy * t;
                    let hits = 0;
                    for (const o of outer) {
                        if (segDist(o.x, o.y, mx, my, ex, ey) < tubeR - 0.5) hits++;
                    }
                    const score =
                        hits * pitch * 1.5 +
                        (fits(ex, label) ? 0 : 5000) +
                        t +
                        dTarget * 0.8 +
                        Math.abs(off) * 0.3;
                    if (!best || score < best.score) best = { score, a, c, mx, my, ex, ey };
                }
            }
        }
        // Some overlap with tubes is accepted; the halo keeps the text readable.
        if (!best) return;

        line(best.a[0], best.a[1], best.c[0], best.c[1]);
        cross(best.a[0], best.a[1]);
        cross(best.c[0], best.c[1]);
        leaderTo(best.mx, best.my, best.ex, best.ey, label);
    }
}
