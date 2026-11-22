# 科技树 v3（8 分支 · 72 科技 · 6 学说 · 6 组互斥教义）

> 本文档由 `src/technology/tree.ts` 的定义表与 `tests/systems/technology.test.ts` 的校验规则共同约束，表格部分由 `artifacts/tmp` 下的临时生成脚本产出（脚本已删除，数据源以代码为准）。
>
> 对应规格：`docs/EXPANSION_V3.md` §1。对应代码：`src/technology/tree.ts`（内容）、`src/technology/system.ts`（逻辑）。

## 1. 总览

| 项目 | 数值 |
| --- | --- |
| 科技总数 | 72 项（8 分支 × 9 项） |
| 分支 | astronomy（天文学）/ energy（能源学）/ industry（工业学）/ biology（生物学）/ space（航天学）/ computing（计算科学）/ society（社会与政治）/ military（防务工程） |
| 时代层级 | tier 1..5，tier 即「可研究的时代」 |
| 学说 | 6 派：observation / calculation / industrial / ecological / expansion / authority |
| 互斥教义组 | 6 组，共 15 项教义科技（每组 2–3 项，同组同 tier） |
| 旧 id | 全部保留：astro 六项链、space 五项链、energy/industry/bio 现有 15 项 |
| 成本曲线 | E1 40 · E2 105–120 · E3 280–340 · E4 800–880 · E5 1900–2000（每个 tier 内偏离该 tier 均值不超过 20%） |
| 效果幅度 | 单科技生产类 +3%~+8%，关键节点 +10%~+15%；观测/预测 +3%~+10%；事件风险 -2%~-8%；稳定度 +0.5~+2；政治资本 +0.2~+0.8/回合；部门增益 2%~6% |

**分布速查**

| 分支 | 天文学 | 能源学 | 工业学 | 生物学 | 航天学 | 计算科学 | 社会与政治 | 防务工程 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 科技数 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 |

| 时代 | 科技数 | 最低成本 | 平均成本 | 最高成本 | 偏离均值 |
| --- | --- | --- | --- | --- | --- |
| E1 | 8 项 | 40 | 40 | 40 | ±0% |
| E2 | 15 项 | 105 | 113 | 120 | ±7% |
| E3 | 18 项 | 280 | 311 | 340 | ±10% |
| E4 | 17 项 | 800 | 839 | 880 | ±5% |
| E5 | 14 项 | 1900 | 1929 | 2000 | ±4% |

| 指标 | 数值 |
| --- | --- |
| 各 tier 科技数 | E1: 8 · E2: 15 · E3: 18 · E4: 17 · E5: 14 |
| 各学说科技数 | 观测派: 9 · 演算派: 19 · 工业派: 12 · 生态派: 12 · 扩张派: 8 · 秩序派: 12 |
| 全部科技总成本 | 48885 科研点 |
| 教义科技 | 15 项 / 6 组 |
| 保留旧 id | 26 项（26 项 v1.2 科技全部保留，名称不变） |

## 2. 分支总表

| id | 名称 | 图标 | 科技数 | 定位 |
| --- | --- | --- | --- | --- |
| `astronomy` | 天文学 | `telescope` | 9 | 从结绳记日到深空观测网，把混乱的三颗太阳翻译成可预测的模型。天文台升级的唯一钥匙。 |
| `energy` | 能源学 | `bolt` | 9 | 火种、水车、蒸汽机、裂变与聚变，让文明在极端气候下始终握有动力。 |
| `industry` | 工业学 | `factory` | 9 | 石器、青铜、钢铁、精密机床与轨道工业，把矿物变成文明扩张的骨架。 |
| `biology` | 生物学 | `seedling` | 9 | 采集驯化、灌溉草药、现代医学、基因设计与闭合生态圈，让血肉之躯活下去。 |
| `space` | 航天学 | `spaceship` | 9 | 星象历法、几何测绘、星际殖民、火箭卫星与星际航行，为文明准备第二条生路。 |
| `computing` | 计算科学 | `cpu` | 9 | 从算筹到量子计算，用算法理解混沌，也用算法管理文明自己。 |
| `society` | 社会与政治 | `people` | 9 | 组织、制度与共识，决定文明能否在乱纪元中保持团结而不失去自由。 |
| `military` | 防务工程 | `shield` | 9 | 从烽燧到行星防御，应对灾害、敌意与末日，也回答社会愿意为安全付出多少。 |

## 3. 学说总表

