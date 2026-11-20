import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NumericField } from "./NumericField";
import { DocsHelpLink } from "./DocsHelpLink";
import { numericFieldConfigs } from "@/constants/numericFieldConfigs";

describe("DocsHelpLink", () => {
    it("links to the given docs section with a descriptive name", () => {
        render(<DocsHelpLink section="pitch" topic="pitch ratio" />);
        const link = screen.getByRole("link", { name: /pitch ratio/i });
        expect(link).toHaveAttribute("href", "#/docs/pitch");
    });

    it("renders beside fields that declare a docsSection, and only those", () => {
        const withDocs = numericFieldConfigs.filter((c) => c.docsSection);
        expect(withDocs.map((c) => [c.id, c.docsSection])).toEqual([
            ["OTLtoShell", "otl"],
            ["pitchRatio", "pitch"],
        ]);

        const cfg = numericFieldConfigs.find((c) => c.id === "OTLtoShell")!;
        const { rerender } = render(<NumericField {...cfg} value={undefined} />);
        expect(screen.getByRole("link")).toHaveAttribute("href", "#/docs/otl");

        const plain = numericFieldConfigs.find((c) => c.id === "tubeOD")!;
        rerender(<NumericField {...plain} value={undefined} />);
        expect(screen.queryByRole("link")).toBeNull();
    });
});

describe("DocsHelpLink tab order", () => {
    it("is tabbable by default and skippable inside the form", () => {
        const { rerender } = render(<DocsHelpLink section="otl" topic="OTL" />);
        expect(screen.getByRole("link")).not.toHaveAttribute("tabindex");
        rerender(<DocsHelpLink section="otl" topic="OTL" tabbable={false} />);
        expect(screen.getByRole("link")).toHaveAttribute("tabindex", "-1");
    });
});
