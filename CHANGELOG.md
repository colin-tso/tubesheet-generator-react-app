# tubesheet-generator-react-app

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
