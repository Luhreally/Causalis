// What now? (town mode, G3): one to three things worth doing next, read off the town as it stands, each with somewhere
// to go (a page, the eye to a place, a sheet); its gravest alert first where one is grave; and read only.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUR } from "../../src/kernel/index.ts";
import { advancePlace, enterPlace, placeDigest, placeIndexOf } from "../../src/host/place.ts";
import { placeInspect } from "../../src/host/placeinspect.ts";
import { placeNotices } from "../../src/host/placeplan.ts";
import {
  placePersonRef,
  placeWhatNowRef,
  type PlaceInspectPerson,
  type PlaceInspectWhatNow,
} from "../../src/bridge/index.ts";
import { noTown, placeWorld, townWhere } from "./worlds.ts";

const SHEETS = ["people", "stocks", "work", "build", "dangers", "log"];

test("what now: one to three things worth doing, each with somewhere to go, the gravest alert first", (t) => {
  const w = placeWorld(150);
  let read = 0;
  for (const least of [500, 100]) {
    const s =
      townWhere(w, () => true, { near: 3000, least }) ?? (read ? null : noTown(t, `of ${least}`));
    if (!s) continue;
    const town: string = s.ref,
      place = enterPlace(w, town)!;
    for (let h = 0; h < 30; h++) {
      w.runTo(w.now + HOUR);
      advancePlace(w, place);
    }
    const before = placeDigest(place),
      x = placeInspect(w, town, placeWhatNowRef(town)) as PlaceInspectWhatNow;
    assert.equal(x.kind, "whatnow");
    assert.ok(x.tips.length >= 1 && x.tips.length <= 3);
    for (const tip of x.tips) {
      assert.ok(tip.ref || tip.go || tip.sheet, `${tip.words}: somewhere to go`);
      if (tip.sheet) assert.ok(SHEETS.includes(tip.sheet));
      if (tip.go?.id != null) assert.ok(placeIndexOf(place, tip.go.id) >= 0);
      assert.ok(tip.words.length > 5 && tip.how.length > 5);
    }
    // (One row a thing: an alert and a danger of one fire told once. U2.)
    const said = x.tips.map((tip) =>
      tip.words
        .toLowerCase()
        .replace(/[.:;,]+\s*/g, " ")
        .trim(),
    );
    assert.equal(new Set(said).size, said.length, `one row a thing: ${said.join(" | ")}`);
    const grave = placeNotices(w, place).filter((n) => n.level >= 3);
    if (grave.length) assert.equal(x.tips[0]!.words, grave[0]!.words, "the gravest alert first");
    t.diagnostic(`${town}: ${x.tips.map((tip) => `${tip.icon} ${tip.words}`).join(" | ")}`);
    assert.equal(placeDigest(place), before, "read only");
    read++;
  }
});

test("a fire told once in what now; those it hurt said to lie abed, or to be brought home to, as their health says (U2)", (t) => {
  const w = placeWorld(150),
    s = townWhere(w, () => true, { near: 3000, least: 500 }) ?? noTown(t, "of five hundred");
  if (!s) return;
  const town: string = s.ref,
    place = enterPlace(w, town)!;
  try {
    w.runTo(w.submit("act.fire", { village: town }).t);
  } catch {
    // (Nothing of it stands to burn, or nothing burns in its air.)
    return void t.skip("no fire took");
  }
  let burning = 0;
  for (let h = 0; h < 6; h++) {
    w.runTo(w.now + HOUR);
    advancePlace(w, place);
    if (!place.fire.length) continue;
    burning++;
    const before = placeDigest(place),
      x = placeInspect(w, town, placeWhatNowRef(town)) as PlaceInspectWhatNow,
      fires = x.tips.filter((tip) => tip.icon === "🔥");
    assert.ok(fires.length <= 1, `one fire, one row: ${fires.map((f) => f.words).join(" | ")}`);
    assert.equal(placeDigest(place), before, "read only");
  }
  const p = place.people;
  let abed = 0;
  for (let i = 0; i < p.n; i++) {
    if ((p.health[i] !== 1 && p.health[i] !== 2) || !p.ill[i]) continue;
    const r = placeInspect(w, town, placePersonRef(town, p.id[i]!)) as PlaceInspectPerson;
    assert.match(r.now, /abed|brought/i, `hurt or sick, and said to be: ${r.now}`);
    abed++;
  }
  t.diagnostic(`${town}: ${burning} hours burning read, ${abed} abed`);
});
