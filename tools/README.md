# tools/

Development helpers. None of them are required at runtime.

| Script | Purpose |
| --- | --- |
| `audit-push.py` | Push the workspace to GitHub via the Contents API: walks the repo (no hand-written file list), verifies with a recursive tree, and deletes files that were removed locally. |
| `assemble-cards.py` | One-off assembler for the Number-Theory card table. |
| `browser-check-drag.cjs` | Real-browser check for group dragging: drag → click → no snap-back, and a mid-drag `pointercancel` must not record a half-way position. Needs a running Studio and `puppeteer`. |
| `browser-check-canvas.cjs` | Real-browser check for canvas interaction: no element covers a card, clicking selects, dependency highlighting is visible, the attach button is wired. Needs a running Studio and `puppeteer`. |
| `browser-check-ui.cjs` | Real-browser check for the UI: no Chinese left in the English chrome, no AI-facing wording, and every mode toggle visibly changes state. Needs a running Studio and `puppeteer`. |

Run the browser checks like this (the Studio keeps an SSE stream open, so they wait on
`domcontentloaded` rather than `networkidle`):

They are CommonJS (`.cjs`) because the repo is `"type": "module"`.

```bash
of studio --no-open &                     # or any running instance on 127.0.0.1:4319
NODE_PATH=<puppeteer-workspace>/node_modules node tools/browser-check-ui.cjs
NODE_PATH=<puppeteer-workspace>/node_modules node tools/browser-check-canvas.cjs
```
