// F1 (the first-principles plan): arms read by what they do. The first 121 principles keep their ids,
// indexes and needs as they stood at base, so what a rocky land with fire can come to know is what it was:
// the new expansions open only the kinds' rows and the water's, which such a land never knows.
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

/** The first 121 principles at base, before F1: id, needs as written, body as it stood (printed from the base code). */
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
  ["pottery-wheel", ["cultivation"], { fire: true }],
  ["granaries", ["pottery-wheel|pitch-ware|ice-ware"]],
  ["salting", ["cultivation"]],
  ["brewing", ["pottery-wheel|pitch-ware|ice-ware"]],
  ["loom", ["cultivation"]],
  ["dyeing", ["loom"]],
  ["tanning", [], { media: ["land", "shore"] }],
  ["bronze", ["metalworking"], { fire: true }],
  ["iron", ["bronze"], { fire: true }],
  ["steel", ["iron", "mathematics"], { fire: true }],
  ["carpentry", ["bronze|carbide-blades|ice-working"]],
  ["glass", ["pottery-wheel", "metalworking"], { fire: true }],
  ["wheel", ["pottery-wheel|pitch-ware|ice-ware", "draught"], { media: ["land", "shore"] }],
  ["cart", ["wheel"], { media: ["land", "shore"] }],
  ["riding", ["draught"], { media: ["land", "shore"] }],
  ["sailing", [], { media: ["land", "shore"] }],
  ["shipbuilding", ["sailing", "carpentry"], { media: ["land", "shore"] }],
  ["roads", ["masonry", "currency"], { media: ["land", "shore"] }],
  ["bridges", ["masonry", "carpentry"], { media: ["land", "shore"] }],
  ["currency", ["writing", "metalworking|ice-working"]],
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
  ["masonry", ["bronze|carbide-blades|ice-working"]],
  ["arches", ["masonry", "mathematics"]],
  ["aqueducts", ["arches"], { media: ["land", "shore"] }],
  ["fortification", ["masonry"]],
  [
    "chariots",
    ["wheel", "riding", "bronze|carbide-blades|ice-working"],
    { media: ["land", "shore"] },
  ],
  ["standing-army", ["bureaucracy", "bronze|carbide-blades|ice-working"]],
  ["siege-craft", ["masonry", "wheel"]],
  ["cavalry", ["riding", "iron|carbide-blades|ice-working"], { media: ["land", "shore"] }],
  ["coal-mining", ["iron"], { fire: true, media: ["land", "shore"] }],
  ["clockwork", ["mathematics", "iron|carbide-blades|ice-working"]],
  ["steam-engine", ["coal-mining", "steel", "clockwork"], { fire: true }],
  ["factories", ["steam-engine", "banking"], { fire: true }],
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
  ["electricity", ["factories", "philosophy"], { fire: true }],
  ["oil-drilling", ["steam-engine"], { fire: true }],
  ["engines", ["oil-drilling", "factories"], { fire: true }],
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
  ["gunpowder", ["medicine", "iron"], { fire: true, media: ["land", "shore"] }],
  ["firearms", ["gunpowder", "clockwork"], { fire: true, media: ["land", "shore"] }],
  ["rifling", ["firearms", "factories"], { fire: true, media: ["land", "shore"] }],
  ["repeating-fire", ["rifling"], { fire: true, media: ["land", "shore"] }],
  ["self-loading", ["repeating-fire", "electricity"], { fire: true, media: ["land", "shore"] }],
  ["automatic-fire", ["self-loading"], { fire: true, media: ["land", "shore"] }],
  ["armoured-vehicles", ["automatic-fire", "engines"], { fire: true, media: ["land", "shore"] }],
  ["diamond-grit", [], { kinds: ["carbon"] }],
  ["pitch-ware", ["cultivation"], { kinds: ["carbon"] }],
  ["cold-hammering", ["cultivation"], { kinds: ["carbon"] }],
  ["carbide-blades", ["cold-hammering", "diamond-grit"], { kinds: ["carbon"] }],
  ["sun-engines", ["mills", "carbide-blades", "mathematics"], { kinds: ["carbon"] }],
  ["graphite-dynamos", ["sun-engines", "philosophy"], { kinds: ["carbon"] }],
  ["made-oxygen", ["graphite-dynamos", "mathematics"], { kinds: ["carbon"] }],
  ["acid-leaching", ["cultivation"], { kinds: ["sulfur"] }],
  ["sulfur-concrete", ["masonry"], { fire: true, kinds: ["sulfur"] }],
  ["ice-ware", ["cultivation"], { kinds: ["ammonia", "methane"] }],
  ["ice-working", ["cultivation"], { kinds: ["ammonia", "methane"] }],
  ["heat-engines", ["mills", "ice-working", "star-iron", "mathematics"], { kinds: ["ammonia"] }],
  ["ground-dynamos", ["heat-engines", "star-iron", "philosophy"], { kinds: ["ammonia"] }],
  ["cold-chemistry", ["mills", "ice-working", "star-iron", "mathematics"], { kinds: ["methane"] }],
  ["polymer-wire", ["cold-chemistry", "philosophy"], { kinds: ["methane"] }],
  ["star-iron", ["ice-working"], { kinds: ["ammonia", "methane"] }],
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

