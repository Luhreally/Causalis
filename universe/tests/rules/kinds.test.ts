// Phase 56: the kinds of world. A dial makes the kind it says; a seed falls as one by keyed draws of
// its own, as often as its star makes likely; a world kept rocky stays rocky. Warmth is read through
// a kind's liquid and back. Each kind's tables name what exists, and nothing a kind does breaks
// physics: its reactions balance, its substances are of real elements, and where nothing burns no
// principle that wants fire can be known.
import { test } from "node:test";
import assert from "node:assert/strict";
import { seedActs } from "../../src/kernel/index.ts";
import {
  ELEMENTS,
  KINDS,
  KIND_AGES,
  KIND_AIR,
  KIND_GASES,
  KIND_ENGINES,
  KIND_METALS,
  KIND_METAL_ROOTS,
  KIND_ODDS,
  KIND_ORES,
  KIND_PIGMENTS,
  KIND_PRINCIPLE_NAMES,
  KIND_REACTIONS,
  KIND_REACTION_IDS,
  KIND_ROCKS,
  KIND_SOILS,
  KIND_STONES,
  KIND_SUBSTANCES,
  MAKINGS,
  MAKING_WORDS,
  NOVEL_KINDS,
  OPEN,
  PRINCIPLES,
  WORLD_KINDS,
  affordsPrinciple,
  carbonRatio,
  earthDegrees,
  findReaction,
  findSubstance,
  imbalance,
  kelvinPerDegree,
  keptRocky,
  kindAllows,
  kindBiomeName,
  kindBurns,
  kindLives,
  liquidDegrees,
  madePrior,
  trueCelsius,
  worldKind,
  type KindInputs,
  type WorldKind,
} from "../../src/rules/index.ts";

const sun = (text: string): KindInputs => ({ text, mass: 1, ageGyr: 4.6 });
const ids = new Set(PRINCIPLES.map((p) => p.id));
const byId = (id: string) => PRINCIPLES.find((p) => p.id === id)!;

test("each dial makes the kind it says, over any seed; a made input outranks a drawn one", () => {
  for (const name of ["violet hollow", "alien 20", "amber 412", "x"]) {
    assert.equal(worldKind(sun(`${name} ~carbon carbon`)), "carbon", name);
    assert.equal(worldKind(sun(`${name} ~volatiles sulfur`)), "sulfur", name);
    assert.equal(worldKind(sun(`${name} ~volatiles ammonia`)), "ammonia", name);
    assert.equal(worldKind(sun(`${name} ~volatiles methane`)), "methane", name);
    assert.equal(worldKind(sun(`${name} ~carbon oxygen ~volatiles water`)), "rocky", name);
    // The cold liquid lies over all; a carbon disk over sulfur.
    assert.equal(worldKind(sun(`${name} ~carbon carbon ~volatiles methane`)), "methane");
    assert.equal(worldKind(sun(`${name} ~carbon carbon ~volatiles sulfur`)), "carbon");
  }
  // A red dwarf's tides make sulfur likelier, but a dial of water and oxygen keeps it rocky.
  assert.equal(
    worldKind({ text: "x ~carbon oxygen ~volatiles water", mass: 0.3, ageGyr: 0.2 }),
    "rocky",
  );
});

test("the carbon and the ices are makings with dials, and leave the prior's ranges as they are", () => {
  assert.deepEqual(Object.keys(MAKINGS.carbon), ["oxygen", "carbon"]);
  assert.deepEqual(Object.keys(MAKINGS.volatiles), ["water", "sulfur", "ammonia", "methane"]);
  for (const v of ["water", "sulfur", "ammonia", "methane"] as const) {
    const kind: WorldKind = v === "water" ? "rocky" : v;
    assert.deepEqual(MAKINGS.volatiles[v], [KINDS[kind].liquid.freezeK, KINDS[kind].liquid.boilK]);
    assert.ok(MAKING_WORDS.volatiles.choices[v], v);
  }
  assert.ok(MAKING_WORDS.carbon.choices.carbon && MAKING_WORDS.carbon.choices.oxygen);
  // The prior they make is the open prior's, ranges for ranges (its draws are the same).
  assert.deepEqual(madePrior(OPEN, "x ~carbon carbon ~volatiles methane"), OPEN);
  for (let u = -1; u < 1; u += 0.25) {
    const r = carbonRatio(u);
    assert.ok(r >= MAKINGS.carbon.carbon[0] && r <= MAKINGS.carbon.carbon[1], `${r}`);
  }
});

