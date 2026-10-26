// A specimen (Phase 54 M223): a substance, an element or a made thing drawn as a procedural
// object — cut as its crystals grow, bar-shaped as a metal pours, a flask or an ampoule for what
// is liquid or gas, a tool or a pot or an arm as it was made of its stuff.
//
// The same low-poly look as portrait.ts: flat-shaded faces on a 2D canvas, turned about the up
// axis, tipped to look down, painted back to front. Everything is keyed, never random, so the
// same portrait always draws the same picture.
import type { Habit, Lustre, MadeHow, MatterForm, Portrait } from "../bridge/index.ts";

export type V3 = [number, number, number];
/** A closed mesh: its corners and its faces (corner indices, wound outward, seen from outside counter-clockwise). */
export type Mesh = { readonly v: readonly V3[]; readonly f: readonly (readonly number[])[] };
/** A part of a specimen: a mesh placed, coloured and lit as its stuff takes light. */
export type SpecimenPart = {
  readonly mesh: Mesh;
  readonly color: readonly [number, number, number];
  readonly lustre: Lustre;
  /** 0 opaque … 1 clear. */
  readonly clarity: number;
  /** Per-face brightness factors (knapping scars, tarnish), same length as mesh.f; absent: all 1. */
  readonly tint?: readonly number[];
  /** A glow (a gas lit in its glass): drawn additive, ignores the light. */
  readonly glow?: boolean;
  /** A glow that burns strong, like a discharge tube (a noble gas); faint otherwise. */
  readonly strong?: boolean;
  /** How much its shine shows (1 bright … 0 none): a worn thing shines less. Absent: 1. */
  readonly gloss?: number;
  /** A haft, a stock or a handle: in a close picture of a made thing it may run out of the frame. */
  readonly handle?: boolean;
  /** Lines drawn over it, in their own colour: a bow's string, a break's ripples. */
  readonly strokes?: readonly {
    readonly points: readonly V3[];
    readonly color: Rgb;
    /** A ripple of a conchoidal break (dropped in a thumbnail); absent for a string. */
    readonly ripple?: boolean;
  }[];
};

type Rgb = readonly [number, number, number];
type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

// ---- Vectors and the keyed hash --------------------------------------------------------------

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** A hash of a key and an index, as a float in [0, 1): the same for the same key, always. */
function hash(key: number, i: number): number {
  const h = ((Math.imul(key >>> 0, 2654435761) + Math.imul(i + 1, 40503)) >>> 0) ^ (key >>> 3);
  let x = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 3266489917) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
/** A keyed draw from `lo` to `hi`. */
const between = (key: number, i: number, lo: number, hi: number): number =>
  lo + (hi - lo) * hash(key, i);

/** A face's centroid. */
function centroid(mesh: Mesh, face: readonly number[]): V3 {
  let s: V3 = [0, 0, 0];
  for (const i of face) s = add(s, mesh.v[i]!);
  return scl(s, 1 / face.length);
}

/** A face's normal by Newell's method (robust for any planar or nearly planar polygon). */
function newell(mesh: Mesh, face: readonly number[]): V3 {
  let n: V3 = [0, 0, 0];
  for (let i = 0; i < face.length; i++) {
    const a = mesh.v[face[i]!]!,
      b = mesh.v[face[(i + 1) % face.length]!]!;
    n = [
      n[0] + (a[1] - b[1]) * (a[2] + b[2]),
      n[1] + (a[2] - b[2]) * (a[0] + b[0]),
      n[2] + (a[0] - b[0]) * (a[1] + b[1]),
    ];
  }
  return n;
}

/**
 * Wind each face so its normal points the way its hint says (the outward way). A hint is what
 * the builder knows of which side is outside; without one, the mesh's own middle decides, which
 * is right for every convex solid.
 */
function outward(mesh: Mesh, hints?: readonly (V3 | null)[]): Mesh {
  const mid = scl(
    mesh.v.reduce((a, p) => add(a, p), [0, 0, 0] as V3),
    1 / Math.max(1, mesh.v.length),
  );
  const f = mesh.f.map((face, k) => {
    if (face.length < 3) return face;
    const hint = hints?.[k] ?? sub(centroid(mesh, face), mid);
    return dot(newell(mesh, face), hint) < 0 ? [...face].reverse() : face;
  });
  return { v: mesh.v, f };
}

/** Two meshes as one (their corners joined, their faces kept). */
function join(...meshes: readonly Mesh[]): Mesh {
  const v: V3[] = [],
    f: number[][] = [];
  for (const m of meshes) {
    const base = v.length;
    v.push(...m.v);
    for (const face of m.f) f.push(face.map((i) => i + base));
  }
  return { v, f };
}

/** Corners and faces with their faces wound outward (convex pieces: the mesh's own middle decides). */
const closed = (v: V3[], f: number[][]): Mesh => outward({ v, f });

// ---- Mesh builders (each in its own frame, about unit size, centred on the origin, y up) ------

/** A box of the given sizes. */
function box(sx: number, sy: number, sz: number): Mesh {
  const x = sx / 2,
    y = sy / 2,
    z = sz / 2;
  return closed(
    [
      [-x, -y, -z],
      [x, -y, -z],
      [x, y, -z],
      [-x, y, -z],
      [-x, -y, z],
      [x, -y, z],
      [x, y, z],
      [-x, y, z],
    ],
    [
      [0, 3, 2, 1],
      [4, 5, 6, 7],
      [0, 4, 7, 3],
      [1, 2, 6, 5],
      [3, 7, 6, 2],
      [0, 1, 5, 4],
    ],
  );
}

/** An n-sided prism of circumradius r and height h, standing on its base. */
function prism(n: number, r: number, h: number): Mesh {
  const v: V3[] = [],
    f: number[][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    v.push([r * Math.cos(a), -h / 2, r * Math.sin(a)]);
    v.push([r * Math.cos(a), h / 2, r * Math.sin(a)]);
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    f.push([2 * i, 2 * i + 1, 2 * j + 1, 2 * j]);
  }
  f.push(Array.from({ length: n }, (_, i) => 2 * i + 1));
  f.push(Array.from({ length: n }, (_, i) => 2 * (n - 1 - i)));
  return outward({ v, f });
}

/** A pyramid: an n-gon of circumradius r at height 0, its point at height h. */
function pyramid(n: number, r: number, h: number): Mesh {
  const v: V3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    v.push([r * Math.cos(a), 0, r * Math.sin(a)]);
  }
  v.push([0, h, 0]);
  const f: number[][] = [];
  for (let i = 0; i < n; i++) f.push([i, (i + 1) % n, n]);
  f.push(Array.from({ length: n }, (_, i) => n - 1 - i));
  return outward({ v, f });
}

/** Two pyramids on one base: an n-gon at height 0, a point above (h) and below (-h). */
function bipyramid(n: number, r: number, h: number): Mesh {
  // (No base face: an equator inside the solid would show through as a painted disc.)
  const v: V3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    v.push([r * Math.cos(a), 0, r * Math.sin(a)]);
  }
  v.push([0, h, 0], [0, -h, 0]);
  const f: number[][] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    f.push([i, j, n], [i, j, n + 1]);
  }
  return outward({ v, f });
}

/**
 * A surface of revolution about the up axis: its profile (radius, height) pairs listed from the
 * bottom axis point up to the top one along the outside, so the solid lies on the left of each
 * step and its faces wind outward. Capped at both ends.
 */
function lathe(profile: readonly (readonly [number, number])[], sides: number): Mesh {
  const v: V3[] = [],
    f: number[][] = [],
    hints: (V3 | null)[] = [];
  const m = profile.length;
  // Each profile ring is a ring of `sides` corners, or, on the axis, one corner shared by all.
  const ring: number[][] = [];
  for (const [r, y] of profile) {
    if (r < 1e-9) {
      const k = v.length;
      v.push([0, y, 0]);
      ring.push(Array.from({ length: sides }, () => k));
      continue;
    }
    const row: number[] = [];
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      row.push(v.length);
      v.push([r * Math.cos(a), y, r * Math.sin(a)]);
    }
    ring.push(row);
  }
  for (let i = 0; i < m - 1; i++) {
    const [r0, y0] = profile[i]!,
      [r1, y1] = profile[i + 1]!;
    const dr = r1 - r0,
      dy = y1 - y0;
    if (Math.hypot(dr, dy) < 1e-9) continue;
    for (let j = 0; j < sides; j++) {
      const j2 = (j + 1) % sides;
      // A quad, or a triangle where one side of it is the axis.
      const loop: number[] = [];
      for (const x of [ring[i]![j]!, ring[i]![j2]!, ring[i + 1]![j2]!, ring[i + 1]![j]!])
        if (loop[loop.length - 1] !== x) loop.push(x);
      if (loop.length > 1 && loop[0] === loop[loop.length - 1]) loop.pop();
      if (loop.length < 3) continue;
      f.push(loop);
      // The profile's outward normal in (radius, height) is (dy, -dr); at the mid angle it lies
      // radially outward and up.
      const a = ((j + 0.5) / sides) * Math.PI * 2;
      hints.push([dy * Math.cos(a), -dr, dy * Math.sin(a)]);
    }
  }
  // The caps: a fan over each end ring, unless the end is the axis itself.
  if (profile[0]![0] >= 1e-9) {
    const bottom = v.length;
    v.push([0, profile[0]![1], 0]);
    for (let j = 0; j < sides; j++) {
      f.push([bottom, ring[0]![(j + 1) % sides]!, ring[0]![j]!]);
      hints.push([0, -1, 0]);
    }
  }
  if (profile[m - 1]![0] >= 1e-9) {
    const top = v.length;
    v.push([0, profile[m - 1]![1], 0]);
    for (let j = 0; j < sides; j++) {
      f.push([top, ring[m - 1]![j]!, ring[m - 1]![(j + 1) % sides]!]);
      hints.push([0, 1, 0]);
    }
  }
  return outward({ v, f }, hints);
}

