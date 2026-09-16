#!/usr/bin/env node
// OmniFlow CLI (of) — universal flow map. graph.json is the single source of truth for topology.
import { homedir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { mkdir, readFile, writeFile, readdir, stat } from "node:fs/promises";
import { normalizeGraph, validateGraph } from "../lib/graph-core.js";
import { computeLayout, applyLayout, analyzeGraph } from "../lib/graph-analysis.js";
import { loadGraph, saveGraphChecked, listGraphs, deleteGraph, makeGraphId } from "../lib/graph-service.mjs";
import { buildTemplateById, mergedTemplateSummaries, saveCustomTemplate, deleteCustomTemplate } from "../lib/templates.js";
import { ensureConversationShape, appendTurn, setHead, mergeBranches, conversationOverview, linearize, registerAgent, recordTurn, pendingTurns, nextSpeaker, aggregateBranches, scaffoldTopology } from "../lib/conversation.js";
import { toMermaid, fromMermaid, toDot, toMarkdownOutline, toPlainText, fromAgentFlow } from "../lib/converters.js";
import { buildGraphFromMineru, buildGraphFromMarkdown } from "../lib/import-doc.js";
import { extractPythonData, buildGraphFromCards, buildOverviewFromFlow } from "../lib/import-cards.js";
import { liveStart, liveLog, liveStop, liveStatus } from "../lib/live-conversation.js";
import { addCrosslink, removeCrosslink, readCrosslinks, crosslinksForGraph, parseCrosslinkTable, pruneCrosslinks, assertLinkTargets } from "../lib/crosslinks.js";
import { projectOverview, projectSections } from "../lib/project.js";
import { readFileSync } from "node:fs";

// Single source of truth: package.json (a hardcoded copy drifted from releases before).
const VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
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

/** Persist a graph through the checked pipeline (formula gate + structure validation).
 *  A structure problem stays a warning (as before); unacceptable LaTeX aborts with the fix list. */
async function saveChecked(root, id, graph) {
  try {
    return await saveGraphChecked(root, id, graph);
  } catch (error) {
    if (error.code === "INVALID_STRUCTURE") {
      console.error(`\u26a0 structure warnings: ${(error.issues ?? []).slice(0, 3).join("; ")}`);
      return null;
    }
    fail(error.message);
  }
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
  await saveChecked(root, graph.id, graph);
  console.log(`✓ Created graph ${graph.name} (template ${template})`);
  console.log(`  id: ${graph.id}`);
  console.log(`  ${graph.nodes.length} nodes · ${graph.edges.length} edges`);
}

async function cmdList() {
  const root = rootHome();
  const graphs = await listGraphs(root);
  if (!graphs.length) { console.log("（empty）run `of create <name>` to build your first graph"); return; }
  for (const graph of graphs) {
    console.log(`${graph.valid ? "✓" : "⚠"} ${graph.id}  "${graph.name}"  ${graph.nodes} nodes / ${graph.edges} edges  ${graph.updatedAt ?? ""}`);
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
    console.log(`✓ Structure valid (${graph.nodes.length} nodes / ${graph.edges.length} edges)`);
    for (const warning of verdict.warnings) console.log(`  ⚠ ${warning}`);
  } else fail("Structure validation failed", verdict.issues);
}

async function cmdLayout() {
  const id = args[1];
  const root = rootHome();
  const { graph } = await loadGraph(root, id);
  const mode = opt("--mode", "layered");
  applyLayout(graph, mode);              // also re-fits every group box to its members
  graph.revision += 1;
  await saveChecked(root, id, graph);
  console.log("✓ Auto-layout applied");
}

async function cmdAnalyze() {
  const id = args[1];
  const traceFlag = opt("--trace");
  const { graph } = await loadGraph(rootHome(), id);
  const result = analyzeGraph(graph.nodes, graph.edges, { trace: traceFlag });
  console.log(`${result.nodeCount} nodes · ${result.edgeCount} edges`);
  console.log(`Cycles: ${result.cycles.length ? result.cycles.map((cycle) => cycle.join(" → ")).join(" ; ") : "none"}`);
  console.log(`Hubs / bottlenecks: ${result.ranked.slice(0, 5).map((entry) => `${entry.label}(${entry.total})`).join(" ") || "none"}`);
  console.log(`Isolated nodes: ${result.isolated.map((entry) => entry.label).join(" ") || "none"}`);
  if (result.trace) {
    console.log(`\nDependency trace — ${result.trace.nodeId}`);
    console.log(`  Upstream: ${result.trace.upstream.map((entry) => `${entry.label}(${entry.depth})`).join(" ← ") || "none"}`);
    console.log(`  Downstream: ${result.trace.downstream.map((entry) => `${entry.label}(${entry.depth})`).join(" → ") || "none"}`);
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
      try { const r = await readNodeNote(root, id, n.id); if (r?.exists) notes[n.id] = { content: r.content }; } catch { /* no note */ }
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
    console.log(`✓ Exported to ${out}`);
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
  if (!verdict.ok) fail("Imported content failed validation", verdict.issues);
  graph.id = makeGraphId(graph.name);
  await saveChecked(root, graph.id, graph);
  console.log(`✓ Imported "${graph.name}" id=${graph.id} (${graph.nodes.length} nodes / ${graph.edges.length} edges)`);
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
    fail(`agent-flow workflow ${afId} not found (${join(afHome, "flows", afId)})`);
  }
  const graph = await fromAgentFlow(JSON.parse(raw));
  graph.id = makeGraphId(graph.name);
  await saveChecked(root, graph.id, graph);
  console.log(`✓ Imported from agent-flow "${graph.name}" id=${graph.id} (${graph.nodes.length} nodes / ${graph.edges.length} edges)`);
}

async function cmdTemplates() {
  const root = rootHome();
  for (const template of await mergedTemplateSummaries(root)) {
    console.log(`${template.id.padEnd(20)} ${template.name}${template.custom ? "  [custom]" : ""} — ${template.desc}`);
  }
}

/** of template-save <graphId> --id <tplId> --name <NAME> --desc <DESC>: distil an existing graph into a template. */
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
  console.log(`✓ Template saved: ${saved.id} (reuse with of create --template ${saved.id})`);
}

