# 观测系统 API（src/observation）—— 三体纪元 · 三维科学观测

> 面向游戏循环 / UI 集成者（lead）与后续维护者。
> 观测系统是**玩家知识**的唯一来源：UI 与渲染只能看到观测估计、玩家模型与预测，永远不能读真实物理状态。

## 1. 文件职责

| 文件 | 职责 | 是否读真实 PhysicsState |
| --- | --- | --- |
| observatory.ts | 天文台等级能力表、任务目录 TASK_CATALOG、buildTaskOptions、checkUpgrade | 否 |
| measurements.ts | **唯一**把真实物理状态转成带噪测量的模块（三维独立噪声 + 每次任务的三维系统偏差） | **是（仅生成测量）** |
| estimator.ts | 由测量重建星/母星估计（测量融合 + 短弧拟合 + 质量融合 + 瞬时轨道要素） | 否 |
| geometry.ts | 三维几何工具：轨道要素（含相对 X-Z 面的倾角）、质心、集合离散度、轨迹平面倾角 | 否 |
| model.ts | 玩家三体动力学模型：构建 / 推演 / 观测轨迹 / 残差与"预测模型失效" | 否（残差只用 physics.timeYears 作时钟） |
| prediction.ts | 三维蒙特卡洛预测集成、可靠度、最近接近、3D 几何信息 | 否 |
| discovery.ts | 科学发现检测与去重（只由观测数据 / 估计 / 残差触发） | 否 |
| observation.ts | **游戏循环唯一入口**：编排任务、采样、模型同步、回合结算、预测刷新 | 仅经由 measurements.ts 间接读 |
| index.ts | 统一导出（游戏循环 / UI 只从这里 import） | — |

三维坐标系与核心层一致：**X = 水平，Y = 垂直高度，Z = 深度**；2D 主视图为 X-Z 俯视投影，
Y 以高度提示呈现；3D 辅助视图使用完整 Vec3。观测系统所有位置 / 速度 / 测量 / 模型 / 预测样本都是 Vec3。

## 2. 快速集成：游戏循环调用顺序

```ts
import {
  createObservationState, performNakedEyeCalibration,
  sampleTick, syncObservation, finishTurns,
  canStartObservation, startObservation, cancelObservation,
  refreshPrediction, observationTaskViewData, predictionViewData, buildObservationLogSummary,
  markModelDirty, resetPrediction, currentSkyPositions,
  type ObservationContext,
} from "../observation";

// ---- 0) 新游戏：创建状态 + 开局肉眼校准（一次） ----
const obs = createObservationState(seed + "|obs-v1", 0);
const ctx: ObservationContext = {
  level: 1,                     // 天文台等级 0..6（升级后直接改这里）
  difficultyNoise: preset.observationNoise,
  techObservationMultiplier: 0, // 科技加成（0.2 = +20% 精度）
  techPredictionMultiplier: 0,  // 科技加成（预测窗口 × (1+x)）
  efficiency: env.weather === "clear" ? 1 : 0.8, // 天气/效率，0.25..1.6
  weather: env.weather,
  time: physics.timeYears,
  turn: civ.turn,
};
performNakedEyeCalibration(obs, physics, env, ctx); // 只写 obs；重复调用幂等

// ---- 1) 每个物理步（同一帧内物理推进后调用一次） ----
// 建议每帧调用一次，dtYears = 本帧推进的模拟年数。
// 若一帧内做了多步物理子步，建议在每个子步后调用（测量时间分辨率 0.05 年）。
sampleTick(obs, physics, env, dtYears, ctx);      // 有任务时采集测量（内部按 0.05 年/批补采）
syncObservation(obs, physics, env, dtYears, ctx); // 无任务时推进玩家模型与观测轨迹

// ---- 2) 每个文明回合结束（回合结算时调用一次） ----
const { completed, logs, discovery } = finishTurns(obs, physics, env, 1, ctx);
// completed = 本回合有任务完成；logs 追加进 GameLog（category: observation | milestone）
// discovery = 本回合首条新发现的标题（没有则 null；全部发现见 obs.discoveries）
// 注意：即使没有任务也建议每回合调用（模型残差判定 / 被动同步）。

// ---- 3) 玩家点击「开始观测」 ----
//   a. 先给 UI 生成按钮数据（能源不足 / 等级不足的原因由这里给出）
const options = buildTaskOptions({ level: ctx.level, energy: resources.energy.amount, taskActive: obs.activeTask !== null });
//   b. 实际开始：
const check = canStartObservation(obs, ctx.level, resources.energy.amount, kind);
if (check.ok) {
  const res = startObservation(obs, physics, ctx.level, kind, target, physics.timeYears, resources.energy.amount);
  if (res.ok) resources.energy.amount -= res.task!.energyCost; // 能源由调用方扣除
}
// 取消（能源退还由调用方决定）：cancelObservation(obs)

// ---- 4) 玩家点击「刷新预测」 ----
const bundle = refreshPrediction(obs, ctx); // 结果缓存在 obs.prediction；返回 null = 条件不足
// 预测只有在 level>=3 且玩家模型有效时可用；模型失效（modelDirty）后必须重新完成观测。

// ---- 5) UI 组装辅助（可选，减少 lead 的重复代码） ----
const taskView = observationTaskViewData(obs);   // ObservationTaskView | null
const predView = predictionViewData(obs);        // PredictionView（含 reliableYears / endpoint / 最近接近）
const summary = buildObservationLogSummary(obs); // { headline, lines[] } 中文摘要，可放 HUD / 日志
const sky = currentSkyPositions(obs);            // 玩家模型给出的"当前天空"位置（Vec3[]）
```

