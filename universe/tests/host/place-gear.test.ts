// Single things a town's people hold (town mode, asked 2026-11-26: "single items: material from the world's own stuffs,
// quality from the maker's skill and tools, the maker's name, and wear. They are held, used, traded and stolen"): a tool of
// their trade, a garment, their household's pot, each of what their land makes such things of, by one of the town's own or
// bought in, worn by use and made anew; kept only for those followed in full, and filled from who they are on coming into
// it, so what is read of one among the folk is what they hold once followed. One in want with a bare pantry may steal.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DAY,
  HOUR,
  loadWorld,
  saveWorld,
  type World,
} from "../../src/kernel/index.ts";
import { OCC, RECIPES } from "../../src/rules/index.ts";
import { populationContext, type Settlement } from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/index.ts";
import { townStuff } from "../../src/host/chain.ts";
import {
  GEAR,
  HAP,
  TIER,
  WRONG,
  enterPlace,
  placeDigest,
  placeGear,
  placeIndexOf,
  placePin,
  placesOf,
} from "../../src/host/place.ts";
import { placeFrame, logSheet } from "../../src/host/placeplan.ts";
import { inspectPerson } from "../../src/host/placeinspect.ts";
import { universeWorld } from "./worlds.ts";

const base = (): World => universeWorld(EARTH, "first light", 150);
const copy = (w: World): World => {
  const doc = JSON.parse(
    JSON.stringify(saveWorld(w, "r", { universe: "earth" })),
  );
  return loadWorld(doc, (s) => EARTH.build(s), "r").world;
};
const near = (w: World, people: number): Settlement => {
  const ctx = populationContext(w);
  return ctx.settlements
    .all()
    .filter((s) => ctx.settlements.held(s.ref) && s.population > 0)
    .sort(
      (a, b) =>
        Math.abs(a.population - people) - Math.abs(b.population - people) ||
        (a.ref < b.ref ? -1 : 1),
    )[0]!;
};
const go = (w: World, ref: string, hours: number) => {
  for (let h = 0; h < hours; h++) {
    w.runTo(w.now + HOUR);
    placeFrame(w, ref, []);
  }
};

