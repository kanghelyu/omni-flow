// OmniFlow Studio client.
// Split out of index.html so the markup stays readable and both files stay diff-able.
// Served by studio/server.mjs at /app.js (read per request, so edits need no restart).
"use strict";
/* ================= i18n ================= */
const I18N = {
  zh: { tipNew:"新建一张图（可选模板）", tipImport:"导入 Mermaid / JSON 文件", tipExport:"导出为 Mermaid、Markdown 或单文件网页", tipAnalyze:"看环、瓶颈、孤立点与依赖链", tipLayout:"一键排布：分层 / 聚簇 / 力导向 / 网格", tipTheme:"切换浅色 / 深色", tipLang:"切换中文 / English", tipDocrail:"收起或展开左侧文件树", gstatTip:"点击查看校验详情（结构问题与警告）", legendNodeTypes:"节点类型", legendEdgeTypes:"连线类型", attachPickNode:"请先选中一张卡片，再添加附件", expandTree:"展开文件树", expandInspector:"展开检查器", depToggle:"🔗 高亮依赖", depToggleTip:"选中卡片后：蓝色=它的上游依据，红色=它的下游结果；再点一次关闭", depOnMsg:"已开启依赖高亮", depOffMsg:"已关闭依赖高亮", depUpLegend:"上游（支撑它）", depDownLegend:"下游（它支撑）", depSelfLegend:"当前节点", depHide:"隐藏", fxHelp:"? 公式规则", fxHelpTip:"公式怎么写才能正常显示（编译不出来时看这里）", readerTip:"阅读模式：按章节列出卡片，可折叠、可跳转依赖", splitterTip:"拖动调节上下两块的高度", appTitle:"OmniFlow Studio — 万用流程图", convoSetHeadTip:"把选中的卡片设为当前位置，之后的新内容从这里接下去", convoMergeTip:"把几条线合并到一个结论", convoThreadsTip:"列出还没走完的分支", convoNextTip:"下一步该谁接着写，以及该带上哪些上下文", convoPendingTip:"还没完成的分支（进行中 / 等人）", convoLinearTip:"把从开头到当前位置的对话导出成文本", turnSpeaker:"发言人", turnSpeakerPh:"如：我 / 张三 / 评审", turnContent:"内容", turnContentPh:"粘进来即可（支持 $公式$）", turnRecord:"记录", turnForkTitle:"从此外推一轮（分叉）", turnInsertTitle:"在此后插入一轮", turnContentLong:"内容（首行进卡片，全文可写备注）", turnContentLongPh:"把这一轮的内容粘进来（支持 $公式$）", turnStatus:"状态", turnType:"类型", turnParent:"接在哪之后", turnParentPh:"留空 = 当前位置", turnHandoff:"移交给谁（可选）", turnHandoffPh:"如：人 / 张三", stDone:"已完成", stRunning:"进行中", stPending:"待产出", stWaiting:"等人工", stFailed:"失败", tyTurn:"发言", tyQuestion:"提问", tyAnswer:"回答", tyIdea:"想法", tyDecision:"结论", xlinkBadgeProvides:"本卡支撑了其他图的 {n} 个结论（点击前往）", xlinkBadgeUses:"本卡依赖其他图的 {n} 个结论（点击前往）", xlinkDelTitle:"删除此链接", xlinkWhyLabel:"为什么相关（数学理由，写清依据）", sectionLabel:"小节", cardsCount:"{n} 张", edgeDeps:"依赖", edgeUses:"被用于", readerPage:"第 {n} 页", reader:"阅读模式", readerOpen:"📖 阅读", readerExpandAll:"全部展开", readerCollapseAll:"全部折叠", readerClose:"关闭 (Esc)", readerSearch:"搜索卡片…", readerNoGraph:"没有打开的图", readerNoMatch:"没有匹配的卡片", readerDeps:"依赖", readerUses:"被用于", pageN:"第 {n} 页", note:"详情（只读 · 渲染公式）", noteCopy:"复制详情原文", attachAdd:"＋ 附件", attachAddTip:"添加附件：选择图片或 PDF（也可直接拖到附件区）", attachNoAttach:"（无附件）", attachAdding:"正在添加 {n} 个附件…", attachAdded:"附件已添加（点击缩略图可放大）", attachFailed:"{name} 添加失败：{msg}", xlinkSection:"跨图依赖（{n}）", xlinkAdd:"＋ 添加", xlinkDirUses:"依赖对方", xlinkDirProvides:"对方依赖我", xlinkBroken:"目标节点已不存在", xlinkNone:"尚未与其他图建立依赖。点「＋ 添加」可跨图关联。", xlinkBrokenHint:"目标已不存在，可点 ✕ 删除该链接", xlinkDialogTitle:"链接到其他图", xlinkSource:"源节点", xlinkTargetGraph:"目标图", xlinkSearchNode:"搜索目标节点", xlinkFilterPh:"输入标题关键字过滤…", xlinkWhy:"为什么相关（数学理由，写清依据）", xlinkWhyPh:"例：本卡给出可操作判据 f 与 f′ 互素，正好补上对方缺的判别步骤", xlinkDirection:"方向", xlinkDirTo:"我依赖对方（对方是依据）", xlinkDirFrom:"对方依赖我（我提供依据）", xlinkCreate:"建立链接", xlinkCreated:"已建立跨图链接", xlinkRemoved:"已删除链接", xlinkPickNode:"请先选择一个目标节点", xlinkNeedWhy:"请写明理由（这是跨图依赖最关键的信息）", xlinkNoMatch:"该图没有匹配的节点", cancel:"取消", depUpstream:"上游（谁支撑它）", depDownstream:"下游（它支撑谁）", depMore:"+{n} 展开", depLess:"收起", depNone:"— 无", multiHint:"已选中 {n} 个节点 · 右键可合并 / Delete 删除 / Esc 取消", selNodes:"已选中 {n} 个节点", selNone:"未选中节点", deletedNodes:"已删除 {n} 个节点", groupPinned:"已固定分组位置", groupRefit:"已取消固定，按内容自动贴合", groupPinNow:"已固定当前几何", groupFocus:"聚焦到该组", linkCanceled:"未落到节点上，已取消", undoEmpty:"没有可撤销的操作", undoDone:"已撤销", redoEmpty:"没有可重做的操作", redoDone:"已重做", opFailed:"操作失败：{msg}", blockedWipe:"已阻止一次会清空内容的操作", snapCorrupt:"快照损坏，已忽略", canvasMode:"⚡ 画布模式", canvasModeTip:"大图用画布绘制，平移缩放更流畅；关闭回到卡片样式", thumbsToggle:"🖼 缩略图", thumbsToggleTip:"在卡片上显示原书页面缩略图（只有导入 PDF 的图才有）", noteFull:"详情全文", traceBtn:"依赖追踪", makeGroupBtn:"从选中建组", convoTitle:"对话", convoSay:"＋ 记录一轮发言", convoHead:"当前位置", convoSetHead:"从这里继续", convoMerge:"合并分支", convoThreads:"开放分支", convoNext:"下一步", convoPending:"未完成", convoLinear:"导出这段对话", latexUnsupported:"网页不支持该环境，此处省略", latexUnparsed:"KaTeX 无法解析该片段", latexKept:"⚠ LaTeX 未渲染（原文保留）", unsectioned:"（未分节）", newGraph:"＋ 新建", templates:"模板", import:"📥 导入", share:"📤 分享", export:"📤 导出", validate:"✓ 校验", analyze:"◎ 分析", layout:"⌗ 一键整理", legend:"☰ 图例", fit:"适应", deleteGraph:"删除图", folderOpt:"文件夹（可选，a/b 可嵌套）",
    vaultTitle:"文件树", docTitle:"当前图节点", nodesWord:"节点", newFolder:"新建文件夹", rootName:"根目录（未归档）",
    globalSearchPh:"搜索图 / 节点 / 备注…（⌘K）", treeSearchPh:"搜索标题…", collapseInspector:"收起/展开检查器", groupsTitle:"分组",
    searchNodes:"搜索名称/备注/标签…", inspector:"检查器",
    folderNamePrompt:"文件夹名称：", renameFolderPrompt:"新的文件夹路径：", moveToPrompt:"移动到文件夹（留空 = 根目录）：", confirmFolderDelete:"删除该文件夹？其中的图会上移到父目录。",
    hintEmpty:"选中节点或连线后在此编辑一切：文字、类型、颜色（填充/边框/文字）、图标、状态；连线可改标签、颜色、线型、箭头。",
    hintKeys:"拖拽画布平移 · ⌘/Ctrl+滚轮缩放 · 滚轮平移 · 从节点右侧圆点拖出连线 · Delete 删除选中",
    nodeProps:"节点属性", edgeProps:"连线属性", graphProps:"图属性", label:"文字", type:"类型", icon:"图标",
    fill:"填充色", border:"边框色", textColor:"文字色", save:"保存", noteMd:"备注全文", trace:"依赖追踪", makeGroup:"从选中建组", delete:"删除",
    saveFailed:"保存失败", pickNodeType:"选择类型", catNode:"□ 新建流程框 ▾", handleT:"入点", handleS:"拖到目标框连线",
    edgeLabel:"标签（箭头命名）", color:"颜色", width:"粗细", style:"线型", arrow:"箭头", flip:"反转方向",
    name:"名称", desc:"描述", direction:"方向", addNode:"新建",
    addHint:"从节点右侧圆点拖到目标框连线；Delete 删除选中；双击箭头改标签",
    universal:"万用流程图", noGraph:"先选择或创建一张图", edgeAdded:"箭头已连接，双击箭头可改标签", nodeAdded:"节点已添加",
    layoutDone:"已自动布局", saved:"已保存", confirmDeleteGraph:"删除这张图（移入 trash，可恢复）？",
    menuContinue:"▶ 从这里继续（设为点头）", menuBranch:"⑂ 从此外推一轮（分叉）", menuMerge:"⋈ 合并选中的分支", menuMarkStatus:"标记状态",
    menuAttach:"📎 加附件（页面图 / PDF）", menuXlink:"🔗 跨图依赖…", menuRename:"✎ 改标题", menuInsertTurn:"＋ 在此后插入一轮", menuTrace:"◎ 依赖追踪", menuDeleteNode:"✕ 删除节点",
    statusUpdated:"状态已更新", headSet:"已设为当前点头", needBranches:"至少需要 2 条分支", mergeLabel:"汇合", mergedDone:"已汇合", renamePrompt:"新标题",
    turnContentEmpty:"内容不能为空", turnForked:"已分叉出一支", turnInserted:"已插入一轮",
    convoRole:"角色", convoTurnN:"轮次", convoIsHead:"● 当前点头", convoMain:"主线", convoOff:"离支",
    actContinue:"▶ 从这里继续", actBranch:"⑂ 分叉一轮", actMerge:"⋈ 合并", actDone:"✓ 标完成", actAttach:"📎 附件", actLocate:"⊙ 定位", markedDone:"已标完成",
    convoStats:"主线 {a} · 开放 {b} · 待办 {c}", convoHeadLabel:"当前点头", pickNodeFirst:"请先选中一个节点",
    convoThreadsN:"开放分支 ({n})", convoPendingN:"待办分支 ({n})",
    convoNextHead:"下一步该谁产出", convoReason:"理由", convoTopology:"拓扑", convoAwaiting:"待办", convoCtx:"— 应发送的上下文 —",
    formulaPlaceholder:"⟨公式⟩", groupRefitMenu:"⤢ 重新贴合内容", groupPinMenu:"📌 记住当前几何", noteEmpty:"（无备注）", noteCopied:"已复制备注原文" },
  en: { tipNew:"Create a new map (pick a template)", tipImport:"Import a Mermaid or JSON file", tipExport:"Export as Mermaid, Markdown or a single-file page", tipAnalyze:"Cycles, bottlenecks, isolated cards and dependency chains", tipLayout:"Arrange: layered / clusters / force / grid", tipTheme:"Switch light / dark", tipLang:"Switch 中文 / English", tipDocrail:"Collapse or expand the file tree", gstatTip:"Click for validation details (structural problems and warnings)", legendNodeTypes:"Card types", legendEdgeTypes:"Link types", attachPickNode:"Select a card first, then attach a file", thumbsToggle:"🖼 Thumbs", thumbsToggleTip:"Show source-page thumbnails on cards (only for maps imported from a PDF)", expandTree:"Show the file tree", expandInspector:"Show the inspector", depToggle:"🔗 Highlight deps", depToggleTip:"With a card selected: blue = what it depends on, red = what depends on it; click again to turn off", depOnMsg:"Dependency highlighting on", depOffMsg:"Dependency highlighting off", depUpLegend:"upstream (supports it)", depDownLegend:"downstream (it supports)", depSelfLegend:"selected node", depHide:"Hide", fxHelp:"? Formula rules", fxHelpTip:"How to write formulas that render (read this when one fails to compile)", readerTip:"Reading mode: cards grouped by section, collapsible, with dependency jumps", splitterTip:"Drag to resize the two panels", appTitle:"OmniFlow Studio — universal flow maps", convoSetHeadTip:"Make the selected card the current position; new content continues from there", convoMergeTip:"Merge several threads into one conclusion", convoThreadsTip:"List the threads that are still open", convoNextTip:"Who should write next, and what context to send with it", convoPendingTip:"Threads not finished yet (in progress / waiting)", convoLinearTip:"Export the conversation up to here as text", turnSpeaker:"Speaker", turnSpeakerPh:"e.g. me / Alice / reviewer", turnContent:"Content", turnContentPh:"Paste anything (supports $math$)", turnRecord:"Record", turnForkTitle:"Branch out from here", turnInsertTitle:"Insert a turn after this", turnContentLong:"Content (first line becomes the card, the rest becomes the note)", turnContentLongPh:"Paste this turn (supports $math$)", turnStatus:"Status", turnType:"Type", turnParent:"Continue after", turnParentPh:"blank = current position", turnHandoff:"Hand over to (optional)", turnHandoffPh:"e.g. human / Bob", stDone:"done", stRunning:"in progress", stPending:"to do", stWaiting:"waiting for a human", stFailed:"failed", tyTurn:"statement", tyQuestion:"question", tyAnswer:"answer", tyIdea:"idea", tyDecision:"conclusion", xlinkBadgeProvides:"This card supports {n} conclusion(s) in other maps (click to go)", xlinkBadgeUses:"This card depends on {n} conclusion(s) in other maps (click to go)", xlinkDelTitle:"Remove this link", xlinkWhyLabel:"Why related (state the mathematical reason)", sectionLabel:"Section", cardsCount:"{n} cards", edgeDeps:"Depends on", edgeUses:"Used by", readerPage:"p. {n}", reader:"Reader", readerOpen:"📖 Read", readerExpandAll:"Expand all", readerCollapseAll:"Collapse all", readerClose:"Close (Esc)", readerSearch:"Search cards…", readerNoGraph:"No graph open", readerNoMatch:"No matching cards", readerDeps:"Depends on", readerUses:"Used by", pageN:"p. {n}", note:"Details (read-only · formulas rendered)", noteCopy:"Copy raw text", attachAdd:"＋ Attach", attachAddTip:"Add attachment: pick images/PDF (or drop into the box)", attachNoAttach:"(no attachments)", attachAdding:"Adding {n} attachment(s)…", attachAdded:"Added (click a thumbnail to zoom)", attachFailed:"Failed to add {name}: {msg}", xlinkSection:"Cross-graph links ({n})", xlinkAdd:"＋ Add", xlinkDirUses:"depends on", xlinkDirProvides:"is used by", xlinkBroken:"Target node no longer exists", xlinkNone:"No cross-graph links yet. Click “＋ Add” to relate nodes across maps.", xlinkBrokenHint:"Target is gone — click ✕ to remove this link", xlinkDialogTitle:"Link to another map", xlinkSource:"Source node", xlinkTargetGraph:"Target map", xlinkSearchNode:"Search target node", xlinkFilterPh:"Filter by title…", xlinkWhy:"Why related (state the mathematical reason)", xlinkWhyPh:"e.g. this card gives the operational criterion (f coprime to f′), filling the missing step", xlinkDirection:"Direction", xlinkDirTo:"I depend on it (it is the basis)", xlinkDirFrom:"It depends on me (I am the basis)", xlinkCreate:"Create link", xlinkCreated:"Cross-graph link created", xlinkRemoved:"Link removed", xlinkPickNode:"Pick a target node first", xlinkNeedWhy:"Please state the reason (the key part of a cross-graph link)", xlinkNoMatch:"No matching nodes in that map", cancel:"Cancel", depUpstream:"Upstream (what supports it)", depDownstream:"Downstream (what it supports)", depMore:"+{n} more", depLess:"Collapse", depNone:"— none", multiHint:"{n} nodes selected · right-click to merge / Delete to remove / Esc to cancel", selNodes:"{n} nodes selected", selNone:"No node selected", deletedNodes:"Deleted {n} node(s)", groupPinned:"Group position pinned", groupRefit:"Unpinned — snapping back to content", groupPinNow:"Current geometry pinned", groupFocus:"Focus this group", linkCanceled:"Dropped on empty space — cancelled", undoEmpty:"Nothing to undo", undoDone:"Undone", redoEmpty:"Nothing to redo", redoDone:"Redone", opFailed:"Failed: {msg}", blockedWipe:"Blocked an operation that would have erased content", snapCorrupt:"Snapshot corrupted — ignored", canvasMode:"⚡ Canvas", canvasModeTip:"Draw big maps on a canvas for smoother panning; turn off to go back to cards", noteFull:"Full details", traceBtn:"Trace", makeGroupBtn:"Group selection", convoTitle:"Conversation", convoSay:"＋ Record a turn", convoHead:"Current position", convoSetHead:"Continue from here", convoMerge:"Merge branches", convoThreads:"Open threads", convoNext:"Next step", convoPending:"Unfinished", convoLinear:"Export this thread", latexUnsupported:"not supported in the browser — omitted", latexUnparsed:"KaTeX could not parse this fragment", latexKept:"⚠ LaTeX not rendered (source kept)", unsectioned:"(no section)", newGraph:"＋ New", templates:"Templates", import:"📥 Import", share:"📤 Share", export:"📤 Export", validate:"✓ Validate", analyze:"◎ Analyze", layout:"⌗ Tidy up", legend:"☰ Legend", fit:"Fit", deleteGraph:"Delete graph", folderOpt:"Folder (optional, a/b nests)",
    vaultTitle:"Files", docTitle:"Nodes", nodesWord:"NODES", newFolder:"New folder", rootName:"Root (unfiled)",
    globalSearchPh:"Search graphs / nodes / notes… (⌘K)", treeSearchPh:"Search titles…", collapseInspector:"Collapse / expand inspector", groupsTitle:"Groups",
    searchNodes:"Search label / note / tag…", inspector:"Inspector",
    folderNamePrompt:"Folder name:", renameFolderPrompt:"New folder path:", moveToPrompt:"Move to folder (empty = root):", confirmFolderDelete:"Delete this folder? Its graphs move up to the parent folder.",
    hintEmpty:"Select a node or edge to edit everything: text, type, colors (fill/border/text), icon, status; edges support label, color, style and arrows.",
    hintKeys:"Drag canvas to pan · ⌘/Ctrl+wheel zoom · wheel pan · drag the right dot to connect · Delete removes",
    nodeProps:"Node", edgeProps:"Edge", graphProps:"Graph", label:"Label", type:"Type", icon:"Icon",
    fill:"Fill", border:"Border", textColor:"Text", save:"Save", noteMd:"Full note", trace:"Trace deps", makeGroup:"Group selection", delete:"Delete",
    saveFailed:"Save failed", pickNodeType:"Pick a type", catNode:"□ New node ▾", handleT:"Target", handleS:"Drag to a node to connect",
    edgeLabel:"Label (name your arrow)", color:"Color", width:"Width", style:"Style", arrow:"Arrow", flip:"Flip",
    name:"Name", desc:"Description", direction:"Direction", addNode:"New",
    addHint:"Drag from a node's right dot onto a target to connect; Delete removes; double-click an edge to rename",
    universal:"Universal flow maps", noGraph:"Select or create a graph first", edgeAdded:"Connected — double-click the edge to rename it", nodeAdded:"Node added",
    layoutDone:"Layout applied", saved:"Saved", confirmDeleteGraph:"Delete this graph (archived to trash)?",
    menuContinue:"▶ Continue from here (set as head)", menuBranch:"⑂ Branch out a turn (fork)", menuMerge:"⋈ Merge selected branches", menuMarkStatus:"Mark status",
    menuAttach:"📎 Attach (page image / PDF)", menuXlink:"🔗 Cross-graph link…", menuRename:"✎ Rename", menuInsertTurn:"＋ Insert a turn after this", menuTrace:"◎ Trace deps", menuDeleteNode:"✕ Delete node",
    statusUpdated:"Status updated", headSet:"Head moved", needBranches:"Need 2+ branches", mergeLabel:"Merge", mergedDone:"Merged", renamePrompt:"New title",
    turnContentEmpty:"Content cannot be empty", turnForked:"Turn branched out", turnInserted:"Turn inserted",
    convoRole:"Role", convoTurnN:"Turn", convoIsHead:"● current head", convoMain:"Main line", convoOff:"Off thread",
    actContinue:"▶ Continue here", actBranch:"⑂ Fork a turn", actMerge:"⋈ Merge", actDone:"✓ Mark done", actAttach:"📎 Attach", actLocate:"⊙ Locate", markedDone:"Marked done",
    convoStats:"Main {a} · open {b} · pending {c}", convoHeadLabel:"Current head", pickNodeFirst:"Select a node first",
    convoThreadsN:"Open threads ({n})", convoPendingN:"Pending ({n})",
    convoNextHead:"Who should produce next", convoReason:"Reason", convoTopology:"Topology", convoAwaiting:"Awaiting", convoCtx:"— Context to send —",
    formulaPlaceholder:"⟨formula⟩", groupRefitMenu:"⤢ Refit to content", groupPinMenu:"📌 Pin current geometry", noteEmpty:"(no note)", noteCopied:"Note copied" },
};
let LANG = localStorage.getItem("of-lang") || "zh";
function t(key){ return (I18N[LANG] ?? I18N.zh)[key] ?? I18N.zh[key] ?? key; }
function applyLang(){
  document.documentElement.lang = LANG === "en" ? "en" : "zh-CN";   // CSS html[lang] 切换 + a11y
  document.querySelectorAll("[data-i18n]").forEach((el)=>{ el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-ph]").forEach((el)=>{ el.placeholder = t(el.dataset.ph); });
  document.querySelectorAll("[data-i18n-title]").forEach((el)=>{ el.title = t(el.dataset.i18nTitle); });
  document.getElementById("btnLang").textContent = LANG === "zh" ? "EN" : "中";
  document.getElementById("ui-tag").textContent = t("universal");
  document.title = t("appTitle");
  localStorage.setItem("of-lang", LANG);
  if (typeof buildTypeSelects === "function") buildTypeSelects();
  if (typeof localizeStaticSelects === "function") localizeStaticSelects();
  if (typeof render === "function") render();
  const noteEl = $("n-note");   // 语言切换会重排 inspector：备注框高度必须跟着内容重算
  if (noteEl) autoGrow(noteEl);
}

/* ================= state ================= */
let graphs = [], templates = [];
let current = null;
let selected = null;         // {kind:'node'|'edge', id}
let selGroupId = null;       // 选中的分组 id（与节点/边选择互斥；选组 = 高亮框 + 组列表定位）
let liveDrag = null;         // {id} 正在拖拽的节点
let pendingLink = null;      // {sourceId, end, hover} 正在拉线
let highlightMembers = [];   // 组列表点击后持续高亮的成员
let tree = { folders: [], assign: {} };   // Obsidian 式文件夹树
let expandedFolders = new Set([""]);
const $ = (id) => document.getElementById(id);
const edgeLayer = $("edgeLayer"), nodesLayer = $("nodesLayer"), groupsLayer = $("groupsLayer");
let edgeIndex = new Map();   // nodeId → Set(edge-group)：拖拽时只更新相邻边（O(k)），不遍历全量
/* O(1) 查找索引：每次 current 变更时重建，取代 Array.find 的 O(n) 线性扫描 */
let nodeIndex = new Map(), edgeIndexById = new Map();
function rebuildIndexes(){
  nodeIndex = new Map((current?.nodes ?? []).map((n)=>[n.id, n]));
  edgeIndexById = new Map((current?.edges ?? []).map((e)=>[e.id, e]));
}
const canvas = $("canvasWrap");

function toast(msg, isErr){
  const el = $("toast");
  el.textContent = msg;
  el.className = "show" + (isErr ? " err" : "");
  setTimeout(()=>{ el.className = ""; }, isErr ? 4200 : 2400);
}
async function api(path, opts){
  // 自愈：HTTP/1.1 对同 host 有 6 连接上限，SSE 占满时 fetch 会排队；
  // 超时(8s)自动重试 ×3，连接槽一空即成功，boot 不再卡死。
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++){
    const ctrl = new AbortController();
    const timer = setTimeout(()=>ctrl.abort(), 8000);
    try {
      const res = await fetch(path, { headers: { "content-type": "application/json" }, signal: ctrl.signal, ...opts });
      clearTimeout(timer);
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (e){
      clearTimeout(timer);
      lastErr = e;
      if (opts?.signal) throw e;
      if (e?.name === "AbortError"){ await new Promise((r)=>setTimeout(r, 800 * (attempt + 1))); continue; }
      throw e;
    }
  }
  throw lastErr;
}
function escapeHtml(text){
  return String(text ?? "").replace(/[&<>"']/g, (ch)=>({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
}

/* ================= theme / lang ================= */
$("btnTheme").onclick = () => {
  document.body.classList.toggle("light");
  localStorage.setItem("of-theme", document.body.classList.contains("light") ? "light" : "dark");
};
// 主题：显式选择优先；未选过则跟随系统（浅色系统默认浅色）
(function initTheme(){
  const saved = localStorage.getItem("of-theme");
  const wantLight = saved ? saved === "light" : !window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.body.classList.toggle("light", wantLight);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = (e)=>{ if (!localStorage.getItem("of-theme")) document.body.classList.toggle("light", !e.matches); };
  mq.addEventListener ? mq.addEventListener("change", onChange) : mq.addListener(onChange);
})();
$("btnLang").onclick = async ()=>{
  LANG = LANG === "zh" ? "en" : "zh";
  applyLang();
  templates = await api("/api/templates?lang=" + LANG);   // 模板选择器文案随语言切换
};

/* ================= 相机（agent-flow 移植：rAF + 四次缓出） ================= */
let view = { x: 60, y: 40, k: 1 };
let viewAnimation = null;
function cancelViewAnimation(){
  if (viewAnimation){ cancelAnimationFrame(viewAnimation.frame); viewAnimation = null; }
}
function applyView(){
  // 只有大图才需要“拖动期降级”（隐藏边层/卡片文字）——小图直渲更快且无闪烁
  if ((current?.nodes?.length ?? 0) >= 150){ beginViewportMove(); endViewportMoveSoon(); }
  if (typeof CV !== "undefined" && CV.on){ if (typeof cvDraw === "function") cvDraw(); }
  beginInteract(); requestAnimationFrame(()=> endInteract());
  $("world").style.transform = `translate(${view.x}px,${view.y}px) scale(${view.k})`;
}
function animateView(target, duration = 0){
  cancelViewAnimation();
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const ms = reduceMotion ? 0 : Math.max(0, Number(duration) || 0);
  const next = { x: Number(target.x), y: Number(target.y), k: Number(target.k) };
  if (ms === 0){ view = next; applyView(); return; }
  const start = { ...view };
  const startedAt = performance.now();
  const active = { frame: 0 };
  viewAnimation = active;
  const tick = (now) => {
    if (viewAnimation !== active) return;
    const progress = Math.min(1, (now - startedAt) / ms);
    const eased = 1 - Math.pow(1 - progress, 4);
    view = { x: start.x + (next.x - start.x) * eased, y: start.y + (next.y - start.y) * eased, k: start.k + (next.k - start.k) * eased };
    applyView();
    if (progress < 1) active.frame = requestAnimationFrame(tick);
    else viewAnimation = null;
  };
  active.frame = requestAnimationFrame(tick);
}
function screenToWorld(cx, cy){
  const rect = canvas.getBoundingClientRect();
  return { x: (cx - rect.left - view.x) / view.k, y: (cy - rect.top - view.y) / view.k };
}
function focusNode(node, options = {}){
  const rect = canvas.getBoundingClientRect();
  const k = Math.min(1.15, Math.max(0.4, Number(options.k ?? Math.max(view.k, 0.96))));
  animateView({ k, x: rect.width / 2 - (node.x + node.w / 2) * k, y: rect.height / 2 - (node.y + node.h / 2) * k }, options.duration ?? 720);
}
function fitView(options = {}){
  if (!current || current.nodes.length === 0){ view = { x: 60, y: 40, k: 1 }; applyView(); return; }
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height){ requestAnimationFrame(()=>fitView(options)); return; }
  const minX = Math.min(...current.nodes.map((n)=>n.x));
  const minY = Math.min(...current.nodes.map((n)=>n.y));
  const maxX = Math.max(...current.nodes.map((n)=>n.x + n.w));
  const maxY = Math.max(...current.nodes.map((n)=>n.y + n.h));
  const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
  const paddingRatio = Number.isFinite(Number(options.padding)) ? Number(options.padding) : 0.16;
  const padding = Math.max(36, Math.min(rect.width, rect.height) * paddingRatio);
  const k = Math.min(1.15, Math.max(0.4, Math.min((rect.width - padding * 2) / w, (rect.height - padding * 2) / h)));
  animateView({ k, x: (rect.width - w * k) / 2 - minX * k, y: (rect.height - h * k) / 2 - minY * k }, options.duration ?? 0);
}
function zoomCenter(factor){
  cancelViewAnimation();
  const rect = canvas.getBoundingClientRect();
  const cx = rect.width / 2, cy = rect.height / 2;
  const k = Math.min(2.5, Math.max(0.4, view.k * factor));
  view = { k, x: cx - (cx - view.x) * (k / view.k), y: cy - (cy - view.y) * (k / view.k) };
  applyView();
}
$("cvZoomIn").onclick = ()=>zoomCenter(1.2);
$("cvZoomOut").onclick = ()=>zoomCenter(1 / 1.2);
$("cvFit").onclick = ()=>fitView({ duration: 560 });

/* ================= 选择 ================= */
function select(kind, id){
  if (!kind){ depFocus = null; }
  selected = kind && id ? { kind, id } : null;
  selGroupId = null;          // 选中节点/边或清空选择时，组选中随之取消（单向互斥）
  document.querySelectorAll(".node.sel").forEach((el)=>el.classList.remove("sel"));
  document.querySelectorAll(".docitem.active").forEach((el)=>el.classList.remove("active"));
  if (!selected){
    $("insp-empty").style.display = ""; $("insp-node").style.display = "none"; $("insp-edge").style.display = "none"; $("insp-meta").style.display = "";
    fillMeta();
  } else if (selected.kind === "node"){
    const node = current?.nodes.find((n)=>n.id === selected.id);
    if (node){
      nodeEl(node.id)?.classList.add("sel");
      document.querySelector(`.docitem[data-node="${CSS.escape(node.id)}"]`)?.classList.add("active");
      $("insp-empty").style.display = "none"; $("insp-node").style.display = ""; $("insp-edge").style.display = "none"; $("insp-meta").style.display = "none";
      $("n-label").value = node.label; $("n-type").value = node.type; $("n-icon").value = node.icon ?? "";
      $("n-fill").value = node.fill; $("n-border").value = node.border; $("n-text").value = node.textColor;
      $("n-status").value = node.status ?? ""; $("n-note").value = node.note ?? ""; autoGrow($("n-note"));
      renderNotePreview();
      depFocus = depEnabled ? computeDeps(node.id) : null;
      renderDepList(node);
      $("n-titleText") && ($("n-titleText").textContent = String(node.label ?? "").slice(0, 60));
      $("n-typeBadge") && ($("n-typeBadge").textContent = typeLabel(node.type));
      renderAttachments(node);
      renderXlinks(node);
      renderConvoActions(node);
    }
  } else {
    $("insp-empty").style.display = "none"; $("insp-node").style.display = "none"; $("insp-edge").style.display = ""; $("insp-meta").style.display = "none";
    const edge = current?.edges.find((x)=>x.id === selected.id);
    if (edge){
      $("e-label").value = edge.label ?? ""; $("e-type").value = edge.type ?? "";
      $("e-color").value = edge.color; $("e-width").value = String(edge.width);
      $("e-style").value = edge.style; $("e-arrow").value = edge.arrow;
    }
  }
  renderEdges();
  // 顺序关键：renderEdges 会重建全部边 DOM，依赖高亮类必须在它之后写，否则刚加的高亮被整体抹掉
  applyDepHighlight();
  applyConvoToCanvas();
  if (CV.on) cvDraw();   // 画布模式：选中环 / 依赖明暗由 cvDraw 呈现，选中变化必须立刻重绘
}
/** 选中一个分组（DOM/画布通用）：面板归位到 meta（组列表在其中），高亮 + 滚动定位，
 *  组框以卡片选中语言（accent 边 + 柔光）高亮。不新建面板——组详情仍走右键菜单（范围控制）。 */
function selectGroup(id){
  selGroupId = id ?? null;
  selected = null;
  depFocus = null;
  document.querySelectorAll(".node.sel").forEach((el)=>el.classList.remove("sel"));
  document.querySelectorAll(".docitem.active").forEach((el)=>el.classList.remove("active"));
  $("insp-empty").style.display = ""; $("insp-node").style.display = "none"; $("insp-edge").style.display = "none"; $("insp-meta").style.display = "";
  fillMeta();   // → renderGroupList() 会带上 sel 高亮
  const item = id ? document.querySelector(`#groupList [data-g="${CSS.escape(id)}"]`) : null;
  if (item) item.scrollIntoView({ block: "nearest" });
  if (CV.on) cvDraw(); else renderGroups();
}
window.__ofSel = ()=>({ node: selected?.kind ? selected.id : null, group: selGroupId });   // 只读调试钩子（浏览器检查/诊断用）
window.__ofView = ()=>({ k: view.k, x: view.x, y: view.y });   // 只读：当前视口变换（世界→屏幕换算用）
function fillMeta(){
  if (!current) return;
  $("m-name").value = current.name; $("m-desc").value = current.description ?? ""; $("m-direction").value = current.direction ?? "TD";
  renderGroupList();
}
window.addEventListener("keydown", (e)=>{
  if (["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName)) return;
  if (e.key === "Escape"){ select(null); closeModal(); closeGs(); }
  if ((e.key === "Delete" || e.key === "Backspace") && selected){
    e.preventDefault();
    if (selected.kind === "node") removeNode(selected.id); else removeEdge(selected.id);
  }
});

/* ================= 渲染 ================= */
function typeLabel(type){
  const def = current?.nodeTypes?.[type];
  return (LANG === "en" ? def?.labelEn : def?.label) ?? type ?? "";
}
function edgeTypeLabel(type){
  const def = current?.edgeTypes?.[type];
  return (LANG === "en" ? def?.labelEn : def?.label) ?? "";
}
/* ================= 学术公式渲染（KaTeX 0.18.7，本地离线，含 mhchem） ================= */
/* 目标：用户从任何来源粘贴的 LaTeX 都要尽力渲染 —— 常见前置处理 + 失败降级不丢内容 */

/**
 * 不定义任何自定义宏（避免依赖库外命令）。
 * 这里把常见简写**重写**为 KaTeX 标准命令，保证渲染的 LaTeX 是纯标准写法。
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

/** siunitx 常见单位 → 文本（不支持 siunitx 时降级） */
const UNIT_MAP = [
  [/\\meter/g, "m"], [/\\second/g, "s"], [/\\kilogram/g, "kg"], [/\\gram/g, "g"],
  [/\\ampere/g, "A"], [/\\kelvin/g, "K"], [/\\mole/g, "mol"], [/\\candela/g, "cd"],
  [/\\per/g, "/"], [/\\squared/g, "^2"], [/\\cubed/g, "^3"], [/\\milli/g, "m"],
  [/\\micro/g, "\\mu "], [/\\nano/g, "n"], [/\\kilo/g, "k"], [/\\centi/g, "c"],
  [/\\joule/g, "J"], [/\\watt/g, "W"], [/\\newton/g, "N"], [/\\pascal/g, "Pa"],
  [/\\volt/g, "V"], [/\\liter/g, "L"], [/\\litre/g, "L"], [/\\hertz/g, "Hz"],
  [/\\degree/g, "^\\circ"], [/\\celsius/g, "^\\circ\\mathrm{C}"],
];

/** LaTeX 归一化：能修的都修成 KaTeX 支持的写法（修不了的原样保留，由渲染层降级） */
function normalizeLatex(src){
  let t = String(src ?? "");
  for (const [re, to] of SHORTHAND) t = t.replace(re, to);   // 简写 → 标准命令（非宏定义）
  // 注释（保留转义 \%）
  t = t.replace(/(^|[^\\])%.*$/gm, "$1");
  // 导言区 / 文档包裹
  t = t.replace(/\\(documentclass|usepackage|RequirePackage)(\[[^\]]*\])?\{[^}]*\}/g, "");
  t = t.replace(/\\(begin|end)\{document\}/g, "");
  t = t.replace(/\\(setlength|addtolength|pagestyle|thispagestyle|geometry|newpage|clearpage|noindent|centering|hfill|vfill|smallskip|medskip|bigskip|maketitle|tableofcontents)\b(\[[^\]]*\])?(\{[^}]*\})?/g, "");
  t = t.replace(/\\(label|nonumber|notag|index|glossary)\b(\[[^\]]*\])?(\{[^}]*\})?/g, "");
  // \tag{N} 在行内模式下 KaTeX 会报 "\tag works only in display equations" → 转成普通文本编号（两种模式都能编译且保留信息）
  t = t.replace(/\\tag\*?\{([^}]*)\}/g, "\\quad\\text{($1)}");
  t = t.replace(/\\tag\*?([^\s$\\]+)/g, "\\quad\\text{($1)}");
  t = t.replace(/\\(vspace|hspace|vskip|hskip)\*?\{[^}]*\}/g, "");
  // 常见命令等价替换
  t = t.replace(/\\bm\b/g, "\\boldsymbol");
  t = t.replace(/\\cite[tp]?\b(\[[^\]]*\])?\{([^}]*)\}/g, "[$2]");
  t = t.replace(/\\eqref\{([^}]*)\}/g, "($1)");
  t = t.replace(/\\ref\{([^}]*)\}/g, "$1");
  t = t.replace(/\\includegraphics(\[[^\]]*\])?\{[^}]*\}/g, "");
  t = t.replace(/\\sideset\{([^}]*)\}\{([^}]*)\}\s*(\\[a-zA-Z]+)/g, "$3$1$2");
  // 单位（siunitx 降级）
  t = t.replace(/\\SI\{([^}]*)\}\{([^}]*)\}/g, (_, val, unit)=>{
    let u = unit; for (const [re, to] of UNIT_MAP) u = u.replace(re, to);
    return `${val}\\,\\mathrm{${u}}`;
  });
  t = t.replace(/\\si\{([^}]*)\}/g, (_, unit)=>{
    let u = unit; for (const [re, to] of UNIT_MAP) u = u.replace(re, to);
    return `\\mathrm{${u}}`;
  });
  // 无法在网页渲染的绘图/浮动环境 → 占位（保留可读信息）
  t = t.replace(/\\begin\{(tikzpicture|figure\*?|table\*?|algorithm\*?|lstlisting)\}[\s\S]*?\\end\{\1\}/g,
                (_m, env)=> `[${env}: ${t("latexUnsupported")}]`);
  // 先清理「孤立」的 begin/end（未成对的残留），再转换合法公式环境——顺序不可颠倒
  t = t.replace(/\\(begin|end)\{(?!equation|align|gather|multline|displaymath|math|alignat|flalign|eqnarray|pmatrix|bmatrix|vmatrix|matrix|cases|array|aligned|gathered|split|smallmatrix)[^}]*\}/g, "");
  // 公式环境 → $$ 显示数学；align/gather 系列必须保留内部结构（& 与 \\ 在裸数学中非法）
  t = t.replace(/\\begin\{(align\*?|alignat\*?|flalign\*?|eqnarray\*?)\}([\s\S]*?)\\end\{\1\}/g,
                (_m, _env, body)=> `$$\\begin{aligned}${body}\\end{aligned}$$`);
  t = t.replace(/\\begin\{(gather\*?|multline\*?)\}([\s\S]*?)\\end\{\1\}/g,
                (_m, _env, body)=> `$$\\begin{gathered}${body}\\end{gathered}$$`);
  t = t.replace(/\\begin\{(equation\*?|displaymath|math)\}([\s\S]*?)\\end\{\1\}/g,
                (_m, _env, body)=> `$$${body}$$`);
  return t;
}

