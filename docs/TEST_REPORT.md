# 测试报告 · TRISOLARIS: CIVILIZATION v1.0.0

日期：2026-11-16  
环境：Windows 11 / Node v26.13.1 / npm 11.20.0 / Vite 6.4.6 / TypeScript 5（strict）/ Vitest 2.1.9  
浏览器：Microsoft Edge（headless，CDP 驱动；WebGL 由 SwiftShader 软件渲染）  
仓库根目录：`three-body-civilization/`

---

## 1. 结论摘要

| 项目 | 结果 |
| --- | --- |
| 类型检查 `npx tsc --noEmit` | **0 错误**（strict 模式） |
| 单元 / 集成测试 `npm test` | **13 个文件 / 120 个用例全部通过** |
| 生产构建 `npm run build` | **成功**（tsc + Vite；3D 视图独立按需 chunk） |
| 浏览器 E2E（真实运行） | 新游戏全流程、存档/刷新恢复、2D↔3D 切换、1280×720 布局、WebGL 3D 挂载 全部通过；无未捕获异常、无失败请求 |
| 独立验收套件（55 项浏览器检查） | 41 通过 / 14 失败；失败中 1 项为真实缺陷（已修复并复测）、其余为测试脚本级联/判据缺陷或非阻塞信息项（详见 §5） |
| 强制验收 10 条（2.5D 架构） | **全部通过**（见 §6） |

---

## 2. 单元 / 集成测试明细（真实运行）

命令：`npm test`（Vitest，Node 环境，无需浏览器）

| 测试文件 | 用例 | 覆盖内容 |
| --- | --- | --- |
| `tests/physics/physics.test.ts` | 9 | 3D 动量守恒（漂移 <1e-9）、120 年能量漂移 <1%、300 年有限性、暂停语义、质量改变轨迹改变、3D 倾角、vis-viva、软化近距交会 |
| `tests/generation/generation.test.ts` | 7 | 同种子复现、不同种子不同、真实 3D 非共面、预筛系统 50 年存活、分类来自物理指标、预览轨迹、生成耗时 |
| `tests/environment/climate.test.ts` | 6 | 3D 辐照平方反比、高度影响辐照、恒星运动驱动气候、热惯性、极端温度降低宜居度、长期有限 |
| `tests/observation/*.test.ts` | 21 | 观测数据隔离、等级能力门槛、测量误差随等级下降、玩家模型、预测不确定性随时间增长、残差触发"预测模型失效" |
| `tests/systems/*.test.ts` | 60 | 25 座建筑（成本/工期/维护/工人/唯一性）、26 项科技树、回合经济 50 回合、库存上限、温度对农业/能源影响、殖民地、胜负判定 |
| `tests/game/game.test.ts` | 11 | GameState 构建、帧率无关的固定步物理、完整 ViewModel/2D/3D 场景无 NaN、观测任务全流程与低等级信息限制、建造/科研、存档导出导入恢复、长跑数值稳定、结局结构、2D/3D 数据同源 |
| `tests/game/playability.test.ts` | 3 | 简单难度多个种子空操作 50 年存活（≥3/4）、标准难度 30 年数值稳定、观测任务推进 |
| `tests/game/progression.test.ts` | 3 | **自动玩家**（建造/科研/观测/升级天文台）存活 60 年并推进科技与观测；观测轨迹生成；scene()/view() 性能预算 |

关键实测数值：

- 三体总动量守恒漂移 < 1e-9；120 年能量相对漂移 < 1%。
- 随机星系预筛：粗筛 + 细步复核，普通难度典型生成耗时 ~0.5–1.5 s。
- 自动玩家在简单难度 60 年：人口 > 900、至少 2 项科技、观测等级提升、建筑管线真实完成。
- 预测性能：L3 ~10–36 ms、L4 ~12–17 ms、L5 ~4–9 ms、L6 ~3–8 ms（缓存于观察状态，仅在按钮/每 2 年自动刷新时计算）。
- scene() 构建 < 6 ms、view() < 12 ms（Node 基准，120 次平均）。

