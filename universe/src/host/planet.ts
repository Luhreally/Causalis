// The planet universes: "earth" (the earthlike prior) and "alien" (the open prior).
// The globe view's frame carries the planet's fields once — they do not change
// until people change them — and the page colours them by whichever lens is on.
import type { SwitchStore } from "../sim/index.ts";
import {
  brushPreview,
  actsOf,
  agentName,
  airOf,
  beliefOf,
  BLESSING,
  capacity,
  citiesOf,
  civilizationsNear,
  cultureOf,
  DEITIES,
  designsOf,
  diplomacyOf,
  fieldedOf,
  frontier,
  grainLost,
  handOf,
  homePlanet,
  interestsOf,
  LANGUAGE_EVENTS,
  languagesOf,
  loreOf,
  makePopulationWorld,
  marketGoodRef,
  marketsOf,
  opposedTo,
  PERSON_TRAITS,
  PIOUS_BLESSING,
  politiesOf,
  populationContext,
  powerOf,
  prepareSites,
  rainShift,
  realmName,
  regionOf,
  siteGround,
  relationRef,
  sitesReady,
  smokeIn,
  spaceOf,
  starSitesOf,
  starWarsOf,
  tameNow,
  USES,
  warsOf,
  wildsOf,
  WAR_EVENTS,
  laneLawOf,
  laneMapOf,
} from "../sim/index.ts";
import {
  FOODS,
  G,
  GOODS,
  OCCUPATIONS,
  depositProcessOn,
  designWords,
  roleWord,
} from "../rules/index.ts";
import {
  BIOME_NAMES,
  BOUNDARY,
  livingIn,
  DEPOSIT_KINDS,
  WATER,
  cellRef,
  CLUSTER_LY,
  clusterStars,
  foreignPlanets,
  makeGalaxy,
  offworldSite,
  type GalaxyStar,
  refineRegion,
  tongueLikeness,
  tongueName,
  generateHomeWorld,
  provinceWorld,
  type HomeWorld,
  type Region,
  type Tongue,
  spotRef,
  starAgeGyr,
  type ProvinceWorld,
  worldChemistry,
} from "../gen/index.ts";
import { EARTHLIKE, OPEN, type Prior } from "../rules/index.ts";
import {
  Rng,
  YEAR,
  finish,
  hashString,
  mix,
  parseRef,
  rulesetId,
  seedFromText,
  yearOfMoment,
  type Ref,
  type Seed,
  type World,
} from "../kernel/index.ts";
import {
  folkRef,
  governmentWords,
  principleName,
  standingWords,
  kept,
  landWords,
  observer,
  priceWords,
  waysRef,
  waysWords,
  why,
} from "../causal/index.ts";
import type {
  ClusterPlan,
  ClusterStar,
  HostKinds,
  SkyState,
  StarPage,
  SystemPlan,
  WarsMap,
  GenesisPlan,
  SeedLife,
  WarRaid,
  WrittenAsk,
} from "../bridge/index.ts";

/** The most garrisons the globe shows at the seats of realms at peace (Phase 12 M110). */
const GARRISONS = 48;
import { glanceSeed, readSeed } from "./can.ts";
import type { Universe } from "./host.ts";
import { OBSERVE_QUERIES } from "./observe.ts";
import { PAGE_QUERIES } from "./pages.ts";
import { KIN_QUERIES } from "./kin.ts";
import {
  alertsOf,
  answersOf,
  breakdownOf,
  pageOf,
  placeOf,
  stageOf,
  tipOf,
  worldFirstsNow,
  type Counted,
} from "./inspect/index.ts";
import { annalsIndex, annalsRead, runTold } from "./inspect/annals.ts";
import { askedKey, townOffers } from "./inspect/asks.ts";
import { MAP_QUERIES } from "./map.ts";
import { POSSESS_QUERIES } from "./possess.ts";
import { LIFE_QUERIES } from "./life.ts";
import { REIGN_QUERIES } from "./reign.ts";
import { townPlan } from "./town.ts";
import { FILLING_QUERIES } from "./filling.ts";
import { TRADE_QUERIES } from "./trade.ts";
import { NATION_QUERIES } from "./nations.ts";
import { STAR_LENS_QUERIES } from "./starlens.ts";
import { TOUR_QUERIES } from "./tour.ts";
import {
  COLONY_QUERIES,
  colonyGrowth,
  colonyMoments,
  colonyLook,
  installColonyTowns,
  sealedPlan,
} from "./colony.ts";
import { STARFIGHT_QUERIES } from "./starfight.ts";
import { HOME_QUERIES, homePlanReader, planDrawn } from "./home.ts";
import { LEADER_QUERIES, withFigures } from "./leaders.ts";
import { BAR_QUERIES } from "./bar.ts";
import { writtenIndex, writtenRead } from "./inspect/written.ts";
import { WEALTH_QUERIES } from "./wealth.ts";
import { HELD_QUERIES } from "./held.ts";
import { SEARCH_QUERIES } from "./search.ts";
import { takenWordsOf, type NamesArg } from "./names.ts";
import { realmColor, faithColor, languageColor } from "./colors.ts";
import { hostKinds, realmArms } from "./arms.ts";
import { landHeart, villagePlan } from "./village.ts";
import { withWounds, woundedTowns } from "./wounds.ts";
import { landPlan } from "./land.ts";
import { campNear } from "./camp.ts";
import { NATIVES_QUERIES, folkOfTown, folkTownPlan } from "./natives.ts";
import { jumpPlan } from "./lanes.ts";
import { LANDFALL_QUERIES } from "./landfall.ts";
import { battleNear, battleOutcome } from "./battle.ts";
import { battleRoll } from "./roll.ts";
import { armBorne } from "./inspect/arm.ts";
import { landTitle } from "./inspect/names.ts";
import { campaignOf, warsOfAge } from "./campaign.ts";
import { landReadings } from "./lenses.ts";
import { genesisOf } from "./genesis.ts";
import { TRAIT_LOOK } from "./inspect/folk.ts";
import { actsMap, landSky, paletteLand } from "./acts.ts";
import { fireShadow } from "./inspect/fire.ts";
import { tilesUnderWoods, woodsMap } from "./inspect/woods.ts";
import { landHerds } from "./inspect/herds.ts";
import { FAR_QUERIES } from "./far.ts";
import { groundMap, spotGround } from "./inspect/ground.ts";
import { worldGlobe } from "./worlds.ts";
import { foreignGlobe, foreignSystem, galaxyPlan, starPage, starsNear } from "./galaxy.ts";
import { peoplesSky, visitsNow } from "./peoples.ts";
import { mirrorsOfSky } from "./past.ts";
import { peopleFigure } from "./folk.ts";
import { kindOn, lifelessWhy, seedKind, spotBiome, spotSwing, spotWarmth } from "./kinds.ts";
import { lookMeta } from "./biochem.ts";

const BOUNDARY_WORDS = ["none", "converging", "spreading", "sliding"];

