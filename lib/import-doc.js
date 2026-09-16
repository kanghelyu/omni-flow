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
import { layeredLayout, packedLayeredLayout } from "./graph-analysis.js";

const TYPE_EN = { theorem: "Theorem", proposition: "Proposition", lemma: "Lemma", corollary: "Corollary", definition: "Definition", example: "Example", remark: "Remark", paper: "References", equation: "Equation", section: "Section" };
const TYPE_ZH = { theorem: "定理", proposition: "命题", lemma: "引理", corollary: "推论", definition: "定义", example: "例", remark: "记", paper: "文献", equation: "公式", section: "节" };

/** 类型缩写（与包内 build_data.py 的 id 规则一致：thm/def/prop/lem/cor/ex/rem/eq） */
const ABBREV = { theorem: "thm", definition: "def", proposition: "prop", lemma: "lem", corollary: "cor", example: "ex", remark: "rem", equation: "eq", paper: "ref" };

/** 从章节标题抽取编号（"2.1. Elements integral…" → "2.1"；"(a) REVIEW…" → "a"） */
function sectionCode(title){
  const t = String(title ?? "").trim();
  const m = t.match(/^(\d+(?:\.\d+)*)/);
  if (m) return m[1];
  const p = t.match(/^\(([a-z])\)/i);
  if (p) return p[1];
  return "x";
}

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

/* ---------------- v2（分页富文本）解析层 ---------------- */

/** v2 判定：顶层为数组且元素是数组（按页分组），或元素带 content 对象 */
function isV2(contentList){
  if (!Array.isArray(contentList) || !contentList.length) return false;
  if (Array.isArray(contentList[0])) return true;
  const it = contentList[0];
  return !!it && typeof it === "object" && it.content && typeof it.content === "object";
}

/** span 数组 → 文本：equation_inline 转 $…$，**保住行内公式** */
function spansToText(spans){
  if (!Array.isArray(spans)) return "";
  return spans.map((sp)=>{
    const t = sp?.type, c = sp?.content;
    if (t === "equation_inline" || t === "equation") return `$${String(c ?? "").trim()}$`;
    if (typeof c === "string") return c;
    if (Array.isArray(c)) return spansToText(c);
    return "";
  }).join("");
}

/** v2 item → 文本 */
function v2Text(item){
  const c = item?.content ?? {};
  switch (item?.type){
    case "title": return spansToText(c.title_content);
    case "paragraph": return spansToText(c.paragraph_content);
    case "equation_interline": return `$$${String(c.math_content ?? "").trim()}$$`;
    case "list": return (c.list_items ?? []).map((li, i)=> `${i + 1}. ${spansToText(li.item_content)}`).join("\n");
    default: return typeof c === "string" ? c : spansToText(c?.paragraph_content);
  }
}