### 存档 / 读档
- 全部持久状态都在 ObservationState 内（measurements、estimates、playerModel、prediction、discoveries、observedTrail……），
  观测模块**没有任何模块级可变状态**，直接 structuredClone 随存档序列化即可恢复。
- 测量 / 发现 / 轨迹都有限额（见 §7），不会让存档无限膨胀。
- 随机性全部来自 Rng(seedBase | 任务/样本标识)，同 seed + 同时间线可复现。

## 3. 公开 API 摘要

### 3.1 编排器（observation.ts）

```ts
export interface ObservationContext {
  level: number;                      // 天文台等级 0..6
  difficultyNoise: number;            // DIFFICULTIES[k].observationNoise
  techObservationMultiplier: number;  // 观测科技加成
  techPredictionMultiplier: number;   // 预测科技加成
  efficiency: number;                 // 观测效率（天气/建筑），建议 0.25..1.6
  weather: WeatherKind;               // 当前天气（env.weather 优先）
  time: number;                       // 当前模拟年
  turn: number;                       // 当前文明回合
}

createObservationState(seedBase: string, now: number): ObservationState
performNakedEyeCalibration(obs, physics, env, ctx): void
startObservation(obs, physics, level, kind, target, now, energyAvailable):
  { ok: boolean; reason?: string; task?: ObservationTask }
sampleTick(obs, physics, env, dtYears, ctx): void
syncObservation(obs, physics, env, dtYears, ctx): void
finishTurns(obs, physics, env, turnsElapsed, ctx):
  { completed: boolean;
    logs: { category: "observation" | "milestone";
            severity: "info" | "success" | "warning";
            message: string }[];
    discovery: string | null }
refreshPrediction(obs, ctx): PredictionBundle | null   // 返回值为便利，也可按 void 调用
markModelDirty(obs): void
resetPrediction(obs): void
canStartObservation(obs, level, energyAvailable, kind?):
  { ok; reason; energyCost; turnsRequired; meta }
cancelObservation(obs): ObservationTask | null
observationTaskViewData(obs): ObservationTaskView | null
predictionViewData(obs): PredictionView
buildObservationLogSummary(obs): { headline: string; lines: string[] }
targetLabel(target: StarTarget): string
starTargetsForTask(kind, target): StarId[]
currentSkyPositions(obs): { id: StarId; pos: Vec3 }[]
```

行为约定：
- startObservation 只**校验**能源并返回 task.energyCost，不扣能源；sessionBias 由确定性 RNG 生成。
- 任务时长 = turnsRequired × TURN_YEARS（0.5 年/回合）；
  turnsRequired = OBSERVATORY_LEVELS[level].taskTurns + TASK_CATALOG[kind].extraTurns。
