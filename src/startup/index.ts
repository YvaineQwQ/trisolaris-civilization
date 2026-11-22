/**
 * 三体纪元 v1.4 — 可交互启动动画 PV《纪元存续理事会》
 * ============================================================================
 * 六幕序列（docs/V4_SPEC.md §1）：
 *   ① 黑幕徽章  ② 过曝洗白  ③ 白纸技术档案底板
 *   ④ 五步交互式存续授权（前两步必须操作，后三步自动、可点击加速）
 *   ⑤ 银白色散故障揭幕  ⑥ 终幕「欢迎，观测者」
 *
 * 用法（集成由 lead 在 src/main.ts 中完成）：
 *   import { runStartup } from "./startup";
 *   const result = await runStartup();           // "completed" | "skipped"
 *   // 需要重播（帮助入口 / 设置项）：await replayStartup();
 *
 * 设计约束：
 *   - 全屏 fixed overlay，z-index 高于游戏 UI；结束移除并 resolve；
 *   - 不读不写游戏状态，只操作自己的 DOM / Canvas / WebAudio；
 *   - 首帧同步工作 < 100ms（DOM 一次 innerHTML + Canvas 首次 resize）；
 *   - prefers-reduced-motion：关闭自转 / 星点闪烁 / 扫描线 / 故障，整体时长缩短；
 *   - 音效全部由 WebAudio 实时合成，首次用户手势后才允许发声，默认音量很低；
 *   - 徽章 / 准星环资源由 emblem-art 生成（public/startup/**），这里只引用；
 *     资源缺失时用 Canvas 2D 画程序化兜底图形，保证动画仍然完整可看。
 * ============================================================================
 */
import "./startup.css";
import { StartupAudio } from "./audio";
import { STARTUP_MARKUP } from "./markup";
import { StartupScene } from "./scene";

export type StartupResult = "completed" | "skipped";

export type StartupPhase =
  | "black"
  | "wash"
  | "archive"
  | "auth"
  | "glitch"
  | "welcome"
  | "done";

export interface StartupProgress {
  phase: StartupPhase;
  /** 授权序列子步骤 1..5；其余幕为 0 */
  step: number;
}

export interface StartupOptions {
  /** 资源根路径（默认取 import.meta.env.BASE_URL 下的 startup/）；预览页可传 "/startup/" */
  assetBase?: string;
  /** 本次会话记住已播放（sessionStorage），默认 true */
  remember?: boolean;
  /** 强制重播（忽略 sessionStorage 记录），默认 false */
  force?: boolean;
  /** 全局速度倍率，1 = 标准；仅用于调试/QA，默认 1 */
  speed?: number;
  /**
   * 音效：默认 "auto"（首次用户手势后启用轻提示）；
   * false = 完全静音；true 等价于 "auto"。
   */
  sound?: boolean | "auto";
  /** 是否允许右上 SKIP / Esc 跳过，默认 true */
  allowSkip?: boolean;
  /** 第二步档案卡上的观测者代号，默认 "OBSERVER-01" */
  observerName?: string;
  /** prefers-reduced-motion：默认跟随系统；true 强制精简模式，false 强制完整动效 */
  reducedMotion?: boolean | "auto";
  /** 每次幕/步变化时的回调（调试 / E2E 用） */
  onPhase?: (progress: StartupProgress) => void;
}

export interface StartupHandle {
  readonly phase: StartupPhase;
  /** 授权序列子步骤 1..5；其余幕为 0 */
  readonly step: number;
  readonly result: StartupResult | null;
  /** 推进当前可交互步骤（等于按钮 / Enter / Space） */
  advance(): void;
  /** 跳过整段启动动画 */
  skip(): void;
}

/** sessionStorage 键：本次会话是否已播放过启动动画 */
export const STARTUP_SESSION_KEY = "trisolaris.startup.v14";

/** 窗口事件名：detail 为 StartupProgress，供 E2E 监听 */
export const STARTUP_EVENT = "trisolaris:startup-phase";

const PHASE_LABEL: Record<StartupPhase, string> = {
  black: "第一幕 · 黑幕徽章",
  wash: "第二幕 · 过曝洗白",
  archive: "第三幕 · 技术档案底板",
  auth: "第四幕 · 存续授权",
  glitch: "第五幕 · 色散故障揭幕",
  welcome: "第六幕 · 终幕欢迎",
  done: "启动序列结束",
};

const AUTH_STEP_LABEL = ["观测权限申请", "观测者档案确认", "三体轨道载入", "预测模型校验", "存续授权通过"];

const INTRO_EN = "EPOCH CONTINUITY COUNCIL";
const WELCOME_EN = "WELCOME, OBSERVER";

const BOOT_LOG: Array<{ zh: string; en: string; state: string }> = [
  { zh: "星历同步", en: "EPHEMERIS SYNC", state: "OK" },
  { zh: "观测阵列", en: "OBSERVATION ARRAY", state: "READY" },
  { zh: "三体轨道解", en: "THREE-BODY ORBIT", state: "LOADED" },
  { zh: "生存基线", en: "SURVIVAL BASELINE", state: "STABLE" },
  { zh: "文明档案", en: "CIVILIZATION ARCHIVE", state: "SEALED" },
  { zh: "存续协议", en: "CONTINUITY PROTOCOL", state: "STANDBY" },
];

