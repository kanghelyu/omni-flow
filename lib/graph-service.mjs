// OmniFlow 数据服务：graphs/ 目录读写。graph.json 是唯一拓扑事实来源，
// 节点长备注放 notes/<nodeId>.md（Markdown 优先），graph.json.notes 只存短摘要。
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { normalizeGraph, validateGraph } from "./graph-core.js";

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
  const stored = await readJsonIfPresent(join(dir, "graph.json"));
  if (!stored) throw new Error(`图 ${id} 不存在（${dir}）`);
  return { dir, root, graph: normalizeGraph(stored) };
}

export async function saveGraph(dir, graph) {
  graph.updatedAt = new Date().toISOString();
  await mkdir(dir, { recursive: true });
  const file = join(dir, "graph.json");
  // 备份轮换：覆盖前把旧内容存入 .bak/（保留最近 3 份）
  try {
    const prev = await readFile(file, "utf8");
    const bakDir = join(dir, ".bak");
    await mkdir(bakDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await writeFile(join(bakDir, `graph-${stamp}.json`), prev, "utf8");
    const baks = (await readdir(bakDir)).filter((f) => f.startsWith("graph-")).sort();
    for (const old of baks.slice(0, -3)) await unlink(join(bakDir, old));
  } catch { /* 首次保存无旧文件 */ }
  const content = `${JSON.stringify(graph, null, 2)}\n`;
  await writeFile(file, content, "utf8");
  // 写入回读校验：解析失败立即重写（并发交错防护）
  try {
    JSON.parse(await readFile(file, "utf8"));
  } catch {
    await writeFile(file, content, "utf8");
    console.warn(`[omni-flow] 写入校验失败已重写: ${file}`);
  }
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

export async function writeNodeNote(root, id, nodeId, content) {
  const safe = String(nodeId ?? "").replace(/[^A-Za-z0-9_\u4e00-\u9fff-]/g, "");
  if (!safe) throw new Error("非法节点 id");
  const notesDir = join(graphDir(root, id), "notes");
  await mkdir(notesDir, { recursive: true });
  await writeFile(join(notesDir, `${safe}.md`), String(content ?? ""), "utf8");
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
