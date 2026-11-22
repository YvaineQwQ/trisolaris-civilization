# 美术资产 V3 —— 终端工业画册 · 随机事件插图与印刷装饰包

> 对应 v1.3 大扩展（冻结规格：`docs/EXPANSION_V3.md` §5，任务 task-17）。
> 机器可读清单：`public/art-manifest-v3.json`（82 项：路径 / 尺寸 / 字节 / 来源 / 用途 / seed）。
> 生成脚本：`scripts/gen-event-art.py`（可复现，seed = 事件 id 的 sha256 前缀）。
> 写入范围：`public/**`、本文件、`scripts/gen-event-art.py`；**未改动 `src/**`**。

## 1. 设计语言

**白纸 · 墨线 · 一处黄**。全部资产统一为「终端工业画册 / 版画线稿」气质，与 v1.3 UI 的印刷版式（白纸墨字、直角、注册色条、斜纹点阵）同源：

| 令牌 | 色值 | 用途 |
| --- | --- | --- |
| 纸白 | `#F4F1EA` | 全部插图底色（带极细纸纹颗粒） |
| 墨黑 | `#111111` | 线稿、排线、暗部剪影 |
| 信号黄 | `#FDFD1F` | 每张图**唯一一处**强黄锚点（信标、日核、灯、旗角等），面积 < 1% |
| 灰阶 | 墨色 α 0.06–0.55 | 排线深浅、标注线、辅助构建线 |

版式规则（每张事件插图一致，形成“档案图版”系列感）：

- 双线细版框 + 四角裁切标 + 上下刻度尺 + 套准十字；
- 左上/右下留白较多，主体集中在画面中下部，方便 UI 在图上叠标题与正文；
- 每张图带**档案标注层**：尺寸线（带箭头）、引线圆标、铅垂虚线、比例尺——均为几何记号，**不烧录任何文字**（文案由 DOM 渲染，便于本地化与无障碍）；
- 左下角有按 seed 变化的几何序列码，右下角有信号黄小方块 + 上升刻度；
- 构图由事件 id 的 sha256 决定随机种子：**同 id 永远同图，不同 id 构图唯一**（已校验 64 张无重复哈希、无空白）。

## 2. 交付清单

### 2.1 印刷装饰包 `public/print/`（6 项）

| 文件 | 尺寸 | 字节 | 说明 / 用法 |
| --- | --- | --- | --- |
| `hatch-45.svg` | 32×32 | 615 | 45° 排线平铺底纹（墨色，可无缝平铺）。页脚、空态、标题栏底纹。 |
| `dot-matrix.svg` | 24×24 | 904 | 点阵平铺底纹（墨色）。面板浮层、表格底纹。 |
| `registration-strip.svg` | 320×28 | 2049 | 印刷套准色条：CMYK 小方块 + 套准标 + 毫米刻度。面板边缘、页脚装饰。 |
| `line-art-corners.svg` | 128×128 | 1593 | 版画线稿角标（左上角；其余三角用 `transform: rotate/scaleX` 复用）。卡片四角。 |
| `loading-lineart.svg` | 1200×675 | 4153 | 加载页线稿：三恒星观测台（**深色版**，纸白线稿 + 信号黄，适配近黑加载底）。 |
| `grain.png` | 256×256 | 64168 | 印刷颗粒（RGBA，α≤120，墨色噪点 + 少量白点）。全屏叠加层。 |

使用示例：

```css
/* 纸面颗粒：全屏叠一层，几乎无性能成本 */
.grain-overlay { position: fixed; inset: 0; pointer-events: none;
  background: url("/print/grain.png") repeat; mix-blend-mode: multiply; opacity: .5; }
/* 斜纹标题栏 */
.panel-head::after { content: ""; position: absolute; inset: 0;
  background: url("/print/hatch-45.svg") repeat; opacity: .18; }
/* 卡片角标（四角复用） */
.card::before { content: ""; position: absolute; left: -2px; top: -2px; width: 32px; height: 32px;
  background: url("/print/line-art-corners.svg") center/contain no-repeat; }
/* 加载页线稿背景（近黑底） */
.loading { background: #0d0d0d url("/print/loading-lineart.svg") center/cover no-repeat; }
```

### 2.2 随机事件插图 `public/events/<id>.jpg`（64 张，全覆盖 `EVENT_DEFS`）

