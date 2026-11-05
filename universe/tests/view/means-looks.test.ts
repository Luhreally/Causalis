import { test } from "node:test";
import assert from "node:assert/strict";
import { ARM_LOOKS, armLook, isGun } from "../../src/view/arms.ts";
import { madeHowOf, thingForm } from "../../src/host/looks.ts";
import { specimenParts, type SpecimenPart } from "../../src/ui/specimen.ts";
import type { MadeHow, Portrait } from "../../src/bridge/index.ts";

// F1 (T5): the arms a world's means make look as their rows and names say. The new rows are added
// at the end of each table; the arms Earth has keep their looks (arms.test.ts, specimen.test.ts and
// looks.test.ts hold their values).

type Thing = Extract<Portrait, { kind: "thing" }>;

const thing = (form: string, made: MadeHow = "forged", over: Partial<Thing> = {}): Thing => ({
  kind: "thing",
  form,
  made,
  color: [0.7, 0.72, 0.78],
  lustre: "metallic",
  haft: null,
  quality: 60,
  worn: 0,
  key: 99,
  ...over,
});

/** Every corner finite, every face at least three corners, every face index inside its mesh. */
function sound(parts: readonly SpecimenPart[]): void {
  for (const part of parts) {
    for (const p of part.mesh.v) for (const c of p) assert.ok(Number.isFinite(c), `finite ${c}`);
    for (const face of part.mesh.f) {
      assert.ok(face.length >= 3, "a face has at least three corners");
      for (const i of face) assert.ok(i >= 0 && i < part.mesh.v.length, `face index ${i} inside`);
    }
  }
}

test("the new arms are rows of the table: a gas dart looses darts, a sound lance looses shot in a beam", () => {
  const dart = armLook("gas-dart"),
    lance = armLook("sound-lance");
  assert.equal(dart.looses, "darts");
  assert.equal(dart.loosed, 0.45);
  assert.equal(dart.fighter, "a dart-gunner");
  assert.equal(dart.shotWords, "a long dart");
  assert.equal(dart.beam, undefined, "a dart gives no light");
  assert.equal(lance.looses, "shot");
  assert.equal(lance.loosed, 0.6);
  assert.equal(lance.fighter, "a sound-lancer");
  assert.equal(lance.shotWords, "a blow of sound");
  assert.equal(lance.order, "open");
  assert.equal(lance.fire, "continuous");
  assert.equal(lance.ladders, false);
  assert.deepEqual(lance.beam, [0.55, 0.75, 1]);
});

test("every row that looses shot has a held length, the sound lance's too", () => {
  for (const [arm, look] of Object.entries(ARM_LOOKS))
    if (look.looses === "shot") assert.ok(look.long! > 0, `held length of ${arm}`);
  assert.equal(armLook("sound-lance").long, 0.72);
});

test("the guns: the sound lance is one, after the beam lance; the gas dart is not; the others keep their order", () => {
  assert.equal(isGun("sound-lance"), true);
  assert.equal(isGun("gas-dart"), false);
  assert.equal(isGun("musket"), true);
  assert.equal(isGun("sword"), false);
  const guns = Object.keys(ARM_LOOKS).filter(isGun);
  assert.deepEqual(guns.slice(0, 7), [
    "musket",
    "rifle",
    "repeater",
    "autoloader",
    "automatic",
    "beam-rifle",
    "beam-lance",
  ]);
  assert.equal(guns[guns.length - 1], "sound-lance");
});

test("the made-how: a set edge is knapped, wound fibre and wound works are woven, metal is as it was", () => {
  assert.equal(madeHowOf("ice flakes", "arms", "set edge"), "knapped");
  assert.equal(madeHowOf("acetylene", "arms", "wound"), "woven");
  assert.equal(madeHowOf("steel", "machines", "wound works"), "woven");
  assert.equal(madeHowOf("steel", "arms", "machined"), "machined");
  assert.equal(madeHowOf("bronze", "arms"), "cast");
});

test("the names: set-blade, gas-dart and sound-lance are forms of their own, and a sword is still a sword", () => {
  assert.equal(thingForm("a set-blade"), "set-blade");
  assert.equal(thingForm("a gas-dart"), "gas-dart");
  assert.equal(thingForm("a sound-lance"), "sound-lance");
  assert.equal(thingForm("a bronze sword"), "sword");
});

test("a set blade: a wooden spine in the haft's colour, sixteen flakes in the stuff's colour, all sound", () => {
  const haft: [number, number, number] = [0.4, 0.3, 0.2];
  const parts = specimenParts(thing("set-blade", "knapped", { haft }));
  sound(parts);
  assert.equal(parts.length, 2, "a spine and its flakes (the sword's row would give four)");
  const spine = parts[0]!,
    flakes = parts[1]!;
  assert.equal(spine.handle, true, "the spine is wood");
  assert.deepEqual(spine.color, haft);
  assert.deepEqual(flakes.color, [0.7, 0.72, 0.78], "the flakes are the stuff's colour");
  assert.equal(spine.mesh.f.length, 6, "the spine is one box");
  assert.equal(flakes.mesh.f.length, 16 * 6, "sixteen flakes, eight along each edge");
});

test("a gas dart: a long thin shaft with four fins, all of its stuff", () => {
  const parts = specimenParts(
    thing("gas-dart", "woven", { color: [0.8, 0.6, 0.3], lustre: "dull" }),
  );
  sound(parts);
  assert.equal(parts.length, 2, "the shaft and its fins");
  for (const p of parts) assert.deepEqual(p.color, [0.8, 0.6, 0.3]);
  const shaft = parts[0]!.mesh.v,
    fins = parts[1]!.mesh.v;
  const span = (vs: readonly number[]) => Math.max(...vs) - Math.min(...vs);
  const ys = shaft.map((p) => p[1]),
    xs = shaft.map((p) => p[0]);
  assert.ok(span(ys) > 20 * span(xs), `long and thin: ${span(ys)} by ${span(xs)}`);
  // Four fins: the fins reach out both ways along x, and both ways along z.
  for (const axis of [0, 2]) {
    const along = fins.map((p) => p[axis]!);
    assert.ok(
      Math.min(...along) < -0.07 && Math.max(...along) > 0.07,
      `the fins reach both ways on axis ${axis}`,
    );
  }
});

test("a sound lance is drawn as a beam lance is, part for part", () => {
  for (const made of ["woven", "forged"] as const)
    assert.deepEqual(
      specimenParts(thing("sound-lance", made, { key: 7 })),
      specimenParts(thing("beam-lance", made, { key: 7 })),
    );
});

test("Earth's darts still fan three shafts with their points, and its sword still has four parts", () => {
  assert.equal(specimenParts(thing("darts", "carved")).length, 6);
  assert.equal(specimenParts(thing("shell-darts", "carved")).length, 6);
  assert.equal(specimenParts(thing("sword")).length, 4);
});
