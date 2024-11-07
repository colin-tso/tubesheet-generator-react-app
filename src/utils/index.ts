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
        var p = Math.pow(10, decimalPlaces);
        var n = num * p * (1 + Number.EPSILON);
        return Math.round(n) / p;
    },
    trunc(num: number, decimalPlaces = 0) {
        var p = Math.pow(10, decimalPlaces);
        var n = num * p * (1 + Number.EPSILON);
        return Math.trunc(n) / p;
    },
};
