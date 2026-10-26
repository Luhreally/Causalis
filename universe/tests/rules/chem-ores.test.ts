// The ores of a world's chemistry, by role (Phase 54, A3): the Sun's own tables exactly, and nothing
// new on Earth; the heats the novel lies want, and what each furnace reaches on thin, solar and rich
// air; no world stalls for want of a metal, over all 54 class combinations; a world's reactions are
// Earth's and the novel ones its ores, alloy and fallback use; and the metals, alloys and minerals a
// hardener makes.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AIR_OFFSET,
  ARSENICAL_GRADE,
  ARSENICAL_ORE,
  FURNACES,
  NOVEL_METALS,
  TELLURIC_GRADE,
  alloyOf,
  arsenicalFallback,
  canWork,
  depositMineralsOn,
  depositProcessOn,
  furnaceOf,
  heatOf,
  metalOf,
  oreGradeOn,
  oresOn,
  reactionsOn,
  reductionHeat,
  roleWord,
  worldOre,
  type MetalRole,
  type WorldMetal,
} from "../../src/rules/chem-ores.ts";
import {
  METALS,
  NOVEL_REACTIONS,
  ORES,
  REACTIONS,
  SOLAR,
  chemistryKey,
  classesOf,
  findReaction,
  findSubstance,
  hardenerOf,
  type AirClass,
  type CarbonClass,
  type Chemistry,
  type MetalsClass,
  type Ore,
  type OreLie,
  type Redox,
  type SilicaClass,
} from "../../src/rules/index.ts";

const CARBONS: readonly CarbonClass[] = ["oxide", "carbon-rich"];
const METAL_CLASSES: readonly MetalsClass[] = ["poor", "solar", "rich"];
const SILICAS: readonly SilicaClass[] = ["high", "solar", "low"];
const AIRS: readonly AirClass[] = ["thin", "solar", "rich"];

/**
 * A non-solar chemistry in these classes: the Sun's own spread out (solar false), its classes as
 * named, and its redox and hardener as classesOf gives them.
 */
function chemOf(
  carbon: CarbonClass,
  metals: MetalsClass,
  silica: SilicaClass,
  air: AirClass,
): Chemistry {
  const redox: Redox = air === "thin" || carbon === "carbon-rich" ? "reduced" : "oxidised";
  return {
    ...SOLAR,
    carbon,
    metals,
    silica,
    air,
    redox,
    hardener: hardenerOf(silica, metals),
    solar: false,
  };
}

/** All 54 class combinations, as chemistries. */
const ALL: Chemistry[] = [];
for (const carbon of CARBONS)
  for (const metals of METAL_CLASSES)
    for (const silica of SILICAS)
      for (const air of AIRS) ALL.push(chemOf(carbon, metals, silica, air));

/** A world's ore by kind and lie; the test fails if the world has none. */
function oreAt(chem: Chemistry, kind: string, lie: string): Ore {
  const ore = worldOre(chem, kind, lie);
  assert.ok(ore, `${chemistryKey(chem)}: no ${kind} ${lie}`);
  return ore;
}

/** Earth's ore under a kind and lie. */
const EARTH = (kind: string, lie: string): Ore => oreAt(SOLAR, kind, lie);

/** Every lie a world has of one kind. */
function liesOf(chem: Chemistry, kind: string): Ore[] {
  const role: Partial<Record<OreLie, Ore>> = oresOn(chem)[kind] ?? {};
  return Object.values(role).filter((o): o is Ore => o !== undefined);
}

/** A reaction's heat (°C); Infinity if the reaction is unknown, so a bound on it fails. */
const heatOfReaction = (id: string): number => findReaction(id)?.heat ?? Infinity;

test("the Sun's own tables are Earth's: its ores and reactions are ORES and REACTIONS, by identity", () => {
  assert.equal(oresOn(SOLAR), ORES);
  assert.equal(reactionsOn(SOLAR), REACTIONS);
  assert.equal(worldOre(SOLAR, "copper", "surface"), ORES.copper?.surface);
  assert.equal(worldOre(SOLAR, "iron", "telluric"), undefined);
});

