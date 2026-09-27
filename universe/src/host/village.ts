// The microscope's plan of a village (docs/architecture §9, watch mode): the
// families met there — meeting more if few are known, which is the observer's own
// act and never history's — and where their village stands: its homes, its
// fields toward the better ground, its pasture, the wild beyond, the square or the
// market at its heart, the road out — and what lives about it: the land's wild beasts,
// its hunters and its flocks (Phase 8 M77). Everything here is looked at, not lived: the
// people's day is drawn from this plan by the view, and nothing flows back.
import { finish, hashString, mix, type Ref, type World } from "../kernel/index.ts";
import { WATER, livingIn, type Species } from "../gen/index.ts";
import { G, OCC, roofPitch } from "../rules/index.ts";
import {
  agentName,
  BLOCK_M,
  blockAt,
  BLOCKS,
  citiesOf,
  designsOf,
  handOf,
  houseFor,
  beliefOf,
  lifeOf,
  loreOf,
  marketsOf,
  politiesOf,
  populationContext,
  regionOf,
  USE,
  warsOf,
  wildsOf,
} from "../sim/index.ts";
import { meetHousehold, observer, settleAll } from "../causal/index.ts";
import { LAKE_R, WATER_OUT, type VillageLife, type VillagePlan } from "../bridge/index.ts";

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
  for (let k = 0; city && homes.length < 4; k++) {
    const a = phase + k * 2.399963,
      rad = (BLOCKS * BLOCK_M) / 2 + 30;
    homes.push({ x: rad * Math.cos(a), z: rad * Math.sin(a), yaw: a, household: null });
  }
  // A village's homes circle its square.
  const wanted = city ? 0 : count;
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
      people.push({
        ref: p.ref,
        name: `${p.name} ${p.surname}`,
        home,
        age: now - p.birthYear,
        occupation: p.occupation,
        child: now - p.birthYear < lifeOf(world).adulthood,
      });
    }
  });
  return planOf(people);

  /**
   * How the village lives now (M86), for what its people are seen doing and saying: from
   * its land's year (fed, growing in number), its realm (at war, its grievance), its faith,
   * its living world's turns, what it has learned lately, and the watched families' years.
   */
  function lifeNow(cell: number, population: number): VillageLife {
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
    if (fed < 0.85) talk.push("hunger");
    if (war) talk.push("war");
    if (unrest > 0.3) talk.push("unrest");
    if (mourning.length) talk.push("grief");
    if (w.flocksTaken) talk.push("flocks");
    if (w.grainEaten) talk.push("pests");
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
    // The next home rises where the next would stand in the village's ring, as far built as
    // the families it will house have come.
    const k = homes.length,
      a = phase + k * 2.399963,
      rad = 16 + 8.5 * Math.sqrt(k),
      site =
        growing && !city && k < 400
          ? {
              x: rad * Math.cos(a),
              z: rad * Math.sin(a),
              yaw: a + u(seed, 10 + k) * 0.6,
              progress: Math.max(0.12, population / 5 - Math.floor(population / 5)),
            }
          : null;
    return { fed, growing, war, unrest, faith, talk, site, mourning, newborn };
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
    if (own >= 0) return life.species[own]!;
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

  /** How far the land has come, for what its people wear, carry and dig with. */
  function eraOf(cell: number): NonNullable<VillagePlan["era"]> {
    // (Sowing is the land's own knowing; smelting shows in its market too.)
    const lore = loreOf(world),
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
      works: worksOf(village.cell),
      life: lifeNow(village.cell, village.population),
      body: (() => {
        const b = ctx.generated.life.people?.body;
        return b
          ? {
              clade: b.clade,
              medium: b.medium,
              symmetry: b.symmetry,
              manipulators: b.manipulators,
              limbs: b.limbs,
              skin: b.skin,
              size: b.size,
              span: b.span,
            }
          : null;
      })(),
      // A city's road runs along its axis; a village's out toward the far fields.
      road: city
        ? { x: 1100 * Math.cos(city.axis), z: 1100 * Math.sin(city.axis) }
        : { x: 1100 * Math.cos(roadWay), z: 1100 * Math.sin(roadWay) },
      districts: city
        ? { blocks: BLOCKS, blockM: BLOCK_M, uses: city.uses, paved: !!city.paved }
        : null,
      people,
    };
  }
}
