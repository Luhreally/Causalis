// The lenses of the stars around (Phase 73), a small bar as the land has: one on at a time, tapped again to put away, and under it what the
// colours are. It only says; the page reads what each lens shows.
import type { StarLens, StarLensKey, StarLensRgb } from "../bridge/index.ts";
import { el } from "./why.ts";

/** The lenses, in the bar's order: the sign on the button, and what it is called. */
export const STAR_LENSES: readonly (readonly [StarLens, string, string])[] = [
  ["holds", "👑", "Who holds the stars"],
  ["peoples", "👥", "The peoples among them"],
  ["lanes", "🌀", "Lanes and ships"],
  ["trade", "📦", "Trade between them"],
  ["war", "🔥", "War and fire"],
];

const css = (c: StarLensRgb) =>
  `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;

export class StarLenses {
  readonly element = el("div", "star-lenses");
  private readonly buttons = new Map<StarLens, HTMLButtonElement>();
  private readonly legend = el("div", "star-lens-legend");
  private readonly title = el("div", "star-lens-title");
  private readonly keys = el("div", "star-lens-keys");
  private readonly note = el("div", "star-lens-note");
  private current: StarLens | null = "holds";
  /** The viewer chose: `lens` on, or none. */
  onLens: (lens: StarLens | null) => void = () => {};

  constructor() {
    const bar = el("div", "star-lens-bar");
    for (const [lens, sign, name] of STAR_LENSES) {
      const b = el("button", "star-lens", sign);
      b.title = name;
      b.setAttribute("aria-label", name);
      b.dataset.lens = lens;
      b.onclick = () => {
        this.lens = this.current === lens ? null : lens;
        this.onLens(this.current);
      };
      bar.append(b);
      this.buttons.set(lens, b);
    }
    this.legend.append(this.title, this.keys, this.note);
    this.element.append(bar, this.legend);
    this.lens = this.current;
  }

  get lens(): StarLens | null {
    return this.current;
  }

  set lens(l: StarLens | null) {
    this.current = l;
    for (const [k, b] of this.buttons) {
      b.classList.toggle("on", k === l);
      b.setAttribute("aria-pressed", String(k === l));
    }
    this.legend.hidden = !l;
    this.title.textContent = STAR_LENSES.find((x) => x[0] === l)?.[2] ?? "";
    if (!l) this.say([], null);
  }

  /** What the colours are, and how it stands. */
  say(keys: readonly StarLensKey[], note: string | null): void {
    const digest = JSON.stringify([keys, note]);
    if (this.keys.dataset.said === digest) return;
    this.keys.dataset.said = digest;
    this.keys.replaceChildren(
      ...keys.map((k) => {
        const row = el("div", "star-lens-key"),
          dot = el("span", "star-lens-dot");
        dot.style.background = css(k.color);
        row.append(dot, el("span", undefined, k.words));
        return row;
      }),
    );
    this.note.textContent = note ?? "";
    this.note.hidden = !note;
  }
}
