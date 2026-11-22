/** Inline SVG icon set, hand-drawn as 24x24 stroke glyphs. No external assets. */

type IconDef = string;

const PATHS: Record<string, IconDef> = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
  star: '<path d="M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7z"/>',
  planet: '<circle cx="12" cy="12" r="4.6"/><ellipse cx="12" cy="12" rx="10" ry="3.1" transform="rotate(-18 12 12)"/>',
  orbit: '<circle cx="12" cy="12" r="2.2"/><ellipse cx="12" cy="12" rx="9.2" ry="4" transform="rotate(-26 12 12)"/><circle cx="19.2" cy="7.6" r="1.5" fill="currentColor"/>',
  galaxy: '<circle cx="12" cy="12" r="1.6" fill="currentColor"/><path d="M12 12c2.4-3.4 6.4-2.2 6.2 1.2-.2 3.2-5.2 5.2-8.2 3.2"/><path d="M12 12c-2.4 3.4-6.4 2.2-6.2-1.2C6 7.6 11 5.6 14 7.6"/>',
  telescope: '<path d="M4.2 9.6l10.6-5 2.8 5.6-10.6 5z"/><path d="M9.8 14.4l-2 6.4M14.8 16.2l2.6 4.6M7.2 20.8h6"/><circle cx="16.6" cy="7" r="1.5"/>',
  thermometer: '<path d="M10 4a2 2 0 0 1 4 0v8.2a4 4 0 1 1-4 0z"/><path d="M12 9.5v6"/>',
  chart: '<path d="M4 19l5-7 4 3 7-9"/><path d="M4 21h17"/>',
  spark: '<path d="M3 15l3-5 3 3 3-7 3 6 3-4 3 2"/>',
  wave: '<path d="M2 12c2-5 4-5 6 0s4 5 6 0 4-5 6 0"/>',
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"/><path d="M7.6 16h8.8"/>',
  factory: '<path d="M4 20V10l5 3V10l5 3V10l5 3v7z"/><path d="M7 20v-3M12 20v-3M17 20v-3"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17.2" cy="9.4" r="2.2"/><path d="M15 18.6a5 5 0 0 1 6-2.6"/>',
  home: '<path d="M3 11l9-7 9 7"/><path d="M5.5 9.6V20h13V9.6"/><path d="M10 20v-5.2h4V20"/>',
  shield: '<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/>',
  alert: '<path d="M12 3l9 17H3z"/><path d="M12 9v5"/><circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2.2H4z"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="7.8" r="0.9" fill="currentColor" stroke="none"/>',
  play: '<path d="M7 5l12 7-12 7z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" stroke="none"/>',
  step: '<path d="M6 5l10 7-10 7z" fill="currentColor" stroke="none"/><path d="M19 5v14" stroke-width="2"/>',
  save: '<path d="M4 4h12l4 4v12H4z"/><path d="M8 4v6h8V4"/><rect x="8" y="14" width="8" height="6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.4 9.2a2.6 2.6 0 1 1 3.8 2.3c-.8.4-1.2 1-1.2 1.9"/><circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  log: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  build: '<path d="M4 21V8l8-5 8 5v13"/><path d="M8 21v-7h8v7"/><path d="M12 3v4"/>',
  research: '<circle cx="12" cy="12" r="1.8"/><ellipse cx="12" cy="12" rx="9" ry="4"/><ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(120 12 12)"/>',
  zoomIn: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4L21 21"/><path d="M7.5 10.5h6M10.5 7.5v6"/>',
  zoomOut: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4L21 21"/><path d="M7.5 10.5h6"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v5h5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevronLeft: '<path d="M15 5l-7 7 7 7"/>',
  chevronRight: '<path d="M9 5l7 7-7 7"/>',
  chevronDown: '<path d="M5 9l7 7 7-7"/>',
  chevronUp: '<path d="M5 15l7-7 7 7"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="9" cy="15" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.2" fill="currentColor" stroke="none"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  download: '<path d="M12 3v11"/><path d="M7.5 9.5L12 14l4.5-4.5"/><path d="M4 20h16"/>',
  upload: '<path d="M12 21V10"/><path d="M7.5 14.5L12 10l4.5 4.5"/><path d="M4 4h16"/>',
  trash: '<path d="M4 7h16M9 7V5h6v2M6.5 7l1 13h9l1-13"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  wheat: '<path d="M12 21V8"/><path d="M12 8c-3 0-4-1-4-4 3 0 4 1 4 4zM12 12c3 0 4-1 4-4-3 0-4 1-4 4zM12 16c-3 0-4-1-4-4 3 0 4 1 4 4z"/>',
  water: '<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/>',
  mineral: '<path d="M7 4h10l4 6-9 10L3 10z"/><path d="M3 10h18M12 20L8 10l2-6M12 20l4-10-2-6"/>',
  metal: '<path d="M4 9l3-4h10l3 4-3 10H7z"/><path d="M4 9h16"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
  eye: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.8"/>',
  book: '<path d="M4 4.5h6.5a2.5 2.5 0 0 1 2.5 2.5v12a3 3 0 0 0-3-3H4z"/><path d="M20 4.5h-6.5A2.5 2.5 0 0 0 11 7v12a3 3 0 0 1 3-3h6z"/>',
  spaceship: '<path d="M12 2l5 8-5 3-5-3z"/><path d="M7 10l-2 5 4-1M17 10l2 5-4-1M12 13v8"/>',
  seedling: '<path d="M12 21V11"/><path d="M12 11C8 11 6 9 6 5c4 0 6 2 6 6zM12 14c4 0 6-2 6-6-4 0-6 2-6 6z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  folderOpen: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v2H3z"/><path d="M3 11h18l-2 9H5z"/>',
  dot: '<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>',
  ring: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
};

