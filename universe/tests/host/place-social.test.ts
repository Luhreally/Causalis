// Town mode, deeper social life (Q2, asked 2026-11-26): what one thinks of another is their regard (N8: their meetings,
// alike of temper and of what they hold dear) and, on it, reasons that each came of something between them, with its
// size, its day, its source and its own fading: words had, blows, a theft from their household, a thing told them of the
// other by one they trust, a mate's jealousy, their pairing and their parting. Those followed in full keep each reason as
// its own; for the rest, and as each fades or they leave full, the share that stays is rolled into their regard. Kin who
// keep their household's young and old are thought the better of while they do. Two paired who can no longer abide each
// other part. All of it kept with the place, saved and read back the same.
import assert from "node:assert/strict";
import { test } from "node:test";
import { DAY, HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import { populationContext, townsOf, type Settlement } from "../../src/sim/index.ts";
import {
  HAP,
  OPINIONS,
  PART_AT,
  REASON,
  THOUGHT,
  TIER,
  TIES,
  enterPlace,
  placeDigest,
  placeIndexOf,
  placeMoodTerms,
  placeOpinion,
  placePin,
  placeRepute,
  placeTiered,
  placeTies,
  placesOf,
} from "../../src/host/place.ts";
import { placeFrame } from "../../src/host/placeplan.ts";
import { inspectPerson } from "../../src/host/placeinspect.ts";
import { PLACE_UNIVERSE, keepsHouseholds, placeWorld } from "./worlds.ts";

const base = (): World => placeWorld(150);
const copy = (w: World): World => {
  const doc = JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: PLACE_UNIVERSE.name })));
  return loadWorld(doc, (s) => PLACE_UNIVERSE.build(s), "r").world;
};
const near = (w: World, people: number): Settlement => {
  const ctx = populationContext(w);
  return ctx.settlements
    .all()
    .filter((s) => ctx.settlements.held(s.ref) && townsOf(w).get(s.ref) && s.population > 0)
    .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))
    .reduce((a, b) => (Math.abs(b.population - people) < Math.abs(a.population - people) ? b : a));
};
const go = (w: World, ref: string, hours: number) => {
  for (let h = 0; h < hours; h++) {
    w.runTo(w.now + HOUR);
    placeFrame(w, ref, []);
  }
};
const kindOf = (v: number) => v >>> 24;

test("reasons kept in full, each with its source, told on by those trusted, and the same saved and read back", () => {
  placeTiered(false);
  try {
    const w = copy(base()),
      s = near(w, 900),
      place = enterPlace(w, s.ref)!;
    go(w, s.ref, 24 * 6);
    const p = place.people,
      kinds = new Map<number, number>();
    let held = 0;
    for (const [id, d] of place.deep ?? []) {
      const i = placeIndexOf(place, id);
      for (let k = 0; k < OPINIONS; k++) {
        const whom = d.ops[k * 3]!,
          v = d.ops[k * 3 + 1]!,
          from = d.ops[k * 3 + 2]!;
        if (!v) continue;
        held++;
        kinds.set(kindOf(v), (kinds.get(kindOf(v)) ?? 0) + 1);
        assert.ok(whom > 0 && whom !== id, "a reason is of another");
        if (kindOf(v) === REASON.told) {
          assert.ok(from > 0 && from !== whom && from !== id, "a thing heard is told by a third");
        } else assert.equal(from, 0);
        // (What they think all told is their regard, kin's, and their reasons now.)
        const j = placeIndexOf(place, whom);
        if (i >= 0 && j >= 0) {
          const o = placeOpinion(place, i, j),
            sum = o.regard + o.kin + o.reasons.reduce((n, x) => n + x.size, 0);
          assert.equal(o.total, Math.max(-100, Math.min(100, sum)));
        }
      }
    }
    console.log(
      `  reasons held ${held} by ${place.deep?.size ?? 0}: ${[...kinds].map(([k, n]) => `${Object.keys(REASON).find((x) => REASON[x as keyof typeof REASON] === k)} ${n}`).join(", ")}`,
    );
    assert.ok(held > 0, "reasons are kept");
    assert.ok((kinds.get(REASON.told) ?? 0) > 0, "things are told on");
    assert.ok((kinds.get(REASON.words) ?? 0) > 0, "words had are kept as reasons");
    // The Social tab: each tie's why, the town's view of them, and the web's lines among those they know.
    let shown = 0;
    for (let i = 0; i < p.n && shown < 40; i++) {
      const x = inspectPerson(w, place, p.id[i]!);
      if (!x || !x.ties.length) continue;
      shown++;
      assert.equal(x.ties.length, placeTies(place, i).length);
      assert.ok(/Known well to/.test(x.repute));
      for (const e of x.web) assert.ok(e.a < x.ties.length && e.b < x.ties.length && e.a !== e.b);
      for (const t of x.ties) assert.ok(t.portrait?.kind === "person");
    }
    assert.ok(shown > 0);
    const r = placeRepute(place, 0);
    assert.ok(r.known >= r.well + r.ill);
    // Saved and read back: the same place, reasons and all.
    const w2 = copy(w),
      place2 = placesOf(w2)!.get(s.ref)!;
    assert.equal(placeDigest(place2), placeDigest(place));
    const [id0, d0] = [...place.deep!].find(([, d]) => d.ops.some((v) => v !== 0))!;
    assert.deepEqual([...place2.deep!.get(id0)!.ops], [...d0.ops]);
  } finally {
    placeTiered(true);
  }
});

