// Figures on the ground and out of one another (view/footing.ts; asked 2026-11-26: "why are aliens in the ground!!!"): a
// posed part's reach below its middle against the meshes it is drawn from, vertex by vertex; every figure render/folk.ts
// poses, of every kind of body, standing, striding, at work, sat or lying, set with its lowest point on the ground given it;
// the ground's tops read off what is laid; and drawn figures stepped out of one another.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as pc from "playcanvas";
import {
  FIGURE_CAPSULE,
  GroundTops,
  SHAPE_CODE,
  Spread,
  feetTally,
  figureOf,
  framesMeet,
  groundPlaces,
  partFrame,
  restBody,
  lowestOf,
  lyingLift,
  partBelow,
  placeBelow,
  personGroup,
  GROUP_COLORS,
  type FigureBody,
  type Moment,
  type PartShape,
} from "../../src/view/index.ts";
import { FolkPoses, type FolkBatch } from "../../src/render/folk.ts";

/** A mesh's points as render/batch.ts makes it, about its own middle. */
const MESHES: Record<PartShape, Float32Array | number[]> = {
  box: new pc.BoxGeometry({ halfExtents: new pc.Vec3(0.5, 0.5, 0.5) }).positions,
  cylinder: new pc.CylinderGeometry({ radius: 0.5, height: 1, heightSegments: 1, capSegments: 8 })
    .positions,
  cone: new pc.ConeGeometry({
    baseRadius: 0.5,
    peakRadius: 0,
    height: 1,
    heightSegments: 1,
    capSegments: 8,
  }).positions,
  capsule: new pc.CapsuleGeometry({
    radius: FIGURE_CAPSULE.radius,
    height: FIGURE_CAPSULE.height,
    sides: 8,
  }).positions,
};

test("a part's reach below its middle is its mesh's, however it is sized and pitched", () => {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const shape of ["box", "cylinder", "cone", "capsule"] as const) {
    const points = MESHES[shape],
      // (A round mesh of eight sides reaches a little short of the round it is drawn for: its sides' middles.)
      spare = shape === "box" ? 1e-9 : 0.08;
    for (let n = 0; n < 400; n++) {
      const sy = 0.02 + rand() * 0.4,
        sz = 0.02 + rand() * 0.4,
        pitch = (rand() - 0.5) * 2 * Math.PI,
        m5 = Math.cos(pitch) * sy,
        m9 = -Math.sin(pitch) * sz;
      let below = 0;
      for (let k = 0; k < points.length; k += 3)
        below = Math.max(below, -(m5 * points[k + 1]! + m9 * points[k + 2]!));
      const ours = partBelow(SHAPE_CODE[shape], m5, m9);
      // (Never less than the mesh reaches: nothing of it is drawn under the ground it is set on.)
      assert.ok(ours >= below - 1e-9, `${shape}: ${ours} against the mesh's ${below}`);
      assert.ok(
        ours <= below + spare * Math.max(sy, sz),
        `${shape}: ${ours} against the mesh's ${below}`,
      );
      assert.ok(Math.abs(placeBelow(SHAPE_CODE[shape], sy, sz, pitch) - ours) < 1e-12);
    }
  }
});

/** Bodies of every stance the figures are built for, Earth's apes among them. */
const BODIES: (FigureBody | null)[] = [
  null,
  {
    clade: "c",
    medium: "land",
    symmetry: "bilateral",
    manipulators: "trunk",
    limbs: 4,
    skin: "scales",
    size: 7,
    legs: 4,
    wings: 0,
    moves: "climb",
  },
  {
    clade: "c",
    medium: "water",
    symmetry: "bilateral",
    manipulators: "mandibles",
    limbs: 6,
    skin: "shell",
    size: 28,
    legs: 6,
    wings: 0,
    moves: "crawl",
  },
  {
    clade: "c",
    medium: "water",
    symmetry: "bilateral",
    manipulators: "claws",
    limbs: 2,
    skin: "shell",
    size: 168,
    legs: 2,
    wings: 0,
    moves: "crawl",
  },
  {
    clade: "c",
    medium: "land",
    symmetry: "bilateral",
    manipulators: "hands",
    limbs: 4,
    skin: "scales",
    size: 46,
    legs: 4,
    wings: 0,
    moves: "walk",
  },
  {
    clade: "c",
    medium: "water",
    symmetry: "radial",
    manipulators: "tentacles",
    limbs: 8,
    skin: "skin",
    size: 40,
  },
  {
    clade: "c",
    medium: "land",
    symmetry: "bilateral",
    manipulators: "beak",
    limbs: 2,
    skin: "feathers",
    size: 30,
  },
];

