// Tests for the ship looks (Phase 67): the hull shapes, how two fleets are told apart, the triangle
// budgets, the geometry's own invariants (sizes, normals, winding, the same bytes twice), and the
// ship names and refs.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { FightSide } from "../../src/bridge/index.ts";
import { CLADES, hullOf } from "../../src/rules/index.ts";
import {
  archetypeOf,
  fleetLook,
  fleetLooks,
  flameGeometry,
  shipGeometry,
  shipName,
  shipRef,
  wreckGeometry,
  type Archetype,
  type FleetLook,
  type ShipClassName,
  type ShipGeometry,
} from "../../src/view/shiplook.ts";

type Vec = readonly [number, number, number];

const ARCHETYPES: readonly Archetype[] = ["dart", "spindle", "slab", "manta", "disc"];
const CLASSES: readonly ShipClassName[] = ["capital", "line", "escort", "platform", "lander"];
const BUDGET: Record<ShipClassName, number> = {
  capital: 200,
  line: 110,
  escort: 50,
  platform: 120,
  lander: 140,
};
const ZERO: Vec = [0, 0, 0];

const side = (over: Partial<FightSide> = {}): FightSide => ({
  ref: "pol:test",
  kind: "realm",
  name: "Testia",
  words: "a realm for the tests",
  color: [0.8, 0.2, 0.2],
  strength: 1,
  machines: null,
  gravity: 0.95,
  medium: "land",
  clade: null,
  drive: "fusion",
  arm: "beam",
  beamArm: "beam-rifle",
  minds: false,
  sky: "fleet",
  ...over,
});

/** Every look a fight can make: each shape, each arm, with and without minds. */
const looks = (): FleetLook[] => {
  const out: FleetLook[] = [];
  for (const archetype of ARCHETYPES) {
    for (const arm of ["beam", "missile"] as const) {
      for (const minds of [false, true]) out.push(fleetLook(side({ arm, minds }), archetype));
    }
  }
  return out;
};

/** Every geometry one look draws, by name. */
const everything = (look: FleetLook): [string, ShipGeometry][] => [
  ...CLASSES.map((cls): [string, ShipGeometry] => [cls, shipGeometry(look, cls)]),
  ["wreck 0", wreckGeometry(look, 0)],
  ["wreck 1", wreckGeometry(look, 1)],
  ["flame", flameGeometry()],
];

/** A typed array read as triples (positions or normals). */
const triples = (a: ArrayLike<number>): Vec[] => {
  const out: Vec[] = [];
  for (let i = 0; i + 2 < a.length; i += 3) {
    out.push([a[i] ?? NaN, a[i + 1] ?? NaN, a[i + 2] ?? NaN]);
  }
  return out;
};
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The exact bytes of a geometry. */
const bytesOf = (g: ShipGeometry): Buffer =>
  Buffer.concat(
    [g.positions, g.normals, g.colors, g.indices].map((a) =>
      Buffer.from(a.buffer, a.byteOffset, a.byteLength),
    ),
  );

/** The hue in degrees by the standard angle formula, an independent check on the module's own. */
const hueDeg = (c: Vec): number => {
  const deg = (Math.atan2(Math.sqrt(3) * (c[1] - c[2]), 2 * c[0] - c[1] - c[2]) * 180) / Math.PI;
  return (deg + 360) % 360;
};

test("archetypeOf: pull picks a realm's hull, the body a people's, and a wet world is manta", () => {
  // (A people's hull is read from its body by what it does: rules/bodies.ts hullOf.)
  const hull = (id: string) => hullOf(CLADES.find((c) => c.id === id)!.body as never);
  assert.equal(archetypeOf(side({ gravity: 0.95 })), "dart");
  assert.equal(archetypeOf(side({ gravity: 0.5 })), "spindle");
  assert.equal(archetypeOf(side({ gravity: 1.5 })), "slab");
  assert.equal(archetypeOf(side({ medium: "water" })), "manta");
  assert.equal(archetypeOf(side({ kind: "people", clade: hull("trunk") })), "slab");
  assert.equal(archetypeOf(side({ kind: "people", clade: hull("burrower") })), "disc");
});

test("fleetLooks: two realms of the same pull still take different shapes", () => {
  const [a, d] = fleetLooks(side(), side({ ref: "pol:other" }));
  assert.notEqual(a.archetype, d.archetype);
});

test("fleetLooks: fleets of one colour get accents at least 50 degrees apart", () => {
  const [a, d] = fleetLooks(side({ color: [0.8, 0.2, 0.2] }), side({ color: [0.8, 0.2, 0.2] }));
  const gap = Math.abs(hueDeg(a.accent) - hueDeg(d.accent));
  assert.ok(Math.min(gap, 360 - gap) >= 50, `gap ${gap}`);
});

