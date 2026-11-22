# UI v1.4 —《三体纪元》曲线美 + 移动端设计规范

> 版本：v1.4.0 · 任务 task-23（owner: ui-curves-v15）
> 范围：**只在 v1.3「终末地工业画册」基础上做增量增强，不推翻风格**。仅改动 `src/ui/**`，
> 未修改 `src/game/**`、`src/render3d/**`、`src/main.ts`、`public/**`、`package.json`。
> 需求来源：`docs/V4_SPEC.md` §3；沿袭 `docs/UI_PRINT.md` 的白纸墨字 + 单一信号黄规范。

---

## 0. 一句话结论

在 v1.3 的版式、色板、纸感与印刷装饰之上，新增一套**有数据含义的同心圆 / 圆弧 / 刻度弧**语言
（时代进度弧、人口 / 稳定度环形仪表、资源环形摘要、观测视口外圈方位刻度弧 + 内圈置信弧、
弧形分节标题、曲线分隔线、卡片角细弧），并把整套界面在 **≤1024 / ≤720** 两档断点上改造成
「单列主舞台 + 底部导航 + 全屏抽屉 / 页签 + 终端上滑面板 + 全屏弹窗」，桌面 1600×900 / 1280×720
的版式与信息密度保持不变。

---

## 1. 设计原则对照（V4_SPEC §3 六原则）

| 原则 | 本版落实 |
| --- | --- |
| 纸墨主体 | 页面仍是 `#F4F1EA` 纸底 + `#FFFFFF` 卡片 + `#111111` 墨字；弧线一律墨色 / 灰阶（`--ink / --grey / --grey-2 / --faint`），不引入新色相。 |
| 单一信号黄 | `--signal #FDFD1F` 仅用于：顶部通栏色带、当前时代弧端点标记、选中天体方位刻度与标签、弧形刻度尺的当前位置标记、灾害/临界状态强调。**实测黄色面积占比见 §7，各视口均 ≤ 10%**。 |
| 主角偏心、信息靠边 | 深色观测视口仍是唯一「大图」主角；曲线仪表集中在页眉两端与页边（左侧档案、右侧决策栏），中央画布不放常驻大色块。 |
| 形状语义统一 | 圆 = 连续量（时代进度、人口住房覆盖、稳定度、资源储备比、观测置信度）；弧 = 带刻度的量纲（方位 / 等级 / 页签位置）；直角 = 可点击方块；胶囊只保留给分页与 2D/3D 切换。 |
| 中文黑体 + 英文结构层 | 中文继续用系统黑体（Microsoft YaHei / display 字体族），所有曲线组件内部读数、刻度、`//` 微标均走等宽（`--mono`）；弧组件 caption 使用英文结构层（ERA / RESERVE / OBS CONF / N 000）。 |
| 纹理 ≤ 2 / 动效 0.2–0.3s | 每屏仍然只有「点阵 + 斜纹」两种印刷纹理；新增动效只有 `stroke-dashoffset 0.24–0.25s`、抽屉/面板 `transform 0.26s`、关闭钮透明度过渡；无弹跳、无持续漂浮、无霓虹发光，`prefers-reduced-motion` 下全部瞬时到位。 |

---

## 2. 新增文件与改动清单

