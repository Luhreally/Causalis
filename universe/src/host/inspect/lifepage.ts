// A world's Life page (B2 of the life plan, docs/architecture/asks-2026-11-12-plan.md Part B): where its life began
// and on what, when its air changed, its small lives under the glass, its founding stocks with a beast of each, the
// roles its living world fills and leaves empty with why; for a lifeless world, what was missing. Every word is read
// from the world's own numbers (rules/origin.ts, gen/origin.ts) and agrees with what it already is. Two worlds set
// side by side as "What can be done here" sets them (F5): any seed typed, read from what it is made of.
//
// `world:life` is the home world's; `life:<a body's ref>` another world's, of the home star or another; and
// `lifewith:<universe>|<seed>` the home world's beside another. Pure reads: asking moves nothing.
import { seedFromText, type World } from "../../kernel/index.ts";
import {
  AGES,
  BIOME_NAMES,
  HABITAT,
  NICHES,
  ageSpan,
  beastPlanOf,
  generateHomeWorld,
  treeOfLife,
  worldKindOf,
  worldStocks,
  type HomeWorld,
  type Niche,
  type Species,
  type WorldOrigin,
} from "../../gen/index.ts";
import {
  EARTHLIKE,
  KINDS,
  OPEN,
  PIGMENT_WORDS,
  TRADES,
  powerWords,
  type CradleRead,
  type TradeRead,
} from "../../rules/index.ts";
import { homePlanet } from "../../sim/index.ts";
import type { Block, Item, Line, PageModel, Row, SideCell } from "../../bridge/index.ts";
import { fineWorld, originOfHome } from "../origin.ts";
import { lifeOfBody, lifeOfWorld, originOfBody, originOfWorld } from "../elsewhere.ts";
import { starByRef } from "../galaxy.ts";
import { celsius, lifelessWhy } from "../kinds.ts";
import { dawnSeaOf, dropOfWorld, elsewhereBlocks } from "./small.ts";
import { count, item, link, many, stat, yearNow } from "./words.ts";

const cap = (s: string) => `${s[0]!.toUpperCase()}${s.slice(1)}`;
const NICHE_ICON: Readonly<Record<string, string>> = {
  "seed grass": "🌾",
  grazer: "🦌",
  browser: "🦒",
  "great beast": "🦣",
  hunter: "🐺",
  "seed-eater": "🐦",
  swimmer: "🐟",
  "small hunter": "🦊",
  scavenger: "🦅",
};

/** Millions of years ago in words: "2.4 billion years ago", "640 million years ago". */
function ago(my: number): string {
  return my >= 1000
    ? `${(my / 1000).toFixed(1)} billion years ago`
    : `${count(Math.round(my))} million years ago`;
}

/** A place's rate against the likeliest's, in words. */
function against(c: CradleRead, best: CradleRead | null): string {
  if (c.shut) return "shut";
  if (!best || best.rate <= 0) return "—";
  if (c === best) return "the likeliest";
  const k = c.rate / best.rate;
  return k >= 0.5
    ? `${Math.round(k * 100)}% as likely`
    : k >= 0.01
      ? `${Math.round(k * 100)}% as likely`
      : "far less likely";
}

/** A trade's power a kilogram, said with its estimate. */
function powerLine(t: TradeRead, slow: number): string {
  const here = powerWords(t.power),
    at15 = powerWords(t.power15);
  return slow < 0.7 || slow > 1.4
    ? `${here} a kilogram at its warmth (${at15} at 15 °C)${t.estimate ? ", an estimate" : ""}`
    : `${here} a kilogram${t.estimate ? ", an estimate" : ""}`;
}

/** The world's own, read whole: what the Life page tells. */
type LifeRead = {
  readonly name: string;
  readonly origin: WorldOrigin;
  /** Its first cells and first bodies, millions of years ago (null: not yet, or not known). */
  readonly cells: number | null;
  readonly bodies: number | null;
  /** Its world in a few words. */
  readonly what: string;
  /** Whether it lives, and why it does not where it does not (the world's own words). */
  readonly lives: boolean;
  readonly lifeless: string | null;
};

