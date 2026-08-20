import { createContext, use } from "react";

export interface ThemeState {
    isDarkEnabled: boolean;
}

export interface ThemeActions {
    toggle: () => void;
}

export interface ThemeContextValue {
    state: ThemeState;
    actions: ThemeActions;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
    const context = use(ThemeContext);
    if (context === null) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
}