function globeFrame(world: World) {
  // The globe shows the world as generated (the fine grid); each cell carries its province.
  const pw = homePlanet(world).generated,
    g = pw.fine,
    n = g.grid.count,
    deposit = new Int16Array(n).fill(-1);
  for (const d of g.deposits) deposit[d.cell] = DEPOSIT_KINDS.indexOf(d.kind);
  return {
    key: homePlanet(world).surfaceKey,
    meta: {
      surfaceKey: homePlanet(world).surfaceKey,
      frequency: g.grid.frequency,
      plates: g.tectonics.plates.map((p) => ({ continental: p.continental })),
      depositKinds: DEPOSIT_KINDS,
      biomeNames: BIOME_NAMES,
      // (Its kind, for the colours of its seas and land: Phase 56.)
      kind: kindOn(g),
      // (Its life's colours, where they are not Earth's green: Phase 57.)
      ...lookMeta(g),
      // (A people of the water's lands are its sea, not its ground: what their lenses paint.)
      ...(pw.life.people?.body.medium === "water" ? { undersea: true } : {}),
    },
    arrays: {
      elevation: Float32Array.from(g.tectonics.elevation),
      temperature: Float32Array.from(g.climate.temperature),
      precipitation: Float32Array.from(g.climate.precipitation),
      biome: Uint8Array.from(g.climate.biome),
      plate: Uint8Array.from(g.tectonics.plate),
      river: Uint8Array.from(g.water.river),
      lake: Uint8Array.from(g.water.lake),
      deposit: Uint8Array.from(deposit, (v) => (v < 0 ? 255 : v)),
      province: Int32Array.from(pw.provinceOf),
      diversity: Uint8Array.from(g.life.diversity),
    },
  };
}

/** A province's region: the same one its villages are sited on (a pure function of the world). */
// (A home's page opened from afar reads its town as the view would: Lives L6.)
homePlanReader((world, town) => {
  const folkHere = folkOfTown(world, town);
  if (folkHere) return planDrawn(world, folkTownPlan(world, folkHere, 8, 120));
  return planDrawn(
    world,
    withFigures(
      world,
      withWounds(world, sealedPlan(world, villagePlan(world, town as Ref, undefined, 120))),
    ),
  );
});

export function region(world: World, province: number): Region {
  const g = homePlanet(world).generated;
  if (
    !Number.isInteger(province) ||
    province < 0 ||
    (province >= g.grid.count && !siteGround(world, province))
  )
    throw new Error(`no province ${province}`);
  return regionOf(populationContext(world), province);
}

function regionFrame(world: World, focus: string | null) {
  const pw = homePlanet(world).generated,
    g = pw.fine,
    center = focus ? parseRef(focus as Ref).b : 0,
    r = region(world, center),
    ground = siteGround(world, center),
    middle = pw.centre[center]!,
    deposit = new Uint8Array(r.size * r.size).fill(255);
  for (const d of r.deposits) deposit[d.tile] = DEPOSIT_KINDS.indexOf(g.deposits[d.deposit]!.kind);
  // A land of another body (Phase 64): its own world's ground, and how warm each tile of it is.
  if (ground)
    return {
      key: `${r.ref}:${homePlanet(world).surfaceKey}`,
      meta: {
        ref: r.ref,
        surfaceKey: `${r.ref}:${homePlanet(world).surfaceKey}`,
        center,
        size: r.size,
        tileKm: r.tileKm,
        lat: (ground.world.grid.lat[ground.hall]! * 180) / Math.PI,
        lon: (ground.world.grid.lon[ground.hall]! * 180) / Math.PI,
        colony: colonyLook(world, center),
      },
      arrays: {
        elevation: Float32Array.from(r.elevation),
        biome: Uint8Array.from(r.biome),
        water: Uint8Array.from(r.water),
        fertility: new Uint8Array(r.size * r.size),
        deposit,
        warm: Float32Array.from(r.temperature),
      } as Record<string, Float32Array | Uint8Array | Int32Array>,
    };
  // (Its woods as they stand now: E1. Its map is sent again when they have moved a twentieth.)
  const woods = tilesUnderWoods(world, center, r.biome, r.water, r.precipitation, r.size);
  return {
    key: `${r.ref}:${homePlanet(world).surfaceKey}:${woods.key}`,
    meta: {
      ref: r.ref,
      surfaceKey: `${r.ref}:${homePlanet(world).surfaceKey}`,
      woods: woods.key,
      woodsRatio: woods.ratio,
      woodsParched: woods.parched,
      center,
      size: r.size,
      tileKm: r.tileKm,
      lat: (g.grid.lat[middle]! * 180) / Math.PI,
      lon: (g.grid.lon[middle]! * 180) / Math.PI,
      kind: kindOn(g),
      ...lookMeta(g),
    },
    arrays: {
      elevation: Float32Array.from(r.elevation),
      biome: woods.biome,
      water: Uint8Array.from(r.water),
      fertility: Uint8Array.from(r.fertility, (f) => Math.round(f * 255)),
      deposit,
      // Each tile's spot of the globe's grid: what the globe shows there is shown here too (M95).
      parent: Int32Array.from(r.parent),
    },
  };
}

const WATER_WORDS = ["", "the sea", "a river", "a lake"];

export function tile(world: World, center: number, t: number) {
  const g = homePlanet(world).generated.fine,
    r = region(world, center);
  if (!Number.isInteger(t) || t < 0 || t >= r.size * r.size) throw new Error(`no tile ${t}`);
  const d = r.deposits.find((x) => x.tile === t),
    deposit = d ? g.deposits[d.deposit]! : null;
  return {
    tile: t,
    x: t % r.size,
    y: Math.floor(t / r.size),
    tileKm: r.tileKm,
    elevation: r.elevation[t]!,
    // (In true degrees, and its seas its liquid's: Phase 56.)
    temperature: spotWarmth(g, r.temperature[t]!),
    precipitation: r.precipitation[t]!,
    biome: spotBiome(g, BIOME_NAMES[r.biome[t]!]!),
    water: WATER_WORDS[r.water[t]!],
    fertility: r.fertility[t]!,
    // Its ground (Phase 15 M124): the rock under it, the soil over it. (A colony's has no spot of the
    // home world's under it: Phase 64.)
    ground: siteGround(world, center) ? null : spotGround(world, r.parent[t]!, r.biome[t]!),
    parent: siteGround(world, center) ? null : spotRef(0, r.parent[t]!),
    deposit: deposit
      ? {
          ref: deposit.ref,
          kind: deposit.kind,
          richness: deposit.richness,
          process: deposit.process,
        }
      : null,
    sea: r.water[t] === WATER.sea,
  };
}

