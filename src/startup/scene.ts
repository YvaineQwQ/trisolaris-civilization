/**
 * 启动动画 Canvas 2D 场景层（v1.4 · src/startup 私有模块）。
 *
 * 负责所有程序化绘制的动态背景：
 *   - 极淡星点（黑幕 / 终幕）
 *   - 中央环形准星（外环缺口留在正下方 6 点钟方向，慢速自转）
 *   - 徽章缺失时的程序化兜底图形（三体 + 月牙轨道弧 + 箭头）
 *   - 白纸档案页里的三体轨道示意图
 *   - 过曝洗白闪光 / 扫描线 / 银白色散故障 / 授权光晕
 *
 * 不依赖任何第三方库，也不读游戏状态；由 src/startup/index.ts 驱动。
 */

export type SceneMode = "black" | "welcome" | "paper" | "none";

export type EmblemState = "ready" | "missing" | "loading";

interface Star {
  /** 归一化坐标 0..1 */
  x: number;
  y: number;
  r: number;
  a: number;
  phase: number;
  speed: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const TAU = Math.PI * 2;
const SILVER = "223, 231, 239";
const STEEL = "125, 159, 190";
const INK = "17, 17, 17";

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface StartupSceneOptions {
  bg: HTMLCanvasElement;
  fx: HTMLCanvasElement;
  reducedMotion: boolean;
}

export class StartupScene {
  private readonly bg: HTMLCanvasElement;
  private readonly fx: HTMLCanvasElement;
  private bgCtx: CanvasRenderingContext2D | null;
  private fxCtx: CanvasRenderingContext2D | null;
  private readonly reduced: boolean;

  private w = 0;
  private h = 0;
  private dpr = 1;

  private mode: SceneMode = "black";
  private elapsed = 0;
  private prevNow = 0;

  private readonly stars: Star[];

  private emblemState: EmblemState = "loading";
  private reticleAsset = false;
  private emblemRect: Rect | null = null;

  private orbit: HTMLCanvasElement | null = null;
  private orbitCtx: CanvasRenderingContext2D | null = null;
  private orbitW = 0;
  private orbitH = 0;
  private orbitProgress = 0;
  private orbitSpin = 0;
  private orbitActive = false;

  private flashStart = -1;
  private revealStart = -1;
  private glitchStart = -1;
  private grantStart = -1;

  private orbitRo: ResizeObserver | null = null;

  constructor(opts: StartupSceneOptions) {
    this.bg = opts.bg;
    this.fx = opts.fx;
    this.reduced = opts.reducedMotion;
    this.bgCtx = this.bg.getContext("2d");
    this.fxCtx = this.fx.getContext("2d");
    const rand = mulberry32(0x1d3b01);
    this.stars = Array.from({ length: 170 }, () => ({
      x: rand(),
      y: rand(),
      r: 0.4 + rand() * 1.1,
      a: 0.12 + rand() * 0.42,
      phase: rand() * TAU,
      speed: 0.25 + rand() * 0.7,
    }));
    this.resize();
  }

  setMode(mode: SceneMode): void {
    this.mode = mode;
    if (mode === "paper") this.orbitActive = true;
  }

  setEmblemState(state: EmblemState): void {
    this.emblemState = state;
  }

  setReticleAsset(hasAsset: boolean): void {
    this.reticleAsset = hasAsset;
  }

