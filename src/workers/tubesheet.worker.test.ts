import { describe, it, expect, vi, beforeAll } from "vitest";

// Importing the worker module registers self.onmessage as a side effect.
beforeAll(async () => {
    await import("./tubesheet.worker");
});

const getHandler = () => self.onmessage as unknown as (e: MessageEvent) => void;

describe("tubesheet.worker — unknown message type", () => {
    it("replies with ERROR instead of hanging silently", () => {
        const postMessageSpy = vi.spyOn(self, "postMessage").mockImplementation(() => {});

        getHandler()({
            data: { type: "BOGUS_TYPE", requestId: "req-1", payload: {} },
        } as MessageEvent);

        expect(postMessageSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "ERROR",
                requestId: "req-1",
                requestType: "BOGUS_TYPE",
                payload: expect.stringContaining("BOGUS_TYPE"),
            }),
        );

        postMessageSpy.mockRestore();
    });
});

describe("tubesheet.worker — known message types still work", () => {
    it("responds to CALCULATE_SINGLE as before", () => {
        const postMessageSpy = vi.spyOn(self, "postMessage").mockImplementation(() => {});

        getHandler()({
            data: {
                type: "CALCULATE_SINGLE",
                requestId: "req-2",
                payload: {
                    OTLtoShell: 6.35,
                    tubeOD: 19.05,
                    pitchRatio: 1.25,
                    layoutOption: 30,
                    minTubes: 50,
                },
            },
        } as MessageEvent);

        expect(postMessageSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: "SINGLE_RESULT", requestId: "req-2" }),
        );

        postMessageSpy.mockRestore();
    });

    it("responds to CALCULATE_ALL with results keyed directly by layout", () => {
        const postMessageSpy = vi.spyOn(self, "postMessage").mockImplementation(() => {});

        getHandler()({
            data: {
                type: "CALCULATE_ALL",
                requestId: "req-3",
                payload: {
                    OTLtoShell: 6.35,
                    tubeOD: 19.05,
                    pitchRatio: 1.25,
                    minTubes: 50,
                },
            },
        } as MessageEvent);

        const sent = postMessageSpy.mock.calls[0][0] as {
            type: string;
            requestId: string;
            payload: Record<string, unknown>;
        };

        expect(sent.type).toBe("ALL_RESULTS");
        // payload should be keyed directly by layout (e.g. payload[30]),
        // not wrapped in an extra { payload: {...} } level.
        expect(sent.payload).toHaveProperty("30");
        expect(sent.payload).toHaveProperty("radial");

        postMessageSpy.mockRestore();
    });
});

describe("tubesheet.worker — radial layout is stored as 0 by the UI", () => {
    it("normalises layoutOption 0 to the radial layout instead of hanging", () => {
        const postMessageSpy = vi.spyOn(self, "postMessage").mockImplementation(() => {});

        getHandler()({
            data: {
                type: "CALCULATE_SINGLE",
                requestId: "req-radial",
                payload: {
                    OTLtoShell: 150,
                    tubeOD: 90.53,
                    pitchRatio: 1.25,
                    layoutOption: 0,
                    minTubes: 100,
                },
            },
        } as MessageEvent);

        const sent = postMessageSpy.mock.calls[0][0] as {
            type: string;
            requestId: string;
            payload: Record<string, unknown>;
        };
        expect(sent.type).toBe("SINGLE_RESULT");
        expect(sent.payload).toMatchObject({ layout: "radial", numTubes: expect.any(Number) });

        postMessageSpy.mockRestore();
    });

    it("replies with ERROR for an unknown layout instead of hanging", () => {
        const postMessageSpy = vi.spyOn(self, "postMessage").mockImplementation(() => {});

        getHandler()({
            data: {
                type: "CALCULATE_SINGLE",
                requestId: "req-bad-layout",
                payload: {
                    OTLtoShell: 6.35,
                    tubeOD: 19.05,
                    pitchRatio: 1.25,
                    layoutOption: 999,
                    minTubes: 50,
                },
            },
        } as MessageEvent);

        expect(postMessageSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "ERROR",
                requestId: "req-bad-layout",
                requestType: "CALCULATE_SINGLE",
                payload: expect.stringContaining("Invalid layout option: 999"),
            }),
        );

        postMessageSpy.mockRestore();
    });
});

