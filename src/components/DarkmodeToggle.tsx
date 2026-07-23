import React, { useState, useEffect } from "react";
import "./darkmode-toggle.css";
import "../index.css";
import MoonIcon from "../assets/moon.svg?react";
import SunIcon from "../assets/sun.svg?react";

const THEME_STORAGE_KEY = "theme-preference";

const updateTheme = (isDarkEnabled: Boolean) => {
    const docEl = document.documentElement;
    docEl.setAttribute("data-theme", isDarkEnabled ? "dark" : "light");
    docEl.style.setProperty("color-scheme", isDarkEnabled ? "dark" : "light");
};

export default function ThemeToggle() {
    // Initialize from localStorage if present, otherwise fall back to system preference
    const [isEnabled, setIsEnabled] = useState<boolean>(() => {
        const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === "dark") return true;
        if (stored === "light") return false;
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
    });

    // Only follow system dark mode changes if the user hasn't set an explicit preference
    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = (e: MediaQueryListEvent) => {
            if (window.localStorage.getItem(THEME_STORAGE_KEY) === null) {
                setIsEnabled(e.matches);
            }
        };
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);

    useEffect(() => {
        updateTheme(isEnabled);
    }, [isEnabled]);

    const toggleState = () => {
        setIsEnabled((prevState) => {
            const next = !prevState;
            window.localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
            return next;
        });
    };

    return (
        <label className="toggle-wrapper" htmlFor="toggle">
            <div className={`toggle ${isEnabled ? "enabled" : "disabled"}`}>
                <span className="hidden">
                    {isEnabled ? "Enable Light Mode" : "Enable Dark Mode"}
                </span>
                <div className="icons">
                    <SunIcon />
                    <MoonIcon />
                </div>
                <input
                    id="toggle"
                    name="toggle"
                    type="checkbox"
                    checked={isEnabled}
                    onClick={toggleState}
                    readOnly
                />
            </div>
        </label>
    );
}
