# OmniFlow Interface Reference (complete)

> Tutorial: [TUTORIAL.md](TUTORIAL.md) · Formula rules: [FORMULAS.md](FORMULAS.md) · Skill: `skills/omni-flow/SKILL.md`

OmniFlow exposes **three fully equivalent standard interfaces** — any agent picks whichever it speaks:

| Layer | Protocol | Size | Start |
| --- | --- | --- | --- |
| **MCP tools** | Model Context Protocol (stdio JSON-RPC 2.0) | **61 tools** | `of mcp` |
| **HTTP JSON API** | REST + SSE, binds `127.0.0.1:4319` only | **50+ endpoints** | `of studio --no-open` |
| **CLI** | shell | **20+ subcommands** | direct |

Data layout: `~/.omni-flow/graphs/<id>/graph.json` (single source of truth) + `notes/<nodeId>.md` (node substance) + `templates/*.json` (custom templates) + `tree.json` (folder tree) + `WORKLOG.txt` (graph → folder ledger).

---

## Customization surface (everything agents/users may add)

| Item | Channels | Notes |
| --- | --- | --- |
| **Custom templates** | MCP `of_save_template` / `of_delete_template`; HTTP `POST /api/templates`, `POST /api/templates-delete/:id`; CLI `of template-save` / `of template-delete` | Distill from an existing graph (`fromGraph`) or inline nodes/edges; reuse via `of create --template <id>`; stored in `~/.omni-flow/templates/` |
| **Custom node types** | MCP `of_patch_node_type`; HTTP `POST /api/graph/:id/node-type-patch`; or edit `nodeTypes` in graph.json | Per-graph registry: bilingual names, fill/border/text, shape, icon; built-ins may be overridden |
| **Custom edge types** | MCP `of_patch_edge_type`; HTTP `POST /api/graph/:id/edge-type-patch`; or edit `edgeTypes` | Bilingual name + color + style (e.g. `funds-flow`, `attacks`) |
| **Graph meta** | MCP `of_patch_graph_meta`; HTTP `POST /api/graph/:id/meta`; CLI `of meta` | name, description, direction TD/LR |
| **Node substance** | MCP `of_set_note` / `of_get_note`; HTTP `/note`; Studio "Full note" | Markdown, short but dense: theorem statements, DOI/arXiv + local paths, CVs, acceptance criteria |
| **Groups** | MCP `of_add_group` / `of_delete_group` | Colored subgraph containers with persisted geometry |
| **Cross-graph links** | MCP `of_xlink_add` / `of_xlink_list` / `of_xlink_rm` / `of_xlink_import`; Studio right-click menu | Typed dependency edges between nodes of *different* graphs |
| **Trash** | MCP `of_list_trash` / `of_restore_graph`; HTTP `GET /api/graph/:id/trash`, `POST /api/graph/:id/trash-restore`; CLI `of trash` / `of restore` | Deletion is recoverable |
| **Canvas** | MCP `of_start_studio` | Launch the visual Studio in the background, returns its URL |

---

## I. MCP standard server (61 tools)

```json
{ "mcpServers": { "omni-flow": { "command": "of", "args": ["mcp"] } } }
```

Env: `OF_HOME` (storage root, default `~/.omni-flow`), `AF_HOME` (root of a local agent-flow install, for workflow import).

### Graphs, types and folders

| Tool | Purpose |
| --- | --- |
| `of_list_graphs` | List all graphs (node/edge counts, validation state, update time) |
| `of_node_types` / `of_edge_types` | Built-in type registries (colors, shapes, icons, line styles) |
| `of_templates` / `of_save_template` / `of_delete_template` | List / distill / delete templates (built-in and custom) |
| `of_search` | Full-text search across graphs and notes |
| `of_create_graph` | Create from a template (built-ins and custom ids) |
| `of_get_graph` | Full graph data plus validation state |
| `of_patch_graph_meta` | name / description / direction |
| `of_delete_graph` / `of_list_trash` / `of_restore_graph` | Delete into trash / inspect / restore |
| `of_tree` / `of_create_folder` / `of_move_graph` | Obsidian-style folder tree |
| `of_patch_node_type` / `of_patch_edge_type` | Extend or override the type registries |

