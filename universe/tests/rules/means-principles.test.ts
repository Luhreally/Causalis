// F1 (the first-principles plan): arms read by what they do. The first 121 principles keep their ids and
// indexes; their needs and bodies are frozen as they stand after F1 and T2 (F2, F3). What a land with fire
// can come to know is what it was at base: the closures below, read on Earth's matter.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FUNCTIONS,
  PRINCIPLES,
  PRINCIPLE_INDEX,
  affordsPrinciple,
  needsMet,
  principle,
  type BodyNeeds,
  type Principle,
} from "../../src/rules/principles.ts";
import { SOLAR } from "../../src/rules/chemistry.ts";
import {
  matterShuts,
  meansWorldOf,
  readFunctions,
  type MatterWorld,
} from "../../src/rules/properties.ts";

/** The first 121 principles as they stand after F1 and T2: id, needs as expanded, body (base: git 01a282f). */
const FROZEN: readonly (readonly [id: string, needs: readonly string[], body?: BodyNeeds])[] = [
  ["cultivation", []],
  ["metalworking", []],
  ["dairying", ["cultivation"], { media: ["land", "shore"] }],
  ["draught", ["dairying"], { media: ["land", "shore"] }],
  ["irrigation", ["cultivation"], { media: ["land", "shore"] }],
  ["plough", ["cultivation", "draught"], { media: ["land", "shore"] }],
  ["calendar", ["cultivation"]],
  ["rotation", ["plough", "calendar"]],
  ["terracing", ["irrigation", "masonry"], { media: ["land", "shore"] }],
  ["manuring", ["dairying", "plough"]],
  ["heavy-plough", ["plough", "iron|carbide-blades|ice-working"]],
  ["mills", ["wheel", "masonry"], { media: ["land", "shore"] }],
  ["beekeeping", ["pottery-wheel|pitch-ware|ice-ware"]],
  ["fishing", ["sailing"], { media: ["land", "shore"] }],
  ["archery", [], { media: ["land", "shore"] }],
  ["pottery-wheel", ["cultivation"], { heat: 800 }],
  ["granaries", ["pottery-wheel|pitch-ware|ice-ware"]],
  ["salting", ["cultivation"]],
  ["brewing", ["pottery-wheel|pitch-ware|ice-ware"]],
  ["loom", ["cultivation"]],
  ["dyeing", ["loom"]],
  ["tanning", [], { media: ["land", "shore"] }],
  ["bronze", ["metalworking"], { heat: 950 }],
  ["iron", ["bronze|set-edges"], { heat: 1200 }],
  ["steel", ["iron|made-oxygen", "mathematics"], { heat: 1100 }],
  ["carpentry", ["bronze|carbide-blades|ice-working|set-edges"]],
  ["glass", ["pottery-wheel|ice-ware|pitch-ware", "metalworking|set-edges"], { heat: 1100 }],
  ["wheel", ["pottery-wheel|pitch-ware|ice-ware", "draught"], { media: ["land", "shore"] }],
  ["cart", ["wheel"], { media: ["land", "shore"] }],
  ["riding", ["draught"], { media: ["land", "shore"] }],
  ["sailing", [], { media: ["land", "shore"] }],
  ["shipbuilding", ["sailing", "carpentry"], { media: ["land", "shore"] }],
  ["roads", ["masonry", "currency"], { media: ["land", "shore"] }],
  ["bridges", ["masonry", "carpentry"], { media: ["land", "shore"] }],
  ["currency", ["writing", "metalworking|ice-working|set-edges"]],
  ["banking", ["currency", "mathematics"]],
  ["writing", ["calendar"]],
  ["mathematics", ["writing"]],
  ["astronomy", ["calendar", "writing"]],
  ["law-codes", ["writing"]],
  ["bureaucracy", ["writing", "law-codes"]],
  ["philosophy", ["writing", "astronomy"]],
  ["herbalism", []],
  ["medicine", ["herbalism", "writing"]],
  ["sanitation", ["masonry", "medicine"]],
  ["germs", ["medicine", "glass|diamond-grit|ice-working", "writing"]],
  ["vaccines", ["germs"]],
  ["quarantine", ["germs"]],
  ["masonry", ["bronze|carbide-blades|ice-working|set-edges"]],
  ["arches", ["masonry", "mathematics"]],
  ["aqueducts", ["arches"], { media: ["land", "shore"] }],
  ["fortification", ["masonry"]],
  [
    "chariots",
    ["wheel", "riding", "bronze|carbide-blades|ice-working|set-edges"],
    { media: ["land", "shore"] },
  ],
  ["standing-army", ["bureaucracy", "bronze|carbide-blades|ice-working|set-edges"]],
  ["siege-craft", ["masonry", "wheel"]],
  ["cavalry", ["riding", "iron|carbide-blades|ice-working|set-edges"], { media: ["land", "shore"] }],
  ["coal-mining", ["iron"], { burns: true, media: ["land", "shore"] }],
  ["clockwork", ["mathematics", "iron|carbide-blades|diamond-grit|ice-working|set-edges"]],
  ["steam-engine", ["coal-mining", "steel", "clockwork"], { burns: true }],
  ["factories", ["steam-engine|sun-engines|heat-engines|cold-chemistry", "banking"]],
  [
    "railways",
    ["steam-engine|sun-engines|heat-engines|cold-chemistry", "roads"],
    { media: ["land", "shore"] },
  ],
  [
    "steamships",
    ["steam-engine|sun-engines|heat-engines|cold-chemistry", "shipbuilding"],
    { media: ["land", "shore"] },
  ],
  ["electricity", ["factories", "philosophy"]],
  ["oil-drilling", ["steam-engine"], { burns: true }],
  ["engines", ["oil-drilling", "factories"], { burns: true }],
  ["vent-working", [], { media: ["water"] }],
  ["shell-craft", ["cultivation"], { media: ["water"] }],
  ["current-reading", ["calendar"], { media: ["water"] }],
  ["reef-building", ["cultivation"], { media: ["water"] }],
  ["electrochemistry", ["vent-working", "writing"], { media: ["water"] }],
  ["refined-metals", ["electrochemistry", "mathematics"], { media: ["water"] }],
  ["current-mills", ["refined-metals", "mathematics"], { media: ["water"] }],
  ["sea-works", ["current-mills", "banking"], { media: ["water"] }],
  ["vent-heat", ["sea-works"], { media: ["water"] }],
  ["sea-electricity", ["current-mills", "philosophy"], { media: ["water"] }],
  [
    "electronics",
    ["electricity|sea-electricity|graphite-dynamos|ground-dynamos|polymer-wire", "mathematics"],
  ],
  [
    "rocketry",
    ["electricity|sea-electricity|graphite-dynamos|ground-dynamos|polymer-wire", "astronomy"],
  ],
  ["guidance", ["electronics", "clockwork|current-reading"]],
  ["orbital-flight", ["rocketry", "guidance"]],
  ["life-support", ["orbital-flight", "medicine"]],
  ["stations", ["life-support", "factories|sea-works|sun-engines|heat-engines|cold-chemistry"]],
  ["transfer-flight", ["orbital-flight", "mathematics"]],
  ["habitats", ["life-support", "transfer-flight"]],
  ["nuclear-drive", ["electronics", "transfer-flight"]],
  ["fusion-drive", ["nuclear-drive", "stations"]],
  ["long-sleep", ["life-support", "medicine"]],
  ["beamed-sails", ["fusion-drive", "electronics"]],
  ["antimatter-drive", ["fusion-drive", "mathematics"]],
  [
    "gunpowder",
    ["medicine", "iron|carbide-blades|diamond-grit|ice-working|set-edges"],
    { media: ["land", "shore"] },
  ],
  ["firearms", ["gunpowder", "clockwork"], { media: ["land", "shore"] }],
  [
    "rifling",
    ["firearms", "factories|sea-works|sun-engines|heat-engines|cold-chemistry"],
    { media: ["land", "shore"] },
  ],
  ["repeating-fire", ["rifling"], { media: ["land", "shore"] }],
  [
    "self-loading",
    ["repeating-fire", "electricity|sea-electricity|graphite-dynamos|ground-dynamos|polymer-wire"],
    { media: ["land", "shore"] },
  ],
  ["automatic-fire", ["self-loading"], { media: ["land", "shore"] }],
  ["armoured-vehicles", ["automatic-fire", "engines"], { media: ["land", "shore"] }],
  ["diamond-grit", []],
  ["pitch-ware", ["cultivation"]],
  ["cold-hammering", ["cultivation"]],
  ["carbide-blades", ["cold-hammering", "diamond-grit"]],
  [
    "sun-engines",
    ["mills", "iron|carbide-blades|diamond-grit|ice-working|set-edges", "mathematics"],
  ],
  ["graphite-dynamos", ["sun-engines|heat-engines|cold-chemistry", "philosophy"]],
  [
    "made-oxygen",
    ["electricity|sea-electricity|graphite-dynamos|ground-dynamos|polymer-wire", "mathematics"],
  ],
  ["acid-leaching", ["cultivation"]],
  ["sulfur-concrete", ["masonry"], { heat: 140 }],
  ["ice-ware", ["cultivation"]],
  ["ice-working", ["cultivation"]],
  [
    "heat-engines",
    [
      "mills",
      "iron|carbide-blades|diamond-grit|ice-working|set-edges",
      "star-iron|cold-hammering|metalworking",
      "mathematics",
    ],
  ],
  ["ground-dynamos", ["heat-engines", "star-iron|cold-hammering|metalworking", "philosophy"]],
  ["cold-chemistry", ["mills", "ice-working", "star-iron", "mathematics"]],
  ["polymer-wire", ["sun-engines|heat-engines|cold-chemistry", "philosophy"]],
  ["star-iron", ["ice-working"]],
  ["fusion-power", ["fusion-drive", "electronics"]],
  ["machine-minds", ["guidance", "nuclear-drive"]],
  ["drawn-carbon", ["machine-minds"]],
  ["beam-arms", ["guidance", "nuclear-drive", "fusion-power|machine-minds"]],
  ["made-bodies", ["machine-minds", "long-sleep"]],
  ["machine-soldiers", ["machine-minds", "beam-arms"]],
  ["star-mirrors", ["machine-minds", "fusion-drive", "stations"]],
  ["vat-food", ["made-bodies", "fusion-power|star-mirrors"]],
  ["world-making", ["habitats", "machine-minds", "fusion-power|star-mirrors"]],
  ["world-city", ["vat-food", "drawn-carbon"]],
];

