import { test } from "node:test";
import assert from "node:assert/strict";
import { DAY, YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { MALE } from "../../src/rules/index.ts";
import { lifeOf, populationContext, warsOf } from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { levyPlaces } from "../../src/host/fallen.ts";
import { healerOf, villagePlan } from "../../src/host/village.ts";
import { metWounds, townWounded, withWounds, woundedTowns } from "../../src/host/wounds.ts";
import { lookOf } from "../../src/host/inspect/wounds.ts";
import { meetHousehold, observer, settleAll, type Person } from "../../src/causal/index.ts";
import type { Item, Line, PageModel } from "../../src/bridge/index.ts";

// Phase 55 M226, M229 (T42): wounds on the pages that were there — a met veteran's, a line
// holder's, a town's — and the healer's page by its ref. The first light, 125 years on, the
// households met in the towns that sent the most men, twenty days into the year: the levy of its
// turn home and abed.

const world = EARTH.build(seedFromText("first light"));
world.runTo(125 * YEAR);
const Y = Math.floor(world.now / YEAR),
  ledger = observer(world),
  ctx = populationContext(world),
  life = lifeOf(world);
const page = (ref: string) => EARTH.queries["page"]!(world, { ref }) as PageModel;
const words = (l: Line): string => l.map((s) => (typeof s === "string" ? s : s.text)).join("");
function listOf(p: PageModel, title: string): Item[] | null {
  for (const t of p.tabs)
    for (const b of t.blocks) if (b.type === "list" && b.title === title) return [...b.items];
  return null;
}

/** The towns that sent the most men to the battles of the last 39 years, most first. */
const towns = (() => {
  const sent = new Map<string, number>();
  for (const w of warsOf(world).all())
    for (const b of w.battles) {
      if (!b.fell || b.year < Y - 39) continue;
      for (const side of [0, 1] as const)
        for (const place of levyPlaces(world, b, side, Infinity))
          if (place.kind === "town" && place.ref)
            sent.set(place.ref, (sent.get(place.ref) ?? 0) + place.sent);
    }
  return [...sent.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, 30)
    .map(([ref]) => ctx.settlements.get(ref as Ref)!);
})();
/** Households met in those towns, until 160 grown men are met or 260 households. */
const met = (() => {
  const people: Person[] = [];
  let households = 0;
  const grownMen = () =>
    people.filter((p) => p.sex === MALE && Y - p.birthYear >= life.adulthood).length;
  for (const v of towns)
    while (households < 260 && grownMen() < 160) {
      try {
        people.push(...meetHousehold(world, v.cell, v.ref).members.map((r) => ledger.person(r)!));
      } catch {
        break;
      }
      households++;
    }
  return people;
})();
world.runTo(Y * YEAR + 20 * DAY);
settleAll(world);
const before = JSON.stringify(world.domainHashes());

test("a met veteran's page tells their wounds, and their picture shows them", () => {
  const veterans = met
    .map((p) => ledger.person(p.ref)!)
    .filter((p) => p.wars?.some((w) => w.fate === "hurt" || w.fate === "maimed"));
  assert.ok(veterans.length >= 1, "no man met came home wounded");
  for (const p of veterans.slice(0, 6)) {
    const pg = page(p.ref),
      told = listOf(pg, "Their wounds"),
      wounds = metWounds(world, p);
    assert.ok(told && told.length >= 1, `${p.ref} has no "Their wounds"`);
    for (const w of wounds.filter((x) => x.at <= world.now))
      assert.ok(
        told!.some((i) => i.ref === w.event),
        `${p.ref}: ${w.event} told`,
      );
    const portrait = pg.portrait?.kind === "person" ? pg.portrait : null;
    assert.deepEqual(portrait?.look, lookOf(wounds, world.now).look);
  }
});

test("a line holder's page tells their wounds, and their picture shows them", () => {
  let told = 0;
  for (const r of woundedTowns(world, 20)) {
    const plan = withWounds(world, villagePlan(world, r.ref as Ref, undefined, 480));
    for (const p of plan.people) {
      const dealt = (p.wounds ?? []).filter((w) => w.at <= world.now);
      if (!p.folk || p.trade || p.healer || !dealt.length) continue;
      const pg = page(p.ref),
        list = listOf(pg, "Their wounds");
      assert.ok(list, `${p.ref} has no "Their wounds"`);
      for (const w of dealt)
        assert.ok(
          list!.some((i) => i.ref === w.event),
          `${p.ref}: ${w.event} told`,
        );
      const portrait = pg.portrait?.kind === "person" ? pg.portrait : null;
      assert.deepEqual(portrait?.look, lookOf(p.wounds!, world.now).look);
      if (++told >= 6) return;
    }
  }
  assert.ok(told >= 1, "no line holder wounded in the towns looked at");
});

test("a town's page has its wounded", () => {
  const ref = woundedTowns(world, 20)
    .map((r) => r.ref)
    .find((r) => townWounded(world, r).length > 0);
  assert.ok(ref, "no town with wounded twenty days on");
  const pg = page(ref!);
  assert.ok(
    pg.tabs.some((t) => t.id === "wounded"),
    pg.tabs.map((t) => t.id).join(),
  );
});

test("the healer's page by its ref, up through its town", () => {
  const s = ctx.settlements.all().find((t) => healerOf(world, t, Y) !== null);
  assert.ok(s, "no land knows herb-lore");
  const pg = page(`heal:${s!.ref}`);
  assert.equal(pg.kind, "person");
  assert.ok(pg.crumbs && words(pg.crumbs).includes(s!.name), JSON.stringify(pg.crumbs));
});

test("no history moved by the pages", () => {
  assert.equal(JSON.stringify(world.domainHashes()), before);
});
