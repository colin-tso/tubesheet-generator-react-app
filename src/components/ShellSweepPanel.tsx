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

// The sweep-relevant fields, bundled together so "did the inputs behind the
// current/last sweep change" can be answered with one comparison instead of
// tracking several individual refs.
interface SweepParams {
    OTLtoShell: number | undefined;
    tubeOD: number | undefined;
    pitchRatio: number | undefined;
    layoutOption: number | undefined;
    centerShellID: number | undefined;
    currentNumTubes: number | undefined;
}

const sameParams = (a: SweepParams, b: SweepParams): boolean =>
    a.OTLtoShell === b.OTLtoShell &&
    a.tubeOD === b.tubeOD &&
    a.pitchRatio === b.pitchRatio &&
    a.layoutOption === b.layoutOption &&
    a.centerShellID === b.centerShellID &&
    a.currentNumTubes === b.currentNumTubes;

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
    const { points, status, failureReason, showLoading, request, cancel } =
        useShellSweep(requestSweep);
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

    const currentParams: SweepParams = {
        OTLtoShell,
        tubeOD,
        pitchRatio,
        layoutOption,
        centerShellID,
        currentNumTubes,
    };

    // The params a sweep is in flight for, or was last shown for — the single
    // source of truth for "has anything the sweep depends on changed since",
    // used both to decide whether to auto-refresh a shown comparison and to
    // cancel an in-flight one that's no longer relevant.
    const sweptParamsRef = useRef<SweepParams>(currentParams);

    const runSweep = useCallback(() => {
        if (!canSweep) return;
        sweptParamsRef.current = currentParams;
        request({
            OTLtoShell: OTLtoShell as number,
            tubeOD: tubeOD as number,
            pitchRatio: pitchRatio as number,
            layoutOption: layoutOption as number,
            currentNumTubes: currentNumTubes as number,
            centerShellID: centerShellID as number,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const onSweepClick = () => {
        if (points && points.length > 0) {
            const wasExpanded = expanded;
            setExpanded((prev) => !prev);
            // If expanding and the inputs changed while collapsed, re-run.
            if (!wasExpanded && !sameParams(sweptParamsRef.current, currentParams)) {
                runSweep();
            }
            return;
        }
        setExpanded(true);
        runSweep();
    };

    // Auto-update sweep when center values change after the first manual sweep.
    // Only triggers when the panel is expanded AND centerShellID /
    // currentNumTubes change — these are downstream of layoutOption and update
    // after the worker recalculation completes, avoiding the race where the
    // sweep fires with stale center values from the previous layout.
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

        if (status === "ready" || status === "unavailable") {
            runSweep();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [expanded, centerShellID, currentNumTubes]);

    // Cancel an in-flight sweep as soon as any of its inputs drift out from
    // under it (e.g. the user edits tube OD, or a layout recalculation lands a
    // new centerShellID, while the request is still pending) — otherwise the
    // response eventually lands and renders a comparison for parameters the
    // form no longer reflects. The auto-refresh effect above only fires once a
    // sweep has resolved; this handles the case where it hasn't yet.
    useEffect(() => {
        if (status !== "pending") return;
        if (sameParams(sweptParamsRef.current, currentParams)) return;
        cancel();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        status,
        OTLtoShell,
        tubeOD,
        pitchRatio,
        layoutOption,
        centerShellID,
        currentNumTubes,
        cancel,
    ]);

    const maxTubes = points ? Math.max(...points.map((p) => p.numTubes), 1) : 1;

    const hasResults = points && points.length > 0;
    const buttonLabel = showLoading
        ? "Comparing…"
        : hasResults
          ? expanded
              ? "Hide comparison"
              : "Show comparison"
          : "Compare shell sizes";

    const failureMessage =
        failureReason === "timeout"
            ? "This is taking longer than expected — try again."
            : "Couldn't compute the sweep.";

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
                        <span className="sweep-status error">{failureMessage}</span>
                    )}
                    {!canSweep && status === "idle" && (
                        <span className="sweep-status">
                            Generate a drawing first to set the comparison range.
                        </span>
                    )}
                </div>
                {expanded && hasResults && (
                    <div className="layout-list-header sweep-header" aria-hidden="true">
                        <span />
                        <span className="header-minid">Min ID (mm)</span>
                        <span />
                        <span className="header-tubes">Tubes</span>
                    </div>
                )}
                {expanded && hasResults && (
                    <div
                        className="layout-list sweep-list"
                        role="radiogroup"
                        aria-label="Shell size comparison"
                    >
                        {points.map((point) => {
                            const inputId = `sweep-shell-${point.shellID}`;
                            return (
                                <label
                                    key={point.shellID}
                                    className="layout-row sweep-row"
                                    htmlFor={inputId}
                                    title={`Use shell ID ${utils.numFormat3SigFigs(point.minID)} mm`}
                                >
                                    <input
                                        type="radio"
                                        id={inputId}
                                        name="shellSweepOption"
                                        checked={point.shellID === centerShellID}
                                        onChange={() => onApplyShellID(point.minID)}
                                        disabled={showLoading}
                                        aria-label={`Use shell ID ${utils.numFormat3SigFigs(point.minID)} mm, ${utils.numFormat3SigFigs(point.numTubes)} tubes`}
                                    />
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
                                </label>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
