import type {
    ChangeEvent,
    KeyboardEvent,
    SyntheticEvent,
    SubmitEvent,
    InputHTMLAttributes,
} from "react";
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
    onBlur,
    onKeyDown,
    onAccept,
    onSubmit,
}: NumericFieldProps) {
    return (
        <div className="field">
            <label className="field-label" htmlFor={id}>
                {label}
                {required && <span className="required-asterisk">*</span>}
            </label>
            <div className="input-group">
                <IMaskInput
                    className={`value-input${calculated ? " calculated-field" : ""}`}
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
                    onBlur={onBlur}
                    onKeyDown={onKeyDown}
                    onAccept={onAccept}
                    onChange={(_e: ChangeEvent<HTMLInputElement>) => {}}
                    onSubmit={onSubmit}
                    inputMode={inputMode}
                    required={required}
                />
                {units && <span className="units">{units}</span>}
            </div>
        </div>
    );
}
