// What a blow does to a body (Phase 55 M224): the spec's table of F, W:F, maimed shares and side
// wounds, row by row; the blow each arm strikes with; the care the principles give; the wounds a
// strike leaves; and, over every blow, shock, protection, care and body size, the bounds and the
// monotone shapes the formulas keep.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blowOf,
  fallenShare,
  maimedShare,
  sideWounds,
  strikeHurt,
  woundCare,
  woundedPerFallen,
  type Blow,
  type Struck,
} from "../../src/rules/wounds.ts";

/** The tolerance on F and on W:F; the table gives them to five decimal places. */
const TOL = 5e-5;
/**
 * The tolerance on a maimed share. The table's shares are exact in real arithmetic, but three of
 * them (0.0896, 0.077, 0.056) come out one unit in the last place off as IEEE doubles.
 */
const SHARE_EXACT = 1e-12;
/** Slack for floating-point rounding in the bound and order checks. */
const SLACK = 1e-9;

/** One row of the table: the struck side, its F and W:F, its maimed share, and its side pair. */
type Row = {
  readonly n: number;
  readonly struck: Struck;
  readonly F: number;
  readonly WF: number;
  readonly maimed: number;
  readonly side: readonly [wounded: number, maimed: number];
};

/** The spec's table. Both sides of a battle are alike in each row. */
const ROWS: readonly Row[] = [
  // A stone spear and a hide shield, on foot.
  {
    n: 1,
    struck: { blow: "point", shock: 0.44, protection: 0.2, care: 0, size: 60 },
    F: 0.30391,
    WF: 2.29049,
    maimed: 0.06,
    side: [229, 14],
  },
  // A bronze sword and leather.
  {
    n: 2,
    struck: { blow: "edge", shock: 0.82, protection: 0.3, care: 0.25, size: 60 },
    F: 0.20218,
    WF: 3.94609,
    maimed: 0.0975,
    side: [395, 39],
  },
  // An iron sword and mail, on a horse; held at the least share, so W:F is 4.5.
  {
    n: 3,
    struck: { blow: "edge", shock: 0.96, protection: 0.56, care: 0.6, size: 60 },
    F: 1 / 5.5,
    WF: 4.5,
    maimed: 0.094,
    side: [450, 42],
  },
  // A musket and plate, cavalry.
  {
    n: 4,
    struck: { blow: "shot", shock: 0.96, protection: 0.85, care: 0.6, size: 60 },
    F: 0.32217,
    WF: 2.10399,
    maimed: 0.0896,
    side: [210, 19],
  },
  // A rifle and plate, cavalry.
  {
    n: 5,
    struck: { blow: "shot", shock: 1.15, protection: 0.85, care: 0.75, size: 60 },
    F: 0.32463,
    WF: 2.08044,
    maimed: 0.077,
    side: [208, 16],
  },
  // A machine gun and a helmet, in an armoured car.
  {
    n: 6,
    struck: { blow: "shot", shock: 1.2, protection: 0.95, care: 1, size: 60 },
    F: 0.2994,
    WF: 2.34005,
    maimed: 0.056,
    side: [234, 13],
  },
  // The alien 16's mandibles and its own shell, in its 23 kg body.
  {
    n: 7,
    struck: { blow: "crush", shock: 0.55, protection: 0.6, care: 0, size: 23 },
    F: 0.33245,
    WF: 2.00798,
    maimed: 0.12,
    side: [201, 24],
  },
  // The same alien, in a 60 kg body.
  {
    n: 8,
    struck: { blow: "crush", shock: 0.55, protection: 0.6, care: 0, size: 60 },
    F: 0.28254,
    WF: 2.53937,
    maimed: 0.12,
    side: [254, 30],
  },
];

/** The table's row with this number. */
function rowOf(n: number): Row {
  const row = ROWS.find((r) => r.n === n);
  if (!row) throw new Error(`no row ${n}`);
  return row;
}

for (const row of ROWS) {
  test(`table row ${row.n}: F and W:F within ${TOL} of the table`, () => {
    const f = fallenShare(row.struck),
      wf = woundedPerFallen(row.struck);
    assert.ok(
      Math.abs(f - row.F) <= TOL && Math.abs(wf - row.WF) <= TOL,
      `row ${row.n}: got F ${f} and W:F ${wf}; the table says ${row.F} and ${row.WF}`,
    );
  });

  test(`table row ${row.n}: maimed share and side wounds exact`, () => {
    const share = maimedShare(row.struck.blow, row.struck.care);
    assert.ok(
      Math.abs(share - row.maimed) <= SHARE_EXACT,
      `row ${row.n}: maimed share ${share}; the table says ${row.maimed}`,
    );
    assert.deepEqual(sideWounds(100, 1000, row.struck), {
      wounded: row.side[0],
      maimed: row.side[1],
    });
  });
}

test("sideWounds(100, 150, row 3): wounded capped at the field less the fallen, maimed 5", () => {
  assert.deepEqual(sideWounds(100, 150, rowOf(3).struck), { wounded: 50, maimed: 5 });
});

