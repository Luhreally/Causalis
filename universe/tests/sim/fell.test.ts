// The battle record (Phase 55 M224a): each side's wounded who lived and of them the maimed, what it
// bore, and its men by the land and town they came from — kept with every battle, read and never
// drawn; the towns' tallies let go after FELL_TOWN_YEARS, which changes nothing hashed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Hasher, YEAR, seedFromText } from "../../src/kernel/index.ts";
import { fellTotals, unpackTowns, type LandFell } from "../../src/rules/index.ts";
import {
  FELL_TOWN_YEARS,
  RISEN_KEPT,
  WarStore,
  armsOf,
  designsOf,
  fellOf,
  fieldOf,
  handOf,
  hostTerms,
  makePopulationWorld,
  politiesOf,
  populationContext,
  townShares,
  warsOf,
} from "../../src/sim/index.ts";

const world = makePopulationWorld(seedFromText("first light"), { start: "spread" });
world.runTo(100 * YEAR);
const ctx = populationContext(world),
  store = warsOf(world),
  battles = store.all().flatMap((w) => w.battles),
  // (The town-tally window, §0: recent battles keep their towns, old ones none; the two years
  // between depend on whether the turn at world.now has run.)
  Y = Math.floor(world.now / YEAR),
  recent = (year: number) => year >= Y - (FELL_TOWN_YEARS - 1),
  old = (year: number) => year < Y - (FELL_TOWN_YEARS + 1);
const kept = (land: LandFell) => land[4] !== undefined;
const hashOf = (s: WarStore): string => {
  const h = new Hasher();
  s.hashInto(h);
  return h.hex();
};

test("every battle keeps its wounded, its maimed, what each side bore and where its men came from", () => {
  assert.ok(battles.length >= 200, `${battles.length} battles`);
  for (const b of battles) {
    assert.ok(
      b.wounded && b.maimed && b.bore && b.fell,
      `battle ${b.event} keeps the record whole`,
    );
    assert.equal(b.wounded.length, 2);
    assert.equal(b.maimed.length, 2);
    assert.equal(b.bore.length, 2);
    assert.equal(b.fell.length, 2);
  }
});

test("each side's lands sum to its field, its fallen and its wounded; the wounds keep their bounds", () => {
  let measured = 0;
  for (const b of battles)
    for (const i of [0, 1] as const) {
      const fallen = b.fallen[i],
        field = fieldOf(b.fielded![i], fallen),
        wounded = b.wounded![i],
        maimed = b.maimed![i];
      assert.ok(fallen <= RISEN_KEPT * field + 1e-9, "no more fall than the field less a remnant");
      assert.deepEqual(fellTotals(b.fell![i]), [field, fallen, wounded], `${b.event} side ${i}`);
      for (const [, sent, dead, hurt] of b.fell![i]) {
        assert.ok(dead <= sent, "a land's dead are of those it sent");
        assert.ok(hurt <= sent - dead, "a land's wounded are of those who came back");
      }
      assert.ok(wounded >= 0 && wounded <= field - fallen, "the wounded are of those who lived");
      assert.ok(maimed >= 0 && maimed <= wounded, "the maimed are of the wounded");
      if (fallen >= 10 && wounded < field - fallen) {
        measured++;
        const wf = wounded / fallen;
        assert.ok(wf >= 1.2 - 0.05 && wf <= 4.5 + 0.05, `wounded:fallen ${wf.toFixed(3)}`);
      }
    }
  assert.ok(measured >= 50, `${measured} sides measured`);
});

test("a battle's town tallies are kept for FELL_TOWN_YEARS, its lands' for good", () => {
  let recents = 0,
    olds = 0;
  for (const b of battles) {
    const lands = [...b.fell![0], ...b.fell![1]];
    if (recent(b.year)) {
      recents++;
      // (Kept towns may be []: a land with no town, or none that sent anyone.)
      assert.ok(lands.every(kept), `the towns of ${b.event} (year ${b.year}) are kept`);
    } else if (old(b.year)) {
      olds++;
      assert.ok(!lands.some(kept), `the towns of ${b.event} (year ${b.year}) are let go`);
      // (Its lands' are kept, whole.)
      assert.ok(lands.every((l) => l.length === 4));
    }
  }
  assert.ok(recents >= 50 && olds >= 50, `${recents} recent, ${olds} old battles`);
});

