// OmniFlow MCP server — the standard interface layer: JSON-RPC 2.0 (Model Context Protocol) over stdio.
// Exposes every OmniFlow operation; any MCP-capable agent (Claude Code / Codex / WorkBuddy / …)
// can mount it directly. Zero dependencies; stdout carries protocol messages only.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { normalizeGraph, validateGraph, NODE_TYPES, EDGE_TYPES, newId } from "./graph-core.js";
import { computeLayout, applyLayout, analyzeGraph } from "./graph-analysis.js";
import { searchGraphs } from "./search.mjs";
import { suggestGroups } from "./group-suggest.js";
import { loadGraph, saveGraph, listGraphs, deleteGraph, readNodeNote, writeNodeNote, makeGraphId, mutateGraph as mutateGraphAt, rootHome, graphDir } from "./graph-service.mjs";
import { buildTemplateById, mergedTemplateSummaries, saveCustomTemplate, deleteCustomTemplate } from "./templates.js";
import { readTree, createFolder, moveGraph } from "./vault.js";
import { toMermaid, fromMermaid, toDot, toMarkdownOutline, toPlainText, fromAgentFlow } from "./converters.js";
import { buildGraphFromMineru, buildGraphFromMarkdown } from "./import-doc.js";
import { extractPythonData, buildGraphFromCards, buildOverviewFromFlow } from "./import-cards.js";
import { liveStart, liveLog, liveStop, liveStatus } from "./live-conversation.js";
import { addCrosslink, removeCrosslink, crosslinksForGraph, parseCrosslinkTable, assertLinkTargets } from "./crosslinks.js";
import { projectOverview, projectSections } from "./project.js";
import { ensureConversationShape, appendTurn, setHead, mergeBranches, pathTo, conversationOverview, linearize, recordTurn, resolveTurn, pendingTurns, nextSpeaker, aggregateBranches, scaffoldTopology, turnMeta } from "./conversation.js";

const PROTOCOL_VERSION = "2025-06-18";

/** MCP tools address a graph by id only; the storage root comes from OF_HOME (see graph-service). */
const mutateGraph = (id, mutator, opts = {}) => mutateGraphAt(rootHome(), id, mutator, opts);

const patchNodeSchema = {
  type: "object",
  properties: {
    label: { type: "string" }, type: { type: "string" }, note: { type: "string" },
    x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" },
    shape: { type: "string", enum: ["rect", "rounded", "pill", "diamond", "ellipse", "hexagon", "parallelogram", "document"] },
    fill: { type: "string", description: "Hex color, e.g. #7C3AED" },
    border: { type: "string" }, textColor: { type: "string" },
    icon: { type: "string", description: "Any short icon character, e.g. ∎ 📄" },
    status: { type: "string", enum: ["todo", "doing", "done", "blocked", ""] },
    tags: { type: "array", items: { type: "string" } }
  }
};
const patchEdgeSchema = {
  type: "object",
  properties: {
    label: { type: "string", description: "Arrow label, e.g. 'depends on', 'answers', 'A'" },
    type: { type: "string", description: "Edge type id; see of_edge_types" },
    color: { type: "string" },
    width: { type: "number", enum: [1, 2, 3, 4, 6] },
    style: { type: "string", enum: ["solid", "dashed", "dotted"] },
    arrow: { type: "string", enum: ["one", "both", "none"] },
    curve: { type: "string", enum: ["bezier", "ortho", "straight"] }
  }
};