/** Whether a land with fire can open a principle at all, by its body (what its matter shuts is not read here). */
const openHere = (p: Principle) => affordsPrinciple(p, "land", true);

const knowing =
  (...ids: string[]) =>
  (n: string) =>
    ids.includes(n);

/** What a land can come to know: each principle open to it whose needs the rest meet, to a fixed point. */
function knownFrom(
  rows: readonly {
    readonly id: string;
    readonly needs: readonly string[];
    readonly open: boolean;
  }[],
): Set<string> {
  const known = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of rows) {
      if (r.open && !known.has(r.id) && needsMet(r, (n) => known.has(n))) {
        known.add(r.id);
        grew = true;
      }
    }
  }
  return known;
}

/** Rocky Earth (the properties test's fixture): what its matter reads, which shuts or opens a row. */
const EARTH: MatterWorld = {
  chem: SOLAR,
  kind: "rocky",
  celsius: 15,
  gravity: 1,
  rockBodies: 8,
  giants: 4,
  starLeftGyr: 5,
  peopled: true,
  means: meansWorldOf({
    chem: SOLAR,
    kind: "rocky",
    celsius: 15,
    gravity: 1,
    medium: "land",
    bodyFire: true,
    insolation: 1,
  }),
};
const EARTH_READINGS = readFunctions(EARTH);

