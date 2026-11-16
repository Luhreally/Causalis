// Choices put to a realm's people, where its rule has them (sim/order/elections.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, type SimTime } from "../../src/kernel/index.ts";
import {
  ELECTION_EVENTS,
  chooses,
  electionsOf,
  electionsYear,
  orderOf,
  politiesOf,
  populationContext,
  termOf,
} from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("kestrel", 400, { start: "spread" }),
  ctx = populationContext(world);

test("a realm whose rule passes by choice, its choices carried by many, chooses who governs each term", () => {
  const term = termOf(ctx);
  assert.ok(term >= 2 && term <= 12, `${term}`);
  const p = politiesOf(world).living()[0]!,
    o = orderOf(world)!.of(p.ref)!;
  // (Its rule made one that chooses: by choice, its choices carried by many.)
  p.succession = 1;
  o.held![1] = 80;
  assert.ok(chooses(world, p));
  const from = Math.floor(world.now / YEAR);
  for (let y = from + 1; y <= from + 2 * term + 1; y++) electionsYear(ctx, (y * YEAR) as SimTime);
  const v = electionsOf(world)!.of(p.ref)!;
  assert.ok(v.past.length >= 1, "no election in two terms");
  assert.ok(v.governing !== null);
  for (const e of v.past) {
    const sum = e.votes.reduce((s, [, x]) => s + x, 0);
    assert.ok(Math.abs(sum - 1) < 0.01, `${sum}`);
    assert.equal(e.group, e.votes[0]![0]);
    const ev = world.events.get(e.event)!;
    assert.equal(ev.type, ELECTION_EVENTS.elected.type);
    assert.match(why(world, e.event).claim, /chose/);
  }
  // (One whose choices fall back to a few is asked no more.)
  o.held![1] = 10;
  assert.ok(!chooses(world, p));
  electionsYear(ctx, ((from + 2 * term + 2) * YEAR) as SimTime);
  assert.equal(electionsOf(world)!.of(p.ref), undefined);
});
