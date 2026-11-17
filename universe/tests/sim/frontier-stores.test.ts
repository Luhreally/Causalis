// The Frontier's stores: dormant while empty (hashed as if not there, saved as nothing), whole again after a save and a
// load, and bounded.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Hasher, type Ref } from "../../src/kernel/index.ts";
import {
  GalacticStore,
  ImpactStore,
  MindsStore,
  OrbitalStore,
  STONES_KEPT,
  STORMS_KEPT,
  WeatherStore,
  WrittenStore,
  UpliftStore,
  type Stone,
} from "../../src/sim/index.ts";

const ref = (s: string) => s as Ref;
const hashOf = (s: { hashInto(h: Hasher): void }) => {
  const h = new Hasher();
  s.hashInto(h);
  return h.hex();
};
const again = <T extends { save(): unknown; load(x: unknown): void }>(s: T, make: () => T): T => {
  const t = make();
  t.load(JSON.parse(JSON.stringify(s.save())));
  return t;
};

test("every Frontier store is dormant while empty and saves as nothing", () => {
  for (const s of [
    new WeatherStore(),
    new ImpactStore(),
    new GalacticStore(),
    new OrbitalStore(),
    new WrittenStore(),
    new MindsStore(),
    new UpliftStore(),
  ]) {
    assert.ok(s.dormant(), s.name);
    assert.deepEqual(s.save(), {}, s.name);
    assert.equal(hashOf(s), new Hasher().hex(), s.name);
  }
});

test("the weather's storms are kept to their bound and come back whole", () => {
  const w = new WeatherStore();
  for (let i = 0; i < STORMS_KEPT + 5; i++)
    w.tell({
      year: i,
      flare: 100,
      storm: 200,
      usual: 10,
      lands: 1,
      machines: 5,
      dead: 2,
      realms: [ref("polity:1")],
      event: ref(`event:${i}`),
    });
  w.hardened.set(ref("polity:1"), 3);
  assert.equal(w.storms.length, STORMS_KEPT);
  assert.equal(w.storms[0]!.year, 5);
  const back = again(w, () => new WeatherStore());
  assert.equal(hashOf(back), hashOf(w));
  assert.equal(back.hardened.get(ref("polity:1")), 3);
});

test("stones that fell or were turned are kept to their bound; those still coming all stay", () => {
  const s = new ImpactStore(),
    stone = (year: number, done: boolean): Stone => ({
      year,
      cls: "regional",
      metres: 300,
      comet: false,
      cell: 1,
      found: null,
      foundBy: null,
      foundYear: null,
      turned: null,
      struck: done ? ref(`event:${year}`) : null,
      mt: 0,
      dead: 0,
      lands: 0,
    });
  for (let y = 0; y < STONES_KEPT + 4; y++) s.stones.push(stone(y, true));
  s.stones.push(stone(999, false));
  s.trim();
  assert.equal(s.stones.length, STONES_KEPT + 1);
  assert.ok(s.stones.some((x) => x.year === 999));
  const back = again(s, () => new ImpactStore());
  assert.equal(hashOf(back), hashOf(s));
});

test("the galaxy's, the works', the written and the minds' stores come back whole", () => {
  const g = new GalacticStore();
  g.last = 30;
  g.guests.push({ year: 30, kly: 4.2, event: ref("event:1") });
  g.rogue = {
    year: 30,
    au: 4000,
    times: 1.2,
    until: 2_000_030,
    orbit: false,
    event: ref("event:9"),
  };
  assert.equal(hashOf(again(g, () => new GalacticStore())), hashOf(g));

  const o = new OrbitalStore();
  o.works.set(ref("polity:2"), {
    realm: ref("polity:2"),
    year: 10,
    begun: ref("event:2"),
    tonnes: 2000,
    sent: 0,
    tended: 10,
    last: 0,
    silent: null,
    taken: null,
  });
  o.note([1, 2, 3]);
  assert.equal(hashOf(again(o, () => new OrbitalStore())), hashOf(o));

  const w = new WrittenStore();
  w.rows.set(ref("polity:3"), {
    realm: ref("polity:3"),
    year: 5,
    event: ref("event:3"),
    limbs: null,
  });
  assert.equal(hashOf(again(w, () => new WrittenStore())), hashOf(w));

  const m = new MindsStore();
  m.rows.set(ref("polity:4"), {
    realm: ref("polity:4"),
    begun: 1,
    past: 120,
    passed: ref("event:4"),
    free: null,
  });
  m.lands.set(7, { cell: 7, up: 100, gone: null });
  m.up = 100;
  const u = new UpliftStore();
  u.add({
    realm: ref("polity:5"),
    year: 9,
    species: "species:1",
    name: "wolves",
    cell: 3,
    founders: 2000,
    event: ref("event:5"),
  });
  assert.equal(hashOf(again(u, () => new UpliftStore())), hashOf(u));
  assert.equal(u.lastOf(ref("polity:5"))!.year, 9);
  const mb = again(m, () => new MindsStore());
  assert.equal(hashOf(mb), hashOf(m));
  assert.deepEqual(mb.pinned(), m.pinned());
});
