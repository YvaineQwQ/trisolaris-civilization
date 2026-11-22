/** Human-facing number / time formatting shared by every UI module. */

const DASH = "—";

export function isNum(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function group(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function trimFixed(value: number, digits: number): string {
  return value
    .toFixed(digits)
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "");
}

/** Compact but honest number: 1,234 / 12.3万 / 4.56亿. */
export function num(value: number | null | undefined, digits = 0): string {
  if (!isNum(value)) return DASH;
  const abs = Math.abs(value);
  if (abs >= 1e8) return trimFixed(value / 1e8, 2) + "亿";
  if (abs >= 1e4) return trimFixed(value / 1e4, 2) + "万";
  const sign = value < 0 ? "-" : "";
  const fixed = Math.abs(value).toFixed(Math.max(0, digits));
  const [intPart, frac] = fixed.split(".");
  return sign + group(intPart) + (frac ? "." + frac : "");
}

export function int(value: number | null | undefined): string {
  return num(value, 0);
}

export function signed(value: number | null | undefined, digits = 1): string {
  if (!isNum(value)) return DASH;
  if (Math.abs(value) < Math.pow(10, -digits) / 2) return "0";
  return (value > 0 ? "+" : "") + num(value, digits);
}

/** ratio is 0..1 unless a caller explicitly passes 0..100. */
export function pct(ratio: number | null | undefined, digits = 0): string {
  if (!isNum(ratio)) return DASH;
  return (ratio * 100).toFixed(digits) + "%";
}

export function pctSigned(ratio: number | null | undefined, digits = 1): string {
  if (!isNum(ratio)) return DASH;
  return signed(ratio * 100, digits) + "%";
}

/** Per-year flow label, e.g. "+12.4/年". */
export function perYear(value: number | null | undefined, digits = 2): string {
  if (!isNum(value)) return DASH;
  return signed(value, digits) + " / 年";
}

export function years(value: number | null | undefined, digits = 1): string {
  if (!isNum(value)) return DASH;
  if (Math.abs(value) < 1) return trimFixed(value * 12, Math.max(1, digits)) + " 月";
  return trimFixed(value, digits) + " 年";
}

export function turns(value: number | null | undefined): string {
  if (!isNum(value)) return DASH;
  return trimFixed(value, 1) + " 回合";
}

export function temp(celsius: number | null | undefined): string {
  if (!isNum(celsius)) return DASH;
  return signed(celsius, 1) + " °C";
}

export function au(value: number | null | undefined): string {
  if (!isNum(value)) return DASH;
  return trimFixed(value, value < 1 ? 3 : 2) + " AU";
}

export function km(value: number | null | undefined): string {
  if (!isNum(value)) return DASH;
  return trimFixed(value, 0) + " km";
}

export function solarMass(value: number | null | undefined): string {
  if (!isNum(value)) return DASH;
  return trimFixed(value, 3) + " M☉";
}

export function sigma(value: number | null | undefined, unit = "AU"): string {
  if (!isNum(value)) return DASH;
  return "±" + trimFixed(value, value < 0.01 ? 4 : 2) + " " + unit;
}

export function speedLabel(value: number | null | undefined): string {
  if (!isNum(value) || value <= 0) return "暂停";
  return trimFixed(value, value % 1 === 0 ? 0 : 1) + "×";
}

export function yearText(calendarYear: number | null | undefined): string {
  if (!isNum(calendarYear)) return "星历 —";
  return "星历 " + Math.floor(calendarYear).toLocaleString("en-US") + " 年";
}

export function yearWithElapsed(calendarYear: number, elapsedYears: number): string {
  return yearText(calendarYear) + " · 模拟 +" + trimFixed(elapsedYears, 2) + " 年";
}

export function dateTime(ts: number | null | undefined): string {
  if (!isNum(ts)) return DASH;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return DASH;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function dateOnly(ts: number | null | undefined): string {
  if (!isNum(ts)) return DASH;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return DASH;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function duration(seconds: number | null | undefined): string {
  if (!isNum(seconds) || seconds < 0) return DASH;
  if (seconds < 60) return Math.round(seconds) + " 秒";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + " 分 " + Math.round(seconds % 60) + " 秒";
  return Math.floor(minutes / 60) + " 时 " + (minutes % 60) + " 分";
}

/** Text for unknown / not-yet-observed values. Never invent numbers. */
export function unknown(text = "未观测"): string {
  return DASH + " " + text;
}

export function orUnknown(value: string | null | undefined, text = "未观测"): string {
  return value && value.length > 0 ? value : unknown(text);
}

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
