/**
 * 非线性对话（Non-linear conversation）核心模块
 *
 * 模型：对话是一张 **DAG**（有向无环图），每个节点是一次发言（turn）。
 *   - `parentId` 语义由边承载（edge.type = follows/answers/challenges/refines）
 *   - 一个节点有多个出边 = 分支点（fork）；多条边汇入 = 合并点（merge）
 *   - `graph.conversation.head` = 当前"继续说话"的位置（可随时切换 → 非线性）
 *   - `mainline` = 根到 head 的活跃路径（只有它进入上下文）
 *
 * 设计依据：Ably ai-transport（msgId/parentId/forkOf）、gar、TreeGPT（messageContext 路径）、
 * CMV 论文（DAG + branch 原语）四者一致的做法。
 *
 * 全部操作都落在现有 graph.json 上，因此**天然兼容**：
 * Studio 画布、分组、搜索、导出、MCP、分析、备份/自愈等既有能力零改动可用。
 */
import { normalizeGraph, newId } from "./graph-core.js";

/** 对话专用节点类型注册（幂等；已有的不覆盖） */
export const CONVO_NODE_TYPES = {
  topic:    { label: "话题", labelEn: "Topic", shape: "ellipse", fill: "#EC4899", border: "#DB2777", textColor: "#500724", icon: "💬" },
  turn:     { label: "发言", labelEn: "Turn", shape: "rounded", fill: "#3B82F6", border: "#2563EB", textColor: "#0B1220", icon: "🗣" },
  question: { label: "提问", labelEn: "Question", shape: "rounded", fill: "#F59E0B", border: "#D97706", textColor: "#451A03", icon: "？" },
  answer:   { label: "回答", labelEn: "Answer", shape: "rounded", fill: "#10B981", border: "#059669", textColor: "#022C22", icon: "!" },
  idea:     { label: "想法", labelEn: "Idea", shape: "ellipse", fill: "#FACC15", border: "#CA8A04", textColor: "#422006", icon: "💡" },
  merge:    { label: "汇合", labelEn: "Merge", shape: "hexagon", fill: "#8B5CF6", border: "#7C3AED", textColor: "#F5F3FF", icon: "⋈" },
  decision: { label: "结论", labelEn: "Decision", shape: "hexagon", fill: "#0EA5E9", border: "#0284C7", textColor: "#082F49", icon: "✔" },
};

/** 对话语义边类型（idempotent） */
export const CONVO_EDGE_TYPES = {
  follows:    { label: "接续", labelEn: "Follows", color: "#3B82F6", style: "solid" },
  answers:    { label: "回答", labelEn: "Answers", color: "#059669", style: "solid" },
  challenges: { label: "质疑", labelEn: "Challenges", color: "#DC2626", style: "dashed" },
  refines:    { label: "细化", labelEn: "Refines", color: "#0D9488", style: "solid" },
  merges:     { label: "汇合", labelEn: "Merges", color: "#7C3AED", style: "dashed" },
  branches:   { label: "另起一支", labelEn: "Branches to", color: "#DB2777", style: "dotted" },
};

/** 确保图带上对话所需的类型注册与元数据 */
export function ensureConversationShape(graph, { topic = null } = {}){
  // 注意：normalizeGraph 会返回**新对象**；这里把规范化结果写回原对象，
  // 保证调用方手里的引用（以及后续 appendTurn 等）看到同一份数据。
  const norm = normalizeGraph(graph);
  const g = graph;
  g.nodes = norm.nodes; g.edges = norm.edges; g.groups = norm.groups; g.notes = norm.notes;
  g.nodeTypes = { ...norm.nodeTypes };
  for (const [k, v] of Object.entries(CONVO_NODE_TYPES)) if (!g.nodeTypes[k]) g.nodeTypes[k] = v;
  g.edgeTypes = { ...g.edgeTypes };
  for (const [k, v] of Object.entries(CONVO_EDGE_TYPES)) if (!g.edgeTypes[k]) g.edgeTypes[k] = v;
  if (!g.conversation || typeof g.conversation !== "object"){
    g.conversation = { mode: true, head: null, speakers: [], startedAt: new Date().toISOString(), topic: topic ?? g.name ?? "" };
  } else {
    g.conversation.mode = true;
  }
  if (!Array.isArray(g.conversation.speakers)) g.conversation.speakers = [];
  return g;
}