- sampleTick 内部按 0.05 模拟年一批采集（一个回合 10 批）；即使一帧 dtYears 较大（例如直接调用 0.5）
  也会自动补采（单次最多 64 批）。
- finishTurns 会先做旧模型残差判定，再推进任务进度；任务完成时重建估计 / 母星估计 / 玩家模型、
  写 ObservationRecord、检测科学发现。
- markModelDirty：强制模型失效（例如天文台升级后要求重新标定）；resetPrediction：只清预测缓存。

### 3.2 测量（measurements.ts）

```ts
noiseModel(level, ctx): { positionSigmaAt1AU; velocitySigma; massSigmaFraction; tempSigma }
sampleStarMeasurements(physics, ctx, session, timeYears): StarMeasurement[]
samplePlanetMeasurement(physics, ctx, session, timeYears): PlanetMeasurement
sampleNakedEyeMeasurements(physics, seedBase, timeYears): { stars; planet }
```

- 噪声三轴**独立**高斯：pos/vel 各有 X/Y/Z 独立噪声；每次观测任务有一个 sessionBias: Vec3（σ 为单位），
  任务内所有样本共享，不会通过平均消除（不同任务之间才会平均掉）。
- 位置 posSigma 随"观测者（母星）到恒星距离"放大（distance^0.65）。
- >=3 级仪器额外直接测量速度（多普勒）与质量；低等级没有。
- 温度不是这里测的：编排器从 env.surfaceTempC 加噪后填入 PlanetMeasurement.tempC。

### 3.3 估计器（estimator.ts）

```ts
recomputeEstimates(inputs: EstimateInputs): Record<StarId, StarEstimate>
computePlanetEstimate(measurements, previous, level, tempC, tempSigma, habitability,
                      knownOrbit, time?, starEstimates?): PlanetEstimate | null
fit3D(samples: {t; pos: Vec3; sigma}[], refTime?, maxOrder?): Fit3D | null
fitCoord(samples: {t; x; sigma}[], refTime?, maxOrder?): CoordFit | null
```

估计策略（重要，与早期版本不同）：
- **瞬时状态用测量融合，不用全基线多项式**。三体系统中的紧密双星周期可能 < 1 年，而观测任务基线 0.5~1.5 年。
  对全基线做二次拟合会把轨道运动"抹平"，得到位置与速度互相矛盾的状态，玩家模型会在几个回合内自我瓦解。
  因此：
  - 位置 = 最新一批测量（三维），误差 ≈ 该批测量的 posSigma；
  - 速度 = >=3 级**最新一次**多普勒测量（快速轨道上速度方向变化太快，多批矢量平均会人为缩小速度）；
  - 质量 = 全部实测质量的加权平均，并以 1 太阳质量弱先验收缩（**绝不读真实质量**）；
  - 轨道要素（eccentricity / inclinationRad）= 由融合后的瞬时状态 + 估计质心质量做瞬时二体反演
    （osculating elements），是"此刻若只有这两体"的轨道，不等于长期轨道；
  - height = pos.y；inclinationRad 为轨道面相对 **X-Z 参考面**的倾角（参考面法向 +Y，0 = 位于参考面内）。
- fit3D / fitCoord 保留为加权二次最小二乘工具（短弧速度推导、趋势分析、单元测试），
  阶数自适应：短弧线性、长弧二次，带协方差外推与窗口外惩罚。
- 置信度由精度、观测弧长、样本数、是否有速度综合；肉眼校准置信度固定约 0.1。

### 3.4 玩家模型（model.ts）

```ts
buildPlayerModel(obs, level, now): PlayerModel | null
propagateModel(model, dtYears, softening?): void
cloneModel(model): PlayerModel
modelPredictedStarPositions(model): { id; pos: Vec3 }[]
appendObservedTrail(obs, model, intervalYears?): void
appendMeasurementTrails(obs, starMeasurements, planetMeasurement): void
computeResiduals(obs, physics): ResidualReport
modelOrbitGeometry(model): { stars: ModelOrbitInfo[]; planet: { inclinationRad; heightAU } | null }
```

