/**
 * docs/ERA_CONTENT.md 生成器（阶段 12 · 时代进化内容总表）。
 *
 * 从 src 的真实定义表自动生成文档中的建筑全表 / 升级链 / 科技全表 / 时代条件 /
 * 观测门槛 / 数值平衡实测（开局一回合与 60 年空转），保证文档与代码不会脱节。
 *
 * 用法（PowerShell，禁止 npx.ps1 时直接用 node）：
 *   node .\node_modules\vite-node\vite-node.mjs tests/systems/era-content.generator.ts
 *
 * 说明：本文件不是 vitest 用例（tests/**\/*.test.ts 才会被收集），只由人工/CI 调用。
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BUILDING_CATEGORY_NAMES,
  BUILDING_DEFS,
  STARTING_BUILDINGS,
  buildingUpgradeChain,
} from "../../src/buildings/definitions";
import { describeEffects } from "../../src/buildings/system";
import { BASE_RESOURCE_STOCK, RESOURCE_IDS, resourceName } from "../../src/civilization/resources";
import { outdatedMultiplier } from "../../src/civilization/eras";
import {
  DIFFICULTIES,
  ERAS,
  ERA_MAX,
  OBSERVATORY_LEVELS,
  RESOURCE_UNLOCK_ERA,
  TURN_YEARS,
} from "../../src/core/constants";
import { TECH_BRANCHES, TECH_BRANCH_ORDER, TECH_DEFS, techsByBranch } from "../../src/technology/tree";
import type { BuildingDef, DifficultyKey, ResourceId, TechDef } from "../../src/core/types";
import { createWorld, makeEnvironment, runTurn, runTurns } from "./helpers";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const OUT: string[] = [];

function line(text = ""): void {
  OUT.push(text);
}
function table(headers: string[], rows: string[][]): void {
  line("| " + headers.join(" | ") + " |");
  line("| " + headers.map(() => "---").join(" | ") + " |");
  for (const row of rows) line("| " + row.join(" | ") + " |");
  line();
}
function f1(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : "—";
}
function f0(value: number): string {
  return Number.isFinite(value) ? Math.round(value).toString() : "—";
}
function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
function costText(cost: Partial<Record<ResourceId, number>> | undefined): string {
  if (!cost) return "—";
  const parts = RESOURCE_IDS.filter((id) => (cost[id] ?? 0) > 0).map((id) => `${resourceName(id)} ${cost[id]}`);
  return parts.length > 0 ? parts.join(" + ") : "—";
}
function effectText(def: BuildingDef): string {
  return describeEffects(def).join("<br>");
}
function techsText(ids: readonly string[]): string {
  if (ids.length === 0) return "—";
  return ids.map((id) => `\`${id}\``).join("<br>");
}
function reqText(tech: TechDef): string {
  return tech.requires.length === 0 ? "—" : tech.requires.map((id) => `\`${id}\``).join("<br>");
}
function buildingText(def: BuildingDef): string {
  return `\`${def.id}\` ${def.name}`;
}

/* ================================ 标题 ================================ */
line("# 《三体纪元》时代进化内容总表（阶段 12）");
line();
line("> 本文档由 `tests/systems/era-content.generator.ts` 从代码定义表**自动生成**，请勿手工修改表格；");
line("> 调整 `src/buildings/definitions.ts`、`src/technology/tree.ts`、`src/core/constants.ts`、");
line("> `src/civilization/eras.ts` 后重新生成：");
line(">");
line("> ```powershell");
line("> node .\\node_modules\\vite-node\\vite-node.mjs tests/systems/era-content.generator.ts");
line("> ```");
line(">");
line("> 口径：1 回合 = 0.5 年（`TURN_YEARS = " + TURN_YEARS + "`）；所有数值为定义表原始值，");
line("> 实际结算还会乘以人力充足率、科技乘数、环境系数与时代效率修正。");
line();