class Kept implements FolkBatch {
  drawn = new Float32Array(0);
  setMatrices(count: number, write: (m: Float32Array) => void): void {
    this.drawn = new Float32Array(count * 16);
    write(this.drawn);
  }
}

test("every figure posed stands with its lowest point on the ground under it: standing, striding, at work, sat, lying", () => {
  const tasks = [null, "hoe", "play", "knap", "dance", "pray", "bear"] as const;
  for (const body of BODIES) {
    for (const detail of [0, 2]) {
      const figure = figureOf(body, detail),
        P = figure.parts.length,
        n = 28,
        people = Array.from({ length: n }, (_, i) => ({
          ref: `p${i}`,
          name: `p${i}`,
          age: 30,
          child: i % 9 === 4,
        })),
        plan = { people, body, era: 0 } as never,
        poses = new FolkPoses(),
        batches = GROUP_COLORS.map(() => figure.parts.map(() => new Kept())),
        groups = people.map((p) => personGroup(p as never)),
        ground = Float32Array.from(people, (_, i) => (i % 3) * 0.031),
        downed = new Set([3, 11]);
      for (let frame = 0; frame < 30; frame++) {
        const moments: Moment[] = people.map((_, i) => ({
          x: i * 3,
          z: (i % 5) * 2,
          yaw: i * 0.7 + frame * 0.05,
          activity: i % 2 ? 1 : 0,
          task: i % 2 ? null : tasks[(i / 2) % tasks.length]!,
          hidden: false,
          hunger: 0,
          tiredness: 0,
          carry: null,
          why: null,
          ...(i % 4 === 1 ? { reach: 0.8 } : {}),
        }));
        poses.pose({
          plan,
          figure,
          moments,
          sizes: people.map(() => 1),
          strides: people.map((_, i) => frame * 0.13 + i),
          gear: people.map(() => null),
          clock: 3 + frame / 20,
          dt: 1 / 30,
          downed,
          kept: null,
          people: batches,
          hair: figure.parts.map(() => null),
          eye: { x: 0, y: 30, z: 0 },
          near: Infinity,
          ground,
        });
        // (Each group's batches hold its own, in the people's order.)
        const all = new Float32Array(n * P * 16);
        batches.forEach((parts, gi) => {
          const who = people.flatMap((_, i) => (groups[i] === gi ? [i] : []));
          parts.forEach((b, pi) =>
            who.forEach((i, k) =>
              all.set(b.drawn.subarray(k * 16, k * 16 + 16), (i * P + pi) * 16),
            ),
          );
        });
        const codes = figure.parts.map((p) => SHAPE_CODE[p.shape]);
        moments.forEach((m, i) => {
          const lowest = lowestOf(all, i * P * 16, P, codes),
            hop = downed.has(i)
              ? 0
              : m.task === "play" || m.task === "dance"
                ? 0.04 * figure.scale
                : 0;
          assert.ok(
            lowest >= ground[i]! - 1e-6 && lowest <= ground[i]! + hop + 1e-6,
            `${body?.manipulators ?? "ape"} d${detail} #${i} ${m.task ?? (m.activity ? "walking" : "standing")}${downed.has(i) ? " lying" : ""}: lowest ${lowest} on ${ground[i]}`,
          );
        });
      }
    }
  }
});

