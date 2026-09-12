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
  handoff:  { label: "移交", labelEn: "Handoff", shape: "parallelogram", fill: "#6366F1", border: "#4F46E5", textColor: "#EEF2FF", icon: "⇄" },
  toolcall: { label: "工具调用", labelEn: "Tool call", shape: "parallelogram", fill: "#64748B", border: "#475569", textColor: "#F8FAFC", icon: "⚙" },
  result:   { label: "结果", labelEn: "Result", shape: "document", fill: "#14B8A6", border: "#0D9488", textColor: "#042F2E", icon: "⛁" },
};

/** 对话语义边类型（idempotent） */
export const CONVO_EDGE_TYPES = {
  follows:    { label: "接续", labelEn: "Follows", color: "#3B82F6", style: "solid" },
  answers:    { label: "回答", labelEn: "Answers", color: "#059669", style: "solid" },
  challenges: { label: "质疑", labelEn: "Challenges", color: "#DC2626", style: "dashed" },
  refines:    { label: "细化", labelEn: "Refines", color: "#0D9488", style: "solid" },
  merges:     { label: "汇合", labelEn: "Merges", color: "#7C3AED", style: "dashed" },
  branches:   { label: "另起一支", labelEn: "Branches to", color: "#DB2777", style: "dotted" },
  "hands-off": { label: "移交控制权", labelEn: "Hands off to", color: "#6366F1", style: "solid" },
  produces:   { label: "产出", labelEn: "Produces", color: "#14B8A6", style: "solid" },
  aggregates: { label: "聚合自", labelEn: "Aggregates", color: "#8B5CF6", style: "dashed" },
};

/** 确保图带上对话所需的类型注册与元数据 */
export function ensureConversationShape(graph, { topic = null } = {}){
  // 注意：normalizeGraph 会返回**新对象**；这里把规范化结果写回原对象，
  // 保证调用方手里的引用（以及后续 appendTurn 等）看到同一份数据。
  const norm = normalizeGraph(graph);
  const g = graph;
  // 关键：按 id 复用**原有对象**，避免每次调用都替换实例导致调用方引用变陈旧
  const prevNodes = new Map((Array.isArray(g.nodes) ? g.nodes : []).map((n)=> [n?.id, n]));
  const prevEdges = new Map((Array.isArray(g.edges) ? g.edges : []).map((e)=> [e?.id, e]));
  norm.nodes = norm.nodes.map((nn)=> prevNodes.get(nn.id) ? Object.assign(prevNodes.get(nn.id), nn) : nn);
  norm.edges = norm.edges.map((ne)=> prevEdges.get(ne.id) ? Object.assign(prevEdges.get(ne.id), ne) : ne);
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
  // agent 模式扩展：角色注册表 + 运行策略（拓扑 / 轮次 / 聚合规则）
  if (!Array.isArray(g.conversation.agents)) g.conversation.agents = [];
  if (!g.conversation.runtime || typeof g.conversation.runtime !== "object"){
    g.conversation.runtime = { topology: "custom", turn: 0, maxTurns: 24, awaiting: [], budget: null };
  }
  if (!Array.isArray(g.conversation.runtime.awaiting)) g.conversation.runtime.awaiting = [];
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
  const stored = normalizeGraph({ nodes: [node], edges: [], groups: [] }).nodes[0];
  g.nodes.push(stored);               // 入库的是规范化实例
  if (parentNode){
    g.edges.push(normalizeGraph({ nodes: [], edges: [{ source: parentNode.id, target: node.id, type: edgeType }], groups: [] }).edges[0]);
  }
  if (speaker && !g.conversation.speakers.includes(speaker)) g.conversation.speakers.push(speaker);
  g.conversation.head = stored.id;    // 说话即把 head 移到新发言
  return stored;                      // 必须返回入库实例：调用方还会往它写 tags / note
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
  const stored = normalizeGraph({ nodes: [node], edges: [], groups: [] }).nodes[0];
  g.nodes.push(stored);
  for (const s of sources){
    g.edges.push(normalizeGraph({ nodes: [], edges: [{ source: s, target: node.id, type: "merges" }], groups: [] }).edges[0]);
  }
  g.conversation.head = stored.id;
  if (text) stored.note = String(text).split("\n")[0].slice(0, 120);
  return stored;
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
    // label 是摘要、note 是正文：两者都有时都给出，agent 上下文更完整
    const label = String(n.label ?? "").trim();
    const note = String(n.note ?? "").trim();
    const body = note && label && note !== label ? `${label} — ${note}` : (note || label);
    const st = n.status ? `[${n.status}]` : "";
    if (format === "md") lines.push(`${"  ".repeat(Math.max(0, i - 1))}- **${who}**${st} (${n.type}) — ${body}`);
    else lines.push(`${who}${st}: ${body}`);
  });
  return lines.join("\n");
}

