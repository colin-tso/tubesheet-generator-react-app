import { fileURLToPath, URL } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import mkcert from "vite-plugin-mkcert";
import mdx from "@mdx-js/rollup";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import remarkDirectiveMdx from "remark-directive-mdx";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

export default defineConfig({
    base: "/tubesheet-generator-react-app/",
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    // mdx() must come before react() so the JSX it emits from .mdx files is
    // then picked up and transformed by the React plugin.
    plugins: [
        mdx({
            remarkPlugins: [
                remarkGfm,
                remarkDirective,
                remarkDirectiveMdx,
                remarkMath,
            ],
            rehypePlugins: [rehypeKatex],
        }),
        react(),
        svgr(),
        mkcert(),
    ],
    build: {
        outDir: "build",
    },
    server: {
        open: false,
    },
    test: {
        environment: "jsdom",
        setupFiles: "./src/setupTests.js",
        globals: true,
        // Local scratch directories can hold stale copies of test files. They
        // are gitignored, so they are not part of the tree, but Vitest's
        // default include glob would still collect them and report a higher
        // test count locally than CI sees. Spread configDefaults.exclude so
        // Vitest's own node_modules/.git exclusions are preserved.
        exclude: [...configDefaults.exclude, ".localtemp/**"],
    },
});
