import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FIXTURES, firstDivergence, recordFixture, type FixtureRecord } from "../vectors/oracle.ts";

const golden = (
  JSON.parse(readFileSync(new URL("../golden/oracle.json", import.meta.url), "utf8")) as {
    fixtures: FixtureRecord[];
  }
).fixtures;

for (const fixture of FIXTURES) {
  test(`oracle: ${fixture.name} follows its recorded history`, () => {
    const g = golden.find((x) => x.name === fixture.name);
    assert.ok(g, `${fixture.name} is recorded`);
    assert.equal(firstDivergence(recordFixture(fixture), g), null);
  });
}