/** A home world's reading (its fine grid's). */
function homeRead(g: HomeWorld, name: string): LifeRead {
  const fine = fineWorld(g),
    origin = originOfHome(fine),
    tree = treeOfLife(fine),
    at = (id: string) => tree.rungs.find((r) => r.id === id)?.at ?? null,
    k = KINDS[worldKindOf(fine)],
    lives = fine.life.species.length > 0;
  return {
    name,
    origin,
    cells: lives ? at("cells") : null,
    bodies: lives ? at("bodies") : null,
    what: `${k.icon} ${cap(k.name)} of ${k.liquid.name}, ${celsius(fine.planet.meanTemperature)} on average, about a ${spectral(fine.star.spectral)}`,
    lives,
    lifeless: lives ? null : lifelessWhy(fine),
  };
}

/** A star by its class in a word. */
function spectral(s: string): string {
  const c = s[0];
  return c === "M"
    ? "red dwarf"
    : c === "K"
      ? "orange star"
      : c === "G"
        ? "yellow star"
        : c === "F"
          ? "yellow-white star"
          : "white star";
}

/** The facts of how its life began, for its first tab. */
function dawnFacts(r: LifeRead): Block {
  const o = r.origin,
    rows = [];
  if (o.cradle && r.lives)
    rows.push(stat("Where it began", `${o.cradle.icon} ${cap(o.cradle.name)}: ${o.cradle.why}`));
  if (o.first)
    rows.push(
      stat(
        "What it first ran on",
        `${cap(o.first.name)} (${o.first.reaction}): ${o.first.yields}; ${powerLine(o.first, o.slow)}`,
      ),
    );
  if (r.cells !== null) rows.push(stat("Its first cells", ago(r.cells)));
  if (o.light) {
    const pig = o.ground.pigment ? PIGMENT_WORDS[o.ground.pigment] : null;
    rows.push(
      stat(
        "Its light-eaters",
        `${cap(o.light.name)}${pig && o.light.id === "split-water" ? `, with ${pig.name} (${pig.colour})` : ""}: ${powerLine(o.light, o.slow)}`,
      ),
    );
  } else if (r.lives)
    rows.push(
      stat(
        "Its light-eaters",
        o.ground.family === "methane"
          ? "None: too little light comes through its haze to live by, so its life eats what the light makes high in the air"
          : o.ground.underIce
            ? "None: no light reaches the water under its ice"
            : "None: too little of its star's light reaches it",
      ),
    );
  if (o.eaters)
    rows.push(stat("Its eaters", `${cap(o.eaters.name)}: ${powerLine(o.eaters, o.slow)}`));
  const air = o.air;
  rows.push(
    stat(
      "Its air",
      air.oxygen
        ? air.at !== null
          ? `Free oxygen since about ${ago(air.at)} (an estimate)`
          : `Free oxygen, but ${air.words}`
        : `No free oxygen: ${air.words}`,
    ),
  );
  if (r.bodies !== null) rows.push(stat("Its first bodies", ago(r.bodies)));
  if (o.slow < 0.5)
    rows.push(
      stat(
        "Its warmth",
        `${celsius(o.ground.celsius)}: life's chemistry runs ${slowWords(o.slow)} than at 15 °C (doubling with every ten degrees, an estimate)`,
      ),
    );
  return { type: "facts", rows };
}

/** How much slower, in words. */
function slowWords(slow: number): string {
  const k = 1 / slow;
  if (k < 10) return `${k.toFixed(1)} times slower`;
  if (k < 1000) return `${Math.round(k)} times slower`;
  if (k < 1e6) return `${count(Math.round(k / 1000))} thousand times slower`;
  return `${count(Math.round(k / 1e6))} million times slower`;
}

