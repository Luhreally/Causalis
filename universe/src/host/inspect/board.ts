// A town's price board, what it is known for, and where a good is cheap and dear (Markets, first slice; Classic's 89 Markets and coin): the land's
// market as a person in the town would meet it. All of it is read: a land's prices, its year's books and its last five years, its ground, its town's
// own place on that ground. Nothing here is kept, and history moves no differently for anyone reading it. A market is a land's, so every town of a
// land reads one price for a good; what differs town by town is what it is known for, each from its own tile of its land.
import { priceWords } from "../../causal/index.ts";
import { BIOME, surfaceOre, worldChemistry, WATER } from "../../gen/index.ts";
import type { Block, BoardRow, Line, PageModel, Span, Stat, Tab } from "../../bridge/index.ts";
import type { Ref, World } from "../../kernel/index.ts";
import { COIN_A_UNIT, G, GOODS, roleWord } from "../../rules/index.ts";
import {
  loreOf,
  marketGoodRef,
  marketsOf,
  oreWithin,
  politiesOf,
  populationContext,
  realmName,
  regionOf,
  townsOf,
  warsOf,
  type Market,
} from "../../sim/index.ts";
import { flockOf, landClay, landCloth, landStone, landWood, makingTown, WOODS } from "../chain.ts";
import { breadCoin } from "../home.ts";
import { coinWords } from "./living.ts";
import { townLink } from "./names.ts";
import { count, item, link, many, sentence, stat, yearNow } from "./words.ts";
import { tradeItems } from "./wares.ts";
import { exchangeWay } from "./exchange.ts";

/** How each good is bought, by what a person would ask for: how much of a market's unit that is, and its words. */
type Measure = {
  readonly icon: string;
  /** "a loaf": what one is called, and two of it (for a people who swap). */
  readonly one: string;
  readonly many: string;
  /** A market's unit is this many of them. */
  readonly inUnit: number;
  readonly shelf: 0 | 1 | 2;
};
const MEASURES: Readonly<Record<string, Measure>> = {
  grain: { icon: "🌾", one: "a loaf", many: "loaves", inUnit: 30, shelf: 0 },
  meat: { icon: "🥩", one: "a day's meat", many: "days' meat", inUnit: 30, shelf: 0 },
  wild: { icon: "🧺", one: "a day's gathering", many: "days' gathering", inUnit: 30, shelf: 0 },
  wool: { icon: "🐑", one: "a fleece", many: "fleeces", inUnit: 1, shelf: 1 },
  hides: { icon: "🟫", one: "a hide", many: "hides", inUnit: 1, shelf: 1 },
  clothing: { icon: "🧥", one: "a suit of clothes", many: "suits of clothes", inUnit: 1, shelf: 1 },
  pottery: { icon: "🏺", one: "a pot", many: "pots", inUnit: 1, shelf: 1 },
  tools: { icon: "🔨", one: "a tool", many: "tools", inUnit: 1, shelf: 1 },
  copper: { icon: "🟠", one: "a bar", many: "bars", inUnit: 1, shelf: 2 },
  tin: { icon: "⚪", one: "a bar", many: "bars", inUnit: 1, shelf: 2 },
  iron: { icon: "⚙️", one: "a bar", many: "bars", inUnit: 1, shelf: 2 },
  coal: { icon: "⚫", one: "a sack", many: "sacks", inUnit: 1, shelf: 2 },
  oil: { icon: "🛢️", one: "a barrel", many: "barrels", inUnit: 1, shelf: 2 },
  machines: { icon: "🏭", one: "a machine", many: "machines", inUnit: 1, shelf: 2 },
};
const SHELVES = ["To eat", "To wear and use", "Metal, fuel and works"];

const undersea = (world: World): boolean => populationContext(world).medium === "water";

/** A good's measure where it is sold: a people of the water buys a day's food, not a loaf. */
function measureOf(world: World, good: number): Measure {
  const m = MEASURES[GOODS[good]!.id]!;
  if (good === G.grain && undersea(world)) return { ...m, one: "a day's food", many: "days' food" };
  return good === G.tin && goodName(world, good) === "arsenic"
    ? { ...m, one: "a measure", many: "measures" }
    : m;
}

/** A good's name on this world: what hardens its copper is its own, and goes by it. */
export function goodName(world: World, good: number): string {
  const g = GOODS[good]!;
  return g.id === "tin"
    ? roleWord(worldChemistry(populationContext(world).generated), "tin")
    : g.name;
}

/** Where a good is cheap and dear, as its page's title says it. */
export function dearTitle(name: string): string {
  return `Where ${name} ${name.endsWith("s") ? "are" : "is"} cheap and dear`;
}

/** What one measure of a good costs at a market, in coin: the one reading of a price (a home's things are reckoned the same; its bread is a loaf). */
export function goodCoin(world: World, price: number, good: number): number {
  return good === G.grain
    ? breadCoin(price)
    : (price * COIN_A_UNIT) / measureOf(world, good).inUnit;
}

/** Dear, cheap or usual, for the board's colour: the page's own words say the rest. */
function toneOf(ratio: number): BoardRow["tone"] {
  return ratio < 0.8 ? "cheap" : ratio <= 1.25 ? "usual" : "dear";
}