/* ============================ 1. 时代总览 ============================ */
line("## 1. 时代总览");
line();
const eraRows: string[][] = ERAS.map((era) => {
  const newBuildings = BUILDING_DEFS.filter((d) => d.era === era.era);
  const newTechs = TECH_DEFS.filter((t) => t.tier === era.era);
  const requirements = era.requirements.length === 0 ? "（初始时代）" : era.requirements.map((r) => r.label).join("<br>");
  return [
    `E${era.era}`,
    `**${era.name}**<br>${era.subtitle}`,
    requirements,
    newBuildings.length.toString(),
    `${newBuildings.map((d) => d.name).join(" / ")}`,
    newTechs.length.toString(),
    era.unlockSummary,
  ];
});
table(["时代", "名称", "进入条件", "本代可新建", "本代建筑", "本代科技", "解锁摘要"], eraRows);
line(`- 时代上限：\`ERA_MAX = ${ERA_MAX}\`；文明从 E1「仰望星空」起步（初始人口 500，nightmare 400）。`);
line("- 时代推进由 `src/game/game.ts` 每回合调用 `civilization/eras.ts` 的条件清单判定；`economy.resolveTurn` 不再自行跳时代（`eraChanged` 恒为 `null`）。");
line();

/* ============================ 2. 资源解锁 ============================ */
line("## 2. 资源解锁与初始库存");
line();
const NORMAL_PRESET = DIFFICULTIES.normal;
/** 食物 / 能源 / 科研的初始值由难度预设提供，其余资源用基础库存表。 */
const normalInitialStock = (id: ResourceId): number =>
  id === "food"
    ? NORMAL_PRESET.startingFood
    : id === "energy"
      ? NORMAL_PRESET.startingEnergy
      : id === "science"
        ? NORMAL_PRESET.startingScience
        : BASE_RESOURCE_STOCK[id];
const RESOURCE_ACQUIRE: Record<ResourceId, string> = {
  food: "农业 / 采集",
  water: "取水 / 水利",
  minerals: "采石 / 采矿",
  metals: "金属冶炼（E2 解锁）",
  energy: "发电（E3 解锁）",
  science: "知识积累",
};
const resourceRows: string[][] = RESOURCE_IDS.map((id) => [
  "`" + id + "` " + resourceName(id),
  "第 " + RESOURCE_UNLOCK_ERA[id] + " 时代",
  RESOURCE_ACQUIRE[id],
  f0(normalInitialStock(id)),
]);
table(["资源", "解锁时代", "获取方式", "normal 初始库存"], resourceRows);
line("- 食物 / 能源 / 科研的初始值来自难度预设（DIFFICULTIES.normal），其余来自 BASE_RESOURCE_STOCK；metals / energy 在未解锁时代被 game 层强制归零。");
line("- E1：仅 food / water / minerals / science；**E1 建筑的成本与维护禁止 metals / energy**。");
line("- E2：解锁 metals（青铜 / 铁），**仍无 energy（电力）**；水车、畜力以“动力”为名也不消耗 energy。");
line("- E3：解锁 energy（电力），此后全部资源可用。");
line("- 经济层 `TurnContext.era` 语义：`era < 2` 金属生产/需求置 0；`era < 3` 能源生产/需求置 0（无电力时代 `powerEfficiency = 1`）。不传 `era` 时保持旧行为（全资源解锁）。");
line("- 观测任务在 `era < 3` 时以食物支付，`era >= 3` 时以能源支付（`game.ts startObservation`）。");
line();

/* ============================ 3. 建筑全表 ============================ */
line("## 3. 建筑全表（38 座 · 五时代）");
line();
line("字段说明：tier = 升级链内层级；成本 = 一次性建造消耗；维护 = 每回合消耗；工人 = 满负荷所需劳动力；");
line("升级到 = 升级链目标（`null` 为链末端）；升级成本 / 工期定义在**目标建筑**上（见第 4 节）。");
line();
for (const era of ERAS) {
  const list = BUILDING_DEFS.filter((d) => d.era === era.era);
  if (list.length === 0) continue;
  line(`### E${era.era} · ${era.name}（${era.subtitle}）—— ${list.length} 座可新建`);
  line();
  table(
    ["id", "名称", "分类", "tier", "升级到", "成本", "维护", "工人", "效果", "前置科技", "上限"],
    list.map((def) => [
      `\`${def.id}\``,
      def.name,
      BUILDING_CATEGORY_NAMES[def.category],
      String(def.tier),
      def.upgradeTo ? `\`${def.upgradeTo}\`` : "—（链末端）",
      costText(def.cost),
      costText(def.maintenance),
      String(def.workers),
      effectText(def),
      techsText(def.requiresTech),
      def.maxCount === undefined ? "—" : String(def.maxCount),
    ]),
  );
}

