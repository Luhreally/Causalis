// The observatory over a planet (docs/architecture §31): what world this is and
// how its people fare, the clock, the lenses to look through, and an inspector for
// any place — its ground, weather, plate and ores, and the people living there —
// where every fact can be asked "why?".
import type { Breakdown, HostClient, SaveMeta, Status } from "../bridge/index.ts";
import type { Lens } from "../view/index.ts";
import { lineChart } from "./chart.ts";
import { HandView } from "./hand.ts";
import { buildPage, type Page, type PageKind, type PageLinks } from "./pages.ts";
import type { Tidings } from "./tidings.ts";
import { WhyTree, el } from "./why.ts";
import { folder } from "./window.ts";
import { breakdownCard, type HoverTips } from "./hovertip.ts";
import { speedWords, when } from "./words.ts";

/** A quality the viewer may choose (the render module's names, or Auto). */
type QualityChoice = "auto" | "low" | "balanced" | "high" | "ultra";

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
  /** The province the picked spot is part of: its people, market and realm are that province's. */
  province: number;
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
  /** The province's own ref (a land to follow). */
  ref: string;
  people: number;
  byOccupation: { name: string; count: number }[];
  fed: number;
  farming: boolean;
  settledYear: number;
  arrival: string | null;
  villages: number;
  /** The people of the province, as a ref for why. */
  folk: string;
  ways: Ways | null;
  realm: RealmFacts;
  faith: FaithFacts;
  house: { words: string; ref: string } | null;
  industry: {
    power: number;
    works: { words: string; ref: string } | null;
    coal: number;
    oil: number;
    machines: number;
    mine: string | null;
    well: string | null;
    factory: string | null;
    smoke: number;
    smoked: string | null;
    rain: number;
    shifted: string | null;
  };
  wild: { name: string; ref: string; tame: boolean; niche: string }[];
  herding: string | null;
  ecology: {
    wild: number;
    forest: number;
    soil: number;
    firstForest: number;
    thinned: string | null;
    cleared: string | null;
    worn: string | null;
    lost: { name: string; ref: string; niche: string }[];
    hunters: { name: string; ref: string; stock: number } | null;
    flocksTaken: string | null;
    small: number;
    lesser: { name: string; ref: string; stock: number } | null;
    scavengers: { name: string; ref: string; stock: number } | null;
    fish: number | null;
    grainLost: number;
    multiplied: string | null;
    grainEaten: string | null;
    fishFew: string | null;
  };
  lore: { id: string; name: string; year: number; event: string }[];
} | null;

type ProvinceHistory = {
  years: { year: number; population: number; fed: number }[];
  prices: { year: number; food: number; tools: number }[];
};

/** What a click on each of the top bar's chips opens, said in its tooltip. */
const CHIP_OPENS: Readonly<Record<ChipKind, string>> = {
  people: "Click for the chronicle's story",
  towns: "Click for the ledger's towns",
  realms: "Click for the ledger's realms",
  wars: "Click for the ledger's wars",
  faiths: "Click for the ledger's faiths",
  tongues: "Click for the ledger's tongues",
  hungry: "Click for the map of food",
  colonies: "Click for the ledger's sky",
};

/** What a chip of the top bar counts. */
export type ChipKind =
  "people" | "towns" | "realms" | "wars" | "faiths" | "tongues" | "hungry" | "colonies";

/** The world's headline numbers (the host's "world.stats"). */
export type WorldStats = {
  year: number;
  people: number;
  lands: number;
  towns: number;
  cities: number;
  realms: number;
  wars: number;
  faiths: number;
  tongues: number;
  hungry: number;
  colonies: number;
};

export type PeopleEntry = {
  /** The province. */
  cell: number;
  /** The spot at its middle (a fine cell of the globe). */
  centre: number;
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
  /** The deeper lenses' readings (Phase 12 M108): grievance (0 … 1), the men their realm fields, their stores' worth a head, the things they know, their growth these ten years. */
  unrest: number;
  strength: number;
  wealth: number;
  knowledge: number;
  growth: number;
};

