// The map modes (Phase 10 M96): a grand strategy game's bar of them, in the era's glossy
// buttons — one icon each, its name on hover — and under them the mode's legend: its ramp
// from low to high, or its colours and what each means, with a line of its own when the
// mode is of something (the diplomacy of a realm).
import { LENSES, LENS_ICONS, LENS_NAMES, lensLegend, type Lens } from "../view/index.ts";
import { el } from "./why.ts";

type Rgb = readonly [number, number, number];

/** An alliance as the alliances lens keys it: its colour, its head's seat, how many realms. */
export type AllianceKey = {
  readonly ref: string;
  readonly name: string;
  readonly town: string;
  readonly color: Rgb;
  readonly realms: number;
};

/** The most alliances the key names (the rest are on their list, a press away). */
const KEYED = 4;

const css = (c: Rgb) =>
  `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;

export class MapModes {
  readonly element = el("div", "mapmodes");
  private readonly buttons = new Map<Lens, HTMLButtonElement>();
  private readonly legend = el("div", "legend");
  private readonly note = el("div", "legend-note");
  private readonly act = el("button", "legend-action");
  private readonly picks = el("div", "legend-picks");
  private current: Lens;
  /** Its world's kind (Phase 56): the warmth legend's degrees its liquid's, told in true ones. */
  private world = "rocky";
  private built = false;
  /** Its world's life's colours (Phase 57): the land legend's woods in its own words. */
  private look: string | undefined = undefined;
  /** The alliances the alliances lens keys, and what a press on one does (D1). */
  private allied: readonly AllianceKey[] | null = null;
  private alliedKey = "";
  private openAlliance: (key: AllianceKey) => void = () => {};
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
    this.act.hidden = true;
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

  /** Its world's kind (Phase 56), for its legends. */
  set kind(kind: string) {
    if (kind === this.world) return;
    this.world = kind;
    this.drawLegend();
  }

  /** Its world's life's colours (Phase 57), for its land legend. */
  set lifeLook(look: string | undefined) {
    if (look === this.look) return;
    this.look = look;
    this.drawLegend();
  }

  /** Whether any land is built over (Phase 66), for its land legend. */
  set builtOver(on: boolean) {
    if (on === this.built) return;
    this.built = on;
    this.drawLegend();
  }

  /** The choices a mode offers (the ways lens: which way), each an icon; picking one tells `pick`. */
  choose(
    options: readonly (readonly [string, string, string])[] | null,
    chosen: string,
    pick: (id: string) => void,
  ): void {
    this.picks.replaceChildren(
      ...(options ?? []).map(([id, icon, words]) => {
        const b = el("button", `speed${id === chosen ? " on" : ""}`, icon);
        b.title = words;
        b.setAttribute("aria-label", words);
        b.dataset.choice = id;
        b.onclick = () => {
          for (const x of this.picks.children) x.classList.toggle("on", x === b);
          pick(id);
        };
        return b;
      }),
    );
    this.picks.hidden = !options?.length;
    this.drawLegend();
  }

  /** A button of the mode's own under its legend (null: none). */
  action(label: string | null, run: () => void = () => {}): void {
    this.act.hidden = label === null;
    this.act.textContent = label ?? "";
    this.act.onclick = run;
  }

  /**
   * The alliances lens's own key: the greatest alliances, each its colour, its head's seat and how
   * many realms stand in it, a press opening it (null: its plain key). Drawn again only when they change,
   * so a finger on one is never lost to a redraw.
   */
  alliances(list: readonly AllianceKey[] | null, open: (key: AllianceKey) => void): void {
    this.openAlliance = open;
    const key = list
      ? list
          .slice(0, KEYED)
          .map((a) => `${a.ref}:${a.realms}:${a.color.join(",")}`)
          .join("|")
      : "";
    if (key === this.alliedKey && !!list === !!this.allied) return;
    this.alliedKey = key;
    this.allied = list;
    if (this.current === "blocs") this.drawLegend();
  }

  /** A line of the mode's own: what it is of ("the league of Geaka"). */
  say(text: string | null): void {
    this.note.textContent = text ?? "";
    this.note.hidden = !text;
  }

  private drawLegend(): void {
    const l = lensLegend(this.current, this.world, this.look),
      title = el("div", "legend-title", LENS_NAMES[this.current]);
    const parts: HTMLElement[] = [title];
    if (l.kind === "ramp") {
      const bar = el("div", "legend-ramp");
      bar.style.background = `linear-gradient(90deg, ${l.stops.map(css).join(", ")})`;
      const ends = el("div", "legend-ends");
      ends.append(el("span", undefined, l.low), el("span", undefined, l.high));
      parts.push(bar, ends);
    } else if (this.current === "blocs" && this.allied?.length) {
      const keys = el("div", "legend-keys alliance-keys");
      for (const a of this.allied.slice(0, KEYED)) {
        const b = el("button", "legend-key alliance-key"),
          dot = el("span", "swatch");
        dot.style.background = css(a.color);
        b.append(
          dot,
          el("span", "alliance-town", a.town),
          el("span", "alliance-count", String(a.realms)),
        );
        b.title = `${a.name}: ${a.realms} realms`;
        b.setAttribute("aria-label", b.title);
        b.dataset.ref = a.ref;
        b.onclick = () => this.openAlliance(a);
        keys.append(b);
      }
      const alone = el("span", "legend-key"),
        dot = el("span", "swatch");
      dot.style.background = css(
        l.kind === "keys" ? (l.keys.at(-1)?.[0] ?? [0.34, 0.34, 0.32]) : [0.34, 0.34, 0.32],
      );
      alone.append(dot, "alone");
      keys.append(alone);
      parts.push(keys);
    } else {
      const keys = el("div", "legend-keys");
      for (const [color, words] of this.built && this.current === "terrain"
        ? [...l.keys, [[0.55, 0.55, 0.58], "built over"] as const]
        : l.keys) {
        const k = el("span", "legend-key"),
          dot = el("span", "swatch");
        dot.style.background = css(color);
        k.append(dot, words);
        keys.append(k);
      }
      parts.push(keys);
    }
    parts.push(this.picks, this.note, this.act);
    this.legend.replaceChildren(...parts);
  }
}