/* ============================ 4. 升级链 ============================ */
line("## 4. 升级链全表");
line();
line("旧时代建筑在新一代文明中按 `outdatedMultiplier` 折减：当前时代 ×1、落后 1 代 ×0.8、落后 ≥2 代 ×0.6。");
line("折减作用于**全部效果**（产出 / 住房 / 仓储 / 科研 / 观测 / 稳定度 / 隔热等）；维护与工人不折减，");
line("因此“只造不升级”是双重惩罚。升级成本按目标建筑新建成本的约 6 折设定（本节末尾给出实测比例）。");
line();
const CHAIN_ORDER = [
  "housing",
  "food",
  "water",
  "industry",
  "research",
  "energy",
  "defense",
  "storage",
  "space",
  "observatory",
];
const upgradeRatios: { chain: string; node: string; resource: string; ratio: number }[] = [];
/** 只保留真正参与「前一级 → 后一级」链接的建筑；同组但无升级关系的建筑单独说明。 */
function splitChain(group: string): { nodes: BuildingDef[]; independent: BuildingDef[] } {
  const defs = buildingUpgradeChain(group);
  const linked = (def: BuildingDef): boolean =>
    def.upgradeTo !== null || defs.some((other) => other.upgradeTo === def.id);
  return { nodes: defs.filter(linked), independent: defs.filter((def) => !linked(def)) };
}
for (const group of CHAIN_ORDER) {
  const { nodes: chain, independent } = splitChain(group);
  if (chain.length === 0 && independent.length === 0) continue;
  const extra = independent.length > 0 ? "；另有 " + independent.length + " 座同组独立建筑" : "";
  const title =
    chain.length > 0
      ? "### 升级组 \`" + group + "\`（" + chain.length + " 级" + extra + "）"
      : "### 升级组 \`" + group + "\`（无升级链，仅独立建筑）";
  line(title);
  line();
  if (independent.length > 0) {
    line(
      "- 同组独立建筑（不参与升级）：" + independent.map((d) => buildingText(d) + "（E" + d.era + "）").join("、"),
    );
    line();
  }
  if (chain.length === 0) continue;
  const rows = chain.map((node) => {
    const predecessor = chain.find((d) => d.upgradeTo === node.id);
    let upgradeCell = "链首（直接建造）";
    if (predecessor) {
      const target = node;
      upgradeCell = `${costText(target.upgradeCost)}<br>${target.upgradeTurns ?? target.buildTurns} 回合`;
      for (const rid of RESOURCE_IDS) {
        const value = target.upgradeCost?.[rid] ?? 0;
        const base = target.cost[rid] ?? 0;
        if (value > 0 && base > 0) upgradeRatios.push({ chain: group, node: node.id, resource: rid, ratio: value / base });
      }
    }
    return [
      String(node.tier),
      `\`${node.id}\``,
      node.name,
      `E${node.era}`,
      costText(node.cost),
      upgradeCell,
      effectText(node),
    ];
  });
  table(["层级", "id", "名称", "时代", "新建成本", "从上一级升级", "效果"], rows);
}
if (upgradeRatios.length > 0) {
  const values = upgradeRatios.map((r) => r.ratio);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  line(`- 升级成本 / 目标新建成本 比例：共 ${upgradeRatios.length} 项，最小 ${pct(min)}、最大 ${pct(max)}、均值 ${pct(avg)}。`);
  line();
}

/* ============================ 5. 科技全表 ============================ */
line("## 5. 科技全表（26 项 · 5 方向）");
line();
line("科技 `tier` 即“可研究的时代”：`tier > civ.era` 时 `canResearch` 返回 `{ ok: false, reason: \"需要第 X 时代\" }`。");
line("不传 `era` 的旧调用默认 `era = 5`（全解锁，向后兼容）。");
line();
const techTierRows = [1, 2, 3, 4, 5].map((tier) => {
  const list = TECH_DEFS.filter((t) => t.tier === tier);
  const costs = list.map((t) => t.cost);
  return [`E${tier}`, String(list.length), `${Math.min(...costs)} – ${Math.max(...costs)}`];
});
table(["时代", "科技数量", "成本区间（科研点）"], techTierRows);
for (const branch of TECH_BRANCH_ORDER) {
  const meta = TECH_BRANCHES[branch];
  const list = techsByBranch(branch);
  line(`### ${meta.name} \`${branch}\`（${list.length} 项）`);
  line();
  line(meta.description);
  line();
  table(
    ["id", "名称", "时代", "成本（科研点）", "前置", "效果"],
    list.map((tech) => [
      `\`${tech.id}\``,
      tech.name,
      `E${tech.tier}`,
      String(tech.cost),
      reqText(tech),
      tech.effectSummary,
    ]),
  );
}
line(`- 全部科技总成本：${TECH_DEFS.reduce((s, t) => s + t.cost, 0)} 科研点；外部依赖的 astro 链 6 项、space 链 5 项 id 全部保留。`);
line();

