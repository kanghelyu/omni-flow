// OmniFlow 图核心：类型注册表、数据规范化、结构校验。
// graph.json 是唯一拓扑事实来源；节点/边的颜色、形状、边标签全部可自定义。
// 设计目标：万用流程图——定理依赖、论文关联、任务分工、组织架构、对话关联等一切关系图。

export const NODE_TYPES = {
  start:      { label: "起点",   labelEn: "Start",        shape: "pill",     fill: "#22C55E", border: "#16A34A", textColor: "#052E16", icon: "▶" },
  end:        { label: "终点",   labelEn: "End",          shape: "pill",     fill: "#EF4444", border: "#DC2626", textColor: "#450A0A", icon: "■" },
  process:    { label: "流程",   labelEn: "Process",      shape: "rect",     fill: "#3B82F6", border: "#2563EB", textColor: "#0B1220", icon: "⚙" },
  decision:   { label: "判断",   labelEn: "Decision",     shape: "diamond",  fill: "#F59E0B", border: "#D97706", textColor: "#451A03", icon: "？" },
  milestone:  { label: "里程碑", labelEn: "Milestone",    shape: "hexagon",  fill: "#8B5CF6", border: "#7C3AED", textColor: "#F5F3FF", icon: "🚩" },
  task:       { label: "任务",   labelEn: "Task",         shape: "rounded",  fill: "#0EA5E9", border: "#0284C7", textColor: "#082F49", icon: "✔" },
  person:     { label: "人员",   labelEn: "Person",       shape: "rounded",  fill: "#14B8A6", border: "#0D9488", textColor: "#042F2E", icon: "👤" },
  department: { label: "部门",   labelEn: "Department",   shape: "rect",     fill: "#6366F1", border: "#4F46E5", textColor: "#EEF2FF", icon: "🏢" },
  goal:       { label: "目标",   labelEn: "Goal",         shape: "hexagon",  fill: "#10B981", border: "#059669", textColor: "#022C22", icon: "🎯" },
  risk:       { label: "风险",   labelEn: "Risk",         shape: "diamond",  fill: "#F43F5E", border: "#E11D48", textColor: "#4C0519", icon: "⚠" },
  idea:       { label: "想法",   labelEn: "Idea",         shape: "ellipse",  fill: "#FACC15", border: "#CA8A04", textColor: "#422006", icon: "💡" },
  note:       { label: "笔记",   labelEn: "Note",         shape: "document", fill: "#94A3B8", border: "#64748B", textColor: "#0F172A", icon: "📝" },
  definition: { label: "定义",   labelEn: "Definition",   shape: "rect",     fill: "#06B6D4", border: "#0891B2", textColor: "#083344", icon: "≡" },
  lemma:      { label: "引理",   labelEn: "Lemma",        shape: "rounded",  fill: "#818CF8", border: "#6366F1", textColor: "#1E1B4B", icon: "∂" },
  proposition:{ label: "命题",   labelEn: "Proposition",  shape: "rounded",  fill: "#A78BFA", border: "#8B5CF6", textColor: "#2E1065", icon: "⊗" },
  theorem:    { label: "定理",   labelEn: "Theorem",      shape: "rect",     fill: "#7C3AED", border: "#6D28D9", textColor: "#F5F3FF", icon: "∎" },
  paper:      { label: "论文",   labelEn: "Paper",        shape: "document", fill: "#FBBF24", border: "#D97706", textColor: "#451A03", icon: "📄" },
  topic:      { label: "话题",   labelEn: "Topic",        shape: "ellipse",  fill: "#EC4899", border: "#DB2777", textColor: "#500724", icon: "💬" },
  data:       { label: "数据",   labelEn: "Data",         shape: "parallelogram", fill: "#64748B", border: "#475569", textColor: "#F8FAFC", icon: "⛁" },
  custom:     { label: "自定义", labelEn: "Custom",       shape: "rounded",  fill: "#6B7280", border: "#4B5563", textColor: "#F9FAFB", icon: "◆" }
};

