# v1.3 扩展规格（冻结契约）— 科技树 / 随机事件 / 政治 / 终端画册 UI

> 本文件是并行的冻结契约。lead 已扩展 `src/core/types.ts` 与 `src/game/viewTypes.ts`：`TechSchool`、`TechDef.descriptionLong/flavor/effectsDetail/school/exclusiveGroup`、`TechState.schoolFocus/doctrineChoices/schoolPoints`、`PoliticsState`、`EventState`、`PoliticsView/EventsView`、`GameActions` 的 7 个新动作。UI 渲染时以这些字段为准。
>
> **禁止修改**：`src/core/types.ts`、`src/game/viewTypes.ts`、`src/game/**`、`src/civilization/**`（lead 集成时会改）；如需新增字段，先 message lead。以下每个方向的写入范围互不重叠。

## 0. 总体规则

- 中文玩家文案；硬科幻、克制、有文采；不引用受版权保护文本。
- 所有随机必须由 seed/state 决定，可复现；不得使用 `Math.random()` 于模拟层（可用 seeded RNG）。
- 所有数值必须有限，禁止 NaN/Infinity 泄漏到 state；测试覆盖边界。
- 每项工作完成：`node .\node_modules\typescript\bin\tsc --noEmit` 0 错误；只跑相关测试；发送 lead 摘要。
- 不要 git/npm install；不要占用 5173；不要跑整仓 E2E；临时脚本放 artifacts/tmp 或删除。
- 内容质量优先：文本要能被玩家读出“世界观”，不能是占位符（禁止 TODO/lorem）。

## 1. 科技树 v3（owner: tech-architect）

### 1.1 结构

- 8 个分支（`TechBranch` 已含新值）：astronomy, energy, industry, biology, space, computing, society, military。
- 总科技数 **≥ 64**（建议 8×9），tier 1..5（tier=可研究时代）。
- 每分支内部按 tier 链式 + 跨分支前置（`requires`/`requiresAny`）形成 DAG，必须无环、每项从 E1 路径可达。
- 6 大学说 `TechSchool`：observation(观测派)/calculation(演算派)/industrial(工业派)/ecological(生态派)/expansion(扩张派)/authority(秩序派)。每项科技必须标注 school。
- **互斥教义**：≥6 组 `exclusiveGroup`，每组 2–3 项同 tier 科技（例：`doctrine_energy`：燃煤扩张 vs 核能集中 vs 太阳阵列；`doctrine_society`：技术官僚制 vs 军功秩序 vs 公社自治；`doctrine_stellar`：观测优先 vs 工业化 vs 逃亡主义；`doctrine_life`：基因改造 vs 生态共生；`doctrine_compute`：集中式超算 vs 分布式网络；`doctrine_defense`：要塞化 vs 机动防御）。选择后同组其他项永久不可研究。
- 学研究重心：`TechState.schoolFocus`；同派科技研究速度 +15%，跨派 -5%；精通等级由 `schoolPoints`（各派已研究科技 tier×cost 的归一化值）驱动，满精通给该派效果 +10%（在 aggregateTechEffects 体现）。
- `doctrineChoices[groupId]=techId` 由 `chooseDoctrine` 写入；`canResearch` 必须检查互斥、前置、era、existing；返回具体原因。
- 保留既有导出 API：`TECH_DEFS`、`TECH_BRANCHES`、`TECH_BRANCH_ORDER`、`techsByBranch`、`techDisplayName`、`TechBranchMeta`，以及 system 的 `createTechState/startResearch/advanceResearch/cancelResearch/canResearch/aggregateTechEffects/getTechMultipliers/activeResearchInfo`。可新增导出：`TECH_SCHOOLS`（6 派 metadata：id/name/short/description/color）、`doctrineGroups()`、`schoolMastery(state, school)`、`researchCostFor(state, tech)`。
- 保留旧 id（astro 六个、space 五个、energy/industry/biology 现有 id），仅可新增；天文台升级链要求保持不变。

### 1.2 文本与效果

- 每项科技：`description` 80–140 字（这是什么技术、为什么时代需要它）；`descriptionLong` 160–320 字（原理、工程细节、社会代价/风险）；`flavor` 一句世界观引文（可虚构学者/文件/口号，30–60 字）；`effectSummary` 一行数值摘要；`effectsDetail` 2–4 条逐条说明；`unlockNotes` 可选（解锁建筑/事件/观测等级）。
- 效果必须映射到已定义 `TechEffects`；新增政治/事件效果使用 `stabilityBonus/eventRiskMultiplier/politicalCapital/departmentBoost/researchSpeed`。数值幅度克制（总加成不得让经济爆炸）：单科技生产类 +3%–8%，关键节点 +10%–15%；观测/预测 +3%–8%；事件风险 -2%–8%。
- 成本随 tier：E1 25–60，E2 80–150，E3 240–400，E4 650–1000，E5 1400–2400；同 tier 跨分支 ±20%。
- `aggregateTechEffects` 必须聚合新增字段；`getTechMultipliers` 兼容旧字段。

