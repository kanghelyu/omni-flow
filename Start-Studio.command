#!/bin/zsh
# OmniFlow Studio launcher (macOS / Linux) — double-click to run
# Locates Node.js, picks a free port and opens the browser; closing the window stops the server.

cd "$(dirname "$0")"

find_node() {
  for c in node /opt/homebrew/bin/node /usr/local/bin/node "$HOME/.nvm/versions/node"/*/bin/node; do
    if [ -x "$c" ] || command -v "$c" >/dev/null 2>&1; then
      if "$c" -e 'process.exit(process.versions.node.split(".")[0] >= 18 ? 0 : 1)' 2>/dev/null; then
        echo "$c"; return 0
      fi
    fi
  done
  return 1
}

NODE_BIN="$(find_node)"
if [ -z "$NODE_BIN" ]; then
  echo ""
  echo "  ✗ Node.js 18 or newer was not found."
  echo "    Install the LTS build from https://nodejs.org/ and try again."
  echo ""
  read -r "?  Press Enter to close…"
  exit 1
fi

# Look for a free port starting at 4319
PORT="${OF_STUDIO_PORT:-4319}"
while [ "$PORT" -lt 4400 ]; do
  if ! "$NODE_BIN" -e "require('net').createServer().once('error',()=>process.exit(1)).once('listening',function(){this.close();process.exit(0)}).listen($PORT,'127.0.0.1')" 2>/dev/null; then
    PORT=$((PORT + 1)); continue
  fi
  break
done

echo ""
echo "  OmniFlow Studio  →  http://127.0.0.1:$PORT"
echo "  Close this window (or press Ctrl+C) to stop the server."
echo ""

exec "$NODE_BIN" ./bin/of.mjs studio --port "$PORT"
