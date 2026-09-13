#!/usr/bin/env python3
"""OmniFlow 全量审计 + 推送（GitHub Contents API）。

设计要点（都是踩过的坑换来的）：
  1. **清单驱动 → 目录遍历驱动**：以前靠手写 FILES 列表，新模块（如 lib/latex.js）
     忘了加进去就永远推不上，而远端 server 已 import 它 → 线上直接坏掉。现在自动遍历仓库。
  2. **远端状态用 git/trees API 一次拿全**：不再逐文件 GET（大文件 GET 会 404，
     会把报错体误当 sha → 假"已存在"）。
  3. **推送后用递归 tree 复核**，而不是相信 PUT 的返回；大文件也一样能核。
  4. 跳过 .git / node_modules / .bak / .DS_Store / 日志 / 临时目录。

用法：
  /usr/bin/python3 tools/audit-push.py            # 审计并推送差异
  /usr/bin/python3 tools/audit-push.py --dry-run  # 只审计不推送
"""
import base64
import os
import subprocess
import sys
import time

REPO_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GH = "/opt/homebrew/bin/gh"
GIT = "/usr/bin/git"
REPO_SLUG = "kanghelyu/omni-flow"
BRANCH = "main"
DRY = "--dry-run" in sys.argv

SKIP_DIRS = {".git", "node_modules", ".bak", ".omni-flow", "trash", "__pycache__", ".venv"}
SKIP_FILES = {".DS_Store", ".gitignore"}  # .gitignore 由远端自行维护
SKIP_SUFFIX = (".log", ".pyc", ".tmp", ".swp")

os.chdir(REPO_DIR)


def run(cmd, input_text=None):
    r = subprocess.run(cmd, capture_output=True, text=True, input=input_text)
    return r.returncode, r.stdout.strip(), r.stderr.strip()


def local_files():
    out = []
    for dp, dn, fn in os.walk(REPO_DIR):
        dn[:] = [d for d in dn if d not in SKIP_DIRS and not d.startswith(".")]
        for f in fn:
            if f in SKIP_FILES or f.endswith(SKIP_SUFFIX):
                continue
            out.append(os.path.relpath(os.path.join(dp, f), REPO_DIR))
    return sorted(out)


def blob_sha(path):
    rc, out, _ = run([GIT, "hash-object", path])
    return out if rc == 0 and out else None


def remote_tree():
    """一次拿全远端 blob: path -> sha（--jq 输出是紧凑 JSON 数组字符串）"""
    rc, out, err = run([GH, "api", f"repos/{REPO_SLUG}/git/trees/{BRANCH}?recursive=1"])
    if rc != 0:
        print(f"!! 无法读取远端 tree: {err[:200]}", file=sys.stderr)
        sys.exit(2)
    import json
    data = json.loads(out)
    return {item["path"]: item["sha"] for item in data.get("tree", []) if item.get("type") == "blob"}


def push(path, msg, remote_sha):
    with open(path, "rb") as fh:
        b64 = base64.b64encode(fh.read()).decode("ascii")
    payload = {"message": msg, "content": b64}
    if remote_sha:
        payload["sha"] = remote_sha
    rc, out, err = run(
        [GH, "api", "--method", "PUT", f"repos/{REPO_SLUG}/contents/{path}", "--input", "-"],
        input_text=__import__("json").dumps(payload),
    )
    return rc == 0, (out or err)[:120]


local = local_files()
remote = remote_tree()

missing = [p for p in local if p not in remote]
changed = [p for p in local if p in remote and blob_sha(p) != remote[p]]

print(f"本地 {len(local)} 文件 | 远端 {len(remote)} blob")
print(f"缺失 {len(missing)} | 内容不一致 {len(changed)}")
for p in missing:
    print("  ✗ 远端缺失", p)
for p in changed:
    print("  ↻ 需更新  ", p)

if not missing and not changed:
    print("\n✅ 完全同步，无需推送。")
    sys.exit(0)

if DRY:
    print("\n(--dry-run：未推送)")
    sys.exit(0)

failed = []
for p in missing + changed:
    ok, info = push(p, "sync: align remote with local workspace", remote.get(p))
    if not ok:
        time.sleep(2)
        ok, info = push(p, "sync: align remote with local workspace", remote.get(p))
    if ok:
        print("  ↑ 已推送", p)
    else:
        failed.append((p, info))
        print("  ! 失败  ", p, "——", info)

# —— 用递归 tree 复核（不信 PUT 返回）——
time.sleep(2)
remote2 = remote_tree()
still = [p for p in local if p not in remote2 or blob_sha(p) != remote2[p]]
print("\n=== 复核 ===")
print(f"仍未同步: {len(still)}" + ((" → " + ", ".join(still[:10])) if still else " ✅"))
if failed:
    for p, why in failed:
        print("  ✗", p, "——", why)
sys.exit(1 if (failed or still) else 0)
