# OmniFlow — The Complete Tutorial

> 中文版：[TUTORIAL.zh-CN.md](TUTORIAL.zh-CN.md) · Full API reference: [API.en.md](API.en.md)（中文：[API.md](API.md)）

Everything from install to mastery in one pass. OmniFlow is a **universal flow map**: theorem dependencies, paper relations, task RACI, org structure, research collaboration, conversation maps — any "elements + relations" becomes a graph, with every box and arrow fully customizable (colors, shapes, arrow names).

---

## 1. Install

**Option A (recommended): point your agent at the repo**

Send `https://github.com/kanghelyu/omni-flow` to ZCode / Claude Code / Codex / Cursor and let it run: fetch repo → `install.sh` (`install.ps1` on Windows) → auto-drop the bundled skill into every agent directory → verify.

**Option B: manual**

```bash
git clone https://github.com/kanghelyu/omni-flow.git   # or download the Release zip
cd omni-flow && bash install.sh        # Windows: .\install.ps1
of --version && of doctor
```

- macOS/Linux: runtime + data live in `~/.omni-flow/`, CLI symlinked to `~/.local/bin/of`
- Windows: picks the **first non-system drive** (e.g. `D:\OmniFlow`) — data never lands on C:; skills are NTFS junctions
- Zero npm dependencies, Node ≥ 18 only

## 2. First graph in 3 minutes

```bash
of templates                                   # 7 scenario templates
of create "My paper" --template theorem-deps   # create from a template
of studio                                      # canvas at http://127.0.0.1:4319
```

Canvas basics:

| Action | How |
| --- | --- |
| Pan | drag empty space (or wheel) |
| Zoom | ⌘/Ctrl + wheel (cursor-anchored); or bottom-left ＋/−/⊙ |
| Add node | **"□ New node ▾" floating button** (bottom-right) → scrollable type list → lands at canvas center |
| Connect | drag a node's **right dot** onto a target (dashed preview + target highlight), release |
| Rename arrow | **double-click the edge**; or select it and edit color/style/arrows in the inspector |
| Edit node | click it → right inspector: text/type/3 colors/icon/status |
| Fly to node | click an entry in the left "Nodes" rail; search filters label/note/tag |
| Delete | select + Delete key |

## 3. Studio tour

- **Topbar**: graph switcher, status badge, ＋New (with all templates), Import, Export, ✓Validate, ◎Analyze, ⌗Tidy up, ☰Legend, theme, EN/中文
- **Left rail**: every node of the current graph (icon + label + `type · id`); click to fly there; live search; collapsible (‹); drag-resizable
- **Canvas**: infinite dot grid; zoom controls bottom-left, "New node" bottom-right
- **Right inspector**: edits whatever is selected; shows graph properties when nothing is selected

## 4. Scenario walkthroughs

### 4.1 Theorem dependencies (`theorem-deps`)
Select each definition/lemma/proposition/theorem → "Full note" and write the **complete statement, proof idea, prerequisite lemmas**. Select the main theorem → "Trace deps" for its full upstream closure. Run ✓Validate to surface circular proofs.

### 4.2 Paper relations (`paper-map`)
Each paper's note carries its **DOI or arXiv id + local PDF path + key results**. Express relations with `extends / cites / contradicts / generalizes`; ◎Analyze shows which paper is the hub.

### 4.3 Task RACI (`task-raci`)
Connect people to tasks with `raci-r/a/c/i` edges (auto-labeled and colored). ◎Analyze's **degree-centrality ranking** instantly flags the single point of failure.

### 4.4 Org structure (`org-structure`)
`reports-to` edges for reporting lines; select nodes → "Group selection" for colored division boxes ("Tech", "Business") that drag as a unit.

### 4.5 Research collaboration (`research-collab`)
PI/postdoc/PhD students connected to tasks; `depends-on` for deliverable dependencies ("theory proofs → paper writing"); status badges (todo/doing/done/blocked) from the inspector.

### 4.6 Conversation maps (`conversation-map`)
One node per session; notes hold the **summary + open questions**; `follows / answers / merges` for how topics continue, answer and converge.

### 4.7 Blank (`blank`)
Any other domain: supply chains, game walkthroughs, legal citations… If a type is missing, add it (§6).

## 5. Node Markdown: domain substance inside the graph

Every node owns `~/.omni-flow/graphs/<id>/notes/<nodeId>.md`. **The box is the index; the `.md` is the substance**. Convention: **short but dense (≤30 lines), one-line summary first, always attach verifiable identifiers**.

Paper skeleton:

```markdown
Nilpotent Orbits in Semisimple Lie Algebras
- doi:10.1007/978-1-4612-0881-2 | local: ~/Books/nilpotent-orbits.pdf
- Key results: classification of nilpotent orbits, closure order
- Role here: reference for Theorem 4.1
```

Theorem skeleton:

```markdown
Theorem 4.1 (main): wg-Grassmann manifolds satisfying … are pairwise isomorphic
- Proof idea: reduce to conjugacy invariance (Lemma 3.2) + closed-orbit parametrization (Prop 3.4)
- Depends on: lem-1, prop-1
- Scope: connected components only
```

