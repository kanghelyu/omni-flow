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

  await browser.close();

  console.log('--- (1) Chinese left in the EN chrome ---');
  console.log(scan.cjk.length ? scan.cjk.map((x) => '   ' + x).join('\n') : '   none');
  console.log('--- (2) AI-facing wording in the UI ---');
  console.log(scan.jargon.length ? scan.jargon.map((x) => '   ' + x).join('\n') : '   none');
  console.log('--- (3) toggle feedback ---');
  for (const t of toggles) console.log(`   ${t.id.padEnd(11)} label="${t.label}" changed=${t.changed} pressed ${t.pressedBefore}→${t.pressedAfter} bg ${t.before}→${t.after}`);
  console.log('--- page errors:', errs.length, errs.slice(0, 2).join(' | '));

  const ok = scan.cjk.length === 0 && scan.jargon.length === 0 && toggles.every((t) => t.changed) && errs.length === 0;
  console.log(ok ? '\nALL CLEAR' : '\nISSUES FOUND');
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('harness error:', e.message); process.exit(1); });
