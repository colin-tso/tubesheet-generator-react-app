import { useEffect, useRef, useState } from "react";
import App from "./App";
import { DocsPage } from "./pages/docs/DocsPage";

const VIEW_TRANSITION_DIRECTION_ATTR = "viewTransitionDirection";

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

            const wasDocs = previous.startsWith("#/docs");
            const isDocs = next.startsWith("#/docs");
            // Only the calculator <-> docs boundary gets a directional
            // slide; hash changes within docs (e.g. TOC links) leave the
            // attribute unset so they fall back to the default cross-fade
            // instead of re-triggering a page-level slide.
            const crossesBoundary = wasDocs !== isDocs;

            // Slides the calculator <-> docs swap via the browser's native
            // View Transition API instead of an instant remount. React's
            // <ViewTransition> component needs react@canary, which this
            // app doesn't run, so this calls the DOM API directly; see
            // index.css for the slide keyframes and the
            // prefers-reduced-motion guard.
            if (document.startViewTransition) {
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
                setHash(next);
            }
        };
        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, []);

    return hash.startsWith("#/docs") ? <DocsPage /> : <App />;
}
