// OmniFlow 冒烟测试 + 运行逻辑检查。零依赖：node test/smoke.mjs
import assert from "node:assert/strict";
import { normalizeGraph, validateGraph, NODE_TYPES, EDGE_TYPES } from "../lib/graph-core.js";
import { layeredLayout, traceNode, centralityReport, analyzeGraph } from "../lib/graph-analysis.js";
import { toMermaid, fromMermaid, toDot, toMarkdownOutline, fromAgentFlow } from "../lib/converters.js";
import { buildTemplate, TEMPLATES } from "../lib/templates.js";
import { startStudioServer } from "../studio/server.mjs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let passed = 0;
const results = [];
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    results.push(`✓ ${name}`);
  } catch (error) {
    results.push(`✗ ${name}: ${error.message}`);
  }
}

// ---- 1. 数据模型与校验 ----
await test("normalizeGraph fills in defaults", () => {
  const graph = normalizeGraph({ nodes: [{ id: "a", label: "A" }], edges: [{ id: "e1", source: "a", target: "a" }] });
  assert.equal(graph.nodes[0].type, "process");
  assert.equal(graph.nodes[0].w, 168);
  assert.equal(graph.schemaVersion, 1);
});
await test("validateGraph rejects dangling edges and duplicate ids", () => {
  const graph = normalizeGraph({
    nodes: [{ id: "a", label: "A" }, { id: "a", label: "A2" }],
    edges: [{ id: "e1", source: "a", target: "ghost" }]
  });
  const verdict = validateGraph(graph);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.issues.some((issue) => issue.includes("重复")));
  assert.ok(verdict.issues.some((issue) => issue.includes("ghost")));
});
await test("validateGraph treats cycles as warnings, not errors", () => {
  const graph = normalizeGraph({
    nodes: [{ id: "a" }, { id: "b" }],
    edges: [{ id: "e1", source: "a", target: "b" }, { id: "e2", source: "b", target: "a" }]
  });
  const verdict = validateGraph(graph);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.cyclic, true);
  assert.ok(verdict.warnings.some((w) => w.includes("环")));
});
await test("custom node/edge type registries take effect", () => {
  const graph = normalizeGraph({
    nodeTypes: { drone: { label: "无人机", fill: "#123456", shape: "hexagon", icon: "✈" } },
    edgeTypes: { attacks: { label: "攻击", color: "#FF0000", style: "dashed" } },
    nodes: [{ id: "d1", type: "drone", label: "DJI-01" }],
    edges: [{ id: "e1", source: "d1", target: "d1", type: "attacks" }]
  });
  assert.equal(graph.nodes[0].shape, "hexagon");
  assert.equal(graph.nodes[0].fill, "#123456");
  assert.equal(graph.edges[0].color, "#FF0000");
});

// ---- 2. 分析引擎 ----
const diamond = normalizeGraph(buildTemplate("theorem-deps"));
await test("theorem-deps template is valid and typed", () => {
  assert.equal(validateGraph(diamond).ok, true);
  assert.ok(diamond.nodes.some((n) => n.type === "theorem"));
  assert.ok(diamond.edges.some((e) => e.type === "cites"));
});
await test("layered layout: finite coords, increasing ranks", () => {
  const positions = layeredLayout(diamond.nodes, diamond.edges);
  assert.equal(positions.size, diamond.nodes.length);
  for (const [id, position] of positions) {
    assert.ok(Number.isFinite(position.x) && Number.isFinite(position.y), `坐标非法: ${id}`);
  }
  const def = diamond.nodes.find((n) => n.id === "def-sub");
  const thm = diamond.nodes.find((n) => n.id === "thm-1");
  assert.ok(positions.get(thm.id).y > positions.get(def.id).y, "下游定理应排在更下层");
});
await test("dependency trace: upstream/downstream closures are correct", () => {
  const trace = traceNode(diamond.nodes, diamond.edges, "thm-1");
  const upIds = trace.upstream.map((entry) => entry.id);
  assert.deepEqual(new Set(upIds), new Set(["def-sub", "def-wgt", "lem-1", "prop-1", "ext-sl2"]));
  assert.equal(trace.downstream.length, 0);
  const traceLemma = traceNode(diamond.nodes, diamond.edges, "def-sub");
  assert.ok(traceLemma.downstream.some((entry) => entry.id === "thm-1"));
});
await test("degree centrality: the main theorem is the bottleneck", () => {
  const report = centralityReport(diamond.nodes, diamond.edges);
  assert.equal(report.ranked[0].id, "thm-1");
  assert.ok(report.hubs.includes("thm-1"));
});
await test("analyzeGraph summary is consistent", () => {
  const result = analyzeGraph(diamond.nodes, diamond.edges, { trace: "lem-1" });
  assert.equal(result.nodeCount, diamond.nodes.length);
  assert.equal(result.cycles.length, 0);
  assert.ok(result.trace.upstream.length >= 1);
});

