import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BATTLE_CAPS,
  BATTLE_DAY,
  BATTLE_LENGTH,
  battleCapAt,
  battleCapSpans,
  battleCapWords,
  battleSecond,
  battleSlowings,
  battleSpan,
  battleStage,
  battleTurn,
  battleTurnWords,
  borneShare,
  slowAhead,
  slowingBegun,
  type Slowing,
} from "../../src/view/index.ts";

const MINUTE = 60,
  HOUR = 3600,
  DAY = 86_400,
  YEAR = 365 * DAY;
// The turn of year 365: the battles of year 364 fought at it.
const T = 365,
  at = (s: number) => T * YEAR + s;

test("the battle at a turn is fought the next morning from eight, a minute of the world's a second of its own", () => {
  const { from, to } = battleSpan(T);
  assert.equal(from, at(8 * HOUR));
  assert.equal(to, from + BATTLE_LENGTH * MINUTE);
  assert.equal(BATTLE_DAY.second, MINUTE);
  assert.equal(battleSecond(from - HOUR, T), 0);
  assert.equal(battleSecond(from + 90 * MINUTE, T), 90);
  assert.equal(battleSecond(to + DAY, T), BATTLE_LENGTH);
});

test("its stages: the eve, the morning, the battle, after it, the fallen borne in, then nothing", () => {
  assert.equal(battleStage(at(-7 * HOUR), T), null);
  assert.equal(battleStage(at(-6 * HOUR), T), "eve");
  assert.equal(battleStage(at(-1), T), "eve");
  assert.equal(battleStage(at(0), T), "morning");
  assert.equal(battleStage(at(8 * HOUR - 1), T), "morning");
  assert.equal(battleStage(at(8 * HOUR), T), "battle");
  assert.equal(battleStage(at(10.5 * HOUR - 1), T), "battle");
  assert.equal(battleStage(at(10.5 * HOUR), T), "after");
  assert.equal(battleStage(at(2 * DAY + 12 * HOUR - 1), T), "after");
  assert.equal(battleStage(at(2 * DAY + 12 * HOUR), T), "borne");
  assert.equal(battleStage(at(2 * DAY + 14 * HOUR), T), null);
});

test("the turn a moment's battle is of: the coming one from its eve, else the last", () => {
  assert.equal(battleTurn(at(-6 * HOUR - 1)), T - 1);
  assert.equal(battleTurn(at(-6 * HOUR)), T);
  assert.equal(battleTurn(at(0)), T);
  assert.equal(battleTurn(at(200 * DAY)), T);
});

test("the clock is slowed toward it, through the night, for the battle just before it begins, after it, and as the fallen are borne in", () => {
  const { from, to } = battleSpan(T);
  assert.equal(battleCapAt(at(-10 * DAY - 1), T), null);
  assert.equal(battleCapAt(at(-10 * DAY), T), "toward");
  assert.equal(battleCapAt(at(-6 * HOUR - 1), T), "toward");
  assert.equal(battleCapAt(at(-6 * HOUR), T), "eve");
  assert.equal(battleCapAt(from - BATTLE_DAY.ready - 1, T), "eve");
  assert.equal(battleCapAt(from - BATTLE_DAY.ready, T), "battle");
  assert.equal(battleCapAt(to - 1, T), "battle");
  assert.equal(battleCapAt(to, T), "after");
  assert.equal(battleCapAt(at(BATTLE_DAY.borne - BATTLE_DAY.ahead - 1), T), "after");
  assert.equal(battleCapAt(at(BATTLE_DAY.borne - BATTLE_DAY.ahead), T), "borne");
  assert.equal(battleCapAt(at(BATTLE_DAY.buried + HOUR - 1), T), "borne");
  assert.equal(battleCapAt(at(BATTLE_DAY.buried + HOUR), T), null);
  assert.deepEqual(BATTLE_CAPS.battle, { town: MINUTE, land: 10 * MINUTE });
  assert.equal(BATTLE_CAPS.toward.town, DAY);
  assert.equal(BATTLE_CAPS.eve.town, HOUR);
  assert.equal(BATTLE_CAPS.after.town, DAY);
  assert.equal(BATTLE_CAPS.borne.town, HOUR);
  assert.equal(BATTLE_CAPS.borne.land, null);
  // (Each slowing begun so far ahead that a clock running at the pace before it, a tenth of a second
  // behind, still comes down to it in time: the night from a day a second, the battle from an hour,
  // the fallen borne in from a day.)
  assert.ok(-BATTLE_DAY.eve >= DAY / 10 && from - at(0) >= DAY / 10);
  assert.ok(BATTLE_DAY.ready >= HOUR / 10);
  assert.ok(BATTLE_DAY.ahead >= DAY / 10);
  assert.equal(
    battleCapWords("battle", MINUTE, T),
    "Slowed to a minute a second for the battle at the turn of year 364",
  );
  assert.equal(
    battleCapWords("battle", 10 * MINUTE, T),
    "Slowed to ten minutes a second for the battle at the turn of year 364",
  );
  assert.equal(
    battleCapWords("eve", HOUR, T),
    "Slowed to an hour a second through the night before the battle at the turn of year 364",
  );
  assert.equal(
    battleCapWords("borne", HOUR, T),
    "Slowed to an hour a second as the fallen of the battle at the turn of year 364 are borne in",
  );
});

