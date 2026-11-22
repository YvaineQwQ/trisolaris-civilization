/**
 * 启动动画的 WebAudio 合成轻提示（v1.4 · src/startup 私有模块）。
 *
 * 不加载任何音频文件，全部由振荡器实时合成 —— 因此没有任何版权素材。
 * 浏览器要求先有用户手势才能出声，所以：
 *   - 模块默认不创建 AudioContext；
 *   - 首次 pointerdown / keydown 时才 unlock()；
 *   - 音量压得很低（主增益 0.32，单音 ≤ 0.09），只做"哒 / 提示 / 授权和弦"。
 */

export type StartupCue =
  | "click"
  | "advance"
  | "load"
  | "verify"
  | "granted"
  | "welcome"
  | "skip";

interface CueSpec {
  /** [频率 Hz, 相对开始时间 s, 时长 s, 音量, 波形] */
  tone: [number, number, number, number, OscillatorType][];
  /** 起始滑音（可选）：从 startFreq 滑到 endFreq */
  glide?: { from: number; to: number; at: number; dur: number; gain: number };
}

const CUES: Record<StartupCue, CueSpec> = {
  click: { tone: [[1180, 0, 0.035, 0.05, "sine"], [900, 0.028, 0.03, 0.035, "sine"]] },
  advance: {
    tone: [
      [660, 0, 0.04, 0.05, "sine"],
      [990, 0.055, 0.05, 0.045, "sine"],
    ],
  },
  load: { tone: [[440, 0, 0.03, 0.03, "sine"], [660, 0.12, 0.03, 0.03, "sine"], [880, 0.24, 0.035, 0.028, "sine"]] },
  verify: { tone: [[880, 0, 0.04, 0.045, "triangle"], [1320, 0.05, 0.05, 0.04, "sine"]] },
  granted: {
    tone: [
      [523.25, 0, 0.5, 0.055, "sine"],
      [659.25, 0.02, 0.55, 0.045, "sine"],
      [783.99, 0.04, 0.62, 0.038, "sine"],
      [1046.5, 0.08, 0.45, 0.022, "sine"],
    ],
  },
  welcome: {
    tone: [
      [392, 0, 0.7, 0.05, "sine"],
      [587.33, 0.05, 0.65, 0.04, "sine"],
      [783.99, 0.1, 0.6, 0.03, "sine"],
      [1567.98, 0.16, 0.5, 0.018, "sine"],
    ],
  },
  skip: { tone: [[520, 0, 0.06, 0.04, "sine"], [300, 0.06, 0.09, 0.035, "sine"]] },
};

export class StartupAudio {
  private enabled: boolean;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private unlocked = false;
  private disposed = false;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  /**
   * 首次用户手势时调用；创建并恢复 AudioContext。
   * 无音频设备 / 自动播放策略拒绝 / 浏览器不支持时一律静默降级：
   * 动画继续，只是没有提示音（QA 日志里不应出现未捕获的 AudioContext 错误）。
   */
  unlock(): void {
    if (this.disposed || !this.enabled || this.unlocked) return;
    this.unlocked = true;
    try {
      if (typeof window.AudioContext === "undefined"
        && typeof (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext === "undefined") {
        this.enabled = false;
        return;
      }
      const activation = typeof navigator !== "undefined" ? navigator.userActivation : undefined;
      if (activation && activation.hasBeenActive === false) return;
      const Ctor = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        this.enabled = false;
        return;
      }
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = 0.32;
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      if (ctx.state === "suspended") {
        // 自动播放策略：拒绝时静默关闭音效，不向上抛
        ctx.resume().catch(() => {
          this.enabled = false;
        });
      }
    } catch {
      this.ctx = null;
      this.master = null;
      this.enabled = false;
    }
  }

  cue(name: StartupCue): void {
    const ctx = this.ctx;
    const master = this.master;
    if (this.disposed || !this.enabled || !ctx || !master) return;
    const spec = CUES[name];
    const t0 = ctx.currentTime + 0.01;
    try {
      for (const [freq, at, dur, gain, type] of spec.tone) {
        const osc = ctx.createOscillator();
        const amp = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0 + at);
        amp.gain.setValueAtTime(0.0001, t0 + at);
        amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + at + 0.012);
        amp.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
        osc.connect(amp);
        amp.connect(master);
        osc.start(t0 + at);
        osc.stop(t0 + at + dur + 0.02);
      }
      if (spec.glide) {
        const glide = spec.glide;
        const osc = ctx.createOscillator();
        const amp = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(glide.from, t0 + glide.at);
        osc.frequency.exponentialRampToValueAtTime(glide.to, t0 + glide.at + glide.dur);
        amp.gain.setValueAtTime(0.0001, t0 + glide.at);
        amp.gain.exponentialRampToValueAtTime(glide.gain, t0 + glide.at + 0.01);
        amp.gain.exponentialRampToValueAtTime(0.0001, t0 + glide.at + glide.dur);
        osc.connect(amp);
        amp.connect(master);
        osc.start(t0 + glide.at);
        osc.stop(t0 + glide.at + glide.dur + 0.02);
      }
    } catch {
      /* 音频失败不影响动画 */
    }
  }

  dispose(): void {
    this.disposed = true;
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    if (ctx) {
      try {
        void ctx.close().catch(() => undefined);
      } catch {
        /* ignore */
      }
    }
  }
}
