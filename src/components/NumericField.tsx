import { memo, useState } from "react";
import type { KeyboardEvent, SyntheticEvent, SubmitEvent, InputHTMLAttributes } from "react";
import { NumericFormat } from "react-number-format";
import { utils } from "../utils";

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
    // True when "value" is a live-preview number shown for direct editing, not
    // yet an actual user-committed value. Suppresses the valid/green state
    // until the user overrides it for real.
    isPreview?: boolean;
    onFocus?: (e: SyntheticEvent<HTMLInputElement, Event>) => void;
    onBlur?: (e: SyntheticEvent<HTMLInputElement, Event>) => void;
    onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
    // "isUserEdit" is true for a real keystroke, and false when
    // react-number-format re-fires onValueChange because "value" was set
    // programmatically (e.g. a live preview updating) rather than typed by the
    // user — react-number-format reports this directly via sourceInfo.source
    // ("event" vs "prop"), instead of us having to infer it.
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
    onAccept,
    onSubmit,
}: NumericFieldProps) {
    // Errors only surface once the user has actually left the field, so a
    // freshly loaded/empty form isn't shown as invalid before they've typed
    // anything. A parent can take over this decision via the "touched" prop
    // (see PairedFieldRow). Otherwise it's tracked internally per-field.
    const [internalTouched, setInternalTouched] = useState(false);
    const touched = touchedProp ?? internalTouched;

    // A paired field (e.g. tube clearance / pitch ratio) can satisfy this
    // requirement on its own — don't flag this one as missing once the other
    // has a value.
    const missingRequired = !utils.isNumber(value) && required && !utils.isNumber(pairedValue);
    const outOfRange =
        utils.isNumber(value) && utils.isNumber(min) && (minExclusive ? value <= min : value < min);

    const errorMessage = (() => {
        if (!touched || readOnly) return undefined;
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

    // Positive feedback for a field that actually has a value and satisfies its
    // own constraints, independent of "touched". A displayed preview doesn't
    // count until the user actually overrides it.
    const isValid = !readOnly && !calculated && !isPreview && utils.isNumber(value) && !outOfRange;

    // Mirrors the error logic above for a paired field to satisft native HTML
    // validation triggered by the submit button
    const domRequired = required && !utils.isNumber(pairedValue);

    const handleBlur = (e: SyntheticEvent<HTMLInputElement, Event>) => {
        if (touchedProp === undefined) {
            setInternalTouched(true);
        }
        onBlur?.(e);
    };

    return (
        <div className="field">
            <label className="field-label" htmlFor={id}>
                {label}
                {required && !hideAsterisk && <span className="required-asterisk">*</span>}
            </label>
            <div className="input-group">
                <NumericFormat
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
                    onKeyDown={onKeyDown}
                    onValueChange={(values, sourceInfo) =>
                        onAccept?.(values.value, sourceInfo.source === "event")
                    }
                    onSubmit={onSubmit}
                    inputMode={inputMode}
                    required={domRequired}
                    aria-invalid={hasError}
                    aria-describedby={hasError ? errorId : undefined}
                />
                {units && <span className="units">{units}</span>}
            </div>
            {hasError && (
                <p className="field-error" id={errorId} role="alert">
                    {errorMessage}
                </p>
            )}
        </div>
    );
}

// react-number-format still re-runs formatting on every re-render reachable by
// the mask, so an unrelated re-render mid-edit could still disrupt typing. Memo
// means a re-render only reaches the input when one of this field's own props
// has actually changed.
export const NumericField = memo(NumericFieldImpl);
