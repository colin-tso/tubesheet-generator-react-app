---
"tubesheet-generator-react-app": minor
---

Save a tubesheet layout, reopen it, and share it.

- **Save as JSON** writes the current calculation inputs to a `tubesheet-config.json` file. Only fields holding a valid number are written, so a partly filled form still produces a loadable file.
- **Load JSON** reads one back, either by picking the file or by dropping it anywhere on the drawing. Fields that fail validation are reported on the button rather than blocking the load, so a mostly-valid config still applies what it can.
- **Copy Shareable Link** puts a URL that restores the same inputs on the clipboard.

A shared link is applied on load, including on first paint, so a link someone sends you opens on the design they meant. Loaded values are validated against the same rules the input fields enforce, with an upper bound so a hand-edited file can't push an unbounded number into the calculation.

Mobile gets a real layout: Form and Drawing become separate full-screen tabs (neither unmounts, so the live preview keeps calculating), the form header hides and reappears as you scroll, and a bottom toolbar with a consolidated export sheet replaces the view toggles and export buttons that used to disappear at narrow widths. Export and copy buttons now show a brief success state, and the drawing reserves space below the data table based on the table itself rather than on the footer that wraps it.
