import React, { useCallback, useState, useEffect } from "react";
import { IMaskInput } from "react-imask";
import { TubeSheet } from "./plugins/tubesheet-layout-generator";
import { utils } from "./utils/";
import "./index.css";
import GitHubButton from "react-github-btn";
import ThemeToggle from "./components/DarkmodeToggle";

const App = () => {
    // dr.auto({});

    const formOnSubmitHandler = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        // alert(JSON.stringify(stateVars));
        if (typeof layoutOption !== "undefined") {
            const parsedLayoutOption = layoutOption === 0 ? "radial" : layoutOption;
            let selectedLayout: TubeSheet | null = null;
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

    const emptySVG = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const [drawingSVG, setDrawingSVG] = useState<SVGSVGElement>(emptySVG);

    const stateFuncs = {
        setMinTubes,
        setTubeOD,
        setOTLtoShell,
        setPitch,
        setPitchRatio,
        setShellID,
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
                        setPitchRatioFromPitch(parseFloat(val));
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
                        setPitchFromPitchRatio(parseFloat(val));
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

    return (
        <div className="row-pane">
            <form onSubmit={formOnSubmitHandler} className="column-pane left">
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
                                        typeof minTubes === "undefined" ? "" : minTubes.toString()
                                    }
                                    onBlur={onBlur}
                                    onChange={(e) => {}}
                                    onSubmit={inputOnSubmitHandler}
                                    required
                                />
                            </td>
                            <td></td>
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
                                    value={typeof tubeOD === "undefined" ? "" : tubeOD.toString()}
                                    onBlur={onBlur}
                                    onChange={(e) => {}}
                                    onSubmit={inputOnSubmitHandler}
                                    required
                                />
                            </td>
                            <td> mm</td>
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
                                    required
                                />
                            </td>
                            <td> mm</td>
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
                                    required
                                />
                            </td>
                            <td> mm</td>
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
                                    required
                                />
                            </td>
                            <td></td>
                            <td className="required-asterisk">*</td>
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
                                    ? utils.numFormat3SigFigs(layoutResults.radial.minID as number)
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
                            <td>{layoutResults.radial ? layoutResults.radial.numTubes : null}</td>
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
                    <tbody>
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
                                    value={typeof shellID === "undefined" ? "" : shellID.toString()}
                                />
                            </td>
                            <td> mm</td>
                        </tr>
                    </tbody>
                    <tbody className="divider"></tbody>
                </table>
                <button
                    type="submit"
                    disabled={!layoutInputsDefined || !layoutOptionSelected}
                    style={{
                        display: "block",
                        float: "right",
                        width: "fit-content",
                        padding: "2px 10px 2px 10px",
                        margin: "10px 0 10px 0",
                    }}
                >
                    Generate
                </button>
                <footer>
                    <GitHubButton
                        href="https://github.com/colin-tso"
                        data-color-scheme="dark;"
                        data-size="large"
                        aria-label=" View this repo on GitHub"
                    >
                        View this repo on GitHub
                    </GitHubButton>
                    <br />
                    This web app has been released under a GPL 3.0 license.{" "}
                    <a href="https://www.gnu.org/licenses/gpl-3.0.en.html">Find out more here.</a>
                </footer>
            </form>
            <div
                className="column-pane right"
                dangerouslySetInnerHTML={{ __html: drawingSVG.outerHTML }}
            />
        </div>
    );
};

export default App;
