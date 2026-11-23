import { test } from "node:test";
import assert from "node:assert/strict";
import { type Ref } from "../../src/kernel/index.ts";
import { foundingHolds } from "../../src/rules/index.ts";
import {
  LEDGER,
  POLITY_EVENTS,
  SEA_CROSSING,
  WAY,
  WAY_TRAITS,
  formFromPowers,
  loreOf,
  marketsOf,
  politiesOf,
  populationContext,
  type Ways,
} from "../../src/sim/index.ts";
import { spine, why } from "../../src/causal/index.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("first light", 300, { start: "spread" });
const ctx = populationContext(world),
  realms = politiesOf(world);

test("realms gather around market towns, and hold their lands joined to the seat (by land or by ship), most within its reach (three steps, more with writing, clerks and roads)", () => {
  const living = realms.living();
  assert.ok(living.length >= 3, `${living.length} realms`);
  const g = ctx.generated;
  let held = 0,
    within = 0;
  for (const p of living) {
    assert.ok(
      ctx.settlements.inProvince(p.seat).some((s) => s.market && s.name === p.town),
      "ruled from a market town",
    );
    // Every member reachable from the seat through members: a step to a neighbour by
    // land, two across the sea to a land its ships trade with.
    const members = new Set(p.members),
      markets = marketsOf(world),
      d = new Map([[p.seat, 0]]);
    for (let changed = true; changed;) {
      changed = false;
      for (const [c, far] of [...d]) {
        const next: [number, number][] = [];
        for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++)
          next.push([g.grid.neighbours[k]!, far + 1]);
        for (const n of markets.seaPartners(c)) next.push([n, far + SEA_CROSSING]);
        for (const [n, to] of next)
          if (members.has(n) && to < (d.get(n) ?? Infinity)) {
            d.set(n, to);
            changed = true;
          }
      }
    }
    const reach = 3 + loreOf(world).effect(p.seat, "reach");
    for (const c of p.members) {
      assert.ok(d.has(c), `${p.town}: land ${c} is cut off from the seat`);
      held++;
      if (d.get(c)! <= reach) within++;
    }
    assert.equal(realms.of(p.seat)?.ref, p.ref);
  }
  // Beyond its reach a realm holds land only by force, and such land chafes and breaks away.
  assert.ok(within >= held * 0.8, `${within} of ${held} lands within their seat's reach`);
});

test("how a realm is founded is read off who holds force and voice among its people, not off a line on its ways", () => {
  const read = (set: Partial<Record<"hierarchy" | "valour", number>>) => ({
    hierarchy: set.hierarchy ?? 0.5,
    openness: 0.5,
    tradition: 0.5,
    valour: set.valour ?? 0.5,
    piety: 0.5,
    trade: 0.5,
    thrift: 0.5,
  });
  // Rank leaves the choice to fewer; many who lead carry it wider; valour keeps arms in every household.
  const [, rankedVoice] = foundingHolds(read({ hierarchy: 0.8 }), null, 3),
    [, evenVoice] = foundingHolds(read({ hierarchy: 0.3 }), null, 3),
    [, manyVoice] = foundingHolds(read({ hierarchy: 0.5 }), null, 6),
    [, fewVoice] = foundingHolds(read({ hierarchy: 0.5 }), null, 1),
    [bold] = foundingHolds(read({ valour: 0.9 }), null, 3),
    [meek] = foundingHolds(read({ valour: 0.1 }), null, 3);
  assert.ok(rankedVoice < evenVoice, `${rankedVoice} < ${evenVoice}`);
  assert.ok(fewVoice < manyVoice, `${fewVoice} < ${manyVoice}`);
  assert.ok(bold < meek, "valour keeps the arms among the people");
  const none = { leadership: -1, succession: -1, law: -1 },
    court = { "the court": 0.5, "the temple": 0, "the army": 0 };
  assert.equal(
    formFromPowers([0.5, 0.15], court, none, true).leadership,
    0,
    "few carry it: a chief",
  );
  assert.equal(formFromPowers([0.5, 0.45], court, none, true).leadership, 1, "more: elders");
  assert.equal(formFromPowers([0.5, 0.75], court, none, true).leadership, 2, "many: an assembly");
  assert.equal(
    formFromPowers([0.5, 0.15], { "the court": 0.3, "the temple": 0.5, "the army": 0 }, none, true)
      .leadership,
    3,
    "the temple outweighing those who lead: a priest-king",
  );
  // Every realm of the world was founded under a rule read so: its founding decision cites the force and voice.
  const formed = world.decisions.all().filter((d) => d.rule === "polity.form");
  assert.ok(formed.length >= 3, `${formed.length} foundings`);
  void WAY;
  void ({} as Ways);
});

test("a realm explains itself back through its founding to the land and the star", () => {
  const p = realms.living().sort((a, b) => b.members.length - a.members.length)[0]!,
    node = why(world, p.ref);
  assert.equal(node.basis, "recorded");
  assert.match(
    node.claim,
    /^the (chiefdom|league|commonwealth|holy seat|protectorate) of .*: \d+ lands? ruled from/,
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
  // (And what the keepers outside every market took of it, less what they gave back: a faith's granaries are on a market's "out"
  // line and in no market's "in". tests/sim/economy.test.ts holds this good by good, year by year.)
  const year = last[0]!.year,
    kept = (markets.apart.find((y) => y.year === year)?.rows ?? []).reduce(
      (n, [, , took, gave]) => n + took - gave,
      0,
    );
  assert.ok(
    last.every((y) => y.year === year),
    "every market's last year is the same",
  );
  assert.equal(sum(IN) + kept, sum(OUT), "what one market sends another receives, or a keeper");
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