/** Whether the last years have seen a good's price go up, down or stay: from the books a market keeps, five years of them. */
export function trendOf(
  m: Market,
  good: number,
  year: number,
): { readonly arrow: string; readonly words: string; readonly from: number | null } {
  const y0 = m.years[0],
    was = y0?.price[good],
    now = m.price[good]!;
  if (!y0 || !was || was <= 0 || m.years.length < 2)
    return { arrow: "", words: "too new to say", from: null };
  const span = Math.max(1, year - y0.year),
    r = now / was,
    years = `in ${span === 1 ? "a year" : `${count(span)} years`}`;
  return r >= 1.08
    ? { arrow: "▲", words: `rising${r >= 1.9 ? `, near doubled ${years}` : ""}`, from: was }
    : r <= 0.92
      ? { arrow: "▼", words: `falling${r <= 0.55 ? `, near halved ${years}` : ""}`, from: was }
      : { arrow: "●", words: "steady", from: was };
}

/** Whether anyone anywhere in the world has any of a good: a thing no one has yet is no one's lack. */
function knownAnywhere(world: World, good: number): boolean {
  return marketsOf(world)
    .all()
    .some((m) => m.stock[good]! > 0 || m.book("made", good) > 0);
}

/** Whether a land's market has a good this year: in store, made, or brought in. */
function hasGood(m: Market, good: number): boolean {
  return m.stock[good]! > 0 || m.book("made", good) > 0 || m.book("in", good) > 0;
}

/** What a land's people reckon by where they keep no coin: their first food by how much they have of it. */
function staple(m: Market): number {
  let best: number = G.grain,
    most = -1;
  for (const g of [G.grain, G.wild, G.meat]) {
    const n = m.book("made", g) + m.stock[g]!;
    if (n > most) {
      most = n;
      best = g;
    }
  }
  return best;
}

/** A good's price as the board says it: coin to a people who keep it; else what a measure of it swaps for. */
function priceText(
  world: World,
  m: Market,
  good: number,
  coined: boolean,
  bartered: number,
): { readonly price: string; readonly coin: number } {
  const coin = goodCoin(world, m.price[good]!, good);
  if (!(coin > 0)) return { price: "no price", coin: 0 };
  if (coined) return { price: `${coinWords(coin)} coin`, coin };
  const of = measureOf(world, bartered);
  if (good === bartered) return { price: "what all is told in", coin };
  const by = coin / goodCoin(world, m.price[bartered]!, bartered),
    n = Math.max(1, Math.round(by));
  return { price: `buys ${count(n)} ${n === 1 ? of.one.replace(/^an? /, "") : of.many}`, coin };
}

export type TownBoard = {
  readonly cell: number;
  readonly town: string;
  readonly name: string;
  readonly coined: boolean;
  /** What the board's prices are told in, where they keep no coin. */
  readonly staple: string | null;
  readonly rows: readonly BoardRow[];
  /** Goods the world has and this market has not. */
  readonly lacks: readonly string[];
  readonly dear: number;
  readonly cheap: number;
};

/** A land's market as its board reads it (null: it has no market, or no one to keep it). */
export function boardOf(world: World, cell: number, town: string, name: string): TownBoard | null {
  const m = marketsOf(world).get(cell),
    p = populationContext(world).provinces.get(cell);
  if (!m || !p || p.total() <= 0) return null;
  const coined = !!loreOf(world).get(cell, "currency"),
    bartered = staple(m),
    year = yearNow(world),
    rows: BoardRow[] = [],
    lacks: string[] = [];
  let dear = 0,
    cheap = 0;
  GOODS.forEach((g, i) => {
    if (!hasGood(m, i)) {
      if (knownAnywhere(world, i)) lacks.push(goodName(world, i));
      return;
    }
    const ms = measureOf(world, i),
      ratio = m.price[i]! / g.value,
      t = trendOf(m, i, year),
      { price } = priceText(world, m, i, coined, bartered),
      priced = goodCoin(world, m.price[i]!, i) > 0,
      tone = priced ? toneOf(ratio) : "usual";
    if (tone === "dear") dear++;
    if (tone === "cheap") cheap++;
    rows.push({
      ref: marketGoodRef(cell, i),
      icon: ms.icon,
      name: sentence(goodName(world, i)),
      each: ms.one,
      price,
      tone,
      words: priced ? priceWords(ratio) : "not priced",
      arrow: priced ? t.arrow : "",
      trend: priced ? t.words : "",
      shelf: ms.shelf,
    });
  });
  return {
    cell,
    town,
    name,
    coined,
    staple: coined ? null : measureOf(world, bartered).many,
    rows: rows.sort((a, b) => a.shelf - b.shelf),
    lacks,
    dear,
    cheap,
  };
}

// —— What a town is known for ————————————————————————————————————————————————————————

/** One thing a town might be known for: what it is, how strongly it is the town's own, and the page that tells of it. */
type Claim = {
  readonly key: string;
  readonly score: number;
  readonly words: string;
  readonly ref: string | null;
};
/** What a town is known for, said: "its iron, from the hills above it". */
export type KnownFor = {
  readonly key: string;
  readonly words: string;
  readonly ref: string | null;
};

