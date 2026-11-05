// What each side's ships look like (Phase 67): pure geometry as typed arrays, with no playcanvas.
// A ship is a set of boxes ("prisms") laid out in one table per hull shape. A look is the fight's
// own colours, drive, arm and minds, so the same look always draws the same bytes. Nothing here is
// history: the ships, their names and their fates belong to the view.
import type { FightArm, FightDrive, FightRgb, FightSide } from "../bridge/index.ts";

export type Archetype = "dart" | "spindle" | "slab" | "manta" | "disc";
export type FleetLook = {
  readonly archetype: Archetype;
  readonly hull: FightRgb;
  readonly dark: FightRgb;
  readonly accent: FightRgb;
  readonly window: FightRgb;
  readonly engine: FightRgb;
  readonly arm: FightArm;
  readonly minds: boolean;
};
export type ShipClassName = "capital" | "line" | "escort" | "platform" | "lander";
export type ShipGeometry = {
  readonly positions: Float32Array; // x y z per vertex
  readonly normals: Float32Array;
  readonly colors: Uint8Array; // r g b a per vertex
  readonly indices: Uint16Array;
  readonly triangles: number;
};

// The shared little helpers, copied from the other Phase 67 tasks so the hashes agree.
const hashText = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
};
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// Colours.
const BASE_HULL: FightRgb = [0.55, 0.57, 0.6];
const DRIVE_COLOR: Record<FightDrive, FightRgb> = {
  none: [1, 0.55, 0.2],
  fusion: [0.55, 0.62, 1],
  sail: [1, 0.92, 0.65],
  antimatter: [1, 0.7, 1],
};
const mix = (a: FightRgb, b: FightRgb, k: number): FightRgb => [
  lerp(a[0], b[0], k),
  lerp(a[1], b[1], k),
  lerp(a[2], b[2], k),
];
const scale = (c: FightRgb, k: number): FightRgb => [c[0] * k, c[1] * k, c[2] * k];
/** The colour with its brightest channel turned up to 1 (black stays black). */
const fullStrength = (c: FightRgb): FightRgb => {
  const top = Math.max(c[0], c[1], c[2]);
  return top > 0 ? scale(c, 1 / top) : c;
};
/** The hue in degrees; 0 for a colour with no hue. */
const hueOf = (c: FightRgb): number => {
  const [r, g, b] = c;
  const top = Math.max(r, g, b);
  const d = top - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = top === r ? (g - b) / d : top === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
/** Whether two hues are within 50 degrees, going either way round the wheel. */
const hueNear = (a: FightRgb, b: FightRgb): boolean => {
  const gap = Math.abs(hueOf(a) - hueOf(b));
  return Math.min(gap, 360 - gap) <= 50;
};
/** Full-strength RGB for a hue sector (0 to 6) with the given chroma and second channel. */
const sectorRgb = (sector: number, chroma: number, x: number): FightRgb => {
  if (sector < 1) return [chroma, x, 0];
  if (sector < 2) return [x, chroma, 0];
  if (sector < 3) return [0, chroma, x];
  if (sector < 4) return [0, x, chroma];
  if (sector < 5) return [x, 0, chroma];
  return [chroma, 0, x];
};
/** The colour with its hue turned by `degrees`, keeping its brightness and its strength. */
const turnHue = (c: FightRgb, degrees: number): FightRgb => {
  const [r, g, b] = c;
  const low = Math.min(r, g, b);
  const chroma = Math.max(r, g, b) - low;
  if (chroma === 0) return c;
  const sector = ((hueOf(c) + degrees) % 360) / 60;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));
  const [R, G, B] = sectorRgb(sector, chroma, x);
  return [R + low, G + low, B + low];
};

