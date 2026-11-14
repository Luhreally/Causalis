// 2026-11-13 ("add sliders for whatever else is relevant to on those god hand options"): how much each of the god's acts
// does is asked with it and carried in its command, so a replay does the same; asked at the amount it always did, it
// does exactly what it always did; an amount the hand does not give is refused; the palette says the world's numbers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type World } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import {
  ACT_STRENGTH,
  ACT_STRENGTHS,
  DISASTER,
  FORTUNE_STRENGTHS,
  GOD_AMOUNTS,
  GOD_EVENTS,
  GREAT_ACT_STRENGTH,
  REGARD,
  SETTLERS,
  WAYS_PUSH,
  actFactor,
  disasterAt,
  bondsOf,
  godAmount,
  godLearning,
  godProblem,
  loreOf,
  godMen,
  politiesOf,
  populationContext,
  type Polity,
} from "../../src/sim/index.ts";
import { PALETTE_FORCE } from "../../src/ui/palette.ts";
import { REIGN_QUERIES } from "../../src/host/reign.ts";
import { armyBlocks } from "../../src/host/inspect/army.ts";

const built = (() => {
  let cached: World | null = null;
  return () => {
    if (!cached) {
      cached = EARTH.build(seedFromText("first light"));
      cached.runTo(220 * YEAR);
    }
    return cached;
  };
})();
const fresh = () => {
  const w = EARTH.build(seedFromText("first light"));
  w.runTo(built().now);
  return w;
};
const biggest = (world: World): Polity =>
  [...politiesOf(world).living()].sort(
    (a, b) => b.members.length - a.members.length || (a.ref < b.ref ? -1 : 1),
  )[0]!;
const peopleOf = (world: World, r: Polity) => {
  const c = populationContext(world);
  return r.members.reduce((n, k) => n + (c.provinces.get(k)?.total() ?? 0), 0);
};

test("the palette's numbers are the world's", () => {
  assert.deepEqual([...ACT_STRENGTHS], [...FORTUNE_STRENGTHS]);
  assert.equal(PALETTE_FORCE.rain, ACT_STRENGTH.rain);
  assert.equal(PALETTE_FORCE.harvest, ACT_STRENGTH.harvest);
  assert.equal(PALETTE_FORCE.plague, ACT_STRENGTH.plague);
  assert.equal(PALETTE_FORCE.healing, ACT_STRENGTH.healing);
  for (const k of ["quake", "meteor", "flood"] as const)
    for (const [name, v] of Object.entries(PALETTE_FORCE[k]))
      assert.equal(v, (DISASTER[k] as Record<string, number>)[name], `${k}.${name}`);
  assert.equal(PALETTE_FORCE.warm, GREAT_ACT_STRENGTH.warm);
  assert.equal(PALETTE_FORCE.flare, GREAT_ACT_STRENGTH.flare);
  assert.equal(PALETTE_FORCE.calm, GREAT_ACT_STRENGTH.calm);
  assert.equal(PALETTE_FORCE.regard, REGARD);
  assert.equal(PALETTE_FORCE.ways, WAYS_PUSH);
  assert.equal(PALETTE_FORCE.settlers.share, SETTLERS.share);
  assert.equal(PALETTE_FORCE.settlers.most, SETTLERS.most);
});

test("a strength of old is the act of old, to the bit; other strengths move it, never below nothing", () => {
  for (const k of [0.55, 0.5, 3]) {
    assert.equal(actFactor(true, k, undefined), 1 + k);
    assert.equal(actFactor(false, k, 1), 1 - k);
  }
  assert.ok(actFactor(false, 0.5, 3) > 0 && actFactor(false, 0.5, 3) < 0.2);
  assert.equal(actFactor(true, 3, 3), 10);
  assert.deepEqual(disasterAt("quake", 1), { ...DISASTER.quake });
  assert.ok(Math.abs(disasterAt("meteor", 3).dead - 0.6) < 1e-9);
  assert.equal(disasterAt("meteor", 3).stores, 1);
  assert.equal(disasterAt("flood", 3).downriver, 9);
  for (const spec of Object.values(GOD_AMOUNTS))
    assert.ok(
      (spec.stops as readonly number[]).includes(spec.was),
      `${spec.key}: ${spec.was} not a stop`,
    );
  assert.equal(godAmount({ realm: "r" as never, what: "grain" }), 1);
  assert.equal(godAmount({ realm: "r" as never, what: "people", share: 4 }), 4);
});

