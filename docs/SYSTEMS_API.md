# SYSTEMS API — 文明 / 经济 / 建筑 / 科技

> 写入范围：`src/civilization/**`、`src/economy/**`、`src/buildings/**`、`src/technology/**`、`tests/systems/**`
> 所有导出集中在各目录 `index.ts`；本文件是 game 层集成的唯一权威说明。
> 类型全部来自 `src/core/types.ts`（lead 维护），本模块不修改核心类型。

---

## 0. 目录与依赖

```
src/civilization/
  resources.ts   六种资源定义 / 基础库存容量 / 资源读取辅助
  state.ts       createCivilizationState + 资源扣除/增加/简述
  stability.ts   稳定度六因子模型 + 中文标签
  index.ts
src/buildings/
  definitions.ts 25 座建筑定义 + BUILDING_DEFS / getBuildingDef / 分类 / 唯一性
  system.ts      建造检查 / 开工 / 工期推进 / 效果聚合 / 维护与工人统计
  index.ts
src/technology/
  tree.ts        26 项科技（5 方向 × 5 级 + 天文学 6 项）
  system.ts      研究前置 / 选定 / 每回合推进 / 效果与乘数
  index.ts
src/economy/
  economy.ts     resolveTurn 回合结算 + 时代 + 殖民地 + 胜负判定
  index.ts
tests/systems/
  helpers.ts     测试夹具（createWorld / runTurn 等，不属于运行时依赖）
  buildings.test.ts  technology.test.ts  economy.test.ts
```

依赖方向（无循环）：`civilization ← buildings/technology ← economy ← game`。

---

## 1. 资源（`src/civilization/resources.ts`）

### 1.1 定义与常量

| 资源 id | 名称 | 短名 | 单位 | 颜色 | 基础库存上限 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| `food` | 食物 | 食 | 吨 | `#8fd16a` | 4000 | 维持人口生存的农产品与合成口粮。短缺会直接引发饥荒与人口损失。 |
| `water` | 水 | 水 | 吨 | `#5cc8ff` | 3000 | 可直接利用的液态水。极端高温或严寒会降低取水效率。 |
| `energy` | 能源 | 能 | MWh | `#ffd166` | 2500 | 电力与工业动力。温度越极端，供暖/制冷需求越高。 |
| `minerals` | 矿物 | 矿 | 吨 | `#c9a06b` | 2500 | 矿石与基础原料，由矿场开采。 |
| `metals` | 金属 | 金 | 吨 | `#aeb8c4` | 1800 | 精炼金属与合金，由冶炼厂生产。 |
| `science` | 科研点 | 科 | 点 | `#b48cff` | 20000 | 可跨回合囤积的“科研货币”，用于研究与天文台升级。 |

```ts
export const RESOURCE_IDS: readonly ResourceId[];            // 固定展示顺序
export const RESOURCE_DEFS: Record<ResourceId, ResourceDef>;
export const BASE_RESOURCE_CAPACITY: Record<ResourceId, number>;
export const BASE_RESOURCE_STOCK: Record<ResourceId, number>; // water 600 / minerals 800 / metals 400，其余 0
export const CRITICAL_STOCK_RATIO = 0.12;                    // 低于该比例视为告急（UI 高亮）

export function isResourceId(value: string): value is ResourceId;
export function getResourceDef(id: ResourceId): ResourceDef;
export function resourceName(id: string): string;            // 中文名，未知 id 原样返回
export function resourceUnit(id: string): string;
export function resourceColor(id: string): string;
export function createResourceStocks(opts: ResourceInitOptions): Record<ResourceId, ResourceStock>;
export function computeCapacity(id: ResourceId, bonus = 0): number; // 基础容量 + 建筑加成
export function stockRatio(stock: ResourceStock): number;
export function isResourceCritical(stock: ResourceStock): boolean;
export function criticalResources(resources: Record<ResourceId, ResourceStock>): ResourceId[];
export function amountText(value: number): string;           // 1.2k / 3.4M 缩写
export function formatResourceAmount(id: ResourceId, value: number): string; // "1.2k 吨"
```

> 库存上限 = `BASE_RESOURCE_CAPACITY` + 建筑 `effects.capacity` 之和；`resolveTurn` 每回合自动写回 `stock.capacity`。

---

## 2. 文明初始状态（`src/civilization/state.ts`）

```ts
export interface CreateCivilizationOptions {
  difficulty: DifficultyKey;
  mode: GameMode;
  seed: string;
  startYear?: number;   // 可选，人口历史起始年份，默认 0
  startTempC?: number;  // 可选，人口历史起始温度，默认 16
}
export function createCivilizationState(opts: CreateCivilizationOptions): CivilizationState;
```

### 2.1 初始值

| 项目 | 数值 | 来源 |
| --- | --- | --- |
| 人口 | 1000（nightmare 800） | 本模块 |
| 食物 / 能源 / 科研 | `DIFFICULTIES[difficulty].startingFood / startingEnergy / startingScience` | `core/constants` |
| 水 / 矿物 / 金属 | 600 / 800 / 400 | `BASE_RESOURCE_STOCK` |
| 住房 | 400（基础庇护所，另有初始建筑 +1600） | `BASE_HOUSING` |
| 稳定度 | 65（六因子同值 65） | `START_STABILITY` |
| 时代 | 1「仰望星空」 | `START_ERA` |
| 工业产能 | 25（基础工坊） | `BASE_INDUSTRY` |
| 劳动力 | `floor(pop × 0.55)` = 550 | `WORKFORCE_RATIO` |
| 就业 | 初始 jobs = workforce（第一回合后由建筑工人数 + 服务业重算） | 本模块 |
| 人口历史 | 1 个采样点 `{ year, population, stability, tempC }` | 本模块 |
| 殖民地 / 胜利 / 解锁 | `null / false / 全部 false` | 本模块 |

### 2.2 辅助函数

