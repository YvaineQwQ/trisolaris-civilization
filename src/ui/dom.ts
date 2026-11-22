/** Small dependency-free DOM helpers used across the UI. */

export type Attrs = Record<string, string | number | boolean | null | undefined>;

export interface ElOptions {
  cls?: string;
  text?: string;
  attrs?: Attrs;
  style?: Record<string, string>;
  dataset?: Record<string, string>;
}

/** Create an element. Pass a string as shorthand for the class name. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options?: ElOptions | string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (typeof options === "string") {
    node.className = options;
  } else if (options) {
    if (options.cls) node.className = options.cls;
    if (options.text != null) node.textContent = options.text;
    if (options.attrs) {
      for (const [key, value] of Object.entries(options.attrs)) {
        if (value == null || value === false) continue;
        node.setAttribute(key, value === true ? "" : String(value));
      }
    }
    if (options.style) {
      for (const [key, value] of Object.entries(options.style)) node.style.setProperty(key, value);
    }
    if (options.dataset) Object.assign(node.dataset, options.dataset);
  }
  return node;
}

export function append(parent: Node, ...children: (Node | string | null | undefined | false)[]): void {
  for (const child of children) {
    if (child == null || child === false) continue;
    parent.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
}

export function clear(node: Node): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Only touch the DOM when the text actually changed. */
export function setText(node: Node | null | undefined, value: string | number): void {
  if (!node) return;
  const text = String(value);
  if (node.textContent !== text) node.textContent = text;
}

export function setClass(node: Element | null | undefined, cls: string, on: boolean): void {
  if (!node) return;
  if (on) {
    if (!node.classList.contains(cls)) node.classList.add(cls);
  } else if (node.classList.contains(cls)) {
    node.classList.remove(cls);
  }
}

export function setAttr(node: Element | null | undefined, name: string, value: string | number | null | undefined): void {
  if (!node) return;
  if (value == null) {
    if (node.hasAttribute(name)) node.removeAttribute(name);
    return;
  }
  const text = String(value);
  if (node.getAttribute(name) !== text) node.setAttribute(name, text);
}

export function setStyle(node: HTMLElement | null | undefined, prop: string, value: string): void {
  if (!node) return;
  if (node.style.getPropertyValue(prop) !== value) node.style.setProperty(prop, value);
}

export function on(
  target: EventTarget,
  type: string,
  handler: (ev: Event) => void,
  options?: AddEventListenerOptions,
): () => void {
  target.addEventListener(type, handler, options);
  return () => target.removeEventListener(type, handler, options);
}

/** Event delegation: handler receives the closest matching element. */
export function delegate<T extends Element = HTMLElement>(
  root: HTMLElement,
  selector: string,
  type: string,
  handler: (ev: Event, target: T) => void,
): () => void {
  const listener = (ev: Event): void => {
    const node = ev.target;
    if (!(node instanceof Element)) return;
    const match = node.closest(selector);
    if (!match || !root.contains(match)) return;
    handler(ev, match as T);
  };
  root.addEventListener(type, listener);
  return () => root.removeEventListener(type, listener);
}

export function q<E extends Element = HTMLElement>(root: ParentNode, selector: string): E | null {
  return root.querySelector<E>(selector);
}

export function qa<E extends Element = HTMLElement>(root: ParentNode, selector: string): E[] {
  return Array.from(root.querySelectorAll<E>(selector));
}

/** Patch a single text node inside a card, useful from KeyedList patch fns. */
export function qText(root: ParentNode, selector: string, value: string | number): void {
  const node = root.querySelector(selector);
  if (node) setText(node, value);
}

export interface ButtonOptions {
  label: string;
  cls?: string;
  title?: string;
  variant?: "ghost" | "primary" | "danger" | "chip" | "icon" | "tab";
  icon?: Node;
  disabled?: boolean;
  disabledReason?: string;
  onClick?: (ev: MouseEvent) => void;
}

export function button(options: ButtonOptions): HTMLButtonElement {
  const node = el("button", {
    cls: "tri-btn" + (options.variant ? " tri-btn-" + options.variant : "") + (options.cls ? " " + options.cls : ""),
    attrs: { type: "button" },
  });
  if (options.icon) node.appendChild(options.icon);
  node.appendChild(el("span", { cls: "tri-btn-label", text: options.label }));
  const reason = options.disabledReason ?? options.title;
  if (reason) node.title = reason;
  if (options.disabled) node.disabled = true;
  if (options.onClick) {
    node.addEventListener("click", (ev) => {
      if (node.disabled) {
        ev.preventDefault();
        return;
      }
      options.onClick?.(ev);
    });
  }
  return node;
}

export function badge(text: string, tone?: string): HTMLSpanElement {
  const node = el("span", { cls: "tri-badge" + (tone ? " tri-tone-" + tone : ""), text });
  return node;
}

export function iconButton(iconNode: Node, label: string, title: string, onClick?: (ev: MouseEvent) => void): HTMLButtonElement {
  const node = el("button", { cls: "tri-btn tri-btn-icon", attrs: { type: "button", title, "aria-label": label } });
  node.appendChild(iconNode);
  if (onClick) node.addEventListener("click", onClick);
  return node;
}

/** Minimal keyed list: reuses rows, patches values, keeps scroll position. */
export class KeyedList<T> {
  private readonly rows = new Map<string, HTMLElement>();

  constructor(
    private readonly container: HTMLElement,
    private readonly keyOf: (item: T) => string,
    private readonly create: (item: T) => HTMLElement,
    private readonly patch: (node: HTMLElement, item: T) => void,
  ) {}

  update(items: T[]): void {
    const seen = new Set<string>();
    let index = 0;
    for (const item of items) {
      const key = this.keyOf(item);
      seen.add(key);
      let node = this.rows.get(key);
      if (!node) {
        node = this.create(item);
        node.dataset.key = key;
        this.rows.set(key, node);
      }
      this.patch(node, item);
      const current = this.container.children[index];
      if (current !== node) this.container.insertBefore(node, current ?? null);
      index += 1;
    }
    for (const [key, node] of Array.from(this.rows.entries())) {
      if (seen.has(key)) continue;
      node.remove();
      this.rows.delete(key);
    }
  }

  clear(): void {
    this.rows.clear();
    clear(this.container);
  }
}

type RafScheduler = (cb: FrameRequestCallback) => number;
type RafCanceller = (handle: number) => void;

const scheduleFrame: RafScheduler =
  typeof requestAnimationFrame === "function"
    ? (cb) => requestAnimationFrame(cb)
    : (cb) => setTimeout(() => cb(Date.now()), 16) as unknown as number;

const cancelFrame: RafCanceller =
  typeof cancelAnimationFrame === "function"
    ? (handle) => cancelAnimationFrame(handle)
    : (handle) => clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);

/** requestAnimationFrame loop with a jsdom-safe timer fallback. */
export function rafLoop(callback: (now: number) => void): () => void {
  let stopped = false;
  let handle = 0;
  const tick = (now: number): void => {
    if (stopped) return;
    handle = scheduleFrame(tick);
    callback(now);
  };
  handle = scheduleFrame(tick);
  return () => {
    stopped = true;
    cancelFrame(handle);
  };
}

export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  cancel(): void;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const wrapped = (...args: A): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };
  wrapped.cancel = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return wrapped;
}

export function disposeAll(subscriptions: (() => void)[]): void {
  for (const off of subscriptions.splice(0)) {
    try {
      off();
    } catch {
      /* ignore teardown errors */
    }
  }
}

/** Plain text into escaped HTML, for the rare static-only markup path. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
