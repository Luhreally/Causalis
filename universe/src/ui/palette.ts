// The god's palette (Phase 12 M106): WorldBox's bar of powers in the era's glossy tiles — the
// god's acts by kind: the weather, the land's yield, sickness and health, wonders, the peoples,
// the world and its sun. An act is taken in hand, then what it falls on is touched on the map:
// a land, a town, or two realms one after the other (for a faith, a land that holds it, then
// the land to turn). Before it is cast its reach is lit under the pointer and said in words;
// cast, it is told with a link to what it led to. It stays in hand until put down (Esc, a right
// click, or its tile again), so a drought may be laid on land after land.
import type { CommandReceipt, HostClient, PaletteLand } from "../bridge/index.ts";
import type { Lit } from "../view/index.ts";
import { el } from "./why.ts";

type Target = "land" | "town" | "city" | "pair" | "faith" | "world" | "star";

type PaletteAct = {
  readonly id: string;
  readonly icon: string;
  readonly name: string;
  readonly target: Target;
  readonly command: string;
  /** Which way it goes (a gift or a taking). */
  readonly sign?: 1 | -1;
  /** Whether it lasts years (chosen in the palette). */
  readonly lasting?: boolean;
  /** Between two realms: how the second is lit. */
  readonly second?: "foe" | "friend";
};

const ACTS: Readonly<Record<string, PaletteAct>> = {
  rain: {
    id: "rain",
    icon: "🌧️",
    name: "Send rain",
    target: "land",
    command: "act.rain",
    sign: 1,
    lasting: true,
  },
  drought: {
    id: "drought",
    icon: "☀️",
    name: "Withhold the rain",
    target: "land",
    command: "act.rain",
    sign: -1,
    lasting: true,
  },
  bounty: {
    id: "bounty",
    icon: "🌽",
    name: "Bless the harvest",
    target: "land",
    command: "act.harvest",
    sign: 1,
    lasting: true,
  },
  blight: {
    id: "blight",
    icon: "🥀",
    name: "Blight the harvest",
    target: "land",
    command: "act.harvest",
    sign: -1,
    lasting: true,
  },
  plague: {
    id: "plague",
    icon: "☠️",
    name: "Send a plague",
    target: "land",
    command: "act.plague",
    sign: -1,
    lasting: true,
  },
  healing: {
    id: "healing",
    icon: "💊",
    name: "Heal the sick",
    target: "land",
    command: "act.plague",
    sign: 1,
    lasting: true,
  },
  inspire: {
    id: "inspire",
    icon: "💡",
    name: "Inspire",
    target: "land",
    command: "act.inspire",
    sign: 1,
  },
  shrine: {
    id: "shrine",
    icon: "⛩️",
    name: "Raise a shrine",
    target: "town",
    command: "act.shrine",
  },
  spring: {
    id: "spring",
    icon: "⛲",
    name: "Open a spring",
    target: "town",
    command: "act.spring",
  },
  fire: { id: "fire", icon: "🔥", name: "Send fire", target: "city", command: "act.fire" },
  war: {
    id: "war",
    icon: "⚔️",
    name: "Set at war",
    target: "pair",
    command: "act.war",
    second: "foe",
  },
  peace: {
    id: "peace",
    icon: "🕊️",
    name: "Make peace",
    target: "pair",
    command: "act.peace",
    second: "friend",
  },
  friendship: {
    id: "friendship",
    icon: "🤝",
    name: "Make friends",
    target: "pair",
    command: "act.friendship",
    second: "friend",
  },
  discord: {
    id: "discord",
    icon: "😠",
    name: "Sow discord",
    target: "pair",
    command: "act.discord",
    second: "foe",
  },
  rise: { id: "rise", icon: "✊", name: "Stir to rise", target: "land", command: "act.rise" },
  convert: {
    id: "convert",
    icon: "🙏",
    name: "Turn to a faith",
    target: "faith",
    command: "act.convert",
  },
  warm: {
    id: "warm",
    icon: "🌡️",
    name: "Warm the world",
    target: "world",
    command: "act.warm",
    sign: 1,
  },
  cool: {
    id: "cool",
    icon: "❄️",
    name: "Cool the world",
    target: "world",
    command: "act.warm",
    sign: -1,
  },
  flare: {
    id: "flare",
    icon: "🌞",
    name: "Make the sun flare",
    target: "star",
    command: "act.flare",
    sign: -1,
  },
  calm: {
    id: "calm",
    icon: "🌤️",
    name: "Calm the sun",
    target: "star",
    command: "act.flare",
    sign: 1,
  },
};

