// F1 "arms on every world", T2 (rules/designs.ts): a means-material is composed only with the figures its world
// gives it; Earth's hosts keep their numbers; a body that cannot grip bears a means-material strapped to a limb.
// The two frozen tables were printed from the code before T2: every host realization alone on each of its Earth
// materials, and the hosts composed on Earth's materials for four doctrines, five bodies and two knowledges.
import { test } from "node:test";
import assert from "node:assert/strict";
import { affordancesOf, type BodyPlan } from "../../src/rules/bodies.ts";
import { firearm, firepowerOf, rangeAxisOf } from "../../src/rules/firearms.ts";
import {
  HOST_ROLES,
  MATERIAL,
  MEANS_MATERIALS,
  REALIZATIONS,
  compose,
  hostPower,
  performanceOf,
  realization,
  strapped,
  type Doctrine,
  type Material,
  type Part,
  type PartHere,
} from "../../src/rules/designs.ts";

const hands: BodyPlan = {
  clade: "apes",
  name: "upright apes",
  medium: "land",
  symmetry: "bilateral",
  size: 60,
  manipulators: "hands",
  limbs: 2,
  senses: ["sight"],
  skin: "skin",
  warm: true,
  diet: "both",
  bearing: "live",
  young: 1,
  span: 70,
  social: 0.4,
};
const claws: BodyPlan = {
  clade: "crabs",
  name: "claw-folk",
  medium: "land",
  symmetry: "bilateral",
  size: 40,
  manipulators: "claws",
  limbs: 2,
  senses: ["sight"],
  skin: "scales",
  warm: false,
  diet: "flesh",
  bearing: "eggs",
  young: 30,
  span: 40,
  social: 0.2,
};
const sea: BodyPlan = {
  clade: "fish",
  name: "sea-folk",
  medium: "water",
  symmetry: "bilateral",
  size: 30,
  manipulators: "tentacles",
  limbs: 8,
  senses: ["sight"],
  skin: "skin",
  warm: false,
  diet: "flesh",
  bearing: "spawn",
  young: 200,
  span: 30,
  social: 0.2,
};
const jaws: BodyPlan = {
  clade: "ants",
  name: "jaw-folk",
  medium: "land",
  symmetry: "bilateral",
  size: 5,
  manipulators: "mandibles",
  limbs: 2,
  senses: ["sight"],
  skin: "shell",
  warm: false,
  diet: "both",
  bearing: "eggs",
  young: 200,
  span: 20,
  social: 0.95,
};
const giant: BodyPlan = {
  clade: "elephants",
  name: "giants",
  medium: "land",
  symmetry: "bilateral",
  size: 4000,
  manipulators: "trunk",
  limbs: 4,
  senses: ["smell"],
  skin: "skin",
  warm: true,
  diet: "plants",
  bearing: "live",
  young: 1,
  span: 60,
  social: 0.5,
};
const BODIES: Record<string, BodyPlan> = { hands, claws, jaws, sea, giant };

const DOCTRINES: Record<string, Doctrine> = {
  fight: { shock: 1, reach: 0.5, cost: 0.3 },
  guard: { protection: 1, mobility: 0.4, cost: 0.2 },
  range: { range: 1, firepower: 0.6, shock: 0.2 },
  mixed: {
    shock: 0.5,
    range: 0.5,
    protection: 0.5,
    mobility: 0.5,
    firepower: 0.5,
    breach: 0.5,
    cost: 0.1,
  },
};

const GUNS = new Set(["firearms", "rifling", "repeating-fire", "self-loading", "automatic-fire"]);
const MODERN = new Set([
  "electricity",
  "steel",
  "steam-engine",
  "factories",
  "engines",
  "nuclear-drive",
  "fusion-power",
  "habitats",
  "beam-arms",
  "machine-soldiers",
  "armoured-vehicles",
]);
const KNOW: Record<string, (id: string) => boolean> = {
  all: () => true,
  ancient: (id) => !GUNS.has(id) && !MODERN.has(id),
};
const noGuns = (id: string) => !GUNS.has(id);
const earth = (m: Material) => !MEANS_MATERIALS.has(m);

