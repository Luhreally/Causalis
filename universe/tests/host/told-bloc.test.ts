// An alliance's years told (host/inspect/told-bloc.ts, told.ts), on a world of 125 years: every year of its life a lead and no
// headline said of two of them, its realms at each year's end those the years kept of each realm say, every coming-in a realm
// that came in, read with its cause; its decade and century read as its arc; its Years told on its own page; a realm's year
// and its alliance's each a way to the other; and nothing moved by the asking.
import { test } from "node:test";
import assert from "node:assert/strict";
import { type Ref } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { toldAsk, toldList, toldPage, yearTold } from "../../src/host/inspect/told.ts";
import { alliancesOf } from "../../src/host/inspect/ties.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { logAt, yearsOf } from "../../src/host/years.ts";
import { politiesOf } from "../../src/sim/index.ts";
import type { Line, YearTold } from "../../src/bridge/index.ts";
import { universeWorld } from "./worlds.ts";

const NOW = 125,
  world = universeWorld(EARTH, "first light", NOW),
  plain = (l: Line) => l.map((s) => (typeof s === "string" ? s : s.text)).join(""),
  store = yearsOf(world)!,
  realms = politiesOf(world);
// The longest-standing alliance now, and every year its head realm stood in one.
const a = [...alliancesOf(world)].sort(
    (x, z) => (x.since ?? NOW) - (z.since ?? NOW) || z.members.length - x.members.length,
  )[0]!,
  subject = `bloc:${a.head}`,
  headLog = store.realms.get(a.head)!;
/** The head an alliance's head realm stood under, read here from the years kept (now: as it stands). */
const headAt = (y: number) =>
  y >= NOW ? a.head : y < headLog.first ? "" : (logAt(headLog.bloc, y) ?? "");
/** Its realms as a year closed, read here: those whose kept alliance was its then. */
const membersAt = (y: number): string[] => {
  if (y >= NOW) return [...a.members];
  const h = headAt(y);
  if (!h) return [];
  const out: string[] = [];
  for (const [ref, l] of store.realms) {
    const p = realms.get(ref as Ref);
    if (!p || p.founded > y || (p.ended !== null && y >= p.ended) || y < l.first) continue;
    if (logAt(l.bloc, y) === h) out.push(ref);
  }
  return out.length >= 2 ? out : [];
};
const stood: number[] = [];
for (let y = headLog.first; y <= NOW; y++) if (membersAt(y).length) stood.push(y);
const told = new Map<number, YearTold>(
  stood.map((y) => [y, yearTold(world, { year: y, realm: subject })]),
);

test("an alliance's every year has a lead, and no headline is said of two of its years", () => {
  assert.ok(stood.length >= 10, `its head stood in an alliance ${stood.length} years`);
  const heads = new Map<string, number>();
  for (const [y, t] of told) {
    assert.equal(t.subject?.ref, subject);
    assert.ok(t.leads.length >= 1, `year ${y} has no lead`);
    const h = t.leads[0]!.headline;
    assert.ok(h.length > 8 && h.length <= 118, `year ${y}: ${h}`);
    assert.ok(!heads.has(h), `years ${heads.get(h)} and ${y} have one headline: ${h}`);
    heads.set(h, y);
    for (const s of t.sections) assert.doesNotMatch(plain(s.text), /undefined|NaN|\bpol:\d/);
  }
});

test("its realms at each year's end are those the years kept say, and each coming-in is one", () => {
  let came = 0;
  for (const [y, t] of told) {
    const want = membersAt(y),
      sec = t.sections.find((s) => s.id === "bloc");
    assert.ok(sec, `year ${y}: no section of its own`);
    const words = plain(sec.text),
      n = /^(\w+) realms stood in it/.exec(words)?.[1];
    const said = "no one two three four five six seven eight nine ten eleven twelve"
      .split(" ")
      .indexOf(n!.toLowerCase());
    assert.equal(
      said >= 0 ? said : Number(n),
      want.length,
      `year ${y}: "${words}" against ${want.length}`,
    );
    // Every realm it names in its first sentence by a link is one of them, and each link opens that realm's year.
    const links = sec.text.filter((s): s is { text: string; ref: string } => typeof s !== "string");
    for (const l of links.slice(0, 1 + want.length))
      if (l.ref.startsWith("told:")) {
        const realm = l.ref.split(":").slice(2).join(":");
        assert.ok(want.includes(realm), `year ${y}: ${l.text} (${realm}) did not stand in it`);
        assert.equal(Number(l.ref.split(":")[1]), y);
      }
    // A coming-in: one who stood in it this year and not the year before, with what bound it if history holds it.
    for (const item of [...t.leads.flatMap((x) => x.lines), ...sec.items]) {
      const m = /^(.+?) came into the alliance of/.exec(plain(item.line));
      if (!m) continue;
      const ref = (item.line[0] as { ref?: string }).ref?.split(":").slice(2).join(":");
      assert.ok(ref && want.includes(ref), `year ${y}: ${m[1]} is not of it`);
      assert.ok(
        !membersAt(y - 1).includes(ref!) || headAt(y - 1) !== headAt(y),
        `year ${y}: ${m[1]} was in it already`,
      );
      const e = item.ref?.startsWith("ev:") ? world.events.get(item.ref as Ref) : undefined;
      if (e)
        assert.ok(e.subjects.includes(ref as Ref), `year ${y}: its cause does not name ${m[1]}`);
      came++;
    }
  }
  assert.ok(came >= 1, "no realm ever came into it");
});

