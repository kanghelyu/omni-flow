// 分组建议引擎：按节点类型自动生成 四类标准分组建议。
// 保证机制之一：of_analyze / /analyze 永远携带 groupSuggestions，agent 照抄即得合规分组。
import { newId } from "./graph-core.js";

const RULES = [
  { key: "pipeline", label: "核心结论链", labelEn: "Pipeline", color: "#2563EB",
    types: ["proposition", "theorem", "corollary"] },
  { key: "mechanism", label: "理论机制", labelEn: "Mechanism", color: "#7C3AED",
    types: ["definition", "lemma"] },
  { key: "outlook", label: "展望与应用", labelEn: "Outlook & applications", color: "#D97706",
    types: ["process", "milestone", "task", "goal", "idea"] },
  { key: "references", label: "关键文献", labelEn: "Key references", color: "#059669",
    types: ["paper"] }
];

/** 返回建议分组（未落库）。已在任何组内的节点不重复建议。 */
export function suggestGroups(graph) {
  const grouped = new Set((graph.groups ?? []).flatMap((g) => g.members ?? []));
  const out = [];
  for (const rule of RULES) {
    const members = graph.nodes
      .filter((n) => rule.types.includes(n.type) && !grouped.has(n.id))
      .map((n) => n.id);
    if (members.length === 0) continue;
    out.push({ id: newId("g"), label: rule.label, labelEn: rule.labelEn, color: rule.color, members });
  }
  // 兜底：未归类的零散节点（start/end/person/department 等自定义类型）
  const placed = new Set(out.flatMap((g) => g.members));
  const others = graph.nodes.filter((n) => !placed.has(n.id) && !grouped.has(n.id)).map((n) => n.id);
  if (others.length >= 2) {
    out.push({ id: newId("g"), label: "其他节点", labelEn: "Others", color: "#64748B", members: others });
  }
  return out;
}