- 建模条件：level >= 3 且三颗恒星都 known.position && known.velocity；否则 null。
- 模型初值只来自 obs.stars 估计；质量未知时用 1 太阳质量先验（note 里会说明）。
- propagateModel 只推进模型自身；恒星用物理层 stepSimpleBodies，母星（若 known）用
  testParticleAcceleration 做测试粒子速度 Verlet。内部步长上限 0.005 年（长 dt 自动细分，最多 400 步）。
- computeResiduals：把模型克隆并推进到 physics.timeYears，与**最近 0.2 年内**的最新实测位置比较；
  偏差超过 max(5σ, 0.02 + 0.01 × 模型年龄) 判定"预测模型失效"：写 Discovery、obs.modelDirty = true、
  model.valid = false、清空 obs.prediction。刚重建的模型需要 3 倍阈值才会被判失效（防自证）。
  没有新鲜测量时（例如长时间不观测）不判定——模型不会被"过期数据"冤枉。
- 观测轨迹 obs.observedTrail 的含义是**玩家推断出来的轨迹**：无模型时只有实际测量点；
  有模型时在每个 0.02 年（TRAIL_INTERVAL）追加模型推演位置，上限 MAX_TRAIL_RENDER_POINTS = 900。
- 模型有效时，syncObservation / sampleTick 会用模型推演位置更新玩家"当前天空"的 StarEstimate.pos/vel
  （这是玩家内部推演，不消耗能源，也不代表真实位置）。

### 3.5 预测（prediction.ts）

```ts
computePrediction(obs, level, techPredictionMultiplier, now): PredictionBundle | null
computeStarReliableYears(bundle): Partial<Record<StarId, number>>
computeClosestApproach(bundle): ClosestApproachReport
computePredictionGeometry(bundle): PredictionGeometry
```

- 输入：玩家模型（不是真实状态）。内部先克隆模型并推进到 now，再从"现在"开始集成。
- horizon = min(140, OBSERVATORY_LEVELS[level].predictionHorizon × (1 + techPredictionMultiplier))。
- 集合成员数 members = 6 + 2 × level（上限 18）；成员 0 为不扰动名义解。
- 初始扰动：每星 pos ± sigmaPos、vel ± sigmaVel、mass ± sigmaMass（三轴独立高斯）；
  母星若已知：位置用 obs.planet.sigmaPos 扰动，速度扰动用 clamp(0.5 × sigmaPos, 1e-3, 0.2) 近似
  （PlanetEstimate 没有 sigmaVel 字段）。
- 积分：stepSimpleBodies（+ 母星测试粒子），步数 clamp(ceil(horizon / 0.04), 140, 720)，单成员最多 900 步；
  母星按 stride 4 大步推进（母星轨道远慢于恒星）。
- 输出样本：30 个时间切片（含 t=0 与 t=horizon），每切片含各星均值位置与集合标准差 sigma
  （三维坐标方差合成：sqrt((varX + varY + varZ) / 3)）、母星均值/sigma、agreement。
- agreement = clamp01(1 - maxSigma / threshold)，threshold = 0.25 AU + 3% × 到质心平均距离。
- reliableFraction = 集合离散度**首次**超过 threshold 之前的时长占比；diverged = reliableFraction < 0.5。
- **性能优化**：一旦明确发散（首个超阈值切片之后再推演 2.5 倍时间），剩余窗口不再积分，
  用最后两个样本的 sigma 指数增长率外推填充（位置冻结、agreement = 0）；reliableFraction 不受影响。
- note 用中文说明混沌敏感性 / 不确定性增长 / 可靠窗口。
- computeClosestApproach：预测窗口内 恒星→质心（三星几何中心近似）、恒星→母星、母星→最近恒星的
  最近距离与年份，供 UI 与灾害预警使用。
- computePredictionGeometry：每星可靠时长、轨迹平面倾角（相对 X-Z 面）、当前/最低/最高高度、
  平均到质心距离；母星同理。供 2D 高度提示与 Three.js 3D 视图使用。
