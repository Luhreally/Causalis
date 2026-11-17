// Following and pinning anyone a page is about, and families (asked 2026-11-16: "im not able to pin each time i get into a persons
// tab ... id also like to pin familes if possible too"): a ruler, one of a court, one of a town's many, a great house and a town's
// line each have a name to follow by and news of their own; following changes nothing; the watches come back with a save; a family
// kept on the people bar stands there as its head, and the head who follows when the old one is gone.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type Ref,
  type World,
} from "../../src/kernel/index.ts";
import { seatRef } from "../../src/bridge/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import {
  courtOf,
  housesOf,
  politiesOf,
  populationContext,
  type Polity,
} from "../../src/sim/index.ts";
import { canWatch, label, newsLog, setWatch, tidings, watches } from "../../src/causal/index.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { barOf } from "../../src/host/bar.ts";
import { townRoster } from "../../src/host/roster.ts";
import { courtRef } from "../../src/host/court.ts";
import { seatHolder } from "../../src/host/kin.ts";
import {
  familyHead,
  houseNews,
  houseOf,
  houseRef,
  lineOf,
  lineRef,
} from "../../src/host/family.ts";
import { universeWorld } from "./worlds.ts";

const FROM = 100,
  TO = 140;
const surname = (name: string) => name.split(" ").slice(1).join(" ");

/** A realm whose ruling house sits at court beside its ruler, and that house. */
function ruledByAHouse(world: World): { r: Polity; event: Ref; kin: number } {
  for (const r of politiesOf(world).living()) {
    const crown = housesOf(world)
        ?.of(r.ref)
        ?.houses.find((h) => h.crown && h.name === surname(r.ruler.name)),
      kin = courtOf(world)
        ?.of(r.ref)
        ?.figures.find((f) => crown && surname(f.name) === crown.name);
    if (crown && kin) return { r, event: crown.event, kin: kin.id };
  }
  throw new Error("no realm ruled by a house with kin at court");
}

/** A town's line with a holder, in a realm's seat land. */
function aLine(world: World, r: Polity): { town: string; line: number } {
  const towns = populationContext(world).settlements;
  for (const c of r.members)
    for (const s of towns.seenIn(c))
      if (townRoster(world, s.ref).holder(0)) return { town: s.ref, line: 0 };
  throw new Error("no line held");
}

