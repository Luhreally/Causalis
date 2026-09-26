// A world with people (Phase 1): the home planet, and a first people in the
// province that suits them best — warm enough, watered, rich in what can be
// gathered — whose choice is itself a recorded decision the explainer can open.
import { World, YEAR, apportion, hashString, type Ref, type Seed } from "../../kernel/index.ts";
import { BIOME, cellRef, type HomeWorld } from "../../gen/index.ts";
import { FEMALE, G, HUMANLIKE, MALE, OCC } from "../../rules/index.ts";
import { MarketStore } from "../economy/market.ts";
import { installEconomy } from "../economy/systems.ts";
import { installActs } from "../acts/acts.ts";
import { installHand } from "../hand/hand.ts";
import { CultureStore, cradleWays, driftedWays } from "../culture/culture.ts";
import { installPolities } from "../polity/polity.ts";
import { installBelief } from "../belief/belief.ts";
import { installLore } from "../lore/lore.ts";
import { installDiplomacy } from "../diplomacy/diplomacy.ts";
import { installWar } from "../war/war.ts";
import { installCities } from "../city/city.ts";
import { installLocalActs } from "../acts/local.ts";
import { installDesigns } from "../design/design.ts";
import { makePlanetWorld, homePlanet, type PlanetWorldOptions } from "../planet/store.ts";
import { Province, capacity, row } from "./model.ts";
import { HistoryStore, PopulationStore, SettlementStore } from "./stores.ts";
import { POPULATION_EVENTS, installPopulation, populationContext } from "./systems.ts";

/** A population pyramid for a young people: shares of each age band. */
const PYRAMID = [0.16, 0.13, 0.12, 0.1, 0.17, 0.13, 0.09, 0.05, 0.03, 0.02];

/** The fewest the first people can be. */
export const FIRST_PEOPLE = 240;
/**
 * When the chronicle opens on the cradle, its people have lived there for ages and
 * filled close to half of what its wild feeds.
 */
export const CRADLE_FULLNESS = 0.45;

/** The province the first people live in: where the upright apes arose (gen/biosphere.ts). */
export function chooseHome(g: HomeWorld): number {
  if (!g.life.apes) throw new Error("no land fit for people on this world");
  return g.life.apes.cell;
}

/**
 * What a peopled world's history keeps: everything for twenty years, and for ever
 * whatever mattered enough to be remembered (a dry year, a road opened, a move),
 * so the chains the people's memories start down never break.
 */
export const PEOPLED_RETENTION = { window: 20 * YEAR, chronicle: 3 } as const;

export type PopulationWorldOptions = PlanetWorldOptions & {
  /**
   * Where the chronicle opens: "cradle", the first people in one province (Phase 1's
   * slice); or "spread", after a generated prehistory in which foraging bands have
   * spread across the land around the cradle (docs/architecture §7: prehistory is
   * generated, not ticked).
   */
  readonly start?: "cradle" | "spread";
};

/** The generated prehistory: how far the bands have spread, and how thinly. */
export const SPREAD = {
  /** Steps across the land from the cradle. */
  rings: 4,
  /** Of what a province's wild food could feed, the share its bands number. */
  density: 0.05,
  /** The fewest people a band's province holds. */
  least: 20,
} as const;

/** Set a province's people: a young people's pyramid, the grown foraging. */
function people(p: Province, n: number): void {
  apportion(n, PYRAMID).forEach((k, b) => {
    const [women, men] = apportion(k, [1, 1]);
    const occupation = HUMANLIKE.bands[b]! >= HUMANLIKE.adulthood ? OCC.forager : OCC.dependent;
    p.counts.set(row(FEMALE, b), occupation, women!);
    p.counts.set(row(MALE, b), occupation, men!);
  });
}

/** The habitable land within `rings` steps of a cell, nearest first (ties by cell), with each one's distance. */
function landAround(g: HomeWorld, from: number, rings: number): [number, number][] {
  const dist = new Map<number, number>([[from, 0]]),
    queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i]!,
      d = dist.get(c)!;
    if (d >= rings) continue;
    const next: number[] = [];
    for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++) {
      const n = g.grid.neighbours[k]!;
      if (dist.has(n) || g.tectonics.elevation[n]! <= 0) continue;
      const biome = g.climate.biome[n]!;
      if (biome === BIOME.ice || biome === BIOME.alpine || capacity(g, n).forage <= 0) continue;
      next.push(n);
    }
    for (const n of next.sort((a, b) => a - b)) {
      dist.set(n, d + 1);
      queue.push(n);
    }
  }
  return queue.map((c) => [c, dist.get(c)!]);
}

