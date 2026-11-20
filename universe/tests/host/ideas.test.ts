// The pages of the things of the mind and what was built beside them (host/inspect/ideas.ts, works.ts, abroad.ts, networks.ts,
// minds.ts, self.ts): a page that fails is told as a page of its error, so each is asked for the parts it must hold.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  abroadOf,
  civilizationsNear,
  pilgrimsOf,
  politiesOf,
  populationContext,
  schoolRef,
  schoolsOf,
  workRef,
  worksOf,
} from "../../src/sim/index.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { search } from "../../src/host/search.ts";
import { townRoster } from "../../src/host/roster.ts";
import { pilgrimsBetween, pilgrimsBusy } from "../../src/host/pilgrims.ts";
import type { PageModel } from "../../src/bridge/index.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("kestrel", 400, { start: "spread" }),
  ctx = populationContext(world),
  titles = (p: PageModel): string[] =>
    p.tabs.flatMap((t) => t.blocks.map((b) => ("title" in b && b.title ? b.title : ""))),
  text = (p: PageModel): string => JSON.stringify(p),
  clean = (p: PageModel) => assert.doesNotMatch(text(p), /undefined|NaN|\[object/);

test("a school's page says what it teaches, who founded it, where it is held; its land and its realm say they hold it", () => {
  const store = schoolsOf(world)!,
    s = [...store.all()].sort((a, b) => store.landsOf(b.id) - store.landsOf(a.id))[0]!;
  assert.ok(s, "a school in four centuries");
  const page = pageOf(world, schoolRef(s.id));
  assert.equal(page.kind, "school");
  assert.ok(titles(page).includes("What it teaches") && titles(page).includes("How it began"));
  assert.ok(text(page).includes(s.by) || !s.by);
  clean(page);
  const held = store.landList(s.id)[0];
  if (held !== undefined) {
    const land = pageOf(world, ctx.provinces.get(held)!.ref);
    assert.ok(titles(land).includes("What they are taught"), "its land says so");
    assert.ok(titles(land).includes("How its people bear their years"));
    clean(land);
    const realm = politiesOf(world).of(held);
    if (realm && realm.members.every((c) => store.of(c)?.school === s.id))
      assert.ok(titles(pageOf(world, realm.ref)).includes("The school its lands hold"));
  }
  assert.ok(
    search(world, s.name, 60).some((f) => f.ref === schoolRef(s.id)),
    "found by its name",
  );
});

test("a work's page says who made it, for whom, and what it does; its land lists it", () => {
  const w = worksOf(world)!.all()[0];
  assert.ok(w, "a work in four centuries");
  const page = pageOf(world, workRef(w.id));
  assert.equal(page.kind, "work");
  assert.ok(titles(page).includes("What it does"));
  assert.ok(text(page).includes(w.by) && text(page).includes(w.patron.name));
  clean(page);
  assert.ok(titles(pageOf(world, ctx.provinces.get(w.land)!.ref)).includes("Works kept here"));
});

test("a land with people from elsewhere, and a seat pilgrims come to, say so; a road tells its pilgrims", () => {
  const ab = abroadOf(world)!;
  for (const c of ab.lands().slice(0, 3)) {
    const page = pageOf(world, ctx.provinces.get(c)!.ref);
    assert.ok(titles(page).includes("Peoples from elsewhere who live here"), `land ${c}`);
    clean(page);
  }
  // (One that no longer comes is kept, stilled, so that its coming again is not told as its first: those that stand.)
  const standing = pilgrimsOf(world)!
    .all()
    .filter((p) => p.pilgrims > 0);
  assert.ok(standing.length > 0);
  for (const p of standing.slice(0, 3)) {
    assert.ok(
      titles(pageOf(world, ctx.provinces.get(p.seat)!.ref)).includes("A place of pilgrimage"),
    );
    assert.ok(titles(pageOf(world, p.of)).includes("Pilgrimage"), p.of);
    // (Each of its ways comes in by one of the seat's neighbours.)
    const g = ctx.generated;
    let coming = 0;
    for (let k = g.grid.offsets[p.seat]!; k < g.grid.offsets[p.seat + 1]!; k++)
      coming += pilgrimsBetween(world, p.seat, g.grid.neighbours[k]!).pilgrims;
    assert.ok(coming > 0, "pilgrims come in by its roads");
  }
  assert.equal(pilgrimsBusy(0), 0);
  assert.ok(pilgrimsBusy(300) >= 1 && pilgrimsBusy(1e6) > pilgrimsBusy(300));
});

test("a town's page tells its water, its drains and its power; one of its people, how they bear what they have lived", () => {
  const town = [...ctx.settlements.all()]
      .filter((s) => s.market)
      .sort((a, b) => b.population - a.population)[0]!,
    page = pageOf(world, town.ref),
    all = titles(page);
  for (const t of ["Its water", "Its drains", "Its power"]) assert.ok(all.includes(t), t);
  clean(page);
  const someone = townRoster(world, town.ref).holder(0)!,
    person = pageOf(world, someone.ref);
  assert.ok(titles(person).includes("How they bear what they have lived"), someone.ref);
  clean(person);
});

test("a far people's page says who leads them", () => {
  const civs = civilizationsNear(world);
  assert.ok(civs.length >= 1);
  let led = 0;
  for (const c of civs) {
    const page = pageOf(world, c.ref);
    clean(page);
    if (titles(page).includes("Who leads them")) led++;
  }
  assert.ok(led >= 1, "someone leads one of them");
});
