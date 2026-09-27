// The living world about a village, as the microscope shows it (Phase 8 M77): the land's
// own lineages — herds of grazers on the open ground, browsers at the wood's edge, great
// beasts in their few, the hunters that live on them stalking and running at the herds,
// the people's flocks in their pasture — and, for life in the air and the water, birds
// wheeling over the fields and fish leaping. Who lives there, how many and whether the
// hunters raid the flocks are the world's (the plan's); where each beast stands and how
// it moves is a look, a pure function of the plan and the screen's clock, so the same
// moment always looks the same and watching never touches what happens.
//
// Bodies are built of boxes (the art track's low-poly: a few facets each), in the same
// units as a village's people and drawn as much larger than life as they are, so a sheep
// stands knee-high to a herder and a great tusker towers over a house.
import { finish, hashString, mix } from "../kernel/index.ts";
import type { VillagePlan } from "../bridge/index.ts";
import { treesOf } from "./village.ts";

export type Rgb = readonly [number, number, number];

export const BEAST_KINDS = [
  "sheep",
  "goat",
  "ox",
  "buffalo",
  "horse",
  "camel",
  "deer",
  "elk",
  "tapir",
  "tusker",
  "giant",
  "sloth",
  "cat",
  "bear",
  "wolf",
] as const;
export type BeastKind = (typeof BEAST_KINDS)[number];

/** A beast's kind by the word its lineage is named by (its niche's where the name says none). */
export function kindOf(name: string, niche: string): BeastKind {
  const n = name.toLowerCase();
  for (const [word, kind] of [
    ["sheep", "sheep"],
    ["goat", "goat"],
    ["buffalo", "buffalo"],
    ["camel", "camel"],
    ["horse", "horse"],
    ["ox", "ox"],
    ["elk", "elk"],
    ["tapir", "tapir"],
    ["deer", "deer"],
    ["giant", "giant"],
    ["tusker", "tusker"],
    ["sloth", "sloth"],
    ["wolf", "wolf"],
    ["cat", "cat"],
    ["bear", "bear"],
  ] as const)
    if (new RegExp(`\\b${word}\\b`).test(n)) return kind;
  return niche === "hunter"
    ? "wolf"
    : niche === "browser"
      ? "deer"
      : niche === "great beast"
        ? "tusker"
        : "ox";
}

/** Coats by the colour a lineage is named for: the coat, and a pattern over it. */
const COATS: Readonly<Record<string, Rgb>> = {
  dun: [0.7, 0.58, 0.4],
  red: [0.62, 0.31, 0.17],
  grey: [0.54, 0.54, 0.52],
  black: [0.17, 0.16, 0.15],
  pale: [0.88, 0.85, 0.76],
  brindled: [0.5, 0.37, 0.24],
  spotted: [0.84, 0.74, 0.52],
  golden: [0.87, 0.67, 0.28],
};

export type Coat = {
  readonly coat: Rgb;
  /** Its features: manes, tails, muzzles, hooves (and the pattern's marks). */
  readonly dark: Rgb;
  /** Horn, tusk and antler. */
  readonly horn: Rgb;
  readonly pattern: "spots" | "stripes" | null;
};

export function coatOf(name: string, wool: boolean): Coat {
  const word = Object.keys(COATS).find((c) => new RegExp(`\\b${c}\\b`).test(name.toLowerCase())),
    base = COATS[word ?? "dun"]!,
    // Wool is paler than the hide beneath it.
    coat: Rgb = wool ? [base[0] * 0.55 + 0.42, base[1] * 0.55 + 0.4, base[2] * 0.55 + 0.36] : base,
    dark: Rgb =
      word === "black"
        ? [0.07, 0.06, 0.06]
        : [base[0] * 0.38 + 0.02, base[1] * 0.34 + 0.02, base[2] * 0.3 + 0.02];
  return {
    coat,
    dark,
    horn: [0.86, 0.82, 0.7],
    pattern: word === "spotted" ? "spots" : word === "brindled" ? "stripes" : null,
  };
}

/** The drawing's scale: a grown upright ape (1.7 m) stands 0.55 high, so a metre is this. */
export const BEAST_SCALE = 0.55 / 1.7;

type Proportions = {
  /** The weight it is drawn at this size, kg. */
  readonly ref: number;
  /** Leg (ground to belly), body (across, deep, long), neck (long, thick), head (across, deep, long), metres. */
  readonly leg: number;
  readonly body: readonly [number, number, number];
  readonly neck: readonly [number, number];
  readonly head: readonly [number, number, number];
  /** How far from upright its neck leans with the head up (radians). */
  readonly up: number;
  /** Tail: long, thick, and how far it lifts back from hanging (radians). */
  readonly tail: readonly [number, number, number];
  readonly legW: number;
  readonly extras: readonly Extra[];
  /** Strides a second at a walk. */
  readonly stride: number;
};
type Extra =
  | "horns"
  | "wide-horns"
  | "antlers"
  | "broad-antlers"
  | "tusks"
  | "trunk"
  | "hump"
  | "shoulder"
  | "mane"
  | "wool"
  | "ears"
  | "snout";