// Shapes. A realm's pull or a people's clade picks the hull; a wet world's ships are mantas.
const CLADE_ARCHETYPE = new Map<string, Archetype>([
  ["trunk", "slab"],
  ["burrower", "disc"],
  ["strider", "spindle"],
  ["crawler", "disc"],
  ["shaggy", "dart"],
  ["swimmer", "manta"],
  ["shore", "manta"],
  ["other", "dart"],
]);
/** The shape a second fleet takes when it would otherwise match the first. */
const NEXT_ARCHETYPE: Record<Archetype, Archetype> = {
  dart: "slab",
  spindle: "dart",
  slab: "spindle",
  manta: "spindle",
  disc: "dart",
};

/** The hull shape a side's ships take. */
export function archetypeOf(side: FightSide): Archetype {
  if (side.medium !== "land") return "manta";
  if (side.kind === "people") return CLADE_ARCHETYPE.get(side.clade ?? "other") ?? "dart";
  if (side.gravity < 0.7) return "spindle";
  if (side.gravity > 1.3) return "slab";
  return "dart";
}

/** A side's look: the record's colour, its drive, its arm and whether minds fly it. */
export function fleetLook(side: FightSide, archetype?: Archetype): FleetLook {
  const hull = mix(BASE_HULL, side.color, 0.35);
  return {
    archetype: archetype ?? archetypeOf(side),
    hull,
    dark: scale(hull, 0.55),
    accent: fullStrength(side.color),
    window: side.minds ? [1, 0.25, 0.2] : [0.95, 0.92, 0.6],
    engine: driveColor(side.drive),
    arm: side.arm,
    minds: side.minds,
  };
}

/**
 * The two fleets' looks. If both would take one shape, the second takes the next one. If their hues
 * are within 50 degrees, the second fleet's colour is turned by 120 degrees, so they never read alike.
 */
export function fleetLooks(a: FightSide, d: FightSide): readonly [FleetLook, FleetLook] {
  const aArch = archetypeOf(a);
  const dBase = archetypeOf(d);
  const dArch = dBase === aArch ? NEXT_ARCHETYPE[dBase] : dBase;
  const dSide = hueNear(a.color, d.color) ? { ...d, color: turnHue(d.color, 120) } : d;
  return [fleetLook(a, aArch), fleetLook(dSide, dArch)];
}

export function driveColor(drive: FightDrive): FightRgb {
  return DRIVE_COLOR[drive];
}

// Geometry. Vectors, faces and prisms first; the shape tables follow.
type Vec3 = readonly [number, number, number];
type Rgba = readonly [number, number, number, number];
/** 0 hull, 1 dark, 2 accent, 3 window, 4 engine. */
type Tone = 0 | 1 | 2 | 3 | 4;
/**
 * escort: kept by the escort class. extra: the rest of the line, and the first to go from a wreck
 * half that is over budget. adds: capital only. means: the arm and minds. plain: platform and
 * lander parts. shard: a wreck's break.
 */
type Role = "escort" | "extra" | "adds" | "means" | "plain" | "shard";
type Prism = {
  readonly w0: number;
  readonly h0: number;
  readonly w1: number;
  readonly h1: number;
  readonly len: number;
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  readonly tone: Tone;
  readonly role: Role;
};
type Shape = { readonly line: readonly Prism[]; readonly adds: readonly Prism[] };
type Palette = {
  readonly hull: FightRgb;
  readonly dark: FightRgb;
  readonly accent: FightRgb;
  readonly window: FightRgb;
  readonly engine: FightRgb;
};
type Vertex = {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  r: number;
  g: number;
  b: number;
  a: number;
};
type Mesh = { verts: Vertex[]; indices: number[] };
/** A triangle, or a quad (the fourth corner present), in order around the face. */
type Face = readonly [Vec3, Vec3, Vec3, Vec3?];

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unitOf = (v: Vec3): Vec3 => {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
};
const neg = (v: Vec3): Vec3 => [-v[0], -v[1], -v[2]];
/** The unit normal of the corners a, b, c in that order. */
const normalOf = (a: Vec3, b: Vec3, c: Vec3): Vec3 => unitOf(cross(sub(b, a), sub(c, a)));