// ---- 3. 转换器 ----
await test("Mermaid round-trip: export → parse → same counts", () => {
  const exported = toMermaid(diamond);
  assert.ok(exported.includes("flowchart TD"));
  assert.ok(exported.includes("classDef"));
  const parsed = fromMermaid(exported);
  assert.equal(parsed.nodes.length, diamond.nodes.length);
  assert.equal(parsed.edges.length, diamond.edges.length);
  assert.ok(parsed.edges.some((e) => e.label.includes("主定理") === false)); // 标签容错
});
await test("hand-written Mermaid parses (labels/dashed/shapes)", () => {
  const parsed = fromMermaid([
    "flowchart LR",
    "  S([开始]) -->|确认| P{可以吗}",
    "  P -->|是| D[处理]",
    "  P -.->|否| E((结束))"
  ].join("\n"));
  assert.equal(parsed.direction, "LR");
  assert.equal(parsed.nodes.length, 4);
  assert.equal(parsed.edges.length, 3);
  const start = parsed.nodes.find((n) => n.label === "开始");
  assert.equal(start.shape, "pill");
  assert.ok(parsed.edges.some((e) => e.label === "确认" && e.style === "solid"));
  assert.ok(parsed.edges.some((e) => e.label === "否" && e.style === "dashed"));
});
await test("DOT export contains styles and edge labels", () => {
  const dot = toDot(diamond);
  assert.ok(dot.includes("digraph"));
  assert.ok(dot.includes("fillcolor="));
  assert.ok(dot.includes("label="));
});
await test("Markdown outline export groups by type", () => {
  const markdown = toMarkdownOutline(diamond);
  assert.ok(markdown.includes("## 定理"));
  assert.ok(markdown.includes("## 连线"));
});
await test("agent-flow import: kind mapping and branch labels", async () => {
  const afFlow = {
    name: "修复登录",
    nodes: [
      { id: "n1", kind: "input", data: { label: "输入" }, position: { x: 10, y: 10 } },
      { id: "n2", kind: "agent", data: { label: "诊断" }, position: { x: 10, y: 20 } },
      { id: "n3", kind: "condition", data: { label: "通过?" }, position: { x: 10, y: 30 } },
      { id: "n4", kind: "output", data: { label: "完成" }, position: { x: 10, y: 40 } }
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n3" },
      { id: "e3", source: "n3", target: "n4", sourceHandle: "true" }
    ]
  };
  const graph = await fromAgentFlow(afFlow);
  assert.equal(graph.nodes.find((n) => n.id === "n2").type, "task");
  assert.equal(graph.nodes.find((n) => n.id === "n3").type, "decision");
  const yesEdge = graph.edges.find((e) => e.id === "e3");
  assert.equal(yesEdge.label, "是");
  assert.equal(yesEdge.type, "yes");
});