const PROPORTIONS: Readonly<Record<BeastKind, Proportions>> = {
  sheep: {
    ref: 60,
    leg: 0.42,
    body: [0.55, 0.5, 0.9],
    neck: [0.25, 0.2],
    head: [0.18, 0.2, 0.3],
    up: 0.55,
    tail: [0.15, 0.08, 0.2],
    legW: 0.08,
    extras: ["wool", "ears"],
    stride: 1.5,
  },
  goat: {
    ref: 50,
    leg: 0.5,
    body: [0.38, 0.42, 0.85],
    neck: [0.3, 0.14],
    head: [0.15, 0.18, 0.3],
    up: 0.35,
    tail: [0.12, 0.05, 1.2],
    legW: 0.07,
    extras: ["horns", "ears"],
    stride: 1.6,
  },
  ox: {
    ref: 500,
    leg: 0.72,
    body: [0.75, 0.8, 1.9],
    neck: [0.6, 0.42],
    head: [0.38, 0.4, 0.55],
    up: 1.05,
    tail: [0.8, 0.07, 0.1],
    legW: 0.16,
    extras: ["horns", "ears"],
    stride: 1.1,
  },
  buffalo: {
    ref: 700,
    leg: 0.78,
    body: [0.9, 0.95, 2.1],
    neck: [0.55, 0.5],
    head: [0.45, 0.45, 0.6],
    up: 1.2,
    tail: [0.7, 0.08, 0.1],
    legW: 0.2,
    extras: ["wide-horns", "shoulder"],
    stride: 1,
  },
  horse: {
    ref: 400,
    leg: 0.95,
    body: [0.55, 0.65, 1.55],
    neck: [1, 0.26],
    head: [0.22, 0.28, 0.6],
    up: 0.55,
    tail: [0.7, 0.14, 0.25],
    legW: 0.12,
    extras: ["mane", "ears"],
    stride: 1.25,
  },
  camel: {
    ref: 450,
    leg: 1.2,
    body: [0.6, 0.7, 1.4],
    neck: [0.95, 0.2],
    head: [0.2, 0.22, 0.5],
    up: 0.95,
    tail: [0.5, 0.06, 0.1],
    legW: 0.12,
    extras: ["hump", "ears"],
    stride: 1,
  },
  deer: {
    ref: 90,
    leg: 0.8,
    body: [0.35, 0.45, 1.05],
    neck: [0.5, 0.14],
    head: [0.14, 0.18, 0.3],
    up: 0.3,
    tail: [0.12, 0.08, 1.4],
    legW: 0.06,
    extras: ["antlers", "ears"],
    stride: 1.5,
  },
  elk: {
    ref: 400,
    leg: 1.1,
    body: [0.6, 0.75, 1.8],
    neck: [0.55, 0.3],
    head: [0.26, 0.3, 0.6],
    up: 0.6,
    tail: [0.1, 0.1, 1],
    legW: 0.13,
    extras: ["broad-antlers", "ears"],
    stride: 1.2,
  },
  tapir: {
    ref: 250,
    leg: 0.5,
    body: [0.6, 0.7, 1.8],
    neck: [0.2, 0.4],
    head: [0.3, 0.32, 0.45],
    up: 1.3,
    tail: [0.1, 0.06, 0.2],
    legW: 0.15,
    extras: ["snout", "ears"],
    stride: 1.1,
  },
  tusker: {
    ref: 4000,
    leg: 1.4,
    body: [1.5, 1.6, 2.8],
    neck: [0.2, 0.9],
    head: [0.9, 1, 0.8],
    up: 1.15,
    tail: [0.9, 0.08, 0.15],
    legW: 0.45,
    extras: ["tusks", "trunk", "ears"],
    stride: 0.7,
  },
  giant: {
    ref: 5000,
    leg: 1.3,
    body: [1.6, 1.8, 3],
    neck: [0.2, 1],
    head: [0.95, 1.2, 0.8],
    up: 1.1,
    tail: [0.5, 0.1, 0.15],
    legW: 0.5,
    extras: ["tusks", "trunk", "wool"],
    stride: 0.65,
  },
  sloth: {
    ref: 3000,
    leg: 1,
    body: [1.3, 1.5, 2.5],
    neck: [0.4, 0.6],
    head: [0.5, 0.5, 0.6],
    up: 0.8,
    tail: [1.2, 0.35, 0.5],
    legW: 0.45,
    extras: ["snout"],
    stride: 0.6,
  },
  cat: {
    ref: 120,
    leg: 0.55,
    body: [0.35, 0.38, 1.3],
    neck: [0.2, 0.2],
    head: [0.26, 0.24, 0.3],
    up: 1.1,
    tail: [0.9, 0.07, 1.9],
    legW: 0.1,
    extras: ["ears"],
    stride: 1.4,
  },
  bear: {
    ref: 300,
    leg: 0.55,
    body: [0.75, 0.8, 1.5],
    neck: [0.2, 0.45],
    head: [0.38, 0.35, 0.45],
    up: 1.2,
    tail: [0.1, 0.1, 1],
    legW: 0.2,
    extras: ["ears", "snout"],
    stride: 1.1,
  },
  wolf: {
    ref: 45,
    leg: 0.55,
    body: [0.3, 0.35, 1],
    neck: [0.2, 0.18],
    head: [0.2, 0.2, 0.35],
    up: 1,
    tail: [0.45, 0.12, 0.7],
    legW: 0.07,
    extras: ["ears"],
    stride: 1.6,
  },
};

