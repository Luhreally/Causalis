import { test } from "node:test";
import assert from "node:assert/strict";
import { type Ref } from "../../src/kernel/index.ts";
import {
  GROUPS,
  POLITY_EVENTS,
  formFromPowers,
  interestsOf,
  politiesOf,
  populationContext,
  swayOf,
} from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";
import { peopledWorld } from "../worlds.ts";

const PEOPLE = {
  farmers: 5000,
  herders: 800,
  crafters: 400,
  traders: 120,
  "the court": 60,
  "the army": 150,
};
// (A realm's numbers, force, voice, word and trust: one who decides with a host kept, a few in council, all who choose.)
const ONE = [0.85, 0.1, 0.3, 0.5],
  FEW = [0.5, 0.35, 0.5, 0.5],
  ALL = [0.3, 0.85, 0.7, 0.5],
  HELD_BY_ARMS = [0.95, 0.05, 0.2, 0.3];

test("sway is shared among the groups, read off who holds which powers", () => {
  for (const held of [ONE, FEW, ALL, HELD_BY_ARMS]) {
    const s = swayOf(PEOPLE, held, 0.7, true, true);
    const total = GROUPS.reduce((a, g) => a + s[g], 0);
    assert.ok(Math.abs(total - 1) < 1e-9, `shares sum to one (${total})`);
  }
  const all = swayOf(PEOPLE, ALL, 0.5, false, false),
    few = swayOf(PEOPLE, FEW, 0.5, false, false),
    devout = swayOf(PEOPLE, FEW, 0.75, true, true);
  assert.ok(all.farmers > few.farmers, "where all choose, the many are heard");
  assert.ok(few["the court"] > all["the court"], "where a few choose, those who lead");
  assert.ok(
    devout["the temple"] > few["the temple"],
    "a devout people and a sacred law, the temple",
  );
  assert.equal(all["the temple"], 0, "no faith, no temple");
  // (Where the arms are all the seat's and one decides, those who bear them above the many.)
  const armed = swayOf(PEOPLE, HELD_BY_ARMS, 0.5, false, false);
  assert.ok(armed["the army"] > all["the army"] * 2, "arms kept from the people, the army");
  assert.ok(armed["the army"] > armed.farmers, "the army over the many where one holds the arms");
  // (Among the many, where their voice is small, wealth buys sway; where every head counts, heads do.)
  const rich = { traders: 50, farmers: 1 },
    poorVoice = swayOf(PEOPLE, ONE, 0.5, false, false, rich),
    fullVoice = swayOf(PEOPLE, ALL, 0.5, false, false, rich);
  assert.ok(
    poorVoice.traders / poorVoice.farmers > fullVoice.traders / fullVoice.farmers,
    "wealth weighs more where few choose",
  );
});

test("a realm's rule is read off who holds which powers, and holds near a line", () => {
  const was = { leadership: 0, succession: 0, law: 0 },
    court = { "the court": 0.5, "the army": 0.2, "the temple": 0.05 },
    temple = { "the court": 0.2, "the army": 0.1, "the temple": 0.5 };
  assert.deepEqual(formFromPowers([0.8, 0.1, 0.3, 0.5], court, was, true), {
    leadership: 0,
    succession: 0,
    law: 1,
  });
  assert.equal(formFromPowers([0.8, 0.1, 0.3, 0.5], temple, was, true).leadership, 3);
  assert.equal(formFromPowers([0.8, 0.1, 0.3, 0.5], temple, was, true).law, 2);
  assert.equal(formFromPowers([0.5, 0.4, 0.5, 0.5], court, was, true).leadership, 1);
  const all = formFromPowers([0.3, 0.8, 0.7, 0.5], court, was, true);
  assert.equal(all.leadership, 2);
  assert.equal(all.succession, 1, "many choose");
  assert.equal(
    formFromPowers([0.2, 0.2, 0.5, 0.5], court, was, false).succession,
    2,
    "the armed acclaim",
  );
  assert.equal(
    formFromPowers([0.8, 0.1, 0.3, 0.5], court, was, false).law,
    0,
    "no writing, custom",
  );
  // (An assembly stays one a little under its line: a realm does not reform at every flicker.)
  assert.equal(formFromPowers([0.3, 0.57, 0.7, 0.5], court, all, true).leadership, 2);
  assert.equal(formFromPowers([0.3, 0.57, 0.7, 0.5], court, was, true).leadership, 1);
});

const world = peopledWorld("kestrel", 400, { start: "spread" });
const ctx = populationContext(world);

test("every realm's groups make demands that rest on something in the world", () => {
  const realms = politiesOf(world).living();
  assert.ok(realms.length >= 3);
  let sourced = 0,
    demands = 0;
  for (const p of realms)
    for (const i of interestsOf(ctx, p, world.now))
      for (const d of i.demands) {
        demands++;
        assert.ok(d.strength > 0 && d.strength <= 1);
        if (d.want === "peace" || d.want === "war")
          assert.ok(d.toward, "peace or war with someone");
        if (d.source) {
          sourced++;
          assert.ok(world.events.get(d.source), `${d.name} rests on a kept event`);
        }
      }
  assert.ok(sourced >= demands * 0.9, `${sourced} of ${demands} demands rest on something`);
});

test("the tithe moves with what the groups want: raised for war, eased when it is over", () => {
  const moves = world.events.all().filter((e) => e.type === POLITY_EVENTS.tithe.type);
  assert.ok(moves.length >= 10, `${moves.length} changes of tithe`);
  let raisedForWar = 0;
  for (const e of moves) {
    const d = world.decisions.get(e.causes[0]!.ref as Ref)!,
      { from, to } = e.data as { from: number; to: number };
    assert.equal(d.rule, "polity.tithe");
    assert.ok(Math.abs(to - from) >= 2 && to >= 2 && to <= 15, `${from} → ${to}`);
    assert.ok(
      d.factors.some((f) => (to > from ? f.contribution > 0 : f.contribution < 0)),
      "a demand pressed the way it moved",
    );
    if (
      to > from &&
      d.factors.some(
        (f) => f.source && world.events.get(f.source.ref as Ref)?.type === "war.declared",
      )
    )
      raisedForWar++;
    assert.match(why(world, e.id).claim, /(raised|eased) its tithe from \d+ to \d+ parts/);
  }
  assert.ok(raisedForWar >= 1, "some tithe was raised for a war");
  for (const p of politiesOf(world).living()) assert.ok(p.tribute >= 0.02 && p.tribute <= 0.15);
});
