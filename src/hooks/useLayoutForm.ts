import { useCallback, useEffect, useReducer, useState } from "react";
import type React from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent, SyntheticEvent } from "react";
import { TubeSheet } from "../plugins/tubesheet-layout-generator";
import { utils } from "../utils/";
import type { SingleResultPayload } from "./useTubeSheetWorker";

interface UseLayoutFormOptions {
    lastSingleResult: SingleResultPayload;
    postCalculateSingle: (payload: Record<string, unknown>) => void;
    postCalculateAll: (payload: Record<string, unknown>) => void;
}

// --- Field state -------------------------------------------------------

interface FieldValues {
    minTubes: number | undefined;
    tubeOD: number | undefined;
    OTLtoShell: number | undefined;
    tubeClearance: number | undefined;
    pitchRatio: number | undefined;
    shellID: number | undefined;
    actualTubes: number | undefined;
    layoutOption: number | undefined;
}

const initialFieldValues: FieldValues = {
    minTubes: undefined,
    tubeOD: undefined,
    OTLtoShell: undefined,
    tubeClearance: undefined,
    pitchRatio: undefined,
    shellID: undefined,
    actualTubes: undefined,
    layoutOption: undefined,
};

// Fields with no derived counterpart.
const genericFieldNames = [
    "minTubes",
    "tubeOD",
    "OTLtoShell",
    "shellID",
    "layoutOption",
    "actualTubes",
] as const;
type GenericFieldName = (typeof genericFieldNames)[number];
const isGenericFieldName = (name: string): name is GenericFieldName =>
    (genericFieldNames as readonly string[]).includes(name);

type FieldAction =
    | { type: "SET_FIELD"; field: GenericFieldName; value: number | undefined }
    | { type: "SET_TUBE_CLEARANCE"; value: number | undefined }
    | { type: "SET_PITCH_RATIO"; value: number | undefined };

// Distinguish absent override (use fallback) from explicit undefined (clear field)
// as ?? can't distinguish this difference.
function withOverride(
    overrides: Record<string, number | undefined> | undefined,
    key: string,
    fallback: number | undefined,
): number | undefined {
    return overrides && key in overrides ? overrides[key] : fallback;
}

// True if "next" rounds to the same displayed value (2dp) as a valid "prev".
const unchangedAtDisplayPrecision = (prev: number | undefined, next: number) =>
    utils.isNumber(prev) && prev > 0 && utils.trunc(prev, 2) === utils.trunc(next, 2);

function fieldsReducer(state: FieldValues, action: FieldAction): FieldValues {
    switch (action.type) {
        case "SET_FIELD":
            return { ...state, [action.field]: action.value };

        case "SET_TUBE_CLEARANCE": {
            if (!utils.isNumber(action.value)) {
                return { ...state, tubeClearance: undefined };
            }
            if (unchangedAtDisplayPrecision(state.tubeClearance, action.value)) {
                return state;
            }
            const pitchRatio =
                utils.isNumber(state.tubeOD) && state.tubeOD > 0
                    ? 1 + action.value / state.tubeOD
                    : state.pitchRatio;
            return { ...state, tubeClearance: action.value, pitchRatio };
        }

        case "SET_PITCH_RATIO": {
            if (!utils.isNumber(action.value)) {
                return { ...state, pitchRatio: undefined };
            }
            if (unchangedAtDisplayPrecision(state.pitchRatio, action.value)) {
                return state;
            }
            const tubeClearance = utils.isNumber(state.tubeOD)
                ? (action.value - 1) * state.tubeOD
                : state.tubeClearance;
            return { ...state, pitchRatio: action.value, tubeClearance };
        }

        default:
            return state;
    }
}

// --- Hook ----------------------------------------------------------------

