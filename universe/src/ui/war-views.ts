// The ways a battle is watched, a tap apart (Phase 55 M230): its war over the world, its hosts on the
// land, fought man by man before its town, its field close (view/warviews.ts) — a row of four under
// the bar wherever a battle is watched, the one watched lit, those it cannot be watched in now dimmed
// with why. Choosing one goes there as from nowhere.
import { WAR_VIEWS, WAR_VIEW_WORDS, type WarView } from "../view/index.ts";
import { el } from "./why.ts";

export class WarViews {
  readonly element = el("div", "war-views");
  private readonly buttons: Readonly<Record<WarView, HTMLButtonElement>>;
  private at: WarView | null = null;
  private closed: Partial<Record<WarView, string>> = {};
  private shown = "";
  /** A view chosen (never the one watched, nor one closed now). */
  onView: (v: WarView) => void = () => {};

  constructor(hud: HTMLElement) {
    this.element.setAttribute("role", "group");
    this.element.setAttribute("aria-label", "Ways to watch the battle");
    const buttons = {} as Record<WarView, HTMLButtonElement>;
    for (const v of WAR_VIEWS) {
      const w = WAR_VIEW_WORDS[v],
        b = el("button", `war-view war-view-${v}`);
      b.append(el("span", "war-view-icon", w.icon), el("span", "war-view-words", ` ${w.words}`));
      b.dataset.view = v;
      b.setAttribute("aria-label", w.words);
      b.onclick = () => {
        if (v !== this.at && this.closed[v] === undefined) this.onView(v);
      };
      buttons[v] = b;
      this.element.append(b);
    }
    this.buttons = buttons;
    hud.append(this.element);
    this.element.hidden = true;
  }

  /** The views as they stand now: the one watched (null: none, hidden), and why each closed one is. */
  show(at: WarView | null, closed: Partial<Record<WarView, string>> = {}): void {
    const key = at === null ? "" : `${at}|${WAR_VIEWS.map((v) => closed[v] ?? "").join("|")}`;
    if (key === this.shown) return;
    this.shown = key;
    this.at = at;
    this.closed = closed;
    this.element.hidden = at === null;
    for (const v of WAR_VIEWS) {
      const b = this.buttons[v],
        why = closed[v];
      b.classList.toggle("on", v === at);
      b.setAttribute("aria-pressed", String(v === at));
      b.disabled = why !== undefined && v !== at;
      b.title = why ?? WAR_VIEW_WORDS[v].title;
    }
  }

  /** Set below a point of the screen (px; null: under the scale's bar, as its style has it). */
  below(px: number | null): void {
    const top = px === null ? "" : `${Math.round(px + 8)}px`;
    if (this.element.style.top !== top) this.element.style.top = top;
  }

  /** The one watched and those open now (the look tools). */
  get state(): { at: WarView | null; open: WarView[] } {
    return {
      at: this.at,
      open: this.at === null ? [] : WAR_VIEWS.filter((v) => this.closed[v] === undefined),
    };
  }
}
