// OmniFlow data service: reads and writes the graphs/ directory. graph.json is the single source of truth for topology;
// long node notes live in notes/<nodeId>.md (Markdown first) and graph.json.notes keeps only the short summary.
import { readFile, writeFile, mkdir, readdir, rename, unlink } from "node:fs/promises";
import { join, dirname } from "node:path";
import { normalizeGraph, validateGraph } from "./graph-core.js";

/* ================= Reliable-write infrastructure ================= */

/** Serialise writes to the same file: concurrent saves in one process run in order and never interleave. */
const writeChains = new Map();
function enqueueWrite(path, task) {
  const prev = writeChains.get(path) ?? Promise.resolve();
  const next = prev.then(task, task);          // queue even when the previous task failed
  writeChains.set(path, next.then(() => {}, () => {}));
  return next;
}

/** Write fully, then swap: fill a temp file → atomic rename.
    Readers only ever see the complete old version or the complete new one — never a half-written file.
    Falls back to a direct write when the environment (sandbox / cross-device) has no rename. */
async function writeFileSafe(path, content) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid.toString(36)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    await writeFile(tmp, content, "utf8");
    await rename(tmp, path);
    return "atomic";
  } catch (error) {
    try { await unlink(tmp); } catch { /* ignore cleanup failure */ }
    if (["ENOENT", "EACCES", "EPERM", "EXDEV", "ENOTSUP"].includes(error?.code)) {
      await writeFile(path, content, "utf8");
      return "direct";
    }
    throw error;
  }
}

/** Read JSON; on a 'complete object + trailing junk' state (interleaved concurrent writes) it self-heals and rewrites in place.
    Returns null only for a genuinely unrecoverable file — one bad file never takes down a whole listing. */
export async function readJsonIfPresent(path, { heal = true } = {}) {
  let raw;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") console.warn(`[omni-flow] read failed: ${path} (${error.message})`);
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    // self-heal path: take the first complete JSON object
    try {
      const [obj, end] = new JSONDecoder().decodePrefix(raw);
      if (heal && end < raw.length) {
        await writeFile(path, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
        console.warn(`[omni-flow] self-healed a truncated file: ${path} (dropped ${raw.length - end} trailing bytes)`);
      }
      return obj;
    } catch {
      console.warn(`[omni-flow] unrecoverable, skipped: ${path}`);
      return null;
    }
  }
}

