import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  verifyByReplay,
  type Ref,
  type World,
} from "../../src/kernel/index.ts";
import {
  BELIEF_EVENTS,
  DISASTER,
  DISASTER_EVENTS,
  FORTUNE,
  PEOPLE_ACT_EVENTS,
  POLITY_EVENTS,
  REGARD,
  SETTLERS,
  WAR_EVENTS,
  WAYS_ACT_EVENTS,
  WAYS_PUSH,
  WAY,
  actsOf,
  beliefOf,
  cultureOf,
  diplomacyOf,
  frontier,
  languagesOf,
  livableFor,
  makePopulationWorld,
  marketsOf,
  politiesOf,
  populationContext,
  settlersFrom,
  warsOf,
  type Polity,
} from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";

// Juniper's many realms (as the war tests have them), four centuries on.
const seed = seedFromText("juniper"),
  build = (s = seed) => makePopulationWorld(s, { start: "spread" }),
  AT = 400 * YEAR,
  chain = (w: World) => w.checkpoints().map((c) => c.chain);
const world = build();
world.runTo(AT);
// Each test acts on its own copy of the world as it stood then.
const RULESET = rulesetId(world, "test"),
  AS_IT_WAS = saveWorld(world, RULESET),
  fresh = () => loadWorld(AS_IT_WAS, build, RULESET).world;

/** Two standing realms at peace with a land between them to fight for, the most peopled first. */
function neighbours(w: World): [Polity, Polity] {
  const ctx = populationContext(w),
    people = (p: Polity) => p.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0),
    living = [...politiesOf(w).living()].sort(
      (a, b) => people(b) - people(a) || (a.ref < b.ref ? -1 : 1),
    );
  for (const a of living)
    for (const b of living)
      if (a !== b && !warsOf(w).between(a.ref, b.ref) && frontier(ctx, a, b).length) return [a, b];
  throw new Error("no two realms touch");
}

test("the god sets one realm upon another: a war declared by the act, fought as any war", () => {
  const w = fresh();
  const [a, b] = neighbours(w),
    act = w.submit("act.war", { a: a.ref, b: b.ref });
  w.runTo(AT + 3 * YEAR);
  const war = warsOf(w)
    .all()
    .find((x) => x.attacker === a.ref && x.defender === b.ref && x.declared === 400)!;
  assert.ok(war, "the war stands");
  const declared = w.events.get(war.event)!;
  assert.equal(declared.type, WAR_EVENTS.declared.type);
  assert.equal(declared.causes[0]!.ref, act.id, "its declaration cites the act");
  assert.equal(declared.causes[0]!.role, "agent");
  assert.match(why(w, war.event).claim, /war/);
  assert.ok(war.battles.length >= 1 || war.ended !== null, "it is fought (or already ended)");
  assert.throws(() => w.submit("act.war", { a: a.ref, b: a.ref }), /against itself/);
  if (war.ended === null)
    assert.throws(() => w.submit("act.war", { a: a.ref, b: b.ref }), /at war already/);
});

test("the god ends a war: its peace cites the act, and the realms remember the war", () => {
  const w = fresh();
  const [a, b] = neighbours(w);
  w.submit("act.war", { a: a.ref, b: b.ref });
  w.runTo(AT + 1);
  const peace = w.submit("act.peace", { a: b.ref, b: a.ref });
  w.runTo(AT + 2);
  const war = warsOf(w)
    .all()
    .find((x) => x.attacker === a.ref && x.defender === b.ref && x.declared === 400)!;
  assert.equal(war.ended, 400, "ended the year it began");
  const e = w.events.get(war.peace!)!;
  assert.equal(e.type, WAR_EVENTS.peace.type);
  assert.equal(e.causes[0]!.ref, peace.id, "the peace cites the act");
  assert.ok(
    diplomacyOf(w)
      .remembered(a.ref, b.ref, 400)
      .some((t) => t.name === "a war between them"),
    "the war is remembered",
  );
  assert.throws(() => w.submit("act.peace", { a: a.ref, b: b.ref }), /not at war/);
});

