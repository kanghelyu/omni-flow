/**
 * 导入人工整理的卡片表（build_data.py 形态）—— 最高保真路径
 *
 * 这类文件是**纯数据模块**（SECTIONS / NODES / TYPE_META / SECTION_FLOW），
 * 比从 MinerU 自动抽取质量高得多：
 *   · 每张卡有精确语义 id（thm-2.1.1）、人工撰写的标题与 LaTeX 正文
 *   · deps 是**人工整理的依赖边**（不是正则猜的）
 *   · SECTION_FLOW 是**带理由的节间依赖流**（小节总览图的边）
 *
 * 实现上用 python3 + runpy 求值（该文件无导入无副作用），再转 JSON，
 * 比正则解析多行隐式拼接字符串可靠得多。
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { normalizeGraph } from "./graph-core.js";
import { packedLayeredLayout } from "./graph-analysis.js";

const run = promisify(execFile);

const TYPE_MAP = {
  thm: "theorem", def: "definition", prop: "proposition", lem: "lemma",
  cor: "corollary", ex: "example", rem: "remark", eq: "equivalence", eqn: "equation",
};
const TYPE_ZH = { theorem: "定理", definition: "定义", proposition: "命题", lemma: "引理", corollary: "推论", example: "例", remark: "记", equivalence: "等价", equation: "公式" };

/** 用 python3 求值数据模块并取回 JSON（只读，不执行任何写操作） */
export async function extractPythonData(file, { python = "python3" } = {}){
  const code = `
import json, runpy, sys
m = runpy.run_path(sys.argv[1])
out = {}
for k in ("NODES", "SECTIONS", "TYPE_META", "SECTION_FLOW", "TYPE_META_ZH"):
    v = m.get(k)
    if v is not None:
        out[k] = [list(x) if isinstance(x, tuple) else x for x in v] if isinstance(v, (list, tuple)) else v
sys.stdout.write(json.dumps(out, ensure_ascii=False))
`;
  const { stdout } = await run(python, ["-c", code, file], { maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(stdout);
}

/** 卡片表 → 图（节点=卡，边=deps，分组=节，并自动分层） */
export function buildGraphFromCards(data, { name = "卡片图", lang = "zh" } = {}){
  const nodes = data.NODES ?? [];
  const sections = (data.SECTIONS ?? []).map((s)=> Array.isArray(s) ? { code: s[0], en: s[1], zh: s[2] ?? s[1] } : s);
  const secName = new Map(sections.map((s)=> [s.code, lang === "zh" && s.zh ? s.zh : s.en]));
  const typeMeta = data.TYPE_META ?? {};

  const graph = normalizeGraph({ name, nodes: [], edges: [], groups: [], notes: {} });
  const ids = new Set(nodes.map((n)=> n.id));

  const cols = 4, colW = 300, rowH = 128;
  nodes.forEach((c, i)=>{
    const type = TYPE_MAP[c.type] ?? "note";
    const zhName = TYPE_ZH[type] ?? type;
    const title = String(c.title ?? "").trim();
    const label = `${zhName}${c.num ? " " + String(c.num).replace(/^[A-Za-z]+\s*/, "") : ""}${title ? " · " + title.slice(0, 40) : ""}`;
    graph.nodes.push(normalizeGraph({ nodes: [{
      id: c.id, type,
      label: label.slice(0, 90),
      note: (title || String(c.tex ?? "").replace(/<br\s*\/?>/g, " ").slice(0, 150)),
      x: 80 + (i % cols) * colW, y: 80 + Math.floor(i / cols) * rowH,
      w: 276, h: 104,
      tags: [`sec:${c.sec}`, `num:${c.num ?? ""}`, `src-id:${c.id}`],
    }], edges: [], groups: [] }).nodes[0]);
    // 备注 = 人工 LaTeX 正文 + 思路
    const body = String(c.tex ?? "").replace(/<br\s*\/?>/g, "\n");
    graph.notes[c.id] = [
      c.num ? `**${c.num}**${title ? " — " + title : ""}` : (title ? `**${title}**` : ""),
      secName.get(c.sec) ? `> §${c.sec} ${secName.get(c.sec)}` : "",
      body,
      c.note ? `\n---\n**思路**\n${String(c.note).replace(/<br\s*\/?>/g, "\n")}` : "",
    ].filter(Boolean).join("\n\n");
  });

  let edgeCount = 0;
  for (const c of nodes){
    for (const d of (c.deps ?? [])){
      if (!ids.has(d)) continue;   // 指向外部图（跨书）的 dep 交给跨图链接处理
      graph.edges.push(normalizeGraph({ nodes: [], edges: [{ source: d, target: c.id, type: "depends-on" }], groups: [] }).edges[0]);
      edgeCount++;
    }
  }

  // 节 → 分组（按 SECTIONS 顺序，颜色按类型主题循环）
  const palette = ["#38BDF8", "#A78BFA", "#34D399", "#FBBF24", "#F472B6", "#60A5FA", "#FB923C", "#22D3EE", "#4ADE80", "#F87171"];
  sections.forEach((s, i)=>{
    const members = nodes.filter((c)=> c.sec === s.code).map((c)=> c.id);
    if (members.length < 1) return;
    graph.groups.push(normalizeGraph({ nodes: [], edges: [], groups: [{ id: `g-sec-${s.code}`, label: `§${s.code} ${secName.get(s.code) ?? s.en ?? ""}`.slice(0, 70), color: palette[i % palette.length], members }] }).groups[0]);
  });

  try {
    const pos = packedLayeredLayout(graph.nodes, graph.edges, { gapX: 120, gapY: 34, rowsPerColumn: 9, maxCols: 4 });
    graph.direction = "LR";
    for (const n of graph.nodes){ const q = pos.get(n.id); if (q){ n.x = Math.round(q.x); n.y = Math.round(q.y); } }
  } catch { /* 布局失败保留网格 */ }

  const byType = nodes.reduce((a, c)=> { const t = TYPE_MAP[c.type] ?? "note"; a[t] = (a[t] ?? 0) + 1; return a; }, {});
  const unresolved = nodes.flatMap((c)=> (c.deps ?? []).filter((d)=> !ids.has(d)));
  return {
    graph,
    stats: { format: "cards", cards: nodes.length, edges: edgeCount, groups: graph.groups.length, byType, sections: sections.length, externalDeps: [...new Set(unresolved)].length },
    typeMeta,
    sectionFlow: data.SECTION_FLOW ?? [],
    unresolvedDeps: [...new Set(unresolved)],
  };
}

/** SECTION_FLOW（带理由的节间依赖）→ 小节总览图 */
export function buildOverviewFromFlow(data, { name = "章节总览", sourceId = null } = {}){
  const sections = (data.SECTIONS ?? []).map((s)=> Array.isArray(s) ? { code: s[0], en: s[1], zh: s[2] ?? s[1] } : s);
  const flow = data.SECTION_FLOW ?? [];
  const graph = normalizeGraph({ name, nodes: [], edges: [], groups: [], notes: {} });
  graph.nodeTypes = { ...graph.nodeTypes, section: { label: "小节", labelEn: "Section", shape: "hexagon", fill: "#0EA5E9", border: "#0284C7", textColor: "#082F49", icon: "§" } };
  const cardsBySec = new Map();
  for (const c of (data.NODES ?? [])) cardsBySec.set(c.sec, (cardsBySec.get(c.sec) ?? 0) + 1);
  const cols = 4, colW = 320, rowH = 132;
  sections.forEach((s, i)=>{
    const id = `sec-${s.code}`;
    graph.nodes.push(normalizeGraph({ nodes: [{
      id, type: "section", label: `§${s.code} ${s.zh || s.en}`.slice(0, 60),
      note: `${cardsBySec.get(s.code) ?? 0} 张卡片`,
      x: 80 + (i % cols) * colW, y: 80 + Math.floor(i / cols) * rowH,
      w: 288, h: 92, tags: [`sec:${s.code}`],
    }], edges: [], groups: [] }).nodes[0]);
    graph.notes[id] = `§${s.code} ${s.zh || s.en}\n\n- 卡片 ${cardsBySec.get(s.code) ?? 0} 张`;
  });
  const known = new Set(sections.map((s)=> s.code));
  for (const f of flow){
    const [from, to, why] = Array.isArray(f) ? f : [f.from, f.to, f.why];
    if (!known.has(from) || !known.has(to)) continue;
    graph.edges.push(normalizeGraph({ nodes: [], edges: [{ source: `sec-${from}`, target: `sec-${to}`, type: "depends-on", label: why }], groups: [] }).edges[0]);
  }
  return { graph, stats: { sections: sections.length, edges: graph.edges.length } };
}
