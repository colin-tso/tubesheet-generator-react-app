import { TubeSheet } from "../plugins/tubesheet-layout-generator";

self.onmessage = (event: MessageEvent) => {
    const { type, requestId, payload } = event.data;

    try {
        if (type !== "CALCULATE_ALL" && type !== "CALCULATE_SINGLE") {
            throw new Error(`Unknown message type: ${type}`);
        }

        if (type === "CALCULATE_ALL") {
            const { OTLtoShell, tubeOD, pitchRatio, minTubes, shellID } = payload;

            const _30 = new TubeSheet(OTLtoShell, tubeOD, pitchRatio, 30, minTubes, shellID);
            const _45 = new TubeSheet(OTLtoShell, tubeOD, pitchRatio, 45, minTubes, shellID);
            const _60 = new TubeSheet(OTLtoShell, tubeOD, pitchRatio, 60, minTubes, shellID);
            const _90 = new TubeSheet(OTLtoShell, tubeOD, pitchRatio, 90, minTubes, shellID);
            const radial = new TubeSheet(
                OTLtoShell,
                tubeOD,
                pitchRatio,
                "radial",
                minTubes,
                shellID,
            );

            // Preferred layout: max tubes when shellID is pinned, else min shell ID.
            const isShellIDPinned = shellID !== undefined && shellID !== null;

            const bestValue = isShellIDPinned
                ? Math.max(
                      _30.numTubes ?? -Infinity,
                      _45.numTubes ?? -Infinity,
                      _60.numTubes ?? -Infinity,
                      _90.numTubes ?? -Infinity,
                      radial.numTubes ?? -Infinity,
                  )
                : Math.min(
                      _30.minID ?? Infinity,
                      _45.minID ?? Infinity,
                      _60.minID ?? Infinity,
                      _90.minID ?? Infinity,
                      radial.minID ?? Infinity,
                  );

            const isPreferred = (ts: TubeSheet) =>
                isShellIDPinned ? ts.numTubes === bestValue : ts.minID === bestValue;

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
                requestId,
                payload: {
                    30: markPreferred(_30, isPreferred(_30)),
                    45: markPreferred(_45, isPreferred(_45)),
                    60: markPreferred(_60, isPreferred(_60)),
                    90: markPreferred(_90, isPreferred(_90)),
                    radial: markPreferred(radial, isPreferred(radial)),
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
    } catch (error) {
        // Echo back source request/channel to main thread.
        self.postMessage({
            type: "ERROR",
            requestId,
            requestType: type,
            payload: (error as Error).message,
        });
    }
};

export {};
