# UI v1.3 —《三体纪元》终末地「工业画册」设计规范

> 范围：`src/ui/**` 全部界面。本版将 v1.2 的深色硬科幻终端整体改写为**白纸、黑字、大图、一处黄**的印刷画册界面；观测视口与世界观/结局影像保留深色。
> 冻结契约：`src/game/viewTypes.ts` 的 `ViewModel / GameActions`；UI 不直接 import 模拟层。

## 1. 设计语言

- **白纸**：页面基底 `#F4F1EA`（纸白），卡片/面板 `#FFFFFF`，辅助纸 `#F7F4EC`。
- **黑字**：墨黑 `#111111`，次级墨 `#2B2B2B`，灰阶 `#D9D9D9 / #E7E4DC / #6B6B6B / #9A9A9A`。
- **一处黄**：信号黄 `#FDFD1F`，只用于：顶部通栏色带、当前导航项的角标、研究重心/选定教义、主行动 hover、灾害色带、加载页进度。数据不允许滥用黄以外的霓虹色；危险/警告/成效使用低饱和墨色（`#A3241B / #7A5200 / #1C6B46`）。
- **深色两处**：中央观测视口（宇宙必须暗）、世界观影像与事件插图 / 结局影像。
- **直角**：按钮、页签、卡片圆角 2–3px；圆形只用于部长头像与翻页钮；胶囊只用于分页条、2D/3D 切换器、步骤指示。
- **印刷装饰**：45° 斜纹（标题栏/分页胶囊/锁遮罩）、点阵（面板与模态正文）、CMYK 注册色条（顶栏右上、菜单图版）、方括号标题、发丝线、微标（`// TRISOLARIS`、`PRINT // TRISOLARIS`）。可直接引用 `public/print/**`（hatch-45 / dot-matrix / registration-strip / line-art-corners / loading-lineart），缺失时全部有 CSS 兜底。
- **阴影**：极轻，`0 1px 2px rgba(0,0,0,.06)`、模态 `0 22px 60px rgba(17,17,17,.18)`；无发光、无玻璃拟态、无切角 polygon。
- **动效**：抽屉滑入、关闭钮 hover 旋转 90°、翻页、数值过渡；全部尊重 `prefers-reduced-motion`。

## 2. Design tokens（`src/ui/theme-print.css` `:root`）

| token | 值 | 用途 |
| --- | --- | --- |
| `--paper` | `#F4F1EA` | 页面纸底 |
| `--paper-2` / `--panel` | `#FFFFFF` | 面板/卡片/模态 |
| `--paper-3` | `#F7F4EC` | 输入底、内嵌块、抽屉页脚 |
| `--ink` / `--text` | `#111111` | 正文与主按钮 |
| `--muted` / `--faint` | `#6B6B6B` / `#9A9A9A` | 次级/三级信息 |
| `--grey` / `--grey-2` | `#D9D9D9` / `#E7E4DC` | 发丝线、轨道、非激活页签 |
| `--signal` | `#FDFD1F` | 唯一信号色 |
| `--danger / --warn / --ok` | `#A3241B / #7A5200 / #1C6B46` | 数据语义色（低饱和） |
| `--mono` | Cascadia / Consolas / SF Mono | 数字、微标、表格 |
| `--display` | Bahnschrift / DIN Condensed / 系统无衬线 | 巨型标题 |
| `--hud-h` | 184px / 156px(≤1366) / 150px(≤780h) | 页眉高度 |
| `--rail-w` | 84px / 76px(≤1366) | 左导航轨 |
| `--right-w` | 352px / 336px / 318px | 右侧决策栏 |
| `--dock-h` | 62px / 58px / 54px | 底部停靠坞 |
| `--left-w` | 344px / 330px / 314px | 白纸抽屉宽度 |

## 3. 版式结构

```
.tri-screen.tri-game
├── .tri-game-register          顶栏右上 CMYK 注册色条
├── .tri-panel-left             通高白色导航轨（84px）
│    └── .tri-rail-drawer       白纸抽屉（浮层，从轨右缘浮出，不推挤主舞台）
├── .tri-game-stage             主舞台
│    ├── .tri-hud               三栏页眉：星历/回合/时代 · 人口/稳定度 · 资源账目
│    ├── .tri-game-main
│    │    ├── .tri-center       深色观测视口（canvas 透出 + 12px 纸板 + 黄色角标/刻度）
│    │    └── .tri-panel-right  白色决策栏（8 个页签：恒星/环境/观测/预测/科技/灾害/政治/事件）
│    └── .tri-dock              细线停靠坞 + 时间控制（暂停/倍速/单步）
├── .tri-modal-layer            白纸画册模态（深灰斜纹标题栏 + 居中白字）
├── .tri-pause-overlay / .tri-ending-layer
```

