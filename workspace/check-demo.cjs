// Browser verification of the two persistent demos (read-only).
const puppeteer = require('puppeteer');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = 'http://127.0.0.1:4319';
const G1 = '示例1超长详情测试-h3i4', GA = '示例2A判据提供方-h3jc', GB = '示例2B结论使用方-h3jk';

(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1600, height: 1000 });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));

  /* ---------- demo 1: 超长详情 ---------- */
  await p.goto(BASE + '/#' + encodeURIComponent(G1), { waitUntil: 'domcontentloaded' });
  await sleep(2600);
  await p.evaluate(() => window.dispatchEvent(new HashChangeEvent('hashchange')));
  await sleep(1800);
  const tap = (sel) => p.evaluate(async (sel) => {
    const el = document.querySelector(sel);
    const r = el.getBoundingClientRect();
    const opt = { bubbles: true, cancelable: true, pointerId: 7, button: 0, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    el.dispatchEvent(new PointerEvent('pointerdown', opt));
    window.dispatchEvent(new PointerEvent('pointerup', opt));
    await new Promise((r2) => setTimeout(r2, 600));
  }, sel);
  const t0 = Date.now();
  await tap('#nodesLayer .node');
  const d1 = await p.evaluate(() => ({
    chars: document.getElementById('n-note')?.value.length ?? 0,
    katex: document.querySelectorAll('#n-preview .katex').length,
    endVisible: (document.getElementById('n-preview')?.textContent ?? '').includes('【全文结束】'),
    tailOk: (document.getElementById('n-note')?.value ?? '').includes('如果你能在「详情全文」里看到这一行'),
  }));
  console.log('[demo1] 选中卡片耗时', Date.now() - t0, 'ms | 详情字数 =', d1.chars, '| 渲染出的公式数 =', d1.katex, '| 末尾标记可见 =', d1.endVisible, '/', d1.tailOk);

  await p.evaluate(() => document.getElementById('n-note-full').click());
  await sleep(2500);
  const d2 = await p.evaluate(() => ({
    editChars: document.getElementById('note-edit')?.value.length ?? 0,
    previewChars: (document.getElementById('note-preview')?.textContent ?? '').length,
    katex: document.querySelectorAll('#note-preview .katex').length,
    endVisible: (document.getElementById('note-preview')?.textContent ?? '').includes('全文结束'),
  }));
  console.log('[demo1] 详情全文弹窗：编辑框字数 =', d2.editChars, '| 预览渲染字符 =', d2.previewChars, '| 公式数 =', d2.katex, '| 末尾可见 =', d2.endVisible);
  await p.evaluate(() => document.querySelector('#note-close')?.click());
  await sleep(300);

  /* ---------- demo 2: 跨图链接 ---------- */
  await p.goto(BASE + '/#' + encodeURIComponent(GA), { waitUntil: 'domcontentloaded' });
  await sleep(2600);
  await p.evaluate(() => window.dispatchEvent(new HashChangeEvent('hashchange')));
  await sleep(1800);
  await tap('#nodesLayer .node');
  const d3 = await p.evaluate(() => {
    const box = document.getElementById('xlinkBox');
    const rows = [...box.querySelectorAll('.xlink-item')].map((el) => ({
      badge: el.querySelector('.badge')?.textContent ?? '',
      graph: el.querySelector('.h b')?.textContent ?? '',
      why: el.querySelector('.why')?.textContent?.slice(0, 30) ?? '',
    }));
    return { hidden: box.hidden, rows, text: (box.textContent ?? '').slice(0, 0) };
  });
  console.log('[demo2] A 图选中 A1 卡：xlink 面板 hidden =', d3.hidden, '| 行数 =', d3.rows.length, JSON.stringify(d3.rows));

  // click the row → should jump to graph B (hash changes to GB/<node>)
  await p.evaluate(() => document.querySelector('.xlink-item')?.click());
  await sleep(2200);
  const jumped = await p.evaluate(() => decodeURIComponent(location.hash));
  const onB = jumped.includes('示例2B');
  console.log('[demo2] 点击跨图链接行 → 跳转 =', onB, '| hash =', jumped.slice(0, 60));
  // on B, select the target card → the panel should show the "uses" perspective
  await p.evaluate(() => window.dispatchEvent(new HashChangeEvent('hashchange')));
  await sleep(1800);
  const d4 = await p.evaluate(() => {
    const el = document.querySelector('#nodesLayer .node');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const opt = { bubbles: true, cancelable: true, pointerId: 9, button: 0, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    el.dispatchEvent(new PointerEvent('pointerdown', opt));
    window.dispatchEvent(new PointerEvent('pointerup', opt));
    return el.dataset.id;
  });
  await sleep(600);
  const d5 = await p.evaluate(() => {
    const box = document.getElementById('xlinkBox');
    return { sel: window.__ofSel?.(), rows: [...box.querySelectorAll('.xlink-item .badge')].map((x) => x.textContent) };
  });
  console.log('[demo2] B 图侧选中节点', d4, '→ 视角徽标 =', JSON.stringify(d5.rows), '| selected =', JSON.stringify(d5.sel));
  console.log('page errors:', errs.length ? errs : 'none');
  await b.close();
})().catch((e) => { console.error('probe error:', e.message); process.exit(1); });
