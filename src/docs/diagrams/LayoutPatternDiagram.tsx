import type { TubeSheetLayout } from "@/plugins/tubesheet-layout-generator";

// Illustrative pitch, in local SVG units. Large relative to the tube radius
// so the geometry, arrows, and labels all stay readable at the rendered
// size, matching the reference diagram’s proportions.
const PITCH = 180;
const TUBE_R = 47;
const FONT = 16;
const FONT_LABEL = 16;
const ANGLE_LABEL_OFFSET = 38;
const ARC_SIZE_PERCENT = 0.6;
const PADDING = 20;
const DIM_PADDING = FONT_LABEL * 0.8;
const DIM_EXTENSION = 3;
const VIEWBOX_WIDTH = 480;

function getConstants(layout: 30 | 45 | 60 | 90) {
    const sin60 = Math.sqrt(3) / 2;
    const cos45 = 1 / Math.sqrt(2);
    switch (layout) {
        case 30:
            return { dx: PITCH, dy: PITCH * sin60, C: PITCH / 2 };
        case 60:
            return { dx: PITCH * sin60, dy: PITCH / 2, C: PITCH / 2 };
        case 90:
            return { dx: PITCH, dy: PITCH, C: 0 };
        case 45:
            return { dx: PITCH / cos45, dy: PITCH / cos45 / 2, C: PITCH / cos45 / 2 };
    }
}

interface LayoutPatternDiagramProps {
    layout: Exclude<TubeSheetLayout, "radial">;
}

function ArrowDefs({ id }: { id: string }) {
    return (
        <defs>
            <marker
                id={id}
                viewBox="0 0 10 10"
                refX="10"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
            >
                <path d="M 0 0 L 10 5 L 0 10 z" className="docs-diagram-arrowhead" />
            </marker>
        </defs>
    );
}

function DimLine({
    x1,
    y1,
    x2,
    y2,
    arrowId,
    label,
    labelX,
    labelY,
    fontSize = FONT_LABEL,
    textAnchor,
    dominantBaseline = "auto",
}: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    arrowId: string;
    label: string;
    labelX: number;
    labelY: number;
    fontSize?: number;
    textAnchor?: React.SVGProps<SVGTextElement>["textAnchor"];
    dominantBaseline?: React.SVGProps<SVGTextElement>["dominantBaseline"];
}) {
    return (
        <>
            <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                className="docs-diagram-guide"
                markerStart={`url(#${arrowId})`}
                markerEnd={`url(#${arrowId})`}
            />
            <text
                x={labelX}
                y={labelY}
                className="docs-diagram-label"
                fontSize={fontSize}
                textAnchor={textAnchor ?? "middle"}
                dominantBaseline={dominantBaseline}
            >
                {label}
            </text>
        </>
    );
}