// ---- 4. 全部模板健全性 ----
await test(`全部 ${Object.keys(TEMPLATES).length} 个模板结构合法`, () => {
  for (const [id] of Object.entries(TEMPLATES)) {
    const graph = buildTemplate(id, "t");
    const verdict = validateGraph(graph);
    assert.equal(verdict.ok, true, `模板 ${id}: ${verdict.issues.join(";")}`);
    assert.ok(graph.nodes.length >= 2, `模板 ${id} 节点过少`);
  }
});

// ---- 5. Studio 服务端 API 合同 ----
await test("Studio API: create/read/edit/validate/analyze/export/delete end to end", async () => {
  const root = await mkdtemp(join(tmpdir(), "omniflow-test-"));
  const studio = await startStudioServer({ root, port: 0 });
  const base = `http://127.0.0.1:${studio.port}`;
  const j = async (path, opts) => {
    const res = await fetch(base + path, { headers: { "content-type": "application/json" }, ...opts });
    return { status: res.status, data: await res.json() };
  };
  try {
    // 创建
    const created = await j("/api/graphs", { method: "POST", body: JSON.stringify({ name: "冒烟图", template: "task-raci" }) });
    assert.equal(created.status, 201);
    const id = created.data.id;
    // 列表与读取
    const list = await j("/api/graphs");
    assert.ok(list.data.some((g) => g.id === id));
    const detail = await j(`/api/graph/${id}`);
    assert.equal(detail.data.valid, true);
    const person = detail.data.nodes.find((n) => n.id === "dev");
    assert.ok(person, "RACI 模板应含 dev 节点");
    // 节点编辑（颜色自定义）
    const patched = await j(`/api/graph/${id}/node-patch`, { method: "POST", body: JSON.stringify({ nodeId: "dev", patch: { fill: "#112233", label: "全栈工程师" } }) });
    assert.equal(patched.data.ok !== false, true);
    assert.equal(patched.data.detail.nodes.find((n) => n.id === "dev").fill, "#112233");
    // 连线编辑（箭头命名）
    const edgeId = patched.data.detail.edges.find((e) => e.type === "raci-a").id;
    const edgePatched = await j(`/api/graph/${id}/edge-patch`, { method: "POST", body: JSON.stringify({ edgeId, patch: { label: "最终拍板", color: "#ABCDEF", style: "dotted", arrow: "both" } }) });
    const editedEdge = edgePatched.data.detail.edges.find((e) => e.id === edgeId);
    assert.equal(editedEdge.label, "最终拍板");
    assert.equal(editedEdge.color, "#ABCDEF");
    assert.equal(editedEdge.arrow, "both");
    // 加节点 + 连线 + 悬空拒绝
    const added = await j(`/api/graph/${id}/node-add`, { method: "POST", body: JSON.stringify({ type: "risk", label: "需求变更", x: 300, y: 500 }) });
    const newNode = added.data.detail.nodes.find((n) => n.label === "需求变更");
    assert.ok(newNode);
    const dangling = await j(`/api/graph/${id}/edge-add`, { method: "POST", body: JSON.stringify({ source: newNode.id, target: "不存在" }) });
    assert.equal(dangling.status, 400);
    const selfLoop = await j(`/api/graph/${id}/edge-add`, { method: "POST", body: JSON.stringify({ source: newNode.id, target: newNode.id }) });
    assert.equal(selfLoop.status, 400);
    const linked = await j(`/api/graph/${id}/edge-add`, { method: "POST", body: JSON.stringify({ source: newNode.id, target: "t2", type: "risk-of", label: "威胁" }) });
    assert.equal(linked.status, 200);
    // 分组
    const grouped = await j(`/api/graph/${id}/group-add`, { method: "POST", body: JSON.stringify({ label: "人力", members: ["dev", "qa", "pm"] }) });
    assert.equal(grouped.data.detail.groups.length, 1);
    // 备注
    await j(`/api/graph/${id}/note`, { method: "POST", body: JSON.stringify({ nodeId: "dev", content: "# 职责\n全栈交付" }) });
    const note = await j(`/api/graph/${id}/note/dev`);
    assert.ok(note.data.content.includes("全栈交付"));
    // 校验 / 分析 / 布局 / 导出
    assert.equal((await j(`/api/graph/${id}/validate`)).data.ok, true);
    const analysis = await j(`/api/graph/${id}/analyze?trace=t4`);
    assert.ok(analysis.data.trace.upstream.length >= 1);
    assert.equal((await j(`/api/graph/${id}/layout`, { method: "POST", body: "{}" })).data.ok, true);
    const mermaid = await j(`/api/graph/${id}/export?format=mermaid`);
    assert.ok(mermaid.data.text.includes("flowchart"));
    const dot = await j(`/api/graph/${id}/export?format=dot`);
    assert.ok(dot.data.text.includes("digraph"));
    // Mermaid 导入 API
    const imported = await j("/api/import", { method: "POST", body: JSON.stringify({ format: "mermaid", text: "flowchart TD\n  A[开始] -->|go| B[结束]", name: "导入图" }) });
    assert.equal(imported.status, 201);
    // 删除
    const deleted = await j(`/api/graph/${id}/graph-delete`, { method: "POST", body: "{}" });
    assert.equal(deleted.data.ok, true);
    assert.equal((await j(`/api/graph/${id}`)).status, 404);
  } finally {
    await studio.stop();
  }
});

