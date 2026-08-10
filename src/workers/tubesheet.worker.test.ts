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
