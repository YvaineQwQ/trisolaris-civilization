/**
 * 政治系统 v3 · 内容定义（部门 / 派系 / 特质 / 姓名池 / 数值配置 / 文案模板）
 *
 * 设计口径（与 docs/EXPANSION_V3.md §3 一致）：
 *  - 6 个部门，每部门一名可空缺的部长；
 *  - 5 个派系，每名部长属于 1 到 2 个派系；
 *  - 关系矩阵 -100..100，五档标签：亲密 / 友好 / 中立 / 冷淡 / 敌对；
 *  - 政治资本：开局 20..30，每回合收入 2..6；任命 10 / 罢免 14 / 调解 8 / 峰会 24；
 *  - 每回合稳定度影响 ±3 以内，罢免即时冲击 -4..-8，丑闻类额外惩罚合计不超过 5。
 *
 * 本文件只放静态内容与阈值：不依赖任何运行时模块。
 * 随机函数在 random.ts，状态机与回合结算在 system.ts，统一由 index.ts 导出。
 */
import type {
  DepartmentDef,
  DepartmentId,
  FactionDef,
  FactionId,
  MinisterTraitDef,
} from "../core/types";

/* ------------------------------------------------------------------ *
 *  1. 六部门
 * ------------------------------------------------------------------ */

export const DEPARTMENT_ORDER: readonly DepartmentId[] = [
  "administration",
  "science",
  "industry",
  "agriculture",
  "defense",
  "observation",
] as const;

const DEPARTMENT_ID_LIST: readonly string[] = DEPARTMENT_ORDER;

export function isDepartmentId(value: unknown): value is DepartmentId {
  return typeof value === "string" && DEPARTMENT_ID_LIST.indexOf(value) >= 0;
}

export const DEPARTMENT_DEFS: Record<DepartmentId, DepartmentDef> = {
  administration: {
    id: "administration",
    name: "行政总署",
    short: "行政",
    icon: "governance",
    description:
      "统辖户籍、税赋、供销与政令流转的中枢。恒纪元的繁荣与乱纪元的秩序，都要先在这里变成一份份可执行的公文。",
    responsibilities: ["政治资本收入", "全局稳定度", "政令与派系协调"],
  },
  science: {
    id: "science",
    name: "科学院",
    short: "科研",
    icon: "science",
    description:
      "把观测数据变成工程图纸的地方。科学院从不许诺奇迹，只承诺在恒纪元结束前多备一份答案。",
    responsibilities: ["科研速度", "技术转化效率", "学者与工程师晋升"],
  },
  industry: {
    id: "industry",
    name: "工业委员会",
    short: "工业",
    icon: "industry",
    description:
      "钢铁、能源与建造工期归它管。委员会的信条刻在旧厂房的门楣上：恒星不会停工，我们也不停工。",
    responsibilities: ["工业产能", "建筑工期", "能源与金属配给"],
  },
  agriculture: {
    id: "agriculture",
    name: "农业署",
    short: "农业",
    icon: "agriculture",
    description:
      "负责粮仓、灌溉与种子库。农业署的官员习惯在报告末尾附一句天气——在三日凌空的世界上，这从来不是闲话。",
    responsibilities: ["食物产出", "饥荒预警", "生态与播种"],
  },
  defense: {
    id: "defense",
    name: "防务委员会",
    short: "防务",
    icon: "defense",
    description:
      "灾害应对、避难所与人口疏散的总调度。它掌管的不是军队，而是文明在每次灾难后还能剩下多少人。",
    responsibilities: ["灾害抗性", "人口损失减免", "地下城与疏散"],
  },
  observation: {
    id: "observation",
    name: "观星台联署",
    short: "观测",
    icon: "observation",
    description:
      "由观星者学会与科学院共同供养的独立机构。他们负责把三颗太阳的轨迹翻译成文明能听懂的语言。",
    responsibilities: ["观测效率", "轨道预测精度", "异常现象上报"],
  },
};

export const DEPARTMENT_LIST: readonly DepartmentDef[] = DEPARTMENT_ORDER.map((id) => DEPARTMENT_DEFS[id]);

export function departmentDef(id: DepartmentId | string): DepartmentDef | undefined {
  return (DEPARTMENT_DEFS as Record<string, DepartmentDef | undefined>)[id];
}

export function departmentName(id: DepartmentId | string): string {
  return departmentDef(id)?.name ?? String(id);
}

export function departmentShort(id: DepartmentId | string): string {
  return departmentDef(id)?.short ?? String(id);
}

