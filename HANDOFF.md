# OmniFlow 交接文档（HANDOFF）

> 最后更新：2026-09-12（含可靠性 / 性能 / 语言三批改动）· 维护者：kanghelyu（andylyu）
> 本文档供后续维护者 / agent 快速接管。配套完整规范见 `skills/omni-flow/SKILL.md`（必读）。

## 一、项目概况

OmniFlow（`of` CLI）— 万用流程图工具：定理依赖、论文关联、任务 RACI、组织架构、对话关联等一切关系图。

**三层标准接口**（同一能力，三种入口）：
- MCP：`of mcp`（stdio JSON-RPC），**37 个工具**（`of_layout` 支持 `mode: layered|clusters`；`of_search` 全局搜索；`of_create_graph` 支持 `lang`）
- HTTP：`of studio --port 4319` 启动可视化 Studio（默认端口 4319），REST API 见 `docs/API.md`
- CLI：`of <command>`（`of create ... --lang zh|en`），全量命令见 `of --help`

**技术栈**：零依赖纯 Node.js（ESM，`.mjs`），前端为单文件 `studio/index.html`（原生 JS + SVG 连线 + 绝对定位卡片），无框架无构建。

## 二、关键路径

| 内容 | 路径 |
| --- | --- |
| 源码仓库（本地） | `~/WorkBuddy/2026-09-11-12-31-54/omni-flow/` |
| 安装位置 | `~/.omni-flow/`（`install.sh` 同步源码 → 安装目录） |
| CLI 入口 | `~/.local/bin/of` |
| **用户数据（图/备注）** | `~/.omni-flow/graphs/<图id>/`（graph.json + notes/*.md + .bak/） |
| 文件夹树 / 工作台账 | `~/.omni-flow/tree.json` / `~/.omni-flow/WORKLOG.txt`（自动生成，英文） |
| 回收站 / 自定义模板 | `~/.omni-flow/trash/` / `~/.omni-flow/templates/` |
| Windows | 根目录自动选第一个非系统盘 |

## 三、当前状态（v0.1.0）

- GitHub `kanghelyu/omni-flow`：2026-09-12 应所有者要求**彻底重建**（删除重建，旧历史物理清除），当前干净历史 + Release v0.1.0（zip ≈122KB）
- 协议 CC BY-NC 4.0；README 双语；docs 双语教程 + API 参考
- 已发布功能：无限画布（拖拽/缩放/平移）、Obsidian 文件树、分组（含聚簇布局）、全局搜索、分享导出（Mermaid/DOT/MD/TXT/JSON）、滑出式双侧栏、中英双语、回收站、**可靠写入 + 损坏自愈**
- 测试：`smoke 17/17` · `mcp-test 全链路通过`

## 四、数据可靠性架构（重要，改动必读）

写入路径 `lib/graph-service.mjs`：

| 机制 | 实现 | 作用 |
| --- | --- | --- |
| **原子替换** | `writeFileSafe()`：临时文件写满 → `rename()` 替换；不支持时（EPERM/EXDEV/ENOTSUP）回退直写 | 读取者只会看到完整旧版或完整新版，杜绝半截文件 |
| **保存排队** | `enqueueWrite(path, task)`：按文件路径串行化 promise 链 | 同进程内并发保存不再交叉覆盖 |
| **备份轮换** | 写入前把旧内容存入 `<图>/.bak/`，文件名 = 时间戳 + pid + 随机，保留最近 3 份 | 任何形式的损坏都可回滚 |
| **损坏自愈** | `readJsonIfPresent()`：解析失败时用括号配对提取**首个完整 JSON 对象**并就地重写 | 尾部垃圾文件自动治愈，不再「图凭空消失」 |
| **写入校验** | `saveGraph()` 写后回读 `JSON.parse`，失败立即重写 | 并发交错兜底 |
| **错误语义** | `loadGraph()` 抛 `code: "NOT_FOUND"` / `"CORRUPT"`；服务端映射 `404` / `500` | 区分「图不存在」与「文件损坏」，不静默覆盖（保留原文件 + .bak） |

**压测结论**：30 次并发保存 → 0 失败 / 文件可解析 / 重读正常 / 备份恰好 3 份 / 零临时文件残留 / 损坏自愈 ✓

## 五、语言规则（内容 i18n）

**优先级：用户语言 → 文章语言 → 英文（默认）**

| 入口 | 行为 |
| --- | --- |
| Studio 画布新建 | 自动传 UI 语言（`lang: LANG`） |
| MCP `of_create_graph` | `lang: "zh" \| "en"`，缺省 `en` |
| CLI | `of create "名" --template X --lang zh` |
| 模板内部 | `buildTemplate(id, name, lang)` / `buildTemplateById(...)` / `templateSummaries(lang)` 默认 `en` |

铁律：**单张图内语言不得混用**（节点/组/边/备注同语言）；英文图 → 英文备注。

## 六、验证流程（每次改动必做）

```bash
node --check <改动的 .mjs>            # 语法
node -e "new Function(require('fs').readFileSync('studio/index.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1])"  # 前端 JS
node test/smoke.mjs                    # 17 项（含孤儿 id 审计 + 全链路 API）
node test/mcp-test.mjs                 # MCP 37 工具全链路
bash install.sh                        # 同步到 ~/.omni-flow
```

**推送（唯一可靠方式）**：`/usr/bin/python3 tools/audit-push.py`
—— 全量 sha 审计 + 退避重推。**禁止** bash 函数版（沙箱重置函数内 PATH，git/sleep 失效 → 空串比较假阳性，曾连续多轮假推送）。

## 七、性能基线（2026-09-12 实测，52 节点 / 78 边）

| 指标 | 优化前 | 优化后 |
| --- | --- | --- |
| `render_full` | 8.77 ms | **3.96 ms** (-55%) |
| `renderNodes` | 3.75 ms | 2.65 ms (-29%) |
| `updateEdgesLive` | 0.43 ms | 0.09 ms (-79%) |
| 全边几何（78 条） | 0.98 ms | **0.01 ms** (-99%) |
| 服务端写操作 | — | 1.14 ms |
| 服务端列表 | — | 1.13 ms |

优化手段：`nodeIndex` / `edgeIndexById` 索引（取代 `Array.find` O(n)）· DocumentFragment 批量插入 · 元素引用复用 · 读写分离（避免布局抖动）。

## 八、踩坑铁律

1. **内置 node 版本会变**：`.../binaries/node/versions/` 目录名自动升级（22.22.2-2 → -3），用绝对路径前先 `ls` 确认。
2. **localhost curl 必须加 `--noproxy '*'`**：沙箱代理会劫持返回 502/000。
3. **studio 每请求读 index.html**（改前端刷新即生效）；**server.mjs / lib 改动必须重启进程**（进程内是旧代码，这是「修了但没生效」的头号原因）。
4. **多实例必须避免**：只跑一个 `of studio`。lsof 可能看不见沙箱后台进程 —— 用 `kill -9` + `curl --noproxy '*'` 双重确认端口真死；遗留实例用 TaskStop 清理。
5. **路由 body 由外层统一 readBody**：分支内禁止二次 readBody（空流 → 参数静默丢失）。
6. **浏览器缓存**：前端修复验证必须带 `?v=时间戳`；告知用户强刷（Cmd+Shift+R）。
7. **改动 import 后必跑 `node --check`**：曾有「撤销 atomicWrite 时误删 `rename`/`unlink` import → 运行时 `rename is not defined` → 全部保存静默失败」的事故。
8. **错误码优于字符串匹配**：曾用 `message.includes("不存在（")` 判断 404，新增错误码后不匹配 → 一律 400；现统一用 `error.code`。
9. **长模板 / 含 `${}` 的代码用整文件写入**：行内正则替换会吞掉 `${...}`。

## 九、已知限制与未完成项

1. **跨进程并发编辑无冲突检测**：不同窗口同时编辑同一图会 lost update。已有 `revision` 字段，可行方案是**乐观锁**（写请求带 `baseRevision`，不匹配则拒绝并返回最新版）——属功能变更，需所有者授权。
2. 「按依赖分层」布局会打散分组聚簇——有分组的图一律用 `mode: "clusters"`；group-aware layered 未实现。
3. 大图（>300 节点）无视口剔除与空间索引（当前最大 59 节点实测无压力；引入前先测量）。
4. 拉线悬停用 `elementFromPoint`（每次 pointermove 一次命中测试，可换 pointerover 缓存）。
5. 撤销/重做未实现（位置保存走 `/position` 单点接口）。
6. 多触点/捏合缩放未实现（滚轮 + 拖拽平移已覆盖）。

## 十、交互架构速查（改前端前必读）

- **视口**：`view = {k,x,y}`，`applyView()` 只写 `#world` 一个 transform（单视口变换，勿逐节点改坐标）。
- **查找索引**：`nodeIndex` / `edgeIndexById` 由 `rebuildIndexes()` 在 `render()` 开头重建（持有对象引用，直接改 `node.x` 无需重建）；`edgeIndex`（nodeId → 边元素集合）在 `renderEdges()` 建。
- **拖拽状态机**：`liveDrag = { map: Map<nodeId,{x,y}> }` 唯一形状；`livePos(node)` 是唯一取值口；逐帧 `scheduleLiveFrame()` → `updateEdgesLive()`（定向 O(k)）+ `updateConnLive()`（conn 缓存）+ `updateGroupsLive()`（组框跟随，`groupGeom` 共享几何）。
- **松手顺序**：先提交 `node.x/y` → 再清 `liveDrag` → 再 `updateEdgesLive()`（顺序反了箭头弹回）。
- **松手坐标**：组框拖拽用跟踪的 `lastDx/lastDy`，**不用事件坐标**（`pointercancel` 可能是 0,0 → 全组飞散）。
- **收起侧栏**：右分隔条拖宽写内联 `style.width`，收起必须清内联（`setRightCollapsed` 已处理），展开从 `dataset.lastW` 恢复。
- **SSE**：`/api/events` 事件驱动；拖拽中 `liveDrag` 非空即跳过 reload；`suppressSSEUntil` 短抑制；禁止轮询与常驻 rAF。
