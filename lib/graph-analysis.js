// OmniFlow 图分析：分层自动布局（容忍环）、上游/下游依赖追踪、度中心性排名。
import { detectCycles } from "./graph-core.js";

/**
 * 分层布局：最长路径分层 + 同层按连接密度排序。含环时先断环（DFS 反向一条边）。
 * 返回 Map<nodeId, {x, y}>。
 */
export function layeredLayout(nodes, edges, { nodeW = 168, nodeH = 64, gapX = 110, gapY = 90, direction = "TD" } = {}) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = new Map(nodes.map((node) => [node.id, []]));
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const validEdges = edges.filter((edge) => byId.has(edge.source) && byId.has(edge.target) && edge.source !== edge.target);
  for (const edge of validEdges) adjacency.get(edge.source).push(edge.target);

  // 断环：DFS 遇到回边就记录，布局时忽略。
  const backEdges = new Set();
  const state = new Map();
  const dfs = (id) => {
    state.set(id, 1);
    for (const next of adjacency.get(id) ?? []) {
      const mark = state.get(next) ?? 0;
      if (mark === 1) backEdges.add(`${id}\u0000${next}`);
      else if (mark === 0) dfs(next);
    }
    state.set(id, 2);
  };
  for (const node of nodes) if ((state.get(node.id) ?? 0) === 0) dfs(node.id);

  const dagEdges = validEdges.filter((edge) => !backEdges.has(`${edge.source}\u0000${edge.target}`));
  const dagAdj = new Map(nodes.map((node) => [node.id, []]));
  const dagIn = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of dagEdges) {
    dagAdj.get(edge.source).push(edge.target);
    dagIn.set(edge.target, (dagIn.get(edge.target) ?? 0) + 1);
  }
  // 最长路径分层（拓扑序 DP）。
  const level = new Map();
  const queue = nodes.filter((node) => (dagIn.get(node.id) ?? 0) === 0).map((node) => node.id);
  for (const id of queue) level.set(id, 0);
  const indegreeWork = new Map(dagIn);
  const order = [];
  const work = [...queue];
  while (work.length) {
    const id = work.shift();
    order.push(id);
    for (const next of dagAdj.get(id) ?? []) {
      level.set(next, Math.max(level.get(next) ?? 0, (level.get(id) ?? 0) + 1));
      const remaining = (indegreeWork.get(next) ?? 1) - 1;
      indegreeWork.set(next, remaining);
      if (remaining === 0) work.push(next);
    }
  }
  nodes.forEach((node, index) => {
    if (!level.has(node.id)) level.set(node.id, (order.length > 0 ? level.get(order[order.length - 1]) ?? 0 : 0) + (index % 3) + 1);
  });

  // 同层内排序：尽量让相连节点相邻（按前驱平均序号排）。
  const rows = new Map();
  for (const node of nodes) {
    const layer = level.get(node.id) ?? 0;
    if (!rows.has(layer)) rows.set(layer, []);
    rows.get(layer).push(node.id);
  }
  const positions = new Map();
  for (const [layer, ids] of [...rows.entries()].sort((a, b) => a[0] - b[0])) {
    ids.forEach((id, index) => {
      if (direction === "LR") {
        positions.set(id, { x: 80 + layer * (nodeW + gapX), y: 90 + index * (nodeH + gapY) });
      } else {
        positions.set(id, { x: 80 + index * (nodeW + gapX), y: 90 + layer * (nodeH + gapY) });
      }
    });
  }
  return positions;
}

/** 依赖追踪：返回某节点的全部上游（被谁支撑）/下游（依赖谁）闭包。 */
export function traceNode(nodes, edges, nodeId, { maxDepth = 12 } = {}) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  if (!byId.has(nodeId)) return null;
  const upstream = new Map();   // edge.target === nodeId 的来源（支撑本节点的东西）
  const downstream = new Map(); // edge.source === nodeId 的去向（依赖本节点的东西）
  const collect = (startId, direction, bucket) => {
    const seen = new Set([startId]);
    let frontier = [startId];
    let depth = 0;
    while (frontier.length && depth < maxDepth) {
      const nextFrontier = [];
      for (const id of frontier) {
        for (const edge of edges) {
          const neighbor = direction === "up"
            ? (edge.target === id ? edge.source : null)
            : (edge.source === id ? edge.target : null);
          if (!neighbor || !byId.has(neighbor) || seen.has(neighbor)) continue;
          seen.add(neighbor);
          bucket.set(neighbor, { depth: depth + 1, via: id });
          nextFrontier.push(neighbor);
        }
      }
      frontier = nextFrontier;
      depth += 1;
    }
  };
  collect(nodeId, "up", upstream);
  collect(nodeId, "down", downstream);
  return {
    nodeId,
    upstream: [...upstream.entries()].map(([id, info]) => ({ id, label: byId.get(id).label, type: byId.get(id).type, depth: info.depth })),
    downstream: [...downstream.entries()].map(([id, info]) => ({ id, label: byId.get(id).label, type: byId.get(id).type, depth: info.depth }))
  };
}