6 大学说决定研究重心与精通加成：同派研究速度 +15%，跨派 -5%；每完成一项科技按 `tier × cost / 10` 累加该派精通点数，满精通（研究完该派全部科技）时该派效果 +10%。

| id | 名称 | 简称 | 科技数 | 满精通点数 | 颜色 | 主张 |
| --- | --- | --- | --- | --- | --- | --- |
| `observation` | 观测派 | 观测 | 9 | 2832 | #8ab4ff | 相信先看清再行动：把仪器、记录与可重复的测量当作文明唯一的锚。 |
| `calculation` | 演算派 | 演算 | 19 | 7616 | #7ee0c0 | 相信混沌可以被压缩成模型：计算、形式化与算法是比钢铁更可靠的工具。 |
| `industrial` | 工业派 | 工业 | 12 | 1150 | #c9a06b | 相信产能就是生存权：先把物质基础堆起来，再讨论星空与意义。 |
| `ecological` | 生态派 | 生态 | 12 | 2602 | #8fd16a | 相信文明必须与母星共生：可循环、可修复、可长期维持，才算活着。 |
| `expansion` | 扩张派 | 扩张 | 8 | 4078 | #b48cff | 相信出路在别处：把火种撒出去，任何单一星球的灾难都不再是终点。 |
| `authority` | 秩序派 | 秩序 | 12 | 2981 | #e8b35a | 相信团结高于自由：在乱纪元里，能执行的决定才是好决定。 |

## 4. 科技全表（按分支）

列说明：**学说** = 该科技所属学派；**tier** = 可研究的时代；**成本** = 所需科研点；**前置** = `requires`（全部满足）；**软前置** = `requiresAny`（任选其一满足）。

### 天文学（astronomy · 9 项）

从结绳记日到深空观测网，把混乱的三颗太阳翻译成可预测的模型。天文台升级的唯一钥匙。

| id | 名称 | 学说 | tier | 成本 | 前置 | 软前置 | 效果摘要 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `astro_basic` | 天象记录 | 观测派 | E1 | 40 | — | — | 观测精度 +6%；科研产出 +2%；解锁基础观测站（Lv.1） |
| `astro_distance` | 恒星测距 | 观测派 | E2 | 120 | `astro_basic` | — | 观测精度 +7%；科研产出 +2%；解锁专业天文台（Lv.2） |
| `astro_spectra` | 光谱分析 | 演算派 | E3 | 280 | `astro_distance` | — | 观测精度 +5%；科研产出 +4%；研究速度 +2% |
| `astro_orbit` | 轨道几何 | 观测派 | E3 | 320 | `astro_distance` | — | 观测精度 +8%；预测可信期 +8%；解锁高级天文观测中心（Lv.3） |
| `astro_gravwave` | 引力波测量 | 观测派 | E4 | 820 | `astro_orbit` | `astro_spectra` / `comp_mechanism` | 观测精度 +7%；预测可信期 +6% |
| `astro_threebody` | 三体问题求解 | 演算派 | E4 | 850 | `astro_orbit` | — | 观测精度 +8%；预测可信期 +10%；研究速度 +2%；解锁轨道动力学研究所（Lv.4） |
| `astro_chaos` | 混沌统计学 | 演算派 | E5 | 1900 | `astro_threebody` | — | 观测精度 +8%；预测可信期 +10%；解锁行星科学与深空观测中心（Lv.5） |
| `astro_watch` | 长夜守望 | 观测派 | E5 | 1900 | `astro_threebody` | — | 观测精度 +10%；预测可信期 +10%；稳定度 +1 |
| `astro_supernet` | 超空间观测网 | 观测派 | E5 | 2000 | `astro_chaos` | — | 观测精度 +10%；预测可信期 +12%；科研产出 +3%；解锁超级天文观测网络（Lv.6） |

### 能源学（energy · 9 项）

火种、水车、蒸汽机、裂变与聚变，让文明在极端气候下始终握有动力。

