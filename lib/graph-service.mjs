// OmniFlow 数据服务：graphs/ 目录读写。graph.json 是唯一拓扑事实来源，
// 节点长备注放 notes/<nodeId>.md（Markdown 优先），graph.json.notes 只存短摘要。
import { readFile, writeFile, mkdir, readdir, rename, unlink } from "node:fs/promises";
import { join, dirname } from "node:path";
import { normalizeGraph, validateGraph } from "./graph-core.js";

/* ================= 可靠写入基础设施 ================= */

/** 同一文件的写入串行化：同进程内并发保存按顺序执行，绝不交叉覆盖。 */
const writeChains = new Map();
function enqueueWrite(path, task) {
  const prev = writeChains.get(path) ?? Promise.resolve();
  const next = prev.then(task, task);          // 前一次失败也继续排队
  writeChains.set(path, next.then(() => {}, () => {}));
  return next;
}

/** 完整写入后再替换：临时文件写满 → rename 原子替换。
    读取者永远只看到「完整旧版」或「完整新版」，不存在半截文件。
    沙箱/跨设备环境不支持 rename 时回退为直写。 */
async function writeFileSafe(path, content) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid.toString(36)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    await writeFile(tmp, content, "utf8");
    await rename(tmp, path);
    return "atomic";
  } catch (error) {
    try { await unlink(tmp); } catch { /* 清理失败忽略 */ }
    if (["ENOENT", "EACCES", "EPERM", "EXDEV", "ENOTSUP"].includes(error?.code)) {
      await writeFile(path, content, "utf8");
      return "direct";
    }
    throw error;
  }
}

/** 读取 JSON；遇到「完整对象 + 尾部垃圾」（并发写交错）时自动治愈并就地重写。
    只有真正无法恢复的文件才返回 null——单个坏文件绝不拖垮整个列表。 */
export async function readJsonIfPresent(path, { heal = true } = {}) {
  let raw;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") console.warn(`[omni-flow] 读取失败: ${path} (${error.message})`);
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    // 自愈路径：截取第一个完整 JSON 对象
    try {
      const [obj, end] = new JSONDecoder().decodePrefix(raw);
      if (heal && end < raw.length) {
        await writeFile(path, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
        console.warn(`[omni-flow] 已自愈截断文件: ${path}（丢弃尾部 ${raw.length - end} 字节）`);
      }
      return obj;
    } catch {
      console.warn(`[omni-flow] 无法恢复，已跳过: ${path}`);
      return null;
    }
  }
}