test("friendship and discord are remembered between two realms, and fade as memories do", () => {
  const w = fresh();
  const [a, b] = neighbours(w),
    kind = w.submit("act.friendship", { a: a.ref, b: b.ref });
  w.runTo(AT + 1);
  const terms = () => diplomacyOf(w).remembered(a.ref, b.ref, 400),
    kindly = terms().find((t) => t.name === "the god's favour on their friendship")!;
  assert.ok(kindly, "the friendship is remembered");
  assert.ok(Math.abs(kindly.value - REGARD) < 1e-9);
  const e = w.events.get(kindly.source!)!;
  assert.equal(e.type, PEOPLE_ACT_EVENTS.friendship.type);
  assert.equal(e.causes[0]!.ref, kind.id);
  assert.match(why(w, e.id).claim, /were made friends/);
  w.submit("act.discord", { a: a.ref, b: b.ref });
  w.runTo(AT + 2);
  assert.ok(
    terms().some((t) => t.name === "a discord the god sowed between them" && t.value < 0),
    "the discord is remembered",
  );
  // (Thirty years on, half as strongly.)
  const later = diplomacyOf(w)
    .remembered(a.ref, b.ref, 430)
    .find((t) => t.name === "the god's favour on their friendship")!;
  assert.ok(Math.abs(later.value - REGARD / 2) < 1e-6, `${later.value}`);
});

test("a land stirred to rise breaks from its realm, and raises its own where it has a town", () => {
  const w = fresh();
  const ctx = populationContext(w),
    realm = [...politiesOf(w).living()]
      .filter((p) => p.members.length >= 3)
      .sort((x, y) => y.members.length - x.members.length || (x.ref < y.ref ? -1 : 1))[0]!,
    land = realm.members.find((c) => c !== realm.seat && ctx.settlements.inProvince(c).length > 0)!;
  assert.ok(land !== undefined, "a land of the realm with a town");
  assert.throws(() => w.submit("act.rise", { cell: realm.seat }), /seat/);
  const act = w.submit("act.rise", { cell: land });
  w.runTo(AT + 1);
  const now = politiesOf(w).of(land);
  assert.ok(now && now.ref !== realm.ref, "the land is its own realm's");
  const formed = w.events.get(now.event)!;
  assert.equal(formed.type, POLITY_EVENTS.formed.type);
  const seceded = w.events.get(formed.causes[0]!.ref as Ref)!;
  assert.equal(seceded.type, POLITY_EVENTS.seceded.type);
  assert.equal(seceded.causes[0]!.ref, act.id, "its rising cites the act");
  assert.ok(
    diplomacyOf(w)
      .remembered(realm.ref, now.ref, 400)
      .some((t) => t.name === "a land that rose against them" && t.value < 0),
    "the realm it left remembers it bitterly",
  );
});

test("a land turned to a faith holds it from the act", () => {
  const w = fresh();
  const ctx = populationContext(w),
    faiths = beliefOf(w),
    faith = faiths.all()[0]!,
    land = ctx.provinces
      .all()
      .find((p) => p.total() > 0 && faiths.of(p.cell).faith !== faith.ref)!.cell;
  const act = w.submit("act.convert", { cell: land, faith: faith.ref });
  w.runTo(AT + 1);
  const held = faiths.of(land);
  assert.equal(held.faith, faith.ref);
  const e = w.events.get(held.event!)!;
  assert.equal(e.type, BELIEF_EVENTS.converted.type);
  assert.equal(e.causes[0]!.ref, act.id);
  assert.throws(
    () => w.submit("act.convert", { cell: land, faith: faith.ref }),
    /hold that faith already/,
  );
});

