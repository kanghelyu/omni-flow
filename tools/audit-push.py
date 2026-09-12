#!/usr/bin/env python3
"""OmniFlow repo full audit + push (absolute paths, non-empty check, backoff retry)."""
import subprocess, os, sys, time

REPO_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GH = "/opt/homebrew/bin/gh"
GIT = "/usr/bin/git"
FILES = [
    "HANDOFF.md", "LICENSE", "package.json", "README.md", "README.zh-CN.md",
    "studio/index.html", "studio/server.mjs",
    "lib/vault.js", "lib/mcp-server.mjs", "lib/converters.js",
    "lib/group-suggest.js", "lib/search.mjs", "lib/templates.js", "lib/graph-service.mjs",
    "lib/graph-core.js", "lib/graph-analysis.js",
    "bin/of.mjs",
    "skills/omni-flow/SKILL.md",
    "docs/API.md", "docs/API.en.md", "docs/TUTORIAL.md", "docs/TUTORIAL.zh-CN.md",
]
os.chdir(REPO_DIR)

def run(cmd, input_text=None):
    r = subprocess.run(cmd, capture_output=True, text=True, input=input_text)
    return r.returncode, r.stdout.strip(), r.stderr.strip()

def local_sha(path):
    rc, out, _ = run([GIT, "hash-object", path])
    return out if rc == 0 and out else None

def remote_info(path):
    rc, out, _ = run([GH, "api", f"repos/kanghelyu/omni-flow/contents/{path}", "--jq", ".sha"])
    return out if rc == 0 and out else None

def push(path, msg):
    rc, b64, err = run(["/usr/bin/base64", "-i", path])
    if rc != 0 or not b64:
        return False, "base64 fail"
    sha = remote_info(path)
    payload = '{"message":"%s","content":"%s"%s}' % (msg, b64, (',"sha":"%s"' % sha) if sha else "")
    rc, out, err = run([GH, "api", "--method", "PUT",
                        f"repos/kanghelyu/omni-flow/contents/{path}", "--input", "-"], input_text=payload)
    return rc == 0 and out.startswith(""), (out or err)[:80]

changed, ok, failed = [], [], []
for f in FILES:
    l = local_sha(f)
    r = remote_info(f)
    if not l:
        failed.append((f, "local read fail")); continue
    if l == r:
        ok.append(f); continue
    changed.append(f)
    info = ""
    for attempt in range(3):
        pushed, info = push(f, "sync: align with local (audit repair)")
        if pushed:
            r2 = remote_info(f)
            if r2 == l:
                ok.append(f); break
        time.sleep(3 * (attempt + 1))
    else:
        failed.append((f, info))

print("=== In sync ===")
for f in ok: print("✓", f)
if changed: print("=== Pushed ===")
for f in changed: print("↻", f)
if failed: print("=== Failed ===")
for f, why in failed: print("✗", f, "——", why)
print(f"\nTotal {len(FILES)} | In sync {len(ok)} | Pushed {len(changed)} | Failed {len(failed)}")
sys.exit(1 if failed else 0)
