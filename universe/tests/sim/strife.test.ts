import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  verifyByReplay,
  type SimTime,
  type World,
} from "../../src/kernel/index.ts";
import { PRINCIPLES } from "../../src/rules/index.ts";
import {
  GENERAL,
  POLITY_EVENTS,
  STRIFE,
  STRIFE_ACTS,
  STRIFE_EVENTS,
  coupDanger,
  cultureOf,
  fieldedOf,
  foil,
  institutionsOf,
  interestsOf,
  legitimacyFactors,
  loreOf,
  makePopulationWorld,
  orderOf,
  politiesOf,
  populationContext,
  realmName,
  restore,
  seize,
  strifeOf,
  strifeYear,
  type Polity,
} from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";

// Phase 22 M145: the army and its coups. Juniper's realms sixty years on; the greatest of them
// given a standing army, or its rule doubted, by hand; worked on by the year of strife alone (the
// rest of the world held still), each year's draw at its own moment of year sixty.
const seed = seedFromText("juniper"),
  build = (s = seed) => makePopulationWorld(s, { start: "spread" }),
  world = build();
world.runTo(60 * YEAR);
const RULESET = rulesetId(world, "test"),
  AS_IT_WAS = saveWorld(world, RULESET),
  fresh = () => loadWorld(AS_IT_WAS, build, RULESET).world;

const at = (k: number) => (60 * YEAR + k) as SimTime;
const greatest = (w: World): Polity => {
  const ctx = populationContext(w),
    people = (p: Polity) => p.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0);
  return [...politiesOf(w).living()]
    .filter((p) => p.members.length >= 3)
    .sort((a, b) => people(b) - people(a) || (a.ref < b.ref ? -1 : 1))[0]!;
};
const armySway = (w: World, p: Polity) =>
  interestsOf(populationContext(w), p, w.now).find((i) => i.group === "the army")!;
/** A realm's seat taught to keep a standing army. */
function armed(w: World, p: Polity): void {
  const lore = loreOf(w),
    k = PRINCIPLES.find((x) => x.id === "standing-army")!;
  if (!lore.get(p.seat, "standing-army"))
    lore.learn(p.seat, "standing-army", { year: 60, event: p.event }, k);
}
/** A realm's rule held all but wrongful, held so year after year. */
function doubted(w: World, p: Polity): void {
  orderOf(w)!.of(p.ref)!.legitimacy = 0.05;
}
/** The year of strife, drawn again and again, its rule held doubted, until its army reaches for its seat. */
function untilACoup(w: World, p: Polity, from = 1, won = true): number {
  const ctx = populationContext(w),
    store = strifeOf(w)!;
  for (let k = from; k < from + 600; k++) {
    doubted(w, p);
    strifeYear(ctx, at(k * YEAR));
    if (store.coups.some((c) => c.realm === p.ref && (!won || c.won))) return k;
  }
  return -1;
}

test("the army is one of a realm's voices: heard the more with a standing army, above all under a general", () => {
  const w = fresh(),
    p = greatest(w),
    ctx = populationContext(w),
    before = armySway(w, p);
  assert.ok(before.people > 0 && before.sway > 0, `the army is heard (${before.sway})`);
  assert.ok(
    before.demands.some((d) => d.name === "the army wants its pay"),
    "the army wants its pay",
  );
  armed(w, p);
  const standing = armySway(w, p);
  assert.ok(standing.people > before.people, "a standing army: every man it fields under arms");
  assert.ok(standing.sway > before.sway, "and the more heard");
  seize(ctx, p, [], at(1));
  const general = armySway(w, p);
  assert.ok(general.sway > standing.sway * 1.5, `under a general, above all (${general.sway})`);
});

