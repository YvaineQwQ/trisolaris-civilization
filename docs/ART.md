# 《三体纪元 TRISOLARIS: CIVILIZATION》美术规范（ART BIBLE）

> 版本 1.0.0 · 机器可读清单见 `public/art-manifest.json`，图标清单见 `public/icons/manifest.json`。
> 本文档与 `public/**` 为 art-dev 交付范围；未改动 `src/**`。

## 1. 视觉方向

- **关键词**：硬科幻 / 深空观测 / 航天控制中心 / 冷峻电影感 / 混沌而可计算。
- **叙事原则**：画面呈现「观测到的宇宙」，不是全知视角；高亮、网格、等值线、虚线轨迹模拟科学可视化，避免魔法特效。
- **构图原则**：16:9 插画主体置于右侧或下三分之一，左侧/上方留负空间给 HUD 与标题；全屏背景整体压暗，叠加面板后仍可读。
- **材质原则**：金属冷青、仪表琥珀、深空近黑；禁止卡通化、禁止画面内文字、禁止水印。

统一风格 prompt（供后续 AI 生图复用）：

```text
hard science fiction, deep-space observatory, cinematic matte painting, dark navy/charcoal, cyan #3FD0FF + amber #FFC857 accents, volumetric light, no text, no watermark, no logo, composition leaves negative space for HUD panels
```

## 2. 色板

| 语义 | 色值 | 用途 |
| --- | --- | --- |
| 深空底 | `#05070D` | 页面/画布底色 |
| 面板底 | `rgba(10,18,32,0.82)` / `#0A101C` | HUD 面板、弹窗 |
| 线条 | `rgba(90,160,220,0.22)` | 网格、分隔、边框 |
| 主文字 | `#CFE3F5` | 正文 |
| 次文字 | `#7890A8` | 说明、单位 |
| 主强调（青） | `#3FD0FF` | 主按钮、观测/预测、选中态 |
| 警告（琥珀） | `#FFC857` | 预警、资源紧缺、时代高光 |
| 危险（红） | `#FF5B6E` | 灾害、崩溃、失败结局 |
| 成功（青绿） | `#4EF2B0` | 稳定、愈合、胜利 |
| 恒星 A 赤曜 | `#FF6B4A` | 3D/2D 恒星 A、恒星卡 |
| 恒星 B 青曜 | `#5AD2FF` | 恒星 B |
| 恒星 C 幽曜 | `#B48CFF` | 恒星 C |

时代插画统一「青蓝 + 琥珀」双色；灾害插画按类型偏色：高温 -> 橙红、严寒 -> 冰蓝、遭遇 -> 橙青对比、辐射 -> 蓝紫。

## 3. 资产清单

所有位图均由**程序化渲染**生成（numpy fBm、体积光、球面光照 + Pillow 合成），无外部素材、无版权风险；AI 生图接口在制作时不可用，详见第 7 节。

### 3.1 背景（`public/backgrounds/`）

| 资产 | 尺寸 | 体积 | 用途 |
| --- | --- | --- | --- |
| `backgrounds/menu-bg.jpg` | 2048x1152 | 214 KB | 主菜单全屏背景（UI 已引用） |
| `backgrounds/nebula-bg.jpg` | 2048x1152 | 193 KB | 面板 / 新游戏半透明叠加底图 |

### 3.2 插画（`public/images/`）

