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
    const formOnSubmitHandler = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (typeof layoutOption !== "undefined") {
            const parsedLayoutOption = (
                layoutOption === 0 ? "radial" : layoutOption
            ) as TubeSheet["layout"];
            let selectedLayout: TubeSheet | null = null;
            if (typeof shellID !== "undefined" && !isNaN(shellID) && shellID !== 0) {
                selectedLayout = layoutInputsDefined
                    ? new TubeSheet(
                          OTLtoShell,
                          tubeOD,
                          pitchRatio,
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

    const [minTubes, setMinTubes] = useState<number | undefined>();
    const [tubeOD, setTubeOD] = useState<number | undefined>();
    const [OTLtoShell, setOTLtoShell] = useState<number | undefined>();
    const [tubeClearance, setTubeClearance] = useState<number | undefined>();
    const [pitchRatio, setPitchRatio] = useState<number | undefined>();
    const [shellID, setShellID] = useState<number | undefined>();
    const [actualTubes, setActualTubes] = useState<number | undefined>();
    const [layoutOption, setLayoutOption] = useState<number | undefined>();
    const [pitchUpdateFunc, setPitchUpdateFunc] = useState<string | undefined>();
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

    const layoutInputsDefined =
        typeof OTLtoShell !== "undefined" &&
        typeof tubeOD !== "undefined" &&
        typeof tubeClearance !== "undefined" &&
        typeof pitchRatio !== "undefined" &&
        typeof minTubes !== "undefined" &&
        OTLtoShell >= 0 &&
        tubeOD > 0 &&
        tubeClearance >= 0 &&
        pitchRatio >= 1 &&
        minTubes > 0 &&
        !isNaN(OTLtoShell) &&
        !isNaN(tubeOD) &&
        !isNaN(tubeClearance) &&
        !isNaN(pitchRatio) &&
        !isNaN(minTubes);

    const layoutOptionSelected = typeof layoutOption !== "undefined" && !isNaN(layoutOption);

    const calcLayoutResults = useCallback(() => {
        return {
            30: layoutInputsDefined
                ? new TubeSheet(OTLtoShell, tubeOD, pitchRatio, 30, minTubes)
                : null,
            45: layoutInputsDefined
                ? new TubeSheet(OTLtoShell, tubeOD, pitchRatio, 45, minTubes)
                : null,
            60: layoutInputsDefined
                ? new TubeSheet(OTLtoShell, tubeOD, pitchRatio, 60, minTubes)
                : null,
            90: layoutInputsDefined
                ? new TubeSheet(OTLtoShell, tubeOD, pitchRatio, 90, minTubes)
                : null,
            radial: layoutInputsDefined
                ? new TubeSheet(OTLtoShell, tubeOD, pitchRatio, "radial", minTubes)
                : null,
        };
    }, [layoutInputsDefined, OTLtoShell, tubeOD, pitchRatio, minTubes]);

    const callSetFunc = (name: string, value: string) => {
        const fn = stateFuncs[name as keyof typeof stateFuncs];

        if (typeof parseFloat(value) === "undefined") {
            return;
        } else if (fn) {
            fn(parseFloat(value.replace(",", "")));
        } else {
            console.error(`Function ${name} not found.`);
        }
    };

    const setPitchRatioFromTubeClearance = useCallback(
        (value: number) => {
            if (typeof value !== "undefined" && typeof tubeOD !== "undefined" && tubeOD !== 0) {
                setPitchRatio(1 + value / tubeOD);
            }
        },
        [tubeOD]
    );

    const setTubeClearanceFromPitchRatio = useCallback(
        (value: number) => {
            if (typeof value !== "undefined" && typeof tubeOD !== "undefined") {
                setTubeClearance((value - 1) * tubeOD);
            }
        },
        [tubeOD]
    );

    const onBlur = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(",", ""),
            name = e.target.name;
        switch (name) {
            case "tubeClearance":
                if (
                    typeof tubeClearance === "undefined" ||
                    tubeClearance === 0 ||
                    isNaN(tubeClearance)
                ) {
                    callSetFunc(`set${utils.capitalize(name)}`, val);
                    setPitchUpdateFunc("setPitchRatioFromTubeClearance");
                    setPitchRatioFromTubeClearance(parseFloat(val));
                    break;
                }
                if (typeof tubeClearance !== "undefined" && tubeClearance > 0) {
                    if (utils.trunc(tubeClearance, 2) !== parseFloat(val)) {
                        callSetFunc(`set${utils.capitalize(name)}`, val);
                        setPitchUpdateFunc("setPitchRatioFromTubeClearance");
                        break;
                    }
                }
                break;

            case "pitchRatio":
                if (typeof pitchRatio === "undefined" || pitchRatio === 0 || isNaN(pitchRatio)) {
                    callSetFunc(`set${utils.capitalize(name)}`, val);
                    setPitchUpdateFunc("setTubeClearanceFromPitchRatio");
                    setTubeClearanceFromPitchRatio(parseFloat(val));
                    break;
                }
                if (typeof pitchRatio !== "undefined" && pitchRatio > 0) {
                    if (utils.trunc(pitchRatio, 2) !== parseFloat(val)) {
                        callSetFunc(`set${utils.capitalize(name)}`, val);
                        setPitchUpdateFunc("setTubeClearanceFromPitchRatio");
                        break;
                    }
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

    useEffect(() => {
        if (typeof pitchUpdateFunc !== "undefined") {
            let value = tubeClearance;
            switch (pitchUpdateFunc) {
                case "setPitchRatioFromTubeClearance":
                    value = tubeClearance;
                    if (value !== undefined) {
                        setPitchRatioFromTubeClearance(value);
                    }
                    break;
                case "setTubeClearanceFromPitchRatio":
                    value = pitchRatio;
                    if (value !== undefined) {
                        setTubeClearanceFromPitchRatio(value);
                    }
                    break;
            }
            setLayoutResults(calcLayoutResults());
        }
    }, [
        tubeClearance,
        pitchRatio,
        tubeOD,
        pitchUpdateFunc,
        setPitchRatioFromTubeClearance,
        setTubeClearanceFromPitchRatio,
        calcLayoutResults,
        layoutInputsDefined,
    ]);

    useEffect(() => {
        let selectedLayout: TubeSheet | null = null;
        if (typeof layoutOption !== "undefined") {
            const parsedLayoutOption = (
                layoutOption === 0 ? "radial" : layoutOption
            ) as TubeSheet["layout"];
            if (typeof shellID !== "undefined" && shellID !== 0) {
                selectedLayout = layoutInputsDefined
                    ? new TubeSheet(
                          OTLtoShell,
                          tubeOD,
                          pitchRatio,
                          parsedLayoutOption,
                          undefined,
                          shellID
                      )
                    : null;
            }
        }
        if (selectedLayout && selectedLayout.numTubes) {
            setActualTubes(selectedLayout.numTubes);
        }
    }, [OTLtoShell, layoutInputsDefined, layoutOption, pitchRatio, shellID, tubeOD]);

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
                            id={"minTubes"}
                            name={"minTubes"}
                            type="text"
                            autoComplete="off"
                            placeholder="Minimum number of tubes (> 0)"
                            mask={Number}
                            scale={0}
                            min={0}
                            radix="."
                            thousandsSeparator=","
                            value={typeof minTubes === "undefined" ? "" : minTubes.toString()}
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
                            id={"tubeOD"}
                            name={"tubeOD"}
                            type="text"
                            autoComplete="off"
                            placeholder="Tube OD (> 0)"
                            mask={Number}
                            scale={2}
                            min={0}
                            radix={"."}
                            thousandsSeparator=","
                            value={typeof tubeOD === "undefined" ? "" : tubeOD.toString()}
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
                            value={typeof OTLtoShell === "undefined" ? "" : OTLtoShell.toString()}
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
                            value={
                                typeof tubeClearance === "undefined" ? "" : tubeClearance.toString()
                            }
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
                            id={"pitchRatio"}
                            name={"pitchRatio"}
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
                            value={typeof pitchRatio === "undefined" ? "" : pitchRatio.toString()}
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
                            id={"shellID"}
                            name={"shellID"}
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
                            value={typeof shellID === "undefined" ? "" : shellID.toString()}
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
                            value={typeof actualTubes === "undefined" ? "" : actualTubes.toString()}
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
                                <th>
                                    <label htmlFor="30deg">30°</label>
                                </th>
                                <th>
                                    <label htmlFor="45deg">45°</label>
                                </th>
                                <th>
                                    <label htmlFor="60deg">60°</label>
                                </th>
                                <th>
                                    <label htmlFor="90deg">90°</label>
                                </th>
                                <th>
                                    <label htmlFor="radial">Radial</label>
                                </th>
                                <th>Units</th>
                            </tr>
                            <tr>
                                <td>Min. ID</td>
                                <td>
                                    {layoutResults[30] && layoutResults[30].minID !== null
                                        ? utils.numFormat3SigFigs(layoutResults[30].minID)
                                        : null}
                                </td>
                                <td>
                                    {layoutResults[45] && layoutResults[45].minID !== null
                                        ? utils.numFormat3SigFigs(layoutResults[45].minID as number)
                                        : null}
                                </td>
                                <td>
                                    {layoutResults[60] && layoutResults[60].minID !== null
                                        ? utils.numFormat3SigFigs(layoutResults[60].minID as number)
                                        : null}
                                </td>
                                <td>
                                    {layoutResults[90] && layoutResults[90].minID !== null
                                        ? utils.numFormat3SigFigs(layoutResults[90].minID as number)
                                        : null}
                                </td>
                                <td>
                                    {layoutResults.radial && layoutResults.radial.minID !== null
                                        ? utils.numFormat3SigFigs(
                                              layoutResults.radial.minID as number
                                          )
                                        : null}
                                </td>
                                <td>mm</td>
                            </tr>
                            <tr>
                                <td>Tubes</td>
                                <td>
                                    {layoutResults[30]
                                        ? utils.numFormat3SigFigs(
                                              layoutResults[30].numTubes as number
                                          )
                                        : null}
                                </td>
                                <td>
                                    {layoutResults[45]
                                        ? utils.numFormat3SigFigs(
                                              layoutResults[45].numTubes as number
                                          )
                                        : null}
                                </td>
                                <td>
                                    {layoutResults[60]
                                        ? utils.numFormat3SigFigs(
                                              layoutResults[60].numTubes as number
                                          )
                                        : null}
                                </td>
                                <td>
                                    {layoutResults[90]
                                        ? utils.numFormat3SigFigs(
                                              layoutResults[90].numTubes as number
                                          )
                                        : null}
                                </td>
                                <td>
                                    {layoutResults.radial
                                        ? utils.numFormat3SigFigs(
                                              layoutResults.radial.numTubes as number
                                          )
                                        : null}
                                </td>
                                <td>mm</td>
                            </tr>
                            <tr>
                                <td>Selected</td>
                                <td>
                                    <input
                                        type="radio"
                                        id="30deg"
                                        name="layoutOption"
                                        value="30"
                                        onChange={onBlur}
                                        required
                                    ></input>
                                </td>
                                <td>
                                    <input
                                        type="radio"
                                        id="45deg"
                                        name="layoutOption"
                                        value="45"
                                        onChange={onBlur}
                                    ></input>
                                </td>
                                <td>
                                    <input
                                        type="radio"
                                        id="60deg"
                                        name="layoutOption"
                                        value="60"
                                        onChange={onBlur}
                                    ></input>
                                </td>
                                <td>
                                    <input
                                        type="radio"
                                        id="90deg"
                                        name="layoutOption"
                                        value="90"
                                        onChange={onBlur}
                                    ></input>
                                </td>
                                <td>
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