| 文件 | 类型 | 内容 |
| --- | --- | --- |
| `src/ui/curves.ts` | 新增 | 曲线组件层：`arcGauge` / `curvedScale` / `cornerArc` / `reserveRing` / `bearingRing`，全部 SVG 手写、无第三方依赖。 |
| `src/ui/mobile-nav.ts` | 新增 | 移动端底部导航（文明 / 观测 / 暂停 / 决策 / 终端），只做路由，业务动作全部复用既有 handle / actions。 |
| `src/ui/hud.ts` | 重写 | 页眉改为「巨型星历 + 时代进度弧 / 人口环 / 稳定度环 / 资源环形摘要」；新增移动端摘要行与「读数」展开开关。保留全部原有读数口径。 |
| `src/ui/center-overlay.ts` | 改造 | 观测视口增加外圈方位刻度弧（每 5° 细刻度 / 30° 长刻度 / 四正向标签）、恒星与母星方位标记、内圈 270° 观测置信弧；直线比例尺改为曲线刻度尺；新增移动端图例折叠开关。 |
| `src/ui/panels-left.ts` | 改造 | 分节标题弧形刻度（时代进程 / 稳定度分解 / 文明目标 / 资源）；人口页新增同心资源环；资源行右上角细弧；抽屉内新增移动端页签条与终端入口条；抽屉页签曲线分隔线。 |
| `src/ui/panels-right.ts` | 改造 | 决策栏顶部曲线分隔线（标记 = 当前页签序号）；恒星 / 母星卡片角细弧（置信度）；新增移动端全屏抽屉 API 与关闭语义。 |
| `src/ui/dock.ts` | 改造 | 新增移动端上滑「终端」面板 API（开合 / 关闭），桌面行为不变。 |
| `src/ui/widgets.ts` | 改造 | `section()` 支持 `arc` 选项与 `setArc(fraction)`，标题右侧渲染曲线刻度尺。 |
| `src/ui/screen-game.ts` | 改造 | 挂载移动端底部导航、抽屉遮罩、统一关闭逻辑；`ResizeObserver` 监听中央视口尺寸并触发画布 resize；Esc 逐层关闭抽屉。 |
| `src/ui/app.ts` | 改造 | 动态补齐 `viewport-fit=cover`（index.html 不在本任务写入范围），让 `env(safe-area-inset-*)` 生效。 |
| `src/ui/theme-print.css` | 追加 | 曲线原子样式、HUD 曲线版式、观测视口刻度弧、分节弧、卡片角弧、≤1024 / ≤720 响应式与移动端组件、安全区、触控尺寸、减少动效。 |
| `docs/UI_PRINT_V15.md` | 新增 | 本文档。 |
| `artifacts/ui-v15/**` | 新增 | 真实浏览器验收截图 + QA 脚本 / 场景 JSON / 度量报告。 |

> 未改动 `src/render3d/**`（3D HUD 统一由 task-22 负责）、`src/game/**`、`public/**`、`src/main.ts`。
> 所有既有 `data-action / data-dock / data-tab / data-tab-right / .tri-speed-btn[data-speed] / .tri-hud-pause / .tri-viewmode-btn`
> 选择器与行为全部保留；移动端只是把同一批按钮放进底部导航 / 抽屉 / 终端面板，没有出现死按钮。

---

## 3. 曲线组件与数据绑定

所有弧线均绑定真实 `ViewModel` 数据（`src/game/viewTypes.ts` 冻结契约），不做纯装饰弧堆叠：

