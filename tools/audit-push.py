#!/usr/bin/env python3
"""OmniFlow 全量审计 + 推送（GitHub Contents API）。

设计要点（都是踩过的坑换来的）：
  1. **清单驱动 → 目录遍历驱动**：以前靠手写 FILES 列表，新模块（如 lib/latex.js）
     忘了加进去就永远推不上，而远端 server 已 import 它 → 线上直接坏掉。现在自动遍历仓库。
  2. **远端状态用 git/trees API 一次拿全**：不再逐文件 GET（大文件 GET 会 404，
     会把报错体误当 sha → 假"已存在"）。
  3. **推送后用递归 tree 复核**，而不是相信 PUT 的返回；大文件也一样能核。
  4. 跳过 .git / node_modules / .bak / .DS_Store / 日志 / 临时目录 / **运行时状态**。

安全约束（2026-09-16 事故后新增，别删）：
  · **必须在完整检出目录里运行**，不能在安装目录 ~/.omni-flow 里运行。
    安装目录含有 graphs/ 等运行时状态，而安装目录 ≠ 仓库内容 → 会把私人图谱库推上公开仓库。
    现在有守卫：只要 REPO_DIR 里出现运行时路径就直接拒绝运行。
  · **只认 --dry-run 一个参数**：以前任何未识别参数（包括 --help）都落到"正式推送"分支，
    曾因此误推。现在未知参数直接报错退出，什么都不做。

用法：
  /usr/bin/python3 tools/audit-push.py            # 审计并推送差异
  /usr/bin/python3 tools/audit-push.py --dry-run  # 只审计不推送
"""
import base64
import json
import os
import subprocess
import sys
import time

USAGE = "用法: python3 tools/audit-push.py [--dry-run]"

# —— 参数解析：宁可拒绝，也不要猜 ——
_args = sys.argv[1:]
_unknown = [a for a in _args if a != "--dry-run"]
if _unknown:
    print(f"!! 不支持的参数: {' '.join(_unknown)}", file=sys.stderr)
    print("   （本脚本不解析其它参数；为避免误推送，未识别参数一律拒绝执行）", file=sys.stderr)
    print(USAGE, file=sys.stderr)
    sys.exit(2)

REPO_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GH = "/opt/homebrew/bin/gh"
GIT = "/usr/bin/git"
REPO_SLUG = "kanghelyu/omni-flow"
BRANCH = "main"
DRY = "--dry-run" in _args

# —— 仓库内容 vs 运行时状态 ——
REPO_MARKERS = {"studio/app.js", "package.json", "lib"}          # 有这些才像是在检出里跑
RUNTIME_PATHS = {                                                 # 有这些就绝不是检出
    "graphs", "templates", "tree.json", "crosslinks.json",
    "live-conversation.json", "WORKLOG.txt", "trash", ".omni-flow",
}
SKIP_DIRS = {".git", "node_modules", ".bak", ".omni-flow", "trash", "__pycache__", ".venv",
             "graphs", "templates"}
SKIP_FILES = {".DS_Store", ".gitignore", "tree.json", "crosslinks.json",
              "live-conversation.json", "WORKLOG.txt"}  # .gitignore is maintained on the remote
SKIP_SUFFIX = (".log", ".pyc", ".tmp", ".swp")

os.chdir(REPO_DIR)

