# 美术资产 V2 —— 设计语言、资产清单与使用说明

> 阶段 12「时代进化系统」/ 阶段 13「UI 视觉重构」配套美术交付（task-12 收尾）。
> 规格来源：`docs/ART_V2_SPEC.md`、`docs/UI_REDESIGN_SPEC.md`。
> 机器可读清单：`public/art-manifest-v2.json`（含每项路径 / 真实尺寸 / 字节 / 来源 / 用途 / sha256）。
> 写入范围：本文件与 `public/**`；未改动 `src/**`。

## 1. 设计语言

硬科幻工业终端（Endfield / Arknights 气质，全部原创）：

- **近黑石墨底** + **冷青主色** + **琥珀警示**，危险红/辅助紫仅作点状强调；
- 几何母题：同心圆 / 弧线 / 切角矩形 / 平行四边形 / 刻度尺 / 45° 排线 / 扫描线 / 噪点；
- 画面要求：低对比、暗部为主、主体避开 UI 负空间；**不烧录任何文字**（文案由 DOM 渲染，便于本地化与可访问性）；
- 装饰优先 CSS/SVG 几何，其次本地程序化位图；不使用侵权素材。

## 2. 色彩板

| 令牌 | 色值 | 用途 |
| --- | --- | --- |
| `--bg` | `#05070D` | 全局底色（近黑） |
| `--bg-2` | `#0A101C` | 次级背景 / 面板底 |
| `--panel` | `rgba(10,18,32,0.82)` | 玻璃面板 |
| `--line` | `rgba(90,160,220,0.22)` | 细描边 / 分隔线 |
| `--text` | `#CFE3F5` | 正文 |
| `--muted` | `#7890A8` | 次级文本 / 禁用 |
| `--accent` | `#37E5FF` | 主色（冷青）：环、描边、数据高亮 |
| `--accent-hot` | `#8FE9FF` | 高亮核心（发光中心） |
| `--warn` | `#FFC857` | 琥珀：能源、时代强调、警示 |
| `--warn-hot` | `#FFE6A3` | 琥珀高光 |
| `--danger` | `#FF5D6C` | 灾害 / 危险 / 信标 |
| `--ok` | `#4EF2B0` | 正常 / 成功 |
| `--star-purple` | `#B48CFF` | 三体恒星第三色 / 装饰紫 |

位图与 SVG 中统一使用上述色值体系（青 `#37E5FF` 为基准线）。

## 3. 资产清单（19 项，全部真实存在且校验通过）

| # | 路径 | 尺寸 | 字节 | 类型 | 用途 |
| --- | --- | --- | --- | --- | --- |
| 1 | `public/ui/orbit-ring.svg` | 512×512 | 3,885 | SVG | 同心 HUD 环（时代进度环 / 观测瞄准环 / 资源环形表底），可 CSS 旋转 |
| 2 | `public/ui/frame-corner.svg` | 96×96 | 1,477 | SVG | 切角面板角标（四角摆放或 9-slice） |
| 3 | `public/ui/hatch.svg` | 48×48 | 1,031 | SVG | 45° 排线平铺纹理（面板页脚 / 空态底纹） |
| 4 | `public/ui/slash-divider.svg` | 320×24 | 1,332 | SVG | 斜切分隔条（横向拉伸） |
| 5 | `public/ui/parallelogram-tab.svg` | 240×56 | 1,394 | SVG | 平行四边形页签底型 / dock 图标底板 |
| 6 | `public/ui/radar.svg` | 512×512 | 3,593 | SVG | 雷达同心圆 + 扫描扇形（灾害警报 / 观测扫描） |
| 7 | `public/ui/noise.png` | 128×128 | 23,017 | PNG | 胶片噪点（叠加，低透明度） |
| 8 | `public/backgrounds/menu-bg-v2.jpg` | 2048×1152 | 259,484 | JPEG | 主菜单全屏背景（三恒星 + 观测站剪影，左侧负空间） |
| 9 | `public/backgrounds/nebula-v2.jpg` | 2048×1152 | 275,592 | JPEG | 深空网格星云底图（主视图 / 弹窗背景） |
| 10 | `public/images/era-1-v2.jpg` | 2048×1152 | 275,700 | JPEG | E1 原始时代插图（部落营火 + 巨石观星台 + 三恒星） |
| 11 | `public/images/era-2-v2.jpg` | 2048×1152 | 280,432 | JPEG | E2 农业城邦（梯田 / 灌溉渠 / 城墙 / 观星台穹顶） |
| 12 | `public/images/era-3-v2.jpg` | 2048×1152 | 300,330 | JPEG | E3 蒸汽与电气（烟囱 / 电网 / 望远镜 / 机械计算机 / 飞轮） |
| 13 | `public/images/era-4-v2.jpg` | 2048×1152 | 287,225 | JPEG | E4 信息与航天（超算中心 / 雷达阵 / 轨道站 / 火箭发射 / 行星辉光） |
| 14 | `public/images/era-5-v2.jpg` | 2048×1152 | 332,942 | JPEG | E5 星际文明（星环 / 行星发动机 / 聚变环 / 太空港 / 殖民穹顶） |
| 15 | `public/icons/era-1.svg` | 128×128 | 2,381 | SVG | E1 时代徽记（同心环 + 几何符号） |
| 16 | `public/icons/era-2.svg` | 128×128 | 2,421 | SVG | E2 时代徽记 |
| 17 | `public/icons/era-3.svg` | 128×128 | 1,836 | SVG | E3 时代徽记 |
| 18 | `public/icons/era-4.svg` | 128×128 | 2,258 | SVG | E4 时代徽记 |
| 19 | `public/icons/era-5.svg` | 128×128 | 2,510 | SVG | E5 时代徽记 |

