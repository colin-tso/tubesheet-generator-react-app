import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { IMaskInput } from "react-imask";
import { utils } from "../utils";
export function NumericField({ id, label, placeholder, scale, inputMode, value, required = false, units, readOnly = false, calculated = false, onBlur, onKeyDown, onAccept, onSubmit, }) {
    return (_jsxs("div", { className: "field", children: [_jsxs("label", { className: "field-label", htmlFor: id, children: [label, required && _jsx("span", { className: "required-asterisk", children: "*" })] }), _jsxs("div", { className: "input-group", children: [_jsx(IMaskInput, { className: `value-input${calculated ? " calculated-field" : ""}`, id: id, name: id, readOnly: readOnly, type: "text", autoComplete: "off", placeholder: placeholder, mask: Number, scale: scale, min: 0, radix: ".", thousandsSeparator: ",", value: !utils.isNumber(value) ? "" : value.toString(), onBlur: onBlur, onKeyDown: onKeyDown, onAccept: onAccept, onChange: (_e) => { }, onSubmit: onSubmit, inputMode: inputMode, required: required }), units && _jsx("span", { className: "units", children: units })] })] }));
}
