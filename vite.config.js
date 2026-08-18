import { defineConfig } from "vitest/config";
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
    },
});