/* ---------------- 图内索引与遍历 ---------------- */

const childEdges = (g, id)=> g.edges.filter((e)=> e.source === id);
const parentEdges = (g, id)=> g.edges.filter((e)=> e.target === id);
const nodeOf = (g, id)=> g.nodes.find((n)=> n.id === id) ?? null;

/** 根节点（无入边的节点；多个时取最早的） */
export function rootsOf(g){
  const targets = new Set(g.edges.map((e)=> e.target));
  return g.nodes.filter((n)=> !targets.has(n.id));
}

/** 叶子 = 可继续的开放分支 */
export function leavesOf(g){
  const sources = new Set(g.edges.map((e)=> e.source));
  return g.nodes.filter((n)=> !sources.has(n.id));
}

/** 从根到某节点的路径（DAG 中的最长/唯一主路径；多父时取最长祖先链） */
export function pathTo(g, nodeId){
  if (!nodeOf(g, nodeId)) return [];
  const memo = new Map();
  const best = (id, guard = new Set())=>{
    if (guard.has(id)) return [id];           // 环保护
    if (memo.has(id)) return memo.get(id);
    guard.add(id);
    const parents = parentEdges(g, id).map((e)=> e.source);
    let result = [id];
    if (parents.length){
      let longest = [];
      for (const p of parents){
        const cand = best(p, guard);
        if (cand.length > longest.length) longest = cand;
      }
      result = [...longest, id];
    }
    guard.delete(id);
    memo.set(id, result);
    return result;
  };
  return best(nodeId);
}

/** 分支点：出边 > 1 的节点 */
export function forksOf(g){
  return g.nodes
    .map((n)=> ({ node: n, children: childEdges(g, n.id).map((e)=> e.target) }))
    .filter((x)=> x.children.length > 1);
}

/** 兄弟：同一父节点的其他子节点 */
export function siblingsOf(g, id){
  const parents = parentEdges(g, id).map((e)=> e.source);
  if (!parents.length) return [];
  const sib = new Set();
  for (const p of parents) for (const e of childEdges(g, p)) if (e.target !== id) sib.add(e.target);
  return [...sib];
}

/** 会话总览：规模、开放分支、分叉点、最深处 */
export function conversationOverview(g){
  const roots = rootsOf(g).map((n)=> n.id);
  const leaves = leavesOf(g).map((n)=> n.id);
  const forks = forksOf(g).map((x)=> ({ id: x.node.id, label: x.node.label, children: x.children }));
  let deepest = { id: null, depth: 0 };
  for (const n of g.nodes){
    const depth = pathTo(g, n.id).length;
    if (depth > deepest.depth) deepest = { id: n.id, depth };
  }
  return {
    total: g.nodes.length,
    edges: g.edges.length,
    roots,
    head: g.conversation?.head ?? null,
    mainline: g.conversation?.head ? pathTo(g, g.conversation.head) : [],
    openThreads: leaves.map((id)=> ({ id, label: nodeOf(g, id)?.label ?? id, turn: nodeOf(g, id)?.tags?.find((t)=> String(t).startsWith("turn:")) ?? null })),
    forks,
    deepest,
    speakers: g.conversation?.speakers ?? [],
  };
}

/* ---------------- 变更原语 ---------------- */