/** How a town lies on its land: its own tile's water, ground, soil and what lies near. */
type Site = {
  readonly sea: boolean;
  readonly river: boolean;
  readonly lake: boolean;
  /** How far the ground climbs near it, metres. */
  readonly rise: number;
  /** Its soil against its land's other towns, 0 the poorest to 1 the best. */
  soil: number;
  readonly fertility: number;
  readonly biome: number;
  readonly warm: boolean;
  /** The kinds of deposit within a short walk. */
  readonly near: ReadonlySet<string>;
  readonly civics: ReadonlySet<string>;
  readonly market: boolean;
};

function siteOf(
  world: World,
  s: { readonly ref: string; readonly cell: number; readonly tile: number },
  market: boolean,
): Site {
  const ctx = populationContext(world),
    r = regionOf(ctx, s.cell),
    deposits = ctx.generated.deposits,
    i0 = s.tile % r.size,
    j0 = Math.floor(s.tile / r.size),
    tile = Math.max(0, Math.min(r.size * r.size - 1, s.tile));
  let sea = false,
    river = false,
    lake = false,
    top = r.elevation[tile]!;
  for (let dj = -2; dj <= 2; dj++)
    for (let di = -2; di <= 2; di++) {
      const i = i0 + di,
        j = j0 + dj;
      if (i < 0 || j < 0 || i >= r.size || j >= r.size) continue;
      const t = j * r.size + i,
        w = r.water[t]!;
      if (Math.abs(di) <= 1 && Math.abs(dj) <= 1) {
        if (w === WATER.sea) sea = true;
        if (w === WATER.river) river = true;
        if (w === WATER.lake) lake = true;
      }
      if (r.elevation[t]! > top) top = r.elevation[t]!;
    }
  const near = new Set<string>();
  for (const d of r.deposits) {
    const i = d.tile % r.size,
      j = Math.floor(d.tile / r.size);
    if (Math.hypot(i - i0, j - j0) <= 6) {
      const kind = deposits[d.deposit]?.kind;
      if (kind) near.add(kind);
    }
  }
  const f = townsOf(world).get(s.ref as Ref),
    year = yearNow(world);
  return {
    sea,
    river,
    lake,
    rise: top - r.elevation[tile]!,
    soil: 0.5,
    fertility: r.fertility[tile]!,
    biome: r.biome[tile]!,
    warm: r.temperature[tile]! > 18,
    near,
    civics: new Set(
      (f?.civics ?? [])
        .filter((c) => c.end <= year && c.fell === null)
        .map((c) => c.kind as string),
    ),
    market,
  };
}

/** Each land's making set against the world's: a good's share of its land's worth, and how much more of it a head than the world makes. */
function worldMaking(world: World): { readonly head: readonly number[] } {
  const ctx = populationContext(world),
    made = new Array<number>(GOODS.length).fill(0);
  let people = 0;
  for (const p of ctx.provinces.all()) {
    const m = marketsOf(world).get(p.cell);
    if (!m) continue;
    people += p.total();
    for (let g = 0; g < GOODS.length; g++) made[g] = made[g]! + m.book("made", g);
  }
  return { head: made.map((n) => n / Math.max(1, people)) };
}

/** A good's standing in a land: how much more it makes of it a head than the world, tempered by how much of its land's making it is, more if it sends it away. */
function standing(
  m: Market,
  people: number,
  good: number,
  head: readonly number[],
  worth: number,
): number {
  const made = m.book("made", good),
    out = m.book("out", good);
  if (made <= 0 && out <= 0) return 0;
  const lq = made / Math.max(1, people) / Math.max(1e-9, head[good]!),
    part = (Math.max(made, out) * GOODS[good]!.value) / Math.max(1, worth);
  return (
    Math.sqrt(Math.min(40, Math.max(0.05, lq))) *
    Math.pow(Math.max(0.0005, part), 0.25) *
    (1 + Math.min(1, out / Math.max(1, made)))
  );
}

/** How a land's ore of a kind reaches this town, in its words. */
function oreFrom(lie: string, site: Site, kind: string, dug: boolean): string {
  if (site.near.has(kind)) return site.rise > 150 ? "from the hills above it" : "dug close by";
  switch (lie) {
    case "bog":
      return "dug from the bogs of its land";
    case "hill":
      return site.rise > 150 ? "from the hills above it" : "from its land's hills";
    case "vent":
      return "drawn from the vents of the sea floor";
    case "telluric":
      return "found in lumps upon the ground";
    case "surface":
      return "gathered where it shows on the ground";
    default:
      return dug ? "from its land's diggings" : "brought from a neighbour's hills";
  }
}

