#!/usr/bin/env node
// Measures, in ULP units, how much floating-point noise actually occurs in
// the three specific computation chains that tubesheet-layout-generator.ts
// guards with a tolerance. This is the script that determined the "~1-1.25
// ULP worst case" figure the 64-ULP default tolerance is built around.
//
// Unlike the runtime guard itself, the *arithmetic chains* it measures are
// inline expressions inside the module (not named functions), so each chain
// below reproduces the exact expression as-is. What these scripts do import
// directly from the module is the tolerance machinery itself, via the module's
// ULP_TEST_UTILS namespace: ulpAt (the ULP unit the noise is measured in) and
// roundUp (the snapping helper chain 2 measures) -- so those can never drift
// from the real implementation. See README.md for full methodology and how to
// read the output.
//
// Usage: npx tsx 01-measure-guard-noise.mjs [trialsPerBucket]

import { ULP_TEST_UTILS } from "../../src/plugins/tubesheet-layout-generator.ts";

const { ulpAt, roundUp } = ULP_TEST_UTILS;

const trialsPerBucket = Number(process.argv[2]) || 100_000;
const magnitudeBuckets = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10];

/** Measures `observed`'s deviation from `trueValue` in units of ULP at
 * `referenceMagnitude`, using the module's own ulpAt so the units match the
 * runtime tolerance exactly. */
const errorInUlps = (observed, trueValue, referenceMagnitude) =>
    (observed - trueValue) / ulpAt(referenceMagnitude);

/**
 * Runs `trials` random samples at each magnitude in `magnitudeBuckets`,
 * calling `sample(magnitude)` for each and printing the worst-case error in
 * ULP units per bucket, plus the overall worst case.
 *
 * `sample` must return a signed ULP error (use errorInUlps, or compute it
 * directly). `mode` controls how that signed error is interpreted:
 *
 *  - "symmetric" (default): both directions represent genuine
 *    floating-point noise away from a true value of 0, so the worst case is
 *    the largest |error|. Appropriate for chains 1 and 3 below.
 *
 *  - "violation-only": the comparison has a *designed* one-directional
 *    safety margin (e.g. from a ceiling/roundUp), so a negative error is
 *    intentional slack, not noise -- only positive error is a genuine
 *    violation of the guarantee being checked. Appropriate for chain 2
 *    below (see its comment for why). Using "symmetric" mode here would
 *    wrongly report the *size of the intentional safety margin* as if it
 *    were noise the tolerance needs to absorb.
 */
function sweep(label, sample, mode = "symmetric") {
    console.log(`\n${label}`);
    console.log("-".repeat(label.length));
    let overallMax = 0;
    for (const magnitude of magnitudeBuckets) {
        let bucketMax = 0;
        for (let i = 0; i < trialsPerBucket; i++) {
            const signedErr = sample(magnitude);
            const ulpErr = mode === "violation-only" ? signedErr : Math.abs(signedErr);
            if (ulpErr > bucketMax) bucketMax = ulpErr;
        }
        if (bucketMax > overallMax) overallMax = bucketMax;
        console.log(`  magnitude ~${magnitude.toExponential(0).padEnd(7)}  worst-case error: ${bucketMax.toFixed(3)} ULPs`);
    }
    console.log(`  => overall worst case across all magnitudes: ${overallMax.toFixed(3)} ULPs`);
    return overallMax;
}

// -----------------------------------------------------------------------
// Chain 1: the `tubeOD > shellID - OTLClearance + tolerance` validation
// guards. Construct shellID EXACTLY at the boundary (shellID = tubeOD +
// OTLClearance) so the true, error-free answer is exactly 0, then measure
// how far `tubeOD - (shellID - OTLClearance)` drifts from 0.
// -----------------------------------------------------------------------
const chain1Max = sweep(
    "Chain 1: tubeOD vs (shellID - OTLClearance)",
    (magnitude) => {
        const tubeOD = Math.random() * magnitude * 0.3 + 1e-6;
        const OTLClearance = Math.random() * magnitude * 0.3;
        const shellID = tubeOD + OTLClearance; // exact boundary by construction
        const err = tubeOD - (shellID - OTLClearance); // true value is exactly 0
        const refMag = Math.max(shellID, OTLClearance, tubeOD);
        return errorInUlps(err, 0, refMag);
    },
);