/** 追加一次发言：默认接在 head 之后（分支 = 指定 parentId 或先移动 head） */
export function appendTurn(g, { text, speaker = "user", type = "turn", parentId = null, edgeType = "follows", x = null, y = null }){
  const parent = parentId ?? g.conversation?.head ?? null;
  const parentNode = parent ? nodeOf(g, parent) : null;
  const depth = parentNode ? pathTo(g, parentNode.id).length : 1;
  const turnNo = g.nodes.filter((n)=> n.type === "turn" || n.type === "question" || n.type === "answer" || n.type === "idea").length + 1;
  const firstLine = String(text ?? "").split("\n").find((l)=> l.trim()) ?? "(空)";
  const node = {
    id: newId("t"),
    type,
    label: firstLine.trim().slice(0, 80),
    note: "",
    x: x ?? (parentNode ? parentNode.x + 260 : 80),
    y: y ?? (parentNode ? parentNode.y + (childEdges(g, parentNode.id).length) * 120 : 80),
    w: 200,
    h: 64,
    tags: [`speaker:${speaker}`, `turn:${turnNo}`],
  };
  g.nodes.push(normalizeGraph({ nodes: [node], edges: [], groups: [] }).nodes[0]);
  if (parentNode){
    g.edges.push(normalizeGraph({ nodes: [], edges: [{ source: parentNode.id, target: node.id, type: edgeType }], groups: [] }).edges[0]);
  }
  if (speaker && !g.conversation.speakers.includes(speaker)) g.conversation.speakers.push(speaker);
  g.conversation.head = node.id;      // 说话即把 head 移到新发言
  return node;
}

/** 移动 head（在非线性对话里"跳回某一支继续"） */
export function setHead(g, nodeId){
  if (!nodeOf(g, nodeId)) throw new Error(`节点不存在：${nodeId}`);
  g.conversation.head = nodeId;
  return g.conversation.head;
}

/** 合并多支：新建 merge 节点，从各支汇入 */
export function mergeBranches(g, { sources, label = "汇合", text = "", speaker = "user", x = null, y = null }){
  const nodes = sources.map((id)=> nodeOf(g, id)).filter(Boolean);
  if (nodes.length < 2) throw new Error("合并至少需要 2 个来源分支");
  const avg = (k)=> Math.round(nodes.reduce((s, n)=> s + n[k], 0) / nodes.length);
  const node = {
    id: newId("m"),
    type: "merge",
    label: String(label).slice(0, 80),
    note: "",
    x: x ?? avg("x") + 200,
    y: y ?? avg("y") + 120,
    w: 200, h: 64,
    tags: [`speaker:${speaker}`],
  };
  g.nodes.push(normalizeGraph({ nodes: [node], edges: [], groups: [] }).nodes[0]);
  for (const s of sources){
    g.edges.push(normalizeGraph({ nodes: [], edges: [{ source: s, target: node.id, type: "merges" }], groups: [] }).edges[0]);
  }
  g.conversation.head = node.id;
  if (text) node.note = String(text).split("\n")[0].slice(0, 120);
  return node;
}

/** 从若干"分支根"生成对话骨架（用于把一条线性记录转成 DAG 的起点） */
export function seedFromTranscript(g, { text, speaker = "user", edgeType = "follows" }){
  const lines = String(text ?? "").split(/\n{2,}/).map((l)=> l.trim()).filter(Boolean);
  let last = g.conversation?.head ?? null;
  const created = [];
  for (const line of lines){
    const node = appendTurn(g, { text: line, speaker, parentId: last, edgeType });
    created.push(node.id);
    last = node.id;
  }
  return created;
}

/** 线性化某条路径为可读文本 / Markdown */
export function linearize(g, nodeId = null, { format = "md" } = {}){
  const target = nodeId ?? g.conversation?.head;
  if (!target) return "";
  const path = pathTo(g, target);
  const lines = [];
  path.forEach((id, i)=>{
    const n = nodeOf(g, id);
    if (!n) return;
    const speak = (n.tags ?? []).map(String).find((t)=> t.startsWith("speaker:"));
    const who = speak ? speak.slice(8) : n.type;
    const body = n.note || n.label || "";
    if (format === "md") lines.push(`${"  ".repeat(Math.max(0, i - 1))}- **${who}** (${n.type}) — ${body}`);
    else lines.push(`${who}: ${body}`);
  });
  return lines.join("\n");
}
