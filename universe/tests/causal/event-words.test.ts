import { test } from "node:test";
import assert from "node:assert/strict";
import { eventTypes, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { cellRef } from "../../src/gen/index.ts";
import { eventHasWords, why } from "../../src/causal/index.ts";
import { eventWords } from "../../src/ui/words.ts";

// An event type with no words is told as its raw kind, place and moment: the Years read "Lore.material-found at
// cell:0:3802 (t=9113904000)" at first light's years 282 and 288, and thirty kinds stood so (eleven of them in a world's
// first 1,500 years, some 1,900 events and 350 lines of the Years). Every kind the rules declare is said in words; the
// toy sandbox's three are said by the page's own vocabulary (ui/words.ts), which reads the raw form on purpose.

const RAW = /[a-z][a-z0-9]*(\.[a-z0-9-]+)+( at \S+)? \(t=\d+\)/i;

test("no event type in the registry lacks words", () => {
  const all = eventTypes().map((t) => t.type),
    none = all.filter((t) => !eventHasWords(t));
  assert.ok(all.length > 400, `${all.length} event types declared`);
  assert.deepEqual(none, ["toy.blessing", "toy.exodus", "toy.flood"]);
  for (const t of none) assert.notEqual(eventWords(t), t, `${t} has no words on the toy's page`);
});

test("the kinds given words say what happened, and still do with their facts forgotten", () => {
  const world = EARTH.build(seedFromText("first light")),
    place = cellRef(0, 12) as Ref,
    kinds: Record<string, unknown> = {
      "lore.material-found": { way: "crucible-steel", heat: 1500 },
      "lore.material-learned": { way: "porcelain", heat: 1300, from: 40 },
      "ecology.ground-fouled": { acid: 3, metal: 20 },
      "ecology.ground-salted": { salt: 400 },
      "ecology.topsoil-washed": { top: 59 },
      "ecology.water-drawn-down": { water: 49 },
      "life.crop-tamed": { crop: "brindled water grass", years: 841 },
      "life.crop-carried": { crop: "dun bearded grass", had: "roots and fruit", from: 40 },
      "life.pests-came": { crop: "dun bearded grass", from: 40, share: 120 },
      "life.beast-carried": { beast: "grey aurochs", had: null, from: 40 },
      "life.parasites-heavy": { toll: 14, head: 9000 },
      "life.diet-poor": { short: 12, grain: 80 },
      "planet.eruption": { natural: true, vei: 6, kind: "arc", dead: 2829, lands: 7 },
      "planet.veil": { kelvin: 0.57, vei: 7 },
      "planet.ice-gone": { km2: 120000 },
      "planet.ice-come": { km2: 90000 },
      "planet.seas-moved": { metres: -3, fromIce: -2.4, swell: -0.6 },
      "planet.sea-ice": { left: 74, gone: true, overturn: 93 },
      "frontier.shield-thinned": { left: 50, hard: 5.8, fields: 91, years: 20 },
      "planet.land-drowned": { share: 14, metres: 6 },
      "planet.land-bared": { share: 11, metres: 4 },
      "planet.overturn-weakened": { overturn: 48, weak: true },
      "planet.world-dying": { now: 100, made: 400 },
      "star.swelling": { through: 100.2, risen: 12 },
      "star.ended": { how: "supernova", distance: 7.4, spectral: "B2" },
      "farlife.star-ended": { name: "Quill", how: "white dwarf", year: 900 },
      "act.realm-ways": { way: "valour", sign: 1 },
      "act.nature": { trait: "boldness", sign: -1, year: 3 },
      "act.loose": null,
    };
  for (const [type, data] of Object.entries(kinds))
    for (const facts of [data, null]) {
      const id = world.events.emit({ type, place, causes: [], data: facts }),
        claim = why(world, id).claim;
      assert.doesNotMatch(claim, RAW, claim);
      assert.doesNotMatch(claim, /undefined|null|NaN|\[object|cell:\d/, claim);
      assert.match(claim, /^[A-Z].*, year \d+$/, claim);
    }
  const made = world.events.emit({
    type: "lore.material-found",
    place,
    causes: [],
    data: kinds["lore.material-found"],
  });
  assert.match(why(world, made).claim, /crafters came upon the making of crucible steel, year/);
});
