#!/usr/bin/env node
// The strongest of the three checks, and the zero-mirror one: it imports the
// actual TubeSheet class from src/plugins/tubesheet-layout-generator.ts and
// checks the real invariant end to end: for a shellID derived via
// findMinID(minTubes, ...), does the resulting TubeSheet always have
// numTubes >= minTubes?
//
// This can't drift from the source the way a mirrored formula can. Like 01 and
// 02 (which import ulpAt/ulpTolerance/roundUp from the module), it runs via
// `tsx` rather than plain `node`, since it imports the TypeScript module.
//
// Requires: tsx (a devDependency of this repo). No DOM/jsdom needed --
// TubeSheet's layout math is plain Node-compatible; only the separate `.svg`
// getter needs a DOM, and this script never touches it.
//
// Usage: npx tsx 03-validate-against-real-module.mjs

import { TubeSheet } from "../../src/plugins/tubesheet-layout-generator.ts";

// TubeSheet logs internally via console.error on invalid configurations
// rather than throwing; silence that for this sweep since we're checking
// results (numTubes/tubeField), not exception behaviour.
const originalConsoleError = console.error;
console.error = () => {};

function runSweep(label, cases) {
    let checked = 0;
    let violations = 0;
    const examples = [];
    for (const { layout, minTubes, tubeOD, pitchRatio, OTLClearance } of cases) {
        checked++;
        const ts = new TubeSheet(OTLClearance, tubeOD, pitchRatio, layout, minTubes);
        if (ts.numTubes === null || ts.numTubes < minTubes) {
            violations++;
            if (examples.length < 5) {
                examples.push({ layout, minTubes, tubeOD, pitchRatio, OTLClearance, got: ts.numTubes });
            }
        }
    }
    console.log(`${label}: checked ${checked}, violations: ${violations}`);
    for (const ex of examples) console.log("  VIOLATION:", ex);
    return violations;
}

function* combinations(layouts, minTubesRange, geometries) {
    for (const layout of layouts) {
        for (let minTubes = minTubesRange[0]; minTubes <= minTubesRange[1]; minTubes++) {
            for (const [tubeOD, pitchRatio, OTLClearance] of geometries) {
                yield { layout, minTubes, tubeOD, pitchRatio, OTLClearance };
            }
        }
    }
}

const layouts = [30, 45, 60, 90, "radial"];

let totalViolations = 0;

// Realistic mm-scale tubesheet dimensions (the primary intended use case).
totalViolations += runSweep(
    "Realistic mm-scale",
    combinations(layouts, [1, 400], [
        [19.05, 1.25, 6.35],
        [6.35, 1.33, 3.2],
        [25.4, 1.5, 9.5],
        [12.7, 1.2, 4.0],
    ]),
);

// Small-scale: specifically targets the magnitude regime where the
// mirrored chain-2 script (01-measure-guard-noise.mjs) found the decimal
// rounding grid could in principle dominate. Confirms the real algorithm's
// lattice-constrained geometry doesn't hit that pathological case in
// practice -- see the README's "A wrong turn worth keeping" section.
totalViolations += runSweep(
    "Small-scale (sub-mm)",
    combinations(layouts, [1, 15], [
        [0.0015, 1.25, 0.0024],
        [0.003, 1.2, 0.001],
        [0.002, 1.33, 0.0018],
    ]),
);

console.error = originalConsoleError;

console.log(`\nTotal violations across all sweeps: ${totalViolations}`);
if (totalViolations > 0) process.exitCode = 1;