- 缓存：refreshPrediction 把结果放进 obs.prediction；同一时间点重复调用复用缓存（按钮触发时重算）。

### 3.6 科学发现（discovery.ts）

```ts
addDiscovery(obs, candidate, year): Discovery | null
hasDiscovery(obs, key): boolean
detectDiscoveries(obs, level, year): Discovery[]
recordChaosSensitivity(obs, year, reliableFraction, agreement, horizonYears): Discovery | null
MAX_DISCOVERIES = 40
```

触发来源（全部只依赖观测数据 / 估计值 / 模型残差，**不读真实状态**）：

| 发现 | 触发条件 | 证据形式 |
| --- | --- | --- |
| 紧密双星构型 | 两颗已测恒星估计间距 < 0.55 AU 且样本足够 | 三维间距 + 样本数 + 年份 |
| 高偏心率轨道 | L4+，轨道解 e 在 (0.72, 0.995) | e 值 + 样本数 |
| 倾斜轨道结构 | L4+，任一星轨道倾角 > 15 度 | 每星倾角 + 高度 |
| 恒星近距离掠过母星 | 星-母星测量三维距离 < 0.75 AU | 距离 + 年份 + 恒星 |
| 极端气候信号 | 至少 5 次测温，摆幅 > 55 摄氏度 或 越过 -85/75 摄氏度 | 测温序列统计 |
| 潜在宜居带 | 母星测温 -10~42 摄氏度，L2+，至少 3 次测温 | 温度 + 位置精度 |
| 母星轨道漂移 | 母星测量轨迹径向漂移 > 18%，跨度至少 1.5 年 | 首末距离 |
| 恒星逃逸迹象 | L3+，估计到质心距离 > 16 AU | 距离 + 速度 |
| 异常高速恒星 | 最快星速度 > 其余中位数 × 2.6 | 速度对比 |
| 预测模型失效 | 模型残差 > 5σ 阈值（见 3.4） | 偏差 / sigma / 阈值 |
| 混沌敏感性确认 | 预测集成 diverged（刷新预测时写入） | reliableFraction / agreement / horizon |

- 去重按 title；evidence 内含 [key:类型] 便于程序化查询；最多保留最近 40 条。

## 4. 模型假设与简化（务必了解）

1. **观测坐标系**：系统质心参考系（与物理层一致）。观测者在母星上，但测量值统一换算到系统坐标系
   （游戏简化；真实天文需要视差/光行时解算，这里用"测距"抽象代替）。
2. **系统偏差**：每个观测任务抽一次三维 sessionBias（单位 sigma），任务内所有样本共享；不同任务之间独立。
   因此单次任务的估计误差 ≈ sigma 量级，多次任务会逐步平均掉偏差。
3. **质量测量简化**：>=3 级直接测得质量（实测噪声 + 弱 1 太阳质量先验），**从不读取真实质量**。
   动力学质量反演（开普勒第三定律）没有建模；玩家模型的质量不确定度来自实测 sigmaMass。
4. **速度测量简化**：>=3 级多普勒测量单次 sigma 由等级表给出；快速轨道上只取**最新一次**测量，
   不做多批平均（否则会把轨道运动平均掉）。低等级速度未知、玩家模型无法建立。
5. **瞬时状态 vs 长期轨道**：估计器给出的是"当前时刻"状态；eccentricity / inclinationRad 是由该状态反演的
   **瞬时二体轨道要素**。对三体系统它只是近似，会随观测更新而变化，**不是**长期不变的轨道。
6. **预测不是真实未来**：预测只从玩家模型出发，初值不确定度按测量 sigma 传播。三体系统对初值指数敏感，
   预测的有效性由 reliableFraction 表达；这是物理限制，不是实现缺陷。
7. **母星轨道**：母星速度来自最近窗口的位置轨迹线性拟合（母星轨道慢，短线可用）；PlanetEstimate 没有
   sigmaVel 字段，预测集成对母星速度扰动做了启发式近似（见 3.5）。
8. **最近接近**：用三星**等权几何中心**近似质心、用集合均值轨迹近似真实轨迹；只用于 UI 提示与灾害预警，
   不作为物理真值。