Person skeleton:

```markdown
Zhang San · PhD student, algebra
- Focus: representations of a Lie algebra; CV: ~/Documents/cv-zhang.pdf
- Role here: theory proofs (w-theory)
```

Three equivalent channels: Studio's "Full note", MCP `of_set_note`/`of_get_note`, or editing the file. The first line becomes the card summary.

## 6. Folder tree (Obsidian-style management)

The left "Files" rail is Obsidian's file management:

- **＋ New folder** (top of rail): `a/b` nests automatically, ancestors created for you
- **Hover a folder row**: ➕ new subfolder · ✏ rename (subtree + graphs follow) · 🗑 delete (its graphs move up to the parent)
- **Hover a graph row**: 📂 move to any folder · 🗑 delete graph (into trash)
- **Drag & drop**: drag 📄 graphs onto 📁 folders to file them; drag back to empty space to unfile
- Trailing number = graph count in that folder (including subfolders); the open graph is highlighted

Agent support is built in: MCP `of_tree` / `of_create_folder` / `of_move_graph`, and one-step archiving at creation (`of_create_graph {..., "folder": "Math/paper-deps"}`).

## 7. Customize everything

**Every node**: fill/border/text colors, icon, size, status badge (right in the inspector).
**Every edge**: label (name your arrow), color, width, solid/dashed/dotted, one-way/two-way/none.

**Missing a type? Both registries are open**:

- MCP: `of_patch_node_type` (e.g. a `drone` type: hexagon + sky-blue + ✈), `of_patch_edge_type` (e.g. `funds-flow`: red dashed)
- HTTP: `POST /api/graph/:id/node-type-patch`, `edge-type-patch`
- Or edit `nodeTypes` / `edgeTypes` in `graph.json` directly

**Missing a template? Distill your own**: turn a tuned graph into a reusable template —

```bash
of template-save <graph-id> --id my-tpl --name "My template"   # CLI
# MCP: of_save_template { fromGraph: "<graph-id>", templateId: "my-tpl", name: "My template" }
of create "Fresh" --template my-tpl                            # reuse
```

Custom templates live in `~/.omni-flow/templates/*.json` and appear next to the built-ins in the New-graph dialog.

## 8. Analysis

The ◎Analyze panel + CLI:

- **Cycle detection**: cycles in conversation maps may be legitimate — warnings, not errors
- **Degree centrality**: single-point-of-failure in RACI charts; hub papers in citation maps
- **Dependency tracing**: full upstream/downstream closure of any node (`of analyze <id> --trace <nodeId>`)
- **Isolated nodes**: spot orphans instantly

## 9. Import / Export

```bash
of export <id> --format mermaid --out graph.mmd   # Mermaid (renders on GitHub)
of export <id> --format dot                        # Graphviz
of export <id> --format md                         # Markdown outline
of import graph.mmd                                # Mermaid/JSON import
of import-af <agent-flow-id>                       # AgentFlow workflow → diagram
```

Batch-building tip: have an AI write Mermaid directly → `of import` → polish styles in Studio.

## 10. Three interfaces (full reference: [API.en.md](API.en.md))

| Layer | Size | Setup |
| --- | --- | --- |
| MCP | **36 tools** | `{"mcpServers":{"omni-flow":{"command":"of","args":["mcp"]}}}` |
| HTTP | 27 endpoints + SSE | `of studio --no-open` → `127.0.0.1:4319` |
| CLI | 19 subcommands | `of help` |

Agent tip: mount MCP once, then `of_save_template` (distill templates), `of_patch_node_type` (extend registries), `of_set_note` (fill node substance), `of_analyze` (insight) cover the whole loop.

## 11. FAQ

- **Port busy**: `of studio --port 4320`
- **Deleted a graph by accident**: `of trash` to list, `of restore <trashName>` to recover
- **Where is my data**: `~/.omni-flow/` (Windows: the chosen non-system drive)
- **Edited graph.json but nothing changed**: refresh the page; invalid structures are rejected before write
- **Where is the skill**: `skills/omni-flow` under `~/.zcode`, `~/.claude`, `~/.codex` (symlinked to `~/.omni-flow/skills/omni-flow`)
- **Do I still need the plugin after invoking the skill**: no — the skill IS the usage manual; the plugin's three interfaces are already installed alongside it

> **Filing tip**: every tree change auto-updates the top-level `工作记录.txt` (graph → folder ledger). Agents must read it before creating: reuse an existing themed folder when one matches; create a new one only for a genuinely new domain; an explicit folder from you always wins. Groups: select nodes → "Group selection"; click a group in the inspector list to locate it on canvas.

> **Arrow direction rule**: always **source → result**. Whatever is earlier in time/logic, the provider, the cause, the mechanism, the superior = source; the derived thing, the receiver, the subordinate, the outcome = target. E.g. lemma → theorem (uses), cited paper → citing paper (cites), superior → subordinate (reports-to), cause → phenomenon (flow "leads to"). Self-check: read the edge as "A produces/supports B" — if it only reads the other way, flip it.