/** hostPower of each host realization alone, on each of its Earth materials (printed before T2). */
const EARTH_SINGLE: readonly (readonly [string, number])[] = [
  ["club/wood", 0.9],
  ["spear/stone", 1.0399999999999998],
  ["spear/copper", 1.075],
  ["spear/bronze", 1.1449999999999998],
  ["spear/iron", 1.18],
  ["spear/steel", 1.2499999999999998],
  ["axe/copper", 1.2],
  ["axe/bronze", 1.2999999999999998],
  ["axe/iron", 1.3499999999999999],
  ["axe/steel", 1.45],
  ["sword/bronze", 1.42],
  ["sword/iron", 1.48],
  ["sword/steel", 1.5999999999999999],
  ["bow/wood", 1.1099999999999999],
  ["horn-bow/hide", 1.2799999999999998],
  ["musket/iron", 1.8699999999999999],
  ["musket/steel", 1.9099999999999997],
  ["rifle/steel", 2.2399999999999998],
  ["repeater/machined", 2.7550927932152898],
  ["autoloader/machined", 2.946390674438907],
  ["automatic/machined", 3.280567260620456],
  ["claws/body", 1.15],
  ["mandibles/body", 1.15],
  ["tusks/body", 1.2999999999999998],
  ["grapple/body", 1.0499999999999998],
  ["shell-darts/shell", 1.02],
  ["own-shell/body", 1.14],
  ["own-scales/body", 0.9149999999999999],
  ["shell-plates/shell", 1.005],
  ["swimming/body", 0.8999999999999999],
  ["bare/hide", 0.6],
  ["shield/hide", 0.78],
  ["shield/reed", 0.717],
  ["shield/wood", 0.735],
  ["leather/hide", 0.87],
  ["scale/bronze", 0.9600000000000001],
  ["scale/iron", 1.0139999999999998],
  ["mail/iron", 1.104],
  ["mail/steel", 1.2119999999999997],
  ["plate/steel", 1.315],
  ["helmet/steel", 1.23],
  ["foot/hide", 0.7],
  ["chariot/wood", 1.025],
  ["horse/hide", 1.0550000000000002],
  ["cavalry/hide", 1.2000000000000002],
  ["armoured/machined", 1.9715735902799727],
  ["beam-rifle/crystal", 3.4659246349014246],
  ["beam-lance/crystal", 2.5585285972072027],
  ["driven-plate/crystal", 1.64],
  ["machine-host/crystal", 2.2281453659370776],
];

/** hostPower of the host composed on Earth's materials, by doctrine/body/knowledge (printed before T2). */
const EARTH_HOSTS: readonly (readonly [string, number])[] = [
  ["fight/hands/all/earth", 3.8681453659370773],
  ["fight/hands/ancient/earth", 2.2],
  ["fight/claws/all/earth", 3.093145365937078],
  ["fight/claws/ancient/earth", 2.065],
  ["fight/jaws/all/earth", 3.418145365937077],
  ["fight/jaws/ancient/earth", 2.3899999999999997],
  ["fight/sea/all/earth", 3.8681453659370773],
  ["fight/sea/ancient/earth", 2.2],
  ["fight/giant/all/earth", 3.8681453659370773],
  ["fight/giant/ancient/earth", 1.7],
  ["guard/hands/all/earth", 3.3115735902799726],
  ["guard/hands/ancient/earth", 2.112],
  ["guard/claws/all/earth", 3.5615735902799726],
  ["guard/claws/ancient/earth", 2.362],
  ["guard/jaws/all/earth", 3.5615735902799726],
  ["guard/jaws/ancient/earth", 2.29],
  ["guard/sea/all/earth", 3.7181453659370782],
  ["guard/sea/ancient/earth", 2.2620000000000005],
  ["guard/giant/all/earth", 3.711573590279973],
  ["guard/giant/ancient/earth", 2.012],
  ["range/hands/all/earth", 4.72551462808554],
  ["range/hands/ancient/earth", 1.8800000000000001],
  ["range/claws/all/earth", 3.2231453659370777],
  ["range/claws/ancient/earth", 2.1950000000000003],
  ["range/jaws/all/earth", 3.4481453659370773],
  ["range/jaws/ancient/earth", 2.42],
  ["range/sea/all/earth", 4.9595045800483994],
  ["range/sea/ancient/earth", 2.285],
  ["range/giant/all/earth", 4.72551462808554],
  ["range/giant/ancient/earth", 1.38],
  ["mixed/hands/all/earth", 5.7655146280855405],
  ["mixed/hands/ancient/earth", 2.492],
  ["mixed/claws/all/earth", 3.9481453659370778],
  ["mixed/claws/ancient/earth", 2.492],
  ["mixed/jaws/all/earth", 3.9481453659370778],
  ["mixed/jaws/ancient/earth", 2.42],
  ["mixed/sea/all/earth", 5.594504580048399],
  ["mixed/sea/ancient/earth", 2.492],
  ["mixed/giant/all/earth", 5.7655146280855405],
  ["mixed/giant/ancient/earth", 1.992],
];

