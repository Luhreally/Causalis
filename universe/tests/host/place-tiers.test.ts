// Town mode, its people in tiers (asked 2026-11-26: "give people tiers, so the mode can go much deeper per person"): in
// full, a tick each, those followed by the player's word, its healer and those who lead it and their households, and any
// caught up in a happening; light, at the hour, the households of those caught up and the friends and paired of those in
// full; the rest among the folk, every three hours. Each keeps all of their columns; one followed by word comes into
// full at the next tick; the tiers and the word kept in the save and gone on with the same in another process.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import { OCC } from "../../src/rules/index.ts";
import { populationContext, type Settlement } from "../../src/sim/index.ts";
import {
  PERSON_BYTES,
  TIER,
  advancePlace,
  enterPlace,
  placeIndexOf,
  placePin,
  placeTier,
  placesOf,
} from "../../src/host/place.ts";
import { placeFrame } from "../../src/host/placeplan.ts";
import { inspectPerson } from "../../src/host/placeinspect.ts";
import { PLACE_UNIVERSE, placeWorld } from "./worlds.ts";

const base = (): World => placeWorld(150);
const copy = (w: World): World => {
  const doc = JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: PLACE_UNIVERSE.name })));
  return loadWorld(doc, (s) => PLACE_UNIVERSE.build(s), "r").world;
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

test("its notables and their households in full, the caught up and their friends at the hour, the rest among the folk", () => {
  const w = copy(base()),
    s = near(w, 900),
    place = enterPlace(w, s.ref)!;
  // (Hour by hour for a day and two hours: who is in which tier, and those abed, each from the hour first seen so. One
  // taken abed is in full from their own next turn, and their household no longer among the folk: three hours at the
  // most. Light is for the households of those caught up, and the friends of those in full: a day may have none.)
  // (One of a household of three or more, none of whom leads it or heals, taken sick at once: abed three days.)
  {
    const p = place.people,
      plain = (h: number) => {
        let n = 0;
        for (let i = 0; i < p.n; i++)
          if (p.house[i] === h) {
            if ((p.sexOcc[i]! & 15) === OCC.leader || p.id[i] === place.healer) return false;
            n++;
          }
        return n >= 3;
      };
    let sick = -1;
    for (let i = 0; i < p.n && sick < 0; i++) if (!p.health[i] && plain(p.house[i]!)) sick = i;
    p.health[sick] = 2;
    p.ill[sick] = 3 * 144;
  }
  const abedSince = new Map<number, number>();
  let light = 0,
    caught = 0;
  for (let hr = 0; hr < 26; hr++) {
    go(w, s.ref, 1);
    const p = place.people,
      longAbed = new Set<number>();
    for (let i = 0; i < p.n; i++) {
      const abed = p.health[i] === 1 || p.health[i] === 2;
      if (!abed) abedSince.delete(p.id[i]!);
      else if (!abedSince.has(p.id[i]!)) abedSince.set(p.id[i]!, hr);
      if (abed && hr - abedSince.get(p.id[i]!)! >= 3) longAbed.add(p.house[i]!);
    }
    for (let i = 0; i < p.n; i++) {
      if (longAbed.has(p.house[i]!)) {
        caught++;
        assert.notEqual(p.tier[i]! & 3, TIER.folk, "one abed, or of their household, is not among the folk past a turn");
      }
      if ((p.tier[i]! & 3) === TIER.light) light++;
    }
  }
  const p = place.people,
    n = [0, 0, 0];
  for (let i = 0; i < p.n; i++) n[p.tier[i]! & 3]!++;
  assert.ok(n[TIER.full]! > 0 && n[TIER.folk]! > 0, `tiers ${n.join(" / ")}, light ${light}`);
  assert.ok(caught > 0 && light > 0, `the household of one abed followed light (${caught}, ${light})`);
  assert.ok(n[TIER.folk]! > n[TIER.full]!, `most among the folk (${n.join(" / ")})`);
  for (let i = 0; i < p.n; i++)
    if ((p.sexOcc[i]! & 15) === OCC.leader) assert.equal(p.tier[i]! & 3, TIER.full, "one who leads it is in full");
  if (place.healer) assert.equal(p.tier[placeIndexOf(place, place.healer)]! & 3, TIER.full, "its healer is in full");
  // One among the folk, followed by word: in full from the next tick, and said so at once; let go of, back at their turn.
  let at = -1;
  for (let i = 0; i < p.n && at < 0; i++) if ((p.tier[i]! & 3) === TIER.folk) at = i;
  const id = p.id[at]!;
  placePin(place, id, -1);
  assert.equal(inspectPerson(w, place, id)!.tier.tier, TIER.full, "said in full at once");
  w.runTo(w.now + 600);
  advancePlace(w, place);
  assert.equal(p.tier[placeIndexOf(place, id)]! & 3, TIER.full, "followed by word: in full from the next tick");
  const read = inspectPerson(w, place, id)!;
  assert.equal(read.tier.tier, TIER.full);
  assert.ok(read.tier.pinned && !read.tier.soft && /in full/.test(read.tier.words));
  assert.equal(placeTier(place, placeIndexOf(place, id)).pinned, -1);
  placePin(place, id, null);
  assert.equal(place.pins, undefined);
  // (Two bytes a person for it.)
  // (183 since the tissue a wound reached, a byte, 2026-11-26.)
  assert.ok(PERSON_BYTES <= 183, `${PERSON_BYTES} bytes a person`);
});

test("the tiers and those followed by word are kept in the save and go on the same in another process", () => {
  const dir = mkdtempSync(join(tmpdir(), "place-tiers-")),
    child = fileURLToPath(new URL("./place-tiers-child.ts", import.meta.url)),
    run = (...args: string[]) =>
      execFileSync(process.execPath, [child, ...args], { encoding: "utf8" })
        .trim()
        .split("\n")
        .at(-1)!;
  try {
    const save = join(dir, "w.save"),
      whole = run("whole"),
      first = run("first", save),
      second = run("second", save);
    assert.match(whole, /^[0-9a-f]+ [0-9a-f]+ \d+ \d+ \d+ \d+$/);
    assert.notEqual(first, whole, "the first hours are not yet the whole");
    assert.equal(second, whole);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