test("the Sun's own metals are METALS, by their own names; nothing new appears on Earth", () => {
  for (const role of ["copper", "bronze", "iron", "steel", "bog iron"] as const) {
    const m = metalOf(SOLAR, role);
    assert.equal(m.name, role);
    assert.equal(m.stuff, METALS[role]);
  }
  assert.equal(metalOf(SOLAR, "iron", { lie: "bog" }).name, "bog iron");
  // A lie or an alloy that would make a novel metal stays Earth's on the Sun's chemistry.
  assert.equal(metalOf(SOLAR, "bronze", { arsenical: true }).name, "bronze");
  assert.equal(metalOf(SOLAR, "iron", { lie: "telluric" }).name, "iron");
});

test("the Sun's own alloy, and its role words, are Earth's", () => {
  const TIN = {
    reaction: "alloy-bronze",
    words: "a tenth of tin melted into the copper",
    with: "a tenth of tin",
    from: "copper and tin",
    of: "copper with a tenth of tin, melted together",
  };
  assert.deepEqual(alloyOf(SOLAR), TIN);
  assert.deepEqual(alloyOf(SOLAR, true), TIN);
  assert.equal(roleWord(SOLAR, "tin"), "tin");
  assert.equal(roleWord(SOLAR, "copper"), "copper");
});

test("the Sun's own minerals, grades and processes are null: as Earth's", () => {
  for (const kind of ["copper", "tin", "iron"]) {
    assert.equal(depositMineralsOn(SOLAR, kind), null);
    assert.equal(oreGradeOn(SOLAR, kind), null);
    assert.equal(depositProcessOn(SOLAR, kind), null);
  }
  assert.equal(arsenicalFallback(SOLAR), false);
});

test("the novel lies' heats: each ore's smelt wants the heat the spec gives it", () => {
  const reduced = chemOf("oxide", "solar", "solar", "thin"),
    arsenic = chemOf("oxide", "poor", "solar", "solar"),
    nickel = chemOf("oxide", "solar", "low", "solar"),
    carbon = chemOf("carbon-rich", "solar", "solar", "solar");
  assert.equal(reductionHeat(oreAt(reduced, "copper", "surface")), 1085); // native copper
  assert.equal(reductionHeat(oreAt(reduced, "copper", "deposit")), 1150); // chalcocite
  assert.equal(reductionHeat(oreAt(nickel, "tin", "deposit")), 1250); // garnierite
  assert.equal(reductionHeat(oreAt(arsenic, "tin", "deposit")), 700); // arsenopyrite
  assert.equal(reductionHeat(ARSENICAL_ORE), 1100); // tennantite
  assert.equal(reductionHeat(oreAt(reduced, "iron", "bog")), 1150); // siderite
  assert.equal(reductionHeat(oreAt(reduced, "iron", "telluric")), 1000); // native iron
  assert.equal(reductionHeat(oreAt(carbon, "iron", "deposit")), 1250); // carbide
});

test("the Earth heats: malachite 1100, chalcopyrite 1200, cassiterite 1000, hematite 1200, limonite 1150", () => {
  assert.equal(reductionHeat(EARTH("copper", "surface")), 1100); // malachite
  assert.equal(reductionHeat(EARTH("copper", "deposit")), 1200); // chalcopyrite
  assert.equal(reductionHeat(EARTH("tin", "deposit")), 1000); // cassiterite
  assert.equal(reductionHeat(EARTH("iron", "deposit")), 1200); // hematite
  assert.equal(reductionHeat(EARTH("iron", "bog")), 1150); // limonite
});

