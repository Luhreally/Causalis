import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { generateHomeWorld } from "../../src/gen/index.ts";
import { PRIORS } from "../../src/rules/index.ts";
import {
  homePlanet,
  languagesOf,
  makePopulationWorld,
  planLanguages,
  populationContext,
  spreadOf,
  cultureOf,
} from "../../src/sim/index.ts";

// Phase 28: the peopling — the bands' spread before the chronicle, pure, and the god's hand on
// it: the seas lowered for them to walk over, a kind age or a hard one, the cradle bidden.

const total = (world: ReturnType<typeof makePopulationWorld>) =>
  populationContext(world)
    .provinces.all()
    .reduce((n, p) => n + p.total(), 0);

test("the spread the chronicle opens on is the spread planned: its lands, its people, its languages", () => {
  const world = makePopulationWorld(seedFromText("first light"), { start: "spread" }),
    ctx = populationContext(world),
    g = homePlanet(world).generated,
    spread = spreadOf(g, "first light");
  assert.equal(spread.lands.length, ctx.provinces.all().length);
  spread.lands.forEach(([cell], i) =>
    assert.equal(ctx.provinces.get(cell)!.total(), spread.sizes[i], `land ${cell}`),
  );
  // The languages founded are the languages planned: each land's, and each one's family.
  const culture = cultureOf(world),
    { languages, speaks } = planLanguages(
      g,
      spread.lands.map(([cell, , from]) => [cell, from] as const),
      (cell) => culture.get(cell)!.tongue,
    ),
    store = languagesOf(world);
  assert.deepEqual(
    store.all().map((l) => [l.name, l.parent, l.family]),
    languages.map((l) => [l.name, l.parent, l.family]),
  );
  for (const [cell] of spread.lands) assert.equal(store.of(cell)!.index, speaks.get(cell));
});

test("the seas lowered: the bands walk over wider straits to lands they would not have reached", () => {
  const plain = makePopulationWorld(seedFromText("first light"), { start: "spread" }),
    low = makePopulationWorld(seedFromText("first light ~peopling seas low"), { start: "spread" }),
    a = populationContext(plain).provinces.all(),
    b = populationContext(low).provinces.all();
  assert.ok(b.length > a.length, `${b.length} lands with the seas low, ${a.length} as they were`);
  // (Every land reached as it was is reached still: the seas only open more.)
  const reached = new Set(b.map((p) => p.cell));
  assert.ok(a.every((p) => reached.has(p.cell)));
  // The world itself is as it was: only its peopling differs.
  assert.equal(homePlanet(low).generated.digest, homePlanet(plain).generated.digest);
});

test("a kind age leaves more in the bands, a hard one fewer; the lands they reached the same", () => {
  const world = (t: string) => makePopulationWorld(seedFromText(t), { start: "spread" }),
    plain = world("first light"),
    kind = world("first light ~peopling kind"),
    hard = world("first light ~peopling hard"),
    lands = (w: ReturnType<typeof world>) => populationContext(w).provinces.all().length;
  assert.equal(lands(kind), lands(plain));
  assert.equal(lands(hard), lands(plain));
  assert.ok(total(kind) > total(plain) * 1.4, `${total(kind)} kind, ${total(plain)} as it was`);
  assert.ok(total(hard) < total(plain) * 0.7, `${total(hard)} hard`);
});

test("bidden to rise elsewhere: the people rise on the land the hand chose, where they could live", () => {
  const plain = generateHomeWorld(seedFromText("first light"), PRIORS.earthlike!, 32),
    was = plain.life.people!.cell;
  // A green land far from the cradle; and a hot desert, where none could rise.
  let green = -1,
    desert = -1;
  for (let c = 0; c < plain.grid.count; c++) {
    if (plain.tectonics.elevation[c]! <= 0 || c === was) continue;
    const b = plain.climate.biome[c]!;
    if (green < 0 && (b === 9 || b === 12 || b === 13)) green = c;
    if (desert < 0 && b === 11) desert = c;
  }
  assert.ok(green >= 0, "a green land to bid them to");
  const bidden = generateHomeWorld(
    seedFromText(`first light ~cradle ${green}`),
    PRIORS.earthlike!,
    32,
  );
  assert.equal(bidden.life.people!.cell, green);
  assert.notEqual(bidden.digest, plain.digest, "a world whose people rose elsewhere is told apart");
  if (desert >= 0) {
    const dry = generateHomeWorld(
      seedFromText(`first light ~cradle ${desert}`),
      PRIORS.earthlike!,
      32,
    );
    assert.equal(
      dry.life.people!.cell,
      was,
      "no people rise on the hot desert: they rise where they would",
    );
  }
});
