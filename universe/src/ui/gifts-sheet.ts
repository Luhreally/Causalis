// The god's gifts to the body held (asked for 2026-11-21: "add a god mode tab that can give me special powers when i
// possess them"): a sheet opened from the possession's controls, one press to put each gift on or off — its state shown
// lit and said — and the god's hand at a place to be called down (a bolt, fire, the ground shaken, rain): chosen here,
// then a touch on the world where it is to fall. What each does is the sim's (rules/gifts.ts); the sheet only says which
// are on. Keys on a desk: G opens it, 1 … 9 put a gift on or off.
import { GIFTS, GIFT_BIT, SMITES, type Gift } from "../view/index.ts";
import { el } from "./why.ts";

/** Each gift in words: its icon, its name, what it does. */
export const GIFT_WORDS: Readonly<Record<Gift, readonly [string, string, string]>> = {
  swift: ["💨", "Swift", "Sprint past what the body can, and never tire"],
  wings: ["🕊️", "Wings", "Hold Rise (Q) to fly up; let go to glide down safe"],
  unbreakable: ["🛡️", "Unbreakable", "Blows land and are heard, and do no harm"],
  strength: ["💪", "Strength", "A blow that lands fells at once; no load weighs"],
  healing: ["✨", "Healing", "A touch (H) makes the struck down and the hurt whole"],
  smite: ["⚡", "Smite", "Call the god's hand down where you touch"],
  unseen: ["👁️", "Unseen", "None notice you, or go for you"],
  command: ["📣", "Command", "Those near follow and fight beside you"],
  slow: ["⏳", "Slow time", "The world about you at a quarter; you at your own pace"],
};
/** Each stroke that can be called down: icon, name, what it does where it falls. */
export const SMITE_WORDS: readonly (readonly [string, string, string])[] = [
  ["🌩️", "Lightning", "A bolt strikes down those it falls among"],
  ["🔥", "Fire", "Fire from the sky; in a town, its homes burn"],
  ["🌍", "Quake", "The ground shaken: all near thrown down"],
  ["🌧️", "Rain", "Rain on the land; fighting under it stops"],
];

export class GiftsSheet {
  readonly element = el("div", "gifts-sheet");
  private readonly toggles: HTMLButtonElement[] = [];
  private readonly strokes: HTMLButtonElement[] = [];
  private readonly strokeRow = el("div", "gifts-strokes");
  private gifts = 0;
  private offered: readonly Gift[] = GIFTS;
  /** A gift put on or off (the whole set now), a stroke chosen to be called down at the next touch, the sheet closed. */
  onChange: (gifts: number) => void = () => {};
  onStroke: (kind: number) => void = () => {};
  onClose: () => void = () => {};

  constructor(press: (b: HTMLButtonElement, act: () => void) => void) {
    this.element.hidden = true;
    this.element.setAttribute("role", "dialog");
    this.element.setAttribute("aria-label", "God's gifts");
    const head = el("div", "gifts-head"),
      close = el("button", "gifts-close", "✕");
    close.title = "Close the gifts (G)";
    close.setAttribute("aria-label", "Close the gifts");
    press(close, () => this.onClose());
    head.append(el("strong", "gifts-title", "✋ God's gifts"), close);
    const list = el("div", "gifts-list");
    GIFTS.forEach((g, i) => {
      const [icon, name, words] = GIFT_WORDS[g],
        b = el("button", "gifts-toggle");
      b.dataset.gift = g;
      b.append(
        el("span", "gifts-icon", icon),
        el("span", "gifts-name", name),
        el("span", "gifts-state", "off"),
        el("span", "gifts-words", words),
      );
      b.title = `${name}: ${words} (${i + 1})`;
      b.setAttribute("aria-pressed", "false");
      press(b, () => this.toggle(g));
      this.toggles.push(b);
      list.append(b);
    });
    this.strokeRow.append(el("span", "gifts-strokes-say", "Call down where you touch:"));
    SMITE_WORDS.forEach(([icon, name, words], kind) => {
      const b = el("button", "gifts-stroke");
      b.append(el("span", "gifts-icon", icon), el("span", "gifts-name", name));
      b.title = `${name}: ${words}`;
      b.setAttribute("aria-label", `${name}: ${words}`);
      b.dataset.stroke = SMITES[kind]!;
      press(b, () => this.onStroke(kind));
      this.strokes.push(b);
      this.strokeRow.append(b);
    });
    this.element.append(head, list, this.strokeRow);
  }

  get open(): boolean {
    return !this.element.hidden;
  }
  show(): void {
    this.element.hidden = false;
  }
  hide(): void {
    this.element.hidden = true;
  }

  /** The gifts this body may be given (a beast none; a soldier all): the rest not shown. */
  offer(gifts: readonly Gift[]): void {
    this.offered = gifts;
    for (const b of this.toggles) b.hidden = !gifts.includes(b.dataset.gift as Gift);
    this.strokeRow.hidden = !gifts.includes("smite") || !this.has("smite");
  }

  get on(): number {
    return this.gifts;
  }
  has(g: Gift): boolean {
    return (this.gifts & GIFT_BIT[g]) !== 0;
  }

  /** A gift put on or off, as by its press. */
  toggle(g: Gift): void {
    if (!this.offered.includes(g)) return;
    this.set(this.gifts ^ GIFT_BIT[g]);
    this.onChange(this.gifts);
  }

  /** The gifts on, shown (none: all off). */
  set(gifts: number): void {
    this.gifts = gifts;
    for (const b of this.toggles) {
      const on = this.has(b.dataset.gift as Gift);
      if (b.getAttribute("aria-pressed") !== String(on)) b.setAttribute("aria-pressed", String(on));
      b.classList.toggle("on", on);
      const state = b.querySelector(".gifts-state");
      if (state) state.textContent = on ? "on" : "off";
    }
    this.strokeRow.hidden = !this.offered.includes("smite") || !this.has("smite");
  }

  /** The stroke chosen and waiting for a touch (-1: none), lit. */
  armed(kind: number): void {
    this.strokes.forEach((b, k) => b.classList.toggle("on", k === kind));
  }
}
