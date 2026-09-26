import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import {
  LEDGER,
  POLITY_EVENTS,
  WAY,
  WAY_TRAITS,
  institutionsOf,
  loreOf,
  makePopulationWorld,
  marketsOf,
  politiesOf,
  populationContext,
  type Ways,
} from "../../src/sim/index.ts";
import { spine, why } from "../../src/causal/index.ts";

const world = makePopulationWorld(seedFromText("first light"), { start: "spread" });
world.runTo(300 * YEAR);
const ctx = populationContext(world),
  realms = politiesOf(world);

test("realms gather around market towns, and hold lands within reach of their seat (three steps, more with writing and clerks)", () => {
  const living = realms.living();
  assert.ok(living.length >= 3, `${living.length} realms`);
  const g = ctx.generated;
  for (const p of living) {
    assert.ok(
      ctx.settlements.inProvince(p.seat).some((s) => s.market && s.name === p.town),
      "ruled from a market town",
    );
    // Every member reachable from the seat through members, in at most three steps.
    const members = new Set(p.members),
      d = new Map([[p.seat, 0]]),
      queue = [p.seat];
    for (let i = 0; i < queue.length; i++)
      for (let k = g.grid.offsets[queue[i]!]!; k < g.grid.offsets[queue[i]! + 1]!; k++) {
        const n = g.grid.neighbours[k]!;
        if (members.has(n) && !d.has(n)) {
          d.set(n, d.get(queue[i]!)! + 1);
          queue.push(n);
        }
      }
    const reach = 3 + loreOf(world).effect(p.seat, "reach");
    for (const c of p.members)
      assert.ok((d.get(c) ?? 99) <= reach, `${p.town}: land ${c} is ${d.get(c)} steps out`);
    assert.equal(realms.of(p.seat)?.ref, p.ref);
  }
});

test("how a realm is ruled comes from its people's ways, and holds against small drifts", () => {
  const ways = (set: Partial<Record<(typeof WAY_TRAITS)[number], number>>): Ways => ({
    cell: 0,
    traits: WAY_TRAITS.map((t) => set[t] ?? 0.5),
    base: WAY_TRAITS.map(() => 0.5),
    tongue: { onsets: 1, vowels: 1, codas: 1, endings: 1, seed: 1 },
    nudges: [],
    from: null,
  });
  assert.equal(
    institutionsOf(ways({ piety: 0.7, hierarchy: 0.6 })).leadership,
    3,
    "devout and ranked: a priest-king",
  );
  assert.equal(institutionsOf(ways({ hierarchy: 0.6 })).leadership, 0, "ranked: a chief");
  assert.equal(
    institutionsOf(ways({ hierarchy: 0.4, kinship: 0.6 })).leadership,
    1,
    "kin: a council of elders",
  );
  assert.equal(
    institutionsOf(ways({ hierarchy: 0.4, kinship: 0.4 })).leadership,
    2,
    "neither: an assembly",
  );
  // A chiefdom whose rank has eased a little stays a chiefdom; eased a lot, it does not.
  const chief = { leadership: 0, succession: 0, law: 0 };
  assert.equal(institutionsOf(ways({ hierarchy: 0.51 }), chief).leadership, 0);
  assert.notEqual(institutionsOf(ways({ hierarchy: 0.45 }), chief).leadership, 0);
  void WAY;
});

test("a realm explains itself back through its founding to the land and the star", () => {
  const p = realms.living().sort((a, b) => b.members.length - a.members.length)[0]!,
    node = why(world, p.ref);
  assert.equal(node.basis, "recorded");
  assert.match(
    node.claim,
    /^the (chiefdom|league|commonwealth|holy seat) of .*: \d+ lands? ruled from/,
  );
  const path = spine(world, p.ref),
    types = path.map(
      (n) =>
        world.events.get(n.ref as Ref)?.type ??
        world.decisions.get(n.ref as Ref)?.rule ??
        n.ref.split(":")[0],
    );
  assert.ok(types.includes(POLITY_EVENTS.formed.type), types.join(" ← "));
  assert.ok(types.includes("polity.form"), "through the decision to gather under one rule");
  assert.equal(path.at(-1)!.ref.split(":")[0], "star");
  // Joining says why too: alike speech, a road, the realm's strength.
  const joined = world.events.all().find((e) => e.type === POLITY_EVENTS.joined.type)!,
    decision = why(world, joined.id).causes[0]!.next();
  assert.match(decision.claim, /chose to join a realm, in year \d+ \(.*alike speech/);
});

test("rulers die and rule passes on; by birth it stays in the family", () => {
  const successions = world.events.all().filter((e) => e.type === POLITY_EVENTS.succession.type);
  assert.ok(successions.length >= 5, `${successions.length} successions`);
  const family = (name: string) => name.split(" ").slice(1).join(" ");
  const heirs = realms
    .all()
    .filter((p) => p.succession === 0 && p.ruler.since > p.founded)
    .map((p) => {
      const old = (world.events.get(p.ruler.event)?.data as { old?: string } | null)?.old;
      return old ? family(old) === family(p.ruler.name) : null;
    })
    .filter((x): x is boolean => x !== null);
  assert.ok(heirs.length >= 1, "some realm passes rule by birth");
  assert.ok(
    heirs.filter(Boolean).length >= Math.ceil(heirs.length / 2),
    `${heirs.filter(Boolean).length} of ${heirs.length} heirs kept the name`,
  );
});

test("tribute flows to the seats, and every market's books still balance", () => {
  const markets = marketsOf(world),
    IN = LEDGER.indexOf("in"),
    OUT = LEDGER.indexOf("out");
  const last = markets.all().map((m) => m.years.at(-1)!),
    sum = (line: number) =>
      last.reduce((s, y) => s + y.ledger[line]!.reduce((a, b) => a + b, 0), 0);
  assert.equal(sum(IN), sum(OUT), "what one market sends another receives");
  const seats = new Set(
    realms
      .living()
      .filter((p) => p.members.length > 1)
      .map((p) => p.seat),
  );
  const toSeats = markets
    .all()
    .filter((m) => seats.has(m.cell))
    .reduce((s, m) => s + m.years.at(-1)!.ledger[IN]![0]!, 0);
  assert.ok(toSeats > 0, "grain comes in to the seats");
});
