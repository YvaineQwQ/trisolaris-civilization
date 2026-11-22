/**
 * 科学发现系统。
 *
 * 铁律：发现只能由"观测数据 / 估计值 / 模型残差"触发，绝不读取真实物理状态。
 * 每条发现都带 evidence 证据字符串，按标题去重，最多保留 MAX_DISCOVERIES 条。
 */
import { clamp, clamp01 } from "../core/math";
import type { Vec3 } from "../core/math";
import type { Discovery, ObservationState, StarId, StarMeasurement } from "../core/types";

export const MAX_DISCOVERIES = 40;

export interface DiscoveryCandidate {
  /** 稳定的发现类型键（用于去重与查询）。 */
  key: string;
  title: string;
  detail: string;
  category: Discovery["category"];
  evidence: string;
}

/** 按标题去重后写入 obs.discoveries，返回新发现（已存在则返回 null）。 */
export function addDiscovery(
  obs: ObservationState,
  candidate: DiscoveryCandidate,
  year: number,
): Discovery | null {
  if (!candidate.title || !candidate.evidence) return null;
  if (obs.discoveries.some((d) => d.title === candidate.title)) return null;
  const discovery: Discovery = {
    id: obs.nextDiscoveryId++,
    year: Math.round(year * 1000) / 1000,
    title: candidate.title,
    detail: candidate.detail,
    category: candidate.category,
    evidence: candidate.evidence,
  };
  obs.discoveries.push(discovery);
  if (obs.discoveries.length > MAX_DISCOVERIES) {
    obs.discoveries.splice(0, obs.discoveries.length - MAX_DISCOVERIES);
  }
  return discovery;
}

export function hasDiscovery(obs: ObservationState, key: string): boolean {
  return obs.discoveries.some((d) => d.evidence.includes("[key:" + key + "]"));
}

/** 把发现类型键嵌入 evidence，便于程序化查询（人类可读字符串保持完整）。 */
function evidenceWithKey(key: string, evidence: string): string {
  return evidence + " [key:" + key + "]";
}

function add(obs: ObservationState, year: number, c: Omit<DiscoveryCandidate, "evidence"> & { evidence: string }): Discovery | null {
  return addDiscovery(obs, { ...c, evidence: evidenceWithKey(c.key, c.evidence) }, year);
}

function latestByStar(obs: ObservationState): Partial<Record<StarId, StarMeasurement>> {
  const out: Partial<Record<StarId, StarMeasurement>> = {};
  for (const m of obs.measurements.stars) {
    const prev = out[m.starId];
    if (!prev || m.timeYears >= prev.timeYears) out[m.starId] = m;
  }
  return out;
}

