// 2026-11-13: one of a court played, the god channelled into them, and a realm's fortune laid with a strength and a span.
// A fortune of old is told and done as it always was and keeps nothing; one laid strong for years is kept, laid again at
// each year's turn, and lifts on its own; one of a court is refused for their station as a mortal and carried with the
// god in them, never past what the world has to do it with.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type World } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import {
  FORTUNE_STRENGTHS,
  FORTUNE_WORDS,
  GOD_EVENTS,
  godHostsOf,
  godMen,
  godProblem,
  loreOf,
  strengthOf,
  LAWS,
  LAW_OF,
  PEOPLE_ACT_EVENTS,
  REIGN_EVENTS,
  actsOf,
  courtOf,
  diplomacyOf,
  warsOf,
  fortunesOf,
  orderOf,
  politiesOf,
  populationContext,
  proposeProblem,
  roleStationOf,
  type Polity,
} from "../../src/sim/index.ts";
import { TIES } from "../../src/rules/index.ts";
import { armyBlocks } from "../../src/host/inspect/army.ts";
import {
  FORTUNE_STRENGTHS as PALETTE_STRENGTHS,
  FORTUNE_WORDS as PALETTE_WORDS,
} from "../../src/ui/palette.ts";

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
const count = (world: World, type: string, after: number) =>
  world.events.all().filter((e) => e.type === type && e.t > after).length;

test("the palette's strengths are the world's", () => {
  assert.deepEqual([...PALETTE_STRENGTHS], [...FORTUNE_STRENGTHS]);
  assert.deepEqual(PALETTE_WORDS, FORTUNE_WORDS);
});

test("a blessing or curse of old keeps nothing, and is the same as one asked at strength 1 for a year", () => {
  const a = fresh(),
    b = fresh(),
    r = biggest(a);
  a.submit("act.curse", { realm: r.ref });
  b.submit("act.curse", { realm: r.ref, strength: 1, years: 1 });
  a.runTo(a.now + YEAR);
  b.runTo(b.now + YEAR);
  assert.equal(fortunesOf(a)?.all().length, 0);
  assert.ok(fortunesOf(a)?.dormant());
  // (Every domain the same but the log of what was asked, which keeps the asking as it was worded.)
  const but = (w: World) => w.domainHashes().filter(([d]) => d !== "commands");
  assert.deepEqual(but(a), but(b));
  assert.throws(() => {
    const w = built();
    w.submit("act.bless", { realm: r.ref, strength: 7 });
    w.runTo(w.now + 1);
  }, /strength/);
});

test("a curse at the greatest strength for 5 years is laid each year, then lifts and says what it did", () => {
  const world = fresh(),
    r = biggest(world),
    start = world.now,
    lands = r.members.length;
  world.submit("act.curse", { realm: r.ref, strength: 3, years: 5 });
  world.runTo(start + YEAR / 2);
  const held = fortunesOf(world)!.over(r.ref);
  assert.equal(held.length, 1);
  assert.ok(!fortunesOf(world)!.dormant());
  const sick = actsOf(world)
    .all()
    .filter((x) => x.kind === "plague" && x.sign === -1 && x.from > start);
  assert.ok(sick.length >= 1, "no sickness laid");
  world.runTo(start + 6 * YEAR);
  assert.equal(fortunesOf(world)!.all().length, 0);
  assert.equal(count(world, PEOPLE_ACT_EVENTS.fortune.type, start), 4);
  assert.equal(count(world, PEOPLE_ACT_EVENTS.fortuneEnd.type, start), 1);
  const after = politiesOf(world).get(r.ref)!;
  assert.ok(
    after.ended !== null || after.members.length * 2 <= lands,
    `${r.town} held ${after.members.length} of ${lands} lands`,
  );
});

test("one of a court: refused for their station as a mortal, carried with the god in them, told as an omen", () => {
  const world = fresh(),
    ctx = populationContext(world);
  let found: { r: Polity; fig: number; name: string; law: string; to: number } | null = null;
  for (const r of politiesOf(world).living()) {
    const c = courtOf(world)?.of(r.ref),
      o = orderOf(world)?.of(r.ref);
    if (!c || !o || found) continue;
    for (const f of c.figures) {
      if (f.seat === "house" || !roleStationOf(ctx, r, c, f).grown || found) continue;
      for (const law of LAWS) {
        const now = o.laws[LAW_OF[law]]!;
        for (const to of [now - 1, now + 1].filter((x) => x >= 0 && x <= 2))
          if (
            !found &&
            proposeProblem(ctx, r, c, f, { what: "law", law, to }) &&
            !proposeProblem(ctx, r, c, f, { what: "law", law, to, channel: true })
          )
            found = { r, fig: f.id, name: f.name, law, to };
      }
    }
  }
  assert.ok(found, "no one of a court to try");
  const { r, fig, name, law, to } = found!,
    args = { realm: r.ref, fig, name, what: "law", law, to };
  assert.throws(() => {
    world.submit("role.propose", args);
    world.runTo(world.now + 1);
  });
  const t = world.now;
  world.submit("role.propose", { ...args, channel: true });
  world.runTo(t + 2);
  assert.equal(orderOf(world)!.of(r.ref)!.laws[LAW_OF[law as (typeof LAWS)[number]]], to);
  assert.equal(count(world, REIGN_EVENTS.channel.type, t), 1);
  // With the god in them a move on the seat cannot fail.
  const c = courtOf(world)!.of(r.ref)!;
  if (!c.plot) {
    world.submit("role.plot", { realm: r.ref, fig, name, channel: true });
    world.runTo(world.now + 2);
    assert.equal(courtOf(world)!.of(r.ref)!.plot?.won, true);
  }
});