test("every look stays inside its triangle budget", () => {
  for (const look of looks()) {
    const tag = `${look.archetype} arm ${look.arm} minds ${look.minds}`;
    for (const cls of CLASSES) {
      assert.ok(shipGeometry(look, cls).triangles <= BUDGET[cls], `${tag} ${cls}`);
    }
    for (const part of [0, 1] as const) {
      assert.ok(wreckGeometry(look, part).triangles <= 96, `${tag} wreck ${part}`);
    }
    assert.equal(flameGeometry().triangles, 6);
  }
});

test("each geometry's arrays agree in length, and every index is in range", () => {
  for (const look of looks()) {
    for (const [name, g] of everything(look)) {
      const vertices = g.positions.length / 3;
      assert.equal(g.normals.length / 3, vertices, name);
      assert.equal(g.colors.length / 4, vertices, name);
      for (const i of g.indices) assert.ok(i < vertices, name);
      assert.equal(g.triangles, g.indices.length / 3, name);
    }
  }
});

test("capital, line, escort, lander and platform run exactly from z -0.5 to 0.5", () => {
  for (const look of looks()) {
    for (const cls of CLASSES) {
      const z = triples(shipGeometry(look, cls).positions).map((p) => p[2]);
      const tag = `${look.archetype} ${cls}`;
      assert.ok(Math.abs(Math.min(...z) + 0.5) < 0.001, tag);
      assert.ok(Math.abs(Math.max(...z) - 0.5) < 0.001, tag);
    }
  }
});

test("normals are unit length and never NaN", () => {
  for (const look of looks()) {
    for (const [name, g] of everything(look)) {
      for (const n of triples(g.normals)) {
        assert.ok(n.every(Number.isFinite), name);
        assert.ok(Math.abs(Math.hypot(n[0], n[1], n[2]) - 1) < 1e-5, name);
      }
    }
  }
});

test("triangles wind counter-clockwise from outside (dart capital)", () => {
  const g = shipGeometry(fleetLook(side(), "dart"), "capital");
  const pos = triples(g.positions);
  const nrm = triples(g.normals);
  const idx = Array.from(g.indices);
  assert.ok(idx.length > 0);
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const [ia = 0, ib = 0, ic = 0] = [idx[t], idx[t + 1], idx[t + 2]];
    const face = cross(
      sub(pos[ib] ?? ZERO, pos[ia] ?? ZERO),
      sub(pos[ic] ?? ZERO, pos[ia] ?? ZERO),
    );
    for (const i of [ia, ib, ic]) {
      assert.ok(dot(face, nrm[i] ?? ZERO) > 0, `triangle ${t / 3}, vertex ${i}`);
    }
  }
});

test("the same look draws the same bytes; a new shape, arm or minds draws new ones", () => {
  const dart = shipGeometry(fleetLook(side(), "dart"), "capital");
  const again = shipGeometry(fleetLook(side(), "dart"), "capital");
  assert.ok(bytesOf(dart).equals(bytesOf(again)));
  const slab = shipGeometry(fleetLook(side(), "slab"), "capital");
  assert.ok(!bytesOf(dart).equals(bytesOf(slab)));
  const missile = shipGeometry(fleetLook(side({ arm: "missile" }), "dart"), "capital");
  assert.ok(!bytesOf(dart).equals(bytesOf(missile)));
  const minds = shipGeometry(fleetLook(side({ minds: true }), "dart"), "capital");
  assert.ok(!bytesOf(dart).equals(bytesOf(minds)));
});

test("ship names are stable, plain words, and varied across a fleet", () => {
  assert.equal(shipName("ev:0:1", 0, 3), shipName("ev:0:1", 0, 3));
  assert.match(shipName("ev:0:1", 0, 3), /^[A-Z][a-z]+$/);
  const names = new Set<string>();
  for (let i = 0; i < 40; i++) names.add(shipName("ev:0:1", 0, i));
  assert.ok(names.size >= 20, `${names.size} distinct names`);
});

test("shipRef carries the fight with dots, the side, index, class, broke flag and name", () => {
  const ref = shipRef("ev:0:364215", 0, 3, 1, true);
  assert.ok(ref.startsWith("ship:ev.0.364215:0:3:1:1:"), ref);
  assert.equal(ref, `ship:ev.0.364215:0:3:1:1:${shipName("ev:0:364215", 0, 3)}`);
});
