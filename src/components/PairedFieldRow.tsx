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

// A pinned preview: the field id currently showing a live-preview number that
// the user has focused, plus the number it was frozen at when focus began.
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
    // Synchronously-derived preview (tubeClearance/pitchRatio). The size row
    // uses the async worker-backed livePreview.result instead.
    const [syncPreview, setSyncPreview] = useState<number | undefined>(undefined);
    // Whether the pinned field was actually edited (vs. just focused/blurred
    // without typing). Imperative so it can be read from stable callbacks.
    const pinDirtyRef = useRef(false);

    const rowFieldIds = useMemo(() => row.map((cfg) => cfg.id), [row]);
    const isSizeRow = rowFieldIds.includes("minTubes") && rowFieldIds.includes("shellID");
    const isClearancePitchRow =
        rowFieldIds.includes("tubeClearance") && rowFieldIds.includes("pitchRatio");
    // Both currently-paired rows support an editable live preview. A future
    // paired row without a preview strategy below just falls back to plain
    // paired-field behavior (no preview, no pinning).
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

    // Clear draft only when the user empties the field or invalidates it.
    const clearDraft = useCallback(() => {
        setPreviewTargetId(undefined);
        setPinnedField(null);
        setSyncPreview(undefined);
        pinDirtyRef.current = false;
        cancelPreview(); // stop any pending worker request (no-op if unused)
    }, [cancelPreview]);

    useEffect(() => clearDraft, [clearDraft]);

    // The number currently shown as a live preview for a given field, if any.
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
            return syncPreview; // clearance/pitch: derived synchronously on accept
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

    // Snapshot each field's current preview after every render. Read from
    // handleFieldFocus below via the ref (not as a useCallback dependency) so
    // that callback's identity stays stable across keystrokes – otherwise it
    // would break memo on the field currently being typed into as well, and an
    // unrelated re-render mid-edit could disrupt the mask's own state.
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

    // Entering a field that's showing a preview freezes that number as the
    // field's controlled value for the rest of the edit session, so the mask
    // isn't fought mid-edit by new preview results or previewTargetId flips.
    const handleFieldFocus = useCallback(
        (e: SyntheticEvent<HTMLInputElement>) => {
            if (!hasLivePreview) return;
            const id = e.currentTarget.id;
            if (utils.isNumber(latest.current.fieldValues[id])) return; // already real
            const shown = latest.current.previewByField[id];
            if (!utils.isNumber(shown)) return; // nothing shown yet to pin
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
                // Untouched preview: leaving without typing must not commit the
                // shown number as if the user had entered it.
                if (!wasEdited) return;
            }

            // Do NOT clear draft or cancel preview on blur – keep showing last
            // preview.
            latest.current.onBlur(e);
        },
        [rowFieldIds],
    );

    const handleFieldKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
        const id = e.currentTarget.id;
        const isCommitKey = e.key === "Enter" || e.key === "NumpadEnter" || e.key === "Tab";
        if (id === latest.current.pinnedFieldId && !pinDirtyRef.current && isCommitKey) {
            // Nothing typed yet – don't commit the untouched preview.
            if (e.key !== "Tab") e.preventDefault();
            return;
        }
        // Do NOT clear draft or cancel preview – keep showing last preview.
        latest.current.onKeyDown(e);
    }, []);

    const handleFieldSubmit = useCallback((e: SubmitEvent<HTMLInputElement>) => {
        latest.current.inputOnSubmitHandler(e);
    }, []);

    const handlePairFieldAccept = useCallback(
        (value: string, fieldId: string, isUserEdit: boolean) => {
            // react-number-format re-fires onValueChange whenever a field's
            // controlled "value" prop is updated even programmatically (e.g.
            // the OTHER field's preview just changed and re-rendered this one)
            // — sourceInfo.source distinguishes that from a real keystroke.
            if (!isUserEdit) return;
            if (fieldId === latest.current.pinnedFieldId) {
                pinDirtyRef.current = true; // a real edit, not just a shown preview
            }

            latest.current.onAcceptEmpty(value, fieldId);

            const parsed = Number(value);
            if (value.trim() === "" || Number.isNaN(parsed)) {
                clearDraft(); // clear draft and preview when field is emptied
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

                // useLivePreview already debounces – no extra debounce
                // required.
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

    const fields = row.map((cfg, i) => {
        const isPinned = hasLivePreview && pinnedField?.id === cfg.id;
        let fieldValue = fieldValues[cfg.id];
        let isPreview = false;
        let placeholder = cfg.placeholder;

        if (hasLivePreview && fieldValue === undefined) {
            if (isPinned) {
                // Frozen at focus time; the DOM (read on blur) holds whatever
                // the user actually types, independent of this prop.
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
            // Committed but still the dependent side of the pair (e.g. once
            // tubeClearance/pitchRatio mutually derive each other on blur, both
            // hold real numbers). Stays muted so the muted/valid contrast keeps
            // showing which field is driving the pair versus which one is
            // computed from it.
            isPreview = true;
        }

        return (
            <NumericField
                key={cfg.id}
                {...cfg}
                placeholder={placeholder}
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
