#!/usr/bin/env node
// OmniFlow CLI (of) — 万用流程图。graph.json 是唯一拓扑事实来源。
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { normalizeGraph, validateGraph } from "../lib/graph-core.js";
import { layeredLayout, clusterLayout, forceLayout, gridLayout, analyzeGraph } from "../lib/graph-analysis.js";
import { loadGraph, saveGraph, listGraphs, deleteGraph, makeGraphId } from "../lib/graph-service.mjs";
import { buildTemplateById, mergedTemplateSummaries, saveCustomTemplate, deleteCustomTemplate } from "../lib/templates.js";
import { toMermaid, fromMermaid, toDot, toMarkdownOutline, toPlainText, fromAgentFlow } from "../lib/converters.js";

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
  const { graph } = await loadGraph(rootHome(), id);
  let text;
  if (format === "json") text = JSON.stringify(graph, null, 2);
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
  export <id> --format mermaid|dot|md|txt|json [--out 文件]
  import <文件> [--format mermaid|json] [--name 新名]
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

const commands = {
  create: cmdCreate, list: cmdList, read: cmdRead, validate: cmdValidate,
  analyze: cmdAnalyze, layout: cmdLayout, export: cmdExport, import: cmdImport,
  "import-af": cmdImportAf, templates: cmdTemplates, delete: cmdDelete,
  "template-save": cmdTemplateSave, "template-delete": cmdTemplateDelete,
  meta: cmdMeta, trash: cmdTrash, restore: cmdRestore,
  studio: cmdStudio, mcp: cmdMcp, doctor: cmdDoctor, help: cmdHelp, "--help": cmdHelp,
  "-h": cmdHelp, "--version": () => console.log(VERSION), "-v": () => console.log(VERSION)
};
const handler = commands[command];
if (!handler) { console.error(`未知命令：${command}`); cmdHelp(); process.exit(1); }
await handler();
