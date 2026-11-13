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
import { makePopulationWorld, politiesOf, populationContext } from "../../src/sim/index.ts";
import { EARTHLIKE } from "../../src/rules/index.ts";
import { installYears, logAt, yearsOf, type YearsStore } from "../../src/host/years.ts";
import { MOST_POINTS, realmThrough } from "../../src/host/inspect/time.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { blocsOf } from "../../src/host/inspect/ties.ts";

const YEARS = 220;
const make = (years: boolean): World => {
  const w = makePopulationWorld(seedFromText("first light"), { prior: EARTHLIKE, start: "spread" });
  if (years) installYears(w);
  return w;
};
const kept = make(true),
  plain = make(false);
kept.runTo(YEARS * YEAR);
plain.runTo(YEARS * YEAR);
const store = yearsOf(kept)!;

type Series = { type: "series"; title: string; points: { x: number; y: number }[]; latest: string };
const seriesOf = (w: World, ref: string): Series[] =>
  (pageOf(w, ref).tabs.find((t) => t.id === "time")?.blocks ?? []).filter(
    (b) => b.type === "series",
  ) as unknown as Series[];

test("keeping the years moves nothing: the same history, the same rules, with them or without", () => {
  assert.deepEqual(
    kept.checkpoints().map((c) => c.chain),
    plain.checkpoints().map((c) => c.chain),
  );
  assert.deepEqual(kept.domainHashes(), plain.domainHashes());
  assert.equal(rulesetId(kept, "v"), rulesetId(plain, "v"));
  assert.ok(store.realms.size > 10, `${store.realms.size} realms kept`);
  assert.equal(store.last, YEARS - 1);
});

test("a save keeps them, and a save made without them loads", () => {
  const doc = saveWorld(kept, rulesetId(kept, "v")),
    back = loadWorld(doc, () => make(true), rulesetId(kept, "v")).world;
  assert.deepEqual(yearsOf(back)!.save(), store.save());
  const { ["readings.years"]: _, ...rest } = doc.stores,
    without = loadWorld({ ...doc, stores: rest }, () => make(true), rulesetId(kept, "v")).world;
  assert.equal(yearsOf(without)!.realms.size, 0);
  // (A game without them lets them go.)
  assert.ok(loadWorld(doc, () => make(false), rulesetId(plain, "v")).world);
});

test("a realm's past is its own lands of each year, not the lands it holds now", () => {
  const history = populationContext(kept).history,
    realms = politiesOf(kept),
    changed = [...store.realms.keys()]
      .map((ref) => realms.get(ref as Ref)!)
      .filter((r) => r.ended === null)
      .map((r) => ({ r, t: realmThrough(kept, r.ref)! }))
      .find(({ t }) => new Set(t.lands).size > 1 && t.years.length > 20);
  assert.ok(changed, "a realm whose lands changed");
  const { r, t } = changed!;
  let differs = 0;
  t.years.forEach((y, i) => {
    let mine = 0,
      now = 0;
    for (const [c, log] of store.landRealm)
      if (logAt(log, y) === r.ref && y >= log.first)
        mine += history.yearsOf(c).find((l) => l.year === y)?.population ?? 0;
    for (const c of r.members) now += history.yearsOf(c).find((l) => l.year === y)?.population ?? 0;
    assert.equal(t.people[i], mine, `year ${y}`);
    if (mine !== now) differs++;
  });
  assert.ok(differs > 0, "its past differs from its lands of now");
});

test("a realm's, a land's and an alliance's lines: titled, thinned, each ending at the page's own number", () => {
  const r = politiesOf(kept)
      .living()
      .sort((a, b) => b.members.length - a.members.length)[0]!,
    page = pageOf(kept, r.ref),
    lines = seriesOf(kept, r.ref),
    said = (label: string) =>
      page.stats
        .find((s) => s.label === label)!
        .value.map((x) => (typeof x === "string" ? x : x.text))
        .join("");
  assert.ok(lines.length >= 8, `${lines.length} lines`);
  for (const l of lines) {
    assert.ok(l.title && l.latest, l.title);
    assert.ok(
      l.points.length >= 2 && l.points.length <= MOST_POINTS,
      `${l.title}: ${l.points.length}`,
    );
  }
  assert.equal(lines.find((l) => l.title === "People")!.latest, `${said("People")} people`);
  assert.equal(lines.find((l) => l.title === "Lands")!.latest, `${said("Lands")} lands`);
  assert.equal(lines.find((l) => l.title === "Tithe")!.latest.split(" ")[0], said("Tithe"));
  const land = seriesOf(kept, `cell:0:${r.seat}`);
  assert.ok(
    land.some((l) => l.title === "Grievance") && land.some((l) => l.title === "Food put by"),
  );
  const people = populationContext(kept).provinces.get(r.seat)!.total();
  assert.equal(
    land.find((l) => l.title === "People")!.latest,
    `${people.toLocaleString("en-US")} people`,
  );
  const head = [...blocsOf(kept).blocs.keys()][0];
  if (head) {
    const a = seriesOf(kept, `bloc:${head}`);
    assert.ok(
      a.some((l) => l.title === "People"),
      "an alliance's people over time",
    );
  }
});

test("the years thin as history's do, and the record stays small", () => {
  const s = store as YearsStore;
  for (const y of s.landYears) assert.equal(y % 10, 0);
  for (const r of s.realms.values())
    for (let i = 1; i < r.host.y.length; i++) assert.ok(r.host.y[i]! > r.host.y[i - 1]!);
  const bytes = JSON.stringify(s.save()).length;
  assert.ok(bytes < 400_000, `${bytes} bytes of years at year ${YEARS}`);
});