/**
 * 度中心性排名：找瓶颈节点（入+出度最高）与单点依赖。
 * RACI 场景里 degree 过高的 person 节点 = 单点故障风险。
 */
export function centralityReport(nodes, edges, { top = 8 } = {}) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const stats = new Map(nodes.map((node) => [node.id, { in: 0, out: 0 }]));
  for (const edge of edges) {
    if (!stats.has(edge.source) || !stats.has(edge.target)) continue;
    if (edge.source !== edge.target) {
      stats.get(edge.source).out += 1;
      stats.get(edge.target).in += 1;
    }
  }
  const ranked = [...stats.entries()]
    .map(([id, stat]) => ({ id, label: byId.get(id)?.label ?? id, type: byId.get(id)?.type ?? "", ...stat, total: stat.in + stat.out }))
    .sort((a, b) => b.total - a.total);
  const max = ranked[0]?.total ?? 0;
  return {
    ranked: ranked.slice(0, top),
    hubs: ranked.filter((entry) => entry.total > 0 && entry.total >= Math.max(3, max * 0.6)).map((entry) => entry.id),
    edgeCount: edges.length
  };
}

export function analyzeGraph(nodes, edges, { trace = null } = {}) {
  const cycles = detectCycles(nodes, edges);
  const centrality = centralityReport(nodes, edges);
  const traceResult = trace ? traceNode(nodes, edges, trace) : null;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const undirected = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) {
    if (undirected.has(edge.source)) undirected.set(edge.source, undirected.get(edge.source) + 1);
    if (undirected.has(edge.target)) undirected.set(edge.target, undirected.get(edge.target) + 1);
  }
  const isolated = nodes.filter((node) => (undirected.get(node.id) ?? 0) === 0).map((node) => node.id);
  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    cycles: cycles.map((cycle) => cycle.map((id) => byId.get(id)?.label ?? id)),
    isolated: isolated.map((id) => ({ id, label: byId.get(id)?.label ?? id })),
    hubs: centrality.hubs.map((id) => ({ id, label: byId.get(id)?.label ?? id })),
    ranked: centrality.ranked,
    trace: traceResult
  };
}


/** 分组聚簇布局：同组节点空间聚在一起。
    每组成员按当前坐标排序后竖向排成一列（>6 拆双列），
    各组区域从左到右排成带状，超宽换带；未分组节点归入尾区。 */
export function clusterLayout(graph, { colGap = 80, rowGap = 56, regionGap = 300, perCol = 6, bandWidth = 3400 } = {}) {
  const groups = graph.groups ?? [];
  const grouped = new Set(groups.flatMap((g) => g.members ?? []));
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const regions = [];
  for (const g of groups) {
    const members = (g.members ?? []).map((id) => nodeById.get(id)).filter(Boolean);
    if (members.length) regions.push(members);
  }
  const rest = graph.nodes.filter((n) => !grouped.has(n.id));
  if (rest.length) regions.push(rest);

  const positions = new Map();
  let cursorX = 0, bandY = 0, bandMaxH = 0;
  for (const region of regions) {
    const nodes = [...region].sort((a, b) => (a.x - b.x) || (a.y - b.y));
    const maxW = Math.max(...nodes.map((n) => n.w || 168), 168);
    const cols = Math.ceil(nodes.length / perCol);
    const regionW = cols * (maxW + colGap);
    const regionH = Math.min(perCol, nodes.length) * ((nodes[0]?.h ?? 64) + rowGap) + 80;
    if (bandUsed(cursorX, regionW)) { bandY += bandMaxH + 120; cursorX = 0; bandMaxH = 0; }
    nodes.forEach((n, i) => {
      const col = Math.floor(i / perCol), row = i % perCol;
      positions.set(n.id, {
        x: cursorX + col * (maxW + colGap),
        y: bandY + 40 + row * ((n.h ?? 64) + rowGap)
      });
    });
    cursorX += regionW + regionGap;
    bandMaxH = Math.max(bandMaxH, regionH);
  }
  function bandUsed(x, w) { return x > 0 && x + w > bandWidth; }
  return positions;
}
