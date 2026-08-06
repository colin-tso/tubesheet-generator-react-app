export const utils = {
    capitalize(x: string) {
        return String(x).charAt(0).toUpperCase() + String(x).slice(1);
    },
    numFormat3SigFigs(x: number) {
        if (x > 100) {
            return this.numberWithCommas(Math.ceil(x));
        } else {
            return this.numberWithCommas(parseFloat((x as number).toPrecision(3)));
        }
    },
    numberWithCommas(x: number) {
        return x.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
    },
    round(num: number, decimalPlaces = 0) {
        const p = Math.pow(10, decimalPlaces);
        const n = num * p * (1 + Number.EPSILON);
        return Math.round(n) / p;
    },
    trunc(num: number, decimalPlaces = 0) {
        const p = Math.pow(10, decimalPlaces);
        const n = num * p * (1 + Number.EPSILON);
        return Math.trunc(n) / p;
    },
    isNumber(x: unknown): x is number {
        return (
            (typeof x === "number" && x - x === 0) ||
            (typeof x === "string" && Number.isFinite(+x.replace(",", "")) && x.trim() !== "")
        );
    },
    // Shared with the tubeClearance/pitchRatio paired-field preview so the
    // live-preview number and the committed value use the same formula.
    pitchRatioFromClearance(tubeOD: number | undefined, clearance: number): number | undefined {
        return this.isNumber(tubeOD) && tubeOD > 0 ? 1 + clearance / tubeOD : undefined;
    },
    clearanceFromPitchRatio(tubeOD: number | undefined, pitchRatio: number): number | undefined {
        return this.isNumber(tubeOD) ? (pitchRatio - 1) * tubeOD : undefined;
    },
    stringToNumber(x: string) {
        return parseFloat(x.replace(",", ""));
    },
    symlog(x: number, c: number = 1) {
        return Math.sign(x) * Math.log10(Math.abs(x) / c + 1);
    },
};
