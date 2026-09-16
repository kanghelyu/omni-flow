// OmniFlow Studio local server — zero-dependency HTTP + SSE, bound to 127.0.0.1 only.
// Every topology change is normalised and validated in memory first; hard errors never reach disk.
import { createServer } from "node:http";
import { homedir } from "node:os";
import { join, resolve, extname, basename } from "node:path";
import { spawn } from "node:child_process";
import { readFile, writeFile, copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { NODE_TYPES, EDGE_TYPES, normalizeGraph, validateGraph, newId, nodeTypeDef, setNodeAttachments, setGroupRect, moveNodes } from "../lib/graph-core.js";
import { computeLayout, applyLayout, analyzeGraph } from "../lib/graph-analysis.js";
import { searchGraphs } from "../lib/search.mjs";
import { suggestGroups } from "../lib/group-suggest.js";
import { ensureConversationShape, appendTurn, setHead, mergeBranches, pathTo, conversationOverview, linearize, recordTurn, resolveTurn, pendingTurns, nextSpeaker, aggregateBranches, scaffoldTopology } from "../lib/conversation.js";
import { liveStart, liveLog, liveStop, liveStatus } from "../lib/live-conversation.js";
import { addCrosslink, removeCrosslink, crosslinksForGraph, assertLinkTargets } from "../lib/crosslinks.js";
import { projectOverview, projectSections } from "../lib/project.js";
import { loadGraph, saveGraph, listGraphs, deleteGraph, readNodeNote, writeNodeNote, makeGraphId, readJsonIfPresent, mutateGraph as mutateGraphAt, graphDir } from "../lib/graph-service.mjs";
import { createFolder, renameFolder, deleteFolder, moveGraph, readTree, updateLedger } from "../lib/vault.js";
import { buildTemplateById, mergedTemplateSummaries, saveCustomTemplate, deleteCustomTemplate } from "../lib/templates.js";
import { toMermaid, fromMermaid, toDot, toMarkdownOutline, toPlainText, fromAgentFlow } from "../lib/converters.js";

const BODY_LIMIT = 48 * 1024 * 1024;   // attachments upload as base64 (~1.33x overhead), so the cap is raised

/** Front-end assets served next to index.html, so the markup file stays small and readable. */
const STUDIO_ASSETS = {
  "/app.css": ["app.css", "text/css; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(body);
}

const BODY_CACHE = new WeakMap();
/** Read the request body. **Reentrant**: calling it several times for one request returns the same parsed result —
 *  previously an entry-point pre-read made the later /upload handler see an empty object. */
async function readBody(req) {
  if (BODY_CACHE.has(req)) return BODY_CACHE.get(req);
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > BODY_LIMIT) throw new Error("body too large");
    chunks.push(chunk);
  }
  const parsed = chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString("utf8"));
  BODY_CACHE.set(req, parsed);
  return parsed;
}

function safeId(raw) {
  const id = decodeURIComponent(String(raw ?? ""));
  if (!id || id.includes("/") || id.includes("\\") || id.includes("..")) return null;
  return id;
}

function graphDetail(graph, notesSummary = {}) {
  const verdict = validateGraph(graph);
  return {
    id: graph.id,
    name: graph.name,
    description: graph.description,
    revision: graph.revision,
    direction: graph.direction,
    nodeTypes: { ...NODE_TYPES, ...graph.nodeTypes },
    edgeTypes: { ...EDGE_TYPES, ...graph.edgeTypes },
    valid: verdict.ok,
    issues: verdict.issues,
    warnings: verdict.warnings,
    nodes: graph.nodes,
    edges: graph.edges,
    groups: graph.groups,
    notes: { ...graph.notes, ...notesSummary },
    // non-linear conversation metadata (head / speakers / mode): passed straight to the front end
    ...(graph.conversation ? { conversation: graph.conversation } : {})
  };
}

/**
 * HTTP adapter over the shared write pipeline (lib/graph-service.mjs `mutateGraph`).
 * The pipeline itself lives in one place so the formula gate cannot be bypassed; here we only
 * translate its exceptions into the shape the HTTP routes expect:
 *   - success            → { ok: true, revision, detail }
 *   - structure failure   → { ok: false, issues }   (routes answer 400 with it)
 *   - LaTeX failure       → rethrown                (the outer handler answers 400 with the hint)
 */
async function mutateGraph(root, id, mutator, { bump = true } = {}) {
  try {
    const result = await mutateGraphAt(root, id, mutator, { bump });
    return { ok: true, revision: result.revision, detail: graphDetail(result.graph) };
  } catch (error) {
    if (error.code === "INVALID_STRUCTURE") return { ok: false, issues: error.issues ?? [error.message] };
    throw error;
  }
}

async function watchSignature(root) {
  let entries = [];
  try {
    entries = await readdirSafe(join(root, "graphs"));
  } catch {
    return "";
  }
  const parts = [];
  for (const entry of entries) {
    try {
      const mark = await stat(join(root, "graphs", entry, "graph.json"));
      parts.push(`${entry}:${Math.round(mark.mtimeMs)}`);
    } catch { /* skip */ }
  }
  return parts.join("|");
}