/** A part of a beast as it stands this moment, in its own frame (facing +z), drawn units. */
export type BeastPart = {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  /** Tipped about its own x axis (its long axis +y leaning toward +z as it grows). */
  pitch: number;
  /** 0 its coat, 1 its dark features, 2 horn and tusk. */
  tone: 0 | 1 | 2;
};

/** How a beast holds itself now: its gait (0 still, 1 walking, 2 running), stride phase, head (0 up … 1 down to the grass), crouch (0 … 1). */
export type Pose = { gait: 0 | 1 | 2; phase: number; head: number; crouch: number };

export type Body = {
  readonly kind: BeastKind;
  readonly p: Proportions;
  /** Metres to drawn units for this beast (its size against its kind's, and the drawing's scale). */
  readonly k: number;
  /** How finely it is built (the setting's detail, 0 … 3). */
  readonly detail: number;
  readonly wool: boolean;
  readonly pattern: Coat["pattern"];
  /** The pattern's marks on the body, in body-box units (-0.5 … 0.5), keyed by the lineage. */
  readonly marks: readonly (readonly [number, number, number])[];
};

export function bodyOf(
  kind: BeastKind,
  size: number,
  wool: boolean,
  pattern: Coat["pattern"],
  detail: number,
  key = 0,
): Body {
  const p = PROPORTIONS[kind],
    k = BEAST_SCALE * Math.min(1.45, Math.max(0.8, Math.cbrt(size / p.ref))),
    marks: [number, number, number][] = [];
  if (pattern && detail >= 2)
    for (let i = 0; i < (pattern === "spots" ? 6 : 4); i++)
      marks.push([
        unit(key, i, 1) < 0.5 ? -1 : 1,
        (unit(key, i, 2) - 0.5) * 0.6,
        pattern === "stripes" ? -0.35 + (0.7 * i) / 3 : (unit(key, i, 3) - 0.5) * 0.8,
      ]);
  return { kind, p, k, detail, wool: wool || p.extras.includes("wool"), pattern, marks };
}

/** The most parts any beast is drawn with in any pose (so batches can be sized). */
export const MOST_PARTS = 32;

const unit = (key: number, i: number, j: number) =>
  (finish(mix(mix(key, i), j), 23) >>> 0) / 4294967296;

/**
 * Pose a body: its parts this moment, written into `out` (reused; returns how many). The
 * legs swing about the hip at a walk and more at a run; the neck bows the head to the
 * grass as it grazes; a stalking hunter crouches.
 */