/** A people's ways and speech (the host's waysOf). */
type Ways = {
  ref: string;
  words: string[];
  kept: number;
  sounds: string[];
  language: {
    ref: string;
    name: string;
    family: string;
    first: boolean;
    dead: boolean;
    like: number;
    took: { event: string; year: number } | null;
  } | null;
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
  tithe: number;
  host: { words: string; ref: string } | null;
  interests: { group: string; sway: number; want: string | null; source: string | null }[];
  neighbours: { ref: string; name: string; standing: string; opinion: number }[];
  wars: { ref: string; name: string; since: number; attacking: boolean }[];
} | null;

/** A land's living world in lines, where it has turned for the worse. */
function ecologyRows(e: NonNullable<ProvinceFacts>["ecology"]): [string, string | null][] {
  const pct = (x: number) => Math.round(x * 100);
  const rows: [string, string | null][] = [];
  if (e.wild < 0.7)
    rows.push([`Game is scarce: ${pct(e.wild)} in a hundred of what it was`, e.thinned]);
  if (e.firstForest > 0.2 && e.forest < 0.8)
    rows.push([`${pct(e.forest)} in a hundred of its forest still stands`, e.cleared]);
  if (e.soil < 0.9)
    rows.push([`Its soils are worn to ${pct(e.soil)} in a hundred of their strength`, e.worn]);
  for (const l of e.lost)
    rows.push([
      l.niche === "hunter" || l.niche === "small hunter"
        ? `The ${l.name} was driven out of here`
        : l.niche === "scavenger"
          ? `The ${l.name} left here with the kills it lived on`
          : `The ${l.name} was hunted out here`,
      l.ref,
    ]);
  // The web's turns: the game past what it was, the grain eaten, the fish few.
  if (e.multiplied)
    rows.push([
      `The game has multiplied here to ${pct(e.wild)} in a hundred of what it was, its hunters thinned`,
      e.multiplied,
    ]);
  if (e.grainEaten && e.grainLost > 0)
    rows.push([
      `The small game eats ${Math.max(1, Math.round(e.grainLost * 100))} in a hundred of the grain here`,
      e.grainEaten,
    ]);
  if (e.lesser && e.lesser.stock < 0.5)
    rows.push([
      `Few of the ${e.lesser.name} are left here: ${pct(Math.min(1, e.lesser.stock))} in a hundred of what the small game once kept`,
      e.lesser.ref,
    ]);
  if (e.fish !== null && e.fish < 0.7)
    rows.push([
      `Its waters are fished down to ${pct(e.fish)} in a hundred of their fish`,
      e.fishFew,
    ]);
  // Its hunters, where they are thinned, and what they take from the flocks.
  if (e.hunters && e.hunters.stock < 0.6)
    rows.push([
      `Few of the ${e.hunters.name} are left here: ${pct(Math.min(1, e.hunters.stock))} in a hundred of what the game once kept`,
      e.hunters.ref,
    ]);
  if (e.hunters && e.flocksTaken)
    rows.push([`The ${e.hunters.name} takes from the flocks here`, e.flocksTaken]);
  return rows;
}

/** A land's works and power in lines: what drives its crafts, the fuel and machines it makes. */
function industryRows(i: NonNullable<ProvinceFacts>["industry"]): [string, string | null][] {
  const rows: [string, string | null][] = [];
  if (i.works) rows.push([sentenceOf(`their crafts are done in ${i.works.words}`), i.works.ref]);
  if (i.mine)
    rows.push([
      `They dig coal${i.coal ? `: ${i.coal.toLocaleString()} loads last year` : ""}`,
      i.mine,
    ]);
  if (i.well)
    rows.push([
      `They draw oil${i.oil ? `: ${i.oil.toLocaleString()} barrels last year` : ""}`,
      i.well,
    ]);
  if (i.factory)
    rows.push([
      `Their works make machines${i.machines ? `: ${i.machines.toLocaleString()} last year` : ""}`,
      i.factory,
    ]);
  // Power beyond their own strength, their beasts' and their mills'.
  if (i.power > 0.21) rows.push([`${i.power.toFixed(1)} kilowatts of power a person`, null]);
  if (i.smoked && i.smoke > 0.05)
    rows.push([`Smoke fouls their air: ${Math.round(i.smoke * 100)} in a hundred`, i.smoked]);
  if (i.shifted && Math.abs(i.rain - 1) >= 0.05)
    rows.push([
      `The warming has made them ${i.rain < 1 ? "drier" : "wetter"}: their rain ${Math.round(i.rain * 100)} in a hundred of what it was`,
      i.shifted,
    ]);
  return rows;
}

