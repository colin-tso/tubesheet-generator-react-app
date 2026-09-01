import { useCallback, useEffect, useRef, useState } from "react";
import { utils } from "@/utils/";
import { useShellSweep } from "@/hooks/useShellSweep";
import type { SweepCallback } from "@/hooks/useTubeSheetWorker";

interface ShellSweepPanelProps {
    OTLtoShell: number | undefined;
    tubeOD: number | undefined;
    pitchRatio: number | undefined;
    layoutOption: number | undefined;
    layoutInputsDefined: boolean;
    layoutOptionSelected: boolean;
    centerShellID: number | undefined;
    currentNumTubes: number | undefined;
    requestSweep: (payload: Record<string, unknown>, callback: SweepCallback) => number;
    onApplyShellID: (shellID: number) => void;
}

export function ShellSweepPanel({
    OTLtoShell,
    tubeOD,
    pitchRatio,
    layoutOption,
    layoutInputsDefined,
    layoutOptionSelected,
    centerShellID,
    currentNumTubes,
    requestSweep,
    onApplyShellID,
}: ShellSweepPanelProps) {
    const { points, status, showLoading, request } = useShellSweep(requestSweep);
    const mountedRef = useRef(false);
    const [expanded, setExpanded] = useState(false);

    const canSweep =
        layoutInputsDefined &&
        layoutOptionSelected &&
        utils.isNumber(OTLtoShell) &&
        utils.isNumber(tubeOD) &&
        utils.isNumber(pitchRatio) &&
        utils.isNumber(layoutOption) &&
        utils.isNumber(centerShellID) &&
        utils.isNumber(currentNumTubes) &&
        centerShellID > 0;

    const runSweep = useCallback(() => {
        if (!canSweep) return;
        request({
            OTLtoShell: OTLtoShell as number,
            tubeOD: tubeOD as number,
            pitchRatio: pitchRatio as number,
            layoutOption: layoutOption as number,
            currentNumTubes: currentNumTubes as number,
            centerShellID: centerShellID as number,
        });
    }, [
        canSweep,
        OTLtoShell,
        tubeOD,
        pitchRatio,
        layoutOption,
        currentNumTubes,
        centerShellID,
        request,
    ]);

    // Track the center values used for the most recent sweep so we can
    // detect staleness when the user re-expands the panel.
    const lastSweepCenterRef = useRef({ centerShellID, currentNumTubes });

    const onSweepClick = () => {
        if (points && points.length > 0) {
            const wasExpanded = expanded;
            setExpanded((prev) => !prev);
            // If expanding and center values changed while collapsed, re-run.
            if (!wasExpanded) {
                const stale =
                    lastSweepCenterRef.current.centerShellID !== centerShellID ||
                    lastSweepCenterRef.current.currentNumTubes !== currentNumTubes;
                if (stale) {
                    lastSweepCenterRef.current = { centerShellID, currentNumTubes };
                    runSweep();
                }
            }
            return;
        }
        setExpanded(true);
        lastSweepCenterRef.current = { centerShellID, currentNumTubes };
        runSweep();
    };

    // Auto-update sweep when center values change after the first manual sweep.
    // Only triggers when the panel is expanded AND centerShellID/currentNumTubes
    // change — these are downstream of layoutOption and update after the worker
    // recalculation completes, avoiding the race where the sweep fires with
    // stale center values from the previous layout.
    const prevCenterRef = useRef({ centerShellID, currentNumTubes });

    useEffect(() => {
        if (!mountedRef.current) {
            mountedRef.current = true;
            return;
        }
        if (!expanded) return;

        const prev = prevCenterRef.current;
        const changed =
            prev.centerShellID !== centerShellID || prev.currentNumTubes !== currentNumTubes;
        if (!changed) return;
        prevCenterRef.current = { centerShellID, currentNumTubes };
        lastSweepCenterRef.current = { centerShellID, currentNumTubes };

        if (status === "ready" || status === "unavailable") {
            runSweep();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [expanded, centerShellID, currentNumTubes]);

    const maxTubes = points ? Math.max(...points.map((p) => p.numTubes), 1) : 1;

    const hasResults = points && points.length > 0;
    const buttonLabel = showLoading
        ? "Comparing…"
        : hasResults
          ? expanded
              ? "Hide comparison"
              : "Show comparison"
          : "Compare shell sizes";

    return (
        <div className="section">
            <div className="field-group-card">
                <h3 className="field-group-title">Shell size comparison</h3>
                <div className="sweep-actions">
                    <button
                        type="button"
                        className="sweep-button"
                        onClick={onSweepClick}
                        disabled={!canSweep || showLoading}
                    >
                        {buttonLabel}
                    </button>
                    {status === "unavailable" && (
                        <span className="sweep-status error">Couldn't compute the sweep.</span>
                    )}
                    {!canSweep && status === "idle" && (
                        <span className="sweep-status">
                            Generate a drawing first to set the comparison range.
                        </span>
                    )}
                </div>
                {expanded && hasResults && (
                    <div className="layout-list sweep-list" aria-label="Shell size comparison">
                        <div className="layout-list-header sweep-header" aria-hidden="true">
                            <span className="header-minid">ID (mm)</span>
                            <span />
                            <span className="header-tubes">Tubes</span>
                        </div>
                        {points.map((point) => (
                            <button
                                type="button"
                                key={point.shellID}
                                className={`layout-row sweep-row${point.shellID === centerShellID ? " current" : ""}`}
                                onClick={() => onApplyShellID(point.minID)}
                                disabled={showLoading}
                                aria-label={`Use shell ID ${utils.numFormat3SigFigs(point.minID)} mm, ${utils.numFormat3SigFigs(point.numTubes)} tubes`}
                                title={`Use shell ID ${utils.numFormat3SigFigs(point.minID)} mm`}
                            >
                                <span className="row-angle noselect">
                                    {utils.numFormat3SigFigs(point.minID)}
                                </span>
                                <span className="row-bar-track" aria-hidden="true">
                                    <span
                                        className="row-bar-fill"
                                        style={{
                                            width: `${(point.numTubes / maxTubes) * 100}%`,
                                        }}
                                    />
                                </span>
                                <span className="row-stats noselect">
                                    <span className="row-tubes">
                                        {utils.numFormat3SigFigs(point.numTubes)}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