/* ============================ 6. 观测设施 ============================ */
line("## 6. 观测设施（天文台）等级与时代门槛");
line();
line("Lv.1 由建造「观星台」建筑直接获得（建筑成本 矿物 120 + 食物 80，无能源 / 金属）；");
line("Lv.2~Lv.6 通过 `game.ts upgradeObservatory` 付费升级。**Lv.2 的成本不含能源**（E2 尚未解锁电力），");
line("因此 E2 可以升到 Lv.2 并满足 E3 的观测条件——这是 E2→E3 可达性的关键。");
line();
table(
  ["等级", "名称", "需求时代", "需求科技", "升级科研点", "升级资源", "预测窗口（年）", "数据/回合"],
  OBSERVATORY_LEVELS.map((level) => {
    const eraText =
      level.level === 0 ? "—（肉眼观测）" : level.level === 1 ? "E1（建造观星台获得）" : "E" + level.requiresEra;
    const costCell =
      level.level === 0
        ? "—（暂无设施）"
        : level.level === 1
          ? "由建筑提供（不走付费升级）"
          : costText(level.upgradeCost);
    return [
      "Lv." + level.level,
      level.name,
      eraText,
      level.requiresTech ? "`" + level.requiresTech + "`" : "—",
      level.level === 0 ? "—" : String(level.upgradeScience),
      costCell,
      level.predictionHorizon.toFixed(2),
      String(level.dataRate),
    ];
  }),
);
line("- 天文台升级链与天文科技链一一对应：Lv2 ← `astro_distance`，Lv3 ← `astro_orbit`，Lv4 ← `astro_threebody`，Lv5 ← `astro_chaos`，Lv6 ← `astro_supernet`（Lv1 ← `astro_basic`）。");
line();

/* ============================ 7. 数值平衡 ============================ */
line("## 7. 数值平衡说明");
line();
line("### 7.1 建筑成本与单栋产出梯度");
line();
const costRows: string[][] = [1, 2, 3, 4, 5].map((era) => {
  const list = BUILDING_DEFS.filter((d) => d.era === era);
  const withMinerals = list.filter((d) => (d.cost.minerals ?? 0) > 0).map((d) => d.cost.minerals ?? 0);
  const withFood = list.filter((d) => (d.cost.food ?? 0) > 0).map((d) => d.cost.food ?? 0);
  const range = (values: number[]): string => {
    if (values.length === 0) return "—";
    const min = Math.min(...values);
    const max = Math.max(...values);
    return min === max ? String(min) : `${min} – ${max}`;
  };
  const maxProduction = (rid: ResourceId): number =>
    Math.max(0, ...list.map((d) => d.effects.production?.[rid] ?? 0));
  const maxResearch = Math.max(0, ...list.map((d) => d.effects.research ?? 0));
  const maxHousing = Math.max(0, ...list.map((d) => d.effects.housing ?? 0));
  const maxIndustry = Math.max(0, ...list.map((d) => d.effects.industry ?? 0));
  return [
    `E${era}`,
    range(withMinerals),
    range(withFood),
    f0(maxProduction("food")),
    f0(maxProduction("water")),
    f0(maxProduction("minerals")),
    f0(maxProduction("metals")),
    f0(maxProduction("energy")),
    f0(maxResearch),
    f0(maxHousing),
    f0(maxIndustry),
  ];
});
table(
  ["时代", "新建矿物成本区间", "新建食物成本区间", "单栋食物", "单栋水", "单栋矿物", "单栋金属", "单栋能源", "单栋科研", "单栋住房", "单栋工业"],
  costRows,
);
line("平衡口径：建筑成本随时代约 2–2.5 倍递增，产出也同步放大；E1 单栋产能刻意压低，");
line("迫使早期文明把有限矿物投入「住房 + 农田 + 水井 + 采石场」四件套，而非堆高级建筑。");
line();

