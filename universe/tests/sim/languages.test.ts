import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { commonTongue, tongueLikeness, type Tongue } from "../../src/gen/index.ts";
import {
  APART,
  ECONOMY_EVENTS,
  LANGUAGE_EVENTS,
  cultureOf,
  homePlanet,
  languagesOf,
  loreOf,
  makePopulationWorld,
  marketsOf,
  populationContext,
  seaReach,
  seaSteps,
  warsOf,
} from "../../src/sim/index.ts";
import { PRINCIPLES } from "../../src/rules/index.ts";
import { why } from "../../src/causal/index.ts";

// First light's peoples spread over a continent and its islands; three centuries on.
const opening = makePopulationWorld(seedFromText("first light"), { start: "spread" });
const world = makePopulationWorld(seedFromText("first light"), { start: "spread" });
world.runTo(300 * YEAR);
const told = (type: string) => world.events.all().filter((e) => e.type === type);

test("the speech many lands share keeps what most of their people say", () => {
  const t = (onsets: number): Tongue => ({ onsets, vowels: 1, codas: 1, endings: 1, seed: 9 });
  // Two small lands say the second sound, one large land does not: the large land's way holds.
  const shared = commonTongue([t(0b011), t(0b011), t(0b001)], [10, 10, 30], 9);
  assert.equal(shared.onsets, 0b001);
  assert.equal(commonTongue([t(0b011), t(0b011), t(0b001)], [10, 10, 5], 9).onsets, 0b011);
  assert.equal(tongueLikeness(shared, shared), 1);
});

test("at the chronicle's opening, kin lands speak one language, and languages fall into families", () => {
  const store = languagesOf(opening),
    ctx = populationContext(opening),
    culture = cultureOf(opening),
    g = ctx.generated,
    langs = store.all(),
    families = new Set(langs.map((l) => l.family));
  assert.ok(
    langs.length >= 20 && families.size >= 5,
    `${langs.length} languages, ${families.size} families`,
  );
  // Each family begins with a daughter of the first people's speech.
  for (const f of families) assert.ok(f === 0 || store.at(f).parent === 0, `family ${f}`);
  let same = 0,
    pairs = 0;
  for (const p of ctx.provinces.all()) {
    const l = store.of(p.cell)!;
    assert.ok(tongueLikeness(culture.get(p.cell)!.tongue, l.standard) >= APART);
    for (let k = g.grid.offsets[p.cell]!; k < g.grid.offsets[p.cell + 1]!; k++) {
      const n = g.grid.neighbours[k]!;
      if (n < p.cell || !store.of(n)) continue;
      pairs++;
      if (store.of(n) === l) same++;
    }
  }
  // Neighbours speak alike far more often than lands drawn at random would: the bands'
  // speech drifted along the paths they took.
  const share = new Map<number, number>();
  for (const p of ctx.provinces.all()) {
    const i = store.of(p.cell)!.index;
    share.set(i, (share.get(i) ?? 0) + 1);
  }
  const lands = ctx.provinces.all().length,
    chance = [...share.values()].reduce((a, n) => a + (n / lands) ** 2, 0);
  assert.ok(
    same / pairs > 8 * chance,
    `${same} of ${pairs} neighbouring lands speak alike (${(100 * chance).toFixed(1)}% by chance)`,
  );
  // The languages that arose in the ages before say so.
  const before = opening.events.all().filter((e) => e.type === LANGUAGE_EVENTS.arose.type);
  assert.equal(before.length, langs.length - 1);
  assert.match(
    why(opening, before[0]!.id).claim,
    /grew apart from .* in the ages before the chronicle/,
  );
});

test("languages grow apart, are taken up and die out, and history says why", () => {
  const store = languagesOf(world);
  const arose = told(LANGUAGE_EVENTS.arose.type).filter((e) => e.t > 0);
  assert.ok(arose.length >= 3, `${arose.length} tongues arose`);
  for (const e of arose.slice(0, 5)) {
    const d = world.decisions.get(e.causes[0]!.ref as Ref)!;
    assert.equal(d.rule, "language.arise");
    assert.ok(
      d.factors.some((f) => f.source?.ref.startsWith("lang:")),
      "the tongue it grew from",
    );
    assert.match(why(world, e.id).claim, /grew apart from .* into a tongue of its own/);
  }
  // Ruled from a seat of another speech, lands take it up — the sooner with roads and writing.
  const ruled = told(LANGUAGE_EVENTS.shifted.type).filter(
    (e) => (e.data as { realm?: string }).realm,
  );
  assert.ok(ruled.length >= 5, `${ruled.length} lands took up their rulers' speech`);
  for (const e of ruled.slice(0, 5)) {
    assert.ok(
      e.causes.some((c) => c.ref.startsWith("pol:")),
      "the realm",
    );
    assert.match(why(world, e.id).claim, /took up .* the speech of the/);
  }
  const died = told(LANGUAGE_EVENTS.died.type);
  assert.ok(died.length >= 1, "some tongue died out");
  for (const e of died) {
    const l = store.get(e.subjects[0] as Ref)!;
    assert.notEqual(l.died, null);
    assert.equal(
      store
        .speakers()
        .get(l.index)
        ?.filter((c) => !!populationContext(world).provinces.get(c)?.total()).length ?? 0,
      0,
    );
  }
  // A living language's why names its family and how many speak it.
  const living = store.all().find((l) => l.died === null && l.parent !== null)!;
  assert.match(why(world, living.ref).claim, /(of the .* tongues|first of its family).* speak it/);
});

test("ships open roads across the sea, and peoples of different families meet there", () => {
  const markets = marketsOf(world),
    lore = loreOf(world),
    g = homePlanet(world).generated;
  const voyages = told(ECONOMY_EVENTS.seaRoute.type);
  assert.ok(voyages.length >= 10, `${voyages.length} sea roads`);
  for (const e of voyages.slice(0, 10)) {
    const [a, b] = e.subjects.map((s) => Number(s.split(":")[2])) as [number, number];
    assert.ok(markets.bySea(a, b), "a road across the sea");
    const steps = seaReach(g, a).find(([c]) => c === b)?.[1];
    assert.ok(steps !== undefined && steps <= seaSteps(lore, a, b), "within their ships' reach");
    const d = world.decisions.get(e.causes[0]!.ref as Ref)!;
    const ships = d.factors.find((f) => f.name === "ships to carry them");
    assert.ok(ships && world.events.get(ships.source!.ref as Ref)?.type.startsWith("lore."));
    assert.match(why(world, e.id).claim, /Ships first sailed from/);
  }
  const met = told(LANGUAGE_EVENTS.contact.type);
  assert.ok(met.length >= 1, "some families met");
  assert.match(why(world, met[0]!.id).claim, /tongues met for the first time/);
});

test("realms go to war across the sea, with ships to carry the host", () => {
  const across = warsOf(world)
    .all()
    .map((w) => world.decisions.get(world.events.get(w.event)!.causes[0]!.ref as Ref)!)
    .filter((d) => d.factors.some((f) => f.name === "ships to carry the host"));
  assert.ok(across.length >= 3, `${across.length} wars across the sea`);
  for (const d of across.slice(0, 5)) {
    const ships = d.factors.find((f) => f.name === "ships to carry the host")!;
    assert.ok(world.events.get(ships.source!.ref as Ref)?.type.startsWith("lore."));
  }
  // Paved roads, like writing and clerks, let a seat rule further.
  assert.equal(PRINCIPLES.find((p) => p.id === "roads")!.effects.reach, 1);
});
