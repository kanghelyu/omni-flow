# OmniFlow 完整教程

> English version: [TUTORIAL.md](TUTORIAL.md) · 接口全量参考：[API.md](API.md)（English: [API.en.md](API.en.md)）

从安装到精通，一篇走完。OmniFlow 是**万用流程图**：定理依赖、论文关联、任务 RACI、组织架构、科研合作、对话关联……一切「元素 + 关系」皆可成图，且每个框、每条箭头的颜色/形状/命名全部可自定义。

---

## 1. 安装

**方式 A（推荐）：把仓库丢给你的 agent**

把 `https://github.com/kanghelyu/omni-flow` 发给 ZCode / Claude Code / Codex / Cursor，让它自己执行：拉仓库 → 跑 `install.sh`（Windows 用 `install.ps1`）→ 自动把配套 skill 投放到各 agent 目录 → 验证。

**方式 B：手动**

```bash
git clone https://github.com/kanghelyu/omni-flow.git   # 或下载 Release zip
cd omni-flow && bash install.sh        # Windows: .\install.ps1
of --version && of doctor
```

- macOS/Linux：运行时与数据统一在 `~/.omni-flow/`，CLI 软链到 `~/.local/bin/of`
- Windows：自动选**第一个非系统盘**（如 `D:\OmniFlow`），数据不落 C 盘；skill 以 junction 链接
- 零 npm 依赖，只需 Node ≥ 18

## 2. 三分钟上手

```bash
of templates                                   # 看 7 个场景模板
of create "我的论文" --template theorem-deps    # 按模板建图
of studio                                      # 打开画布 http://127.0.0.1:4319
```

画布里的基本动作：

| 动作 | 操作 |
| --- | --- |
| 平移 | 直接拖空白处（或滚轮） |
| 缩放 | ⌘/Ctrl + 滚轮（以光标为中心）；或左下角 ＋/−/⊙ |
| 加节点 | 画布**右下角「□ 新建流程框 ▾」**→ 弹出可滚动类型列表 → 点选即落在画布中央 |
| 连线 | 拖节点**右侧圆点**到目标框（有虚线预览与高亮），松手即连 |
| 改箭头 | **双击箭头**改标签；或选中后在右侧检查器改颜色/线型/箭头方向 |
| 改节点 | 点选节点 → 右侧检查器改文字/类型/三色/图标/状态 |
| 飞达节点 | 左侧「节点文档」点一下，相机动画飞过去；顶部搜索框可搜名称/备注/标签 |
| 删除 | 选中后按 Delete |

## 3. Studio 界面导览

- **顶栏**：图切换下拉、状态徽章、＋新建（内含全部模板）、导入、导出、✓校验、◎分析、⌗一键整理、☰图例、主题、中英切换
- **左侧文档栏**：当前图全部节点（图标 + 名称 + `类型 · id`），点击飞达；搜索框即搜即滤；可折叠（‹）、可拖拽调宽
- **画布**：无限点阵背景；左下缩放控件、右下「新建流程框」
- **右侧检查器**：选中什么就编辑什么；未选中时是图属性（名称/描述/方向）

## 4. 七大场景实战

### 4.1 定理依赖分析（`theorem-deps`）
建图后逐个选中定义/引理/命题/定理 →「备注全文」写入**完整表述、证明思路、依赖引理清单**；选中主定理点「依赖追踪」看它的全部上游；工具栏「✓校验」可发现证明环。

### 4.2 论文关联分析（`paper-map`）
每篇论文的备注写：**DOI 或 arXiv id 必附 + 本地 PDF 路径 + 关键结果**。边用 `extends / cites / contradicts / generalizes` 表达关系；「◎分析」看哪篇是枢纽。

### 4.3 项目任务分工（`task-raci`）
人员框连任务框，边选 `raci-r/a/c/i` 类型（自动命名 R/A/C/I 并着色）。「◎分析」的**度中心性排名**直接指出单点故障（谁连了太多线）。

### 4.4 公司运营架构（`org-structure`）
`reports-to` 连汇报线；选中多个节点 →「从选中建组」做出彩色部门框（如「技术线」「业务线」），整组可拖动。

### 4.5 科研项目合作（`research-collab`）
PI/博士后/博士生连任务，`depends-on` 表达成果依赖（如「理论证明 → 论文撰写」）；状态徽标（待办/进行中/完成/阻塞）在检查器里设置。

### 4.6 对话关联分析（`conversation-map`）
每个会话一个节点，备注写**结论纪要 + 待办**；`follows / answers / merges` 表达话题的接续、回应与汇聚。

### 4.7 空白图（`blank`）
任何其他领域：供应链、游戏攻略、法律条文引用……类型不够就自己加（见 §6）。

## 5. 节点 Markdown：把领域内容放进图里

每个节点有专属文件 `~/.omni-flow/graphs/<id>/notes/<nodeId>.md`。**框是索引，`.md` 是实质内容**。写法规范：**短而密（≤30 行），首行一句话摘要，可核查标识必附**。

论文节点骨架：

