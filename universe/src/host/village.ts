// The microscope's plan of a village (docs/architecture §9, watch mode): the
// families met there — meeting more if few are known, which is the observer's own
// act and never history's — and where their village stands: its homes, its
// fields toward the better ground, its pasture, the wild beyond, the square or the
// market at its heart, the road out — and what lives about it: the land's wild beasts,
// its hunters and its flocks (Phase 8 M77). Everything here is looked at, not lived: the
// people's day is drawn from this plan by the view, and nothing flows back.
import { YEAR, finish, hashString, mix, type Ref, type World } from "../kernel/index.ts";
import type { Feast } from "../bridge/index.ts";
import {
  WATER,
  cellRef,
  cradleTongue,
  livingIn,
  personName,
  tongueName,
  tonguePersonName,
  type Species,
} from "../gen/index.ts";
import { G, GOODS, HOME_LIFE, OCC, article, roofPitch } from "../rules/index.ts";
import {
  actsOf,
  agentName,
  beliefOf,
  BLOCK_M,
  blockAt,
  BLOCKS,
  citiesOf,
  cultureOf,
  designsOf,
  grainLost,
  handOf,
  heatYield,
  healthOf,
  homePlanet,
  houseFor,
  lifeOf,
  loreOf,
  marketsOf,
  orderOf,
  politiesOf,
  populationContext,
  PROVINCE_TILE_KM,
  REGION_SIZE,
  realmName,
  regionOf,
  tameNow,
  toolMetal,
  USE,
  warsOf,
  wildsOf,
} from "../sim/index.ts";
import { landWords, meetHousehold, observer, settleAll } from "../causal/index.ts";
import { personThings } from "./inspect/things.ts";
import {
  LAKE_R,
  LOT,
  WATER_OUT,
  heartTown,
  lotStates,
  progress,
  townLots,
  townReach,
  type StoreBook,
  type TownPlan,
  type TownStores,
  type TownTrade,
  type TownWater,
  type TradeGood,
  type FieldYear,
  type VillageLife,
  type VillagePlan,
  type VillageRest,
  type Visitor,
  type Wonder,
} from "../bridge/index.ts";
import { townPlan } from "./town.ts";
import { realmColor } from "./colors.ts";
import { hostKinds } from "./arms.ts";
import { visitorsAt } from "./peoples.ts";
import { makerAt, seatsOf, workshopOf } from "./chain.ts";
import { peopleFigure } from "./folk.ts";

/** Families the microscope watches in a village: a presentation budget, not a rule. */
export const WATCHED_FAMILIES = 10;
/** Under the hand, at most this many of the village's people are drawn (all of them live). */
export const DRAWN_UNDER_HAND = 400;
/**
 * One of a town's people drawn for every so many of them (Phase 39 M198; a crowd sized to its town,
 * M202), as the eye is given.
 */
export const FOLK_PER = 12;
/** What the town's other people are called, by their work. */
const FOLK_WORDS = [
  "A child",
  "A forager",
  "A farmer",
  "A herder",
  "A crafter",
  "A trader",
  "An elder",
];

const u = (seed: number, n: number) => finish(mix(seed, n), 13) / 4294967296;

/** The people's body, as their figures are drawn from it, with what their look is made of (null: upright apes, as ever). */
export function peopleBody(world: World): VillagePlan["body"] {
  return peopleFigure(populationContext(world).generated);
}

/** How far a land has come, for what its people wear, carry and dig with. */
export function landEra(world: World, cell: number): NonNullable<VillagePlan["era"]> {
  // (Sowing is the land's own knowing; smelting shows in its market too.)
  const ctx = populationContext(world),
    lore = loreOf(world),
    knows = (id: string) => !!lore.get(cell, id),
    land = ctx.provinces.get(cell);
  return knows("electricity") || knows("sea-electricity")
    ? "modern"
    : knows("steam-engine")
      ? "industry"
      : knows("metalworking") || !!marketsOf(world).get(cell)?.metalworking
        ? "metal"
        : land?.knowsCultivation || knows("cultivation")
          ? "farm"
          : "forage";
}

/** A land's house design: the one its people realized, or the one they would. */
export function landHouse(world: World, cell: number): VillagePlan["house"] {
  const ctx = populationContext(world),
    design = designsOf(world).of(ctx.provinces.get(cell)!.ref),
    parts = design?.parts ?? houseFor(ctx, cell),
    part = (role: string) => parts.find((p) => p.role === role)?.id ?? "",
    roof = part("roof");
  return {
    walls: part("walls"),
    roof,
    form: part("form"),
    pitch: roofPitch(roof, ctx.generated.climate.precipitation[cell]!),
    design: design?.ref ?? null,
  };
}

/** The eight ways out of a settlement's tile of its land: how good the ground is each way, and whether it is water. */
function waysOut(
  world: World,
  cell: number,
  tile: number,
): { angle: number; soil: number; water: boolean }[] {
  const r = regionOf(populationContext(world), cell),
    i0 = tile % r.size,
    j0 = Math.floor(tile / r.size),
    ways: { angle: number; soil: number; water: boolean }[] = [];
  for (let k = 0; k < 8; k++) {
    const angle = (k / 8) * 2 * Math.PI,
      i = Math.round(i0 + Math.cos(angle)),
      j = Math.round(j0 + Math.sin(angle));
    if (i < 0 || j < 0 || i >= r.size || j >= r.size) continue;
    const t = j * r.size + i,
      w = r.water[t]!;
    ways.push({ angle, soil: w === WATER.land ? r.fertility[t]! : 0, water: w !== WATER.land });
  }
  return ways;
}

