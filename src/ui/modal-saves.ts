/** Save/load terminal: slots, new saves, export and import. */
import type { SaveSlotMeta, ViewModel } from "../game/viewTypes";
import type { GameShell, ModalInstance } from "./types";
import { append, clear, el, setText } from "./dom";
import { icon } from "./icons";
import { dateTime, int, num } from "./format";
import { emptyBox } from "./widgets";

export function buildSavesModal(shell: GameShell, close: () => void): ModalInstance {
  const root = el("div", { cls: "tri-saves-modal" });
  const toolbar = el("div", { cls: "tri-saves-toolbar" });
  const nameInput = el("input", {
    cls: "tri-input tri-save-name",
    attrs: { type: "text", maxlength: "48", placeholder: "存档名称（留空自动命名）", "aria-label": "存档名称" },
  });
  const saveBtn = el("button", { cls: "tri-btn tri-btn-primary tri-btn-sm", attrs: { type: "button" } });
  saveBtn.appendChild(icon("save", 15));
  saveBtn.appendChild(el("span", { cls: "tri-btn-label", text: "保存当前进度" }));
  const refreshBtn = el("button", { cls: "tri-btn tri-btn-ghost tri-btn-sm", attrs: { type: "button" } });
  refreshBtn.appendChild(icon("reset", 14));
  refreshBtn.appendChild(el("span", { cls: "tri-btn-label", text: "刷新" }));
  append(toolbar, nameInput, saveBtn, refreshBtn);
  root.appendChild(toolbar);

  const secondary = el("div", { cls: "tri-saves-secondary" });
  const exportBtn = el("button", { cls: "tri-btn tri-btn-ghost tri-btn-sm", attrs: { type: "button" } });
  exportBtn.appendChild(icon("download", 14));
  exportBtn.appendChild(el("span", { cls: "tri-btn-label", text: "导出当前存档" }));
  const importBtn = el("button", { cls: "tri-btn tri-btn-ghost tri-btn-sm", attrs: { type: "button" } });
  importBtn.appendChild(icon("upload", 14));
  importBtn.appendChild(el("span", { cls: "tri-btn-label", text: "导入存档文件" }));
  const fileInput = el("input", { attrs: { type: "file", accept: ".json,application/json" }, style: { display: "none" } });
  importBtn.addEventListener("click", () => fileInput.click());
  append(secondary, exportBtn, importBtn, fileInput);
  root.appendChild(secondary);

  const info = el("div", { cls: "tri-saves-info", text: "正在读取本地存档…" });
  const list = el("div", { cls: "tri-save-list" });
  const empty = emptyBox("暂无存档 · 保存当前进度以创建第一个存档");
  append(root, info, list, empty);

  let slots: SaveSlotMeta[] = [];
  let busy = false;
  let destroyed = false;
  let current: ViewModel | null = shell.view();

  saveBtn.addEventListener("click", () => void saveNew());
  refreshBtn.addEventListener("click", () => void refresh());
  exportBtn.addEventListener("click", () => void exportCurrent());
  fileInput.addEventListener("change", () => void importFile(fileInput));

  info.textContent = "读取存档列表…";
  void refresh();

  if (current?.saving?.slots) {
    slots = current.saving.slots;
    renderList();
  }

  async function refresh(): Promise<void> {
    const api = shell.api();
    if (!api) {
      info.textContent = "尚未进入游戏，无法读取存档";
      return;
    }
    busy = true;
    updateBusy();
    try {
      slots = await api.actions.listSaves();
      if (destroyed) return;
      info.textContent = slots.length > 0 ? "本地存档 " + slots.length + " 个" : "本地暂无存档";
      renderList();
    } catch (error) {
      info.textContent = "读取存档失败：" + messageOf(error);
    } finally {
      busy = false;
      updateBusy();
    }
  }

  async function saveNew(): Promise<void> {
    const api = shell.api();
    if (!api || busy) return;
    const name = nameInput.value.trim() || "纪元 " + (current ? Math.floor(current.meta.calendarYear) : "");
    const slotId = "slot-" + Date.now().toString(36);
    busy = true;
    updateBusy();
    info.textContent = "正在写入存档「" + name + "」…";
    try {
      const result = await api.actions.saveGame(slotId, name);
      if (destroyed) return;
      if (result.ok) {
        shell.notify("已保存「" + name + "」", "ok");
        nameInput.value = "";
        await refresh();
      } else {
        info.textContent = "保存失败：" + (result.error ?? "未知错误");
      }
    } catch (error) {
      info.textContent = "保存异常：" + messageOf(error);
    } finally {
      busy = false;
      updateBusy();
    }
  }

  async function exportCurrent(): Promise<void> {
    const api = shell.api();
    if (!api || busy) return;
    try {
      info.textContent = "正在导出当前存档…";
      await api.actions.exportSave();
      if (!destroyed) info.textContent = "当前存档已导出为文件";
    } catch (error) {
      info.textContent = "导出失败：" + messageOf(error);
    }
  }

  async function importFile(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file) return;
    const api = shell.api();
    if (!api) return;
    info.textContent = "正在导入「" + file.name + "」…";
    try {
      const text = await file.text();
      const ok = await api.actions.importSaveText(text);
      if (destroyed) return;
      if (ok) {
        shell.notify("存档导入成功", "ok");
        await refresh();
      } else {
        info.textContent = "导入失败：不是有效的存档文件";
      }
    } catch (error) {
      info.textContent = "导入异常：" + messageOf(error);
    } finally {
      input.value = "";
    }
  }

  function renderList(): void {
    clear(list);
    empty.classList.toggle("tri-hidden", slots.length > 0);
    const sorted = slots.slice().sort((a, b) => b.savedAt - a.savedAt);
    for (const slot of sorted) list.appendChild(createSlotRow(slot));
  }

  function createSlotRow(slot: SaveSlotMeta): HTMLElement {
    const row = el("div", { cls: "tri-save-row", attrs: { "data-slot": slot.id } });
    const meta = el("div", { cls: "tri-save-meta" });
    const name = el("div", { cls: "tri-save-name" });
    name.appendChild(el("span", { text: slot.name || "未命名纪元" }));
    name.appendChild(el("span", { cls: "tri-badge tri-badge-dim", text: slot.difficulty }));
    name.appendChild(el("span", { cls: "tri-badge tri-badge-dim", text: slot.mode }));
    if (slot.auto) name.appendChild(el("span", { cls: "tri-badge tri-badge-dim", text: "自动" }));
    append(
      meta,
      name,
      el("div", { cls: "tri-save-sub", text: "种子 " + slot.seed + " · 星历 " + Math.round(slot.year) + " 年 · 回合 " + slot.turn + " · 时代 E" + slot.era }),
      el("div", { cls: "tri-save-sub", text: "人口 " + num(slot.population) + " · 保存于 " + dateTime(slot.savedAt) + " · 版本 v" + slot.version }),
    );
    const buttons = el("div", { cls: "tri-save-buttons" });
    const loadBtn = smallButton("读取", "play", () => void loadSlot(slot));
    const overwriteBtn = smallButton("覆盖保存", "save", () => void overwriteSlot(slot));
    const deleteBtn = smallButton("删除", "trash", () => {});
    deleteBtn.classList.add("tri-btn-danger");
    armConfirm(deleteBtn, "确认删除", () => void deleteSlot(slot));
    append(buttons, loadBtn, overwriteBtn, deleteBtn);
    append(row, meta, buttons);
    return row;
  }

  async function loadSlot(slot: SaveSlotMeta): Promise<void> {
    const api = shell.api();
    if (!api || busy) return;
    busy = true;
    updateBusy();
    info.textContent = "正在载入「" + slot.name + "」…";
    try {
      const ok = await api.actions.loadGame(slot.id);
      if (destroyed) return;
      if (ok) {
        shell.notify("已载入存档「" + slot.name + "」", "ok");
        close();
      } else {
        info.textContent = "载入失败：存档不可用";
      }
    } catch (error) {
      info.textContent = "载入异常：" + messageOf(error);
    } finally {
      busy = false;
      updateBusy();
    }
  }

  async function overwriteSlot(slot: SaveSlotMeta): Promise<void> {
    const api = shell.api();
    if (!api || busy) return;
    busy = true;
    updateBusy();
    info.textContent = "正在覆盖「" + slot.name + "」…";
    try {
      const result = await api.actions.saveGame(slot.id, slot.name);
      if (destroyed) return;
      if (result.ok) {
        shell.notify("已覆盖存档「" + slot.name + "」", "ok");
        await refresh();
      } else {
        info.textContent = "覆盖失败：" + (result.error ?? "未知错误");
      }
    } catch (error) {
      info.textContent = "覆盖异常：" + messageOf(error);
    } finally {
      busy = false;
      updateBusy();
    }
  }

  async function deleteSlot(slot: SaveSlotMeta): Promise<void> {
    const api = shell.api();
    if (!api || busy) return;
    busy = true;
    updateBusy();
    info.textContent = "正在删除「" + slot.name + "」…";
    try {
      await api.actions.deleteSave(slot.id);
      if (destroyed) return;
      shell.notify("已删除存档「" + slot.name + "」", "info");
      await refresh();
    } catch (error) {
      info.textContent = "删除失败：" + messageOf(error);
    } finally {
      busy = false;
      updateBusy();
    }
  }

  function updateBusy(): void {
    const disabled = busy || current?.saving?.busy === true;
    for (const button of root.querySelectorAll<HTMLButtonElement>("button")) button.disabled = disabled;
    root.dataset.busy = disabled ? "true" : "false";
  }

  return {
    el: root,
    update(view) {
      current = view;
      updateBusy();
    },
    destroy() {
      destroyed = true;
    },
  };
}