| id | 名称 | 学说 | tier | 成本 | 前置 | 软前置 | 效果摘要 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `energy_basic` | 火种与薪柴 | 工业派 | E1 | 40 | — | — | 食物产出 +5% |
| `energy_wind` | 风帆与季风 | 扩张派 | E2 | 105 | `energy_basic` | — | 科研产出 +3%；矿物产出 +3% |
| `energy_grid` | 水车与风车 | 工业派 | E2 | 120 | `energy_basic` | — | 工业产能 +4%；矿物产出 +4% |
| `energy_coal` | 燃煤扩张 | 工业派 | E3 | 300 | `energy_grid`、`industry_automation` | — | 能源产出 +10%；工业产能 +5%；稳定度 -0.5 |
| `energy_solar` | 蒸汽与电力 | 工业派 | E3 | 320 | `energy_grid` | — | 能源产出 +12%；工业产能 +3%；解锁燃煤电站等时代建筑 |
| `energy_solar_array` | 太阳阵列 | 生态派 | E3 | 320 | `energy_grid`、`industry_alloys` | — | 能源产出 +8%；农业产出 +2% |
| `energy_nuclear` | 核能集中 | 演算派 | E3 | 340 | `energy_grid`、`industry_alloys` | — | 能源产出 +12%；研究速度 +2% |
| `energy_fusion` | 核能工程 | 演算派 | E4 | 850 | `energy_solar` | — | 能源产出 +15%；研究速度 +2%；解锁核电站 |
| `energy_zero` | 受控聚变与零点能 | 演算派 | E5 | 1900 | `energy_fusion` | — | 能源产出 +15%；金属产出 +5% |

### 工业学（industry · 9 项）

石器、青铜、钢铁、精密机床与轨道工业，把矿物变成文明扩张的骨架。

| id | 名称 | 学说 | tier | 成本 | 前置 | 软前置 | 效果摘要 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `industry_basic` | 石器与木工 | 工业派 | E1 | 40 | — | — | 矿物产出 +6% |
| `industry_ceramics` | 陶土与玻璃 | 工业派 | E2 | 105 | `industry_basic` | — | 矿物产出 +4%；宜居度 +1% |
| `industry_automation` | 青铜与轮轴 | 工业派 | E2 | 120 | `industry_basic` | — | 工业产能 +4%；金属产出 +5% |
| `industry_chemistry` | 化学工业 | 生态派 | E3 | 300 | `industry_automation` | — | 农业产出 +5%；矿物产出 +3% |
| `industry_alloys` | 蒸汽机械与钢铁 | 工业派 | E3 | 320 | `industry_automation` | — | 工业产能 +8%；金属产出 +5%；解锁钢铁厂等建筑 |
| `industry_precision` | 精密仪器与机床 | 演算派 | E4 | 820 | `industry_alloys`、`comp_mechanism` | — | 工业产能 +6%；研究速度 +3% |
| `industry_megastructure` | 自动化与巨型工程 | 工业派 | E4 | 850 | `industry_alloys` | — | 工业产能 +12%；矿物产出 +5%；解锁自动化矿山 |
| `industry_orbital_belt` | 轨道工业带 | 扩张派 | E5 | 1900 | `industry_megastructure` | — | 工业产能 +10%；金属产出 +4% |
| `industry_quantum` | 纳米制造 | 演算派 | E5 | 1900 | `industry_megastructure` | — | 工业产能 +15%；金属产出 +6%；解锁量子实验室 |

### 生物学（biology · 9 项）

采集驯化、灌溉草药、现代医学、基因设计与闭合生态圈，让血肉之躯活下去。

| id | 名称 | 学说 | tier | 成本 | 前置 | 软前置 | 效果摘要 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `bio_basic` | 采集与驯化 | 生态派 | E1 | 40 | — | — | 农业产出 +8%；解锁灌溉农田 |
| `bio_preserve` | 发酵与储粮 | 生态派 | E2 | 105 | `bio_basic` | — | 农业产出 +3%；稳定度 +0.5 |
| `bio_medicine` | 灌溉与草药 | 生态派 | E2 | 120 | `bio_basic` | — | 人口容量 +4%；宜居度 +2%；农业产出 +3% |
| `bio_breeding` | 育种与杂交 | 演算派 | E3 | 300 | `bio_medicine` | — | 农业产出 +6%；科研产出 +2% |
| `bio_ecology` | 现代医学与生态工程 | 生态派 | E3 | 320 | `bio_medicine` | — | 宜居度 +4%；农业产出 +6%；解锁垂直农场 |
| `bio_symbiosis` | 生态共生 | 生态派 | E4 | 800 | `bio_ecology` | — | 农业产出 +6%；灾害抗性 +4%；稳定度 +0.5 |
| `bio_genetic` | 基因适应 | 生态派 | E4 | 850 | `bio_ecology` | — | 宜居度 +6%；人口容量 +5%；解锁生态穹顶城市 |
| `bio_gene_design` | 定向基因改造 | 演算派 | E4 | 880 | `bio_ecology` | — | 宜居度 +5%；人口容量 +5%；研究速度 +2% |
| `bio_biosphere` | 闭合生态圈 | 生态派 | E5 | 1900 | `bio_genetic` | — | 宜居度 +5%；农业产出 +8%；灾害抗性 +5%；解锁人造生物圈农场 |

