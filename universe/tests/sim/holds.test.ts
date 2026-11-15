// How a realm is held, on a real world (sim/order/holds.ts): Earth's first light to year 400. Every living realm keeps its four numbers;
// some are told anew as history moves them; every realm's fortune is measured, and realms learn of rule from evidence (how a realm
// stood against how it fared, their own and others'), none of it a written lesson; and the realm's page and Learned tab say so in
// words composed of what was kept, and draw it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EARTH } from "../../src/host/planet.ts";
import { HOLD_EVENTS, learntOf, orderOf, politiesOf, taughtWords } from "../../src/sim/index.ts";
import { HOLD_KINDS, LEARNING, OUTCOME, leanOf } from "../../src/rules/index.ts";
import type { PageModel } from "../../src/bridge/index.ts";
import { universeWorld } from "../host/worlds.ts";

const world = universeWorld(EARTH, "first light", 400);
const store = orderOf(world)!,
  living = politiesOf(world).living();
const events = (type: string) => {
  const out = [];
  for (let i = 0; i < world.events.count; i++)
    if (world.events.at(i).type === type) out.push(world.events.at(i));
  return out;
};

test("every living realm keeps four numbers, whole hundredths of 0 … 100, and they differ between realms", () => {
  assert.ok(living.length > 5);
  const seen = new Set<string>();
  for (const p of living) {
    const held = store.of(p.ref)?.held;
    assert.ok(held && held.length === 4, `${p.ref} keeps its numbers`);
    for (const v of held) assert.ok(Number.isInteger(v) && v >= 0 && v <= 100, `${p.ref}: ${held}`);
    seen.add(held.join(","));
  }
  assert.ok(seen.size > living.length / 3, `${seen.size} kinds among ${living.length} realms`);
});

test("history moves them: realms told held anew, and lessons of rule, each with an outcome, a blame and a change", () => {
  const held = events(HOLD_EVENTS.held.type),
    lessons = events(HOLD_EVENTS.lesson.type);
  assert.ok(held.length > 0, "some realm came to be held otherwise");
  assert.ok(lessons.length > 0, "some realm learned of rule");
  for (const e of lessons) {
    const d = e.data as { outcome: string; blame: string };
    assert.ok(d.outcome && d.blame, JSON.stringify(d));
  }
  const taught = living.flatMap((p) => store.of(p.ref)?.taught ?? []);
  assert.ok(taught.length > 0, "realms keep what they learned");
});

test("a realm's page tells how it is held, and its Learned tab what befell it and others", () => {
  const page = (ref: string) => EARTH.queries.page!(world, { ref }) as PageModel,
    text = (p: PageModel) => JSON.stringify(p.tabs.flatMap((t) => t.blocks));
  const p = living.find((x) => store.of(x.ref)?.taught?.length)!;
  assert.ok(p, "a realm that learned of rule");
  const all = text(page(p.ref));
  assert.match(all, /How it is held/);
  assert.match(all, /Who bears arms/);
  assert.match(all, /Who decides/);
  assert.match(all, /How word moves/);
  assert.match(all, /From what befell them and others/);
  assert.doesNotMatch(all, /\{them\}|undefined|NaN/);
});