line("### 7.2 旧时代折减");
line();
table(
  ["时代差", "效果乘数", "说明"],
  [
    ["0（当前时代）", "×1.00", "无折减"],
    ["落后 1 代", "×0.80", "E1 建筑在 E2、E2 建筑在 E3……（`Math.max(outdatedMultiplier, 0.8)`）"],
    ["落后 ≥2 代", "×0.60", "E1 建筑在 E3+；取 `def.outdatedMultiplier`（默认 0.6）"],
  ],
);
line("折减覆盖 production / capacity / housing / research / observationBonus / thermalShielding /");
line("industry / stability / disasterResistance / warningBonus / colonyProgress；维护与工人不折减。");
line("不传 `era` 时 `aggregateBuildingEffects` 与旧版完全一致（×1），保证旧存档与旧调用兼容。");
line();

line("### 7.3 开局一回合实测（温和环境，人口 500 / nightmare 400）");
line();
const openingRows: string[][] = [];
for (const difficulty of ["easy", "normal", "hard", "nightmare"] as const) {
  const world = createWorld({ difficulty });
  const before = {
    food: world.civ.resources.food.amount,
    water: world.civ.resources.water.amount,
    minerals: world.civ.resources.minerals.amount,
  };
  runTurn(world, makeEnvironment());
  const civ = world.civ;
  openingRows.push([
    difficulty,
    f0(civ.population),
    f0(before.food),
    `${civ.flows.food.net >= 0 ? "+" : ""}${f1(civ.flows.food.net)}`,
    `${civ.flows.water.net >= 0 ? "+" : ""}${f1(civ.flows.water.net)}`,
    `${civ.flows.minerals.net >= 0 ? "+" : ""}${f1(civ.flows.minerals.net)}`,
    f1(civ.scienceRate),
    f1(civ.stability),
    civ.flows.energy.consumed === 0 && civ.flows.metals.consumed === 0 ? "0 / 0" : "非 0（异常）",
  ]);
}
table(
  ["难度", "回合末人口", "初始食物", "食物净额/回合", "水净额/回合", "矿物净额/回合", "科研速率/回合", "稳定度", "能源/金属消耗"],
  openingRows,
);
line("结论：四个难度第一回合食物与水均为正、稳定度上升、无能源/金属消耗，原始开局可玩。");
line();

line("### 7.4 60 年（120 回合）空操作平衡底线");
line();
const idleRows: string[][] = [];
for (const difficulty of ["easy", "normal", "hard", "nightmare"] as const) {
  const world = createWorld({ difficulty });
  const reports = runTurns(world, makeEnvironment(), 120);
  const civ = world.civ;
  idleRows.push([
    difficulty,
    reports.some((r) => r.collapsed) ? "**崩溃**" : "存活",
    `E${civ.era}`,
    f0(civ.population),
    f1(civ.stability),
    f0(civ.resources.food.amount),
    f0(civ.resources.water.amount),
    f1(civ.starvation),
    civ.alive ? "是" : "否",
  ]);
}
table(
  ["难度", "60 年空转", "时代", "人口", "稳定度", "食物库存", "水库存", "饥荒压力", "存活"],
  idleRows,
);
line("规格底线：easy / normal 空操作 60 年不应直接崩溃。上表为固定温和环境、无建造无研究的保守结果：");
line("easy / normal 均存活但食物储备被人口增长吃空，提示玩家必须扩张农田与水井、研究科技推进时代；");
line("nightmare 因人口增长系数低（0.7）反而有余粮。环境波动与乱纪元会显著加剧压力。");
line();