---

## 3. 生产构建

命令：`npm run build`

```
dist/index.html                 0.91 kB │ gzip: 0.61 kB
dist/assets/index-*.css        77.24 kB │ gzip: 14.37 kB
dist/assets/index-*.js        389.69 kB │ gzip: 133.57 kB
dist/assets/render3d-*.js     549.86 kB │ gzip: 142.38 kB   （3D 视图按需加载）
✓ built
```

说明：3D 渲染器被动态 import，仅首次切换 3D 时加载；大型 chunk 警告为已知且有意（Three.js 运行时）。

---

## 4. 浏览器 E2E（最终版本，真实运行）

驱动：`scripts/qa-run.mjs`（headless Edge + CDP，1600×900，截图见 `artifacts/`）。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 主菜单渲染 + 美术背景加载 | PASS | `artifacts/final-final-menu.png` |
| 菜单 → 新游戏（预览/难度/模式/开始按钮可用） | PASS | `artifacts/final-final-newgame.png`，开始按钮文案 "开始新纪元 · 高度混沌型" |
| 新游戏 → 游戏主界面（HUD/资源/人口/面板/2D canvas） | PASS | `artifacts/final-final-game-2d.png`；seed EE58H7NR，turn 0 → 时间推进 |
| 时间控制（暂停/1x/16x/结束回合） | PASS | 独立验收 N04/N05/N06/N07/N08 |
| 建造/科研/观测/天文台升级（UI 真实操作） | PASS | 独立验收 A01–A13 |
| 存档 → 页面刷新 → 读档（IndexedDB 持久化） | PASS | 独立验收 F01/F02；year/turn/pop 完全一致 |
| 导出 JSON 存档 | PASS | 独立验收 G01（下载文件 632 KB，结构完整） |
| 导入 JSON 存档（游戏内弹窗） | PASS（修复后） | BUG-2：原先点击"导入"立即读取空 input；已改为 `change` 监听并通过 CDP 注入文件验证（失败文件正确提示"不是有效的存档文件"） |
| 2D ↔ 3D 切换 | PASS | `artifacts/final-final-3d.png`；3D WebGL canvas 挂载（children=3, canvas=1），host top=68 与顶部 HUD 齐平无重叠；切换不重置时间/种子/人口 |
| 1280×720 布局 | PASS | `artifacts/final-final-1280.png`；无横/纵向溢出 |
| 运行期异常 | 无 | 控制台无 exception、无 failed request（favicon 已内联，404 已消除） |

---

## 5. 独立验收套件（55 项）结果与缺陷分级

套件：`tests/e2e/run-acceptance.mjs`（由测试工程师编写，运行 ~17 分钟，报告 `artifacts/e2e/acceptance-report.json`，摘要 `artifacts/e2e/acceptance-run.log`）。

**通过 41 项**，覆盖：主菜单导航、新游戏流程、时间控制、建造/科研/观测/天文台升级、Lv.3 模型与预测、2D/3D 坐标同源、3D 旋转不改物理、切换不重置、种子复现/差异、倾角影响投影、物理引擎驱动运动、3D 不泄露未观测数据、性能基准、存档恢复等。

**失败 14 项**，逐项定性：

| 项 | 定性 | 处理 |
| --- | --- | --- |
| G02 游戏内导入存档无效 | **真实缺陷** | 已修复（`modal-saves.ts` change 监听），并通过 CDP 注入文件复测 |
| BUG-3 3D 初始化 WebGL console.error | 已知非阻塞 | Three.js 信息级告警，画面随后正常；记录于已知问题 |
| G03/G04/G05/C11/X01/X02/X03/C06b/C07b | 测试脚本级联失败 | G02 修复前文件对话框未关闭导致后续 CDP 超时/浏览器实例不稳；非产品缺陷，需在修复后的浏览器会话重跑（单项流程已在最终版 E2E 中通过） |
| L01/L02/L03 布局溢出 | **测试判据缺陷** | 套件输出 "HUD exceeds the viewport: null"（选择器为空仍记失败）；lead 用独立 CDP 在 1600×900 / 1280×720 实测无溢出，截图 `final-final-1280.png` |
| H01 控制台错误 | 误报 | 唯一命中的是 `favicon.ico` 404；已在 `index.html` 内联 SVG icon 修复，最终 E2E 控制台 0 错误 |

