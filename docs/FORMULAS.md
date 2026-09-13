# OmniFlow 公式书写规则

只要按下面的规则写，OmniFlow 就能把公式**正确编译**出来。这份文档同时内置于应用的「? 公式规则」按钮里。

---

## 一、四种定界符（最常用）

| 写法 | 效果 | 示例 |
| --- | --- | --- |
| `$...$` | **行内**公式（跟文字并排） | 当 `$x>0$` 时… |
| `$$...$$` | **独立成行**的显示公式（居中、字号大） | `$$\int_0^1 x^2\,dx=\frac13$$` |
| `\(...\)` | 同 `$...$`（LaTeX 习惯写法） | `\(a^2+b^2=c^2\)` |
| `\[...\]` | 同 `$$...$$` | `\[\sum_{k=1}^n k=\frac{n(n+1)}2\]` |

> 记不住就统一用 `$...$` 和 `$$...$$`。

---

## 二、不带定界符也能编译（粘贴论文源码时无需改造）

OmniFlow 会自动识别三类「没有 `$` 的公式」：

1. **整行是公式** → 当成显示公式
   ```
   \frac{\partial f}{\partial x}=\lim_{h\to 0}\frac{f(x+h)-f(x)}{h}
   ```
2. **行内命令出现在句子中** → 只把命令那一段当公式
   ```
   化学反应：\ce{2H2 + O2 -> 2H2O} 的焓变约为 -286 kJ/mol
   定义：设 \mathfrak{g}=\mathfrak{sl}_2(\mathbb{C})，则……
   ```
3. **整段论文源码** → 自动剥掉导言区，只编译正文
   ```
   \documentclass{article}
   \usepackage{amsmath}
   \begin{document}
   主结果：$\int_0^\infty e^{-x^2}dx=\frac{\sqrt{\pi}}{2}$
   \end{document}
   ```

> 注意：**普通英文句子不会被误判成公式**（如 “x is algebraic over K” 会原样显示）。

---

## 三、会被自动「翻译」的写法（你不用改）

粘贴真实论文时经常出现下面这些，OmniFlow 会自动处理后编译：

| 你写的 | 自动变成 | 说明 |
| --- | --- | --- |
| `\tag{1.2}` | `（1.2）` 文本 | 行内模式下 KaTeX 不允许 `\tag`，会自动转文本 |
| `\label{eq:1}` `\nonumber` | 删除 | 编号锚点对显示无意义 |
| `\bm{v}` | `\boldsymbol{v}` | 粗体向量 |
| `\cite{knuth}` | `[knuth]` | 引用转成可读文本 |
| `\eqref{eq:1}` `\ref{eq:1}` | `(eq:1)` / `eq:1` | 交叉引用转文本 |
| `\SI{9.8}{\meter\per\second\squared}` | `9.8 m/s²` | siunitx 单位转文本 |
| `\begin{align}…\end{align}` | `\begin{aligned}…\end{aligned}` | 保留对齐结构 |
| `\begin{gather}…\end{gather}` | `\begin{gathered}…` | 同上 |
| `\documentclass` `\usepackage` | 删除 | 导言区剥离 |
| `%` 注释 | 删除 | |
| `\sideset{_a^b}{_c^d}\sum` | `\sum_a^b_c^d` | |

---

## 四、明确不支持（会**降级显示原文**，不会报错、不会丢内容）

| 写法 | 结果 |
| --- | --- |
| `\begin{tikzpicture}…\end{tikzpicture}` | 显示占位提示 `[tikzpicture: 网页不支持该环境，此处省略]` |
| `\begin{figure}` `\begin{table}` `\begin{lstlisting}` | 同上 |
| `\includegraphics{...}` | 删除（图片请用「＋ 附件」上传） |
| 自定义宏（`\newcommand` 定义的） | 无法展开 → 显示原文 |

---

## 五、化学式

用 `\ce{...}`（已内置 mhchem 扩展）：

```latex
\ce{2H2 + O2 -> 2H2O}
\ce{SO4^2- + Ba^2+ -> BaSO4 v}
\ce{H2O <=> H+ + OH-}
```

---

## 六、编译不出来时，按这个清单排查

1. **花括号是否配对** —— 最常见原因。`\frac{a}{b` 少一个 `}` 就整段失败。
2. **是否用了没定义的自定义宏** —— 只支持 KaTeX 内置命令 + 上表列出的替换。
3. **是否嵌套了 `$`** —— `$a $b$ c$` 会切错；公式内部不要再写 `$`。
4. **下划线/上标后是否紧贴** —— `x_1` 可以，`x_` 后面必须有内容。
5. **`\tag` 是否出现在行内 `$...$` 里** —— 现在会自动转换，若仍失败请改用 `$$...$$`。
6. **矩阵/方程组环境**：`pmatrix` `bmatrix` `cases` `array` 支持；行内用 `\begin{smallmatrix}`。
7. **仍有问题**：公式会**原样显示**并在角落标 `⚠ LaTeX 未渲染（原文保留）`——内容不会丢，照着上面改即可。

---

## 七、速查：最容易写错的 5 组

| ❌ 容易失败 | ✅ 正确写法 |
| --- | --- |
| `\frac{a}{b` | `\frac{a}{b}` |
| `x^2^3` | `x^{2^3}` |
| `\sqrt[3}x` | `\sqrt[3]{x}` |
| `\lim_{x→0}` | `\lim_{x\to 0}` |
| `\ce{2H2+O2->2H2O}` 在 `$…$` 内混中文 | `\ce{...}` 单独写，中文放公式外 |
