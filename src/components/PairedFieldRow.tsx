import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, SubmitEvent, SyntheticEvent } from "react";
import { NumericField } from "./NumericField";
import { formatMaskedNumber } from "../utils/maskFormat";
import type { NumericFieldConfig } from "../constants/numericFieldConfigs";
import { useLivePreview } from "../hooks/useLivePreview";
import { utils } from "../utils";

interface CommittedSizeResult {
    minID: number | null;
    numTubes: number | null;
}

interface PairedFieldRowProps {
    row: NumericFieldConfig[];
    fieldValues: Record<string, number | undefined>;
    layoutOption: number | undefined;
    /** The last real (committed, not speculative) single-layout calculation
     * result, if any — used as the min-tubes/shell-ID row's placeholder
     * fallback once there's no in-progress typed draft to preview instead.
     * Anthing that already causes the app to recalculate (committing the other
     * geometry fields, changing the selected layout option, etc.) naturally
     * keeps this current, so the placeholder does too. */
    committedResult?: CommittedSizeResult | null;
    isCalculating: boolean;
    onBlur: (e: SyntheticEvent<HTMLInputElement>) => void;
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
    onAcceptEmpty: (value: string, name: string) => void;
    inputOnSubmitHandler: (e: SubmitEvent<HTMLInputElement>) => void;
}

const PREVIEW_DEBOUNCE_MS = 350;