test("each slowing's span begins where the last ends, its stage battleCapAt's from its first moment to its last", () => {
  const spans = battleCapSpans(T);
  assert.deepEqual(
    spans.map((s) => s.cap),
    ["toward", "eve", "battle", "after", "borne"],
  );
  spans.forEach((s, i) => {
    assert.ok(s.to > s.from, s.cap);
    if (i > 0) assert.equal(s.from, spans[i - 1]!.to);
    assert.equal(battleCapAt(s.from, T), s.cap);
    assert.equal(battleCapAt(s.to - 1, T), s.cap);
  });
  assert.equal(battleCapAt(spans[0]!.from - 1, T), null);
  assert.equal(battleCapAt(spans.at(-1)!.to, T), null);
});

test("the slowings where it is watched: five in its town, four on its land; one begun slowed for once, those ahead come down to", () => {
  const town = battleSlowings(`war:0:7:${T}`, "town"),
    land = battleSlowings(`war:0:7:${T}`, "land"),
    MONTH = 30 * DAY;
  assert.deepEqual(
    town.map((s) => s.cap),
    ["toward", "eve", "battle", "after", "borne"],
  );
  assert.deepEqual(
    land.map((s) => s.cap),
    ["toward", "eve", "battle", "after"],
  );
  assert.equal(town[2]!.key, `war:0:7:${T}:town:battle`);
  assert.equal(town[2]!.speed, MINUTE);
  assert.equal(land[2]!.speed, 10 * MINUTE);
  const [toward, eve] = town,
    none = new Set<string>();
  // Begun and not slowed for yet: slowed for where the speed chosen runs past it, once.
  assert.equal(slowingBegun(town, toward!.from, MONTH, none), toward);
  assert.equal(slowingBegun(town, toward!.from, DAY, none), null);
  assert.equal(slowingBegun(town, toward!.from, MONTH, new Set([toward!.key])), null);
  // Ahead: half way by the next frame, never under its own speed; the nearest holds it.
  const done = new Set([toward!.key]);
  assert.deepEqual(slowAhead(town, eve!.from - 2 * HOUR, 1 / 2, done), { speed: 2 * HOUR, s: eve });
  assert.deepEqual(slowAhead(town, eve!.from - 60, 1 / 2, done), { speed: HOUR, s: eve });
  assert.equal(slowAhead(town, eve!.from - 30 * DAY, 1 / 60, none).s, toward);
  assert.ok(slowAhead(town, eve!.from - 30 * DAY, 1 / 60, none).speed > 30 * DAY);
});

/**
 * A clock left at a speed chosen from `t0`, its frames `frame` seconds apart, slowed as the page's
 * frame hook slows it (main.ts), to moment `until`: the slowings it was slowed for in turn, each
 * stage's beginning crossed faster than it allows, and how many frames it took.
 */
function run(
  slowings: readonly Slowing[],
  chosen: number,
  t0: number,
  until: number,
  frame: number,
  done = new Set<string>(),
) {
  const seen: string[] = [],
    over: string[] = [];
  let t = t0,
    held: Slowing | null = null,
    frames = 0;
  for (; t < until && frames < 1e6; frames++) {
    const begun = slowingBegun(slowings, t, chosen, done);
    if (begun) {
      done.add(begun.key);
      held = begun;
      seen.push(begun.cap);
    }
    if (held && t >= held.to) held = null;
    const speed = Math.min(
        chosen,
        held ? held.speed : Infinity,
        slowAhead(slowings, t, frame, done).speed,
      ),
      next = t + speed * frame;
    for (const s of slowings)
      if (t < s.from && next >= s.from && speed > s.speed && s.speed < chosen)
        over.push(`${s.cap} at ${speed}`);
    t = next;
  }
  return { seen, over, frames };
}

test("a clock comes down to each slowing as it nears it, never carried past one's beginning faster than it allows, however slowly its frames come", () => {
  const MONTH = 30 * DAY,
    town = battleSlowings(`war:0:7:${T}`, "town"),
    land = battleSlowings(`war:0:7:${T}`, "land");
  for (const frame of [1 / 60, 1 / 30, 1 / 4, 1 / 2, 1]) {
    // At a month a second from forty days before the turn, to the fallen buried.
    const inTown = run(town, MONTH, at(-40 * DAY), at(BATTLE_DAY.buried + 2 * HOUR), frame),
      onLand = run(land, MONTH, at(-40 * DAY), at(3 * DAY), frame);
    assert.deepEqual(inTown.seen, ["toward", "eve", "battle", "after", "borne"], `${frame} s`);
    assert.deepEqual(inTown.over, [], `${frame} s`);
    assert.deepEqual(onLand.seen, ["toward", "eve", "battle", "after"], `${frame} s`);
    assert.deepEqual(onLand.over, [], `${frame} s`);
  }
  // Let go through the night at a month a second (its toward and eve slowed for already), the clock
  // comes down to the battle in a few frames, not held slow the night through.
  const { from } = battleSpan(T),
    night = run(
      town,
      MONTH,
      at(-4 * HOUR),
      from - BATTLE_DAY.ready + 1,
      1 / 60,
      new Set([town[0]!.key, town[1]!.key]),
    );
  assert.deepEqual(night.seen, ["battle"]);
  assert.ok(night.frames < 40, `${night.frames} frames`);
});

test("the fallen are borne in from noon two days on, and called the battle at the turn of the year they were fought in", () => {
  assert.equal(borneShare(at(2 * DAY + 12 * HOUR), T), 0);
  assert.equal(borneShare(at(2 * DAY + 12.75 * HOUR), T), 0.5);
  assert.equal(borneShare(at(2 * DAY + 14 * HOUR), T), 1);
  assert.equal(battleTurnWords(T), "the battle at the turn of year 364");
});
