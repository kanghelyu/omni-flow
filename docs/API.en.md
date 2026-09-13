# OmniFlow Interface Reference (Full)

> 中文版：[API.md](API.md) · Tutorial: [TUTORIAL.md](TUTORIAL.md)

OmniFlow exposes **three fully equivalent standard interfaces** — any agent can pick whichever it speaks:

| Layer | Protocol | Size | Start |
| --- | --- | --- | --- |
| **MCP tools** | Model Context Protocol (stdio JSON-RPC 2.0), **61 tools** | full | `of mcp` |
| **HTTP JSON API** | REST + SSE, **50+ endpoints**, binds `127.0.0.1:4319` only | full | `of studio --no-open` |
| **CLI** | shell, **20+ subcommands** | full | direct |

Data layout: `~/.omni-flow/graphs/<id>/graph.json` (single source of truth) + `notes/<nodeId>.md` (node substance) + `templates/*.json` (custom templates).

---

## Customization surface (everything agents/users may add)

| Item | Channels | Notes |
| --- | --- | --- |
| **Custom templates** | MCP `of_save_template` / `of_delete_template`; HTTP `POST /api/templates`, `POST /api/templates-delete/:id`; CLI `of template-save` / `of template-delete` | Distill from an existing graph (`fromGraph`) or inline nodes/edges; reuse via `of create --template <id>`; stored in `~/.omni-flow/templates/` |
| **Custom node types** | MCP `of_patch_node_type`; HTTP `POST /api/graph/:id/node-type-patch`; or edit `nodeTypes` in graph.json | Per-graph registry: bilingual names, fill/border/text, shape, icon; built-ins may be overridden |
| **Custom edge types** | MCP `of_patch_edge_type`; HTTP `POST /api/graph/:id/edge-type-patch`; or edit `edgeTypes` | Bilingual name + color + style (e.g. `funds-flow`, `attacks`) |
| **Graph meta** | MCP `of_patch_graph_meta`; HTTP `POST /api/graph/:id/meta`; CLI `of meta` | name, description, direction TD/LR |
| **Node substance** | MCP `of_set_note` / `of_get_note`; HTTP `/note`; Studio "Full note" | Markdown, short-but-dense: theorems, DOI/arXiv + local paths, CVs, acceptance criteria |
| **Groups** | MCP `of_add_group` / `of_delete_group` | Colored subgraph containers |
| **Trash** | MCP `of_list_trash` / `of_restore_graph`; HTTP `GET /api/graph/:id/trash`, `POST /api/graph/:id/trash-restore`; CLI `of trash` / `of restore` | Deletion is recoverable |
| **Canvas** | MCP `of_start_studio` | Launch the visual Studio in the background, returns URL |

## I. MCP standard server (61 tools)

```json
{ "mcpServers": { "omni-flow": { "command": "of", "args": ["mcp"] } } }
```

Env: `OF_HOME` (storage root, default `~/.omni-flow`), `AF_HOME` (for AgentFlow import).

| Tool | Purpose |
| --- | --- |
| `of_list_graphs` | List all graphs |
| `of_node_types` / `of_edge_types` | Built-in type registries |
| `of_templates` | Built-in + custom templates |
| `of_save_template` / `of_delete_template` | Distill / delete a custom template |
| `of_create_graph` | Create from template (custom ones included) |
| `of_get_graph` | Full graph data + validation state |
| `of_validate` | Structure validation (hard errors vs warnings) |
| `of_analyze` | Cycles / centrality bottlenecks / orphans / dependency closure |
| `of_add_node` / `of_patch_node` / `of_move_node` / `of_delete_node` | Node CRUD with full styling |
| `of_add_edge` / `of_patch_edge` / `of_delete_edge` | Edge CRUD (label / color / style / arrows) |
| `of_layout` | Layered auto-layout (cycle-tolerant) |
| `of_add_group` / `of_delete_group` | Colored groups |
| `of_set_note` / `of_get_note` | Node Markdown substance |
| `of_export` | mermaid / dot / md / json |
| `of_import_mermaid` / `of_import_json` / `of_import_agentflow` | Imports |
| `of_tree` / `of_create_folder` / `of_move_graph` | Obsidian-style folder tree (create / archive graphs) |
| `of_patch_node_type` / `of_patch_edge_type` | Extend type registries |
| `of_patch_graph_meta` | name / description / direction |
| `of_start_studio` | Launch the visual canvas in background |
| `of_list_trash` / `of_restore_graph` | Trash bin |

