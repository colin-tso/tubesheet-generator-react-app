import { fmtMm, niceLength, SCALE_BAR_MIN_PX } from "@/utils/dimensions";

const SEGMENTS = 5;

// Scale bar drawn as HTML so it can sit with the viewport controls instead of
// inside the drawing. `pxPerMm` is the drawing's current on-screen scale.
export function ScaleBar({ pxPerMm }: { pxPerMm: number }) {
    const mm = niceLength(SCALE_BAR_MIN_PX / pxPerMm);
    const width = mm * pxPerMm;
    return (
        <div
            className="viewport-scale-bar noselect"
            role="img"
            aria-label={`Scale bar, ${fmtMm(mm)} mm`}
        >
            <div className="scale-bar-labels" style={{ width }}>
                <span>0</span>
                <span>{fmtMm(mm)} mm</span>
            </div>
            <div className="scale-bar-line" style={{ width }}>
                {Array.from({ length: SEGMENTS + 1 }, (_, i) => (
                    <span
                        key={i}
                        className="scale-bar-tick"
                        style={{ left: `${(i * 100) / SEGMENTS}%` }}
                    />
                ))}
            </div>
        </div>
    );
}
