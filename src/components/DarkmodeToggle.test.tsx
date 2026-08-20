import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@/theme/ThemeProvider";
import ThemeToggle from "./DarkmodeToggle";

beforeEach(() => {
    window.localStorage.clear();
    // jsdom doesn't implement matchMedia; ThemeProvider reads it to decide the
    // initial theme when no explicit preference is stored. A static stub that
    // reports light is enough for these tests (preference-based paths below
    // seed localStorage instead).
    window.matchMedia = (query: string) =>
        ({
            matches: false,
            media: query,
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            dispatchEvent: () => false,
        }) as MediaQueryList;
});

describe("DarkmodeToggle instances", () => {
    it("stays in sync with a sibling toggle when either one is clicked", async () => {
        const user = userEvent.setup();
        render(
            <ThemeProvider>
                <ThemeToggle />
                <ThemeToggle />
            </ThemeProvider>,
        );

        const toggles = screen.getAllByRole("checkbox");
        expect(toggles).toHaveLength(2);

        // Both start in light mode (no stored preference, system light).
        expect(toggles[0]).not.toBeChecked();
        expect(toggles[1]).not.toBeChecked();

        await user.click(toggles[0]);

        expect(toggles[0]).toBeChecked();
        expect(toggles[1]).toBeChecked();
        expect(window.localStorage.getItem("theme-preference")).toBe("dark");

        await user.click(toggles[1]);

        expect(toggles[0]).not.toBeChecked();
        expect(toggles[1]).not.toBeChecked();
        expect(window.localStorage.getItem("theme-preference")).toBe("light");
    });

    it("applies a stored preference to every instance on mount", () => {
        window.localStorage.setItem("theme-preference", "dark");

        render(
            <ThemeProvider>
                <ThemeToggle />
                <ThemeToggle />
            </ThemeProvider>,
        );

        const toggles = screen.getAllByRole("checkbox");
        expect(toggles[0]).toBeChecked();
        expect(toggles[1]).toBeChecked();
    });
});
