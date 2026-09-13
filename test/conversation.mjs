/* 非线性对话核心逻辑自测 */
import { ensureConversationShape, appendTurn, setHead, mergeBranches, pathTo, leavesOf, forksOf, siblingsOf, conversationOverview, linearize } from '/Users/andylyu/WorkBuddy/2026-09-11-12-31-54/omni-flow/lib/conversation.js';
import { normalizeGraph } from '/Users/andylyu/WorkBuddy/2026-09-11-12-31-54/omni-flow/lib/graph-core.js';

let pass = 0, fail = 0;
const t = (name, cond, extra = '') => { if (cond){ pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra); } };

let g = ensureConversationShape(normalizeGraph({ id: 'x', name: '对话测试', nodes: [], edges: [], groups: [], notes: {} }));
t('对话形状初始化', !!g.conversation?.mode && !!g.nodeTypes.turn);

// 主线：root → t1 → t2
const root = appendTurn(g, { text: '话题：如何实现非线性对话？', speaker: 'andy', type: 'topic' });
const t1 = appendTurn(g, { text: '先定义 DAG 数据模型：id + parentId', speaker: 'a' });
const t2 = appendTurn(g, { text: '需要活跃分支路径来取上下文', speaker: 'b' });
t('主线追加 3 轮', g.nodes.length === 3 && g.edges.length === 2, `nodes=${g.nodes.length} edges=${g.edges.length}`);
t('head 跟随最新发言', g.conversation.head === t2.id);

// 分支：跳回 t1 再说话 → t1 出现两个子节点（fork）
setHead(g, t1.id);
const b1 = appendTurn(g, { text: '另一条思路：用父子指针 + forkOf 标记再生', speaker: 'andy' });
t('跳回后追加形成分支', forksOf(g).length === 1 && forksOf(g)[0].children.length === 2);
t('兄弟节点可查', siblingsOf(g, b1.id).length === 1);
t('两条路径互不干扰', pathTo(g, b1.id).length === 3 && pathTo(g, t2.id).length === 3);

// 合并两支
const m = mergeBranches(g, { sources: [b1.id, t2.id], label: '汇合：两条路线都保留', text: '取并集：messageContext + forkOf' });
t('合并节点建立', g.nodes.length === 5 && g.edges.filter((e)=> e.type === 'merges').length === 2);
t('合并后 head 指向汇合点', g.conversation.head === m.id);

// 总览
const ov = conversationOverview(g);
t('总览：开放分支数', ov.openThreads.length === 1, JSON.stringify(ov.openThreads.map((x)=>x.label)));
t('总览：分叉点数', ov.forks.length === 1);
t('总览：最深处 ≥ 4', ov.deepest.depth >= 4, `depth=${ov.deepest.depth}`);
t('总览：说话人收集', ov.speakers.includes('andy') && ov.speakers.includes('a'));

// 线性化
const lin = linearize(g, null, { format: 'md' });
t('路径线性化包含各轮', lin.includes('DAG 数据模型') && lin.includes('汇合'), lin.slice(0, 80));

console.log(`\n${pass}/${pass + fail} 通过`);
