// End-to-end LaTeX gate: invalid math must be rejected, valid math accepted, shorthands normalised.
// This is the executable form of hard rule R1: any change that weakens the gate fails here.
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

// (1) invalid LaTeX note → must be rejected
const bad = await j(`/api/graph/${id}/note`, { method: "POST", body: JSON.stringify({ nodeId: nid, content: "定理 $\\frac{a}{b$ 不闭合" }) });
t("invalid note rejected", bad.status >= 400, `status=${bad.status} ${String(bad.data.error ?? "").slice(0, 60)}`);

// (2) valid LaTeX note → accepted
const good = await j(`/api/graph/${id}/note`, { method: "POST", body: JSON.stringify({ nodeId: nid, content: "定理 $$\\int_0^1 x^2 dx=\\frac13$$ 成立" }) });
t("valid note accepted", good.status === 200, `status=${good.status}`);

// (3) self-defined macro → rejected with a fix hint
const macro = await j(`/api/graph/${id}/node-patch`, { method: "POST", body: JSON.stringify({ nodeId: nid, patch: { label: "设 $\\myVec{v}$ 为向量" } }) });
t("self-defined macro rejected", macro.status >= 400, String(macro.data.error ?? "").replace(/\s+/g, " ").slice(0, 80));

// (4) shorthand (\RR) → normalised, then accepted
const short = await j(`/api/graph/${id}/node-patch`, { method: "POST", body: JSON.stringify({ nodeId: nid, patch: { label: "设 $\\RR^n \\to \\ZZ$" } }) });
t("shorthand normalised then accepted", short.status === 200, `status=${short.status}`);
const after = await j("/api/graph/" + id);
const lbl = after.data.nodes.find((n) => n.id === nid).label;
t("stored text uses standard commands", lbl.includes("\\mathbb{R}") && !lbl.includes("\\RR"), lbl.slice(0, 40));

// (5) code-fenced sample source → exempt (the legitimate escape hatch)
const fenced = await j(`/api/graph/${id}/note`, { method: "POST", body: JSON.stringify({ nodeId: nid, content: "示例：\n```\n\\begin{tikzpicture}\\draw (0,0);\\end{tikzpicture}\n```\n以上是原始源码。" }) });
t("code-fenced source exempt", fenced.status === 200, `status=${fenced.status}`);

// (6) \tag auto-converted (works inline too)
const tagRes = await j(`/api/graph/${id}/note`, { method: "POST", body: JSON.stringify({ nodeId: nid, content: "$\\operatorname{Tr}(z)=-1 \\tag{2.7}$" }) });
t("inline \\tag converted to text", tagRes.status === 200, `status=${tagRes.status}`);

// (7) unclosed delimiter: previously silent plain text, now must be blocked
const unclosed = await j(`/api/graph/${id}/node-patch`, { method: "POST", body: JSON.stringify({ nodeId: nid, patch: { label: "等价 (7) · Minimal polynomial irreducible $\\iff$ $" } }) });
t("unclosed $ rejected", unclosed.status >= 400, `status=${unclosed.status} ${String(unclosed.data.error ?? "").slice(0, 70)}`);

// (8) an escaped dollar is legitimate and must not be flagged
const escaped = await j(`/api/graph/${id}/node-patch`, { method: "POST", body: JSON.stringify({ nodeId: nid, patch: { label: "价格 \\$5 与 $x>0$ 无关" } }) });
t("escaped \\$ not flagged", escaped.status === 200, `status=${escaped.status}`);

if (studio.close) await studio.close(); else if (studio.server) studio.server.close();
let ok = 0;
for (const r of results){
  if (r.pass) ok++;
  console.log(`${r.pass ? "  ✓" : "  ✗"} ${r.name.padEnd(24)} ${r.extra}`);
}
console.log(`\n${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
