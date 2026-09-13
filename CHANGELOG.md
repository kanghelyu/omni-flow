# Changelog

All notable changes to OmniFlow are documented here. Formats: Keep a Changelog, SemVer.

## 0.2.1 — 2026-09-13

### Studio fixes
- **Fluid mode right-edge tearing fixed**: the canvas bitmap now re-syncs whenever the
  viewport changes (side-panel toggle, split drag, reading mode), not only on window resize.
  A `ResizeObserver` on `#viewport` with rAF-coalesced resizing eliminates the smeared
  stale-frame stripe that appeared at the right edge after those operations.
- **Inspector details now show the full note**: selecting a card renders the 120-char summary
  instantly, then fetches `notes/<nodeId>.md` and re-renders the full Markdown + KaTeX view.
  Switching cards discards stale responses; a failed fetch keeps the summary (same policy as
  reading mode). Saving routes the note through the long-note endpoint — LaTeX gate applied,
  summary regenerated — and refuses to write when the full text was never loaded, so a failed
  fetch can never overwrite the full note with its summary. The legacy `node.note` field is no
  longer written by the inspector (no second full-text copy inside `graph.json`).

### Docs
- The **release process** (version single-source, CHANGELOG, smoke baseline, audit-push,
  `gh release create`, local install) is documented in `skills/omni-flow/SKILL.md`.

## 0.2.0 — 2026-09-13

### Layout engine
- The default "layered" layout is now a **packed layered** engine: direction-aware (TD/LR),
  node-count-adaptive packing with band wrapping, plus a guaranteed overlap-free post-pass
  (minimum-translation push-apart with a lattice-dispersion fallback for pathological inputs).
- Quality bar enforced by tests: every mode is overlap-free (no pair overlapping >4px on both
  axes) and bounded at ≤6:1 span aspect. A 162-node theorem-dependency map went from a
  1654×14418 ribbon (1:8.7) to 2916×3552 (1.22:1).

### Studio interaction
- Group boxes are selectable in both modes (accent border + glow, inspector group-list
  highlight/scroll). Right-click menus and drag behaviour unchanged.
- **Drag / live-reload race fixed** (root cause of cards piling up): node and group drags now
  resolve live objects by id instead of holding pre-render references, so a reload that lands
  mid-drag can no longer commit stale coordinates.
- Panning no longer clears the selection — only a plain click on empty space does. Dependency
  highlighting therefore survives panning in both modes.
- Stronger dependency highlighting: non-dependency edges fade to near-invisible (opacity .07),
  dependency edges thicken with a glow.
- Escape / empty-click still clear everything.

### Notes & rendering (Obsidian-style)
- Notes render as real Markdown everywhere (inspector details, full-note dialog, reading mode):
  headings 1–6, block quotes, ordered/unordered lists, tables, code fences, hr, strike-through,
  `==highlight==`, links — with KaTeX formulas inline inside any of them (delimiters + the
  bare-formula channel kept).
- Reading mode now renders the **full note** on expand (previously only a 120-char summary).
- The details pane is the inspector's visual center (moved above the property controls) and its
  height is drag-adjustable (160–900px, persisted).
- Formula failures degrade to visible "source kept" placeholders — never silent loss.

### Cross-graph links
- Fixed deep links `#graphId/nodeId` (jumping to a node in another graph used to fail with
  "bad graph id" — the hash parser now understands the node anchor and focuses the target card).
- Both link perspectives (provides / uses) verified end-to-end with friendly names and jump.

### LaTeX gate
- **Custom macro definitions are rejected outright** (`\newcommand`, `\renewcommand`,
  `\providecommand`, `\DeclareMathOperator`, `\def`, `\gdef`, `\edef`, `\xdef`, `\let`): a macro
  defined in one card does not exist in the others. Write standard KaTeX commands.
- Fenced and inline code survive normalization verbatim — `gcd(b, a % b)` keeps its `%`
  (previously eaten as a LaTeX comment).

### UI & i18n
- Canvas mode renamed to **Fluid mode** (⚡ 流畅模式 / ⚡ Fluid).
- Language switching now applies instantly to the file tree, node list, type filter, inspector
  panels and the reader (previously some areas only updated after the next interaction).
- Full English coverage sweep: node/group context menus, conversation panel, link dialog,
  toasts, lightbox; an automated EN check now opens every modal and menu to scan for leaked CJK.

### Installation
- The installer no longer creates host-specific directories on machines that do not have them.
- Product code stays zero-dependency (Node ≥ 18 built-ins only; KaTeX is vendored and offline).

## 0.1.0 — 2026-09-12

- Initial public release: OmniFlow CLI (`of`) + visual Studio, templates, Mermaid/JSON import,
  exports, MCP server, conversation maps, cross-graph links, LaTeX formula gate.
