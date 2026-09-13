/* 分组拖拽修复的端到端验收：拖框 → 提交 → 校验 rect 覆盖 → 重载不散架 */
const BASE = "http://127.0.0.1:4319";
const GID = "HumanCardiomyocyteMitosi-tnez";
const api = async (path, body)=>{
  const r = await fetch(BASE + path, { method: body ? "POST" : "GET", headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  return r.json();
};
const graph = async ()=> (await api(`/api/graph/${encodeURIComponent(GID)}`));

let pass = 0, fail = 0;
const t = (n, c, extra = "")=> { if (c){ pass++; console.log("✓", n); } else { fail++; console.log("✗", n, extra); } };

const before = await graph();
const group = before.groups.sort((a, b)=> b.members.length - a.members.length)[0];
const members = group.members.map((id)=> before.nodes.find((n)=> n.id === id)).filter(Boolean);
console.log(`组「${group.label}」成员 ${members.length} 个，rect = ${JSON.stringify(group.rect ?? null)}`);

// ① 第一次拖动：整体位移 (+140, +90)
const D1 = { x: 140, y: 90 };
const moves1 = members.map((m)=> ({ nodeId: m.id, x: m.x + D1.x, y: m.y + D1.y }));
const r1 = await api(`/api/graph/${encodeURIComponent(GID)}/group-commit`, { groupId: group.id, moves: moves1 });
t("① commit 返回 rect", !!r1.rect, JSON.stringify(r1).slice(0, 120));
t("① commit 移动了全部成员", r1.moved === members.length, `moved=${r1.moved}`);

const after1 = await graph();
const g1 = after1.groups.find((x)=> x.id === group.id);
const m1 = group.members.map((id)=> after1.nodes.find((n)=> n.id === id));
t("① 成员位移已落盘", group.members.every((id, i)=>{
  const a = members[i], b = m1[i];
  return b.x === a.x + D1.x && b.y === a.y + D1.y;
}));
t("① 组框几何已持久化", !!g1.rect, JSON.stringify(g1.rect));
const expect1 = (()=>{
  const minX = Math.min(...m1.map((m)=> m.x)) - 24, minY = Math.min(...m1.map((m)=> m.y)) - 34;
  const maxX = Math.max(...m1.map((m)=> m.x + m.w)) + 24, maxY = Math.max(...m1.map((m)=> m.y + m.h)) + 24;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
})();
t("① rect 与成员包围盒一致（贴合）", Math.abs(g1.rect.x - expect1.x) <= 1 && Math.abs(g1.rect.w - expect1.w) <= 1,
  `rect=${JSON.stringify(g1.rect)} expect=${JSON.stringify(expect1)}`);

// ② 第二次拖动：再位移 (+60, -40) → rect 必须被**覆盖**而非累加/扩张
const D2 = { x: 60, y: -40 };
const moves2 = m1.map((m)=> ({ nodeId: m.id, x: m.x + D2.x, y: m.y + D2.y }));
const r2 = await api(`/api/graph/${encodeURIComponent(GID)}/group-commit`, { groupId: group.id, moves: moves2 });
const after2 = await graph();
const g2 = after2.groups.find((x)=> x.id === group.id);
t("② 位移累加正确", g2.rect.x === g1.rect.x + D2.x && g2.rect.y === g1.rect.y + D2.y,
  `g1=${g1.rect.x},${g1.rect.y} → g2=${g2.rect.x},${g2.rect.y}`);
t("② 尺寸未漂移（宽高不变）", g2.rect.w === g1.rect.w && g2.rect.h === g1.rect.h,
  `w ${g1.rect.w}→${g2.rect.w}, h ${g1.rect.h}→${g2.rect.h}`);

// ③ 只移动组内单个节点 → rect 不应变化（已固定）
const one = m1[0];
await api(`/api/graph/${encodeURIComponent(GID)}/position`, { nodeId: one.id, x: one.x + 400, y: one.y + 400 });
const after3 = await graph();
const g3 = after3.groups.find((x)=> x.id === group.id);
t("③ 单节点移动不改变已固定 rect", g3.rect.x === g2.rect.x && g3.rect.w === g2.rect.w);

// ④ 重新贴合：显式重算（把跑远的节点收回框内）
const all = group.members.map((id)=> after3.nodes.find((n)=> n.id === id));
await api(`/api/graph/${encodeURIComponent(GID)}/group-commit`, { groupId: group.id, moves: all.map((m)=> ({ nodeId: m.id, x: m.x, y: m.y })) });
const g4 = (await graph()).groups.find((x)=> x.id === group.id);
t("④ 重新贴合后 rect 覆盖了膨胀", g4.rect.x <= g3.rect.x && g4.rect.w >= g3.rect.w, JSON.stringify(g4.rect));

// 复原（把节点还原到最初位置，避免污染用户数据）
await api(`/api/graph/${encodeURIComponent(GID)}/group-commit`, {
  groupId: group.id,
  moves: members.map((m)=> ({ nodeId: m.id, x: m.x, y: m.y })),
  rect: null,
});
const gFinal = (await graph()).groups.find((x)=> x.id === group.id);
t("⑤ 复原后回到自动贴合（rect 已清除）", gFinal.rect === undefined || gFinal.rect === null);

console.log(`\n${pass}/${pass + fail} 通过`);
process.exit(fail ? 1 : 0);
