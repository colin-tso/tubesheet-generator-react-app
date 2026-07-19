/* eslint-disable no-restricted-globals */
import { TubeSheet } from "../plugins/tubesheet-layout-generator";
self.onmessage = (event) => {
    var _a, _b, _c, _d, _e;
    const { type, requestId, payload } = event.data;
    try {
        if (type === "CALCULATE_ALL") {
            const { OTLtoShell, tubeOD, pitchRatio, minTubes } = payload;
            const _30 = new TubeSheet(OTLtoShell, tubeOD, pitchRatio, 30, minTubes);
            const _45 = new TubeSheet(OTLtoShell, tubeOD, pitchRatio, 45, minTubes);
            const _60 = new TubeSheet(OTLtoShell, tubeOD, pitchRatio, 60, minTubes);
            const _90 = new TubeSheet(OTLtoShell, tubeOD, pitchRatio, 90, minTubes);
            const radial = new TubeSheet(OTLtoShell, tubeOD, pitchRatio, "radial", minTubes);
            const minID = Math.min((_a = _30.minID) !== null && _a !== void 0 ? _a : Infinity, (_b = _45.minID) !== null && _b !== void 0 ? _b : Infinity, (_c = _60.minID) !== null && _c !== void 0 ? _c : Infinity, (_d = _90.minID) !== null && _d !== void 0 ? _d : Infinity, (_e = radial.minID) !== null && _e !== void 0 ? _e : Infinity);
            const markPreferred = (ts, preferred) => ({
                minID: ts.minID,
                numTubes: ts.numTubes,
                OTL: ts.OTL,
                tubeField: ts.tubeField,
                layout: ts.layout,
                tubeOD: ts.tubeOD,
                pitchRatio: ts.pitchRatio,
                shellID: ts.shellID,
                preferred,
            });
            // Package data to send back (Workers cannot send class instances or DOM nodes)
            self.postMessage({
                type: "ALL_RESULTS",
                requestId,
                payload: {
                    30: markPreferred(_30, _30.minID === minID),
                    45: markPreferred(_45, _45.minID === minID),
                    60: markPreferred(_60, _60.minID === minID),
                    90: markPreferred(_90, _90.minID === minID),
                    radial: markPreferred(radial, radial.minID === minID),
                },
            });
        }
        if (type === "CALCULATE_SINGLE") {
            const { OTLtoShell, tubeOD, pitchRatio, layoutOption, minTubes, shellID } = payload;
            const generated = new TubeSheet(OTLtoShell, tubeOD, pitchRatio, layoutOption, minTubes, shellID);
            self.postMessage({
                type: "SINGLE_RESULT",
                requestId,
                payload: {
                    minID: generated.minID,
                    numTubes: generated.numTubes,
                    OTL: generated.OTL,
                    tubeField: generated.tubeField,
                    layout: generated.layout,
                    tubeOD: generated.tubeOD,
                    pitchRatio: generated.pitchRatio,
                    shellID: generated.shellID,
                },
            });
        }
    }
    catch (error) {
        // Echo back source request/channel to main thread.
        self.postMessage({
            type: "ERROR",
            requestId,
            requestType: type,
            payload: error.message,
        });
    }
};
