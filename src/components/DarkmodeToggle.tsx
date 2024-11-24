import React, { useState, useEffect } from "react";
import "./darkmode-toggle.css";
import "../index.css";
import { ReactComponent as MoonIcon } from "../assets/moon.svg";
import { ReactComponent as SunIcon } from "../assets/sun.svg";

const updateTheme = (isDarkEnabled: Boolean) => {
    const docEl = document.documentElement;
    if (isDarkEnabled) {
        docEl.style.setProperty("color-scheme", "dark");
    } else {
        docEl.style.setProperty("color-scheme", "light");
    }
};

export default function ThemeToggle() {
    const [isEnabled, setIsEnabled] = useState(false);

    // User system dark mode detection
    useEffect(() => {
        // Add listener to update styles
        window
            .matchMedia("(prefers-color-scheme: dark)")
            .addEventListener("change", (e) => setIsEnabled(e.matches));

        // Setup dark/light mode for the first time
        setIsEnabled(window.matchMedia("(prefers-color-scheme: dark)").matches);

        // Remove listener
        return () => {
            window
                .matchMedia("(prefers-color-scheme: dark)")
                .removeEventListener("change", () => {});
        };
    }, []);

    useEffect(() => {
        updateTheme(isEnabled);
    }, [isEnabled]);

    const toggleState = () => {
        setIsEnabled((prevState) => !prevState);
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
