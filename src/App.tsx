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
import { ContextMenu, ContextMenuItem } from "./components/context-menu";
import { ReactComponent as StarIcon } from "./assets/star.svg";
import { ReactComponent as GridIcon } from "./assets/grid-icon.svg";
import { ReactComponent as SaveIcon } from "./assets/save-icon.svg";
import { ReactComponent as CopyIcon } from "./assets/copy-icon.svg";
import "./index.css";

type LayoutResults = {
    30: (ITubeSheetData & { preferred: boolean }) | null;
    45: (ITubeSheetData & { preferred: boolean }) | null;
    60: (ITubeSheetData & { preferred: boolean }) | null;
    90: (ITubeSheetData & { preferred: boolean }) | null;
    radial: (ITubeSheetData & { preferred: boolean }) | null;
};

interface Position {
    x: number;
    y: number;
}

type AnimationLifecycle = "idle" | "fading-in" | "fading-out";

const emptyTubeSheet = new TubeSheet(0, 100, 1, 30, undefined, 100);
const emptyData: ITubeSheetData = {
    tubeField: emptyTubeSheet.tubeField,
    OTL: emptyTubeSheet.OTL,
    shellID: emptyTubeSheet.shellID,
    minID: emptyTubeSheet.minID,
    tubeOD: emptyTubeSheet.tubeOD,
    pitchRatio: emptyTubeSheet.pitchRatio,
    layout: emptyTubeSheet.layout,
    numTubes: emptyTubeSheet.numTubes,
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

    // Show/hide grid state
    const [showGrid, setShowGrid] = useState<boolean>(true);

    // Loading/calculation visual states
    const [isCalculating, setIsCalculating] = useState<boolean>(false);
    const [showLoadingBadge, setShowLoadingBadge] = useState<boolean>(false);
    const loadingShownAtRef = useRef<number | null>(null);
    const [calcError, setCalcError] = useState<string | null>(null);

    // Context menu
    const [contextMenuPos, setContextMenuPos] = useState<Position>({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const [contextMenuAnimationState, setContextMenuAnimationState] =
        useState<AnimationLifecycle>("idle");

    // Screen-reader-only status state
    const [announcement, setAnnouncement] = useState<string>("");

    // Refs
    const hasRenderedOnceRef = useRef(false);
    // Track outstanding calculations so "isCalculating" clears only when all finish.
    const pendingCompletionsRef = useRef(0);
    // Worker responses increment these refs synchronously; effects drain them.
    const pendingAllResponsesRef = useRef(0);
    const pendingSingleResponsesRef = useRef(0);
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
    // Drain counter and call completeCalculation per recorded response.
    const drainCompletions = useCallback((counterRef: { current: number }) => {
        const count = counterRef.current;
        counterRef.current = 0;
        for (let i = 0; i < count; i++) {
            completeCalculation();
        }
    }, []);
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
                // Count ALL_RESULTS now; an effect will drain and clear isCalculating.
                pendingAllResponsesRef.current += 1;
                setLayoutResults(payload);
            }

            if (type === "SINGLE_RESULT") {
                // Count SINGLE_RESULT and set SVG; TubeSheetSVG's onRendered clears isCalculating.
                pendingSingleResponsesRef.current += 1;
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
                // On ERROR: reset counters, show error, and stop loading.
                pendingCompletionsRef.current = 0;
                pendingAllResponsesRef.current = 0;
                pendingSingleResponsesRef.current = 0;
                setIsCalculating(false);
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

    // After layoutResults commit: drain pending ALL_RESULTS count.
    useEffect(() => {
        drainCompletions(pendingAllResponsesRef);
    }, [layoutResults, drainCompletions]);

    // Stable callback for TubeSheetSVG render.
    const onDrawingRendered = useCallback(() => {
        // Drain pending SINGLE_RESULT count.
        drainCompletions(pendingSingleResponsesRef);

        // Skip initial placeholder announcement
        if (!hasRenderedOnceRef.current) {
            hasRenderedOnceRef.current = true;
            return;
        }

        setAnnouncement("Layout updated.");
    }, [drainCompletions]);

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
        // console.log(`Layout option validated: ${valid}`);
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

    // Allow empty values via onAccept to avoid IMask reverting them.
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

    // Handle Enter/Tab: commit field and trigger calc with snapshot.
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
            // For "tubeClearance" and "pitchRatio", compare values at
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

        // Clipboard writes must occur during user activation. Pass pending
        // Promises to "ClipboardItem" so browsers accept async image data.
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
        // console.log("calling validateLayoutOption");
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

    // Actual tubes calculation only when layout option is selected and shell ID is defined
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

    // Layout options for displaying min ID and tube counts.
    const layoutOptionRows: {
        key: keyof LayoutResults;
        id: string;
        label: string;
        value: string;
        required?: boolean;
    }[] = [
        { key: 30, id: "30deg", label: "30°", value: "30", required: true },
        { key: 45, id: "45deg", label: "45°", value: "45" },
        { key: 60, id: "60deg", label: "60°", value: "60" },
        { key: 90, id: "90deg", label: "90°", value: "90" },
        { key: "radial", id: "radial", label: "Radial", value: "0" },
    ];

    const definedMinIDs = layoutOptionRows
        .map((row) => layoutResults[row.key]?.minID)
        .filter((v): v is number => utils.isNumber(v));
    const minIDFloor = definedMinIDs.length ? Math.min(...definedMinIDs) : undefined;
    const minIDCeiling = definedMinIDs.length ? Math.max(...definedMinIDs) : undefined;

    // Convert minID to bar width percent (symlog scale, min 12%).
    const minIDBarLogPercent = (value: number | undefined) => {
        if (!utils.isNumber(value) || minIDFloor === undefined || minIDCeiling === undefined) {
            return 0;
        }
        if (minIDCeiling === minIDFloor) {
            return 100;
        }
        const c = 150;
        const logRatio =
            utils.symlog(value - minIDFloor, c) / utils.symlog(minIDCeiling - minIDFloor, c);
        return Math.max(12, 12 + logRatio * 88);
    };

    useEffect(() => {
        const handleContextMenuCloseTrigger = () => {
            if (contextMenuAnimationState === "fading-in") {
                setContextMenuAnimationState("fading-out");
            }
        };
        const handleEscapeKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") handleContextMenuCloseTrigger();
        };
        window.addEventListener("click", handleContextMenuCloseTrigger);
        window.addEventListener("keydown", handleEscapeKey);
        return () => {
            window.removeEventListener("click", handleContextMenuCloseTrigger);
            window.removeEventListener("keydown", handleEscapeKey);
        };
    }, [contextMenuAnimationState]);
    const handleContextMenuCopyAction = () => {
        copySVG();
        setContextMenuAnimationState("fading-out"); // Initiates the safe unmount fade out
    };
    const handleContextMenuSaveAction = () => {
        downloadSVG();
        setContextMenuAnimationState("fading-out"); // Initiates the safe unmount fade out
    };
    const menuConfig: ContextMenuItem[] = [
        { label: "Copy Image", icon: <CopyIcon />, onClick: () => handleContextMenuCopyAction() },
        { label: "", isDivider: true, onClick: () => {} },
        { label: "Save Image", icon: <SaveIcon />, onClick: () => handleContextMenuSaveAction() },
    ];
    const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const relativeX = e.clientX - rect.left;
        const relativeY = e.clientY - rect.top;

        setContextMenuPos({ x: relativeX, y: relativeY });
        setContextMenuAnimationState("fading-in");
    };

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
                        <div className="layout-list-header" aria-hidden="true">
                            <span />
                            <span />
                            <span />
                            <span className="header-stats">
                                <span className="header-minid">ID (mm)</span>
                                <span className="header-tubes">Tubes</span>
                            </span>
                        </div>
                        <div
                            className="layout-list"
                            role="radiogroup"
                            aria-label="Tube layout angle"
                            aria-busy={isCalculating}
                        >
                            {layoutOptionRows.map(({ key, id, label, value, required }) => {
                                const result = layoutResults[key];
                                const minIDValue =
                                    result && result.minID !== null
                                        ? (result.minID as number)
                                        : undefined;

                                return (
                                    <label
                                        key={id}
                                        className={`layout-row ${result?.preferred ? "preferred" : ""}`}
                                        htmlFor={id}
                                    >
                                        <input
                                            type="radio"
                                            id={id}
                                            name="layoutOption"
                                            value={value}
                                            onChange={onLayoutOptionChange}
                                            disabled={isCalculating}
                                            required={required}
                                        />
                                        <span className="row-angle">
                                            {label}
                                            {result?.preferred && (
                                                <span
                                                    className="row-badge"
                                                    title="Lowest minimum shell ID among the calculated layouts"
                                                >
                                                    <StarIcon
                                                        width="10"
                                                        height="10"
                                                        aria-hidden="true"
                                                    />
                                                    <span className="hidden">
                                                        Preferred layout (lowest minimum shell ID)
                                                    </span>
                                                </span>
                                            )}
                                        </span>
                                        <span className="row-bar-track" aria-hidden="true">
                                            <span
                                                className="row-bar-fill"
                                                style={{
                                                    width: `${minIDBarLogPercent(minIDValue)}%`,
                                                }}
                                            />
                                        </span>
                                        <span className="row-stats">
                                            <span className="row-minid">
                                                {minIDValue !== undefined ? (
                                                    utils.numFormat3SigFigs(minIDValue)
                                                ) : (
                                                    <span className="empty">—</span>
                                                )}
                                            </span>
                                            <span className="row-tubes">
                                                {result ? (
                                                    utils.numFormat3SigFigs(
                                                        result.numTubes as number,
                                                    )
                                                ) : (
                                                    <span className="empty">—</span>
                                                )}{" "}
                                            </span>
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* Disabled while a calculation is in flight */}
                    <button
                        type="submit"
                        className="generate-button"
                        disabled={!layoutInputsDefined || !layoutOptionSelected || isCalculating}
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
                <div
                    className={`viewport ${showGrid ? "" : "grid-hidden"}`}
                    ref={containerRef}
                    onContextMenu={handleContextMenu}
                >
                    {contextMenuAnimationState !== "idle" && (
                        <ContextMenu
                            position={contextMenuPos}
                            parentRef={containerRef}
                            items={menuConfig} // Pass layout data array down
                            animationState={
                                contextMenuAnimationState === "fading-in"
                                    ? "fading-in"
                                    : "fading-out"
                            }
                            onAnimationEnd={() => setContextMenuAnimationState("idle")}
                            onRequestClose={() => setContextMenuAnimationState("fading-out")}
                        />
                    )}
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
                        <GridIcon width="13" height="13" aria-hidden="true" />
                        Grid
                    </button>
                    <TubeSheetSVG
                        src={drawingSVG}
                        className="tubesheet-svg"
                        onRendered={onDrawingRendered}
                    />
                    <div className="viewport-actions" hidden={drawingSVG === placeholderSVG}>
                        <button className="copy-button" onClick={copySVG} type="button">
                            <CopyIcon width="15" height="15" aria-hidden="true" />
                            {copyState === "copied"
                                ? "Copied!"
                                : copyState === "error"
                                  ? "Copy failed"
                                  : copyState === "unsupported"
                                    ? "Copy unsupported"
                                    : "Copy Image"}
                        </button>
                        <button className="save-button" onClick={downloadSVG} type="button">
                            <SaveIcon width="15" height="15" aria-hidden="true" />
                            Save Image
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default App;