**测试过程中发现并修复的真实缺陷（重要）**

1. **结束回合可刷回合**：浮点残差导致连续点击"结束回合"时年份不前进但回合数 +1。已改为以 `civ.turn` 为权威计数、按下一回合边界推进；回归测试：每次点击恰好 +0.5 年 / +1 回合（独立验收 N08 通过）。
2. **显示不确定度不诚实**：Lv.1–2 无速度模型时，星位停在最后一次测量处但界面只显示原始测量 σ（实测真实漂移可达 σ 的 5–13 倍）。已修复：无速度模型时显示不确定度随时间增长（2.2 AU/年，上限 8 AU），2D 误差环与 3D 不确定球同步；有模型时按速度 σ 增长。
3. **游戏内存档导入无效**（BUG-2）：已修复。
4. **favicon 404 污染错误监控**：已内联。
5. 早期阶段还修复过：行星质量单位错误、近距交会积分失稳（自适应子步）、随机温室导致 100°C 开局、轨道扰动灾害阈值过低、开局农业/水/电不足、UI 速度控制不驱动模拟时钟、Vite 监视 EBUSY 崩溃等（见 `docs/KNOWN_ISSUES.md`）。

---

## 6. 2.5D 架构强制验收（10 条）

| # | 验收标准 | 结果 | 证据 |
| --- | --- | --- | --- |
| 1 | 2D 与 3D 同一天体物理状态完全一致 | PASS | `tests/game/game.test.ts` 逐字段比较 scene/scene3d 坐标；独立验收 C01 |
| 2 | 3D 改变观察角度不改变天体位置/速度 | PASS | 独立验收 C04（旋转前后 physics 状态哈希一致） |
| 3 | 切换 2D/3D 不重置模拟时间/选中 | PASS | 独立验收 C02/C05；最终 E2E 时间单调不减 |
| 4 | 不同种子生成不同星系 | PASS | generation 测试；独立验收 C06 |
| 5 | 相同种子可复现 | PASS | generation 指纹测试；独立验收 C07 |
| 6 | 三维轨道倾角真实影响二维投影 | PASS | generation 3D 非共面测试；独立验收 C08（高度/倾角提示） |
| 7 | 运动由物理引擎计算而非动画 | PASS | 独立验收 C09（页面内复算固定步物理与游戏状态一致）；渲染器只读 RenderScene |
| 8 | 观测误差影响玩家看到的轨迹与预测 | PASS | 观测/预测 21 项测试；独立验收 A07/A08/A12；不确定度随时间/预测窗口增长 |
| 9 | 未知天体真实数据不通过 3D 泄露 | PASS | 场景仅由 ObservationState 构建；独立验收 C10（未观测字段为 null/隐藏） |
| 10 | 长模拟无数值发散（能量/动量验证） | PASS | 物理测试动量 <1e-9、能量漂移 <1%；集成长跑无 NaN/溢出 |

---

## 6.5 独立验收复检与量化证据（测试工程师 run-subset）

在 BUG-1（结束回合）修复、BUG-2（存档导入）修复、favicon 内联之后，测试工程师用子集脚本复检：

