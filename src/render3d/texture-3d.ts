/**
 * texture-3d.ts —— 3D 近景贴图的惰性加载器（public/textures/**）。
 *
 * 设计约束（docs/V4_SPEC.md §4.1/§4.2）：
 *  - 贴图只在天体进入近景时按需加载（lazy），全景模式完全不请求图片，省流量也省显存；
 *  - 文件由 texture-art 并行生成，可能尚未就绪：加载器先尝试 manifest.json 中登记的路径，
 *    再按约定回退到 /textures/<stem>.jpg → /textures/<stem>.png；全部失败只记录状态，
 *    材质继续使用程序化回退色 —— 3D 视图绝不为缺图抛异常或黑屏；
 *  - 所有颜色贴图设置 SRGBColorSpace（three r170 输出空间为 sRGB，避免双重伽马导致偏灰/偏暗），
 *    经度方向 RepeatWrapping 保证等距圆柱贴图无缝；
 *  - 生成派生的“海洋高光遮罩”（由自有贴图程序化推导，无外部素材），供母星 Phong 材质使用；
 *  - 无 DOM / jsdom 环境下 getContext 不可用 → 全部返回 null，不抛异常。
 *
 * 本模块不读取模拟真值，只处理图片资源。
 */
import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from "three";

/** 4 个天体共 6 张贴图（母星三张：昼面 / 云层 / 夜面灯光）。 */
export type BodyTextureId =
  | "star-a"
  | "star-b"
  | "star-c"
  | "planet-day"
  | "planet-clouds"
  | "planet-night"
  /* 可选贴图（texture-art 额外提供时使用，缺失不影响功能） */
  | "planet-water-mask"
  | "planet-normal";

export type TextureLoadState = "idle" | "loading" | "loaded" | "error" | "unsupported";

export const BODY_TEXTURE_IDS: readonly BodyTextureId[] = [
  "star-a",
  "star-b",
  "star-c",
  "planet-day",
  "planet-clouds",
  "planet-night",
];

/** 天体 id → 恒星贴图（母星贴图由 planet 相关逻辑显式请求）。 */
export function starTextureId(starId: string): BodyTextureId | null {
  if (starId === "A") return "star-a";
  if (starId === "B") return "star-b";
  if (starId === "C") return "star-c";
  return null;
}

const TEXTURE_BASE = "/textures/";
const MANIFEST_URL = TEXTURE_BASE + "manifest.json";
/** 各贴图的优先扩展名（manifest 未命中时按此顺序回退，尽量少产生 404）。 */
const PREFERRED_EXTS: Record<string, readonly string[]> = {
  "star-a": ["jpg", "png"],
  "star-b": ["jpg", "png"],
  "star-c": ["jpg", "png"],
  "planet-day": ["jpg", "png"],
  "planet-clouds": ["png", "jpg"],
  "planet-night": ["jpg", "png"],
  "planet-water-mask": ["jpg", "png"],
  "planet-normal": ["jpg", "png"],
};

interface TextureEntry {
  id: BodyTextureId;
  state: TextureLoadState;
  texture: Texture | null;
  /** manifest 中发现的真实路径（可能带子目录）。 */
  resolvedUrl: string | null;
  urls: string[];
  error: string | null;
}

interface ManifestLookup {
  value: Record<string, string>;
  done: boolean;
  promise: Promise<void> | null;
}

let maxAnisotropy = 4;

/** 从 manifest.json 里扫描出 <stem>.(jpg|png) 路径；结构未知也能用（递归找字符串）。 */
function collectManifestPaths(value: unknown, out: Record<string, string>, depth = 0): void {
  if (depth > 8 || value === null || value === undefined) return;
  if (typeof value === "string") {
    const match = /([a-z0-9-]+)\.(jpe?g|png)$/i.exec(value.trim());
    if (!match) return;
    const stem = match[1].toLowerCase();
    if (!out[stem]) out[stem] = toPublicUrl(value);
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) collectManifestPaths(value[i], out, depth + 1);
    return;
  }
  if (typeof value === "object") {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      collectManifestPaths((value as Record<string, unknown>)[key], out, depth + 1);
    }
  }
}

