import { test } from "node:test";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { Rng, seedFromText } from "../../src/kernel/index.ts";
import {
  civilizationsOf,
  clusterStars,
  develop,
  foreignPlanets,
  lifeElsewhere,
  makeGalaxy,
  type Elsewhere,
  type ForeignPlanet,
  type GalaxyStar,
} from "../../src/gen/index.ts";

// Every world of the Earth seed's cluster, and what lives on each.
const seed = seedFromText("first light"),
  rng = new Rng(seed),
  stars = clusterStars(rng, makeGalaxy(rng)),
  civs = civilizationsOf(rng, stars, (s) => foreignPlanets(rng, s)),
  worlds: { star: GalaxyStar; planet: ForeignPlanet; life: Elsewhere }[] = [];
for (const star of stars)
  for (const planet of foreignPlanets(rng, star))
    worlds.push({
      star,
      planet,
      life: lifeElsewhere(
        rng,
        star,
        planet,
        civs.some((c) => c.star === star.ref && c.planet === planet.index),
      ),
    });
const of = (level: string) => worlds.filter((w) => w.life.level === level);

test("most worlds are lifeless; of those with seas, most hold cells; bodies are rarer, a people rarest", () => {
  const n = (l: string) => of(l).length;
  assert.ok(n("none") > n("cells") + n("bodies"), "most are lifeless");
  assert.ok(
    n("cells") > n("bodies") && n("bodies") > n("people"),
    JSON.stringify({ cells: n("cells"), bodies: n("bodies"), people: n("people") }),
  );
  assert.ok(
    n("chemistry") > 0 && n("people") === civs.length,
    "every civilization's world holds its people",
  );
});

test("life needs water that lies liquid, a star alive, and time", () => {
  for (const { star, planet, life } of worlds) {
    if (planet.kind === "giant" || planet.kind === "ice giant" || star.remnant)
      assert.equal(life.level, "none", "no life on a giant, nor about a dead star");
    if (life.level === "cells" || life.level === "bodies" || life.level === "people") {
      assert.ok(planet.water === "seas" || planet.water === "ice", "life lives in water");
      assert.ok(
        life.cellsAgo !== null && life.cellsAgo <= star.ageGyr,
        "its cells came after its star",
      );
      assert.ok(life.small.includes("eater"), "small cells wherever there is life");
    }
    if (life.level === "bodies" || life.level === "people") {
      assert.ok(life.bodiesAgo !== null && life.bodiesAgo < life.cellsAgo!, "bodies after cells");
      assert.equal(life.where, "seas");
      assert.ok(life.bodies.length >= 4, "its bodies sketched");
      for (const b of life.bodies)
        assert.ok(
          isDeepStrictEqual(develop(b.genome, b.body.level), b.body),
          "a body grows from its instructions",
        );
    }
    if (planet.water === "ice" && life.level !== "none")
      assert.ok(
        life.level === "chemistry" ||
          (life.level === "cells" && life.where === "water under its ice"),
      );
    assert.ok(life.because.length > 10, "why, in words");
  }
});

test("a world's life is drawn from it alone: the same each time", () => {
  const again = new Rng(seed);
  for (const w of worlds.filter((x) => x.life.level === "bodies").slice(0, 5))
    assert.ok(isDeepStrictEqual(lifeElsewhere(again, w.star, w.planet, false), w.life));
  // Worlds ashore have bodies of the land; worlds whose air is thin keep them in the sea.
  const ashore = of("bodies").filter(
    (w) => /ashore/.test(w.life.because) && !/none/.test(w.life.because),
  );
  for (const w of ashore)
    assert.ok(w.life.bodies.some((b) => b.body.legs > 0 && b.way !== "sea crawler"));
});
