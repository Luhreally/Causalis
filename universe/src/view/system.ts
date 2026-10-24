// The system view (Phase 5 M46): the star and its worlds laid out for the eye. A pure
// function of the plan and the time. Distances are drawn by their square root against
// the home world's (so the small inner worlds and the far giants share one screen);
// moons are set just beyond their planet, in the direction they truly lie; sizes by the
// fifth root of the radius. Units are scene units on the plane y = 0.
import { orbitXY, routeTo, toOrbit } from "../rules/index.ts";
import { hashString } from "../kernel/index.ts";
import type { PeoplesSky, SkyState, SystemPlan, SystemPlanBody } from "../bridge/index.ts";

export type Rgb = readonly [number, number, number];

export type SystemSpot = {
  readonly index: number;
  readonly x: number;
  readonly z: number;
  readonly size: number;
  readonly color: Rgb;
};

/** The scene distance of the home world from the star. */
export const HOME_DISTANCE = 6;
export const STAR_SIZE = 0.7;

/** A body's colour, from what it is: seas and life, heat, ice, gas. */
export function bodyColor(b: SystemPlanBody): Rgb {
  if (b.kind === "home") return [0.25, 0.5, 0.85];
  if (b.kind === "giant") return [0.8, 0.68, 0.5];
  if (b.kind === "ice giant") return [0.55, 0.75, 0.85];
  if (b.temperature > 300) return [0.9, 0.75, 0.45];
  if (b.water === "ice") return [0.85, 0.88, 0.92];
  if (b.water === "seas") return [0.3, 0.55, 0.7];
  if (b.air === "thick" || b.air === "crushing") return [0.85, 0.7, 0.4];
  return b.temperature > 50 ? [0.6, 0.55, 0.5] : [0.72, 0.45, 0.35];
}

/** A body's drawn size. */
export function bodySize(b: SystemPlanBody): number {
  return 0.24 * Math.pow(b.radius, 0.35) * (b.kind === "moon" ? 0.8 : 1);
}

/** How far out the farthest planet is drawn (for fitting the camera). */
export function systemExtent(plan: SystemPlan): number {
  const home = plan.bodies[0]!.a;
  let far = home;
  for (const b of plan.bodies) if (b.around < 0) far = Math.max(far, b.a * (1 + b.e));
  return HOME_DISTANCE * Math.sqrt(far / home);
}

function compress(x: number, y: number, home: number): { x: number; z: number } {
  const r = Math.hypot(x, y);
  if (r === 0) return { x: 0, z: 0 };
  const k = (HOME_DISTANCE * Math.sqrt(r / home)) / r;
  return { x: x * k, z: y * k };
}

/** Where each body is drawn at sim time t. */
export function systemSpec(plan: SystemPlan, t: number): SystemSpot[] {
  const home = plan.bodies[0]!.a,
    at: { x: number; z: number }[] = [];
  const out: SystemSpot[] = [];
  plan.bodies.forEach((b, i) => {
    const p = orbitXY(b, t);
    if (b.around < 0) at[i] = compress(p.x, p.y, home);
    else {
      // Beyond the planet's drawn size, a step further for each moon out.
      const parent = plan.bodies[b.around]!,
        base = at[b.around]!,
        order = plan.bodies.filter((m, j) => m.around === b.around && j < i).length,
        r = Math.hypot(p.x, p.y) || 1,
        d = bodySize(parent) + 0.18 + 0.16 * order;
      at[i] = { x: base.x + (p.x / r) * d, z: base.z + (p.y / r) * d };
    }
    out.push({ index: i, x: at[i]!.x, z: at[i]!.z, size: bodySize(b), color: bodyColor(b) });
  });
  return out;
}

/** Each planet's orbit as a ring of points (x, z pairs), drawn once. */
export function orbitRings(plan: SystemPlan, points = 96): Float32Array[] {
  const home = plan.bodies[0]!.a;
  return plan.bodies
    .filter((b) => b.around < 0)
    .map((b) => {
      const ring = new Float32Array(points * 2);
      for (let k = 0; k < points; k++) {
        const t = (k / points) * b.periodDays * 86_400,
          p = orbitXY({ ...b, phase: 0 }, t),
          c = compress(p.x, p.y, home);
        ring[k * 2] = c.x;
        ring[k * 2 + 1] = c.z;
      }
      return ring;
    });
}

