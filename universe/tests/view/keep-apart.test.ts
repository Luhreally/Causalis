// A town's people kept out of one another (M90) by cells made once and kept between the passes
// (Phase 60 T1): those who stepped moved in them, each cell's people in their order, so the same
// pairs are found in the same order as by cells made afresh for each pass — and each one stands
// where they stood before, bit for bit: through a town's day, in seeded crowds knotted on one spot,
// against its walls and its water, about what stands fixed, frame after frame, and far out.
import { test } from "node:test";
import assert from "node:assert/strict";
import { LAKE_R, type VillagePlan } from "../../src/bridge/index.ts";
import { clearAt, keepOut, villageGround } from "../../src/view/ground.ts";
import {
  ACTIVITY,
  BODY_R,
  PERSON_REACH,
  keepApart,
  momentOf,
  type Moment,
} from "../../src/view/village.ts";
import { DAY, townOf } from "./wounded-town.ts";

/**
 * keepApart as it was before (M90 to Phase 59): its cells made afresh for each pass. (These towns
 * raise no walls, so their ground is the village's own.)
 */
function keepApartBefore(
  plan: VillagePlan,
  moments: Moment[],
  fixed: readonly { readonly x: number; readonly z: number }[] = [],
): void {
  const ground = villageGround(plan),
    gap = 2 * BODY_R,
    want = gap * 1.06,
    live: number[] = [];
  moments.forEach((m, i) => {
    if (!m.hidden) live.push(i);
  });
  if (live.length + fixed.length < 2) return;
  const cellOf = (x: number, z: number) =>
    (Math.floor(x / gap) + 32768) * 65536 + (Math.floor(z / gap) + 32768);
  const pinned = new Map<number, number[]>();
  fixed.forEach((f, k) => {
    const key = cellOf(f.x, f.z),
      list = pinned.get(key);
    if (list) list.push(k);
    else pinned.set(key, [k]);
  });
  const moved = new Uint8Array(moments.length);
  const step = (i: number, dx: number, dz: number) => {
    const m = moments[i]!;
    m.x += dx;
    m.z += dz;
    moved[i] = 1;
  };
  const wayOf = (ax: number, az: number, d: number, key: number): [number, number] =>
    d < 1e-6 ? [Math.cos(key * 2.399963), Math.sin(key * 2.399963)] : [ax / d, az / d];
  for (let pass = 0; pass < 20; pass++) {
    const cells = new Map<number, number[]>();
    for (const i of live) {
      const m = moments[i]!,
        key = cellOf(m.x, m.z),
        list = cells.get(key);
      if (list) list.push(i);
      else cells.set(key, [i]);
    }
    let any = false;
    for (const i of live) {
      const m = moments[i]!,
        cx = Math.floor(m.x / gap),
        cz = Math.floor(m.z / gap);
      for (let ox = -1; ox <= 1; ox++)
        for (let oz = -1; oz <= 1; oz++) {
          const key = (cx + ox + 32768) * 65536 + (cz + oz + 32768);
          for (const j of cells.get(key) ?? []) {
            if (j <= i) continue;
            const o = moments[j]!,
              ax = o.x - m.x,
              az = o.z - m.z,
              d = Math.hypot(ax, az);
            if (d >= gap) continue;
            const half = (want - d) / 2,
              [ux, uz] = wayOf(ax, az, d, i * 31 + j);
            step(i, -ux * half, -uz * half);
            step(j, ux * half, uz * half);
            any = true;
          }
          for (const k of pinned.get(key) ?? []) {
            const f = fixed[k]!,
              ax = m.x - f.x,
              az = m.z - f.z,
              d = Math.hypot(ax, az);
            if (d >= gap) continue;
            const [ux, uz] = wayOf(ax, az, d, i * 31 + k + 7);
            step(i, ux * (want - d), uz * (want - d));
            any = true;
          }
        }
    }
    for (const i of live)
      if (moved[i]) {
        moved[i] = 0;
        keepOut(ground, moments[i]!, PERSON_REACH);
      }
    if (!any) return;
  }
}

let seed = 11;
const u = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;

/** One standing at (x, z), or out of sight. */
const one = (x: number, z: number, hidden = false): Moment => ({
  x,
  z,
  yaw: 0,
  activity: ACTIVITY.gathering,
  task: null,
  hidden,
  hunger: 0,
  tiredness: 0,
  carry: null,
  why: null,
});

/** The same crowd settled both ways: the same places, bit for bit (and how many stepped). */
function settled(
  plan: VillagePlan,
  crowd: readonly Moment[],
  fixed: readonly { x: number; z: number }[] = [],
  what = "",
): { now: Moment[]; stepped: number; walled: number; crossed: number } {
  const now = crowd.map((m) => ({ ...m })),
    before = crowd.map((m) => ({ ...m })),
    ground = villageGround(plan),
    cell = (m: Moment) => `${Math.floor(m.x / (2 * BODY_R))},${Math.floor(m.z / (2 * BODY_R))}`;
  keepApart(plan, now, fixed);
  keepApartBefore(plan, before, fixed);
  let stepped = 0,
    walled = 0,
    crossed = 0;
  now.forEach((m, i) => {
    const b = before[i]!,
      was = crowd[i]!;
    assert.ok(
      Object.is(m.x, b.x) && Object.is(m.z, b.z),
      `${what} ${i}: ${m.x}, ${m.z} against ${b.x}, ${b.z} as before`,
    );
    if (m.x === was.x && m.z === was.z) return;
    stepped++;
    if (!clearAt(ground, was, PERSON_REACH)) walled++;
    if (cell(m) !== cell(was)) crossed++;
  });
  return { now, stepped, walled, crossed };
}

