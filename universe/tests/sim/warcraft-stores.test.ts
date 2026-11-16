// The sieges, the fleets and the arming keep a few numbers a siege, a realm or a war at sea. Each is dormant while it holds
// nothing, comes back from a save as it was, hashing the same, and lets a row go (sim/war/siege.ts, navy.ts, arming.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { Hasher, type Ref } from "../../src/kernel/index.ts";
import { SiegeStore } from "../../src/sim/war/siege.ts";
import { NavyStore } from "../../src/sim/war/navy.ts";
import { ArmingStore, type Footing } from "../../src/sim/war/arming.ts";

const hex = (s: { hashInto(h: Hasher): void }) => {
  const h = new Hasher();
  s.hashInto(h);
  return h.hex();
};

test("a siege is kept while laid, saved and loaded whole, and let go", () => {
  const store = new SiegeStore();
  assert.ok(store.dormant());
  store.set({
    war: "war:w:7" as Ref,
    seat: 12,
    since: 400,
    months: 9.5,
    breach: 0.25,
    campDead: 1200,
    townDead: 300,
    relief: 0.4,
    event: "ev:e:3" as Ref,
  });
  assert.ok(!store.dormant());
  const again = new SiegeStore();
  again.load(JSON.parse(JSON.stringify(store.save())));
  assert.equal(hex(again), hex(store));
  assert.deepEqual(again.of("war:w:7" as Ref), store.of("war:w:7" as Ref));
  assert.deepEqual(store.pinned(), ["ev:e:3"]);
  store.end("war:w:7" as Ref);
  assert.ok(store.dormant());
});

test("a fleet and a war at sea come back from a save as they were", () => {
  const store = new NavyStore();
  assert.ok(store.dormant());
  store.set({
    realm: "pol:r:2" as Ref,
    tons: 12_000,
    built: 800,
    sunk: 0,
    wanted: 15_000,
    quality: 1.4,
    merchant: 3000,
    coast: 0.6,
    blockaded: 0.2,
    cost: 50_000,
  });
  store.setSea({
    war: "war:w:9" as Ref,
    command: [0.7, 0.3],
    sunk: [400, 1600],
    won: null,
    blockade: "ev:e:11" as Ref,
  });
  const again = new NavyStore();
  again.load(JSON.parse(JSON.stringify(store.save())));
  assert.equal(hex(again), hex(store));
  assert.deepEqual(again.sea("war:w:9" as Ref), store.sea("war:w:9" as Ref));
  assert.deepEqual(store.pinned(), ["ev:e:11"]);
  // (A different row hashes differently.)
  const other = new NavyStore();
  other.load(JSON.parse(JSON.stringify(store.save())));
  other.set({ ...store.of("pol:r:2" as Ref)!, tons: 11_000 });
  assert.notEqual(hex(other), hex(store));
});

test("a realm's footing is kept, saved and loaded whole, and let go", () => {
  const store = new ArmingStore(),
    row: Footing = {
      realm: "pol:r:4" as Ref,
      footing: 0.05,
      wanted: 0.08,
      against: "pol:r:5" as Ref,
      threat: 0.6,
      ratio: 1.3,
      fatigue: 2.1,
      war: null,
      backs: "war:w:2" as Ref,
      helps: "pol:r:6" as Ref,
      sends: 0.01,
      gift: 0,
      made: 900_000,
      race: "ev:e:21" as Ref,
      backed: null,
    };
  assert.ok(store.dormant());
  store.set(row);
  const again = new ArmingStore();
  again.load(JSON.parse(JSON.stringify(store.save())));
  assert.equal(hex(again), hex(store));
  assert.deepEqual(again.of(row.realm), row);
  assert.deepEqual(store.pinned(), ["ev:e:21"]);
  store.drop(row.realm);
  assert.ok(store.dormant());
});
