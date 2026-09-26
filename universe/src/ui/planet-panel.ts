// The observatory over a planet (docs/architecture §31): what world this is and
// how its people fare, the clock, the lenses to look through, and an inspector for
// any place — its ground, weather, plate and ores, and the people living there —
// where every fact can be asked "why?".
import type { HostClient, Status } from "../bridge/index.ts";
import { LENSES, LENS_NAMES, type Lens } from "../view/index.ts";
import { lineChart } from "./chart.ts";
import { HandView } from "./hand.ts";
import { WhyTree, el } from "./why.ts";
import { speedWords, when } from "./words.ts";

const DAY = 86_400;
const YEAR = 365 * DAY;
/** Paused, a month, a year and ten years to the second. */
export const PLANET_SPEEDS = [0, YEAR / 12, YEAR, 10 * YEAR];

type Summary = {
  prior: string;
  star: { ref: string; spectral: string; mass: number; ageGyr: number };
  planet: {
    ref: string;
    mass: number;
    gravity: number;
    orbitAu: number;
    yearDays: number;
    dayHours: number;
    tilt: number;
    meanTemperature: number;
    plates: number;
  };
  deposits: number;
};

type Place = {
  cell: number;
  ref: string;
  lat: number;
  lon: number;
  elevation: number;
  temperature: number;
  seasonality: number;
  precipitation: number;
  biome: string;
  plate: { ref: string; index: number; continental: boolean };
  boundary: string;
  river: boolean;
  lake: boolean;
  deposit: { ref: string; kind: string; richness: number; process: string } | null;
};

type ProvinceFacts = {
  people: number;
  byOccupation: { name: string; count: number }[];
  fed: number;
  farming: boolean;
  settledYear: number;
  arrival: string | null;
  villages: number;
  /** The people of the province, as a ref for why. */
  folk: string;
  ways: { ref: string; words: string[]; kept: number; sounds: string[] } | null;
  realm: RealmFacts;
  faith: FaithFacts;
  lore: { id: string; name: string; year: number; event: string }[];
} | null;

type ProvinceHistory = {
  years: { year: number; population: number; fed: number }[];
  prices: { year: number; food: number; tools: number }[];
};

type Chronicle = {
  events: { ref: string; year: number; importance: number; claim: string }[];
  population: { year: number; people: number }[];
};

export type PeopleEntry = {
  cell: number;
  people: number;
  density: number;
  farming: boolean;
  /** What food costs against its usual worth. */
  food: number;
  /** Goods in and out last year. */
  trade: number;
  /** Their speech as a colour: alike tongues, alike colours. */
  tongue: readonly [number, number, number] | null;
  /** Their realm's colour, if they belong to one. */
  realm: readonly [number, number, number] | null;
  /** Their faith's colour, if they hold one beyond the old beliefs. */
  faith: readonly [number, number, number] | null;
};

type FaithFacts = {
  ref: string;
  name: string;
  deity: string;
  since: number;
  event: string | null;
} | null;

type RealmFacts = {
  ref: string;
  name: string;
  lands: number;
  seat: boolean;
  government: string;
  ruler: string;
  since: number;
  grievance: number;
  cause: string | null;
} | null;

/** A province's market, as the host reports it. */
export type MarketFacts = {
  cell: number;
  year: number | null;
  goods: {
    id: string;
    name: string;
    ref: string;
    ratio: number;
    words: string;
    stock: number;
    made: number;
    used: number;
    into: number;
    out: number;
  }[];
  foodMonths: number;
  cover: { tools: number; clothing: number; pottery: number };
  metalworking: string | null;
  town: { ref: string; name: string; population: number } | null;
  trade: { good: string; count: number; out: boolean; with: string }[];
};

