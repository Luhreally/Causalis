import { test } from "node:test";
import assert from "node:assert/strict";
import { DAY, MONTH, Scheduler, YEAR, type SimTime } from "../../src/kernel/index.ts";
import { makeToyWorld, type ToyPopulation } from "../fixtures/toy.ts";

const chainOf = (w: ReturnType<typeof makeToyWorld>) => w.checkpoints().map((c) => c.chain);

test("systems run on their cadence, in order-key order, after the start", () => {
  const s = new Scheduler(0 as SimTime),
    log: string[] = [];
  s.addSystem({ key: "050.b", every: 10, run: (t) => log.push(`b${t}`) });
  s.addSystem({ key: "040.a", every: 5, offset: 2, run: (t) => log.push(`a${t}`) });
  s.addHandler({ type: "x", key: "045.x", run: (i, t) => log.push(`x${t}:${i.subject}`) });
  s.schedule(10, "x", "two");
  s.schedule(10, "x", "one");
  s.runTo(20);
  assert.deepEqual(log, ["a2", "a7", "x10:one", "x10:two", "b10", "a12", "a17", "b20"]);
  assert.equal(s.now, 20);
});

test("the scheduler refuses ambiguous or impossible work", () => {
  const s = new Scheduler(0 as SimTime);
  s.addSystem({ key: "010.a", every: 5, run: () => {} });
  assert.throws(() => s.addSystem({ key: "010.a", every: 7, run: () => {} }), /two systems/);
  assert.throws(() => s.addSystem({ key: "population", every: 7, run: () => {} }), /order key/);
  assert.throws(() => s.addSystem({ key: "011.b", every: 5, offset: 5, run: () => {} }), /offset/);
  s.addHandler({ type: "x", key: "020.x", run: () => {} });
  assert.throws(() => s.schedule(0, "x", "now"), /after now/);
  assert.throws(() => s.schedule(10, "y", "none"), /no handler/);
});

test("the same seed gives the same chain; another seed does not", () => {
  const a = makeToyWorld("alpha"),
    b = makeToyWorld("alpha"),
    c = makeToyWorld("beta");
  a.runTo(20 * YEAR);
  b.runTo(20 * YEAR);
  c.runTo(20 * YEAR);
  assert.equal(a.checkpoints().length, 20);
  assert.deepEqual(chainOf(a), chainOf(b));
  assert.notDeepEqual(chainOf(a), chainOf(c));
});

test("how time is stepped never changes history", () => {
  const whole = makeToyWorld("alpha");
  whole.runTo(12 * YEAR);
  const daily = makeToyWorld("alpha");
  for (let t = DAY; t <= 12 * YEAR; t += DAY) daily.runTo(t);
  const odd = makeToyWorld("alpha");
  for (let t = 0; t < 12 * YEAR;) {
    t = Math.min(12 * YEAR, t + 1 + ((t * 7919) % (40 * DAY)));
    odd.runTo(t);
  }
  assert.deepEqual(chainOf(daily), chainOf(whole));
  assert.deepEqual(chainOf(odd), chainOf(whole));
});

test("slicing a step and looking between slices never changes history", () => {
  const whole = makeToyWorld("alpha");
  whole.runTo(8 * YEAR);
  const sliced = makeToyWorld("alpha"),
    steps = sliced.advance(8 * YEAR);
  let n = 0;
  while (!steps.next().done) {
    // Look at the world between slices: reading must be harmless.
    if (++n % 37 === 0) sliced.store<ToyPopulation>("toy.population").counts.total();
    if (!sliced.scheduler.midMoment && n % 101 === 0) sliced.domainHashes();
  }
  assert.deepEqual(chainOf(sliced), chainOf(whole));
});

test("registration order and same-moment scheduling order do not matter", () => {
  const a = makeToyWorld("alpha"),
    b = makeToyWorld("alpha", { reverseRegistration: true, floodOrder: "ba" });
  a.runTo(10 * YEAR);
  b.runTo(10 * YEAR);
  assert.deepEqual(chainOf(b), chainOf(a));
});

test("counts stay integers and never negative, and floods move the population", () => {
  const w = makeToyWorld("gamma"),
    pop = w.store<ToyPopulation>("toy.population");
  const start = pop.counts.total();
  w.runTo(3 * MONTH);
  for (let c = 0; c < 16; c++)
    for (let k = 0; k < 3; k++) {
      const v = pop.counts.get(c, k);
      assert.ok(Number.isInteger(v) && v >= 0);
    }
  assert.notEqual(pop.counts.total(), start);
  assert.ok(w.scheduler.pending().length >= 2, "floods reschedule themselves");
});