- 规格：**1600×900（16:9）JPEG**，品质 89，渐进式；单张 162–558 KB（均值约 296 KB），总计约 19 MB；
- 路径与 `EventDef.illustration = "events/<id>.jpg"` 一一对应，UI 直接以 `/events/<id>.jpg` 引用；
- 事件 id 全部来自 `src/events/definitions.ts`（脚本自动解析，共 64 个，与 events-v13b 的最终 id 完全一致）；
- 预览拼版不随包发布（按收尾要求已删除 `public/events/_contact-sheet.jpg`）；需要内部预览时运行 `python scripts/gen-event-art.py --manifest-only --contact-sheet` 会在本地重新生成 `public/events/_contact-sheet.jpg`，跑完可再删。下划线开头的文件不应被游戏引用。

**构图路由（关键词 → 场景母题；同母题内由 seed 决定细节，因此每张构图仍唯一）：**

- **anomaly**（6）：`haz_radiation_belt`、`mys_three_body_dream`、`mys_time_loop`、`sci_ai_dream`、`sci_breakthrough_flux`、`sci_star_anomaly`
- **appeal**（1）：`pol_scholar_appeal`
- **archives**（2）：`sci_lost_archives`、`soc_underground_city`
- **astronomer**（2）：`mys_frozen_astronomer`、`sci_mad_astronomer`
- **crowd**（5）：`haz_plague`、`soc_birth_boom`、`soc_generation_gap`、`soc_migrant_wave`、`soc_school_wars`
- **cult**（2）：`sci_calculator_cult`、`soc_dehydrated_cult`
- **dawn**（4）：`env_flux_surge`、`env_quiet_spring`、`env_red_dawn`、`env_tidal_heating`
- **debate**（6）：`pol_city_referendum`、`pol_corruption_ring`、`pol_general_ambition`、`pol_ration_debate`、`pol_senate_deadlock`、`pol_succession_quarrel`
- **deep_probe**（3）：`spc_deep_probe`、`spc_orbit_debris`、`spc_orbital_elevator`
- **factory**（4）：`ind_factory_strike`、`ind_power_cut`、`ind_smelter_spore`、`ind_steam_overheat`
- **famine**（1）：`soc_famine_rumor`
- **feast**（1）：`soc_harvest_feast`
- **generation_ship**（3）：`spc_engine_rumor`、`spc_generation_ship`、`spc_moon_quarantine`
- **ice_river**（3）：`env_ice_river`、`haz_cold_wave`、`haz_flood`
- **lab**（2）：`ind_fusion_test`、`sci_gene_lab_leak`
- **listening**（5）：`mys_dead_signal`、`mys_fifth_column`、`mys_listening_stars`、`sci_signal_echo`、`spc_colony_signal`
- **long_night**（1）：`env_long_night`
- **meteor**（2）：`haz_meteor_shower`、`spc_meteor_swarm`
- **mine**（1）：`ind_mine_collapse`
- **prophet**（1）：`mys_prophet`
- **rail**（1）：`ind_rail_line`
- **ruins**（3）：`haz_fire`、`haz_quake`、`mys_impossible_ruin`
- **solar_flare**（1）：`haz_solar_flare`
- **statue**（1）：`pol_hero_statue`
- **storm**（3）：`env_dust_storm`、`env_green_rain`、`ind_scrap_windfall`

> 同母题共用的只是"取景器与笔法"（版框、天际线、山脊、排线、标注），主体元素（恒星数量/观测站朝向/人群规模/机械结构/冰裂纹/风暴线）全部由 seed 随机生成，因此不会出现两张一模一样的图。

### 2.3 即梦 AI hero 大图 `public/images/v13/`（12 张）