> 文件名固定带 `-v2` 后缀，便于与 V1 资产（`era-1.jpg` 等）并存/回滚；UI 侧引用时无需改构建配置，直接使用站内绝对路径 `/ui/...`、`/images/era-1-v2.jpg`。

### 3.1 五时代插图内容说明

- **E1 原始 / 观星**：三恒星几何星图（赤橙 / 冷青 / 幽紫），地平线上巨石阵 + 营火 + 部落尖顶帐篷剪影；左上留出 UI 负空间，暖色地面辉光。
- **E2 农业城邦**：左侧等高线梯田 + 青色灌溉渠 + 作物排线，右侧城墙、塔楼与阶梯祭坛/学园，青铜色窗光与观测穹顶。
- **E3 蒸汽与电气**：锯齿屋顶厂房、三根烟囱（烟雾被地平线暖光逆光）、飞轮/齿轮、教堂式观星台与折射望远镜、电线杆与悬链线电网、特斯拉线圈电弧、钢轨上的蒸汽机车剪影；琥珀色工业雾霭 + 冷青电力。
- **E4 信息与航天**：右上行星弧线（大气冷青描边 + 夜景城市灯点），轨道站与卫星/下传数据链，发射塔与斜向尾迹、上升段火箭尾焰；地面为超算数据中心阵列（跑马灯 LED 排线）、冷却塔、雷达阵与太阳能板；前景电路走线。
- **E5 星际文明**：横跨天穹的星环（刻度 + 栖息舱灯点 + 系缆下探地面），巨型行星发动机光柱与激波环，前景托卡马克聚变环（等离子体辉光 + 线圈），左侧殖民穹顶群，右侧太空港尖塔 + 六边形着陆坪 + 离港飞船；暖橙/紫星云与冷青科技光对比。

所有插图主体偏右/偏下，**左上 ~35% 区域留作 HUD 负空间**。

## 4. UI 使用建议

### 4.1 SVG 几何装饰

```css
/* 时代进度环：随回合/进度旋转，注意 prefers-reduced-motion */
.era-ring { background: url("/ui/orbit-ring.svg") center/contain no-repeat; animation: ring-spin 24s linear infinite; }
@keyframes ring-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .era-ring { animation: none; } }

/* 切角面板四角：同一张图四角定位 */
.panel { position: relative; }
.panel::before, .panel::after { content: ""; position: absolute; width: 96px; height: 96px;
  background: url("/ui/frame-corner.svg") center/contain no-repeat; pointer-events: none; }

/* 排线平铺 + 噪点叠加（低透明度，别抢正文） */
.panel-footer { background-image: url("/ui/hatch.svg"); background-repeat: repeat; opacity: .5; }
.noise-overlay { background-image: url("/ui/noise.png"); mix-blend-mode: overlay; opacity: .05; pointer-events: none; }

/* 平行四边形页签：拉伸底图，文字仍用 DOM 保证可访问性 */
.tab { background: url("/ui/parallelogram-tab.svg") center/100% 100% no-repeat; }
```

- SVG 内的描边为固定冷青色；若需跟随主题色，请改用 CSS `mask` 或内联 SVG 并用 `currentColor`。
- 所有装饰层建议 `pointer-events: none;`，并且不承载语义信息（语义由文字/按钮提供）。

