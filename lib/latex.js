/**
 * LaTeX validation and normalisation (server side, for agents to self-check)
 *
 * Purpose: **keep agents from writing formulas that cannot compile.** When an agent writes
 * cards / notes / imports over MCP, it calls checkLatex() first, gets the exact error plus a
 *
 * KaTeX is loaded as a vendored UMD bundle (zero dependencies, no npm install).
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
    // mhchem is the official KaTeX contrib that provides \ce{}.
    // Its UMD takes the require("katex") branch first — the sandbox has no require, so **do not
    // expose module/exports** and it falls through to the global branch, registering the extension on
    const s2 = { katex: k, console };
    s2.self = s2; s2.window = s2;
    vm.createContext(s2);
    vm.runInContext(readFileSync(join(VENDOR, "contrib", "mhchem.min.js"), "utf8"), s2, { filename: "mhchem.min.js" });
  } catch { /* without mhchem the rest still validates */ }
  KATEX = k;
  return KATEX;
}

/**
 * Rewrite table: common shorthands → KaTeX **standard commands**.
 * Note: no macros are defined here (KaTeX's macros option is not used); shorthands are rewritten into
 * the standard spelling, so stored and rendered LaTeX is always plain standard KaTeX with no outside macros.
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

/** Same rules as the front-end normalizeLatex: turn paper/agent LaTeX into something that always compiles.
 *  Fenced and inline code survive verbatim: $, % and backslashes inside code are sample text, not LaTeX
 *  (same escape hatch as stripCodeBlocks — otherwise `gcd(b, a % b)` loses its `% b)` to comment stripping). */