test("heatOf on thin air: 740, 1140, 1190, 1440; rich air adds 60 to the Sun's own heat", () => {
  const thin = chemOf("oxide", "solar", "solar", "thin"),
    solar = chemOf("oxide", "solar", "solar", "solar"),
    rich = chemOf("oxide", "solar", "solar", "rich");
  // [known, bringing, thin air's heat, the same furnace on the Sun's air]
  const cases: readonly [(p: string) => boolean, string | undefined, number, number][] = [
    [() => false, undefined, 740, 800],
    [() => false, "metalworking", 1140, 1200],
    [(p) => p === "iron", undefined, 1190, 1250],
    [(p) => p === "steel", undefined, 1440, 1500],
  ];
  for (const [known, bringing, thinHeat, solarHeat] of cases) {
    assert.equal(heatOf(thin, known, bringing), thinHeat);
    assert.equal(heatOf(solar, known, bringing), solarHeat);
    assert.equal(heatOf(rich, known, bringing), solarHeat + 60);
  }
});

test("the furnaces, the air's offset, and the furnace a people can run", () => {
  assert.deepEqual(
    FURNACES.map((f) => [f.id, f.name, f.heat, f.by]),
    [
      ["fire", "an open fire", 800, null],
      ["kiln", "a kiln-furnace", 1200, "metalworking"],
      ["bloomery", "a bloomery", 1250, "iron"],
      ["blast", "a blast furnace", 1500, "steel"],
      ["arc", "an arc furnace", 3000, "electricity"],
    ],
  );
  assert.deepEqual({ ...AIR_OFFSET }, { thin: -60, solar: 0, rich: 60 });
  assert.equal(ARSENICAL_GRADE, 0.5);
  assert.equal(TELLURIC_GRADE, 0.5);
  assert.equal(furnaceOf(SOLAR, () => false).id, "fire");
  assert.equal(furnaceOf(SOLAR, () => false, "metalworking").id, "kiln");
  assert.equal(
    heatOf(SOLAR, () => false, "iron"),
    1250,
  );
});

test("no world stalls: over all 54 classes, copper, tin and iron each have a lie their furnace works", () => {
  assert.equal(new Set(ALL.map((c) => chemistryKey(c))).size, 54);
  for (const chem of ALL) {
    const key = chemistryKey(chem),
      kiln = heatOf(chem, () => false, "metalworking"),
      bloomery = heatOf(chem, () => false, "iron");
    assert.ok(
      liesOf(chem, "copper").some((o) => canWork(kiln, o)),
      `${key}: no copper lie at the kiln`,
    );
    assert.ok(
      arsenicalFallback(chem) || liesOf(chem, "tin").some((o) => canWork(kiln, o)),
      `${key}: no tin lie at the kiln, and no arsenical fallback`,
    );
    assert.ok(
      liesOf(chem, "iron").some((o) => canWork(bloomery, o)),
      `${key}: no iron lie at the bloomery`,
    );
  }
});

test("the invariants: siderite wants no more than the thin bloomery, native copper no more than the thin kiln", () => {
  assert.ok(heatOfReaction("smelt-siderite") <= 1250 + AIR_OFFSET.thin);
  assert.ok(heatOfReaction("melt-native-copper") <= 1200 + AIR_OFFSET.thin);
});

test("copper: reduced worlds' deposit and surface change; the vent and an oxidised world's copper are Earth's", () => {
  const reduced = chemOf("oxide", "solar", "solar", "thin"),
    oxidised = chemOf("oxide", "solar", "solar", "solar");
  assert.deepEqual(oreAt(reduced, "copper", "deposit"), {
    mineral: "chalcocite",
    name: "copper glance",
    words: "sooty black copper glance of the deep veins, never rusted green",
    smelt: "smelt-chalcocite",
    grade: 1,
  });
  assert.deepEqual(oreAt(reduced, "copper", "surface"), {
    mineral: "native-copper",
    name: "native copper",
    words: "native copper lying free where old mountains are worn open, unrusted under its air",
    smelt: "melt-native-copper",
    grade: 1,
  });
  assert.equal(oreAt(reduced, "copper", "vent"), EARTH("copper", "vent"));
  for (const lie of ["deposit", "surface", "vent"] as const)
    assert.equal(oreAt(oxidised, "copper", lie), EARTH("copper", lie));
});