/** Everything a town could be known for, from its land's books and its own place on that land. */
function claimsOf(
  world: World,
  s: { readonly ref: string; readonly cell: number; readonly name: string },
  site: Site,
  head: readonly number[],
): Claim[] {
  const ctx = populationContext(world),
    cell = s.cell,
    m = marketsOf(world).get(cell)!,
    people = ctx.provinces.get(cell)?.total() ?? 0,
    lore = loreOf(world),
    water = ctx.medium === "water",
    worth = GOODS.reduce((n, g, i) => n + m.book("made", i) * g.value, 0),
    score = (g: number) => standing(m, people, g, head, worth),
    goodRef = (g: number) => marketGoodRef(cell, g),
    out: Claim[] = [],
    add = (key: string, n: number, words: string, ref: string | null) => {
      if (n > 0) out.push({ key, score: n, words, ref });
    };

  // Its ores, where its land works them.
  for (const [kind, g] of [
    ["copper", G.copper],
    ["tin", G.tin],
    ["iron", G.iron],
  ] as const) {
    const base = score(g);
    if (base <= 0) continue;
    const o = oreWithin(ctx, cell, kind),
      name = goodName(world, g),
      fit = site.near.has(kind) ? 3 : o?.lie === "hill" && site.rise > 150 ? 2.2 : 0.8,
      made = m.book("made", g) > 0;
    add(
      kind,
      base * fit,
      made
        ? `its ${name}, ${oreFrom(o?.lie ?? "", site, kind, o?.cell === cell)}`
        : `the ${name} it sends on`,
      goodRef(g),
    );
  }
  // Its seams.
  if (score(G.coal) > 0 && !water)
    add(
      "coal",
      score(G.coal) * (surfaceOre(ctx.generated, cell, "coal") ? 2.2 : 0.7),
      m.book("made", G.coal) > 0 ? `its coal, dug from the seam under it` : "the coal it sends on",
      goodRef(G.coal),
    );
  if (score(G.oil) > 0)
    add(
      "oil",
      score(G.oil) * 2.2,
      m.book("made", G.oil) > 0 ? `its oil, drawn from the field under it` : "the oil it sends on",
      goodRef(G.oil),
    );

  // What it grows and herds, by how its own ground lies.
  const grain = score(G.grain);
  if (grain > 0 && !water)
    add(
      "grain",
      grain * (site.soil >= 0.75 ? 1.9 : site.river ? 1.5 : 0.6),
      site.soil >= 0.9
        ? "its grain, from the best soil in its land"
        : site.river
          ? "its grain, grown along the river"
          : site.soil >= 0.75
            ? "its grain, from good black ground"
            : "its grain",
      goodRef(G.grain),
    );
  if (grain > 0 && water)
    add(
      "farms",
      grain * (site.soil >= 0.7 ? 1.7 : 0.7),
      site.soil >= 0.7 ? "the sea-farms of its richest water" : "its sea-farms",
      goodRef(G.grain),
    );
  const beast = !water && score(G.meat) + score(G.wool) > 0 ? flockOf(world, cell) : null;
  if (beast) {
    const hill = site.rise > 90;
    add(
      `flock:${beast.name}`,
      (score(G.meat) + score(G.wool)) * (hill ? 2 : 0.8),
      `its ${beast.name} flocks, ${hill ? "on the high ground above it" : "on the grass about it"}`,
      goodRef(G.wool),
    );
  }
  if (score(G.wool) > 0 && !water && beast)
    add(
      "wool",
      score(G.wool) * (site.civics.has("workshop") ? 2.4 : 0.9),
      `its ${landCloth(world, cell).name}`,
      goodRef(G.clothing),
    );
  if (score(G.hides) > 0) {
    const hunted = m.book("made", G.meat) <= 0;
    add(
      "hides",
      score(G.hides) * 0.7,
      water ? "its tanned skins" : hunted ? "the hides its hunters bring in" : "its leather",
      goodRef(G.hides),
    );
  }

  // The water it stands by.
  if (lore.get(cell, "fishing") || water) {
    const wild = Math.max(0.3, score(G.wild));
    if (water)
      add(
        site.warm ? "coral" : "kelp",
        wild * 1.2,
        site.warm
          ? "its coral, cut from the warm reefs about it"
          : "its kelp, from the cool shelves about it",
        goodRef(G.wild),
      );
    else if (site.sea) add("fish", wild * 3, "the fish market of the coast", goodRef(G.wild));
    else if (site.lake) add("lakefish", wild * 2.4, "its lake fish", goodRef(G.wild));
    else if (site.river) add("riverfish", wild * 1.2, "its river fish", goodRef(G.wild));
  }
  // Its ships.
  const across = marketsOf(world).seaPartners(cell).length;
  if (across && (site.sea || site.civics.has("docks")))
    add(
      "port",
      (site.civics.has("docks") ? 2.2 : 1.1) * (1 + across / 8),
      water
        ? `its sea-roads, which reach ${many(across, "far water", "far waters")}`
        : `its harbour, whose ships reach ${many(across, "coast", "coasts")}`,
      null,
    );

  // What it digs and fires, by the water and the ground.
  if (!water && (site.river || site.lake) && (score(G.pottery) > 0 || site.civics.has("kiln"))) {
    const clay = landClay(world, cell);
    add(
      "pots",
      Math.max(0.35, score(G.pottery)) * (site.civics.has("kiln") ? 3 : 1.8),
      `its ${clay.name.replace(/ clay$/, "")} pots, of clay from the ${site.river ? "riverbank" : "lakeshore"}`,
      goodRef(G.pottery),
    );
  }
  const wood = !water ? landWood(world, cell) : null,
    grown = WOODS[site.biome];
  if (wood && grown && WOODED.has(site.biome))
    add("wood", 0.5, `its ${grown[0]} timber, felled in the woods about it`, null);
  if (!water && site.rise > 200) {
    const { rock } = landStone(world, cell);
    add("stone", 0.42, `its ${rock.replace(/-/g, " ")}, quarried from the hills above it`, null);
  }

  // What it makes, at the buildings it has.
  const smithy = site.civics.has("smithy");
  if (smithy || site.market) {
    const n = score(G.tools);
    if (n > 0) add("tools", n * (smithy ? 2.2 : 1), `the tools of its smiths`, goodRef(G.tools));
  }
  if (site.civics.has("workshop") && score(G.clothing) > 0)
    add("cloth", score(G.clothing) * 2, `its ${landCloth(world, cell).name}`, goodRef(G.clothing));
  if (site.civics.has("factory") && score(G.machines) > 0)
    add("machines", score(G.machines) * 3, "the machines of its works", goodRef(G.machines));
  if (site.civics.has("station")) add("station", 0.8, "its railway yards", null);
  for (const [kind, words] of CIVIC_FAME) if (site.civics.has(kind)) add(kind, 0.55, words, null);

  // The market town: where its land's goods come to be sold, and what it sends away the most of.
  if (site.market) {
    let best = -1,
      most = 0;
    GOODS.forEach((g, i) => {
      const v = m.book("out", i) * g.value;
      if (v > most) {
        most = v;
        best = i;
      }
    });
    if (best >= 0) {
      const roads = new Set(
        marketsOf(world)
          .flowsOf([cell])
          .filter((f) => f.from === cell && f.good === best)
          .map((f) => f.to),
      ).size;
      add(
        `market:${GOODS[best]!.id}`,
        2.4,
        `its ${goodName(world, best)} market, sending ${goodName(world, best).endsWith("s") ? "them" : "it"} down ${roads === 1 ? "one road" : `${count(roads)} roads`}`,
        goodRef(best),
      );
    }
  }
  return out.sort((a, b) => b.score - a.score || (a.key < b.key ? -1 : 1));
}