/**
 * Adds one flat face. Its corners are turned if need be so the winding faces `out`, and every
 * vertex carries the face's normal.
 */
const addFace = (mesh: Mesh, [a, b, c, d]: Face, out: Vec3, rgba: Rgba): void => {
  const raw = normalOf(a, b, c);
  const flip = dot(raw, out) < 0;
  const n = flip ? neg(raw) : raw;
  const ring: readonly Vec3[] = d
    ? flip
      ? [d, c, b, a]
      : [a, b, c, d]
    : flip
      ? [c, b, a]
      : [a, b, c];
  const base = mesh.verts.length;
  for (const p of ring) {
    mesh.verts.push({
      x: p[0],
      y: p[1],
      z: p[2],
      nx: n[0],
      ny: n[1],
      nz: n[2],
      r: rgba[0],
      g: rgba[1],
      b: rgba[2],
      a: rgba[3],
    });
  }
  mesh.indices.push(base, base + 1, base + 2);
  if (ring.length === 4) mesh.indices.push(base, base + 2, base + 3);
};

const byte = (k: number) => Math.round(clamp01(k) * 255);
const toneRgba = (pal: Palette, tone: Tone): Rgba => {
  const c =
    tone === 0
      ? pal.hull
      : tone === 1
        ? pal.dark
        : tone === 2
          ? pal.accent
          : tone === 3
            ? pal.window
            : pal.engine;
  return [byte(c[0]), byte(c[1]), byte(c[2]), 255];
};

/**
 * One prism, centred at (cx, cy, cz) with its length along Z: the back face w0 x h0 at cz - len/2,
 * the front face w1 x h1 at cz + len/2. Six flat faces, 24 vertices, 12 triangles.
 */
const addPrism = (mesh: Mesh, p: Prism, pal: Palette): void => {
  const rgba = toneRgba(pal, p.tone);
  const z0 = p.cz - p.len / 2;
  const z1 = p.cz + p.len / 2;
  const back = (sx: number, sy: number): Vec3 => [
    p.cx + (sx * p.w0) / 2,
    p.cy + (sy * p.h0) / 2,
    z0,
  ];
  const front = (sx: number, sy: number): Vec3 => [
    p.cx + (sx * p.w1) / 2,
    p.cy + (sy * p.h1) / 2,
    z1,
  ];
  addFace(mesh, [back(-1, -1), back(-1, 1), back(1, 1), back(1, -1)], [0, 0, -1], rgba);
  addFace(mesh, [front(-1, -1), front(1, -1), front(1, 1), front(-1, 1)], [0, 0, 1], rgba);
  addFace(mesh, [back(-1, -1), front(-1, -1), front(-1, 1), back(-1, 1)], [-1, 0, 0], rgba);
  addFace(mesh, [back(1, -1), back(1, 1), front(1, 1), front(1, -1)], [1, 0, 0], rgba);
  addFace(mesh, [back(-1, -1), back(1, -1), front(1, -1), front(-1, -1)], [0, -1, 0], rgba);
  addFace(mesh, [back(-1, 1), front(-1, 1), front(1, 1), back(1, 1)], [0, 1, 0], rgba);
};

const meshOf = (prisms: readonly Prism[], pal: Palette): Mesh => {
  const mesh: Mesh = { verts: [], indices: [] };
  for (const p of prisms) addPrism(mesh, p, pal);
  return mesh;
};

/**
 * The mesh as typed arrays. A class list is scaled uniformly so that z runs exactly from -0.5 to
 * 0.5 (x and y scale with it, and z is centred). A wreck is not scaled.
 */
