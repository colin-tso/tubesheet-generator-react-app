import packageJson from "../../package.json";
import "@/index.css";
import "./DocsPage.css";
import "katex/dist/katex.min.css";
import ThemeToggle from "@/components/DarkmodeToggle";
import { Section } from "./mdx-components/Section";
import { Formula } from "./mdx-components/Formula";
import { Table } from "./mdx-components/Table";
import { DocsRegistryProvider, EqRef, TableRef } from "./context/DocsRegistry";
import { useHashScroll, useActiveSection } from "./hooks";

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

// Single source of truth for section order, ids, numbering, and the TOC. Adding
// a new topic means adding one entry here and one .mdx file.
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

// How long the "you've arrived" highlight stays on the target before fading
// back out, plus the scroll/active-section hooks, live in ./hooks.ts.

const SECTION_IDS = SECTIONS.map((s) => s.id);

export function DocsPage({ hash, savedScrollY }: { hash: string; savedScrollY: number | null }) {
    useHashScroll(hash, hash.startsWith("#/docs"), savedScrollY);
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
