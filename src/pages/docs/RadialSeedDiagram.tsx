// Illustrative pitch in local SVG units, matching the proportions of the other
// docs diagrams. The tubes are drawn as circles whose centre-to-centre spacing
// (the chord between neighbours) equals this pitch.
const PITCH = 180;
const TUBE_R = 47;
const PADDING = 22;
const LABEL_OFFSET = 14;
const TICK = 7;

const seedRadius = (count: number): number => PITCH / (2 * Math.sin(Math.PI / count));

interface RadialSeedDiagramProps {
    count: 2 | 3 | 4 | 5;
}

export function RadialSeedDiagram({ count }: RadialSeedDiagramProps) {
    const radius = seedRadius(count);
    const angleFor = (i: number): number => i * ((2 * Math.PI) / count) - Math.PI / 2;
    const points = Array.from({ length: count }, (_, i) => ({
        x: radius * Math.cos(angleFor(i)),
        y: radius * Math.sin(angleFor(i)),
    }));

    // Pitch dimension between the first two neighbouring tubes.
    const p0 = points[0];
    const p1 = points[1];
    const ux = (p1.x - p0.x) / PITCH;
    const uy = (p1.y - p0.y) / PITCH;

    // Place the "Pt" label just outside the chord, still inside the ring.
    const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    let nx = -uy;
    let ny = ux;
    if (nx * mid.x + ny * mid.y < 0) {
        nx = -nx;
        ny = -ny;
    }
    const labelX = mid.x + nx * LABEL_OFFSET;
    const labelY = mid.y + ny * LABEL_OFFSET;

    // Small crosshair at each end of the pitch line, marking the tube centres.
    const crossAt = (p: { x: number; y: number }): string =>
        `M ${p.x - ux * TICK} ${p.y - uy * TICK} L ${p.x + ux * TICK} ${p.y + uy * TICK}
         M ${p.x - nx * TICK} ${p.y - ny * TICK} L ${p.x + nx * TICK} ${p.y + ny * TICK}`;

    const pad = TUBE_R + PADDING;
    const viewBox = `${-radius - pad} ${-radius - pad} ${(radius + pad) * 2} ${(radius + pad) * 2}`;

    return (
        <svg
            viewBox={viewBox}
            className="docs-diagram-svg"
            role="img"
            aria-label={`Ring of ${count} tubes at the radius that keeps neighbouring tubes exactly one pitch apart, with the pitch dimension marked between two tube centres.`}
        >
            <circle
                cx={0}
                cy={0}
                r={radius}
                className="docs-diagram-guide-dashed docs-diagram-ring"
                fill="none"
            />
            <circle cx={0} cy={0} r={3.5} className="docs-diagram-tube-highlight" />

            {points.map((t, i) => (
                <circle key={i} cx={t.x} cy={t.y} r={TUBE_R} className="docs-diagram-tube" />
            ))}

            <path
                d={`M ${p0.x} ${p0.y} L ${p1.x} ${p1.y}`}
                className="docs-diagram-pitch-line"
                fill="none"
            />
            <path d={crossAt(p0)} className="docs-diagram-pitch-line" fill="none" />
            <path d={crossAt(p1)} className="docs-diagram-pitch-line" fill="none" />
            <text
                x={labelX}
                y={labelY}
                className="docs-diagram-label docs-diagram-label-pitch"
                textAnchor="middle"
                dominantBaseline="central"
            >
                Pt
            </text>
        </svg>
    );
}