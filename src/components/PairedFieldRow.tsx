import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, SubmitEvent, SyntheticEvent } from "react";
import { NumericField } from "./NumericField";
import { formatMaskedNumber } from "../utils/maskFormat";
import type { NumericFieldConfig } from "../constants/numericFieldConfigs";
import { useLivePreview } from "../hooks/useLivePreview";
import type { SingleResultPayload } from "../hooks/useTubeSheetWorker";
import { utils } from "../utils";

interface CommittedSizeResult {
    minID: number | null;
    numTubes: number | null;
}

interface PairedFieldRowProps {
    row: NumericFieldConfig[];
    fieldValues: Record<string, number | undefined>;
    layoutOption: number | undefined;
    committedResult?: CommittedSizeResult | null;
    isCalculating: boolean;
    onBlur: (e: SyntheticEvent<HTMLInputElement>) => void;
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
    onAcceptEmpty: (value: string, name: string) => void;
    inputOnSubmitHandler: (e: SubmitEvent<HTMLInputElement>) => void;
    requestSingle: (
        payload: Record<string, unknown>,
        callback: (payload: SingleResultPayload) => void,
        isPreview?: boolean,
    ) => number;
}

const PREVIEW_DEBOUNCE_MS = 350;

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
    requestSingle,
}: PairedFieldRowProps) {
    const [rowTouched, setRowTouched] = useState(false);
    const [previewTargetId, setPreviewTargetId] = useState<string | undefined>(undefined);

    const rowFieldIds = useMemo(() => row.map((cfg) => cfg.id), [row]);
    const isSizeRow = rowFieldIds.includes("minTubes") && rowFieldIds.includes("shellID");

    const livePreview = useLivePreview(requestSingle);
    const requestPreview = livePreview.request;
    const cancelPreview = livePreview.cancel;

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

    // Clear draft only when the user empties the field or invalidates it.
    const clearDraft = useCallback(() => {
        if (debounceRef.current !== null) {
            window.clearTimeout(debounceRef.current);
            debounceRef.current = null;
        }
        draftRef.current = null;
        setPreviewTargetId(undefined);
        cancelPreview(); // stop any pending worker
    }, [cancelPreview]);

    useEffect(() => clearDraft, [clearDraft]);

    const handleFieldBlur = useCallback(
        (e: SyntheticEvent<HTMLInputElement>) => {
            const related = (e.nativeEvent as FocusEvent).relatedTarget;
            const relatedId = related instanceof HTMLElement ? related.id : undefined;
            if (!relatedId || !rowFieldIds.includes(relatedId)) {
                setRowTouched(true);
            }
            // Do NOT clear draft or cancel preview on blur – keep showing last preview.
            if (debounceRef.current !== null) {
                window.clearTimeout(debounceRef.current);
                debounceRef.current = null;
            }
            latest.current.onBlur(e);
        },
        [rowFieldIds],
    );

    const handleFieldKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" || e.key === "NumpadEnter" || e.key === "Tab") {
            // Do NOT clear draft or cancel preview – keep showing last preview.
            if (debounceRef.current !== null) {
                window.clearTimeout(debounceRef.current);
                debounceRef.current = null;
            }
            latest.current.onKeyDown(e);
            return;
        }
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
                clearDraft(); // clear draft and preview when field is emptied
                return;
            }

            draftRef.current = { id: fieldId, value: parsed };
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
    const shellIDScale = row.find((cfg) => cfg.id === "shellID")?.scale ?? 2;
    const minTubesScale = row.find((cfg) => cfg.id === "minTubes")?.scale ?? 0;

    const fields = row.map((cfg, i) => {
        const isPreviewTarget = isSizeRow && cfg.id === previewTargetId;
        const minID = committedResult?.minID;
        const numTubesCommitted = committedResult?.numTubes;

        let placeholder = cfg.placeholder;

        // If we have a draft preview, show it (even after commit, until cleared).
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
            // No draft – fallback to committed result.
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
