import { useState } from "react";
import type { KeyboardEvent, SubmitEvent, SyntheticEvent } from "react";
import { NumericField } from "./NumericField";
import type { NumericFieldConfig } from "../constants/numericFieldConfigs";

interface PairedFieldRowProps {
    row: NumericFieldConfig[];
    fieldValues: Record<string, number | undefined>;
    isCalculating: boolean;
    onBlur: (e: SyntheticEvent<HTMLInputElement>) => void;
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
    onAcceptEmpty: (value: string, name: string) => void;
    inputOnSubmitHandler: (e: SubmitEvent<HTMLInputElement>) => void;
}

// Renders a pair of either/or fields (e.g. min tubes / shell ID) sharing a
// single "touched" state, instead of each field tracking its own. This way a
// validation error only appears once focus has left BOTH inputs in the pair —
// tabbing from one straight into the other doesn't flash an error on the first,
// since the pair hasn't actually been left yet.
export function PairedFieldRow({
    row,
    fieldValues,
    isCalculating,
    onBlur,
    onKeyDown,
    onAcceptEmpty,
    inputOnSubmitHandler,
}: PairedFieldRowProps) {
    const [rowTouched, setRowTouched] = useState(false);
    const rowFieldIds = row.map((cfg) => cfg.id);

    const handleFieldBlur = (e: SyntheticEvent<HTMLInputElement>) => {
        const related = (e.nativeEvent as FocusEvent).relatedTarget;
        const relatedId = related instanceof HTMLElement ? related.id : undefined;
        // Focus landed on the other field in this pair — still "within" the
        // row, so don't mark it touched yet. Anything else (another field,
        // a button, or nothing focusable at all) means the row was left.
        if (!relatedId || !rowFieldIds.includes(relatedId)) {
            setRowTouched(true);
        }
        onBlur(e);
    };

    const fields = row.map((cfg) => (
        <NumericField
            key={cfg.id}
            {...cfg}
            value={fieldValues[cfg.id]}
            pairedValue={cfg.pairedWith ? fieldValues[cfg.pairedWith] : undefined}
            touched={rowTouched}
            readOnly={cfg.calculated || isCalculating}
            onBlur={cfg.calculated ? undefined : handleFieldBlur}
            onKeyDown={cfg.calculated ? undefined : onKeyDown}
            onAccept={cfg.calculated ? undefined : (value) => onAcceptEmpty(value, cfg.id)}
            onSubmit={cfg.calculated ? undefined : inputOnSubmitHandler}
        />
    ));

    const rowHint = row.find((cfg) => cfg.rowHint)?.rowHint;

    return (
        <div>
            <div className="field-row">
                {fields[0]}
                <span className="field-row-or">or</span>
                {fields[1]}
            </div>
            {rowHint && <p className="field-row-hint">{rowHint}</p>}
        </div>
    );
}
