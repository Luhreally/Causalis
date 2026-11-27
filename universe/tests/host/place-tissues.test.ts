// The tissue a wound reached (town mode, asked 2026-11-26: "members and tissues behind the N9 wounds"): drawn by the draw
// its bleeding is drawn by, so the deeper a wound the harder it bled and the dead of wounds stay the world's shares; each
// blow's shares its own (no organ under a limb, an eye all organ); its pain, its days to mend and what it takes of its
// member's work by the tissue, each against its blow's mean, so a blow's wounds mend as long as the tables say on the mean.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HOUR,
  loadWorld,
  saveWorld,
  type World,
} from "../../src/kernel/index.ts";
import {
  TISSUES,
  TISSUE_REACH,
  bleedOf,
  reachAt,
  tissueMends,
  tissueOf,
  tissuePain,
  tissueTakes,
  type Blow,
} from "../../src/rules/index.ts";
import {
  populationContext,
  townsOf,
  type Settlement,
} from "../../src/sim/index.ts";
import {
  enterPlace,
  placeDigest,
  placeWound,
  placesOf,
} from "../../src/host/place.ts";
import { placeFrame } from "../../src/host/placeplan.ts";
import { inspectPerson } from "../../src/host/placeinspect.ts";
import { PLACE_UNIVERSE, placeWorld } from "./worlds.ts";

const BLOWS = Object.keys(TISSUE_REACH) as Blow[];

test("a wound's tissue by its bleeding's draw: the deeper the harder; each blow's shares; pain and mending against its mean", () => {
  const order = ["skin", "bone", "flesh", "organ", "vessel"];
  for (const blow of BLOWS) {
    for (const member of ["trunk", "arm-l", "leg-r", "eye-l"] as const) {
      const r = reachAt(blow, member);
      if (member !== "trunk")
        assert.equal(r[TISSUES.indexOf("organ")], member === "eye-l" ? 1 : 0);
      // (As the draw rises, the tissue goes no shallower in bleeding's order, and bleeding goes no lower.)
      let was = -1;
      const seen = new Map<string, number>();
      for (let u = 0; u < 1; u += 0.001) {
        const t = tissueOf(blow, member, u),
          k = order.indexOf(t);
        assert.ok(k >= was, `${blow} ${member} ${u}`);
        was = k;
        seen.set(t, (seen.get(t) ?? 0) + 0.001);
      }
      // (Each tissue as often as its share; the mean pain and mending of a blow's wounds 1.)
      const all = r.reduce((a, b) => a + b, 0);
      let pain = 0,
        mends = 0;
      for (const [t, share] of seen) {
        assert.ok(
          Math.abs(share - r[TISSUES.indexOf(t as never)]! / all) < 0.003,
          `${blow} ${member} ${t}`,
        );
        pain += share * tissuePain(blow, member, t as never);
        mends += share * tissueMends(blow, member, t as never);
      }
      assert.ok(
        Math.abs(pain - 1) < 0.01 && Math.abs(mends - 1) < 0.01,
        `${blow} ${member} ${pain} ${mends}`,
      );
    }
    // (A vessel opened bleeds harder than skin cut.)
    assert.ok(bleedOf(blow, 0.99) >= bleedOf(blow, 0.01));
  }
  assert.ok(
    tissueTakes("bone") === 1 && tissueTakes("skin") < tissueTakes("flesh"),
  );
});

const base = (): World => placeWorld(150);
const copy = (w: World): World => {
  const doc = JSON.parse(
    JSON.stringify(saveWorld(w, "r", { universe: PLACE_UNIVERSE.name })),
  );
  return loadWorld(doc, (s) => PLACE_UNIVERSE.build(s), "r").world;
};
const near = (w: World, people: number): Settlement => {
  const ctx = populationContext(w);
  return ctx.settlements
    .all()
    .filter(
      (s) =>
        ctx.settlements.held(s.ref) &&
        townsOf(w).get(s.ref) &&
        s.population > 0,
    )
    .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))
    .reduce((a, b) =>
      Math.abs(b.population - people) < Math.abs(a.population - people) ? b : a,
    );
};
const watch = (w: World, town: string, hours: number): void => {
  for (let k = 0; k < hours; k++) {
    w.runTo(w.now + HOUR);
    placeFrame(w, town, []);
  }
};

test("a fire's hurt: each wound reaches a tissue, told on their page, kept in the save", () => {
  const w = copy(base()),
    s = near(w, 500),
    place = enterPlace(w, s.ref)!;
  watch(w, s.ref, 2);
  const c = w.submit("act.fire", { village: s.ref });
  w.runTo(c.t);
  let reached = 0,
    told = 0;
  for (let h = 0; h < 12; h++) {
    watch(w, s.ref, 1);
    const p = placesOf(w)!.get(s.ref)!.people;
    for (let i = 0; i < p.n; i++) {
      if (p.health[i] !== 1) continue;
      const x = placeWound(place, i);
      if (!x.tissue) continue;
      reached++;
      // (A fire burns skin and flesh, no deeper.)
      assert.ok(
        x.tissue === "skin" || x.tissue === "flesh" || p.cause[i]! % 8 !== 3,
        x.tissue,
      );
      const rows = new Map(inspectPerson(w, place, p.id[i]!)!.healthRows);
      if (
        /^(The skin|Into the flesh|The bone broken|A great vessel|Through to)/.test(
          rows.get("Reached") ?? "",
        )
      )
        told++;
    }
  }
  assert.ok(
    reached > 0 && told === reached,
    `${reached} reached, ${told} told`,
  );
  const again = copy(w);
  watch(w, s.ref, 24);
  watch(again, s.ref, 24);
  assert.equal(placeDigest(placesOf(again)!.get(s.ref)!), placeDigest(place));
});
