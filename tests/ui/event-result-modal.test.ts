// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { buildEventResultModal } from "../../src/ui/modal-event-result";
import type { GameShell } from "../../src/ui/types";
import type { ViewModel } from "../../src/game/viewTypes";

function makeReport() {
  return {
    id: 7,
    title: "赤色黎明",
    categoryName: "环境",
    choiceLabel: "躲进地窖",
    outcome: "高温退去。",
    turn: 3,
    year: 2,
    summary: "食物 -10 · 稳定度 +2",
    effects: [{ key: "resource:food", label: "食物", kind: "resource", before: 100, after: 90, delta: -10, unit: "吨", tone: "loss", detail: null }],
    followUpTitle: null,
  };
}

function makeView(report: ReturnType<typeof makeReport> | null): ViewModel {
  return { events: { outcomeReport: report } } as unknown as ViewModel;
}

describe("event result modal close/ack", () => {
  it("视图反复刷新时不重建“确认结算”按钮，点击只关闭一次", () => {
    let ack = 0;
    const close = vi.fn();
    const shell = {
      api: () => ({ actions: { acknowledgeEventOutcome: () => { ack += 1; } } }),
      requestRefresh: vi.fn(),
    } as unknown as GameShell;
    const modal = buildEventResultModal(shell, close);
    const view = makeView(makeReport());
    modal.update(view);
    const button = modal.el.querySelector<HTMLButtonElement>(".tri-ercontinue");
    expect(button).toBeTruthy();
    modal.update(view);
    modal.update(view);
    // 同一个 DOM 节点，不能在 100ms 视图刷新时被替换
    expect(modal.el.querySelector(".tri-ercontinue")).toBe(button);
    button!.click();
    expect(ack).toBe(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("关闭（Esc/backdrop 路径）也会确认报告", () => {
    let ack = 0;
    const shell = {
      api: () => ({ actions: { acknowledgeEventOutcome: () => { ack += 1; } } }),
      requestRefresh: vi.fn(),
    } as unknown as GameShell;
    const modal = buildEventResultModal(shell, () => undefined);
    modal.update(makeView(makeReport()));
    modal.onClose?.();
    expect(ack).toBe(1);
  });
});
