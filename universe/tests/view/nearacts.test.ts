import { test } from "node:test";
import assert from "node:assert/strict";
import { DAY, YEAR } from "../../src/kernel/index.ts";
import { actsNear } from "../../src/view/index.ts";
import type { ActMark, LandSky } from "../../src/bridge/index.ts";

// Phase 30 M163: the god's acts on a land seen near — what lasts while it lasts, what is done in a
// moment as it happens, for a few of the viewer's seconds at whatever pace the clock runs.

const mark = (
  kind: ActMark["kind"],
  from: number,
  left = 1,
  town: string | null = null,
): ActMark => ({
  kind,
  at: [0, 1, 0],
  to: null,
  color: null,
  left,
  event: `ev:0:${kind}`,
  cell: 9,
  town,
  from,
});
const land = (acts: ActMark[]): LandSky => ({
  cell: 9,
  warmth: 15,
  swing: 8,
  wet: 900,
  year: 1,
  sent: 0,
  acts,
});

test("a blessed harvest's gold rises off the land, a blight's dust and a plague's pall keep low", () => {
  const near = actsNear(
    land([mark("bounty", 0, 0.8), mark("blight", 0, 0.5), mark("plague", 0, 0.3)]),
    100 * DAY,
    3600,
  );
  const of = (k: string) => near.motes.find((m) => m.kind === k)!;
  assert.ok(of("gold").rise > 0 && !of("gold").low && of("gold").strength > 0);
  assert.ok(of("dust").low && of("pall").low);
  assert.deepEqual(
    near.told.map((x) => x.icon),
    ["🌽", "🥀", "☠️"],
  );
  assert.equal(near.shake, 0);
  assert.equal(near.strike, null);
  assert.deepEqual(actsNear(land([]), 5 * DAY, 3600), {
    motes: [],
    pillar: 0,
    fires: [],
    shake: 0,
    strike: null,
    told: [],
  });
});

test("a quake shakes the ground as it happens, for a few of the viewer's seconds at any pace", () => {
  const at = 50 * DAY,
    quake = land([mark("quake", at)]);
  assert.equal(actsNear(quake, at - 10, 3600).shake, 0, "not before");
  assert.ok(actsNear(quake, at + 60, 3600).shake > 0.9, "at once");
  assert.ok(actsNear(quake, at + DAY / 2, 3600).shake < 0.5, "dying away");
  assert.equal(actsNear(quake, at + DAY + 1, 3600).shake, 0, "over");
  // At a year a second, five seconds of the viewer's own: the shaking goes on a while.
  assert.ok(actsNear(quake, at + 30 * DAY, YEAR).shake > 0.5);
  assert.equal(actsNear(quake, at + 6 * YEAR, YEAR).shake, 0);
});

test("a stone falls from the sky, flashes as it strikes and smokes; a town burns; an inspiration stands as light", () => {
  const at = 10 * DAY,
    stone = land([mark("meteor", at)]),
    span = DAY;
  const falling = actsNear(stone, at + span * 0.05, 3600).strike!,
    struck = actsNear(stone, at + span * 0.15, 3600).strike!,
    after = actsNear(stone, at + span * 0.6, 3600).strike!;
  assert.ok(falling.fall > 0 && falling.fall < 1 && falling.flash === 0 && falling.smoke === 0);
  assert.ok(struck.fall === 1 && struck.flash > 0 && struck.smoke > 0);
  assert.ok(after.flash === 0 && after.smoke > 0);
  assert.equal(actsNear(stone, at + span * 1.01, 3600).strike, null, "gone");
  const fire = actsNear(land([mark("fire", at, 1, "village:0:3")]), at + DAY, 3600);
  assert.equal(fire.fires.length, 1);
  assert.equal(fire.fires[0]!.town, "village:0:3");
  assert.ok(fire.fires[0]!.strength > 0.5);
  assert.equal(
    actsNear(land([mark("fire", at, 1, "village:0:3")]), at + 9 * DAY, 3600).fires.length,
    0,
  );
  const lit = actsNear(land([mark("inspiration", at)]), at + 5 * DAY, 3600);
  assert.ok(lit.pillar > 0.5, `${lit.pillar}`);
  assert.equal(lit.told[0]!.words, "an inspiration");
});

test("the latest act told first, each once", () => {
  const near = actsNear(
    land([mark("bless", 3 * DAY), mark("curse", 5 * DAY), mark("bless", 4 * DAY)]),
    6 * DAY,
    3600,
  );
  assert.deepEqual(
    near.told.map((x) => x.words),
    ["a curse on the land", "a blessing on the land"],
  );
  assert.ok(
    near.motes.some((m) => m.kind === "gold" && m.rise < 0),
    "a blessing settles",
  );
  assert.ok(near.motes.some((m) => m.kind === "wisp"));
});
