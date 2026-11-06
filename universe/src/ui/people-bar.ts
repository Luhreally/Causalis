// The people bar (B1, classic 49): a slim row of the lives that matter at the place the eye is on, each with why they're
// there and how they are, each a true reading (host/bar.ts). Asked of the worker at a low rate, and only when the place has
// settled on somewhere new or the year has moved: a row that shuffled as the eye passed over would be worse than none.
// The same reading is on their page, with the way on and off the bar. Pins are a viewer's, one list to a world.
import type {
  BarAsk,
  BarPerson,
  BarPin,
  BarRead,
  BarReading,
  BarReadings,
  HostClient,
} from "../bridge/index.ts";
import { YEAR } from "../kernel/index.ts";
import { drawPortrait } from "./portrait.ts";
import { el } from "./why.ts";

/** How often it looks at where the eye is; how long a place must hold to be read; how often the moving years are read. */
const LOOK_MS = 800,
  SETTLE_MS = 1400,
  YEARS_MS = 4000;
/** The most a viewer keeps on the bar. */
export const MOST_PINS = 8;
const FACE_W = 34,
  FACE_H = 54,
  FOLDED_KEY = "causalis.bar.folded";

/** Whom a viewer keeps on the bar, world by world: a viewer's preference, not the world's. */
export class BarPins {
  private key = "";
  private list: BarPin[] = [];
  private readonly heard = new Set<() => void>();

  /** The pins of this world. A pin means nothing on another. */
  open(world: string): void {
    this.key = `causalis.bar.pins:${world}`;
    this.list = [];
    try {
      const got: unknown = JSON.parse(localStorage.getItem(this.key) ?? "[]");
      if (Array.isArray(got))
        this.list = (got as BarPin[])
          .filter((p) => typeof p?.ref === "string" && typeof p?.name === "string")
          .slice(0, MOST_PINS);
    } catch {
      this.list = [];
    }
    this.told();
  }

  get all(): readonly BarPin[] {
    return this.list;
  }

  has(ref: string): boolean {
    return this.list.some((p) => p.ref === ref);
  }

  /** On, or off; false: the bar is full. */
  toggle(ref: string, name: string): boolean {
    if (this.has(ref)) {
      this.off(ref);
      return true;
    }
    if (this.list.length >= MOST_PINS) return false;
    this.list = [...this.list, { ref, name }];
    this.keep();
    return true;
  }

  off(ref: string): void {
    this.list = this.list.filter((p) => p.ref !== ref);
    this.keep();
  }

  onChange(f: () => void): void {
    this.heard.add(f);
  }

  private keep(): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.list));
    } catch {
      // (Kept for this sitting, then.)
    }
    this.told();
  }

  private told(): void {
    for (const f of this.heard) f();
  }
}
export const barPins = new BarPins();

type Chip = {
  readonly box: HTMLDivElement;
  readonly open: HTMLButtonElement;
  readonly face: HTMLElement;
  readonly name: HTMLElement;
  readonly why: HTMLElement;
  readonly now: HTMLElement;
  readonly off: HTMLButtonElement;
  drawn: string;
  said: string;
};

const put = (e: HTMLElement, words: string) => {
  if (e.textContent !== words) e.textContent = words;
};

/** A reading as the page tells it. */
const toldOf = (r: BarReading) => `${r.label}: ${r.words}`;

export class PeopleBar {
  readonly element = el("div", "people-bar");
  /** Open their page. */
  onOpen: (ref: string) => void = () => {};
  private readonly row = el("div", "people-row");
  private readonly fold = el("button", "people-fold", "👥");
  private readonly chips = new Map<string, Chip>();
  private readonly client: HostClient;
  private readonly where: () => { cell: number | null; town: string | null } | null;
  private readonly followed: () => readonly string[];
  private folded = false;
  /** The place seen, since when; the place and year last read, and when; whether something else asks a reading. */
  private saw = "";
  private sawAt = 0;
  private readPlace = "";
  private readYear = NaN;
  private readAt = -Infinity;
  private dirty = true;
  private busy = false;
  private year = NaN;
  /** Every reading taken, and every time the row changed (for a gate). */
  reads = 0;
  moved = 0;

  constructor(
    hud: HTMLElement,
    client: HostClient,
    where: () => { cell: number | null; town: string | null } | null,
    followed: () => readonly string[],
  ) {
    this.client = client;
    this.where = where;
    this.followed = followed;
    try {
      this.folded = localStorage.getItem(FOLDED_KEY) === "1";
    } catch {
      this.folded = false;
    }
    this.element.hidden = true;
    this.fold.onclick = () => {
      this.setFolded(!this.folded);
    };
    this.element.append(this.row, this.fold);
    hud.append(this.element);
    this.sayFold();
    client.onStatus((s) => {
      this.year = Math.floor(s.t / YEAR);
    });
    barPins.onChange(() => {
      this.dirty = true;
    });
    setInterval(() => void this.tick(), LOOK_MS);
  }

  get shown(): readonly string[] {
    return [...this.chips.keys()];
  }

  /** Forget what was read: a world taken up again. */
  fresh(): void {
    this.dirty = true;
  }

  private setFolded(on: boolean): void {
    this.folded = on;
    try {
      localStorage.setItem(FOLDED_KEY, on ? "1" : "0");
    } catch {
      // (For this sitting, then.)
    }
    this.sayFold();
    // (Nothing is read while it is folded: what it says is out of date when it opens.)
    if (!on) this.dirty = true;
  }

  private sayFold(): void {
    this.element.classList.toggle("folded", this.folded);
    const words = this.folded ? "Open the people bar" : "Fold the people bar";
    this.fold.title = words;
    this.fold.setAttribute("aria-label", words);
    this.fold.setAttribute("aria-expanded", String(!this.folded));
  }