- 导航轨只放图标；当前项浅灰底 + 左缘墨色竖条 + 黄色角标；悬停向右浮出墨色文字条（不推挤）。
- 顶部页眉与主舞台以 1px 墨线硬分隔，主舞台仅中央视口透出画布，其余区域全部为纸面。
- 抽屉打开时图例/观测图版向右让位（`.tri-game.is-drawer-open`）；Esc 优先收起抽屉。

## 4. 组件

1. **按钮**：`.tri-btn` 白纸+墨线；`.tri-btn-primary` 黑底白字（主行动）；hover 转信号黄；`.tri-btn-icon` 直角小方钮；危险按钮墨红描边。
2. **页签**：浅灰底，激活项左移 2px + 黑色圆形箭头（`::before →`）+ 白底墨框；支持数据角标 `data-badge`。
3. **面板**：近白底 + 点阵浮层 + 深灰斜纹标题栏（`.tri-panel-head`，标题白字）；页脚发丝线 + 微标。
4. **模态**：白纸画册页 + 深灰斜纹标题栏居中白字 + 关闭钮 hover 旋转 90°；右下角印刷裁切角；模态正文点阵底。
5. **分页**：`.tri-pager` 浅灰胶囊叠斜纹 + 两端白色圆钮（日志面板实际使用，可翻页查看事件日志）。
6. **加载页**：近黑底 + 贴左缘黄色竖向进度条 + 大号百分比 + 右侧装订文案；到 100% 黄色铺满后 2.4s 淡出（`prefers-reduced-motion` 直接跳过）。
7. **主菜单**：白纸版面（点阵 + 裁切角 + 微标），右侧 `PLATE 01` 世界观印刷图版（白框 + 说明条 + CMYK 注册标），左侧巨型标题与黑底主行动按钮；页脚统一 `v1.3.0 · 单机离线`。
8. **新游戏**：白纸表单（种子/难度/模式）+ 右侧深色星图预览（观测影像），启动按钮黑底白字。
9. **观测视口**：深色印刷大图；`// OPTICAL PLATE 01` 白纸条、LIVE·2D/3D、黄色角标、边界刻度、瞄准十字、白色图例卡、场半径比例尺、选中数据卡、底部状态/警告带。
10. **停靠坞**：左运行读数、中八个面板入口（data-dock 不变）、右时间控制（暂停/倍速/单步）+ 收起；收起后仅图标。

## 5. 阶段 B 深化（v1.3 新面板）

- **政治终端**（`.tri-modal-politics`，右栏「政治」页签与导航轨 `data-rail="politics"` 均可打开）：
  政治资本/稳定修正/峰会；六部门卡片（部长圆形头像按派系描边、能力/忠诚/廉洁/野心条、派系徽章与特质、部门效率与修正、两段式罢免）；五派系影响力条 + 满意度；候任部长列表（任命 `appointMinister`）；6×6 关系矩阵（点选两位部长 → `mediateMinisters`）；政务记录。所有按钮接真实 actions。
- **事件档案**（`.tri-modal-event`）：大插图（`img` + onerror 斜纹兜底）、编辑式排版（短摘要/正文/长文本展开/引文）、2–3 个抉择按钮（后果预览、风险、条件锁定原因）、事件纪年时间线、概率修正 chips。事件 pending 时游戏屏自动弹出并暂停模拟，Resolve `resolveEvent`；玩家关闭未抉择则记「稍后处理」并恢复时间。
- **科技树大画册**（`.tri-modal-research`，重写）：顶部研究状态（在研进度/速率/已研究总数/六学派进度）、左侧学派筛选与研究重心（`chooseSchoolFocus`）、互斥教义裁定（`chooseDoctrine`）、8 分支 × 5 时代矩阵（横向 + 纵向滚动；卡片状态：已研究/研究中/可研究/锁定/教义封闭）、右侧长文本详情抽屉（原理长文、引文、逐条效果、前置、教义、开始/中止研究 `startResearch/cancelResearch`）。