test("tin: the arsenic and nickel hardeners lie as the spec gives them; Earth's tin is Earth's", () => {
  const arsenic = chemOf("oxide", "poor", "solar", "solar"),
    nickel = chemOf("oxide", "solar", "low", "solar"),
    tin = chemOf("oxide", "solar", "solar", "solar");
  assert.deepEqual(oreAt(arsenic, "tin", "deposit"), {
    mineral: "arsenopyrite",
    name: "mispickel",
    words: "silver-white mispickel in the veins of old granites",
    smelt: "roast-arsenopyrite",
    grade: 1,
  });
  assert.deepEqual(oreAt(arsenic, "tin", "surface"), {
    mineral: "arsenopyrite",
    name: "arsenic stone",
    words: "silver-white arsenic ore weathered out of the granite's veins",
    smelt: "roast-arsenopyrite",
    grade: 1,
  });
  assert.deepEqual(oreAt(nickel, "tin", "deposit"), {
    mineral: "garnierite",
    name: "nickel ore",
    words: "green nickel ore of the serpentine slivers along an old suture",
    smelt: "smelt-garnierite",
    grade: 1,
  });
  assert.deepEqual(oreAt(nickel, "tin", "surface"), {
    mineral: "garnierite",
    name: "garnierite",
    words: "green garnierite weathered out of serpentine",
    smelt: "smelt-garnierite",
    grade: 1,
  });
  assert.equal(oreAt(tin, "tin", "deposit"), EARTH("tin", "deposit"));
  assert.equal(oreAt(tin, "tin", "surface"), EARTH("tin", "surface"));
  assert.equal(worldOre(nickel, "tin", "vent"), undefined);
});

test("iron: reduced worlds' black ore and native iron; carbon-rich ones smelt with carbide; oxidised is Earth's", () => {
  const reduced = chemOf("oxide", "solar", "solar", "thin"),
    carbon = chemOf("carbon-rich", "solar", "solar", "solar"),
    oxidised = chemOf("oxide", "solar", "solar", "solar");
  assert.deepEqual(oreAt(reduced, "iron", "deposit"), {
    mineral: "magnetite",
    name: "iron ore",
    words: "the banded black ore of an ancient craton, never rusted red",
    smelt: "smelt-magnetite",
    grade: 1,
  });
  assert.deepEqual(oreAt(reduced, "iron", "bog"), {
    mineral: "siderite",
    name: "bog ore",
    words: "brown siderite settled out of the marsh water, unrusted",
    smelt: "smelt-siderite",
    grade: 0.7,
  });
  assert.deepEqual(oreAt(reduced, "iron", "hill"), {
    mineral: "magnetite",
    name: "ironstone",
    words: "black ironstone of the hills",
    smelt: "smelt-magnetite",
    grade: 0.9,
  });
  assert.deepEqual(oreAt(reduced, "iron", "telluric"), {
    mineral: "telluric-iron",
    name: "native iron",
    words: "lumps of native iron in basalt that flowed through buried coal",
    smelt: "forge-telluric",
    grade: TELLURIC_GRADE,
  });
  assert.equal(oreAt(carbon, "iron", "deposit").smelt, "carbide-bloomery");
  assert.equal(oreAt(carbon, "iron", "hill").smelt, "carbide-bloomery");
  assert.equal(oreAt(carbon, "iron", "bog").smelt, "smelt-siderite");
  assert.equal(oreAt(carbon, "iron", "telluric").smelt, "forge-telluric");
  for (const lie of ["deposit", "bog", "hill"] as const)
    assert.equal(oreAt(oxidised, "iron", lie), EARTH("iron", lie));
  assert.equal(worldOre(oxidised, "iron", "telluric"), undefined);
  assert.equal(worldOre(reduced, "copper", "bog"), undefined);
});

test("the arsenical copper ore is tennantite, roasted for the arsenic that hardens its copper", () => {
  assert.deepEqual(ARSENICAL_ORE, {
    mineral: "tennantite",
    name: "grey copper ore",
    words:
      "grey copper ore with arsenic in it, roasted for the white arsenic that hardens its copper",
    smelt: "roast-tennantite",
    grade: 1,
  });
});