```ts
export const BASE_POPULATION = 1000, NIGHTMARE_POPULATION = 800;
export const START_STABILITY = 65, WORKFORCE_RATIO = 0.55;
export const BASE_HOUSING = 400, BASE_INDUSTRY = 25, START_ERA = 1;
export const MAX_POPULATION_HISTORY = 600, DEFAULT_COMFORT_TEMP_C = 16;

export function workforceFor(population: number): number;
export function resourceStock(civ, id): ResourceStock;               // 容错补字段
export function canAfford(civ, cost): { ok: boolean; missing: ResourceId[] };
export function spendResources(civ, cost): boolean;                 // 先 canAfford，再按库存上限扣
export function gainResource(civ, id, amount): number;              // 返回实际增加量
export function clampResource(civ, id, amount): number;
export function setFlow(civ, id, produced, consumed): void;
export function resourceAmount(civ, id): number;
export function emptyResources(): Record<ResourceId, ResourceFlow>;
export function uniformStability(value: number): StabilityFactors;
export function civilizationSummary(civ): string;                   // 中文日志简述
```

> “农业 + 居住 + 基础观测”的起步生产能力由 `buildings.createInitialBuildingState()` 提供
> （农田 ×2 / 居住区 ×2 / 水厂 / 发电站 / 仓库 / 天文台 ×1）。即使不传初始建筑，
> 人口自给（见 §7.2）也会让文明在第一回合不至于直接饿死，但会在十余回合内陷入饥荒。

---

## 3. 稳定度（`src/civilization/stability.ts`）

稳定度 = 六因子（0..100）加权平均（0..100）：
食物 22%、饮水 15%、住房 13%、温度 17%、健康 16%、秩序 17%。

```ts
export type StabilityFactorKey = keyof StabilityFactors; // "food"|"water"|"housing"|"temperature"|"health"|"order"
export const STABILITY_FACTOR_KEYS: readonly StabilityFactorKey[];
export const STABILITY_FACTOR_LABELS: Record<StabilityFactorKey, string>; // 食物保障/饮水供应/...
export const STABILITY_WEIGHTS: Record<StabilityFactorKey, number>;
export const COMFORT_TEMP_C = 16;

export interface StabilityInput {
  foodSatisfaction: number;      // 0..1
  foodCoverageTurns: number;     // 当前食物库存可支撑回合数
  waterSatisfaction: number;
  waterCoverageTurns: number;
  housingRatio: number;          // 住房/人口
  tempStressC: number;           // 超出舒适区的温差
  habitability: number;          // 0..1（已乘科技宜居度倍率）
  unemployment: number;          // 0..1
  starvation: number;            // 0..100
  buildingStability: number;     // buildingEffects.stability
  crisisPenalty: number;
  disasterShock: number;         // 0..1（已计算抗性）
  extraStability?: number;
}
export function computeStabilityFactors(input: StabilityInput): StabilityFactors;
export function combineStability(factors: StabilityFactors): number;
export function stabilityDisplay(stability: number): { label: string; tone: "good"|"ok"|"warn"|"bad" };
export function weakestFactor(factors: StabilityFactors): { key: StabilityFactorKey; value: number };
```

`stabilityDisplay` 分档：≥80 安定 / ≥60 平稳 / ≥42 紧张 / ≥25 动荡 / 其余 濒临崩溃。

---

## 4. 建筑（`src/buildings/`）

### 4.1 定义与索引

```ts
export interface BuildingDefEx extends BuildingDef { unique?: boolean }
export const BUILDING_DEFS: BuildingDefEx[];                    // 25 座，顺序即 UI 顺序
export const BUILDING_DEF_MAP: Record<string, BuildingDefEx>;
export const STARTING_BUILDINGS: Readonly<Record<string, number>>;
export const BUILDING_CATEGORY_ORDER: readonly BuildingCategory[];
export const BUILDING_CATEGORY_NAMES: Record<BuildingCategory, string>; // 基础/工业/科研/高级

export function getBuildingDef(id: string): BuildingDefEx | undefined;
export function buildingDefsByCategory(category): BuildingDefEx[];
export function buildingName(id: string): string;
export function isUniqueBuilding(id: string): boolean;
export function buildingMaxCount(id: string): number | null;
```

### 4.2 建筑数值表（25 座）