test("a seed's kind is its own keyed draws: the same each time, whatever came before", () => {
  const names = Array.from({ length: 300 }, (_, i) => `alien ${i}`),
    first = names.map((n) => worldKind(sun(n)));
  assert.deepEqual(
    [...names].reverse().map((n) => worldKind(sun(n))),
    [...first].reverse(),
  );
  // The acts a seed carries besides do not move its draws.
  for (const n of names.slice(0, 60))
    assert.equal(worldKind(sun(`${n} ~age 3 cool`)), worldKind(sun(n)), n);
  assert.ok(first.includes("rocky") && first.some((k) => k !== "rocky"));
});

test("how often each kind falls is as its star makes likely", () => {
  const share = (inputs: (i: number) => KindInputs, n = 4000) => {
    const out: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const k = worldKind(inputs(i));
      out[k] = (out[k] ?? 0) + 1 / n;
    }
    return out;
  };
  const near = (a: number | undefined, b: number, what: string) =>
    assert.ok(Math.abs((a ?? 0) - b) < 0.018, `${what}: ${(a ?? 0).toFixed(3)} against ${b}`);
  // A Sun-like star at 4.6 billion years: its carbon disk is rare (a C/O of 0.55).
  const sunny = share((i) => sun(`odds ${i}`)),
    disk = KIND_ODDS.carbon * ((0.55 + 0.8 * (0.3 - 0.065 * 4.6) - 0.5) / 0.3);
  near(sunny.methane, KIND_ODDS.methane, "methane");
  near(sunny.ammonia, KIND_ODDS.ammonia, "ammonia");
  near(sunny.carbon, disk * (1 - KIND_ODDS.methane - KIND_ODDS.ammonia), "carbon");
  near(sunny.sulfur, KIND_ODDS.sulfur * (1 - disk), "sulfur");
  // A near red dwarf's tides keep rock molten: sulfur worlds are many.
  const red = share((i) => ({ text: `odds ${i}`, mass: 0.35, ageGyr: 4.6 }));
  assert.ok((red.sulfur ?? 0) > 0.24, `red dwarf sulfur ${red.sulfur}`);
  // A young star's metals are high (its carbon with them), and its worlds' rock still molten.
  const young = share((i) => ({ text: `odds ${i}`, mass: 1, ageGyr: 0.5 }));
  assert.ok((young.carbon ?? 0) > 0.13, `young carbon ${young.carbon}`);
  assert.ok((young.sulfur ?? 0) > 0.08, `young sulfur ${young.sulfur}`);
  assert.ok((sunny.rocky ?? 0) > 0.79, `a Sun-like star's worlds are mostly rocky: ${sunny.rocky}`);
});

test("a seed kept rocky stays rocky, keeps its acts, and is kept once", () => {
  for (const text of [
    "alien 20",
    "alien 21 ~age 3 cool",
    "x ~volatiles water",
    "y ~carbon oxygen",
  ]) {
    const kept = keptRocky(text);
    assert.equal(keptRocky(kept), kept, text);
    assert.equal(worldKind(sun(kept)), "rocky", text);
    for (const a of seedActs(text)) assert.ok(seedActs(kept).includes(a), `${text} keeps ${a}`);
  }
  assert.equal(keptRocky("y ~carbon oxygen ~volatiles water"), "y ~carbon oxygen ~volatiles water");
});

test("warmth read through a kind's liquid and back; a world of water's band reads as Earth's", () => {
  for (const kind of WORLD_KINDS) {
    const l = KINDS[kind].liquid;
    assert.equal(earthDegrees(kind), kind === "rocky" || kind === "carbon" || kind === "sulfur");
    assert.ok(Math.abs(trueCelsius(kind, 0) - (l.freezeK - 273.15)) < 1e-9, kind);
    assert.ok(Math.abs(trueCelsius(kind, 100) - (l.boilK - 273.15)) < 1e-9, kind);
    for (const d of [-40, 0, 15, 37.5, 100])
      assert.ok(Math.abs(liquidDegrees(kind, trueCelsius(kind, d)) - d) < 1e-9, `${kind} ${d}`);
    assert.ok(Math.abs(kelvinPerDegree(kind) - (l.boilK - l.freezeK) / 100) < 1e-9, kind);
  }
  // Titan's −179 °C is about a third of the way up methane's band.
  assert.ok(Math.abs(liquidDegrees("methane", -179) - 11.86) < 0.01);
  assert.equal(trueCelsius("rocky", 15), 15);
});

