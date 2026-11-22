/**
 * v1.5：事件抉择 30 秒后送达的量化结算报告。
 * 只读取 view.events.outcomeReport；关闭时确认，允许下一次事件抽取。
 */
import type { EventEffectView, EventOutcomeView, ViewModel } from "../game/viewTypes";
import type { GameShell, ModalInstance } from "./types";
import { append, clear, el, on } from "./dom";
import { icon } from "./icons";
import "./event-report.css";

function signed(value: number, unit = ""): string {
  const abs = Math.abs(value);
  const text = abs >= 100 ? abs.toFixed(0) : abs >= 10 ? abs.toFixed(1).replace(/\.0$/, "") : abs.toFixed(1).replace(/\.0$/, "");
  return (value > 0 ? "+" : value < 0 ? "−" : "±") + text + (unit ? " " + unit : "");
}

function effectRow(effect: EventEffectView): HTMLElement {
  const row = el("div", { cls: "tri-erow", attrs: { "data-tone": effect.tone, "data-kind": effect.kind } });
  row.appendChild(el("span", { cls: "tri-erow-label", text: effect.label }));
  const numbers = el("span", { cls: "tri-erow-numbers" });
  if (effect.before != null && effect.after != null) {
    numbers.appendChild(el("span", { cls: "tri-erow-before", text: String(Math.round(effect.before)) + (effect.unit ? " " + effect.unit : "") }));
    numbers.appendChild(el("span", { cls: "tri-erow-arrow", text: "→" }));
    numbers.appendChild(el("span", { cls: "tri-erow-after", text: String(Math.round(effect.after)) + (effect.unit ? " " + effect.unit : "") }));
  } else {
    numbers.appendChild(el("span", { cls: "tri-erow-before", text: "状态变化" }));
  }
  row.appendChild(numbers);
  const delta = el("span", { cls: "tri-erow-delta", text: effect.delta != null ? signed(effect.delta, effect.unit) : "—" });
  row.appendChild(delta);
  if (effect.detail) row.appendChild(el("span", { cls: "tri-erow-detail", text: effect.detail }));
  return row;
}

export function buildEventResultModal(shell: GameShell, close: () => void): ModalInstance {
  const root = el("div", { cls: "tri-eventresult" });
  let report: EventOutcomeView | null = null;
  let acknowledged = false;

  function acknowledge(): void {
    if (acknowledged) return;
    acknowledged = true;
    try {
      shell.api()?.actions.acknowledgeEventOutcome();
    } catch (error) {
      console.warn("[trisolaris] acknowledge event outcome failed", error);
    }
  }

  function render(): void {
    clear(root);
    if (!report) {
      root.appendChild(el("p", { cls: "tri-eventresult-empty", text: "结算报告已归档，可在文明史中查看。" }));
      return;
    }
    const head = el("div", { cls: "tri-erhead" });
    const kicker = el("span", { cls: "tri-erkicker" });
    kicker.appendChild(icon("info", 13));
    kicker.appendChild(el("span", { text: "// EVENT RESOLVED · 30 SEC DELAY" }));
    head.appendChild(kicker);
    head.appendChild(el("p", { cls: "tri-erwait", text: "选择已提交 · 30 秒实际结算窗口已结束，以下为已落地的数值" }));
    const title = el("h2", { cls: "tri-ertitle", text: report.title });
    head.appendChild(title);
    head.appendChild(el("p", { cls: "tri-erchoice", text: "你的抉择：" + report.choiceLabel }));
    root.appendChild(head);

    if (report.outcome) {
      const outcome = el("blockquote", { cls: "tri-eroutcome" });
      outcome.appendChild(el("span", { cls: "tri-erlabel", text: "事件文本" }));
      outcome.appendChild(el("p", { text: report.outcome }));
      root.appendChild(outcome);
    }

    const summary = el("div", { cls: "tri-ersummary" });
    summary.appendChild(el("span", { cls: "tri-erlabel", text: "结算摘要" }));
    summary.appendChild(el("p", { text: report.summary }));
    root.appendChild(summary);

    const grid = el("div", { cls: "tri-ergrid" });
    if (report.effects.length === 0) {
      grid.appendChild(el("p", { cls: "tri-erempty", text: "这次选择没有直接数值变化，但世界记住了它。" }));
    } else {
      for (const effect of report.effects) grid.appendChild(effectRow(effect));
    }
    root.appendChild(grid);

    if (report.followUpTitle) {
      const follow = el("p", { cls: "tri-erfollow" });
      follow.appendChild(el("b", { text: "事件链未结束：" }));
      follow.appendChild(el("span", { text: "「" + report.followUpTitle + "」已被写入后续排期。" }));
      root.appendChild(follow);
    }
    const hint = el("p", { cls: "tri-erhint", text: "以上为实际生效数值；本次选择已写入事件档案，并影响后续事件权重。" });
    root.appendChild(hint);

    const actions = el("div", { cls: "tri-eractions" });
    const button = el("button", { cls: "tri-btn tri-btn-primary tri-ercontinue", attrs: { type: "button" } });
    button.appendChild(icon("forward", 15));
    button.appendChild(el("span", { text: "确认结算 · 继续纪元" }));
    actions.appendChild(button);
    root.appendChild(actions);
    on(button, "click", () => {
      acknowledge();
      close();
    });
  }

  render();

  return {
    el: root,
    update(view: ViewModel) {
      const next = view.events?.outcomeReport ?? null;
      if (next) {
        report = next;
        render();
      }
    },
    onClose() {
      acknowledge();
    },
    destroy() {
      clear(root);
    },
  };
}
