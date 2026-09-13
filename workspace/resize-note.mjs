// Top the demo-1 note up to ~40k chars (32 chapters) on the already-created graph, re-verify.
import { createHash } from "node:crypto";
const BASE = "http://127.0.0.1:4319";
const j = async (p, opt) => {
  const r = await fetch(BASE + p, { headers: { "content-type": "application/json" }, ...opt });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${p} → ${r.status}`);
  return data;
};
const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16);

const G1 = "示例1超长详情测试-h3i4", nid = "n1";
const ch = (i) => `## 第 ${i} 章 · 判据的传递与使用（第 ${i} 号笔记）

这一章演示**详情字段对超长内容没有任何截断**。整段笔记连同 Markdown 结构、行内公式 $f$ 与 $f'$、
以及下方的显示公式，都会原样保存、原样读回、原样渲染。判定一个元素 $a \\in A$ 是否可操作，
需要 ${i} 号判据链完整闭合：上游给出存在性，下游给出构造性算法，二者缺一不可。

> 阅读提示：这一段是引用块。第 ${i} 章的关键词是「判据闭合」「可操作」「互素条件」，它们在全文中
> 反复出现，用于检查长文的首尾一致性——如果详情被截断，末尾章节的关键词就会丢失。

具体展开如下：

1. 先固定记号：$K$ 是特征 $0$ 的数域，$\\alpha, \\beta \\in \\bar K$，判据 $\\Phi_{${i}}(\\alpha,\\beta)$ 表示
   「$\\alpha$ 与 $\\beta$ 在 $K$ 上生成的子域具有相同的交」。
2. 判据 $\\Phi_{${i}}$ 的验证分三步：局部化、消元、回代。每一步的中间产物都写进详情，
   因此这一章故意写得很长，用来压测详情字段。
3. 消元一步依赖结式 $\\operatorname{Res}_x(P_{${i}}, Q_{${i}})$，其中

$$P_{${i}}(x) = x^{3} - ${i}x + 1, \\qquad Q_{${i}}(x) = x^{2} + ${i}x - 1,$$

   结式为零的充要条件是两式有公共根，这对应判据链在此处**分叉**的情形。
4. 把上面四步重复用于每一个共轭类，就得到第 ${i} 章的判定表（略）。
5. 本章小结：判据 $\\Phi_{${i}}$ 在第 ${i} 轮迭代后收敛，输出与第 $${i}$$ 节一致。

补充说明（重复段，用于把体积推到数万字）：判据的传递本质上是把「存在性命题」翻译成
「可计算判别」。翻译过程中最容易丢失的是边界条件：例如 $\\operatorname{char} K = 0$ 排除了
Wilderstein 现象，$f$ 与 $f'$ 互素排除了重根情形，而重根情形需要单独的二阶判据。
这些边界条件在每章都重复出现，是有意为之——请把本卡当作详情容量的压测样本，
而不是数学内容来读。以下再重复若干段同构的文字以增加篇幅。

判据 $\\Phi_{${i}}$ 的代数背景：设 $A$ 是有限型 $K$-代数，$\\mathfrak{m}$ 是它的一个极大理想，
$\\hat{A}_{\\mathfrak{m}}$ 是完备化。判据关心的是 $\\hat{A}_{\\mathfrak{m}}$ 中可逆元的可构造性：
在什么条件下「$\\Phi_{${i}}$ 在特殊化后仍成立」可以从一般情形推出。答案由 Greenberg 代几何给出，
但那个结果是存在性的；本笔记的目标是把第 ${i} 个特例做成显式算法。算法的骨架写在第 3 步，
数值实验写在第 4 步，理论证明写在第 5 步。三者的编号与本章的章号 ${i} 保持一致，
方便在长文中定位。`;
let note = `# 超长详情压测样本\n\n> 本卡用于验证「详情可以写巨多字」：全文约 4 万字（32 章），含 Markdown 结构与 LaTeX 公式。\n> 保存后逐字节读回校验（sha256 一致），并在此渲染为带公式的富文本。\n\n---\n\n`;
for (let i = 1; i <= 32; i++) note += ch(i);
note += `\n---\n\n**【全文结束】** 如果你能在「详情全文」里看到这一行，说明 4 万字一个字都没丢。\n`;
const t0 = Date.now();
await j(`/api/graph/${G1}/note`, { method: "POST", body: JSON.stringify({ nodeId: nid, content: note }) });
const writeMs = Date.now() - t0;
const back = await j(`/api/graph/${G1}/note/${encodeURIComponent(nid)}`);
console.log(`note chars = ${note.length}, write = ${writeMs}ms, read back chars = ${back.content.length}, sha 一致 = ${sha(note) === sha(back.content)}`);