test("a figure laid as places is set on its ground; one lying flat is lifted clear of it", () => {
  const figure = figureOf(BODIES[1]!, 2),
    codes = figure.parts.map((p) => SHAPE_CODE[p.shape]),
    laid: number[] = [];
  figure.parts.forEach((p) => laid.push(p.x, p.y - 0.3, p.z, p.sx, p.sy, p.sz, 0, 0));
  groundPlaces(laid, 0, figure.parts.length, codes, 0.5);
  let lo = Infinity;
  figure.parts.forEach(
    (p, k) => (lo = Math.min(lo, laid[k * 8 + 1]! - placeBelow(codes[k]!, p.sy, p.sz, 0))),
  );
  assert.ok(Math.abs(lo - 0.5) < 1e-12);
  // (Flat on its back, each part's middle its forward reach up: the low body's hind parts would lie under the ground.)
  const s = 0.4,
    lift = lyingLift(figure.parts, s);
  let low = Infinity;
  for (const p of figure.parts)
    low = Math.min(
      low,
      lift + p.z * s - placeBelow(SHAPE_CODE[p.shape], p.sy * s, p.sz * s, Math.PI / 2),
    );
  assert.ok(Math.abs(low) < 1e-12 && lift > 0.04, `lift ${lift}, lowest ${low}`);
});

test("the ground's tops are read off what is laid: the highest stepped onto, and what rises higher stood about", () => {
  const tops = new GroundTops([
    { x: 0, y: 0.22, z: 0, sx: 30, sy: 0.36, sz: 30, yaw: 0, round: true },
    { x: 40, y: 0.18, z: 0, sx: 20, sy: 0.24, sz: 6, yaw: Math.PI / 4, round: false },
    { x: 40, y: 0.415, z: 0, sx: 4, sy: 0.03, sz: 2, yaw: Math.PI / 4, round: false },
    { x: 0, y: 0.5, z: 0, sx: 2.4, sy: 1, sz: 2.4, yaw: 0, round: true },
    { x: 0, y: 30, z: 0, sx: 4, sy: 2, sz: 4, yaw: 0, round: false },
  ]);
  assert.ok(Math.abs(tops.topAt(5, 5) - 0.4) < 1e-9, "on the square");
  assert.equal(tops.topAt(16, 0), -Infinity, "past it");
  // (The street turned a quarter: its length along the diagonal.)
  const d = 7 / Math.SQRT2;
  assert.ok(Math.abs(tops.topAt(40 + d, -d) - 0.3) < 1e-9, "along the turned street");
  assert.equal(tops.topAt(40 + d, d), -Infinity, "across it, off it");
  assert.ok(Math.abs(tops.topAt(40, 0) - 0.43) < 1e-9, "on the worn way over it");
  // The well's curb stands in the way; a roof thirty metres up does not.
  assert.ok(tops.tallDepth(0, 0, 0.3) > 1, "in the well");
  const p = { x: 0.2, z: 0.1 };
  assert.ok(tops.pushOut(p, 0.3));
  assert.ok(
    Math.abs(Math.hypot(p.x, p.z) - 1.5) < 1e-9,
    `out to its curb and a body's reach: ${Math.hypot(p.x, p.z)}`,
  );
  assert.equal(tops.laid.tall, 1);
});

test("a town's plain ground out to the haze is read without filling the cells (a city's brought the page down)", () => {
  const tops = new GroundTops([
    { x: 0, y: 0.005, z: 0, sx: 40_000, sy: 0.01, sz: 40_000, yaw: 0, round: true },
    { x: 3, y: 0.1, z: 3, sx: 2, sy: 0.2, sz: 2, yaw: 0, round: false },
  ]);
  assert.ok(Math.abs(tops.topAt(9_000, -9_000) - 0.01) < 1e-9);
  assert.ok(Math.abs(tops.topAt(3, 3) - 0.2) < 1e-9);
  assert.equal(tops.laid.flat, 2);
});

