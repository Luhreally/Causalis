import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import {
  beliefOf,
  civilizationsNear,
  designsOf,
  diplomacyOf,
  homePlanet,
  languagesOf,
  politiesOf,
  populationContext,
  relationRef,
  warsOf,
} from "../../src/sim/index.ts";
import { ageRef, isProvinceWorld } from "../../src/gen/index.ts";
import { observer } from "../../src/causal/index.ts";
import type { Block, Line, PageKind, PageModel } from "../../src/bridge/index.ts";

const world = EARTH.build(seedFromText("first light"));
world.runTo(260 * YEAR);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T;
const page = (ref: string) => ask<PageModel>("page", { ref });

// The most peopled land and its first town; a family met there, so its people have pages.
const map = ask<{ cell: number; people: number; centre: number }[]>("people.map"),
  land = [...map].sort((a, b) => b.people - a.people)[0]!,
  town = ask<{ ref: string }[]>("settlements", { cell: land.cell })[0]!;
const met = ask<{ ref: string; members: { ref: string }[] }>("observe.meet", {
  cell: land.cell,
  village: town.ref,
});

/** Every ref a page links to: its names, its lists' and tables' entries, its whys. */
function linksOf(p: PageModel): string[] {
  const out: string[] = [],
    line = (l: Line) => {
      for (const s of l) if (typeof s !== "string") out.push(s.ref);
    };
  line(p.subtitle);
  for (const s of p.stats) {
    line(s.value);
    if (s.why) out.push(s.why);
    for (const x of s.parts ?? []) line(x.label);
  }
  for (const t of p.tabs)
    for (const b of t.blocks as Block[]) {
      if (b.type === "text") b.lines.forEach(line);
      if (b.type === "facts")
        for (const s of b.rows) {
          line(s.value);
          if (s.why) out.push(s.why);
          for (const x of s.parts ?? []) line(x.label);
        }
      if (b.type === "list")
        for (const i of b.items) {
          line(i.line);
          if (i.ref) out.push(i.ref);
          if (i.why) out.push(i.why);
        }
      if (b.type === "table")
        for (const r of b.rows) {
          if (r.ref) out.push(r.ref);
          r.cells.forEach(line);
        }
      if (b.type === "why") out.push(b.ref);
    }
  return out;
}

test("every kind of thing has a page of its own: a title, headline numbers and tabs", () => {
  const g = homePlanet(world).generated,
    realm = politiesOf(world).all()[0]!,
    war = warsOf(world)
      .all()
      .find((w) => w.battles.length)!,
    faith = beliefOf(world).all()[0]!,
    tongue = languagesOf(world).all()[0]!,
    design = designsOf(world).list()[0]!,
    regard = diplomacyOf(world).all()[0]!,
    fine = isProvinceWorld(g) ? g.fine : g,
    person = met.members[0]!.ref,
    body = g.system.bodies.find((b) => b.ref !== g.planet.ref && b.kind !== "moon")!,
    moon = g.system.bodies.find((b) => b.kind === "moon"),
    cluster = ask<{ stars: { ref: string }[] }>("galaxy.cluster").stars[0]!,
    far = ask<{ ref: string }[]>("galaxy.near", { x: 4000, y: 3000 })[0]!,
    civ = civilizationsNear(world)[0];
  const cases: [string, PageKind][] = [
    [`cell:0:${land.cell}`, "land"],
    [`spot:0:${land.centre}`, "spot"],
    [town.ref, "town"],
    [met.ref, "household"],
    [person, "person"],
    [realm.ref, "realm"],
    [relationRef(regard.a, regard.b), "relation"],
    [war.ref, "war"],
    [war.battles[0]!.event, "battle"],
    [war.event, "event"],
    [faith.ref, "faith"],
    [tongue.ref, "language"],
    [design.ref, "design"],
    [`mkt:${land.cell}:0`, "good"],
    [g.life.species.find((s) => s.niche === "grazer")!.ref, "lineage"],
    [fine.deposits[0]!.ref, "deposit"],
    [fine.tectonics.plates[0]!.ref, "plate"],
    [ageRef(0, 3), "age"],
    [g.star.ref, "star"],
    [cluster.ref, "star"],
    [far.ref, "star"],
    [body.ref, "planet"],
    [g.planet.ref, "planet"],
    [`${cluster.ref}/0`, "world"],
    [populationContext(world).settlements.get(town.ref as Ref)!.decision, "decision"],
  ];
  if (moon) cases.push([moon.ref, "moon"]);
  if (civ) cases.push([civ.ref, "civilization"]);
  for (const [ref, kind] of cases) {
    const p = page(ref);
    assert.equal(p.kind, kind, `${ref} is a ${kind}'s page, not a ${p.kind}'s`);
    assert.ok(p.title.length > 2, `${ref} has a title`);
    assert.ok(p.icon.length > 0, `${ref} has an icon`);
    assert.ok(
      p.tabs.length > 0 && p.tabs.every((t) => t.blocks.length > 0),
      `${ref} has tabs, each with blocks`,
    );
  }
  // A people and their ways open onto their land, on its people.
  const folk = page(`folk:0:${land.cell}`);
  assert.equal(folk.kind, "land");
  assert.equal(folk.tab, "people");
  // A war's host opens the war on that host.
  assert.equal(page(`${war.ref}#attacker`).tab, "attacker");
  // A person's page knows them: their household, their town.
  const pp = page(person);
  assert.ok(linksOf(pp).includes(met.ref), "a person's page links to their household");
  assert.ok(linksOf(pp).includes(town.ref), "a person's page links to their town");
  void observer;
});

