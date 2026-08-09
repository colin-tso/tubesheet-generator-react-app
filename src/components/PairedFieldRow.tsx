import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, SubmitEvent, SyntheticEvent } from "react";
import { NumericField } from "./NumericField";
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

// Field id + value frozen when a live-preview field gains focus.
interface PinnedField {
    id: string;
    value: number;
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
    const [pinnedField, setPinnedField] = useState<PinnedField | null>(null);
    // Sync preview for clearance/pitch; the size row uses livePreview.result.
    const [syncPreview, setSyncPreview] = useState<number | undefined>(undefined);
    // True once the pinned field was actually typed into, not just focused.
    const pinDirtyRef = useRef(false);

    const rowFieldIds = useMemo(() => row.map((cfg) => cfg.id), [row]);
    const isSizeRow = rowFieldIds.includes("minTubes") && rowFieldIds.includes("shellID");
    const isClearancePitchRow =
        rowFieldIds.includes("tubeClearance") && rowFieldIds.includes("pitchRatio");
    // Only these two paired rows currently support a live preview.
    const hasLivePreview = isSizeRow || isClearancePitchRow;

    const livePreview = useLivePreview(requestSingle);
    const requestPreview = livePreview.request;
    const cancelPreview = livePreview.cancel;

    const latest = useRef({
        onBlur,
        onKeyDown,
        onAcceptEmpty,
        inputOnSubmitHandler,
        fieldValues,
        OTLToShell: fieldValues.OTLtoShell,
        tubeOD: fieldValues.tubeOD,
        pitchRatio: fieldValues.pitchRatio,
        layoutOption,
        pinnedFieldId: pinnedField?.id,
        previewByField: {} as Record<string, number | undefined>,
    });

    // Only clears on empty/invalid input, not on blur.
    const clearDraft = useCallback(() => {
        setPreviewTargetId(undefined);
        setPinnedField(null);
        setSyncPreview(undefined);
        pinDirtyRef.current = false;
        cancelPreview();
    }, [cancelPreview]);

    useEffect(() => clearDraft, [clearDraft]);

    // Current live-preview number for a field, if any.
    const previewNumberFor = useCallback(
        (fieldId: string): number | undefined => {
            if (!hasLivePreview || fieldId !== previewTargetId) return undefined;
            if (isSizeRow) {
                if (fieldId === "shellID") {
                    if (utils.isNumber(livePreview.result?.shellID))
                        return livePreview.result.shellID;
                    if (
                        utils.isNumber(fieldValues.minTubes) &&
                        utils.isNumber(committedResult?.minID)
                    ) {
                        return committedResult.minID;
                    }
                } else if (fieldId === "minTubes") {
                    if (utils.isNumber(livePreview.result?.numTubes))
                        return livePreview.result.numTubes;
                    if (
                        utils.isNumber(fieldValues.shellID) &&
                        utils.isNumber(committedResult?.numTubes)
                    ) {
                        return committedResult.numTubes;
                    }
                }
                return undefined;
            }
            return syncPreview; // clearance/pitch
        },
        [
            hasLivePreview,
            isSizeRow,
            previewTargetId,
            livePreview.result,
            fieldValues.minTubes,
            fieldValues.shellID,
            committedResult,
            syncPreview,
        ],
    );

    // Snapshot latest previews/props into a ref so callbacks below stay
    // referentially stable across keystrokes (avoids breaking field memo).
    useEffect(() => {
        latest.current = {
            onBlur,
            onKeyDown,
            onAcceptEmpty,
            inputOnSubmitHandler,
            fieldValues,
            OTLToShell: fieldValues.OTLtoShell,
            tubeOD: fieldValues.tubeOD,
            pitchRatio: fieldValues.pitchRatio,
            layoutOption,
            pinnedFieldId: pinnedField?.id,
            previewByField: {
                [row[0].id]: previewNumberFor(row[0].id),
                [row[1].id]: previewNumberFor(row[1].id),
            },
        };
    });

    // Focusing a previewed field freezes its shown value for the edit session.
    const handleFieldFocus = useCallback(
        (e: SyntheticEvent<HTMLInputElement>) => {
            if (!hasLivePreview) return;
            const id = e.currentTarget.id;
            if (utils.isNumber(latest.current.fieldValues[id])) return; // already real
            const shown = latest.current.previewByField[id];
            if (!utils.isNumber(shown)) return; // nothing to pin
            pinDirtyRef.current = false;
            setPinnedField({ id, value: shown });
        },
        [hasLivePreview],
    );

    const handleFieldBlur = useCallback(
        (e: SyntheticEvent<HTMLInputElement>) => {
            const related = (e.nativeEvent as FocusEvent).relatedTarget;
            const relatedId = related instanceof HTMLElement ? related.id : undefined;
            if (!relatedId || !rowFieldIds.includes(relatedId)) {
                setRowTouched(true);
            }

            const id = e.currentTarget.id;
            if (id === latest.current.pinnedFieldId) {
                const wasEdited = pinDirtyRef.current;
                setPinnedField(null);
                pinDirtyRef.current = false;
                // Don't commit an untouched preview as if the user typed it.
                if (!wasEdited) return;
            }

            // Keep showing the last preview; don't clear on blur.
            latest.current.onBlur(e);
        },
        [rowFieldIds],
    );