export function makePopulationWorld(seed: Seed, options: PopulationWorldOptions = {}): World {
  const world = makePlanetWorld(seed, { retention: PEOPLED_RETENTION, ...options });
  const provinces = world.register(new PopulationStore()),
    history = world.register(new HistoryStore());
  world.register(new SettlementStore());
  const markets = world.register(new MarketStore());
  world.addPinner(() => markets.pinned());
  world.addPinner(() => history.pinned());
  installPopulation(world);
  installEconomy(world);
  // The god's acts on provinces; inspiration grants the next way of life a people lacks.
  installActs(
    world,
    homePlanet(world).generated.grid.count,
    (cell) => (provinces.get(cell)?.total() ?? 0) > 0,
    (cell, event) => {
      // The next way of life the land allows: sowing where a wild grain grows near,
      // herding where a beast that can be tamed lives near, then smelting.
      const p = provinces.get(cell)!,
        life = homePlanet(world).generated.life,
        grid = homePlanet(world).generated.grid,
        near = (of: Int16Array) => {
          if (of[cell]! >= 0) return true;
          for (let k = grid.offsets[cell]!; k < grid.offsets[cell + 1]!; k++)
            if (of[grid.neighbours[k]!]! >= 0) return true;
          return false;
        };
      if (!p.knowsCultivation && near(life.seedGrass)) {
        p.knowsCultivation = true;
        p.cultivation = event;
        return "cultivation";
      }
      if (p.knowsCultivation && !p.herding && near(life.herdBeast)) {
        p.herding = event;
        return "herding";
      }
      const m = markets.of(cell);
      if (!m.metalworking) {
        m.metalworking = event;
        return "metalworking";
      }
      return null;
    },
  );

  installHand(world);
  installPolities(world, () => populationContext(world));
  installBelief(world, () => populationContext(world));
  installLore(world, () => populationContext(world));
  installDiplomacy(world, () => populationContext(world));
  installWar(world, () => populationContext(world));
  installCities(world, () => populationContext(world));
  installLocalActs(world, () => populationContext(world));
  installDesigns(world, () => populationContext(world));

  const g = homePlanet(world).generated,
    home = chooseHome(g),
    cap = capacity(g, home),
    apes = g.life.species[g.life.apes!.species]!,
    grass = g.life.seedGrass[home]!,
    first = Math.max(FIRST_PEOPLE, Math.round(CRADLE_FULLNESS * cap.forage));
  const decision = world.decisions.record({
    rule: "people.origin",
    subject: g.planet.ref as Ref,
    outcome: { cell: home },
    score: cap.forage / Math.max(1, cap.areaKm2),
    threshold: 0,
    factors: [
      {
        name: "where the upright apes arose",
        value: 1,
        contribution: 1,
        source: { ref: apes.ref as Ref, role: "trigger", weight: 1 },
      },
      {
        name: "beasts to hunt",
        value: g.life.diversity[home]!,
        contribution: 0.5,
        source: { ref: cellRef(0, home), role: "enabler", weight: 1 },
      },
      {
        name: "wild grain to gather",
        value: grass >= 0 ? g.life.species[grass]!.seed : 0,
        contribution: grass >= 0 ? 0.4 : 0,
        source:
          grass >= 0
            ? { ref: g.life.species[grass]!.ref as Ref, role: "enabler", weight: 1 }
            : null,
      },
      {
        name: "fresh water",
        value: g.water.river[home] ?? 0,
        contribution: g.water.river[home] ? 0.5 : 0,
        source: null,
      },
    ],
  });
  const origin = world.events.emit({
    type: POPULATION_EVENTS.origin.type,
    place: cellRef(0, home),
    causes: [{ ref: decision, role: "trigger", weight: 1 }],
    data: { people: first },
  });
  const culture = world.register(new CultureStore());
  world.addPinner(() => culture.pinned());
  const cradle = cradleWays(home, hashString(`culture ${seed.text}`), origin);
  culture.set(cradle);
  if (options.start !== "spread") {
    people(provinces.add(new Province(home, 0, origin)), first);
    // They bring half a year's food.
    markets.of(home).move("carriedIn", G.wild, first * 6);
    return world;
  }
  // The ages before the chronicle: bands spread from the cradle across the land.
  const lands = landAround(g, home, SPREAD.rings),
    sizes = lands.map(([c]) =>
      Math.max(SPREAD.least, Math.round(capacity(g, c).forage * SPREAD.density)),
    );
  const spread = world.events.emit({
    type: POPULATION_EVENTS.spread.type,
    place: cellRef(0, home),
    causes: [{ ref: origin, role: "trigger", weight: 1 }],
    data: { provinces: lands.length, people: sizes.reduce((a, b) => a + b, 0) },
  });
  lands.forEach(([cell, ring], i) => {
    people(provinces.add(new Province(cell, 0, cell === home ? origin : spread)), sizes[i]!);
    markets.of(cell).move("carriedIn", G.wild, sizes[i]! * 6);
    // The further the bands went, the further their ways and their speech drifted.
    if (cell !== home) culture.set(driftedWays(world, cradle, cell, ring, spread));
  });
  return world;
}
