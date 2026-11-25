import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLADES,
  EARTH_LIFE,
  HUMANLIKE,
  SPECIATION,
  blendBody,
  crossBorn,
  crossFertility,
  crudeRates,
  lifeHistoryOf,
  lifeOnBands,
  raisedBody,
  ratesOf,
  sharesAfter,
  type BodyPlan,
} from "../../src/rules/index.ts";

const ape = CLADES.find((c) => c.id === "ape")!.body as unknown as BodyPlan;

test("a people's own table against its world's: the world's own people are exactly the world's", () => {
  const r = ratesOf(HUMANLIKE, HUMANLIKE);
  assert.equal(r.births, 1);
  assert.equal(r.appetite, 1);
  assert.ok(r.deaths.every((x) => x === 1));
  assert.ok(
    r.born > 0.02 && r.born < 0.08 && r.dying > 0.01 && r.dying < r.born,
    `${r.born} ${r.dying}`,
  );
});

test("a small short-lived people read on the apes' bands bears more, dies sooner and eats less", () => {
  const small = lifeHistoryOf(raisedBody(ape, { name: "runners", size: 12, warm: true })),
    on = lifeOnBands(small, HUMANLIKE),
    r = ratesOf(small, HUMANLIKE);
  assert.deepEqual(on.bands, HUMANLIKE.bands);
  assert.ok(r.births > 1, `${r.births}`);
  assert.ok(r.appetite < 0.5, `${r.appetite}`);
  // Their old die the more at the apes' ages (their span is the shorter); a life twice as long, the less.
  assert.ok(r.deaths[7]! > 1, `${r.deaths}`);
  const long = ratesOf(lifeHistoryOf({ ...ape, clade: "long", span: 140 }), HUMANLIKE);
  assert.ok(long.deaths[8]! < 1 && long.births < 1, `${long.deaths} ${long.births}`);
  const c = crudeRates(on);
  assert.ok(c.born > 0 && c.dying > 0);
});

test("a land's shares move by each people's own births and deaths, and stay one whole", () => {
  const rates = [
      { born: 0.04, dying: 0.03 },
      { born: 0.06, dying: 0.04 },
    ],
    s = sharesAfter([0.5, 0.5], rates, 1, 1, 50);
  assert.ok(Math.abs(s[0]! + s[1]! - 1) < 1e-9);
  assert.ok(s[1]! > 0.55, `${s}`);
  // Starved and pressed, the one that dies the more gives way.
  const lean = sharesAfter([0.5, 0.5], rates, 0, 2, 50);
  assert.ok(lean[1]! < 0.5, `${lean}`);
  // Alike, nothing moves.
  assert.deepEqual(
    sharesAfter([0.3, 0.7], [rates[0]!, rates[0]!], 1, 1, 10).map((x) => Math.round(x * 1e6)),
    [300000, 700000],
  );
});

test("whether two peoples can have young together: their tree, their chemistry, the generations apart", () => {
  const one = crossFertility({ sameTree: true, generations: 0 }, EARTH_LIFE, EARTH_LIFE);
  assert.equal(one.fertility, 1);
  const near = crossFertility(
    { sameTree: true, generations: 10 * SPECIATION.generations },
    EARTH_LIFE,
    EARTH_LIFE,
  );
  assert.ok(Math.abs(near.fertility - 0.5) < 1e-9, `${near.fertility}`);
  const far = crossFertility({ sameTree: true, generations: 2e6 }, EARTH_LIFE, EARTH_LIFE);
  assert.equal(far.fertility, 0);
  assert.equal(
    crossFertility({ sameTree: false, generations: 0 }, EARTH_LIFE, EARTH_LIFE).fertility,
    0,
  );
  const other = {
    ...EARTH_LIFE,
    hand: EARTH_LIFE.hand === "left" ? "right" : "left",
  } as typeof EARTH_LIFE;
  assert.equal(crossFertility({ sameTree: true, generations: 0 }, EARTH_LIFE, other).fertility, 0);
  // Those born of two: as often as the two meet, as their ways are open, as their crossings bear.
  assert.equal(crossBorn(0.5, 0.5, 1, 1), 0.5);
  assert.equal(crossBorn(0.5, 0.5, 1, 0), 0);
  assert.ok(crossBorn(0.9, 0.1, 0.5, 1) < crossBorn(0.5, 0.5, 0.5, 1));
});

test("the body of those born of two lies between the two", () => {
  const big = { ...ape, clade: "big", name: "giants", size: 240, span: 100 },
    mid = blendBody(ape, big);
  assert.equal(mid.size, 120);
  assert.ok(mid.span > 70 && mid.span < 100);
  assert.equal(blendBody(ape, big, 1).size, 60);
  assert.equal(blendBody(ape, ape).name, ape.name);
});
