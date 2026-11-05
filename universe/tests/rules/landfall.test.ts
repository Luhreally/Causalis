// A landing on natives (Phase 70): the fight's own numbers, checked against spears and guns as they went (figures from memory:
// estimates), and that the same numbers always make the same fight, a camp and a city do not read the same, and either side can win.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GRIP,
  landfallFight,
  nativeHost,
  shipForce,
  type ComerNumbers,
  type NativeNumbers,
  type Part,
} from "../../src/rules/index.ts";
import { drawnOf } from "../../src/view/index.ts";

const FOOT: Part = { role: "mount", id: "foot", material: "hide" },
  BARE: Part = { role: "guard", id: "bare", material: "hide" };
const comers = (flesh: number, arm: string, more: Partial<ComerNumbers> = {}): ComerNumbers => ({
  flesh,
  made: 0,
  parts: [{ role: "arm", id: arm, material: "steel" }, BARE, FOOT],
  breathes: true,
  water: false,
  gravity: 1,
  strength: 1,
  care: 0.2,
  ...more,
});
const natives = (fighters: number, more: Partial<NativeNumbers> = {}): NativeNumbers => ({
  stage: "camps",
  // (A middling draw of where it came down: this many came to it.)
  people: fighters / (0.25 * 0.5),
  parts: nativeHost("camps", { manipulators: "hands", dexterity: 1 }, GRIP, 0.6, false, false),
  gravity: 1,
  strength: 1,
  size: 60,
  walls: false,
  ...more,
});
const DRAWS = { where: 0.5, sickThere: 0, sickHome: 0, round: () => 0.5 };

test("as spears and guns went: Omdurman and Shangani broken crossing, Isandlwana overrun", () => {
  const omdurman = landfallFight(comers(25000, "repeater"), natives(50000), false, DRAWS);
  assert.equal(omdurman.how, "broke crossing");
  assert.ok(omdurman.dead[1] > 8000 && omdurman.dead[1] < 25000, `dead ${omdurman.dead[1]}`);
  const isandlwana = landfallFight(comers(1300, "rifle"), natives(20000), false, DRAWS);
  assert.equal(isandlwana.won, false);
  const shangani = landfallFight(comers(700, "automatic"), natives(5000), false, DRAWS);
  assert.equal(shangani.how, "broke crossing");
  assert.ok(shangani.dead[1] > 800 && shangani.dead[1] < 3000, `dead ${shangani.dead[1]}`);
});

test("the same numbers make the same fight", () => {
  const a = landfallFight(comers(250, "beam-rifle"), natives(4000), false, DRAWS),
    b = landfallFight(comers(250, "beam-rifle"), natives(4000), false, DRAWS);
  assert.deepEqual(a, b);
});

test("numbers turn it: more natives win where few do not", () => {
  const few = landfallFight(comers(250, "automatic"), natives(300), false, DRAWS),
    many = landfallFight(comers(250, "automatic"), natives(60000), false, DRAWS);
  assert.equal(few.won, true);
  assert.equal(many.won, false);
});

test("what they cannot breathe and what pulls them cuts their flesh, and not what they made", () => {
  const made: Part[] = [
      { role: "arm", id: "beam-rifle", material: "crystal" },
      { role: "guard", id: "driven-plate", material: "crystal" },
      { role: "mount", id: "machine-host", material: "crystal" },
    ],
    open = landfallFight(comers(600, "beam-rifle"), natives(3000), false, DRAWS),
    sealed = landfallFight(
      comers(600, "beam-rifle", { breathes: false, gravity: 0.5 }),
      natives(3000),
      false,
      DRAWS,
    ),
    machines = landfallFight(
      comers(0, "beam-rifle", { made: 600, parts: made, breathes: false, gravity: 0.5 }),
      natives(3000),
      false,
      DRAWS,
    );
  assert.ok(sealed.terms.some((t) => t.name === "air"));
  assert.ok(sealed.terms.some((t) => t.name === "pull"));
  assert.ok(open.dead[1] >= sealed.dead[1], `${open.dead[1]} v ${sealed.dead[1]}`);
  assert.ok(machines.crossed >= sealed.crossed);
});

test("a sickness crosses only to bare faces, and takes from those who never met it", () => {
  const bare = landfallFight(comers(250, "automatic"), natives(1000), true, {
      ...DRAWS,
      sickThere: 1,
    }),
    sealed = landfallFight(comers(250, "automatic", { breathes: false }), natives(1000), true, {
      ...DRAWS,
      sickThere: 1,
    });
  assert.ok(bare.fielded[1] < sealed.fielded[1]);
  assert.ok(bare.terms.some((t) => t.name === "sickness"));
  assert.ok(!sealed.terms.some((t) => t.name === "sickness"));
});

test("a long crossing eats what a ship could have carried", () => {
  const near = shipForce(1, 500, 20, true),
    far = shipForce(1, 500, 70, true),
    slow = shipForce(1, 500, 200, true);
  assert.ok(near.made > far.made);
  assert.equal(slow.made, 0);
  assert.equal(shipForce(1, 500, 20, false).made, 0);
  assert.equal(near.flesh, 250);
});

test("the fewer host is drawn at no less than a quarter of the more, and no more than there are", () => {
  assert.deepEqual(drawnOf([1700, 230], [48, 96]), [48, 96]);
  assert.deepEqual(drawnOf([1700, 6], [48, 96]), [48, 6]);
  assert.deepEqual(drawnOf([3, 900], [48, 96]), [3, 96]);
});
