import { useEffect, useState } from "react";
import packageJson from "../../../package.json";
import "../../index.css";
import "./DocsPage.css";
import "katex/dist/katex.min.css";
import ThemeToggle from "../../components/DarkmodeToggle";
import { Section } from "./Section";
import { Formula } from "./Formula";
import { Table } from "./Table";
import { DocsRegistryProvider, EqRef, TableRef } from "./DocsRegistry";

import Overview from "./content/01-overview.mdx";
import Pitch from "./content/02-pitch.mdx";
import Otl from "./content/03-otl.mdx";
import Patterns from "./content/04-patterns.mdx";
import Offset from "./content/05-offset.mdx";
import Filling from "./content/06-filling.mdx";
import Radial from "./content/07-radial.mdx";
import Solving from "./content/08-solving.mdx";
import Example from "./content/09-example.mdx";
import Glossary from "./content/10-glossary.mdx";

// Single source of truth for section order, ids, numbering, and the TOC.
// Adding a new topic means adding one entry here and one .mdx file.
const SECTIONS = [
    { id: "overview", index: "01", title: "Overview", Content: Overview },
    { id: "pitch", index: "02", title: "Pitch & pitch ratio", Content: Pitch },
    { id: "otl", index: "03", title: "OTL & shell ID", Content: Otl },
    { id: "patterns", index: "04", title: "Layout patterns", Content: Patterns },
    { id: "offset", index: "05", title: "Offsets", Content: Offset },
    { id: "filling", index: "06", title: "Filling the circle", Content: Filling },
    { id: "radial", index: "07", title: "Radial layout", Content: Radial },
    { id: "solving", index: "08", title: "Solving for shell ID", Content: Solving },
    { id: "example", index: "09", title: "Worked example", Content: Example },
    { id: "glossary", index: "10", title: "Glossary", Content: Glossary },
];

// How long the "you've arrived" highlight (see .docs-jump-highlight in
// DocsPage.css) stays on the target before fading back out.
const JUMP_HIGHLIGHT_MS = 2000;

// Scrolls to the section named by the hash's second segment (e.g.
// "#/docs/patterns" -> id="patterns"), on mount and on every hash change.
// Also focuses the target, since scrollIntoView alone gives screen readers
// and keyboard users no cue, and briefly highlights it. `:target` can't do
// any of this: the hash is always "#/docs/<id>", never a bare "#<id>".
//
// Re-clicking a link to the section already named in the hash doesn't fire
// `hashchange` (same-value assignment is a browser no-op), so a delegated
// click listener below jumps directly whenever a link's href already
// matches the current hash. Other clicks fall through to `hashchange`.
function useHashScroll() {
    useEffect(() => {
        let highlightTimer: ReturnType<typeof setTimeout> | undefined;

        const jumpToId = (target: string) => {
            const el = document.getElementById(target);
            if (!el) return;

            el.scrollIntoView({ behavior: "smooth", block: "start" });

            // Not natively focusable; make it a valid, non-tab-order target.
            if (!el.hasAttribute("tabindex")) {
                el.setAttribute("tabindex", "-1");
            }
            el.focus({ preventScroll: true });

            clearTimeout(highlightTimer);
            el.classList.add("docs-jump-highlight");
            highlightTimer = setTimeout(() => {
                el.classList.remove("docs-jump-highlight");
            }, JUMP_HIGHLIGHT_MS);
        };

        // hash is "#/docs" or "#/docs/<id>"
        const jumpToHash = (hash: string) => {
            const target = hash.split("/")[2];
            if (target) jumpToId(target);
        };

        const onHashChange = () => jumpToHash(window.location.hash);

        // Delegated to cover every in-page docs link without each needing its own handler.
        const onClick = (e: MouseEvent) => {
            const anchor = (e.target as HTMLElement)?.closest?.("a[href^='#/docs/']");
            if (!(anchor instanceof HTMLAnchorElement)) return;

            const href = anchor.getAttribute("href") ?? "";
            if (href !== window.location.hash) return; // real navigation; hashchange will handle it

            e.preventDefault();
            jumpToHash(href);
        };

        jumpToHash(window.location.hash);
        window.addEventListener("hashchange", onHashChange);
        document.addEventListener("click", onClick);
        return () => {
            window.removeEventListener("hashchange", onHashChange);
            document.removeEventListener("click", onClick);
            clearTimeout(highlightTimer);
        };
    }, []);
}

// Tracks which section is nearest the top of the viewport while the reader
// scrolls, so the table of contents can mark it with aria-current instead
// of only reflecting the (much coarser) URL hash.
function useActiveSection(sectionIds: string[]) {
    const [activeId, setActiveId] = useState(sectionIds[0]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setActiveId(entry.target.id);
                        break;
                    }
                }
            },
            // Narrow band near the top of the viewport, below the sticky
            // topbar, so the "active" section is whichever heading just
            // crossed it.
            { rootMargin: "-84px 0px -70% 0px" },
        );

        sectionIds.forEach((id) => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, [sectionIds]);

    return activeId;
}

const SECTION_IDS = SECTIONS.map((s) => s.id);

export function DocsPage() {
    useHashScroll();
    const activeId = useActiveSection(SECTION_IDS);

    return (
        <div className="docs-page">
            <a className="docs-skip-link" href="#docs-main">
                Skip to content
            </a>

            <div className="docs-topbar">
                <div className="docs-topbar-left">
                    <a className="docs-back-link" href="#/">
                        ← Back to calculator
                    </a>
                    <h1>
                        Tubesheet layout math
                        <span className="version-text">v{packageJson.version}</span>
                    </h1>
                </div>
                <ThemeToggle />
            </div>

            <div className="docs-body">
                <nav className="docs-toc" aria-label="Table of contents">
                    <p className="docs-toc-label">On this page</p>
                    {SECTIONS.map((s) => (
                        <a
                            key={s.id}
                            href={`#/docs/${s.id}`}
                            aria-current={activeId === s.id ? "location" : undefined}
                        >
                            {[s.index, s.title].join(" ")}
                        </a>
                    ))}
                </nav>

                <main id="docs-main" className="docs-content">
                    <div className="docs-intro">
                        This documentation explains the geometry and numerical methods behind the
                        calculator:
                        <ul>
                            <li>
                                What pitch, pitch ratio, OTL, and the layout angles actually mean
                            </li>
                            <li>
                                How a full tube field is generated from a handful of constants, and
                            </li>
                            <li>
                                How the app solves the inverse problem of finding the smallest shell
                                that fits a target number of tubes.
                            </li>
                        </ul>
                        Every formula here matches <code>tubesheet-layout-generator.ts</code>{" "}
                        directly.
                    </div>

                    <DocsRegistryProvider>
                        {SECTIONS.map(({ id, index, title, Content }) => (
                            <Section key={id} id={id} index={index} title={title}>
                                <Content components={{ Formula, EqRef, Table, TableRef }} />
                            </Section>
                        ))}
                    </DocsRegistryProvider>
                </main>
            </div>
        </div>
    );
}