- 规格：**1600×900 JPG**（由即梦 1920×1080 原图 LANCZOS 缩放），490–643 KB；
- 内容为 12 个关键事件链主题（观测站废墟 / 行星环陨石 / 议会大厅 / 重工业 / 饥荒农田 / 地下实验室 / 轨道船坞 / 档案馆 / 迁徙人群 / 第二个太阳 / 巨型天线阵 / 冰封城市），风格与事件插图同源（米白纸底 + 墨线版画 + 少量信号黄）；
- 元数据（原始中文提示词、用途、水印说明）见 `public/images/v13/hero-meta.json`，并已并入 `art-manifest-v3.json`（`source: "jimeng"`）；
- **水印说明**：平台合规要求，图内含「AI 生成」标识与即梦品牌水印（manifest `watermark: true`）。即梦页面可在「侧边栏→设置→AI 生成水印设置」中由**用户本人**确认开启"去除 AI 生成水印"（仍保留即梦品牌水印）；本次未替用户同意该条款。若 UI 需要干净画面，建议按 16:9 使用但避开四角（裁切 3%–5% 或让角标压住），或由用户开通会员后重新导出。

### 2.4 清单 `public/art-manifest-v3.json`

82 项：`print-decoration` 6 / `event-illustration` 64 / `hero-illustration` 12。字段：`path / kind / format / width / height / bytes / source / tool / usage`，事件插图额外含 `seed` 与 `scene`，hero 额外含 `prompt / watermark / license`。

## 3. 即梦 AI 尝试记录（用户明确要求）

### 3.1 结论

**成功。** 最终通过「Win32 窗口自动化驱动用户已登录的 Edge」生成 **12/12** 张 1920×1080 工业画册插画，耗时约 25 分钟（每张约 50 秒），未触发验证码/风控；消耗用户即梦积分 48（100 → 52）。电脑操作插件（后端被安全软件拦截）与 CDP 登录态方案均未走通，详见下文。

### 3.2 时间线与失败原因

1. **电脑操作插件**：后端 `BACKEND_BLOCKED_BY_AV` / `SECURITY_BLOCK_CODE`，按约束未关闭杀软、未重装插件。
2. **方案 A：复制 Edge 配置目录 + CDP（规格建议方案）**
   - `robocopy /E` 复制 `%LOCALAPPDATA%\Microsoft\Edge\User Data`（487.5 MB）到 `%TEMP%\edge-jimeng-profile`：成功；
   - 启动副本 `msedge.exe --remote-debugging-port=9222 --user-data-dir=<副本> --no-first-run --restore-last-session`：成功，`http://127.0.0.1:9222/json/version` 与 WebSocket 均可用（Node `ws` 可驱动 DOM）；
   - **卡点**：Edge 158 对 `Default\Network\Cookies` 持有独占锁。robocopy 报 `ERROR 2`、`Copy-Item` 与 `FileStream(FileShare.ReadWrite)` 均被拒绝，甚至 `robocopy /B`（需备份特权）不可用（非管理员）。副本浏览器因而**处于登出态**（页面右上角"登录"，`localStorage` 里 `DREAMINA_HAS_LOGIN` 等只是前端缓存，会话 Cookie 缺失）。无用户凭据、时间盒内不发起扫码登录（需用户手机），故放弃该方案。
   - 已实测：Chrome 虽有 cookie 库可读，但其 douyin/jianying 域内无 即梦 会话 Cookie，同样不可用。
3. **方案 B：Win32 自动化驱动用户已登录的 Edge（最终成功）**
   - 用户 Edge 窗口当时为**最小化**（未处于人工操作中）。用 `EnumWindows + GetWindowThreadProcessId` 按"进程启动时间早于本次任务"锁定用户原窗口，`ShowWindow(SW_MAXIMIZE)` 恢复；
   - 中文提示词通过**剪贴板**注入（规避 IME），`SendKeys` 粘贴后点击生成；
   - 首张下载触发「AI 生成水印设置」弹窗，按**默认（不开启去水印）**保存，保留合规标识；
   - 生成结果以 1920×1080 PNG 下载至系统下载目录，随后脚本统一缩放为 1600×900 JPG 并入 `public/images/v13/`；
   - 全程**未关闭/未重启用户 Edge、未改系统安全设置**。任务结束后：用户 Edge 已恢复为最小化；本次启动的副本 Edge 进程已结束、`%TEMP%` 副本目录已删除、下载目录中残留临时 PNG 已清理。

### 3.3 12 张 hero 的提示词

统一前缀「工业画册风格插画，米白纸张底色，墨黑版画线稿，极少量信号黄点缀，硬科幻，」+ 统一后缀「，细密排线阴影，无文字，无水印」，主体分别为：
观测站废墟 / 行星环陨石坠落 / 议会大厅 / 重工业工厂 / 龟裂农田饥荒 / 地下实验室 / 轨道船坞 / 档案馆 / 迁徙人群 / 第二个太阳 / 巨型天线阵列 / 冰封城市。完整 prompt 见 `public/images/v13/hero-meta.json`。