| id | 名称 | 分类 | 成本 | 工期(回合) | 工人 | 前置 | 每回合维护 | 效果 | 上限 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `housing` | 居住区 | basic | 矿物 220 / 金属 60 / 能源 60 | 4 | 0 | 时代 1 | 能源 8 | 住房 +800；稳定度 +1.0 | 20 |
| `farm` | 农业区 | basic | 矿物 180 / 金属 40 / 能源 80 | 3 | 90 | 时代 1 | 能源 18 | 每回合 +300 食物 | 20 |
| `waterworks` | 水处理厂 | basic | 矿物 200 / 金属 60 / 能源 100 | 3 | 70 | 时代 1 | 能源 30 | 每回合 +480 水 | 12 |
| `powerPlant` | 发电站 | basic | 矿物 260 / 金属 120 | 4 | 80 | 时代 1 | 矿物 10 | 每回合 +320 能源 | 16 |
| `warehouse` | 仓库 | basic | 矿物 160 / 金属 40 | 3 | 20 | 时代 1 | 能源 6 | 仓储 +2500 食物 / +2000 水 / +1500 能源 / +2000 矿物 / +1500 金属 / +30000 科研点 | 8 |
| `school` | 学校 | basic | 矿物 250 / 金属 60 / 能源 120 | 4 | 55 | 时代 1 | 能源 12 | 科研 +10/回合；稳定度 +1.0 | 8 |
| `medicalCenter` | 医疗中心 | basic | 矿物 320 / 金属 120 / 能源 160 | 5 | 65 | bio_basic · 时代 2 | 能源 25 | 稳定度 +5.0；灾害抗性 +5% | 6 |
| `mine` | 矿场 | industry | 矿物 240 / 金属 90 / 能源 120 | 4 | 130 | 时代 1 | 能源 45 | 每回合 +280 矿物 | 10 |
| `smelter` | 冶炼厂 | industry | 矿物 320 / 金属 140 / 能源 180 | 5 | 120 | industry_basic · 时代 2 | 能源 70 / 矿物 240 | 每回合 +160 金属（矿物为输入） | 8 |
| `industrialZone` | 工业园区 | industry | 矿物 600 / 金属 260 / 能源 300 | 6 | 200 | industry_automation · 时代 2 | 能源 90 / 矿物 30 | 矿物 +60；金属 +40；工业 +50；稳定度 −1 | 6 |
| `machineFactory` | 机械制造厂 | industry | 矿物 520 / 金属 220 / 能源 260 | 6 | 190 | industry_alloys · 时代 3 | 能源 100 / 矿物 60 | 金属 +80；工业 +70 | 6 |
| `observatory` | 天文台 | science | 矿物 300 / 金属 120 / 能源 150 | 5 | 45 | 时代 1 | 能源 15 | 科研 +8/回合；观测质量 +8%；observationLevel=1 | **1（唯一）** |
| `academy` | 科学院 | science | 矿物 380 / 金属 140 / 能源 200 | 5 | 100 | 时代 2 | 能源 35 | 科研 +22/回合；稳定度 +2 | 6 |
| `supercomputer` | 超级计算中心 | science | 矿物 900 / 金属 500 / 能源 800 | 7 | 130 | industry_automation + energy_grid · 时代 3 | 能源 130 | 科研 +55/回合；观测质量 +5% | 4 |
| `orbitInstitute` | 轨道研究所 | science | 矿物 1400 / 金属 800 / 能源 1200 | 8 | 150 | astro_orbit · 时代 3 | 能源 150 | 科研 +70/回合；观测质量 +15% | 2 |
| `shelter` | 地下避难所 | advanced | 矿物 700 / 金属 400 / 能源 500 | 7 | 40 | industry_alloys · 时代 3 | 能源 25 | 住房 +400；温度耐受 +5°C；灾害抗性 +20%；稳定度 +2 | 6 |
| `climateControl` | 气候调节设施 | advanced | 矿物 1200 / 金属 700 / 能源 1500 | 8 | 120 | energy_solar · 时代 3 | 能源 200 / 矿物 20 | 温度耐受 +12°C；稳定度 +6 | 4 |
| `spaceport` | 太空港 | advanced | 矿物 2200 / 金属 1200 / 能源 1800 | 9 | 180 | space_orbital · 时代 4 | 能源 160 / 金属 15 | 工业 +40；殖民进度 +20/回合；稳定度 +1 | 2 |
| `colonyBase` | 星际殖民基地 | advanced | 矿物 3000 / 金属 1800 / 能源 2400 | 10 | 220 | space_colony · 时代 4 | 能源 140 / 金属 20 | 殖民进度 +45/回合 | **1（唯一）** |
| `orbitalSolar` | 轨道太阳能阵列 | advanced | 矿物 700 / 金属 350 | 6 | 40 | energy_solar · 时代 3 | 矿物 18 | 每回合 +650 能源 | 12 |
| `fusionReactor` | 聚变反应堆 | advanced | 矿物 2400 / 金属 1400 / 能源 1600 | 10 | 160 | energy_fusion · 时代 4 | 矿物 25 | 每回合 +1400 能源 | 6 |
| `deepSpaceArray` | 深空雷达阵列 | advanced | 矿物 1800 / 金属 1000 / 能源 1600 | 8 | 130 | astro_chaos · 时代 4 | 能源 140 | 科研 +30/回合；观测质量 +40%；预警 +2 回合 | 3 |
| `biodome` | 生态穹顶 | advanced | 矿物 1300 / 金属 700 / 能源 900 | 8 | 150 | bio_ecology · 时代 3 | 能源 120 | 食物 +750；稳定度 +4 | 6 |
| `quantumLab` | 量子计算中心 | advanced | 矿物 3200 / 金属 2000 / 能源 2600 | 11 | 160 | industry_quantum · 时代 5 | 能源 260 / 矿物 20 | 科研 +130/回合 | 2 |
| `planetEngine` | 行星发动机 | advanced | 矿物 12000 / 金属 8000 / 能源 10000 | 16 | 500 | space_engine · 时代 5 | 能源 600 / 金属 60 | 工业 +150；殖民进度 +60/回合；稳定度 −10；灾害抗性 +10% | **1（唯一）** |

> `observatory` 只能建造 1 次（1 级）；2~6 级通过 `observation` 模块的升级流程
> （`OBSERVATORY_LEVELS[n].requiresTech` 即 §5 中 astro 链）完成，不能再建第二座。

### 4.3 系统 API（`src/buildings/system.ts`）

```ts
export type BuildingDefSource = readonly BuildingDef[] | Record<string, BuildingDef>;

export function createBuildingState(initial?: Record<string, number>): BuildingState;
export function createInitialBuildingState(): BuildingState;   // 开局 8 座建筑

export interface BuildCheck { ok: boolean; reason: string | null }
export function checkBuild(
  buildingId: string,
  civ: CivilizationState,
  buildingState: BuildingState,
  techState: TechState,
  techEffects: TechEffects,
  mode: GameMode,
): BuildCheck;
// 检查顺序：未知建筑 → 数量/唯一性 → 时代 → 前置科技（+殖民/发动机能力标记）→ 资源
// sandbox 模式跳过时代/科技门槛，资源与数量上限仍生效。

export interface StartConstructionResult { ok: boolean; reason: string | null; jobId: number | null }
export function startConstruction(
  buildingState: BuildingState, civ: CivilizationState, def: BuildingDef, year: number,
): StartConstructionResult;
// 扣除 cost，写入 queue（turnsLeft = buildTurns，nextJobId 递增）。

export function advanceConstruction(
  buildingState: BuildingState, civ: CivilizationState, turns: number,
  industryMultiplier: number, defs?: BuildingDefSource,
): { completedIds: string[] };
// 所有工事并行推进：stepTurns = turns × industryMultiplier；turnsLeft <= 0 时 counts++ 并返回建筑 id。
// 调用后把 completedIds 作为 TurnContext.buildingsCompleted 传入 resolveTurn 即可生成日志。

export function constructionSpeed(civ: CivilizationState, industryMultiplier = 1): number;
// 1 + (industryCapacity - 25)/300，再乘科技工业乘数，clamp 0.5..4

export function aggregateBuildingEffects(state: BuildingState, defs?): BuildingEffects;
// 数量线性叠加；返回对象所有字段均为数字（production/capacity 含全部 6 资源键）。
// disasterResistance clamp 0..0.9，observationBonus clamp 0..2。

export function totalMaintenance(state, defs?): Partial<Record<ResourceId, number>>; // 每回合维护（含冶炼厂矿物输入）
export function totalWorkers(state, defs?): number;
export function totalHousing(state, defs?): number;
export function getBuildingCount(state, id: string): number;
export function totalBuiltCount(state): number;
export function getObservatoryBuildingLevel(state, defs?): number;  // 已建成天文台等级（0/1）
export function staffingRatio(civ, workerNeed: number): number;      // min(1, workforce/需求)
export function capacityBonus(state, defs?): Record<ResourceId, number>;
export function describeEffects(def: BuildingDef): string[];         // 中文效果文案（给 BuildingView.effects）
export function canAffordBuilding(civ, buildingId): boolean;
export function constructionProgress(turnsLeft: number, totalTurns: number): number; // 0..1
```

