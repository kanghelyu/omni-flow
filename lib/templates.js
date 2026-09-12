// OmniFlow 领域模板：一键创建带真实示例内容的图，覆盖调研发现的典型场景。
// 每个模板提供 zh / en 双语示例内容；templateSummaries(lang) 驱动选择器文案。
// 自定义模板（agent 可创建）：存 ~/.omni-flow/templates/<id>.json，与内置模板合并使用。
import { readdir, readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { normalizeGraph } from "./graph-core.js";

function N(id, type, label, x, y, extra = {}) {
  return { id, type, label, x, y, ...extra };
}
function E(source, target, type, label = "") {
  return { id: `e-${source}-${target}`, source, target, type, label };
}

export const TEMPLATES = {
  blank: {
    id: "blank", name: "空白图", nameEn: "Blank canvas",
    desc: "从零开始，一切关系图都从这里长出来。",
    descEn: "Start from scratch — every kind of graph grows from here.",
    build: (lang = "zh") => normalizeGraph({
      name: lang === "en" ? "Untitled" : "未命名图",
      nodes: [N("n1", "start", lang === "en" ? "Start" : "开始", 160, 120), N("n2", "process", lang === "en" ? "Step" : "第一步", 420, 120), N("n3", "end", lang === "en" ? "End" : "结束", 680, 120)],
      edges: [E("n1", "n2", "flow"), E("n2", "n3", "flow")]
    })
  },
  "theorem-deps": {
    id: "theorem-deps", name: "定理依赖分析", nameEn: "Theorem dependencies",
    desc: "单篇数学文章内部的定义 → 引理 → 命题 → 定理依赖链，附外部文献引用。",
    descEn: "Definition → lemma → proposition → theorem proof chain inside one math paper, with external citations.",
    build: (lang = "zh") => {
      const en = lang === "en";
      return normalizeGraph({
        name: en ? "Theorem dependency example" : "定理依赖分析示例",
        description: en ? "Proof dependency chain of definitions/lemmas/propositions/theorems; amber document nodes are external references." : "定义/引理/命题/定理的证明依赖链；黄色 document 节点是外部引用。",
        direction: "TD",
        nodes: [
          N("def-sub", "definition", en ? "Def 2.1 Center Z(G) of group G" : "定义 2.1 群 G 的中心 Z(G)", 80, 80),
          N("def-wgt", "definition", en ? "Def 3.1 wg-Grassmann manifold" : "定义 3.1 wg-Grassmann 流形", 360, 80),
          N("lem-1", "lemma", en ? "Lemma 3.2 Center elements are conjugacy-invariant" : "引理 3.2 中心元共轭不变", 80, 230, { w: 190 }),
          N("prop-1", "proposition", en ? "Prop 3.4 Parametrization of closed orbits" : "命题 3.4 闭轨道参数化", 360, 230, { w: 190 }),
          N("thm-1", "theorem", en ? "Theorem 4.1 Main theorem: classification" : "定理 4.1 主定理：分类结果", 220, 390, { w: 210 }),
          N("ext-sl2", "paper", en ? "Ref: Collingwood–McGovern" : "外部引用：Collingwood–McGovern", 560, 390, { w: 190, note: en ? "Nilpotent Orbits in Semisimple Lie Algebras — doi:10.1007/978-1-4612-0881-2 · local: ~/Books/nilpotent-orbits.pdf" : "半单李代数中的幂零轨道 — doi:10.1007/978-1-4612-0881-2 · 本地: ~/Books/nilpotent-orbits.pdf" })
        ],
        edges: [
          E("def-sub", "lem-1", "uses"), E("def-wgt", "prop-1", "uses"),
          E("lem-1", "thm-1", "depends-on"), E("prop-1", "thm-1", "depends-on"),
          E("ext-sl2", "thm-1", "cites")
        ]
      });
    }
  },
  "paper-map": {
    id: "paper-map", name: "论文关联分析", nameEn: "Paper relation map",
    desc: "多篇论文之间的继承、引用、推广与矛盾关系（跨论文依赖分析）。",
    descEn: "How papers extend, cite, generalize or contradict each other (cross-paper dependency analysis).",
    build: (lang = "zh") => {
      const en = lang === "en";
      return normalizeGraph({
        name: en ? "Paper relation example" : "论文关联分析示例",
        description: en ? "Cross-paper dependencies: extends / cites / generalizes / contradicts." : "跨论文依赖：继承/引用/推广/矛盾。",
        direction: "LR",
        nodes: [
          N("p1", "paper", en ? "W-algebra construction (1981)" : "W-algebras 构造奠基 (1981)", 80, 100, { w: 200 }),
          N("p2", "paper", en ? "Finite W-algebra representations (2007)" : "有限 W-代数表示 (2007)", 380, 80, { w: 210 }),
          N("p3", "paper", en ? "Slodowy slices & affine Grassmannian" : "Slodowy 切片与仿射 Grassmannian", 380, 240, { w: 220 }),
          N("p4", "paper", en ? "Finite representations over Yangians" : "Yangian 上的有限表示", 700, 100, { w: 200 }),
          N("p5", "paper", en ? "Counterexample: dim formula at e" : "反例：单位元处的维数公式", 700, 280, { w: 210 })
        ],
        edges: [
          E("p1", "p2", "extends", en ? "groundwork" : "理论奠基"), E("p1", "p3", "cites"),
          E("p3", "p2", "uses", en ? "geometric method" : "几何方法"), E("p2", "p4", "extends"),
          E("p5", "p4", "contradicts", en ? "fixes dim formula" : "修正维数公式")
        ]
      });
    }
  },
  "task-raci": {
    id: "task-raci", name: "项目任务分工 (RACI)", nameEn: "Task RACI map",
    desc: "任务 × 角色矩阵的图形式：R 执行 / A 问责 / C 咨询 / I 知会，一眼看出谁过载。",
    descEn: "Task × role map: R responsible / A accountable / C consulted / I informed — spot overload at a glance.",
    build: (lang = "zh") => {
      const en = lang === "en";
      const person = { fill: "#F472B6", border: "#DB2777" };
      return normalizeGraph({
        name: en ? "Task RACI example" : "项目任务分工示例",
        description: en ? "R = responsible, A = accountable, C = consulted, I = informed; edge colors encode the role." : "R=执行 A=问责 C=咨询 I=知会；连线颜色区分职责类型。",
        nodes: [
          N("pm", "person", en ? "Product manager" : "产品经理", 400, 60, person),
          N("dev", "person", en ? "Developer" : "开发工程师", 200, 60, person),
          N("qa", "person", en ? "QA engineer" : "测试工程师", 620, 60, person),
          N("t1", "task", en ? "Requirement review" : "需求评审", 160, 220),
          N("t2", "task", en ? "Feature development" : "功能开发", 400, 220),
          N("t3", "task", en ? "Integration testing" : "集成测试", 640, 220),
          N("t4", "task", en ? "Release" : "发布上线", 400, 360)
        ],
        edges: [
          E("pm", "t1", "raci-a", "A"), E("dev", "t1", "raci-r", "R"), E("qa", "t1", "raci-i", "I"),
          E("pm", "t2", "raci-c", "C"), E("dev", "t2", "raci-r", "R"),
          E("dev", "t3", "raci-c", "C"), E("qa", "t3", "raci-r", "R"), E("pm", "t3", "raci-i", "I"),
          E("t1", "t2", "depends-on", en ? "prereq" : "前置"), E("t2", "t3", "depends-on", en ? "prereq" : "前置"),
          E("t3", "t4", "depends-on", en ? "prereq" : "前置"), E("pm", "t4", "raci-a", "A")
        ]
      });
    }
  },
  "org-structure": {
    id: "org-structure", name: "公司运营架构", nameEn: "Org structure",
    desc: "部门层级与汇报线，支持按部门分组着色。",
    descEn: "Department hierarchy and reporting lines, with per-division colored groups.",
    build: (lang = "zh") => {
      const en = lang === "en";
      return normalizeGraph({
        name: en ? "Org structure example" : "公司运营架构示例",
        groups: [
          { id: "g-tech", label: en ? "Tech" : "技术线", color: "#2563EB", members: ["d-dev", "d-qa", "d-ops"] },
          { id: "g-biz", label: en ? "Business" : "业务线", color: "#DC2626", members: ["d-sales", "d-support"] }
        ],
        nodes: [
          N("ceo", "person", "CEO", 400, 60, { w: 150 }),
          N("d-dev", "department", en ? "Engineering" : "研发部", 160, 200),
          N("d-qa", "department", en ? "Quality" : "质量部", 400, 200),
          N("d-ops", "department", en ? "Operations" : "运维部", 640, 200),
          N("d-sales", "department", en ? "Sales" : "销售部", 280, 340),
          N("d-support", "department", en ? "Customer support" : "客服部", 520, 340)
        ],
        edges: [
          E("ceo", "d-dev", "reports-to"), E("ceo", "d-qa", "reports-to"), E("ceo", "d-ops", "reports-to"),
          E("ceo", "d-sales", "reports-to"), E("ceo", "d-support", "reports-to")
        ]
      });
    }
  },
  "research-collab": {
    id: "research-collab", name: "科研项目合作分工", nameEn: "Research collaboration",
    desc: "PI / 博士后 / 博士生分工与成果产出依赖（人类合作模式映射）。",
    descEn: "PI / postdoc / PhD students division of labor and deliverable dependencies.",
    build: (lang = "zh") => {
      const en = lang === "en";
      const gold = { fill: "#FBBF24", border: "#D97706" };
      return normalizeGraph({
        name: en ? "Research collaboration example" : "科研项目合作分工示例",
        nodes: [
          N("pi", "person", en ? "PI (professor)" : "PI 教授", 400, 60, gold),
          N("postdoc", "person", en ? "Postdoc" : "博士后", 160, 200, gold),
          N("phd1", "person", en ? "PhD student A" : "博士生 A", 400, 200, gold),
          N("phd2", "person", en ? "PhD student B" : "博士生 B", 640, 200, gold),
          N("w-theory", "task", en ? "Theory proofs" : "理论证明", 160, 350, { status: "doing" }),
          N("w-sim", "task", en ? "Numerical simulation" : "数值模拟", 400, 350, { status: "doing" }),
          N("w-paper", "task", en ? "Paper writing" : "论文撰写", 640, 350, { status: "todo" }),
          N("m-goal", "milestone", en ? "Submit to arXiv" : "投稿 arXiv", 400, 500)
        ],
        edges: [
          E("pi", "postdoc", "flow", en ? "advises" : "指导"), E("pi", "phd1", "flow", en ? "advises" : "指导"), E("pi", "phd2", "flow", en ? "advises" : "指导"),
          E("postdoc", "w-theory", "raci-r", "R"), E("phd1", "w-sim", "raci-r", "R"),
          E("phd2", "w-paper", "raci-r", "R"), E("pi", "w-paper", "raci-a", "A"),
          E("w-theory", "w-paper", "depends-on", en ? "results feed in" : "结果输入"), E("w-sim", "w-paper", "depends-on", en ? "figures feed in" : "图表输入"),
          E("w-paper", "m-goal", "flow")
        ]
      });
    }
  },
  "conversation-map": {
    id: "conversation-map", name: "对话关联分析", nameEn: "Conversation map",
    desc: "多个会话/话题之间的接续、回应与汇聚关系（跨会话知识追踪）。",
    descEn: "How sessions/topics continue, answer and converge into each other (cross-session knowledge tracking).",
    build: (lang = "zh") => {
      const en = lang === "en";
      return normalizeGraph({
        name: en ? "Conversation map example" : "对话关联分析示例",
        nodes: [
          N("c1", "topic", en ? "Session: product naming" : "会话：产品命名讨论", 120, 100, { w: 200 }),
          N("c2", "topic", en ? "Session: ledger app rebuild" : "会话：记账 App 重构", 120, 260, { w: 200 }),
          N("c3", "topic", en ? "Session: brand unification (lilpig)" : "会话：品牌统一（lilpig）", 440, 180, { w: 210 }),
          N("i1", "idea", en ? "Decision: rename to Lil Pig" : "结论：更名小猪账本", 760, 100, { w: 190 }),
          N("n1", "note", en ? "TODO: domain & site migration" : "待办：域名/网站迁移", 760, 280, { w: 190 })
        ],
        edges: [
          E("c1", "c3", "follows", en ? "continues topic" : "延续话题"), E("c2", "c3", "merges", en ? "converges decision" : "汇聚决策"),
          E("c3", "i1", "answers", en ? "produces decision" : "产出结论"), E("i1", "n1", "depends-on", en ? "spawns task" : "派生任务")
        ]
      });
    }
  }
};

export function buildTemplate(templateId, name, lang = "zh") {
  const template = TEMPLATES[templateId] ?? TEMPLATES.blank;
  const graph = template.build(lang);
  graph.name = name?.trim() || (lang === "en" ? template.nameEn : template.name);
  return graph;
}

export function templateSummaries(lang = "zh") {
  const en = lang === "en";
  return Object.values(TEMPLATES).map((template) => ({
    id: template.id,
    name: en ? template.nameEn : template.name,
    desc: en ? template.descEn : template.desc,
    custom: false
  }));
}

/* ================= 自定义模板（agent 开放接口） =================
   存储于 <root>/templates/<id>.json：
   { id, name, nameEn?, desc?, descEn?, direction?, nodes[], edges[], groups[] } */

const TPL_ID_RE = /^[a-zA-Z0-9_-]{2,48}$/;
function tplDir(root) { return join(root, "templates"); }

export async function listCustomTemplates(root) {
  let files = [];
  try {
    files = (await readdir(tplDir(root))).filter((f) => f.endsWith(".json"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return [];
  }
  const out = [];
  for (const file of files) {
    try {
      const def = JSON.parse(await readFile(join(tplDir(root), file), "utf8"));
      if (def && typeof def.id === "string") out.push(def);
    } catch { /* 跳过坏文件 */ }
  }
  return out;
}

export async function saveCustomTemplate(root, def) {
  const id = String(def.templateId ?? "").trim();
  if (!TPL_ID_RE.test(id)) throw new Error(`templateId 非法（2-48 位字母/数字/-/_）：${id}`);
  const nodes = Array.isArray(def.nodes) ? def.nodes : [];
  if (nodes.length === 0) throw new Error("模板至少需要一个节点");
  if (!String(def.name ?? "").trim()) throw new Error("模板需要 name");
  const record = {
    id,
    name: String(def.name).trim(),
    nameEn: def.nameEn ? String(def.nameEn).trim() : undefined,
    desc: String(def.desc ?? ""),
    descEn: def.descEn ? String(def.descEn).trim() : undefined,
    direction: def.direction === "LR" ? "LR" : "TD",
    nodes: nodes.map((node) => ({ id: node.id, type: node.type, label: node.label, x: node.x, y: node.y, w: node.w, h: node.h, fill: node.fill, border: node.border, textColor: node.textColor, icon: node.icon })),
    edges: (Array.isArray(def.edges) ? def.edges : []).map((edge) => ({ source: edge.source, target: edge.target, type: edge.type ?? "", label: edge.label ?? "" })),
    groups: Array.isArray(def.groups) ? def.groups.map((g) => ({ id: g.id, label: g.label, color: g.color, members: g.members })) : []
  };
  await mkdir(tplDir(root), { recursive: true });
  await writeFile(join(tplDir(root), `${id}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return { ok: true, id, custom: true };
}

export async function deleteCustomTemplate(root, id) {
  if (!TPL_ID_RE.test(String(id))) throw new Error(`templateId 非法：${id}`);
  await unlink(join(tplDir(root), `${id}.json`)); // 精确单文件删除
  return { ok: true, id };
}

export async function mergedTemplateSummaries(root, lang = "zh") {
  const en = lang === "en";
  const builtin = templateSummaries(lang);
  const custom = (await listCustomTemplates(root)).map((def) => ({
    id: def.id,
    name: (en ? def.nameEn : def.name) ?? def.name,
    desc: (en ? def.descEn : def.desc) ?? def.desc ?? "",
    custom: true
  }));
  return [...builtin, ...custom];
}

/** 建图入口：先查内置模板，再查自定义模板。 */
export async function buildTemplateById(root, templateId, name, lang = "zh") {
  const en = lang === "en";
  if (TEMPLATES[templateId]) return buildTemplate(templateId, name, lang);
  const custom = (await listCustomTemplates(root)).find((def) => def.id === templateId);
  if (!custom) throw new Error(`模板不存在：${templateId}`);
  const graph = normalizeGraph({
    name: name?.trim() || (en ? custom.nameEn : custom.name) || custom.name,
    description: (en ? custom.descEn : custom.desc) ?? custom.desc ?? "",
    direction: custom.direction,
    nodes: custom.nodes,
    edges: custom.edges,
    groups: custom.groups
  });
  return graph;
}