test("drawn figures are stepped out of one another, a knot on one spot opened every way", () => {
  const n = 120,
    xs = new Float64Array(n),
    zs = new Float64Array(n),
    rs = new Float32Array(n),
    live = new Uint8Array(n).fill(1);
  for (let i = 0; i < n; i++) {
    xs[i] = (i % 6) * 0.2;
    zs[i] = Math.floor(i / 40) * 0.3;
    rs[i] = i % 7 ? 0.35 : 0.6;
  }
  live[5] = 0;
  const spread = new Spread(),
    x5 = xs[5],
    z5 = zs[5];
  for (let frame = 0; frame < 60; frame++) spread.spread(xs, zs, rs, live, n);
  let worst = 0;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (!live[i] || !live[j]) continue;
      worst = Math.max(worst, rs[i]! + rs[j]! - Math.hypot(xs[i]! - xs[j]!, zs[i]! - zs[j]!));
    }
  assert.ok(worst < 0.02, `the deepest two stand in each other ${worst} m`);
  assert.equal(xs[5], x5);
  assert.equal(zs[5], z5);
});

/** A box's matrix: middle, sizes, turned about the upright by `yaw` (as the figures' parts are drawn). */
function boxAt(x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw: number) {
  const m = new pc.Mat4().setTRS(
    new pc.Vec3(x, y, z),
    new pc.Quat().setFromEulerAngles(0, (yaw * 180) / Math.PI, 0),
    new pc.Vec3(sx, sy, sz),
  );
  const f = new Float32Array(12);
  partFrame(m.data, 0, f, 0);
  return f;
}

test("two parts are in one another as drawn, turned: not by the boxes about them", () => {
  const a = boxAt(0, 0, 0, 1, 1, 1, 0);
  assert.equal(framesMeet(a, 0, boxAt(1.2, 0, 0, 1, 1, 1, 0), 0, 1), false, "a gap between");
  assert.equal(framesMeet(a, 0, boxAt(1.2, 0, 0, 1, 1, 1, Math.PI / 4), 0, 1), true, "a corner in");
  // Two rods along the diagonal side by side: their boxes about the world's axes overlap, the rods do not.
  const rod = (x: number, z: number) => boxAt(x, 0, z, 0.1, 0.1, 2, Math.PI / 4);
  assert.equal(framesMeet(rod(0, 0), 0, rod(0.3, -0.3), 0, 1), false);
  assert.equal(framesMeet(rod(0, 0), 0, rod(0.03, -0.03), 0, 1), true);
  // The count: two figures of a part each, side by side and then crossed.
  const figure = (x: number, yaw: number) => {
    const frames = boxAt(x, 0.5, 0, 0.1, 1, 2, yaw),
      boxes = new Float32Array(6);
    boxes.set([x, 0.5, 0, 1, 0.5, 1]);
    return { boxes, frames, lowest: 0, surface: 0, x, z: 0, lying: false };
  };
  assert.equal(feetTally([figure(0, 0), figure(0.3, 0)], 1, 0.02, null, []).pairs, 0);
  const crossed = feetTally([figure(0, 0), figure(0.3, Math.PI / 2)], 1, 0.02, null, []);
  assert.equal(crossed.pairs, 1);
  assert.deepEqual(crossed.met[0], { i: 0, j: 1, apart: 0.3 });
});

test("a body's round is about the middle of what its parts cover, not where it stands", () => {
  // (A long body standing on its fore legs: its tail far behind.)
  const b = restBody([
    { x: 0, z: 0, sx: 0.4, sz: 0.4 },
    { x: 0, z: -1, sx: 0.2, sz: 1.2 },
  ]);
  assert.ok(Math.abs(b.x) < 1e-12 && Math.abs(b.z - -0.7) < 1e-12, `middle ${b.x}, ${b.z}`);
  assert.ok(Math.abs(b.r - (0.7 + Math.hypot(0.4, 0.4) / 2)) < 1e-12, `round ${b.r}`);
});