### 1.3 交付

- 文件：`src/technology/tree.ts`、`src/technology/system.ts`（可新增 `src/technology/schools.ts`）、`tests/systems/technology.test.ts`、`docs/TECH_TREE.md`。
- 测试：≥20 用例（数量/分支/DAG 无环/每 tier 可达/旧 id 保留/互斥教义锁定/学派重心成本/精通效果/canResearch 原因/效果数值有限）。
- 浏览器 UI 由 ui-core 适配，你只需保证数据正确与文本完整。

## 2. 随机事件系统 v3（owner: events-architect）

### 2.1 结构

- 新模块 `src/events/definitions.ts`（内容）+ `src/events/system.ts`（逻辑）。
- `GameEventDef` 已定义；**≥ 60 个事件**，覆盖 8 类别、E1–E5，每事件 2–3 个选择（部分选择有条件 `requirements`），每条选择有 `outcome` 结果文案与 `effects`。
- 每事件必须有 `illustration: "events/<id>.jpg"`（由 art-agent 按 id 生成同名文件；你只定义路径）。文本：`short` 一行摘要 20–40 字；`body` 120–220 字叙事；`longBody` 可选 250–450 字；`flavor` 可选引文。
- **逻辑关联**（核心要求）：
  - `followUps`：选择结果可安排后续事件（`delayTurns` 1–4），形成 15+ 条事件链（如 饥荒→抢粮→政变、陨石→科研突破→建造竞赛、观测异常→疯狂科学家→教派兴起）。
  - `EventState.modifiers`：事件选择写入 tag 权重修正（如 "famine" → 1.8），每回合衰减 ×0.65；`selectEvent` 按事件 tags 相乘。
  - `EventState.lastEventIds` + 系统内置 `CHAIN_INFLUENCE: Record<eventId, Record<eventId, multiplier>>`（≥25 条），显式表达“上一回合事件提高/降低下一回合某事件概率”。
  - 冷却/重复：`cooldownTurns`、`repeatable`、`seenCounts`（同事件重复出现时权重衰减）。
- 概率：新事件出现间隔约 8–16 回合（可通过 difficulty/era 调整）；必须保证不连续刷屏（pending 最多 1 个，resolve 后才继续）。事件不应频繁直接灭国，单次效果上限：人口 ±8%、稳定度 ±12、资源 ±8%、政治资本 ±15。
- API（供 lead 在 game.ts 调用）：
  - `createEventState(seed: string): EventState`
  - `maybeTriggerEvent(state, ctx): PendingEventState | null`（ctx 含 civ/tech/politics/era/turn/year/difficulty/randomSeed）
  - `resolveEventChoice(state, choiceId, ctx): EventResolution`（修改 state.flags/modifiers/history/pending；返回 `effects` 供 lead 应用到 civ/politics，以及 logs/outcome）
  - `getActiveEvent(state): GameEventDef | null`、`eventModifiersView(state)`、`eligibleEvents(ctx)`（测试用）
  - 事件对资源/稳定/人口的修改本身也可由你直接应用到传入的 civ（更简单），但必须返回日志与结果；与 lead 约定：**你直接修改 civ/politics/tech 传入对象**，lead 只负责调用与写日志/暂停。
- 测试：≥15 用例（内容完整性 60+/插图路径/choices/effects 合法；requirements；概率受 modifiers 影响；衰减；followUp 延迟；冷却；重复衰减；历史；不产生 NaN；seed 可复现）。

### 2.2 交付

- `src/events/definitions.ts`、`src/events/system.ts`、`tests/systems/events.test.ts`、`docs/EVENTS.md`（全表 + 事件链图 + 概率机制说明）。

## 3. 政治系统 v3（owner: politics-architect）

### 3.1 结构

- 6 部门：administration(行政)/science(科研)/industry(工业)/agriculture(农业)/defense(防务)/observation(观测)。每部门一名部长，可空缺。
- 5 派系：technocrats(技术官僚)/militarists(军功集团)/agrarians(农业公社)/industrialists(工业联合会)/scholars(观星者学会)。每名部长属于 **1–2 个派系**（`factions: FactionId[]`）。
- 部长属性：competence 1–10、loyalty 0–100、integrity 0–100、ambition 0–100、age、traits（从 `MINISTER_TRAITS` 抽 2 个，带效果倾向）。候选人随机生成（seed 决定），每回合小幅刷新；每部门初始 1 名部长（6 名）。
- 关系：每对部长 -100..100；标签：≥60 亲密 / 25..59 友好 / -24..24 中立 / -59..-24 冷淡 / ≤-60 敌对。关系不由玩家直接看见数值之外还可通过事件变化；`mediateMinisters` 花费政治资本提升一对关系 8–15。
- 政治资本：开局 20–30，每回合 +2–6（受行政部长能力/稳定度影响）；任命消耗 8–15，罢免 12–20，调解 6–10，峰会 20–30。
- 部门增益/减益（由部长能力/派系/关系/特质决定）：
  - administration：政治资本收入、稳定度
  - science：科研速度
  - industry：工业产能/建造速度
  - agriculture：食物产出
  - defense：灾害抗性/人口损失减免
  - observation：观测效率/预测
  - 关系网络：友好部长对给对应部门 +2%–5% 协同；敌对给 -2%–5% 并每回合增加稳定度压力；派系满意度低（<30）时稳定度下降；影响力失衡（某派 >45）触发警告。
