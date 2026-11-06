// A colony's world as it looks from its ground (Phase 64, asked for 2026-11-03: "i wanna see the star
// wars and landing in planets and colonization and all that stuff"): its sky by what air it has (black
// and starred over an airless rock, a thin dusky wash, a thick haze, its own blue where it can be
// breathed); its star as small and as cold or hot as it is from there; the planet a moon circles,
// hanging huge over its horizon; its rock in the colours the world is painted seen whole, its ice, the
// hills about its halls. And the ship that brought them: its crossing, its descent, and the first halls
// set up, as functions of a film's clock. Pure: what is drawn, for the renderer to draw.
import { remadeWorld, remakingAt, rockOf } from "../rules/index.ts";
import { kindWater } from "./globe.ts";
import type { ColonyLook, ColonyVoyage } from "../bridge/index.ts";

type Rgb = readonly [number, number, number];

const mix = (a: Rgb, b: Rgb, k: number): Rgb => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
];
const css = (c: Rgb) =>
  `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;

/** A star's colour by its heat: blue-white when hot, through white and gold, to a red dwarf's orange. */
export function starHue(kelvin: number): Rgb {
  if (kelvin > 7500) return [0.78, 0.86, 1];
  if (kelvin > 6000) return [0.96, 0.96, 1];
  if (kelvin > 5200) return [1, 0.95, 0.8];
  if (kelvin > 3900) return [1, 0.8, 0.52];
  return [1, 0.6, 0.38];
}

export type ColonySky = {
  /** No air to speak of: a black sky, stars at noon, a hard horizon and hard shadows. */
  readonly airless: boolean;
  /** The sky from its top to its horizon, by day, as the page paints it behind the world. */
  readonly stops: readonly [string, string, string, string];
  /** The air's haze over the far ground (null: none, there being no air). */
  readonly haze: Rgb | null;
  /** How far off its haze begins, against the usual (1: the home world's). */
  readonly clearness: number;
  /** The star's light: its colour, and its strength against the home world's noon. */
  readonly sun: Rgb;
  readonly strength: number;
  /** The fill of light from the sky and the ground. */
  readonly fill: Rgb;
};

/**
 * Over a people of the water's town: their sea, its own colour all the way up and paling toward its
 * surface; its far towers lost in it sooner than in air; the star's light cooled coming down.
 */
export function seaSky(kind: string): ColonySky {
  const sea = kindWater(kind)?.sea ?? ([0.08, 0.3, 0.66] as Rgb),
    surface: Rgb = [0.72, 0.92, 0.98],
    deep: Rgb = [0.01, 0.03, 0.08];
  return {
    airless: false,
    stops: [
      css(mix(sea, surface, 0.6)),
      css(mix(sea, surface, 0.25)),
      css(sea),
      css(mix(sea, deep, 0.4)),
    ],
    haze: mix(sea, deep, 0.25),
    clearness: 0.5,
    sun: mix(surface, [1, 1, 1], 0.3),
    strength: 0.8,
    fill: [0.26, 0.4, 0.5],
  };
}

/** What a world's sky is, from its air and its star. */
export function colonySky(look: ColonyLook): ColonySky {
  const hue = starHue(look.star.temperature),
    // (The eye takes a dim star's noon as dusk, not as black: a cube root of its light.)
    strength = Math.max(0.42, Math.min(1.3, 1.25 * Math.cbrt(look.star.light))),
    air = look.air,
    airless = air === "none" || air === "trace";
  if (airless)
    return {
      airless,
      stops: ["#01020a", "#03040f", "#05060f", "#0a0a14"],
      haze: null,
      clearness: 6,
      sun: hue,
      strength,
      // (Light only from its own ground: hard, deep shadows, but not so deep as to hide what is built.)
      fill: [0.3, 0.3, 0.34],
    };
  const rock = rockOf(look.kind, air, look.tint, look.temperature);
  if (air === "thin") {
    // A dusty wash, darkening fast overhead, lit by what is blown up from its ground.
    const low = mix(rock, hue, 0.35);
    return {
      airless,
      stops: [
        css(mix([0.04, 0.04, 0.1], low, 0.15)),
        css(mix([0.08, 0.08, 0.16], low, 0.4)),
        css(mix([0.2, 0.2, 0.26], low, 0.65)),
        css(mix(low, [1, 1, 1], 0.14)),
      ],
      haze: mix(low, [0.8, 0.8, 0.84], 0.2),
      clearness: 2.6,
      sun: hue,
      strength,
      fill: [0.22, 0.2, 0.22],
    };
  }
  if (air === "breathable") {
    const top = mix([0.16, 0.36, 0.78], hue, 0.08),
      low = mix([0.72, 0.84, 0.98], hue, 0.2);
    return {
      airless,
      stops: [css(top), css(mix(top, low, 0.45)), css(mix(top, low, 0.85)), css(low)],
      haze: low,
      clearness: 1,
      sun: hue,
      strength,
      fill: [0.34, 0.38, 0.5],
    };
  }
  // A thick or crushing air: its own colour all the way up, the star a bright patch in it.
  const murk = mix(rock, hue, 0.3);
  return {
    airless,
    stops: [
      css(mix(murk, [0.1, 0.08, 0.06], 0.55)),
      css(mix(murk, [0.1, 0.08, 0.06], 0.25)),
      css(murk),
      css(mix(murk, [1, 1, 1], 0.18)),
    ],
    haze: mix(murk, [1, 1, 1], 0.12),
    clearness: 0.7,
    sun: mix(hue, murk, 0.4),
    strength: strength * 0.8,
    fill: [0.36, 0.32, 0.26],
  };
}

/**
 * The hour on a colony's ground, a share of its own day: `since` seconds after the eye came down, in
 * its morning with its star low (nothing in history reads its sun: its people keep the home world's
 * hours under their domes, and the sun over them keeps its own).
 */
export function colonyHour(look: ColonyLook, since: number): number {
  const share = 0.31 + since / (Math.max(1, look.day) * 3600);
  return share - Math.floor(share);
}

/** A world's rock in its tones: its plain, its darker and lighter facets, its ice, its apron of trodden ground. */
export function colonyRock(look: ColonyLook): {
  readonly rock: Rgb;
  readonly dark: Rgb;
  readonly light: Rgb;
  readonly ice: Rgb;
  readonly apron: Rgb;
} {
  // (Green coming over it as it is remade: Phase 66.)
  const bare = rockOf(look.kind, look.air, look.tint, look.temperature),
    rock = look.remade ? mix(bare, [0.3, 0.48, 0.2], look.remade * 0.86) : bare;
  return {
    rock,
    dark: mix(rock, [0.06, 0.06, 0.08], 0.32),
    light: mix(rock, [1, 1, 1], 0.2),
    ice: [0.82, 0.88, 0.94],
    apron: mix(rock, [0.42, 0.42, 0.44], 0.45),
  };
}

/** A keyed share in [0, 1) (the view's own, not history's). */
export function colonyHash(seed: number, i: number, k: number): number {
  let h = (seed ^ Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(k + 7, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth noise over the ground (metres), for its hills. */
function noise(seed: number, x: number, z: number): number {
  const xi = Math.floor(x),
    zi = Math.floor(z),
    fx = x - xi,
    fz = z - zi,
    u = fx * fx * (3 - 2 * fx),
    v = fz * fz * (3 - 2 * fz),
    c = (i: number, j: number) => colonyHash(seed, i * 73 + j, 11);
  return (
    c(xi, zi) * (1 - u) * (1 - v) +
    c(xi + 1, zi) * u * (1 - v) +
    c(xi, zi + 1) * (1 - u) * v +
    c(xi + 1, zi + 1) * u * v
  );
}

/**
 * How high the ground stands at a point (units of the town's scene, a unit ten metres): flat where
 * its halls stand and for a way about them, rising beyond into its world's hills.
 */
export function colonyHeight(seed: number, x: number, z: number, flat: number, rough = 1): number {
  const r = Math.hypot(x, z);
  if (r <= flat) return 0;
  const k = Math.min(1, (r - flat) / Math.max(130, flat * 1.3)),
    ramp = k * k * (3 - 2 * k),
    a = noise(seed, x / 90, z / 90),
    b = noise(seed ^ 0x5bd1, x / 34, z / 34),
    c = noise(seed ^ 0x1f3d, x / 13, z / 13);
  return ramp * rough * (Math.pow(a, 1.6) * 24 + b * 7 + c * 1.8);
}

/** How rough its world's far ground stands: mountains under no weather, low dunes under a thick air. */
export function colonyRough(look: ColonyLook): number {
  return look.air === "none" || look.air === "trace"
    ? 1
    : look.air === "thin"
      ? 0.8
      : look.air === "breathable"
        ? 0.7
        : 0.45;
}

// ———————————————————————————— The film of a landing ————————————————————————————

/** What a film of a landing shows at a moment of its own clock. */
export const FILM = {
  /** Seconds of the crossing seen among the worlds (or stars). */
  crossing: 9,
  /** Seconds of the world coming up to meet it, seen from orbit. */
  arrival: 5,
  /** Seconds of its descent to the ground, seen from the ground. */
  descent: 8,
  /** Seconds its settlers set up the first halls. */
  first: 6,
  /** Seconds the years go by while its halls grow into a town. */
  growth: 18,
} as const;

/** A part of a film of a landing. */
export type FilmStage = keyof typeof FILM;

/** A film's shots and how long each runs: a young colony's years go by the sooner. */
export function filmShots(years: number): readonly { stage: FilmStage; seconds: number }[] {
  return [
    { stage: "crossing", seconds: FILM.crossing },
    { stage: "arrival", seconds: FILM.arrival },
    { stage: "descent", seconds: FILM.descent },
    { stage: "first", seconds: FILM.first },
    { stage: "growth", seconds: years >= 30 ? FILM.growth : years >= 3 ? 9 : 3 },
  ];
}

const number = (n: number) => Math.round(n).toLocaleString("en");

export { remakingAt };

/** A world told of in a landing's film, as it stood at a share of its remaking (Phase 66). */
export function remadeLook(look: ColonyLook, share: number): ColonyLook {
  return look.remaking
    ? { ...look, ...remadeWorld(look.remaking.base, share), remade: share }
    : look;
}

/** A world's air, in a few words. */
function airWords(look: ColonyLook): string {
  return look.air === "none"
    ? "no air"
    : look.air === "trace"
      ? "next to no air"
      : `${look.air} air`;
}

/** What a shot of a landing says, from what history and the worlds' numbers hold. */
export function filmWords(
  stage: FilmStage,
  look: ColonyLook,
  voyage: ColonyVoyage,
  founder: string | null,
): string {
  const who = founder ?? "a realm long fallen",
    // (A world of another star has no name but its letter.)
    there = voyage.kind === "star" ? "A world of another star" : look.body;
  switch (stage) {
    case "crossing": {
      if (voyage.kind === "star")
        return `Year ${voyage.departed}. A ship of ${who} sails for another star: ${voyage.distance.toFixed(1)} light-years, ${Math.max(1, voyage.arrives - voyage.departed)} years under ${voyage.drive ?? "its drive"}.`;
      const long =
        voyage.days >= 730
          ? `${(voyage.days / 365.25).toFixed(1)} years`
          : `${Math.round(voyage.days)} days`;
      return `Year ${Math.floor(look.founded - voyage.days / 365)}. A ship of ${who} leaves the home world for ${look.body}: ${long} on the way${voyage.speed !== null ? `, ${voyage.speed.toFixed(1)} km/s asked of it` : ""}.`;
    }
    case "arrival":
      return `Year ${look.founded}. ${there} comes up to meet them: ${airWords(look)}, ${Math.round(look.temperature)} °C on the ground, ${look.gravity.toFixed(2)} g.`;
    case "descent":
      return look.air === "none" || look.air === "trace"
        ? `Nothing but its own engines to slow it. ${number(look.settlers)} settlers aboard.`
        : `Down through ${airWords(look)} on its engines. ${number(look.settlers)} settlers aboard.`;
    case "first":
      return look.keeps.length
        ? `They come out and set up the first pods: ${look.keeps.slice(0, 2).join("; ")}.`
        : "They come out and set up the first pods.";
    case "growth":
      return "The ship goes back up for more, and the years go by.";
  }
}

/** Where a ship is along its transfer: a share of the way (0 … 1), slowed at both ends. */
export function crossingShare(t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
}

/**
 * A transfer between two points of the system's plane, bowed out from the star as an orbit is: a half
 * of an ellipse about it, from (ax, az) at one end to (bx, bz) at the other; `share` of the way.
 */
export function transferAt(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  share: number,
): { x: number; y: number; z: number } {
  const ra = Math.hypot(ax, az),
    rb = Math.hypot(bx, bz),
    a0 = Math.atan2(az, ax);
  let a1 = Math.atan2(bz, bx);
  // (Prograde, the long way round if it must: a transfer sweeps about half the way about its star.)
  while (a1 < a0 + 1.6) a1 += 2 * Math.PI;
  if (a1 > a0 + 2 * Math.PI) a1 -= 2 * Math.PI;
  const k = Math.max(0, Math.min(1, share)),
    a = a0 + (a1 - a0) * k,
    // (Its distance from the star easing from one end to the other, as a falling or climbing orbit does.)
    e = (1 - Math.cos(k * Math.PI)) / 2,
    r = ra + (rb - ra) * e;
  return { x: r * Math.cos(a), y: 0.12 * Math.sin(k * Math.PI), z: r * Math.sin(a) };
}

/**
 * The lander over its pad at a moment of the descent (0 … 1): how high (units), how far short of its
 * pad along its line of coming (units), how hard its engines burn (0 … 1) and how far it leans back
 * against its way. It falls from far overhead, brakes hard and comes down the last of the way slowly
 * on its flame.
 */
export function descentAt(k: number): {
  readonly high: number;
  readonly short: number;
  readonly burn: number;
  readonly lean: number;
} {
  const t = Math.max(0, Math.min(1, k)),
    // (Falling fast, then braking: most of its height lost in the first half of the time.)
    high = 150 * Math.pow(1 - t, 2.4),
    short = 110 * Math.pow(1 - t, 3),
    burn = t < 0.12 ? 0.35 : t >= 1 ? 0 : t > 0.97 ? (1 - t) / 0.03 : 1;
  return { high, short, burn, lean: 0.6 * Math.pow(1 - t, 2) };
}

/** A lander's parts, about its middle at its feet (metres; for ten-metre units, as the town's). */
export type LanderPart = {
  readonly mesh: "box" | "cyl" | "cone" | "dome";
  readonly color: Rgb;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
};

const HULL: Rgb = [0.82, 0.84, 0.86],
  STRIPE: Rgb = [0.86, 0.34, 0.14],
  DARKS: Rgb = [0.24, 0.25, 0.28],
  LEG: Rgb = [0.5, 0.52, 0.56],
  PORT: Rgb = [0.3, 0.62, 0.86];

/** A settlers' lander: a fat drum on four legs, its nose and its ports, its engine bells under it. */
export function landerParts(): readonly LanderPart[] {
  const parts: LanderPart[] = [
    // Its drum, a band about it, its stepped nose.
    { mesh: "cyl", color: HULL, x: 0, y: 17, z: 0, sx: 16, sy: 18, sz: 16 },
    { mesh: "cyl", color: STRIPE, x: 0, y: 17, z: 0, sx: 16.3, sy: 2.4, sz: 16.3 },
    { mesh: "cone", color: HULL, x: 0, y: 32, z: 0, sx: 16, sy: 12, sz: 16 },
    { mesh: "cyl", color: DARKS, x: 0, y: 39, z: 0, sx: 2.2, sy: 2.6, sz: 2.2 },
    // Its engine bells under it.
    { mesh: "cone", color: DARKS, x: 0, y: 6.4, z: 0, sx: 8, sy: 3.6, sz: 8 },
  ];
  // Four legs splayed, each with a foot.
  for (const [u, v] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    parts.push(
      { mesh: "box", color: LEG, x: u * 8, y: 6, z: v * 8, sx: 1, sy: 12, sz: 1 },
      { mesh: "box", color: LEG, x: u * 5.8, y: 9.5, z: v * 5.8, sx: 0.7, sy: 0.7, sz: 7 },
      { mesh: "cyl", color: DARKS, x: u * 8, y: 0.3, z: v * 8, sx: 3.4, sy: 0.6, sz: 3.4 },
    );
  }
  // A row of ports about its drum, a door and its ramp.
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * 2 * Math.PI;
    parts.push({
      mesh: "box",
      color: PORT,
      x: Math.cos(a) * 8,
      y: 23,
      z: Math.sin(a) * 8,
      sx: 1.3,
      sy: 1.3,
      sz: 1.3,
    });
  }
  parts.push(
    { mesh: "box", color: DARKS, x: 0, y: 12, z: 8, sx: 4, sy: 5.6, sz: 0.6 },
    { mesh: "box", color: LEG, x: 0, y: 4.6, z: 14.5, sx: 4, sy: 0.5, sz: 15 },
  );
  return parts;
}

/**
 * A pod of the first camp at a moment after the landing (0 … 1 of its rising): grown from its footing.
 * The first few round the lander, in the order they went up.
 */
export function firstPods(n: number): readonly { x: number; z: number; r: number }[] {
  const out: { x: number; z: number; r: number }[] = [];
  for (let k = 0; k < n; k++) {
    const a = 0.7 + k * 2.399963,
      rad = 30 + 9 * Math.sqrt(k);
    out.push({ x: rad * Math.cos(a), z: rad * Math.sin(a), r: 4.2 + (k % 3) * 0.8 });
  }
  return out;
}

/**
 * Where a film of a town's growth has come to at a share of it (0 … 1): its frames (the years it is
 * drawn as it stood, host/colony.ts) in turn, each held as long as the next, and the year counted on
 * from each to the next.
 */
export function growthAt(
  years: readonly number[],
  share: number,
): { readonly frame: number; readonly year: number } {
  const last = years.length - 1;
  if (last < 0) return { frame: -1, year: 0 };
  const s = Math.max(0, Math.min(1, share)) * last,
    frame = Math.min(last, Math.floor(s)),
    next = Math.min(last, frame + 1);
  return { frame, year: years[frame]! + (years[next]! - years[frame]!) * (s - frame) };
}

/** Where a settler is at a moment of the first camp (0 … 1): down its ramp, out to a pod, and busy there. */
export function settlerAt(
  i: number,
  k: number,
  pod: { readonly x: number; readonly z: number; readonly r: number },
): { readonly x: number; readonly y: number; readonly z: number; readonly walking: boolean } {
  const go = Math.max(0, Math.min(1, (k - 0.022 * i) / 0.6)),
    // (Off its door, down its ramp; then each to their pod, stopping short of it by an arm's length.)
    ramp = Math.min(1, go / 0.3),
    door = { x: 0, y: 8, z: 10 },
    foot = { x: 0, y: 0.3, z: 22 },
    y = door.y + (foot.y - door.y) * ramp;
  if (go <= 0.3)
    return {
      x: door.x + (foot.x - door.x) * ramp,
      y,
      z: door.z + (foot.z - door.z) * ramp,
      walking: go > 0,
    };
  const out = (go - 0.3) / 0.7,
    dx = pod.x - foot.x,
    dz = pod.z - foot.z,
    len = Math.hypot(dx, dz) || 1,
    stand = Math.max(0, len - pod.r - 2);
  return {
    x: foot.x + (dx / len) * stand * out,
    y: 0.3,
    z: foot.z + (dz / len) * stand * out,
    walking: out < 1,
  };
}

/**
 * The landing to show someone who came to see one: the town that has had the longest to grow from its
 * first pods (a town of three hundred years grows on the screen; one of thirty hardly does), under the
 * greatest world hung in its sky (a giant over the horizon says "another world" before anything else does).
 */
export function landingToShow<T extends { readonly founded: number; readonly sky: number }>(
  colonies: readonly T[],
  now: number,
): T | null {
  const worth = (c: T) => Math.min(1, Math.max(0, now - c.founded) / 250) + Math.min(1, c.sky / 25);
  let best: T | null = null;
  for (const c of colonies) if (!best || worth(c) > worth(best)) best = c;
  return best;
}