export function normalizeLatex(src){
  let t = String(src ?? "");
  const verbatim = [];
  t = t.replace(/```[\s\S]*?```|`[^`\n]*`/g, (m)=> { verbatim.push(m); return `\u0000V${verbatim.length - 1}\u0000`; });
  // rewrite non-standard shorthands into standard commands first (final output is plain standard KaTeX)
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
                (_m, env)=> `[${env}: this environment is not supported on the web; omitted here]`);
  t = t.replace(/\\(begin|end)\{(?!equation|align|gather|multline|displaymath|math|alignat|flalign|eqnarray|pmatrix|bmatrix|vmatrix|matrix|cases|array|aligned|gathered|split|smallmatrix)[^}]*\}/g, "");
  t = t.replace(/\\begin\{(align\*?|alignat\*?|flalign\*?|eqnarray\*?)\}([\s\S]*?)\\end\{\1\}/g, (_m, _e, b)=> `$$\\begin{aligned}${b}\\end{aligned}$$`);
  t = t.replace(/\\begin\{(gather\*?|multline\*?)\}([\s\S]*?)\\end\{\1\}/g, (_m, _e, b)=> `$$\\begin{gathered}${b}\\end{gathered}$$`);
  t = t.replace(/\\begin\{(equation\*?|displaymath|math)\}([\s\S]*?)\\end\{\1\}/g, (_m, _e, b)=> `$$${b}$$`);
  t = t.replace(/\u0000V(\d+)\u0000/g, (_m, i)=> verbatim[Number(i)] ?? "");
  return t;
}

/** Split text into [plain text | math segments] (same rules as the front end: delimiters + bare formula lines + inline commands) */
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

/** Turn a KaTeX error into an **actionable fix** an agent can apply on its own */
function unescapeHtml(s){
  return String(s).replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
function hintFor(err, frag){
  const e = unescapeHtml(err);
  if (/Unexpected end of input/.test(e)) return "Formula is incomplete or a bracket is unclosed: check that every { has a }, and every \\left has a \\right";
  if (/Expected '}', got 'EOF'|Expected '\\}'/.test(e)) return "Unbalanced braces: check that every { has a matching }";
  if (/Expected '\\right'/.test(e)) return "\\left is missing its matching \\right (or vice versa)";
  if (/Undefined control sequence|Undefined control sequence: (\S+)/.test(e)){
    const mm = e.match(/Undefined control sequence: (\S+)/);
    return `Unsupported command ${mm ? mm[1] : ""}: use a standard command instead, or drop it (a custom \\newcommand macro cannot be expanded)`;
  }
  if (/\\tag works only in display equations/.test(e)) return "\\tag is only allowed in $$…$$: wrap it in $$…$$ (this tool converts \\tag to a text number automatically)";
  if (/Double subscript|Double superscript/.test(e)) return "Two ^ or _ at the same position: combine them into ^{...} / _{...}";
  if (/Expected group after '\^'|Expected group after '_'/.test(e)) return "Something must follow ^ or _: write x^{2} / x_{i}";
  if (/Unicode text character/.test(e)) return "A non-math character slipped into the formula: move it outside, or wrap it in \\text{…}";
  if (/Expected '\\end'/.test(e)) return "\\begin{env} and \\end{env} do not match, or one is missing";
  if (/Invalid size|Too many/.test(e)) return "Bad size or nesting depth: simplify this fragment";
  if (/No such environment/.test(e)) return "Environment not supported: use pmatrix/bmatrix/cases/array for matrices, aligned/gathered for multi-line";
  if (/Can't use function/.test(e)) return "This function is unavailable in the current mode: switch to $$…$$ display mode";
  return `KaTeX error: ${e.slice(0, 90)} (try simplifying the fragment, or split it into smaller formulas)`;
}

/**
 * Validate every formula in a piece of text
 * @returns {{ total:number, ok:number, failed:Array<{fragment,error,hint,normalized}>, fragments:number }}
 */
/** Strip code fences and inline code: LaTeX inside them is sample text and is not validated (the legitimate escape hatch for quoting source) */
export function stripCodeBlocks(text){
  return String(text ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`\n]*`/g, " ");
}

/** Count delimiters that were opened and never closed.
 *  An unmatched `$` (or `\(` / `\[`) silently turns the whole fragment into plain text,
 *  so it never reaches KaTeX and the renderer looks "fine" — that is exactly the kind of
 *  silent failure this gate exists to catch. Escaped `\$` and code fences are ignored. */
export function unclosedDelimiters(text){
  const src = String(text ?? "");
  const issues = [];
  const count = (re)=> (src.match(re) ?? []).length;
  const isDollar = (i)=> src[i] === "$" && (i === 0 || src[i - 1] !== "\\");
  // `$$` display pairs first, then remaining single `$`
  let single = 0, display = 0, i = 0;
  while (i < src.length){
    if (!isDollar(i)){ i++; continue; }
    if (src[i + 1] === "$"){ display++; i += 2; continue; }
    single++; i++;
  }
  if (display % 2) issues.push({ kind: "$$", hint: "An unclosed `$$` was found: display math needs a closing `$$`." });
  if (single % 2) issues.push({ kind: "$", hint: "An unclosed `$` was found: inline math needs a closing `$` (escape a literal dollar as \\$)." });
  if (count(/\\\(/g) !== count(/\\\)/g)) issues.push({ kind: "\\(…\\)", hint: "`\\(` and `\\)` do not pair up: check for a missing `\\)`." });
  if (count(/\\\[/g) !== count(/\\\]/g)) issues.push({ kind: "\\[…\\]", hint: "`\\[` and `\\]` do not pair up: check for a missing `\\]`." });
  return issues;
}

export function checkLatex(text, { displayMode = false } = {}){
  const k = katex();
  text = stripCodeBlocks(text);
  let total = 0, ok = 0;
  const failed = [];
  for (const issue of unclosedDelimiters(text)){
    total++;
    failed.push({
      fragment: String(issue.kind),
      error: `unclosed delimiter ${issue.kind}`,
      hint: issue.hint,
      normalized: issue.kind,
    });
  }
  for (const seg of splitMath(text)){
    if (!seg.math) continue;
    total++;
    const body = String(seg.body ?? "");
    if (!body.trim()){ ok++; continue; }
    try {
      // Validation must be strict: throwOnError=true is what surfaces unknown commands
      // (in-app rendering still uses throwOnError=false so it can degrade to the source text)
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
 * Scan **every text-bearing field** of a graph for LaTeX that will not compile.
 * Covers: node label / note, edge label, group label, graph name / description.
 * Used as a single mandatory gate on every write — no agent and no client can bypass it.
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

/** Normalise every text field of a graph (call before imports and bulk writes) */
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
