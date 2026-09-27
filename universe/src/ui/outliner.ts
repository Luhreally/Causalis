// The outliner (Phase 10 M96): what the viewer follows, listed as a grand strategy game lists
// it — under a 📌 with their number, each with its icon and name, opening its page at a tap,
// let go of at its ×. Following is observation: it changes nothing that happens.
import { el } from "./why.ts";

/** A thing's icon by its kind (the kind is its ref's first word). */
const ICONS: Readonly<Record<string, string>> = {
  cell: "🗺️",
  town: "🏘️",
  pol: "👑",
  prsn: "🧑",
  hhold: "🏠",
  war: "⚔️",
  faith: "✨",
  lang: "🗣️",
  spec: "🐾",
  star: "☀️",
  gstar: "⭐",
};

export class Outliner {
  readonly element = el("div", "outliner");
  private readonly button = el("button", "outliner-open");
  private readonly list = el("div", "outliner-list");
  /** Open a thing's page; let one go. */
  onOpen: (ref: string) => void = () => {};
  onLetGo: (ref: string) => void = () => {};

  constructor(parent: HTMLElement) {
    this.button.title = "What you follow";
    this.button.setAttribute("aria-label", "What you follow");
    this.list.hidden = true;
    this.button.onclick = () => {
      this.list.hidden = !this.list.hidden;
      this.button.classList.toggle("on", !this.list.hidden);
    };
    this.element.append(this.button, this.list);
    parent.append(this.element);
    this.set([]);
  }

  set(followed: readonly { ref: string; label: string }[]): void {
    this.button.replaceChildren(
      el("span", undefined, "📌"),
      ...(followed.length ? [el("span", "outliner-count", String(followed.length))] : []),
    );
    this.list.replaceChildren(
      ...(followed.length
        ? followed.map((f) => {
            const row = el("div", "outliner-row"),
              open = el("button", "outliner-name"),
              go = el("button", "outliner-go", "×");
            open.append(
              el("span", "outliner-icon", ICONS[f.ref.slice(0, f.ref.indexOf(":"))] ?? "•"),
              el("span", undefined, f.label),
            );
            open.onclick = () => this.onOpen(f.ref);
            go.title = "Stop following";
            go.setAttribute("aria-label", `Stop following ${f.label}`);
            go.onclick = () => this.onLetGo(f.ref);
            row.append(open, go);
            return row;
          })
        : [el("p", "muted", "Nothing followed yet: a page's “Follow” adds it here.")]),
    );
  }
}