/** A sphere of unit radius: an icosahedron, subdivided once (sub = 1) or not (sub = 0). */
function icosphere(sub: 0 | 1): Mesh {
  const t = (1 + Math.sqrt(5)) / 2;
  let v: V3[] = [
    [-1, t, 0],
    [1, t, 0],
    [-1, -t, 0],
    [1, -t, 0],
    [0, -1, t],
    [0, 1, t],
    [0, -1, -t],
    [0, 1, -t],
    [t, 0, -1],
    [t, 0, 1],
    [-t, 0, -1],
    [-t, 0, 1],
  ].map((p) => norm(p as V3));
  let f: number[][] = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];
  if (sub === 1) {
    const mid = new Map<string, number>();
    const half = (a: number, b: number): number => {
      const k = a < b ? `${a}-${b}` : `${b}-${a}`;
      const hit = mid.get(k);
      if (hit !== undefined) return hit;
      v = [...v, norm(scl(add(v[a]!, v[b]!), 0.5))];
      mid.set(k, v.length - 1);
      return v.length - 1;
    };
    const next: number[][] = [];
    for (const [a, b, c] of f as [number, number, number][]) {
      const ab = half(a, b),
        bc = half(b, c),
        ca = half(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    f = next;
  }
  return outward({ v, f });
}

/** Corners pushed along their own radius by a keyed amount (0 … amount): lumpy, never the same twice. */
function jitter(mesh: Mesh, key: number, amount: number): Mesh {
  return {
    v: mesh.v.map((p, i) => {
      const k = 1 + (hash(key, i + 101) * 2 - 1) * amount;
      return scl(p, k);
    }),
    f: mesh.f,
  };
}

/** The convex hull of a few points (incremental, fine for a few dozen): its faces outward. */
function hull(points: readonly V3[]): Mesh {
  const pts = points.map((p) => [...p] as V3);
  const n = pts.length;
  if (n < 4) return box(0.01, 0.01, 0.01);
  const faces: [number, number, number][] = [];
  // A starting tetrahedron from four points that do not lie flat.
  let a = 0,
    b = 1,
    c = 2,
    d = 3;
  for (let i = 0; i < n; i++) {
    if (i === a || i === b || i === c) continue;
    if (
      Math.abs(dot(cross(sub(pts[b]!, pts[a]!), sub(pts[c]!, pts[a]!)), sub(pts[i]!, pts[a]!))) >
      1e-9
    ) {
      d = i;
      break;
    }
  }
  // (The starting tetrahedron's own middle: the points' middle need not lie inside it.)
  const cen = scl(add(add(pts[a]!, pts[b]!), add(pts[c]!, pts[d]!)), 0.25);
  const orientTri = (i: number, j: number, k: number): [number, number, number] => {
    const nn = cross(sub(pts[j]!, pts[i]!), sub(pts[k]!, pts[i]!));
    return dot(nn, sub(pts[i]!, cen)) < 0 ? [i, k, j] : [i, j, k];
  };
  faces.push(orientTri(a, b, c), orientTri(a, b, d), orientTri(a, c, d), orientTri(b, c, d));
  for (let i = 0; i < n; i++) {
    if (i === a || i === b || i === c || i === d) continue;
    const visible: number[] = [];
    faces.forEach((fc, k) => {
      const [p, q, r] = fc;
      const nn = cross(sub(pts[q]!, pts[p]!), sub(pts[r]!, pts[p]!));
      if (dot(nn, sub(pts[i]!, pts[p]!)) > 1e-12) visible.push(k);
    });
    if (!visible.length) continue;
    // The horizon: edges used by exactly one visible face.
    const edges = new Map<string, [number, number]>();
    for (const k of visible) {
      const [p, q, r] = faces[k]!;
      for (const [x, y] of [
        [p, q],
        [q, r],
        [r, p],
      ] as [number, number][]) {
        const key = `${x}-${y}`;
        if (edges.has(`${y}-${x}`)) edges.delete(`${y}-${x}`);
        else edges.set(key, [x, y]);
      }
    }
    const keep = faces.filter((_, k) => !visible.includes(k));
    for (const [x, y] of edges.values()) keep.push([x, y, i]);
    faces.length = 0;
    faces.push(...keep);
  }
  // The points the hull keeps, reindexed.
  const used = [...new Set(faces.flat())].sort((x, y) => x - y);
  const at = new Map<number, number>(used.map((old, i): [number, number] => [old, i]));
  return outward({
    v: used.map((i) => pts[i]!),
    f: faces.map((fc) => fc.map((i) => at.get(i)!)),
  });
}

/** A mesh moved by a vector. */
function move(mesh: Mesh, by: V3): Mesh {
  return { v: mesh.v.map((p) => add(p, by)), f: mesh.f };
}

/** A mesh stretched by a factor on each axis. */
function scale(mesh: Mesh, k: V3): Mesh {
  return { v: mesh.v.map((p) => [p[0] * k[0], p[1] * k[1], p[2] * k[2]] as V3), f: mesh.f };
}

/** A mesh turned: yaw about up, then pitch about x, then roll about z. */
function rotate(mesh: Mesh, yaw: number, pitch: number, roll: number): Mesh {
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch),
    cr = Math.cos(roll),
    sr = Math.sin(roll);
  return {
    v: mesh.v.map((p) => {
      const x1 = p[0] * cy + p[2] * sy,
        z1 = -p[0] * sy + p[2] * cy;
      const y2 = p[1] * cp - z1 * sp,
        z2 = p[1] * sp + z1 * cp;
      return [x1 * cr - y2 * sr, x1 * sr + y2 * cr, z2] as V3;
    }),
    f: mesh.f,
  };
}

/** A prism whose corners stand at keyed radii (a gear's teeth): radii around the axis, height h. */
function ringPrism(radii: readonly number[], h: number): Mesh {
  const n = radii.length,
    v: V3[] = [],
    f: number[][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    v.push([radii[i]! * Math.cos(a), -h / 2, radii[i]! * Math.sin(a)]);
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    v.push([radii[i]! * Math.cos(a), h / 2, radii[i]! * Math.sin(a)]);
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    f.push([i, j, n + j, n + i]);
  }
  f.push(Array.from({ length: n }, (_, i) => n - 1 - i));
  f.push(Array.from({ length: n }, (_, i) => n + i));
  return outward({ v, f });
}

/** A pointed prism: an n-gon of circumradius r and height h, its point (`point` high) on top. */
function capped(n: number, r: number, h: number, point: number): Mesh {
  const v: V3[] = [],
    f: number[][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    v.push([r * Math.cos(a), -h / 2, r * Math.sin(a)]);
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    v.push([r * Math.cos(a), h / 2, r * Math.sin(a)]);
  }
  const apex = 2 * n;
  v.push([0, h / 2 + point, 0]);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    f.push([i, j, n + j, n + i]);
    f.push([n + i, n + j, apex]);
  }
  f.push(Array.from({ length: n }, (_, i) => n - 1 - i));
  return outward({ v, f });
}

/** A rod of square section (t) from a to b, its base at a. */
function beam(a: V3, b: V3, t: number): Mesh {
  const d = sub(b, a),
    len = Math.hypot(d[0], d[1], d[2]) || 1e-6,
    u = scl(d, 1 / len);
  const m = move(box(t, len, t), [0, len / 2, 0]);
  // Turn the rod's up axis onto u (Rodrigues about y x u).
  const ax = cross([0, 1, 0], u),
    s = Math.hypot(ax[0], ax[1], ax[2]),
    c = u[1];
  let r = m;
  if (s > 1e-9) {
    const k = scl(ax, 1 / s);
    r = {
      v: m.v.map((p) => add(add(scl(p, c), scl(cross(k, p), s)), scl(k, dot(k, p) * (1 - c)))),
      f: m.f,
    };
  } else if (c < 0) r = { v: m.v.map((p) => [p[0], -p[1], -p[2]] as V3), f: m.f };
  return move(r, a);
}

/** Corners turned about the up axis by a sine of their angle: a thrown pot's wobble. */
function wobble(mesh: Mesh, amount: number, phase: number): Mesh {
  return {
    v: mesh.v.map((p) => {
      const a = Math.atan2(p[2], p[0]);
      const k = 1 + amount * Math.sin(3 * a + phase);
      return [p[0] * k, p[1], p[2] * k] as V3;
    }),
    f: mesh.f,
  };
}

/** The faces of a mesh that a test keeps, as a mesh of their own (corners renumbered). */
function pick(mesh: Mesh, keep: (face: readonly number[], k: number) => boolean): Mesh {
  const map = new Map<number, number>(),
    v: V3[] = [],
    f: number[][] = [];
  mesh.f.forEach((face, k) => {
    if (!keep(face, k)) return;
    f.push(
      face.map((i) => {
        let j = map.get(i);
        if (j === undefined) {
          j = v.length;
          map.set(i, j);
          v.push(mesh.v[i]!);
        }
        return j;
      }),
    );
  });
  return { v, f };
}

/** Faces tinted dark in bands of their middle height: a period, and the bands' share of it. */
function bandsTint(mesh: Mesh, period: number, dark: number, share: number): number[] {
  return mesh.f.map((face) => {
    const y = centroid(mesh, face)[1] / period;
    return y - Math.floor(y) < share ? dark : 1;
  });
}

/** A worn blade's nicks: the 1 to 3 corners furthest along x, pulled in toward the axis. */
function nick(mesh: Mesh, key: number, count: number): Mesh {
  const order = mesh.v
    .map((p, i) => [p[0], i] as const)
    .sort((a, b) => b[0] - a[0] || a[1] - b[1])
    .slice(0, count);
  const v = mesh.v.map((p) => [...p] as V3);
  order.forEach(([, i], j) => {
    v[i] = scl(v[i]!, 0.55 - 0.1 * hash(key, 900 + j));
  });
  return { v, f: mesh.f };
}

/** One part of a specimen: its mesh, its colour and lustre, and the rest said as it is. */
const part = (
  mesh: Mesh,
  color: Rgb,
  lustre: Lustre,
  clarity = 0,
  extra: Partial<SpecimenPart> = {},
): SpecimenPart => ({ mesh, color, lustre, clarity, ...extra });

// ---- Colours ------------------------------------------------------------------------------------

