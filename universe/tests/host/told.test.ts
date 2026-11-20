// A year told (host/inspect/told.ts), on a world of sixty years: every year distinct from the one before it, every line a way
// to a page, a quiet year still true, a year past living memory saying that less is remembered, nothing moved by the asking,
// and what is kept for it bounded.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EARTH } from "../../src/host/planet.ts";
import {
  TOLD_SPAN,
  toldAsk,
  toldBase,
  toldForget,
  toldKept,
  toldPage,
  yearTold,
} from "../../src/host/inspect/told.ts";
import { annalsRead, stretchesKept } from "../../src/host/inspect/annals.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { politiesOf, populationContext } from "../../src/sim/index.ts";
import { ALL_WORTH, type Line, type ToldItem, type YearTold } from "../../src/bridge/index.ts";
import { universeWorld } from "./worlds.ts";

const NOW = 60,
  world = universeWorld(EARTH, "first light", NOW),
  plain = (l: Line) => l.map((s) => (typeof s === "string" ? s : s.text)).join(""),
  leadOf = (t: YearTold) =>
    `${t.leads[0]!.headline}\n${t.leads[0]!.lines.map((l) => plain(l.line)).join("\n")}`,
  all: YearTold[] = [];
for (let y = 0; y <= NOW; y++) all.push(yearTold(world, { year: y }));
/** Every line of a telling. */
const linesOf = (t: YearTold): ToldItem[] => [
  ...t.leads.flatMap((l) => [...l.lines, ...l.before, ...l.after]),
  ...t.sections.flatMap((s) => s.items),
];

test("every year has a lead, and no year reads as the one before it", () => {
  for (const t of all) {
    assert.ok(t.leads.length >= 1, `year ${t.year} has no lead`);
    assert.ok(t.leads[0]!.headline.length > 8, `year ${t.year}: ${t.leads[0]!.headline}`);
    assert.ok(t.leads[0]!.lines.length >= 1);
  }
  for (let y = 1; y <= NOW; y++) {
    assert.notEqual(leadOf(all[y]!), leadOf(all[y - 1]!), `years ${y - 1} and ${y} read the same`);
    assert.notEqual(
      all[y]!.leads[0]!.headline,
      all[y - 1]!.leads[0]!.headline,
      `years ${y - 1} and ${y} have one headline`,
    );
  }
  // (And the years are mostly their own: a headline is not said of many years.)
  const heads = new Set(all.map((t) => t.leads[0]!.headline));
  assert.ok(heads.size >= NOW * 0.9, `${heads.size} headlines over ${NOW + 1} years`);
});

test("no line shows a kind of event or a ref, and a headline is short enough to be one", () => {
  for (const t of all) {
    for (const l of linesOf(t)) {
      const words = plain(l.line);
      assert.doesNotMatch(words, /\b(ev|dec|cmd|pol|cell|town|war):\d/, `year ${t.year}: ${words}`);
      assert.doesNotMatch(words, /\b[a-z]+\.[a-z]+(-[a-z]+)* for /, `year ${t.year}: ${words}`);
      assert.doesNotMatch(words, /score [\d.]+ against/, `year ${t.year}: ${words}`);
    }
    for (const lead of t.leads) assert.ok(lead.headline.length <= 96, lead.headline);
    for (const s of t.sections) assert.doesNotMatch(plain(s.text), /undefined|NaN/);
  }
});

test("every line opens a page, and every name in it one of its own", () => {
  let lines = 0,
    names = 0;
  const seen = new Set<string>();
  const opens = (ref: string, what: string) => {
    if (seen.has(ref)) return;
    seen.add(ref);
    const page = pageOf(world, ref);
    assert.notEqual(page.kind, "unknown", `${what}: ${ref} opens nothing`);
    assert.ok(page.title.length > 0);
  };
  // (A year in three: a page is read whole to say it opens.)
  for (const t of all.filter((x) => x.year % 3 === 0)) {
    for (const l of linesOf(t)) {
      if (l.ref) {
        lines++;
        opens(l.ref, `year ${t.year} "${plain(l.line).slice(0, 60)}"`);
      }
      for (const s of l.line)
        if (typeof s !== "string") {
          names++;
          opens(s.ref, `year ${t.year} name "${s.text}"`);
        }
    }
    for (const f of t.figures) if (f.ref) opens(f.ref, `year ${t.year} figure ${f.label}`);
  }
  assert.ok(lines > 100, `${lines} lines`);
  assert.ok(names > 100, `${names} names`);
});