test("everyone a page is about, and every family, has a follow and a pin, named as the page names them", () => {
  const world = universeWorld(EARTH, "first light", FROM),
    { r, event, kin } = ruledByAHouse(world),
    dyn = houseRef(r.ref, event),
    at = aLine(world, r),
    line = lineRef(at.town, at.line),
    holder = townRoster(world, at.town).holder(at.line)!;
  for (const ref of [`rule:${r.ref}`, courtRef(r.ref, kin), holder.ref, dyn, line]) {
    const page = pageOf(world, ref);
    assert.ok(["person", "family"].includes(page.kind), `${ref}: a ${page.kind} page`);
    assert.equal(page.followable, true, `${ref} can be followed`);
    assert.ok(canWatch(world, page.ref as Ref));
    assert.deepEqual(page.pin, { ref: page.ref, name: page.title }, `${ref}: its pin`);
    if (page.kind === "person") assert.equal(label(world, page.ref as Ref), page.title);
  }
  assert.equal(label(world, dyn as Ref), `the house of ${houseOf(world, dyn)!.name}`);
  assert.equal(
    label(world, line as Ref),
    `the ${lineOf(world, line)!.house} line of ${lineOf(world, line)!.townName}`,
  );
  // Their pages link their family's own.
  const said = JSON.stringify(pageOf(world, `rule:${r.ref}`).tabs[0]);
  assert.ok(said.includes(dyn), "the ruler's page links their house");
  assert.ok(
    JSON.stringify(pageOf(world, holder.ref).tabs[0]).includes(line),
    "a townsman's page links his line",
  );
  assert.ok(
    JSON.stringify(pageOf(world, `${r.ref}#houses`)).includes(dyn),
    "the Houses tab links the house's page",
  );
  // A house's page: its head first among those of it.
  const house = pageOf(world, dyn);
  assert.equal(familyHead(world, dyn)!.ref, `rule:${r.ref}`);
  assert.ok(
    JSON.stringify(house.tabs[0]).includes(courtRef(r.ref, kin)),
    "its kin at court are of it",
  );
  // A maker at a seat, or the healer: followed by the name their seat's holder has now.
  const towns = populationContext(world)
      .settlements.all()
      .filter((t) => t.population > 0),
    seats = towns.flatMap((t) =>
      ["potter", "weaver", "smith", "healer"].flatMap((trade) => {
        const h = seatHolder(world, t.ref, trade, 0);
        return h
          ? [{ ref: trade === "healer" ? `heal:${t.ref}` : seatRef(t.ref, trade, 0), h }]
          : [];
      }),
    );
  assert.ok(seats.length > 0, "a maker at a seat");
  const seat = seats[0]!,
    seatPage = pageOf(world, seat.ref);
  assert.equal(label(world, seat.ref as Ref), seat.h.name);
  assert.equal(seatPage.followable, true);
  assert.deepEqual(seatPage.pin, { ref: seat.ref, name: seatPage.title });
  // One no record holds can't be followed, and the page says why rather than hiding it.
  const ghost = pageOf(world, courtRef(r.ref, 999_999_999));
  if (ghost.kind === "person") {
    assert.equal(ghost.followable, false);
    assert.ok(ghost.followWhy && ghost.followWhy.length > 10);
  }
});

test("followed, each is told its own news, the same after a save, and following changes nothing", () => {
  const quiet = universeWorld(EARTH, "first light", FROM),
    world = universeWorld(EARTH, "first light", FROM),
    { r, event, kin } = ruledByAHouse(world),
    dyn = houseRef(r.ref, event),
    at = aLine(world, r),
    line = lineRef(at.town, at.line),
    holder = townRoster(world, at.town).holder(at.line)!,
    ruler = r.ruler.name,
    rulers = politiesOf(world)
      .living()
      .slice(0, 40)
      .map((x) => `rule:${x.ref}` as Ref);
  for (const ref of [courtRef(r.ref, kin), holder.ref, dyn, line, ...rulers])
    assert.ok(setWatch(world, ref as Ref, true), `${ref} followed`);
  assert.equal(watches(world).find((w) => w.ref === `rule:${r.ref}`)?.of, r.ruler.event);
  const told = [];
  for (let year = FROM + 1; year <= TO; year++) {
    world.runTo(year * YEAR);
    told.push(...tidings(world));
  }
  quiet.runTo(TO * YEAR);
  assert.deepEqual(world.domainHashes(), quiet.domainHashes(), "following changes nothing");
  assert.ok(told.length > 0, "forty years of news");
  const h = houseOf(world, dyn)!,
    ofHouse = houseNews(world, h);
  for (const t of told) {
    const e = world.events.get(t.ref);
    if (t.watch.startsWith("court:")) {
      assert.ok(e, "a courtier's news is an event");
      assert.equal((e!.data as { fig?: number }).fig ?? kin, kin, `${e!.type} names them`);
    }
    if (t.watch === dyn && e) assert.ok(ofHouse(e), `${e.type} is the house's`);
    if (t.watch.startsWith("rule:") && e) {
      const realm = t.watch.slice("rule:".length);
      assert.ok(e.subjects.includes(realm as Ref), `${e.type} is of their realm`);
    }
  }
  // A seat passed: the one followed is remembered by name, and their successor's reign is not theirs.
  const passed = rulers.find((ref) => {
    const w = watches(world).find((x) => x.ref === ref)!;
    return politiesOf(world).get(ref.slice(5) as Ref)?.ruler.event !== w.of;
  });
  assert.ok(passed, "a seat passed among forty realms in forty years");
  {
    const w = watches(world).find((x) => x.ref === passed)!;
    assert.match(w.label, new RegExp(`^${w.name!}, who ruled `));
    const now = politiesOf(world).get(passed.slice(5) as Ref)!,
      after = world.events.get(now.ruler.event)!.t;
    for (const t of told.filter((x) => x.watch === passed)) {
      const e = world.events.get(t.ref);
      if (e) assert.ok(e.t <= after, "nothing of the next reign");
    }
  }
  assert.ok(
    watches(world)
      .find((x) => x.ref === `rule:${r.ref}`)!
      .label.startsWith(ruler.split(" ")[0]!),
  );
  // The message log reads the same kinds whole.
  assert.ok(newsLog(world).some((t) => t.watch === dyn || t.watch.startsWith("rule:")));
  // A save and a load: the same watches, their names and records, the same news to come.
  const build = () => EARTH.build(seedFromText("first light")),
    ruleset = rulesetId(world, "test"),
    loaded = loadWorld(saveWorld(world, ruleset), build, ruleset).world;
  assert.deepEqual(watches(loaded), watches(world));
  world.runTo((TO + 3) * YEAR);
  loaded.runTo((TO + 3) * YEAR);
  assert.deepEqual(tidings(loaded), tidings(world), "the same news from the same place");
  // The page of the one who holds that seat now is not lit as followed, and a press follows them in the other's stead.
  const was = watches(world).find((x) => x.ref === passed)!,
    page = pageOf(world, passed);
  assert.equal(page.followPassed, was.name);
  assert.ok(setWatch(world, passed, true), "followed afresh");
  const now = watches(world).find((x) => x.ref === passed)!;
  assert.equal(now.label, page.title);
  assert.equal(now.of, politiesOf(world).get(passed.slice(5) as Ref)!.ruler.event);
  assert.equal(pageOf(world, passed).followPassed, undefined);
  assert.equal(setWatch(world, passed, true), false, "followed once");
});

