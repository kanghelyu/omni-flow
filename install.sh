#!/usr/bin/env bash
# OmniFlow installer — macOS / Linux. Zero dependencies: copies the runtime, links the CLI, deploys the companion skill.
# The skill is installed into the ZCode / Claude Code / WorkBuddy / Codex skill directories so those agents can use it immediately.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${OF_INSTALL_DIR:-$HOME/.omni-flow}"
BIN_DIR="${OF_BIN_DIR:-$HOME/.local/bin}"

fail() { printf 'OmniFlow install: %s\n' "$1" >&2; exit 1; }
# Locate node: PATH first, then the usual install locations (WorkBuddy managed / Homebrew / nvm)
find_node() {
  if command -v node >/dev/null 2>&1; then printf '%s' "$(command -v node)"; return; fi
  local cand
  for cand in \
    "$HOME/.workbuddy/binaries/node/versions"/*/bin/node \
    /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node \
    "$HOME/.nvm/versions/node"/*/bin/node; do
    [ -x "$cand" ] && { printf '%s' "$cand"; return; }
  done
  return 1
}
NODE="$(find_node)" || fail 'Node.js >= 18 is required (not found in PATH or common locations).'
"$NODE" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)' || fail "Node.js >= 18 is required (found $("$NODE" --version))."
# Use the node we found for every later call (including the path written into the generated MCP config)
export PATH="$(dirname "$NODE"):$PATH"

mkdir -p "$INSTALL_DIR" "$BIN_DIR"
for item in bin lib studio skills docs; do
  [ -d "$HERE/$item" ] || continue
  rm -rf "$INSTALL_DIR/$item"
  cp -R "$HERE/$item" "$INSTALL_DIR/$item"
done
for item in package.json README.md LICENSE install.sh install.ps1; do
  [ -e "$HERE/$item" ] && cp -f "$HERE/$item" "$INSTALL_DIR/$item"
done
chmod +x "$INSTALL_DIR/bin/of.mjs"

# —— Companion skill install: deployed together with the plugin ——
# Prefer a symlink (single source of truth; upgrading ~/.omni-flow updates every host), fall back to a copy.
install_skill() {
  local target="$1"
  mkdir -p "$(dirname "$target")"
  rm -rf "$target"
  ln -s "$INSTALL_DIR/skills/omni-flow" "$target" 2>/dev/null || cp -R "$HERE/skills/omni-flow" "$target"
}
install_skill "$HOME/.zcode/skills/omni-flow"
install_skill "$HOME/.claude/skills/omni-flow"
[ -d "$HOME/.workbuddy" ] && install_skill "$HOME/.workbuddy/skills/omni-flow" || true   # 只在该宿主存在时部署，不给其他机器造目录
CODEX_HOME_DIR="${CODEX_HOME:-$HOME/.codex}"
install_skill "$CODEX_HOME_DIR/skills/omni-flow"

ln -sfn "$INSTALL_DIR/bin/of.mjs" "$BIN_DIR/of"

version="$(node -e 'const fs = require("node:fs"); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).version)' "$INSTALL_DIR/package.json")"
printf 'OmniFlow %s installed at %s\n' "$version" "$INSTALL_DIR"
printf 'CLI: %s/of (ensure %s is on PATH)\n' "$BIN_DIR" "$BIN_DIR"
printf 'Skills (symlinked to %s/skills/omni-flow): ~/.zcode, ~/.claude, ~/.workbuddy, %s\n' "$INSTALL_DIR" "$CODEX_HOME_DIR"
printf 'MCP (optional, any MCP client): {"mcpServers":{"omni-flow":{"command":"%s/of","args":["mcp"]}}}\n' "$BIN_DIR"
printf 'Run: of --version && of doctor\n'
"$BIN_DIR/of" --version