// ---- 6. Studio 页面静态审计：顶层 $("id") 绑定不得引用不存在的静态 id（防 boot 静默死亡） ----
await test("index.html top-level $() bindings match static ids", async () => {
  const { readFileSync } = await import("node:fs");
  const html = readFileSync(new URL("../studio/index.html", import.meta.url), "utf8");
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  const htmlPart = html.slice(0, html.indexOf("<script>"));
  const dynamicIds = new Set(["fx-close", "btnFxHelp", "xlAdd", "xl-graph", "xl-q", "xl-nodes", "xl-why", "xl-dir", "xl-save", "xl-cancel", "note-save", "note-edit", "note-close", "note-preview", "depLegend", "depOff", "depBar", "typeFilterBar", "convoHead", "convoMerge", "convoThreads", "convoNext", "convoPending", "convoLinear", "convoSayBtn", "convoStats", "convoHeadLine", "convoPanel",
    "lightbox", "lb-stage", "lb-img", "lb-title", "lb-cap", "lb-prev", "lb-next", "lb-zoomin", "lb-zoomout", "lb-fit", "lb-open", "lb-close",
    "attachBox", "attachAdd", "convo-text", "convo-copy", "convo-close2",
    "turn-agent", "turn-agents", "turn-text", "turn-status", "turn-type", "turn-parent", "turn-handoff", "turn-save", "turn-cancel", "convoHead", "convoMerge", "convoThreads", "convoNext", "convoPending", "convoLinear", "convoSayBtn", "convoStats", "convoHeadLine", "convoPanel",
    "lightbox", "lb-stage", "lb-img", "lb-title", "lb-cap", "lb-prev", "lb-next", "lb-zoomin", "lb-zoomout", "lb-fit", "lb-open", "lb-close",
    "attachBox", "attachAdd", "convo-text", "convo-copy", "convo-close2",
    "turn-agent", "turn-agents", "turn-text", "turn-status", "turn-type", "turn-parent", "turn-handoff", "turn-save", "turn-cancel", "depLegend", "depOff", "depBar", "typeFilterBar", "new-create", "new-name", "new-folder", "imp-af", "imp-text", "imp-go", "imp-name", "imp-afid", "imp-data", "exp-text", "exp-copy", "exp-dl", "arrow"]);
  const referenced = [...script.matchAll(/\$\("([\w-]+)"\)/g)].map((m) => m[1]);
  const missing = [...new Set(referenced)].filter((id) => !dynamicIds.has(id) && !new RegExp(`id="${id}"`).test(htmlPart));
  assert.deepEqual(missing, [], `these ids are missing from the HTML (top-level TypeError, silent boot failure): ${missing.join(", ")}`);
});

