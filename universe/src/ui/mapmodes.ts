// The map modes (Phase 10 M96): a grand strategy game's bar of them, in the era's glossy
// buttons — one icon each, its name on hover — and under them the mode's legend: its ramp
// from low to high, or its colours and what each means, with a line of its own when the
// mode is of something (the diplomacy of a realm).
import { LENSES, LENS_ICONS, LENS_NAMES, lensLegend, type Lens } from "../view/index.ts";
import { el } from "./why.ts";

type Rgb = readonly [number, number, number];

const css = (c: Rgb) =>
  `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;

export class MapModes {
  readonly element = el("div", "mapmodes");
  private readonly buttons = new Map<Lens, HTMLButtonElement>();
  private readonly legend = el("div", "legend");
  private readonly note = el("div", "legend-note");
  private current: Lens;
  onLens: (lens: Lens) => void = () => {};

  constructor(lens: Lens) {
    this.current = lens;
    const grid = el("div", "modes");
    for (const l of LENSES) {
      const b = el("button", "mode", LENS_ICONS[l]);
      b.title = LENS_NAMES[l];
      b.setAttribute("aria-label", LENS_NAMES[l]);
      b.onclick = () => {
        if (l === this.current) return;
        this.lens = l;
        this.onLens(l);
      };
      grid.append(b);
      this.buttons.set(l, b);
    }
    this.element.append(grid, this.legend);
    this.lens = lens;
  }

  get lens(): Lens {
    return this.current;
  }

  set lens(l: Lens) {
    this.current = l;
    for (const [k, b] of this.buttons) b.classList.toggle("on", k === l);
    this.drawLegend();
  }

  /** A line of the mode's own: what it is of ("the league of Geaka"). */
  say(text: string | null): void {
    this.note.textContent = text ?? "";
    this.note.hidden = !text;
  }

  private drawLegend(): void {
    const l = lensLegend(this.current),
      title = el("div", "legend-title", LENS_NAMES[this.current]);
    const parts: HTMLElement[] = [title];
    if (l.kind === "ramp") {
      const bar = el("div", "legend-ramp");
      bar.style.background = `linear-gradient(90deg, ${l.stops.map(css).join(", ")})`;
      const ends = el("div", "legend-ends");
      ends.append(el("span", undefined, l.low), el("span", undefined, l.high));
      parts.push(bar, ends);
    } else {
      const keys = el("div", "legend-keys");
      for (const [color, words] of l.keys) {
        const k = el("span", "legend-key"),
          dot = el("span", "swatch");
        dot.style.background = css(color);
        k.append(dot, words);
        keys.append(k);
      }
      parts.push(keys);
    }
    parts.push(this.note);
    this.legend.replaceChildren(...parts);
  }
}
