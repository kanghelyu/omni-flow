// Browser regression check — needs a running Studio (of studio) plus puppeteer.
// Not part of `node test/*.mjs` (that suite must stay dependency-free); run it when touching
// the client drag code or the i18n dictionaries. See tools/README.md.
// UI audit for the two remaining complaints:
//   (1) is the English UI complete?  -> scan visible chrome text for CJK while lang=en
//   (2) does the UI still talk to the AI instead of the human? -> scan for tool/agent jargon
//   (3) do toggles visibly change state? -> compare computed style before/after a click
const puppeteer = require('puppeteer');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
setTimeout(() => { console.error('global timeout'); process.exit(2); }, 120000).unref();
const BASE = 'http://127.0.0.1:4319';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  page.setDefaultTimeout(15000);
  await page.evaluateOnNewDocument(() => localStorage.setItem('of-lang', 'en'));
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await sleep(2500);

  // ---- (1)(2) scan the human-facing chrome only, not the user's own graph content ----
  const scan = await page.evaluate(() => {
    const SKIP = ['#nodesLayer', '#edgeLayer', '#groupsLayer', '#vaultTree', '#docList', '#rd-body', '#n-preview', '#e-label', '#n-label', '#n-note', '#e-arrow'];
    const CJK = /[\u4e00-\u9fff]/;
    const JARGON = /\b(of_[a-z_]+|MCP|SKILL|agent|agent-flow|mcpServers|R[0-9]\b|open:<)/i;
    const hits = { cjk: [], jargon: [] };
    const seenEl = (el) => SKIP.some((s) => el.closest(s));
    for (const el of document.querySelectorAll('button, label, h2, h3, .docrail-title, .convo-title, [title], input[placeholder], .badge, #ui-tag, .tab')) {
      if (seenEl(el)) continue;
      if (el.offsetParent === null && el.tagName !== 'BUTTON') continue;
      if (el.id === 'btnLang') continue;   // intentionally shows the language you would switch TO
      const text = (el.textContent || '').trim();
      const title = el.getAttribute('title') || '';
      const ph = el.getAttribute('placeholder') || '';
      for (const [kind, val] of [['text', text], ['title', title], ['placeholder', ph]]) {
        if (!val) continue;
        if (CJK.test(val)) hits.cjk.push(`${kind}:${el.id || el.className || el.tagName}="${val.slice(0, 46)}"`);
        if (JARGON.test(val)) hits.jargon.push(`${kind}:${el.id || el.tagName}="${val.slice(0, 46)}"`);
      }
    }
    return hits;
  });

  // ---- (3) toggle feedback: does the pressed look actually change? ----
  const toggles = await page.evaluate(async () => {
    const out = [];
    for (const id of ['btnDep', 'btnCanvas', 'btnThumbs']) {
      const el = document.getElementById(id);
      if (!el) { out.push({ id, missing: true }); continue; }
      const bg = () => getComputedStyle(el).backgroundColor;
      const color = () => getComputedStyle(el).color;
      const before = { bg: bg(), color: color(), pressed: el.getAttribute('aria-pressed') };
      el.click();
      await new Promise((r) => setTimeout(r, 400));
      const after = { bg: bg(), color: color(), pressed: el.getAttribute('aria-pressed') };
      out.push({ id, changed: before.bg !== after.bg || before.color !== after.color, before: before.bg, after: after.bg, pressedBefore: before.pressed, pressedAfter: after.pressed, label: el.textContent.trim() });
      el.click();                                  // restore
      await new Promise((r) => setTimeout(r, 300));
    }
    return out;
  });

  // ---- (4) every modal / context menu must be fully translated in EN ----
  // create a throwaway graph so the modals that need `current` (export, xlink dialog) open for real
  const created = await (await fetch(BASE + '/api/graphs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'UI i18n check', template: 'blank' }) })).json();
  await page.goto(BASE + '/#' + encodeURIComponent(created.id), { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  await page.evaluate(() => window.dispatchEvent(new HashChangeEvent('hashchange')));
  await sleep(1500);

  const modalCjk = await page.evaluate(async () => {
    const CJK = /[\u4e00-\u9fff]/;
    const esc = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const grab = () => {
      const clean = (el) => {
        if (!el) return '';
        const cl = el.cloneNode(true);
        cl.querySelectorAll('select, option, textarea, input').forEach((x) => x.remove());   // 用户数据（图名/输入值）不算界面文案
        return cl.innerText || '';
      };
      const m = document.querySelector('.modal-bg.show .modal');
      const c = document.querySelector('.ctxmenu');
      return (clean(m) + '\n' + clean(c)).trim();
    };
    const scanOne = async (open) => { open(); await wait(500); const text = grab(); esc(); await wait(250); return text; };
    const hits = {};
    hits.new = await scanOne(() => document.getElementById('btnNew')?.click());
    hits.import = await scanOne(() => document.getElementById('btnImport')?.click());
    hits.export = await scanOne(() => document.getElementById('btnExport')?.click());
    // node context menu + the xlink dialog behind it
    hits.nodeMenu = await scanOne(() => {
      const el = document.querySelector('#nodesLayer .node');
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new PointerEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 10, clientY: r.top + 10 }));
    });
    hits.xlink = await (async () => {
      const el = document.querySelector('#nodesLayer .node');
      if (!el) return '';
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new PointerEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 10, clientY: r.top + 10 }));
      await wait(350);
      const btn = [...document.querySelectorAll('.ctxmenu button')].find((b) => /Cross-graph/.test(b.textContent));
      if (!btn) { esc(); return '(menu button not found)'; }
      btn.click();
      await wait(700);
      const text = grab();
      esc();
      await wait(250);
      return text;
    })();
    const out = {};
    for (const [k, text] of Object.entries(hits)) {
      const m = text.match(/[^\n]*[\u4e00-\u9fff][^\n]*/g) ?? [];
      out[k] = m.map((s) => s.trim().slice(0, 50));
    }
    return out;
  });

  await browser.close();

  console.log('--- (1) Chinese left in the EN chrome ---');
  console.log(scan.cjk.length ? scan.cjk.map((x) => '   ' + x).join('\n') : '   none');
  console.log('--- (2) AI-facing wording in the UI ---');
  console.log(scan.jargon.length ? scan.jargon.map((x) => '   ' + x).join('\n') : '   none');
  console.log('--- (3) toggle feedback ---');
  for (const t of toggles) console.log(`   ${t.id.padEnd(11)} label="${t.label}" changed=${t.changed} pressed ${t.pressedBefore}→${t.pressedAfter} bg ${t.before}→${t.after}`);
  console.log('--- (4) CJK inside EN modals/menus ---');
  let modalClean = true;
  for (const [k, list] of Object.entries(modalCjk)) {
    console.log(`   ${k.padEnd(9)} ${list.length ? list.join(' | ') : 'none'}`);
    if (list.length) modalClean = false;
  }
  console.log('--- page errors:', errs.length, errs.slice(0, 2).join(' | '));

  const ok = scan.cjk.length === 0 && scan.jargon.length === 0 && toggles.every((t) => t.changed) && modalClean && errs.length === 0;
  console.log(ok ? '\nALL CLEAR' : '\nISSUES FOUND');
  // cleanup throwaway graph
  await fetch(BASE + '/api/graph/' + encodeURIComponent(created.id) + '/graph-delete', { method: 'POST', body: '{}' }).catch(() => {});
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('harness error:', e.message); process.exit(1); });