/** v2 → 统一条目（type/text/page_idx/section/attach） */
function flattenV2(contentList, { includeEquations = true } = {}){
  const out = [];
  let section = null;
  contentList.forEach((page, pi)=>{
    if (!Array.isArray(page)) return;
    for (const it of page){
      const type = it?.type;
      if (type === "page_number" || type === "page_footnote" || type === "page_header") continue;
      if (type === "title"){
        const title = v2Text(it).trim();
        if (title){ out.push({ type: "section", text: title, level: it?.content?.level ?? 1, page_idx: pi, section: title }); section = title; }
        continue;
      }
      if (type === "equation_interline" && includeEquations){
        const latex = String(it?.content?.math_content ?? "").trim();
        if (!latex) continue;
        out.push({ type: "equation", text: latex, page_idx: pi, section, bbox: it.bbox,
          attach: it?.content?.image_source?.path ? { kind: "image", src: it.content.image_source.path, label: "公式原图" } : null });
        continue;
      }
      const text = v2Text(it).trim();
      if (!text) continue;
      out.push({ type: type ?? "text", text, page_idx: pi, section, bbox: it.bbox });
    }
  });
  return out;
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
  const v2 = isV2(contentList);
  const items = v2 ? flattenV2(contentList, { includeEquations: true })
    : (Array.isArray(contentList) ? contentList : (contentList?.items ?? []));
  const keep = new Set(cardTypes ?? [...Object.keys(Object.fromEntries(KIND_PATTERNS)), "equation"]);
  const cards = [];
  let pageCount = 0;
  let curSection = null;
  let eqNo = 0;
  items.forEach((item, idx)=>{
    if (Number.isFinite(item?.page_idx)) pageCount = Math.max(pageCount, item.page_idx + 1);
    const type = item?.type;
    if (type === "page_number" || type === "page_footnote" || type === "page_header") return;
    const text = String(item?.text ?? item?.latex ?? "").trim();
    if (!text) return;
    if (type === "section"){ curSection = text; return; }   // 章节标题 → 结构，不进卡片
    const section = item.section ?? curSection;
    // 独立公式 → 公式卡（LaTeX 直接交给 KaTeX 排版）
    if (type === "equation"){
      if (!keep.has("equation")) return;
      const title = `${TYPE_ZH.equation} ${++eqNo}`;
      cards.push({ id: null, type: "equation", num: "", title, label: title, text, page: Number.isFinite(item.page_idx) ? item.page_idx + 1 : null, section, bbox: item.bbox ?? null, attach: item.attach ?? null, refs: extractRefs(text), idx });
      return;
    }
    const hit = classify(text);
    if (!hit || !keep.has(hit.type)) return;
    cards.push({
      id: newId("c"),
      type: hit.type,
      num: hit.num,
      title: ((lang === "en" ? TYPE_EN : TYPE_ZH)[hit.type] ?? hit.type) + (hit.num ? " " + hit.num : ""),
      label: ((lang === "en" ? TYPE_EN : TYPE_ZH)[hit.type] ?? hit.type) + (hit.num ? " " + hit.num : ""),
      section,
      text,
      page: Number.isFinite(item.page_idx) ? item.page_idx + 1 : null,
      bbox: item.bbox ?? null,
      refs: extractRefs(text),
      idx,
    });
  });

  // 编号 → 卡片；连线：被引用的卡 → 引用它的卡（依赖方向：前提指向结论）
  // 语义 id：{缩写}-{节}.{节内该类型序号}（如 thm-2.1.1 / def-2.1.2 / eq-2.3.1）
  // —— 与包内 build_data.py 一致，跨书链接表才能对得上；且重复导入 id 稳定。
  {
    const used = new Set();
    const seq = new Map();
    for (const c of cards){
      const sec = sectionCode(c.section);
      const key = `${c.type}@${sec}`;
      const n = (seq.get(key) ?? 0) + 1;
      seq.set(key, n);
      let id = `${ABBREV[c.type] ?? c.type}-${sec}.${n}`;
      let k = 2;
      while (used.has(id)) id = `${ABBREV[c.type] ?? c.type}-${sec}.${n}-${k++}`;
      used.add(id);
      c.id = id;
    }
  }

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
      tags: [
        ...(c.num ? [`num:${c.num}`] : []),
        ...(c.page ? [`page:${c.page}`] : []),
        ...(c.section ? [`sec:${String(c.section).slice(0, 40)}`] : []),
      ],
      attachments: (()=>{
        const list = [];
        if (c.attach?.src) list.push({ kind: "image", src: c.attach.src, label: c.attach.label ?? "原图", page: c.page ?? null });
        const p = pages.find((x)=> Number(x.page) === Number(c.page));
        if (p) list.push({ kind: "page", src: p.src, label: p.label ?? `第 ${c.page} 页`, page: c.page });
        return list;
      })(),
    };
    graph.nodes.push(normalizeGraph({ nodes: [node], edges: [], groups: [] }).nodes[0]);
    // 备注：原文 + 公式（$…$ 包裹，KaTeX 直接排版）
    const body = c.text.length > 200 ? c.text : c.text;
    graph.notes[c.id] = `${c.label}${c.section ? `\n\n> ${c.section}` : ""}${summary ? "\n\n" + summary.slice(0, 200) : ""}\n\n${body}\n${c.page ? `\n- 出处: 第 ${c.page} 页` : ""}${c.refs.length ? `\n- 引用: ${c.refs.join(", ")}` : ""}`;
  });

  const edges = [];
  const seen = new Set();
  for (const c of cards){
    for (const r of c.refs){
      const src = byNum.get(r) ?? byNum.get(`${sectionCode(c.section)}.${r}`);
      if (!src || src.id === c.id) continue;
      const key = `${src.id}->${c.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: src.id, target: c.id, type: "depends-on" });
    }
  }
  for (const e of edges) graph.edges.push(normalizeGraph({ nodes: [], edges: [e], groups: [] }).edges[0]);

  // 章节 → 分组（按 sec 标签聚类，≥2 张才成组）
  {
    const bySec = new Map();
    for (const n of graph.nodes){
      const sec = (n.tags ?? []).map(String).find((t)=> t.startsWith("sec:"))?.slice(4);
      if (!sec) continue;
      if (!bySec.has(sec)) bySec.set(sec, []);
      bySec.get(sec).push(n.id);
    }
    const palette = ["#38BDF8", "#A78BFA", "#34D399", "#FBBF24", "#F472B6", "#60A5FA", "#FB923C", "#22D3EE"];
    let gi = 0;
    for (const [sec, ids] of bySec){
      if (ids.length < 2) continue;
      graph.groups.push(normalizeGraph({ nodes: [], edges: [], groups: [{ id: newId("g"), label: sec.slice(0, 60), color: palette[gi++ % palette.length], members: ids }] }).groups[0]);
    }
  }

  // 自动分层：按依赖关系排版（左→右），比网格可读得多
  try {
    const pos = packedLayeredLayout(graph.nodes, graph.edges, { gapX: 120, gapY: 34, rowsPerColumn: 9, maxCols: 4 });
    graph.direction = "LR";
    for (const n of graph.nodes){
      const q = pos.get(n.id);
      if (q){ n.x = Math.round(q.x); n.y = Math.round(q.y); }
    }
  } catch { /* 布局失败则保留网格 */ }

  return {
    graph,
    stats: {
      format: v2 ? "v2" : "v1",
      total: items.length,
      cards: cards.length,
      equations: cards.filter((c)=> c.type === "equation").length,
      inlineFormulas: (JSON.stringify(contentList).match(/equation_inline/g) ?? []).length,
      edges: edges.length,
      groups: graph.groups.length,
      pages: pageCount,
      withImages: cards.filter((c)=> c.attach).length,
      byType: cards.reduce((a, c)=> (a[c.type] = (a[c.type] ?? 0) + 1, a), {}),
    },
  };
}

/** 从 Markdown（MinerU 的 .md 输出）粗提取卡片：按标题/编号行切段 */
export function buildGraphFromMarkdown({ markdown, name = "Markdown 卡片图", pages = [] }){
  const lines = String(markdown ?? "").split(/\r?\n/);
  const items = [];
  let buf = [], pageGuess = null, section = null;
  const flush = ()=>{
    const text = buf.join(" ").trim();
    if (text) items.push({ type: "text", text, page_idx: pageGuess, section });
    buf = [];
  };
  for (const line of lines){
    const hd = line.match(/^(#{1,6})\s+(.+)$/);
    if (hd){ flush(); section = hd[2].trim(); items.push({ type: "section", text: section, page_idx: pageGuess }); continue; }
    const pm = line.match(/<!--\s*page[:\s]+(\d+)\s*-->/i) || line.match(/^\s*[-—]{0,2}\s*(\d{1,3})\s*[-—]{0,2}\s*$/);
    if (pm) pageGuess = Number(pm[1]) - 1;
    if (!line.trim()){ flush(); continue; }
    buf.push(line.trim());
    if (classify(line.trim())){ flush(); }
  }
  flush();
  return buildGraphFromMineru({ contentList: items, pages, name });
}
