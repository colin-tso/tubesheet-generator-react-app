# Calculator and Visualiser for Tubesheet Layouts

![Calculator and Visualiser for Tubesheet Layouts](/public/og-image.svg?raw=true&sanitize=true)

## About

The Calculator and Visualiser for Tubesheet Layouts is a web app built with React, TypeScript, and Vite. It acts as a UI wrapper for the [`tubesheet-layout-generator`](https://github.com/colin-tso/tubesheet-generator) Node.js module, letting users define a tubesheet layout for single-pass shell and tube exchangers and get back calculated properties and a rendered sketch. This app may also be used to for any similar designs or equipment such as filter vessels.

![App screenshot](/readme-screenshot.png?raw=true&sanitize=true)

## How it works

1. The React app validates user inputs in a form before calling module functions.
2. The `tubesheet-layout-generator` module calculates tubesheet properties and generates a sketch of the defined layout.
3. Calculations run in a Web Worker (`tubesheet.worker.ts`) so the UI stays responsive while a layout is generated, with results shown live as a preview.
4. The generated layout includes an SVG sketch and and optional data table, with the ability to export as SVG, PNG, PDF or DXF (PNG encoding also runs off the main thread, via `pngEncode.worker.ts`).

## Features

- Live preview of the tubesheet layout as form inputs change
- SVG and data table views of the generated layout
- Export to SVG, PNG, PDF or DXF
- Dark mode toggle
- Installable as a PWA (manifest + icons included)

## Accessing the App

[Click Here to access the app](https://colin-tso.github.io/tubesheet-generator-react-app)

## Development

### Prerequisites

- Node.js
- npm >= 8.3.0

### Setup

```bash
npm install
```

### Scripts

| Command | Description |
| --- | --- |
| `npm start` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) and build for production |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run tests with Vitest |
| `npm run lint` | Run ESLint |
| `npm run deploy` | Build and deploy to GitHub Pages |

## Tech Stack

- [React](https://react.dev/) 19 + TypeScript
- [Vite](https://vitejs.dev/) for dev server and bundling
- [Vitest](https://vitest.dev/) + Testing Library for tests
- ESLint + Stylelint for linting
- Web Workers for off-main-thread layout calculation and PNG encoding

## Key Dependencies

- [`tubesheet-layout-generator`](https://github.com/colin-tso/tubesheet-generator) — the underlying layout calculation module (used via the `plugins/` wrapper)
- `react-number-format` — masked numeric inputs
- `lodash.memoize` — memoisation for calculation caching
- [`jspdf`](https://github.com/parallax/jsPDF) + [`svg2pdf.js`](https://github.com/yWorks/svg2pdf.js) — PDF export rendering
- [`@tarikjabiri/dxf/dxf`](https://github.com/tarikjabiri/js-dxf) – DXF export

See `package.json` for the full dependency list.

## License

GPL-3.0-only
