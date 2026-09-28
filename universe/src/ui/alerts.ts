// Alerts and the message log (Phase 10 M96). The alerts are a grand strategy game's row of
// lit icons under the bar: what stands now and asks to be looked at — a realm followed at
// war, a land followed going hungry, a life followed ended, a realm followed fallen, a
// first in the world. Each is lit by its kind and counts its cases; resting on one tells
// them, a tap lists them, each opening its page and put by at its ×. One newly come glows a
// while. The message log keeps everything told of what is followed: its 📬 counts what has
// come since it was last read.
import type { Alert, HostClient } from "../bridge/index.ts";
import type { HoverTips } from "./hovertip.ts";
import { el } from "./why.ts";

/** How often the alerts are asked (ms), and how long a newly come one glows. */
const POLL_MS = 3000,
  GLOW_MS = 6000;

export class Alerts {
  readonly element = el("div", "alerts");
  private readonly row = el("div", "alerts-row");
  private readonly list = el("div", "alert-list");
  private readonly buttons = new Map<Alert["id"], HTMLButtonElement>();
  private alerts: Alert[] = [];
  private shown: Alert["id"] | null = null;
  /** The cases put by, for this sitting; and those seen before (a new one makes its alert glow). */
  private readonly putBy = new Set<string>();
  private readonly seen = new Set<string>();
  private told = false;
  /** Names in the alerts tell of their things on a desk (M97). */
  private readonly hoverTips: HoverTips | null;
  /** Open a thing's page. */
  onOpen: (ref: string) => void = () => {};

  constructor(parent: HTMLElement, client: HostClient, hoverTips: HoverTips | null = null) {
    this.hoverTips = hoverTips;
    this.list.hidden = true;
    this.element.append(this.row, this.list);
    parent.append(this.element);
    client.subscribe<Alert[]>({ type: "alerts" }, POLL_MS, (alerts) => {
      if (Array.isArray(alerts)) this.set(alerts);
    });
  }

  /** The alerts as they stand, less the cases put by. */
  set(alerts: readonly Alert[]): void {
    this.alerts = alerts
      .map((a) => ({ ...a, items: a.items.filter((i) => !this.putBy.has(i.key)) }))
      .filter((a) => a.items.length);
    const ids = new Set(this.alerts.map((a) => a.id));
    for (const [id, b] of this.buttons)
      if (!ids.has(id)) {
        b.remove();
        this.buttons.delete(id);
      }
    for (const a of this.alerts) {
      const b = this.buttons.get(a.id) ?? this.button(a.id);
      b.className = `alert tone-${a.tone}${b.classList.contains("new") ? " new" : ""}${this.shown === a.id ? " on" : ""}`;
      b.replaceChildren(
        el("span", "alert-icon", a.icon),
        el("span", "alert-count", String(a.items.length)),
      );
      const words = `${a.title}: ${a.items.length}`;
      b.setAttribute("aria-label", words);
      if (!this.hoverTips) b.title = words;
      // (What was not here before glows a while — not all that stands when the world opens.)
      const fresh = a.items.some((i) => !this.seen.has(i.key));
      for (const i of a.items) this.seen.add(i.key);
      if (fresh && this.told) {
        b.classList.add("new");
        setTimeout(() => b.classList.remove("new"), GLOW_MS);
      }
    }
    // (Set in their order only when it changes: a button moved loses the pointer resting on it.)
    const order = this.alerts.map((a) => this.buttons.get(a.id)!);
    if (
      order.length !== this.row.children.length ||
      order.some((b, i) => this.row.children[i] !== b)
    )
      this.row.replaceChildren(...order);
    this.told = true;
    if (this.shown && !ids.has(this.shown)) this.shown = null;
    this.drawList();
  }

  private button(id: Alert["id"]): HTMLButtonElement {
    const b = el("button", "alert");
    b.onclick = () => {
      this.shown = this.shown === id ? null : id;
      this.hoverTips?.close();
      for (const [other, x] of this.buttons) x.classList.toggle("on", other === this.shown);
      this.drawList();
    };
    this.hoverTips?.attach(b, () => (this.shown === id ? null : this.card(id)));
    this.buttons.set(id, b);
    return b;
  }

  /** An alert told on a desk: its cases, each name a link. */
  private card(id: Alert["id"]): Node[] | null {
    const a = this.alerts.find((x) => x.id === id);
    if (!a || !this.hoverTips) return null;
    const head = el("div", "tip-head"),
      rows = el("div", "tip-rows");
    head.append(el("span", "tip-icon", a.icon), el("span", "tip-title", a.title));
    for (const i of a.items.slice(0, 8)) rows.append(this.hoverTips.line(i.line, "tip-row"));
    const more =
      a.items.length > 8 ? [el("div", "tip-line", `and ${a.items.length - 8} more`)] : [];
    return [head, rows, ...more, el("div", "tip-more", "Click to list them")];
  }

  /** The cases of the alert tapped, each opening its page, each put by at its ×. */
  private drawList(): void {
    const a = this.alerts.find((x) => x.id === this.shown);
    this.list.hidden = !a;
    if (!a) {
      this.list.replaceChildren();
      return;
    }
    const title = el("div", "alert-list-title");
    title.append(el("span", undefined, `${a.icon} ${a.title}`));
    this.list.replaceChildren(
      title,
      ...a.items.map((i) => {
        const row = el("div", "alert-row"),
          open = el("button", "alert-open"),
          by = el("button", "alert-by", "×");
        for (const s of i.line) open.append(typeof s === "string" ? s : s.text);
        open.onclick = () => {
          this.shown = null;
          this.buttons.forEach((x) => x.classList.remove("on"));
          this.drawList();
          this.onOpen(i.ref);
        };
        by.title = "Put it by";
        by.setAttribute("aria-label", "Put it by");
        by.onclick = () => {
          this.putBy.add(i.key);
          this.set(this.alerts);
        };
        row.append(open, by);
        return row;
      }),
    );
  }
}

/** The message log's button: a 📬 that counts what has been told since the log was last read. */
export class LogButton {
  readonly element = el("button", "log-open");
  private unread = 0;
  onOpen: () => void = () => {};

  constructor(parent: HTMLElement) {
    this.element.title = "The message log: everything told of what you follow";
    this.element.setAttribute("aria-label", "The message log");
    this.element.onclick = () => this.onOpen();
    parent.append(this.element);
    this.draw();
  }

  /** News has come of what is followed. */
  told(n = 1): void {
    this.unread += n;
    this.draw();
  }

  /** The log was read. */
  read(): void {
    this.unread = 0;
    this.draw();
  }

  private draw(): void {
    this.element.replaceChildren(
      el("span", undefined, "📬"),
      ...(this.unread ? [el("span", "outliner-count", String(Math.min(this.unread, 99)))] : []),
    );
  }
}