/** What a land can come to know on Earth's matter: each row open on that medium at that reach, unshut, and its needs met. */
const onEarth = (medium: "land" | "water", reach: boolean | number) =>
  knownFrom(
    PRINCIPLES.map((p) => ({
      id: p.id,
      needs: p.needs,
      open: affordsPrinciple(p, medium, reach) && !matterShuts(p, EARTH_READINGS),
    })),
  );

/** What rocky Earth comes to with fire, at base (before F2): 95 principles. */
const EARTH_FIRE: readonly string[] = [
  "antimatter-drive",
  "aqueducts",
  "archery",
  "arches",
  "armoured-vehicles",
  "astronomy",
  "automatic-fire",
  "banking",
  "beam-arms",
  "beamed-sails",
  "beekeeping",
  "brewing",
  "bridges",
  "bronze",
  "bureaucracy",
  "calendar",
  "carpentry",
  "cart",
  "cavalry",
  "chariots",
  "clockwork",
  "coal-mining",
  "cultivation",
  "currency",
  "dairying",
  "draught",
  "drawn-carbon",
  "dyeing",
  "electricity",
  "electronics",
  "engines",
  "factories",
  "firearms",
  "fishing",
  "fortification",
  "fusion-drive",
  "fusion-power",
  "germs",
  "glass",
  "granaries",
  "guidance",
  "gunpowder",
  "habitats",
  "heavy-plough",
  "herbalism",
  "iron",
  "irrigation",
  "law-codes",
  "life-support",
  "long-sleep",
  "loom",
  "machine-minds",
  "machine-soldiers",
  "made-bodies",
  "manuring",
  "masonry",
  "mathematics",
  "medicine",
  "metalworking",
  "mills",
  "nuclear-drive",
  "oil-drilling",
  "orbital-flight",
  "philosophy",
  "plough",
  "pottery-wheel",
  "quarantine",
  "railways",
  "repeating-fire",
  "riding",
  "rifling",
  "roads",
  "rocketry",
  "rotation",
  "sailing",
  "salting",
  "sanitation",
  "self-loading",
  "shipbuilding",
  "siege-craft",
  "standing-army",
  "star-mirrors",
  "stations",
  "steam-engine",
  "steamships",
  "steel",
  "tanning",
  "terracing",
  "transfer-flight",
  "vaccines",
  "vat-food",
  "wheel",
  "world-city",
  "world-making",
  "writing",
];
/** The same for a water people with no fire, at base: 51 principles. */
const EARTH_WATER: readonly string[] = [
  "antimatter-drive",
  "astronomy",
  "banking",
  "beam-arms",
  "beamed-sails",
  "bureaucracy",
  "calendar",
  "cultivation",
  "currency",
  "current-mills",
  "current-reading",
  "drawn-carbon",
  "dyeing",
  "electrochemistry",
  "electronics",
  "fusion-drive",
  "fusion-power",
  "gas-darts",
  "guidance",
  "habitats",
  "herbalism",
  "law-codes",
  "life-support",
  "long-sleep",
  "loom",
  "machine-minds",
  "machine-soldiers",
  "made-bodies",
  "mathematics",
  "medicine",
  "metalworking",
  "nuclear-drive",
  "orbital-flight",
  "philosophy",
  "reef-building",
  "refined-metals",
  "rocketry",
  "salting",
  "sea-electricity",
  "sea-works",
  "shell-craft",
  "sound-lances",
  "star-mirrors",
  "stations",
  "transfer-flight",
  "vat-food",
  "vent-heat",
  "vent-working",
  "world-city",
  "world-making",
  "writing",
];