/** Full tool set: every Studio HTTP endpoint has a matching MCP tool. */
const TOOLS = [
  { name: "of_list_graphs", description: "List all graphs (node/edge counts, validation state, update time)", inputSchema: { type: "object", properties: {} },
    run: async () => listGraphs(rootHome()) },
  { name: "of_node_types", description: "List all built-in node types with their default color/shape/icon", inputSchema: { type: "object", properties: {} },
    run: async () => NODE_TYPES },
  { name: "of_edge_types", description: "List all built-in edge types (dependency / citation / RACI …) with their default color and line style", inputSchema: { type: "object", properties: {} },
    run: async () => EDGE_TYPES },
  { name: "of_templates", description: "List all templates (built-in + agent-created); the picker text follows the language", inputSchema: { type: "object", properties: { lang: { type: "string", enum: ["zh", "en"] } } },
    run: async (args) => mergedTemplateSummaries(rootHome(), args.lang === "en" ? "en" : "zh") },
  { name: "of_save_template", description: "Distil an existing graph into a reusable custom template (later referenced by of_create_graph via templateId), or create one from inline nodes/edges", inputSchema: { type: "object", required: ["name"], properties: { fromGraph: { type: "string", description: "Snapshot this graph as a template" }, templateId: { type: "string", description: "Template id (2-48 chars: letters/digits/-/_); auto-generated when omitted" }, name: { type: "string" }, nameEn: { type: "string" }, desc: { type: "string" }, descEn: { type: "string" }, nodes: { type: "array", description: "Inline nodes (mutually exclusive with fromGraph)" }, edges: { type: "array" }, groups: { type: "array" }, direction: { type: "string", enum: ["TD", "LR"] } } },
    run: async (args) => {
      const root = rootHome();
      let def = { ...args };
      if (args.fromGraph) {
        const { graph } = await loadGraph(root, args.fromGraph);
        Object.assign(def, { nodes: graph.nodes, edges: graph.edges, groups: graph.groups, direction: graph.direction });
        if (!args.templateId) def.templateId = String(graph.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || newId("tpl");
      }
      if (!def.templateId) def.templateId = newId("tpl");
      const saved = await saveCustomTemplate(root, def);
      return { ...saved, templatePath: join(root, "templates", `${saved.id}.json`) };
    } },
  { name: "of_delete_template", description: "Delete a custom template (built-ins cannot be deleted)", inputSchema: { type: "object", required: ["templateId"], properties: { templateId: { type: "string" } } },
    run: async (args) => deleteCustomTemplate(rootHome(), args.templateId) },
  { name: "of_search", description: "Global search across graph titles, node labels, tags and full note text. Returns results[] (graphId/graphName/nodeId/nodeLabel/snippet/where); nodeId plugs straight into of_get_note / of_patch_node", inputSchema: { type: "object", required: ["q"], properties: { q: { type: "string", description: "Keyword (case-insensitive substring match)" } } },
    run: async (args) => ({ results: await searchGraphs(rootHome(), args.q) }) },
  { name: "of_tree", description: "Read the Obsidian-style folder tree: folders = all folder paths; assign = graph → folder (graphs not listed live at the root)", inputSchema: { type: "object", properties: {} },
    run: async () => readTree(rootHome()) },
  { name: "of_create_folder", description: "Create folder (a/b auto-creates ancestor levels)", inputSchema: { type: "object", required: ["path"], properties: { path: { type: "string", description: "Folder path, e.g. Math/paper-notes" } } },
    run: async (args) => createFolder(rootHome(), args.path) },
  { name: "of_move_graph", description: "Move a graph into a folder (pass \"\" to move it back to the root; a missing folder is created automatically)", inputSchema: { type: "object", required: ["graphId", "folder"], properties: { graphId: { type: "string" }, folder: { type: "string" } } },
    run: async (args) => moveGraph(rootHome(), args.graphId, args.folder) },
  { name: "of_create_graph", description: "Create a graph from a template. Language rule: English by default; pass lang=zh when the user writes Chinese, or when the source document is Chinese. folder archives it into a folder (hierarchy created automatically). The return value contains the full storage location and the agent must relay it faithfully.", inputSchema: { type: "object", required: ["name"], properties: { name: { type: "string" }, template: { type: "string", description: "Template id; default blank" }, description: { type: "string" }, folder: { type: "string", description: "Archive folder path (a/b may nest); defaults to the root" }, lang: { type: "string", enum: ["zh", "en"], description: "Content language: Chinese user → zh; English or unknown → en (default en)" } } },
    run: async (args) => {
      const root = rootHome();
      const graph = await buildTemplateById(root, args.template ?? "blank", args.name, args.lang === "zh" ? "zh" : "en");
      graph.id = makeGraphId(graph.name);
      if (args.description) graph.description = String(args.description);
      await saveGraph(graphDir(root, graph.id), graph);
      let folder = null;
      if (typeof args.folder === "string" && args.folder.trim()) {
        const archived = await createFolder(root, args.folder);
        await moveGraph(root, graph.id, archived.folder);
        folder = archived.folder;
      }
      return {
        ok: true, id: graph.id, name: graph.name, folder, template: args.template ?? "blank",
        nodes: graph.nodes.length, edges: graph.edges.length, groups: (graph.groups ?? []).length,
        storage: { root, graph: join(root, "graphs", graph.id, "graph.json"), notesDir: join(root, "graphs", graph.id, "notes") }
      };
    } },
  { name: "of_get_graph", description: "Read one graph in full (nodes/edges/groups/type registries/validation state). This is the server-side view of graph.json, the single source of truth for topology", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    run: async (args) => {
      const { graph } = await loadGraph(rootHome(), args.id);
      return { ...graph, validation: validateGraph(graph) };
    } },
  { name: "of_validate", description: "Structure validation: hard errors (duplicate ids / dangling edges) block; cycles, orphan nodes and self-loops are warnings (they can be legitimate in a universal map)", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    run: async (args) => { const { graph } = await loadGraph(rootHome(), args.id); return validateGraph(graph); } },
  { name: "of_analyze", description: "Graph analysis: cycle detection, degree-centrality bottleneck ranking (RACI single point of failure), orphan nodes, and optionally the up/downstream dependency closure of one node. Results carry groupSuggestions (four suggested groups); add them one by one with of_add_group to complete a compliant grouping", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" }, trace: { type: "string", description: "Optional: node id whose dependencies to trace" } } },
    run: async (args) => { const { graph } = await loadGraph(rootHome(), args.id); return { ...analyzeGraph(graph.nodes, graph.edges, { trace: args.trace ?? null }), groupSuggestions: suggestGroups(graph) }; } },
  { name: "of_add_node", description: "Add a node (full styling optional: type/shape/fill/border/textColor/icon/status)", inputSchema: { type: "object", required: ["id", "label"], properties: { id: { type: "string", description: "Graph id" }, label: { type: "string" }, type: { type: "string" }, x: { type: "number" }, y: { type: "number" }, fill: { type: "string" }, border: { type: "string" }, textColor: { type: "string" }, shape: { type: "string" }, icon: { type: "string" }, status: { type: "string" }, note: { type: "string" } } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      draft.nodes.push(normalizeGraph({ nodes: [{ id: `n-${Math.random().toString(36).slice(2, 7)}`, type: args.type ?? "process", label: args.label, x: args.x, y: args.y, fill: args.fill, border: args.border, textColor: args.textColor, shape: args.shape, icon: args.icon, status: args.status, note: args.note }] }).nodes[0]);
    }) },
  { name: "of_patch_node", description: "Patch any node property (label/type/shape/colors/icon/status/position/size) — the full-customization entry point", inputSchema: { type: "object", required: ["id", "nodeId", "patch"], properties: { id: { type: "string" }, nodeId: { type: "string" }, patch: patchNodeSchema } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      const node = draft.nodes.find((candidate) => candidate.id === args.nodeId);
      if (!node) throw new Error(`node ${args.nodeId} not found`);
      const allowed = ["label", "type", "note", "x", "y", "w", "h", "shape", "fill", "border", "textColor", "icon", "status", "tags"];
      for (const key of allowed) if (args.patch?.[key] !== undefined) node[key] = args.patch[key];
    }) },
  { name: "of_move_node", description: "Move a node's coordinates (does not bump the revision; same semantics as dragging on the canvas)", inputSchema: { type: "object", required: ["id", "nodeId", "x", "y"], properties: { id: { type: "string" }, nodeId: { type: "string" }, x: { type: "number" }, y: { type: "number" } } },
    run: async (args) => {
      const root = rootHome();
      const { graph } = await loadGraph(root, args.id);
      const node = graph.nodes.find((candidate) => candidate.id === args.nodeId);
      if (!node) throw new Error(`node ${args.nodeId} not found`);
      node.x = Math.round(args.x); node.y = Math.round(args.y); // the canvas is unbounded, so negative coordinates are allowed
      await saveGraph(graphDir(root, args.id), graph);
      return { ok: true };
    } },
  { name: "of_delete_node", description: "Delete a node together with all of its edges", inputSchema: { type: "object", required: ["id", "nodeId"], properties: { id: { type: "string" }, nodeId: { type: "string" } } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      draft.nodes = draft.nodes.filter((node) => node.id !== args.nodeId);
      draft.edges = draft.edges.filter((edge) => edge.source !== args.nodeId && edge.target !== args.nodeId);
      for (const group of draft.groups) group.members = group.members.filter((member) => member !== args.nodeId);
      delete draft.notes[args.nodeId];
    }) },
  { name: "of_add_edge", description: "Add an edge. Direction iron rule: source = the origin (earlier in time, earlier in logic, provider, superior); target = the result (derived, receiver, subordinate) — always origin → result. Self-loops and dangling references are rejected.", inputSchema: { type: "object", required: ["id", "source", "target"], properties: { id: { type: "string", description: "Graph id" }, source: { type: "string" }, target: { type: "string" }, type: { type: "string", description: "Edge type id, e.g. depends-on / cites / raci-a; an empty string means a generic association" }, label: { type: "string", description: "Arrow label" } } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      if (args.source === args.target) throw new Error("Self-loops are not allowed");
      if (!draft.nodes.some((node) => node.id === args.source)) throw new Error(`source node ${args.source} not found`);
      if (!draft.nodes.some((node) => node.id === args.target)) throw new Error(`target node ${args.target} not found`);
      draft.edges.push(normalizeGraph({ edges: [{ id: `e-${Math.random().toString(36).slice(2, 8)}`, source: args.source, target: args.target, type: args.type ?? "", label: args.label ?? "" }] }).edges[0]);
    }) },
  { name: "of_patch_edge", description: "Patch any edge property (label/type/color/width/style/arrow/curve)", inputSchema: { type: "object", required: ["id", "edgeId", "patch"], properties: { id: { type: "string" }, edgeId: { type: "string" }, patch: patchEdgeSchema } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      const edge = draft.edges.find((candidate) => candidate.id === args.edgeId);
      if (!edge) throw new Error(`edge ${args.edgeId} not found`);
      for (const key of ["label", "type", "color", "width", "style", "arrow", "curve"]) {
        if (args.patch?.[key] !== undefined) edge[key] = args.patch[key];
      }
    }) },
  { name: "of_delete_edge", description: "Delete an edge", inputSchema: { type: "object", required: ["id", "edgeId"], properties: { id: { type: "string" }, edgeId: { type: "string" } } },
    run: async (args) => mutateGraph(args.id, (draft) => { draft.edges = draft.edges.filter((edge) => edge.id !== args.edgeId); }) },
  { name: "of_layout", description: "Auto layout: mode=layered by dependency (default) / clusters by group / force force-directed (overall structure) / grid compact grid (ordered by type)", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" }, mode: { type: "string", enum: ["layered", "clusters", "force", "grid"] } } },
    // Goes through the shared write pipeline (formula gate + validation), not a raw save.
    run: async (args) => mutateGraph(args.id, (draft) => { applyLayout(draft, args.mode); }) },
  { name: "of_add_group", description: "Create a group (a colored subgraph container, e.g. a department or chapter box)", inputSchema: { type: "object", required: ["id", "label", "members"], properties: { id: { type: "string" }, label: { type: "string" }, members: { type: "array", items: { type: "string" } }, color: { type: "string" } } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      const members = (args.members ?? []).map(String).filter((member) => draft.nodes.some((node) => node.id === member));
      if (!members.length) throw new Error("A group needs at least one existing member node");
      draft.groups.push({ id: `g-${Math.random().toString(36).slice(2, 7)}`, label: String(args.label), color: args.color ?? "#64748B", members });
    }) },
  { name: "of_delete_group", description: "Delete a group (member nodes are unaffected)", inputSchema: { type: "object", required: ["id", "groupId"], properties: { id: { type: "string" }, groupId: { type: "string" } } },
    run: async (args) => mutateGraph(args.id, (draft) => { draft.groups = draft.groups.filter((group) => group.id !== args.groupId); }) },
  { name: "of_set_note", description: "Write the node's long Markdown note (stored in graphs/<id>/notes/<nodeId>.md; the first line becomes the card summary in graph.json)", inputSchema: { type: "object", required: ["id", "nodeId", "content"], properties: { id: { type: "string" }, nodeId: { type: "string" }, content: { type: "string" } } },
    run: async (args) => {
      const root = rootHome();
      const { graph } = await loadGraph(root, args.id);
      if (!graph.nodes.some((node) => node.id === args.nodeId)) throw new Error(`node ${args.nodeId} not found`);
      await writeNodeNote(root, args.id, args.nodeId, String(args.content ?? ""));
      graph.notes[args.nodeId] = String(args.content ?? "").split("\n")[0].slice(0, 120);
      await saveGraph(graphDir(root, args.id), graph);
      return { ok: true };
    } },
  { name: "of_get_note", description: "Read the node's long Markdown note", inputSchema: { type: "object", required: ["id", "nodeId"], properties: { id: { type: "string" }, nodeId: { type: "string" } } },
    run: async (args) => readNodeNote(rootHome(), args.id, args.nodeId) },
  { name: "of_export", description: "Export the graph: mermaid / dot (Graphviz) / md (Markdown outline) / txt (plain-text outline for sharing) / json / html (standalone offline interactive canvas, one double-clickable file)", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" }, format: { type: "string", enum: ["mermaid", "dot", "md", "json"] } } },
    run: async (args) => {
      const { graph } = await loadGraph(rootHome(), args.id);
      const format = args.format ?? "mermaid";
      const text = format === "json" ? JSON.stringify(graph, null, 2)
        : format === "dot" ? toDot(graph)
        : format === "md" ? toMarkdownOutline(graph)
        : format === "txt" ? toPlainText(graph)
        : toMermaid(graph);
      return { format, text };
    } },
  { name: "of_import_mermaid", description: "Import Mermaid flowchart text as a new graph (first choice for bulk creation)", inputSchema: { type: "object", required: ["text"], properties: { text: { type: "string" }, name: { type: "string" } } },
    run: async (args) => {
      const graph = fromMermaid(String(args.text ?? ""));
      if (args.name) graph.name = String(args.name);
      const verdict = validateGraph(graph);
      if (!verdict.ok) throw new Error(`Imported content failed validation: ${verdict.issues.join("；")}`);
      graph.id = makeGraphId(graph.name);
      await saveGraph(graphDir(rootHome(), graph.id), graph);
      return { ok: true, id: graph.id, nodes: graph.nodes.length, edges: graph.edges.length };
    } },
  { name: "of_import_json", description: "Import an OmniFlow graph JSON object as a new graph", inputSchema: { type: "object", required: ["data"], properties: { data: { type: "object" }, name: { type: "string" } } },
    run: async (args) => {
      const graph = normalizeGraph(args.data);
      if (args.name) graph.name = String(args.name);
      const verdict = validateGraph(graph);
      if (!verdict.ok) throw new Error(`Imported content failed validation: ${verdict.issues.join("；")}`);
      graph.id = makeGraphId(graph.name);
      await saveGraph(graphDir(rootHome(), graph.id), graph);
      return { ok: true, id: graph.id };
    } },
  { name: "of_import_agentflow", description: "Convert an agent-flow (af) workflow into a graph: gate branches become yes/no labelled edges", inputSchema: { type: "object", required: ["afId"], properties: { afId: { type: "string", description: "agent-flow workflow id" } } },
    run: async (args) => {
      const { readFile } = await import("node:fs/promises");
      const afHome = resolve(process.env.AF_HOME ?? join(homedir(), ".agent-flow"));
      const raw = await readFile(join(afHome, "flows", String(args.afId).replace(/[/\\]/g, ""), "flow.json"), "utf8");
      const graph = await fromAgentFlow(JSON.parse(raw));
      graph.id = makeGraphId(graph.name);
      await saveGraph(graphDir(rootHome(), graph.id), graph);
      return { ok: true, id: graph.id, nodes: graph.nodes.length, edges: graph.edges.length };
    } },
  { name: "of_delete_graph", description: "Delete a graph (moved into ~/.omni-flow/trash/; recoverable)", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    run: async (args) => ({ ok: true, archivedTo: await deleteGraph(rootHome(), args.id) }) },
  { name: "of_patch_node_type", description: "Customize or add a node type for this graph (color/shape/icon/label; written into the graph's nodeTypes registry; built-ins may be overridden)", inputSchema: { type: "object", required: ["id", "type"], properties: { id: { type: "string", description: "Graph id" }, type: { type: "string", description: "Type key, e.g. drone / my-theorem" }, label: { type: "string" }, labelEn: { type: "string" }, shape: { type: "string", enum: ["rect", "rounded", "pill", "diamond", "ellipse", "hexagon", "parallelogram", "document"] }, fill: { type: "string" }, border: { type: "string" }, textColor: { type: "string" }, icon: { type: "string" } } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      const prev = draft.nodeTypes[args.type] ?? {};
      draft.nodeTypes[args.type] = {
        label: String(args.label ?? prev.label ?? args.type),
        labelEn: String(args.labelEn ?? prev.labelEn ?? args.label ?? args.type),
        shape: args.shape ?? prev.shape ?? "rounded",
        fill: args.fill ?? prev.fill ?? "#6B7280",
        border: args.border ?? prev.border ?? "#4B5563",
        textColor: args.textColor ?? prev.textColor ?? "#0F172A",
        icon: String(args.icon ?? prev.icon ?? "◆")
      };
    }) },
  { name: "of_patch_edge_type", description: "Customize or add an edge type for this graph (name/color/line style; written into the edgeTypes registry)", inputSchema: { type: "object", required: ["id", "type"], properties: { id: { type: "string", description: "Graph id" }, type: { type: "string", description: "Type key, e.g. attacks / funds" }, label: { type: "string" }, labelEn: { type: "string" }, color: { type: "string" }, style: { type: "string", enum: ["solid", "dashed", "dotted"] } } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      const prev = draft.edgeTypes[args.type] ?? {};
      draft.edgeTypes[args.type] = {
        label: String(args.label ?? prev.label ?? args.type),
        labelEn: String(args.labelEn ?? prev.labelEn ?? args.label ?? args.type),
        color: args.color ?? prev.color ?? "#64748B",
        style: args.style ?? prev.style ?? "solid"
      };
    }) },
  { name: "of_patch_graph_meta", description: "Edit graph name / description / direction", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, direction: { type: "string", enum: ["TD", "LR"] } } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      if (args.name) draft.name = String(args.name).trim();
      if (args.description !== undefined) draft.description = String(args.description);
      if (args.direction === "TD" || args.direction === "LR") draft.direction = args.direction;
    }) },
  { name: "of_start_studio", description: "Launch the visual Studio canvas (runs in the background and returns a URL; default 127.0.0.1:4319)", inputSchema: { type: "object", properties: { port: { type: "number" }, open: { type: "boolean", description: "Whether to open a browser; default false" } } },
    run: async (args) => {
      const { spawn } = await import("node:child_process");
      const ofBin = join(rootHome(), "bin", "of.mjs");
      const port = String(args.port ?? 4319);
      const child = spawn(process.execPath, [ofBin, "studio", "--port", port, ...(args.open ? [] : ["--no-open"])], { detached: true, stdio: "ignore" });
      child.unref();
      await new Promise((r) => setTimeout(r, 800));
      return { ok: true, url: `http://127.0.0.1:${port}` };
    } },
  { name: "of_list_trash", description: "List deleted graphs in the trash (recoverable)", inputSchema: { type: "object", properties: {} },
    run: async () => {
      const { readdir } = await import("node:fs/promises");
      const trashDir = join(rootHome(), "trash");
      let entries = [];
      try { entries = await readdir(trashDir, { withFileTypes: true }); } catch { return []; }
      const out = [];
      for (const entry of entries.filter((item) => item.isDirectory())) {
        try {
          const raw = JSON.parse(await readFile(join(trashDir, entry.name, "graph.json"), "utf8"));
          out.push({ trashName: entry.name, id: raw.id, name: raw.name, nodes: (raw.nodes ?? []).length });
        } catch { /* skip a broken directory */ }
      }
      return out;
    } },
  { name: "of_restore_graph", description: "Restore a graph from the trash", inputSchema: { type: "object", required: ["trashName"], properties: { trashName: { type: "string", description: "The trashName returned by of_list_trash" } } },
    run: async (args) => {
      const { readdir, rename } = await import("node:fs/promises");
      const trashDir = join(rootHome(), "trash");
      const entry = String(args.trashName ?? "").replace(/[/\\]/g, "");
      const src = join(trashDir, entry);
      const raw = JSON.parse(await readFile(join(src, "graph.json"), "utf8"));
      const target = join(rootHome(), "graphs", raw.id);
      await rename(src, target);
      return { ok: true, id: raw.id };
    } },
  /* ---------- Non-linear conversation (DAG sessions: branch / merge / active path) ---------- */
  { name: "of_convo_new", description: "Create a non-linear conversation graph (a DAG session). Returns the id and the storage location. Then use of_convo_say to append turns, of_convo_branch to jump branches and of_convo_merge to converge.", inputSchema: { type: "object", required: ["topic"], properties: { topic: { type: "string", description: "Conversation topic (becomes the root node)" }, folder: { type: "string", description: "Archive folder; defaults to the root" }, lang: { type: "string", enum: ["zh", "en"] } } },
    run: async (args) => {
      const root = rootHome();
      const graph = ensureConversationShape(await buildTemplateById(root, "blank", args.topic, args.lang === "zh" ? "zh" : "en"), { topic: args.topic });
      graph.id = makeGraphId(graph.name);
      const topicNode = appendTurn(graph, { text: args.topic, speaker: "system", type: "topic" });
      graph.conversation.topic = args.topic;
      const verdict = validateGraph(graph);
      if (!verdict.ok) throw new Error(`Structure validation failed: ${verdict.issues.join("；")}`);
      await saveGraph(graphDir(root, graph.id), graph);
      if (args.folder) { try { await moveGraph(root, graph.id, args.folder); } catch { /* filing failure is not fatal */ } }
      return { id: graph.id, name: graph.name, rootNode: topicNode.id, storage: { graph: join(root, "graphs", graph.id, "graph.json") }, folder: args.folder ?? "" };
    } },
  { name: "of_convo_say", description: "Append one turn to the conversation (by default after the current head; pass parentId to fork from that node). head moves to the new turn automatically.", inputSchema: { type: "object", required: ["id", "text"], properties: { id: { type: "string" }, text: { type: "string" }, speaker: { type: "string", description: "Speaker (default user)" }, type: { type: "string", enum: ["turn", "question", "answer", "idea", "decision"], description: "Turn type" }, parentId: { type: "string", description: "Continue from this node (= fork); defaults to head" }, edgeType: { type: "string", enum: ["follows", "answers", "challenges", "refines"], description: "Relation semantics" } } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      ensureConversationShape(draft);
      const node = appendTurn(draft, { text: args.text, speaker: args.speaker ?? "user", type: args.type ?? "turn", parentId: args.parentId ?? null, edgeType: args.edgeType ?? "follows" });
      const notes = draft.notes ?? {};
      notes[node.id] = String(args.text ?? "").split("\n")[0].slice(0, 120);
      draft.notes = notes;
      draft.__convoNode = node.id;
      return node.id;
    }) },
  { name: "of_convo_branch", description: "Move head to any existing node — the next of_convo_say forks from there (non-linear rewind)", inputSchema: { type: "object", required: ["id", "nodeId"], properties: { id: { type: "string" }, nodeId: { type: "string" } } },
    run: async (args) => mutateGraph(args.id, (draft) => { ensureConversationShape(draft); setHead(draft, args.nodeId); }) },
  { name: "of_convo_merge", description: "Converge several branches: a new merge node is created and every branch flows in along a merges edge; head moves to the merge point", inputSchema: { type: "object", required: ["id", "sources"], properties: { id: { type: "string" }, sources: { type: "array", items: { type: "string" }, description: "Tip node ids of the branches to converge (at least 2)" }, label: { type: "string" }, text: { type: "string", description: "Full text of the merged conclusion (written into the note)" }, speaker: { type: "string" } } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      ensureConversationShape(draft);
      const node = mergeBranches(draft, { sources: args.sources ?? [], label: args.label ?? "merge", text: args.text ?? "", speaker: args.speaker ?? "user" });
      if (args.text) { draft.notes = draft.notes ?? {}; draft.notes[node.id] = String(args.text).split("\n")[0].slice(0, 120); }
    }) },
  { name: "of_convo_path", description: "The active path to a node (default head): every turn from the root to that node (= the linear history that should enter the context)", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" }, nodeId: { type: "string" } } },
    run: async (args) => {
      const { graph } = await loadGraph(rootHome(), args.id);
      const target = args.nodeId ?? graph.conversation?.head ?? null;
      if (!target) return { path: [], text: "" };
      const path = pathTo(graph, target);
      return {
        head: graph.conversation?.head ?? null,
        target,
        path,
        turns: path.map((id)=> { const n = graph.nodes.find((x)=> x.id === id); const sp = (n?.tags ?? []).map(String).find((t)=> t.startsWith("speaker:")); return { id, type: n?.type, speaker: sp ? sp.slice(8) : null, label: n?.label }; }),
        text: linearize(graph, target, { format: "txt" }),
      };
    } },
  { name: "of_convo_open", description: "Conversation overview: head position, open threads (leaves that can continue), forks, deepest path, speakers", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    run: async (args) => {
      const { graph } = await loadGraph(rootHome(), args.id);
      return conversationOverview(ensureConversationShape(graph));
    } },
  { name: "of_convo_linearize", description: "Linearise one path for export (indented md / plain txt transcript), to share or feed to another model", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" }, nodeId: { type: "string" }, format: { type: "string", enum: ["md", "txt"] } } },
    run: async (args) => {
      const { graph } = await loadGraph(rootHome(), args.id);
      return { format: args.format ?? "md", text: linearize(graph, args.nodeId ?? null, { format: args.format ?? "md" }) };
    } },
  /* ---------- Multi-agent non-linear conversation ---------- */
  { name: "of_convo_scaffold", description: "Generate a topology scaffold for a multi-agent session: register agents and open one parallel branch per worker (initially pending). topology=supervisor|hierarchical|debate|map-reduce|network. Then use of_agent_next for scheduling, of_agent_record to record outcomes and of_convo_vote to aggregate.", inputSchema: { type: "object", required: ["id", "agents"], properties: { id: { type: "string" }, topology: { type: "string", enum: ["supervisor", "hierarchical", "debate", "map-reduce", "network", "custom"] }, agents: { type: "array", description: "[{ name, role, model?, goal?, tools? }]", items: { type: "object" } }, topic: { type: "string" }, maxTurns: { type: "number" } } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      ensureConversationShape(draft);
      const created = scaffoldTopology(draft, { topology: args.topology ?? "supervisor", agents: args.agents ?? [], topic: args.topic ?? null, maxTurns: args.maxTurns ?? 24 });
      return created;
    }) },
  { name: "of_agent_next", description: "Scheduler: returns who should act next (nextSpeaker) and the context to assemble (the root→head linear history, this branch only). An agent runtime uses this to decide which model to call and what to send.", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    run: async (args) => {
      const { graph } = await loadGraph(rootHome(), args.id);
      return nextSpeaker(ensureConversationShape(graph));
    } },
  { name: "of_agent_record", description: "Record one agent outcome (the agent/status/round tags are applied automatically and the pending list is maintained). status=pending|running|done|failed|waiting-human. handoffTo explicitly transfers control.", inputSchema: { type: "object", required: ["id", "agent", "text"], properties: { id: { type: "string" }, agent: { type: "string" }, text: { type: "string" }, type: { type: "string" }, status: { type: "string", enum: ["pending", "running", "done", "failed", "waiting-human"] }, round: { type: "number" }, handoffTo: { type: "string" }, parentId: { type: "string", description: "Defaults to after head" }, edgeType: { type: "string" }, role: { type: "string" } } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      ensureConversationShape(draft);
      const node = recordTurn(draft, { agent: args.agent, text: args.text ?? "", type: args.type ?? "turn", status: args.status ?? "done", round: args.round ?? null, handoffTo: args.handoffTo ?? null, parentId: args.parentId ?? null, edgeType: args.edgeType ?? "follows", role: args.role ?? null });
      draft.notes = draft.notes ?? {};
      draft.notes[node.id] = String(args.text ?? "").split("\n")[0].slice(0, 120);
      return { nodeId: node.id, status: node.status, turn: turnMeta(node).round };
    }) },
  { name: "of_agent_done", description: "Finish a pending branch (set its status to done/failed and drop it from the pending list).", inputSchema: { type: "object", required: ["id", "nodeId"], properties: { id: { type: "string" }, nodeId: { type: "string" }, status: { type: "string", enum: ["done", "failed", "aborted"] }, text: { type: "string" } } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      ensureConversationShape(draft);
      const node = resolveTurn(draft, args.nodeId, { status: args.status ?? "done", text: args.text ?? null });
      return { nodeId: node.id, status: node.status };
    }) },
  { name: "of_convo_vote", description: "Aggregate the output of several branches: majority / weighted (pass weights) / judge (takes text). A decision node is created with aggregates edges flowing in; head moves to the decision point.", inputSchema: { type: "object", required: ["id", "sources"], properties: { id: { type: "string" }, sources: { type: "array", items: { type: "string" } }, strategy: { type: "string", enum: ["majority", "weighted", "judge"] }, label: { type: "string" }, text: { type: "string", description: "The verdict under the judge strategy" }, winner: { type: "string" }, agent: { type: "string", description: "Judge name; default judge" } } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      ensureConversationShape(draft);
      const r = aggregateBranches(draft, { sources: args.sources ?? [], strategy: args.strategy ?? "majority", label: args.label ?? null, winner: args.winner ?? null, text: args.text ?? "", agent: args.agent ?? "judge" });
      draft.notes = draft.notes ?? {};
      draft.notes[r.node.id] = String(r.chosen ?? "").split("\n")[0].slice(0, 120);
      return { nodeId: r.node.id, strategy: r.strategy, tally: r.tally, distinct: r.distinct, consensus: Number(r.consensus.toFixed(3)), chosen: r.chosen };
    }) },
  { name: "of_convo_pending", description: "Pending branches: nodes that are running / waiting for a human / still to be produced (an agent runtime uses this to see which branches have not returned).", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    run: async (args) => {
      const { graph } = await loadGraph(rootHome(), args.id);
      return { pending: pendingTurns(ensureConversationShape(graph)) };
    } },
  { name: "of_import_doc", description: "Build a card graph from a structured PDF extraction: MinerU content_list.json (recommended; carries formula LaTeX and page numbers) or Markdown. Definitions / theorems / propositions / lemmas / corollaries / examples / remarks are detected automatically, cross-references between numbers become dependency edges, and page images of the source can be attached.", inputSchema: { type: "object", required: ["file"], properties: { file: { type: "string", description: "Absolute path to content_list.json or a .md file" }, name: { type: "string" }, folder: { type: "string" }, lang: { type: "string", enum: ["zh", "en"] } } },
    run: async (args) => {
      const root = rootHome();
      const { readFile: rf } = await import("node:fs/promises");
      const raw = await rf(args.file, "utf8");
      let built;
      if (/\.py$/i.test(args.file)){
        const data = await extractPythonData(args.file);
        built = buildGraphFromCards(data, { name: args.name ?? "card graph", lang: args.lang === "zh" ? "zh" : "en" });
        built.__flow = { data };
      } else if (/\.json$/i.test(args.file)){
        built = buildGraphFromMineru({ contentList: JSON.parse(raw), name: args.name ?? "PDF card graph", lang: args.lang === "zh" ? "zh" : "en" });
      } else {
        built = buildGraphFromMarkdown({ markdown: raw, name: args.name ?? "Markdown card graph" });
      }
      built.graph.id = makeGraphId(built.graph.name);
      const verdict = validateGraph(built.graph);
      if (!verdict.ok) throw new Error(`Structure validation failed: ${verdict.issues.slice(0, 3).join("；")}`);
      // imports are the biggest LaTeX source: normalise + validate (put example source in a code fence to exempt it)
      {
        const { normalizeGraphText, guardGraphText } = await import("./latex.js");
        normalizeGraphText(built.graph);
        const g = guardGraphText(built.graph);
        if (g.failed.length){
          const det = g.failed.slice(0, 5).map((f, i)=> `  ${i + 1}) ${f.where}：${String(f.fragment).replace(/\s+/g, " ").slice(0, 90)}\n     fix: ${f.hint}`).join("\n");
          throw new Error(`Imported content contains ${g.failed.length} LaTeX fragment(s) that cannot compile; aborted so nothing broken reaches the graph:\n${det}`);
        }
      }
      await saveGraph(graphDir(root, built.graph.id), built.graph);
      if (args.folder){ try { await moveGraph(root, built.graph.id, args.folder); } catch { /* filing failure is not fatal */ } }
      let overviewId = null;
      if (built.__flow?.data?.SECTION_FLOW?.length){
        const ov = buildOverviewFromFlow(built.__flow.data, { name: `${built.graph.name} · Section overview` });
        ov.graph.id = makeGraphId(ov.graph.name);
        await saveGraph(graphDir(root, ov.graph.id), ov.graph);
        if (args.folder){ try { await moveGraph(root, ov.graph.id, args.folder); } catch { /* best effort */ } }
        overviewId = ov.graph.id;
      }
      return { id: built.graph.id, name: built.graph.name, stats: built.stats, overviewId, storage: { graph: join(root, "graphs", built.graph.id, "graph.json") }, folder: args.folder ?? "" };
    } },
  /* ---------- Live conversation capture: once on, every turn is persisted ---------- */
  { name: "of_live_start", description: "Start non-linear conversation capture (call this when the user says '开启非线性对话'). An active session is resumed, otherwise a new conversation graph is created. Afterwards every turn only needs of_live_log — no id required.", inputSchema: { type: "object", properties: { topic: { type: "string", description: "Topic of this conversation (used when creating)" }, folder: { type: "string", description: "Archive folder" }, lang: { type: "string", enum: ["zh", "en"] }, reuse: { type: "boolean", description: "Whether to resume an existing active session (default true)" } } },
    run: async (args) => liveStart(rootHome(), { topic: args.topic ?? null, folder: args.folder ?? null, lang: args.lang === "en" ? "en" : "zh", reuse: args.reuse !== false }) },
  { name: "of_live_log", description: "Log one turn (the user's message is role=user, your reply is role=agent). Once recording is on you MUST call this every turn; no id is needed. branchFrom explicitly forks from an earlier node (non-linear).", inputSchema: { type: "object", required: ["text"], properties: { role: { type: "string", enum: ["user", "agent", "system"], description: "Who said it (default agent)" }, text: { type: "string" }, name: { type: "string", description: "Optional speaker name (multi-agent scenarios)" }, from: { type: "string", description: "Fork from this node (defaults to after head)" }, type: { type: "string" }, status: { type: "string", enum: ["done", "running", "pending", "waiting-human", "failed"] }, handoffTo: { type: "string" }, id: { type: "string", description: "Explicit graph id (defaults to the active session)" } } },
    run: async (args) => liveLog(rootHome(), { role: args.role ?? "agent", text: args.text ?? "", name: args.name ?? null, from: args.from ?? null, type: args.type ?? null, status: args.status ?? "done", handoffTo: args.handoffTo ?? null, id: args.id ?? null }) },
  { name: "of_live_stop", description: "Stop recording (the graph is kept; review or resume it any time). Call this when the user says '停止记录' / '结束记录'.", inputSchema: { type: "object", properties: { id: { type: "string" } } },
    run: async (args) => liveStop(rootHome(), { id: args.id ?? null }) },
  { name: "of_live_status", description: "Check whether recording is on, how many turns have been logged, the current head and the open threads.", inputSchema: { type: "object", properties: {} },
    run: async () => liveStatus(rootHome()) },
  /* ---------- Cross-graph links + hierarchical projection ---------- */
  { name: "of_xlink_add", description: "Add a cross-graph link: from = the side providing the support, to = the side using it (the arrow is always from→to). why is a required mathematical justification, so the relation can be reviewed later.", inputSchema: { type: "object", required: ["fromGraph", "fromNode", "toGraph", "toNode", "why"], properties: { fromGraph: { type: "string" }, fromNode: { type: "string" }, toGraph: { type: "string" }, toNode: { type: "string" }, why: { type: "string", description: "Mathematical justification (do not write 'related content')" }, kind: { type: "string" } } },
    run: async (args) => { await assertLinkTargets(rootHome(), args); return addCrosslink(rootHome(), args); } },
  { name: "of_xlink_list", description: "List cross-graph links; pass a graphId to see only those touching that graph, annotated with the perspective (provides = external reference / uses = cross-graph support).", inputSchema: { type: "object", properties: { graphId: { type: "string" } } },
    run: async (args) => ({ links: args.graphId ? await crosslinksForGraph(rootHome(), args.graphId) : await readAllLinks(rootHome()) }) },
  { name: "of_xlink_rm", description: "Delete one cross-graph link", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    run: async (args) => removeCrosslink(rootHome(), args.id) },
  { name: "of_xlink_import", description: "Import a cross-graph link table (crosslinks.py or JSON)", inputSchema: { type: "object", required: ["file"], properties: { file: { type: "string" }, map: { type: "object", description: "Book code → local graph id" } } },
    run: async (args) => {
      const { readFile: rf } = await import("node:fs/promises");
      const rows = parseCrosslinkTable(await rf(args.file, "utf8"), { bookToGraph: args.map ?? {} });
      let created = 0, updated = 0;
      for (const r2 of rows){ const res = await addCrosslink(rootHome(), r2); res.created ? created++ : updated++; }
      return { parsed: rows.length, created, updated };
    } },
  { name: "of_project_overview", description: "Build a 'section overview' graph: nodes = sections, edges = aggregated dependencies between sections (weight = count). Good for seeing the whole before drilling in.", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" }, name: { type: "string" }, folder: { type: "string" } } },
    run: async (args) => {
      const root = rootHome();
      const r = await projectOverview(root, args.id, { name: args.name ?? null });
      r.graph.id = makeGraphId(r.graph.name);
      await saveGraph(graphDir(root, r.graph.id), r.graph);
      if (args.folder){ try { await moveGraph(root, r.graph.id, args.folder); } catch { /* filing failure is not fatal */ } }
      return { id: r.graph.id, name: r.graph.name, sections: r.graph.nodes.length, edges: r.graph.edges.length, crossLinks: r.crossLinks };
    } },
  { name: "of_project_sections", description: "Split by section: one graph per section, holding that section's cards plus ghost cards (stand-ins for cross-section / cross-book dependencies, tagged open:<graph> so you can jump back). Cross-section links survive the split.", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" }, minCards: { type: "number" }, only: { type: "string" }, folder: { type: "string" } } },
    run: async (args) => projectSections(rootHome(), args.id, { minCards: args.minCards ?? 3, only: args.only ?? null, folder: args.folder ?? null }) },
];

