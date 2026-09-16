# OmniFlow 商用宣传素材（2026-09-12 重建版）

本目录是 OmniFlow 的产品介绍网页 + 宣传片 + 实操录屏，设计语言与 kanghelyu.org 主页一致
（深海黑 `#060d14`、青 `#a8e6e6` / 金 `#f4d9a0`、Georgia + Songti SC 衬线、玻璃拟态）。
**演示素材全部取自真实图数据**：「人心脏梗死后心肌细胞有丝分裂：证据链与文献依赖（Hume 2025）」中文图。

## 文件结构

| 文件 | 说明 |
| --- | --- |
| `index.html` | 产品介绍网页（单文件、中英切换、双视频内嵌、画廊灯箱） |
| `assets/shots/*.png` | Studio 实拍截图 ×10（3200×1800 无损降采样至 2400px） |
| `assets/omniflow_promo.mp4` | 60s 产品介绍片（1080p30，小何配音 + 《云里回声》BGM 句级 ducking + 宋体内嵌字幕，无数学片头） |
| `assets/demo.mp4` | 23s 实操录屏（1080p，PNG 无损帧采集 → H.264 CRF 17；拖节点 / 缩放平移 / 备注 / 搜索 / 聚簇布局，含光标指示环） |
| `assets/demo_poster.jpg` | 录屏海报帧 |
| `omni_flow_promo.py` `.srt` `*.mp4` `render/` | ⚠️ 上一版遗留物（Manim 方案，未采用），待所有者确认后清理 |

## 本地预览

```bash
# 直接打开
open promo/index.html
# 或由 Studio 托管（Studio 启动时）
node bin/of.mjs studio --port 4319
```

## 介绍片工程（可复跑）

配音/时间轴/渲染/混音工程位于数学工作区：
`~/Desktop/Script/superworkflow/math-workspace/projects/omniflow_promo_project/`
（explainer 8 场景 + spec `pipeline/specs/omniflow_promo.json` + TTS/bounds/timing 全套产物）。
预检 `event_timeline.py` 一次全绿（LAG 0.3 / GAP 0.6 / HOLD 0.5），总长 61.59s。

成片另有桌面交付副本：`~/Desktop/数学视频/2026-09-12-OmniFlow介绍.mp4`。

## 渲染约定（与主页审美一致）

- 大标题：Songti SC Black；小字：Songti SC Light / STSong；英文：Georgia；代码：Menlo
- 含中文的界面文字一律走宋体族（Studio 截图内的 PingFang 属产品 UI，不属宣传物料）
- 字幕安全区 y 840–1080，内容区 y ≤ 820；截断省略号仅在显示层
- 录屏与视频压缩：CRF 17（近无损观感）；网页截图 PNG 无损、仅降采样不降质