/** The acts by kind, as the palette's tabs hold them. */
export const PALETTE_KINDS: readonly {
  id: string;
  icon: string;
  name: string;
  acts: readonly string[];
}[] = [
  { id: "weather", icon: "🌦️", name: "The weather", acts: ["rain", "drought"] },
  { id: "yield", icon: "🌾", name: "The land's yield", acts: ["bounty", "blight"] },
  { id: "health", icon: "⚕️", name: "Sickness and health", acts: ["plague", "healing"] },
  { id: "wonders", icon: "✨", name: "Wonders", acts: ["inspire", "shrine", "spring", "fire"] },
  {
    id: "peoples",
    icon: "👑",
    name: "The peoples",
    acts: ["war", "peace", "friendship", "discord", "rise", "convert"],
  },
  { id: "sky", icon: "🌍", name: "The world and its sun", acts: ["warm", "cool", "flare", "calm"] },
];

/** Years a world is warmed or cooled for, and a sun made to flare or calm. */
const WORLD_YEARS = 50,
  STAR_YEARS = 3;

/** What an act will do to what it falls on, in words (null: it cannot fall there, and why). */
type Aim = { readonly words: string; readonly args: Readonly<Record<string, unknown>> | null };

export class GodPalette {
  readonly element = el("div", "palette");
  private readonly client: HostClient;
  private readonly tabs = el("div", "palette-tabs");
  private readonly tiles = el("div", "palette-acts");
  private readonly line = el("div", "palette-line");
  private readonly words = el("span", "palette-words");
  private readonly spans = el("span", "palette-years");
  private readonly toggle = el("button", "palette-toggle", "✋");
  private kind = PALETTE_KINDS[0]!.id;
  private act: PaletteAct | null = null;
  private years = 3;
  /** For an act between two realms, the first; for a faith, the land that holds it. */
  private first: PaletteLand | null = null;
  /** The land under the pointer, and the town there if one is. */
  private over: { land: PaletteLand | null; cell: number; town: string | null } | null = null;
  private readonly lands = new Map<number, { land: PaletteLand | null; at: number }>();
  private asking = 0;
  private star: string | null = null;
  /** The last act cast, told until the next is aimed. */
  private told: { text: string; ref: string } | null = null;
  /** Light lands on the map (the palette's reach, its first choice, its second). */
  onLight: (lit: ReadonlyMap<number, Lit>) => void = () => {};
  /** An act was cast (the map may play it at once). */
  onCast: (receipt: CommandReceipt) => void = () => {};
  /** Open a thing's page. */
  onOpen: (ref: string) => void = () => {};
  /** The palette took an act in hand, or put it down. */
  onArmed: (armed: boolean) => void = () => {};

