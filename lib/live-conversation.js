/**
 * 实时对话记录（Live conversation recording）
 *
 * 用户说「开启非线性对话」后，agent 与会话双方**每一轮**都自动落到同一张 DAG 里，
 * 用户无需再提。为把每轮成本压到**一次调用**，这里维护一个「当前活动会话」指针文件：
 *
 *   <root>/live-conversation.json  { id, topic, on, startedAt, turns }
 *
 * - start: 建/选一张对话图，写入指针，打开记录开关
 * - log:   读取指针 → 追加一轮（role=user|agent），无需传 id
 * - stop:  关闭开关（图保留，随时可回看/续记）
 *
 * 没有这个指针，agent 每轮都得先查 id，既慢又易错——这是「自动记录」能落地的关键。
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { normalizeGraph } from "./graph-core.js";
import { ensureConversationShape, appendTurn, setHead, pathTo, conversationOverview } from "./conversation.js";
import { loadGraph, saveGraph, makeGraphId, readJsonIfPresent } from "./graph-service.mjs";
import { moveGraph } from "./vault.js";

const POINTER = "live-conversation.json";

async function readPointer(root){
  return await readJsonIfPresent(join(root, POINTER));
}
async function writePointer(root, data){
  await mkdir(root, { recursive: true });
  await writeFile(join(root, POINTER), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/** 开启记录：已有活动会话则直接续记；否则新建一张以 topic 命名的对话图 */
export async function liveStart(root, { topic = null, folder = null, lang = "zh", reuse = true } = {}){
  const existing = reuse ? await readPointer(root) : null;
  if (existing?.id){
    try {
      const { graph } = await loadGraph(root, existing.id);
      ensureConversationShape(graph);
      graph.conversation.live = { on: true, startedAt: graph.conversation.live?.startedAt ?? new Date().toISOString() };
      await saveGraph(join(root, "graphs", existing.id), graph);
      await writePointer(root, { ...existing, on: true, resumedAt: new Date().toISOString() });
      return { id: existing.id, name: graph.name, resumed: true, topic: graph.conversation.topic ?? "", turns: conversationOverview(graph).total };
    } catch { /* 指针失效 → 新建 */ }
  }
  const name = topic || `对话记录 ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
  const graph = ensureConversationShape(normalizeGraph({ name, nodes: [], edges: [], groups: [], notes: {} }), { topic: name });
  graph.id = makeGraphId(graph.name);
  graph.conversation.live = { on: true, startedAt: new Date().toISOString() };
  graph.conversation.topic = name;
  appendTurn(graph, { text: `话题：${name}`, speaker: "system", type: "topic" });
  await saveGraph(join(root, "graphs", graph.id), graph);
  if (folder){ try { await moveGraph(root, graph.id, folder); } catch { /* 归档失败不阻断 */ } }
  await writePointer(root, { id: graph.id, name: graph.name, topic: name, on: true, startedAt: graph.conversation.live.startedAt, turns: 1 });
  return { id: graph.id, name: graph.name, resumed: false, topic: name, turns: 1 };
}

/** 记录一轮：role = user | agent | system。branchFrom 可显式从某节点分叉（非线性） */
export async function liveLog(root, { role = "agent", text = "", name = null, from = null, type = null, status = "done", handoffTo = null, id = null } = {}){
  const pointer = await readPointer(root);
  const targetId = id ?? pointer?.id;
  if (!targetId) throw new Error("no active session: call live start first (or say 开启非线性对话)");
  if (pointer && pointer.on === false && !id) throw new Error("recording is stopped: call live start to resume");
  const { graph } = await loadGraph(root, targetId);
  ensureConversationShape(graph);
  const speaker = name || (role === "user" ? "user" : role === "system" ? "system" : "agent");
  const turnType = type || (role === "user" ? "question" : role === "system" ? "note" : "answer");
  const node = appendTurn(graph, { text, speaker, type: turnType, parentId: from, edgeType: role === "user" ? "follows" : "answers" });
  node.status = status;
  const tags = (node.tags ?? []).filter((t)=> !String(t).startsWith("role:"));
  tags.push(`role:${role}`);
  node.tags = tags;
  if (handoffTo){
    node.tags = node.tags.filter((t)=> !String(t).startsWith("handoff:"));
    node.tags.push(`handoff:${handoffTo}`);
  }
  graph.notes = graph.notes ?? {};
  graph.notes[node.id] = String(text ?? "").split("\n")[0].slice(0, 160);
  graph.revision += 1;
  await saveGraph(join(root, "graphs", targetId), graph);
  if (pointer) await writePointer(root, { ...pointer, turns: (pointer.turns ?? 0) + 1, lastAt: new Date().toISOString() });
  const ov = conversationOverview(graph);
  return { id: targetId, nodeId: node.id, role, speaker, turn: node.tags.find((t)=> String(t).startsWith("turn:")), head: ov.head, mainline: ov.mainline.length, openThreads: ov.openThreads.length, total: ov.total };
}

/** 停止记录（图保留） */
export async function liveStop(root, { id = null } = {}){
  const pointer = await readPointer(root);
  const targetId = id ?? pointer?.id;
  if (!targetId) return { ok: true, stopped: false, reason: "没有活动会话" };
  try {
    const { graph } = await loadGraph(root, targetId);
    ensureConversationShape(graph);
    graph.conversation.live = { ...(graph.conversation.live ?? {}), on: false, stoppedAt: new Date().toISOString() };
    await saveGraph(join(root, "graphs", targetId), graph);
  } catch { /* 图不在也照常关开关 */ }
  await writePointer(root, { ...(pointer ?? {}), id: targetId, on: false, stoppedAt: new Date().toISOString() });
  return { ok: true, stopped: true, id: targetId };
}

/** 当前状态：是否在记录、记了多少轮、当前点头 */
export async function liveStatus(root){
  const pointer = await readPointer(root);
  if (!pointer?.id) return { on: false, turns: 0 };
  try {
    const { graph } = await loadGraph(root, pointer.id);
    ensureConversationShape(graph);
    const ov = conversationOverview(graph);
    return { on: pointer.on !== false, id: pointer.id, name: graph.name, topic: graph.conversation.topic ?? "", turns: ov.total, head: ov.head, mainline: ov.mainline.length, openThreads: ov.openThreads.length, startedAt: pointer.startedAt ?? null };
  } catch {
    return { on: false, id: pointer.id, broken: true };
  }
}