/** A body's facts in words. */
export function bodyFacts(b: SystemPlanBody, star: SystemPlan["star"]): string[] {
  const around = b.around < 0 ? `the star (${star.spectral})` : "its planet";
  return [
    b.around < 0
      ? `${b.a.toFixed(2)} AU from ${around}; a year of ${b.periodDays >= 1000 ? `${(b.periodDays / 365.25).toFixed(1)} home years` : `${Math.round(b.periodDays)} days`}`
      : `${Math.round(b.a * 1000).toLocaleString("en")} km from ${around}; round it in ${b.periodDays.toFixed(1)} days`,
    `${b.mass >= 1 ? b.mass.toFixed(1) : b.mass.toPrecision(2)} times the home world's mass; gravity ${b.gravity.toFixed(2)} g; escape speed ${b.escape.toFixed(1)} km/s`,
    b.kind === "giant" || b.kind === "ice giant"
      ? `${Math.round(b.temperature)} °C at the cloud tops; no ground to stand on`
      : `${Math.round(b.temperature)} °C on the ground; ${b.air === "none" ? "no air" : `${b.air} air (${b.pressure < 0.01 ? b.pressure.toExponential(1) : b.pressure.toFixed(2)} bar)`}; ${b.water === "none" ? "no water" : b.water === "ice" ? "water as ice" : "seas"}`,
    b.kind === "giant" || b.kind === "ice giant"
      ? "its belts of radiation deadly"
      : `radiation ${b.radiation < 1.5 ? "about as at home" : `${Math.round(b.radiation)} times the home world's`}`,
    ...(b.kind === "giant" || b.kind === "ice giant"
      ? []
      : [
          `to orbit from its ground: ${toOrbit(b).total.toFixed(1)} km/s (${toOrbit(b).orbit.toFixed(1)} of orbit, the rest lost to its pull${b.pressure > 0.01 ? " and air" : ""})`,
        ]),
  ];
}

/** The way to a body from the home world's orbit, in words (null for the home world and the giants). */
export function routeWords(plan: SystemPlan, index: number, starMass: number): string | null {
  const b = plan.bodies[index]!;
  if (index === 0 || b.kind === "giant" || b.kind === "ice giant") return null;
  const r = routeTo(plan.bodies, index, starMass),
    days = r.days >= 730 ? `${(r.days / 365.25).toFixed(1)} years` : `${Math.round(r.days)} days`;
  return `from the home world's orbit to its ground: ${r.speed.toFixed(1)} km/s (${r.depart.toFixed(1)} to leave, ${r.arrive.toFixed(1)} to arrive, ${r.land.toFixed(1)} to land), ${days} on the way${r.window ? `; the way opens every ${Math.round(r.window)} days` : ""}`;
}

export type SkyMarks = {
  /** A ring about each body with halls on it. */
  readonly rings: readonly { readonly x: number; readonly z: number; readonly r: number }[];
  /** Satellites about the home world (one for each realm that has sent one up), and stations. */
  readonly satellites: readonly { readonly x: number; readonly z: number }[];
  readonly stations: readonly { readonly x: number; readonly z: number }[];
};

/**
 * Where the marks of flight and settlement are drawn, by the screen's clock (`screen`,
 * seconds): a satellite's true orbit of hours, watched at a month a second, would land
 * anywhere each frame, so each goes round in a few seconds instead.
 */
export function skyMarks(sky: SkyState, spots: readonly SystemSpot[], screen: number): SkyMarks {
  const bodies = [...new Set(sky.colonies.map((c) => c.body))].sort((a, b) => a - b),
    home = spots[0]!,
    satellites = sky.programs.filter((p) => p.satellite !== null),
    stations = sky.programs.filter((p) => p.station !== null);
  return {
    rings: bodies.map((b) => {
      const s = spots[b]!;
      return { x: s.x, z: s.z, r: s.size * 1.6 + 0.08 };
    }),
    satellites: satellites.map((_, i) =>
      circling(home, i, satellites.length, home.size + 0.1, 7, screen),
    ),
    stations: stations.map((_, i) =>
      circling(home, i, stations.length, home.size + 0.16, 13, screen),
    ),
  };
}