/* ================= Agent 侧能力（多智能体非线性对话） =================
   设计对照：LangGraph 的 handoff/Send、AutoGen 的辩论+聚合、CrewAI 的角色分工。
   OmniFlow 的定位是「多智能体会话的状态与拓扑账本」：
     · head      = 执行游标（下一次该谁产出）
     · 分支      = 并行探索 / 候选方案
     · 汇合      = 聚合（投票 / 加权 / 仲裁）
     · pathTo    = 该 agent 应看到的上下文（只含本支历史，不污染其它分支）
*/

/** 节点上的 agent 元信息：agent:<名> · status:<态> · round:<n> · handoff:<目标agent> */
export function turnMeta(node){
  const tags = (node?.tags ?? []).map(String);
  const pick = (prefix)=> { const t = tags.find((x)=> x.startsWith(prefix)); return t ? t.slice(prefix.length) : null; };
  return {
    agent: pick("agent:") ?? pick("speaker:"),
    status: pick("status:") ?? node?.status ?? null,
    round: Number(pick("round:") ?? 0) || null,
    handoffTo: pick("handoff:"),
    role: pick("role:"),
  };
}
function tagSet(node, prefix, value){
  const tags = (node.tags ?? []).map(String).filter((t)=> !t.startsWith(prefix));
  if (value !== null && value !== undefined && value !== "") tags.push(`${prefix}${value}`);
  node.tags = tags;
  return node;
}

/** 注册/更新一个 agent（角色、模型、职责、可用工具） */
export function registerAgent(g, { name, role = "worker", model = "", goal = "", tools = [] }){
  ensureConversationShape(g);
  const existing = g.conversation.agents.find((a)=> a.name === name);
  const entry = { name, role, model, goal, tools: tools ?? [] };
  if (existing) Object.assign(existing, entry);
  else g.conversation.agents.push(entry);
  if (!g.conversation.speakers.includes(name)) g.conversation.speakers.push(name);
  return entry;
}

/** 记录一次 agent 产出（含状态 / 轮次 / 移交目标） */
export function recordTurn(g, { agent, text = "", type = "turn", status = "done", round = null, handoffTo = null, parentId = null, edgeType = "follows", role = null }){
  ensureConversationShape(g);
  const rt = g.conversation.runtime;
  const turnNo = (round ?? (rt.turn + 1));
  const node = appendTurn(g, { text, speaker: agent, type, parentId, edgeType });
  node.status = status === "pending" || status === "running" || status === "failed" || status === "waiting-human" ? status : (status === "failed" ? "failed" : "done");
  tagSet(node, "agent:", agent);
  tagSet(node, "status:", status);
  tagSet(node, "round:", turnNo);
  if (role) tagSet(node, "role:", role);
  if (handoffTo) tagSet(node, "handoff:", handoffTo);
  rt.turn = Math.max(rt.turn, turnNo);
  if (status === "running" || status === "pending" || status === "waiting-human"){
    if (!rt.awaiting.includes(node.id)) rt.awaiting.push(node.id);
  } else {
    rt.awaiting = rt.awaiting.filter((id)=> id !== node.id);
  }
  return node;
}

/** 完成一个待办分支 */
export function resolveTurn(g, nodeId, { status = "done", text = null } = {}){
  ensureConversationShape(g);
  const node = g.nodes.find((n)=> n.id === nodeId);
  if (!node) throw new Error(`节点不存在：${nodeId}`);
  node.status = status;
  tagSet(node, "status:", status);
  if (text) node.note = String(text).split("\n")[0].slice(0, 120);
  g.conversation.runtime.awaiting = g.conversation.runtime.awaiting.filter((id)=> id !== nodeId);
  return node;
}

