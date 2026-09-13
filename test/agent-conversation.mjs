/* Agent 侧非线性对话自测：拓扑脚手架 / 调度器 / 状态 / 聚合投票 */
import {
  ensureConversationShape, scaffoldTopology, nextSpeaker, recordTurn, resolveTurn,
  pendingTurns, aggregateBranches, registerAgent, pathTo, linearize, conversationOverview
} from '/Users/andylyu/WorkBuddy/2026-09-11-12-31-54/omni-flow/lib/conversation.js';
import { normalizeGraph } from '/Users/andylyu/WorkBuddy/2026-09-11-12-31-54/omni-flow/lib/graph-core.js';

let pass = 0, fail = 0;
const t = (n, c, extra = '') => { if (c){ pass++; console.log('✓', n); } else { fail++; console.log('✗', n, extra); } };
const blank = (name = 'agent 会话') => ensureConversationShape(normalizeGraph({ name, nodes: [], edges: [], groups: [], notes: {} }));

// ---------- ① supervisor 拓扑脚手架 ----------
let g = blank('客服多智能体');
const agents = [
  { name: 'supervisor', role: 'supervisor', model: 'gpt-4o', goal: '分派与整合' },
  { name: 'knowledge', role: 'worker', goal: '知识检索' },
  { name: 'account', role: 'worker', goal: '账户查询' },
];
const sc = scaffoldTopology(g, { topology: 'supervisor', agents, topic: '客户问题：账单异常' });
t('脚手架：注册 3 个 agent', g.conversation.agents.length === 3);
t('脚手架：拓扑写入 runtime', g.conversation.runtime.topology === 'supervisor');
t('脚手架：并行分支 = worker 数', sc.branches.length === 2, JSON.stringify(sc.branches));
t('脚手架：分支初始为 pending', pendingTurns(g).length === 2);
t('脚手架：边语义 = hands-off', g.edges.every((e)=> e.type === 'hands-off'));

// ---------- ② 调度器 ----------
let n1 = nextSpeaker(g);
t('调度：supervisor → worker', ['knowledge', 'account'].includes(n1.nextSpeaker), n1.nextSpeaker);
t('调度：给出上下文路径', n1.context.length === 2 && !!n1.contextText);
t('调度：标注待办分支', n1.awaiting.length === 2);

// ---------- ③ 记录 / 完成 ----------
const w1 = recordTurn(g, { agent: 'knowledge', text: '账单规则：30 天内可退', status: 'running', parentId: sc.branches[0], edgeType: 'follows' });
t('记录：running 进入待办', pendingTurns(g).some((p)=> p.id === w1.id));
t('记录：轮次自增', g.conversation.runtime.turn >= 1);
resolveTurn(g, w1.id, { status: 'done', text: '账单规则：30 天内可退（已核实）' });
t('完成：移出待办', !pendingTurns(g).some((p)=> p.id === w1.id));
t('完成：状态标签更新', (w1.tags ?? []).some((x)=> x === 'status:done'));

// 另一支 worker 也完成 → 回到 supervisor
const w2 = recordTurn(g, { agent: 'account', text: '账户正常，无欠费', status: 'done', parentId: sc.branches[1], edgeType: 'follows' });
g.conversation.head = w2.id;
const n2 = nextSpeaker(g);
t('调度：worker 完成 → 回到 supervisor', n2.nextSpeaker === 'supervisor', n2.nextSpeaker);

// ---------- ④ handoff 覆盖调度 ----------
const h = recordTurn(g, { agent: 'supervisor', text: '转人工', handoffTo: 'human', status: 'waiting-human' });
const n3 = nextSpeaker(g);
t('调度：显式 handoff 优先', n3.nextSpeaker === 'human', n3.nextSpeaker);
t('调度：等待人工进入待办', pendingTurns(g).some((p)=> p.id === h.id));

// ---------- ⑤ debate + 聚合投票 ----------
let d = blank('技术方案辩论');
scaffoldTopology(d, { topology: 'debate', agents: [
  { name: 'alice', role: 'solver' }, { name: 'bob', role: 'solver' }, { name: 'carol', role: 'solver' }, { name: 'judge', role: 'judge' },
], topic: '选 Rust 还是 Go？' });
const branches = d.conversation.runtime.awaiting.slice();
// 三个 solver 各给答案：两个选 Rust，一个选 Go
const a1 = recordTurn(d, { agent: 'alice', text: 'Rust：内存安全 + 无 GC', status: 'done', parentId: branches[0] });
const a2 = recordTurn(d, { agent: 'bob', text: 'Rust：内存安全 + 无 GC', status: 'done', parentId: branches[1] });
const a3 = recordTurn(d, { agent: 'carol', text: 'Go：并发模型简单', status: 'done', parentId: branches[2] });
const agg = aggregateBranches(d, { sources: [a1.id, a2.id, a3.id], strategy: 'majority', agent: 'judge' });
t('聚合：识别 2 种答案', agg.distinct === 2, JSON.stringify(agg.tally));
t('聚合：多数票正确', agg.tally[0].count === 2 && agg.tally[0].value.startsWith('Rust'));
t('聚合：共识度 2/3', Math.abs(agg.consensus - 2 / 3) < 1e-6);
t('聚合：汇合边类型 = aggregates', d.edges.filter((e)=> e.type === 'aggregates').length === 3);
t('聚合：head 移到决策节点', d.conversation.head === agg.node.id);
t('聚合：决策节点带 aggregator 角色', (agg.node.tags ?? []).some((x)=> x === 'role:aggregator'));

// ---------- ⑥ 上下文隔离（不同分支互不污染） ----------
const pathA = pathTo(d, a1.id), pathB = pathTo(d, a3.id);
t('上下文隔离：两条分支路径不同', JSON.stringify(pathA) !== JSON.stringify(pathB));
t('上下文隔离：路径只含本支祖先', !pathA.includes(a3.id) && !pathB.includes(a1.id));
const txt = linearize(d, a1.id, { format: 'txt' });
t('上下文文本不含他支内容', !txt.includes('并发模型简单'));

// ---------- ⑦ 总览 ----------
const ov = conversationOverview(d);
t('总览：拓扑与角色可见', ov.speakers.length >= 4);

console.log(`\n${pass}/${pass + fail} 通过`);
