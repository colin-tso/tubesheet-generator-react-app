---
"tubesheet-generator-react-app": minor
---

Add **Save Coordinates (CSV)** to the export menu (desktop dropdown, mobile export sheet and right-click menu). It writes `tubesheet-coordinates.csv` with one row per tube — `Tube_Index, X_mm, Y_mm, Radius_mm, Diameter_mm` — for CNC drilling and CMM/QA use. Tube numbers match the on-drawing tube labels, and coordinates are in mm from the shell centre with Y up, matching the DXF export.
