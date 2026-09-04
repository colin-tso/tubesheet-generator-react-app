---
"tubesheet-generator-react-app": patch
---

Silence `react-hooks/set-state-in-effect` lint error in `PairedFieldRow` by adding an eslint-disable directive with explanation, and fix the `exhaustive-deps` warning by using the full `fieldValues` object in the dependency array.