/** The k-th of n craft about a body, `r` out, going round once in `period` seconds of the screen's clock. */
function circling(
  at: SystemSpot,
  k: number,
  n: number,
  r: number,
  period: number,
  screen: number,
): { x: number; z: number } {
  const a = (2 * Math.PI * k) / Math.max(1, n) + (2 * Math.PI * screen) / period;
  return { x: at.x + r * Math.cos(a), z: at.z + r * Math.sin(a) };
}

/** What of the peoples of other stars is drawn about a system's worlds (Phase 18 M136). */
export type PeopleSystemMarks = {
  /** Their worlds, ringed in their colour (the world they rose on the wider). */
  readonly rings: readonly { x: number; z: number; r: number; color: Rgb; own: boolean }[];
  /** Their satellites and stations, and their embassies about the home world: lights in their colour. */
  readonly craft: readonly { x: number; z: number; size: number; color: Rgb }[];
  /**
   * Their ships about the system: plying between their world and the others, setting out
   * for another star (out to the system's edge, the way it lies), or coming in — and in war,
   * a fleet circling the world it struck. `fromX`/`fromZ`: where its course began, when drawn.
   */
  readonly ships: readonly {
    x: number;
    z: number;
    fromX: number;
    fromZ: number;
    course: boolean;
    color: Rgb;
    fleet: boolean;
    ref: string;
  }[];
  /** Their names over their worlds (and over a ship come to the home world). */
  readonly names: readonly { x: number; z: number; text: string; key: string; ref: string }[];
  /** The lanes their ships ply between their world and the others, faint. */
  readonly lanes: readonly { ax: number; az: number; bx: number; bz: number; color: Rgb }[];
};

/**
 * The peoples of other stars about the system of `star` at `year` (fractional, in ours):
 * whose worlds are there, what they have about them, and which of their ships are in it —
 * the first year of a crossing out, the last year of one in. The plying and circling go by
 * the screen's clock (`screen`, seconds).
 */
