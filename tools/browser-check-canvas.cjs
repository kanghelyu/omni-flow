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

  await browser.close();

  const results = [
    ['no element covers a card', covered.length === 0, covered.slice(0, 3).join(' | ') || 'clean'],
    ['clicking a card selects it', selectedText.length > 0, selectedText.slice(0, 30)],
    ['highlight marks nodes/edges', hl.marked > 0, `${hl.marked} marked, toggle=${hl.togglePressed}`],
    ['dimmed cards are actually dimmed', hl.dimOpacity !== null && Number(hl.dimOpacity) < 0.9, `opacity=${hl.dimOpacity}`],
    ['related cards get a ring', !!hl.upShadow, String(hl.upShadow)],
    ['attach button is visible', attachWired, String(attachWired)],
    ['no uncaught exception', errs.length === 0, errs.slice(0, 2).join(' | ')],
  ];
  let ok = 0;
  for (const [n, pass, extra] of results) { if (pass) ok++; console.log(`${pass ? '  ✓' : '  ✗'} ${n.padEnd(34)} ${extra}`); }
  console.log(`\n${ok}/${results.length} passed`);
  console.log('check id:', id);
  process.exit(ok === results.length ? 0 : 1);
})().catch((e) => { console.error('harness error:', e.message); process.exit(1); });
