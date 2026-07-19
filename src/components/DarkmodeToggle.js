import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import "./darkmode-toggle.css";
import "../index.css";
import MoonIcon from "../assets/moon.svg?react";
import SunIcon from "../assets/sun.svg?react";
const updateTheme = (isDarkEnabled) => {
    const docEl = document.documentElement;
    if (isDarkEnabled) {
        docEl.style.setProperty("color-scheme", "dark");
    }
    else {
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
                .removeEventListener("change", () => { });
        };
    }, []);
    useEffect(() => {
        updateTheme(isEnabled);
    }, [isEnabled]);
    const toggleState = () => {
        setIsEnabled((prevState) => !prevState);
    };
    return (_jsx("label", { className: "toggle-wrapper", htmlFor: "toggle", children: _jsxs("div", { className: `toggle ${isEnabled ? "enabled" : "disabled"}`, children: [_jsx("span", { className: "hidden", children: isEnabled ? "Enable Light Mode" : "Enable Dark Mode" }), _jsxs("div", { className: "icons", children: [_jsx(SunIcon, {}), _jsx(MoonIcon, {})] }), _jsx("input", { id: "toggle", name: "toggle", type: "checkbox", checked: isEnabled, onClick: toggleState, readOnly: true })] }) }));
}