test("canWork: a furnace works an ore when it reaches the ore's smelt", () => {
  const malachite = EARTH("copper", "surface"),
    chalcopyrite = EARTH("copper", "deposit");
  assert.equal(canWork(1140, malachite), true);
  assert.equal(canWork(1140, chalcopyrite), false);
  assert.equal(canWork(1200, chalcopyrite), true);
});

test("metals: a hardener and a lie name the metal; carbon-rich iron is cohenite; copper and steel are Earth's", () => {
  const tin = chemOf("oxide", "solar", "solar", "solar"),
    arsenic = chemOf("oxide", "poor", "solar", "solar"),
    nickel = chemOf("oxide", "solar", "low", "solar"),
    reduced = chemOf("oxide", "solar", "solar", "thin"),
    carbon = chemOf("carbon-rich", "solar", "solar", "solar");
  const named = (m: WorldMetal) => [m.name, m.subst];
  assert.deepEqual(named(metalOf(tin, "bronze")), ["bronze", "bronze"]);
  assert.equal(metalOf(tin, "bronze").stuff, METALS.bronze);
  assert.deepEqual(named(metalOf(arsenic, "bronze")), ["arsenical copper", "arsenical-copper"]);
  assert.equal(metalOf(arsenic, "bronze").stuff, NOVEL_METALS["arsenical copper"]);
  assert.deepEqual(named(metalOf(nickel, "bronze")), ["cupronickel", "cupronickel"]);
  assert.equal(metalOf(nickel, "bronze").stuff, NOVEL_METALS.cupronickel);
  assert.equal(metalOf(tin, "bronze", { arsenical: true }).name, "arsenical copper");
  assert.deepEqual(named(metalOf(reduced, "iron", { lie: "telluric" })), [
    "telluric iron",
    "telluric-iron",
  ]);
  assert.equal(metalOf(reduced, "iron", { lie: "telluric" }).stuff, NOVEL_METALS["telluric iron"]);
  assert.deepEqual(named(metalOf(reduced, "iron", { lie: "bog" })), ["bog iron", "iron"]);
  assert.equal(metalOf(reduced, "iron", { lie: "bog" }).stuff, METALS["bog iron"]);
  assert.equal(metalOf(reduced, "bog iron").stuff, METALS["bog iron"]);
  assert.deepEqual(named(metalOf(carbon, "iron", { lie: "deposit" })), [
    "cohenite iron",
    "cohenite-iron",
  ]);
  assert.equal(metalOf(carbon, "iron").stuff, NOVEL_METALS["cohenite iron"]);
  assert.deepEqual(named(metalOf(reduced, "iron")), ["iron", "iron"]);
  assert.equal(metalOf(reduced, "iron").stuff, METALS.iron);
  assert.equal(metalOf(nickel, "copper").stuff, METALS.copper);
  assert.equal(metalOf(arsenic, "steel").stuff, METALS.steel);
});

test("every metal a world names is a substance the world has", () => {
  const roles: readonly [MetalRole, { lie?: string | null; arsenical?: boolean }?][] = [
    ["copper"],
    ["steel"],
    ["bronze"],
    ["bronze", { arsenical: true }],
    ["iron"],
    ["iron", { lie: "bog" }],
    ["iron", { lie: "telluric" }],
    ["bog iron"],
  ];
  for (const chem of [SOLAR, ...ALL])
    for (const [role, how] of roles) {
      const m = metalOf(chem, role, how);
      assert.ok(findSubstance(m.subst), `${chemistryKey(chem)}: ${m.name} is ${m.subst}`);
    }
});

test("novel metals have exactly METALS' fields", () => {
  const fields = (m: object) => new Set(Object.keys(m));
  for (const m of Object.values(NOVEL_METALS)) assert.deepEqual(fields(m), fields(METALS.copper));
});