  setEmblemRect(rect: Rect | null): void {
    if (!rect) {
      this.emblemRect = null;
      return;
    }
    this.emblemRect = { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
  }

  attachOrbit(canvas: HTMLCanvasElement): void {
    this.orbit = canvas;
    this.orbitCtx = canvas.getContext("2d");
    this.measureOrbit();
    if (typeof ResizeObserver !== "undefined") {
      this.orbitRo?.disconnect();
      this.orbitRo = new ResizeObserver(() => this.measureOrbit());
      this.orbitRo.observe(canvas);
    }
  }

  setOrbitProgress(p: number): void {
    this.orbitProgress = clamp01(p);
  }

  playFlash(): void {
    this.flashStart = this.elapsed;
  }

  playReveal(): void {
    this.revealStart = this.elapsed;
  }

  playGlitch(): void {
    this.glitchStart = this.elapsed;
  }

  playGrant(): void {
    this.grantStart = this.elapsed;
  }

  resize(): void {
    this.dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.w = w;
    this.h = h;
    for (const canvas of [this.bg, this.fx]) {
      canvas.width = Math.round(w * this.dpr);
      canvas.height = Math.round(h * this.dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
    }
    this.measureOrbit();
  }

  private measureOrbit(): void {
    if (!this.orbit) return;
    const rect = this.orbit.getBoundingClientRect();
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    this.orbitW = Math.max(1, Math.round(rect.width));
    this.orbitH = Math.max(1, Math.round(rect.height));
    this.orbit.width = Math.round(this.orbitW * dpr);
    this.orbit.height = Math.round(this.orbitH * dpr);
    if (this.orbitCtx) {
      this.orbitCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  render(now: number): void {
    if (this.prevNow === 0) this.prevNow = now;
    const dt = Math.min(0.064, Math.max(0, (now - this.prevNow) / 1000));
    this.prevNow = now;
    this.elapsed += dt;

    this.drawBg();
    this.drawFx();
    if (this.orbitActive) this.drawOrbit();
  }

  dispose(): void {
    this.orbitRo?.disconnect();
    this.orbitRo = null;
  }

  // ────────────────────────────────────────────────────────────── bg

  private drawBg(): void {
    const g = this.bgCtx;
    if (!g) return;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    if (this.mode === "paper" || this.mode === "none") return;

    this.drawStars(g);
    if (!this.reticleAsset) this.drawReticle(g);
    if (this.emblemState === "missing") this.drawFallbackEmblem(g);
    this.drawScanline(g);
  }

  private drawStars(g: CanvasRenderingContext2D): void {
    const t = this.elapsed;
    for (const star of this.stars) {
      const twinkle = this.reduced ? 1 : 0.55 + 0.45 * Math.sin(t * star.speed + star.phase);
      g.beginPath();
      g.fillStyle = "rgba(" + SILVER + "," + (star.a * twinkle).toFixed(3) + ")";
      g.arc(star.x * this.w, star.y * this.h, star.r, 0, TAU);
      g.fill();
    }
    // 终幕星点更暗一些
    if (this.mode === "welcome") {
      g.fillStyle = "rgba(0,0,0,0.28)";
      g.fillRect(0, 0, this.w, this.h);
    }
  }

  private reticleCenter(): { cx: number; cy: number; r: number } {
    const rect = this.emblemRect;
    const cx = rect ? rect.x + rect.w / 2 : this.w * 0.5;
    const cy = rect ? rect.y + rect.h / 2 : this.h * 0.42;
    const r = Math.min(this.w * 0.44, this.h * 0.36);
    return { cx, cy, r };
  }

  private drawReticle(g: CanvasRenderingContext2D): void {
    const { cx, cy, r } = this.reticleCenter();
    const dim = this.mode === "welcome" ? 0.62 : 1;
    const spin = this.reduced ? 0 : this.elapsed * 0.045;
    const gap = 0.3; // 正下方缺口的半角（rad）

    // 外环：整圆留出底部缺口
    g.save();
    g.strokeStyle = "rgba(" + SILVER + "," + (0.26 * dim).toFixed(3) + ")";
    g.lineWidth = 1;
    g.beginPath();
    g.arc(cx, cy, r, Math.PI / 2 + gap, Math.PI / 2 - gap + TAU);
    g.stroke();
    g.restore();

    // 刻度：每 5° 一条，6 的倍数加长
    g.save();
    g.strokeStyle = "rgba(" + SILVER + "," + (0.22 * dim).toFixed(3) + ")";
    g.lineWidth = 1;
    for (let i = 0; i < 72; i += 1) {
      const angle = (i / 72) * TAU + spin;
      const rel = ((angle - Math.PI / 2) % TAU + TAU) % TAU;
      if (rel < gap * 2 || rel > TAU - gap * 2) continue;
      const long = i % 6 === 0;
      const inner = r + (long ? 7 : 4);
      const outer = r + (long ? 13 : 8);
      g.beginPath();
      g.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
      g.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
      g.stroke();
    }
    g.restore();

    // 内环：两段弧反向慢转 + 端点小方块
    g.save();
    g.strokeStyle = "rgba(" + SILVER + "," + (0.16 * dim).toFixed(3) + ")";
    g.lineWidth = 1;
    const ir = r * 0.82;
    const rev = -spin * 0.7;
    for (let k = 0; k < 2; k += 1) {
      const start = rev + k * Math.PI + 0.5;
      g.beginPath();
      g.arc(cx, cy, ir, start, start + Math.PI * 0.62);
      g.stroke();
    }
    g.restore();

    // 四角取景括号
    const bracket = Math.min(26, r * 0.14);
    g.save();
    g.strokeStyle = "rgba(" + SILVER + "," + (0.2 * dim).toFixed(3) + ")";
    g.lineWidth = 1;
    const bx = r * 0.98;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      g.beginPath();
      g.moveTo(cx + sx * bx, cy + sy * bx - sy * bracket);
      g.lineTo(cx + sx * bx, cy + sy * bx);
      g.lineTo(cx + sx * bx - sx * bracket, cy + sy * bx);
      g.stroke();
    }
    g.restore();

    // 缺口两端的小箭头标记
    g.save();
    g.fillStyle = "rgba(" + SILVER + "," + (0.3 * dim).toFixed(3) + ")";
    for (const side of [-1, 1]) {
      const angle = Math.PI / 2 + side * gap;
      const px = cx + Math.cos(angle) * (r + 18);
      const py = cy + Math.sin(angle) * (r + 18);
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px - 4, py + 7);
      g.lineTo(px + 4, py + 7);
      g.closePath();
      g.fill();
    }
    g.restore();

    // 中心十字（很淡，不抢徽章）
    g.save();
    g.strokeStyle = "rgba(" + SILVER + "," + (0.12 * dim).toFixed(3) + ")";
    g.beginPath();
    g.moveTo(cx - 10, cy);
    g.lineTo(cx + 10, cy);
    g.moveTo(cx, cy - 10);
    g.lineTo(cx, cy + 10);
    g.stroke();
    g.restore();
  }

  /** 徽章资源缺失时的兜底绘制：三颗银白天体 + 月牙轨道弧 + 右上方箭头。 */
  private drawFallbackEmblem(g: CanvasRenderingContext2D): void {
    const rect = this.emblemRect;
    const s = rect ? Math.min(rect.w, rect.h) * 1.35 : Math.min(this.w, this.h) * 0.14;
    if (s < 8) return;
    const cx = rect ? rect.x + rect.w / 2 : this.w / 2;
    const cy = rect ? rect.y + rect.h / 2 : this.h * 0.42;
    const pulse = this.reduced ? 1 : 0.88 + 0.12 * Math.sin(this.elapsed * 1.4);

    g.save();
    g.translate(cx, cy);

    const bodies: Array<[number, number, number]> = [
      [-0.2, -0.17, 0.17],
      [0.19, -0.05, 0.125],
      [0.01, 0.16, 0.09],
    ];
    for (const [bx, by, br] of bodies) {
      const x = bx * s;
      const y = by * s;
      const rr = br * s;
      const grad = g.createRadialGradient(x - rr * 0.3, y - rr * 0.35, rr * 0.1, x, y, rr);
      grad.addColorStop(0, "rgba(250,253,255," + (0.98 * pulse).toFixed(3) + ")");
      grad.addColorStop(0.62, "rgba(206,216,227," + (0.92 * pulse).toFixed(3) + ")");
      grad.addColorStop(1, "rgba(122,136,150,0.55)");
      g.beginPath();
      g.fillStyle = grad;
      g.arc(x, y, rr, 0, TAU);
      g.fill();
    }

    // 月牙形粗轨道弧（开口朝上，像托盘托住三体）
    g.strokeStyle = "rgba(214,224,234,0.92)";
    g.lineWidth = s * 0.075;
    g.lineCap = "round";
    g.beginPath();
    g.arc(0, -0.06 * s, 0.34 * s, Math.PI * 0.16, Math.PI * 0.84);
    g.stroke();

    // 弧线右端的箭头，指向右上
    const angle = Math.PI * 0.84;
    const ex = Math.cos(angle) * 0.34 * s;
    const ey = -0.06 * s + Math.sin(angle) * 0.34 * s;
    const tangent = angle + Math.PI / 2;
    const ax = Math.cos(tangent);
    const ay = Math.sin(tangent);
    g.fillStyle = "rgba(230,238,246,0.95)";
    g.beginPath();
    g.moveTo(ex + ax * s * 0.09, ey + ay * s * 0.09);
    g.lineTo(ex - ax * s * 0.02 + Math.cos(tangent - 1.2) * s * 0.05, ey - ay * s * 0.02 + Math.sin(tangent - 1.2) * s * 0.05);
    g.lineTo(ex - ax * s * 0.02 + Math.cos(tangent + 1.2) * s * 0.05, ey - ay * s * 0.02 + Math.sin(tangent + 1.2) * s * 0.05);
    g.closePath();
    g.fill();
    g.restore();
  }

  private drawScanline(g: CanvasRenderingContext2D): void {
    if (this.reduced) return;
    const cycle = 7.2;
    const p = (this.elapsed % cycle) / cycle;
    if (p > 0.22) return;
    const y = -80 + (this.h + 160) * (p / 0.22);
    const grad = g.createLinearGradient(0, y, 0, y + 120);
    grad.addColorStop(0, "rgba(" + SILVER + ",0)");
    grad.addColorStop(0.85, "rgba(" + SILVER + ",0.045)");
    grad.addColorStop(1, "rgba(" + SILVER + ",0)");
    g.fillStyle = grad;
    g.fillRect(0, y, this.w, 120);
  }

  // ────────────────────────────────────────────────────────────── orbit

  private drawOrbit(): void {
    const g = this.orbitCtx;
    if (!g) return;
    const w = this.orbitW;
    const h = this.orbitH;
    g.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h * 0.52;
    const unit = Math.min(w * 0.44, h * 0.92);
    const p = this.reduced ? 1 : easeInOut(this.orbitProgress);
    this.orbitSpin += 0.0016;

    const orbits: Array<{ rx: number; ry: number; rot: number; dash: number[] }> = [
      { rx: 1.0, ry: 0.62, rot: -0.16, dash: [3, 4] },
      { rx: 0.78, ry: 0.48, rot: 0.1, dash: [2, 4] },
      { rx: 0.56, ry: 0.36, rot: 0.3, dash: [2, 3] },
    ];

    g.save();
    g.translate(cx, cy);
    g.lineWidth = 1;
    for (const orbit of orbits) {
      const sweep = TAU * 0.92 * Math.min(1, p * 1.15);
      g.save();
      g.rotate(orbit.rot);
      g.strokeStyle = "rgba(" + INK + ",0.38)";
      g.setLineDash(orbit.dash);
      g.beginPath();
      g.ellipse(0, 0, unit * orbit.rx, unit * orbit.ry, 0, -Math.PI / 2, -Math.PI / 2 + sweep);
      g.stroke();
      g.restore();
    }

    // 三颗天体：不等边三角形分布，大小略区分
    const bodies: Array<{ a: number; orbit: number; r: number; label: string }> = [
      { a: Math.PI * 1.12, orbit: 0, r: 9, label: "A" },
      { a: Math.PI * 1.92, orbit: 1, r: 7, label: "B" },
      { a: Math.PI * 0.56, orbit: 2, r: 5, label: "C" },
    ];
    const appear = clamp01(p * 1.6 - 0.35);
    for (const body of bodies) {
      const orbit = orbits[body.orbit];
      const angle = body.a + (this.reduced ? 0 : this.orbitSpin * (body.orbit === 1 ? -1 : 1));
      const lx = Math.cos(angle) * unit * orbit.rx;
      const ly = Math.sin(angle) * unit * orbit.ry;
      const bx = lx * Math.cos(orbit.rot) - ly * Math.sin(orbit.rot);
      const by = lx * Math.sin(orbit.rot) + ly * Math.cos(orbit.rot);
      g.globalAlpha = appear;
      g.beginPath();
      g.fillStyle = "#111111";
      g.arc(bx, by, body.r, 0, TAU);
      g.fill();
      g.beginPath();
      g.strokeStyle = "rgba(244,241,234,0.95)";
      g.lineWidth = 2;
      g.arc(bx, by, body.r, 0, TAU);
      g.stroke();
      g.globalAlpha = 1;
      g.font = "600 9px 'Cascadia Mono', Consolas, monospace";
      g.fillStyle = "rgba(17,17,17,0.62)";
      g.fillText(body.label, bx + body.r + 4, by - body.r + 2);
    }
    g.restore();

    // 中心重心十字
    g.strokeStyle = "rgba(17,17,17,0.24)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(cx - 5, cy);
    g.lineTo(cx + 5, cy);
    g.moveTo(cx, cy - 5);
    g.lineTo(cx, cy + 5);
    g.stroke();
  }

  // ────────────────────────────────────────────────────────────── fx

  private drawFx(): void {
    const f = this.fxCtx;
    if (!f) return;
    f.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    f.clearRect(0, 0, this.w, this.h);

    this.drawFlash(f);
    this.drawReveal(f);
    this.drawGrant(f);
    this.drawGlitch(f);
  }

  private drawFlash(g: CanvasRenderingContext2D): void {
    if (this.flashStart < 0) return;
    const t = this.elapsed - this.flashStart;
    const dur = 0.85;
    if (t > dur) {
      this.flashStart = -1;
      return;
    }
    const p = t / dur;
    let alpha: number;
    if (p < 0.22) alpha = p / 0.22;
    else if (p < 0.4) alpha = 1;
    else alpha = 1 - (p - 0.4) / 0.6;
    // 中心先亮，边缘稍暗，形成曝开的光团而不是一整块死白
    const grad = g.createRadialGradient(this.w * 0.5, this.h * 0.46, 0, this.w * 0.5, this.h * 0.46, Math.max(this.w, this.h) * 0.75);
    grad.addColorStop(0, "rgba(255,255,255," + clamp01(alpha).toFixed(3) + ")");
    grad.addColorStop(0.72, "rgba(255,255,255," + (clamp01(alpha) * 0.94).toFixed(3) + ")");
    grad.addColorStop(1, "rgba(240,243,246," + (clamp01(alpha) * 0.86).toFixed(3) + ")");
    g.fillStyle = grad;
    g.fillRect(0, 0, this.w, this.h);
  }

  private drawReveal(g: CanvasRenderingContext2D): void {
    if (this.revealStart < 0) return;
    const t = this.elapsed - this.revealStart;
    const dur = 1.05;
    if (t > dur) {
      this.revealStart = -1;
      return;
    }
    const p = t / dur;
    const y = -140 + (this.h + 280) * p;
    const grad = g.createLinearGradient(0, y, 0, y + 160);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.78, "rgba(255,255,255,0.36)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, y, this.w, 160);
  }

  private drawGrant(g: CanvasRenderingContext2D): void {
    if (this.grantStart < 0) return;
    const t = this.elapsed - this.grantStart;
    const dur = 1.35;
    if (t > dur) {
      this.grantStart = -1;
      return;
    }
    const p = t / dur;
    const alpha = Math.sin(p * Math.PI) * 0.15;
    const grad = g.createRadialGradient(this.w * 0.7, this.h * 0.52, 0, this.w * 0.7, this.h * 0.52, Math.max(this.w, this.h) * 0.5);
    grad.addColorStop(0, "rgba(255,255,255," + alpha.toFixed(3) + ")");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, this.w, this.h);
  }

  private drawGlitch(g: CanvasRenderingContext2D): void {
    if (this.glitchStart < 0) return;
    const t = this.elapsed - this.glitchStart;
    const dur = 0.52;
    if (t > dur) {
      this.glitchStart = -1;
      return;
    }
    const p = t / dur;
    const flicker = p < 0.16 || (p > 0.3 && p < 0.42);
    if (flicker) {
      g.fillStyle = "rgba(236,241,246," + (0.07 + Math.random() * 0.08).toFixed(3) + ")";
      g.fillRect(0, 0, this.w, this.h);
    }
    const bands = 13;
    for (let i = 0; i < bands; i += 1) {
      const y = Math.random() * this.h;
      const h = 2 + Math.random() * 34;
      const offset = (Math.random() - 0.5) * 70 * (1 - p * 0.3);
      const silver = Math.random() > 0.35;
      g.fillStyle = silver
        ? "rgba(" + SILVER + "," + (0.05 + Math.random() * 0.16).toFixed(3) + ")"
        : "rgba(" + STEEL + "," + (0.05 + Math.random() * 0.12).toFixed(3) + ")";
      g.fillRect(offset, y, this.w, h);
    }
    // 一条高亮的撕裂亮线
    const ly = this.h * (0.2 + Math.random() * 0.6);
    g.fillStyle = "rgba(245,249,252," + (0.25 + Math.random() * 0.35).toFixed(3) + ")";
    g.fillRect(0, ly, this.w, 1.4);
  }
}
