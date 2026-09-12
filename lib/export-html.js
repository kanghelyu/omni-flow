/**
 * 独立 HTML 画布导出：把一张图导出为「单文件、离线、可交互」的网页画布。
 * 等价能力：zip 里 `卡片页面/*.html` + `生成脚本/build_canvas.py` 的产出，
 * 但无需 Python、无需 Cytoscape（自研轻量画布），并保留本项目的公式渲染。
 *
 * 能力：平移/缩放/拖动节点 · 点击节点→上游蓝/下游红/其余变暗 · 类型筛选 ·
 *       全文搜索 · 四种布局 · 节点详情（备注 Markdown + KaTeX 公式）· 深链 #<nodeId>
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { NODE_TYPES, EDGE_TYPES, nodeTypeDef } from "./graph-core.js";
import { layeredLayout, clusterLayout, forceLayout, gridLayout } from "./graph-analysis.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const VENDOR = join(HERE, "..", "studio", "vendor", "katex");

async function b64(path){
  try { return (await readFile(path)).toString("base64"); } catch { return null; }
}

/** 生成独立 HTML 画布字符串 */
export async function toStandaloneHtml(graph, notes = {}, { title = null, embed = true } = {}){
  const name = title || graph.name || graph.id;
  let katexJs = "", mhchemJs = "", katexCss = "", fontCss = "";
  if (embed){
    katexJs = await readFile(join(VENDOR, "katex.min.js"), "utf8");
    mhchemJs = await readFile(join(VENDOR, "contrib", "mhchem.min.js"), "utf8");
    katexCss = await readFile(join(VENDOR, "katex.min.css"), "utf8");
    // 字体内联为 base64（离线可用；失败则回退系统字体，数学仍可读）
    const fonts = [
      "KaTeX_Main-Regular", "KaTeX_Main-Bold", "KaTeX_Main-Italic", "KaTeX_Main-BoldItalic",
      "KaTeX_Math-Italic", "KaTeX_Math-BoldItalic", "KaTeX_AMS-Regular",
      "KaTeX_Size1-Regular", "KaTeX_Size2-Regular", "KaTeX_Size3-Regular", "KaTeX_Size4-Regular",
      "KaTeX_Caligraphic-Regular", "KaTeX_Caligraphic-Bold", "KaTeX_Fraktur-Regular",
      "KaTeX_SansSerif-Regular", "KaTeX_Script-Regular", "KaTeX_Typewriter-Regular",
    ];
    const rules = [];
    for (const f of fonts){
      const data = await b64(join(VENDOR, "fonts", `${f}.woff2`));
      if (data) rules.push(`@font-face{font-family:'${f}';src:url(data:font/woff2;base64,${data}) format('woff2');font-weight:normal;font-style:normal;}`);
    }
    fontCss = rules.join("\n");
    // 去掉 CSS 里对外部字体文件的引用（已内联）
    katexCss = katexCss.replace(/src:url\(fonts\/[^)]+\)\s*format\("woff2"\),url\(fonts\/[^)]+\)\s*format\("woff"\),url\(fonts\/[^)]+\)\s*format\("truetype"\)/g, "src:local('KaTeX')");
  }

  const payload = {
    graph: {
      id: graph.id, name: graph.name, description: graph.description ?? "",
      direction: graph.direction ?? "TD",
      nodes: graph.nodes, edges: graph.edges, groups: graph.groups ?? [],
      nodeTypes: graph.nodeTypes ?? {}, edgeTypes: graph.edgeTypes ?? {},
    },
    notes,
  };
  const dataJson = JSON.stringify(payload).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(name)} — OmniFlow 画布</title>