export function posed(b: Body, pose: Pose, out: BeastPart[]): number {
  const { p, k } = b;
  let n = 0;
  const put = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    pitch: number,
    tone: 0 | 1 | 2,
  ) => {
    const o = out[n] ?? (out[n] = { x: 0, y: 0, z: 0, sx: 0, sy: 0, sz: 0, pitch: 0, tone: 0 });
    o.x = x * k;
    o.y = y * k;
    o.z = z * k;
    o.sx = sx * k;
    o.sy = sy * k;
    o.sz = sz * k;
    o.pitch = pitch;
    o.tone = tone;
    n++;
  };
  const [bw, bh, bl] = p.body,
    wool = b.wool ? 0.12 : 0,
    // A running body bounds; a crouching one sinks toward the ground.
    bob = pose.gait === 2 ? 0.06 * Math.abs(Math.sin(pose.phase)) : 0,
    sink = pose.crouch * p.leg * 0.35,
    belly = p.leg - sink + bob,
    cy = belly + bh / 2;
  put(0, cy, 0, bw + wool, bh + wool, bl + wool * 0.6, 0, 0);
  // Legs at the body's corners, stepping in diagonal pairs (hooves and paws dark below
  // them, where the body is finely built).
  const swing = pose.gait === 2 ? 0.75 : pose.gait === 1 ? 0.38 : 0;
  for (let i = 0; i < 4; i++) {
    const side = i % 2 ? 1 : -1,
      front = i < 2 ? 1 : -1,
      pitch = swing * Math.sin(pose.phase + (side === front ? 0 : Math.PI)),
      high = p.leg - sink + bob,
      hinge = high / 2,
      dy = hinge - hinge * Math.cos(pitch),
      dz = -hinge * Math.sin(pitch),
      x = side * (bw / 2 - p.legW * 0.7),
      z = front * (bl / 2 - p.legW * 0.9);
    put(
      x,
      high / 2 + dy,
      z + dz,
      p.legW,
      high,
      p.legW,
      pitch,
      b.wool && b.kind === "sheep" ? 1 : 0,
    );
    if (b.detail >= 2)
      put(
        x,
        0.04 + high * (1 - Math.cos(pitch)),
        z - high * Math.sin(pitch),
        p.legW * 1.15,
        0.08,
        p.legW * 1.2,
        0,
        1,
      );
  }
  // The neck leans from upright toward the ground as the head goes down to graze: as far
  // as brings the muzzle to the grass (as far as a neck can bow).
  const [nl, nw] = p.neck,
    [hw, hh, hl] = p.head,
    baseY = belly + bh * 0.62,
    baseZ = bl / 2 - nw * 0.4,
    reach = (0.05 + Math.sin(1.45) * hl - baseY) / nl,
    bowed = Math.min(2.7, Math.acos(Math.max(-1, Math.min(1, reach)))),
    lean = p.up + (Math.max(p.up, bowed) - p.up) * pose.head - pose.crouch * 0.3,
    ny = Math.cos(lean),
    nz = Math.sin(lean);
  put(0, baseY + (ny * nl) / 2, baseZ + (nz * nl) / 2, nw, nl + nw * 0.5, nw, lean, 0);
  const topY = baseY + ny * nl,
    topZ = baseZ + nz * nl,
    // The head tips its nose down as it bows.
    tip = 0.3 + 1.15 * pose.head + pose.crouch * 0.2,
    hy = topY - (Math.sin(tip) * hl) / 2,
    hz = topZ + (Math.cos(tip) * hl) / 2;
  put(0, hy, hz, hw, hh, hl, tip, 0);
  /** A part fixed to the head: (x, y, z) in the head's frame, turned as it is. */
  const onHead = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    pitch: number,
    tone: 0 | 1 | 2,
  ) =>
    put(
      x,
      hy + y * Math.cos(tip) - z * Math.sin(tip),
      hz + y * Math.sin(tip) + z * Math.cos(tip),
      sx,
      sy,
      sz,
      tip + pitch,
      tone,
    );
  // Its muzzle, a shade darker (all but the plainest).
  if (b.detail >= 1) onHead(0, -hh * 0.12, hl * 0.42, hw * 0.8, hh * 0.6, hl * 0.22, 0, 1);
  // Its tail.
  const [tl, tt, lift] = p.tail;
  if (b.detail >= 1) {
    const a = Math.PI + lift + (pose.gait === 2 ? 0.4 : 0),
      ty = belly + bh * 0.8,
      tz = -bl / 2;
    put(0, ty + (Math.cos(a) * tl) / 2, tz + (Math.sin(a) * tl) / 2, tt, tl, tt, a, 1);
  }
  const ex = p.extras;
  if (b.detail >= 1) {
    if (ex.includes("horns"))
      for (const s of [-1, 1])
        onHead(s * hw * 0.32, hh * 0.62, -hl * 0.2, 0.05, hh * 0.7, 0.05, -0.5, 2);
    if (ex.includes("wide-horns")) onHead(0, hh * 0.45, -hl * 0.15, hw * 2.4, 0.09, 0.12, 0, 2);
    if (ex.includes("antlers") || ex.includes("broad-antlers")) {
      const broad = ex.includes("broad-antlers");
      for (const s of [-1, 1]) {
        onHead(s * hw * 0.35, hh * 0.9, -hl * 0.15, 0.035, hh * 1.4, 0.035, -0.25, 2);
        onHead(
          s * hw * (broad ? 0.9 : 0.55),
          hh * (broad ? 1.35 : 1.45),
          -hl * 0.2,
          broad ? hw * 0.9 : 0.03,
          broad ? 0.05 : hh * 0.7,
          broad ? hl * 0.5 : 0.03,
          broad ? 0 : 0.3,
          2,
        );
      }
    }
    if (ex.includes("tusks"))
      for (const s of [-1, 1])
        onHead(s * hw * 0.3, -hh * 0.35, hl * 0.55, 0.09, 0.09, hl * 1.1, 0.5, 2);
    if (ex.includes("trunk"))
      onHead(0, -hh * 0.6, hl * 0.45, hw * 0.24, hh * 1.3, hw * 0.24, 0.2, 0);
    if (ex.includes("snout"))
      onHead(0, -hh * 0.15, hl * 0.62, hw * 0.45, hh * 0.4, hl * 0.3, 0.2, 1);
    if (ex.includes("hump")) put(0, belly + bh + 0.14, 0, bw * 0.55, 0.35, bl * 0.35, 0, 0);
    if (ex.includes("shoulder"))
      put(0, belly + bh * 0.95, bl * 0.25, bw * 0.8, bh * 0.35, bl * 0.35, 0, 0);
  }
  if (b.detail >= 2) {
    if (ex.includes("mane"))
      put(
        0,
        baseY + (ny * nl) / 2 + nw * 0.35,
        baseZ + (nz * nl) / 2 - nw * 0.3,
        nw * 0.35,
        nl,
        nw * 0.5,
        lean,
        1,
      );
    // The pattern of its coat: spots or stripes on its flanks.
    for (const [side, v, w] of b.marks)
      put(
        side * ((bw + wool) / 2 + 0.01),
        cy + v * bh,
        w * bl,
        0.02,
        b.pattern === "stripes" ? bh * 0.8 : bh * 0.22,
        b.pattern === "stripes" ? 0.07 : bh * 0.22,
        0,
        1,
      );
  }
  if (b.detail >= 3 && ex.includes("ears"))
    for (const s of [-1, 1])
      onHead(s * hw * 0.45, hh * 0.55, -hl * 0.3, hw * 0.28, hh * 0.35, 0.04, -0.2, 0);
  return n;
}