- 回合结算 `politicsTurn(state, civ, year, turn)`：
  - 刷新候选人（每 3 回合）、政治资本收入、关系自然回归、派系满意度趋近、丑闻/野心事件（低廉洁高野心有概率触发，产生 log 与稳定度惩罚）、计算 `PoliticsTurnEffects`：
    `{ stabilityDelta: number, researchMultiplier, industryMultiplier, agricultureMultiplier, observationMultiplier, defenseMultiplier, capitalGain, logs: {kind,message,severity}[] }`
  - 稳定度变化必须在 ±3/回合内（除非罢免/丑闻事件），不得直接造成死亡螺旋。
- 动作 API：`appointMinister(state, candidateId, year, turn)`、`dismissMinister(state, departmentId, year, turn)`、`mediateMinisters(state, a, b, turn)`、`holdSummit(state, turn)`，均返回 `{ok, reason, logs}`；罢免会降低该部长派系满意度、提升敌对派系满意度、产生稳定度即时冲击（-4..-8）。
- `createPoliticsState(seed)` 初始化 6 部门/6 部长/派系/关系/资本/历史。
- `ministerSummary(m)` 生成一句中文人物画像（供 view 使用）。
- `politicsStabilityImpact(state)` 供 UI 展示。

### 3.2 交付

- `src/politics/definitions.ts`、`src/politics/system.ts`、`src/politics/random.ts`（seeded RNG 可放此处）、`tests/systems/politics.test.ts`、`docs/POLITICS.md`。
- 测试：≥18 用例（初始化/候选人/任命/罢免/关系标签/调解/峰会/资本边界/部门修正范围/稳定度冲击上限/派系满意度/回合结算/日志/非法动作拒绝/seed 可复现/空部长容错）。

## 4. UI：终末地「工业画册」气质重构（owner: ui-core）

### 4.1 设计语言（来自用户提示词，必须遵守）

- **白纸、黑字、大图、一处黄**。以白为主：纸白 #F4F1EA / 纯白 #FFFFFF，墨黑 #111111，灰阶 #D9D9D9 / #8A8A8A；信号黄 #FDFD1F 只用于：当前导航项、一条色带、少数主按钮/强调。深色版块仅保留两处：中央观测视口（宇宙必须暗）与世界观/结局影像。
- 几乎全是直角：按钮/页签/卡片圆角 2–6px；圆形只用于头像、翻页钮；胶囊只用于分页条、导航器、切换器。
- 大量留白、大图大字、信息密度低（游戏内可分层：主舞台低密度，面板内适当密集，但用细线/留白分隔，不要霓虹发光堆叠）。
- 印刷语气装饰：45° 斜纹、点阵、注册色条（CMYK 小方块）、线稿、微标（`// TRISOLARIS`）、细发丝分隔线、方括号标题。
- 版块分隔优先用底色切换（白 → 黄带 → 黑 → 白），不要发光边框/玻璃拟态；阴影极轻（0 1px 2px rgba(0,0,0,.06)）。
- 导航：左侧通高白色导航轨（游戏内 ~72–84px），只放图标，悬停向右展开一窄条文字（浮层不推挤）；当前项墨色图标 + 浅灰底块 + 左缘墨色竖条；主行动为黑底白字（黄色只做 hover/当前位置）。顶部或主舞台放标准分节标题。
- 加载页：近黑底，贴左缘黄色进度条自上而下，大号百分比跟随；完成后黄色铺满再淡出（2.4s，尊重 reduced-motion）。
- 动效克制：印刷翻页/滑入/描边，不做霓虹呼吸灯。

### 4.2 游戏内布局（16:9）

