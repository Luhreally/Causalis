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

/** How strong a blessing or curse can be laid, and what each is called (sim/acts/fortune.ts holds the same, as a test holds them). */
export const FORTUNE_STRENGTHS = [0.5, 1, 1.5, 2, 3] as const;
export const FORTUNE_WORDS: Readonly<Record<number, string>> = {
  0.5: "faint",
  1: "of old",
  1.5: "strong",
  2: "great",
  3: "the greatest",
};

type Target =
  | "land"
  | "town"
  | "city"
  | "pair"
  | "faith"
  | "tongue"
  | "realm"
  | "world"
  | "star"
  // One of a town's people, touched in it (Phase 60).
  | "person";

/** Where in a town watched the hand touches (Phase 42 M201): metres from its middle, and the lot there (-1: none). */
export type TownPlace = { readonly x: number; readonly z: number; readonly lot: number };

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
  /** A realm's fortune: how strong, and for how many years, each chosen in the palette (a one-off of old, unless). */
  readonly fortune?: boolean;
  /** Between two realms: how the second is lit. */
  readonly second?: "foe" | "friend";
  /** Whether it may fall on an empty land (settlers are sent into one). */
  readonly empty?: boolean;
  /** What is chosen in the palette before it falls: a way to push, a faith's tenet. */
  readonly choose?: "way" | "tenet";
  /** How strong it falls, on the palette's slider, and what the slider is called (2026-11-13). */
  readonly strength?: "Strength" | "Settlers";
  /** A world's or a sun's span of years, chosen in the palette. */
  readonly span?: "world" | "star";
};

/** A people's ways, each with its sign in the palette (Phase 14 M117), and on the map. */
export const WAY_CHOICES: readonly (readonly [string, string, string])[] = [
  ["kinship", "👪", "kinship"],
  ["hierarchy", "👑", "rank"],
  ["piety", "🙏", "piety"],
  ["valour", "⚔️", "valour"],
  ["trade", "💰", "trade"],
  ["openness", "🤝", "openness to strangers"],
  ["tradition", "📜", "old custom"],
  ["thrift", "🏺", "thrift"],
];
/** A faith's tenets, each with its sign. */
const TENETS: readonly (readonly [string, string, string])[] = [
  ["rain", "💧", "the rain"],
  ["plenty", "🌾", "plenty"],
  ["sickness", "🌑", "sickness feared"],
  ["healing", "💊", "healing"],
  ["teaching", "📖", "teaching"],
  ["presence", "☀️", "a presence"],
  ["hunger", "🍂", "hunger"],
  ["fire", "🔥", "the flame"],
];