  private async tick(): Promise<void> {
    if (this.busy || document.hidden) return;
    const at = this.where();
    if (at === null) return;
    const place = `${at.cell}|${at.town}`,
      now = performance.now();
    if (place !== this.saw) {
      this.saw = place;
      this.sawAt = now;
    }
    const settled = now - this.sawAt >= SETTLE_MS,
      movedOn = settled && place !== this.readPlace,
      aged = this.year !== this.readYear && now - this.readAt >= YEARS_MS;
    // (A world still to be read at all is read even folded: it says whether the button is wanted.)
    if (this.folded && this.chips.size) return;
    if (!movedOn && !aged && !this.dirty) return;
    this.busy = true;
    this.dirty = false;
    let read: BarRead | null = null;
    try {
      const ask: BarAsk = {
        cell: at.cell,
        town: at.town,
        pins: barPins.all,
        followed: this.followed(),
      };
      read = await this.client.query<BarRead>({ type: "people.bar", args: ask });
    } catch {
      // (A world between readings: the next look will read it.)
    } finally {
      this.busy = false;
    }
    if (!read) return;
    this.reads++;
    this.readPlace = place;
    this.readYear = this.year;
    this.readAt = performance.now();
    this.draw(read.people);
  }

  private draw(people: readonly BarPerson[]): void {
    const keys = new Set(people.map((p) => p.key));
    for (const [k, c] of this.chips)
      if (!keys.has(k)) {
        c.box.remove();
        this.chips.delete(k);
      }
    for (const p of people) this.fill(this.chips.get(p.key) ?? this.made(p), p);
    // (Set in their order only when it changes: a chip moved loses the finger on it.)
    const order = people.map((p) => this.chips.get(p.key)!.box);
    if (
      order.length !== this.row.children.length ||
      order.some((b, i) => this.row.children[i] !== b)
    ) {
      this.row.replaceChildren(...order);
      this.moved++;
    }
    // (No one on it, it stands aside: fold button and all.)
    this.element.hidden = !people.length;
  }

  private made(p: BarPerson): Chip {
    const box = el("div", "people-chip"),
      open = el("button", "people-open"),
      words = el("span", "people-words"),
      name = el("span", "people-name"),
      why = el("span", "people-why"),
      now = el("span", "people-now"),
      face = el(p.portrait ? "canvas" : "span", "people-face"),
      off = el("button", "people-off", "×");
    off.setAttribute("aria-label", "Take them off the bar");
    off.onclick = (e) => {
      e.stopPropagation();
      barPins.off(off.dataset.ref ?? "");
    };
    open.onclick = () => this.onOpen(open.dataset.ref ?? "");
    words.append(name, why, now);
    open.append(face, words);
    box.append(open, off);
    const chip: Chip = { box, open, face, name, why, now, off, drawn: "", said: "" };
    this.chips.set(p.key, chip);
    return chip;
  }

  private fill(c: Chip, p: BarPerson): void {
    c.box.dataset.key = p.key;
    c.box.dataset.kind = p.kind;
    c.box.classList.toggle("gone", p.gone);
    c.open.dataset.ref = p.ref;
    c.off.dataset.ref = p.key.slice(0, p.key.indexOf("|"));
    c.off.hidden = !p.pinned;
    put(c.name, `${p.pinned ? "📌 " : ""}${p.name}`);
    put(c.why, p.why);
    const said = JSON.stringify(p.readings);
    if (said !== c.said) {
      c.said = said;
      const rs: readonly BarReading[] = [p.readings.mood, p.readings.doing, p.readings.health];
      c.now.replaceChildren(
        ...rs.map((r) => {
          const s = el("span", `people-read tone-${r.tone}`, `${r.glyph}${r.short}`);
          s.title = toldOf(r);
          return s;
        }),
      );
      c.open.setAttribute(
        "aria-label",
        `${p.name}. ${p.why}. ${rs.map(toldOf).join(" ")} Their page.`,
      );
    }
    // The face their page shows, drawn once and kept.
    const face = JSON.stringify(p.portrait);
    if (face !== c.drawn) {
      c.drawn = face;
      if (p.portrait && c.face instanceof HTMLCanvasElement)
        drawPortrait(c.face, p.portrait, FACE_W, FACE_H, 0);
      else if (!p.portrait) c.face.textContent = "🕯️";
    }
  }
}

/** How they are now, on their page, with the way on and off the bar. */
export function drawBarReading(
  into: HTMLElement,
  args: {
    readonly ref: string;
    readonly name: string;
    readonly readings: BarReadings;
    readonly gone?: boolean;
  },
): void {
  const box = el("div", "bar-reading");
  box.append(
    el("div", "bar-reading-title", args.gone ? "As history last had them" : "How they are now"),
  );
  for (const r of [args.readings.mood, args.readings.doing, args.readings.health]) {
    const row = el("div", `bar-reading-row tone-${r.tone}`);
    row.append(el("span", "bar-reading-glyph", r.glyph), el("b", undefined, `${r.label}: `));
    row.append(r.words);
    box.append(row);
  }
  const pin = el("button", "act bar-pin"),
    say = (full = false) => {
      pin.textContent = barPins.has(args.ref)
        ? "📌 Take them off the people bar"
        : full
          ? `📌 The bar keeps ${MOST_PINS}: take someone off it first`
          : "📌 Keep them on the people bar";
    };
  pin.onclick = () => say(!barPins.toggle(args.ref, args.name));
  say();
  box.append(pin);
  into.append(box);
}
