import type { Ref } from "react";
import { useState } from "react";
import { getEffectiveShellID } from "../plugins/tubesheet-layout-generator";
import type { HighlightRegion } from "../hooks/useShellOTLHighlight";
import type { SingleResultPayload } from "../hooks/useTubeSheetWorker";
import { utils } from "../utils/";

interface ShellOTLTooltipProps {
    hovered: HighlightRegion;
    data: SingleResultPayload;
    ref?: Ref<HTMLDivElement>;
}

interface TooltipContent {
    label: string;
    value: number | null | undefined;
}

const formatMM = (value: number | null | undefined): string => {
    if (!utils.isNumber(value)) return "—";
    const rounded = utils.round(value as number, 2);
    return `${utils.numberWithCommas(rounded)} mm`;
};

export function ShellOTLTooltip({ hovered, data, ref }: ShellOTLTooltipProps) {
    const [content, setContent] = useState<TooltipContent>({ label: "", value: null });

    if (hovered && data) {
        const nextLabel = hovered === "shell" ? "Shell ID" : "OTL";
        const nextValue = hovered === "shell" ? getEffectiveShellID(data) : data.OTL;
        if (content.label !== nextLabel || content.value !== nextValue) {
            setContent({ label: nextLabel, value: nextValue });
        }
    }

    return (
        <div
            className={`region-tooltip noselect${hovered ? " visible" : ""}`}
            ref={ref}
            role="status"
            aria-live="polite"
            aria-hidden={!hovered}
        >
            <span className="region-tooltip-label">{content.label}</span>
            <span className="region-tooltip-value">{formatMM(content.value)}</span>
        </div>
    );
}

export default ShellOTLTooltip;