test("a coup: a doubted rule and a heard army — the seat seized, the realm a protectorate; its why is the army's", () => {
  const w = fresh(),
    p = greatest(w),
    was = [p.leadership, p.succession, p.law],
    name = realmName(p);
  armed(w, p);
  const o = orderOf(w)!.of(p.ref)!;
  o.legitimacy = 0.05;
  const danger = coupDanger(populationContext(w), p, o);
  assert.ok(danger.score > STRIFE.line, `a doubted rule over a heard army: ${danger.score}`);
  o.legitimacy = 0.9;
  assert.ok(
    coupDanger(populationContext(w), p, o).score < danger.score,
    "a rule held rightful: the less danger",
  );
  const k = untilACoup(w, p);
  assert.ok(k > 0, "its army reached for its seat");
  const coup = strifeOf(w)!.coups.find((c) => c.realm === p.ref && c.won)!;
  assert.equal(p.leadership, GENERAL, "a general rules it");
  assert.equal(p.succession, 1, "its rulers chosen by its army");
  assert.ok(realmName(p).startsWith("the protectorate of"), realmName(p));
  assert.equal(coup.was, name, "the coup remembers the realm it was");
  assert.deepEqual(strifeOf(w)!.junta(p.ref)!.was, was, "and the rule it overthrew");
  const e = w.events.get(coup.event)!,
    d = w.decisions.get(e.causes[0]!.ref)!;
  assert.equal(d.rule, "strife.coup");
  assert.ok(
    d.factors.some((f) => f.name === "a rule doubted" && f.contribution > 0.5),
    "a rule doubted drove it",
  );
  assert.ok(
    d.factors.some((f) => f.name === "the army's sway" && f.source?.role === "enabler"),
    "its standing army enabled it",
  );
  assert.equal(p.ruler.event, coup.event, "its ruler came by the coup");
  assert.match(why(w, coup.event)!.claim, /seized the seat of .* in a coup/);
});

test("a protectorate fields more of its men, its rule seized by the sword held the less rightful, and no reform comes of its ways", () => {
  const w = fresh(),
    p = greatest(w),
    ctx = populationContext(w),
    fielded = fieldedOf(ctx, p);
  seize(ctx, p, [], at(1));
  assert.ok(fieldedOf(ctx, p) > fielded, "more of its men fielded");
  const seized = legitimacyFactors(ctx, p).find((f) => f.name === "a rule seized by the sword");
  assert.ok(seized && seized.contribution <= -STRIFE.seized + 1e-9, "held the less rightful");
  assert.equal(seized!.source?.ref, strifeOf(w)!.junta(p.ref)!.event);
});

test("rule given back, the likelier as its standing returns: of its people's ways as they are now", () => {
  const w = fresh(),
    p = greatest(w),
    ctx = populationContext(w),
    o = orderOf(w)!.of(p.ref)!;
  seize(ctx, p, [], at(1));
  let k = 2;
  for (; k < 600 && p.leadership === GENERAL; k++) {
    o.legitimacy = 0.95;
    strifeYear(ctx, at(k * YEAR));
  }
  assert.notEqual(p.leadership, GENERAL, "its own rule given back");
  const back = strifeOf(w)!.restorations.find((x) => x.realm === p.ref)!;
  assert.ok(back && back.years >= 1, "after years of its army's");
  const inst = institutionsOf(cultureOf(w).get(p.seat)!, undefined, true);
  assert.equal(p.leadership, inst.leadership, "who leads, of its ways");
  assert.equal(strifeOf(w)!.junta(p.ref), null);
  const d = w.decisions.get(w.events.get(back.event)!.causes[0]!.ref)!;
  assert.equal(d.rule, "strife.restore");
  assert.ok(d.factors.some((f) => f.name === "a rule held rightful again" && f.contribution > 0));
  assert.match(why(w, back.event)!.claim, /given back its own rule after/);
});

test("at a general's death, with none chosen to follow, rule is given back the more often", () => {
  const w = fresh(),
    p = greatest(w),
    ctx = populationContext(w),
    o = orderOf(w)!.of(p.ref)!;
  seize(ctx, p, [], at(1));
  let heirless = 0;
  for (let k = 2; k < 200 && p.leadership === GENERAL; k++) {
    o.legitimacy = 0.4;
    // A general dies this year, and another is chosen: told as a succession.
    const t = at(k * YEAR),
      e = w.events.emit({
        type: POLITY_EVENTS.succession.type,
        subjects: [p.ref],
        place: null,
        data: { name: realmName(p), old: p.ruler.name, age: 60 },
      });
    p.ruler = { ...p.ruler, since: Math.floor((t - 1) / YEAR), event: e };
    heirless++;
    strifeYear(ctx, t);
  }
  assert.notEqual(p.leadership, GENERAL, "given back at a general's death");
  assert.ok(heirless <= 30, `within a few deaths (${heirless})`);
  const back = strifeOf(w)!.restorations.find((x) => x.realm === p.ref)!,
    d = w.decisions.get(w.events.get(back.event)!.causes[0]!.ref)!;
  assert.ok(
    d.factors.some((f) => f.name === "a general dead, none chosen to follow" && f.contribution > 0),
  );
});

