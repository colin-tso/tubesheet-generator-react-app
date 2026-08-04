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
        OTLToShell: fieldValues.OTLtoShell,
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
            OTLToShell: fieldValues.OTLtoShell,
            tubeOD: fieldValues.tubeOD,
            pitchRatio: fieldValues.pitchRatio,
            layoutOption,
        };
    });

    // Clear draft only when the user empties the field or invalidates it.
    const clearDraft = useCallback(() => {
        setPreviewTargetId(undefined);
        cancelPreview(); // stop any pending worker request
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
            latest.current.onBlur(e);
        },
        [rowFieldIds],
    );

    const handleFieldKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
        // Do NOT clear draft or cancel preview – keep showing last preview.
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

            setPreviewTargetId(fieldId === "minTubes" ? "shellID" : "minTubes");

            const { OTLToShell, tubeOD, pitchRatio, layoutOption: lo } = latest.current;
            const geometryReady =
                utils.isNumber(OTLToShell) &&
                OTLToShell >= 0 &&
                utils.isNumber(tubeOD) &&
                tubeOD > 0 &&
                utils.isNumber(pitchRatio) &&
                pitchRatio >= 1;
            if (!geometryReady) return;

            // useLivePreview already debounces – no second layer needed here.
            requestPreview({
                OTLtoShell: OTLToShell,
                tubeOD,
                pitchRatio,
                layoutOption: utils.isNumber(lo) ? lo : 30,
                minTubes: fieldId === "minTubes" ? parsed : undefined,
                shellID: fieldId === "shellID" ? parsed : undefined,
            });
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

        if (isSizeRow) {
            // Last full calculation for the other field of the pair.
            let committedValue: string | undefined;
            if (
                cfg.id === "shellID" &&
                utils.isNumber(fieldValues.minTubes) &&
                utils.isNumber(minID)
            ) {
                committedValue = formatMaskedNumber(minID, shellIDScale);
            } else if (
                cfg.id === "minTubes" &&
                utils.isNumber(fieldValues.shellID) &&
                utils.isNumber(numTubesCommitted)
            ) {
                committedValue = formatMaskedNumber(numTubesCommitted, minTubesScale);
            }

            // Most recent completed preview; persists until cancelled.
            let previewValue: string | undefined;
            if (isPreviewTarget && livePreview.result) {
                previewValue =
                    cfg.id === "shellID"
                        ? utils.isNumber(livePreview.result.shellID)
                            ? formatMaskedNumber(livePreview.result.shellID, shellIDScale)
                            : undefined
                        : utils.isNumber(livePreview.result.numTubes)
                          ? formatMaskedNumber(livePreview.result.numTubes, minTubesScale)
                          : undefined;
            }

            // Prefer preview, then committed, then a loading placeholder.
            if (previewValue) {
                placeholder = previewValue;
            } else if (committedValue) {
                placeholder = committedValue;
            } else if (isPreviewTarget && livePreview.status === "pending") {
                placeholder = "…";
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