test("a section is shown only with something in it, and tells what the Years tell", () => {
  let shown = 0;
  for (const t of all) {
    const ids = t.sections.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const s of t.sections) {
      shown++;
      assert.ok(
        s.items.length > 0 || s.text.length > 0 || s.more > 0,
        `${t.year} ${s.id} is empty`,
      );
      assert.ok(s.items.length <= 4);
    }
  }
  assert.ok(shown > NOW * 2, `${shown} sections over ${NOW + 1} years`);
  // What the Years tell of a year with no filter is on its page: in its lead or in a section.
  for (const y of [20, 33, 47, 58]) {
    const told = annalsRead(world, [y])[0],
      page = linesOf(all[y]!).map((l) => plain(l.line));
    for (const line of told?.lines.filter((l) => l.worth >= ALL_WORTH).slice(0, 2) ?? []) {
      const words = plain(line.line);
      assert.ok(
        page.some((p) => p.includes(words.slice(0, 40))),
        `year ${y}: the Years tell "${words}" and its page does not`,
      );
    }
  }
});

test("a quiet year still tells something true", () => {
  // The quietest of them: the fewest lines the Years would stop for.
  const quiet = all
    .filter((t) => t.year >= 2 && t.year < NOW)
    .sort(
      (a, b) =>
        a.sections.reduce((n, s) => n + s.items.length, 0) -
        b.sections.reduce((n, s) => n + s.items.length, 0),
    )[0]!;
  assert.ok(quiet.leads[0]!.lines.length >= 1);
  assert.ok(quiet.figures.length >= 2, "a quiet year has its numbers");
  // Its people's number is the sum of its lands' in that year, as the population's own history keeps them.
  const ctx = populationContext(world);
  let people = 0;
  for (const p of ctx.provinces.all())
    people += ctx.history.yearsOf(p.cell).find((l) => l.year === quiet.year)?.population ?? 0;
  const said = quiet.figures.find((f) => f.id === "people")!;
  assert.equal(said.points.at(-1)!.x, quiet.year);
  assert.equal(said.points.at(-1)!.y, people);
  // And where its lead says how the number moved, it moved so.
  const moved = /people (grew|fell) by ([\d,.]+)( million| billion)? to/.exec(leadOf(quiet));
  if (moved) {
    const before = said.points.find((q) => q.x === quiet.year - 1)!.y;
    assert.equal(moved[1], people > before ? "grew" : "fell");
  }
});

test("a year past living memory says plainly that less is remembered; a year just lived does not", () => {
  const old = all[5]!,
    young = all[NOW - 3]!;
  assert.ok(old.less, "year 5 of 60 says nothing of what was let go");
  assert.match(plain(old.less!), /less is remembered/);
  assert.match(plain(old.less!), /55 years gone/);
  assert.equal(young.less, null);
  // (Asked past the world's end or before its beginning, it tells the nearest year it has.)
  assert.equal(yearTold(world, { year: 9999 }).year, NOW);
  assert.equal(yearTold(world, { year: -5 }).year, 0);
});

