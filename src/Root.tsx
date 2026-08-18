import { type ComponentType, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import App from "./App";
import { loadDocsPage } from "./pages/docs/loadDocsPage";

type DocsPageProps = { hash: string; savedScrollY: number | null };

const VIEW_TRANSITION_DIRECTION_ATTR = "viewTransitionDirection";
const PAGE_TRANSITION_ATTR = "pageTransition";

// Firefox implements `document.startViewTransition` and the
// `view-transition-name` CSS property, but doesn't apply this app's directional
// slide keyframes to the named "page-content" transition group — it just falls
// back to the browser's plain cross-fade instead of sliding. A CSS `@supports`
// feature query can't tell "supports the View Transition API" apart from
// "supports it well enough for this slide", so the two would silently disagree
// (as they did here). JS makes that call once, in one place, and records it on
// <html> via data-page-transition so index.css's fade fallback can never drift
// out of sync with the branch below.
const supportsPageSlideTransition =
    typeof document.startViewTransition === "function" && !/firefox/i.test(navigator.userAgent);

document.documentElement.dataset[PAGE_TRANSITION_ATTR] = supportsPageSlideTransition
    ? "slide"
    : "fade";

// Two routes total, so a full router dependency isn't worth pulling in.
// "#/docs" and "#/docs/<section-id>" render the docs page; everything else
// (including no hash at all) renders the calculator.
//
// Both routes stay mounted once visited — App always, DocsPage from its first
// visit onward — and navigation only toggles which one carries .route-hidden,
// instead of unmounting/remounting. That's what lets calculator inputs and the
// docs read position survive switching back and forth. See DocsPage's
// useHashScroll for the scroll save/restore half of that: it depends on
// receiving `hash` as a prop (rather than reading window.location.hash itself)
// so its effect can't run while the container is still hidden.
//
// DocsPage is loaded via plain dynamic import() (see loadDocsPage.ts) and its
// resolved component is stored in state below, rather than going through
// React.lazy()/Suspense. That's deliberate: lazy() throws a fresh pending
// Promise on every first render call, even once the underlying module is cached
// — Promises never settle synchronously — so a lazy component always suspends
// on its first render inside the view-transition callback below, and flushSync
// can only force through the Suspense fallback (blank), not the real content.
// The actual content would then only land once that Promise's microtask
// resolves, in a separate render outside the transition — landing right after
// it, as a visible pop-in. Managing the load ourselves and only ever rendering
// the fully-resolved component sidesteps that entirely.
export function Root() {
    const [hash, setHash] = useState(window.location.hash);
    const previousHashRef = useRef(window.location.hash);
    const isDocsRoute = hash.startsWith("#/docs");
    // Once loaded, DocsPage stays around (just hidden, never torn down) for the
    // rest of the session — its own truthiness doubles as "has docs been
    // visited yet" so there's no need for a separate mounted flag.
    const [DocsPageComponent, setDocsPageComponent] = useState<ComponentType<DocsPageProps> | null>(
        null,
    );
    // Where the reader was scrolled to in docs, restored by DocsPage when they
    // return via a bare "#/docs" link (see the comment on the capture below for
    // why this can't just be read inside DocsPage itself).
    const [docsScrollY, setDocsScrollY] = useState<number | null>(null);

    // Covers landing directly on a "#/docs..." URL: onHashChange (below) only
    // fires on subsequent navigation, so the very first load needs its own
    // kick-off. No transition/flushSync involved here — it's the first paint,
    // there's nothing to animate from yet, so an ordinary state update once the
    // chunk resolves is enough.
    useEffect(() => {
        if (!isDocsRoute) return;
        let cancelled = false;
        loadDocsPage().then((Component) => {
            if (!cancelled) setDocsPageComponent(() => Component);
        });
        return () => {
            cancelled = true;
        };
        // intentionally mount-only
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const onHashChange = async () => {
            const next = window.location.hash;
            const previous = previousHashRef.current;
            previousHashRef.current = next;

            const wasDocs = previous.startsWith("#/docs");
            const isDocs = next.startsWith("#/docs");

            // Capture scroll position first, before anything else: once
            // .route-hidden's display:none commits on the docs container, its
            // content collapses to zero height and window.scrollY has already
            // snapped back — reading it any later (e.g. from a DocsPage effect
            // reacting to the hide) would save that already-reset value instead
            // of where the reader actually was. The actual state update is
            // deferred into commit() below so it batches into the same render
            // as setHash rather than firing its own extra render first.
            const scrollYOnLeavingDocs = wasDocs && !isDocs ? window.scrollY : null;

            // Resolve the (likely already-cached, see FormFooter's hover/focus
            // preload) docs chunk before the transition starts, and hold on to
            // the resolved component so commit() can hand it to React
            // synchronously — see the module-level comment for why this isn't
            // just a lazy()/Suspense render.
            const resolvedDocsPage = isDocs ? await loadDocsPage() : null;

            const commit = () => {
                setHash(next);
                // Once set, DocsPage stays mounted (just hidden, never torn
                // down) for the rest of the session.
                if (isDocs && resolvedDocsPage) setDocsPageComponent(() => resolvedDocsPage);
                if (scrollYOnLeavingDocs !== null) setDocsScrollY(scrollYOnLeavingDocs);
            };

            // Slides the calculator <-> docs swap via the browser's native View
            // Transition API instead of an instant remount. React's
            // <ViewTransition> component needs react@canary, which this app
            // doesn't run, so this calls the DOM API directly; see index.css
            // for the slide keyframes, the plain-fade fallback, and the
            // prefers-reduced-motion guard.
            if (supportsPageSlideTransition) {
                // Only the calculator <-> docs boundary gets a directional
                // slide; hash changes within docs (e.g. TOC links) leave the
                // attribute unset so they fall back to the default cross-fade
                // instead of re-triggering a page-level slide.
                const crossesBoundary = wasDocs !== isDocs;

                if (crossesBoundary) {
                    document.documentElement.dataset[VIEW_TRANSITION_DIRECTION_ATTR] = isDocs
                        ? "forward"
                        : "back";
                }
                // flushSync forces the state update above to commit before this
                // callback returns, so the browser's "after" snapshot captures
                // the real, updated DOM instead of racing a still-scheduled
                // render (see module-level comment).
                const transition = document.startViewTransition(() => flushSync(commit));
                transition.finished.finally(() => {
                    delete document.documentElement.dataset[VIEW_TRANSITION_DIRECTION_ATTR];
                });
            } else {
                // No native slide support: commit still triggers a plain
                // render, and the incoming page fades in via the
                // data-page-transition="fade" CSS rule in index.css.
                commit();
            }
        };
        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, []);

    return (
        <>
            <div className={isDocsRoute ? "route-hidden" : undefined}>
                <App />
            </div>
            {DocsPageComponent && (
                <div className={isDocsRoute ? undefined : "route-hidden"}>
                    <DocsPageComponent hash={hash} savedScrollY={docsScrollY} />
                </div>
            )}
        </>
    );
}
