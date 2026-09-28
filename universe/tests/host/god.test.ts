import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import {
  frontier,
  politiesOf,
  populationContext,
  warsOf,
  type Polity,
} from "../../src/sim/index.ts";
import type {
  ActsMap,
  Block,
  PageModel,
  PaletteLand,
  Tip,
  WarsMap,
} from "../../src/bridge/index.ts";
import { GROWTH_YEARS } from "../../src/host/lenses.ts";

// Phase 12: the god's palette and the acts it casts, the deeper lenses, the world in numbers,
// the armies. The first light's world, three centuries on.
const world = EARTH.build(seedFromText("first light"));
world.runTo(300 * YEAR);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T;
const map = ask<
  {
    cell: number;
    people: number;
    unrest: number;
    strength: number;
    wealth: number;
    knowledge: number;
    growth: number;
  }[]
>("people.map");
const land = [...map].sort((a, b) => b.people - a.people)[0]!;

/** Two standing realms at peace with a land between them, the most peopled first. */
function neighbours(): [Polity, Polity] {
  const ctx = populationContext(world),
    people = (p: Polity) => p.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0),
    living = [...politiesOf(world).living()].sort(
      (a, b) => people(b) - people(a) || (a.ref < b.ref ? -1 : 1),
    );
  for (const a of living)
    for (const b of living)
      if (a !== b && !warsOf(world).between(a.ref, b.ref) && frontier(ctx, a, b).length)
        return [a, b];
  throw new Error("no two realms touch");
}

test("a land as the god's palette sees it: whose it is, its faith, its towns the greatest first", () => {
  const seen = ask<PaletteLand>("palette.land", { cell: land.cell });
  assert.equal(seen.cell, land.cell);
  assert.ok(seen.name.length > 0 && seen.people > 0);
  assert.ok(seen.towns.length > 0, "its towns");
  for (let i = 1; i < seen.towns.length; i++)
    assert.ok(seen.towns[i - 1]!.people >= seen.towns[i]!.people, "the greatest first");
  if (seen.realm) {
    assert.ok(seen.realm.lands.includes(land.cell), "its realm's lands hold it");
    assert.equal(seen.realm.seat, politiesOf(world).of(land.cell)!.seat === land.cell);
  }
  assert.equal(ask<PaletteLand | null>("palette.land", { cell: -5 }), null, "no land there");
});

test("acts cast play where they fall: rain over a land, threads between two realms, fire on a city", () => {
  const [a, b] = neighbours();
  world.submit("act.rain", { cell: land.cell, sign: 1, years: 3 });
  world.submit("act.discord", { a: a.ref, b: b.ref });
  world.submit("act.war", { a: a.ref, b: b.ref });
  const city = ask<{ ref: string; city: boolean }[]>("towns.map").find((t) => t.city);
  if (city) world.submit("act.fire", { village: city.ref });
  world.runTo(world.now + 86_400);
  const acts = ask<ActsMap>("acts.map").acts,
    kinds = acts.map((m) => m.kind);
  for (const kind of ["rain", "discord", "war", ...(city ? ["fire"] : [])])
    assert.ok(kinds.includes(kind as never), `${kind} plays (${kinds.join(", ")})`);
  for (const m of acts) {
    assert.ok(Math.abs(Math.hypot(...m.at) - 1) < 0.05, "on the globe's face");
    assert.ok(m.left > 0 && m.left <= 1, `${m.kind} fades as its time runs out (${m.left})`);
  }
  const thread = acts.find((m) => m.kind === "war")!;
  assert.ok(thread.to, "a thread runs to the other's seat");
  assert.ok(acts.find((m) => m.kind === "rain")!.to === null);
  // Its time run out, it plays no more.
  const later = EARTH.build(seedFromText("first light"));
  later.runTo(300 * YEAR);
  later.submit("act.rain", { cell: land.cell, sign: 1, years: 1 });
  later.runTo(302 * YEAR + 86_400);
  assert.ok(
    !(EARTH.queries["acts.map"]!(later, {}) as ActsMap).acts.some((m) => m.kind === "rain"),
    "a year's rain is over two years on",
  );
});

