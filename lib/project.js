/**
 * 图投影（Projection）—— 把一张大图按结构拆成多层视图
 *
 * 对照包内 build_omniflow.py：
 *   · 章节总览图：节点 = 小节，边 = 小节之间的**聚合依赖**（权重 = 依赖条数）
 *   · 小节图：节点 = 本节卡片 + **幽灵卡**（外部依赖的替身），
 *             边保留「节内依赖 / 跨节依赖 / 跨书依据」——切分后联系不丢
 *
 * 幽灵卡机制：外部邻居不在本图里，就用一个只读替身节点顶上，
 * 并用 `open:<源图>` / `ghost:<源节点>` 标签记录回流地址，双击即可跳回原图。
 */
import { normalizeGraph, newId } from "./graph-core.js";
import { readCrosslinks, crosslinksForGraph } from "./crosslinks.js";
import { loadGraph, saveGraph, makeGraphId } from "./graph-service.mjs";
import { moveGraph } from "./vault.js";
import { join } from "node:path";

const GHOST_TYPE = { label: "外部", labelEn: "External", shape: "dashed", fill: "#33415540", border: "#64748B", textColor: "#94A3B8", icon: "⇱" };

/** 节点的节归属：sec: 标签优先，其次所属分组 */
export function sectionOf(graph, node){
  const tag = (node.tags ?? []).map(String).find((t)=> t.startsWith("sec:"));
  if (tag) return tag.slice(4);
  const g = (graph.groups ?? []).find((x)=> (x.members ?? []).includes(node.id));
  return g ? g.label : "（未分节）";
}

/** 章节总览：节点 = 小节，边 = 聚合依赖（含跨图依据） */
export async function projectOverview(root, graphId, { name = null, folder = null } = {}){
  const { graph } = await loadGraph(root, graphId);
  const sections = new Map();          // section → [nodeId]
  for (const n of graph.nodes){
    const s = sectionOf(graph, n);
    if (!sections.has(s)) sections.set(s, []);
    sections.get(s).push(n.id);
  }
  const nodeSection = new Map();
  for (const [s, ids] of sections) for (const id of ids) nodeSection.set(id, s);

  // 聚合节间依赖
  const agg = new Map();
  for (const e of graph.edges){
    const a = nodeSection.get(e.source), b = nodeSection.get(e.target);
    if (!a || !b || a === b) continue;
    const key = `${a}\u0000${b}`;
    const cur = agg.get(key) ?? { from: a, to: b, count: 0, samples: [] };
    cur.count++;
    if (cur.samples.length < 5) cur.samples.push(`${e.source}→${e.target}`);
    agg.set(key, cur);
  }
  // 跨书链接也计入（作为跨图依据）
  const xlinks = await crosslinksForGraph(root, graphId);
  const crossBySection = new Map();
  for (const x of xlinks){
    const s = nodeSection.get(x.self.node);
    if (!s) continue;
    const key = `${x.view === "uses" ? x.other.graph : s}\u0000${x.view === "uses" ? s : x.other.graph}`;
    crossBySection.set(key, (crossBySection.get(key) ?? 0) + 1);
  }

  const out = normalizeGraph({ name: name ?? `${graph.name} · 章节总览`, nodes: [], edges: [], groups: [], notes: {} });
  out.nodeTypes = { ...out.nodeTypes, section: { label: "小节", labelEn: "Section", shape: "hexagon", fill: "#0EA5E9", border: "#0284C7", textColor: "#082F49", icon: "§" }, ghost: GHOST_TYPE };
  const secIds = new Map();
  const cols = 4, colW = 300, rowH = 130;
  [...sections.entries()].forEach(([sec, ids], i)=>{
    const id = newId("s");
    secIds.set(sec, id);
    const inter = [...agg.values()].filter((x)=> x.from === sec || x.to === sec).reduce((s2, x)=> s2 + x.count, 0);
    out.nodes.push(normalizeGraph({ nodes: [{
      id, type: "section", label: sec.slice(0, 60),
      note: `${ids.length} 张卡片 · ${inter} 条对外依赖`,
      x: 80 + (i % cols) * colW, y: 80 + Math.floor(i / cols) * rowH,
      w: 268, h: 88, tags: [`sec:${sec.slice(0, 40)}`, `cards:${ids.length}`, `src:${graphId}`],
    }], edges: [], groups: [] }).nodes[0]);
    out.notes[id] = `${sec}\n\n- 卡片 ${ids.length} 张\n- 对外依赖 ${inter} 条\n- 源图 \`${graphId}\`\n\n卡片：${ids.slice(0, 40).join(", ")}`;
  });
  for (const x of agg.values()){
    out.edges.push(normalizeGraph({ nodes: [], edges: [{ source: secIds.get(x.from), target: secIds.get(x.to), type: "depends-on", label: `×${x.count}`, weight: x.count }], groups: [] }).edges[0]);
  }
  const verdict = { sections: sections.size, edges: out.edges.length, nodes: out.nodes.length };
  return { graph: out, stats: verdict, crossLinks: xlinks.length, crossBySection };
}

