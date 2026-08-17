---
"tubesheet-generator-react-app": minor
---

Improve radial tube layout packing. Rings now grow outward from five centre patterns (a central tube, or rings of 2, 3, 4, or 5 tubes spaced exactly one pitch apart), so many more minimum-tube-count targets resolve to exactly that many tubes and a given shell can hold more tubes. Also fix a bug where the radial layout value stored by the UI could hang the layout worker, and add a rounding tolerance when generating the tube field.