test("alloys: a tin world's bronze, an arsenic world's arsenical copper, a nickel world's cupronickel", () => {
  const tin = chemOf("oxide", "solar", "solar", "solar"),
    arsenic = chemOf("oxide", "poor", "solar", "solar"),
    nickel = chemOf("oxide", "solar", "low", "solar");
  assert.deepEqual(alloyOf(tin), {
    reaction: "alloy-bronze",
    words: "a tenth of tin melted into the copper",
    with: "a tenth of tin",
    from: "copper and tin",
    of: "copper with a tenth of tin, melted together",
  });
  assert.deepEqual(alloyOf(arsenic), {
    reaction: "alloy-arsenical",
    words: "white arsenic stirred into the molten copper under charcoal",
    with: "a little white arsenic",
    from: "copper and white arsenic",
    of: "copper with a twenty-fifth of arsenic, stirred in under charcoal",
  });
  assert.deepEqual(alloyOf(nickel), {
    reaction: "alloy-cupronickel",
    words: "a quarter of nickel melted into the copper",
    with: "a quarter of nickel",
    from: "copper and nickel",
    of: "copper with a quarter of nickel, melted together",
  });
  // The arsenical flag is the caller's fallback, and it holds whatever the hardener.
  assert.equal(alloyOf(nickel, true).reaction, "alloy-arsenical");
  assert.equal(alloyOf(tin, true).reaction, "alloy-arsenical");
  for (const chem of [tin, arsenic, nickel])
    assert.ok(findReaction(alloyOf(chem).reaction), alloyOf(chem).reaction);
});

test("minerals, grades and processes: where they differ from Earth's; null where they are as Earth's", () => {
  const reduced = chemOf("oxide", "solar", "solar", "thin"),
    arsenic = chemOf("oxide", "poor", "solar", "solar"),
    nickel = chemOf("oxide", "solar", "low", "solar"),
    tin = chemOf("oxide", "solar", "solar", "solar");
  assert.deepEqual(depositMineralsOn(reduced, "copper"), ["chalcocite", "native-copper"]);
  assert.deepEqual(depositMineralsOn(reduced, "iron"), ["magnetite", "siderite"]);
  assert.deepEqual(depositMineralsOn(arsenic, "tin"), ["arsenopyrite"]);
  assert.deepEqual(depositMineralsOn(nickel, "tin"), ["garnierite"]);
  assert.equal(depositMineralsOn(tin, "tin"), null);
  assert.equal(depositMineralsOn(tin, "copper"), null);
  assert.equal(depositMineralsOn(reduced, "lead"), null);
  assert.deepEqual(oreGradeOn(arsenic, "tin"), { of: "arsenic", share: 0.03 });
  assert.deepEqual(oreGradeOn(nickel, "tin"), { of: "nickel", share: 0.015 });
  assert.equal(oreGradeOn(tin, "tin"), null);
  assert.equal(oreGradeOn(arsenic, "copper"), null);
  assert.equal(depositProcessOn(nickel, "tin"), "serpentine slivers of an old suture");
  assert.equal(depositProcessOn(arsenic, "tin"), null);
  assert.equal(depositProcessOn(nickel, "copper"), null);
});

test("a world's hardener is its role word for tin; the arsenical fallback is a nickel world's", () => {
  const tin = chemOf("oxide", "solar", "solar", "solar"),
    arsenic = chemOf("oxide", "poor", "solar", "solar"),
    nickel = chemOf("oxide", "solar", "low", "solar");
  assert.equal(roleWord(nickel, "tin"), "nickel");
  assert.equal(roleWord(arsenic, "tin"), "arsenic");
  assert.equal(roleWord(tin, "tin"), "tin");
  assert.equal(roleWord(tin, "iron"), "iron");
  assert.equal(arsenicalFallback(nickel), true);
  assert.equal(arsenicalFallback(arsenic), false);
  assert.equal(arsenicalFallback(tin), false);
});

test("every smelt id in every world's ores resolves through findReaction", () => {
  for (const chem of [SOLAR, ...ALL])
    for (const role of Object.values(oresOn(chem)))
      for (const ore of Object.values(role))
        if (ore) assert.ok(findReaction(ore.smelt), `${chemistryKey(chem)}: ${ore.smelt}`);
  assert.ok(findReaction(ARSENICAL_ORE.smelt));
});