// ────────────────────────────────────────────────────────────────────────────
// 小工具
// ────────────────────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function readSessionPlayed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(STARTUP_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSessionPlayed(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STARTUP_SESSION_KEY, "1");
  } catch {
    /* 隐私模式 / 配额满：忽略 */
  }
}

/**
 * 移除首屏黑幕（防止启动模块加载完成前先闪一下游戏主界面白纸）。
 *
 * 集成方在 index.html 里挂一个纯黑 #tri-boot-veil（见 docs/STARTUP.md 的片段），
 * 本模块挂载动画或判定本会话已播放时调用它移除；即使集成方忘记调用，
 * 也不会影响动画本身。
 */
export function dismissStartupBootVeil(): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove("su-boot");
  const veil = document.getElementById("tri-boot-veil");
  if (veil && veil.parentNode) veil.parentNode.removeChild(veil);
}

/** 本次会话是否已经播放过启动动画（lead 集成时可直接用） */
export function hasPlayedStartupThisSession(): boolean {
  return readSessionPlayed();
}

/** 清除本次会话的「已播放」记录（调试 / 重播用） */
export function clearStartupSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STARTUP_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function resolveAssetBase(assetBase?: string): string {
  const environmentBase = (import.meta.env && import.meta.env.BASE_URL) || "./";
  const base = assetBase === undefined ? environmentBase : assetBase;
  const dir = base === "" ? "./" : base.endsWith("/") ? base : base + "/";
  return dir + "startup/";
}

interface Task {
  due: number;
  fn: () => void;
}

interface Tween {
  start: number;
  dur: number;
  fn: (p: number) => void;
}

// ────────────────────────────────────────────────────────────────────────────
// 控制器
// ────────────────────────────────────────────────────────────────────────────

class StartupController implements StartupHandle {
  private readonly options: StartupOptions;
  private readonly reduced: boolean;
  private readonly speed: number;
  private readonly allowSkip: boolean;
  private readonly remember: boolean;
  private readonly soundEnabled: boolean;
  private readonly assetBase: string;
  private readonly observerName: string;

  private phaseValue: StartupPhase = "black";
  private stepValue = 0;
  private resultValue: StartupResult | null = null;

  private root!: HTMLDivElement;
  private bgCanvas!: HTMLCanvasElement;
  private fxCanvas!: HTMLCanvasElement;
  private blackEl!: HTMLDivElement;
  private paperEl!: HTMLDivElement;
  private skipEl!: HTMLButtonElement;
  private ctaEl!: HTMLButtonElement;
  private liveEl!: HTMLParagraphElement;
  private emblemSlot!: HTMLDivElement;
  private introEn!: HTMLDivElement;
  private welcomeEn!: HTMLDivElement;
  private logEl!: HTMLUListElement;
  private selfcheckPct!: HTMLElement;
  private paperStatus!: HTMLElement;
  private consoleCount!: HTMLElement;
  private consoleHint!: HTMLElement;
  private actEl!: HTMLElement;
  private pageNoEl!: HTMLElement;
  private orbitCanvas!: HTMLCanvasElement;
  private panels: HTMLElement[] = [];
  private slats: HTMLElement[] = [];

  private scene: StartupScene | null = null;
  private audio: StartupAudio | null = null;

  private clock = 0;
  private accel = 1;
  private userAccelerated = false;
  private tasks: Task[] = [];
  private tweens: Tween[] = [];
  private raf = 0;
  private lastFrame = 0;
  private startedAt = 0;
  private advanceLockUntil = 0;
  private resolveFn: ((result: StartupResult) => void) | null = null;
  private lastFocused: Element | null = null;
  private listeners: Array<() => void> = [];
  private realTimers: number[] = [];
  private emblemRo: ResizeObserver | null = null;

  constructor(options: StartupOptions) {
    this.options = options;
    const motion = options.reducedMotion;
    this.reduced = motion === true || (motion !== false && (motion === "auto" || motion === undefined) && prefersReducedMotion());
    this.speed = Math.min(3, Math.max(0.25, options.speed ?? 1));
    this.allowSkip = options.allowSkip !== false;
    this.remember = options.remember !== false;
    this.soundEnabled = options.sound !== false;
    this.assetBase = resolveAssetBase(options.assetBase);
    this.observerName = (options.observerName ?? "OBSERVER-01").slice(0, 48);
  }

  get phase(): StartupPhase {
    return this.phaseValue;
  }

  get step(): number {
    return this.stepValue;
  }

  get result(): StartupResult | null {
    return this.resultValue;
  }

  // ── 生命周期 ───────────────────────────────────────────────────────

