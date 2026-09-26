import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import {
  DIPLOMACY_EVENTS,
  POLITY_EVENTS,
  diplomacyOf,
  makePopulationWorld,
  marketsOf,
  politiesOf,
  populationContext,
  relationRef,
} from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";

// Juniper's land stays divided among many realms, who meet at borders and down roads.
const world = makePopulationWorld(seedFromText("juniper"), { start: "spread" });
world.runTo(400 * YEAR);
const ctx = populationContext(world),
  realms = politiesOf(world),
  relations = diplomacyOf(world).all();

test("what realms think of each other is the sum of its reasons", () => {
  assert.ok(relations.length >= 5, `${relations.length} relations`);
  for (const r of relations) {
    const sum = Math.max(
      -1,
      Math.min(
        1,
        r.terms.reduce((s, t) => s + t.value, 0),
      ),
    );
    assert.ok(Math.abs(r.opinion - sum) < 1e-9);
    assert.ok(r.terms.length >= 1);
  }
});

test("only realms that meet — at a border or down a trade road — keep a regard", () => {
  const g = ctx.generated,
    flows = marketsOf(world).flows;
  for (const r of relations) {
    const a = realms.get(r.a)!,
      b = realms.get(r.b)!;
    assert.equal(a.ended, null);
    assert.equal(b.ended, null);
    const border = a.members.some((c) => {
      for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++)
        if (b.members.includes(g.grid.neighbours[k]!)) return true;
      return false;
    });
    const traded = flows.some(
      (f) =>
        (a.members.includes(f.from) && b.members.includes(f.to)) ||
        (b.members.includes(f.from) && a.members.includes(f.to)),
    );
    assert.ok(border || traded, `${a.town} and ${b.town} meet`);
  }
});

test("pacts are sworn and kept only while realms think well enough of each other", () => {
  const sworn = world.events.all().filter((e) => e.type === DIPLOMACY_EVENTS.pact.type);
  assert.ok(sworn.length >= 1, "some realms swore friendship");
  for (const r of relations) if (r.pact) assert.ok(r.opinion >= 0, "a standing pact is not soured");
});

test("a regard explains itself, reason by reason, from what each reason rests on", () => {
  const r = [...relations].sort((x, y) => x.opinion - y.opinion)[0]!,
    node = why(world, relationRef(r.a, r.b));
  assert.match(
    node.claim,
    / are (sworn friends|friendly|at peace|wary of each other|rivals) \([+-]\d\.\d\d\): /,
  );
  const sourced = r.terms.filter((t) => t.source).length;
  assert.equal(node.causes.length, Math.min(6, sourced + (r.pact ? 1 : 0)));
});

test("a land taken from one realm by another is remembered, and names the joining", () => {
  const taken = relations.flatMap((r) => r.terms.filter((t) => t.name === "a land they took"));
  for (const t of taken) {
    const e = world.events.get(t.source as Ref)!;
    assert.equal(e.type, POLITY_EVENTS.joined.type);
    assert.ok((e.data as { from?: string }).from, "the joining names the realm the land left");
  }
});