# —— 守卫：在安装目录里运行会泄露私人数据，直接拒绝 ——
_present = sorted(p for p in RUNTIME_PATHS if os.path.exists(os.path.join(REPO_DIR, p)))
_missing_markers = sorted(m for m in REPO_MARKERS if not os.path.exists(os.path.join(REPO_DIR, m)))
if _present or _missing_markers:
    print("!! 拒绝运行：这个目录看起来不是 OmniFlow 的完整检出。", file=sys.stderr)
    print(f"   目录: {REPO_DIR}", file=sys.stderr)
    if _present:
        print(f"   发现运行时状态: {', '.join(_present)}", file=sys.stderr)
        print("   → 这些是本机使用数据，不属于仓库内容；推上去会公开你的私人图谱库。", file=sys.stderr)
    if _missing_markers:
        print(f"   缺少仓库标志: {', '.join(_missing_markers)}", file=sys.stderr)
    print("   请在完整检出目录里运行本脚本（例如 repo 的 clone／镜像目录），"
          "不要用安装目录 ~/.omni-flow。", file=sys.stderr)
    sys.exit(3)



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
    """一次拿全远端 blob: path -> sha（--jq 输出是紧凑 JSON 数组字符串）

    全新仓库没有任何提交时，git/trees 会返回 HTTP 409 "Git Repository is empty"。
    这不是错误而是"远端为空"——若直接退出，刚 clone／刚建的空仓库就永远推不上第一版。
    只对这一个明确情形宽容；其它错误（鉴权失败等）仍然中止，避免误判成"远端什么都没有"
    而把全部文件重推一遍。
    """
    rc, out, err = run([GH, "api", f"repos/{REPO_SLUG}/git/trees/{BRANCH}?recursive=1"])
    if rc != 0:
        if "409" in err or "is empty" in err.lower():
            print("· 远端仓库为空（尚无提交）：将按首次推送处理。")
            return {}
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
        input_text=json.dumps(payload),
    )
    return rc == 0, (out or err)[:120]


local = local_files()
remote = remote_tree()

missing = [p for p in local if p not in remote]
changed = [p for p in local if p in remote and blob_sha(p) != remote[p]]

extra = [p for p in remote if p not in local]

print(f"local {len(local)} files | remote {len(remote)} blobs")
print(f"missing {len(missing)} | changed {len(changed)} | remote-only {len(extra)}")
for p in missing:
    print("  ✗ missing on remote", p)
for p in changed:
    print("  ↻ needs update   ", p)
for p in extra:
    print("  ✂ remote-only    ", p)

if not missing and not changed:
    print("\n✅ 完全同步，无需推送。")
    sys.exit(0)

if DRY:
    print("\n(--dry-run: nothing pushed)")
    sys.exit(0)

failed = []
for p in missing + changed:
    ok, info = push(p, "sync: align remote with local workspace", remote.get(p))
    if not ok:
        time.sleep(2)
        ok, info = push(p, "sync: align remote with local workspace", remote.get(p))
    if ok:
        print("  ↑ pushed", p)
    else:
        failed.append((p, info))
        print("  ! FAILED", p, "——", info)

# —— Delete remote files that no longer exist locally (renames, removals) ——
# Without this, a file deleted locally lingers on GitHub and the repo drifts.
for p in extra:
    rc, out, err = run([GH, "api", "--method", "DELETE",
                        f"repos/{REPO_SLUG}/contents/{p}",
                        "--input", "-"],
                       input_text=json.dumps({"message": "sync: remove file deleted locally", "sha": remote[p]}))
    if rc == 0:
        print("  ✂ deleted", p)
    else:
        failed.append((p, (out or err)[:120]))
        print("  ! FAILED to delete", p, "——", (out or err)[:120])

# —— Re-verify with the recursive tree (never trust the PUT/DELETE response) ——
time.sleep(2)
remote2 = remote_tree()
still = [p for p in local if p not in remote2 or blob_sha(p) != remote2[p]]
extra2 = [p for p in remote2 if p not in local]
print("\n=== verify ===")
print(f"still out of sync: {len(still)}" + ((" → " + ", ".join(still[:10])) if still else " ✅"))
print(f"remote extras: {len(extra2)}" + ((" → " + ", ".join(extra2[:10])) if extra2 else " ✅"))
if failed:
    for p, why in failed:
        print("  ✗", p, "——", why)
sys.exit(1 if (failed or still or extra2) else 0)
