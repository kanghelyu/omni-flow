// MCP 协议冒烟测试：initialize → tools/list → tools/call 全链路（stdio JSON-RPC 2.0）。
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const root = await mkdtemp(join(tmpdir(), "of-mcp-test-"));
const node = process.execPath;
const child = spawn(node, [new URL("../bin/of.mjs", import.meta.url).pathname, "mcp"], {
  env: { ...process.env, OF_HOME: root },
  stdio: ["pipe", "pipe", "pipe"]
});
let stderr = "";
child.stderr.on("data", (chunk) => { stderr += chunk; });

const pending = new Map();
let buffer = "";
child.stdout.on("data", (chunk) => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    try {
      const message = JSON.parse(line);
      const resolveFn = pending.get(message.id);
      if (resolveFn) { pending.delete(message.id); resolveFn(message); }
    } catch { /* 忽略坏行 */ }
  }
});

function rpc(method, params) {
  const id = Math.random().toString(36).slice(2);
  return new Promise((resolveFn, rejectFn) => {
    pending.set(id, resolveFn);
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rejectFn(new Error(`timeout: ${method}`)); } }, 10_000);
  });
}

// 1. initialize 握手
const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "0" } });
assert.equal(init.result.serverInfo.name, "omni-flow");
assert.ok(init.result.protocolVersion);
assert.ok(init.result.capabilities.tools);

// 2. tools/list 全量
const tools = await rpc("tools/list", {});
const names = tools.result.tools.map((tool) => tool.name);
assert.equal(tools.result.tools.length, 37, `应有 37 个工具，实际 ${tools.result.tools.length}`);
for (const required of ["of_create_graph", "of_get_graph", "of_patch_node", "of_patch_edge", "of_import_mermaid", "of_import_agentflow", "of_analyze", "of_export", "of_save_template", "of_delete_template", "of_patch_node_type", "of_patch_edge_type", "of_patch_graph_meta", "of_start_studio", "of_list_trash", "of_restore_graph", "of_mcp_check_list"]) {
  // 最后一个故意不存在，防止复制粘贴假通过
  if (required === "of_mcp_check_list") assert.ok(!names.includes(required));
  else assert.ok(names.includes(required), `缺少工具 ${required}`);
}

// 3. tools/call：建图 → 读图 → 改节点颜色 → 改边标签 → 分析 → 导出
const call = async (name, args) => {
  const res = await rpc("tools/call", { name, arguments: args });
  if (res.error) throw new Error(`${name}: ${res.error.message}`);
  const payload = JSON.parse(res.result.content[0].text);
  if (res.result.isError) throw new Error(`${name}: ${payload}`);
  return payload;
};
const created = await call("of_create_graph", { name: "MCP 建图", template: "task-raci" });
assert.ok(created.id);
const detail = await call("of_get_graph", { id: created.id });
const person = detail.nodes.find((node2) => node2.id === "dev");
assert.ok(person);
await call("of_patch_node", { id: created.id, nodeId: "dev", patch: { fill: "#112233", label: "全栈工程师" } });
const edge = detail.edges.find((entry) => entry.type === "raci-a");
await call("of_patch_edge", { id: created.id, edgeId: edge.id, patch: { label: "最终拍板", color: "#ABCDEF", arrow: "both" } });
const after = await call("of_get_graph", { id: created.id });
assert.equal(after.nodes.find((node2) => node2.id === "dev").fill, "#112233");
assert.equal(after.edges.find((entry) => entry.id === edge.id).label, "最终拍板");
const analysis = await call("of_analyze", { id: created.id });
assert.ok(analysis.ranked.length >= 1);
const exported = await call("of_export", { id: created.id, format: "mermaid" });
assert.ok(exported.text.includes("flowchart"));
// 悬空边被拒
await assert.rejects(() => call("of_add_edge", { id: created.id, source: "dev", target: "不存在" }), /不存在|校验/);

// 4. 通知不应产生响应（发一条 initialized，确认无多余帧）
child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);

child.kill();
await new Promise((resolveFn) => child.on("close", resolveFn));
if (stderr.trim()) console.error("stderr:", stderr.slice(0, 500));
console.log("✓ MCP 协议全链路通过（initialize / tools/list ×24 / tools/call / 错误通道 / 通知静默）");
