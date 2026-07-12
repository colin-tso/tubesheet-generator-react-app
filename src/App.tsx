import React, { useCallback, useState, useEffect } from "react";
import GitHubButton from "react-github-btn";
import { IMaskInput } from "react-imask";
import {
    TubeSheet,
    generateTubeSheetSVG,
    ITubeSheetData,
} from "./plugins/tubesheet-layout-generator";
import { TubeSheetSVG } from "./components/TubeSheetSVG";
import { utils } from "./utils/";
import ThemeToggle from "./components/DarkmodeToggle";
import "./index.css";

// type TubeSheetWithPrefIndicator = TubeSheet & { preferred: boolean };
type LayoutResults = {
    30: (ITubeSheetData & { preferred: boolean }) | null;
    45: (ITubeSheetData & { preferred: boolean }) | null;
    60: (ITubeSheetData & { preferred: boolean }) | null;
    90: (ITubeSheetData & { preferred: boolean }) | null;
    radial: (ITubeSheetData & { preferred: boolean }) | null;
};

// const emptyTubeSheet = new TubeSheet(0, 100, 1, 30, undefined, 100);
const emptyData: ITubeSheetData = {
    tubeField: [],
    OTL: null,
    shellID: 100,
    minID: null,
    tubeOD: 1,
    pitchRatio: 30,
    layout: 30,
    numTubes: null,
};
const placeholderSVG = generateTubeSheetSVG(emptyData);

const downloadBlob = (blob: Blob | MediaSource, filename: string) => {
    const objectUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
};

// Clone svg with explicit pixel dimensions derived from its viewBox
// to render consistently outside web context for both SVG and PNG
// rasterisation below.
const sizedSvgString = (svg: SVGSVGElement, scale = 2) => {
    const viewBox = svg.getAttribute("viewBox");
    const parts = viewBox ? viewBox.split(" ").map(Number) : [0, 0, 300, 150];
    const vbWidth = parts[2] || 300;
    const vbHeight = parts[3] || 300;
    const width = Math.max(1, Math.round(vbWidth * scale));
    const height = Math.max(1, Math.round(vbHeight * scale));

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", `${width}`);
    clone.setAttribute("height", `${height}`);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    return { svgString: new XMLSerializer().serializeToString(clone), width, height };
};

// Rasterise SVG to a PNG blob.
const svgToPngBlob = (svg: SVGSVGElement, scale = 2): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const { svgString, width, height } = sizedSvgString(svg, scale);
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);

        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            URL.revokeObjectURL(url);
            if (!ctx) {
                reject(new Error("Canvas 2D context unavailable"));
                return;
            }
            ctx.drawImage(image, 0, 0, width, height);
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("Failed to encode PNG"));
                }
            }, "image/png");
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to load SVG for rasterisation"));
        };
        image.src = url;
    });
};