### Nodes, edges, groups and notes

| Tool | Purpose |
| --- | --- |
| `of_add_node` / `of_patch_node` / `of_move_node` / `of_delete_node` | Node CRUD with full styling |
| `of_add_edge` / `of_patch_edge` / `of_delete_edge` | Edge CRUD (label / color / style / arrows) |
| `of_layout` | Auto-layout: `layered` (default) / `clusters` / `force` / `grid` |
| `of_add_group` / `of_delete_group` | Colored groups |
| `of_set_note` / `of_get_note` | Node Markdown substance (validated) |
| `of_validate` | Structure validation (hard errors block, warnings do not) |
| `of_analyze` | Cycles / centrality bottlenecks / orphans / dependency closure + `trace` |

### Import, export and documents

| Tool | Purpose |
| --- | --- |
| `of_import_mermaid` / `of_import_json` / `of_import_agentflow` | Import Mermaid, OmniFlow JSON, or an agent-flow workflow |
| `of_import_doc` | Import MinerU output / Markdown / a hand-written card table as a graph |
| `of_export` | Export mermaid / dot / md / txt / json / standalone html |
| `of_start_studio` | Launch the visual canvas in the background |

### Formulas

There is **no standalone formula tool**: validation is a gate inside every write path (it returns
`code: LATEX_INVALID` with a per-fragment `hint`). To run the identical check without writing, import
`lib/latex.js` and call `checkLatex(text)` — see [FORMULAS.md](FORMULAS.md).

### Non-linear conversation (DAG sessions)

| Tool | Purpose |
| --- | --- |
| `of_convo_new` | Create a conversation graph (the topic becomes the root) |
| `of_convo_say` | Append a turn at head, or fork from `parentId` |
| `of_convo_branch` | Move head back to any node — the next `say` forks there |
| `of_convo_merge` | Converge 2+ branches into a merge node |
| `of_convo_path` | Root→node turns (branch-isolated context) plus linearised text |
| `of_convo_open` | Overview: head, open threads, forks, deepest path, speakers |
| `of_convo_linearize` | Export one path as md/txt |
| `of_convo_scaffold` | Register agents and open one parallel branch per worker |
| `of_agent_next` / `of_agent_record` / `of_agent_done` | Agent runtime: who acts next, the exact context, record the outcome |
| `of_convo_vote` | Aggregate branch tips: majority / weighted / judge |
| `of_convo_pending` | Pending work per branch (running / waiting-human / pending) |

### Live conversation capture

| Tool | Purpose |
| --- | --- |
| `of_live_start` / `of_live_log` / `of_live_stop` / `of_live_status` | Start recording a conversation, log every turn, stop, inspect |

### Cross-graph dependencies and book-scale projects

| Tool | Purpose |
| --- | --- |
| `of_xlink_add` / `of_xlink_list` / `of_xlink_rm` / `of_xlink_import` | Create / list / remove / bulk-import links between nodes of different graphs |
| `of_project_overview` | Build a "chapter overview" graph: nodes = sections, edges = aggregated cross-section dependencies |
| `of_project_sections` | Split a large graph into one graph per section, keeping external dependencies as ghost cards |

All tools return JSON text; failures set `isError: true` with an actionable message.

---