### 航天学（space · 9 项）

星象历法、几何测绘、星际殖民、火箭卫星与星际航行，为文明准备第二条生路。

| id | 名称 | 学说 | tier | 成本 | 前置 | 软前置 | 效果摘要 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `space_basic` | 星象与历法 | 观测派 | E1 | 40 | — | — | 观测精度 +4% |
| `space_lifesupport` | 密闭生命维持 | 生态派 | E2 | 105 | `space_basic` | — | 人口容量 +3%；灾害抗性 +2% |
| `space_orbital` | 几何与测绘 | 演算派 | E2 | 120 | `space_basic` | — | 科研产出 +3%；工业产能 +3% |
| `space_station` | 空间站与在轨制造 | 工业派 | E3 | 300 | `space_orbital`、`energy_solar` | — | 科研产出 +3%；工业产能 +4% |
| `space_colony` | 星际殖民技术 | 扩张派 | E3 | 320 | `space_orbital` | — | 解锁星际殖民（可建造殖民基地）；工业产能 +2% |
| `space_ion` | 离子推进与燃料 | 演算派 | E4 | 820 | `space_colony`、`energy_fusion` | — | 工业产能 +4%；研究速度 +2% |
| `space_deep` | 火箭与卫星 | 工业派 | E4 | 850 | `space_colony` | — | 工业产能 +6%；金属产出 +5%；解锁卫星站、太空港 |
| `space_arkship` | 方舟计划 | 扩张派 | E5 | 1900 | `space_deep` | — | 人口容量 +6%；研究速度 +2% |
| `space_engine` | 星际航行与行星发动机 | 扩张派 | E5 | 2000 | `space_deep` | — | 解锁行星发动机；工业产能 +8% |

### 计算科学（computing · 9 项）

从算筹到量子计算，用算法理解混沌，也用算法管理文明自己。

| id | 名称 | 学说 | tier | 成本 | 前置 | 软前置 | 效果摘要 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `comp_abacus` | 算筹与结绳 | 演算派 | E1 | 40 | — | — | 科研产出 +3% |
| `comp_archive` | 活字与档案 | 秩序派 | E2 | 105 | `comp_abacus` | — | 研究速度 +2%；稳定度 +0.5；政治资本 +0.2/回合 |
| `comp_mechanism` | 机械计算机 | 演算派 | E2 | 120 | `comp_abacus` | — | 科研产出 +4%；研究速度 +2% |
| `comp_crypto` | 密码学与通信安全 | 秩序派 | E3 | 300 | `comp_archive` | — | 事件风险 -3%；政治资本 +0.3/回合；行政部门效率 +3% |
| `comp_electronic` | 真空管与电子计算机 | 演算派 | E3 | 320 | `comp_mechanism`、`energy_solar` | — | 科研产出 +5%；研究速度 +3% |
| `comp_distributed` | 分布式网络 | 秩序派 | E4 | 840 | `comp_crypto` | — | 事件风险 -5%；稳定度 +1；政治资本 +0.4/回合 |
| `comp_central` | 集中式超算 | 演算派 | E4 | 880 | `comp_electronic` | — | 科研产出 +6%；研究速度 +4% |
| `comp_quantum` | 量子计算 | 演算派 | E5 | 1900 | `comp_electronic` | — | 研究速度 +5%；观测精度 +4% |
| `comp_ai` | 通用人工智能 | 演算派 | E5 | 2000 | — | `comp_central` / `comp_distributed` | 科研产出 +8%；研究速度 +5% |

### 社会与政治（society · 9 项）

组织、制度与共识，决定文明能否在乱纪元中保持团结而不失去自由。

