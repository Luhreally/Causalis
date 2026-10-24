import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LAPSE,
  TIME_LADDERS,
  TimeState,
  speedLabel,
  type TimeScale,
} from "../../src/view/index.ts";
import { clockWords, speedWords } from "../../src/ui/words.ts";

const HOUR = 3600,
  DAY = 86_400,
  MONTH = 30 * DAY,
  YEAR = 365 * DAY;

test("each scale's speeds are its own: a town's hours, a land's months, a world's years, the stars' decades", () => {
  for (const [scale, ladder] of Object.entries(TIME_LADDERS)) {
    assert.ok(ladder.speeds.length >= 3 && ladder.speeds.length <= 5, `${scale}: 3 to 5 speeds`);
    assert.ok(
      ladder.speeds.every((s, i) => i === 0 || s > ladder.speeds[i - 1]!),
      `${scale}: slowest first`,
    );
    assert.ok(ladder.speeds.includes(ladder.start), `${scale} opens at one of its speeds`);
  }
  // The further out the eye, the faster the world it opens on.
  const start = (s: TimeScale) => TIME_LADDERS[s].start;
  assert.equal(start("village"), HOUR);
  assert.ok(start("village") < start("region"));
  assert.ok(start("region") < start("globe"));
  assert.ok(start("globe") < start("cluster"));
  assert.ok(start("system") < start("globe"), "the worlds of a system seen going round");
  // A town can be watched living its day and growing through its years.
  assert.ok(TIME_LADDERS.village.speeds[0]! <= 60);
  assert.ok(TIME_LADDERS.village.speeds.at(-1)! >= YEAR);
  assert.ok(
    TIME_LADDERS.village.speeds.some((s) => s >= LAPSE),
    "a town's years at its fastest",
  );
  assert.ok(
    TIME_LADDERS.village.speeds.some((s) => s < LAPSE),
    "and its day at its slowest",
  );
});

test("the clock: each scale keeps its speed; a pause holds across them all; Space goes on", () => {
  const c = new TimeState("globe");
  assert.equal(c.speed, YEAR, "a world opens at a year a second");
  assert.equal(c.lit, 2);
  c.scale = "village";
  assert.equal(c.speed, HOUR, "a town at an hour a second");
  assert.ok(c.pick(4));
  assert.equal(c.speed, MONTH);
  assert.equal(c.lit, 4);
  c.scale = "globe";
  assert.equal(c.speed, YEAR, "the world's own speed, not the town's");
  c.scale = "village";
  assert.equal(c.speed, MONTH, "the town's kept");
  // Paused at a town, still paused over its land; going on there runs at the land's speed.
  c.choose(0);
  c.scale = "region";
  assert.equal(c.speed, 0);
  assert.equal(c.lit, 0);
  c.toggle();
  assert.equal(c.speed, MONTH);
  c.toggle();
  assert.equal(c.speed, 0);
  c.toggle();
  // A rung the ladder lacks is no speed; a speed of its own lights none.
  assert.equal(c.pick(9), false);
  assert.equal(c.speed, MONTH);
  c.choose(1234);
  assert.equal(c.speed, 1234);
  assert.equal(c.lit, -1);
});

test("a window holds the clock while it waits, and lets go of it as it was", () => {
  const c = new TimeState("globe");
  c.hold("window");
  assert.equal(c.speed, 0);
  assert.equal(c.lit, 0, "held: the pause lit");
  c.release("window");
  assert.equal(c.speed, YEAR, "given back");
  // Paused by the viewer while held: still paused once let go.
  c.hold("window");
  c.choose(0);
  c.release("window");
  assert.equal(c.speed, 0);
  // A speed chosen while held is the viewer's word: it runs at once, every hold let go.
  c.toggle();
  c.hold("window");
  assert.ok(c.pick(3));
  assert.equal(c.speed, 10 * YEAR);
  c.release("window");
  assert.equal(c.speed, 10 * YEAR);
  // Space while held goes on.
  c.hold("window");
  c.toggle();
  assert.equal(c.speed, 10 * YEAR);
});

test("speeds in words: on the buttons, and as the clock measures them", () => {
  assert.deepEqual(TIME_LADDERS.village.speeds.map(speedLabel), [
    "1 min/s",
    "1 hour/s",
    "1 day/s",
    "1 month/s",
    "1 year/s",
  ]);
  assert.deepEqual(TIME_LADDERS.region.speeds.map(speedLabel), [
    "1 day/s",
    "1 week/s",
    "1 month/s",
    "1 year/s",
    "10 years/s",
  ]);
  assert.deepEqual(TIME_LADDERS.system.speeds.map(speedLabel), [
    "1 day/s",
    "10 days/s",
    "1 month/s",
    "1 year/s",
  ]);
  assert.equal(speedLabel(100 * YEAR), "100 years/s");
  assert.equal(speedWords(0), "paused");
  assert.equal(speedWords(60), "1 minute a second");
  assert.equal(speedWords(3590), "1 hour a second", "near enough an hour is an hour");
  assert.equal(speedWords(MONTH), "30 days a second");
  assert.equal(speedWords(0.97 * YEAR), "1 year a second");
  assert.equal(speedWords(12.4 * YEAR), "12 years a second");
  assert.equal(clockWords(300 * YEAR + 41 * DAY + 7 * HOUR + 40 * 60), "year 300, day 41, 07:40");
});
