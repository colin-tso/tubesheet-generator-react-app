#!/usr/bin/env node
// Node's ESM loader requires explicit file extensions on relative imports. tsc
// doesn't add them (the shared TS source is bundler-resolved and intentionally
// has none), so after compiling, patch every relative import specifier in every
// emitted .js file — whatever files tsc happened to produce, not a fixed list.
//
// Usage: node fix-esm-extensions.mjs <dir>

import fs from "node:fs";
import path from "node:path";

const [, , dir] = process.argv;
if (!dir) {
    console.error("Usage: node fix-esm-extensions.mjs <dir>");
    process.exit(1);
}

const IMPORT_RE = /from\s+(["'])(\.[^"']+)\1/g;

function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
            walk(full);
            continue;
        }
        if (!entry.name.endsWith(".js")) continue;

        const content = fs.readFileSync(full, "utf8");
        const fixed = content.replace(IMPORT_RE, (match, quote, specifier) => {
            if (/\.[cm]?js$/.test(specifier)) return match; // already has an extension
            return `from ${quote}${specifier}.js${quote}`;
        });

        if (fixed !== content) {
            fs.writeFileSync(full, fixed);
            console.log(`Patched extensions in ${full}`);
        }
    }
}

walk(dir);