export function province(world: World, cell: number) {
  const ctx = populationContext(world),
    p = ctx.provinces.get(cell);
  if (!p) return null;
  return {
    cell,
    ref: p.ref,
    people: p.total(),
    byOccupation: OCCUPATIONS.map((name, o) => ({ name, count: p.occupation(o) })).filter(
      (x) => x.count > 0,
    ),
    fed: p.fed,
    food: marketsOf(world).get(cell)?.food(FOODS) ?? 0,
    farming: p.knowsCultivation,
    settledYear: p.settledYear,
    arrival: p.arrival,
    cultivation: p.cultivation,
    villages: ctx.settlements.seenIn(cell).length,
    folk: folkRef(cell),
    ways: waysOf(world, cell),
    realm: realmOf(world, cell),
    faith: faithOf(world, cell),
    // What lives wild there (not those hunted out of it): the lineages that can be tamed
    // or sown first.
    wild: livingIn(homePlanet(world).generated.life, cell)
      .filter((s) => !wildsOf(ctx, cell).lost.includes(s.index))
      .sort(
        (a, b) =>
          Number(tameNow(world, b)) - Number(tameNow(world, a)) ||
          // (And its hunters before the rest.)
          Number(b.niche === "hunter") - Number(a.niche === "hunter") ||
          (a.name < b.name ? -1 : 1),
      )
      .map((s) => ({ name: s.name, ref: s.ref, tame: tameNow(world, s), niche: s.niche })),
    herding: p.herding,
    // Its living world: the wild, the forest and the soil against what they were.
    ecology: (() => {
      const w = wildsOf(ctx, cell),
        g = homePlanet(world).generated;
      return {
        wild: w.wild,
        forest: w.forest,
        soil: w.soil,
        firstForest: w.firstForest,
        thinned: w.thinned,
        cleared: w.cleared,
        worn: w.worn,
        lost: w.lost.map((i) => ({
          name: g.life.species[i]!.name,
          ref: g.life.species[i]!.ref,
          niche: g.life.species[i]!.niche,
        })),
        // Its hunters (M77): the lineage, how many against what the game once kept, and
        // whether they take from the flocks.
        hunters:
          w.hunter >= 0 && !w.lost.includes(w.hunter)
            ? {
                name: g.life.species[w.hunter]!.name,
                ref: g.life.species[w.hunter]!.ref,
                stock: w.hunters,
              }
            : null,
        flocksTaken: w.flocksTaken,
        // The web's other levels (M84): its small game, small hunters, scavengers, fish.
        small: w.small,
        lesser:
          w.lesserOf >= 0 && !w.lost.includes(w.lesserOf)
            ? {
                name: g.life.species[w.lesserOf]!.name,
                ref: g.life.species[w.lesserOf]!.ref,
                stock: w.lesser,
              }
            : null,
        scavengers:
          w.scavengerOf >= 0 && !w.lost.includes(w.scavengerOf)
            ? {
                name: g.life.species[w.scavengerOf]!.name,
                ref: g.life.species[w.scavengerOf]!.ref,
                stock: w.carrion,
              }
            : null,
        fish: w.fish < 0 ? null : w.fish,
        grainLost: grainLost(w),
        multiplied: w.multiplied,
        grainEaten: w.grainEaten,
        fishFew: w.fishFew,
      };
    })(),
    // Their works and power: what drives their crafts, the fuel and machines they make.
    industry: (() => {
      const m = marketsOf(world).get(cell),
        last = m?.years.at(-1)?.ledger[0],
        d = designsOf(world).worksOf(p.ref);
      return {
        power: powerOf(ctx, cell),
        works: d ? { words: designWords(d.parts), ref: d.ref } : null,
        coal: last?.[G.coal] ?? 0,
        oil: last?.[G.oil] ?? 0,
        machines: last?.[G.machines] ?? 0,
        mine: m?.mine ?? null,
        well: m?.well ?? null,
        factory: m?.works ?? null,
        // (Its works stopped by a rocket's fall: W3.)
        idle:
          m && m.idleUntil > yearOfMoment(world.now)
            ? `Struck, and at a stand until year ${m.idleUntil}: it makes no machines, and nothing here runs by them.`
            : null,
        // The smoke in their air, and how the warming has moved their rain.
        smoke: smokeIn(ctx, cell),
        smoked: airOf(world).smokeOf(cell),
        rain: rainShift(ctx, cell),
        shifted: airOf(world).shiftOf(cell),
      };
    })(),
    // How they build, with the design that explains it (once one has been realized).
    house: (() => {
      const d = designsOf(world).of(p.ref);
      return d ? { words: designWords(d.parts), ref: d.ref } : null;
    })(),
    lore: loreOf(world)
      .of(cell)
      .reverse()
      .map(([id, k]) => ({ id, name: principleName(id, world), year: k.year, event: k.event })),
    years: ctx.history.yearsOf(cell).slice(-12),
  };
}

/** A province's market: each good's price, stock and year, with the ref that explains it. */
export function market(world: World, cell: number) {
  const ctx = populationContext(world),
    markets = marketsOf(world),
    m = markets.get(cell),
    p = ctx.provinces.get(cell);
  if (!m || !p) return null;
  const last = m.years.at(-1),
    line = (l: number, g: number) => last?.ledger[l]![g] ?? 0,
    town = ctx.settlements.seenIn(cell).find((s) => s.market);
  return {
    cell,
    year: last?.year ?? null,
    goods: GOODS.map((g, i) => ({
      id: g.id,
      name: g.name,
      ref: marketGoodRef(cell, i),
      ratio: m.price[i]! / g.value,
      words: priceWords(m.price[i]! / g.value),
      stock: m.stock[i]!,
      made: line(0, i),
      used: line(1, i),
      into: line(2, i),
      out: line(3, i),
    })).filter((g) => g.stock > 0 || g.made > 0 || g.used > 0 || g.into > 0),
    foodMonths: p.total() ? m.food(FOODS) / p.total() : 0,
    cover: {
      tools: m.toolCover / 10,
      clothing: m.clothingCover / 10,
      pottery: m.potteryCover / 10,
    },
    metalworking: m.metalworking,
    town: town ? { ref: town.ref, name: town.name, population: town.population } : null,
    trade: markets.flows
      .filter((f) => f.from === cell || f.to === cell)
      .map((f) => ({
        good: GOODS[f.good]!.name,
        count: f.count,
        out: f.from === cell,
        with: landWords(world, cellRef(0, f.from === cell ? f.to : f.from)),
      })),
  };
}

/** A province's years, for charts: its people, how well they ate, what food and tools cost. */
export function provinceHistory(world: World, cell: number) {
  const ctx = populationContext(world),
    m = marketsOf(world).get(cell);
  return {
    cell,
    people: folkRef(cell),
    years: ctx.history.yearsOf(cell).map((y) => ({
      year: y.year,
      population: y.population,
      fed: y.fed / 10,
    })),
    prices: (m?.series ?? []).map((y) => ({
      year: y.year,
      food: y.food / 1000,
      tools: y.tools / 1000,
    })),
  };
}

/** What history holds as mattering most, newest first, in words, with the world's people by year. */
export function chronicle(world: World, limit: number, types?: readonly string[]) {
  const ctx = populationContext(world),
    byYear = new Map<number, number>();
  for (const p of ctx.provinces.all())
    for (const y of ctx.history.yearsOf(p.cell))
      byYear.set(y.year, (byYear.get(y.year) ?? 0) + y.population);
  // What mattered most; or, asked for kinds of event, every one of those kinds held.
  const events = world.events
    .all()
    .filter((e) => (types ? types.includes(e.type) : e.importance >= 4))
    .slice(-limit)
    .reverse()
    .map((e) => ({
      ref: e.id,
      type: e.type,
      year: yearOfMoment(e.t),
      importance: e.importance,
      claim: why(world, e.id).claim,
    }));
  return {
    events,
    population: [...byYear.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, people]) => ({ year, people })),
  };
}

/** What a land believes, as the inspector shows it. */
export function faithOf(world: World, cell: number) {
  const store = beliefOf(world),
    b = store.of(cell),
    f = b.faith ? store.get(b.faith) : undefined;
  return f
    ? { ref: f.ref, name: f.name, deity: DEITIES[f.tenet], since: b.since, event: b.event }
    : null;
}

/** The realm a land belongs to, as the inspector shows it. */
export function realmOf(world: World, cell: number) {
  const realms = politiesOf(world),
    p = realms.of(cell);
  if (!p) return null;
  const grievance = realms.discontent(cell);
  return {
    ref: p.ref,
    name: realmName(p),
    lands: p.members.length,
    seat: p.seat === cell,
    government: governmentWords(p),
    ruler: p.ruler.name,
    since: p.ruler.since,
    grievance: grievance.level,
    cause: grievance.cause,
    tithe: Math.round(p.tribute * 100),
    // What its host fights with.
    host: (() => {
      const d = designsOf(world).of(p.ref);
      return d ? { words: designWords(d.parts), ref: d.ref } : null;
    })(),
    // Who holds sway, and what each most wants (with what it rests on).
    interests: interestsOf(populationContext(world), p, world.now)
      .filter((i) => i.sway >= 0.01)
      .sort((a, b) => b.sway - a.sway)
      .map((i) => {
        const top = [...i.demands].sort((a, b) => b.strength - a.strength)[0];
        return {
          group: i.group,
          sway: i.sway,
          want: top ? top.name : null,
          source: top?.source ?? null,
        };
      }),
    wars: warsOf(world)
      .fighting(p.ref)
      .map((w) => {
        const other = realms.get(w.attacker === p.ref ? w.defender : w.attacker)!;
        return {
          ref: w.ref,
          name: realmName(other),
          since: w.declared,
          attacking: w.attacker === p.ref,
        };
      }),
    neighbours: diplomacyOf(world)
      .of(p.ref)
      .map((r) => {
        const other = realms.get(r.a === p.ref ? r.b : r.a)!;
        return {
          ref: relationRef(r.a, r.b),
          name: realmName(other),
          standing: standingWords(r.opinion, !!r.pact),
          opinion: r.opinion,
        };
      })
      .sort((x, y) => y.opinion - x.opinion),
  };
}

