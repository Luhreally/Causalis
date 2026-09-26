// node tools/sky-survey.ts <seed|earth> [years] — a world's space age (Phase 5 M55): when
// its people found orbital flight and reached orbit, on what engine, against what speed
// its gravity well asked; its crews, stations and colonies; and what became of each colony
// — how far its ways and tongue have drifted from its founder's, whether it still answers
// to it, and why it left if it did. With timings and the save, for the budgets.
import { gzipSync } from "node:zlib";
import { YEAR, rulesetId, saveWorld, seedFromText, type Ref } from "../src/kernel/index.ts";
import { offworldSite, tongueLikeness } from "../src/gen/index.ts";
import { toOrbit } from "../src/rules/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import {
  SPACE_EVENTS,
  contactsOf,
  cultureOf,
  starSitesOf,
  starWarsOf,
  homePlanet,
  politiesOf,
  populationContext,
  spaceOf,
} from "../src/sim/index.ts";
import { spine } from "../src/causal/index.ts";

export type SkySurvey = {
  readonly seed: string;
  readonly years: number;
  /** The home world's pull and the speed to orbit it asks (km/s). */
  readonly gravity: number;
  readonly speed: number;
  /** When orbital flight was first found anywhere, and the firsts after. */
  readonly orbitalFlight: number | null;
  readonly satellite: {
    readonly year: number;
    readonly engine: string;
    /** Whether its why names the world's pull and the engine. */
    readonly whyPull: boolean;
    readonly whyEngine: boolean;
  } | null;
  readonly crew: number | null;
  readonly station: number | null;
  readonly colonies: readonly {
    readonly body: string;
    readonly founded: number;
    readonly people: number;
    readonly founder: string;
    /** Still ruled by its founder; if not, the year it left and whether its why reaches its grievance. */
    readonly ruled: boolean;
    readonly left: number | null;
    readonly whyLeft: string[];
    /** How far its ways lie from its founder's seat's, and how alike their tongues are (1: the same). */
    readonly ways: number;
    readonly tongue: number;
  }[];
  /** Ships to other stars: how many sailed and came down, and the first of each. */
  readonly voyages: {
    readonly sailed: number;
    readonly arrived: number;
    readonly firstSailed: number | null;
    readonly firstArrived: number | null;
  };
  /** The colonies among the stars: where, how many, and whether (and why) they left. */
  readonly starColonies: readonly {
    readonly distance: number;
    readonly people: number;
    readonly arrived: boolean;
    readonly ruled: boolean;
    readonly left: number | null;
    readonly whyLeft: string[];
  }[];
  /** Other peoples heard: how many, and the first year. */
  readonly contact: { readonly count: number; readonly first: number | null };
  /** Wars between the stars: how many; the first, and whether its why reaches a made thing of a world or star. */
  readonly starWars: {
    readonly count: number;
    readonly first: {
      readonly year: number;
      readonly won: boolean | null;
      readonly walk: string[];
      readonly reachesWorld: boolean;
    } | null;
  };
  /** Years a minute at this machine's full speed, over the last two centuries. */
  readonly pace: number;
  readonly slowest: number;
  readonly p99: number;
  readonly save: number;
  readonly lands: number;
  readonly ms: number;
};

