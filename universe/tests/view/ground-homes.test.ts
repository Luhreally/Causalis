// The homes about a walker found by the ground's cells (Phase 60): kept out of them, and asked if
// clear of them, exactly as by walking every home — the same point, bit for bit — where homes stand
// apart, in rows, and so close that out of one is into the next.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clearAt,
  clearOf,
  keepOut,
  pushOut,
  type Ground,
  type Solid,
} from "../../src/view/ground.ts";

/** Walking every home, as keepOut did before the cells. */
function keepOutByAll(ground: Ground, p: { x: number; z: number }, reach: number): void {
  for (let pass = 0; pass < 3; pass++) {
    const x = p.x,
      z = p.z;
    if (ground.lake) pushOut(ground.lake, p, reach);
    if (p.x * p.x + p.z * p.z < (ground.homesReach + reach) ** 2) {
      for (const h of ground.homes) pushOut(h, p, reach);
      ground.town?.keepOut(p, reach);
    }
    if (p.x === x && p.z === z) return;
  }
}
function clearByAll(ground: Ground, p: { x: number; z: number }, reach: number): boolean {
  if (ground.lake && clearOf(ground.lake, p) < reach) return false;
  for (const h of ground.homes) if (clearOf(h, p) < reach) return false;
  return true;
}

let seed = 7;
const u = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;

/** A town's lots in rows, a village's homes scattered, and a knot of homes on one another. */
function groundOf(kind: "lots" | "homes" | "knot"): Ground {
  const homes: Solid[] = [];
  if (kind === "lots")
    for (let row = -6; row <= 6; row++)
      for (let k = -10; k <= 10; k++) {
        const yaw = row % 2 ? 0 : Math.PI / 2;
        homes.push({
          x: k * 9 + (row % 3) * 0.5,
          z: row * 15,
          r: 0,
          ax: Math.cos(yaw),
          az: -Math.sin(yaw),
          half: 4.4,
          across: 6.2,
        });
      }
  else
    for (let k = 0; k < (kind === "knot" ? 60 : 300); k++) {
      const a = u() * 2 * Math.PI,
        far = kind === "knot" ? u() * 9 : 8 + u() * 140,
        yaw = u() * Math.PI,
        round = u() < 0.25;
      homes.push({
        x: Math.cos(a) * far,
        z: Math.sin(a) * far,
        r: 1.5 + u() * 3,
        ax: Math.cos(yaw),
        az: -Math.sin(yaw),
        half: round ? 0 : u() * 4,
      });
    }
  let reach = 0;
  for (const h of homes)
    reach = Math.max(reach, Math.hypot(h.x, h.z) + h.r + Math.hypot(h.half ?? 0, h.across ?? 0));
  return { lake: { x: 30, z: -40, r: 12 }, homes, homesReach: reach, town: null };
}

test("a walker is kept out of the homes about it exactly as by walking every home", () => {
  let pushed = 0,
    twice = 0;
  for (const kind of ["lots", "homes", "knot"] as const) {
    const ground = groundOf(kind),
      span = kind === "knot" ? 14 : 160;
    for (let n = 0; n < 4000; n++) {
      const reach = [0.3, 0.35, 1.2, 2.4][n % 4]!,
        at = { x: (u() * 2 - 1) * span, z: (u() * 2 - 1) * span },
        mine = { ...at },
        all = { ...at };
      keepOut(ground, mine, reach);
      keepOutByAll(ground, all, reach);
      assert.ok(
        mine.x === all.x && mine.z === all.z,
        `${kind} at ${at.x}, ${at.z} (${reach}): ${mine.x}, ${mine.z} against ${all.x}, ${all.z}`,
      );
      if (mine.x !== at.x || mine.z !== at.z) pushed++;
      // (Out of one home and into the next: pushed again in the same walk.)
      const once = { ...at };
      for (const h of ground.homes) {
        const x = once.x,
          z = once.z;
        pushOut(h, once, reach);
        if ((once.x !== x || once.z !== z) && (x !== at.x || z !== at.z)) {
          twice++;
          break;
        }
      }
    }
  }
  assert.ok(pushed > 2000, `only ${pushed} pushed`);
  assert.ok(twice > 100, `only ${twice} pushed out of one home into another`);
});

test("whether a point stands clear of the homes is the same as asking every home", () => {
  for (const kind of ["lots", "homes", "knot"] as const) {
    const ground = groundOf(kind),
      span = kind === "knot" ? 14 : 160;
    let clear = 0,
      not = 0;
    for (let n = 0; n < 4000; n++) {
      const reach = [0.3, 1.2, 2.4, 6][n % 4]!,
        p = { x: (u() * 2 - 1) * span, z: (u() * 2 - 1) * span },
        mine = clearAt(ground, p, reach);
      assert.equal(mine, clearByAll(ground, p, reach), `${kind} at ${p.x}, ${p.z} (${reach})`);
      if (mine) clear++;
      else not++;
    }
    assert.ok(clear > 100 && not > 100, `${kind}: ${clear} clear, ${not} not`);
  }
});
