---
"tubesheet-generator-react-app": minor
---

Lazy-load the docs route and preserve calculator/docs state across navigation. The docs chunk (KaTeX, MDX, diagrams) now loads only on first visit and is pre-warmed by hovering or focusing the 'How the layout math works' link, so the calculator shell loads faster. Once visited, both routes stay mounted (the inactive one hidden), so calculator inputs and the docs scroll position survive switching back and forth.
  