---

## 5. 科技（`src/technology/`）

### 5.1 树结构

```ts
export interface TechBranchMeta { id: TechBranch; name; icon; description; color }
export const TECH_BRANCH_ORDER: readonly TechBranch[];                       // astronomy→energy→industry→biology→space
export const TECH_BRANCHES: Record<TechBranch, TechBranchMeta>;
export const TECH_DEFS: TechDef[];                                           // 26 项
export const TECH_MAP: Record<string, TechDef>;
export function getTechDef(id: string): TechDef | undefined;
export function techsByBranch(branch): TechDef[];
export function techName(id: string): string;
export function techChainCost(id: string): number;                           // 含前置链的累计科研点
```

**天文台 1~6 级升级科技链**（与 `core/constants.ts` 的 `OBSERVATORY_LEVELS[*].requiresTech` 一一对应）：
`astro_basic → astro_distance → astro_orbit → astro_threebody → astro_chaos → astro_supernet`。

### 5.2 科技数值表（26 项）

#### 天文学（astronomy）
| id | 名称 | 级 | 科研点 | 前置 | 效果摘要 |
| --- | --- | --- | --- | --- | --- |
| `astro_basic` | 天文基础 | T1 | 60 | — | 观测精度 +8%；解锁天文台 2 级升级 |
| `astro_distance` | 恒星测距 | T2 | 180 | 天文基础 | 观测精度 +12%；解锁天文台 3 级升级 |
| `astro_orbit` | 轨道动力学 | T3 | 480 | 恒星测距 | 观测精度 +15%；预测可信期 +20%；解锁天文台 4 级 |
| `astro_threebody` | 三体问题求解 | T4 | 1200 | 轨道动力学 | 观测 +18%；预测 +30%；科研 +10% |
| `astro_chaos` | 混沌理论 | T5 | 3000 | 三体问题求解 | 观测 +20%；预测 +35%；解锁天文台 5 级 |
| `astro_supernet` | 超空间观测网 | T5 | 3600 | 混沌理论 | 观测 +30%；预测 +40%；科研 +15%；解锁天文台 6 级 |

#### 能源学（energy）
| id | 名称 | 级 | 科研点 | 前置 | 效果摘要 |
| --- | --- | --- | --- | --- | --- |
| `energy_basic` | 电力工程 | T1 | 70 | — | 能源产出 +15% |
| `energy_grid` | 电网工程 | T2 | 200 | 电力工程 | 能源 +15%；工业产能 +5% |
| `energy_solar` | 轨道太阳能 | T3 | 520 | 电网工程 | 能源 +20%；解锁轨道太阳能阵列 / 气候调节设施 |
| `energy_fusion` | 可控聚变 | T4 | 1300 | 轨道太阳能 | 能源 +35%；工业 +5%；解锁聚变反应堆 |
| `energy_zero` | 零点能理论 | T5 | 3200 | 可控聚变 | 能源 +45%；金属 +10% |

#### 工业学（industry）
| id | 名称 | 级 | 科研点 | 前置 | 效果摘要 |
| --- | --- | --- | --- | --- | --- |
| `industry_basic` | 标准化工业 | T1 | 70 | — | 矿物 +15%；金属 +10% |
| `industry_automation` | 自动化生产线 | T2 | 200 | 标准化工业 | 工业产能 +12%；矿物 +10% |
| `industry_alloys` | 超导合金 | T3 | 520 | 自动化生产线 | 金属 +20%；解锁机械制造厂 / 地下避难所 |
| `industry_megastructure` | 巨型工程学 | T4 | 1300 | 超导合金 | 工业产能 +25%；矿物 +10% |
| `industry_quantum` | 量子制造 | T5 | 3200 | 巨型工程学 | 工业 +30%；金属 +15%；矿物 +10%；解锁量子计算中心 |

#### 生物学（biology）
| id | 名称 | 级 | 科研点 | 前置 | 效果摘要 |
| --- | --- | --- | --- | --- | --- |
| `bio_basic` | 农业科学 | T1 | 60 | — | 食物产出 +12%；解锁医疗中心 |
| `bio_medicine` | 现代医学 | T2 | 180 | 农业科学 | 宜居度 +3%；人口容量 +8% |
| `bio_ecology` | 生态工程 | T3 | 480 | 现代医学 | 宜居度 +6%；食物 +10%；解锁生态穹顶 |
| `bio_genetic` | 基因适应 | T4 | 1200 | 生态工程 | 宜居度 +12%；人口容量 +12% |
| `bio_biosphere` | 闭合生态圈 | T5 | 3000 | 基因适应 | 宜居度 +10%；食物 +15%；灾害抗性 +12% |

#### 航天学（space）
| id | 名称 | 级 | 科研点 | 前置 | 效果摘要 |
| --- | --- | --- | --- | --- | --- |
| `space_basic` | 火箭工程 | T1 | 80 | — | 工业产能 +3%；金属 +5% |
| `space_orbital` | 轨道工业 | T2 | 220 | 火箭工程 | 工业 +10%；能源 +5%；解锁太空港 |
| `space_colony` | 星际殖民技术 | T3 | 560 | 轨道工业 | 解锁星际殖民（colonyBase / startColony） |
| `space_deep` | 深空推进 | T4 | 1400 | 星际殖民技术 | 工业 +15%；金属 +10%；解锁深空雷达阵列 |
| `space_engine` | 行星发动机 | T5 | 3400 | 深空推进 | 解锁行星发动机；工业 +20% |

