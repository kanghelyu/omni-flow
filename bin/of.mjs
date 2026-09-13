#!/usr/bin/env node
// OmniFlow CLI (of) — 万用流程图。graph.json 是唯一拓扑事实来源。
import { homedir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { mkdir, readFile, writeFile, readdir, stat } from "node:fs/promises";
import { normalizeGraph, validateGraph } from "../lib/graph-core.js";
import { layeredLayout, clusterLayout, forceLayout, gridLayout, analyzeGraph } from "../lib/graph-analysis.js";
import { loadGraph, saveGraph, listGraphs, deleteGraph, makeGraphId } from "../lib/graph-service.mjs";
import { buildTemplateById, mergedTemplateSummaries, saveCustomTemplate, deleteCustomTemplate } from "../lib/templates.js";
import { ensureConversationShape, appendTurn, setHead, mergeBranches, pathTo, conversationOverview, linearize, registerAgent, recordTurn, resolveTurn, pendingTurns, nextSpeaker, aggregateBranches, scaffoldTopology } from "../lib/conversation.js";
import { toMermaid, fromMermaid, toDot, toMarkdownOutline, toPlainText, fromAgentFlow } from "../lib/converters.js";
import { buildGraphFromMineru, buildGraphFromMarkdown } from "../lib/import-doc.js";
import { liveStart, liveLog, liveStop, liveStatus } from "../lib/live-conversation.js";

const VERSION = "0.1.0";
const args = process.argv.slice(2);
const command = args[0] ?? "help";

function rootHome() {
  const flagIndex = args.indexOf("--root");
  return resolve(flagIndex !== -1 ? args[flagIndex + 1] : process.env.OF_HOME ?? join(homedir(), ".omni-flow"));
}
function opt(name, fallback = null) {
  const index = args.indexOf(name);
  return index !== -1 && args[index + 1] !== undefined ? args[index + 1] : fallback;
}
function fail(message, issues) {
  console.error(`✗ ${message}`);
  if (issues?.length) for (const issue of issues) console.error(`  · ${issue}`);
  process.exit(1);
}

async function ensureRoot(root) {
  await mkdir(join(root, "graphs"), { recursive: true });
}

async function cmdCreate() {
  const nameArg = args.slice(1).filter((arg) => !arg.startsWith("--"))[0];
  const template = opt("--template", "blank");
  const root = rootHome();
  await ensureRoot(root);
  const graph = await buildTemplateById(root, template, nameArg, opt("--lang", "en") === "zh" ? "zh" : "en");
  graph.id = makeGraphId(graph.name);
  if (opt("--desc")) graph.description = opt("--desc");
  await saveGraph(join(root, "graphs", graph.id), graph);
  console.log(`✓ 已创建图 ${graph.name}（模板 ${template}）`);
  console.log(`  id: ${graph.id}`);
  console.log(`  节点 ${graph.nodes.length} · 连线 ${graph.edges.length}`);
}

async function cmdList() {
  const root = rootHome();
  const graphs = await listGraphs(root);
  if (!graphs.length) { console.log("（空）`of create <名称>` 创建第一张图"); return; }
  for (const graph of graphs) {
    console.log(`${graph.valid ? "✓" : "⚠"} ${graph.id}  「${graph.name}」  ${graph.nodes} 节点 / ${graph.edges} 连线  ${graph.updatedAt ?? ""}`);
  }
}

async function cmdRead() {
  const id = args[1];
  const { graph } = await loadGraph(rootHome(), id);
  console.log(JSON.stringify(graph, null, 2));
}

async function cmdValidate() {
  const id = args[1];
  const { graph } = await loadGraph(rootHome(), id);
  const verdict = validateGraph(graph);
  if (verdict.ok) {
    console.log(`✓ 结构合法（${graph.nodes.length} 节点 / ${graph.edges.length} 连线）`);
    for (const warning of verdict.warnings) console.log(`  ⚠ ${warning}`);
  } else fail("结构校验未通过", verdict.issues);
}

async function cmdLayout() {
  const id = args[1];
  const root = rootHome();
  const { graph } = await loadGraph(root, id);
  const mode = opt("--mode", "layered");
  const positions = mode === "clusters" ? clusterLayout(graph)
    : mode === "force" ? forceLayout(graph.nodes, graph.edges)
    : mode === "grid" ? gridLayout(graph.nodes)
    : layeredLayout(graph.nodes, graph.edges, { direction: graph.direction });
  for (const node of graph.nodes) {
    const position = positions.get(node.id);
    if (position) { node.x = position.x; node.y = position.y; }
  }
  graph.revision += 1;
  await saveGraph(join(root, "graphs", id), graph);
  console.log("✓ 已自动布局");
}

async function cmdAnalyze() {
  const id = args[1];
  const traceFlag = opt("--trace");
  const { graph } = await loadGraph(rootHome(), id);
  const result = analyzeGraph(graph.nodes, graph.edges, { trace: traceFlag });
  console.log(`节点 ${result.nodeCount} · 连线 ${result.edgeCount}`);
  console.log(`环：${result.cycles.length ? result.cycles.map((cycle) => cycle.join(" → ")).join("；") : "无"}`);
  console.log(`枢纽/瓶颈：${result.ranked.slice(0, 5).map((entry) => `${entry.label}(${entry.total})`).join(" ") || "无"}`);
  console.log(`孤立节点：${result.isolated.map((entry) => entry.label).join(" ") || "无"}`);
  if (result.trace) {
    console.log(`\n依赖追踪 — ${result.trace.nodeId}`);
    console.log(`  上游：${result.trace.upstream.map((entry) => `${entry.label}(${entry.depth})`).join(" ← ") || "无"}`);
    console.log(`  下游：${result.trace.downstream.map((entry) => `${entry.label}(${entry.depth})`).join(" → ") || "无"}`);
  }
}

async function cmdExport() {
  const id = args[1];
  const format = opt("--format", "mermaid");
  const out = opt("--out");
  const { graph, root } = await loadGraph(rootHome(), id);
  let text;
  if (format === "html") {
    const { toStandaloneHtml } = await import("../lib/export-html.js");
    const { readNodeNote } = await import("../lib/graph-service.mjs");
    const notes = {};
    for (const n of graph.nodes){
      try { const r = await readNodeNote(root, id, n.id); if (r?.exists) notes[n.id] = { content: r.content }; } catch { /* 无备注 */ }
    }
    text = await toStandaloneHtml(graph, notes, { embed: opt("--no-embed") ? false : true });
  }
  else if (format === "json") text = JSON.stringify(graph, null, 2);
  else if (format === "dot") text = toDot(graph);
  else if (format === "md") text = toMarkdownOutline(graph);
  else if (format === "txt") text = toPlainText(graph);
  else text = toMermaid(graph);
  if (out) {
    await writeFile(out, `${text}\n`, "utf8");
    console.log(`✓ 已导出到 ${out}`);
  } else console.log(text);
}

async function cmdImport() {
  const file = args[1];
  const root = rootHome();
  await ensureRoot(root);
  const format = opt("--format", file?.endsWith(".json") ? "json" : "mermaid");
  const raw = await readFile(file, "utf8");
  let graph;
  if (format === "json") graph = normalizeGraph(JSON.parse(raw));
  else graph = fromMermaid(raw);
  if (opt("--name")) graph.name = opt("--name");
  const verdict = validateGraph(graph);
  if (!verdict.ok) fail("导入内容校验未通过", verdict.issues);
  graph.id = makeGraphId(graph.name);
  await saveGraph(join(root, "graphs", graph.id), graph);
  console.log(`✓ 已导入「${graph.name}」 id=${graph.id}（${graph.nodes.length} 节点 / ${graph.edges.length} 连线）`);
}

async function cmdImportAf() {
  const afId = args[1];
  const afHome = resolve(process.env.AF_HOME ?? join(homedir(), ".agent-flow"));
  const root = rootHome();
  await ensureRoot(root);
  let raw;
  try {
    raw = await readFile(join(afHome, "flows", afId, "flow.json"), "utf8");
  } catch {
    fail(`agent-flow 工作流 ${afId} 不存在（${join(afHome, "flows", afId)}）`);
  }
  const graph = await fromAgentFlow(JSON.parse(raw));
  graph.id = makeGraphId(graph.name);
  await saveGraph(join(root, "graphs", graph.id), graph);
  console.log(`✓ 已从 agent-flow 导入「${graph.name}」 id=${graph.id}（${graph.nodes.length} 节点 / ${graph.edges.length} 连线）`);
}

async function cmdTemplates() {
  const root = rootHome();
  for (const template of await mergedTemplateSummaries(root)) {
    console.log(`${template.id.padEnd(20)} ${template.name}${template.custom ? "  [自定义]" : ""} — ${template.desc}`);
  }
}

/** of template-save <graphId> --id <tplId> --name <名> --desc <述>：把现有图沉淀为模板。 */
async function cmdTemplateSave() {
  const graphId = args[1];
  const root = rootHome();
  const { graph } = await loadGraph(root, graphId);
  const saved = await saveCustomTemplate(root, {
    templateId: opt("--id") ?? String(graph.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) ?? `tpl-${Date.now().toString(36)}`,
    name: opt("--name") ?? graph.name,
    desc: opt("--desc") ?? graph.description ?? "",
    direction: graph.direction,
    nodes: graph.nodes,
    edges: graph.edges,
    groups: graph.groups
  });
  console.log(`✓ 模板已保存：${saved.id}（of create --template ${saved.id} 可复用）`);
}

async function cmdTemplateDelete() {
  const result = await deleteCustomTemplate(rootHome(), args[1]);
  console.log(`✓ 已删除模板 ${result.id}`);
}

async function cmdMeta() {
  const id = args[1];
  const root = rootHome();
  const { graph } = await loadGraph(root, id);
  if (opt("--name")) graph.name = opt("--name");
  if (opt("--desc")) graph.description = opt("--desc");
  if (opt("--direction")) graph.direction = opt("--direction") === "LR" ? "LR" : "TD";
  graph.revision += 1;
  await saveGraph(join(root, "graphs", id), graph);
  console.log(`✓ ${graph.name}（方向 ${graph.direction}）`);
}

async function cmdTrash() {
  const { readdir, readFile } = await import("node:fs/promises");
  const trashDir = join(rootHome(), "trash");
  let entries = [];
  try { entries = await readdir(trashDir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries.filter((item) => item.isDirectory())) {
    try {
      const raw = JSON.parse(await readFile(join(trashDir, entry.name, "graph.json"), "utf8"));
      console.log(`${entry.name}  「${raw.name}」 ${raw.id}（of restore "${entry.name}" 恢复）`);
    } catch { /* 跳过 */ }
  }
}

async function cmdRestore() {
  const { readFile, rename } = await import("node:fs/promises");
  const entry = String(args[1] ?? "").replace(/[/\\]/g, "");
  const raw = JSON.parse(await readFile(join(rootHome(), "trash", entry, "graph.json"), "utf8"));
  await rename(join(rootHome(), "trash", entry), join(rootHome(), "graphs", raw.id));
  console.log(`✓ 已恢复「${raw.name}」 id=${raw.id}`);
}

async function cmdDelete() {
  const id = args[1];
  if (opt("--yes") === null) fail("删除会移入 trash（可恢复）。确认请加 --yes");
  const trashDir = await deleteGraph(rootHome(), id);
  console.log(`✓ 已移入 ${trashDir}`);
}

async function cmdStudio() {
  const { startStudioServer, openInBrowser } = await import("../studio/server.mjs");
  const port = Number(opt("--port", process.env.OF_STUDIO_PORT ?? 4319));
  const noOpen = args.includes("--no-open");
  const studio = await startStudioServer({ root: rootHome(), port });
  const url = `http://127.0.0.1:${studio.port}`;
  console.log(`✓ OmniFlow Studio: ${url}  (root: ${studio.root})`);
  if (!noOpen) openInBrowser(url);
  const shutdown = async () => { await studio.stop(); process.exit(0); };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function cmdMcp() {
  const { runMcpServer } = await import("../lib/mcp-server.mjs");
  await runMcpServer();
}

async function cmdDoctor() {
  const root = rootHome();
  await ensureRoot(root);
  const nodeOk = Number(process.versions.node.split(".")[0]) >= 18;
  console.log(`Node.js ${process.versions.node} ${nodeOk ? "✓" : "✗（需要 ≥18）"}`);
  console.log(`存储根：${root} ✓`);
  try {
    await readFile(new URL("../studio/index.html", import.meta.url), "utf8");
    console.log("Studio 资产 ✓");
  } catch { console.log("Studio 资产 ✗（index.html 缺失）"); }
  const graphs = await listGraphs(root);
  console.log(`图数量：${graphs.length}`);
  try {
    const afHome = resolve(process.env.AF_HOME ?? join(homedir(), ".agent-flow"));
    await readFile(join(afHome, "package.json"), "utf8");
    console.log("agent-flow 检测到 ✓（可用 of import-af <id> 导入工作流图）");
  } catch { console.log("agent-flow 未安装（可选，不影响其他功能）"); }
}

function cmdHelp() {
  console.log(`OmniFlow v${VERSION} — 万用流程图：一切关系皆可成图

用法: of <command> [args]

  create <名称> [--template id] [--desc 文本]   按模板建图（默认 blank）
  templates                                    列出全部模板
  list / read <id>                             列出 / 查看图
  validate <id>                                结构校验（硬错误 + 软警告）
  analyze <id> [--trace nodeId]                环 / 瓶颈 / 孤立点 / 依赖追踪
  layout <id> [--mode layered|clusters]         布局：分层 / 分组聚簇
  export <id> --format mermaid|dot|md|txt|json|html [--out 文件] [--no-embed]
  import <文件> [--format mermaid|json] [--name 新名]
  import-doc <content_list.json|.md> [--name 名] [--pages 页面图目录] [--folder 路径]  # MinerU/Markdown → 卡片图
  import-af <agent-flow-id>                    导入 agent-flow 工作流为图
  studio [--port N] [--no-open]                本地画布（默认 127.0.0.1:4319）
  mcp                                          MCP 标准服务（stdio，全量 33 个工具）
  templates                                    内置 + 自定义模板列表
  template-save <图id> [--id --name --desc]     把图沉淀为自定义模板
  template-delete <模板id>                      删除自定义模板
  meta <图id> [--name --desc --direction]       改图元信息
  trash / restore <trashName>                  回收站列表 / 恢复
  delete <id> --yes                            移入 trash（可恢复）
  doctor                                       环境自检

节点/连线一切样式（颜色、形状、箭头、标签）在 Studio 里改，或直接编辑 graph.json。`);
}


/* ---------- 非线性对话（DAG 会话）CLI ---------- */
async function cmdConvo(){
  const sub = args[1];
  const root = rootHome();
  if (sub === "new"){
    const topic = args[2];
    if (!topic){ console.error('用法: of convo new "话题" [--folder 路径] [--lang zh|en]'); process.exit(1); }
    await ensureRoot(root);
    const g = ensureConversationShape(normalizeGraph({ name: topic, nodes: [], edges: [], groups: [], notes: {} }), { topic });
    g.id = makeGraphId(g.name);
    appendTurn(g, { text: topic, speaker: "system", type: "topic" });
    await saveGraph(join(root, "graphs", g.id), g);
    const folder = opt("--folder");
    if (folder) { try { await moveGraph(root, g.id, folder); } catch { /* 归档失败不阻断 */ } }
    console.log(`✓ 对话已创建\n  id: ${g.id}\n  存储: ${join(root, "graphs", g.id, "graph.json")}`);
    return;
  }
  const id = args[2];
  if (!id){ console.error("用法: of convo say|branch|merge|path|open <图id> …"); process.exit(1); }
  const { graph } = await loadGraph(root, id);
  let changed = false;
  if (sub === "say"){
    const flagNames = new Set(["--speaker", "--type", "--from", "--edge"]);
    const rawWords = args.slice(3);
    const textWords = [];
    for (let i = 0; i < rawWords.length; i++){
      if (flagNames.has(rawWords[i])){ i++; continue; }   // 跳过 flag 及其值
      textWords.push(rawWords[i]);
    }
    const text = textWords.join(" ");
    ensureConversationShape(graph);
    const node = appendTurn(graph, { text, speaker: opt("--speaker", "user"), type: opt("--type", "turn"), parentId: opt("--from"), edgeType: opt("--edge", "follows") });
    graph.notes = graph.notes ?? {};
    graph.notes[node.id] = String(text).split("\n")[0].slice(0, 120);
    changed = true;
    console.log(`✓ 已追加发言 ${node.id}（head 已移动）`);
  } else if (sub === "branch"){
    ensureConversationShape(graph);
    setHead(graph, args[3]);
    changed = true;
    console.log(`✓ head 已移到 ${args[3]}；下次 say 将从这里分出新支`);
  } else if (sub === "merge"){
    ensureConversationShape(graph);
    const sources = String(args[3] ?? "").split(",").map((x)=> x.trim()).filter(Boolean);
    const node = mergeBranches(graph, { sources, label: opt("--label", "汇合"), text: opt("--text", "") });
    changed = true;
    console.log(`✓ 已建立汇合点 ${node.id}`);
  } else if (sub === "path"){
    // 第三个位置参数可能是节点 id，也可能是 flag → 只有非 flag 才当节点
    const maybeNode = args[3] && !String(args[3]).startsWith("--") ? args[3] : null;
    const target = maybeNode ?? graph.conversation?.head;
    console.log(linearize(graph, target, { format: opt("--format", "md") }));
    return;
  } else if (sub === "next"){
    const n = nextSpeaker(ensureConversationShape(graph));
    console.log(`下一步该谁产出: ${n.nextSpeaker ?? "—"}\n理由: ${n.reason}\n轮次: ${n.round}\n拓扑: ${n.topology}\n待办: ${n.awaiting.join(", ") || "—"}`);
    console.log(`\n--- 应发送的上下文（根→head）---\n${n.contextText}`);
    return;
  } else if (sub === "pending"){
    const ps = pendingTurns(ensureConversationShape(graph));
    console.log(ps.length ? ps.map((x)=> `· [${x.status}] ${x.agent ?? "?"} — ${x.label}  (${x.id})`).join("\n") : "（无待办分支）");
    return;
  } else if (sub === "agent"){
    // of convo agent <id> <名字> [--role worker] [--model gpt-4o] [--goal 目标]
    ensureConversationShape(graph);
    const a = registerAgent(graph, { name: args[3], role: opt("--role", "worker"), model: opt("--model", ""), goal: opt("--goal", "") });
    changed = true;
    console.log(`✓ 已注册 agent ${a.name}（${a.role}）`);
  } else if (sub === "record"){
    // of convo record <id> <agent> "文本" [--status done|running|...] [--from 节点] [--handoff 目标]
    const agent = args[3];
    const words = []; const flags = new Set(["--status", "--from", "--handoff", "--type", "--edge"]);
    const rest = args.slice(4);
    for (let i = 0; i < rest.length; i++){ if (flags.has(rest[i])){ i++; continue; } words.push(rest[i]); }
    ensureConversationShape(graph);
    const node = recordTurn(graph, { agent, text: words.join(" "), status: opt("--status", "done"), parentId: opt("--from"), handoffTo: opt("--handoff"), type: opt("--type", "turn"), edgeType: opt("--edge", "follows") });
    graph.notes = graph.notes ?? {};
    graph.notes[node.id] = words.join(" ").split("\n")[0].slice(0, 120);
    changed = true;
    console.log(`✓ 已记录 ${agent} 的产出 ${node.id}（${node.status}）`);
  } else if (sub === "vote"){
    // of convo vote <id> <节点,节点,...> [--strategy majority|judge] [--text 结论]
    ensureConversationShape(graph);
    const sources = String(args[3] ?? "").split(",").map((x)=> x.trim()).filter(Boolean);
    const r = aggregateBranches(graph, { sources, strategy: opt("--strategy", "majority"), label: opt("--label", null), text: opt("--text", "") });
    graph.notes = graph.notes ?? {};
    graph.notes[r.node.id] = String(r.chosen ?? "").slice(0, 120);
    changed = true;
    console.log(`✓ 聚合完成：${r.strategy} · ${r.distinct} 种答案 · 共识 ${(r.consensus * 100).toFixed(0)}%\n  票数: ${r.tally.map((t)=> `${t.count}×${t.value.slice(0, 30)}`).join(" | ")}`);
  } else if (sub === "scaffold"){
    // of convo scaffold <id> <topology> <名字:角色,名字:角色,...> [--topic 主题]
    ensureConversationShape(graph);
    // args = [cmd, "convo", sub, id, topology, "名:角色,..."]
    const topology = args[3] ?? "supervisor";
    const agents = String(args[4] ?? "").split(",").map((x)=> x.trim()).filter(Boolean).map((pair)=> {
      const [name, role] = pair.split(":");
      return { name, role: role ?? "worker" };
    });
    const created = scaffoldTopology(graph, { topology, agents, topic: opt("--topic", null) });
    changed = true;
    console.log(`✓ 已生成 ${topology} 骨架：${created.branches.length} 条并行分支（agents: ${created.agents.join(", ")}）`);
  } else if (sub === "open"){
    const ov = conversationOverview(ensureConversationShape(graph));
    console.log(`head: ${ov.head}\n主线长度: ${ov.mainline.length}\n开放分支 ${ov.openThreads.length} 条:`);
    for (const th of ov.openThreads) console.log(`  · ${th.label}  (${th.id})`);
    console.log(`分叉点 ${ov.forkCount ?? ov.forks.length} 个: ${ov.forks.map((f)=> f.label).join(" / ") || "—"}`);
    console.log(`发言人: ${ov.speakers.join(", ") || "—"}`);
    return;
  } else {
    console.error("用法: of convo new|say|branch|merge|path|open …");
    process.exit(1);
  }
  if (changed){ graph.revision += 1; await saveGraph(join(root, "graphs", id), graph); }
}


/* ---------- 文档导入：MinerU 结构化 / Markdown → 卡片图 ---------- */
async function cmdImportDoc(){
  const file = args[1];
  if (!file){ console.error("用法: of import-doc <content_list.json | .md> [--name 图名] [--pages 页面图目录] [--folder 路径] [--lang zh|en]"); process.exit(1); }
  const root = rootHome();
  await ensureRoot(root);
  const raw = await readFile(file, "utf8");
  const name = opt("--name", file.replace(/^.*\//, "").replace(/\.(json|md)$/i, ""));
  // 页面图目录：文件名里的数字当作页码（如 p024.png / c2_pdf024_book021.png）
  const pagesDir = opt("--pages");
  const pages = [];
  if (pagesDir){
    try {
      const files = (await readdir(pagesDir)).filter((f)=> /\.(png|jpe?g|webp)$/i.test(f)).sort();
      for (const f of files){
        const nums = f.match(/(\d{2,4})/g) ?? [];
        const page = nums.length ? Number(nums[nums.length - 1]) : null;
        pages.push({ page, src: join(pagesDir, f), label: f });
      }
    } catch (e){ console.error(`⚠ 页面图目录不可读：${e.message}`); }
  }
  // MinerU 的 image_source.path 相对 json 所在目录（或 mineru_native/）解析
  const assetsRoot = opt("--assets-root", dirname(resolve(file)));
  const built = /\.json$/i.test(file)
    ? buildGraphFromMineru({ contentList: JSON.parse(raw), pages, name, lang: opt("--lang", "zh") })
    : buildGraphFromMarkdown({ markdown: raw, pages, name });
  built.graph.id = makeGraphId(built.graph.name);
  const verdict = validateGraph(built.graph);
  if (!verdict.ok) console.error(`⚠ 结构校验告警：${verdict.issues.slice(0, 3).join("；")}`);
  await saveGraph(join(root, "graphs", built.graph.id), built.graph);
  // 资源拷贝：① MinerU 抽出图片（公式图/插图）② 页面图；都进 <graph>/assets/
  let attached = 0;
  {
    const { copyFile, mkdir } = await import("node:fs/promises");
    const assetsDir = join(root, "graphs", built.graph.id, "assets");
    await mkdir(assetsDir, { recursive: true });
    // 把「图内相对路径」解析成绝对路径的候选（json 同目录 / mineru_native / 图片目录本身）
    const candidates = (rel)=>{
      const clean = String(rel).replace(/^\.\//, "");
      return [
        join(assetsRoot, clean),
        join(assetsRoot, "mineru_native", clean),
        join(assetsRoot, "mineru_native", basename(clean)),
        join(assetsRoot, basename(clean)),
      ];
    };
    for (const node of built.graph.nodes){
      const list = [];
      for (const a of (node.attachments ?? [])){
        if (/^assets\//.test(a.src)){ list.push(a); continue; }   // 已是图内路径
        let copied = false;
        for (const cand of candidates(a.src)){
          try {
            const info = await stat(cand);
            if (!info.isFile()) continue;
            const safe = `${node.id}-${basename(cand)}`.replace(/[^\w.\-\u4e00-\u9fff]/g, "_");
            await copyFile(cand, join(assetsDir, safe));
            list.push({ ...a, src: `assets/${safe}` });
            copied = true;
            break;
          } catch { /* 试下一个候选 */ }
        }
        if (!copied) list.push(a);   // 保留原引用（外链或找不到）
      }
      if (list.length){
        const { setNodeAttachments } = await import("../lib/graph-core.js");
        setNodeAttachments(built.graph, node.id, list);
        if (list.some((x)=> /^assets\//.test(x.src))) attached++;
      }
    }
  }
  if (pages.length){
    const { copyFile, mkdir } = await import("node:fs/promises");
    const assetsDir = join(root, "graphs", built.graph.id, "assets");
    await mkdir(assetsDir, { recursive: true });
    for (const node of built.graph.nodes){
      const pno = Number((node.tags ?? []).map(String).find((t)=> t.startsWith("page:"))?.slice(5));
      const hit = pages.find((x)=> Number(x.page) === pno);
      if (!hit) continue;
      const safe = hit.label.replace(/[^\w.\-\u4e00-\u9fff]/g, "_");
      try { await copyFile(hit.src, join(assetsDir, safe)); } catch { continue; }
      const list = (node.attachments ?? []).filter((a)=> a.kind !== "page");
      list.push({ kind: "page", src: `assets/${safe}`, label: hit.label, page: pno });
      const { setNodeAttachments } = await import("../lib/graph-core.js");
      setNodeAttachments(built.graph, node.id, list);
      attached++;
    }
  }
  const folder = opt("--folder");
  if (folder) { try { await moveGraph(root, built.graph.id, folder); } catch {} }
  console.log(`✓ 已从 ${file} 建图`);
  console.log(`  id: ${built.graph.id}`);
  console.log(`  卡片 ${built.stats.cards} 张（${Object.entries(built.stats.byType).map(([k, v])=> `${k} ${v}`).join(" · ")}）`);
  console.log(`  解析格式 ${built.stats.format} · 依赖边 ${built.stats.edges} 条 · 页面 ${built.stats.pages} 页 · 章节分组 ${built.stats.groups} 个`);
  if (built.stats.inlineFormulas) console.log(`  行内公式保真 ${built.stats.inlineFormulas} 处`);
  if (attached) console.log(`  已挂载图片 ${attached} 张（MinerU 插图 + 页面图）`);
  console.log(`  存储: ${join(root, "graphs", built.graph.id, "graph.json")}${folder ? `\n  归档: ${folder}` : ""}`);
}


/* ---------- 实时对话记录 CLI ----------
   of live start [--topic 主题] [--folder 路径]    开启（已有则续记）
   of live log "内容" [--role user|agent]          记一轮（无需 id）
   of live stop                                     停止
   of live status                                   状态
*/
async function cmdLive(){
  const sub = args[1] ?? "status";
  const root = rootHome();
  if (sub === "start"){
    const r = await liveStart(root, { topic: opt("--topic", null), folder: opt("--folder", null), lang: opt("--lang", "zh") === "en" ? "en" : "zh" });
    console.log(`${r.resumed ? "✓ 已续记" : "✓ 已开启记录"}：${r.name}\n  id: ${r.id}\n  主题: ${r.topic}\n  当前轮数: ${r.turns}`);
    return;
  }
  if (sub === "log"){
    const words = []; const flags = new Set(["--role", "--name", "--from", "--type", "--status", "--handoff"]);
    const rest = args.slice(2);
    for (let i = 0; i < rest.length; i++){ if (flags.has(rest[i])){ i++; continue; } words.push(rest[i]); }
    const r = await liveLog(root, { role: opt("--role", "agent"), text: words.join(" "), name: opt("--name", null), from: opt("--from", null), type: opt("--type", null), status: opt("--status", "done"), handoffTo: opt("--handoff", null) });
    console.log(`✓ 已记录 ${r.role} 一轮 → ${r.nodeId}（主线 ${r.mainline} · 总计 ${r.total}）`);
    return;
  }
  if (sub === "stop"){ console.log(JSON.stringify(await liveStop(root), null, 2)); return; }
  const st = await liveStatus(root);
  console.log(st.on ? `● 记录中：${st.name}\n  已记 ${st.turns} 轮 · 主线 ${st.mainline} · 开放分支 ${st.openThreads}\n  id: ${st.id}` : `○ 未在记录${st.id ? `（上次：${st.name ?? st.id}，${st.turns} 轮）` : ""}`);
}


/* ---------- 实时对话记录 CLI ----------
   of live start [--topic 主题] [--folder 路径]    开启（已有则续记）
   of live log "内容" [--role user|agent]          记一轮（无需 id）
   of live stop                                     停止
   of live status                                   状态
*/

const commands = {
  create: cmdCreate, list: cmdList, read: cmdRead, validate: cmdValidate,
  convo: cmdConvo, live: cmdLive, live: cmdLive, analyze: cmdAnalyze, layout: cmdLayout, export: cmdExport, import: cmdImport,
  "import-af": cmdImportAf, "import-doc": cmdImportDoc, templates: cmdTemplates, delete: cmdDelete,
  "template-save": cmdTemplateSave, "template-delete": cmdTemplateDelete,
  meta: cmdMeta, trash: cmdTrash, restore: cmdRestore,
  studio: cmdStudio, mcp: cmdMcp, doctor: cmdDoctor, help: cmdHelp, "--help": cmdHelp,
  "-h": cmdHelp, "--version": () => console.log(VERSION), "-v": () => console.log(VERSION)
};
const handler = commands[command];
if (!handler) { console.error(`未知命令：${command}`); cmdHelp(); process.exit(1); }
await handler();