| 组件 | 位置 | 数据绑定 | 语义 |
| --- | --- | --- | --- |
| 时代进度弧 `arcGauge`（270°，5 刻度） | HUD 左栏 | `civ.era.value` + `civ.era.progress`（总进度 = (Era-1+progress)/5）；端点标记 = 下一时代门槛；caption = 当前时代内进度百分比 | 文明五时代总进度 |
| 人口环形仪表 `arcGauge` | HUD 中栏 | 环 = `civ.population.housingRatio`（住房覆盖比），圆心 = `population.total`，下方 = 年增长 + 住房比 | 人口 / 住房关系 |
| 稳定度环形仪表 `arcGauge` | HUD 中栏 | 环 = `civ.stability.value / 100`，圆心 = 数值，标签 = `stability.label`，色调 = `stability.tone` | 稳定度 0–100 |
| 资源环形摘要（3 个 `arcGauge`） | HUD 右栏 | 食物 / 能源 / 科研：环 = `resource.ratio`（储备比），圆心 = 百分比，锁定资源显示解锁时代；临界 = 墨红 | 资源存量 / 容量 |
| 同心资源环 `reserveRing`（外 / 中 / 内三弧） | 左档案「资源储备与净流量」 | 三环 = 食物 / 能源 / 科研 `ratio`；中心 = 已解锁资源数；虚线纹理区分层级 | 资源结构关系 |
| 弧形分节标题 `curvedScale` | 左档案分节 + 右决策分节 | 时代进程 = 达成条件数 / 总数；稳定度分解 = 稳定度归一化值；文明目标 = 完成数 / 总数；恒星档案 = 平均置信度 | 分节完成度 |
| 曲线分隔线 `curvedScale` | 右决策栏页签下 / 左抽屉页签下 | 标记 = 当前页签序号 / 页签总数 | 页签位置（关系型刻度） |
| 观测视口外圈刻度弧 `bearingRing`（外圈） | 中央观测视口 | 每 5° 细刻度、30° 长刻度、四向 N/E/S/W；三恒星与母星标记 = 系统质心方位角（0°=+Z 北，90°=+X 东，与 2D 渲染 X/Z 投影一致）；未定位天体为空心虚线刻度，选中目标为信号黄长刻度 | 方位 / 关系 |
| 观测置信弧 `bearingRing`（内圈，同心） | 中央观测视口 | 270° 弧长 = 三恒星平均 `confidence`（未定位按 0），caption = 置信度 + `observation.dataPoints` | 观测数据质量 |
| 视场曲线比例尺 `curvedScale` | 观测视口右下 | 标记 = `observatory.level / maxLevel`；旁注 = 视场半径 AU + 天文台等级 / 能力数 | 观测能力等级 |
| 卡片角细弧 `cornerArc` + 切线 | 恒星 / 母星卡片、资源行 | 弧长 = 置信度 / 储备比；色调 = 置信度 tone / 临界 | 单卡片微读数 |
| 曲线刻度尺（`curvedScale` 原子） | 上述分节 / 分隔线 / 比例尺 | 刻度为等分参考，标记位置来自真实比例 | 刻度型量纲 |

技术细节：

- `arcGauge` 用 `stroke-dasharray = 弧长` + `stroke-dashoffset` 控制填充，CSS 过渡 `0.25s`；刻度为独立 `<line>`，包含 0/50/100% 长刻度。
- `reserveRing` / `cornerArc` 使用 `pathLength="100"` 归一化，保证虚线纹理下进度仍正确。
- `bearingRing` 用 `ResizeObserver` 监听容器，按像素尺寸重建 `viewBox`，刻度线用 `vector-effect` 不需要、靠像素坐标直接绘制，保证 1px 发丝在任何尺寸下不变形。
- 所有 SVG 均带 `aria-hidden`（纯视觉读数）或 `aria-label`（`arcGauge` 可读进度），不干扰键盘与读屏；文字读数仍由原有 DOM 数值节点承担。

---

## 4. HUD 版式（桌面）

- 184px 页眉（≤1366 收至 156px、≤780 高度收至 150px）仍为「顶部信号黄色带 → 品牌/警报 → 三栏读数」结构。
- 三栏改为：**时代进度弧 + 星历 / 人口·稳定度双环 / 资源环摘要**（原直线进度条全部替换为环或弧，读数文字口径不变）。
- 环尺寸随断点退让：1600 时代弧 88px、人口环 72px、资源环 44px；1366 → 70 / 58 / 36px；低高度 → 62 / 54 / 34px。
- 桌面 1600×900 / 1280×720 三栏宽度、右栏宽（352 / 318px）、导轨宽（84 / 76px）与 v1.3 一致，无页面级滚动。

## 5. 移动端架构（≤1024 / ≤720）