const ACTS: Readonly<Record<string, PaletteAct>> = {
  rain: {
    id: "rain",
    strength: "Strength",
    icon: "🌧️",
    name: "Send rain",
    target: "land",
    command: "act.rain",
    sign: 1,
    lasting: true,
  },
  drought: {
    id: "drought",
    strength: "Strength",
    icon: "☀️",
    name: "Withhold the rain",
    target: "land",
    command: "act.rain",
    sign: -1,
    lasting: true,
  },
  bounty: {
    id: "bounty",
    strength: "Strength",
    icon: "🌽",
    name: "Bless the harvest",
    target: "land",
    command: "act.harvest",
    sign: 1,
    lasting: true,
  },
  blight: {
    id: "blight",
    strength: "Strength",
    icon: "🥀",
    name: "Blight the harvest",
    target: "land",
    command: "act.harvest",
    sign: -1,
    lasting: true,
  },
  plague: {
    id: "plague",
    strength: "Strength",
    icon: "☠️",
    name: "Send a plague",
    target: "land",
    command: "act.plague",
    sign: -1,
    lasting: true,
  },
  healing: {
    id: "healing",
    strength: "Strength",
    icon: "💊",
    name: "Heal the sick",
    target: "land",
    command: "act.plague",
    sign: 1,
    lasting: true,
  },
  loose: {
    id: "loose",
    icon: "🦠",
    name: "Loose a new sickness",
    target: "land",
    command: "act.loose",
    sign: -1,
  },
  ward: {
    id: "ward",
    icon: "💉",
    name: "Ward against sickness",
    target: "land",
    command: "act.ward",
    sign: 1,
  },
  summon: {
    id: "summon",
    icon: "🛸",
    name: "Call strangers from the stars",
    target: "land",
    command: "act.summon",
  },
  forgive: {
    id: "forgive",
    icon: "🕊️",
    name: "Forgive a land its debts",
    target: "land",
    command: "act.forgive",
    sign: 1,
  },
  break: {
    id: "break",
    icon: "🔨",
    name: "Break a house of lending",
    target: "land",
    command: "act.break",
    sign: -1,
  },
  incite: {
    id: "incite",
    icon: "🗡️",
    name: "Stir an army against its seat",
    target: "land",
    command: "act.incite",
    sign: -1,
  },
  restore: {
    id: "restore",
    icon: "🏛️",
    name: "Give a realm back its rule",
    target: "land",
    command: "act.restore",
    sign: 1,
  },
  pretender: {
    id: "pretender",
    icon: "👑",
    name: "Raise a pretender",
    target: "land",
    command: "act.pretender",
    sign: -1,
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
  // (On any town whose homes stand, where the hand sends it in it: Phase 42 M201.)
  fire: {
    id: "fire",
    icon: "🔥",
    name: "Send fire",
    target: "town",
    command: "act.fire",
    strength: "Strength",
  },
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
    strength: "Strength",
    icon: "🤝",
    name: "Make friends",
    target: "pair",
    command: "act.friendship",
    second: "friend",
  },
  discord: {
    id: "discord",
    strength: "Strength",
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
    strength: "Strength",
    span: "world",
    icon: "🌡️",
    name: "Warm the world",
    target: "world",
    command: "act.warm",
    sign: 1,
  },
  cool: {
    id: "cool",
    strength: "Strength",
    span: "world",
    icon: "❄️",
    name: "Cool the world",
    target: "world",
    command: "act.warm",
    sign: -1,
  },
  flare: {
    id: "flare",
    strength: "Strength",
    span: "star",
    icon: "🌞",
    name: "Make the sun flare",
    target: "star",
    command: "act.flare",
    sign: -1,
  },
  calm: {
    id: "calm",
    strength: "Strength",
    span: "star",
    icon: "🌤️",
    name: "Calm the sun",
    target: "star",
    command: "act.flare",
    sign: 1,
  },
  // The disasters, the makings and a realm's fortunes (Phase 13 M112, M113).
  flood: {
    id: "flood",
    icon: "🌊",
    name: "Raise the river",
    target: "land",
    command: "act.flood",
    strength: "Strength",
  },
  quake: {
    id: "quake",
    strength: "Strength",
    icon: "🏚️",
    name: "Shake the ground",
    target: "land",
    command: "act.quake",
  },
  meteor: {
    id: "meteor",
    strength: "Strength",
    icon: "☄️",
    name: "Fire from the sky",
    target: "land",
    command: "act.meteor",
  },
  settle: {
    id: "settle",
    strength: "Settlers",
    icon: "🧺",
    name: "Send settlers",
    target: "land",
    command: "act.settle",
    empty: true,
  },
  union: {
    id: "union",
    icon: "🔗",
    name: "Make one realm",
    target: "pair",
    command: "act.union",
    second: "friend",
  },
  bless: {
    id: "bless",
    icon: "🌟",
    name: "Bless a realm",
    target: "realm",
    command: "act.bless",
    fortune: true,
  },
  // A people's ways, speech and faith in the god's hand (Phase 14 M117).
  ways: {
    id: "ways",
    strength: "Strength",
    icon: "🎭",
    name: "Push their ways",
    target: "land",
    command: "act.ways",
    choose: "way",
  },
  tongue: {
    id: "tongue",
    icon: "🗣️",
    name: "Teach a tongue",
    target: "tongue",
    command: "act.tongue",
  },
  newtongue: {
    id: "newtongue",
    icon: "💬",
    name: "A tongue of their own",
    target: "land",
    command: "act.newtongue",
  },
  faith: {
    id: "faith",
    icon: "⛩️",
    name: "Found a faith",
    target: "land",
    command: "act.faith",
    choose: "tenet",
  },
  curse: {
    id: "curse",
    icon: "🌑",
    name: "Curse a realm",
    target: "realm",
    command: "act.curse",
    fortune: true,
  },
  // The god's hand made flesh (Phase 60): one of the people of the town the hand rests on, walked in;
  // one of the men of a battle fought before a town, a beast about it (Phase 61).
  possess: {
    id: "possess",
    icon: "🫳",
    name: "Possess one of them",
    target: "person",
    command: "possess.take",
  },
};

