// Work you can see (Phase 8 M78): what the people of a village carry as they go about
// their day — the tools out to the fields and the sheaves back, the forager's basket, the
// fisher's catch, the herder's staff, the miner's pick and the ore, the trader's pack —
// with tools headed by what their land knows (stone, then bronze, iron and steel); the
// land's mine by its age (a pit, a quarry, a shaft under its headframe with its cart);
// the road's traffic by its era and its beasts of burden (porters, pack beasts, carts,
// lorries); and the smoke of hearths and works. What they carry follows from where they
// are going and what they do there (the view's routine, never history); where the mine is
// and what it digs, from the land's own works.
import { finish, hashString, mix } from "../kernel/index.ts";
import type { VillagePlan } from "../bridge/index.ts";

type Rgb = readonly [number, number, number];

export const CARRIES = [
  "tool",
  "sheaf",
  "sack",
  "basket",
  "fish",
  "ore",
  "pack",
  "staff",
  "water",
] as const;
export type Carry = (typeof CARRIES)[number];

/** The materials items are made of, each drawn in its own colour (one batch each). */
export const MATERIALS = [
  "wood",
  "head",
  "straw",
  "cloth",
  "wicker",
  "catch",
  "rock",
  "leather",
  "water",
] as const;
export type Material = (typeof MATERIALS)[number];

/** A tool's head by what its land works: stone, copper and bronze, iron, steel. */
export function toolHead(era: VillagePlan["era"]): Rgb {
  switch (era) {
    case "forage":
    case "farm":
    case undefined:
      return [0.56, 0.55, 0.5];
    case "metal":
      return [0.82, 0.56, 0.26];
    case "industry":
      return [0.34, 0.35, 0.38];
    case "modern":
      return [0.78, 0.8, 0.84];
  }
}

/** The colour of each material (a tool's head by the era; ore by what the mine digs). */
export function materialColor(
  m: Material,
  era: VillagePlan["era"],
  what: "coal" | "ore" | "stone" | null = null,
): Rgb {
  switch (m) {
    case "wood":
      return [0.5, 0.34, 0.2];
    case "head":
      return toolHead(era);
    case "straw":
      return [0.9, 0.76, 0.34];
    case "cloth":
      return [0.78, 0.7, 0.54];
    case "wicker":
      return [0.62, 0.45, 0.26];
    case "catch":
      return [0.74, 0.8, 0.86];
    case "rock":
      return what === "coal"
        ? [0.13, 0.12, 0.12]
        : what === "stone"
          ? [0.78, 0.76, 0.7]
          : [0.58, 0.32, 0.2];
    case "leather":
      return [0.46, 0.28, 0.16];
    case "water":
      return [0.36, 0.52, 0.72];
  }
}

/** A box of an item, about a carrier's middle (an upright ape's figure units, facing +z). */
export type ItemPart = {
  readonly material: Material;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  /** Tipped about its own x axis. */
  readonly pitch: number;
};

const P = (
  material: Material,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  pitch = 0,
): ItemPart => ({ material, x, y, z, sx, sy, sz, pitch });

/** How each thing is carried: a tool over the shoulder, a sheaf on it, a sack or a pack on the back, a basket at the hip, a catch or a bucket in the hand. */
const ITEMS: Readonly<Record<Carry, readonly ItemPart[]>> = {
  tool: [
    P("wood", 0.12, 0.42, -0.02, 0.022, 0.4, 0.022, -0.55),
    P("head", 0.12, 0.6, -0.13, 0.03, 0.03, 0.09),
  ],
  sheaf: [P("straw", 0.1, 0.5, -0.04, 0.09, 0.22, 0.09, -0.4)],
  sack: [P("cloth", 0, 0.38, -0.1, 0.15, 0.14, 0.09)],
  basket: [
    P("wicker", 0.12, 0.25, 0.03, 0.11, 0.08, 0.1),
    P("straw", 0.12, 0.3, 0.03, 0.09, 0.03, 0.08),
  ],
  fish: [
    P("wood", 0.13, 0.3, 0.02, 0.015, 0.3, 0.015, 0.2),
    P("catch", 0.13, 0.18, 0.1, 0.03, 0.1, 0.03),
  ],
  ore: [
    P("rock", 0, 0.4, -0.1, 0.14, 0.13, 0.1),
    P("wood", 0.12, 0.42, -0.02, 0.022, 0.36, 0.022, -0.6),
  ],
  pack: [
    P("leather", 0, 0.38, -0.11, 0.17, 0.22, 0.12),
    P("cloth", 0, 0.52, -0.1, 0.13, 0.06, 0.1),
  ],
  staff: [P("wood", 0.12, 0.3, 0.02, 0.02, 0.62, 0.02)],
  water: [
    P("water", 0.13, 0.15, 0.02, 0.06, 0.06, 0.06),
    P("wood", 0.13, 0.19, 0.02, 0.07, 0.01, 0.07),
  ],
};

