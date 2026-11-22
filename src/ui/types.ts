/**
 * Shared UI types for the TRISOLARIS interface layer.
 *
 * The UI never imports simulation internals: everything below is derived from
 * the frozen contracts in src/game/viewTypes.ts (+ a few pure constant tables
 * explicitly allowed for the setup screen).
 */
import type { AppController, GameApi, SceneRenderer, SceneRenderer3D, ViewModel } from "../game/viewTypes";
import type { DifficultyKey, GameMode } from "../core/types";

export type LeftTab = "overview" | "population" | "buildings" | "society";
export type RightTab =
  | "stars"
  | "environment"
  | "observation"
  | "prediction"
  | "tech"
  | "hazards"
  /** v1.3 政治档案（数据未接入时安全降级）。 */
  | "politics"
  /** v1.3 随机事件档案。 */
  | "events";
export type ModalKind =
  | "build"
  | "research"
  | "observatory"
  | "map"
  | "log"
  | "saves"
  | "settings"
  | "help"
  /** v1.3 政治终端（六部门 / 派系 / 关系矩阵）。 */
  | "politics"
  /** v1.3 纪元事件档案与抉择面板。 */
  | "event"
  /** v1.4.2 事件抉择 30 秒后的量化结算报告。 */
  | "eventResult";
export type ScreenKind = "menu" | "newgame" | "game";
export type Tone = "info" | "ok" | "warn" | "danger";
/** 2D is the X-Z top-down projection; 3D is the auxiliary spatial view. */
export type ViewMode = "2d" | "3d";

/** Purely presentational state. Never mirrors simulation state. */
export interface UiState {
  screen: ScreenKind;
  leftTab: LeftTab;
  rightTab: RightTab;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  dockCollapsed: boolean;
  viewMode: ViewMode;
  modal: ModalKind | null;
  logFilter: string;
  newSeed: string;
  difficulty: DifficultyKey;
  mode: GameMode;
}

export interface ScreenHandle {
  el: HTMLElement;
  destroy(): void;
  /** Return true when the key was consumed (prevents further handling). */
  onKey?(ev: KeyboardEvent): boolean;
}

/** Context handed to every screen by app.ts. */
export interface UiContext {
  root: HTMLElement;
  host: AppController;
  state: UiState;
  setScreen(screen: ScreenKind): void;
  notify(text: string, tone?: Tone): void;
  showError(text: string | null): void;
}

/**
 * Bridge exposed by the game screen to its child widgets. Widgets ask for the
 * current GameApi instead of capturing one, so a game swap never leaves stale
 * actions behind.
 */
export interface GameShell {
  readonly host: AppController;
  readonly state: UiState;
  api(): GameApi | null;
  view(): ViewModel | null;
  openModal(kind: ModalKind): void;
  closeModal(): void;
  activeModal(): ModalKind | null;
  renderer(): SceneRenderer | null;
  renderer3d(): SceneRenderer3D | null;
  setLeftTab(tab: LeftTab): void;
  setRightTab(tab: RightTab): void;
  viewMode(): ViewMode;
  setViewMode(mode: ViewMode): void;
  /** True while the lazy 3D backend module is being fetched/initialised. */
  viewModeBusy(): boolean;
  notify(text: string, tone?: Tone): void;
  setError(text: string | null): void;
  backToMenu(): void;
  /** Ask the loop to refresh view data on the next animation frame. */
  requestRefresh(): void;
}

/** A modal dialog owns its content; it is rebuilt every time it opens. */
export interface ModalInstance {
  el: HTMLElement;
  update(view: ViewModel): void;
  destroy(): void;
  /** 关闭时调用（结算报告用它来确认并清空 pending outcome）。 */
  onClose?(): void;
}

export type ModalBuilder = (shell: GameShell, close: () => void) => ModalInstance;

export type LogCategory = ViewModel["log"][number]["category"];
export const LOG_CATEGORIES: { id: LogCategory; label: string }[] = [
  { id: "system", label: "系统" },
  { id: "physics", label: "天体物理" },
  { id: "observation", label: "观测" },
  { id: "civilization", label: "文明" },
  { id: "hazard", label: "灾害" },
  { id: "tech", label: "科技" },
  { id: "build", label: "建造" },
  { id: "milestone", label: "里程碑" },
  { id: "ending", label: "结局" },
];

export const GAME_MODE_INFO: Record<GameMode, { name: string; short: string; description: string; icon: string }> = {
  story: {
    name: "剧情模式",
    short: "剧情",
    description: "围绕文明存续的叙事线推进，灾害节奏由剧本控制，适合体验世界观。",
    icon: "book",
  },
  normal: {
    name: "标准模式",
    short: "标准",
    description: "完整的观测—预测—建设循环，混沌三体系统按真实物理演化。",
    icon: "orbit",
  },
  survival: {
    name: "生存模式",
    short: "生存",
    description: "资源稀少、恒星扰动更频繁，任何一次误判都可能是最后一次。",
    icon: "shield",
  },
  sandbox: {
    name: "沙盒模式",
    short: "沙盒",
    description: "取消人口崩溃与部分失败条件，用于自由测试建筑与科技路线。",
    icon: "planet",
  },
};

export interface ToastItem {
  id: number;
  text: string;
  tone: Tone;
}
