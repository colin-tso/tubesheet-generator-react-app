const RING1_R = 130;
const RING2_R = 260;
const TUBE_R = 18;
const RING1_COUNT = 6;
const RING2_COUNT = 12;
const ARC_R = 56;

const angleFor = (count: number, i: number): number => i * ((2 * Math.PI) / count) - Math.PI / 2;

const ring = (radius: number, count: number) =>
    Array.from({ length: count }, (_, i) => {
        const angle = angleFor(count, i);
        return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
    });

export function RadialDiagram() {
    const ring1 = ring(RING1_R, RING1_COUNT);
    const ring2 = ring(RING2_R, RING2_COUNT);

    const p0 = ring1[0];
    const p1 = ring1[1];
    const angleIncrement = (2 * Math.PI) / RING1_COUNT;
    const arcStart = { x: ARC_R * Math.cos(-Math.PI / 2), y: ARC_R * Math.sin(-Math.PI / 2) };
    const arcEnd = {
        x: ARC_R * Math.cos(-Math.PI / 2 + angleIncrement),
        y: ARC_R * Math.sin(-Math.PI / 2 + angleIncrement),
    };

    const spacingMid = { x: 0, y: -(RING1_R + RING2_R) / 2 };
    const radiusMid = { x: 0, y: -RING1_R / 2 };

    const pad = TUBE_R + 48;
    const viewBox = `${-RING2_R - pad} ${-RING2_R - pad} ${(RING2_R + pad) * 2} ${(RING2_R + pad) * 2}`;

    return (
        <svg
            viewBox={viewBox}
            className="docs-diagram-svg"
            role="img"
            aria-label="Radial layout: concentric rings of tubes spaced one pitch apart, showing the ring capacity, the ring radius, the ring-to-ring pitch spacing, and the angle between neighbouring tubes."
        >
            <defs>
                <marker
                    id="arrow-radial"
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
            <defs>
                <marker
                    id="cross-radial"
                    viewBox="0 0 10 10"
                    refX="5"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                >
                    <path
                        d="M 0 0 L 10 10 M 10 0 L 0 10"
                        className="docs-diagram-crosshead"
                        strokeWidth={2}
                    />
                </marker>
            </defs>

            <circle
                cx={0}
                cy={0}
                r={RING1_R}
                className="docs-diagram-guide-dashed docs-diagram-ring"
                fill="none"
            />
            <circle
                cx={0}
                cy={0}
                r={RING2_R}
                className="docs-diagram-guide-dashed docs-diagram-ring"
                fill="none"
            />

            <circle cx={0} cy={0} r={TUBE_R} className="docs-diagram-tube-highlight" />

            <line x1={0} y1={0} x2={p0.x} y2={p0.y} className="docs-diagram-guide-dashed" />
            <line
                x1={0}
                y1={0}
                x2={ring2[2].x}
                y2={ring2[2].y}
                className="docs-diagram-guide-dashed"
            />

            <text
                x={radiusMid.x + 30}
                y={radiusMid.y}
                className="docs-diagram-label"
                dominantBaseline="central"
            >
                r
            </text>

            <path
                d={`M ${arcStart.x} ${arcStart.y} A ${ARC_R} ${ARC_R} 0 0 1 ${arcEnd.x} ${arcEnd.y}`}
                className="docs-diagram-arc"
            />
            <text
                x={ARC_R * 1.65 * Math.cos(-Math.PI / 2 + angleIncrement / 2)}
                y={ARC_R * 1.65 * Math.sin(-Math.PI / 2 + angleIncrement / 2)}
                className="docs-diagram-label docs-diagram-label-angle"
                textAnchor="middle"
            >
                2π / n
            </text>

            {ring1.map((t, idx) => (
                <circle
                    key={`r1-${idx}`}
                    cx={t.x}
                    cy={t.y}
                    r={TUBE_R}
                    className={
                        idx <= 1
                            ? "docs-diagram-tube docs-diagram-tube-highlight"
                            : "docs-diagram-tube"
                    }
                />
            ))}
            {ring2.map((t, idx) => (
                <circle
                    key={`r2-${idx}`}
                    cx={t.x}
                    cy={t.y}
                    r={TUBE_R}
                    className="docs-diagram-tube"
                />
            ))}

            <path
                d={`M ${p0.x} ${p0.y}
                    L ${p1.x}
                      ${p1.y}`}
                className="docs-diagram-guide"
                markerStart="url(#cross-radial)"
                markerEnd="url(#cross-radial)"
            />
            <polyline
                points={`${(p0.x + p1.x) / 2},
                         ${(p0.y + p1.y) / 2}
                         ${(p0.x + p1.x) / 2 + 30},
                         ${(p0.y + p1.y) / 2 - 30}`}
                className="docs-diagram-guide"
            />
            <text
                x={(p0.x + p1.x) / 2 + 30 + 5}
                y={(p0.y + p1.y) / 2 - 30 - 5}
                className="docs-diagram-label"
                dominantBaseline="central"
            >
                Pitch
            </text>

            <line
                x1={p0.x}
                y1={p0.y}
                x2={ring2[0].x}
                y2={ring2[0].y}
                className="docs-diagram-guide"
                markerStart="url(#cross-radial)"
                markerEnd="url(#cross-radial)"
            />
            <line
                x1={p0.x}
                y1={spacingMid.y}
                x2={spacingMid.x + 25}
                y2={spacingMid.y}
                className="docs-diagram-guide"
            />
            <text
                x={spacingMid.x + 30}
                y={spacingMid.y}
                className="docs-diagram-label"
                dominantBaseline="central"
                textAnchor="start"
            >
                Pitch
            </text>
        </svg>
    );
}