/** 待办分支（正在运行 / 等待人工 / 待产出） */
export function pendingTurns(g){
  ensureConversationShape(g);
  const awaiting = new Set(g.conversation.runtime.awaiting);
  return g.nodes
    .filter((n)=> awaiting.has(n.id) || n.status === "running" || n.status === "pending" || n.status === "waiting-human")
    .map((n)=> ({ id: n.id, label: n.label, agent: turnMeta(n).agent, status: n.status, round: turnMeta(n).round }));
}

/** 调度器：下一步该谁产出 + 该装配什么上下文
 *  规则（可被 handoff 覆盖）：
 *   1) 若 head 的 agent 显式 handoff 给某人 → 该人
 *   2) supervisor 拓扑：worker 完成后回到 supervisor
 *   3) debate 拓扑：按 agents 顺序轮转
 *   4) 否则：head 的下一个未完成分支；再否则回到 head 的产出者
 */
export function nextSpeaker(g){
  ensureConversationShape(g);
  const rt = g.conversation.runtime;
  const head = g.conversation.head;
  const headNode = head ? g.nodes.find((n)=> n.id === head) : null;
  const meta = headNode ? turnMeta(headNode) : { agent: null, handoffTo: null };
  const agents = g.conversation.agents;
  const byRole = (r)=> agents.find((a)=> a.role === r);

  let agent = null, reason = "";
  const headStatus = headNode?.status ?? null;
  if (headStatus === "pending" || headStatus === "running"){ agent = meta.agent; reason = "该分支尚未完成 → 由其产出者继续"; }
  else if (meta.handoffTo){ agent = meta.handoffTo; reason = "显式 handoff"; }
  else if (headNode && (headNode.type === "decision" || (headNode.tags ?? []).some((t)=> String(t) === "role:aggregator"))){
    const sup = byRole("supervisor") ?? byRole("lead");
    agent = sup?.name ?? "human";
    reason = "聚合/决策已完成 → 交回协调者或人工";
  }
  else if (rt.topology === "supervisor"){
    const sup = byRole("supervisor");
    const speakerDef = agents.find((a)=> a.name === meta.agent);
    const speakerRole = meta.role ?? speakerDef?.role ?? null;
    if (speakerRole === "worker" && sup){ agent = sup.name; reason = "worker 完成 → 回到 supervisor"; }
    else { const w = byRole("worker"); agent = (w ?? agents[0])?.name ?? null; reason = "supervisor 派发 → worker"; }
  }
  else if (rt.topology === "debate" || rt.topology === "map-reduce"){
    const order = agents.filter((a)=> a.role !== "judge" && a.role !== "aggregator");
    const idx = order.findIndex((a)=> a.name === meta.agent);
    agent = (order[(idx + 1) % Math.max(1, order.length)] ?? order[0])?.name ?? null;
    reason = `${rt.topology} 轮转`;
  }
  else if (rt.topology === "hierarchical"){
    const lead = byRole("lead") ?? byRole("supervisor");
    const speakerDef2 = agents.find((a)=> a.name === meta.agent);
    const speakerRole2 = meta.role ?? speakerDef2?.role ?? null;
    agent = (speakerRole2 === "worker" ? lead : byRole("worker"))?.name ?? null;
    reason = "层级：worker ⇄ lead";
  }
  if (!agent){
    const kids = g.edges.filter((e)=> e.source === head).map((e)=> e.target);
    const openKid = kids.map((id)=> g.nodes.find((n)=> n.id === id)).find((n)=> n && turnMeta(n).status !== "done");
    agent = openKid ? turnMeta(openKid).agent : (meta.agent ?? null);
    reason = openKid ? "存在未完成分支" : "沿用上一次产出者";
  }
  const contextNode = head;
  return {
    nextSpeaker: agent,
    reason,
    round: rt.turn + 1,
    topology: rt.topology,
    head,
    awaiting: pendingTurns(g).map((p)=> p.id),
    context: contextNode ? pathTo(g, contextNode) : [],
    contextText: contextNode ? linearize(g, contextNode, { format: "txt" }) : "",
  };
}

