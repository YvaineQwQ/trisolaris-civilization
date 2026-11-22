# 时代进化系统 · 内容与机制规格（阶段 12）

> 本规格是冻结契约。lead 已在 `src/civilization/eras.ts`、`src/core/types.ts`、`src/core/constants.ts`、`src/game/viewTypes.ts` 建立接口与时代定义，systems-dev 负责实现内容与机制，不得破坏这些接口语义。

## 1. 目标

文明必须从**原始部落（E1，无电力、无金属）**一步步发展：
E1 仰望星空（原始）→ E2 文明曙光（农业城邦）→ E3 混沌时代（蒸汽/电力）→ E4 预测未来（信息/航天）→ E5 文明的选择（星际）。
每个时代有独立建筑、科技与资源可用性；旧时代建筑需要逐级**升级**才能进入新时代层级，否则产出衰减。

## 2. 已冻结的接口（lead 已实现，systems 需调用/配合）

- `src/core/constants.ts`：`ERA_MAX=5`、`ERAS: EraDef[]`（含 requirements/unlockSummary/subtitle）、`RESOURCE_UNLOCK_ERA`（food/water/minerals/science=1，metals=2，energy=3）、`OBSERVATORY_LEVELS[].requiresEra`（Lv1=1,Lv2=2,Lv3=3,Lv4=4,Lv5/6=5）。
- `src/civilization/eras.ts`：`eraStatus(civ, techState, buildingState, observatoryLevel)`、`canAdvanceEra(...)`、`applyEraAdvance(civ)`、`resourceUnlocked(era,id)`、`buildingEra(def)`、`isBuildingAvailableInEra(era,def)`、`outdatedMultiplier(era,def)`、`techsInEra(techState,era)`。**不要重写该文件**（可提议修改，联系 lead）。
- `src/game/game.ts`：每回合自动检查 `canAdvanceEra` 并推进；未解锁资源会被归零；观测任务在 era<3 时以食物支付、era>=3 以能源支付；`upgradeBuilding(id)` 调用 `buildings/system.startUpgrade`；建成 observatory 建筑后自动把 obs.level 同步到 1。
- `src/buildings/system.ts`：lead 已加 `startUpgrade(sourceDef,targetDef)`、升级工程完工时旧建筑 -1/新建筑 +1、取消升级返还 `upgradePaid` 的 50%。
- `src/core/types.ts`：`BuildingDef` 已加 `era/tier/upgradeGroup/upgradeTo/upgradeCost/upgradeTurns/outdatedMultiplier`；`ConstructionJob` 已加 `upgradeFrom/upgradePaid`。

## 3. 资源规则

- E1：仅 food / water / minerals / science。无 metals、无 energy。所有 E1 建筑成本/维护不得出现 metals/energy。
- E2：解锁 metals（青铜/铁），仍无 electricity（energy 仍锁；水车/畜力以“动力”为名也**不要**使用 energy 资源，避免破例）。
- E3：解锁 energy（电力）。燃煤电站/电网等只从 E3 开始。
- E4/E5：全部资源可用。
- 经济层已在 `resolveTurn` 中按 `ctx.era` 将 energy/metals 生产与需求置零；game 层会传入 era。仍需你保证内容层没有违规成本/维护，避免出现“需求为 0 但建筑维护要求 energy”的矛盾。

## 4. 建筑内容要求

- 总量 **32–38 座**，每时代至少 5 座可新建；主升级链（建议）：
  1. housing：聚落营地(E1) → 城邦住宅(E2) → 住宅区(E3) → 高层居住区(E4) → 生态穹顶城市(E5)
  2. food：原始农田(E1) → 灌溉农田(E2) → 机械化农场(E3) → 垂直农场(E4) → 人造生物圈农场(E5)
  3. water：水井(E1) → 水渠/蓄水池(E2) → 水处理厂(E3) → 循环水厂(E4) → 大气水循环阵列(E5)
  4. industry（矿物/金属）：采石场(E1) → 矿场(E2) → 钢矿联合体(E3) → 自动化矿山(E4) → 纳米制造厂(E5)；合金链：冶坊(E2) → 钢铁厂(E3) → 合金厂(E4) 可作为独立链
  5. research：长者议事棚(E1) → 学园(E2) → 科学院(E3) → 超算中心(E4) → 量子实验室(E5)
  6. energy：燃煤电站(E3) → 核电站(E4) → 聚变反应堆(E5)
  7. 防御：地下避难所(E3) → 气候调节设施(E4)
  8. 航天/高级：卫星站(E4) → 太空港(E5) → 星际殖民基地(E5) → 行星发动机(E5)、深空雷达(E5)
  9. 仓储：地窖(E1) → 粮仓(E2) → 仓库(E3)（可再做 E4/E5，但非必须）
  10. observatory：唯一建筑，E1 可建（提供 Lv1）；Lv2..6 走观测升级（`OBSERVATORY_LEVELS.requiresEra` 已定义）。