```markdown
Nilpotent Orbits in Semisimple Lie Algebras
- doi:10.1007/978-1-4612-0881-2 | 本地: ~/Books/nilpotent-orbits.pdf
- 关键结果: 幂零轨道分类与闭轨道偏序
- 与本图关系: 定理 4.1 的工具书
```

定理节点骨架：

```markdown
定理 4.1（主定理）：满足 …条件的 wg-Grassmann 流形两两同构
- 证明思路: 归约到引理 3.2 的共轭不变性 + 命题 3.4 的闭轨道参数化
- 依赖: lem-1, prop-1
- 边界: 仅考虑连通分支
```

人员节点骨架：

```markdown
张三 · 代数方向博士生
- 研究: 李代数表示；CV: ~/Documents/cv-zhang.pdf
- 本项目职责: 理论证明（w-theory）
```

读写三通道对等：Studio「备注全文」、MCP `of_set_note/of_get_note`、直接编辑文件。首行自动成为卡片摘要。

## 6. 文件夹树（Obsidian 式管理）

左侧「文件树」就是 Obsidian 的文件管理方式：

- **＋ 新建文件夹**（左上角）：支持 `a/b` 嵌套写法，祖先自动补齐
- **文件夹行悬停**：➕ 建子文件夹 · ✏ 重命名（子树与图跟随）· 🗑 删除（其中的图自动上移到父目录）
- **图行悬停**：📂 移动到任意文件夹 · 🗑 删除图（进回收站）
- **拖拽**：直接把 📄 图拖到 📁 文件夹上归档；拖回空白处即取消归档
- 行尾数字 = 该文件夹（含子文件夹）的图数量；当前打开的图高亮显示

agent 同步支持：MCP `of_tree` / `of_create_folder` / `of_move_graph`，建图时带 `folder` 参数一步归档（`of_create_graph {..., "folder": "数学/论文笔记"}`）。

## 7. 自定义一切

**每个节点**：填充/边框/文字三色、图标、尺寸、状态徽标（检查器直接改）。
**每条连线**：标签（箭头命名）、颜色、粗细、实/虚/点线、单向/双向/无箭头。

**类型不够用？两层注册表都能扩**：

- MCP：`of_patch_node_type`（如新增 `无人机` 类型：六边形 + 天蓝 + ✈）、`of_patch_edge_type`（如 `资金流向`：红色虚线）
- HTTP：`POST /api/graph/:id/node-type-patch`、`edge-type-patch`
- 或直接编辑 `graph.json` 的 `nodeTypes` / `edgeTypes`

**模板不够用？沉淀自己的**：把调好的图一键变成模板，之后随时复用——

```bash
of template-save <图id> --id my-tpl --name "我的模板"   # CLI
# MCP: of_save_template { fromGraph: "<图id>", templateId: "my-tpl", name: "我的模板" }
of create "新图" --template my-tpl                      # 复用
```

自定义模板存于 `~/.omni-flow/templates/*.json`，新建弹窗里与内置模板并列。

## 8. 分析功能

「◎分析」面板 + CLI：

- **环检测**：对话图里环可能合法（互相回应），只警告不阻断
- **度中心性排名**：RACI 图找单点故障；论文图找枢纽文献
- **依赖追踪**：任意节点的全部上游/下游闭包（`of analyze <id> --trace <nodeId>`）
- **孤立节点**：一眼找出没连线的孤儿

## 9. 导入 / 导出

```bash
of export <id> --format mermaid --out 图.mmd   # Mermaid（GitHub 渲染）
of export <id> --format dot                     # Graphviz
of export <id> --format md                      # Markdown 大纲
of import 图.mmd                                # Mermaid/JSON 导入
of import-af <agent-flow-id>                    # agent-flow 工作流转图
```

批量建图首选：让 AI 直接写 Mermaid → `of import`，再进 Studio 精修样式。

## 10. 三层接口（全量见 [API.md](API.md)）

| 层 | 规模 | 接入 |
| --- | --- | --- |
| MCP | **37 个工具** | `{"mcpServers":{"omni-flow":{"command":"of","args":["mcp"]}}}` |
| HTTP | 27 端点 + SSE | `of studio --no-open` → `127.0.0.1:4319` |
| CLI | 19 个子命令 | `of help` |

agent 建议挂 MCP：`of_save_template`（沉淀模板）、`of_patch_node_type`（扩类型）、`of_set_note`（逐节点填内容）、`of_analyze`（洞察）一条龙。

## 11. 常见问题

- **端口被占**：`of studio --port 4320`
- **误删了图**：`of trash` 查看、`of restore <trashName>` 恢复
- **数据在哪**：`~/.omni-flow/`（Windows 在所选非系统盘）
- **改了 graph.json 没生效**：刷新页面；结构非法会被写入前校验拦下
- **skill 在哪**：`~/.zcode|~/.claude|~/.codex` 的 `skills/omni-flow`（symlink 指向 `~/.omni-flow/skills/omni-flow`）
- **调用 skill 还要调插件吗**：不用。skill 即全部用法说明，插件的三层接口随装随用