<style>
${fontCss}
${katexCss}
:root{--bg:#0F172A;--panel:#0B1220;--soft:#1E293B;--border:#334155;--text:#E2E8F0;--dim:#94A3B8;--accent:#38BDF8;--canvas:#0B1120;--dot:#1E293B}
body.light{--bg:#F8FAFC;--panel:#FFFFFF;--soft:#F1F5F9;--border:#CBD5E1;--text:#0F172A;--dim:#64748B;--accent:#0284C7;--canvas:#F1F5F9;--dot:#E2E8F0}
*{box-sizing:border-box}
html,body{margin:0;height:100%;font:13px/1.5 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:var(--bg);color:var(--text)}
#app{display:flex;height:100%;overflow:hidden}
#side{width:290px;flex:none;border-right:1px solid var(--border);background:var(--panel);display:flex;flex-direction:column;min-width:0}
#side h1{margin:0;padding:12px 14px 6px;font-size:14px;font-weight:650}
#side .meta{padding:0 14px 10px;color:var(--dim);font-size:11.5px}
#search{margin:0 12px 8px;padding:7px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);outline:none}
#filters{display:flex;flex-wrap:wrap;gap:4px;padding:0 12px 8px}
#filters button{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--border);background:var(--bg);color:var(--dim);cursor:pointer}
#filters button.on{border-color:var(--accent);color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,transparent)}
#list{flex:1;overflow:auto;padding:0 8px 12px}
.item{padding:7px 9px;border-radius:8px;cursor:pointer;border:1px solid transparent}
.item:hover{background:var(--soft)}
.item.on{border-color:var(--accent);background:var(--soft)}
.item b{display:block;font-weight:600;font-size:12.5px}
.item i{font-style:normal;color:var(--dim);font-size:11px}
#main{flex:1;position:relative;min-width:0;background:var(--canvas);cursor:grab;overflow:hidden;touch-action:none}
#main.panning{cursor:grabbing}
#world{position:absolute;left:0;top:0;transform-origin:0 0}
#edges{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
.node{position:absolute;border-radius:10px;padding:8px 10px;font-size:12.5px;border:1.5px solid var(--border);background:var(--soft);cursor:move;user-select:none;box-shadow:0 2px 8px rgba(0,0,0,.18)}
.node .t{font-size:10px;color:var(--dim);margin-bottom:3px;display:flex;gap:5px;align-items:center}
.node.dep-up{border-color:#38BDF8;box-shadow:0 0 0 2px #38BDF8,0 0 14px rgba(56,189,248,.35)}
.node.dep-down{border-color:#F87171;box-shadow:0 0 0 2px #F87171,0 0 14px rgba(248,113,113,.35)}
.node.dep-self{border-color:#FBBF24;box-shadow:0 0 0 2px #FBBF24,0 0 16px rgba(251,191,36,.45)}
.node.dep-dim{opacity:.22;filter:saturate(.5)}
.node.sel{outline:2px solid var(--accent)}
#legend{position:absolute;left:10px;top:8px;display:flex;gap:10px;align-items:center;font-size:11px;color:var(--dim);background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:4px 9px;display:none}
#legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:4px;vertical-align:-1px}
#tools{position:absolute;right:10px;top:8px;display:flex;gap:6px}
#tools button{font-size:11.5px;padding:4px 9px;border-radius:7px;border:1px solid var(--border);background:var(--panel);color:var(--text);cursor:pointer}
#zoom{position:absolute;left:10px;bottom:10px;display:flex;gap:6px}
#zoom button{width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:var(--panel);color:var(--text);cursor:pointer;font-size:14px}
#detail{width:360px;flex:none;border-left:1px solid var(--border);background:var(--panel);display:flex;flex-direction:column;min-width:0}
#detail .hdr{padding:12px 14px;border-bottom:1px solid var(--border);font-weight:650}
#detail .body{flex:1;overflow:auto;padding:12px 14px;font-size:12.5px;line-height:1.7}
#detail .kv{color:var(--dim);font-size:11.5px;margin-bottom:8px}
.note h1,.note h2,.note h3{margin:8px 0 4px;font-size:13.5px;color:var(--accent)}
.note p{margin:5px 0}
.note ul{margin:5px 0 5px 18px}
.note code{background:var(--soft);border:1px solid var(--border);border-radius:4px;padding:0 4px;font-family:ui-monospace,Menlo,monospace;font-size:11.5px}
.note .katex-display{margin:8px 0;overflow-x:auto}
.math-fallback{display:inline-block;padding:1px 5px;border-radius:5px;background:rgba(248,113,113,.12);border:1px dashed rgba(248,113,113,.5);font-family:ui-monospace,Menlo,monospace;font-size:11px}
.empty{color:var(--dim);padding:20px 4px}
@media print{#side,#detail,#tools,#zoom,#legend{display:none}#main{background:#fff}}
</style>
</head>
<body>
<div id="app">
  <aside id="side">
    <h1>${esc(name)}</h1>
    <div class="meta" id="meta"></div>
    <input id="search" placeholder="搜索标题 / 备注 / 标签…">
    <div id="filters"></div>
    <div id="list"></div>
  </aside>
  <main id="main">
    <svg id="edges"></svg>
    <div id="world"></div>
    <div id="legend"></div>
    <div id="tools">
      <button data-layout="layered">分层</button>
      <button data-layout="clusters">聚簇</button>
      <button data-layout="force">力导向</button>
      <button data-layout="grid">网格</button>
      <button id="theme">主题</button>
      <button id="fit">适应</button>
    </div>
    <div id="zoom"><button id="zin">+</button><button id="zout">−</button></div>
  </main>
  <aside id="detail"><div class="hdr" id="dTitle">节点详情</div><div class="body" id="dBody"><div class="empty">点击画布中的节点查看备注（支持 $公式$）。</div></div></aside>
</div>
<script id="of-data" type="application/json">${dataJson}</script>
${embed ? `<script>${katexJs}</script>\n<script>${mhchemJs}</script>` : ""}
<script>
${CANVAS_JS}
</script>
</body>
</html>`;
}

const esc = (s)=> String(s ?? "").replace(/[&<>"']/g, (c)=> ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" }[c]));

/** 画布运行时（嵌入到导出文件里；与 Studio 同源的轻量实现） */
const CANVAS_JS = String.raw`
(function(){
  var D = JSON.parse(document.getElementById('of-data').textContent);
  var G = D.graph, NOTES = D.notes || {};
  var nodeIndex = {}; G.nodes.forEach(function(n){ nodeIndex[n.id] = n; });
  var view = { k: 1, x: 40, y: 40 }, sel = null, dep = null, filter = null, query = '';
  var main = document.getElementById('main'), world = document.getElementById('world'), svg = document.getElementById('edges');

  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;'})[c]; }); }
  function typeLabel(t){ var d = (G.nodeTypes||{})[t] || {}; var en = navigator.language.indexOf('zh')!==0; return (en && d.labelEn) || d.label || t; }
  function w(n){ return n.w || 168; } function h(n){ return n._h || n.h || 64; }

  /* ---------- 数学渲染（与 Studio 同款管线，精简版） ---------- */
  var KATEX_MACROS = {'\\RR':'\\mathbb{R}','\\NN':'\\mathbb{N}','\\ZZ':'\\mathbb{Z}','\\QQ':'\\mathbb{Q}','\\CC':'\\mathbb{C}','\\ii':'\\mathrm{i}','\\ee':'\\mathrm{e}','\\dd':'\\mathrm{d}'};
  var UNIT_MAP = [[/\\meter/g,'m'],[/\\second/g,'s'],[/\\gram/g,'g'],[/\\per/g,'/'],[/\\squared/g,'^2'],[/\\cubed/g,'^3'],[/\\kilo/g,'k'],[/\\milli/g,'m'],[/\\micro/g,'\\mu ']];
  function normalizeLatex(src){
    var t = String(src == null ? '' : src);
    t = t.replace(/(^|[^\\])%.*$/gm, '$1');
    t = t.replace(/\\(documentclass|usepackage|RequirePackage)(\[[^\]]*\])?\{[^}]*\}/g, '');
    t = t.replace(/\\(begin|end)\{document\}/g, '');
    t = t.replace(/\\(label|nonumber|notag|vspace|hspace|noindent|centering|hfill)\b(\[[^\]]*\])?(\{[^}]*\})?/g, '');
    t = t.replace(/\\bm\b/g, '\\boldsymbol');
    t = t.replace(/\\cite[tp]?\b(\[[^\]]*\])?\{([^}]*)\}/g, '[$2]');
    t = t.replace(/\\eqref\{([^}]*)\}/g, '($1)').replace(/\\ref\{([^}]*)\}/g, '$1');
    t = t.replace(/\\includegraphics(\[[^\]]*\])?\{[^}]*\}/g, '');
    t = t.replace(/\\SI\{([^}]*)\}\{([^}]*)\}/g, function(_, v, u){ UNIT_MAP.forEach(function(p){ u = u.replace(p[0], p[1]); }); return v + '\\,\\mathrm{' + u + '}'; });
    t = t.replace(/\\begin\{(tikzpicture|figure\*?|table\*?|lstlisting)\}[\s\S]*?\\end\{\1\}/g, function(_m, env){ return '[' + env + ': 网页不支持该环境，此处省略]'; });
    t = t.replace(/\\(begin|end)\{(?!equation|align|gather|multline|displaymath|math|pmatrix|bmatrix|vmatrix|matrix|cases|array|aligned|gathered|split)[^}]*\}/g, '');
    t = t.replace(/\\begin\{(align\*?|alignat\*?|flalign\*?|eqnarray\*?)\}([\s\S]*?)\\end\{\1\}/g, function(_m,_e,b){ return '$$\\begin{aligned}' + b + '\\end{aligned}$$'; });
    t = t.replace(/\\begin\{(gather\*?|multline\*?)\}([\s\S]*?)\\end\{\1\}/g, function(_m,_e,b){ return '$$\\begin{gathered}' + b + '\\end{gathered}$$'; });
    t = t.replace(/\\begin\{(equation\*?|displaymath|math)\}([\s\S]*?)\\end\{\1\}/g, function(_m,_e,b){ return '$$' + b + '$$'; });
    return t;
  }
  function miniMarkdown(src){
    var inline = function(t){ return t
      .replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g,'$1<i>$2</i>')
      .replace(/\`([^\`\n]+)\`/g,'<code>$1</code>')
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>'); };
    var out = [], inList = false;
    String(src||'').split(/\r?\n/).forEach(function(raw){
      var line = raw.replace(/\s+$/,'');
      var hd = line.match(/^(#{1,6})\s+(.*)$/), li = line.match(/^\s*[-*+]\s+(.*)$/);
      if (hd){ if(inList){out.push('</ul>');inList=false;} var lv=Math.min(3,hd[1].length); out.push('<h'+lv+'>'+inline(hd[2])+'</h'+lv+'>'); return; }
      if (li){ if(!inList){out.push('<ul>');inList=true;} out.push('<li>'+inline(li[1])+'</li>'); return; }
      if (inList){ out.push('</ul>'); inList=false; }
      out.push(line.trim() ? '<p>'+inline(line)+'</p>' : '');
    });
    if (inList) out.push('</ul>');
    return out.join('\n');
  }
  /* 裸 LaTeX 识别（与 Studio 同款）：无定界符的公式段落 / 行内命令也能渲染 */
  var MATH_CMD = /\\(frac|dfrac|sqrt|sum|prod|int|iint|oint|lim|log|ln|exp|sin|cos|tan|det|dim|ker|alpha|beta|gamma|delta|Delta|epsilon|varepsilon|theta|lambda|mu|nu|xi|pi|rho|sigma|tau|phi|varphi|chi|psi|omega|Gamma|Theta|Lambda|Sigma|Phi|Psi|Omega|mathbb|mathcal|mathfrak|mathbf|mathrm|mathsf|mathtt|boldsymbol|hat|widehat|bar|overline|underline|vec|dot|ddot|tilde|overbrace|underbrace|partial|nabla|infty|cdot|cdots|ldots|times|div|pm|mp|leq|geq|neq|approx|equiv|cong|sim|propto|to|rightarrow|leftarrow|Rightarrow|leftrightarrow|mapsto|in|notin|subset|subseteq|supset|supseteq|cup|cap|emptyset|forall|exists|neg|implies|iff|langle|rangle|binom|pmatrix|bmatrix|vmatrix|matrix|cases|array|aligned|gathered|operatorname|text|textbf|textit|ce|SI|si|bm|quad|qquad|left|right|big|Big|bigg|Bigg|boxed|cancel|overset|underset|xrightarrow|substack|tag|color|begin|end)\b/;
  function looksLikeMath(block){
    var t = String(block == null ? '' : block).trim();
    if (!t) return false;
    var noCJK = t.replace(/\\text\{[^}]*\}|\\mathrm\{[^}]*\}|\\text[bfit]*\{[^}]*\}|\\operatorname\{[^}]*\}/g, '');
    if (/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(noCJK)) return false;
    if (MATH_CMD.test(t) || /\\begin\{[a-zA-Z*]+\}/.test(t)) return true;
    if (/[\^_]\{/.test(t) && /[=<>]/.test(t)) return true;
    return false;
  }
  var INLINE_MATH_RE = /\\ce\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|\\[a-zA-Z]+(?:\s*(?:\{[^{}]*\}|\[[^\]]*\]|[_^]\{[^{}]*\}|[_^][A-Za-z0-9]))+(?:\s*[=+\-*/<>]\s*[A-Za-z0-9\\{}^_]+)*|[A-Za-z0-9]+\s*[_^]\{[^{}]*\}(?:\s*[=+\-*/<>]\s*[A-Za-z0-9\\{}^_]+)*/g;
  function splitLineInline(line){
    var parts = [], last = 0, m;
    INLINE_MATH_RE.lastIndex = 0;
    while ((m = INLINE_MATH_RE.exec(line))){
      var hit = m[0], isCmd = /^\\[a-zA-Z]/.test(hit.trim());
      if (!isCmd && hit.trim().length < 3) continue;
      if (!isCmd && !/[=^_]/.test(hit)) continue;
      if (m.index > last) parts.push({ math:false, body: line.slice(last, m.index) });
      parts.push({ math:true, body: hit.trim(), display:false, raw: hit.trim() });
      last = m.index + hit.length;
    }
    if (last < line.length) parts.push({ math:false, body: line.slice(last) });
    return parts;
  }
  function pushPlain(out, block){
    if (!String(block).trim()){ out.push({ math:false, body: block }); return; }
    String(block).split(/(\n\s*\n)/).forEach(function(para){
      if (!para.trim()){ out.push({ math:false, body: para }); return; }
      var buffer = [];
      var flush = function(){ if (buffer.length){ out.push({ math:false, body: buffer.join('\n') }); buffer = []; } };
      para.split('\n').forEach(function(line){
        if (looksLikeMath(line)){ flush(); out.push({ math:true, body: line.trim(), display:true, raw: line.trim() }); return; }
        var segs = splitLineInline(line);
        if (segs.some(function(x){ return x.math; })){ flush(); segs.forEach(function(sg){ out.push(sg); }); }
        else buffer.push(line);
      });
      flush();
    });
  }
  function splitMath(text){
    var src = normalizeLatex(text), out = [], re = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|\$([^$\n]+?)\$/g, last = 0, m;
    while ((m = re.exec(src))){
      if (m.index > last) pushPlain(out, src.slice(last, m.index));
      var display = m[1] !== undefined || m[2] !== undefined;
      out.push({ math:true, body: m[1] || m[2] || m[3] || m[4] || '', display: display, raw: m[0] });
      last = re.lastIndex;
    }
    if (last < src.length) pushPlain(out, src.slice(last));
    return out;
  }
  function renderNote(host, text){
    if (!host) return;
    host.innerHTML = '';
    if (!String(text||'').trim()){ host.innerHTML = '<div class="empty">（无备注）</div>'; return; }
    splitMath(text).forEach(function(seg){
      if (seg.math){
        var box = document.createElement(seg.display ? 'div' : 'span');
        if (window.katex && katex.renderToString){
          try {
            box.innerHTML = katex.renderToString(seg.body, { displayMode: !!seg.display, throwOnError:false, strict:false, trust:false, macros: KATEX_MACROS, errorColor:'#F87171' });
            if (box.querySelector('.katex-error')){
              box.innerHTML = '<span class="math-fallback">' + esc(seg.raw) + '</span>';
            }
          } catch(e){ box.innerHTML = '<span class="math-fallback">' + esc(seg.raw) + '</span>'; }
        } else { box.textContent = seg.raw; }
        host.appendChild(box);
      } else {
        var d = document.createElement('div'); d.className = 'note';
        d.innerHTML = miniMarkdown(esc(seg.body));
        host.appendChild(d);
      }
    });
  }

  /* ---------- 渲染 ---------- */
  function layout(kind){
    var pos;
    if (kind === 'clusters' && (G.groups||[]).length) pos = depsClusters();
    else if (kind === 'force') pos = depsForce();
    else if (kind === 'grid') pos = depsGrid();
    else pos = depsLayered();
    G.nodes.forEach(function(n){ var p = pos[n.id]; if (p){ n.x = p.x; n.y = p.y; } });
    render(); setTimeout(fit, 30);
  }
  function depsLayered(){
    var pos = {}, indeg = {}, adj = {};
    G.nodes.forEach(function(n){ indeg[n.id]=0; adj[n.id]=[]; });
    G.edges.forEach(function(e){ if(adj[e.source]&&indeg[e.target]!==undefined){ adj[e.source].push(e.target); indeg[e.target]++; } });
    var q = G.nodes.filter(function(n){ return !indeg[n.id]; }).map(function(n){ return n.id; }), layer = {}, L = 0;
    q.forEach(function(id){ layer[id]=0; });
    while (q.length){ var nxt=[]; q.forEach(function(id){ adj[id].forEach(function(t){ if(layer[t]===undefined){ layer[t]=(layer[id]||0)+1; L=Math.max(L,layer[t]); nxt.push(t); } }); }); q=nxt; }
    var byLayer = {}; G.nodes.forEach(function(n){ var l = layer[n.id]||0; (byLayer[l]=byLayer[l]||[]).push(n.id); });
    Object.keys(byLayer).forEach(function(l){ byLayer[l].forEach(function(id, i){ pos[id] = { x: 80 + (+l) * 300, y: 80 + i * 110 }; }); });
    return pos;
  }
  function depsClusters(){
    var pos = {}, col = 0;
    var used = {};
    (G.groups||[]).forEach(function(g){
      var ms = (g.members||[]).filter(function(id){ return nodeIndex[id]; });
      if (!ms.length) return;
      ms.forEach(function(id, i){ used[id]=1; pos[id] = { x: 80 + col * 380 + (i % 2) * 190, y: 80 + Math.floor(i / 2) * 110 }; });
      col++;
    });
    var rest = G.nodes.filter(function(n){ return !used[n.id]; });
    rest.forEach(function(n, i){ pos[n.id] = { x: 80 + col * 380 + (i % 2) * 190, y: 80 + Math.floor(i / 2) * 110 }; });
    return pos;
  }
  function depsForce(){
    var pos = {}, W = 1600, H = 1100, cx = W/2, cy = H/2, rnd = 42;
    var next = function(){ rnd = (rnd * 1664525 + 1013904223) >>> 0; return rnd / 4294967296; };
    G.nodes.forEach(function(n, i){ var a = i / Math.max(1,G.nodes.length) * Math.PI * 2; pos[n.id] = { x: cx + Math.cos(a)*W*0.32 + (next()-.5)*40, y: cy + Math.sin(a)*H*0.32 + (next()-.5)*40 }; });
    var k = Math.sqrt(W*H / Math.max(1,G.nodes.length)), temp = W/8, cool = temp/321;
    for (var it=0; it<320; it++){
      var disp = {}; G.nodes.forEach(function(n){ disp[n.id]={x:0,y:0}; });
      for (var i=0;i<G.nodes.length;i++) for (var j=i+1;j<G.nodes.length;j++){
        var a=pos[G.nodes[i].id], b=pos[G.nodes[j].id];
        var dx=a.x-b.x, dy=a.y-b.y, d=Math.sqrt(dx*dx+dy*dy)||0.01, f=(k*k)/d;
        dx/=d; dy/=d;
        disp[G.nodes[i].id].x+=dx*f; disp[G.nodes[i].id].y+=dy*f;
        disp[G.nodes[j].id].x-=dx*f; disp[G.nodes[j].id].y-=dy*f;
      }
      G.edges.forEach(function(e){
        var a=pos[e.source], b=pos[e.target]; if(!a||!b) return;
        var dx=a.x-b.x, dy=a.y-b.y, d=Math.sqrt(dx*dx+dy*dy)||0.01, f=(d*d)/k;
        dx/=d; dy/=d;
        disp[e.source].x-=dx*f; disp[e.source].y-=dy*f; disp[e.target].x+=dx*f; disp[e.target].y+=dy*f;
      });
      G.nodes.forEach(function(n){
        var p=pos[n.id], d=disp[n.id], len=Math.sqrt(d.x*d.x+d.y*d.y)||0.01, step=Math.min(len,temp);
        p.x += d.x/len*step; p.y += d.y/len*step;
        p.x = Math.max(60, Math.min(W-60, p.x)); p.y = Math.max(60, Math.min(H-60, p.y));
      });
      temp = Math.max(0.5, temp - cool);
    }
    var mx=Infinity,my=Infinity; G.nodes.forEach(function(n){ mx=Math.min(mx,pos[n.id].x); my=Math.min(my,pos[n.id].y); });
    G.nodes.forEach(function(n){ pos[n.id] = { x: Math.round(pos[n.id].x-mx+80), y: Math.round(pos[n.id].y-my+80) }; });
    return pos;
  }
  function depsGrid(){
    var pos = {}, sorted = G.nodes.slice().sort(function(a,b){ return String(a.type).localeCompare(String(b.type)) || String(a.id).localeCompare(String(b.id)); });
    sorted.forEach(function(n, i){ pos[n.id] = { x: 80 + (i % 6) * 240, y: 80 + Math.floor(i / 6) * 120 }; });
    return pos;
  }

  function nodeColor(n){
    var d = (G.nodeTypes||{})[n.type] || {};
    return { fill: n.fill || d.fill || '#334155', border: n.border || d.border || '#475569', text: n.textColor || d.textColor || '#E2E8F0' };
  }
  function render(){
    world.innerHTML = '';
    svg.setAttribute('width', 1); svg.setAttribute('height', 1);
    var maxX = 0, maxY = 0;
    G.nodes.forEach(function(n){ maxX = Math.max(maxX, n.x + w(n)); maxY = Math.max(maxY, n.y + h(n)); });
    world.style.width = (maxX + 200) + 'px'; world.style.height = (maxY + 200) + 'px';
    svg.style.width = (maxX + 200) + 'px'; svg.style.height = (maxY + 200) + 'px';
    // 组框
    (G.groups||[]).forEach(function(g){
      var ms = (g.members||[]).map(function(id){ return nodeIndex[id]; }).filter(Boolean);
      if (!ms.length) return;
      var x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;
      ms.forEach(function(m){ x1=Math.min(x1,m.x); y1=Math.min(y1,m.y); x2=Math.max(x2,m.x+w(m)); y2=Math.max(y2,m.y+h(m)); });
      var box = document.createElement('div');
      box.className = 'group-box';
      box.style.cssText = 'position:absolute;border:1.5px dashed '+(g.color||'#64748B')+';background:'+(g.color||'#64748B')+'14;border-radius:14px;left:'+(x1-24)+'px;top:'+(y1-34)+'px;width:'+(x2-x1+48)+'px;height:'+(y2-y1+58)+'px';
      box.innerHTML = '<span style="position:absolute;left:10px;top:-11px;font-size:11px;padding:1px 7px;border-radius:999px;background:'+(g.color||'#64748B')+'22;color:'+(g.color||'#64748B')+';border:1px solid '+(g.color||'#64748B')+'66">'+esc(g.label||'')+'</span>';
      world.appendChild(box);
    });
    // 连线
    var paths = '';
    G.edges.forEach(function(e){
      var s = nodeIndex[e.source], t = nodeIndex[e.target];
      if (!s || !t) return;
      var x1 = s.x + w(s) / 2, y1 = s.y + h(s), x2 = t.x + w(t) / 2, y2 = t.y;
      if (G.direction === 'LR'){ x1 = s.x + w(s); y1 = s.y + h(s) / 2; x2 = t.x; y2 = t.y + h(t) / 2; }
      var d = (Math.abs(y2 - y1) > 40) ? ('M' + x1 + ' ' + y1 + ' C' + x1 + ' ' + ((y1+y2)/2) + ' ' + x2 + ' ' + ((y1+y2)/2) + ' ' + x2 + ' ' + y2) : ('M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2);
      var col = e.color || ((G.edgeTypes||{})[e.type||'']||{}).color || '#64748B';
      var dash = (e.style === 'dashed') ? ' stroke-dasharray="7 5"' : '';
      var cls = 'edge';
      if (dep){
        var isUp = (dep.up[e.source] && dep.up[e.target]) || e.target === sel;
        var isDown = (dep.down[e.target] && dep.down[e.source]) || e.source === sel;
        if (isUp) { cls += ' dep-up'; col = '#38BDF8'; }
        else if (isDown) { cls += ' dep-down'; col = '#F87171'; }
        else if (sel) cls += ' dep-dim';
      }
      paths += '<path class="' + cls + '" d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + (e.width || 1.6) + '"' + dash + (cls.indexOf('dep-dim') >= 0 ? ' opacity="0.15"' : '') + '/>';
      if (e.label) paths += '<text x="' + ((x1+x2)/2) + '" y="' + ((y1+y2)/2 - 4) + '" font-size="10" fill="#94A3B8" text-anchor="middle">' + esc(e.label) + '</text>';
    });
    svg.innerHTML = paths;
    // 节点
    G.nodes.forEach(function(n){
      if (filter && n.type !== filter) return;
      if (query && !(String(n.label||'').toLowerCase().indexOf(query) >= 0 || String((NOTES[n.id]||{}).content||'').toLowerCase().indexOf(query) >= 0)) return;
      var c = nodeColor(n), el = document.createElement('div');
      el.className = 'node'; el.dataset.id = n.id;
      el.style.cssText = 'left:' + n.x + 'px;top:' + n.y + 'px;width:' + w(n) + 'px;min-height:' + h(n) + 'px;background:' + c.fill + ';border-color:' + c.border + ';color:' + c.text;
      el.innerHTML = '<div class="t">' + esc(n.icon || '') + ' ' + esc(typeLabel(n.type)) + '</div>' + esc(n.label || '');
      if (sel === n.id) el.classList.add('dep-self');
      else if (dep){
        if (dep.up[n.id]) el.classList.add('dep-up');
        else if (dep.down[n.id]) el.classList.add('dep-down');
        else el.classList.add('dep-dim');
      }
      el.addEventListener('pointerdown', function(ev){ startDrag(ev, n, el); });
      el.addEventListener('click', function(ev){ ev.stopPropagation(); pick(n.id); });
      world.appendChild(el);
    });
    applyView();
  }
  function applyView(){ world.style.transform = 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.k + ')'; svg.style.transform = world.style.transform; svg.style.transformOrigin = '0 0'; }
  function fit(){
    var mx = Infinity, my = Infinity, MX = -Infinity, MY = -Infinity;
    G.nodes.forEach(function(n){ mx=Math.min(mx,n.x); my=Math.min(my,n.y); MX=Math.max(MX,n.x+w(n)); MY=Math.max(MY,n.y+h(n)); });
    if (mx === Infinity) return;
    var r = main.getBoundingClientRect(), pad = 60;
    var k = Math.min(2, Math.max(0.15, Math.min((r.width - pad*2)/(MX-mx), (r.height - pad*2)/(MY-my))));
    view.k = k; view.x = pad - mx*k + Math.max(0, (r.width - pad*2 - (MX-mx)*k)/2);
    view.y = pad - my*k + Math.max(0, (r.height - pad*2 - (MY-my)*k)/2);
    applyView();
  }

  /* ---------- 依赖高亮 ---------- */
  function computeDeps(id){
    var up = {}, down = {}, uq = [id], dq = [id];
    while (uq.length){ var c = uq.pop(); G.edges.forEach(function(e){ if (e.target === c && e.source !== id && !up[e.source]){ up[e.source]=1; uq.push(e.source); } }); }
    while (dq.length){ var c2 = dq.pop(); G.edges.forEach(function(e){ if (e.source === c2 && e.target !== id && !down[e.target]){ down[e.target]=1; dq.push(e.target); } }); }
    return { up: up, down: down };
  }
  function pick(id){
    if (sel === id){ sel = null; dep = null; document.getElementById('legend').style.display='none'; }
    else { sel = id; dep = computeDeps(id); }
    render(); syncList(); showDetail(id);
  }
  function showDetail(id){
    var dT = document.getElementById('dTitle'), dB = document.getElementById('dBody');
    if (!id){ dT.textContent = '节点详情'; dB.innerHTML = '<div class="empty">点击画布中的节点查看备注（支持 $公式$）。</div>'; return; }
    var n = nodeIndex[id] || {};
    dT.textContent = n.label || id;
    var note = (NOTES[id] || {}).content || '';
    dB.innerHTML = '<div class="kv">' + esc(typeLabel(n.type)) + ' · ' + esc(n.id) + (n.status ? ' · ' + esc(n.status) : '') + '</div><div class="note" id="dNote"></div>';
    renderNote(document.getElementById('dNote'), note || '*（该节点暂无备注）*');
  }

  /* ---------- 交互 ---------- */
  function startDrag(ev, n, el){
    if (ev.button !== 0) return;
    ev.preventDefault(); ev.stopPropagation();
    var sx = ev.clientX, sy = ev.clientY, ox = n.x, oy = n.y, moved = false;
    function mv(e){
      var dx = (e.clientX - sx) / view.k, dy = (e.clientY - sy) / view.k;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
      n.x = ox + dx; n.y = oy + dy;
      el.style.left = n.x + 'px'; el.style.top = n.y + 'px';
    }
    function up(){ window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); if (moved){ refreshEdges(); } else { pick(n.id); } }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
  function refreshEdges(){ var keep = sel; sel = null; render(); sel = keep; }
  main.addEventListener('pointerdown', function(ev){
    if (ev.target.closest('.node')) return;
    if (ev.button !== 0) return;
    ev.preventDefault();
    var sx = ev.clientX, sy = ev.clientY, ox = view.x, oy = view.y;
    main.classList.add('panning');
    function mv(e){ view.x = ox + (e.clientX - sx); view.y = oy + (e.clientY - sy); applyView(); }
    function up(){ window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); main.classList.remove('panning'); }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    pick(null);
  });
  main.addEventListener('wheel', function(ev){
    ev.preventDefault();
    var r = main.getBoundingClientRect(), cx = ev.clientX - r.left, cy = ev.clientY - r.top;
    if (ev.ctrlKey || ev.metaKey){
      var k = Math.min(2.5, Math.max(0.15, view.k * Math.exp(-ev.deltaY * 0.0015)));
      view.x = cx - (cx - view.x) * (k / view.k); view.y = cy - (cy - view.y) * (k / view.k); view.k = k;
    } else { view.x -= ev.deltaX || 0; view.y -= ev.deltaY || 0; }
    applyView();
  }, { passive: false });
  document.addEventListener('keydown', function(ev){
    if (ev.key === 'Escape') pick(null);
    else if (ev.key === 'f' || ev.key === 'F') fit();
  });
  document.getElementById('zin').onclick = function(){ view.k = Math.min(2.5, view.k * 1.2); applyView(); };
  document.getElementById('zout').onclick = function(){ view.k = Math.max(0.15, view.k / 1.2); applyView(); };
  document.getElementById('fit').onclick = fit;
  document.getElementById('theme').onclick = function(){ document.body.classList.toggle('light'); };
  document.querySelectorAll('#tools button[data-layout]').forEach(function(b){ b.onclick = function(){ layout(b.dataset.layout); }; });

  /* ---------- 侧栏 ---------- */
  function syncList(){
    document.querySelectorAll('#list .item').forEach(function(el){
      el.classList.toggle('on', el.dataset.id === sel);
    });
  }
  function renderList(){
    var list = document.getElementById('list');
    list.innerHTML = '';
    var shown = 0;
    G.nodes.forEach(function(n){
      if (filter && n.type !== filter) return;
      var note = (NOTES[n.id] || {}).content || '';
      if (query && !(String(n.label||'').toLowerCase().indexOf(query) >= 0 || note.toLowerCase().indexOf(query) >= 0)) return;
      shown++;
      var el = document.createElement('div');
      el.className = 'item'; el.dataset.id = n.id;
      el.innerHTML = '<b>' + esc(n.label || n.id) + '</b><i>' + esc(typeLabel(n.type)) + ' · ' + esc(n.id) + '</i>';
      el.onclick = function(){ pick(n.id); };
      list.appendChild(el);
    });
    if (!shown) list.innerHTML = '<div class="empty">没有匹配的节点</div>';
  }
  function renderFilters(){
    var box = document.getElementById('filters'), counts = {};
    G.nodes.forEach(function(n){ counts[n.type] = (counts[n.type] || 0) + 1; });
    var entries = Object.keys(counts).sort(function(a,b){ return counts[b]-counts[a]; });
    box.innerHTML = '<button data-t="" class="' + (filter ? '' : 'on') + '">全部 ' + G.nodes.length + '</button>' +
      entries.map(function(t){ return '<button data-t="' + esc(t) + '" class="' + (filter === t ? 'on' : '') + '">' + esc(typeLabel(t)) + ' ' + counts[t] + '</button>'; }).join('');
    box.querySelectorAll('button').forEach(function(b){ b.onclick = function(){ filter = b.dataset.t || null; renderFilters(); renderList(); render(); }; });
  }
  document.getElementById('search').addEventListener('input', function(e){ query = e.target.value.trim().toLowerCase(); renderList(); render(); });

  document.getElementById('meta').textContent = G.nodes.length + ' 节点 · ' + G.edges.length + ' 连线 · ' + (G.groups||[]).length + ' 分组' + (G.description ? ' · ' + G.description : '');
  renderFilters(); renderList(); render(); setTimeout(fit, 50);
  window.addEventListener('resize', function(){ applyView(); });
})();
`;

export default { toStandaloneHtml };
