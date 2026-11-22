/**
 * v1.6 编年史宽侧栏（CHRONICLE）.
 *
 * 契约（供 lead 接线）：
 *   const panel = createChroniclePanel(shell);
 *   container.appendChild(panel.el);
 *   panel.update(view);   // 每次 view 刷新调用
 *   panel.el / panel.toggle() / open() / close() / isOpen() / destroy()
 *
 * 只使用 DOM / textContent；不注入 HTML，不读取模拟状态。
 * 根类名 .tri-chronicle；内部 .tri-chronicle-head / .tri-chronicle-list /
 * .tri-chronicle-item / .tri-chronicle-filter；根上切换 .is-open / .is-collapsed。
 * 桌面默认展开（300–340px，由 layout-v6.css 的 --chronicle-w 控制列宽），
 * 移动端由 chronicle.css 变为底部抽屉。
 */
import type { ViewModel } from "../game/viewTypes";
import type { GameShell } from "./types";
import {
  CHRONICLE_FILTER_PRESETS,
  CHRONICLE_KIND_LABELS,
  chronicleSignature,
  chronicleKindCounts,
  deriveChronicleFromView,
  filterChronicle,
} from "../events/chronicle";
import type { ChronicleEntry, ChronicleFilterPreset } from "../events/chronicle";
import { append, clear, delegate, disposeAll, el, on, setText } from "./dom";
import { icon } from "./icons";
/** 样式在独立文件里，避免动全局 styles.css / theme-print.css / design-v6.css。 */
import "./chronicle.css";

const MAX_ITEMS = 80;

const FILTER_LABELS: Record<ChronicleFilterPreset, string> = {
  all: "全部",
  major: "重大",
  casualty: "伤亡",
};

function yearText(year: number): string {
  const rounded = Math.round(year);
  return "星历 " + (Number.isFinite(rounded) ? rounded : 0) + " 年";
}

function importanceStars(importance: number): string {
  const level = Math.max(1, Math.min(5, Math.round(importance)));
  return "★★★★★".slice(0, level);
}

export interface ChroniclePanelHandle {
  el: HTMLElement;
  update(view: ViewModel): void;
  toggle(): void;
  open(): void;
  close(): void;
  isOpen(): boolean;
  destroy(): void;
}