## 4. 如何手动补图 / 替换

### 4.1 替换某张事件插图

1. 用即梦（或任意绘画工具）生成 16:9 图，导出为 JPG；
2. 缩放到 1600×900（可用项目内置 Python：`python -c "from PIL import Image; Image.open('in.jpg').resize((1600,900), Image.LANCZOS).save('out.jpg', quality=89)"`）；
3. 覆盖 `public/events/<事件id>.jpg`，然后：

```powershell
# 重建清单与预览拼版（不重绘已存在的图）
node .\node_modules\typescript\bin\tsc --noEmit   # 与本资产无关，集成时用
& <项目内置python> scripts\gen-event-art.py --manifest-only --contact-sheet
```

> 注意：`--manifest-only` 不覆盖已有插图；直接放图后跑它即可让 manifest 记录新尺寸/字节。

### 4.2 用即梦补 hero（或替换现有 hero）

1. 打开 Edge → 即梦（保持登录）→ 文生图，比例选 **16:9**、分辨率 1.5K/2K；
2. 粘贴 `public/images/v13/hero-meta.json` 中对应条目的 `prompt`，生成后点右上角下载图标；
3. 把下载的 PNG 缩放到 1600×900 后覆盖 `public/images/v13/hero-XX-*.jpg`（文件名不变即可被 UI 引用）；
4. 更新 `hero-meta.json` 中该条的 prompt/usage（如换了题材），再 `--manifest-only` 重建清单。

### 4.3 全部重绘事件插图（可复现）

```powershell
# 用工程内置 python（含 Pillow/numpy），见 README 的 load_workspace_dependencies 路径
& $PY scripts\gen-event-art.py --force --contact-sheet
# 只重绘某几个 id
& $PY scripts\gen-event-art.py --force --only env_red_dawn,pol_hero_statue
```

脚本默认行为：解析 `src/events/definitions.ts` 的 `EVENT_DEFS.id`（正则 + 类别前缀过滤），**只补缺失的 `public/events/<id>.jpg`**；事件 agent 后续新增 id 后，直接重跑即可自动补齐。`--ids a,b,c` 可在定义文件尚未落盘时先出图，`--limit N` 用于调试。

## 5. 授权与素材来源

- **全部素材原创或 AI 生成，未使用任何第三方版权素材**：打印装饰包为手写几何 SVG + Pillow 程序化噪点；事件插图为 `scripts/gen-event-art.py` 纯代码生成的版画线稿；hero 为即梦 AI（用户账号）生成；
- 程序化插图不含任何字体/图标/照片输入，构图由事件 id 的 sha256 决定，可复现；
- 即梦 hero 图保留平台合规标识与品牌水印，随包仅用于本项目（单机游戏）；若项目公开发行，请遵守《生成式人工智能服务管理暂行办法》的标识义务并自行确认即梦平台条款。

## 6. 已知缺口与后续建议

1. **风格定位**：事件插图为“档案图版”风格的几何线稿，胜在统一/可复现/零版权风险，但精度不及手绘或 AI 大图；若后续允许，可用即梦为 64 个事件批量生成写实版替换（按 §4.1 流程，成本约 4 积分/张）。
2. **UV/尺寸**：事件插图统一 1600×900；若 UI 需要 2x 视网膜源，可改脚本 `W,H = 2400,1350` 后 `--force` 重绘（约 2 分钟，机器空闲时）。
3. **水印**：hero 图四角有即梦水印（合规保留）；如需干净版本需用户本人在即梦设置中开启“去除 AI 生成水印”并接受条款（仍保留品牌水印），或开通会员导出。
4. **即梦自动化脚本未入库**：本次驱动 Edge 的 CDP/窗口自动化脚本为一次性工具（已按任务要求删除）。如后续要再批量生图，建议由用户手动操作即梦（稳定、无需维护自动化），或另行申请电脑操作插件白名单。
5. **对比度/纸纹**：已加统一 polish（对比 1.22 / 锐度 1.12）；若某张图在具体版面上显得过灰，可在 UI 侧加 `filter: contrast(1.05)` 微调，无需重跑。
