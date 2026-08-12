#!/usr/bin/env node
// Recursively syncs a module and its local (relative-import) dependencies from
// the react-app repo into the standalone repo, rewriting each relative import
// specifier to the correct path in the new location.
//
// Usage: node sync-relative-imports.mjs <sourceRoot> <targetRoot>
//
// Entry points are explicitly mapped, since the standalone package deliberately
// renames/relocates its public entry files. Everything each entry point imports
// relatively (transitively) is discovered automatically and mirrored at the
// same relative path under the target repo — so a new util file, or a new
// import inside an existing one, needs no changes here.

import fs from "node:fs";
import path from "node:path";

const [, , sourceRoot, targetRoot] = process.argv;
if (!sourceRoot || !targetRoot) {
    console.error("Usage: node sync-relative-imports.mjs <sourceRoot> <targetRoot>");
    process.exit(1);
}

// source path (relative to sourceRoot) -> target path (relative to targetRoot)
const ENTRY_POINTS = {
    "src/plugins/tubesheet-layout-generator.ts": "src/modules.ts",
    "src/plugins/tubesheet-layout-generator.test.ts": "tests/modules.test.ts",
};

const IMPORT_RE = /from\s+["'](\.[^"']+)["']/g;

/** Resolve a relative import specifier against an actual .ts file on disk. */
function resolveSpecifier(fromFileAbs, specifier) {
    const base = path.resolve(path.dirname(fromFileAbs), specifier);
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`]) {
        if (fs.existsSync(candidate)) return candidate;
    }
    throw new Error(`Could not resolve "${specifier}" from ${fromFileAbs}`);
}

// canonical source-relative path -> target-relative path
const mapping = new Map();
// queue of canonical source-relative paths still needing to be processed
const queue = [];

for (const [srcRel, dstRel] of Object.entries(ENTRY_POINTS)) {
    mapping.set(srcRel, dstRel);
    queue.push(srcRel);
}

const fileContents = new Map(); // srcRel -> raw content (post-copy, pre-rewrite)

while (queue.length > 0) {
    const srcRel = queue.shift();
    const srcAbs = path.join(sourceRoot, srcRel);
    const content = fs.readFileSync(srcAbs, "utf8");
    fileContents.set(srcRel, content);

    for (const match of content.matchAll(IMPORT_RE)) {
        const specifier = match[1];
        const depAbs = resolveSpecifier(srcAbs, specifier);
        const depSrcRel = path.relative(sourceRoot, depAbs).split(path.sep).join("/");

        if (!mapping.has(depSrcRel)) {
            // Default policy: mirror the same relative path under the target
            // repo that it has under the source repo. Only entry points get an
            // explicit override (above).
            mapping.set(depSrcRel, depSrcRel);
            queue.push(depSrcRel);
        }
    }
}

// Now that every file's target location is known, write each one out with its
// relative imports rewritten to match.
for (const [srcRel, dstRel] of mapping) {
    const content = fileContents.get(srcRel) ?? fs.readFileSync(path.join(sourceRoot, srcRel), "utf8");
    const dstAbs = path.join(targetRoot, dstRel);
    const dstDir = path.dirname(dstAbs);

    const rewritten = content.replace(IMPORT_RE, (full, specifier) => {
        const srcAbs = path.join(sourceRoot, srcRel);
        const depAbs = resolveSpecifier(srcAbs, specifier);
        const depSrcRel = path.relative(sourceRoot, depAbs).split(path.sep).join("/");
        const depDstRel = mapping.get(depSrcRel);
        if (!depDstRel) {
            throw new Error(`Internal error: no target mapping for ${depSrcRel}`);
        }

        let newSpecifier = path
            .relative(dstDir, path.join(targetRoot, depDstRel))
            .replace(/\.tsx?$/, "")
            .split(path.sep)
            .join("/");
        if (!newSpecifier.startsWith(".")) newSpecifier = `./${newSpecifier}`;

        return full.replace(specifier, newSpecifier);
    });

    fs.mkdirSync(dstDir, { recursive: true });
    fs.writeFileSync(dstAbs, rewritten);
    console.log(`${srcRel} -> ${dstRel}`);
}
