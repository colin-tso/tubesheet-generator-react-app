// Single source of truth for the DocsPage dynamic import. The browser/bundler
// dedupes repeated import() calls of the same specifier, so calling this again
// after it's already resolved (e.g. Root.tsx awaiting it right before a view
// transition, after FormFooter.tsx already preloaded it on hover) is a no-op
// that returns the cached module.
export const loadDocsPage = () => import("./DocsPage").then((m) => m.DocsPage);