export const EDGE_TYPES = {
  "":           { label: "关联",     labelEn: "Link",        color: "#64748B", style: "solid" },
  "depends-on": { label: "依赖",     labelEn: "Depends on",  color: "#2563EB", style: "solid" },
  "uses":       { label: "使用",     labelEn: "Uses",        color: "#0891B2", style: "solid" },
  "cites":      { label: "引用",     labelEn: "Cites",       color: "#D97706", style: "dashed" },
  "extends":    { label: "扩展",     labelEn: "Extends",     color: "#059669", style: "solid" },
  "contradicts":{ label: "矛盾",     labelEn: "Contradicts", color: "#DC2626", style: "dashed" },
  "generalizes":{ label: "推广",     labelEn: "Generalizes", color: "#7C3AED", style: "solid" },
  "flow":       { label: "流转",     labelEn: "Flow",        color: "#334155", style: "solid" },
  "yes":        { label: "是",       labelEn: "Yes",         color: "#16A34A", style: "solid" },
  "no":         { label: "否",       labelEn: "No",          color: "#DC2626", style: "solid" },
  "reports-to": { label: "汇报",     labelEn: "Reports to",  color: "#4F46E5", style: "solid" },
  "raci-r":     { label: "执行(R)",  labelEn: "Responsible", color: "#2563EB", style: "solid" },
  "raci-a":     { label: "问责(A)",  labelEn: "Accountable", color: "#DC2626", style: "solid" },
  "raci-c":     { label: "咨询(C)",  labelEn: "Consulted",   color: "#0D9488", style: "dashed" },
  "raci-i":     { label: "知会(I)",  labelEn: "Informed",    color: "#94A3B8", style: "dotted" },
  "follows":    { label: "接续",     labelEn: "Follows",     color: "#DB2777", style: "solid" },
  "answers":    { label: "回应",     labelEn: "Answers",     color: "#059669", style: "solid" },
  "merges":     { label: "汇聚",     labelEn: "Merges",      color: "#7C3AED", style: "dashed" }
};

export const SHAPES = ["rect", "rounded", "pill", "diamond", "ellipse", "hexagon", "parallelogram", "document"];

const ID_RE = /^[A-Za-z0-9_\u4e00-\u9fff-]+$/;

