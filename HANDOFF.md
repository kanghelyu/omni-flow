# OmniFlow 交接文档（HANDOFF）

> 最后更新：2026-09-12 · 维护者：kanghelyu（andylyu）
> 本文档供后续维护者 / agent 快速接管。配套完整规范见 `skills/omni-flow/SKILL.md`（必读）。

## 一、项目概况

OmniFlow（`of` CLI）— 万用流程图工具：定理依赖、论文关联、任务 RACI、组织架构、对话关联等一切关系图。

**三层标准接口**（同一能力，三种入口）：
- MCP：`of mcp`（stdio JSON-RPC），**37 个工具**（`of_layout` 支持 `mode: layered|clusters`，`of_search` 全局搜索）
- HTTP：`of studio --port 4319` 启动可视化 Studio（默认端口 4319），REST API 见 `docs/API.md`
- CLI：`of <command>`，全量命令见 `of --help`

**技术栈**：零依赖纯 Node.js（ESM，`.mjs`），前端为单文件 `studio/index.html`（原生 JS + SVG 连线 + 绝对定位卡片），无框架无构建。

## 二、关键路径

| 内容 | 路径 |
| --- | --- |
| 源码仓库（本地） | `~/WorkBuddy/2026-09-11-12-31-54/omni-flow/` |
| 安装位置 | `~/.omni-flow/`（`install.sh` 同步源码 → 安装目录） |
| CLI 入口 | `~/.local/bin/of` |
| **用户数据（图/备注）** | `~/.omni-flow/graphs/<图id>/`（graph.json + notes/*.md） |
| 文件夹树 / 工作记录 | `~/.omni-flow/tree.json` / `~/.omni-flow/工作记录.txt`（自动生成） |
| 回收站 / 自定义模板 | `~/.omni-flow/trash/` / `~/.omni-flow/templates/` |
| Windows | 根目录自动选第一个非系统盘 |

## 三、当前状态（v0.1.0）

- GitHub `kanghelyu/omni-flow`：**2026-09-12 应所有者要求彻底重建**（删除重建，旧历史已物理清除），当前为干净的初始提交 + 全量源码提交；Release v0.1.0（zip 118KB）
- 协议 CC BY-NC 4.0；README 双语；docs 双语教程 + API 参考
- 已发布功能：无限画布（拖拽/缩放/平移）、Obsidian 文件树、分组（聚簇布局）、全局搜索、分享导出（Mermaid/DOT/MD/TXT/JSON）、滑出式双侧栏、中英双语、回收站

## 四、验证流程（每次改动必做）

```bash
node --check <改动的 .mjs>            # 语法
node -e "new Function(require('fs').readFileSync('studio/index.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1])"  # 前端 JS
node test/smoke.mjs                    # 17 项（含孤儿 id 审计）
node test/mcp-test.mjs                 # MCP 37 工具全链路
bash install.sh                        # 同步到 ~/.omni-flow
```

**推送（唯一可靠方式）**：`/usr/bin/python3 tools/audit-push.py`
—— 全量 sha 审计 + 退避重推。**禁止** bash 函数版（沙箱会重置函数内 PATH，git/sleep 失效导致空串假阳性比较，曾连续多轮假推送）。

## 五、踩坑铁律（详见 SKILL「踩坑经验」，此处为工程侧补充）

1. **内置 node 版本会变**：`/Users/andylyu/.workbuddy/binaries/node/versions/` 下目录名自动升级（22.22.2-2 → -3），启动脚本用绝对路径前先 `ls` 确认版本。
2. **localhost curl 必须加 `--noproxy '*'`**：沙箱代理会劫持并返回 502/000，污染状态判断。
3. **studio 每请求从磁盘读 index.html**（改前端无需重启）；但 **server.mjs / lib 改动必须重启 studio 进程**。
4. **僵尸进程**：lsof 看不见的旧实例会占端口——`kill -9` 后用 `curl --noproxy '*'` 确认端口真死再启动；多实例并发写同一存储曾有 JSON 损坏前科（已修为原子写入 + .bak 备份轮换，仍建议单实例）。
5. **路由 body 由外层统一 readBody**（server.mjs ~line 314）：分支内禁止二次 readBody（空流 → 参数静默丢失）。
6. **浏览器标签页缓存**：所有前端修复验证必须带 `?v=时间戳` 强制新加载；告知用户强刷（Cmd+Shift+R）。

## 六、已知限制与未完成项

1. 「按依赖分层」布局会打散分组聚簇——有分组的图一律用 `mode: "clusters"`；group-aware 的 layered 布局未实现。
2. 大图（>300 节点）无视口剔除与空间索引（当前 31 节点实测无压力；引入前先测量）。
3. 拉线悬停检测用 `elementFromPoint`（每次 pointermove 一次命中测试，可换 pointerover 缓存）。
4. 撤销/重做未实现（位置保存走 `/position` 单点接口）。
5. 多触点/捏合缩放未实现（滚轮 + 拖拽平移已覆盖）。

## 七、交互架构速查（改前端前必读）

- **视口**：`view = {k,x,y}`，`applyView()` 只写 `#world` 一个 transform（单视口变换，勿逐节点改坐标）。
- **拖拽状态机**：`liveDrag = { map: Map<nodeId,{x,y}> }`（统一形状，禁止再加别的形状）；`livePos(node)` 是唯一取值口；逐帧 `scheduleLiveFrame()` → `updateEdgesLive()`（edgeIndex 定向，O(k)）+ `updateConnLive()`（conn 缓存）+ `updateGroupsLive()`（组框跟随，groupGeom 共享几何）。
- **松手**：先提交 `node.x/y` → 再清 `liveDrag` → 再 `updateEdgesLive()` —— 顺序反了箭头会弹回（血泪教训）。
- **收起侧栏**：右分隔条拖宽会写内联 `style.width`，收起时必须清内联（`setRightCollapsed` 已处理），展开从 `dataset.lastW` 恢复。
- **SSE**：`/api/events` 事件驱动刷新；动画期间用 `suppressSSEUntil` 短抑制；禁止轮询与常驻 rAF。
