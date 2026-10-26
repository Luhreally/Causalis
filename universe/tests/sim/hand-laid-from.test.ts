// The hand laid from one of a town's people (Phase 54; asked for 2026-10-26: "how come i cant bless
// or inspire people anymore ... when i clikc on a person"): tapped in the town and blessed or
// inspired, the god's hand is laid on their town from them, and they are among its people by the
// name they were known by — the nearest of their sex and work in age — so the act touches them.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  verifyByReplay,
  type World,
} from "../../src/kernel/index.ts";
import {
  LOCAL_ACT_EVENTS,
  agentName,
  handOf,
  laidFromAgent,
  makePopulationWorld,
  populationContext,
  type Agent,
} from "../../src/sim/index.ts";
import { cradleCell } from "../cradle.ts";

const seed = seedFromText("first light"),
  HOME = cradleCell("first light");

function townOf(w: World) {
  return populationContext(w)
    .settlements.inProvince(HOME)
    .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))[0]!;
}

test("of their sex and work the nearest in age, else of their sex, else anyone", () => {
  const a = (id: number, sex: number, born: number, occupation: number): Agent => ({
    id,
    sex,
    birthYear: born,
    occupation,
  });
  const agents = [a(0, 0, 70, 2), a(1, 1, 60, 2), a(2, 1, 75, 3), a(3, 1, 80, 2)];
  // 100 − 25 = 75: the man of work 2 nearest 25 is the one born 80 (20), not 60 (40).
  assert.equal(laidFromAgent(agents, { name: "X", age: 25, occupation: 2, sex: 1 }, 100)?.id, 3);
  // No woman of work 3: the woman nearest in age.
  assert.equal(laidFromAgent(agents, { name: "X", age: 50, occupation: 3, sex: 0 }, 100)?.id, 0);
  // Of no sex given: anyone of their work.
  assert.equal(laidFromAgent(agents, { name: "X", age: 25, occupation: 3 }, 100)?.id, 2);
  assert.equal(laidFromAgent([], { name: "X", age: 25, occupation: 3 }, 100), null);
});

test("laid from one of its people, they are among them by their name, and blessed", () => {
  const w = makePopulationWorld(seed);
  w.runTo(240 * YEAR);
  const town = townOf(w);
  w.submit("hand.lay", {
    village: town.ref,
    as: { name: "Asha Vorath", age: 30, occupation: 2, sex: 0 },
  });
  w.runTo(240 * YEAR + 1);
  const hand = handOf(w).resting!,
    named = hand.agents.filter((a) => a.name === "Asha Vorath");
  assert.equal(named.length, 1, "one of the hand's people is known by the name");
  const asha = named[0]!;
  assert.equal(asha.sex, 0);
  assert.equal(agentName(populationContext(w), asha, town), "Asha Vorath");
  // The rest keep the names their tongue gives them.
  const other = hand.agents.find((a) => a !== asha)!;
  assert.match(agentName(populationContext(w), other, town), / of /);
  w.submit("act.bless-one", { agent: asha.id });
  w.runTo(240 * YEAR + 2);
  assert.ok(asha.blessedUntil !== undefined && asha.blessedUntil > 240);
  const data = (e: { data: unknown }) => e.data as { agent: number; name: string },
    blessed = w.events
      .all()
      .find((e) => e.type === LOCAL_ACT_EVENTS.blessOne.type && data(e).agent === asha.id);
  assert.equal(
    blessed && data(blessed).name,
    "Asha Vorath",
    "history names them as they were known",
  );
  // Kept with the world, and replayed bit for bit.
  const ruleset = rulesetId(w, "test"),
    doc = saveWorld(w, ruleset),
    build = () => makePopulationWorld(seed);
  assert.deepEqual(verifyByReplay(doc, build), { ok: true, problem: null });
  const again = loadWorld(doc, build, ruleset).world;
  assert.equal(handOf(again).resting!.agents.find((a) => a.id === asha.id)?.name, "Asha Vorath");
});

test("a hand laid from no one is laid as before: no one named, the same people", () => {
  const plain = makePopulationWorld(seed),
    named = makePopulationWorld(seed);
  plain.runTo(240 * YEAR);
  named.runTo(240 * YEAR);
  const town = townOf(plain);
  plain.submit("hand.lay", { village: town.ref });
  named.submit("hand.lay", {
    village: town.ref,
    as: { name: "Asha Vorath", age: 30, occupation: 2, sex: 0 },
  });
  plain.runTo(240 * YEAR + 1);
  named.runTo(240 * YEAR + 1);
  const p = handOf(plain).resting!.agents,
    n = handOf(named).resting!.agents;
  assert.ok(p.every((a) => a.name === undefined));
  // The same people drawn; only the one it was laid from carries a name.
  assert.deepEqual(
    n.map(({ name: _, ...a }) => a),
    p.map((a) => ({ ...a })),
  );
});

test("the one it is laid from must be someone", () => {
  const w = makePopulationWorld(seed);
  w.runTo(240 * YEAR);
  const town = townOf(w);
  for (const as of [
    null,
    { name: "", age: 30, occupation: 2 },
    { name: "A", age: -1, occupation: 2 },
    { name: "A", age: 30, occupation: 99 },
    { name: "A", age: 30, occupation: 2, sex: 5 },
  ])
    assert.throws(() => w.submit("hand.lay", { village: town.ref, as }), /as must be/);
});