## 6. 数据与动作接入

- 只读 `ViewModel`：`politics?` / `events?` 全部做 undefined 安全降级（档案未解封：`.tri-archival` 文案），未来接入不报错。
- 已绑定 actions：`togglePause / setSpeedIndex / advanceTurn / startBuilding / upgradeBuilding / cancelConstruction / startResearch / cancelResearch / chooseSchoolFocus / chooseDoctrine / appointMinister / dismissMinister / mediateMinisters / holdSummit / resolveEvent / startObservation / cancelObservation / upgradeObservatory / refreshPrediction / select / toggleSetting / save/load/list/export/import / returnToMenu`。
- 保留 v1.2 的全部 `data-action / data-dock / data-tab / data-tab-right / .tri-speed-btn[data-speed] / .tri-hud-pause / .tri-viewmode-btn` 选择器契约（E2E 可继续沿用；右栏页签由 6 扩为 8，左栏 `[data-tab]` 仍为 4 个并移入导航轨）。

## 7. 截图（真实浏览器，artifacts/ui-v13/）

| 文件 | 内容 |
| --- | --- |
| `final-1600-menu.png` | 1600×900 主菜单（白纸版面 + PLATE 01 世界观图版） |
| `final-1600-newgame.png` | 1600×900 新游戏：白纸表单 + 深色星图预览 |
| `final-1600-game.png` | 1600×900 主舞台（三栏页眉 / 深色观测视口 / 白色决策栏 / 停靠坞，无滚动溢出） |
| `final-1280-game.png` | 1280×720 同界面（无页面溢出，滚动仅在面板内） |
| `b-b4-drawer-overview.png` | 白纸抽屉：时代卡 / 时代进程 / 人口稳定度 |
| `b-b5-right-politics.png` | 右栏「政治」页签（资本/派系/打开完整档案） |
| `b-b6-politics-modal.png` | 政治终端：资本/六部门/部长圆环头像/派系/罢免 |
| `b-b8-tech-drawer.png` | 科技长文本详情抽屉（科技树大画册） |
| `b-b9-event-modal.png` | 事件档案（当前无 pending 的平静态；有事件时自动弹出并暂停） |

## 8. 文件与工程

- `src/ui/theme-print.css`：v1.3 主题层（在 `styles.css` 之后 import），包含 token、版式、全部组件换装与响应式。
- 新增：`src/ui/modal-politics.ts`、`src/ui/modal-event.ts`；重写：`src/ui/modal-research.ts`、`src/ui/hud.ts`、`src/ui/dock.ts`；改造：`screen-game / panels-left（导航轨+抽屉）/ panels-right（8 页签+政治事件页）/ center-overlay / app（加载页）/ screen-menu / modal-log（分页）/ modals / types`。
- 自检：`node .\node_modules\typescript\bin\tsc --noEmit` 对 `src/ui/**` 0 错误（全仓由 lead 集成后应保持 0）；无头 Edge 截图流程无 console error / 无 exception；1600×900 与 1280×720 均无页面级滚动溢出（滚动只发生在面板/模态内部）。

## 9. 已知缺口

- `public/events/<id>.jpg` 由美术并行生成中；当前事件插图缺失时自动退化为「斜纹事件档案板 + 事件 id」，补齐后无需改代码。
- `public/print/**` 目前存在 hatch/dot-matrix/registration-strip/line-art-corners/loading-lineart；CSS 引用均带本地渐变兜底，缺失不会破版。
- 事件自动弹窗的「pending → 暂停 → 抉择」流程已接好，但本机截图时随机事件尚未触发（累计 0 次），待 lead 在更长回合的 E2E 中复验一次真实触发。
- 科技树矩阵截图在收尾时因机器负载未再补拍（`b-b7-techbook-1600.png` 对应的是矩阵横向溢出的旧版，已修复为固定 5 列 + 横向滚动）；矩阵结构以 `b-b8` 抽屉截图与代码为准。
- 旧版 E2E 断言「左栏常驻 + 右栏 6 页签」需随 v1.3 调整：左栏改为默认收起的白纸抽屉（导航轨常驻），右栏为 8 页签。
- 3D 辅助视图沿用 Three.js 渲染器（不在本次 UI 范围），仅将其挂载到中央视口内；无 WebGL 环境仍安全降级 2D。
- 未做多浏览器像素回归（Edge/Chromium 实测为主）。