9. **残差判定的时效性**：只有最近 0.2 年内有新鲜测量时才判定模型失效。长时间不观测不会把模型判死，
   但玩家"当前天空"会随模型推演而漂移——这正是"失去观测能力"的体验。
10. **观测轨迹**：observedTrail 混合了"实测点 + 模型推演点"，渲染层可统一画成实线（玩家认知轨迹），
    UI 若需要区分，可对比 measurements 时间戳。

## 5. 性能

单次预测集成（含母星，18 成员，混沌夹具实测，Node 20）：

| 等级 | 窗口（tech = 0.15） | 实测耗时（3 次，含冷启动） |
| --- | --- | --- |
| L3 | 约 10.3 年 | 36 / 13 / 10 ms |
| L4 | 约 27.6 年 | 16 / 17 / 12 ms |
| L5 | 约 63.2 年 | 4 / 4 / 9 ms（发散早停） |
| L6 | 约 126.5 年 | 3 / 8 / 3 ms（发散早停） |

- 早停 + 不确定度外推把"长窗口混沌预测"压到毫秒级；最坏情况（系统一直不发散）约 720 步 × 18 成员 ≈ 80 ms。
- 上表在混沌夹具上测得；稳定星系若长期不发散会走满步数，耗时约为 50-80 ms（仍低于交互阻塞阈值，且只在按钮/每 2 年自动刷新时调用）。
- 建议 lead 在按钮点击 / 回合结算时调用 refreshPrediction，不要每帧调用；obs.prediction 即缓存。
- sampleTick / syncObservation 每帧开销很小（一次模型子步 + 偶尔追加轨迹点），可放心每帧调用。
- 测试中的性能断言放宽到 500ms（防止 CI 抖动），实际交互体验为几十毫秒。

## 6. 测试

```bash
npx vitest run tests/observation
```

- tests/observation/fixtures.ts：确定性三维层级三体夹具 + 按回合推进物理/观测的辅助函数。
- isolation.test.ts：数据隔离（估计不等于真值、篡改真实物理不影响模型推演）、肉眼校准、等级误差显著下降。
- observation.test.ts：等级能力、任务进度（逐回合）、轨迹、发现去重、开始/取消/校验、状态工厂幂等。
- model.test.ts：建模条件、模型推演、三维几何、残差触发"预测模型失效"、轨迹上限。
- prediction.test.ts：窗口公式、样本结构、不确定度增长、reliableFraction / diverged 自洽、确定性、
  最近接近、3D 几何、缓存与模型失效、性能。

当前结果：4 个测试文件、21 个用例全部通过；`npx tsc --noEmit` 全仓库 0 错误。

## 7. 限额与已知缺口

限额（防止存档膨胀）：恒星测量 480 条、母星测量 240 条、观测历史 120 条、任务历史 40 条、
发现 40 条、观测轨迹 900 点（每星）/ 900 点（母星）。

已知缺口 / 后续可扩展：
1. 预测在早停之后的样本用指数 sigma 外推填充（位置冻结），适合 UI 表达"不可信"，但不再是物理轨迹。
2. 母星速度不确定度没有独立 sigma 字段（PlanetEstimate 受核心类型限制），预测集成用启发式近似。
3. 轨道要素是瞬时反演；真正的多体轨道族 / 长期共振分析未实现。
4. 观测轨迹混合"实测点 + 模型推演点"，渲染时不做区分（可后续在 UI 上分虚实线）。
5. 科学发现只在任务完成时检测（+ 刷新预测时的混沌敏感性），不做每帧检测（性能考虑）。
6. 观测等级升级后已测数据的精度不会追溯重算（历史测量保留当时的 sigma），符合"当时仪器精度"的设定。
7. distanceFromBarycenter / orbitRadius 依赖估计质心（质量未知时用先验），低等级时数值偏粗。
8. 若游戏循环按"整回合"而不是"每物理步"调用 sampleTick，测量会集中在回合末尾，
   估计仍可用（位置取最新一批），但速度/轨道趋势质量下降；推荐按物理步调用。
