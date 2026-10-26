// A world's crust (Phase 54 M221): Earth's rows are the upper continental crust the spec gives; the
// Sun's own chemistry shows them as they are; each class moves the elements it should; and every
// other crust keeps Earth's total, so another world's rock is a different mix of the same total.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SOLAR, type Chemistry } from "../../src/rules/chemistry.ts";
import {
  CRUST_ORDER,
  UCC_TRACE,
  crustMultiplier,
  crustOf,
  earthCrust,
  showingScale,
  type CrustRow,
} from "../../src/rules/crust.ts";

/** The majors, converted from the oxides, ppm. */
const MAJOR_PPM: Readonly<Record<string, number>> = {
  O: 475430,
  Si: 311406,
  Al: 81506,
  Fe: 39176,
  Ca: 25658,
  Na: 24259,
  K: 23244,
  Mg: 14955,
  Ti: 3836,
  Mn: 774,
  P: 655,
};

/** The traces, exact, ppm. */
const TRACE_PPM: Readonly<Record<string, number>> = {
  C: 3240,
  S: 62,
  Cr: 92,
  Zn: 67,
  Ni: 47,
  Cu: 28,
  Co: 17.3,
  Pb: 17,
  As: 4.8,
  Sn: 2.1,
  Sb: 0.4,
  Ag: 0.053,
  Au: 0.0015,
};

const NAMES = [
  "oxygen",
  "silicon",
  "aluminium",
  "iron",
  "calcium",
  "sodium",
  "potassium",
  "magnesium",
  "titanium",
  "phosphorus",
  "manganese",
  "carbon",
  "sulphur",
  "chromium",
  "zinc",
  "nickel",
  "copper",
  "cobalt",
  "lead",
  "arsenic",
  "tin",
  "antimony",
  "silver",
  "gold",
];

/** A world whose chemistry is the Sun's but for the classes given. */
const world = (classes: Partial<Chemistry>): Chemistry => ({ ...SOLAR, solar: false, ...classes });

/** One element's ppm in a crust. */
function ppmOf(rows: readonly CrustRow[], symbol: string): number {
  const row = rows.find((r) => r.symbol === symbol);
  assert.ok(row, `${symbol} is in the crust`);
  return row.ppm;
}

/** A crust's total ppm. */
function totalOf(rows: readonly CrustRow[]): number {
  return rows.reduce((sum, r) => sum + r.ppm, 0);
}

test("Earth's rows are the spec's: majors within 1 ppm, traces exact, names British", () => {
  const rows = earthCrust();
  assert.deepEqual(
    rows.map((r) => r.symbol),
    CRUST_ORDER,
  );
  assert.deepEqual(
    rows.map((r) => r.name),
    NAMES,
  );
  assert.deepEqual(UCC_TRACE, TRACE_PPM);
  for (const r of rows) {
    assert.equal(r.earth, r.ppm, `${r.symbol}: Earth's own row`);
    const major = MAJOR_PPM[r.symbol];
    if (major === undefined)
      assert.equal(r.ppm, TRACE_PPM[r.symbol], `${r.symbol}: a trace is exact`);
    else assert.ok(Math.abs(r.ppm - major) <= 1, `${r.symbol}: ${r.ppm} against ${major}`);
  }
});

test("the Sun's own chemistry shows Earth's crust, each element at exactly 1", () => {
  assert.deepEqual(crustOf(SOLAR), earthCrust());
  for (const symbol of CRUST_ORDER) {
    assert.equal(crustMultiplier(SOLAR, symbol), 1, symbol);
    assert.equal(showingScale(SOLAR, symbol), 1, symbol);
  }
});

test("each class moves the elements the spec gives; air and redox move none", () => {
  const at = (classes: Partial<Chemistry>, symbol: string) =>
    crustMultiplier(world(classes), symbol);
  assert.equal(at({ metals: "poor" }, "Cr"), 0.5);
  assert.equal(at({ metals: "poor" }, "As"), 0.5);
  assert.equal(at({ metals: "poor" }, "Sb"), 0.3);
  assert.equal(at({ metals: "poor" }, "Mg"), 1);
  assert.equal(at({ metals: "rich" }, "Zn"), 1.25);
  assert.equal(at({ metals: "rich" }, "As"), 1.25);
  assert.equal(at({ metals: "rich" }, "Au"), 1.6);
  assert.equal(at({ silica: "low" }, "Mg"), 1.5);
  assert.equal(at({ silica: "low" }, "Ni"), 2.5);
  assert.equal(at({ silica: "low" }, "Cr"), 2);
  assert.equal(at({ silica: "low" }, "Co"), 1.5);
  assert.equal(at({ silica: "low" }, "Si"), 0.9);
  assert.equal(at({ silica: "low" }, "K"), 0.8);
  assert.equal(at({ silica: "low" }, "Sn"), 0.6);
  assert.equal(at({ silica: "high" }, "Si"), 1.1);
  assert.equal(at({ silica: "high" }, "Mg"), 0.7);
  assert.equal(at({ silica: "high" }, "Ni"), 0.7);
  assert.equal(at({ silica: "high" }, "Cr"), 0.7);
  assert.equal(at({ silica: "high" }, "K"), 1.2);
  assert.equal(at({ silica: "high" }, "Sn"), 1.3);
  assert.equal(at({ carbon: "carbon-rich" }, "C"), 10);
  assert.equal(at({ carbon: "carbon-rich" }, "O"), 0.97);
  assert.equal(at({ air: "thin", redox: "reduced" }, "Fe"), 1);
  assert.equal(at({ air: "rich", redox: "oxidised" }, "Fe"), 1);
  assert.equal(at({}, "Sn"), 1);
});

test("poor metals and low silica: nickel ×1.25 and tin ×.18", () => {
  const c = world({ metals: "poor", silica: "low" });
  assert.equal(crustMultiplier(c, "Ni"), 1.25);
  assert.ok(Math.abs(crustMultiplier(c, "Sn") - 0.18) < 1e-12, `tin ${crustMultiplier(c, "Sn")}`);
  assert.equal(showingScale(c, "Ni"), crustMultiplier(c, "Ni"));
  assert.equal(showingScale(c, "Sn"), crustMultiplier(c, "Sn"));
});

test("poor metals: arsenic is about 3.8 times tin, by ppm", () => {
  const rows = crustOf(world({ metals: "poor" }));
  const ratio = ppmOf(rows, "As") / ppmOf(rows, "Sn");
  assert.ok(Math.abs(ratio - 3.8) < 0.05, `As/Sn ${ratio}`);
});

test("every other chemistry's crust keeps Earth's total, within 1e-9 relative", () => {
  const earth = totalOf(earthCrust());
  const others: Chemistry[] = [
    world({ metals: "poor", silica: "low" }),
    world({ metals: "rich", silica: "high" }),
    world({ carbon: "carbon-rich", redox: "reduced" }),
    world({ metals: "poor", silica: "high", carbon: "carbon-rich", air: "thin", redox: "reduced" }),
    world({ air: "rich" }),
  ];
  for (const c of others) {
    const sum = totalOf(crustOf(c));
    assert.ok(Math.abs(sum - earth) <= 1e-9 * earth, `${sum} against ${earth}`);
  }
});