/** 取字符串开头的第一个完整 JSON 值（容忍尾部多余内容），返回 [值, 结束位置]。 */
class JSONDecoder {
  decodePrefix(text) {
    const trimmed = text.trimStart();
    const offset = text.length - trimmed.length;
    // 用 JSON.parse 的增量解析：逐块试探边界（对象/数组按括号配对）
    const first = trimmed[0];
    if (first !== "{" && first !== "[") throw new Error("非 JSON 起始");
    let depth = 0, inStr = false, esc = false;
    for (let i = 0; i < trimmed.length; i++) {
      const c = trimmed[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') { inStr = true; continue; }
      if (c === "{" || c === "[") depth++;
      else if (c === "}" || c === "]") {
        depth--;
        if (depth === 0) {
          const slice = trimmed.slice(0, i + 1);
          return [JSON.parse(slice), offset + i + 1];
        }
      }
    }
    throw new Error("括号未闭合");
  }
}

export function graphDir(root, id) {
  return join(root, "graphs", id);
}

export async function loadGraph(root, id) {
  if (!id) throw new Error("缺少图 id");
  const dir = graphDir(root, id);
  const file = join(dir, "graph.json");
  let raw;
  try {
    raw = await readFile(file, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      const notFound = new Error(`图不存在：${id}（${dir}）`);
      notFound.code = "NOT_FOUND";
      throw notFound;
    }
    throw error;
  }
  try {
    return { dir, root, graph: normalizeGraph(JSON.parse(raw)) };
  } catch {
    // 损坏：先尝试自愈；失败则明确报「损坏」而非「不存在」，且绝不静默覆盖
    const healed = await readJsonIfPresent(file);
    if (healed) return { dir, root, graph: normalizeGraph(healed) };
    const corrupt = new Error(`图文件已损坏且无法自动恢复（原始文件与 .bak 备份均已保留）：${file}`);
    corrupt.code = "CORRUPT";
    throw corrupt;
  }
}

export async function saveGraph(dir, graph) {
  graph.updatedAt = new Date().toISOString();
  await mkdir(dir, { recursive: true });
  const file = join(dir, "graph.json");
  const content = `${JSON.stringify(graph, null, 2)}\n`;
  // 保存排队：同一文件按序写入；备份轮换在前（保留旧版，损坏可恢复）
  return enqueueWrite(file, async () => {
    try {
      const prev = await readFile(file, "utf8");
      const bakDir = join(dir, ".bak");
      await mkdir(bakDir, { recursive: true });
      const stamp = `${new Date().toISOString().replace(/[:.]/g, "-")}-${process.pid.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      await writeFile(join(bakDir, `graph-${stamp}.json`), prev, "utf8");
      const baks = (await readdir(bakDir)).filter((f) => f.startsWith("graph-")).sort();
      for (const old of baks.slice(0, -3)) await unlink(join(bakDir, old));
    } catch { /* 首次保存无旧文件 */ }
    await writeFileSafe(file, content);
    // 回读校验：解析失败立即重写（并发交错兜底）
    try {
      JSON.parse(await readFile(file, "utf8"));
    } catch {
      await writeFileSafe(file, content);
      console.warn(`[omni-flow] 写入校验失败已重写: ${file}`);
    }
  });
}

export async function saveGraphChecked(root, id, graph) {
  const verdict = validateGraph(graph);
  if (!verdict.ok) {
    const error = new Error("结构校验未通过");
    error.issues = verdict.issues;
    throw error;
  }
  await saveGraph(graphDir(root, id), graph);
  return verdict;
}

/** 节点长备注：notes/<nodeId>.md。读取返回 {content, exists}。 */
export async function readNodeNote(root, id, nodeId) {
  const safe = String(nodeId ?? "").replace(/[^A-Za-z0-9_\u4e00-\u9fff-]/g, "");
  if (!safe) return { content: "", exists: false };
  try {
    return { content: await readFile(join(graphDir(root, id), "notes", `${safe}.md`), "utf8"), exists: true };
  } catch {
    return { content: "", exists: false };
  }
}

export async function writeNodeNote(root, id, nodeId, content, opts = {}) {
  // ===== 公式防线（系统强制：所有 agent / 客户端的备注写入都必经此处）=====
  // ① 规范化：\\tag→文本编号、\\bm→\\boldsymbol、\\RR 等简写→标准命令、剥导言区……
  //    落库内容永远是「纯标准 KaTeX」，不依赖任何库外自定义宏。
  // ② 硬校验：仍编译不了的片段 → 拒绝写入并抛出带**逐条修法**的错误。
  //    唯一正当出口：把「示例性 LaTeX 源码」放进代码围栏 ```…``` 内；或显式 opts.force。
  {
    const { normalizeLatex, checkLatex } = await import("./latex.js");
    const normalized = normalizeLatex(content);
    const report = checkLatex(normalized);
    if (!opts.force && report.failed.length) {
      const detail = report.failed.slice(0, 5)
        .map((f, i)=> `  ${i + 1}) 片段：${String(f.fragment).replace(/\s+/g, " ").slice(0, 120)}\n     错误：${f.error}\n     修法：${f.hint}`)
        .join("\n");
      const err = new Error(`LaTeX 校验未通过，已拒绝写入（${report.failed.length}/${report.total} 段无法编译）：\n${detail}\n请按「修法」改正后重写；若要展示 LaTeX 源码本身，请放进代码围栏 \`\`\`…\`\`\` 内。`);
      err.code = "LATEX_INVALID";
      err.latex = report;
      throw err;
    }
    content = normalized;                       // 后续逻辑照旧，但用的是规范化后的内容
    var __latexReport = { checked: report.total, ok: report.ok, failed: report.failed.map((f)=> ({ fragment: String(f.fragment).slice(0, 80), hint: f.hint })) };
  }

  const safe = String(nodeId ?? "").replace(/[^A-Za-z0-9_\u4e00-\u9fff-]/g, "");
  if (!safe) throw new Error("非法节点 id");
  const notesDir = join(graphDir(root, id), "notes");
  await mkdir(notesDir, { recursive: true });
  await writeFileSafe(join(notesDir, `${safe}.md`), String(content ?? ""));
}

export async function listGraphs(root) {
  let entries = [];
  try {
    entries = await readdir(join(root, "graphs"), { withFileTypes: true });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const graphs = [];
  for (const entry of entries.filter((item) => item.isDirectory())) {
    const stored = await readJsonIfPresent(join(root, "graphs", entry.name, "graph.json"));
    if (!stored) continue;
    const verdict = validateGraph(normalizeGraph(stored));
    graphs.push({
      id: entry.name,
      name: stored.name ?? entry.name,
      revision: stored.revision ?? 1,
      nodes: (stored.nodes ?? []).length,
      edges: (stored.edges ?? []).length,
      groups: (stored.groups ?? []).length,
      valid: verdict.ok,
      warnings: verdict.warnings.length,
      updatedAt: stored.updatedAt ?? null
    });
  }
  return graphs.sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
}

export async function deleteGraph(root, id) {
  const dir = graphDir(root, id);
  const stored = await readJsonIfPresent(join(dir, "graph.json"));
  if (!stored) throw new Error(`图 ${id} 不存在`);
  const trashDir = join(root, "trash", `${new Date().toISOString().replace(/[:.]/g, "-")}-${id}`);
  await mkdir(join(root, "trash"), { recursive: true });
  await rename(dir, trashDir);
  return trashDir;
}

export function makeGraphId(name) {
  const base = String(name ?? "").replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, "").slice(0, 24) || "graph";
  return `${base}-${Date.now().toString(36).slice(-4)}`;
}
