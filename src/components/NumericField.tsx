import { useState } from "react";
import type { KeyboardEvent, SyntheticEvent, SubmitEvent, InputHTMLAttributes } from "react";
import { IMaskInput } from "react-imask";
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
    /** Inclusive lower bound used for inline validation (ignored if unset). */
    min?: number;
    /** When true, `min` itself is not a valid value (i.e. value must be > min). */
    minExclusive?: boolean;
    /** Current value of a paired field that can satisfy `required` on its own
     * (e.g. tube clearance / pitch ratio, where only one is actually needed). */
    pairedValue?: number;
    /** Label of the paired field, used in the empty-state helper text. */
    pairedLabel?: string;
    onBlur?: (e: SyntheticEvent<HTMLInputElement, Event>) => void;
    onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
    onAccept?: (value: string) => void;
    onSubmit?: (e: SubmitEvent<HTMLInputElement>) => void;
}

export function NumericField({
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
    onBlur,
    onKeyDown,
    onAccept,
    onSubmit,
}: NumericFieldProps) {
    // Errors only surface once the user has actually left the field, so a
    // freshly loaded/empty form isn't shown as invalid before they've typed
    // anything.
    const [touched, setTouched] = useState(false);

    const errorMessage = (() => {
        if (!touched || readOnly) return undefined;
        if (!utils.isNumber(value)) {
            if (!required) return undefined;
            // A paired field (e.g. tube clearance / pitch ratio) can satisfy
            // this requirement on its own — don't flag this one as missing too
            // once the other has a value.
            if (utils.isNumber(pairedValue)) return undefined;
            return pairedLabel ? `Required (or ${pairedLabel})` : "Required";
        }
        if (utils.isNumber(min)) {
            const outOfRange = minExclusive ? value <= min : value < min;
            if (outOfRange) {
                return minExclusive ? `Must be greater than ${min}` : `Must be at least ${min}`;
            }
        }
        return undefined;
    })();

    const hasError = Boolean(errorMessage);
    const errorId = `${id}-error`;

    const handleBlur = (e: SyntheticEvent<HTMLInputElement, Event>) => {
        setTouched(true);
        onBlur?.(e);
    };

    return (
        <div className="field">
            <label className="field-label" htmlFor={id}>
                {label}
                {required && <span className="required-asterisk">*</span>}
            </label>
            <div className="input-group">
                <IMaskInput
                    className={`value-input${calculated ? " calculated-field" : ""}${
                        hasError ? " field-invalid" : ""
                    }`}
                    id={id}
                    name={id}
                    readOnly={readOnly}
                    type="text"
                    autoComplete="off"
                    placeholder={placeholder}
                    mask={Number}
                    scale={scale}
                    min={0}
                    radix="."
                    thousandsSeparator=","
                    value={!utils.isNumber(value) ? "" : value.toString()}
                    onBlur={handleBlur}
                    onKeyDown={onKeyDown}
                    onAccept={onAccept}
                    onChange={() => {}}
                    onSubmit={onSubmit}
                    inputMode={inputMode}
                    required={required}
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