/** Buildings a town is known for though they sell nothing. */
const CIVIC_FAME: readonly (readonly [string, string])[] = [
  ["academy", "its academy"],
  ["observatory", "its observatory"],
  ["baths", "its baths"],
  ["hospital", "its hospital"],
  ["temple", "its great temple"],
  ["minds", "its made minds"],
  ["vats", "the vats that feed it"],
  ["fusion", "its held flame"],
];

/** The biomes a town can be said to stand among woods in. */
const WOODED: ReadonlySet<number> = new Set([
  BIOME.borealForest,
  BIOME.temperateForest,
  BIOME.temperateRainforest,
  BIOME.tropicalDryForest,
  BIOME.tropicalRainforest,
]);

/** What each town of a land is known for: its best claims, each thing shared out so its land's towns do not all say one. */
export function knownInLand(world: World, cell: number): ReadonlyMap<string, readonly KnownFor[]> {
  const ctx = populationContext(world),
    towns = ctx.settlements.seenIn(cell),
    out = new Map<string, readonly KnownFor[]>(),
    m = marketsOf(world).get(cell),
    people = ctx.provinces.get(cell)?.total() ?? 0;
  if (!towns.length || !m || people <= 0) return out;
  const { head } = worldMaking(world),
    seat = makingTown(world, cell)?.ref,
    sites = towns.map((s) => ({ s, site: siteOf(world, s, s.ref === seat) })),
    bySoil = [...sites].sort((a, b) => a.site.fertility - b.site.fertility);
  bySoil.forEach((x, i) => (x.site.soil = bySoil.length > 1 ? i / (bySoil.length - 1) : 1));
  // (The market town first, then by size: the greater town takes what is most its land's own.)
  const order = [...sites].sort(
      (a, b) => Number(b.site.market) - Number(a.site.market) || b.s.population - a.s.population,
    ),
    taken = new Map<string, number>();
  for (const { s, site } of order) {
    const most = Math.max(2, Math.ceil(order.length / 6)),
      claims = claimsOf(world, s, site, head)
        .map((c) => {
          const had = taken.get(c.key) ?? 0;
          return { ...c, score: (c.score / (1 + had)) * (had >= most ? 0.02 : 1) };
        })
        .sort((a, b) => b.score - a.score || (a.key < b.key ? -1 : 1));
    const first = claims[0],
      second = claims.find(
        (c) =>
          first && c.key !== first.key && c.score >= first.score * 0.55 && c.words !== first.words,
      ),
      said = [first, second].filter((c): c is (typeof claims)[number] => !!c);
    for (const c of said) taken.set(c.key, (taken.get(c.key) ?? 0) + 1);
    out.set(
      s.ref,
      said.map((c) => ({ key: c.key, words: c.words, ref: c.ref })),
    );
  }
  return out;
}

/** What a town is known for (none: a land with no market, or a town no one lives in). */
export function knownFor(world: World, town: string): readonly KnownFor[] {
  const s = populationContext(world).settlements.get(town as Ref);
  return s ? (knownInLand(world, s.cell).get(town) ?? []) : [];
}

/** What a town is known for, as a line: each thing links to its good's page. */
export function knownLine(known: readonly KnownFor[]): Line {
  const line: Span[] = [];
  known.forEach((k, i) => {
    if (i) line.push(", and ");
    line.push(k.ref ? link(k.words, k.ref) : k.words);
  });
  return line;
}