/** Whether a rocky land with fire can open a principle at all, by its body and its world. */
const openHere = (p: Principle) => affordsPrinciple(p, "land", true, "rocky");

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

test("the first 121 principles keep their ids and indexes; the arms come after them", () => {
  assert.equal(FROZEN.length, 121);
  FROZEN.forEach(([id], i) => {
    assert.equal(PRINCIPLES[i]?.id, id, `index ${i}`);
    assert.equal(PRINCIPLE_INDEX.get(id), i, id);
  });
  assert.deepEqual(
    PRINCIPLES.slice(121).map((p) => p.id),
    ["set-edges", "bound-plates", "gas-darts", "sound-lances"],
  );
});

test("the functions expand to the lists the rows wrote, and no need is left a function", () => {
  assert.equal(FUNCTIONS["@works"]!.join("|"), principle("stations").needs[1]);
  assert.equal(FUNCTIONS["@current"]!.join("|"), principle("electronics").needs[0]);
  assert.equal(principle("rifling").needs[1], principle("stations").needs[1]);
  assert.equal(principle("self-loading").needs[1], principle("electronics").needs[0]);
  assert.equal(principle("gunpowder").needs[1], FUNCTIONS["@tough-stuff"]!.join("|"));
  assert.equal(principle("clockwork").needs[1], FUNCTIONS["@tough-stuff"]!.join("|"));
  for (const p of PRINCIPLES) for (const n of p.needs) assert.ok(!n.includes("@"), `${p.id}: ${n}`);
});

test("on a rocky land with fire, each of the first 121 is open, and its needs met, as at base", () => {
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

test("what a rocky land with fire can come to know is what it was at base", () => {
  const base = FROZEN.map(([id, needs, body]) => ({
    id,
    needs,
    open: openHere({ ...principle(id), needs, body }),
  }));
  const now = PRINCIPLES.map((p) => ({ id: p.id, needs: p.needs, open: openHere(p) }));
  const frozen = new Set(FROZEN.map(([id]) => id));
  const was = knownFrom(base),
    is = knownFrom(now);
  assert.ok(was.has("electricity") && was.has("gunpowder"), "the base reaches the powder");
  assert.deepEqual([...is].filter((id) => frozen.has(id)).sort(), [...was].sort());
  assert.deepEqual(
    [...is].filter((id) => !frozen.has(id)),
    [],
  );
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

test("the powder rows ask a gas made fast, not a fire in the body; the armoured car keeps fire", () => {
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
  assert.equal(affordsPrinciple(principle("gunpowder"), "land", false, "rocky"), true);
  assert.deepEqual(principle("armoured-vehicles").body, { fire: true, media: ["land", "shore"] });
  assert.equal(principle("armoured-vehicles").asks, undefined);
});

test("the means rows: edges and plates ask for their edge; the water's darts need water", () => {
  assert.deepEqual(principle("set-edges").asks, ["edge-without-metal"]);
  assert.deepEqual(principle("bound-plates").asks, ["edge-without-metal"]);
  assert.deepEqual(principle("gas-darts").asks, ["make-gas-fast"]);
  assert.equal(affordsPrinciple(principle("gas-darts"), "water", false, "rocky"), true);
  assert.equal(affordsPrinciple(principle("gas-darts"), "land", true, "rocky"), false);
  assert.equal(affordsPrinciple(principle("sound-lances"), "land", true, "carbon"), false);
});