/* ------------------------------------------------------------------ *
 *  2. 五派系
 * ------------------------------------------------------------------ */

export const FACTION_ORDER: readonly FactionId[] = [
  "technocrats",
  "militarists",
  "agrarians",
  "industrialists",
  "scholars",
] as const;

const FACTION_ID_LIST: readonly string[] = FACTION_ORDER;

export function isFactionId(value: unknown): value is FactionId {
  return typeof value === "string" && FACTION_ID_LIST.indexOf(value) >= 0;
}

export const FACTION_DEFS: Record<FactionId, FactionDef> = {
  technocrats: {
    id: "technocrats",
    name: "技术官僚",
    short: "技官",
    description:
      "由工程师、统计官与前观测台分析师组成。相信三体问题终会被算清，因此厌恶一切浪费在仪式上的时间。",
    ideology: "以数据与工程秩序取代血统和口号；正确的决定应由最懂系统的人做出。",
    color: "#3f6f9e",
    preferredDepartments: ["administration", "science"],
  },
  militarists: {
    id: "militarists",
    name: "军功集团",
    short: "军功",
    description:
      "在危机世代成长起来的一代，掌过避难所、疏散线与应急电台。他们的政治资本写在伤亡名单的背面。",
    ideology: "乱纪元需要铁腕：防御工事的预算不应向议会申请，而应向生存本能申请。",
    color: "#9e4a3f",
    preferredDepartments: ["defense", "administration"],
  },
  agrarians: {
    id: "agrarians",
    name: "农业公社",
    short: "农社",
    description:
      "代表广袤耕作区与种子库的联盟。对工业化的代价格外敏感，也是最先将生态失衡写进报告的人。",
    ideology: "先有粮仓，后有文明；任何不经过土地同意的计划都应被否决。",
    color: "#6f8f3e",
    preferredDepartments: ["agriculture"],
  },
  industrialists: {
    id: "industrialists",
    name: "工业联合会",
    short: "工联",
    description:
      "矿场、冶炼厂与建造公司的联合体。他们相信一切问题都能在产能表上找到答案，包括政治问题。",
    ideology: "钢铁与能源是文明对恒星说不的唯一方式。",
    color: "#b07a2e",
    preferredDepartments: ["industry"],
  },
  scholars: {
    id: "scholars",
    name: "观星者学会",
    short: "观星",
    description:
      "旧时代的天文台学者与新一代天体物理学家共处一室。他们不争预算，只争预测窗口的每一小时。",
    ideology: "我们无法阻止三日凌空，但我们可以提前看见它。",
    color: "#6b5b9e",
    preferredDepartments: ["observation", "science"],
  },
};

export const FACTION_LIST: readonly FactionDef[] = FACTION_ORDER.map((id) => FACTION_DEFS[id]);

export function factionDef(id: FactionId | string): FactionDef | undefined {
  return (FACTION_DEFS as Record<string, FactionDef | undefined>)[id];
}

export function factionName(id: FactionId | string): string {
  return factionDef(id)?.name ?? String(id);
}

export function factionShort(id: FactionId | string): string {
  return factionDef(id)?.short ?? String(id);
}

/** 派系初始影响力权重：合计 100，创建状态时叠加少量种子扰动后再归一化。 */
export const FACTION_INFLUENCE_BASE: Record<FactionId, number> = {
  technocrats: 22,
  militarists: 20,
  agrarians: 18,
  industrialists: 21,
  scholars: 19,
};

/**
 * 派系亲疏矩阵（对称，正数 = 天然亲近）。用于初始化部长关系与每回合关系漂移，
 * 让「技术官僚—观星者」天然走得近，「军功—农社」偶有同盟，「技官—军功」长期互斥。
 */
export const FACTION_AFFINITY: Record<FactionId, Record<FactionId, number>> = {
  technocrats: { technocrats: 0, militarists: -8, agrarians: -4, industrialists: 6, scholars: 10 },
  militarists: { technocrats: -8, militarists: 0, agrarians: 2, industrialists: 8, scholars: -6 },
  agrarians: { technocrats: -4, militarists: 2, agrarians: 0, industrialists: -8, scholars: 2 },
  industrialists: { technocrats: 6, militarists: 8, agrarians: -8, industrialists: 0, scholars: -2 },
  scholars: { technocrats: 10, militarists: -6, agrarians: 2, industrialists: -2, scholars: 0 },
};