/** The acts by kind, as the palette's tabs hold them. */
export const PALETTE_KINDS: readonly {
  id: string;
  icon: string;
  name: string;
  acts: readonly string[];
}[] = [
  { id: "weather", icon: "🌦️", name: "The weather", acts: ["rain", "drought", "flood"] },
  { id: "yield", icon: "🌾", name: "The land's yield", acts: ["bounty", "blight"] },
  {
    id: "health",
    icon: "⚕️",
    name: "Sickness and health",
    acts: ["plague", "healing", "loose", "ward"],
  },
  { id: "wonders", icon: "✨", name: "Wonders", acts: ["inspire", "shrine", "spring", "settle"] },
  { id: "disasters", icon: "🌋", name: "Disasters", acts: ["quake", "meteor", "fire"] },
  {
    id: "peoples",
    icon: "👑",
    name: "The peoples",
    acts: ["war", "peace", "friendship", "discord", "union", "summon"],
  },
  { id: "realms", icon: "🏰", name: "A realm's fortunes", acts: ["rise", "bless", "curse"] },
  { id: "credit", icon: "🏦", name: "Debt and credit", acts: ["forgive", "break"] },
  {
    id: "strife",
    icon: "🗡️",
    name: "Armies and seats",
    acts: ["incite", "restore", "pretender"],
  },
  {
    id: "ways",
    icon: "🎭",
    name: "Ways, speech and faith",
    acts: ["ways", "tongue", "newtongue", "faith", "convert"],
  },
  { id: "sky", icon: "🌍", name: "The world and its sun", acts: ["warm", "cool", "flare", "calm"] },
  { id: "flesh", icon: "🫳", name: "The god made flesh", acts: ["possess"] },
];

/** The years an act can be laid for, each its own buttons: one on a land (3 unless chosen), a realm's fortune (1), a world's warming (50), a sun's flare (3). */
const SPANS = { lasting: [1, 3, 5], world: [10, 50, 100], star: [1, 3, 10] } as const;
/**
 * How hard each act strikes at the strength of old, to say in words what a strength will do (sim/acts: ACT_STRENGTH,
 * DISASTER, GREAT_ACT_STRENGTH, REGARD, WAYS_PUSH, SETTLERS, the fire's fifth; a test holds them the same).
 */