// —— 重复顶层声明检查（函数声明后者覆盖前者，是本项目反复踩的坑）——
await test("index.html has no duplicate top-level declarations", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../studio/index.html", import.meta.url), "utf8");
  const script = src.match(/<script>([\s\S]*)<\/script>/)[1];
  const names = new Map();
  const re = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|^const\s+([A-Za-z_$][\w$]*)\s*=/gm;
  let m;
  while ((m = re.exec(script))){
    const name = m[1] ?? m[2];
    names.set(name, (names.get(name) ?? 0) + 1);
  }
  const dup = [...names.entries()].filter(([, n]) => n > 1).map(([k, n]) => `${k}×${n}`);
  assert.deepEqual(dup, [], `duplicate top-level declarations (the later one silently overrides): ${dup.join(", ")}`);
});
// —— test/ 目录健全性：只放可被 node 解析的 .mjs（防止非 JS 脚本混入导致 `node test/*.mjs` 报错）——
await test("test/ contains only parseable .mjs files", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const dir = new URL("./", import.meta.url);
  const files = readdirSync(dir).filter((f) => !f.startsWith("."));
  const badExt = files.filter((f) => !f.endsWith(".mjs"));
  assert.deepEqual(badExt, [], `non-.mjs file(s) inside test/ (breaks "run all tests"): ${badExt.join(", ")}`);
  const broken = [];
  for (const f of files){
    const txt = readFileSync(new URL(f, import.meta.url), "utf8");
    const isPython = /^#!.*python/.test(txt) || /^\s*"""[\s\S]*?"""/m.test(txt.slice(0, 400));
    const hasJsTop = /(?:^|\n)\s*(?:import|export|const|let|function|await|console|assert|process)\b/.test(txt);
    if (isPython || !hasJsTop) broken.push(f);
  }
  assert.deepEqual(broken, [], `file(s) inside test/ do not look like runnable JS tests (misnamed script?): ${broken.join(", ")}`);
});

// —— 文档计数漂移检查：文档里的工具数量必须与 mcp-test 的实现断言一致 ——
await test("documented tool count matches the mcp-test assertion", async () => {
  const { readFileSync } = await import("node:fs");
  const mt = readFileSync(new URL("./mcp-test.mjs", import.meta.url), "utf8");
  const mm = mt.match(/tools\.length,\s*(\d+)/);
  assert.ok(mm, "no tool-count assertion found in mcp-test.mjs");
  const expect = Number(mm[1]);
  const docs = [
    "../skills/omni-flow/SKILL.md", "../docs/API.md",
    "../README.md", "../docs/TUTORIAL.md", "../docs/FORMULAS.md",
    "../bin/of.mjs", "../promo/index.html",
  ];
  const bad = [];
  for (const d of docs){
    let txt;
    try { txt = readFileSync(new URL(d, import.meta.url), "utf8"); } catch { continue; }
    // 负向后顾排除 "python3 tools"、"v1.2/3 tools" 这类误命中；只认独立出现的计数
    for (const m of txt.matchAll(/(?<![A-Za-z0-9_./-])(\d+)\s*(?:个工具|\btools\b)/g)){
      if (Number(m[1]) !== expect) bad.push(`${d} → ${m[0]}`);
    }
  }
  assert.deepEqual(bad, [], `documented tool count differs from the implementation (${expect}) — docs drift makes agents misjudge capabilities: ${bad.join("; ")}`);
});
console.log(results.join("\n"));


console.log(`\n${passed}/${results.length} 通过`);
if (passed !== results.length) process.exit(1);

// 引用检查（防 tree-shake 误报）
void NODE_TYPES; void EDGE_TYPES;