  constructor(parent: HTMLElement, client: HostClient) {
    this.client = client;
    this.toggle.title = "The god's hand: acts on the lands, the towns, the peoples, the world";
    this.toggle.setAttribute("aria-label", "The god's hand");
    this.toggle.onclick = () => {
      const open = !this.element.classList.contains("open");
      this.element.classList.toggle("open", open);
      if (!open) this.putDown();
    };
    for (const k of PALETTE_KINDS) {
      const b = el("button", "palette-tab", k.icon);
      b.title = k.name;
      b.setAttribute("aria-label", k.name);
      b.dataset.kind = k.id;
      b.onclick = () => {
        this.kind = k.id;
        this.drawTiles();
      };
      this.tabs.append(b);
    }
    for (const n of [1, 3, 5]) {
      const b = el("button", "speed", `${n}y`);
      b.title = `For ${n} year${n === 1 ? "" : "s"}`;
      b.onclick = () => {
        this.years = n;
        this.drawYears();
        this.say();
      };
      this.spans.append(b);
    }
    this.line.append(this.words, this.spans);
    const bar = el("div", "palette-bar");
    bar.append(this.tabs, this.tiles);
    this.element.append(this.line, bar);
    parent.append(this.toggle, this.element);
    this.drawTiles();
    this.drawYears();
    this.say();
    addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.act) this.putDown();
    });
  }

  /** Whether an act is in hand, to fall where the map is touched. */
  get armed(): boolean {
    return this.act !== null;
  }

  /** The act in hand (for the look tools). */
  get holding(): string | null {
    return this.act?.id ?? null;
  }

  /** Take an act in hand (for the look tools and the gates, as a tap on its tile). */
  take(id: string): void {
    const a = ACTS[id];
    if (!a) return;
    this.kind = PALETTE_KINDS.find((k) => k.acts.includes(id))?.id ?? this.kind;
    this.element.classList.add("open");
    this.drawTiles();
    if (this.act?.id !== id) this.pick(a);
  }

  /** Put the act in hand down. */
  putDown(): void {
    if (!this.act) return;
    this.act = null;
    this.first = null;
    this.over = null;
    this.drawTiles();
    this.say();
    this.light();
    this.onArmed(false);
  }

  /** The pointer over the map: the land (province) under it and a town there, if any (null: off the world). */
  hover(cell: number | null, town: string | null): void {
    if (!this.act) return;
    if (cell === null) {
      this.over = null;
      this.say();
      this.light();
      return;
    }
    if (this.over && this.over.cell === cell && this.over.town === town) return;
    const seq = ++this.asking;
    void this.landAt(cell).then((land) => {
      if (seq !== this.asking || !this.act) return;
      this.over = { land, cell, town };
      this.told = null;
      this.say();
      this.light();
    });
  }

  /** The map touched with an act in hand: choose, or cast. */
  async tap(cell: number | null, town: string | null): Promise<void> {
    const a = this.act,
      whole = a?.target === "world" || a?.target === "star";
    // (The world's and the sun's acts fall on the whole world, touched anywhere, sea or land.)
    if (!a || (cell === null && !whole)) return;
    const land = cell === null ? null : await this.landAt(cell);
    if (cell !== null) this.over = { land, cell, town };
    if ((a.target === "pair" || a.target === "faith") && !this.first) {
      const why = this.firstWhy(a, land);
      if (why) {
        this.say(why, "bad");
        return;
      }
      this.first = land;
      this.say();
      this.light();
      return;
    }
    const aim = this.aim(a, land, town);
    if (!aim.args) {
      this.say(aim.words, "bad");
      return;
    }
    try {
      const receipt = await this.client.command(a.command, aim.args);
      this.told = { text: `${a.icon} Done: ${aim.words}`, ref: receipt.id };
      // (Its lands' numbers have moved: asked again.) Two realms are chosen afresh each time; a
      // faith stays in hand, to turn land after land to it.
      this.lands.clear();
      if (a.target === "pair") this.first = null;
      this.onCast(receipt);
      this.say();
      this.light();
    } catch (error) {
      this.say((error as Error).message, "bad");
    }
  }

  private pick(a: PaletteAct): void {
    this.act = a;
    this.first = null;
    this.told = null;
    this.drawTiles();
    this.say();
    this.light();
    this.onArmed(true);
    // (The sun's acts need the sun: asked once.)
    if (a.target === "star" && !this.star)
      void this.client
        .query<{ star: { ref: string } }>({ type: "planet.system" })
        .then((s) => {
          this.star = s.star.ref;
          this.say();
        })
        .catch(() => {});
  }

  private async landAt(cell: number): Promise<PaletteLand | null> {
    const kept = this.lands.get(cell);
    if (kept && performance.now() - kept.at < 1500) return kept.land;
    const land = await this.client
      .query<PaletteLand | null>({ type: "palette.land", args: { cell } })
      .catch(() => null);
    this.lands.set(cell, { land, at: performance.now() });
    if (this.lands.size > 64) this.lands.delete(this.lands.keys().next().value!);
    return land;
  }

  /** Why a land cannot be an act's first choice (null: it can). */
  private firstWhy(a: PaletteAct, land: PaletteLand | null): string | null {
    if (!land) return "no one lives there";
    if (a.target === "faith") return land.faith ? null : "they hold only the old beliefs there";
    return land.realm ? null : `${land.name} is no realm's`;
  }

  /** What the act in hand would do to a land (and a town there), or why it cannot. */
  private aim(a: PaletteAct, land: PaletteLand | null, town: string | null): Aim {
    const years = this.years,
      span = a.lasting ? ` for ${years} year${years === 1 ? "" : "s"}` : "";
    switch (a.target) {
      case "world":
        return {
          words: `the world ${a.sign! > 0 ? "warmed" : "cooled"} by a degree and a half for ${WORLD_YEARS} years`,
          args: { sign: a.sign, years: WORLD_YEARS },
        };
      case "star":
        return this.star
          ? {
              words: `the sun ${a.sign! < 0 ? "flaring: death likelier under its light" : "calmed: death rarer under its light"} for ${STAR_YEARS} years`,
              args: { star: this.star, sign: a.sign, years: STAR_YEARS },
            }
          : { words: "the sun is being found", args: null };
      case "land": {
        if (!land) return { words: "no one lives there", args: null };
        if (a.id === "rise") {
          if (!land.realm) return { words: `${land.name} is no realm's`, args: null };
          if (land.realm.seat)
            return {
              words: `${land.name} is the seat of ${land.realm.name}: it cannot rise against itself`,
              args: null,
            };
          return {
            words: `${land.name} rising against ${land.realm.name}`,
            args: { cell: land.cell },
          };
        }
        const doing: Readonly<Record<string, string>> = {
          rain: `rain over ${land.name}`,
          drought: `the rain failing over ${land.name}`,
          bounty: `a fat harvest in ${land.name}`,
          blight: `blight on ${land.name}'s harvest`,
          plague: `a plague upon ${land.name}`,
          healing: `the sick of ${land.name} healed`,
          inspire: `the people of ${land.name} inspired`,
        };
        return {
          words: `${doing[a.id] ?? land.name}${span}`,
          args: { cell: land.cell, sign: a.sign ?? 1, years: a.lasting ? years : 1 },
        };
      }
      case "town":
      case "city": {
        if (!land) return { words: "no one lives there", args: null };
        const towns = a.target === "city" ? land.towns.filter((t) => t.city) : land.towns,
          t = towns.find((x) => x.ref === town) ?? towns[0];
        if (!t)
          return {
            words:
              a.target === "city" ? `no city in ${land.name} to burn` : `no town in ${land.name}`,
            args: null,
          };
        if (a.id === "shrine" && t.shrine)
          return { words: `a shrine already stands in ${t.name}`, args: null };
        if (a.id === "spring" && t.spring)
          return { words: `a spring already rises at ${t.name}`, args: null };
        const doing =
          a.id === "shrine"
            ? `a shrine rising in ${t.name}`
            : a.id === "spring"
              ? `a spring welling up at ${t.name}`
              : `fire sweeping ${t.name}`;
        return { words: doing, args: { village: t.ref } };
      }
      case "faith": {
        const faith = this.first?.faith;
        if (!faith) return { words: "touch a land that holds the faith first", args: null };
        if (!land) return { words: "no one lives there", args: null };
        if (land.faith?.ref === faith.ref)
          return { words: `${land.name} holds ${faith.name} already`, args: null };
        return {
          words: `${land.name} turned to ${faith.name}`,
          args: { cell: land.cell, faith: faith.ref },
        };
      }
      case "pair": {
        const one = this.first?.realm;
        if (!one) return { words: "touch a land of the first realm first", args: null };
        const two = land?.realm;
        if (!two)
          return { words: land ? `${land.name} is no realm's` : "no one lives there", args: null };
        if (two.ref === one.ref)
          return { words: "a realm cannot be set against itself", args: null };
        const atWar = one.foes.includes(two.ref);
        if (a.id === "war" && atWar)
          return { words: `${one.name} and ${two.name} are at war already`, args: null };
        if (a.id === "peace" && !atWar)
          return { words: `${one.name} and ${two.name} are not at war`, args: null };
        const doing: Readonly<Record<string, string>> = {
          war: `${one.name} falling upon ${two.name}`,
          peace: `the war between ${one.name} and ${two.name} ended`,
          friendship: `${one.name} and ${two.name} made friends`,
          discord: `discord sown between ${one.name} and ${two.name}`,
        };
        return { words: doing[a.id] ?? two.name, args: { a: one.ref, b: two.ref } };
      }
    }
  }

  /** The line above the palette: what the act in hand will do, or asks for. */
  private say(problem?: string, tone?: "bad"): void {
    const a = this.act;
    this.spans.hidden = !a?.lasting;
    this.line.classList.toggle("bad", tone === "bad");
    if (problem) {
      this.words.replaceChildren(`${a?.icon ?? "✋"} ${problem}`);
      return;
    }
    if (this.told) {
      const see = el("button", "palette-see", "see what follows");
      const ref = this.told.ref;
      see.onclick = () => this.onOpen(ref);
      this.words.replaceChildren(`${this.told.text} — `, see);
      return;
    }
    if (!a) {
      this.words.replaceChildren("✋ The god's hand: take an act, then touch where it falls");
      return;
    }
    const land = this.over?.land ?? null;
    const asking: Readonly<Record<Target, string>> = {
      land: a.id === "rise" ? "touch a land of a realm" : "touch a land",
      town: "touch a town or its land",
      city: "touch a city",
      pair: this.first?.realm
        ? `${this.first.realm.name}: now touch a land of the realm it ${a.id === "war" ? "falls upon" : "is to meet"}`
        : `touch a land of the realm that ${a.id === "war" ? "attacks" : "is first"}`,
      faith: this.first?.faith
        ? `${this.first.faith.name}: now touch the land to turn`
        : "touch a land that holds the faith",
      world: "touch the world",
      star: "touch the world under its sun",
    };
    if (!this.over) {
      this.words.replaceChildren(`${a.icon} ${a.name}: ${asking[a.target]} · Esc puts it down`);
      return;
    }
    if ((a.target === "pair" || a.target === "faith") && !this.first) {
      const why = this.firstWhy(a, land);
      this.line.classList.toggle("bad", !!why);
      this.words.replaceChildren(
        `${a.icon} ${why ?? (a.target === "faith" ? `${land!.faith!.name}: touch to choose it` : `${land!.realm!.name}: touch to choose it`)}`,
      );
      return;
    }
    // (Still over what was just chosen: what is asked next.)
    if (
      (a.target === "pair" && this.first?.realm && land?.realm?.ref === this.first.realm.ref) ||
      (a.target === "faith" && this.first && land?.cell === this.first.cell)
    ) {
      this.words.replaceChildren(`${a.icon} ${asking[a.target]}`);
      return;
    }
    const aim = this.aim(a, land, this.over.town);
    this.line.classList.toggle("bad", !aim.args);
    this.words.replaceChildren(
      `${a.icon} ${aim.args ? `${sentence(aim.words)} — touch to cast` : aim.words}`,
    );
  }

  /** Light what the act in hand reaches, and what was chosen. */
  private light(): void {
    const lit = new Map<number, Lit>(),
      a = this.act,
      land = this.over?.land ?? null;
    if (a) {
      if (this.first?.realm && a.target === "pair")
        for (const c of this.first.realm.lands) lit.set(c, "chosen");
      if (this.first && a.target === "faith") lit.set(this.first.cell, "chosen");
      if (land && a.target !== "world" && a.target !== "star") {
        const second = a.target === "pair" && this.first ? (a.second ?? "reach") : "reach",
          whole = a.target === "pair" && land.realm ? land.realm.lands : [land.cell];
        for (const c of whole) if (!lit.has(c)) lit.set(c, second);
      }
    }
    this.onLight(lit);
  }

  private drawTiles(): void {
    for (const t of this.tabs.children)
      (t as HTMLElement).classList.toggle("on", (t as HTMLElement).dataset.kind === this.kind);
    const kind = PALETTE_KINDS.find((k) => k.id === this.kind)!;
    this.tiles.replaceChildren(
      ...kind.acts.map((id) => {
        const a = ACTS[id]!,
          b = el("button", `palette-act${this.act?.id === id ? " on" : ""}`, a.icon);
        b.title = a.name;
        b.setAttribute("aria-label", a.name);
        b.dataset.act = id;
        b.onclick = () => (this.act?.id === id ? this.putDown() : this.pick(a));
        return b;
      }),
    );
  }

  private drawYears(): void {
    [...this.spans.children].forEach((b, i) =>
      (b as HTMLElement).classList.toggle("on", [1, 3, 5][i] === this.years),
    );
  }
}

function sentence(text: string): string {
  return text ? text[0]!.toUpperCase() + text.slice(1) : text;
}
