# tubesheet-generator

A TypeScript module for computing tube sheet layouts for shell-and-tube heat exchangers: given a tube OD, pitch ratio, and layout angle, the module will
determine how many tubes fit, where each one sits, and the resulting outer tube limit (OTL) and minimum shell ID.

> **This repo is auto-synced — don't edit `src/modules.ts`, `src/utils/LRUCache.ts`, or `tests/modules.test.ts` directly.**
>
> They're mirrored from [`tubesheet-generator-react-app`](https://github.com/colin-tso/tubesheet-generator-react-app) (`src/plugins/tubesheet-layout-generator.ts` and its test file) by a GitHub Actions workflow every time that source changes. Any manual edits to those three files will be overwritten on the next sync. If something here needs fixing, fix it in the react-app repo instead — everything else in this repo (`package.json`, `tsconfig.json`, `vitest.config.ts`, this README) is maintained locally and is safe to edit.

## Install

```bash
npm install colin-tso/tubesheet-generator
```

## Usage

```ts
import { TubeSheet } from "tubesheet-generator";

// Fix the shell ID, get the maximum number of tubes that fit:
const ts = new TubeSheet(
    6.35, // OTLClearance — min. diametrical clearance from tube OD to shell ID
    19.05, // tubeOD
    1.25, // pitchRatio
    30, // layout — 30 | 45 | 60 | 90 | "radial"
    undefined, // minTubes — omit when specifying shellID
    500, // shellID
);

ts.numTubes; // number of tubes that fit
ts.tubeField; // [{ x, y }, ...] — center of every tube
ts.OTL; // outer tube limit
ts.minID; // minimum shell ID needed for this tube count
```

Or fix the minimum tube count instead, and let it work out the required shell
ID:

```ts
const ts = new TubeSheet(6.35, 19.05, 1.25, 30, 50); // minTubes = 50, no shellID
ts.minID; // smallest shell ID that fits at least 50 tubes
```

Every constructor argument is also an assignable property (`ts.tubeOD = 22.2`
recomputes everything). See the JSDoc on `TubeSheet` in `src/modules.ts` for the
full parameter reference.

### SVG output

```ts
ts.svg; // SVGSVGElement
```

`ts.svg` (and the underlying `generateTubeSheetSVG`) build a real `SVGSVGElement` via the DOM `document` API. That means calling it requires a DOM to be present — it works in a browser or bundler context out of the box, but plain Node needs a DOM polyfill such as [`jsdom`](https://github.com/jsdom/jsdom) first. Everything else in this package (`TubeSheet`'s layout math) is plain Node-compatible with no polyfill required.

## Testing

```bash
npm install
npm test
```

Tests run on [Vitest](https://vitest.dev) directly against
`tests/modules.test.ts`.

## Building

```bash
npm run build   # tsc — emits src/modules.js (+ source map)
```

The compiled `src/modules.js` is what `package.json`'s `"main"` points consumers at, and is committed to the repo rather than built on install.

## Provenance

`src/modules.ts` began life as a standalone script and now shares its implementation with the `TubeSheet` plugin used in the [tubesheet-generator-react-app](https://github.com/colin-tso/tubesheet-generator-react-app) React app. That repo is the source of truth for the layout algorithm; this repo exists to publish it as a plain, framework-free npm package.