test("the frozen table covers every host realization on every Earth material", () => {
  const pairs = REALIZATIONS.filter((r) =>
    (HOST_ROLES as readonly string[]).includes(r.role),
  ).flatMap((r) => r.materials.filter(earth).map((m) => `${r.id}/${m}`));
  assert.deepEqual(
    EARTH_SINGLE.map(([key]) => key),
    pairs,
  );
});

test("Earth's hosts keep their hostPower: each realization alone, and each host composed on Earth's materials", () => {
  for (const [key, power] of EARTH_SINGLE) {
    const [id, m] = key.split("/") as [string, Material];
    assert.equal(hostPower([{ role: realization(id).role, id, material: m }]), power, key);
  }
  for (const [key, power] of EARTH_HOSTS) {
    const [d, b, k] = key.split("/") as [string, string, string];
    assert.equal(
      hostPower(compose(HOST_ROLES, KNOW[k]!, earth, DOCTRINES[d]!, BODIES[b]!)),
      power,
      key,
    );
  }
});

test("a means-material is never composed without a world's figures", () => {
  for (const b of Object.values(BODIES))
    for (const d of Object.values(DOCTRINES)) {
      const parts = compose(
        HOST_ROLES,
        () => true,
        () => true,
        d,
        b,
      );
      assert.ok(
        parts.every((p) => !MEANS_MATERIALS.has(p.material) && !("here" in p)),
        JSON.stringify(parts),
      );
    }
});

test("the rows T2 touched keep their Earth does and words, and every row's does is the same with or without its material's props", () => {
  for (const r of REALIZATIONS)
    for (const m of r.materials)
      if (earth(m)) assert.deepEqual(r.does(m), r.does(m, MATERIAL[m]), `${r.id}/${m}`);
  const { iron, steel, bronze } = MATERIAL;
  const gun = (id: string, cost: number) => ({
    shock: 0.95,
    reach: 0.45,
    range: rangeAxisOf(firearm(id)!),
    firepower: firepowerOf(firearm(id)!),
    cost,
  });
  assert.deepEqual(realization("musket").does("iron"), {
    shock: 0.6 + 0.2 * iron.edge,
    reach: 0.45,
    range: 0.85,
    cost: 0.25 + 0.2 * iron.cost,
  });
  assert.deepEqual(realization("musket").does("steel"), {
    shock: 0.6 + 0.2 * steel.edge,
    reach: 0.45,
    range: 0.85,
    cost: 0.25 + 0.2 * steel.cost,
  });
  assert.deepEqual(realization("rifle").does("steel"), {
    shock: 0.95,
    reach: 0.45,
    range: 1.15,
    cost: 0.4,
  });
  assert.deepEqual(realization("repeater").does("machined"), gun("repeater", 0.5));
  assert.deepEqual(realization("autoloader").does("machined"), gun("autoloader", 0.6));
  assert.deepEqual(realization("automatic").does("machined"), gun("automatic", 0.8));
  assert.deepEqual(realization("sword").does("bronze"), {
    shock: 0.4 + 0.6 * bronze.edge,
    reach: 0.35,
    cost: 0.2 + 0.4 * bronze.cost,
  });
  assert.deepEqual(realization("scale").does("iron"), {
    protection: 0.1 + 0.6 * iron.guard,
    cost: 0.2 + 0.3 * iron.cost,
  });
  assert.deepEqual(realization("helmet").does("steel"), { protection: 0.7, cost: 0.35 });
  assert.equal(realization("sword").words("bronze"), "bronze swords");
  assert.equal(realization("musket").words("steel"), "muskets");
  assert.equal(realization("rifle").words("steel"), "rifles");
  assert.equal(realization("repeater").words("machined"), "repeating rifles");
  assert.equal(realization("autoloader").words("machined"), "self-loading rifles");
  assert.equal(realization("automatic").words("machined"), "machine guns");
  assert.equal(realization("scale").words("bronze"), "bronze scale");
  assert.equal(realization("helmet").words("steel"), "steel helmets");
  assert.equal(realization("sword").words("set edge"), "long blades of set flakes");
  assert.equal(realization("scale").words("set edge"), "plates of set flakes");
  assert.equal(realization("musket").words("wound"), "wound-barrel muskets");
  assert.equal(realization("rifle").words("wound"), "wound-barrel rifles");
  assert.equal(realization("repeater").words("wound works"), "wound-barrel repeating rifles");
});

