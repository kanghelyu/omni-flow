#!/usr/bin/env bash
# OmniFlow 安装器 — macOS / Linux。零依赖：复制运行时 + 软链 CLI + 自动投放配套 skill。
# skill 会装入 ZCode / Claude Code / Codex 的 skills 目录，装完即可被这些 agent 直接使用。
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${OF_INSTALL_DIR:-$HOME/.omni-flow}"
BIN_DIR="${OF_BIN_DIR:-$HOME/.local/bin}"

fail() { printf 'OmniFlow install: %s\n' "$1" >&2; exit 1; }
command -v node >/dev/null 2>&1 || fail 'Node.js >= 18 is required.'
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)' || fail "Node.js >= 18 is required (found $(node --version))."

mkdir -p "$INSTALL_DIR" "$BIN_DIR"
for item in bin lib studio skills docs; do
  [ -d "$HERE/$item" ] || continue
  rm -rf "$INSTALL_DIR/$item"
  cp -R "$HERE/$item" "$INSTALL_DIR/$item"
done
for item in package.json README.md README.zh-CN.md LICENSE install.sh install.ps1; do
  [ -e "$HERE/$item" ] && cp -f "$HERE/$item" "$INSTALL_DIR/$item"
done
chmod +x "$INSTALL_DIR/bin/of.mjs"

# —— 配套 skill 自动安装：与插件同装同更新 ——
# 优先软链（单一数据源，不散落副本；~/.omni-flow 升级即全端生效），失败则回退复制。
install_skill() {
  local target="$1"
  mkdir -p "$(dirname "$target")"
  rm -rf "$target"
  ln -s "$INSTALL_DIR/skills/omni-flow" "$target" 2>/dev/null || cp -R "$HERE/skills/omni-flow" "$target"
}
install_skill "$HOME/.zcode/skills/omni-flow"
install_skill "$HOME/.claude/skills/omni-flow"
CODEX_HOME_DIR="${CODEX_HOME:-$HOME/.codex}"
install_skill "$CODEX_HOME_DIR/skills/omni-flow"

ln -sfn "$INSTALL_DIR/bin/of.mjs" "$BIN_DIR/of"

version="$(node -e 'const fs = require("node:fs"); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).version)' "$INSTALL_DIR/package.json")"
printf 'OmniFlow %s installed at %s\n' "$version" "$INSTALL_DIR"
printf 'CLI: %s/of (ensure %s is on PATH)\n' "$BIN_DIR" "$BIN_DIR"
printf 'Skills (symlinked to %s/skills/omni-flow): ~/.zcode, ~/.claude, %s\n' "$INSTALL_DIR" "$CODEX_HOME_DIR"
printf 'MCP (optional, any MCP client): {"mcpServers":{"omni-flow":{"command":"%s/of","args":["mcp"]}}}\n' "$BIN_DIR"
printf 'Run: of --version && of doctor\n'
"$BIN_DIR/of" --version