/**
 * Where a town's streets run and the water its blocks are laid about, as its own streets are
 * drawn (Phase 25: the land draws it the same): a city's along its axis, a village's along its
 * road out, between its fields and the poorer ground; its water the first way out that is water.
 */
export function townSite(world: World, ref: Ref): { axis: number; water: TownWater | null } | null {
  const v = populationContext(world).settlements.get(ref);
  if (!v) return null;
  const ways = waysOut(world, v.cell, v.tile),
    city = citiesOf(world).get(ref),
    best = [...ways].sort((a, b) => b.soil - a.soil || a.angle - b.angle),
    fieldWay = best[0]?.angle ?? 0,
    waterWay = ways.find((w) => w.water)?.angle ?? null;
  return {
    axis: city ? city.axis : fieldWay + Math.PI * 0.75,
    water:
      waterWay === null
        ? null
        : { x: WATER_OUT * Math.cos(waterWay), z: WATER_OUT * Math.sin(waterWay), r: LAKE_R },
  };
}

/**
 * A land's heart (Phase 40 M204): the town the battles for the land are fought before and its
 * sieges laid about, as its land's map draws them (bridge/wars heartTown, its towns where its map
 * has them); null where no town of it is peopled.
 */
export function landHeart(world: World, cell: number): Ref | null {
  const half = ((REGION_SIZE - 1) * PROVINCE_TILE_KM) / 2;
  return (
    heartTown(
      populationContext(world)
        .settlements.inProvince(cell)
        .filter((s) => s.population > 0)
        .map((s) => ({
          ref: s.ref,
          population: s.population,
          x: (s.tile % REGION_SIZE) * PROVINCE_TILE_KM - half,
          z: Math.floor(s.tile / REGION_SIZE) * PROVINCE_TILE_KM - half,
        })),
    )?.ref ?? null
  );
}

