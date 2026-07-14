/* eslint-disable no-restricted-globals */
import { TubeSheet } from "../plugins/tubesheet-layout-generator";

self.onmessage = (event: MessageEvent) => {
    const { type, payload } = event.data;

    try {
        if (type === "CALCULATE_ALL") {
            const { OTLtoShell, tubeOD, pitchRatio, minTubes } = payload;

            const _30 = new TubeSheet(OTLtoShell, tubeOD, pitchRatio, 30, minTubes);
            const _45 = new TubeSheet(OTLtoShell, tubeOD, pitchRatio, 45, minTubes);
            const _60 = new TubeSheet(OTLtoShell, tubeOD, pitchRatio, 60, minTubes);
            const _90 = new TubeSheet(OTLtoShell, tubeOD, pitchRatio, 90, minTubes);
            const radial = new TubeSheet(OTLtoShell, tubeOD, pitchRatio, "radial", minTubes);

            const minID = Math.min(
                _30.minID ?? Infinity,
                _45.minID ?? Infinity,
                _60.minID ?? Infinity,
                _90.minID ?? Infinity,
                radial.minID ?? Infinity,
            );

            const markPreferred = (ts: TubeSheet, preferred: boolean) => ({
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
            const generated = new TubeSheet(
                OTLtoShell,
                tubeOD,
                pitchRatio,
                layoutOption,
                minTubes,
                shellID,
            );

            self.postMessage({
                type: "SINGLE_RESULT",
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
    } catch (error) {
        self.postMessage({ type: "ERROR", payload: (error as Error).message });
    }
};

export {};
