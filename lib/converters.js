// OmniFlow 转换器：JSON / Mermaid / Graphviz DOT / Markdown 大纲互转，以及 agent-flow 工作流导入。
// 文本格式优先——AI 可读、Git 可 diff，这是调研结论（Mermaid 阵营）的核心优势。
import { nodeTypeDef, edgeTypeDef, normalizeGraph, newId } from "./graph-core.js";

const MERMAID_SAFE = /["`\n]/g;

function mermaidId(id) {
  return `n_${id.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

function mermaidLabel(text) {
  return String(text ?? "").replace(MERMAID_SAFE, " ").trim() || " ";
}

const SHAPE_OPEN = { rect: "[", rounded: "(", pill: "([", diamond: "{", ellipse: "((", hexagon: "{{", parallelogram: "[/", document: "[\\" };
const SHAPE_CLOSE = { rect: "]", rounded: ")", pill: ")]", diamond: "}", ellipse: "))", hexagon: "}}", parallelogram: "/]", document: "\\]" };

export function toMermaid(graph) {
  const lines = [`flowchart ${graph.direction ?? "TD"}`];
  const classDefs = [];
  const classMap = new Map();
  for (const node of graph.nodes ?? []) {
    const def = nodeTypeDef(graph, node.type);
    const open = SHAPE_OPEN[node.shape] ?? "[";
    const close = SHAPE_CLOSE[node.shape] ?? "]";
    const icon = node.icon ? `${node.icon} ` : "";
    const status = node.status ? `【${node.status}】` : "";
    lines.push(`    ${mermaidId(node.id)}${open}"${icon}${mermaidLabel(node.label)}${status}"${close}`);
    const cls = `type_${node.type.replace(/[^A-Za-z0-9_]/g, "_")}`;
    if (!classMap.has(cls)) {
      classMap.set(cls, true);
      classDefs.push(`    classDef ${cls} fill:${node.fill},stroke:${node.border},color:${node.textColor}`);
    }
  }
  for (const edge of graph.edges ?? []) {
    const arrow = edge.style === "dotted" ? "-.->" : edge.style === "dashed" ? "-.->" : edge.arrow === "none" ? "---" : "-->";
    const label = edge.label || edgeTypeDef(graph, edge.type).label;
    const both = edge.arrow === "both" && edge.style === "solid" ? "<" : "";
    lines.push(`    ${mermaidId(edge.source)} ${both === "<" ? "<" : ""}${arrow}${label ? `|"${mermaidLabel(label)}"|` : ""} ${mermaidId(edge.target)}`);
  }
  for (const group of graph.groups ?? []) {
    const members = (group.members ?? []).map((id) => mermaidId(id)).join(" ");
    if (members) lines.push(`    subgraph ${mermaidId(group.id)}["${mermaidLabel(group.label)}"]\n        direction TB\n        ${members}\n    end`);
  }
  return [...lines, ...classDefs, ...(classDefs.length ? [`    class ${[...(graph.nodes ?? [])].map((n) => mermaidId(n.id)).join(",")} ${[...new Set((graph.nodes ?? []).map((n) => `type_${n.type.replace(/[^A-Za-z0-9_]/g, "_")}`))].join(",")}`] : [])].join("\n");
}

/** Mermaid flowchart 解析器：支持 A["label"] / A -->|label| B / -.-> / --- 节点与边定义。 */
export function fromMermaid(text) {
  const nodes = new Map();
  const edges = [];
  const nodeRef = (id, label, shape) => {
    const key = id.trim();
    if (!key) return null;
    if (!nodes.has(key)) nodes.set(key, { id: key, type: "process", label: label ?? key, shape });
    else if (label) nodes.get(key).label = label;
    if (shape) nodes.get(key).shape = shape;
    return nodes.get(key);
  };
  const shapeOf = (raw) => {
    const trimmed = raw.trim();
    if (trimmed.startsWith("{{")) return "hexagon";
    if (trimmed.startsWith("([")) return "pill";
    if (trimmed.startsWith("((")) return "ellipse";
    if (trimmed.startsWith("[\\")) return "document";
    if (trimmed.startsWith("[/")) return "parallelogram";
    if (trimmed.startsWith("{")) return "diamond";
    if (trimmed.startsWith("[")) return "rect";
    if (trimmed.startsWith("(")) return "rounded";
    return null;
  };
  const labelOf = (raw) => {
    const match = String(raw ?? "").match(/^\s*[({\[\\/-]*\s*["“”]?([^"“”}\]]*?)["“”]?\s*[)}\]\\/\]-]*\s*$/);
    return match ? match[1].trim() : "";
  };
  const nodeDefRe = /^\s*([A-Za-z0-9_\u4e00-\u9fff-]+)\s*(\(\(|\(\[|{{|[[({]|$)/;
  const edgeRe = /--?[-.>-]*-?/;
  const lines = String(text ?? "").split(/\r?\n/);
  let direction = "TD";
  for (const rawLine of lines) {
    const line = rawLine.replace(/%%.*$/, "").trim();
    if (!line) continue;
    const dirMatch = line.match(/^flowchart\s+(TD|TB|LR|RL|BT)/i);
    if (dirMatch) { direction = /LR|RL/i.test(dirMatch[1]) ? "LR" : "TD"; continue; }
    if (/^(subgraph|end|classDef|class\s|style\s|direction\s)/i.test(line)) continue;
    // 边定义（可能同时携带节点标签定义）
    const edgeMatch = line.match(/^([A-Za-z0-9_\u4e00-\u9fff-]+)\s*(\(\(.*\)\)|\(\\.*\\\)|\[\/.*\/\]|\[\(.*\)\]|{{.*}}|\[.*\]|\(.*\)|\{.*\})?\s*(<?--?[-.>]*)-?\s*(?:\|([^|]*)\|\s*)?([A-Za-z0-9_\u4e00-\u9fff-]+)\s*(\(\(.*\)\)|\(\\.*\\\)|\[\/.*\/\]|\[\(.*\)\]|{{.*}}|\[.*\]|\(.*\)|\{.*\})?\s*$/);
    if (edgeMatch && edgeRe.test(edgeMatch[3] ?? "")) {
      const [, srcRaw, srcShape, arrow, edgeLabel, tgtRaw, tgtShape] = edgeMatch;
      const src = nodeRef(srcRaw, labelOf(srcShape ?? ""), shapeOf(srcShape ?? ""));
      const tgt = nodeRef(tgtRaw, labelOf(tgtShape ?? ""), shapeOf(tgtShape ?? ""));
      if (src && tgt) {
        const dashed = /\.->/.test(arrow) || /-.-/i.test(arrow.replace(/\s/g, ""));
        edges.push({
          source: src.id, target: tgt.id,
          label: (edgeLabel ?? "").trim(),
          style: dashed ? "dashed" : "solid",
          arrow: /-->/.test(arrow) || dashed ? "one" : "none"
        });
      }
      continue;
    }
    // 纯节点定义
    const nodeMatch = line.match(nodeDefRe);
    if (nodeMatch && nodeMatch[0].trim()) {
      const fullShape = line.slice(line.indexOf(nodeMatch[2] ?? "")).trim();
      nodeRef(nodeMatch[1], labelOf(fullShape) || nodeMatch[1], shapeOf(fullShape) ?? undefined);
    }
  }
  const graph = normalizeGraph({
    name: "导入的 Mermaid 图",
    direction,
    nodes: [...nodes.values()].map((node) => ({ ...node, label: node.label || node.id })),
    edges: edges.map((edge) => ({ ...edge, id: newId("e") }))
  });
  return graph;
}

export function toDot(graph) {
  const lines = ["digraph OmniFlow {", '    graph [rankdir=' + (graph.direction === "LR" ? "LR" : "TB") + ', bgcolor="transparent"];', '    node [fontname="Helvetica"];'];
  for (const node of graph.nodes ?? []) {
    const shapeMap = { rect: "box", rounded: "box,style=rounded", pill: "ellipse", diamond: "diamond", ellipse: "ellipse", hexagon: "hexagon", parallelogram: "parallelogram", document: "note" };
    const label = String(node.label ?? "").replace(/"/g, '\\"');
    lines.push(`    "${node.id}" [label="${label}", shape=${shapeMap[node.shape] ?? "box"}, style="filled,rounded", fillcolor="${node.fill}", color="${node.border}", fontcolor="${node.textColor}"];`);
  }
  for (const edge of graph.edges ?? []) {
    const label = String(edge.label ?? "").replace(/"/g, '\\"');
    const style = edge.style === "solid" ? "solid" : edge.style;
    lines.push(`    "${edge.source}" -> "${edge.target}" [label="${label}", color="${edge.color}", style=${style}${edge.arrow === "none" ? ", dir=none" : edge.arrow === "both" ? ", dir=both" : ""}];`);
  }
  lines.push("}");
  return lines.join("\n");
}

export function toMarkdownOutline(graph) {
  const lines = [`# ${graph.name}`, ""];
  if (graph.description) lines.push(graph.description, "");
  lines.push(`> ${graph.nodes?.length ?? 0} 节点 · ${graph.edges?.length ?? 0} 连线 · 方向 ${graph.direction ?? "TD"}`, "");
  const byType = new Map();
  for (const node of graph.nodes ?? []) {
    if (!byType.has(node.type)) byType.set(node.type, []);
    byType.get(node.type).push(node);
  }
  for (const [type, list] of byType) {
    const def = nodeTypeDef(graph, type);
    lines.push(`## ${def.label}（${type}）`, "");
    for (const node of list) lines.push(`- **${node.label}**${node.note ? ` — ${node.note.split("\n")[0]}` : ""}`);
    lines.push("");
  }
  lines.push("## 连线", "");
  for (const edge of graph.edges ?? []) {
    const src = graph.nodes.find((node) => node.id === edge.source);
    const tgt = graph.nodes.find((node) => node.id === edge.target);
    const def = edgeTypeDef(graph, edge.type);
    lines.push(`- ${src?.label ?? edge.source} —[${edge.label || def.label}]→ ${tgt?.label ?? edge.target}`);
  }
  if ((graph.groups ?? []).length) {
    lines.push("", "## 分组", "");
    for (const group of graph.groups ?? []) {
      const labels = (group.members ?? []).map((id) => graph.nodes.find((node) => node.id === id)?.label ?? id);
      lines.push(`- **${group.label}**：${labels.join("、")}`);
    }
  }
  return lines.join("\n");
}

/** agent-flow 工作流 → OmniFlow 图。保留位置与拓扑，门分支变成带是/否标签的边。 */
export async function fromAgentFlow(flowJson) {
  const kindToType = { input: "data", agent: "task", mapAgent: "task", condition: "decision", merge: "process", output: "end" };
  const branchLabel = { true: "是", false: "否", and: "AND", or: "OR", not: "NOT", nand: "NAND", nor: "NOR", xor: "XOR", xnor: "XNOR" };
  const nodes = (flowJson.nodes ?? []).map((node) => ({
    id: node.id,
    type: kindToType[node.kind] ?? "process",
    label: node.data?.label ?? node.id,
    note: node.data?.prompt ?? node.data?.instructions ?? "",
    x: node.position?.x ?? 120,
    y: node.position?.y ?? 120,
    w: node.kind === "condition" ? 150 : 168,
    h: node.kind === "condition" ? 72 : 64
  }));
  const edges = (flowJson.edges ?? []).map((edge) => ({
    id: edge.id ?? newId("e"),
    source: edge.source,
    target: edge.target,
    label: edge.label ?? branchLabel[edge.sourceHandle] ?? "",
    type: edge.sourceHandle === "true" ? "yes" : edge.sourceHandle === "false" ? "no" : "flow"
  }));
  return normalizeGraph({
    name: flowJson.name ?? "AgentFlow 导入",
    description: `从 agent-flow 工作流导入（${new Date().toISOString().slice(0, 10)}）`,
    nodes, edges,
    notes: Object.fromEntries((flowJson.nodes ?? []).filter((node) => node.data?.prompt ?? node.data?.instructions).map((node) => [node.id, node.data?.prompt ?? node.data?.instructions ?? ""]))
  });
}

/** 纯文本大纲（分享用）：节点清单 + 关系清单 + 分组，可直接粘贴到任何地方。 */
export function toPlainText(graph) {
  const label = (id) => graph.nodes.find((n) => n.id === id)?.label ?? id;
  const lines = [];
  lines.push(`# ${graph.name}`);
  if (graph.description) lines.push(graph.description);
  lines.push("", "[节点]");
  for (const n of graph.nodes) {
    lines.push(`- ${n.icon ? n.icon + " " : ""}${n.label}（${n.type}）${n.note ? " — " + String(n.note).split("\n")[0] : ""}`);
  }
  lines.push("", "[关系]");
  for (const e of graph.edges) {
    lines.push(`- ${label(e.source)} --${e.label || e.type || "关联"}--> ${label(e.target)}`);
  }
  for (const g of graph.groups ?? []) {
    const members = (g.members ?? []).map((id) => label(id)).join("、");
    lines.push("", `[分组] ${g.label}：${members}`);
  }
  return lines.join("\n");
}