const WHITE: Rgb = [1, 1, 1];
const WATER: Rgb = [0.8, 0.9, 0.98];
const GLASS: Rgb = [0.8, 0.88, 0.9];
const OIL: Rgb = [0.85, 0.7, 0.3];
const CLAY: Rgb = [0.72, 0.5, 0.36];
const CLAY_DARK: Rgb = [0.5, 0.36, 0.26];
const CLAY_GREY: Rgb = [0.62, 0.6, 0.58];
const WOOD: Rgb = [0.55, 0.4, 0.25];
const LEATHER: Rgb = [0.55, 0.4, 0.25];

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const dim = (c: Rgb, k: number): Rgb => [c[0] * k, c[1] * k, c[2] * k];
/** Colourless (water, alcohol, a pale gas): near white, with no hue to speak of. */
const isColourless = (c: Rgb): boolean =>
  Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]) < 0.12 && (c[0] + c[1] + c[2]) / 3 > 0.6;

// ---- Matter (kind "matter") ---------------------------------------------------------------------

/** A crystal's mesh by its habit, as it grows. `rough` is how lumpy a lump is (harder: crisper). */
function habitMesh(habit: Habit, key: number, rough: number): Mesh {
  const h = (i: number) => hash(key, i);
  switch (habit) {
    case "cubic": {
      const big = box(1, 1, 1);
      if (h(1) < 0.55)
        return join(big, move(box(0.5, 0.5, 0.5), [(h(3) - 0.5) * 0.3, 0.75, (h(4) - 0.5) * 0.3]));
      return big;
    }
    case "octahedral":
      return bipyramid(4, 0.7, 0.7);
    case "dodecahedral":
      // A rhombic dodecahedron: the cube's corners and the six axis points.
      return scale(
        hull([
          [1, 1, 1],
          [1, 1, -1],
          [1, -1, 1],
          [1, -1, -1],
          [-1, 1, 1],
          [-1, 1, -1],
          [-1, -1, 1],
          [-1, -1, -1],
          [2, 0, 0],
          [-2, 0, 0],
          [0, 2, 0],
          [0, -2, 0],
          [0, 0, 2],
          [0, 0, -2],
        ]),
        [0.38, 0.38, 0.38],
      );
    case "tetrahedral": {
      // Standing on a face, a corner up, its corners cut a little: a pyramid of three sides.
      const corners: V3[] = [
        [0, 1, 0],
        [0.943, -1 / 3, 0],
        [-0.471, -1 / 3, 0.816],
        [-0.471, -1 / 3, -0.816],
      ];
      const pts: V3[] = [];
      for (const a of corners)
        for (const b of corners) if (a !== b) pts.push(add(a, scl(sub(b, a), 0.14)));
      return scale(rotate(hull(pts), 0.5 + h(1) * 0.6, 0, 0), [0.85, 0.85, 0.85]);
    }
    case "hexagonal": {
      // Quartz-like: a six-sided prism with its point, and two to four smaller ones splayed from its foot.
      const parts: Mesh[] = [capped(6, 0.3, 1.0, 0.42)];
      const n = 2 + Math.floor(h(5) * 3);
      for (let i = 0; i < n; i++) {
        const th = h(10 + i) * Math.PI * 2;
        const sat = rotate(rotate(capped(6, 0.14, 0.7, 0.26), 0, 0, -0.35), -th, 0, 0);
        parts.push(move(sat, [0.2 * Math.cos(th), -0.15, 0.2 * Math.sin(th)]));
      }
      return join(...parts);
    }
    case "rhombic": {
      // A cube sheared along its body diagonal: its edges lean as calcite's do.
      const o = -0.12,
        pts: V3[] = [];
      for (const sx of [-0.5, 0.5])
        for (const sy of [-0.5, 0.5])
          for (const sz of [-0.5, 0.5])
            pts.push([sx + o * (sy + sz), sy + o * (sx + sz), sz + o * (sx + sy)]);
      return hull(pts);
    }
    case "prismatic": {
      // A stout column of four or eight sides, ended in a point, leaning; one or two smaller ones
      // grown from its foot.
      const n = h(2) < 0.5 ? 4 : 8,
        tip = 0.12 + 0.16 * h(3),
        parts: Mesh[] = [rotate(capped(n, 0.27, 1.0, tip), 0.4, 0, 0.16)],
        m = 1 + Math.floor(h(5) * 2);
      for (let i = 0; i < m; i++) {
        const th = 2.2 + i * 1.9 + h(10 + i) * 0.8,
          side = rotate(rotate(capped(n, 0.15, 0.62, tip * 0.7), 0, 0, -0.45), -th, 0, 0);
        parts.push(move(side, [0.24 * Math.cos(th), -0.22, 0.24 * Math.sin(th)]));
      }
      return join(...parts);
    }
    case "bladed": {
      const n = h(4) < 0.5 ? 3 : 4,
        blades: Mesh[] = [];
      for (let i = 0; i < n; i++) {
        const a = (i - (n - 1) / 2) * 0.32 + (h(6 + i) - 0.5) * 0.1;
        blades.push(rotate(move(box(0.16, 1.0, 0.06), [0, 0.5, 0]), 0, 0, a));
      }
      return join(...blades);
    }
    case "acicular": {
      const n = 7 + Math.floor(h(7) * 6),
        needles: Mesh[] = [];
      for (let i = 0; i < n; i++) {
        const az = h(20 + i) * Math.PI * 2,
          tilt = 0.25 + h(40 + i) * 0.9;
        const needle = move(prism(4, 0.035, 0.9), [0, 0.45, 0]);
        needles.push(rotate(rotate(needle, 0, tilt, 0), az, 0, 0));
      }
      return join(...needles);
    }
    case "platy": {
      const n = 4 + Math.floor(h(8) * 3),
        plates: Mesh[] = [];
      for (let i = 0; i < n; i++)
        plates.push(
          move(prism(6, 0.5, 0.06), [
            (h(50 + i) - 0.5) * 0.08,
            (i - (n - 1) / 2) * 0.09,
            (h(60 + i) - 0.5) * 0.06,
          ]),
        );
      return join(...plates);
    }
    case "botryoidal": {
      // Grapes on a flat base: squashed spheres that stand up from it.
      const parts: Mesh[] = [move(prism(8, 0.55, 0.08), [0, -0.46, 0])],
        n = 5 + Math.floor(h(9) * 5);
      for (let i = 0; i < n; i++) {
        const r = 0.2 + 0.08 * h(70 + i),
          a = h(80 + i) * Math.PI * 2,
          d = 0.12 + 0.2 * h(90 + i);
        parts.push(
          move(scale(icosphere(0), [r, r * 0.8, r]), [
            d * Math.cos(a),
            -0.42 + r * 0.8,
            d * Math.sin(a),
          ]),
        );
      }
      return join(...parts);
    }
    case "dendritic": {
      // A branching tree of thin rods, each branch about 50 degrees from its parent, three levels.
      const parts: Mesh[] = [];
      const grow = (p: V3, th: number, depth: number, id: number): void => {
        const len = [0.6, 0.38, 0.22][depth]! * (0.85 + 0.3 * h(100 + id)),
          q: V3 = [p[0] + len * Math.sin(th), p[1] + len * Math.cos(th), 0];
        parts.push(beam(p, q, [0.07, 0.05, 0.035][depth]!));
        if (depth < 2) {
          grow(q, th - 0.87 + (h(200 + id) - 0.5) * 0.3, depth + 1, 2 * id + 3);
          grow(q, th + 0.87 + (h(300 + id) - 0.5) * 0.3, depth + 1, 2 * id + 4);
        }
      };
      grow([0, -0.5, 0], 0, 0, 1);
      return join(...parts);
    }
    case "nugget":
      return jitter(icosphere(1), key, 0.12 + rough * 0.4);
    case "earthy":
      return jitter(scale(icosphere(1), [0.5, 0.3, 0.5]), key, 0.15);
    case "fibrous": {
      const n = 9 + Math.floor(h(11) * 6),
        fibres: Mesh[] = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        fibres.push(
          move(prism(4, 0.035, 0.9 + 0.2 * h(120 + i)), [0.1 * Math.cos(a), 0, 0.1 * Math.sin(a)]),
        );
      }
      return join(...fibres);
    }
    case "granular": {
      const n = 8 + Math.floor(h(12) * 7),
        grains: Mesh[] = [];
      for (let i = 0; i < n; i++) {
        const s = 0.14 + 0.06 * h(130 + i);
        const g = rotate(
          box(s, s, s),
          h(140 + i) * Math.PI,
          h(150 + i) * Math.PI,
          h(160 + i) * Math.PI,
        );
        grains.push(
          move(g, [(h(170 + i) - 0.5) * 0.6, (h(180 + i) - 0.5) * 0.5, (h(190 + i) - 0.5) * 0.6]),
        );
      }
      return join(...grains);
    }
    case "massive":
    default: {
      // A keyed irregular lump: the hull of twelve points on a spiral, each at a keyed length.
      const pts: V3[] = [];
      for (let i = 0; i < 12; i++) {
        const y = 1 - (2 * (i + 0.5)) / 12,
          rr = Math.sqrt(1 - y * y),
          a = i * 2.399963 + h(200 + i) * 0.5,
          len = 0.5 * (1 + (h(300 + i) * 2 - 1) * rough * 2);
        pts.push([Math.cos(a) * rr * len, y * len, Math.sin(a) * rr * len]);
      }
      return hull(pts);
    }
  }
}

/** A metal's or a stone's bar: a trapezoid, its top narrower than its base, with a soft bevel. */
function ingotMesh(key: number): Mesh {
  const pts: V3[] = [];
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      pts.push(
        [0.5 * sx, -0.2, 0.3 * sz],
        [0.46 * sx, -0.25, 0.26 * sz],
        [0.38 * sx, 0.25, 0.22 * sz],
        [0.34 * sx, 0.3, 0.18 * sz],
      );
  const bar = hull(pts);
  // Keyed: one bar, or two stacked and crossed.
  if (hash(key, 11) < 0.5) return bar;
  return join(bar, move(rotate(bar, Math.PI / 2, 0, 0), [0, 0.5, 0]));
}

/** A heap on a small shallow dish: the dish a neutral clay grey, the heap jittered. */
function powderParts(color: Rgb, lustre: Lustre, key: number): SpecimenPart[] {
  const dish = lathe(
      [
        [0.5, -0.12],
        [0.56, -0.03],
        [0.5, 0.06],
      ],
      12,
    ),
    heap = jitter(
      lathe(
        [
          [0.36, 0],
          [0.2, 0.16],
          [0.07, 0.3],
          [0, 0.36],
        ],
        10,
      ),
      key,
      0.08,
    );
  return [part(dish, CLAY_GREY, "dull"), part(move(heap, [0, 0.06, 0]), color, lustre)];
}