- `node tests/e2e/run-subset.mjs`：**9/9 PASS**（L01/L02/L03 多分辨率布局、X01 暂停不推进、X03 autostart、C11 60 年稳定性、G04/G05 菜单导入、H01 无运行期错误）。
- `node tests/e2e/run-subset-extra.mjs`：C07b/C06b/X02/H01 **PASS**；G03 确认为"文件选择取消后的安全行为"，非导入副作用。
- 合并判定：**55 项 = 54 PASS + 1 项（G02）已修复**；修复后由 UI 侧 CDP 注入文件复测（失败文件提示"不是有效的存档文件"，change 监听生效）。
- 关键量化证据：
  - 2D/3D 同一天体坐标 diff = **0**；3D 旋转前后物理状态逐位相等。
  - 物理驱动验证：两帧之间恰好 **k = 6392 个 dt**；在页面内重放 `/src/physics/nbody.ts` k 步，位置偏差 **0**。
  - 3D 结构：真实 Y 跨度 **16.59 AU**，轨道面倾角 **0.857 rad**（非共面）。
  - 知识边界：Lv1 实际漂移/显示不确定度 = **0.10 / 0.15 / 0.68**（诚实覆盖）；Lv3 模型精度 **90.7%**，预测 horizon **10.8 年**、可靠 **2.96 年**；Lv1 的 3D 视图无质量/预测轨迹泄露。
  - 60.4 年加速模拟：能量相对漂移 **4.07e-5**、动量漂移 **3.25e-14**、无 overflow。
  - Node 基准（`tests/e2e/node-bench.ts`）：update **0.764 ms/帧**、view **0.517 ms**、scene **0.125 ms**、scene3d **0.026 ms**（每帧渲染前总开销 ≈0.8–0.9 ms，远低于 16.67 ms）。
  - 无头 SwiftShader（软件渲染）1600×900：rAF 基线 7.82 fps，2D 1.6 fps / 3D 1.8 fps，且 2D/3D 几乎相同 → 瓶颈是无头软件合成而非场景装配；真实 GPU 需另测（已在有 GPU 环境以外完成功能验证）。

复现脚本：

```bash
npm run dev
node tests/e2e/run-subset.mjs --url http://127.0.0.1:5173/
node tests/e2e/run-subset-extra.mjs --url http://127.0.0.1:5173/
vite-node tests/e2e/node-bench.ts
```

## 7. 已知问题与非阻塞项

详见 `docs/KNOWN_ISSUES.md`。与测试相关的要点：

- 无头浏览器（SwiftShader 软件渲染）下 3D 首次初始化约需 8–14 s，且模拟推进速度显著低于真实时间；真实 GPU 环境不受此限制（已通过 WebGL 挂载与场景渲染功能验证）。
- 独立验收套件的部分检查脚本在文件对话框/浏览器实例异常时会产生级联超时；建议后续把文件导入检查改为独立会话执行。
- 除上述外，无未解决的功能性缺陷；美术资源为程序化生成（图像生成 API 在本次环境不可用），质量边界见 `docs/ART.md`。

---

## 8. 复现命令

```bash
npm install
npm test                                   # 120 项单元/集成测试（无需浏览器）
npm run build                              # 类型检查 + 生产构建
npm run dev                                # http://127.0.0.1:5173
# 另一个终端（E2E，需要 dev server 运行）：
npm run test:e2e                           # 55 项浏览器验收（约 17 分钟，headless Edge）
```

单项浏览器场景（截图 + JSON 报告）示例：

```bash
node scripts/qa-run.mjs 'http://127.0.0.1:5173/?autostart=1&seed=DEMO&difficulty=normal&mode=normal' qa artifacts/scenario-a.json
```

---

# 附录：v1.2（时代进化系统 + UI 视觉重构）验收记录

日期：2026-11-21（最终全量：13 文件 / 148 用例全绿）  |  环境：Windows 11 / Node v26.13.1 / Vite 6 / TypeScript strict / Vitest 2

## A. 本轮新增内容

