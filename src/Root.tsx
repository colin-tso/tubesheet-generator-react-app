import { useEffect, useState } from "react";
import App from "./App";
import { DocsPage } from "./pages/docs/DocsPage";

// Two routes total, so a full router dependency isn't worth pulling in.
// "#/docs" and "#/docs/<section-id>" render the docs page; everything else
// (including no hash at all) renders the calculator.
export function Root() {
    const [hash, setHash] = useState(window.location.hash);

    useEffect(() => {
        const onHashChange = () => {
            const next = window.location.hash;
            // Cross-fades the calculator <-> docs swap via the browser's
            // native View Transition API instead of an instant remount.
            // React's <ViewTransition> component needs react@canary, which
            // this app doesn't run, so this calls the DOM API directly;
            // see index.css for the prefers-reduced-motion guard.
            if (document.startViewTransition) {
                document.startViewTransition(() => setHash(next));
            } else {
                setHash(next);
            }
        };
        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, []);

    return hash.startsWith("#/docs") ? <DocsPage /> : <App />;
}