### 5.3 系统 API（`src/technology/system.ts`）

```ts
export function createTechState(): TechState;                        // { researched: [], activeTech: null, progress: 0, totalScience: 0 }
export function isResearched(techState, techId): boolean;
export function researchedCount(techState): number;
export function techDisplayName(techId): string;                     // 中文名
export function activeTechDef(techState): TechDef | null;

export interface ResearchCheck { ok: boolean; reason: string | null }
export function canResearch(techId: string, techState: TechState): ResearchCheck;
// 拒绝原因：未知科技 / 已研究完成 / 正在研究中 / 前置科技未满足（列出中文前置名）

export interface ResearchStartResult extends ResearchCheck { notice?: string }
export function startResearch(techState: TechState, techId: string): ResearchStartResult;
// 切换目标会清空 progress（notice 提示“原方向进度已损失”）

export interface ResearchAdvance { completedId: string | null; spent: number }
export function advanceResearch(techState: TechState, scienceBudget: number): ResearchAdvance;
// 只消耗补齐本科技所需的点数；多余预算不扣除。调用方需自行 civ.resources.science.amount -= spent。

export interface ActiveResearchInfo { techId; name; cost; progress; percent; remaining }
export function activeResearchInfo(techState): ActiveResearchInfo | null;

export function aggregateTechEffects(techState: TechState): TechEffects;
// 输出恒含全部字段：乘数=连乘（默认 1），加成=累加（默认 0），allowColony/allowPlanetEngine=OR。
// bonus clamp：habitability 0..0.6，disasterResistance 0..0.8，populationCapacity 0..0.8。

export interface TechMultipliers {
  production: Record<ResourceId, number>;  // 含农业/能源专门乘数折算
  research: number; agriculture: number; energy: number; industry: number;
  observation: number; prediction: number; habitability: number;
  disaster: number;          // 灾害伤害倍率：1=无减免，<1=减伤
  populationCapacity: number;
}
export function getTechMultipliers(techState: TechState): TechMultipliers; // 全部乘数，1 = 无加成
export function totalTechCost(): number;
export function branchProgress(techState, branch): { researched: number; total: number };
```

---

## 6. 回合结算（`src/economy/economy.ts`）— 核心入口

### 6.1 类型

```ts
export interface TurnCrisis {
  foodMultiplier: number;         // 食物产出乘数（饥荒/生态灾难，1=正常，<1 减产）
  energyDemandMultiplier: number; // 能源需求乘数（寒冬/酷暑）
  stabilityPenalty: number;       // 稳定度直接惩罚（点）
  disasterDamage: number;         // 本回合持续灾害瞬时破坏比例 0..1
}

export interface TurnContext {
  years: number; turn: number;
  env: EnvironmentState; physics: PhysicsState;
  buildingEffects: BuildingEffects; techEffects: TechEffects; techMultipliers: TechMultipliers;
  crisis: TurnCrisis;
  mode: GameMode; difficulty: DifficultyKey; year: number;

  // --- 可选扩展（强烈建议全部传入；缺省有安全默认值） ---
  maintenance?: Partial<Record<ResourceId, number>>; // buildings.totalMaintenance
  observatoryLevel?: number;                          // 默认 1
  researchedCount?: number;                           // 默认 0
  buildingsCompleted?: string[];                      // advanceConstruction 的 completedIds
  researchCompleted?: string | null;                  // advanceResearch 的 completedId
  workerJobs?: number;                                // buildings.totalWorkers；缺省沿用 civ.jobs
  researchSpent?: number;                             // 本回合已扣除的科研点（流量显示）
  constructionCount?: number;                         // 在建工程数（industryUsed = count×10，上限 industryCapacity）
  hasPlanetEngine?: boolean;                          // planetEngineReady()，用于“流浪行星”胜利
}

export interface TurnLog { category: "civilization"|"build"|"tech"|"milestone"|"hazard"; severity: "info"|"warning"|"critical"|"success"; message: string }
export interface TurnReport {
  logs: TurnLog[]; buildingsCompleted: string[]; researchCompleted: string | null;
  eraChanged: number | null; era: number;
  collapsed: boolean; collapseReason: string | null;
  victory: boolean; victoryReason: string | null;
  populationDelta: number;
}
export function resolveTurn(civ: CivilizationState, ctx: TurnContext): TurnReport;
export function createEmptyTurnReport(civ): TurnReport;
export function assembleTurnContext(opts: AssembleTurnContextOptions): TurnContext; // 补默认值
```

### 6.2 单次 resolveTurn 内部流水线

1. **温度修正**：`effTemp = surfaceTempC ± buildingEffects.thermalShielding`（向 16°C 拉近）；
   `tempStress = max(0, |effTemp-16| - 8)`；能源需求系数 `1 + tempStress × 0.02`。
2. **能源先行**：`energySatisfaction = clamp01((库存+产出)/需求)`；`powerEfficiency = 0.55 + 0.45 × 满足率`，
   用来折减农业/水/工业建筑产出。
3. **资源生产**（详见 §7.2）：人口自给 + 建筑产出 × 人力充足率 × `powerEfficiency` × 科技乘数 × 环境效率 × crisis 修正。
4. **资源消耗**：人口口粮/饮水/能源（× 温度需求）+ 建筑维护（`ctx.maintenance`）+ 殖民地补给
   （能源 `25 + pop×0.02`、金属 4、食物 6 / 回合）。
5. **库存结算**：`new = clamp(old + produced - consumed, 0, capacity)`；记录 shortage/overflow 到 `civ.flows`。
6. **饥荒压力**：食物缺口比例 ×45×回合比例累加 `civ.starvation`（上限 120），无缺口每回合 −10。
7. **持续灾害**：`y = ctx.crisis.disasterDamage × techMultipliers.disaster × (1 - 建筑/科技抗性)`；
   人口 `×(1-y)`、库存 `×(1-0.3y)`。**离散灾害请用 `applyCrisisEffects`，并令 ctx.crisis.disasterDamage = 0 避免重复。**