async function cmdTemplateDelete() {
  const result = await deleteCustomTemplate(rootHome(), args[1]);
  console.log(`✓ Template deleted ${result.id}`);
}

async function cmdMeta() {
  const id = args[1];
  const root = rootHome();
  const { graph } = await loadGraph(root, id);
  if (opt("--name")) graph.name = opt("--name");
  if (opt("--desc")) graph.description = opt("--desc");
  if (opt("--direction")) graph.direction = opt("--direction") === "LR" ? "LR" : "TD";
  graph.revision += 1;
  await saveChecked(root, id, graph);
  console.log(`✓ ${graph.name} (direction ${graph.direction})`);
}

async function cmdTrash() {
  const { readdir, readFile } = await import("node:fs/promises");
  const trashDir = join(rootHome(), "trash");
  let entries = [];
  try { entries = await readdir(trashDir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries.filter((item) => item.isDirectory())) {
    try {
      const raw = JSON.parse(await readFile(join(trashDir, entry.name, "graph.json"), "utf8"));
      console.log(`${entry.name}  "${raw.name}" ${raw.id} (restore with of restore "${entry.name}")`);
    } catch { /* skip */ }
  }
}

async function cmdRestore() {
  const { readFile, rename } = await import("node:fs/promises");
  const entry = String(args[1] ?? "").replace(/[/\\]/g, "");
  const raw = JSON.parse(await readFile(join(rootHome(), "trash", entry, "graph.json"), "utf8"));
  await rename(join(rootHome(), "trash", entry), join(rootHome(), "graphs", raw.id));
  console.log(`✓ Restored "${raw.name}" id=${raw.id}`);
}

async function cmdDelete() {
  const id = args[1];
  if (opt("--yes") === null) fail("Deletion moves the graph into trash (recoverable). Add --yes to confirm.");
  const trashDir = await deleteGraph(rootHome(), id);
  console.log(`✓ Moved into ${trashDir}`);
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
  console.log(`Node.js ${process.versions.node} ${nodeOk ? "✓" : "✗ (>=18 required)"}`);
  console.log(`Storage root: ${root} ✓`);
  try {
    await readFile(new URL("../studio/index.html", import.meta.url), "utf8");
    console.log("Studio assets ✓");
  } catch { console.log("Studio assets ✗ (index.html missing)"); }
  const graphs = await listGraphs(root);
  console.log(`Graphs: ${graphs.length}`);
  try {
    const afHome = resolve(process.env.AF_HOME ?? join(homedir(), ".agent-flow"));
    await readFile(join(afHome, "package.json"), "utf8");
    console.log("agent-flow detected ✓ (import workflows with of import-af <id>)");
  } catch { console.log("agent-flow not installed (optional; nothing else is affected)"); }
}

function cmdHelp() {
  console.log(`OmniFlow v${VERSION} — a universal flow map: everything is a graph

usage: of <command> [args]

  create <name> [--template id] [--desc text]   build from a template (default: blank)
  templates                                    list all templates
  list / read <id>                             list graphs / show one graph
  validate <id>                                structure validation (hard errors + soft warnings)
  analyze <id> [--trace nodeId]                cycles / bottlenecks / orphans / dependency trace
  layout <id> [--mode layered|clusters]        layout: layered / grouped clusters
  export <id> --format mermaid|dot|md|txt|json|html [--out FILE] [--no-embed]
  import <file> [--format mermaid|json] [--name NEW-NAME]
  import-doc <content_list.json|.md|build_data.py> [--name NAME] [--pages PAGE-IMG-DIR] [--folder PATH]  # MinerU / Markdown / card table → graph
  import-af <agent-flow-id>                    import an agent-flow workflow as a graph
  studio [--port N] [--no-open]                local canvas (default 127.0.0.1:4319)
  mcp                                          MCP standard server (stdio, all 61 tools)
  template-save <graphId> [--id --name --desc]  distil a graph into a custom template
  template-delete <templateId>                  delete a custom template
  meta <graphId> [--name --desc --direction]     edit graph meta
  trash / restore <trashName>                   list the trash / restore
  delete <id> --yes                             move into trash (recoverable)
  doctor                                        environment self-check

Every node/edge style (color, shape, arrow, label) is edited in the Studio, or by editing graph.json directly.`);
}


/* ---------- Non-linear conversation (DAG sessions) CLI ---------- */
async function cmdConvo(){
  const sub = args[1];
  const root = rootHome();
  if (sub === "new"){
    const topic = args[2];
    if (!topic){ console.error('usage: of convo new "topic" [--folder PATH] [--lang zh|en]'); process.exit(1); }
    await ensureRoot(root);
    const g = ensureConversationShape(normalizeGraph({ name: topic, nodes: [], edges: [], groups: [], notes: {} }), { topic });
    g.id = makeGraphId(g.name);
    appendTurn(g, { text: topic, speaker: "system", type: "topic" });
    await saveChecked(root, g.id, g);
    const folder = opt("--folder");
    if (folder) { try { await moveGraph(root, g.id, folder); } catch { /* filing failure is not fatal */ } }
    console.log(`✓ Conversation created\n  id: ${g.id}\n  stored: ${join(root, "graphs", g.id, "graph.json")}`);
    return;
  }
  const id = args[2];
  if (!id){ console.error("usage: of convo say|branch|merge|path|open <graphId> …"); process.exit(1); }
  const { graph } = await loadGraph(root, id);
  let changed = false;
  if (sub === "say"){
    const flagNames = new Set(["--speaker", "--type", "--from", "--edge"]);
    const rawWords = args.slice(3);
    const textWords = [];
    for (let i = 0; i < rawWords.length; i++){
      if (flagNames.has(rawWords[i])){ i++; continue; }   // skip the flag and its value
      textWords.push(rawWords[i]);
    }
    const text = textWords.join(" ");
    ensureConversationShape(graph);
    const node = appendTurn(graph, { text, speaker: opt("--speaker", "user"), type: opt("--type", "turn"), parentId: opt("--from"), edgeType: opt("--edge", "follows") });
    graph.notes = graph.notes ?? {};
    graph.notes[node.id] = String(text).split("\n")[0].slice(0, 120);
    changed = true;
    console.log(`✓ Turn appended ${node.id} (head moved)`);
  } else if (sub === "branch"){
    ensureConversationShape(graph);
    setHead(graph, args[3]);
    changed = true;
    console.log(`✓ Head moved to ${args[3]}; the next say forks from here`);
  } else if (sub === "merge"){
    ensureConversationShape(graph);
    const sources = String(args[3] ?? "").split(",").map((x)=> x.trim()).filter(Boolean);
    const node = mergeBranches(graph, { sources, label: opt("--label", "merge"), text: opt("--text", "") });
    changed = true;
    console.log(`✓ Merge node created ${node.id}`);
  } else if (sub === "path"){
    // the third positional may be a node id or a flag → only treat non-flags as nodes
    const maybeNode = args[3] && !String(args[3]).startsWith("--") ? args[3] : null;
    const target = maybeNode ?? graph.conversation?.head;
    console.log(linearize(graph, target, { format: opt("--format", "md") }));
    return;
  } else if (sub === "next"){
    const n = nextSpeaker(ensureConversationShape(graph));
    console.log(`Next speaker: ${n.nextSpeaker ?? "—"}\nreason: ${n.reason}\nround: ${n.round}\ntopology: ${n.topology}\nawaiting: ${n.awaiting.join(", ") || "—"}`);
    console.log(`\n--- Context to send (root → head) ---\n${n.contextText}`);
    return;
  } else if (sub === "pending"){
    const ps = pendingTurns(ensureConversationShape(graph));
    console.log(ps.length ? ps.map((x)=> `· [${x.status}] ${x.agent ?? "?"} — ${x.label}  (${x.id})`).join("\n") : "(no pending branches)");
    return;
  } else if (sub === "agent"){
    // of convo agent <id> <name> [--role worker] [--model gpt-4o] [--goal GOAL]
    ensureConversationShape(graph);
    const a = registerAgent(graph, { name: args[3], role: opt("--role", "worker"), model: opt("--model", ""), goal: opt("--goal", "") });
    changed = true;
    console.log(`✓ Agent registered ${a.name} (${a.role})`);
  } else if (sub === "record"){
    // of convo record <id> <agent> "TEXT" [--status done|running|...] [--from NODE] [--handoff TARGET]
    const agent = args[3];
    const words = []; const flags = new Set(["--status", "--from", "--handoff", "--type", "--edge"]);
    const rest = args.slice(4);
    for (let i = 0; i < rest.length; i++){ if (flags.has(rest[i])){ i++; continue; } words.push(rest[i]); }
    ensureConversationShape(graph);
    const node = recordTurn(graph, { agent, text: words.join(" "), status: opt("--status", "done"), parentId: opt("--from"), handoffTo: opt("--handoff"), type: opt("--type", "turn"), edgeType: opt("--edge", "follows") });
    graph.notes = graph.notes ?? {};
    graph.notes[node.id] = words.join(" ").split("\n")[0].slice(0, 120);
    changed = true;
    console.log(`✓ Recorded output of ${agent} → ${node.id} (${node.status})`);
  } else if (sub === "vote"){
    // of convo vote <id> <node,node,...> [--strategy majority|judge] [--text VERDICT]
    ensureConversationShape(graph);
    const sources = String(args[3] ?? "").split(",").map((x)=> x.trim()).filter(Boolean);
    const r = aggregateBranches(graph, { sources, strategy: opt("--strategy", "majority"), label: opt("--label", null), text: opt("--text", "") });
    graph.notes = graph.notes ?? {};
    graph.notes[r.node.id] = String(r.chosen ?? "").slice(0, 120);
    changed = true;
    console.log(`✓ Aggregated: ${r.strategy} · ${r.distinct} distinct answers · consensus ${(r.consensus * 100).toFixed(0)}%\n  tally: ${r.tally.map((t)=> `${t.count}×${t.value.slice(0, 30)}`).join(" | ")}`);
  } else if (sub === "scaffold"){
    // of convo scaffold <id> <topology> <name:role,name:role,...> [--topic TOPIC]
    ensureConversationShape(graph);
    // args = [cmd, "convo", sub, id, topology, "name:role,..."]
    const topology = args[3] ?? "supervisor";
    const agents = String(args[4] ?? "").split(",").map((x)=> x.trim()).filter(Boolean).map((pair)=> {
      const [name, role] = pair.split(":");
      return { name, role: role ?? "worker" };
    });
    const created = scaffoldTopology(graph, { topology, agents, topic: opt("--topic", null) });
    changed = true;
    console.log(`✓ ${topology} scaffold created: ${created.branches.length} parallel branches (agents: ${created.agents.join(", ")})`);
  } else if (sub === "open"){
    const ov = conversationOverview(ensureConversationShape(graph));
    console.log(`head: ${ov.head}\nmainline length: ${ov.mainline.length}\nopen threads: ${ov.openThreads.length}:`);
    for (const th of ov.openThreads) console.log(`  · ${th.label}  (${th.id})`);
    console.log(`forks ${ov.forkCount ?? ov.forks.length}: ${ov.forks.map((f)=> f.label).join(" / ") || "—"}`);
    console.log(`speakers: ${ov.speakers.join(", ") || "—"}`);
    return;
  } else {
    console.error("usage: of convo new|say|branch|merge|path|open …");
    process.exit(1);
  }
  if (changed){ graph.revision += 1; await saveChecked(root, id, graph); }
}


/* ---------- Document import: MinerU structure / Markdown → card graph ---------- */
async function cmdImportDoc(){
  const file = args[1];
  if (!file){ console.error("usage: of import-doc <content_list.json | .md> [--name GRAPH-NAME] [--pages PAGE-IMG-DIR] [--folder PATH] [--lang zh|en]"); process.exit(1); }
  const root = rootHome();
  await ensureRoot(root);
  const raw = await readFile(file, "utf8");
  const name = opt("--name", file.replace(/^.*\//, "").replace(/\.(json|md)$/i, ""));
  // page-image dir: the number in a filename is the page number (e.g. p024.png / c2_pdf024_book021.png)
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
    } catch (e){ console.error(`⚠ page-image directory unreadable: ${e.message}`); }
  }
  // MinerU's image_source.path is resolved relative to the json directory (or mineru_native/)
  const assetsRoot = opt("--assets-root", dirname(resolve(file)));
  let built;
  if (/\.py$/i.test(file)){
    // hand-curated card table (build_data.py shape): highest fidelity, with manual deps and justified section flows
    const data = await extractPythonData(file, { python: opt("--python", "python3") });
    built = buildGraphFromCards(data, { name, lang: opt("--lang", "zh") });
    built.__flow = { data };
  } else if (/\.json$/i.test(file)){
    built = buildGraphFromMineru({ contentList: JSON.parse(raw), pages, name, lang: opt("--lang", "zh") });
  } else {
    built = buildGraphFromMarkdown({ markdown: raw, pages, name });
  }
  built.graph.id = makeGraphId(built.graph.name);
  const verdict = validateGraph(built.graph);
  if (!verdict.ok) console.error(`⚠ structure warnings: ${verdict.issues.slice(0, 3).join("; ")}`);
  await saveChecked(root, built.graph.id, built.graph);
  // asset copy: (1) MinerU-extracted images (formula figures/illustrations) (2) page images; all go into <graph>/assets/
  let attached = 0;
  {
    const { copyFile, mkdir } = await import("node:fs/promises");
    const assetsDir = join(root, "graphs", built.graph.id, "assets");
    await mkdir(assetsDir, { recursive: true });
    // resolve an in-graph relative path to absolute candidates (json dir / mineru_native / the image dir itself)
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
        if (/^assets\//.test(a.src)){ list.push(a); continue; }   // already an in-graph path
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
          } catch { /* try the next candidate */ }
        }
        if (!copied) list.push(a);   // keep the original reference (external link, or not found)
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
  console.log(`✓ Graph built from ${file}`);
  console.log(`  id: ${built.graph.id}`);
  console.log(`  cards: ${built.stats.cards} (${Object.entries(built.stats.byType).map(([k, v])=> `${k} ${v}`).join(" · ")})`);
  console.log(`  format ${built.stats.format} · dependency edges ${built.stats.edges} · section groups ${built.stats.groups}${built.stats.pages ? ` · pages ${built.stats.pages}` : ""}`);
  if (built.stats.inlineFormulas) console.log(`  inline formulas preserved: ${built.stats.inlineFormulas}`);
  if (attached) console.log(`  attached images: ${attached} (MinerU figures + page images)`);
  console.log(`  stored: ${join(root, "graphs", built.graph.id, "graph.json")}${folder ? `\n  filed: ${folder}` : ""}`);
  if (built.__flow?.data?.SECTION_FLOW?.length){
    const ov = buildOverviewFromFlow(built.__flow.data, { name: `${name} · Section overview`, sourceId: built.graph.id });
    ov.graph.id = makeGraphId(ov.graph.name);
    await saveChecked(root, ov.graph.id, ov.graph);
    if (folder){ try { await moveGraph(root, ov.graph.id, folder); } catch {} }
    console.log(`  ↗ Section overview: ${ov.stats.sections} sections · ${ov.stats.edges} justified cross-section deps\n    id: ${ov.graph.id}`);
  }
}


/* ---------- Live conversation capture CLI ----------
   of live start [--topic TOPIC] [--folder PATH]   start (resumes an open session)
   of live log "TEXT" [--role user|agent]          log one turn (no id needed)
   of live stop                                    stop
   of live status                                  status
*/
async function cmdLive(){
  const sub = args[1] ?? "status";
  const root = rootHome();
  if (sub === "start"){
    const r = await liveStart(root, { topic: opt("--topic", null), folder: opt("--folder", null), lang: opt("--lang", "zh") === "en" ? "en" : "zh" });
    console.log(`${r.resumed ? "✓ Resumed recording" : "✓ Recording started"}: ${r.name}\n  id: ${r.id}\n  topic: ${r.topic}\n  turns so far: ${r.turns}`);
    return;
  }
  if (sub === "log"){
    const words = []; const flags = new Set(["--role", "--name", "--from", "--type", "--status", "--handoff"]);
    const rest = args.slice(2);
    for (let i = 0; i < rest.length; i++){ if (flags.has(rest[i])){ i++; continue; } words.push(rest[i]); }
    const r = await liveLog(root, { role: opt("--role", "agent"), text: words.join(" "), name: opt("--name", null), from: opt("--from", null), type: opt("--type", null), status: opt("--status", "done"), handoffTo: opt("--handoff", null) });
    console.log(`✓ Logged one ${r.role} turn → ${r.nodeId} (mainline ${r.mainline} · total ${r.total})`);
    return;
  }
  if (sub === "stop"){ console.log(JSON.stringify(await liveStop(root), null, 2)); return; }
  const st = await liveStatus(root);
  console.log(st.on ? `● Recording: ${st.name}\n  turns ${st.turns} · mainline ${st.mainline} · open threads ${st.openThreads}\n  id: ${st.id}` : `○ Not recording${st.id ? ` (last: ${st.name ?? st.id}, ${st.turns} turns)` : ""}`);
}


/* ---------- Live conversation capture CLI ----------
   of live start [--topic TOPIC] [--folder PATH]   start (resumes an open session)
   of live log "TEXT" [--role user|agent]          log one turn (no id needed)
   of live stop                                    stop
   of live status                                  status
*/


/* ---------- Cross-graph links (single source of truth + mathematical reason) ----------
   of xlink add --from GRAPH:NODE --to GRAPH:NODE --why "REASON"
   of xlink import <crosslinks.py|json> [--map BOOK=graphId,...]
   of xlink list [graphId] | of xlink rm <id>
*/
async function cmdXlink(){
  const sub = args[1] ?? "list";
  const root = rootHome();
  const split = (v)=>{
    const i = String(v ?? "").lastIndexOf(":");
    return i > 0 ? { graph: v.slice(0, i), node: v.slice(i + 1) } : null;
  };
  if (sub === "add"){
    const f = split(opt("--from")), t = split(opt("--to"));
    if (!f || !t){ console.error('usage: of xlink add --from GRAPH:NODE --to GRAPH:NODE --why "mathematical reason"'); process.exit(1); }
    try { await assertLinkTargets(root, { fromGraph: f.graph, fromNode: f.node, toGraph: t.graph, toNode: t.node }); }
    catch (error){ fail(error.message); }
    const r = await addCrosslink(root, { fromGraph: f.graph, fromNode: f.node, toGraph: t.graph, toNode: t.node, why: opt("--why", ""), kind: opt("--kind", "depends") });
    console.log(`${r.created ? "✓ Added" : "✓ Updated"} cross-graph link ${r.link.id}\n  ${f.graph}:${f.node} → ${t.graph}:${t.node}`);
    return;
  }
  if (sub === "import"){
    const file = args[2];
    if (!file){ console.error("usage: of xlink import <crosslinks.py|.json> [--map SAMUEL=graphId,ALUFFI=graphId]"); process.exit(1); }
    const map = {};
    for (const pair of String(opt("--map", "")).split(",").filter(Boolean)){
      const [k, v] = pair.split("=");
      if (k && v) map[k.trim()] = v.trim();
    }
    const rows = parseCrosslinkTable(await readFile(file, "utf8"), { bookToGraph: map });
    let created = 0, updated = 0;
    for (const r of rows){ const res = await addCrosslink(root, r); res.created ? created++ : updated++; }
    console.log(`✓ Imported ${rows.length} cross-graph links (added ${created} · updated ${updated})`);
    if (!Object.keys(map).length) console.log("  tip: use --map BOOK=graphId to map book codes onto local graph ids");
    return;
  }
  if (sub === "rm"){
    const r = await removeCrosslink(root, args[2]);
    console.log(`✓ Removed ${r.removed}`);
    return;
  }
  if (sub === "prune"){
    const r = await pruneCrosslinks(root, {
      graphExists: async (gid)=> { try { await loadGraph(root, gid); return true; } catch { return false; } },
      nodeExists: async (gid, nid)=> {
        try { const { graph } = await loadGraph(root, gid); return graph.nodes.some((n)=> n.id === nid); }
        catch { return false; }
      },
    });
    console.log(`✓ Pruned ${r.removed} stale cross-graph links (kept ${r.kept}/${r.total})`);
    return;
  }
  const gid = args[2];
  const list = gid ? await crosslinksForGraph(root, gid) : (await readCrosslinks(root)).map((x)=> ({ ...x, view: "-", self: x.from, other: x.to }));
  if (!list.length){ console.log("(no cross-graph links)"); return; }
  console.log(`${list.length} total:`);
  for (const x of list.slice(0, 60)){
    const arrow = x.view === "provides" ? "→ external reference" : x.view === "uses" ? "← cross-graph support" : "";
    console.log(`  ${x.from.graph}:${x.from.node} → ${x.to.graph}:${x.to.node}  ${arrow}`);
    if (x.why) console.log(`     why: ${String(x.why).slice(0, 110)}${x.why.length > 110 ? "…" : ""}`);
  }
}

/* ---------- Hierarchical projection ----------
   of project overview <graphId> [--name NAME] [--folder PATH]
   of project sections <graphId> [--min 3] [--only SECTION] [--folder PATH]
*/
async function cmdProject(){
  const kind = args[1], id = args[2];
  if (!kind || !id){ console.error("usage: of project overview|sections <graphId> [--min 3] [--only SECTION] [--folder PATH]"); process.exit(1); }
  const root = rootHome();
  const folder = opt("--folder");
  if (kind === "overview"){
    const r = await projectOverview(root, id, { name: opt("--name", null), folder });
    r.graph.id = makeGraphId(r.graph.name);
    await saveChecked(root, r.graph.id, r.graph);
    if (folder){ try { await moveGraph(root, r.graph.id, folder); } catch {} }
    console.log(`✓ Section overview: ${r.graph.nodes.length} sections · ${r.graph.edges.length} aggregated dependencies\n  id: ${r.graph.id}`);
    if (r.crossLinks) console.log(`  includes ${r.crossLinks} cross-graph links`);
    return;
  }
  if (kind === "sections"){
    const r = await projectSections(root, id, { minCards: Number(opt("--min", 3)), only: opt("--only", null), folder });
    console.log(`✓ Generated ${r.created.length} section graphs (source has ${r.sections} sections)`);
    for (const c of r.created) console.log(`  · ${c.name.slice(0, 38)} — ${c.cards} cards + ${c.ghosts} ghosts · ${c.edges} edges\n    id: ${c.id}`);
    return;
  }
  console.error("usage: of project overview|sections <graphId> …");
  process.exit(1);
}

const commands = {
  create: cmdCreate, list: cmdList, read: cmdRead, validate: cmdValidate,
  convo: cmdConvo, live: cmdLive, xlink: cmdXlink, project: cmdProject, live: cmdLive, analyze: cmdAnalyze, layout: cmdLayout, export: cmdExport, import: cmdImport,
  "import-af": cmdImportAf, "import-doc": cmdImportDoc, templates: cmdTemplates, delete: cmdDelete,
  "template-save": cmdTemplateSave, "template-delete": cmdTemplateDelete,
  meta: cmdMeta, trash: cmdTrash, restore: cmdRestore,
  studio: cmdStudio, mcp: cmdMcp, doctor: cmdDoctor, help: cmdHelp, "--help": cmdHelp,
  "-h": cmdHelp, "--version": () => console.log(VERSION), "-v": () => console.log(VERSION)
};
const handler = commands[command];
if (!handler) { console.error(`unknown command: ${command}`); cmdHelp(); process.exit(1); }
await handler();