/* ------------------------------------------------------------------ *
 *  3. 部长特质
 * ------------------------------------------------------------------ */

/**
 * 特质对数值的倾向。部分字段用于候选人生成时一次性修正属性，
 * 其余字段进入每回合的部门效率 / 稳定度 / 腐败风险计算。
 */
export interface TraitEffect {
  competence?: number;
  loyalty?: number;
  integrity?: number;
  ambition?: number;
  /** 每回合政治资本收入加成（+0.5 = 每回合多 0.5 点）。 */
  capitalRate?: number;
  /** 对应部门效率加成（0.04 = +4%，加法制，最终被 clamp 到 0.7..1.3）。 */
  research?: number;
  industry?: number;
  agriculture?: number;
  observation?: number;
  defense?: number;
  /** 每回合稳定度影响。 */
  stability?: number;
  /** 丑闻概率加成（0.08 = +8%）。 */
  scandalRisk?: number;
  /** 关系自然漂移加成（正 = 更容易与同僚交好）。 */
  network?: number;
  /** 派系满意度目标漂移。 */
  factionSatisfaction?: number;
}

export interface MinisterTraitEx extends MinisterTraitDef {
  effect: TraitEffect;
}

export const MINISTER_TRAITS: readonly MinisterTraitEx[] = [
  {
    id: "incorruptible",
    name: "铁面无私",
    description: "账册上不留一枚来路不明的铢；对同僚的请托一概批注「依例驳」。",
    tone: "good",
    effect: { integrity: 15, scandalRisk: -0.04, stability: 0.15, network: -0.1 },
  },
  {
    id: "calculator",
    name: "算无遗策",
    description: "能在三页公文之间看出下一场饥荒的日期；决策慢，但极少错。",
    tone: "good",
    effect: { competence: 1, research: 0.04, industry: 0.01 },
  },
  {
    id: "steady_hand",
    name: "沉稳持重",
    description: "乱纪元里最稀缺的不是钢铁，是不慌的人。",
    tone: "good",
    effect: { loyalty: 10, stability: 0.2, network: 0.3 },
  },
  {
    id: "coalition_builder",
    name: "合纵连横",
    description: "能在两个互相弹劾的派系之间摆下一桌酒；代价是所有人都欠他一笔。",
    tone: "good",
    effect: { capitalRate: 0.5, network: 0.6, factionSatisfaction: 1 },
  },
  {
    id: "visionary",
    name: "远见者",
    description: "看得比望远镜更远半步的人，通常也孤独半步。",
    tone: "good",
    effect: { observation: 0.05, research: 0.03, ambition: 10 },
  },
  {
    id: "frugal",
    name: "克己奉公",
    description: "布袍、冷茶、通宵的灯；他把俸禄的一半填进了公共粮仓。",
    tone: "good",
    effect: { capitalRate: 0.3, integrity: 8, stability: 0.1 },
  },
  {
    id: "corrupt",
    name: "贪墨之徒",
    description: "专项拨款的账簿上，总有几行字迹在雨夜里被重新誊抄过。",
    tone: "bad",
    effect: { integrity: -20, scandalRisk: 0.08, capitalRate: 0.4 },
  },
  {
    id: "iron_fist",
    name: "铁腕野心",
    description: "相信秩序由恐惧维持；在会议上从不提高嗓门，但所有人都记得他调走过谁。",
    tone: "bad",
    effect: { ambition: 20, defense: 0.04, network: -0.6, stability: -0.2 },
  },
  {
    id: "aloof",
    name: "孤高寡合",
    description: "报告写得极好，签完字就回观测塔；同僚的晚宴请柬在抽屉里积了灰。",
    tone: "bad",
    effect: { network: -0.8, research: 0.03, loyalty: -5 },
  },
  {
    id: "paranoid",
    name: "猜忌多疑",
    description: "每个人的忠诚在他眼里都标着到期日。",
    tone: "bad",
    effect: { network: -0.5, stability: -0.15, loyalty: -5, observation: 0.02 },
  },
  {
    id: "populist",
    name: "民粹煽动",
    description: "广场上的即兴演说能让宵禁提前解除，也能让第二天的议会更加分裂。",
    tone: "mixed",
    effect: { factionSatisfaction: 2, stability: -0.1, capitalRate: 0.2 },
  },
  {
    id: "gambler",
    name: "豪赌",
    description: "把整季的能源配额押在一项尚未验证的技术上；赢了是天才，输了是历史。",
    tone: "mixed",
    effect: { research: 0.05, industry: 0.04, scandalRisk: 0.05 },
  },
  {
    id: "paper_bureaucrat",
    name: "文案官僚",
    description: "在他的抽屉里，一份申请可以安静地躺上三个恒纪元。",
    tone: "mixed",
    effect: { capitalRate: 0.4, industry: -0.03, research: -0.02, network: 0.1 },
  },
  {
    id: "martial",
    name: "尚武",
    description: "相信每一条外交辞令都该由防务委员会的验收单来背书。",
    tone: "mixed",
    effect: { defense: 0.05, agriculture: -0.02, network: -0.2 },
  },
  {
    id: "agronomist",
    name: "惜农",
    description: "能凭风向判断霜冻，却算不清工业联合会的账。",
    tone: "mixed",
    effect: { agriculture: 0.05, industry: -0.02, factionSatisfaction: 1 },
  },
  {
    id: "stargazer",
    name: "望星成癖",
    description: "办公室的墙上钉着三十七份失效的轨道预报；他仍在等第八次修正。",
    tone: "mixed",
    effect: { observation: 0.06, research: 0.02, loyalty: -3 },
  },
];