const town = townOf(),
  // (The same homes as a village's: each its own house, round about it, no streets.)
  village: VillagePlan = { ...townOf(), ref: "town:0:44", town: undefined };

test("through a town's day each stands where cells made for each pass had them", () => {
  for (const plan of [town, village]) {
    assert.ok(!plan.life?.site, "no rising walls");
    let stepped = 0;
    for (let s = 0; s < DAY; s += 300) {
      const t = 40 * 365 * DAY + 20 * DAY + s,
        crowd = plan.people.map((_, i) => momentOf(plan, i, t));
      stepped += settled(plan, crowd, [], `${plan.ref} at ${s}`).stepped;
    }
    assert.ok(stepped > 0, `${plan.ref}: the day brings people together`);
  }
});

test("crowds knotted on one spot, by the walls and the water, settle as before", () => {
  let stepped = 0,
    walled = 0,
    crossed = 0;
  for (const plan of [town, village])
    for (let n = 0; n < 24; n++) {
      const crowd: Moment[] = [],
        fixed: { x: number; z: number }[] = [];
      for (let k = 0; k < 12; k++) {
        // About a home (into its walls), at the water's edge, on a cell's corner, or in the open.
        const home = plan.homes[Math.floor(u() * plan.homes.length)]!,
          where = k % 4,
          shore = LAKE_R + (u() - 0.5) * 4,
          way = u() * 2 * Math.PI,
          cx =
            where === 0
              ? home.x + (u() - 0.5) * 8
              : where === 1
                ? plan.water!.x + shore * Math.cos(way)
                : where === 2
                  ? Math.round((u() - 0.5) * 300) * 2 * BODY_R
                  : (u() - 0.5) * 600,
          cz =
            where === 0
              ? home.z + (u() - 0.5) * 8
              : where === 1
                ? plan.water!.z + shore * Math.sin(way)
                : where === 2
                  ? Math.round((u() - 0.5) * 300) * 2 * BODY_R
                  : (u() - 0.5) * 600,
          many = 2 + Math.floor(u() * 30),
          spread = [0, 0.2, 0.6, 1.5][Math.floor(u() * 4)]!;
        for (let q = 0; q < many; q++)
          crowd.push(
            // (A few on the very same spot: a knot opens out every way.)
            q % 5 === 0
              ? one(cx, cz, u() < 0.1)
              : one(cx + (u() - 0.5) * spread, cz + (u() - 0.5) * spread, u() < 0.1),
          );
        if (u() < 0.4) fixed.push({ x: cx + (u() - 0.5) * 0.4, z: cz + (u() - 0.5) * 0.4 });
      }
      const s = settled(plan, crowd, fixed, `${plan.ref} crowd ${n}`);
      stepped += s.stepped;
      walled += s.walled;
      crossed += s.crossed;
    }
  assert.ok(stepped > 2000, `only ${stepped} stepped`);
  assert.ok(walled > 100, `only ${walled} stepped from inside a wall's reach`);
  assert.ok(crossed > 1000, `only ${crossed} stepped into another cell`);
});

test("a crowd drawn together frame after frame settles as before every frame", () => {
  for (const plan of [town, village]) {
    const home = plan.homes[3]!,
      crowd = Array.from({ length: 300 }, () =>
        one(home.x + (u() - 0.5) * 60, home.z + (u() - 0.5) * 60, u() < 0.05),
      ),
      fixed = [
        { x: home.x + 6, z: home.z },
        { x: home.x + 6.4, z: home.z + 0.3 },
      ];
    let now = crowd,
      stepped = 0;
    for (let frame = 0; frame < 90; frame++) {
      // Each walks toward the home's door a little (and the hidden come and go).
      const next = now.map((m, i) => {
        const ax = home.x - m.x,
          az = home.z + 7 - m.z,
          d = Math.hypot(ax, az) || 1;
        return {
          ...m,
          x: m.x + (ax / d) * 0.3,
          z: m.z + (az / d) * 0.3,
          hidden: (i * 7 + frame) % 97 === 0,
        };
      });
      const s = settled(plan, next, fixed, `${plan.ref} frame ${frame}`);
      stepped += s.stepped;
      now = s.now;
    }
    assert.ok(stepped > 5000, `${plan.ref}: only ${stepped} stepped`);
  }
});

test("far out, across the cells' small keys and past them, they settle as before", () => {
  // (Within 16 384 cells of the middle a cell is keyed by a small whole number; past it, as before.)
  const edge = 16_384 * 2 * BODY_R;
  for (const [cx, cz] of [
    [edge, 0],
    [-edge, 40],
    [30, -edge],
    [edge, edge],
    [-edge - 0.35, edge + 0.35],
    [23_000, 22_937.6],
    [-23_000, -22_937.6],
  ] as const) {
    const crowd = Array.from({ length: 200 }, (_, q) =>
        one(cx + (u() - 0.5) * 3, cz + (u() - 0.5) * 3, q % 13 === 0),
      ),
      fixed = [{ x: cx, z: cz }];
    const s = settled(town, crowd, fixed, `at ${cx}, ${cz}`);
    assert.ok(s.stepped > 100 && s.crossed > 30, `at ${cx}, ${cz}: ${s.stepped}, ${s.crossed}`);
  }
});
