# tubesheet-generator-react-app

## 2.7.0

### Minor Changes

- 8096fd4: Add shell size comparison sweep panel

## 2.6.0

### Minor Changes

- 9043457: Add tube labels toggle to viewport toolbar. When enabled, numbered labels are drawn at each tube's centre and reflected in SVG/PNG/PDF exports.

## 2.5.0

### Minor Changes

- 0c90223: Add PDF export for tube sheet drawings

### Patch Changes

- 67f895d: Add info icon header to Note component
- 4352569: Group SVG and PNG save buttons inside a shared background fill
- a7ed687: Polish context menu item hover highlight with inset rounded fill

## 2.4.0

### Minor Changes

- 8a7c3ea: Add PNG and SVG export via save button with context menu

## 2.3.1

### Patch Changes

- db26a89: Upgrade `changesets/action` from v1 to v2 in the dev release workflow. Updates the deprecated `commit`/`title` inputs to `commit-message`/`pr-title`, and moves the org PAT from the `GITHUB_TOKEN` env var to the `github-token` input, both required by v2.

## 2.3.0

### Minor Changes

- 9bb3d9b: Add horizontal overflow scroll for overflowing KaTeX formulas in docs

### Patch Changes

- 9bb3d9b: Reorder note block in patterns documentation

## 2.2.1

### Patch Changes

- 5753994: Show valid (green) glow on read-only fields during calculation. Debounce the muted color change on temporarily read-only inputs so brief calculations don't flash the grey styling. Export live preview timing constants for test use.

## 2.2.0

### Minor Changes

- 95e8adc: Refine radial diagram visuals on the docs pages

### Patch Changes

- fa114c8: fix: use className instead of class in MDX tables
- 8c89ea0: add scanQuarterField count-only bisection path
- 8c89ea0: perf: speed up SVG generation via move-merge and group-style wrappers, identical output
- fa114c8: docs: add reading progress bar, fix cross-reference link styling, fix horizontal overflow
- 8c89ea0: raise live-preview limits due to faster worker computation
- 8c89ea0: perf: speed up tube-field generation (axis-partition symmetry for grid layouts; count-then-build for radial), identical output

## 2.1.0

### Minor Changes

- 123aa93: feat: add a "?" help button to the viewport's top-left corner linking to the layout-math docs, replacing the footer link and preloading the docs chunk on hover/focus

### Patch Changes

- 123aa93: fix: give each theme toggle a unique checkbox id so the docs-page toggle drives its own switch instead of the hidden calculator one
- 285a06d: fix: keep the theme toggle in sync across the calculator and docs pages by lifting theme state into a shared ThemeProvider
- 36f1c4b: perf: hoist tube-field generation helpers off the search hot path and harden module types (no behavioral change)
- 26b6750: fix: compute non-radial tube fields at full float precision so tied layouts produce identical shell sizes
- 3963993: fix: scale floating-point tolerance checks by operand ULP instead of fixed 1e-9 constants
- ea696ea: fix: mobile docs topbar with collapsible ToC and app logo

## 2.0.0

### Major Changes

- 7a8b6c5: Improve radial tube layout packing. Rings now grow outward from five centre patterns (a central tube, or rings of 2, 3, 4, or 5 tubes spaced exactly one pitch apart), so many more minimum-tube-count targets resolve to exactly that many tubes and a given shell can hold more tubes.
  
  **Breaking change:** radial layout results no longer match previous outputs. For the same inputs, the tube count and arrangement can differ. A given shell can hold more tubes, and a given minimum-tube-count can resolve to fewer, differently arranged tubes at a smaller shell. For example, `shellID=500` now packs 331 tubes (was 308), and `minTubes=50` now resolves to exactly 50 tubes (was 62 at a larger shell).
  
  **Why:** the previous scheme was a single ring layout, jumping between coarse ring counts. At moderate tube numbers the diameter becomes very large compared to other layout options and would never be used. The new implementatino of multiple concentric rings packs a shell more densely and resolves many more requested tube counts exactly.
  
  **How to update:** the `TubeSheet` API and all input parameters are unchanged. Do not rely on old radial counts, coordinates, or derived shell IDs. Recompute layouts rather than reusing results from an older version, and re-validate any hardcoded or cached expectations (tests, snapshots, saved designs, downstream sizing logic).
  
  Also fix a bug where the radial layout value stored by the UI could hang the layout worker, and add a rounding tolerance when generating the tube field.

### Minor Changes

- 496a8b2: Add in-app docs pages covering tubesheet layout math, with KaTeX-rendered formulas, cross-referenced equations/tables, custom diagrams, and a slide transition between the calculator and docs views.
- 3c5624e: Lazy-load the docs route and preserve calculator/docs state across navigation. The docs chunk (KaTeX, MDX, diagrams) now loads only on first visit and is pre-warmed by hovering or focusing the 'How the layout math works' link, so the calculator shell loads faster. Once visited, both routes stay mounted (the inactive one hidden), so calculator inputs and the docs scroll position survive switching back and forth.

### Patch Changes

- 22c9c58: Fix missing tubes in small tube counts in tubesheet-layout-generator due to floating point error and a row x-position not being reset
