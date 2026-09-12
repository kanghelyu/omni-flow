// 全局搜索：图标题 / 节点标签 / 标签 / 备注全文（graph.json 首行 + notes/*.md）。
// HTTP /api/search 与 MCP of_search 共用此实现。
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { listGraphs, loadGraph } from "./graph-service.mjs";

export async function searchGraphs(root, q) {
  const query = String(q ?? "").trim().toLowerCase();
  if (!query) return [];
  const results = [];
  for (const meta of await listGraphs(root)) {
    if (meta.name.toLowerCase().includes(query)) {
      results.push({ graphId: meta.id, graphName: meta.name, where: "title" });
    }
    const { graph } = await loadGraph(root, meta.id);
    const noted = new Set();
    for (const node of graph.nodes) {
      if (String(node.label ?? "").toLowerCase().includes(query)) {
        results.push({ graphId: meta.id, graphName: meta.name, nodeId: node.id, nodeLabel: node.label, where: "node" });
        noted.add(node.id);
      }
      for (const tag of node.tags ?? []) {
        if (String(tag).toLowerCase().includes(query)) {
          results.push({ graphId: meta.id, graphName: meta.name, nodeId: node.id, nodeLabel: node.label, where: "tag" });
          noted.add(node.id);
          break;
        }
      }
      if (String(node.note ?? "").toLowerCase().includes(query)) {
        results.push({ graphId: meta.id, graphName: meta.name, nodeId: node.id, nodeLabel: node.label, snippet: String(node.note).slice(0, 90), where: "note" });
        noted.add(node.id);
      }
    }
    try {
      const notesDir = join(root, "graphs", meta.id, "notes");
      for (const file of await readdir(notesDir)) {
        if (!file.endsWith(".md")) continue;
        const nodeId = file.slice(0, -3);
        if (noted.has(nodeId)) continue;
        const content = await readFile(join(notesDir, file), "utf8");
        const idx = content.toLowerCase().indexOf(query);
        if (idx === -1) continue;
        const node = graph.nodes.find((n) => n.id === nodeId);
        results.push({
          graphId: meta.id, graphName: meta.name, nodeId,
          nodeLabel: node?.label ?? nodeId,
          snippet: content.slice(Math.max(0, idx - 20), idx + 70),
          where: "note"
        });
      }
    } catch { /* 无 notes 目录 */ }
  }
  return results.slice(0, 40);
}
