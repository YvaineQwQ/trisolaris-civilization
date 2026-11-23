import { describe, expect, it } from "vitest";
import { EVENT_DEFS } from "../../src/events/definitions";

describe("事件增益/减益文本与数值一致性", () => {
  it("声明“没有人饿死”的选项不能同时减少食物", () => {
    for (const def of EVENT_DEFS) {
      for (const choice of def.choices ?? []) {
        const text = (choice.outcome ?? "") + " " + (choice.description ?? "");
        if (/没有人饿死|无人饿死/.test(text)) {
          expect(choice.effects?.resources?.food ?? 0, def.id + "/" + choice.id).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("声明“粮仓堆到顶/当年丰收”的即时选项不能给出净食物损失", () => {
    for (const def of EVENT_DEFS) {
      for (const choice of def.choices ?? []) {
        const text = (choice.outcome ?? "") + " " + (choice.description ?? "");
        if (/粮仓堆到顶|当年丰收|立即丰收/.test(text)) {
          expect(choice.effects?.resources?.food ?? 0, def.id + "/" + choice.id).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("休养生息不再以食物为代价，保留稳定度与人口收益", () => {
    const def = EVENT_DEFS.find((item) => item.id === "env_quiet_spring");
    const rest = def?.choices.find((item) => item.id === "rest");
    expect(rest).toBeTruthy();
    expect(rest!.effects.resources?.food ?? 0).toBe(0);
    expect(rest!.effects.stability).toBeGreaterThan(0);
  });
});