test("reactionsOn: Earth's reactions, then exactly the novel ones the world uses, in the novel order", () => {
  for (const chem of ALL) {
    const used = new Set<string>([alloyOf(chem).reaction]);
    for (const role of Object.values(oresOn(chem)))
      for (const ore of Object.values(role)) if (ore) used.add(ore.smelt);
    if (arsenicalFallback(chem)) {
      used.add(ARSENICAL_ORE.smelt);
      used.add("alloy-arsenical");
    }
    const got = reactionsOn(chem);
    assert.ok(
      got.slice(0, REACTIONS.length).every((r, i) => r === REACTIONS[i]),
      `${chemistryKey(chem)}: Earth's reactions come first`,
    );
    assert.deepEqual(
      got.slice(REACTIONS.length),
      NOVEL_REACTIONS.filter((r) => used.has(r.id)),
      chemistryKey(chem),
    );
  }
});

test("named worlds' novel reactions: Earth-classed none; reduced, carbon-rich, nickel and arsenic each their own", () => {
  const ids = (chem: Chemistry) =>
    reactionsOn(chem)
      .slice(REACTIONS.length)
      .map((r) => r.id);
  assert.deepEqual(ids(chemOf("oxide", "solar", "solar", "solar")), []);
  assert.deepEqual(ids(chemOf("oxide", "solar", "solar", "thin")), [
    "melt-native-copper",
    "smelt-chalcocite",
    "smelt-siderite",
    "forge-telluric",
  ]);
  assert.deepEqual(ids(chemOf("carbon-rich", "solar", "solar", "solar")), [
    "melt-native-copper",
    "smelt-chalcocite",
    "smelt-siderite",
    "forge-telluric",
    "carbide-bloomery",
  ]);
  assert.deepEqual(ids(chemOf("oxide", "solar", "low", "solar")), [
    "smelt-garnierite",
    "alloy-cupronickel",
    "alloy-arsenical",
    "roast-tennantite",
  ]);
  assert.deepEqual(ids(chemOf("oxide", "poor", "solar", "solar")), [
    "roast-arsenopyrite",
    "alloy-arsenical",
  ]);
  assert.equal(reactionsOn(SOLAR), REACTIONS);
});

test("tables are memoised by class: the same class gives the same object", () => {
  assert.equal(
    oresOn(chemOf("oxide", "solar", "solar", "thin")),
    oresOn(chemOf("oxide", "solar", "solar", "thin")),
  );
  assert.equal(
    reactionsOn(chemOf("oxide", "solar", "solar", "thin")),
    reactionsOn(chemOf("oxide", "solar", "solar", "thin")),
  );
  assert.notEqual(
    oresOn(chemOf("oxide", "solar", "solar", "thin")),
    oresOn(chemOf("oxide", "solar", "solar", "rich")),
  );
});

test("the test's chemistries carry the classes, redox and hardener that classesOf gives them", () => {
  const CARBON_CO: Record<CarbonClass, number> = { oxide: 0.55, "carbon-rich": 0.9 },
    METAL_FEH: Record<MetalsClass, number> = { poor: -0.5, solar: 0, rich: 0.5 },
    SILICA_MGSI: Record<SilicaClass, number> = { high: 0.5, solar: 1.05, low: 1.5 },
    AIR_O2: Record<AirClass, number> = { thin: 0.1, solar: 0.2095, rich: 0.3 };
  for (const carbon of CARBONS)
    for (const metals of METAL_CLASSES)
      for (const silica of SILICAS)
        for (const air of AIRS) {
          const chem = chemOf(carbon, metals, silica, air),
            want = classesOf({
              feH: METAL_FEH[metals],
              cO: CARBON_CO[carbon],
              mgSi: SILICA_MGSI[silica],
              o2: AIR_O2[air],
            });
          assert.deepEqual(
            [chem.carbon, chem.metals, chem.silica, chem.air, chem.redox, chem.hardener],
            [want.carbon, want.metals, want.silica, want.air, want.redox, want.hardener],
          );
        }
});