/** The rows that were fire: true at base, and the media each was for. */
const WAS_FIRE: readonly (readonly [id: string, media?: readonly string[]])[] = [
  ["pottery-wheel"],
  ["bronze"],
  ["iron"],
  ["steel"],
  ["glass"],
  ["coal-mining", ["land", "shore"]],
  ["steam-engine"],
  ["factories"],
  ["electricity"],
  ["oil-drilling"],
  ["engines"],
  ["armoured-vehicles", ["land", "shore"]],
  ["sulfur-concrete"],
];
/** Of those, the three that lost their fire to a need (F2): they open at reach false where their media is. */
const LOST_FIRE: readonly string[] = ["factories", "electricity", "armoured-vehicles"];

test("the first 121 principles keep their ids and indexes; the arms, then the means of heat, come after them", () => {
  assert.equal(FROZEN.length, 121);
  FROZEN.forEach(([id], i) => {
    assert.equal(PRINCIPLES[i]?.id, id, `index ${i}`);
    assert.equal(PRINCIPLE_INDEX.get(id), i, id);
  });
  assert.deepEqual(
    PRINCIPLES.slice(121).map((p) => p.id),
    [
      "set-edges",
      "bound-plates",
      "gas-darts",
      "sound-lances",
      "ground-furnace",
      "sun-furnace",
      "joined-hearth",
      "forged-star-iron",
      "wings",
      "tall-frames",
    ],
  );
});

test("the functions expand to the lists the rows wrote, and no need is left a function", () => {
  assert.equal(FUNCTIONS["@works"]!.join("|"), principle("stations").needs[1]);
  assert.equal(FUNCTIONS["@current"]!.join("|"), principle("electronics").needs[0]);
  assert.equal(principle("rifling").needs[1], principle("stations").needs[1]);
  assert.equal(principle("self-loading").needs[1], principle("electronics").needs[0]);
  assert.equal(principle("factories").needs[0], FUNCTIONS["@engine"]!.join("|"));
  assert.equal(principle("sun-furnace").needs[1], FUNCTIONS["@polished"]!.join("|"));
  assert.equal(principle("gunpowder").needs[1], FUNCTIONS["@tough-stuff"]!.join("|"));
  assert.equal(principle("clockwork").needs[1], FUNCTIONS["@tough-stuff"]!.join("|"));
  for (const p of PRINCIPLES) for (const n of p.needs) assert.ok(!n.includes("@"), `${p.id}: ${n}`);
});