// -----------------------------------------------------------------------
// Chain 2: the boundary-tube re-admission slack, i.e. whether
// roundUp(OTL + OTLClearance, 8) - OTLClearance - tubeOD, halved, is still
// >= R after a full round-trip through the snapping used in findMinID.
//
// IMPORTANT: unlike chains 1 and 3, this comparison has a *designed*
// one-directional safety margin. roundUp's ceiling guarantees
// maxOTL = roundUp(OTL + OTLClearance, 8) - OTLClearance is
// mathematically >= OTL, often by as much as the full 1e-8 decimal-place
// grid spacing -- that slack is intentional, not floating-point noise, and
// can dwarf genuine ULP-scale error by many orders of magnitude (a first
// pass at this measurement that used |error| here reported ~2.5 billion
// "ULPs" at small magnitudes, which was entirely this designed margin, not
// noise -- see the README's "A wrong turn worth keeping" section).
//
// What BOUND_TOLERANCE actually needs to cover is only the other
// direction: can the *floating-point arithmetic itself* (the roundUp
// multiply/ceil/divide, then the subtract/subtract/divide chain that
// produces maxCentreDist) push the result to be smaller than the
// mathematical guarantee promises, even by a hair? That's captured by
// "violation-only" mode: only a positive (R > maxCentreDist) result counts.
//
// roundUp is imported from the module so this measures the real snapping
// helper, not a copy.
// -----------------------------------------------------------------------
const chain2Max = sweep(
    "Chain 2: boundary-tube re-admission slack (R - maxCentreDist)",
    (magnitude) => {
        const R = Math.random() * magnitude * 0.4 + 1e-6;
        const tubeOD = Math.random() * magnitude * 0.2 + 1e-6;
        const OTLClearance = Math.random() * magnitude * 0.2;
        const OTL = 2 * R + tubeOD;
        const shellID = roundUp(OTL + OTLClearance, 8);
        const maxOTL = shellID - OTLClearance;
        const maxCentreDist = (maxOTL - tubeOD) / 2;
        const err = R - maxCentreDist; // true value is <= 0; positive = genuine violation
        const refMag = Math.max(shellID, OTLClearance, tubeOD, R);
        return errorInUlps(err, 0, refMag);
    },
    "violation-only",
);

// -----------------------------------------------------------------------
// Chain 3: chord length vs pitch in the ring-count verification loop.
// Construct radius EXACTLY at the value that puts a k-tube ring's chord at
// pitch, so the true value of (pitch - chord) is exactly 0.
// -----------------------------------------------------------------------
const chain3Max = sweep(
    "Chain 3: chord vs pitch (ring-count verification)",
    (magnitude) => {
        const pitch = Math.random() * magnitude * 0.5 + 1e-6;
        const k = Math.floor(Math.random() * 500) + 2;
        const radius = pitch / (2 * Math.sin(Math.PI / k)); // exact boundary by construction
        const chord = 2 * radius * Math.sin(Math.PI / k);
        const err = pitch - chord; // true value is exactly 0
        const refMag = Math.max(pitch, radius);
        return errorInUlps(err, 0, refMag);
    },
);

// -----------------------------------------------------------------------
// Summary + the margin the chosen default (64 ULPs) gives over what was
// actually observed.
// -----------------------------------------------------------------------
const overall = Math.max(chain1Max, chain2Max, chain3Max);
const defaultUlps = 64;
console.log("\nSummary");
console.log("-------");
console.log(`Observed worst case across all three chains: ${overall.toFixed(3)} ULPs`);
console.log(`Runtime default tolerance: ${defaultUlps} ULPs`);
console.log(`Safety margin: ${(defaultUlps / overall).toFixed(1)}x over observed worst case`);
console.log(
    "\nNote: this is an empirical sweep, not a formal worst-case proof. Math.sin/\n" +
        "Math.asin/Math.log2 aren't guaranteed correctly-rounded by IEEE-754 (unlike\n" +
        "+, -, *, /), so their contribution here is measured, not derived analytically.\n" +
        "The 64-ULP default carries deliberate extra margin over this measurement for\n" +
        "that reason — see the README for the full reasoning.",
);