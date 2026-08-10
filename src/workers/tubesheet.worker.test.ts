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
});