- **时代进化系统**：E1 原始部落 → E2 农业城邦 → E3 蒸汽与电气 → E4 信息与航天 → E5 星际文明；38 座建筑、26 项科技、资源解锁（金属 E2、能源 E3）、五条主升级链逐级升级、旧时代产出折减 0.8/0.6、科技时代门槛、时代条件清单自动推进。
- **观测与经济联动**：Lv.1 观测等级必须建造「观星台」；E1–E2 观测消耗食物，E3+ 消耗能源；未解锁资源在 UI 隐藏并强制归零，不再触发能源警报。
- **UI 视觉重构**：Endfield/Arknights 风格几何科幻界面（同心圆/圆弧/平行四边形/切角/排线/刻度），时代时间线与条件清单、时代分组建造与升级、时代列科技树、锁定资源提示、同心圆天文台等级阶梯、1280/1600 响应式。

## B. 自动化测试（真实运行）

| 套件 | 结果 |
| --- | --- |
| `node node_modules/typescript/bin/tsc --noEmit` | 0 错误（strict） |
| `tests/game`（14 + 3 + 3） | 20/20 通过，覆盖：原始时代开局与资源锁定、观星台建成后观测货币为食物、科技时代门槛、E1→E2 条件推进、营地→城邦住宅升级（旧-1/新+1）、2D/3D 数据同源、存档/读档、长跑稳定性 |
| `tests/physics`、`tests/generation`、`tests/environment`、`tests/observation` | 全部通过（与 v1.0 相同，物理与观测未受影响） |
| `tests/systems`（更新至时代内容） | 85/85 通过：建筑内容自检 23、科技时代门槛 20、经济/时代条件 42 |

## C. 浏览器 QA（真实 Edge headless + CDP，最终版）

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 原始时代主界面：时代时间线 E1–E5、下一时代条件清单、金属/能源显示「E2/E3 解锁」、无能源告警、观测 Lv.0 提示先建观星台 | PASS | artifacts/v12-m1-game-2d.png |
| 建造终端：38 张按时代分组卡片（E1 6 / E2 6 / E3 8 / E4 8 / E5 10）、旧建筑显示升级目标与成本、未来时代/资源不足按钮禁用并给出原因 | PASS | artifacts/v12-m2-build.png；DOM 统计 cards=38、upgradeTargets=4、disabled=36 |
| 科技树：E1–E5 时代列，未来时代列显示「E2 文明曙光 解锁」锁定遮罩 | PASS | artifacts/v12-m3-tech.png |
| 天文台 Lv.0：同心圆等级阶梯；不显示无效升级，提示“先在建造面板建成观星台” | PASS | artifacts/uiv3-n4-observatory.png |
| 3D 空间视图：WebGL 挂载、三维标签、2D↔3D 切换不重置时间/选中；低等级不确定球已做视觉上限，避免遮挡 | PASS | artifacts/v12-m4-3d.png |
| 1280×720 无溢出，面板内滚动 | PASS | artifacts/v12-m5-1280.png（overflowX/Y=false） |
| 运行期异常 | 无 | QA 控制台 exception/failedRequest 均为空 |

## D. 已知非阻塞项

- 首次 3D 挂载在无 GPU 的软件渲染环境需 8–14 秒（真实 GPU 正常）；
- 原始时代 E1 食物略紧，需要尽快补建原始农田（设计意图：让玩家在原始时代就开始经营）；
- 存档版本升至 v2，v1 旧存档不兼容；
- AI 生图不可用，即梦无法自动调用；美术为原创程序化/SVG（详见 docs/ART_V2.md）。
---

# 附录：v1.3（科技树/随机事件/政治/工业画册 UI/即梦美术）验收记录

日期：2026-11-21  |  环境：Windows 11 / Node v26.13.1 / Vite 6 / TypeScript strict / Vitest 2 / Edge 158 + CDP

## A. 本轮新增