export function peopleSystemMarks(
  peoples: PeoplesSky | null | undefined,
  star: string,
  spots: readonly SystemSpot[],
  year: number,
  screen: number,
): PeopleSystemMarks {
  const rings: PeopleSystemMarks["rings"][number][] = [],
    craft: PeopleSystemMarks["craft"][number][] = [],
    ships: PeopleSystemMarks["ships"][number][] = [],
    names: PeopleSystemMarks["names"][number][] = [],
    lanes: PeopleSystemMarks["lanes"][number][] = [];
  if (!peoples || !spots.length) return { rings, craft, ships, names, lanes };
  const spot = (i: number | null | undefined) =>
      i === null || i === undefined ? undefined : spots.find((s) => s.index === i),
    home = star === peoples.home,
    // The system's edge, and the way each other star lies from it (as its ships come and go).
    edge = spots.reduce((m, s) => Math.max(m, Math.sqrt(s.x * s.x + s.z * s.z)), 0) * 1.2 + 1.5,
    toward = (ref: string) => {
      const a = ((hashString(ref) % 3600) / 3600) * 2 * Math.PI;
      return { x: edge * Math.cos(a), z: edge * Math.sin(a) };
    },
    // Where a people lives in this system, if it does.
    worldOf = (civ: PeoplesSky["civs"][number]) =>
      civ.star === star ? spot(civ.world) : spot(civ.holds.find((h) => h.star === star)?.world),
    // Where a ship coming in makes for: the home world, its own people's world here, or the
    // world of the people it comes against, or the innermost.
    target = (civ: PeoplesSky["civs"][number]) =>
      (home ? spots[0] : undefined) ??
      worldOf(civ) ??
      peoples.civs.map(worldOf).find((w) => w !== undefined) ??
      spots[0]!;
  for (const civ of peoples.civs) {
    const at = worldOf(civ);
    if (!at) continue;
    const own = civ.star === star,
      key = hashString(civ.ref);
    rings.push({ x: at.x, z: at.z, r: at.size * (own ? 2.1 : 1.7) + 0.1, color: civ.color, own });
    names.push({
      x: at.x,
      z: at.z,
      text: `👽 ${civ.name}`,
      key: `people:${civ.ref}`,
      ref: civ.ref,
    });
    // Satellites once it reached orbit, stations once it reached the stars; a hold, one of each.
    const sats = own ? (year >= civ.orbit ? (year >= civ.stars ? 5 : 3) : 0) : 1,
      stations = own ? (year >= civ.stars ? 2 : 0) : 1;
    for (let k = 0; k < sats; k++)
      craft.push({
        ...circling(at, k, sats, at.size + 0.1 + 0.03 * (k % 2), 6 + (key % 5), screen),
        size: 0.028,
        color: civ.color,
      });
    for (let k = 0; k < stations; k++)
      craft.push({
        ...circling(at, k, stations, at.size + 0.22, -(11 + (key % 7)), screen),
        size: 0.06,
        color: civ.color,
      });
    // At the stars, its ships ply between its world and the system's others.
    if (year < civ.stars || spots.length < 2) continue;
    for (let k = 0; k < (own ? 3 : 1); k++) {
      const others = spots.filter((s) => s !== at),
        to = others[(key + 7 * k) % others.length]!,
        phase = (screen / (14 + 3 * k) + k / 3 + (key % 10) / 10) % 1,
        p = phase < 0.5 ? 2 * phase : 2 - 2 * phase,
        e = p * p * (3 - 2 * p);
      if (!lanes.some((l) => l.bx === to.x && l.bz === to.z))
        lanes.push({ ax: at.x, az: at.z, bx: to.x, bz: to.z, color: civ.color });
      ships.push({
        x: at.x + (to.x - at.x) * e,
        z: at.z + (to.z - at.z) * e,
        fromX: at.x,
        fromZ: at.z,
        course: false,
        color: civ.color,
        fleet: false,
        ref: civ.ref,
      });
    }
  }
  // Its ships crossing between the stars, while they are in this system.
  for (const s of peoples.ships) {
    const civ = peoples.civs.find((c) => c.ref === s.civ);
    if (!civ) continue;
    const fleet = s.kind === "fleet";
    if (s.from === star && year >= s.sailed && year < s.sailed + 1) {
      const from = worldOf(civ) ?? spots[0]!,
        out = toward(s.to),
        e = year - s.sailed;
      ships.push({
        x: from.x + (out.x - from.x) * e,
        z: from.z + (out.z - from.z) * e,
        fromX: from.x,
        fromZ: from.z,
        course: true,
        color: civ.color,
        fleet,
        ref: s.event,
      });
    }
    if (s.to === star && year >= s.arrives - 1 && year < s.arrives) {
      const from = toward(s.from),
        to = target(civ),
        e = 1 - (s.arrives - year);
      ships.push({
        x: from.x + (to.x - from.x) * e,
        z: from.z + (to.z - from.z) * e,
        fromX: from.x,
        fromZ: from.z,
        course: true,
        color: civ.color,
        fleet,
        ref: s.event,
      });
      if (home)
        names.push({
          x: from.x + (to.x - from.x) * e,
          z: from.z + (to.z - from.z) * e,
          text: `${fleet ? "⚔️" : "🛸"} ${civ.name}`,
          key: `ship:${s.event}`,
          ref: s.event,
        });
    }
  }
  // About the home world, a station of each people that speaks with one of its realms in friendship.
  if (home) {
    const friends = peoples.civs.filter((c) =>
      peoples.meetings.some(
        (m) => m.civ === c.ref && m.star === peoples.home && m.talking && m.regard > 0,
      ),
    );
    friends.forEach((c, k) =>
      craft.push({
        ...circling(spots[0]!, k, friends.length, spots[0]!.size + 0.32, 17, screen),
        size: 0.06,
        color: c.color,
      }),
    );
  }
  // A fleet that struck here this past year, circling the world it struck.
  for (const r of peoples.raids) {
    if (r.star !== star || year < r.year || year >= r.year + 1) continue;
    const civ = peoples.civs.find((c) => c.ref === r.civ);
    if (!civ) continue;
    const at = home
        ? spots[0]!
        : (peoples.civs
            .filter((c) => c !== civ)
            .map(worldOf)
            .find((w) => w !== undefined) ?? spots[0]!),
      p = circling(at, 0, 1, at.size + 0.45, 5, screen);
    ships.push({
      ...p,
      fromX: p.x,
      fromZ: p.z,
      course: false,
      color: civ.color,
      fleet: true,
      ref: r.event,
    });
  }
  return { rings, craft, ships, names, lanes };
}
