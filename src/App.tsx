import React, { useCallback, useState, useEffect } from "react";
import GitHubButton from "react-github-btn";
import { IMaskInput } from "react-imask";
import { TubeSheet } from "./plugins/tubesheet-layout-generator";
import { TubeSheetSVG } from "./components/TubeSheetSVG";
import { utils } from "./utils/";
import ThemeToggle from "./components/DarkmodeToggle";
import "./index.css";

const emptySVG = document.createElementNS("http://www.w3.org/2000/svg", "svg");
emptySVG.setAttribute("viewBox", "1 1 1 1");

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
    // User system dark mode detection
    const [darkMode, setDarkMode] = useState(false);
    useEffect(() => {
        // Add listener to update styles
        window
            .matchMedia("(prefers-color-scheme: dark)")
            .addEventListener("change", (e) => setDarkMode(e.matches));

        // Setup dark/light mode for the first time
        setDarkMode(window.matchMedia("(prefers-color-scheme: dark)").matches);

        // Remove listener
        return () => {
            window
                .matchMedia("(prefers-color-scheme: dark)")
                .removeEventListener("change", () => {});
        };
    }, []);

    const formOnSubmitHandler = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (typeof layoutOption !== "undefined") {
            const parsedLayoutOption = layoutOption === 0 ? "radial" : layoutOption;
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
                setDrawingSVG(emptySVG);
            } else {
                setDrawingSVG(selectedLayout.svg);
            }
        }
    };

    const [minTubes, setMinTubes] = useState<number | undefined>();
    const [tubeOD, setTubeOD] = useState<number | undefined>();
    const [OTLtoShell, setOTLtoShell] = useState<number | undefined>();
    const [pitch, setPitch] = useState<number | undefined>();
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

    const [drawingSVG, setDrawingSVG] = useState<SVGSVGElement>(emptySVG);

    const stateFuncs = {
        setMinTubes,
        setTubeOD,
        setOTLtoShell,
        setPitch,
        setPitchRatio,
        setShellID,
        setActualTubes,
        setLayoutOption,
    };

    const layoutInputsDefined =
        typeof OTLtoShell !== "undefined" &&
        typeof tubeOD !== "undefined" &&
        typeof pitchRatio !== "undefined" &&
        typeof minTubes !== "undefined" &&
        OTLtoShell > 0 &&
        tubeOD > 0 &&
        pitchRatio >= 1 &&
        minTubes > 0 &&
        !isNaN(OTLtoShell) &&
        !isNaN(tubeOD) &&
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

    const setPitchRatioFromPitch = useCallback(
        (value: number) => {
            if (typeof value !== "undefined" && typeof tubeOD !== "undefined" && tubeOD !== 0) {
                setPitchRatio(1 + value / tubeOD);
            }
        },
        [tubeOD]
    );

    const setPitchFromPitchRatio = useCallback(
        (value: number) => {
            if (typeof value !== "undefined" && typeof tubeOD !== "undefined") {
                setPitch((value - 1) * tubeOD);
            }
        },
        [tubeOD]
    );

    const onBlur = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(",", ""),
            name = e.target.name;
        switch (name) {
            case "pitch":
                if (typeof pitch === "undefined" || pitch === 0 || isNaN(pitch)) {
                    callSetFunc(`set${utils.capitalize(name)}`, val);
                    setPitchUpdateFunc("setPitchRatioFromPitch");
                    setPitchRatioFromPitch(parseFloat(val));
                    break;
                }
                if (typeof pitch !== "undefined" && pitch > 0) {
                    if (utils.trunc(pitch, 2) !== parseFloat(val)) {
                        callSetFunc(`set${utils.capitalize(name)}`, val);
                        setPitchUpdateFunc("setPitchRatioFromPitch");
                        // setPitchRatioFromPitch(parseFloat(val));
                        break;
                    }
                }
                break;

            case "pitchRatio":
                if (typeof pitchRatio === "undefined" || pitchRatio === 0 || isNaN(pitchRatio)) {
                    callSetFunc(`set${utils.capitalize(name)}`, val);
                    setPitchUpdateFunc("setPitchFromPitchRatio");
                    setPitchFromPitchRatio(parseFloat(val));
                    break;
                }
                if (typeof pitchRatio !== "undefined" && pitchRatio > 0) {
                    if (utils.trunc(pitchRatio, 2) !== parseFloat(val)) {
                        callSetFunc(`set${utils.capitalize(name)}`, val);
                        setPitchUpdateFunc("setPitchFromPitchRatio");
                        // setPitchFromPitchRatio(parseFloat(val));
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
        downloadBlob(blob, `tubesheet.svg`);
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
            let value = pitch;
            switch (pitchUpdateFunc) {
                case "setPitchRatioFromPitch":
                    value = pitch;
                    if (value !== undefined) {
                        setPitchRatioFromPitch(value);
                    }
                    break;
                case "setPitchFromPitchRatio":
                    value = pitchRatio;
                    if (value !== undefined) {
                        setPitchFromPitchRatio(value);
                    }
                    break;
            }
            setLayoutResults(calcLayoutResults());
        }
    }, [
        pitch,
        pitchRatio,
        tubeOD,
        pitchUpdateFunc,
        setPitchRatioFromPitch,
        setPitchFromPitchRatio,
        calcLayoutResults,
        layoutInputsDefined,
    ]);

    useEffect(() => {
        let selectedLayout: TubeSheet | null = null;
        if (typeof layoutOption !== "undefined") {
            const parsedLayoutOption = layoutOption === 0 ? "radial" : layoutOption;
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
                    <table className="column-pane">
                        <tbody className="divider"></tbody>
                        <tbody>
                            <tr>
                                <td>
                                    <h2>Calculation Inputs</h2>
                                </td>
                            </tr>
                            <tr>
                                <td className="left-cell-label" colSpan={4}>
                                    <label htmlFor="minTubes">Minimum number of tubes:</label>
                                </td>
                                <td className="value-input" colSpan={1}>
                                    <IMaskInput
                                        id={"minTubes"}
                                        name={"minTubes"}
                                        type="text"
                                        autoComplete="off"
                                        placeholder=""
                                        mask={Number}
                                        scale={0}
                                        min={0}
                                        radix="."
                                        thousandsSeparator=","
                                        value={
                                            typeof minTubes === "undefined"
                                                ? ""
                                                : minTubes.toString()
                                        }
                                        onBlur={onBlur}
                                        onChange={(e) => {}}
                                        onSubmit={inputOnSubmitHandler}
                                        inputMode="numeric"
                                        required
                                    />
                                </td>
                                <td className="units"></td>
                                <td className="required-asterisk">*</td>
                            </tr>
                            <tr>
                                <td className="left-cell-label" colSpan={4}>
                                    <label htmlFor="tubeOD">Tube OD:</label>
                                </td>
                                <td className="value-input" colSpan={1}>
                                    <IMaskInput
                                        id={"tubeOD"}
                                        name={"tubeOD"}
                                        type="text"
                                        autoComplete="off"
                                        mask={Number}
                                        scale={2}
                                        min={0}
                                        radix={"."}
                                        thousandsSeparator=","
                                        value={
                                            typeof tubeOD === "undefined" ? "" : tubeOD.toString()
                                        }
                                        onBlur={onBlur}
                                        onChange={(e) => {}}
                                        onSubmit={inputOnSubmitHandler}
                                        inputMode="decimal"
                                        required
                                    />
                                </td>
                                <td className="units"> mm</td>
                                <td className="required-asterisk">*</td>
                            </tr>
                            <tr>
                                <td className="left-cell-label" colSpan={4}>
                                    <label htmlFor="OTLtoShell">
                                        OTL to shell diametrical clearance:
                                    </label>
                                </td>
                                <td className="value-input" colSpan={1}>
                                    <IMaskInput
                                        id="OTLtoShell"
                                        name="OTLtoShell"
                                        type="text"
                                        autoComplete="off"
                                        mask={Number}
                                        scale={2}
                                        min={0}
                                        radix={"."}
                                        thousandsSeparator=","
                                        onBlur={onBlur}
                                        onChange={(e) => {}}
                                        onSubmit={inputOnSubmitHandler}
                                        value={
                                            typeof OTLtoShell === "undefined"
                                                ? ""
                                                : OTLtoShell.toString()
                                        }
                                        inputMode="decimal"
                                        required
                                    />
                                </td>
                                <td className="units"> mm</td>
                                <td className="required-asterisk">*</td>
                            </tr>
                            <tr>
                                <td className="left-cell-label" colSpan={4}>
                                    <label htmlFor="pitch">Pitch:</label>
                                </td>
                                <td className="value-input" colSpan={1}>
                                    <IMaskInput
                                        id="pitch"
                                        name="pitch"
                                        type="text"
                                        autoComplete="off"
                                        mask={Number}
                                        scale={2}
                                        min={0}
                                        radix={"."}
                                        thousandsSeparator=","
                                        onBlur={onBlur}
                                        onChange={(e) => {}}
                                        onSubmit={inputOnSubmitHandler}
                                        value={typeof pitch === "undefined" ? "" : pitch.toString()}
                                        inputMode="decimal"
                                        required
                                    />
                                </td>
                                <td className="units"> mm</td>
                                <td className="required-asterisk">*</td>
                            </tr>
                            <tr>
                                <td className="left-cell-label" colSpan={4}>
                                    <label htmlFor="pitchRatio">Pitch ratio:</label>
                                </td>
                                <td className="value-input" colSpan={1}>
                                    <IMaskInput
                                        id={"pitchRatio"}
                                        name={"pitchRatio"}
                                        type="text"
                                        autoComplete="off"
                                        mask={Number}
                                        scale={2}
                                        min={0}
                                        radix={"."}
                                        thousandsSeparator=","
                                        onBlur={onBlur}
                                        onChange={(e) => {}}
                                        onSubmit={inputOnSubmitHandler}
                                        value={
                                            typeof pitchRatio === "undefined"
                                                ? ""
                                                : pitchRatio.toString()
                                        }
                                        inputMode="decimal"
                                        required
                                    />
                                </td>
                                <td></td>
                                <td className="required-asterisk">*</td>
                            </tr>
                            <tr>
                                <td className="left-cell-label" colSpan={4}>
                                    <label htmlFor="shellID">Custom Shell ID:</label>
                                </td>
                                <td className="value-input" colSpan={1}>
                                    <IMaskInput
                                        id={"shellID"}
                                        name={"shellID"}
                                        type="text"
                                        autoComplete="off"
                                        mask={Number}
                                        scale={2}
                                        min={0}
                                        radix={"."}
                                        thousandsSeparator=","
                                        onBlur={onBlur}
                                        onChange={(e) => {}}
                                        onSubmit={inputOnSubmitHandler}
                                        value={
                                            typeof shellID === "undefined" ? "" : shellID.toString()
                                        }
                                        inputMode="decimal"
                                    />
                                </td>
                                <td className="units"> mm</td>
                                <td></td>
                            </tr>
                            <tr>
                                <td className="left-cell-label" colSpan={4}>
                                    <label htmlFor="actualTubes">Actual number of tubes:</label>
                                </td>
                                <td className="value-input" colSpan={1}>
                                    <IMaskInput
                                        id={"actualTubes"}
                                        name={"actualTubes"}
                                        type="text"
                                        autoComplete="off"
                                        mask={Number}
                                        scale={0}
                                        min={0}
                                        radix={"."}
                                        thousandsSeparator=","
                                        value={
                                            typeof actualTubes === "undefined"
                                                ? ""
                                                : actualTubes.toString()
                                        }
                                        inputMode="numeric"
                                        readOnly
                                    />
                                </td>
                                <td className="units"> mm</td>
                                <td></td>
                            </tr>
                        </tbody>
                        <tbody className="divider"></tbody>
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
                                <td>{layoutResults[30] ? layoutResults[30].numTubes : null}</td>
                                <td>{layoutResults[45] ? layoutResults[45].numTubes : null}</td>
                                <td>{layoutResults[60] ? layoutResults[60].numTubes : null}</td>
                                <td>{layoutResults[90] ? layoutResults[90].numTubes : null}</td>
                                <td>
                                    {layoutResults.radial ? layoutResults.radial.numTubes : null}
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
                        <tbody className="divider"></tbody>
                    </table>
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
                        data-color-scheme={darkMode ? "light" : "dark"}
                        data-size="large"
                        aria-label=" View this repo on GitHub"
                        key={darkMode.toString()}
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
                    hidden={drawingSVG === emptySVG}
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