test("a family kept on the people bar stands as its head, and as the next head once the seat passes", () => {
  const world = universeWorld(EARTH, "first light", FROM),
    { r, event } = ruledByAHouse(world),
    dyn = houseRef(r.ref, event),
    name = pageOf(world, dyn).title,
    ask = { cell: null, town: null, pins: [{ ref: dyn, name }], followed: [] },
    first = barOf(world, ask).people[0]!;
  assert.equal(first.ref, `rule:${r.ref}`);
  assert.equal(first.name, r.ruler.name);
  assert.ok(first.key.startsWith(`${dyn}|`), "taken off the bar as the family");
  assert.match(first.why, /^Heads the house of /);
  assert.ok(first.pinned);
  // The ruler dies and the seat passes in the family: the bar's chip is the new head, the family the same.
  const heir = `${r.ruler.name.split(" ")[0]}son ${surname(r.ruler.name)}`;
  (r as { ruler: Polity["ruler"] }).ruler = { ...r.ruler, name: heir, born: r.ruler.born + 30 };
  const next = barOf(world, ask).people[0]!;
  assert.equal(next.name, heir);
  assert.ok(next.key.startsWith(`${dyn}|`));
  // Once the seat leaves the family, no one history names heads it at the bar but those of it at court.
  (r as { ruler: Polity["ruler"] }).ruler = { ...r.ruler, name: "Someone Else" };
  const after = barOf(world, ask).people[0]!;
  assert.notEqual(after.name, "Someone Else");
  assert.ok(after.key.startsWith(`${dyn}|`));
  // A line kept: its holder now.
  const at = aLine(world, r),
    line = lineRef(at.town, at.line),
    chip = barOf(world, {
      cell: null,
      town: null,
      pins: [{ ref: line, name: "line" }],
      followed: [],
    }).people[0]!;
  assert.equal(chip.ref, townRoster(world, at.town).holder(at.line)!.ref);
  assert.ok(chip.key.startsWith(`${line}|`));
});
