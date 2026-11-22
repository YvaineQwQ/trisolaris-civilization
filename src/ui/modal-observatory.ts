/** Observatory modal: level ladder, capabilities and upgrade requirements. */
import { OBSERVATORY_LEVELS } from "../core/constants";
import type { ObservationTaskView, ObservatoryView, ViewModel } from "../game/viewTypes";
import type { GameShell, ModalInstance } from "./types";
import { append, clear, delegate, el, setText } from "./dom";
import { icon } from "./icons";
import { meterBar } from "./charts";
import { int, num, pct, years } from "./format";
import { chip, divider, emptyBox, kv, resourceIconName, section } from "./widgets";
import { eraInfo, eraTag } from "./era-ui";
import { ART, setArtBackground } from "./art";

export function buildObservatoryModal(shell: GameShell, _close: () => void): ModalInstance {
  const root = el("div", { cls: "tri-observatory" });

  const artBox = el("div", { cls: "tri-obs-art" });
  artBox.style.backgroundPosition = "center 72%";
  const artShade = el("div", { cls: "tri-obs-art-shade", attrs: { "aria-hidden": "true" } });
  const observatoryArtLabel = el("div", { cls: "tri-obs-art-label", text: "观测站 Lv.0" });
  append(artBox, artShade, observatoryArtLabel);
  root.appendChild(artBox);
  setArtBackground(artBox, ART.observatory(0));

  const ladderSection = section("观测站等级", { icon: "telescope", hint: "同心刻度 · 由内向外" });
  const ladderWrap = el("div", { cls: "tri-obs-ladder-wrap" });
  const ladderRings = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  ladderRings.setAttribute("viewBox", "0 0 600 120");
  ladderRings.setAttribute("class", "tri-obs-rings");
  ladderRings.setAttribute("aria-hidden", "true");
  for (let i = 1; i <= 6; i += 1) {
    const ring = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
    ring.setAttribute("cx", "300");
    ring.setAttribute("cy", "120");
    ring.setAttribute("rx", String(i * 92));
    ring.setAttribute("ry", String(i * 30));
    ring.setAttribute("class", "tri-obs-ring");
    ladderRings.appendChild(ring);
  }
  const ladder = el("div", { cls: "tri-obs-ladder" });
  append(ladderWrap, ladderRings, ladder);
  ladderSection.body.appendChild(ladderWrap);
  root.appendChild(ladderSection.el);

  const currentSection = section("当前设施", { icon: "eye" });
  const currentHead = el("div", { cls: "tri-obs-modal-head" });
  const currentLevel = el("span", { cls: "tri-obs-modal-level", text: "Lv.0" });
  const currentName = el("span", { cls: "tri-obs-modal-name", text: "—" });
  const currentData = el("span", { cls: "tri-badge", text: "—" });
  const currentEraTag = eraTag(1, "tri-obs-era-tag");
  append(currentHead, currentLevel, currentName, currentData, currentEraTag);
  const currentDesc = el("p", { cls: "tri-hint", text: "—" });
  const capsRow = el("div", { cls: "tri-chip-row" });
  const statsGrid = el("div", { cls: "tri-kv-grid" });
  const equipRow = kv("观测设备", "—");
  const efficiencyRow = kv("观测效率", "—");
  const dataRow = kv("累计数据点", "—");
  append(statsGrid, equipRow.el, efficiencyRow.el, dataRow.el);
  append(currentSection.body, currentHead, currentDesc, capsRow, statsGrid);
  root.appendChild(currentSection.el);

  const upgradeSection = section("升级", { icon: "bolt" });
  const upgradeGrid = el("div", { cls: "tri-obs-upgrade" });
  const upgradeTitle = el("div", { cls: "tri-obs-upgrade-title", text: "—" });
  const upgradeDesc = el("p", { cls: "tri-hint", text: "—" });
  const upgradeCaps = el("div", { cls: "tri-chip-row" });
  const upgradeCosts = el("div", { cls: "tri-cost-list" });
  const upgradeScience = el("div", { cls: "tri-obs-science", text: "—" });
  const upgradeEra = el("div", { cls: "tri-obs-era", text: "" });
  const upgradeReq = el("div", { cls: "tri-obs-req", text: "" });
  const upgradeBtn = el("button", { cls: "tri-btn tri-btn-primary", attrs: { type: "button", "data-action": "upgrade-observatory" } });
  upgradeBtn.appendChild(icon("bolt", 15));
  upgradeBtn.appendChild(el("span", { cls: "tri-btn-label", text: "升级观测站" }));
  append(upgradeGrid, upgradeTitle, upgradeDesc, upgradeEra, upgradeCaps, upgradeCosts, upgradeScience, upgradeReq, upgradeBtn);
  upgradeSection.body.appendChild(upgradeGrid);
  root.appendChild(upgradeSection.el);

  const taskSection = section("观测任务", { icon: "target" });
  const taskBox = el("div", { cls: "tri-obs-modal-task" });
  const taskHead = el("div", { cls: "tri-obs-modal-task-head" });
  const taskKind = el("span", { cls: "tri-obs-modal-task-kind", text: "—" });
  const taskTarget = el("span", { cls: "tri-badge", text: "—" });
  append(taskHead, taskKind, taskTarget);
  const taskMeter = meterBar("accent");
  taskMeter.el.classList.add("tri-obs-modal-meter");
  const taskMeta = el("div", { cls: "tri-section-meta", text: "—" });
  const taskSummary = el("p", { cls: "tri-hint", text: "" });
  const cancelBtn = el("button", { cls: "tri-btn tri-btn-danger tri-btn-sm", attrs: { type: "button", "data-action": "cancel-observation" } });
  cancelBtn.appendChild(icon("close", 14));
  cancelBtn.appendChild(el("span", { cls: "tri-btn-label", text: "中止观测" }));
  const gotoBtn = el("button", { cls: "tri-btn tri-btn-ghost tri-btn-sm", attrs: { type: "button", "data-action": "goto-observation" } });
  gotoBtn.appendChild(icon("chevronRight", 14));
  gotoBtn.appendChild(el("span", { cls: "tri-btn-label", text: "前往观测页" }));
  append(taskBox, taskHead, taskMeter.el, taskMeta, taskSummary);
  const taskEmpty = emptyBox("当前没有进行中的观测任务 · 在右侧「观测」页发起");
  const taskActions = el("div", { cls: "tri-obs-modal-actions" });
  append(taskActions, cancelBtn, gotoBtn);
  append(taskSection.body, taskBox, taskEmpty, taskActions);
  root.appendChild(taskSection.el);

  const modelSection = section("科学产出", { icon: "book" });
  const modelGrid = el("div", { cls: "tri-kv-grid" });
  const modelState = kv("轨道模型", "—");
  const modelHorizon = kv("预测年限", "—");
  const discoveryRow = kv("科学发现", "—");
  append(modelGrid, modelState.el, modelHorizon.el, discoveryRow.el);
  modelSection.body.appendChild(modelGrid);
  root.appendChild(modelSection.el);

  delegate(root, "[data-action='upgrade-observatory']", "click", () => {
    shell.api()?.actions.upgradeObservatory();
    shell.requestRefresh();
  });
  delegate(root, "[data-action='cancel-observation']", "click", () => {
    shell.api()?.actions.cancelObservation();
    shell.requestRefresh();
  });
  delegate(root, "[data-action='goto-observation']", "click", () => {
    shell.setRightTab("observation");
    shell.closeModal();
  });

  let levelsRendered = false;
  let view: ViewModel | null = shell.view();
  if (view) update(view);

  function update(next: ViewModel): void {
    view = next;
    const observatory = next.observatory;
    setArtBackground(artBox, ART.observatory(observatory.level));
    setText(observatoryArtLabel, "观测站 " + observatory.name + " · Lv." + observatory.level);
    if (!levelsRendered) {
      levelsRendered = true;
      renderLadder(observatory);
    }
    for (const cell of ladder.querySelectorAll<HTMLElement>(".tri-obs-step")) {
      const level = Number(cell.dataset.level);
      cell.classList.toggle("is-current", level === observatory.level);
      cell.classList.toggle("is-done", level < observatory.level);
    }
    setText(currentLevel, "Lv." + observatory.level);
    setText(currentName, observatory.name);
    setText(currentData, "数据点 " + int(observatory.dataPoints));
    setCurrentEraTag(observatory.era);
    setText(currentDesc, observatory.description);
    clear(capsRow);
    if (observatory.capabilities.length === 0) capsRow.appendChild(chip("无观测能力", "danger"));
    else for (const capability of observatory.capabilities) capsRow.appendChild(chip(capability));
    setText(equipRow.valueNode, observatory.equipmentName || "—");
    setText(efficiencyRow.valueNode, pct(observatory.efficiency, 0));
    setText(dataRow.valueNode, int(observatory.dataPoints) + " 点");

    const nextInfo = observatory.next;
    clear(upgradeCosts);
    clear(upgradeCaps);
    if (!nextInfo) {
      setText(upgradeTitle, "已达最高等级");
      setText(upgradeDesc, "超级天文观测网络已建成，但混沌系统仍不承诺确定的未来。");
      upgradeBtn.disabled = true;
      upgradeBtn.title = "已达最高等级";
      setText(upgradeScience, "");
      setText(upgradeReq, "");
      clear(upgradeEra);
      setText(upgradeBtn.querySelector(".tri-btn-label"), "已满级");
    } else {
      setText(upgradeTitle, "Lv." + nextInfo.level + " · " + nextInfo.name);
      setText(upgradeDesc, nextInfo.description);
      for (const capability of nextInfo.capabilities) upgradeCaps.appendChild(chip(capability));
      for (const cost of nextInfo.cost) {
        const row = el("div", { cls: "tri-cost-row" });
        row.appendChild(icon(resourceIconName(cost.resourceId), 14));
        row.appendChild(el("span", { cls: "tri-cost-name", text: cost.name }));
        const amount = el("span", { cls: "tri-cost-amount", text: num(cost.amount) });
        if (!cost.affordable) amount.dataset.tone = "danger";
        row.appendChild(amount);
        row.appendChild(el("span", { cls: "tri-cost-have", text: "库存 " + num(cost.have) }));
        upgradeCosts.appendChild(row);
      }
      setText(upgradeScience, "科研点需求：" + int(nextInfo.upgradeScience));
      const requiresEra = typeof nextInfo.requiresEra === "number" ? nextInfo.requiresEra : 1;
      const eraOk = nextInfo.eraOk !== false;
      clear(upgradeEra);
      const gate = el("span", { cls: "tri-obs-era-gate" });
      const gateTag = eraTag(requiresEra);
      gateTag.dataset.ok = eraOk ? "true" : "false";
      append(
        gate,
        gateTag,
        el("span", {
          cls: "tri-obs-era-text",
          text: eraOk ? "时代门槛已满足 · 当前 E" + observatory.era : "需要进入 E" + requiresEra + " " + eraInfo(requiresEra).name,
        }),
      );
      upgradeEra.appendChild(gate);
      const reqParts: string[] = [];
      if (nextInfo.requiresTechName) reqParts.push("前置科技：" + nextInfo.requiresTechName);
      if (nextInfo.blockedReason && !String(nextInfo.blockedReason).includes("时代")) reqParts.push(nextInfo.blockedReason);
      setText(upgradeReq, reqParts.join(" · "));
      upgradeBtn.disabled = !nextInfo.canUpgrade;
      upgradeBtn.title = nextInfo.canUpgrade ? "升级观测站" : nextInfo.blockedReason ?? "条件不足";
      setText(upgradeBtn.querySelector(".tri-btn-label"), nextInfo.canUpgrade ? "升级观测站" : "条件不足");
    }

    updateTask(next.observation.activeTask);
    const observation = next.observation;
    setText(modelState.valueNode, observation.hasModel ? "可用 · 精度 " + pct(observation.modelAccuracy ?? 0, 0) : "尚无轨道模型");
    setText(modelHorizon.valueNode, observation.modelHorizon == null ? "—" : years(observation.modelHorizon, 1));
    setText(discoveryRow.valueNode, observation.discoveries.length + " 项");
  }

  function updateTask(task: ObservationTaskView | null): void {
    taskBox.classList.toggle("tri-hidden", task == null);
    taskEmpty.classList.toggle("tri-hidden", task != null);
    if (!task) return;
    setText(taskKind, task.kindLabel);
    setText(taskTarget, task.targetLabel);
    taskMeter.update(task.progress, { tone: "accent" });
    setText(taskMeta, "进度 " + pct(task.progress, 0) + " · 回合 " + task.turnsElapsed + " / " + task.turnsRequired + " · 能耗 " + num(task.energyCost));
    setText(taskSummary, task.summary);
  }

  function setCurrentEraTag(era: number): void {
    const value = typeof era === "number" && Number.isFinite(era) ? era : 1;
    currentEraTag.textContent = "E" + value;
    currentEraTag.dataset.era = String(value);
    currentEraTag.title = "当前时代 E" + value + " " + eraInfo(value).name;
  }

  function renderLadder(observatory: ObservatoryView): void {
    clear(ladder);
    const maxLevel = Math.max(observatory.maxLevel, observatory.level);
    for (let level = 0; level <= maxLevel; level += 1) {
      const info = OBSERVATORY_LEVELS[level];
      const step = el("div", { cls: "tri-obs-step", attrs: { "data-level": level, title: info ? info.description : "" } });
      const dotEl = el("span", { cls: "tri-obs-step-dot", text: String(level) });
      const name = el("span", { cls: "tri-obs-step-name", text: info ? info.name : "Lv." + level });
      step.append(dotEl, name);
      ladder.appendChild(step);
    }
  }

  return {
    el: root,
    update,
    destroy() {
      /* listeners live on the subtree */
    },
  };
}