- 每个建筑必须定义：era、tier、upgradeGroup、upgradeTo（链末端 null）、upgradeCost、upgradeTurns、cost/maintenance（只用该时代已解锁资源）、workers、requiresTech（可为空）、effects、maxCount/unique。
- 数值建议（可平衡微调，但需保证开局可玩）：
  - E1 人口 500：营地住房 180–250；原始农田 food 70–110/回合，workers 20–30；水井 water 80–120；采石场 minerals 30–50；长者议事棚 research 4–8；观星台唯一，minerals 80–140，workers 10–20。
  - E2 人口 ~900–1800：food 260–360、water 260–360、metals 60–100、research 12–20，建筑 workers 40–90。
  - E3：energy 450–700、food 600–900、metals 220–320、research 28–40。
  - E4：energy 1400–2000、food 1200–1700、metals 500–700、research 70–100。
  - E5：energy 4000–5600、food 2600–3600、metals 1200–1800、research 200–300。
  - 建筑成本随时代增长 ~2–2.5 倍/代；升级成本约为目标建筑新建成本的 55–75%（可另加 10–20% 科研点）。
- 旧时代折减：`aggregateBuildingEffects(state, defs, era?)` 增加可选 era 参数，内部对每座建筑产出乘 `outdatedMultiplier(era, def)`（住房/仓储/稳定度等非产出效果也可同乘或保持，需在 docs 说明）。game 层会改为传入 `civ.era`（由 lead 集成；你先实现函数签名向后兼容）。
- 保持 `STARTING_BUILDINGS` 与 `createInitialBuildingState()` 单一来源；初始建筑改为原始聚落（例如 camp×1、farm1×2、well1×1、quarry1×1），**不要**包含 observatory/energy 建筑。
- `createCivilizationState`：初始人口 500（nightmare 400），初始资源按难度：food 700–1000、water 400–600、minerals 100–160、metals 0、energy 0、science 0–20；住房/工业基础值相应调低（如 BASE_HOUSING=200、BASE_INDUSTRY=10），保证第一回合不崩且食物为正。difficulty preset 的 startingFood/startingEnergy/startingScience 可改（energy 对 E1 无意义，置 0 或保留不影响）。
- 平衡底线：**空操作 60 年**在 easy/normal 至少 3/4 种子不崩（可先跑 lead 的 playability 流程）；自动玩家应能在 ~150 年内达到 E3/E4（不强制，但需可推进）。

## 5. 科技内容要求

- 保持 26 项、5 方向、`tier = 时代`（1..5）。**保留以下 id**（外部依赖）：astronomy 链 6 个：astro_basic, astro_distance, astro_orbit, astro_threebody, astro_chaos, astro_supernet；space 链 5 个：space_basic, space_orbital, space_colony, space_deep, space_engine；energy/industry/biology 现有 id 可保留。
- 名称/描述/效果改为时代递进语义（E1 火种与星象、E2 灌溉与青铜、E3 蒸汽/电力、E4 计算机/核能、E5 聚变/星际）。天文台升级链保持不变：Lv2 需 astro_basic、Lv3 astro_distance、Lv4 astro_orbit、Lv5 astro_threebody、Lv6 astro_supernet（astro_chaos 作为超网前置）。
- 成本：E1 20–45，E2 70–130，E3 200–350，E4 600–950，E5 1300–2200 科研点。
- `technology/system.canResearch` 增加时代门槛：`tech.tier > civ.era` 时返回 `{ok:false, reason:"需要第 X 时代"}`（需要新签名或从 techState 无法得知 era —— 建议新增 `canResearch(techId, techState, era?)`，默认 era=5 向后兼容；game/view 调用处 lead 会传 era）。
- 建筑 requiresTech 只能引用同时代或更早科技；确保 E1 观星台无需科技、E2 关键建筑有可达科技链。

## 6. 交付与验收

- 修改范围：`src/buildings/**`、`src/technology/**`、`src/economy/economy.ts`（时代经济、时代推进报告可保留 legacy）、`src/civilization/state.ts`、`src/civilization/resources.ts`、`tests/systems/**`、`docs/ERA_CONTENT.md`；必要时可改 `src/core/constants.ts` 的 DIFFICULTIES 起始值与 OBSERVATORY_LEVELS 成本（不要改 ERAS/RESOURCE_UNLOCK_ERA/ERA_MAX）。
- **不要修改** `src/game/**`、`src/civilization/eras.ts`、`src/ui/**`、`src/core/types.ts`（需扩展请先 message lead）。
- 测试：
  - 更新 `tests/systems/*` 适配新内容/时代；新增：E1 无电力/金属建筑与成本、升级管线（资源扣除→旧-1/新+1）、跨时代产出折减、可研究科技的时代门槛、初始文明为原始时代且资源正确、时代解锁后资源可用。
  - `npx vitest run tests/systems` 全绿，`npx tsc --noEmit` 0 错误。
- 输出 `docs/ERA_CONTENT.md`：建筑/科技全表（id/时代/成本/效果/升级链/前置）、经济数值说明、平衡基准、与旧内容的差异。
- 完成后 send_message 给 lead：API 变更点、内容统计、测试结果、平衡实测（空操作 60 年/自动玩家）。
