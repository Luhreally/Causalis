import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { politiesOf, populationContext, warsOf } from "../../src/sim/index.ts";
import type { VillagePlan } from "../../src/bridge/index.ts";
import { HARVEST } from "../../src/view/village.ts";

// Phase 33 M174: the feasts a town keeps, as its plan tells them. The first light's world at 125
// years, the towns of its most peopled lands; then on, a year at a time, to a peace made and a
// ruler crowned.
const world = EARTH.build(seedFromText("first light"));
world.runTo(125 * YEAR);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T;
const planOf = (ref: string) => ask<VillagePlan>("village.plan", { ref });
const townsOf = (cell: number) => populationContext(world).settlements.inProvince(cell);
const year = () => Math.floor(world.now / YEAR);
const plans = () =>
  [...ask<{ cell: number; people: number }[]>("people.map")]
    .sort((a, b) => b.people - a.people)
    .slice(0, 8)
    .flatMap((l) =>
      townsOf(l.cell)
        .slice(0, 2)
        .map((t) => planOf(t.ref)),
    );

test("a fed town keeps the harvest home once the grain is in, this year and the next; a hungry one none", () => {
  const all = plans(),
    fed = all.filter((p) => p.life!.fed >= 0.9);
  assert.ok(fed.length >= 1, "a fed town");
  for (const p of fed) {
    const home = p.life!.feasts!.filter((f) => f.occasion === "harvest");
    assert.deepEqual(
      home.map((f) => Math.floor(f.day / 365)),
      [year(), year() + 1],
    );
    for (const f of home) assert.ok((f.day % 365) / 365 >= HARVEST[1], "after the reaping");
  }
  for (const p of all.filter((q) => q.life!.fed < 0.9))
    assert.ok(!p.life!.feasts!.some((f) => f.occasion === "harvest"));
});

test("a town of a faith keeps its holy day — the same day in every town of it; one feast to a day", () => {
  const all = plans(),
    faithful = all.filter((p) => p.life!.faith);
  assert.ok(faithful.length >= 1, "a town of a faith");
  const days = new Map<string, number>();
  for (const p of faithful) {
    const holy = p.life!.feasts!.filter((f) => f.occasion === "holy");
    assert.equal(holy.length, 2);
    assert.equal(holy[0]!.words, `The feast of ${p.life!.faith}`);
    const day = holy[0]!.day % 365,
      seen = days.get(holy[0]!.ref!);
    if (seen !== undefined) assert.equal(day, seen, "one faith, one holy day");
    days.set(holy[0]!.ref!, day);
  }
  for (const p of all) {
    const feasts = p.life!.feasts!;
    assert.equal(new Set(feasts.map((f) => f.day)).size, feasts.length);
  }
});

test("a peace its realm made is feasted two days on, and a new ruler crowned three", () => {
  const realms = politiesOf(world),
    recent = (t: number) => t >= world.now - YEAR;
  let peace: { realm: Ref; t: number } | null = null,
    crowned: { realm: Ref; t: number } | null = null;
  for (let k = 0; k < 60 && !(peace && crowned); k++) {
    if (k) world.runTo(world.now + YEAR);
    peace = null;
    crowned = null;
    for (const w of warsOf(world).all()) {
      const e = w.peace ? world.events.get(w.peace) : undefined;
      if (e && recent(e.t) && realms.get(w.attacker)?.ended === null)
        peace = { realm: w.attacker, t: e.t };
    }
    const events = world.events.all();
    for (let i = events.length - 1; i >= 0 && recent(events[i]!.t); i--) {
      const e = events[i]!;
      if (e.type === "polity.succession" && realms.get(e.subjects[0]!)?.ended === null) {
        crowned = { realm: e.subjects[0]!, t: e.t };
        break;
      }
    }
  }
  assert.ok(peace && crowned, "a peace made and a ruler crowned within sixty years");
  const townOf = (realm: Ref) => {
    for (const cell of realms.get(realm)!.members) {
      const t = townsOf(cell)[0];
      if (t) return planOf(t.ref);
    }
    return null;
  };
  const kept = (realm: Ref, occasion: string, t: number, on: number) => {
    const p = townOf(realm);
    assert.ok(p, `a town of ${realm}`);
    const f = p.life!.feasts!.find((x) => x.occasion === occasion);
    assert.ok(f, `${p.name} keeps the ${occasion}: ${JSON.stringify(p.life!.feasts)}`);
    // (Unless another feast fell on that day first.)
    if (f.day !== Math.floor(t / 86_400) + on)
      assert.ok(p.life!.feasts!.some((x) => x.day === Math.floor(t / 86_400) + on));
    return f;
  };
  assert.match(kept(peace.realm, "peace", peace.t, 2).words, /^The peace with /);
  assert.match(kept(crowned.realm, "crowning", crowned.t, 3).words, /new ruler crowned$/);
});