/** Take the first complete JSON value at the start of a string (tolerating trailing content); returns [value, endIndex]. */
class JSONDecoder {
  decodePrefix(text) {
    const trimmed = text.trimStart();
    const offset = text.length - trimmed.length;
    // incremental JSON.parse: probe the boundary chunk by chunk (braces/brackets must pair)
    const first = trimmed[0];
    if (first !== "{" && first !== "[") throw new Error('not a JSON start');
    let depth = 0, inStr = false, esc = false;
    for (let i = 0; i < trimmed.length; i++) {
      const c = trimmed[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') { inStr = true; continue; }
      if (c === "{" || c === "[") depth++;
      else if (c === "}" || c === "]") {
        depth--;
        if (depth === 0) {
          const slice = trimmed.slice(0, i + 1);
          return [JSON.parse(slice), offset + i + 1];
        }
      }
    }
    throw new Error('unclosed brackets');
  }
}

export function graphDir(root, id) {
  return join(root, "graphs", id);
}

export async function loadGraph(root, id) {
  if (!id) throw new Error('missing graph id');
  const dir = graphDir(root, id);
  const file = join(dir, "graph.json");
  let raw;
  try {
    raw = await readFile(file, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      const notFound = new Error(`graph not found: ${id} (${dir})`);
      notFound.code = "NOT_FOUND";
      throw notFound;
    }
    throw error;
  }
  try {
    return { dir, root, graph: normalizeGraph(JSON.parse(raw)) };
  } catch {
    // corrupt: try self-healing first; if that fails report 'corrupt' (not 'missing') and never overwrite silently
    const healed = await readJsonIfPresent(file);
    if (healed) return { dir, root, graph: normalizeGraph(healed) };
    const corrupt = new Error(`graph file is corrupt and could not be recovered automatically (the original and its .bak backup are both kept): ${file}`);
    corrupt.code = "CORRUPT";
    throw corrupt;
  }
}

export async function saveGraph(dir, graph) {
  graph.updatedAt = new Date().toISOString();
  await mkdir(dir, { recursive: true });
  const file = join(dir, "graph.json");
  const content = `${JSON.stringify(graph, null, 2)}\n`;
  // save queue: one file at a time, in order; backup rotation happens first (keeps the old version so corruption is recoverable)
  return enqueueWrite(file, async () => {
    try {
      const prev = await readFile(file, "utf8");
      const bakDir = join(dir, ".bak");
      await mkdir(bakDir, { recursive: true });
      const stamp = `${new Date().toISOString().replace(/[:.]/g, "-")}-${process.pid.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      await writeFile(join(bakDir, `graph-${stamp}.json`), prev, "utf8");
      const baks = (await readdir(bakDir)).filter((f) => f.startsWith("graph-")).sort();
      for (const old of baks.slice(0, -3)) await unlink(join(bakDir, old));
    } catch { /* first save: no previous file */ }
    await writeFileSafe(file, content);
    // read-back check: rewrite immediately if the result does not parse (last-resort guard against interleaving)
    try {
      JSON.parse(await readFile(file, "utf8"));
    } catch {
      await writeFileSafe(file, content);
      console.warn(`[omni-flow] write verification failed, rewritten: ${file}`);
    }
  });
}

export async function saveGraphChecked(root, id, graph) {
  const verdict = validateGraph(graph);
  if (!verdict.ok) {
    const error = new Error('structure validation failed');
    error.issues = verdict.issues;
    throw error;
  }
  await saveGraph(graphDir(root, id), graph);
  return verdict;
}

/** Long node note: notes/<nodeId>.md. Reads return {content, exists}. */
export async function readNodeNote(root, id, nodeId) {
  const safe = String(nodeId ?? "").replace(/[^A-Za-z0-9_\u4e00-\u9fff-]/g, "");
  if (!safe) return { content: "", exists: false };
  try {
    return { content: await readFile(join(graphDir(root, id), "notes", `${safe}.md`), "utf8"), exists: true };
  } catch {
    return { content: "", exists: false };
  }
}

export async function writeNodeNote(root, id, nodeId, content, opts = {}) {
  // ===== Formula gate (enforced: every note write, from every agent and client, passes through here) =====
  // (1) normalise: \\tag → text number, \\bm → \\boldsymbol, shorthands like \\RR → standard commands, strip the preamble …
  //     what lands on disk is always plain standard KaTeX, never an outside macro.
  // (2) hard-validate: any fragment that still fails → reject the write and throw an error carrying **per-fragment fixes**.
  //     The only legitimate escape hatches: put sample LaTeX source in a code fence ```…```, or pass opts.force explicitly.
  {
    const { normalizeLatex, checkLatex } = await import("./latex.js");
    const normalized = normalizeLatex(content);
    const report = checkLatex(normalized);
    if (!opts.force && report.failed.length) {
      const detail = report.failed.slice(0, 5)
        .map((f, i)=> `  ${i + 1}) fragment: ${String(f.fragment).replace(/\s+/g, ' ').slice(0, 120)}\n     error: ${f.error}\n     fix: ${f.hint}`)
        .join("\n");
      const err = new Error(`LaTeX validation failed, write rejected (${report.failed.length}/${report.total} fragments do not compile):\n${detail}\nApply the suggested fixes and write again; to show LaTeX source itself, put it inside a code fence \`\`\`…\`\`\`.`);
      err.code = "LATEX_INVALID";
      err.latex = report;
      throw err;
    }
    content = normalized;                       // later logic is unchanged, but operates on the normalised content
    var __latexReport = { checked: report.total, ok: report.ok, failed: report.failed.map((f)=> ({ fragment: String(f.fragment).slice(0, 80), hint: f.hint })) };
  }

  const safe = String(nodeId ?? "").replace(/[^A-Za-z0-9_\u4e00-\u9fff-]/g, "");
  if (!safe) throw new Error('invalid node id');
  const notesDir = join(graphDir(root, id), "notes");
  await mkdir(notesDir, { recursive: true });
  await writeFileSafe(join(notesDir, `${safe}.md`), String(content ?? ""));
}

export async function listGraphs(root) {
  let entries = [];
  try {
    entries = await readdir(join(root, "graphs"), { withFileTypes: true });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const graphs = [];
  for (const entry of entries.filter((item) => item.isDirectory())) {
    const stored = await readJsonIfPresent(join(root, "graphs", entry.name, "graph.json"));
    if (!stored) continue;
    const verdict = validateGraph(normalizeGraph(stored));
    graphs.push({
      id: entry.name,
      name: stored.name ?? entry.name,
      revision: stored.revision ?? 1,
      nodes: (stored.nodes ?? []).length,
      edges: (stored.edges ?? []).length,
      groups: (stored.groups ?? []).length,
      valid: verdict.ok,
      warnings: verdict.warnings.length,
      updatedAt: stored.updatedAt ?? null
    });
  }
  return graphs.sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
}

export async function deleteGraph(root, id) {
  const dir = graphDir(root, id);
  const stored = await readJsonIfPresent(join(dir, "graph.json"));
  if (!stored) throw new Error(`graph ${id} not found`);
  const trashDir = join(root, "trash", `${new Date().toISOString().replace(/[:.]/g, "-")}-${id}`);
  await mkdir(join(root, "trash"), { recursive: true });
  await rename(dir, trashDir);
  return trashDir;
}

export function makeGraphId(name) {
  const base = String(name ?? "").replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, "").slice(0, 24) || "graph";
  return `${base}-${Date.now().toString(36).slice(-4)}`;
}
