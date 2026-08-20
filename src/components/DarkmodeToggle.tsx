import { useId } from "react";
import "./darkmode-toggle.css";
import "../index.css";
import MoonIcon from "@/assets/moon.svg?react";
import SunIcon from "@/assets/sun.svg?react";
import { useTheme } from "@/theme/ThemeContext";

export default function ThemeToggle() {
    // App and DocsPage each mount this component at the same time, so the
    // label/input pair needs a per-instance id — a shared literal id would make
    // the label activate whichever checkbox comes first in the DOM.
    const id = useId();

    const { state, actions } = useTheme();
    const isEnabled = state.isDarkEnabled;

    return (
        <label className="toggle-wrapper" htmlFor={id}>
            <div className={`toggle ${isEnabled ? "enabled" : "disabled"}`}>
                <span className="hidden">
                    {isEnabled ? "Enable Light Mode" : "Enable Dark Mode"}
                </span>
                <div className="icons">
                    <SunIcon />
                    <MoonIcon />
                </div>
                <input
                    id={id}
                    name="toggle"
                    type="checkbox"
                    checked={isEnabled}
                    onChange={actions.toggle}
                />
            </div>
        </label>
    );
}
