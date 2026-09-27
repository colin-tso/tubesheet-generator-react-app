import { useMemo, useRef } from "react";
import type { ReactNode, SubmitEvent } from "react";
import packageJson from "../package.json";
import { TubeSheet, generateTubeSheetSVG } from "@/plugins/tubesheet-layout-generator";
import type { ITubeSheetData } from "@/plugins/tubesheet-layout-generator";
import { NumericField } from "@/components/NumericField";
import { PairedFieldRow } from "@/components/PairedFieldRow";
import { utils } from "@/utils/";
import ThemeToggle from "@/components/DarkmodeToggle";
import { useTubeSheetWorker } from "@/hooks/useTubeSheetWorker";
import { useLayoutForm } from "@/hooks/useLayoutForm";
import { useAutoHideHeader } from "@/hooks/useAutoHideHeader";
import { LayoutOptionsList } from "@/components/LayoutOptionsList";
import { ShellSweepPanel } from "@/components/ShellSweepPanel";
import { FormFooter } from "@/components/FormFooter";
import { Viewport } from "@/components/viewport/Viewport";
import { useViewportContext } from "@/components/viewport/ViewportContext";
import { numericFieldConfigs } from "@/constants/numericFieldConfigs";
import type { NumericFieldConfig } from "@/constants/numericFieldConfigs";
import { layoutOptionRows } from "@/constants/layoutOptionRows";

// --- Static config computation ---
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

// Must match .viewport's base padding in index.css (desktop breakpoint).
const VIEWPORT_BASE_PADDING = 48;

// Cluster consecutive field configs that share a "row" id.
const numericFieldRows: NumericFieldConfig[][] = numericFieldConfigs.reduce<NumericFieldConfig[][]>(
    (rows, cfg) => {
        const lastRow = rows[rows.length - 1];
        if (cfg.row && lastRow?.[0]?.row === cfg.row) {
            lastRow.push(cfg);
        } else {
            rows.push([cfg]);
        }
        return rows;
    },
    [],
);

// Further cluster consecutive field-rows that share a "group" label.
interface NumericFieldGroup {
    label: string | undefined;
    rows: NumericFieldConfig[][];
}
const numericFieldGroups: NumericFieldGroup[] = numericFieldRows.reduce<NumericFieldGroup[]>(
    (groups, row) => {
        const groupLabel = row[0]?.group;
        const lastGroup = groups[groups.length - 1];
        if (lastGroup?.label === groupLabel) {
            lastGroup.rows.push(row);
        } else {
            groups.push({ label: groupLabel, rows: [row] });
        }
        return groups;
    },
    [],
);

// Applies the wait cursor app-wide while a worker calculation or clipboard copy
// is in flight. Reads viewport state via context so it can sit above both the
// form and the viewport without either needing an "isBusy" prop.
//
// data-mobile-view drives which of .left/.right/.form-footer is visible at
// the mobile breakpoint (see index.css) -- unused at desktop widths, where
// both panes are always shown side by side regardless of its value.
function BusyRow({ children }: { children: ReactNode }) {
    const { state } = useViewportContext();
    return (
        <div
            className={`row-pane${state.isBusy ? " app-busy" : ""}`}
            data-mobile-view={state.mobileActiveView}
        >
            {children}
        </div>
    );
}

// Mobile-only tab bar switching between the Form and Drawing panes (see
// data-mobile-view above). Hidden via CSS at desktop widths, where both
// panes are already visible side by side and no switching is needed.
// Neither pane ever unmounts when hidden -- this only toggles CSS display --
// so the live preview keeps calculating in the background even while the
// Drawing pane isn't the one currently shown.
function MobileViewTabs() {
    const { state, actions } = useViewportContext();
    return (
        <div className="mobile-view-tabs" data-no-context-menu>
            <button
                type="button"
                className={`mobile-view-tab${state.mobileActiveView === "form" ? " active" : ""}`}
                aria-pressed={state.mobileActiveView === "form"}
                onClick={() => actions.setMobileActiveView("form")}
            >
                Form
            </button>
            <button
                type="button"
                className={`mobile-view-tab${
                    state.mobileActiveView === "drawing" ? " active" : ""
                }`}
                aria-pressed={state.mobileActiveView === "drawing"}
                onClick={() => actions.setMobileActiveView("drawing")}
            >
                Drawing
            </button>
        </div>
    );
}