/** The boxes of an item as it is carried. */
export function itemParts(carry: Carry): readonly ItemPart[] {
  return ITEMS[carry];
}

// —— The land's mine ———————————————————————————————————————————————————————————

export type Mine = NonNullable<NonNullable<VillagePlan["works"]>["mine"]>;

/**
 * A mine's pieces, in metres about its mouth: what stands there, by its kind and age. (A
 * wheel's extent is its own: across, thick, across; it is stood on its rim when drawn.)
 */
export type MinePiece = {
  readonly role:
    | "pit"
    | "spoil"
    | "shed"
    | "frame"
    | "wheel"
    | "engine"
    | "chimney"
    | "track"
    | "step"
    | "block";
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly yaw: number;
  readonly pitch: number;
};

export function minePieces(mine: Mine): MinePiece[] {
  const out: MinePiece[] = [],
    add = (
      role: MinePiece["role"],
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
      yaw = 0,
      pitch = 0,
    ) => out.push({ role, x, y, z, sx, sy, sz, yaw, pitch });
  if (mine.kind === "quarry") {
    // A stepped cut in the ground, its blocks stacked by it.
    for (let k = 0; k < 3; k++) add("step", 0, 0.3 - k * 0.6, -k * 5, 34 - k * 9, 0.6, 26 - k * 6);
    for (let k = 0; k < 4; k++)
      add("block", 22 + (k % 2) * 3.5, 1 + Math.floor(k / 2) * 2, -8 + k * 2.5, 3, 2, 2.5, k * 0.4);
    add("shed", -22, 2, 6, 8, 4, 6);
    return out;
  }
  // A pit's mouth, its spoil heaped by it, and the diggers' shed.
  add("pit", 0, 0.25, 0, mine.kind === "shaft" ? 8 : 14, 0.2, mine.kind === "shaft" ? 8 : 14);
  add("spoil", 20, 3, -6, 16, 6, 16, 0.5);
  add("shed", -16, 2, 8, 9, 4, 6, 0.2);
  if (mine.kind === "pit") {
    // A windlass over the pit: two posts and the drum between them.
    for (const side of [-1, 1]) add("frame", side * 3, 2, 0, 0.5, 4, 0.5);
    add("wheel", 0, 3.6, 0, 0.9, 6, 0.9, Math.PI / 2);
  }
  if (mine.kind === "shaft") {
    // The headframe: two legs a side leaning in, a crossbeam, the winding wheel; the
    // engine house with its chimney; a track to the heap.
    for (const side of [-1, 1])
      for (const end of [-1, 1])
        add("frame", side * 3.2, 8, end * 2.6, 0.7, 17, 0.7, 0, end * -0.12);
    add("frame", 0, 16.4, 0, 7.4, 0.8, 0.8);
    add("wheel", 0, 17.5, 0, 5.2, 0.7, 5.2);
    add("engine", -12, 4, -8, 9, 8, 7);
    add("chimney", -15.5, 10, -10.5, 1.8, 20, 1.8);
    add("track", 10, 0.15, -3, 22, 0.3, 1.6, 0.27);
  }
  return out;
}

/** An oil well's derrick (a lattice tower over the bore) and its nodding pump, in metres about the bore. */
export function wellPieces(): MinePiece[] {
  const out: MinePiece[] = [];
  for (const side of [-1, 1])
    for (const end of [-1, 1])
      out.push({
        role: "frame",
        x: side * 2.2,
        y: 9,
        z: end * 2.2,
        sx: 0.5,
        sy: 18.5,
        sz: 0.5,
        yaw: 0,
        pitch: end * -0.11,
      });
  for (const h of [5, 10, 15])
    out.push({
      role: "frame",
      x: 0,
      y: h,
      z: 0,
      sx: 4.6 - h * 0.18,
      sy: 0.4,
      sz: 4.6 - h * 0.18,
      yaw: 0,
      pitch: 0,
    });
  out.push({ role: "engine", x: 7, y: 1, z: 0, sx: 5, sy: 2, sz: 3, yaw: 0, pitch: 0 });
  return out;
}