| 能力 | ≤1024（平板 / 小笔电） | ≤720（手机） |
| --- | --- | --- |
| 主舞台 | 单列：观测视口占满宽度；右决策栏脱离布局 | 同左，画布按容器 `ResizeObserver` 重算 |
| 左导航轨 | 隐藏，4 个档案页签移入白纸抽屉页内（44px 页签条）+ 7 个终端入口条 | 同左，46px 页签 |
| 左档案 | 抽屉全屏页（`translateY(100%) → 0`，0.26s），页内可滚动 | 同左，安全区内边距 |
| 右决策栏 | 全屏页签页（8 页签横向滚动，页签 44px），头部 × 关闭 | 同左，页签 46px |
| 底部导航 | 新增 `mobile-nav` 五入口：文明 / 观测 / 暂停 / 决策 / 终端，高度 56px + 安全区 | 58px + 安全区 |
| 终端 | 停靠坞变为上滑面板（8 个面板入口 + 时间控制），停在底部导航之上，带关闭钮 | 同左 |
| HUD | 折叠为「色带 + 品牌 + 读数摘要行」，右上「读数」展开完整仪表（绝对定位浮层，不推挤画布） | 同左，摘要行两行 |
| 弹窗 | `padding 14px`，最大高 92vh | **全屏化**：`100vw × 100dvh`，标题吸顶，内容滚动，底部安全区 |
| 触摸区 | 关键按钮 ≥40px | ≥44px（导航 58、抽屉页签 46、工具栏 42、主按钮 44、图标钮 44） |
| 安全区 | `meta viewport` 动态补 `viewport-fit=cover`；导航 / 抽屉 / 弹窗 / 终端均用 `env(safe-area-inset-*)` | 同左 |
| 弹层关闭 | 遮罩点击 / Esc / 面板关闭钮 / 导航再次点击同一入口，四者都可关闭 | 同左 |
| 画布 resize | `ResizeObserver(center.el)` + `window resize` 双保险 → `renderer.resize() / renderer3d.resize()` | 同左 |

- 底部导航「暂停」按钮直接调用 `actions.togglePause()`（与空格 / 停靠坞等价），图标随 `view.meta.paused` 切换播放/暂停。
- 移动端抽屉与全屏页签的打开状态由 `UiState` 之外的面板 class 管理（`is-open / is-mobile-open`），不污染冻结契约。
- 桌面所有 8 个右栏页签、4 个档案页签、8 个停靠坞入口、左侧按钮在移动端均可在 2 次点击内到达，无死按钮。

## 6. 验收截图（真实浏览器，headless Edge + CDP）

| 文件 | 视口 | 内容 |
| --- | --- | --- |
| `artifacts/ui-v15/v15-desktop-1600-game.jpg` | 1600×900 | 桌面主舞台：HUD 曲线仪表 / 观测视口方位刻度弧 / 右决策栏曲线分隔线 |
| `artifacts/ui-v15/v15-desktop-1600-dossier.jpg` | 1600×900 | 左侧白纸档案抽屉：弧形分节标题 / 时代进度 / 稳定度环 / 资源同心环 |
| `artifacts/ui-v15/v15-desktop-1280-game.jpg` | 1280×720 | 同界面 1280，无页面溢出 |
| `artifacts/ui-v15/v15-mobile-390x844-game.jpg` | 390×844 | 手机单列主舞台 + 折叠 HUD + 底部导航 |
| `artifacts/ui-v15/v15-mobile-390x844-hud.png` | 390×844 | 「读数」展开完整曲线仪表（浮层，不推挤画布） |
| `artifacts/ui-v15/v15-mobile-390x844-dossier.jpg` | 390×844 | 全屏文明档案：页签条 / 终端入口条 / 曲线分隔线 |
| `artifacts/ui-v15/v15-mobile-390x844-decision.jpg` | 390×844 | 全屏决策页签：8 页签横向滚动 / × 关闭 / 卡片角弧 |
| `artifacts/ui-v15/v15-mobile-390x844-terminal.jpg` | 390×844 | 终端上滑面板（8 入口 + 时间控制），停在底部导航之上 |
| `artifacts/ui-v15/v15-mobile-390x844-modal.jpg` | 390×844 | 设置弹窗全屏化（吸顶标题 / 安全区 / 44px 控件） |
| `artifacts/ui-v15/v15-tablet-768x1024-game.jpg` | 768×1024 | 平板单列主舞台 |
| `artifacts/ui-v15/v15-tablet-768x1024-decision.jpg` | 768×1024 | 平板全屏决策页 |
| `artifacts/ui-v15/v15-mobile-390x844-menu.jpg` | 390×844 | 移动端主菜单（单列、图版隐藏、触控按钮） |
| `artifacts/ui-v15/v15-tablet-768x1024-menu.jpg` | 768×1024 | 平板主菜单 |