// The input form's background grid follows the same showGrid preference as the
// viewport, so it also reads state from context rather than a prop.
function FormPane({
    children,
    onSubmit,
}: {
    children: ReactNode;
    onSubmit: (e: SubmitEvent<HTMLFormElement>) => void;
}) {
    const { state, actions } = useViewportContext();
    return (
        <form
            className={`column-pane left${state.showGrid ? "" : " grid-hidden"}`}
            onSubmit={(e) => {
                onSubmit(e);
                // Mobile only in effect (see .row-pane's data-mobile-view in
                // index.css) -- desktop shows both panes at once already, so
                // this is a harmless no-op there. Jumping to the Drawing tab
                // on submit keeps the "type a value, see the result" feel
                // the live-preview experience already has on desktop, rather
                // than leaving the person to notice and tap over manually.
                actions.setMobileActiveView("drawing");
            }}
        >
            {children}
        </form>
    );
}

// --- App component ---
const App = () => {
    // Worker lifecycle, calculation results, loading/error/status state.
    const worker = useTubeSheetWorker(placeholderSVG);
    const { layoutResults, lastSingleResult, isCalculating, showLoadingBadge } = worker;

    // All calculation-input field state, validation, and input handlers.
    const {
        minTubes,
        tubeOD,
        OTLtoShell,
        tubeClearance,
        pitchRatio,
        shellID,
        layoutOption,
        layoutInputsDefined,
        layoutOptionSelected,
        onAcceptEmpty,
        onBlur,
        onKeyDown,
        onLayoutOptionChange,
        formOnSubmitHandler,
        inputOnSubmitHandler,
        applyShellID,
        loadFields,
    } = useLayoutForm({
        lastSingleResult,
        postCalculateSingle: worker.postCalculateSingle,
        postCalculateAll: worker.postCalculateAll,
    });

    // Input field current values, keyed to match numericFieldConfigs ids.
    const fieldValues: Record<string, number | undefined> = {
        minTubes,
        tubeOD,
        OTLtoShell,
        tubeClearance,
        pitchRatio,
        shellID,
    };

    // Snapshot of every save/load/share-able input, memoized on the primitive
    // fields themselves (not `fieldValues` above, which is a fresh object
    // every render) so passing it down to Viewport.Provider doesn't force a
    // new identity -- and therefore a ViewportContext recompute -- on every
    // render.
    const layoutConfig = useMemo(
        () => ({
            minTubes,
            tubeOD,
            OTLtoShell,
            tubeClearance,
            pitchRatio,
            shellID,
            layoutOption,
        }),
        [minTubes, tubeOD, OTLtoShell, tubeClearance, pitchRatio, shellID, layoutOption],
    );

    // Drawing table label/requested-tube count for the current committed
    // layout.
    const drawingTableLabel =
        layoutOptionRows.find((row) => row.key === lastSingleResult?.layout)?.label ?? "—";
    const drawingTableRequestedTubes = utils.isNumber(shellID) ? undefined : minTubes;

    // .form-pane-group is display:contents on desktop (a no-op wrapper, so
    // it never scrolls there) and the actual scrolling element on mobile,
    // where .title-block sits sticky at its top -- see useAutoHideHeader and
    // .form-pane-group/.title-block in index.css.
    const formScrollRef = useRef<HTMLDivElement>(null);
    const titleBlockHidden = useAutoHideHeader(formScrollRef);

    // JSX return
    return (
        <Viewport.Provider
            worker={worker}
            placeholderSVG={placeholderSVG}
            drawingTableLabel={drawingTableLabel}
            drawingTableRequestedTubes={drawingTableRequestedTubes}
            basePadding={VIEWPORT_BASE_PADDING}
            layoutConfig={layoutConfig}
            onLoadLayoutConfig={loadFields}
        >
            <BusyRow>
                <div className="form-pane-group" ref={formScrollRef}>
                    <FormPane onSubmit={formOnSubmitHandler}>
                        <div
                            className={`title-block${titleBlockHidden ? " title-block-hidden" : ""}`}
                        >
                            <div>
                                <span className="eyebrow">Calculator & Visualiser for</span>
                                <h1>
                                    Tubesheet Layouts
                                    <small className="version-text">v{packageJson.version}</small>
                                    <small>by Colin Tso</small>
                                </h1>
                            </div>
                            <ThemeToggle />
                        </div>
                        <div className="form-scroll">
                            <div className="section">
                                <h2>Calculation Inputs</h2>
                                <div className="field-group-stack">
                                    {numericFieldGroups.map((group) => (
                                        <div
                                            className="field-group-card"
                                            key={group.label ?? group.rows[0]?.[0]?.id}
                                        >
                                            {group.label && (
                                                <h3 className="field-group-title">
                                                    {group.label}
                                                    {group.rows.length === 1 &&
                                                        group.rows[0].length === 2 &&
                                                        group.rows[0].some(
                                                            (cfg) => cfg.required,
                                                        ) && (
                                                            <span className="required-asterisk">
                                                                *
                                                            </span>
                                                        )}
                                                </h3>
                                            )}
                                            {group.rows.map((row) => {
                                                if (row.length === 1) {
                                                    const cfg = row[0];
                                                    return (
                                                        <NumericField
                                                            key={cfg.id}
                                                            {...cfg}
                                                            value={fieldValues[cfg.id]}
                                                            pairedValue={
                                                                cfg.pairedWith
                                                                    ? fieldValues[cfg.pairedWith]
                                                                    : undefined
                                                            }
                                                            readOnly={
                                                                cfg.calculated || isCalculating
                                                            }
                                                            onBlur={
                                                                cfg.calculated ? undefined : onBlur
                                                            }
                                                            onKeyDown={
                                                                cfg.calculated
                                                                    ? undefined
                                                                    : onKeyDown
                                                            }
                                                            onAccept={
                                                                cfg.calculated
                                                                    ? undefined
                                                                    : (value) =>
                                                                          onAcceptEmpty(
                                                                              value,
                                                                              cfg.id,
                                                                          )
                                                            }
                                                            onSubmit={
                                                                cfg.calculated
                                                                    ? undefined
                                                                    : inputOnSubmitHandler
                                                            }
                                                        />
                                                    );
                                                }

                                                return (
                                                    <PairedFieldRow
                                                        key={row.map((cfg) => cfg.id).join("-")}
                                                        row={row}
                                                        fieldValues={fieldValues}
                                                        layoutOption={layoutOption}
                                                        committedResult={lastSingleResult}
                                                        isCalculating={isCalculating}
                                                        onBlur={onBlur}
                                                        onKeyDown={onKeyDown}
                                                        onAcceptEmpty={onAcceptEmpty}
                                                        inputOnSubmitHandler={inputOnSubmitHandler}
                                                        requestSingle={worker.requestSingle}
                                                    />
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <LayoutOptionsList
                                rows={layoutOptionRows}
                                layoutResults={layoutResults}
                                showLoadingBadge={showLoadingBadge}
                                onLayoutOptionChange={onLayoutOptionChange}
                                selectedLayoutOption={layoutOption}
                            />
                            <ShellSweepPanel
                                OTLtoShell={OTLtoShell}
                                tubeOD={tubeOD}
                                pitchRatio={pitchRatio}
                                layoutOption={layoutOption}
                                layoutInputsDefined={layoutInputsDefined}
                                layoutOptionSelected={layoutOptionSelected}
                                centerShellID={
                                    lastSingleResult?.shellID ??
                                    lastSingleResult?.minID ??
                                    undefined
                                }
                                currentNumTubes={lastSingleResult?.numTubes ?? undefined}
                                requestSweep={worker.requestSweep}
                                onApplyShellID={applyShellID}
                            />
                            {/* Disabled while a calculation is in flight */}
                            <button
                                type="submit"
                                className="focus-ring generate-button"
                                disabled={
                                    !layoutInputsDefined || !layoutOptionSelected || isCalculating
                                }
                            >
                                Regenerate Drawing
                            </button>
                        </div>
                    </FormPane>
                    {/* A sibling of .left, both grouped under .form-pane-group
                        (hidden together on mobile's Drawing tab -- see
                        .row-pane's data-mobile-view in index.css). */}
                    <FormFooter />
                </div>
                <Viewport.Frame>
                    <Viewport.ContextMenu />
                    <Viewport.Toolbar />
                    <Viewport.DocsButton />
                    <Viewport.Drawing />
                    <Viewport.Footer>
                        <Viewport.Table />
                        <Viewport.ExportActions />
                    </Viewport.Footer>
                </Viewport.Frame>
                <MobileViewTabs />
            </BusyRow>
        </Viewport.Provider>
    );
};

export default App;
