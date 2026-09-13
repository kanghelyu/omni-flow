/**
 * LaTeX 校验与规范化（服务端，供 agent 自查）
 *
 * 定位：**让 agent 不写出编译不了的公式**。agent 通过 MCP 写卡片/备注/导入时，
 * 用 checkLatex() 先验证、拿到精确错误与修法建议，再落库。
 *
 * KaTeX 以 vendored UMD 形式加载（零依赖，无需 npm install）。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const HERE = dirname(fileURLToPath(import.meta.url));
const VENDOR = join(HERE, "..", "studio", "vendor", "katex");

let KATEX = null;
function katex(){
  if (KATEX) return KATEX;
  const sandbox = { module: { exports: {} }, exports: {}, window: {}, self: {}, console, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(VENDOR, "katex.min.js"), "utf8"), sandbox, { filename: "katex.min.js" });
  const k = sandbox.module.exports?.renderToString ? sandbox.module.exports : sandbox.katex;
  try {
    // mhchem 是 KaTeX 官方 contrib（提供 \ce{}）。
    // 其 UMD 第一分支会 require("katex")——沙箱里没有 require，故**不提供 module/exports**，
    // 让它走「全局分支」把扩展注册到传入的 katex 实例上。
    const s2 = { katex: k, console };
    s2.self = s2; s2.window = s2;
    vm.createContext(s2);
    vm.runInContext(readFileSync(join(VENDOR, "contrib", "mhchem.min.js"), "utf8"), s2, { filename: "mhchem.min.js" });
  } catch { /* 无 mhchem 仍可校验其余公式 */ }
  KATEX = k;
  return KATEX;
}

/**
 * 常见简写 → KaTeX **标准命令**的重写表。
 * 注意：这里**不定义宏**（不调用 KaTeX 的 macros 选项），而是把简写直接改写成标准写法，
 * 保证落库/渲染的 LaTeX 永远是「纯标准 KaTeX」，不依赖任何库外自定义命令。
 */
const SHORTHAND = [
  [/\\RR\b/g, "\\mathbb{R}"], [/\\NN\b/g, "\\mathbb{N}"], [/\\ZZ\b/g, "\\mathbb{Z}"],
  [/\\QQ\b/g, "\\mathbb{Q}"], [/\\CC\b/g, "\\mathbb{C}"], [/\\FF\b/g, "\\mathbb{F}"],
  [/\\dd\b/g, "\\mathrm{d}"], [/\\ee\b/g, "\\mathrm{e}"], [/\\ii\b/g, "\\mathrm{i}"],
  [/\\Tr\b/g, "\\operatorname{Tr}"], [/\\rank\b/g, "\\operatorname{rank}"],
  [/\\Spec\b/g, "\\operatorname{Spec}"], [/\\id\b/g, "\\operatorname{id}"],
  [/\\Gal\b/g, "\\operatorname{Gal}"], [/\\Aut\b/g, "\\operatorname{Aut}"],
  [/\\ord\b/g, "\\operatorname{ord}"], [/\\sgn\b/g, "\\operatorname{sgn}"],
  [/\\diag\b/g, "\\operatorname{diag}"], [/\\tr\b/g, "\\operatorname{tr}"],
  [/\\abs\{/g, "\\lvert "], [/\\norm\{/g, "\\lVert "],
  [/\\ceil\{/g, "\\lceil "], [/\\floor\{/g, "\\lfloor "],
];

const UNIT_MAP = [[/\\meter/g, "m"], [/\\second/g, "s"], [/\\gram/g, "g"], [/\\per/g, "/"], [/\\squared/g, "^2"], [/\\cubed/g, "^3"], [/\\kilo/g, "k"], [/\\milli/g, "m"], [/\\micro/g, "\\mu "]];

/** 与前端 normalizeLatex 同源：把论文/agent 产出的 LaTeX 变成一定可编译的形态 */
export function normalizeLatex(src){
  let t = String(src ?? "");
  // 先把非标准简写改写成标准命令（保证最终是纯标准 KaTeX）
  for (const [re, to] of SHORTHAND) t = t.replace(re, to);
  t = t.replace(/(^|[^\\])%.*$/gm, "$1");
  t = t.replace(/\\(documentclass|usepackage|RequirePackage)(\[[^\]]*\])?\{[^}]*\}/g, "");
  t = t.replace(/\\(begin|end)\{document\}/g, "");
  t = t.replace(/\\(setlength|addtolength|pagestyle|thispagestyle|geometry|newpage|clearpage|noindent|centering|hfill|vfill|smallskip|medskip|bigskip|maketitle|tableofcontents)\b(\[[^\]]*\])?(\{[^}]*\})?/g, "");
  t = t.replace(/\\(label|nonumber|notag|index|glossary)\b(\[[^\]]*\])?(\{[^}]*\})?/g, "");
  t = t.replace(/\\tag\*?\{([^}]*)\}/g, "\\quad\\text{($1)}");
  t = t.replace(/\\tag\*?([^\s$\\]+)/g, "\\quad\\text{($1)}");
  t = t.replace(/\\(vspace|hspace|vskip|hskip)\*?\{[^}]*\}/g, "");
  t = t.replace(/\\bm\b/g, "\\boldsymbol");
  t = t.replace(/\\cite[tp]?\b(\[[^\]]*\])?\{([^}]*)\}/g, "[$2]");
  t = t.replace(/\\eqref\{([^}]*)\}/g, "($1)");
  t = t.replace(/\\ref\{([^}]*)\}/g, "$1");
  t = t.replace(/\\includegraphics(\[[^\]]*\])?\{[^}]*\}/g, "");
  t = t.replace(/\\sideset\{([^}]*)\}\{([^}]*)\}\s*(\\[a-zA-Z]+)/g, "$3$1$2");
  t = t.replace(/\\SI\{([^}]*)\}\{([^}]*)\}/g, (_m, v, u)=>{
    let uu = u; for (const [re, to] of UNIT_MAP) uu = uu.replace(re, to);
    return `${v}\\,\\mathrm{${uu}}`;
  });
  t = t.replace(/\\si\{([^}]*)\}/g, (_m, u)=>{
    let uu = u; for (const [re, to] of UNIT_MAP) uu = uu.replace(re, to);
    return `\\mathrm{${uu}}`;
  });
  t = t.replace(/\\begin\{(tikzpicture|figure\*?|table\*?|algorithm\*?|lstlisting)\}[\s\S]*?\\end\{\1\}/g,
                (_m, env)=> `[${env}: 网页不支持该环境，此处省略]`);
  t = t.replace(/\\(begin|end)\{(?!equation|align|gather|multline|displaymath|math|alignat|flalign|eqnarray|pmatrix|bmatrix|vmatrix|matrix|cases|array|aligned|gathered|split|smallmatrix)[^}]*\}/g, "");
  t = t.replace(/\\begin\{(align\*?|alignat\*?|flalign\*?|eqnarray\*?)\}([\s\S]*?)\\end\{\1\}/g, (_m, _e, b)=> `$$\\begin{aligned}${b}\\end{aligned}$$`);
  t = t.replace(/\\begin\{(gather\*?|multline\*?)\}([\s\S]*?)\\end\{\1\}/g, (_m, _e, b)=> `$$\\begin{gathered}${b}\\end{gathered}$$`);
  t = t.replace(/\\begin\{(equation\*?|displaymath|math)\}([\s\S]*?)\\end\{\1\}/g, (_m, _e, b)=> `$$${b}$$`);
  return t;
}

