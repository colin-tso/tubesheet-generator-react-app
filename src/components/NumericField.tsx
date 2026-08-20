import { memo, useRef, useState } from "react";
import type { KeyboardEvent, SyntheticEvent, SubmitEvent, InputHTMLAttributes } from "react";
import { NumericFormat } from "react-number-format";
import { utils } from "@/utils";

export interface NumericFieldProps {
    id: string;
    label: string;
    placeholder: string;
    scale: number;
    inputMode: InputHTMLAttributes<HTMLInputElement>["inputMode"];
    value: number | undefined;
    required?: boolean;
    units?: string;
    readOnly?: boolean;
    calculated?: boolean;
    min?: number;
    minExclusive?: boolean;
    pairedValue?: number;
    pairedLabel?: string;
    touched?: boolean;
    hideAsterisk?: boolean;
    // True when "value" is a live preview, not yet user-committed. Suppresses
    // valid/error styling until the user overrides it for real.
    isPreview?: boolean;
    onFocus?: (e: SyntheticEvent<HTMLInputElement, Event>) => void;
    onBlur?: (e: SyntheticEvent<HTMLInputElement, Event>) => void;
    onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
    // Extra cleanup for a consumer with its own edit-session state (e.g. a
    // paired live-preview row). Called before the field's own Escape revert.
    onEscape?: (e: KeyboardEvent<HTMLInputElement>) => void;
    // "isUserEdit" is true for a real keystroke, false when react-number-format
    // re-fires onValueChange from a programmatic value change (e.g. a preview
    // updating), per its sourceInfo.source ("event" vs "prop").
    onAccept?: (value: string, isUserEdit: boolean) => void;
    onSubmit?: (e: SubmitEvent<HTMLInputElement>) => void;
}

function NumericFieldImpl({
    id,
    label,
    placeholder,
    scale,
    inputMode,
    value,
    required = false,
    units,
    readOnly = false,
    calculated = false,
    min,
    minExclusive = false,
    pairedValue,
    pairedLabel,
    touched: touchedProp,
    hideAsterisk = false,
    isPreview = false,
    onFocus,
    onBlur,
    onKeyDown,
    onEscape,
    onAccept,
    onSubmit,
}: NumericFieldProps) {
    // Errors only surface after the field is left, so a fresh form isn't shown
    // as invalid up front. Parent can override via "touched" (see
    // PairedFieldRow).
    const [internalTouched, setInternalTouched] = useState(false);
    const touched = touchedProp ?? internalTouched;

    // Bumped on Escape to force a remount: typing is uncontrolled (the "value"
    // prop intentionally doesn't change while a live preview is frozen), so
    // without a fresh mount the DOM text won't snap back on cancel.
    const [resetSeq, setResetSeq] = useState(0);
    // Suppresses the single blur that Escape triggers, since it fires before
    // the remount above applies and would otherwise commit the stale DOM text.
    const escapingRef = useRef(false);

    // A paired field can satisfy "required" on its own once it has a value.
    const missingRequired = !utils.isNumber(value) && required && !utils.isNumber(pairedValue);
    const outOfRange =
        utils.isNumber(value) && utils.isNumber(min) && (minExclusive ? value <= min : value < min);

    const errorMessage = (() => {
        // Preview values (dependent/pinned) aren't user-committed, so never
        // flag them.
        if (!touched || readOnly || isPreview) return undefined;
        if (missingRequired) {
            return pairedLabel ? `Required (or ${pairedLabel})` : "Required";
        }
        if (outOfRange) {
            return minExclusive ? `Must be greater than ${min}` : `Must be at least ${min}`;
        }
        return undefined;
    })();

    const hasError = Boolean(errorMessage);
    const errorId = `${id}-error`;

    // Valid/green state, independent of "touched". Previews don't count until
    // overridden.
    const isValid = !readOnly && !calculated && !isPreview && utils.isNumber(value) && !outOfRange;

    // Mirrors missingRequired for native HTML validation on submit.
    const domRequired = required && !utils.isNumber(pairedValue);

    const handleBlur = (e: SyntheticEvent<HTMLInputElement, Event>) => {
        if (escapingRef.current) {
            escapingRef.current = false; // this blur was Escape's, not a real commit
            return;
        }
        if (touchedProp === undefined) {
            setInternalTouched(true);
        }
        onBlur?.(e);
    };

    // Cancel the in-progress edit: any row-level cleanup first, then remount to
    // discard the typed DOM text, then leave edit mode.
    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Escape") {
            e.preventDefault();
            escapingRef.current = true;
            onEscape?.(e);
            setResetSeq((n) => n + 1);
            e.currentTarget.blur();
            return;
        }
        onKeyDown?.(e);
    };

    return (
        <div className="field">
            <label className="field-label" htmlFor={id}>
                {label}
                {required && !hideAsterisk ? <span className="required-asterisk">*</span> : null}
            </label>
            <div className="input-group">
                <NumericFormat
                    key={resetSeq}
                    className={`value-input${calculated ? " calculated-field" : ""}${
                        hasError ? " field-invalid" : ""
                    }${isValid ? " field-valid" : ""}${isPreview ? " field-preview" : ""}`}
                    id={id}
                    name={id}
                    readOnly={readOnly}
                    type="text"
                    autoComplete="off"
                    placeholder={placeholder}
                    decimalScale={scale}
                    allowNegative={false}
                    thousandSeparator=","
                    value={utils.isNumber(value) ? value : ""}
                    onFocus={onFocus}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    onValueChange={(values, sourceInfo) =>
                        onAccept?.(values.value, sourceInfo.source === "event")
                    }
                    onSubmit={onSubmit}
                    inputMode={inputMode}
                    required={domRequired}
                    aria-invalid={hasError}
                    aria-describedby={hasError ? errorId : undefined}
                />
                {units ? <span className="units">{units}</span> : null}
            </div>
            {hasError && (
                <p className="field-error" id={errorId} role="alert">
                    {errorMessage}
                </p>
            )}
        </div>
    );
}

// Memoized so unrelated re-renders don't reach the input mid-edit and disrupt
// typing.
export const NumericField = memo(NumericFieldImpl);