/** 任意 manifest 写法的路径 → 浏览器可访问的 /textures/... URL。 */
function toPublicUrl(raw: string): string {
  let p = raw.trim().replace(/\\/g, "/");
  if (/^https?:\/\//i.test(p)) return p;
  const idx = p.toLowerCase().lastIndexOf("textures/");
  if (idx >= 0) p = p.slice(idx);
  else p = p.replace(/^\.?\//, "");
  if (p.startsWith("textures/")) p = "/" + p;
  else p = TEXTURE_BASE + p;
  return p;
}

function supportsDom(): boolean {
  return typeof document !== "undefined" && typeof document.createElement === "function";
}

/**
 * 3D 贴图库（模块单例，所有 3D 渲染器共享；最后一个渲染器销毁时释放）。
 */
export class TextureLibrary3D {
  private readonly entries = new Map<BodyTextureId, TextureEntry>();
  private readonly listeners = new Set<() => void>();
  private readonly manifest: ManifestLookup = { value: {}, done: false, promise: null };

  setMaxAnisotropy(value: number): void {
    if (Number.isFinite(value) && value >= 1) maxAnisotropy = Math.min(16, Math.max(1, Math.round(value)));
  }

  /** 已加载的贴图；未加载返回 null（调用方继续用回退材质）。 */
  get(id: BodyTextureId): Texture | null {
    return this.entries.get(id)?.texture ?? null;
  }

  status(id: BodyTextureId): TextureLoadState {
    return this.entries.get(id)?.state ?? "idle";
  }

  /** 状态快照（HUD 性能行 / QA 调试用）。 */
  snapshot(): Record<string, TextureLoadState> {
    const out: Record<string, TextureLoadState> = {};
    for (const id of BODY_TEXTURE_IDS) out[id] = this.status(id);
    return out;
  }

  loadedCount(): { loaded: number; total: number; pending: number } {
    let loaded = 0;
    let pending = 0;
    for (const id of BODY_TEXTURE_IDS) {
      const state = this.status(id);
      if (state === "loaded") loaded += 1;
      else if (state === "loading") pending += 1;
    }
    return { loaded, pending, total: BODY_TEXTURE_IDS.length };
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 惰性请求贴图：重复调用安全；所有回调只会在主线程异步触发。 */
  request(id: BodyTextureId): void {
    const entry = this.ensureEntry(id);
    if (entry.state !== "idle") return;
    if (!supportsDom()) {
      entry.state = "unsupported";
      return;
    }
    entry.state = "loading";
    void this.loadManifest().then(() => this.loadNext(entry, 0));
  }

  /** 请求某个天体近景需要的全部贴图。 */
  requestForBody(bodyId: "A" | "B" | "C" | "planet"): void {
    if (bodyId === "planet") {
      this.request("planet-day");
      this.request("planet-clouds");
      this.request("planet-night");
      // 可选增强：海洋遮罩（提高高光准确度）与法线（当前未启用，先加载留给后续）。
      this.request("planet-water-mask");
      this.request("planet-normal");
      return;
    }
    const id = starTextureId(bodyId);
    if (id) this.request(id);
  }

  /** 当前已加载贴图总数（用于 HUD 读数）。 */
  private ensureEntry(id: BodyTextureId): TextureEntry {
    const existing = this.entries.get(id);
    if (existing) return existing;
    const entry: TextureEntry = {
      id,
      state: "idle",
      texture: null,
      resolvedUrl: null,
      urls: [],
      error: null,
    };
    this.entries.set(id, entry);
    return entry;
  }

  private loadManifest(): Promise<void> {
    if (this.manifest.done) return Promise.resolve();
    if (this.manifest.promise) return this.manifest.promise;
    this.manifest.promise = (async () => {
      try {
        const res = await fetch(MANIFEST_URL, { cache: "no-cache" });
        if (res.ok) {
          const raw: unknown = await res.json();
          collectManifestPaths(raw, this.manifest.value);
        }
      } catch {
        /* manifest 不存在或不可解析：完全走约定路径回退 */
      }
      this.manifest.done = true;
      this.manifest.promise = null;
    })();
    return this.manifest.promise;
  }

  private loadNext(entry: TextureEntry, index: number): void {
    if (entry.state !== "loading") return;
    if (index === 0) entry.urls = this.urlCandidates(entry.id);
    if (index >= entry.urls.length) {
      entry.state = "error";
      entry.error = "贴图不可用（manifest 与 /textures/<stem>.jpg|.png 均未命中）";
      this.emitChange();
      return;
    }
    const url = entry.urls[index];
    let loader: TextureLoader;
    try {
      loader = new TextureLoader();
    } catch {
      entry.state = "unsupported";
      this.emitChange();
      return;
    }
    try {
      loader.load(
        url,
        (texture) => {
          if (entry.state !== "loading") {
            try {
              texture.dispose();
            } catch {
              /* ignore */
            }
            return;
          }
          entry.resolvedUrl = url;
          entry.texture = this.configureTexture(texture);
          entry.state = "loaded";
          this.emitChange();
        },
        undefined,
        () => {
          this.loadNext(entry, index + 1);
        },
      );
    } catch {
      this.loadNext(entry, index + 1);
    }
  }

  private urlCandidates(id: BodyTextureId): string[] {
    const urls: string[] = [];
    const push = (url: string): void => {
      if (url && urls.indexOf(url) < 0) urls.push(url);
    };
    const fromManifest = this.manifest.value[id];
    if (fromManifest) push(fromManifest);
    const exts = PREFERRED_EXTS[id] ?? ["jpg", "png"];
    for (const ext of exts) push(TEXTURE_BASE + id + "." + ext);
    return urls;
  }

  /** 统一配置颜色贴图（sRGB / mipmap / 各向异性 / 经度重复）。 */
  private configureTexture(texture: Texture): Texture {
    try {
      texture.colorSpace = SRGBColorSpace;
      texture.wrapS = RepeatWrapping;
      texture.wrapT = ClampToEdgeWrapping;
      texture.minFilter = LinearMipmapLinearFilter;
      texture.magFilter = LinearFilter;
      texture.anisotropy = maxAnisotropy;
      texture.needsUpdate = true;
    } catch {
      /* 个别驱动属性不可写：保持默认 */
    }
    return texture;
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch {
        /* 通知失败不影响渲染 */
      }
    });
  }

  dispose(): void {
    this.entries.forEach((entry) => {
      try {
        entry.texture?.dispose();
      } catch {
        /* ignore */
      }
    });
    this.entries.clear();
    this.listeners.clear();
    this.manifest.value = {};
    this.manifest.done = false;
    this.manifest.promise = null;
  }
}

/** 模块级单例：所有 3D 渲染器共享同一份贴图缓存。 */
export const textureLibrary3D = new TextureLibrary3D();

/**
 * 从“昼面”颜色贴图程序化推导海洋高光遮罩（灰度 CanvasTexture）：
 * 蓝通道显著高于红/绿且亮度中等的像素判为水面，边缘做一次 3x3 平滑避免高光断续。
 * 这是对自有贴图的再加工，不引入任何外部素材；读取失败返回 null（材质退回整体高光）。
 */
export function deriveOceanSpecularMap(image: unknown, maxWidth = 512): CanvasTexture | null {
  if (!image || !supportsDom()) return null;
  try {
    const canvas = document.createElement("canvas");
    let width = 1;
    let height = 1;
    const size = image as { width?: number; height?: number; videoWidth?: number; videoHeight?: number };
    width = Math.max(1, Math.floor(Number(size.width ?? size.videoWidth) || 1));
    height = Math.max(1, Math.floor(Number(size.height ?? size.videoHeight) || 1));
    const scale = Math.min(1, maxWidth / width);
    canvas.width = Math.max(2, Math.round(width * scale));
    canvas.height = Math.max(2, Math.round(height * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image as CanvasImageSource, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = data.data;
    const w = canvas.width;
    const h = canvas.height;
    const mask = new Float32Array(w * h);
    for (let i = 0, p = 0; i < pixels.length; i += 4, p += 1) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const blue = b - Math.max(r, g);
      // 水面：蓝色占优（含青绿浅海），且不是纯白冰盖/云。
      const brightness = (r + g + b) / 3;
      let value = 0;
      if (blue > 4 && brightness < 215 && b > 45) {
        value = Math.min(1, (blue - 4) / 26 + (brightness < 150 ? 0.42 : 0.12));
      }
      mask[p] = value;
    }
    // 3x3 平滑（对高光遮罩足够，代价低）。
    const smoothed = new Uint8ClampedArray(w * h);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx += 1) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            sum += mask[yy * w + xx];
            count += 1;
          }
        }
        smoothed[y * w + x] = Math.round((count > 0 ? sum / count : 0) * 255);
      }
    }
    for (let p = 0, i = 0; p < smoothed.length; p += 1, i += 4) {
      const v = smoothed[p];
      pixels[i] = v;
      pixels[i + 1] = v;
      pixels[i + 2] = v;
      pixels[i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    const texture = new CanvasTexture(canvas);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.anisotropy = maxAnisotropy;
    texture.needsUpdate = true;
    return texture;
  } catch {
    return null;
  }
}

/**
 * 判断贴图是否带 alpha 通道（云层 PNG 需要；JPEG 回退时改用亮度驱动）。
 * 抽样 64×32 像素即可，读失败按“无 alpha”处理。
 */
export function textureHasAlpha(texture: Texture | null): boolean {
  const image = texture?.image as unknown;
  if (!image || !supportsDom()) return false;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 32;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(image as CanvasImageSource, 0, 0, 64, 32);
    const data = ctx.getImageData(0, 0, 64, 32).data;
    let transparent = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) transparent += 1;
    }
    return transparent > 16;
  } catch {
    return false;
  }
}

/** 所有 3D 渲染器销毁时释放贴图缓存。 */
export function disposeTextureLibrary3D(): void {
  textureLibrary3D.dispose();
}