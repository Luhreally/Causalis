import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { generateHomeWorld } from "../../src/gen/index.ts";
import {
  CLADES,
  HOUSE_ROLES,
  OPEN,
  bodyOf,
  compose,
  realization,
  type Doctrine,
  type Material,
} from "../../src/rules/index.ts";
import { ALIEN } from "../../src/host/planet.ts";
import { designsOf, landMaterials, populationContext } from "../../src/sim/index.ts";

const cond = { warmth: 18, rain: 800, gravity: 1, ocean: 0.7 };
const body = (id: string) =>
  bodyOf(
    CLADES.find((c) => c.id === id)!,
    cond,
    [0.5, 0.5, 0.5],
  );

test("the same land and the same knowledge give each body its own house", () => {
  const all: Material[] = [
      "wood",
      "reed",
      "hide",
      "earth",
      "mud",
      "stone",
      "fired clay",
      "coral",
      "shell",
      "kelp",
    ],
    knows = () => true,
    doctrine: Doctrine = {
      warmth: 0.4,
      cool: 0.4,
      shedding: 0.8,
      lasting: 0.4,
      room: 0.4,
      cost: 0.5,
      together: 0.8,
    },
    formOf = (id: string, d: Doctrine = doctrine) =>
      compose(HOUSE_ROLES, knows, (m) => all.includes(m), d, body(id)).find(
        (p) => p.role === "form",
      )!.id;
  // Apes take none of the forms made for other bodies.
  const apes = compose(HOUSE_ROLES, knows, (m) => all.includes(m), doctrine, body("ape"));
  for (const p of apes) assert.equal(realization(p.id).fits, undefined, p.id);
  assert.equal(formOf("burrower"), "hive");
  assert.equal(formOf("trunk"), "great-hall");
  assert.equal(formOf("shaggy", { ...doctrine, high: 1 }), "tree-house");
  assert.equal(formOf("strider", { ...doctrine, high: 0.5 }), "nest");
  assert.ok(["warren", "shell-tower"].includes(formOf("swimmer")));
});

test("a people of the water builds with the shelf's gifts, not the land's", () => {
  const world = ALIEN.build(seedFromText("alien 55")),
    ctx = populationContext(world);
  world.runTo(60 * YEAR);
  const p = ctx.provinces.all().find((q) => ctx.settlements.inProvince(q.cell).length)!;
  const at = landMaterials(ctx, p.cell);
  assert.ok(at.has("shell") && !at.has("wood") && !at.has("reed"));
  const house = designsOf(world).of(p.ref)!;
  for (const part of house.parts)
    assert.ok(["shell", "coral", "kelp", "stone", "earth"].includes(part.material), part.material);
});

test("across open worlds, peoples of different bodies live in differently shaped houses", () => {
  const forms = new Map<string, Set<string>>();
  for (let i = 0; i < 40; i++) {
    const g = generateHomeWorld(seedFromText(`alien ${i}`), OPEN),
      b = g.life.people?.body;
    if (!b) continue;
    const doctrine: Doctrine = {
      warmth: 0.3,
      cool: 0.3,
      shedding: 0.5,
      lasting: 0.4,
      room: 0.4,
      cost: 0.5,
      together: b.social,
      high: b.limbs >= 4 ? 1 : b.skin === "feathers" ? 0.5 : 0,
    };
    const all: Material[] = ["wood", "reed", "earth", "mud", "stone", "coral", "shell", "kelp"],
      form = compose(
        HOUSE_ROLES,
        () => true,
        (m) => all.includes(m),
        doctrine,
        b,
      ).find((p) => p.role === "form")!.id;
    forms.set(b.clade, (forms.get(b.clade) ?? new Set()).add(form));
  }
  const distinct = new Set([...forms.values()].flatMap((s) => [...s]));
  assert.ok(distinct.size >= 4, `${[...distinct].join(", ")}`);
});