test("the ground shaken: a share of a land's people dead, its stores spilled, its grief its realm's", () => {
  const w = fresh(),
    ctx = populationContext(w),
    land = [...ctx.provinces.all()].sort((x, y) => y.total() - x.total() || x.cell - y.cell)[0]!,
    before = land.total(),
    grain = marketsOf(w).get(land.cell)!.stock[0]!,
    grief = politiesOf(w).discontent(land.cell).level;
  const act = w.submit("act.quake", { cell: land.cell });
  w.runTo(AT + 1);
  const e = w.events.all().find((x) => x.type === DISASTER_EVENTS.quake.type)!;
  assert.equal(e.causes[0]!.ref, act.id, "the quake cites the act");
  const dead = (e.data as { dead: number }).dead;
  assert.ok(
    Math.abs(dead - before * DISASTER.quake.dead) < before * 0.01,
    `${dead} of ${before} died`,
  );
  assert.ok(marketsOf(w).get(land.cell)!.stock[0]! < grain, "its stores spilled");
  if (politiesOf(w).of(land.cell)) {
    const d = politiesOf(w).discontent(land.cell);
    assert.ok(d.level > grief && d.cause === e.id, "its grief its realm's");
  }
  assert.match(why(w, e.id).claim, /the ground shook under/);
  assert.throws(() => w.submit("act.quake", { cell: -1 }), /a land is wanted|no one lives/);
});

test("fire from the sky: many dead, the fields burned for years, a crater left on the map", () => {
  const w = fresh(),
    ctx = populationContext(w),
    land = [...ctx.provinces.all()].sort((x, y) => y.total() - x.total() || x.cell - y.cell)[1]!,
    before = land.total();
  w.submit("act.meteor", { cell: land.cell });
  w.runTo(AT + 1);
  const e = w.events.all().find((x) => x.type === DISASTER_EVENTS.meteor.type)!,
    blight = actsOf(w).at(land.cell, "harvest", w.now)!;
  const dead = (e.data as { dead: number }).dead;
  assert.ok(
    Math.abs(dead - before * DISASTER.meteor.dead) < before * 0.01,
    `${dead} of ${before} died`,
  );
  assert.equal(land.total(), before - dead, "a fifth dead");
  assert.equal(blight.sign, -1, "its fields burned");
  assert.equal(blight.event, e.id, "the failed harvest cites the fire");
  assert.equal(blight.until - blight.from, DISASTER.meteor.blighted * YEAR);
  assert.deepEqual(
    actsOf(w)
      .craters()
      .map((c) => c.cell),
    [land.cell],
    "a crater left",
  );
  assert.match(why(w, e.id).claim, /fire fell from the sky/);
});

test("a river risen drowns a river land's fields, and those downriver; a dry land has no river to rise", () => {
  const w = fresh(),
    ctx = populationContext(w),
    g = ctx.generated,
    river = [...ctx.provinces.all()]
      .filter((p) => p.total() > 0 && g.water.river[p.cell])
      .sort((x, y) => y.total() - x.total() || x.cell - y.cell)[0]!,
    dry = ctx.provinces
      .all()
      .find((p) => p.total() > 0 && !g.water.river[p.cell] && !g.water.lake[p.cell]);
  const act = w.submit("act.flood", { cell: river.cell });
  w.runTo(AT + 1);
  const e = w.events.all().find((x) => x.type === DISASTER_EVENTS.flood.type)!;
  assert.equal(e.causes[0]!.ref, act.id);
  const drowned = actsOf(w)
    .all()
    .filter((a) => a.event === e.id);
  assert.equal(drowned.length, (e.data as { lands: number }).lands, "each land drowned");
  assert.ok(drowned.every((a) => a.kind === "harvest" && a.sign === -1));
  assert.ok(drowned.some((a) => a.cell === river.cell));
  if (dry) assert.throws(() => w.submit("act.flood", { cell: dry.cell }), /no river/);
});