export function villagePlan(
  world: World,
  ref: Ref,
  families = WATCHED_FAMILIES,
  folk = 0,
): VillagePlan {
  const ctx = populationContext(world),
    v = ctx.settlements.get(ref);
  if (!v) throw new Error(`no village ${ref}`);
  settleAll(world);
  const ledger = observer(world);
  const known = () => ledger.allHouseholds().filter((h) => h.village === ref);
  for (let tries = 0; known().length < families && tries < families * 2; tries++) {
    try {
      meetHousehold(world, v.cell, ref);
    } catch {
      break;
    }
  }
  const seed = hashString(`village ${ref}`),
    now = Math.floor(world.now / (365 * 86400));

  // Which way the good ground lies: fields go toward it, flocks away from it.
  const r = regionOf(ctx, v.cell),
    ways = waysOut(world, v.cell, v.tile);
  const city = citiesOf(world).get(ref),
    best = [...ways].sort((a, b) => b.soil - a.soil || a.angle - b.angle),
    fieldWay = best[0]?.angle ?? 0,
    // (A village's road leaves between the fields and the poorer ground; a city's runs
    // through it along its axis, both ways. The flocks and the works keep off it.)
    roadWay = city ? city.axis : fieldWay + Math.PI * 0.75,
    apart = (a: number, b: number) =>
      Math.abs(((((a - b) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI),
    offRoad = (a: number) =>
      city ? Math.min(apart(a, roadWay), apart(a, roadWay + Math.PI)) : apart(a, roadWay),
    poorWay = best.at(-1)?.angle ?? Math.PI,
    turn = apart(poorWay + 0.9, fieldWay) > apart(poorWay - 0.9, fieldWay) ? 0.9 : -0.9,
    pastureToward = offRoad(poorWay) < 0.7 ? poorWay + turn : poorWay,
    waterWay = ways.find((w) => w.water)?.angle ?? null;

  // Homes for everyone, the watched among them; five to a home. A city's homes stand
  // in its housing quarters; a village's around its square.
  const homes: { x: number; z: number; yaw: number; household: string | null }[] = [],
    count = Math.max(4, Math.min(160, Math.ceil(v.population / 5))),
    phase = u(seed, 1) * 2 * Math.PI;
  // A town built lot by lot (Phase 23): its people live in its own homes, the standing ones
  // nearest its square; its quarters and its ring of homes are drawn no more.
  // (Lots drawn as the device can bear, by the families it meets: two thousand to sixteen.)
  // (Laid about its water, never in it.)
  const lake =
      waterWay === null
        ? null
        : { x: WATER_OUT * Math.cos(waterWay), z: WATER_OUT * Math.sin(waterWay), r: LAKE_R },
    town = townPlan(world, ref, city ? city.axis : roadWay, families * families * 80, lake),
    lots = town ? townLots(town.family, town.seed, town.axis, town.lots, town.water) : null;
  if (town && lots) {
    const states = lotStates(town);
    for (let p = 0; p < town.lots && homes.length < count; p++)
      if (
        states.what[p] === LOT.home &&
        progress(states.began[p]!, states.takes[p]!, world.now) >= 1
      )
        homes.push({ x: lots.x[p]!, z: lots.z[p]!, yaw: lots.yaw[p]!, household: null });
  }
  const fabric = homes.length >= 4;
  if (!fabric) homes.length = 0;
  if (city && !fabric) {
    const perBlock = [0, 3, 6, 0, 0, 0];
    city.uses.forEach((use, k) => {
      const at = blockAt(k % BLOCKS, Math.floor(k / BLOCKS));
      for (let h = 0; h < perBlock[use]! && homes.length < 160; h++)
        homes.push({
          x: at.x + (u(seed, 3000 + k * 8 + h) - 0.5) * BLOCK_M * 0.8,
          z: at.z + (u(seed, 5000 + k * 8 + h) - 0.5) * BLOCK_M * 0.8,
          yaw: city.axis + (h % 2 ? Math.PI / 2 : 0),
          household: null,
        });
    });
    // A young city with few housing blocks yet builds on its open ground, nearest
    // the middle first — never on its temple, markets or workshops.
    const wanted = Math.min(count, WATCHED_FAMILIES * 2 + 4),
      open = city.uses
        .map((use, k) => ({ use, k, at: blockAt(k % BLOCKS, Math.floor(k / BLOCKS)) }))
        .filter((b) => b.use === USE.open)
        .sort(
          (a, b) =>
            a.at.x * a.at.x + a.at.z * a.at.z - (b.at.x * b.at.x + b.at.z * b.at.z) || a.k - b.k,
        );
    for (const b of open)
      for (let h = 0; h < 3 && homes.length < wanted; h++)
        homes.push({
          x: b.at.x + (u(seed, 7000 + b.k * 8 + h) - 0.5) * BLOCK_M * 0.8,
          z: b.at.z + (u(seed, 9000 + b.k * 8 + h) - 0.5) * BLOCK_M * 0.8,
          yaw: city.axis + (h % 2 ? Math.PI / 2 : 0),
          household: null,
        });
  }
  // (A city with no ground left to build on at all houses its people just outside its grid.)
  for (let k = 0; city && !fabric && homes.length < 4; k++) {
    const a = phase + k * 2.399963,
      rad = (BLOCKS * BLOCK_M) / 2 + 30;
    homes.push({ x: rad * Math.cos(a), z: rad * Math.sin(a), yaw: a, household: null });
  }
  // A village's homes circle its square.
  const wanted = city || fabric ? 0 : count;
  for (let k = 0; homes.length < wanted && k < 400; k++) {
    const a = phase + k * 2.399963,
      rad = 16 + 8.5 * Math.sqrt(k);
    homes.push({
      x: rad * Math.cos(a),
      z: rad * Math.sin(a),
      yaw: a + u(seed, 10 + k) * 0.6,
      household: null,
    });
  }
  // Fields in a fan toward the good ground, beyond the homes.
  const fields: { x: number; z: number; w: number; d: number; yaw: number }[] = [],
    // Fields begin beyond the homes (beyond a city's quarters).
    edge =
      fabric && lots && town
        ? Math.min(2600, townReach(lots) * Math.sqrt(town.whole / Math.max(1, town.lots))) + 30
        : city
          ? (BLOCKS * BLOCK_M) / 2 + 60
          : 16 + 8.5 * Math.sqrt(count) + 30,
    fieldCount = Math.max(6, Math.min(90, Math.round(count * 0.7)));
  for (let k = 0; k < fieldCount; k++) {
    const ring = Math.floor(k / 12),
      a = fieldWay + (((k % 12) - 5.5) / 12) * 2.6 + (u(seed, 400 + k) - 0.5) * 0.15,
      rad = edge + 40 + ring * 45 + u(seed, 500 + k) * 12;
    fields.push({
      x: rad * Math.cos(a),
      z: rad * Math.sin(a),
      w: 34 + 10 * u(seed, 600 + k),
      d: 22 + 8 * u(seed, 700 + k),
      yaw: a,
    });
  }
  // The pasture lies toward the poorer ground, near the homes where that is clear of the
  // fields' fan (else just past them); the wild begins beyond the last fields.
  const outer = fields.reduce(
      (m, f) => Math.max(m, Math.hypot(f.x, f.z) + Math.max(f.w, f.d) / 2),
      edge,
    ),
    pastureR = 90,
    pastureOut = (way: number) =>
      apart(way, fieldWay) > 1.9 ? edge + pastureR + 20 : outer + pastureR + 15,
    // (Never in the water: turned from it, a step at a time, if that is where it would lie.)
    dry = (way: number) =>
      waterWay === null ||
      Math.hypot(
        pastureOut(way) * Math.cos(way) - WATER_OUT * Math.cos(waterWay),
        pastureOut(way) * Math.sin(way) - WATER_OUT * Math.sin(waterWay),
      ) >
        LAKE_R + pastureR + 30,
    pastureWay =
      [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, 2.4, -2.4]
        .map((t) => pastureToward + t)
        .find((w) => dry(w) && (w === pastureToward || offRoad(w) > 0.7)) ?? pastureToward,
    pastureAt = pastureOut(pastureWay),
    wildAt = Math.round(outer + 60);
  const watched = known().sort((a, b) => a.seq - b.seq),
    people: VillagePlan["people"][number][] = [],
    hand = handOf(world).resting;
  if (hand && hand.village === ref) {
    // Under the hand, everyone in the village is someone: the hand's own people, five to a home.
    // Every k-th, so the sample is spread through the village's people.
    const every = Math.max(1, Math.ceil(hand.agents.length / DRAWN_UNDER_HAND));
    hand.agents
      .filter((_, i) => i % every === 0)
      .forEach((a, k) => {
        const home = Math.min(homes.length - 1, Math.floor(k / 5));
        homes[home]!.household = `home:${home}`;
        people.push({
          ref: `agent:${a.id}`,
          name: agentName(ctx, a, v),
          home,
          age: now - a.birthYear,
          occupation: a.occupation,
          child: now - a.birthYear < lifeOf(world).adulthood,
        });
      });
    return planOf(people);
  }
  watched.forEach((hh, k) => {
    // The watched live toward the middle, where the microscope looks.
    const home = Math.min(homes.length - 1, k * 2 + (k % 2));
    homes[home]!.household = hh.ref;
    for (const m of hh.members) {
      const p = ledger.person(m)!;
      if (!p.alive || p.village !== ref) continue;
      // (The tool they carry is their own: made where, when and of what: Phase 15 M125.)
      const tool = personThings(world, p).find((t) => t.good === "tools" && t.made !== null);
      people.push({
        ref: p.ref,
        name: `${p.name} ${p.surname}`,
        home,
        age: now - p.birthYear,
        occupation: p.occupation,
        child: now - p.birthYear < lifeOf(world).adulthood,
        ...(tool ? { tool: `${tool.name}, made in year ${tool.made}` } : {}),
      });
    }
  });
  // The town's other people (Phase 39 M198): as many more as a town of its size is seen to hold —
  // one drawn for every twelve of it, up to what the eye is given — each at the work its land
  // does (builders as many as what it raises at once wants), living in the homes the watched do
  // not. Not met, and never history's: nothing they do flows back.
  const more = Math.min(folk, Math.max(0, Math.ceil(v.population / FOLK_PER) - people.length));
  if (more > 0) {
    const land = ctx.provinces.get(v.cell),
      kinds = [OCC.forager, OCC.farmer, OCC.herder, OCC.crafter, OCC.trader, OCC.leader],
      counts = kinds.map((o) => land?.occupation(o) ?? 0),
      total = counts.reduce((a, b) => a + b, 0),
      builders = Math.min(Math.round(more * 0.4), 2 * risingAt(town, world.now)),
      taken = new Set(people.map((p) => p.home)),
      free = homes.map((_, i) => i).filter((i) => !taken.has(i)),
      homesFor = free.length ? free : homes.map((_, i) => i);
    // Each named in its land's tongue, a family's name to each home (Phase 50 M212): the smith at
    // the forge someone in particular, as the pages of its buildings and of the things its people
    // hold name them.
    const tongue = cultureOf(world).get(v.cell)?.tongue,
      family = tongue ?? cradleTongue(ctx.culture),
      familyOf = (home: number) =>
        tongueName({ ...family, seed: family.seed ^ 0xf00d }, hashString(`${ref} home ${home}`)),
      given = (key: number, sex: number) =>
        tongue ? tonguePersonName(tongue, key, sex) : personName(ctx.culture, key, sex);
    for (let k = 0; k < more; k++) {
      const key = hashString(`folk ${ref} ${k}`),
        child = u(key, 1) < 0.18;
      let occupation: number = OCC.farmer;
      if (child) occupation = OCC.dependent;
      else if (k < builders) occupation = OCC.crafter;
      else if (total > 0) {
        let pick = u(key, 2) * total;
        for (let j = 0; j < kinds.length; j++) {
          pick -= counts[j]!;
          if (pick < 0) {
            occupation = kinds[j]!;
            break;
          }
        }
      }
      const home = homesFor[Math.floor(k / 4) % homesFor.length]!;
      people.push({
        ref: `folk:${ref}:${k}`,
        name: `${given(key, (key >>> 5) & 1)} ${familyOf(home)}`,
        role: `${(FOLK_WORDS[occupation] ?? "One").toLowerCase()} of ${v.name}`,
        home,
        age: child ? 4 + Math.floor(u(key, 3) * 10) : 17 + Math.floor(u(key, 3) * 42),
        occupation,
        child,
        folk: true,
      });
    }
    // Its makers kept at their trades (Phase 50 M212): of its grown crafters not raising its
    // buildings, as many as it keeps seats at each trade it has a place for — the forge where its
    // land works metal, its kilns, its workshops — each the maker its buildings' pages name.
    const crafting = people.filter(
        (p) =>
          p.folk &&
          p.occupation === OCC.crafter &&
          !p.child &&
          Number(p.ref.slice(p.ref.lastIndexOf(":") + 1)) >= builders,
      ),
      trades = (["smith", "potter", "weaver"] as const).filter((kind) =>
        kind === "smith"
          ? toolMetal(ctx, v.cell) !== "stone" || !!workshopOf(world, ref, ["smithy"], now)
          : !!workshopOf(world, ref, [kind === "potter" ? "kiln" : "workshop"], now),
      );
    let next = 0;
    for (const kind of trades) {
      const seats = Math.min(seatsOf(v), Math.floor(crafting.length / trades.length));
      for (let seat = 0; seat < seats && next < crafting.length; seat++) {
        const p = crafting[next++]!,
          m = makerAt(world, v.cell, v, kind, seat, now);
        people[people.indexOf(p)] = {
          ...p,
          name: m.name,
          role: `${article(kind)} ${kind} of ${v.name}`,
          trade: { kind, seat, years: m.years },
          age: Math.max(p.age, 16 + m.years),
        };
      }
    }
  }
  return planOf(people);

  /**
   * What the town holds in store and how it flows (Phase 39 M198): its share of its land's stocks,
   * and of its land's books for the year past, by its share of the land's people.
   */
  function storesOf(cell: number, population: number): TownStores | undefined {
    const m = marketsOf(world).get(cell),
      all = ctx.provinces.get(cell)?.total() ?? 0;
    if (!m || all <= 0) return undefined;
    const share = Math.min(1, population / all),
      books = m.years.at(-1)?.ledger,
      line = (l: number, g: number) => books?.[l]?.[g] ?? 0,
      // (In: made, bought in, carried in; out: used, sold away, spoiled, carried out.)
      made = (g: number) => line(0, g) + line(2, g) + line(5, g),
      used = (g: number) => line(1, g) + line(3, g) + line(4, g) + line(6, g),
      book = (f: (g: number) => number): StoreBook => ({
        grain: f(G.grain) * share,
        food: (f(G.meat) + f(G.wild)) * share,
        wood: 0,
        stone: 0,
        ore: (f(G.copper) + f(G.coal)) * share,
        tools: f(G.tools) * share,
      });
    return {
      t: world.now,
      have: book((g) => m.stock[g] ?? 0),
      made: book(made),
      used: book(used),
    };
  }

  /**
   * What the town's land traded last year (Phase 48 M210), at the town's share by its people: the
   * goods its carriers took out and where to, and what came in and where from — each land named
   * by its market town (else its greatest), the most first, a few each way.
   */
  function tradeOf(cell: number, population: number): TownTrade | undefined {
    const markets = marketsOf(world),
      all = ctx.provinces.get(cell)?.total() ?? 0;
    if (all <= 0 || !markets.flows.length) return undefined;
    const share = Math.min(1, population / all),
      named = (c: number) => {
        const towns = ctx.settlements.inProvince(c).filter((x) => x.population > 0),
          best =
            towns.find((x) => x.market !== null) ??
            [...towns].sort((a, b) => b.population - a.population)[0];
        return best?.name ?? landWords(world, cellRef(0, c));
      },
      goods = (other: (f: (typeof markets.flows)[number]) => number | null): TradeGood[] => {
        const by = new Map<string, TradeGood>();
        for (const f of markets.flows) {
          const c = other(f),
            g = GOODS[f.good];
          if (c === null || !g) continue;
          const land = named(c),
            key = `${g.id} ${land}`,
            was = by.get(key);
          by.set(key, {
            good: g.id,
            what: TRADE_WORDS[g.id] ?? g.name,
            land,
            count: (was?.count ?? 0) + f.count * share,
          });
        }
        return [...by.values()]
          .filter((x) => x.count >= 0.5)
          .sort((a, b) => b.count - a.count || (a.land < b.land ? -1 : a.land > b.land ? 1 : 0))
          .slice(0, 4);
      },
      out = goods((f) => (f.from === cell ? f.to : null)),
      came = goods((f) => (f.to === cell ? f.from : null));
    return out.length || came.length ? { out, in: came } : undefined;
  }

  /**
   * How the village lives now (M86), for what its people are seen doing and saying: from
   * its land's year (fed, growing in number), its realm (at war, its grievance), its faith,
   * its living world's turns, what it has learned lately, and the watched families' years;
   * and, before all else, visitors from another star among them, and how the land met them.
   */
  function lifeNow(
    cell: number,
    population: number,
    visitors: readonly Visitor[] | undefined,
  ): VillageLife {
    const p = ctx.provinces.get(cell),
      years = ctx.history.yearsOf(cell),
      last = years.at(-1),
      before = years.at(-6),
      growing = !!last && !!before && last.population > before.population * 1.01,
      realms = politiesOf(world),
      realm = realms.of(cell),
      war =
        !!realm &&
        warsOf(world)
          .fighting(realm.ref)
          .some((w) => w.ended === null),
      // (Grievance runs past one as a land nears revolt: held at one, near revolt.)
      unrest = realm ? Math.min(1, realms.discontent(cell).level) : 0,
      beliefs = beliefOf(world),
      held = beliefs.of(cell).faith,
      faith = held ? (beliefs.get(held)?.name ?? null) : null,
      w = wildsOf(ctx, cell),
      fed = (p?.fed ?? 1000) / 1000,
      rain = (p?.rain ?? 1000) / 1000,
      learned = loreOf(world)
        .of(cell)
        .some(([, k]) => k.year >= now - 8),
      mourning: string[] = [],
      newborn: string[] = [];
    for (const h of known()) {
      const members = h.members.map((m) => ledger.person(m)).filter((q) => !!q);
      if (members.some((q) => !q!.alive && q!.diedYear !== null && q!.diedYear >= now - 1))
        mourning.push(h.ref);
      if (members.some((q) => q!.alive && q!.birthYear >= now - 1)) newborn.push(h.ref);
    }
    // What they talk of, the most pressing first; small talk last.
    const talk: string[] = [];
    for (const visitor of visitors ?? []) {
      talk.push("visitors");
      if (visitor.ours && !talk.includes(visitor.ours)) talk.push(visitor.ours);
    }
    if (fed < 0.85) talk.push("hunger");
    if (war) talk.push("war");
    if (unrest > 0.3) talk.push("unrest");
    // Bonds and freedoms (Phase 19 M138): the bound among them, a rising lately, a freedom won.
    {
      const order = orderOf(world),
        l = order?.land(cell),
        lately = l?.cause ? world.events.get(l.cause) : undefined,
        o = realm ? order?.of(realm.ref) : undefined,
        since = (years: number) => !!lately && lately.t >= (now - years) * YEAR;
      if ((order?.bound(cell) ?? 0) >= 0.05) talk.push("bondage");
      if (since(3) && /^order\.(revolt|crushed|freed)$/.test(lately!.type)) talk.push("rising");
      if (
        (o && o.abolished !== null && o.abolished >= now - 10) ||
        (since(10) && (lately!.type === "order.freed" || lately!.type === "act.unchain"))
      )
        talk.push("freedom");
      // (A new law in the realm these three years: M139.)
      if (
        o?.lawEvents.some((e) => {
          const at = e ? world.events.get(e)?.t : undefined;
          return at !== undefined && at >= (now - 3) * YEAR;
        })
      )
        talk.push("law");
    }
    // A sickness among them these two years (Phase 20 M140).
    {
      const last = healthOf(world)?.land(cell)?.last;
      if (last && last.year >= now - 2 && last.share >= 0.005) talk.push("sickness");
    }
    if (mourning.length) talk.push("grief");
    if (w.flocksTaken) talk.push("flocks");
    if (w.grainEaten) talk.push("pests");
    if (actsOf(world).at(cell, "harvest", world.now)?.sign === -1) talk.unshift("blight");
    if (w.fishFew) talk.push("fish");
    if (w.thinned) talk.push("game");
    if (w.multiplied) talk.push("plenty");
    if (rain < 0.8) talk.push("drought");
    else if (rain > 1.25) talk.push("rain");
    if (newborn.length) talk.push("baby");
    if (learned) talk.push("learning");
    if (growing) talk.push("building");
    if (faith) talk.push("faith");
    if (v!.market) talk.push("trade");
    talk.push("weather", "food", "gossip");
    // The next home rises where the next would stand in the village's ring (in a town built
    // lot by lot, on its next lot), as far built as the families it will house have come.
    const k = homes.length,
      a = phase + k * 2.399963,
      rad = 16 + 8.5 * Math.sqrt(k),
      progress = Math.max(0.12, population / 5 - Math.floor(population / 5)),
      building = growing && !city && k < 400,
      next =
        building && fabric && town
          ? townLots(town.family, town.seed, town.axis, town.whole + 1, town.water)
          : null,
      site = building
        ? next && town
          ? {
              x: next.x[town.whole]!,
              z: next.z[town.whole]!,
              yaw: next.yaw[town.whole]!,
              progress,
            }
          : {
              x: rad * Math.cos(a),
              z: rad * Math.sin(a),
              yaw: a + u(seed, 10 + k) * 0.6,
              progress,
            }
        : null;
    // Whether it is its land's heart (Phase 40 M204): the battles for its land are fought before
    // it, its sieges laid about it.
    const heartOf = landHeart(world, cell),
      heart = !heartOf || heartOf === ref;
    // A battle fought in its land this year or last, as history fought it (before its heart).
    let battle: VillageLife["battle"] = null;
    for (const w of heart ? warsOf(world).all() : []) {
      const b = w.battles.findLast((x) => x.land === cell && x.year >= now - 1),
        a = realms.get(w.attacker),
        d = realms.get(w.defender);
      if (!b || !a || !d || (battle && battle.year > b.year)) continue;
      battle = {
        // (Each in its host's kinds: its arms, its guard — Phase 13 M114.)
        attacker: {
          name: realmName(a),
          color: realmColor(w.attacker),
          host: hostKinds(world, w.attacker),
        },
        defender: {
          name: realmName(d),
          color: realmColor(w.defender),
          host: hostKinds(world, w.defender),
        },
        won: b.won,
        fallen: b.fallen[0] + b.fallen[1],
        year: b.year,
        event: b.event,
      };
    }
    if (battle && !talk.includes("war")) talk.unshift("war");
    // The feasts it keeps (Phase 33 M174, as Classic's festivals): the harvest home once the grain
    // is in, where the land is fed; a peace its realm made this year past, two days on; its realm's
    // new ruler crowned, three days on; the holy day of its faith. One feast to a day.
    const feasts: Feast[] = [],
      keep = (f: Feast) => {
        if (!feasts.some((g) => g.day === f.day)) feasts.push(f);
      },
      DAY = YEAR / 365;
    if (fed >= 0.9)
      for (const y of [now, now + 1])
        keep({
          day: y * 365 + 286 + (seed % 4),
          occasion: "harvest",
          words: "Harvest home",
          ref: null,
        });
    if (realm) {
      for (const w of warsOf(world).all()) {
        if (!w.peace || (w.attacker !== realm.ref && w.defender !== realm.ref)) continue;
        const e = world.events.get(w.peace);
        if (!e || e.t < world.now - YEAR) continue;
        const other = realms.get(w.attacker === realm.ref ? w.defender : w.attacker);
        keep({
          day: Math.floor(e.t / DAY) + 2,
          occasion: "peace",
          words: other ? `The peace with ${realmName(other)}` : "The peace",
          ref: e.id,
        });
      }
      const events = world.events.all();
      for (let i = events.length - 1; i >= 0; i--) {
        const e = events[i]!;
        if (e.t < world.now - YEAR) break;
        if (e.type === "polity.succession" && e.subjects[0] === realm.ref) {
          keep({
            day: Math.floor(e.t / DAY) + 3,
            occasion: "crowning",
            words: `${realmName(realm)}'s new ruler crowned`,
            ref: e.id,
          });
          break;
        }
      }
    }
    if (held && faith)
      for (const y of [now, now + 1])
        keep({
          day: y * 365 + 30 + (hashString(`holy ${held}`) % 230),
          occasion: "holy",
          words: `The feast of ${faith}`,
          ref: held,
        });
    // The year in its fields (Phase 44 M206): its rain as the year began, its soil, the vermin in
    // its grain, the warming on them; the god's hand on its rain and its harvest now, since when.
    const acts = actsOf(world),
      sending = acts.at(cell, "rain", world.now),
      giving = acts.at(cell, "harvest", world.now),
      drought = p?.lastDrought ? world.events.get(p.lastDrought) : undefined,
      fields: FieldYear = {
        rain,
        sent: sending ? sending.sign : 0,
        sentFrom: sending?.from ?? 0,
        gift: giving ? giving.sign : 0,
        giftFrom: giving?.from ?? 0,
        soil: w.soil,
        vermin: grainLost(w),
        heat: heatYield(ctx, cell),
        why: [
          ...(drought && world.now - drought.t < YEAR ? [drought.id] : []),
          ...(sending ? [sending.event] : []),
          ...(giving ? [giving.event] : []),
          ...(w.worn ? [w.worn] : []),
        ],
      };
    return {
      fed,
      growing,
      war,
      unrest,
      faith,
      talk,
      site,
      mourning,
      newborn,
      battle,
      feasts,
      heart,
      fields,
    };
  }

  /**
   * What lives about the village: the land's wild lineages (not those hunted or driven out
   * of it) with how much of each stands — its game against what it was, its hunters against
   * as many as the game kept — its flocks and how many of the village keep them, and
   * whether its hunters raid them.
   */
  function faunaOf(cell: number, population: number): NonNullable<VillagePlan["fauna"]> {
    const g = ctx.generated,
      w = wildsOf(ctx, cell),
      land = ctx.provinces.get(cell),
      // Every beast of the land's web, with its body (M83), each as its level stands (M84):
      // the game by what the wild holds, the small game by what the ground and the fields
      // keep, each hunter and scavenger by its own number, the swimmers by the waters'.
      wild = livingIn(g.life, cell)
        .filter((s) => !w.lost.includes(s.index) && s.body !== null)
        .map((s) => ({
          ref: s.ref,
          name: s.name,
          niche: s.niche,
          size: s.size,
          wool: s.wool,
          stock:
            s.niche === "hunter"
              ? w.hunters
              : s.niche === "small hunter"
                ? w.lesser
                : s.niche === "scavenger"
                  ? w.carrion
                  : s.niche === "swimmer"
                    ? Math.max(0, w.fish)
                    : s.niche === "seed-eater"
                      ? w.small
                      : w.wild,
          body: s.body,
        })),
      pop = land?.total() ?? 0,
      herders = land && pop > 0 ? land.occupation(OCC.herder) / pop : 0,
      beast = land?.herding && herders > 0 ? flockBeast(cell, land.herding) : null;
    return {
      wild,
      flock: beast
        ? {
            ref: beast.ref,
            name: beast.name,
            size: beast.size,
            wool: beast.wool,
            herders: Math.max(1, Math.round(population * herders)),
            body: beast.body,
          }
        : null,
      raided: !!w.flocksTaken,
    };
  }

  /**
   * The beast a land's flocks are of: its own that can be tamed, else the one its herding
   * was first found with, followed back through the lands that taught it (else, if that
   * history is forgotten, the first living beast the world could tame).
   */
  function flockBeast(cell: number, herding: Ref): Species | null {
    const life = ctx.generated.life,
      own = life.herdBeast[cell] ?? -1;
    // (Its own, while it is tame: one the god has made wild was herded, if at all, before.)
    if (own >= 0 && tameNow(world, life.species[own]!)) return life.species[own]!;
    let ref: Ref | null = herding;
    for (let hops = 0; ref && hops < 64; hops++) {
      const e = world.events.get(ref);
      if (!e) break;
      const beast = (e.data as { beast?: unknown } | null)?.beast;
      if (typeof beast === "string") return life.species.find((s) => s.name === beast) ?? null;
      ref = (e.causes[0]?.ref as Ref | undefined) ?? null;
    }
    return life.species.find((s) => s.tame && s.niche === "grazer" && s.died === null) ?? null;
  }

  function eraOf(cell: number): NonNullable<VillagePlan["era"]> {
    return landEra(world, cell);
  }
  /**
   * The land's works about the village, on the open ground furthest from its fields, road
   * and pasture: a mine where it digs coal (a shaft under a headframe once it has engines,
   * a pit before), else an ore pit where it smelts copper, else a quarry where it builds in
   * stone; its oil well; its factory by the road.
   */
  function worksOf(cell: number): NonNullable<VillagePlan["works"]> {
    const m = marketsOf(world).get(cell),
      made = m?.years.at(-1)?.ledger[0],
      era = eraOf(cell),
      engines = era === "industry" || era === "modern",
      ways = Array.from({ length: 8 }, (_, k) => (k / 8) * 2 * Math.PI).sort(
        (a, b) =>
          Math.min(apart(b, fieldWay), offRoad(b), apart(b, pastureWay)) -
            Math.min(apart(a, fieldWay), offRoad(a), apart(a, pastureWay)) || a - b,
      ),
      at = (a: number, r: number) => ({ x: r * Math.cos(a), z: r * Math.sin(a) }),
      dig = edge + 70,
      mine = m?.mine
        ? { ...at(ways[0]!, dig), kind: engines ? "shaft" : "pit", what: "coal", ref: m.mine }
        : (made?.[G.copper] ?? 0) > 0
          ? {
              ...at(ways[0]!, dig),
              kind: engines ? "shaft" : "pit",
              what: "ore",
              ref: m?.metalworking ?? null,
            }
          : houseOf(cell).walls === "stone"
            ? { ...at(ways[0]!, dig), kind: "quarry", what: "stone", ref: houseOf(cell).design }
            : null;
    return {
      mine: mine as NonNullable<VillagePlan["works"]>["mine"],
      well: m?.well ? { ...at(ways[1]!, edge + 140), ref: m.well } : null,
      factory: m?.works ? { ...at(roadWay + 0.4, edge + 35), ref: m.works } : null,
    };
  }

  /**
   * Its dead and their burying (Phase 43 M205): its share, by its people, of its land's dead —
   * last year's, a year's; and every year's since it was founded that history holds, those in
   * its graveyard — and the watched households' dead of these three years, by name.
   */
  function restOf(cell: number, population: number, founded: number): VillageRest {
    const years = ctx.history.yearsOf(cell),
      last = years.at(-1),
      share = last && last.population > 0 ? Math.min(1, population / last.population) : 0;
    let dead = 0;
    for (let y = Math.max(founded, now - 400); y < now; y++) dead += ctx.history.deathsIn(cell, y);
    const named: VillageRest["named"][number][] = [];
    for (const h of known()) {
      const home = homes.findIndex((x) => x.household === h.ref);
      if (home < 0) continue;
      for (const m of h.members) {
        const q = ledger.person(m);
        if (!q || q.alive || q.diedYear === null || q.diedYear < now - 3) continue;
        named.push({
          name: `${q.name} ${q.surname}`,
          year: q.diedYear,
          age: q.diedYear - q.birthYear,
          home,
        });
      }
    }
    named.sort((a, b) => a.year - b.year || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return {
      year: now,
      perYear: ctx.history.deathsIn(cell, now - 1) * share,
      graves: Math.round(dead * share),
      named,
    };
  }

  function houseOf(cell: number): VillagePlan["house"] {
    return landHouse(world, cell);
  }

  function planOf(people: VillagePlan["people"][number][]): VillagePlan {
    const village = v!,
      visitors = visitorsAt(world, village.cell, now),
      stores = storesOf(village.cell, village.population),
      trade = tradeOf(village.cell, village.population);
    return {
      ref,
      hand: !!hand && hand.village === ref,
      name: village.name,
      cell: village.cell,
      spot: homePlanet(world).generated.centre[village.cell] ?? -1,
      population: village.population,
      market: village.market !== null,
      biome: r.biome[village.tile]!,
      seed,
      homes,
      fields,
      pasture: {
        x: pastureAt * Math.cos(pastureWay),
        z: pastureAt * Math.sin(pastureWay),
        r: pastureR,
      },
      wild: wildAt,
      water:
        waterWay === null
          ? null
          : { x: WATER_OUT * Math.cos(waterWay), z: WATER_OUT * Math.sin(waterWay) },
      house: houseOf(village.cell),
      fauna: faunaOf(village.cell, village.population),
      era: eraOf(village.cell),
      metal: toolMetal(ctx, village.cell),
      works: worksOf(village.cell),
      life: lifeNow(village.cell, village.population, visitors),
      body: peopleBody(world),
      visitors,
      // A city's road runs along its axis; a village's out toward the far fields.
      road: city
        ? { x: 1100 * Math.cos(city.axis), z: 1100 * Math.sin(city.axis) }
        : { x: 1100 * Math.cos(roadWay), z: 1100 * Math.sin(roadWay) },
      districts: city
        ? { blocks: BLOCKS, blockM: BLOCK_M, uses: city.uses, paved: !!city.paved }
        : null,
      ...(fabric && town ? { town } : {}),
      ...wondersOfIn(world, village.shrine ?? null, village.spring ?? null),
      rest: restOf(village.cell, village.population, village.founded),
      people,
      ...(stores ? { stores } : {}),
      ...(trade ? { trade } : {}),
    };
  }
}

/** Goods as a load of them is named on the road (Phase 48 M210), where not as the market names them. */
const TRADE_WORDS: Readonly<Record<string, string>> = {
  meat: "salt meat and cheese",
  wild: "dried fruit and nuts",
};

/**
 * The god's wonders in a village (Phase 42 M201): its shrine and its spring, from their events —
 * when, and where the hand set them in it (if it did).
 */
function wondersOfIn(world: World, shrine: Ref | null, spring: Ref | null): { wonders?: Wonder[] } {
  const out: Wonder[] = [];
  for (const [kind, ref] of [
    ["spring", spring],
    ["shrine", shrine],
  ] as const) {
    if (!ref) continue;
    const e = world.events.get(ref),
      d = (e?.data ?? null) as { x?: unknown; z?: unknown } | null,
      x = typeof d?.x === "number" ? d.x : null,
      z = typeof d?.z === "number" ? d.z : null;
    out.push({
      kind,
      at: e?.t ?? 0,
      x: x !== null && z !== null ? x : null,
      z: x !== null ? z : null,
      event: ref,
    });
  }
  return out.length ? { wonders: out } : {};
}

/**
 * How many homes and buildings a town has going up at once about moment t, of those drawn: those
 * rising, and as many of those standing as are in their turn worn and rebuilt (as the town's view
 * rebuilds them: a level's months of building in each of its years of standing) — a building
 * counting for three (a village: its next home).
 */
function risingAt(town: TownPlan | null, t: number): number {
  if (!town) return 1;
  const states = lotStates(town);
  let n = 0;
  for (let p = 0; p < town.lots; p++) {
    if (states.what[p] !== LOT.home) continue;
    const g = progress(states.began[p]!, states.takes[p]!, t);
    if (g < 1) n += g > 0 ? 1 : 0;
    else n += states.takes[p]! / ((HOME_LIFE[states.level[p]!] ?? 50) * YEAR);
  }
  return (
    Math.round(n) +
    3 * town.civics.filter((c) => c.start <= t / YEAR && c.end >= t / YEAR - 1).length
  );
}
