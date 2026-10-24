import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BEHIND,
  firstWords,
  newDirector,
  nextTake,
  untold,
  type TownSeen,
} from "../../src/view/index.ts";
import type { WorldFirst } from "../../src/bridge/index.ts";

// Phase 31 M168: the eye that watches by itself — each first as it comes, else the round of the
// world's life.

const first = (
  what: string,
  year: number,
  land: number | null = 3,
  stage?: string,
): WorldFirst => ({
  what,
  year,
  land,
  ref: `ev:0:${year}`,
  ...(stage ? { stage } : {}),
});
const town = (ref: string, people: number, cell = 3): TownSeen => ({
  ref,
  name: ref.toUpperCase(),
  cell,
  people,
  city: false,
});

test("the firsts already there are history; each new one is told once, the earliest first", () => {
  const before = [first("⚒️ Smelting copper", 0)],
    d = newDirector(before);
  assert.deepEqual(untold(d, before), []);
  const now = [...before, first("👑 A realm", 19, 3, "Realms"), first("🏘️ A town", 16)];
  const a = nextTake(d, now, [], [{ cell: 3, people: 100 }]),
    b = nextTake(d, now, [], [{ cell: 3, people: 100 }]);
  assert.equal(a.shot.kind === "first" && a.shot.first.what, "🏘️ A town");
  assert.equal(a.words, "🏘️ The first town — year 16");
  assert.equal(b.words, "👑 The first realm — year 19 · a new stage: Realms");
  assert.equal(b.shot.kind === "first" && b.shot.first.what, "👑 A realm");
  assert.notEqual(nextTake(d, now, [], [{ cell: 3, people: 100 }]).shot.kind, "first");
});

test("before any town, the bands of the most peopled land and down among them, in turn", () => {
  const d = newDirector([]),
    peopled = [
      { cell: 5, people: 40 },
      { cell: 9, people: 300 },
    ];
  const takes = [0, 1, 2].map(() => nextTake(d, [], [], peopled));
  assert.deepEqual(
    takes.map((t) => t.shot),
    [
      { kind: "bands", cell: 9 },
      { kind: "camp", cell: 9 },
      { kind: "bands", cell: 9 },
    ],
  );
  assert.ok(takes.every((t) => t.seconds > 10 && t.words.length > 0));
});

test("with towns: the greatest growing, its streets, the world; then the next greatest", () => {
  const d = newDirector([]),
    towns = [town("b", 300), town("a", 900), town("c", 50)];
  const kinds = Array.from({ length: 6 }, () => nextTake(d, [], towns, []).shot);
  assert.deepEqual(
    kinds.map((s) => s.kind),
    ["grow", "street", "world", "grow", "street", "world"],
  );
  assert.equal(kinds[0]!.kind === "grow" && kinds[0]!.town, "a");
  assert.equal(kinds[3]!.kind === "grow" && kinds[3]!.town, "b");
});

test("a first's words: the first of its kind, a thing learned first known, a new thing as it is", () => {
  assert.equal(firstWords(first("🏙️ A city", 27)), "🏙️ The first city — year 27");
  assert.equal(firstWords(first("💡 Iron", 265)), "💡 Iron, first known — year 265");
  assert.equal(firstWords(first("🦠 A new sickness", 71)), "🦠 A new sickness — year 71");
  assert.equal(firstWords(first("⚖️ One law for all", 87)), "⚖️ One law for all — year 87");
  assert.equal(firstWords(first("🛰️ A satellite", 1032)), "🛰️ The first satellite — year 1,032");
});

test("fallen behind the world, the lesser firsts are let go and the stages kept", () => {
  const d = newDirector([]),
    now = [
      first("🐪 A trade road", 2),
      first("💡 Sails", 7),
      first("⛵ A sea route", 8),
      first("🏘️ A town", 16, 4, "Villages"),
      first("👑 A realm", 19, 4, "Realms"),
    ];
  assert.ok(now.length > BEHIND);
  const told = [0, 1, 2].map(() => nextTake(d, now, [], [{ cell: 4, people: 9 }]));
  assert.deepEqual(
    told.map((t) => (t.shot.kind === "first" ? t.shot.first.what : t.shot.kind)),
    ["🏘️ A town", "👑 A realm", "bands"],
  );
  // (A few waiting are all shown, the lesser too.)
  const e = newDirector([]),
    few = now.slice(0, BEHIND);
  assert.equal(nextTake(e, few, [], []).words, "🐪 The first trade road — year 2");
});