// —— The herds and their day ——————————————————————————————————————————————————————

export type FaunaSpecies = {
  readonly ref: string;
  readonly name: string;
  readonly niche: string;
  readonly kind: BeastKind;
  readonly coat: Coat;
  readonly body: Body;
  /** Whether these are the people's own flocks. */
  readonly flock: boolean;
};

type Herd = {
  readonly species: number;
  readonly home: { x: number; z: number };
  /** Each member's place in the herd, metres from its middle, and its own clock. */
  readonly members: readonly { dx: number; dz: number; period: number; phase: number }[];
  /** How far it runs from the hunters. */
  readonly flight: number;
};

type Pack = {
  readonly species: number;
  readonly members: number;
  readonly herd: number;
  readonly period: number;
  readonly offset: number;
  readonly key: number;
};

export type Fauna = {
  readonly species: readonly FaunaSpecies[];
  readonly herds: readonly Herd[];
  readonly packs: readonly Pack[];
  /** Birds over the village (a flock wheeling, and a pair of hunting birds higher up). */
  readonly birds: readonly {
    cx: number;
    cz: number;
    r: number;
    high: number;
    speed: number;
    phase: number;
    big: boolean;
  }[];
  /** Fish leaping in the water, if there is water. */
  readonly fish: readonly { x: number; z: number; period: number; phase: number; yaw: number }[];
};

/** What a village's plan says lives about it, as the view needs it (bridge's shape). */
type PlanFauna = NonNullable<VillagePlan["fauna"]>;

/**
 * Lay out the living world about a village: at most `cap` beasts, shared among the flocks
 * (if the people keep any), the herds by how much of the wild still stands, and the hunters
 * by how many the game keeps; `detail` builds their bodies, `ambient` adds the birds and fish.
 */