| 资产 | 尺寸 | 体积 | 用途 |
| --- | --- | --- | --- |
| `images/star-a.png` | 1600x1600 | 1761 KB | 恒星 A「赤曜」档案 / 观测面板 / 3D 辅助视图贴图 |
| `images/star-b.png` | 1600x1600 | 1719 KB | 恒星 B「青曜」档案 / 观测面板 / 3D 视图贴图 |
| `images/star-c.png` | 1600x1600 | 1723 KB | 恒星 C「幽曜」档案 / 观测面板 / 3D 视图贴图 |
| `images/planet.png` | 1600x1600 | 1847 KB | 母星观测面板 / 文明概况插图 / 结局页面 |
| `images/era-1.jpg` | 2048x1152 | 238 KB | 左侧面板「文明阶段」插图、新游戏时代预览、读档缩略图、时代晋升弹窗。 |
| `images/era-2.jpg` | 2048x1152 | 245 KB | 左侧面板「文明阶段」插图、新游戏时代预览、读档缩略图、时代晋升弹窗。 |
| `images/era-3.jpg` | 2048x1152 | 289 KB | 左侧面板「文明阶段」插图、新游戏时代预览、读档缩略图、时代晋升弹窗。 |
| `images/era-4.jpg` | 2048x1152 | 325 KB | 左侧面板「文明阶段」插图、新游戏时代预览、读档缩略图、时代晋升弹窗。 |
| `images/era-5.jpg` | 2048x1152 | 254 KB | 左侧面板「文明阶段」插图、新游戏时代预览、读档缩略图、时代晋升弹窗。 |
| `images/disaster-heat.jpg` | 2048x1152 | 309 KB | 灾害面板顶部插图、预警弹窗、事件日志条目缩略图 |
| `images/disaster-cold.jpg` | 2048x1152 | 298 KB | 灾害面板顶部插图、预警弹窗、事件日志条目缩略图 |
| `images/disaster-close-encounter.jpg` | 2048x1152 | 285 KB | 灾害面板顶部插图、预警弹窗、事件日志条目缩略图 |
| `images/disaster-radiation.jpg` | 2048x1152 | 269 KB | 灾害面板顶部插图、预警弹窗、事件日志条目缩略图 |
| `images/observatory-1.jpg` | 2048x1152 | 232 KB | 天文台升级面板插图（按等级映射：1-2 -> observator… |
| `images/observatory-3.jpg` | 2048x1152 | 228 KB | 天文台升级面板插图（按等级映射：1-2 -> observator… |
| `images/observatory-6.jpg` | 2048x1152 | 270 KB | 天文台升级面板插图（按等级映射：1-2 -> observator… |
| `images/ending-victory.jpg` | 2048x1152 | 254 KB | 结局全屏插画（victory / defeat），可叠加半透明结局… |
| `images/ending-defeat.jpg` | 2048x1152 | 253 KB | 结局全屏插画（victory / defeat），可叠加半透明结局… |

> 恒星与母星均为纯黑底、边缘干净，CSS `mix-blend-mode: screen` 即可融入深色 UI。

### 3.3 图标（`public/icons/`）

共 **41** 个 SVG（viewBox `0 0 24 24`，`fill=none`，`stroke=currentColor`，`stroke-width=1.5`，圆角线帽，线性科技风）。

- 建筑 24：`farm`、`hydroponics`、`water-plant`、`housing`、`clinic`、`storage`、`mine`、`metalworks`、`reactor`、`solar-array`、`fusion-reactor`、`factory`、`observatory`、`radio-telescope`、`research-lab`、`university`、`supercomputer`、`accelerator`、`spaceport`、`shipyard`、`planetary-shield`、`weather-control`、`planet-engine`、`colony-hub`
- 资源 6：`food`、`water`、`energy`、`minerals`、`metals`、`science`
- 科技分支 5：`tech-astronomy`、`tech-energy`、`tech-industry`、`tech-biology`、`tech-space`
- 灾害 5：`hazard-heat`、`hazard-cold`、`hazard-radiation`、`hazard-encounter`、`hazard-orbit`
- 兜底 1：`unknown`

图标 ID 与文件同名（`<id>.svg`），清单见 `public/icons/manifest.json`（含中文名、分组、路径）。

## 4. UI 使用建议

1. **主菜单**：`backgrounds/menu-bg.jpg` 全屏 `object-fit: cover`，叠加径向渐变 + 扫描线 + 暗角；左侧标题区保持暗部。
2. **星云叠加**：`backgrounds/nebula-bg.jpg` 作为伪元素，`opacity: .35-.55`、`mix-blend-mode: screen`，不抢主面板对比度。
3. **恒星卡/观测面板**：`images/star-a.png` 等以 img 或背景图放入，`mix-blend-mode: screen`；加载失败时降级为同色径向渐变。
4. **母星面板**：`images/planet.png` 1:1，配环形进度/温标；同样建议 screen 混合。
5. **文明阶段**：左侧「文明阶段」按 `era` 1-5 映射 `images/era-N.jpg`，`object-fit: cover`，高度 96-140px；读档卡片复用同一映射做缩略图。
6. **灾害**：`heatExtreme -> disaster-heat.jpg`、`coldExtreme -> disaster-cold.jpg`、`closeEncounter -> disaster-close-encounter.jpg`、`radiationSurge -> disaster-radiation.jpg`、`orbitDestabilization -> disaster-close-encounter.jpg + hazard-orbit.svg`。
7. **天文台**：等级 0-2 -> observatory-1，3-5 -> observatory-3，6 -> observatory-6；升级前后交叉淡入。
8. **结局**：`ending-victory.jpg` / `ending-defeat.jpg` 全屏铺底 + 深色渐变 + 数据面板；建议 800ms 淡入 + 轻微 Ken Burns 缩放。
9. **图标**：当前 UI 内联 `src/ui/icons.ts` 的图标（可继承 currentColor）；使用本资产包时，img 场景需 CSS `mask` 或按主题准备明暗两版。