test("on a land with fire, each of the first 121 is open, and its needs met, as the frozen list has them", () => {
  // Knowledge sets: none, every principle such a land can open, and 300 seeded halves and thirds of those.
  const every = PRINCIPLES.filter(openHere).map((p) => p.id);
  const sets = [new Set<string>(), new Set(every)];
  let seed = 7;
  const coin = (p: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32 < p;
  };
  for (let k = 0; k < 300; k++) sets.push(new Set(every.filter(() => coin(k % 2 ? 1 / 3 : 1 / 2))));
  for (const [id, needs, body] of FROZEN) {
    const now = principle(id),
      then: Principle = { ...now, needs, body };
    assert.equal(openHere(now), openHere(then), id);
    for (const s of sets) {
      assert.equal(
        needsMet(now, (n) => s.has(n)),
        needsMet({ needs }, (n) => s.has(n)),
        id,
      );
    }
  }
});

test("on rocky Earth, a land with fire comes to know the same 95 principles it did at base", () => {
  const is = onEarth("land", true);
  assert.deepEqual([...is].sort(), EARTH_FIRE);
  assert.ok(is.has("electricity") && is.has("gunpowder"), "the base reaches the powder");
});

test("on Earth's matter with no fire, a water people comes to know the same 51 it did at base", () => {
  assert.deepEqual([...onEarth("water", false)].sort(), EARTH_WATER);
});

test("the rows that were fire open at reach true as at base; at reach false only the three that lost their fire", () => {
  for (const [id, media] of WAS_FIRE) {
    for (const m of ["land", "shore", "water"] as const) {
      const onMedium = !media || media.includes(m);
      assert.equal(
        affordsPrinciple(principle(id), m, true),
        onMedium,
        id + " on " + m + " at reach true",
      );
      assert.equal(
        affordsPrinciple(principle(id), m, false),
        LOST_FIRE.includes(id) && onMedium,
        id + " on " + m + " at reach false",
      );
    }
  }
  // A heat opens where the land reaches it: pots at 800 °C; a bronze at 950 °C, or 900 °C where its wants say so.
  assert.equal(affordsPrinciple(principle("pottery-wheel"), "land", 799), false);
  assert.equal(affordsPrinciple(principle("pottery-wheel"), "land", 800), true);
  assert.equal(affordsPrinciple(principle("bronze"), "land", 900), false);
  assert.equal(affordsPrinciple(principle("bronze"), "land", 900, { bronze: 900 }), true);
});

test("the expansions open the kinds' roads that the old rows left shut", () => {
  assert.equal(needsMet(principle("clockwork"), knowing("mathematics")), false);
  assert.equal(needsMet(principle("clockwork"), knowing("mathematics", "diamond-grit")), true);
  assert.equal(needsMet(principle("gunpowder"), knowing("medicine", "carbide-blades")), true);
  assert.equal(needsMet(principle("rifling"), knowing("firearms", "sun-engines")), true);
  assert.equal(
    needsMet(principle("self-loading"), knowing("repeating-fire", "polymer-wire")),
    true,
  );
});

test("the powder rows ask a gas made fast, not a fire in the body; the armoured car asks no fire", () => {
  for (const id of [
    "gunpowder",
    "firearms",
    "rifling",
    "repeating-fire",
    "self-loading",
    "automatic-fire",
  ]) {
    assert.deepEqual(principle(id).body, { media: ["land", "shore"] }, id);
    assert.deepEqual(principle(id).asks, ["make-gas-fast"], id);
  }
  assert.equal(affordsPrinciple(principle("gunpowder"), "land", false), true);
  assert.deepEqual(principle("armoured-vehicles").body, { media: ["land", "shore"] });
  assert.equal(principle("armoured-vehicles").asks, undefined);
});

test("the means rows: edges and plates ask for their edge; the water's darts need water", () => {
  assert.deepEqual(principle("set-edges").asks, ["edge-without-metal"]);
  assert.deepEqual(principle("bound-plates").asks, ["edge-without-metal"]);
  assert.deepEqual(principle("gas-darts").asks, ["make-gas-fast"]);
  assert.equal(affordsPrinciple(principle("gas-darts"), "water", false), true);
  assert.equal(affordsPrinciple(principle("gas-darts"), "land", true), false);
  assert.equal(affordsPrinciple(principle("sound-lances"), "land", true), false);
});