test("a realm's year is its own: fewer things, all of them its own or in its lands", () => {
  const realm = politiesOf(world)
    .all()
    .filter((r) => r.ended === null && r.founded < NOW - 20)
    .sort((a, b) => b.members.length - a.members.length)[0]!;
  let own = 0;
  for (let y = NOW - 20; y <= NOW; y++) {
    const t = yearTold(world, { year: y, realm: realm.ref }),
      w = all[y]!;
    assert.equal(t.subject?.ref, realm.ref);
    assert.ok(t.leads.length >= 1);
    const mine = t.sections.reduce((n, s) => n + s.items.length + s.more, 0),
      whole = w.sections.reduce((n, s) => n + s.items.length + s.more, 0);
    assert.ok(mine <= whole, `year ${y}: more is told of one realm than of the world`);
    own += mine;
    assert.ok(t.map?.focus && t.map.focus.length > 0, `year ${y}: its map has no lands of its own`);
  }
  assert.ok(own > 0, "twenty years of the greatest realm tell nothing of it");
  // Its page stands, and a realm that never was is the world's.
  assert.equal(pageOf(world, `told:${NOW}:${realm.ref}`).kind, "year");
  assert.equal(yearTold(world, { year: NOW, realm: "pol:0:999999" }).subject, null);
});

test("a decade is told by its years' leads, ranked, each year a way in", () => {
  const t = yearTold(world, { year: 40, to: 49 });
  assert.equal(t.year, 40);
  assert.equal(t.to, 49);
  assert.ok(t.leads.length >= 1 && t.leads.length <= 3);
  assert.ok(t.years.length >= 8, `${t.years.length} of its ten years have a lead`);
  for (let i = 1; i < t.years.length; i++) assert.ok(t.years[i - 1]!.worth >= t.years[i]!.worth);
  // Its first lead is its greatest year's own.
  assert.ok(t.leads[0]!.headline.startsWith(`${t.years[0]!.year}: `));
  assert.equal(t.years[0]!.headline, all[t.years[0]!.year]!.leads[0]!.headline);
  // A run asked longer than is told at once is cut to it.
  assert.equal(toldAsk("told:0..5000")!.to, TOLD_SPAN - 1);
  assert.deepEqual(toldAsk("told:12:pol:0:3"), { year: 12, to: 12, realm: "pol:0:3" });
  assert.equal(pageOf(world, "told:40..49").kind, "year");
  assert.equal(toldPage(world, "told:40..49").tabs[0]!.blocks[0]!.type, "tool");
});

test("its map holds the year's lands and what changed in it", () => {
  const base = toldBase(world)!;
  assert.equal(base.lon.length, base.biome.length);
  for (const t of all.slice(10)) {
    const m = t.map!;
    assert.equal(m.base, base.key);
    assert.equal(m.lands.length, m.owner.length);
    for (const o of m.owner) assert.ok(o >= 0 && o < m.realms.length);
    for (const c of [...m.lands, ...m.gained, ...m.lost, ...m.marks.map((k) => k.cell)])
      assert.ok(c >= 0 && c < base.lon.length);
    for (const c of m.gained) assert.ok(m.lands.includes(c));
  }
  assert.ok(
    all.some((t) => t.map!.gained.length > 0),
    "no land ever changed hands on a map",
  );
  assert.ok(
    all.some((t) => t.map!.marks.length > 0),
    "nothing was ever marked on a map",
  );
});

test("asking moves nothing, what is kept is bounded, and a year comes quickly", () => {
  const before = JSON.stringify(world.domainHashes());
  const ms: number[] = [];
  for (let round = 0; round < 3; round++)
    for (let y = 0; y <= NOW; y++) {
      const t0 = performance.now();
      yearTold(world, { year: y, ...(round === 1 ? { to: y + 9 } : {}) });
      ms.push(performance.now() - t0);
    }
  assert.equal(JSON.stringify(world.domainHashes()), before);
  assert.ok(toldKept(world) <= 16, `${toldKept(world)} tellings kept`);
  assert.ok(stretchesKept(world) <= 10, `${stretchesKept(world)} stretches kept`);
  // Its page shut, nothing is kept.
  toldForget(world);
  assert.equal(toldKept(world), 0);
  assert.equal(stretchesKept(world), 0);
  ms.sort((a, b) => a - b);
  // (A year already read is its telling handed back; one not kept is read again from its stretch.)
  assert.ok(ms[ms.length >> 1]! < 50, `median ${ms[ms.length >> 1]!.toFixed(1)} ms`);
  assert.ok(
    ms[Math.floor(ms.length * 0.95)]! < 150,
    `p95 ${ms[Math.floor(ms.length * 0.95)]!.toFixed(1)} ms`,
  );
});