`*` = required. All tools return JSON text; failures set `isError: true` with actionable messages.

## II. HTTP JSON API (50+ endpoints, `127.0.0.1:4319`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/graphs` | List graphs |
| POST | `/api/graphs` | `{name, template?, lang?, description?}` → 201 |
| GET | `/api/templates?lang=` | Built-in + custom templates (`custom` flag) |
| POST | `/api/templates` | `{fromGraph? \| nodes/edges, templateId?, name, nameEn?, desc?, descEn?, direction?}` |
| GET | `/api/tree` | Folder tree (folders + assign) |
| POST | `/api/tree/folder` · `/tree/folder-rename` · `/tree/folder-delete` · `/tree/move` | Create / rename (subtree follows) / delete (graphs move up) / move graph |
| POST | `/api/templates-delete/:id` | Delete custom template |
| POST | `/api/import` | `{format: mermaid\|json\|af, text?/data?/afId?, name?}` |
| GET | `/api/events` | SSE change stream |
| GET | `/api/graph/:id` | Full detail |
| GET | `/api/graph/:id/validate` · `/analyze?trace=` | Validate / analyze |
| GET | `/api/graph/:id/export?format=html|` · `/note/:nodeId` | Export / read note |
| POST | `/api/graph/:id/note` · `/meta` · `/node-type-patch` · `/edge-type-patch` | Write note / meta / registries |
| POST | `/api/graph/:id/node-add` · `node-patch` · `node-delete` | Nodes |
| POST | `/api/graph/:id/edge-add` · `edge-patch` · `edge-delete` | Edges |
| POST | `/api/graph/:id/position` · `/layout` · `/group-add` · `/group-delete` | Layout & groups |
| GET | `/api/graph/:id/trash` · POST `/api/graph/:id/trash-restore` | Trash bin |
| POST | `/api/graph/:id/graph-delete` | Delete (into `~/.omni-flow/trash/`) |

Conventions: topology writes are normalized + validated before disk (hard errors → 400, nothing written); `position` only moves; SSE `change` signals file-level updates.

## III. CLI (20+ subcommands)

`create / templates / template-save / template-delete / list / read / validate / analyze / layout / export / import / import-af / meta / trash / restore / delete / studio / mcp / doctor` — see `of help`.

## Tips for agents

1. **Mount MCP** once; fall back to HTTP/CLI when MCP is unavailable — the three layers are equivalent.
2. Batch-build: `of_import_mermaid` one shot, then `of_patch_node` / `of_patch_edge` to polish styles.
3. Customization: every node's `fill/border/textColor`, every edge's `label/color/style/arrow` are writable; `label` is the arrow name.
4. Insight: `of_analyze` for RACI single-point-of-failure; `trace` for proof chains.

## 非线性对话（Non-linear conversation）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/graph/<id>/convo` | 总览：head / 主线 / 开放分支（叶子）/ 分叉点 / 发言人 |
| POST | `/api/graph/<id>/convo` | `{ op:"say", text, speaker?, type?, parentId?, edgeType? }` 追加发言（`parentId` = 从该节点开新支）<br>`{ op:"branch", nodeId }` 移动 head<br>`{ op:"merge", sources:[...], label?, text? }` 汇合分支 |
| GET | `/api/graph/<id>/convo-path?node=<节点id>&format=md|txt` | 根→节点的活跃路径与线性化文本 |

### 多智能体（agent）扩展

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/graph/<id>/convo?view=next` | 调度：`nextSpeaker` + 应发送上下文（agent 运行时用） |
| GET | `/api/graph/<id>/convo?view=pending` | 待办分支（running / waiting-human / pending） |
| POST | `/api/graph/<id>/convo` | 追加 op：`scaffold`（拓扑骨架）/ `record`（记录产出，支持 `handoffTo`）/ `resolve`（完成分支）/ `vote`（聚合：majority·weighted·judge） |

节点状态扩展：`pending` · `running` · `waiting-human` · `done` · `failed` · `aborted`。