export function createChroniclePanel(shell: GameShell): ChroniclePanelHandle {
  const root = el("aside", {
    cls: "tri-chronicle",
    attrs: {
      "aria-label": "文明编年史",
      "data-chronicle": "1",
    },
  });

  /* 收起 / 隐藏时的窄条：点击展开。 */
  const peek = el("button", {
    cls: "tri-chronicle-peek",
    attrs: { type: "button", "data-chronicle-open": "1", title: "展开编年史", "aria-label": "展开编年史" },
  });
  peek.appendChild(el("span", { cls: "tri-chronicle-peek-en", text: "CHRONICLE" }));
  peek.appendChild(el("span", { cls: "tri-chronicle-peek-cn", text: "编年史" }));

  const body = el("div", { cls: "tri-chronicle-body" });

  const head = el("header", { cls: "tri-chronicle-head" });
  const heading = el("div", { cls: "tri-chronicle-heading" });
  const kicker = el("span", { cls: "tri-chronicle-kicker", text: "CHRONICLE // 编年史" });
  const countLabel = el("span", { cls: "tri-chronicle-count", text: "共 0 条" });
  append(heading, kicker, countLabel);
  const tools = el("div", { cls: "tri-chronicle-headtools" });
  const collapseBtn = el("button", {
    cls: "tri-chronicle-tool",
    attrs: { type: "button", "data-chronicle-collapse": "1", title: "收起为窄条", "aria-label": "收起编年史" },
  });
  collapseBtn.appendChild(icon("chevronRight", 14));
  const closeBtn = el("button", {
    cls: "tri-chronicle-tool",
    attrs: { type: "button", "data-chronicle-close": "1", title: "隐藏编年史", "aria-label": "隐藏编年史" },
  });
  closeBtn.appendChild(icon("close", 14));
  append(tools, collapseBtn, closeBtn);
  append(head, heading, tools);

  const filters = el("div", { cls: "tri-chronicle-filters", attrs: { role: "tablist", "aria-label": "编年史筛选" } });
  const filterButtons: Record<ChronicleFilterPreset, HTMLButtonElement> = {
    all: el("button", { cls: "tri-chronicle-filter", attrs: { type: "button", "data-chronicle-filter": "all", role: "tab", "aria-selected": "true" } }),
    major: el("button", { cls: "tri-chronicle-filter", attrs: { type: "button", "data-chronicle-filter": "major", role: "tab", "aria-selected": "false" } }),
    casualty: el("button", { cls: "tri-chronicle-filter", attrs: { type: "button", "data-chronicle-filter": "casualty", role: "tab", "aria-selected": "false" } }),
  };
  for (const preset of ["all", "major", "casualty"] as ChronicleFilterPreset[]) {
    filterButtons[preset].textContent = FILTER_LABELS[preset];
    filters.appendChild(filterButtons[preset]);
  }
  const filterMeta = el("span", { cls: "tri-chronicle-filter-meta", text: "" });
  filters.appendChild(filterMeta);

  const list = el("ol", { cls: "tri-chronicle-list", attrs: { role: "list" } });
  const empty = el("div", { cls: "tri-chronicle-empty" });
  empty.appendChild(el("span", { cls: "tri-chronicle-empty-kicker", text: "// NO RECORD YET" }));
  empty.appendChild(el("p", { cls: "tri-chronicle-empty-text", text: "编年史尚未开卷。推进时间，事件、灾害、人口与时代变迁会在这里留下记录。" }));

  append(body, head, filters, list, empty);
  append(root, peek, body);

  const subscriptions: (() => void)[] = [];
  let currentView: ViewModel | null = null;
  let entries: ChronicleEntry[] = [];
  let preset: ChronicleFilterPreset = "all";
  let visible = true;
  let collapsed = false;
  let signature = "";
  let listScrollTop = 0;

  function syncParentRail(): void {
    const parent = root.parentElement;
    if (!parent) return;
    if (parent.classList.contains("tri-game-main")) {
      parent.classList.toggle("is-chronicle-collapsed", !visible || collapsed);
      parent.classList.toggle("has-chronicle", true);
    }
  }

  function syncClasses(): void {
    root.classList.toggle("is-open", visible);
    root.classList.toggle("is-collapsed", collapsed || !visible);
    peek.setAttribute("aria-expanded", String(visible && !collapsed));
    syncParentRail();
  }

  function currentFilter(): ReturnType<typeof filterChronicle> {
    const filtered = filterChronicle(entries, CHRONICLE_FILTER_PRESETS[preset]);
    return filtered.slice(0, MAX_ITEMS);
  }

  function renderFilterButtons(): void {
    const counts = chronicleKindCounts(entries);
    const majorCount = entries.filter((entry) => entry.importance >= 4 || entry.kind === "major").length;
    filterButtons.all.textContent = FILTER_LABELS.all + " " + entries.length;
    filterButtons.major.textContent = FILTER_LABELS.major + " " + majorCount;
    filterButtons.casualty.textContent = FILTER_LABELS.casualty + " " + counts.death;
    for (const key of ["all", "major", "casualty"] as ChronicleFilterPreset[]) {
      const active = preset === key;
      filterButtons[key].classList.toggle("is-active", active);
      filterButtons[key].setAttribute("aria-selected", String(active));
    }
    const filtered = currentFilter();
    setText(filterMeta, "显示 " + filtered.length + " / " + entries.length + " 条 · 最新在上");
    setText(countLabel, "共 " + entries.length + " 条 · 重大 " + majorCount);
  }

  function renderItem(entry: ChronicleEntry): HTMLLIElement {
    const item = el("li", { cls: "tri-chronicle-item", attrs: { "data-tone": entry.tone, "data-kind": entry.kind } });
    const article = el("article", {
      cls: "tri-chronicle-item-card",
      attrs: {
        tabindex: "0",
        role: "button",
        "aria-expanded": "false",
        title: entry.title + " · " + entry.detail,
      },
    });
    const meta = el("div", { cls: "tri-chronicle-item-meta" });
    meta.appendChild(el("span", { cls: "tri-chronicle-item-year", text: yearText(entry.year) }));
    meta.appendChild(el("span", { cls: "tri-chronicle-item-kind", text: CHRONICLE_KIND_LABELS[entry.kind] ?? entry.kind }));
    const starNode = el("span", {
      cls: "tri-chronicle-item-stars",
      attrs: { "aria-label": "重要度 " + entry.importance + " / 5" },
      text: importanceStars(entry.importance),
    });
    meta.appendChild(starNode);
    const iconNode = icon(entry.icon, 12, "tri-chronicle-item-icon");
    article.appendChild(iconNode);
    article.appendChild(meta);
    article.appendChild(el("h4", { cls: "tri-chronicle-item-title", text: entry.title }));
    article.appendChild(el("p", { cls: "tri-chronicle-item-detail", text: entry.detail }));
    const footer = el("div", { cls: "tri-chronicle-item-foot" });
    footer.appendChild(el("span", { cls: "tri-chronicle-item-turn", text: "回合 " + Math.max(0, Math.round(entry.turn)) }));
    footer.appendChild(el("span", { cls: "tri-chronicle-item-source", text: entry.sourceId }));
    article.appendChild(footer);
    item.appendChild(article);
    return item;
  }

  function renderList(force = false): void {
    renderFilterButtons();
    const filtered = currentFilter();
    const nextSignature = preset + "#" + chronicleSignature(filtered);
    if (!force && nextSignature === signature) return;
    signature = nextSignature;
    const previousScroll = list.scrollTop;
    clear(list);
    for (const entry of filtered) list.appendChild(renderItem(entry));
    list.classList.toggle("tri-hidden", filtered.length === 0);
    empty.classList.toggle("tri-hidden", filtered.length > 0);
    if (listScrollTop > 0) list.scrollTop = listScrollTop;
    else list.scrollTop = previousScroll;
  }

  function selectPreset(next: ChronicleFilterPreset): void {
    if (preset === next) return;
    preset = next;
    signature = "";
    listScrollTop = 0;
    renderList(true);
  }

  function expandItem(article: HTMLElement): void {
    const expanded = article.classList.toggle("is-expanded");
    article.setAttribute("aria-expanded", String(expanded));
  }

  function open(): void {
    visible = true;
    collapsed = false;
    syncClasses();
    signature = "";
    renderList(true);
  }

  function close(): void {
    visible = false;
    collapsed = false;
    syncClasses();
  }

  function toggle(): void {
    if (!visible || collapsed) open();
    else close();
  }

  subscriptions.push(delegate(root, "[data-chronicle-open]", "click", () => open()));
  subscriptions.push(delegate(root, "[data-chronicle-collapse]", "click", () => {
    collapsed = !collapsed;
    visible = true;
    syncClasses();
    if (!collapsed) {
      signature = "";
      renderList(true);
    }
  }));
  subscriptions.push(delegate(root, "[data-chronicle-close]", "click", () => close()));
  subscriptions.push(delegate(root, "[data-chronicle-filter]", "click", (_ev, target) => {
    const value = target.getAttribute("data-chronicle-filter");
    if (value === "all" || value === "major" || value === "casualty") selectPreset(value);
  }));
  subscriptions.push(delegate(root, ".tri-chronicle-item-card", "click", (_ev, target) => expandItem(target)));
  subscriptions.push(on(root, "keydown", (ev) => {
    const event = ev as KeyboardEvent;
    if (event.key !== "Enter" && event.key !== " ") return;
    const node = event.target;
    if (!(node instanceof Element)) return;
    const card = node.closest(".tri-chronicle-item-card");
    if (card instanceof HTMLElement) {
      event.preventDefault();
      expandItem(card);
    }
  }));
  subscriptions.push(on(list, "scroll", () => {
    listScrollTop = list.scrollTop;
  }, { passive: true }));

  const scroller = list;
  void scroller;

  syncClasses();
  renderList(true);

  return {
    el: root,
    update(view: ViewModel) {
      currentView = view;
      void currentView;
      entries = deriveChronicleFromView(view);
      renderList();
    },
    toggle,
    open,
    close,
    isOpen: () => visible && !collapsed,
    destroy() {
      disposeAll(subscriptions);
      clear(root);
      root.remove();
    },
  };
}