/** The six places, as this world offers them. */
function cradleTable(r: LifeRead): Block {
  const o = r.origin,
    best = o.cradles.find((c) => !c.shut && c.rate > 0) ?? null;
  return {
    type: "table",
    title: "Where life could have begun",
    columns: ["Place", "Here", "Why"],
    rows: o.cradles.map((c): Row => ({
      cells: [[`${c.icon} ${cap(c.name)}`], [against(c, best)], [c.why]],
      keys: [c.name, c.rate, c.why],
    })),
  };
}

/** When its air changed, told. */
function airBlock(r: LifeRead): Block {
  const a = r.origin.air,
    lines: Line[] = [];
  if (a.oxygen && a.at !== null) {
    lines.push([
      `About ${ago(a.at)} (an estimate), ${a.words}. At their coming its light-eaters made oxygen ${a.made}× as fast as Earth's could, and what soaked it up took ${a.soaked}× as much as it does on Earth now.`,
    ]);
    if (a.held)
      lines.push([
        `By what its light-eaters made and what soaked it up alone, the oxygen would have won later still; but its first cells together, too large to live without it, were living ${r.origin.dates ? ago(r.origin.dates.floor) : "by then"}, so its air had changed by then.`,
      ]);
  } else
    lines.push([
      cap(
        `${a.oxygen ? "its air holds oxygen, but " : "its air never came to hold free oxygen: "}${a.words}.`,
      ),
    ]);
  lines.push([
    a.oxygen
      ? "Free oxygen is what lets fire burn and what lets the strongest, fastest bodies be: breathing it gives about fifteen times what fermenting does."
      : "Without free oxygen nothing burns, and its bodies live on weaker trades of energy.",
  ]);
  return { type: "text", title: "When its air changed", lines };
}

/** Its trades, held and shut. */
function tradeBlocks(r: LifeRead): Block[] {
  const o = r.origin,
    used = new Set([o.first?.id, o.light?.id, o.eaters?.id]),
    open = o.trades.filter((t) => t.open),
    shut = o.trades.filter((t) => !t.open);
  return [
    {
      type: "table",
      title: "What its life can run on",
      columns: ["Trade", "A kilogram gets", "What it takes"],
      rows: open.map((t): Row => ({
        cells: [
          [`${used.has(t.id) ? "● " : ""}${cap(t.name)}: ${t.reaction}`],
          [powerLine(t, o.slow)],
          [`${cap(t.halves)}; ${t.yields}`],
        ],
        keys: [t.name, t.power, t.halves],
      })),
    },
    {
      type: "text",
      lines: [
        [
          "● marks what its life runs on. A trade's power a kilogram decides how large an active body can be, whether warm blood pays, whether hunters can live, and how long its chain of eating is (about a tenth passes up each link). The powers are estimates, scaled to Earth's own: breathing oxygen gives about 4 W a kilogram of active body.",
        ],
      ],
    },
    {
      type: "list",
      title: "What it cannot run on, and why",
      items: shut.map((t) => ({ line: [`${cap(t.name)}: ${t.missing}`], tone: "shut" as const })),
    },
  ];
}

/** The five needs of life's start, met or not. */
function needsBlock(r: LifeRead): Block {
  return {
    type: "list",
    title: "What life needs to begin",
    items: r.origin.needs.map((n) => ({
      line: [`${cap(n.need)}: ${n.words}`],
      tone: n.met ? ("have" as const) : ("shut" as const),
    })),
  };
}

/** A world's dawn: its facts, its places, its air; for a lifeless world, what was missing. */
function dawnBlocks(r: LifeRead): Block[] {
  if (!r.lives)
    return [
      { type: "text", lines: [[`${r.what}.`], [`Nothing lives here: ${r.lifeless}.`]] },
      needsBlock(r),
      {
        type: "text",
        lines: [
          [
            r.origin.needs.every((n) => n.met)
              ? `Every need was there, the likeliest place ${r.origin.needs.find((n) => n.need === "a place")!.words.replace(", the likeliest", "")}; that its chemistry never quickened into life was its world's lot.`
              : `What was missing: ${r.origin.needs
                  .filter((n) => !n.met)
                  .map((n) => n.need)
                  .join(", ")}.`,
          ],
        ],
      },
      cradleTable(r),
      airBlock(r),
    ];
  const o = r.origin;
  return [
    {
      type: "text",
      lines: [
        [`${r.what}.`],
        [
          o.cradle && o.first
            ? `Its life began at ${o.cradle.name}, running on ${o.first.name}${r.cells !== null ? `, ${ago(r.cells)}` : ""}.`
            : "Its life began in its first seas.",
        ],
      ],
    },
    dawnFacts(r),
    cradleTable(r),
    airBlock(r),
  ];
}

