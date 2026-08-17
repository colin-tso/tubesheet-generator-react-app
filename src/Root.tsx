import { useEffect, useRef, useState } from "react";
import App from "./App";
import { DocsPage } from "./pages/docs/DocsPage";

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
export function Root() {
    const [hash, setHash] = useState(window.location.hash);
    const previousHashRef = useRef(window.location.hash);

    useEffect(() => {
        const onHashChange = () => {
            const next = window.location.hash;
            const previous = previousHashRef.current;
            previousHashRef.current = next;

            // Slides the calculator <-> docs swap via the browser's native View
            // Transition API instead of an instant remount. React's
            // <ViewTransition> component needs react@canary, which this app
            // doesn't run, so this calls the DOM API directly; see index.css
            // for the slide keyframes, the plain-fade fallback, and the
            // prefers-reduced-motion guard.
            if (supportsPageSlideTransition) {
                const wasDocs = previous.startsWith("#/docs");
                const isDocs = next.startsWith("#/docs");
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
                const transition = document.startViewTransition(() => setHash(next));
                transition.finished.finally(() => {
                    delete document.documentElement.dataset[VIEW_TRANSITION_DIRECTION_ATTR];
                });
            } else {
                // No native slide support: setHash still triggers a plain
                // remount, and the incoming page fades in via the
                // data-page-transition="fade" CSS rule in index.css.
                setHash(next);
            }
        };
        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, []);

    return hash.startsWith("#/docs") ? <DocsPage /> : <App />;
}