test("a number told anew says since what: the coup, the revolution, or the lesson behind the weighing that moved it", () => {
  const p = living.find((x) => store.of(x.ref)?.heldEvents?.some((e) => e));
  assert.ok(p, "a realm with a number told anew");
  const all = JSON.stringify(
    (EARTH.queries.page!(world, { ref: p.ref }) as PageModel).tabs.flatMap((t) => t.blocks),
  );
  // (The words, then what it stands since, a link: ", since ", {"text":"the coup of year 412", …}.)
  assert.match(all, /", since ",\{"text":"[a-z' ]*year \d+"/);
});

test("every living realm's fortune is measured, and no realm gone keeps evidence: what is kept does not grow with history", () => {
  for (const p of living) {
    const o = store.of(p.ref)!;
    if (!o.was) continue;
    assert.equal(o.was.length, 5, `${p.ref} measured`);
    for (const x of o.fortune ?? []) assert.ok(Number.isInteger(x) && x >= -100 && x <= 100);
    assert.ok((o.taught?.length ?? 0) <= LEARNING.taught);
    assert.ok((o.from?.length ?? 0) <= LEARNING.teachers);
    if (o.learnt) assert.equal(o.learnt.length, 16);
  }
  // (And what is kept is what a save gives back: no nothing below nothing, which a save writes as nothing.)
  assert.deepEqual(JSON.parse(JSON.stringify(store.save())), store.save());
  assert.ok(living.filter((p) => store.of(p.ref)?.fortune).length > living.length / 2);
  for (const o of store.realms.values())
    if (!living.some((p) => p.ref === o.realm))
      assert.ok(
        !o.learnt && !o.fortune && !o.was && !o.from,
        `${o.realm} is gone and keeps evidence`,
      );
});

test("beliefs come of evidence and differ between realms; a piece of evidence says how the realm stood, how it fared and what it moved", () => {
  const leans = living
    .map((p) => store.of(p.ref))
    .filter((o) => o?.learnt)
    .map((o) => HOLD_KINDS.map((_, k) => leanOf(learntOf(o), k, 400)));
  assert.ok(
    leans.length > living.length / 2,
    `${leans.length} of ${living.length} realms believe something`,
  );
  for (let k = 0; k < 4; k++) {
    const v = leans.map((l) => l[k]!);
    assert.ok(
      Math.max(...v) > 0.05 && Math.min(...v) < -0.05,
      `${HOLD_KINDS[k]}: some for, some against (${Math.min(...v)} … ${Math.max(...v)})`,
    );
    for (const x of v) assert.ok(x > -1 && x < 1);
  }
  const taught = living.flatMap((p) => store.of(p.ref)?.taught ?? []);
  assert.ok(taught.some((x) => x.of) && taught.some((x) => !x.of), "their own fates and others'");
  for (const x of taught) {
    assert.ok(x.leaned?.length === 4 && x.came && x.moved?.length === 4, JSON.stringify(x));
    const words = taughtWords(x);
    assert.match(
      words,
      /^(After|Seeing) .+ (stood|standing) (more than most with|much as most do)/,
      words,
    );
    assert.match(words, /fared (ill|well|neither)/, words);
    assert.doesNotMatch(words, /undefined|NaN|\{them\}/);
  }
  // (Whom a realm learned from is another realm, never itself.)
  for (const p of living)
    for (const [ref] of store.of(p.ref)?.from ?? []) assert.notEqual(ref, p.ref);
});

test("the Learned tab draws it: what it has seen work, where it came from, whom it learned from", () => {
  const p = living.find((x) => {
    const o = store.of(x.ref);
    return (
      o?.learnt &&
      o.taught?.some((t) => t.moved) &&
      o.from?.length &&
      HOLD_KINDS.some((_, k) => Math.abs(leanOf(learntOf(o), k, 400)) >= 0.03)
    );
  })!;
  assert.ok(p, "a realm with beliefs, evidence and teachers");
  const page = EARTH.queries.page!(world, { ref: p.ref }) as PageModel,
    blocks = page.tabs.find((t) => t.id === "learned")!.blocks,
    beliefs = blocks.find((b) => b.type === "beliefs"),
    evidence = blocks.find((b) => b.type === "evidence"),
    taughtBy = blocks.find((b) => b.type === "taught");
  assert.ok(beliefs?.type === "beliefs" && beliefs.rows.length === 4);
  for (const r of beliefs.rows) {
    assert.ok(r.now >= 0 && r.now <= 1 && r.lean > -1 && r.lean < 1 && r.sure >= 0 && r.sure < 1);
    assert.ok(r.low && r.high && r.low !== r.high, `${r.label}: its two ends named`);
    assert.ok(r.stood.length >= 1 && r.leans.length >= 1);
    assert.equal(r.stood.at(-1)!.y, r.now, "its run ends where it stands");
  }
  assert.ok(evidence?.type === "evidence" && evidence.marks.length > 0);
  for (const m of evidence.marks) {
    assert.ok(m.year >= evidence.from && m.year <= evidence.to && m.ref && m.moved.length === 4);
    assert.ok(world.events.get(m.ref as never), "its event is kept, to be opened");
  }
  assert.ok(taughtBy?.type === "taught" && taughtBy.from.length > 0);
  const shares = taughtBy.from.reduce((s, x) => s + x.share, 0);
  assert.ok(Math.abs(shares - 1) < 1e-6);
});

test("no line says one thing and its opposite: what befell a realm and how it fared are told together where they agree, apart where they part", () => {
  // (Every piece every realm keeps, living or gone.)
  const all = [...store.realms.values()].flatMap((o) => o.taught ?? []);
  assert.ok(all.length > 50, `${all.length} pieces`);
  let parted = 0;
  for (const x of all) {
    const words = taughtWords(x),
      good = !!OUTCOME.get(x.what)?.good,
      y = (x.came?.[0] ?? 0) / 100,
      parts = Math.abs(y) >= 0.05 && y > 0 !== good;
    if (parts) parted++;
    assert.equal(/, though over those years|, which had yet /.test(words), parts, words);
    // The patterns found on first light before this: a war lost told with lands won, a war won with lands lost, a fall or a
    // rising told as faring well, a friend's coming as faring ill, each as if one thing.
    assert.doesNotMatch(words, /a war (lost|that gained them nothing), in years [^.]*fared well/);
    assert.doesNotMatch(words, /a war (won|withstood), in years [^.]*fared ill/);
    assert.doesNotMatch(
      words,
      /(overthrown|drowned in blood|seized|could not pay|never repaid|stood aside)[^.]*, in years [^.]*fared well/,
    );
    assert.doesNotMatch(
      words,
      /Seeing the (fall|overthrow|seizing|rising)[^.]*, which stood [^.]*fared well/,
    );
    assert.doesNotMatch(words, /a friend who came[^.]*, in years [^.]*fared ill/);
  }
  assert.ok(parted > 0, "some realm fared against what befell it, and its line says so");
});
