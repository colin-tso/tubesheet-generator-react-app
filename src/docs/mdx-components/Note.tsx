import type { ReactNode } from "react";
import InfoIcon from "@/assets/info-icon.svg?react";

export function Note({ children }: { children: ReactNode }) {
    return (
        <div className="docs-note">
            <div className="docs-note-header">
                <InfoIcon width="16" height="16" aria-hidden="true" />
                <span>Note</span>
            </div>
            {children}
        </div>
    );
}
