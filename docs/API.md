# OmniFlow 接口参考（全量）

> English version: [API.en.md](API.en.md) · 完整教程：[TUTORIAL.zh-CN.md](TUTORIAL.zh-CN.md)

OmniFlow 对外暴露**三层完全对等的标准接口**，任何 agent 按自身偏好任选：

| 层 | 协议 | 规模 | 启动方式 |
| --- | --- | --- | --- |
| **MCP 工具** | Model Context Protocol（stdio JSON-RPC 2.0），**37 个工具** | 全量 | `of mcp` |
| **HTTP JSON API** | REST + SSE，**27 个端点**，只绑 `127.0.0.1:4319` | 全量 | `of studio --no-open` |
| **CLI** | shell，**19 个子命令** | 全量 | 直接调用 |

数据目录：`~/.omni-flow/graphs/<id>/graph.json`（拓扑事实源）+ `notes/<nodeId>.md`（节点领域内容）+ `templates/*.json`（自定义模板）。

---

## 自定义开放面（agent / 用户可自己添加的东西）

| 可自定义项 | 通道 | 说明 |
| --- | --- | --- |
| **自定义模板** | MCP `of_save_template` / `of_delete_template`；HTTP `POST /api/templates`、`POST /api/templates-delete/:id`；CLI `of template-save` / `of template-delete` | 从现有图一键沉淀（`fromGraph`）或内联 nodes/edges 创建；之后 `of create --template <id>` / `of_create_graph{template}` 直接复用；存 `~/.omni-flow/templates/` |
| **自定义节点类型** | MCP `of_patch_node_type`；HTTP `POST /api/graph/:id/node-type-patch`；或编辑 graph.json 的 `nodeTypes` | 每图独立的类型注册表：名称（双语）、颜色三件套、形状、图标；内置类型可覆盖 |
| **自定义连线语义类型** | MCP `of_patch_edge_type`；HTTP `POST /api/graph/:id/edge-type-patch`；或编辑 `edgeTypes` | 名称（双语）+ 颜色 + 线型，如 `资金流向`、`攻击` |
| **图元信息** | MCP `of_patch_graph_meta`；HTTP `POST /api/graph/:id/meta`；CLI `of meta` | 名称、描述、方向 TD/LR |
| **节点领域内容** | MCP `of_set_note` / `of_get_note`；HTTP `/note`；Studio「备注全文」 | Markdown 短而密：定理表述、论文 DOI/arXiv + 本地文件路径、人员 CV、任务验收标准（见 SKILL） |
| **分组** | MCP `of_add_group` / `of_delete_group` | 彩色子图容器 |
| **回收站** | MCP `of_list_trash` / `of_restore_graph`；HTTP `GET /api/graph/:id/trash`、`POST /api/graph/:id/trash-restore`；CLI `of trash` / `of restore` | 删除可恢复 |
| **画布** | MCP `of_start_studio` | 后台拉起可视化画布并返回 URL |

## 一、MCP 标准服务（37 个工具）

```json
{ "mcpServers": { "omni-flow": { "command": "of", "args": ["mcp"] } } }
```

| 工具 | 说明 |
| --- | --- |
| `of_list_graphs` | 列出全部图 |
| `of_node_types` / `of_edge_types` | 内置节点/连线类型注册表 |
| `of_templates` | 内置 + 自定义模板清单 |
| `of_save_template` / `of_delete_template` | 沉淀 / 删除自定义模板 |
| `of_create_graph` | 按模板建图（含自定义模板） |
| `of_get_graph` | 读图全量数据 + 校验状态 |
| `of_validate` | 结构校验 |
| `of_analyze` | 环 / 度中心性瓶颈 / 孤立点 / 依赖闭包 |
| `of_add_node` / `of_patch_node` / `of_move_node` / `of_delete_node` | 节点增改移删（全样式） |
| `of_add_edge` / `of_patch_edge` / `of_delete_edge` | 连线增改删（箭头命名/颜色/线型/箭头方向） |
| `of_layout` | 分层自动布局（容忍环） |
| `of_add_group` / `of_delete_group` | 分组 |
| `of_set_note` / `of_get_note` | 节点 Markdown 领域内容 |
| `of_export` | 导出 mermaid / dot / md / json |
| `of_import_mermaid` / `of_import_json` / `of_import_agentflow` | 三种导入 |
| `of_tree` / `of_create_folder` / `of_move_graph` | Obsidian 式文件夹树（建夹 / 图归档） |
| `of_patch_node_type` / `of_patch_edge_type` | 自定义类型注册表 |
| `of_patch_graph_meta` | 图名称/描述/方向 |
| `of_start_studio` | 后台启动可视化画布 |
| `of_list_trash` / `of_restore_graph` | 回收站 |

## 二、HTTP JSON API（27 个端点，`127.0.0.1:4319`）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/graphs` | 图列表 |
| POST | `/api/graphs` | `{name, template?, lang?, description?}` |
| GET | `/api/templates?lang=` | 内置 + 自定义模板（`custom` 标记） |
| POST | `/api/templates` | `{fromGraph? \| nodes/edges, templateId?, name, nameEn?, desc?, descEn?, direction?}` |
| GET | `/api/tree` | 文件夹树（folders + assign） |
| POST | `/api/tree/folder` · `/tree/folder-rename` · `/tree/folder-delete` · `/tree/move` | 建夹 / 重命名（子树跟随）/ 删夹（图上移）/ 移动图归属 |
| POST | `/api/templates-delete/:id` | 删除自定义模板 |
| POST | `/api/import` | `{format: mermaid\|json\|af, text?/data?/afId?, name?}` |
| GET | `/api/events` | SSE 变更流 |
| GET | `/api/graph/:id` | 全量详情 |
| GET | `/api/graph/:id/validate` · `/analyze?trace=` | 校验 / 分析 |
| GET | `/api/graph/:id/export?format=html|` · `/note/:nodeId` | 导出 / 读备注 |
| POST | `/api/graph/:id/note` · `/meta` · `/node-type-patch` · `/edge-type-patch` | 写备注 / 图元 / 类型注册表 |
| POST | `/api/graph/:id/node-add` · `node-patch` · `node-delete` | 节点 |
| POST | `/api/graph/:id/edge-add` · `edge-patch` · `edge-delete` | 连线 |
| POST | `/api/graph/:id/position` · `/layout` · `/group-add` · `/group-delete` | 布局与分组 |
| GET | `/api/graph/:id/trash` · POST `/api/graph/:id/trash-restore` | 回收站 |
| POST | `/api/graph/:id/graph-delete` | 删除（进 trash） |

## 三、CLI（19 个子命令）

`create / templates / template-save / template-delete / list / read / validate / analyze / layout / export / import / import-af / meta / trash / restore / delete / studio / mcp / doctor` — 见 `of help`。

## 非线性对话（Non-linear conversation）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/graph/<id>/convo` | 总览：head / 主线 / 开放分支（叶子）/ 分叉点 / 发言人 |
| POST | `/api/graph/<id>/convo` | `{ op:"say", text, speaker?, type?, parentId?, edgeType? }` 追加发言（`parentId` = 从该节点开新支）<br>`{ op:"branch", nodeId }` 移动 head<br>`{ op:"merge", sources:[...], label?, text? }` 汇合分支 |
| GET | `/api/graph/<id>/convo-path?node=<节点id>&format=md|txt` | 根→节点的活跃路径与线性化文本 |