export function faunaOf(plan: VillagePlan, cap: number, detail: number, ambient: boolean): Fauna {
  const f: PlanFauna = plan.fauna ?? { wild: [], flock: null, raided: false },
    seed = hashString(`fauna ${plan.ref}`),
    u = (i: number, j: number) => unit(seed, i, j),
    species: FaunaSpecies[] = [],
    herds: Herd[] = [],
    packs: Pack[] = [];
  const speciesOf = (
    s: { ref: string; name: string; niche: string; size: number; wool: boolean },
    flock: boolean,
  ) => {
    const kind = kindOf(s.name, s.niche),
      coat = coatOf(s.name, s.wool);
    species.push({
      ref: s.ref,
      name: s.name,
      niche: s.niche,
      kind,
      coat,
      body: bodyOf(kind, s.size, s.wool, coat.pattern, detail, hashString(s.ref)),
      flock,
    });
    return species.length - 1;
  };
  // The open ground the herds keep to: away from the fields' side, beyond the homes.
  let fx = 0,
    fz = 0;
  for (const fl of plan.fields) {
    fx += fl.x;
    fz += fl.z;
  }
  // Between the homes and the wild's edge, where they can be seen from the village.
  let homes = 40;
  for (const h of plan.homes) homes = Math.max(homes, Math.hypot(h.x, h.z));
  const fieldWay = plan.fields.length ? Math.atan2(fz, fx) : 0,
    near = homes + 60,
    far = Math.max(near + 120, plan.wild + 60),
    // Browsers keep to the woods: a tree near the ring, where there are trees.
    woods = treesOf(plan).filter((t) => {
      const r = Math.hypot(t.x, t.z);
      return r > near && r < far + 150 && t.kind !== "shrub";
    }),
    clearOfPasture = (x: number, z: number) =>
      Math.hypot(x - plan.pasture.x, z - plan.pasture.z) > plan.pasture.r + 45;
  let budget = cap;
  // The flocks, in their pasture: as many as their herders keep, to a third of what is drawn.
  if (f.flock && f.flock.herders > 0) {
    const n = Math.max(3, Math.min(Math.round(cap * 0.35), Math.round(f.flock.herders * 6)));
    const sp = speciesOf({ ...f.flock, niche: "grazer" }, true);
    herds.push({
      species: sp,
      home: { x: plan.pasture.x, z: plan.pasture.z },
      members: membersOf(n, Math.min(plan.pasture.r * 0.55, 8 + 4 * Math.sqrt(n)), 0),
      flight: 40,
    });
    budget -= n;
  }
  // The hunters, as many as the game keeps: a pair or three of each lineage.
  const hunters = f.wild.filter((s) => s.niche === "hunter" && s.stock > 0.08),
    prey = f.wild.filter((s) => s.niche !== "hunter" && s.stock > 0.05);
  const hunterShare = hunters.reduce((a, s) => a + Math.min(3, 1 + Math.round(s.stock * 2)), 0);
  budget -= Math.min(hunterShare, Math.round(cap * 0.1));
  // The wild herds, by lineage: grazers in herds, browsers in small bands, great beasts few.
  const weight = (s: PlanFauna["wild"][number]) =>
    s.stock * (s.niche === "grazer" ? 1 : s.niche === "browser" ? 0.5 : 0.22);
  const total = prey.reduce((a, s) => a + weight(s), 0);
  prey.forEach((s, i) => {
    const want = total > 0 ? Math.round((Math.max(0, budget) * weight(s)) / total) : 0,
      band = s.niche === "grazer" ? 14 : s.niche === "browser" ? 5 : 4,
      n = Math.max(s.niche === "great beast" ? 1 : 2, Math.min(want, band * 3));
    if (want < 1) return;
    const sp = speciesOf(s, false);
    for (let left = n, h = 0; left > 0; h++) {
      const size = Math.min(left, band),
        tree =
          s.niche === "browser" && woods.length
            ? woods[Math.floor(u(30 + i, h) * woods.length)]!
            : null;
      let a = fieldWay + 1.1 + (2 * Math.PI - 2.2) * u(10 + i, h),
        r = near + (far - near) * u(20 + i, h);
      for (let turn = 0; turn < 6 && !clearOfPasture(r * Math.cos(a), r * Math.sin(a)); turn++)
        a += 0.5;
      if (tree) {
        a = Math.atan2(tree.z, tree.x);
        r = Math.hypot(tree.x, tree.z);
      }
      herds.push({
        species: sp,
        home: { x: r * Math.cos(a), z: r * Math.sin(a) },
        members: membersOf(
          size,
          6 + 3.5 * Math.sqrt(size) * (s.niche === "great beast" ? 2 : 1),
          100 * i + h,
        ),
        flight: s.niche === "great beast" ? 40 : 85,
      });
      left -= size;
    }
  });
  // Each hunting band hunts the herd nearest its own ground — or, where the hunters raid
  // the flocks, the flock.
  hunters.forEach((s, i) => {
    const sp = speciesOf(s, false),
      bands = s.stock > 0.7 && herds.length > 2 ? 2 : 1;
    for (let b = 0; b < bands; b++) {
      const wildHerds = herds.map((h, k) => ({ h, k })).filter((x) => !species[x.h.species]!.flock),
        flock = herds.findIndex((h) => species[h.species]!.flock),
        target =
          f.raided && flock >= 0 && b === 0
            ? flock
            : (wildHerds[Math.floor(u(40 + i, b) * wildHerds.length)]?.k ?? flock);
      if (target < 0) continue;
      packs.push({
        species: sp,
        members: Math.min(3, 1 + Math.round(s.stock * 1.6)),
        herd: target,
        period: 70 + 40 * u(50 + i, b),
        offset: 1000 * u(60 + i, b),
        key: hashString(`${s.ref} ${b}`),
      });
    }
  });
  // Life in the air and the water: a flock of birds wheeling over the fields, a pair of
  // hunting birds high above, fish leaping in the water.
  const birds: Fauna["birds"][number][] = [];
  if (ambient) {
    const n = Math.max(0, Math.min(18, Math.round(cap / 10)));
    for (let i = 0; i < n; i++)
      birds.push({
        cx: plan.fields[0] ? plan.fields[0].x * 0.6 : 60,
        cz: plan.fields[0] ? plan.fields[0].z * 0.6 : 40,
        r: 35 + 25 * u(70, i),
        high: 22 + 10 * u(71, i),
        speed: 0.22 + 0.04 * u(72, i),
        phase: 0.35 * i + u(73, i) * 0.3,
        big: false,
      });
    for (let i = 0; i < 2; i++)
      birds.push({
        cx: (u(74, i) - 0.5) * 200,
        cz: (u(75, i) - 0.5) * 200,
        r: 70 + 40 * u(76, i),
        high: 55 + 15 * u(77, i),
        speed: 0.08 + 0.03 * u(78, i),
        phase: Math.PI * i,
        big: true,
      });
  }
  const fish: Fauna["fish"][number][] = [];
  if (ambient && plan.water)
    for (let i = 0; i < 6; i++) {
      const a = u(80, i) * 2 * Math.PI,
        r = 150 * Math.sqrt(u(81, i));
      fish.push({
        x: plan.water.x + r * Math.cos(a),
        z: plan.water.z + r * Math.sin(a),
        period: 7 + 9 * u(82, i),
        phase: u(83, i),
        yaw: u(84, i) * 2 * Math.PI,
      });
    }
  return { species, herds, packs, birds, fish };

  function membersOf(n: number, radius: number, key: number): Herd["members"] {
    return Array.from({ length: n }, (_, m) => {
      const a = m * 2.399963 + u(90 + key, m),
        r = radius * Math.sqrt((m + 0.5) / n);
      return {
        dx: r * Math.cos(a),
        dz: r * Math.sin(a),
        period: 13 + 9 * u(91 + key, m),
        phase: u(92 + key, m),
      };
    });
  }
}