8. **人口增长**：`growthPerYear = 1.8% × difficulty.populationGrowth × 食物安全^1.5 × 饮水安全 × 住房因子 × 稳定度因子 × 温度因子 × 宜居因子 − 死亡率`，
   然后 `pop ×= (1 + growthPerYear × years)`；死亡率来自饥荒/缺水/低稳定度/能源崩溃。
9. **就业与工业**：`workforce = floor(pop×0.55)`；`jobs = workerJobs + floor(pop×0.30)`（服务业）；
   `industryCapacity = (25 + 建筑工业) × 科技工业乘数`。
10. **稳定度**：六因子 → 加权平均得目标值，以 `1-exp(-years/1.1)` 平滑逼近；写入 `civ.stabilityFactors`。
11. **殖民联动**：只把 `colonyProgress` 建筑效果折算为殖民地自给率；**殖民地成长由 game 层单独调用 `colonyReport`**（避免重复结算）。
12. **科技解锁标记**：按 `techEffects.allowColony/allowPlanetEngine` 置 `civ.unlockFlags`。
13. **时代推进**：`eraScore = max(observatoryLevel, 1 + floor(researchedCount/4))`，取 `ERAS` 中 threshold ≤ score 的最高时代。
14. **完工/科研日志、环境告警、胜利/失败判定、人口历史采样**（`MAX_POPULATION_HISTORY = 600`）。

> `resolveTurn` 是**纯回合结算**：不推进物理、不推进观测任务、不推进科技研究本身、不推进殖民地成长；
> 这些分别由 game/observation 层完成后把结果通过 ctx 传进来。

### 6.3 时代

```ts
export function eraScore(observatoryLevel: number, researchedCount: number): number;
export function eraInfo(civ: CivilizationState, observatoryLevel: number, researchedCount: number): {
  era: number; name: string; description: string; progress: number; nextThreshold: number;
};
```
- 时代阈值来自 `core/constants.ERAS`（0 / 2 / 3 / 4 / 5）。
- 双轨：天文台等级（主路径）或 科技总量（每 4 项 ≈ +1 时代）。
- 已是第 5 时代时 `progress = 1`、`nextThreshold = 当前阈值`。
- `resolveTurn` 在第 13 步自动推进 `civ.era` 并写 `report.eraChanged`。

### 6.4 殖民地

```ts
export const COLONY_COST: Partial<Record<ResourceId, number>>;  // 矿物 2500 / 金属 1500 / 能源 1000
export const COLONY_LEVEL_THRESHOLDS: readonly number[];         // [0, 600, 1500, 3000, 6000]

export function startColony(civ, techState, resources, year): { ok; reason; colony: ColonyState | null };
export function foundColony(civ, techState, resources, year): 同 startColony;  // 别名
export function colonyReport(civ, env, years): { logs: TurnLog[]; populationDelta: number };
```
- 建立条件：已研究 `space_colony`（`techEffects.allowColony`）、`civ.era >= 4`、无既有殖民地、资源足够。
- 初始殖民地：人口 200、自给率 0.35、完整度 0.85、等级 1。
- `colonyReport` 每回合由 game 层调用一次：人口按 `(2% + 自给率×2% + 等级×0.4%) × 母星支持因子` 增长；
  自给率与完整度缓慢提升；人口跨过阈值自动升级并输出成功日志。

### 6.5 胜负

```ts
export function checkDefeat(civ, env): { defeated: boolean; reason: string | null };
export function applyCrisisEffects(civ, crisis): void;
export function planetEngineReady(civ, buildings, techState): boolean;
export function civilizationSummary(civ): string;
```

**失败条件**（`checkDefeat`，`resolveTurn` 第 14 步自动应用，sandbox 模式跳过）：
1. `civ.alive === false`（已崩溃）；
2. 人口 < 1；
3. `civ.starvation >= 100`（长期饥荒）；
4. `civ.stability <= 0` 且 `civ.crisisStreak >= 4`（连续危急回合）；
5. `env.habitability <= 0.02` 且没有 3 级及以上殖民地。
另外 `resolveTurn` 内：母星被物理销毁（`ctx.physics.planetAlive === false`）且无 3 级殖民地 → 崩溃。

**胜利条件**（`resolveTurn` 第 14 步）：
1. `civ.era >= 5` 且殖民地等级 ≥ 4 且自给率 ≥ 0.8 → “星际文明”；
2. `civ.era >= 5` 且 `ctx.hasPlanetEngine` → “流浪行星”；
3. `env.habitability <= 0.02` 且殖民地等级 ≥ 3 → “火种计划”（母星死亡后文明存续）。

---

## 7. 数值平衡说明

### 7.1 时间与难度

- 1 回合 = `TURN_YEARS = 0.5` 年（`core/constants`）。流量（`civ.flows`）为本回合实际值。
- 难度影响：起始食物/能源/科研、人口增长率（easy 1.25 / normal 1.0 / hard 0.85 / nightmare 0.7）、
  初始人口（nightmare 800，其余 1000）。

### 7.2 每回合经济常量（`src/economy/economy.ts`）

| 常量 | 值 | 含义 |
| --- | --- | --- |
| `FOOD_PER_CAPITA_TURN` | 0.5 | 每人每回合口粮（吨）→ 1000 人 = 500/回合 |
| `WATER_PER_CAPITA_TURN` | 0.55 | 每人每回合饮水（吨）→ 1000 人 = 550/回合 |
| `ENERGY_PER_CAPITA_TURN` | 0.1 | 每人每回合基础能源（MWh），另乘温度需求系数 |
| `SUBSISTENCE_FOOD_PER_CAPITA` | 0.06 | 人口自给农业（吨/人/回合） |
| `SUBSISTENCE_WATER_PER_CAPITA` | 0.12 | 人口自给取水 |
| `SUBSISTENCE_ENERGY_PER_CAPITA` | 0.03 | 人口自给能源 |
| `SCIENCE_PER_CAPITA_TURN` | 0.01 | 人均基础教育科研点 |
| `BASE_GROWTH_PER_YEAR` | 0.018 | 基础人口年增长率（再乘难度与各因子） |
| `STARVATION_COLLAPSE` | 100 | 饥荒压力崩溃阈值 |
| `CRISIS_STREAK_COLLAPSE` | 4 | 稳定度归零持续回合崩溃阈值 |
| `ENERGY_CRITICAL_SATISFACTION` | 0.9 | 能源满足率告警线 |
| `TEMP_TOLERANCE_C` | 8 | 舒适区半宽（°C） |

