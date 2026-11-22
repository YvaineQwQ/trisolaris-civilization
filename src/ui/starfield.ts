/** Procedural animated star field used behind the menu and setup screens. */

export interface StarfieldOptions {
  density?: number;
  seed?: number;
  driftSpeed?: number;
  constellationLines?: boolean;
  warmRatio?: number;
}

interface Star {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  twinkleSpeed: number;
  phase: number;
  depth: number;
  warm: boolean;
}

function lcg(seed: number): () => number {
  let state = (seed >>> 0) || 0x9e3779b9;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Render an animated parallax star field. Safe when 2D canvas is unavailable. */
export function createStarfield(canvas: HTMLCanvasElement, options: StarfieldOptions = {}): { destroy(): void } {
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    ctx = null;
  }
  const density = options.density ?? 240;
  const baseSeed = options.seed ?? 20250415;
  const drift = options.driftSpeed ?? 1;
  const drawLines = options.constellationLines ?? true;
  const warmRatio = options.warmRatio ?? 0.16;

  let width = 1;
  let height = 1;
  let dpr = 1;
  let stars: Star[] = [];
  let brightStars: Star[] = [];
  let running = true;
  const start = now();

  function now(): number {
    return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
  }

  function regenerate(): void {
    const rand = lcg(baseSeed + Math.round(width) * 31 + Math.round(height) * 17);
    const count = Math.max(60, Math.round((density * width * height) / (1920 * 1080)));
    stars = [];
    for (let i = 0; i < count; i += 1) {
      const depth = 0.35 + rand() * 0.65;
      stars.push({
        x: rand() * width,
        y: rand() * height,
        radius: (rand() < 0.06 ? 1.6 : 0.4) + rand() * 1.15 * depth,
        baseAlpha: 0.22 + rand() * 0.72,
        twinkleSpeed: 0.0004 + rand() * 0.0016,
        phase: rand() * Math.PI * 2,
        depth,
        warm: rand() < warmRatio,
      });
    }
    brightStars = stars.filter((star) => star.radius > 1.35).slice(0, 14);
  }

  function resize(): void {
    let rectW = 0;
    let rectH = 0;
    try {
      const rect = canvas.getBoundingClientRect();
      rectW = rect.width;
      rectH = rect.height;
    } catch {
      rectW = 0;
      rectH = 0;
    }
    const winW = typeof window !== "undefined" ? window.innerWidth || 1280 : 1280;
    const winH = typeof window !== "undefined" ? window.innerHeight || 720 : 720;
    width = Math.max(1, Math.round(rectW || winW));
    height = Math.max(1, Math.round(rectH || winH));
    dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    regenerate();
  }

  function draw(t: number): void {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    const seconds = (t - start) / 1000;
    for (const star of stars) {
      const driftY = (seconds * 3.2 * star.depth * drift) % height;
      const y = (star.y + driftY) % height;
      const x = (star.x + seconds * 0.45 * star.depth * drift) % width;
      const twinkle = 0.65 + 0.35 * Math.sin(star.phase + t * star.twinkleSpeed);
      const alpha = Math.min(1, star.baseAlpha * twinkle);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = star.warm ? "#ffd9a8" : star.radius > 1.3 ? "#bfe8ff" : "#9fc6e8";
      ctx.beginPath();
      ctx.arc(x, y, star.radius, 0, Math.PI * 2);
      ctx.fill();
      if (star.radius > 1.5) {
        ctx.globalAlpha = alpha * 0.4;
        ctx.strokeStyle = star.warm ? "#ffcf9a" : "#a9dcff";
        ctx.lineWidth = 0.6;
        const len = star.radius * 3.4;
        ctx.beginPath();
        ctx.moveTo(x - len, y);
        ctx.lineTo(x + len, y);
        ctx.moveTo(x, y - len);
        ctx.lineTo(x, y + len);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    if (drawLines && brightStars.length > 2) {
      ctx.strokeStyle = "rgba(90, 180, 255, 0.12)";
      ctx.lineWidth = 0.7;
      for (let i = 0; i < brightStars.length - 1; i += 1) {
        if (i % 2 === 1) continue;
        const a = brightStars[i];
        const b = brightStars[i + 1];
        const ay = (a.y + (seconds * 3.2 * a.depth * drift) % height) % height;
        const by = (b.y + (seconds * 3.2 * b.depth * drift) % height) % height;
        ctx.beginPath();
        ctx.moveTo(a.x, ay);
        ctx.lineTo(b.x, by);
        ctx.stroke();
      }
    }
  }

  resize();
  const onResize = (): void => resize();
  if (typeof window !== "undefined") window.addEventListener("resize", onResize);

  let frame = 0;
  const loop = (): void => {
    if (!running) return;
    frame = requestAnimationFrame(loop);
    if (typeof performance !== "undefined" && performance.now) draw(performance.now());
    else draw(Date.now());
  };
  const useRaf = typeof requestAnimationFrame === "function";
  if (useRaf) frame = requestAnimationFrame(loop);
  else {
    // jsdom / test fallback: draw a single static frame, no timers.
    draw(0);
  }

  return {
    destroy() {
      running = false;
      if (useRaf) cancelAnimationFrame(frame);
      if (typeof window !== "undefined") window.removeEventListener("resize", onResize);
    },
  };
}

/** CSS-only fallback that is always mounted behind the canvas. */
export function starfieldFallbackClass(): string {
  return "tri-starfield-fallback";
}
