import { useEffect, useRef, useState } from "react";
import "@/index.css";
import "./DocsPage.css";
import "katex/dist/katex.min.css";
import ThemeToggle from "@/components/DarkmodeToggle";
import { Section } from "./mdx-components/Section";
import { Formula } from "./mdx-components/Formula";
import { Table } from "./mdx-components/Table";
import { DocsRegistryProvider, EqRef, TableRef } from "./context/DocsRegistry";
import { useHashScroll, useActiveSection, useReadingProgress } from "./hooks";

import Intro from "./content/00-intro.mdx";
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

// Custom MDX link component — applies the .docs-ref-link class to internal
// doc cross-references so they match the styled EqRef/TableRef links.
function DocRefLink({
    href,
    children,
    className: inheritedClass,
    ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
    const className = href?.startsWith("#/docs/")
        ? inheritedClass
            ? `${inheritedClass} docs-ref-link`
            : "docs-ref-link"
        : inheritedClass;
    return (
        <a href={href} className={className} {...rest}>
            {children}
        </a>
    );
}

// Single source of truth for section order, ids, numbering, and the TOC. Adding
// a new topic means adding one entry here and one .mdx file.
const SECTIONS = [
    { id: "overview", index: "01", title: "Overview", Content: Overview },
    { id: "pitch", index: "02", title: "Pitch and pitch ratio", Content: Pitch },
    { id: "otl", index: "03", title: "OTL and shell ID", Content: Otl },
    { id: "patterns", index: "04", title: "Layout patterns", Content: Patterns },
    { id: "offset", index: "05", title: "Offsets", Content: Offset },
    { id: "filling", index: "06", title: "Filling the circle", Content: Filling },
    { id: "radial-layout", index: "07", title: "Radial layout", Content: Radial },
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

    // Mobile-only ToC dropdown (the sidebar .docs-toc is hidden ≤860px).
    const [tocOpen, setTocOpen] = useState(false);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const tocPanelRef = useRef<HTMLElement>(null);

    // Gives the sticky topbar a shadow once the page has scrolled out from
    // under it, so it reads as floating above content instead of blending
    // into the page background (they share the same --paper fill).
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 4);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    const activeSection = SECTIONS.find((s) => s.id === activeId);
    const progressBarRef = useRef<HTMLDivElement>(null);
    useReadingProgress(progressBarRef);

    // Move focus into the list when the panel opens so keyboard users land on
    // the first heading instead of tabbing blindly into the page.
    useEffect(() => {
        if (!tocOpen) return;
        const firstLink = tocPanelRef.current?.querySelector("a");
        (firstLink as HTMLElement | null)?.focus();
    }, [tocOpen]);

    // Escape closes the panel and returns focus to the button; pressing
    // anywhere outside the panel or button dismisses it too.
    useEffect(() => {
        if (!tocOpen) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setTocOpen(false);
                menuButtonRef.current?.focus();
            }
        };

        const onPointerDown = (e: PointerEvent) => {
            const target = e.target as Node;
            if (tocPanelRef.current?.contains(target)) return;
            if (menuButtonRef.current?.contains(target)) return;
            setTocOpen(false);
        };

        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("pointerdown", onPointerDown);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("pointerdown", onPointerDown);
        };
    }, [tocOpen]);

    return (
        <div className="docs-page">
            <a className="docs-skip-link" href="#docs-main">
                Skip to content
            </a>

            <div className={`docs-topbar${scrolled ? " scrolled" : ""}`}>
                <div className="docs-topbar-left">
                    <a
                        className="docs-logo-link"
                        href="#/"
                        aria-label="Tubesheet layout generator — back to calculator"
                    >
                        {/* Inlined (not <img src="icon.svg">) so its colors track the
                            app's own --ink/--paper theme tokens via CSS, staying in
                            sync with the manual light/dark toggle. icon.svg's
                            prefers-color-scheme media query only follows the OS
                            setting, which can disagree with an explicit in-app
                            override (see ThemeToggle.tsx's data-theme attribute). */}
                        <svg
                            className="docs-logo-mark"
                            viewBox="0 0 512 512"
                            role="img"
                            aria-hidden="true"
                        >
                            <defs>
                                <clipPath id="docs-logo-squircle">
                                    <rect x="0" y="0" width="512" height="512" rx="112" ry="112" />
                                </clipPath>
                            </defs>
                            <g clipPath="url(#docs-logo-squircle)">
                                <rect
                                    className="docs-logo-bg"
                                    x="0"
                                    y="0"
                                    width="512"
                                    height="512"
                                />
                            </g>
                            <circle
                                className="docs-logo-glyph-stroke"
                                cx="256"
                                cy="256"
                                r="210"
                                fill="none"
                                strokeWidth="26"
                            />
                            <circle className="docs-logo-glyph-fill" cx="256" cy="351.2" r="78" />
                            <circle className="docs-logo-glyph-fill" cx="173.6" cy="208.4" r="78" />
                            <circle className="docs-logo-glyph-fill" cx="338.4" cy="208.4" r="78" />
                        </svg>
                    </a>
                    <span className="docs-topbar-divider" aria-hidden="true" />
                    <span className="docs-topbar-title">
                        Docs
                        {activeSection && (
                            <>
                                <span className="docs-topbar-crumb-sep" aria-hidden="true">
                                    /
                                </span>
                                <span className="docs-topbar-crumb">{activeSection.title}</span>
                            </>
                        )}
                    </span>
                </div>
                <div className="docs-topbar-actions">
                    <a className="docs-back-btn" href="#/" aria-label="Back to calculator">
                        <span className="docs-back-arrow" aria-hidden="true">
                            ← <span>Back to Calculator</span>
                        </span>
                    </a>
                    <ThemeToggle />
                    <button
                        ref={menuButtonRef}
                        type="button"
                        className={`docs-menu-button${tocOpen ? " open" : ""}`}
                        aria-label="Table of contents"
                        aria-expanded={tocOpen}
                        aria-controls="docs-mobile-toc"
                        onClick={() => setTocOpen((open) => !open)}
                    >
                        <span className="docs-menu-bars" aria-hidden="true">
                            <span />
                            <span />
                            <span />
                        </span>
                    </button>
                </div>
                <nav
                    ref={tocPanelRef}
                    id="docs-mobile-toc"
                    aria-label="Table of contents"
                    className={`docs-mobile-toc${tocOpen ? " open" : ""}`}
                >
                    <p className="docs-toc-label">On this page</p>
                    {SECTIONS.map((s) => (
                        <a
                            key={s.id}
                            href={`#/docs/${s.id}`}
                            aria-current={activeId === s.id ? "location" : undefined}
                            onClick={() => setTocOpen(false)}
                        >
                            {[s.index, s.title].join(" ")}
                        </a>
                    ))}
                </nav>
            </div>
            <div ref={progressBarRef} className="docs-progress-bar" aria-hidden="true" />

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
                        <Intro components={{ a: DocRefLink, Formula, EqRef, Table, TableRef }} />
                    </div>

                    <DocsRegistryProvider>
                        {SECTIONS.map(({ id, index, title, Content }) => (
                            <Section key={id} id={id} index={index} title={title}>
                                <Content
                                    components={{ a: DocRefLink, Formula, EqRef, Table, TableRef }}
                                />
                            </Section>
                        ))}
                    </DocsRegistryProvider>
                </main>
            </div>
        </div>
    );
}