// 90°: four tubes at the corners of an axis-aligned square. dx and dy are
// the square’s own sides (both equal to pitch), and the corner angle is 90°.
function SquareDiagram90() {
    const { dx, dy } = getConstants(90);
    const arrowId = "arrow-90";

    const pTL = { x: -dx / 2, y: 0 }; // top-left, "Tube"
    const pTR = { x: dx / 2, y: 0 };
    const pBL = { x: -dx / 2, y: dy };
    const pBR = { x: dx / 2, y: dy };

    const dyGuideX = -20;
    const dxGuideY = dy + TUBE_R + 20;
    const halfGuideY = dxGuideY + 34;

    // const pad = TUBE_R + 30;
    // const minX = pTL.x - TUBE_R - PADDING;
    // const maxX = pTR.x + TUBE_R + PADDING;
    const minY = pTL.y - TUBE_R - PADDING - FONT;
    const maxY = halfGuideY + DIM_PADDING + FONT;
    // const viewBox = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
    const viewBox = `${-VIEWBOX_WIDTH / 2} ${minY} ${VIEWBOX_WIDTH} ${maxY - minY}`;

    const arcR = TUBE_R * ARC_SIZE_PERCENT;

    // Angle arc
    const arcCenter = pBL;
    const arcStartAngle = -90;
    const arcSweepAngle = 90;
    const arcEnd = {
        x: arcCenter.x + arcR * Math.cos((arcStartAngle * Math.PI) / 180),
        y: arcCenter.y + arcR * Math.sin((arcStartAngle * Math.PI) / 180),
    };
    const arcEnd2 = {
        x: arcCenter.x + arcR * Math.cos(((arcStartAngle + arcSweepAngle) * Math.PI) / 180),
        y: arcCenter.y + arcR * Math.sin(((arcStartAngle + arcSweepAngle) * Math.PI) / 180),
    };
    const largeArcFlag = arcSweepAngle > 180 ? 1 : 0;

    // Angle label position: mid-angle, slightly outside arc
    const angleLabelAngle = arcStartAngle + arcSweepAngle / 2;
    const angleLabelR = arcR + ANGLE_LABEL_OFFSET;
    const angleLabelX = arcCenter.x + angleLabelR * Math.cos((angleLabelAngle * Math.PI) / 180);
    const angleLabelY = arcCenter.y + angleLabelR * Math.sin((angleLabelAngle * Math.PI) / 180);

    return (
        <svg
            viewBox={viewBox}
            className="docs-diagram-svg"
            role="img"
            aria-label="Tube centre pattern for the 90 degree layout: an axis-aligned square with dx, dy, and a 90 degree corner."
        >
            <ArrowDefs id={arrowId} />

            {/* Square */}
            <path
                d={`M ${pTL.x} ${pTL.y} L ${pTR.x} ${pTR.y} L ${pBR.x} ${pBR.y} L ${pBL.x} ${pBL.y} Z`}
                className="docs-diagram-pitch-shape"
            />

            {/* dy */}
            <DimLine
                x1={dyGuideX}
                y1={0}
                x2={dyGuideX}
                y2={dy}
                arrowId={arrowId}
                label="dy"
                labelX={dyGuideX - DIM_PADDING}
                labelY={dy / 2}
                textAnchor="end"
                dominantBaseline="central"
            />
            <line
                x1={dyGuideX + DIM_EXTENSION}
                y1={0}
                x2={pTL.x}
                y2={0}
                className="docs-diagram-guide-dashed"
            />
            <line
                x1={dyGuideX + DIM_EXTENSION}
                y1={dy}
                x2={pBL.x}
                y2={dy}
                className="docs-diagram-guide-dashed"
            />

            {/* dx */}
            <DimLine
                x1={pBL.x}
                y1={dxGuideY}
                x2={pBR.x}
                y2={dxGuideY}
                arrowId={arrowId}
                label="dx = Pt"
                labelX={(pBL.x + pBR.x) / 2}
                labelY={dxGuideY - DIM_PADDING}
            />
            <line
                x1={pBL.x}
                y1={dy}
                x2={pBL.x}
                y2={halfGuideY + DIM_EXTENSION}
                className="docs-diagram-guide-dashed"
            />
            <line
                x1={pBR.x}
                y1={dy}
                x2={pBR.x}
                y2={dxGuideY + 6}
                className="docs-diagram-guide-dashed"
            />

            {/* dx/2 */}
            <DimLine
                x1={pBL.x}
                y1={halfGuideY}
                x2={pBL.x + dx / 2}
                y2={halfGuideY}
                arrowId={arrowId}
                label="dx/2 = Pt/2"
                labelX={pBL.x + dx / 4}
                labelY={halfGuideY + DIM_PADDING}
                dominantBaseline="hanging"
            />
            <line
                x1={pBL.x + dx / 2}
                y1={dxGuideY + DIM_EXTENSION}
                x2={pBL.x + dx / 2}
                y2={halfGuideY + DIM_EXTENSION}
                className="docs-diagram-guide-dashed"
            />

            {[pTL, pTR, pBL, pBR].map((t, idx) => (
                <circle key={idx} cx={t.x} cy={t.y} r={TUBE_R} className="docs-diagram-tube" />
            ))}
            <text
                x={pTL.x}
                y={pTL.y - TUBE_R - PADDING}
                className="docs-diagram-tube-label"
                fontSize={FONT}
            >
                Tube
            </text>

            <path
                d={`M ${arcEnd.x} ${arcEnd.y} A ${arcR} ${arcR} 0 ${largeArcFlag} 1 ${arcEnd2.x} ${arcEnd2.y}`}
                className="docs-diagram-arc"
            />
            <text
                x={angleLabelX}
                y={angleLabelY}
                className="docs-diagram-label docs-diagram-label-angle"
                fontSize={FONT}
                textAnchor="middle"
                dominantBaseline="central"
            >
                90°
            </text>
        </svg>
    );
}