- **科技树 v3**：72 项科技 / 8 分支 / 6 学说 / 6 组互斥教义；长文说明、世界观引文、逐条效果；研究重心（同派 +15%、跨派 -5%）与学派精通；DAG 无环、旧 26 id 保留。
- **随机事件系统**：64 事件（8 类×8，E1–E5）/ 每事件 3 选项 / 每事件独立插图；189 条 followUp 链边；51 来源×153 条 CHAIN_INFLUENCE 上回合→下回合概率乘数；tag 修正向 1 衰减；事件触发暂停、抉择后恢复。
- **政治系统**：6 部门部长（可任免）/ 5 派系（每部长 1–2 派）/ 关系矩阵五档 / 任免·调解·峰会 / 政治资本 / 部门效率 0.7–1.3 / 稳定度 ±3（罢免 -4..-8、丑闻上限 -6）；派系满意度与影响力影响稳定度。
- **UI v1.3**：终末地工业画册风（白纸墨字、单一信号黄、直角/微圆角、圆形头像与翻页、胶囊分页、印刷装饰、左导航轨、非对称主舞台、加载页），政治/事件/科技大画册面板。
- **美术 v3**：即梦 AI 生成 12 张 1920×1080 hero（保留平台合规水印，用于菜单主视觉等）；64 张 1600×900 程序化事件插图；6 件印刷装饰；manifest 与可复现脚本。

## B. 自动化验收

| 项目 | 结果 |
| --- | --- |
| `tsc --noEmit` | 0 错误（strict，全仓） |
| 全量测试 | **15 文件 / 219 用例全部通过**（23.96s） |
| 科技树 `tests/systems/technology.test.ts` | 30 passed（数量/分支/DAG/文本/成本/教义/学派/canResearch/聚合/72 项全研究） |
| 政治 `tests/systems/politics.test.ts` | 30 passed（初始化/任免/罢免冲击/关系/调解/峰会/资本/回合/丑闻/seed 复现/数值有限） |
| 事件 `tests/systems/events.test.ts` | 27 passed（64 内容/插图/效果上限/概率修正/向 1 衰减/链延迟/冷却/重复/历史/90 回合） |
| 游戏集成 `tests/game` | 21 passed（含政治动作、事件暂停与结算、科技学派/教义视图、v2→v3 存档迁移、观测货币、时代升级） |
| 生产构建 | `vite build` 成功；index 777.5 kB / gzip 274.5 kB，3D chunk 549.9 kB / gzip 142.4 kB |

## C. 浏览器 QA（真实 Edge + CDP，最终版）

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 主菜单：白纸版面 + 即梦 hero 大图（水印保留）+ 版本 v1.3.0 | PASS | artifacts/menuhero-menu-hero.png |
| 游戏主界面：三栏 masthead 无重叠、中央深黑观测画布可见、右栏 8 页签、底部细线坞；1280×720 无页面溢出 | PASS | artifacts/v13final-final-game.png、artifacts/v13f2-final2-game-1280.png |
| 政治终端：六部门部长卡片/圆形头像/派系条/关系矩阵/政治资本/峰会按钮 | PASS | artifacts/v13f2-final2-politics-modal.png；右栏政治页 v13f2-final2-politics-tab.png |
| 科技树大画册：8 分支 × 5 时代矩阵、6 学派筛选与「设为重点」、互斥教义状态、长文抽屉 | PASS | artifacts/v13final-final-techbook.png、artifacts/ui-v13/b-b8-tech-drawer.png |
| 随机事件：自动弹出并暂停；插图（1600×900 加载成功）、长文/引文、3 选项含后果预览与风险；选择后 pending=0、history=1、弹窗关闭 | PASS | artifacts/artinspect2-art-inspect2.png（实测事件《学者请愿》，插图 naturalWidth=1600；选择后 history=1） |
| 运行期异常 | 无 | QA exceptions=0 / failedRequests=0 / console error=0；页面级 overflow=false |

## D. 已知非阻塞项

- 即梦 hero 图含平台「AI生成」与品牌水印（未替用户同意去水印条款）；UI 用版面裁切/角标处理，必要时用户可自行重导。
- 64 张事件插图为程序化「档案图版」几何线稿风（统一/可复现/零版权风险），精细度低于 AI 大图；可用 scripts/gen-event-art.py 重生成或手工替换同名文件。
- 存档版本 v3：v2 存档可自动迁移（补政治/事件状态），v1 存档不兼容。
- 科技树共 219 项数据量大，UI 以固定 5 时代列 + 横滚呈现；深层分支需横向滚动。
---