// —— The home world's stocks and roles ——————————————————————————————————————————————————————

/** Its founding stocks, each with a living beast of it. */
function stockBlocks(g: HomeWorld): Block[] {
  const fine = fineWorld(g),
    ws = worldStocks(fine);
  if (!ws)
    return [
      {
        type: "text",
        lines: [
          [
            fine.prior === EARTHLIKE.name
              ? "Its beasts are Earth's own, drawn as they have always been: their stocks are the vertebrates', the arthropods' and the rest of Earth's."
              : "No stocks: nothing on it grew a body.",
          ],
        ],
      },
    ];
  const living = fine.life.species.filter((s) => s.died === null && s.body),
    of = (s: Species) => ws.ofLine[ws.tree.ofSpecies[s.index] ?? -1] ?? -1,
    items = ws.stocks.flatMap((st) => {
      const beast = living.find((s) => of(s) === st.id);
      if (!beast) return [];
      return [
        {
          ref: beast.ref,
          name: cap(st.name),
          body: beastPlanOf(fine, beast),
          words:
            (ws.living[st.id] ?? 0) <= 1
              ? `${beast.name}, its only living beast`
              : `${beast.name}, one of ${many(ws.living[st.id] ?? 0, "living beast", "living beasts")} of it`,
        },
      ];
    });
  return [
    {
      type: "lineup",
      title: `Its ${many(ws.stocks.length, "founding stock", "founding stocks")}, a beast of each`,
      apart: true,
      items,
    },
    ...ws.stocks.map((st): Block => ({
      type: "list",
      title: cap(st.name),
      items: st.why.slice(0, 4).map((w) => item(`${cap(w.what)}: ${w.because} (${w.figure})`)),
    })),
  ];
}

/** The roles its living world fills and leaves empty, each with its reason. */
function roleBlock(g: HomeWorld): Block {
  const fine = fineWorld(g),
    biomes = new Set<number>();
  for (let c = 0; c < fine.grid.count; c++)
    if (fine.tectonics.elevation[c]! > 0) biomes.add(fine.climate.biome[c]!);
  const items: Item[] = [];
  for (const niche of NICHES) {
    if (niche === "upright ape") continue;
    const all = fine.life.species.filter((s) => s.niche === niche),
      alive = all.filter((s) => s.died === null),
      icon = NICHE_ICON[niche] ?? "•";
    if (alive.length) {
      items.push({
        line: [
          `${icon} ${cap(niche)}: ${many(alive.length, "living lineage", "living lineages")}, as `,
          link(alive[0]!.name, alive[0]!.ref),
        ],
        ref: alive[0]!.ref,
        tone: "have",
      });
      continue;
    }
    items.push({
      line: [`${icon} ${cap(niche)}: none. ${emptyWhy(fine, niche, all, biomes)}`],
      tone: "shut",
    });
  }
  return {
    type: "list",
    title: "The roles its living world fills, and those it leaves empty",
    items,
  };
}

