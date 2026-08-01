import { memo, useState } from "react";
import type { KeyboardEvent, SyntheticEvent, SubmitEvent, InputHTMLAttributes } from "react";
import { IMaskInput } from "react-imask";
import { utils } from "../utils";
import { MASK_RADIX, MASK_THOUSANDS_SEPARATOR } from "../utils/maskFormat";

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
    onBlur?: (e: SyntheticEvent<HTMLInputElement, Event>) => void;
    onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
    onAccept?: (value: string) => void;
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
    // own constraints, independent of "touched".
    const isValid = !readOnly && !calculated && utils.isNumber(value) && !outOfRange;

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
                <IMaskInput
                    className={`value-input${calculated ? " calculated-field" : ""}${
                        hasError ? " field-invalid" : ""
                    }${isValid ? " field-valid" : ""}`}
                    id={id}
                    name={id}
                    readOnly={readOnly}
                    type="text"
                    autoComplete="off"
                    placeholder={placeholder}
                    mask={Number}
                    scale={scale}
                    min={0}
                    radix={MASK_RADIX}
                    thousandsSeparator={MASK_THOUSANDS_SEPARATOR}
                    value={!utils.isNumber(value) ? "" : value.toString()}
                    onBlur={handleBlur}
                    onKeyDown={onKeyDown}
                    onAccept={onAccept}
                    onChange={() => {}}
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

// react-imask's underlying component unconditionally re-applies its "value"
// prop on every update (not just when it actually changes), so if this field
// re-rendered on every keystroke elsewhere in the app for unrelated reasons, it
// would keep overriding whatever the user just typed. Memo means a re-render
// only reaches the mask when one of this field's own props has changed.
export const NumericField = memo(NumericFieldImpl);