test("where towns are kept, they are whole triples, of the land's towns, and its countryside is the rest", () => {
  let towns = 0;
  for (const b of battles)
    for (const side of b.fell!)
      for (const [cell, sent, dead, hurt, flat] of side) {
        if (flat === undefined) continue;
        assert.equal(flat.length % 3, 0, "whole triples");
        assert.ok(
          flat.length / 3 <= ctx.settlements.inProvince(cell).length,
          "no more towns than the land has",
        );
        const each = unpackTowns(flat);
        let s = 0,
          d = 0,
          h = 0;
        for (const [ts, td, th] of each) {
          assert.ok(td <= ts && th <= ts - td, "a town's dead and wounded are of those it sent");
          assert.ok(ts >= 0 && td >= 0 && th >= 0);
          s += ts;
          d += td;
          h += th;
          towns++;
        }
        assert.ok(sent - s >= 0 && dead - d >= 0 && hurt - h >= 0, "the countryside is the rest");
        if (each.length)
          assert.ok(
            each.at(-1)!.some((x) => x > 0),
            "trailing empty towns trimmed",
          );
      }
  assert.ok(towns >= 50, `${towns} towns' tallies`);
});

test("what a side bore is its design's arm", () => {
  let checked = 0;
  for (const b of battles)
    for (const i of [0, 1] as const) {
      const ref = b.designs?.[i];
      if (!ref) continue;
      const arm = designsOf(world)
        .get(ref)!
        .parts.find((p) => p.role === "arm");
      assert.deepEqual(b.bore![i], arm ? [arm.id, arm.material] : null);
      checked++;
    }
  assert.ok(checked >= 100, `${checked} sides armed by a design`);
});

test("the store: a loaded copy hashes the same, forgetting is idempotent and changes nothing hashed", () => {
  const saved = JSON.stringify(store.save()),
    copy = new WarStore();
  copy.load(JSON.parse(saved));
  assert.equal(hashOf(copy), hashOf(store));
  copy.forgetTowns(Y - (FELL_TOWN_YEARS + 1));
  assert.equal(JSON.stringify(copy.save()), saved, "what was let go is let go already");
  copy.forgetTowns(Y + 1);
  assert.notEqual(JSON.stringify(copy.save()), saved, "the recent towns are let go");
  assert.equal(hashOf(copy), hashOf(store), "and nothing hashed changes");
  for (const w of copy.all())
    if (w.ended !== null)
      for (const b of w.battles) assert.ok(!b.fell!.some((side) => side.some(kept)));

  // A save from before Phase 55: no wounded, maimed, bore or fell, and no fellDigest.
  const older = JSON.parse(saved) as {
    fellDigest?: string;
    wars: { battles: Record<string, unknown>[] }[];
  };
  delete older.fellDigest;
  for (const w of older.wars)
    for (const b of w.battles) {
      delete b.wounded;
      delete b.maimed;
      delete b.bore;
      delete b.fell;
    }
  const was = new WarStore();
  was.load(older);
  const hash = hashOf(was),
    wars = JSON.stringify((was.save() as { wars: unknown }).wars);
  was.forgetTowns(Y + 1);
  assert.equal(hashOf(was), hash);
  assert.equal(JSON.stringify((was.save() as { wars: unknown }).wars), wars);
});

test("reading a host's terms, a land's towns and its tallies changes no history", () => {
  const before = JSON.stringify(world.domainHashes());
  for (const p of politiesOf(world).living()) {
    const terms = hostTerms(ctx, p, armsOf(ctx, p));
    assert.ok(terms.care >= 0 && terms.care <= 1);
    assert.ok(terms.shock >= 0 && terms.protection >= 0 && terms.range >= 0 && terms.fire >= 0);
  }
  for (const prov of ctx.provinces.all()) {
    const { people, countryside } = townShares(ctx, prov.cell);
    assert.equal(people.length, ctx.settlements.inProvince(prov.cell).length);
    assert.ok(people.every((x) => x >= 0) && countryside >= 0);
    const [land] = fellOf(ctx, [[prov.cell, 100, 10]], 25);
    assert.deepEqual(fellTotals([land!]), [100, 10, 25]);
  }
  assert.equal(JSON.stringify(world.domainHashes()), before);
});

test("the hand's village sends no one", () => {
  // The most populous village of the land under the most recent battle with a peopled village.
  const b = [...battles]
      .sort((x, y) => y.year - x.year)
      .find((x) => ctx.settlements.inProvince(x.land).some((s) => s.population > 0))!,
    towns = ctx.settlements.inProvince(b.land);
  let k = 0;
  for (let i = 1; i < towns.length; i++) if (towns[i]!.population > towns[k]!.population) k = i;
  assert.ok(townShares(ctx, b.land).people[k]! > 0, "its people weigh before the hand");
  world.submit("hand.lay", { village: towns[k]!.ref });
  world.runTo(world.now + 1);
  assert.equal(handOf(world).over(b.land)?.village, towns[k]!.ref);
  assert.equal(townShares(ctx, b.land).people[k], 0, "the held village weighs nothing");
  const [land] = fellOf(ctx, [[b.land, 10_000, 100]], 200);
  assert.deepEqual(unpackTowns(land![4]!)[k] ?? [0, 0, 0], [0, 0, 0], "and sends no one");
});
