// A town's faith and rank (town mode, P7): read once a day off its land's faith and its people's ways (piety, hierarchy) and
// the shrines, temples and hall it has standing; a shrine is worth its grown the more as they are devout, its want weighs on
// them where they are devout enough to want one; a hall is worth those of rank (its leaders, its realm's key figures) the
// more as rank is held high, its want weighs on them. Each told on its page, its shrines and those of rank each a key.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUR } from "../../src/kernel/index.ts";
import { WAY, beliefOf, cultureOf } from "../../src/sim/index.ts";
import { OCC } from "../../src/rules/index.ts";
import { advancePlace, enterPlace, placeRites } from "../../src/host/place.ts";
import { placeInspect } from "../../src/host/placeinspect.ts";
import {
  placeFaithRef,
  placePersonRef,
  type PlaceInspectFaith,
  type PlaceInspectPerson,
} from "../../src/bridge/index.ts";
import { noTown, placeWorld, townWhere } from "./worlds.ts";

test("its faith's rites and its rank read off its land and what stands; weighed on the grown and those of rank; told", (t) => {
  const w = placeWorld(150),
    s =
      townWhere(w, (place, ww) => !!beliefOf(ww).of(place.cell).faith, { near: 600, least: 300 }) ??
      noTown(t, "whose land keeps a faith");
  if (!s) return;
  const town: string = s.ref,
    place = enterPlace(w, town)!,
    p = place.people;
  for (let h = 0; h < 2; h++) {
    w.runTo(w.now + HOUR);
    advancePlace(w, place);
  }
  const r = placeRites(w, place),
    ways = cultureOf(w).get(place.cell)!.traits;
  assert.equal(r.piety, ways[WAY.piety]);
  assert.equal(r.hierarchy, ways[WAY.hierarchy]);
  assert.equal(r.faith, beliefOf(w).get(beliefOf(w).of(place.cell).faith!)!.name);
  // (Its shrines and hall as its buildings stand.)
  const kinds = new Set(r.shrines);
  for (const lot of r.shrines) assert.ok(place.bldgs.lot.includes(lot));
  assert.equal(kinds.size, r.shrines.length);
  assert.ok(r.rite !== 0 || r.rank !== 0, "something of its faith or rank weighs on them");
  // Weighed on each as it is theirs: the grown its rites, those of rank its hall.
  let grown = 0,
    ranked = 0;
  for (let i = 0; i < Math.min(p.n, 250); i++) {
    const x = placeInspect(w, town, placePersonRef(town, p.id[i]!)) as PlaceInspectPerson,
      rite = x.thoughts.find((q) => /shrine/i.test(q.words)),
      rank = x.thoughts.find((q) => /hall befitting/i.test(q.words)),
      isGrown = x.trade !== "child",
      ofRank = (p.sexOcc[i]! & 15) === OCC.leader || place.figId.includes(p.id[i]!);
    if (r.rite && isGrown) {
      assert.equal(rite?.size, r.rite, x.name);
      grown++;
    } else assert.equal(rite, undefined, x.name);
    if (r.rank && isGrown && ofRank) {
      assert.equal(rank?.size, r.rank, x.name);
      ranked++;
    } else assert.equal(rank, undefined, x.name);
  }
  assert.ok(grown > 0 || ranked > 0);
  // Its page: its faith, its shrines each a key, those of rank each a key.
  const f = placeInspect(w, town, placeFaithRef(town)) as PlaceInspectFaith;
  assert.equal(f.kind, "faith");
  assert.ok(f.faith.startsWith(r.faith!));
  assert.equal(f.shrines.length, r.shrines.length);
  for (const x of f.shrines) assert.equal(placeInspect(w, town, x.ref)?.kind, "lot");
  for (const x of f.ranked) assert.equal(placeInspect(w, town, x.ref)?.kind, "person");
  assert.ok(!/undefined|NaN/.test(JSON.stringify(f)));
});