/** 把文本切成 [普通文本 | 数学段]（与前端同规则：定界符 + 裸公式行 + 行内命令） */
export function splitMath(text){
  const src = normalizeLatex(text);
  const out = [];
  const re = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|\$([^$\n]+?)\$/g;
  let last = 0, m;
  const bare = (block)=>{
    const t = String(block);
    if (!t.trim()){ out.push({ math: false, body: t }); return; }
    const looksMath = (line)=>{
      if (/[\u4e00-\u9fff]/.test(line.replace(/\\text\{[^}]*\}/g, ""))) return false;
      if (/\\begin\{[a-zA-Z*]+\}|\\[a-zA-Z]{2,}/.test(line)) return true;
      return /[=^_]\{/.test(line) && /[A-Za-z0-9]/.test(line);
    };
    const wordsOf = (s)=> s.trim().split(/\s+/).filter((w)=> /^[A-Za-z]{2,}$/.test(w)).length;
    for (const line of t.split("\n")){
      if (looksMath(line) && wordsOf(line) < 3) out.push({ math: true, body: line.trim(), display: true, raw: line.trim() });
      else out.push({ math: false, body: line });
    }
  };
  while ((m = re.exec(src))){
    if (m.index > last) bare(src.slice(last, m.index));
    const display = m[1] !== undefined || m[2] !== undefined;
    out.push({ math: true, body: m[1] ?? m[2] ?? m[3] ?? m[4] ?? "", display, raw: m[0] });
    last = re.lastIndex;
  }
  if (last < src.length) bare(src.slice(last));
  return out;
}