test("a clawed body bears a blade of set flakes strapped to its limb, and never a steel sword", () => {
  const has = (m: Material) => ["body", "set edge", "steel", "iron", "bronze", "wood"].includes(m);
  const here = (_id: string, m: Material): PartHere | null =>
    m === "set edge" ? { edge: 0.6, guard: 0.5 } : null;
  const doctrine: Doctrine = { shock: 1, reach: 1 };
  const parts = compose(HOST_ROLES, noGuns, has, doctrine, claws, undefined, [], 0, here);
  assert.deepEqual(
    parts.find((p) => p.id === "sword"),
    { role: "arm", id: "sword", material: "set edge", here: { edge: 0.6, guard: 0.5 } },
  );
  assert.ok(!parts.some((p) => p.id === "sword" && p.material !== "set edge"));
  // Without the figures a clawed people has no blade at all; a people with hands keeps its steel one.
  assert.ok(!compose(HOST_ROLES, noGuns, has, doctrine, claws).some((p) => p.id === "sword"));
  assert.equal(
    compose(HOST_ROLES, noGuns, has, doctrine, hands).find((p) => p.id === "sword")?.material,
    "steel",
  );
  // The blade's need is "bronze|set-edges": knowing set-edges alone is enough.
  assert.equal(
    compose(
      HOST_ROLES,
      (p) => p === "set-edges",
      has,
      doctrine,
      claws,
      undefined,
      [],
      0,
      here,
    ).find((p) => p.id === "sword")?.material,
    "set edge",
  );
});

test("a people of the water bears a gas dart on wound barrels, where its world gives the figures", () => {
  const has = (m: Material) => ["body", "shell", "wound"].includes(m);
  const doctrine: Doctrine = { shock: 1, range: 1 };
  const here = (id: string, m: Material): PartHere | null =>
    id === "gas-dart" && m === "wound" ? { range: 30, shock: 0.6 } : null;
  const arm = compose(HOST_ROLES, () => true, has, doctrine, sea, undefined, [], 0, here).find(
    (p) => p.role === "arm",
  );
  assert.deepEqual(arm, {
    role: "arm",
    id: "gas-dart",
    material: "wound",
    here: { range: 30, shock: 0.6 },
  });
  assert.equal(
    compose(HOST_ROLES, () => true, has, doctrine, sea).find((p) => p.role === "arm")?.id,
    "shell-darts",
  );
});

test("strapped: a limb of at least 0.4 dexterity, on land or shore", () => {
  assert.equal(affordancesOf(claws).dexterity, 0.45);
  assert.equal(strapped(claws), true);
  assert.equal(strapped(hands), true);
  assert.equal(strapped(sea), false);
  assert.equal(strapped({ ...claws, manipulators: "mandibles", limbs: 1 }), false);
});

test("a wound gun takes its range and shock from the world's figures, and Earth's when none are given", () => {
  const musket = (here?: PartHere) =>
    performanceOf([{ role: "arm", id: "musket", material: "wound", ...(here ? { here } : {}) }]);
  const none = musket(),
    earth100 = musket({ range: firearm("musket")!.range, shock: 1 }),
    thin = musket({ range: 68, shock: 0.5 });
  assert.equal(none.range, rangeAxisOf(firearm("musket")!));
  assert.deepEqual(earth100, none);
  assert.ok(Math.abs(none.shock! - 0.76) < 1e-9);
  assert.equal(thin.range, rangeAxisOf({ range: 68 }));
  assert.ok(Math.abs(thin.shock! - (0.3 + 0.46 * Math.sqrt(0.5))) < 1e-9);
  assert.ok(thin.range! < none.range! && thin.shock! < none.shock!);
});

test("a design keeps its identity by role, id and material, so a part's figures do not change it", () => {
  // design.ts compares parts with its own private `same` (sim/design/design.ts), which cannot be imported; this is that comparison.
  const same = (a: readonly Part[], b: readonly Part[]) =>
    a.length === b.length &&
    a.every((x, i) => x.id === b[i]!.id && x.material === b[i]!.material && x.role === b[i]!.role);
  const stamped: Part[] = [
    { role: "arm", id: "sword", material: "set edge", here: { edge: 0.6, guard: 0.5 } },
  ];
  assert.ok(same(stamped, [{ role: "arm", id: "sword", material: "set edge" }]));
  assert.ok(
    same(stamped, [
      { role: "arm", id: "sword", material: "set edge", here: { edge: 0.1, guard: 0 } },
    ]),
  );
  assert.ok(!same(stamped, [{ role: "arm", id: "sword", material: "steel" }]));
});
