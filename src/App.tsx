import React, { useCallback, useState, useEffect } from "react";
import GitHubButton from "react-github-btn";
import { IMaskInput } from "react-imask";
import { TubeSheet } from "./plugins/tubesheet-layout-generator";
import { TubeSheetSVG } from "./components/TubeSheetSVG";
import { utils } from "./utils/";
import ThemeToggle from "./components/DarkmodeToggle";
import "./index.css";

const emptyTubeSheet = new TubeSheet(0, 100, 1, 30, undefined, 100);
const placeholderSVG = emptyTubeSheet.svg;

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
    const [bestLayoutID, setBestLayoutID] = useState<number | undefined>();
    const [layoutResults, setLayoutResults] = useState<{
        "30": TubeSheet | null;
        "45": TubeSheet | null;
        "60": TubeSheet | null;
        "90": TubeSheet | null;
        radial: TubeSheet | null;
    }>({
        "30": null,
        "45": null,
        "60": null,
        "90": null,
        radial: null,
    });
    const [layoutInputsDefined, setLayoutInputsDefined] = useState<boolean>(false);
    const [layoutOptionSelected, setLayoutOptionSelected] = useState<boolean>(false);
    const [drawingSVG, setDrawingSVG] = useState<SVGSVGElement>(placeholderSVG);

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

    const formOnSubmitHandler = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (utils.isNumber(layoutOption)) {
            const parsedLayoutOption = (
                layoutOption === 0 ? "radial" : layoutOption
            ) as TubeSheet["layout"];
            let selectedLayout: TubeSheet | null = null;
            if (utils.isNumber(shellID) && shellID !== 0) {
                selectedLayout = layoutInputsDefined
                    ? new TubeSheet(
                          OTLtoShell!,
                          tubeOD!,
                          pitchRatio!,
                          parsedLayoutOption,
                          undefined,
                          shellID
                      )
                    : null;
            } else {
                selectedLayout = layoutInputsDefined
                    ? layoutResults[parsedLayoutOption.toString() as keyof typeof layoutResults]
                    : null;
            }

            if (selectedLayout === null) {
                setDrawingSVG(placeholderSVG);
            } else {
                setDrawingSVG(selectedLayout.svg);
            }
        }
    };

    const updateLayoutOptionValidation = useCallback(() => {
        const valid = utils.isNumber(layoutOption);
        setLayoutOptionSelected(valid);
        console.log(`Layout option validated: ${valid}`);
    }, [layoutOption]);

    const updateLayoutInputsValidation = useCallback(() => {
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

    const updateLayoutResults = useCallback(() => {
        console.log("calculating layout results");

        if (!layoutInputsDefined) {
            setLayoutResults({ "30": null, "45": null, "60": null, "90": null, radial: null });
            return;
        }

        const layouts = {
            30: new TubeSheet(OTLtoShell!, tubeOD!, pitchRatio!, 30, minTubes),
            45: new TubeSheet(OTLtoShell!, tubeOD!, pitchRatio!, 45, minTubes),
            60: new TubeSheet(OTLtoShell!, tubeOD!, pitchRatio!, 60, minTubes),
            90: new TubeSheet(OTLtoShell!, tubeOD!, pitchRatio!, 90, minTubes),
            radial: new TubeSheet(OTLtoShell!, tubeOD!, pitchRatio!, "radial", minTubes),
        };

        setLayoutResults(layouts);

        // Find the layout with the minimum ID
        let minID = Infinity;
        Object.entries(layouts).forEach(([key, layout]) => {
            if ((utils.isNumber(layout.minID) ? layout.minID : Infinity) < minID) {
                minID = layout.minID!;
            }
        });
        setBestLayoutID(minID);
    }, [layoutInputsDefined, OTLtoShell, tubeOD, pitchRatio, minTubes]);

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
        [tubeOD]
    );

    const setTubeClearanceFromPitchRatio = useCallback(
        (value: number) => {
            if (utils.isNumber(value) && utils.isNumber(tubeOD)) {
                setTubeClearance((value - 1) * tubeOD);
            }
        },
        [tubeOD]
    );

    const onBlur = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(",", ""),
            name = e.target.name;
        if (!utils.isNumber(val)) {
            callSetFunc(`set${utils.capitalize(name)}`, "");
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

    const downloadSVG = useCallback(() => {
        const blob = new Blob([drawingSVG.outerHTML], { type: "image/svg+xml" });
        downloadBlob(blob, "tubesheet.svg");
    }, [drawingSVG.outerHTML]);

    // not supported in Firefox
    //-------------------------
    // const copySVG = useCallback(async () => {
    //     alert(window.isSecureContext);
    //     const image = new Image();
    //     image.src = "data:image/png," + encodeURIComponent(drawingSVG.outerHTML);

    //     await navigator.clipboard.write([
    //         new ClipboardItem({
    //             "image/png": new Promise((resolve) => {
    //                 const canvas = document.createElement("canvas");
    //                 canvas.width = image.naturalWidth;
    //                 canvas.height = image.naturalHeight;
    //                 const context = canvas.getContext("2d");
    //                 context?.drawImage(image, 0, 0);

    //                 canvas.toBlob((blob) => {
    //                     if (blob) {
    //                         resolve(blob);
    //                     }
    //                     canvas.remove();
    //                 }, "image/png");
    //             }),
    //         }),
    //     ]);
    // }, [drawingSVG.outerHTML]);

    // Validation
    useEffect(() => {
        console.log("calling validateLayoutInputs");
        updateLayoutInputsValidation();
        console.log("calling validateLayoutOption");
        updateLayoutOptionValidation();
    }, [updateLayoutInputsValidation, updateLayoutOptionValidation]);

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
            console.log("calling calcLayoutResults");
            if (layoutInputsDefined) {
                updateLayoutResults();
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
        updateLayoutResults,
    ]);

    // Actual tubes calculation (only when layout option is selected and shell ID is defined)
    useEffect(() => {
        if (!utils.isNumber(layoutOption)) {
            console.log("Layout option not yet selected.");
            return;
        }

        if (!shellID) {
            console.log("Shell ID not yet defined.");
            setActualTubes(undefined);
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
                      shellID
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
            <div className="column-pane left">
                <form onSubmit={formOnSubmitHandler}>
                    <h1>Tubesheet Layout Generator</h1>
                    <ThemeToggle />
                    <div className="divider" />
                    <h2>Calculation Inputs</h2>

                    <div className="input-group">
                        <label className="left-cell-label" htmlFor="minTubes">
                            Minimum number of tubes
                        </label>
                        <span className="required-asterisk">*</span>
                        <IMaskInput
                            className="value-input"
                            id="minTubes"
                            name="minTubes"
                            type="text"
                            autoComplete="off"
                            placeholder="Minimum number of tubes (> 0)"
                            mask={Number}
                            scale={0}
                            min={0}
                            radix="."
                            thousandsSeparator=","
                            value={!utils.isNumber(minTubes) ? "" : minTubes.toString()}
                            onBlur={onBlur}
                            onChange={(e) => {}}
                            onSubmit={inputOnSubmitHandler}
                            inputMode="numeric"
                            required
                        />
                        <span className="units"></span>
                    </div>

                    <label className="left-cell-label" htmlFor="tubeOD">
                        Tube OD
                    </label>
                    <span className="required-asterisk">*</span>
                    <div className="input-group">
                        <IMaskInput
                            className="value-input"
                            id="tubeOD"
                            name="tubeOD"
                            type="text"
                            autoComplete="off"
                            placeholder="Tube OD (> 0)"
                            mask={Number}
                            scale={2}
                            min={0}
                            radix={"."}
                            thousandsSeparator=","
                            value={!utils.isNumber(tubeOD) ? "" : tubeOD.toString()}
                            onBlur={onBlur}
                            onChange={(e) => {}}
                            onSubmit={inputOnSubmitHandler}
                            inputMode="decimal"
                            required
                        />
                        <span className="units">mm</span>
                    </div>

                    <label className="left-cell-label" htmlFor="OTLtoShell">
                        OTL to shell diametrical clearance
                    </label>
                    <span className="required-asterisk">*</span>
                    <div className="input-group">
                        <IMaskInput
                            className="value-input"
                            id="OTLtoShell"
                            name="OTLtoShell"
                            type="text"
                            autoComplete="off"
                            placeholder="Shell ID – OTL (≥ 0)"
                            mask={Number}
                            scale={2}
                            min={0}
                            radix={"."}
                            thousandsSeparator=","
                            onBlur={onBlur}
                            onChange={(e) => {}}
                            onSubmit={inputOnSubmitHandler}
                            value={!utils.isNumber(OTLtoShell) ? "" : OTLtoShell.toString()}
                            inputMode="decimal"
                            required
                        />
                        <span className="units">mm</span>
                    </div>

                    <label className="left-cell-label" htmlFor="pitch">
                        Tube Clearance
                    </label>
                    <span className="required-asterisk">*</span>
                    <div className="input-group">
                        <IMaskInput
                            className="value-input"
                            id="tubeClearance"
                            name="tubeClearance"
                            type="text"
                            autoComplete="off"
                            placeholder="Tube Clearance (≥ 0)"
                            mask={Number}
                            scale={2}
                            min={0}
                            radix={"."}
                            thousandsSeparator=","
                            onBlur={onBlur}
                            onChange={(e) => {}}
                            onSubmit={inputOnSubmitHandler}
                            value={!utils.isNumber(tubeClearance) ? "" : tubeClearance.toString()}
                            inputMode="decimal"
                            required
                        />
                        <span className="units">mm</span>
                    </div>

                    <label className="left-cell-label" htmlFor="pitchRatio">
                        Pitch ratio
                    </label>
                    <span className="required-asterisk">*</span>
                    <div className="input-group">
                        <IMaskInput
                            className="value-input"
                            id="pitchRatio"
                            name="pitchRatio"
                            type="text"
                            autoComplete="off"
                            placeholder="Pitch ratio (≥ 1)"
                            mask={Number}
                            scale={2}
                            min={0}
                            radix={"."}
                            thousandsSeparator=","
                            onBlur={onBlur}
                            onChange={(e) => {}}
                            onSubmit={inputOnSubmitHandler}
                            value={!utils.isNumber(pitchRatio) ? "" : pitchRatio.toString()}
                            inputMode="decimal"
                            required
                        />
                        <span className="units"></span>
                    </div>

                    <label className="left-cell-label" htmlFor="shellID">
                        Custom Shell ID
                    </label>
                    <span className="required-asterisk"></span>
                    <div className="input-group">
                        <IMaskInput
                            className="value-input"
                            id="shellID"
                            name="shellID"
                            type="text"
                            autoComplete="off"
                            placeholder="Shell ID"
                            mask={Number}
                            scale={2}
                            min={0}
                            radix={"."}
                            thousandsSeparator=","
                            onBlur={onBlur}
                            onChange={(e) => {}}
                            onSubmit={inputOnSubmitHandler}
                            value={!utils.isNumber(shellID) ? "" : shellID.toString()}
                            inputMode="decimal"
                        />
                        <span className="units">mm</span>
                    </div>
                    <label className="left-cell-label" htmlFor="actualTubes">
                        Actual number of tubes
                    </label>
                    <span className="required-asterisk"></span>
                    <div className="input-group">
                        <IMaskInput
                            className="value-input"
                            id={"actualTubes"}
                            name={"actualTubes"}
                            type="text"
                            autoComplete="off"
                            placeholder="Actual number of tubes (to be calculated)"
                            mask={Number}
                            scale={0}
                            min={0}
                            radix={"."}
                            thousandsSeparator=","
                            value={!utils.isNumber(actualTubes) ? "" : actualTubes.toString()}
                            inputMode="numeric"
                            readOnly
                        />
                        <span className="units"></span>
                    </div>
                    <div className="divider" />
                    <h2>Layout Options</h2>
                    <table className="column-pane">
                        <tbody className="layout-table">
                            <tr>
                                <th>Layout</th>
                                <th
                                    className={
                                        layoutResults[30] &&
                                        layoutResults[30].minID === bestLayoutID
                                            ? "highlight"
                                            : ""
                                    }
                                >
                                    <label htmlFor="30deg">30°</label>
                                </th>
                                <th
                                    className={
                                        layoutResults[45] &&
                                        layoutResults[45].minID === bestLayoutID
                                            ? "highlight"
                                            : ""
                                    }
                                >
                                    <label htmlFor="45deg">45°</label>
                                </th>
                                <th
                                    className={
                                        layoutResults[60] &&
                                        layoutResults[60].minID === bestLayoutID
                                            ? "highlight"
                                            : ""
                                    }
                                >
                                    <label htmlFor="60deg">60°</label>
                                </th>
                                <th
                                    className={
                                        layoutResults[90] &&
                                        layoutResults[90].minID === bestLayoutID
                                            ? "highlight"
                                            : ""
                                    }
                                >
                                    <label htmlFor="90deg">90°</label>
                                </th>
                                <th
                                    className={
                                        layoutResults.radial &&
                                        layoutResults.radial.minID === bestLayoutID
                                            ? "highlight"
                                            : ""
                                    }
                                >
                                    <label htmlFor="radial">Radial</label>
                                </th>
                                <th>Units</th>
                            </tr>
                            <tr>
                                <td>Min. ID</td>
                                <td
                                    className={
                                        layoutResults[30] &&
                                        layoutResults[30].minID === bestLayoutID
                                            ? "highlight"
                                            : ""
                                    }
                                >
                                    {layoutResults[30] && layoutResults[30].minID !== null
                                        ? utils.numFormat3SigFigs(layoutResults[30].minID)
                                        : ""}
                                </td>
                                <td
                                    className={
                                        layoutResults[45] &&
                                        layoutResults[45].minID === bestLayoutID
                                            ? "highlight"
                                            : ""
                                    }
                                >
                                    {layoutResults[45] && layoutResults[45].minID !== null
                                        ? utils.numFormat3SigFigs(layoutResults[45].minID as number)
                                        : ""}
                                </td>
                                <td
                                    className={
                                        layoutResults[60] &&
                                        layoutResults[60].minID === bestLayoutID
                                            ? "highlight"
                                            : ""
                                    }
                                >
                                    {layoutResults[60] && layoutResults[60].minID !== null
                                        ? utils.numFormat3SigFigs(layoutResults[60].minID as number)
                                        : ""}
                                </td>
                                <td
                                    className={
                                        layoutResults[90] &&
                                        layoutResults[90].minID === bestLayoutID
                                            ? "highlight"
                                            : ""
                                    }
                                >
                                    {layoutResults[90] && layoutResults[90].minID !== null
                                        ? utils.numFormat3SigFigs(layoutResults[90].minID as number)
                                        : ""}
                                </td>
                                <td
                                    className={
                                        layoutResults.radial &&
                                        layoutResults.radial.minID === bestLayoutID
                                            ? "highlight"
                                            : ""
                                    }
                                >
                                    {layoutResults.radial && layoutResults.radial.minID !== null
                                        ? utils.numFormat3SigFigs(
                                              layoutResults.radial.minID as number
                                          )
                                        : ""}
                                </td>
                                <td>mm</td>
                            </tr>
                            <tr>
                                <td>Tubes</td>
                                <td
                                    className={
                                        layoutResults[30] &&
                                        layoutResults[30].minID === bestLayoutID
                                            ? "highlight"
                                            : ""
                                    }
                                >
                                    {layoutResults[30]
                                        ? utils.numFormat3SigFigs(
                                              layoutResults[30].numTubes as number
                                          )
                                        : ""}
                                </td>
                                <td
                                    className={
                                        layoutResults[45] &&
                                        layoutResults[45].minID === bestLayoutID
                                            ? "highlight"
                                            : ""
                                    }
                                >
                                    {layoutResults[45]
                                        ? utils.numFormat3SigFigs(
                                              layoutResults[45].numTubes as number
                                          )
                                        : ""}
                                </td>
                                <td
                                    className={
                                        layoutResults[60] &&
                                        layoutResults[60].minID === bestLayoutID
                                            ? "highlight"
                                            : ""
                                    }
                                >
                                    {layoutResults[60]
                                        ? utils.numFormat3SigFigs(
                                              layoutResults[60].numTubes as number
                                          )
                                        : ""}
                                </td>
                                <td
                                    className={
                                        layoutResults[90] &&
                                        layoutResults[90].minID === bestLayoutID
                                            ? "highlight"
                                            : ""
                                    }
                                >
                                    {layoutResults[90]
                                        ? utils.numFormat3SigFigs(
                                              layoutResults[90].numTubes as number
                                          )
                                        : ""}
                                </td>
                                <td
                                    className={
                                        layoutResults.radial &&
                                        layoutResults.radial.minID === bestLayoutID
                                            ? "highlight"
                                            : ""
                                    }
                                >
                                    {layoutResults.radial
                                        ? utils.numFormat3SigFigs(
                                              layoutResults.radial.numTubes as number
                                          )
                                        : ""}
                                </td>
                                <td>mm</td>
                            </tr>
                            <tr>
                                <td>Selected</td>
                                <td
                                    className={
                                        layoutResults[30] &&
                                        layoutResults[30].minID === bestLayoutID
                                            ? "highlight"
                                            : ""
                                    }
                                >
                                    <input
                                        type="radio"
                                        id="30deg"
                                        name="layoutOption"
                                        value="30"
                                        onChange={onBlur}
                                        required
                                    ></input>
                                </td>
                                <td
                                    className={
                                        layoutResults[45] &&
                                        layoutResults[45].minID === bestLayoutID
                                            ? "highlight"
                                            : ""
                                    }
                                >
                                    <input
                                        type="radio"
                                        id="45deg"
                                        name="layoutOption"
                                        value="45"
                                        onChange={onBlur}
                                    ></input>
                                </td>
                                <td
                                    className={
                                        layoutResults[60] &&
                                        layoutResults[60].minID === bestLayoutID
                                            ? "highlight"
                                            : ""
                                    }
                                >
                                    <input
                                        type="radio"
                                        id="60deg"
                                        name="layoutOption"
                                        value="60"
                                        onChange={onBlur}
                                    ></input>
                                </td>
                                <td
                                    className={
                                        layoutResults[90] &&
                                        layoutResults[90].minID === bestLayoutID
                                            ? "highlight"
                                            : ""
                                    }
                                >
                                    <input
                                        type="radio"
                                        id="90deg"
                                        name="layoutOption"
                                        value="90"
                                        onChange={onBlur}
                                    ></input>
                                </td>
                                <td
                                    className={
                                        layoutResults.radial &&
                                        layoutResults.radial.minID === bestLayoutID
                                            ? "highlight"
                                            : ""
                                    }
                                >
                                    <input
                                        type="radio"
                                        id="radial"
                                        name="layoutOption"
                                        value="0"
                                        onChange={onBlur}
                                    ></input>
                                </td>
                                <td />
                            </tr>
                        </tbody>
                    </table>
                    <div className="divider" />
                    <button
                        type="submit"
                        className="generate-button"
                        disabled={!layoutInputsDefined || !layoutOptionSelected}
                    >
                        Generate
                    </button>
                </form>
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
                    This web app has been released under a GPL 3.0 license.
                    <br />
                    <a
                        href="https://www.gnu.org/licenses/gpl-3.0.en.html"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Find out more here.
                    </a>
                </footer>
            </div>
            <div className="column-pane right">
                <TubeSheetSVG src={drawingSVG} className="tubesheet-svg" />
                <button
                    className="save-button"
                    onClick={downloadSVG}
                    hidden={drawingSVG === placeholderSVG}
                >
                    Save Image
                </button>
                {/* <button
                    className="copy-button"
                    onClick={copySVG}
                    disabled={drawingSVG === emptySVG}
                >
                    Copy Image
                </button> */}
            </div>
        </div>
    );
};

export default App;
