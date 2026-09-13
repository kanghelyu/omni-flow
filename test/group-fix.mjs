// Group-box geometry, end to end, on a throwaway graph and a throwaway server.
// This file used to point at a real map in the user's storage (`GID = "HumanCardiomyocyteMitosi-tnez"`),
// so every run mutated real data — including running a real layout over it. Never again: it now
// creates its own graph, drives it over HTTP, and deletes it at the end.
import { startStudioServer } from "../studio/server.mjs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = await mkdtemp(join(tmpdir(), "of-groupfix-"));
const studio = await startStudioServer({ root, port: 0 });
const BASE = `http://127.0.0.1:${studio.port}`;
const api = async (path, body) => {
  const r = await fetch(BASE + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
};

let pass = 0, fail = 0;
const t = (n, c, extra = "") => { if (c) { pass++; console.log("✓", n); } else { fail++; console.log("✗", n, extra); } };

// ---- build a throwaway graph with four cards and one group ----
const GID = (await api("/api/graphs", { name: "group geometry", template: "blank" })).id;
for (const [label, x, y] of [["A", 120, 140], ["B", 380, 140], ["C", 120, 320], ["D", 380, 320]]) {
  await api(`/api/graph/${GID}/node-add`, { label, x, y });
}
const graph = async () => api(`/api/graph/${GID}`);
const before = await graph();
await api(`/api/graph/${GID}/group-add`, { label: "G", color: "#2563EB", members: before.nodes.map((n) => n.id) });
const start = await graph();
const g0 = start.groups[0];
const members = g0.members.map((id) => start.nodes.find((n) => n.id === id)).filter(Boolean);
console.log(`group「${g0.label}」with ${members.length} members, rect = ${JSON.stringify(g0.rect ?? null)}`);
t("group holds every member", members.length === before.nodes.length, `${members.length}/${before.nodes.length}`);

// ① commit: move the whole group by (+140, +90) and let the server fit the box
const D1 = { x: 140, y: 90 };
const r1 = await api(`/api/graph/${GID}/group-commit`, { groupId: g0.id, moves: members.map((m) => ({ nodeId: m.id, x: m.x + D1.x, y: m.y + D1.y })) });
t("① commit returns a rect", !!r1.rect, JSON.stringify(r1).slice(0, 120));
t("① commit moved every member", r1.moved === members.length, `moved=${r1.moved}`);

const after1 = await graph();
const g1 = after1.groups.find((x) => x.id === g0.id);
t("① member offsets are persisted", g0.members.every((id, i) => {
  const a = members[i], b = after1.nodes.find((n) => n.id === id);
  return b.x === a.x + D1.x && b.y === a.y + D1.y;
}));
t("① box geometry is persisted", !!g1.rect, JSON.stringify(g1.rect));
t("① rect fits the members", (() => {
  const xs = g0.members.map((id) => after1.nodes.find((n) => n.id === id).x);
  const ys = g0.members.map((id) => after1.nodes.find((n) => n.id === id).y);
  return g1.rect.x === Math.round(Math.min(...xs) - 24) && g1.rect.y === Math.round(Math.min(...ys) - 34);
})(), JSON.stringify(g1.rect));

// ② a second move accumulates instead of drifting
const D2 = { x: 60, y: 40 };
await api(`/api/graph/${GID}/group-commit`, { groupId: g0.id, moves: members.map((m) => ({ nodeId: m.id, x: m.x + D1.x + D2.x, y: m.y + D1.y + D2.y })) });
const g2 = (await graph()).groups.find((x) => x.id === g0.id);
t("② offsets accumulate without drift", g2.rect.w === g1.rect.w, `${g1.rect.w} → ${g2.rect.w}`);

// ③ moving a single node must not silently rewrite the pinned box
await api(`/api/graph/${GID}/position`, { nodeId: members[0].id, x: members[0].x + 900, y: members[0].y + 900 });
const g3 = (await graph()).groups.find((x) => x.id === g0.id);
t("③ single-node move leaves the pinned rect alone", g3.rect.x === g2.rect.x && g3.rect.w === g2.rect.w, JSON.stringify(g3.rect));

// ④ re-fit: an explicit commit with no rect re-derives the box from the members (covering the drift)
const snapshot = await graph();
await api(`/api/graph/${GID}/group-commit`, { groupId: g0.id, moves: g0.members.map((id) => {
  const n = snapshot.nodes.find((x) => x.id === id);
  return { nodeId: id, x: n.x, y: n.y };
}) });
const g4 = (await graph()).groups.find((x) => x.id === g0.id);
t("④ re-fit overwrites the inflated rect", g4.rect.x <= g3.rect.x && g4.rect.w >= g3.rect.w, JSON.stringify(g4.rect));

// ⑤ rect = null clears the pin, so the box goes back to auto-fitting
await api(`/api/graph/${GID}/group-commit`, { groupId: g0.id, moves: [], rect: null });
const g5 = (await graph()).groups.find((x) => x.id === g0.id);
t("⑤ rect=null clears the pinned geometry", !g5.rect, JSON.stringify(g5.rect));

// ⑥ an explicit re-layout must re-fit every box: a rect that survives a layout would stay behind
//    while its cards moved away.
await api(`/api/graph/${GID}/group-commit`, { groupId: g0.id, moves: [], rect: { x: 5000, y: 5000, w: 120, h: 120 } });
const gPinned = (await graph()).groups.find((x) => x.id === g0.id);
t("⑥ precondition: geometry can be pinned", !!gPinned.rect, JSON.stringify(gPinned.rect));
await api(`/api/graph/${GID}/layout`, { mode: "layered" });
const gLaid = (await graph()).groups.find((x) => x.id === g0.id);
t("⑥ layout drops the pinned geometry (the box follows its members)", !gLaid.rect, JSON.stringify(gLaid.rect ?? null));

// cleanup: the graph is throwaway
await api(`/api/graph/${GID}/graph-delete`, {});
console.log(`\n${pass}/${pass + fail} passed`);
if (studio.close) await studio.close(); else if (studio.server) studio.server.close();
process.exit(fail ? 1 : 0);
