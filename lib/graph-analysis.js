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
  const nodes = graph.nodes ?? [], edges = graph.edges ?? [];
  switch (String(mode ?? "layered")){
    case "clusters": return resolveOverlaps(nodes, clusterLayout(graph));
    case "force": return resolveOverlaps(nodes, forceLayout(nodes, edges));
    case "grid": return resolveOverlaps(nodes, gridLayout(nodes));
    // layered 默认走打包布局（packedLayeredLayout 在 layeredLayout 之上折行打包），
    // 避免深链/浅宽图被排成上万像素的长条带；direction 跟随图自身设置。
    default: return resolveOverlaps(nodes, packedLayeredLayout(nodes, edges, { direction: graph.direction ?? "TD" }));
  }
}

/**
 * 重叠消解后处理：任何一对节点在两轴上都重叠 >4px 时，沿重叠较小的轴做最小平移推开
 * （各承担一半位移）。整扫一遍 O(n²)；若一遍后仍有重叠则再来（有上限），全部干净即停。
 * 对本就无重叠的布局（如打包分层）是无操作。确定性：按节点顺序成对处理。
 *
 * 兜底保证：极密集的堆叠（如大图 force 输出）下，最小平移会来回震荡无法收敛；
 * 若扫掠后仍有重叠，把仍陷在重叠里的节点逐个放进「离原位置最近的空闲格」
 * （格边长 ≥ 最大节点足迹 + 间距，空闲 = 不与任何未动节点的脚印相交），
 * 由构造保证清零重叠。已收敛的布局不会走到这一步，输出不受影响。
 */
