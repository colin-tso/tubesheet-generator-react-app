const SHELL_R = 168;
const OTL_R = 100;
const TUBE_R = 40;

// Radial layout: 3 tube centres evenly spaced on a single ring inside the
// OTL circle.
const NUM_TUBES = 3;
const TUBE_RING_R = OTL_R - TUBE_R;

export function ShellOTLDiagram() {
    const angleIncrement = (2 * Math.PI) / NUM_TUBES;
    // Start at 90° (bottom) rather than the top, so no tube sits on the
    // horizontal OTL-clearance dimension line.
    const startAngle = Math.PI / 2;
    const tubes = Array.from({ length: NUM_TUBES }, (_, i) => {
        const angle = startAngle + angleIncrement * i;
        return { x: TUBE_RING_R * Math.cos(angle), y: TUBE_RING_R * Math.sin(angle) };
    });
    const OTLLabelPosition = {
        x: OTL_R * Math.cos((135 * Math.PI) / 180),
        y: OTL_R * Math.sin((135 * Math.PI) / 180),
    };

    const pad = 46;
    const viewBox = `${-SHELL_R - pad} ${-SHELL_R - pad} ${(SHELL_R + pad) * 2} ${(SHELL_R + pad) * 2}`;

    const gapY = 0;

    return (
        <svg
            viewBox={viewBox}
            className="docs-diagram-svg"
            role="img"
            aria-label="Shell ID circle, OTL clearance gap, and OTL circle, with three tube centres in a radial layout placed inside the OTL."
        >
            <defs>
                <marker
                    id="arrow-shell"
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

            <circle cx={0} cy={0} r={SHELL_R} className="docs-diagram-shell-circle" fill="none" />
            <circle cx={0} cy={0} r={OTL_R} className="docs-diagram-otl-circle" fill="none" />

            <line
                x1={gapY}
                x2={gapY}
                y1={-OTL_R}
                y2={-SHELL_R}
                className="docs-diagram-guide"
                markerStart="url(#arrow-shell)"
                markerEnd="url(#arrow-shell)"
            />
            <polyline
                points={`${gapY},${(-OTL_R - SHELL_R) / 2} ${gapY + 45},${(-OTL_R - SHELL_R) / 2 - 45} ${gapY + 45 + 10},${(-OTL_R - SHELL_R) / 2 - 45}`}
                className="docs-diagram-guide"
            />
            <text
                x={gapY + 45 + 10 + 5}
                y={(-OTL_R - SHELL_R) / 2 - 45}
                className="docs-diagram-label"
                dominantBaseline="central"
            >
                OTL clearance / 2
            </text>

            <polyline
                points={`${OTLLabelPosition.x},${OTLLabelPosition.y} ${OTLLabelPosition.x - 15},${OTLLabelPosition.y + 20}`}
                className="docs-diagram-guide"
            />
            <text
                x={OTLLabelPosition.x - 15 - 5 * Math.cos(Math.atan2(20, 15))}
                y={OTLLabelPosition.y + 20 + 5 * Math.sin(Math.atan2(20, 15))}
                className="docs-diagram-label"
                textAnchor="end"
                dominantBaseline="central"
            >
                OTL
            </text>

            {tubes.map((t, idx) => (
                <circle key={idx} cx={t.x} cy={t.y} r={TUBE_R} className="docs-diagram-tube" />
            ))}
        </svg>
    );
}
