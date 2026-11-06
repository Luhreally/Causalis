// A home looked into, as it is drawn (Lives L6; Classic's cutaway homes, its section 32f): the roof off, the walls cut low, the rooms laid
// out, what stands in them, and who is in at this hour doing what their day has them doing, as the town draws them. Pure: what is drawn
// is a function of the home's insides, the plan and the moment; parts here, the batches in render/home.ts. Built when it is opened and
// let go when it is closed: nothing per frame but what is on the screen.
import type {
  DwellingRoom,
  DwellingStuff,
  DwellingThing,
  HomeInside,
  VillagePlan,
} from "../bridge/index.ts";
import { biomeColor } from "./globe.ts";
import { ACTIVITY, houseLook, momentOf, type Task } from "./village.ts";

type Rgb = readonly [number, number, number];
export type HomeMesh = "box" | "cyl" | "cone";

/** Parts gathered by mesh and colour, eight numbers each (x, y, z, sx, sy, sz, yaw, pitch; world units). */
export class HomeParts {
  readonly groups = new Map<
    string,
    { mesh: HomeMesh; color: Rgb; glow: boolean; data: number[] }
  >();
  put(
    mesh: HomeMesh,
    color: Rgb,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    yaw = 0,
    pitch = 0,
    glow = false,
  ): void {
    const key = `${mesh}|${glow ? 1 : 0}|${color[0].toFixed(2)}|${color[1].toFixed(2)}|${color[2].toFixed(2)}`;
    let g = this.groups.get(key);
    if (!g) this.groups.set(key, (g = { mesh, color, glow, data: [] }));
    g.data.push(x, y, z, sx, sy, sz, yaw, pitch);
  }
  get count(): number {
    let n = 0;
    for (const g of this.groups.values()) n += g.data.length / 8;
    return n;
  }
}