export function resolveOverlaps(nodes, positions, { minGap = 4, maxSweeps = 12 } = {}){
  if (!positions || positions.size < 2) return positions;
  const items = [];
  for (const node of nodes){
    const p = positions.get(node.id);
    if (!p) continue;
    items.push({ id: node.id, x: p.x, y: p.y, w: node.w ?? 168, h: node.h ?? 64 });
  }
  const pairOverlap = (a, b) => {
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return (ox > minGap && oy > minGap) ? Math.min(ox, oy) : 0;
  };
  for (let sweep = 0; sweep < maxSweeps; sweep++){
    let moved = false;
    for (let i = 0; i < items.length; i++){
      const a = items[i];
      for (let j = i + 1; j < items.length; j++){
        const b = items[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox <= minGap || oy <= minGap) continue;
        moved = true;
        if (ox <= oy){
          const push = (ox - minGap) / 2 + 0.5;   // 多推 0.5px，抵消最后取整可能带回的 1px
          if (a.x <= b.x){ a.x -= push; b.x += push; } else { a.x += push; b.x -= push; }
        } else {
          const push = (oy - minGap) / 2 + 0.5;
          if (a.y <= b.y){ a.y -= push; b.y += push; } else { a.y += push; b.y -= push; }
        }
      }
    }
    if (!moved) break;
  }
  // 兜底：扫掠后仍有重叠 → 疏散 offender（确定性、由构造保证无重叠）
  const offenders = new Set();
  for (let i = 0; i < items.length; i++){
    for (let j = i + 1; j < items.length; j++){
      if (pairOverlap(items[i], items[j])){ offenders.add(i); offenders.add(j); }
    }
  }
  if (offenders.size){
    const cellW = Math.max(...items.map((it)=> it.w)) + minGap * 2;
    const cellH = Math.max(...items.map((it)=> it.h)) + minGap * 2;
    const blocked = new Set();   // 与任何未疏散节点脚印相交的格都不可用
    for (let i = 0; i < items.length; i++){
      if (offenders.has(i)) continue;
      const it = items[i];
      for (let cx = Math.floor(it.x / cellW); cx * cellW < it.x + it.w; cx++)
        for (let cy = Math.floor(it.y / cellH); cy * cellH < it.y + it.h; cy++)
          blocked.add(`${cx},${cy}`);
    }
    const order = [...offenders].sort((a, b)=> (items[a].y - items[b].y) || (items[a].x - items[b].x));
    for (const idx of order){
      const it = items[idx];
      const hx = Math.round(it.x / cellW), hy = Math.round(it.y / cellH);
      let slot = null;
      for (let r = 0; r < 256 && !slot; r++){
        for (let dy = -r; dy <= r && !slot; dy++){
          for (let dx = -r; dx <= r && !slot; dx++){
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const key = `${hx + dx},${hy + dy}`;
            if (!blocked.has(key)){ slot = { x: hx + dx, y: hy + dy, key }; blocked.add(key); }
          }
        }
      }
      if (!slot){   // 理论上到不了：格网无限，唯一上限是搜索半径
        slot = { x: hx, y: hy + order.length, key: `${hx},${hy + order.length}` };
        blocked.add(slot.key);
      }
      it.x = slot.x * cellW + minGap;
      it.y = slot.y * cellH + minGap;
    }
  }
  for (const it of items) positions.set(it.id, { x: Math.round(it.x), y: Math.round(it.y) });
  return positions;
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

/** 分层 + 层内折行打包（默认布局引擎）。
 *  背景：layeredLayout 在 TD 下用「层内序号」当 x，孤立节点全在第 0 层 → 会被排成一条
 *  两万像素的长线，fitView 无法一屏容纳。这里取层后把每层折行打包成块：
 *    - LR：层从左往右流；块内成员按列填充（列宽封顶 maxCols）。
 *    - TD：层从上往下流；块内成员按行填充（行高封顶 maxCols）。
 *  长轴累计超过由总面积推导的阈值时折带/折列，保证任何形状的图都不会拉成 >6:1 的长条。
 *  rowsPerColumn 缺省时按节点数自适应 clamp(ceil(√n), 4, 12)；导入路径显式传参则维持原行为。 */
export function packedLayeredLayout(nodes, edges, { nodeW = 236, nodeH = 92, gapX = 120, gapY = 30, rowsPerColumn, maxCols = 5, direction = "LR" } = {}){
  const out = new Map();
  if (!nodes.length) return out;
  const dir = String(direction ?? "LR").toUpperCase() === "TD" ? "TD" : "LR";
  const rows = rowsPerColumn ?? Math.min(12, Math.max(4, Math.ceil(Math.sqrt(Math.max(1, nodes.length)))));
  const layerStepX = nodeW + gapX, layerStepY = nodeH + gapY;
  // 底层分层仍由 layeredLayout 承担：LR 时 x 编码层号、y 编码层内序号；TD 相反。
  const base = layeredLayout(nodes, edges, { direction: dir, nodeW, nodeH, gapX, gapY });
  const groups = new Map();
  for (const n of nodes){
    const p = base.get(n.id) ?? { x: 80, y: 90 };
    const layer = dir === "LR"
      ? Math.max(0, Math.round((p.x - 80) / layerStepX))
      : Math.max(0, Math.round((p.y - 90) / layerStepY));
    const idx = dir === "LR"
      ? Math.round((p.y - 90) / layerStepY)
      : Math.round((p.x - 80) / layerStepX);
    if (!groups.has(layer)) groups.set(layer, []);
    groups.get(layer).push({ id: n.id, idx, w: n.w ?? nodeW, h: n.h ?? nodeH });
  }
  const layers = [...groups.entries()].sort((a, b)=> a[0] - b[0]);
  const colW = (m)=> Math.max(...m.map((x)=> x.w)) + gapX * 0.5;
  const rowH = (m)=> Math.max(...m.map((x)=> x.h)) + gapY;
  const BLOCK_ASPECT = 4;   // 单块宽高比上限；超限时增长横轴维度（安全阀，防单层成员过多把块拉成长条）

  // 每层打包成块（块内局部坐标），并估算总面积 → 长轴折带阈值
  const blocks = layers.map(([, members])=>{
    members.sort((a, b)=> a.idx - b.idx);
    const m = members.length;
    const cw = colW(members), rh = rowH(members);
    const place = (blockCols, blockRows)=>{
      // LR 列优先（保持既有行为）；TD 行优先（自上而下阅读序）
      members.forEach((mem, i)=>{
        const col = dir === "LR" ? Math.floor(i / blockRows) : i % blockCols;
        const row = dir === "LR" ? i % blockRows : Math.floor(i / blockCols);
        mem.col = col; mem.row = row;
      });
      return { cw, rh, w: blockCols * cw, h: blockRows * rh };
    };
    if (dir === "LR"){
      const cols0 = Math.max(1, Math.min(maxCols, Math.ceil(m / rows)));
      const cols = (Math.ceil(m / cols0) * rh > BLOCK_ASPECT * cols0 * cw)
        ? Math.max(cols0, Math.ceil(Math.sqrt(m * rh / (BLOCK_ASPECT * cw))))
        : cols0;
      return { members, ...place(cols, Math.ceil(m / cols)) };
    }
    const rws = Math.max(1, Math.min(maxCols, Math.ceil(m / rows)));
    let per = Math.ceil(m / rws);
    if (per * cw > BLOCK_ASPECT * rws * rh){
      const grown = Math.max(rws, Math.ceil(Math.sqrt(m * cw / (BLOCK_ASPECT * rh))));
      return { members, ...place(Math.ceil(m / grown), grown) };
    }
    return { members, ...place(per, rws) };
  });
  let area = 0;
  for (const b of blocks) area += (b.w + gapX) * (b.h + gapY);
  const target = Math.max(1400, Math.sqrt(area) * 1.15);

  if (dir === "LR"){
    let cursorX = 60, cursorY = 60, bandMaxH = 0;
    for (const b of blocks){
      if (cursorX > 60 && cursorX + b.w > 60 + target){ cursorY += bandMaxH + gapY; cursorX = 60; bandMaxH = 0; }
      for (const mem of b.members) out.set(mem.id, { x: Math.round(cursorX + mem.col * b.cw), y: Math.round(cursorY + mem.row * b.rh) });
      cursorX += b.w + gapX;
      bandMaxH = Math.max(bandMaxH, b.h);
    }
  } else {
    let cursorX = 60, cursorY = 60, colMaxW = 0;
    for (const b of blocks){
      if (cursorY > 60 && cursorY + b.h > 60 + target){ cursorX += colMaxW + gapX; cursorY = 60; colMaxW = 0; }
      for (const mem of b.members) out.set(mem.id, { x: Math.round(cursorX + mem.col * b.cw), y: Math.round(cursorY + mem.row * b.rh) });
      cursorY += b.h + gapY;
      colMaxW = Math.max(colMaxW, b.w);
    }
  }
  return out;
}