export const MINISTER_TRAIT_MAP: Record<string, MinisterTraitEx> = {};
for (const trait of MINISTER_TRAITS) MINISTER_TRAIT_MAP[trait.id] = trait;

export function ministerTraitDef(id: string): MinisterTraitEx | undefined {
  return MINISTER_TRAIT_MAP[id];
}

export const MINISTER_TRAIT_IDS: readonly string[] = MINISTER_TRAITS.map((t) => t.id);

/* ------------------------------------------------------------------ *
 *  4. 姓名池（选择确定性组合，保证同一 seed 生成同一批人物）
 * ------------------------------------------------------------------ */

export const MINISTER_SURNAMES: readonly string[] = [
  "陆", "沈", "韩", "顾", "叶", "程", "罗", "秦", "苏", "闻",
  "江", "祁", "黎", "贺", "岑", "薛", "蒋", "裴", "温", "解",
  "白", "商", "应", "钟",
] as const;

export const MINISTER_GIVEN_NAMES: readonly string[] = [
  "望川", "听澜", "知恒", "临渊", "秉烛", "观棋", "见微", "昭明",
  "不器", "存真", "远舟", "启元", "载阳", "未迟", "静渊", "星野",
  "怀瑾", "长庚", "慎行", "怀沙", "抚星", "寒松", "从简", "守拙",
  "慕周", "青崖", "无咎", "立雪", "拾穗", "量川", "叩玄", "定山",
] as const;

/* ------------------------------------------------------------------ *
 *  5. 关系五档 / 派系满意度标签
 * ------------------------------------------------------------------ */

export type RelationTone = "intimate" | "friendly" | "neutral" | "cold" | "hostile";

export interface RelationLabel {
  label: string;
  tone: RelationTone;
}

/** 关系五档：>=60 亲密 / 25..59 友好 / -24..24 中立 / -59..-25 冷淡 / <=-60 敌对。 */
export function relationLabel(score: number): RelationLabel {
  const s = Number.isFinite(score) ? score : 0;
  if (s >= 60) return { label: "亲密", tone: "intimate" };
  if (s >= 25) return { label: "友好", tone: "friendly" };
  if (s >= -24) return { label: "中立", tone: "neutral" };
  if (s >= -59) return { label: "冷淡", tone: "cold" };
  return { label: "敌对", tone: "hostile" };
}

export interface SatisfactionLabel {
  label: string;
  tone: "good" | "ok" | "warn" | "bad";
}

/** 派系满意度标签（供 PoliticsView.factions.satisfactionLabel/tone）。 */
export function factionSatisfactionLabel(satisfaction: number): SatisfactionLabel {
  const s = Number.isFinite(satisfaction) ? satisfaction : 0;
  if (s >= 75) return { label: "满意", tone: "good" };
  if (s >= 55) return { label: "尚可", tone: "ok" };
  if (s >= 35) return { label: "不满", tone: "warn" };
  return { label: "敌意", tone: "bad" };
}

/* ------------------------------------------------------------------ *
 *  6. 数值配置（所有系统内数值的唯一真源，便于平衡与文档对照）
 * ------------------------------------------------------------------ */