// 45°: the same square, rotated 45° into a diamond. Four tubes (top, right,
// bottom, left), each pitch away from its two neighbours. dx is the full
// width of the diamond; dy is the half-height from the top tube to centre.
function DiamondDiagram45() {
    const { dx, dy } = getConstants(45);
    const arrowId = "arrow-45";

    const top = { x: 0, y: -dy }; // "Tube"
    const right = { x: dx / 2, y: 0 };
    const bottom = { x: 0, y: dy };
    const left = { x: -dx / 2, y: 0 };

    const dyGuideX = right.x + TUBE_R * 0.5;
    const dxGuideY = bottom.y + TUBE_R + 40;
    const halfGuideY = dxGuideY + 34;

    // const minX = left.x - TUBE_R - DIM_PADDING;
    // const maxX = dyGuideX + TUBE_R + PADDING;
    const minY = top.y - TUBE_R - PADDING - FONT;
    const maxY = halfGuideY + DIM_PADDING + FONT;
    // const viewBox = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
    const viewBox = `${-VIEWBOX_WIDTH / 2} ${minY} ${VIEWBOX_WIDTH} ${maxY - minY}`;

    const arcR = TUBE_R * ARC_SIZE_PERCENT;

    // Angle arc
    const arcCenter = left;
    const arcStartAngle = -45;
    const arcSweepAngle = 90;
    const arcEnd = {
        x: arcCenter.x + arcR * Math.cos((arcStartAngle * Math.PI) / 180),
        y: arcCenter.y + arcR * Math.sin((arcStartAngle * Math.PI) / 180),
    };
    const arcEnd2 = {
        x: arcCenter.x + arcR * Math.cos(((arcStartAngle + arcSweepAngle) * Math.PI) / 180),
        y: arcCenter.y + arcR * Math.sin(((arcStartAngle + arcSweepAngle) * Math.PI) / 180),
    };
    const largeArcFlag = arcSweepAngle > 180 ? 1 : 0;

    // Angle label position: mid-angle, slightly outside arc
    const angleLabelAngle = arcStartAngle + arcSweepAngle / 2;
    const angleLabelR = arcR + ANGLE_LABEL_OFFSET;
    const angleLabelX = arcCenter.x + angleLabelR * Math.cos((angleLabelAngle * Math.PI) / 180);
    const angleLabelY = arcCenter.y + angleLabelR * Math.sin((angleLabelAngle * Math.PI) / 180);

    return (
        <svg
            viewBox={viewBox}
            className="docs-diagram-svg"
            role="img"
            aria-label="Tube centre pattern for the 45 degree layout: a diamond with dx, dy, and a 90 degree corner."
        >
            <ArrowDefs id={arrowId} />

            {/* Square */}
            <path
                d={`M ${top.x} ${top.y} L ${right.x} ${right.y} L ${bottom.x} ${bottom.y} L ${left.x} ${left.y} Z`}
                className="docs-diagram-pitch-shape"
            />

            <DimLine
                x1={dyGuideX}
                y1={top.y}
                x2={dyGuideX}
                y2={0}
                arrowId={arrowId}
                label="dy"
                labelX={dyGuideX + DIM_PADDING}
                labelY={top.y / 2}
                textAnchor="start"
                dominantBaseline="central"
            />
            <line
                x1={top.x}
                y1={top.y}
                x2={dyGuideX - DIM_EXTENSION}
                y2={top.y}
                className="docs-diagram-guide-dashed"
            />
            <line
                x1={right.x}
                y1={0}
                x2={dyGuideX - DIM_EXTENSION}
                y2={0}
                className="docs-diagram-guide-dashed"
            />

            {/* dx */}
            <DimLine
                x1={left.x}
                y1={dxGuideY}
                x2={right.x}
                y2={dxGuideY}
                arrowId={arrowId}
                label="dx = Pt·√2"
                labelX={0}
                labelY={dxGuideY - DIM_PADDING}
            />
            <line
                x1={left.x}
                y1={0}
                x2={left.x}
                y2={halfGuideY + DIM_EXTENSION}
                className="docs-diagram-guide-dashed"
            />
            <line
                x1={right.x}
                y1={0}
                x2={right.x}
                y2={dxGuideY + DIM_EXTENSION}
                className="docs-diagram-guide-dashed"
            />

            {/* dx/2 */}
            <DimLine
                x1={left.x}
                y1={halfGuideY}
                x2={0}
                y2={halfGuideY}
                arrowId={arrowId}
                label="dx/2 = (Pt·√2)/2"
                labelX={left.x / 2}
                labelY={halfGuideY + DIM_PADDING}
                dominantBaseline="hanging"
            />
            <line
                x1={0}
                y1={top.y + DIM_EXTENSION}
                x2={0}
                y2={halfGuideY + DIM_EXTENSION}
                className="docs-diagram-guide-dashed"
            />

            <path
                d={`M ${arcEnd.x} ${arcEnd.y} A ${arcR} ${arcR} 0 ${largeArcFlag} 1 ${arcEnd2.x} ${arcEnd2.y}`}
                className="docs-diagram-arc"
            />
            <text
                x={angleLabelX}
                y={angleLabelY}
                className="docs-diagram-label docs-diagram-label-angle"
                fontSize={FONT}
                textAnchor="middle"
                dominantBaseline="central"
            >
                90°
            </text>

            {[top, right, bottom, left].map((t, idx) => (
                <circle key={idx} cx={t.x} cy={t.y} r={TUBE_R} className="docs-diagram-tube" />
            ))}
            <text
                x={top.x}
                y={top.y - TUBE_R - 14}
                className="docs-diagram-tube-label"
                fontSize={FONT}
            >
                Tube
            </text>
        </svg>
    );
}

