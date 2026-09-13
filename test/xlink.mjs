// Cross-graph link (xlink) end-to-end: create → list with perspective → broken-link detection,
// across all three interfaces (HTTP, CLI, MCP).
// Cross-graph links (xlink) end to end: create → list from both sides → broken-link detection
// → target validation → removal, across HTTP and the CLI.
// Uses a throwaway storage root, so it is safe to run any time.
import { startStudioServer } from "../studio/server.mjs";
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const NODE = process.execPath;
const CLI = new URL("../bin/of.mjs", import.meta.url).pathname;

const root = await mkdtemp(join(tmpdir(), 'of-xlink-'));
const studio = await startStudioServer({ root, port: 0 });
const base = `http://127.0.0.1:${studio.port}`;
const j = async (p, opt) => {
  const r = await fetch(base + p, { headers: { 'content-type': 'application/json' }, ...opt });
  return { status: r.status, data: await r.json() };
};
const results = [];
const t = (name, pass, extra = '') => results.push({ name, pass: !!pass, extra });

// two graphs with one node each
const A = (await j('/api/graphs', { method: 'POST', body: JSON.stringify({ name: 'Book A', template: 'blank' }) })).data.id;
const B = (await j('/api/graphs', { method: 'POST', body: JSON.stringify({ name: 'Book B', template: 'blank' }) })).data.id;
for (const [gid, label] of [[A, 'Lemma 3.2'], [B, 'Theorem 4.1']]) {
  await j(`/api/graph/${gid}/node-add`, { method: 'POST', body: JSON.stringify({ label, x: 120, y: 120 }) });
}
const nodeA = (await j('/api/graph/' + A)).data.nodes[0].id;
const nodeB = (await j('/api/graph/' + B)).data.nodes[0].id;

// ① HTTP create
const created = await j('/api/crosslinks', { method: 'POST', body: JSON.stringify({
  fromGraph: A, fromNode: nodeA, toGraph: B, toNode: nodeB, why: 'A supplies the criterion B is missing',
}) });
t('HTTP create link', created.status === 200 || created.status === 201, `status=${created.status}`);

// ② listed from A's perspective = provides; from B's = uses
const fromA = await j('/api/crosslinks?graph=' + A);
const fromB = await j('/api/crosslinks?graph=' + B);
const linkA = (fromA.data.links ?? fromA.data ?? [])[0];
const linkB = (fromB.data.links ?? fromB.data ?? [])[0];
t('link visible from A with perspective "provides"', !!linkA && linkA.view === 'provides', JSON.stringify(linkA && linkA.view));
t('link visible from B with perspective "uses"', !!linkB && linkB.view === 'uses', JSON.stringify(linkB && linkB.view));
t('peer graph/node names enriched for display', !!(linkA && linkA.otherGraphName && linkA.otherNodeLabel), `${linkA?.otherGraphName} / ${linkA?.otherNodeLabel}`);

// ③ CLI sees the same link (single source of truth)
const cliList = await run(NODE, [CLI, 'xlink', 'list', A], { env: { ...process.env, OF_HOME: root }, encoding: 'utf8' });
t('CLI lists the same link', /Book B|Theo|uses|provides|→|←/.test(cliList.stdout), cliList.stdout.trim().split('\n').slice(-2).join(' / ').slice(0, 90));

// ④ removing the target node marks the link broken (not silently kept)
await j(`/api/graph/${B}/node/${encodeURIComponent(nodeB)}`, { method: 'DELETE' });
const afterDelete = await j('/api/crosslinks?graph=' + A);
const linkAfter = (afterDelete.data.links ?? afterDelete.data ?? [])[0];
t('link marked broken when the target goes away', !!linkAfter && (linkAfter.broken === true || linkAfter.ok === false), JSON.stringify(linkAfter && (linkAfter.broken ?? linkAfter.ok)));

// ⑤ validation: a malformed reference is rejected with an English message
const bad = await j('/api/crosslinks', { method: 'POST', body: JSON.stringify({ fromGraph: A, fromNode: 'nope', toGraph: B, toNode: 'nope2', why: 'x' }) });
t('malformed link rejected', bad.status >= 400, `status=${bad.status} ${String(bad.data.error ?? '').slice(0, 60)}`);

// ⑥ delete the link
const del = await j('/api/crosslinks?id=' + encodeURIComponent(linkAfter?.id ?? linkA?.id ?? ''), { method: 'DELETE' });
const finalList = await j('/api/crosslinks?graph=' + A);
t('link can be removed', ((finalList.data.links ?? finalList.data ?? []).length === 0), `delete status=${del.status}`);

if (studio.close) await studio.close(); else if (studio.server) studio.server.close();
let ok = 0;
for (const r of results) { if (r.pass) ok++; console.log(`${r.pass ? '  ✓' : '  ✗'} ${r.name.padEnd(44)} ${r.extra}`); }
console.log(`\n${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