| id | 名称 | 学说 | tier | 成本 | 前置 | 软前置 | 效果摘要 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `society_tribe` | 部落议事 | 秩序派 | E1 | 40 | — | — | 稳定度 +1；政治资本 +0.2/回合 |
| `society_market` | 集市与货币 | 扩张派 | E2 | 105 | `society_tribe`、`industry_basic` | — | 矿物产出 +3%；科研产出 +2%；政治资本 +0.2/回合 |
| `society_law` | 成文法典 | 秩序派 | E2 | 120 | `society_tribe` | — | 稳定度 +1；政治资本 +0.3/回合；行政效率 +3% |
| `society_publicschool` | 公共教育与识字 | 观测派 | E3 | 300 | `society_law` | — | 研究速度 +4%；稳定度 +0.5 |
| `society_bureau` | 官僚与统计 | 秩序派 | E3 | 320 | `society_law` | — | 政治资本 +0.5/回合；研究速度 +2% |
| `society_commune` | 公社自治 | 生态派 | E4 | 800 | `society_publicschool` | — | 稳定度 +1；农业产出 +3%；事件风险 -3% |
| `society_military_order` | 军功秩序 | 秩序派 | E4 | 840 | `society_bureau` | — | 稳定度 +2；防务部门效率 +5%；灾害抗性 +2% |
| `society_technocracy` | 技术官僚制 | 演算派 | E4 | 880 | `society_bureau` | — | 研究速度 +5%；科研部门效率 +5%；稳定度 -0.5 |
| `society_cohesion` | 文明共识 | 秩序派 | E5 | 1900 | — | `society_technocracy` / `society_military_order` / `society_commune` | 稳定度 +1.5；事件风险 -5%；政治资本 +0.5/回合 |

### 防务工程（military · 9 项）

从烽燧到行星防御，应对灾害、敌意与末日，也回答社会愿意为安全付出多少。

| id | 名称 | 学说 | tier | 成本 | 前置 | 软前置 | 效果摘要 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `mil_watch` | 烽燧与哨戒 | 秩序派 | E1 | 40 | — | — | 灾害抗性 +2%；稳定度 +0.5 |
| `mil_bronze` | 青铜兵器与常备军 | 工业派 | E2 | 105 | `mil_watch`、`industry_automation` | — | 稳定度 +0.5；工业产能 +2%；防务部门效率 +2% |
| `mil_wall` | 城垣与护城河 | 秩序派 | E2 | 120 | `mil_watch` | — | 灾害抗性 +4%；防务部门效率 +3% |
| `mil_mobile` | 机动防御 | 扩张派 | E3 | 300 | `mil_bronze` | — | 灾害抗性 +4%；研究速度 +2%；工业产能 +2% |
| `mil_fortress` | 要塞化 | 秩序派 | E3 | 320 | `mil_wall` | — | 灾害抗性 +6%；稳定度 +1.5；防务部门效率 +5% |
| `mil_bunker` | 民防与疏散 | 生态派 | E4 | 800 | `mil_wall` | — | 灾害抗性 +5%；人口容量 +3%；稳定度 +0.5 |
| `mil_radar` | 预警雷达网 | 观测派 | E4 | 840 | `mil_wall`、`comp_electronic` | — | 事件风险 -4%；观测部门效率 +4%；预测可信期 +4% |
| `mil_fleet` | 深空舰队 | 扩张派 | E5 | 1900 | — | `mil_planetary` / `mil_mobile` | 工业产能 +5%；防务部门效率 +4%；稳定度 +0.5 |
| `mil_planetary` | 行星防御系统 | 秩序派 | E5 | 2000 | `mil_radar` | — | 灾害抗性 +8%；事件风险 -7%；防务部门效率 +6% |

## 5. 互斥教义对照（6 组）

规则：同组只能采纳一项。`chooseDoctrine / applyDoctrine` 写入 `TechState.doctrineChoices`；也可直接研究某教义科技，完成时自动采纳。选择后同组其余选项**永久不可研究**（`canResearch` 返回具体原因）。教义科技不构成其他科技的硬前置，避免一次选择锁死整条路线；少数后期科技以 `requiresAny` 列出整组选项（见 §6），保证任何路线都能继续。

### `doctrine_energy` · 能源路线（tier 3）

>文明如何取得能量，决定了它的工业形态与社会代价。燃煤、裂变与太阳阵列只可择一。

| 科技 id | 名称 | 学说 | tier | 成本 | 前置 | 效果 |
| --- | --- | --- | --- | --- | --- | --- |
| `energy_coal` | 燃煤扩张 | 工业派 | E3 | 300 | `energy_grid`、`industry_automation` | 能源产出 +10%；工业产能 +5%；稳定度 -0.5 |
| `energy_nuclear` | 核能集中 | 演算派 | E3 | 340 | `energy_grid`、`industry_alloys` | 能源产出 +12%；研究速度 +2% |
| `energy_solar_array` | 太阳阵列 | 生态派 | E3 | 320 | `energy_grid`、`industry_alloys` | 能源产出 +8%；农业产出 +2% |

### `doctrine_society` · 社会契约（tier 4）