/** "farmers want lighter tribute" → "Farmers want lighter tribute". */
function sentenceOf(text: string): string {
  return text ? text[0]!.toUpperCase() + text.slice(1) : text;
}

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
  private readonly speedButtons: HTMLButtonElement[] = [];
  private readonly clock = el("span", "clock");
  private readonly world = el("p", "world-line");
  /** The world's headline numbers, a grand strategy game's top bar (Phase 10 M96). */
  private readonly statsStrip = el("div", "world-stats");
  /** The top bar's chips, kept from one reading to the next (one rested on keeps its tooltip). */
  private readonly chips = new Map<ChipKind, HTMLButtonElement>();
  /** Its numbers broken down in tooltips, on a desk (M97). */
  hoverTips: HoverTips | null = null;
  private readonly worldText = el("span");
  private readonly inspector = el("section", "inspector");
  private readonly title = el("h2");
  private readonly facts = el("div", "facts");
  private readonly whyBox = el("div", "why");
  private readonly marketBox = el("div");
  private readonly waysBox = el("div", "ways");
  private readonly realmBox = el("div", "realm");
  private readonly loreBox = el("div", "lore");
  private readonly pastBox = el("div", "past");
  private readonly handBox = el("div", "hand-box");
  /** A page opened from the land — a lineage, a realm, a deposit, a plate — over the land's own parts. */
  private readonly pageBox = el("div", "page");
  private pages: { kind: PageKind; ref: string; title: string }[] = [];
  private pageToken = 0;
  private landTitle = "";
  private landWhy = "";
  private landHidden: boolean[] = [];
  /** Whether the land's own parts are put away under a page (and its state kept to restore). */
  private onPage = false;
  private readonly links: PageLinks = {
    why: (text, ref) => this.whyLine(text, ref),
    page: (text, kind, ref) => this.pageLine(text, kind, ref),
  };
  private readonly hand: HandView;
  private readonly closer = el("button", "act", "Look closer");
  private selected: number | null = null;
  /** The picked spot's province. */
  private province: number | null = null;
  /** The speed chosen for the world (the microscope keeps its own). */
  speed: number;
  private description = "";
  onLens: (lens: Lens) => void = () => {};
  /** A why or a page was asked for. */
  onAsked: () => void = () => {};
  /** Help: the guided walk again. */
  onHelp: () => void = () => {};
  onGenesis: () => void = () => {};
  /** Quality: the viewer's choice, and what is drawn now (the setting and the frames). */
  onQualityChoice: (c: QualityChoice) => void = () => {};
  qualityNow: () => { choice: QualityChoice; name: string; fps: number } = () => ({
    choice: "auto",
    name: "high",
    fps: 0,
  });
  /** The bar at the top, where the guided walk shows. */
  readonly bar = el("header", "bar");
  onClose: () => void = () => {};
  onCloser: (cell: number) => void = () => {};
  /** Out to the home star's system. */
  onSky: () => void = () => {};
  /** Keep the world as it stands, or take it back up; each says how it went. */
  onSave: () => Promise<string> = async () => "";
  /** The saves kept; load one; keep this world as a file; open one from a file. */
  onSaves: () => Promise<SaveMeta[]> = async () => [];
  onLoadSave: (save: SaveMeta) => Promise<string> = async () => "";
  onExport: () => Promise<string> = async () => "";
  onImport: (file: File) => Promise<string> = async () => "";

  /** News of what the observer follows, and the toggles that follow things. */
  tidings: Tidings | null = null;

  constructor(root: HTMLElement, client: HostClient, speed: number) {
    this.client = client;
    this.speed = speed;
    this.why = new WhyTree(client);
    this.hand = new HandView(client);
    this.hand.onWhy = (ref) => void this.why.show(ref, this.whyBox);
    const bar = this.bar;
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
    // The menu: an icon and a word each (a phone shows the icons).
    const menuButton = (icon: string, word: string) => {
      const b = el("button", "link");
      b.append(el("span", "menu-icon", icon), el("span", "word", word));
      b.title = word;
      return b;
    };
    // The world's chronicle and its ledger, pages of the page window (Phase 10 M96b).
    const chronicle = menuButton("📜", "Chronicle"),
      ledger = menuButton("📊", "Ledger"),
      // (The world's numbers through the years: Phase 12 M109.)
      numbers = menuButton("📈", "Numbers"),
      concepts = menuButton("📖", "Concepts");
    chronicle.onclick = () => this.onChronicle();
    ledger.onclick = () => this.onLedger();
    numbers.onclick = () => this.onNumbers();
    concepts.onclick = () => this.onConcepts();
    const sky = menuButton("☀️", "The sky");
    sky.onclick = () => this.onSky();
    const keep = menuButton("💾", "Save"),
      back = menuButton("📂", "Saves"),
      said = el("span", "muted");
    keep.onclick = async () => (said.textContent = ` ${await this.onSave()}`);
    back.onclick = () => void this.showSaves();
    const help = menuButton("❓", "Help"),
      settings = menuButton("⚙️", "Settings"),
      // The world's own beginning, from the galaxy's birth to its first people (M89).
      origin = menuButton("🌱", "Its beginning");
    origin.onclick = () => this.onGenesis();
    help.onclick = () => this.onHelp();
    settings.onclick = () => void this.showSettings();
    // Its words on a line of their own (one line on a desk; a phone leaves them out), then its menu.
    this.worldText.className = "world-about";
    const menu = el("span", "world-menu");
    menu.append(
      chronicle,
      ledger,
      numbers,
      concepts,
      sky,
      origin,
      keep,
      back,
      help,
      settings,
      said,
    );
    this.world.append(this.worldText, menu);
    bar.append(speeds, this.statsStrip, this.world);
    this.element.append(bar);
    const close = el("button", "close", "×");
    close.setAttribute("aria-label", "Close");
    close.onclick = () => {
      this.select(null);
      this.onClose();
    };
    this.closer.onclick = () => {
      if (this.province !== null) this.onCloser(this.province);
    };
    this.inspector.append(
      close,
      folder(this.inspector, this.title),
      this.title,
      this.facts,
      this.pageBox,
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
    this.pageBox.hidden = true;
    root.append(this.element);
    this.element.append(
      this.inspector,
      el(
        "p",
        "hint",
        "Tap the world to look at a place. Drag to turn it, pinch or scroll to zoom.",
      ),
    );
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
  /** The world's headline numbers, each with its icon and its words on hover. */
  stats(s: WorldStats): void {
    const big = (n: number) =>
        n >= 1e9
          ? `${(n / 1e9).toFixed(1)}B`
          : n >= 1e6
            ? `${(n / 1e6).toFixed(1)}M`
            : n >= 1e4
              ? `${Math.round(n / 1e3)}k`
              : n.toLocaleString("en-US"),
      chip = (what: ChipKind, icon: string, value: string, title: string, cls = "") => {
        // (Each opens what it counts, as a grand strategy game's top bar does; rested on, on a
        // desk, it is broken down: its greatest parts, each a link.)
        let c = this.chips.get(what);
        if (!c) {
          const made = el("button", "stat-chip");
          made.append(el("span", "chip-icon", icon), el("span", "chip-value"));
          made.onclick = () => this.onChip(what);
          const tips = this.hoverTips;
          tips?.attach(made, async () =>
            breakdownCard(
              tips,
              await this.client.query<Breakdown>({ type: "world.breakdown", args: { what } }),
              made.getAttribute("aria-label") ?? "",
              CHIP_OPENS[what],
            ),
          );
          this.chips.set(what, made);
          c = made;
        }
        c.className = `stat-chip ${cls}`.trim();
        if (!this.hoverTips) c.title = title;
        c.setAttribute("aria-label", title);
        c.lastElementChild!.textContent = value;
        return c;
      };
    const shown = [
      chip(
        "people",
        "👥",
        big(s.people),
        `${s.people.toLocaleString("en-US")} people in ${s.lands} lands`,
      ),
      chip("towns", "🏘️", big(s.towns), `${s.towns} towns, ${s.cities} of them cities`),
      chip("realms", "👑", String(s.realms), `${s.realms} realms`),
      chip("wars", "⚔️", String(s.wars), `${s.wars} wars being fought`, s.wars ? "hot" : ""),
      chip("faiths", "✨", String(s.faiths), `${s.faiths} faiths held`),
      chip("tongues", "🗣️", String(s.tongues), `${s.tongues} tongues spoken`),
      ...(s.hungry
        ? [chip("hungry", "🍞", String(s.hungry), `${s.hungry} lands going hungry`, "hot")]
        : []),
      ...(s.colonies
        ? [chip("colonies", "🏛️", String(s.colonies), `${s.colonies} halls beyond the world`)]
        : []),
    ];
    // (Set in their order only when it changes: a chip moved loses the pointer resting on it.)
    if (
      shown.length !== this.statsStrip.children.length ||
      shown.some((c, i) => this.statsStrip.children[i] !== c)
    )
      this.statsStrip.replaceChildren(...shown);
  }

  people(entries: readonly PeopleEntry[]): void {
    const people = entries.reduce((s, e) => s + e.people, 0),
      farming = entries.filter((e) => e.farming).length;
    this.peopleText = ` · ${people.toLocaleString()} people in ${entries.length} province${entries.length === 1 ? "" : "s"}${farming ? `, ${farming} farming` : ""}`;
    this.showWorld();
  }

  /** The air, once the world has warmed: how much, and the carbon behind it. */
  air(a: { carbon: number; warming: number; warmer: string | null }): void {
    this.airText =
      a.warming >= 0.05
        ? ` · ${a.warming.toFixed(1)} °C warmer than before the engines, the air holding ${Math.round(a.carbon)} parts in a million of carbon`
        : "";
    this.showWorld();
  }

  private peopleText = "";
  private airText = "";
  private showWorld(): void {
    this.worldText.textContent = `${this.description}${this.peopleText}${this.airText}`;
  }

  set visible(on: boolean) {
    this.element.hidden = !on;
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
    this.closePages();
    this.inspector.hidden = cell === null;
    if (cell === null) return;
    // The spot picked, then its province's people, market and years.
    const p = await this.client.query<Place>({ type: "cell", args: { cell } });
    if (this.selected !== cell) return;
    const province = p.province;
    this.province = province;
    const [folk, market, past] = await Promise.all([
      this.client.query<ProvinceFacts>({ type: "province", args: { cell: province } }),
      this.client.query<MarketFacts | null>({ type: "market", args: { cell: province } }),
      this.client.query<ProvinceHistory>({ type: "province.history", args: { cell: province } }),
    ]);
    // A land looked at may be looked closer at: its region readied meanwhile (after its
    // facts, which must not wait behind it).
    if (p.elevation >= 0)
      void this.client.query({ type: "region.prepare", args: { cell: province } }).catch(() => {});
    if (this.selected !== cell) return;
    const high = p.elevation >= 0;
    this.title.textContent = p.biome[0]!.toUpperCase() + p.biome.slice(1);
    // Every line that stands for something opens its why; a lineage, the plate or a
    // deposit, its page.
    const rows: [string, string | null, PageKind?][] = [
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
      [folk?.house ? sentenceOf(`they build ${folk.house.words}`) : "", folk?.house?.ref ?? null],
      [folk?.herding ? "They keep herds" : "", folk?.herding ?? null],
      // Their works, fuel and machines, once they have them.
      ...(folk ? industryRows(folk.industry) : []),
      // Their living world, where it has turned: game, forest and soil against what they were.
      ...(folk ? ecologyRows(folk.ecology) : []),
      // What lives wild here: what can be tamed or sown opens its why.
      ...(folk?.wild ?? [])
        .filter((s) => s.tame)
        .slice(0, 2)
        .map((s): [string, string | null, PageKind] => [
          `The ${s.name} lives wild here: ${s.niche === "seed grass" ? "its seed can be sown" : "it can be tamed"}`,
          s.ref,
          "species",
        ]),
      // And the rest that live wild here, each with its lineage's why.
      ...(folk?.wild ?? [])
        .filter((s) => !s.tame)
        .slice(0, 5)
        .map((s): [string, string | null, PageKind] => [
          s.niche === "hunter" ? `The ${s.name} hunts here` : `The ${s.name} lives wild here`,
          s.ref,
          "species",
        ]),
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
        "plate",
      ],
      [
        p.deposit
          ? `${p.deposit.richness.toLocaleString()} units of ${p.deposit.kind} (${p.deposit.process})`
          : "",
        p.deposit?.ref ?? null,
        "deposit",
      ],
    ];
    this.facts.replaceChildren(
      ...rows
        .filter(([text]) => text)
        .map(([text, ref, kind]) =>
          ref
            ? kind
              ? this.pageLine(text, kind, ref)
              : this.whyLine(text, ref)
            : el("div", "fact", text),
        ),
      ...(folk && this.tidings ? [this.tidings.follow(folk.ref, "this land")] : []),
    );
    this.showRealm(folk ? folk.realm : null, !!folk);
    this.showWays(folk?.ways ?? null, folk?.faith ?? null);
    this.showLore(folk?.lore ?? null);
    this.showMarket(market);
    this.showPast(folk ? past : null);
    if (folk) void this.hand.show(this.handBox, province);
    else this.handBox.replaceChildren();
    this.closer.hidden = !high;
    this.landWhy = folk?.folk ?? p.deposit?.ref ?? p.ref;
    void this.why.show(this.landWhy, this.whyBox);
  }

  private pageLine(text: string, kind: PageKind, ref: string): HTMLElement {
    const b = el("button", "line page-line", text);
    b.onclick = () => {
      this.onAsked();
      void this.openPage(kind, ref);
    };
    return b;
  }

  /** The land's own parts, which a page covers. */
  private get landParts(): HTMLElement[] {
    return [
      this.facts,
      this.closer,
      this.realmBox,
      this.waysBox,
      this.loreBox,
      this.marketBox,
      this.handBox,
      this.pastBox,
    ];
  }

  /** Open a page over the land, keeping the way back. */
  private async openPage(kind: PageKind, ref: string, back = false): Promise<void> {
    const token = ++this.pageToken,
      page = await buildPage(this.client, kind, ref, this.links);
    if (token !== this.pageToken) return;
    // The land's state is kept once, when the first page covers it.
    if (!this.onPage) {
      this.landTitle = this.title.textContent ?? "";
      this.landHidden = this.landParts.map((e) => e.hidden === true);
      this.onPage = true;
    }
    // Going back re-shows the page below without stacking it again.
    if (!back) this.pages.push({ kind, ref, title: page.title });
    this.showPage(page);
  }

  private showPage(page: Page): void {
    const before = this.pages.length > 1 ? this.pages.at(-2)!.title : this.landTitle,
      back = el("button", "back", `‹ ${before}`);
    back.onclick = () => void this.backPage();
    this.title.textContent = page.title;
    for (const e of this.landParts) e.hidden = true;
    this.pageBox.hidden = false;
    this.pageBox.replaceChildren(back, ...page.parts);
    if (page.why) void this.why.show(page.why, this.whyBox);
    this.inspector.scrollTop = 0;
  }

  /** Back one page, or to the land. */
  private async backPage(): Promise<void> {
    this.pages.pop();
    const below = this.pages.at(-1);
    if (below) return this.openPage(below.kind, below.ref, true);
    this.closePages();
    if (this.landWhy) void this.why.show(this.landWhy, this.whyBox);
  }

  private closePages(): void {
    this.pageToken++;
    if (this.onPage) {
      this.landParts.forEach((e, i) => (e.hidden = this.landHidden[i] ?? false));
      this.title.textContent = this.landTitle;
      this.onPage = false;
    }
    this.pages = [];
    this.pageBox.hidden = true;
    this.pageBox.replaceChildren();
  }

  private whyLine(text: string, ref: string): HTMLElement {
    const b = el("button", "line", text);
    b.onclick = () => {
      this.onAsked();
      void this.why.show(ref, this.whyBox);
    };
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
      this.pageLine(
        `${r.seat ? "The seat of" : "Part of"} ${r.name} (${r.lands} land${r.lands === 1 ? "" : "s"}): ${r.government}`,
        "realm",
        r.ref,
      ),
      el("div", "fact", `Ruled by ${r.ruler} since year ${r.since}`),
      el("div", "fact", `Its seat takes ${r.tithe} parts in a hundred of the grain`),
      ...(r.host
        ? [this.whyLine(sentenceOf(`its host fights with ${r.host.words}`), r.host.ref)]
        : []),
      ...(this.tidings ? [this.tidings.follow(r.ref, "this realm")] : []),
    ];
    if (!r.seat)
      parts.push(
        r.cause
          ? this.whyLine(`They are ${mood} under its rule`, r.cause)
          : el("div", "fact muted", `They are ${mood} under its rule`),
      );
    // Who holds sway, and what each most wants: the line opens what the want rests on.
    parts.push(
      el(
        "div",
        "fact muted",
        `Who holds sway: ${r.interests.map((i) => `${i.group} ${Math.round(i.sway * 100)}%`).join(", ")}`,
      ),
    );
    for (const i of r.interests.filter((x) => x.want && x.sway >= 0.08).slice(0, 4))
      parts.push(
        i.source
          ? this.whyLine(sentenceOf(i.want!), i.source)
          : el("div", "fact", sentenceOf(i.want!)),
      );
    for (const w of r.wars)
      parts.push(
        this.whyLine(
          `At war with ${w.name} since year ${w.since}${w.attacking ? "" : ", defending"}`,
          w.ref,
        ),
      );
    for (const n of r.neighbours.slice(0, 5))
      parts.push(this.whyLine(`With ${n.name}: ${n.standing}`, n.ref));
    this.realmBox.replaceChildren(...parts);
  }

  /** A people's ways and speech, each opening why. */
  private showWays(w: Ways | null, faith: FaithFacts): void {
    if (!w) {
      this.waysBox.replaceChildren();
      return;
    }
    const list = (words: string[]) =>
      words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
    const l = w.language;
    this.waysBox.replaceChildren(
      el("h3", undefined, "Their ways"),
      this.whyLine(
        w.words.length ? `They ${list(w.words)}` : "They keep to the middle of every way",
        w.ref,
      ),
      ...(l
        ? [
            this.whyLine(
              `They speak ${l.name}, ${l.first ? "first of its family of tongues" : `of the ${l.family} tongues`}${l.dead ? " (no longer spoken elsewhere)" : ""}`,
              l.ref,
            ),
            l.took
              ? this.whyLine(`They took it up in year ${l.took.year}`, l.took.event)
              : el(
                  "div",
                  "fact muted",
                  `Their speech is ${l.like} parts in a hundred like the common ${l.name}`,
                ),
          ]
        : []),
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

  /** Told when a page of the world's own (its saves, its settings) opens here. */
  onWorldPage: () => void = () => {};
  /** Asked for the world's chronicle, and its ledger (the page window shows them). */
  onChronicle: () => void = () => {};
  /** A chip of the top bar pressed: what it counts is shown (its ledger, its map). */
  onChip: (what: ChipKind) => void = () => {};
  onLedger: () => void = () => {};
  /** Asked for the book of concepts (M97). */
  onConcepts: () => void = () => {};
  /** Asked for the world's numbers through the years (Phase 12 M109). */
  onNumbers: () => void = () => {};

  private worldPage(title: string): void {
    this.onWorldPage();
    this.closePages();
    this.selected = null;
    this.province = null;
    this.inspector.hidden = false;
    this.title.textContent = title;
    this.closer.hidden = true;
    for (const box of [
      this.marketBox,
      this.pastBox,
      this.handBox,
      this.waysBox,
      this.realmBox,
      this.loreBox,
    ])
      box.replaceChildren();
    this.facts.replaceChildren(el("p", "muted", "…"));
  }

  /** The saves kept in this browser: each one's world, year and size, to load; and files. */
  async showSaves(): Promise<void> {
    this.worldPage("Saves");
    this.whyBox.replaceChildren(
      el(
        "p",
        "muted",
        "Saves are kept in this browser, and the world keeps one on its own every five minutes. A copy as a file keeps it anywhere.",
      ),
    );
    const said = el("p", "muted"),
      now = el("button", "act", "Save this world now"),
      file = el("button", "act", "Keep a copy as a file"),
      open = el("input"),
      pick = el("button", "act", "Open a save from a file");
    now.onclick = async () => {
      said.textContent = await this.onSave();
      void this.showSaves().then(() => this.facts.prepend(said));
    };
    file.onclick = async () => (said.textContent = await this.onExport());
    open.type = "file";
    open.accept = ".causalis,.gz,application/gzip";
    open.hidden = true;
    open.setAttribute("aria-label", "Open a save from a file");
    pick.onclick = () => open.click();
    open.onchange = async () => {
      const f = open.files?.[0];
      if (f) said.textContent = await this.onImport(f);
    };
    const saves = await this.onSaves();
    if (this.title.textContent !== "Saves") return;
    const WORLDS: Record<string, string> = {
      earth: "Earth",
      alien: "An alien world",
      sandbox: "The sandbox",
    };
    const rows = saves.map((s) => {
      const b = el(
        "button",
        "line page-line",
        `${WORLDS[s.universe] ?? s.universe} “${s.seed}”, year ${Math.floor(s.t / YEAR).toLocaleString()} · ${(s.bytes / 1e6).toFixed(1)} MB${s.name.endsWith(":auto") ? " · kept on its own" : ""}${s.rulesets > 1 ? " · carried to newer rules" : ""}`,
      );
      b.onclick = async () => (said.textContent = await this.onLoadSave(s));
      return b;
    });
    this.facts.replaceChildren(
      now,
      el("h3", undefined, "Kept in this browser"),
      ...(rows.length ? rows : [el("p", "muted", "Nothing saved yet.")]),
      el("h3", undefined, "Files"),
      file,
      pick,
      open,
      said,
    );
  }

  /** Settings: how finely the world is drawn (the history is the same at every one). */
  showSettings(): void {
    this.worldPage("Settings");
    const WORDS: Record<QualityChoice, string> = {
        auto: "Auto — as fine as this device holds smoothly, stepping down if it drags",
        low: "Low — the plainest drawing, for old or tired devices",
        balanced: "Balanced — clouds and glows, fewer trees and beasts",
        high: "High — shadows, finer bodies and homes, the full woods",
        ultra: "Ultra — the finest: every tree and beast, the sharpest pixels",
      },
      rate = el("p", "muted"),
      list = el("div");
    const draw = () => {
      const now = this.qualityNow();
      rate.textContent = `Drawn at ${now.name[0]!.toUpperCase()}${now.name.slice(1)} · ${now.fps ? `${now.fps} frames a second` : "measuring…"}`;
      list.replaceChildren(
        ...(["auto", "low", "balanced", "high", "ultra"] as const).map((c) => {
          const b = el("button", `line${now.choice === c ? " chosen" : ""}`, WORDS[c]);
          b.onclick = () => {
            this.onQualityChoice(c);
            draw();
          };
          return b;
        }),
      );
    };
    draw();
    // The frame rate, kept up while the page is open.
    const tick = setInterval(() => {
      if (this.title.textContent !== "Settings") clearInterval(tick);
      else draw();
    }, 1000);
    this.facts.replaceChildren(el("h3", undefined, "Quality"), list, rate);
    this.whyBox.replaceChildren(
      el(
        "p",
        "muted",
        "Only the drawing changes: the world's history is the same at every setting.",
      ),
    );
  }
}
