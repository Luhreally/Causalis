import { test } from "node:test";
import assert from "node:assert/strict";
import { livingSeed } from "../../src/app/title.ts";
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
    { seed: "alien 55", passed: null },
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
  });
  assert.deepEqual(asked, ["amber 412", "amber 413", "amber 414"]);
  asked.length = 0;
  assert.equal((await livingSeed(client, "alien", "amber")).seed, "amber 3");
  asked.length = 0;
  assert.equal(
    (await livingSeed(client, "alien", "amber 9 ~age 3 cool")).seed,
    "amber 11 ~age 3 cool",
  );
  // (None found within its tries: the seed as asked.)
  const never = { lifeOf: async () => ({ living: false, peopled: false, words: "no" }) };
  assert.deepEqual(await livingSeed(never, "alien", "x 1", 5), { seed: "x 1", passed: null });
});