// Owns every calculation input, validation, input handlers, and triggers
// worker recalculation on commit
export function useLayoutForm({
    lastSingleResult,
    postCalculateSingle,
    postCalculateAll,
}: UseLayoutFormOptions) {
    const [fields, dispatch] = useReducer(fieldsReducer, initialFieldValues);
    const [layoutInputsDefined, setLayoutInputsDefined] = useState<boolean>(false);
    const [layoutOptionSelected, setLayoutOptionSelected] = useState<boolean>(false);

    const setGenericField = useCallback((name: string, value: number | undefined) => {
        if (isGenericFieldName(name)) {
            dispatch({ type: "SET_FIELD", field: name, value });
        } else if (name === "tubeClearance") {
            dispatch({ type: "SET_TUBE_CLEARANCE", value });
        } else if (name === "pitchRatio") {
            dispatch({ type: "SET_PITCH_RATIO", value });
        } else {
            console.error(`Field "${name}" not found.`);
        }
    }, []);

    // Allow empty values via onAccept to avoid IMask reverting them.
    const onAcceptEmpty = (value: string, name: string) => {
        if (value.trim() === "") {
            setGenericField(name, undefined);
        }
    };

    const requestAllLayoutResults = useCallback(
        (
            overrides?: Partial<
                Pick<FieldValues, "OTLtoShell" | "tubeOD" | "pitchRatio" | "minTubes">
            >,
        ) => {
            const effOTLtoShell = withOverride(overrides, "OTLtoShell", fields.OTLtoShell);
            const effTubeOD = withOverride(overrides, "tubeOD", fields.tubeOD);
            const effPitchRatio = withOverride(overrides, "pitchRatio", fields.pitchRatio);
            const effMinTubes = withOverride(overrides, "minTubes", fields.minTubes);

            const valid =
                utils.isNumber(effOTLtoShell) &&
                utils.isNumber(effTubeOD) &&
                utils.isNumber(effPitchRatio) &&
                utils.isNumber(effMinTubes) &&
                effOTLtoShell >= 0 &&
                effTubeOD > 0 &&
                effPitchRatio >= 1 &&
                effMinTubes > 0;

            if (!valid) return;

            postCalculateAll({
                OTLtoShell: effOTLtoShell,
                tubeOD: effTubeOD,
                pitchRatio: effPitchRatio,
                minTubes: effMinTubes,
            });
        },
        [fields.OTLtoShell, fields.tubeOD, fields.pitchRatio, fields.minTubes, postCalculateAll],
    );

    const onBlur = (e: SyntheticEvent<HTMLInputElement>) => {
        const val = e.currentTarget.value.replace(",", "");
        const name = e.currentTarget.name;

        // Emptied field should stay empty
        if (val.trim() === "") {
            if (name === "shellID") {
                // Clearing shellID reverts to the min-tubes layout and recalculates
                // immediately.
                setGenericField(name, undefined);
                if (layoutInputsDefined && utils.isNumber(fields.layoutOption)) {
                    triggerSingleCalculation({ shellID: undefined });
                }
                return;
            }
            setGenericField(name, undefined);
            return;
        }

        if (!utils.isNumber(val)) {
            return;
        }
        const parsed = utils.stringToNumber(val);

        // tubeClearance/pitchRatio: derive the paired field and, if the
        // committed value actually changed, ask the worker to refresh every
        // layout option's preview with the new pitch.
        if (name === "tubeClearance") {
            const changed = !unchangedAtDisplayPrecision(fields.tubeClearance, parsed);
            dispatch({ type: "SET_TUBE_CLEARANCE", value: parsed });
            if (changed && utils.isNumber(fields.tubeOD) && fields.tubeOD > 0) {
                requestAllLayoutResults({ pitchRatio: 1 + parsed / fields.tubeOD });
            }
            return;
        }

        if (name === "pitchRatio") {
            const changed = !unchangedAtDisplayPrecision(fields.pitchRatio, parsed);
            dispatch({ type: "SET_PITCH_RATIO", value: parsed });
            if (changed && utils.isNumber(fields.tubeOD)) {
                requestAllLayoutResults({ pitchRatio: parsed });
            }
            return;
        }

        // shellID: recalculate on change commit
        if (name === "shellID") {
            const changed = fields.shellID !== parsed;
            setGenericField(name, parsed);
            if (changed && layoutInputsDefined && utils.isNumber(fields.layoutOption)) {
                triggerSingleCalculation({ shellID: parsed });
            }
            return;
        }

        setGenericField(name, parsed);
    };

    const inputOnSubmitHandler = (e: React.SubmitEvent<HTMLInputElement>) => {
        e.preventDefault();
    };

    // Helper to package and send single-layout calculation requests.
    const triggerSingleCalculation = useCallback(
        (overrides?: {
            overrideLayout?: number;
            OTLtoShell?: number;
            tubeOD?: number;
            pitchRatio?: number;
            minTubes?: number;
            shellID?: number;
        }) => {
            const effOTLtoShell = withOverride(overrides, "OTLtoShell", fields.OTLtoShell);
            const effTubeOD = withOverride(overrides, "tubeOD", fields.tubeOD);
            const effPitchRatio = withOverride(overrides, "pitchRatio", fields.pitchRatio);
            const effMinTubes = withOverride(overrides, "minTubes", fields.minTubes);
            const effShellID = withOverride(overrides, "shellID", fields.shellID);
            const effLayoutOption = withOverride(overrides, "overrideLayout", fields.layoutOption);

            const parsedLayoutOption = effLayoutOption === 0 ? "radial" : effLayoutOption;

            postCalculateSingle({
                OTLtoShell: effOTLtoShell,
                tubeOD: effTubeOD,
                pitchRatio: effPitchRatio,
                layoutOption: parsedLayoutOption,
                minTubes: utils.isNumber(effShellID) && effShellID !== 0 ? undefined : effMinTubes,
                shellID: utils.isNumber(effShellID) && effShellID !== 0 ? effShellID : undefined,
            });
        },
        [
            fields.OTLtoShell,
            fields.tubeOD,
            fields.pitchRatio,
            fields.minTubes,
            fields.shellID,
            fields.layoutOption,
            postCalculateSingle,
        ],
    );

    const formOnSubmitHandler = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        // Fallback: If form submits, trigger a single calc request
        if (utils.isNumber(fields.layoutOption) && layoutInputsDefined) {
            triggerSingleCalculation();
        }
    };

    // Handle Enter/Tab: commit field and trigger calc with snapshot.
    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== "Enter" && e.key !== "NumpadEnter" && e.key !== "Tab") {
            return;
        }

        if (e.key === "Enter" || e.key === "NumpadEnter") {
            e.preventDefault();
        }

        const name = e.currentTarget.name;
        const raw = e.currentTarget.value.replace(",", "");
        const committed = utils.isNumber(raw) ? utils.stringToNumber(raw) : undefined;

        const comparableValues: Record<string, number | undefined> = {
            minTubes: fields.minTubes,
            tubeOD: fields.tubeOD,
            OTLtoShell: fields.OTLtoShell,
            tubeClearance: fields.tubeClearance,
            pitchRatio: fields.pitchRatio,
            shellID: fields.shellID,
        };

        const currentValue = comparableValues[name];
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

        // onBlur above already commits shellID and triggers recalculation.
        // Avoid firing a second identical request here.
        if (name === "shellID") {
            return;
        }

        let nextPitchRatio = name === "pitchRatio" ? committed : fields.pitchRatio;
        let nextTubeClearance = name === "tubeClearance" ? committed : fields.tubeClearance;
        if (
            name === "tubeClearance" &&
            utils.isNumber(committed) &&
            utils.isNumber(fields.tubeOD) &&
            fields.tubeOD > 0
        ) {
            nextPitchRatio = 1 + committed / fields.tubeOD;
        } else if (
            name === "pitchRatio" &&
            utils.isNumber(committed) &&
            utils.isNumber(fields.tubeOD)
        ) {
            nextTubeClearance = (committed - 1) * fields.tubeOD;
        }

        // Nothing to recalculate if this field's value is unchanged.
        const next = {
            minTubes: name === "minTubes" ? committed : fields.minTubes,
            tubeOD: name === "tubeOD" ? committed : fields.tubeOD,
            OTLtoShell: name === "OTLtoShell" ? committed : fields.OTLtoShell,
            tubeClearance: nextTubeClearance,
            pitchRatio: nextPitchRatio,
            shellID: name === "shellID" ? committed : fields.shellID,
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

        if (!inputsValid || !utils.isNumber(fields.layoutOption)) {
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
    const onLayoutOptionChange = (e: ChangeEvent<HTMLInputElement>) => {
        onBlur(e);

        const rawValue = e.currentTarget.value;
        const parsedValue = utils.isNumber(rawValue) ? utils.stringToNumber(rawValue) : undefined;

        if (!utils.isNumber(parsedValue) || !layoutInputsDefined) {
            return;
        }

        triggerSingleCalculation({ overrideLayout: parsedValue });
    };

    const validateLayoutOption = useCallback(() => {
        setLayoutOptionSelected(utils.isNumber(fields.layoutOption));
    }, [fields.layoutOption]);

    const validateLayoutInputs = useCallback(() => {
        const valid =
            utils.isNumber(fields.OTLtoShell) &&
            utils.isNumber(fields.tubeOD) &&
            utils.isNumber(fields.tubeClearance) &&
            utils.isNumber(fields.pitchRatio) &&
            utils.isNumber(fields.minTubes) &&
            fields.OTLtoShell >= 0 &&
            fields.tubeOD > 0 &&
            fields.tubeClearance >= 0 &&
            fields.pitchRatio >= 1 &&
            fields.minTubes > 0;
        setLayoutInputsDefined(valid);
    }, [
        fields.OTLtoShell,
        fields.minTubes,
        fields.pitchRatio,
        fields.tubeClearance,
        fields.tubeOD,
    ]);

    // Validation
    useEffect(() => {
        validateLayoutInputs();
        validateLayoutOption();
    }, [validateLayoutInputs, validateLayoutOption]);

    // Actual tubes calculation only when layout option is selected and shell ID is defined
    useEffect(() => {
        if (!utils.isNumber(fields.layoutOption)) {
            return;
        }

        let selectedLayout: TubeSheet | null = null;

        const parsedLayoutOption = (
            fields.layoutOption === 0 ? "radial" : fields.layoutOption
        ) as TubeSheet["layout"];

        if (utils.isNumber(fields.shellID) && fields.shellID > 0) {
            selectedLayout = layoutInputsDefined
                ? new TubeSheet(
                      fields.OTLtoShell!,
                      fields.tubeOD!,
                      fields.pitchRatio!,
                      parsedLayoutOption,
                      undefined,
                      fields.shellID,
                  )
                : null;
        }

        if (selectedLayout && selectedLayout.numTubes) {
            dispatch({ type: "SET_FIELD", field: "actualTubes", value: selectedLayout.numTubes });
        }
    }, [
        fields.OTLtoShell,
        layoutInputsDefined,
        fields.layoutOption,
        fields.pitchRatio,
        fields.shellID,
        fields.tubeOD,
    ]);

    // If a SINGLE_RESULT came back for a custom shell ID, sync actual tubes to it.
    useEffect(() => {
        if (lastSingleResult?.shellID && lastSingleResult?.numTubes) {
            dispatch({
                type: "SET_FIELD",
                field: "actualTubes",
                value: lastSingleResult.numTubes,
            });
        } else if (lastSingleResult?.numTubes) {
            dispatch({
                type: "SET_FIELD",
                field: "actualTubes",
                value: undefined,
            });
        }
    }, [lastSingleResult]);

    return {
        // Field values
        minTubes: fields.minTubes,
        tubeOD: fields.tubeOD,
        OTLtoShell: fields.OTLtoShell,
        tubeClearance: fields.tubeClearance,
        pitchRatio: fields.pitchRatio,
        shellID: fields.shellID,
        actualTubes: fields.actualTubes,
        layoutOption: fields.layoutOption,
        // Validation
        layoutInputsDefined,
        layoutOptionSelected,
        // Handlers
        onAcceptEmpty,
        onBlur,
        onKeyDown,
        onLayoutOptionChange,
        formOnSubmitHandler,
        inputOnSubmitHandler,
        triggerSingleCalculation,
    };
}
