// Browser regression check — needs a running Studio (of studio) plus puppeteer.
// Not part of `node test/*.mjs` (that suite must stay dependency-free); run it when touching
// the client drag code or the i18n dictionaries. See tools/README.md.
// Reproduce "drag a group box, then click it and it jumps back".
// Uses synthetic pointer events so the drag is deterministic.
const puppeteer = require('puppeteer');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
setTimeout(() => { console.error('global timeout'); process.exit(2); }, 90000).unref();

const BASE = 'http://127.0.0.1:4319';

async function api(p, opt) {
  const r = await fetch(BASE + p, { headers: { 'content-type': 'application/json' }, ...opt });
  return r.json();
}

(async () => {
  // Build a graph with 2 nodes and one group.
  const created = await api('/api/graphs', { method: 'POST', body: JSON.stringify({ name: 'GroupJump repro', template: 'blank' }) });
  const id = created.id;
  await api(`/api/graph/${id}/node-add`, { method: 'POST', body: JSON.stringify({ label: 'A', x: 120, y: 140 }) });
  await api(`/api/graph/${id}/node-add`, { method: 'POST', body: JSON.stringify({ label: 'B', x: 360, y: 140 }) });
  let g = await api('/api/graph/' + id);
  const [a, b] = g.nodes.map((n) => n.id);
  await api(`/api/graph/${id}/group-add`, { method: 'POST', body: JSON.stringify({ label: 'G', color: '#2563EB', members: [a, b] }) });
  console.log('graph', id);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  page.setDefaultTimeout(15000);
  // The Studio deep-links by hash (#<graphId>) and reloads on hashchange — same path a user takes.
  await page.goto(BASE + '/#' + encodeURIComponent(id), { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  await page.evaluate(() => window.dispatchEvent(new HashChangeEvent('hashchange')));
  await sleep(2000);
  const opened = await page.evaluate(() => (document.querySelector('#n-titleText')?.textContent ?? '').trim());

  const before = await page.evaluate(() => {
    const box = document.querySelector('.group-box');
    return box ? { left: box.style.left, top: box.style.top, w: box.style.width, h: box.style.height } : null;
  });
  console.log('opened via:', opened, 'box before:', JSON.stringify(before));

  // ---- drag the group box by (160, 90) ----
  const drag = await page.evaluate(async () => {
    const box = document.querySelector('.group-box');
    if (!box) return 'no box';
    const r = box.getBoundingClientRect();
    const opt = { bubbles: true, cancelable: true, clientX: r.left + 20, clientY: r.top + 8, pointerId: 1, button: 0 };
    box.dispatchEvent(new PointerEvent('pointerdown', opt));
    for (let i = 1; i <= 5; i++) {
      window.dispatchEvent(new PointerEvent('pointermove', { ...opt, clientX: opt.clientX + i * 32, clientY: opt.clientY + i * 18 }));
      await new Promise((res) => setTimeout(res, 40));
    }
    window.dispatchEvent(new PointerEvent('pointerup', { ...opt, clientX: opt.clientX + 160, clientY: opt.clientY + 90 }));
    return 'dragged';
  });
  // Sample continuously across the server round-trip: the box must never reappear at the old spot.
  const samples = await page.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 30; i++) {
      const box = document.querySelector('.group-box');
      out.push(box ? box.style.left : null);
      await new Promise((r) => setTimeout(r, 40));
    }
    return out;
  });
  const afterDrag = await page.evaluate(() => {
    const box = document.querySelector('.group-box');
    return box ? { left: box.style.left, top: box.style.top, cls: box.className } : null;
  });
  const serverAfterDrag = await api('/api/graph/' + id);

  // ---- now a plain click on the box (down+up, no movement) ----
  await page.evaluate(() => {
    const box = document.querySelector('.group-box');
    const r = box.getBoundingClientRect();
    const opt = { bubbles: true, cancelable: true, clientX: r.left + 20, clientY: r.top + 8, pointerId: 2, button: 0 };
    box.dispatchEvent(new PointerEvent('pointerdown', opt));
    window.dispatchEvent(new PointerEvent('pointerup', opt));
  });
  await sleep(1200);
  const afterClick = await page.evaluate(() => {
    const box = document.querySelector('.group-box');
    return box ? { left: box.style.left, top: box.style.top, cls: box.className } : null;
  });
  const serverAfterClick = await api('/api/graph/' + id);


  // ---- mid-drag pointercancel must not record a half-way position nor leave the drag stuck ----
  const beforeCancel = await page.evaluate(() => {
    const box = document.querySelector('.group-box');
    return { left: box.style.left, top: box.style.top };
  });
  await page.evaluate(async () => {
    const box = document.querySelector('.group-box');
    const r = box.getBoundingClientRect();
    const opt = { bubbles: true, cancelable: true, clientX: r.left + 20, clientY: r.top + 8, pointerId: 9, button: 0 };
    box.dispatchEvent(new PointerEvent('pointerdown', opt));
    for (let i = 1; i <= 3; i++) {
      window.dispatchEvent(new PointerEvent('pointermove', { ...opt, clientX: opt.clientX + i * 40, clientY: opt.clientY + i * 30 }));
      await new Promise((res) => setTimeout(res, 30));
    }
    window.dispatchEvent(new PointerEvent('pointercancel', { ...opt, clientX: 0, clientY: 0 }));  // browser takes over
  });
  await sleep(900);
  const afterCancel = await page.evaluate(() => {
    const box = document.querySelector('.group-box');
    return { left: box.style.left, top: box.style.top };
  });
  const serverAfterCancel = await api('/api/graph/' + id);

  // a fresh drag after the cancel must still work (listeners were cleaned up)
  await page.evaluate(async () => {
    const box = document.querySelector('.group-box');
    const r = box.getBoundingClientRect();
    const opt = { bubbles: true, cancelable: true, clientX: r.left + 20, clientY: r.top + 8, pointerId: 11, button: 0 };
    box.dispatchEvent(new PointerEvent('pointerdown', opt));
    window.dispatchEvent(new PointerEvent('pointermove', { ...opt, clientX: opt.clientX + 70, clientY: opt.clientY + 10 }));
    window.dispatchEvent(new PointerEvent('pointerup', { ...opt, clientX: opt.clientX + 70, clientY: opt.clientY + 10 }));
  });
  await sleep(900);
  const afterSecondDrag = await page.evaluate(() => {
    const box = document.querySelector('.group-box');
    return { left: box.style.left, top: box.style.top };
  });

  await browser.close();

  const results = [
    ['drag moved the box', afterDrag && afterDrag.left !== before.left, `${before.left} → ${afterDrag && afterDrag.left}`],
    ['server kept the new rect after drag', !!serverAfterDrag.groups[0].rect, JSON.stringify(serverAfterDrag.groups[0].rect)],
    ['server kept the new node x after drag', serverAfterDrag.nodes.find((n) => n.id === a).x !== 120, String(serverAfterDrag.nodes.find((n) => n.id === a).x)],
    ['click did NOT move the box', afterClick && afterClick.left === afterDrag.left && afterClick.top === afterDrag.top, `${afterDrag.left} → ${afterClick.left}`],
    ['click did NOT change the server rect', JSON.stringify(serverAfterClick.groups[0].rect) === JSON.stringify(serverAfterDrag.groups[0].rect), JSON.stringify(serverAfterClick.groups[0].rect)],
    ['no snap-back during the round-trip', !samples.some((v) => v === before.left), `samples: ${[...new Set(samples)].join(',')}`],
    ['cancel restores the pre-drag position', afterCancel.left === beforeCancel.left && afterCancel.top === beforeCancel.top, `${beforeCancel.left} → ${afterCancel.left}`],
    ['cancel records nothing on the server', JSON.stringify(serverAfterCancel.groups[0].rect) === JSON.stringify(serverAfterDrag.groups[0].rect), JSON.stringify(serverAfterCancel.groups[0].rect)],
    ['drag still works after a cancel', afterSecondDrag.left !== afterCancel.left, `${afterCancel.left} → ${afterSecondDrag.left}`],
    ['no uncaught exception', errs.length === 0, errs.slice(0, 2).join(' | ')],
  ];
  let ok = 0;
  for (const [n, pass, extra] of results) { if (pass) ok++; console.log(`${pass ? '  ✓' : '  ✗'} ${n.padEnd(38)} ${extra}`); }
  console.log(`\n${ok}/${results.length} passed`);
  console.log('ids:', JSON.stringify({ id }));
  process.exit(ok === results.length ? 0 : 1);
})().catch((e) => { console.error('harness error:', e.message); process.exit(1); });