  start(): Promise<StartupResult> {
    this.startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    return new Promise<StartupResult>((resolve) => {
      this.resolveFn = resolve;
      try {
        this.mount();
      } catch (error) {
        console.error("[startup] mount failed", error);
        this.teardown();
        const fallback = this.resolveFn;
        this.resolveFn = null;
        fallback?.("skipped");
        return;
      }
      this.root.dataset.scene = "black";
      this.root.dataset.phase = this.phaseValue;
      this.beginIntro();
      this.emitProgress();
      this.lastFrame = 0;
      this.raf = window.requestAnimationFrame(this.loop);
    });
  }

  advance(): void {
    if (this.resultValue) return;
    if (this.clock < this.advanceLockUntil) return;
    switch (this.phaseValue) {
      case "black":
        this.beginWash();
        break;
      case "auth":
        if (this.stepValue === 1 || this.stepValue === 2) {
          const next = this.stepValue + 1;
          this.audio?.cue("advance");
          this.enterStep(next);
          if (next >= 3) this.startAuto(next);
        } else if (this.stepValue >= 3) {
          this.accelerate();
        }
        break;
      case "welcome":
        this.finish("completed");
        break;
      default:
        break;
    }
  }

  skip(): void {
    if (this.resultValue) return;
    if (!this.allowSkip) return;
    this.audio?.cue("skip");
    this.skipEl?.blur();
    this.finish("skipped");
  }

  // ── 挂载 ───────────────────────────────────────────────────────────

  private mount(): void {
    this.lastFocused = document.activeElement;
    const root = document.createElement("div");
    root.id = "tri-startup-root";
    root.className = "su-root";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "纪元存续理事会 · 启动序列");
    root.innerHTML = STARTUP_MARKUP;
    document.body.appendChild(root);
    this.root = root;
    document.documentElement.classList.add("su-lock");
    dismissStartupBootVeil();

    this.bgCanvas = this.q<HTMLCanvasElement>(".su-bg");
    this.fxCanvas = this.q<HTMLCanvasElement>(".su-fx");
    this.blackEl = this.q<HTMLDivElement>(".su-black");
    this.paperEl = this.q<HTMLDivElement>(".su-paper");
    this.skipEl = this.q<HTMLButtonElement>(".su-skip");
    this.ctaEl = this.q<HTMLButtonElement>(".su-cta");
    this.liveEl = this.q<HTMLParagraphElement>(".su-live");
    this.emblemSlot = this.q<HTMLDivElement>(".su-emblem-slot");
    this.introEn = this.q<HTMLDivElement>(".su-intro .su-en");
    this.welcomeEn = this.q<HTMLDivElement>(".su-welcome .su-en");
    this.logEl = this.q<HTMLUListElement>(".su-log");
    this.selfcheckPct = this.q<HTMLElement>(".su-selfcheck-pct");
    this.paperStatus = this.q<HTMLElement>(".su-status-value");
    this.consoleCount = this.q<HTMLElement>(".su-console-count");
    this.consoleHint = this.q<HTMLElement>(".su-console-hint");
    this.actEl = this.q<HTMLElement>(".su-act");
    this.pageNoEl = this.q<HTMLElement>(".su-page-no");
    this.orbitCanvas = this.q<HTMLCanvasElement>(".su-orbit");
    this.panels = Array.from(root.querySelectorAll<HTMLElement>(".su-panel"));
    this.slats = Array.from(root.querySelectorAll<HTMLElement>(".su-slats li"));

    const observerEl = root.querySelector<HTMLElement>(".su-observer-name");
    if (observerEl) observerEl.textContent = this.observerName;

    this.logEl.innerHTML = BOOT_LOG.map((line, index) => (
      '<li class="su-log-line">'
      + '<span class="su-log-idx">[' + String(index + 1).padStart(2, "0") + "]</span>"
      + '<span class="su-log-zh">' + line.zh + "</span>"
      + '<span class="su-log-leader"></span>'
      + '<span class="su-log-en">' + line.en + "</span>"
      + '<span class="su-log-state">' + line.state + "</span>"
      + "</li>"
    )).join("");

    if (!this.allowSkip) this.skipEl.hidden = true;

    this.scene = new StartupScene({
      bg: this.bgCanvas,
      fx: this.fxCanvas,
      reducedMotion: this.reduced,
    });
    this.scene.attachOrbit(this.orbitCanvas);
    this.audio = new StartupAudio(this.soundEnabled);
    this.wireAssets();

    this.listen(document, "keydown", this.onKeyDown, true);
    this.listen(document, "pointerdown", this.onFirstGesture, { capture: true, passive: true });
    this.listen(document, "visibilitychange", this.onVisibility);
    this.listen(window, "resize", this.onResize);
    root.addEventListener("click", this.onClick);
    this.listeners.push(() => root.removeEventListener("click", this.onClick));
    this.skipEl.addEventListener("click", this.onSkipClick);
    this.listeners.push(() => this.skipEl.removeEventListener("click", this.onSkipClick));

