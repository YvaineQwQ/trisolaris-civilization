# POLITICS — 政治系统 v3（六部门 / 五派系 / 关系网 / 政治资本）

> 写入范围：src/politics/**、tests/systems/politics.test.ts、docs/POLITICS.md
> 冻结规格：docs/EXPANSION_V3.md §3；类型来自 src/core/types.ts（lead 维护），本模块不修改核心类型。
> 所有数值有限、clamp 到合法区间；随机全部来自本模块 seeded RNG，模拟层不使用 Math.random()。

---

## 0. 目录与依赖

    src/politics/
      definitions.ts  6 部门 / 5 派系 / 16 特质 / 姓名池 / 关系与满意度标签 / 数值配置 / 文案模板
      random.ts       独立 Mulberry32 RNG、状态派生随机源、部长与候选人生成、关系初值
      system.ts       状态机：初始化 / 清洗 / 任免 / 调解 / 峰会 / 回合结算 / 丑闻野心 / 展示查询
      index.ts        统一出口
    tests/systems/politics.test.ts   30 个用例
    docs/POLITICS.md                 本文件

依赖方向（无循环）：core/types + core/math ← politics；politics 不 import economy / game / ui。

---

## 1. 六部门（DepartmentId）

每部门一名部长，可空缺。部长能力决定部门效率；部门效率换算成 global 乘数交给 lead。

| id | 名称 | 短名 | 图标 id | 职责 | 效率流向 |
| --- | --- | --- | --- | --- | --- |
| administration | 行政总署 | 行政 | governance | 户籍、税赋、供销与政令 | 政治资本收入、全局稳定度 |
| science | 科学院 | 科研 | science | 观测数据转工程图纸 | researchMultiplier（科研速度） |
| industry | 工业委员会 | 工业 | industry | 钢铁、能源、建造工期 | industryMultiplier（产能/工期） |
| agriculture | 农业署 | 农业 | agriculture | 粮仓、灌溉、种子库 | agricultureMultiplier（食物产出） |
| defense | 防务委员会 | 防务 | defense | 灾害应对、避难所、疏散 | defenseMultiplier（灾害抗性/人口损失） |
| observation | 观星台联署 | 观测 | observation | 观测效率与轨道预测 | observationMultiplier（观测/预测） |

导出：DEPARTMENT_ORDER、DEPARTMENT_DEFS、DEPARTMENT_LIST、departmentName()、departmentShort()、isDepartmentId()。

---

## 2. 五派系（FactionId）

每名部长属于 1 到 2 个派系（首位倾向本部门偏好派系，约 45% 身兼第二派系）。

| id | 名称 | 短名 | 颜色 | 偏好部门 | 初始影响力权重 |
| --- | --- | --- | --- | --- | --- |
| technocrats | 技术官僚 | 技官 | #3f6f9e | administration / science | 22 |
| militarists | 军功集团 | 军功 | #9e4a3f | defense / administration | 20 |
| agrarians | 农业公社 | 农社 | #6f8f3e | agriculture | 18 |
| industrialists | 工业联合会 | 工联 | #b07a2e | industry | 21 |
| scholars | 观星者学会 | 观星 | #6b5b9e | observation / science | 19 |

派系状态：influence（影响力 0..100，五派合计恒为 100）、satisfaction（满意度 0..100）。
派系亲疏矩阵 FACTION_AFFINITY：技术官僚与观星者 +10、军功与工联 +8、农社与工联 -8、技官与军功 -8 等。

---

## 3. 部长属性与特质

### 3.1 六维属性（全部 clamp）

| 字段 | 区间 | 含义 | 作用 |
| --- | --- | --- | --- |
| competence | 1..10 | 业务能力 | 部门效率主项（0.7 + 0.06 × 有效能力） |
| loyalty | 0..100 | 对联合政府的忠诚 | 罢免反弹（忠诚越高冲击越大）、派系满意度目标 |
| integrity | 0..100 | 廉洁 | 丑闻概率、行政稳定度、性格冲突 |
| ambition | 0..100 | 野心 | 丑闻/野心事件概率、性格冲突、影响力扩张 |
| age | 31..68 | 年龄 | 人物画像 |
| factions | 1..2 个派系 | 政治归属 | 部门派系支持、关系初值/漂移 |
| traits | 2 个特质 | 行事风格 | 部门效率、资本、稳定、丑闻风险、关系漂移 |
| portraitSeed | 正整数 | 头像种子 | UI 生成圆形肖像 |

### 3.2 十六种特质（MINISTER_TRAITS）

| id | 名称 | 倾向 | 效果摘要 |
| --- | --- | --- | --- |
| incorruptible | 铁面无私 | good | 廉洁 +15，丑闻 -4%，稳定 +0.15 |
| calculator | 算无遗策 | good | 有效能力 +1，科研 +4% |
| steady_hand | 沉稳持重 | good | 忠诚 +10，稳定 +0.2，关系漂移 +0.3 |
| coalition_builder | 合纵连横 | good | 资本 +0.5/回合，关系漂移 +0.6，派系满意度 +1 |
| visionary | 远见者 | good | 观测 +5%，科研 +3%，野心 +10 |
| frugal | 克己奉公 | good | 资本 +0.3/回合，廉洁 +8，稳定 +0.1 |
| corrupt | 贪墨之徒 | bad | 廉洁 -20，丑闻 +8%，资本 +0.4/回合 |
| iron_fist | 铁腕野心 | bad | 野心 +20，防务 +4%，关系 -0.6，稳定 -0.2 |
| aloof | 孤高寡合 | bad | 关系 -0.8，科研 +3%，忠诚 -5 |
| paranoid | 猜忌多疑 | bad | 关系 -0.5，稳定 -0.15，忠诚 -5，观测 +2% |
| populist | 民粹煽动 | mixed | 派系满意度 +2，稳定 -0.1，资本 +0.2/回合 |
| gambler | 豪赌 | mixed | 科研 +5%，工业 +4%，丑闻 +5% |
| paper_bureaucrat | 文案官僚 | mixed | 资本 +0.4/回合，工业 -3%，科研 -2% |
| martial | 尚武 | mixed | 防务 +5%，农业 -2%，关系 -0.2 |
| agronomist | 惜农 | mixed | 农业 +5%，工业 -2%，派系满意度 +1 |
| stargazer | 望星成癖 | mixed | 观测 +6%，科研 +2%，忠诚 -3 |

特质效果结构 TraitEffect：competence / loyalty / integrity / ambition / capitalRate / research / industry / agriculture / observation / defense / stability / scandalRisk / network / factionSatisfaction。

---

## 4. 关系系统

### 4.1 数据结构

PoliticsState.relations 是 Record<string, number>，键为两名部长 id 的字典序拼接：

    relationKey("m-3", "m-7") === "m-3|m-7"

值 -100..100，整数。关系只覆盖在任部长；卸任部长的键会被清理，补位时重新初始化。

### 4.2 五档标签（relationLabel）

| 区间 | 标签 | tone | viewTypes 对应 |
| --- | --- | --- | --- |
| >= 60 | 亲密 | intimate | intimate |
| 25..59 | 友好 | friendly | friendly |
| -24..24 | 中立 | neutral | neutral |
| -59..-25 | 冷淡 | cold | cold |
| <= -60 | 敌对 | hostile | hostile |

### 4.3 关系怎么变化

- 初始值 = 自然目标 + 种子扰动（±14），clamp -100..100。
- 自然目标 naturalRelationTarget：派系亲疏均值 × 0.8 + 共享派系 × 6 - 双野心 > 65 时 8 - 廉洁差 > 50 时 5 + 双忠诚 > 70 时 4 + 双方 network 特质 × 4。
- 每回合自然漂移：

      current += (target - current) * 0.1 - current * 0.015

  极端值因此缓慢回归，结构性同盟/对立长期存在。
- 调解：+8..15（seeded）。峰会：全部在任对 +2。
- 事件系统可通过 shiftRelation / shiftDepartmentRelation 写入。

### 4.4 关系如何影响部门

对某个部长，逐对计算关系系数：

| 关系 | 系数 |
| --- | --- |
| >= 25 | +2% 起步，线性升至 +5%（关系 100） |
| -24..24 | 0 |
| <= -25 | -2% 起步，线性降至 -5%（关系 -100） |

所有对求和后 clamp 到 ±8%，作为该部门的「关系协同」修正。

---

## 5. 政治资本

| 项目 | 数值 | 实现 |
| --- | --- | --- |
| 开局资本 | 20..30 | createPoliticsState 用种子决定 |
| 资本上下限 | 0..200 | 所有写入 clamp |
| 每回合收入 | 2..6 | 见公式 |
| 任命 | 10 | appointMinister |
| 罢免 | 14 | dismissMinister |
| 调解 | 8 | mediateMinisters |
| 峰会 | 24 | holdSummit，冷却 8 回合 |

收入公式（基准部分）：

    rate = 2 + 0.22 × 行政部长有效能力 + (五派平均满意度 - 50) × 0.02 + 全体资本类特质之和
    rate = clamp(rate, 2, 6)

回合内再叠加文明稳定度：

    turnRate = clamp(rate + (civ.stability - 50) × 0.015, 2, 6)

政治资本收入由 politicsTurn 直接写入 state.capital，并返回 capitalGain（触顶时可能为 0）。
显示口径：state.capitalRate 每回合更新为当回合实际收入率。

---

## 6. 部门效率与生产乘数

效率聚合（computeEfficiency，clamp 0.7..1.3）：

    空缺部门：0.70
    在任部门：0.70 + 0.06 × 有效能力 + 关系协同(±8%) + 派系支持(-3%..+6%) + 特质加成(±8%)

- 有效能力 = clamp(competence + 特质能力修正, 1, 10)。
- 派系支持：部长所属派系把该部门列为偏好领域时每派 +2%（上限 +4%）；其派系最高满意度 >= 65 再 +2%，< 30 则 -3%。
- 特质加成：科研/工业/农业/防务/观测各有对应特质字段，合计 clamp ±8%；行政总署无效率特质（资本类特质直接进收入公式）。
- efficiencyLabel：>=1.2 卓越 / >=1.08 高效 / >=0.96 正常 / >=0.86 迟滞 / 其余低效；空缺显示「空缺」。
- warning：空缺、效率 < 0.88、高野心低廉洁、忠诚 < 35、三个以上部门空缺时给出中文提示。

部门效率 -> 乘数映射（departmentModifiers 同时返回）：

| 乘数 | 来源部门 | lead 用法建议 |
| --- | --- | --- |
| researchMultiplier | science | 乘到科研速度 / 科研建筑产出 |
| industryMultiplier | industry | 乘到工业产能 / 建造工期 |
| agricultureMultiplier | agriculture | 乘到食物产出 |
| observationMultiplier | observation | 乘到观测效率 / 预测精度 |
| defenseMultiplier | defense | 灾害抗性 / 人口损失减免（乘到抗性项） |

administration 效率不单独出乘数，它通过 politicsStabilityImpact 与资本收入影响全局。

---

## 7. 稳定度影响

politicsStabilityImpact(state) 返回每回合稳定度修正（-3..3，正数 = 提升稳定度）。
lead 应取负后注入 economy 的 crisis.stabilityPenalty（该字段为正 = 惩罚）：stabilityPenalty = -politicsStabilityImpact。

确定性分项（求和后 clamp ±3）：

| 分项 | 公式 | 量级 |
| --- | --- | --- |
| 派系心情 | (五派平均满意度 - 50) / 50 × 1.6 | ±1.6 |
| 行政质量 | (行政有效能力 - 5.5) × 0.06 + (行政廉洁 - 50) × 0.004 | 约 ±0.4 |
| 部长特质 | 全体 traits.stability 之和，clamp ±1 | ±1 |
| 关系网络 | 每对友好 +0.15，每对敌对 -0.35，clamp ±1 | ±1 |
| 部门空缺 | 每部门 -0.35，下限 -2 | 0..-2 |
| 影响力失衡 | 某派 > 45 时 -0.3；> 55 时 -0.6 | -0.6..0 |
| 低满意度派系 | 每派 < 30 时 -0.25，下限 -0.75 | -0.75..0 |

罢免的即时冲击（不入回合修正，由 lead 单独结算）：

    stabilityImpact = -(4 + loyalty / 100 × 4)     // -4..-8，保留 1 位小数

丑闻/野心事件的额外惩罚：单起事件最多 -3.5，合计上限 5。
因此 politicsTurn 的 stabilityDelta：无事件时严格在 -3..3；有事件时下限放宽到 -6，避免死亡螺旋。

---

## 8. 回合结算 politicsTurn(state, civ, year, turn)

签名：

    politicsTurn(
      state: PoliticsState,
      civ: PoliticsCivilContext | null | undefined,   // 只需 stability；CivilizationState 结构兼容
      year: number,
      turn: number,
    ): PoliticsTurnEffects

返回：

    interface PoliticsTurnEffects {
      stabilityDelta: number;          // -6..3（无事件时 -3..3）
      researchMultiplier: number;      // 0.7..1.3
      industryMultiplier: number;
      agricultureMultiplier: number;
      observationMultiplier: number;
      defenseMultiplier: number;
      capitalGain: number;             // 本回合实际到账资本（0..6）
      logs: { kind, message, severity }[];
    }

执行顺序：

1. sanitizePoliticsState（幂等，保证脏存档/事件乱改之后仍安全）。
2. 候选人：turn 为 3 的倍数时刷新（淘汰至多 2 名低能力候选、补入新面孔）；其余回合仍保证空缺部门有候选人。
3. 关系自然漂移（updateRelations）。
4. 派系：影响力向 20 漂移 5%/回合并归一化到 100；满意度向结构目标漂移 25%/回合；每 4 回合输出低满意度/影响力失衡警告日志。
5. 计算确定性稳定度 baseStability（clamp ±3）。
6. 丑闻/野心事件：每回合至多 1 起。
7. 资本收入：capitalRateForTurn 后写入 state.capital，返回 capitalGain。
8. 汇总 stabilityDelta、五项乘数、日志；日志同时写入 state.history（上限 160 条）。

---

## 9. 丑闻与野心事件

### 9.1 丑闻

概率（每名在任部长，按部门顺序检查）：

    lowIntegrity = clamp((70 - integrity) / 70, 0, 1)
    highAmbition = clamp((ambition - 50) / 50, 0, 1)
    chance = 0.002 + lowIntegrity × 0.08 + highAmbition × 0.04 + 特质 scandalRisk
    chance = clamp(chance, 0, 0.30)

后果：稳定度 -1.5..-3.5、政治资本 -3..-6、该部长廉洁 -2/忠诚 -3、其派系满意度 -5，并写 critical 日志。

### 9.2 野心事件

仅当 ambition >= 65：

    chance = (ambition - 65) / 35 × 0.06 + 敌对关系数(<= -35) × 0.02
    chance = clamp(chance, 0, 0.20)

后果：稳定度 -1..-2.2、其派系影响力 +2、与最敌对部长关系 -8、其余派系满意度 -2，并写 warning 日志。

每回合最多 1 起事件；事件稳定度惩罚合计上限 5，回合总修正下限 -6。

---

## 10. 候选人池

- 初始 5 名；池上限 8，目标 5。
- 每 3 回合刷新：淘汰至多 2 名「部门已满」的低能力候选，补入 2 名新候选（新候选倾向空缺点位），再保证每个空缺部门至少 1 名候选人。
- 候选人字段与在任部长相同（department 为目标部门，appointedYear = 0）。
- 姓名池 24 姓 × 32 名 = 768 组合，生成时去重（在任 + 候选）；id 由 state.nextId 递增分配。
- 所有随机来自 seeded RNG：同一 seed + 同一操作序列 -> 完全可复现。

---

## 11. 动作 API

所有写操作入口先 sanitize，返回结构统一：

    interface PoliticsActionResult {
      ok: boolean;
      reason: string | null;   // 失败原因（中文，可直接写日志）
      logs: PoliticsLogEntry[]; // 已写入 state.history 的日志
    }

### 11.1 appointMinister(state, candidateId, year, turn)

- 成功：扣 10 资本；候选人移出池；部长就位（appointedYear = year）；与其余部长初始化关系；其派系满意度 +4、影响力 +3；写 appoint/success 日志。
- 失败原因：候选人不存在、部门已有在任部长、政治资本不足。

### 11.2 dismissMinister(state, departmentId, year, turn)

- 返回 PoliticsDismissResult（多一个 stabilityImpact：-4..-8，失败为 0）。
- 成功：扣 14 资本；部门空缺；清理该部长的关系键；其派系满意度 -12、影响力 -2，其余派系满意度 +2；生成 critical 日志；立即补候选。
- lead 需要把 stabilityImpact 立即注入文明稳定度（或并入下一回合 crisis 惩罚）。

### 11.3 mediateMinisters(state, a, b, turn)

- 需两个不同部门且都有部长；扣 8 资本；关系 +8..15（seeded）；双方派系满意度各 +1；写 mediate/success 日志（含数值与标签）。
- 失败：未知部门、同部门、任一方空缺、资本不足。

### 11.4 holdSummit(state, turn)

- 扣 24 资本；lastSummitTurn = turn；全体派系满意度 +8..12（每派 ±1 波动）；全部在任关系 +2；写 faction/success 日志。
- 冷却 8 回合；冷却内失败并提示剩余回合；资本不足也失败。
- 初始 lastSummitTurn = -999（首次峰会随时可开）。

### 11.5 可用性查询

- canAppoint(state, candidateId)、canDismiss(state, departmentId)、canMediate(state, a, b)、canHoldSummit(state, turn) -> { ok, reason }。
- politicsActionAvailability(state, turn) -> { appointCost, dismissCost, mediateCost, summitCost, canSummit, cooldownTurns }，直接对应 PoliticsView.actions。

---

## 12. 展示数据 API（供 lead 组装 PoliticsView）

| PoliticsView 字段 | 数据来源 |
| --- | --- |
| capital / capitalRate | state.capital / state.capitalRate |
| departments[] | departmentModifiers(state).departments（id/name/short/icon/description/efficiency/efficiencyLabel/warning/modifiers 一一对应） |
| departments[].minister | 由 lead 用 state.ministers[dept] + ministerSummary + MINISTER_TRAIT_MAP + FACTION_DEFS 组装 MinisterView |
| factions[] | state.factions + FACTION_DEFS + factionSatisfactionLabel + factionMembers |
| relations[] | 六部门两两：departmentRelationInfo(state, a, b) 返回 score/label/tone；名字由 DEPARTMENT_DEFS 提供 |
| candidates[] | state.candidates + ministerSummary + 特质/派系定义 |
| stabilityImpact / Label | politicsStabilityImpact(state) / politicsStabilityImpactLabel(value) |
| actions | politicsActionAvailability(state, turn) |
| lastSummitTurn | state.lastSummitTurn |
| history | state.history |
| summary / tone | politicsSummary(state) |
| minister.summary | ministerSummary(minister) |

辅助函数：ministerSummary(m)、politicsSummary(state)、efficiencyLabel(eff, hasMinister)、factionSatisfactionLabel(sat)、relationLabel(score)、relationInfo(score)、departmentEfficiency(state, dept)、computeCapitalRate(state)。

---

## 13. 事件系统 / 科技 / lead 的集成钩子

事件系统（src/events）需要的政治写入接口均已提供：

    changeCapital(state, delta): number              // clamp 0..200，返回实际变化
    shiftRelation(state, aId, bId, delta): number    // 部长 id
    shiftDepartmentRelation(state, a, b, delta)      // 部门 id（任一方空缺静默忽略）
    adjustFactionSatisfaction(state, faction, delta): number
    pushPoliticsLog(state, {kind,message,severity}, year, turn)
    getRelation / relationsBetween / departmentRelation / departmentRelationInfo
    factionInfluence / factionSatisfaction / factionMembers / servingMinisters / vacantDepartments

EventEffects 映射建议：
- effects.capital -> changeCapital(state.politics, effects.capital)
- effects.relation {a,b,delta} -> shiftDepartmentRelation
- effects.stability 由 lead 走 crisis 或 civ.stability；政治模块不再重复扣。

科技效果（TechEffects 的政治字段）建议 lead 在回合结算时叠加：
- politicalCapital -> changeCapital(state.politics, politicalCapital)
- departmentBoost -> 在 departmentModifiers 结果上逐部门叠乘（政治模块不感知科技，保持单向依赖）
- stabilityBonus -> 直接并入 crisis.stabilityPenalty 或 civ.stability 修正。

---

## 14. lead 集成步骤（game.ts / view.ts / save）

### 14.1 初始化 / 读档

    // 新游戏
    state.politics = createPoliticsState(seed);
    // 读档：旧档无 politics 字段
    if (!state.politics) state.politics = createPoliticsState(state.meta.seed);
    sanitizePoliticsState(state.politics);   // 幂等；兼容旧字段/脏数据

### 14.2 回合结算（在 economy.resolveTurn 前组装 crisis）

    const pol = politicsTurn(state.politics, state.civ, year, turn);
    // 注意：capitalGain 已写入 state.politics.capital，不要重复加
    crisis.stabilityPenalty -= pol.stabilityDelta;          // 正 delta = 加成 -> 负惩罚
    buildingEffects.research *= pol.researchMultiplier;     // 或乘到科技/建筑聚合之后
    buildingEffects.industry *= pol.industryMultiplier;
    buildingEffects.agriculture *= pol.agricultureMultiplier;
    buildingEffects.observation *= pol.observationMultiplier;
    buildingEffects.disasterResistance *= pol.defenseMultiplier; // 防御效率作为抗性倍率
    for (const log of pol.logs) this.addLog("politics", log.severity, log.message);

### 14.3 玩家动作（GameActions 四个新动作）

    appointMinister(state.politics, candidateId, year, turn);
    dismissMinister(state.politics, departmentId, year, turn);   // 若 ok：civ.stability = clamp(civ.stability + stabilityImpact, 0, 100)
    mediateMinisters(state.politics, a, b, turn);
    holdSummit(state.politics, turn);
    // 统一：ok ? addLog(success) : addLog(warning, reason)；并把返回 logs 逐条写入游戏日志

四个动作都返回 { ok, reason, logs }，可以直接映射成游戏日志（LogEntry.category = "politics"）。

### 14.4 存档

PoliticsState 是纯 JSON 结构（数字/字符串/数组/普通对象），可直接随 GameState 序列化，无需额外迁移；
读档后调用一次 sanitizePoliticsState 即可。随机数状态不在存档里——由「状态派生随机源」保证读档后继续推进与未读档一致。

---

## 15. 数值总表（POLITICS_CONFIG）

| 键 | 值 | 说明 |
| --- | --- | --- |
| capitalMin / capitalMax | 0 / 200 | 资本硬边界 |
| startingCapitalMin / Max | 20 / 30 | 开局资本 |
| capitalRateMin / Max | 2 / 6 | 每回合收入 |
| appointCost / dismissCost | 10 / 14 | 任免成本 |
| mediateCost / summitCost | 8 / 24 | 调解 / 峰会 |
| summitCooldownTurns | 8 | 峰会冷却 |
| candidateRefreshInterval | 3 | 候选刷新 |
| candidatePoolMin / Target / Max | 4 / 5 / 8 | 候选池 |
| initialCandidateCount | 5 | 初始候选 |
| minMinisterTraits / max | 2 / 2 | 特质数量 |
| competenceMin / Max | 1 / 10 | 能力 |
| loyaltyMin / Max | 0 / 100 | 忠诚 |
| integrityMin / Max | 0 / 100 | 廉洁 |
| ambitionMin / Max | 0 / 100 | 野心 |
| ageMin / Max | 31 / 68 | 年龄 |
| relationMin / Max | -100 / 100 | 关系 |
| relationDriftRate | 0.1 | 每回合关系向自然目标靠拢比例 |
| relationZeroPull | 0.015 | 每回合关系向 0 回归比例 |
| mediateGainMin / Max | 8 / 15 | 调解增益 |
| friendlyRelation / hostileRelation | 25 / -25 | 协同/敌对阈值 |
| influenceWarningThreshold | 45 | 影响力失衡警告 |
| influenceBalanceTarget | 20 | 影响力均衡目标 |
| satisfactionDriftRate | 0.25 | 满意度趋近速度 |
| lowSatisfaction / highSatisfaction | 30 / 65 | 满意度阈值 |
| summitSatisfactionMin / Max | 8 / 12 | 峰会满意度增益 |
| stabilityTurnMin / Max | -3 / 3 | 回合稳定度上限 |
| dismissalStabilityMin / Max | -8 / -4 | 罢免冲击 |
| scandalStabilityCap | 5 | 事件惩罚上限 |
| maxIncidentsPerTurn | 1 | 每回合事件数 |
| efficiencyMin / Max | 0.7 / 1.3 | 部门效率 |
| historyLimit | 160 | 政治日志上限 |

---

## 16. 测试覆盖（tests/systems/politics.test.ts，30 用例）

- 初始化：部门/部长/派系/候选/资本/关系数量与区间；内容表完整性；16 特质；配置口径。
- 派系：每部长 1-2 派系、影响力合计 100、满意度区间；人物属性区间。
- 候选：池容量、姓名唯一、部门合法、刷新每 3 回合、空缺补员。
- 任命：成功链路（资本/就位/关系/日志）与三类失败（不存在/已占/资本不足）。
- 罢免：冲击 -4..-8、关系清理、派系反弹、失败路径。
- 关系：五档边界、键字典序、对称性、自然回归（-100/100 双向）、调解 8..15。
- 峰会：成本、满意度上升、冷却拒绝、冷却结束可再开。
- 资本：0..200 硬边界、收入 2..6、20 回合不越界。
- 部门修正：6 部门效率 0.7..1.3、五项乘数区间、能力高低对比、空缺 0.70 + warning。
- 稳定度：politicsStabilityImpact 恒在 -3..3；5 档中文评价；罢免冲击区间。
- 回合结算：PoliticsTurnEffects 字段齐全、资本到账、日志格式、200 回合数值有限、事件惩罚上限。
- 丑闻/野心：概率随低廉洁高野心上升；强制触发后写日志且稳定度不低于 -6。
- 容错：空部长、脏数据（NaN/Infinity/非法 id）、非法动作、sanitize 幂等。
- seed 复现：同 seed 初始状态与 12 回合操作序列完全一致。
- 存档往返：JSON 序列化/反序列化后继续 7 回合，与未读档状态逐字节一致（无隐藏 RNG 状态）。
- 展示与集成钩子：ministerSummary 稳定且含特质、politicsSummary 色调、动作可用性、事件钩子 clamp。

运行：

    node .\node_modules\vitest\vitest.mjs run tests/systems/politics.test.ts

结果：29 passed。

---

## 17. 已知缺口 / 后续可扩展

1. 科技 TechEffects.departmentBoost / politicalCapital 未在政治模块内消费——按分层约定由 lead 在回合结算时叠加，保持 politics 单向依赖。
2. 候选人生成不考虑文明时代/难度，后续可按 era 调整候选能力分布（接口已预留 generateMinister 的 rng 入口）。
3. 关系矩阵只覆盖在任部长；卸任部长的历史关系不留档（如需「旧部网络」可作为后续内容）。
4. 派系影响力采用「五派合计恒为 100」的归一化口径；若未来需要更强失衡（例如单派 >60）需调整 renormalizeInfluence。
5. 政治事件目前只有丑闻/野心两类，事件系统（src/events）的 politics 类别事件通过日志与钩子联动，未做事件链专属判定。
6. UI 组件（六部门卡片 / 派系条 / 关系矩阵 / 长文本）由 ui-core 按 viewTypes.ts 契约消费本模块数据，本模块不提供 DOM。