function latLon(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? "E" : "W"}`;
}

const OCCUPATION_WORDS: Record<string, string> = {
  dependent: "children",
  forager: "foragers",
  farmer: "farmers",
  herder: "herders",
  crafter: "crafters",
  trader: "traders",
  leader: "leaders",
};

export class PlanetPanel {
  readonly element = el("div", "panel");
  private readonly client: HostClient;
  private readonly why: WhyTree;
  private readonly lensButtons = new Map<Lens, HTMLButtonElement>();
  private readonly speedButtons: HTMLButtonElement[] = [];
  private readonly clock = el("span", "clock");
  private readonly world = el("p", "world-line");
  private readonly worldText = el("span");
  private readonly inspector = el("section", "inspector");
  private readonly title = el("h2");
  private readonly facts = el("div", "facts");
  private readonly whyBox = el("div", "why");
  private readonly marketBox = el("div");
  private readonly waysBox = el("div");
  private readonly realmBox = el("div");
  private readonly loreBox = el("div");
  private readonly pastBox = el("div");
  private readonly handBox = el("div");
  private readonly hand: HandView;
  private readonly closer = el("button", "act", "Look closer");
  private selected: number | null = null;
  /** The speed chosen for the world (the microscope keeps its own). */
  speed: number;
  private description = "";
  onLens: (lens: Lens) => void = () => {};
  onClose: () => void = () => {};
  onCloser: (cell: number) => void = () => {};

  constructor(root: HTMLElement, client: HostClient, lens: Lens, speed: number) {
    this.client = client;
    this.speed = speed;
    this.why = new WhyTree(client);
    this.hand = new HandView(client);
    this.hand.onWhy = (ref) => void this.why.show(ref, this.whyBox);
    const bar = el("header", "bar");
    bar.append(el("strong", "brand", "Causalis Universe"), this.clock);
    const speeds = el("div", "speeds");
    for (const s of PLANET_SPEEDS) {
      const b = el("button", "speed", s === 0 ? "❚❚" : speedWords(s).replace(" a second", "/s"));
      b.setAttribute("aria-label", s === 0 ? "Pause" : speedWords(s));
      b.onclick = () => {
        client.setSpeed(s);
        this.markSpeed(s);
        this.speed = s;
      };
      speeds.append(b);
      this.speedButtons.push(b);
    }
    const lenses = el("div", "speeds");
    for (const l of LENSES) {
      const b = el("button", "speed", LENS_NAMES[l]);
      b.onclick = () => this.setLens(l);
      lenses.append(b);
      this.lensButtons.set(l, b);
    }
    const chronicle = el("button", "link", "Chronicle");
    chronicle.onclick = () => void this.showChronicle();
    this.world.append(this.worldText, " · ", chronicle);
    bar.append(speeds, this.world, lenses);
    this.element.append(bar);
    const close = el("button", "close", "×");
    close.setAttribute("aria-label", "Close");
    close.onclick = () => {
      this.select(null);
      this.onClose();
    };
    this.closer.onclick = () => {
      if (this.selected !== null) this.onCloser(this.selected);
    };
    this.inspector.append(
      close,
      this.title,
      this.facts,
      this.closer,
      this.realmBox,
      this.waysBox,
      this.loreBox,
      this.marketBox,
      this.handBox,
      this.pastBox,
      el("h3", undefined, "Why is it like this?"),
      this.whyBox,
    );
    this.inspector.hidden = true;
    root.append(this.element);
    this.element.append(
      this.inspector,
      el(
        "p",
        "hint",
        "Tap the world to look at a place. Drag to turn it, pinch or scroll to zoom.",
      ),
    );
    this.markLens(lens);
    this.markSpeed(speed);
    client.onStatus((s: Status) => {
      this.clock.textContent = `${when(s.t)} · ${s.speed === 0 ? "paused" : speedWords(Math.max(0, s.achieved))}`;
    });
    void this.describe();
  }

  private async describe(): Promise<void> {
    const s = await this.client.query<Summary>({ type: "planet.summary" });
    const p = s.planet;
    this.description = `A ${s.star.spectral} star · a world of ${p.mass.toFixed(2)} Earth masses, ${p.meanTemperature.toFixed(0)} °C on average, a ${Math.round(p.yearDays)}-day year`;
    this.worldText.textContent = this.description;
  }

  /** The people line under the bar, from the host's people map. */
  people(entries: readonly PeopleEntry[]): void {
    const people = entries.reduce((s, e) => s + e.people, 0),
      farming = entries.filter((e) => e.farming).length;
    this.worldText.textContent = `${this.description} · ${people.toLocaleString()} people in ${entries.length} province${entries.length === 1 ? "" : "s"}${farming ? `, ${farming} farming` : ""}`;
  }

  set visible(on: boolean) {
    this.element.hidden = !on;
  }

  private setLens(lens: Lens): void {
    this.markLens(lens);
    this.onLens(lens);
  }

  private markLens(lens: Lens): void {
    for (const [l, b] of this.lensButtons) b.classList.toggle("on", l === lens);
  }

  /** The market: how well off the people are for what they need, and each good's price with its why. */
  private showMarket(m: MarketFacts | null): void {
    if (!m || m.year === null) {
      this.marketBox.replaceChildren();
      return;
    }
    const open = (text: string, ref: string) => {
      const b = el("button", "line", text);
      b.onclick = () => void this.why.show(ref, this.whyBox);
      return b;
    };
    const parts: HTMLElement[] = [el("h3", undefined, "Their market")];
    parts.push(
      el(
        "div",
        "fact",
        `Food for ${Math.round(m.foodMonths)} months in store; tools for ${Math.round(m.cover.tools)}% of those who need them, clothing for ${Math.round(m.cover.clothing)}%, pots for ${Math.round(m.cover.pottery)}%`,
      ),
    );
    if (m.town)
      parts.push(
        open(
          `${m.town.name} is their market town (${m.town.population.toLocaleString()} people)`,
          m.town.ref,
        ),
      );
    if (m.metalworking) parts.push(open("They smelt and work copper", m.metalworking));
    for (const g of m.goods) {
      const moved = [
        g.into ? `${g.into.toLocaleString()} in` : "",
        g.out ? `${g.out.toLocaleString()} out` : "",
      ]
        .filter(Boolean)
        .join(", ");
      parts.push(
        open(
          `${g.name[0]!.toUpperCase()}${g.name.slice(1)}: ${g.words} · ${g.made.toLocaleString()} made in year ${m.year}${moved ? ` · ${moved}` : ""}`,
          g.ref,
        ),
      );
    }
    const trade = [...m.trade].sort((a, b) => b.count - a.count).slice(0, 4);
    for (const f of trade)
      parts.push(
        el(
          "div",
          "fact muted",
          `${f.out ? "Sent" : "Received"} ${f.count.toLocaleString()} ${f.good} ${f.out ? "to" : "from"} ${f.with}`,
        ),
      );
    this.marketBox.replaceChildren(...parts);
  }

  private markSpeed(speed: number): void {
    PLANET_SPEEDS.forEach((s, i) => this.speedButtons[i]!.classList.toggle("on", s === speed));
  }

  async select(cell: number | null): Promise<void> {
    this.selected = cell;
    this.inspector.hidden = cell === null;
    if (cell === null) return;
    const [p, folk, market, past] = await Promise.all([
      this.client.query<Place>({ type: "cell", args: { cell } }),
      this.client.query<ProvinceFacts>({ type: "province", args: { cell } }),
      this.client.query<MarketFacts | null>({ type: "market", args: { cell } }),
      this.client.query<ProvinceHistory>({ type: "province.history", args: { cell } }),
    ]);
    if (this.selected !== cell) return;
    const high = p.elevation >= 0;
    this.title.textContent = p.biome[0]!.toUpperCase() + p.biome.slice(1);
    // Every line that stands for something opens its why.
    const rows: [string, string | null][] = [
      [
        folk
          ? `${folk.people.toLocaleString()} people: ${folk.byOccupation
              .map((o) => `${o.count.toLocaleString()} ${OCCUPATION_WORDS[o.name] ?? o.name}`)
              .join(", ")}`
          : "",
        folk?.folk ?? null,
      ],
      [
        folk
          ? `Peopled since year ${folk.settledYear}${folk.farming ? `; they farm, in ${folk.villages} village${folk.villages === 1 ? "" : "s"}` : "; they gather what the land gives"}`
          : "",
        folk?.arrival ?? null,
      ],
      [latLon(p.lat, p.lon), null],
      [
        high
          ? `${Math.round(p.elevation).toLocaleString()} m above the sea`
          : `${Math.round(-p.elevation).toLocaleString()} m under the sea`,
        p.ref,
      ],
      [
        `${p.temperature.toFixed(0)} °C on average, swinging ±${p.seasonality.toFixed(0)} °C with the seasons`,
        p.ref,
      ],
      [high ? `${Math.round(p.precipitation).toLocaleString()} mm of rain a year` : "", p.ref],
      [p.lake ? "A lake lies here." : p.river ? "A river runs through." : "", p.ref],
      [
        `On a ${p.plate.continental ? "continental" : "oceanic"} plate${p.boundary !== "none" ? `, near a ${p.boundary} boundary` : ""}`,
        p.plate.ref,
      ],
      [
        p.deposit
          ? `${p.deposit.richness.toLocaleString()} units of ${p.deposit.kind} (${p.deposit.process})`
          : "",
        p.deposit?.ref ?? null,
      ],
    ];
    this.facts.replaceChildren(
      ...rows
        .filter(([text]) => text)
        .map(([text, ref]) => (ref ? this.whyLine(text, ref) : el("div", "fact", text))),
    );
    this.showRealm(folk ? folk.realm : null, !!folk);
    this.showWays(folk?.ways ?? null, folk?.faith ?? null);
    this.showLore(folk?.lore ?? null);
    this.showMarket(market);
    this.showPast(folk ? past : null);
    if (folk) void this.hand.show(this.handBox, cell);
    else this.handBox.replaceChildren();
    this.closer.hidden = !high;
    void this.why.show(folk?.folk ?? p.deposit?.ref ?? p.ref, this.whyBox);
  }

  private whyLine(text: string, ref: string): HTMLElement {
    const b = el("button", "line", text);
    b.onclick = () => void this.why.show(ref, this.whyBox);
    return b;
  }

  /** What they know, newest first; each opens how they came to know it. */
  private showLore(lore: { name: string; year: number; event: string }[] | null): void {
    if (!lore) {
      this.loreBox.replaceChildren();
      return;
    }
    const shown = lore.slice(0, 6);
    this.loreBox.replaceChildren(
      el("h3", undefined, "What they know"),
      ...(shown.length
        ? shown.map((k) =>
            this.whyLine(
              `${k.name[0]!.toUpperCase()}${k.name.slice(1)}, since year ${k.year}`,
              k.event,
            ),
          )
        : [el("div", "fact muted", "Nothing beyond the ways of their fathers yet")]),
      ...(lore.length > shown.length
        ? [el("div", "fact muted", `and ${lore.length - shown.length} more they knew before`)]
        : []),
    );
  }

  /** Their realm: its name, how it is ruled, who rules, and how they feel about it. */
  private showRealm(r: RealmFacts, peopled: boolean): void {
    if (!peopled) {
      this.realmBox.replaceChildren();
      return;
    }
    if (!r) {
      this.realmBox.replaceChildren(
        el("h3", undefined, "Their rulers"),
        el("div", "fact muted", "They belong to no realm: their villages rule themselves."),
      );
      return;
    }
    const mood =
      r.grievance > 0.8
        ? "restless"
        : r.grievance > 0.45
          ? "grudging"
          : r.grievance > 0.2
            ? "settled"
            : "content";
    const parts = [
      el("h3", undefined, "Their rulers"),
      this.whyLine(
        `${r.seat ? "The seat of" : "Part of"} ${r.name} (${r.lands} land${r.lands === 1 ? "" : "s"}): ${r.government}`,
        r.ref,
      ),
      el("div", "fact", `Ruled by ${r.ruler} since year ${r.since}`),
    ];
    if (!r.seat)
      parts.push(
        r.cause
          ? this.whyLine(`They are ${mood} under its rule`, r.cause)
          : el("div", "fact muted", `They are ${mood} under its rule`),
      );
    this.realmBox.replaceChildren(...parts);
  }

  /** A people's ways and speech, each opening why. */
  private showWays(
    w: { ref: string; words: string[]; kept: number; sounds: string[] } | null,
    faith: FaithFacts,
  ): void {
    if (!w) {
      this.waysBox.replaceChildren();
      return;
    }
    const list = (words: string[]) =>
      words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
    this.waysBox.replaceChildren(
      el("h3", undefined, "Their ways"),
      this.whyLine(
        w.words.length ? `They ${list(w.words)}` : "They keep to the middle of every way",
        w.ref,
      ),
      el(
        "div",
        "fact muted",
        `Their speech gives names like ${w.sounds.join(", ")}; it keeps ${w.kept}% of the first people's sounds`,
      ),
      faith
        ? this.whyLine(
            `They worship ${faith.deity}, as ${faith.name} (since year ${faith.since})`,
            faith.event ?? faith.ref,
          )
        : el("div", "fact muted", "They keep the old beliefs of their kin"),
    );
  }

  /** A province over the years: how many, how well fed, what food cost. */
  private showPast(past: ProvinceHistory | null): void {
    if (!past || past.years.length < 2) {
      this.pastBox.replaceChildren();
      return;
    }
    const percent = (y: number) => `${Math.round(y)}%`,
      times = (y: number) => `${y.toFixed(2)}×`;
    this.pastBox.replaceChildren(
      el("h3", undefined, "Over the years"),
      lineChart(
        past.years.map((y) => ({ x: y.year, y: y.population })),
        { label: "People", zero: true },
      ),
      lineChart(
        past.years.map((y) => ({ x: y.year, y: y.fed })),
        { label: "Fed in the leanest month", format: percent, zero: true, guide: 100 },
      ),
      lineChart(
        past.prices.map((y) => ({ x: y.year, y: y.food })),
        { label: "Food, against its usual worth", format: times, guide: 1 },
      ),
    );
  }

  /** The chronicle: what history holds as mattering most, newest first, each with its why. */
  async showChronicle(): Promise<void> {
    this.selected = null;
    this.inspector.hidden = false;
    this.title.textContent = "Chronicle";
    this.closer.hidden = true;
    this.marketBox.replaceChildren();
    this.pastBox.replaceChildren();
    this.handBox.replaceChildren();
    this.waysBox.replaceChildren();
    this.realmBox.replaceChildren();
    this.loreBox.replaceChildren();
    this.facts.replaceChildren(el("p", "muted", "…"));
    const c = await this.client.query<Chronicle>({ type: "chronicle", args: { limit: 60 } });
    if (this.title.textContent !== "Chronicle") return;
    this.facts.replaceChildren(
      lineChart(
        c.population.map((y) => ({ x: y.year, y: y.people })),
        { label: "People on the world", zero: true },
      ),
      ...(c.events.length
        ? c.events.map((e) => this.whyLine(e.claim, e.ref))
        : [el("p", "muted", "Nothing has happened yet that history keeps.")]),
    );
    this.whyBox.replaceChildren(el("p", "muted", "Tap an event to see why it happened."));
  }
}
