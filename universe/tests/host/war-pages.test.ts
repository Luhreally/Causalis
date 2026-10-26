import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { MALE } from "../../src/rules/index.ts";
import { lifeOf, populationContext, warsOf } from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { levyPlaces } from "../../src/host/fallen.ts";
import { townRoster } from "../../src/host/roster.ts";
import { count } from "../../src/host/inspect/words.ts";
import { meetHousehold, observer, settleAll, type Person } from "../../src/causal/index.ts";
import type { Item, Line, PageModel } from "../../src/bridge/index.ts";

// Phase 55 M225: the men met go to war, and a town's War tab says where its men went. One world: the
// first light, a hundred and twenty-five years on, the households met in the towns that sent the most
// men, and the fifteen years after, in which the men met may fall.

const world = EARTH.build(seedFromText("first light"));
world.runTo(125 * YEAR);
const Y = Math.floor(world.now / YEAR),
  ledger = observer(world),
  ctx = populationContext(world),
  life = lifeOf(world);
const page = (ref: string) => EARTH.queries["page"]!(world, { ref }) as PageModel;

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

/** Households met in those towns, in order, until 120 grown men are met or 200 households. */
const met = (() => {
  const people: Person[] = [];
  let households = 0;
  const grownMen = () =>
    people.filter((p) => p.sex === MALE && Y - p.birthYear >= life.adulthood).length;
  for (const v of towns)
    while (households < 200 && grownMen() < 120) {
      try {
        people.push(...meetHousehold(world, v.cell, v.ref).members.map((r) => ledger.person(r)!));
      } catch {
        // (Everyone there has been met.)
        break;
      }
      households++;
    }
  return people;
})();

// Their wars go on: the years after they were met are followed, and their land's battles fought.
world.runTo((Y + 15) * YEAR);
settleAll(world);
const before = JSON.stringify(world.domainHashes());

/** A line's words, as a reader sees them. */
const words = (l: Line): string => l.map((s) => (typeof s === "string" ? s : s.text)).join("");

/** The items of a page's list with this title (null: the page has no such list). */
function listOf(p: PageModel, title: string): Item[] | null {
  for (const t of p.tabs)
    for (const b of t.blocks) if (b.type === "list" && b.title === title) return [...b.items];
  return null;
}

/** Every line a page says: its subtitle, its numbers, its facts, its lists and its text. */
function sayings(p: PageModel): string[] {
  const out = [words(p.subtitle), ...p.stats.map((s) => words(s.value))];
  for (const t of p.tabs)
    for (const b of t.blocks) {
      if (b.type === "text") out.push(...b.lines.map((l) => words(l)));
      if (b.type === "facts") out.push(...b.rows.map((s) => words(s.value)));
      if (b.type === "list") out.push(...b.items.map((i) => words(i.line)));
    }
  return out;
}

test("a veteran's page lists the battles he came home from, and his life tells each", () => {
  const veteran = met.find((p) => p.alive && p.wars?.length);
  assert.ok(veteran, "one of the men met came home from a battle");
  const p = page(veteran.ref),
    listed = listOf(p, "Their wars") ?? [],
    lived = listOf(p, "Their life") ?? [],
    said = { stood: "Fought at ", hurt: "Wounded at ", maimed: "Maimed at ", fell: "Fell at " };
  for (const w of veteran.wars!) {
    const item = listed.find((i) => i.ref === w.event);
    assert.ok(item, `${w.event} is among his wars`);
    assert.ok(words(item.line).startsWith(said[w.fate]), `${w.event} is said as it came home`);
    assert.ok(
      lived.some((i) => i.ref === w.event),
      `${w.event} is in his life`,
    );
  }
});

test("a man met who fell in the years since: his page says where, and his household's brief too", () => {
  const fallen = [...ledger.persons.values()].find((p) => p.wars?.some((w) => w.fate === "fell"));
  assert.ok(fallen, "one of the men met fell in the years since");
  const fell = fallen.wars!.at(-1)!;
  assert.equal(fell.fate, "fell", "he fell in his last battle");
  assert.equal(fallen.alive, false, "he is dead");
  assert.equal(fallen.diedYear, fell.year, "in the year of it");
  const p = page(fallen.ref);
  const says = sayings(p);
  assert.ok(
    says.some((s) => s.includes("Fell at the battle at")),
    "his page says where he fell",
  );
  assert.ok(
    says.some((s) => /buried/i.test(s)),
    "his page says where he lies",
  );
  assert.ok(
    (listOf(p, "Their life") ?? []).some((i) => i.ref === fell.event),
    "his life tells it",
  );
  assert.ok(
    sayings(page(fallen.household)).some((s) => s.includes("fell at the battle at")),
    "his household's brief says so",
  );
});

test("a town's War tab: each battle its men went to, newest first, and who fell there", () => {
  const town = towns.find((t) => townRoster(world, t.ref).battles.length > 0);
  assert.ok(town, "a town that sent men has battles in its roster");
  const battles = townRoster(world, town.ref).battles,
    events = new Set(battles.map((b) => b.event)),
    p = page(town.ref),
    items = listOf(p, "Its men at war") ?? [];
  assert.ok(
    p.tabs.some((t) => t.id === "war"),
    "the town has a war tab",
  );
  for (const b of battles) {
    const mine = items.filter((i) => i.ref === b.event);
    assert.equal(mine.length, 1, `${b.event} has one item`);
    assert.ok(
      words(mine[0]!.line).includes(`${count(b.tally[0])} sent`),
      `${b.event} says how many it sent`,
    );
  }
  const years = items.filter((i) => events.has(i.ref ?? "")).map((i) => i.year ?? 0);
  assert.deepEqual(
    years,
    [...years].sort((a, b) => b - a),
    "newest first",
  );
  for (const b of battles)
    for (const m of b.men)
      if (m.fate === "fell")
        assert.ok(
          items.some((i) => i.ref === m.holder.ref && words(i.line).startsWith("Fell there: ")),
          `${m.holder.ref} is named as fallen there`,
        );
  for (const person of ledger.persons.values())
    if (person.village === town.ref)
      for (const w of person.wars ?? [])
        if (w.fate === "fell" && events.has(w.event))
          assert.ok(
            items.some((i) => i.ref === person.ref),
            `${person.ref} fell there, and is named`,
          );
});

test("looking changes no history", () => {
  assert.equal(JSON.stringify(world.domainHashes()), before);
});
