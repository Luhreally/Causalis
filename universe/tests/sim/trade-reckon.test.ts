// What those who would send a new run reckon on losing (galaxy-plan.md, Phase 71): what they lost on that lane,
// or else what they are losing on all their lanes; old losses fade, so a lane can be tried again.
import { test } from "node:test";
import assert from "node:assert/strict";
import { reckonOn } from "../../src/sim/space/trade.ts";
import type { TradeStore } from "../../src/sim/space/trade-store.ts";
import type { Ref } from "../../src/kernel/index.ts";

const US = "civ:0:1" as Ref,
  THEM = "civ:0:2" as Ref;
const run = (realm: Ref, to: number, risk: number, closedYear: number | null) => ({
  realm,
  to,
  risk,
  closedYear,
});
const store = (...runs: ReturnType<typeof run>[]) => ({ all: () => runs }) as unknown as TradeStore;
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);

test("no one reckons on losing what they have never sent", () => {
  assert.equal(reckonOn(store(), US, 1, 1000), 0);
  assert.equal(reckonOn(store(run(THEM, 1, 0.9, null)), US, 1, 1000), 0);
});

test("a lane closed by its losses is remembered, and fades until those who lost it are gone", () => {
  const lost = store(run(US, 1, 0.8, 1000));
  near(reckonOn(lost, US, 1, 1000), 0.8);
  near(reckonOn(lost, US, 1, 1050), 0.4);
  assert.equal(reckonOn(lost, US, 1, 1100), 0);
  assert.equal(reckonOn(lost, US, 1, 1500), 0);
});

test("a people whose every hold is being taken does not simply try the next land along", () => {
  const bleeding = store(run(US, 1, 0.7, null), run(US, 2, 0.5, null));
  near(reckonOn(bleeding, US, 3, 1000), 0.6);
});

test("one bad lane among many does not stop the rest, but stays dear itself", () => {
  const many = store(
    run(US, 1, 0.8, null),
    run(US, 2, 0, null),
    run(US, 3, 0, null),
    run(US, 4, 0, null),
  );
  near(reckonOn(many, US, 5, 1000), 0.2);
  near(reckonOn(many, US, 1, 1000), 0.8);
});