/** What a beast is doing, in words, from how it holds itself now. */
export function doingOf(sp: FaunaSpecies, pose: Pose): string {
  if (sp.niche === "hunter")
    return pose.gait === 2
      ? "running at the herd"
      : pose.crouch > 0
        ? "stalking the herd"
        : pose.gait
          ? "prowling"
          : "resting after the chase";
  if (pose.gait === 2) return "running from the hunters";
  if (pose.gait) return sp.flock ? "moving with the flock" : "wandering with the herd";
  if (pose.head < 0.5) return "watching, head up";
  return sp.flock
    ? "grazing in the pasture"
    : sp.niche === "browser"
      ? "browsing at the wood's edge"
      : "grazing";
}

/** A beast where it is now: metres from the village's middle, facing `yaw`, holding `pose`. */
export type BeastNow = {
  species: number;
  x: number;
  z: number;
  yaw: number;
  pose: Pose;
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Where every beast is at screen time `s` (seconds), written into `out` (reused; returns how
 * many). Herds graze and wander a little, each beast on its own clock; a hunting band
 * prowls, stalks its herd, and runs at it; the herd lifts its heads, then flees, and drifts
 * back to its grazing when the hunters have given up.
 */
export function beastsAt(fauna: Fauna, s: number, out: BeastNow[]): number {
  let n = 0;
  const next = (): BeastNow =>
    out[n] ??
    (out[n] = { species: 0, x: 0, z: 0, yaw: 0, pose: { gait: 0, phase: 0, head: 0, crouch: 0 } });
  // Each herd's middle drifts on a slow loop; the hunters' runs push it away and it comes back.
  const middles = fauna.herds.map((h, i) => {
    const w = 0.021 + 0.004 * (i % 3);
    return {
      x: h.home.x + (species(h).flock ? 6 : 26) * Math.cos(s * w + i),
      z: h.home.z + (species(h).flock ? 6 : 26) * Math.sin(s * w * 0.8 + 2 * i),
      fx: 0,
      fz: 0,
      alert: 0,
      running: false,
    };
  });
  function species(h: Herd) {
    return fauna.species[h.species]!;
  }
  // The hunts: where each band is, and how its herd answers.
  const bands = fauna.packs.map((p) => {
    const t = s + p.offset,
      cycle = Math.floor(t / p.period),
      phi = t / p.period - cycle,
      herd = middles[p.herd]!,
      h = fauna.herds[p.herd]!,
      angle = (c: number) => unit(p.key, c, 7) * 2 * Math.PI,
      a = angle(cycle),
      out = (c: number, d: number) => ({
        x: herd.x + d * Math.cos(angle(c)),
        z: herd.z + d * Math.sin(angle(c)),
      }),
      // The run ends short of where the herd fled to: it got away.
      end = (c: number) => ({
        x: herd.x - 18 * Math.cos(angle(c)),
        z: herd.z - 18 * Math.sin(angle(c)),
      }),
      prowl = out(cycle, 115),
      stalk = out(cycle, 42);
    let x: number,
      z: number,
      gait: 0 | 1 | 2,
      crouch: number,
      head: number,
      yaw: number | null = null;
    if (phi < 0.5) {
      const from = end(cycle - 1),
        k = smooth(0, 0.5, phi);
      x = from.x + (prowl.x - from.x) * k;
      z = from.z + (prowl.z - from.z) * k;
      gait = phi > 0.04 && phi < 0.48 ? 1 : 0;
      crouch = 0;
      head = 0.3;
      // (Prowling, they face the way they go.)
      yaw = Math.atan2(prowl.x - from.x, prowl.z - from.z);
    } else if (phi < 0.72) {
      const k = smooth(0.5, 0.72, phi);
      x = prowl.x + (stalk.x - prowl.x) * k;
      z = prowl.z + (stalk.z - prowl.z) * k;
      gait = 1;
      crouch = 1;
      head = 0.5;
    } else if (phi < 0.84) {
      const e = end(cycle),
        k = smooth(0.72, 0.84, phi);
      x = stalk.x + (e.x - stalk.x) * k;
      z = stalk.z + (e.z - stalk.z) * k;
      gait = 2;
      crouch = 0;
      head = 0.2;
    } else {
      const e = end(cycle);
      x = e.x;
      z = e.z;
      gait = 0;
      crouch = 0;
      head = 0.7;
    }
    // The herd: heads up as the hunters creep in, away at the run, back as they rest.
    const flee = a + Math.PI,
      away = phi < 0.72 ? 0 : phi < 0.86 ? smooth(0.72, 0.86, phi) : 1 - (phi - 0.86) / 0.54,
      lastAway = phi < 0.4 ? Math.max(0, 1 - (phi + 0.14) / 0.54) : 0,
      last = angle(cycle - 1) + Math.PI;
    herd.fx += h.flight * (away * Math.cos(flee) + lastAway * Math.cos(last));
    herd.fz += h.flight * (away * Math.sin(flee) + lastAway * Math.sin(last));
    // (Alarm comes over a herd, and leaves it, over a few seconds.)
    herd.alert = Math.max(herd.alert, smooth(0.5, 0.58, phi) * (1 - smooth(0.86, 0.95, phi)));
    herd.running = herd.running || (phi >= 0.72 && phi < 0.86);
    return { p, x, z, gait, crouch, head, yaw };
  });
  // The herds' beasts.
  fauna.herds.forEach((h, i) => {
    const m = middles[i]!,
      sp = species(h),
      stride = sp.body.p.stride;
    h.members.forEach((b, j) => {
      const t = s / b.period + b.phase,
        c = Math.floor(t),
        f = t - c,
        spot = (q: number) => ({
          x: b.dx + (unit(h.species * 977 + i, j, q) - 0.5) * 9,
          z: b.dz + (unit(h.species * 977 + i, j + 500, q) - 0.5) * 9,
        }),
        a = spot(c),
        z2 = spot(c + 1),
        k = smooth(0.7, 1, f),
        // (Alarmed, a herd bunches together.)
        tight = 1 - 0.35 * m.alert,
        x = m.x + m.fx + (a.x + (z2.x - a.x) * k) * tight,
        z = m.z + m.fz + (a.z + (z2.z - a.z) * k) * tight,
        o = next();
      o.species = h.species;
      o.x = x;
      o.z = z;
      if (m.running) {
        o.yaw = Math.atan2(m.fx, m.fz);
        o.pose.gait = 2;
        o.pose.head = 0;
      } else {
        o.yaw = Math.atan2(z2.x - a.x, z2.z - a.z);
        o.pose.gait = f > 0.72 && f < 0.98 ? 1 : 0;
        o.pose.head = m.alert > 0.5 ? 0 : o.pose.gait ? 0.25 : 1;
      }
      o.pose.crouch = 0;
      o.pose.phase = s * stride * (o.pose.gait === 2 ? 2.2 : 1) * 2 * Math.PI + j * 1.3;
      n++;
    });
  });
  // The hunters, a few paces apart, facing their way.
  bands.forEach((b, i) => {
    const sp = fauna.species[b.p.species]!,
      herd = middles[b.p.herd]!,
      // Facing the herd while they close on it; the way they walk while they prowl.
      toward = b.yaw ?? Math.atan2(herd.x - b.x, herd.z - b.z);
    for (let j = 0; j < b.p.members; j++) {
      // Each keeps its own place in the band (fixed on the ground, so a turn is no jump).
      const o = next(),
        a = j * 2.399963 + unit(b.p.key, j, 9) * 6.283,
        r = j ? 6 + 2 * j : 0;
      o.species = b.p.species;
      o.x = b.x + r * Math.cos(a);
      o.z = b.z + r * Math.sin(a);
      o.yaw = toward;
      o.pose.gait = b.gait;
      o.pose.crouch = b.crouch;
      o.pose.head = b.head;
      o.pose.phase = s * sp.body.p.stride * (b.gait === 2 ? 2.4 : 1) * 2 * Math.PI + i + j * 1.7;
      n++;
    }
  });
  return n;
}

/** A bird now: where (metres), how high, which way, and its wings' beat (radians). */
export type BirdNow = { x: number; y: number; z: number; yaw: number; wing: number; big: boolean };

export function birdsAt(fauna: Fauna, s: number, out: BirdNow[]): number {
  fauna.birds.forEach((b, i) => {
    const a = s * b.speed + b.phase,
      o = out[i] ?? (out[i] = { x: 0, y: 0, z: 0, yaw: 0, wing: 0, big: false });
    o.x = b.cx + b.r * Math.cos(a);
    o.z = b.cz + b.r * Math.sin(a);
    o.y = b.high + 3 * Math.sin(s * 0.5 + i);
    // Flying the circle's way (counter-clockwise seen from above).
    o.yaw = Math.atan2(-Math.sin(a), Math.cos(a));
    // Beating, then gliding a while: the big birds mostly glide.
    const beat = Math.sin(s * (b.big ? 3 : 9) + i * 1.9),
      glide = Math.sin(s * 0.7 + i) > (b.big ? -0.2 : 0.4);
    o.wing = glide ? 0.12 : 0.6 * beat;
    o.big = b.big;
  });
  return fauna.birds.length;
}

/** A fish now, if it is in the air: where (metres), how high, which way, its tip. */
export type FishNow = { x: number; y: number; z: number; yaw: number; pitch: number };

export function fishAt(fauna: Fauna, s: number, out: FishNow[]): number {
  let n = 0;
  for (const f of fauna.fish) {
    const t = s / f.period + f.phase,
      c = Math.floor(t),
      // A leap takes a tenth of its while; the rest of the time it is under the water.
      q = (t - c) / 0.1;
    if (q >= 1) continue;
    const o = out[n] ?? (out[n] = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }),
      yaw = f.yaw + c * 2.1,
      d = (q - 0.5) * 6;
    o.x = f.x + d * Math.sin(yaw);
    o.z = f.z + d * Math.cos(yaw);
    o.y = 5 * q * (1 - q);
    o.yaw = yaw;
    o.pitch = (q - 0.5) * 2.2 + Math.PI / 2;
    n++;
  }
  return n;
}
