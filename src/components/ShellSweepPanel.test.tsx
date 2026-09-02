import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ShellSweepPanel } from "./ShellSweepPanel";
import type { ShellSweepPoint } from "@/plugins/tubesheet-layout-generator";
import type { SweepCallback } from "@/hooks/useTubeSheetWorker";

const baseProps = {
    OTLtoShell: 6.35,
    tubeOD: 19.05,
    pitchRatio: 1.25,
    layoutOption: 30,
    layoutInputsDefined: true,
    layoutOptionSelected: true,
    centerShellID: 200,
    currentNumTubes: 37,
    onApplyShellID: vi.fn(),
};

describe("ShellSweepPanel", () => {
    it("disables the button and explains why when there's no center shell ID yet", () => {
        render(
            <ShellSweepPanel
                {...baseProps}
                centerShellID={undefined}
                currentNumTubes={undefined}
                requestSweep={vi.fn(() => 1)}
            />,
        );

        expect(screen.getByRole("button", { name: /compare shell sizes/i })).toBeDisabled();
        expect(
            screen.getByText(/generate a drawing first to set the comparison range/i),
        ).toBeInTheDocument();
    });

    it("disables the button when currentNumTubes is missing", () => {
        render(
            <ShellSweepPanel
                {...baseProps}
                currentNumTubes={undefined}
                requestSweep={vi.fn(() => 1)}
            />,
        );

        expect(screen.getByRole("button", { name: /compare shell sizes/i })).toBeDisabled();
    });

    it("requests a discrete sweep with currentNumTubes and centerShellID", () => {
        const requestSweep = vi.fn<
            (payload: Record<string, unknown>, callback: SweepCallback) => number
        >(() => 1);
        render(<ShellSweepPanel {...baseProps} requestSweep={requestSweep} />);

        fireEvent.click(screen.getByRole("button", { name: /compare shell sizes/i }));

        expect(requestSweep).toHaveBeenCalledTimes(1);
        const [payload] = requestSweep.mock.calls[0]!;
        expect(payload).toMatchObject({
            OTLtoShell: 6.35,
            tubeOD: 19.05,
            pitchRatio: 1.25,
            layoutOption: 30,
            currentNumTubes: 37,
            centerShellID: 200,
        });
    });

    it("renders resolved points and applies the clicked row's shell ID", () => {
        const points: ShellSweepPoint[] = [
            { shellID: 150, numTubes: 19, OTL: 130, minID: 145 },
            { shellID: 200, numTubes: 37, OTL: 180, minID: 185 },
        ];
        const requestSweep = vi.fn((_payload, callback) => {
            callback(points);
            return 1;
        });
        const onApplyShellID = vi.fn();

        render(
            <ShellSweepPanel
                {...baseProps}
                requestSweep={requestSweep}
                onApplyShellID={onApplyShellID}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: /compare shell sizes/i }));

        const row = screen.getByRole("radio", { name: /use shell id 145/i });
        fireEvent.click(row);

        expect(onApplyShellID).toHaveBeenCalledWith(145);
    });

    it("renders shell size options as a keyboard-navigable radiogroup, with the current one checked", () => {
        const points: ShellSweepPoint[] = [
            { shellID: 180, numTubes: 33, OTL: 160, minID: 170 },
            { shellID: 200, numTubes: 37, OTL: 180, minID: 185 },
        ];
        const requestSweep = vi.fn((_payload, callback) => {
            callback(points);
            return 1;
        });

        render(<ShellSweepPanel {...baseProps} centerShellID={200} requestSweep={requestSweep} />);

        fireEvent.click(screen.getByRole("button", { name: /compare shell sizes/i }));

        expect(
            screen.getByRole("radiogroup", { name: /shell size comparison/i }),
        ).toBeInTheDocument();

        const currentRow = screen.getByRole("radio", { name: /use shell id 185/i });
        expect(currentRow).toBeChecked();

        const otherRow = screen.getByRole("radio", { name: /use shell id 170/i });
        expect(otherRow).not.toBeChecked();
    });

    it("renders column headers", () => {
        const points: ShellSweepPoint[] = [{ shellID: 200, numTubes: 37, OTL: 180, minID: 185 }];
        const requestSweep = vi.fn((_payload, callback) => {
            callback(points);
            return 1;
        });

        render(<ShellSweepPanel {...baseProps} requestSweep={requestSweep} />);

        fireEvent.click(screen.getByRole("button", { name: /compare shell sizes/i }));

        expect(screen.getByText("Min ID (mm)")).toBeInTheDocument();
        expect(screen.getByText("Tubes")).toBeInTheDocument();
    });

    it("shows an inline error and no rows when the sweep fails", () => {
        const requestSweep = vi.fn((_payload, callback) => {
            callback(null);
            return 1;
        });

        render(<ShellSweepPanel {...baseProps} requestSweep={requestSweep} />);

        fireEvent.click(screen.getByRole("button", { name: /compare shell sizes/i }));

        expect(screen.getByText(/couldn't compute the sweep/i)).toBeInTheDocument();
        expect(screen.queryAllByRole("radio", { name: /use shell id/i })).toHaveLength(0);
    });

    it("shows a distinct message when the sweep times out instead of failing outright", () => {
        const requestSweep = vi.fn(() => 1); // never calls back — times out
        vi.useFakeTimers();

        render(<ShellSweepPanel {...baseProps} requestSweep={requestSweep} />);

        fireEvent.click(screen.getByRole("button", { name: /compare shell sizes/i }));
        act(() => {
            vi.advanceTimersByTime(4001);
        });

        expect(screen.getByText(/taking longer than expected/i)).toBeInTheDocument();
        expect(screen.queryByText(/couldn't compute the sweep/i)).not.toBeInTheDocument();

        vi.useRealTimers();
    });

    it("expands and runs sweep on first click, then collapses on second click", () => {
        const points: ShellSweepPoint[] = [
            { shellID: 180, numTubes: 33, OTL: 160, minID: 170 },
            { shellID: 200, numTubes: 37, OTL: 180, minID: 185 },
        ];
        const requestSweep = vi.fn((_payload, callback) => {
            callback(points);
            return 1;
        });

        render(<ShellSweepPanel {...baseProps} requestSweep={requestSweep} />);

        // Initially collapsed — no rows visible
        expect(screen.queryAllByRole("radio", { name: /use shell id/i })).toHaveLength(0);
        expect(screen.getByRole("button", { name: /compare shell sizes/i })).toBeInTheDocument();

        // First click — runs sweep and expands
        fireEvent.click(screen.getByRole("button", { name: /compare shell sizes/i }));
        expect(screen.getAllByRole("radio", { name: /use shell id/i })).toHaveLength(2);
        expect(screen.getByRole("button", { name: /hide comparison/i })).toBeInTheDocument();

        // Second click — collapses
        fireEvent.click(screen.getByRole("button", { name: /hide comparison/i }));
        expect(screen.queryAllByRole("radio", { name: /use shell id/i })).toHaveLength(0);
        expect(screen.getByRole("button", { name: /show comparison/i })).toBeInTheDocument();

        // Third click — re-expands
        fireEvent.click(screen.getByRole("button", { name: /show comparison/i }));
        expect(screen.getAllByRole("radio", { name: /use shell id/i })).toHaveLength(2);
        expect(screen.getByRole("button", { name: /hide comparison/i })).toBeInTheDocument();
    });

    it("auto-refreshes an expanded, resolved sweep when centerShellID changes", () => {
        const requestSweep = vi
            .fn<(payload: Record<string, unknown>, callback: SweepCallback) => number>()
            .mockImplementation((_payload, callback) => {
                callback([{ shellID: 200, numTubes: 37, OTL: 180, minID: 185 }]);
                return 1;
            });

        const { rerender } = render(<ShellSweepPanel {...baseProps} requestSweep={requestSweep} />);

        fireEvent.click(screen.getByRole("button", { name: /compare shell sizes/i }));
        expect(requestSweep).toHaveBeenCalledTimes(1);

        // centerShellID changes (e.g. the user regenerated the drawing) while expanded.
        rerender(
            <ShellSweepPanel
                {...baseProps}
                centerShellID={250}
                currentNumTubes={45}
                requestSweep={requestSweep}
            />,
        );

        expect(requestSweep).toHaveBeenCalledTimes(2);
        const [secondPayload] = requestSweep.mock.calls[1]!;
        expect(secondPayload).toMatchObject({ centerShellID: 250, currentNumTubes: 45 });
    });

    it("cancels an in-flight sweep when an input drifts before the worker responds", () => {
        let pendingCallback: ((points: unknown) => void) | undefined;
        const requestSweep = vi.fn((_payload, callback) => {
            pendingCallback = callback;
            return 1;
        });

        const { rerender } = render(<ShellSweepPanel {...baseProps} requestSweep={requestSweep} />);

        fireEvent.click(screen.getByRole("button", { name: /compare shell sizes/i }));
        expect(requestSweep).toHaveBeenCalledTimes(1);

        // tubeOD changes while the sweep is still pending
        rerender(<ShellSweepPanel {...baseProps} tubeOD={25.4} requestSweep={requestSweep} />);

        // The stale response landing afterwards must not populate the panel.
        pendingCallback?.([{ shellID: 999, numTubes: 5, OTL: 100, minID: 90 }]);
        expect(screen.queryAllByRole("radio", { name: /use shell id/i })).toHaveLength(0);
        expect(screen.getByRole("button", { name: /compare shell sizes/i })).toBeInTheDocument();
    });
});
