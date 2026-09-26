// The microscope's plan of a village (docs/architecture §9, watch mode): the
// families met there — meeting more if few are known, which is the observer's own
// act and never history's — and where their village stands: its homes, its
// fields toward the better ground, its pasture, the wild beyond, the square or the
// market at its heart, the road out. Everything here is looked at, not lived: the
// people's day is drawn from this plan by the view, and nothing flows back.
import { finish, hashString, mix, type Ref, type World } from "../kernel/index.ts";
import { WATER } from "../gen/index.ts";
import { HUMANLIKE, roofPitch } from "../rules/index.ts";
import {
  BLOCKS,
  BLOCK_M,
  agentName,
  blockAt,
  citiesOf,
  designsOf,
  houseFor,
  handOf,
  populationContext,
  regionOf,
} from "../sim/index.ts";
import { meetHousehold, observer, settleAll } from "../causal/index.ts";
import type { VillagePlan } from "../bridge/index.ts";

/** Families the microscope watches in a village: a presentation budget, not a rule. */
export const WATCHED_FAMILIES = 10;
/** Under the hand, at most this many of the village's people are drawn (all of them live). */
export const DRAWN_UNDER_HAND = 400;

const u = (seed: number, n: number) => finish(mix(seed, n), 13) / 4294967296;

export function villagePlan(world: World, ref: Ref, families = WATCHED_FAMILIES): VillagePlan {
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
    i0 = v.tile % r.size,
    j0 = Math.floor(v.tile / r.size),
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
  const best = [...ways].sort((a, b) => b.soil - a.soil || a.angle - b.angle),
    fieldWay = best[0]?.angle ?? 0,
    pastureWay = best.at(-1)?.angle ?? Math.PI,
    waterWay = ways.find((w) => w.water)?.angle ?? null;

  // Homes for everyone, the watched among them; five to a home. A city's homes stand
  // in its housing quarters; a village's around its square.
  const city = citiesOf(world).get(ref),
    homes: { x: number; z: number; yaw: number; household: string | null }[] = [],
    count = Math.max(4, Math.min(160, Math.ceil(v.population / 5))),
    phase = u(seed, 1) * 2 * Math.PI;
  if (city) {
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
  }
  // A village's homes circle its square; a young city with few housing blocks yet
  // keeps homes around its square too, until every family has one.
  const wanted = city ? Math.min(count, WATCHED_FAMILIES * 2 + 4) : count;
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
    edge = city ? (BLOCKS * BLOCK_M) / 2 + 60 : 16 + 8.5 * Math.sqrt(count) + 30,
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
          child: now - a.birthYear < HUMANLIKE.adulthood,
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
      people.push({
        ref: p.ref,
        name: `${p.name} ${p.surname}`,
        home,
        age: now - p.birthYear,
        occupation: p.occupation,
        child: now - p.birthYear < HUMANLIKE.adulthood,
      });
    }
  });
  return planOf(people);

  /** The land's house design (realized now if the land has none yet). */
  function houseOf(cell: number): VillagePlan["house"] {
    const design = designsOf(world).of(ctx.provinces.get(cell)!.ref),
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

  function planOf(people: VillagePlan["people"][number][]): VillagePlan {
    const village = v!;
    return {
      ref,
      hand: !!hand && hand.village === ref,
      name: village.name,
      population: village.population,
      market: village.market !== null,
      biome: r.biome[village.tile]!,
      seed,
      homes,
      fields,
      pasture: { x: 560 * Math.cos(pastureWay), z: 560 * Math.sin(pastureWay), r: 150 },
      wild: 900,
      water:
        waterWay === null ? null : { x: 700 * Math.cos(waterWay), z: 700 * Math.sin(waterWay) },
      house: houseOf(village.cell),
      // A city's road runs along its axis; a village's out toward the far fields.
      road: city
        ? { x: 1100 * Math.cos(city.axis), z: 1100 * Math.sin(city.axis) }
        : {
            x: 1100 * Math.cos(fieldWay + Math.PI * 0.75),
            z: 1100 * Math.sin(fieldWay + Math.PI * 0.75),
          },
      districts: city
        ? { blocks: BLOCKS, blockM: BLOCK_M, uses: city.uses, paved: !!city.paved }
        : null,
      people,
    };
  }
}