export interface PoliticsConfig {
  /* 政治资本 */
  capitalMin: number;
  capitalMax: number;
  startingCapitalMin: number;
  startingCapitalMax: number;
  capitalRateMin: number;
  capitalRateMax: number;
  /* 动作成本 */
  appointCost: number;
  dismissCost: number;
  mediateCost: number;
  summitCost: number;
  summitCooldownTurns: number;
  /* 候选人 */
  candidateRefreshInterval: number;
  candidatePoolMin: number;
  candidatePoolTarget: number;
  candidatePoolMax: number;
  initialCandidateCount: number;
  /* 部长 */
  minMinisterTraits: number;
  maxMinisterTraits: number;
  competenceMin: number;
  competenceMax: number;
  loyaltyMin: number;
  loyaltyMax: number;
  integrityMin: number;
  integrityMax: number;
  ambitionMin: number;
  ambitionMax: number;
  ageMin: number;
  ageMax: number;
  /* 关系 */
  relationMin: number;
  relationMax: number;
  /** 每回合关系向自然目标靠拢的比例。 */
  relationDriftRate: number;
  /** 每回合关系向 0 回归的比例（让无结构支撑的极端值自然衰减）。 */
  relationZeroPull: number;
  mediateGainMin: number;
  mediateGainMax: number;
  friendlyRelation: number;
  hostileRelation: number;
  /* 派系 */
  influenceWarningThreshold: number;
  influenceBalanceTarget: number;
  influenceTurnDrift: number;
  satisfactionDriftRate: number;
  lowSatisfaction: number;
  highSatisfaction: number;
  summitSatisfactionMin: number;
  summitSatisfactionMax: number;
  /* 稳定度 */
  stabilityTurnMin: number;
  stabilityTurnMax: number;
  dismissalStabilityMin: number;
  dismissalStabilityMax: number;
  scandalStabilityCap: number;
  maxIncidentsPerTurn: number;
  /* 部门效率 */
  efficiencyMin: number;
  efficiencyMax: number;
  /* 历史 */
  historyLimit: number;
}

export const POLITICS_CONFIG: PoliticsConfig = {
  capitalMin: 0,
  capitalMax: 200,
  startingCapitalMin: 20,
  startingCapitalMax: 30,
  capitalRateMin: 2,
  capitalRateMax: 6,

  appointCost: 10,
  dismissCost: 14,
  mediateCost: 8,
  summitCost: 24,
  summitCooldownTurns: 8,

  candidateRefreshInterval: 3,
  candidatePoolMin: 4,
  candidatePoolTarget: 5,
  candidatePoolMax: 8,
  initialCandidateCount: 5,

  minMinisterTraits: 2,
  maxMinisterTraits: 2,
  competenceMin: 1,
  competenceMax: 10,
  loyaltyMin: 0,
  loyaltyMax: 100,
  integrityMin: 0,
  integrityMax: 100,
  ambitionMin: 0,
  ambitionMax: 100,
  ageMin: 31,
  ageMax: 68,

  relationMin: -100,
  relationMax: 100,
  relationDriftRate: 0.1,
  relationZeroPull: 0.015,
  mediateGainMin: 8,
  mediateGainMax: 15,
  friendlyRelation: 25,
  hostileRelation: -25,

  influenceWarningThreshold: 45,
  influenceBalanceTarget: 20,
  influenceTurnDrift: 0.05,
  satisfactionDriftRate: 0.25,
  lowSatisfaction: 30,
  highSatisfaction: 65,
  summitSatisfactionMin: 8,
  summitSatisfactionMax: 12,

  stabilityTurnMin: -3,
  stabilityTurnMax: 3,
  dismissalStabilityMin: -8,
  dismissalStabilityMax: -4,
  scandalStabilityCap: 5,
  maxIncidentsPerTurn: 1,

  efficiencyMin: 0.7,
  efficiencyMax: 1.3,

  historyLimit: 160,
};

/* ------------------------------------------------------------------ *
 *  7. 文案模板（为保证世界观质感，所有政治日志都从这里取模板 + 变量）
 * ------------------------------------------------------------------ */

export type PoliticsLogKind = "appoint" | "dismiss" | "mediate" | "faction" | "warning" | "event";
export type PoliticsLogSeverity = "info" | "success" | "warning" | "critical";

export interface PoliticsFlavorPool {
  appoint: readonly string[];
  dismiss: readonly string[];
  mediate: readonly string[];
  summit: readonly string[];
  scandal: readonly string[];
  ambition: readonly string[];
  factionWarning: readonly string[];
  influenceWarning: readonly string[];
  candidateRefresh: readonly string[];
  opening: readonly string[];
}

