# FP tolerance analysis

Scripts used to determine and validate the ULP-scaled floating-point tolerances
in `src/plugins/tubesheet-layout-generator.ts` (the `ulpTolerance` helper, and
its use in the shell-ID/OTL validation guards and `radialTubeField`). These are
used instead of a set of fixed absolute tolerances (e.g. `1e-9`, `1e-6`) that
would work well at the module's typical mm-scale inputs but had no principled
basis and quietly lost their safety margin at large input magnitudes.

Run them from the repo root:

```bash
npx tsx scripts/fp-tolerance-analysis/01-measure-guard-noise.mjs
npx tsx scripts/fp-tolerance-analysis/02-validate-tolerance-fix.mjs
npx tsx scripts/fp-tolerance-analysis/03-validate-against-real-module.mjs
```

`tsx` is a devDependency of this repo, so `npx tsx` resolves it from
`node_modules` without prompting.

## What each script does

### `01-measure-guard-noise.mjs`

The actual "how many ULPs" measurement. For each of the three computation chains
the tolerances guard, constructs inputs that land *exactly* on the boundary
being checked (so the true/error-free answer is known), sweeps magnitude from 1
to 1 × 10<sup>10</sup>, and reports the worst-case floating-point error
observed, in ULP units. This is the script that produced the number the runtime
default (64 ULPs) is built around.

### `02-validate-tolerance-fix.mjs`

Checks the consequence of the change using the same guard formula as the source:

1. At large magnitude, a fixed 1 × 10<sup>9</sup> tolerance check spuriously
rejects a meaningful fraction of valid, exact-boundary geometry, while the new
ULP-scaled tolerance does not.
2. The new tolerance still correctly rejects geometry that's genuinely invalid
(not just noisy) at realistic scale, confirming it hasn't become too permissive.

### `03-validate-against-real-module.mjs`

The strongest check, and the zero-mirror one: instead of mirroring the guard
formulas, it imports the actual `TubeSheet` class and checks the real end-to-end
invariant (`numTubes >= minTubes` for a shell sized via `findMinID`) across
thousands of layout/geometry combinations, including the small-magnitude regime
discussed below.

Needs `npx tsx` (a devDependency of this repo). No DOM/jsdom required, since
`TubeSheet`'s layout math doesn't touch `document`.

## Why these import the module directly

All three scripts import the real module
(`src/plugins/tubesheet-layout-generator.ts`) rather than re-implementing the
tolerance logic, so the functions they exercise can't silently drift from the
runtime code:

- `01` imports `ulpAt` (the ULP unit noise is measured in) and `roundUp` (the
  snapping helper chain 2 measures) via the module's `ULP_TEST_UTILS` namespace.
- `02` imports `ulpTolerance` (the tolerance being validated) via
  `ULP_TEST_UTILS`.
- `03` imports the `TubeSheet` class and checks it end to end.

These helpers aren't part of the module's public API, and are exposed only
through the `ULP_TEST_UTILS` export. The export exists specifically so these
scripts will always reflect the real implementation after a code change.

The ***arithmetic chains*** these tolerances guard (e.g. the `tubeOD > shellID -
OTLClearance + tolerance` comparison) are inline expressions inside the module
rather than named functions, so `01`/`02` necessarily reproduce those
expressions as-is, as one-line mirrors. 

Tthe standalone-repo sync workflow (`sync-standalone-module.yml`) ships these
scripts alongside the module to enable contributors to check their
implementation.

## Tolerance determination methodology (script `01`)

### 1. **ULP definition**

`ulpAt(magnitude) = 2^(floor(log2(magnitude)) - 52)`

This represents the gap between adjacent representable doubles near `magnitude`,
per IEEE-754.

### 2. **Construct meaningful inputs on the rounding boundary, rather than random inputs**

Random inputs mostly land far from any rounding boundary, where floating-point
noise is invisible. Rounding tests against these outputs would not provide any
meaningful inforamtion on its accuracy.

To measure worst-case boundary noise, each chain's inputs are built so the true
mathematical answer is exactly on boundary.

e.g. for the validation guard: `shellID = tubeOD + OTLClearance` exactly, then
measure how far `tubeOD - (shellID - OTLClearance)` drifts from its true value
of 0.

### 3. **Sweep magnitude and measure error in ULP units**

Dividing the observed absolute error by `ulpAt(referenceMagnitude)` results in
comparable outputs across magnitude buckets. If the ULP-scaling hypothesis is
correct, this ratio should stay roughly consistent across the whole sweep.

### 4. **Result:**

Worst-case error was **~1–1.5 ULPs**, consistent from magnitude 1 to 1 ×
10<sup>10</sup> across all chains tested.

### **Chose the multiplier: 64 ULPs.**

~1.5 ULPs observed → 64 ULPs gives ~43x margin. This isn't derived down to a
theoretical minimum; see "Why 64?" below.

### Why 64?

The observed worst case (~1–1.5 ULPs) would in principle justify a much smaller
multiplier (e.g. 4–8). 64 was chosen instead because:

- `Math.sin`, `Math.asin`, and `Math.log2` are **not** guaranteed to be
  correctly-rounded by IEEE-754 (unlike basic operands such as `+`, `-`, `*`,
  `/`), so their contribution to the measured error is itself empirical, not
  analytically derived. Different JS engines could in principle produce very
  slightly different results.
- The sweep, while wide (1 to 1 × 10<sup>10</sup>, ~1M trials total), is still a
  random sample over specific chains, not a formal worst-case proof over every
  possible operand combination those functions might see.
- A generous, round-number margin over the measurement has no adverse impact to
  the output quality.

If there is a desire to shrink this margin, script `01` may be re-run with a
larger trial count and a wider operand-magnitude ratio spread. Afterwards,
`02`/`03` must be used to perform a regression check.
