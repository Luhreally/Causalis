// The guard's post (town mode, O7): those standing to arms stand where your order posts them, and keep its watch through
// the night by turns; a theft from a home within a cry of it, while it is kept, is caught in the act, nothing taken, and
// brought before the town's justice. Unposted, the town is as it was; the order is the town's alone.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import { OCC } from "../../src/rules/index.ts";
import {
  ACT,
  BOUND_ARMS,
  HAP,
  WATCH_TURNS,
  WHY,
  cryReach,
  enterPlace,
  placesOf,
  streetLength,
  type Place,
} from "../../src/host/place.ts";
import { placeFrame, whyWords } from "../../src/host/placeplan.ts";
import { placeInspect } from "../../src/host/placeinspect.ts";
import type { PlaceInspectLot } from "../../src/bridge/index.ts";
import { PLACE_UNIVERSE, noTown, placeWorld, townWhere } from "./worlds.ts";

const base = (): World => placeWorld(150);
const copy = (w: World): World =>
  loadWorld(
    JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: PLACE_UNIVERSE.name }))),
    (s) => PLACE_UNIVERSE.build(s),
    "r",
  ).world;
const order = (w: World, type: string, args: unknown): void => {
  const c = w.submit(type, args);
  w.runTo(c.t);
};
const go = (w: World, ref: string, hours: number): void => {
  for (let h = 0; h < hours; h++) {
    w.runTo(w.now + HOUR);
    placeFrame(w, ref, []);
  }
};
/** A post among homes (the lot of its first hundred homes with the most within a cry of it), and up to ten households beside one in reach. */
function laid(w: World, place: Place): { post: number; picked: number[] } {
  const p = place.people,
    h = place.houses,
    reach = cryReach(w, place) * 0.8;
  let post = -1,
    most = -1;
  for (let k = 0; k < Math.min(100, h.n); k++) {
    const lot = h.home[k]!;
    if (lot < 0) continue;
    let n = 0;
    for (let q = 0; q < h.n; q++)
      if (h.home[q]! >= 0 && streetLength(place, lot, h.home[q]!) <= reach) n++;
    if (n > most) [most, post] = [n, lot];
  }
  const picked: number[] = [];
  for (let i = 0; i < p.n && picked.length < 10; i++) {
    const x = p.house[i]!;
    if (x < 1 || x + 1 >= h.n || (p.sexOcc[i]! & 15) === OCC.dependent || p.health[i]) continue;
    if (picked.some((j) => Math.abs(p.house[j]! - x) < 3)) continue;
    const home = h.home[x + 1]!;
    if (home < 0 || streetLength(place, post, home) > reach) continue;
    picked.push(i);
  }
  return { post, picked };
}
/** Ten days of those picked in want, low, their pantries bare, the households beside them full. */
function hungry(w: World, ref: string, place: Place, picked: number[]): void {
  const p = place.people,
    nf = 3;
  for (let day = 0; day < 10; day++) {
    for (const i of picked) {
      const x = p.house[i]!;
      for (let k = 0; k < nf; k++) {
        place.houses.pantry[x * nf + k] = 0;
        place.houses.pantry[(x + 1) * nf + k] = Math.max(
          place.houses.pantry[(x + 1) * nf + k]!,
          50_000_000,
        );
      }
      p.lack[i] = 144 * 7;
      p.mood[i] = -90;
    }
    go(w, ref, 24);
  }
}

test("the guard at its post: kept through the night by turns; a theft within a cry of it caught in the act, and judged", (t) => {
  const w0 = base(),
    s = townWhere(w0, () => true, { near: 600, least: 300 }) ?? noTown(t, "of three hundred");
  if (!s) return;
  const town: string = s.ref;
  const run = (posted: boolean) => {
    const w = copy(w0);
    enterPlace(w, town);
    go(w, town, 24);
    const place = placesOf(w)!.get(town)!,
      { post, picked } = laid(w, place);
    order(w, "place.respond", { town, what: "muster", on: true });
    if (posted) order(w, "place.post", { town, lot: post });
    hungry(w, town, place, picked);
    return { w, place, post, picked };
  };
  const a = run(false),
    b = run(true);
  assert.ok(a.picked.length >= 2, `${a.picked.length} households beside homes in reach`);
  const of = (place: Place, what: number) => place.log.filter((x) => x.what === what).length;
  assert.ok(of(a.place, HAP.stole) > 0, "unposted, they steal");
  assert.equal(of(a.place, HAP.caught), 0, "none caught where no post is kept");
  // Posted: those thefts are caught, nothing taken, and each brought before its justice.
  assert.equal(of(b.place, HAP.stole), 0, "posted, none within its cry gets away with it");
  assert.ok(of(b.place, HAP.caught) > 0, "posted, they are caught in the act");
  for (const x of b.place.log.filter((y) => y.what === HAP.caught))
    assert.ok(
      b.place.log.some((y) => y.what === HAP.judged && y.id === x.id && y.t >= x.t),
      "each caught is brought before its justice",
    );
  // Its watch through the night: a share by turns, at the post, out of the working day; its page says so.
  const p = b.place.people;
  let night = 0;
  for (let h = 0; h < 24; h++) {
    go(b.w, town, 1);
    for (let i = 0; i < p.n; i++)
      if (p.bound[i] === BOUND_ARMS && p.why[i] === WHY.watch) {
        assert.equal(p.act[i], ACT.guard);
        if (p.at[i] === b.post) night++;
        assert.match(whyWords(b.w, b.place, i), /night's watch at the guard's post/);
      }
  }
  assert.ok(night > 0, "some keep the night's watch at the post");
  // (By turns: a share of them a night, not all.)
  let standing = 0;
  for (let i = 0; i < p.n; i++) if (p.bound[i] === BOUND_ARMS) standing++;
  assert.ok(night / 24 < standing, `${night / 24} a night of ${standing}, one in ${WATCH_TURNS}`);
  const page = placeInspect(b.w, town, `plcl:${town}:${b.post + 3}`) as PlaceInspectLot;
  assert.ok(page.post && page.postable && /watched/.test(page.postWords), page.postWords);
  // Let go: back to the square, none at the post by its order, and the page says nothing of a post.
  order(b.w, "place.post", { town, lot: null });
  go(b.w, town, 30);
  const again = placeInspect(b.w, town, `plcl:${town}:${b.post + 3}`) as PlaceInspectLot;
  assert.ok(!again.post && again.postWords === "");
  for (let i = 0; i < p.n; i++)
    assert.notEqual(p.why[i], WHY.watch, "no night's watch once let go");
  // (A post on no lot of its own is refused.)
  assert.throws(() => b.w.submit("place.post", { town, lot: -1 }));
});
