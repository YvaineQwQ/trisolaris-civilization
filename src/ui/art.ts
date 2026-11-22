/**
 * Art asset access + resilient image helpers.
 *
 * Assets live in public/ and are referenced with document-relative paths so the
 * same code works in dev and in the built dist/ (base "./"). Every <img> hides
 * itself if the file is missing — art must never break the layout.
 */

/** 即梦 AI 生成的 12 张工业画册 hero 图（public/images/v13，保留平台水印）。 */
export const HERO_IMAGES: readonly string[] = [
  "images/v13/hero-01-observatory-ruins.jpg",
  "images/v13/hero-02-ringed-planet-impact.jpg",
  "images/v13/hero-03-council-hall.jpg",
  "images/v13/hero-04-heavy-industry.jpg",
  "images/v13/hero-05-famine-fields.jpg",
  "images/v13/hero-06-underground-lab.jpg",
  "images/v13/hero-07-orbital-shipyard.jpg",
  "images/v13/hero-08-archives-vault.jpg",
  "images/v13/hero-09-migration-column.jpg",
  "images/v13/hero-10-second-sun.jpg",
  "images/v13/hero-11-antenna-array.jpg",
  "images/v13/hero-12-frozen-city.jpg",
];

const MENU_BACKGROUND = HERO_IMAGES[0];
const NEBULA_BACKGROUND = "backgrounds/nebula-v2.jpg";

/** Clamp an era id (1..5) to an existing illustration. */
function eraIndex(era: number): number {
  if (!Number.isFinite(era)) return 1;
  return Math.min(5, Math.max(1, Math.round(era)));
}

export const ART = {
  menuBackground: MENU_BACKGROUND,
  nebulaBackground: NEBULA_BACKGROUND,
  heroes: HERO_IMAGES,
  heroBackground: HERO_IMAGES[0],

  era(era: number): string {
    return "images/era-" + eraIndex(era) + "-v2.jpg";
  },

  /** Hazards map onto their observation illustrations; orbit destabilisation reuses close-encounter art. */
  hazard(kind: string): string {
    switch (kind) {
      case "heatExtreme":
        return "images/disaster-heat.jpg";
      case "coldExtreme":
        return "images/disaster-cold.jpg";
      case "closeEncounter":
      case "orbitDestabilization":
        return "images/disaster-close-encounter.jpg";
      case "radiationSurge":
        return "images/disaster-radiation.jpg";
      default:
        return NEBULA_BACKGROUND;
    }
  },

  ending(victory: boolean): string {
    return victory ? "images/ending-victory.jpg" : "images/ending-defeat.jpg";
  },

  observatory(level: number): string {
    if (!Number.isFinite(level)) return "images/observatory-1.jpg";
    if (level <= 2) return "images/observatory-1.jpg";
    if (level <= 5) return "images/observatory-3.jpg";
    return "images/observatory-6.jpg";
  },

  star(id: string): string {
    const key = id.trim().toLowerCase();
    if (key !== "a" && key !== "b" && key !== "c") return "";
    return "images/star-" + key + ".png";
  },

  planet: "images/planet.png",
} as const;

/**
 * Create an <img> that hides itself on load failure, so a missing asset
 * degrades to the CSS background instead of a broken-image icon.
 */
export function artImage(src: string, className: string, alt = ""): HTMLImageElement {
  const img = document.createElement("img");
  img.className = className;
  img.alt = alt;
  img.draggable = false;
  img.decoding = "async";
  img.dataset.artSrc = src;
  img.addEventListener("error", () => {
    img.classList.add("tri-art-missing");
    img.style.display = "none";
  });
  img.src = src;
  return img;
}

/**
 * Swap an art image when its source changes. A previously failed asset is not
 * retried endlessly; an empty source hides the image.
 */
export function setArtImage(img: HTMLImageElement, src: string | null): void {
  if (!src) {
    img.style.display = "none";
    img.classList.add("tri-art-missing");
    delete img.dataset.artSrc;
    return;
  }
  if (img.dataset.artSrc === src) {
    if (img.classList.contains("tri-art-missing")) return;
    if (img.style.display !== "none") return;
  }
  img.dataset.artSrc = src;
  img.classList.remove("tri-art-missing");
  img.style.display = "";
  img.src = src;
}
const backgroundProbes = new WeakMap<HTMLElement, HTMLImageElement>();

/**
 * Paint a photographic layer through CSS background-image. This is more robust
 * than object-fit <img> inside masked/backdrop-filtered containers across
 * browsers; a 404 simply leaves the dark panel background (no broken icon).
 */
export function setArtBackground(container: HTMLElement, src: string | null): void {
  if (!src) {
    container.style.backgroundImage = "";
    delete container.dataset.artBg;
    return;
  }
  if (container.dataset.artBg === src && container.style.backgroundImage) return;
  container.dataset.artBg = src;
  container.style.backgroundImage = 'url("' + src + '")';
  container.style.backgroundSize = "cover";
  container.style.backgroundRepeat = "no-repeat";
  const previous = backgroundProbes.get(container);
  if (previous) previous.onerror = null;
  const probe = new Image();
  probe.onerror = () => {
    if (container.dataset.artBg === src) {
      container.style.backgroundImage = "";
      container.dataset.artMissing = "true";
    }
  };
  probe.src = src;
  backgroundProbes.set(container, probe);
}