test("sideWounds with no fallen gives no wounded and no maimed, whatever the row", () => {
  for (const row of ROWS) {
    assert.deepEqual(sideWounds(0, 500, row.struck), { wounded: 0, maimed: 0 });
  }
});

test("blowOf: a listed arm's blow; blunt for none, an unlisted arm, or an Object name", () => {
  assert.equal(blowOf("sword"), "edge");
  assert.equal(blowOf("automatic"), "shot");
  assert.equal(blowOf("mandibles"), "crush");
  assert.equal(blowOf("stick"), "blunt");
  assert.equal(blowOf("constructor"), "blunt");
  assert.equal(blowOf(null), "blunt");
  assert.equal(blowOf(undefined), "blunt");
});

/** A principle test that knows exactly these principles. */
function knowing(...ids: readonly string[]): (principle: string) => boolean {
  return (principle) => ids.includes(principle);
}

test("woundCare: the weights of the principles known, added in order and capped at 1", () => {
  assert.equal(woundCare(knowing()), 0);
  assert.equal(woundCare(knowing("herbalism")), 0.25);
  assert.equal(woundCare(knowing("herbalism", "medicine")), 0.6);
  assert.equal(woundCare(knowing("herbalism", "medicine", "sanitation")), 0.75);
  assert.equal(woundCare(knowing("herbalism", "medicine", "sanitation", "germs")), 1);
  assert.equal(woundCare(knowing("astrology")), 0);
  assert.equal(woundCare(knowing("herbalism", "astrology")), 0.25);
});

test("strikeHurt: the dead times the strike's ratio, rounded", () => {
  assert.equal(strikeHurt("fire", 7), 14);
  assert.equal(strikeHurt("quake", 7), 21);
  assert.equal(strikeHurt("meteor", 5), 6);
  assert.equal(strikeHurt("flood", 5), 2);
});

const BLOWS: readonly Blow[] = ["edge", "point", "blunt", "shot", "crush", "fire"];
const SHOCKS = [0, 0.5, 1, 1.4, 2];
const SHARES = [0, 0.5, 1];
const SIZES = [1, 10, 60, 300, 5000];

/** W:F of a struck side given by its parts. */
function wfOf(blow: Blow, shock: number, protection: number, care: number, size: number): number {
  return woundedPerFallen({ blow, shock, protection, care, size });
}

/**
 * Along the levels in their order, f never falls (dir 1) or never rises (dir -1), up to SLACK.
 */
function monotone<T>(
  levels: readonly T[],
  f: (level: T) => number,
  dir: 1 | -1,
  what: string,
): void {
  for (let i = 1; i < levels.length; i++) {
    const prev = f(levels[i - 1]!),
      next = f(levels[i]!);
    assert.ok(dir * (next - prev) >= -SLACK, `${what}: ${prev} then ${next} at ${levels[i]}`);
  }
}

test("W:F stays in [1.2, 4.5] over every blow, shock, protection, care and body size", () => {
  for (const blow of BLOWS)
    for (const shock of SHOCKS)
      for (const protection of SHARES)
        for (const care of SHARES)
          for (const size of SIZES) {
            const wf = wfOf(blow, shock, protection, care, size);
            assert.ok(
              wf >= 1.2 - SLACK && wf <= 4.5 + SLACK,
              `${blow} shock ${shock} protection ${protection} care ${care} size ${size}: ${wf}`,
            );
          }
});

test("W:F never falls as protection, care or size rises, and never rises with shock", () => {
  for (const blow of BLOWS)
    for (const shock of SHOCKS)
      for (const care of SHARES)
        for (const size of SIZES)
          monotone(
            SHARES,
            (protection) => wfOf(blow, shock, protection, care, size),
            1,
            `protection, ${blow} shock ${shock} care ${care} size ${size}`,
          );
  for (const blow of BLOWS)
    for (const shock of SHOCKS)
      for (const protection of SHARES)
        for (const size of SIZES)
          monotone(
            SHARES,
            (care) => wfOf(blow, shock, protection, care, size),
            1,
            `care, ${blow} shock ${shock} protection ${protection} size ${size}`,
          );
  for (const blow of BLOWS)
    for (const shock of SHOCKS)
      for (const protection of SHARES)
        for (const care of SHARES)
          monotone(
            SIZES,
            (size) => wfOf(blow, shock, protection, care, size),
            1,
            `size, ${blow} shock ${shock} protection ${protection} care ${care}`,
          );
  for (const blow of BLOWS)
    for (const protection of SHARES)
      for (const care of SHARES)
        for (const size of SIZES)
          monotone(
            SHOCKS,
            (shock) => wfOf(blow, shock, protection, care, size),
            -1,
            `shock, ${blow} protection ${protection} care ${care} size ${size}`,
          );
});

test("maimedShare stays in [0.02, 0.25] and never rises with care", () => {
  for (const blow of BLOWS) {
    for (const care of SHARES) {
      const m = maimedShare(blow, care);
      assert.ok(m >= 0.02 - SLACK && m <= 0.25 + SLACK, `${blow} care ${care}: ${m}`);
    }
    monotone(SHARES, (care) => maimedShare(blow, care), -1, `maimed share, ${blow}`);
  }
});