const ALIASES: Record<string, string> = {
  farm: "wheat",
  food: "wheat",
  agriculture: "wheat",
  water: "water",
  mine: "mineral",
  mining: "mineral",
  minerals: "mineral",
  metal: "metal",
  metals: "metal",
  power: "bolt",
  energy: "bolt",
  reactor: "bolt",
  lab: "flask",
  science: "flask",
  research: "research",
  factory: "factory",
  industry: "factory",
  observatory: "telescope",
  telescope: "telescope",
  astronomy: "telescope",
  housing: "home",
  habitat: "home",
  home: "home",
  shield: "shield",
  defense: "shield",
  health: "shield",
  school: "book",
  book: "book",
  spaceport: "spaceship",
  rocket: "spaceship",
  space: "spaceship",
  biology: "seedling",
  seedling: "seedling",
  population: "people",
  people: "people",
  colony: "planet",
  planet: "planet",
  star: "star",
  sun: "sun",
  orbit: "orbit",
  warning: "alert",
  alert: "alert",
  danger: "alert",
  info: "info",
  system: "cpu",
  compute: "cpu",
  sensor: "eye",
  eye: "eye",
  map: "map",
  log: "log",
  build: "build",
  save: "save",
  settings: "settings",
  help: "help",
  clock: "clock",
  calendar: "calendar",
  time: "clock",
  target: "target",
  grid: "grid",
};

const SVG_NS = "http://www.w3.org/2000/svg";

function build(name: string, size: number, className: string): SVGSVGElement {
  const clean = name.replace(/[^a-z0-9_-]/gi, "").toLowerCase();
  const resolved = PATHS[clean] ? clean : ALIASES[clean] ?? "dot";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.6");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  if (className) svg.setAttribute("class", className);
  // Static trusted markup from the table above only; never user data.
  svg.innerHTML = PATHS[resolved];
  return svg;
}

/** Create an inline SVG icon. Unknown names fall back to aliases, then a dot. */
export function icon(name: string, size = 16, className = "tri-icon"): SVGSVGElement {
  return build(name, size, className);
}

export function hasIcon(name: string): boolean {
  const clean = name.replace(/[^a-z0-9_-]/gi, "").toLowerCase();
  return Boolean(PATHS[clean] ?? ALIASES[clean]);
}