/** One of those who live there, and where they are now. */
export type HomeFolk = {
  /** Their place in the plan's people. */
  readonly index: number;
  readonly ref: string;
  readonly name: string;
  readonly at: "in" | "out";
  /** What they are at, in words. */
  readonly doing: string;
  /** Where they are drawn, if in (world units), which way they face, whether lying down or sitting, what their hands are at. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly lying: boolean;
  readonly task: Task | null;
};

/** What can be tapped: a thing or a person, where (world units), how large a finger's reach it is given. */
export type HomeSpot = {
  readonly kind: "thing" | "person";
  /** Its number in the home, or its place in the plan's people. */
  readonly n: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** How far under what else stands there it lies (a rug, a mat: taken only where nothing else is nearer). */
  readonly under: number;
};

export type HomeDrawn = {
  readonly parts: HomeParts;
  /** What comes off as it opens: its roof, or what is above this floor. */
  readonly lid: HomeParts;
  readonly folk: readonly HomeFolk[];
  readonly spots: readonly HomeSpot[];
  /** How far the eye stands off to see it whole on a phone, and how far it spreads. */
  readonly distance: number;
  readonly radius: number;
};

const FLOOR = {
    earth: [0.45, 0.34, 0.23],
    den: [0.32, 0.23, 0.15],
    sand: [0.76, 0.7, 0.54],
    planks: [0.66, 0.47, 0.28],
    tile: [0.8, 0.74, 0.62],
    tile2: [0.62, 0.5, 0.4],
    pale: [0.84, 0.84, 0.8],
    pale2: [0.72, 0.74, 0.74],
    ash: [0.2, 0.19, 0.18],
  } as const satisfies Record<string, Rgb>,
  /** A wall's paint, where they could pay to have one: chosen by the home's key, spread far apart. */
  PAINT: readonly Rgb[] = [
    [0.86, 0.8, 0.62],
    [0.58, 0.72, 0.68],
    [0.78, 0.6, 0.56],
    [0.62, 0.68, 0.82],
  ],
  /** A cloth's dye. */
  DYE: readonly Rgb[] = [
    [0.72, 0.16, 0.14],
    [0.14, 0.32, 0.62],
    [0.12, 0.5, 0.36],
    [0.74, 0.5, 0.1],
    [0.46, 0.2, 0.56],
  ],
  STUFF: Readonly<Record<DwellingStuff, Rgb>> = {
    wood: [0.5, 0.33, 0.18],
    reed: [0.78, 0.69, 0.42],
    hide: [0.56, 0.42, 0.28],
    cloth: [0.76, 0.72, 0.6],
    clay: [0.7, 0.38, 0.22],
    metal: [0.34, 0.35, 0.38],
    stone: [0.55, 0.54, 0.5],
    earth: [0.66, 0.36, 0.26],
    shell: [0.92, 0.86, 0.76],
    glass: [0.66, 0.82, 0.92],
    works: [0.88, 0.89, 0.9],
    kelp: [0.2, 0.46, 0.26],
    wax: [0.92, 0.86, 0.6],
    none: [0.5, 0.45, 0.35],
  },
  FIRE: Rgb = [1, 0.52, 0.12],
  LIGHT: Rgb = [1, 0.92, 0.6],
  SCREEN: Rgb = [0.36, 0.72, 1],
  CAP: Rgb = [0.12, 0.1, 0.09],
  CHAR: Rgb = [0.13, 0.12, 0.11],
  PILLOW: Rgb = [0.93, 0.91, 0.84];
/** How high a wall is cut, metres; and the side toward the eye, lower still. */
const CUT = 0.95,
  CUT_NEAR = 0.32,
  THICK = 0.16;

const unitOf = (key: number, i: number): number => {
  const v = Math.sin(key * 12.9898 + i * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

/** Those who live there, each in or out at moment t, as their day has them: in, where they are placed in its rooms. */
export function homeFolk(inside: HomeInside, plan: VillagePlan, t: number): HomeFolk[] {
  const U = inside.scale,
    d = inside.dwelling,
    home = plan.homes[inside.home],
    beds = d.things.filter((x) => x.need === "sleep"),
    size = (plan.body ? Math.min(2.4, Math.max(0.6, Math.cbrt(plan.body.size / 60))) : 1) * 0.55;
  let bed = 0,
    awake = 0;
  return inside.residents.map((index) => {
    const p = plan.people[index]!,
      m = momentOf(plan, index, t),
      near = !!home && Math.hypot(m.x - home.x, m.z - home.z) < 26,
      asleep = m.activity === ACTIVITY.asleep || m.activity === ACTIVITY.abed,
      inHome =
        m.hidden ||
        asleep ||
        (near &&
          (m.activity === ACTIVITY.home ||
            m.activity === ACTIVITY.resting ||
            m.activity === ACTIVITY.eating ||
            m.activity === ACTIVITY.playing ||
            m.activity === ACTIVITY.sheltering));
    const said = m.why ?? DOING[m.activity] ?? "about the town";
    if (!inHome)
      return {
        index,
        ref: p.ref,
        name: p.name,
        at: "out",
        doing: said,
        x: 0,
        y: 0,
        z: 0,
        yaw: 0,
        lying: false,
        task: null,
      } satisfies HomeFolk;
    if (asleep && beds[bed]) {
      const b = beds[bed++]!,
        yaw = b.yaw + Math.PI / 2,
        grown = (p.child ? 0.7 : 1) * size;
      return {
        index,
        ref: p.ref,
        name: p.name,
        at: "in",
        doing: m.activity === ACTIVITY.abed ? "Abed with their wounds" : "Asleep",
        x: b.x * U + Math.sin(yaw) * grown * 0.5,
        y: b.h * U,
        z: b.z * U + Math.cos(yaw) * grown * 0.5,
        yaw,
        lying: true,
        task: null,
      } satisfies HomeFolk;
    }
    // Up and about at home: about the fire or the table, a step apart.
    const room = d.rooms.find((r) => r.use === "hearth" || r.use === "all") ?? d.rooms[0]!,
      fire = d.things.find((x) => x.need === "cook") ?? d.things.find((x) => x.need === "sit"),
      cx = fire ? fire.x + (fire.yaw === 0 ? 0 : 0) : room.x,
      cz = fire ? fire.z : room.z,
      r = 1 + (fire ? Math.max(fire.w, fire.d) / 2 : 0),
      a = (awake++ / Math.max(1, inside.residents.length)) * 2 * Math.PI + 0.6,
      // (Kept within the room's walls.)
      x = Math.max(
        room.x - room.w / 2 + 0.4,
        Math.min(room.x + room.w / 2 - 0.4, cx + Math.cos(a) * r),
      ),
      z = Math.max(
        room.z - room.d / 2 + 0.4,
        Math.min(room.z + room.d / 2 - 0.4, cz + Math.sin(a) * r),
      ),
      sits = m.activity === ACTIVITY.eating || m.activity === ACTIVITY.resting;
    return {
      index,
      ref: p.ref,
      name: p.name,
      at: "in",
      doing: said,
      x: x * U,
      y: 0,
      z: z * U,
      yaw: Math.atan2(cx - x, cz - z),
      lying: false,
      task: sits ? ("sew" as Task) : m.activity === ACTIVITY.playing ? ("play" as Task) : null,
    } satisfies HomeFolk;
  });
}

const DOING: Readonly<Record<number, string>> = {
  [ACTIVITY.asleep]: "Asleep",
  [ACTIVITY.home]: "At home",
  [ACTIVITY.walking]: "On their way across the town",
  [ACTIVITY.working]: "At their work",
  [ACTIVITY.eating]: "At their meal",
  [ACTIVITY.playing]: "At play",
  [ACTIVITY.resting]: "At their ease",
  [ACTIVITY.gathering]: "In the square",
  [ACTIVITY.sheltering]: "In out of the weather",
  [ACTIVITY.feasting]: "At the feast in the square",
  [ACTIVITY.away]: "Away down the road",
  [ACTIVITY.abed]: "Abed",
  [ACTIVITY.gone]: "Gone",
};

/** A thing, as parts about its own place. */
function thingParts(out: HomeParts, t: DwellingThing, inside: HomeInside, dye: number): void {
  const U = inside.scale,
    c = Math.cos(t.yaw),
    s = Math.sin(t.yaw),
    key = (inside.n * 31 + t.n * 7) | 0,
    // (A tall thing on the side toward the eye would stand in its way.)
    tall = Math.abs(t.yaw) > 3 ? 0.55 : 1,
    { w, d } = t,
    h = t.h * tall,
    col = STUFF[t.stuff],
    dark: Rgb = [col[0] * 0.62, col[1] * 0.62, col[2] * 0.62],
    colour = DYE[(dye + t.n) % DYE.length]!;
  /** A part in the thing's own frame: metres along its wall, up, out from its wall. */
  const put = (
    mesh: HomeMesh,
    color: Rgb,
    lx: number,
    y: number,
    lz: number,
    sx: number,
    sy: number,
    sz: number,
    glow = false,
    pitch = 0,
  ): void =>
    out.put(
      mesh,
      color,
      (t.x + lx * c + lz * s) * U,
      y * U,
      (t.z - lx * s + lz * c) * U,
      sx * U,
      sy * U,
      sz * U,
      t.yaw,
      pitch,
      glow,
    );
  const box = (
    color: Rgb,
    lx: number,
    y: number,
    lz: number,
    sx: number,
    sy: number,
    sz: number,
    glow = false,
  ) => put("box", color, lx, y, lz, sx, sy, sz, glow);
  switch (t.shape) {
    case "bed":
      box(dark, 0, 0.17, 0, w, 0.34, d);
      box(dark, -w / 2 + 0.05, 0.42, 0, 0.1, 0.84, d);
      box(colour, 0.2, 0.4, 0, w - 0.45, 0.14, d * 0.92);
      box(PILLOW, -w / 2 + 0.3, 0.42, 0, 0.42, 0.14, d * 0.72);
      break;
    case "pallet":
      box(col, 0, 0.07, 0, w, 0.14, d);
      box(dark, -w / 2 + 0.22, 0.14, 0, 0.36, 0.1, d * 0.7);
      break;
    case "hollow":
      put("cyl", dark, 0, 0.03, 0, w, 0.06, d);
      break;
    case "hearth":
    case "pit": {
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * 2 * Math.PI;
        box(STUFF.stone, Math.cos(a) * w * 0.42, 0.11, Math.sin(a) * d * 0.42, 0.24, 0.22, 0.24);
      }
      if (t.way !== "heat-stone" && t.way !== "vent-stone") {
        put("cone", FIRE, 0, 0.26, 0, 0.5, 0.52, 0.5, true);
        put("cone", LIGHT, 0, 0.18, 0, 0.26, 0.3, 0.26, true);
        if (t.way === "brick-hearth") box(STUFF.earth, 0, 0.75, -d / 2 - 0.05, w + 0.1, 1.5, 0.3);
      } else box(STUFF.stone, 0, 0.12, 0, w * 0.7, 0.24, d * 0.7);
      break;
    }
    case "stove":
      box(t.stuff === "works" ? PILLOW : [0.14, 0.14, 0.16], 0, h / 2, 0, w, h, d);
      box(
        t.stuff === "works" ? [0.1, 0.1, 0.12] : FIRE,
        0,
        h * 0.42,
        d / 2 + 0.01,
        w * 0.55,
        h * 0.3,
        0.04,
        t.stuff !== "works",
      );
      if (t.stuff === "metal") put("cyl", [0.2, 0.2, 0.22], 0, h + 0.5, -d * 0.2, 0.2, 1, 0.2);
      break;
    case "pot":
      put("cyl", col, 0, 0.2, 0, w, 0.36, d);
      put("cyl", dark, 0, 0.4, 0, w * 0.78, 0.06, d * 0.78);
      break;
    case "jar":
      put("cyl", col, 0, h * 0.4, 0, w, h * 0.8, d);
      put("cyl", dark, 0, h * 0.9, 0, w * 0.5, h * 0.2, d * 0.5);
      break;
    case "chest":
    case "strongbox":
      box(col, 0, h * 0.42, 0, w, h * 0.84, d);
      box(dark, 0, h * 0.92, 0, w * 1.04, h * 0.16, d * 1.04);
      if (t.shape === "strongbox") box(STUFF.metal, 0, h * 0.5, d / 2, 0.16, 0.2, 0.04);
      break;
    case "table": {
      box(col, 0, h, 0, w, 0.08, d);
      for (const [a, b] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const)
        box(dark, (a * w) / 2.3, h / 2, (b * d) / 2.4, 0.08, h, 0.08);
      if (t.way === "table-chairs")
        for (let k = 0; k < 4; k++) {
          const lx = k < 2 ? -w * 0.25 + k * w * 0.5 : -w * 0.25 + (k - 2) * w * 0.5,
            lz = k < 2 ? -d / 2 - 0.3 : d / 2 + 0.3;
          box(col, lx, 0.24, lz, 0.42, 0.48, 0.42);
          box(dark, lx, 0.6, lz + (k < 2 ? -0.18 : 0.18), 0.42, 0.5, 0.06);
        }
      else {
        box(col, 0, 0.24, -d / 2 - 0.3, w * 0.9, 0.1, 0.32);
        box(col, 0, 0.24, d / 2 + 0.3, w * 0.9, 0.1, 0.32);
      }
      break;
    }
    case "mat":
      box(col, 0, 0.02, 0, w, 0.04, d);
      for (let k = 0; k < 3; k++) box(dark, 0, 0.045, (k - 1) * d * 0.28, w * 0.96, 0.01, 0.06);
      break;
    case "longseat":
      box(colour, 0, 0.24, 0, w, 0.48, d);
      box(colour, 0, 0.6, -d / 2 + 0.12, w, 0.5, 0.24);
      box(dark, -w / 2 + 0.08, 0.42, 0, 0.16, 0.5, d);
      box(dark, w / 2 - 0.08, 0.42, 0, 0.16, 0.5, d);
      break;
    case "lamp":
      put("cyl", col, 0, 0.5, 0, 0.14, 1, 0.14);
      put("cone", LIGHT, 0, 1.12, 0, 0.26, 0.28, 0.26, true);
      break;
    case "bulb":
      box(CAP, 0, 2.3, 0, 0.03, 0.5, 0.03);
      put("cyl", LIGHT, 0, 2.02, 0, 0.26, 0.24, 0.26, true);
      break;
    case "loom": {
      box(col, -w / 2 + 0.06, h / 2, 0, 0.12, h, 0.14);
      box(col, w / 2 - 0.06, h / 2, 0, 0.12, h, 0.14);
      box(dark, 0, h - 0.06, 0, w, 0.12, 0.14);
      box(colour, 0, h * 0.58, 0.02, w * 0.8, h * 0.62, 0.04);
      break;
    }
    case "bench":
      box(col, 0, h, 0, w, 0.12, d);
      box(dark, -w / 2 + 0.1, h / 2, 0, 0.12, h, d * 0.8);
      box(dark, w / 2 - 0.1, h / 2, 0, 0.12, h, d * 0.8);
      box(STUFF.metal, -w * 0.2, h + 0.1, 0, 0.32, 0.1, 0.14);
      box(STUFF.wood, w * 0.2, h + 0.08, 0.05, 0.44, 0.06, 0.1);
      break;
    case "wheel":
      put("cyl", col, 0, h * 0.4, 0, w * 0.5, h * 0.8, d * 0.5);
      put("cyl", dark, 0, h, 0, w, 0.08, d);
      put("cyl", STUFF.clay, 0, h + 0.14, 0, w * 0.4, 0.2, d * 0.4);
      break;
    case "tool":
      box(STUFF.wood, 0, h / 2, 0.05, 0.06, h, 0.06);
      box(STUFF.metal, 0, h - 0.08, 0.1, 0.22, 0.1, 0.16);
      break;
    case "arm":
      box(STUFF.wood, 0, h * 0.2, 0, 0.14, h * 0.4, 0.14);
      box([0.74, 0.76, 0.8], 0, h * 0.68, 0.02, 0.1, h * 0.62, 0.04);
      box(STUFF.metal, 0, h * 0.38, 0.02, 0.36, 0.06, 0.06);
      break;
    case "shelf":
      box(col, 0, h / 2, 0, w, h, d);
      for (let k = 0; k < 6; k++)
        put(
          "cyl",
          k % 2 ? STUFF.clay : PILLOW,
          -w / 2 + 0.2 + (k % 3) * (w / 3),
          0.5 + Math.floor(k / 3) * 0.55,
          d / 2 + 0.02,
          0.22,
          0.22,
          0.1,
        );
      break;
    case "rug":
      box(colour, 0, 0.015, 0, w, 0.03, d);
      box(PILLOW, 0, 0.032, 0, w * 0.78, 0.006, d * 0.78);
      box(colour, 0, 0.038, 0, w * 0.7, 0.006, d * 0.7);
      break;
    case "hanging":
      box(STUFF.wood, 0, h + 0.05, 0, w + 0.1, 0.06, 0.06);
      box(colour, 0, h / 2 + 0.05, 0, w, h, 0.05);
      box(PILLOW, 0, h / 2 + 0.05, 0.03, w * 0.5, h * 0.5, 0.01);
      break;
    case "books": {
      box(dark, 0, h / 2, 0, w, h, d);
      for (let k = 0; k < 10; k++)
        box(
          DYE[(key + k) % DYE.length]!,
          -w / 2 + 0.1 + (k % 5) * ((w - 0.2) / 5) + 0.1,
          0.55 + Math.floor(k / 5) * 0.6,
          d / 2 + 0.01,
          0.14,
          0.4,
          0.04,
        );
      break;
    }
    case "mirror":
      box(dark, 0, h / 2 + 0.2, 0, w, h, 0.05);
      box(STUFF.glass, 0, h / 2 + 0.2, 0.03, w * 0.8, h * 0.88, 0.01);
      break;
    case "clock":
      box(col === STUFF.metal ? STUFF.wood : col, 0, h / 2, 0, w, h, d);
      put("cyl", PILLOW, 0, h * 0.8, d / 2 + 0.02, 0.36, 0.04, 0.36);
      break;
    case "screen":
      box([0.14, 0.14, 0.16], 0, h / 2, 0, w, h, d);
      box(SCREEN, 0, h * 0.58, d / 2 + 0.01, w * 0.88, h * 0.62, 0.02, true);
      break;
    case "bath":
      box(PILLOW, 0, h / 2, 0, w, h, d);
      box([0.42, 0.68, 0.84], 0, h + 0.005, 0, w * 0.84, 0.01, d * 0.72);
      break;
    case "basin":
      box(col, 0, h * 0.45, 0, w, h * 0.9, d);
      box([0.42, 0.68, 0.84], 0, h * 0.9 + 0.005, 0, w * 0.7, 0.01, d * 0.7);
      box(STUFF.metal, 0, h + 0.06, -d * 0.3, 0.05, 0.16, 0.05);
      break;
    case "coldbox":
      box(PILLOW, 0, h / 2, 0, w, h, d);
      box(STUFF.metal, -w * 0.3, h * 0.6, d / 2 + 0.01, 0.05, h * 0.3, 0.04);
      break;
    case "rubble":
      for (let k = 0; k < 8; k++)
        box(
          inside.state === "razed" ? CHAR : STUFF.stone,
          (unitOf(key, k) - 0.5) * w * 1.6,
          0.12 + unitOf(key, k + 9) * 0.14,
          (unitOf(key, k + 20) - 0.5) * d * 1.6,
          0.28 + unitOf(key, k + 30) * 0.3,
          0.24,
          0.28 + unitOf(key, k + 40) * 0.3,
        );
      break;
    case "beam":
      put("box", inside.state === "razed" ? CHAR : dark, 0, 0.22, 0, w, 0.22, d, false, 0.1);
      break;
  }
}

/** The floor and walls of a room that is round. */
function roundRoom(
  out: HomeParts,
  r: DwellingRoom,
  inside: HomeInside,
  floor: Rgb,
  wall: Rgb,
  cap: number,
  ruin: boolean,
): void {
  const U = inside.scale,
    R = r.w / 2;
  out.put("cyl", floor, r.x * U, 0.01 * U, r.z * U, r.w * U, 0.02 * U, r.d * U);
  const n = 18,
    len = ((2 * Math.PI * R) / n) * 1.06;
  for (let k = 0; k < n; k++) {
    const a = ((k + 0.5) / n) * 2 * Math.PI,
      x = r.x + Math.sin(a) * R,
      z = r.z + Math.cos(a) * R,
      // (The way in at the front.)
      door = k === 0 || k === n - 1,
      near = Math.cos(a) > 0.2,
      lost = ruin && unitOf(inside.n, k) < 0.4;
    if (door || lost) continue;
    const high = (near ? CUT_NEAR : cap) * (ruin ? 0.3 + unitOf(inside.n, k + 30) * 0.7 : 1);
    out.put(
      "box",
      wall,
      x * U,
      (high / 2) * U,
      z * U,
      len * U,
      high * U,
      THICK * U,
      a,
    );
    out.put(
      "box",
      CAP,
      x * U,
      (high + 0.01) * U,
      z * U,
      len * U,
      0.03 * U,
      THICK * U,
      a,
    );
  }
}

/** A length of wall cut low, its cut edge dark so it reads as cut (its door left out by the caller). */
function wallRun(
  out: HomeParts,
  inside: HomeInside,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  wall: Rgb,
  high: number,
  ruin: boolean,
  i: number,
): void {
  const U = inside.scale,
    dx = bx - ax,
    dz = bz - az,
    len = Math.hypot(dx, dz);
  if (len < 0.05) return;
  const yaw = Math.atan2(-dz, dx);
  if (ruin) {
    // Broken lengths, each to its own height.
    const n = Math.max(1, Math.round(len / 0.8));
    for (let k = 0; k < n; k++) {
      if (unitOf(inside.n + i, k) < 0.35) continue;
      const f = (k + 0.5) / n,
        h = high * (0.25 + unitOf(inside.n + i, k + 40) * 0.75);
      out.put(
        "box",
        wall,
        (ax + dx * f) * U,
        (h / 2) * U,
        (az + dz * f) * U,
        (len / n) * U,
        h * U,
        THICK * U,
        yaw,
      );
    }
    return;
  }
  out.put(
    "box",
    wall,
    ((ax + bx) / 2) * U,
    (high / 2) * U,
    ((az + bz) / 2) * U,
    len * U,
    high * U,
    THICK * U,
    yaw,
  );
  out.put(
    "box",
    CAP,
    ((ax + bx) / 2) * U,
    (high + 0.012) * U,
    ((az + bz) / 2) * U,
    len * U,
    0.03 * U,
    THICK * U,
    yaw,
  );
}

/** A home's insides, as parts: built once when it is opened. */
export function homeDrawn(inside: HomeInside, plan: VillagePlan, t: number): HomeDrawn {
  const parts = new HomeParts(),
    lid = new HomeParts(),
    U = inside.scale,
    d = inside.dwelling,
    look = houseLook(
      {
        walls: inside.walls,
        roof: inside.roof,
        form: inside.form,
        pitch: inside.pitch,
        design: null,
      },
      plan.lifeLook,
    ),
    ruin = inside.state === "fell" || inside.state === "razed",
    burnt = inside.state === "razed",
    water = inside.medium === "water",
    den = inside.walls === "burrow" || inside.form === "warren",
    coin = inside.coin,
    key = inside.dwelling.things.length * 17 + inside.n,
    painted = coin >= 2000 && !water && !den && !ruin,
    wallOut: Rgb = burnt ? CHAR : look.wall,
    wallIn: Rgb = burnt
      ? CHAR
      : painted
        ? PAINT[key % PAINT.length]!
        : [look.wall[0] * 0.86, look.wall[1] * 0.86, look.wall[2] * 0.86],
    modern = plan.era === "modern" && inside.level >= 3,
    floorA: Rgb = burnt
      ? FLOOR.ash
      : water
        ? FLOOR.sand
        : den
          ? FLOOR.den
          : ruin
            ? FLOOR.earth
            : modern
              ? FLOOR.pale
              : coin >= 6000
                ? FLOOR.tile
                : coin >= 300
                  ? FLOOR.planks
                  : FLOOR.earth,
    floorB: Rgb = modern ? FLOOR.pale2 : coin >= 6000 && !water && !den ? FLOOR.tile2 : floorA,
    radius = Math.max(d.halfW, d.halfD) * U + 0.1,
    high = inside.storey > 0;
  // What it stands on: its yard and the street before it; on a high floor, the slab and the town far below.
  const groundC = biomeColor(plan.biome) as unknown as Rgb,
    gx = 90,
    gz = 90;
  if (high) {
    const below = Math.min(14, 1.2 + inside.storey * 0.32);
    parts.put(
      "box",
      [0.62, 0.62, 0.6],
      0,
      -0.08 * U,
      0,
      (d.halfW * 2 + 0.6) * U,
      0.16 * U,
      (d.halfD * 2 + 0.6) * U,
    );
    for (let k = 1; k <= 5; k++)
      parts.put(
        "box",
        k % 2 ? [0.5, 0.5, 0.5] : [0.58, 0.58, 0.58],
        0,
        -0.08 * U - k * 0.34,
        0,
        (d.halfW * 2 + 0.3) * U,
        0.32,
        (d.halfD * 2 + 0.3) * U,
      );
    parts.put(
      "box",
      [groundC[0] * 0.7, groundC[1] * 0.7, groundC[2] * 0.7],
      0,
      -below - 2,
      0,
      60,
      0.2,
      60,
    );
    for (let k = 0; k < 40; k++) {
      const x = (unitOf(key, k) - 0.5) * 40,
        z = (unitOf(key, k + 50) - 0.5) * 40;
      if (Math.abs(x) < radius + 1 && Math.abs(z) < radius + 1) continue;
      const h = 0.5 + unitOf(key, k + 90) * (below * 0.8);
      parts.put(
        "box",
        k % 3 ? [0.58, 0.56, 0.54] : [0.46, 0.44, 0.44],
        x,
        -below - 2 + h / 2,
        z,
        0.9,
        h,
        1.2,
      );
    }
  } else {
    parts.put(
      "box",
      water ? [0.62, 0.6, 0.46] : den ? [0.27, 0.2, 0.13] : [groundC[0], groundC[1], groundC[2]],
      0,
      -0.06 * U,
      0,
      gx,
      0.1 * U,
      gz,
    );
    if (!water && !den)
      parts.put(
        "box",
        plan.town?.paved ? [0.48, 0.47, 0.45] : [0.56, 0.47, 0.34],
        0,
        -0.005 * U,
        (d.halfD + 2.1) * U,
        gx,
        0.02 * U,
        2.4 * U,
      );
  }
  // Each room: its floor, its walls.
  d.rooms.forEach((r, i) => {
    if (r.round) {
      roundRoom(parts, r, inside, i % 2 ? floorB : floorA, wallOut, CUT, ruin);
      return;
    }
    const tiled = floorA === FLOOR.tile || modern;
    if (tiled) {
      // A floor of two tones, in squares: what they paid for is seen.
      const nx = Math.max(2, Math.round(r.w / 0.9)),
        nz = Math.max(2, Math.round(r.d / 0.9));
      parts.put("box", floorA, r.x * U, 0.005 * U, r.z * U, r.w * U, 0.01 * U, r.d * U);
      if (nx * nz <= 256)
        for (let a = 0; a < nx; a++)
          for (let b = 0; b < nz; b++)
            if ((a + b) % 2)
              parts.put(
                "box",
                floorB,
                (r.x - r.w / 2 + ((a + 0.5) * r.w) / nx) * U,
                0.012 * U,
                (r.z - r.d / 2 + ((b + 0.5) * r.d) / nz) * U,
                (r.w / nx) * U,
                0.004 * U,
                (r.d / nz) * U,
              );
    } else {
      parts.put("box", floorA, r.x * U, 0.005 * U, r.z * U, r.w * U, 0.01 * U, r.d * U);
      if (floorA === FLOOR.planks) {
        const n = Math.max(2, Math.round(r.w / 0.4));
        for (let a = 1; a < n; a += 2)
          parts.put(
            "box",
            [floorA[0] * 0.85, floorA[1] * 0.85, floorA[2] * 0.85],
            (r.x - r.w / 2 + ((a + 0.5) * r.w) / n) * U,
            0.012 * U,
            r.z * U,
            (r.w / n) * U,
            0.003 * U,
            r.d * U,
          );
      }
    }
  });
  // Walls within, then the walls about each floor.
  d.walls.forEach((w, i) =>
    wallRun(parts, inside, w.ax, w.az, w.bx, w.bz, wallIn, CUT * 0.85, ruin, i + 100),
  );
  const floors = new Map<number, { lo: number; hi: number; near: number; far: number }>();
  for (const r of d.rooms) {
    if (r.round) continue;
    const f = floors.get(r.floor) ?? {
      lo: Infinity,
      hi: -Infinity,
      near: -Infinity,
      far: Infinity,
    };
    f.lo = Math.min(f.lo, r.x - r.w / 2);
    f.hi = Math.max(f.hi, r.x + r.w / 2);
    f.far = Math.min(f.far, r.z - r.d / 2);
    f.near = Math.max(f.near, r.z + r.d / 2);
    floors.set(r.floor, f);
  }
  let run = 0;
  for (const [level, f] of floors) {
    const doorX = (f.lo + f.hi) / 2 + (unitOf(inside.n, level) - 0.5) * (f.hi - f.lo) * 0.4;
    wallRun(parts, inside, f.lo, f.far, f.hi, f.far, wallOut, CUT, ruin, run++);
    wallRun(parts, inside, f.lo, f.far, f.lo, f.near, wallOut, CUT, ruin, run++);
    wallRun(parts, inside, f.hi, f.far, f.hi, f.near, wallOut, CUT, ruin, run++);
    if (level === 0 && !high) {
      wallRun(parts, inside, f.lo, f.near, doorX - 0.55, f.near, wallOut, CUT_NEAR, ruin, run++);
      wallRun(parts, inside, doorX + 0.55, f.near, f.hi, f.near, wallOut, CUT_NEAR, ruin, run++);
    } else wallRun(parts, inside, f.lo, f.near, f.hi, f.near, wallOut, CUT_NEAR, ruin, run++);
    // Its roof, or what is above it, comes off as it opens.
    if (!ruin) {
      const w = f.hi - f.lo,
        depth = f.near - f.far,
        z = (f.near + f.far) / 2,
        x = (f.lo + f.hi) / 2,
        y = CUT + 0.2;
      lid.put("box", look.roof, x * U, y * U, z * U, (w + 0.5) * U, 0.3 * U, (depth + 0.5) * U);
      if (look.rise > 0.1 && !high && inside.level < 3)
        lid.put(
          "cone",
          [look.roof[0] * 0.9, look.roof[1] * 0.9, look.roof[2] * 0.9],
          x * U,
          (y + 0.9) * U,
          z * U,
          (w + 0.4) * U,
          1.5 * U,
          (depth + 0.4) * U,
        );
    }
  }
  if (!floors.size && !ruin)
    for (const r of d.rooms)
      lid.put(
        "cone",
        look.roof,
        r.x * U,
        (CUT + 0.8) * U,
        r.z * U,
        (r.w + 0.4) * U,
        1.6 * U,
        (r.d + 0.4) * U,
      );
  // What stands in the rooms.
  const dye = Math.abs(key) % DYE.length;
  for (const th of d.things) thingParts(parts, th, inside, dye);
  const folk = homeFolk(inside, plan, t),
    spots: HomeSpot[] = [
      ...d.things.map((th): HomeSpot => ({
        kind: "thing",
        n: th.n,
        x: th.x * U,
        y: Math.min(0.9, th.h * 0.5) * U,
        z: th.z * U,
        under: th.shape === "rug" || th.shape === "mat" ? 26 : th.shape === "bulb" ? 16 : 0,
      })),
      ...folk.flatMap((f): HomeSpot[] =>
        f.at === "in"
          ? [
              {
                kind: "person",
                n: f.index,
                x: f.x,
                y: f.y + (f.lying ? 0.06 : 0.28),
                z: f.z,
                under: -8,
              },
            ]
          : [],
      ),
    ];
  return {
    parts,
    lid,
    folk,
    spots,
    distance: Math.max(2.8, Math.max(d.halfW * 1.08, d.halfD * 0.72) * U * 5.6),
    radius,
  };
}