/**
 * A round-bottomed flask, clear glass, its liquid in the bulb up to about 60%. Clear liquids pale;
 * a dark one (crude oil) as dark as its clarity says.
 */
function flaskParts(color: Rgb, lustre: Lustre, clarity = 0.7): SpecimenPart[] {
  const glass = lathe(
      [
        [0.1, -0.52],
        [0.3, -0.47],
        [0.42, -0.36],
        [0.44, -0.12],
        [0.36, 0.12],
        [0.2, 0.3],
        [0.13, 0.36],
        [0.12, 0.7],
        [0.14, 0.74],
      ],
      12,
    ),
    clear = isColourless(color),
    liquid = lathe(
      [
        [0.1, -0.5],
        [0.3, -0.45],
        [0.4, -0.33],
        [0.43, -0.12],
        [0.4, 0],
      ],
      12,
    );
  return [
    part(glass, GLASS, "vitreous", 0.85),
    part(liquid, clear ? WATER : color, lustre, clear ? 0.9 : Math.min(0.7, clarity)),
  ];
}

/** A sealed glass ampoule with a gas glowing inside it. Noble gases burn strong; a colourless one is faint. */
function ampouleParts(color: Rgb, strong: boolean): SpecimenPart[] {
  const glass = lathe(
      [
        [0.26, -0.3],
        [0.34, -0.2],
        [0.36, 0],
        [0.34, 0.2],
        [0.26, 0.32],
        [0.1, 0.42],
        [0.06, 0.48],
      ],
      12,
    ),
    glow = scale(icosphere(1), [0.26, 0.26, 0.26]),
    tint = isColourless(color) ? mix(color, [0.85, 0.92, 1], 0.7) : color;
  return [
    part(glass, GLASS, "vitreous", 0.85),
    part(glow, tint, "dull", 0, { glow: true, strong }),
  ];
}

/** Lines over a largest face: a few concentric outlines of it, the ripples of a conchoidal break. */
function ripplesOn(mesh: Mesh, color: Rgb): NonNullable<SpecimenPart["strokes"]> {
  let best = -1,
    area = 0;
  mesh.f.forEach((face, k) => {
    const a = Math.hypot(...newell(mesh, face));
    if (a > area) {
      area = a;
      best = k;
    }
  });
  if (best < 0) return [];
  const face = mesh.f[best]!,
    c = centroid(mesh, face),
    ink = dim(color, 0.45),
    out: { points: V3[]; color: Rgb; ripple: boolean }[] = [];
  for (let r = 0; r < 3; r++) {
    const s = 0.2 + 0.22 * r,
      pts: V3[] = [];
    face.forEach((vi, j) => {
      const a = mesh.v[vi]!,
        b = mesh.v[face[(j + 1) % face.length]!]!;
      for (let t = 0; t < 4; t++) {
        const q = add(a, scl(sub(b, a), t / 4));
        pts.push(add(c, scl(sub(q, c), s)));
      }
    });
    pts.push(pts[0]!);
    out.push({ points: pts, color: ink, ripple: true });
  }
  return out;
}

/** An irregular chunk: the hull of keyed points, its faces smooth breaks, ripples on its largest face. */
function conchoidalParts(color: Rgb, lustre: Lustre, clarity: number, key: number): SpecimenPart[] {
  const pts: V3[] = [];
  for (let i = 0; i < 14; i++)
    pts.push([
      (hash(key, 400 + i) - 0.5) * 1.0,
      (hash(key, 500 + i) - 0.5) * 0.8,
      (hash(key, 600 + i) - 0.5) * 0.9,
    ]);
  const chunk = hull(pts);
  const tint = chunk.f.map((_, i) => 0.85 + 0.27 * hash(key, 700 + i));
  return [part(chunk, color, lustre, clarity, { tint, strokes: ripplesOn(chunk, color) })];
}

/** A flint nodule split open: a chalky crust outside, and the glassy face where it broke. */
function noduleParts(p: Extract<Portrait, { kind: "matter" }>, key: number): SpecimenPart[] {
  const body = jitter(icosphere(1), key, 0.07);
  const d = norm([hash(key, 800) - 0.5, 0.6 + 0.4 * hash(key, 801), hash(key, 802) - 0.5]);
  const cut = 0.45;
  // The split: every corner above the cut plane is brought down onto it.
  const split: Mesh = {
    v: body.v.map((q) => {
      const dq = dot(q, d);
      return dq > cut ? add(q, scl(d, cut - dq)) : q;
    }),
    f: body.f,
  };
  const onCut = (face: readonly number[]) =>
    face.every((i) => Math.abs(dot(split.v[i]!, d) - cut) < 1e-9);
  const crust = pick(split, (face) => !onCut(face)),
    glass = pick(split, (face) => onCut(face));
  return [
    part(crust, mix(p.color, WHITE, 0.3), "dull", 0, { tint: crust.f.map(() => 1.08) }),
    part(glass, mix(p.color, WHITE, 0.15), "vitreous", 0.3),
  ];
}

/** A skein: about twelve thin strands laid in an arc from one foot. */
function fibreParts(color: Rgb, lustre: Lustre): SpecimenPart[] {
  const strands: Mesh[] = [];
  for (let i = 0; i < 12; i++)
    strands.push(rotate(move(prism(4, 0.02, 0.9), [0, 0.45, 0]), 0, 0, -0.55 + i * 0.1));
  return [part(join(...strands), color, lustre)];
}

/** A thin sheet bent over itself in a soft S: four pieces, each tipped the other way. */
function sheetParts(color: Rgb, lustre: Lustre): SpecimenPart[] {
  const pieces: Mesh[] = [];
  for (let k = 0; k < 4; k++)
    pieces.push(
      move(rotate(box(0.7, 0.04, 0.5), 0, k % 2 ? -0.3 : 0.3, 0), [
        0,
        -0.3 + k * 0.2,
        k * 0.06 - 0.09,
      ]),
    );
  return [part(join(...pieces), color, lustre)];
}

/** Matter by its habit (crystal, lump) or by its form; a matter with no habit grows as a lump. */
function matterParts(p: Extract<Portrait, { kind: "matter" }>): SpecimenPart[] {
  const key = p.key >>> 0;
  if (p.form === "crystal" || p.form === "lump") {
    const habit = p.habit ?? "massive";
    if (habit === "nodular") return noduleParts(p, key);
    if (habit === "conchoidal") return conchoidalParts(p.color, p.lustre, p.clarity, key);
    // Harder stuff breaks crisper: a low Mohs gives lumpier lumps.
    const rough = p.hardness === null ? 0.5 : 1 - Math.min(10, Math.max(0, p.hardness)) / 10;
    return [part(habitMesh(habit, key, rough), p.color, p.lustre, p.clarity)];
  }
  switch (p.form) {
    case "ingot":
      return [part(ingotMesh(key), p.color, p.lustre, p.clarity)];
    case "powder":
      return powderParts(p.color, p.lustre, key);
    case "liquid":
      return flaskParts(p.color, p.lustre, p.clarity);
    case "gas":
      return ampouleParts(p.color, false);
    case "glass":
      return conchoidalParts(p.color, "vitreous", Math.max(0.85, p.clarity), key);
    case "fibre":
      return fibreParts(p.color, p.lustre);
    case "sheet":
      return sheetParts(p.color, p.lustre);
    case "flesh":
      return [
        part(jitter(scale(icosphere(1), [0.5, 0.36, 0.42]), key, 0.04), p.color, "waxy", p.clarity),
      ];
  }
}

// ---- Elements (kind "element") ------------------------------------------------------------------

const LIGHT_METALS: ReadonlySet<string> = new Set(["Na", "K", "Mg", "Al", "Ca"]);

/** A light metal's lump: a cube with one corner cut away. */
function cutCube(): Mesh {
  const pts: V3[] = [];
  for (const sx of [-0.4, 0.4])
    for (const sy of [-0.4, 0.4])
      for (const sz of [-0.4, 0.4]) if (!(sx > 0 && sy > 0 && sz > 0)) pts.push([sx, sy, sz]);
  pts.push([0.4, 0.4, 0.15], [0.4, 0.15, 0.4], [0.15, 0.4, 0.4]);
  return hull(pts);
}

/** A small thing kept under liquid in a clear jar (a metal under amber oil, phosphorus under water). */
function keptJar(inside: readonly SpecimenPart[], liquid: Rgb, clarity: number): SpecimenPart[] {
  const jar = lathe(
      [
        [0.36, -0.5],
        [0.4, -0.3],
        [0.4, 0.1],
        [0.34, 0.3],
        [0.2, 0.36],
        [0.18, 0.42],
      ],
      12,
    ),
    oil = lathe(
      [
        [0.34, -0.45],
        [0.37, -0.3],
        [0.37, 0.05],
        [0.3, 0.22],
        [0.12, 0.27],
      ],
      12,
    ),
    thing = inside.map((q) => ({
      ...q,
      mesh: move(scale(q.mesh, [0.45, 0.45, 0.45]), [0, -0.12, 0]),
    }));
  return [part(jar, GLASS, "vitreous", 0.85), part(oil, liquid, "greasy", clarity), ...thing];
}

/** An element as it stands pure (Phase 54 M223): shaped by its sort and its state, coloured by its colour. */
function elementParts(p: Extract<Portrait, { kind: "element" }>): SpecimenPart[] {
  const key = p.key >>> 0,
    col = p.color;
  if (p.state === "gas") return ampouleParts(col, p.sort === "noble");
  if (p.state === "liquid") return flaskParts(col, p.sort === "metal" ? "metallic" : "vitreous");
  if (p.sort === "metal") {
    const lump = [part(LIGHT_METALS.has(p.symbol) ? cutCube() : ingotMesh(key), col, "metallic")];
    return p.kept ? keptJar(lump, OIL, 0.7) : lump;
  }
  if (p.sort === "metalloid") return [part(habitMesh("massive", key, 0.4), col, "submetallic")];
  if (p.sort === "nonmetal") {
    if (p.symbol === "S") {
      const crystals: Mesh[] = [];
      for (let i = 0; i < 4; i++)
        crystals.push(
          move(bipyramid(4, 0.2, 0.28), [
            (hash(key, 1 + i) - 0.5) * 0.4,
            (hash(key, 11 + i) - 0.5) * 0.3,
            (hash(key, 21 + i) - 0.5) * 0.4,
          ]),
        );
      return [part(join(...crystals), col, "resinous")];
    }
    if (p.symbol === "C") return [part(habitMesh("platy", key, 0.5), col, "submetallic")];
    if (p.symbol === "P") return keptJar([part(prism(6, 0.07, 0.6), col, "waxy")], WATER, 0.9);
    return [part(habitMesh("massive", key, 0.4), col, "resinous")];
  }
  return [part(habitMesh("massive", key, 0.2), col, "vitreous")];
}

