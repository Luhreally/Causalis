import { test } from "node:test";
import assert from "node:assert/strict";
import { ARM_LOOKS, DEFAULT_LOOK, armLook, isGun } from "../../src/view/arms.ts";
import { firesFrom, loosesFrom, strokeOf } from "../../src/view/battle.ts";

// Phase 53 M220: one table of how each arm looks and fires. Today's arms keep the values the views
// computed before the table existed (written out here as they were); the new guns are rows of it.

test("today's arms keep the strokes, looses, shares and words the views gave them", () => {
  // strokeOf, loosesFrom (firesFrom for the guns), loosedShare, FIGHTERS and shotBy, as they were.
  const before: Record<
    string,
    { stroke: string; looses: boolean; loosed: number; fighter: string; shot: string }
  > = {
    club: { stroke: "strike", looses: false, loosed: 0.25, fighter: "a clubman", shot: "an arrow" },
    spear: {
      stroke: "thrust",
      looses: false,
      loosed: 0.25,
      fighter: "a spearman",
      shot: "an arrow",
    },
    axe: { stroke: "strike", looses: false, loosed: 0.25, fighter: "an axeman", shot: "an arrow" },
    sword: {
      stroke: "strike",
      looses: false,
      loosed: 0.25,
      fighter: "a swordsman",
      shot: "an arrow",
    },
    bow: { stroke: "strike", looses: true, loosed: 0.25, fighter: "a bowman", shot: "an arrow" },
    "horn-bow": {
      stroke: "strike",
      looses: true,
      loosed: 0.25,
      fighter: "a bowman",
      shot: "an arrow",
    },
    musket: {
      stroke: "thrust",
      looses: true,
      loosed: 0.45,
      fighter: "a musketeer",
      shot: "a musket ball",
    },
    rifle: { stroke: "thrust", looses: true, loosed: 0.6, fighter: "a rifleman", shot: "a bullet" },
    claws: {
      stroke: "strike",
      looses: false,
      loosed: 0.25,
      fighter: "a clawed fighter",
      shot: "an arrow",
    },
    mandibles: {
      stroke: "bite",
      looses: false,
      loosed: 0.25,
      fighter: "a biter",
      shot: "an arrow",
    },
    tusks: { stroke: "thrust", looses: false, loosed: 0.25, fighter: "a tusker", shot: "an arrow" },
    grapple: {
      stroke: "grapple",
      looses: false,
      loosed: 0.25,
      fighter: "a grappler",
      shot: "an arrow",
    },
    "shell-darts": {
      stroke: "thrust",
      looses: true,
      loosed: 0.25,
      fighter: "a darter",
      shot: "a dart",
    },
  };
  for (const [arm, was] of Object.entries(before)) {
    assert.equal(strokeOf(arm), was.stroke, `stroke of ${arm}`);
    assert.equal(loosesFrom(arm), was.looses, `looses from ${arm}`);
    assert.equal(firesFrom(arm), arm === "musket" || arm === "rifle", `fires ${arm}`);
    assert.equal(armLook(arm).loosed, was.loosed, `loosed share of ${arm}`);
    assert.equal(armLook(arm).fighter, was.fighter, `fighter of ${arm}`);
    assert.equal(armLook(arm).shotWords, was.shot, `shot words of ${arm}`);
  }
});

test("the guns' own numbers: the rifle's share, the musket's words, the held lengths and bayonets", () => {
  assert.equal(armLook("rifle").loosed, 0.6);
  assert.equal(armLook("musket").loosed, 0.45);
  assert.equal(strokeOf("musket"), "thrust");
  assert.equal(armLook("rifle").fighter, "a rifleman");
  assert.equal(armLook("musket").shotWords, "a musket ball");
  assert.equal(armLook("rifle").shotWords, "a bullet");
  assert.equal(armLook("musket").long, 1);
  assert.equal(armLook("rifle").long, 0.9);
  assert.equal(armLook("spear").long, undefined, "a spear keeps the render's own length");
  for (const arm of ["musket", "rifle"]) {
    assert.equal(armLook(arm).smoke, 1, `black powder ${arm}`);
    assert.equal(armLook(arm).bayonet, true, `bayonet ${arm}`);
    assert.equal(armLook(arm).burst, 1, `single shot ${arm}`);
  }
});

test("an arm with no row, or no arm at all, looks as the code always did", () => {
  for (const arm of ["hovercraft", "", undefined, "constructor", "__proto__"])
    assert.equal(armLook(arm), DEFAULT_LOOK, `${arm}`);
  assert.equal(DEFAULT_LOOK.fighter, "one");
  assert.equal(DEFAULT_LOOK.shotWords, "an arrow");
  assert.equal(DEFAULT_LOOK.loosed, 0.25);
  assert.equal(strokeOf("hovercraft"), "strike");
  assert.equal(loosesFrom("hovercraft"), false);
  assert.equal(isGun(undefined), false);
});

test("the three new arms are guns: smokeless ones smoke less than black powder, the machine gun fires in bursts", () => {
  for (const arm of ["repeater", "autoloader", "automatic"]) {
    assert.equal(isGun(arm), true, arm);
    assert.equal(firesFrom(arm), true, arm);
    assert.equal(loosesFrom(arm), true, arm);
  }
  assert.ok(armLook("autoloader").smoke < armLook("rifle").smoke);
  assert.ok(armLook("automatic").smoke < armLook("musket").smoke);
  assert.ok(armLook("automatic").burst > 1);
  assert.equal(armLook("repeater").fighter, "a rifleman");
  assert.equal(armLook("automatic").fighter, "a machine gunner");
  assert.equal(armLook("automatic").shotWords, "a machine-gun bullet");
  assert.equal(strokeOf("repeater"), "thrust");
  assert.equal(strokeOf("automatic"), "strike");
  assert.equal(armLook("repeater").loosed, 0.65);
  assert.equal(armLook("autoloader").loosed, 0.7);
  assert.equal(armLook("automatic").loosed, 0.8);
});

test("the guns, in the order the village lists them: musket and rifle first", () => {
  assert.deepEqual(Object.keys(ARM_LOOKS).filter(isGun), [
    "musket",
    "rifle",
    "repeater",
    "autoloader",
    "automatic",
  ]);
});

test("every row's numbers are in range, and a gun has a held length", () => {
  for (const [arm, look] of Object.entries(ARM_LOOKS)) {
    assert.ok(look.loosed > 0 && look.loosed < 1, `loosed share of ${arm}`);
    assert.ok(look.smoke >= 0 && look.smoke <= 1, `smoke of ${arm}`);
    assert.ok(Number.isInteger(look.burst) && look.burst >= 1, `burst of ${arm}`);
    if (look.looses === "shot") assert.ok(look.long! > 0, `held length of ${arm}`);
  }
});
