// Obsidian 式文件夹树：图文件保持扁平存储（trash/MCP/CLI 兼容），
// tree.json 只记录「文件夹路径集合 + 图归属」，移动 = 改树，零数据迁移风险。
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { listGraphs } from "./graph-service.mjs";

const treePath = (root) => join(root, "tree.json");

export async function readTree(root) {
  try {
    const raw = JSON.parse(await readFile(treePath(root), "utf8"));
    return { folders: Array.isArray(raw.folders) ? raw.folders : [], assign: raw.assign && typeof raw.assign === "object" ? raw.assign : {} };
  } catch {
    return { folders: [], assign: {} };
  }
}

export async function writeTree(root, tree) {
  await mkdir(root, { recursive: true });
  // 原子写入：临时文件 + rename，杜绝并发/中断产生的半截 tree.json
  const tmp = `${treePath(root)}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  await writeFile(tmp, `${JSON.stringify(tree, null, 2)}\n`, "utf8");
  await rename(tmp, treePath(root));
  return tree;
}

export function normFolder(p) {
  return String(p ?? "").split("/").map((part) => part.trim()).filter(Boolean).join("/");
}

export function ensureAncestors(tree, folder) {
  const parts = folder.split("/");
  for (let i = 1; i <= parts.length; i++) {
    const p = parts.slice(0, i).join("/");
    if (!tree.folders.includes(p)) tree.folders.push(p);
  }
}

export function descendantsOf(folder) {
  return (p) => p === folder || p.startsWith(folder + "/");
}

/** 新建文件夹（含全部祖先）。已存在视为成功。 */
export async function createFolder(root, path) {
  const folder = normFolder(path);
  if (!folder) throw new Error("文件夹路径不能为空");
  const tree = await readTree(root);
  if (tree.folders.includes(folder)) return { ok: true, folder, existed: true };
  ensureAncestors(tree, folder);
  await writeTree(root, tree);
  await updateLedger(root);
  return { ok: true, folder, existed: false };
}

/** 重命名/移动文件夹及其全部子树；所属图跟着走。 */
export async function renameFolder(root, path, newPath) {
  const from = normFolder(path);
  const to = normFolder(newPath);
  if (!from) throw new Error("原文件夹路径不能为空");
  if (!to) throw new Error("新文件夹路径不能为空");
  if (from === to) return { ok: true, from, to };
  if (to.startsWith(from + "/")) throw new Error("不能把文件夹移动到它自己的子目录");
  const tree = await readTree(root);
  if (!tree.folders.includes(from)) throw new Error(`文件夹不存在：${from}`);
  const affected = tree.folders.filter(descendantsOf(from));
  for (const p of affected) {
    const np = to + p.slice(from.length);
    if (!tree.folders.includes(np)) tree.folders.push(np);
  }
  tree.folders = tree.folders.filter((p) => !descendantsOf(from)(p));
  for (const [graphId, folder] of Object.entries(tree.assign)) {
    if (folder && descendantsOf(from)(folder)) tree.assign[graphId] = to + folder.slice(from.length);
  }
  await writeTree(root, tree);
  await updateLedger(root);
  return { ok: true, from, to, movedFolders: affected.length };
}

/** 删除文件夹（必须是叶子）；归属其中的图上移到父目录。 */
export async function deleteFolder(root, path) {
  const folder = normFolder(path);
  if (!folder) throw new Error("根目录不可删除");
  const tree = await readTree(root);
  if (!tree.folders.includes(folder)) throw new Error(`文件夹不存在：${folder}`);
  if (tree.folders.some((p) => p.startsWith(folder + "/"))) throw new Error("文件夹非空（含子文件夹），请先删除或移动子文件夹");
  tree.folders = tree.folders.filter((p) => p !== folder);
  const parent = folder.includes("/") ? folder.slice(0, folder.lastIndexOf("/")) : "";
  for (const [graphId, f] of Object.entries(tree.assign)) {
    if (f === folder) tree.assign[graphId] = parent;
  }
  await writeTree(root, tree);
  await updateLedger(root);
  return { ok: true, deleted: folder, parent };
}

/** 把图移动到某文件夹（"" = 根目录）。 */
export async function moveGraph(root, graphId, folder) {
  const target = normFolder(folder);
  if (!graphId) throw new Error("缺少 graphId");
  const tree = await readTree(root);
  if (target && !tree.folders.includes(target)) {
    ensureAncestors(tree, target);
    await writeTree(root, tree);
  }
  tree.assign[graphId] = target;
  await writeTree(root, tree);
  await updateLedger(root);
  return { ok: true, graphId, folder: target };
}

/** 工作记录：顶层「工作记录.txt」，简短记录哪个图放在哪个文件夹。
    agent 每次运行必须先读它（或 of_tree）决定归档位置：
    已有同主题文件夹 → 直接复用；新领域 → 新建；用户指定 → 以用户为准。 */
export async function updateLedger(root) {
  const tree = await readTree(root);
  let graphs = [];
  try { graphs = await listGraphs(root); } catch { /* 根目录尚未建立 */ }
  const byFolder = new Map();
  for (const g of graphs) {
    const f = tree.assign[g.id] ?? "";
    if (!byFolder.has(f)) byFolder.set(f, []);
    byFolder.get(f).push(g);
  }
  const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  const lines = [
    "OmniFlow 工作记录（自动生成，请勿手工编辑）",
    `更新时间: ${stamp}`,
    ""
  ];
  for (const folder of [...tree.folders].sort()) {
    lines.push(`📁 ${folder}`);
    for (const g of byFolder.get(folder) ?? []) lines.push(`   └ ${g.name}（${g.id}）`);
  }
  const rootGraphs = byFolder.get("") ?? [];
  if (rootGraphs.length) {
    lines.push("📁 （根目录 · 未归档）");
    for (const g of rootGraphs) lines.push(`   └ ${g.name}（${g.id}）`);
  }
  lines.push(
    "",
    "归档规则：agent 建图前必读本记录——已有同主题文件夹直接复用；新领域才新建文件夹；用户指定路径时以用户为准。"
  );
  await writeFile(join(root, "工作记录.txt"), lines.join("\n") + "\n", "utf8");
  return { ok: true, ledger: join(root, "工作记录.txt") };
}