/**
 * 小节图：每个小节一张图；本节卡片 + 幽灵卡（跨节/跨书的外部依赖替身）
 * 幽灵卡带 `open:<源图>` + `ghost:<源节点>`，双击可跳回。
 */
export async function projectSections(root, graphId, { minCards = 2, only = null, folder = null, lang = "zh" } = {}){
  const { graph } = await loadGraph(root, graphId);
  const sections = new Map();
  for (const n of graph.nodes){
    const s = sectionOf(graph, n);
    if (only && s !== only) continue;
    if (!sections.has(s)) sections.set(s, []);
    sections.get(s).push(n);
  }
  const nodeSection = new Map();
  for (const [s, list] of sections) for (const n of list) nodeSection.set(n.id, s);
  const xlinks = await crosslinkIndexSafe(root, graphId);

  const created = [];
  for (const [sec, members] of sections){
    if (members.length < minCards) continue;
    const ids = new Set(members.map((n)=> n.id));
    const out = normalizeGraph({ name: `${sec}`.slice(0, 70), nodes: [], edges: [], groups: [], notes: {} });
    out.description = `源图 ${graphId} · 小节 ${sec}`;
    out.nodeTypes = { ...out.nodeTypes, ghost: GHOST_TYPE };
    const pos = new Map();
    members.forEach((n, i)=>{
      const node = normalizeGraph({ nodes: [{ ...n, tags: [...(n.tags ?? []), `src:${graphId}`] }], edges: [], groups: [] }).nodes[0];
      out.nodes.push(node);
      pos.set(n.id, { x: 80 + (i % 4) * 288, y: 80 + Math.floor(i / 4) * 124 });
    });
    // 边：节内保留原样；跨节/跨书 → 生成幽灵卡
    const ghostOf = new Map();     // key(graph:node) → ghostId
    const ensureGhost = (nodeId, sourceGraph, reason, label)=>{
      const key = `${sourceGraph}:${nodeId}`;
      if (ghostOf.has(key)) return ghostOf.get(key);
      const src = sourceGraph === graphId ? graph.nodes.find((x)=> x.id === nodeId) : null;
      const gid = newId("gh");
      ghostOf.set(key, gid);
      const col = ghostOf.size;
      out.nodes.push(normalizeGraph({ nodes: [{
        id: gid, type: "ghost",
        label: (label ?? src?.label ?? nodeId).toString().slice(0, 48),
        note: `${reason}${sourceGraph !== graphId ? `\n\n来自图 \`${sourceGraph}\`` : ""}`,
        x: 80 + ((col - 1) % 4) * 288, y: 700 + Math.floor((col - 1) / 4) * 96,
        w: 240, h: 70,
        tags: [`open:${sourceGraph}`, `ghost:${nodeId}`, `reason:${reason}`],
      }], edges: [], groups: [] }).nodes[0]);
      return gid;
    };
    for (const e of graph.edges){
      const inSrc = ids.has(e.source), inTgt = ids.has(e.target);
      if (!inSrc && !inTgt) continue;
      let s2 = e.source, t2 = e.target;
      if (!inSrc) s2 = ensureGhost(e.source, graphId, "跨节依赖", null);
      if (!inTgt) t2 = ensureGhost(e.target, graphId, "跨节依赖", null);
      out.edges.push(normalizeGraph({ nodes: [], edges: [{ ...e, source: s2, target: t2 }], groups: [] }).edges[0]);
    }
    // 跨书链接 → 幽灵卡（外部依据 / 外部引用）
    for (const it of xlinks.items){
      if (!ids.has(it.self.node)) continue;
      const gid = ensureGhost(it.other.node, it.other.graph, it.view === "uses" ? "跨书依据" : "外部引用", null);
      if (it.view === "uses") out.edges.push(normalizeGraph({ nodes: [], edges: [{ source: gid, target: it.self.node, type: "depends-on", label: "跨书" }], groups: [] }).edges[0]);
      else out.edges.push(normalizeGraph({ nodes: [], edges: [{ source: it.self.node, target: gid, type: "depends-on", label: "跨书" }], groups: [] }).edges[0]);
    }
    out.id = makeGraphId(out.name);
    await saveGraph(join(root, "graphs", out.id), out);
    if (folder){ try { await moveGraph(root, out.id, folder); } catch { /* 归档失败不阻断 */ } }
    created.push({ id: out.id, name: out.name, cards: members.length, ghosts: ghostOf.size, edges: out.edges.length });
  }
  return { created, sections: sections.size, crossLinks: xlinks.items.length };
}

async function crosslinkIndexSafe(root, graphId){
  const items = await crosslinksForGraph(root, graphId);
  const byNode = new Map();
  for (const it of items){
    if (!byNode.has(it.self.node)) byNode.set(it.self.node, { provides: [], uses: [] });
    byNode.get(it.self.node)[it.view === "provides" ? "provides" : "uses"].push(it);
  }
  return { items, byNode };
}
