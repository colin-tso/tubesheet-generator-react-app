import { createContext, useContext } from "react";

// Which EqRef (if any) is currently hovered/focused, and the anchor element
// EquationPreview should position itself against. A single panel is shared
// across every EqRef in the docs — see EquationPreview.tsx — rather than each
// link owning its own popover, so only one can ever be open and there's one
// place to reason about positioning/dismissal.
export interface EquationPreviewState {
    id: string;
    anchor: HTMLElement;
}

export interface EquationPreviewContextValue {
    preview: EquationPreviewState | null;
    showPreview: (id: string, anchor: HTMLElement) => void;
    hidePreview: () => void;
}

export const EquationPreviewContext = createContext<EquationPreviewContextValue | null>(null);

export function useEquationPreview(): EquationPreviewContextValue {
    const ctx = useContext(EquationPreviewContext);
    if (!ctx) {
        throw new Error("useEquationPreview must be used within DocsRegistryProvider");
    }
    return ctx;
}