test("those who leave full have their reasons rolled into their regard; two paired who cannot abide each other part", () => {
  const w = copy(base()),
    s = near(w, 900),
    place = enterPlace(w, s.ref)!;
  go(w, s.ref, 2);
  const p = place.people;
  // (A people that keeps no partner, a spawning people's or a hive's, has no pairs to part: its month passes all the same.)
  if (keepsHouseholds(w)) {
    // Two paired, of the same household, made to think the worst of each other.
    let a = -1,
      b = -1;
    for (let i = 0; i < p.n && a < 0; i++) {
      const m = p.mate[i]! ? placeIndexOf(place, p.mate[i]!) : -1;
      if (m >= 0 && p.mate[m] === p.id[i] && p.id[i]! < p.id[m]!) {
        a = i;
        b = m;
      }
    }
    assert.ok(a >= 0, "two paired");
    const set = (x: number, y: number, r: number) => {
      let at = -1;
      for (let k = 0; k < TIES; k++) if (p.tie[x * TIES + k] === p.id[y]) at = k;
      if (at < 0) for (let k = 0; k < TIES && at < 0; k++) if (!p.tie[x * TIES + k]) at = k;
      if (at < 0) at = 0;
      p.tie[x * TIES + at] = p.id[y]!;
      p.regard[x * TIES + at] = r;
    };
    set(a, b, -100);
    set(b, a, -100);
    const ida = p.id[a]!,
      idb = p.id[b]!;
    assert.ok(placeOpinion(place, a, b).total <= PART_AT);
    go(w, s.ref, 30);
    const pq = placesOf(w)!.get(s.ref)!.people,
      ia = placeIndexOf(place, ida),
      ib = placeIndexOf(place, idb);
    assert.ok(
      place.log.some((x) => x.what === HAP.parted && x.id === ida && x.a === idb),
      "they part, told",
    );
    assert.equal(pq.mate[ia], 0);
    assert.equal(pq.mate[ib], 0);
    assert.ok(
      placeMoodTerms(w, place, ia).some((t) => t.thought === THOUGHT.parted && t.size < 0),
      "and remember it",
    );
    assert.ok(placeOpinion(place, ia, ib).total < 0);
  } else go(w, s.ref, 30);
  const q = placesOf(w)!.get(s.ref)!.people;
  // One followed in full by word, with reasons of their own: let go of, at midday (no day's meetings between), what each
  // reason leaves is in their regard of whom it was of.
  const regardOf = (x: number, id: number) => {
    for (let k = 0; k < TIES; k++) if (q.tie[x * TIES + k] === id) return q.regard[x * TIES + k]!;
    return null;
  };
  // (Those not in full of themselves, followed by word for a day and a half.)
  const picked: number[] = [];
  for (let i = 0; i < q.n && picked.length < 60; i++)
    if ((q.tier[i]! & 3) !== TIER.full && !q.health[i]) picked.push(q.id[i]!);
  for (const id of picked) placePin(place, id, -1);
  go(w, s.ref, 36);
  const held = picked
    .map((id) => [id, place.deep?.get(id)] as const)
    .filter(([, d]) => d && d.ops.some((v, k) => k % 3 === 1 && v !== 0));
  let rolled = 0,
    rolledRight = 0;
  console.log(`  ${held.length} of ${picked.length} followed by word hold reasons`);
  for (const id of picked) if (!held.some(([x]) => x === id)) placePin(place, id, null);
  while (((w.now % DAY) + DAY) % DAY < 8 * HOUR) go(w, s.ref, 1);
  const wants = held.map(([id, d]) => {
    const i = placeIndexOf(place, id),
      want = new Map<number, number>();
    for (let k = 0; k < OPINIONS; k++)
      if (d!.ops[k * 3 + 1])
        want.set(
          d!.ops[k * 3]!,
          (want.get(d!.ops[k * 3]!) ?? 0) +
            Math.round((((d!.ops[k * 3 + 1]! >>> 16) & 255) - 128) * 0.5),
        );
    return {
      id,
      want,
      was: new Map([...want.keys()].map((who) => [who, regardOf(i, who)] as const)),
    };
  });
  for (const [id] of held) placePin(place, id, null);
  // (Their tier read again at a turn on both strides: within three hours, before midnight's meetings.)
  go(w, s.ref, 3);
  for (const { id, want, was } of wants) {
    const i2 = placeIndexOf(place, id);
    if (i2 < 0 || (q.tier[i2]! & 3) === TIER.full) continue;
    assert.ok(!place.deep!.has(id), "let go of");
    for (const [who, by] of want) {
      const before = was.get(who),
        after = regardOf(i2, who);
      if (before === null || before === undefined || after === null || !by) continue;
      rolled++;
      if (after === Math.max(-100, Math.min(100, before + by))) rolledRight++;
    }
  }
  console.log(
    `  rolled into regard on leaving full: ${rolledRight} of ${rolled} as their reasons leave`,
  );
  assert.ok(rolled > 0, "some reasons rolled into a regard");
  assert.equal(rolledRight, rolled, "as each reason leaves");
});
