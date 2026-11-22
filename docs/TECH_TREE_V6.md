# 科技树 v1.6（六时代 · 9 分支 · 192 项）

> 实现文件：`src/technology/tree.ts`（数据）、`src/technology/system.ts`（规则）、
> `src/ui/modal-research.ts` + `src/ui/research-v6.css`（树状图 UI）。
> 存档兼容：v1.3 的 72 个科技 id **全部保留**，仅重排 `tier` / 前置 / 成本；旧存档已研究项不需要重写。

## 1. 分支与数量

| 分支 id | 中文名 | 数量 |
| --- | --- | --- |
| astronomy | 天文学 | 21 |
| energy | 能源学 | 21 |
| industry | 工业学 | 21 |
| biology | 生物学 | 21 |
| space | 航天学 | 21 |
| computing | 计算科学 | 21 |
| society | 社会与政治 | 22 |
| social | 社会科学 | 22 |
| military | 防务工程 | 22 |
| **合计** | | **192** |

- 每支 ≥ 20 项，且每个时代每支 ≥ 2 项；tier 即「可研究时代」1..6。
- 每项科技含：id、中文名、branch、school（6 大学说之一）、tier、cost、description、effectSummary、
  effectsDetail（≥2 条）、requires（同支低 tier 前置 + 允许少量跨支前置）、effects。
- 社会科学（social）覆盖：政治学、经济学、社会学、法学、心理学、人类学、管理学、传播学、人口学、
  伦理学、教育学、城市学、国际关系、公共政策、行为科学与组织理论。

## 2. 时代与成本

| tier | 时代 | 单科技成本 | 科技数 |
| --- | --- | --- | --- |
| 1 | E1 原始部落 | 40 | 20 |
| 2 | E2 农业城邦 | 120 | 25 |
| 3 | E3 蒸汽纪元 | 320 | 24 |
| 4 | E4 电气纪元 | 720 | 35 |
| 5 | E5 信息与早期航天 | 1600 | 42 |
| 6 | E6 星际文明 | 3200 | 46 |

时代语义硬约束（由 `tests/systems/technology.test.ts` 与 `tests/systems/tech-v6.test.ts` 校验）：

- E3 蒸汽：允许蒸汽动力、铁路、机械计算；**禁止电力、内燃机、无线电、电子计算机、卫星、空间站、核能**。
- E4 电气：允许电力网络、无线电、早期计算机、核裂变；**禁止卫星、空间站、核聚变**。
- 卫星 / 火箭 / 空间站 / 星际殖民 / 深空雷达自 **E5** 起出现；聚变工程 ≥ E5。
- 旧 id 重命名仅 3 处（语义纠错）：`energy_solar` 蒸汽与电力→蒸汽动力（E3）、
  `comp_mechanism` 机械计算机→差分机与机械计算（E3）、`energy_fusion` 核能工程→聚变工程（E5）。

## 3. 天文台链

| 观测等级 | 科技 | tier | requiresEra |
| --- | --- | --- | --- |
| Lv.1 基础观测站 | astro_basic | 1 | 1 |
| Lv.2 专业天文台 | astro_distance | 2 | 2 |
| Lv.3 高级观测中心 | astro_orbit | 3 | 3 |
| Lv.4 轨道动力学研究所 | astro_threebody | 5 | 5 |
| Lv.5 行星科学与深空观测中心 | astro_chaos | 5 | 5 |
| Lv.6 超级天文观测网络 | astro_supernet | 6 | 6 |

## 4. 互斥教义（7 组）

同组同 tier、只能采纳一项；教义科技不作为其他科技的硬前置。

| 组 id | 主题 | tier | 选项 |
| --- | --- | --- | --- |
| doctrine_energy | 能源路线 | 4 | 燃煤扩张 / 核能集中 / 太阳阵列 |
| doctrine_defense | 防御哲学 | 3 | 要塞化 / 机动防御 |
| doctrine_life | 生命方向 | 5 | 定向基因改造 / 生态共生 |
| doctrine_compute | 算力形态 | 5 | 集中式超算 / 分布式网络 |
| doctrine_society | 社会契约 | 5 | 技术官僚制 / 军功秩序 / 公社自治 |
| doctrine_governance | 治理取向 | 5 | 管理学 / 伦理学 / 公共政策 |
| doctrine_stellar | 文明出路 | 6 | 长夜守望 / 轨道工业带 / 方舟计划 |

## 5. v1.6 科研政策

### 5.1 发展纲领（natural / engineering / social）

- E3 起在科研面板选择 **1 个或 2 个**研究大类作为重点（`TechState.developmentCategories` 持久化）。
- 已选大类研究速度 **+10%**；未选大类 **-35%**（`DEVELOPMENT_FOCUS_BONUS / DEVELOPMENT_NEGLECT_PENALTY`）。
- 大类映射：自然科学 = 天文/生物/能源；工程应用 = 工业/航天/计算/防务；社会科学 = 社会/社会科学。

### 5.2 科研资源倾斜（0–100%）

- 保存在 `TechState.researchFunding`（默认 50%）。
- 研究速度：0% → ×0.60（约 -40%），50% → ×1.00，100% → ×1.35（约 +35%）。
- 科研点产出：0% → ×0.75，100% → ×1.30。
- 非科研资源产出：0% → ×1.10，100% → ×0.90（用产出换速度）。
- 面板提供 range 滑块，实时显示当前研究速度与非科研产出倍率。

### 5.3 注入资源加速

- 消耗矿物 / 金属 / 能源（按时代解锁情况组合），立即给当前项目增加 **20% 剩余进度**。
- 价格随同一项目使用次数递增（每次 ×(1 + 0.75×已用次数)），**每回合限一次**（`lastBoostTurn`）。
- 面板显示本次增加量与具体资源消耗，按钮实时反映是否可用及原因。

## 6. 与建筑的关系

- **科学院建筑群**（`academyComplex1..5`，E2→E6，tier 1..5，独立于学园/超算）每级提供
  全文明研究速度 **+8% / +16% / +24% / +32% / +40%** 与逐级科研产出（20/46/90/160/260），
  升级需要资源与科技前置（comp_archive → industry_alloys → comp_electronic → comp_network → comp_ai）。
- 既有科研主链：长者议事棚(E1) → 学园(E2) → 科学院(E3) → 电气研究院(E4) → 超算中心(E5) → 量子实验室(E6)。