test("asked at the amount it always did, an act does exactly what it always did; another amount is carried and done", () => {
  const a = fresh(),
    b = fresh(),
    r = biggest(a),
    c = populationContext(a),
    land = [...r.members].sort(
      (x, y) => (c.provinces.get(y)?.total() ?? 0) - (c.provinces.get(x)?.total() ?? 0),
    )[Math.min(1, r.members.length - 1)]!,
    god = { realm: r.ref, ruler: r.ruler.name, channel: true };
  a.submit("act.quake", { cell: land });
  b.submit("act.quake", { cell: land, strength: 1 });
  a.submit("act.rain", { cell: land, sign: -1, years: 3 });
  b.submit("act.rain", { cell: land, sign: -1, years: 3, strength: 1 });
  a.submit("reign.god", { ...god, what: "grain" });
  b.submit("reign.god", { ...god, what: "grain", years: 1 });
  a.submit("reign.god", { ...god, what: "calm" });
  b.submit("reign.god", { ...god, what: "calm", share: 1 });
  a.runTo(a.now + YEAR);
  b.runTo(b.now + YEAR);
  const but = (w: World) => w.domainHashes().filter(([d]) => d !== "commands");
  assert.deepEqual(but(a), but(b));
  // (An amount not on the slider is refused, in words.)
  assert.throws(() => {
    a.submit("reign.god", { ...god, what: "people", share: 7 });
    a.runTo(a.now + 1);
  }, /How much/);
  assert.throws(() => {
    a.submit("act.quake", { cell: land, strength: 7 });
    a.runTo(a.now + 1);
  }, /strength/);
  // (The most the hand gives: four times as many people again, ten million men.)
  const before = peopleOf(a, r),
    t = a.now;
  a.submit("reign.god", { ...god, what: "people", share: 4 });
  a.submit("reign.god", { ...god, what: "host", men: 10_000_000, arms: "theirs" });
  a.runTo(t + 2);
  const told = a.events
    .all()
    .filter((e) => e.type === GOD_EVENTS.did.type && e.t > t)
    .map((e) => e.data as { what: string; people?: number; share?: number });
  const more = told.find((d) => d.what === "people")!;
  assert.equal(more.share, 4);
  assert.ok(more.people! > before * 3.5, `${more.people} added to ${before}`);
  assert.equal(godMen(a, r.ref), 10_000_000);
  // (Asked 2026-11-13: "make sure it actually works all the features consistently": after each act, the place a player
  // looks says what the slider promised: the ruler's bar, the Army tab, the seat's lore, the bonds between realms.)
  const bar = (w: World, q: Polity) =>
      REIGN_QUERIES["reign.now"]!(w, { realm: q.ref, ruler: "" }) as {
        host: number;
        people: number;
        head: number;
        legitimacy: number;
        unrest: number;
        lands: number;
        wars: unknown[];
      },
    tab = (w: World) =>
      Number(
        JSON.stringify(
          armyBlocks(w, r).flatMap((x) => (x.type === "facts" ? x.rows : []))[0]!.value,
        ).replace(/[^0-9]/g, ""),
      ),
    did = (args: Record<string, unknown>) => {
      const at = a.now;
      a.submit("reign.god", { ...god, ...args });
      a.runTo(at + 2);
    };
  assert.ok(bar(a, r).host >= 10_000_000, "the bar's host misses the god's men");
  assert.ok(tab(a) >= 10_000_000, "the Army tab misses the god's men");
  const head = bar(a, r).head;
  did({ what: "wealth", by: 10 });
  assert.ok(Math.abs(bar(a, r).head / head - 10) < 0.5, "wealth ×10 is not ten times a head");
  const lore = loreOf(a).of(r.seat).length,
    can = godLearning(populationContext(a), r.seat, 3).length;
  did({ what: "age", crafts: 3 });
  assert.equal(loreOf(a).of(r.seat).length, lore + can, "an age of 3 crafts did not teach them");
  did({ what: "rightful", level: 0.6 });
  assert.ok(Math.abs(bar(a, r).legitimacy - 0.6) < 0.005, "rightful 60 in 100 is not on the bar");
  did({ what: "stir", to: r.ref, level: 0.75 });
  assert.ok(bar(a, r).unrest >= 0.745, "stirred to 75 in 100, the bar says less");
  const sore = bar(a, r).unrest;
  did({ what: "calm", share: 0.5 });
  assert.ok(Math.abs(bar(a, r).unrest - sore / 2) < 0.01, "half the grievance was not forgotten");
  const foe = [...politiesOf(a).living()].find(
    (q) =>
      q !== r &&
      q.members.length > 3 &&
      !godProblem(a, populationContext(a), { ...god, what: "war", with: q.ref }),
  )!;
  const lands = bar(a, r).lands;
  did({ what: "annex", with: foe.ref, lands: 3 });
  assert.equal(bar(a, r).lands, lands + 3, "three lands asked, not three taken");
  did({ what: "war", with: foe.ref });
  assert.equal(bar(a, r).wars.length > 0, true, "no war on the bar");
  did({ what: "peace", with: foe.ref, years: 50 });
  const year = Math.floor(a.now / YEAR),
    truce = bondsOf(a).between(r.ref, foe.ref);
  assert.equal(truce?.kind, "truce");
  assert.equal(truce?.until, year + 50, "the truce does not run the 50 years asked");
  did({ what: "swear", with: foe.ref, years: 100 });
  const oath = bondsOf(a).between(r.ref, foe.ref);
  assert.equal(oath?.kind, "vassal");
  assert.equal(oath?.until, year + 100, "the oath does not run the 100 years asked");
});
