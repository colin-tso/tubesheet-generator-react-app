import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ThemeContext } from "./ThemeContext";
import type { ThemeContextValue } from "./ThemeContext";

const THEME_STORAGE_KEY = "theme-preference";

const THEME_COLOR_LIGHT = "#F9F8F6";
const THEME_COLOR_DARK = "#10161E";

const updateTheme = (isDarkEnabled: boolean) => {
    const docEl = document.documentElement;
    docEl.setAttribute("data-theme", isDarkEnabled ? "dark" : "light");
    docEl.style.setProperty("color-scheme", isDarkEnabled ? "dark" : "light");

    const meta = document.getElementById("theme-color-meta");
    if (meta) {
        meta.setAttribute("content", isDarkEnabled ? THEME_COLOR_DARK : THEME_COLOR_LIGHT);
    }
};

const readStoredPreference = (): "dark" | "light" | null => {
    try {
        const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
        return stored === "dark" || stored === "light" ? stored : null;
    } catch {
        return null;
    }
};

// Single source of truth for the app theme. App and DocsPage stay mounted
// simultaneously (see Root.tsx) and each renders its own DarkmodeToggle, so
// the value must live here rather than inside either toggle's own state —
// otherwise the two instances would drift out of sync with each other.
export function ThemeProvider({ children }: { children: ReactNode }) {
    const [isDarkEnabled, setIsDarkEnabled] = useState<boolean>(() => {
        const stored = readStoredPreference();
        if (stored === "dark") return true;
        if (stored === "light") return false;
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
    });

    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = (e: MediaQueryListEvent) => {
            if (readStoredPreference() === null) {
                setIsDarkEnabled(e.matches);
            }
        };
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);

    useEffect(() => {
        updateTheme(isDarkEnabled);
    }, [isDarkEnabled]);

    const toggle = useCallback(() => {
        setIsDarkEnabled((prev) => {
            const next = !prev;
            try {
                window.localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
            } catch {
                // localStorage can throw in private browsing or when quota is
                // exceeded; the in-memory theme still applies.
            }
            return next;
        });
    }, []);

    const value = useMemo<ThemeContextValue>(
        () => ({ state: { isDarkEnabled }, actions: { toggle } }),
        [isDarkEnabled, toggle],
    );

    return <ThemeContext value={value}>{children}</ThemeContext>;
}