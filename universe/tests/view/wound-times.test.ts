// Phase 55 M226, M229 (T39): a wound's record — its stages by the clock, how it shows, how it is
// told and how it is with them now.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NO_LOOK,
  woundLookAt,
  woundNow,
  woundStage,
  woundWords,
  type Wound,
} from "../../src/bridge/index.ts";

const w0: Wound = {
  event: "ev:0:900",
  from: "battle",
  year: 312,
  where: "the battle at Pounholt's land",
  blow: "edge",
  arm: "a bronze axe",
  member: "hand-l",
  words: "~ left hand",
  outcome: "lost",
  how: "cut off",
  lasting: "stump",
  at: 1000,
  home: 2000,
  up: 3000,
  mended: 4000,
  tended: "healer",
  by: "by Sairis's healer, Mira Vell",
  borne: false,
};
const hurtArm: Wound = {
  ...w0,
  member: "arm-l",
  words: "~ left arm",
  outcome: "healed",
  how: null,
  lasting: null,
};
const lostLeg: Wound = {
  ...w0,
  event: "ev:0:901",
  member: "leg-l",
  words: "~ left leg",
  how: "taken off",
  lasting: "crutch",
};

test("its stages", () => {
  assert.deepEqual(
    [999, 1000, 1999, 2000, 2999, 3000, 3999, 4000].map((t) => woundStage(w0, t)),
    ["before", "away", "away", "abed", "abed", "mending", "mending", "done"],
  );
});

test("its look", () => {
  assert.equal(woundLookAt([w0], 999), NO_LOOK);
  const lostArm: Wound = { ...w0, member: "arm-l", words: "~ left arm" };
  for (const t of [1000, 2500, 3500, 4500]) {
    const look = woundLookAt([lostArm], t);
    assert.ok(look.lost.includes("arm-l") && look.lost.includes("hand-l"), `${t}`);
  }
  const abed = woundLookAt([hurtArm], 2500);
  assert.equal(abed.abed, true);
  assert.ok(abed.bound.includes("arm-l"));
  assert.equal(woundLookAt([hurtArm], 3500).sling, "l");
  assert.equal(woundLookAt([lostArm], 3500).sling, null);
  const mending = woundLookAt([lostLeg], 3500),
    done = woundLookAt([lostLeg], 4500);
  assert.equal(mending.crutch, "l");
  assert.ok(mending.bound.includes("leg-l"));
  assert.equal(done.crutch, "l");
  assert.ok(!done.bound.includes("leg-l"));
  assert.equal(woundLookAt([lostLeg, { ...lostArm, event: "ev:0:902" }], 4500).crutch, "r");
  const lame: Wound = { ...lostLeg, outcome: "lame", how: null, lasting: "limp" };
  assert.equal(woundLookAt([lame], 4500).limp, "l");
  const eye: Wound = { ...w0, member: "eye-r", words: "an eye", how: "put out", lasting: "patch" };
  assert.equal(woundLookAt([eye], 2500).patch, null);
  assert.equal(woundLookAt([eye], 3000).patch, "r");
  const scar: Wound = { ...hurtArm, outcome: "scarred", lasting: "scar" };
  assert.deepEqual(woundLookAt([scar], 3500).scars, []);
  assert.deepEqual(woundLookAt([scar], 4000).scars, ["arm-l"]);
  // (Two arms in a sling's way at once: the earlier wound sets its side.)
  const later: Wound = {
    ...hurtArm,
    event: "ev:0:903",
    member: "arm-r",
    words: "~ right arm",
    at: 1100,
  };
  assert.equal(woundLookAt([later, hurtArm], 3500).sling, "l");
});

test("its words", () => {
  assert.equal(
    woundWords(w0, 1),
    "Lost his left hand at the battle at Pounholt's land in year 312, to a bronze axe; the stump bound by Sairis's healer, Mira Vell.",
  );
  assert.equal(
    woundWords({ ...w0, how: "taken off", by: "at home" }, 1),
    "Lost his left hand at the battle at Pounholt's land in year 312, to a bronze axe: it was taken off at home.",
  );
  assert.equal(
    woundWords(
      {
        ...w0,
        member: "eye-l",
        words: "an eye",
        how: "put out",
        arm: "an arrow",
        lasting: "patch",
      },
      0,
    ),
    "Lost an eye at the battle at Pounholt's land in year 312, to an arrow; she wears a patch over it.",
  );
  const lame: Wound = {
    ...w0,
    member: "leg-l",
    words: "~ left leg",
    lasting: "limp",
    outcome: "lame",
    how: null,
    arm: "a bronze-tipped spear",
  };
  assert.equal(
    woundWords(lame, 1),
    "Wounded in his left leg at the battle at Pounholt's land in year 312, by a bronze-tipped spear; it healed, but he limps.",
  );
  assert.equal(
    woundWords(
      {
        ...w0,
        from: "fire",
        blow: "fire",
        where: "the fire in Sairis",
        arm: null,
        outcome: "scarred",
        how: null,
        lasting: "scar",
        member: "arm-r",
        words: "~ right arm",
      },
      1,
    ),
    "Burned on his right arm in the fire in Sairis in year 312; it left a scar.",
  );
  assert.equal(
    woundWords(lame),
    "Wounded in their left leg at the battle at Pounholt's land in year 312, by a bronze-tipped spear; it healed, but they limp.",
  );
});

test("how it is now", () => {
  assert.equal(woundNow(w0, 2500, 1), "Abed with his wounds, tended by Sairis's healer, Mira Vell");
  assert.equal(woundNow(w0, 3500, 1), "Up again, the stump still bound");
  assert.equal(woundNow(w0, 4500, 1), null);
});
