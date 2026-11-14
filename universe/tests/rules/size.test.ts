// A world's size (asked 2026-11-12: "diffrent galaxy sizes/world/planet sizes options ... to have even more control of
// performance and speed"): a making in the seed's text that sets how many lands its history runs over, over the same planet.
// The usual world is untouched; a smaller one is the same ground and seas in fewer, wider lands, with as many people's room.
import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText, seedWithAct } from "../../src/kernel/index.ts";
import { MAKINGS, OPEN, landsOf, makingAct, makingsOf } from "../../src/rules/index.ts";
import { generateHomeWorld, provinceWorld, PROVINCE_FREQUENCY } from "../../src/gen/index.ts";

test("a size is read from the seed's text, and none is the usual", () => {
  assert.equal(landsOf("first light"), undefined);
  const small = seedWithAct("first light", makingAct("size", "small")),
    medium = seedWithAct("alien 41", makingAct("size", "medium"));
  assert.equal(makingsOf(small).size, "small");
  assert.equal(landsOf(small), MAKINGS.size.small[0]);
  assert.equal(landsOf(medium), MAKINGS.size.medium[0]);
  assert.ok(MAKINGS.size.small[0] < MAKINGS.size.medium[0]);
  assert.ok(MAKINGS.size.medium[0] < PROVINCE_FREQUENCY);
});

test("a smaller world is the same planet in fewer, wider lands, as much room in all", () => {
  const text = "alien 41",
    small = seedWithAct(text, makingAct("size", "small")),
    fine = generateHomeWorld(seedFromText(text), OPEN, 32),
    fineSmall = generateHomeWorld(seedFromText(small), OPEN, 32);
  // (The same ground and seas, life and people: the size is no part of the planet.)
  assert.equal(fineSmall.digest, fine.digest);
  const usual = provinceWorld(fine, 10),
    fewer = provinceWorld(fineSmall, 5);
  assert.ok(fewer.grid.count < usual.grid.count / 3);
  assert.equal(usual.stride, 32 / 10);
  assert.equal(fewer.stride, 32 / 5);
  // (Every fine cell is in a land either way: the planet's whole area is shared out, none lost.)
  const area = (g: typeof usual) => {
    let a = 0;
    for (let c = 0; c < g.fine.grid.count; c++)
      if (g.provinceOf[c]! >= 0) a += g.fine.grid.areas[c]!;
    return a;
  };
  assert.ok(Math.abs(area(usual) - area(fewer)) < 1e-9 * area(usual));
});

test("the usual world's stride is the 3.2 it always was", () => {
  const fine = generateHomeWorld(seedFromText("first light"), OPEN, 64);
  assert.equal(provinceWorld(fine).stride, 3.2);
});

test("a sky's size: fewer stars and peoples, or more, about the same home", async () => {
  const { skyOf } = await import("../../src/rules/index.ts");
  const { Rng } = await import("../../src/kernel/index.ts");
  const { clusterStars, makeGalaxy, CLUSTER_LY } = await import("../../src/gen/index.ts");
  assert.equal(skyOf("alien 41"), null);
  const small = skyOf(seedWithAct("alien 41", makingAct("sky", "small")))!,
    large = skyOf(seedWithAct("alien 41", makingAct("sky", "large")))!;
  assert.ok(small.radius < CLUSTER_LY && large.radius > CLUSTER_LY);
  assert.ok(small.most < 12 && large.most > 12);
  const count = (radius?: number) => {
    const rng = new Rng(seedFromText("alien 41"));
    return clusterStars(rng, makeGalaxy(rng), radius).length;
  };
  const usual = count(),
    few = count(small.radius),
    many = count(large.radius);
  assert.ok(few < usual / 4, `${few} stars against ${usual}`);
  assert.ok(many > usual * 2, `${many} stars against ${usual}`);
});

test("a small sky is a true one: the usual sky's nearest stars at its density, and a large one holds the usual whole", async () => {
  const { skyOf } = await import("../../src/rules/index.ts");
  const { Rng } = await import("../../src/kernel/index.ts");
  const { clusterStars, makeGalaxy } = await import("../../src/gen/index.ts");
  const stars = (text: string) => {
    const rng = new Rng(seedFromText(text));
    return clusterStars(rng, makeGalaxy(rng), skyOf(text)?.radius);
  };
  for (const name of ["first light", "harrow 348"]) {
    const usual = stars(name),
      small = stars(seedWithAct(name, makingAct("sky", "small"))),
      large = stars(seedWithAct(name, makingAct("sky", "large"))),
      refs = (list: typeof usual, within = Infinity) =>
        list
          .filter((s) => s.distance <= within)
          .map((s) => s.ref)
          .join(",");
    assert.equal(refs(small), refs(usual, 25));
    assert.equal(refs(usual), refs(large, 50));
    const density = (n: number, r: number) => n / r ** 3,
      d = density(usual.length, 50);
    for (const [n, r] of [
      [small.length, 25],
      [large.length, 80],
    ] as const) {
      const k = density(n, r) / d;
      assert.ok(
        k > 0.75 && k < 1.33,
        `${name}: ${n} stars within ${r} ly are ${k.toFixed(2)} as dense`,
      );
    }
  }
});