/** 裸 LaTeX 识别：整段像公式（含命令/上下标/环境，且正文无中日韩字）→ 视为数学 */
const MATH_CMD = /\\(frac|dfrac|tfrac|sqrt|sum|prod|coprod|int|iint|iiint|oint|lim|limsup|liminf|log|ln|lg|exp|sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|sinh|cosh|tanh|det|dim|ker|deg|gcd|min|max|sup|inf|arg|Pr|alpha|beta|gamma|delta|Delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|Lambda|mu|nu|xi|Xi|pi|Pi|rho|varrho|sigma|Sigma|tau|upsilon|phi|varphi|Phi|chi|psi|Psi|omega|Omega|Gamma|Theta|mathbb|mathcal|mathfrak|mathbf|mathrm|mathsf|mathtt|mathit|boldsymbol|hat|widehat|bar|overline|underline|vec|dot|ddot|tilde|widetilde|overbrace|underbrace|overset|underset|partial|nabla|infty|cdot|cdots|ldots|dots|times|div|pm|mp|leq|geq|neq|ne|approx|equiv|cong|sim|simeq|propto|ll|gg|to|rightarrow|leftarrow|Rightarrow|Leftarrow|leftrightarrow|Leftrightarrow|mapsto|longmapsto|in|notin|ni|subset|subseteq|supset|supseteq|cup|cap|setminus|emptyset|varnothing|forall|exists|nexists|neg|land|lor|implies|iff|langle|rangle|\|lfloor|rfloor|lceil|rceil|binom|choose|pmatrix|bmatrix|vmatrix|matrix|cases|array|aligned|gathered|operatorname|text|textbf|textit|emph|ce|SI|si|bm|quad|qquad|left|right|big|Big|bigg|Bigg|begin|end|quad|hspace|vspace|label|tag|color|boxed|cancel|overset|underset|xrightarrow|xleftarrow|sideset|limits|nolimits|displaystyle|textstyle|scriptstyle|scriptscriptstyle|substack|sideset|underbrace|overbrace)\b/;
/** 去掉 \text{} / \mathrm{} 等文本容器后再查中日韩，避免「公式里有中文文本」被误判 */
function looksLikeMath(block){
  const t = String(block ?? "").trim();
  if (!t) return false;
  // 已经是普通句子（含句号/问号且无命令）→ 不是公式
  const noTextCJK = t.replace(/\\text\{[^}]*\}|\\mathrm\{[^}]*\}|\\textbf\{[^}]*\}|\\operatorname\{[^}]*\}/g, "");
  if (/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(noTextCJK)) return false;
  const hasCmd = MATH_CMD.test(t);
  const hasEnv = /\\begin\{[a-zA-Z*]+\}/.test(t);
  const hasScript = /[\^_](\{|[A-Za-z0-9])/.test(t);
  const hasFormulaSymbols = /[=<>]|\\[a-zA-Z]+/.test(t) && /[A-Za-z0-9}]/.test(t);
  // 判定：有 LaTeX 命令/环境 → 数学；只有上下标且含 = → 数学
  if (hasCmd || hasEnv) return true;
  if (hasScript && /[=<>]/.test(t)) return true;
  return false;
}

/** 行内裸数学：从混排文本中切出可渲染的数学跨度（\ce{}、x^2+y^2=z^2 等） */
const INLINE_MATH_RE = /\\ce\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|\\[a-zA-Z]+(?:\s*(?:\{[^{}]*\}|\[[^\]]*\]|[_^]\{[^{}]*\}|[_^][A-Za-z0-9]))+(?:\s*[=+\-*/<>]\s*[A-Za-z0-9\\{}^_]+)*|[A-Za-z0-9]+\s*[_^]\{[^{}]*\}(?:\s*[=+\-*/<>]\s*[A-Za-z0-9\\{}^_]+)*|[A-Za-z0-9]+\s*[_^][A-Za-z0-9](?:\s*[=+\-*/<>]\s*[A-Za-z0-9\\{}^_]+)*/g;

/** 把一行拆成 [文本 | 数学] 片段；无可渲染数学则整体作文本 */
function splitLineInline(line){
  const parts = [];
  let last = 0, m;
  INLINE_MATH_RE.lastIndex = 0;
  while ((m = INLINE_MATH_RE.exec(line))){
    const hit = m[0];
    // 过滤：太短或纯单词的不算（避免把普通英文单词当公式）
    const isCmd = /^\\[a-zA-Z]/.test(hit.trim());
    if (!isCmd && hit.trim().length < 3) continue;
    if (!isCmd && !/[=^_]/.test(hit)) continue;
    if (m.index > last) parts.push({ math: false, body: line.slice(last, m.index) });
    parts.push({ math: true, body: hit.trim(), display: false, raw: hit.trim() });
    last = m.index + hit.length;
  }
  if (last < line.length) parts.push({ math: false, body: line.slice(last) });
  return parts;
}

/** 把普通文本块按空行切段；公式行/行内公式均标记为数学段 */
function pushPlainBlock(out, block){
  if (!block.trim()) { out.push({ math: false, body: block }); return; }
  const paras = block.split(/(\n\s*\n)/);
  for (const para of paras){
    if (!para.trim()) { out.push({ math: false, body: para }); continue; }
    const lines = para.split("\n");
    let buffer = [];
    const flush = ()=>{ if (buffer.length){ out.push({ math: false, body: buffer.join("\n") }); buffer = []; } };
    for (const line of lines){
      if (looksLikeMath(line)){
        // 整行是公式 → 显示模式
        flush();
        out.push({ math: true, body: line.trim(), display: true, raw: line.trim() });
        continue;
      }
      // 行内混排：切出数学跨度（如「化学：\ce{2H2 + O2 -> 2H2O} 的焓变」）
      const segs = splitLineInline(line);
      if (segs.some((x)=> x.math)){
        flush();
        for (const sg of segs) out.push(sg);
      } else buffer.push(line);
    }
    flush();
  }
}

/** 极简 Markdown → HTML（先转义，防注入）：粗体/斜体/行内代码/标题/列表/链接 */
function miniMarkdown(src){
  const inline = (t)=> t
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<i>$2</i>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const out = [];
  let inList = false;
  const closeList = ()=>{ if (inList){ out.push("</ul>"); inList = false; } };
  for (const raw of String(src ?? "").split(/\r?\n/)){
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    const li = line.match(/^\s*[-*+]\s+(.*)$/);
    if (h){ closeList(); const lv = Math.min(3, h[1].length); out.push(`<h${lv}>${inline(h[2])}</h${lv}>`); continue; }
    if (li){ if (!inList){ out.push("<ul>"); inList = true; } out.push(`<li>${inline(li[1])}</li>`); continue; }
    closeList();
    out.push(line.trim() ? `<p>${inline(line)}</p>` : "");
  }
  closeList();
  return out.join("\n");
}

/** 把文本切成 [普通文本 | 数学段] 序列（定界符 + 裸公式双通道） */
function splitMathSegments(text){
  const src = normalizeLatex(text);
  const out = [];
  const re = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|\$([^$\n]+?)\$/g;
  let last = 0, m;
  while ((m = re.exec(src))){
    if (m.index > last) pushPlainBlock(out, src.slice(last, m.index));
    const display = m[1] !== undefined || m[2] !== undefined;
    const body = m[1] ?? m[2] ?? m[3] ?? m[4] ?? "";
    out.push({ math: true, body, display, raw: m[0] });
    last = re.lastIndex;
  }
  if (last < src.length) pushPlainBlock(out, src.slice(last));
  return out;
}

/** 渲染单个数学段：成功返回节点；失败降级为「原文 + 提示」，绝不丢内容 */
function renderMathNode(seg){
  const host = document.createElement(seg.display ? "div" : "span");
  host.className = seg.display ? "math-block" : "math-inline";
  if (!window.katex?.renderToString) { host.textContent = seg.raw; return host; }
  try {
    const html = window.katex.renderToString(seg.body, {
      displayMode: !!seg.display, throwOnError: false, strict: false, trust: false,
      errorColor: "#F87171"
    });
    host.innerHTML = html;
    // KaTeX 以 errorColor 渲染失败片段；检测到 → 降级展示原文，并给出提示
    const err = host.querySelector(".katex-error");
    if (err){
      const box = document.createElement("span");
      box.className = "math-fallback";
      box.title = err.getAttribute("title") || t("latexUnparsed");
      box.textContent = seg.raw;
      const tag = document.createElement("span");
      tag.className = "math-fallback-tag";
      tag.textContent = t("latexKept");
      const wrap = document.createElement("span");
      wrap.appendChild(box); wrap.appendChild(tag);
      host.innerHTML = ""; host.appendChild(wrap);
    }
  } catch (e){
    const box = document.createElement("span");
    box.className = "math-fallback";
    box.title = String(e?.message ?? e);
    box.textContent = seg.raw;
    host.innerHTML = ""; host.appendChild(box);
  }
  return host;
}

/** 整段富文本渲染（Markdown + 公式，带降级） */
function renderMathIn(el, text){
  if (!el) return;
  const source = text ?? el.dataset.src ?? "";
  el.dataset.src = source;
  if (!String(source).trim()){ el.innerHTML = ""; return; }
  const frag = document.createDocumentFragment();
  for (const seg of splitMathSegments(source)){
    if (seg.math){ frag.appendChild(renderMathNode(seg)); continue; }
    const div = document.createElement("div");
    div.className = "md-plain";
    div.innerHTML = miniMarkdown(escapeHtml(seg.body));
    frag.appendChild(div);
  }
  el.innerHTML = "";
  el.appendChild(frag);
}

/** 检查框实时预览（防抖） */
let notePreviewTimer = 0;
/** Grow a textarea to fit its content. The content box has no length limit, so it must not be
 *  capped to a fixed height either. */
