/**
 * MinerU 导入：把 PDF 结构化提取结果（content_list.json / .md）转成可计算的卡片图。
 *
 * MinerU（上海 AI Lab）把数学 PDF 转成 [{type, text, bbox, page_idx}, …]，
 * 其中 type=equation 的条目已带 LaTeX —— 直接喂给 KaTeX 就能排版。
 *
 * 本模块：识别「定义/定理/命题/引理/推论/例/记」条目 → 建卡；
 * 从文本里抽取引用（§x.y / Theorem x.y / 编号引用）→ 连依赖边；
 * 每张卡挂上所在页的页面图（若提供了页面图目录）。
 */
import { normalizeGraph, newId } from "./graph-core.js";
import { layeredLayout } from "./graph-analysis.js";

const TYPE_EN = { theorem: "Theorem", proposition: "Proposition", lemma: "Lemma", corollary: "Corollary", definition: "Definition", example: "Example", remark: "Remark", paper: "References" };
const TYPE_ZH = { theorem: "定理", proposition: "命题", lemma: "引理", corollary: "推论", definition: "定义", example: "例", remark: "记", paper: "文献" };

const KIND_PATTERNS = [
  ["theorem",     /^(?:Theorem|Th[eé]or[eè]me|定理)\s*([\d.]+)/i],
  ["proposition", /^(?:Proposition|命题)\s*([\d.]+)/i],
  ["lemma",       /^(?:Lemma|引理)\s*([\d.]+)/i],
  ["corollary",   /^(?:Corollary|推论|系)\s*([\d.]+)/i],
  ["definition",  /^(?:Definition|D[eé]finition|定义)\s*([\d.]+)/i],
  ["example",     /^(?:Example|Exemple|例)\s*([\d.]+)/i],
  ["remark",      /^(?:Remark|Remarque|注|记)\s*([\d.]+)/i],
  ["paper",       /^(?:References|Bibliography|参考(?:文献)?)\b/i],
];

/** 段落类型判定 → 卡片类型 + 编号 */
function classify(text){
  const t = String(text ?? "").trim().replace(/\s+/g, " ");
  for (const [type, re] of KIND_PATTERNS){
    const m = t.match(re);
    if (m) return { type, num: (m[1] ?? "").replace(/\.$/, "") };
  }
  return null;
}

/** 从正文里抽取对其它编号的引用（§2.3 / Theorem 2.3 / (2.3)） */
export function extractRefs(text){
  const out = new Set();
  const t = String(text ?? "");
  for (const m of t.matchAll(/(?:§|Theorem|Prop(?:osition)?|Lemma|Cor(?:ollary)?|Definition|Def\.?|定理|命题|引理|推论|定义)\s*([0-9]+(?:\.[0-9]+)*)/gi)) out.add(m[1]);
  for (const m of t.matchAll(/\(([0-9]+\.[0-9]+)\)/g)) out.add(m[1]);
  return [...out];
}

/**
 * @param {object} opts
 *   contentList  MinerU content_list.json 解析后的数组（或 {items}）
 *   pages        [{ page, src, label }] 页面图（可选，page 从 1 开始）
 *   name         图名
 *   lang         zh | en
 *   yamlText     可选：Markdown 原文（用于补齐公式的 LaTeX 渲染）
 */