async function readAllLinks(root){ const { readCrosslinks } = await import("./crosslinks.js"); return await readCrosslinks(root); }

function toolSummaries() {
  return TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
}

async function dispatch(name, args) {
  const tool = TOOLS.find((entry) => entry.name === name);
  if (!tool) throw new Error(`unknown tool: ${name}`);
  return tool.run(args ?? {});
}

export async function runMcpServer({ stdin = process.stdin, stdout = process.stdout } = {}) {
  const readline = createInterface({ input: stdin, terminal: false });
  for await (const line of readline) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let message;
    try {
      message = JSON.parse(trimmed);
    } catch {
      continue; // ignore non-JSON lines: keep stdio clean
    }
    if (message.jsonrpc !== "2.0" || typeof message.method !== "string") continue;
    const isNotification = message.id === undefined || message.id === null;
    try {
      let result = null;
      if (message.method === "initialize") {
        result = {
          protocolVersion: message.params?.protocolVersion ?? PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "omni-flow", version: JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version }
        };
      } else if (message.method === "ping") {
        result = {};
      } else if (message.method === "tools/list") {
        result = { tools: toolSummaries() };
      } else if (message.method === "tools/call") {
        const name = message.params?.name;
        const args = message.params?.arguments ?? {};
        try {
          const data = await dispatch(name, args);
          result = { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], isError: false };
        } catch (error) {
          result = { content: [{ type: "text", text: `✗ ${String(error?.message ?? error)}` }], isError: true };
        }
      } else if (/^notifications\//.test(message.method)) {
        continue; // initialized / cancelled etc.: no response
      } else if (!isNotification) {
        throw Object.assign(new Error(`method not found: ${message.method}`), { code: -32601 });
      }
      if (!isNotification && result !== null) {
        stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, result })}\n`);
      }
    } catch (error) {
      if (!isNotification) {
        stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: error?.code ?? -32603, message: String(error?.message ?? error) } })}\n`);
      }
    }
  }
}
