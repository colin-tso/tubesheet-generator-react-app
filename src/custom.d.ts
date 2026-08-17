/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

declare module "*.css" {
    const classes: { [key: string]: string };
    export default classes;
}

declare module "*.mdx" {
    import type { ComponentType } from "react";
    import type { MDXComponents } from "mdx/types";
    const MDXComponent: ComponentType<{ components?: MDXComponents }>;
    export default MDXComponent;
}
