import { useCallback, useRef, useState } from "react";
import { downloadBlob } from "@/utils/svgExport";
import {
    buildShareableURL,
    parseLayoutConfig,
    serializeLayoutConfig,
    type LayoutConfigFields,
} from "@/utils/layoutConfig";

export type SaveConfigState = "idle" | "success" | "error";
export type LoadConfigState = "idle" | "pending" | "success" | "error";
export type ShareLinkState = "idle" | "copied" | "error" | "unsupported";

const RESET_DELAY_MS = 2500;
const LOAD_ERROR_RESET_DELAY_MS = 5000;

// A config file only ever needs to hold ~7 numbers; anything drastically
// larger than that is not a real export and isn't worth reading.
const MAX_CONFIG_FILE_BYTES = 100 * 1024; // 100 KB

export function useLayoutConfigActions(
    layoutConfig: LayoutConfigFields,
    onLoadLayoutConfig: (fields: LayoutConfigFields) => void,
) {
    const [saveConfigState, setSaveConfigState] = useState<SaveConfigState>("idle");
    const [loadConfigState, setLoadConfigState] = useState<LoadConfigState>("idle");
    const [loadConfigErrors, setLoadConfigErrors] = useState<string[]>([]);
    const [shareLinkState, setShareLinkState] = useState<ShareLinkState>("idle");
    const loadInFlightRef = useRef(false);

    const saveConfigAsJSON = useCallback(() => {
        try {
            const json = JSON.stringify(serializeLayoutConfig(layoutConfig), null, 2);
            downloadBlob(new Blob([json], { type: "application/json" }), "tubesheet-config.json");
            setSaveConfigState("success");
            setTimeout(() => setSaveConfigState("idle"), RESET_DELAY_MS);
        } catch (err) {
            console.error("Save config failed:", err);
            setSaveConfigState("error");
            setTimeout(() => setSaveConfigState("idle"), RESET_DELAY_MS);
        }
    }, [layoutConfig]);

    // Parses, validates, and applies a raw config. Shared by the file picker
    // button and by the ViewportFrame drag-and-drop zone, which both hand
    // loadConfigFromFile a File and end up here. Surfaces per-field errors
    // without blocking on them, since a partially-valid config should still
    // load what it can.
    const applyParsedConfig = useCallback(
        (raw: unknown) => {
            const { fields, errors } = parseLayoutConfig(raw);
            if (Object.keys(fields).length === 0) {
                setLoadConfigErrors(errors.length ? errors : ["No recognised fields found."]);
                setLoadConfigState("error");
                setTimeout(() => setLoadConfigState("idle"), LOAD_ERROR_RESET_DELAY_MS);
                return;
            }

            onLoadLayoutConfig(fields);
            if (errors.length) console.warn("Loaded config with skipped fields:", errors);
            setLoadConfigErrors(errors);
            setLoadConfigState("success");
            setTimeout(() => setLoadConfigState("idle"), RESET_DELAY_MS);
        },
        [onLoadLayoutConfig],
    );

    const loadConfigFromFile = useCallback(
        (file: File) => {
            if (loadInFlightRef.current) return;

            if (file.size > MAX_CONFIG_FILE_BYTES) {
                setLoadConfigErrors([`File is too large (max ${MAX_CONFIG_FILE_BYTES / 1024} KB).`]);
                setLoadConfigState("error");
                setTimeout(() => setLoadConfigState("idle"), LOAD_ERROR_RESET_DELAY_MS);
                return;
            }

            loadInFlightRef.current = true;
            setLoadConfigState("pending");

            file.text()
                .then((text) => {
                    let parsed: unknown;
                    try {
                        parsed = JSON.parse(text);
                    } catch {
                        throw new Error("File is not valid JSON.");
                    }
                    applyParsedConfig(parsed);
                })
                .catch((err: unknown) => {
                    console.error("Load config failed:", err);
                    setLoadConfigErrors([err instanceof Error ? err.message : "Could not read file."]);
                    setLoadConfigState("error");
                    setTimeout(() => setLoadConfigState("idle"), LOAD_ERROR_RESET_DELAY_MS);
                })
                .finally(() => {
                    loadInFlightRef.current = false;
                });
        },
        [applyParsedConfig],
    );

    const copyShareableLink = useCallback(() => {
        const url = buildShareableURL(layoutConfig);

        if (typeof navigator === "undefined" || !navigator.clipboard) {
            setShareLinkState("unsupported");
            setTimeout(() => setShareLinkState("idle"), RESET_DELAY_MS);
            return;
        }

        navigator.clipboard
            .writeText(url)
            .then(() => {
                setShareLinkState("copied");
                setTimeout(() => setShareLinkState("idle"), RESET_DELAY_MS);
            })
            .catch((err: unknown) => {
                console.error("Copy shareable link failed:", err);
                setShareLinkState("error");
                setTimeout(() => setShareLinkState("idle"), RESET_DELAY_MS);
            });
    }, [layoutConfig]);

    return {
        saveConfigState,
        saveConfigAsJSON,
        loadConfigState,
        loadConfigErrors,
        loadConfigFromFile,
        shareLinkState,
        copyShareableLink,
    };
}
