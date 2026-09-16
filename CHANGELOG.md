# Changelog

All notable changes to OmniFlow are documented here. Formats: Keep a Changelog, SemVer.

## 0.2.5 — 2026-09-17

### Tooling
- **`tools/audit-push.py` no longer deletes files it is supposed to ignore.** The skip list was
  applied only while walking the local tree, so a file that lives *only* on GitHub and matches an
  ignore rule was classified as "remote-only" and removed by the next sync — which is why
  `.gitignore` could never survive one. The same rules now filter the remote tree.
- **Added `.gitignore`** as a second line of defence beside the script guards: `graphs/`,
  `templates/`, `tree.json`, `crosslinks.json`, `live-conversation.json`, `WORKLOG.txt`, `trash/`
  and OS noise. It only matters to someone using plain git, but it costs nothing to state that
  this working data is not repo content.

## 0.2.4 — 2026-09-17

### Fixed
- **Bare boolean CLI flags now work.** `opt()` reads `args[index + 1]`, so a flag written at the
  end of a line returned `null` and silently did nothing: `of delete <id> --yes` — exactly the
  usage `of help` prints — always refused, and `export --format html --no-embed` was ignored
  while still reporting success. Boolean flags are now read by presence.
- **`lang` is persisted.** `normalizeGraph` dropped it, so the `lang` accepted by
  `of create --lang`, `of import-doc`, `of_import_mermaid` and the MCP tools never reached
  `graph.json` and never came back — the documented "follows the graph's own `lang`" was untrue.
  It is now stored (`zh` | `en`; anything else normalises to `en`).
- **An unsupported export format is refused instead of silently returning Mermaid.**
  `of_export { "format": "html" }` — advertised by the tool's own description — fell through to
  Mermaid and reported success, and the HTTP route did the same for `?format=html`. The MCP tool
  now really returns the standalone HTML canvas (and lists `txt` in its enum for the first time);
  the HTTP endpoint answers 400 and names the CLI, which is where the offline canvas belongs
  because it has to write a file.

### Docs
- **The skill no longer documents tools that do not exist.** `of_latex_check` — referenced 12
  times, including as a hard *"MUST call this before writing any formula"* rule — and
  `of_latex_normalize` were never implemented. The formula gate lives inside every write and
  returns `code: LATEX_INVALID` with a per-fragment `hint`; R1 now describes that real loop and
  gives local agents a one-line offline pre-check running the identical gate.
- **`of_import_mermaid` is no longer recommended for bulk creation without stating its cost.**
  Every card lands as `process` (one colour), Mermaid edge labels stay labels rather than types,
  and all `classDef` / `class` / `style` / `subgraph` lines are dropped. `of_import_json` — the
  typed, lossless route — was not mentioned anywhere; SOP-B now leads with it, and a tool index
  covers the 18 tools that were previously undocumented.
- Corrected the CLI reference (4 layout modes, 6 export formats, `of tree` is an MCP tool rather
  than a CLI command) and `docs/API.md` (phantom formula tools, HTTP export format list).

### Tests
- Six new smoke checks that fail when the docs drift from the implementation again: every MCP
  tool must be named in SKILL.md; no document may present a non-existent tool as usable; the CLI
  reference must list the layout modes and export formats that exist; `lang` must survive
  `normalizeGraph`; an unknown export format must be refused; and the bare CLI flags must take
  effect. Proven by injecting a phantom tool — the guard fails and names the file and line.

## 0.2.3 — 2026-09-17

### Tooling
- **`tools/audit-push.py` can bootstrap an empty repository.** On a repo with no commits,
  `git/trees/<branch>` answers HTTP 409 `Git Repository is empty`, and the script aborted — so a
  freshly created (or freshly cloned) repo could never receive its first push. That one case is
  now treated as "remote is empty" and the push proceeds; every other failure still aborts, so a
  transient API or auth error can never be mistaken for "the remote has nothing" and trigger a
  full re-push.

## 0.2.2 — 2026-09-16

### Studio fixes
- **"Fit" now actually fits on narrow canvases (tablets).** Zoom was clamped by a hard `0.4`
  floor in five places — fit, the ± buttons, the wheel, focus, and the thumbnails view. On a
  tablet-width canvas the graph needs roughly `k ≈ 0.14`, so the floor rendered it about three
  times too large: the map overflowed behind the side panels, and because *every* zoom path
  shared the same floor, neither **Fit** nor zoom-out could recover. The floor is now a single
  shared `MIN_K = 0.05`, so fitting always fits and zooming out works again. Measured after the
  fix: 1024×768 → `k = 0.139`, 820×1180 → `k = 0.078`, 768×1024 → `k = 0.057`, all fully inside
  the canvas.

### Tooling
- **`tools/audit-push.py` can no longer publish your working data.** Run from the install
  directory instead of a checkout, it pushed runtime state that is not repo content —
  `graphs/`, `tree.json`, `crosslinks.json`, `live-conversation.json`, `WORKLOG.txt` — to the
  public repository, and deleted the repo-only `promo/assets/**` as "removed locally". It was
  triggered by passing `--help`, which silently fell through to the push path. Two guards now:
  it aborts when runtime paths are present (or repo markers are missing), and it accepts only
  `--dry-run` — any other argument prints usage and exits without touching anything.

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
