import { forwardRef, useRef } from "react";
import { getEffectiveShellID } from "../plugins/tubesheet-layout-generator";
import type { HighlightRegion } from "../hooks/useShellOTLHighlight";
import type { SingleResultPayload } from "../hooks/useTubeSheetWorker";
import { utils } from "../utils/";

interface ShellOTLTooltipProps {
    hovered: HighlightRegion;
    data: SingleResultPayload;
}

const formatMM = (value: number | null | undefined): string => {
    if (!utils.isNumber(value)) return "—";
    const rounded = utils.round(value as number, 2);
    return `${utils.numberWithCommas(rounded)} mm`;
};

export const ShellOTLTooltip = forwardRef<HTMLDivElement, ShellOTLTooltipProps>(
    ({ hovered, data }, ref) => {
        const lastContent = useRef<{ label: string; value: number | null | undefined }>({
            label: "",
            value: null,
        });

        if (hovered && data) {
            lastContent.current = {
                label: hovered === "shell" ? "Shell ID" : "OTL",
                value: hovered === "shell" ? getEffectiveShellID(data) : data.OTL,
            };
        }

        const { label, value } = lastContent.current;

        return (
            <div
                className={`region-tooltip noselect${hovered ? " visible" : ""}`}
                ref={ref}
                role="status"
                aria-live="polite"
                aria-hidden={!hovered}
            >
                <span className="region-tooltip-label">{label}</span>
                <span className="region-tooltip-value">{formatMM(value)}</span>
            </div>
        );
    },
);
ShellOTLTooltip.displayName = "ShellOtlTooltip";

export default ShellOTLTooltip;