const App = () => {
    const [minTubes, setMinTubes] = useState<number | undefined>();
    const [tubeOD, setTubeOD] = useState<number | undefined>();
    const [OTLtoShell, setOTLtoShell] = useState<number | undefined>();
    const [tubeClearance, setTubeClearance] = useState<number | undefined>();
    const [pitchRatio, setPitchRatio] = useState<number | undefined>();
    const [shellID, setShellID] = useState<number | undefined>();
    const [actualTubes, setActualTubes] = useState<number | undefined>();
    const [layoutOption, setLayoutOption] = useState<number | undefined>();
    const [pitchUpdateFunc, setPitchUpdateFunc] = useState<string | undefined>();
    const [layoutResults, setLayoutResults] = useState<LayoutResults>({
        "30": null,
        "45": null,
        "60": null,
        "90": null,
        radial: null,
    });
    const [layoutInputsDefined, setLayoutInputsDefined] = useState<boolean>(false);
    const [drawingSVG, setDrawingSVG] = useState<SVGSVGElement>(placeholderSVG);
    const [copyState, setCopyState] = useState<"idle" | "copied" | "error" | "unsupported">("idle");
    const [showGrid, setShowGrid] = useState<boolean>(true);
    const [isCalculating, setIsCalculating] = useState<boolean>(false);
    // Created inside the effect (not via useMemo) so that each effect run owns
    // — and only ever terminates — its own Worker instance. React 18 StrictMode
    // intentionally runs every effect's mount -> cleanup -> mount once in dev;
    // if the Worker were memoized as a singleton outside the effect, that
    // cleanup would call .terminate() (irreversible) on the one-and-only
    // instance, leaving the second "mount" attached to an already-dead worker
    // that silently drops every postMessage from then on.
    const [workerInstance, setWorkerInstance] = useState<Worker | null>(null);

    const stateFuncs = {
        setMinTubes,
        setTubeOD,
        setOTLtoShell,
        setTubeClearance,
        setPitchRatio,
        setShellID,
        setActualTubes,
        setLayoutOption,
    };

    useEffect(() => {
        const w = new Worker(new URL("./workers/tubesheet.worker.ts", import.meta.url));

        w.onmessage = (event) => {
            const { type, payload } = event.data;

            if (type === "ALL_RESULTS") {
                setLayoutResults(payload);
                setIsCalculating(false);
            }

            if (type === "SINGLE_RESULT") {
                // Take the raw data payload and generate the SVG purely on the main thread.
                // isCalculating is intentionally NOT cleared here — TubeSheetSVG's
                // onRendered callback clears it once the new drawing has actually
                // been committed to the DOM, not merely once React has re-rendered.
                setDrawingSVG(generateTubeSheetSVG(payload));

                // If shellID was custom inputted, update actual tubes
                if (payload.shellID && payload.numTubes) {
                    setActualTubes(payload.numTubes);
                }
            }

            if (type === "ERROR") {
                console.error("Worker Error:", payload);
                setIsCalculating(false);
            }
        };

        setWorkerInstance(w);

        return () => {
            w.terminate();
        };
    }, []);

    // Stable identity so TubeSheetSVG's effect (keyed on this + src) only
    // re-runs when the drawing itself actually changes, not on every render.
    const onDrawingRendered = useCallback(() => setIsCalculating(false), []);

    // Helper to package and send calculation requests
    const triggerSingleCalculation = (overrides?: {
        overrideLayout?: number;
        OTLtoShell?: number;
        tubeOD?: number;
        pitchRatio?: number;
        minTubes?: number;
        shellID?: number;
    }) => {
        if (!workerInstance) return;

        const effOTLtoShell = overrides?.OTLtoShell ?? OTLtoShell;
        const effTubeOD = overrides?.tubeOD ?? tubeOD;
        const effPitchRatio = overrides?.pitchRatio ?? pitchRatio;
        const effMinTubes = overrides?.minTubes ?? minTubes;
        const effShellID = overrides?.shellID ?? shellID;
        const effLayoutOption = overrides?.overrideLayout ?? layoutOption;

        const parsedLayoutOption = effLayoutOption === 0 ? "radial" : effLayoutOption;

        setIsCalculating(true);
        workerInstance.postMessage({
            type: "CALCULATE_SINGLE",
            payload: {
                OTLtoShell: effOTLtoShell,
                tubeOD: effTubeOD,
                pitchRatio: effPitchRatio,
                layoutOption: parsedLayoutOption,
                minTubes: utils.isNumber(effShellID) && effShellID !== 0 ? undefined : effMinTubes,
                shellID: utils.isNumber(effShellID) && effShellID !== 0 ? effShellID : undefined,
            },
        });
    };

    const formOnSubmitHandler = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        // Fallback: If form submits, trigger a single calc request
        if (utils.isNumber(layoutOption) && layoutInputsDefined) {
            triggerSingleCalculation();
        }
    };

    const validateLayoutInputs = useCallback(() => {
        const valid =
            utils.isNumber(OTLtoShell) &&
            utils.isNumber(tubeOD) &&
            utils.isNumber(tubeClearance) &&
            utils.isNumber(pitchRatio) &&
            utils.isNumber(minTubes) &&
            OTLtoShell >= 0 &&
            tubeOD > 0 &&
            tubeClearance >= 0 &&
            pitchRatio >= 1 &&
            minTubes > 0;
        setLayoutInputsDefined(valid);
        console.log(`Layout calc inputs validated: ${valid}`);
    }, [OTLtoShell, minTubes, pitchRatio, tubeClearance, tubeOD]);

    const requestAllLayoutResults = useCallback(() => {
        if (!layoutInputsDefined || !workerInstance) return;

        setIsCalculating(true);
        workerInstance.postMessage({
            type: "CALCULATE_ALL",
            payload: { OTLtoShell, tubeOD, pitchRatio, minTubes },
        });
    }, [layoutInputsDefined, workerInstance, OTLtoShell, tubeOD, pitchRatio, minTubes]);

    // const calcLayoutResults = useCallback(() => {
    //     console.log("calculating layout results");

    //     if (!layoutInputsDefined) {
    //         return {
    //             30: null,
    //             45: null,
    //             60: null,
    //             90: null,
    //             radial: null,
    //         };
    //     }

    //     const _30 = new TubeSheet(OTLtoShell!, tubeOD!, pitchRatio!, 30, minTubes);
    //     const _45 = new TubeSheet(OTLtoShell!, tubeOD!, pitchRatio!, 45, minTubes);
    //     const _60 = new TubeSheet(OTLtoShell!, tubeOD!, pitchRatio!, 60, minTubes);
    //     const _90 = new TubeSheet(OTLtoShell!, tubeOD!, pitchRatio!, 90, minTubes);
    //     const radial = new TubeSheet(OTLtoShell!, tubeOD!, pitchRatio!, "radial", minTubes);

    //     const minID = Math.min(
    //         _30.minID ?? Infinity,
    //         _45.minID ?? Infinity,
    //         _60.minID ?? Infinity,
    //         _90.minID ?? Infinity,
    //         radial.minID ?? Infinity,
    //     );

    //     const markPreferred = (
    //         TubeSheet: TubeSheet,
    //         preferred: boolean,
    //     ): TubeSheetWithPrefIndicator =>
    //         Object.assign(TubeSheet, { preferred }) as TubeSheetWithPrefIndicator;

    //     return {
    //         30: markPreferred(_30, _30.minID === minID),
    //         45: markPreferred(_45, _45.minID === minID),
    //         60: markPreferred(_60, _60.minID === minID),
    //         90: markPreferred(_90, _90.minID === minID),
    //         radial: markPreferred(radial, radial.minID === minID),
    //     };
    // }, [layoutInputsDefined, OTLtoShell, tubeOD, pitchRatio, minTubes]);

    const callSetFunc = (name: string, value: string) => {
        if (!(name in stateFuncs)) {
            console.error(`Function ${name} not found.`);
            return;
        }

        const fn = stateFuncs[name as keyof typeof stateFuncs];

        if (!utils.isNumber(value)) {
            fn(undefined);
            return;
        } else {
            fn(utils.stringToNumber(value));
        }
    };

    const setPitchRatioFromTubeClearance = useCallback(
        (value: number) => {
            if (utils.isNumber(value) && utils.isNumber(tubeOD) && tubeOD > 0) {
                setPitchRatio(1 + value / tubeOD);
            }
        },
        [tubeOD],
    );

    const setTubeClearanceFromPitchRatio = useCallback(
        (value: number) => {
            if (utils.isNumber(value) && utils.isNumber(tubeOD)) {
                setTubeClearance((value - 1) * tubeOD);
            }
        },
        [tubeOD],
    );

    // Prevent react-imask's own commit logic for a Number mask with "min"
    // revert a field back to its last valid value once on loss of focus
    // before our onBlur handler runs. onAccept fires on every internal
    // value change including the moment the field becomes empty,
    // Use it to commit "empty" to state immediately. By the time blur
    // happens, the controlled value prop is already blank and there's
    // nothing left for IMask to revert to.
    const onAcceptEmpty = (value: string, name: string) => {
        if (value.trim() === "") {
            callSetFunc(`set${utils.capitalize(name)}`, "");
        }
    };

    const onBlur = (e: React.SyntheticEvent<HTMLInputElement>) => {
        const val = e.currentTarget.value.replace(",", ""),
            name = e.currentTarget.name;

        // An intentionally emptied field should stay empty rather than bounce
        // back to its last committed value (which happens if we bail out here
        // without ever telling React the field is now blank).
        if (val.trim() === "") {
            callSetFunc(`set${utils.capitalize(name)}`, val);
            return;
        }

        if (!utils.isNumber(val)) {
            return;
        }
        switch (name) {
            case "tubeClearance":
                if (!utils.isNumber(tubeClearance) || tubeClearance <= 0) {
                    callSetFunc(`set${utils.capitalize(name)}`, val);
                    setPitchUpdateFunc("setPitchRatioFromTubeClearance");
                    setPitchRatioFromTubeClearance(parseFloat(val));
                    break;
                }
                if (utils.trunc(tubeClearance, 2) !== utils.stringToNumber(val)) {
                    callSetFunc(`set${utils.capitalize(name)}`, val);
                    setPitchUpdateFunc("setPitchRatioFromTubeClearance");
                    break;
                }
                break;

            case "pitchRatio":
                if (!utils.isNumber(pitchRatio) || pitchRatio <= 0) {
                    callSetFunc(`set${utils.capitalize(name)}`, val);
                    setPitchUpdateFunc("setTubeClearanceFromPitchRatio");
                    setTubeClearanceFromPitchRatio(parseFloat(val));
                    break;
                }
                if (utils.trunc(pitchRatio, 2) !== utils.stringToNumber(val)) {
                    callSetFunc(`set${utils.capitalize(name)}`, val);
                    setPitchUpdateFunc("setTubeClearanceFromPitchRatio");
                    break;
                }
                break;
            default:
                callSetFunc(`set${utils.capitalize(name)}`, val);
        }
    };

    const inputOnSubmitHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
    };

    // Intercept Enter, stop the native submit, commit the value the
    // same way onBlur would, and then — if the inputs are now fully valid —
    // trigger the drawing calculation immediately.
    //
    // onBlur()'s setState calls are async, so OTLtoShell/tubeOD/etc. in this
    // closure still hold their *previous* render's values right after calling
    // it — calling triggerSingleCalculation() with no overrides here would
    // silently send the old, pre-edit values to the worker (the calculation
    // "completes", but visibly nothing changes until state catches up on the
    // NEXT keystroke). We build a same-tick snapshot of the six inputs and
    // pass it straight through as overrides instead of relying on state.
    // tubeClearance and pitchRatio are mutually derived, so whichever one
    // wasn't just typed is recomputed the same way the app already does.
    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== "Enter" && e.key !== "NumpadEnter" && e.key !== "Tab") {
            return;
        }

        if (e.key === "Enter" || e.key === "NumpadEnter") {
            e.preventDefault();
        }

        const name = e.currentTarget.name;
        const raw = e.currentTarget.value.replace(",", "");
        const committed = utils.isNumber(raw) ? utils.stringToNumber(raw) : undefined;

        onBlur(e);

        let nextPitchRatio = name === "pitchRatio" ? committed : pitchRatio;
        let nextTubeClearance = name === "tubeClearance" ? committed : tubeClearance;
        if (
            name === "tubeClearance" &&
            utils.isNumber(committed) &&
            utils.isNumber(tubeOD) &&
            tubeOD > 0
        ) {
            nextPitchRatio = 1 + committed / tubeOD;
        } else if (name === "pitchRatio" && utils.isNumber(committed) && utils.isNumber(tubeOD)) {
            nextTubeClearance = (committed - 1) * tubeOD;
        }

        const next = {
            minTubes: name === "minTubes" ? committed : minTubes,
            tubeOD: name === "tubeOD" ? committed : tubeOD,
            OTLtoShell: name === "OTLtoShell" ? committed : OTLtoShell,
            tubeClearance: nextTubeClearance,
            pitchRatio: nextPitchRatio,
            shellID: name === "shellID" ? committed : shellID,
        };

        const inputsValid =
            utils.isNumber(next.OTLtoShell) &&
            utils.isNumber(next.tubeOD) &&
            utils.isNumber(next.tubeClearance) &&
            utils.isNumber(next.pitchRatio) &&
            utils.isNumber(next.minTubes) &&
            next.OTLtoShell >= 0 &&
            next.tubeOD > 0 &&
            next.tubeClearance >= 0 &&
            next.pitchRatio >= 1 &&
            next.minTubes > 0;

        if (!inputsValid || !utils.isNumber(layoutOption)) {
            return;
        }

        triggerSingleCalculation({
            OTLtoShell: next.OTLtoShell,
            tubeOD: next.tubeOD,
            pitchRatio: next.pitchRatio,
            minTubes: next.minTubes,
            shellID: next.shellID,
        });
    };

    // Regenerate on layout option change and inputs are valid.
    const onLayoutOptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onBlur(e);

        const rawValue = e.currentTarget.value;
        const parsedValue = utils.isNumber(rawValue) ? utils.stringToNumber(rawValue) : undefined;

        if (!utils.isNumber(parsedValue) || !layoutInputsDefined) {
            return;
        }

        triggerSingleCalculation({ overrideLayout: parsedValue });
    };

    const downloadSVG = useCallback(() => {
        const blob = new Blob([drawingSVG.outerHTML], { type: "image/svg+xml" });
        downloadBlob(blob, "tubesheet.svg");
    }, [drawingSVG.outerHTML]);

    const copySVG = useCallback(() => {
        if (
            typeof navigator === "undefined" ||
            !navigator.clipboard ||
            typeof ClipboardItem === "undefined"
        ) {
            setCopyState("unsupported");
            return;
        }

        // navigator.clipboard.write() must be called synchronously within the
        // click's user-activation window, or Safari (and older Firefox) will
        // reject it — but the image data itself takes a moment to render.
        // Passing still-pending Promises as the ClipboardItem's values is the
        // supported way to bridge that gap; Chrome, Firefox 127+, and Safari
        // all honor it.
        const { svgString } = sizedSvgString(drawingSVG);
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const pngPromise = svgToPngBlob(drawingSVG);

        const onSuccess = () => {
            setCopyState("copied");
            setTimeout(() => setCopyState("idle"), 2000);
        };
        const onFailure = (err: unknown) => {
            console.error("Copy to clipboard failed:", err);
            setCopyState("error");
            setTimeout(() => setCopyState("idle"), 2500);
        };

        // SVG with PNG fallback.
        let writePromise: Promise<void>;
        try {
            writePromise = navigator.clipboard.write([
                new ClipboardItem({ "image/svg+xml": svgBlob, "image/png": pngPromise }),
            ]);
        } catch {
            writePromise = Promise.reject();
        }

        writePromise.then(onSuccess).catch(() =>
            navigator.clipboard
                .write([new ClipboardItem({ "image/png": pngPromise })])
                .then(onSuccess)
                .catch(onFailure),
        );
    }, [drawingSVG]);

    // Validation
    useEffect(() => {
        console.log("calling validateLayoutInputs");
        validateLayoutInputs();
    }, [validateLayoutInputs]);

    // Pitch calculation
    useEffect(() => {
        if (typeof pitchUpdateFunc !== "undefined") {
            let value = tubeClearance;
            switch (pitchUpdateFunc) {
                case "setPitchRatioFromTubeClearance":
                    value = tubeClearance;
                    if (utils.isNumber(value)) {
                        console.log("setting pitch ratio from tube clearance");
                        setPitchRatioFromTubeClearance(value);
                    }
                    break;
                case "setTubeClearanceFromPitchRatio":
                    value = pitchRatio;
                    if (utils.isNumber(value)) {
                        console.log("setting tube clearance from pitch ratio");
                        setTubeClearanceFromPitchRatio(value);
                    }
                    break;
            }
            console.log("calling requestAllLayoutResults");
            if (layoutInputsDefined) {
                requestAllLayoutResults();
            }
        }
    }, [
        tubeClearance,
        pitchRatio,
        tubeOD,
        pitchUpdateFunc,
        layoutInputsDefined,
        setPitchRatioFromTubeClearance,
        setTubeClearanceFromPitchRatio,
        requestAllLayoutResults,
    ]);

    // Actual tubes calculation (only when layout option is selected and shell ID is defined)
    useEffect(() => {
        if (!utils.isNumber(layoutOption)) {
            console.log("Layout option not yet selected.");
            return;
        }

        let selectedLayout: TubeSheet | null = null;

        const parsedLayoutOption = (
            layoutOption === 0 ? "radial" : layoutOption
        ) as TubeSheet["layout"];

        if (utils.isNumber(shellID) && shellID > 0) {
            selectedLayout = layoutInputsDefined
                ? new TubeSheet(
                      OTLtoShell!,
                      tubeOD!,
                      pitchRatio!,
                      parsedLayoutOption,
                      undefined,
                      shellID,
                  )
                : null;
        }

        if (selectedLayout && selectedLayout.numTubes) {
            setActualTubes(selectedLayout.numTubes);
        }
    }, [OTLtoShell, layoutInputsDefined, layoutOption, pitchRatio, shellID, tubeOD]);

    // Force refresh when actual tubes are calculated
    useEffect(() => {}, [actualTubes]);

    // JSX return
    return (
        <div className="row-pane">
            <form
                className={`column-pane left${showGrid ? "" : " grid-hidden"}`}
                onSubmit={formOnSubmitHandler}
            >
                <div className="title-block">
                    <div>
                        <span className="eyebrow">Calculator & Visualiser for</span>
                        <h1>
                            Tubesheet Layouts
                            <small>by Colin Tso</small>
                        </h1>
                    </div>
                    <ThemeToggle />
                </div>
                <hr />
                <div className="form-scroll">
                    <div className="section">
                        <h2>Calculation Inputs</h2>
                        <div className="field">
                            <label className="field-label" htmlFor="minTubes">
                                Minimum number of tubes
                                <span className="required-asterisk">*</span>
                            </label>
                            <div className="input-group">
                                <IMaskInput
                                    className="value-input"
                                    id="minTubes"
                                    name="minTubes"
                                    type="text"
                                    autoComplete="off"
                                    placeholder="e.g. 100"
                                    mask={Number}
                                    scale={0}
                                    min={0}
                                    radix="."
                                    thousandsSeparator=","
                                    value={!utils.isNumber(minTubes) ? "" : minTubes.toString()}
                                    onBlur={onBlur}
                                    onKeyDown={onKeyDown}
                                    onAccept={(value: string) => onAcceptEmpty(value, "minTubes")}
                                    onChange={(e) => {}}
                                    onSubmit={inputOnSubmitHandler}
                                    inputMode="numeric"
                                    required
                                />
                            </div>
                        </div>

                        <div className="field">
                            <label className="field-label" htmlFor="tubeOD">
                                Tube OD
                                <span className="required-asterisk">*</span>
                            </label>
                            <div className="input-group">
                                <IMaskInput
                                    className="value-input"
                                    id="tubeOD"
                                    name="tubeOD"
                                    type="text"
                                    autoComplete="off"
                                    placeholder="> 0"
                                    mask={Number}
                                    scale={2}
                                    min={0}
                                    radix={"."}
                                    thousandsSeparator=","
                                    value={!utils.isNumber(tubeOD) ? "" : tubeOD.toString()}
                                    onBlur={onBlur}
                                    onKeyDown={onKeyDown}
                                    onAccept={(value: string) => onAcceptEmpty(value, "tubeOD")}
                                    onChange={(e) => {}}
                                    onSubmit={inputOnSubmitHandler}
                                    inputMode="decimal"
                                    required
                                />
                                <span className="units">mm</span>
                            </div>
                        </div>

                        <div className="field">
                            <label className="field-label" htmlFor="OTLtoShell">
                                OTL to shell diametrical clearance
                                <span className="required-asterisk">*</span>
                            </label>
                            <div className="input-group">
                                <IMaskInput
                                    className="value-input"
                                    id="OTLtoShell"
                                    name="OTLtoShell"
                                    type="text"
                                    autoComplete="off"
                                    placeholder="Shell ID – OTL, ≥ 0"
                                    mask={Number}
                                    scale={2}
                                    min={0}
                                    radix={"."}
                                    thousandsSeparator=","
                                    onBlur={onBlur}
                                    onKeyDown={onKeyDown}
                                    onAccept={(value: string) => onAcceptEmpty(value, "OTLtoShell")}
                                    onChange={(e) => {}}
                                    onSubmit={inputOnSubmitHandler}
                                    value={!utils.isNumber(OTLtoShell) ? "" : OTLtoShell.toString()}
                                    inputMode="decimal"
                                    required
                                />
                                <span className="units">mm</span>
                            </div>
                        </div>

                        <div className="field">
                            <label className="field-label" htmlFor="tubeClearance">
                                Tube clearance
                                <span className="required-asterisk">*</span>
                            </label>
                            <div className="input-group">
                                <IMaskInput
                                    className="value-input"
                                    id="tubeClearance"
                                    name="tubeClearance"
                                    type="text"
                                    autoComplete="off"
                                    placeholder="≥ 0"
                                    mask={Number}
                                    scale={2}
                                    min={0}
                                    radix={"."}
                                    thousandsSeparator=","
                                    onBlur={onBlur}
                                    onKeyDown={onKeyDown}
                                    onAccept={(value: string) =>
                                        onAcceptEmpty(value, "tubeClearance")
                                    }
                                    onChange={(e) => {}}
                                    onSubmit={inputOnSubmitHandler}
                                    value={
                                        !utils.isNumber(tubeClearance)
                                            ? ""
                                            : tubeClearance.toString()
                                    }
                                    inputMode="decimal"
                                    required
                                />
                                <span className="units">mm</span>
                            </div>
                        </div>

                        <div className="field">
                            <label className="field-label" htmlFor="pitchRatio">
                                Pitch ratio
                                <span className="required-asterisk">*</span>
                            </label>
                            <div className="input-group">
                                <IMaskInput
                                    className="value-input"
                                    id="pitchRatio"
                                    name="pitchRatio"
                                    type="text"
                                    autoComplete="off"
                                    placeholder="≥ 1"
                                    mask={Number}
                                    scale={2}
                                    min={0}
                                    radix={"."}
                                    thousandsSeparator=","
                                    onBlur={onBlur}
                                    onKeyDown={onKeyDown}
                                    onAccept={(value: string) => onAcceptEmpty(value, "pitchRatio")}
                                    onChange={(e) => {}}
                                    onSubmit={inputOnSubmitHandler}
                                    value={!utils.isNumber(pitchRatio) ? "" : pitchRatio.toString()}
                                    inputMode="decimal"
                                    required
                                />
                            </div>
                        </div>

                        <div className="field">
                            <label className="field-label" htmlFor="shellID">
                                Custom shell ID
                            </label>
                            <div className="input-group">
                                <IMaskInput
                                    className="value-input"
                                    id="shellID"
                                    name="shellID"
                                    type="text"
                                    autoComplete="off"
                                    placeholder="Optional override"
                                    mask={Number}
                                    scale={2}
                                    min={0}
                                    radix={"."}
                                    thousandsSeparator=","
                                    onBlur={onBlur}
                                    onKeyDown={onKeyDown}
                                    onAccept={(value: string) => onAcceptEmpty(value, "shellID")}
                                    onChange={(e) => {}}
                                    onSubmit={inputOnSubmitHandler}
                                    value={!utils.isNumber(shellID) ? "" : shellID.toString()}
                                    inputMode="decimal"
                                />
                                <span className="units">mm</span>
                            </div>
                        </div>

                        <div className="field">
                            <label className="field-label" htmlFor="actualTubes">
                                Actual number of tubes
                            </label>
                            <div className="input-group">
                                <IMaskInput
                                    className="value-input"
                                    id={"actualTubes"}
                                    name={"actualTubes"}
                                    type="text"
                                    autoComplete="off"
                                    placeholder="Based on custom shell ID"
                                    mask={Number}
                                    scale={0}
                                    min={0}
                                    radix={"."}
                                    thousandsSeparator=","
                                    value={
                                        !utils.isNumber(actualTubes) ? "" : actualTubes.toString()
                                    }
                                    inputMode="numeric"
                                    readOnly
                                />
                            </div>
                        </div>
                    </div>

                    <div className="divider" />

                    <div className="section">
                        <h2>Layout Options</h2>
                        <div
                            className="layout-grid"
                            role="radiogroup"
                            aria-label="Tube layout angle"
                        >
                            <label
                                className={`layout-tile ${layoutResults[30]?.preferred ? "preferred" : ""}`}
                                htmlFor="30deg"
                            >
                                <input
                                    type="radio"
                                    id="30deg"
                                    name="layoutOption"
                                    value="30"
                                    onChange={onLayoutOptionChange}
                                    required
                                />
                                <span className="tile-angle">30°</span>
                                <span className="tile-stats">
                                    <span>
                                        Min ID{" "}
                                        <span className="stat-value">
                                            {layoutResults[30] &&
                                            layoutResults[30].minID !== null ? (
                                                utils.numFormat3SigFigs(layoutResults[30].minID)
                                            ) : (
                                                <span className="empty">—</span>
                                            )}
                                        </span>
                                    </span>
                                    <span>
                                        Tubes{" "}
                                        <span className="stat-value">
                                            {layoutResults[30] ? (
                                                utils.numFormat3SigFigs(
                                                    layoutResults[30].numTubes as number,
                                                )
                                            ) : (
                                                <span className="empty">—</span>
                                            )}
                                        </span>
                                    </span>
                                </span>
                            </label>

                            <label
                                className={`layout-tile ${layoutResults[45]?.preferred ? "preferred" : ""}`}
                                htmlFor="45deg"
                            >
                                <input
                                    type="radio"
                                    id="45deg"
                                    name="layoutOption"
                                    value="45"
                                    onChange={onLayoutOptionChange}
                                />
                                <span className="tile-angle">45°</span>
                                <span className="tile-stats">
                                    <span>
                                        Min ID{" "}
                                        <span className="stat-value">
                                            {layoutResults[45] &&
                                            layoutResults[45].minID !== null ? (
                                                utils.numFormat3SigFigs(
                                                    layoutResults[45].minID as number,
                                                )
                                            ) : (
                                                <span className="empty">—</span>
                                            )}
                                        </span>
                                    </span>
                                    <span>
                                        Tubes{" "}
                                        <span className="stat-value">
                                            {layoutResults[45] ? (
                                                utils.numFormat3SigFigs(
                                                    layoutResults[45].numTubes as number,
                                                )
                                            ) : (
                                                <span className="empty">—</span>
                                            )}
                                        </span>
                                    </span>
                                </span>
                            </label>

                            <label
                                className={`layout-tile ${layoutResults[60]?.preferred ? "preferred" : ""}`}
                                htmlFor="60deg"
                            >
                                <input
                                    type="radio"
                                    id="60deg"
                                    name="layoutOption"
                                    value="60"
                                    onChange={onLayoutOptionChange}
                                />
                                <span className="tile-angle">60°</span>
                                <span className="tile-stats">
                                    <span>
                                        Min ID{" "}
                                        <span className="stat-value">
                                            {layoutResults[60] &&
                                            layoutResults[60].minID !== null ? (
                                                utils.numFormat3SigFigs(
                                                    layoutResults[60].minID as number,
                                                )
                                            ) : (
                                                <span className="empty">—</span>
                                            )}
                                        </span>
                                    </span>
                                    <span>
                                        Tubes{" "}
                                        <span className="stat-value">
                                            {layoutResults[60] ? (
                                                utils.numFormat3SigFigs(
                                                    layoutResults[60].numTubes as number,
                                                )
                                            ) : (
                                                <span className="empty">—</span>
                                            )}
                                        </span>
                                    </span>
                                </span>
                            </label>

                            <label
                                className={`layout-tile ${layoutResults[90]?.preferred ? "preferred" : ""}`}
                                htmlFor="90deg"
                            >
                                <input
                                    type="radio"
                                    id="90deg"
                                    name="layoutOption"
                                    value="90"
                                    onChange={onLayoutOptionChange}
                                />
                                <span className="tile-angle">90°</span>
                                <span className="tile-stats">
                                    <span>
                                        Min ID{" "}
                                        <span className="stat-value">
                                            {layoutResults[90] &&
                                            layoutResults[90].minID !== null ? (
                                                utils.numFormat3SigFigs(
                                                    layoutResults[90].minID as number,
                                                )
                                            ) : (
                                                <span className="empty">—</span>
                                            )}
                                        </span>
                                    </span>
                                    <span>
                                        Tubes{" "}
                                        <span className="stat-value">
                                            {layoutResults[90] ? (
                                                utils.numFormat3SigFigs(
                                                    layoutResults[90].numTubes as number,
                                                )
                                            ) : (
                                                <span className="empty">—</span>
                                            )}
                                        </span>
                                    </span>
                                </span>
                            </label>

                            <label
                                className={`layout-tile ${layoutResults.radial?.preferred ? "preferred" : ""}`}
                                htmlFor="radial"
                            >
                                <input
                                    type="radio"
                                    id="radial"
                                    name="layoutOption"
                                    value="0"
                                    onChange={onLayoutOptionChange}
                                />
                                <span className="tile-angle">Radial</span>
                                <span className="tile-stats">
                                    <span>
                                        Min ID{" "}
                                        <span className="stat-value">
                                            {layoutResults.radial &&
                                            layoutResults.radial.minID !== null ? (
                                                utils.numFormat3SigFigs(
                                                    layoutResults.radial.minID as number,
                                                )
                                            ) : (
                                                <span className="empty">—</span>
                                            )}
                                        </span>
                                    </span>
                                    <span>
                                        Tubes{" "}
                                        <span className="stat-value">
                                            {layoutResults.radial ? (
                                                utils.numFormat3SigFigs(
                                                    layoutResults.radial.numTubes as number,
                                                )
                                            ) : (
                                                <span className="empty">—</span>
                                            )}
                                        </span>
                                    </span>
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* <button
                        type="submit"
                        className="generate-button"
                        disabled={!layoutInputsDefined || !layoutOptionSelected}
                    >
                        Regenerate Drawing
                    </button> */}
                </div>

                <div className="form-footer">
                    <footer>
                        <GitHubButton
                            href="https://github.com/colin-tso/tubesheet-generator-react-app"
                            data-color-scheme="light"
                            data-size="large"
                            aria-label=" View this repo on GitHub"
                        >
                            View this repo on GitHub
                        </GitHubButton>
                        <br />
                        Released under a GPL 3.0 license.{" "}
                        <a
                            href="https://www.gnu.org/licenses/gpl-3.0.en.html"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <br />
                            Find out more here.
                        </a>
                    </footer>
                </div>
            </form>
            <div className="column-pane right">
                <div className={`viewport ${showGrid ? "" : "grid-hidden"}`}>
                    <span className="viewport-label noselect">Layout Preview</span>
                    <span
                        className={`loading-overlay noselect ${isCalculating ? "visible" : ""}`}
                        role="status"
                        aria-live="polite"
                    >
                        Calculating Layout...
                    </span>
                    <span className="reg-tl" aria-hidden="true" />
                    <span className="reg-tr" aria-hidden="true" />
                    <span className="reg-bl" aria-hidden="true" />
                    <span className="reg-br" aria-hidden="true" />
                    <button
                        type="button"
                        className={`grid-toggle ${showGrid ? "active" : ""}`}
                        onClick={() => setShowGrid((v) => !v)}
                        aria-pressed={showGrid}
                        title={showGrid ? "Hide Grid" : "Show Grid"}
                    >
                        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                            <rect x="1" y="1" width="14" height="14" rx="1" />
                            <line x1="1" y1="6" x2="15" y2="6" />
                            <line x1="1" y1="11" x2="15" y2="11" />
                            <line x1="6" y1="1" x2="6" y2="15" />
                            <line x1="11" y1="1" x2="11" y2="15" />
                        </svg>
                        Grid
                    </button>
                    <TubeSheetSVG
                        src={drawingSVG}
                        className="tubesheet-svg"
                        onRendered={onDrawingRendered}
                    />
                    <div className="viewport-actions" hidden={drawingSVG === placeholderSVG}>
                        <button className="copy-button" onClick={copySVG} type="button">
                            {copyState === "copied"
                                ? "Copied!"
                                : copyState === "error"
                                  ? "Copy failed"
                                  : copyState === "unsupported"
                                    ? "Copy unsupported"
                                    : "Copy Image"}
                        </button>
                        <button className="save-button" onClick={downloadSVG} type="button">
                            Save Image
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default App;
