import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState } from "react";
import packageJson from "../package.json";
import GitHubButton from "react-github-btn";
import { TubeSheet, generateTubeSheetSVG, } from "./plugins/tubesheet-layout-generator";
import { TubeSheetSVG } from "./components/TubeSheetSVG";
import { NumericField } from "./components/NumericField";
import { utils } from "./utils/";
import ThemeToggle from "./components/DarkmodeToggle";
import { ContextMenu } from "./components/context-menu";
import StarIcon from "./assets/star.svg?react";
import GridIcon from "./assets/grid-icon.svg?react";
import SaveIcon from "./assets/save-icon.svg?react";
import CopyIcon from "./assets/copy-icon.svg?react";
import { useTubeSheetWorker } from "./hooks/useTubeSheetWorker";
import { useLayoutForm } from "./hooks/useLayoutForm";
import { useSvgExportActions } from "./hooks/useSvgExportActions";
import { useContextMenu } from "./hooks/useContextMenu";
const emptyTubeSheet = new TubeSheet(0, 100, 1, 30, undefined, 100);
const emptyData = {
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
// Layout options for displaying min ID and tube counts.
const layoutOptionRows = [
    { key: 30, id: "30deg", label: "30°", value: "30", required: true },
    { key: 45, id: "45deg", label: "45°", value: "45" },
    { key: 60, id: "60deg", label: "60°", value: "60" },
    { key: 90, id: "90deg", label: "90°", value: "90" },
    { key: "radial", id: "radial", label: "Radial", value: "0" },
];
const App = () => {
    // Worker lifecycle, calculation results, loading/error/status state.
    const { layoutResults, drawingSVG, lastSingleResult, isCalculating, showLoadingBadge, calcError, announcement, onDrawingRendered, postCalculateSingle, postCalculateAll, } = useTubeSheetWorker(placeholderSVG);
    // All calculation-input field state, validation, and input handlers.
    const { minTubes, tubeOD, OTLtoShell, tubeClearance, pitchRatio, shellID, actualTubes, layoutInputsDefined, layoutOptionSelected, onAcceptEmpty, onBlur, onKeyDown, onLayoutOptionChange, formOnSubmitHandler, inputOnSubmitHandler, } = useLayoutForm({ lastSingleResult, postCalculateSingle, postCalculateAll });
    // Copy-to-clipboard / download-as-file actions for the drawing.
    const { copyState, downloadSVG, copySVG } = useSvgExportActions(drawingSVG);
    // Show/hide grid state
    const [showGrid, setShowGrid] = useState(true);
    // Input fields
    const numericFieldConfigs = [
        {
            id: "minTubes",
            label: "Minimum number of tubes",
            placeholder: "e.g. 100",
            scale: 0,
            inputMode: "numeric",
            value: minTubes,
            required: true,
        },
        {
            id: "tubeOD",
            label: "Tube OD",
            placeholder: "> 0",
            scale: 2,
            inputMode: "decimal",
            value: tubeOD,
            required: true,
            units: "mm",
        },
        {
            id: "OTLtoShell",
            label: "OTL to shell diametrical clearance",
            placeholder: "Shell ID – OTL, ≥ 0",
            scale: 2,
            inputMode: "decimal",
            value: OTLtoShell,
            required: true,
            units: "mm",
        },
        {
            id: "tubeClearance",
            label: "Tube clearance",
            placeholder: "≥ 0",
            scale: 2,
            inputMode: "decimal",
            value: tubeClearance,
            required: true,
            units: "mm",
        },
        {
            id: "pitchRatio",
            label: "Pitch ratio",
            placeholder: "≥ 1",
            scale: 2,
            inputMode: "decimal",
            value: pitchRatio,
            required: true,
        },
        {
            id: "shellID",
            label: "Custom shell ID",
            placeholder: "Optional override",
            scale: 2,
            inputMode: "decimal",
            value: shellID,
            units: "mm",
        },
        {
            id: "actualTubes",
            label: "Actual number of tubes",
            placeholder: "Based on custom shell ID",
            scale: 0,
            inputMode: "numeric",
            value: actualTubes,
            calculated: true,
        },
    ];
    // Context menu
    const containerRef = useRef(null);
    const { contextMenuPos, contextMenuAnimationState, openContextMenu, requestClose, onAnimationEnd, } = useContextMenu(containerRef);
    const definedMinIDs = layoutOptionRows
        .map((row) => { var _a; return (_a = layoutResults[row.key]) === null || _a === void 0 ? void 0 : _a.minID; })
        .filter((v) => utils.isNumber(v));
    const minIDFloor = definedMinIDs.length ? Math.min(...definedMinIDs) : undefined;
    const minIDCeiling = definedMinIDs.length ? Math.max(...definedMinIDs) : undefined;
    // Convert minID to bar width percent (symlog scale, min 12%).
    const minIDBarLogPercent = (value) => {
        if (!utils.isNumber(value) || minIDFloor === undefined || minIDCeiling === undefined) {
            return 0;
        }
        if (minIDCeiling === minIDFloor) {
            return 100;
        }
        const c = 150;
        const logRatio = utils.symlog(value - minIDFloor, c) / utils.symlog(minIDCeiling - minIDFloor, c);
        return Math.max(12, 12 + logRatio * 88);
    };
    const handleContextMenuCopyAction = () => {
        copySVG();
        requestClose(); // Initiates the safe unmount fade out
    };
    const handleContextMenuSaveAction = () => {
        downloadSVG();
        requestClose(); // Initiates the safe unmount fade out
    };
    const menuConfig = [
        { label: "Copy Image", icon: _jsx(CopyIcon, {}), onClick: () => handleContextMenuCopyAction() },
        { label: "", isDivider: true, onClick: () => { } },
        { label: "Save Image", icon: _jsx(SaveIcon, {}), onClick: () => handleContextMenuSaveAction() },
    ];
    // JSX return
    return (_jsxs("div", { className: "row-pane", children: [_jsxs("form", { className: `column-pane left${showGrid ? "" : " grid-hidden"}`, onSubmit: formOnSubmitHandler, children: [_jsxs("div", { className: "title-block", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "Calculator & Visualiser for" }), _jsxs("h1", { children: ["Tubesheet Layouts", _jsxs("small", { className: "version-text", children: ["v", packageJson.version] }), _jsx("small", { children: "by Colin Tso" })] })] }), _jsx(ThemeToggle, {})] }), _jsx("hr", {}), _jsxs("div", { className: "form-scroll", children: [_jsxs("div", { className: "section", children: [_jsx("h2", { children: "Calculation Inputs" }), numericFieldConfigs.map((cfg) => (_jsx(NumericField, { ...cfg, readOnly: cfg.calculated || isCalculating, onBlur: cfg.calculated ? undefined : onBlur, onKeyDown: cfg.calculated ? undefined : onKeyDown, onAccept: cfg.calculated
                                            ? undefined
                                            : (value) => onAcceptEmpty(value, cfg.id), onSubmit: cfg.calculated ? undefined : inputOnSubmitHandler }, cfg.id)))] }), _jsx("div", { className: "divider" }), _jsxs("div", { className: "section", children: [_jsx("h2", { children: "Layout Options" }), _jsxs("div", { className: "layout-list-header", "aria-hidden": "true", children: [_jsx("span", {}), _jsx("span", {}), _jsx("span", {}), _jsxs("span", { className: "header-stats", children: [_jsx("span", { className: "header-minid", children: "ID (mm)" }), _jsx("span", { className: "header-tubes", children: "Tubes" })] })] }), _jsx("div", { className: "layout-list", role: "radiogroup", "aria-label": "Tube layout angle", "aria-busy": showLoadingBadge, children: layoutOptionRows.map(({ key, id, label, value, required }) => {
                                            const result = layoutResults[key];
                                            const minIDValue = result && result.minID !== null
                                                ? result.minID
                                                : undefined;
                                            return (_jsxs("label", { className: `layout-row ${(result === null || result === void 0 ? void 0 : result.preferred) ? "preferred" : ""}`, htmlFor: id, children: [_jsx("input", { type: "radio", id: id, name: "layoutOption", value: value, onChange: onLayoutOptionChange, disabled: showLoadingBadge, required: required }), _jsxs("span", { className: "row-angle", children: [label, (result === null || result === void 0 ? void 0 : result.preferred) && (_jsxs("span", { className: "row-badge", title: "Lowest minimum shell ID among the calculated layouts", children: [_jsx(StarIcon, { width: "10", height: "10", "aria-hidden": "true" }), _jsx("span", { className: "hidden", children: "Preferred layout (lowest minimum shell ID)" })] }))] }), _jsx("span", { className: "row-bar-track", "aria-hidden": "true", children: _jsx("span", { className: "row-bar-fill", style: {
                                                                width: `${minIDBarLogPercent(minIDValue)}%`,
                                                            } }) }), _jsxs("span", { className: "row-stats", children: [_jsx("span", { className: "row-minid", children: minIDValue !== undefined ? (utils.numFormat3SigFigs(minIDValue)) : (_jsx("span", { className: "empty", children: "\u2014" })) }), _jsxs("span", { className: "row-tubes", children: [result ? (utils.numFormat3SigFigs(result.numTubes)) : (_jsx("span", { className: "empty", children: "\u2014" })), " "] })] })] }, id));
                                        }) })] }), _jsx("button", { type: "submit", className: "generate-button", disabled: !layoutInputsDefined || !layoutOptionSelected || isCalculating, children: "Regenerate Drawing" })] }), _jsx("div", { className: "form-footer", children: _jsxs("footer", { children: [_jsx(GitHubButton, { href: "https://github.com/colin-tso/tubesheet-generator-react-app", "data-color-scheme": "light", "data-size": "large", "aria-label": " View this repo on GitHub", children: "View this repo on GitHub" }), _jsx("br", {}), "Released under a GPL 3.0 license.", " ", _jsxs("a", { href: "https://www.gnu.org/licenses/gpl-3.0.en.html", target: "_blank", rel: "noopener noreferrer", children: [_jsx("br", {}), "Find out more here."] })] }) })] }), _jsx("div", { className: "column-pane right", children: _jsxs("div", { className: `viewport ${showGrid ? "" : "grid-hidden"}`, ref: containerRef, onContextMenu: openContextMenu, children: [contextMenuAnimationState !== "idle" && (_jsx(ContextMenu, { position: contextMenuPos, parentRef: containerRef, items: menuConfig, animationState: contextMenuAnimationState === "fading-in"
                                ? "fading-in"
                                : "fading-out", onAnimationEnd: onAnimationEnd, onRequestClose: requestClose })), _jsx("span", { className: "viewport-label noselect", children: "Layout Preview" }), calcError ? (_jsx("span", { className: "loading-overlay error visible noselect", "aria-hidden": "true", children: "Calculation failed" })) : (_jsxs("span", { className: `loading-overlay noselect${showLoadingBadge ? " visible" : ""}`, "aria-hidden": "true", children: ["Calculating Layout", _jsxs("span", { className: "loading-dots", "aria-hidden": "true", children: [_jsx("span", {}), _jsx("span", {}), _jsx("span", {})] })] })), _jsx("span", { className: "hidden", role: "status", "aria-live": "polite", children: announcement }), _jsx("span", { className: "reg-tl", "aria-hidden": "true" }), _jsx("span", { className: "reg-tr", "aria-hidden": "true" }), _jsx("span", { className: "reg-bl", "aria-hidden": "true" }), _jsx("span", { className: "reg-br", "aria-hidden": "true" }), _jsxs("button", { type: "button", className: `grid-toggle ${showGrid ? "active" : ""}`, onClick: () => setShowGrid((v) => !v), "aria-pressed": showGrid, title: showGrid ? "Hide Grid" : "Show Grid", children: [_jsx(GridIcon, { width: "13", height: "13", "aria-hidden": "true" }), "Grid"] }), _jsx(TubeSheetSVG, { src: drawingSVG, className: "tubesheet-svg", onRendered: onDrawingRendered }), _jsxs("div", { className: "viewport-actions", hidden: drawingSVG === placeholderSVG, children: [_jsxs("button", { className: "copy-button", onClick: copySVG, type: "button", children: [_jsx(CopyIcon, { width: "15", height: "15", "aria-hidden": "true" }), copyState === "copied"
                                            ? "Copied!"
                                            : copyState === "error"
                                                ? "Copy failed"
                                                : copyState === "unsupported"
                                                    ? "Copy unsupported"
                                                    : "Copy Image"] }), _jsxs("button", { className: "save-button", onClick: downloadSVG, type: "button", children: [_jsx(SaveIcon, { width: "15", height: "15", "aria-hidden": "true" }), "Save Image"] })] })] }) })] }));
};
export default App;
