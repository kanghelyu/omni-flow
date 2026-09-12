# OmniFlow · 万用流程图

**一切关系皆可成图。**

定理依赖、论文关联、任务分工（RACI）、组织架构、科研合作、对话关联——任何「元素 + 关系」结构都能放进 OmniFlow。节点/连线的颜色、形状、箭头命名全部可自定义。零依赖 CLI + 本地可视化画布。

<p align="center">
  <img alt="CC BY-NC 4.0" src="https://img.shields.io/badge/license-CC--BY--NC--4.0-F59E0B?style=flat-square">
  <img alt="Zero dependencies" src="https://img.shields.io/badge/dependencies-zero-22C55E?style=flat-square">
</p>

<p align="center"><a href="README.md">English</a> · <strong>简体中文</strong> · 📖 <a href="docs/TUTORIAL.zh-CN.md">完整教程</a> · <a href="docs/API.md">接口参考</a></p>

## 核心能力

- **20 种节点类型 + 18 种连线语义**（可再自定义）：数学侧有定义/引理/命题/定理/论文；组织侧有人员/部门/任务；职责边有 R/A/C/I；对话边有接续/回应/汇聚。自定义类型只需在 `graph.json` 加一段 JSON。
- **一切皆可定制**：节点——填充/边框/文字三色、8 种形状、图标、尺寸、状态徽标；连线——**命名标签（箭头命名框）**、颜色、粗细、线型（实/虚/点）、单向/双向/无箭头。
- **不只是画图，还能分析**：环检测、度中心性瓶颈排名（RACI 图里一眼找到单点故障）、上/下游依赖闭包追踪、一键分层自动布局（容忍环）。
- **文本优先、AI 友好**：Mermaid / Graphviz DOT / Markdown 大纲 / JSON 四向导入导出；`graph.json` 是唯一事实源，Git 可 diff；粘贴 Mermaid 即可批量建图。
- **agent-flow 桥**：`of import-af <id>` 把任意 [AgentFlow](https://github.com/kanghelyu/agent-flow) 工作流转成图（逻辑门分支变成是/否标签边）。OmniFlow 负责映射与审阅，AgentFlow 负责执行。
- **分组 / 备注 / 搜索 / 图例**：彩色子图容器、节点级 Markdown 长备注、即时搜索高亮、按类型注册表自动生成的图例。
- **双语 + 明暗主题 Studio**：只绑 `127.0.0.1:4319` 的本机画布。

## 推荐安装方式：把仓库直接丢给你的 agent

安装 OmniFlow 最好的方式是**把仓库地址发给你的编程 agent**，让它自己完成安装：

```text
https://github.com/kanghelyu/omni-flow
```

OmniFlow 是 **harness 无关插件**：同一仓库适用于 ZCode、Claude Code、Codex CLI、Cursor、Windsurf，或任何能执行 shell 命令的 agent（macOS / Windows / Linux）。agent 会：

1. 拉取本仓库；
2. 运行 `install.sh`（macOS/Linux）或 `install.ps1`（Windows）；
3. **自动把配套的 `omni-flow` skill 投放**到 ZCode（`~/.zcode/skills/omni-flow`）、Claude Code（`~/.claude/skills/omni-flow`）、Codex（`$CODEX_HOME/skills/omni-flow`）——装完 agent 立刻掌握全部模板、约定与批量导入技巧；
4. 把 `of` CLI 软链到 `~/.local/bin`；
5. 用 `of --version` 和 `of doctor` 自检。

无需插件市场、无需按 harness 单独打包。重复运行安装器即同时升级运行时与 skill。

## 节点的 Markdown：把领域实质内容放进图里

每个节点都有一个专属 Markdown 文件：`~/.omni-flow/graphs/<id>/notes/<nodeId>.md`。
**画布上的框是索引，`.md` 里才是领域实质内容**——举一反三：

| 节点类型 | `.md` 里放什么 |
| --- | --- |
| 定理 / 引理 / 命题 | 完整表述、证明思路、依赖的引理清单、反例与边界条件 |
| 定义 | 严格定义、记号约定、直观解释 |
| 论文 | 摘要、关键结果、与本项目的关系、待读问题 |
| 人员 | CV 简历、研究方向、承担职责、联系方式 |
| 任务 | 验收标准、上下文、产出物链接 |
| 部门 / 团队 | 职责范围、编制、汇报关系说明 |
| 会话 / 话题 | 结论纪要、未决问题、后续行动 |

三个读写通道完全对等：Studio 里节点的「备注全文」按钮、MCP 工具 `of_set_note` / `of_get_note`、直接编辑文件。首行会作为摘要显示在卡片和图数据里。

**写法规范：短而密（建议 ≤30 行），首行一句话摘要，可核查的标识必须附上**：

- 论文 / 书目：附 **DOI 或 arXiv id**（如 `arXiv:2203.04205`、`doi:10.1007/978-1-4612-0881-2`）；本地有 PDF 就附**绝对路径或 `file://` 链接**
- 定理：完整表述 + 证明思路 + 依赖的引理清单
- 人员：一句话身份 + 研究方向 + 本地 CV 链接
- 任务：验收标准 + 产出物路径
- 会话：结论纪要 + 待办 + 关联会话

骨架示例（论文节点）：

```markdown
Nilpotent Orbits in Semisimple Lie Algebras
- doi:10.1007/978-1-4612-0881-2 | 本地: ~/Books/nilpotent-orbits.pdf
- 关键结果: 幂零轨道的分类与闭轨道偏序
- 与本图关系: 定理 4.1 分类结果的工具书
```

## 配套 skill：装插件即装 skill，调用 skill 即用插件

`skills/omni-flow/SKILL.md` 随插件安装器**自动投放**到 ZCode / Claude Code / Codex 的 skills 目录（symlink/junction，单一数据源）。反过来，对任何 agent：

- **调用了 skill = 已经在用 OmniFlow**（skill 里就是全部用法：模板选择、批量导入、节点 `.md` 内容规范、分析配方），无需再手动调用插件；
- **调用了插件（CLI/MCP/HTTP）时，agent 的 skill 已在位**，上下文自动对齐。

## 快速开始

```bash
bash install.sh          # macOS / Linux → ~/.omni-flow + of 进入 PATH + skill 自动安装
of doctor
of templates             # 7 个场景模板
of create "论文定理依赖" --template theorem-deps
of studio                # → http://127.0.0.1:4319
```

Windows PowerShell：先 `Set-ExecutionPolicy -Scope Process Bypass`，再 `.\install.ps1`。

依赖：Node.js ≥ 18，零 npm 依赖。

## 配套 skill（随插件自动安装）

`skills/omni-flow/SKILL.md` 随插件分发，**两个安装器都会自动投放**。它教会任何 agent：

- 按场景选模板（定理依赖 → `theorem-deps`、团队分工 → `task-raci`……）；
- 文本优先的批量建图路径（先 Mermaid/JSON 灌图，Studio 精修）；
- 全自定义面板（节点三色 / 8 形状 / 状态徽标；连线标签、颜色、线型、箭头）；
- 分析配方（RACI 用度中心性找单点故障、定理证明链追踪、环审计）。

对支持 MCP 的 agent，注册一次服务即可把 37 个工具变成原生工具：

```json
{ "mcpServers": { "omni-flow": { "command": "of", "args": ["mcp"] } } }
```

## 标准接口：所有 agent 通用

OmniFlow 暴露**三层完全对等的标准接口**，任何 agent 按自身偏好任选：

1. **MCP（推荐）**——37 个工具，走标准 Model Context Protocol（stdio JSON-RPC 2.0）。Claude Code / Codex CLI / WorkBuddy / Cursor 等一切 MCP 客户端直接挂载：

```json
{ "mcpServers": { "omni-flow": { "command": "of", "args": ["mcp"] } } }
```

2. **HTTP JSON API**——21 个端点 + SSE，`127.0.0.1:4319`（`of studio --no-open` 启动）。
3. **CLI**——12 个子命令，人类与 shell 型 agent 通用。

全量接口参考：[docs/API.md](docs/API.md)。

## 命令参考

| 命令 | 用途 |
| --- | --- |
| `of create <名称> [--template id] [--desc]` | 按模板建图（默认 `blank`）。 |
| `of templates` | 列出全部场景模板。 |
| `of list` / `of read <id>` | 列出图 / 输出完整 `graph.json`。 |
| `of validate <id>` | 硬错误阻断；环与孤立点只作警告（可能合法）。 |
| `of analyze <id> [--trace nodeId]` | 环 / 度中心性瓶颈 / 孤立点 / 依赖追踪。 |
| `of layout <id>` | 分层自动布局（容忍环）。 |
| `of export <id> --format mermaid\|dot\|md\|json [--out 文件]` | 互操作导出。 |
| `of import <文件> [--format mermaid\|json] [--name]` | 从文本或 JSON 导入。 |
| `of import-af <agent-flow-id>` | 导入 agent-flow 工作流为图。 |
| `of studio [--port N] [--no-open]` | 可视化画布（默认 `127.0.0.1:4319`）。 |
| `of delete <id> --yes` | 移入 `<root>/trash/`（可恢复）。 |
| `of doctor` | 环境自检。 |

## 场景与模板

| 场景 | 模板 | 关键边类型 |
| --- | --- | --- |
| 数学文章定理依赖 | `theorem-deps` | uses / depends-on / cites |
| 跨论文关联分析 | `paper-map` | extends / cites / contradicts / generalizes |
| 项目任务 RACI 分工 | `task-raci` | raci-r / raci-a / raci-c / raci-i / depends-on |
| 公司运营架构 | `org-structure` | reports-to |
| 科研项目合作分工 | `research-collab` | flow / raci-r / depends-on |
| 对话关联分析 | `conversation-map` | follows / answers / merges |

## 数据模型（节选）

```json
{
  "nodes": [
    { "id": "thm-1", "type": "theorem", "label": "定理 4.1",
      "fill": "#7C3AED", "border": "#6D28D9", "textColor": "#F5F3FF",
      "shape": "rect", "icon": "∎", "status": "doing" }
  ],
  "edges": [
    { "id": "e1", "source": "lem-1", "target": "thm-1",
      "type": "depends-on", "label": "核心引理",
      "color": "#2563EB", "style": "solid", "arrow": "one", "width": 2 }
  ],
  "groups": [ { "label": "技术线", "color": "#2563EB", "members": ["d-dev"] } ]
}
```

长备注存放在 `graphs/<id>/notes/<nodeId>.md`（Markdown 优先）。

## 与 AgentFlow 的关系

[AgentFlow](https://github.com/kanghelyu/agent-flow) 是**工作流执行器**：Markdown 步骤、确定性布尔门、运行时。OmniFlow 是**关系映射器**：不限领域、完全视觉自由、图分析。两者互补——OmniFlow 可导入任意 AgentFlow 工作流进行可视化与复盘。

## 设计边界

- 本地优先：数据存 `~/.omni-flow`，Studio 只绑 `127.0.0.1`，无遥测。
- 零依赖：仅 Node ≥ 18 标准库。
- `graph.json` 即真相：可以直接手改，每次写入前都会跑结构校验。

## License

[CC BY-NC 4.0](LICENSE)

## 协议

[CC BY-NC 4.0](LICENSE)（署名-非商业性使用 4.0 国际）——非商业目的可自由使用/修改/再分发（须署名）；**商业使用需联系作者另行授权**。**不传染**：衍生内容不受本协议约束，可自由选择授权方式。
