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

/**
 * Resolve a layout mode to node positions.
 * One definition for the CLI, the MCP server and the Studio: previously each caller had its own
 * chain, and the MCP one silently ignored `force` / `grid` (an agent asking for them got layered).
 */
/**
 * Apply a layout to a graph in place: compute positions, write them onto the nodes, and drop the
 * pinned group geometry. Keeping `group.rect` after an explicit re-layout left the box behind while
 * its cards moved away — a re-layout reflows everything, so the box must re-fit its members.
 */
export function applyLayout(graph, mode = "layered"){
  const positions = computeLayout(graph, mode);
  for (const node of graph.nodes ?? []){
    const position = positions.get(node.id);
    if (position){ node.x = position.x; node.y = position.y; }
  }
  for (const group of graph.groups ?? []) delete group.rect;
  return positions.size;
}

export function computeLayout(graph, mode = "layered"){
  switch (String(mode ?? "layered")){
    case "clusters": return clusterLayout(graph);
    case "force": return forceLayout(graph.nodes, graph.edges);
    case "grid": return gridLayout(graph.nodes);
    default: return layeredLayout(graph.nodes, graph.edges, { direction: graph.direction });
  }
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
export function clusterLayout(graph, { colGap = 80, rowGap = 56, regionGap = 140, perCol = 6, bandWidth = 3400 } = {}) {
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

/* ================= 力导向布局（Fruchterman-Reingold 简化版，确定性种子） ================= */
export function forceLayout(nodes, edges, { width = 1600, height = 1100, iterations = 320, seed = 42 } = {}) {
  const positions = new Map();
  if (!nodes.length) return positions;
  // 确定性伪随机（同一图每次布局结果一致，便于复现）
  let rnd = seed >>> 0;
  const next = () => ((rnd = (rnd * 1664525 + 1013904223) >>> 0) / 4294967296);
  const cx = width / 2, cy = height / 2;
  const pos = new Map();
  nodes.forEach((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2;
    pos.set(n.id, { x: cx + Math.cos(angle) * width * 0.32 + (next() - 0.5) * 40,
                    y: cy + Math.sin(angle) * height * 0.32 + (next() - 0.5) * 40 });
  });
  const ids = nodes.map((n) => n.id);
  const links = edges.filter((e) => pos.has(e.source) && pos.has(e.target));
  const area = width * height;
  const k = Math.sqrt(area / Math.max(1, ids.length));
  let temp = width / 8;
  const cooling = temp / (iterations + 1);
  for (let iter = 0; iter < iterations; iter++) {
    const disp = new Map(ids.map((id) => [id, { x: 0, y: 0 }]));
    // 斥力（所有节点两两）
    for (let i = 0; i < ids.length; i++) {
      const a = pos.get(ids[i]);
      for (let j = i + 1; j < ids.length; j++) {
        const b = pos.get(ids[j]);
        let dx = a.x - b.x, dy = a.y - b.y;
        let dist = Math.hypot(dx, dy) || 0.01;
        const force = (k * k) / dist;
        dx /= dist; dy /= dist;
        const da = disp.get(ids[i]), db = disp.get(ids[j]);
        da.x += dx * force; da.y += dy * force;
        db.x -= dx * force; db.y -= dy * force;
      }
    }
    // 引力（相连节点）
    for (const e of links) {
      const a = pos.get(e.source), b = pos.get(e.target);
      let dx = a.x - b.x, dy = a.y - b.y;
      const dist = Math.hypot(dx, dy) || 0.01;
      const force = (dist * dist) / k;
      dx /= dist; dy /= dist;
      const da = disp.get(e.source), db = disp.get(e.target);
      da.x -= dx * force; da.y -= dy * force;
      db.x += dx * force; db.y += dy * force;
    }
    // 位移限幅 + 降温 + 边界收敛
    for (const id of ids) {
      const p = pos.get(id), d = disp.get(id);
      const len = Math.hypot(d.x, d.y) || 0.01;
      const step = Math.min(len, temp);
      p.x += (d.x / len) * step;
      p.y += (d.y / len) * step;
      p.x = Math.max(60, Math.min(width - 60, p.x));
      p.y = Math.max(60, Math.min(height - 60, p.y));
    }
    temp = Math.max(0.5, temp - cooling);
  }
  // 归一化到 (80, 80) 起点，保持与其它布局一致的留白
  let minX = Infinity, minY = Infinity;
  for (const id of ids) { minX = Math.min(minX, pos.get(id).x); minY = Math.min(minY, pos.get(id).y); }
  for (const id of ids) {
    const p = pos.get(id);
    positions.set(id, { x: Math.round(p.x - minX + 80), y: Math.round(p.y - minY + 80) });
  }
  return positions;
}

/* ================= 紧凑网格布局（按类型分组排布，便于快速扫读） ================= */
export function gridLayout(nodes, { cols = 6, nodeW = 200, nodeH = 96, gapX = 40, gapY = 34 } = {}) {
  const positions = new Map();
  if (!nodes.length) return positions;
  // 按类型聚在一起（同类型相邻，便于对比）
  const ordered = [...nodes].sort((a, b) => String(a.type).localeCompare(String(b.type)) || String(a.id).localeCompare(String(b.id)));
  ordered.forEach((n, i) => {
    positions.set(n.id, {
      x: 80 + (i % cols) * (nodeW + gapX),
      y: 80 + Math.floor(i / cols) * (nodeH + gapY),
    });
  });
  return positions;
}

/** 分层 + 层内折行打包。
 *  背景：layeredLayout 在 TD 下用「层内序号」当 x，孤立节点全在第 0 层 → 会被排成一条
 *  两万像素的长线，fitView 无法一屏容纳。这里按 LR 取层（x 编码层号），再把每层折行成块。 */
export function packedLayeredLayout(nodes, edges, { nodeW = 236, nodeH = 92, gapX = 120, gapY = 30, rowsPerColumn = 9, maxCols = 5 } = {}){
  const layerStep = nodeW + gapX;
  const base = layeredLayout(nodes, edges, { direction: "LR", nodeW, nodeH, gapX, gapY });
  const groups = new Map();
  for (const n of nodes){
    const p = base.get(n.id) ?? { x: 80, y: 90 };
    // x 编码层号：x = 80 + layer * layerStep
    const layer = Math.max(0, Math.round((p.x - 80) / layerStep));
    if (!groups.has(layer)) groups.set(layer, []);
    groups.get(layer).push({ id: n.id, idx: Math.round((p.y - 90) / (nodeH + gapY)), w: n.w ?? nodeW, h: n.h ?? nodeH });
  }
  const layers = [...groups.entries()].sort((a, b)=> a[0] - b[0]);
  const out = new Map();
  let cursorX = 60;
  for (const [, members] of layers){
    members.sort((a, b)=> a.idx - b.idx);
    const perCol = Math.max(1, rowsPerColumn);
    const cols = Math.min(maxCols, Math.max(1, Math.ceil(members.length / perCol)));
    const perThisCol = Math.ceil(members.length / cols);
    const colW = Math.max(...members.map((m)=> m.w)) + gapX * 0.5;
    const rowH = Math.max(...members.map((m)=> m.h)) + gapY;
    members.forEach((m, i)=>{
      const col = Math.floor(i / perThisCol), row = i % perThisCol;
      out.set(m.id, { x: Math.round(cursorX + col * colW), y: Math.round(60 + row * rowH) });
    });
    cursorX += cols * colW + gapX;
  }
  return out;
}
