// LaTeX 防线端到端测试：验证「非法公式必须被拒、合法公式必须通过、简写必须自动规范化」。
// 这是 R1 红线的可执行版本——任何让校验失效的改动都会在此暴露。
import { startStudioServer } from "../studio/server.mjs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = await mkdtemp(join(tmpdir(), "of-guard-"));
const studio = await startStudioServer({ root, port: 0 });
const base = "http://127.0.0.1:" + studio.port;
const j = async (p, opt) => {
  const r = await fetch(base + p, { headers: { "content-type": "application/json" }, ...opt });
  return { status: r.status, data: await r.json() };
};

const c = await j("/api/graphs", { method: "POST", body: JSON.stringify({ name: "防线测试", template: "blank" }) });
const id = c.data.id;
const g = await j("/api/graph/" + id);
const nid = g.data.nodes[0].id;

const results = [];
const t = (name, pass, extra = "") => results.push({ name, pass: !!pass, extra });

// ① 非法 LaTeX 备注 → 必须被拒
const bad = await j(`/api/graph/${id}/note`, { method: "POST", body: JSON.stringify({ nodeId: nid, content: "定理 $\\frac{a}{b$ 不闭合" }) });
t("非法公式备注被拒绝", bad.status >= 400, `status=${bad.status} ${String(bad.data.error ?? "").slice(0, 60)}`);

// ② 合法 LaTeX 备注 → 通过
const good = await j(`/api/graph/${id}/note`, { method: "POST", body: JSON.stringify({ nodeId: nid, content: "定理 $$\\int_0^1 x^2 dx=\\frac13$$ 成立" }) });
t("合法公式备注写入成功", good.status === 200, `status=${good.status}`);

// ③ 自定义宏 → 拒绝并给出修法
const macro = await j(`/api/graph/${id}/node-patch`, { method: "POST", body: JSON.stringify({ nodeId: nid, patch: { label: "设 $\\myVec{v}$ 为向量" } }) });
t("自定义宏被拒绝", macro.status >= 400, String(macro.data.error ?? "").replace(/\s+/g, " ").slice(0, 80));

// ④ 简写（\RR）→ 自动规范化后通过
const short = await j(`/api/graph/${id}/node-patch`, { method: "POST", body: JSON.stringify({ nodeId: nid, patch: { label: "设 $\\RR^n \\to \\ZZ$" } }) });
t("简写自动规范化后通过", short.status === 200, `status=${short.status}`);
const after = await j("/api/graph/" + id);
const lbl = after.data.nodes.find((n) => n.id === nid).label;
t("落库内容已转为标准命令", lbl.includes("\\mathbb{R}") && !lbl.includes("\\RR"), lbl.slice(0, 40));

// ⑤ 代码围栏里的示例源码 → 豁免（正当出口）
const fenced = await j(`/api/graph/${id}/note`, { method: "POST", body: JSON.stringify({ nodeId: nid, content: "示例：\n```\n\\begin{tikzpicture}\\draw (0,0);\\end{tikzpicture}\n```\n以上是原始源码。" }) });
t("代码围栏内示例源码豁免", fenced.status === 200, `status=${fenced.status}`);

// ⑥ tag 自动转换（行内也能编译）
const tagRes = await j(`/api/graph/${id}/note`, { method: "POST", body: JSON.stringify({ nodeId: nid, content: "$\\operatorname{Tr}(z)=-1 \\tag{2.7}$" }) });
t("行内 \\tag 自动转文本后通过", tagRes.status === 200, `status=${tagRes.status}`);

if (studio.close) await studio.close(); else if (studio.server) studio.server.close();
let ok = 0;
for (const r of results){
  if (r.pass) ok++;
  console.log(`${r.pass ? "  ✓" : "  ✗"} ${r.name.padEnd(24)} ${r.extra}`);
}
console.log(`\n${ok}/${results.length} 通过`);
process.exit(ok === results.length ? 0 : 1);