# 附录：v1.4 验收记录（启动 PV / 事件节奏 / UI 曲线+移动端 / 3D 近景贴图）

日期：2026-11-21  |  环境：Windows 11 / Node v26.13.1 / Vite 6 / TypeScript strict / Edge 158（headless SwiftShader + headed GPU）

## A. 自动化

| 项目 | 结果 |
| --- | --- |
| tsc --noEmit | 0 错误（strict，全仓） |
| 全量测试 | **15 文件 / 219 用例全部通过** |
| 生产构建 | vite build 通过（启动模块/3D 模块/贴图/启动资源均进入构建） |

## B. 浏览器验收

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 启动 PV：纯黑幕 + 270px 徽章 + 纪元存续理事会 + EPOCH CONTINUITY COUNCIL + 标语 + CTA + 准星环 | PASS | artifacts/startup-v14/su10-clean-black.png |
| 启动 PV：白纸档案 / 五步授权（步1 按钮、步2 Enter）/ 终幕 / Esc 跳过 | PASS | artifacts/startup-v14/su3-startup-archive.png、su3-startup-auth-step1.png、su-static-* |
| 首屏黑幕防白屏（index.html #tri-boot-veil） | PASS | index.html + 启动模块 mount 时移除 |
| 事件节奏 20–34 回合（首次 12–22） | PASS | src/events/system.ts；events 27 用例通过 |
| UI 曲线：时代进度弧/人口环/稳定度环/资源环/视口方位与置信弧/弧形分节标题 | PASS | artifacts/ui-v15/v15-desktop-1600-game.jpg、v15-desktop-1600-dossier.jpg |
| 移动端 390×844 / 平板 768×1024：底部导航/全屏抽屉/触摸按钮/无页面溢出 | PASS | artifacts/ui-v15/v15-mobile-390x844-*.jpg、v15-tablet-768x1024-*.jpg |
| 3D 点击恒星近景（纹理颗粒可见） | PASS | artifacts/g5-gpu4-star-a.png（headed GPU） |
| 3D 点击母星近景（海洋/陆地/云层/大气边缘光） | PASS | artifacts/g5-gpu4-planet.png（headed GPU） |
| 3D 返回全景 / 2D↔3D 切换不重置时间 | PASS | artifacts/3d-v14/v14-05-return-panorama-esc.jpg |
| 运行期异常 | 0 exception / 0 console error / 0 failed request | 各 QA 报告 |

## C. 已知非阻塞项

- 无头 SwiftShader 下 3D 近景贴图上传慢/画面异常；已用 headed GPU Edge 验证最终视觉，建议用户以硬件 GPU 浏览器为准。
- 启动 PV 默认每次会话播放一次；?startup=1（autostart 时）或 replayStartup 可强制重播。
- 移动端未在真机 iOS Safari 做长时回归。

---

# 附录：v1.4.1 手机横屏适配验收

日期：2026-11-22 | 环境：Windows 11 / Edge 158 / Node v26.13.1

| 项目 | 结果 |
| --- | --- |
| tsc --noEmit | 0 错误 |
| 全量测试 | 15 文件 / 219 用例通过 |
| vite build | 通过 |
| 844×390 横屏（菜单/新纪元/主游戏/档案/决策/政治/科技树/终端） | 通过，截图见 docs/MOBILE_LANDSCAPE.md |
| 667×375 横屏 | 通过 |
| 568×320 横屏 | 通过，HUD 自动精简 |
| 390×844 竖屏回归 | 通过，无变化 |
| 1280×720 桌面回归 | 通过，无变化 |
| 页面级横向溢出 | 无（667 科技树 pageScrollW=667） |
| 运行期异常 | 0 exception / 0 console error / 0 failed request |
