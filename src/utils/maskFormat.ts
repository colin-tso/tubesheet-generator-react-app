// Single source of truth for the numeric mask formatting used by
// NumericField's IMaskInput, so anything that needs to display a number the
// same way the input itself would (e.g. the live-preview placeholder in
// PairedFieldRow) can derive it from these instead of re-guessing the format
// via toLocaleString/locale conventions.
export const MASK_RADIX = ".";
export const MASK_THOUSANDS_SEPARATOR = ",";

/** Formats a plain number the way a NumericField's IMaskInput would display
 * it, given the same radix/thousandsSeparator and a field's own `scale` —
 * digit-grouping only, no locale-dependent behavior. */
export function formatMaskedNumber(value: number, scale: number): string {
    const fixed = value.toFixed(Math.max(scale, 0));
    const negative = fixed.startsWith("-");
    const unsigned = negative ? fixed.slice(1) : fixed;
    const [intPart, fracPart] = unsigned.split(".");
    const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, MASK_THOUSANDS_SEPARATOR);
    const sign = negative ? "-" : "";
    return fracPart !== undefined
        ? `${sign}${withThousands}${MASK_RADIX}${fracPart}`
        : `${sign}${withThousands}`;
}
