/** Event log modal with category filters. */
import type { ViewModel } from "../game/viewTypes";
import type { GameShell, ModalInstance } from "./types";
import { LOG_CATEGORIES } from "./types";
import { append, clear, el, KeyedList, setClass, setText } from "./dom";
import { icon } from "./icons";
import { emptyBox } from "./widgets";

type LogEntry = ViewModel["log"][number];

export function buildLogModal(shell: GameShell, _close: () => void): ModalInstance {
  const root = el("div", { cls: "tri-log-modal" });
  const toolbar = el("div", { cls: "tri-log-toolbar" });
  const filterRow = el("div", { cls: "tri-chip-row tri-log-filters" });
  const count = el("span", { cls: "tri-log-count", text: "0 条记录" });
  append(toolbar, filterRow, count);
  const pager = el("div", { cls: "tri-pager" });
  const prevBtn = el("button", { cls: "tri-pager-btn tri-pager-prev", attrs: { type: "button", title: "上一页（印刷页）" } });
  prevBtn.appendChild(icon("chevronLeft", 15));
  const capsule = el("div", { cls: "tri-pager-capsule" });
  const pageMeta = el("span", { cls: "tri-pager-meta", text: "0 条记录" });
  const pageLabel = el("span", { cls: "tri-pager-label", text: "01 / 01" });
  append(capsule, pageMeta, pageLabel);
  const nextBtn = el("button", { cls: "tri-pager-btn tri-pager-next", attrs: { type: "button", title: "下一页（印刷页）" } });
  nextBtn.appendChild(icon("chevronRight", 15));
  append(pager, prevBtn, capsule, nextBtn);
  const list = el("div", { cls: "tri-log-list" });
  const empty = emptyBox("当前分类没有日志记录");
  append(root, toolbar, pager, list, empty);

  const PAGE_SIZE = 12;
  let filter = shell.state.logFilter || "all";
  let page = 0;
  let current: ViewModel | null = shell.view();
  const rows = new KeyedList<LogEntry>(list, (entry) => String(entry.id), createLogRow, patchLogRow);

  const filters: { id: string; label: string }[] = [{ id: "all", label: "全部" }, ...LOG_CATEGORIES.map((category) => ({ id: category.id, label: category.label }))];
  for (const item of filters) {
    const button = el("button", {
      cls: "tri-chip tri-chip-btn",
      text: item.label,
      attrs: { type: "button", "data-log-filter": item.id },
    });
    button.addEventListener("click", () => {
      filter = item.id;
      page = 0;
      shell.state.logFilter = filter;
      applyFilter();
    });
    filterRow.appendChild(button);
  }

  prevBtn.addEventListener("click", () => {
    if (page <= 0) return;
    page -= 1;
    applyFilter();
  });
  nextBtn.addEventListener("click", () => {
    const total = filteredEntries().length;
    if ((page + 1) * PAGE_SIZE >= total) return;
    page += 1;
    applyFilter();
  });

  function filteredEntries(): LogEntry[] {
    if (!current) return [];
    return current.log
      .filter((entry) => filter === "all" || entry.category === filter)
      .slice()
      .sort((a, b) => b.id - a.id);
  }

  function applyFilter(): void {
    if (!current) return;
    for (const button of filterRow.querySelectorAll<HTMLElement>("[data-log-filter]")) {
      setClass(button, "is-active", button.dataset.logFilter === filter);
    }
    const entries = filteredEntries();
    const pages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
    if (page >= pages) page = pages - 1;
    if (page < 0) page = 0;
    const start = page * PAGE_SIZE;
    rows.update(entries.slice(start, start + PAGE_SIZE));
    setText(count, entries.length + " 条记录" + (filter === "all" ? " · 按时间倒序" : " · 分类 " + filterLabel(filter)));
    setText(pageMeta, entries.length === 0 ? "空卷" : "第 " + (start + 1) + "–" + Math.min(entries.length, start + PAGE_SIZE) + " 条");
    setText(pageLabel, String(page + 1).padStart(2, "0") + " / " + String(pages).padStart(2, "0"));
    prevBtn.disabled = page <= 0;
    nextBtn.disabled = page >= pages - 1;
    pager.classList.toggle("tri-hidden", entries.length === 0);
    empty.classList.toggle("tri-hidden", entries.length > 0);
  }

  if (current) {
    current = shell.view();
    applyFilter();
  }

  return {
    el: root,
    update(view) {
      current = view;
      applyFilter();
    },
    destroy() {
      /* listeners live on the subtree */
    },
  };
}

function createLogRow(entry: LogEntry): HTMLElement {
  const row = el("div", { cls: "tri-log-row", attrs: { "data-severity": entry.severity, "data-category": entry.category } });
  const meta = el("div", { cls: "tri-log-meta" });
  meta.appendChild(el("span", { cls: "tri-log-year", text: "—" }));
  meta.appendChild(el("span", { cls: "tri-log-cat", text: entry.category }));
  meta.appendChild(el("span", { cls: "tri-log-sev", text: entry.severity }));
  const message = el("div", { cls: "tri-log-message", text: entry.message });
  append(row, meta, message);
  return row;
}

function patchLogRow(node: HTMLElement, entry: LogEntry): void {
  node.dataset.severity = entry.severity;
  node.dataset.category = entry.category;
  setText(node.querySelector(".tri-log-year"), "星历 " + Math.round(entry.year) + " · 回合 " + entry.turn);
  setText(node.querySelector(".tri-log-cat"), categoryLabel(entry.category));
  setText(node.querySelector(".tri-log-sev"), severityLabel(entry.severity));
  setText(node.querySelector(".tri-log-message"), entry.message);
}

function categoryLabel(category: string): string {
  return LOG_CATEGORIES.find((item) => item.id === category)?.label ?? category;
}

function filterLabel(filter: string): string {
  return LOG_CATEGORIES.find((item) => item.id === filter)?.label ?? filter;
}

function severityLabel(severity: string): string {
  switch (severity) {
    case "critical":
      return "危急";
    case "warning":
      return "警告";
    case "success":
      return "成就";
    default:
      return "信息";
  }
}