### 4.2 位图背景与时代插图

```css
/* 菜单：铺满 + 左侧压暗渐变，保证菜单文字对比度 */
.menu-bg { background: #05070d url("/backgrounds/menu-bg-v2.jpg") center/cover no-repeat; }
.menu-bg::after { content: ""; position: absolute; inset: 0;
  background: linear-gradient(90deg, rgba(5,7,13,.92) 0%, rgba(5,7,13,.55) 45%, rgba(5,7,13,.15) 100%); }

/* 时代卡片 / 解锁过场：16:9 封面，主体在中下，可安全裁切 */
.era-card__art { aspect-ratio: 16 / 9; object-fit: cover; object-position: 60% 65%; }

/* 深空底图：只做背景，不要其上再叠高亮纹理 */
.game-backdrop { background: url("/backgrounds/nebula-v2.jpg") center/cover, #05070d; }
```

- 插图作为全屏背景时，建议叠一层径向暗角（`radial-gradient`）+ 扫描线（repeating-linear-gradient）以统一 HUD 观感；
- 时代插图切换用 `opacity/filter` 过渡（约 240–320ms），避免大图位移；
- 所有位图均无文字，可安全用于任意语言版本。

## 5. 生成方式与可复现性

- **方法**：本地程序化绘制（**numpy 2.3 + Pillow 12**）。fBm 值噪声/星云、球面光照几何恒星、低多边形山脊、栅格遮罩 + 边缘高光、bloom/vignette/grain 后期；全部 seeded 确定性生成。
- **尺寸策略**：构图在 1920×1080 设计空间绘制 → LANCZOS 放大到 **2048×1152**（16:9），JPEG `quality=91, progressive`，与菜单/星云背景分辨率一致。
- **脚本**：`%TEMP%\artgen_v2`（`v2lib.py` / `gen_backgrounds_v2.py` / `gen_eras_v2.py`）与 `%TEMP%\artgen_finish`（`finishlib.py` / `gen_e3.py` / `gen_e4.py` / `gen_e5.py` / 校验与清单脚本）。生成脚本为一次性工具，不随仓库分发；资产本身可复现。
- **未使用 `generate_image`**：按 `ART_V2_SPEC.md` 优先级，AI 生图在此前会话中不可用，本批采用程序化兜底（无外部素材、无版权风险、结果可控）；如需 AI 图可在后续单张替换，文件名保持不变即可热替换。
- **交接修复**：前一位美术同事交接的 `public/images/era-1-v2.jpg` 实际为 **244,455 字节的“全零”损坏文件**（无 JPEG 头，浏览器无法解码）。本次已用同一程序化流程重新生成，并通过真实文件头校验（现为 275,700 字节、2048×1152 有效 JPEG）。

## 6. 校验报告（真实尺寸，非目测）

- 校验脚本：读取文件真实头信息 —— JPEG 解析 `SOF0/SOF2` 段宽高、PNG 读 `IHDR`、SVG 解析 `<svg>` 根节点 `width/height/viewBox`；同时断言文件非空、非全零、无占位文本。
- 结果：**19 / 19 通过，失败 0**（详见 `public/art-manifest-v2.json` 的 `checks` 字段）。
- 约定校验值：时代插图 2048×1152（≥1600×900）；背景 2048×1152；`noise.png` 128×128；时代徽记 128×128 矢量（`viewBox="0 0 128 128"`）。
- 校验时间：2026-11-21（本批收尾）。

| 分组 | 数量 | 结果 |
| --- | --- | --- |
| `public/ui/*`（6 SVG + 1 PNG） | 7 | ✅ 全部存在、非空、尺寸正确 |
| `public/backgrounds/*-v2.jpg` | 2 | ✅ 2048×1152 |
| `public/images/era-{1..5}-v2.jpg` | 5 | ✅ 2048×1152（含重新生成的 E1） |
| `public/icons/era-{1..5}.svg` | 5 | ✅ 128×128 有效 SVG |

## 7. 授权与合规

- 全部资产为**本项目原创**：程序化几何绘制（numpy/Pillow）或手写 SVG；**未下载任何第三方素材**，未使用图库/字体/图标集，未烧录文字。
- 本批**未使用 AI 生图服务**；即便后续替换单张，也必须遵循同样授权约束。
- 资产可随本项目自由使用、修改与再分发；不涉及第三方版权、肖像权或商标。
- 几何语言参考“硬科幻工业 UI”通用设计惯例，未复制任何既有作品的画面、图案或标志。
