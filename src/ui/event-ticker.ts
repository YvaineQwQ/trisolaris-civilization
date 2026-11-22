/**
 * v1.6 底栏事件摘要：只显示随机事件、结算结果与少量重大事件。
 * 完整事件/死亡/灾害记录在编年史侧栏（chronicle-panel）；这里保持 34px 一行，不抢舞台。
 */
import type { ViewModel } from "../game/viewTypes";
import { clear, el } from "./dom";

export interface EventTickerHandle {
  el: HTMLElement;
  update(view: ViewModel): void;
  destroy(): void;
}

interface TickerItem {
  key: string;
  tone: "normal" | "major" | "death" | "science";
  label: string;
  title: string;
  meta: string;
  turn: number;
}

const DEATH_RE = /(死亡|人口损失|阵亡|伤亡|覆灭|毁坏|倒塌|灭绝|饥荒|瘟疫)/;

export function createEventTicker(opts: { onOpenChronicle: () => void }): EventTickerHandle {
  const root = el("div", { cls: "tri-event-ticker", attrs: { "aria-label": "事件摘要" } });
  const kicker = el("span", { cls: "tri-ticker-kicker", text: "// CHRONICLE" });
  const items = el("div", { cls: "tri-ticker-items" });
  const openBtn = el("button", {
    cls: "tri-ticker-open",
    attrs: { type: "button", title: "打开编年史侧栏" },
    text: "编年史 →",
  });
  openBtn.addEventListener("click", () => opts.onOpenChronicle());
  root.append(kicker, items, openBtn);

  function update(view: ViewModel): void {
    const list: TickerItem[] = [];
    const events = view.events;
    const active = events?.active ?? null;
    if (active) {
      list.push({
        key: "active:" + active.defId,
        tone: active.category === "hazard" || active.category === "environment" ? "major" : "normal",
        label: "待决",
        title: active.title,
        meta: active.categoryName,
        turn: view.meta.turn + 999, // 当前事件永远最前
      });
    }
    if (events?.outcomePending) {
      list.push({
        key: "pending",
        tone: "normal",
        label: "结算中",
        title: events.outcomePending.title,
        meta: events.outcomePending.remainingSeconds + " 秒后报告",
        turn: view.meta.turn + 998,
      });
    }
    if (events?.outcomeReport) {
      list.push({
        key: "report:" + events.outcomeReport.id,
        tone: events.outcomeReport.categoryName === "灾害" ? "major" : "normal",
        label: "结果",
        title: events.outcomeReport.title,
        meta: events.outcomeReport.choiceLabel,
        turn: view.meta.turn + 997,
      });
    }
    /* 历史事件：最新 2 条；灾害/环境视为大事件。 */
    for (const entry of (events?.history ?? []).slice(0, 4)) {
      list.push({
        key: "history:" + entry.id,
        tone: entry.category === "hazard" || entry.category === "environment" ? "major" : "normal",
        label: "事件",
        title: entry.title,
        meta: entry.year + " 年 · " + entry.choiceLabel,
        turn: entry.turn,
      });
    }
    /* 居民死亡、建筑毁坏等：从真实日志中提取，不编造。 */
    for (const log of (view.log ?? []).slice(-120).reverse()) {
      if (list.filter((x) => x.tone === "death").length >= 2) break;
      if (log.category !== "hazard" && log.category !== "civilization" && log.category !== "milestone") continue;
      if (!DEATH_RE.test(log.message)) continue;
      list.push({
        key: "log:" + log.id,
        tone: "death",
        label: "伤亡",
        title: log.message.length > 46 ? log.message.slice(0, 46) + "…" : log.message,
        meta: log.year + " 年",
        turn: log.turn,
      });
    }
    /* 重大里程碑。 */
    for (const log of (view.log ?? []).slice(-80).reverse()) {
      if (log.severity !== "critical" && log.category !== "milestone") continue;
      if (list.some((x) => x.key === "log:" + log.id)) continue;
      list.push({
        key: "major:" + log.id,
        tone: "major",
        label: "大事",
        title: log.message.length > 44 ? log.message.slice(0, 44) + "…" : log.message,
        meta: log.year + " 年",
        turn: log.turn,
      });
      break;
    }

    clear(items);
    const ordered = list.sort((a, b) => b.turn - a.turn).slice(0, 4);
    if (ordered.length === 0) {
      items.appendChild(el("span", { cls: "tri-ticker-empty", text: "尚无事件记录 · 文明在噪声中继续推进" }));
      return;
    }
    for (const item of ordered) {
      const node = el("button", {
        cls: "tri-ticker-item",
        attrs: { type: "button", "data-tone": item.tone, title: item.title + " · " + item.meta },
      });
      node.appendChild(el("b", { text: item.label }));
      node.appendChild(el("span", { text: item.title }));
      node.appendChild(el("span", { cls: "tri-ticker-meta", text: item.meta }));
      node.addEventListener("click", () => opts.onOpenChronicle());
      items.appendChild(node);
    }
  }

  return { el: root, update, destroy: () => root.remove() };
}