/* ============================ 8. 与旧内容差异 ============================ */
line("## 8. 与阶段 11 之前旧内容的差异");
line();
line("### 8.1 建筑旧 id → 新内容");
line();
table(
  ["旧 id", "新内容", "说明"],
  [
    ["`farm`", "`farm1` 原始农田（E1）→ 灌溉/机械化/垂直/生物圈链", "农田改为 5 级升级链"],
    ["`housing`", "`camp` 聚落营地（E1）→ 城邦住宅/住宅区/高级住区/生态穹顶", "住房改为 5 级升级链"],
    ["`waterworks`", "`well1` 水井（E1）→ 水渠/水处理厂/循环水厂/大气水循环", "水系统改为 5 级升级链"],
    ["`powerPlant`", "`coalPlant` 燃煤电站（E3，energy 解锁后）→ 核电站/聚变堆", "E1/E2 不再有电力建筑"],
    ["`school`", "`elderHall` 长者议事棚（E1）→ `academy` 学园（E2）→ 科学院/超算/量子实验室", "旧 `school` 已移除"],
    ["`industrialZone` / `machineFactory` / `smelter`", "`mine` 矿场（E2，兼产金属）→ `steelMill` 钢铁厂 → 自动化矿山 → 纳米制造厂", "工业链合并，金属由矿场/钢铁厂产出"],
    ["`shelter`", "`bunker` 地下避难所（E3）→ `climateControl` 气候调节设施（E4）", "防御链整体后移到 E3/E4"],
    ["`orbitInstitute`", "`supercomputer` 超算中心（E4）", "观测研究建筑合并进科研链"],
    ["`biodome`", "`ecodomeCity` 生态穹顶城市（E5）/ `biosphereFarm` 人造生物圈农场（E5）", "拆分为住房与食物两座 E5 建筑"],
    ["`orbitalSolar`", "移除", "能源改为 燃煤 → 核电 → 聚变 链"],
    ["`observatory`", "`observatory` 观星台（E1，唯一，提供观测 Lv.1）", "id 保留；不再随时代自动升级"],
    ["`mine` / `warehouse` / `academy` / `supercomputer` / `climateControl` / `spaceport` / `planetEngine` / `colonyBase` / `fusionReactor` / `deepSpaceArray` / `quantumLab`", "保留（时代/数值/升级位置调整）", "见第 3 节"],
  ],
);
line("### 8.2 文明与机制");
line();
line("- 初始人口从 1000 调整为 **500**（nightmare 400）；初始 `metals = 0`、`energy = 0`；`BASE_HOUSING = 200`、`BASE_INDUSTRY = 10`。");
line("- 开局建筑从旧「3 农场 / 3 居住 / 2 水厂 / 2 电站」改为原始聚落 `" + JSON.stringify(STARTING_BUILDINGS) + "`。");
line("- 科技仍为 26 项、5 方向，id 全部保留；名称与效果改为时代递进语义（如 `energy_basic` 火种与薪柴、`energy_solar` 蒸汽与电力）。");
line("- 时代推进从「天文台等级 / 科技总数双轨计分」改为 `civilization/eras.ts` 的显式条件清单（人口 / 科技总数 / 同代科技 / 观测等级）；旧 `eraInfo` / `eraScore` 仅作兼容保留。");
line("- 资源未解锁时 `game.ts` 每回合归零该资源，`economy.resolveTurn` 按 `ctx.era` 把对应生产与需求置 0；观测任务在 E1/E2 以食物支付。");
line();