>技术官僚制、军功秩序与公社自治，分别以效率、纪律与平等为首要价值，不可兼得。

| 科技 id | 名称 | 学说 | tier | 成本 | 前置 | 效果 |
| --- | --- | --- | --- | --- | --- | --- |
| `society_technocracy` | 技术官僚制 | 演算派 | E4 | 880 | `society_bureau` | 研究速度 +5%；科研部门效率 +5%；稳定度 -0.5 |
| `society_military_order` | 军功秩序 | 秩序派 | E4 | 840 | `society_bureau` | 稳定度 +2；防务部门效率 +5%；灾害抗性 +2% |
| `society_commune` | 公社自治 | 生态派 | E4 | 800 | `society_publicschool` | 稳定度 +1；农业产出 +3%；事件风险 -3% |

### `doctrine_stellar` · 文明出路（tier 5）

>观测优先、轨道工业与方舟计划，是面对三体末日时三种互斥的答案。

| 科技 id | 名称 | 学说 | tier | 成本 | 前置 | 效果 |
| --- | --- | --- | --- | --- | --- | --- |
| `astro_watch` | 长夜守望 | 观测派 | E5 | 1900 | `astro_threebody` | 观测精度 +10%；预测可信期 +10%；稳定度 +1 |
| `industry_orbital_belt` | 轨道工业带 | 扩张派 | E5 | 1900 | `industry_megastructure` | 工业产能 +10%；金属产出 +4% |
| `space_arkship` | 方舟计划 | 扩张派 | E5 | 1900 | `space_deep` | 人口容量 +6%；研究速度 +2% |

### `doctrine_life` · 生命方向（tier 4）

>改造基因以适应宇宙，或与生态共生——两条道路在第四时代分野。

| 科技 id | 名称 | 学说 | tier | 成本 | 前置 | 效果 |
| --- | --- | --- | --- | --- | --- | --- |
| `bio_gene_design` | 定向基因改造 | 演算派 | E4 | 880 | `bio_ecology` | 宜居度 +5%；人口容量 +5%；研究速度 +2% |
| `bio_symbiosis` | 生态共生 | 生态派 | E4 | 800 | `bio_ecology` | 农业产出 +6%；灾害抗性 +4%；稳定度 +0.5 |

### `doctrine_compute` · 算力形态（tier 4）

>集中式超算追求单一意志的极致效率，分布式网络相信冗余与韧性。

| 科技 id | 名称 | 学说 | tier | 成本 | 前置 | 效果 |
| --- | --- | --- | --- | --- | --- | --- |
| `comp_central` | 集中式超算 | 演算派 | E4 | 880 | `comp_electronic` | 科研产出 +6%；研究速度 +4% |
| `comp_distributed` | 分布式网络 | 秩序派 | E4 | 840 | `comp_crypto` | 事件风险 -5%；稳定度 +1；政治资本 +0.4/回合 |

### `doctrine_defense` · 防御哲学（tier 3）

>要塞化以空间换时间，机动防御以时间换空间。

| 科技 id | 名称 | 学说 | tier | 成本 | 前置 | 效果 |
| --- | --- | --- | --- | --- | --- | --- |
| `mil_fortress` | 要塞化 | 秩序派 | E3 | 320 | `mil_wall` | 灾害抗性 +6%；稳定度 +1.5；防务部门效率 +5% |
| `mil_mobile` | 机动防御 | 扩张派 | E3 | 300 | `mil_bronze` | 灾害抗性 +4%；研究速度 +2%；工业产能 +2% |

## 6. 前置关系与 DAG

### 6.1 规则

- `requires`：硬前置，必须全部研究完成。
- `requiresAny`：软前置，满足任意一项即可；可与 `requires` 同时存在（两者都需满足）。
- 前置科技的 tier 必须 ≤ 自身 tier（不强制严格小于，但必须无环）。
- 每项科技从 E1 根节点出发均可达（由测试以 fixpoint 算法验证）。
- 互斥教义不得作为任何科技的**硬前置**；`requiresAny` 若引用教义组，必须覆盖整组或同时给出非教义选项。

### 6.2 使用软前置（requiresAny）的科技

| 科技 | tier | 硬前置（requires） | 软前置（requiresAny，任一满足） |
| --- | --- | --- | --- |
| `astro_gravwave` 引力波测量 | E4 | `astro_orbit` | `astro_spectra` / `comp_mechanism` |
| `comp_ai` 通用人工智能 | E5 | — | `comp_central` / `comp_distributed` |
| `society_cohesion` 文明共识 | E5 | — | `society_technocracy` / `society_military_order` / `society_commune` |
| `mil_fleet` 深空舰队 | E5 | — | `mil_planetary` / `mil_mobile` |

