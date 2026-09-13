// Browser regression check — canvas interaction.
// Covers the two defects that made the canvas feel broken:
//   1. the inspector was an absolute overlay, so every card under it was unclickable
//   2. dependency highlighting set classes that had no CSS, i.e. it changed nothing visually
// Plus: the "＋ Attach" button must actually be wired.
// Needs a running Studio (of studio) on 127.0.0.1:4319 and puppeteer.
const puppeteer = require('puppeteer');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
setTimeout(() => { console.error('global timeout'); process.exit(2); }, 90000).unref();
const BASE = 'http://127.0.0.1:4319';

async function api(p, opt) {
  const r = await fetch(BASE + p, { headers: { 'content-type': 'application/json' }, ...opt });
  return r.json();
}

(async () => {
  const created = await api('/api/graphs', { method: 'POST', body: JSON.stringify({ name: 'Canvas check', template: 'theorem-deps' }) });
  const id = created.id;

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  page.setDefaultTimeout(15000);
  await page.goto(BASE + '/#' + encodeURIComponent(id), { waitUntil: 'domcontentloaded' });
  await sleep(2200);
  await page.evaluate(() => window.dispatchEvent(new HashChangeEvent('hashchange')));
  await sleep(1800);

  // 1) nothing non-node may sit on top of a card
  const covered = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('#nodesLayer .node').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 2) return;
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!top?.closest?.('.node')) bad.push(`${el.dataset.id} → ${top?.tagName}${top?.id ? '#' + top.id : ''}`);
    });
    return bad;
  });

  // 2) clicking a card selects it (selection happens on pointerdown)
  const first = await page.evaluate(() => {
    const el = document.querySelectorAll('#nodesLayer .node')[0];
    const r = el.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  });
  await page.mouse.click(first.cx, first.cy);
  await sleep(800);
  const selectedText = await page.evaluate(() => (document.querySelector('#n-titleText')?.textContent ?? '').trim());

  // 3) dependency highlighting must be visible
  const hl = await page.evaluate(() => {
    const marked = document.querySelectorAll('.dep-dim, .dep-up, .dep-down, .dep-self');
    const dim = document.querySelector('.node.dep-dim');
    const up = document.querySelector('.node.dep-up, .node.dep-down');
    return {
      marked: marked.length,
      dimOpacity: dim ? getComputedStyle(dim).opacity : null,
      upShadow: up ? getComputedStyle(up.querySelector('.card') ?? up).boxShadow.slice(0, 40) : null,
      togglePressed: document.getElementById('btnDep')?.getAttribute('aria-pressed'),
    };
  });

  // 4) the attach button is wired
  const attachWired = await page.evaluate(() => {
    const b = document.getElementById('attachAdd');
    return !!b && !b.hidden && b.offsetParent !== null;
  });

  // 5) exactly ONE rendering surface may be visible (DOM cards or the canvas, never both)
  const surfaces = await page.evaluate(async () => {
    const visible = (id) => { const el = document.getElementById(id); return !!el && el.offsetParent !== null && getComputedStyle(el).display !== 'none'; };
    const off = { dom: visible('world'), canvas: visible('scene') };
    document.getElementById('btnCanvas').click();          // switch to canvas mode
    await new Promise((r) => setTimeout(r, 500));
    const on = { dom: visible('world'), canvas: visible('scene') };
    document.getElementById('btnCanvas').click();          // back to DOM mode
    await new Promise((r) => setTimeout(r, 500));
    const back = { dom: visible('world'), canvas: visible('scene') };
    return { off, on, back };
  });

  // 6) toolbar tidy-up: no duplicate-function buttons, thumbs only when the graph has images,
  //    every button carries a tooltip, and the status badge opens validation
  const toolbar = await page.evaluate(async () => {
    const ids = [...document.querySelectorAll('.topbar button[id], .docrail-toggle[id]')].map((b) => b.id);
    const titles = ids.map((id) => ({ id, title: (document.getElementById(id).getAttribute('title') || '').trim() }));
    const badge = document.getElementById('gstat');
    badge.click();
    await new Promise((r) => setTimeout(r, 600));
    const modalOpen = !!document.querySelector('.modal-bg.show, .modal-bg[style*="flex"]');
    const modalText = (document.querySelector('.modal')?.textContent || '').slice(0, 40);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return {
      hasValidate: ids.includes('btnValidate'),
      hasLegend: ids.includes('btnLegend'),
      thumbsHidden: document.getElementById('btnThumbs').hidden,
      missingTitle: titles.filter((t) => !t.title).map((t) => t.id),
      badgeOpensValidation: modalOpen && /validation|Structure|结构/i.test(modalText),
    };
  });

  // 7) P0-1/P0-2: group boxes are selectable, and group drags commit members + fitted rect together.
  //    Canvas mode: drag 3× in one page session (guards the "rect moved, members did not" flake);
  //    DOM mode: same commit semantics once. All assertions read back from the API, not the UI.
  const fit = (nodes, memberIds) => {
    const ms = memberIds.map((mid) => nodes.find((n) => n.id === mid));
    const minX = Math.min(...ms.map((m) => m.x)) - 24, minY = Math.min(...ms.map((m) => m.y)) - 34;
    const maxX = Math.max(...ms.map((m) => m.x + (m.w ?? 168))) + 24, maxY = Math.max(...ms.map((m) => m.y + (m.h ?? 64))) + 24;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  };
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const rectEq = (r, f) => near(r.x, f.x, 2) && near(r.y, f.y, 2) && near(r.w, f.w, 2) && near(r.h, f.h, 2);

  await page.evaluate(async (gid) => {
    const g = await (await fetch(`/api/graph/${gid}`)).json();
    const [a, b2] = g.nodes.slice(0, 2);
    await fetch(`/api/graph/${gid}/position`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nodeId: a.id, x: 220, y: 220 }) });
    await fetch(`/api/graph/${gid}/position`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nodeId: b2.id, x: 560, y: 400 }) });
    await fetch(`/api/graph/${gid}/group-add`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: 'CHK', color: '#2563EB', members: [a.id, b2.id] }) });
  }, id);
  await sleep(1400);   // SSE reload settles

  const myGroup = await api(`/api/graph/${id}`).then((g) => g.groups.find((x) => x.label === 'CHK'));
  const groupGid = myGroup?.id ?? null;
  let members = myGroup?.members ?? [];

  const groupPoint = async () => page.evaluate(() => {
    const el = [...document.querySelectorAll('.group-box')].find((b) => b.querySelector('.glabel')?.textContent === 'CHK');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + 7 };   // top band of the box: above the cards
  });

  // canvas mode: #world is display:none, so the box must be located via the world→screen transform
  const canvasPoint = async () => {
    const g = await api(`/api/graph/${id}`);
    const grp = g.groups.find((x) => x.id === groupGid);
    const f = grp?.rect ?? fit(g.nodes, members);
    return page.evaluate((w) => {
      const v = window.__ofView();
      const r = document.getElementById('viewport').getBoundingClientRect();
      return { x: r.left + v.x + (w.x + w.w / 2) * v.k, y: r.top + v.y + (w.y + 8) * v.k };
    }, f);
  };

  const pointerDrag = (pt, dx, dy, onEl) => page.evaluate(async ({ pt, dx, dy, onEl }) => {
    const target = onEl
      ? [...document.querySelectorAll('.group-box')].find((b) => b.querySelector('.glabel')?.textContent === 'CHK')
      : document.getElementById('viewport');
    const opt = { bubbles: true, cancelable: true, pointerId: 21, button: 0, clientX: pt.x, clientY: pt.y };
    target.dispatchEvent(new PointerEvent('pointerdown', opt));
    for (let k = 1; k <= 3; k++) {
      window.dispatchEvent(new PointerEvent('pointermove', { ...opt, clientX: pt.x + (dx * k) / 3, clientY: pt.y + (dy * k) / 3 }));
      await new Promise((r) => setTimeout(r, 40));
    }
    window.dispatchEvent(new PointerEvent('pointerup', { ...opt, clientX: pt.x + dx, clientY: pt.y + dy }));
    await new Promise((r) => setTimeout(r, 900));
  }, { pt, dx, dy, onEl });

  const groupTap = (onEl) => page.evaluate(async ({ onEl }) => {
    const el = [...document.querySelectorAll('.group-box')].find((b) => b.querySelector('.glabel')?.textContent === 'CHK');
    const r = el.getBoundingClientRect();
    const target = onEl ? el : document.getElementById('viewport');
    const opt = { bubbles: true, cancelable: true, pointerId: 23, button: 0, clientX: r.left + r.width / 2, clientY: r.top + 7 };
    target.dispatchEvent(new PointerEvent('pointerdown', opt));
    window.dispatchEvent(new PointerEvent('pointerup', opt));
    await new Promise((r2) => setTimeout(r2, 500));
  }, { onEl });

  const tapAt = (pt, pid) => page.evaluate(async ({ pt, pid }) => {
    const vp = document.getElementById('viewport');
    const opt = { bubbles: true, cancelable: true, pointerId: pid, button: 0, clientX: pt.x, clientY: pt.y };
    vp.dispatchEvent(new PointerEvent('pointerdown', opt));
    window.dispatchEvent(new PointerEvent('pointerup', opt));
    await new Promise((r2) => setTimeout(r2, 500));
  }, { pt, pid });

  // fetch graph + verify one drag step: same delta on every member, rect = fitted bbox
  const verifyDrag = async (prev) => {
    const g = await api(`/api/graph/${id}`);
    const now = members.map((mid) => g.nodes.find((n) => n.id === mid));
    const before = members.map((mid) => prev.find((n) => n.id === mid));
    const dxs = now.map((n, i) => +(n.x - before[i].x).toFixed(1));
    const dys = now.map((n, i) => +(n.y - before[i].y).toFixed(1));
    const sameDelta = dxs.every((d) => near(d, dxs[0], 1)) && dys.every((d) => near(d, dys[0], 1));
    const moved = Math.hypot(dxs[0], dys[0]) > 30;
    const grp = g.groups.find((x) => x.id === groupGid);
    return { pass: sameDelta && moved && !!grp?.rect && rectEq(grp.rect, fit(g.nodes, members)), detail: `Δ=(${dxs[0]},${dys[0]}) rect=${grp?.rect ? 'fitted' : 'missing'}`, graph: g };
  };

  let prevGraph = await api(`/api/graph/${id}`);
  const canvasDragResults = [];
  await page.evaluate(() => document.getElementById('btnCanvas').click());
  await sleep(900);

  let boxPt = await canvasPoint();
  for (let i = 0; i < 3; i++) {
    if (!boxPt) { canvasDragResults.push(false); continue; }
    await pointerDrag(boxPt, 60, 30, false);
    const v = await verifyDrag(prevGraph.nodes);
    canvasDragResults.push(v.pass);
    prevGraph = v.graph;
    boxPt = await canvasPoint();
  }

  // canvas: a plain click (pointerdown+up, no move) selects the group; empty canvas clears it
  await tapAt(boxPt, 23);
  const canvasSel = await page.evaluate(() => window.__ofSel?.() ?? null);
  const emptyPt = await page.evaluate(() => {
    const r = document.getElementById('viewport').getBoundingClientRect();
    return { x: r.left + r.width - 30, y: r.top + r.height - 30 };   // bottom-right corner: no cards there
  });
  await tapAt(emptyPt, 24);
  const canvasDeselected = await page.evaluate(() => window.__ofSel?.() ?? null);

  // back to DOM mode: one group drag + click-select, same semantics
  await page.evaluate(() => document.getElementById('btnCanvas').click());
  await sleep(900);
  boxPt = await groupPoint();
  let domDrag = { pass: false, detail: 'box not found' };
  if (boxPt) {
    await pointerDrag(boxPt, 60, 30, true);
    domDrag = await verifyDrag(prevGraph.nodes);
  }
  await groupTap(true);
  const domSelBox = await page.evaluate(() => {
    const el = document.querySelector('.group-box.sel');
    const item = document.querySelector('#groupList .node-item.sel');
    return { box: el?.dataset.groupId ?? null, listed: !!item };
  });

  await browser.close();

  const results = [
    ['no element covers a card', covered.length === 0, covered.slice(0, 3).join(' | ') || 'clean'],
    ['clicking a card selects it', selectedText.length > 0, selectedText.slice(0, 30)],
    ['highlight marks nodes/edges', hl.marked > 0, `${hl.marked} marked, toggle=${hl.togglePressed}`],
    ['dimmed cards are actually dimmed', hl.dimOpacity !== null && Number(hl.dimOpacity) < 0.9, `opacity=${hl.dimOpacity}`],
    ['related cards get a ring', !!hl.upShadow, String(hl.upShadow)],
    ['attach button is visible', attachWired, String(attachWired)],
    ['DOM mode shows only the DOM layer', surfaces.off.dom && !surfaces.off.canvas, JSON.stringify(surfaces.off)],
    ['canvas mode shows only the canvas', !surfaces.on.dom && surfaces.on.canvas, JSON.stringify(surfaces.on)],
    ['switching back leaves one surface', surfaces.back.dom && !surfaces.back.canvas, JSON.stringify(surfaces.back)],
    ['no duplicate 校验 button', !toolbar.hasValidate, 'btnValidate'],
    ['no duplicate 图例 button', !toolbar.hasLegend, 'btnLegend'],
    ['thumbs button hidden without images', toolbar.thumbsHidden, String(toolbar.thumbsHidden)],
    ['every toolbar button has a tooltip', toolbar.missingTitle.length === 0, toolbar.missingTitle.join(',') || 'all titled'],
    ['status badge opens validation', toolbar.badgeOpensValidation, 'badge click'],
    ['no uncaught exception', errs.length === 0, errs.slice(0, 2).join(' | ')],
    ['setup: CHK group exists', !!groupGid, `gid=${groupGid} members=${members.length}`],
    ['canvas: group drag #1 commits members+rect', canvasDragResults[0] === true, String(canvasDragResults[0])],
    ['canvas: group drag #2 (repeat, flake guard)', canvasDragResults[1] === true, String(canvasDragResults[1])],
    ['canvas: group drag #3 (repeat, flake guard)', canvasDragResults[2] === true, String(canvasDragResults[2])],
    ['canvas: clicking a group box selects it', !!canvasSel && canvasSel.group === groupGid, JSON.stringify(canvasSel)],
    ['canvas: clicking empty clears the selection', !!canvasDeselected && canvasDeselected.group === null, JSON.stringify(canvasDeselected)],
    ['DOM: group drag commits members+rect', domDrag.pass, domDrag.detail],
    ['DOM: clicking a group box selects it (box + list)', domSelBox.box === groupGid && domSelBox.listed, JSON.stringify(domSelBox)],
  ];
  let ok = 0;
  for (const [n, pass, extra] of results) { if (pass) ok++; console.log(`${pass ? '  ✓' : '  ✗'} ${n.padEnd(34)} ${extra}`); }
  console.log(`\n${ok}/${results.length} passed`);
  console.log('check id:', id);
  process.exit(ok === results.length ? 0 : 1);
})().catch((e) => { console.error('harness error:', e.message); process.exit(1); });
