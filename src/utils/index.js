export const utils = {
    capitalize(x) {
        return String(x).charAt(0).toUpperCase() + String(x).slice(1);
    },
    numFormat3SigFigs(x) {
        if (x > 100) {
            return this.numberWithCommas(Math.ceil(x));
        }
        else {
            return this.numberWithCommas(parseFloat(x.toPrecision(3)));
        }
    },
    numberWithCommas(x) {
        return x.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
    },
    round(num, decimalPlaces = 0) {
        var p = Math.pow(10, decimalPlaces);
        var n = num * p * (1 + Number.EPSILON);
        return Math.round(n) / p;
    },
    trunc(num, decimalPlaces = 0) {
        var p = Math.pow(10, decimalPlaces);
        var n = num * p * (1 + Number.EPSILON);
        return Math.trunc(n) / p;
    },
    isNumber(x) {
        return ((typeof x === "number" && x - x === 0) ||
            (typeof x === "string" && Number.isFinite(+x.replace(",", "")) && x.trim() !== ""));
    },
    stringToNumber(x) {
        return parseFloat(x.replace(",", ""));
    },
    symlog(x, c = 1) {
        return Math.sign(x) * Math.log10(Math.abs(x) / c + 1);
    },
};