// ---- Made things (kind "thing") -----------------------------------------------------------------

/** What a made thing is, as its builders need it. */
type ThingCtx = {
  readonly color: Rgb;
  readonly lustre: Lustre;
  /** The haft's, stock's or handle's wood, before it wears. */
  readonly wood: Rgb;
  /** A grey metal: taken for iron, which rusts rather than tarnishes. */
  readonly iron: boolean;
  readonly worn: number;
  readonly gloss: number;
  readonly quality: number;
  readonly made: MadeHow;
  readonly key: number;
};

const TARNISH: Rgb = [0.35, 0.4, 0.3];
const RUST: Rgb = [0.5, 0.25, 0.12];
const isMetal = (c: ThingCtx): boolean => c.lustre === "metallic" || c.lustre === "submetallic";

/** A part of the thing's own stuff (a blade, a head, a pot's body): tarnished or rusted where it is metal. */
function head(c: ThingCtx, mesh: Mesh, tint?: readonly number[]): SpecimenPart {
  let color = c.color;
  if (isMetal(c) && c.worn > 0) color = mix(color, c.iron ? RUST : TARNISH, c.worn * 0.4);
  return { mesh, color, lustre: c.lustre, clarity: 0, gloss: c.gloss, ...(tint ? { tint } : {}) };
}

/** A haft, a stock or a handle: wood, darker as it wears, dull and a little waxy. */
function haft(c: ThingCtx, mesh: Mesh, extra: Partial<SpecimenPart> = {}): SpecimenPart {
  return {
    mesh,
    color: dim(c.wood, 1 - 0.35 * c.worn),
    lustre: "waxy",
    clarity: 0,
    gloss: c.gloss,
    handle: true,
    ...extra,
  };
}

/**
 * A gun's stock, side on: a butt as deep as a shoulder needs, narrowing to the wrist the hand
 * grips, then the fore-end under the barrel.
 */
function stock(length: number, butt: number): Mesh {
  const y0 = -0.2 - length / 2,
    w = 0.05;
  return hull([
    [0.04, y0, -w],
    [0.04, y0, w],
    [0.04 - butt, y0 + 0.04, -w],
    [0.04 - butt, y0 + 0.04, w],
    [0.03, y0 + length * 0.42, -w],
    [0.03, y0 + length * 0.42, w],
    [-0.04, y0 + length * 0.42, -w],
    [-0.04, y0 + length * 0.42, w],
    [0.03, y0 + length, -w * 0.8],
    [0.03, y0 + length, w * 0.8],
    [-0.03, y0 + length, -w * 0.8],
    [-0.03, y0 + length, w * 0.8],
  ]);
}

/** A blade worn to nicks (1 to 3 corners along its edge) once it is well used. */
function edge(c: ThingCtx, mesh: Mesh): Mesh {
  return c.worn > 0.5 ? nick(mesh, c.key, 1 + Math.floor(hash(c.key, 950) * 3)) : mesh;
}

// Arms

function clubParts(c: ThingCtx): SpecimenPart[] {
  return [
    haft(
      c,
      lathe(
        [
          [0.035, -0.5],
          [0.04, -0.1],
          [0.07, 0.2],
          [0.09, 0.45],
          [0.07, 0.52],
        ],
        8,
      ),
    ),
    haft(c, move(jitter(scale(icosphere(0), [0.12, 0.12, 0.12]), c.key, 0.1), [0, 0.55, 0])),
  ];
}

/** Darts: three short shafts fanned, each with its point (of shell, of stone, of metal). */
function dartsParts(c: ThingCtx): SpecimenPart[] {
  const parts: SpecimenPart[] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i - 1) * 0.22,
      shaft = lathe(
        [
          [0.016, -0.55],
          [0.02, -0.53],
          [0.02, 0.4],
          [0.016, 0.42],
        ],
        6,
      );
    parts.push(
      haft(c, rotate(shaft, 0, 0, a)),
      head(c, rotate(move(scale(bipyramid(4, 0.06, 0.16), [1, 1, 0.45]), [0, 0.55, 0]), 0, 0, a)),
    );
  }
  return parts;
}

function spearParts(c: ThingCtx): SpecimenPart[] {
  return [
    haft(
      c,
      lathe(
        [
          [0.02, -0.9],
          [0.026, -0.88],
          [0.026, 0.7],
          [0.02, 0.72],
        ],
        6,
      ),
    ),
    head(c, move(scale(bipyramid(4, 0.1, 0.32), [1, 1, 0.45]), [0, 1, 0])),
    { ...haft(c, move(prism(6, 0.045, 0.1), [0, 0.68, 0])), color: LEATHER },
  ];
}

function swordParts(c: ThingCtx): SpecimenPart[] {
  const blade = edge(
    c,
    hull([
      [-0.04, 0, -0.008],
      [0.04, 0, -0.008],
      [-0.04, 0, 0.008],
      [0.04, 0, 0.008],
      [-0.04, 0.9, -0.008],
      [0.04, 0.9, -0.008],
      [-0.04, 0.9, 0.008],
      [0.04, 0.9, 0.008],
      [0, 1.2, -0.008],
      [0, 1.2, 0.008],
    ]),
  );
  return [
    head(c, blade),
    head(c, move(box(0.24, 0.045, 0.06), [0, -0.03, 0])),
    haft(c, move(prism(6, 0.025, 0.28), [0, -0.2, 0])),
    head(c, move(prism(6, 0.045, 0.07), [0, -0.37, 0])),
  ];
}

/** A stave along a curve from its foot to its nock, its string drawn as a line between the nocks. */
function staveParts(c: ThingCtx, bulge: number, recurve: number, segs: number): SpecimenPart[] {
  const pts: V3[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs,
      tip = Math.max(0, Math.abs(2 * t - 1) - 0.6) / 0.4;
    pts.push([bulge * Math.sin(Math.PI * t) - recurve * tip, -0.9 + 1.8 * t, 0]);
  }
  const limbs: Mesh[] = [];
  for (let i = 0; i < segs; i++) limbs.push(beam(pts[i]!, pts[i + 1]!, 0.07));
  const first = pts[0]!,
    last = pts[segs]!;
  return [
    haft(c, join(...limbs), { strokes: [{ points: [first, last], color: [0.12, 0.1, 0.08] }] }),
    haft(c, move(box(0.05, 0.05, 0.05), first)),
    haft(c, move(box(0.05, 0.05, 0.05), last)),
  ];
}

const hornBowParts = (c: ThingCtx): SpecimenPart[] => staveParts(c, 0.22, 0.14, 6);
const bowParts = (c: ThingCtx): SpecimenPart[] => staveParts(c, 0.2, 0, 5);

function musketParts(c: ThingCtx): SpecimenPart[] {
  return [
    haft(c, stock(0.85, 0.2)),
    head(c, move(prism(6, 0.03, 1.3), [0.07, 0.25, 0])),
    head(c, move(box(0.03, 0.2, 0.09), [0.06, -0.05, 0.06])),
    head(c, move(prism(4, 0.012, 0.9), [0.11, 0.1, 0])),
  ];
}

/** A rifle: the musket's shape, shorter and slimmer, with a bolt knob. */
function rifleParts(c: ThingCtx): SpecimenPart[] {
  return [
    haft(c, stock(0.7, 0.18)),
    head(c, move(prism(6, 0.025, 1.05), [0.07, 0.2, 0])),
    head(c, move(box(0.03, 0.18, 0.08), [0.06, -0.04, 0.05])),
    head(c, move(prism(6, 0.02, 0.05), [0.1, 0, 0.05])),
  ];
}

/** A repeater: the rifle, with a tube magazine under the barrel and a lever loop. */
function repeaterParts(c: ThingCtx): SpecimenPart[] {
  const lever = join(
    beam([0.1, -0.06, 0], [0.16, -0.06, 0], 0.02),
    beam([0.16, -0.06, 0], [0.16, -0.18, 0], 0.02),
    beam([0.16, -0.18, 0], [0.1, -0.18, 0], 0.02),
  );
  return [...rifleParts(c), head(c, move(prism(6, 0.016, 0.8), [0.04, 0.05, 0])), head(c, lever)];
}

function autoloaderParts(c: ThingCtx): SpecimenPart[] {
  return [
    haft(c, stock(0.85, 0.18)),
    head(c, move(prism(6, 0.03, 1.2), [0.07, 0.25, 0])),
    head(c, move(box(0.05, 0.22, 0.07), [0.03, -0.12, 0.05])),
  ];
}

/** An automatic: a short stock and a pistol grip, a barrel in a perforated shroud, a curved box magazine. */
function automaticParts(c: ThingCtx): SpecimenPart[] {
  const shroud = move(prism(6, 0.06, 0.6), [0.07, 0.25, 0]);
  return [
    haft(c, move(box(0.12, 0.42, 0.1), [0, -0.45, 0])),
    haft(c, move(rotate(box(0.08, 0.24, 0.09), 0, 0, -0.25), [0.03, -0.72, 0])),
    head(
      c,
      shroud,
      shroud.f.map((_, k) => (k % 2 ? 0.75 : 1.15)),
    ),
    head(c, move(prism(6, 0.025, 1.0), [0.07, 0.25, 0])),
    head(
      c,
      join(
        move(rotate(box(0.04, 0.2, 0.07), 0, 0, 0.25), [0, -0.1, 0.05]),
        move(rotate(box(0.04, 0.18, 0.07), 0, 0, 0.5), [-0.03, -0.2, 0.05]),
      ),
    ),
  ];
}

// Tools

