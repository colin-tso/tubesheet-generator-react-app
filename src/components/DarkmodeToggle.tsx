import React, { useState, useEffect } from "react";
import "./styles.css";
import { ReactComponent as MoonIcon } from "../assets/moon.svg";
import { ReactComponent as SunIcon } from "../assets/sun.svg";

const updateTheme = (isDarkEnabled: Boolean) => {
    const docEl = document.documentElement;
    if (isDarkEnabled) {
        docEl.style.setProperty("--invert", "1");
        docEl.style.setProperty("--hue", "180deg");
    } else {
        docEl.style.setProperty("--invert", "0");
        docEl.style.setProperty("--hue", "0deg");
    }
};

export default function ThemeToggle() {
    const [isEnabled, setIsEnabled] = useState(false);

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
                />
            </div>
        </label>
    );
}
