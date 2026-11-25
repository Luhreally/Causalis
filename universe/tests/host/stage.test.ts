import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR } from "../../src/kernel/index.ts";
import type { WorldFirst, WorldStage } from "../../src/bridge/index.ts";
import { rig } from "./harness.ts";

// Phase 31 M167: the world's stage — its bands from the start, then each stage as the first that
// opens it comes; the firsts told with the stage each opens.

test("the world's stage: its bands at the start, then the stages its firsts open", async () => {
  const r = rig();
  await r.settle(r.client.start("earth", "first light"));
  const begun = await r.settle(r.client.query<WorldStage>({ type: "world.stage" }));
  assert.equal(begun.id, "bands");
  assert.equal(begun.stages[0]!.year, 0);
  assert.ok(begun.stages.slice(1).every((s) => s.year === null));

  await r.settle(r.client.advance(32 * YEAR));
  const now = await r.settle(r.client.query<WorldStage>({ type: "world.stage" })),
    firsts = await r.settle(r.client.query<WorldFirst[]>({ type: "world.firsts" })),
    reached = now.stages.filter((s) => s.year !== null);
  // (The stage is the age read off the world as it stands, rules/ages.ts: one it has reached, and none past the last of its
  // firsts. It may stand a step short of that one: a first town of a thousand is a city's first, and the town may be under
  // a thousand again a season later; told as fallen only once that has had years to mend.)
  assert.notEqual(now.id, "bands");
  const at = now.stages.findIndex((s) => s.id === now.id),
    last = now.stages.findIndex((s) => s.id === reached.at(-1)!.id);
  assert.ok(at >= 1 && at <= last, `${now.id} is not past ${reached.at(-1)!.id}`);
  assert.ok(last - at <= 1, `${now.id} stands more than a step short of ${reached.at(-1)!.id}`);
  assert.notEqual(now.stages[at]!.year, null, "a stage it has reached");
  assert.equal(now.since, now.stages[at]!.year, "since the year its first opened it");
  assert.equal(now.fell, undefined, "nothing fallen from so young");
  const town = firsts.find((f) => f.what === "🏘️ A town");
  assert.ok(town, "a first town by year 32");
  assert.equal(town.stage, "Villages");
  for (const f of firsts.filter((x) => x.stage))
    assert.ok(
      now.stages.some((s) => s.name === f.stage && s.year === f.year),
      `${f.what} opens ${f.stage} in its year`,
    );
  assert.ok(
    firsts.some((f) => !f.stage),
    "the lesser firsts open no stage",
  );
  assert.deepEqual(
    firsts.map((f) => f.year),
    firsts.map((f) => f.year).sort((a, b) => a - b),
    "the earliest first",
  );
});
