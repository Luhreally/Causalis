// The chemistry survey (Phase 54 C6): the sixty peopled open worlds pass the acceptance checks and
// show the figures the spec records for them; the iron delay reads the years two surveys record.
import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { generateHomeWorld, worldChemistry } from "../../src/gen/index.ts";
import { OPEN } from "../../src/rules/index.ts";
import { acceptance, ironDelay, surveyChemistry, type ChemRow } from "../../tools/chem-survey.ts";
import type { Survey } from "../../tools/diversity.ts";

// Sixty peopled worlds, surveyed once for the tests that read them.
const rows = surveyChemistry(60);

const airOf = (seed: string) => worldChemistry(generateHomeWorld(seedFromText(seed), OPEN)).air;

/** A survey of one world as far as iron goes: the year it first found iron, if it did. */
function found(seed: string, iron?: number): Survey {
  const order: (readonly [string, number])[] = iron === undefined ? [] : [["iron", iron]];
  return { seed, order } as unknown as Survey;
}

test("the sixty peopled open worlds pass every acceptance check", () => {
  const result = acceptance(rows);
  assert.equal(result.ok, true, result.problems.join("\n"));
});

test("the sixty worlds show the spec's figures, each within three", () => {
  const count = (pred: (r: ChemRow) => boolean) => rows.filter(pred).length,
    actual = {
      nonSolar: count(
        (r) =>
          r.carbon !== "oxide" || r.metals !== "solar" || r.silica !== "solar" || r.air !== "solar",
      ),
      stoneSets: new Set(rows.map((r) => r.stones)).size,
      nickel: count((r) => r.hardener === "nickel"),
      thin: count((r) => r.air === "thin"),
      thinWithIron: count((r) => r.air === "thin" && r.nativeLands > 0),
      carbonRich: count((r) => r.carbon === "carbon-rich"),
    },
    expected = { nonSolar: 53, stoneSets: 7, nickel: 5, thin: 27, thinWithIron: 4, carbonRich: 7 };
  for (const key of Object.keys(expected) as (keyof typeof expected)[])
    assert.ok(
      Math.abs(actual[key] - expected[key]) <= 3,
      `${key} is ${actual[key]}, expected ${expected[key]} within three`,
    );
});

test("rows that all share one hardener fail the acceptance checks", () => {
  const one = rows.map((r) => ({ ...r, hardener: "tin" as const }));
  const result = acceptance(one);
  assert.equal(result.ok, false);
  assert.ok(
    result.problems.some((p) => p.includes("hardener")),
    result.problems.join("\n"),
  );
});

test("iron delay: thin minus solar-air medians, the even count's middle two averaged", () => {
  // Thin air: alien 16 (+150) and alien 12 (+100), median 125. Solar air: alien 2 (+30) and alien
  // 4 (0), median 15. Alien 5 is solar air too but finds no iron in either run, so it is left out
  // (counted, its 0 would take the solar median to 0). Delay 110.
  assert.deepEqual(["alien 16", "alien 12", "alien 2", "alien 4", "alien 5"].map(airOf), [
    "thin",
    "thin",
    "solar",
    "solar",
    "solar",
  ]);
  const before = [
      found("alien 16", 300),
      found("alien 12", 500),
      found("alien 2", 200),
      found("alien 4", 260),
      found("alien 5"),
    ],
    after = [
      found("alien 16", 450),
      found("alien 12", 600),
      found("alien 2", 230),
      found("alien 4", 260),
      found("alien 5"),
    ];
  const result = ironDelay(before, after),
    text = result.lines.join("\n");
  assert.equal(result.ok, true, text);
  assert.match(text, /median delta thin\s+125\.0 years/);
  assert.match(text, /median delta solar\s+15\.0 years/);
  assert.match(text, /iron delay\s+110\.0 years, at least 100: pass/);
});

test("iron delay: the share finding iron by 900 may fall ten points at most", () => {
  // Alien 2 finds its iron at 950, too late for 900: the share falls from four of four to three.
  const before = [
      found("alien 16", 300),
      found("alien 2", 200),
      found("alien 4", 260),
      found("alien 5", 400),
    ],
    after = [
      found("alien 16", 450),
      found("alien 2", 950),
      found("alien 4", 260),
      found("alien 5", 400),
    ];
  const result = ironDelay(before, after);
  assert.equal(result.ok, false);
  assert.match(result.lines.join("\n"), /falls 25\.0 points, at most 10: FAIL/);
});
