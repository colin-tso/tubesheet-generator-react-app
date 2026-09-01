import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
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

// Subscribe to OS color-scheme changes via useSyncExternalStore. The snapshot
// returns the raw OS preference; the override from useState is layered on top
// in the component body.
function subscribeOsTheme(callback: () => void): () => void {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", callback);
    return () => mq.removeEventListener("change", callback);
}

function getOsTheme(): boolean {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Single source of truth for the app theme. App and DocsPage stay mounted
// simultaneously (see Root.tsx) and each renders its own DarkmodeToggle, so
// the value must live here rather than inside either toggle's own state —
// otherwise the two instances would drift out of sync with each other.
export function ThemeProvider({ children }: { children: ReactNode }) {
    // User override (non-null wins over OS pref). Null means "follow OS".
    const [override, setOverride] = useState<"dark" | "light" | null>(() =>
        readStoredPreference(),
    );

    // Subscribe to OS preference changes without a manual useEffect listener.
    const osDark = useSyncExternalStore(subscribeOsTheme, getOsTheme, getOsTheme);

    // User override takes precedence; otherwise follow the OS.
    const isDarkEnabled = override !== null ? override === "dark" : osDark;

    useEffect(() => {
        updateTheme(isDarkEnabled);
    }, [isDarkEnabled]);

    const toggle = useCallback(() => {
        setOverride((prev) => {
            const next = prev === "dark" ? "light" : "dark";
            try {
                window.localStorage.setItem(THEME_STORAGE_KEY, next);
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