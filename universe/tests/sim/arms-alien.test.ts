// Arms of a world's own stuff (Phase 54 M222): a host's stone, copper, bronze and iron are what its
// seat finds and works — on Earth exactly as before (a frozen copy of the old rule says so), on a
// world of its own chemistry its own: lydite for flint, copper hardened with arsenic for bronze,
// native iron forged from the lump where its lava ran through buried coal.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { groundStone, nativeIronLands, worldChemistry } from "../../src/gen/index.ts";
import { EARTHLIKE, G, METALS, OPEN, STONES, type Edge, type Part } from "../../src/rules/index.ts";
import {
  makePopulationWorld,
  metalSource,
  partStuff,
  populationContext,
  type PopulationContext,
} from "../../src/sim/index.ts";

/** partStuff as it was before Phase 54, frozen. */
function before(
  ctx: PopulationContext,
  seat: number,
  part: Part,
): { readonly stuff: string; readonly edge: Edge; readonly usual: Edge } | null {
  if (part.material === "stone") {
    const { stone } = groundStone(ctx.generated, seat);
    return { stuff: stone.name, edge: stone, usual: STONES.limestone! };
  }
  if (!["copper", "bronze", "iron", "steel"].includes(part.material)) return null;
  const m = part.material as "copper" | "bronze" | "iron" | "steel",
    source = m === "iron" ? metalSource(ctx, seat, G.iron) : null,
    bog = source?.how === "ore" && source.ore.lie === "bog";
  return { stuff: bog ? "bog iron" : m, edge: METALS[bog ? "bog iron" : m], usual: METALS[m] };
}

const MATERIALS = ["stone", "copper", "bronze", "iron", "steel", "wood", "machined"] as const;
const part = (material: (typeof MATERIALS)[number]): Part => ({
  role: "arm",
  id: "spear",
  material,
});

test("on Earth a host's stuff is as it was, land by land", () => {
  const world = makePopulationWorld(seedFromText("first light"), {
    prior: EARTHLIKE,
    start: "spread",
  });
  world.runTo(400 * YEAR);
  const ctx = populationContext(world),
    cells = [...ctx.provinces.all()].map((p) => p.cell).sort((a, b) => a - b);
  let bog = 0;
  for (const cell of cells)
    for (const m of MATERIALS) {
      const was = before(ctx, cell, part(m)),
        now = partStuff(ctx, cell, part(m));
      assert.deepEqual(now, was, `${m} at ${cell}`);
      // (The very objects: Earth's stones and metals, not copies.)
      if (was && now) assert.equal(now.edge, was.edge, `${m} at ${cell}: Earth's own edge`);
      if (now?.stuff === "bog iron") bog++;
    }
  assert.ok(bog > 0, "some land arms with bog iron, as before");
});

test("on a world where nothing rusts: copper hardened with arsenic, native iron of its own", () => {
  const world = makePopulationWorld(seedFromText("alien 16"), {
    prior: OPEN,
    start: "spread",
  });
  world.runTo(300 * YEAR);
  const ctx = populationContext(world),
    chem = worldChemistry(ctx.generated),
    cells = [...ctx.provinces.all()].map((p) => p.cell).sort((a, b) => a - b),
    native = nativeIronLands(ctx.generated);
  assert.equal(chem.hardener, "arsenic");
  assert.equal(native.size, 6, "six lands where lava ran through buried coal");
  const bronze = new Set<string>(),
    stones = new Set<string>();
  let telluric = 0;
  for (const cell of cells) {
    bronze.add(partStuff(ctx, cell, part("bronze"))!.stuff);
    stones.add(partStuff(ctx, cell, part("stone"))!.stuff);
    const source = metalSource(ctx, cell, G.iron);
    if (source?.how === "ore" && source.ore.lie === "telluric") {
      telluric++;
      assert.equal(partStuff(ctx, cell, part("iron"))!.stuff, "telluric iron", `iron at ${cell}`);
    }
  }
  assert.deepEqual([...bronze], ["arsenical copper"], "bronze is copper hardened with arsenic");
  // (The shale's chert black with the carbon nothing burned: lydite, never Earth's grey chert.)
  assert.ok(stones.has("lydite"), `lydite among its stones: ${[...stones].join(", ")}`);
  assert.ok(!stones.has("chert"), `grey chert where nothing rusts: ${[...stones].join(", ")}`);
  console.log(`  alien 16: ${telluric} lands arm with native iron`);
});