describe("tubesheet.worker — CALCULATE_SWEEP", () => {
    it("responds with SWEEP_RESULTS using discrete sweep points", () => {
        const postMessageSpy = vi.spyOn(self, "postMessage").mockImplementation(() => {});

        getHandler()({
            data: {
                type: "CALCULATE_SWEEP",
                requestId: "req-sweep",
                payload: {
                    OTLtoShell: 6.35,
                    tubeOD: 19.05,
                    pitchRatio: 1.25,
                    layoutOption: 30,
                    currentNumTubes: 37,
                    centerShellID: 200,
                },
            },
        } as MessageEvent);

        const sent = postMessageSpy.mock.calls[0][0] as {
            type: string;
            requestId: string;
            payload: Array<{ shellID: number; numTubes: number; OTL: number | null }>;
        };

        expect(sent.type).toBe("SWEEP_RESULTS");
        expect(sent.requestId).toBe("req-sweep");
        expect(sent.payload.length).toBeGreaterThanOrEqual(1);
        expect(sent.payload.some((p) => p.shellID === 200)).toBe(true);
        expect(sent.payload.every((p) => typeof p.numTubes === "number")).toBe(true);

        postMessageSpy.mockRestore();
    });

    it("normalises layoutOption 0 to the radial layout instead of hanging", () => {
        const postMessageSpy = vi.spyOn(self, "postMessage").mockImplementation(() => {});

        getHandler()({
            data: {
                type: "CALCULATE_SWEEP",
                requestId: "req-sweep-radial",
                payload: {
                    OTLtoShell: 150,
                    tubeOD: 90.53,
                    pitchRatio: 1.25,
                    layoutOption: 0,
                    currentNumTubes: 50,
                    centerShellID: 400,
                },
            },
        } as MessageEvent);

        expect(postMessageSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: "SWEEP_RESULTS", requestId: "req-sweep-radial" }),
        );

        postMessageSpy.mockRestore();
    });

    it("replies with ERROR for an unknown layout instead of hanging", () => {
        const postMessageSpy = vi.spyOn(self, "postMessage").mockImplementation(() => {});

        getHandler()({
            data: {
                type: "CALCULATE_SWEEP",
                requestId: "req-sweep-bad-layout",
                payload: {
                    OTLtoShell: 6.35,
                    tubeOD: 19.05,
                    pitchRatio: 1.25,
                    layoutOption: 999,
                    currentNumTubes: 37,
                    centerShellID: 200,
                },
            },
        } as MessageEvent);

        expect(postMessageSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "ERROR",
                requestId: "req-sweep-bad-layout",
                requestType: "CALCULATE_SWEEP",
                payload: expect.stringContaining("Invalid layout option: 999"),
            }),
        );

        postMessageSpy.mockRestore();
    });

    it("replies with ERROR when currentNumTubes or centerShellID are missing", () => {
        const postMessageSpy = vi.spyOn(self, "postMessage").mockImplementation(() => {});

        getHandler()({
            data: {
                type: "CALCULATE_SWEEP",
                requestId: "req-sweep-missing",
                payload: {
                    OTLtoShell: 6.35,
                    tubeOD: 19.05,
                    pitchRatio: 1.25,
                    layoutOption: 30,
                },
            },
        } as MessageEvent);

        expect(postMessageSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "ERROR",
                requestId: "req-sweep-missing",
                requestType: "CALCULATE_SWEEP",
                payload: expect.stringContaining("currentNumTubes and centerShellID must be numbers"),
            }),
        );

        postMessageSpy.mockRestore();
    });
});

describe("tubesheet.worker — preferred-layout ties at full precision", () => {
    // 45° and radial realises the same 4-tube diamond for these inputs. Their
    // minIDs must be bit-identical (full float precision on both paths) so the
    // strict equality check flags BOTH as preferred, not just the first one.
    it("flags both 45-degree and radial as preferred when they tie on minID", () => {
        const postMessageSpy = vi.spyOn(self, "postMessage").mockImplementation(() => {});

        getHandler()({
            data: {
                type: "CALCULATE_ALL",
                requestId: "req-tie",
                payload: {
                    OTLtoShell: 40,
                    tubeOD: 95.3,
                    pitchRatio: (95.3 + 20) / 95.3,
                    minTubes: 4,
                },
            },
        } as MessageEvent);

        const sent = postMessageSpy.mock.calls[0][0] as {
            type: string;
            payload: Record<string, { preferred: boolean }>;
        };

        expect(sent.type).toBe("ALL_RESULTS");
        expect(sent.payload["45"].preferred).toBe(true);
        expect(sent.payload["radial"].preferred).toBe(true);

        postMessageSpy.mockRestore();
    });
});