// Triangular family (30°, 60°): an apex tube and two symmetric base tubes,
// each pitch away from the apex. The apex half-angle between the vertical
// and the pitch line is exactly the layout’s own name (30° or 60°). That is
// where the name comes from.

// 30° Triangular Layout
function TriangleDiagram30() {
    const { dx, dy } = getConstants(30);
    const arrowId = "arrow-30";

    const p0 = { x: 0, y: 0 }; // apex (top)
    const pL = { x: -dx / 2, y: dy }; // left base
    const pR = { x: dx / 2, y: dy }; // right base

    const arcR = TUBE_R * ARC_SIZE_PERCENT;

    // Angle arc at LEFT base: sweep from pitch line (up-right, 300°) to horizontal base line (0°)
    const arcCenter = pL;
    const arcStartAngle = -60; // degrees, 0 = right, 90 = down
    const arcSweepAngle = 60;
    const arcEnd = {
        x: arcCenter.x + arcR * Math.cos((arcStartAngle * Math.PI) / 180),
        y: arcCenter.y + arcR * Math.sin((arcStartAngle * Math.PI) / 180),
    };
    const arcEnd2 = {
        x: arcCenter.x + arcR * Math.cos(((arcStartAngle + arcSweepAngle) * Math.PI) / 180),
        y: arcCenter.y + arcR * Math.sin(((arcStartAngle + arcSweepAngle) * Math.PI) / 180),
    };
    const largeArcFlag = arcSweepAngle > 180 ? 1 : 0;

    // Dimension guides positioned to avoid label occlusion
    const dyGuideX = pL.x - PADDING;
    const dxGuideY = dy + TUBE_R + PADDING;
    const halfGuideY = dxGuideY + 30;

    // const minX = dyGuideX - 125;
    // const maxX = pR.x + TUBE_R / 2;
    // const absMaxX = Math.max(Math.abs(minX), Math.abs(maxX));
    const minY = -TUBE_R - PADDING - FONT;
    const maxY = halfGuideY + DIM_PADDING + FONT;
    // const viewBox = `${-absMaxX} ${minY} ${absMaxX * 2} ${maxY - minY}`;
    const viewBox = `${-VIEWBOX_WIDTH / 2} ${minY} ${VIEWBOX_WIDTH} ${maxY - minY}`;

    // Angle label position: mid-angle, slightly outside arc
    const angleLabelAngle = arcStartAngle + arcSweepAngle / 2;
    const angleLabelR = arcR + ANGLE_LABEL_OFFSET;
    const angleLabelX = arcCenter.x + angleLabelR * Math.cos((angleLabelAngle * Math.PI) / 180);
    const angleLabelY = arcCenter.y + angleLabelR * Math.sin((angleLabelAngle * Math.PI) / 180);

    return (
        <svg
            viewBox={viewBox}
            className="docs-diagram-svg"
            role="img"
            aria-label="Tube centre pattern for the 30° layout: an apex tube with two base tubes one pitch away, dx, dy, and the 60° base angle."
        >
            <ArrowDefs id={arrowId} />

            {/* Triangle outline */}
            <path
                d={`M ${p0.x} ${p0.y} L ${pR.x} ${pR.y} L ${pL.x} ${pL.y} L ${p0.x} ${p0.y}`}
                className="docs-diagram-pitch-shape"
            />

            {/* dy guide, off to the left */}
            <DimLine
                x1={dyGuideX}
                y1={0}
                x2={dyGuideX}
                y2={dy}
                arrowId={arrowId}
                label="dy = Pt·√3/2"
                labelX={dyGuideX - DIM_PADDING}
                labelY={dy / 2}
                textAnchor="end"
                dominantBaseline="central"
            />
            <line x1={dyGuideX + 6} y1={0} x2={p0.x} y2={0} className="docs-diagram-guide-dashed" />
            <line
                x1={dyGuideX + 6}
                y1={dy}
                x2={pL.x}
                y2={dy}
                className="docs-diagram-guide-dashed"
            />

            {/* dx, below the base - label centered, above arrow line */}
            <DimLine
                x1={pL.x}
                y1={dxGuideY}
                x2={pR.x}
                y2={dxGuideY}
                arrowId={arrowId}
                label="dx = Pt"
                labelX={(pL.x + pR.x) / 2}
                labelY={dxGuideY - DIM_PADDING}
            />
            <line
                x1={pL.x}
                y1={dy}
                x2={pL.x}
                y2={halfGuideY + 6}
                className="docs-diagram-guide-dashed"
            />
            <line
                x1={pR.x}
                y1={dy}
                x2={pR.x}
                y2={dxGuideY + 6}
                className="docs-diagram-guide-dashed"
            />

            {/* dx/2, label centered, below arrow line */}
            <DimLine
                x1={pL.x}
                y1={halfGuideY}
                x2={p0.x}
                y2={halfGuideY}
                arrowId={arrowId}
                label="dx/2 = Pt/2"
                labelX={pL.x / 2}
                labelY={halfGuideY + DIM_PADDING}
                dominantBaseline="hanging"
            />
            <line
                x1={p0.x}
                y1={dy}
                x2={p0.x}
                y2={halfGuideY + 6}
                className="docs-diagram-guide-dashed"
            />

            {/* Tubes, drawn first so the triangle outline and angle arc paint on top */}
            {[p0, pL, pR].map((t, idx) => (
                <circle key={idx} cx={t.x} cy={t.y} r={TUBE_R} className="docs-diagram-tube" />
            ))}
            <text
                x={p0.x}
                y={p0.y - TUBE_R - PADDING}
                className="docs-diagram-tube-label"
                fontSize={FONT}
            >
                Tube
            </text>

            {/* Angle arc + label at left base (60°) */}
            <path
                d={`M ${arcEnd.x} ${arcEnd.y} A ${arcR} ${arcR} 0 ${largeArcFlag} 1 ${arcEnd2.x} ${arcEnd2.y}`}
                className="docs-diagram-arc"
            />
            <text
                x={angleLabelX}
                y={angleLabelY}
                className="docs-diagram-label docs-diagram-label-angle"
                fontSize={FONT}
                textAnchor="middle"
                dominantBaseline="central"
            >
                60°
            </text>
        </svg>
    );
}