test("a coup foiled: its plotters purged, its army cowed twenty years, the court the firmer", () => {
  const w = fresh(),
    p = greatest(w),
    ctx = populationContext(w),
    o = orderOf(w)!.of(p.ref)!,
    before = o.legitimacy,
    event = foil(ctx, p, [], at(1)),
    store = strifeOf(w)!;
  assert.equal(store.of(p.ref)!.purged, 60 + STRIFE.purged);
  assert.ok(o.legitimacy > before, "the court the firmer");
  assert.notEqual(p.leadership, GENERAL);
  assert.match(why(w, event)!.claim, /A coup in .* was foiled/);
  // Cowed: no coup is weighed before the purge is past, however doubted its rule.
  for (let k = 1; k < STRIFE.purged - 1; k++) {
    doubted(w, p);
    strifeYear(ctx, at(k * YEAR));
  }
  assert.equal(store.coups.filter((c) => c.realm === p.ref).length, 1, "none while cowed");
});

test("the god stirs an army against its seat, and gives a realm back its rule; asked where its army does not rule, refuses", () => {
  const w = fresh(),
    p = greatest(w);
  assert.throws(() => w.submit("act.restore", { cell: p.seat }), /its army does not rule it/);
  let tries = 0;
  while (p.leadership !== GENERAL && tries++ < 12) {
    w.submit("act.incite", { cell: p.seat });
    w.runTo(w.now + 3);
    // (A foiled coup cows the army; the god's hand does not wait on that.)
  }
  assert.equal(p.leadership, GENERAL, "the stirred army seized the seat");
  const coup = strifeOf(w)!.coups.findLast((c) => c.realm === p.ref)!,
    stirred = w.events.get(w.events.get(coup.event)!.causes[0]!.ref)!;
  assert.equal(stirred.type, STRIFE_ACTS.incite.type, "stirred by the god's hand");
  w.submit("act.restore", { cell: p.seat });
  w.runTo(w.now + 3);
  assert.notEqual(p.leadership, GENERAL, "its own rule given back");
  const back = strifeOf(w)!.restorations.at(-1)!;
  assert.equal(
    w.events.get(w.events.get(back.event)!.causes[0]!.ref)!.type,
    STRIFE_ACTS.restore.type,
  );
});

test("strife is kept whole by a save, goes on alike after it, and the world replays", () => {
  const w = fresh(),
    p = greatest(w),
    ctx = populationContext(w);
  seize(ctx, p, [], at(1));
  foil(ctx, greatest(w), [], at(2));
  const again = loadWorld(saveWorld(w, RULESET), build, RULESET).world;
  assert.deepEqual(strifeOf(again)!.save(), strifeOf(w)!.save());
  for (let k = 2; k < 8; k++) {
    strifeYear(populationContext(w), at(k * YEAR));
    strifeYear(populationContext(again), at(k * YEAR));
  }
  assert.deepEqual(strifeOf(again)!.save(), strifeOf(w)!.save());
  assert.equal(STRIFE_EVENTS.coup.type, "strife.coup");
  const r = fresh();
  r.runTo(62 * YEAR);
  assert.deepEqual(verifyByReplay(saveWorld(r, RULESET), build), { ok: true, problem: null });
});

test("restore() gives a protectorate back its rule at once", () => {
  const w = fresh(),
    p = greatest(w),
    ctx = populationContext(w);
  seize(ctx, p, [], at(1));
  assert.ok(restore(ctx, p, [], at(2)));
  assert.notEqual(p.leadership, GENERAL);
  assert.equal(restore(ctx, p, [], at(3)), null, "nothing to give back now");
});