export function skySurvey(seed: string, years: number): SkySurvey {
  const t0 = performance.now(),
    earth = seed === "earth",
    world = (earth ? EARTH : ALIEN).build(seedFromText(earth ? "first light" : seed)),
    g = homePlanet(world).generated,
    home = g.system.bodies[0],
    times: number[] = [];
  let orbitalFlight: number | null = null;
  const left = new Map<number, Ref>(),
    leftYear = new Map<number, number>(),
    owner = new Map<number, string | null>();
  for (let y = 1; y <= years; y++) {
    const a = performance.now();
    world.runTo(y * YEAR);
    times.push(performance.now() - a);
    const events = world.events.all();
    for (let i = events.length - 1; i >= 0 && events[i]!.t > (y - 1) * YEAR; i--) {
      const e = events[i]!;
      if (
        orbitalFlight === null &&
        e.type === "lore.found" &&
        (e.data as { principle?: string }).principle === "orbital-flight"
      )
        orbitalFlight = y;
      if (e.type === "polity.seceded" || e.type === "polity.split")
        for (const s of e.subjects) {
          const cell = Number(s.split(":")[2]);
          if (s.startsWith("cell:") && offworldSite(g, cell) && !left.has(cell))
            left.set(cell, e.id);
        }
    }
    // Every land of another body or star: who rules it, year by year; when it leaves its
    // ruler, the year's secession or split of that realm is why.
    const realmsNow = politiesOf(world);
    for (const p of populationContext(world).provinces.all()) {
      if (!offworldSite(g, p.cell)) continue;
      const now = realmsNow.of(p.cell)?.ref ?? null,
        before = owner.get(p.cell);
      if (before !== undefined && before !== null && now !== before && !leftYear.has(p.cell)) {
        leftYear.set(p.cell, y);
        for (let i = events.length - 1; i >= 0 && events[i]!.t > (y - 1) * YEAR; i--) {
          const e = events[i]!;
          if (
            (e.type === "polity.seceded" || e.type === "polity.split") &&
            e.subjects.includes(before as Ref) &&
            !left.has(p.cell)
          )
            left.set(p.cell, e.id);
        }
      }
      owner.set(p.cell, now);
    }
  }
  const space = spaceOf(world),
    realms = politiesOf(world),
    culture = cultureOf(world),
    ctx = populationContext(world),
    year = (r: Ref | null) => (r ? Math.floor((world.events.get(r)?.t ?? 0) / YEAR) : null),
    first = space.first.satellite ? world.events.get(space.first.satellite) : undefined,
    decision = first ? world.decisions.get(first.causes[0]!.ref as Ref) : undefined;
  const colonies: SkySurvey["colonies"][number][] = [];
  for (const p of space.all())
    for (const c of p.colonies) {
      const founder = realms.get(p.realm),
        ruler = realms.of(c.cell),
        seatWays = founder ? culture.get(founder.seat) : undefined,
        mine = culture.get(c.cell),
        leftBy = left.get(c.cell);
      colonies.push({
        body: g.system.bodies[offworldSite(g, c.cell)!.body]!.designation,
        founded: c.year,
        people: ctx.provinces.get(c.cell)?.total() ?? 0,
        founder: founder?.town ?? "?",
        ruled: !!ruler && ruler.ref === p.realm,
        left: leftYear.get(c.cell) ?? (leftBy ? year(leftBy) : null),
        whyLeft: leftBy ? spine(world, leftBy, 6).map((x) => x.claim) : [],
        ways:
          seatWays && mine
            ? Math.sqrt(mine.traits.reduce((s, v, i) => s + (v - seatWays.traits[i]!) ** 2, 0))
            : 0,
        tongue: seatWays && mine ? tongueLikeness(mine.tongue, seatWays.tongue) : 1,
      });
    }
  const sites = starSitesOf(world)?.all() ?? [],
    contacts = contactsOf(world).all(),
    wars = starWarsOf(world).all(),
    firstWar = wars[0],
    walk = firstWar ? spine(world, firstWar.event, 16).map((x) => x.ref as string) : [],
    recent = times.slice(-200),
    meanRecent = recent.reduce((a, b) => a + b, 0) / Math.max(1, recent.length);
  const starColonies = sites.map(([cell, st]) => {
    const r = realms.of(cell),
      by = left.get(cell);
    return {
      distance: st.distance,
      people: ctx.provinces.get(cell)?.total() ?? 0,
      arrived: st.arrived !== null,
      ruled: !!r && r.ref === st.realm,
      left: leftYear.get(cell) ?? null,
      whyLeft: by ? spine(world, by, 6).map((x) => x.claim) : [],
    };
  });
  const sorted = [...times].sort((a, b) => a - b),
    save = gzipSync(JSON.stringify(saveWorld(world, rulesetId(world, "sky")))).length;
  return {
    seed,
    years,
    gravity: home?.gravity ?? 0,
    speed: home ? toOrbit(home).total : 0,
    orbitalFlight,
    satellite: first
      ? {
          year: year(first.id)!,
          engine: (first.data as { engine: string }).engine,
          whyPull: !!decision?.factors.some((f) => f.source?.ref === g.planet.ref),
          whyEngine: !!decision?.factors.some((f) => /exhaust/.test(f.name)),
        }
      : null,
    crew: year(space.first.crew),
    station: year(space.first.station),
    colonies,
    voyages: {
      sailed: sites.length,
      arrived: sites.filter(([, st]) => st.arrived).length,
      firstSailed: sites.length ? Math.min(...sites.map(([, st]) => st.departed)) : null,
      firstArrived: sites.some(([, st]) => st.arrived)
        ? Math.min(...sites.filter(([, st]) => st.arrived).map(([, st]) => st.arrives))
        : null,
    },
    starColonies,
    contact: { count: contacts.length, first: contacts[0]?.year ?? null },
    starWars: {
      count: wars.length,
      first: firstWar
        ? {
            year: firstWar.declared,
            won: firstWar.won,
            walk,
            // Down its why to something made at the universe's making: a world, a star, a people of another star.
            reachesWorld: walk.some((r) => /^(plnt|star|civ|moon|cell|spec|depo|age):/.test(r)),
          }
        : null,
    },
    pace: Math.round(60_000 / Math.max(1, meanRecent)),
    slowest: Math.round(sorted.at(-1) ?? 0),
    p99: Math.round(sorted[Math.floor(sorted.length * 0.99)] ?? 0),
    save,
    lands: ctx.provinces.all().length,
    ms: Math.round(performance.now() - t0),
  };
}

if (import.meta.main) {
  const [seed = "earth", years = "1400"] = process.argv.slice(2);
  process.stdout.write(JSON.stringify(skySurvey(seed, Number(years))));
  void SPACE_EVENTS;
}