// 60° Triangular Layout
function TriangleDiagram60() {
    const { dx, dy } = getConstants(60);
    const arrowId = "arrow-60";

    const p0 = { x: 0, y: 0 }; // top centre

    const pT1 = { x: -dx / 2, y: 0 }; // top tube
    const pT2 = { x: -dx / 2, y: dy * 2 }; // bottom left tube
    const pT3 = { x: dx / 2, y: dy }; // right tube

    const arcR = TUBE_R * ARC_SIZE_PERCENT;

    // Angle arc
    const arcCenter = pT2;
    const arcStartAngle = -90; // degrees, 0 = right, 90 = down
    const arcSweepAngle = 60; // apex half-angle = 60°
    const arcEnd = {
        x: arcCenter.x + arcR * Math.cos((arcStartAngle * Math.PI) / 180),
        y: arcCenter.y + arcR * Math.sin((arcStartAngle * Math.PI) / 180),
    };
    const arcEnd2 = {
        x: arcCenter.x + arcR * Math.cos(((arcStartAngle + arcSweepAngle) * Math.PI) / 180),
        y: arcCenter.y + arcR * Math.sin(((arcStartAngle + arcSweepAngle) * Math.PI) / 180),
    };
    const largeArcFlag = arcSweepAngle > 180 ? 1 : 0;

    // Dimension guides positioned to avoid label occlusion
    const dyGuideX = pT2.x - TUBE_R - PADDING;
    const dxGuideY = dy * 2 + TUBE_R + PADDING;
    const halfGuideY = pT3.y;

    // const minX = dyGuideX - 85;
    // const maxX = pT3.x + TUBE_R / 2;
    // const absMaxX = Math.max(Math.abs(minX), Math.abs(maxX));
    const minY = -TUBE_R - PADDING - FONT;
    const maxY = dxGuideY + DIM_PADDING + FONT;
    // const viewBox = `${-absMaxX} ${minY} ${absMaxX * 2} ${maxY - minY}`;
    const viewBox = `${-VIEWBOX_WIDTH / 2} ${minY} ${VIEWBOX_WIDTH} ${maxY - minY}`;

    // Angle label position: mid-angle, slightly outside arc
    const angleLabelAngle = arcStartAngle + arcSweepAngle / 2;
    const angleLabelR = arcR + ANGLE_LABEL_OFFSET;
    const angleLabelX = arcCenter.x + angleLabelR * Math.cos((angleLabelAngle * Math.PI) / 180);
    const angleLabelY = arcCenter.y + angleLabelR * Math.sin((angleLabelAngle * Math.PI) / 180);

    return (
        <svg
            viewBox={viewBox}
            className="docs-diagram-svg"
            role="img"
            aria-label="Tube centre pattern for the 60° layout: an apex tube with two base tubes one pitch away, dx, dy, and the 60° apex angle."
        >
            <ArrowDefs id={arrowId} />

            {/* Triangle outline */}
            <path
                d={`M ${pT1.x} ${pT1.y} L ${pT2.x} ${pT2.y} L ${pT3.x} ${pT3.y} ${pT1.x} ${pT1.y}`}
                className="docs-diagram-pitch-shape"
            />

            {/* dy guide, off to the left */}
            <DimLine
                x1={dyGuideX}
                y1={0}
                x2={dyGuideX}
                y2={dy}
                arrowId={arrowId}
                label="dy = Pt/2"
                labelX={dyGuideX - DIM_PADDING}
                labelY={dy / 2 + 5}
                textAnchor="end"
            />
            <line
                x1={dyGuideX + DIM_EXTENSION}
                y1={0}
                x2={pT1.x}
                y2={0}
                className="docs-diagram-guide-dashed"
            />
            <line
                x1={dyGuideX + DIM_EXTENSION}
                y1={dy}
                x2={pT3.x}
                y2={dy}
                className="docs-diagram-guide-dashed"
            />

            {/* dx, below the base - label centered, below arrow line */}
            <DimLine
                x1={pT1.x}
                y1={dxGuideY}
                x2={pT3.x}
                y2={dxGuideY}
                arrowId={arrowId}
                label="dx = Pt·√3"
                labelX={(pT1.x + pT3.x) / 2}
                labelY={dxGuideY + DIM_PADDING}
                dominantBaseline="hanging"
            />
            <line
                x1={pT1.x}
                y1={dy * 2}
                x2={pT1.x}
                y2={dxGuideY + DIM_EXTENSION}
                className="docs-diagram-guide-dashed"
            />
            <line
                x1={pT3.x}
                y1={dy}
                x2={pT3.x}
                y2={dxGuideY + DIM_EXTENSION}
                className="docs-diagram-guide-dashed"
            />

            {/* dx/2, further below - label centered, below arrow line */}
            <DimLine
                x1={pT1.x}
                y1={halfGuideY}
                x2={p0.x}
                y2={halfGuideY}
                arrowId={arrowId}
                label="dx/2 = (Pt·√3)/2"
                labelX={pT1.x / 2}
                labelY={halfGuideY - DIM_PADDING}
            />
            <line
                x1={p0.x}
                y1={dxGuideY}
                x2={p0.x}
                y2={halfGuideY}
                className="docs-diagram-guide-dashed"
            />

            {/* Tubes, drawn first so the triangle outline and angle arc paint on top */}
            {[pT1, pT2, pT3].map((t, idx) => (
                <circle key={idx} cx={t.x} cy={t.y} r={TUBE_R} className="docs-diagram-tube" />
            ))}
            <text
                x={pT1.x}
                y={pT1.y - TUBE_R - PADDING}
                className="docs-diagram-tube-label"
                fontSize={FONT}
            >
                Tube
            </text>

            {/* Angle arc + label at apex (60°) */}
            <path
                d={`M ${arcEnd.x} ${arcEnd.y} A ${arcR} ${arcR} 0 ${largeArcFlag} 1 ${arcEnd2.x} ${arcEnd2.y}`}
                className="docs-diagram-arc"
            />
            <text
                x={angleLabelX}
                y={angleLabelY}
                className="docs-diagram-label docs-diagram-label-angle"
                fontSize={FONT}
                textAnchor="middle"
                dominantBaseline="central"
            >
                60°
            </text>
        </svg>
    );
}

export function LayoutPatternDiagram({ layout }: LayoutPatternDiagramProps) {
    if (layout === 90) return <SquareDiagram90 />;
    if (layout === 45) return <DiamondDiagram45 />;
    if (layout === 30) return <TriangleDiagram30 />;
    if (layout === 60) return <TriangleDiagram60 />;
}
