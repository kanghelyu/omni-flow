#!/bin/zsh
# OmniFlow Studio 启动器（macOS / Linux）——双击即可运行
# 自动定位 Node.js、自动选择空闲端口、自动打开浏览器；关掉窗口即停止。

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
  echo "  ✗ 未找到 Node.js 18 或更高版本。"
  echo "    请到 https://nodejs.org/ 下载并安装 LTS 版后重试。"
  echo ""
  read -r "?  按回车键关闭…"
  exit 1
fi

# 从 4319 起找空闲端口
PORT="${OF_STUDIO_PORT:-4319}"
while [ "$PORT" -lt 4400 ]; do
  if ! "$NODE_BIN" -e "require('net').createServer().once('error',()=>process.exit(1)).once('listening',function(){this.close();process.exit(0)}).listen($PORT,'127.0.0.1')" 2>/dev/null; then
    PORT=$((PORT + 1)); continue
  fi
  break
done

echo ""
echo "  OmniFlow Studio  →  http://127.0.0.1:$PORT"
echo "  关闭此窗口（或按 Ctrl+C）即停止服务。"
echo ""

exec "$NODE_BIN" ./bin/of.mjs studio --port "$PORT"