const finish = (mesh: Mesh, normalise: boolean): ShipGeometry => {
  if (normalise) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of mesh.verts) {
      lo = Math.min(lo, v.z);
      hi = Math.max(hi, v.z);
    }
    const k = 1 / (hi - lo);
    const mid = (lo + hi) / 2;
    for (const v of mesh.verts) {
      v.x *= k;
      v.y *= k;
      v.z = (v.z - mid) * k;
    }
  }
  return {
    positions: Float32Array.from(mesh.verts.flatMap((v) => [v.x, v.y, v.z])),
    normals: Float32Array.from(mesh.verts.flatMap((v) => [v.nx, v.ny, v.nz])),
    colors: Uint8Array.from(mesh.verts.flatMap((v) => [v.r, v.g, v.b, v.a])),
    indices: Uint16Array.from(mesh.indices),
    triangles: mesh.indices.length / 3,
  };
};

/** One table row: back w0 x h0, front w1 x h1, length, tone, and the centre of each copy. */
const rows = (
  role: Role,
  w0: number,
  h0: number,
  w1: number,
  h1: number,
  len: number,
  tone: Tone,
  ...at: Vec3[]
): Prism[] => at.map(([cx, cy, cz]) => ({ w0, h0, w1, h1, len, cx, cy, cz, tone, role }));

