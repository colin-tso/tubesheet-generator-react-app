import { utils } from "../utils";
import type { LivePreviewRequest, LivePreviewResult } from "../hooks/useLivePreview";

// Bag of current field values (plus layoutOption) previews are computed from.
export type PairPreviewContext = Record<string, number | undefined>;

// Last committed calculation result; fallback for the worker-driven size row.
export interface CommittedSizeResult {
    minID: number | null;
    numTubes: number | null;
}

// Dependent value needs the tubesheet worker (e.g. minTubes <-> shellID has no closed-form inverse).
export interface WorkerPairPreviewConfig {
    kind: "worker";
    isReady: (ctx: PairPreviewContext) => boolean;
    buildRequest: (
        fieldId: string,
        parsedValue: number,
        ctx: PairPreviewContext,
    ) => LivePreviewRequest;
    extractResult: (fieldId: string, result: LivePreviewResult | null) => number | undefined;
    fallbackFromCommitted: (
        fieldId: string,
        ctx: PairPreviewContext,
        committedResult: CommittedSizeResult | null | undefined,
    ) => number | undefined;
}

// Dependent value is a pure synchronous formula (e.g. tubeClearance <-> pitchRatio via tubeOD).
export interface FormulaPairPreviewConfig {
    kind: "formula";
    compute: (fieldId: string, parsedValue: number, ctx: PairPreviewContext) => number | undefined;
}

export type PairPreviewConfig = WorkerPairPreviewConfig | FormulaPairPreviewConfig;

// Keyed by NumericFieldConfig.row. Rows absent here have no live preview.
export const pairPreviewConfigs: Record<string, PairPreviewConfig> = {
    "minTubes-shellID": {
        kind: "worker",
        isReady: (ctx) =>
            utils.isNumber(ctx.OTLtoShell) &&
            (ctx.OTLtoShell as number) >= 0 &&
            utils.isNumber(ctx.tubeOD) &&
            (ctx.tubeOD as number) > 0 &&
            utils.isNumber(ctx.pitchRatio) &&
            (ctx.pitchRatio as number) >= 1,
        buildRequest: (fieldId, parsedValue, ctx) => ({
            OTLtoShell: ctx.OTLtoShell as number,
            tubeOD: ctx.tubeOD as number,
            pitchRatio: ctx.pitchRatio as number,
            layoutOption: utils.isNumber(ctx.layoutOption) ? (ctx.layoutOption as number) : 30,
            minTubes: fieldId === "minTubes" ? parsedValue : undefined,
            shellID: fieldId === "shellID" ? parsedValue : undefined,
        }),
        extractResult: (fieldId, result) => {
            if (fieldId === "shellID") return result?.shellID;
            if (fieldId === "minTubes") return result?.numTubes;
            return undefined;
        },
        fallbackFromCommitted: (fieldId, ctx, committedResult) => {
            if (
                fieldId === "shellID" &&
                utils.isNumber(ctx.minTubes) &&
                utils.isNumber(committedResult?.minID)
            ) {
                return committedResult!.minID as number;
            }
            if (
                fieldId === "minTubes" &&
                utils.isNumber(ctx.shellID) &&
                utils.isNumber(committedResult?.numTubes)
            ) {
                return committedResult!.numTubes as number;
            }
            return undefined;
        },
    },
    "clearance-pitch": {
        kind: "formula",
        compute: (fieldId, parsedValue, ctx) =>
            fieldId === "tubeClearance"
                ? utils.pitchRatioFromClearance(ctx.tubeOD, parsedValue)
                : utils.clearanceFromPitchRatio(ctx.tubeOD, parsedValue),
    },
};