截图方式：桌面 1600×900 / 1280×720 与平板 768×1024 主舞台用 **Edge headless CLI**（`--headless=new --screenshot --window-size=… --virtual-time-budget=18000`）复核；390×844 与所有抽屉 / 页签 / 终端 / 弹窗交互态用 **CDP 设备模拟**（`Emulation.setDeviceMetricsOverride(mobile:true)` + 触摸模拟 + 真实点击）。脚本与场景 JSON 位于 `artifacts/ui-v15/_qa/`。

复现：

```powershell
# 1) 启动 dev（若未运行）
node .\node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5173
# 2) 截图 + 度量（脚本与场景 JSON 均在 artifacts/ui-v15/_qa/）
$env:CDP_PORT='9611'
node .\artifacts\ui-v15\_qa\qa-v15.mjs 'http://127.0.0.1:5173/?autostart=1&skipstartup=1&seed=UI15-QA' .\artifacts\ui-v15\_qa\scenario-mobile-final.json .\artifacts\ui-v15
node .\artifacts\ui-v15\_qa\qa-v15.mjs 'http://127.0.0.1:5173/?skipstartup=1' .\artifacts\ui-v15\_qa\scenario-menu.json .\artifacts\ui-v15
# 桌面 / 平板静态主舞台（CLI）
& $edge --headless=new --disable-gpu --window-size=1600,900 --virtual-time-budget=18000 --screenshot=artifacts\ui-v15\v15-desktop-1600-game.png 'http://127.0.0.1:5173/?autostart=1&skipstartup=1&seed=UI15-QA'
```

## 7. 自检数据

- **TypeScript**：`node .\node_modules\typescript\bin\tsc --noEmit` → 0 错误。
- **浏览器**：截图流程无 exception、无 console error、无失败请求。证据：`artifacts/ui-v15/_qa/mobile-final-report.json`（390 全流程）、`hud-report.json`（读数展开）、`g390-report.json`（390 主舞台）、`menu-report.json`（390 / 768 菜单）。桌面 1600/1280 与平板 768 使用 Edge headless CLI `--screenshot` 复核（CLI 不采集 console；同构建产物此前经 CDP 运行 exceptions=0）。
- **页面级溢出**：1600×900、1280×720、390×844、768×1024 四档均 `documentElement.scrollWidth/Height` 与视口一致（`overflowX=false / overflowY=false`），滚动只发生在面板 / 抽屉 / 弹窗内部。
- **黄色面积**：Python + Pillow 对截图做像素统计（信号黄判定：`R≥200 且 G≥200 且 B≤120`），各截图黄色占比见下表（均 ≤10%）。

| 截图 | 黄色像素占比 |
| --- | --- |
| desktop-1600-game | 2.34% |
| desktop-1280-game | 2.43% |
| mobile-390x844-game | 2.57% |
| tablet-768x1024-game | 2.02% |

- **触控区**：390 宽度下由 `getBoundingClientRect()` 采样（`mobile-final-report.json` / `hud-report.json` / 早前同构建 CDP 采样）：底部导航 78×58、HUD 读数/警报 64×44、暂停 44×44、2D/3D 42–44×44、缩放 44×44、图例开关 44×44；抽屉页签 98×46、抽屉终端入口 90×44、抽屉关闭 44×44；决策页签 72×46、决策关闭 44×44、终端面板入口 86×60、倍速 42×44、终端关闭 44×44；弹窗关闭与主按钮 44×44。主行动 / 图标钮统一 `min-height:44px`（密集列表里的 `tri-btn-xs` 按 36px 保留，属于次要行内操作）。
- **功能保留**：所有 data-action / data-dock / data-tab 按钮在移动端均保留于 DOM（被收纳进抽屉 / 终端面板），无死按钮；桌面 1280 布局与 v1.3 一致。

