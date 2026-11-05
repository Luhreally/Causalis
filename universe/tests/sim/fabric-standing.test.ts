// Phase 66: a save read back reads each town's homes and open lots by the spans its runs cut, not lot by lot.
// It must tell exactly what the lots tell.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TownBuilder,
  civicMask,
  levelsOf,
  readStanding,
  type Fabric,
} from "../../src/sim/town/fabric.ts";

/** What the lots themselves tell, one at a time. */
function byLots(f: Fabric): { homes: number[]; open: number[][] } {
  const levels = levelsOf(f, 0, f.next),
    under = civicMask(f, 0, f.next),
    homes = f.homes.map(() => 0),
    open: number[][] = [];
  for (let p = 0; p < f.next; p++) {
    if (levels[p]! >= 0) homes[levels[p]!]!++;
    if (levels[p]! >= 0 || under[p]) continue;
    const last = open.at(-1);
    if (last && last[1] === p) last[1] = p + 1;
    else open.push([p, p + 1]);
  }
  return { homes, open };
}

/** A small generator of its own: the same fabrics each time. */
function randomFrom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

test("homes and open lots read by spans are what the lots tell, run over run, buildings over all", () => {
  for (let seed = 1; seed <= 400; seed++) {
    const r = randomFrom(seed),
      next = Math.floor(r() * 400),
      runs = Math.floor(r() * 30),
      standing = Math.floor(r() * 6);
    const f = {
      next,
      homes: [0, 0, 0, 0, 0, 0, 0],
      open: [],
      changes: Array.from({ length: runs }, () => {
        const a = Math.floor(r() * (next + 20)),
          b = a + Math.floor(r() * 60);
        // (A run that is no home's, and runs past the lots taken, are in the fixture on purpose.)
        return [r() < 0.15 ? 99 : 0, a, b, 0, 1, Math.floor(r() * 7), 0];
      }),
      civics: Array.from({ length: standing }, () => ({
        kind: "market",
        at: Math.floor(r() * (next + 5)),
        lots: 1 + Math.floor(r() * 12),
        start: 0,
        end: 1,
        fell: r() < 0.3 ? 5 : null,
      })),
    } as unknown as Fabric;
    const want = byLots(f);
    readStanding(f);
    assert.deepEqual([...f.homes], want.homes, `homes of fabric ${seed}`);
    assert.deepEqual(f.open, want.open, `open lots of fabric ${seed}`);
  }
});

test("a building's place about the square is the first free stretch the lots tell of", () => {
  const store = Object.create(TownBuilder.prototype) as TownBuilder;
  for (let seed = 1; seed <= 400; seed++) {
    const r = randomFrom(seed),
      next = Math.floor(r() * 300),
      lots = 1 + Math.floor(r() * 9),
      f = {
        next,
        civics: Array.from({ length: Math.floor(r() * 12) }, () => ({
          at: Math.floor(r() * (next + 10)),
          lots: 1 + Math.floor(r() * 10),
          fell: r() < 0.25 ? 3 : null,
        })),
      } as unknown as Fabric,
      under = civicMask(f, 0, next);
    let want = -1;
    for (let p = 0; p < next && want < 0; p += lots) {
      let free = true;
      for (let q = p; q < Math.min(p + lots, next) && free; q++) free = !under[q];
      if (free) want = p;
    }
    if (want >= 0) assert.equal(store.siteFor(f, lots, "core"), want, `fabric ${seed}`);
    // (Nowhere free: past its last lot, as at the edge.)
    else
      assert.equal(
        store.siteFor(f, lots, "core"),
        store.siteFor(f, lots, "edge"),
        `fabric ${seed}`,
      );
  }
});

test("a town with no lots taken has no homes and no open lots", () => {
  const f = { next: 0, homes: [0, 0], open: [], changes: [], civics: [] } as unknown as Fabric;
  readStanding(f);
  assert.deepEqual(f.homes, [0, 0]);
  assert.deepEqual(f.open, []);
});
