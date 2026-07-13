import React, { useCallback, useState, useEffect, useRef } from "react";
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

// Clone svg with explicit pixel dimensions derived from viewBox
// for SVG and PNG rasterisation.
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
    // Layout data states
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
    const [layoutOptionSelected, setLayoutOptionSelected] = useState<boolean>(false);
    const [drawingSVG, setDrawingSVG] = useState<SVGSVGElement>(placeholderSVG);

    // Copy state
    const [copyState, setCopyState] = useState<"idle" | "copied" | "error" | "unsupported">("idle");

    // Show/hid grid state
    const [showGrid, setShowGrid] = useState<boolean>(true);

    // Loading/calculation visual states
    const [isCalculating, setIsCalculating] = useState<boolean>(false);
    const [showLoadingBadge, setShowLoadingBadge] = useState<boolean>(false);
    const loadingShownAtRef = useRef<number | null>(null);
    const [calcError, setCalcError] = useState<string | null>(null);

    // Screen-reader-only status state
    const [announcement, setAnnouncement] = useState<string>("");

    // Refs
    const hasRenderedOnceRef = useRef(false);
    // CALCULATE_ALL (tile stats) and CALCULATE_SINGLE (the drawing) can both
    // be in flight at once, each clearing isCalculating only once ITS OWN
    // result has actually committed to the DOM (see the layoutResults effect
    // and onDrawingRendered below). A single boolean can't represent "two
    // independent things are pending", so a count is kept instead — isCalculating
    // only goes false once every outstanding request has actually rendered.
    const pendingCompletionsRef = useRef(0);
    const beginCalculation = () => {
        pendingCompletionsRef.current += 1;
        setCalcError(null);
        setIsCalculating(true);
    };
    const completeCalculation = () => {
        pendingCompletionsRef.current = Math.max(0, pendingCompletionsRef.current - 1);
        if (pendingCompletionsRef.current === 0) {
            setIsCalculating(false);
        }
    };
    // Workers
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
                // isCalculating is intentionally NOT cleared here — the effect
                // keyed on layoutResults clears it only once the new tile
                // stats have  committed to the DOM
                setLayoutResults(payload);
            }

            if (type === "SINGLE_RESULT") {
                // Take the raw data payload and generate the SVG purely on the main thread.
                // isCalculating is NOT cleared here — TubeSheetSVG onRendered callback
                // clears it once rendred to DOM.
                setCalcError(null);
                setDrawingSVG(generateTubeSheetSVG(payload));

                // If shellID was custom inputted, update actual tubes
                if (payload.shellID && payload.numTubes) {
                    setActualTubes(payload.numTubes);
                }
            }

            if (type === "ERROR") {
                console.error("Worker Error:", payload);
                setCalcError(typeof payload === "string" ? payload : "Calculation failed.");
                setAnnouncement(`Calculation failed: ${payload}`);
                // An error is a definitive stop for whichever request(s) were
                // outstanding — neither will post a normal completion, so drop
                // the count to zero rather than leaving isCalculating stuck.
                pendingCompletionsRef.current = 0;
                setIsCalculating(false);
                // Swap to the error badge right away instead of waiting out
                // the loading badge's minimum-visible duration.
                loadingShownAtRef.current = null;
                setShowLoadingBadge(false);
            }
        };

        setWorkerInstance(w);

        return () => {
            w.terminate();
        };
    }, []);

    // Debounce showing the loading badge.
    useEffect(() => {
        const SHOW_DELAY_MS = 150;
        const MIN_VISIBLE_MS = 300;

        if (isCalculating) {
            setAnnouncement("Calculating layout…");

            const showTimer = window.setTimeout(() => {
                loadingShownAtRef.current = Date.now();
                setShowLoadingBadge(true);
            }, SHOW_DELAY_MS);

            return () => clearTimeout(showTimer);
        }

        // Calculation finished. If the badge never actually became visible
        // the cleanup above already cancelled the timer.
        if (loadingShownAtRef.current === null) {
            return;
        }

        const elapsed = Date.now() - loadingShownAtRef.current;
        const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

        const hideTimer = window.setTimeout(() => {
            setShowLoadingBadge(false);
            loadingShownAtRef.current = null;
        }, remaining);

        return () => clearTimeout(hideTimer);
    }, [isCalculating]);

    // Fires after React has actually committed the render reflecting the new
    // layoutResults.
    useEffect(() => {
        completeCalculation();
    }, [layoutResults]);

    // Stable identity so TubeSheetSVG's effect (keyed on this + src) only
    // re-runs when the drawing itself actually changes, not on every render.
    const onDrawingRendered = useCallback(() => {
        completeCalculation();

        // Skip the announcement for the initial placeholder mount
        if (!hasRenderedOnceRef.current) {
            hasRenderedOnceRef.current = true;
            return;
        }

        setAnnouncement("Layout updated.");
    }, []);

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

        beginCalculation();
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

    const validateLayoutOption = useCallback(() => {
        const valid = utils.isNumber(layoutOption);
        setLayoutOptionSelected(valid);
        console.log(`Layout option validated: ${valid}`);
    }, [layoutOption]);

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
        // console.log(`Layout calc inputs validated: ${valid}`);
    }, [OTLtoShell, minTubes, pitchRatio, tubeClearance, tubeOD]);

    const requestAllLayoutResults = useCallback(() => {
        if (!layoutInputsDefined || !workerInstance) return;

        beginCalculation();
        workerInstance.postMessage({
            type: "CALCULATE_ALL",
            payload: { OTLtoShell, tubeOD, pitchRatio, minTubes },
        });
    }, [layoutInputsDefined, workerInstance, OTLtoShell, tubeOD, pitchRatio, minTubes]);

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

    // Prevent IMask from reverting emptied inputs before 'onBlur'.
    // Use 'onAccept' to commit an empty value immediately.
    const onAcceptEmpty = (value: string, name: string) => {
        if (value.trim() === "") {
            callSetFunc(`set${utils.capitalize(name)}`, "");
        }
    };

    const onBlur = (e: React.SyntheticEvent<HTMLInputElement>) => {
        const val = e.currentTarget.value.replace(",", ""),
            name = e.currentTarget.name;

        // An intentionally emptied field should stay empty rather than bounce
        // back to its last committed value.
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

    // Handle Enter/Tab: commit the field (like onBlur) and, if valid,
    // trigger a calculation using a same-tick snapshot to avoid stale state.
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

        const currentValues: Record<string, number | undefined> = {
            minTubes,
            tubeOD,
            OTLtoShell,
            tubeClearance,
            pitchRatio,
            shellID,
        };

        const currentValue = currentValues[name];
        const unchanged = (() => {
            // For `tubeClearance` and `pitchRatio` compare values at
            // display precision (2 decimals).
            if (name === "tubeClearance" || name === "pitchRatio") {
                if (utils.isNumber(committed) && utils.isNumber(currentValue)) {
                    return utils.trunc(currentValue, 2) === utils.trunc(committed, 2);
                }
                return committed === currentValue;
            }
            return committed === currentValue;
        })();

        if (unchanged) {
            onBlur(e);
            return;
        }

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

        // Nothing to recalculate if this field's value is unchanged.
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
        // console.log("calling validateLayoutInputs");
        validateLayoutInputs();
        console.log("calling validateLayoutOption");
        validateLayoutOption();
    }, [validateLayoutInputs, validateLayoutOption]);

    // Pitch calculation
    useEffect(() => {
        if (typeof pitchUpdateFunc !== "undefined") {
            let value = tubeClearance;
            switch (pitchUpdateFunc) {
                case "setPitchRatioFromTubeClearance":
                    value = tubeClearance;
                    if (utils.isNumber(value)) {
                        // console.log("setting pitch ratio from tube clearance");
                        setPitchRatioFromTubeClearance(value);
                    }
                    break;
                case "setTubeClearanceFromPitchRatio":
                    value = pitchRatio;
                    if (utils.isNumber(value)) {
                        // console.log("setting tube clearance from pitch ratio");
                        setTubeClearanceFromPitchRatio(value);
                    }
                    break;
            }
            // console.log("calling requestAllLayoutResults");
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
            // console.log("Layout option not yet selected.");
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
                                    readOnly={isCalculating}
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
                                    readOnly={isCalculating}
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
                                    readOnly={isCalculating}
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
                                    readOnly={isCalculating}
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
                                    readOnly={isCalculating}
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
                                    readOnly={isCalculating}
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
                                    className="value-input calculated-field"
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
                            aria-busy={isCalculating}
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
                                    disabled={isCalculating}
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
                                    disabled={isCalculating}
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
                                    disabled={isCalculating}
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
                                    disabled={isCalculating}
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
                                    disabled={isCalculating}
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

                    <button
                        type="submit"
                        className="generate-button"
                        disabled={!layoutInputsDefined || !layoutOptionSelected}
                    >
                        Regenerate Drawing
                    </button>
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
                    {calcError ? (
                        <span className="loading-overlay error visible noselect" aria-hidden="true">
                            Calculation failed
                        </span>
                    ) : (
                        <span
                            className={`loading-overlay noselect${showLoadingBadge ? " visible" : ""}`}
                            aria-hidden="true"
                        >
                            Calculating Layout
                            <span className="loading-dots" aria-hidden="true">
                                <span />
                                <span />
                                <span />
                            </span>
                        </span>
                    )}
                    {/* Calculating/updated/error status for screen readers */}
                    <span className="hidden" role="status" aria-live="polite">
                        {announcement}
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