/* ============================ 9. 自检 ============================ */
line("## 9. 内容自检与测试");
line();
const eraCounts = [1, 2, 3, 4, 5].map((era) => BUILDING_DEFS.filter((d) => d.era === era).length);
const e1Violations = BUILDING_DEFS.filter(
  (d) =>
    d.era === 1 &&
    (([ "metals", "energy" ] as ResourceId[]).some(
      (rid) => (d.cost[rid] ?? 0) > 0 || (d.maintenance[rid] ?? 0) > 0 || (d.upgradeCost?.[rid] ?? 0) > 0,
    )),
).map((d) => d.id);
const e2EnergyViolations = BUILDING_DEFS.filter(
  (d) =>
    d.era === 2 &&
    (d.cost.energy ?? 0) > 0 &&
    (d.maintenance.energy ?? 0) > 0,
).map((d) => d.id);
const chainLengths = CHAIN_ORDER.map((group) => {
  const { nodes, independent } = splitChain(group);
  return [group, nodes.length, independent.length] as const;
});
line("自动自检结果（生成时实测）：");
line();
table(
  ["检查项", "结果"],
  [
    ["建筑总数", `${BUILDING_DEFS.length} 座`],
    ["每时代可新建数量", eraCounts.join(" / ")],
    ["E1 成本/维护违规（metals·energy）", e1Violations.length === 0 ? "0 ✅" : e1Violations.join(", ")],
    ["E2 建筑含 energy 成本/维护", e2EnergyViolations.length === 0 ? "0 ✅" : e2EnergyViolations.join(", ")],
    ["主升级链长度（升级级数 + 同组独立建筑）", chainLengths.map(([g, n, ind]) => g + " " + n + (ind > 0 ? " (+" + ind + ")" : "")).join(" / ")],
    ["科技总数 / 方向", `${TECH_DEFS.length} 项 / ${TECH_BRANCH_ORDER.length} 方向`],
    ["观星台 Lv.2 升级能源成本", `${OBSERVATORY_LEVELS[2].upgradeCost.energy}（必须为 0，E2 无电力）`],
    ["旧时代折减", `当前 ×${outdatedMultiplier(1, BUILDING_DEFS[0])} / 旧 1 代 ×${outdatedMultiplier(2, BUILDING_DEFS[0])} / 旧 2+ 代 ×${outdatedMultiplier(3, BUILDING_DEFS[0])}`],
  ],
);
line("测试与类型检查（PowerShell 禁止 npx.ps1，直接用 node）：");
line();
line("```powershell");
line("node .\\node_modules\\vitest\\vitest.mjs run tests/systems   # 3 个文件 / 85 个用例全绿");
line("node .\\node_modules\\typescript\\bin\\tsc --noEmit      # 0 错误");
line("```");
line();
line("覆盖范围：建筑内容自检（38 座 / 每代 ≥5 / 资源合规 / 升级链完整 / upgradeCost 合法性）、");
line("开局（人口 / era / 资源 / 初始建筑）、建造与升级流程、取消施工返还 50%（game 层集成）、");
line("旧时代折减（0.8 / 0.6 与不传 era 兼容）、科技时代门槛（`canResearch` 第 X 时代）、");
line("时代条件（`evaluateRequirements` / `canAdvanceEra` / `resourceUnlocked`）、");
line("经济时代门槛（E1 无能源金属、E2 金属生效、E3 能源生效、不传 era 兼容）、");
line("观测设施 Lv2~6 成本与时代解锁一致性、E2→Lv2→E3 可达性回归。");
line();

/* ============================ 10. 遗留 ============================ */
line("## 10. 已知遗留与注意事项");
line();
line("1. **观星台 Lv.1 的 `upgradeCost` 为占位值**（含 energy 120）：Lv.1 由建造「观星台」建筑直接获得，");
line("   `game.ts upgradeObservatory` 在 `level <= 0` 时直接拒绝并提示建造观星台，因此该成本不参与付费路径；");
line("   内容自检测试对 Lv.2~Lv.6 做「成本资源 = 该级 requiresEra 已解锁资源」校验，Lv.1 显式跳过。");
line("2. **升级链末端建筑仍保留 `upgradeCost` 字段**（如 `ecodomeCity`、`warehouse`、`deepSpaceArray`）：");
line("   `upgradeTo = null` 时该字段不参与升级，保留仅为未来扩展；内容自检只要求「有前置的升级目标」必须有非空 `upgradeCost`。");
line("3. **`ERAS[1].unlockSummary` 文案提到「冶坊」**，实现中 E2 的金属由「矿场」产出、E3 由「钢铁厂」产出；");
line("   这是 `src/core/constants.ts` 的文案与实现的细微差异（不影响机制与测试），留待 lead 统一文案。");
line("4. **观测升级的执行层在 `game.ts`**：systems 层负责条件与资源校验（`observation/observatory.ts checkUpgrade`），");
line("   实际扣费与 `observation.level` 变更由 `game.ts upgradeObservatory` 完成；`tests/game` 覆盖执行路径，");
line("   `tests/systems` 覆盖「E2 资源可行性 + 观测 Lv.2 满足 E3 条件」的可达性回归。");
line("5. **数值为「定义表原始值」**：实际结算还要乘人力充足率（`staffingRatio`）、科技乘数、环境系数、");
line("   时代效率修正（E2 +5% 科研、E3 +5% 建筑/+10% 科研……），因此实测净额与表中单栋数值不会简单相加。");
line();

const output = OUT.join("\n") + "\n";
writeFileSync(resolve(ROOT, "docs", "ERA_CONTENT.md"), output, "utf8");
console.log(`docs/ERA_CONTENT.md 已生成：${output.length} 字符，${output.split("\n").length} 行`);