test("settlers sent into an empty land people it, with their ways and speech; the flow is history's", () => {
  // (A young world, its people still at their cradle, the lands about it empty.)
  const w = makePopulationWorld(seedFromText("first light"));
  w.runTo(60 * YEAR);
  const ctx = populationContext(w),
    g = ctx.generated,
    empty = Array.from({ length: g.grid.count }, (_, c) => c).find(
      (c) =>
        !ctx.provinces.get(c) &&
        g.tectonics.elevation[c]! > 0 &&
        livableFor(ctx, c) &&
        settlersFrom(ctx, c) !== null,
    );
  assert.ok(empty !== undefined, "an empty land beside a peopled one");
  const from = ctx.provinces.get(settlersFrom(ctx, empty)!)!,
    sent = Math.min(SETTLERS.most, Math.floor(from.total() * SETTLERS.share)),
    act = w.submit("act.settle", { cell: empty });
  w.runTo(61 * YEAR);
  const land = ctx.provinces.get(empty)!,
    e = w.events.get(land.arrival!)!;
  assert.equal(e.type, PEOPLE_ACT_EVENTS.settle.type);
  assert.equal(e.causes[0]!.ref, act.id, "peopled by the act");
  assert.ok(land.total() > 0.8 * sent, `${land.total()} of ${sent} there a year on`);
  assert.ok(cultureOf(w).get(empty), "with their ways");
  assert.ok(
    ctx.history.flows().some((f) => f.to === empty && f.event === e.id),
    "the flow written",
  );
  assert.match(why(w, e.id).claim, /settlers came into/);
  const sea = Array.from({ length: g.grid.count }, (_, c) => c).find(
    (c) => g.tectonics.elevation[c]! < -2000,
  )!;
  assert.throws(() => w.submit("act.settle", { cell: sea }), /no people could live there/);
  // Into a land already peopled: more of them.
  const j = fresh(),
    jctx = populationContext(j),
    peopled = [...jctx.provinces.all()].find((p) => settlersFrom(jctx, p.cell) !== null)!,
    had = peopled.total();
  j.submit("act.settle", { cell: peopled.cell });
  j.runTo(AT + 1);
  assert.ok(peopled.total() > had, "the more there");
});

test("two realms made one: the second's lands the first's, the second ended; a realm blessed or cursed", () => {
  const w = fresh(),
    [a, b] = neighbours(w),
    lands = [...b.members];
  const act = w.submit("act.union", { a: a.ref, b: b.ref });
  w.runTo(AT + 1);
  const realms = politiesOf(w);
  assert.ok(
    lands.every((c) => realms.of(c)?.ref === a.ref),
    "its lands the first's",
  );
  assert.notEqual(realms.get(b.ref)!.ended, null, "the second ended");
  const e = w.events.all().find((x) => x.type === PEOPLE_ACT_EVENTS.union.type)!;
  assert.equal(e.causes[0]!.ref, act.id);
  const ended = w.events
    .all()
    .find((x) => x.type === POLITY_EVENTS.ended.type && x.subjects[0] === b.ref)!;
  assert.equal(ended.causes[0]!.ref, e.id, "its end cites the union");
  // A blessing eases every land's grievance; a curse deepens it.
  const levels = () => a.members.map((c) => realms.discontent(c).level);
  const was = levels();
  w.submit("act.curse", { realm: a.ref });
  w.runTo(AT + 2);
  levels().forEach((l, i) => assert.ok(Math.abs(l - (was[i]! + FORTUNE)) < 1e-9, "cursed"));
  w.submit("act.bless", { realm: a.ref });
  w.runTo(AT + 3);
  levels().forEach((l, i) => assert.ok(Math.abs(l - was[i]!) < 1e-9, "blessed back"));
  assert.throws(() => w.submit("act.bless", { realm: b.ref }), /standing realm/);
});

test("a people's ways pushed by the god: the trait and what they return to, the push remembered", () => {
  const w = fresh(),
    ctx = populationContext(w),
    land = [...ctx.provinces.all()].sort((x, y) => y.total() - x.total() || x.cell - y.cell)[0]!,
    ways = cultureOf(w).get(land.cell)!,
    was = ways.traits[WAY.valour]!,
    base = ways.base[WAY.valour]!;
  const act = w.submit("act.ways", { cell: land.cell, way: "valour", sign: 1 });
  w.runTo(AT + 1);
  assert.ok(Math.abs(ways.traits[WAY.valour]! - Math.min(0.98, was + WAYS_PUSH)) < 1e-9);
  assert.ok(Math.abs(ways.base[WAY.valour]! - Math.min(0.98, base + WAYS_PUSH)) < 1e-9);
  const e = w.events.all().find((x) => x.type === WAYS_ACT_EVENTS.ways.type)!;
  assert.equal(e.causes[0]!.ref, act.id);
  assert.ok(
    ways.nudges.some((n) => n.event === e.id),
    "the push kept among what moved them",
  );
  assert.match(why(w, e.id).claim, /grew more warlike/);
  assert.throws(
    () => w.submit("act.ways", { cell: land.cell, way: "height", sign: 1 }),
    /a way is wanted/,
  );
});