// —— The pages ————————————————————————————————————————————————————————————————————

/** A thumb's line to another page, as a board's rows are. */
export function wayRow(icon: string, name: string, ref: string, each = ""): Block {
  return {
    type: "board",
    known: null,
    coin: null,
    note: null,
    shelves: [],
    rows: [
      {
        ref,
        icon,
        name,
        each,
        price: "",
        tone: "usual",
        words: "",
        arrow: "",
        trend: "",
        shelf: 0,
      },
    ],
  };
}

/** The page of a town's price board. */
export const boardRef = (town: string): string => `board:${town}`;
/** Where a good is cheap and dear, from a land (`dear:<cell>:<good>`). */
export const dearRef = (cell: number, good: number): string => `dear:${cell}:${good}`;

/** A sum against another, in words a person would say. */
export function timesWords(r: number): string {
  if (r < 1.12) return "about the same";
  if (r < 1.4) return "a little more";
  if (r < 1.75) return "half as much again";
  if (r < 2.4) return "twice that";
  if (r < 3.5) return "three times that";
  return `${count(Math.round(r))} times that`;
}

/** The war that has lately set a land's realm against another, and what its market's goods have done since, as its books can tell (five years; bread and tools, a hundred). */
function warLines(world: World, cell: number, m: Market): Line[] {
  const realm = politiesOf(world).of(cell);
  if (!realm) return [];
  const war = warsOf(world)
    .fighting(realm.ref)
    .filter((w) => w.ended === null)
    .sort((a, b) => b.declared - a.declared)[0];
  if (!war) return [];
  const foe = politiesOf(world).get(war.attacker === realm.ref ? war.defender : war.attacker),
    before = m.years.find((y) => y.year >= war.declared) ?? null,
    lines: Span[] = [
      "At war",
      ...(foe ? [" with ", link(realmName(foe), foe.ref)] : []),
      ` since year ${war.declared}.`,
    ];
  let best = -1,
    rise = 1.25;
  if (before && before.year <= war.declared + 1)
    GOODS.forEach((_, i) => {
      if (!hasGood(m, i)) return;
      const r = m.price[i]! / Math.max(1e-9, before.price[i]!);
      if (r > rise) {
        rise = r;
        best = i;
      }
    });
  if (best >= 0)
    lines.push(
      ` ${sentence(goodName(world, best))} has ${rise >= 1.9 ? "doubled" : "risen by a good part"} since it began.`,
    );
  return [lines];
}

/** A people's coin, said as what it buys: a coin is what it buys, not a number. */
function coinLine(world: World, m: Market): string {
  const bread = breadCoin(m.price[G.grain]!),
    food = measureOf(world, G.grain),
    loaf = food.one.replace(/^an? /, ""),
    n = 1 / bread;
  return n >= 1.05
    ? `A coin buys ${coinWords(n)} ${food.many} here this year: in a usual year, it buys one ${loaf}.`
    : n > 0.95
      ? `A coin buys ${food.one} here this year, as in a usual year.`
      : `A coin buys less than ${food.one} here this year: ${food.one} is ${coinWords(bread)} coin, and in a usual year it is one.`;
}

