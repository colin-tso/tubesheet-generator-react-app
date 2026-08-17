const NUM_TUBES = 10;
const RADIUS = 150;
const TUBE_R = 24;

export function RadialDiagram() {
    const angleIncrement = (2 * Math.PI) / NUM_TUBES;

    const tubes = Array.from({ length: NUM_TUBES }, (_, i) => {
        const angle = angleIncrement * i - Math.PI / 2;
        return { x: RADIUS * Math.cos(angle), y: RADIUS * Math.sin(angle) };
    });

    const p0 = tubes[0];
    const p1 = tubes[1];
    const arcR = 56;
    const arcStart = { x: arcR * Math.cos(-Math.PI / 2), y: arcR * Math.sin(-Math.PI / 2) };
    const a1 = -Math.PI / 2 + angleIncrement;
    const arcEnd = { x: arcR * Math.cos(a1), y: arcR * Math.sin(a1) };

    const pad = TUBE_R + 48;
    const viewBox = `${-RADIUS - pad} ${-RADIUS - pad} ${(RADIUS + pad) * 2} ${(RADIUS + pad) * 2}`;

    return (
        <svg
            viewBox={viewBox}
            className="docs-diagram-svg"
            role="img"
            aria-label="Radial layout: tubes evenly spaced on a single ring, showing the ring diameter and angle increment."
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
                        stroke-width="2"
                    />
                </marker>
            </defs>
            <circle
                cx={0}
                cy={0}
                r={RADIUS}
                className="docs-diagram-guide-dashed docs-diagram-ring"
                fill="none"
            />
            <circle cx={0} cy={0} r={4} className="docs-diagram-tube-highlight" />

            <line x1={0} y1={0} x2={p0.x} y2={p0.y} className="docs-diagram-guide-dashed" />
            <line x1={0} y1={0} x2={p1.x} y2={p1.y} className="docs-diagram-guide-dashed" />

            <path
                d={`M ${arcStart.x} ${arcStart.y} A ${arcR} ${arcR} 0 0 1 ${arcEnd.x} ${arcEnd.y}`}
                className="docs-diagram-arc"
            />
            <text
                x={arcR * 1.65 * Math.cos(-Math.PI / 2 + angleIncrement / 2)}
                y={arcR * 1.65 * Math.sin(-Math.PI / 2 + angleIncrement / 2)}
                className="docs-diagram-label docs-diagram-label-angle"
                textAnchor="middle"
            >
                2π / n
            </text>

            {tubes.map((t, idx) => (
                <circle
                    key={idx}
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
        </svg>
    );
}
