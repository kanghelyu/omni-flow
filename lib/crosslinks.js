/**
 * 跨图链接表（Cross-graph links）—— 单一事实源 + 数学理由
 *
 * 语义（与包内 crosslinks.py 一致）：
 *   from = 提供依据的一方（被依赖者）
 *   to   = 使用依据的一方（依赖者）
 * 无论从哪张图查看，箭头方向恒为 from → to，两边永不冲突。
 *
 * 存储：<root>/crosslinks.json（唯一真源，避免两张图各存一份导致发散）
 *   [{ id, from: { graph, node }, to: { graph, node }, why, kind, createdAt }]
 *
 * 视角解释（供 UI 用）：
 *   若当前图包含 from → 该节点是「外部引用」（我支撑了别的图的那个结论）
 *   若当前图包含 to   → 该节点是「外部依据」（我用了别的图的结论）
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const FILE = "crosslinks.json";

export async function readCrosslinks(root){
  try {
    const raw = JSON.parse(await readFile(join(root, FILE), "utf8"));
    const list = Array.isArray(raw) ? raw : (raw.links ?? []);
    return list.filter((x)=> x && x.from?.graph && x.from?.node && x.to?.graph && x.to?.node);
  } catch { return []; }
}

async function writeCrosslinks(root, list){
  await mkdir(root, { recursive: true });
  await writeFile(join(root, FILE), `${JSON.stringify(list, null, 2)}\n`, "utf8");
  return list;
}

const newLinkId = ()=> `xl-${Math.random().toString(36).slice(2, 7)}${Date.now().toString(36).slice(-3)}`;

/** 新增一条跨图链接（同向同 Why 去重；已存在则更新 why） */
export async function addCrosslink(root, { fromGraph, fromNode, toGraph, toNode, why = "", kind = "depends" }){
  if (!fromGraph || !fromNode || !toGraph || !toNode) throw new Error("from/to must look like graph:node");
  if (fromGraph === toGraph && fromNode === toNode) throw new Error("a graph cannot link to itself");
  const list = await readCrosslinks(root);
  const hit = list.find((x)=> x.from.graph === fromGraph && x.from.node === fromNode && x.to.graph === toGraph && x.to.node === toNode);
  if (hit){ hit.why = why || hit.why; hit.kind = kind; await writeCrosslinks(root, list); return { link: hit, created: false }; }
  const link = { id: newLinkId(), from: { graph: fromGraph, node: fromNode }, to: { graph: toGraph, node: toNode }, why, kind, createdAt: new Date().toISOString() };
  list.push(link);
  await writeCrosslinks(root, list);
  return { link, created: true };
}

export async function removeCrosslink(root, id){
  const list = await readCrosslinks(root);
  const next = list.filter((x)=> x.id !== id);
  await writeCrosslinks(root, next);
  return { removed: list.length - next.length };
}

/** 取与某张图相关的全部链接，并标注视角（provides / uses） */
export async function crosslinksForGraph(root, graphId){
  const list = await readCrosslinks(root);
  const items = [];
  for (const x of list){
    const isFrom = x.from.graph === graphId, isTo = x.to.graph === graphId;
    if (!isFrom && !isTo) continue;
    items.push({
      ...x,
      view: isFrom ? "provides" : "uses",
      self: isFrom ? x.from : x.to,          // 本图内的节点
      other: isFrom ? x.to : x.from,         // 对端图与节点
    });
  }
  return items;
}

/** 按节点聚合（供卡片角标）：nodeId → { provides:[], uses:[] } */
export async function crosslinkIndex(root, graphId){
  const items = await crosslinksForGraph(root, graphId);
  const idx = new Map();
  for (const it of items){
    if (!idx.has(it.self.node)) idx.set(it.self.node, { provides: [], uses: [] });
    idx.get(it.self.node)[it.view === "provides" ? "provides" : "uses"].push(it);
  }
  return { items, byNode: idx };
}

/** 解析包内的 crosslinks.py（或同结构 JSON）→ 批量导入 */
export function parseCrosslinkTable(text, { bookToGraph = {} } = {}){
  const out = [];
  const pyRe = /dict\(\s*f_book\s*=\s*([A-Za-z_][\w]*)\s*,\s*f_id\s*=\s*"([^"]+)"\s*,\s*t_book\s*=\s*([A-Za-z_][\w]*)\s*,\s*t_id\s*=\s*"([^"]+)"\s*,\s*why\s*=\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = pyRe.exec(text))){
    const why = m[5].replace(/\\"/g, '"').replace(/\\n/g, "\n");
    out.push({ fBook: m[1], fId: m[2], tBook: m[3], tId: m[4], why });
  }
  if (out.length) return out.map((x)=> ({
    fromGraph: bookToGraph[x.fBook] ?? x.fBook,
    fromNode: x.fId,
    toGraph: bookToGraph[x.tBook] ?? x.tBook,
    toNode: x.tId,
    why: x.why,
  }));
  // JSON 形态
  try {
    const raw = JSON.parse(text);
    const arr = Array.isArray(raw) ? raw : (raw.links ?? []);
    return arr.map((x)=> ({
      fromGraph: bookToGraph[x.f_book ?? x.from?.graph] ?? (x.f_book ?? x.from?.graph),
      fromNode: x.f_id ?? x.from?.node,
      toGraph: bookToGraph[x.t_book ?? x.to?.graph] ?? (x.t_book ?? x.to?.graph),
      toNode: x.t_id ?? x.to?.node,
      why: x.why ?? "",
    })).filter((x)=> x.fromGraph && x.fromNode && x.toGraph && x.toNode);
  } catch { return []; }
}

/** 清理陈旧链接：图或节点已不存在 → 删除（跨图链接表长期使用必需） */
export async function pruneCrosslinks(root, { graphExists = null, nodeExists = null } = {}){
  const list = await readCrosslinks(root);
  const keep = [];
  const removed = [];
  for (const x of list){
    let ok = true;
    for (const side of ["from", "to"]){
      const g = x[side].graph, n = x[side].node;
      const gOk = graphExists ? await graphExists(g) : true;
      if (!gOk){ ok = false; break; }
      const nOk = nodeExists ? await nodeExists(g, n) : true;
      if (!nOk){ ok = false; break; }
    }
    (ok ? keep : removed).push(x);
  }
  if (removed.length) await writeCrosslinks(root, keep);
  return { total: list.length, kept: keep.length, removed: removed.length, removedIds: removed.map((x)=> x.id) };
}