function dist3(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function f(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export interface DiscoveryContext {
  level: number;
  year: number;
}

/**
 * 检测所有新的科学发现。返回本次新增的发现列表。
 * 调用方（finishTurns）负责把返回的发现写进日志。
 */
export function detectDiscoveries(obs: ObservationState, level: number, year: number): Discovery[] {
  const added: Discovery[] = [];
  const ctx: DiscoveryContext = { level, year };
  const stars = (["A", "B", "C"] as StarId[]).map((id) => obs.stars[id]).filter(Boolean);
  const knownStars = stars.filter((s) => s.known.position && s.sampleCount >= 3);
  const latest = latestByStar(obs);

  const push = (c: DiscoveryCandidate) => {
    const d = add(obs, ctx.year, c);
    if (d) added.push(d);
  };

  // 1) 紧密双星：两颗已测恒星估计间距低于阈值，且各自有多次测量。
  if (knownStars.length >= 2) {
    let tightest = Infinity;
    let pair: [StarId, StarId] = ["A", "B"];
    for (let i = 0; i < knownStars.length; i++) {
      for (let j = i + 1; j < knownStars.length; j++) {
        const d = dist3(knownStars[i].pos, knownStars[j].pos);
        if (d < tightest) {
          tightest = d;
          pair = [knownStars[i].id, knownStars[j].id];
        }
      }
    }
    const minSamples = knownStars.reduce((m, s) => Math.min(m, s.sampleCount), Infinity);
    if (tightest < 0.55 && Number.isFinite(minSamples)) {
      push({
        key: "tight-binary",
        title: "紧密双星构型",
        detail: "两颗恒星之间的实测间距远小于其余恒星间距，它们在引力上构成一对紧密双星，其余天体绕其共同质心运动。",
        category: "orbit",
        evidence: "累计 " + minSamples + " 批观测数据：第 " + f(ctx.year) + " 年测得 " + pair[0] + "/" + pair[1] +
          " 三维间距 " + f(tightest, 3) + " AU，低于双星判别阈值 0.55 AU。",
      });
    }
  }

  // 2) 高偏心率轨道（需要 >=4 级轨道解算；只报告最极端的一颗，避免刷屏）。
  if (level >= 4) {
    const eccentric = stars
      .filter((s) => s.known.orbit && s.eccentricity !== null && s.eccentricity > 0.72 && s.eccentricity < 0.995)
      .sort((a, b) => (b.eccentricity ?? 0) - (a.eccentricity ?? 0))[0];
    if (eccentric) {
      push({
        key: "eccentric-orbit",
        title: "高偏心率轨道",
        detail: "轨道解算显示 " + eccentric.name + " 的偏心率显著偏高，其近日点与远日点辐射环境差异巨大，母星气候可能随之剧烈摆动。",
        category: "orbit",
        evidence: "第 " + f(ctx.year) + " 年轨道解：" + eccentric.name + " 偏心率 e = " + f(eccentric.eccentricity ?? 0, 3) +
          "（阈值 0.72），由累计 " + eccentric.sampleCount + " 次测量拟合。",
      });
    }
  }

  // 3) 倾斜轨道结构（三维观测独有；汇总所有明显倾斜的恒星）。
  if (level >= 4) {
    const inclined = stars.filter((s) => s.inclinationRad !== null && s.inclinationRad > (15 * Math.PI) / 180);
    if (inclined.length > 0) {
      const detailLines = inclined.map((s) =>
        s.name + " 轨道倾角 " + f((s.inclinationRad! * 180) / Math.PI, 1) + "°（高度 " + f(s.height, 3) + " AU）",
      ).join("；");
      push({
        key: "inclined-orbits",
        title: "倾斜轨道结构",
        detail: "三维轨道解算表明恒星轨道面明显偏离参考平面，恒星的垂直高度随时间系统性变化，二维投影无法完整描述这个系统的真实几何。",
        category: "orbit",
        evidence: "第 " + f(ctx.year) + " 年三维轨道解：" + detailLines + "。",
      });
    }
  }

  // 4) 恒星近距离掠过母星（由测量点直接得到，任何等级都可能 >1 级）。
  const planetLatest = obs.measurements.planet.length > 0
    ? [...obs.measurements.planet].sort((a, b) => a.timeYears - b.timeYears)[obs.measurements.planet.length - 1]
    : null;
  if (planetLatest && level >= 1) {
    let closest = Infinity;
    let closestId: StarId = "A";
    let closestYear = planetLatest.timeYears;
    for (const id of ["A", "B", "C"] as StarId[]) {
      const m = latest[id];
      if (!m) continue;
      const d = dist3(m.pos, planetLatest.pos);
      if (d < closest) {
        closest = d;
        closestId = id;
        closestYear = Math.min(m.timeYears, planetLatest.timeYears);
      }
    }
    if (Number.isFinite(closest) && closest < 0.75) {
      push({
        key: "star-close-encounter",
        title: "恒星近距离掠过母星",
        detail: "母星观测记录到一颗恒星与母星的距离大幅低于历史典型值，辐照与潮汐扰动将出现尖峰，文明需为极端气候与轨道扰动做准备。",
        category: "anomaly",
        evidence: "母星观测与 " + closestId + " 星观测在第 " + f(closestYear) + " 年给出三维距离 " + f(closest, 3) +
          " AU（告警阈值 0.75 AU）。",
      });
    }
  }

  // 5) 极端气候信号（由母星观测的温度采样序列触发）。
  const temps = obs.measurements.planet
    .filter((m) => m.tempC !== undefined)
    .map((m) => ({ t: m.timeYears, c: m.tempC as number }));
  if (temps.length >= 5) {
    const values = temps.map((t) => t.c);
    const minT = Math.min(...values);
    const maxT = Math.max(...values);
    const span = maxT - minT;
    if (span > 55 || maxT > 75 || minT < -85) {
      push({
        key: "climate-extremes",
        title: "极端气候信号",
        detail: "母星表面温度在观测窗口内出现剧烈波动，这种量级的温度摆动无法用季节变化解释，指向恒星辐照的混沌式剧变。",
        category: "environment",
        evidence: "第 " + f(temps[0].t) + " ~ " + f(temps[temps.length - 1].t) + " 年共 " + temps.length +
          " 次测温：最低 " + f(minT, 1) + " °C，最高 " + f(maxT, 1) + " °C，摆幅 " + f(span, 1) + " °C。",
      });
    }
  }

  // 6) 潜在宜居带（由母星测温 + 位置精度触发）。
  if (obs.planet && temps.length >= 3 && obs.planet.tempC >= -10 && obs.planet.tempC <= 42 && level >= 2) {
    push({
      key: "habitable-zone",
      title: "潜在宜居带",
      detail: "母星当前温度处于液态水可长期存在的区间，且轨道距离与恒星辐照未出现灾难性偏移，是文明延续与扩张的宝贵窗口。",
      category: "planet",
      evidence: "第 " + f(obs.planet.lastMeasuredYear) + " 年母星测温 " + f(obs.planet.tempC, 1) + " °C（宜居窗口 −10~42 °C），位置精度 ±" +
        f(obs.planet.sigmaPos, 4) + " AU。",
    });
  }

  // 7) 母星轨道漂移（由母星测量轨迹的径向变化触发）。
  const planetM = [...obs.measurements.planet].sort((a, b) => a.timeYears - b.timeYears);
  if (planetM.length >= 4 && planetM[planetM.length - 1].timeYears - planetM[0].timeYears >= 1.5 && obs.planet) {
    const rFirst = Math.hypot(planetM[0].pos.x, planetM[0].pos.y, planetM[0].pos.z);
    const rLast = Math.hypot(planetM[planetM.length - 1].pos.x, planetM[planetM.length - 1].pos.y, planetM[planetM.length - 1].pos.z);
    const drift = rFirst > 1e-6 ? Math.abs(rLast - rFirst) / rFirst : 0;
    if (drift > 0.18) {
      push({
        key: "orbit-drift",
        title: "母星轨道漂移",
        detail: "母星到系统质心的距离正在系统性改变，说明三体引力扰动已实质性地改写母星轨道，长期气候基准将随之迁移。",
        category: "orbit",
        evidence: "母星观测第 " + f(planetM[0].timeYears) + " ~ " + f(planetM[planetM.length - 1].timeYears) +
          " 年：到质心距离由 " + f(rFirst, 2) + " AU 变为 " + f(rLast, 2) + " AU（漂移 " + f(drift * 100, 1) + "%）。",
      });
    }
  }

  // 8) 恒星逃逸迹象（估计到质心距离远超典型值，且已测得速度）。
  if (level >= 3) {
    for (const s of stars) {
      if (s.known.velocity && s.distanceFromBarycenter > 16) {
        push({
          key: "runaway-star-" + s.id,
          title: "恒星逃逸迹象（" + s.name + "）",
          detail: s.name + " 到系统质心的距离已远超历史典型范围，若趋势持续，它可能在被抛射后永远离开这个三体系统，天空中将只剩两颗恒星。",
          category: "anomaly",
          evidence: "第 " + f(ctx.year) + " 年估计：" + s.name + " 距质心 " + f(s.distanceFromBarycenter, 2) +
            " AU（警戒 16 AU），速度 " + f(s.speed, 2) + " AU/年。",
        });
      }
    }
  }

  // 9) 异常高速恒星（相对同期恒星速度分布显著偏大；汇总报告最快的一颗）。
  const speedStars = stars.filter((s) => s.known.velocity && s.speed > 0);
  if (speedStars.length >= 2) {
    const speeds = speedStars.map((s) => s.speed).sort((a, b) => a - b);
    const median = speeds[Math.floor(speeds.length / 2)];
    const fastest = speedStars.reduce((a, b) => (b.speed > a.speed ? b : a), speedStars[0]);
    if (median > 1e-6 && fastest.speed > median * 2.6) {
      push({
        key: "fast-star",
        title: "异常高速恒星",
        detail: fastest.name + " 的实测速度显著高于同系统其余恒星，说明它刚刚经历了一次强引力弹射或正处于极扁的轨道段。",
        category: "anomaly",
        evidence: "第 " + f(ctx.year) + " 年速度测量：" + fastest.name + " 速度 " + f(fastest.speed, 2) + " AU/年，其余恒星速度中位数 " +
          f(median, 2) + " AU/年（倍数 " + f(fastest.speed / median, 1) + "）。",
      });
    }
  }

  void clamp; // 保留 clamp 供后续扩展
  return added;
}

/** 预测集成发散触发的"混沌敏感性"发现（由 refreshPrediction 调用）。 */
export function recordChaosSensitivity(
  obs: ObservationState,
  year: number,
  reliableFraction: number,
  agreement: number,
  horizonYears: number,
): Discovery | null {
  const reliableYears = clamp01(reliableFraction) * horizonYears;
  return add(obs, year, {
    key: "chaos-sensitivity",
    title: "混沌敏感性确认",
    detail: "对同一组观测初值施加测量误差量级的扰动后，模型在短时间内给出完全不同的未来：三体系统对初值极端敏感，" +
      "长期预测在原理上不可行，只能给出概率性的短期窗口。",
    category: "system",
    evidence: "第 " + f(year) + " 年预测集成（窗口 " + f(horizonYears, 1) + " 年）：集合在 " + f(reliableYears, 1) +
      " 年后即发散，一致度 " + f(agreement * 100, 1) + "%，可靠时长占比 " + f(reliableFraction * 100, 1) + "%。",
  });
}