生产公式（单回合）：

```
food    = (人口×0.06×(0.6+0.4×农业环境) + 建筑食物×人力充足率×电力效率) × 科技食物乘数 × 农业环境 × 危机食物乘数 × 回合比例
water   = (人口×0.12×(0.6+0.4×取水环境) + 建筑水×人力充足率×电力效率) × 科技水乘数 × 取水环境 × 回合比例
energy  = (人口×0.03 + 建筑能源×人力充足率) × 科技能源乘数 × 回合比例
minerals= 建筑矿物×人力充足率×电力效率 × 科技矿物乘数 × 风暴系数(0.9) × 回合比例
metals  = 建筑金属×人力充足率×电力效率 × 科技金属乘数 × 风暴系数(0.9) × 回合比例
science = (人口×0.01 + 建筑科研×人力充足率) × 科技科研乘数 × (0.5+0.5×稳定度/100) × (1-0.3×失业率) × 回合比例
```

环境效率：

```
agricultureEfficiency = 温度因子 × (0.35 + 0.45×宜居度 + 0.2× ecology) × (0.55+0.45×water/0.5) × 天气因子
waterEfficiency       = 温度因子 × (0.35+0.65×water/0.6) × 天气因子
温度因子(农业) = clamp(1.02 - max(0, |t-16|-6)/55, 0.08, 1.02)
温度因子(取水) = clamp(1 - 严寒项 - 酷热项, 0.15, 1)
天气因子(食物)：clear 1 / cloudy .96 / storm .86 / ash .68 / freezing .55 / scorching .5
天气因子(水)：  clear 1 / cloudy .98 / storm .9 / ash .85 / freezing .45 / scorching .55
能源需求系数 = 1 + max(0, |体感温度-16|-8) × 0.02
电力效率 = 0.55 + 0.45 × 能源满足率
```

### 7.3 实测平衡曲线（normal / 默认开局 / 16°C / 无玩家操作）

| 回合 | 人口 | 稳定度 | 食物 产/耗 | 水 产/耗 | 能源 产/耗 | 科研库存 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 1006 | 72.5 | 599 / 500 | 600 / 550 | 350 / 203 | 75 |
| 10 | 1074 | 87.2 | 602 / 533 | 608 / 586 | 352 / 210 | 226 |
| 20 | 1158 | 87.9 | 607 / 575 | 618 / 632 | 354 / 218 | 405 |
| 30 | 1248 | 87.4 | 611 / 619 | 629 / 681 | 357 / 227 | 592 |
| 40 | 1335 | 85.1 | 616 / 666 | 640 / 733 | 360 / 236 | 788 |
| 50 | ~1390 | ~82 | 食物开始缺口 | 水库存耗尽 | 能源溢出 | ~1000 |

设计意图：**前 10 回合是安全的**（起始库存足够）；约第 15~20 回合水开始短缺、第 35~45 回合食物开始短缺，
迫使玩家在中期补建水厂/农田（实测在 12 回合补 1 座水厂可把 50 回合人口推到 ~1460 且不崩溃）。
不建任何建筑时，民兵自给只能撑约 5 回合，第 9 回合左右饥荒崩溃——压力真实存在。

### 7.4 环境敏感度（首回合食物产出，normal 开局）

| 地表温度 | 16°C | 40°C | 60°C | 80°C | -20°C | -40°C | -60°C |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 食物产出 | 599 | 299 | 141 | 34 | 204 | 47 | 34 |
| 能源消耗 | 203 | 235 | 275 | 315 | 259 | 299 | 339 |

配合 `shelter`（+5°C 耐受）与 `climateControl`（+12°C 耐受）可把极端温度往舒适区拉回。

### 7.5 设计约束

- 起始资源来自难度预设，不允许“零资源开荒”以外的特殊起始（sandbox 也正常开局，只是不判负）。
- 科学技术门槛、建筑时代门槛、唯一性、资源成本全部在 `checkBuild` 统一校验；`startConstruction` 只兜底资源与数量。
- 观测质量加成同时来自建筑（`observationBonus`）与科技（`TechMultipliers.observation`）；观测模块计算最终精度时
  建议：`最终精度倍率 = 科技观测乘数 × (1 + buildingEffects.observationBonus) × 天文台等级效率`。
- 灾害抗性：`buildingEffects.disasterResistance` 与 `techEffects.disasterResistance` 在 economy 内相加（上限 0.9/0.8）。
- 治安/秩序：建筑 `stability` 可为负（如行星发动机 −10 的“恐惧”），会真实压低稳定度目标。

---

## 8. game 层集成示例（与当前 `src/game/game.ts` 一致）

