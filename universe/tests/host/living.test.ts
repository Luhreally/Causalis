import { test } from "node:test";
import assert from "node:assert/strict";
import { livingSeed, madeWorldWords, unmadeSeed } from "../../src/app/title.ts";
import { rig } from "./harness.ts";

// A world never seen "where the world supports life" (asked for 2026-10-24): the nearest seed on
// from the one asked whose world a people rises on, its acts kept; the seed itself where it is.

test("a lifeless seed gives way to the nearest one on whose world a people rises", async () => {
  const title = rig(),
    ask = (seed: string) => title.settle(livingSeed(title.client, "alien", seed));
  const passed = await ask("alien 0");
  assert.notEqual(passed.seed, "alien 0");
  assert.match(passed.seed, /^alien \d+$/);
  assert.ok(Number(passed.seed.slice(6)) > 0);
  assert.match(passed.passed ?? "", /froze over/);
  assert.equal(
    (await title.settle(title.client.lifeOf("alien", passed.seed))).peopled,
    true,
    "a people rises on the one given",
  );
  assert.deepEqual(
    await ask("alien 55"),
    { seed: "alien 55", passed: null, found: true },
    "kept where it lives",
  );
});

test("the next seed is the next number on, a seed with none given one, its acts kept", async () => {
  const asked: string[] = [],
    // (A host where only the third seed asked has a people.)
    client = {
      lifeOf: async (_: string, seed: string) => {
        asked.push(seed);
        const peopled = asked.length === 3;
        return { living: peopled, peopled, words: peopled ? "" : "its seas froze over" };
      },
    };
  assert.deepEqual(await livingSeed(client, "alien", "amber 412"), {
    seed: "amber 414",
    passed: "its seas froze over",
    found: true,
  });
  assert.deepEqual(asked, ["amber 412", "amber 413", "amber 414"]);
  asked.length = 0;
  assert.equal((await livingSeed(client, "alien", "amber")).seed, "amber 3");
  asked.length = 0;
  assert.equal(
    (await livingSeed(client, "alien", "amber 9 ~age 3 cool")).seed,
    "amber 11 ~age 3 cool",
  );
  // (None found within its tries: the seed as asked, and so told.)
  const never = { lifeOf: async () => ({ living: false, peopled: false, words: "no" }) },
    looked: number[] = [];
  assert.deepEqual(await livingSeed(never, "alien", "x 1", 5, (n) => looked.push(n)), {
    seed: "x 1",
    passed: "no",
    found: false,
  });
  assert.deepEqual(looked, [1, 2, 3, 4, 5]);
});

test("a world never seen, made by the hand: the nearest so made, its making kept; the world it makes told", async () => {
  const title = rig(),
    made = "alien 0 ~orbit near ~air thick",
    found = await title.settle(livingSeed(title.client, "alien", made));
  assert.ok(found.found);
  assert.match(found.seed, /^alien \d+ ~/);
  assert.ok(found.seed.includes(" ~orbit near") && found.seed.includes(" ~air thick"), found.seed);
  const life = await title.settle(title.client.lifeOf("alien", found.seed));
  assert.equal(life.peopled, true);
  assert.ok(life.world && life.world.warmth > 0, JSON.stringify(life.world));
  assert.match(
    madeWorldWords(life.world!),
    /^⭐ an? [A-Z]\d?V? ?\w* star, [\d,]+ K · \d\.\d\d g · −?\d+ °C · \d+% sea$/,
  );
  // Its making lifted: the world as its seed falls, its dawn's acts kept.
  assert.equal(unmadeSeed("amber 9 ~age 3 cool ~orbit near ~star red"), "amber 9 ~age 3 cool");
});