async function readdirSafe(dir) {
  try {
    const { readdir } = await import("node:fs/promises");
    return (await readdir(dir, { withFileTypes: true })).filter((item) => item.isDirectory()).map((item) => item.name);
  } catch {
    return [];
  }
}

export async function startStudioServer({ root, host = "127.0.0.1", port = 0 } = {}) {
  root = resolve(root ?? process.env.OF_HOME ?? join(homedir(), ".omni-flow"));
  const clients = new Set();
  let lastSignature = await watchSignature(root);

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      const parts = url.pathname.split("/").filter(Boolean);
      if (req.method === "GET" && url.pathname === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        res.end(await readFile(new URL("./index.html", import.meta.url), "utf8"));   // read per request: front-end edits need no restart
        return;
      }
      // Graph attachment assets (source page images / PDFs): <root>/graphs/<graphId>/assets/<file>
      {
        const m = url.pathname.match(/^\/api\/graph\/([^/]+)\/asset\/(.+)$/);
        if (m && req.method === "GET") {
          const gid = decodeURIComponent(m[1]);
          const name = decodeURIComponent(m[2]);
          // Only block traversal and absolute paths; allow legacy relative paths such as images/xxx.jpg (resolved by basename below)
          if (!gid || name.includes("..") || name.startsWith("/") || name.includes("\u0000")) { sendJson(res, 400, { error: "bad asset path" }); return; }
          const assetsDir = join(root, "graphs", gid, "assets");
          // resolution order: exact name → basename without directories → a file in assets ending with -<basename>
          // (import copies the original to <nodeId>-<originalName>; older data still holds the raw relative path, hence the fallback)
          const base = name.split("/").pop();
          let file = null, data = null;
          for (const cand of [name, base]){
            try { data = await readFile(join(assetsDir, cand)); file = cand; break; } catch { /* try the next one */ }
          }
          if (!data){
            try {
              const files = await readdir(assetsDir);
              const hit = files.find((f)=> f === base || f.endsWith(`-${base}`) || f.endsWith(base));
              if (hit){ data = await readFile(join(assetsDir, hit)); file = hit; }
            } catch { /* directory does not exist */ }
          }
          if (!data){ sendJson(res, 404, { error: `asset not found: ${name}` }); return; }
          const ext = extname(file ?? base).slice(1).toLowerCase();
          const mime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", pdf: "application/pdf" }[ext] ?? "application/octet-stream";
          res.writeHead(200, { "content-type": mime, "cache-control": "public, max-age=3600" });
          res.end(data);
          return;
        }
      }
      // Studio front-end assets (app.css / app.js) live next to index.html.
      // Read per request like index.html, so editing them needs no server restart.
      if (req.method === "GET" && STUDIO_ASSETS[url.pathname]) {
        const [file, mime] = STUDIO_ASSETS[url.pathname];
        try {
          const body = await readFile(new URL(`./${file}`, import.meta.url), "utf8");
          res.writeHead(200, { "content-type": mime, "cache-control": "no-store" });
          res.end(body);
        } catch {
          sendJson(res, 404, { error: `asset not found: ${file}` });
        }
        return;
      }
      // Local static assets (vendored KaTeX and fonts): fully offline, no CDN dependency
      if (req.method === "GET" && url.pathname.startsWith("/vendor/")) {
        const rel = decodeURIComponent(url.pathname.slice("/vendor/".length));
        if (!rel || rel.includes("..")) { sendJson(res, 400, { error: "bad asset path" }); return; }
        const ext = rel.split(".").pop()?.toLowerCase();
        const mime = {
          js: "text/javascript; charset=utf-8",
          css: "text/css; charset=utf-8",
          woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf", otf: "font/otf",
          svg: "image/svg+xml", json: "application/json; charset=utf-8", map: "application/json; charset=utf-8",
        }[ext] ?? "application/octet-stream";
        try {
          const data = await readFile(new URL(`./vendor/${rel}`, import.meta.url));
          res.writeHead(200, { "content-type": mime, "cache-control": "public, max-age=86400" });
          res.end(data);
        } catch {
          sendJson(res, 404, { error: `asset not found: ${rel}` });
        }
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/graphs") {
        sendJson(res, 200, await listGraphs(root));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/search") {
        sendJson(res, 200, { results: await searchGraphs(root, url.searchParams.get("q")) });
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/tree") {
        sendJson(res, 200, await readTree(root));
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/tree/folder") {
        const body = await readBody(req);
        sendJson(res, 200, await createFolder(root, body.path));
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/tree/folder-rename") {
        const body = await readBody(req);
        sendJson(res, 200, await renameFolder(root, body.path, body.newPath));
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/tree/folder-delete") {
        const body = await readBody(req);
        sendJson(res, 200, await deleteFolder(root, body.path));
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/tree/move") {
        const body = await readBody(req);
        sendJson(res, 200, await moveGraph(root, body.graphId, body.folder));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/templates") {
        const lang = url.searchParams.get("lang") === "en" ? "en" : "zh";
        sendJson(res, 200, await mergedTemplateSummaries(root, lang));
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/templates") {
        const body = await readBody(req);
        if (body.fromGraph) {
          const { graph } = await loadGraph(root, safeId(body.fromGraph) ?? "_");
          Object.assign(body, {
            nodes: graph.nodes, edges: graph.edges, groups: graph.groups, direction: graph.direction
          });
        }
        const saved = await saveCustomTemplate(root, body);
        sendJson(res, 201, saved);
        return;
      }
      if (req.method === "POST" && url.pathname.startsWith("/api/templates-delete/")) {
        const tplId = decodeURIComponent(url.pathname.split("/").pop() ?? "");
        sendJson(res, 200, await deleteCustomTemplate(root, tplId));
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/graphs") {
        const body = await readBody(req);
        const name = String(body.name ?? "").trim() || 'Untitled graph';
        const templateId = String(body.template ?? "blank");
        const graph = await buildTemplateById(root, templateId, name, body.lang === "zh" ? "zh" : "en");
        graph.id = makeGraphId(name);
        if (typeof body.description === "string" && body.description.trim()) graph.description = body.description.trim();
        await saveGraph(graphDir(root, graph.id), graph);
        // optional filing into a folder: build the folder tree + assignment, return the full storage info so an agent can report it faithfully
        let folder = null;
        if (typeof body.folder === "string" && body.folder.trim()) {
          const archived = await createFolder(root, body.folder);
          await moveGraph(root, graph.id, archived.folder);
          folder = archived.folder;
        }
        await updateLedger(root);
        sendJson(res, 201, {
          ok: true, id: graph.id, name: graph.name, folder,
          storage: {
            root,
            graph: join(root, "graphs", graph.id, "graph.json"),
            notesDir: join(root, "graphs", graph.id, "notes"),
            ledger: join(root, "WORKLOG.txt"),
            ledger: join(root, "WORKLOG.txt")
          },
          nodes: graph.nodes.length, edges: graph.edges.length, groups: (graph.groups ?? []).length,
          template: templateId
        });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/import") {
        // text import: format = mermaid | json; af = agent-flow import.
        const body = await readBody(req);
        const format = String(body.format ?? "mermaid");
        let graph;
        if (format === "json") {
          graph = normalizeGraph(typeof body.data === "object" ? body.data : JSON.parse(String(body.text ?? "{}")));
          graph.id = makeGraphId(graph.name);
        } else if (format === "af") {
          const afId = String(body.afId ?? "");
          const { readJsonIfPresent } = await import("../lib/graph-service.mjs");
          const afHome = resolve(process.env.AF_HOME ?? join(homedir(), ".agent-flow"));
          const afFlow = await readJsonIfPresent(join(afHome, "flows", safeId(afId) ?? "_", "flow.json"));
          if (!afFlow) { sendJson(res, 404, { error: `agent-flow workflow ${afId} not found` }); return; }
          graph = await fromAgentFlow(afFlow);
          graph.id = makeGraphId(graph.name);
        } else {
          graph = fromMermaid(String(body.text ?? ""));
          graph.id = makeGraphId(graph.name);
        }
        if (typeof body.name === "string" && body.name.trim()) graph.name = body.name.trim();
        const verdict = validateGraph(graph);
        if (!verdict.ok) { sendJson(res, 400, { ok: false, issues: verdict.issues }); return; }
        await saveGraph(graphDir(root, graph.id), graph);
        sendJson(res, 201, { id: graph.id, name: graph.name });
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/events") {
        res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", connection: "keep-alive" });
        res.write("event: hello\ndata: {}\n\n");
        clients.add(res);
        req.on("close", () => clients.delete(res));
        return;
      }
      /* Cross-graph links: GET ?graph=<id> for one graph; POST { fromGraph,… } to add; DELETE ?id= */
      if (url.pathname === "/api/crosslinks") {
        if (req.method === "GET"){
          const gid = url.searchParams.get("graph");
          const links = gid ? await crosslinksForGraph(root, gid) : await (await import("../lib/crosslinks.js")).readCrosslinks(root);
          // enrich: resolve the peer graph name + node label for display, and flag broken links
          const cache = new Map();
          const head = async (g)=> {
            if (cache.has(g)) return cache.get(g);
            let v = null;
            try { const { graph } = await loadGraph(root, g); v = graph; } catch { v = null; }
            cache.set(g, v);
            return v;
          };
          const out = [];
          for (const l of links){
            const otherGraph = l.other?.graph ?? (l.from?.graph === gid ? l.to?.graph : l.from?.graph);
            const otherNode = l.other?.node ?? (l.from?.graph === gid ? l.to?.node : l.from?.node);
            const og = await head(otherGraph);
            const on = og?.nodes?.find((n)=> n.id === otherNode) ?? null;
            out.push({
              ...l,
              otherGraphName: og?.name ?? null,
              otherNodeLabel: on?.label ?? null,
              otherNodeType: on?.type ?? null,
              broken: !og || !on,
            });
          }
          sendJson(res, 200, { links: out });
          return;
        }
        if (req.method === "POST"){
          const body2 = await readBody(req);
          try {
            await assertLinkTargets(root, body2);      // refuse links to things that do not exist
            sendJson(res, 200, await addCrosslink(root, body2));
          } catch (error){
            sendJson(res, error.code === "XLINK_TARGET" ? 400 : 500, { error: error.message });
          }
          return;
        }
        if (req.method === "DELETE"){
          sendJson(res, 200, await removeCrosslink(root, url.searchParams.get("id")));
          return;
        }
      }

      /* Live conversation capture: GET status / POST { op: start|log|stop, … } */
      if (url.pathname === "/api/live") {
        if (req.method === "GET"){ sendJson(res, 200, await liveStatus(root)); return; }
        const body = await readBody(req);
        const op = String(body.op ?? "status");
        if (op === "start"){ sendJson(res, 200, await liveStart(root, { topic: body.topic ?? null, folder: body.folder ?? null, lang: body.lang === "en" ? "en" : "zh", reuse: body.reuse !== false })); return; }
        if (op === "log"){ sendJson(res, 200, await liveLog(root, { role: body.role ?? "agent", text: body.text ?? "", name: body.name ?? null, from: body.from ?? null, status: body.status ?? "done", id: body.id ?? null })); return; }
        if (op === "stop"){ sendJson(res, 200, await liveStop(root, { id: body.id ?? null })); return; }
        sendJson(res, 200, await liveStatus(root));
        return;
      }


      if (parts[0] !== "api" || parts[1] !== "graph" || !parts[2]) {
        sendJson(res, 404, { error: "not found" });
        return;
      }
      const id = safeId(parts[2]);
      if (!id) { sendJson(res, 400, { error: "bad graph id" }); return; }
      const action = parts[3] ?? "";

      if (req.method === "GET" && action === "") {
        const { graph } = await loadGraph(root, id);
        const notesSummary = {};
        for (const node of graph.nodes) {
          if (graph.notes[node.id]) notesSummary[node.id] = graph.notes[node.id];
        }
        sendJson(res, 200, graphDetail(graph, notesSummary));
        return;
      }
      /* Node attachment: POST { nodeId, src, kind?, label?, caption?, page?, mode? } — a local file is copied into the graph asset dir automatically */
      if (action === "attach" && req.method === "POST") {
        const body = await readBody(req);
        const rawSrc = String(body.src ?? "").trim();
        if (!rawSrc) { sendJson(res, 400, { error: 'missing src' }); return; }
        const nodeId = String(body.nodeId ?? "");
        let finalSrc = rawSrc, kind = body.kind ?? "image";
        const assetsDir = join(root, "graphs", id, "assets");
        if (!/^https?:\/\//i.test(rawSrc)) {
          // local file → copy into the graph asset dir so the graph stays portable
          const abs = resolve(rawSrc.replace(/^file:\/\//, ""));
          try {
            const info = await stat(abs);
            if (!info.isFile()) throw new Error('not a file');
            await mkdir(assetsDir, { recursive: true });
            const safeName = basename(abs).replace(/[^\w.\-\u4e00-\u9fff]/g, "_");
            const target = join(assetsDir, safeName);
            await copyFile(abs, target);
            finalSrc = `assets/${safeName}`;
            if (/pdf$/i.test(safeName)) kind = "pdf";
            else if (/page|p\d{3}|book/i.test(safeName)) kind = "page";
          } catch (error) {
            sendJson(res, 400, { error: `cannot read the local file: ${error.message}` });
            return;
          }
        } else if (body.kind) kind = body.kind;
        const result = await mutateGraph(root, id, (draft) => {
          const list = setNodeAttachments(draft, nodeId, [{
            kind, src: finalSrc, label: body.label ?? basename(finalSrc), page: body.page ?? null, caption: body.caption ?? "",
          }], { mode: body.mode === "append" ? "append" : "replace" });
          return list;
        }, { bump: true });
        sendJson(res, 200, { ok: true, attachments: result?.detail?.nodes?.find((n)=> n.id === nodeId)?.attachments ?? [] });
        return;
      }
      /* Hierarchical projection: POST { kind: 'overview'|'sections', … } */
      if (action === "project" && req.method === "POST") {
        const body3 = await readBody(req);
        if (body3.kind === "overview"){
          const r = await projectOverview(root, id, { name: body3.name ?? null });
          r.graph.id = makeGraphId(r.graph.name);
          await saveGraph(graphDir(root, r.graph.id), r.graph);
          if (body3.folder){ try { await moveGraph(root, r.graph.id, body3.folder); } catch { /* filing failure is not fatal */ } }
          sendJson(res, 200, { id: r.graph.id, name: r.graph.name, sections: r.graph.nodes.length, edges: r.graph.edges.length });
          return;
        }
        const r2 = await projectSections(root, id, { minCards: body3.minCards ?? 3, only: body3.only ?? null, folder: body3.folder ?? null });
        sendJson(res, 200, r2);
        return;
      }
      /* Non-linear conversation: GET overview / POST say|branch|merge */
      if (action === "convo") {
        if (req.method === "GET") {
          const { graph } = await loadGraph(root, id);
          const g = ensureConversationShape(graph);
          const want = url.searchParams.get("view") ?? "overview";
          if (want === "next"){ sendJson(res, 200, nextSpeaker(g)); return; }
          if (want === "pending"){ sendJson(res, 200, { pending: pendingTurns(g) }); return; }
          sendJson(res, 200, { ...conversationOverview(g), pending: pendingTurns(g), agents: g.conversation.agents, runtime: g.conversation.runtime });
          return;
        }
        const body = await readBody(req);
        const op = String(body.op ?? "");
        const result = await mutateGraph(root, id, (draft) => {
          ensureConversationShape(draft);
          draft.notes = draft.notes ?? {};
          if (op === "say"){
            const node = appendTurn(draft, { text: body.text ?? "", speaker: body.speaker ?? "user", type: body.type ?? "turn", parentId: body.parentId ?? null, edgeType: body.edgeType ?? "follows" });
            draft.notes[node.id] = String(body.text ?? "").split("\n")[0].slice(0, 120);
            return node.id;
          }
          if (op === "branch"){ setHead(draft, body.nodeId); return body.nodeId; }
          if (op === "scaffold"){ return scaffoldTopology(draft, { topology: body.topology ?? "supervisor", agents: body.agents ?? [], topic: body.topic ?? null }); }
          if (op === "record"){
            const node = recordTurn(draft, { agent: body.agent ?? "agent", text: body.text ?? "", type: body.type ?? "turn", status: body.status ?? "done", handoffTo: body.handoffTo ?? null, parentId: body.parentId ?? null, edgeType: body.edgeType ?? "follows", role: body.role ?? null });
            draft.notes = draft.notes ?? {};
            draft.notes[node.id] = String(body.text ?? "").split("\n")[0].slice(0, 120);
            return { nodeId: node.id, status: node.status };
          }
          if (op === "resolve"){ const node = resolveTurn(draft, body.nodeId, { status: body.status ?? "done", text: body.text ?? null }); return { nodeId: node.id, status: node.status }; }
          if (op === "vote"){
            const r = aggregateBranches(draft, { sources: body.sources ?? [], strategy: body.strategy ?? "majority", label: body.label ?? null, text: body.text ?? "", winner: body.winner ?? null, agent: body.agent ?? "judge" });
            draft.notes = draft.notes ?? {};
            draft.notes[r.node.id] = String(r.chosen ?? "").slice(0, 120);
            return { nodeId: r.node.id, strategy: r.strategy, tally: r.tally, consensus: Number(r.consensus.toFixed(3)), chosen: r.chosen };
          }
          if (op === "merge"){
            const node = mergeBranches(draft, { sources: body.sources ?? [], label: body.label ?? 'merge', text: body.text ?? "", speaker: body.speaker ?? "user" });
            if (body.text) draft.notes[node.id] = String(body.text).split("\n")[0].slice(0, 120);
            return node.id;
          }
          throw new Error(`unsupported conversation op: ${op}`);
        });
        sendJson(res, 200, result);
        return;
      }
      /* Active path (root → node) and its linearised text */
      if (action === "convo-path" && req.method === "GET") {
        const { graph } = await loadGraph(root, id);
        const target = url.searchParams.get("node") ?? graph.conversation?.head ?? null;
        sendJson(res, 200, { target, path: target ? pathTo(graph, target) : [], text: linearize(graph, target, { format: url.searchParams.get("format") ?? "md" }) });
        return;
      }
      if (req.method === "GET" && action === "validate") {
        const { graph } = await loadGraph(root, id);
        sendJson(res, 200, validateGraph(graph));
        return;
      }
      if (req.method === "GET" && action === "analyze") {
        const { graph } = await loadGraph(root, id);
        const trace = url.searchParams.get("trace") ?? null;
        sendJson(res, 200, { ...analyzeGraph(graph.nodes, graph.edges, { trace }), groupSuggestions: suggestGroups(graph) });
        return;
      }
      if (req.method === "GET" && action === "export") {
        const { graph } = await loadGraph(root, id);
        const format = url.searchParams.get("format") ?? "mermaid";
        if (format === "json") { sendJson(res, 200, graph); return; }
        if (format === "dot") { sendJson(res, 200, { text: toDot(graph) }); return; }
        if (format === "md") { sendJson(res, 200, { text: toMarkdownOutline(graph) }); return; }
        if (format === "txt") { sendJson(res, 200, { text: toPlainText(graph) }); return; }
        sendJson(res, 200, { text: toMermaid(graph) });
        return;
      }
      if (req.method === "GET" && action === "note" && parts[4]) {
        sendJson(res, 200, await readNodeNote(root, id, parts[4]));
        return;
      }

      const body = await readBody(req);

      if (req.method === "POST" && action === "node-add") {
        const type = NODE_TYPES[body.type] || graph_nodeTypeCustom(body.type) ? String(body.type ?? "process") : "process";
        const def = nodeTypeDef({}, type);
        const suffix = Math.random().toString(36).slice(2, 6);
        const result = await mutateGraph(root, id, (draft) => {
          draft.nodes.push(normalizeGraph({ nodes: [{ id: `n-${type.slice(0, 4)}-${suffix}`, type, label: String(body.label ?? def.label), x: Number(body.x) || 200, y: Number(body.y) || 160 }] }).nodes[0]);
        });
        sendJson(res, result.ok ? 200 : 400, result);
        return;
      }
      if (req.method === "POST" && action === "node-patch") {
        const nodeId = String(body.nodeId ?? "");
        const patch = body.patch ?? {};
        const result = await mutateGraph(root, id, (draft) => {
          const node = draft.nodes.find((candidate) => candidate.id === nodeId);
          if (!node) throw new Error(`node ${nodeId} not found`);
          const allowed = ["label", "type", "note", "x", "y", "w", "h", "shape", "fill", "border", "textColor", "icon", "status", "tags"];
          for (const key of allowed) if (patch[key] !== undefined) node[key] = patch[key];
        });
        sendJson(res, result.ok ? 200 : 400, result);
        return;
      }
      if (req.method === "POST" && action === "node-delete") {
        const nodeId = String(body.nodeId ?? "");
        const result = await mutateGraph(root, id, (draft) => {
          draft.nodes = draft.nodes.filter((node) => node.id !== nodeId);
          draft.edges = draft.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
          for (const group of draft.groups) group.members = group.members.filter((member) => member !== nodeId);
          delete draft.notes[nodeId];
        });
        sendJson(res, result.ok ? 200 : 400, result);
        return;
      }
      if (req.method === "POST" && action === "edge-add") {
        const source = String(body.source ?? "");
        const target = String(body.target ?? "");
        if (source === target) { sendJson(res, 400, { ok: false, issues: ['self-loops are not allowed (source equals target)'] }); return; }
        const result = await mutateGraph(root, id, (draft) => {
          if (!draft.nodes.some((node) => node.id === source)) throw new Error(`source node ${source} not found`);
          if (!draft.nodes.some((node) => node.id === target)) throw new Error(`target node ${target} not found`);
          const type = typeof body.type === "string" ? body.type : "";
          draft.edges.push(normalizeGraph({ edges: [{ id: newId("e"), source, target, type, label: String(body.label ?? "") }] }).edges[0]);
        });
        sendJson(res, result.ok ? 200 : 400, result);
        return;
      }
      if (req.method === "POST" && action === "edge-patch") {
        const edgeId = String(body.edgeId ?? "");
        const patch = body.patch ?? {};
        const result = await mutateGraph(root, id, (draft) => {
          const edge = draft.edges.find((candidate) => candidate.id === edgeId);
          if (!edge) throw new Error(`edge ${edgeId} not found`);
          for (const key of ["label", "type", "color", "width", "style", "arrow", "curve"]) {
            if (patch[key] !== undefined) edge[key] = patch[key];
          }
        });
        sendJson(res, result.ok ? 200 : 400, result);
        return;
      }
      if (req.method === "POST" && action === "edge-delete") {
        const result = await mutateGraph(root, id, (draft) => {
          draft.edges = draft.edges.filter((edge) => edge.id !== String(body.edgeId ?? ""));
        });
        sendJson(res, result.ok ? 200 : 400, result);
        return;
      }
      if (req.method === "POST" && action === "position") {
        // Dragging only moves coordinates: no revision bump and no topology validation (same policy as agent-flow's position endpoint).
        const { graph } = await loadGraph(root, id);
        const node = graph.nodes.find((candidate) => candidate.id === String(body.nodeId ?? ""));
        if (!node) { sendJson(res, 400, { error: 'node not found' }); return; }
        const x = Number(body.x);
        const y = Number(body.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) { sendJson(res, 400, { error: 'coordinates must be finite numbers' }); return; }
        // The canvas is unbounded: any finite coordinate is allowed, including negatives, with no clamping.
        node.x = Math.round(x);
        node.y = Math.round(y);
        await saveGraph(graphDir(root, id), graph);
        sendJson(res, 200, { ok: true });
        return;
      }
      /* Batch positions: write several nodes in one load/save (multi-select drag), avoiding N concurrent read-modify-writes that overwrite each other */
      /* Attachment upload (the user just picks a file): { name, dataUrl } → stored in assets/ and src returned */
      if (action === "upload" && req.method === "POST") {
        const b = await readBody(req);
        const name = String(b.name ?? "file").replace(/[^\w.\-\u4e00-\u9fff]/g, "_");
        const m = String(b.dataUrl ?? "").match(/^data:([^;]+);base64,(.*)$/);
        if (!m) { sendJson(res, 400, { error: 'dataUrl required (data:<mime>;base64,...)' }); return; }
        const buf = Buffer.from(m[2], "base64");
        if (buf.length > 40 * 1024 * 1024) { sendJson(res, 413, { error: 'file too large (40MB limit)' }); return; }
        const assetsDir = join(root, "graphs", id, "assets");
        await mkdir(assetsDir, { recursive: true });
        const safe = `${Date.now().toString(36)}-${name}`;
        await writeFile(join(assetsDir, safe), buf);
        sendJson(res, 200, { ok: true, src: `assets/${safe}`, bytes: buf.length, mime: m[1] });
        return;
      }
      /* Whole-graph replace (undo / redo): store one complete snapshot */
      if (action === "replace" && req.method === "POST") {
        const b = await readBody(req);
        const draft = normalizeGraph({ ...b.graph, id, name: b.graph?.name ?? id });
        // guard: never let an empty graph overwrite a non-empty one (an empty undo snapshot once wiped the data)
        if (!b.force){
          try {
            const { graph: cur } = await loadGraph(root, id);
            if ((cur.nodes?.length ?? 0) > 0 && (draft.nodes?.length ?? 0) === 0){
              sendJson(res, 409, { error: 'refusing to overwrite existing content with an empty graph (pass force explicitly if you really mean to clear it)' });
              return;
            }
          } catch { /* current graph unreadable: allow */ }
        }
        const verdict = validateGraph(draft);
        if (!verdict.ok) { sendJson(res, 400, { error: `structure validation failed: ${verdict.issues.slice(0, 3).join('; ')}` }); return; }
        await saveGraph(graphDir(root, id), draft);
        broadcast();
        sendJson(res, 200, { ok: true });
        return;
      }
      /* Delete a node (for batch selection): also cleans up its edges, note and group membership */
      {
        const m = url.pathname.match(/^\/api\/graph\/([^/]+)\/node\/(.+)$/);
        if (m && req.method === "DELETE") {
          const gid = decodeURIComponent(m[1]);
          const nid = decodeURIComponent(m[2]);
          if (!gid || !nid) { sendJson(res, 400, { error: "bad request" }); return; }
          await mutateGraph(root, gid, (draft) => {
            draft.nodes = draft.nodes.filter((n)=> n.id !== nid);
            draft.edges = draft.edges.filter((e)=> e.source !== nid && e.target !== nid);
            for (const g of draft.groups) g.members = (g.members ?? []).filter((x)=> x !== nid);
            if (draft.notes) delete draft.notes[nid];
          });
          sendJson(res, 200, { ok: true, nodeId: nid });
          return;
        }
      }
      if (req.method === "POST" && action === "positions") {
        const { graph } = await loadGraph(root, id);
        const n = moveNodes(graph, body.moves ?? []);
        await saveGraph(graphDir(root, id), graph);
        sendJson(res, 200, { ok: true, moved: n });
        return;
      }
      /* Group-drag transaction: member offsets + box geometry committed together (rect is overwriting, so the old position is erased) */
      if (req.method === "POST" && action === "group-commit") {
        const { graph } = await loadGraph(root, id);
        const group = graph.groups.find((g)=> g.id === String(body.groupId ?? ""));
        if (!group) { sendJson(res, 400, { error: 'group not found' }); return; }
        const moved = moveNodes(graph, body.moves ?? []);
        let rect = null;
        if (body.rect === null){ delete group.rect; }
        else if (body.rect){ rect = setGroupRect(graph, group.id, body.rect); }
        else {
          // no rect supplied: fix it once from the committed member bounding box (this is what 'remember this position' means)
          const ms = (group.members ?? []).map((mid)=> graph.nodes.find((x)=> x.id === mid)).filter(Boolean);
          if (ms.length){
            const pad = { x: 24, top: 34, bottom: 24 };
            const minX = Math.min(...ms.map((m)=> m.x)) - pad.x;
            const minY = Math.min(...ms.map((m)=> m.y)) - pad.top;
            const maxX = Math.max(...ms.map((m)=> m.x + (m.w ?? 168))) + pad.x;
            const maxY = Math.max(...ms.map((m)=> m.y + (m.h ?? 64))) + pad.bottom;
            rect = setGroupRect(graph, group.id, { x: minX, y: minY, w: maxX - minX, h: maxY - minY });
          }
        }
        await saveGraph(graphDir(root, id), graph);
        sendJson(res, 200, { ok: true, moved, rect });
        return;
      }
      if (req.method === "POST" && action === "layout") {
        const { graph } = await loadGraph(root, id);
        const mode = String(body.mode ?? "layered");
        applyLayout(graph, mode);            // also re-fits every group box to its members
        graph.revision += 1;
        await saveGraph(graphDir(root, id), graph);
        sendJson(res, 200, { ok: true, detail: graphDetail(graph) });
        return;
      }
      if (req.method === "POST" && action === "group-add") {
        const result = await mutateGraph(root, id, (draft) => {
          const members = (Array.isArray(body.members) ? body.members : []).map(String).filter((member) => draft.nodes.some((node) => node.id === member));
          if (members.length === 0) throw new Error('a group needs at least one existing member node');
          draft.groups.push({ id: newId("g"), label: String(body.label ?? 'Group'), color: typeof body.color === "string" ? body.color : "#64748B", members });
        });
        sendJson(res, result.ok ? 200 : 400, result);
        return;
      }
      if (req.method === "POST" && action === "group-delete") {
        const result = await mutateGraph(root, id, (draft) => {
          draft.groups = draft.groups.filter((group) => group.id !== String(body.groupId ?? ""));
        });
        sendJson(res, result.ok ? 200 : 400, result);
        return;
      }
      if (req.method === "POST" && action === "note") {
        const nodeId = String(body.nodeId ?? "");
        const { graph } = await loadGraph(root, id);
        if (!graph.nodes.some((node) => node.id === nodeId)) { sendJson(res, 400, { error: 'node not found' }); return; }
        await writeNodeNote(root, id, nodeId, String(body.content ?? ""));
        graph.notes[nodeId] = String(body.content ?? "").split("\n")[0].slice(0, 120);
        await saveGraph(graphDir(root, id), graph);
        sendJson(res, 200, { ok: true });
        return;
      }
      if (req.method === "POST" && action === "meta") {
        const result = await mutateGraph(root, id, (draft) => {
          if (typeof body.name === "string" && body.name.trim()) draft.name = body.name.trim();
          if (typeof body.description === "string") draft.description = body.description;
          if (body.direction === "TD" || body.direction === "LR") draft.direction = body.direction;
        });
        sendJson(res, result.ok ? 200 : 400, result);
        return;
      }
      if (req.method === "POST" && action === "node-type-patch") {
        const result = await mutateGraph(root, id, (draft) => {
          const key = String(body.type ?? "").trim();
          if (!key) throw new Error('missing type');
          const prev = draft.nodeTypes[key] ?? {};
          draft.nodeTypes[key] = {
            label: String(body.label ?? prev.label ?? key),
            labelEn: String(body.labelEn ?? prev.labelEn ?? body.label ?? key),
            shape: ["rect", "rounded", "pill", "diamond", "ellipse", "hexagon", "parallelogram", "document"].includes(body.shape) ? body.shape : (prev.shape ?? "rounded"),
            fill: typeof body.fill === "string" ? body.fill : (prev.fill ?? "#6B7280"),
            border: typeof body.border === "string" ? body.border : (prev.border ?? "#4B5563"),
            textColor: typeof body.textColor === "string" ? body.textColor : (prev.textColor ?? "#0F172A"),
            icon: String(body.icon ?? prev.icon ?? "◆")
          };
        });
        sendJson(res, result.ok ? 200 : 400, result);
        return;
      }
      if (req.method === "POST" && action === "edge-type-patch") {
        const result = await mutateGraph(root, id, (draft) => {
          const key = String(body.type ?? "").trim();
          if (!key) throw new Error('missing type');
          const prev = draft.edgeTypes[key] ?? {};
          draft.edgeTypes[key] = {
            label: String(body.label ?? prev.label ?? key),
            labelEn: String(body.labelEn ?? prev.labelEn ?? body.label ?? key),
            color: typeof body.color === "string" ? body.color : (prev.color ?? "#64748B"),
            style: ["solid", "dashed", "dotted"].includes(body.style) ? body.style : (prev.style ?? "solid")
          };
        });
        sendJson(res, result.ok ? 200 : 400, result);
        return;
      }
      if (req.method === "GET" && action === "trash") {
        const trashDir = join(root, "trash");
        let entries = [];
        try { entries = await readdirSafe(trashDir); } catch { entries = []; }
        const out = [];
        for (const entry of entries) {
          try {
            const raw = await readJsonIfPresent(join(trashDir, entry, "graph.json"));
            if (raw) out.push({ trashName: entry, id: raw.id, name: raw.name, nodes: (raw.nodes ?? []).length });
          } catch { /* skip */ }
        }
        sendJson(res, 200, out);
        return;
      }
      if (req.method === "POST" && action === "trash-restore") {
        const entry = String(body.trashName ?? "").replace(/[/\\]/g, "");
        const raw = await readJsonIfPresent(join(root, "trash", entry, "graph.json"));
        if (!raw) { sendJson(res, 404, { error: 'no such entry in the trash' }); return; }
        const { rename } = await import("node:fs/promises");
        await rename(join(root, "trash", entry), join(root, "graphs", raw.id));
        sendJson(res, 200, { ok: true, id: raw.id });
        return;
      }
      if (req.method === "POST" && action === "graph-delete") {
        const trashDir = await deleteGraph(root, id);
        sendJson(res, 200, { ok: true, archivedTo: trashDir });
        return;
      }

      sendJson(res, 404, { error: "not found" });
    } catch (error) {
      // Prefer the error code (NOT_FOUND → 404; CORRUPT → 500); otherwise fall back to matching the message.
      const message = String(error?.message ?? error);
      const status = error?.code === "NOT_FOUND" ? 404
        : error?.code === "CORRUPT" ? 500
        : message.includes('not found (') ? 404
        : 400;
      sendJson(res, status, { error: message, issues: error?.issues, code: error?.code ?? null });
    }
  });

  await new Promise((resolveListen, rejectListen) => {
    const onError = (error) => { server.off("listening", onListening); rejectListen(error); };
    const onListening = () => { server.off("error", onError); resolveListen(); };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });

  // Polling change broadcast (cross-platform): the disk is only scanned when SSE subscribers exist (mtime signature compare),
  // and with no listeners there is zero disk I/O — no background resident reads, no performance cost.
  const watcher = setInterval(async () => {
    try {
      if (clients.size === 0) return;
      const signature = await watchSignature(root);
      if (signature === lastSignature) return;
      lastSignature = signature;
      for (const client of clients) client.write("event: change\ndata: {}\n\n");
    } catch { /* retry silently */ }
  }, 1200);
  const heartbeat = setInterval(() => {
    if (clients.size === 0) return;
    for (const client of clients) client.write(": ping\n\n");
  }, 15000);

  return {
    server, root, host,
    port: server.address().port,
    async stop() {
      clearInterval(watcher);
      clearInterval(heartbeat);
      for (const client of clients) client.end();
      clients.clear();
      await new Promise((resolveClose) => server.close(resolveClose));
    }
  };
}

function graph_nodeTypeCustom(type) {
  return typeof type === "string" && type.length > 0;
}

export function openInBrowser(url, appMode = false) {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url]
    : process.platform === "darwin" && appMode ? ["-na", "Google Chrome", "--args", "--app", url] : [url];
  const child = spawn(command, args, { stdio: "ignore", detached: true });
  child.unref();
}