/** A realm as a colour: its own hue, keyed by its ref. */

/** A people's ways and speech, for the inspector. */
export function waysOf(world: World, cell: number) {
  const w = cultureOf(world).get(cell);
  if (!w) return null;
  const store = languagesOf(world),
    l = store.of(cell),
    since = store.since(cell),
    shifted = since ? world.events.get(since) : undefined;
  return {
    ref: waysRef(cell),
    words: waysWords(w),
    kept: kept(w.tongue, populationContext(world).culture),
    // Names as their speech would give them.
    sounds: [7001, 7002, 7003].map((k) => tongueName(w.tongue, k)),
    language: l
      ? {
          ref: l.ref,
          name: l.name,
          family: store.familyName(l),
          first: l.family === l.index,
          dead: l.died !== null,
          // How like the language's common speech theirs is, in parts of a hundred.
          like: Math.round(100 * tongueLikeness(w.tongue, l.standard)),
          // When they took it up in place of another (the event), if they did.
          took:
            shifted?.type === LANGUAGE_EVENTS.shifted.type
              ? { event: shifted.id, year: yearOfMoment(shifted.t) }
              : null,
        }
      : null,
  };
}

/** A tongue as a colour: alike tongues, alike colours (each sound pulls the hue its own way). */
function tongueColor(t: Tongue): [number, number, number] {
  const fields = [t.onsets, t.vowels, t.codas, t.endings],
    c: [number, number, number] = [0, 0, 0];
  let bits = 0;
  fields.forEach((mask, f) => {
    for (let i = 0; i < 24; i++)
      if ((mask >>> i) & 1) {
        bits++;
        const h = finish(mix(0x7a11 + f, i), 5);
        c[0] += h & 0xff;
        c[1] += (h >>> 8) & 0xff;
        c[2] += (h >>> 16) & 0xff;
      }
  });
  // Spread the averages away from grey so neighbouring tongues read apart.
  return c.map((v) =>
    Math.max(0, Math.min(1, 0.5 + ((v / Math.max(1, bits) - 127.5) / 127.5) * 4)),
  ) as [number, number, number];
}

export function summary(g: HomeWorld) {
  const s = g.star,
    p = g.planet;
  return {
    prior: g.prior,
    star: {
      ref: s.ref,
      spectral: s.spectral,
      mass: s.mass,
      luminosity: s.luminosity,
      ageGyr: starAgeGyr(s),
    },
    planet: {
      ref: p.ref,
      mass: p.mass,
      gravity: p.gravity,
      orbitAu: p.orbitAu,
      yearDays: p.yearDays,
      dayHours: p.dayHours,
      tilt: p.tilt,
      meanTemperature: p.meanTemperature,
      oceanFraction: p.oceanFraction,
      plates: g.tectonics.plates.length,
    },
    deposits: g.deposits.length,
    cells: g.grid.count,
  };
}

/** A spot of the fine grid the observer picked on the globe, and the province it is part of. */
export function cell(pw: ProvinceWorld, c: number) {
  const g = pw.fine;
  if (!Number.isInteger(c) || c < 0 || c >= g.grid.count) throw new Error(`no place ${c}`);
  const t = g.tectonics,
    plate = t.plates[t.plate[c]!]!,
    d = g.deposits.find((x) => x.cell === c),
    chem = worldChemistry(pw);
  return {
    cell: c,
    province: pw.provinceOf[c]!,
    ref: spotRef(0, c),
    lat: (g.grid.lat[c]! * 180) / Math.PI,
    lon: (g.grid.lon[c]! * 180) / Math.PI,
    elevation: t.elevation[c]!,
    temperature: spotWarmth(g, g.climate.temperature[c]!),
    seasonality: spotSwing(g, g.climate.seasonality[c]!),
    precipitation: g.climate.precipitation[c]!,
    biome: spotBiome(g, BIOME_NAMES[g.climate.biome[c]!]!),
    plate: { ref: plate.ref, index: plate.index, continental: plate.continental },
    boundary: t.toBoundary[c]! <= 3 ? BOUNDARY_WORDS[t.boundary[c]!] : "none",
    river: g.water.river[c] === 1,
    lake: g.water.lake[c] === 1,
    // Phase 54: a world of its own chemistry names its own ores (on Earth, the very words).
    deposit: d
      ? {
          ref: d.ref,
          kind: roleWord(chem, d.kind),
          richness: d.richness,
          process: depositProcessOn(chem, d.kind) ?? d.process,
        }
      : null,
  };
}

/** A town: its people, founding, market, the god's shrine and spring, and its city's quarters. */
export function settlementFacts(world: World, ref: string) {
  const s = populationContext(world).settlements.get(ref as Ref);
  if (!s) throw new Error(`no settlement ${ref}`);
  return {
    ref: s.ref,
    name: s.name,
    cell: s.cell,
    tile: s.tile,
    population: s.population,
    founded: s.founded,
    event: s.event,
    market: s.market,
    shrine: s.shrine ?? null,
    spring: s.spring ?? null,
    city: (() => {
      const c = citiesOf(world).get(s.ref);
      if (!c) return null;
      const quarters = USES.map((name, use) => ({
        name,
        blocks: c.uses.filter((u) => u === use).length,
      })).filter((q) => q.blocks && q.name !== "open");
      return { founded: c.founded, event: c.event, paved: c.paved, quarters };
    })(),
  };
}

/** Whether life arose on a home world, and a people; where none did, why, in a few words. */
export function seedLife(g: HomeWorld): SeedLife {
  const living = g.life.species.length > 0,
    peopled = !!g.life.people,
    t = Math.round(g.planet.meanTemperature);
  return {
    living,
    peopled,
    world: {
      star: g.star.spectral,
      kelvin: Math.round(g.star.temperature),
      gravity: Math.round(g.planet.gravity * 100) / 100,
      warmth: t,
      seas: Math.round(g.planet.oceanFraction * 100) / 100,
      ...seedKind(g),
    },
    // (Why none took hold, its seas its liquid's: Phase 56.)
    words: peopled ? "" : living ? "life arose on it, but no people rose from it" : lifelessWhy(g),
  };
}

const RULES_FREQUENCY = 4;