test("a ruler's envoy that would not be heard as a mortal is heard with the god in them", () => {
  const world = fresh();
  let pair: { r: Polity; q: Polity } | null = null;
  for (const r of politiesOf(world).living())
    for (const x of diplomacyOf(world).of(r.ref)) {
      const q = politiesOf(world).get(x.a === r.ref ? x.b : x.a);
      if (
        !pair &&
        q &&
        q.ended === null &&
        !x.pact &&
        x.opinion < TIES.envoyPactAt &&
        !warsOf(world).between(r.ref, q.ref)
      )
        pair = { r, q };
    }
  assert.ok(pair, "no two realms that would not swear");
  const { r, q } = pair!,
    args = { realm: r.ref, ruler: r.ruler.name, to: q.ref, errand: "pact" };
  assert.throws(() => {
    world.submit("reign.envoy", args);
    world.runTo(world.now + 1);
  }, /know you well enough/);
  const t = world.now;
  world.submit("reign.envoy", { ...args, channel: true });
  world.runTo(t + 2);
  assert.ok(diplomacyOf(world).get(r.ref, q.ref)?.pact, "no pact sworn");
  assert.equal(count(world, REIGN_EVENTS.channel.type, t), 1);
});

test("the god's hand through a ruler: refused as a mortal; a host, learning, wealth, a war and a forced peace, each told", () => {
  const world = fresh(),
    ctx = populationContext(world),
    r = biggest(world),
    who = { realm: r.ref, ruler: r.ruler.name };
  assert.ok(godHostsOf(world)?.dormant(), "a god's host kept before any was stood up");
  assert.throws(() => {
    world.submit("reign.god", { ...who, what: "grain" });
    world.runTo(world.now + 1);
  }, /Only with the god in them/);
  const t = world.now,
    strength = strengthOf(ctx, r),
    known = loreOf(world).of(r.seat).length,
    god = { ...who, channel: true };
  world.submit("reign.god", { ...god, what: "host", men: 100_000, arms: "best" });
  world.submit("reign.god", { ...god, what: "age" });
  world.submit("reign.god", { ...god, what: "wealth" });
  world.runTo(t + 2);
  assert.equal(godMen(world, r.ref), 100_000);
  // (Asked 2026-11-13: "when i go the army tab the number isnt 300000": the tab's host counts the god's men.)
  const fields = armyBlocks(world, r).flatMap((b) => (b.type === "facts" ? b.rows : []))[0]!;
  assert.ok(
    Number(JSON.stringify(fields.value).replace(/[^0-9]/g, "")) >= 100_000,
    `the Army tab fields ${JSON.stringify(fields.value)} with 100,000 stood up by the god`,
  );
  assert.ok(strengthOf(ctx, r) > strength * 2, "the god's host does not weigh in its strength");
  assert.ok(loreOf(world).of(r.seat).length > known, "no learning came to its seat");
  const foe = [...politiesOf(world).living()].find(
    (q) => q !== r && !godProblem(world, ctx, { ...god, what: "war", with: q.ref }),
  )!;
  assert.ok(foe, "no realm to set it at war with");
  world.submit("reign.god", { ...god, what: "war", with: foe.ref });
  world.runTo(world.now + 2);
  const fighting = () =>
    warsOf(world)
      .fighting(r.ref)
      .some((w) => w.ended === null && (w.attacker === foe.ref || w.defender === foe.ref));
  assert.ok(fighting(), "no war begun");
  world.submit("reign.god", { ...god, what: "peace", with: foe.ref });
  world.runTo(world.now + 2);
  assert.ok(!fighting(), "the war did not end");
  const told = world.events.all().filter((e) => e.type === GOD_EVENTS.did.type && e.t > t);
  assert.deepEqual(
    told.map((e) => (e.data as { what: string }).what),
    ["host", "age", "wealth", "war", "peace"],
  );
  // (A host of the god wastes as one kept under arms does, and is kept in the world's save.)
  world.runTo(world.now + YEAR);
  assert.ok(godMen(world, r.ref) < 100_000 && godMen(world, r.ref) > 50_000);
});