/** 聚合/投票：把多条分支汇成一个 decision 节点，按策略给出结论 */
export function aggregateBranches(g, { sources, strategy = "majority", label = null, winner = null, text = "", agent = "judge" }){
  ensureConversationShape(g);
  // 容错：若传入的是分支占位节点（还有下级产出），自动下沉到该支末端
  const tipOf = (id)=>{
    let cur = id, guard = 0;
    while (guard++ < 50){
      const kids = g.edges.filter((e)=> e.source === cur).map((e)=> e.target);
      if (!kids.length) break;
      cur = kids[kids.length - 1];
    }
    return cur;
  };
  const resolved = [...new Set(sources.map(tipOf))];
  const nodes = resolved.map((id)=> g.nodes.find((n)=> n.id === id)).filter(Boolean);
  if (nodes.length < 2) throw new Error("聚合至少需要 2 条分支");
  const votes = new Map();
  for (const n of nodes){
    const key = String(n.note || n.label || "").trim().slice(0, 120);
    votes.set(key, (votes.get(key) ?? 0) + 1);
  }
  const tally = [...votes.entries()].map(([value, count])=> ({ value, count })).sort((a, b)=> b.count - a.count);
  let chosen = winner;
  if (!chosen){
    if (strategy === "majority") chosen = tally[0]?.value ?? "";
    else chosen = text || tally[0]?.value || "";
  }
  const distinct = tally.length;
  const node = {
    id: newId("d"),
    type: "decision",
    label: String(label ?? (strategy === "majority" ? `多数票：${tally[0]?.count ?? 0}/${nodes.length}` : `聚合（${strategy}）`)).slice(0, 80),
    note: String(chosen).slice(0, 120),
    x: Math.round(nodes.reduce((s, n)=> s + n.x, 0) / nodes.length) + 220,
    y: Math.round(nodes.reduce((s, n)=> s + n.y, 0) / nodes.length) + 80,
    w: 220, h: 64,
    status: "done",
    tags: [`agent:${agent}`, "role:aggregator", "status:done", `strategy:${strategy}`],
  };
  const stored = normalizeGraph({ nodes: [node], edges: [], groups: [] }).nodes[0];
  g.nodes.push(stored);
  for (const src of resolved){
    g.edges.push(normalizeGraph({ nodes: [], edges: [{ source: src, target: stored.id, type: "aggregates" }], groups: [] }).edges[0]);
  }
  g.conversation.head = stored.id;
  return { node: stored, strategy, tally, distinct, consensus: nodes.length ? (tally[0]?.count ?? 0) / nodes.length : 0, chosen };
}

/** 拓扑脚手架：一次生成多智能体会话骨架（并行分支 + 聚合位） */
export function scaffoldTopology(g, { topology = "supervisor", agents = [], topic = null, maxTurns = 24 } = {}){
  ensureConversationShape(g, { topic: topic ?? g.name });
  const rt = g.conversation.runtime;
  rt.topology = topology;
  rt.maxTurns = maxTurns;
  for (const a of agents) registerAgent(g, a);
  // 根：话题节点（人类/系统的输入）
  const root = appendTurn(g, { text: topic ?? g.name ?? "任务", speaker: "human", type: "topic" });
  const created = { root: root.id, branches: [], agents: g.conversation.agents.map((a)=> a.name) };
  const layout = { x: 0, y: 0 };
  const addBranch = (agentName, label, role) => {
    const node = recordTurn(g, { agent: agentName, text: label, type: "turn", status: "pending", parentId: root.id, edgeType: "hands-off", role });
    node.x = root.x + 300;
    node.y = root.y + layout.y;
    layout.y += 130;
    created.branches.push(node.id);
    return node;
  };
  const roleAgents = (r)=> agents.filter((a)=> (a.role ?? "worker") === r);
  if (topology === "supervisor" || topology === "hierarchical"){
    for (const a of (roleAgents("worker").length ? roleAgents("worker") : agents.filter((a)=> a.role !== "supervisor"))) addBranch(a.name, `【待办】${a.goal || a.name}`, a.role ?? "worker");
  } else if (topology === "debate" || topology === "map-reduce" || topology === "network"){
    for (const a of agents.filter((a)=> a.role !== "judge" && a.role !== "aggregator")) addBranch(a.name, `【待办】${a.goal || a.name}`, a.role ?? "solver");
  } else {
    addBranch(agents[0]?.name ?? "agent", "【待办】首轮产出", "worker");
  }
  return created;
}