export function newId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 7)}${Date.now().toString(36).slice(-3)}`;
}

export function nodeTypeDef(graph, type) {
  const custom = graph?.nodeTypes?.[type];
  if (custom) return { ...NODE_TYPES.custom, ...custom, custom: true };
  return NODE_TYPES[type] ?? { ...NODE_TYPES.custom, label: type, labelEn: type };
}

export function edgeTypeDef(graph, type) {
  const custom = graph?.edgeTypes?.[type];
  if (custom) return { ...EDGE_TYPES[""], ...custom, custom: true };
  return EDGE_TYPES[type] ?? { label: type || EDGE_TYPES[""].label, labelEn: type || "Link", color: EDGE_TYPES[""].color, style: EDGE_TYPES[""].style, custom: true };
}

/** 规范化一个图对象：补默认值、剔除未知字段、保证数组存在。不做校验。 */
export function normalizeGraph(raw) {
  const graph = raw && typeof raw === "object" ? raw : {};
  const now = new Date().toISOString();
  // 先规范化类型注册表，再处理节点/边——自定义类型的默认色/形状才能生效。
  const context = {
    nodeTypes: plainTypeMap(graph.nodeTypes),
    edgeTypes: plainTypeMap(graph.edgeTypes)
  };
  return {
    schemaVersion: 1,
    id: typeof graph.id === "string" && ID_RE.test(graph.id) ? graph.id : newId("graph"),
    name: typeof graph.name === "string" && graph.name.trim() ? graph.name.trim() : "未命名图",
    description: typeof graph.description === "string" ? graph.description : "",
    createdAt: typeof graph.createdAt === "string" ? graph.createdAt : now,
    updatedAt: typeof graph.updatedAt === "string" ? graph.updatedAt : now,
    revision: Number.isInteger(graph.revision) && graph.revision >= 0 ? graph.revision : 1,
    direction: graph.direction === "LR" ? "LR" : "TD",
    nodeTypes: context.nodeTypes,
    edgeTypes: context.edgeTypes,
    nodes: (Array.isArray(graph.nodes) ? graph.nodes : []).map((node, index) => normalizeNode(node, index, context)),
    edges: (Array.isArray(graph.edges) ? graph.edges : []).map((edge) => normalizeEdge(edge, context)),
    groups: (Array.isArray(graph.groups) ? graph.groups : []).map((group) => normalizeGroup(group)),
    notes: plainStringMap(graph.notes),
    // 非线性对话元数据（DAG 会话的 head / speakers 等）：存在即透传，未知字段不丢
    ...(graph.conversation && typeof graph.conversation === "object"
      ? { conversation: {
          mode: graph.conversation.mode !== false,
          head: typeof graph.conversation.head === "string" ? graph.conversation.head : null,
          speakers: Array.isArray(graph.conversation.speakers) ? graph.conversation.speakers.map(String) : [],
          topic: typeof graph.conversation.topic === "string" ? graph.conversation.topic : "",
          startedAt: typeof graph.conversation.startedAt === "string" ? graph.conversation.startedAt : now,
        } }
      : {})
  };
}

function plainTypeMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [key, def] of Object.entries(value)) {
    if (!def || typeof def !== "object") continue;
    out[key] = {
      label: String(def.label ?? key),
      labelEn: String(def.labelEn ?? def.label ?? key),
      shape: SHAPES.includes(def.shape) ? def.shape : "rounded",
      fill: safeColor(def.fill, "#6B7280"),
      border: safeColor(def.border, "#4B5563"),
      textColor: safeColor(def.textColor, "#0F172A"),
      icon: String(def.icon ?? "◆"),
      // 边类型专属字段（节点类型忽略即可）
      color: safeColor(def.color, "#64748B"),
      style: ["solid", "dashed", "dotted"].includes(def.style) ? def.style : "solid"
    };
  }
  return out;
}

function plainStringMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [key, text] of Object.entries(value)) {
    if (typeof text === "string") out[key] = text;
  }
  return out;
}

function normalizeNode(node, index, context = {}) {
  const raw = node && typeof node === "object" ? node : {};
  const type = typeof raw.type === "string" && raw.type ? raw.type : "process";
  const def = nodeTypeDef(context, type);
  const shape = SHAPES.includes(raw.shape) ? raw.shape : def.shape;
  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `n${index + 1}`,
    type,
    label: typeof raw.label === "string" ? raw.label : "未命名节点",
    note: typeof raw.note === "string" ? raw.note : "",
    x: Number.isFinite(raw.x) ? Math.round(raw.x) : 120 + (index % 6) * 40,
    y: Number.isFinite(raw.y) ? Math.round(raw.y) : 100 + Math.floor(index / 6) * 40,
    w: Number.isFinite(raw.w) && raw.w >= 60 ? Math.round(raw.w) : 168,
    h: Number.isFinite(raw.h) && raw.h >= 36 ? Math.round(raw.h) : 64,
    shape,
    fill: safeColor(raw.fill, def.fill),
    border: safeColor(raw.border, def.border),
    textColor: safeColor(raw.textColor, def.textColor),
    icon: typeof raw.icon === "string" ? raw.icon : def.icon,
    status: ["todo", "doing", "done", "blocked"].includes(raw.status) ? raw.status : null,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String).slice(0, 12) : []
  };
}

function normalizeEdge(edge, context = {}) {
  const raw = edge && typeof edge === "object" ? edge : {};
  const type = typeof raw.type === "string" ? raw.type : "";
  const def = edgeTypeDef(context, type);
  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : newId("e"),
    source: String(raw.source ?? ""),
    target: String(raw.target ?? ""),
    type,
    label: typeof raw.label === "string" ? raw.label : "",
    color: safeColor(raw.color, def.color),
    width: Number.isFinite(raw.width) && raw.width >= 1 && raw.width <= 8 ? Math.round(raw.width) : 2,
    style: ["solid", "dashed", "dotted"].includes(raw.style) ? raw.style : def.style,
    arrow: ["one", "both", "none"].includes(raw.arrow) ? raw.arrow : "one",
    curve: ["bezier", "ortho", "straight"].includes(raw.curve) ? raw.curve : "bezier"
  };
}

function normalizeGroup(group) {
  const raw = group && typeof group === "object" ? group : {};
  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : newId("g"),
    label: typeof raw.label === "string" ? raw.label : "分组",
    color: safeColor(raw.color, "#64748B"),
    members: Array.isArray(raw.members) ? raw.members.map(String) : []
  };
}

function safeColor(value, fallback) {
  return typeof value === "string" && /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : fallback;
}

/**
 * 结构校验。硬错误（重复 id、悬空边、自环引用缺失）阻断保存；
 * 环、孤立节点、自环以 warnings 形式放行——万用图里环可能合法（如对话互相回应）。
 */
export function validateGraph(graph) {
  const issues = [];
  const warnings = [];
  const nodeIds = new Set();
  for (const node of graph.nodes ?? []) {
    if (!node.id || typeof node.id !== "string") issues.push(`存在缺少 id 的节点（index ${graph.nodes.indexOf(node)}）`);
    else if (nodeIds.has(node.id)) issues.push(`节点 id 重复：${node.id}`);
    else nodeIds.add(node.id);
  }
  const edgeIds = new Set();
  for (const edge of graph.edges ?? []) {
    if (!edge.id || edgeIds.has(edge.id)) issues.push(`边 id 缺失或重复：${edge.id ?? "(空)"}`);
    else edgeIds.add(edge.id);
    if (!nodeIds.has(edge.source)) issues.push(`边 ${edge.id} 的起点不存在：${edge.source}`);
    if (!nodeIds.has(edge.target)) issues.push(`边 ${edge.id} 的终点不存在：${edge.target}`);
    if (edge.source === edge.target && nodeIds.has(edge.source)) warnings.push(`边 ${edge.id} 是自环（${edge.source} → ${edge.target}）`);
  }
  for (const group of graph.groups ?? []) {
    for (const member of group.members ?? []) {
      if (!nodeIds.has(member)) warnings.push(`分组 ${group.id} 引用了不存在的成员：${member}`);
    }
  }
  const cyclic = detectCycles(graph.nodes ?? [], graph.edges ?? []);
  if (cyclic.length > 0) warnings.push(`存在环：${cyclic.map((cycle) => cycle.join(" → ")).join("；")}`);
  const connected = reachability(graph.nodes ?? [], graph.edges ?? []);
  for (const orphan of connected.isolated) warnings.push(`孤立节点（无任何连线）：${orphan}`);
  return { ok: issues.length === 0, issues, warnings, cyclic: cyclic.length > 0, cycles: cyclic, isolated: connected.isolated };
}

/** DFS 找环（最多返回 5 条路径，防止输出爆炸）。 */
export function detectCycles(nodes, edges) {
  const adjacency = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    if (adjacency.has(edge.source) && adjacency.has(edge.target)) adjacency.get(edge.source).push(edge.target);
  }
  const state = new Map();
  const stack = [];
  const cycles = [];
  function visit(id) {
    if (cycles.length >= 5) return;
    state.set(id, 1);
    stack.push(id);
    for (const next of adjacency.get(id) ?? []) {
      if (cycles.length >= 5) break;
      const mark = state.get(next) ?? 0;
      if (mark === 1) {
        const from = stack.indexOf(next);
        cycles.push([...stack.slice(from === -1 ? 0 : from), next]);
      } else if (mark === 0) visit(next);
    }
    stack.pop();
    state.set(id, 2);
  }
  for (const node of nodes) {
    if ((state.get(node.id) ?? 0) === 0) visit(node.id);
    if (cycles.length >= 5) break;
  }
  return cycles;
}

function reachability(nodes, edges) {
  const adjacency = new Map(nodes.map((node) => [node.id, new Set()]));
  const undirected = new Map(nodes.map((node) => [node.id, new Set()]));
  for (const edge of edges) {
    if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) continue;
    adjacency.get(edge.source).add(edge.target);
    undirected.get(edge.source).add(edge.target);
    undirected.get(edge.target).add(edge.source);
  }
  const visited = new Set();
  for (const node of nodes) {
    if (visited.has(node.id) || undirected.get(node.id).size === 0) continue;
    const queue = [node.id];
    visited.add(node.id);
    while (queue.length) {
      const current = queue.shift();
      for (const next of undirected.get(current) ?? []) {
        if (!visited.has(next)) { visited.add(next); queue.push(next); }
      }
    }
  }
  const isolated = nodes.filter((node) => (undirected.get(node.id)?.size ?? 0) === 0).map((node) => node.id);
  return { reachedComponents: visited.size, isolated };
}
