// OmniFlow 数据服务：graphs/ 目录读写。graph.json 是唯一拓扑事实来源，
// 节点长备注放 notes/<nodeId>.md（Markdown 优先），graph.json.notes 只存短摘要。
import { readFile, writeFile, mkdir, readdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { normalizeGraph, validateGraph } from "./graph-core.js";

export async function readJsonIfPresent(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
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
  await writeFile(join(dir, "graph.json"), `${JSON.stringify(graph, null, 2)}\n`, "utf8");
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