/** A factory: its long shed with a sawtooth of roofs, and its tall chimneys, in metres about its middle. */
export function factoryPieces(): MinePiece[] {
  const out: MinePiece[] = [
    { role: "engine", x: 0, y: 5, z: 0, sx: 40, sy: 10, sz: 22, yaw: 0, pitch: 0 },
  ];
  for (let k = 0; k < 4; k++)
    out.push({
      role: "shed",
      x: -15 + k * 10,
      y: 11.5,
      z: 0,
      sx: 9,
      sy: 3,
      sz: 22,
      yaw: 0,
      pitch: 0,
    });
  for (const x of [-12, 12])
    out.push({ role: "chimney", x, y: 16, z: -14, sx: 2.4, sy: 32, sz: 2.4, yaw: 0, pitch: 0 });
  return out;
}

/** Where the mine's cart is along its track now (0 at the shaft … 1 at the heap), by the screen's clock. */
export function cartAt(s: number): number {
  const t = (s / 24) % 1;
  // Out loaded, a pause to tip, back empty, a pause to load.
  return t < 0.4 ? t / 0.4 : t < 0.5 ? 1 : t < 0.9 ? 1 - (t - 0.5) / 0.4 : 0;
}

// —— The road's traffic ————————————————————————————————————————————————————————

/** A village's road for its traffic: the village (for the keyed draws) and where the road leads. */
export type Road = {
  readonly ref: string;
  readonly to: { readonly x: number; readonly z: number };
};

/**
 * Where the k-th of the road's traffic is now (metres), which way it faces, and whether it
 * is going out: from the square to the edge of what is shown and back, keeping to its side.
 */
export function travellerAt(
  road: Road,
  k: number,
  s: number,
  /** Its pace, metres a second. */
  pace = 1.3,
): { x: number; z: number; yaw: number; out: boolean } {
  const len = Math.hypot(road.to.x, road.to.z) || 1,
    ux = road.to.x / len,
    uz = road.to.z / len,
    key = hashString(`${road.ref} road ${k}`),
    reach = Math.max(10, len * 0.9 - 20),
    period = ((2 * reach) / pace) * (0.9 + 0.2 * ((finish(mix(key, 1), 5) >>> 0) / 4294967296)),
    t = (s / period + (finish(mix(key, 2), 5) >>> 0) / 4294967296) % 1,
    out = t < 0.5,
    along = 20 + reach * (out ? t * 2 : 2 - t * 2),
    side = out ? 3 : -3;
  return {
    x: ux * along - uz * side,
    z: uz * along + ux * side,
    yaw: Math.atan2(out ? ux : -ux, out ? uz : -uz),
    out,
  };
}

// —— Smoke —————————————————————————————————————————————————————————————————————

/** A puff of smoke now: where (metres; height in metres), how big (metres), how dark (0 hearth … 1 works). */
export type Puff = { x: number; y: number; z: number; size: number; dark: number };

/**
 * The smoke over a village now: a thin wisp from some of its homes (more at the hours they
 * cook: morning and evening), black smoke from its works' chimneys and its mine's engine.
 * `hour` is the world's hour (0 … 24); `s` the screen's seconds. Writes into `out`.
 */
export function smokeAt(
  sources: readonly { x: number; y: number; z: number; dark: number }[],
  hour: number,
  s: number,
  out: Puff[],
): number {
  let n = 0;
  const cooking = (hour >= 5.5 && hour < 9) || (hour >= 17 && hour < 21) ? 0.6 : 0.2;
  sources.forEach((src, i) => {
    // (Hearths burn by the hour; works burn always.)
    const lit = src.dark > 0.5 || (finish(mix(i, 3), 7) >>> 0) / 4294967296 < cooking;
    if (!lit) return;
    const works = src.dark > 0.5,
      puffs = works ? 5 : 3;
    for (let j = 0; j < puffs; j++) {
      const age = (s * (works ? 0.16 : 0.12) + j / puffs + i * 0.137) % 1,
        drift = age * age * (works ? 12 : 5),
        o = out[n] ?? (out[n] = { x: 0, y: 0, z: 0, size: 0, dark: 0 });
      o.x = src.x + drift;
      o.z = src.z + drift * 0.4;
      o.y = src.y + age * (works ? 30 : 12);
      o.size = (works ? 2.2 : 0.7) + age * (works ? 6 : 2.2);
      o.dark = src.dark;
      n++;
    }
  });
  return n;
}