- 桌面端：左导航轨 | 主舞台（上：巨型标题/年份/时代与资源读数；中：非对称大图观测视口 + 环绕刻度/瞄准线/图例；右：白色决策栏（恒星/环境/观测/预测/科技/政治/事件页签）；底：细线停靠坞/时间控制）。右侧栏和左侧面板用白纸卡片、发丝线、微标；观测视口为深色“印刷大图”，配黄色角标。
- 面板：建造/科技/政治/事件/观测/日志/存档等改为近白底 + 点阵浮层 + 深灰斜纹标题栏（标题居中白字），关闭钮 hover 转 90°；分页用浅灰胶囊叠斜纹 + 两端白色圆钮；页签浅灰底、激活左移并出现圆形箭头。
- 新增面板：**政治**（六部门卡片 + 部长头像圆环 + 派系条 + 关系矩阵 + 任免/调解/峰会按钮 + 政治资本）、**事件**（大插图 + 编辑式排版 + 2–3 选择按钮 + 后果预览 + 历史事件时间线）、**科技树**（8 分支 × 5 时代的大画册式矩阵，支持横纵滚动；学说筛选、教义选择、长文本详情抽屉）。
- 保留并重排现有全部功能（时代时间线、资源、建造升级、观测任务、预测、灾害、地图、设置、帮助、存档、结局）；不得出现死按钮；所有控件接真实 actions。
- 1280×720 / 1600×900 无页面溢出，滚动限制在面板内；字体用系统无衬线 + 等宽数字，标题可大（48–72px 巨型 `//` 标题截断于视口上缘）。
- 资产：优先 CSS/SVG 几何与排版；可引用 `public/print/**`（art-agent 产出：斜纹/点阵/注册色条/线稿角标/加载图）、`public/events/<id>.jpg`。

### 4.3 交付

- 只改 `src/ui/**`（styles.css 可整体重写；新增 `src/ui/theme-print.css`、`src/ui/politics.css`、`src/ui/events.css` 由入口 import）；不要改 src/game/**、src/core/**、public/**。
- 分两阶段：**阶段 A（先做）**：设计系统 + 导航轨 + 主舞台骨架 + HUD/资源/时代 + 中央观测视口外框 + 右侧页签 + 底部时间控制 + 菜单/新游戏/加载页 + 现有建造/科技/观测等模态换装。**阶段 B（lead 通知后）**：政治/事件面板与科技树大画册、长文本抽屉、事件弹窗。
- 自检：tsc 0 错误；真实浏览器截图（1600×900 与 1280×720）放 `artifacts/ui-v13/`；无 console error；现有 data-action 与流程不破坏。
- 交付 `docs/UI_PRINT.md`（设计 token、组件、截图、已知缺口）。

## 5. 美术资产 v3（owner: art-agent）

- 目标：为 ≥60 个随机事件各生成 1 张插图（`public/events/<id>.jpg`，16:9，建议 1280×720 或 1600×900），风格统一为“终端工业画册”：纸白/米白底 + 墨黑线稿/版画质感 + 极少量信号黄，几何装置感；避免血腥/侵权/文字水印。
- 另产出印刷装饰包 `public/print/`：`hatch-45.svg`（可平铺）、`dot-matrix.svg`、`registration-strip.svg`（CMYK 小块）、`line-art-corners.svg`、`loading-lineart.svg`、`grain.png`。
- **即梦 AI 尝试（用户明确要求）**：优先用 Microsoft Edge 打开即梦（已登录），通过已安装的电脑操作插件或 CDP 自动化生成。若电脑操作后端仍被安全软件拦截（`BACKEND_BLOCKED_BY_AV`/`SECURITY_BLOCK_CODE`），可用“复制 Edge 用户数据目录 + 以 `--remote-debugging-port=9222` 启动副本实例 + CDP 脚本”的方式尝试；若仍不可行，**不要反复硬试、不要关闭杀软**，记录失败原因并转入程序化生成（Python Pillow/SVG），并在 docs/ART_V3.md 说明需要用户如何手动补图。
- 程序化生成优先保证“每事件一张且风格统一”：Pillow 脚本按事件 id 做种子，从构图库（星图/废墟/议会/工厂/农田/实验室/飞船/文件/人群/异常）组合几何线稿 + 少量黄；可复用底纹但每张构图/标题不同。脚本放 `scripts/gen-event-art.mjs|py`（可入库，便于复现）。
- 读取 `src/events/definitions.ts` 的事件 id 列表生成文件；若事件 agent 尚未写完，先做装饰包与 8–12 张示例，收到 lead 通知后再补全。
- 交付：`docs/ART_V3.md`（清单/尺寸/来源/即梦尝试记录/授权说明），`public/art-manifest-v3.json`；不得改 src 或 UI。

## 6. Lead 集成（不交给子智能体）

- game.ts：research 学派动作、politicsTurn、event 触发/结算暂停与日志、TurnContext 注入政治修正、GameState 初始化/存档迁移（SAVE_VERSION 3）、view.ts 组装 PoliticsView/EventsView/新科技树、GameActions 实现。
- 全量 `tests/game`、新增集成测试、浏览器 E2E、构建、README/docs 更新、URL 可访问性。