export const POLITICS_FLAVOR: PoliticsFlavorPool = {
  appoint: [
    "{name} 走进{department}的办公室，随身只带了一只旧皮箱与一份就职声明。门牌换上的那一刻，走廊里响起零星的掌声。",
    "任命状在议事厅宣读完毕。{name} 代表{faction}接过{department}的印信，承诺在下一个恒纪元结束前交出一份可核对的账目。",
    "{department}的旧部长留下一柜子未归档的公文。{name} 上任第一件事，是把它们全部搬进走廊，让所有路过的人都能翻阅。",
  ],
  dismiss: [
    "解除令在晨会上宣布。{name} 沉默地交回{department}的印章，走出议事厅时没有回头；{faction}的席位空了一整个下午。",
    "{name} 被免去{department}部长职务。官方通报只有两行字，但走廊里的窃窃私语一直持续到深夜。",
    "议事厅以微弱多数通过对{name}的不信任案。{department}门外，支持者与反对者隔着警戒线互掷标语。",
  ],
  mediate: [
    "在行政总署的调解室里，{a} 与 {b} 就一份联合预算达成谅解。茶凉之前，他们在文件末尾签下了各自的名字。",
    "经过三轮闭门磋商，{a} 与 {b} 的争执被暂时搁置。有人把这次调解称为「下一次决裂前的休战」。",
    "调停人把两份互相矛盾的备忘录并排放在 {a} 与 {b} 面前。两小时后，一份折中方案被送进了档案柜。",
  ],
  summit: [
    "联合峰会在观星台顶层举行。六位部长与五个派系的代表围坐一桌，窗外是正在接近的第二颗太阳。",
    "峰会持续了十一个小时。散会时没有人公开表示满意，但也没有人提前离席——这在近年已算成功。",
    "峰会公报承诺「共同承担下一个乱纪元的代价」。文本由技术官僚起草，农业公社要求在附录里补上粮仓数字。",
  ],
  scandal: [
    "{name} 被揭发挪用{department}的专项拨款。审计报告长达三百页，议事厅用了整整一夜才读完摘要。",
    "一份匿名举报信把 {name} 推上风口浪尖：{department}的采购合同流向了一家空壳公司，登记地址是一间废弃的观测站。",
    "调查组进驻{department}。部长办公室的保险柜被贴上了封条，而当天下午 {name} 仍在主持例行会议。",
    "媒体披露：{department}近三季度的物资调拨单存在重复签收。{name} 拒绝回答提问，只在离场时说了一句「历史会证明」。",
  ],
  ambition: [
    "{name} 在闭门会议上串联旧部，试图改组{department}的决策流程。消息走漏后，议事厅的席位安排连夜重排。",
    "有传言称 {name} 正在寻求跨派系支持，目标直指下一届联合政府。{faction}对此既不承认，也不否认。",
    "{name} 未经授权会见了两个派系的代表。行政总署要求其作出解释，答复是一份措辞严谨的备忘录。",
  ],
  factionWarning: [
    "{faction}的满意度已跌破警戒线。该派系在议事厅的发言越来越短，投票时的弃权越来越多。",
    "{faction}的满意度持续走低，其代表开始缺席联合会议。行政总署担心下一个乱纪元来临时无人可派。",
  ],
  influenceWarning: [
    "{faction}的影响力已达到 {value}，超过制衡阈值。其余派系联名要求重新分配议事席位。",
    "一份联名信警告：{faction}正在把持过多部门，联合政府的平衡已被打破。",
  ],
  candidateRefresh: [
    "人事司更新了候选人名册。几份新的履历被摆上议事厅的长桌，墨迹未干。",
    "又一批候任官员通过资格审查。档案里夹着推荐信、体检单，以及几份语焉不详的派系担保。",
  ],
  opening: [
    "联合政府完成第十三次内阁改组。六位部长在观星台下宣誓，誓词里第一次写入了《恒纪元公约》的补充条款。",
    "议事厅的席位重新排定：技术官僚与工业联合会分走长桌两端，农业公社只留了一名观察员。",
    "观星台联署向内阁递交第 0 号公报：三颗太阳的近日点误差仍在允许范围内——「允许范围」四个字由行政总署亲自拟定。",
  ],
};

/** 把 {key} 占位符替换为变量值；未知占位符保持原样，便于发现文案缺参。 */
export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  let out = template;
  for (const key of Object.keys(vars)) {
    out = out.split("{" + key + "}").join(String(vars[key]));
  }
  return out;
}
