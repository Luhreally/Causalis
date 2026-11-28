// What now? (town mode, G3): one to three things worth doing next, read off the town as it stands, each with somewhere
// to go (a page, the eye to a place, a sheet); its gravest alert first where one is grave; and read only.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUR } from "../../src/kernel/index.ts";
import { advancePlace, enterPlace, placeDigest, placeIndexOf } from "../../src/host/place.ts";
import { placeInspect } from "../../src/host/placeinspect.ts";
import { placeNotices } from "../../src/host/placeplan.ts";
import { placeWhatNowRef, type PlaceInspectWhatNow } from "../../src/bridge/index.ts";
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
    const grave = placeNotices(w, place).filter((n) => n.level >= 3);
    if (grave.length) assert.equal(x.tips[0]!.words, grave[0]!.words, "the gravest alert first");
    t.diagnostic(`${town}: ${x.tips.map((tip) => `${tip.icon} ${tip.words}`).join(" | ")}`);
    assert.equal(placeDigest(place), before, "read only");
    read++;
  }
});
