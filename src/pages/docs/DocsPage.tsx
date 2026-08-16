import { useEffect, useState } from "react";
import packageJson from "../../../package.json";
import "../../index.css";
import "./DocsPage.css";
import "katex/dist/katex.min.css";
import ThemeToggle from "../../components/DarkmodeToggle";
import { Section } from "./Section";
import { Formula } from "./Formula";
import { EquationRegistryProvider, EqRef } from "./EquationRegistry";

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
    { id: "offset", index: "05", title: "Row offset & AUTO", Content: Offset },
    { id: "filling", index: "06", title: "Filling the circle", Content: Filling },
    { id: "radial", index: "07", title: "Radial layout", Content: Radial },
    { id: "solving", index: "08", title: "Solving for shell ID", Content: Solving },
    { id: "example", index: "09", title: "Worked example", Content: Example },
    { id: "glossary", index: "10", title: "Glossary", Content: Glossary },
];

// How long the "you've arrived" highlight (see .docs-jump-highlight in
// DocsPage.css) stays on the target before fading back out.
const JUMP_HIGHLIGHT_MS = 2000;

// Scrolls to the section named by the hash's second segment. For example,
// "#/docs/patterns" scrolls to id="patterns". Runs on mount and whenever
// the hash changes, so deep links and in-page TOC clicks both work without
// pulling in a routing library.
//
// Also moves keyboard focus to the target (screen readers and keyboard
// users get no cue from scrollIntoView alone) and briefly toggles a
// highlight class. Neither can be done with plain CSS: the hash is always
// shaped "#/docs/<id>", never a bare "#<id>", so `:target` can never match
// an element here.
function useHashScroll() {
    useEffect(() => {
        let highlightTimer: ReturnType<typeof setTimeout> | undefined;

        const scrollToHash = () => {
            const hash = window.location.hash; // "#/docs" or "#/docs/<id>"
            const parts = hash.split("/");
            const target = parts[2];
            if (!target) return;
            const el = document.getElementById(target);
            if (!el) return;

            el.scrollIntoView({ behavior: "smooth", block: "start" });

            // Sections and formula blocks aren't natively focusable; make
            // them a valid, non-tab-order focus target so screen readers
            // announce the jump the same way the skip link does.
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

        scrollToHash();
        window.addEventListener("hashchange", scrollToHash);
        return () => {
            window.removeEventListener("hashchange", scrollToHash);
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
                            {s.title}
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

                    <EquationRegistryProvider>
                        {SECTIONS.map(({ id, index, title, Content }) => (
                            <Section key={id} id={id} index={index} title={title}>
                                <Content components={{ Formula, EqRef }} />
                            </Section>
                        ))}
                    </EquationRegistryProvider>
                </main>
            </div>
        </div>
    );
}