export const PALETTE_FORCE = {
  rain: 0.55,
  harvest: 0.5,
  plague: 3,
  healing: 0.5,
  quake: { dead: 0.04, stores: 0.3, blocks: 0.25 },
  meteor: { dead: 0.2, stores: 0.8, blocks: 0.5, blighted: 2 },
  flood: { dead: 0.005, stores: 0.4, drowned: 1, downriver: 3 },
  fire: { homes: 0.2, dead: 0.01 },
  warm: 1.5,
  flare: 2,
  calm: 0.8,
  regard: 0.5,
  ways: 0.25,
  settlers: { share: 0.08, most: 2000 },
} as const;
/** What each strength of settlers is called. */
const SETTLER_WORDS: Readonly<Record<number, string>> = {
  0.5: "half as many",
  1: "as of old",
  1.5: "half again",
  2: "twice as many",
  3: "three times",
};

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
  /** The choices an act asks for before it falls: which way, which way pushed; which tenet. */
  private readonly choices = el("span", "palette-choices");
  /** How strong a realm's fortune is laid (its own slider), and for how many years (the years' buttons). */
  private readonly strength = el("label", "palette-strength");
  private readonly strengthInput = el("input");
  private readonly strengthWords = el("span", "palette-strength-words");
  private readonly strengthLabel = el("span", "palette-strength-label", "Strength");
  /** What the strength and the years chosen will do, in words, under the line. */
  private readonly does = el("div", "palette-does");
  /** The strength each act was left at (a fortune's shared by a blessing and a curse), as its slider's stop. */
  private readonly strengthBy = new Map<string, number>();
  private fortuneYears = 1;
  private worldYears = 50;
  private starYears = 3;
  private way = "valour";
  private waySign: 1 | -1 = 1;
  private tenet = "rain";
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
  /** The palette opened or shut. */
  onShown: (open: boolean) => void = () => {};
  /**
   * One of a town's people touched with Possess in hand (Phase 60): the town and where in it; told
   * why they cannot be taken (null: taken, the act put down).
   */
  onPossess: (town: string | null, place?: TownPlace) => Promise<string | null> = async () =>
    "possession is not to be had here";

  /** Open the palette, or shut it (and put down what is in hand). */
  show(open: boolean): void {
    this.element.classList.toggle("open", open);
    if (!open) this.putDown();
    this.onShown(open);
  }

  constructor(parent: HTMLElement, client: HostClient) {
    this.client = client;
    this.toggle.title = "The god's hand: acts on the lands, the towns, the peoples, the world";
    this.toggle.setAttribute("aria-label", "The god's hand");
    this.toggle.onclick = () => this.show(!this.element.classList.contains("open"));
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
    // (An act's strength: five stops, the second the strength of old; each act keeps its own.)
    const input = this.strengthInput;
    input.type = "range";
    input.min = "0";
    input.max = `${FORTUNE_STRENGTHS.length - 1}`;
    input.step = "1";
    input.value = `${OLD}`;
    input.setAttribute("aria-label", "How strong");
    input.oninput = () => {
      if (this.act) this.strengthBy.set(strengthKey(this.act), Number(input.value));
      this.say();
    };
    this.strength.append(this.strengthLabel, input, this.strengthWords);
    this.strength.hidden = true;
    this.does.hidden = true;
    this.line.append(this.words, this.spans, this.strength, this.choices);
    const bar = el("div", "palette-bar");
    bar.append(this.tabs, this.tiles);
    this.element.append(this.line, this.does, bar);
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

  /**
   * The map touched with an act in hand: choose, or cast — in a town watched, where in it
   * (`place`: metres from its middle, and the lot of its plan there; Phase 42 M201).
   */
  async tap(cell: number | null, town: string | null, place?: TownPlace): Promise<void> {
    const a = this.act,
      whole = a?.target === "world" || a?.target === "star";
    // (The world's and the sun's acts fall on the whole world, touched anywhere, sea or land.)
    if (!a || (cell === null && !whole)) return;
    const land = cell === null ? null : await this.landAt(cell);
    if (cell !== null) this.over = { land, cell, town };
    if ((a.target === "pair" || a.target === "faith" || a.target === "tongue") && !this.first) {
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
    if (a.target === "person") {
      const why = await this.onPossess(town, place);
      if (why) this.say(why, "bad");
      else {
        this.putDown();
        this.element.classList.remove("open");
      }
      return;
    }
    const aim = this.aim(a, land, town, place);
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
    if (a.target === "tongue") return land.tongue ? null : "they speak no tongue there";
    return land.realm ? null : `${land.name} is no realm's`;
  }

  /** What the act in hand would do to a land (and a town there, where in it), or why it cannot. */
  private aim(
    a: PaletteAct,
    land: PaletteLand | null,
    town: string | null,
    place?: TownPlace,
  ): Aim {
    const years = this.years,
      s = this.strengthFor(a),
      // (A strength other than the one of old is carried in the act, and said; at the one of old, nothing is added.)
      strong = s === 1 ? {} : { strength: s },
      at = s === 1 || a.strength !== "Strength" ? "" : `, ${strengthWords(s)}`,
      span = a.lasting ? ` for ${years} year${years === 1 ? "" : "s"}` : "";
    switch (a.target) {
      case "world": {
        const deg = PALETTE_FORCE.warm * s;
        return {
          words: `the world ${a.sign! > 0 ? "warmed" : "cooled"} by ${s === 1 ? "a degree and a half" : `${deg} degrees`} for ${this.worldYears} years`,
          args: { sign: a.sign, years: this.worldYears, ...strong },
        };
      }
      case "star":
        return this.star
          ? {
              words: `the sun ${a.sign! < 0 ? "flaring: death likelier under its light" : "calmed: death rarer under its light"} for ${this.starYears} years${at}`,
              args: { star: this.star, sign: a.sign, years: this.starYears, ...strong },
            }
          : { words: "the sun is being found", args: null };
      case "land": {
        if (!land) return { words: "no land there", args: null };
        if (a.id === "settle")
          return {
            words: `${s === 1 ? "settlers" : `${SETTLER_WORDS[s]} settlers as of old`} sent into ${land.name}${land.people ? "" : ", empty now"}`,
            args: { cell: land.cell, ...strong },
          };
        if (!land.people) return { words: `no one lives in ${land.name}`, args: null };
        if (a.id === "ways") {
          const w = WAY_CHOICES.find((x) => x[0] === this.way)!;
          return {
            words: `the people of ${land.name} ${this.waySign > 0 ? "more" : "less"} given to ${w[2]}${at}`,
            args: { cell: land.cell, way: this.way, sign: this.waySign, ...strong },
          };
        }
        if (a.id === "newtongue")
          return land.tongue
            ? {
                words: `a tongue of their own for ${land.name}, grown from ${land.tongue.name}`,
                args: { cell: land.cell },
              }
            : { words: `they speak no tongue in ${land.name} to grow from`, args: null };
        if (a.id === "faith") {
          const t = TENETS.find((x) => x[0] === this.tenet)!;
          return {
            words: `a faith of ${t[2]} founded in ${land.name}`,
            args: { cell: land.cell, tenet: this.tenet },
          };
        }
        if (a.id === "summon")
          return {
            words: `strangers of another star called down to ${land.name}: they cross in a year`,
            args: { cell: land.cell },
          };
        if (a.id === "pretender") {
          if (!land.realm) return { words: `${land.name} is no realm's`, args: null };
          if (land.realm.seat)
            return {
              words: `${land.name} is the seat of ${land.realm.name}: no pretender rises there`,
              args: null,
            };
          return {
            words: `a pretender raised in ${land.name}, with the lands about it, against ${land.realm.name}`,
            args: { cell: land.cell },
          };
        }
        if (a.id === "incite" || a.id === "restore") {
          if (!land.realm) return { words: `${land.name} is no realm's`, args: null };
          return {
            words:
              a.id === "incite"
                ? `the army of ${land.realm.name} stirred against its seat`
                : `${land.realm.name} given back its own rule, if its army rules it`,
            args: { cell: land.cell },
          };
        }
        if (a.id === "forgive")
          return {
            words: `every debt ${land.name} owes forgiven, and its debt-bound freed`,
            args: { cell: land.cell },
          };
        if (a.id === "break")
          return {
            words: `the house of lending in ${land.name} broken: its savers ruined, credit dear`,
            args: { cell: land.cell },
          };
        if (a.id === "loose")
          return {
            words: `a new sickness loosed in ${land.name}: it goes on by what carries it`,
            args: { cell: land.cell, sickness: null },
          };
        if (a.id === "ward")
          return {
            words: `the people of ${land.name} warded against every sickness they know`,
            args: { cell: land.cell },
          };
        if (a.id === "quake" || a.id === "meteor" || a.id === "flood")
          return {
            words:
              (a.id === "quake"
                ? `the ground shaken under ${land.name}`
                : a.id === "meteor"
                  ? `fire from the sky on ${land.name}: many dead, its fields burned`
                  : `the river risen over ${land.name}, and downriver`) + at,
            args: { cell: land.cell, ...strong },
          };
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
          words: `${doing[a.id] ?? land.name}${span}${a.id === "inspire" ? "" : at}`,
          args: {
            cell: land.cell,
            sign: a.sign ?? 1,
            years: a.lasting ? years : 1,
            ...(a.id === "inspire" ? {} : strong),
          },
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
                : `fire sweeping ${t.name}`,
          // (Where the hand sets it in the town it touches: the lot a fire falls on, the spot a
          // shrine or a spring is set.)
          here = place && t.ref === town ? place : null,
          where = !here
            ? {}
            : a.id === "fire"
              ? here.lot >= 0
                ? { lot: here.lot }
                : {}
              : { x: Math.round(here.x * 10) / 10, z: Math.round(here.z * 10) / 10 };
        return {
          words: `${here ? `${doing} where you touched` : doing}${a.id === "fire" ? at : ""}`,
          args: { village: t.ref, ...where, ...(a.id === "fire" ? strong : {}) },
        };
      }
      case "person":
        return town
          ? {
              words:
                "touch one of its people, a man of a battle fought before it, or a beast: you will walk in their body",
              args: { town },
            }
          : { words: "go down into a town to touch one of its people", args: null };
      case "realm": {
        const r = land?.realm;
        if (!r) return { words: land ? `${land.name} is no realm's` : "no land there", args: null };
        const strength = s,
          years = this.fortuneYears,
          bless = a.id === "bless",
          what = fortuneReach(bless, strength);
        if (strength === 1 && years === 1)
          return {
            words: bless
              ? `the lands of ${r.name} blessed with content`
              : `the lands of ${r.name} cursed with unrest`,
            args: { realm: r.ref },
          };
        return {
          words: `the lands of ${r.name} ${bless ? "blessed" : "cursed"} with ${what}, ${strengthWords(strength)}, for ${years} year${years === 1 ? "" : "s"}${years > 1 ? ", laid again each year" : ""}`,
          args: {
            realm: r.ref,
            ...(strength !== 1 ? { strength } : {}),
            ...(years !== 1 ? { years } : {}),
          },
        };
      }
      case "tongue": {
        const tongue = this.first?.tongue;
        if (!tongue) return { words: "touch a land that speaks the tongue first", args: null };
        if (!land?.people) return { words: "no one lives there", args: null };
        if (land.tongue?.ref === tongue.ref)
          return { words: `they speak ${tongue.name} in ${land.name} already`, args: null };
        return {
          words: `${land.name} taught the ${tongue.name} tongue`,
          args: { cell: land.cell, language: tongue.ref },
        };
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
          union: `${two.name} joined to ${one.name}, one realm`,
        };
        const felt = a.id === "friendship" || a.id === "discord";
        return {
          words: `${doing[a.id] ?? two.name}${felt ? at : ""}`,
          args: { a: one.ref, b: two.ref, ...(felt ? strong : {}) },
        };
      }
    }
  }

  /** The line above the palette: what the act in hand will do, or asks for. */
  private say(problem?: string, tone?: "bad"): void {
    const a = this.act;
    this.spans.hidden = !a?.lasting && !a?.fortune && !a?.span;
    this.strength.hidden = !a?.fortune && !a?.strength;
    this.drawYears();
    if (a && (a.fortune || a.strength)) {
      const st = this.strengthFor(a),
        name = a.strength ?? "Strength";
      this.strengthInput.value = `${this.strengthBy.get(strengthKey(a)) ?? OLD}`;
      if (this.strengthLabel.textContent !== `${name}:`)
        this.strengthLabel.textContent = `${name}:`;
      this.strengthWords.textContent =
        name === "Settlers"
          ? (SETTLER_WORDS[st] ?? "")
          : st === 1
            ? "of old"
            : (FORTUNE_WORDS[st] ?? "");
      this.strength.dataset.strength = `${st}`;
    }
    const does = a && !a.fortune ? actDoes(a, this.strengthFor(a), this.yearsFor(a), this.way) : "";
    this.does.hidden = !does;
    if (this.does.textContent !== does) this.does.textContent = does;
    this.drawChoices();
    this.line.classList.toggle("bad", tone === "bad");
    // (Why one of a town's people cannot be taken, told whole, on two lines if it must: Phase 60.)
    this.line.classList.toggle("whole", a?.target === "person");
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
      land:
        a.id === "rise"
          ? "touch a land of a realm"
          : a.id === "settle"
            ? "touch a land, empty or not"
            : a.id === "flood"
              ? "touch a land a river runs through"
              : "touch a land",
      realm: "touch a land of the realm",
      town: "touch a town or its land",
      city: "touch a city",
      pair: this.first?.realm
        ? `${this.first.realm.name}: now touch a land of the realm it ${a.id === "war" ? "falls upon" : a.id === "union" ? "is to take in" : "is to meet"}`
        : `touch a land of the realm that ${a.id === "war" ? "attacks" : "is first"}`,
      faith: this.first?.faith
        ? `${this.first.faith.name}: now touch the land to turn`
        : "touch a land that holds the faith",
      tongue: this.first?.tongue
        ? `${this.first.tongue.name}: now touch the land to teach it`
        : "touch a land that speaks the tongue",
      world: "touch the world",
      star: "touch the world under its sun",
      person: "touch one of the people of the town your hand rests on",
    };
    if (!this.over) {
      this.words.replaceChildren(`${a.icon} ${a.name}: ${asking[a.target]} · Esc puts it down`);
      return;
    }
    if ((a.target === "pair" || a.target === "faith" || a.target === "tongue") && !this.first) {
      const why = this.firstWhy(a, land);
      this.line.classList.toggle("bad", !!why);
      this.words.replaceChildren(
        `${a.icon} ${why ?? (a.target === "faith" ? `${land!.faith!.name}: touch to choose it` : a.target === "tongue" ? `${land!.tongue!.name}: touch to choose it` : `${land!.realm!.name}: touch to choose it`)}`,
      );
      return;
    }
    // (Still over what was just chosen: what is asked next.)
    if (
      (a.target === "pair" && this.first?.realm && land?.realm?.ref === this.first.realm.ref) ||
      ((a.target === "faith" || a.target === "tongue") &&
        this.first &&
        land?.cell === this.first.cell)
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
      if (this.first && (a.target === "faith" || a.target === "tongue"))
        lit.set(this.first.cell, "chosen");
      if (land && a.target !== "world" && a.target !== "star") {
        const second = a.target === "pair" && this.first ? (a.second ?? "reach") : "reach",
          whole =
            (a.target === "pair" || a.target === "realm") && land.realm
              ? land.realm.lands
              : [land.cell];
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

  /** The choices an act asks for: its ways and which way (a push), or its tenets (a faith). */
  private drawChoices(): void {
    const a = this.act;
    this.choices.hidden = !a?.choose;
    if (!a?.choose) {
      this.choices.replaceChildren();
      return;
    }
    const list = a.choose === "way" ? WAY_CHOICES : TENETS,
      chosen = a.choose === "way" ? this.way : this.tenet,
      buttons = list.map(([id, icon, words]) => {
        const b = el("button", `speed palette-choice${id === chosen ? " on" : ""}`, icon);
        b.title = words;
        b.setAttribute("aria-label", words);
        b.dataset.choice = id;
        b.onclick = () => {
          if (a.choose === "way") this.way = id;
          else this.tenet = id;
          this.say();
        };
        return b;
      });
    if (a.choose === "way") {
      const sign = el("button", "speed palette-sign", this.waySign > 0 ? "➕" : "➖");
      sign.title = this.waySign > 0 ? "more given to it" : "less given to it";
      sign.onclick = () => {
        this.waySign = this.waySign > 0 ? -1 : 1;
        this.say();
      };
      buttons.unshift(sign);
    }
    this.choices.replaceChildren(...buttons);
  }

  private drawYears(): void {
    const a = this.act,
      stops: readonly number[] = a?.span ? SPANS[a.span] : SPANS.lasting,
      years = a ? this.yearsFor(a) : this.years;
    if (
      this.spans.children.length !== stops.length ||
      [...this.spans.children].some((b, i) => (b as HTMLElement).dataset.years !== `${stops[i]}`)
    )
      this.spans.replaceChildren(
        ...stops.map((n) => {
          const b = el("button", "speed", `${n}y`);
          b.title = `For ${n} year${n === 1 ? "" : "s"}`;
          b.dataset.years = `${n}`;
          b.onclick = () => {
            const now = this.act;
            if (now?.fortune) this.fortuneYears = n;
            else if (now?.span === "world") this.worldYears = n;
            else if (now?.span === "star") this.starYears = n;
            else this.years = n;
            this.drawYears();
            this.say();
          };
          return b;
        }),
      );
    for (const b of this.spans.children)
      (b as HTMLElement).classList.toggle("on", (b as HTMLElement).dataset.years === `${years}`);
  }

  /** The strength the act in hand is laid at (1 where it has none). */
  private strengthFor(a: PaletteAct): number {
    if (!a.fortune && !a.strength) return 1;
    return FORTUNE_STRENGTHS[this.strengthBy.get(strengthKey(a)) ?? OLD] ?? 1;
  }

  /** The years the act in hand is laid for. */
  private yearsFor(a: PaletteAct): number {
    return a.fortune
      ? this.fortuneYears
      : a.span === "world"
        ? this.worldYears
        : a.span === "star"
          ? this.starYears
          : this.years;
  }

  /** How strong an act is to fall, by its id (for the look tools and the gates, as its slider moved). */
  setStrength(id: string, strength: number): void {
    const a = ACTS[id],
      at = FORTUNE_STRENGTHS.indexOf(strength as (typeof FORTUNE_STRENGTHS)[number]);
    if (a && at >= 0) this.strengthBy.set(strengthKey(a), at);
    this.say();
  }

  /** How strong a blessing or curse is to be, and for how many years (for the look tools and the gates). */
  setFortune(strength: number, years: number): void {
    const at = FORTUNE_STRENGTHS.indexOf(strength as (typeof FORTUNE_STRENGTHS)[number]);
    if (at >= 0) this.strengthBy.set("fortune", at);
    if ([1, 3, 5].includes(years)) this.fortuneYears = years;
    this.say();
  }
}

/** What a blessing or curse at a strength reaches, in words (fortune.ts: plenty or blight past 1, health or sickness past 1.5). */
function fortuneReach(bless: boolean, strength: number): string {
  const parts = bless
    ? [
        "content",
        ...(strength > 1 ? ["plenty"] : []),
        ...(strength > 1.5 ? ["health"] : []),
        ...(strength > 1 ? ["standing, and the envy of those who meet them"] : []),
      ]
    : [
        "unrest",
        ...(strength > 1 ? ["blight"] : []),
        ...(strength > 1.5 ? ["sickness"] : []),
        ...(strength > 1 ? ["ill omens"] : []),
      ];
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0]!;
}
/** The stop of the strength of old on an act's slider. */
const OLD = FORTUNE_STRENGTHS.indexOf(1);
/** Which strength an act keeps: a blessing and a curse share one, every other act its own. */
const strengthKey = (a: PaletteAct) => (a.fortune ? "fortune" : a.id);
const hundred = (x: number) => {
  const n = x * 100;
  return n >= 1.5 || n === Math.round(n)
    ? `${Math.round(n)} in a hundred`
    : `${Math.round(n * 10) / 10} in a hundred`;
};
const times = (x: number) => (Math.round(x * 10) / 10).toString();
const yearsOf = (n: number) => `${n} year${n === 1 ? "" : "s"}`;
/**
 * What an act at a strength and for so many years will do, plainly, with its numbers (the sim's own rules: an act raised
 * by k is 1 + k·s, lowered by k is (1 − k)^s; a disaster's shares s times its own, never past the whole). Empty: nothing
 * to say beyond the line (an act with no strength or span).
 */
function actDoes(a: PaletteAct, s: number, years: number, way: string): string {
  const f = PALETTE_FORCE,
    lower = (k: number) => Math.pow(1 - k, s),
    share = (k: number, most = 1) => Math.min(most, k * s),
    each = `each year for ${yearsOf(years)}`;
  switch (a.id) {
    case "rain":
      return `Rain ${hundred(f.rain * s)} more than the year would bring, ${each}.`;
    case "drought":
      return `Rain at ${hundred(lower(f.rain))} of what the year would bring, ${each}${lower(f.rain) < 0.25 ? ": wells and fields run dry" : ""}.`;
    case "bounty":
      return `Harvests ${hundred(f.harvest * s)} richer, ${each}.`;
    case "blight":
      return `Harvests at ${hundred(lower(f.harvest))} of their usual, ${each}${lower(f.harvest) < 0.3 ? ": famine likely" : ""}.`;
    case "plague":
      return `Deaths ${times(1 + f.plague * s)} times as likely, ${each}.`;
    case "healing":
      return `Deaths at ${hundred(lower(f.healing))} of their usual, ${each}.`;
    case "quake":
      return `About ${hundred(share(f.quake.dead, 0.9))} of its people dead, ${hundred(share(f.quake.stores))} of its stores spilled, ${hundred(share(f.quake.blocks))} of its homes down (fewer where they have learned to build against it).`;
    case "meteor":
      return `About ${hundred(share(f.meteor.dead, 0.9))} of its people dead, ${hundred(share(f.meteor.stores))} of its stores burned, ${hundred(share(f.meteor.blocks))} of its homes down, its fields burned ${yearsOf(Math.max(1, Math.round(f.meteor.blighted * s)))}; a crater left.`;
    case "flood":
      return `The river rises over it and up to ${Math.max(1, Math.round(f.flood.downriver * s))} lands downriver: ${hundred(share(f.flood.dead, 0.9))} drowned, ${hundred(share(f.flood.stores))} of the stores soaked, the fields drowned ${yearsOf(Math.max(1, Math.round(f.flood.drowned * s)))}.`;
    case "fire":
      return `About ${hundred(share(f.fire.homes))} of the town's homes burn, and ${hundred(f.fire.dead * s)} of its people die.`;
    case "friendship":
    case "discord":
      return `${a.id === "friendship" ? "A kindness" : "A grievance"} worth ${Math.round(f.regard * s * 100)} in their regard of each other (a war between them costs 45), fading by half every thirty years.`;
    case "ways":
      return `Their ${WAY_CHOICES.find((x) => x[0] === way)?.[2] ?? way} moved ${hundred(f.ways * s)}, and their old custom with it, so it lasts.`;
    case "warm":
    case "cool":
      return `The world ${a.id === "warm" ? "warmer" : "colder"} by ${times(f.warm * s)} degrees for ${yearsOf(years)}: the rains move, and the fields with them.`;
    case "flare":
      return `Under its light, death ${times(1 + (f.flare - 1) * s)} times as likely for ${yearsOf(years)}.`;
    case "calm":
      return `Under its light, deaths at ${hundred(lower(1 - f.calm))} of their usual for ${yearsOf(years)}.`;
    case "settle":
      return `${sentence(hundred(f.settlers.share * s))} of the most peopled land beside it go, at most ${Math.round(f.settlers.most * s).toLocaleString("en-US")}, with their share of its stores.`;
  }
  return "";
}
const strengthWords = (s: number) =>
  s === 1
    ? "at the strength of old"
    : s === 3
      ? "at the greatest strength"
      : `at a ${FORTUNE_WORDS[s] ?? ""} strength`;

function sentence(text: string): string {
  return text ? text[0]!.toUpperCase() + text.slice(1) : text;
}
