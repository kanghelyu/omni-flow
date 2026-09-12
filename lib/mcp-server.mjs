// OmniFlow MCP Server — 标准接口层。stdio 上的 JSON-RPC 2.0（Model Context Protocol）。
// 全量暴露 OmniFlow 的 24 个操作；任何支持 MCP 的 agent（Claude Code / Codex / WorkBuddy / …）
// 都可直接挂载。零依赖实现，stdout 只输出协议消息。
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { normalizeGraph, validateGraph, NODE_TYPES, EDGE_TYPES, newId } from "./graph-core.js";
import { layeredLayout, clusterLayout, analyzeGraph } from "./graph-analysis.js";
import { searchGraphs } from "./search.mjs";
import { suggestGroups } from "./group-suggest.js";
import { loadGraph, saveGraph, listGraphs, deleteGraph, readNodeNote, writeNodeNote, makeGraphId } from "./graph-service.mjs";
import { buildTemplateById, mergedTemplateSummaries, saveCustomTemplate, deleteCustomTemplate } from "./templates.js";
import { readTree, createFolder, moveGraph } from "./vault.js";
import { toMermaid, fromMermaid, toDot, toMarkdownOutline, toPlainText, fromAgentFlow } from "./converters.js";
import { buildGraphFromMineru, buildGraphFromMarkdown } from "./import-doc.js";
import { ensureConversationShape, appendTurn, setHead, mergeBranches, pathTo, conversationOverview, linearize, registerAgent, recordTurn, resolveTurn, pendingTurns, nextSpeaker, aggregateBranches, scaffoldTopology, turnMeta } from "./conversation.js";

const PROTOCOL_VERSION = "2025-06-18";

function rootHome() {
  return resolve(process.env.OF_HOME ?? join(homedir(), ".omni-flow"));
}
function graphDirSafe(root, id) {
  return join(root, "graphs", id);
}
async function mutateGraph(id, mutator, { bump = true } = {}) {
  const root = rootHome();
  const { graph } = await loadGraph(root, id);
  const draft = normalizeGraph(structuredClone(graph));
  mutator(draft);
  const verdict = validateGraph(draft);
  if (!verdict.ok) throw new Error(`结构校验未通过：${verdict.issues.join("；")}`);
  if (bump) draft.revision = graph.revision + 1;
  await saveGraph(graphDirSafe(root, id), draft);
  return { ok: true, revision: draft.revision, nodes: draft.nodes.length, edges: draft.edges.length, graph: draft };
}

const patchNodeSchema = {
  type: "object",
  properties: {
    label: { type: "string" }, type: { type: "string" }, note: { type: "string" },
    x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" },
    shape: { type: "string", enum: ["rect", "rounded", "pill", "diamond", "ellipse", "hexagon", "parallelogram", "document"] },
    fill: { type: "string", description: "十六进制颜色，如 #7C3AED" },
    border: { type: "string" }, textColor: { type: "string" },
    icon: { type: "string", description: "任意短图标字符，如 ∎ 📄" },
    status: { type: "string", enum: ["todo", "doing", "done", "blocked", ""] },
    tags: { type: "array", items: { type: "string" } }
  }
};
const patchEdgeSchema = {
  type: "object",
  properties: {
    label: { type: "string", description: "箭头命名，如「依赖」「回应」「A」" },
    type: { type: "string", description: "语义类型 id，见 of_edge_types" },
    color: { type: "string" },
    width: { type: "number", enum: [1, 2, 3, 4, 6] },
    style: { type: "string", enum: ["solid", "dashed", "dotted"] },
    arrow: { type: "string", enum: ["one", "both", "none"] },
    curve: { type: "string", enum: ["bezier", "ortho", "straight"] }
  }
};