test("a decade and a century are read as its arc, each piece a way to its year", () => {
  const first = stood[0]!,
    d = Math.floor(first / 10) * 10,
    decade = yearTold(world, { year: d, to: d + 9, realm: subject }),
    century = yearTold(world, { year: 0, to: 99, realm: subject });
  for (const t of [decade, century]) {
    assert.ok(t.leads.length >= 1 && t.leads.length <= 3, `${t.leads.length} leads`);
    const arc = t.leads[0]!;
    assert.ok(arc.headline.length > 8 && arc.headline.length <= 118, arc.headline);
    assert.match(arc.headline, /\d/);
    assert.ok(arc.lines.length >= 1);
  }
  // The decade it first stood in says it formed or came in then.
  assert.match(decade.leads[0]!.headline, /Formed in|realms in/);
  assert.equal(decade.subject?.ref, subject);
  assert.ok(century.years.length >= 1);
  // A run's lead alone (a long run is read a piece at a time) is its arc too.
  const lead = yearTold(world, { year: 0, to: 99, realm: subject, lead: true });
  assert.equal(lead.leads[0]!.headline, century.leads[0]!.headline);
  assert.equal(lead.sections.length, 0);
});

test("its map holds its realms' lands, coloured by when each came in, and its foes", () => {
  for (const [y, t] of told) {
    const m = t.map;
    assert.ok(m, `year ${y}: no map`);
    assert.equal(m.lands.length, m.owner.length);
    assert.ok(m.focus && m.focus.length > 0);
    assert.ok(m.key && m.key.length >= 1);
    const mine = new Set(membersAt(y));
    for (const c of m.focus) {
      const holder = y >= NOW ? realms.of(c)?.ref : logAt(store.landRealm.get(c), y);
      assert.ok(holder && mine.has(holder), `year ${y}: land ${c} is none of its realms'`);
    }
  }
});

test("its own page lists its years told, and a realm's year and its alliance's lead to each other", () => {
  const page = pageOf(world, subject),
    tab = page.tabs.find((x) => x.id === "years");
  assert.ok(tab, "its page has no Years told");
  assert.ok(tab.blocks.some((b) => b.type === "tool" && b.tool === "told.list"));
  const list = toldList(world, { subject });
  assert.ok(list.years.length >= 10);
  for (let i = 1; i < list.years.length; i++)
    assert.ok(list.years[i - 1]!.year > list.years[i]!.year);
  for (const y of list.years)
    if (told.has(y.year) && y.year < NOW)
      assert.equal(y.headline, told.get(y.year)!.leads[0]!.headline);
  // Its head realm's year points to its alliance's; its alliance's to its head's.
  const y = stood.at(-1)!,
    mine = yearTold(world, { year: y, realm: a.head });
  assert.ok(
    mine.also?.some((x) => x.ref === `told:${y}:${subject}`),
    JSON.stringify(mine.also),
  );
  assert.ok(told.get(y)!.also?.some((x) => x.ref === `told:${y}:${a.head}`));
  assert.deepEqual(toldAsk(`told:12:${subject}`), { year: 12, to: 12, realm: subject });
  assert.match(toldPage(world, `told:${y}:${subject}`).title, /its year$/);
  // An alliance that never was is the world's.
  assert.equal(yearTold(world, { year: y, realm: "bloc:pol:0:999999" }).subject, null);
});

test("asking moves nothing, and an alliance's year comes quickly", () => {
  const before = JSON.stringify(world.domainHashes()),
    ms: number[] = [];
  for (const y of stood.slice(-30)) {
    const t0 = performance.now();
    yearTold(world, { year: y, realm: subject });
    ms.push(performance.now() - t0);
  }
  toldList(world, { subject });
  assert.equal(JSON.stringify(world.domainHashes()), before);
  ms.sort((x, z) => x - z);
  assert.ok(ms[ms.length >> 1]! < 60, `median ${ms[ms.length >> 1]!.toFixed(1)} ms`);
});