// The shape tables, for a model 1 long. Escort rows are kept by the escort class; the rest of
// `line` is the line class; `adds` are the capital's extra boxes.
const DART: Shape = {
  line: [
    ...rows("escort", 0.16, 0.16, 0.14, 0.14, 0.62, 0, [0, 0, -0.06]), // hull
    ...rows("escort", 0.14, 0.14, 0.03, 0.03, 0.24, 0, [0, 0, 0.37]), // nose
    ...rows("escort", 0.2, 0.2, 0.18, 0.18, 0.14, 1, [0, 0, -0.43]), // tail block
    ...rows("escort", 0.28, 0.02, 0.06, 0.02, 0.26, 2, [0, 0, -0.3]), // flat fin
    ...rows("extra", 0.02, 0.28, 0.02, 0.06, 0.26, 2, [0, 0, -0.3]), // upright fin
    ...rows("extra", 0.08, 0.06, 0.06, 0.05, 0.12, 3, [0, 0.1, 0.05]), // bridge
  ],
  adds: [
    ...rows("adds", 0.08, 0.08, 0.07, 0.07, 0.42, 1, [-0.16, 0, -0.1], [0.16, 0, -0.1]), // pods
    ...rows("adds", 0.05, 0.03, 0.05, 0.03, 0.05, 1, [0, 0.1, -0.2], [0, 0.1, -0.1], [0, 0.1, 0.2]),
  ],
};
const SPINDLE: Shape = {
  line: [
    ...rows("escort", 0.06, 0.06, 0.05, 0.05, 0.78, 0, [0, 0, -0.06]), // needle
    ...rows("escort", 0.05, 0.05, 0.01, 0.01, 0.16, 2, [0, 0, 0.42]), // tip
    ...rows("escort", 0.44, 0.015, 0.44, 0.015, 0.03, 1, [0, 0, -0.3]), // strut, rear
    ...rows("extra", 0.44, 0.015, 0.44, 0.015, 0.03, 1, [0, 0, 0.1]), // strut, fore
    ...rows("extra", 0.07, 0.07, 0.06, 0.06, 0.3, 1, [-0.22, 0, -0.3], [0.22, 0, -0.3]), // engines
    ...rows("extra", 0.03, 0.03, 0.03, 0.03, 0.06, 3, [0, 0.04, 0.2]), // window
  ],
  adds: [
    ...rows("adds", 0.3, 0.02, 0.3, 0.02, 0.05, 2, [0, -0.12, 0.1], [0, 0.12, 0.1]),
    ...rows("adds", 0.02, 0.3, 0.02, 0.3, 0.05, 2, [-0.12, 0, 0.1], [0.12, 0, 0.1]),
  ],
};
const SLAB: Shape = {
  line: [
    ...rows("escort", 0.38, 0.24, 0.34, 0.22, 0.7, 0, [0, 0, -0.1]), // body
    ...rows("escort", 0.34, 0.22, 0.16, 0.08, 0.22, 0, [0, 0, 0.36]), // prow
    ...rows("escort", 0.39, 0.03, 0.35, 0.03, 0.04, 2, [0, 0, 0.12]), // stripe
    ...rows("extra", 0.26, 0.1, 0.22, 0.09, 0.42, 1, [0, 0.16, -0.12]), // deck
    ...rows("extra", 0.04, 0.2, 0.04, 0.18, 0.6, 1, [-0.21, 0, -0.1], [0.21, 0, -0.1]), // plates
    ...rows("extra", 0.1, 0.06, 0.08, 0.05, 0.1, 3, [0, 0.24, -0.2]), // bridge
  ],
  adds: [
    ...rows(
      "adds",
      0.1,
      0.1,
      0.1,
      0.1,
      0.08,
      1,
      [-0.13, 0, -0.46],
      [0, 0, -0.46],
      [0.13, 0, -0.46],
    ),
  ],
};
const MANTA: Shape = {
  line: [
    ...rows("escort", 0.72, 0.07, 0.12, 0.05, 0.86, 0, [0, 0, -0.06]), // wing
    ...rows("escort", 0.1, 0.1, 0.05, 0.05, 0.6, 1, [0, 0.07, 0]), // ridge
    ...rows("extra", 0.04, 0.16, 0.03, 0.06, 0.22, 2, [-0.2, 0.08, -0.38], [0.2, 0.08, -0.38]), // tails
    ...rows("extra", 0.08, 0.06, 0.05, 0.05, 0.34, 1, [-0.2, -0.05, -0.1], [0.2, -0.05, -0.1]), // pods
    ...rows("extra", 0.05, 0.02, 0.04, 0.02, 0.08, 3, [0, 0.1, 0.2]), // window
  ],
  adds: [...rows("adds", 0.07, 0.05, 0.05, 0.04, 0.3, 1, [-0.1, -0.05, 0.05], [0.1, -0.05, 0.05])],
};
const DISC: Shape = {
  line: [
    ...rows("escort", 0.8, 0.08, 0.8, 0.08, 0.34, 0, [0, 0, 0]), // crossing, short
    ...rows("escort", 0.5, 0.08, 0.5, 0.08, 0.72, 0, [0, 0, 0]), // crossing, middle
    ...rows("escort", 0.28, 0.08, 0.28, 0.08, 1, 0, [0, 0, 0]), // crossing, long
    ...rows("escort", 0.26, 0.14, 0.14, 0.05, 0.26, 3, [0, 0.1, 0]), // dome
    ...rows("extra", 0.9, 0.025, 0.9, 0.025, 0.04, 2, [0, 0, -0.12], [0, 0, 0.12]), // rim
    ...rows("extra", 0.2, 0.08, 0.14, 0.05, 0.3, 1, [0, -0.09, 0]), // under-pod
  ],
  adds: [...rows("adds", 0.1, 0.08, 0.1, 0.08, 0.2, 1, [-0.3, 0, 0], [0.3, 0, 0])],
};
const SHAPES: Record<Archetype, Shape> = {
  dart: DART,
  spindle: SPINDLE,
  slab: SLAB,
  manta: MANTA,
  disc: DISC,
};

const BEAM_SPINE = rows("means", 0.025, 0.025, 0.012, 0.012, 0.55, 2, [0, -0.09, 0.22]);
const MISSILE_RACKS = rows(
  "means",
  0.06,
  0.03,
  0.06,
  0.03,
  0.22,
  1,
  [-0.1, 0.08, 0.02],
  [0.1, 0.08, 0.02],
);
const MINDS_BAR = rows("means", 0.14, 0.02, 0.14, 0.02, 0.02, 3, [0, 0.1, 0]);

