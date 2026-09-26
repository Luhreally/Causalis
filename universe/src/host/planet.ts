// The planet universes: "earth" (the earthlike prior) and "alien" (the open prior).
// The globe view's frame carries the planet's fields once — they do not change
// until people change them — and the page colours them by whichever lens is on.
import {
  capacity,
  homePlanet,
  DEITIES,
  actsOf,
  agentName,
  designsOf,
  interestsOf,
  beliefOf,
  USES,
  citiesOf,
  cultureOf,
  diplomacyOf,
  warsOf,
  handOf,
  relationRef,
  loreOf,
  politiesOf,
  realmName,
  makePopulationWorld,
  marketGoodRef,
  marketsOf,
  populationContext,
  regionOf,
  regionReady,
} from "../sim/index.ts";
import { FOODS, G, GOODS, OCCUPATIONS, designWords } from "../rules/index.ts";
import {
  BIOME_NAMES,
  BOUNDARY,
  livingIn,
  DEPOSIT_KINDS,
  WATER,
  cellRef,
  refineRegion,
  tongueName,
  type HomeWorld,
  type Region,
  type Tongue,
} from "../gen/index.ts";
import { EARTHLIKE, OPEN, type Prior } from "../rules/index.ts";
import {
  finish,
  hashString,
  mix,
  parseRef,
  yearOfMoment,
  type Ref,
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
import type { Universe } from "./host.ts";
import { OBSERVE_QUERIES } from "./observe.ts";
import { villagePlan } from "./village.ts";

const BOUNDARY_WORDS = ["none", "converging", "spreading", "sliding"];

function globeFrame(world: World) {
  const g = homePlanet(world).generated,
    n = g.grid.count,
    deposit = new Int16Array(n).fill(-1);
  for (const d of g.deposits) deposit[d.cell] = DEPOSIT_KINDS.indexOf(d.kind);
  return {
    key: g.digest,
    meta: {
      frequency: g.grid.frequency,
      plates: g.tectonics.plates.map((p) => ({ continental: p.continental })),
      depositKinds: DEPOSIT_KINDS,
      biomeNames: BIOME_NAMES,
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
    },
  };
}

// Regions are pure functions of the world and a cell: kept for re-use, never saved.
const REGIONS = new Map<string, Region>();
function region(g: HomeWorld, center: number): Region {
  if (!Number.isInteger(center) || center < 0 || center >= g.grid.count)
    throw new Error(`no place ${center}`);
  const key = `${g.digest}:${center}`;
  let r = REGIONS.get(key);
  if (!r) {
    if (REGIONS.size >= 4) REGIONS.delete(REGIONS.keys().next().value!);
    REGIONS.set(key, (r = refineRegion(g, center)));
  }
  return r;
}

function regionFrame(world: World, focus: string | null) {
  const g = homePlanet(world).generated,
    center = focus ? parseRef(focus as Ref).b : 0,
    r = region(g, center),
    deposit = new Uint8Array(r.size * r.size).fill(255);
  for (const d of r.deposits) deposit[d.tile] = DEPOSIT_KINDS.indexOf(g.deposits[d.deposit]!.kind);
  return {
    key: r.ref,
    meta: {
      ref: r.ref,
      center,
      size: r.size,
      tileKm: r.tileKm,
      lat: (g.grid.lat[center]! * 180) / Math.PI,
      lon: (g.grid.lon[center]! * 180) / Math.PI,
    },
    arrays: {
      elevation: Float32Array.from(r.elevation),
      biome: Uint8Array.from(r.biome),
      water: Uint8Array.from(r.water),
      fertility: Uint8Array.from(r.fertility, (f) => Math.round(f * 255)),
      deposit,
    },
  };
}

const WATER_WORDS = ["", "the sea", "a river", "a lake"];

function tile(g: HomeWorld, center: number, t: number) {
  const r = region(g, center);
  if (!Number.isInteger(t) || t < 0 || t >= r.size * r.size) throw new Error(`no tile ${t}`);
  const d = r.deposits.find((x) => x.tile === t),
    deposit = d ? g.deposits[d.deposit]! : null;
  return {
    tile: t,
    x: t % r.size,
    y: Math.floor(t / r.size),
    tileKm: r.tileKm,
    elevation: r.elevation[t]!,
    temperature: r.temperature[t]!,
    precipitation: r.precipitation[t]!,
    biome: BIOME_NAMES[r.biome[t]!],
    water: WATER_WORDS[r.water[t]!],
    fertility: r.fertility[t]!,
    parent: cellRef(0, r.parent[t]!),
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

function province(world: World, cell: number) {
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
    villages: ctx.settlements.inProvince(cell).length,
    folk: folkRef(cell),
    ways: waysOf(world, cell),
    realm: realmOf(world, cell),
    faith: faithOf(world, cell),
    // What lives wild there: the lineages that can be tamed or sown first.
    wild: livingIn(homePlanet(world).generated.life, cell)
      .sort((a, b) => Number(b.tame) - Number(a.tame) || (a.name < b.name ? -1 : 1))
      .map((s) => ({ name: s.name, ref: s.ref, tame: s.tame, niche: s.niche })),
    herding: p.herding,
    // How they build, with the design that explains it (once one has been realized).
    house: (() => {
      const d = designsOf(world).of(p.ref);
      return d ? { words: designWords(d.parts), ref: d.ref } : null;
    })(),
    lore: loreOf(world)
      .of(cell)
      .reverse()
      .map(([id, k]) => ({ id, name: principleName(id), year: k.year, event: k.event })),
    years: ctx.history.yearsOf(cell).slice(-12),
  };
}

/** A province's market: each good's price, stock and year, with the ref that explains it. */
function market(world: World, cell: number) {
  const ctx = populationContext(world),
    markets = marketsOf(world),
    m = markets.get(cell),
    p = ctx.provinces.get(cell);
  if (!m || !p) return null;
  const last = m.years.at(-1),
    line = (l: number, g: number) => last?.ledger[l]![g] ?? 0,
    town = ctx.settlements.inProvince(cell).find((s) => s.market);
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
function provinceHistory(world: World, cell: number) {
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
function chronicle(world: World, limit: number) {
  const ctx = populationContext(world),
    byYear = new Map<number, number>();
  for (const p of ctx.provinces.all())
    for (const y of ctx.history.yearsOf(p.cell))
      byYear.set(y.year, (byYear.get(y.year) ?? 0) + y.population);
  const events = world.events
    .all()
    .filter((e) => e.importance >= 4)
    .slice(-limit)
    .reverse()
    .map((e) => ({
      ref: e.id,
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
function faithOf(world: World, cell: number) {
  const store = beliefOf(world),
    b = store.of(cell),
    f = b.faith ? store.get(b.faith) : undefined;
  return f
    ? { ref: f.ref, name: f.name, deity: DEITIES[f.tenet], since: b.since, event: b.event }
    : null;
}

/** A faith as a colour, keyed by its ref (the old beliefs are left uncoloured). */
function faithColor(ref: string): [number, number, number] {
  return realmColor(`${ref}:faith`);
}

/** The realm a land belongs to, as the inspector shows it. */
function realmOf(world: World, cell: number) {
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
function realmColor(ref: string): [number, number, number] {
  const h = finish(mix(0x2ea1, hashString(ref)), 7) / 4294967296,
    k = (n: number) => (n + h * 6) % 6,
    f = (n: number) => 0.62 - 0.32 * Math.max(-1, Math.min(k(n), 4 - k(n), 1));
  return [f(5), f(3), f(1)];
}

/** A people's ways and speech, for the inspector. */
function waysOf(world: World, cell: number) {
  const w = cultureOf(world).get(cell);
  if (!w) return null;
  return {
    ref: waysRef(cell),
    words: waysWords(w),
    kept: kept(w.tongue, populationContext(world).culture),
    // Names as their speech would give them.
    sounds: [7001, 7002, 7003].map((k) => tongueName(w.tongue, k)),
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

function summary(g: HomeWorld) {
  const s = g.star,
    p = g.planet;
  return {
    prior: g.prior,
    star: {
      ref: s.ref,
      spectral: s.spectral,
      mass: s.mass,
      luminosity: s.luminosity,
      ageGyr: s.ageGyr,
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

function cell(g: HomeWorld, c: number) {
  if (!Number.isInteger(c) || c < 0 || c >= g.grid.count) throw new Error(`no place ${c}`);
  const t = g.tectonics,
    plate = t.plates[t.plate[c]!]!,
    d = g.deposits.find((x) => x.cell === c);
  return {
    cell: c,
    ref: cellRef(0, c),
    lat: (g.grid.lat[c]! * 180) / Math.PI,
    lon: (g.grid.lon[c]! * 180) / Math.PI,
    elevation: t.elevation[c]!,
    temperature: g.climate.temperature[c]!,
    seasonality: g.climate.seasonality[c]!,
    precipitation: g.climate.precipitation[c]!,
    biome: BIOME_NAMES[g.climate.biome[c]!],
    plate: { ref: plate.ref, index: plate.index, continental: plate.continental },
    boundary: t.toBoundary[c]! <= 3 ? BOUNDARY_WORDS[t.boundary[c]!] : "none",
    river: g.water.river[c] === 1,
    lake: g.water.lake[c] === 1,
    deposit: d ? { ref: d.ref, kind: d.kind, richness: d.richness, process: d.process } : null,
  };
}

function planetUniverse(name: string, prior: Prior): Universe {
  return {
    name,
    version: `${name}-4`,
    defaultView: "globe",
    // A farming land with no village yet will found one soon: refine its region early.
    idle: (world) => {
      const ctx = populationContext(world),
        next = ctx.provinces
          .all()
          .find(
            (p) =>
              p.knowsCultivation &&
              !ctx.settlements.inProvince(p.cell).length &&
              !regionReady(ctx, p.cell),
          );
      if (!next) return false;
      regionOf(ctx, next.cell);
      return true;
    },
    build: (seed) => {
      // The chronicle opens after a generated prehistory: bands across the land.
      const world = makePopulationWorld(seed, { prior, start: "spread" });
      observer(world);
      return world;
    },
    frames: {
      globe: (world) => globeFrame(world),
      region: (world, interest) => regionFrame(world, interest.focus),
    },
    queries: {
      "planet.summary": (world) => summary(homePlanet(world).generated),
      cell: (world, args) => cell(homePlanet(world).generated, (args as { cell: number }).cell),
      tile: (world, args) => {
        const a = args as { center: number; tile: number };
        return tile(homePlanet(world).generated, a.center, a.tile);
      },
      "people.map": (world) => {
        const g = homePlanet(world).generated,
          markets = marketsOf(world);
        return populationContext(world)
          .provinces.all()
          .map((p) => {
            const m = markets.get(p.cell),
              last = m?.years.at(-1);
            return {
              cell: p.cell,
              people: p.total(),
              density: (100 * p.total()) / Math.max(1, capacity(g, p.cell).areaKm2),
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
                const w = cultureOf(world).get(p.cell);
                return w ? tongueColor(w.tongue) : null;
              })(),
              trade: last
                ? last.ledger[2]!.reduce((a, b) => a + b, 0) +
                  last.ledger[3]!.reduce((a, b) => a + b, 0)
                : 0,
            };
          });
      },
      market: (world, args) => market(world, (args as { cell: number }).cell),
      "province.history": (world, args) => provinceHistory(world, (args as { cell: number }).cell),
      chronicle: (world, args) => chronicle(world, (args as { limit?: number }).limit ?? 60),
      "village.plan": (world, args) => villagePlan(world, (args as { ref: string }).ref as Ref),
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
          .settlements.inProvince((args as { cell: number }).cell)
          .map((s) => ({
            ref: s.ref,
            name: s.name,
            tile: s.tile,
            population: s.population,
            founded: s.founded,
          })),
      settlement: (world, args) => {
        const s = populationContext(world).settlements.get((args as { ref: string }).ref as Ref);
        if (!s) throw new Error(`no settlement ${(args as { ref: string }).ref}`);
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
      },
      ...OBSERVE_QUERIES,
      deposits: (world) =>
        homePlanet(world).generated.deposits.map((d) => ({
          ref: d.ref,
          kind: d.kind,
          cell: d.cell,
          richness: d.richness,
        })),
    },
  };
}

export const EARTH = planetUniverse("earth", EARTHLIKE);
export const ALIEN = planetUniverse("alien", OPEN);