function planetUniverse(name: string, prior: Prior): Universe {
  // (A world of its own chemistry's history changed with Phase 54 M222: its own ores, heats and arms.
  // Every world's changed with Phase 66, past its first years: ages past ours. And with F1: arms by what
  // they do, so worlds with no furnace have blades and guns of their own stuff. And with F2 and F3: heat, not
  // fire; no lists by kind. And with F4: rocky worlds read as any other, each turning aside where its numbers
  // shut the first way. And with W2: past its engines, wings, and war from the air; what the tree's roots
  // know crosses the sea. And with W3: past its rocketry, loads thrown. And with E1: woods that move, long ages of rain,
  // lodes that run out. And with Z1: herds that go somewhere, beasts people know, herds taken in war, a tree that goes on.)
  const version = name === "alien" ? "alien-22" : `${name}-18`,
    make = (seed: Seed, frequency?: number) => {
      // The chronicle opens after a generated prehistory: bands across the land.
      const world = makePopulationWorld(seed, {
        prior,
        start: "spread",
        ...(frequency ? { frequency } : {}),
      });
      observer(world);
      // (Its colonies' towns as the eye reads them: Phase 64, nothing history holds.)
      installColonyTowns(world);
      return world;
    };
  let rules: string | null = null;
  return {
    name,
    version,
    defaultView: "globe",
    // A farming land with no village yet will found one soon: work out its village sites early.
    idle: (world) => {
      const ctx = populationContext(world),
        next = ctx.provinces
          .all()
          .find(
            (p) =>
              p.knowsCultivation &&
              !ctx.settlements.seenIn(p.cell).length &&
              !sitesReady(ctx, p.cell),
          );
      if (!next) return false;
      prepareSites(ctx, next.cell);
      return true;
    },
    // Whether life arises on a seed's world (asked 2026-10-24: a world never seen "where the world
    // supports life"; one in ten freezes over lifeless): its home world made, and nothing more.
    life: (seed) => seedLife(generateHomeWorld(seed, prior)),
    // What a seed's world allows of each age (Phase 65: "Can it?"): its home world made, and nothing run.
    reading: (seed) => {
      const fine = generateHomeWorld(seed, prior);
      return readSeed(fine, provinceWorld(fine), seed, name, seedLife(fine));
    },
    glance: (seed, target) => glanceSeed(seed, prior, target),
    // (The same whatever the seed or the size: a few lands' world tells it for a fraction of the work.)
    ruleset: () => (rules ??= rulesetId(make(seedFromText("rules"), RULES_FREQUENCY), version)),
    build: (seed) => make(seed),
    frames: {
      globe: (world) => globeFrame(world),
      region: (world, interest) => regionFrame(world, interest.focus),
    },
    queries: {
      "brush.preview": (world, args) => {
        const { cells, provinces, atRisk, towns, seeded, spared } = brushPreview(
          populationContext(world),
          args,
        );
        return { cells, provinces, atRisk, towns, seeded, spared };
      },
      "brush.state": (world) => {
        const home = homePlanet(world),
          g = home.generated;
        return {
          count: home.brushStrokes().length,
          key: home.surfaceKey,
          centres: [...g.centre],
          ores: DEPOSIT_KINDS,
          realms: politiesOf(world)
            .living()
            .map((r) => ({ ref: r.ref, name: realmName(r) })),
          strokes: home.brushStrokes().slice(-16),
        };
      },
      "planet.summary": (world) => summary(homePlanet(world).generated.fine),
      /** The stars within the cluster's reach of home. */
      "galaxy.cluster": (world): ClusterPlan => {
        const rng = new Rng(world.seed);
        return {
          radius: CLUSTER_LY,
          stars: clusterOf(world).map((s) => clusterStar(s, rng)),
          // (Places in `stars`: the lanes' list has the home star first.)
          ...(laneLawOf(world).open
            ? {
                lanes: laneMapOf(world).lanes.map(
                  (l) => [l.a - 1, l.b - 1] as readonly [number, number],
                ),
              }
            : {}),
        };
      },
      /** The first jump (Phase 68). */
      "lanes.jump": (world) => jumpPlan(world),
      /** Arms past the greatest fire (W6). */
      ...FAR_QUERIES,
      /** Any star of the galaxy (the cluster's or beyond), and its worlds. */
      "galaxy.star": (world, args): StarPage => starPage(world, (args as { ref: string }).ref),
      // Another star's own system, to look at as the home star's is (M95).
      "galaxy.system": (world, args): SystemPlan =>
        foreignSystem(world, (args as { ref: string }).ref),
      /** The galaxy's shape, and the stars about a spot of it (M80). */
      "galaxy.plan": (world) => galaxyPlan(world),
      "galaxy.near": (world, args) => {
        const a = args as { x: number; y: number };
        return starsNear(world, a.x, a.y);
      },
      /** Visitors from another star at the home world's lands now (Phase 18 M134). */
      "peoples.visits": (world) => visitsNow(world),
      /** The peoples among the stars alone (M136), for another star's system while it is shown. */
      "peoples.sky": (world) => peoplesSky(world) ?? null,
      /** Who has reached the sky, and the colonies on the system's bodies. */
      "space.state": (world): SkyState => {
        const g = homePlanet(world).generated,
          ctx = populationContext(world),
          realms = politiesOf(world),
          space = spaceOf(world),
          year = (e: Ref | null) => (e ? Math.floor((world.events.get(e)?.t ?? 0) / YEAR) : null),
          founders = new Map<number, { realm: Ref; event: Ref; year: number }>();
        for (const p of space.all())
          for (const c of p.colonies)
            founders.set(c.cell, { realm: p.realm, event: c.event, year: c.year });
        const named = (ref: Ref | null) => {
          const r = ref ? realms.get(ref) : undefined;
          return r ? r.town : null;
        };
        return {
          // Every realm with anything in the sky: a satellite, a station, a colony.
          programs: space
            .all()
            .filter((p) => p.satellite || p.station || p.colonies.length)
            .map((p) => ({
              realm: p.realm,
              name: named(p.realm) ?? "a fallen realm",
              satellite: year(p.satellite),
              crew: year(p.crew),
              station: year(p.station),
              colonies: p.colonies.length,
            })),
          colonies: ctx.provinces
            .all()
            .filter((p) => (offworldSite(g, p.cell)?.body ?? -1) >= 0 && p.total() > 0)
            .map((p) => {
              const site = offworldSite(g, p.cell)!,
                f = founders.get(p.cell);
              return {
                cell: p.cell,
                body: site.body,
                site: site.site,
                people: p.total(),
                fed: p.fed,
                realm: named(realms.of(p.cell)?.ref ?? null),
                founder: named(f?.realm ?? null),
                founded: f?.year ?? p.settledYear,
                event: f?.event ?? p.arrival,
              };
            }),
          fleets: (() => {
            // Where each enemy lies: another people's star, or the star of a colony broken away.
            const civs = new Map(civilizationsNear(world).map((c) => [c.ref as string, c.star])),
              colonies = new Map<string, string>();
            for (const [cell, s] of starSitesOf(world)?.all() ?? []) {
              const holder = realms.of(cell);
              if (holder) colonies.set(holder.ref, s.star);
            }
            return starWarsOf(world)
              .all()
              .map((w) => ({
                realm: named(w.realm) ?? w.realm,
                enemy: named(w.enemy) ?? w.enemy,
                realmRef: w.realm,
                enemyRef: w.enemy,
                strength: Math.round(w.strength * 10) / 10,
                star: civs.get(w.enemy) ?? colonies.get(w.enemy) ?? null,
                sailed: w.sailed,
                arrives: w.arrives,
                won: w.won,
                event: w.event,
              }));
          })(),
          ships: (starSitesOf(world)?.all() ?? []).map(([cell, s]) => ({
            cell,
            star: s.star,
            distance: s.distance,
            departed: s.departed,
            arrives: s.arrives,
            arrived: s.arrived !== null,
            people: ctx.provinces.get(cell)?.total() ?? 0,
            realm: named(realms.of(cell)?.ref ?? null),
            voyage: s.voyage,
          })),
          peoples: peoplesSky(world),
          ...mirrorsOfSky(world),
        };
      },
      /** The home star's system: the star, and every planet and moon with its orbit and ground. */
      // A body of the star's system made whole, to look at in depth (M81).
      "world.globe": (world, args) => {
        // A world of the home star's (by its ref), or of another star's (its place outward).
        const a = args as { ref?: string; star?: string; index?: number };
        return a.star !== undefined
          ? foreignGlobe(world, a.star, a.index ?? 0)
          : worldGlobe(world, a.ref ?? "");
      },
      "planet.system": (world): SystemPlan => {
        const g = homePlanet(world).generated,
          bodies = g.system.bodies;
        return {
          star: {
            ref: g.star.ref,
            spectral: g.star.spectral,
            mass: g.star.mass,
            luminosity: g.star.luminosity,
            temperature: g.star.temperature,
            ageGyr: starAgeGyr(g.star),
          },
          frostLine: g.system.frostLine,
          bodies: bodies.map((b) => ({
            ref: b.ref,
            designation: b.designation,
            kind: b.kind,
            around: bodies.findIndex((p) => p.ref === b.orbit.around),
            a: b.orbit.a,
            e: b.orbit.e,
            periapsis: b.orbit.periapsis,
            phase: b.orbit.phase,
            periodDays: b.orbit.periodDays,
            mass: b.mass,
            radius: b.radius,
            gravity: b.gravity,
            escape: b.escape,
            temperature: b.temperature,
            pressure: b.pressure,
            air: b.air,
            water: b.water,
            radiation: b.radiation,
            because: b.because,
          })),
        };
      },
      /** The air: its carbon, how much warmer the world is, and the event of the latest warming. */
      "planet.air": (world) => {
        const a = airOf(world).air;
        return { carbon: a.carbon, warming: a.warming, warmer: a.lastWarmer };
      },
      cell: (world, args) => cell(homePlanet(world).generated, (args as { cell: number }).cell),
      tile: (world, args) => {
        const a = args as { center: number; tile: number };
        return tile(world, a.center, a.tile);
      },
      // The wars of the year on the globe (M87): each side in its colour, where its host
      // marches from and for, and the battles fought lately.
      // The god's acts where they fall, for the globe to play them; a land as the palette
      // sees it (Phase 12 M106).
      "acts.map": (world) => actsMap(world),
      /** A land's sky (Phase 30 M162): its climate, this year's rain, the god's acts on it. */
      "land.sky": (world, args) => landSky(world, (args as { cell: number }).cell),
      // What a town can be asked, and whether what it was asked has moved (H1).
      "town.offers": (world, args) => townOffers(world, (args as { ref: string }).ref),
      "town.asked": (world, args) => askedKey(world, (args as { ref: string }).ref),
      "woods.map": (world) => woodsMap(world),
      // A land's creatures, as its map draws them (Z1): read, never told back.
      "land.herds": (world, args) => landHerds(world, (args as { cell: number }).cell),
      // Every land's chief rock, for the Ground lens (Phase 15 M124).
      "ground.map": (world) => groundMap(world),
      "palette.land": (world, args) => paletteLand(world, (args as { cell: number }).cell),
      "wars.map": (world): WarsMap => {
        const pw = homePlanet(world).generated,
          grid = pw.fine.grid,
          realms = politiesOf(world),
          year = Math.floor(world.now / (365 * 86_400)),
          spot = (cell: number) => pw.centre[cell] ?? -1,
          near = (a: number, b: number) => {
            const p = grid.positions;
            return (
              p[a * 3]! * p[b * 3]! + p[a * 3 + 1]! * p[b * 3 + 1]! + p[a * 3 + 2]! * p[b * 3 + 2]!
            );
          },
          ctx = populationContext(world),
          // What its host is made of: its design's parts (M110), by their ids.
          hostOf = (ref: Ref): HostKinds | null => hostKinds(world, ref),
          side = (ref: Ref) => {
            const r = realms.get(ref)!;
            return {
              ref,
              name: realmName(r),
              color: realmColor(ref),
              // (Its counter's: the men it fields, and its arms.)
              fields: Math.round(fieldedOf(ctx, r)),
              arms: realmArms(world, ref),
              host: hostOf(ref),
            };
          };
        // (Its strikes from the air of the last two years: W2.)
        const raidsByWar = new Map<string, WarRaid[]>(),
          struck = warsOf(world).allStrikes();
        for (let k = struck.length - 1; k >= 0 && struck[k]!.year >= year - 2; k--) {
          const s = struck[k]!,
            list = raidsByWar.get(s.war) ?? [];
          list.push({
            town: s.town,
            name: ctx.settlements.get(s.town)?.name ?? "a town",
            year: s.year,
            side: s.side,
            flyers: s.flyers,
            dead: s.dead,
            homes: s.homes,
            event: s.event,
            ...(s.kind === "rocket" && s.from !== undefined
              ? { rocket: { from: s.from, to: s.cell } }
              : {}),
            ...(s.great ? { great: true } : {}),
          });
          raidsByWar.set(s.war, list);
        }
        const wars = warsOf(world)
          .hot()
          .filter(
            (w) =>
              (w.ended === null || w.ended >= year - 1) &&
              realms.get(w.attacker) &&
              realms.get(w.defender),
          )
          .flatMap((w) => {
            const to = spot(w.prize);
            if (to < 0) return [];
            // The host sets out from the attacker's land nearest what it wants.
            let from = -1,
              best = -Infinity;
            for (const m of realms.get(w.attacker)!.members) {
              const s = spot(m);
              if (s < 0 || m === w.prize) continue;
              const k = near(s, to);
              if (k > best) {
                best = k;
                from = s;
              }
            }
            if (from < 0) return [];
            // Where it fights next, as things stand (M203): the land its attacker wants most now,
            // as history will choose it at the turn; and its land nearest that, where it musters.
            const a = realms.get(w.attacker)!,
              d = realms.get(w.defender)!,
              nextCell =
                w.ended === null && a.ended === null && d.ended === null
                  ? frontier(ctx, a, d)[0]
                  : undefined,
              next = nextCell === undefined ? null : spot(nextCell);
            let muster = from;
            if (next !== null && next >= 0) {
              let near0 = -Infinity;
              for (const m of a.members) {
                const s = spot(m);
                if (s < 0 || m === nextCell) continue;
                const k = near(s, next);
                if (k > near0) {
                  near0 = k;
                  muster = s;
                }
              }
            }
            const cells = new Map<number, number>();
            for (const c of [w.prize, nextCell, a.seat, d.seat, ...w.battles.map((b) => b.land)])
              if (c !== undefined && spot(c) >= 0) cells.set(spot(c), c);
            for (const m of a.members)
              if (spot(m) === muster || spot(m) === from) cells.set(spot(m), m);
            return [
              {
                ref: w.ref,
                attacker: side(w.attacker),
                defender: side(w.defender),
                from,
                to,
                next: next !== null && next >= 0 ? next : null,
                muster,
                seats: { attacker: spot(a.seat), defender: spot(d.seat) },
                places: [...cells].map(([s, c]) => ({ spot: s, name: landTitle(world, c, true) })),
                declared: w.declared,
                ended: w.ended,
                // (A seat is besieged by a victory there while its realm still holds it.)
                siege: (() => {
                  const seat = realms.get(w.defender)?.seat;
                  return w.ended === null &&
                    seat !== undefined &&
                    w.battles.some((b) => b.land === seat && b.won) &&
                    realms.of(seat)?.ref === w.defender
                    ? spot(seat)
                    : null;
                })(),
                battles: w.battles
                  .filter((b) => b.year >= year - 2)
                  .map((b) => ({
                    spot: spot(b.land),
                    year: b.year,
                    won: b.won,
                    ...(b.combat ? { rout: b.combat.rout } : {}),
                    fallen: b.fallen[0] + b.fallen[1],
                    ...(b.wounded ? { wounded: b.wounded[0] + b.wounded[1] } : {}),
                    event: b.event,
                    outcome: battleOutcome(world, b),
                    seat: b.seat ?? false,
                  })),
                ...(raidsByWar.has(w.ref) ? { raids: raidsByWar.get(w.ref)! } : {}),
              },
            ];
          });
        // The realms at peace, their garrisons at their seats (M110): the greatest first.
        const fighting = new Set(
            wars.flatMap((w) => (w.ended === null ? [w.attacker.ref, w.defender.ref] : [])),
          ),
          garrisons = realms
            .living()
            .filter((r) => !fighting.has(r.ref) && spot(r.seat) >= 0)
            .map((r) => ({ r, fields: Math.round(fieldedOf(ctx, r)) }))
            .sort((a, b) => b.fields - a.fields || (a.r.ref < b.r.ref ? -1 : 1))
            .slice(0, GARRISONS)
            .map(({ r, fields }) => ({
              realm: r.ref,
              name: realmName(r),
              color: realmColor(r.ref),
              spot: spot(r.seat),
              fields,
              host: hostOf(r.ref),
            }));
        return { year, garrisons, wars, body: peopleFigure(ctx.generated) };
      },
      // A world's beginning, for the genesis (M89): its deep ages, every lineage with the
      // age it arose and died in and its body, and the people that rose to thought; played on
      // a deep clock (Phase 24), and asked of a seed's text with acts laid on its dawn, the
      // world remade from them.
      genesis: (world, args): GenesisPlan =>
        genesisOf(world, (args as { seed?: string } | undefined)?.seed),
      "people.map": (world) => {
        const g = homePlanet(world).generated,
          medium = g.life.people?.body.medium ?? "land",
          markets = marketsOf(world),
          // (The deeper lenses' readings: unrest, strength, wealth, knowledge, growth — M108.)
          readings = landReadings(world);
        // The lands of the home world (lands on other bodies are shown with the sky).
        return populationContext(world)
          .provinces.all()
          .filter((p) => !offworldSite(g, p.cell))
          .map((p) => {
            const m = markets.get(p.cell),
              last = m?.years.at(-1);
            return {
              cell: p.cell,
              // The spot at its middle, to turn the globe to it or pick it.
              centre: g.centre[p.cell]!,
              people: p.total(),
              density: (100 * p.total()) / Math.max(1, capacity(g, p.cell, medium).areaKm2),
              farming: p.knowsCultivation,
              food: m ? m.price[G.grain]! / GOODS[G.grain]!.value : 1,
              faith: (() => {
                const b = beliefOf(world).of(p.cell);
                return b.faith ? faithColor(b.faith) : null;
              })(),
              realm: (() => {
                const r = politiesOf(world).of(p.cell);
                return r ? realmColor(r.ref) : null;
              })(),
              tongue: (() => {
                const l = languagesOf(world).of(p.cell);
                if (l) return languageColor(l.family, l.index);
                const w = cultureOf(world).get(p.cell);
                return w ? tongueColor(w.tongue) : null;
              })(),
              trade: last
                ? last.ledger[2]!.reduce((a, b) => a + b, 0) +
                  last.ledger[3]!.reduce((a, b) => a + b, 0)
                : 0,
              ...readings(p.cell),
            };
          });
      },
      market: (world, args) => market(world, (args as { cell: number }).cell),
      "province.history": (world, args) => provinceHistory(world, (args as { cell: number }).cell),
      chronicle: (world, args) => {
        const a = (args ?? {}) as { limit?: number; types?: string[] };
        return chronicle(world, a.limit ?? 60, a.types);
      },
      "village.plan": (world, args) => {
        const a = args as { ref: string; families?: number; folk?: number; figures?: boolean };
        // (A town of a people of another world, read off it: Phase 69.)
        const folkHere = folkOfTown(world, a.ref);
        if (folkHere)
          return planDrawn(
            world,
            folkTownPlan(
              world,
              folkHere,
              a.families ? Math.max(1, Math.min(16, Math.round(a.families))) : 8,
              a.folk ? Math.max(0, Math.min(480, Math.round(a.folk))) : 0,
              (args as { at?: number }).at,
            ),
          );
        // (Their wounds laid over them, their days away with the levy, those a strike killed this
        // year: Phase 55 M226 — read from the record, the world untouched.)
        const drawn = withWounds(
          world,
          // (A colony's: its own world's sky and ground, Phase 64.)
          sealedPlan(
            world,
            villagePlan(
              world,
              a.ref as Ref,
              a.families ? Math.max(1, Math.min(16, Math.round(a.families))) : undefined,
              a.folk ? Math.max(0, Math.min(480, Math.round(a.folk))) : 0,
            ),
          ),
        );
        // (Its key figures, for the page that asks: Lives L1.)
        return planDrawn(world, a.figures ? withFigures(world, drawn) : drawn);
      },
      /** The towns whose levy comes home wounded this year, the most borne first (Phase 55 M226; the look tools). */
      "village.wounded": (world, args) =>
        woundedTowns(
          world,
          Math.max(
            1,
            Math.min(60, Math.round((args as { most?: number } | undefined)?.most ?? 20)),
          ),
        ),
      /** A land's heart (Phase 40 M204): the town its battles are fought before, or null. */
      "land.heart": (world, args) => landHeart(world, (args as { cell: number }).cell),
      /** Ready a land's region before it is asked for (a pure cache: the world is untouched). */
      "region.prepare": (world, args) => {
        region(world, (args as { cell: number }).cell);
        return true;
      },
      /** Where the god's hand rests, if anywhere. */
      hand: (world) => {
        const w = handOf(world).resting;
        if (!w) return null;
        return {
          village: w.village,
          name: populationContext(world).settlements.get(w.village)?.name ?? "",
          people: w.agents.length,
          since: yearOfMoment(w.laid),
          event: w.event,
        };
      },
      /** Which of the hand's people is known by a name (the one it was laid from, Phase 54); null: none. */
      "hand.named": (world, args) => {
        const name = (args as { name: string }).name;
        return handOf(world).resting?.agents.find((a) => a.name === name)?.id ?? null;
      },
      /** One of the people under the hand: who they are, whether blessed, and what they are remembered for. */
      agent: (world, args) => {
        const w = handOf(world).resting,
          id = (args as { id: number }).id,
          a = w?.agents.find((x) => x.id === id);
        if (!w || !a) return null;
        const ctx = populationContext(world),
          year = yearOfMoment(world.now);
        return {
          id,
          name: agentName(ctx, a, ctx.settlements.get(w.village)!),
          age: year - a.birthYear,
          blessedUntil:
            a.blessedUntil !== undefined && a.blessedUntil > year ? a.blessedUntil : null,
          // (How long the god's blessing would keep them: the pious the longer.)
          blessing: Math.round(BLESSING * (a.traits?.includes("pious") ? PIOUS_BLESSING : 1)),
          // (What they are like, for the god's hand to give or take: Phase 14 M118.)
          traits: PERSON_TRAITS.map((t) => ({
            id: t,
            ...TRAIT_LOOK[t],
            has: a.traits?.includes(t) ?? false,
            // (Not to be given while they are its opposite: hardy and frail.)
            barred: a.traits?.some((x) => x === opposedTo(t)) ?? false,
          })),
          deeds: (w.notables ?? [])
            .filter((n) => n.agent === id)
            .map((n) => ({ event: n.deed, claim: why(world, n.deed).claim })),
        };
      },
      /** The god's acts on a province, newest first, each with the event that records it. */
      acts: (world, args) => {
        const cell = (args as { cell: number }).cell;
        return actsOf(world)
          .all()
          .filter((a) => a.cell === cell)
          .map((a) => ({
            kind: a.kind,
            sign: a.sign,
            event: a.event,
            from: yearOfMoment(a.from),
            until: yearOfMoment(a.until),
            active: a.from <= world.now && world.now < a.until,
            claim: why(world, a.event).claim,
          }))
          .reverse();
      },
      province: (world, args) => province(world, (args as { cell: number }).cell),
      settlements: (world, args) =>
        populationContext(world)
          .settlements.seenIn((args as { cell: number }).cell)
          .map((s) => ({
            ref: s.ref,
            name: s.name,
            tile: s.tile,
            population: s.population,
            founded: s.founded,
          })),
      settlement: (world, args) => settlementFacts(world, (args as { ref: string }).ref),
      // A land's towns as the land draws them, each from its fabric, and its roads (M150).
      "towns.land": (world, args) => {
        const a = args as { cell: number; most?: number };
        return landPlan(world, a.cell, a.most);
      },
      // A camp of a land's bands seen near (Phase 29 M160).
      "camp.near": (world, args) => {
        const a = args as { cell: number; id: number };
        return campNear(world, a.cell, a.id);
      },
      // A battle seen near (Phase 37 M183): its hosts, its ground, what came of it.
      "battle.near": (world, args) => battleNear(world, (args as { event: string }).event),
      // How near the world stands to the greatest fire, its panel's reading (W5).
      "fire.shadow": (world) => (world.hasStore("war.fire") ? fireShadow(world) : null),
      // Where a strike from the air fell (W2).
      "raid.where": (world, args) => {
        const e = world.events.get((args as { event: string }).event as Ref);
        return e && e.type === WAR_EVENTS.strike.type ? { town: e.subjects[0]! } : null;
      },
      // Who fought a battle, figure by figure (Phase 55 M225): its line holders and the people met
      // first, then the rest of its levy named for the roll.
      "battle.roll": (world, args) => {
        const a = args as { event: string; most?: number };
        return battleRoll(world, a.event, a.most);
      },
      // What a man of a battle's roll bore there and who made it (Phase 55 M228): his card's words.
      "arms.borne": (world, args) => {
        const a = args as { event: string; side: 0 | 1; who: string; names?: NamesArg };
        return armBorne(world, a.event, a.side === 1 ? 1 : 0, a.who, a.names);
      },
      // A war's course, to be watched unfolding on the globe (Phase 38 M193).
      "war.campaign": (world, args) => campaignOf(world, (args as { ref: string }).ref),
      // The wars of an age, watched unfolding together (M194).
      "wars.age": (world, args) =>
        warsOfAge(world, (args ?? {}) as { from?: number; to?: number; most?: number }),
      ...OBSERVE_QUERIES,
      // A card's family and body, and the people's body plan (Phase 55 wave 5).
      ...KIN_QUERIES,
      ...PAGE_QUERIES,
      // Every thing's page, and where it is to be seen (Phase 10 M91). (Called through, not
      // spread: the pages read this module's builders, so they load after it.)
      page: (world, args) => {
        // (As the people where one stands call things, where asked: Phase 58.)
        const a = args as { ref: string; names?: NamesArg };
        return pageOf(world, a.ref, a.names);
      },
      // The political map's names, the diplomacy and war lenses, the top bar's numbers (M96).
      ...MAP_QUERIES,
      ...SEARCH_QUERIES,
      // One of a town's people possessed (Phase 60): the small world about him, stepped ahead.
      ...POSSESS_QUERIES,
      ...LIFE_QUERIES,
      ...REIGN_QUERIES,
      ...COLONY_QUERIES,
      ...FILLING_QUERIES,
      ...TRADE_QUERIES,
      ...NATION_QUERIES,
      ...TOUR_QUERIES,
      ...STAR_LENS_QUERIES,
      ...NATIVES_QUERIES,
      ...LANDFALL_QUERIES,
      // The fights among the stars as the record has them (Phase 67).
      ...STARFIGHT_QUERIES,
      // A realm's key figures and every realm's wealth (Lives L1, L2).
      ...HOME_QUERIES,
      ...LEADER_QUERIES,
      ...BAR_QUERIES,
      "written.index": (world) => writtenIndex(world),
      "written.read": (world, args) => writtenRead(world, args as WrittenAsk),
      ...WEALTH_QUERIES,
      // What the player has turned off of what the world does by itself (2026-11-11).
      "world.switches": (world) => ({
        off: world.hasStore("acts.switches")
          ? [...world.store<SwitchStore>("acts.switches").off]
          : [],
      }),
      /** A colony's town at a few years of its growth, as it stood: for a film of it. */
      "colony.growth": (world, args) => {
        const a = args as { cell: number; frames: number; axis: number; most: number };
        return colonyGrowth(world, a.cell, colonyMoments(world, a.cell, a.frames), (ref, fabric) =>
          townPlan(world, ref, a.axis, a.most, null, fabric),
        );
      },
      // A soldier or a beast possessed, and a battle the god fought (Phase 61).
      ...HELD_QUERIES,
      place: (world, args) => placeOf(world, (args as { ref: string }).ref),
      // A thing in a few words, for a tooltip (Phase 10 M93).
      tip: (world, args) => {
        const a = args as { ref: string; lens?: string; names?: NamesArg };
        return tipOf(world, a.ref, a.lens, a.names);
      },
      // What stands now and asks to be looked at; what the top bar's numbers are made of (M96, M97).
      alerts: (world) => alertsOf(world),
      "world.breakdown": (world, args) => breakdownOf(world, (args as { what: Counted }).what),
      // Every word one people took from another with a thing, and from whom (Phase 58).
      "names.taken": (world) => takenWordsOf(world),
      // The world's stage, and its firsts the earliest first (Phase 31 M167, M168).
      "world.stage": (world) => stageOf(world),
      "world.firsts": (world) => worldFirstsNow(world),
      // The years as a scroll, and what a run of them came to, from one reading (A1).
      "annals.index": (world) => annalsIndex(world),
      "annals.read": (world, args) => annalsRead(world, (args as { years: number[] }).years),
      "annals.run": (world, args) => {
        const a = args as { from: number; to: number };
        return runTold(world, a.from, a.to);
      },
      // What the god's hand may answer a great happening with (Phase 11 M100).
      "event.answers": (world, args) => {
        const a = args as { ref: string; watch: string };
        return answersOf(world, a.ref, a.watch);
      },
      // Realms' arms, for everything that names them (Phase 11 M102): null for what is no realm.
      arms: (world, args) => (args as { refs: string[] }).refs.map((r) => realmArms(world, r)),
      // The world's deposits where they lie on the globe (fine cells), each with its province.
      deposits: (world) =>
        homePlanet(world).generated.fine.deposits.map((d) => ({
          ref: d.ref,
          kind: d.kind,
          cell: d.cell,
          province: homePlanet(world).generated.provinceOf[d.cell]!,
          richness: d.richness,
        })),
    },
  };
}

/** The cluster's stars for a world (a pure function of its seed, kept while the world is the same). */
const CLUSTERS = new Map<string, GalaxyStar[]>();
export function clusterOf(world: World): GalaxyStar[] {
  const key = world.seed.text;
  let stars = CLUSTERS.get(key);
  if (!stars) {
    if (CLUSTERS.size > 8) CLUSTERS.clear();
    const rng = new Rng(world.seed);
    CLUSTERS.set(key, (stars = clusterStars(rng, makeGalaxy(rng))));
  }
  return stars;
}

export function clusterStar(s: GalaxyStar, rng: Rng): ClusterStar {
  const worlds = foreignPlanets(rng, s);
  return {
    ref: s.ref,
    x: s.x,
    y: s.y,
    z: s.z,
    distance: s.distance,
    spectral: s.spectral,
    mass: s.mass,
    luminosity: s.luminosity,
    temperature: s.temperature,
    ageGyr: s.ageGyr,
    remnant: s.remnant,
    planets: worlds.length,
    seas: worlds.filter((w) => w.water === "seas").length,
  };
}

export const EARTH = planetUniverse("earth", EARTHLIKE);
export const ALIEN = planetUniverse("alien", OPEN);