    if (typeof ResizeObserver !== "undefined") {
      this.emblemRo = new ResizeObserver(() => this.updateEmblemRect());
      this.emblemRo.observe(this.emblemSlot);
    }
    window.requestAnimationFrame(() => {
      this.root.classList.add("su-ready");
      this.updateEmblemRect();
    });
    window.setTimeout(() => this.updateEmblemRect(), 260);
  }

  private q<T extends Element>(selector: string): T {
    const el = this.root.querySelector<T>(selector);
    if (!el) throw new Error("[startup] missing markup node: " + selector);
    return el;
  }

  private listen(
    target: Document | Window,
    type: string,
    handler: (event: never) => void,
    options?: boolean | AddEventListenerOptions,
  ): void {
    const listener = handler as unknown as EventListener;
    target.addEventListener(type, listener, options);
    this.listeners.push(() => target.removeEventListener(type, listener, options));
  }

  // ── 资源 ───────────────────────────────────────────────────────────

  private wireAssets(): void {
    const emblemSrc = this.assetBase + "council-emblem.svg";
    const markSrc = this.assetBase + "council-emblem-mark.svg";
    const reticleSrc = this.assetBase + "reticle-ring.svg";
    const emblemImg = this.root.querySelector<HTMLImageElement>(".su-emblem");
    const reticleImg = this.root.querySelector<HTMLImageElement>(".su-reticle-asset");
    const markImgs = Array.from(this.root.querySelectorAll<HTMLImageElement>(".su-mark"));

    if (emblemImg) {
      let settled = false;
      const settle = (ok: boolean): void => {
        if (settled) return;
        settled = true;
        this.root.classList.toggle("su-emblem-ready", ok);
        this.root.classList.toggle("su-emblem-missing", !ok);
        emblemImg.classList.toggle("is-failed", !ok);
        this.scene?.setEmblemState(ok ? "ready" : "missing");
      };
      emblemImg.addEventListener("load", () => settle(true), { once: true });
      emblemImg.addEventListener("error", () => settle(false), { once: true });
      emblemImg.src = emblemSrc;
      if (emblemImg.complete) settle(emblemImg.naturalWidth > 0);
    } else {
      this.scene?.setEmblemState("missing");
    }

    if (reticleImg) {
      let settled = false;
      const settle = (ok: boolean): void => {
        if (settled) return;
        settled = true;
        this.root.classList.toggle("su-reticle-ready", ok);
        this.scene?.setReticleAsset(ok);
      };
      reticleImg.addEventListener("load", () => settle(true), { once: true });
      reticleImg.addEventListener("error", () => settle(false), { once: true });
      reticleImg.src = reticleSrc;
      if (reticleImg.complete) settle(reticleImg.naturalWidth > 0);
    }

    if (markImgs.length > 0) {
      let anyReady = false;
      let settledCount = 0;
      const settleOne = (ok: boolean): void => {
        settledCount += 1;
        anyReady = anyReady || ok;
        if (anyReady) {
          this.root.classList.add("su-mark-ready");
          this.root.classList.remove("su-mark-missing");
        } else if (settledCount === markImgs.length) {
          this.root.classList.add("su-mark-missing");
        }
      };
      markImgs.forEach((img) => {
        img.addEventListener("load", () => settleOne(true), { once: true });
        img.addEventListener("error", () => settleOne(false), { once: true });
        img.src = markSrc;
        if (img.complete) settleOne(img.naturalWidth > 0);
      });
    }
  }

  // ── 主循环 ─────────────────────────────────────────────────────────

  private loop = (now: number): void => {
    if (this.resultValue) return;
    if (this.lastFrame === 0) this.lastFrame = now;
    const realDelta = Math.min(80, Math.max(0, now - this.lastFrame));
    this.lastFrame = now;
    if (!document.hidden) {
      this.clock += realDelta * this.speed * this.accel;
      this.runTasks();
      if (!this.resultValue) this.runTweens();
    }
    this.scene?.render(now);
    this.raf = window.requestAnimationFrame(this.loop);
  };

  /**
   * 真实时间定时器（不跟动画 clock 缩放）。
   * 用于黑幕 / 终幕入场：浏览器 rAF 被节流或性能很差时，文字也能在 1.5s 内出现。
   */
  private scheduleReal(ms: number, fn: () => void): void {
    const timer = window.setTimeout(() => {
      this.realTimers = this.realTimers.filter((id) => id !== timer);
      try {
        fn();
      } catch (error) {
        console.warn("[startup] real timer failed", error);
      }
    }, Math.max(0, ms));
    this.realTimers.push(timer);
  }

  private clearRealTimers(): void {
    for (const id of this.realTimers) window.clearTimeout(id);
    this.realTimers = [];
  }

  private schedule(ms: number, fn: () => void): void {
    this.tasks.push({ due: this.clock + Math.max(0, ms), fn });
    this.tasks.sort((a, b) => a.due - b.due);
  }

  private runTasks(): void {
    let guard = 0;
    while (guard < 400) {
      guard += 1;
      const index = this.tasks.findIndex((task) => task.due <= this.clock);
      if (index < 0) break;
      const [task] = this.tasks.splice(index, 1);
      try {
        task.fn();
      } catch (error) {
        console.warn("[startup] task failed", error);
      }
      if (this.resultValue) return;
    }
  }

  private addTween(duration: number, fn: (p: number) => void): void {
    const dur = Math.max(16, duration);
    this.tweens.push({ start: this.clock, dur, fn });
    fn(0);
  }

  private runTweens(): void {
    if (this.tweens.length === 0) return;
    const remain: Tween[] = [];
    for (const tween of this.tweens) {
      const p = clamp01((this.clock - tween.start) / tween.dur);
      try {
        tween.fn(p);
      } catch (error) {
        console.warn("[startup] tween failed", error);
      }
      if (p < 1) remain.push(tween);
    }
    this.tweens = remain;
  }

  /** 时长缩放：reduced-motion 时整体压缩到 45%；speed 由主循环缩放 clock，不在这里重复。 */
  private t(ms: number): number {
    return Math.max(16, ms * (this.reduced ? 0.45 : 1));
  }

  // ── 幕 / 步切换 ─────────────────────────────────────────────────────

  private setPhase(phase: StartupPhase, step = 0): void {
    if (this.phaseValue === phase && this.stepValue === step) return;
    this.phaseValue = phase;
    this.stepValue = step;
    this.accel = this.userAccelerated && phase === "auth" && step >= 3 ? 3.2 : 1;
    this.tasks = [];
    this.tweens = [];
    if (this.root) {
      this.root.dataset.phase = phase;
      this.root.dataset.step = String(step);
      this.root.dataset.scene = phase === "archive" || phase === "auth" || phase === "glitch" ? "paper" : "black";
    }
    if (this.scene) {
      if (phase === "welcome") this.scene.setMode("welcome");
      else if (phase === "archive" || phase === "auth" || phase === "glitch") this.scene.setMode("paper");
      else if (phase === "done") this.scene.setMode("none");
      else this.scene.setMode("black");
    }
    this.emitProgress();
  }

  private emitProgress(): void {
    const progress: StartupProgress = { phase: this.phaseValue, step: this.stepValue };
    if (this.liveEl) {
      const label = PHASE_LABEL[progress.phase];
      this.liveEl.textContent = progress.step > 0
        ? label + " · 第" + progress.step + "步 " + (AUTH_STEP_LABEL[progress.step - 1] ?? "")
        : label;
    }
    const elapsed = Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - this.startedAt);
    console.info("[startup] " + progress.phase + (progress.step ? " step=" + progress.step : "") + " (+" + elapsed + "ms)");
    try {
      this.options.onPhase?.(progress);
    } catch (error) {
      console.warn("[startup] onPhase failed", error);
    }
    try {
      window.dispatchEvent(new CustomEvent<StartupProgress>(STARTUP_EVENT, { detail: progress }));
    } catch {
      /* ignore */
    }
  }

  // ── 第一幕：黑幕 ───────────────────────────────────────────────────

  private beginIntro(): void {
    this.root.dataset.scene = "black";
    this.updateAct("ACT 01 / 06 · 黑幕 / BLACK");
    this.scene?.setMode("black");
    // 入场使用真实时间定时器：即使 rAF 被低性能/后台标签拖慢，1.5s 内文字也必然出现
    this.scheduleReal(120, () => this.blackEl.classList.add("is-emblem"));
    this.scheduleReal(320, () => this.blackEl.classList.add("is-zh"));
    this.scheduleReal(620, () => {
      this.blackEl.classList.add("is-en");
      this.typeInto(this.introEn, INTRO_EN, 26);
    });
    this.scheduleReal(1020, () => this.blackEl.classList.add("is-tag"));
    this.scheduleReal(1420, () => this.blackEl.classList.add("is-cta"));
    this.scheduleReal(260, () => this.root.classList.add("is-foot"));
    this.scheduleReal(200, () => this.updateEmblemRect());
    // 黑幕停留 4–5 秒：无操作自动进入过曝洗白；用户点击 / Enter / Space 可提前推进
    this.scheduleReal(4800, () => {
      if (this.phaseValue === "black" && !this.resultValue) this.beginWash();
    });
  }

  private typeInto(el: HTMLElement, text: string, perChar: number): void {
    const out = el.querySelector<HTMLElement>(".su-typed");
    if (!out) return;
    out.textContent = "";
    if (this.reduced) {
      out.textContent = text;
      el.classList.add("is-typed");
      return;
    }
    for (let index = 1; index <= text.length; index += 1) {
      this.scheduleReal(index * perChar, () => {
        out.textContent = text.slice(0, index);
      });
    }
    this.scheduleReal(text.length * perChar + 900, () => el.classList.add("is-typed"));
  }

  private beginWash(): void {
    if (this.phaseValue !== "black") return;
    this.audio?.cue("advance");
    this.setPhase("wash");
    this.blackEl.classList.add("is-out");
    this.root.classList.add("su-washing");
    this.scene?.playFlash();
    this.schedule(this.t(540), () => this.enterArchive());
  }

  // ── 第三幕：白纸档案底板 ───────────────────────────────────────────

  private enterArchive(): void {
    this.setPhase("archive");
    this.updateAct("ACT 03 / 06 · 技术档案 / ARCHIVE");
    this.pageNoEl.textContent = "03 / 06";
    this.blackEl.setAttribute("aria-hidden", "true");
    this.paperEl.setAttribute("aria-hidden", "false");
    this.scene?.setMode("paper");
    this.scene?.playReveal();
    this.audio?.cue("load");
    this.schedule(this.t(70), () => this.paperEl.classList.add("is-in"));
    this.schedule(this.t(260), () => this.paperEl.classList.add("is-head"));
    this.schedule(this.t(430), () => this.paperEl.classList.add("is-doc"));
    this.schedule(this.t(640), () => {
      this.paperEl.classList.add("is-orbit");
      this.addTween(this.t(1100), (p) => this.scene?.setOrbitProgress(0.62 * p));
    });
    this.schedule(this.t(860), () => {
      this.paperEl.classList.add("is-log");
      this.runBootLog();
    });
    this.schedule(this.t(1960), () => {
      this.paperEl.classList.add("is-console");
      this.audio?.cue("advance");
    });
    this.schedule(this.t(2250), () => this.enterStep(1));
  }

  private runBootLog(): void {
    const items = Array.from(this.logEl.querySelectorAll<HTMLElement>(".su-log-line"));
    items.forEach((item, index) => {
      this.schedule(this.t(index * 150), () => {
        item.classList.add("is-on");
        this.selfcheckPct.textContent = String(index + 1).padStart(2, "0") + " / " + String(items.length).padStart(2, "0");
      });
    });
    this.schedule(this.t(items.length * 150 + 180), () => {
      this.logEl.classList.add("is-done");
      this.selfcheckPct.textContent = items.length + " / " + items.length;
    });
  }

  // ── 第四幕：五步存续授权 ───────────────────────────────────────────

  private enterStep(step: number): void {
    this.setPhase("auth", step);
    this.updateAct("ACT 04 / 06 · 存续授权 / CLEARANCE");
    this.pageNoEl.textContent = "04 / 06";
    this.consoleCount.textContent = "0" + step + " / 05";
    this.slats.forEach((slat, index) => {
      slat.classList.toggle("is-past", index < step - 1);
      slat.classList.toggle("is-on", index === step - 1);
    });
    this.panels.forEach((panel, index) => {
      const on = index === step - 1;
      panel.classList.toggle("is-on", on);
      panel.setAttribute("aria-hidden", on ? "false" : "true");
    });
    this.updateConsoleHint(step);
    if (step <= 2) {
      this.advanceLockUntil = this.clock + this.t(420);
      this.schedule(this.t(120), () => this.focusPanelButton(step));
    }
    if (step === 5) {
      this.paperStatus.textContent = "已授权 / AUTHORIZED";
      this.paperStatus.classList.add("is-granted");
    }
  }

  private updateConsoleHint(step: number, accelerated = false): void {
    if (step >= 3) {
      this.consoleHint.innerHTML = accelerated
        ? "<kbd>ACCELERATED</kbd> 加速中 · <kbd>ESC</kbd> 跳过"
        : "<kbd>CLICK</kbd> 加速 · <kbd>ESC</kbd> 跳过";
    } else {
      this.consoleHint.innerHTML = "<kbd>ENTER</kbd> / <kbd>SPACE</kbd> 继续 · <kbd>ESC</kbd> 跳过";
    }
  }

  private focusPanelButton(step: number): void {
    const panel = this.panels[step - 1];
    const button = panel?.querySelector<HTMLButtonElement>("[data-su-advance]");
    try {
      button?.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
  }

  private accelerate(): void {
    if (this.accel > 1) return;
    this.userAccelerated = true;
    this.accel = 3.2;
    this.audio?.cue("click");
    this.root.classList.add("su-accelerated");
    this.updateConsoleHint(this.stepValue, true);
  }

  private startAuto(step: number): void {
    const panel = this.panels[step - 1];
    if (!panel) return;
    if (step === 3) {
      const bar = panel.querySelector<HTMLElement>(".su-progress-bar");
      const num = panel.querySelector<HTMLElement>(".su-progress-num");
      const rows = Array.from(panel.querySelectorAll<HTMLElement>(".su-row"));
      const marks = [0.22, 0.5, 0.8];
      const locked = rows.map(() => false);
      this.audio?.cue("load");
      this.addTween(this.t(1900), (p) => {
        if (bar) bar.style.width = (p * 100).toFixed(1) + "%";
        if (num) num.textContent = String(Math.round(p * 100)).padStart(3, "0") + "%";
        rows.forEach((row, index) => {
          if (!locked[index] && p >= marks[index]) {
            locked[index] = true;
            row.classList.add("is-pass");
            const state = row.querySelector<HTMLElement>(".su-row-state");
            if (state) state.textContent = "已锁定 / LOCKED";
            this.audio?.cue("click");
          }
        });
        this.scene?.setOrbitProgress(0.62 + 0.38 * p);
      });
      this.schedule(this.t(2160), () => this.completeAuto(3, 320));
    } else if (step === 4) {
      const bar = panel.querySelector<HTMLElement>(".su-progress-bar");
      const num = panel.querySelector<HTMLElement>(".su-progress-num");
      const rows = Array.from(panel.querySelectorAll<HTMLElement>(".su-row"));
      const values = Array.from(panel.querySelectorAll<HTMLElement>(".su-row-value"));
      this.addTween(this.t(1650), (p) => {
        values.forEach((value) => {
          const from = Number(value.dataset.from ?? "0");
          const to = Number(value.dataset.to ?? "0");
          const digits = Number(value.dataset.digits ?? "2");
          const suffix = value.dataset.suffix ?? "";
          value.textContent = (from + (to - from) * p).toFixed(digits) + suffix;
        });
        if (bar) bar.style.width = (p * 100).toFixed(1) + "%";
        if (num) num.textContent = String(Math.round(p * 100)).padStart(3, "0") + "%";
      });
      this.schedule(this.t(1740), () => {
        rows.forEach((row, index) => {
          this.schedule(this.t(index * 130), () => {
            row.classList.add("is-pass");
            const state = row.querySelector<HTMLElement>(".su-row-state");
            if (state) state.textContent = "通过 / PASS";
          });
        });
        this.audio?.cue("verify");
      });
      this.schedule(this.t(2040), () => this.completeAuto(4, 380));
    } else if (step === 5) {
      const rows = Array.from(panel.querySelectorAll<HTMLElement>(".su-row"));
      this.schedule(this.t(140), () => {
        this.scene?.playGrant();
        panel.classList.add("is-stamp");
        this.audio?.cue("granted");
      });
      rows.forEach((row, index) => {
        this.schedule(this.t(260 + index * 160), () => row.classList.add("is-pass"));
      });
      this.schedule(this.t(1900), () => this.completeAuto(5, 1350));
    }
  }

  private completeAuto(step: number, hold: number): void {
    const panel = this.panels[step - 1];
    panel?.classList.add("is-done");
    this.schedule(this.t(hold), () => {
      if (step >= 5) {
        this.beginGlitch();
      } else {
        const next = step + 1;
        this.enterStep(next);
        this.startAuto(next);
      }
    });
  }

  // ── 第五幕：色散故障揭幕 ───────────────────────────────────────────

  private beginGlitch(): void {
    this.setPhase("glitch");
    this.updateAct("ACT 05 / 06 · 色散揭幕 / REVEAL");
    this.pageNoEl.textContent = "05 / 06";
    this.audio?.cue("verify");
    this.root.classList.add("su-glitching");
    this.paperEl.classList.add("is-glitching");
    this.scene?.playGlitch();
    this.schedule(this.t(470), () => this.enterWelcome());
  }

  // ── 第六幕：终幕欢迎 ───────────────────────────────────────────────

  private enterWelcome(): void {
    this.setPhase("welcome");
    this.updateAct("ACT 06 / 06 · 终幕 / WELCOME");
    this.pageNoEl.textContent = "06 / 06";
    this.root.classList.remove("su-glitching");
    this.paperEl.setAttribute("aria-hidden", "true");
    this.blackEl.setAttribute("aria-hidden", "false");
    this.blackEl.classList.remove("is-out");
    this.blackEl.classList.add("is-welcome");
    this.scene?.setMode("welcome");
    this.audio?.cue("welcome");
    this.updateEmblemRectAsync();
    this.scheduleReal(140, () => this.blackEl.classList.add("is-welcome-emblem"));
    this.scheduleReal(320, () => this.blackEl.classList.add("is-welcome-zh"));
    this.scheduleReal(560, () => {
      this.blackEl.classList.add("is-welcome-en");
      this.typeInto(this.welcomeEn, WELCOME_EN, 34);
    });
    this.scheduleReal(1240, () => this.blackEl.classList.add("is-welcome-sub"));
    this.scheduleReal(1520, () => this.blackEl.classList.add("is-welcome-hint"));
    // 安全兜底：无操作 15 秒后也进入游戏，避免玩家被困在终幕
    this.scheduleReal(15000, () => this.finish("completed"));
  }

  // ── 收尾 ───────────────────────────────────────────────────────────

  private finish(result: StartupResult): void {
    if (this.resultValue) return;
    this.resultValue = result;
    if (this.remember) writeSessionPlayed();
    this.clearRealTimers();
    this.setPhase("done");
    this.root.dataset.scene = "black";
    this.root.classList.add("su-leaving");
    this.skipEl.disabled = true;
    const done = (): void => {
      this.teardown();
      const resolve = this.resolveFn;
      this.resolveFn = null;
      resolve?.(result);
    };
    window.setTimeout(done, this.reduced ? 160 : 420);
  }

  private teardown(): void {
    this.clearRealTimers();
    if (this.raf) {
      window.cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    this.emblemRo?.disconnect();
    this.emblemRo = null;
    for (const remove of this.listeners) {
      try {
        remove();
      } catch {
        /* ignore */
      }
    }
    this.listeners = [];
    this.scene?.dispose();
    this.scene = null;
    this.audio?.dispose();
    this.audio = null;
    this.root?.remove();
    document.documentElement.classList.remove("su-lock");
    dismissStartupBootVeil();
    const previous = this.lastFocused;
    if (previous instanceof HTMLElement && document.contains(previous)) {
      try {
        previous.focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
    }
    if (activeController === this) activeController = null;
  }

  // ── 事件 ───────────────────────────────────────────────────────────

  private onFirstGesture = (): void => {
    this.audio?.unlock();
  };

  private onClick = (event: MouseEvent): void => {
    if (this.resultValue) return;
    const target = event.target as HTMLElement | null;
    if (!target || !this.root.contains(target)) return;
    if (target.closest(".su-skip")) return;
    const advanceButton = target.closest<HTMLElement>("[data-su-advance]");
    if (advanceButton) {
      event.preventDefault();
      this.advance();
      return;
    }
    if (this.phaseValue === "black" || this.phaseValue === "welcome") {
      this.advance();
      return;
    }
    if (this.phaseValue === "auth" && this.stepValue >= 3) this.accelerate();
  };

  private onSkipClick = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    this.skip();
  };

  private onKeyDown = (event: Event): void => {
    const keyboard = event as KeyboardEvent;
    if (this.resultValue) return;
    this.audio?.unlock();
    if (keyboard.key === "Escape") {
      if (this.allowSkip) {
        keyboard.preventDefault();
        this.skip();
      }
      return;
    }
    if (keyboard.key === "Tab") {
      this.trapFocus(keyboard);
      return;
    }
    const confirm = keyboard.key === "Enter" || keyboard.key === " " || keyboard.code === "Space";
    if (!confirm) return;
    const target = keyboard.target as HTMLElement | null;
    if (target && typeof target.closest === "function" && target.closest("button")) return;
    keyboard.preventDefault();
    this.advance();
  };

  private trapFocus(event: KeyboardEvent): void {
    const focusables = Array.from(
      this.root.querySelectorAll<HTMLElement>("button:not([disabled]):not([hidden])"),
    ).filter((el) => {
      const style = getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    });
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (!active || !focusables.includes(active)) {
      event.preventDefault();
      first.focus({ preventScroll: true });
      return;
    }
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  private onResize = (): void => {
    this.scene?.resize();
    this.updateEmblemRectAsync();
  };

  private onVisibility = (): void => {
    if (!document.hidden) this.lastFrame = 0;
  };

  // ── 小工具 ─────────────────────────────────────────────────────────

  private updateAct(text: string): void {
    if (this.actEl) this.actEl.textContent = text;
  }

  private updateEmblemRect(): void {
    if (!this.scene || !this.emblemSlot) return;
    const rect = this.emblemSlot.getBoundingClientRect();
    this.scene.setEmblemRect({
      x: rect.x,
      y: rect.y,
      w: rect.width,
      h: rect.height,
    });
  }

  private updateEmblemRectAsync(): void {
    window.requestAnimationFrame(() => this.updateEmblemRect());
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 模块级单例与公开 API
// ────────────────────────────────────────────────────────────────────────────

let activeController: StartupController | null = null;
let activeRun: Promise<StartupResult> | null = null;

/**
 * 播放启动动画。
 *
 * - remember（默认 true）时，若本会话已播放过则立即 resolve "skipped"；
 * - force: true 忽略记录强制播放；
 * - 同一时间只允许一个实例，重复调用返回同一个 Promise。
 */
export function runStartup(options: StartupOptions = {}): Promise<StartupResult> {
  if (activeRun) return activeRun;
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve<StartupResult>("skipped");
  }
  // 页面已能执行本模块：先把 index.html 的首屏黑幕撤掉（本会话已播放时会立即返回 skipped）。
  dismissStartupBootVeil();
  const remember = options.remember !== false;
  if (remember && options.force !== true && readSessionPlayed()) {
    console.info("[startup] already played this session — skipped");
    return Promise.resolve<StartupResult>("skipped");
  }
  const controller = new StartupController(options);
  activeController = controller;
  const run = controller.start().finally(() => {
    if (activeController === controller) activeController = null;
    activeRun = null;
  });
  activeRun = run;
  return run;
}

/** 重播启动动画（忽略本次会话记录；若正在播放则先跳过当前实例）。 */
export async function replayStartup(options: StartupOptions = {}): Promise<StartupResult> {
  const running = activeRun;
  if (running) {
    activeController?.skip();
    try {
      await running;
    } catch {
      /* ignore */
    }
  }
  return runStartup({ ...options, force: true });
}

/** 当前正在播放的实例（E2E / 预览页 / 帮助入口用）；未播放时返回 null。 */
export function getStartupHandle(): StartupHandle | null {
  return activeController;
}
