/** Help modal: controls, keyboard shortcuts and the simulation's honest limits. */
import { BASE_YEARS_PER_SECOND, MAX_ACCEL, PHYSICS_DT, SOFTENING, TIME_SPEEDS, TURN_YEARS } from "../core/constants";
import type { GameShell, ModalInstance } from "./types";
import { append, el } from "./dom";
import { icon } from "./icons";
import { section } from "./widgets";
import { ERA_INFOS, eraRail, eraTag } from "./era-ui";

export function buildHelpModal(_shell: GameShell, _close: () => void): ModalInstance {
  const root = el("div", { cls: "tri-help-modal" });

  /* Beginner route: E1 -> E5 ---------------------------------------- */
  const guide = section("新手指引 · 从原始时代到星际文明", { icon: "calendar", hint: "E1 → E5" });
  const guideRail = eraRail({ compact: false, className: "tri-help-era-rail" });
  guideRail.update(1, 0);
  guide.body.appendChild(guideRail.el);
  const guideList = el("ol", { cls: "tri-help-guide" });
  const GUIDE_STEPS: { title: string; text: string }[] = [
    { title: "观星台", text: "原始时代先建观星台（观测 Lv.1）：没有观测就没有预测。配合农田与水井把人口推到 900，即进入 E2。" },
    { title: "农业城邦", text: "解锁金属冶炼与灌溉。研究 2 项科技、建成观星台后进入 E3；旧时代的农田与水井可升级以恢复产出。" },
    { title: "工业时代", text: "解锁能源（电力）。完成 6 项科技、2 项城邦科技、观测 Lv.2 后进入 E4；燃煤电站与机械化农场是产能基础。" },
    { title: "信息与航天", text: "完成 11 项科技、2 项工业科技、观测 Lv.3 后进入 E5；超算中心与卫星站把预测窗口推到极限。" },
    { title: "星际文明", text: "完成 17 项科技、2 项信息科技、观测 Lv.4 后进入最终时代：生态穹顶、聚变与星际殖民，或者行星发动机。" },
  ];
  for (let index = 0; index < GUIDE_STEPS.length; index += 1) {
    const step = el("li", { cls: "tri-help-guide-step" });
    const badge = el("span", { cls: "tri-help-guide-badge" });
    badge.appendChild(eraTag(ERA_INFOS[index]?.era ?? index + 1));
    badge.appendChild(el("b", { text: GUIDE_STEPS[index].title }));
    step.appendChild(badge);
    step.appendChild(el("span", { cls: "tri-help-guide-text", text: GUIDE_STEPS[index].text }));
    guideList.appendChild(step);
  }
  guide.body.appendChild(guideList);
  const guideHint = el("p", {
    cls: "tri-help-guide-hint",
    text: "每次进入新时代都会解锁新的资源、建筑与科技；旧时代建筑会产出衰减，记得在「建造终端」里升级。",
  });
  guide.body.appendChild(guideHint);
  root.appendChild(guide.el);

  const controls = section("操作方式", { icon: "eye" });
  append(
    controls.body,
    helpList([
      "鼠标：在中央观测区拖动平移，滚轮缩放，单击天体选中，双击聚焦。",
      "右上角缩放按钮 / 复位按钮可随时调整 2D 星系视图。",
      "底部 dock：建造、科研、天文台、星系地图、事件日志、存档、设置、帮助。",
      "所有按钮都直接作用于模拟状态；资源不足或前置未满足时会显示禁用原因。",
    ]),
  );
  root.appendChild(controls.el);

  const keyboard = section("键盘快捷键", { icon: "cpu" });
  const keyTable = el("div", { cls: "tri-help-keys" });
  const shortcuts: [string, string][] = [
    ["空格", "暂停 / 继续"],
    ["1 – 4", "切换左侧面板页签"],
    ["5", "折叠 / 展开右侧面板"],
    ["6", "折叠 / 展开底部 dock"],
    ["Esc", "关闭弹窗 / 暂停"],
    ["F", "聚焦当前选中的天体"],
    ["T", "显示 / 隐藏观测轨迹"],
    ["P", "显示 / 隐藏预测轨迹"],
    ["Enter", "在种子输入框中开始新纪元"],
  ];
  for (const [key, action] of shortcuts) {
    const row = el("div", { cls: "tri-help-key-row" });
    row.appendChild(el("kbd", { text: key }));
    row.appendChild(el("span", { text: action }));
    keyTable.appendChild(row);
  }
  keyboard.body.appendChild(keyTable);
  root.appendChild(keyboard.el);

  const model = section("科学模型与假设", { icon: "orbit" });
  append(
    model.body,
    helpList([
      "引力：牛顿 N 体模型，单位制为 AU / 太阳质量 / 年，G = 4π²。物理层使用三维笛卡尔坐标（X 水平、Y 垂直高度、Z 深度）。",
      "数值积分：固定步长 " + PHYSICS_DT.toFixed(6) + " 年（约 " + (PHYSICS_DT * 365.25 * 24).toFixed(1) + " 小时），引力软化长度 " + SOFTENING + " AU，加速度上限 " + MAX_ACCEL.toExponential(0) + " AU/年²。",
      "2D 主视图是 X-Z 平面的俯视投影，Y 高度以数字标注提示；3D 空间视图用于观察垂直方向的分布。2D 与 3D 共享同一份物理状态和观测数据，不做独立计算。",
      "一个文明回合 = " + TURN_YEARS + " 模拟年；基础速度 = " + BASE_YEARS_PER_SECOND + " 模拟年 / 真实秒，时间倍率 " + TIME_SPEEDS.filter((speed) => speed > 0).map((speed) => speed + "×").join(" / ") + "。",
      "观测：测量值带有噪声与系统偏差，只有被测量过的量才会进入玩家模型。未观测的数据显示为「未观测」，系统不会伪造。",
      "预测：对当前模型做外推，混沌系统中误差随时间指数增长；预测页给出的可靠年限之外，轨迹仅供参考。",
    ]),
  );
  root.appendChild(model.el);

  const honest = section("关于确定性的声明", { icon: "info" });
  append(
    honest.body,
    helpList([
      "三体运动对初始条件极度敏感。即使拥有超级观测网络，文明也只能延长可预测的窗口，而无法获得无限期的确定未来。",
      "游戏中的恒星、行星、文明与社会模型均为虚构设定，用于机制表达，不代表真实天体物理结论。",
      "观测站等级与设备决定测量精度、观测任务类型和预测年限；提高天文台等级与观测数据点能显著改善模型。",
    ]),
  );
  root.appendChild(honest.el);

  const credits = section("制作", { icon: "book" });
  const creditLine = el("div", { cls: "tri-help-credits" });
  creditLine.appendChild(icon("galaxy", 16));
  creditLine.appendChild(el("span", { text: "三体纪元 TRISOLARIS: CIVILIZATION · 本地单机 · Canvas 2D / WebGL 3D 混合渲染 · 无第三方 UI 依赖" }));
  credits.body.appendChild(creditLine);
  root.appendChild(credits.el);

  return {
    el: root,
    update() {
      /* static content */
    },
    destroy() {
      /* static content */
    },
  };
}

function helpList(items: string[]): HTMLElement {
  const list = el("ul", { cls: "tri-help-list" });
  for (const item of items) list.appendChild(el("li", { text: item }));
  return list;
}
