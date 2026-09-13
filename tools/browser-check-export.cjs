// Verify the standalone HTML export: it must load with no errors, and its UI must follow the
// browser language (the export used to be Chinese-only even in an English browser).
// Needs puppeteer. Generates the export itself via the CLI.
const puppeteer = require('puppeteer');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
setTimeout(() => { console.error('global timeout'); process.exit(2); }, 120000).unref();

const REPO = path.resolve(__dirname, '..');
const NODE = process.execPath;
const OUT = path.join(os.tmpdir(), 'of-export-check.html');

(async () => {
  // Pick any existing graph and export it (read the storage dir — no server needed).
  const root = process.env.OF_HOME || path.join(os.homedir(), '.omni-flow');
  const dirs = fs.readdirSync(path.join(root, 'graphs'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(root, 'graphs', d.name, 'graph.json')))
    .map((d) => d.name);
  const id = process.env.OF_CHECK_GRAPH || dirs[0];
  if (!id) { console.log('  (no graph available to export — create one first)'); process.exit(0); }
  execFileSync(NODE, [path.join(REPO, 'bin/of.mjs'), 'export', id, '--format', 'html', '--out', OUT], { stdio: 'ignore' });
  const size = fs.statSync(OUT).size;
  console.log(`  exported ${id} → ${(size / 1024).toFixed(0)} KB`);

  const run = async (lang) => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', `--lang=${lang}`] });
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
    // `--lang` does not change navigator.language on macOS Chrome, so override it deterministically.
    const tag = lang === 'en-US' ? 'en-US' : 'zh-CN';
    await page.evaluateOnNewDocument((l) => {
      Object.defineProperty(navigator, 'language', { get: () => l, configurable: true });
      Object.defineProperty(navigator, 'languages', { get: () => [l], configurable: true });
    }, tag);
    await page.goto('file://' + OUT, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 800));
    const probe = await page.evaluate(() => ({
      lang: navigator.language,
      title: document.title,
      layoutBtn: document.querySelector('#tools button[data-layout="layered"]')?.textContent?.trim(),
      searchPh: document.getElementById('search')?.placeholder,
      detail: document.getElementById('dTitle')?.textContent?.trim(),
      meta: document.getElementById('meta')?.textContent?.trim(),
      nodes: document.querySelectorAll('#world .node').length,
      filters: document.querySelectorAll('#filters button').length,
    }));
    await browser.close();
    return { errs, probe };
  };

  const en = await run('en-US');
  const zh = await run('zh-CN');
  console.log(`  en → ${JSON.stringify(en.probe)}`);
  console.log(`  zh → ${JSON.stringify(zh.probe)}`);

  const hasCJK = (s) => /[\u4e00-\u9fff]/.test(s || '');
  const results = [
    ['export renders nodes', en.probe.nodes > 0, `${en.probe.nodes} nodes, ${en.probe.filters} filters`],
    ['no uncaught exception (en)', en.errs.length === 0, en.errs.slice(0, 2).join(' | ')],
    ['no uncaught exception (zh)', zh.errs.length === 0, zh.errs.slice(0, 2).join(' | ')],
    // Only the chrome is asserted: the meta line contains the user's own graph/group names.
    ['en UI is English', !hasCJK(en.probe.layoutBtn) && !hasCJK(en.probe.detail) && !hasCJK(en.probe.searchPh), `${en.probe.layoutBtn} / ${en.probe.detail} / ${en.probe.searchPh}`],
    ['zh UI is Chinese', hasCJK(zh.probe.layoutBtn) && hasCJK(zh.probe.detail), `${zh.probe.layoutBtn} / ${zh.probe.detail}`],
    ['title follows language', !hasCJK(en.probe.title) && hasCJK(zh.probe.title), `${en.probe.title} / ${zh.probe.title}`],
  ];
  let ok = 0;
  for (const [n, pass, extra] of results) { if (pass) ok++; console.log(`${pass ? '  ✓' : '  ✗'} ${n.padEnd(32)} ${extra}`); }
  console.log(`\n${ok}/${results.length} passed`);
  process.exit(ok === results.length ? 0 : 1);
})().catch((e) => { console.error('harness error:', e.message); process.exit(1); });
