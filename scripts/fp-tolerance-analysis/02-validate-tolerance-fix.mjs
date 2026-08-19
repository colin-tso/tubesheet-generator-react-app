#!/usr/bin/env node
// Validates the consequences of switching from fixed absolute tolerances
// (1e-9 / 1e-6) to the ULP-scaled `ulpTolerance` helper, using the same
// boundary-check formula as the `tubeOD > shellID - OTLClearance + tolerance`
// guards in src/plugins/tubesheet-layout-generator.ts.
//
// Two things are checked:
//   A. Fixes a real failure: at large magnitude, the old fixed 1e-9 guard
//      spuriously rejects valid, exact-boundary geometry; the new ULP-scaled
//      guard does not.
//   B. Doesn't overcorrect: the new guard still rejects geometry that is
//      genuinely invalid (not just floating-point noise), at realistic scale.
//
// The tolerance itself (ulpTolerance) is imported directly from the module's
// ULP_TEST_UTILS namespace so it can't drift. The guard expression below
// remains a one-line mirror of the module's inline comparison because that
// comparison is embedded in generateTubeField/tubeFieldOTL rather than being a
// named function -- the same reason script 01 reproduces the chains it
// measures. Script 03 is the zero-mirror end-to-end check. See ../README.md
// for full methodology.
//
// Usage: npx tsx 02-validate-tolerance-fix.mjs [trials]

import { ULP_TEST_UTILS } from "../../src/plugins/tubesheet-layout-generator.ts";

const { ulpTolerance } = ULP_TEST_UTILS;

const trials = Number(process.argv[2]) || 20_000;

/**
 * The exact guard expression from generateTubeField / tubeFieldOTL:
 * `tubeOD > shellID - OTLClearance + tolerance`. Returns true if the guard
 * (spuriously or genuinely) rejects the input.
 */
function guardRejects(shellID, OTLClearance, tubeOD, tolerance) {
    return tubeOD > shellID - OTLClearance + tolerance;
}

// -----------------------------------------------------------------------
// A. Large-magnitude spurious-rejection rate: old fixed 1e-9 vs new
// ULP-scaled tolerance, both tested against exact-boundary geometry
// (shellID = tubeOD + OTLClearance, so the guard should never fire).
// -----------------------------------------------------------------------
console.log("A. Large-magnitude (~1e6-1e8) spurious rejection of exact-boundary geometry");
console.log("-".repeat(76));

let oldRejections = 0;
let newRejections = 0;
for (let i = 0; i < trials; i++) {
    const tubeOD = Math.random() * 5e7 + 1e6;
    const OTLClearance = Math.random() * 5e7;
    const shellID = tubeOD + OTLClearance; // exact boundary: should always be admitted

    if (guardRejects(shellID, OTLClearance, tubeOD, 1e-9)) oldRejections++;
    if (guardRejects(shellID, OTLClearance, tubeOD, ulpTolerance(Math.max(shellID, OTLClearance, tubeOD)))) {
        newRejections++;
    }
}
console.log(`  Old fixed tolerance (1e-9):        ${oldRejections}/${trials} spurious rejections (${(100 * oldRejections / trials).toFixed(2)}%)`);
console.log(`  New ULP-scaled tolerance (64 ULPs): ${newRejections}/${trials} spurious rejections (${(100 * newRejections / trials).toFixed(2)}%)`);

// -----------------------------------------------------------------------
// B. Tightness: geometry that's genuinely invalid by a fixed real margin
// (not floating-point noise) must still be rejected, at realistic mm-scale
// tubesheet dimensions.
// -----------------------------------------------------------------------
console.log("\nB. Tightness check: genuinely invalid geometry at realistic (mm) scale");
console.log("-".repeat(76));

const overageMargins = [0.1, 0.01, 0.001]; // mm over the limit -- all should be rejected
for (const overage of overageMargins) {
    let wronglyAccepted = 0;
    for (let i = 0; i < trials; i++) {
        const OTLClearance = Math.random() * 20;
        const maxOTL = Math.random() * 100 + 10;
        const tubeOD = maxOTL + overage; // genuinely over the limit
        const shellID = maxOTL + OTLClearance;

        if (!guardRejects(shellID, OTLClearance, tubeOD, ulpTolerance(Math.max(shellID, OTLClearance, tubeOD)))) {
            wronglyAccepted++;
        }
    }
    const status = wronglyAccepted === 0 ? "OK" : "FAIL";
    console.log(`  [${status}] ${overage}mm over limit: ${wronglyAccepted}/${trials} wrongly accepted`);
}

console.log(
    "\nNote: this exercises the guard formula directly (mirroring the source), not\n" +
        "the TubeSheet class itself. The project's own test suite\n" +
        "(src/plugins/tubesheet-layout-generator.test.ts, run via `npm test`) is the\n" +
        "source of truth for end-to-end correctness of the actual module.",
);