/** Why a role stands empty. */
function emptyWhy(
  g: HomeWorld,
  niche: Exclude<Niche, "upright ape">,
  all: readonly Species[],
  biomes: ReadonlySet<number>,
): string {
  if (all.length) {
    const last = Math.max(...all.map((s) => s.died ?? 0)),
      age = g.deep.ages[last],
      [from, to] = ageSpan(last);
    return `${cap(many(all.length, "lineage", "lineages"))} filled it once; the last died out ${to === 0 ? `in the last ${from} million years` : `${from}–${to} million years ago`}${age && age.kind !== "quiet" ? `, in its ${age.kind}` : ""}.`;
  }
  const lands = HABITAT[niche].filter((b) => biomes.has(b));
  if (!lands.length)
    return `It lives in ${HABITAT[niche]
      .slice(0, 3)
      .map((b) => BIOME_NAMES[b] ?? "land")
      .join(", ")} and the like, and none of its land is so.`;
  return `Its lands are there (${lands
    .slice(0, 2)
    .map((b) => BIOME_NAMES[b] ?? "land")
    .join(", ")}), but none of its ${AGES} ages' lineages came to it.`;
}

// —— Beside another ——————————————————————————————————————————————————————————————————————

const OTHERS = new Map<string, LifeRead & { readonly g: HomeWorld }>();
/** Another world, as its making leaves it (kept: its column is read again and again). */
function otherRead(universe: string, seed: string): LifeRead & { readonly g: HomeWorld } {
  const key = `${universe}|${seed}`,
    kept = OTHERS.get(key);
  if (kept) return kept;
  const g = generateHomeWorld(seedFromText(seed), universe === "earth" ? EARTHLIKE : OPEN),
    out = { ...homeRead(g, seed), g };
  if (OTHERS.size >= 4) OTHERS.delete(OTHERS.keys().next().value!);
  OTHERS.set(key, out);
  return out;
}

/** Two worlds' life, side by side. */
function besideBlocks(
  here: LifeRead & { readonly g: HomeWorld },
  universe: string,
  other: (LifeRead & { readonly g: HomeWorld }) | null,
  self: boolean,
  asked: string | null,
): Block[] {
  const pick: Block = {
    type: "tool",
    tool: "can.pick",
    args: { universe, seed: self ? null : asked, to: "lifewith" },
  };
  if (self)
    return [pick, { type: "text", lines: [[`That is this world, ${here.name}: pick another.`]] }];
  if (!other)
    return [
      pick,
      {
        type: "text",
        lines: [
          [
            "Pick any world, or type any seed: how its life began is read from what it is made of, and nothing has to run.",
          ],
        ],
      },
    ];
  const cell = (r: LifeRead, say: (r: LifeRead) => SideCell): SideCell => say(r),
    row = (label: string, say: (r: LifeRead) => SideCell) => {
      const cells = [cell(here, say), cell(other, say)] as const,
        plain = (c: SideCell) => JSON.stringify(c.line);
      return { label, parts: plain(cells[0]) !== plain(cells[1]), cells };
    },
    none = (r: LifeRead): SideCell => ({
      tone: "shut",
      line: [`No life: ${r.lifeless ?? "none"}`],
    });
  const rows = [
    row("🌍 The world", (r) => ({ tone: "have", line: [r.what] })),
    row("📍 Where life began", (r) =>
      r.lives && r.origin.cradle ? { tone: "have", line: [cap(r.origin.cradle.name)] } : none(r),
    ),
    row("⚡ Its first life ran on", (r) =>
      r.origin.first
        ? {
            tone: "have",
            line: [`${cap(r.origin.first.name)}, ${powerWords(r.origin.first.power15)} a kg`],
          }
        : none(r),
    ),
    row("☀️ Its light-eaters", (r) =>
      r.origin.light
        ? { tone: "have", line: [cap(r.origin.light.name)] }
        : { tone: "shut", line: [r.lives ? "None" : "No life"] },
    ),
    row("🫁 Its eaters", (r) =>
      r.origin.eaters
        ? {
            tone: "have",
            line: [`${cap(r.origin.eaters.name)}, ${powerWords(r.origin.eaters.power15)} a kg`],
          }
        : { tone: "shut", line: ["No life"] },
    ),
    row("🌬️ Its air", (r) =>
      r.origin.air.oxygen
        ? {
            tone: "have",
            line: [
              r.origin.air.at !== null
                ? `Oxygen since ${ago(r.origin.air.at)}`
                : "Oxygen, of no life's making",
            ],
          }
        : { tone: "shut", line: ["No free oxygen"] },
    ),
    row("🔬 Its small lives", (r) =>
      r.origin.small.length
        ? { tone: "have", line: [r.origin.small.map((s) => s.name).join(", ")] }
        : { tone: "shut", line: ["None"] },
    ),
  ];
  return [
    pick,
    {
      type: "sides",
      title: "How their life began",
      names: [[`${here.name} `, "(here)"], [other.name]],
      rows,
    },
    {
      type: "text",
      lines: [
        [`${other.name} is read from what it is made of, before anything of its history has run.`],
      ],
    },
  ];
}