### 6.3 关键跨分支依赖

- `astro_gravwave` ← `astro_orbit` + 任选 `astro_spectra` / `comp_mechanism`（天文 ↔ 计算）
- `comp_electronic` ← `comp_mechanism` + `energy_solar`（计算 ↔ 能源）
- `industry_precision` ← `industry_alloys` + `comp_mechanism`（工业 ↔ 计算）
- `energy_nuclear` ← `energy_grid` + `industry_alloys`（能源 ↔ 工业）
- `space_station` ← `space_orbital` + `energy_solar`（航天 ↔ 能源）
- `space_ion` ← `space_colony` + `energy_fusion`（航天 ↔ 能源）
- `mil_radar` ← `mil_wall` + `comp_electronic`（防务 ↔ 计算）
- `mil_bronze` ← `mil_watch` + `industry_automation`（防务 ↔ 工业）
- `society_market` ← `society_tribe` + `industry_basic`（社会 ↔ 工业）
- `comp_ai` ← 集中式超算或分布式网络任一（保证「算力形态」两派路线都能通向终局）
- `society_cohesion` ← 技术官僚制 / 军功秩序 / 公社自治任一（保证「社会契约」三派路线都能通向终局）

### 6.4 冻结链（不得改动顺序）

- 天文台升级链：`astro_basic`(Lv.1) → `astro_distance`(Lv.2) → `astro_orbit`(Lv.3) → `astro_threebody`(Lv.4) → `astro_chaos`(Lv.5) → `astro_supernet`(Lv.6)，与 `core/constants.ts` 的 `OBSERVATORY_LEVELS[].requiresTech` 一一对应。
- 星际链：`space_basic` → `space_orbital` → `space_colony`（解锁星际殖民）→ `space_deep` → `space_engine`（解锁行星发动机）。

## 7. 效果与数值约定

`TechEffects` 全部字段均被 `aggregateTechEffects` 聚合；新增字段的数值语义（lead / politics / events 接入时以此为准）：

| 字段 | 语义 | 聚合方式 | 最终夹取 |
| --- | --- | --- | --- |
| productionMultiplier | 各资源产出乘数 | 连乘（按学派精通放大） | 每资源 [0.2, 5] |
| researchMultiplier | 科研产出乘数 | 连乘 | [0.2, 5] |
| researchSpeed | 研究速度**加性**百分比（0.05 = +5%） | 求和 | [0, 1.5] |
| observationMultiplier / predictionMultiplier | 观测 / 预测乘数 | 连乘 | [0.2, 5] |
| agricultureMultiplier / energyMultiplier / industryMultiplier | 农业 / 能源 / 工业乘数 | 连乘 | [0.2, 5] / [0.5, 4] |
| habitabilityBonus / populationCapacityBonus | 宜居度 / 人口容量加性 | 求和 | [0, 0.6] / [0, 0.8] |
| disasterResistance | 灾害抗性加性 | 求和 | [0, 0.8] |
| stabilityBonus | 稳定度加性点数（可为负） | 求和 | [-10, 15] |
| eventRiskMultiplier | 事件风险乘数，<1 降低风险 | 连乘 | [0.5, 1.2] |
| politicalCapital | 每回合政治资本加性收入 | 求和 | [0, 8] |
| departmentBoost | 六部门效率加性百分比（0.03 = +3%） | 求和 | 每部门 [0, 0.5] |
| allowColony / allowPlanetEngine | 解锁标记 | 逻辑或 | — |
| observationLevelUnlock | 观测等级提示 | 取最大 | [0, 6] |

`getTechMultipliers` 兼容旧调用：农业乘数并入 `production.food`、能源乘数并入 `production.energy`、`researchSpeed` 并入 `research`，旧调用方（economy / game）无需改动。

## 8. 研究机制

