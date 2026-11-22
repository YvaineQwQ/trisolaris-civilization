# EVENTS_V6 — 范围结算 · 非阻塞抉择 · 编年史

> v1.6 事件层交付说明。共享文件（core/types、game/game、game/viewTypes、game/view、screen-game、civilization/**、technology/**、buildings/**、ui/styles.css、ui/theme-print.css、modal-research、design-v6.css、layout-v6.css）均未修改。

## 1. 交付文件

| 文件 | 内容 |
| --- | --- |
| `src/events/outcome-ranges.ts` | lead 提供：区间公式 / 历史修正 / 确定性 roll / 内容审计（本文件未改） |
| `src/events/chronicle.ts` | **新增**：从 GameState / EventsView 派生编年史条目、过滤、计数 |
| `src/ui/chronicle-panel.ts` | **新增**：编年史宽侧栏 `createChroniclePanel(shell)` |
| `src/ui/chronicle.css` | **新增**：侧栏 / 窄条 / 移动端底部抽屉样式 |
| `src/ui/event-drawer.ts` | **新增**：非阻塞事件抉择抽屉 `createEventDrawer(shell)` |
| `src/ui/event-report.css` | 追加 `.tri-event-drawer` 系列样式（原有 modal 样式不动） |
| `tests/systems/event-ranges.test.ts` | **新增**：21 个测试（区间/历史/确定性/审计/编年史/抽屉文本） |
| `docs/EVENTS_V6.md` | 本文档 |

旧 `src/ui/modal-event.ts` 保留为「完整档案」；新抽屉是默认事件入口，抽屉里通过「查看完整档案」调用 `openModal("event")`。

## 2. 范围结算公式（outcome-ranges）

### 2.1 基础区间

选择前只显示区间，不显示精确值。对选项 `effects`：

1. 先按 `system.forecastEventEffects` 计算中心 `delta`（即现有精确值）；
2. 由 `historyBandOptions(state, category, difficulty, era)` 得到倍率区间：
   - 基础宽度 `spread = 0.25`；
   - 最近 6 条同类事件：每条 `spread += 0.035`、`shift -= 0.035`（同类连续受击 → 区间变宽、倍率下移）；
   - 难度：hard `spread += 0.04`，nightmare `spread += 0.08`；
   - 时代 ≥ 4：`spread -= 0.02`（信息时代预测更收敛）；
   - `state.modifiers`：heat/famine/fear/drought 各 `shift -= 0.02`；hope/unity/harvest 各 `shift += 0.02`；
   - 夹取：`spread ∈ [0.12, 0.5]`、`shift ∈ [-0.18, 0.18]`，`low = 1 - spread + shift`，`high = 1 + spread + shift`。
3. 用 `low / high` 缩放整组效果后再跑一次 `forecastEventEffects`，逐项取三次 delta 的 min/max → `deltaMin / deltaMax`，并换算 `afterMin / afterMax`。
4. UI 文案约定：损失按「较小损失 ~ 较大损失」排列，如 `食物 −120 ~ −210 吨`、`稳定度 +1 ~ +4`（见 `event-drawer.ts` 的 `formatBandRange`）。

> 语义提醒：`historyShift` 的正负是「倍率更温和/更不利」；对正向效果即收益上/下移，对负向效果表现为损失幅度缩/放。若 docs/EVENTS.md 需要「酷热之后热浪损失更大」的方向性语义，需在 `forecastEffectBands` 中按 delta 符号反转 shift（当前 lead 模块未按符号拆分，接线时保持同一套实现即可，不要两套公式并存）。

### 2.2 实际结算与确定性

`rollEventEffects(effects, state, ctx)` 用 `mulberry32(hash(seed|turn|eventId|choiceId|nextHistoryId|triggeredTotal))` 生成 6 个 `[low, high]` 内的因子，对资源/稳定度/人口/科研/资本/灾害压力/部门关系分别缩放；flags / influence 原样保留。同一 seed + 同一操作序列必然复现。实际落地仍由 `system.applyEventEffects` 按硬上限夹取（人口 ±8%、稳定度 ±12、资本 ±15、资源 ±8% 容量、灾害压力 ±20、部门关系 ±25）。

**当前落地（lead 已接线）**：`system.resolveEventChoice` 在结算时先调用 `rollEventEffects(choice.effects, state, { category, turn, randomSeed, era, difficulty, eventId, choiceId })`，再走 `forecastEventEffects` 量化与 `applyEventEffects` 同一套硬上限夹取。因此：
- 选择前 UI 只显示区间（`forecastEffectBands`）；
- 选择后结算报告与编年史显示实际落地值（`pendingOutcome.effects` / `effectsSummary`）；
- 确定性种子包含 `randomSeed|turn|eventId|choiceId|nextHistoryId|triggeredTotal`，同 seed + 同操作序列可完全复现；
- `tests/systems/events.test.ts` 的「选择前量化预估与实际结算一致」已改为「实际值落在选择前区间内 + 同 seed 可复现」，不再断言精确中心值。

### 2.3 内容审计结论（64 事件 / 192 选项）

用 `auditEventLogic` + 独立脚本全量扫描，**硬错误 0**：

- 无 `eraMin > eraMax`、无越界硬上限（人口/稳定度/资本/资源/影响倍率全部合法）；
- 无悬空 `followUps`（全部指向真实事件，无自引用，delay 1–4）；
- 12 个 flag 全部「有产出、有引用」闭环：`archives_restored / dehydrated_cult_allowed / elevator_operational / emergency_powers / engine_project / flight_vote_passed / fusion_online / generation_ship_started / granary_audit / meteor_deflected / prophet_fed / star_anomaly_kept`；
- 40 个 influence tag 全部有 `TAG_LABELS` 中文标签。

**发现的可审模式（非错误，供内容确认）**：

1. 人口增 + 粮食减的「移民/休养」型选项：`soc_migrant_wave/admit`（+4% 人口，−160 食物）、`soc_migrant_wave/outside`（+2%，−100）、`ind_rail_line/settle`（+2%，−120）、`env_quiet_spring/rest`（+1.5%，−100）。四者都低于 `auditEventLogic` 的人口 5% 阈值，属有意 trade-off；若要统一，可把阈值下调到 2% 并全部标注 risk。
2. 风险文案与效果一致：无「只写风险无代价」选项；死亡/牺牲类文案均有对应 `populationPct`（如 `haz_quake/water` −2%、`haz_solar_flare/pray` −2%）。
3. **事件链跨时代可能静默断链**：71 条 followUp 的目标事件 `eraMin` 高于来源事件 `eraMin`（例：`env_red_dawn(1–5) → env_dust_storm(2–4)`、`env_long_night(1–5) → soc_underground_city(3–5)`、`sci_breakthrough_flux(2–4) → ind_fusion_test(5)`）。若来源事件在目标时代解锁前触发，`maybeTriggerEvent` 会因 `eventAvailable` 不通过而丢弃该排期。属可接受设计；若要求「链必成」，需给 followUp 增加 `requirements.minEra` 或把到期目标顺延到可出场回合。
4. 时代区间写死 1–5 的事件在 v1.6 六时代下不会进入 E6（内容待科技线补齐，不在本次范围）。

## 3. 历史 / flags / 难度对区间与概率的影响

- **同类事件**：近 6 条同类历史 → 区间变宽 + 倍率移动；近期重演同一事件 → 再放宽（`historyBandOptions`）。
- **flags / 世界状态**：`flags` 与 `modifiers` 参与 `historyBandOptions`；`modifiers` 中 heat/famine/fear/drought 使区间更不利，hope/unity/harvest 更温和。
- **难度 / 时代**：hard / nightmare 加宽并整体不利；E4+ 收敛；具体副作用由 `ctx.difficulty / ctx.era` 传入。
- **概率**：事件概率仍由 `system.ts` 的 `CHAIN_INFLUENCE + modifiers` 负责；`EventBandForecast` 的 `probabilityHints` 可展示选择对后续 tag 的概率方向（抽屉暂不展示，避免信息过载）。

## 4. 非阻塞事件 UI（event-drawer）

`createEventDrawer(shell: GameShell)` 返回：

```ts
interface EventDrawerHandle {
  el: HTMLElement;                 // .tri-event-drawer（无遮罩，默认隐藏，.is-open 显示）
  update(view: ViewModel): void;   // 事件出现/变化时刷新；新事件自动弹出
  open(): void; close(): void; visible(): boolean; destroy(): void;
}
```

- 选择卡片：`[data-evdraw-choice]`；提交按钮：`[data-evdraw-commit]`（调用 `api.actions.resolveEvent(choiceId)`）；完整档案：`[data-evdraw-archive]`（`shell.openModal("event")`）；稍后处理：`[data-evdraw-close]`。
- 效果只显示区间：优先读取 `choic.bands`（lead 在 events-view 用 `forecastEffectBands` 填充）；**若 view 尚无 bands 字段，则用现有 `effects[].delta` ±25% 兜底**（`fallbackBandsFromEffects`），不会显示精确值。
- 不暂停、不遮罩：抽屉自身不调用 `togglePause`，也不打开 modal；`screen-game.ts` 原有的「自动暂停 + 打开 modal-event」逻辑需 lead 改为只 `drawer.update(view)`。
- 移动端 ≤900px 自动变底部抽屉；桌面右侧停靠（top/bottom 避开 HUD 与 dock）。

## 5. 编年史（chronicle）

### 5.1 字段

```ts
interface ChronicleEntry {
  id: string;                 // event:3 / event-death:3 / hazard:7 / log:12 / population:2192
  year: number;               // 星历绝对年（灾害的「已模拟年数」会 +calendarStartYear）
  turn: number;
  kind: "event" | "death" | "major" | "disaster" | "science";
  title: string;
  detail: string;
  tone: "major" | "death" | "normal" | "science";  // 面板 data-tone
  icon: string;               // ui/icons.ts 图标名
  importance: 1 | 2 | 3 | 4 | 5;
  sourceId: string;
}
```

### 5.2 数据来源（只读真实数据，不编造）

| 来源 | 生成条目 |
| --- | --- |
| `state.events.pending[0]` / `view.events.active` | `event`：事件触发（importance 3） |
| `events.history` | `event` / `science`（science 类）/ `disaster`（hazard 类）；`effectsSummary` 中 `人口 -N` 再生成一条 `death`（event-death:id） |
| `civ.populationHistory` | 相邻样本跌幅 ≥2% → `death`（人口崩溃/骤降/下降，importance 3–5） |
| `hazards.history / activeHazards / crises` | `disaster`（重灾 importance ≥4 用 major 色条；活动危机标题带「危机持续」） |
| `log`（跳过 category=event） | 时代推进 → `major` importance 5；建筑/城邦损毁 → `major`；`人口损失 X%`/死亡关键词 → `death`；`科技突破：「X」` → `science`；critical 灾害日志（未被灾害历史覆盖时）→ `disaster` |
| `ending` 日志 | `major` importance 5（文明结局） |

过滤与工具：`filterChronicle(entries, { year, kinds, majorOnly, minImportance, query, limit })`、`chronicleKindCounts`、`chronicleYears`、`chronicleSignature`、`CHRONICLE_FILTER_PRESETS = { all, major, casualty }`；`deriveChronicleFromView(view)` 直接吃 `ViewModel`（不需要 GameState）。

### 5.3 面板

`createChroniclePanel(shell: GameShell)` → `{ el, update(view), toggle, open, close, isOpen, destroy }`：

- 根 `.tri-chronicle`，默认 `.is-open`（桌面展开 300–340px）；`.is-collapsed` 收成 44px 窄条；根上同时切换 `.is-open/.is-collapsed`，若父节点是 `.tri-game-main` 还会同步 `.has-chronicle` / `.is-chronicle-collapsed`（配合 layout-v6.css）。
- 内部：`.tri-chronicle-head`（CHRONICLE // 编年史 + 计数 + 收起/隐藏）、`.tri-chronicle-filters`（全部/重大/伤亡）、`.tri-chronicle-list`、`.tri-chronicle-item`（`data-tone`/`data-kind`，点击展开全文）。
- 最新在上；重大=红/金左条，伤亡=灰白，科学=墨绿，普通=墨黑；每条含年份/类别/重要度星标/标题/摘要/回合与来源。
- 移动端 ≤850px 变底部抽屉（默认只露 38px 把手）；`prefers-reduced-motion` 关闭动画。

## 6. lead 接线清单

1. **events-view.ts / viewTypes.ts**（lead 文件）
   - 给 `EventChoiceView` 增加可选 `bands?: EffectBand[]`；
   - 在 `activeEventView` 中：
     ```ts
     import { forecastEffectBands } from "../events/outcome-ranges";
     bands: forecastEffectBands(choice.effects, ctx, eventState, def.category, forecastEventEffects)
     ```
     （`ctx` 即现有 activeEventView 里构造的 EventContext；抽屉会自动优先使用它，缺省则 ±25% 兜底。）
2. **screen-game.ts**
   ```ts
   import { createChroniclePanel } from "./chronicle-panel";
   import { createEventDrawer } from "./event-drawer";
   const chronicle = createChroniclePanel(shell);
   const eventDrawer = createEventDrawer(shell);
   stage.appendChild(eventDrawer.el);            // 建议 stage 内、不放进 main 网格
   main.appendChild(chronicle.el);               // .tri-game-main 的直接子节点
   main.classList.add("has-chronicle");          // layout-v6.css 三栏布局
   // updateAll(view) 内：
   chronicle.update(view); eventDrawer.update(view);
   // destroy() 内：chronicle.destroy(); eventDrawer.destroy();
   ```
   - 把 `syncPendingEvent` 的「自动 pause + `modals?.open("event")`」改为只更新 drawer（不暂停、不弹 modal）；`suppress auto-pause` 后玩家仍能看 HUD/中央观测。若保留暂停，也建议不再自动打开 modal。
   - 键盘：可在 `onKey` 里加 `Escape` 关闭 drawer（drawer 自身也处理）。
3. **game.ts（无需改动）**
   - 范围结算已在 `system.resolveEventChoice` 内完成（见 §2.2），`game.resolveEvent` 无需修改；
   - 若后续想回退为精确结算，只需移除 system 内的 `rollEventEffects` 调用，并把 `events.test.ts` 的区间断言改回精确断言。
4. **CSS 加载**：`chronicle-panel.ts` 自动 `import "./chronicle.css"`；`event-drawer.ts` 自动 `import "./event-report.css"`（已追加抽屉样式）。无需改 app.ts。
5. **旧 modal-event**：保留；`syncPendingEvent` 不再自动打开即可。右侧 events 页签与「打开事件档案」按钮继续可用。

## 7. 测试

命令：

```bash
node .\node_modules\typescript\bin\tsc --noEmit
node .\node_modules\vitest\vitest.mjs run tests/systems/event-ranges.test.ts
```

`tests/systems/events.test.ts`（31 个，已按 v1.6 范围结算更新）：内容完整性 / 概率修正 / 事件链 / 长期运行 / 区间覆盖实际结算且同 seed 可复现 / 30 秒延迟报告。

`tests/systems/event-ranges.test.ts`（21 个）覆盖：`historyBandOptions` 宽度/夹取/同类事件/heat-hope 修正；`forecastEffectBands` 上下界与 before/after 一致；`rollEventEffects` 可复现、随回合变化、倍率落在区间内；`auditEventLogic` 对真实事件库无时代倒置/悬空链，对合成坏数据能发现时代倒置、悬空 followUp、人口+粮食谬误、风险收益倒挂；编年史对事件/抉择/后果、死亡/人口骤降、时代推进/重灾/危机/科技、过滤排序、空输入与否定死亡句、ViewModel 派生；抽屉区间文本（`−120 ~ −210 吨`、±25% 兜底、优先使用 bands）。