/** An axe's wedge head across the top of its haft. */
function axeHead(c: ThingCtx): Mesh {
  return edge(
    c,
    hull([
      [-0.04, 0.5, -0.06],
      [-0.04, 0.5, 0.06],
      [-0.04, 0.66, -0.06],
      [-0.04, 0.66, 0.06],
      [0.16, 0.44, -0.015],
      [0.16, 0.44, 0.015],
      [0.1, 0.66, -0.03],
      [0.1, 0.66, 0.03],
      [0.04, 0.46, -0.05],
      [0.04, 0.46, 0.05],
    ]),
  );
}

const axeParts = (c: ThingCtx): SpecimenPart[] => [
  haft(c, prism(6, 0.042, 1.4)),
  head(c, axeHead(c)),
];

/** An adze: the axe's head turned a quarter about its haft. */
const adzeParts = (c: ThingCtx): SpecimenPart[] => [
  haft(c, prism(6, 0.042, 1.4)),
  head(c, rotate(axeHead(c), Math.PI / 2, 0, 0)),
];

const hoeParts = (c: ThingCtx): SpecimenPart[] => [
  haft(c, prism(6, 0.042, 1.5)),
  head(c, edge(c, move(box(0.32, 0.03, 0.2), [0.16, -0.72, 0]))),
];

/** A sickle: a crescent of eight segments along an arc, its short handle at one end. */
function sickleParts(c: ThingCtx): SpecimenPart[] {
  const cx = -0.25,
    R = 0.42,
    pts: V3[] = [];
  for (let i = 0; i <= 8; i++) {
    const a = -0.6 + (1.5 * i) / 8;
    pts.push([cx + R * Math.cos(a), R * Math.sin(a), 0]);
  }
  const segs: Mesh[] = [];
  for (let i = 0; i < 8; i++) segs.push(beam(pts[i]!, pts[i + 1]!, 0.06));
  const foot = pts[0]!;
  return [
    head(c, edge(c, join(...segs))),
    haft(c, move(prism(6, 0.03, 0.4), [foot[0], foot[1] - 0.2, 0])),
  ];
}

const spearheadParts = (c: ThingCtx): SpecimenPart[] => [
  head(c, move(scale(bipyramid(4, 0.12, 0.4), [1, 1, 0.4]), [0, 0.4, 0])),
  head(c, move(prism(6, 0.04, 0.2), [0, -0.1, 0])),
];

/** A plough share: a flat triangle with its one edge turned up. */
const shareParts = (c: ThingCtx): SpecimenPart[] => [
  head(c, edge(c, prism(3, 0.32, 0.04))),
  head(c, beam([0.32, 0, 0], [0.4, 0.28, 0], 0.035)),
];

/** Shears: two blades pivoting, joined by a bow spring. */
const shearsParts = (c: ThingCtx): SpecimenPart[] => [
  head(c, edge(c, beam([0, 0, 0.02], [0.12, 0.9, 0.06], 0.05))),
  head(c, edge(c, beam([0, 0, -0.02], [-0.12, 0.9, -0.06], 0.05))),
  head(
    c,
    join(beam([0, 0, 0.02], [0.14, -0.2, 0], 0.035), beam([0, 0, -0.02], [0.14, -0.2, 0], 0.035)),
  ),
];

const hammerParts = (c: ThingCtx): SpecimenPart[] => [
  haft(c, prism(6, 0.042, 0.9)),
  head(c, move(box(0.22, 0.14, 0.14), [0, 0.4, 0])),
];

/** A chisel: a square bar with its end bevelled to an edge. */
const chiselParts = (c: ThingCtx): SpecimenPart[] => [
  head(c, prism(4, 0.04, 0.9)),
  head(
    c,
    hull([
      [-0.04, 0.45, -0.04],
      [0.04, 0.45, -0.04],
      [-0.04, 0.45, 0.04],
      [0.04, 0.45, 0.04],
      [0.04, 0.6, -0.03],
      [0.04, 0.6, 0.03],
      [-0.04, 0.6, -0.02],
      [-0.04, 0.6, 0.02],
    ]),
  ),
];

const knifeParts = (c: ThingCtx): SpecimenPart[] => [
  head(
    c,
    edge(
      c,
      hull([
        [-0.035, 0, -0.008],
        [0.035, 0, -0.008],
        [-0.035, 0, 0.008],
        [0.035, 0, 0.008],
        [-0.035, 0.5, -0.008],
        [0.035, 0.5, -0.008],
        [-0.035, 0.5, 0.008],
        [0.035, 0.5, 0.008],
        [0, 0.72, -0.008],
        [0, 0.72, 0.008],
      ]),
    ),
  ),
  haft(c, move(prism(6, 0.03, 0.35), [0, -0.2, 0])),
];

// Pots

/** A pot's rim band, darker than its body. */
const rimOf = (c: ThingCtx, rim: Mesh): SpecimenPart => ({
  ...head(c, rim),
  color: dim(c.color, 0.7),
});

function storageParts(c: ThingCtx): SpecimenPart[] {
  return [
    head(
      c,
      lathe(
        [
          [0.2, -0.45],
          [0.28, -0.3],
          [0.34, -0.05],
          [0.33, 0.15],
          [0.26, 0.3],
          [0.14, 0.42],
          [0.12, 0.5],
        ],
        10,
      ),
    ),
    rimOf(
      c,
      lathe(
        [
          [0.12, 0.44],
          [0.14, 0.48],
          [0.12, 0.52],
        ],
        10,
      ),
    ),
  ];
}

/** A squat round cooking pot, sometimes sooted: its lower half darker. */
function cookingParts(c: ThingCtx): SpecimenPart[] {
  const body = lathe(
    [
      [0.25, -0.3],
      [0.34, -0.2],
      [0.36, 0],
      [0.33, 0.12],
      [0.3, 0.18],
    ],
    10,
  );
  const sooted = hash(c.key, 980) < 0.5;
  return [
    head(
      c,
      body,
      sooted ? body.f.map((face) => (centroid(body, face)[1] < 0 ? 0.45 : 1)) : undefined,
    ),
    rimOf(
      c,
      lathe(
        [
          [0.3, 0.14],
          [0.33, 0.2],
          [0.3, 0.22],
        ],
        10,
      ),
    ),
  ];
}

/** A jug: a body, a neck, and a handle, a torus quarter of rods. */
function jugParts(c: ThingCtx): SpecimenPart[] {
  const body = lathe(
    [
      [0.2, -0.3],
      [0.32, -0.15],
      [0.3, 0.1],
      [0.16, 0.25],
      [0.12, 0.32],
    ],
    10,
  );
  const arc: V3[] = [
    [0.12, 0.28, 0],
    [0.3, 0.3, 0],
    [0.4, 0.1, 0],
    [0.36, -0.08, 0],
    [0.26, -0.14, 0],
  ];
  const handle = join(...arc.slice(0, -1).map((p, i) => beam(p, arc[i + 1]!, 0.05)));
  return [head(c, body), { ...head(c, handle), color: dim(c.color, 0.85) }];
}

/** A wide shallow bowl, its rim a darker band. */
function bowlParts(c: ThingCtx): SpecimenPart[] {
  return [
    head(
      c,
      lathe(
        [
          [0.18, -0.08],
          [0.3, -0.12],
          [0.42, -0.06],
          [0.46, 0.02],
          [0.4, 0.1],
          [0.2, 0.12],
        ],
        12,
      ),
    ),
    rimOf(
      c,
      lathe(
        [
          [0.38, 0.06],
          [0.44, 0.1],
          [0.38, 0.12],
        ],
        12,
      ),
    ),
  ];
}

// Cloth

/** A flat T-shaped garment: sleeves across, a body in three folds tinted alternately. */
function garmentParts(c: ThingCtx): SpecimenPart[] {
  const fold = (y: number, h: number, k: number): SpecimenPart => ({
    ...head(c, move(box(0.42, h, 0.05), [0, y, 0])),
    color: dim(c.color, k % 2 ? 0.86 : 1),
  });
  return [
    head(c, move(box(0.7, 0.16, 0.05), [0, 0.42, 0])),
    fold(0.16, 0.26, 0),
    fold(-0.1, 0.26, 1),
    fold(-0.36, 0.2, 2),
  ];
}

/** A rolled bolt of cloth, its loose end hanging as a bent sheet. */
function clothBoltParts(c: ThingCtx): SpecimenPart[] {
  const roll = lathe(
    [
      [0.2, -0.3],
      [0.24, -0.28],
      [0.24, 0.28],
      [0.2, 0.3],
    ],
    12,
  );
  const loose = join(
    move(rotate(box(0.22, 0.03, 0.4), 0, 0, 0.15), [0.24, -0.42, 0]),
    move(rotate(box(0.2, 0.03, 0.4), 0, 0, -0.1), [0.42, -0.6, 0]),
  );
  return [head(c, roll), { ...head(c, loose), color: dim(c.color, 0.9) }];
}

// Machine parts

const shaftParts = (c: ThingCtx): SpecimenPart[] => [
  head(
    c,
    lathe(
      [
        [0.05, -0.6],
        [0.055, -0.59],
        [0.055, 0.59],
        [0.05, 0.6],
      ],
      10,
    ),
  ),
  head(c, move(prism(8, 0.1, 0.12), [0, 0.2, 0])),
];

/** A piston: a short cylinder with its ring grooves as bands, and a rod. */
function pistonParts(c: ThingCtx): SpecimenPart[] {
  const cyl = lathe(
    [-0.2, -0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3].map((y): [number, number] => [
      0.14,
      y,
    ]),
    12,
  );
  return [
    head(c, cyl, bandsTint(cyl, 0.1, 0.65, 0.5)),
    head(c, move(prism(6, 0.03, 0.8), [0, 0.7, 0])),
  ];
}

/** A bolt: a hex head on a threaded shank, the threads as bands. */
function boltParts(c: ThingCtx): SpecimenPart[] {
  const shank = lathe(
    [-0.4, -0.34, -0.28, -0.22, -0.16, -0.1, -0.04, 0.02, 0.08, 0.14, 0.2].map(
      (y): [number, number] => [0.05, y],
    ),
    8,
  );
  return [
    head(c, move(prism(6, 0.14, 0.14), [0, 0.4, 0])),
    head(c, shank, bandsTint(shank, 0.12, 0.7, 0.5)),
  ];
}