// —— The pages ——————————————————————————————————————————————————————————————————————————

/** The home world's Life page (`world:life`); beside another (`lifewith:<universe>|<seed>`). */
export function lifePage(world: World, beside?: string): PageModel {
  const g = homePlanet(world).generated,
    fine = fineWorld(g),
    name = world.seed.text,
    r = { ...homeRead(g, name), g: fine as HomeWorld },
    universe = fine.prior === EARTHLIKE.name ? "earth" : "alien",
    [otherUniverse, seedWord] = (beside ?? "").split("|") as [string, string | undefined],
    asked = seedWord === undefined ? null : decodeURIComponent(seedWord).trim(),
    self = asked === name && otherUniverse === universe,
    other = asked && !self ? otherRead(otherUniverse, asked) : null,
    drop = r.lives
      ? dropOfWorld(fine, dawnSeaOf(fine), {
          title: "A drop of its first seas, under the glass",
          habitat: "sea",
          dawn: true,
        })
      : null,
    o = r.origin;
  return {
    ref: beside ? `lifewith:${beside}` : "world:life",
    kind: "life",
    icon: r.lives ? "🧫" : "🪨",
    title: r.lives ? "How life began here" : "Why nothing lives here",
    subtitle: [link("The home world", g.planet.ref)],
    color: null,
    place: null,
    stats: r.lives
      ? [
          stat("Began at", o.cradle ? cap(o.cradle.name) : "its first seas"),
          stat("First ran on", o.first ? o.first.name : "—"),
          stat(
            "Its air",
            o.air.oxygen
              ? o.air.at !== null
                ? `oxygen since ${ago(o.air.at)}`
                : "oxygen"
              : "no free oxygen",
          ),
        ]
      : [stat("Life", "none"), stat("Why", r.lifeless ?? "")],
    tabs: [
      { id: "dawn", name: "Its dawn", blocks: dawnBlocks(r) },
      { id: "trades", name: "What it runs on", blocks: tradeBlocks(r) },
      ...(drop
        ? [
            {
              id: "glass",
              name: "Under the glass",
              blocks: [drop as Block],
            },
          ]
        : []),
      ...(r.lives
        ? [
            { id: "stocks", name: "Its stocks", blocks: stockBlocks(fine) },
            { id: "roles", name: "Its roles", blocks: [roleBlock(fine)] },
          ]
        : []),
      {
        id: "beside",
        name: "Beside another",
        blocks: besideBlocks(r, universe, other, self, asked),
      },
    ],
    tab: beside ? "beside" : "dawn",
    followable: false,
    year: yearNow(world),
    every: 60000,
  };
}