test("a kind's seas are its liquid's; its land's names are Earth's", () => {
  assert.equal(kindBiomeName("methane", "ocean"), "methane sea");
  assert.equal(kindBiomeName("methane", "deep ocean"), "deep methane sea");
  assert.equal(kindBiomeName("carbon", "shallow sea"), "shallow oil sea");
  assert.equal(kindBiomeName("ammonia", "sea ice"), "frozen ammonia sea");
  assert.equal(kindBiomeName("sulfur", "tundra"), "tundra");
  for (const name of ["ocean", "deep ocean", "sea ice", "desert"])
    assert.equal(kindBiomeName("rocky", name), name);
});

test("where nothing burns, no principle that wants fire can be known, by any body", () => {
  assert.deepEqual(
    WORLD_KINDS.filter((k) => kindBurns(k)),
    ["rocky", "sulfur"],
  );
  for (const kind of WORLD_KINDS) {
    const fire = kindBurns(kind);
    for (const p of PRINCIPLES)
      if (p.body?.fire && !fire)
        assert.equal(affordsPrinciple(p, "land", fire, kind), false, `${p.id} on ${kind}`);
  }
  // A kind's own engines and metal roots want no fire where nothing burns.
  for (const id of [...KIND_ENGINES, ...KIND_METAL_ROOTS]) {
    const p = byId(id);
    for (const kind of p.body!.kinds!)
      assert.ok(kindBurns(kind) || !p.body!.fire, `${id} wants fire on ${kind}`);
  }
});

test("the kinds' principles come after Earth's, open only on their kinds, and need what exists", () => {
  const own = PRINCIPLES.filter((p) => p.body?.kinds),
    first = PRINCIPLES.indexOf(own[0]!);
  assert.equal(own.length, 16);
  assert.ok(
    PRINCIPLES.slice(first).every((p) => p.body?.kinds),
    "appended after the rest",
  );
  for (const p of PRINCIPLES) {
    for (const n of p.needs) for (const x of n.split("|")) assert.ok(ids.has(x), `${p.id}: ${x}`);
    assert.equal(kindAllows(p, "rocky"), !p.body?.kinds, p.id);
  }
  for (const p of own) {
    for (const kind of p.body!.kinds!)
      assert.ok((NOVEL_KINDS as readonly string[]).includes(kind), p.id);
    // Each of its needs can be met on one of its kinds: its own, or Earth's.
    for (const n of p.needs)
      assert.ok(
        n.split("|").some((x) => p.body!.kinds!.some((k) => kindAllows(byId(x), k))),
        `${p.id}: ${n}`,
      );
  }
  for (const id of [...KIND_ENGINES, ...KIND_METAL_ROOTS]) assert.ok(byId(id)?.body?.kinds, id);
});

test("where nothing burns, current is carried by what the world has: copper, star iron, a polymer", () => {
  // (A dynamo wants a conductor and a magnet: a carbon world's native copper, beaten cold before its
  // engines; an ammonia world's iron fallen from the sky; a methane world's wires of polyacetylene
  // about magnets of that iron, too brittle in its cold to hammer, whose nickel, broken to grit, is
  // also what its engines join acetylene and hydrogen on.)
  assert.ok(byId("graphite-dynamos").needs.includes("sun-engines"));
  assert.ok(byId("sun-engines").needs.includes("carbide-blades"));
  assert.ok(byId("carbide-blades").needs.includes("cold-hammering"));
  assert.ok(byId("ground-dynamos").needs.includes("star-iron"));
  assert.ok(byId("heat-engines").needs.includes("star-iron"), "an engine's heart of star iron");
  assert.deepEqual(byId("star-iron").body?.kinds, ["ammonia", "methane"]);
  assert.ok(byId("cold-chemistry").needs.includes("star-iron"), "the nickel acetylene joins on");
  assert.ok(KIND_METALS["star iron"].tough >= KIND_METALS["cold copper"].tough);
  assert.ok(KIND_METALS["brittle star iron"].tough < KIND_METALS["star iron"].tough / 2);
  for (const kind of NOVEL_KINDS.filter((k) => !kindBurns(k)))
    assert.ok(KIND_AGES[kind].modern.next.length > 0, kind);
});

test("each kind's ages are brought by its own principles, and their names name principles", () => {
  for (const kind of NOVEL_KINDS) {
    for (const era of ["metal", "industry", "modern"] as const)
      for (const id of KIND_AGES[kind][era].by) {
        assert.ok(ids.has(id), `${kind} ${era}: ${id}`);
        assert.ok(kindAllows(byId(id), kind), `${id} is open on ${kind}`);
        assert.ok(kindBurns(kind) || !byId(id).body?.fire, `${id} wants no fire on ${kind}`);
      }
    for (const id of Object.keys(KIND_PRINCIPLE_NAMES[kind])) assert.ok(ids.has(id), id);
  }
  // A world where nothing burns climbs to every age by a road of its own.
  for (const kind of NOVEL_KINDS.filter((k) => !kindBurns(k)))
    for (const era of ["metal", "industry", "modern"] as const)
      assert.ok(KIND_AGES[kind][era].by.length > 0, `${kind} ${era}`);
});