    const handleFieldKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
        const id = e.currentTarget.id;
        const isCommitKey = e.key === "Enter" || e.key === "NumpadEnter" || e.key === "Tab";
        if (id === latest.current.pinnedFieldId && !pinDirtyRef.current && isCommitKey) {
            // Don't commit an untouched preview.
            if (e.key !== "Tab") e.preventDefault();
            return;
        }
        // Keep showing the last preview.
        latest.current.onKeyDown(e);
    }, []);

    const handleFieldSubmit = useCallback((e: SubmitEvent<HTMLInputElement>) => {
        latest.current.inputOnSubmitHandler(e);
    }, []);

    const handlePairFieldAccept = useCallback(
        (value: string, fieldId: string, isUserEdit: boolean) => {
            // sourceInfo.source distinguishes a real keystroke from a
            // programmatic value update (e.g. the paired field's preview).
            if (!isUserEdit) return;
            if (fieldId === latest.current.pinnedFieldId) {
                pinDirtyRef.current = true; // real edit, not just a shown preview
            }

            latest.current.onAcceptEmpty(value, fieldId);

            const parsed = Number(value);
            if (value.trim() === "" || Number.isNaN(parsed)) {
                clearDraft(); // field emptied
                return;
            }

            const otherId = row[0].id === fieldId ? row[1].id : row[0].id;
            setPreviewTargetId(otherId);

            if (isSizeRow) {
                const { OTLToShell, tubeOD, pitchRatio, layoutOption: lo } = latest.current;
                const geometryReady =
                    utils.isNumber(OTLToShell) &&
                    OTLToShell >= 0 &&
                    utils.isNumber(tubeOD) &&
                    tubeOD > 0 &&
                    utils.isNumber(pitchRatio) &&
                    pitchRatio >= 1;
                if (!geometryReady) return;

                // useLivePreview already debounces.
                requestPreview({
                    OTLtoShell: OTLToShell,
                    tubeOD,
                    pitchRatio,
                    layoutOption: utils.isNumber(lo) ? lo : 30,
                    minTubes: fieldId === "minTubes" ? parsed : undefined,
                    shellID: fieldId === "shellID" ? parsed : undefined,
                });
            } else if (isClearancePitchRow) {
                const preview =
                    fieldId === "tubeClearance"
                        ? utils.pitchRatioFromClearance(latest.current.tubeOD, parsed)
                        : utils.clearanceFromPitchRatio(latest.current.tubeOD, parsed);
                setSyncPreview(preview);
            }
        },
        [clearDraft, requestPreview, row, isSizeRow, isClearancePitchRow],
    );

    const acceptFieldA = useCallback(
        (value: string, isUserEdit: boolean) => handlePairFieldAccept(value, row[0].id, isUserEdit),
        [handlePairFieldAccept, row],
    );
    const acceptFieldB = useCallback(
        (value: string, isUserEdit: boolean) => handlePairFieldAccept(value, row[1].id, isUserEdit),
        [handlePairFieldAccept, row],
    );
    const acceptOther = useCallback(
        (value: string, fieldId: string) => latest.current.onAcceptEmpty(value, fieldId),
        [],
    );

    const rowHint = row.find((cfg) => cfg.rowHint)?.rowHint;

    // Shell ID's physical minimum is tubeOD + OTLtoShell; falls back to the
    // static "> 0" config until both are known.
    const shellIDMinReady =
        utils.isNumber(fieldValues.tubeOD) && utils.isNumber(fieldValues.OTLtoShell);
    const shellIDMin = shellIDMinReady
        ? utils.round((fieldValues.tubeOD as number) + (fieldValues.OTLtoShell as number), 2)
        : undefined;

    const fields = row.map((cfg, i) => {
        const isPinned = hasLivePreview && pinnedField?.id === cfg.id;
        let fieldValue = fieldValues[cfg.id];
        let isPreview = false;
        let placeholder = cfg.placeholder;
        const isShellIDField = cfg.id === "shellID";
        const fieldMin = isShellIDField && shellIDMinReady ? shellIDMin : cfg.min;
        // Inclusive: the computed minimum is itself achievable.
        const fieldMinExclusive = isShellIDField && shellIDMinReady ? false : cfg.minExclusive;

        if (hasLivePreview && fieldValue === undefined) {
            if (isPinned) {
                // Frozen at focus time; DOM (read on blur) holds the real typed value.
                fieldValue = pinnedField!.value;
                isPreview = true;
            } else {
                const preview = previewNumberFor(cfg.id);
                if (utils.isNumber(preview)) {
                    fieldValue = preview;
                    isPreview = true;
                } else if (
                    cfg.id === previewTargetId &&
                    isSizeRow &&
                    livePreview.status === "pending"
                ) {
                    placeholder = "…";
                }
            }
        } else if (hasLivePreview && cfg.id === previewTargetId) {
            // Committed but still the dependent side of the pair – stays muted
            // to show which field is driving vs. computed.
            isPreview = true;
        }

        return (
            <NumericField
                key={cfg.id}
                {...cfg}
                placeholder={placeholder}
                min={fieldMin}
                minExclusive={fieldMinExclusive}
                value={fieldValue}
                isPreview={isPreview}
                pairedValue={cfg.pairedWith ? fieldValues[cfg.pairedWith] : undefined}
                touched={rowTouched}
                hideAsterisk
                readOnly={cfg.calculated || isCalculating}
                onFocus={cfg.calculated ? undefined : handleFieldFocus}
                onBlur={cfg.calculated ? undefined : handleFieldBlur}
                onKeyDown={cfg.calculated ? undefined : handleFieldKeyDown}
                onAccept={
                    cfg.calculated
                        ? undefined
                        : hasLivePreview
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
