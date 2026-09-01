import {
    TubeSheet,
    TUBE_SHEET_LAYOUTS,
    findDiscreteSweepPoints,
    type TubeSheetLayout,
} from "@/plugins/tubesheet-layout-generator";

// The radial layout is stored as the number 0 by the UI radio inputs, but the
// plugin only knows the string "radial". Normalise here so a stray 0 (an
// invalid layout) can never reach the plugin, where it would be treated as an
// unknown layout and hang.
const normalizeLayoutOption = (layoutOption: unknown): TubeSheetLayout =>
    layoutOption === 0 ? "radial" : (layoutOption as TubeSheetLayout);

self.onmessage = (event: MessageEvent) => {
    const { type, requestId, payload } = event.data;

    try {
        if (
            type !== "CALCULATE_ALL" &&
            type !== "CALCULATE_SINGLE" &&
            type !== "CALCULATE_SWEEP"
        ) {
            throw new Error(`Unknown message type: ${type}`);
        }

        if (type === "CALCULATE_ALL") {
            const { OTLtoShell, tubeOD, pitchRatio, minTubes, shellID } = payload;

            const tubeSheets = Object.fromEntries(
                TUBE_SHEET_LAYOUTS.map((layout) => [
                    layout,
                    new TubeSheet(OTLtoShell, tubeOD, pitchRatio, layout, minTubes, shellID),
                ]),
            ) as Record<TubeSheetLayout, TubeSheet>;

            // Preferred layout: max tubes when shellID is pinned, else min shell ID.
            const isShellIDPinned = shellID !== undefined && shellID !== null;

            const bestValue = isShellIDPinned
                ? Math.max(...TUBE_SHEET_LAYOUTS.map((l) => tubeSheets[l].numTubes ?? -Infinity))
                : Math.min(...TUBE_SHEET_LAYOUTS.map((l) => tubeSheets[l].minID ?? Infinity));

            const isPreferred = (ts: TubeSheet) =>
                isShellIDPinned ? ts.numTubes === bestValue : ts.minID === bestValue;
            const markPreferred = (ts: TubeSheet) => ({
                minID: ts.minID,
                numTubes: ts.numTubes,
                OTL: ts.OTL,
                tubeField: ts.tubeField,
                layout: ts.layout,
                tubeOD: ts.tubeOD,
                pitchRatio: ts.pitchRatio,
                shellID: ts.shellID,
                preferred: isPreferred(ts),
            });

            // Package data to send back (Workers cannot send class instances or DOM nodes)
            self.postMessage({
                type: "ALL_RESULTS",
                requestId,
                payload: Object.fromEntries(
                    TUBE_SHEET_LAYOUTS.map((l) => [l, markPreferred(tubeSheets[l])]),
                ),
            });
        }

        if (type === "CALCULATE_SINGLE") {
            const { OTLtoShell, tubeOD, pitchRatio, layoutOption, minTubes, shellID } = payload;
            const normalizedLayout = normalizeLayoutOption(layoutOption);
            if (!TUBE_SHEET_LAYOUTS.includes(normalizedLayout)) {
                throw new Error(`Invalid layout option: ${String(layoutOption)}`);
            }
            const generated = new TubeSheet(
                OTLtoShell,
                tubeOD,
                pitchRatio,
                normalizedLayout,
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

        if (type === "CALCULATE_SWEEP") {
            const { OTLtoShell, tubeOD, pitchRatio, layoutOption, currentNumTubes, centerShellID } = payload;
            const normalizedLayout = normalizeLayoutOption(layoutOption);
            if (!TUBE_SHEET_LAYOUTS.includes(normalizedLayout)) {
                throw new Error(`Invalid layout option: ${String(layoutOption)}`);
            }
            if (typeof currentNumTubes !== "number" || typeof centerShellID !== "number") {
                throw new Error("currentNumTubes and centerShellID must be numbers");
            }

            const points = findDiscreteSweepPoints(
                    centerShellID,
                    OTLtoShell,
                    tubeOD,
                    pitchRatio,
                    normalizedLayout,
                );

            self.postMessage({
                type: "SWEEP_RESULTS",
                requestId,
                payload: points,
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