// Renders a pair of either/or fields (e.g. min tubes / shell ID) sharing a
// single "touched" state, instead of each field tracking its own — an error
// only appears once focus has left BOTH fields, not the moment either one is
// individually blurred. The pair's shared "required" asterisk lives on its
// parent card's title (see App.tsx), not in here.
//
// For the min-tubes/shell-ID row specifically, this also drives a live,
// worker-computed preview of the *other* field's resulting value as the user
// types (see useLivePreview for the debouncing/cancellation/cost-guard details
// there).
//
// IMPORTANT: react-imask's underlying input unconditionally re-applies its
// `value` prop on every re-render, even if that value hasn't changed — so if
// typing into one of these fields ever triggers a *synchronous* state update
// that reaches back down into the field being typed into, it wipes out whatever
// was just typed. Every handler below is therefore built to stay referentially
// stable (via useCallback + refs for the latest prop values) so NumericField's
// React.memo can actually skip re-rendering the active field when unrelated row
// state (e.g. the preview) changes.
export function PairedFieldRow({
    row,
    fieldValues,
    layoutOption,
    committedResult,
    isCalculating,
    onBlur,
    onKeyDown,
    onAcceptEmpty,
    inputOnSubmitHandler,
}: PairedFieldRowProps) {
    const [rowTouched, setRowTouched] = useState(false);
    const [previewTargetId, setPreviewTargetId] = useState<string | undefined>(undefined);

    const rowFieldIds = useMemo(() => row.map((cfg) => cfg.id), [row]);
    // Only the min-tubes/shell-ID row is expensive enough to warrant a
    // worker-backed preview — tube clearance/pitch ratio is a cheap, direct
    // formula the rest of the form already reflects instantly on commit.
    const isSizeRow = rowFieldIds.includes("minTubes") && rowFieldIds.includes("shellID");

    const livePreview = useLivePreview();
    const requestPreview = livePreview.request;
    const cancelPreview = livePreview.cancel;

    // Always-current values read from inside stable callbacks/timeouts, so
    // those callbacks never need to be recreated (and thus never force a
    // re-render of the field currently being typed into) just because a prop
    // from further up the tree changed identity.
    const latest = useRef({
        onBlur,
        onKeyDown,
        onAcceptEmpty,
        inputOnSubmitHandler,
        otlToShell: fieldValues.OTLtoShell,
        tubeOD: fieldValues.tubeOD,
        pitchRatio: fieldValues.pitchRatio,
        layoutOption,
    });
    useEffect(() => {
        latest.current = {
            onBlur,
            onKeyDown,
            onAcceptEmpty,
            inputOnSubmitHandler,
            otlToShell: fieldValues.OTLtoShell,
            tubeOD: fieldValues.tubeOD,
            pitchRatio: fieldValues.pitchRatio,
            layoutOption,
        };
    });

    const debounceRef = useRef<number | null>(null);
    const draftRef = useRef<{ id: string; value: number } | null>(null);
    // True once we've blurred with a pending/resolved draft and are waiting for
    // the real (committed) calculation to catch up to it.
    const awaitingCommitRef = useRef(false);
    const committedResultRef = useRef(committedResult);

    const clearDraft = useCallback(() => {
        if (debounceRef.current !== null) {
            window.clearTimeout(debounceRef.current);
            debounceRef.current = null;
        }
        draftRef.current = null;
        awaitingCommitRef.current = false;
        setPreviewTargetId(undefined);
        cancelPreview();
    }, [cancelPreview]);

    // Nothing to clean up beyond what cancelPreview/clearDraft already do on
    // their own — useLivePreview handles unmount teardown internally.
    useEffect(() => clearDraft, [clearDraft]);

    // Once the real, committed calculation actually changes (a new object
    // arrives from the worker — see useTubeSheetWorker), it's safe to drop the
    // temporary draft/preview bridge: the fallback render below will pick up
    // the now-current committedResult instead. Gated on awaitingCommitRef so an
    // unrelated commit elsewhere in the form (e.g. committing tube clearance)
    // doesn't interrupt an in-progress typing preview in this row.
    useEffect(() => {
        if (committedResult === committedResultRef.current) return;
        committedResultRef.current = committedResult;
        if (awaitingCommitRef.current) {
            clearDraft();
        }
    }, [committedResult, clearDraft]);

    const handleFieldBlur = useCallback(
        (e: SyntheticEvent<HTMLInputElement>) => {
            const related = (e.nativeEvent as FocusEvent).relatedTarget;
            const relatedId = related instanceof HTMLElement ? related.id : undefined;
            // Focus landed on the other field in this pair — still "within" the
            // row, so don't mark it touched yet. Anything else (another field,
            // a button, or nothing focusable at all) means the row was left.
            if (!relatedId || !rowFieldIds.includes(relatedId)) {
                setRowTouched(true);
            }
            // Don't clear the draft/preview here — the real committed result
            // won't be ready until the worker round-trip powering it finishes,
            // so dropping back to (still-stale) committedResult immediately
            // would flash the old value before the new one lands. Keep showing
            // the last preview as a bridge; the effect above clears it once
            // committedResult actually catches up. Just stop anything still
            // waiting to be *sent* — nothing new should kick off once the field
            // isn't being edited anymore.
            if (draftRef.current) {
                awaitingCommitRef.current = true;
            }
            if (debounceRef.current !== null) {
                window.clearTimeout(debounceRef.current);
                debounceRef.current = null;
            }
            latest.current.onBlur(e);
        },
        [rowFieldIds],
    );

    const handleFieldKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
        latest.current.onKeyDown(e);
    }, []);

    const handleFieldSubmit = useCallback((e: SubmitEvent<HTMLInputElement>) => {
        latest.current.inputOnSubmitHandler(e);
    }, []);

    const handleSizeFieldAccept = useCallback(
        (value: string, fieldId: string) => {
            latest.current.onAcceptEmpty(value, fieldId);

            const parsed = Number(value);
            if (value.trim() === "" || Number.isNaN(parsed)) {
                clearDraft();
                return;
            }

            draftRef.current = { id: fieldId, value: parsed };
            awaitingCommitRef.current = false; // actively drafting again, not waiting on a commit
            setPreviewTargetId(fieldId === "minTubes" ? "shellID" : "minTubes");

            if (debounceRef.current !== null) {
                window.clearTimeout(debounceRef.current);
            }
            debounceRef.current = window.setTimeout(() => {
                debounceRef.current = null;
                const draft = draftRef.current;
                if (!draft) return;

                const { otlToShell, tubeOD, pitchRatio, layoutOption: lo } = latest.current;
                const geometryReady =
                    utils.isNumber(otlToShell) &&
                    otlToShell >= 0 &&
                    utils.isNumber(tubeOD) &&
                    tubeOD > 0 &&
                    utils.isNumber(pitchRatio) &&
                    pitchRatio >= 1;
                if (!geometryReady) return;

                requestPreview({
                    OTLtoShell: otlToShell,
                    tubeOD,
                    pitchRatio,
                    layoutOption: utils.isNumber(lo) ? lo : 30,
                    minTubes: draft.id === "minTubes" ? draft.value : undefined,
                    shellID: draft.id === "shellID" ? draft.value : undefined,
                });
            }, PREVIEW_DEBOUNCE_MS);
        },
        [clearDraft, requestPreview],
    );

    // row.length is always exactly 2 for a mounted PairedFieldRow (App only
    // routes 2-field rows here), and `row` itself is a stable, module-level
    // config reference — so it's safe to bind one memoized handler per slot up
    // front rather than creating a fresh closure per field on every render.
    const acceptFieldA = useCallback(
        (value: string) => handleSizeFieldAccept(value, row[0].id),
        [handleSizeFieldAccept, row],
    );
    const acceptFieldB = useCallback(
        (value: string) => handleSizeFieldAccept(value, row[1].id),
        [handleSizeFieldAccept, row],
    );
    const acceptOther = useCallback(
        (value: string, fieldId: string) => latest.current.onAcceptEmpty(value, fieldId),
        [],
    );

    const rowHint = row.find((cfg) => cfg.rowHint)?.rowHint;
    // Each field's own configured `scale` (decimal places), so preview text
    // matches whatever precision that field's mask is actually set to show
    // rather than assuming/hardcoding a value here.
    const shellIDScale = row.find((cfg) => cfg.id === "shellID")?.scale ?? 2;
    const minTubesScale = row.find((cfg) => cfg.id === "minTubes")?.scale ?? 0;

    const fields = row.map((cfg, i) => {
        const isPreviewTarget = isSizeRow && cfg.id === previewTargetId;
        const minID = committedResult?.minID;
        const numTubesCommitted = committedResult?.numTubes;

        let placeholder = cfg.placeholder;
        if (isPreviewTarget && livePreview.status === "pending") {
            placeholder = "…";
        } else if (isPreviewTarget && livePreview.status === "ready" && livePreview.result) {
            const previewValue =
                cfg.id === "shellID"
                    ? utils.isNumber(livePreview.result.shellID)
                        ? formatMaskedNumber(livePreview.result.shellID, shellIDScale)
                        : undefined
                    : utils.isNumber(livePreview.result.numTubes)
                      ? formatMaskedNumber(livePreview.result.numTubes, minTubesScale)
                      : undefined;
            if (previewValue) placeholder = previewValue;
        } else if (isSizeRow) {
            // Nothing actively being typed (or the draft preview isn't
            // available) — show the last real calculation instead, so the hint
            // doesn't disappear the moment you commit, and stays current as
            // other inputs change (geometry commits and layout option changes
            // already refresh `committedResult` through the normal calculation
            // flow, so this needs no separate trigger).
            if (
                cfg.id === "shellID" &&
                utils.isNumber(fieldValues.minTubes) &&
                utils.isNumber(minID)
            ) {
                placeholder = formatMaskedNumber(minID, shellIDScale);
            } else if (
                cfg.id === "minTubes" &&
                utils.isNumber(fieldValues.shellID) &&
                utils.isNumber(numTubesCommitted)
            ) {
                placeholder = formatMaskedNumber(numTubesCommitted, minTubesScale);
            }
        }

        return (
            <NumericField
                key={cfg.id}
                {...cfg}
                placeholder={placeholder}
                value={fieldValues[cfg.id]}
                pairedValue={cfg.pairedWith ? fieldValues[cfg.pairedWith] : undefined}
                touched={rowTouched}
                hideAsterisk
                readOnly={cfg.calculated || isCalculating}
                onBlur={cfg.calculated ? undefined : handleFieldBlur}
                onKeyDown={cfg.calculated ? undefined : handleFieldKeyDown}
                onAccept={
                    cfg.calculated
                        ? undefined
                        : isSizeRow
                          ? i === 0
                              ? acceptFieldA
                              : acceptFieldB
                          : (value: string) => acceptOther(value, cfg.id)
                }
                onSubmit={cfg.calculated ? undefined : handleFieldSubmit}
            />
        );
    });

    return (
        <div className="field-row-group">
            <div className="field-row">
                {fields[0]}
                <span className="field-row-or">or</span>
                {fields[1]}
            </div>
            {rowHint && <p className="field-row-hint">{rowHint}</p>}
        </div>
    );
}
