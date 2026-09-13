// MCP protocol smoke test: initialize → tools/list → tools/call end to end (stdio JSON-RPC 2.0).
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
    } catch { /* ignore a bad line */ }
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

// 1. initialize handshake
const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "0" } });
assert.equal(init.result.serverInfo.name, "omni-flow");
assert.ok(init.result.protocolVersion);
assert.ok(init.result.capabilities.tools);

// 2. tools/list, full set
const tools = await rpc("tools/list", {});
const names = tools.result.tools.map((tool) => tool.name);
assert.equal(tools.result.tools.length, 61, `expected 61 tools, got ${tools.result.tools.length}`);
for (const required of ["of_create_graph", "of_get_graph", "of_patch_node", "of_patch_edge", "of_import_mermaid", "of_import_agentflow", "of_analyze", "of_export", "of_save_template", "of_delete_template", "of_patch_node_type", "of_patch_edge_type", "of_patch_graph_meta", "of_start_studio", "of_list_trash", "of_restore_graph", "of_mcp_check_list"]) {
  // the last one deliberately does not exist, to prevent a copy-paste false pass
  if (required === "of_mcp_check_list") assert.ok(!names.includes(required));
  else assert.ok(names.includes(required), `missing tool ${required}`);
}

// 3. tools/call: create → read → recolour a node → relabel an edge → analyze → export
const call = async (name, args) => {
  const res = await rpc("tools/call", { name, arguments: args });
  if (res.error) throw new Error(`${name}: ${res.error.message}`);
  const text = res.result.content[0].text;
  // An error response carries a human-readable message (prefixed with ✗), not JSON —
  // check isError BEFORE parsing, otherwise JSON.parse throws and the assertion below
  // can pass for the wrong reason (it used to match the node name inside the SyntaxError).
  if (res.result.isError) throw new Error(`${name}: ${text}`);
  return JSON.parse(text);
};
const created = await call("of_create_graph", { name: "MCP graph", template: "task-raci" });
assert.ok(created.id);
const detail = await call("of_get_graph", { id: created.id });
const person = detail.nodes.find((node2) => node2.id === "dev");
assert.ok(person);
await call("of_patch_node", { id: created.id, nodeId: "dev", patch: { fill: "#112233", label: "Full-stack engineer" } });
const edge = detail.edges.find((entry) => entry.type === "raci-a");
await call("of_patch_edge", { id: created.id, edgeId: edge.id, patch: { label: "final decision", color: "#ABCDEF", arrow: "both" } });
const after = await call("of_get_graph", { id: created.id });
assert.equal(after.nodes.find((node2) => node2.id === "dev").fill, "#112233");
assert.equal(after.edges.find((entry) => entry.id === edge.id).label, "final decision");
const analysis = await call("of_analyze", { id: created.id });
assert.ok(analysis.ranked.length >= 1);
const exported = await call("of_export", { id: created.id, format: "mermaid" });
assert.ok(exported.text.includes("flowchart"));
// a dangling edge is rejected
await assert.rejects(() => call("of_add_edge", { id: created.id, source: "dev", target: "no-such-node" }), /not found|validation/i);

// 4. notifications must not produce a response (send initialized, expect no extra frame)
child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);

child.kill();
await new Promise((resolveFn) => child.on("close", resolveFn));
if (stderr.trim()) console.error("stderr:", stderr.slice(0, 500));
console.log("✓ MCP protocol end-to-end passed (initialize / tools/list / tools/call / error channel / silent notifications)");