/** A gear: a toothed disc, its teeth as radii alternating, and a hub. */
function gearParts(c: ThingCtx): SpecimenPart[] {
  const radii = Array.from({ length: 16 }, (_, k) => (k % 2 ? 0.62 : 0.8));
  return [head(c, ringPrism(radii, 0.14)), head(c, prism(6, 0.14, 0.2))];
}

/** A wheel: a rim of rods, spokes to the hub. */
function wheelParts(c: ThingCtx): SpecimenPart[] {
  const R = 0.8,
    rim: V3[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    rim.push([R * Math.cos(a), R * Math.sin(a), 0]);
  }
  const rods = rim.map((p, i) => beam(p, rim[(i + 1) % 12]!, 0.06));
  const spokes: Mesh[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    spokes.push(beam([0, 0, 0], [R * Math.cos(a), R * Math.sin(a), 0], 0.035));
  }
  return [head(c, join(...rods)), head(c, join(...spokes)), head(c, prism(8, 0.12, 0.15))];
}

/** A casting, a block or a frame: a ribbed box. */
function castingParts(c: ThingCtx): SpecimenPart[] {
  const ribs = join(
    move(box(0.84, 0.05, 0.54), [0, 0.27, 0]),
    move(box(0.84, 0.05, 0.54), [0, -0.27, 0]),
    move(box(0.05, 0.52, 0.54), [0.3, 0, 0]),
    move(box(0.05, 0.52, 0.54), [-0.3, 0, 0]),
  );
  return [head(c, box(0.8, 0.5, 0.5)), head(c, ribs)];
}

// What a made thing is, when its form names no shape: its shape by how it was made.

const MADE_SHAPE: Record<MadeHow, (c: ThingCtx) => SpecimenPart[]> = {
  knapped: (c) => [head(c, scale(bipyramid(3, 0.42, 0.34), [1, 1, 0.3]))],
  forged: (c) => [head(c, prism(4, 0.06, 0.8)), head(c, move(pyramid(4, 0.06, 0.2), [0, 0.4, 0]))],
  cast: (c) => [head(c, box(0.5, 0.4, 0.4))],
  thrown: bowlParts,
  woven: clothBoltParts,
  sewn: garmentParts,
  machined: boltParts,
  carved: (c) => [haft(c, prism(6, 0.05, 1.0))],
  grown: (c) => [head(c, jitter(scale(icosphere(1), [0.5, 0.4, 0.5]), c.key, 0.15))],
};

type ThingBuilder = (c: ThingCtx) => SpecimenPart[];

/** Each form's words and its shape, in the order the shapes are matched (arms, tools, pots, cloth, machine parts). */
const THINGS: readonly (readonly [readonly string[], ThingBuilder])[] = [
  [["club"], clubParts],
  [["spear"], spearParts],
  [["darts", "dart"], dartsParts],
  [["sword"], swordParts],
  [["horn-bow"], hornBowParts],
  [["bow"], bowParts],
  [["musket"], musketParts],
  [["rifle"], rifleParts],
  [["repeater"], repeaterParts],
  [["autoloader"], autoloaderParts],
  [["automatic"], automaticParts],
  [["axe"], axeParts],
  [["adze"], adzeParts],
  [["hoe"], hoeParts],
  [["sickle"], sickleParts],
  [["spearhead", "spear point"], spearheadParts],
  [["plough share", "share"], shareParts],
  [["shears"], shearsParts],
  [["hammer"], hammerParts],
  [["chisel"], chiselParts],
  [["knife"], knifeParts],
  [["storage jar"], storageParts],
  [["cooking pot"], cookingParts],
  [["jug"], jugParts],
  [["bowl"], bowlParts],
  [["pot", "jar", "vessel"], storageParts],
  [["tunic", "shirt", "coat", "cloak", "dress", "gown", "garment"], garmentParts],
  [["cloth", "bolt", "length"], clothBoltParts],
  [["shaft", "axle"], shaftParts],
  [["piston"], pistonParts],
  [["bolt"], boltParts],
  [["gear", "cog"], gearParts],
  [["wheel"], wheelParts],
  [["casting", "block", "frame"], castingParts],
];

/** A form's whole name, when the table names it outright (a later row wins a shared name: the machine's bolt). */
const NAMED = new Map<string, ThingBuilder>();
for (const [words, build] of THINGS) for (const w of words) NAMED.set(w, build);

/** The shape a form names: its whole name first, else the first row whose word it holds whole. */
function shapeOf(form: string): ThingBuilder | null {
  const named = NAMED.get(form);
  if (named) return named;
  for (const [words, build] of THINGS)
    for (const w of words) if (new RegExp(`\\b${w}\\b`).test(form)) return build;
  return null;
}

/** How it was made shows in its surface: a knapped stone's facets, a forged bar's irregular faces, a thrown pot's wobble. */
function treat(c: ThingCtx, parts: SpecimenPart[]): SpecimenPart[] {
  const q = c.quality;
  return parts.map((p, i): SpecimenPart => {
    switch (c.made) {
      case "knapped":
        return {
          ...p,
          tint: p.tint ?? p.mesh.f.map((_, k) => 0.8 + 0.35 * hash(c.key, 970 + 97 * i + k)),
        };
      case "forged":
        return {
          ...p,
          lustre: "metallic",
          color: dim(p.color, 0.92),
          mesh: jitter(p.mesh, c.key + 17 * i, 0.05 - (0.03 * q) / 100),
        };
      case "cast":
        return { ...p, lustre: "metallic" };
      case "machined":
        return { ...p, lustre: "metallic", color: mix(p.color, WHITE, 0.1) };
      case "thrown":
        return {
          ...p,
          mesh: wobble(p.mesh, ((100 - q) / 100) * 0.06, hash(c.key, 960 + i) * Math.PI * 2),
        };
      default:
        return p;
    }
  });
}

/** A made thing (Phase 54 M223): its shape by its form, drawn as it was made of its stuff, worn as it is. */
function thingParts(p: Extract<Portrait, { kind: "thing" }>): SpecimenPart[] {
  const worn = Math.min(1, Math.max(0, p.worn)),
    grey =
      (p.lustre === "metallic" || p.lustre === "submetallic") &&
      Math.max(p.color[0], p.color[1], p.color[2]) - Math.min(p.color[0], p.color[1], p.color[2]) <
        0.12;
  const c: ThingCtx = {
    color: p.color,
    lustre: p.lustre,
    wood: p.haft ?? WOOD,
    iron: grey,
    worn,
    gloss: 1 - 0.6 * worn,
    quality: p.quality,
    made: p.made,
    key: p.key >>> 0,
  };
  const build = shapeOf(p.form) ?? MADE_SHAPE[p.made];
  return treat(c, build(c));
}

/**
 * The parts of a specimen, as they stand in their own frames (a matter, an element or a made thing);
 * [] for any other kind of portrait. The same portrait always gives the same parts.
 */
export function specimenParts(p: Portrait): SpecimenPart[] {
  let parts: SpecimenPart[];
  switch (p.kind) {
    case "matter":
      parts = matterParts(p);
      break;
    case "element":
      parts = elementParts(p);
      break;
    case "thing":
      parts = thingParts(p);
      break;
    default:
      return [];
  }
  return parts.filter((q) => q.mesh.f.length > 0);
}

// ---- Drawing ------------------------------------------------------------------------------------

/** The light the faces take, the same as portrait.ts lights its solids. */
const LIGHT = norm([-0.45, 0.75, 0.5]);
/** The half-way direction between the light and the eye, for the highlight. */
const HALF = norm(add(LIGHT, [0, 0, 1]));

/** Each lustre's highlight: its exponent e and its strength k (silky and dull have none). */
const SHINE: Readonly<Record<Lustre, { readonly e: number; readonly k: number }>> = {
  metallic: { e: 18, k: 0.95 },
  submetallic: { e: 14, k: 0.6 },
  adamantine: { e: 40, k: 1.1 },
  vitreous: { e: 30, k: 0.65 },
  resinous: { e: 10, k: 0.4 },
  waxy: { e: 8, k: 0.3 },
  greasy: { e: 8, k: 0.35 },
  pearly: { e: 12, k: 0.4 },
  silky: { e: 0, k: 0 },
  dull: { e: 0, k: 0 },
};

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const css = (c: Rgb, k = 1, a = 1): string =>
  `rgba(${Math.round(clamp01(c[0] * k) * 255)},${Math.round(clamp01(c[1] * k) * 255)},${Math.round(clamp01(c[2] * k) * 255)},${a})`;

/** The normal of a polygon of points (Newell's method), unnormalised. */
function normalOf(vs: readonly V3[]): V3 {
  let n: V3 = [0, 0, 0];
  for (let i = 0; i < vs.length; i++) {
    const a = vs[i]!,
      b = vs[(i + 1) % vs.length]!;
    n = [
      n[0] + (a[1] - b[1]) * (a[2] + b[2]),
      n[1] + (a[2] - b[2]) * (a[0] + b[0]),
      n[2] + (a[0] - b[0]) * (a[1] + b[1]),
    ];
  }
  return n;
}

/** How a specimen is looked at: turned about the up axis, tipped to look down, rolled in the picture. */
type Pose = { readonly turn: number; readonly tilt: number; readonly roll: number };

/** A matter and an element turn slowly; a made thing lies at an angle and turns more gently. */
function poseOf(p: Portrait, t: number): Pose {
  return p.kind === "thing"
    ? { turn: 0.3 + Math.sin(t * 0.5) * 0.5, tilt: 0.35, roll: -0.6109 }
    : { turn: 0.6 + t * 0.35, tilt: 0.35, roll: 0 };
}

/** A face as it is drawn: its screen corners, its depth, its fill and edge, and what it lights. */
type Drawn = {
  readonly pts: readonly (readonly [number, number])[];
  readonly depth: number;
  readonly fill: string;
  readonly edge: string | null;
  readonly glow: boolean;
  readonly spec: number;
  readonly cx: number;
  readonly cy: number;
  readonly sparkle: boolean;
};

/**
 * Paint parts looked at so, fitted into the box with 8% padding, back to front. Clear parts show
 * their back faces first, darker; a glow is drawn additive. A thumbnail drops the shadow, the
 * ripples and the back faces of anything not clear.
 */