```ts
import { advanceConstruction, aggregateBuildingEffects, checkBuild, constructionSpeed,
  getBuildingCount, startConstruction, totalMaintenance, totalWorkers } from "../buildings";
import { aggregateTechEffects, advanceResearch, canResearch, getTechMultipliers, startResearch } from "../technology";
import { assembleTurnContext, checkDefeat, colonyReport, foundColony, eraInfo,
  planetEngineReady, resolveTurn } from "../economy";
import { createCivilizationState } from "../civilization";
import { createInitialBuildingState } from "../buildings";
import { createTechState } from "../technology";

// —— 新游戏 ——
const civ = createCivilizationState({ difficulty, mode, seed, startYear: 0, startTempC: env.surfaceTempC });
const buildings = createInitialBuildingState();
const tech = createTechState();

// —— 玩家操作 ——
const fx = aggregateTechEffects(tech);
const check = checkBuild("farm", civ, buildings, tech, fx, mode);
if (check.ok) startConstruction(buildings, civ, getBuildingDef("farm")!, yearsElapsed);
if (canResearch("astro_basic", tech).ok) startResearch(tech, "astro_basic");
if (planetEngineReady(civ, buildings, tech)) { /* 触发胜利 */ }
foundColony(civ, tech, civ.resources, yearsElapsed);   // 会自己校验科技/时代/资源

// —— 每回合结算 ——
const techMult = getTechMultipliers(tech);

// 1) 研究：用库存科研点推进，并扣库存
let researchSpent = 0, researchCompleted: string | null = null;
if (tech.activeTech && civ.resources.science.amount > 0) {
  const r = advanceResearch(tech, civ.resources.science.amount);
  researchSpent = r.spent;
  civ.resources.science.amount -= r.spent;
  researchCompleted = r.completedId;
}

// 2) 施工推进（工业越高越快）
const construction = advanceConstruction(
  buildings, civ, 1, constructionSpeed(civ, techMult.industry), BUILDING_DEFS,
);

// 3) 聚合效果 / 维护 / 工人
const buildingEffects = aggregateBuildingEffects(buildings);
const techEffects = aggregateTechEffects(tech);
const maintenance = totalMaintenance(buildings);
const workerJobs = totalWorkers(buildings);

// 4) 组装上下文并结算
const turnCtx = assembleTurnContext({
  civ, env, physics,
  buildingEffects, techEffects, techMultipliers: techMult,
  crisis: { foodMultiplier: 1, energyDemandMultiplier: 1, stabilityPenalty: 0, disasterDamage: 0 },
  mode, difficulty, year, years: TURN_YEARS, turn: civ.turn + 1,
  maintenance,
  observatoryLevel: observation.level,
  researchedCount: tech.researched.length,
  buildingsCompleted: construction.completedIds,
  researchCompleted,
  workerJobs,
  researchSpent,
  constructionCount: buildings.queue.length,
  hasPlanetEngine: planetEngineReady(civ, buildings, tech),
});
const report = resolveTurn(civ, turnCtx);
report.logs.forEach((l) => log.add(l.category, l.severity, l.message, year, civ.turn));

// 5) 殖民地成长（每回合一次）
if (civ.colony) colonyReport(civ, env, TURN_YEARS).logs.forEach(/* 写入日志 */);

// 6) 胜负（resolveTurn 已写入 report.collapsed / report.victory）
const defeat = checkDefeat(civ, env);
```

> 注意顺序：**先** `advanceResearch` / `advanceConstruction`（消耗上回合库存），**再** `resolveTurn` 产出新资源。
> `resolveTurn` 已经包含失败/胜利判定，game 层可直接消费 `report.collapsed / report.collapseReason / report.victory / report.victoryReason`。

---

## 9. 测试

```bash
npx vitest run tests/systems        # 60 个测试，全部通过
npx tsc --noEmit                    # 本模块零错误
```

| 文件 | 覆盖 |
| --- | --- |
| `tests/systems/buildings.test.ts` | 建筑表完整性 / 前置科技存在性 / checkBuild 各分支 / 开工扣资源 / 工期与工业倍率 / 效果聚合 / 维护与工人 / 中文效果文案 |
| `tests/systems/technology.test.ts` | 26 项科技完整性 / 无环 / 天文台 6 级链可达 / canResearch / 研究推进与切换 / 乘数生效 / 未知 id 容错 |
| `tests/systems/economy.test.ts` | 初始状态 / 单回合结算 / 库存上限 / 维护与温度需求 / 50 回合模拟（不 NaN、不瞬崩、不溢出）/ 中期补建水厂 / 高低温联动 / 危机修正 / 时代推进 / 胜负判定 / 殖民地 / 可重复性 |

---

## 10. 已知缺口与注意事项

1. **离散灾害与持续灾害不要重复计算**：`ctx.crisis.disasterDamage` 会被 `resolveTurn` 应用；
   若同一回合已调用 `applyCrisisEffects(civ, crisis)` 或 `events/hazards` 的伤害逻辑，请把 `disasterDamage` 传 0。
2. **殖民地成长只有一处**：`resolveTurn` 不推进殖民地人口（只吃 `colonyProgress` 的自给率加成），
   game 层必须每回合调用一次 `colonyReport`，否则殖民地不会长大。
3. **startColony 不检查殖民基地建筑**：只检查科技/时代/资源；若设计要求“必须先建 colonyBase”，
   game 层需自行 `getBuildingCount(buildings, "colonyBase") >= 1`。
4. **techEffects.observationLevelUnlock 未使用**：天文台等级上限由 `OBSERVATORY_LEVELS[*].requiresTech`
   与 observation 模块的 `checkUpgrade` 控制（本模块只保证科技链存在且可达）。
5. **能源短缺只影响生产折扣与稳定度**，不会中断施工/科研/观测；研究点缺口由 game 层按“可用库存”决定。
6. **天气来自 `env.weather`**：若上层未及时更新环境，农业/取水天气修正会滞后于真实物理。
7. **殖民人口不计入 `civ.population`**：殖民地人口独立统计，仅通过胜利条件参与结算。
8. **稳定度因子为 0..100 纯数值**，不含隐藏状态；`civ.stability` 用一阶平滑逼近目标，避免单回合跳变。
9. **存档兼容**：本模块所有状态均为纯数据对象（无类实例/Symbol/函数），可直接 JSON 序列化。
   读档后只需重新调用 `aggregateBuildingEffects` / `aggregateTechEffects` / `getTechMultipliers`，
   不要保存聚合结果（派生数据）。
10. **难度扩展**：`DIFFICULTIES` 新增字段不会影响本模块（只读取起始资源与 populationGrowth）；
    `mode` 目前只影响 sandbox 的建造门槛与不判负行为。
11. **人口历史**：`civ.populationHistory` 每回合追加，长度上限 600（约 300 年），供 UI 折线图直接使用。
12. `resolveTurn` 会写 `civ.turn`：优先使用 `ctx.turn`，并与 `civ.turn + 1` 取较大值，重复调用不会倒退。