test("the deeper lenses read every land, and a land's tip under one breaks its number down", () => {
  for (const e of map) {
    assert.ok(e.unrest >= 0 && e.unrest <= 1, `unrest ${e.unrest}`);
    assert.ok(e.strength >= 0 && e.wealth >= 0 && e.knowledge >= 0);
    assert.ok(Number.isFinite(e.growth));
  }
  // A realm's strength is the same over all its lands: the men it fields.
  const realms = politiesOf(world),
    byRealm = new Map<string, Set<number>>();
  for (const e of map) {
    const r = realms.of(e.cell);
    if (!r) continue;
    byRealm.set(r.ref, (byRealm.get(r.ref) ?? new Set()).add(Math.round(e.strength)));
  }
  assert.ok(byRealm.size > 0);
  for (const [ref, values] of byRealm) assert.equal(values.size, 1, `${ref} fields one host`);
  assert.ok(
    map.some((e) => e.knowledge >= 3),
    "lands know things",
  );
  const ref = `cell:0:${land.cell}`;
  for (const [lens, head] of [
    ["unrest", /^Unrest: /],
    ["strength", /^Strength: /],
    ["wealth", /^Wealth: .* a head in store/],
    ["knowledge", /^Knowledge: \d+ things known/],
    ["growth", new RegExp(`^Growth: (too new|[+−]\\d+% in ${GROWTH_YEARS} years)`)],
  ] as const) {
    const tip = ask<Tip>("tip", { ref, lens });
    assert.match(tip.line, head, `${lens}: ${tip.line}`);
    assert.ok(tip.stats.length >= 1, `${lens} broken down`);
  }
  // Under another lens, or none, a land's tip is its page's.
  assert.doesNotMatch(ask<Tip>("tip", { ref, lens: "terrain" }).line, /^Growth|^Unrest/);
  assert.equal(ask<Tip>("tip", { ref }).title, ask<Tip>("tip", { ref, lens: "growth" }).title);
});

test("the world in numbers: its people, realms and wars, towns, faiths and tongues through the years", () => {
  const p = ask<PageModel>("page", { ref: "world:stats" });
  assert.equal(p.kind, "stats");
  assert.deepEqual(
    p.tabs.map((t) => t.id),
    ["people", "realms", "towns", "beliefs"],
  );
  const lines = (b: Block) => (b.type === "lines" ? b.series : []);
  for (const t of p.tabs)
    for (const b of t.blocks)
      for (const s of lines(b))
        assert.ok(s.points.length >= 2, `${t.id}: ${s.name} has a line (${s.points.length})`);
  const people = p.tabs[0]!.blocks[0]!;
  assert.ok(
    people.type === "lines" && people.series.length >= 2,
    "the world's line and its realms'",
  );
  if (people.type === "lines") {
    const world = people.series[0]!.points,
      realm = people.series[1]!.points;
    assert.ok(world.at(-1)!.y >= realm.at(-1)!.y, "the world holds more than any realm");
    assert.ok(world.at(-1)!.y > world[0]!.y, "the world grew");
  }
  const realms = p.tabs[1]!.blocks[0]!;
  if (realms.type === "lines")
    assert.ok(realms.series[0]!.points.at(-1)!.y >= 1, "realms stand at the last year");
});

test("the wars map carries each host's kinds, and the garrisons of the realms at peace", () => {
  const wars = ask<WarsMap>("wars.map");
  assert.ok(wars.garrisons.length > 0 && wars.garrisons.length <= 48);
  const fighting = new Set(
    wars.wars.flatMap((w) => (w.ended === null ? [w.attacker.ref, w.defender.ref] : [])),
  );
  for (const g of wars.garrisons) {
    assert.ok(!fighting.has(g.realm), "a garrison stands at peace");
    assert.ok(g.spot >= 0);
  }
  for (let i = 1; i < wars.garrisons.length; i++)
    assert.ok(wars.garrisons[i - 1]!.fields >= wars.garrisons[i]!.fields, "the greatest first");
  const sides = wars.wars.flatMap((w) => [w.attacker, w.defender]);
  assert.ok(sides.length > 0, "a war to see");
  assert.ok(
    sides.some((s) => s.host && s.host.arm && s.host.mount),
    "a side's host has its kinds",
  );
});