const LANDER_BODY: Record<Archetype, readonly Prism[]> = {
  dart: rows("plain", 0.4, 0.4, 0.3, 0.3, 0.6, 0, [0, 0, -0.1]),
  spindle: rows("plain", 0.4, 0.4, 0.3, 0.3, 0.6, 0, [0, 0, -0.1]),
  slab: rows("plain", 0.55, 0.45, 0.45, 0.35, 0.6, 0, [0, 0, -0.1]),
  manta: rows("plain", 0.8, 0.22, 0.35, 0.16, 0.6, 0, [0, 0, -0.1]),
  disc: [
    ...rows("plain", 0.8, 0.2, 0.7, 0.2, 0.4, 0, [0, 0, -0.1]),
    ...rows("plain", 0.4, 0.3, 0.3, 0.2, 0.4, 0, [0, 0, 0.1]),
  ],
};
const LANDER_PARTS: readonly Prism[] = [
  ...rows("plain", 0.3, 0.3, 0.12, 0.12, 0.22, 2, [0, 0, 0.32]), // nose cap
  ...rows(
    "plain",
    0.05,
    0.05,
    0.03,
    0.03,
    0.36,
    1,
    [0.3, 0, -0.42],
    [-0.15, 0.26, -0.42],
    [-0.15, -0.26, -0.42],
  ), // legs
  ...rows("plain", 0.16, 0.03, 0.16, 0.03, 0.22, 3, [0, 0.21, -0.15]), // door
];
const PLATFORM: readonly Prism[] = [
  ...rows("plain", 0.9, 0.08, 0.9, 0.08, 0.1, 0, [0, 0, -0.42], [0, 0, 0.42]),
  ...rows("plain", 0.1, 0.08, 0.1, 0.08, 0.9, 0, [-0.42, 0, 0], [0.42, 0, 0]),
  ...rows("plain", 0.2, 0.2, 0.2, 0.2, 0.2, 1, [0, 0, 0]), // hub
  ...rows("plain", 0.9, 0.03, 0.9, 0.03, 0.03, 2, [0, 0, 0]), // spoke
  ...rows("plain", 0.03, 0.03, 0.03, 0.03, 0.9, 2, [0, 0, 0]), // spoke
  ...rows("plain", 0.06, 0.06, 0.06, 0.06, 0.06, 3, [0, 0.12, 0]), // window
];

const landerOf = (archetype: Archetype): Prism[] => [...LANDER_BODY[archetype], ...LANDER_PARTS];

/** A wreck half is at most 6 prisms and its 2 shards: 8 boxes, 96 triangles. */
const HALF_PRISMS = 6;
const volumeOf = (p: Prism): number => ((p.w0 * p.h0 + p.w1 * p.h1) / 2) * p.len;
/** Drops the smallest "extra" prisms until at most `max` remain. Escort and means are kept. */
const trimToBudget = (prisms: readonly Prism[], max: number): Prism[] => {
  const kept = [...prisms];
  while (kept.length > max) {
    let pick = -1;
    let least = Infinity;
    for (const [i, p] of kept.entries()) {
      if (p.role === "extra" && volumeOf(p) < least) {
        least = volumeOf(p);
        pick = i;
      }
    }
    if (pick < 0) break;
    kept.splice(pick, 1);
  }
  return kept;
};

/** The line class: the shape's line with the arm's means, and minds in place of the bridge. */
const lineOf = (look: FleetLook): Prism[] => {
  const body = SHAPES[look.archetype].line.filter((p) => !(look.minds && p.tone === 3));
  return [
    ...body,
    ...(look.arm === "beam" ? BEAM_SPINE : MISSILE_RACKS),
    ...(look.minds ? MINDS_BAR : []),
  ];
};

