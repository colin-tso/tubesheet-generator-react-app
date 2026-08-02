import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import mkcert from "vite-plugin-mkcert";

export default defineConfig({
    base: "/tubesheet-generator-react-app/",
    plugins: [react(), svgr(), mkcert()],
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