function smallButton(label: string, iconName: string, handler: () => void): HTMLButtonElement {
  const node = el("button", { cls: "tri-btn tri-btn-ghost tri-btn-sm", attrs: { type: "button" } });
  node.appendChild(icon(iconName, 14));
  node.appendChild(el("span", { cls: "tri-btn-label", text: label }));
  node.addEventListener("click", handler);
  return node;
}

/** Two-step confirmation for destructive buttons (no native confirm dialog). */
function armConfirm(button: HTMLButtonElement, confirmLabel: string, action: () => void): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  button.addEventListener("click", () => {
    if (button.dataset.armed === "true") {
      if (timer) clearTimeout(timer);
      delete button.dataset.armed;
      button.classList.remove("is-armed");
      setLabel(button, confirmLabel.replace("确认", ""));
      action();
      return;
    }
    button.dataset.armed = "true";
    button.classList.add("is-armed");
    setLabel(button, confirmLabel);
    timer = setTimeout(() => {
      delete button.dataset.armed;
      button.classList.remove("is-armed");
      setLabel(button, confirmLabel.replace("确认", ""));
      timer = null;
    }, 3200);
  });
}

function setLabel(button: HTMLButtonElement, label: string): void {
  const node = button.querySelector(".tri-btn-label");
  if (node) node.textContent = label;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