function paint(
  ctx: CanvasRenderingContext2D,
  parts: readonly SpecimenPart[],
  pose: Pose,
  box: Box,
  t: number,
  thumb: boolean,
): void {
  const cy = Math.cos(pose.turn),
    sy = Math.sin(pose.turn),
    ct = Math.cos(pose.tilt),
    st = Math.sin(pose.tilt),
    cr = Math.cos(pose.roll),
    sr = Math.sin(pose.roll);
  const view = (p: V3): V3 => {
    const x = p[0] * cy + p[2] * sy,
      z = -p[0] * sy + p[2] * cy,
      y = p[1] * ct - z * st,
      zz = p[1] * st + z * ct;
    return [x * cr - y * sr, x * sr + y * cr, zz];
  };
  const views = parts.map((q) => ({ q, pts: q.mesh.v.map(view) }));
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const { pts } of views)
    for (const p of pts) {
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    }
  if (!(minX <= maxX)) return;
  // A tool's head small against its haft (an axe, a hoe, a hammer): drawn close on its head, as an
  // item's icon is, its haft running out of the frame.
  const close = closeOn(views, minX, maxX, minY, maxY);
  if (close) ({ minX, maxX, minY, maxY } = close);
  const bx = box.x + box.w * 0.08,
    by = box.y + box.h * 0.08,
    bw = box.w * 0.84,
    bh = box.h * 0.84,
    W = Math.max(1e-6, maxX - minX),
    H = Math.max(1e-6, maxY - minY),
    k = Math.min(bw / W, bh / H),
    ox = bx + (bw - W * k) / 2 - minX * k,
    oy = by + (bh + H * k) / 2 + minY * k;
  const at = (p: V3): [number, number] => [ox + p[0] * k, oy - p[1] * k];
  if (close) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
  }
  // A soft shadow under it, 70% of the box's width (not under a close picture).
  if (!thumb && !close) {
    ctx.beginPath();
    ctx.ellipse(
      box.x + box.w / 2,
      by + (bh + H * k) / 2,
      box.w * 0.35,
      box.h * 0.035,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fill();
  }
  const drawn: Drawn[] = [];
  for (const { q, pts } of views) {
    const shine = SHINE[q.lustre],
      gloss = q.gloss ?? 1,
      alpha = 1 - 0.65 * q.clarity,
      backOK = q.clarity > (thumb ? 0.5 : 0.2);
    q.mesh.f.forEach((face, fi) => {
      if (face.length < 3) return;
      const vs = face.map((i) => pts[i]!),
        n = normalOf(vs),
        len = Math.hypot(n[0], n[1], n[2]);
      if (len < 1e-12) return;
      const nn = scl(n, 1 / len),
        front = nn[2] > 0.001,
        back = nn[2] < -0.001 && backOK;
      if (!front && !back) return;
      const depth = vs.reduce((a, p) => a + p[2], 0) / vs.length,
        screen = vs.map(at) as [number, number][],
        cx = screen.reduce((a, p) => a + p[0], 0) / screen.length,
        cyS = screen.reduce((a, p) => a + p[1], 0) / screen.length;
      if (q.glow) {
        // A gas's glow pulses: a noble gas burns strong, the others faintly.
        if (!front) return;
        const a = q.strong ? 0.45 + 0.15 * Math.sin(t * 2) : 0.25 + 0.1 * Math.sin(t * 1.5);
        drawn.push({
          pts: screen,
          depth,
          fill: css(q.color, 1, a),
          edge: null,
          glow: true,
          spec: 0,
          cx,
          cy: cyS,
          sparkle: false,
        });
        return;
      }
      const lam = Math.max(0, nn[0] * LIGHT[0] + nn[1] * LIGHT[1] + nn[2] * LIGHT[2]);
      let shade = q.lustre === "dull" ? 0.6 + 0.4 * lam : 0.52 + 0.48 * lam;
      if (q.lustre === "silky") {
        const mid = vs.reduce((a, p) => a + p[1], 0) / vs.length;
        shade *= Math.floor(mid * 6) % 2 === 0 ? 1.08 : 0.92;
      }
      shade *= q.tint?.[fi] ?? 1;
      let base: Rgb = q.color;
      // Pearly: a faint hue turned by the face's way.
      if (q.lustre === "pearly")
        base = mix(base, [base[1], base[2], base[0]], 0.12 * Math.abs(nn[0]));
      if (!front) {
        // A clear part's back faces, seen through the front: darker.
        drawn.push({
          pts: screen,
          depth,
          fill: css(base, 0.6 * shade, alpha),
          edge: null,
          glow: false,
          spec: 0,
          cx,
          cy: cyS,
          sparkle: false,
        });
        return;
      }
      // Metal: its diffuse dimmed, its highlight tinted toward its own colour.
      const diffuse = q.lustre === "metallic" ? dim(base, 0.55 * shade) : dim(base, shade);
      const spec =
        shine.k > 0 ? Math.pow(Math.max(0, dot(nn, HALF)), shine.e) * shine.k * gloss : 0;
      const hi: Rgb = q.lustre === "metallic" ? mix(WHITE, q.color, 0.35) : WHITE,
        col: Rgb = [
          diffuse[0] + hi[0] * spec,
          diffuse[1] + hi[1] * spec,
          diffuse[2] + hi[2] * spec,
        ];
      const edge =
        q.clarity > 0.2 ? "rgba(255,255,255,0.35)" : css(q.color, shade * 0.55, 0.9 * alpha);
      drawn.push({
        pts: screen,
        depth,
        fill: css(col, 1, alpha),
        edge,
        glow: false,
        spec,
        cx,
        cy: cyS,
        sparkle: q.lustre === "adamantine",
      });
    });
  }
  // Back to front: the faces furthest from the eye first.
  drawn.sort((a, b) => a.depth - b.depth);
  ctx.lineJoin = "round";
  for (const f of drawn) {
    ctx.beginPath();
    f.pts.forEach(([x, y], i) => {
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.closePath();
    if (f.glow) ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = f.fill;
    ctx.fill();
    if (f.glow) ctx.globalCompositeOperation = "source-over";
    else if (f.edge) {
      ctx.strokeStyle = f.edge;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  // An adamantine's sparkle: a small white four-point star on its brightest face.
  if (!thumb) {
    let best: Drawn | null = null;
    for (const f of drawn) if (f.sparkle && (!best || f.spec > best.spec)) best = f;
    if (best && best.spec > 0) {
      const r = 0.09 * Math.min(box.w, box.h);
      ctx.beginPath();
      ctx.moveTo(best.cx - r, best.cy);
      ctx.lineTo(best.cx + r, best.cy);
      ctx.moveTo(best.cx, best.cy - r);
      ctx.lineTo(best.cx, best.cy + r);
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  // Lines over the faces: a bow's string, a break's ripples (not in a thumbnail).
  for (const { q } of views)
    for (const s of q.strokes ?? []) {
      if (thumb && s.ripple) continue;
      ctx.beginPath();
      s.points.forEach((p, i) => {
        const [x, y] = at(view(p));
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.strokeStyle = css(s.color, 1, 1);
      ctx.lineWidth = s.ripple ? 0.8 : 1.6;
      ctx.stroke();
    }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  if (close) ctx.restore();
}

/** How much more of the picture than its head a close picture shows about the head. */
const CLOSE_AROUND = 1.8;
/** A head this small against the whole (its longest side to the whole's) is drawn close. */
const CLOSE_BELOW = 0.45;

/**
 * The window a close picture of a made thing shows (its head, and some of its haft about it), or
 * null where it is drawn whole: no haft, or a head big against the whole.
 */
function closeOn(
  views: readonly { readonly q: SpecimenPart; readonly pts: readonly V3[] }[],
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): { minX: number; maxX: number; minY: number; maxY: number } | null {
  if (!views.some((v) => v.q.handle) || views.every((v) => v.q.handle)) return null;
  let hx0 = Infinity,
    hx1 = -Infinity,
    hy0 = Infinity,
    hy1 = -Infinity;
  for (const { q, pts } of views)
    if (!q.handle)
      for (const p of pts) {
        hx0 = Math.min(hx0, p[0]);
        hx1 = Math.max(hx1, p[0]);
        hy0 = Math.min(hy0, p[1]);
        hy1 = Math.max(hy1, p[1]);
      }
  const side = Math.max(hx1 - hx0, hy1 - hy0),
    whole = Math.max(maxX - minX, maxY - minY);
  if (side >= CLOSE_BELOW * whole) return null;
  const half = (side * CLOSE_AROUND) / 2,
    cx = (hx0 + hx1) / 2,
    cy = (hy0 + hy1) / 2;
  return {
    minX: Math.max(minX, cx - half),
    maxX: Math.min(maxX, cx + half),
    minY: Math.max(minY, cy - half),
    maxY: Math.min(maxY, cy + half),
  };
}

/** A specimen drawn into the box of a context (CSS pixels) as it stands at `t` seconds. */
export function drawSpecimen(
  ctx: CanvasRenderingContext2D,
  p: Portrait,
  box: { x: number; y: number; w: number; h: number },
  t: number,
): void {
  const parts = specimenParts(p);
  if (parts.length) paint(ctx, parts, poseOf(p, t), box, t, false);
}

/** Thumbnails made so far, by portrait, size and pixel ratio: the oldest dropped past 400. */
const THUMBS = new Map<string, HTMLCanvasElement>();
const THUMB_MAX = 400;

/**
 * A small picture of a specimen (28 CSS pixels, say) in a canvas: drawn once at a fixed three-quarter
 * view, then copied from a cache.
 */
export function drawThumb(canvas: HTMLCanvasElement, p: Portrait, size: number): void {
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1),
    key = `${JSON.stringify(p)}|${size}|${dpr}`;
  let pic = THUMBS.get(key);
  if (!pic) {
    pic = document.createElement("canvas");
    pic.width = Math.round(size * dpr);
    pic.height = Math.round(size * dpr);
    const g = pic.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const parts = specimenParts(p);
    if (parts.length)
      paint(
        g,
        parts,
        { ...poseOf(p, 0), turn: 0.6, tilt: 0.35 },
        { x: 0, y: 0, w: size, h: size },
        0,
        true,
      );
    if (THUMBS.size >= THUMB_MAX) THUMBS.delete(THUMBS.keys().next().value!);
    THUMBS.set(key, pic);
  }
  canvas.width = pic.width;
  canvas.height = pic.height;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(pic, 0, 0);
}