/** 依据 KaTeX 报错给出**可执行的修法建议**（agent 拿到即可自行改正） */
function unescapeHtml(s){
  return String(s).replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
function hintFor(err, frag){
  const e = unescapeHtml(err);
  if (/Unexpected end of input/.test(e)) return "公式未写完或括号未闭合：检查每个 { 有对应 }、每个 \\left 有 \\right";
  if (/Expected '}', got 'EOF'|Expected '\\}'/.test(e)) return "花括号不配对：检查每个 { 是否有对应 }";
  if (/Expected '\\right'/.test(e)) return "\\left 缺少配对的 \\right（或反之）";
  if (/Undefined control sequence|Undefined control sequence: (\S+)/.test(e)){
    const mm = e.match(/Undefined control sequence: (\S+)/);
    return `使用了 KaTeX 不支持的命令 ${mm ? mm[1] : ""}：请改用标准命令，或删除该命令（自定义 \\newcommand 宏无法展开）`;
  }
  if (/\\tag works only in display equations/.test(e)) return "\\tag 只能出现在 $$…$$ 中：改用 $$…$$ 包裹（本工具会自动把 \\tag 转成文本编号）";
  if (/Double subscript|Double superscript/.test(e)) return "同一位置出现两次 ^ 或 _：合并为 ^{...} / _{...}";
  if (/Expected group after '\^'|Expected group after '_'/.test(e)) return "^ 或 _ 后必须紧跟内容：写成 x^{2} / x_{i}";
  if (/Unicode text character/.test(e)) return "公式里混入了中文字符：把中文移到公式外（或在公式内用 \\text{中文}）";
  if (/Expected '\\end'/.test(e)) return "\\begin{env} 与 \\end{env} 不匹配或缺失";
  if (/Invalid size|Too many/.test(e)) return "尺寸/嵌套层级异常：简化该片段";
  if (/No such environment/.test(e)) return "该环境不支持：矩阵用 pmatrix/bmatrix/cases/array，多行用 aligned/gathered";
  if (/Can't use function/.test(e)) return "该函数在当前模式下不可用：改用 $$…$$ 显示模式";
  return `KaTeX 报错：${e.slice(0, 90)}（可尝试简化该片段，或拆成多个小公式）`;
}

/**
 * 校验文本里的全部公式
 * @returns {{ total:number, ok:number, failed:Array<{fragment,error,hint,normalized}>, fragments:number }}
 */
/** 去掉代码围栏与行内代码：里面的 LaTeX 属于「示例文本」，不参与编译校验（文档引用的正当出口） */
export function stripCodeBlocks(text){
  return String(text ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`\n]*`/g, " ");
}

export function checkLatex(text, { displayMode = false } = {}){
  const k = katex();
  text = stripCodeBlocks(text);
  let total = 0, ok = 0;
  const failed = [];
  for (const seg of splitMath(text)){
    if (!seg.math) continue;
    total++;
    const body = String(seg.body ?? "");
    if (!body.trim()){ ok++; continue; }
    try {
      // 校验要严格：throwOnError=true 才能暴露「未知命令」等问题
      // （应用内渲染仍用 throwOnError=false 以便降级显示原文）
      k.renderToString(body, {
        displayMode: seg.display || displayMode, throwOnError: true, strict: false, trust: true,
      });
      ok++;
    } catch (e){
      const err = unescapeHtml(String(e.message ?? e));
      failed.push({ fragment: body.slice(0, 200), error: err.slice(0, 200), hint: hintFor(err, body), normalized: body });
    }
  }
  return { total, ok, failed, fragments: total };
}

/**
 * 扫描图里**所有含文本的字段**，找出编译不过的 LaTeX。
 * 覆盖：节点 label / note、边 label、分组 label、图 name / description。
 * 用于在「写入必经关卡」统一拦截——任何 agent、任何客户端都绕不过。
 */
export function guardGraphText(graph){
  const failed = [];
  const check = (where, text)=>{
    if (!text) return;
    const r = checkLatex(String(text));
    for (const f of r.failed) failed.push({ where, fragment: String(f.fragment).slice(0, 120), error: f.error, hint: f.hint });
  };
  check("graph.name", graph.name);
  check("graph.description", graph.description);
  for (const g of graph.groups ?? []) check(`group ${g.id}`, g.label);
  for (const n of graph.nodes ?? []){
    check(`node ${n.id}.label`, n.label);
    if (graph.notes?.[n.id]) check(`node ${n.id}.note`, graph.notes[n.id]);
  }
  for (const e of graph.edges ?? []) check(`edge ${e.id}.label`, e.label);
  return { ok: failed.length === 0, failed };
}

/** 规范化整张图里的全部文本字段（导入/批量写入前调用） */
export function normalizeGraphText(graph){
  const fix = (v)=> typeof v === "string" && v ? normalizeLatex(v) : v;
  graph.name = fix(graph.name);
  graph.description = fix(graph.description);
  for (const g of graph.groups ?? []) g.label = fix(g.label);
  for (const n of graph.nodes ?? []) n.label = fix(n.label);
  for (const e of graph.edges ?? []) e.label = fix(e.label);
  if (graph.notes && typeof graph.notes === "object"){
    for (const k of Object.keys(graph.notes)) graph.notes[k] = fix(graph.notes[k]);
  }
  return graph;
}

export default { checkLatex, normalizeLatex, splitMath, stripCodeBlocks, guardGraphText, normalizeGraphText };