function gonePage(world: World, ref: string): PageModel {
  return {
    ref,
    kind: "goods",
    icon: "🏷️",
    title: "A market board",
    subtitle: ["Of a town now gone"],
    color: null,
    place: null,
    stats: [],
    tabs: [
      {
        id: "board",
        name: "The board",
        blocks: [{ type: "text", lines: [["Nothing stands there that is known."]] }],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}

/** The lands a board compares with: a realm's or the whole world's, those with markets, each with the town its market stands in. */
function landsOfScope(
  world: World,
  cells: readonly number[],
): { readonly cell: number; readonly name: string; readonly town: string | null }[] {
  return cells.flatMap((cell) => {
    const t = makingTown(world, cell);
    return t ? [{ cell, name: t.name, town: t.ref }] : [];
  });
}

type ScopeRead = {
  readonly sentenceWords: string;
  readonly rows: readonly BoardRow[];
  readonly more: number;
  readonly had: number;
  readonly lacking: number;
  readonly low: number;
  readonly high: number;
};

/** Where in these lands a good is cheap and dear. */
function dearIn(world: World, good: number, cells: readonly number[], here: number): ScopeRead {
  const ms = measureOf(world, good),
    food = measureOf(world, G.grain),
    unit = loreOf(world).get(here, "currency")
      ? "coin"
      : food.many === "loaves"
        ? "loaves' worth"
        : food.many,
    name = goodName(world, good),
    Name = sentence(name),
    plural = name.endsWith("s"),
    lands = landsOfScope(world, cells),
    markets = marketsOf(world),
    had: { cell: number; name: string; town: string | null; coin: number; ratio: number }[] = [],
    without: string[] = [];
  for (const l of lands) {
    const m = markets.get(l.cell);
    if (!m) continue;
    if (!hasGood(m, good)) {
      without.push(l.name);
      continue;
    }
    had.push({
      ...l,
      coin: goodCoin(world, m.price[good]!, good),
      ratio: m.price[good]! / GOODS[good]!.value,
    });
  }
  had.sort((a, b) => a.coin - b.coin || a.cell - b.cell);
  const lack = without.length
    ? ` ${plural ? "They" : "It"} cannot be had at ${without.slice(0, 2).join(" or ")}${without.length > 2 ? ` or ${count(without.length - 2)} more` : ""}.`
    : "";
  if (!had.length)
    return {
      sentenceWords: `No one here has any ${name}.`,
      rows: [],
      more: 0,
      had: 0,
      lacking: without.length,
      low: 0,
      high: 0,
    };
  const low = had[0]!,
    high = had.at(-1)!,
    at = (x: number) => `${coinWords(x)} ${unit} ${ms.one}`,
    r = high.coin / Math.max(1e-9, low.coin),
    words =
      had.length === 1
        ? `${Name} can be had only at ${low.name}, at ${at(low.coin)}.${lack}`
        : r < 1.06
          ? `${Name} ${plural ? "cost" : "costs"} about the same wherever ${plural ? "they are" : "it is"} had: ${at(low.coin)}.${lack}`
          : `${Name} ${plural ? "are" : "is"} cheapest at ${low.name}, at ${at(low.coin)}. At ${high.name} ${plural ? "they cost" : "it costs"} ${timesWords(r)}, ${coinWords(high.coin)} ${unit}.${lack}`,
    keep = r < 1.06 ? 3 : 11,
    picked = had.length <= keep * 2 ? had : [...had.slice(0, keep), ...had.slice(-keep)],
    rows: BoardRow[] = picked.map((x) => ({
      ref: x.town ? boardRef(x.town) : marketGoodRef(x.cell, good),
      icon: x.cell === here ? "📍" : "🏘️",
      name: x.name,
      each: x.cell === here ? "this market" : "",
      price: `${coinWords(x.coin)} ${unit}`,
      tone: toneOf(x.ratio),
      words: priceWords(x.ratio),
      arrow: "",
      trend: "",
      shelf: 0,
    }));
  return {
    sentenceWords: words,
    rows,
    more: had.length - picked.length,
    had: had.length,
    lacking: without.length,
    low: low.coin,
    high: high.coin,
  };
}

/** A realm's lands with a market, and the world's. */
function scopes(world: World, cell: number): { realm: readonly number[]; all: readonly number[] } {
  const ctx = populationContext(world),
    all = ctx.provinces
      .all()
      .filter((p) => p.total() > 0)
      .map((p) => p.cell),
    realm = politiesOf(world).of(cell),
    polities = politiesOf(world);
  return {
    realm: realm ? all.filter((c) => polities.of(c)?.ref === realm.ref) : [],
    all,
  };
}

/** Where a good is cheap and dear, in a realm or a world: a page a merchant would read. */
export function dearPage(world: World, ref: string): PageModel {
  const [, a, b] = ref.split(":"),
    cell = Number(a),
    good = Number(b),
    g = GOODS[good];
  if (!g || !Number.isInteger(cell)) return gonePage(world, ref);
  const name = goodName(world, good),
    { realm, all } = scopes(world, cell),
    owner = politiesOf(world).of(cell),
    tab = (id: string, tabName: string, cells: readonly number[], title: string): Tab => {
      const read = dearIn(world, good, cells, cell),
        blocks: Block[] = [
          { type: "text", lines: [[read.sentenceWords]] },
          ...(read.rows.length
            ? [
                {
                  type: "board" as const,
                  title,
                  known: null,
                  coin: null,
                  note: null,
                  shelves: [title],
                  rows: read.rows,
                  ...(read.more ? { more: read.more } : {}),
                },
              ]
            : []),
        ];
      return { id, name: tabName, blocks };
    },
    tabs: Tab[] = [
      ...(realm.length > 1
        ? [
            tab(
              "realm",
              "This realm",
              realm,
              `${sentence(name)} across ${owner ? realmName(owner) : "the realm"}`,
            ),
          ]
        : []),
      tab("world", "The whole world", all, `${sentence(name)} the world over`),
    ];
  return {
    ref,
    kind: "goods",
    icon: MEASURES[g.id]!.icon,
    title: dearTitle(name),
    subtitle: [link(`${sentence(name)} here`, marketGoodRef(cell, good))],
    color: null,
    place: null,
    stats: [],
    tabs,
    followable: false,
    year: yearNow(world),
  };
}

/** What a merchant would carry from this land: each good here, its cheapest and dearest across its realm (or its world, if the realm is only this land). */
function carryBlocks(world: World, cell: number, board: TownBoard): Block[] {
  const { realm, all } = scopes(world, cell),
    cells = realm.length > 1 ? realm : all;
  const items = board.rows.flatMap((row) => {
    const good = Number(row.ref.split(":").at(-1)),
      read = dearIn(world, good, cells, cell);
    if (read.had < 2) return [];
    return [
      {
        spread: read.high / Math.max(1e-9, read.low),
        item: item(read.sentenceWords, dearRef(cell, good)),
      },
    ];
  });
  items.sort((a, b) => b.spread - a.spread);
  return [
    {
      type: "list",
      title:
        realm.length > 1
          ? "Across its realm, the widest first"
          : "The world over, the widest first",
      items: items.map((x) => x.item),
    },
    {
      type: "text",
      lines: [
        [
          "This is why a merchant walks. Goods go down a road from where they are cheap to where they are dear, as far as carriers can take them, and no further than the road pays.",
        ],
      ],
    },
  ];
}

/** A town's market board: what is for sale there this year, and what it is known for. */
export function boardPage(world: World, ref: string): PageModel {
  const town = ref.slice("board:".length),
    ctx = populationContext(world),
    s = ctx.settlements.get(town as Ref);
  if (!s) return gonePage(world, ref);
  const year = yearNow(world),
    m = marketsOf(world).get(s.cell),
    people = ctx.provinces.get(s.cell)?.total() ?? 0,
    seat = makingTown(world, s.cell),
    board = s.population > 0 ? boardOf(world, s.cell, s.ref, s.name) : null,
    known = s.population > 0 ? knownFor(world, s.ref) : [],
    mine = seat?.ref === s.ref,
    notes: Line[] = [];
  if (m && board) {
    if (!mine && seat)
      notes.push([
        "No market of its own: its land's goods are sold at ",
        link(`the board of ${seat.name}`, boardRef(seat.ref)),
        `, and these are ${seat.name}'s prices.`,
      ]);
    notes.push(...warLines(world, s.cell, m));
    if (board.lacks.length)
      notes.push([
        `Not to be had here: ${board.lacks.slice(0, 5).join(", ")}${board.lacks.length > 5 ? `, and ${count(board.lacks.length - 5)} more` : ""}.`,
      ]);
    if (!m.years.length)
      notes.push([
        "These are the first prices anyone here has asked: no year's trade is yet told.",
      ]);
  }
  const empty: Line =
      s.population <= 0
        ? seat && seat.ref !== s.ref
          ? [
              `Nothing is bought or sold in ${s.name} now: no one is left. Its land's market stands at `,
              link(seat.name, boardRef(seat.ref)),
              ".",
            ]
          : [`Nothing is bought or sold in ${s.name} now: no one is left.`]
        : !m || people <= 0
          ? [`Nothing is bought or sold in ${s.name} yet: what its people have, they share.`]
          : [
              `Nothing is bought or sold in ${s.name} yet: its people have little to spare, and what they have, they share.`,
            ],
    rows = board?.rows ?? [],
    coin: Line | null =
      !m || !board
        ? null
        : board.coined
          ? [coinLine(world, m)]
          : [
              `They keep no coin here: goods change hands for one another, and all of it is told in ${board.staple}.`,
            ],
    // (What its land sends away, said as the things themselves, each with its picture.)
    sends = m && board ? tradeItems(world, s.cell, "out", 2) : null,
    realm = politiesOf(world).of(s.cell),
    head: Block = {
      type: "board",
      title: `Year ${year}${realm ? `, in ${realmName(realm)}` : ""}`,
      known: known.length ? ["Known for ", ...knownLine(known), "."] : null,
      coin,
      note: null,
      shelves: SHELVES,
      rows,
    },
    built = townsOf(world)
      .get(s.ref as Ref)
      ?.civics.find((c) => c.kind === "market" && c.fell === null),
    // (At its realm's seat, late in a world: the way to its exchange.)
    exchange = realm && realm.seat === s.cell && mine ? exchangeWay(world, realm.ref) : null,
    tabs: Tab[] = [
      {
        id: "board",
        name: "The board",
        blocks: [
          head,
          ...(rows.length ? [] : [{ type: "text" as const, lines: [empty] }]),
          ...(notes.length ? [{ type: "text" as const, lines: notes }] : []),
          ...(sends
            ? [
                {
                  type: "list" as const,
                  title: "Its land sends away",
                  items: sends.items,
                  ...(sends.more ? { more: sends.more } : {}),
                },
              ]
            : []),
          {
            type: "text",
            lines: [
              [
                "The price is its land's, year by year, as its market set it. Press a line for what it is and who made it.",
                ...(built
                  ? [" ", link("The market hall", `bldg:${s.ref}:${built.at}:${built.start}`), "."]
                  : []),
              ],
            ],
          },
          ...(exchange ? [exchange] : []),
        ],
      },
    ];
  if (board && rows.length)
    tabs.push({ id: "carry", name: "Where it is dear", blocks: carryBlocks(world, s.cell, board) });
  return {
    ref,
    kind: "goods",
    icon: "🏷️",
    title: `The market board of ${s.name}`,
    subtitle: [townLink(world, s.ref), mine ? ", its land's market town" : ""],
    color: null,
    place: null,
    stats: [],
    tabs,
    followable: false,
    year,
  };
}

/** What a good costs at a land's market, for its page: the board's own words. */
export function goodCostRows(world: World, cell: number, good: number): readonly Stat[] {
  const m = marketsOf(world).get(cell),
    p = populationContext(world).provinces.get(cell);
  if (!m || !p || p.total() <= 0) return [];
  const coined = !!loreOf(world).get(cell, "currency"),
    { price } = priceText(world, m, good, coined, staple(m)),
    ms = measureOf(world, good),
    t = trendOf(m, good, yearNow(world));
  return [
    stat(
      "It costs",
      price === "what all is told in"
        ? `${ms.one} is what all is told in`
        : coined
          ? `${price} ${ms.one}`
          : `${ms.one} ${price}`,
    ),
    stat("Of late", t.words === "too new to say" ? t.words : `${t.arrow} ${t.words}`),
  ];
}
