# OmniFlow formula rules

Follow the rules below and OmniFlow will compile your formulas **correctly**. The same content is built into the app's "? Formula rules" panel.

---

## 1. The four delimiters

| Syntax | Result | Example |
| --- | --- | --- |
| `$...$` | **Inline** math (runs with the text) | when `$x>0$` then… |
| `$$...$$` | **Display** math on its own line (centred, larger) | `$$\int_0^1 x^2\,dx=\frac13$$` |
| `\(...\)` | Same as `$...$` (standard LaTeX habit) | `\(a^2+b^2=c^2\)` |
| `\[...\]` | Same as `$$...$$` | `\[\sum_{k=1}^n k=\frac{n(n+1)}2\]` |

> If you cannot remember them, stick to `$...$` and `$$...$$`.

---

## 2. Formulas without delimiters (paste paper source as-is)

OmniFlow detects three kinds of math that carry no `$`:

1. **A line that is entirely a formula** → treated as display math
   ```
   \frac{\partial f}{\partial x}=\lim_{h\to 0}\frac{f(x+h)-f(x)}{h}
   ```
2. **An inline command inside a sentence** → only that command becomes math
   ```
   Reaction: \ce{2H2 + O2 -> 2H2O} has an enthalpy change of about -286 kJ/mol
   Definition: let \mathfrak{g}=\mathfrak{sl}_2(\mathbb{C}), then …
   ```
3. **A whole LaTeX document** → the preamble is stripped and only the body is compiled
   ```
   \documentclass{article}
   \usepackage{amsmath}
   \begin{document}
   Main result: $\int_0^\infty e^{-x^2}dx=\frac{\sqrt{\pi}}{2}$
   \end{document}
   ```

> Plain English sentences are **not** misdetected as formulas (e.g. "x is algebraic over K" is shown verbatim).

---

## 3. Rewrites applied automatically (no action needed)

Real paper source contains these constantly; OmniFlow normalises them before compiling:

| You write | Becomes | Why |
| --- | --- | --- |
| `\tag{1.2}` | the text `(1.2)` | KaTeX forbids `\tag` in inline mode; it is converted to a text number |
| `\label{eq:1}` `\nonumber` | removed | numbering anchors are meaningless for display |
| `\bm{v}` | `\boldsymbol{v}` | bold vector |
| `\cite{knuth}` | `[knuth]` | citation becomes readable text |
| `\eqref{eq:1}` `\ref{eq:1}` | `(eq:1)` / `eq:1` | cross-references become text |
| `\SI{9.8}{\meter\per\second\squared}` | `9.8 m/s²` | siunitx units become text |
| `\begin{align}…\end{align}` | `\begin{aligned}…\end{aligned}` | alignment is preserved |
| `\begin{gather}…\end{gather}` | `\begin{gathered}…` | same |
| `\documentclass` `\usepackage` | removed | preamble is stripped |
| `%` comments | removed | |
| `\sideset{_a^b}{_c^d}\sum` | `\sum_a^b_c^d` | |

---

## 4. Explicitly unsupported (degrades to the source text — never an error, never lost content)

| You write | Result |
| --- | --- |
| `\begin{tikzpicture}…\end{tikzpicture}` | placeholder: `[tikzpicture: this environment is not supported on the web, omitted here]` |
| `\begin{figure}` `\begin{table}` `\begin{lstlisting}` | same |
| `\includegraphics{...}` | removed (attach images with "＋ Attach" instead) |
| Self-defined macros (`\newcommand`) | cannot be expanded → the source is shown |

---

## 5. Chemistry

Use `\ce{...}` (the mhchem extension is bundled):

```latex
\ce{2H2 + O2 -> 2H2O}
\ce{SO4^2- + Ba^2+ -> BaSO4 v}
\ce{H2O <=> H+ + OH-}
```

---

## 6. Troubleshooting checklist

1. **Are the delimiters closed?** — an unclosed `$`, `$$`, `\(` or `\[` silently swallows the rest of the text:
   it shows as plain prose and nothing is reported. Write `\$` for a literal dollar sign.
2. **Are the braces balanced?** — the next most common cause. `\frac{a}{b` fails the whole fragment.
3. **Did you use an undefined macro?** — only KaTeX built-ins plus the substitutions in the table above are supported.
4. **Did you nest `$`?** — `$a $b$ c$` splits wrongly; never write `$` inside a formula.
5. **Is something attached after `_` or `^`?** — `x_1` is fine, a bare `x_` is not.
6. **Is `\tag` inside inline `$...$`?** — it is auto-converted now; if it still fails, switch to `$$...$$`.
7. **Matrix / system environments**: `pmatrix`, `bmatrix`, `cases` and `array` are supported; use `\begin{smallmatrix}` inline.
8. **Still broken?** — the formula is shown **verbatim** with a corner badge `⚠ LaTeX not rendered (source kept)`. Nothing is lost; fix it using the list above.

---

## 7. Quick reference: the five most common mistakes

| ❌ Fails | ✅ Correct |
| --- | --- |
| `\frac{a}{b` | `\frac{a}{b}` |
| `x^2^3` | `x^{2^3}` |
| `\sqrt[3}x` | `\sqrt[3]{x}` |
| `\lim_{x→0}` | `\lim_{x\to 0}` |
| `$\iff$ $` (unclosed) | `$\iff$` — close every `$` |
| `\ce{2H2+O2->2H2O}` mixed with prose inside `$…$` | write `\ce{...}` on its own, prose outside the formula |