## 8. 已知缺口 / 取舍

1. **视口方位刻度的参考系**：方位角按「系统质心（世界原点）→ 天体」在 X-Z 平面的夹角计算（0°=+Z、90°=+X，与 2D 渲染投影一致）。相机平移后，刻度标记代表的是系统绝对方位，而不是屏幕坐标位置；这是有意的「绝对方位盘」语义，已把说明写入 `center-overlay.ts` 注释。若要跟随相机平移，需要 render 层暴露相机中心，超出本任务写入范围。
2. **3D 视图 HUD**：3D 模式下的中央 HUD / 图例统一由 task-22（src/render3d）负责，本次只保证 2D/3D 切换器与中央视口在移动端可达；3D 画面外圈刻度弧沿用同一 SVG 容器，未改 render3d 代码。
3. **移动端真实性验证**：用 headless Edge 的 `Emulation.setDeviceMetricsOverride(mobile:true)` + 触摸模拟做布局与交互验证；未在真机 iOS Safari 上验证动态地址栏 / 软键盘顶起等浏览器行为，安全区使用 `env()` 标准方案，理论可用。
4. **横屏**：≤1024 且高度 ≤560 的横屏只做了 CSS 压缩（隐藏摘要行、收窄底部导航），未出验收截图；竖屏 390×844 / 768×1024 已覆盖。
5. **主菜单 / 新游戏**：移动端做了单列化、图版隐藏、按钮加高与安全区处理，并截了 390 / 768 菜单图；新游戏预览在手机上改为下方块（可滚动），未逐项回归每个表单控件。
6. **事件 / 科技树 / 政治等大画册弹窗**：≤720 已统一全屏化并通过设置弹窗验证；这些长内容弹窗本身在手机上以内部滚动呈现，未逐个截图。
7. **字体**：沿用系统字体栈（Microsoft YaHei / Bahnschrift / 等宽），没有引入 web font，避免额外下载与版权问题。
8. **截图工具限制**：本机在多方并行高负载时，headless Chrome/Edge 的 CDP `Page.captureScreenshot` 偶发返回空白 / 黑块；最终验收采用「等待 UI 挂载 + 尺寸校验重试」并对手动交互态使用 CDP，对静态主舞台使用 Edge CLI `--screenshot` 复核。另：Windows 下 CLI 对 <500px 的窗口宽度存在最小布局宽度裁剪，因此 390×844 手机截图必须用 CDP 设备模拟（已如此执行）。
9. **资源**：本任务未新增任何位图 / 字体素材；曲线、刻度、方位盘全部为代码绘制（SVG / CSS），来源为程序化生成，无版权素材。

## 9. 与 v1.3 的兼容说明

- 保留 v1.3 全部颜色 token、圆角、阴影、印刷装饰与 `prefers-reduced-motion` 降级。
- 页眉旧的 `.tri-hud-era-track / .tri-hud-era-fill` 直线进度条被弧形仪表替换；E2E 契约中列出的
  `data-action / data-dock / data-tab / data-tab-right / .tri-speed-btn[data-speed] / .tri-hud-pause / .tri-viewmode-btn`
  全部保留，未破坏契约。
- 移动端新增的 `.tri-mobilenav / .tri-mobile-scrim / .tri-drawer-tabs / .tri-drawer-tools / .tri-curve-*` 类均为新增，
  桌面默认 `display:none` 或零影响。


## 手机横屏适配（v1.4.1）

- 新增 `@media (max-width:1024px) and (orientation:landscape) and (max-height:560px)` 横屏布局，详见 `docs/MOBILE_LANDSCAPE.md`。
- 主菜单双栏、新纪元双栏、弹窗全屏内部滚动、抽屉紧凑页头、底部导航图标化、刘海安全区。
- 验收尺寸 844×390 / 667×375 / 568×320；竖屏 390×844 与桌面 1280×720 回归通过。