## 5. 接入与性能

- 路径相对 `public` 根：开发服务器直出、`vite build` 原样拷贝，无需 import 或 hash。
- 背景图建议 `<link rel="preload" as="image">` 仅用于主菜单背景；插画使用 `loading="lazy"` + `decoding="async"`。
- 位图 JPEG（品质约 90）/ 优化 PNG；插画总计约 11205 KB（不含图标）。
- 装饰图 `alt=""` / `aria-hidden="true"`；语义信息由 DOM 文本承担。
- 响应式：16:9 图 `object-fit: cover`；方形恒星图建议 `aspect-ratio: 1` + `object-fit: contain`。

## 6. 命名与目录约定

```text
public/
  backgrounds/ menu-bg.jpg, nebula-bg.jpg
  images/      star-a|b|c.png, planet.png, era-1..5.jpg,
               disaster-{heat,cold,close-encounter,radiation}.jpg,
               observatory-{1,3,6}.jpg, ending-{victory,defeat}.jpg
  icons/       <id>.svg + manifest.json
  art-manifest.json
```

## 7. 生成说明与风险

- **AI 生图**：`generate_image`（Agnes）在 2026-11-15 22:15-23:05 间共调用 **10 次 / 14 个 prompt**（2K 16:9、1K 与默认尺寸均试过），全部返回 `ToolCallError: N image(s) failed to generate`，判定上游服务不可用；未获得任何 AI 位图。
- **兜底方案**：本地 Python（bundled numpy 2.3.5 + Pillow 12.3.0）程序化渲染全部 20 张位图。生成脚本位于 `%TEMP%\artgen_artdev\`（`artlib.py`、`gen_backgrounds.py`、`gen_scenes.py`、`gen_icons.py`），固定随机种子可复现；未向 `src/**` 写入任何文件。
- **画面构成**：深空渐变 + fBm 星云/银河 + 球面光照恒星（临边昏暗、米粒组织、日冕流、耀斑环）+ 行星昼夜/云层/城市灯光 + 剪影层（山脊/城市/观测站/舰队）+ 科学可视化叠加（等值线、预测轨迹、磁层环）+ 统一调色（辉光、暗角、胶片颗粒）。
- **质量边界**：程序化插画光影层次不及 AI 概念图，但构图、色板、16:9/1:1 规格与用途满足 UI 接入；如 `generate_image` 恢复，可按第 1 节 prompt 替换同名文件，无需改代码。
- **版权**：全部资产为本项目程序化原创，不含第三方素材。

## 8. 缺失 / 未完成

1. AI 生图位图缺失（改为程序化兜底，见第 7 节）。
2. 天文台仅 1/3/6 三级插图，等级 2/4/5 复用映射。
3. `orbitDestabilization` 灾害无位图，仅 `hazard-orbit.svg`。
4. `CrisisKind` 无专属插图，建议复用灾害图 + 图标。
5. `public/icons/**` 为独立备用图标集；当前 UI 使用内联图标，两者 ID 不自动互通（可按需引入）。

## 9. 验收命令

```powershell
cd C:\Users\hp000001\Downloads\three-body-civilization
Get-ChildItem -Recurse -File public | Select-Object FullName,Length
Get-Content public/art-manifest.json -Raw | ConvertFrom-Json | Out-Null; 'art-manifest OK'
Get-Content public/icons/manifest.json -Raw | ConvertFrom-Json | Out-Null; 'icons manifest OK'
(Get-ChildItem public/icons -Filter *.svg).Count   # 41
```
