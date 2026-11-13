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
  /** What its surface shows of how it was made, at the fine level (absent: by its making; a haft's is wood). */
  readonly surface?: Surface;
  /** Lines and dots over its faces, drawn only at the fine level (ui/specimen.ts finish). */
  readonly marks?: readonly Mark[];
  /** Lines drawn over it, in their own colour: a bow's string, a break's ripples. */
  readonly strokes?: readonly {
    readonly points: readonly V3[];
    readonly color: Rgb;
    /** A ripple of a conchoidal break (dropped in a thumbnail); absent for a string. */
    readonly ripple?: boolean;
  }[];
};

/** What a surface shows of how it was made, at the fine level. */
export type Surface =
  "wood" | "weave" | "leather" | "forged" | "cast" | "machined" | "knapped" | "thrown" | "none";

/**
 * Lines (or dots) over a specimen at the fine level, in one colour: on a face of their part (drawn just after it, where it faces the
 * eye), or free with a normal (drawn where it faces the eye, just before what is nearer).
 */
export type Mark = {
  readonly face?: number;
  readonly normal?: V3;
  readonly lines: readonly (readonly V3[])[];
  readonly color: Rgb;
  readonly alpha: number;
  /** Its width in a picture 300 px across (a dot's radius). */
  readonly width: number;
  readonly dash?: boolean;
  readonly dots?: boolean;
  readonly closed?: boolean;
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

/**
 * A flat outline (a, b) given thickness: its two faces whole (not cut in triangles as a hull's are, so a seam or a bevel drawn on one
 * follows its outline) and its sides. `place` puts a point of the outline at a height across it; `up` is the way the first face looks.
 */
function extrude(
  outline: readonly (readonly [number, number])[],
  lo: number,
  hi: number,
  place: (a: number, b: number, h: number) => V3,
  up: V3,
): Mesh {
  const n = outline.length,
    v: V3[] = [],
    f: number[][] = [],
    hints: V3[] = [];
  for (const [a, b] of outline) v.push(place(a, b, lo), place(a, b, hi));
  // (Which way round the outline runs, so each side's hint points out of it.)
  let area = 0;
  for (let i = 0; i < n; i++) {
    const p = outline[i]!,
      q = outline[(i + 1) % n]!;
    area += p[0] * q[1] - q[0] * p[1];
  }
  const turn = area >= 0 ? 1 : -1;
  f.push(Array.from({ length: n }, (_, i) => 2 * i + 1));
  hints.push(up);
  f.push(Array.from({ length: n }, (_, i) => 2 * i));
  hints.push(scl(up, -1));
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      p = outline[i]!,
      q = outline[j]!,
      mid = place((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (lo + hi) / 2),
      out = place(
        (p[0] + q[0]) / 2 + turn * (q[1] - p[1]),
        (p[1] + q[1]) / 2 - turn * (q[0] - p[0]),
        (lo + hi) / 2,
      );
    f.push([2 * i, 2 * j, 2 * j + 1, 2 * i + 1]);
    hints.push(sub(out, mid));
  }
  return outward({ v, f }, hints);
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
  /** Drawn large and looked at: its finer parts (a saw's every tooth, a knife's rivets) and its surface's marks. */
  readonly fine: boolean;
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
function fannedDartsParts(c: ThingCtx): SpecimenPart[] {
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

/** A gas dart: a long thin shaft, pointed at its head, with four fins of its stuff at its tail. */
function dartsParts(c: ThingCtx): SpecimenPart[] {
  const fin = box(0.16, 0.2, 0.012);
  return [
    head(
      c,
      lathe(
        [
          [0.02, -0.6],
          [0.022, -0.58],
          [0.022, 0.5],
          [0, 0.66],
        ],
        6,
      ),
    ),
    head(c, join(move(fin, [0, -0.5, 0]), move(rotate(fin, Math.PI / 2, 0, 0), [0, -0.5, 0]))),
  ];
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

/**
 * A set blade (F1): a spine of wood, with eight small flakes set along each edge in the stuff's
 * colour. The flakes stand where a sword's edges are, so the blade tapers to its point as one does.
 */
function setBladeParts(c: ThingCtx): SpecimenPart[] {
  const flakes: Mesh[] = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      const y = 0.08 + 0.13 * i,
        half = y <= 0.9 ? 0.04 : (0.04 * (1.2 - y)) / 0.3;
      flakes.push(
        move(rotate(box(0.04, 0.075, 0.016), 0, 0, side * 0.25), [side * (half - 0.004), y, 0]),
      );
    }
  }
  return [haft(c, move(box(0.028, 1, 0.024), [0, 0.56, 0])), head(c, edge(c, join(...flakes)))];
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

/** A beam rifle: a dark body with no wood in it, a cell under it, and at its end the crystal it fires through. */
function beamRifleParts(c: ThingCtx): SpecimenPart[] {
  return [
    haft(c, move(box(0.13, 0.86, 0.11), [0, -0.1, 0])),
    haft(c, move(rotate(box(0.08, 0.26, 0.09), 0, 0, -0.25), [0.04, -0.62, 0])),
    head(c, move(box(0.09, 0.26, 0.14), [-0.07, -0.18, 0])),
    head(c, move(prism(6, 0.05, 0.3), [0, 0.46, 0])),
  ];
}

/** A beam lance: a long rod of crystal in its housing, carried two-handed, its cell behind. */
function beamLanceParts(c: ThingCtx): SpecimenPart[] {
  return [
    haft(c, move(box(0.11, 0.62, 0.11), [0, -0.46, 0])),
    head(c, move(box(0.13, 0.24, 0.15), [0, -0.66, 0])),
    head(c, move(prism(6, 0.035, 1.1), [0, 0.3, 0])),
    haft(c, move(prism(8, 0.07, 0.1), [0, 0.1, 0])),
  ];
}

// Tools

/**
 * An axe's head across the top of its haft: a thick poll wrapped about the haft (its eye, the haft's end standing through it), the cheeks
 * thinning to a bit that flares above and below the eye, as a felling axe's does.
 */
function axeHead(c: ThingCtx): Mesh {
  return edge(
    c,
    hull([
      [-0.1, 0.5, -0.056],
      [-0.1, 0.5, 0.056],
      [-0.1, 0.66, -0.056],
      [-0.1, 0.66, 0.056],
      [0.06, 0.485, -0.05],
      [0.06, 0.485, 0.05],
      [0.06, 0.675, -0.05],
      [0.06, 0.675, 0.05],
      [0.33, 0.37, -0.006],
      [0.33, 0.37, 0.006],
      [0.35, 0.79, -0.006],
      [0.35, 0.79, 0.006],
      [0.4, 0.58, -0.004],
      [0.4, 0.58, 0.004],
    ]),
  );
}

/**
 * A blade's honed edge at the fine level: a bright line just in from the cutting edge, on both its broad faces (z one way and the
 * other), the edge's own points given from heel to point.
 */
function honed(c: ThingCtx, edgeLine: readonly (readonly [number, number])[], z: number): Mark[] {
  if (!c.fine) return [];
  const line = (s: number): V3[] => edgeLine.map(([x, y]): V3 => [x, y, s * z]);
  return [1, -1].map((s): Mark => ({
    normal: [0, 0, s],
    lines: [line(s)],
    color: mix(c.color, WHITE, 0.62),
    alpha: 0.75,
    width: 0.9,
  }));
}

/** The haft's end through the eye, and at the fine level the wedge driven into it. */
function axeParts(c: ThingCtx): SpecimenPart[] {
  const parts = [
    haft(c, move(prism(6, 0.042, 1.46), [0, 0.03, 0])),
    {
      ...head(c, axeHead(c)),
      marks: honed(
        c,
        [
          [0.305, 0.4],
          [0.37, 0.58],
          [0.32, 0.76],
        ],
        0.012,
      ),
    },
  ];
  if (c.fine)
    parts.push({
      ...plain(move(box(0.07, 0.012, 0.012), [-0.005, 0.762, 0]), dim(c.wood, 0.45)),
      surface: "none",
    });
  return parts;
}

/** An adze: the axe's head turned a quarter about its haft. */
const adzeParts = (c: ThingCtx): SpecimenPart[] => [
  haft(c, move(prism(6, 0.042, 1.46), [0, 0.03, 0])),
  head(c, rotate(axeHead(c), Math.PI / 2, 0, 0)),
];

const hoeParts = (c: ThingCtx): SpecimenPart[] => [
  haft(c, prism(6, 0.042, 1.5)),
  head(c, edge(c, move(box(0.32, 0.03, 0.2), [0.16, -0.72, 0]))),
];

/**
 * A sickle: a crescent blade from its tang round more than half a circle, broad at the heel and thinning to its point, its edge on the
 * inside of the curve; a short round handle with a collar where the tang goes in.
 */
function sickleParts(c: ThingCtx): SpecimenPart[] {
  const R = 0.36,
    C: V3 = [0.03, 0.36, 0],
    n = 14,
    from = -1.75,
    to = 2.75,
    at = (a: number, r: number, z: number): V3 => [
      C[0] + r * Math.cos(a),
      C[1] + r * Math.sin(a),
      z,
    ],
    segs: Mesh[] = [],
    edgeLine: V3[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = from + ((to - from) * i) / n,
      a1 = from + ((to - from) * (i + 1)) / n,
      // (Broader in a small picture, or its curve is a hair.)
      w0 = (c.fine ? 0.1 : 0.15) - (0.088 * i) / n,
      w1 = (c.fine ? 0.1 : 0.15) - (0.088 * (i + 1)) / n,
      t0 = 0.016 - (0.008 * i) / n,
      t1 = 0.016 - (0.008 * (i + 1)) / n;
    segs.push(
      hull([
        at(a0, R + w0 / 2, -t0),
        at(a0, R + w0 / 2, t0),
        at(a0, R - w0 / 2, -0.003),
        at(a0, R - w0 / 2, 0.003),
        at(a1, R + w1 / 2, -t1),
        at(a1, R + w1 / 2, t1),
        at(a1, R - w1 / 2, -0.003),
        at(a1, R - w1 / 2, 0.003),
      ]),
    );
    edgeLine.push(at(a0, R - w0 / 2 + 0.018, t0 * 0.6));
  }
  const root = at(from, R, 0),
    blade = head(c, edge(c, join(...segs)));
  return [
    c.fine
      ? {
          ...blade,
          marks: [
            {
              normal: [0, 0, 1],
              lines: [edgeLine],
              color: mix(c.color, WHITE, 0.6),
              alpha: 0.75,
              width: 0.9,
            },
          ],
        }
      : blade,
    head(c, move(prism(8, 0.045, 0.05), [root[0], root[1] - 0.03, 0])),
    haft(
      c,
      move(
        lathe(
          [
            [0.035, -0.3],
            [0.045, -0.28],
            [0.048, -0.05],
            [0.04, 0],
          ],
          8,
        ),
        [root[0], root[1] - 0.05, 0],
      ),
    ),
  ];
}

const spearheadParts = (c: ThingCtx): SpecimenPart[] => [
  head(c, move(scale(bipyramid(4, 0.12, 0.4), [1, 1, 0.4]), [0, 0.4, 0])),
  head(c, move(prism(6, 0.04, 0.2), [0, -0.1, 0])),
];

/**
 * A plough's share and mouldboard, standing as it runs: the share a pointed blade that cuts the sod flat, the mouldboard a curved plate
 * rising from the share's back and twisting out to turn the sod over, and the shank that bolts them to the plough's beam.
 */
function shareParts(c: ThingCtx): SpecimenPart[] {
  const tip: V3 = [0.55, 0, -0.04],
    heel: V3 = [-0.12, 0, -0.1],
    wing: V3 = [-0.02, 0, 0.3],
    share = hull([
      tip,
      heel,
      wing,
      add(tip, [0, 0.03, 0]),
      add(heel, [0, 0.03, 0]),
      add(wing, [0, 0.03, 0]),
    ]),
    // (The board: rows of points across it, from the share's back edge up; each row further back and further out, as the sod turns.)
    row = (h: number): V3[] =>
      [0, 0.25, 0.5, 0.75, 1].map((t): V3 => {
        const a = add(heel, [-0.3 * h, 0.03 + 0.5 * h, -0.02 * h]),
          b = add(wing, [-0.55 * h, 0.03 + 0.42 * h, 0.42 * h]);
        // (Bowed: its middle stands proud of a straight line, the more toward its top.)
        return add(add(scl(a, 1 - t), scl(b, t)), [0, 0, 0.05 * Math.sin(Math.PI * t) * (0.4 + h)]);
      }),
    rows = [0, 0.25, 0.5, 0.75, 1].map(row),
    tiles: Mesh[] = [];
  for (let i = 0; i < rows.length - 1; i++)
    for (let j = 0; j < 4; j++) {
      const q = [rows[i]![j]!, rows[i]![j + 1]!, rows[i + 1]![j]!, rows[i + 1]![j + 1]!];
      tiles.push(hull([...q, ...q.map((p) => add(p, [0.02, 0, -0.02]))]));
    }
  const board = join(...tiles),
    tint = board.f.map((face) => 0.9 + 0.3 * Math.min(1, centroid(board, face)[1] / 0.5));
  return [
    {
      ...head(c, edge(c, share)),
      marks: c.fine
        ? [
            {
              normal: [0, 1, 0],
              lines: [[add(tip, [-0.04, 0.032, 0.03]), add(wing, [0.03, 0.032, -0.02])]],
              color: mix(c.color, WHITE, 0.65),
              alpha: 0.8,
              width: 1,
            },
          ]
        : [],
    },
    head(c, board, tint),
    head(c, beam([0.12, 0.03, -0.06], [-0.08, 0.64, -0.06], 0.06)),
    haft(c, move(box(0.5, 0.08, 0.08), [-0.12, 0.66, -0.06])),
  ];
}

/** Shears: two blades pivoting, joined by a bow spring. */
const shearsParts = (c: ThingCtx): SpecimenPart[] => [
  head(c, edge(c, beam([0, 0, 0.02], [0.12, 0.9, 0.06], 0.05))),
  head(c, edge(c, beam([0, 0, -0.02], [-0.12, 0.9, -0.06], 0.05))),
  head(
    c,
    join(beam([0, 0, 0.02], [0.14, -0.2, 0], 0.035), beam([0, 0, -0.02], [0.14, -0.2, 0], 0.035)),
  ),
];

/** A hammer: its head square at the face and drawn to a peen behind, on its haft through the eye. */
const hammerParts = (c: ThingCtx): SpecimenPart[] => [
  haft(c, move(prism(6, 0.042, 0.96), [0, 0.03, 0])),
  head(
    c,
    hull([
      [0.14, 0.33, -0.065],
      [0.14, 0.33, 0.065],
      [0.14, 0.47, -0.065],
      [0.14, 0.47, 0.065],
      [-0.04, 0.33, -0.06],
      [-0.04, 0.33, 0.06],
      [-0.04, 0.47, -0.06],
      [-0.04, 0.47, 0.06],
      [-0.2, 0.38, -0.05],
      [-0.2, 0.38, 0.05],
      [-0.2, 0.42, -0.05],
      [-0.2, 0.42, 0.05],
    ]),
  ),
];

/** A chisel: a square bar bevelled to an edge, its tang in a short wooden handle. */
const chiselParts = (c: ThingCtx): SpecimenPart[] => [
  head(c, move(prism(4, 0.035, 0.6), [0, 0.15, 0])),
  {
    ...head(
      c,
      hull([
        [-0.035, 0.45, -0.035],
        [0.035, 0.45, -0.035],
        [-0.035, 0.45, 0.035],
        [0.035, 0.45, 0.035],
        [0.04, 0.62, -0.006],
        [0.04, 0.62, 0.006],
        [-0.04, 0.62, -0.006],
        [-0.04, 0.62, 0.006],
      ]),
    ),
    marks: honed(
      c,
      [
        [-0.036, 0.6],
        [0.036, 0.6],
      ],
      0.012,
    ),
  },
  haft(
    c,
    move(
      lathe(
        [
          [0.04, -0.62],
          [0.055, -0.58],
          [0.05, -0.2],
          [0.04, -0.15],
        ],
        8,
      ),
      [0, 0, 0],
    ),
  ),
];

/** A knife: a blade with a straight back and its edge swept up to the point, a bolster, and a handle riveted through. */
function knifeParts(c: ThingCtx): SpecimenPart[] {
  const outline: [number, number][] = [
      [-0.036, 0],
      [0.046, 0],
      [0.052, 0.3],
      [0.042, 0.5],
      [0.014, 0.64],
      [-0.03, 0.73],
      [-0.036, 0.6],
    ],
    blade = hull(
      outline.flatMap(([x, y]): V3[] => [
        [x, y, -0.008],
        [x, y, 0.008],
      ]),
    ),
    grip = move(scale(prism(6, 0.05, 0.38), [0.9, 1, 0.55]), [0, -0.23, 0]),
    parts: SpecimenPart[] = [
      {
        ...head(c, edge(c, blade)),
        marks: honed(
          c,
          [
            [0.03, 0.03],
            [0.036, 0.3],
            [0.026, 0.49],
            [0.004, 0.62],
            [-0.028, 0.7],
          ],
          0.009,
        ),
      },
      head(c, move(box(0.11, 0.035, 0.05), [0.005, -0.02, 0])),
      haft(c, grip),
    ];
  if (c.fine)
    parts.push({
      ...plain(
        join(disc(6, 0.013, 0.06, [0, -0.13, 0]), disc(6, 0.013, 0.06, [0, -0.32, 0])),
        mix(c.color, WHITE, 0.3),
        "metallic",
      ),
      surface: "none",
    });
  return parts;
}

/**
 * A saw: a tapering blade, its teeth along the edge (eight for the eye in a small picture, two dozen when it is looked at), its back
 * straight, and an open grip of wood about the hand, screwed to the blade.
 */
function sawParts(c: ThingCtx): SpecimenPart[] {
  const teeth = c.fine ? 26 : 9,
    y0 = -0.24,
    y1 = 0.95,
    spine = -0.12,
    wide = (y: number) => 0.26 - (0.13 * (y - y0)) / (y1 - y0),
    blade = hull([
      [spine, y0, -0.007],
      [spine, y0, 0.007],
      [spine, y1, -0.007],
      [spine, y1, 0.007],
      [spine + wide(y0), y0, -0.007],
      [spine + wide(y0), y0, 0.007],
      [spine + wide(y1), y1, -0.007],
      [spine + wide(y1), y1, 0.007],
    ]),
    tooth: Mesh[] = [],
    step = (y1 - 0.02 - y0) / teeth,
    deep = c.fine ? 0.026 : 0.045;
  for (let k = 0; k < teeth; k++) {
    const a = y0 + 0.01 + k * step,
      b = a + step,
      xa = spine + wide(a),
      xb = spine + wide(b);
    tooth.push(
      hull([
        [xa - 0.004, a, -0.006],
        [xa - 0.004, a, 0.006],
        [xb - 0.004, b, -0.006],
        [xb - 0.004, b, 0.006],
        [xb + deep, b - step * 0.15, 0],
      ]),
    );
  }
  const grip = join(
    beam([-0.15, -0.2, 0], [0.16, -0.2, 0], 0.075),
    beam([0.16, -0.2, 0], [0.09, -0.62, 0], 0.075),
    beam([0.09, -0.62, 0], [-0.17, -0.6, 0], 0.075),
    beam([-0.17, -0.6, 0], [-0.15, -0.2, 0], 0.075),
    beam([-0.15, -0.2, 0], [-0.22, -0.14, 0], 0.06),
  );
  const parts: SpecimenPart[] = [
    {
      ...head(c, edge(c, blade)),
      marks: honed(
        c,
        [
          [spine + wide(y0) - 0.03, y0 + 0.02],
          [spine + wide(y1) - 0.03, y1 - 0.02],
        ],
        0.008,
      ),
    },
    head(c, join(...tooth)),
    haft(c, grip),
  ];
  if (c.fine)
    parts.push({
      ...plain(
        join(disc(6, 0.018, 0.09, [-0.06, -0.17, 0]), disc(6, 0.018, 0.09, [0.06, -0.17, 0])),
        [0.78, 0.62, 0.3],
        "metallic",
      ),
      surface: "none",
    });
  return parts;
}

/**
 * An awl: a wooden handle swelling to the palm, and from it a long spike drawn to a point; knapped of stone, a borer, a flake struck to a
 * long narrow point.
 */
function awlParts(c: ThingCtx): SpecimenPart[] {
  if (c.made === "knapped")
    return [
      head(
        c,
        hull([
          [-0.16, -0.4, 0],
          [0.15, -0.42, 0],
          [0.02, -0.3, 0.07],
          [0.12, -0.18, 0],
          [-0.12, -0.16, 0],
          [0.035, 0.1, 0.02],
          [-0.03, 0.12, 0.01],
          [0.0, 0.5, 0],
          [0.0, -0.3, -0.03],
        ]),
      ),
    ];
  return [
    haft(
      c,
      lathe(
        [
          [0.04, -0.62],
          [0.07, -0.56],
          [0.085, -0.38],
          [0.06, -0.18],
          [0.03, -0.12],
        ],
        8,
      ),
    ),
    head(
      c,
      lathe(
        [
          [0.022, -0.13],
          [0.02, 0.35],
          [0, 0.66],
        ],
        6,
      ),
    ),
  ];
}

/** A scraper: a thick flake, flat beneath and ridged above, its rounded end steeply struck to a scraping edge. */
function scraperParts(c: ThingCtx): SpecimenPart[] {
  const rim: V3[] = [],
    top: V3[] = [];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI;
    rim.push([0.26 * Math.cos(a), 0.12 + 0.24 * Math.sin(a), 0]);
    top.push([0.17 * Math.cos(a), 0.12 + 0.16 * Math.sin(a), 0.11]);
  }
  const flake = hull([
    ...rim,
    ...top,
    [-0.2, -0.32, 0],
    [0.2, -0.32, 0],
    [-0.12, -0.28, 0.06],
    [0.12, -0.28, 0.06],
  ]);
  return [
    {
      ...head(c, flake),
      ...(c.fine
        ? {
            marks: [
              {
                normal: [0, 0.4, 1] as V3,
                lines: rim
                  .slice(1, -1)
                  .map((p, i): V3[] => [
                    add(p, [0, 0, 0.015]),
                    add(scl(add(p, top[i + 1]!), 0.5), [0, 0, 0.01]),
                  ]),
                color: dim(c.color, 0.6),
                alpha: 0.6,
                width: 0.8,
              },
            ],
          }
        : {}),
    },
  ];
}

/** A blade struck from a core: long, thin, two ridges along its back where the blades before it came off. */
function stoneBladeParts(c: ThingCtx): SpecimenPart[] {
  const at: [number, number, number][] = [
      [-0.58, 0.03, 0.012],
      [-0.4, 0.075, 0.03],
      [0.25, 0.08, 0.035],
      [0.5, 0.045, 0.022],
      [0.64, 0.01, 0.006],
    ],
    pts: V3[] = [];
  for (const [y, w, h] of at)
    pts.push([-w, y, 0], [w, y, 0], [-w * 0.35, y, h], [w * 0.35, y, h], [0, y, -h * 0.25]);
  return [head(c, edge(c, hull(pts)))];
}

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

// Cloth: each garment laid out facing the eye, its shape what says what it is at a glance (its sleeves, its neck, its length, its legs),
// its seams, stitching and weave drawn only when it is looked at.

/** A fitting of the garment's second stuff (a belt, a clasp, buttons, laces): its land's wood or leather, dull. */
function fitting(c: ThingCtx, mesh: Mesh, k = 1): SpecimenPart {
  return {
    mesh,
    color: dim(c.wood, k),
    lustre: "waxy",
    clarity: 0,
    gloss: c.gloss,
    surface: "none",
  };
}
/** A part of the garment in its own stuff, a shade darker or lighter (a fold, a hem, a lapel). */
const shade = (c: ThingCtx, mesh: Mesh, k: number, extra: Partial<SpecimenPart> = {}) => ({
  ...head(c, mesh),
  color: dim(c.color, k),
  ...extra,
});
/** A flat panel of cloth through the given outline (x, y), its front a little proud of its back. */
function panel(outline: readonly (readonly [number, number])[], t = 0.05, at = 0): Mesh {
  return extrude(outline, at - t, at + t, (x, y, z) => [x, y, z], [0, 0, 1]);
}
/** The neck's opening, dark, at the top of the front. */
const neckHole = (c: ThingCtx, r: number, y: number, z: number): SpecimenPart =>
  shade(
    c,
    move(rotate(scale(prism(10, r, 0.01), [1, 1, 0.55]), 0, Math.PI / 2, 0), [0, y, z]),
    0.32,
    {
      surface: "none",
    },
  );
/** A sleeve from the shoulder out and down: its top and bottom lines, as wide as `w`. */
function sleeve(from: V3, to: V3, w: number, t = 0.045): Mesh {
  const d = sub(to, from),
    l = Math.hypot(d[0], d[1]) || 1,
    nx = (-d[1] / l) * (w / 2),
    ny = (d[0] / l) * (w / 2);
  return hull(
    [
      [from[0] + nx, from[1] + ny],
      [from[0] - nx, from[1] - ny],
      [to[0] + nx * 0.85, to[1] + ny * 0.85],
      [to[0] - nx * 0.85, to[1] - ny * 0.85],
    ].flatMap(([x, y]): V3[] => [
      [x!, y!, -t],
      [x!, y!, t],
    ]),
  );
}
/** Two sleeves, mirrored. */
const sleeves = (from: V3, to: V3, w: number): Mesh =>
  join(sleeve(from, to, w), sleeve([-from[0], from[1], from[2]], [-to[0], to[1], to[2]], w));

/** A tunic: a body widening to its hem, short sleeves, a round neck, a hem band, a cord at the waist. */
function tunicParts(c: ThingCtx): SpecimenPart[] {
  return [
    head(
      c,
      panel([
        [-0.28, 0.44],
        [0.28, 0.44],
        [0.34, -0.55],
        [-0.34, -0.55],
      ]),
    ),
    shade(c, sleeves([0.26, 0.34, 0], [0.54, 0.12, 0], 0.22), 0.9),
    shade(
      c,
      panel(
        [
          [-0.345, -0.47],
          [0.345, -0.47],
          [0.35, -0.56],
          [-0.35, -0.56],
        ],
        0.056,
      ),
      0.78,
    ),
    neckHole(c, 0.1, 0.42, 0.04),
    fitting(
      c,
      panel(
        [
          [-0.315, -0.02],
          [0.315, -0.02],
          [0.315, -0.06],
          [-0.315, -0.06],
        ],
        0.06,
      ),
    ),
  ];
}

/** A shirt: a straight body, long sleeves with cuffs, a turned collar, and its buttons down the front. */
function shirtParts(c: ThingCtx): SpecimenPart[] {
  const parts: SpecimenPart[] = [
    head(
      c,
      panel([
        [-0.26, 0.44],
        [0.26, 0.44],
        [0.27, -0.5],
        [-0.27, -0.5],
      ]),
    ),
    shade(c, sleeves([0.24, 0.36, 0], [0.5, -0.26, 0], 0.17), 0.9),
    shade(
      c,
      join(
        sleeve([0.47, -0.2, 0], [0.505, -0.3, 0], 0.17, 0.05),
        sleeve([-0.47, -0.2, 0], [-0.505, -0.3, 0], 0.17, 0.05),
      ),
      0.75,
    ),
    shade(
      c,
      join(
        panel(
          [
            [-0.12, 0.46],
            [0, 0.38],
            [-0.07, 0.3],
          ],
          0.012,
          0.06,
        ),
        panel(
          [
            [0.12, 0.46],
            [0, 0.38],
            [0.07, 0.3],
          ],
          0.012,
          0.06,
        ),
      ),
      1.12,
    ),
    shade(
      c,
      panel(
        [
          [-0.018, 0.38],
          [0.018, 0.38],
          [0.018, -0.5],
          [-0.018, -0.5],
        ],
        0.008,
        0.052,
      ),
      0.8,
    ),
  ];
  if (c.fine)
    parts.push(
      fitting(
        c,
        join(...[0.28, 0.12, -0.04, -0.2, -0.36].map((y) => disc(6, 0.014, 0.01, [0, y, 0.062]))),
        1.3,
      ),
    );
  return parts;
}

/** A gown or a dress: a fitted bodice, a sash at the waist, and a skirt flaring to the hem (a gown's to the floor, with long sleeves). */
function gownParts(c: ThingCtx, long: boolean): SpecimenPart[] {
  const hem = long ? -0.95 : -0.62,
    skirt = scale(
      lathe(
        [
          [0.16, 0.1],
          [long ? 0.48 : 0.4, hem],
        ],
        12,
      ),
      [1, 1, 0.42],
    );
  return [
    head(
      c,
      panel([
        [-0.2, 0.5],
        [0.2, 0.5],
        [0.16, 0.08],
        [-0.16, 0.08],
      ]),
    ),
    shade(c, skirt, 1, { tint: skirt.f.map((_, k) => (k % 2 ? 0.84 : 1.04)) }),
    long
      ? shade(c, sleeves([0.19, 0.44, 0], [0.4, -0.12, 0], 0.11), 0.92)
      : shade(c, sleeves([0.19, 0.44, 0], [0.32, 0.3, 0], 0.13), 0.92),
    fitting(c, move(scale(prism(12, 0.175, 0.07), [1, 1, 0.45]), [0, 0.09, 0])),
    neckHole(c, 0.09, 0.48, 0.04),
  ];
}

/** Trousers: a waistband and the seat, and two legs a little apart down to their hems. */
function trousersParts(c: ThingCtx): SpecimenPart[] {
  const leg = (s: 1 | -1) =>
    panel([
      [s * 0.02, 0.18],
      [s * 0.27, 0.18],
      [s * 0.28, -0.88],
      [s * 0.08, -0.88],
    ]);
  return [
    head(
      c,
      panel([
        [-0.27, 0.42],
        [0.27, 0.42],
        [0.28, 0.12],
        [0, 0.02],
        [-0.28, 0.12],
      ]),
    ),
    shade(c, join(leg(1), leg(-1)), 0.92),
    fitting(
      c,
      panel(
        [
          [-0.275, 0.5],
          [0.275, 0.5],
          [0.275, 0.42],
          [-0.275, 0.42],
        ],
        0.055,
      ),
    ),
    shade(
      c,
      panel(
        [
          [-0.014, 0.42],
          [0.014, 0.42],
          [0.014, 0.12],
          [-0.014, 0.12],
        ],
        0.008,
        0.052,
      ),
      0.75,
    ),
  ];
}

/** A cloak: a bell of cloth from the shoulders to the shins, its hood fallen behind, open down the front, a clasp at the throat. */
function cloakParts(c: ThingCtx): SpecimenPart[] {
  const bell = scale(
    lathe(
      [
        [0.13, 0.5],
        [0.3, 0.32],
        [0.42, -0.2],
        [0.52, -0.88],
      ],
      12,
    ),
    [1, 1, 0.62],
  );
  return [
    head(
      c,
      bell,
      bell.f.map((_, k) => (k % 2 ? 0.86 : 1.05)),
    ),
    shade(c, move(scale(icosphere(0), [0.2, 0.17, 0.16]), [0, 0.52, -0.1]), 0.82),
    shade(c, beam([0, 0.42, 0.105], [0, -0.86, 0.33], 0.02), 0.42, { surface: "none" }),
    {
      mesh: disc(8, 0.05, 0.03, [0, 0.43, 0.1]),
      color: [0.78, 0.64, 0.32],
      lustre: "metallic",
      clarity: 0,
      surface: "none",
    },
  ];
}

/** A coat: long, with sleeves, a collar standing behind the neck, lapels turned back, and buttons down its front. */
function coatParts(c: ThingCtx): SpecimenPart[] {
  return [
    head(
      c,
      panel([
        [-0.3, 0.44],
        [0.3, 0.44],
        [0.36, -0.82],
        [-0.36, -0.82],
      ]),
    ),
    shade(c, sleeves([0.28, 0.36, 0], [0.55, -0.32, 0], 0.18), 0.88),
    shade(
      c,
      panel(
        [
          [-0.2, 0.56],
          [0.2, 0.56],
          [0.24, 0.42],
          [-0.24, 0.42],
        ],
        0.04,
        -0.03,
      ),
      0.8,
    ),
    shade(
      c,
      join(
        panel(
          [
            [-0.17, 0.44],
            [-0.02, 0.1],
            [-0.07, 0.44],
          ],
          0.012,
          0.058,
        ),
        panel(
          [
            [0.17, 0.44],
            [0.02, 0.1],
            [0.07, 0.44],
          ],
          0.012,
          0.058,
        ),
      ),
      1.18,
    ),
    shade(
      c,
      panel(
        [
          [-0.012, 0.1],
          [0.012, 0.1],
          [0.012, -0.82],
          [-0.012, -0.82],
        ],
        0.008,
        0.052,
      ),
      0.55,
    ),
    fitting(
      c,
      join(...[0.02, -0.18, -0.38].map((y) => disc(6, 0.024, 0.02, [0.06, y, 0.062]))),
      0.8,
    ),
  ];
}

/** Armour of plate: a breastplate's shell, a ridge down its middle, its neck turned out. */
function cuirassParts(c: ThingCtx): SpecimenPart[] {
  // (A chest's shape: broad at the shoulders, drawn in at the waist, flaring a little at its skirt.)
  const shell = scale(
    lathe(
      [
        [0.3, -0.5],
        [0.27, -0.3],
        [0.33, 0.0],
        [0.38, 0.26],
        [0.3, 0.42],
        [0.16, 0.48],
      ],
      12,
    ),
    [1, 1, 0.45],
  );
  return [
    head(c, shell),
    head(c, beam([0, -0.46, 0.125], [0, 0.36, 0.155], 0.025)),
    shade(
      c,
      move(rotate(scale(prism(10, 0.13, 0.01), [1, 1, 0.5]), 0, Math.PI / 2, 0), [0, 0.47, 0.06]),
      0.3,
      {
        surface: "none",
      },
    ),
  ];
}

/** A brimmed hat: its crown, a band about it, its brim. */
function hatParts(c: ThingCtx): SpecimenPart[] {
  return [
    head(c, prism(16, 0.5, 0.03)),
    head(
      c,
      lathe(
        [
          [0.26, 0.01],
          [0.25, 0.22],
          [0.2, 0.32],
          [0, 0.33],
        ],
        12,
      ),
    ),
    fitting(
      c,
      lathe(
        [
          [0.265, 0.02],
          [0.262, 0.08],
        ],
        12,
      ),
    ),
  ];
}

/** A cap: a low round crown snug on the head, a band about it, a button on top, and a short peak at its front. */
function capParts(c: ThingCtx): SpecimenPart[] {
  const peak: [number, number][] = [];
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI * (0.15 + (0.7 * i) / 6);
    peak.push([0.32 * Math.cos(a), 0.15 + 0.3 * Math.sin(a)]);
  }
  return [
    head(
      c,
      lathe(
        [
          [0.3, 0],
          [0.3, 0.1],
          [0.24, 0.22],
          [0.12, 0.28],
          [0, 0.29],
        ],
        12,
      ),
    ),
    shade(
      c,
      lathe(
        [
          [0.31, -0.01],
          [0.312, 0.07],
        ],
        12,
      ),
      0.8,
    ),
    shade(c, move(prism(8, 0.035, 0.03), [0, 0.3, 0]), 0.85),
    shade(
      c,
      extrude([[0.3, 0.12], ...peak, [-0.3, 0.12]], 0.0, 0.025, (x, z, y) => [x, y, z], [0, 1, 0]),
      0.7,
    ),
  ];
}

/** A foot's sole in its outline: the heel round, the ball broad, the toe pointed a little; `y` its top. */
function soleOutline(): [number, number][] {
  return [
    [-0.4, -0.07],
    [-0.42, 0],
    [-0.4, 0.07],
    [-0.2, 0.1],
    [0.12, 0.13],
    [0.32, 0.11],
    [0.43, 0.05],
    [0.45, 0],
    [0.43, -0.05],
    [0.32, -0.11],
    [0.12, -0.12],
    [-0.2, -0.09],
  ];
}
function sole(y0: number, y1: number): Mesh {
  return extrude(soleOutline(), y0, y1, (x, z, y) => [x, y, z], [0, 1, 0]);
}
/** Laces criss-crossed up the front of a boot or a shoe, from the toe's end to its top (drawn only when looked at). */
function laces(c: ThingCtx, from: number, to: number, x0: number, x1: number, n: number): Mark {
  const lines: V3[][] = [];
  for (let k = 0; k < n; k++) {
    const t0 = k / n,
      t1 = (k + 1) / n,
      y0 = from + (to - from) * t0,
      y1 = from + (to - from) * t1,
      xa = x0 + (x1 - x0) * t0,
      xb = x0 + (x1 - x0) * t1;
    lines.push([
      [xa, y0, -0.06],
      [xb + 0.02, y1, 0.06],
    ]);
    lines.push([
      [xa, y0, 0.06],
      [xb + 0.02, y1, -0.06],
    ]);
  }
  return { normal: [1, 0.3, 0.6], lines, color: mix(c.color, WHITE, 0.55), alpha: 0.9, width: 1 };
}

/** A boot: a sole and a heel block under it, the foot's upper with its toe cap, the shaft up the leg, laced up its front. */
function bootParts(c: ThingCtx): SpecimenPart[] {
  const upper = hull([
      ...soleOutline().map(([x, z]): V3 => [x * 0.96, 0.06, z * 0.96]),
      [0.38, 0.13, 0.06],
      [0.38, 0.13, -0.06],
      [0.18, 0.23, 0.09],
      [0.18, 0.23, -0.09],
      [-0.02, 0.33, 0.1],
      [-0.02, 0.33, -0.1],
      [-0.36, 0.3, 0.08],
      [-0.36, 0.3, -0.08],
    ]),
    shaft = lathe(
      [
        [0.15, 0.24],
        [0.14, 0.55],
        [0.16, 0.86],
      ],
      10,
    ),
    up = move(scale(shaft, [1.05, 1, 0.85]), [-0.18, 0, 0]),
    parts: SpecimenPart[] = [
      shade(c, sole(0, 0.06), 0.45, { surface: "none" }),
      shade(c, move(box(0.17, 0.07, 0.17), [-0.32, -0.035, 0]), 0.4, { surface: "none" }),
      head(c, upper),
      head(c, up),
      shade(c, move(box(0.08, 0.5, 0.11), [-0.04, 0.55, 0]), 0.78),
      // (Where the leg goes in, dark.)
      shade(c, move(scale(prism(10, 0.13, 0.01), [1.05, 1, 0.85]), [-0.18, 0.865, 0]), 0.28, {
        surface: "none",
      }),
    ];
  if (c.fine) parts[3] = { ...parts[3]!, marks: [laces(c, 0.3, 0.84, -0.02, -0.03, 6)] };
  return parts;
}

/** A shoe: the sole and its heel, a low upper over the foot, the tongue, laced across. */
function shoeParts(c: ThingCtx): SpecimenPart[] {
  const upper = hull([
    ...soleOutline().map(([x, z]): V3 => [x * 0.96, 0.06, z * 0.96]),
    [0.38, 0.13, 0.06],
    [0.38, 0.13, -0.06],
    [0.16, 0.22, 0.1],
    [0.16, 0.22, -0.1],
    [-0.16, 0.26, 0.1],
    [-0.16, 0.26, -0.1],
    [-0.4, 0.24, 0.07],
    [-0.4, 0.24, -0.07],
  ]);
  const parts: SpecimenPart[] = [
    shade(c, sole(0, 0.06), 0.45, { surface: "none" }),
    shade(c, move(box(0.15, 0.06, 0.16), [-0.32, -0.03, 0]), 0.4, { surface: "none" }),
    head(c, upper),
    // (Where the foot goes in, dark.)
    shade(c, move(scale(prism(10, 0.1, 0.01), [1.3, 1, 0.75]), [-0.25, 0.262, 0]), 0.28, {
      surface: "none",
    }),
  ];
  if (c.fine) parts[2] = { ...parts[2]!, marks: [lacesFlat(c)] };
  return parts;
}
/** A shoe's laces, across its instep. */
function lacesFlat(c: ThingCtx): Mark {
  const lines: V3[][] = [];
  for (let k = 0; k < 4; k++) {
    const x = 0.12 - k * 0.06,
      y = 0.222 + k * 0.011;
    lines.push([
      [x, y, -0.07],
      [x - 0.05, y + 0.012, 0.07],
    ]);
  }
  return { normal: [0.3, 1, 0.3], lines, color: mix(c.color, WHITE, 0.55), alpha: 0.9, width: 1 };
}

/** A sandal: a sole, straps over the foot and about the heel, a thong between the toes. */
function sandalParts(c: ThingCtx): SpecimenPart[] {
  const strap = (x: number, w: number, h: number) =>
      join(beam([x, 0.05, -w], [x + 0.02, h, 0], 0.03), beam([x + 0.02, h, 0], [x, 0.05, w], 0.03)),
    straps = join(
      strap(0.18, 0.12, 0.15),
      strap(-0.02, 0.12, 0.2),
      beam([0.36, 0.05, 0], [0.18, 0.15, 0], 0.025),
      beam([-0.3, 0.05, -0.09], [-0.42, 0.2, 0], 0.03),
      beam([-0.42, 0.2, 0], [-0.3, 0.05, 0.09], 0.03),
      beam([-0.42, 0.2, 0], [-0.02, 0.2, 0], 0.025),
    );
  return [head(c, sole(0, 0.05)), shade(c, straps, 0.6, { surface: "none" })];
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

// Machines, a host's kit and plants as a market sells them (asked 2026-11-12): each of a few solids, its body of its stuff (a car of its
// land's steel or bronze, a radio's case of its wood), its second stuff the haft's colour, the rest glass, rubber or a lit face.

const TYRE: Rgb = [0.12, 0.12, 0.13];
const PANE: Rgb = [0.24, 0.32, 0.42];
const FACE: Rgb = [0.92, 0.88, 0.76];
const SCREEN: Rgb = [0.36, 0.62, 0.78];

/** A part of a machine's second stuff: a cased set's metal fittings, a metal machine's wooden trim. */
function trim(c: ThingCtx, mesh: Mesh): SpecimenPart {
  return {
    mesh,
    color: c.wood,
    lustre: "metallic",
    clarity: 0,
    gloss: c.gloss,
    // (A cased set's fittings are metal, turned on a lathe; a metal machine's trim is wood.)
    surface: c.made === "carved" ? "machined" : "wood",
  };
}
/** A part of its own colour, dull or glassy: rubber, a window, a dial's face. */
function plain(mesh: Mesh, color: Rgb, lustre: Lustre = "dull", glow = false): SpecimenPart {
  return {
    mesh,
    color,
    lustre,
    clarity: 0,
    surface: "none",
    ...(glow ? { glow: true, strong: true } : {}),
  };
}
/** A wheel or a disc whose axle runs front to back (z), at a place. */
const disc = (n: number, r: number, w: number, at: V3): Mesh =>
  move(rotate(prism(n, r, w), 0, Math.PI / 2, 0), at);
/** A cylinder lying along x, at a place. */
const lying = (n: number, r: number, l: number, at: V3): Mesh =>
  move(rotate(prism(n, r, l), 0, 0, Math.PI / 2), at);

function motorCarParts(c: ThingCtx): SpecimenPart[] {
  const wheels = join(
    ...[-0.46, 0.46].flatMap((x) => [-0.3, 0.3].map((z) => disc(8, 0.17, 0.12, [x, -0.16, z]))),
  );
  return [
    head(c, box(1.45, 0.3, 0.6)),
    head(c, move(box(0.74, 0.26, 0.56), [-0.1, 0.27, 0])),
    plain(move(box(0.78, 0.16, 0.58), [-0.1, 0.29, 0]), PANE, "vitreous"),
    plain(wheels, TYRE),
  ];
}

function armouredCarParts(c: ThingCtx): SpecimenPart[] {
  const wheels = join(
    ...[-0.46, 0, 0.46].flatMap((x) => [-0.32, 0.32].map((z) => disc(8, 0.16, 0.12, [x, -0.2, z]))),
  );
  return [
    head(c, box(1.4, 0.36, 0.62)),
    head(c, move(prism(8, 0.22, 0.18), [-0.05, 0.27, 0])),
    head(c, lying(6, 0.035, 0.55, [0.34, 0.29, 0])),
    plain(wheels, TYRE),
  ];
}

function locomotiveParts(c: ThingCtx): SpecimenPart[] {
  const wheels = join(
    ...[-0.45, 0, 0.42].flatMap((x) =>
      [-0.24, 0.24].map((z) => disc(10, 0.16, 0.06, [x, -0.3, z])),
    ),
  );
  return [
    head(c, lying(10, 0.22, 1.0, [0.12, 0.02, 0])),
    head(c, move(box(0.42, 0.56, 0.52), [-0.56, 0.1, 0])),
    trim(c, move(prism(8, 0.07, 0.28), [0.48, 0.34, 0])),
    plain(move(box(1.5, 0.08, 0.46), [-0.05, -0.2, 0]), TYRE),
    plain(wheels, dim(c.color, 0.6), "metallic"),
  ];
}

function steamEngineParts(c: ThingCtx): SpecimenPart[] {
  return [
    plain(move(box(1.1, 0.14, 0.5), [0, -0.42, 0]), dim(c.color, 0.7), "metallic"),
    head(c, lying(10, 0.17, 0.5, [-0.25, -0.17, 0])),
    head(c, disc(14, 0.44, 0.07, [0.3, 0.05, 0.26])),
    trim(c, move(prism(6, 0.035, 0.4), [-0.25, 0.18, 0])),
  ];
}

function marineEngineParts(c: ThingCtx): SpecimenPart[] {
  return [
    head(c, box(1.0, 0.44, 0.48)),
    head(c, join(...[-0.3, 0, 0.3].map((x) => move(prism(8, 0.12, 0.42), [x, 0.42, 0])))),
    trim(c, lying(8, 0.05, 1.3, [0, -0.1, 0.28])),
  ];
}

function powerLoomParts(c: ThingCtx): SpecimenPart[] {
  const posts = join(
    ...[-0.45, 0.45].flatMap((x) =>
      [-0.26, 0.26].map((z) => move(box(0.06, 0.9, 0.06), [x, 0, z])),
    ),
    move(box(0.96, 0.06, 0.06), [0, 0.42, -0.26]),
    move(box(0.96, 0.06, 0.06), [0, 0.42, 0.26]),
  );
  return [
    head(c, posts),
    trim(c, lying(10, 0.09, 0.86, [0, 0.12, -0.18])),
    plain(move(rotate(box(0.86, 0.02, 0.42), 0, 0.25, 0), [0, 0.05, 0.05]), FACE),
  ];
}

function clockParts(c: ThingCtx): SpecimenPart[] {
  return [
    head(c, box(0.42, 1.1, 0.26)),
    trim(c, disc(14, 0.17, 0.03, [0, 0.3, 0.14])),
    plain(disc(14, 0.14, 0.03, [0, 0.3, 0.16]), FACE),
    plain(
      join(
        move(box(0.02, 0.11, 0.01), [0, 0.35, 0.18]),
        move(box(0.08, 0.02, 0.01), [0.04, 0.3, 0.18]),
      ),
      TYRE,
    ),
    trim(c, disc(10, 0.07, 0.02, [0, -0.25, 0.14])),
  ];
}

function dynamoParts(c: ThingCtx): SpecimenPart[] {
  return [
    plain(move(box(0.8, 0.1, 0.5), [0, -0.32, 0]), dim(c.color, 0.7), "metallic"),
    head(c, lying(12, 0.26, 0.6, [0, 0, 0])),
    trim(c, lying(6, 0.035, 1.05, [0, 0, 0])),
    trim(c, lying(10, 0.14, 0.06, [0.5, 0, 0])),
  ];
}

function waterWheelParts(c: ThingCtx): SpecimenPart[] {
  const paddles = join(
    ...Array.from({ length: 8 }, (_, k) => {
      const a = (k / 8) * Math.PI * 2;
      return move(rotate(box(0.08, 0.2, 0.22), 0, 0, a), [
        0.72 * Math.cos(a),
        0.72 * Math.sin(a),
        0,
      ]);
    }),
  );
  return [...wheelParts(c), head(c, paddles)];
}

function sunEngineParts(c: ThingCtx): SpecimenPart[] {
  return [
    plain(move(rotate(box(1.1, 0.04, 0.72), 0, 0.7, 0), [0, 0.2, 0]), PANE, "vitreous"),
    trim(c, move(rotate(box(1.14, 0.03, 0.76), 0, 0.7, 0), [0, 0.18, -0.01])),
    head(c, move(prism(6, 0.05, 0.6), [0, -0.25, 0])),
    head(c, move(box(0.4, 0.16, 0.3), [0, -0.52, 0])),
  ];
}

function aeroplaneParts(c: ThingCtx): SpecimenPart[] {
  return [
    head(c, lying(8, 0.1, 1.4, [0, 0, 0])),
    head(c, move(box(0.36, 0.03, 1.5), [0.15, 0.02, 0])),
    head(
      c,
      join(
        move(box(0.18, 0.02, 0.48), [-0.62, 0.04, 0]),
        move(box(0.16, 0.22, 0.02), [-0.62, 0.14, 0]),
      ),
    ),
    plain(move(box(0.02, 0.44, 0.05), [0.72, 0, 0]), TYRE),
  ];
}

function telegraphKeyParts(c: ThingCtx): SpecimenPart[] {
  return [
    head(c, box(0.8, 0.1, 0.44)),
    trim(c, move(rotate(box(0.56, 0.04, 0.07), 0, 0, 0.08), [0.04, 0.12, 0])),
    plain(move(prism(10, 0.07, 0.06), [0.3, 0.18, 0]), TYRE),
    trim(c, move(prism(8, 0.06, 0.16), [-0.28, 0.12, 0])),
  ];
}

function telephoneParts(c: ThingCtx): SpecimenPart[] {
  return [
    head(c, move(prism(12, 0.24, 0.08), [0, -0.5, 0])),
    head(c, move(prism(8, 0.05, 0.75), [0, -0.1, 0])),
    head(c, move(rotate(pyramid(10, 0.1, 0.12), 0, -Math.PI / 2, 0), [0, 0.3, 0.02])),
    trim(c, move(rotate(prism(8, 0.045, 0.34), 0, 0, 0.15), [0.18, 0.02, 0])),
  ];
}

function radioSetParts(c: ThingCtx): SpecimenPart[] {
  return [
    head(c, box(0.9, 0.6, 0.34)),
    plain(disc(12, 0.19, 0.02, [-0.18, 0.04, 0.18]), dim(c.color, 0.45)),
    plain(move(box(0.26, 0.12, 0.02), [0.24, 0.12, 0.18]), FACE),
    trim(
      c,
      join(disc(8, 0.05, 0.05, [0.16, -0.14, 0.19]), disc(8, 0.05, 0.05, [0.32, -0.14, 0.19])),
    ),
  ];
}

function computerParts(c: ThingCtx): SpecimenPart[] {
  return [
    head(c, move(box(0.74, 0.56, 0.42), [0, 0.2, -0.1])),
    plain(move(box(0.58, 0.42, 0.02), [0, 0.22, 0.12]), SCREEN, "vitreous", true),
    head(c, move(box(0.8, 0.05, 0.3), [0, -0.18, 0.34])),
    trim(c, move(box(0.3, 0.06, 0.24), [0, -0.12, -0.1])),
  ];
}

function phoneParts(c: ThingCtx): SpecimenPart[] {
  return [
    head(c, box(0.46, 0.92, 0.06)),
    plain(move(box(0.4, 0.78, 0.01), [0, 0.01, 0.035]), SCREEN, "vitreous", true),
    plain(move(prism(8, 0.025, 0.01), [0, 0.42, 0.04]), TYRE),
  ];
}

function thinkingMachineParts(c: ThingCtx): SpecimenPart[] {
  return [
    head(c, box(0.62, 1.05, 0.5)),
    plain(
      join(...[0.3, 0.1, -0.1, -0.3].map((y) => move(box(0.46, 0.04, 0.01), [0, y, 0.26]))),
      SCREEN,
      "vitreous",
      true,
    ),
    trim(c, move(box(0.66, 0.06, 0.54), [0, 0.52, 0])),
  ];
}

function madeBodyParts(c: ThingCtx): SpecimenPart[] {
  return [
    head(c, move(box(0.4, 0.5, 0.22), [0, 0.18, 0])),
    head(c, move(box(0.22, 0.22, 0.2), [0, 0.58, 0])),
    trim(
      c,
      join(
        move(box(0.12, 0.5, 0.14), [-0.11, -0.35, 0]),
        move(box(0.12, 0.5, 0.14), [0.11, -0.35, 0]),
      ),
    ),
    trim(
      c,
      join(
        move(box(0.1, 0.46, 0.12), [-0.27, 0.16, 0]),
        move(box(0.1, 0.46, 0.12), [0.27, 0.16, 0]),
      ),
    ),
    plain(move(box(0.14, 0.03, 0.01), [0, 0.6, 0.105]), SCREEN, "vitreous", true),
  ];
}

function shieldParts(c: ThingCtx): SpecimenPart[] {
  return [
    head(c, scale(disc(14, 0.5, 0.06, [0, 0, 0]), [1, 1.15, 1])),
    trim(c, disc(10, 0.12, 0.08, [0, 0.02, 0.04])),
  ];
}

function helmetParts(c: ThingCtx): SpecimenPart[] {
  return [
    head(
      c,
      lathe(
        [
          [0.42, -0.2],
          [0.4, 0],
          [0.34, 0.16],
          [0.2, 0.28],
          [0, 0.32],
        ],
        12,
      ),
    ),
    head(c, move(box(0.06, 0.24, 0.06), [0, -0.22, 0.4])),
  ];
}

/** The machines and the vehicles stand on their wheels or their feet, not tipped as a tool lies. */
const UPRIGHT: ReadonlySet<string> = new Set([
  "motor car",
  "armoured car",
  "locomotive",
  "steam engine",
  "marine engine",
  "power loom",
  "clock",
  "dynamo",
  "water wheel",
  "sun engine",
  "aeroplane",
  "telegraph key",
  "telephone",
  "radio set",
  "computer",
  "phone",
  "thinking machine",
  "made body",
  "helmet",
  "plough share",
  "boot",
  "shoe",
  "sandal",
  "hat",
  "cap",
]);

/** Tools so slender that a thumbnail draws them broader. */
const SLENDER: ReadonlySet<string> = new Set(["knife", "chisel", "awl", "blade"]);

/** Garments laid out to face the eye: turned only a little, so their sleeves, neck and legs read. */
const FLAT: ReadonlySet<string> = new Set([
  "tunic",
  "shirt",
  "gown",
  "dress",
  "trousers",
  "cloak",
  "coat",
  "cuirass",
]);

// Plants (kind "plant")

/** A plant: a grass's ear on its stalk (the heavier its seed, the fatter and longer), a bed's frond, a garden's tuber, a dome's leaves. */
function plantParts(p: Extract<Portrait, { kind: "plant" }>): SpecimenPart[] {
  const leaf = (mesh: Mesh): SpecimenPart => plain(mesh, p.leaf, "waxy"),
    blade = (len: number, yaw: number, lean: number, at: V3): Mesh =>
      move(rotate(scale(bipyramid(4, 0.05, len / 2), [1, 1, 0.25]), yaw, 0, lean), at),
    bend = 0.08 * (hash(p.key, 1) - 0.5);
  switch (p.form) {
    case "ear": {
      const n = 5 + Math.round(p.seed * 4),
        r = 0.035 + 0.05 * p.seed,
        top = 0.1,
        tip = top + n * r * 2.1;
      const grains = join(
        ...Array.from({ length: n }, (_, k) =>
          move(scale(bipyramid(4, r, r * 1.5), [1, 1, 0.8]), [
            (k % 2 ? 1 : -1) * r * 0.8 + bend * k,
            top + k * r * 2.1,
            0,
          ]),
        ),
      );
      return [
        leaf(beam([0, -0.75, 0], [bend * n, top, 0], 0.035)),
        leaf(
          join(blade(0.6, 0.3, 0.5, [-0.12, -0.35, 0]), blade(0.55, -0.4, -0.45, [0.12, -0.45, 0])),
        ),
        plain(grains, p.ear, "waxy"),
        plain(beam([bend * n, tip, 0], [bend * n + 0.04, tip + 0.22, 0], 0.012), p.ear),
      ];
    }
    case "frond":
      return [
        leaf(
          join(
            ...Array.from({ length: 4 }, (_, k) =>
              move(rotate(box(0.16, 0.34, 0.03), 0.4 * k, 0, (k % 2 ? 0.35 : -0.35) + bend), [
                k % 2 ? 0.06 : -0.06,
                -0.5 + k * 0.3,
                0,
              ]),
            ),
          ),
        ),
        plain(move(scale(icosphere(0), [0.18, 0.12, 0.18]), [0.2, -0.62, 0.05]), p.ear, "pearly"),
      ];
    case "tuber":
      return [
        plain(
          jitter(scale(icosphere(1), [0.42, 0.3, 0.32]), p.key, 0.08),
          mix(p.ear, CLAY_DARK, 0.55),
        ),
        leaf(
          join(blade(0.5, 0.2, 0.35, [-0.08, 0.45, 0]), blade(0.45, -0.5, -0.3, [0.08, 0.42, 0])),
        ),
      ];
    case "leaf": {
      const at = (k: number): V3 => {
        const a = (k / 5) * Math.PI * 2;
        return [0.18 * Math.cos(a), 0, 0.18 * Math.sin(a)];
      };
      return [
        leaf(
          join(
            ...Array.from({ length: 5 }, (_, k) =>
              move(
                rotate(scale(bipyramid(5, 0.16, 0.36), [1, 1, 0.2]), (k / 5) * Math.PI * 2, 0, 0.9),
                at(k),
              ),
            ),
          ),
        ),
        plain(move(prism(8, 0.1, 0.12), [0, -0.12, 0]), mix(p.leaf, p.ear, 0.5), "waxy"),
      ];
    }
  }
}

// What a made thing is, when its form names no shape: its shape by how it was made.

const MADE_SHAPE: Record<MadeHow, (c: ThingCtx) => SpecimenPart[]> = {
  knapped: (c) => [head(c, scale(bipyramid(3, 0.42, 0.34), [1, 1, 0.3]))],
  forged: (c) => [head(c, prism(4, 0.06, 0.8)), head(c, move(pyramid(4, 0.06, 0.2), [0, 0.4, 0]))],
  cast: (c) => [head(c, box(0.5, 0.4, 0.4))],
  thrown: bowlParts,
  woven: clothBoltParts,
  sewn: tunicParts,
  machined: boltParts,
  carved: (c) => [haft(c, prism(6, 0.05, 1.0))],
  grown: (c) => [head(c, jitter(scale(icosphere(1), [0.5, 0.4, 0.5]), c.key, 0.15))],
};

type ThingBuilder = (c: ThingCtx) => SpecimenPart[];

/** Each form's words and its shape, in the order the shapes are matched (arms, tools, pots, cloth, machine parts). */
const THINGS: readonly (readonly [readonly string[], ThingBuilder])[] = [
  [["club"], clubParts],
  [["spear"], spearParts],
  [["darts", "dart"], fannedDartsParts],
  [["set-blade", "set flakes", "long blade"], setBladeParts],
  [["gas-dart"], dartsParts],
  [["sound-lance"], beamLanceParts],
  [["sword"], swordParts],
  [["horn-bow"], hornBowParts],
  [["bow"], bowParts],
  [["musket"], musketParts],
  [["rifle"], rifleParts],
  [["repeater"], repeaterParts],
  [["autoloader"], autoloaderParts],
  [["automatic"], automaticParts],
  [["beam-rifle", "beam rifle", "beam-rifleman"], beamRifleParts],
  [["beam-lance", "beam lance", "beam-lancer"], beamLanceParts],
  [["axe"], axeParts],
  [["adze"], adzeParts],
  [["hoe"], hoeParts],
  [["sickle"], sickleParts],
  [["spearhead", "spear point"], spearheadParts],
  [["plough share", "ploughshare", "share"], shareParts],
  [["shears"], shearsParts],
  [["hammer"], hammerParts],
  [["chisel"], chiselParts],
  [["knife"], knifeParts],
  [["saw"], sawParts],
  [["awl", "borer"], awlParts],
  [["scraper"], scraperParts],
  [["blade"], stoneBladeParts],
  [["storage jar"], storageParts],
  [["cooking pot"], cookingParts],
  [["jug"], jugParts],
  [["bowl"], bowlParts],
  [["pot", "jar", "vessel"], storageParts],
  [["tunic", "garment"], tunicParts],
  [["shirt"], shirtParts],
  [["gown"], (c) => gownParts(c, true)],
  [["dress"], (c) => gownParts(c, false)],
  [["trousers", "breeches"], trousersParts],
  [["cloak", "cape"], cloakParts],
  [["coat"], coatParts],
  [["cuirass", "breastplate"], cuirassParts],
  [["hat"], hatParts],
  [["cap", "hood"], capParts],
  [["boot"], bootParts],
  [["shoe"], shoeParts],
  [["sandal"], sandalParts],
  [["cloth", "bolt", "length"], clothBoltParts],
  [["shaft", "axle"], shaftParts],
  [["piston"], pistonParts],
  [["bolt"], boltParts],
  [["gear", "cog"], gearParts],
  [["wheel"], wheelParts],
  [["casting", "block", "frame"], castingParts],
  [["motor car"], motorCarParts],
  [["armoured car"], armouredCarParts],
  [["locomotive"], locomotiveParts],
  [["steam engine"], steamEngineParts],
  [["marine engine"], marineEngineParts],
  [["power loom"], powerLoomParts],
  [["clock"], clockParts],
  [["dynamo"], dynamoParts],
  [["water wheel"], waterWheelParts],
  [["sun engine"], sunEngineParts],
  [["aeroplane"], aeroplaneParts],
  [["telegraph key"], telegraphKeyParts],
  [["telephone"], telephoneParts],
  [["radio set"], radioSetParts],
  [["computer"], computerParts],
  [["phone"], phoneParts],
  [["thinking machine"], thinkingMachineParts],
  [["made body"], madeBodyParts],
  [["shield"], shieldParts],
  [["helmet"], helmetParts],
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
function thingParts(p: Extract<Portrait, { kind: "thing" }>, fine: boolean): SpecimenPart[] {
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
    fine,
  };
  const build = shapeOf(p.form) ?? MADE_SHAPE[p.made],
    parts = treat(c, build(c));
  if (fine) return finish(c, parts);
  // (A slender tool in a small picture is drawn broader across than it is, as an icon is, or it is a line two pixels wide.)
  return SLENDER.has(p.form)
    ? parts.map((q) => ({ ...q, mesh: scale(q.mesh, [1.6, 1, 1.6]) }))
    : parts;
}

/** Whether a form names a shape of its own (else it is drawn by how it was made). */
export function hasShape(form: string): boolean {
  return !!shapeOf(form);
}

/**
 * The parts of a specimen, as they stand in their own frames (a matter, an element, a made thing or a plant);
 * [] for any other kind of portrait. The same portrait always gives the same parts. At the fine level (a picture
 * drawn large, looked at) a made thing has its finer parts and its surface's marks; a thumbnail never does.
 */
export function specimenParts(p: Portrait, fine = false): SpecimenPart[] {
  let parts: SpecimenPart[];
  switch (p.kind) {
    case "matter":
      parts = matterParts(p);
      break;
    case "element":
      parts = elementParts(p);
      break;
    case "thing":
      parts = thingParts(p, fine);
      break;
    case "plant":
      parts = plantParts(p);
      break;
    default:
      return [];
  }
  return parts.filter((q) => q.mesh.f.length > 0);
}

// ---- The fine level (asked 2026-11-12: "i want more generative detail ... lightweight when running the game it just appreciate detail
// when i look for it") ----------------------------------------------------------------------------------------------------------------
//
// Drawn only in the large view, never in a thumbnail: the lines a surface shows of how it was made, read off each face's own shape. A
// woven cloth's weave and its seams' stitching; leather's stitching and creases; a haft's grain; a forged head's hammer marks and a cast
// one's parting seam; a machined one's tool lines and the rivets along its plates; a knapped stone's flake scars; a thrown pot's rings;
// a blade's honed bevel; and wear by its quality. Nothing is kept but the parts a picture is drawn from while it is open.

/** How a face's surface shows how it was made, at the fine level. */
const SURFACE_OF: Readonly<Record<MadeHow, Surface>> = {
  knapped: "knapped",
  forged: "forged",
  cast: "cast",
  machined: "machined",
  thrown: "thrown",
  woven: "weave",
  sewn: "leather",
  carved: "wood",
  grown: "none",
};

/** A face laid flat: its middle, its two axes in its plane (u along its longest edge), its normal, its corners in (u, v), its area. */
type Frame = {
  readonly o: V3;
  readonly u: V3;
  readonly v: V3;
  readonly n: V3;
  readonly uv: readonly (readonly [number, number])[];
  readonly area: number;
};

function frameOf(mesh: Mesh, face: readonly number[], along?: V3): Frame | null {
  const nw = newell(mesh, face),
    len = Math.hypot(nw[0], nw[1], nw[2]);
  if (len < 1e-12) return null;
  const n = scl(nw, 1 / len),
    o = centroid(mesh, face);
  let u: V3 = [1, 0, 0],
    best = -1;
  if (along) {
    // (A direction asked for, laid into the face's plane: a pot's rings run round it.)
    const t = sub(along, scl(n, dot(along, n))),
      l = Math.hypot(t[0], t[1], t[2]);
    if (l > 1e-6) {
      u = scl(t, 1 / l);
      best = 1;
    }
  }
  if (best < 0)
    for (let i = 0; i < face.length; i++) {
      const d = sub(mesh.v[face[(i + 1) % face.length]!]!, mesh.v[face[i]!]!),
        l = Math.hypot(d[0], d[1], d[2]);
      if (l > best) {
        best = l;
        u = scl(d, 1 / Math.max(1e-12, l));
      }
    }
  const v = cross(n, u),
    uv = face.map((i): [number, number] => {
      const d = sub(mesh.v[i]!, o);
      return [dot(d, u), dot(d, v)];
    });
  return { o, u, v, n, uv, area: len / 2 };
}

const fromUV = (f: Frame, a: number, b: number): V3 => add(f.o, add(scl(f.u, a), scl(f.v, b)));

/** Lines across a face, `count` of them evenly, each parallel to its u axis (or its v), clipped to it, `margin` short of its edges. */
function linesAcross(f: Frame, count: number, alongV: boolean, margin = 0): V3[][] {
  const pts = f.uv.map(([a, b]): readonly [number, number] => (alongV ? [b, a] : [a, b]));
  let lo = Infinity,
    hi = -Infinity;
  for (const p of pts) {
    lo = Math.min(lo, p[1]);
    hi = Math.max(hi, p[1]);
  }
  const out: V3[][] = [];
  for (let k = 0; k < count; k++) {
    const b = lo + ((hi - lo) * (k + 0.5)) / count;
    let a0 = Infinity,
      a1 = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!,
        q = pts[(i + 1) % pts.length]!;
      if ((p[1] - b) * (q[1] - b) > 0 || p[1] === q[1]) continue;
      const a = p[0] + ((q[0] - p[0]) * (b - p[1])) / (q[1] - p[1]);
      a0 = Math.min(a0, a);
      a1 = Math.max(a1, a);
    }
    a0 += margin;
    a1 -= margin;
    if (!(a1 > a0)) continue;
    out.push(alongV ? [fromUV(f, b, a0), fromUV(f, b, a1)] : [fromUV(f, a0, b), fromUV(f, a1, b)]);
  }
  return out;
}

/** A face's outline drawn in toward its middle (k of the way out): a seam's line, a bevel's, a flake scar's ring. */
const insetLoop = (f: Frame, k: number): V3[] => f.uv.map(([a, b]) => fromUV(f, a * k, b * k));

/** A keyed point inside a face (its corners' fan, a triangle and a place in it by the key). */
function inside(f: Frame, key: number, i: number): [number, number] {
  const n = f.uv.length,
    t = Math.min(n - 3, Math.floor(hash(key, i) * (n - 2))),
    p = f.uv[0]!,
    q = f.uv[t + 1]!,
    r = f.uv[t + 2]!;
  let s = hash(key, i + 101),
    w = hash(key, i + 202);
  if (s + w > 1) {
    s = 1 - s;
    w = 1 - w;
  }
  // (Kept off the edges: drawn toward the middle by a fifth.)
  const a = p[0] + s * (q[0] - p[0]) + w * (r[0] - p[0]),
    b = p[1] + s * (q[1] - p[1]) + w * (r[1] - p[1]);
  return [a * 0.8, b * 0.8];
}

/** The faces of a part worth marking: those large enough to be seen, the largest first, at most so many. */
function markable(mesh: Mesh, least: number, most: number): { k: number; f: Frame }[] {
  const out: { k: number; f: Frame }[] = [];
  mesh.f.forEach((face, k) => {
    if (face.length < 3) return;
    const f = frameOf(mesh, face);
    if (f && f.area >= least) out.push({ k, f });
  });
  return out.sort((a, b) => b.f.area - a.f.area || a.k - b.k).slice(0, most);
}

/** The marks a part's surface shows, face by face. */
function surfaceMarks(
  c: ThingCtx,
  p: SpecimenPart,
  surface: Surface,
  least: number,
  S: number,
  salt: number,
): Mark[] {
  const out: Mark[] = [],
    dark = (k: number) => dim(p.color, k),
    light = (t: number) => mix(p.color, WHITE, t),
    faces = markable(p.mesh, least, 28),
    key = (c.key + salt) >>> 0;
  faces.forEach(({ k, f }, rank) => {
    const side = Math.sqrt(f.area);
    switch (surface) {
      case "weave": {
        const n = Math.max(2, Math.min(12, Math.round(side / (0.028 * S))));
        out.push({
          face: k,
          lines: [...linesAcross(f, n, false), ...linesAcross(f, n, true)],
          color: dark(0.7),
          alpha: 0.22,
          width: 0.5,
        });
        if (rank < 6)
          out.push({
            face: k,
            lines: [insetLoop(f, 0.88)],
            color: light(0.5),
            alpha: 0.6,
            width: 0.7,
            dash: true,
            closed: true,
          });
        return;
      }
      case "leather": {
        if (rank < 8)
          out.push({
            face: k,
            lines: [insetLoop(f, 0.84)],
            color: light(0.55),
            alpha: 0.75,
            width: 0.8,
            dash: true,
            closed: true,
          });
        const creases: V3[][] = [];
        for (let i = 0; i < 3; i++) {
          const [a, b] = inside(f, key + k, i * 7),
            r = side * 0.12,
            t = hash(key + k, i * 7 + 3) * Math.PI;
          creases.push([
            fromUV(f, a - r * Math.cos(t), b - r * Math.sin(t)),
            fromUV(f, a + r * Math.cos(t), b + r * Math.sin(t)),
          ]);
        }
        out.push({ face: k, lines: creases, color: dark(0.7), alpha: 0.35, width: 0.6 });
        return;
      }
      case "wood": {
        // (The grain runs along the haft: a few lines down each face's length, wavering.)
        const lines = linesAcross(f, 2, false).map(([a, b]): V3[] => {
          const pts: V3[] = [];
          for (let i = 0; i <= 4; i++) {
            const t = i / 4,
              w = (hash(key + k, i + 40) - 0.5) * 0.18 * side;
            pts.push(add(add(scl(a!, 1 - t), scl(b!, t)), scl(f.v, w)));
          }
          return pts;
        });
        out.push({ face: k, lines, color: dark(0.6), alpha: 0.45, width: 0.6 });
        return;
      }
      case "forged": {
        // (Hammer marks: short dents, the more as the smith's work was rougher.)
        const n = Math.max(
            1,
            Math.min(7, Math.round((f.area / least) * 0.5 * (1.4 - c.quality / 100))),
          ),
          dents: V3[][] = [];
        for (let i = 0; i < n; i++) {
          const [a, b] = inside(f, key + k, i * 5),
            r = Math.min(0.035 * S, side * 0.16),
            t = hash(key + k, i * 5 + 2) * Math.PI * 2;
          dents.push(
            [0, 0.8, 1.6].map((d) => fromUV(f, a + r * Math.cos(t + d), b + r * Math.sin(t + d))),
          );
        }
        out.push({ face: k, lines: dents, color: dark(0.55), alpha: 0.5, width: 0.7 });
        return;
      }
      case "cast": {
        // (A pit or two of the sand it was cast in; its seam is drawn round it below.)
        if (rank < 4) {
          const [a, b] = inside(f, key + k, 9);
          out.push({
            face: k,
            lines: [[fromUV(f, a, b)]],
            color: dark(0.45),
            alpha: 0.5,
            width: 0.9,
            dots: true,
          });
        }
        return;
      }
      case "machined": {
        out.push({
          face: k,
          lines: linesAcross(f, Math.max(3, Math.min(9, Math.round(side / (0.04 * S)))), false),
          color: light(0.3),
          alpha: 0.14,
          width: 0.45,
        });
        // (Its plates riveted round their edges.)
        if (f.area >= least * 5 && rank < 8) {
          const ring = insetLoop(f, 0.82),
            pts: V3[] = [],
            step = 0.075 * S;
          for (let i = 0; i < ring.length && pts.length < 16; i++) {
            const a = ring[i]!,
              b = ring[(i + 1) % ring.length]!,
              l = Math.hypot(...sub(b, a)),
              m = Math.max(1, Math.floor(l / step));
            for (let j = 0; j < m && pts.length < 16; j++) pts.push(add(a, scl(sub(b, a), j / m)));
          }
          out.push({
            face: k,
            lines: [pts],
            color: light(0.35),
            alpha: 0.95,
            width: 1.4,
            dots: true,
          });
        }
        return;
      }
      case "knapped":
        out.push({
          face: k,
          lines: [insetLoop(f, 0.72), insetLoop(f, 0.42)],
          color: dark(0.68),
          alpha: 0.38,
          width: 0.6,
          closed: true,
        });
        return;
      case "thrown": {
        const g = frameOf(p.mesh, p.mesh.f[k]!, cross([0, 1, 0], f.n));
        if (g)
          out.push({
            face: k,
            lines: linesAcross(g, 2, false),
            color: dark(0.78),
            alpha: 0.3,
            width: 0.6,
          });
        return;
      }
      default:
        return;
    }
  });
  return out;
}

/** Where a plane (axis `ax` at `at`) cuts a face: its two crossing points, or null. */
function planeCut(mesh: Mesh, face: readonly number[], ax: 0 | 1 | 2, at: number): V3[] | null {
  const hits: V3[] = [];
  for (let i = 0; i < face.length; i++) {
    const a = mesh.v[face[i]!]!,
      b = mesh.v[face[(i + 1) % face.length]!]!,
      da = a[ax] - at,
      db = b[ax] - at;
    if (da === db || da * db > 0) continue;
    hits.push(add(a, scl(sub(b, a), da / (da - db))));
  }
  return hits.length >= 2 ? [hits[0]!, hits[1]!] : null;
}

/** Wear: scratches across a used head, the more as it was made worse and has worn. */
function wearMarks(c: ThingCtx, p: SpecimenPart, least: number, salt: number): Mark[] {
  const n = Math.round(((100 - c.quality) / 100) * 3 + c.worn * 8);
  if (n <= 0) return [];
  return markable(p.mesh, least, 3).map(({ k, f }): Mark => {
    const lines: V3[][] = [];
    for (let i = 0; i < n; i++) {
      const [a, b] = inside(f, c.key + salt + k, i * 11),
        r = Math.sqrt(f.area) * 0.2,
        t = hash(c.key + salt + k, i * 11 + 4) * Math.PI;
      lines.push([
        fromUV(f, a - r * Math.cos(t), b - r * Math.sin(t)),
        fromUV(f, a + r * Math.cos(t), b + r * Math.sin(t)),
      ]);
    }
    return { face: k, lines, color: mix(p.color, WHITE, 0.5), alpha: 0.4, width: 0.5 };
  });
}

/** Whether a point (a, b) of a face's plane lies inside its outline (a convex face; a point on its edge is in). */
function within(f: Frame, a: number, b: number): boolean {
  let sign = 0;
  for (let i = 0; i < f.uv.length; i++) {
    const p = f.uv[i]!,
      q = f.uv[(i + 1) % f.uv.length]!,
      c = (q[0] - p[0]) * (b - p[1]) - (q[1] - p[1]) * (a - p[0]);
    if (Math.abs(c) < 1e-9) continue;
    if (sign === 0) sign = Math.sign(c);
    else if (Math.sign(c) !== sign) return false;
  }
  return true;
}

/**
 * A part's free marks laid on its faces: each stroke of each line on the face it lies nearest of those turned its way, so it is drawn
 * just after that face and hidden with it.
 */
function bound(p: SpecimenPart, marks: readonly Mark[]): Mark[] {
  const frames = p.mesh.f.map((face) => (face.length >= 3 ? frameOf(p.mesh, face) : null)),
    out: Mark[] = [];
  for (const m of marks) {
    if (m.face !== undefined || !m.normal) {
      out.push(m);
      continue;
    }
    const n = norm(m.normal),
      by = new Map<number, V3[][]>();
    for (const line of m.lines)
      for (let i = 0; i + 1 < line.length || (i === 0 && line.length === 1); i++) {
        const a = line[i]!,
          b = line[Math.min(i + 1, line.length - 1)]!,
          mid = scl(add(a, b), 0.5);
        let best = -1,
          score = Infinity;
        frames.forEach((f, k) => {
          if (!f || dot(f.n, n) < 0.3) return;
          // (The face it lies over first: its middle inside the face's outline; else the nearest face's plane.)
          const d = sub(mid, f.o),
            sc =
              Math.abs(dot(d, f.n)) +
              (within(f, dot(d, f.u), dot(d, f.v)) ? 0 : 1 + Math.hypot(d[0], d[1], d[2]));
          if (sc < score) {
            score = sc;
            best = k;
          }
        });
        if (best < 0) continue;
        by.set(best, [...(by.get(best) ?? []), a === b ? [a] : [a, b]]);
      }
    for (const [face, lines] of by) out.push({ ...m, face, lines });
  }
  return out;
}

/** The fine level's marks on each part of a made thing, by its surface (its own, else its making's: a haft is wood). */
function finish(c: ThingCtx, parts: readonly SpecimenPart[]): SpecimenPart[] {
  let lo: V3 = [Infinity, Infinity, Infinity],
    hi: V3 = [-Infinity, -Infinity, -Infinity];
  for (const p of parts)
    for (const v of p.mesh.v) {
      lo = [Math.min(lo[0], v[0]), Math.min(lo[1], v[1]), Math.min(lo[2], v[2])];
      hi = [Math.max(hi[0], v[0]), Math.max(hi[1], v[1]), Math.max(hi[2], v[2])];
    }
  const S = Math.max(1e-6, hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]),
    least = 0.0012 * S * S,
    worn = c.made === "forged" || c.made === "cast" || c.made === "knapped";
  return parts.map((p, i) => {
    const surface: Surface =
        p.surface ?? (p.handle ? "wood" : p.glow || p.clarity > 0.2 ? "none" : SURFACE_OF[c.made]),
      marks = bound(p, p.marks ?? []);
    if (surface !== "none") marks.push(...surfaceMarks(c, p, surface, least, S, 1000 + 131 * i));
    // (Where a cast thing's mould's halves met: a seam round it at its middle, on every face it crosses.)
    if (surface === "cast")
      p.mesh.f.forEach((face, k) => {
        const seam = face.length >= 3 ? planeCut(p.mesh, face, 2, 0) : null;
        if (seam)
          marks.push({
            face: k,
            lines: [seam],
            color: mix(p.color, WHITE, 0.45),
            alpha: 0.65,
            width: 0.8,
          });
      });
    if (worn && !p.handle && surface !== "none") marks.push(...wearMarks(c, p, least, 2000 + i));
    return marks.length ? { ...p, marks } : p;
  });
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
  // (A machine or a vehicle stands on its wheels or its feet; a plant stands up as it grows.)
  if (p.kind === "thing" && FLAT.has(p.form))
    return { turn: 0.22 + Math.sin(t * 0.5) * 0.4, tilt: 0.12, roll: 0 };
  if (p.kind === "thing" && UPRIGHT.has(p.form))
    return { turn: 0.55 + Math.sin(t * 0.5) * 0.5, tilt: 0.3, roll: 0 };
  return p.kind === "thing"
    ? { turn: 0.3 + Math.sin(t * 0.5) * 0.5, tilt: 0.35, roll: -0.6109 }
    : { turn: 0.6 + t * 0.35, tilt: p.kind === "plant" ? 0.15 : 0.35, roll: 0 };
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
  /** Its part's marks on it, at the fine level. */
  readonly marks?: readonly Mark[];
  /** A free mark, drawn by itself at its depth (no face). */
  readonly free?: Mark;
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
  // (Each part's marks by the face they lie on, and the free ones, at the fine level only.)
  const onFace = parts.map((q) => {
    if (!q.marks) return null;
    const m = new Map<number, Mark[]>();
    for (const k of q.marks) if (k.face !== undefined) m.set(k.face, [...(m.get(k.face) ?? []), k]);
    return m;
  });
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
  views.forEach(({ q, pts }, qi) => {
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
      // (In a thumbnail a little less dimmed, so a steel head stands off a dark page.)
      const diffuse =
        q.lustre === "metallic" ? dim(base, (thumb ? 0.7 : 0.55) * shade) : dim(base, shade);
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
        // (Marks only on a face turned to the eye enough to show them.)
        ...(nn[2] > 0.12 && onFace[qi]?.has(fi) ? { marks: onFace[qi]!.get(fi)! } : {}),
      });
    });
    for (const m of q.marks ?? []) {
      if (m.face !== undefined) continue;
      if (m.normal && view(m.normal)[2] <= 0.05) continue;
      let z = 0,
        n = 0;
      for (const line of m.lines)
        for (const p of line) {
          z += view(p)[2];
          n++;
        }
      drawn.push({
        pts: [],
        depth: n ? z / n + 1e-3 : 0,
        fill: "",
        edge: null,
        glow: false,
        spec: 0,
        cx: 0,
        cy: 0,
        sparkle: false,
        free: m,
      });
    }
  });
  // Back to front: the faces furthest from the eye first.
  drawn.sort((a, b) => a.depth - b.depth);
  ctx.lineJoin = "round";
  // (A mark's width, against a picture 300 px across.)
  const sc = Math.max(0.6, Math.min(box.w, box.h) / 300),
    project = (p: V3) => at(view(p));
  for (const f of drawn) {
    if (f.free) {
      strokeMarks(ctx, [f.free], project, sc);
      continue;
    }
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
    if (f.marks) strokeMarks(ctx, f.marks, project, sc);
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

/** Marks stroked (or dotted) as their part's face is drawn, each in its colour, width and dash. */
function strokeMarks(
  ctx: CanvasRenderingContext2D,
  marks: readonly Mark[],
  project: (p: V3) => [number, number],
  sc: number,
): void {
  for (const m of marks) {
    ctx.beginPath();
    if (m.dots) {
      const r = Math.max(0.6, m.width * sc);
      for (const line of m.lines)
        for (const p of line) {
          const [x, y] = project(p);
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, Math.PI * 2);
        }
      ctx.globalAlpha = m.alpha;
      ctx.fillStyle = css(m.color);
      ctx.fill();
      ctx.lineWidth = Math.max(0.5, 0.35 * sc);
      ctx.strokeStyle = css(m.color, 0.45);
      ctx.stroke();
      continue;
    }
    for (const line of m.lines)
      line.forEach((p, i) => {
        const [x, y] = project(p);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
        if (m.closed && i === line.length - 1) ctx.closePath();
      });
    ctx.globalAlpha = m.alpha;
    ctx.strokeStyle = css(m.color);
    ctx.lineWidth = Math.max(0.5, m.width * sc);
    if (m.dash) ctx.setLineDash([2.4 * sc, 2 * sc]);
    ctx.stroke();
    if (m.dash) ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;
}

/** A picture at least this many CSS pixels across is drawn at the fine level, unless asked otherwise. */
export const FINE_FROM = 120;

/** The parts of a portrait being drawn, at each level: kept by the portrait while it is drawn (its window open), let go with it. */
const PARTS = new WeakMap<object, { fine?: SpecimenPart[]; coarse?: SpecimenPart[] }>();
function partsOf(p: Portrait, fine: boolean): SpecimenPart[] {
  let e = PARTS.get(p);
  if (!e) PARTS.set(p, (e = {}));
  return fine ? (e.fine ??= specimenParts(p, true)) : (e.coarse ??= specimenParts(p, false));
}

/**
 * A specimen drawn into the box of a context (CSS pixels) as it stands at `t` seconds: at the fine level where the box is large (or
 * where asked), else as a thumbnail's parts.
 */
export function drawSpecimen(
  ctx: CanvasRenderingContext2D,
  p: Portrait,
  box: { x: number; y: number; w: number; h: number },
  t: number,
  detail?: "fine" | "coarse",
): void {
  const fine = detail ? detail === "fine" : Math.min(box.w, box.h) >= FINE_FROM,
    parts = partsOf(p, fine);
  if (parts.length) paint(ctx, parts, poseOf(p, t), box, t, false);
}

/** How a thumbnail looks at a specimen: a three-quarter view, a garment nearly face on. */
function thumbPose(p: Portrait): Pose {
  return p.kind === "thing" && FLAT.has(p.form)
    ? { ...poseOf(p, 0), turn: 0.22, tilt: 0.12 }
    : { ...poseOf(p, 0), turn: 0.6, tilt: 0.35 };
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
    if (parts.length) paint(g, parts, thumbPose(p), { x: 0, y: 0, w: size, h: size }, 0, true);
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