test("every link on every page leads to a page, and looking never changes history", () => {
  const before = JSON.stringify(world.domainHashes()),
    seeds = [
      `cell:0:${land.cell}`,
      town.ref,
      ...politiesOf(world)
        .all()
        .slice(0, 3)
        .map((r) => r.ref),
      ...warsOf(world)
        .all()
        .slice(-2)
        .map((w) => w.ref),
      homePlanet(world).generated.star.ref,
      met.members[0]!.ref,
    ],
    seen = new Set<string>(),
    queue = [...seeds],
    gone: string[] = [],
    kinds = new Set<string>();
  while (queue.length && seen.size < 700) {
    const ref = queue.shift()!;
    if (seen.has(ref)) continue;
    seen.add(ref);
    const p = page(ref);
    kinds.add(p.kind);
    if (p.kind === "unknown") gone.push(`${ref}: ${p.title}`);
    for (const l of linksOf(p)) if (!seen.has(l)) queue.push(l);
  }
  assert.deepEqual(gone, [], "no link leads nowhere");
  assert.ok(seen.size >= 700, `the crawl went wide (${seen.size} pages)`);
  for (const k of ["land", "town", "realm", "war", "battle", "event", "language", "faith"])
    assert.ok(kinds.has(k), `the crawl reached a ${k}'s page`);
  assert.equal(JSON.stringify(world.domainHashes()), before, "history is as it was");
});

test("a page knows where its thing is to be seen", () => {
  const g = homePlanet(world).generated,
    realm = politiesOf(world).all()[0]!,
    cluster = ask<{ stars: { ref: string }[] }>("galaxy.cluster").stars[0]!,
    far = ask<{ ref: string }[]>("galaxy.near", { x: 4000, y: 3000 })[0]!;
  assert.deepEqual(page(`cell:0:${land.cell}`).place, { scale: "region", cell: land.cell });
  assert.deepEqual(page(town.ref).place, { scale: "village", town: town.ref });
  const person = page(met.members[0]!.ref).place!;
  assert.equal(person.scale, "village");
  assert.equal((person as { person?: string }).person, met.members[0]!.ref);
  assert.deepEqual(page(realm.ref).place, { scale: "globe", spot: g.centre[realm.seat] });
  assert.deepEqual(page(cluster.ref).place, { scale: "cluster", star: cluster.ref });
  assert.deepEqual(page(far.ref).place, { scale: "galaxy", star: far.ref });
  assert.deepEqual(page(`${cluster.ref}/1`).place, { scale: "world", star: cluster.ref, index: 1 });
  assert.equal(page(g.planet.ref).place?.scale, "globe");
  const war = warsOf(world)
    .all()
    .find((w) => w.battles.length)!;
  assert.equal(page(war.ref).place?.scale, "globe");
});

test("a ref to nothing still answers, with what is known of it", () => {
  const p = page("pol:0:999999");
  assert.equal(p.kind, "unknown");
  assert.equal(p.title, "Gone from the world");
  assert.ok(p.tabs[0]!.blocks.length > 0);
});