test("a land taught a tongue speaks it; a land given a tongue of its own speaks a new one of its family", () => {
  const w = fresh(),
    ctx = populationContext(w),
    store = languagesOf(w),
    lands = [...ctx.provinces.all()].filter((p) => p.total() > 0 && store.of(p.cell));
  const a = lands[0]!,
    other = lands.find((p) => store.of(p.cell) !== store.of(a.cell))!,
    theirs = store.of(other.cell)!;
  const taught = w.submit("act.tongue", { cell: a.cell, language: theirs.ref });
  w.runTo(AT + 1);
  assert.equal(store.of(a.cell), theirs, "they speak it");
  assert.deepEqual(cultureOf(w).get(a.cell)!.tongue, theirs.standard, "as its standard is spoken");
  assert.equal(
    w.events.all().find((x) => x.type === WAYS_ACT_EVENTS.tongue.type)!.causes[0]!.ref,
    taught.id,
  );
  assert.throws(() => w.submit("act.tongue", { cell: a.cell, language: theirs.ref }), /already/);
  const before = store.all().length,
    was = store.of(other.cell)!,
    own = w.submit("act.newtongue", { cell: other.cell });
  w.runTo(AT + 2);
  const born = store.of(other.cell)!;
  assert.equal(store.all().length, before + 1, "a new tongue");
  assert.equal(born.parent, was.index, "a daughter of the one they spoke");
  assert.equal(born.family, was.family);
  assert.equal(w.events.get(born.event)!.causes[0]!.ref, own.id);
});

test("a faith founded by the god: its tenet the god's choosing, its land holding it", () => {
  const w = fresh(),
    ctx = populationContext(w),
    land = [...ctx.provinces.all()].sort((x, y) => y.total() - x.total() || x.cell - y.cell)[3]!,
    before = beliefOf(w).all().length;
  const act = w.submit("act.faith", { cell: land.cell, tenet: "fire" });
  w.runTo(AT + 1);
  const f = beliefOf(w).all()[before]!;
  assert.equal(f.tenet, "fire");
  assert.equal(f.seat, land.cell);
  assert.equal(beliefOf(w).of(land.cell).faith, f.ref, "the land holds it");
  assert.equal(w.events.get(f.event)!.causes[0]!.ref, act.id);
  assert.match(f.name, /Keepers of the Flame/);
  assert.throws(
    () => w.submit("act.faith", { cell: land.cell, tenet: "gold" }),
    /a tenet is wanted/,
  );
});

test("a world touched by the acts on its peoples replays, and its save continues, bit for bit", () => {
  const w = fresh();
  const [a, b] = neighbours(w);
  w.submit("act.discord", { a: a.ref, b: b.ref });
  w.submit("act.war", { a: a.ref, b: b.ref });
  w.submit("act.quake", { cell: a.seat });
  w.submit("act.meteor", { cell: b.seat });
  w.runTo(AT + 3 * YEAR);
  const doc = saveWorld(w, RULESET);
  assert.deepEqual(verifyByReplay(doc, build), { ok: true, problem: null });
  const loaded = loadWorld(doc, build, RULESET).world;
  w.runTo(AT + 6 * YEAR);
  loaded.runTo(AT + 6 * YEAR);
  assert.deepEqual(chain(loaded), chain(w));
  // (And the world left alone went otherwise.)
  world.runTo(AT + 6 * YEAR);
  assert.notDeepEqual(chain(world).at(-1), chain(w).at(-1));
});