/** 全量工具集：Studio HTTP API 的每个端点都有对应 MCP tool。 */
const TOOLS = [
  { name: "of_list_graphs", description: "列出全部图（含节点/连线数、校验状态、更新时间）", inputSchema: { type: "object", properties: {} },
    run: async () => listGraphs(rootHome()) },
  { name: "of_node_types", description: "列出全部内置节点类型及其默认颜色/形状/图标", inputSchema: { type: "object", properties: {} },
    run: async () => NODE_TYPES },
  { name: "of_edge_types", description: "列出全部内置连线语义类型（依赖/引用/RACI…）及默认颜色线型", inputSchema: { type: "object", properties: {} },
    run: async () => EDGE_TYPES },
  { name: "of_templates", description: "列出全部模板（内置 + agent 自建），选择器文案随语言", inputSchema: { type: "object", properties: { lang: { type: "string", enum: ["zh", "en"] } } },
    run: async (args) => mergedTemplateSummaries(rootHome(), args.lang === "en" ? "en" : "zh") },
  { name: "of_save_template", description: "把一张现有图沉淀为可复用的自定义模板（后续 of_create_graph 可直接引用 templateId），或用内联 nodes/edges 创建模板", inputSchema: { type: "object", required: ["name"], properties: { fromGraph: { type: "string", description: "从这张图快照为模板" }, templateId: { type: "string", description: "模板 id（2-48 位字母/数字/-/_），缺省自动生成" }, name: { type: "string" }, nameEn: { type: "string" }, desc: { type: "string" }, descEn: { type: "string" }, nodes: { type: "array", description: "内联节点（与 fromGraph 二选一）" }, edges: { type: "array" }, groups: { type: "array" }, direction: { type: "string", enum: ["TD", "LR"] } } },
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
  { name: "of_delete_template", description: "删除一个自定义模板（内置模板不可删）", inputSchema: { type: "object", required: ["templateId"], properties: { templateId: { type: "string" } } },
    run: async (args) => deleteCustomTemplate(rootHome(), args.templateId) },
  { name: "of_search", description: "全局搜索：图标题/节点标签/标签/备注全文。返回 results[]（含 graphId/graphName/nodeId/nodeLabel/snippet/where），nodeId 可直接接 of_get_note / of_patch_node", inputSchema: { type: "object", required: ["q"], properties: { q: { type: "string", description: "关键词（不区分大小写，子串匹配）" } } },
    run: async (args) => ({ results: await searchGraphs(rootHome(), args.q) }) },
  { name: "of_tree", description: "读取 Obsidian 式文件夹树：folders = 全部文件夹路径；assign = 图 → 文件夹归属（未出现的图在根目录）", inputSchema: { type: "object", properties: {} },
    run: async () => readTree(rootHome()) },
  { name: "of_create_folder", description: "Create folder (a/b auto-creates ancestor levels)", inputSchema: { type: "object", required: ["path"], properties: { path: { type: "string", description: "文件夹路径，如 数学/论文笔记" } } },
    run: async (args) => createFolder(rootHome(), args.path) },
  { name: "of_move_graph", description: "把图移动到某文件夹（folder 传 \"\" 移回根目录；文件夹不存在会自动创建）", inputSchema: { type: "object", required: ["graphId", "folder"], properties: { graphId: { type: "string" }, folder: { type: "string" } } },
    run: async (args) => moveGraph(rootHome(), args.graphId, args.folder) },
  { name: "of_create_graph", description: "Create a graph from a template. 语言规则：默认英文；若用户使用中文请传 lang=zh；若整理的是中文文章，也传 lang=zh。folder 可归档到文件夹（自动建层级）。返回含完整存储位置，agent 必须如实转述。", inputSchema: { type: "object", required: ["name"], properties: { name: { type: "string" }, template: { type: "string", description: "模板 id，默认 blank" }, description: { type: "string" }, folder: { type: "string", description: "归档文件夹路径（a/b 可嵌套），缺省为根目录" }, lang: { type: "string", enum: ["zh", "en"], description: "内容语言：用户用中文→zh；英文或未知→en（缺省 en）" } } },
    run: async (args) => {
      const root = rootHome();
      const graph = await buildTemplateById(root, args.template ?? "blank", args.name, args.lang === "zh" ? "zh" : "en");
      graph.id = makeGraphId(graph.name);
      if (args.description) graph.description = String(args.description);
      await saveGraph(graphDirSafe(root, graph.id), graph);
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
  { name: "of_get_graph", description: "读取一张图的完整数据（节点/边/分组/类型注册表/校验状态）。这是唯一拓扑事实来源 graph.json 的服务端视图", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    run: async (args) => {
      const { graph } = await loadGraph(rootHome(), args.id);
      return { ...graph, validation: validateGraph(graph) };
    } },
  { name: "of_validate", description: "结构校验：硬错误（重复id/悬空边）阻断；环/孤立点/自环为警告（万用图中可能合法）", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    run: async (args) => { const { graph } = await loadGraph(rootHome(), args.id); return validateGraph(graph); } },
  { name: "of_analyze", description: "图分析：环检测、度中心性瓶颈排名（RACI 单点故障）、孤立节点、可选某节点的上/下游依赖闭包。结果自带 groupSuggestions（四组建议），agent 逐条 of_add_group 即完成合规分组", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" }, trace: { type: "string", description: "可选：要追踪依赖的节点 id" } } },
    run: async (args) => { const { graph } = await loadGraph(rootHome(), args.id); return { ...analyzeGraph(graph.nodes, graph.edges, { trace: args.trace ?? null }), groupSuggestions: suggestGroups(graph) }; } },
  { name: "of_add_node", description: "添加节点（可带完整样式：类型/形状/三色/图标/状态）", inputSchema: { type: "object", required: ["id", "label"], properties: { id: { type: "string", description: "图 id" }, label: { type: "string" }, type: { type: "string" }, x: { type: "number" }, y: { type: "number" }, fill: { type: "string" }, border: { type: "string" }, textColor: { type: "string" }, shape: { type: "string" }, icon: { type: "string" }, status: { type: "string" }, note: { type: "string" } } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      draft.nodes.push(normalizeGraph({ nodes: [{ id: `n-${Math.random().toString(36).slice(2, 7)}`, type: args.type ?? "process", label: args.label, x: args.x, y: args.y, fill: args.fill, border: args.border, textColor: args.textColor, shape: args.shape, icon: args.icon, status: args.status, note: args.note }] }).nodes[0]);
    }) },
  { name: "of_patch_node", description: "修改节点任意属性（文字/类型/形状/三色/图标/状态/位置/尺寸）——全自定义入口", inputSchema: { type: "object", required: ["id", "nodeId", "patch"], properties: { id: { type: "string" }, nodeId: { type: "string" }, patch: patchNodeSchema } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      const node = draft.nodes.find((candidate) => candidate.id === args.nodeId);
      if (!node) throw new Error(`节点 ${args.nodeId} 不存在`);
      const allowed = ["label", "type", "note", "x", "y", "w", "h", "shape", "fill", "border", "textColor", "icon", "status", "tags"];
      for (const key of allowed) if (args.patch?.[key] !== undefined) node[key] = args.patch[key];
    }) },
  { name: "of_move_node", description: "移动节点坐标（不递增 revision，与画布拖拽同语义）", inputSchema: { type: "object", required: ["id", "nodeId", "x", "y"], properties: { id: { type: "string" }, nodeId: { type: "string" }, x: { type: "number" }, y: { type: "number" } } },
    run: async (args) => {
      const root = rootHome();
      const { graph } = await loadGraph(root, args.id);
      const node = graph.nodes.find((candidate) => candidate.id === args.nodeId);
      if (!node) throw new Error(`节点 ${args.nodeId} 不存在`);
      node.x = Math.round(args.x); node.y = Math.round(args.y); // 画布无边界，允许负坐标
      await saveGraph(graphDirSafe(root, args.id), graph);
      return { ok: true };
    } },
  { name: "of_delete_node", description: "删除节点及其全部连线", inputSchema: { type: "object", required: ["id", "nodeId"], properties: { id: { type: "string" }, nodeId: { type: "string" } } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      draft.nodes = draft.nodes.filter((node) => node.id !== args.nodeId);
      draft.edges = draft.edges.filter((edge) => edge.source !== args.nodeId && edge.target !== args.nodeId);
      for (const group of draft.groups) group.members = group.members.filter((member) => member !== args.nodeId);
      delete draft.notes[args.nodeId];
    }) },
  { name: "of_add_edge", description: "添加连线。方向铁律：source=来源（时间在先/逻辑在先/提供方/上级），target=结果（派生物/接收方/下级）——永远来源指向结果（自环与悬空引用会被拒绝）", inputSchema: { type: "object", required: ["id", "source", "target"], properties: { id: { type: "string", description: "图 id" }, source: { type: "string" }, target: { type: "string" }, type: { type: "string", description: "语义类型 id，如 depends-on / cites / raci-a；空串=通用关联" }, label: { type: "string", description: "箭头命名" } } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      if (args.source === args.target) throw new Error("不允许自环连线");
      if (!draft.nodes.some((node) => node.id === args.source)) throw new Error(`起点 ${args.source} 不存在`);
      if (!draft.nodes.some((node) => node.id === args.target)) throw new Error(`终点 ${args.target} 不存在`);
      draft.edges.push(normalizeGraph({ edges: [{ id: `e-${Math.random().toString(36).slice(2, 8)}`, source: args.source, target: args.target, type: args.type ?? "", label: args.label ?? "" }] }).edges[0]);
    }) },
  { name: "of_patch_edge", description: "修改连线任意属性（标签/类型/颜色/粗细/线型/箭头/曲率）", inputSchema: { type: "object", required: ["id", "edgeId", "patch"], properties: { id: { type: "string" }, edgeId: { type: "string" }, patch: patchEdgeSchema } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      const edge = draft.edges.find((candidate) => candidate.id === args.edgeId);
      if (!edge) throw new Error(`连线 ${args.edgeId} 不存在`);
      for (const key of ["label", "type", "color", "width", "style", "arrow", "curve"]) {
        if (args.patch?.[key] !== undefined) edge[key] = args.patch[key];
      }
    }) },
  { name: "of_delete_edge", description: "删除连线", inputSchema: { type: "object", required: ["id", "edgeId"], properties: { id: { type: "string" }, edgeId: { type: "string" } } },
    run: async (args) => mutateGraph(args.id, (draft) => { draft.edges = draft.edges.filter((edge) => edge.id !== args.edgeId); }) },
  { name: "of_layout", description: "自动布局：mode=layered 按依赖分层（默认）/ clusters 按分组聚簇 / force 力导向（看整体结构）/ grid 紧凑网格（按类型排列）", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" }, mode: { type: "string", enum: ["layered", "clusters", "force", "grid"] } } },
    run: async (args) => {
      const root = rootHome();
      const { graph } = await loadGraph(root, args.id);
      const positions = args.mode === "clusters" ? clusterLayout(graph) : layeredLayout(graph.nodes, graph.edges, { direction: graph.direction });
      for (const node of graph.nodes) {
        const position = positions.get(node.id);
        if (position) { node.x = position.x; node.y = position.y; }
      }
      graph.revision += 1;
      await saveGraph(graphDirSafe(root, args.id), graph);
      return { ok: true };
    } },
  { name: "of_add_group", description: "建分组（彩色子图容器，如部门框/章节框）", inputSchema: { type: "object", required: ["id", "label", "members"], properties: { id: { type: "string" }, label: { type: "string" }, members: { type: "array", items: { type: "string" } }, color: { type: "string" } } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      const members = (args.members ?? []).map(String).filter((member) => draft.nodes.some((node) => node.id === member));
      if (!members.length) throw new Error("分组至少需要一个真实存在的成员节点");
      draft.groups.push({ id: `g-${Math.random().toString(36).slice(2, 7)}`, label: String(args.label), color: args.color ?? "#64748B", members });
    }) },
  { name: "of_delete_group", description: "删除分组（不影响成员节点）", inputSchema: { type: "object", required: ["id", "groupId"], properties: { id: { type: "string" }, groupId: { type: "string" } } },
    run: async (args) => mutateGraph(args.id, (draft) => { draft.groups = draft.groups.filter((group) => group.id !== args.groupId); }) },
  { name: "of_set_note", description: "写节点 Markdown 长备注（存 graphs/<id>/notes/<nodeId>.md，首行摘要进 graph.json）", inputSchema: { type: "object", required: ["id", "nodeId", "content"], properties: { id: { type: "string" }, nodeId: { type: "string" }, content: { type: "string" } } },
    run: async (args) => {
      const root = rootHome();
      const { graph } = await loadGraph(root, args.id);
      if (!graph.nodes.some((node) => node.id === args.nodeId)) throw new Error(`节点 ${args.nodeId} 不存在`);
      await writeNodeNote(root, args.id, args.nodeId, String(args.content ?? ""));
      graph.notes[args.nodeId] = String(args.content ?? "").split("\n")[0].slice(0, 120);
      await saveGraph(graphDirSafe(root, args.id), graph);
      return { ok: true };
    } },
  { name: "of_get_note", description: "读节点 Markdown 长备注", inputSchema: { type: "object", required: ["id", "nodeId"], properties: { id: { type: "string" }, nodeId: { type: "string" } } },
    run: async (args) => readNodeNote(rootHome(), args.id, args.nodeId) },
  { name: "of_export", description: "导出图：mermaid / dot（Graphviz）/ md（Markdown 大纲）/ txt（纯文本大纲，分享用）/ json / html（独立离线可交互画布，单文件，可双击打开）", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" }, format: { type: "string", enum: ["mermaid", "dot", "md", "json"] } } },
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
  { name: "of_import_mermaid", description: "从 Mermaid flowchart 文本导入为新图（批量建图首选）", inputSchema: { type: "object", required: ["text"], properties: { text: { type: "string" }, name: { type: "string" } } },
    run: async (args) => {
      const graph = fromMermaid(String(args.text ?? ""));
      if (args.name) graph.name = String(args.name);
      const verdict = validateGraph(graph);
      if (!verdict.ok) throw new Error(`导入内容校验未通过：${verdict.issues.join("；")}`);
      graph.id = makeGraphId(graph.name);
      await saveGraph(graphDirSafe(rootHome(), graph.id), graph);
      return { ok: true, id: graph.id, nodes: graph.nodes.length, edges: graph.edges.length };
    } },
  { name: "of_import_json", description: "从 OmniFlow graph JSON 对象导入为新图", inputSchema: { type: "object", required: ["data"], properties: { data: { type: "object" }, name: { type: "string" } } },
    run: async (args) => {
      const graph = normalizeGraph(args.data);
      if (args.name) graph.name = String(args.name);
      const verdict = validateGraph(graph);
      if (!verdict.ok) throw new Error(`导入内容校验未通过：${verdict.issues.join("；")}`);
      graph.id = makeGraphId(graph.name);
      await saveGraph(graphDirSafe(rootHome(), graph.id), graph);
      return { ok: true, id: graph.id };
    } },
  { name: "of_import_agentflow", description: "把 agent-flow（af）工作流转成图：门分支变成是/否标签边", inputSchema: { type: "object", required: ["afId"], properties: { afId: { type: "string", description: "agent-flow 工作流 id" } } },
    run: async (args) => {
      const { readFile } = await import("node:fs/promises");
      const afHome = resolve(process.env.AF_HOME ?? join(homedir(), ".agent-flow"));
      const raw = await readFile(join(afHome, "flows", String(args.afId).replace(/[/\\]/g, ""), "flow.json"), "utf8");
      const graph = await fromAgentFlow(JSON.parse(raw));
      graph.id = makeGraphId(graph.name);
      await saveGraph(graphDirSafe(rootHome(), graph.id), graph);
      return { ok: true, id: graph.id, nodes: graph.nodes.length, edges: graph.edges.length };
    } },
  { name: "of_delete_graph", description: "删除图（移入 ~/.omni-flow/trash/，可恢复）", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    run: async (args) => ({ ok: true, archivedTo: await deleteGraph(rootHome(), args.id) }) },
  { name: "of_patch_node_type", description: "自定义/新增本图的节点类型（改颜色/形状/图标/文案，写入图的 nodeTypes 注册表，内置类型可覆盖）", inputSchema: { type: "object", required: ["id", "type"], properties: { id: { type: "string", description: "图 id" }, type: { type: "string", description: "类型 key，如 drone / my-theorem" }, label: { type: "string" }, labelEn: { type: "string" }, shape: { type: "string", enum: ["rect", "rounded", "pill", "diamond", "ellipse", "hexagon", "parallelogram", "document"] }, fill: { type: "string" }, border: { type: "string" }, textColor: { type: "string" }, icon: { type: "string" } } },
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
  { name: "of_patch_edge_type", description: "自定义/新增本图的连线语义类型（名称/颜色/线型，写入 edgeTypes 注册表）", inputSchema: { type: "object", required: ["id", "type"], properties: { id: { type: "string", description: "图 id" }, type: { type: "string", description: "类型 key，如 attacks / funds" }, label: { type: "string" }, labelEn: { type: "string" }, color: { type: "string" }, style: { type: "string", enum: ["solid", "dashed", "dotted"] } } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      const prev = draft.edgeTypes[args.type] ?? {};
      draft.edgeTypes[args.type] = {
        label: String(args.label ?? prev.label ?? args.type),
        labelEn: String(args.labelEn ?? prev.labelEn ?? args.label ?? args.type),
        color: args.color ?? prev.color ?? "#64748B",
        style: args.style ?? prev.style ?? "solid"
      };
    }) },
  { name: "of_patch_graph_meta", description: "改图名称/描述/方向", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, direction: { type: "string", enum: ["TD", "LR"] } } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      if (args.name) draft.name = String(args.name).trim();
      if (args.description !== undefined) draft.description = String(args.description);
      if (args.direction === "TD" || args.direction === "LR") draft.direction = args.direction;
    }) },
  { name: "of_start_studio", description: "启动可视化画布 Studio（后台运行，返回 URL；默认 127.0.0.1:4319）", inputSchema: { type: "object", properties: { port: { type: "number" }, open: { type: "boolean", description: "是否打开浏览器，默认 false" } } },
    run: async (args) => {
      const { spawn } = await import("node:child_process");
      const ofBin = join(rootHome(), "bin", "of.mjs");
      const port = String(args.port ?? 4319);
      const child = spawn(process.execPath, [ofBin, "studio", "--port", port, ...(args.open ? [] : ["--no-open"])], { detached: true, stdio: "ignore" });
      child.unref();
      await new Promise((r) => setTimeout(r, 800));
      return { ok: true, url: `http://127.0.0.1:${port}` };
    } },
  { name: "of_list_trash", description: "列出回收站中已删除的图（可恢复）", inputSchema: { type: "object", properties: {} },
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
        } catch { /* 跳过坏目录 */ }
      }
      return out;
    } },
  { name: "of_restore_graph", description: "从回收站恢复一张图", inputSchema: { type: "object", required: ["trashName"], properties: { trashName: { type: "string", description: "of_list_trash 返回的 trashName" } } },
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
  /* ---------- 非线性对话（DAG 会话：分支 / 汇合 / 活跃路径） ---------- */
  { name: "of_convo_new", description: "新建非线性对话图（DAG 会话）。返回 id 与存储位置。之后用 of_convo_say 追加发言、of_convo_branch 跳支、of_convo_merge 汇合。", inputSchema: { type: "object", required: ["topic"], properties: { topic: { type: "string", description: "对话主题（会成为根节点）" }, folder: { type: "string", description: "归档文件夹，缺省根目录" }, lang: { type: "string", enum: ["zh", "en"] } } },
    run: async (args) => {
      const root = rootHome();
      const graph = ensureConversationShape(await buildTemplateById(root, "blank", args.topic, args.lang === "zh" ? "zh" : "en"), { topic: args.topic });
      graph.id = makeGraphId(graph.name);
      const topicNode = appendTurn(graph, { text: args.topic, speaker: "system", type: "topic" });
      graph.conversation.topic = args.topic;
      const verdict = validateGraph(graph);
      if (!verdict.ok) throw new Error(`结构校验未通过：${verdict.issues.join("；")}`);
      await saveGraph(graphDirSafe(root, graph.id), graph);
      if (args.folder) { try { await moveGraph(root, graph.id, args.folder); } catch { /* 归档失败不阻断 */ } }
      return { id: graph.id, name: graph.name, rootNode: topicNode.id, storage: { graph: join(root, "graphs", graph.id, "graph.json") }, folder: args.folder ?? "" };
    } },
  { name: "of_convo_say", description: "在对话中追加一次发言（默认接在当前 head 之后；指定 parentId 即从该节点分出新支）。head 自动移到新发言。", inputSchema: { type: "object", required: ["id", "text"], properties: { id: { type: "string" }, text: { type: "string" }, speaker: { type: "string", description: "发言人（缺省 user）" }, type: { type: "string", enum: ["turn", "question", "answer", "idea", "decision"], description: "发言类型" }, parentId: { type: "string", description: "从该节点接续（= 开新支）；缺省用 head" }, edgeType: { type: "string", enum: ["follows", "answers", "challenges", "refines"], description: "关系语义" } } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      ensureConversationShape(draft);
      const node = appendTurn(draft, { text: args.text, speaker: args.speaker ?? "user", type: args.type ?? "turn", parentId: args.parentId ?? null, edgeType: args.edgeType ?? "follows" });
      const notes = draft.notes ?? {};
      notes[node.id] = String(args.text ?? "").split("\n")[0].slice(0, 120);
      draft.notes = notes;
      draft.__convoNode = node.id;
      return node.id;
    }) },
  { name: "of_convo_branch", description: "把 head 移到任意已有节点——下一步 of_convo_say 就会从那里分出新支（非线性回溯）", inputSchema: { type: "object", required: ["id", "nodeId"], properties: { id: { type: "string" }, nodeId: { type: "string" } } },
    run: async (args) => mutateGraph(args.id, (draft) => { ensureConversationShape(draft); setHead(draft, args.nodeId); }) },
  { name: "of_convo_merge", description: "汇合多条分支：新建 merge 节点，各支以 merges 边汇入；head 移到汇合点", inputSchema: { type: "object", required: ["id", "sources"], properties: { id: { type: "string" }, sources: { type: "array", items: { type: "string" }, description: "要汇合的分支末端节点 id（≥2）" }, label: { type: "string" }, text: { type: "string", description: "汇合结论全文（写入备注）" }, speaker: { type: "string" } } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      ensureConversationShape(draft);
      const node = mergeBranches(draft, { sources: args.sources ?? [], label: args.label ?? "汇合", text: args.text ?? "", speaker: args.speaker ?? "user" });
      if (args.text) { draft.notes = draft.notes ?? {}; draft.notes[node.id] = String(args.text).split("\n")[0].slice(0, 120); }
    }) },
  { name: "of_convo_path", description: "取某节点（缺省 head）的活跃路径：根→该节点的全部发言（= 应进入上下文的线性历史）", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" }, nodeId: { type: "string" } } },
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
  { name: "of_convo_open", description: "对话总览：head 位置、开放分支（叶子，可继续的支线）、分叉点、最深路径、发言人", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    run: async (args) => {
      const { graph } = await loadGraph(rootHome(), args.id);
      return conversationOverview(ensureConversationShape(graph));
    } },
  { name: "of_convo_linearize", description: "把一条路径线性化导出（md 缩进版 / txt 对话稿），用于分享或喂给别的模型", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" }, nodeId: { type: "string" }, format: { type: "string", enum: ["md", "txt"] } } },
    run: async (args) => {
      const { graph } = await loadGraph(rootHome(), args.id);
      return { format: args.format ?? "md", text: linearize(graph, args.nodeId ?? null, { format: args.format ?? "md" }) };
    } },
  /* ---------- 多智能体（agent）非线性对话 ---------- */
  { name: "of_convo_scaffold", description: "为多智能体会话生成拓扑骨架：注册 agents 并创建并行分支（初始为 pending）。topology=supervisor|hierarchical|debate|map-reduce|network。之后用 of_agent_next 取调度、of_agent_record 记录产出、of_convo_vote 聚合。", inputSchema: { type: "object", required: ["id", "agents"], properties: { id: { type: "string" }, topology: { type: "string", enum: ["supervisor", "hierarchical", "debate", "map-reduce", "network", "custom"] }, agents: { type: "array", description: "[{ name, role, model?, goal?, tools? }]", items: { type: "object" } }, topic: { type: "string" }, maxTurns: { type: "number" } } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      ensureConversationShape(draft);
      const created = scaffoldTopology(draft, { topology: args.topology ?? "supervisor", agents: args.agents ?? [], topic: args.topic ?? null, maxTurns: args.maxTurns ?? 24 });
      return created;
    }) },
  { name: "of_agent_next", description: "调度器：返回下一步该谁产出（nextSpeaker）以及该装配的上下文（根→head 的线性历史，只含本支）。agent 运行时按此决定调用哪个模型与发送什么消息。", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    run: async (args) => {
      const { graph } = await loadGraph(rootHome(), args.id);
      return nextSpeaker(ensureConversationShape(graph));
    } },
  { name: "of_agent_record", description: "记录一次 agent 产出（自动挂 agent/status/round 标签并维护待办列表）。status=pending|running|done|failed|waiting-human。handoffTo 可显式移交控制权。", inputSchema: { type: "object", required: ["id", "agent", "text"], properties: { id: { type: "string" }, agent: { type: "string" }, text: { type: "string" }, type: { type: "string" }, status: { type: "string", enum: ["pending", "running", "done", "failed", "waiting-human"] }, round: { type: "number" }, handoffTo: { type: "string" }, parentId: { type: "string", description: "缺省接在 head 之后" }, edgeType: { type: "string" }, role: { type: "string" } } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      ensureConversationShape(draft);
      const node = recordTurn(draft, { agent: args.agent, text: args.text ?? "", type: args.type ?? "turn", status: args.status ?? "done", round: args.round ?? null, handoffTo: args.handoffTo ?? null, parentId: args.parentId ?? null, edgeType: args.edgeType ?? "follows", role: args.role ?? null });
      draft.notes = draft.notes ?? {};
      draft.notes[node.id] = String(args.text ?? "").split("\n")[0].slice(0, 120);
      return { nodeId: node.id, status: node.status, turn: turnMeta(node).round };
    }) },
  { name: "of_agent_done", description: "完成某个待办分支（把状态改为 done/failed 并移出待办）。", inputSchema: { type: "object", required: ["id", "nodeId"], properties: { id: { type: "string" }, nodeId: { type: "string" }, status: { type: "string", enum: ["done", "failed", "aborted"] }, text: { type: "string" } } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      ensureConversationShape(draft);
      const node = resolveTurn(draft, args.nodeId, { status: args.status ?? "done", text: args.text ?? null });
      return { nodeId: node.id, status: node.status };
    }) },
  { name: "of_convo_vote", description: "聚合多条分支产出：majority（多数票）/ weighted（加权，需传入 weights）/ judge（仲裁取 text）。生成 decision 节点并以 aggregates 边汇入，head 移到决策点。", inputSchema: { type: "object", required: ["id", "sources"], properties: { id: { type: "string" }, sources: { type: "array", items: { type: "string" } }, strategy: { type: "string", enum: ["majority", "weighted", "judge"] }, label: { type: "string" }, text: { type: "string", description: "judge 策略下的仲裁结论" }, winner: { type: "string" }, agent: { type: "string", description: "仲裁者名字，缺省 judge" } } },
    run: async (args) => mutateGraph(args.id, (draft) => {
      ensureConversationShape(draft);
      const r = aggregateBranches(draft, { sources: args.sources ?? [], strategy: args.strategy ?? "majority", label: args.label ?? null, winner: args.winner ?? null, text: args.text ?? "", agent: args.agent ?? "judge" });
      draft.notes = draft.notes ?? {};
      draft.notes[r.node.id] = String(r.chosen ?? "").split("\n")[0].slice(0, 120);
      return { nodeId: r.node.id, strategy: r.strategy, tally: r.tally, distinct: r.distinct, consensus: Number(r.consensus.toFixed(3)), chosen: r.chosen };
    }) },
  { name: "of_convo_pending", description: "待办分支：正在运行 / 等待人工 / 待产出的节点（agent 运行时用它决定还有哪些分支没回来）。", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    run: async (args) => {
      const { graph } = await loadGraph(rootHome(), args.id);
      return { pending: pendingTurns(ensureConversationShape(graph)) };
    } },
  { name: "of_import_doc", description: "从 PDF 结构化提取结果建卡片图：MinerU 的 content_list.json（推荐，含公式 LaTeX 与页码）或 Markdown。自动识别定义/定理/命题/引理/推论/例/记，抽取编号互引并连依赖边，可挂载原书页面图。", inputSchema: { type: "object", required: ["file"], properties: { file: { type: "string", description: "content_list.json 或 .md 的绝对路径" }, name: { type: "string" }, folder: { type: "string" }, lang: { type: "string", enum: ["zh", "en"] } } },
    run: async (args) => {
      const root = rootHome();
      const { readFile: rf } = await import("node:fs/promises");
      const raw = await rf(args.file, "utf8");
      const built = /\.json$/i.test(args.file)
        ? buildGraphFromMineru({ contentList: JSON.parse(raw), name: args.name ?? "PDF 卡片图", lang: args.lang === "zh" ? "zh" : "en" })
        : buildGraphFromMarkdown({ markdown: raw, name: args.name ?? "Markdown 卡片图" });
      built.graph.id = makeGraphId(built.graph.name);
      const verdict = validateGraph(built.graph);
      if (!verdict.ok) throw new Error(`结构校验未通过：${verdict.issues.slice(0, 3).join("；")}`);
      await saveGraph(graphDirSafe(root, built.graph.id), built.graph);
      if (args.folder){ try { await moveGraph(root, built.graph.id, args.folder); } catch { /* 归档失败不阻断 */ } }
      return { id: built.graph.id, name: built.graph.name, stats: built.stats, storage: { graph: join(root, "graphs", built.graph.id, "graph.json") }, folder: args.folder ?? "" };
    } },
];

function toolSummaries() {
  return TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
}

async function dispatch(name, args) {
  const tool = TOOLS.find((entry) => entry.name === name);
  if (!tool) throw new Error(`未知工具：${name}`);
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
      continue; // 非 JSON 行直接忽略，保持 stdio 干净
    }
    if (message.jsonrpc !== "2.0" || typeof message.method !== "string") continue;
    const isNotification = message.id === undefined || message.id === null;
    try {
      let result = null;
      if (message.method === "initialize") {
        result = {
          protocolVersion: message.params?.protocolVersion ?? PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "omni-flow", version: "0.1.0" }
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
        continue; // initialized / cancelled 等：无响应
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