- **学派重心**：`TechState.schoolFocus`（null = 均衡）。`advanceResearch` 中实际进度 = 实际消耗科研点 × 研究速度；同派 ×1.15，跨派 ×0.95。
- **成本显示**：`researchCostFor(state, techId) = ceil(基础成本 / 研究速度)`，供 UI 显示"当前重心下的有效科研点需求"。
- **学派精通**：`schoolPoints[school] += tier × cost / 10`（完成时累计）；`schoolMastery = schoolPoints / 该派全部科技点数`（0..1）。聚合时该派效果按 `(1 + 0.10 × mastery)` 放大其超出基线的部分，满精通恰好 +10%（上限）。
- **旧存档兼容**：`schoolPoints` 缺失时，`schoolMastery` 会由 `researched` 列表实时推导；`syncSchoolPoints(state)` 可显式重建缓存，供 lead 在存档迁移（SAVE_VERSION 3）时调用。
- **互斥教义**：`doctrineChoices[groupId] = techId`；`canResearch` 依次检查 未知科技 → 已研究 → 正在研究 → 时代 → 互斥教义 → 前置（requires 全满足 + requiresAny 任一满足），返回可直接展示给玩家的中文原因。

## 9. 集成 API（`src/technology/index.ts` 导出）

**tree.ts（内容）**：`TECH_BRANCHES / TECH_BRANCH_ORDER / TECH_DEFS / TECH_MAP / TECH_SCHOOLS / TECH_SCHOOL_ORDER / DOCTRINE_GROUPS / getTechDef / techsByBranch / techName / techChainCost / techsInTier / techsAvailableInEra / techSchoolOf / getDoctrineGroupMeta / doctrineTechs / isDoctrineTech`。

**system.ts（逻辑）**：

| API | 用途 |
| --- | --- |
| `createTechState()` | 初始化 state（含 `schoolFocus: null` / `doctrineChoices: {}` / `schoolPoints: {}`） |
| `canResearch(techId, state, era?)` | 研究前置检查，返回 `{ok, reason}`（未知/已研究/研究中/时代/教义/前置） |
| `startResearch(state, techId, era?)` | 选定研究方向（切换会清空进度并给出 notice） |
| `advanceResearch(state, budget)` | 推进研究（含学派速度、精通点数、自动采纳教义），返回 `{completedId, spent, doctrineChosen?, schoolPointsGained?}` |
| `cancelResearch(state)` | 中止当前研究 |
| `chooseDoctrine / applyDoctrine(state, techId, era?)` | 选择互斥教义（可预先选择，也可在研究完成后采纳） |
| `doctrineGroups(state?)` / `doctrineLockReason(state, techId)` | 教义组视图 / 锁闭原因 |
| `setSchoolFocus(state, school|null)` | 设置研究重心（校验非法学派） |
| `schoolMastery / schoolPointsFor / schoolPointTotal / syncSchoolPoints` | 精通度 / 点数 / 总分 / 重建缓存 |
| `researchSpeedFor / researchCostFor` | 研究速度倍率 / 有效成本 |
| `aggregateTechEffects(state)` | 聚合全部效果（含精通加成，含新字段） |
| `getTechMultipliers(state)` | 旧乘数集合（含 researchSpeed 并入 research） |
| `activeResearchInfo / activeTechDef / isResearched / researchedCount / techDisplayName / clampTechEra / totalTechCost / branchProgress / TECH_SCHOOL_LIST` | 旧 API 全部保留 |

## 10. 已知缺口 / 后续接入

1. `src/game/game.ts` 的 `chooseSchoolFocus` / `chooseDoctrine` 已接入 `setSchoolFocus` / `chooseDoctrine(state, techId, era)`（含中文日志与拒绝原因），`tests/game/game.test.ts` 的「tech schools and doctrines are exposed through the view」用例通过。
2. `src/game/view.ts` 的 `TechTreeView` 仍自行推导学派名称/精通度与教义组标题：建议改用 `TECH_SCHOOLS`（真实名称/简称/描述/颜色）、`doctrineGroups(state)`（教义组中文标题/描述/选项状态）、`schoolMastery()`（真实精通值与满精通点数）。当前 view 的 `mastery = researchedCount / total` 与系统定义（按 `tier × cost / 10` 归一化）不同，教义组 `title` 为 `doctrine_` 前缀截断后的英文 id。
3. 新效果字段（stabilityBonus / eventRiskMultiplier / politicalCapital / departmentBoost / researchSpeed）已聚合，但 economy/politics/events 消费端尚未接入（lead 集成 `TurnContext` 时读取 `aggregateTechEffects`）。
4. `docs/ERA_CONTENT.md` 的科技表为 v1.2 的 26 项旧数据，已被本文件取代；旧文档中的科技成本/数量描述已过期（建筑表仍有效）。
5. `tests/game/game.test.ts` 的旧断言（`branches.length === 5`）已由 lead 更新为 8；若后续新增断言，请以本文件与 `tests/systems/technology.test.ts` 为准。
