#!/usr/bin/env python3
"""最终装配：人工卡片表 + 跨书链接 + 总览 + 小节图；并测量跨书解析率"""
import os, json, re, subprocess, glob

REPO = '/Users/andylyu/WorkBuddy/2026-09-11-12-31-54/omni-flow'
NODE = '/Users/andylyu/.workbuddy/binaries/node/versions/22.22.2-3/bin/node'
CLI = f'{REPO}/bin/of.mjs'
B = '/tmp/nt2/Number Theory(Samuel)-Chapter 2'
HOME = os.path.expanduser('~/.omni-flow')

env = dict(os.environ); env.pop('OF_HOME', None)

def run(*args, label=None, tail=4):
    r = subprocess.run([NODE, CLI, *args], capture_output=True, text=True, cwd=REPO, env=env)
    out = (r.stdout + r.stderr).strip()
    if label:
        print(f'--- {label} ---')
        print('\n'.join(out.split('\n')[-tail:]))
    return out

# ① 导入人工卡片表
out = run('import-doc', f'{B}/build_data.py', '--name', 'Samuel 代数数论 第二章（卡表）', '--folder', '数学教材', '--lang', 'zh', label='① 导入人工卡片表', tail=6)
m = re.search(r'id: (\S+)', out)
gid = m.group(1) if m else ''
print('主图 id:', gid)

# ② 导入 30 条跨书链接
run('xlink', 'import', f'{B}/crosslinks.py', '--map', f'SAMUEL={gid},ALUFFI=Aluffi代数引论', label='② 跨书链接')

# ③ 测量解析率
g = json.load(open(f'{HOME}/graphs/{gid}/graph.json', encoding='utf-8'))
ids = {n['id'] for n in g['nodes']}
xl = json.load(open(f'{HOME}/crosslinks.json', encoding='utf-8'))
sam = [x for x in xl if gid in (x['from']['graph'], x['to']['graph'])]
hit, miss = 0, []
for x in sam:
    for side in ('from', 'to'):
        if x[side]['graph'] == gid:
            (hit := hit + 1) if x[side]['node'] in ids else miss.append(x[side]['node'])
print(f'--- ③ 跨书链接解析率 ---')
print(f'本图内引用命中 {hit} / {hit + len(miss)}  （{(hit / max(1, hit + len(miss)) * 100):.0f}%）')
if miss:
    print('未命中:', sorted(set(miss)))

# ④ 小节图
run('project', 'sections', gid, '--min', '4', '--folder', '数学教材/小节', label='④ 小节图', tail=3)

print('\n--- ⑤ 汇总 ---')
print(f'主图: {gid} — {len(g["nodes"])} 卡 · {len(g["edges"])} 人工依赖边 · {len(g.get("groups", []))} 分组')
cands = [d for d in os.listdir(f'{HOME}/graphs') if '章节总览' in d]
print(f'总览图: {cands}')
print(f'跨书链接: {len(xl)} 条')