test("each holds things of their land's stuff, made by one of the town or bought in; what is read of one among the folk is what they hold once followed; worn by use", () => {
  const w = copy(base()),
    ref = near(w, 600).ref;
  enterPlace(w, ref);
  go(w, ref, 3 * 24);
  const place = placesOf(w)!.get(ref)!,
    stuff = townStuff(w, place.cell, Math.floor(place.t / (365 * DAY)));
  // Those in full hold theirs (filled at a day's turn), of the land's own stuff.
  let held = 0;
  for (const [id, d] of place.deep!) {
    const i = placeIndexOf(place, id);
    if (!d.filled) continue;
    for (const x of d.items) {
      held++;
      assert.ok(
        x.q >= 5 && x.q <= 99 && x.wear >= 0 && x.wear <= 1000,
        JSON.stringify(x),
      );
      if (x.k === GEAR.pot) assert.ok(x.stuff === stuff.clay.ware, x.stuff);
      if (x.maker) {
        const m = placeIndexOf(place, x.maker);
        // (A tool by a crafter at a making of tools; a garment or a pot at home, or by one who makes them.)
        if (m >= 0 && x.k === GEAR.tool)
          assert.ok(
            (place.people.sexOcc[m]! & 15) === OCC.crafter &&
              RECIPES[place.people.craft[m]! - 1]!.output[0] !== undefined,
          );
      }
    }
    void i;
  }
  assert.ok(held > 0, "those in full hold things");
  // A farmer among the folk: what is read of them is what they hold once followed in full.
  let farmer = -1;
  for (let i = 0; i < place.people.n && farmer < 0; i++)
    if (
      (place.people.sexOcc[i]! & 15) === OCC.farmer &&
      (place.people.tier[i]! & 3) !== TIER.full
    )
      farmer = i;
  assert.ok(farmer >= 0);
  const id = place.people.id[farmer]!,
    read = placeGear(w, place, farmer).map(
      (x) => `${x.k} ${x.stuff} ${x.q} ${x.maker} ${x.made}`,
    );
  assert.ok(
    read.some((x) => x.startsWith(`${GEAR.tool} `)),
    "a farmer holds a tool",
  );
  placePin(place, id, -1);
  go(w, ref, 26);
  const j = placeIndexOf(place, id),
    kept = place.deep!.get(id)!;
  assert.ok(kept.filled, "filled at their day's turn");
  assert.deepEqual(
    kept.items.map((x) => `${x.k} ${x.stuff} ${x.q} ${x.maker} ${x.made}`),
    read,
    "the same things",
  );
  // Worn by the work of their trade: a month's.
  const tool = () => place.deep!.get(id)!.items.find((x) => x.k === GEAR.tool)!,
    was = tool();
  const wasWear = was.wear,
    wasMade = was.made;
  go(w, ref, 30 * 24);
  const now = tool();
  assert.ok(
    now.made !== wasMade || now.wear > wasWear,
    `${wasWear} → ${now.wear}`,
  );
  // The inspector's Gear tab lists each.
  const seen = inspectPerson(w, place, id)!,
    rows = seen.gear.map(([a, b]) => `${a}: ${b}`);
  assert.ok(
    rows.some(
      (x) => /^A hoe and sickle of /.test(x) && /% worn|worn out/.test(x),
    ),
    rows.join("\n"),
  );
  assert.ok(
    rows.some((x) => /garment: /.test(x)),
    rows.join("\n"),
  );
  // Kept in the save, and gone on with the same.
  const again = copy(w);
  go(w, ref, 48);
  go(again, ref, 48);
  assert.equal(placeDigest(placesOf(again)!.get(ref)!), placeDigest(place));
  void j;
});

test("one in want with a bare pantry, low of mood, steals from a household about their street, and is brought before its justice", () => {
  const w = copy(base()),
    ref = near(w, 600).ref;
  enterPlace(w, ref);
  go(w, ref, 24);
  const place = placesOf(w)!.get(ref)!,
    nf = 3;
  // (Ten households' grown made hungry and low, their pantries bare; their neighbours' full.)
  const picked: number[] = [];
  for (let i = 0; i < place.people.n && picked.length < 10; i++) {
    const h = place.people.house[i]!;
    if (
      h < 1 ||
      h + 1 >= place.houses.n ||
      (place.people.sexOcc[i]! & 15) === OCC.dependent ||
      place.people.health[i]
    )
      continue;
    if (picked.some((j) => Math.abs(place.people.house[j]! - h) < 3)) continue;
    picked.push(i);
  }
  let stole = 0;
  for (let day = 0; day < 6 && !stole; day++) {
    for (const i of picked) {
      const h = place.people.house[i]!;
      for (let k = 0; k < nf; k++) {
        place.houses.pantry[h * nf + k] = 0;
        place.houses.pantry[(h + 1) * nf + k] = Math.max(
          place.houses.pantry[(h + 1) * nf + k]!,
          50_000_000,
        );
      }
      place.people.lack[i] = 144 * 7;
      place.people.mood[i] = -45;
    }
    go(w, ref, 24);
    stole = place.log.filter((x) => x.what === HAP.stole).length;
  }
  assert.ok(stole > 0, "one stole");
  const x = place.log.find((y) => y.what === HAP.stole)!;
  assert.ok(x.b > 0, "food taken");
  const judged = place.log.filter(
    (y) => y.what === HAP.judged && y.id === x.id && y.b >> 4 === WRONG.theft,
  );
  // (The town's justice may not reach them: its law's reach. Where it did, it is told so.)
  if (judged.length)
    assert.ok(/for stealing/.test(JSON.stringify(logSheet(w, place, 4000))));
  assert.ok(
    /stole a day's food/.test(JSON.stringify(logSheet(w, place, 4000))),
  );
});