export function buildGraphFromMineru({ contentList, pages = [], name = "PDF 卡片图", lang = "zh", cardTypes = null }){
  const items = Array.isArray(contentList) ? contentList : (contentList?.items ?? []);
  const keep = new Set(cardTypes ?? Object.keys(Object.fromEntries(KIND_PATTERNS)));
  const cards = [];
  let pageCount = 0;
  items.forEach((item, idx)=>{
    if (Number.isFinite(item?.page_idx)) pageCount = Math.max(pageCount, item.page_idx + 1);
    const type = item?.type;
    if (type === "page_number" || type === "page_footnote") return;
    const text = String(item?.text ?? item?.latex ?? "").trim();
    if (!text) return;
    const hit = type === "equation" ? null : classify(text);
    if (!hit || !keep.has(hit.type)) return;
    cards.push({
      id: newId("c"),
      type: hit.type,
      num: hit.num,
      title: (lang === "en" ? `${TYPE_EN[hit.type] ?? hit.type} ${hit.num}` : `${TYPE_ZH[hit.type] ?? hit.type} ${hit.num}`).trim(),
      label: (lang === "en" ? `${TYPE_EN[hit.type] ?? hit.type} ${hit.num}` : `${TYPE_ZH[hit.type] ?? hit.type} ${hit.num}`).trim(),
      text,
      page: Number.isFinite(item.page_idx) ? item.page_idx + 1 : null,
      bbox: item.bbox ?? null,
      refs: extractRefs(text),
      idx,
    });
  });

  // 编号 → 卡片；连线：被引用的卡 → 引用它的卡（依赖方向：前提指向结论）
  const byNum = new Map();
  for (const c of cards) if (c.num && !byNum.has(c.num)) byNum.set(c.num, c);

  const graph = normalizeGraph({ name, nodes: [], edges: [], groups: [], notes: {} });
  const cols = 4, colW = 260, rowH = 132;
  cards.forEach((c, i)=>{
    const summary = c.text.replace(/^\s*(?:Theorem|Proposition|Lemma|Corollary|Definition|Example|Remark|定理|命题|引理|推论|定义|例|记)\s*[\d.]*\s*[.:：]?\s*/i, "").trim();
    const node = {
      id: c.id, type: c.type,
      label: c.title,
      x: 80 + (i % cols) * colW, y: 80 + Math.floor(i / cols) * rowH,
      w: 232, h: 92,
      note: summary.slice(0, 150),
      tags: [`num:${c.num || "-"}`, ...(c.page ? [`page:${c.page}`] : [])],
      attachments: (()=>{
        const p = pages.find((x)=> Number(x.page) === Number(c.page));
        return p ? [{ kind: "page", src: p.src, label: p.label ?? `第 ${c.page} 页`, page: c.page }] : [];
      })(),
    };
    graph.nodes.push(normalizeGraph({ nodes: [node], edges: [], groups: [] }).nodes[0]);
    // 备注：原文 + 公式（$…$ 包裹，KaTeX 直接排版）
    const body = c.text.length > 200 ? c.text : c.text;
    graph.notes[c.id] = `${c.label}${summary ? " — " + summary.slice(0, 120) : ""}\n\n${body}\n${c.page ? `\n- 出处: 第 ${c.page} 页` : ""}${c.refs.length ? `\n- 引用: ${c.refs.join(", ")}` : ""}`;
  });

  const edges = [];
  const seen = new Set();
  for (const c of cards){
    for (const r of c.refs){
      const src = byNum.get(r);
      if (!src || src.id === c.id) continue;
      const key = `${src.id}->${c.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: src.id, target: c.id, type: "depends-on" });
    }
  }
  for (const e of edges) graph.edges.push(normalizeGraph({ nodes: [], edges: [e], groups: [] }).edges[0]);

  // 自动分层：按依赖关系排版（左→右），比网格可读得多
  try {
    const pos = layeredLayout(graph.nodes, graph.edges, { gapX: 150, gapY: 40 });
    graph.direction = "LR";
    for (const n of graph.nodes){
      const q = pos.get(n.id);
      if (q){ n.x = Math.round(q.x); n.y = Math.round(q.y); }
    }
  } catch { /* 布局失败则保留网格 */ }

  return {
    graph,
    stats: { total: items.length, cards: cards.length, edges: edges.length, pages: pageCount, byType: cards.reduce((a, c)=> (a[c.type] = (a[c.type] ?? 0) + 1, a), {}) },
  };
}

/** 从 Markdown（MinerU 的 .md 输出）粗提取卡片：按标题/编号行切段 */
export function buildGraphFromMarkdown({ markdown, name = "Markdown 卡片图", pages = [] }){
  const lines = String(markdown ?? "").split(/\r?\n/);
  const items = [];
  let buf = [], pageGuess = null;
  const flush = ()=>{
    const text = buf.join(" ").trim();
    if (text) items.push({ type: classify(text) ? "text" : "text", text, page_idx: pageGuess });
    buf = [];
  };
  for (const line of lines){
    const pm = line.match(/<!--\s*page[:\s]+(\d+)\s*-->/i) || line.match(/^\s*[-—]{0,2}\s*(\d{1,3})\s*[-—]{0,2}\s*$/);
    if (pm) pageGuess = Number(pm[1]) - 1;
    if (!line.trim()){ flush(); continue; }
    buf.push(line.trim());
    if (classify(line.trim())){ flush(); }
  }
  flush();
  return buildGraphFromMineru({ contentList: items, pages, name });
}