function autoGrow(el){
  if (!el || el.tagName !== "TEXTAREA") return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function renderNotePreview(){
  const box = $("n-preview");
  if (!box) return;
  renderMathIn(box, $("n-note")?.value ?? "");
}

function nodeById(id){ return nodeIndex.get(id) ?? current?.nodes.find((n)=>n.id === id) ?? null; }

function edgeGeometry(edge){
  const s = nodeById(edge.source), t = nodeById(edge.target);
  if (!s || !t) return null;
  const sp = livePos(s), tp = livePos(t);
  const sh = s._h ?? s.h, th = t._h ?? t.h;
  const start = { x: sp.x + s.w, y: sp.y + sh / 2 };
  const end = { x: tp.x, y: tp.y + th / 2 };
  // 恢复原有曲线形态（此前误改过弯距限幅，形态变丑；曲线不是问题所在）
  const forward = Math.max(54, Math.abs(end.x - start.x) * 0.46);
  const bend = end.x >= start.x ? forward : Math.max(90, forward * 0.7);
  // 曲线上的真实中点（三次贝塞尔 t=0.5：0.125P0 + 0.375P1 + 0.375P2 + 0.125P3）
  // —— 参考实现用 Cytoscape 的 text-margin-y:-8，标签恒贴在线上；此前我用两点直线中点，弯线时标签会飘离
  const c1 = { x: start.x + bend, y: start.y }, c2 = { x: end.x - bend, y: end.y };
  const mid = {
    x: 0.125 * start.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * end.x,
    y: 0.125 * start.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * end.y,
  };
  return { start, end, mid, bend, path: `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}` };
}

/* 拖动中的节点使用实时坐标：箭头始终连着一起走，而不是松手后才跳过去。 */
function livePos(node){
  if (!liveDrag) return { x: node.x, y: node.y };
  return liveDrag.map.get(node.id) ?? { x: node.x, y: node.y };
}

function render(){
  if (!current) return;
  rebuildIndexes();
  $("gstat").textContent = current.valid ? `✓ ${current.nodes.length}● / ${current.edges.length}→` : `⚠ ${current.issues.length}`;
  $("gstat").className = "badge " + (current.valid ? (current.warnings.length ? "warn" : "ok") : "err");
  // 列表与筛选只在“影响列表的内容”变化时重建（每次 render 重建 70+ 行 DOM 是卡顿主因之一）
  const listSig = `${current.id}|${current.nodes.length}|${current.edges.length}|${typeFilter ?? ""}|${$("globalSearch")?.value ?? ""}|${current.revision ?? ""}`;
  if (listSig !== window.__listSig){
    window.__listSig = listSig;
    renderDocList();
    renderTypeFilter();
  }
  if (CV.on){ cvDraw(); } else { renderGroups(); renderEdges(); renderNodes(); }
  computeConvo();
  applyDepHighlight();
  applyConvoToCanvas();
  renderConvoPanel();
  applyLeanMode();
  applyThumbsAvailability();
}

/* --- 连线（agent-flow 版式：SVG 分组 + 恒定线宽 + 填充箭头 + SVG 标签） --- */
function edgeColorOf(edge){ return edge.color || "#64748B"; }

/* 拖拽/拉线时的极速路径更新：只改已有元素的 d 属性，不重建 DOM。
   性能上限：rAF 帧同步——每帧最多执行一次更新（≈16ms 一帧），
   最坏情况单核占用 ~5%，远低于总性能 50% 红线，同时保持满帧丝滑。 */
let liveFrameQueued = false;
function scheduleLiveFrame(){
  if (liveFrameQueued) return;
  liveFrameQueued = true;
  requestAnimationFrame(()=>{ liveFrameQueued = false; updateEdgesLive(); updateConnLive(); updateGroupsLive(); });
}



/* ================= 阅读模式：章节分组 + 可折叠卡片 + 依赖 chip ================= */
let rdOpen = false;

function openReader(){
  if (!current) return;
  rdOpen = true;
  $("reader").hidden = false;
  renderReader();
}
function closeReader(){ rdOpen = false; $("reader").hidden = true; }

/** 卡片所属小节（sec: 标签优先，其次分组） */
function sectionOfNode(node){
  const tag = (node.tags ?? []).map(String).find((t)=> t.startsWith("sec:"));
  if (tag) return tag.slice(4);
  const g = (current.groups ?? []).find((x)=> (x.members ?? []).includes(node.id));
  return g ? g.label : t("unsectioned");
}

function renderReader(){
  const body = $("rd-body");
  if (!current){ body.innerHTML = `<div class="rd-empty">${t("readerNoGraph")}</div>`; return; }
  const q = ($("rd-search")?.value ?? "").trim().toLowerCase();
  const noteOf = (id)=> String(current.notes?.[id] ?? "");
  const bySec = new Map();
  for (const n of current.nodes){
    if (q && !(`${n.label} ${noteOf(n.id)}`.toLowerCase().includes(q))) continue;
    const sec = sectionOfNode(n);
    if (!bySec.has(sec)) bySec.set(sec, []);
    bySec.get(sec).push(n);
  }
  const typeColor = (t)=> (current.nodeTypes?.[t]?.border) ?? "var(--border)";
  const secCode = (s)=> (String(s).match(/^[\d.]+|^\(?[a-z]\)/i) ?? [String(s).slice(0, 4)])[0];

  body.innerHTML = bySec.size ? [...bySec.entries()].map(([sec, list])=> {
    const cards = list.map((n)=>{
      const deps = current.edges.filter((e)=> e.target === n.id).map((e)=> ({ e, node: current.nodes.find((x)=> x.id === e.source) })).filter((x)=> x.node);
      const uses = current.edges.filter((e)=> e.source === n.id).map((e)=> ({ e, node: current.nodes.find((x)=> x.id === e.target) })).filter((x)=> x.node);
      const xl = xlinks.byNode.get(n.id);
      const page = (n.tags ?? []).map(String).find((t)=> t.startsWith("page:"))?.slice(5);
      const thumbs = (n.attachments ?? []).slice(0, 4).map((a)=>{
        const src = /^https?:|^data:/i.test(a.src) ? a.src : `/api/graph/${encodeURIComponent(current.id)}/asset/${encodeURIComponent(String(a.src).replace(/^assets\//, ""))}`;
        return `<span class="attach-thumb" style="width:54px;height:72px" data-img="${escapeHtml(src)}"><img src="${src}" alt=""><span class="tag">${a.page ? "p." + a.page : ""}</span></span>`;
      }).join("");
      return `<details class="rd-card">
        <summary>
          <span class="rd-badge" style="color:${typeColor(n.type)}">${escapeHtml(typeLabel(n.type))}</span>
          <span class="rd-title">${escapeHtml(n.label)}</span>
          <span class="rd-num">${escapeHtml(n.id)}</span>
          ${xl ? `<span class="xlink-pill">${xl.provides.length ? "⇱" + xl.provides.length : ""}${xl.uses.length ? "⇲" + xl.uses.length : ""}</span>` : ""}
          <span class="rd-page">${page ? t("readerPage").replace("{n}", page) : ""}</span>
        </summary>
        <div class="rd-in">
          ${deps.length ? `<div class="rd-deps"><span class="dlab">${t("edgeDeps")}</span>${deps.map((d)=> `<span class="rd-dep" data-node="${escapeHtml(d.node.id)}">${escapeHtml(d.node.label)}</span>`).join("")}</div>` : ""}
          ${uses.length ? `<div class="rd-deps"><span class="dlab">${t("edgeUses")}</span>${uses.map((d)=> `<span class="rd-dep" data-node="${escapeHtml(d.node.id)}">${escapeHtml(d.node.label)}</span>`).join("")}</div>` : ""}
          <div class="rd-note" data-note="${escapeHtml(n.id)}"></div>
          ${thumbs ? `<div class="rd-thumbs">${thumbs}</div>` : ""}
        </div>
      </details>`;
    }).join("");
    return `<section class="rd-sec">
      <div class="rd-sec-head">
        <span class="rd-sec-code">${escapeHtml(secCode(sec))}</span>
        <span class="rd-sec-name">${escapeHtml(sec)}</span>
        <span class="rd-sec-cnt">${list.length} 张</span>
      </div>${cards}</section>`;
  }).join("") : `<div class="rd-empty">${t("readerNoMatch")}</div>`;

  // 备注：懒渲染（展开时才编译公式，避免 87 张卡一次性重排）
  body.querySelectorAll("details.rd-card").forEach((d)=>{
    d.addEventListener("toggle", ()=>{
      if (!d.open) return;
      const host = d.querySelector(".rd-note");
      if (host.dataset.done) return;
      const id = host.dataset.note;
      renderMathIn(host, noteOf(id));
      host.dataset.done = "1";
    }, { once: true });
  });
  body.querySelectorAll(".rd-dep").forEach((el)=>{
    el.onclick = ()=>{ closeReader(); select("node", el.dataset.node); focusNode(current.nodes.find((n)=> n.id === el.dataset.node)); };
  });
  body.querySelectorAll(".rd-thumbs .attach-thumb").forEach((el)=>{
    el.onclick = ()=> openLightbox([{ src: el.dataset.img.replace(/^.*\/asset\//, "assets/"), label: "" }], 0);
  });
}




/* ================= 分组几何自动回写（每组 1.2s 内只写一次，避免写盘风暴） ================= */
const refitTimers = new Map();
function scheduleGroupRefit(groupId, rect){
  if (refitTimers.has(groupId)) return;
  refitTimers.set(groupId, setTimeout(async ()=>{
    refitTimers.delete(groupId);
    try {
      await api(`/api/graph/${current.id}/group-commit`, { method: "POST", body: JSON.stringify({ groupId, rect }) });
    } catch { /* 静默：下次渲染会再自查 */ }
  }, 1200));
}


/* ================= canvas 画布层 =================
   参考实现（Cytoscape）快在「一张 canvas 画完，平移=一次变换，无逐节点 DOM」。
   这里用原生 Canvas2D 实现同一架构：
     · 节点/连线/分组框全部绘制，DOM 只保留面板
     · 选择/上下游/搜索/会话等状态只是 draw 时的分支，不再做类切换
     · 平移缩放 = 改 view 后重绘（≈100 个图元的重绘 1~3ms）
   DOM 渲染路径完整保留在 body:not(.canvas-mode) 下作回退。 */
const CV = { on: false, canvas: null, ctx: null, dpr: 1, imgCache: new Map(), hover: null, hoverEdge: null };

function cvInit(){
  const c = $("scene");
  if (!c) return;
  CV.canvas = c;
  CV.ctx = c.getContext("2d", { alpha: true });
  cvResize();
  window.addEventListener("resize", cvResize);
  cvBind();                       // 事件先绑好，但默不启用
  cvSetMode(CV.on);
}

/** 切换渲染模式：false = DOM（默认，功能完整）· true = canvas（大图加速档） */
/** One place decides how a mode button looks when it is on, and keeps its accessible state in sync. */
function setToggle(id, on){
  const el = $(id);
  if (!el) return;
  el.classList.toggle("on", !!on);
  el.setAttribute("aria-pressed", on ? "true" : "false");
}
function cvSetMode(on){
  CV.on = !!on;
  document.body.classList.toggle("canvas-mode", CV.on);
  setToggle("btnCanvas", CV.on);
  if (CV.on) cvResize();
  render();
}
function cvResize(){
  const c = CV.canvas, vp = $("viewport");
  // The canvas is only a rendering surface in canvas mode. Sizing/painting it while the DOM layer
  // is the visible one leaves a painted copy behind the cards → two identical charts on screen.
  if (!CV.on) return;
  if (!c || !vp) return;
  const r = vp.getBoundingClientRect();
  CV.dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = Math.max(1, Math.round(r.width * CV.dpr));
  c.height = Math.max(1, Math.round(r.height * CV.dpr));
  cvDraw();
}

/** 圆角矩形路径 */
function rr(ctx, x, y, w, h, r){
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function cvThumbOf(node){
  const list = (node.attachments ?? []).filter((a)=> a.kind === "page" || a.kind === "image" || /\.(png|jpe?g|gif|webp|svg)$/i.test(a.src));
  return list[0] ? cvAssetUrl(current.id, list[0].src) : null;
}
function cvAssetUrl(gid, src){
  return /^https?:|^data:/i.test(src) ? src : `/api/graph/${encodeURIComponent(gid)}/asset/${encodeURIComponent(String(src).replace(/^assets\//, ""))}`;
}
function cvImage(url){
  if (!url) return null;
  let rec = CV.imgCache.get(url);
  if (!rec){
    const img = new Image();
    img.decoding = "async";
    img.onload = ()=>{ rec.ok = true; cvDraw(); };
    img.src = url;
    rec = { img, ok: false };
    CV.imgCache.set(url, rec);
  }
  return rec.ok ? rec.img : null;
}

/** 主绘制：一次画完（含分组框/连线/节点/标注） */
function cvDraw(){
  if (!CV.on) return;               // never paint the off-mode surface (see cvResize)
  const ctx = CV.ctx, c = CV.canvas;
  if (!ctx || !c) return;
  const t0 = performance.now();
  const vp = $("viewport").getBoundingClientRect();
  const W = vp.width, H = vp.height;
  const cs = getComputedStyle(document.body);
  ctx.setTransform(CV.dpr, 0, 0, CV.dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (!current){ return; }
  // 世界坐标 → 屏幕：ctx 变换
  ctx.setTransform(CV.dpr * view.k, 0, 0, CV.dpr * view.k, CV.dpr * view.x, CV.dpr * view.y);
  ctx.lineJoin = "round";
  ctx.textBaseline = "top";

  const focusId = depFocus && selected?.kind === "node" ? selected.id : null;
  const up = depFocus?.up ?? new Set(), down = depFocus?.down ?? new Set();
  const dim = (id)=> !!focusId && id !== focusId && !up.has(id) && !down.has(id);

  // ---- 分组框 ----
  for (const g of (current.groups ?? [])){
    const ms = (g.members ?? []).map((id)=> nodeById(id)).filter(Boolean);
    if (!ms.length) continue;
    const gm = (g.rect && !g._dragging)
      ? { minX: g.rect.x, minY: g.rect.y, w: g.rect.w, h: g.rect.h }
      : groupGeom(ms);
    const isSel = selGroupId === g.id;
    ctx.save();
    ctx.globalAlpha = dim(ms[0].id) && ms.every((m)=> dim(m.id)) ? 0.35 : 1;
    rr(ctx, gm.minX, gm.minY, gm.w, gm.h, 14);
    ctx.fillStyle = (g.color ?? "#64748B") + "14";
    ctx.fill();
    ctx.setLineDash(g.rect ? [] : [7, 5]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = isSel ? ((cs.getPropertyValue("--accent") || "#38BDF8").trim()) : (g.color ?? "#64748B");
    ctx.stroke();
    ctx.setLineDash([]);
    // 标签
    const label = String(g.label ?? "");
    ctx.font = "600 11px -apple-system, 'PingFang SC', sans-serif";
    const tw = ctx.measureText(label).width;
    rr(ctx, gm.minX + 10, gm.minY - 10, tw + 16, 20, 10);
    ctx.fillStyle = document.body.classList.contains("light") ? "#FFFFFF" : "#0B1220";
    ctx.fill();
    ctx.strokeStyle = (g.color ?? "#64748B") + "88";
    ctx.stroke();
    ctx.fillStyle = g.color ?? "#64748B";
    ctx.fillText(label, gm.minX + 18, gm.minY - 6);
    ctx.restore();
  }

  // ---- 连线 ----
  for (const e of (current.edges ?? [])){
    const geom = edgeGeometry(e);
    if (!geom) continue;
    const isUp = focusId && (e.target === focusId || (up.has(e.target) && up.has(e.source)));
    const isDown = focusId && (e.source === focusId || (down.has(e.source) && down.has(e.target)));
    const isDim = !!focusId && !isUp && !isDown;
    ctx.save();
    ctx.globalAlpha = isDim ? 0.12 : 1;
    ctx.lineWidth = (isUp || isDown) ? 2.6 : 1.6;
    ctx.strokeStyle = isUp ? "#38BDF8" : isDown ? "#F87171" : edgeColorOf(e);
    ctx.setLineDash(e.style === "dashed" ? [7, 5] : []);
    ctx.beginPath();
    ctx.moveTo(geom.start.x, geom.start.y);
    const dx = geom.end.x - geom.start.x;
    const bend = dx >= 0 ? Math.max(54, Math.abs(dx) * 0.46) : Math.max(90, Math.abs(dx) * 0.322);
    ctx.bezierCurveTo(geom.start.x + bend, geom.start.y, geom.end.x - bend, geom.end.y, geom.end.x, geom.end.y);
    ctx.stroke();
    ctx.setLineDash([]);
    // 箭头
    const ang = Math.atan2(geom.end.y - geom.start.y, (geom.end.x - geom.start.x) || 0.001);
    const AR = 7;
    ctx.beginPath();
    ctx.moveTo(geom.end.x, geom.end.y);
    ctx.lineTo(geom.end.x - AR * Math.cos(ang - 0.4), geom.end.y - AR * Math.sin(ang - 0.4));
    ctx.lineTo(geom.end.x - AR * Math.cos(ang + 0.4), geom.end.y - AR * Math.sin(ang + 0.4));
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    // 标签
    if (e.label){
      ctx.font = "10px -apple-system, 'PingFang SC', sans-serif";
      const mx = geom.mid.x, my = geom.mid.y - 8;   // 贴在线上（曲线真实中点）
      const lw = ctx.measureText(e.label).width;
      ctx.fillStyle = document.body.classList.contains("light") ? "rgba(255,255,255,.86)" : "rgba(15,23,42,.86)";
      rr(ctx, mx - lw / 2 - 4, my - 12, lw + 8, 15, 4); ctx.fill();
      ctx.fillStyle = "#94A3B8";
      ctx.fillText(e.label, mx - lw / 2, my - 10);
    }
    ctx.restore();
  }

  // ---- 节点 ----
  for (const node of (current.nodes ?? [])){
    const p = livePos(node);
    const w = node.w ?? 168, h = (node._h ?? node.h ?? 64);
    const isSel = selected?.kind === "node" && selected.id === node.id;
    const isHead = isConvo() && convo?.head === node.id;
    const onMain = isConvo() && convo?.mainline?.has(node.id);
    ctx.save();
    ctx.globalAlpha = dim(node.id) ? 0.22 : 1;
    // 卡体
    rr(ctx, p.x, p.y, w, h, 10);
    ctx.fillStyle = node.fill ?? "#334155";
    ctx.fill();
    ctx.lineWidth = isSel ? 2.5 : 1.4;
    ctx.strokeStyle = isSel ? "#FBBF24" : (node.border ?? "#475569");
    ctx.stroke();
    if (isSel || isHead || highlightMembers.includes(node.id)){
      ctx.save();
      ctx.shadowColor = isSel ? "#FBBF24" : isHead ? "#22C55E" : "#38BDF8";
      ctx.shadowBlur = 12;
      rr(ctx, p.x, p.y, w, h, 10);
      ctx.strokeStyle = isSel ? "#FBBF24" : isHead ? "#22C55E" : "#38BDF8";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    // 左侧类型色条
    ctx.fillStyle = node.border ?? "#475569";
    rr(ctx, p.x, p.y + 6, 3, h - 12, 1.5); ctx.fill();
    // 文本
    const cText = node.textColor ?? "#E2E8F0";
    ctx.fillStyle = cText;
    ctx.globalAlpha *= 0.85;
    ctx.font = "10px -apple-system, 'PingFang SC', sans-serif";
    const att = (node.attachments ?? []).length;
    const kind = `${node.icon ?? ""} ${typeLabel(node.type)}${att ? "  📎" + att : ""}`.trim();
    ctx.fillText(kind, p.x + 10, p.y + 7);
    ctx.globalAlpha = dim(node.id) ? 0.22 : 1;
    ctx.fillStyle = cText;
    ctx.font = "650 12.5px -apple-system, 'PingFang SC', sans-serif";
    const labelLines = cvWrap(ctx, String(node.label ?? ""), w - 20 - (cvThumbOf(node) ? 46 : 0), 2);
    let ly = p.y + 21;
    for (const ln of labelLines){ ctx.fillText(ln, p.x + 10, ly); ly += 16; }
    const excerpt = cleanExcerpt(String(node.note ?? "").split("\n")[0]);
    if (excerpt && h > 76){
      ctx.globalAlpha *= 0.62;
      ctx.font = "11px -apple-system, 'PingFang SC', sans-serif";
      const exLines = cvWrap(ctx, excerpt, w - 20 - (cvThumbOf(node) ? 46 : 0), 2);
      let ey = ly + 1;
      for (const ln of exLines){ ctx.fillText(ln, p.x + 10, ey); ey += 14; }
    }
    // 缩略图
    const thumbUrl = cvThumbOf(node);
    if (thumbUrl){
      const img = cvImage(thumbUrl);
      const tw2 = 40, th2 = Math.min(h - 14, 56);
      const tx = p.x + w - tw2 - 6, ty = p.y + (h - th2) / 2;
      ctx.globalAlpha = 1;
      rr(ctx, tx, ty, tw2, th2, 5);
      ctx.save(); ctx.clip();
      if (img) ctx.drawImage(img, tx, ty, tw2, th2);
      else { ctx.fillStyle = "rgba(148,163,184,.18)"; ctx.fillRect(tx, ty, tw2, th2); }
      ctx.restore();
      ctx.strokeStyle = "rgba(148,163,184,.5)"; ctx.lineWidth = 1;
      rr(ctx, tx, ty, tw2, th2, 5); ctx.stroke();
    }
    // 跨图角标
    const xl = xlinks.byNode.get(node.id);
    if (xl){
      ctx.font = "9.5px sans-serif";
      const tag = `${xl.provides.length ? "⇱" + xl.provides.length : ""}${xl.uses.length ? "⇲" + xl.uses.length : ""}`;
      ctx.fillStyle = xl.uses.length ? "#22D3EE" : "#F59E0B";
      ctx.fillText(tag, p.x + w - 42, p.y + 8);
    }
    // 连接手柄（右侧中点）
    if (isSel){
      ctx.beginPath();
      ctx.arc(p.x + w, p.y + h / 2, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#38BDF8"; ctx.fill();
      ctx.strokeStyle = "#0B1220"; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();
  }
  if (window.__perf) window.__perf.draw = +(performance.now() - t0).toFixed(1);
}

/** 文本换行（最多 max 行，超出加省略号） */
function cvWrap(ctx, text, maxW, maxLines){
  const out = [];
  let cur = "";
  for (const ch of String(text)){
    const test = cur + ch;
    if (ctx.measureText(test).width > maxW && cur){
      out.push(cur);
      cur = ch;
      if (out.length >= maxLines) break;
    } else cur = test;
  }
  if (out.length < maxLines && cur) out.push(cur);
  if (out.length === maxLines){
    const last = out[maxLines - 1];
    if (ctx.measureText(String(text)).width > maxW * maxLines) out[maxLines - 1] = last.slice(0, -1) + "…";
  }
  return out;
}

/* ---------------- canvas 命中测试与交互 ---------------- */
function cvWorldFromEvent(e){
  const r = $("viewport").getBoundingClientRect();
  return { x: (e.clientX - r.left - view.x) / view.k, y: (e.clientY - r.top - view.y) / view.k };
}
function cvHitNode(w){
  for (let i = current.nodes.length - 1; i >= 0; i--){
    const n = current.nodes[i];
    const p = livePos(n), h = n._h ?? n.h ?? 64;
    if (w.x >= p.x && w.x <= p.x + (n.w ?? 168) && w.y >= p.y && w.y <= p.y + h) return n;
  }
  return null;
}
function cvHitGroup(w){
  for (let i = (current.groups ?? []).length - 1; i >= 0; i--){
    const g = current.groups[i];
    const ms = (g.members ?? []).map((id)=> nodeById(id)).filter(Boolean);
    if (!ms.length) continue;
    const gm = (g.rect && !g._dragging)
      ? { minX: g.rect.x, minY: g.rect.y, w: g.rect.w, h: g.rect.h }
      : groupGeom(ms);
    // 命中区 = 框体 + 顶部标签带（标签画在 minY-10，之前点标签会落到平移）
    const top = gm.minY - 16;
    if (w.x >= gm.minX && w.x <= gm.minX + gm.w && w.y >= top && w.y <= gm.minY + gm.h) return { g, ms, gm };
  }
  return null;
}

function cvBind(){
  const vp = $("viewport");
  if (!vp || vp._cvBound) return;
  vp._cvBound = true;

  vp.addEventListener("pointerdown", (e)=>{
    if (!CV.on) return;
    const w = cvWorldFromEvent(e);
    const node = cvHitNode(w);
    // Shift = 框选
    if ((e.shiftKey || e.metaKey) && !node){ cvMarquee(e); return; }
    if (node){
      // 右侧手柄 → 连线
      const p = livePos(node), h = node._h ?? node.h ?? 64;
      if (selected?.kind === "node" && selected.id === node.id && Math.abs(w.x - (p.x + (node.w ?? 168))) < 10 && Math.abs(w.y - (p.y + h / 2)) < 12){
        cvStartLink(node, e); return;
      }
      select("node", node.id);
      cvStartNodeDrag(node, e);
      return;
    }
    const grp = cvHitGroup(w);
    if (grp){ cvStartGroupDrag(grp, e); return; }
    // 空白：按下即平移；只有未移动的抬起才算「点击空白」→ 取消选择。
    // 此前 pointerdown 直接 select(null)，一平移就把依赖高亮整个清掉。
    cvStartPan(e, ()=>select(null));
  });

  vp.addEventListener("wheel", (e)=>{
    if (!CV.on) return;
    e.preventDefault();
    const r = vp.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    const k = Math.min(2.5, Math.max(0.15, view.k * Math.exp(-e.deltaY * 0.0016)));
    view.x = cx - (cx - view.x) * (k / view.k);
    view.y = cy - (cy - view.y) * (k / view.k);
    view.k = k;
    scheduleRender();
  }, { passive: false });

  vp.addEventListener("dblclick", (e)=>{
    if (!CV.on) return;
    const node = cvHitNode(cvWorldFromEvent(e));
    if (!node) return;
    const openTag = (node.tags ?? []).map(String).find((t)=> t.startsWith("open:"));
    if (openTag){ location.hash = openTag.slice(5); return; }
    const thumb = (node.attachments ?? []).find((a)=> a.kind === "page" || a.kind === "image");
    if (thumb) openLightbox(node.attachments.filter((a)=> a.kind === "page" || a.kind === "image"), 0);
  });

  vp.addEventListener("contextmenu", (e)=>{
    if (!CV.on) return;
    const w = cvWorldFromEvent(e);
    const node = cvHitNode(w);
    e.preventDefault();
    if (node){ select("node", node.id); openNodeMenu(node, e.clientX, e.clientY); return; }
    const grp = cvHitGroup(w);
    if (grp) openGroupMenu(grp.g, e.clientX, e.clientY);
  });

  vp.addEventListener("pointermove", (e)=>{
    if (!CV.on) return;
    const node = cvHitNode(cvWorldFromEvent(e));
    const id = node?.id ?? null;
    if (id !== CV.hover){ CV.hover = id; vp.style.cursor = id ? "pointer" : "grab"; }
  });
}

function cvStartPan(e, onClick){
  const vp = $("viewport");
  const sx = e.clientX, sy = e.clientY, ox = view.x, oy = view.y;
  let moved = false;
  vp.classList.add("panning");
  beginViewportMove();
  const mv = (ev)=>{
    if (Math.abs(ev.clientX - sx) > 2 || Math.abs(ev.clientY - sy) > 2) moved = true;
    view.x = ox + (ev.clientX - sx); view.y = oy + (ev.clientY - sy); applyView();
  };
  const up = ()=>{
    window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); vp.classList.remove("panning"); endViewportMoveSoon();
    if (!moved && onClick) onClick();   // 原地点击空白才取消选择；拖动平移不影响选中/高亮
  };
  window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
}
function cvStartNodeDrag(node, e){
  const origin = { x: node.x, y: node.y };
  const sx = e.clientX, sy = e.clientY;
  let moved = false;
  beginInteract();
  const finish = (restore)=>{
    endInteract();
    if (restore){ node.x = origin.x; node.y = origin.y; cvDraw(); return; }
    if (!moved) return;
    commitNodePosition(node.id, { x: node.x, y: node.y });
  };
  startPointerDrag(e, {
    onMove: (ev)=>{
      const dx = (ev.clientX - sx) / view.k, dy = (ev.clientY - sy) / view.k;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
      node.x = Math.round(origin.x + dx); node.y = Math.round(origin.y + dy);
      cvDraw();
    },
    onEnd: ()=> finish(false),
    onAbort: ()=> finish(true),
  });
}
function cvStartGroupDrag({ g, ms }, e){
  const origin = new Map(ms.map((n)=> [n.id, { x: n.x, y: n.y }]));
  const sx = e.clientX, sy = e.clientY;
  beginInteract();
  const mv = (ev)=>{
    const dx = (ev.clientX - sx) / view.k, dy = (ev.clientY - sy) / view.k;
    for (const n of ms){
      const o = origin.get(n.id);
      n.x = Math.round(o.x + dx); n.y = Math.round(o.y + dy);
    }
    g._dragging = true;      // 拖动期间按成员实时包围盒绘制，松手后固化为新 rect
    cvDraw();
  };
  const finish = async (restore)=>{
    endInteract();
    g._dragging = false;
    if (restore){                        // a cancelled pointer puts every member back
      for (const n of ms){ const o = origin.get(n.id); n.x = o.x; n.y = o.y; }
      cvDraw();
      return;
    }
    const n0 = ms[0];
    const dx = n0.x - origin.get(n0.id).x, dy = n0.y - origin.get(n0.id).y;
    if (!dx && !dy){ selectGroup(g.id); return; }   // pointer 未移动 = 点击选中（镜像 beginNodeDrag 的 moved 语义）
    const prevRect = g.rect ? { ...g.rect } : null;
    const rect = groupRectOf(ms);       // same geometry helper as the DOM path
    g.rect = rect;                      // optimistic local sync — the box never redraws at the old rect
    try {
      await api(`/api/graph/${current.id}/group-commit`, { method: "POST",
        body: JSON.stringify({ groupId: g.id, moves: ms.map((n)=> ({ nodeId: n.id, x: n.x, y: n.y })), rect }) });
      toast(t("groupPinned"));
    } catch (err){
      for (const n of ms){ const o = origin.get(n.id); n.x = o.x; n.y = o.y; }
      if (prevRect) g.rect = prevRect; else delete g.rect;
      toast(err.message, true);
    }
    cvDraw();
  };
  startPointerDrag(e, { onMove: mv, onEnd: ()=> finish(false), onAbort: ()=> finish(true) });
}
function cvStartLink(node, e){
  const w0 = cvWorldFromEvent(e);
  pendingLink = { source: node.id, conn: w0, hover: null };
  beginInteract();
  const mv = (ev)=>{
    const w = cvWorldFromEvent(ev);
    pendingLink.conn = w;
    const hit = cvHitNode(w);
    pendingLink.hover = hit && hit.id !== node.id ? hit.id : null;
    cvDraw();
  };
  const up = (ev)=>{
    window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up);
    endInteract();
    const w = cvWorldFromEvent(ev);
    const target = cvHitNode(w);
    if (target && target.id !== node.id){
      createEdge(node.id, target.id);
    } else { toast(t("linkCanceled")); }
    pendingLink = null;
    cvDraw();
  };
  window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
}
function cvMarquee(e){
  const vp = $("viewport"), r = vp.getBoundingClientRect();
  const sx = e.clientX, sy = e.clientY;
  const box = document.createElement("div");
  box.style.cssText = "position:absolute;border:1px dashed var(--accent);background:rgba(56,189,248,.12);border-radius:4px;pointer-events:none;z-index:8";
  vp.appendChild(box);
  const mv = (ev)=>{
    const x1 = Math.min(sx, ev.clientX) - r.left, x2 = Math.max(sx, ev.clientX) - r.left;
    const y1 = Math.min(sy, ev.clientY) - r.top, y2 = Math.max(sy, ev.clientY) - r.top;
    box.style.left = x1 + "px"; box.style.top = y1 + "px";
    box.style.width = (x2 - x1) + "px"; box.style.height = (y2 - y1) + "px";
  };
  const up = (ev)=>{
    window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up);
    box.remove();
    const w1 = cvWorldFromEvent({ clientX: sx, clientY: sy });
    const w2 = cvWorldFromEvent(ev);
    const x1 = Math.min(w1.x, w2.x), x2 = Math.max(w1.x, w2.x), y1 = Math.min(w1.y, w2.y), y2 = Math.max(w1.y, w2.y);
    const hits = current.nodes.filter((n)=>{
      const p = livePos(n);
      return p.x + (n.w ?? 168) >= x1 && p.x <= x2 && p.y + (n._h ?? n.h ?? 64) >= y1 && p.y <= y2;
    }).map((n)=> n.id);
    multiSel = new Set(hits);
    paintMulti();
    toast(hits.length ? t("selNodes").replace("{n}", hits.length) : t("selNone"));
    cvDraw();
  };
  window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
}

/* ================= 视口移动期优化（对齐 canvas 的绘制策略） ================= */
let vmTimer = null;
function beginViewportMove(){
  if (vmTimer){ clearTimeout(vmTimer); vmTimer = null; }
  if (!document.body.classList.contains("viewport-moving")) document.body.classList.add("viewport-moving");
}
function endViewportMoveSoon(){
  if (vmTimer) clearTimeout(vmTimer);
  vmTimer = setTimeout(()=>{ document.body.classList.remove("viewport-moving"); vmTimer = null; }, 160);
}

/* ================= 渲染性能控制（学 canvas 方案：合并帧 + 只在交互期降级） ================= */
let renderQueued = false;
let interacting = 0;

/** 把连续多次 render 请求合并到一帧 */
function scheduleRender(){
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(()=>{ renderQueued = false; render(); });
}

/** 交互开始/结束：交互期关掉最贵的合成（阴影/过渡/副文本） */
function beginInteract(){
  interacting++;
  if (interacting === 1) document.body.classList.add("interacting");
}
function endInteract(){
  interacting = Math.max(0, interacting - 1);
  if (!interacting) document.body.classList.remove("interacting");
}

/** 大图节能：节点多时自动精简装饰（等价于 canvas 方案里减少绘制细节） */
/** The thumbnails toggle is only meaningful when the graph actually carries page images
 *  (imported PDFs), so it stays hidden otherwise instead of adding clutter to the toolbar. */
function applyThumbsAvailability(){
  const btn = $("btnThumbs");
  if (!btn) return;
  const hasImages = (current?.nodes ?? []).some((n)=> (n.attachments ?? []).some((a)=> (a.kind ?? "image") === "image"));
  btn.hidden = !hasImages;
  if (!hasImages && document.body.classList.contains("show-thumbs")){
    document.body.classList.remove("show-thumbs");
    setToggle("btnThumbs", false);
    if (typeof render === "function") render();
  }
}

function applyLeanMode(){
  document.body.classList.toggle("lean", (current?.nodes?.length ?? 0) >= 150);
}



/* ================= 框选（marquee）：Shift+拖拽矩形多选 ================= */
let multiSel = new Set();

function paintMulti(){
  nodesLayer.querySelectorAll(".node").forEach((el)=> el.classList.toggle("sel", multiSel.has(el.dataset.id)));
  const hint = $("multiHint");
  if (!hint) return;
  hint.style.display = multiSel.size > 1 ? "block" : "none";
  hint.textContent = t("multiHint").replace("{n}", multiSel.size);
}
function clearMulti(){ multiSel.clear(); paintMulti(); }

/** 画布空白处 Shift+拖拽 = 框选 */
function bindMarquee(){
  const vp = $("viewport"), box = $("marquee");
  if (!vp || !box) return;
  vp.addEventListener("pointerdown", (e)=>{
    if (!(e.shiftKey || e.metaKey) || e.button !== 0) return;
    if (e.target.closest(".node")) return;          // 节点上不动
    e.preventDefault(); e.stopPropagation();
    const r0 = vp.getBoundingClientRect();
    const sx = e.clientX - r0.left, sy = e.clientY - r0.top;
    box.style.display = "block";
    const draw = (ev)=>{
      const x = ev.clientX - r0.left, y = ev.clientY - r0.top;
      box.style.left = Math.min(sx, x) + "px"; box.style.top = Math.min(sy, y) + "px";
      box.style.width = Math.abs(x - sx) + "px"; box.style.height = Math.abs(y - sy) + "px";
    };
    paintClear();
    const up = (ev)=>{
      window.removeEventListener("pointermove", draw);
      window.removeEventListener("pointerup", up);
      box.style.display = "none";
      const x = ev.clientX - r0.left, y = ev.clientY - r0.top;
      const x1 = Math.min(sx, x), x2 = Math.max(sx, x), y1 = Math.min(sy, y), y2 = Math.max(sy, y);
      if (Math.abs(x2 - x1) < 6 && Math.abs(y2 - y1) < 6){ clearMulti(); return; }
      // 命中判定：节点在画布坐标系下的包围盒与矩形相交
      const hits = [];
      for (const n of current.nodes){
        const p = livePos(n);
        const nx1 = p.x * view.k + view.x, ny1 = p.y * view.k + view.y;
        const nx2 = nx1 + (n.w ?? 168) * view.k, ny2 = ny1 + (n.h ?? 64) * view.k;
        if (nx2 >= x1 && nx1 <= x2 && ny2 >= y1 && ny1 <= y2) hits.push(n.id);
      }
      multiSel = new Set(hits);
      paintMulti();
      toast(hits.length ? t("selNodes").replace("{n}", hits.length) : t("selNone"));
    };
    window.addEventListener("pointermove", draw);
    window.addEventListener("pointerup", up);
  }, true);

  paintClear();
  function paintClear(){ box.style.display = "none"; }

  // Shift+点击节点：切换选中
  nodesLayer.addEventListener("click", (e)=>{
    if (typeof CV !== "undefined" && CV.on) return;
    const card = e.target.closest?.(".node");
    if (!card || !(e.shiftKey || e.metaKey)) return;
    e.preventDefault(); e.stopPropagation();
    const id = card.dataset.id;
    if (multiSel.has(id)) multiSel.delete(id); else multiSel.add(id);
    paintMulti();
  }, true);

  // Esc 取消多选；Delete 删除选中
  document.addEventListener("keydown", (e)=>{
    if (e.key === "Escape" && multiSel.size){ clearMulti(); return; }
    if ((e.key === "Delete" || e.key === "Backspace") && multiSel.size && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA"){
      e.preventDefault();
      const ids = [...multiSel];
      (async ()=>{
        for (const id of ids){ try { await api(`/api/graph/${current.id}/node/${encodeURIComponent(id)}`, { method: "DELETE" }); } catch { /* 逐条忽略 */ } }
        clearMulti(); await reload(false); toast(t("deletedNodes").replace("{n}", ids.length));
      })();
    }
  });
}

/* ================= 跨图链接（单一事实源：<root>/crosslinks.json） ================= */
let xlinks = { items: [], byNode: new Map() };

const xlinkCache = new Map();     // graphId → { items, byNode }
let xlinkLoading = null;

/** 切图时调用一次（带缓存）；渲染路径上绝不调用，否则会形成 render→fetch→render 死循环 */
async function loadCrosslinks(force = false){
  if (!current?.id){ xlinks = { items: [], byNode: new Map() }; return; }
  const gid = current.id;
  if (!force && xlinkCache.has(gid)){ xlinks = xlinkCache.get(gid); return; }
  if (xlinkLoading && xlinkLoading.gid === gid) return xlinkLoading.promise;
  const promise = (async ()=>{
    try {
      const r = await api(`/api/crosslinks?graph=${encodeURIComponent(gid)}`);
    const byNode = new Map();
    for (const it of (r.links ?? [])){
      const key = it.self?.node;
      if (!key) continue;
      if (!byNode.has(key)) byNode.set(key, { provides: [], uses: [] });
      byNode.get(key)[it.view === "provides" ? "provides" : "uses"].push(it);
    }
      const val = { items: r.links ?? [], byNode };
      xlinkCache.set(gid, val);
      if (current?.id === gid) xlinks = val;
    } catch {
      xlinkCache.set(gid, { items: [], byNode: new Map() });
      if (current?.id === gid) xlinks = { items: [], byNode: new Map() };
    }
  })();
  xlinkLoading = { gid, promise };
  await promise;
  xlinkLoading = null;
  if (current?.id === gid) paintXlinkBadges();   // 只补角标，不重绘整图
}

/** 原地补角标：只改受影响的卡片内节点，避免整图重排 */
function paintXlinkBadges(){
  nodesLayer.querySelectorAll(".node").forEach((el)=>{
    const id = el.dataset.id;
    const label = el.querySelector(".nlabel");
    if (!label) return;
    const old = label.querySelector(".xlink");
    const html = xlinkBadgeHtml(id);
    if (!html){ old?.remove(); return; }
    if (old){ old.outerHTML = html; return; }
    label.insertAdjacentHTML("beforeend", " " + html);
  });
}

/** 跳到对端图的某个节点（深链已支持 #图id/节点id） */
function jumpToLink(it){
  const g = it.other?.graph, n = it.other?.node;
  if (!g || !n) return;
  location.hash = `#${encodeURIComponent(g)}/${encodeURIComponent(n)}`;
}

/** 卡片上的角标 HTML */
function xlinkBadgeHtml(nodeId){
  const hit = xlinks.byNode.get(nodeId);
  if (!hit) return "";
  const parts = [];
  if (hit.provides.length) parts.push(`<span class="xlink provides" data-x="provides" title="${t("xlinkBadgeProvides").replace("{n}", hit.provides.length)}">↗${hit.provides.length}</span>`);
  if (hit.uses.length) parts.push(`<span class="xlink uses" data-x="uses" title="${t("xlinkBadgeUses").replace("{n}", hit.uses.length)}">↘${hit.uses.length}</span>`);
  return parts.join("");
}




/* ================= 只读模式：用户不可手动改，只能改文件或由 AI 改 ================= */
/* 说明：输入元素保留（AI / API 仍可写），但用户侧只读——避免误改破坏卡片数据 */
function applyReadOnly(){
  return;   // 产品化：用户需要能直接编辑，只读模式已停用（保留函数以备将来"演示模式"复用）
  // eslint-disable-next-line no-unreachable
  document.body.classList.add("readonly");
  const ids = ["n-label", "n-id", "n-x", "n-y", "n-w", "n-h", "n-note", "n-status", "n-type", "n-shape", "n-icon", "n-fill", "n-border", "n-textcolor", "n-edge-label", "n-edge-note", "e-from", "e-to", "e-type"];
  for (const id of ids){
    const el = $(id);
    if (!el) continue;
    if (el.tagName === "SELECT"){ el.disabled = true; continue; }
    el.readOnly = true;
    el.setAttribute("tabindex", "-1");
  }
  // 隐藏「保存 / 删除 / 加附件 / 改标题」这类手动编辑入口
  // Attaching a file adds content rather than editing the graph, so it stays available in read-only mode.
  for (const id of ["n-save", "n-delete", "e-save", "e-delete"]){
    const el = $(id);
    if (el) el.style.display = "";
  }
}

/* ================= 检查器：上身/下游可点击列表（与画布高亮同源） ================= */
function renderDepList(node){
  const box = $("depBox");
  if (!box) return;
  if (!node || !depFocus){ box.hidden = true; box.innerHTML = ""; return; }
  const pick = (set)=> [...set].map((id)=> nodeById(id)).filter(Boolean);
  const up = pick(depFocus.up), down = pick(depFocus.down);
  const chip = (n, cls)=> `<span class="dep ${cls}" data-node="${escapeHtml(n.id)}" title="${escapeHtml(String(n.label))} · ${escapeHtml(n.id)}" style="${cls === "up" ? "border-color:#38BDF8;color:#38BDF8" : "border-color:#F87171;color:#F87171"}">${escapeHtml(String(n.label).slice(0, 26))}</span>`;
  box.hidden = false;
  const CAP = 6;   // 默认只显示 6 条，其余折叠（20+ chip 会把详情挤出屏幕）
  const seg = (list, cls, label)=>{
    if (!list.length) return '';
    const shown = list.slice(0, CAP), rest = list.length - shown.length;
    return `<div class="card-deps" style="margin-top:6px"><span class="dlab">${label}</span>`
      + shown.map((n)=> chip(n, cls)).join("")
      + (rest > 0 ? `<span class="dep more" data-more="${cls}">+${rest} 展开</span>` : "")
      + `</div>`
      + (rest > 0 ? `<div class="card-deps dep-rest" data-rest="${cls}" hidden>${list.slice(CAP).map((n)=> chip(n, cls)).join("")}</div>` : '');
  };
  box.innerHTML = seg(up, "up", t("depUpstream")) + seg(down, "down", t("depDownstream"));
  box.querySelectorAll(".dep.more").forEach((el)=>{
    el.onclick = ()=>{
      const cls = el.dataset.more;
      const rest = box.querySelector(`.dep-rest[data-rest="${cls}"]`);
      if (rest){ rest.hidden = !rest.hidden; el.textContent = rest.hidden ? t("depMore").replace("{n}", rest.children.length) : t("depLess"); }
    };
  });
  box.querySelectorAll(".dep").forEach((el)=>{
    el.onclick = ()=>{
      const id = el.dataset.node;
      select("node", id);
      focusNode(nodeById(id));
      box.querySelectorAll(".dep").forEach((x)=> x.classList.toggle("on", x.dataset.node === id));
    };
  });
}





/* ================= 公式规则（内置帮助） ================= */
const FX_RULES = {
  zh: [
    ["四种定界符", "$行内$ · $$独占一行$$ · \\(行内\\) · \\[独占一行\\]"],
    ["不用定界符也能编译", "整行是公式 → 自动当显示公式；行内出现 \\ce{...} \\frac{...} 等命令 → 只把该段当公式；粘贴整篇论文源码 → 自动剥掉导言区"],
    ["会自动转换（不用手改）", "\\tag{1.2}→（1.2）文本 · \\bm→\\boldsymbol · \\cite→[key] · \\eqref/\\ref→文本 · \\SI{9.8}{\\meter\\per\\second\\squared}→9.8 m/s² · align/gather→aligned/gathered（保留对齐）· \\documentclass/\\usepackage/% 注释→删除"],
    ["化学式", "\\ce{2H2 + O2 -> 2H2O} · \\ce{SO4^2- + Ba^2+ -> BaSO4 v}"],
    ["不支持（降级显示原文，不丢内容）", "tikzpicture / figure / table / lstlisting → 显示占位提示；\\includegraphics → 删除（图片请用「＋ 附件」上传）；自定义宏（\\newcommand）无法展开"],
    ["编译不出来先查这 5 条", "① 花括号是否配对 ② 是否用了自定义宏 ③ 是否在 $ 里又写了 $ ④ x_ 后面是否紧跟内容 ⑤ 行内的 \\tag 建议改用 $$…$$"],
    ["写错了会怎样", "该公式原样显示，并标 ⚠ LaTeX 未渲染（原文保留）——内容绝不丢失，照规则改即可"],
  ],
  en: [
    ["Four delimiters", "$inline$ · $$display$$ · \\(inline\\) · \\[display\\]"],
    ["Bare LaTeX also compiles", "a whole line of LaTeX becomes a display formula; inline commands like \\ce{...} \\frac{...} are extracted from prose; pasting a full paper source auto-strips the preamble"],
    ["Auto-normalised (no edits needed)", "\\tag{1.2}→(1.2) text · \\bm→\\boldsymbol · \\cite→[key] · \\eqref/\\ref→text · \\SI{9.8}{\\meter\\per\\second\\squared}→9.8 m/s² · align/gather→aligned/gathered · \\documentclass/\\usepackage/% comments→removed"],
    ["Chemistry", "\\ce{2H2 + O2 -> 2H2O} · \\ce{SO4^2- + Ba^2+ -> BaSO4 v}"],
    ["Not supported (degrades to source, nothing lost)", "tikzpicture / figure / table / lstlisting → placeholder; \\includegraphics → removed (use the ＋ Attach button); custom \\newcommand macros cannot be expanded"],
    ["Top 5 causes of failure", "1) unbalanced braces 2) macros defined by \\newcommand 3) nested $ 4) x_ with nothing after it 5) \\tag inside inline $…$ — prefer $$…$$"],
    ["What if it fails", "the formula is shown verbatim with a ⚠ LaTeX not rendered (source kept) marker — nothing is lost"],
  ],
};

function openFxHelp(){
  const rows = FX_RULES[LANG] ?? FX_RULES.zh;
  openModal(`<h2>${LANG === "en" ? "Formula rules" : "公式书写规则"}</h2>
    <div class="fx-help">
      ${rows.map(([h, b])=> `<div class="fx-row"><b>${escapeHtml(h)}</b><span>${escapeHtml(b)}</span></div>`).join("")}
    </div>
    <div class="hint" style="margin-top:8px">${LANG === "en"
      ? "Full reference: docs/FORMULAS.md in the repository."
      : "完整说明见仓库内 docs/FORMULAS.md。"}</div>
    <div class="btnrow"><button class="primary" id="fx-close">${LANG === "en" ? "Got it" : "知道了"}</button></div>`);
  $("fx-close").onclick = closeModal;
}

/* ================= 跨图依赖（用户级：选图 + 搜节点 + 写理由） ================= */
let xlinkDialogTarget = null;

async function openXlinkDialog(node){
  xlinkDialogTarget = node;
  let list = [];
  try { list = await api("/api/graphs"); } catch { list = []; }
  const others = (Array.isArray(list) ? list : []).filter((g)=> g.id !== current.id);
  openModal(`<h2>链接到其他图</h2>
    <div class="hint" style="margin:0 0 8px">源节点：<b>${escapeHtml(String(node.label).slice(0, 40))}</b>（${escapeHtml(node.id)}）</div>
    <label>目标图</label>
    <select id="xl-graph">${others.map((g)=> `<option value="${escapeHtml(g.id)}">${escapeHtml(g.name ?? g.id)}</option>`).join("")}</select>
    <label>搜索目标节点</label>
    <input id="xl-q" data-ph="xlinkFilterPh" autocomplete="off">
    <div id="xl-nodes" class="xl-nodes"></div>
    <label data-i18n="xlinkWhyLabel"></label>
    <textarea id="xl-why" rows="3" data-ph="xlinkWhyPh"></textarea>
    <div class="row2" style="margin-top:6px">
      <div><label>方向</label><select id="xl-dir">
        <option value="to">我依赖对方（对方是依据）</option>
        <option value="from">对方依赖我（我提供依据）</option>
      </select></div>
      <div></div>
    </div>
    <div class="btnrow"><button class="primary" id="xl-save" data-i18n="xlinkCreate"></button><button id="xl-cancel" data-i18n="cancel"></button></div>`);
  $("xl-cancel").onclick = closeModal;
  const loadNodes = async ()=>{
    const gid = $("xl-graph").value;
    const q = $("xl-q").value.trim().toLowerCase();
    let g = null;
    try { g = await api(`/api/graph/${encodeURIComponent(gid)}`); } catch { g = null; }
    const nodes = (g?.nodes ?? []).filter((n)=> !q || `${n.label} ${n.id}`.toLowerCase().includes(q));
    $("xl-nodes").innerHTML = nodes.length
      ? nodes.slice(0, 60).map((n)=> `<span class="xl-node" data-id="${escapeHtml(n.id)}"><b>${escapeHtml(String(n.label).slice(0, 34))}</b><i>${escapeHtml(n.id)}</i></span>`).join("")
      : `<div class="dep-none">${t("xlinkNoMatch")}</div>`;
    $("xl-nodes").querySelectorAll(".xl-node").forEach((el)=>{
      el.onclick = ()=>{
        $("xl-nodes").querySelectorAll(".xl-node").forEach((x)=> x.classList.remove("on"));
        el.classList.add("on");
      };
    });
  };
  $("xl-graph").onchange = loadNodes;
  $("xl-q").addEventListener("input", ()=>{ clearTimeout(window.__xlT); window.__xlT = setTimeout(loadNodes, 180); });
  await loadNodes();
  $("xl-save").onclick = async ()=>{
    const gid = $("xl-graph").value;
    const pick = $("xl-nodes").querySelector(".xl-node.on");
    if (!pick){ toast(t("xlinkPickNode"), true); return; }
    const why = $("xl-why").value.trim();
    if (!why){ toast(t("xlinkNeedWhy"), true); return; }
    const body = $("xl-dir").value === "to"
      ? { fromGraph: gid, fromNode: pick.dataset.id, toGraph: current.id, toNode: node.id, why }
      : { fromGraph: current.id, fromNode: node.id, toGraph: gid, toNode: pick.dataset.id, why };
    try {
      await api("/api/crosslinks", { method: "POST", body: JSON.stringify(body) });
      closeModal();
      xlinkCache.clear();
      await loadCrosslinks(true);
      renderXlinks(node);
      render();
      toast(t("xlinkCreated"));
    } catch (e){ toast(e.message, true); }
  };
}

/** 检查器：跨图依赖区（友好名称 + 跳转 + 删除 + 失效提示） */
function renderXlinks(node){
  const box = $("xlinkBox");
  if (!box) return;
  const hit = node ? xlinks.byNode.get(node.id) : null;
  if (!node){ box.hidden = true; return; }
  box.hidden = false;
  const rows = hit
    ? [...hit.uses.map((it)=> ({ ...it, dir: t("xlinkDirUses") })), ...hit.provides.map((it)=> ({ ...it, dir: t("xlinkDirProvides") }))]
    : [];
  box.innerHTML = `<div class="insp-sec-head" style="margin-top:10px">
      <label>跨图依赖（${rows.length}）</label>
      <button class="mini" id="xlAdd" data-i18n="xlinkAdd"></button>
    </div>`
    + (rows.length ? `<div class="xlink-list">${rows.map((it, i)=> `
        <div class="xlink-item ${it.broken ? "broken" : ""}" data-i="${i}">
          <div class="h">
            <span class="badge">${escapeHtml(it.dir)}</span>
            <b>${escapeHtml(it.otherGraphName ?? it.other.graph)}</b>
            <span class="xdel" data-del="${escapeHtml(it.id)}" title="${t("xlinkDelTitle")}">✕</span>
          </div>
          <div class="t">${it.broken ? `<i>${t("xlinkBroken")}</i>` : escapeHtml(String(it.otherNodeLabel ?? it.other.node).slice(0, 46))}</div>
          ${it.why ? `<div class="why">${escapeHtml(String(it.why).slice(0, 200))}</div>` : ""}
        </div>`).join("")}</div>`
      : '<div class="dep-none" style="margin:4px 0 8px">${t("xlinkNone")}</div>');
  $("xlAdd").onclick = ()=> openXlinkDialog(node);
  box.querySelectorAll(".xlink-item").forEach((el)=>{
    el.onclick = (ev)=>{
      if (ev.target.closest(".xdel")) return;
      const it = rows[Number(el.dataset.i)];
      if (it.broken){ toast(t("xlinkBrokenHint"), true); return; }
      location.hash = `#${encodeURIComponent(it.other.graph)}/${encodeURIComponent(it.other.node)}`;
    };
  });
  box.querySelectorAll(".xdel").forEach((el)=>{
    el.onclick = async (ev)=>{
      ev.stopPropagation();
      try {
        await api(`/api/crosslinks?id=${encodeURIComponent(el.dataset.del)}`, { method: "DELETE" });
        xlinkCache.clear();
        await loadCrosslinks(true);
        renderXlinks(node);
        render();
        toast(t("xlinkRemoved"));
      } catch (e){ toast(e.message, true); }
    };
  });
}

/* ================= 节点附件（原书页面图 / PDF / 外链） ================= */
let lbState = null;   // { list, idx, k, x, y }

function openLightbox(list, idx){
  closeLightbox();
  const box = document.createElement("div");
  box.className = "lightbox"; box.id = "lightbox";
  box.innerHTML = `<div class="lb-bar">
      <span id="lb-title"></span>
      <span style="margin-left:auto"></span>
      <button id="lb-prev">‹ 上一张</button>
      <button id="lb-next">下一张 ›</button>
      <button id="lb-zoomout">−</button>
      <button id="lb-zoomin">+</button>
      <button id="lb-fit">适应</button>
      <button id="lb-open">原文件</button>
      <button id="lb-close" data-i18n="readerClose"></button>
    </div>
    <div class="lb-stage" id="lb-stage"><img id="lb-img" alt=""></div>
    <div class="lb-cap" id="lb-cap"></div>`;
  document.body.appendChild(box);
  lbState = { list, idx, k: 1, x: 0, y: 0 };
  const stage = $("lb-stage"), img = $("lb-img");
  const srcOf = (a)=> /^https?:|^data:/i.test(a.src) ? a.src : `/api/graph/${encodeURIComponent(current.id)}/asset/${encodeURIComponent(String(a.src).replace(/^assets\//, ""))}`;
  const draw = ()=>{
    const a = lbState.list[lbState.idx];
    img.src = srcOf(a);
    img.style.transform = `translate(${lbState.x}px, ${lbState.y}px) scale(${lbState.k})`;
    $("lb-title").textContent = a.label || a.src;
    $("lb-cap").textContent = `${lbState.idx + 1}/${lbState.list.length}${a.page ? ` · ${t("pageN").replace("{n}", a.page)}` : ""}${a.caption ? " · " + a.caption : ""}`;
  };
  img.onload = ()=>{
    const r = stage.getBoundingClientRect();
    lbState.k = Math.min(1, (r.width - 40) / img.naturalWidth, (r.height - 40) / img.naturalHeight);
    lbState.x = 20; lbState.y = 20;
    img.style.width = img.naturalWidth + "px";
    draw();
  };
  stage.addEventListener("wheel", (e)=>{
    e.preventDefault();
    const r = stage.getBoundingClientRect(), cx = e.clientX - r.left, cy = e.clientY - r.top;
    const nk = Math.min(6, Math.max(0.1, lbState.k * Math.exp(-e.deltaY * 0.0015)));
    lbState.x = cx - (cx - lbState.x) * (nk / lbState.k);
    lbState.y = cy - (cy - lbState.y) * (nk / lbState.k);
    lbState.k = nk; draw();
  }, { passive: false });
  stage.addEventListener("pointerdown", (e)=>{
    if (e.button !== 0) return;
    e.preventDefault(); stage.classList.add("panning");
    const sx = e.clientX, sy = e.clientY, ox = lbState.x, oy = lbState.y;
    const mv = (ev)=>{ lbState.x = ox + (ev.clientX - sx); lbState.y = oy + (ev.clientY - sy); draw(); };
    const up = ()=>{ window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); stage.classList.remove("panning"); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  });
  const go = (d)=>{ lbState.idx = (lbState.idx + d + lbState.list.length) % lbState.list.length; lbState.k = 0; img.onload(); };
  $("lb-prev").onclick = ()=>go(-1);
  $("lb-next").onclick = ()=>go(1);
  $("lb-zoomin").onclick = ()=>{ lbState.k = Math.min(6, lbState.k * 1.25); draw(); };
  $("lb-zoomout").onclick = ()=>{ lbState.k = Math.max(0.1, lbState.k / 1.25); draw(); };
  $("lb-fit").onclick = ()=>{ lbState.k = 0; img.onload(); };
  $("lb-open").onclick = ()=>{ const a = lbState.list[lbState.idx]; window.open(srcOf(a), "_blank"); };
  $("lb-close").onclick = closeLightbox;
  box.addEventListener("click", (e)=>{ if (e.target === box) closeLightbox(); });
  draw();
}
function closeLightbox(){ $("lightbox")?.remove(); lbState = null; }
document.addEventListener("keydown", (e)=>{
  if (!lbState) return;
  if (e.key === "Escape") closeLightbox();
  else if (e.key === "ArrowLeft") $("lb-prev").click();
  else if (e.key === "ArrowRight") $("lb-next").click();
});

/** 检查器里的附件区：缩略图 + 添加/移除 */
function renderAttachments(node){
  const box = $("attachBox");
  if (!box) return;
  const list = node?.attachments ?? [];
  const srcOf = (a)=> /^https?:|^data:/i.test(a.src) ? a.src : `/api/graph/${encodeURIComponent(current.id)}/asset/${encodeURIComponent(String(a.src).replace(/^assets\//, ""))}`;
  box.innerHTML = list.length ? `<div class="attach-strip">${list.map((a, i)=> {
    const isImg = a.kind === "image" || a.kind === "page" || /\.(png|jpe?g|gif|webp|svg)$/i.test(a.src);
    const label = escapeHtml(a.label || a.src.split("/").pop() || "");
    return isImg
      ? `<div class="attach-thumb" data-i="${i}" title="${label}"><img src="${srcOf(a)}" alt=""><span class="tag">${a.page ? "p." + a.page : label.slice(0, 10)}</span></div>`
      : `<span class="attach-chip" data-i="${i}">📄 ${label.slice(0, 22)}</span>`;
  }).join("")}</div>` : `<div style="font-size:11px;color:var(--text-dim)">${t("attachNoAttach")}</div>`;
  box.querySelectorAll(".attach-thumb,.attach-chip").forEach((el)=>{
    el.onclick = ()=> openLightbox(list, Number(el.dataset.i));
  });
}

/** 添加附件：本地路径或 URL（本地文件由服务端复制进图资源目录） */
async function addAttachment(nodeId){
  // 用户级：直接选文件（或拖入），不需要知道路径
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*,application/pdf";
  input.multiple = true;
  input.onchange = async ()=>{
    const files = [...(input.files ?? [])];
    if (!files.length) return;
    toast(t("attachAdding").replace("{n}", files.length));
    for (const f of files){
      try {
        const dataUrl = await new Promise((res, rej)=>{
          const rd = new FileReader();
          rd.onload = ()=> res(rd.result);
          rd.onerror = rej;
          rd.readAsDataURL(f);
        });
        const up = await api(`/api/graph/${current.id}/upload`, { method: "POST", body: JSON.stringify({ name: f.name, dataUrl }) });
        await api(`/api/graph/${current.id}/attach`, { method: "POST", body: JSON.stringify({
          nodeId, src: up.src, kind: /pdf$/i.test(f.name) ? "pdf" : "image",
          label: f.name, caption: "", mode: "append",
        }) });
      } catch (e){ toast(t("attachFailed").replace("{name}", f.name).replace("{msg}", e.message), true); }
    }
    await reload(false);
    toast(t("attachAdded"));
  };
  input.click();
}

/** 拖文件到检查器的附件区即可添加 */
/** Upload files and attach them to the selected card. One implementation, used by both the
 *  drop zone and the "＋ Attach" button. */
async function uploadFiles(files){
  const list = [...(files ?? [])];
  if (!list.length) return;
  if (selected?.kind !== "node"){ toast(t("attachPickNode"), true); return; }
  toast(t("attachAdding").replace("{n}", list.length));
  for (const f of list){
    const dataUrl = await new Promise((res)=>{
      const rd = new FileReader(); rd.onload = ()=> res(rd.result); rd.readAsDataURL(f);
    });
    const up = await api(`/api/graph/${current.id}/upload`, { method: "POST", body: JSON.stringify({ name: f.name, dataUrl }) });
    await api(`/api/graph/${current.id}/attach`, { method: "POST", body: JSON.stringify({ nodeId: selected.id, src: up.src, kind: "image", label: f.name, mode: "append" }) });
  }
  await reload(false);
  toast(t("attachAdded"));
}

function bindAttachmentDrop(){
  const box = $("attachBox");
  const addBtn = $("attachAdd");
  if (addBtn && !addBtn._pickBound){
    addBtn._pickBound = true;
    addBtn.addEventListener("click", ()=>{
      if (selected?.kind !== "node"){ toast(t("attachPickNode"), true); return; }
      const picker = document.createElement("input");
      picker.type = "file";
      picker.accept = "image/*,application/pdf";
      picker.multiple = true;
      picker.style.display = "none";
      picker.addEventListener("change", ()=>{ uploadFiles(picker.files); picker.remove(); });
      document.body.appendChild(picker);
      picker.click();
    });
  }
  if (!box || box._dropBound) return;
  box._dropBound = true;
  box.addEventListener("dragover", (e)=>{ e.preventDefault(); box.style.outline = "2px dashed var(--accent)"; });
  box.addEventListener("dragleave", ()=>{ box.style.outline = ""; });
  box.addEventListener("drop", async (e)=>{
    e.preventDefault(); box.style.outline = "";
    uploadFiles(e.dataTransfer?.files);
  });
}

/* ================= 撤销 / 重做（用户级必备） ================= */
const history = { undo: [], redo: [], limit: 60, pending: null };

function snapshotState(){
  if (!current) return null;
  // 护栏：图还没加载完（0 节点）时不留快照，否则撤销会把内容清空
  if (!(current.nodes?.length > 0)) return null;
  return JSON.stringify({
    name: current.name, description: current.description ?? "", direction: current.direction,
    nodes: current.nodes, edges: current.edges, groups: current.groups ?? [], notes: current.notes ?? {},
    conversation: current.conversation ?? null,
  });
}
/** 每次「会改动图」的请求前，记一份当前状态 */
function pushHistory(){
  const snap = snapshotState();
  if (!snap) return;
  if (history.undo[history.undo.length - 1] === snap) return;
  history.undo.push(snap);
  if (history.undo.length > history.limit) history.undo.shift();
  history.redo.length = 0;
}
async function undo(){
  if (!history.undo.length){ toast(t("undoEmpty")); return; }
  const now = snapshotState();
  const prev = history.undo.pop();
  history.redo.push(now);
  await applySnapshot(prev, t("undoDone"));
}
async function redo(){
  if (!history.redo.length){ toast(t("redoEmpty")); return; }
  const now = snapshotState();
  const next = history.redo.pop();
  history.undo.push(now);
  await applySnapshot(next, t("redoDone"));
}
async function applySnapshot(snap, tip){
  // 护栏：目标快照无节点而当前有内容 → 拒绝（防误清空）
  try {
    const obj = JSON.parse(snap);
    if (!(obj.nodes?.length > 0) && (current?.nodes?.length ?? 0) > 0){ toast(t("blockedWipe"), true); return; }
  } catch { toast(t("snapCorrupt"), true); return; }
  try {
    await api(`/api/graph/${current.id}/replace`, { method: "POST", body: JSON.stringify({ graph: JSON.parse(snap) }) });
    await reload(false);
    toast(tip);
  } catch (e){ toast(t("opFailed").replace("{msg}", e.message), true); }
}

/** 包装 api：凡是对图的写操作，先记历史 */
function installHistory(){
  if (window.__histInstalled) return;
  window.__histInstalled = true;
  const orig = api;
  window.api = async function(path, options){
    const isMutation = options && ["POST", "PUT", "PATCH", "DELETE"].includes(String(options.method ?? "GET").toUpperCase());
    const isGraphWrite = typeof path === "string" && /\/api\/graph\//.test(path)
      && !/\/(position|upload|replace|convo\?view)/.test(path);   // 纯坐标/上传不记历史
    if (isMutation && isGraphWrite) pushHistory();
    return orig.apply(this, arguments);
  };
  document.addEventListener("keydown", (e)=>{
    const tag = String(e.target?.tagName ?? "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z"){ e.preventDefault(); e.shiftKey ? redo() : undo(); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y"){ e.preventDefault(); redo(); }
  });
}



/* ================= 点击运行的对话流程（右键菜单 + 会话操作） ================= */
function closeCtxMenu(){ document.getElementById("ctxmenu")?.remove(); }

/** 节点右键菜单：会话操作 + 通用操作，全部点击完成 */
function openNodeMenu(node, x, y){
  closeCtxMenu();
  const menu = document.createElement("div");
  menu.className = "ctxmenu"; menu.id = "ctxmenu";
  const isConvoNode = isConvo();
  const statuses = [["done", t("stDone")], ["running", t("stRunning")], ["pending", t("stPending")], ["waiting-human", t("stWaiting")], ["failed", t("stFailed")]];
  menu.innerHTML = `
    <div class="cm-title">${escapeHtml(String(node.label).slice(0, 34))}</div>
    ${isConvoNode ? `
      <button data-a="continue">${t("menuContinue")}<kbd>Enter</kbd></button>
      <button data-a="branch">${t("menuBranch")}</button>
      <button data-a="merge">${t("menuMerge")}</button>
      <div class="cm-sub">${t("menuMarkStatus")}</div>
      <div class="cm-row">${statuses.map(([v, l])=> `<button data-s="${v}">${l}</button>`).join("")}</div>
      <hr>` : ""}
    <button data-a="attach">${t("menuAttach")}</button>
    <button data-a="xlink">${t("menuXlink")}</button>
    <button data-a="rename">${t("menuRename")}</button>
    <button data-a="branchFrom">${t("menuInsertTurn")}</button>
    <button data-a="trace">${t("menuTrace")}</button>
    <hr>
    <button data-a="delete" style="color:var(--danger)">${t("menuDeleteNode")}</button>`;
  document.body.appendChild(menu);
  // 边界收敛
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.min(x, window.innerWidth - r.width - 8) + "px";
  menu.style.top = Math.min(y, window.innerHeight - r.height - 8) + "px";

  const post = async (body)=>{
    try { await api(`/api/graph/${current.id}/convo`, { method: "POST", body: JSON.stringify(body) }); await reload(false); }
    catch (e){ toast(e.message, true); }
  };
  menu.querySelectorAll("button").forEach((b)=>{
    b.onclick = async ()=>{
      const a = b.dataset.a, st = b.dataset.s;
      closeCtxMenu();
      if (st){ await post({ op: "resolve", nodeId: node.id, status: st }); toast(t("statusUpdated")); return; }
      if (a === "continue"){ await post({ op: "branch", nodeId: node.id }); toast(t("headSet")); return; }
      if (a === "branch" || a === "branchFrom"){ recordTurnAt(node.id, a === "branch"); return; }
      if (a === "merge"){
        const sel = [...multiSel];
        const sources = sel.length >= 2 ? sel : (convo?.leaves ?? []);
        if (sources.length < 2){ toast(t("needBranches"), true); return; }
        await post({ op: "merge", sources, label: t("mergeLabel") }); toast(t("mergedDone")); return;
      }
      if (a === "attach"){ addAttachment(node.id); return; }
      if (a === "xlink"){ openXlinkDialog(node); return; }
      if (a === "rename"){
        const v = prompt(t("renamePrompt"), node.label);
        if (v != null){ await api(`/api/graph/${current.id}/node`, { method: "POST", body: JSON.stringify({ nodeId: node.id, patch: { label: v } }) }).catch(()=>{}); await reload(false); }
        return;
      }
      if (a === "trace"){ runAnalysis(node.id); return; }
      if (a === "delete"){ removeNode(node.id); return; }
    };
  });
  setTimeout(()=>{
    const off = (e)=>{ if (!menu.contains(e.target)){ closeCtxMenu(); document.removeEventListener("pointerdown", off, true); } };
    document.addEventListener("pointerdown", off, true);
  }, 0);
}

/** Speaker field shared by both "add a turn" dialogs (was duplicated markup in two places). */
function speakerField(){
  const agents = (current.conversation?.agents ?? []).map((a)=> a.name);
  return `<label>${t("turnSpeaker")}</label>
    <input id="turn-agent" list="turn-agents" placeholder="${t("turnSpeakerPh")}">
    <datalist id="turn-agents">${agents.map((n)=> `<option value="${escapeHtml(n)}">`).join("")}</datalist>`;
}

/** 在指定节点之后记录一轮（分叉 or 顺接） */
function recordTurnAt(parentId, fork){
  openModal(`<h2>${fork ? t("turnForkTitle") : t("turnInsertTitle")}</h2>
    ${speakerField()}
    <label>${t("turnContent")}</label>
    <textarea id="turn-text" style="min-height:130px" placeholder="${t("turnContentPh")}"></textarea>
    <div class="btnrow"><button class="primary" id="turn-save">${t("turnRecord")}</button><button id="turn-cancel" data-i18n="cancel"></button></div>`);
  $("turn-cancel").onclick = closeModal;
  $("turn-save").onclick = async ()=>{
    const text = $("turn-text").value;
    if (!text.trim()){ toast(t("turnContentEmpty"), true); return; }
    const speaker = $("turn-agent").value.trim() || "user";
    try {
      await api(`/api/graph/${current.id}/convo`, { method: "POST", body: JSON.stringify({
        op: "record", agent: speaker, text, status: "done", type: "turn", parentId,
        edgeType: fork ? "branches" : "follows",
      }) });
      closeModal(); await reload(false); toast(fork ? t("turnForked") : t("turnInserted"));
    } catch (e){ toast(e.message, true); }
  };
}

/** 检查器里的会话操作条（选中会话节点时出现） */
function renderConvoActions(node){
  const wrap = $("convoActions"), row = $("convoActionsRow"), meta = $("convoMeta");
  if (!wrap) return;
  if (!isConvo() || !node){ wrap.hidden = true; return; }
  wrap.hidden = false;
  const tags = (node.tags ?? []).map(String);
  const pick = (p)=> tags.find((t)=> t.startsWith(p))?.slice(p.length) ?? "";
  const role = pick("role:") || pick("speaker:") || "—";
  const status = pick("status:") || node.status || "—";
  const turn = pick("turn:") || "—";
  const isHead = convo?.head === node.id;
  const onMain = convo?.mainline?.has(node.id);
  meta.innerHTML = `<span>${t("convoRole")} <b>${escapeHtml(role)}</b></span><span>${t("turnStatus")} <b>${escapeHtml(status)}</b></span><span>${t("convoTurnN")} <b>${escapeHtml(turn)}</b></span>${isHead ? `<span style="color:var(--ok)">${t("convoIsHead")}</span>` : onMain ? `<span>${t("convoMain")}</span>` : `<span style="color:var(--warn)">${t("convoOff")}</span>`}`;
  row.innerHTML = `
    <button data-a="continue" class="primary">${t("actContinue")}</button>
    <button data-a="branch">${t("actBranch")}</button>
    <button data-a="merge">${t("actMerge")}</button>
    <button data-a="done">${t("actDone")}</button>
    <button data-a="attach">${t("actAttach")}</button>
    <button data-a="locate">${t("actLocate")}</button>`;
  const post = async (body)=>{ try { await api(`/api/graph/${current.id}/convo`, { method: "POST", body: JSON.stringify(body) }); await reload(false); } catch (e){ toast(e.message, true); } };
  row.querySelectorAll("button").forEach((b)=>{
    b.onclick = async ()=>{
      const a = b.dataset.a;
      if (a === "continue"){ await post({ op: "branch", nodeId: node.id }); toast(t("headSet")); }
      else if (a === "branch"){ recordTurnAt(node.id, true); }
      else if (a === "merge"){
        const sel = [...multiSel];
        const sources = sel.length >= 2 ? sel : (convo?.leaves ?? []);
        if (sources.length < 2){ toast(t("needBranches"), true); return; }
        await post({ op: "merge", sources, label: t("mergeLabel") }); toast(t("mergedDone"));
      }
      else if (a === "done"){ await post({ op: "resolve", nodeId: node.id, status: "done" }); toast(t("markedDone")); }
      else if (a === "attach"){ addAttachment(node.id); }
      else if (a === "locate"){ focusNode(node); }
    };
  });
}

/** 右键绑定（在 renderNodes 里已创建卡片，这里统一事件委托） */
if (!window.__ctxBound){
  window.__ctxBound = true;
  document.addEventListener("contextmenu", (e)=>{
    const card = e.target.closest?.(".node");
    if (!card) return;
    e.preventDefault();
    const id = card.dataset.id;
    const node = current?.nodes.find((n)=> n.id === id);
    if (!node) return;
    select("node", id);
    openNodeMenu(node, e.clientX, e.clientY);
  });
  document.addEventListener("keydown", (e)=>{ if (e.key === "Escape") closeCtxMenu(); });
}

/* ================= 非线性对话 UI（DAG 会话） ================= */
let convo = null;                       // { head, mainline:Set, leaves:[], children:Map, parents:Map }
const isConvo = ()=> !!current?.conversation?.mode;

/** 计算对话视图：head、根→head 主线、开放分支（叶子）、父子索引 */
function computeConvo(){
  if (!isConvo()){ convo = null; return; }
  const children = new Map(), parents = new Map();
  for (const e of current.edges){
    if (!children.has(e.source)) children.set(e.source, []);
    children.get(e.source).push(e.target);
    if (!parents.has(e.target)) parents.set(e.target, []);
    parents.get(e.target).push(e.source);
  }
  const head = current.conversation.head ?? null;
  const mainline = new Set();
  let cur = head; const guard = new Set();
  while (cur && !guard.has(cur)){ guard.add(cur); mainline.add(cur); cur = (parents.get(cur) ?? [])[0] ?? null; }
  const leaves = current.nodes.filter((n)=> !(children.get(n.id) ?? []).length).map((n)=> n.id);
  convo = { head, mainline, leaves, children, parents };
}

/** 画布视觉：head 绿框、主线高亮、离支变淡、分叉点加兄弟导航 */
function applyConvoToCanvas(){
  if (!convo) return;
  nodesLayer.querySelectorAll(".sibnav").forEach((el)=> el.remove());
  nodesLayer.querySelectorAll(".node").forEach((el)=>{
    const id = el.dataset.id;
    el.classList.toggle("convo-head", id === convo.head);
    el.classList.toggle("convo-main", convo.mainline.has(id));
    el.classList.toggle("convo-off", !!convo.head && !convo.mainline.has(id));
    const kids = convo.children.get(id) ?? [];
    if (kids.length > 1){
      const nav = document.createElement("div");
      nav.className = "sibnav";
      const label = document.createElement("span");
      const cur = selected?.kind === "node" && kids.includes(selected.id) ? kids.indexOf(selected.id) : 0;
      label.textContent = `${cur + 1}/${kids.length}`;
      const prev = document.createElement("button"); prev.textContent = "‹";
      const next = document.createElement("button"); next.textContent = "›";
      let pos = cur;
      const show = ()=>{ pos = (pos + kids.length) % kids.length; label.textContent = `${pos + 1}/${kids.length}`; select("node", kids[pos]); };
      prev.onclick = (e)=>{ e.stopPropagation(); pos -= 2; show(); };
      next.onclick = (e)=>{ e.stopPropagation(); show(); };
      nav.append(prev, label, next);
      el.appendChild(nav);
    }
  });
}

/** 画布顶部对话工具条：head / 主线 / 开放分支 / 设为点头 / 合并 / 续说 */
function renderConvoPanel(){
  const panel = $("convoPanel");
  if (!panel) return;
  if (!isConvo()){ panel.hidden = true; return; }
  panel.hidden = false;
  const headNode = convo?.head ? nodeById(convo.head) : null;
  $("convoStats").textContent = t("convoStats").replace("{a}", convo?.mainline?.size ?? 0).replace("{b}", convo?.leaves?.length ?? 0).replace("{c}", (current.conversation?.runtime?.awaiting ?? []).length);
  $("convoHeadLine").innerHTML = `<b>${t("convoHeadLabel")}</b>${headNode ? escapeHtml(String(headNode.label).slice(0, 60)) : "—"}`;

  const post = async (body, tip)=>{
    try {
      await api(`/api/graph/${current.id}/convo`, { method: "POST", body: JSON.stringify(body) });
      await reload(false);
      if (tip) toast(tip);
    } catch (e){ toast(e.message, true); }
  };
  $("convoHead").onclick = ()=>{
    if (selected?.kind !== "node"){ toast(t("pickNodeFirst"), true); return; }
    post({ op: "branch", nodeId: selected.id }, t("headSet"));
  };
  $("convoMerge").onclick = ()=>{
    const sel = [...multiSel];
    const sources = sel.length >= 2 ? sel : (convo?.leaves ?? []);
    if (sources.length < 2){ toast(t("needBranches"), true); return; }
    post({ op: "merge", sources, label: t("mergeLabel") }, t("mergedDone"));
  };
  $("convoThreads").onclick = ()=>{
    const list = (convo?.leaves ?? []).map((id)=> `· ${String(nodeById(id)?.label ?? id).slice(0, 46)}  (${id})`).join("\n");
    alert(`${t("convoThreadsN").replace("{n}", (convo?.leaves ?? []).length)}\n\n${list || "—"}`);
  };
  $("convoNext").onclick = async ()=>{
    try {
      const r = await api(`/api/graph/${current.id}/convo?view=next`);
      alert(`${t("convoNextHead")}：${r.nextSpeaker ?? "—"}\n${t("convoReason")}：${r.reason}\n${t("convoTurnN")}：${r.round}\n${t("convoTopology")}：${r.topology}\n${t("convoAwaiting")}：${(r.awaiting ?? []).join(", ") || "—"}\n\n${t("convoCtx")}\n${(r.contextText ?? "").slice(0, 900)}`);
    } catch (e){ toast(e.message, true); }
  };
  $("convoPending").onclick = async ()=>{
    try {
      const r = await api(`/api/graph/${current.id}/convo?view=pending`);
      const list = (r.pending ?? []).map((x)=> `· [${x.status}] ${x.agent ?? "?"} — ${String(x.label).slice(0, 40)}  (${x.id})`).join("\n");
      alert(`${t("convoPendingN").replace("{n}", (r.pending ?? []).length)}\n\n${list || "—"}`);
    } catch (e){ toast(e.message, true); }
  };
  $("convoLinear").onclick = async ()=>{
    try {
      const r = await api(`/api/graph/${current.id}/convo-path?format=md`);
      openModal(`<h2>${LANG === "en" ? "Active path" : "活跃路径（根→点头）"}</h2>
        <textarea id="convo-text" style="min-height:300px;width:100%" spellcheck="false">${escapeHtml(r.text ?? "")}</textarea>
        <div class="btnrow"><button class="primary" id="convo-copy">${LANG === "en" ? "Copy" : "复制"}</button><button id="convo-close2">${LANG === "en" ? "Close" : "关闭"}</button></div>`);
      $("convo-copy").onclick = ()=>{ navigator.clipboard?.writeText(r.text ?? ""); toast(t("saved")); };
      $("convo-close2").onclick = closeModal;
    } catch (e){ toast(e.message, true); }
  };
  // 记录一轮：这是「台账记录」，不是聊天——OmniFlow 不含 LLM，对话发生在别处
  $("convoSayBtn").onclick = ()=>{
    openModal(`<h2>${t("turnRecord")}</h2>
      ${speakerField()}
      <label>${t("turnContentLong")}</label>
      <textarea id="turn-text" style="min-height:120px" placeholder="${t("turnContentLongPh")}"></textarea>
      <div class="row2">
        <div><label>${t("turnStatus")}</label><select id="turn-status">
          <option value="done">${t("stDone")}</option><option value="running">${t("stRunning")}</option>
          <option value="pending">${t("stPending")}</option><option value="waiting-human">${t("stWaiting")}</option>
          <option value="failed">${t("stFailed")}</option></select></div>
        <div><label>${t("turnType")}</label><select id="turn-type">
          <option value="turn">${t("tyTurn")}</option><option value="question">${t("tyQuestion")}</option>
          <option value="answer">${t("tyAnswer")}</option><option value="idea">${t("tyIdea")}</option>
          <option value="decision">${t("tyDecision")}</option></select></div>
      </div>
      <div class="row2">
        <div><label>${t("turnParent")}</label><input id="turn-parent" placeholder="${t("turnParentPh")}"></div>
        <div><label>${t("turnHandoff")}</label><input id="turn-handoff" placeholder="${t("turnHandoffPh")}"></div>
      </div>
      <div class="btnrow"><button class="primary" id="turn-save">${t("turnRecord")}</button><button id="turn-cancel" data-i18n="cancel"></button></div>`);
    $("turn-cancel").onclick = closeModal;
    $("turn-save").onclick = async ()=>{
      const text = $("turn-text").value;
      if (!text.trim()){ toast("内容不能为空", true); return; }
      const parent = $("turn-parent").value.trim();
      const isAgentMode = (current.conversation?.agents ?? []).length > 0;
      await post(isAgentMode
        ? { op: "record", agent: $("turn-agent").value.trim() || "user", text, status: $("turn-status").value, type: $("turn-type").value, handoffTo: $("turn-handoff").value.trim() || null, parentId: parent || null }
        : { op: "say", text, speaker: $("turn-agent").value.trim() || "user", type: $("turn-type").value, parentId: parent || null });
      closeModal();
    };
  };
}

/** 键盘导航（TreeGPT 约定）：k=上级 · j=唯一子级 · 1-9=第 n 个子级 */
function convoKeyNav(e){
  if (!isConvo() || !convo) return false;
  const tag = String(e.target?.tagName ?? "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return false;
  const cur = selected?.kind === "node" ? selected.id : convo.head;
  if (!cur) return false;
  if (e.key === "k"){ const p = (convo.parents.get(cur) ?? [])[0]; if (p){ select("node", p); return true; } }
  if (e.key === "j"){ const kids = convo.children.get(cur) ?? []; if (kids.length === 1){ select("node", kids[0]); return true; } }
  if (/^[1-9]$/.test(e.key)){ const kids = convo.children.get(cur) ?? []; const i = Number(e.key) - 1; if (kids[i]){ select("node", kids[i]); return true; } }
  return false;
}


/* ================= 依赖方向高亮（点击节点：上游蓝 / 下游红 / 其余变暗） ================= */
let depFocus = null;        // { up:Set, down:Set } | null
let depEnabled = true;      // 可通过图例关闭

/** 以 nodeId 为起点：上游 = 谁支撑它（逆向可达）· 下游 = 它支撑谁（正向可达） */
function computeDeps(nodeId){
  const up = new Set(), down = new Set();
  const upQ = [nodeId], downQ = [nodeId];
  while (upQ.length){
    const cur = upQ.pop();
    for (const e of current.edges){
      if (e.target === cur && e.source !== nodeId && !up.has(e.source)){ up.add(e.source); upQ.push(e.source); }
    }
  }
  while (downQ.length){
    const cur = downQ.pop();
    for (const e of current.edges){
      if (e.source === cur && e.target !== nodeId && !down.has(e.target)){ down.add(e.target); downQ.push(e.target); }
    }
  }
  return { up, down };
}

/** 应用/清除高亮：节点 + 连线，并在节点列表上方显示颜色图例 */
function applyDepHighlight(){
  if (!nodesLayer || !edgeLayer) return;
  const nodeEls = nodesLayer.querySelectorAll(".node");
  const groups = edgeLayer.querySelectorAll(".edge-group");
  const focusId = depFocus && selected?.kind === "node" ? selected.id : null;
  if (!depFocus || !focusId){
    nodeEls.forEach((el)=> el.classList.remove("dep-up", "dep-down", "dep-dim", "dep-self"));
    groups.forEach((g)=> g.classList.remove("dep-up", "dep-down", "dep-dim"));
    $("depLegend")?.remove();
    return;
  }
  const { up, down } = depFocus;
  nodeEls.forEach((el)=>{
    const id = el.dataset.id;
    const isSelf = id === focusId, isUp = up.has(id), isDown = down.has(id);
    el.classList.toggle("dep-self", isSelf);
    el.classList.toggle("dep-up", !isSelf && isUp);
    el.classList.toggle("dep-down", !isSelf && isDown);
    el.classList.toggle("dep-dim", !isSelf && !isUp && !isDown);
  });
  groups.forEach((g)=>{
    const e = edgeIndexById.get(g.querySelector(".edge-hit")?.dataset.edgeId);
    if (!e){ return; }
    const isUp = (e.target === focusId) || (up.has(e.target) && up.has(e.source));
    const isDown = (e.source === focusId) || (down.has(e.source) && down.has(e.target));
    g.classList.toggle("dep-up", isUp);
    g.classList.toggle("dep-down", !isUp && isDown);
    g.classList.toggle("dep-dim", !isUp && !isDown);
  });
  renderDepLegend();
}

/** 颜色图例（可关闭） */
function renderDepLegend(){
  $("depLegend")?.remove();
  const bar = $("depBar");
  if (!bar || !depFocus || CV.on) return;
  const el = document.createElement("div");
  el.id = "depLegend"; el.className = "dep-legend";
  el.innerHTML = `    <span><i style="background:#38BDF8"></i>${t("depUpLegend")}</span>
    <span><i style="background:#F87171"></i>${t("depDownLegend")}</span>
    <span><i style="background:#FBBF24"></i>${t("depSelfLegend")}</span>
    <button class="mini" id="depOff" style="margin-left:auto;font-size:10px;padding:1px 6px">${t("depHide")}</button>`;
  bar.appendChild(el);
  $("depOff").onclick = ()=>{ setDepEnabled(false); };
}

/* 组框逐帧跟随成员（拖组内单节点时框自动变形/移动），只改几何不重建 DOM */
function updateGroupsLive(){
  if (!current) return;
  for (const box of groupsLayer.querySelectorAll(".group-box")){
    const group = current.groups.find((g)=>g.id === box.dataset.groupId);
    if (!group) continue;
    const members = (group.members ?? []).map((id)=>nodeById(id)).filter(Boolean);
    if (!members.length) continue;
    const gm = groupGeom(members);
    box.style.left = gm.minX + "px"; box.style.top = gm.minY + "px";
    box.style.width = gm.w + "px"; box.style.height = gm.h + "px";
  }
}
function updateEdgesLive(){
  if (!current) return;
  // 定向更新：拖拽涉及的节点 → 其相邻边（O(k)）；无索引覆盖时才全量
  let groups;
  if (liveDrag && liveDrag.map.size <= 12){
    groups = new Set();
    for (const nid of liveDrag.map.keys()) for (const g of edgeIndex.get(nid) ?? []) groups.add(g);
  } else {
    groups = edgeLayer.querySelectorAll(".edge-group");
  }
  for (const g of groups){
    const hit = g.querySelector(".edge-hit"), vis = g.querySelector(".edge-line");
    const edge = edgeIndexById.get(hit.dataset.edgeId);
    if (!edge) continue;
    const geom = edgeGeometry(edge);
    if (!geom) continue;
    hit.setAttribute("d", geom.path);
    vis.setAttribute("d", geom.path);
    const label = g.querySelector("g");
    if (label){
      const mid = { x: (geom.start.x + geom.end.x) / 2, y: (geom.start.y + geom.end.y) / 2 };
      label.setAttribute("transform", `translate(${mid.x} ${mid.y})`);
    }
  }
}
function updateConnLive(){
  if (!pendingLink) return;
  const src = nodeById(pendingLink.sourceId);
  if (!src) return;
  const a = { x: src.x + src.w, y: src.y + (src._h ?? src.h) / 2 };
  const e = pendingLink.end;
  const forward = Math.max(54, Math.abs(e.x - a.x) * 0.46);
  const bend = e.x >= a.x ? forward : Math.max(90, forward * 0.7);
  let conn = pendingLink.conn && pendingLink.conn.isConnected ? pendingLink.conn : null;
  if (!conn){
    conn = document.createElementNS("http://www.w3.org/2000/svg", "path");
    conn.setAttribute("class", "conn");
    edgeLayer.appendChild(conn);
    pendingLink.conn = conn;   // 缓存：避免每帧 querySelector
  }
  conn.setAttribute("d", `M ${a.x} ${a.y} C ${a.x + bend} ${a.y}, ${e.x - bend} ${e.y}, ${e.x} ${e.y}`);
  document.querySelectorAll(".node.hover-target").forEach((el)=>el.classList.remove("hover-target"));
  if (pendingLink.hover && pendingLink.hover !== pendingLink.sourceId){
    nodeEl(pendingLink.hover)?.classList.add("hover-target");
  }
}
function renderEdges(){
  if (!current){ edgeLayer.innerHTML = ""; return; }
  const defs = [];
  const seen = new Set();
  const groups = [];
  for (const edge of current.edges){
    const geom = edgeGeometry(edge);
    if (!geom) continue;
    const color = edgeColorOf(edge);
    if (!seen.has(color)){
      seen.add(color);
      defs.push(`<marker id="arrow-${color.slice(1)}" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="strokeWidth" viewBox="0 0 10 10"><path d="M 0 0 L 10 5 L 0 10 Z" fill="${color}"></path></marker>`);
    }
    const dash = edge.style === "dashed" ? "10 6" : edge.style === "dotted" ? "2 5" : "";
    const selCls = selected?.kind === "edge" && selected.id === edge.id ? " sel" : "";
    const arrowStart = edge.arrow === "both" ? ` marker-start="url(#arrow-${color.slice(1)})"` : "";
    const arrowEnd = edge.arrow === "none" ? "" : ` marker-end="url(#arrow-${color.slice(1)})"`;
    const dashAttr = dash ? ` stroke-dasharray="${dash}"` : "";
    const label = edge.label || edgeTypeLabel(edge.type) || "";
    const mid = { x: geom.mid.x, y: geom.mid.y - 8 };   // 贴在曲线上、上移 8px（同参考的 text-margin-y:-8）
    const labelG = label
      ? `<g transform="translate(${mid.x} ${mid.y})"><rect class="edge-label-bg" x="${-Math.min(70, label.length * 5.6 + 10)}" y="-9" width="${Math.min(140, label.length * 11.2 + 20)}" height="18" rx="5"></rect><text class="edge-label-text">${escapeHtml(label)}</text></g>`
      : "";
    groups.push(`<g class="edge-group">` +
      `<path class="edge-hit" data-edge-id="${escapeHtml(edge.id)}" d="${geom.path}"/>` +
      `<path class="edge-line${selCls}" data-edge-id="${escapeHtml(edge.id)}" d="${geom.path}" stroke="${color}" style="color:${color}"${dashAttr}${arrowEnd}${arrowStart}/>` +
      labelG + `</g>`);
  }
  if (pendingLink){
    const src = nodeById(pendingLink.sourceId);
    if (src){
      const a = { x: src.x + src.w, y: src.y + (src._h ?? src.h) / 2 };
      const e = pendingLink.end;
      const forward = Math.max(54, Math.abs(e.x - a.x) * 0.46);
      const bend = e.x >= a.x ? forward : Math.max(90, forward * 0.7);
      groups.push(`<path class="conn" d="M ${a.x} ${a.y} C ${a.x + bend} ${a.y}, ${e.x - bend} ${e.y}, ${e.x} ${e.y}"/>`);
    }
  }
  edgeLayer.innerHTML = `<defs></defs>` + groups.join("");
  if (pendingLink) pendingLink.conn = null;   // innerHTML 重建后 conn 缓存失效
  edgeIndex = new Map();
  edgeLayer.querySelectorAll(".edge-group").forEach((g)=>{
    const hit = g.querySelector(".edge-hit");
    const edge = edgeIndexById.get(hit?.dataset.edgeId);
    if (!edge) return;
    for (const nid of [edge.source, edge.target]) {
      if (!edgeIndex.has(nid)) edgeIndex.set(nid, new Set());
      edgeIndex.get(nid).add(g);
    }
  });
  edgeLayer.querySelectorAll(".edge-hit").forEach((hit)=>{
    hit.addEventListener("pointerdown", (e)=>e.stopPropagation());
    hit.addEventListener("click", (e)=>{ e.stopPropagation(); select("edge", hit.dataset.edgeId); });
    hit.addEventListener("dblclick", (e)=>{
      e.stopPropagation();
      const edge = edgeIndexById.get(hit.dataset.edgeId);
      if (!edge) return;
      const next = prompt(t("edgeLabel"), edge.label || edgeTypeLabel(edge.type));
      if (next !== null) patchEdge(edge.id, { label: next });
    });
  });
  applyDepHighlight();   // 边 DOM 重建后立刻补写依赖高亮类（幂等；render() 末尾的调用保持不变）
}

/* --- 节点（agent-flow 卡片解剖 + 自定义三色/图标/状态） --- */
function statusMark(status){
  if (!status) return "";
  const map = { todo: ["○", "#94A3B8"], doing: ["◐", "#FBBF24"], done: ["✓", "#4ADE80"], blocked: ["✕", "#F87171"],
    pending: ["…", "#38BDF8"], running: ["◐", "#A78BFA"], "waiting-human": ["⏸", "#FBBF24"], failed: ["✕", "#F87171"], aborted: ["⊘", "#94A3B8"] };
  const [sym, color] = map[status] ?? ["", ""];
  return `<span class="mark" style="background:${color}">${sym}</span>`;
}
/** 摘要清洗：卡片上只显示可读文本，不留 LaTeX 噪声 */
function cleanExcerpt(text){
  let s = String(text ?? "");
  const ph = ` ${t("formulaPlaceholder")} `;   // 本地变量改名 s，腾出 t() 做翻译
  s = s.replace(/\$\$[\s\S]*?\$\$/g, ph);       // 显示公式
  s = s.replace(/\$[^$]*?\$/g, ph);             // 行内公式
  s = s.replace(/\\[a-zA-Z]+\s*\{([^{}]*)\}/g, "$1");      // \cmd{内容} → 内容
  s = s.replace(/\\[a-zA-Z]+/g, " ");                        // 残余命令名
  s = s.replace(/[{}]/g, "").replace(/\s{2,}/g, " ").trim();
  return s;
}

document.addEventListener("click", (e)=>{
  const badge = e.target.closest?.(".card .xlink");
  if (!badge) return;
  e.stopPropagation(); e.preventDefault();
  const card = badge.closest(".node");
  const id = card?.dataset.id;
  const hit = xlinks.byNode.get(id);
  if (!hit) return;
  const list = badge.dataset.x === "provides" ? hit.provides : hit.uses;
  if (list.length) jumpToLink(list[0]);
}, true);

/** 单节点元素：只读模式下不含 handle（每节点省 2 个 DOM） */

/** 取节点元素：优先增量渲染维护的 map，其次 getElementById（**必须传原始 id**——
 *  这里曾误用 CSS.escape，导致含 "." 的语义 id（def-2.1.1）查不到元素，
 *  表现为「拖分类框时框和边动了、卡片不动」。 */
function nodeEl(id){
  const fromMap = nodesLayer?._map?.get?.(id);
  if (fromMap && fromMap.isConnected) return fromMap;
  return document.getElementById("node-" + id);
}

/** 分组右键菜单：重新贴合 / 记住几何（DOM 与 canvas 两种模式共用） */
function openGroupMenu(group, cx, cy){
  closeCtxMenu();
  const members = (group.members ?? []).map((id)=> nodeById(id)).filter(Boolean);
  const menu = document.createElement("div");
  menu.className = "ctxmenu"; menu.id = "ctxmenu";
  menu.innerHTML = `<div class="cm-title">${escapeHtml(String(group.label).slice(0, 30))} · ${t("cardsCount").replace("{n}", members.length)}</div>
    <button data-a="refit">${t("groupRefitMenu")}</button>
    <button data-a="pin">${t("groupPinMenu")}</button>
    <button data-a="fit">⊙ ${t("groupFocus")}</button>`;
  document.body.appendChild(menu);
  const r0 = menu.getBoundingClientRect();
  menu.style.left = Math.min(cx, window.innerWidth - r0.width - 8) + "px";
  menu.style.top = Math.min(cy, window.innerHeight - r0.height - 8) + "px";
  const commit = async (rect, tip)=>{
    try {
      await api(`/api/graph/${current.id}/group-commit`, { method: "POST", body: JSON.stringify({ groupId: group.id, rect }) });
      const g2 = (current.groups ?? []).find((x)=> x.id === group.id);
      if (g2){ if (rect) g2.rect = rect; else delete g2.rect; }
      cvDraw(); renderGroups();
      toast(tip);
    } catch (err){ toast(err.message, true); }
  };
  menu.querySelector('[data-a="refit"]').onclick = ()=>{
    closeCtxMenu();
    commit(null, t("groupRefit"));
  };
  menu.querySelector('[data-a="pin"]').onclick = ()=>{
    closeCtxMenu();
    const b = groupGeom(members);
    commit({ x: b.minX, y: b.minY, w: b.w, h: b.h }, t("groupPinNow"));
  };
  menu.querySelector('[data-a="fit"]').onclick = ()=>{
    closeCtxMenu();
    const b = groupGeom(members);
    const vp = $("viewport").getBoundingClientRect();
    const pad = 60;
    const k = Math.max(0.15, Math.min(1.5, Math.min((vp.width - pad * 2) / b.w, (vp.height - pad * 2) / b.h)));
    animateView({ k, x: vp.width / 2 - (b.minX + b.w / 2) * k, y: vp.height / 2 - (b.minY + b.h / 2) * k }, 420);
  };
  setTimeout(()=>{
    const off = (ev)=>{ if (!menu.contains(ev.target)){ closeCtxMenu(); document.removeEventListener("pointerdown", off, true); } };
    document.addEventListener("pointerdown", off, true);
  }, 0);
}

function buildNodeEl(node){
  const el = document.createElement("div");
  el.className = "node";
  el.id = `node-${node.id}`;
  el.dataset.id = node.id;
  bindNodeEl(el, node);
  paintNodeEl(el, node);
  return el;
}

function bindNodeEl(el, node){
  if (el._bound) return;
  el._bound = true;
  el.addEventListener("pointerdown", (e)=>{
    if (e.target.closest?.(".th")) return;      // 点缩略图不拖拽
    beginNodeDrag(node, e);
  });
  el.addEventListener("click", (e)=>{
    const th = e.target.closest?.(".th");
    if (!th) return;
    e.stopPropagation(); e.preventDefault();
    const imgs = (node.attachments ?? []).filter((a)=> a.kind === "page" || a.kind === "image" || /\.(png|jpe?g|gif|webp|svg)$/i.test(a.src));
    openLightbox(imgs, Number(th.dataset.a ?? 0) || 0);
  });
  el.addEventListener("dblclick", (e)=>{
    e.stopPropagation();
    const openTag = (node.tags ?? []).map(String).find((tag)=> tag.startsWith("open:"));
    if (openTag){ location.hash = openTag.slice(5); return; }
    select("node", node.id);
  });
}

/** 只刷新「变化了」的内容——签名一致时一次 DOM 都不写（增量渲染核心） */
function paintNodeEl(el, node){
  const lp = livePos(node);
  if (el._px !== lp.x || el._py !== lp.y){ el.style.left = lp.x + "px"; el.style.top = lp.y + "px"; el._px = lp.x; el._py = lp.y; }
  const sig = `${node.label}|${node.icon ?? ""}|${node.type}|${node.status ?? ""}|${(node.note ?? "").slice(0, 120)}|${node.fill}|${node.border}|${node.textColor}|${(node.attachments ?? []).length}|${xlinks.byNode.has(node.id) ? 1 : 0}|${node.h}`;
  if (el._sig === sig && el._pw === node.w){ return; }
  el._sig = sig;
  if (el._pw !== node.w){ el.style.width = node.w + "px"; el._pw = node.w; }
  const openTag = (node.tags ?? []).map(String).find((tag)=> tag.startsWith("open:"));
  el.classList.toggle("has-jump", !!openTag);
  const excerpt = cleanExcerpt(String(node.note ?? "").split("\n")[0]);
  const att = (node.attachments ?? []).length;
  // 附件缩略图：直接显示图（懒加载），点击开大图；非图片附件保留 📎 角标
  const imgs = (node.attachments ?? []).filter((a)=> a.kind === "page" || a.kind === "image" || /\.(png|jpe?g|gif|webp|svg)$/i.test(a.src));
  const others = (node.attachments ?? []).length - imgs.length;
  const thumbSrc = (a)=> /^https?:|^data:/i.test(a.src) ? a.src : `/api/graph/${encodeURIComponent(current.id)}/asset/${encodeURIComponent(String(a.src).replace(/^assets\//, ""))}`;
  const showThumbs = document.body.classList.contains("show-thumbs");
  const thumbs = (showThumbs && imgs.length)
    ? `<u class="thumbs">${imgs.slice(0, 2).map((a, i)=> `<span class="th" data-a="${i}"><img loading="lazy" decoding="async" src="${thumbSrc(a)}" alt=""></span>`).join("")}${imgs.length > 2 ? `<span class="th more">+${imgs.length - 2}</span>` : ""}</u>`
    : "";
  el.innerHTML = `<div class="card${(document.body.classList.contains("show-thumbs") && imgs.length) ? " has-thumb" : ""}" style="--n-fill:${node.fill};--n-border:${node.border};--n-text:${node.textColor}">
      <i class="k">${escapeHtml(node.icon ?? "")} ${escapeHtml(typeLabel(node.type))}${others > 0 ? ` <em class="att">📎${others}</em>` : ""}${imgs.length ? ` <em class="att" title="${LANG === "en" ? `${imgs.length} image(s) — double-click the card to zoom` : `${imgs.length} 张图（双击卡片看大图）`}">🖼${imgs.length}</em>` : ""}${openTag ? ` <em class="jump">↗</em>` : ""}</i>
      <b class="l">${escapeHtml(node.label)} ${xlinkBadgeHtml(node.id)}</b>
      ${excerpt ? `<s class="x">${escapeHtml(excerpt.slice(0, 90))}</s>` : ""}
      ${thumbs}
      ${statusMark(node.status)}
    </div>`;
}

/** 增量渲染：复用已有元素，只增删差集、只写变化量（对齐「静态 DOM 一次成型」的思路） */
function renderNodes(){
  if (!current){ nodesLayer.innerHTML = ""; nodesLayer._map = new Map(); return; }
  const t0 = performance.now();
  const wanted = new Map(current.nodes.map((n)=> [n.id, n]));
  const map = nodesLayer._map instanceof Map ? nodesLayer._map : new Map();
  for (const [id, el] of [...map]) if (!wanted.has(id)){ el.remove(); map.delete(id); }
  const fresh = [];
  const frag = document.createDocumentFragment();
  for (const [id, node] of wanted){
    if (map.has(id)) continue;
    const el = buildNodeEl(node);
    map.set(id, el); fresh.push([node, el]); frag.appendChild(el);
  }
  if (frag.childNodes.length) nodesLayer.appendChild(frag);
  nodesLayer._map = map;
  for (const [id, node] of wanted){
    const el = map.get(id);
    if (!el) continue;
    paintNodeEl(el, node);
    el.classList.toggle("dragging", liveDrag?.id === id);
    el.classList.toggle("sel", selected?.kind === "node" && selected.id === id);
    el.classList.toggle("search-hit", highlightMembers.includes(id));
    el.classList.toggle("hover-target", pendingLink?.hover === id);
  }
  // 自适应高度：只测「新增或内容变化」的卡片，且先读后写（一次布局而非 N 次）
  const needMeasure = fresh.length ? fresh : null;
  if (needMeasure){
    const measured = [];
    for (const [node, el] of needMeasure){
      const card = el.firstElementChild;
      if (!card) continue;
      measured.push([node, el, card.offsetHeight + 2]);
    }
    for (const [node, el, needed] of measured){
      node._h = Math.max(node.h, needed);
      if (needed > node.h) el.style.height = node._h + "px";
    }
  }
  if (window.__perf) window.__perf.nodes = +(performance.now() - t0).toFixed(1);
}

/* --- 分组容器 --- */
/** Padding between a group box and its members. One definition for DOM drag, canvas drag and
 *  re-fit: if the three sites disagree, the box visibly jumps on the next re-render. */
const GROUP_PAD = { x: 24, top: 34, bottom: 24 };
function groupGeom(members){
  const minX = Math.min(...members.map((n)=>livePos(n).x)) - GROUP_PAD.x;
  const minY = Math.min(...members.map((n)=>livePos(n).y)) - GROUP_PAD.top;
  const maxX = Math.max(...members.map((n)=>livePos(n).x + n.w)) + GROUP_PAD.x;
  const maxY = Math.max(...members.map((n)=>livePos(n).y + n.h)) + GROUP_PAD.bottom;
  return { minX, minY, w: maxX - minX, h: maxY - minY };
}
/** The rect a group should have for these members (the only place that rounds geometry). */
function groupRectOf(members){
  const b = groupGeom(members);
  return { x: Math.round(b.minX), y: Math.round(b.minY), w: Math.round(b.w), h: Math.round(b.h) };
}
function renderGroups(){
  groupsLayer.innerHTML = "";
  for (const group of current?.groups ?? []){
    const members = (group.members ?? []).map((id)=>nodeById(id)).filter(Boolean);
    if (!members.length) continue;
    // 已固定过几何的组框：直接用持久化 rect（字段名与 groupGeom 对齐，避免 undefined → 框丢失）
    const gm = group.rect
      ? { minX: group.rect.x, minY: group.rect.y, w: group.rect.w, h: group.rect.h }
      : groupGeom(members);
    const box = document.createElement("div");
    box.className = "group-box";
    if (group.rect) box.classList.add("pinned");
    if (selGroupId === group.id) box.classList.add("sel");
    box.style.cssText = `left:${gm.minX}px;top:${gm.minY}px;width:${gm.w}px;height:${gm.h}px;border-color:${selGroupId === group.id ? "var(--accent)" : group.color};background:${group.color}14;`;
    box.dataset.groupId = group.id;
    // 注意：**绝不自动改写已固定的 rect**——用户手动摆好的位置必须原样保留。
    // 内容与框不符时只做「提示」，需要贴合由用户右键『重新贴合内容』显式触发。
    if (group.rect){
      const b = groupGeom(members);
      const covers = b.minX >= gm.minX - 8 && b.minY >= gm.minY - 8
        && b.minX + b.w <= gm.minX + gm.w + 8 && b.minY + b.h <= gm.minY + gm.h + 8;
      if (!covers) box.classList.add("needs-refit");
    }
    box.innerHTML = `<span class="glabel" style="background:${group.color}22;color:${group.color};border:1px solid ${group.color}66">${escapeHtml(group.label)}</span>`;
    box.addEventListener("contextmenu", (e)=>{ e.preventDefault(); e.stopPropagation(); openGroupMenu(group, e.clientX, e.clientY); });
    box.addEventListener("pointerdown", (e)=>{
      e.stopPropagation();
      const g0 = (current.groups ?? []).find((x)=> x.id === group.id);
      const startX = e.clientX, startY = e.clientY;
      const origin = new Map(members.map((n)=>[n.id, { x: n.x, y: n.y }]));
      const move = (ev)=>{
        const dx = (ev.clientX - startX) / view.k, dy = (ev.clientY - startY) / view.k;
        lastDx = dx; lastDy = dy;
        const map = new Map();
        for (const m of members){
          const p = { x: origin.get(m.id).x + dx, y: origin.get(m.id).y + dy };
          map.set(m.id, p);
          const el = nodeEl(m.id);
          if (el){ el.style.left = p.x + "px"; el.style.top = p.y + "px"; }
        }
        liveDrag = { map };
        // 整组 + 组内连线的实时跟随（rAF 帧同步，性能有上限）
        scheduleLiveFrame();
        const minX = Math.min(...members.map((m)=>livePos(m).x)) - GROUP_PAD.x, minY = Math.min(...members.map((m)=>livePos(m).y)) - GROUP_PAD.top;
        const maxX = Math.max(...members.map((m)=>livePos(m).x + m.w)) + GROUP_PAD.x, maxY = Math.max(...members.map((m)=>livePos(m).y + (m._h ?? m.h))) + GROUP_PAD.bottom;
        box.style.left = minX + "px"; box.style.top = minY + "px";
        box.style.width = (maxX - minX) + "px"; box.style.height = (maxY - minY) + "px";
      };
      let lastDx = 0, lastDy = 0;   // 跟踪最后一次有效位移（pointercancel 坐标不可信）
      const finish = async (restore)=>{
        if (restore){
          for (const m of members){ const o = origin.get(m.id); m.x = o.x; m.y = o.y; }
          liveDrag = null; updateEdgesLive(); renderGroups();
          suppressSSEUntil = 0;
          return;
        }
        // ① 用最后有效位移提交（不用事件坐标——pointercancel 可能是 0,0）
        const dx = lastDx, dy = lastDy;
        const moved = Math.abs(dx) >= 2 || Math.abs(dy) >= 2;
        if (moved){ for (const m of members){ m.x = origin.get(m.id).x + dx; m.y = origin.get(m.id).y + dy; } }
        // ② Clear the drag state, then re-render from data. The rect must already hold the NEW
        //    geometry at this point: rendering here with the old rect is what made the box snap
        //    back for one round-trip (and stay there if the request failed).
        liveDrag = null;
        updateEdgesLive();
        if (!moved){ selectGroup(group.id); return; }   // 原地点击 = 选中该组（不拖动）
        const ms = members.map((m)=> nodeById(m.id)).filter(Boolean);
        const prevRect = g0?.rect ? { ...g0.rect } : null;
        const rect = ms.length ? groupRectOf(ms) : null;
        if (g0 && rect) g0.rect = rect;              // optimistic: the new position covers the old one
        renderGroups();
        // ③ One transaction: member moves + box geometry (overwriting). A single load/save rules out
        //    the concurrent read-modify-write that used to scatter the members.
        suppressSSEUntil = Date.now() + 900;
        try {
          const r = await api(`/api/graph/${current.id}/group-commit`, {
            method: "POST",
            body: JSON.stringify({ groupId: group.id, moves: ms.map((m)=> ({ nodeId: m.id, x: m.x, y: m.y })), rect }),
          });
          // Adopt the server's value (authoritative) so local and stored geometry cannot drift.
          const g = (current.groups ?? []).find((x)=> x.id === group.id);
          if (g && r?.rect) g.rect = r.rect;
          renderGroups();
          toast(LANG === "en" ? "Group position pinned" : "已固定分组位置");
        } catch (e){
          if (g0){ if (prevRect) g0.rect = prevRect; else delete g0.rect; renderGroups(); }
          toast(e.message, true);
        }
      };
      startPointerDrag(e, {
        onMove: move,
        onEnd: ()=> finish(false),
        onAbort: ()=> finish(true),   // a cancelled pointer restores the previous geometry
      });
    });
    groupsLayer.appendChild(box);
  }
}

/* ================= 手势（agent-flow 移植） ================= */
/**
 * The single entry point for every pointer drag on the canvas.
 *   - captures the pointer, so move/up keep arriving even when the cursor leaves the element
 *   - filters by pointerId, so a second finger or a stylus cannot hijack the gesture
 *   - pointerup  → commit
 *     pointercancel → abort (restore the original geometry)
 * A browser gesture taking over mid-drag therefore can no longer record a half-way position and
 * make the drag look like it stopped on its own.
 */
function startPointerDrag(event, { onMove, onEnd, onAbort }){
  const pointerId = event.pointerId;
  const target = event.currentTarget ?? null;
  try { target?.setPointerCapture?.(pointerId); } catch { /* capture is best-effort */ }
  const listeners = [
    ["pointermove", (e)=>{ if (e.pointerId === pointerId) onMove?.(e); }],
    ["pointerup", (e)=>{ if (e.pointerId !== pointerId) return; stop(); onEnd?.(); }],
    ["pointercancel", (e)=>{ if (e.pointerId !== pointerId) return; stop(); (onAbort ?? onEnd)?.(); }],
  ];
  function stop(){
    for (const [type, fn] of listeners) window.removeEventListener(type, fn);
    try { target?.releasePointerCapture?.(pointerId); } catch { /* already released */ }
  }
  for (const [type, fn] of listeners) window.addEventListener(type, fn);
}

function beginNodeDrag(node, event){
  if (event.button !== 0 || event.target.closest(".handle")) return;
  cancelViewAnimation();
  event.preventDefault(); event.stopPropagation();
  suppressSSEUntil = Date.now() + 60000;   // suppress SSE while dragging (cleared on drop)
  select("node", node.id);
  liveDrag = { map: new Map([[node.id, { x: node.x, y: node.y }]]) };
  nodeEl(node.id)?.classList.add("dragging");
  const startX = event.clientX, startY = event.clientY, origin = { x: node.x, y: node.y };
  let latest = origin;
  const endDrag = (restore)=>{
    liveDrag = null;
    nodeEl(node.id)?.classList.remove("dragging");
    const n = current?.nodes.find((x)=>x.id === node.id);
    if (restore){
      if (n){ n.x = origin.x; n.y = origin.y; }     // abort: leave the old position untouched
      renderNodes(); updateEdgesLive();
      suppressSSEUntil = 0;
      return;
    }
    const moved = latest.x !== origin.x || latest.y !== origin.y;
    if (moved && n){ n.x = latest.x; n.y = latest.y; }
    updateEdgesLive();
    if (moved) commitNodePosition(node.id, latest);
    else suppressSSEUntil = 0;                      // a plain click must not mute live updates
  };
  startPointerDrag(event, {
    onMove: (e)=>{
      latest = { x: origin.x + (e.clientX - startX) / view.k, y: origin.y + (e.clientY - startY) / view.k };
      liveDrag = { map: new Map([[node.id, latest]]) };
      const card = nodeEl(node.id);
      if (card){ card.style.left = latest.x + "px"; card.style.top = latest.y + "px"; }
      scheduleLiveFrame();
    },
    onEnd: ()=> endDrag(false),
    onAbort: ()=> endDrag(true),
  });
}

/** Persist one node position. Kept separate so both the DOM and canvas drags use the same call. */
async function commitNodePosition(nodeId, pos){
  suppressSSEUntil = Date.now() + 900;
  try {
    await api(`/api/graph/${current.id}/position`, { method: "POST", body: JSON.stringify({ nodeId, x: pos.x, y: pos.y }) });
  } catch (e){
    toast(e.message, true);
    await reload(false);
  }
}

function beginConnect(node, event){
  if (event.button !== 0) return;
  cancelViewAnimation();
  event.preventDefault(); event.stopPropagation();
  pendingLink = { sourceId: node.id, end: screenToWorld(event.clientX, event.clientY), hover: null };
  const move = (e)=>{
    pendingLink.end = screenToWorld(e.clientX, e.clientY);
    pendingLink.hover = document.elementFromPoint(e.clientX, e.clientY)?.closest(".node")?.dataset?.id ?? null;
    scheduleLiveFrame();
  };
  const up = async (e)=>{
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest(".node")?.dataset?.id ?? pendingLink.hover;
    const source = pendingLink.sourceId;
    pendingLink = null;
    if (!target || target === source || !current) { render(); return; }
    try {
      await api(`/api/graph/${current.id}/edge-add`, { method: "POST", body: JSON.stringify({ source, target, type: "" }) });
      await reload(false);
      const created = current.edges.find((x)=>x.source === source && x.target === target);
      if (created) select("edge", created.id);
      toast(t("edgeAdded"));
    } catch (error){ toast(error.message, true); }
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

canvas.addEventListener("pointerdown", (event)=>{
  if (typeof CV !== "undefined" && CV.on) return;   // canvas 模式：画布交互由 cvBind 统一处理
  if (event.button !== 0 || event.target.closest(".node,.controls,.add-wrap,.modal-bg")) return;
  cancelViewAnimation();
  event.preventDefault();
  const startX = event.clientX, startY = event.clientY, origin = { ...view };
  canvas.classList.add("panning");
  let moved = false;
  const move = (e)=>{
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
    view = { ...origin, x: origin.x + dx, y: origin.y + dy };
    applyView();
  };
  const up = ()=>{
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    canvas.classList.remove("panning");
    // 与画布模式对齐：拖动平移不清选中/高亮，只有原地点击空白才取消
    if (!moved) select(null);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
});
canvas.addEventListener("wheel", (event)=>{
  if (typeof CV !== "undefined" && CV.on) return;    // canvas 模式：缩放由 cvBind 处理
  // 弹层/控件区域内滚轮 = 滚动它们自己的列表，不动画布
  if (event.target.closest(".add-popup,.controls")) return;
  cancelViewAnimation();
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const cx = event.clientX - rect.left, cy = event.clientY - rect.top;
  if (event.ctrlKey || event.metaKey){
    const k = Math.min(2.5, Math.max(0.4, view.k * Math.exp(-event.deltaY * 0.0012)));
    view = { k, x: cx - (cx - view.x) * (k / view.k), y: cy - (cy - view.y) * (k / view.k) };
  } else {
    view = { ...view, x: view.x - (event.deltaX || 0), y: view.y - (event.deltaY || 0) };
  }
  applyView();
}, { passive: false });

/* ================= 文档栏（docrail 逻辑 + 动画） ================= */
/* ================= 文件树（Obsidian 式） ================= */
function folderChildren(folder){
  return tree.folders.filter((p)=> folder === ""
    ? !p.includes("/")
    : (p.startsWith(folder + "/") && !p.slice(folder.length + 1).includes("/"))).sort();
}
function countGraphsUnder(folder){
  const prefix = folder + "/";
  return graphs.filter((g)=>{ const f = tree.assign[g.id] ?? ""; return f === folder || f.startsWith(prefix); }).length;
}
async function refreshTree(){
  tree = await api("/api/tree");
  renderVault();
  refreshListQuiet();
}
function newFolderIn(parent){
  const name = prompt(t("folderNamePrompt"));
  if (!name || !name.trim()) return;
  const path = parent ? parent + "/" + name.trim() : name.trim();
  api("/api/tree/folder", { method: "POST", body: JSON.stringify({ path }) })
    .then(()=>{ expandedFolders.add(path); return refreshTree(); })
    .catch((error)=>toast(error.message, true));
}
function renameFolderUI(path){
  const next = prompt(t("renameFolderPrompt"), path);
  if (!next || next.trim() === path) return;
  api("/api/tree/folder-rename", { method: "POST", body: JSON.stringify({ path, newPath: next.trim() }) })
    .then(()=>refreshTree())
    .catch((error)=>toast(error.message, true));
}
function moveGraphUI(graphId){
  const current = tree.assign[graphId] ?? "";
  const target = prompt(t("moveToPrompt"), current);
  if (target === null) return;
  api("/api/tree/move", { method: "POST", body: JSON.stringify({ graphId, folder: target.trim() }) })
    .then(()=>refreshTree())
    .catch((error)=>toast(error.message, true));
}
function renderVault(){
  const box = $("vaultTree");
  if (!box) return;
  box.innerHTML = "";   // 修复：先清空再重建，否则每次调用都会叠加一整棵树（重复行元凶）
  if (!graphs){ return; }
  const activeId = decodeURIComponent(location.hash.slice(1));
  const byFolder = new Map();
  for (const g of graphs){
    const f = tree.assign[g.id] ?? "";
    if (!byFolder.has(f)) byFolder.set(f, []);
    byFolder.get(f).push(g);
  }
  const buildLevel = (folder, depth) => {
    const wrap = document.createElement("div");
    if (depth > 0) wrap.className = "tree-children";
    const folderMatch = (f)=>{
      if (!treeFilter) return true;
      if (f.toLowerCase().includes(treeFilter)) return true;
      if ((byFolder.get(f) ?? []).some((g)=>g.name.toLowerCase().includes(treeFilter))) return true;
      return folderChildren(f).some((c)=>folderMatch(c));
    };
    for (const child of folderChildren(folder)){
      if (treeFilter && !folderMatch(child)) continue;
      const isOpen = expandedFolders.has(child);
      const count = countGraphsUnder(child);
      const row = document.createElement("div");
      row.className = "tree-row";
      row.dataset.folder = child;
      row.innerHTML = `<span class="caret">${isOpen ? "▾" : "▸"}</span><span class="t">📁 ${escapeHtml(child.split("/").pop())}</span><span class="n">${count || ""}</span><span class="acts"><button data-act="addf" title="+">＋</button><button data-act="ren" title="✏">✏</button><button data-act="del" title="🗑">🗑</button></span>`;
      row.addEventListener("click", (e)=>{
        if (e.target.closest(".acts")) return;
        if (isOpen) expandedFolders.delete(child); else expandedFolders.add(child);
        renderVault();
      });
      row.querySelector('[data-act="addf"]').onclick = (e)=>{ e.stopPropagation(); newFolderIn(child); };
      row.querySelector('[data-act="ren"]').onclick = (e)=>{ e.stopPropagation(); renameFolderUI(child); };
      row.querySelector('[data-act="del"]').onclick = async (e)=>{
        e.stopPropagation();
        if (!confirm(t("confirmFolderDelete"))) return;
        try { await api("/api/tree/folder-delete", { method: "POST", body: JSON.stringify({ path: child }) }); await refreshTree(); }
        catch (error){ toast(error.message, true); }
      };
      row.addEventListener("dragover", (e)=>{ if ([...e.dataTransfer.types].includes("text/of-graph")){ e.preventDefault(); row.classList.add("drop-target"); } });
      row.addEventListener("dragleave", ()=>row.classList.remove("drop-target"));
      row.addEventListener("drop", async (e)=>{
        e.preventDefault(); e.stopPropagation();
        row.classList.remove("drop-target");
        const id = e.dataTransfer.getData("text/of-graph");
        if (id){ try { await api("/api/tree/move", { method: "POST", body: JSON.stringify({ graphId: id, folder: child }) }); await refreshTree(); } catch (error){ toast(error.message, true); } }
      });
      wrap.appendChild(row);
      if (isOpen) wrap.appendChild(buildLevel(child, depth + 1));
    }
    for (const g of byFolder.get(folder) ?? []){
      if (treeFilter && !g.name.toLowerCase().includes(treeFilter)) continue;
      const row = document.createElement("div");
      row.className = "tree-row graph" + (g.id === activeId ? " active" : "");
      row.draggable = true;
      row.innerHTML = `<span class="caret"></span><span class="t">📄 ${escapeHtml(g.name)}</span><span class="acts"><button data-act="mov" title="📂">📂</button><button data-act="del" title="🗑">🗑</button></span>`;
      row.addEventListener("click", ()=>{ location.hash = g.id; });
      row.addEventListener("dragstart", (e)=>{ e.dataTransfer.setData("text/of-graph", g.id); e.dataTransfer.effectAllowed = "move"; });
      row.querySelector('[data-act="mov"]').onclick = (e)=>{ e.stopPropagation(); moveGraphUI(g.id); };
      row.querySelector('[data-act="del"]').onclick = async (e)=>{
        e.stopPropagation();
        if (!confirm(t("confirmDeleteGraph"))) return;
        try { await api(`/api/graph/${g.id}/graph-delete`, { method: "POST", body: "{}" }); await refreshTree(); if (location.hash.slice(1) === g.id) location.hash = ""; }
        catch (error){ toast(error.message, true); }
      };
      wrap.appendChild(row);
    }
    return wrap;
  };
  const root = buildLevel("", 0);
  root.id = "vaultRoot";
  root.addEventListener("dragover", (e)=>{ if ([...e.dataTransfer.types].includes("text/of-graph")){ e.preventDefault(); root.classList.add("drop-root"); } });
  root.addEventListener("dragleave", ()=>root.classList.remove("drop-root"));
  root.addEventListener("drop", async (e)=>{
    if (e.target.closest(".tree-row")) return;
    e.preventDefault();
    root.classList.remove("drop-root");
    const id = e.dataTransfer.getData("text/of-graph");
    if (id){ try { await api("/api/tree/move", { method: "POST", body: JSON.stringify({ graphId: id, folder: "" }) }); await refreshTree(); } catch (error){ toast(error.message, true); } }
  });
  box.appendChild(root);
}
$("btnNewFolder").onclick = ()=>newFolderIn("");

/* 左栏上下两栏高度调节：拖 railSplitter 改 vaultTree 高度（docList 自动占余） */
$("railSplitter").addEventListener("pointerdown", (event)=>{
  if (event.button !== 0) return;
  event.preventDefault();
  const rail = $("docrail").getBoundingClientRect();
  const startY = event.clientY;
  const startH = $("vaultTree").getBoundingClientRect().height;
  const move = (e)=>{
    const h = Math.max(80, Math.min(rail.height - 220, startH + (e.clientY - startY)));
    $("vaultTree").style.flex = `0 0 ${h}px`; $("vaultTree").dataset.lastH = h;
  };
  const up = ()=>{ window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
});

/* ================= 右侧检查器：折叠 + 拖宽 + 组列表 ================= */
/* 已由 setRightCollapsed 统一处理 */
$("rightSplitter").addEventListener("pointerdown", (event)=>{
  if (event.button !== 0) return;
  event.preventDefault();
  const insp = $("inspector");
  if (insp.classList.contains("collapsed")) insp.classList.remove("collapsed");
  const startX = event.clientX;
  const startWidth = insp.getBoundingClientRect().width;
  const move = (e)=>{
    const w = Math.max(240, Math.min(520, startWidth - (e.clientX - startX)));
    insp.style.width = w + "px"; insp.dataset.lastW = w; insp.classList.remove("collapsed");
  };
  const up = ()=>{ window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
});
function renderGroupList(){
  const box = $("groupList");
  if (!box) return;
  const groups = current?.groups ?? [];
  box.innerHTML = groups.length ? groups.map((g)=>
    `<div class="node-item${selGroupId === g.id ? " sel" : ""}" data-g="${escapeHtml(g.id)}"><span class="dot" style="background:${g.color};border:1.5px solid ${g.color}"></span><span class="t">${escapeHtml(g.label)} · ${(g.members ?? []).length}</span></div>`).join("")
    : `<div class="hint" style="margin:0">${LANG === "en" ? "No groups yet — select nodes, then use 「Group selection」." : "还没有分组——选中节点后点「从选中建组」。"}</div>`;
  box.querySelectorAll("[data-g]").forEach((item)=>{
    item.onclick = ()=>{
      const group = current.groups.find((g)=>g.id === item.dataset.g);
      if (!group) return;
      const members = (group.members ?? []).map((id)=>current.nodes.find((n)=>n.id === id)).filter(Boolean);
      if (!members.length) return;
      document.querySelectorAll(".node.search-hit").forEach((el)=>el.classList.remove("search-hit"));
      for (const m of members) nodeEl(m.id)?.classList.add("search-hit");
      const minX = Math.min(...members.map((m)=>m.x)), minY = Math.min(...members.map((m)=>m.y));
      const maxX = Math.max(...members.map((m)=>m.x + m.w)), maxY = Math.max(...members.map((m)=>m.y + (m._h ?? m.h)));
      const rect = canvas.getBoundingClientRect();
      const k = Math.min(1, Math.max(0.4, Math.min((rect.width - 140) / Math.max(1, maxX - minX), (rect.height - 140) / Math.max(1, maxY - minY))));
      animateView({ k, x: (rect.width - (maxX - minX) * k) / 2 - minX * k, y: (rect.height - (maxY - minY) * k) / 2 - minY * k }, 680);
    };
  });
}

/* ================= 文件树标题搜索 ================= */
let treeFilter = "";
$("treeSearch").addEventListener("input", ()=>{
  treeFilter = $("treeSearch").value.trim().toLowerCase();
  renderVault();
});

/* ================= 全局搜索（顶栏）：图标题 / 节点 / 标签 / 备注全文 ================= */
let gsDebounce = null;
let pendingFocusNode = null;
let gsResults = [];
function positionGs(){
  const box = $("gsResults"), input = $("globalSearch");
  const r = input.getBoundingClientRect();
  box.style.left = Math.max(8, Math.min(r.left, innerWidth - 500)) + "px";
  box.style.top = r.bottom + 6 + "px";
}
function closeGs(){ $("gsResults").classList.remove("show"); }
function focusPendingNode(){
  if (!pendingFocusNode || !current){ pendingFocusNode = null; return; }
  const node = current.nodes.find((n)=>n.id === pendingFocusNode);
  pendingFocusNode = null;
  if (node){ select("node", node.id); focusNode(node); }
}
function openSearchResult(r2){
  closeGs();
  $("globalSearch").value = "";
  pendingFocusNode = r2.nodeId ?? null;
  if (decodeURIComponent(location.hash.slice(1)) === r2.graphId && current){ focusPendingNode(); }
  else { location.hash = r2.graphId; }
}
function renderGsResults(list){
  const box = $("gsResults");
  if (!list.length){ box.innerHTML = `<div class="gs-empty">${LANG === "en" ? "No results" : "无结果"}</div>`; }
  else {
    box.innerHTML = list.map((r2, i)=>{
      const icon = r2.where === "title" ? "🗂" : r2.where === "note" ? "📝" : r2.where === "tag" ? "#️⃣" : "📄";
      const l1 = r2.where === "title" ? `${icon} ${escapeHtml(r2.graphName)}` : `${icon} ${escapeHtml(r2.nodeLabel ?? "")}`;
      const l2 = r2.where === "title"
        ? (LANG === "en" ? "Graph" : "图")
        : `${escapeHtml(r2.graphName)}${r2.snippet ? " — " + escapeHtml(r2.snippet) : ""}`;
      return `<button class="gs-item" data-i="${i}"><span class="l1">${l1}</span><span class="l2">${l2}</span></button>`;
    }).join("");
  }
  gsResults = list;
  positionGs();
  box.classList.add("show");
  box.querySelectorAll(".gs-item").forEach((item)=>{
    item.onclick = ()=>openSearchResult(gsResults[Number(item.dataset.i)]);
  });
}
$("globalSearch").addEventListener("input", ()=>{
  clearTimeout(gsDebounce);
  const q = $("globalSearch").value.trim();
  if (!q){ closeGs(); return; }
  gsDebounce = setTimeout(async ()=>{
    try {
      const data = await api("/api/search?q=" + encodeURIComponent(q));
      gsResults = data.results ?? [];
      renderGsResults(gsResults);
    } catch (error){ toast(error.message, true); }
  }, 180);
});
$("globalSearch").addEventListener("keydown", (e)=>{
  if (e.key === "Enter"){
    e.preventDefault();
    if (gsResults.length) openSearchResult(gsResults[0]);
  }
});
document.addEventListener("click", (e)=>{
  if (!e.target.closest("#gsResults") && !e.target.closest("#globalSearch")) closeGs();
});

let typeFilter = null;   // 节点列表类型筛选（null = 全部）

/** 序号统计 + 渲染类型筛选 chips */
function renderTypeFilter(){
  const bar = $("typeFilterBar");
  if (!bar) return;
  if (!current){ bar.innerHTML = ""; return; }
  const counts = new Map();
  for (const n of current.nodes) counts.set(n.type, (counts.get(n.type) ?? 0) + 1);
  const types = [...counts.entries()].sort((a, b)=> b[1] - a[1]);
  bar.className = "typefilter";
  bar.innerHTML = `<button data-t="" class="${typeFilter ? "" : "on"}">${LANG === "en" ? "All" : "全部"} ${current.nodes.length}</button>` +
    types.map(([t, c])=> `<button data-t="${escapeHtml(t)}" class="${typeFilter === t ? "on" : ""}">${escapeHtml(typeLabel(t))} ${c}</button>`).join("");
  bar.querySelectorAll("button").forEach((b)=>{
    b.onclick = ()=>{ typeFilter = b.dataset.t || null; renderTypeFilter(); renderDocList(); };
  });
}

function renderDocList(){
  const box = $("docList");
  if (!box || !current){ if (box) box.innerHTML = ""; return; }
  const query = $("nodeSearch").value.trim().toLowerCase();
  const items = current.nodes.filter((node)=> (!typeFilter || node.type === typeFilter)
    && (!query
    || String(node.label ?? "").toLowerCase().includes(query)
    || String(node.note ?? "").toLowerCase().includes(query)
    || (node.tags ?? []).some((tag)=>String(tag).toLowerCase().includes(query))));
  box.innerHTML = `<div class="docgroup">${current.nodes.length} ${LANG === "en" ? "NODES" : "节点"}</div>` + (items.map((node)=>
    `<button class="docitem ${selected?.kind === "node" && selected.id === node.id ? "active" : ""}" data-node="${escapeHtml(node.id)}">
      <span class="docitem__icon" style="color:${node.border};background:${node.fill}22">${escapeHtml(node.icon ?? "◆")}</span>
      <span><span class="docitem__label">${escapeHtml(node.label)}</span><span class="docitem__path">${escapeHtml(typeLabel(node.type))} · ${escapeHtml(node.id)}</span></span>
    </button>`).join("") || `<div class="hint">—</div>`);
  box.querySelectorAll("[data-node]").forEach((btn)=>{
    btn.addEventListener("click", ()=>{
      const node = nodeById(btn.dataset.node);
      if (!node) return;
      select("node", node.id);
      focusNode(node, { duration: 720 });
    });
  });
}
$("nodeSearch").addEventListener("input", ()=>renderDocList());
/* 左右侧栏：完全滑出式折叠（deepseek-flow 方案），画布边缘浮动拉手唤回 */
function setLeftCollapsed(collapsed){
  $("docrail").classList.toggle("collapsed", collapsed);
  $("leftSplitter").style.display = collapsed ? "none" : "";
  $("edgeTabLeft").classList.toggle("show", collapsed);
}
function setRightCollapsed(collapsed){
  const insp = $("inspector");
  insp.classList.toggle("collapsed", collapsed);
  if (collapsed){ insp.style.width = ""; }                          // 清内联宽度，否则收起失效
  else if (insp.dataset.lastW){ insp.style.width = insp.dataset.lastW + "px"; }
  $("rightSplitter").style.display = collapsed ? "none" : "";
  $("edgeTabRight").classList.toggle("show", collapsed);
}
$("btnToggleDocrail").onclick = ()=>setLeftCollapsed(!$("docrail").classList.contains("collapsed"));
$("edgeTabLeft").onclick = ()=>setLeftCollapsed(false);
$("btnToggleInspector").onclick = ()=>setRightCollapsed(!$("inspector").classList.contains("collapsed"));
$("edgeTabRight").onclick = ()=>setRightCollapsed(false);
$("leftSplitter").addEventListener("pointerdown", (event)=>{
  if (event.button !== 0) return;
  event.preventDefault();
  const rail = $("docrail");
  if (rail.classList.contains("collapsed")) rail.classList.remove("collapsed");
  const startX = event.clientX;
  const startWidth = rail.getBoundingClientRect().width;
  const move = (e)=>{ rail.style.width = Math.max(150, Math.min(460, startWidth + (e.clientX - startX))) + "px"; };
  const up = ()=>{
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
});

/* ================= 数据加载 ================= */
async function reloadNow(resetView){
  graphs = await api("/api/graphs");
  tree = await api("/api/tree");
  renderVault();
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id){ current = null; renderChrome(); return; }
  current = await api(`/api/graph/${encodeURIComponent(id)}`);
  buildTypeSelects();
  renderChrome();
  await loadCrosslinks();          // 切图时加载一次（带缓存；不在 render 里调用，避免死循环）
  // 选中状态跨 reload 保留：节点/边由 select(selected) 恢复；组选中同样必须恢复，
  // 否则任何被动 reload（SSE/提交回声）都会把高亮静默抹掉。组被删时回落到清空。
  if (selGroupId && (current.groups ?? []).some((grp)=> grp.id === selGroupId)) selectGroup(selGroupId);
  else { if (selGroupId) selGroupId = null; select(selected); }
  render();
  if (resetView) fitView();
  focusPendingNode();
}
/* 单飞 reload：并发调用合并进同一轮执行（50ms 尾随窗口，最新 resetView 实参获胜）。
 * boot reload + hashchange reload 由此只发一轮请求；落在「执行中」窗口里的调用在
 * 本轮结束后补跑一轮（re-read location.hash，绝不吞掉真实的图切换）。
 * SSE 的 300ms 防抖与 suppressSSEUntil 语义保持不变。 */
let reloadState = "idle";          // idle | pending | running
let reloadRun = null, reloadLatestReset = true, reloadRerunNeeded = false;
function reload(resetView = true){
  reloadLatestReset = resetView;
  if (reloadState === "idle"){
    reloadState = "pending";
    reloadRun = new Promise((resolve, reject)=>{
      setTimeout(async ()=>{
        reloadState = "running";
        try { await reloadNow(reloadLatestReset); resolve(); }
        catch (e){ reject(e); }
        finally {
          reloadState = "idle";
          if (reloadRerunNeeded){ reloadRerunNeeded = false; reload(reloadLatestReset); }
        }
      }, 50);
    });
  } else if (reloadState === "running"){
    reloadRerunNeeded = true;      // 本轮已错过最新实参，完成后补一轮
  }
  return reloadRun;                // pending：本轮尚未起跑，实参已被采纳，本次调用被吸收
}
function renderChrome(){
  for (const btn of document.querySelectorAll("[data-needs-graph]")) btn.disabled = !current;
}
window.addEventListener("hashchange", ()=>{ current = null; select(null); reload(); });

function buildTypeSelects(){
  if (!current) return;
  const nodeSel = $("n-type"), edgeSel = $("e-type");
  const keepN = nodeSel.value, keepE = edgeSel.value;
  // 一次性赋值（此前在循环里 innerHTML += ：二次方字符串拼接，且每次迭代都会重置选中态）
  nodeSel.innerHTML = Object.entries(current.nodeTypes ?? {}).map(([id, def])=>{
    const text = `${def.icon ?? ""} ${(LANG === "en" ? def.labelEn : def.label) ?? id}`;
    return `<option value="${escapeHtml(id)}">${escapeHtml(text)}</option>`;
  }).join("");
  edgeSel.innerHTML = `<option value="">${LANG === "zh" ? "（通用关联）" : "(Generic link)"}</option>`
    + Object.entries(current.edgeTypes ?? {}).map(([id, def])=>
      `<option value="${escapeHtml(id)}">${escapeHtml((LANG === "en" ? def.labelEn : def.label) ?? id)}</option>`).join("");
  nodeSel.value = keepN; edgeSel.value = keepE;
}

/* 底栏「流程框」两级选择：按钮 → 可滚动类型列表 → 画布中央落点 */
function closeAddPopup(){
  $("addPopup").classList.remove("show");
  $("catNode").classList.remove("on");
}
$("catNode").onclick = (e)=>{
  e.stopPropagation();
  if (!current){ toast(t("noGraph"), true); return; }
  const popup = $("addPopup");
  if (popup.classList.contains("show")){ closeAddPopup(); return; }
  popup.innerHTML = `<div class="head">${t("pickNodeType")}</div>` + Object.entries(current.nodeTypes ?? {}).map(([id, def])=>
    `<button class="item" data-type="${escapeHtml(id)}"><span class="dot" style="background:${def.fill};border:1.5px solid ${def.border}"></span><span>${escapeHtml(def.icon ?? "")} ${escapeHtml((LANG === "en" ? def.labelEn : def.label) ?? id)}</span></button>`).join("");
  popup.classList.add("show");
  $("catNode").classList.add("on");
  popup.querySelectorAll("[data-type]").forEach((item)=>{
    item.onclick = ()=>{
      const rect = canvas.getBoundingClientRect();
      const cascade = (current.nodes.length ?? 0) % 4;
      const center = { x: (rect.width / 2 - view.x) / view.k - 104 + cascade * 26, y: (rect.height / 2 - view.y) / view.k - 48 + cascade * 26 };
      api(`/api/graph/${current.id}/node-add`, { method: "POST", body: JSON.stringify({ type: item.dataset.type, x: center.x, y: center.y }) })
        .then(()=>reload(false)).then(()=>{ toast(t("nodeAdded")); closeAddPopup(); })
        .catch((error)=>toast(error.message, true));
    };
  });
};
document.addEventListener("click", (e)=>{
  if (!e.target.closest("#addPopup") && !e.target.closest("#catNode")) closeAddPopup();
});

/* 静态下拉的选项随语言切换（全量翻译） */
function localizeStaticSelects(){
  const refill = (el, pairs) => { const v = el.value; el.innerHTML = pairs.map(([value, zh, en]) => `<option value="${value}">${LANG === "en" ? en : zh}</option>`).join(""); el.value = v; };
  refill($("n-status"), [["","无","None"],["todo","待办","To do"],["doing","进行中","Doing"],["done","完成","Done"],["blocked","阻塞","Blocked"]]);
  refill($("e-style"), [["solid","实线","Solid"],["dashed","虚线","Dashed"],["dotted","点线","Dotted"]]);
  refill($("e-arrow"), [["one","单向","One-way"],["both","双向","Two-way"],["none","无","None"]]);
  refill($("m-direction"), [["TD","自上而下 TD","Top-down TD"],["LR","自左向右 LR","Left-right LR"]]);
}

/* ================= 变更操作 ================= */
async function refreshListQuiet(){
  graphs = await api("/api/graphs");
  try { tree = await api("/api/tree"); } catch {}
  renderVault();
}
async function patchNode(nodeId, patch){
  pushHistory();   // patchNode: 记一份改前快照，供撤销
  try {
    const res = await api(`/api/graph/${current.id}/node-patch`, { method: "POST", body: JSON.stringify({ nodeId, patch }) });
    if (!res.ok){ toast((res.issues ?? []).join("；") || t("saveFailed"), true); return false; }
    current = res.detail; buildTypeSelects(); fillMeta(); select("node", nodeId); render();
    refreshListQuiet();
    return true;
  } catch (error){ toast(error.message, true); return false; }
}
async function patchEdge(edgeId, patch){
  pushHistory();   // patchEdge: 记一份改前快照，供撤销
  try {
    const res = await api(`/api/graph/${current.id}/edge-patch`, { method: "POST", body: JSON.stringify({ edgeId, patch }) });
    if (!res.ok){ toast((res.issues ?? []).join("；") || t("saveFailed"), true); return false; }
    current = res.detail; buildTypeSelects(); select("edge", edgeId); render();
    refreshListQuiet();
    return true;
  } catch (error){ toast(error.message, true); return false; }
}
async function removeNode(nodeId){
  pushHistory();   // removeNode: 记一份改前快照，供撤销
  if (!confirm(`${t("delete")}: ${nodeId}?`)) return;
  await api(`/api/graph/${current.id}/node-delete`, { method: "POST", body: JSON.stringify({ nodeId }) });
  select(null); await reload(false); refreshListQuiet();
}
async function removeEdge(edgeId){
  pushHistory();   // removeEdge: 记一份改前快照，供撤销
  await api(`/api/graph/${current.id}/edge-delete`, { method: "POST", body: JSON.stringify({ edgeId }) });
  select(null); await reload(false); refreshListQuiet();
}

$("n-save").onclick = ()=>{
  patchNode(selected.id, {
    label: $("n-label").value, type: $("n-type").value, icon: $("n-icon").value,
    fill: $("n-fill").value, border: $("n-border").value, textColor: $("n-text").value,
    status: $("n-status").value || null, note: $("n-note").value
  });
};
$("e-save").onclick = ()=>{
  patchEdge(selected.id, { label: $("e-label").value, type: $("e-type").value, color: $("e-color").value,
    width: Number($("e-width").value), style: $("e-style").value, arrow: $("e-arrow").value });
};
$("e-flip").onclick = async ()=>{
  const edge = current.edges.find((x)=>x.id === selected.id);
  if (!edge) return;
  await api(`/api/graph/${current.id}/edge-delete`, { method: "POST", body: JSON.stringify({ edgeId: edge.id }) });
  await api(`/api/graph/${current.id}/edge-add`, { method: "POST", body: JSON.stringify({ source: edge.target, target: edge.source, type: edge.type, label: edge.label }) });
  await reload(false);
};
$("n-delete").onclick = ()=>removeNode(selected.id);
$("e-delete").onclick = ()=>removeEdge(selected.id);
$("n-group").onclick = async ()=>{
  const ids = [...document.querySelectorAll(".node.sel")].map((el)=>el.id.replace(/^node-/, ""));
  const list = ids.length ? ids : [selected.id];
  const label = prompt(LANG === "zh" ? "分组名称：" : "Group name:", "");
  if (label === null) return;
  try {
    await api(`/api/graph/${current.id}/group-add`, { method: "POST", body: JSON.stringify({ label, members: list }) });
    await reload(false); toast(LANG === "zh" ? "已建组" : "Grouped");
  } catch (error){ toast(error.message, true); }
};
$("n-note")?.addEventListener("input", ()=>{ autoGrow($("n-note")); clearTimeout(notePreviewTimer); notePreviewTimer = setTimeout(renderNotePreview, 120); });
$("n-note-full").onclick = async ()=>{
  const nodeId = selected.id;
  const note = await api(`/api/graph/${current.id}/note/${encodeURIComponent(nodeId)}`);
  openModal(`
    <h2>${LANG === "zh" ? "节点备注（Markdown · 支持 $公式$）" : "Node note (Markdown · $formulas$ supported)"}</h2>
    <div class="note-split">
      <textarea id="note-edit" spellcheck="false">${escapeHtml(note.content ?? "")}</textarea>
      <div id="note-preview" class="note-preview"></div>
    </div>
    <div class="btnrow"><button class="primary" id="note-save">${t("save")}</button><button id="note-close">${LANG === "zh" ? "关闭" : "Close"}</button></div>`);
  const renderBigNote = ()=>{ renderMathIn($("note-preview"), $("note-edit")?.value ?? ""); };
  renderBigNote();
  let bigNoteTimer = 0;
  $("note-edit").addEventListener("input", ()=>{ clearTimeout(bigNoteTimer); bigNoteTimer = setTimeout(renderBigNote, 120); });
  $("note-save").onclick = async ()=>{
    await api(`/api/graph/${current.id}/note`, { method: "POST", body: JSON.stringify({ nodeId, content: $("note-edit").value }) });
    toast(t("saved")); closeModal(); await reload(false);
  };
  $("note-close").onclick = closeModal;
};
$("n-trace").onclick = ()=>runAnalysis(selected.id);
$("m-save").onclick = async ()=>{
  await api(`/api/graph/${current.id}/meta`, { method: "POST", body: JSON.stringify({ name: $("m-name").value, description: $("m-desc").value, direction: $("m-direction").value }) });
  await reload(false); refreshListQuiet(); toast(t("saved"));
};

/* ================= 顶栏操作 ================= */
/** Validation details — opened from the status badge. A separate toolbar button used to repeat
 *  exactly what the badge already shows, so it was removed. */
async function openValidation(){
  if (!current) return;
  const verdict = await api(`/api/graph/${current.id}/validate`);
  openModal(`<h2>${t("validate")}</h2><div class="analysis-sec"><div class="b">${verdict.ok
    ? `✅ ${LANG === "zh" ? "结构合法" : "Structure OK"}${verdict.warnings.length ? `<br><br>${verdict.warnings.map(escapeHtml).join("<br>")}` : ""}`
    : `❌ ${verdict.issues.map(escapeHtml).join("<br>")}<br><br>${verdict.warnings.map(escapeHtml).join("<br>")}`}</div></div>`);
}
{
  const badge = $("gstat");
  if (badge){
    badge.style.cursor = "pointer";
    badge.onclick = openValidation;
    badge.onkeydown = (e)=>{ if (e.key === "Enter" || e.key === " "){ e.preventDefault(); openValidation(); } };
  }
}
$("btnReader") && ($("btnReader").onclick = openReader);
/** Dependency highlighting is a first-class toggle: it has a pressed state and tells you what it did. */
function setDepEnabled(on){
  depEnabled = !!on;
  // Recompute straight away, otherwise switching the highlight on while a card is selected shows
  // nothing until the next selection change.
  depFocus = (depEnabled && selected?.kind === "node") ? computeDeps(selected.id) : null;
  setToggle("btnDep", depEnabled);
  applyDepHighlight();
  renderDepLegend();
  if (CV.on) cvDraw();   // 画布模式：高亮开关也要立刻反映到画布明暗
}
$("btnDep") && ($("btnDep").onclick = ()=>{ setDepEnabled(!depEnabled); toast(depEnabled ? t("depOnMsg") : t("depOffMsg")); });
setToggle("btnDep", depEnabled);
bindMarquee();
cvInit();
installHistory();
bindAttachmentDrop();
$("btnFxHelp") && ($("btnFxHelp").onclick = openFxHelp);
$("btnCanvas") && ($("btnCanvas").onclick = ()=> cvSetMode(!CV.on));
$("btnThumbs") && ($("btnThumbs").onclick = ()=>{
  const on = document.body.classList.toggle("show-thumbs");
  setToggle("btnThumbs", on);
  render();
});
$("noteCopy") && ($("noteCopy").onclick = ()=>{
  const v = $("n-note")?.value ?? "";
  if (!v){ toast(t("noteEmpty")); return; }
  navigator.clipboard?.writeText(v); toast(t("noteCopied"));
});
$("rd-close") && ($("rd-close").onclick = closeReader);
$("rd-search") && ($("rd-search").addEventListener("input", ()=>{ renderReader(); }));
$("rd-expand") && ($("rd-expand").onclick = ()=>{ document.querySelectorAll("#rd-body details").forEach((d)=>{ d.open = true; d.dispatchEvent(new Event("toggle")); }); });
$("rd-collapse") && ($("rd-collapse").onclick = ()=>{ document.querySelectorAll("#rd-body details").forEach((d)=>{ d.open = false; }); });
document.addEventListener("keydown", (e)=>{ if (e.key === "Escape" && rdOpen) closeReader(); });
$("btnAnalyze").onclick = ()=>runAnalysis(null);
/* 布局应用：单一动画路径 —— rAF 插值（livePos 驱动节点/边/组框逐帧跟随），动画期抑制 SSE reload */
let suppressSSEUntil = 0;
async function doLayoutNow(mode){
  const j = await api(`/api/graph/${current.id}/layout`, { method: "POST", body: JSON.stringify({ mode }) });
  const target = new Map((j.detail?.nodes ?? []).map((n) => [n.id, n]));
  for (const n of current.nodes){ const t = target.get(n.id); if (t){ n.x = t.x; n.y = t.y; } }
  closeModal(); render(); toast(t("layoutDone"));
}
$("btnLayout").onclick = async ()=>{
  if (!current) return;
  if ((current.groups ?? []).length) {
    openModal(`<h2>${t("layout")}</h2>
      <button class="btn" id="lo-layered">${LANG === "en" ? "Layered by dependency" : "按依赖分层"}</button>
      <button class="btn" id="lo-clusters">${LANG === "en" ? "Cluster by groups" : "按分组聚簇"}</button>
      <button class="btn" id="lo-force">${LANG === "en" ? "Force-directed" : "力导向"}</button>
      <button class="btn" id="lo-grid">${LANG === "en" ? "Compact grid" : "紧凑网格"}</button>`);
    document.getElementById("lo-force").onclick = ()=>doLayoutNow("force");
    document.getElementById("lo-grid").onclick = ()=>doLayoutNow("grid");
    document.getElementById("lo-layered").onclick = ()=>doLayoutNow("layered");
    document.getElementById("lo-clusters").onclick = ()=>doLayoutNow("clusters");
  } else {
    openModal(`<h2>${t("layout")}</h2>
      <button class="btn" id="lo-layered">${LANG === "en" ? "Layered by dependency" : "按依赖分层"}</button>
      <button class="btn" id="lo-force">${LANG === "en" ? "Force-directed" : "力导向"}</button>
      <button class="btn" id="lo-grid">${LANG === "en" ? "Compact grid" : "紧凑网格"}</button>`);
    document.getElementById("lo-force").onclick = ()=>doLayoutNow("force");
    document.getElementById("lo-grid").onclick = ()=>doLayoutNow("grid");
    document.getElementById("lo-layered").onclick = ()=>doLayoutNow("layered");
  }
};
/** Legend markup (node types + edge types). Lives inside the Analyze modal: the toolbar button was
 *  removed because the type filter bar already shows the same colours and counts. */
function legendHtml(){
  if (!current) return "";
  const nodeEntries = Object.entries(current.nodeTypes ?? {});
  const edgeEntries = Object.entries(current.edgeTypes ?? {}).filter(([id])=>id);
  return `<div class="analysis-sec"><div class="h">${t("legendNodeTypes")}</div>
    <div class="legend-grid">${nodeEntries.map(([id, def])=>
      `<div class="legend-item"><span class="legend-dot" style="background:${def.fill};border:1.5px solid ${def.border}"></span>${escapeHtml(def.icon ?? "")} ${escapeHtml((LANG === "en" ? def.labelEn : def.label) ?? id)}</div>`).join("")}</div></div>
    <div class="analysis-sec"><div class="h">${t("legendEdgeTypes")}</div>
    <div class="legend-grid">${edgeEntries.map(([id, def])=>
      `<div class="legend-item"><span class="legend-dot" style="background:${def.color};border-radius:999px"></span>${escapeHtml((LANG === "en" ? def.labelEn : def.label) ?? id)}</div>`).join("")}</div></div>`;
}
const deleteCurrentGraph = async ()=>{
  if (!current) return;
  if (!confirm(t("confirmDeleteGraph"))) return;
  await api(`/api/graph/${current.id}/graph-delete`, { method: "POST", body: "{}" });
  location.hash = "";
  await reload();
};
$("m-delete").onclick = deleteCurrentGraph;
async function runAnalysis(traceId){
  if (!current) return;
  const result = await api(`/api/graph/${current.id}/analyze${traceId ? `?trace=${encodeURIComponent(traceId)}` : ""}`);
  const nodeChip = (entry)=>`<span class="chip" data-jump="${escapeHtml(entry.id ?? entry)}">${escapeHtml(entry.label ?? entry)}</span>`;
  const sug = result.groupSuggestions ?? [];
  const sugBlock = sug.length ? `<div class="analysis-sec"><div class="h">${LANG === "en" ? "Suggested groups" : "建议分组"}</div><div class="b">${sug.map((s) => `· ${escapeHtml(LANG === "en" ? s.labelEn : s.label)}（${s.members.length}）`).join("<br>")}</div><button class="btn mini" id="applyGroups" style="margin-top:6px">${LANG === "en" ? "Apply all suggested groups" : "一键采用建议分组"}</button></div>` : "";
  openModal(`<h2>${t("analyze")}${result.trace ? ` — ${t("trace")}` : ""}</h2>${sugBlock}${legendHtml()}
    ${result.trace ? `<div class="analysis-sec"><div class="h">${LANG === "zh" ? "上游（谁支撑它）" : "Upstream"}</div><div class="b">${result.trace.upstream.map(nodeChip).join("") || "—"}</div></div>
    <div class="analysis-sec"><div class="h">${LANG === "zh" ? "下游（它支撑谁）" : "Downstream"}</div><div class="b">${result.trace.downstream.map(nodeChip).join("") || "—"}</div></div>` : ""}
    <div class="analysis-sec"><div class="h">${LANG === "zh" ? "环检测" : "Cycles"}</div><div class="b">${result.cycles.length ? result.cycles.map((c)=>escapeHtml(c.join(" → "))).join("<br>") : (LANG === "zh" ? "无环" : "None")}</div></div>
    <div class="analysis-sec"><div class="h">${LANG === "zh" ? "枢纽 / 瓶颈（度中心性最高）" : "Hubs / bottlenecks"}</div><div class="b">${result.ranked.slice(0, 6).map((entry)=>`${escapeHtml(entry.label)} <b style="color:var(--text)">${entry.total}</b>`).join(" · ") || "—"}</div></div>
    <div class="analysis-sec"><div class="h">${LANG === "zh" ? "孤立节点" : "Isolated nodes"}</div><div class="b">${result.isolated.map(nodeChip).join("") || (LANG === "zh" ? "无" : "None")}</div></div>
    <div class="analysis-sec"><div class="h">${LANG === "zh" ? "规模" : "Size"}</div><div class="b">${result.nodeCount} ${LANG === "zh" ? "节点" : "nodes"} · ${result.edgeCount} ${LANG === "zh" ? "连线" : "edges"}</div></div>`);
  document.querySelectorAll("[data-jump]").forEach((chip)=>{
    chip.onclick = ()=>{
      const id = chip.dataset.jump;
      closeModal(); select("node", id);
      const node = nodeById(id);
      if (node) focusNode(node);
    };
  });
}

/* ================= 弹窗：新建/导入/导出 ================= */
function openModal(html){ $("modal-body").innerHTML = html; $("modal-bg").classList.add("show"); }
function closeModal(){ $("modal-bg").classList.remove("show"); }
$("modal-bg").addEventListener("click", (e)=>{ if (e.target === $("modal-bg")) closeModal(); });

$("btnNew").onclick = ()=>openNewModal();
function openNewModal(){
  openModal(`<h2>${t("newGraph")}</h2>
    <label>${t("name")}</label><input id="new-name" placeholder="${LANG === "zh" ? "我的图" : "My graph"}" />
    <label data-i18n="folderOpt">${LANG === "zh" ? "文件夹（可选，a/b 可嵌套）" : "Folder (optional, a/b nests)"}</label><input id="new-folder" />
    <label>${t("templates")}</label>
    <div id="new-tpls" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;max-height:300px;overflow:auto">${templates.map((tpl)=>
      `<div class="tpl-item" data-tpl="${tpl.id}"><div class="t">${escapeHtml(tpl.name)}</div><div class="d">${escapeHtml(tpl.desc)}</div></div>`).join("")}</div>
    <div class="btnrow"><button class="primary" id="new-create">${LANG === "zh" ? "创建" : "Create"}</button></div>`);
  let chosen = "blank";
  document.querySelectorAll("#new-tpls .tpl-item").forEach((item)=>{
    if (item.dataset.tpl === "blank") item.style.borderColor = "var(--accent)";
    item.onclick = ()=>{
      chosen = item.dataset.tpl;
      document.querySelectorAll("#new-tpls .tpl-item").forEach((x)=>x.style.borderColor = "");
      item.style.borderColor = "var(--accent)";
    };
  });
  $("new-create").onclick = async ()=>{
    const created = await api("/api/graphs", { method: "POST", body: JSON.stringify({ name: $("new-name").value || (LANG === "zh" ? "未命名图" : "Untitled"), template: chosen, lang: LANG, folder: $("new-folder").value.trim() || undefined }) });
    closeModal(); location.hash = created.id; reload(); refreshListQuiet();
  };
}
$("btnImport").onclick = ()=>{
  openModal(`<h2>${t("import")}</h2>
    <div class="modal-tabs">
      <button class="on" data-fmt="mermaid">Mermaid</button>
      <button data-fmt="json">JSON</button>
      <button data-fmt="af">AgentFlow</button>
    </div>
    <div id="imp-af" style="display:none"><label>${LANG === "zh" ? "agent-flow 工作流 id（读取 ~/.agent-flow/flows/<id>/flow.json）" : "agent-flow workflow id (reads ~/.agent-flow/flows/<id>/flow.json)"}</label>
      <input id="imp-afid" placeholder="my-workflow-a1b2" /></div>
    <div id="imp-text"><label>${LANG === "zh" ? "粘贴 Mermaid flowchart 代码或 OmniFlow JSON" : "Paste Mermaid flowchart code or OmniFlow JSON"}</label>
      <textarea id="imp-data" placeholder="flowchart TD&#10;  A[开始] --> B[处理]&#10;  B -->|是| C[结束]"></textarea></div>
    <label>${t("name")}</label><input id="imp-name" />
    <div class="btnrow"><button class="primary" id="imp-go">${LANG === "zh" ? "导入" : "Import"}</button></div>`);
  let fmt = "mermaid";
  document.querySelectorAll(".modal-tabs button").forEach((btn)=>{
    btn.onclick = ()=>{
      fmt = btn.dataset.fmt;
      document.querySelectorAll(".modal-tabs button").forEach((x)=>x.classList.toggle("on", x === btn));
      $("imp-af").style.display = fmt === "af" ? "" : "none";
      $("imp-text").style.display = fmt === "af" ? "none" : "";
    };
  });
  $("imp-go").onclick = async ()=>{
    try {
      const payload = { format: fmt, name: $("imp-name").value };
      if (fmt === "af") payload.afId = $("imp-afid").value.trim();
      else payload.text = $("imp-data").value;
      const created = await api("/api/import", { method: "POST", body: JSON.stringify(payload) });
      closeModal(); location.hash = created.id; reload(); refreshListQuiet();
      toast(LANG === "zh" ? "导入成功" : "Imported");
    } catch (error){ toast(error.message, true); }
  };
};
$("btnExport").onclick = async ()=>{
  if (!current) return;
  openModal(`<h2>${t("share")}</h2>
    <div class="modal-tabs">
      <button class="on" data-fmt="mermaid">Mermaid</button>
      <button data-fmt="dot">Graphviz DOT</button>
      <button data-fmt="md">Markdown</button>
      <button data-fmt="json">JSON</button>
      <button data-fmt="txt">TXT</button>
    </div>
    <textarea id="exp-text" style="min-height:260px"></textarea>
    <div class="btnrow"><button class="primary" id="exp-copy">${LANG === "zh" ? "复制" : "Copy"}</button><button id="exp-dl">${LANG === "zh" ? "下载" : "Download"}</button></div>`);
  let fmt = "mermaid";
  const load = async ()=>{
    const data = await api(`/api/graph/${current.id}/export?format=${fmt}`);
    $("exp-text").value = data.text ?? JSON.stringify(data, null, 2);
  };
  document.querySelectorAll(".modal-tabs button").forEach((btn)=>{
    btn.onclick = ()=>{ fmt = btn.dataset.fmt; document.querySelectorAll(".modal-tabs button").forEach((x)=>x.classList.toggle("on", x === btn)); load(); };
  });
  load();
  $("exp-copy").onclick = async ()=>{ await navigator.clipboard.writeText($("exp-text").value); toast(LANG === "zh" ? "已复制" : "Copied"); };
  $("exp-dl").onclick = ()=>{
    const blob = new Blob([$("exp-text").value], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${current.id}.${fmt === "mermaid" ? "mmd" : fmt}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
};

/* ================= 启动 ================= */
(async function boot(){
  const bt = performance.now();
  window.__bootPerf = {};   // 各阶段耗时（ms）：诊断首屏慢的打点，只测量不优化
  const mark = (name)=>{ window.__bootPerf[name] = +(performance.now() - bt).toFixed(1); };
  try {
    window.__bootStep = "applyLang";
    applyLang();
    mark("applyLang");
    window.__bootStep = "templates-fetch";
    templates = await api("/api/templates?lang=" + LANG);
    mark("templatesFetch");
    window.__bootStep = "reload";
    await reload();
    mark("reload");
    window.__bootStep = "done";
  } catch (e) {
    window.__bootErr = String((e && e.stack) || e);
    console.error("boot failed:", e);
  }
  const es = new EventSource("/api/events");
  let reloadTimer = null;
  es.addEventListener("change", ()=>{
    if (liveDrag || Date.now() < suppressSSEUntil) return;   // 拖拽中 + 布局动画期间抑制
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(()=>{ if (!document.querySelector(".modal-bg.show")) reload(false); }, 300);
  });
})();