test("a kind's substances are of real elements, and its reactions balance atom for atom", () => {
  const symbols = new Set(ELEMENTS.map((e) => e.symbol));
  for (const s of KIND_SUBSTANCES) {
    for (const e of Object.keys(s.formula)) assert.ok(symbols.has(e), `${s.id}: ${e}`);
    assert.equal(findSubstance(s.id), s);
    assert.ok(s.words.endsWith(".") && !s.words.slice(0, -1).includes(". "), s.id);
  }
  for (const r of KIND_REACTIONS) {
    assert.ok(imbalance(r) < 1e-9, `${r.id} is out by ${imbalance(r)}`);
    assert.equal(findReaction(r.id), r);
    if (r.principle) assert.ok(ids.has(r.principle), `${r.id}: ${r.principle}`);
    for (const [id] of [...r.inputs, ...r.outputs]) assert.ok(findSubstance(id), `${r.id}: ${id}`);
    assert.ok(r.words.endsWith(".") && !r.words.slice(0, -1).includes(". "), r.id);
  }
  // What burns on a world where nothing does: no reaction there is fuelled.
  for (const kind of NOVEL_KINDS) {
    for (const id of KIND_REACTION_IDS[kind]) {
      const r = findReaction(id);
      assert.ok(r, `${kind}: ${id}`);
      if (!kindBurns(kind)) assert.equal(r.fuel, null, `${id} burns nothing on ${kind}`);
    }
    for (const id of KIND_AIR[kind]) assert.ok(findSubstance(id), `${kind} air: ${id}`);
    // (Its own gases a share of its air, its nitrogen the rest.)
    const gases = KIND_GASES[kind];
    for (const [id, v] of gases) assert.ok(findSubstance(id) && v > 0, `${kind} gas: ${id}`);
    assert.ok(gases.reduce((s, [, v]) => s + v, 0) < 0.2, kind);
  }
});

test("a kind's ground is of substances that exist, its shares whole", () => {
  const whole = (parts: readonly (readonly [string, number])[], what: string) => {
    for (const [id] of parts) assert.ok(findSubstance(id), `${what}: ${id}`);
    assert.ok(Math.abs(parts.reduce((s, [, x]) => s + x, 0) - 1) < 1e-9, what);
  };
  for (const kind of NOVEL_KINDS) {
    for (const [rock, form] of Object.entries(KIND_ROCKS[kind]))
      whole(form.parts, `${kind} ${rock}`);
    const soils = KIND_SOILS[kind];
    for (const [where, soil] of Object.entries(soils))
      if (soil) whole(soil.parts, `${kind} ${where}`);
    for (const [rock, s] of Object.entries(KIND_STONES[kind])) {
      if (s.subst) assert.ok(findSubstance(s.subst), `${kind} ${rock}: ${s.subst}`);
      assert.ok(s.keen > 0 && s.keen <= 1 && s.tough > 0 && s.tough <= 1, `${kind} ${rock}`);
    }
    for (const p of Object.values(KIND_PIGMENTS[kind])) assert.ok(p.name, kind);
  }
  // A carbon world's ores are worked cold or ground, never smelted with fire.
  for (const lies of Object.values(KIND_ORES.carbon))
    for (const ore of Object.values(lies)) {
      assert.ok(ore?.worked, `${ore?.name} says how it is worked`);
      assert.ok(findReaction(ore!.smelt), ore!.smelt);
      assert.equal(findReaction(ore!.smelt)!.fuel, null, ore!.smelt);
    }
});

test("life takes hold in a kind's liquid as often as its odds; always on a rocky world", () => {
  const n = 3000;
  for (const kind of WORLD_KINDS) {
    let lives = 0;
    for (let i = 0; i < n; i++) lives += kindLives(`life ${i}`, kind) ? 1 : 0;
    const want = KINDS[kind].life.odds;
    assert.ok(Math.abs(lives / n - want) < 0.03, `${kind}: ${lives / n} against ${want}`);
  }
  assert.equal(kindLives("anything", "rocky"), true);
  for (const kind of WORLD_KINDS) assert.ok(KINDS[kind].life.barren && KINDS[kind].fire, kind);
});