/** One ship class as typed arrays. */
export function shipGeometry(look: FleetLook, cls: ShipClassName): ShipGeometry {
  if (cls === "platform") return finish(meshOf(PLATFORM, look), true);
  if (cls === "lander") return finish(meshOf(landerOf(look.archetype), look), true);
  const shape = SHAPES[look.archetype];
  if (cls === "escort") {
    return finish(
      meshOf(
        shape.line.filter((p) => p.role === "escort"),
        look,
      ),
      true,
    );
  }
  const line = lineOf(look);
  return finish(meshOf(cls === "capital" ? [...line, ...shape.adds] : line, look), true);
}

/**
 * One half of a wrecked line ship: part 0 is the forward half (prisms with cz >= 0), part 1 the
 * aft half. Each gets two dark shards at the break, and tone 3 goes dark. Not scaled.
 */
export function wreckGeometry(look: FleetLook, part: 0 | 1): ShipGeometry {
  const half = lineOf(look).filter((p) => (part === 0 ? p.cz >= 0 : p.cz < 0));
  const kept = trimToBudget(half, HALF_PRISMS).map((p): Prism =>
    p.tone === 3 ? { ...p, tone: 1 } : p,
  );
  const cz = part === 0 ? -0.06 : 0.06;
  const shards = rows("shard", 0.1, 0.02, 0.02, 0.02, 0.12, 1, [-0.05, 0, cz], [0.05, 0, cz]);
  return finish(meshOf([...kept, ...shards], look), false);
}

/** A four-sided pyramid of white light behind an engine: base at z = 0, tip at z = -1. */
export function flameGeometry(): ShipGeometry {
  const mesh: Mesh = { verts: [], indices: [] };
  const white: Rgba = [255, 255, 255, 255];
  const tip: Vec3 = [0, 0, -1];
  const corner = (x: number, y: number): Vec3 => [x, y, 0];
  addFace(mesh, [corner(0.5, 0.5), corner(-0.5, 0.5), tip], [0, 1, 0], white);
  addFace(mesh, [corner(-0.5, -0.5), corner(0.5, -0.5), tip], [0, -1, 0], white);
  addFace(mesh, [corner(0.5, -0.5), corner(0.5, 0.5), tip], [1, 0, 0], white);
  addFace(mesh, [corner(-0.5, 0.5), corner(-0.5, -0.5), tip], [-1, 0, 0], white);
  addFace(
    mesh,
    [corner(-0.5, -0.5), corner(0.5, -0.5), corner(0.5, 0.5), corner(-0.5, 0.5)],
    [0, 0, 1],
    white,
  );
  return finish(mesh, false);
}

// Names and refs. The names are hashed from the fight, so they never change.
const NAME_START = [
  "Ka",
  "Ro",
  "Ves",
  "Tal",
  "Mir",
  "Dun",
  "Se",
  "Or",
  "Ith",
  "Bra",
  "Lo",
  "Ne",
  "Hal",
  "Ky",
  "Un",
  "Ar",
];
const NAME_MID = ["va", "ren", "mo", "li", "dar", "tha", "si", "gor", "ne", "ku", "ra", "sen"];
const NAME_END = ["n", "r", "th", "l", "s", "k", "m", ""];

/** A ship's name, hashed from its fight, side and index. */
export function shipName(fightId: string, side: 0 | 1, index: number): string {
  const h = hashText(`${fightId} ${side} ${index}`);
  return (
    (NAME_START[h % 16] ?? "") + (NAME_MID[(h >>> 4) % 12] ?? "") + (NAME_END[(h >>> 8) % 8] ?? "")
  );
}

/** A ship's ref, as a page carries it: `ship:<fight with dots>:<side>:<index>:<class>:<broke>:<name>`. */
export function shipRef(
  fightId: string,
  side: 0 | 1,
  index: number,
  cls: 0 | 1 | 2,
  broke: boolean,
): string {
  const fight = fightId.replace(/:/g, ".");
  return `ship:${fight}:${side}:${index}:${cls}:${broke ? 1 : 0}:${shipName(fightId, side, index)}`;
}