/** Another world's Life page (`life:<a body's ref>`): of the home star's own, or of another's. */
export function lifeElsewherePage(world: World, ref: string): PageModel {
  const of = ref.slice("life:".length),
    g = homePlanet(world).generated;
  if (of === g.planet.ref) return lifePage(world);
  let origin: WorldOrigin, life, warmth: number, light: number, title: string, what: string;
  if (of.includes("/")) {
    const slash = of.lastIndexOf("/"),
      s = starByRef(world, of.slice(0, slash)),
      index = Number(of.slice(slash + 1));
    life = lifeOfWorld(world, s, index);
    origin = originOfWorld(world, s, index);
    warmth = origin.ground.celsius;
    light = origin.ground.light;
    title = "a world of another star";
    what = `A world of a ${spectral(s.spectral)}, ${celsius(warmth)}, its pull ${origin.ground.gravity.toFixed(2)} g`;
  } else {
    const body = g.system.bodies.find((b) => b.ref === of);
    if (!body) throw new Error(`no world ${of}`);
    life = lifeOfBody(world, body)!;
    origin = originOfBody(world, body)!;
    warmth = body.temperature;
    light = origin.ground.light;
    title = `${body.kind === "moon" ? "moon" : "world"} ${body.designation}`;
    what = `A ${body.kind} of the home star, ${celsius(warmth)}, its pull ${body.gravity.toFixed(2)} g`;
  }
  const lives = life.level !== "none" && life.level !== "chemistry",
    r: LifeRead = {
      name: title,
      origin,
      cells: life.cellsAgo !== null ? Math.round(life.cellsAgo * 1000) : null,
      bodies: life.bodiesAgo !== null ? Math.round(life.bodiesAgo * 1000) : null,
      what,
      lives,
      lifeless: lives ? null : life.because,
    },
    glass = lives ? elsewhereBlocks(life, { key: of, warmth, light, origin, lifeRef: ref }) : [];
  return {
    ref,
    kind: "life",
    icon: lives ? "🧫" : "🪨",
    title: lives ? `How life began on ${title}` : `Why nothing lives on ${title}`,
    subtitle: [link(cap(title), of)],
    color: null,
    place: null,
    stats: lives
      ? [
          stat("Began at", origin.cradle ? cap(origin.cradle.name) : "its seas"),
          stat("First ran on", origin.first ? origin.first.name : "—"),
          stat("Its air", origin.air.oxygen ? "oxygen" : "no free oxygen"),
        ]
      : [stat("Life", life.level === "chemistry" ? "the first chemistry, not yet alive" : "none")],
    tabs: [
      { id: "dawn", name: "Its dawn", blocks: dawnBlocks(r) },
      { id: "trades", name: "What it runs on", blocks: tradeBlocks(r) },
      ...(glass.length ? [{ id: "glass", name: "Under the glass", blocks: glass }] : []),
    ],
    tab: "dawn",
    followable: false,
    year: yearNow(world),
    every: 60000,
  };
}

/** What its first life ran on, in a few words, for the genesis (null: no life). */
export function originWords(
  g: HomeWorld,
): { title: string; words: string; cradle: string; first: string } | null {
  const fine = fineWorld(g),
    o = originOfHome(fine);
  if (!fine.life.species.length || !o.cradle || !o.first) return null;
  const t = TRADES[o.first.id],
    where: Record<string, string> = {
      vents: `Where hot water seeped from the young sea floor, rich in what the rock gave up, a skin closed about a few chemicals that could copy themselves`,
      pools: `In tide pools that the tides filled and the sun dried, again and again, what the sea held was gathered and joined, until a skin closed about a few chemicals that could copy themselves`,
      brine: `In veins of brine between the ice's crystals, where freezing drove what the ${o.ground.liquid} held together, a skin closed about a few chemicals that could copy themselves`,
      springs: `In hot springs on the bare land, on clays that held the chemistry together, a skin closed about a few chemicals that could copy themselves`,
      films: `In thin films on the shallows' minerals, where the star's light drove the chemistry, a skin closed about a few chemicals that could copy themselves`,
      haze: `Out of the haze its star's light made of its air, the stuff of life rained into its ${o.ground.liquid}, and there a skin closed about a few chemicals that could copy themselves`,
    };
  return {
    title: `The first cells: ${o.cradle.name}`,
    words: `${where[o.cradle.id]}. The first cells lived on ${t.name} (${t.reaction}): ${powerWords(o.first.power15)} a kilogram, ${o.first.power15 < 0.5 ? "a slow life" : "a quick one"}. They divided in two, and two again, until the ${o.ground.liquid} was full of them.`,
    cradle: o.cradle.name,
    first: t.name,
  };
}
