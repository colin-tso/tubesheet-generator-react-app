// vite.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
export default defineConfig({
    base: "/tubesheet-generator-react-app/",
    plugins: [react(), svgr()],
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
