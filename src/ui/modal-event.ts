/**
 * v1.3 纪元事件档案 —— 大插图 + 编辑式排版 + 2–3 个抉择与后果预览 +
 * 历史时间线。事件触发后由游戏屏自动打开并冻结时间。
 */
import type { ActiveEventView, EventHistoryView, EventsView, ViewModel } from "../game/viewTypes";
import type { GameShell, ModalInstance } from "./types";
import { append, clear, delegate, el, setText } from "./dom";
import { icon } from "./icons";
import { num } from "./format";

export function buildEventModal(shell: GameShell, close: () => void): ModalInstance {
  const root = el("div", { cls: "tri-eventdoc" });
  let current: ViewModel | null = shell.view();
  let expanded = false;
  let signature = "";

  const archLayer = el("div", { cls: "tri-eventdoc-arch tri-hidden" });
  archLayer.appendChild(el("span", { cls: "tri-archival-kicker", text: "// ARCHIVE SEALED" }));
  archLayer.appendChild(el("p", { cls: "tri-archival-title", text: "事件档案尚未建卷" }));
  archLayer.appendChild(
    el("p", {
      cls: "tri-archival-text",
      text: "随机事件的插图、抉择与后果链仍在归档。观测记录与建造日志会先写入文明史；事件模块接入后，此页将自动展示最紧急的那一卷。",
    }),
  );
  const body = el("div", { cls: "tri-eventdoc-bodywrap" });
  append(root, body, archLayer);

  const offChoice = delegate(root, "[data-eventdoc-choice]", "click", (_ev, target) => {
    const choiceId = target.dataset.eventdocChoice;
    const api = shell.api();
    if (!choiceId || !api) return;
    api.actions.resolveEvent(choiceId);
    shell.requestRefresh();
    shell.notify("抉择已写入文明史 · 后果将在后续回合展开", "ok");
    close();
  });
  const offExpand = delegate(root, "[data-eventdoc-expand]", "click", () => {
    expanded = !expanded;
    render(true);
  });

  function eventsOf(view: ViewModel | null): EventsView | null {
    return view?.events ?? null;
  }

  function render(force = false): void {
    const events = eventsOf(current);
    body.classList.toggle("tri-hidden", !events);
    archLayer.classList.toggle("tri-hidden", Boolean(events));
    if (!events) {
      signature = "";
      return;
    }
    const active = events.active;
    const nextSignature = [
      active?.defId ?? "-",
      expanded ? "long" : "short",
      events.pendingCount,
      events.history.length,
      events.modifiers.length,
      active?.choices.length ?? 0,
    ].join("#");
    if (!force && nextSignature === signature) return;
    signature = nextSignature;
    clear(body);
    body.appendChild(renderActive(events, active));
    body.appendChild(renderPast(events));
  }

  function renderActive(events: EventsView, active: ActiveEventView | null): HTMLElement {
    if (!active) {
      const idle = el("div", { cls: "tri-eventdoc-idle" });
      idle.appendChild(el("span", { cls: "tri-eventdoc-idlekicker", text: "// NO PENDING FILE" }));
      idle.appendChild(el("p", { cls: "tri-eventdoc-idletitle", text: "当前没有待处理的纪元事件" }));
      idle.appendChild(
        el("p", {
          cls: "tri-eventdoc-idletext",
          text: events.lastEventTitle
            ? "上一件事「" + events.lastEventTitle + "」的余波仍在档案里回响。继续推进时间，等待下一次扰动。"
            : "文明在噪声中继续推进。下一次事件会在观测、饥荒、工程事故或星象异常中自行显现。",
        }),
      );
      idle.appendChild(el("p", { cls: "tri-eventdoc-idlehint", text: "累计触发 " + events.totalTriggered + " 次 · 待处理 " + events.pendingCount }));
      return idle;
    }

    const layout = el("div", { cls: "tri-eventdoc-layout", attrs: { "data-category": active.category } });
    /* 大插图：缺失时退化为印刷斜纹档案板 */
    const figure = el("figure", { cls: "tri-eventdoc-figure" });
    const fallback = el("div", { cls: "tri-eventdoc-artfallback" });
    fallback.appendChild(el("span", { cls: "tri-eventdoc-artkicker", text: "// EVENT PLATE" }));
    fallback.appendChild(el("span", { cls: "tri-eventdoc-artmark", text: "事件档案" }));
    fallback.appendChild(el("span", { cls: "tri-eventdoc-artid", text: active.defId }));
    const src = active.illustration.startsWith("/") ? active.illustration : "/" + active.illustration;
    const img = document.createElement("img");
    img.className = "tri-eventdoc-img";
    img.alt = active.title;
    img.decoding = "async";
    img.src = src;
    img.addEventListener("error", () => {
      img.remove();
      figure.classList.add("is-missing");
    });
    const caption = el("figcaption", { cls: "tri-eventdoc-caption" });
    caption.appendChild(el("span", { cls: "tri-eventdoc-cat", text: active.categoryName }));
    caption.appendChild(el("span", { cls: "tri-eventdoc-year", text: "星历 " + Math.round(active.triggerYear) + " 年" }));
    caption.appendChild(el("span", { cls: "tri-eventdoc-ctx", text: active.context }));
    append(figure, fallback, img, caption);

    /* 编辑式排版 */
    const editorial = el("article", { cls: "tri-eventdoc-editorial" });
    const kicker = el("span", { cls: "tri-eventdoc-kicker", text: "// " + active.categoryName.toUpperCase() + " · 待决档案" });
    const title = el("h2", { cls: "tri-eventdoc-title", text: active.title });
    editorial.append(kicker, title);
    if (active.subtitle) editorial.appendChild(el("p", { cls: "tri-eventdoc-subtitle", text: active.subtitle }));
    editorial.appendChild(el("p", { cls: "tri-eventdoc-short", text: active.short }));
    editorial.appendChild(el("p", { cls: "tri-eventdoc-text", text: active.body }));
    if (active.longBody) {
      if (expanded) {
        editorial.appendChild(el("p", { cls: "tri-eventdoc-long", text: active.longBody }));
      }
      const expandBtn = el("button", { cls: "tri-eventdoc-expand", attrs: { type: "button", "data-eventdoc-expand": "1" } });
      expandBtn.appendChild(el("span", { text: expanded ? "收起完整档案 ↑" : "阅读完整档案 ↓" }));
      editorial.appendChild(expandBtn);
    }
    if (active.flavor) {
      const quote = el("blockquote", { cls: "tri-eventdoc-flavor" });
      quote.appendChild(el("span", { text: active.flavor }));
      editorial.appendChild(quote);
    }

    const choices = el("div", { cls: "tri-eventdoc-choices" });
    active.choices.forEach((choice, index) => {
      const button = el("button", {
        cls: "tri-eventdoc-choice",
        attrs: { type: "button", "data-eventdoc-choice": choice.id, "data-risk": choice.risk ?? "none" },
      });
      const numNode = el("span", { cls: "tri-eventdoc-choicenum", text: String(index + 1).padStart(2, "0") });
      const main = el("span", { cls: "tri-eventdoc-choicemain" });
      main.appendChild(el("span", { cls: "tri-eventdoc-choicelabel", text: choice.label }));
      if (choice.description) main.appendChild(el("span", { cls: "tri-eventdoc-choicedesc", text: choice.description }));
      const meta = el("span", { cls: "tri-eventdoc-choicemeta" });
      for (const preview of choice.preview) meta.appendChild(el("span", { cls: "tri-eventdoc-preview", text: preview }));
      if (choice.risk) meta.appendChild(el("span", { cls: "tri-eventdoc-risk", text: "风险 · " + choice.risk }));
      if (!choice.available) meta.appendChild(el("span", { cls: "tri-eventdoc-locked", text: choice.unavailableReason ?? "条件不足" }));
      main.appendChild(meta);
      const arrow = el("span", { cls: "tri-eventdoc-choicearrow", text: "→" });
      append(button, numNode, main, arrow);
      if (!choice.available) {
        button.disabled = true;
        button.title = choice.unavailableReason ?? "当前条件不满足";
      }
      choices.appendChild(button);
    });
    editorial.appendChild(choices);
    editorial.appendChild(el("p", { cls: "tri-eventdoc-hint", text: "抉择会写入文明史，并调整后续事件的概率。" }));
    append(layout, figure, editorial);
    return layout;
  }

  function renderPast(events: EventsView): HTMLElement {
    const wrap = el("section", { cls: "tri-eventdoc-past" });
    const head = el("div", { cls: "tri-eventdoc-pasthead" });
    head.appendChild(el("span", { cls: "tri-eventdoc-kicker", text: "// EVENT CHRONICLE" }));
    head.appendChild(el("span", { cls: "tri-eventdoc-pasttitle", text: "事件纪年" }));
    head.appendChild(el("span", { cls: "tri-eventdoc-pastcount", text: "累计 " + events.totalTriggered + " 次" }));
    wrap.appendChild(head);
    if (events.modifiers.length > 0) {
      const mods = el("div", { cls: "tri-eventdoc-mods" });
      for (const modifier of events.modifiers) {
        const chipNode = el("span", { cls: "tri-eventdoc-mod", attrs: { "data-tone": modifier.tone } });
        chipNode.appendChild(el("span", { text: modifier.label }));
        chipNode.appendChild(el("b", { text: "×" + modifier.multiplier.toFixed(2) }));
        mods.appendChild(chipNode);
      }
      wrap.appendChild(mods);
    }
    const timeline = el("ol", { cls: "tri-eventdoc-timeline" });
    const history = events.history.slice(-7).reverse();
    if (history.length === 0) timeline.appendChild(el("li", { cls: "tri-eventdoc-empty", text: "尚无事件被记入历史。" }));
    for (const entry of history) timeline.appendChild(renderHistoryRow(entry));
    wrap.appendChild(timeline);
    return wrap;
  }

  function renderHistoryRow(entry: EventHistoryView): HTMLLIElement {
    const row = el("li", { cls: "tri-eventdoc-tlrow" });
    const marker = el("span", { cls: "tri-eventdoc-tlmarker" });
    marker.appendChild(el("span", { cls: "tri-eventdoc-tldot" }));
    const content = el("div", { cls: "tri-eventdoc-tlcontent" });
    const meta = el("div", { cls: "tri-eventdoc-tlmeta" });
    meta.appendChild(el("span", { cls: "tri-eventdoc-tlyear", text: "星历 " + Math.round(entry.year) + " · 回合 " + entry.turn }));
    meta.appendChild(el("span", { cls: "tri-eventdoc-tlcat", text: entry.category }));
    meta.appendChild(el("span", { cls: "tri-eventdoc-tlchoice", text: "抉择：" + entry.choiceLabel }));
    content.appendChild(meta);
    content.appendChild(el("span", { cls: "tri-eventdoc-tltitle", text: entry.title }));
    content.appendChild(el("span", { cls: "tri-eventdoc-tloutcome", text: entry.outcome }));
    append(row, marker, content);
    return row;
  }

  return {
    el: root,
    update(view) {
      current = view;
      render();
    },
    destroy() {
      offChoice();
      offExpand();
    },
  };
}

/** 供右侧事件页签复用的后果预览描述。 */
export function eventChoiceSummary(count: number): string {
  return num(count, 0) + " 个抉择等待写入档案";
}
