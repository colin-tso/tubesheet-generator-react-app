import InfoIcon from "@/assets/info-icon.svg?react";
import { loadDocsPage } from "@/docs/loadDocsPage";

interface DocsHelpLinkProps {
    // Id of a docs section (see SECTIONS in docs/DocsPage.tsx).
    section: string;
    // What the link explains, e.g. "Pitch ratio". Used for the accessible name.
    topic: string;
    // False takes the link out of the Tab order. Used inside the input form,
    // where an extra stop between fields would break Tab-to-next-field (the
    // paired clearance/pitch row relies on it). The viewport's Docs button
    // remains the keyboard route into the docs.
    tabbable?: boolean;
}

// Small (i) icon that jumps to the matching docs section. Preloads the docs
// chunk on hover/focus, like the viewport's Docs button, so the route change
// doesn't wait on the network.
export function DocsHelpLink({ section, topic, tabbable = true }: DocsHelpLinkProps) {
    const label = `Learn more about ${topic} in the docs`;
    return (
        <a
            className="focus-ring docs-help-link"
            href={`#/docs/${section}`}
            aria-label={label}
            title={label}
            tabIndex={tabbable ? undefined : -1}
            onMouseEnter={loadDocsPage}
            onFocus={loadDocsPage}
        >
            <InfoIcon width="14" height="14" aria-hidden="true" />
        </a>
    );
}
