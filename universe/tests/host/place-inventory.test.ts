// What one holds, by what it is made of (town mode, R3): each thing in its slot with its wear, working, failing or worn
// out; and all they hold and carry by the stuff it is, its weight the world's own unit of its good and its parts. Read only.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUR } from "../../src/kernel/index.ts";
import { GOOD_MATTER, GOODS, findSubstance } from "../../src/rules/index.ts";
import { GEAR, advancePlace, enterPlace, placeDigest, placeGear } from "../../src/host/place.ts";
import { placeInspect } from "../../src/host/placeinspect.ts";
import { placePersonRef, type PlaceInspectPerson } from "../../src/bridge/index.ts";
import { noTown, placeWorld, townWhere } from "./worlds.ts";

const UNIT: Readonly<Record<number, number>> = {
  [GEAR.tool]: GOOD_MATTER.tools!.unitKg,
  [GEAR.garment]: GOOD_MATTER.clothing!.unitKg,
  [GEAR.pot]: GOOD_MATTER.pottery!.unitKg,
};

test("what one holds: each thing in its slot with its wear, and all of it by its stuff with its weight", (t) => {
  const w = placeWorld(150),
    s = townWhere(w, () => true, { near: 3000, least: 800 }) ?? noTown(t, "of eight hundred");
  if (!s) return;
  const town: string = s.ref,
    place = enterPlace(w, town)!;
  for (let h = 0; h < 10 * 24; h++) {
    w.runTo(w.now + HOUR);
    advancePlace(w, place);
  }
  const before = placeDigest(place),
    p = place.people,
    wood = findSubstance("cellulose")?.name ?? "cellulose";
  let read = 0,
    tools = 0,
    carried = 0;
  for (let i = 0; i < p.n && read < 80; i += Math.max(1, Math.floor(p.n / 80))) {
    const person = placeInspect(w, town, placePersonRef(town, p.id[i]!)) as PlaceInspectPerson,
      inv = person.inventory,
      items = placeGear(w, place, i);
    assert.equal(inv.slots.length, items.length, "a slot for each thing held");
    items.forEach((x, k) => {
      const slot = inv.slots[k]!;
      assert.equal(slot.name, x.stuff);
      assert.equal(slot.wear, Math.min(100, Math.round(x.wear / 10)));
      assert.equal(slot.state, x.wear >= 1000 ? "worn out" : x.wear >= 800 ? "failing" : "working");
    });
    // (Its weight: the world's unit of each good held, and what they carry by its own.)
    const held = items.reduce((s, x) => s + UNIT[x.k]!, 0),
      sum = inv.materials.reduce((s, m) => s + m.kg, 0);
    assert.ok(Math.abs(sum - inv.kg) < 0.05, "its stuffs sum to the whole");
    assert.ok(inv.kg >= held - 0.05, `${inv.kg} kg against ${held} kg held`);
    if (inv.kg > held + 0.05) carried++;
    // (A tool's head of the town's own stuff, its haft of wood.)
    const tool = items.find((x) => x.k === GEAR.tool);
    if (tool) {
      assert.ok(inv.materials.some((m) => m.name === tool.stuff));
      assert.ok(
        inv.materials.some((m) => m.name === wood),
        "a haft of wood",
      );
      tools++;
    }
    for (const m of inv.materials) assert.match(m.colour, /^rgb\(\d+, \d+, \d+\)$/);
    read++;
  }
  t.diagnostic(
    `${read} read, ${tools} with a tool, ${carried} carrying ${GOODS.length ? "goods" : ""}`,
  );
  assert.ok(tools > 0, "some hold a tool");
  assert.equal(placeDigest(place), before, "read only");
  // (One carrying a load: its good by the stuffs it is made of, at its unit's weight; found within a day's hours.)
  let load = false;
  for (let h = 0; h < 24 && !load; h++) {
    for (let i = 0; i < p.n && !load; i++) {
      if (!p.carry[i]) continue;
      const person = placeInspect(w, town, placePersonRef(town, p.id[i]!)) as PlaceInspectPerson,
        held = placeGear(w, place, i).reduce((s, x) => s + UNIT[x.k]!, 0);
      if (!person.holds) continue;
      assert.ok(person.inventory.kg > held, `${person.holds}: carried, by its stuffs`);
      load = true;
    }
    w.runTo(w.now + HOUR);
    advancePlace(w, place);
  }
  t.diagnostic(load ? "one carrying found" : "none carrying in a day");
});