## II. HTTP JSON API (50+ endpoints, `127.0.0.1:4319`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/graphs` | List graphs |
| POST | `/api/graphs` | `{name, template?, lang?, description?}` |
| GET | `/api/search?q=` | Full-text search |
| GET | `/api/templates?lang=` | Built-in + custom templates (`custom` flag) |
| POST | `/api/templates` | `{fromGraph? \| nodes/edges, templateId?, name, nameEn?, desc?, descEn?, direction?}` |
| POST | `/api/templates-delete/:id` | Delete a custom template |
| GET | `/api/tree` | Folder tree (folders + assign) |
| POST | `/api/tree/folder` · `/tree/folder-rename` · `/tree/folder-delete` · `/tree/move` | Create / rename (subtree follows) / delete (graphs move up) / move graph |
| POST | `/api/import` | `{format: mermaid\|json\|af, text?/data?/afId?, name?}` |
| GET | `/api/events` | SSE change stream |
| GET | `/api/live` | Live-recording status |
| GET/POST/DELETE | `/api/crosslinks` | Cross-graph link table |
| GET | `/api/graph/:id` | Full detail |
| GET | `/api/graph/:id/validate` · `/analyze?trace=` | Validate / analyze |
| GET | `/api/graph/:id/export?format=mermaid\|dot\|md\|txt\|json` · `/note/:nodeId` · `/asset/:name` | Export / read note / fetch attachment. `html` is **not** served here (400) — it needs a file, so use the CLI: `of export <id> --format html --out canvas.html` |
| POST | `/api/graph/:id/note` · `/meta` · `/node-type-patch` · `/edge-type-patch` | Write note / meta / registries |
| POST | `/api/graph/:id/node-add` · `node-patch` · `node-delete` | Nodes |
| POST | `/api/graph/:id/edge-add` · `edge-patch` · `edge-delete` | Edges |
| POST | `/api/graph/:id/position` · `positions` · `layout` · `group-add` · `group-delete` · `group-commit` | Layout, groups, transactional group drag |
| POST | `/api/graph/:id/attach` · `upload` · `project` · `replace` · `graph-delete` | Attachments, uploads, section splitting, whole-graph replace, delete |
| DELETE | `/api/graph/:id/node/:nodeId` | Delete a node (also removes its edges, note and group membership) |
| GET | `/api/graph/:id/trash` · POST `/api/graph/:id/trash-restore` | Trash bin |

Conventions: topology writes are normalised and validated before hitting disk (hard errors → HTTP 400 and nothing is written); `position` only moves nodes; SSE `change` signals file-level updates.

### Non-linear conversation

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/graph/<id>/convo` | Overview: head / mainline / open threads (leaves) / forks / speakers |
| POST | `/api/graph/<id>/convo` | `{ op:"say", text, speaker?, type?, parentId?, edgeType? }` append a turn (`parentId` forks from that node)<br>`{ op:"branch", nodeId }` move head<br>`{ op:"merge", sources:[...], label?, text? }` converge branches |
| GET | `/api/graph/<id>/convo-path?node=<nodeId>&format=md\|txt` | Active root→node path and its linearised text |

### Multi-agent (agent runtime) extensions

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/graph/<id>/convo?view=next` | Scheduling: `nextSpeaker` plus the context to send |
| GET | `/api/graph/<id>/convo?view=pending` | Pending branches (running / waiting-human / pending) |
| POST | `/api/graph/<id>/convo` | Extra ops: `scaffold` (topology), `record` (outcome, supports `handoffTo`), `resolve` (finish a branch), `vote` (majority · weighted · judge) |

Node status vocabulary: `pending` · `running` · `waiting-human` · `done` · `failed` · `aborted`.

---

## III. CLI (20+ subcommands)

`create / templates / template-save / template-delete / list / read / validate / analyze / layout / export / import / import-doc / import-af / project / xlink / meta / trash / restore / delete / studio / mcp / doctor` — plus the `convo` and `live` namespaces. Run `of help` for the authoritative list.

---

## Tips for agents

1. **Mount MCP once**; fall back to HTTP or the CLI when MCP is unavailable — the three layers are equivalent.
2. **Validate math before writing**: there is no separate tool — the gate runs inside every write and returns a per-fragment `hint`; call `checkLatex` from `lib/latex.js` to pre-check (see [FORMULAS.md](FORMULAS.md)).
3. **Read back after every write**: `of_get_graph` / `of_get_note`. Never trust a bare 200.
4. **Batch-build**: `of_import_json` for typed content (types, groups and styles survive); `of_import_mermaid` only for an untyped quick pass — it lands every card as `process` and drops all styling.
5. **Insight**: `of_analyze` for RACI single-points-of-failure; `trace` for proof chains.
