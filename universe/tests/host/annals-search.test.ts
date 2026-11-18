// The Years' search on the host (2026-11-16): the whole log read for what is asked, the minor events the annals
// leave out among them, a page at a time, on a world of forty years.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EARTH } from "../../src/host/planet.ts";
import { annalsNames, annalsSearch } from "../../src/host/inspect/annals-search.ts";
import { annalsIndex, annalsRead } from "../../src/host/inspect/annals.ts";
import { why } from "../../src/causal/index.ts";
import { yearOfMoment, type HistoryEvent } from "../../src/kernel/index.ts";
import {
  fold,
  holds,
  holdsWhole,
  parseAsk,
  type AnnalsFound,
  type AnnalsSearchArgs,
} from "../../src/bridge/index.ts";
import { universeWorld } from "./worlds.ts";

const world = universeWorld(EARTH, "first light", 40);
const events: HistoryEvent[] = [];
for (let i = 0; i < world.events.count; i++) events.push(world.events.at(i));
let sitting = 1;
const search = (text: string, more: Partial<AnnalsSearchArgs> = {}): AnnalsFound =>
  annalsSearch(world, { ...parseAsk(text), session: sitting, newest: true, ...more });
const refsOf = (r: AnnalsFound) => r.years.flatMap((y) => y.lines.map((l) => l.ref));
const typeOf = (ref: string) => world.events.get(ref as HistoryEvent["id"])!.type;
/** Every page of a search, read on to its end. */
function allPages(text: string, newest: boolean, limit: number) {
  const refs: string[] = [],
    years: number[] = [];
  let after: number | null = null,
    pages = 0;
  for (;;) {
    const r = search(text, { newest, limit, after });
    pages++;
    for (const y of r.years) for (const l of y.lines) (refs.push(l.ref), years.push(y.year));
    assert.ok(refsOf(r).length <= limit);
    if (r.next === null) break;
    after = r.next;
    assert.ok(pages < 1000);
  }
  return { refs, years, pages };
}

test("the test world has a history to search", () => {
  assert.ok(events.length > 2000, `${events.length} events`);
  // (A sitting's first reading of every event's words may stop at its time on a slow machine, and say so; read on
  // until the sitting has them all, so what follows counts whole.)
  let warm = 0;
  while (!search("zzqxv").whole) assert.ok(++warm < 100, "the words never all read");
});

const KIND = "settlement.market";
test("a kind of event is found whole, in order, page by page, both ways", () => {
  // (Market towns: some 410 by year 40. It asked for cities, of which the world before the society sweep had 317 by then, a
  // market town of a thousand in three lands of five while 1.5 million lived on the whole globe; towns grow to that later now:
  // 6 by year 40, 45 to 52 by 60, some 220 by 100 (scratchpad/release/cf.mts).)
  const want = events.filter((e) => e.type === KIND).map((e) => e.id);
  assert.ok(want.length > 100, `${want.length} market towns`);
  const first = search(`kind:${KIND}`, { limit: 50 });
  assert.equal(first.matched, want.length);
  assert.ok(first.whole);
  assert.equal(refsOf(first).length, 50);
  assert.notEqual(first.next, null);
  const back = allPages(`kind:${KIND}`, true, 23);
  assert.deepEqual(back.refs, [...want].reverse());
  assert.equal(back.pages, Math.ceil(want.length / 23));
  const on = allPages(`kind:${KIND}`, false, 50);
  assert.deepEqual(on.refs, want);
  // (Each year's lines in one group, years in the order asked.)
  for (let i = 1; i < on.years.length; i++) assert.ok(on.years[i]! >= on.years[i - 1]!);
  const r = search(`kind:${KIND}`, { limit: 100 });
  assert.equal(new Set(r.years.map((y) => y.year)).size, r.years.length);
  // (No page holds more than a hundred lines, whatever it asks.)
  assert.equal(search(`kind:${KIND}`, { limit: 5000 }).years.flatMap((y) => y.lines).length, 100);
});

test("words match without case or accents, in part, and reach what the annals leave out", () => {
  // (Smuggling is what money.smuggling is called; its words are of goods slipped past borders.)
  const want = events.filter(
    (e) => e.type === "money.smuggling" || holds(fold(why(world, e.id).claim), "smuggling"),
  );
  assert.ok(want.length > 5, `${want.length} smuggled`);
  const r = search("smuggling", { limit: 100 });
  assert.equal(r.matched, want.length);
  assert.ok(refsOf(r).every((ref) => typeOf(ref) === "money.smuggling"));
  for (const t of ["SMUGGLING", "Smúggling", "smugg", "Smuggling,"])
    assert.equal(search(t, { limit: 100 }).matched, want.length, t);
  assert.ok(r.terms.includes("smuggling"));
  // (Too small for the annals: none of these lines is in the Years, and each says so.)
  const told = new Set(
    annalsRead(world, annalsIndex(world).years).flatMap((y) => y.lines.map((l) => l.ref)),
  );
  assert.ok(r.years.every((y) => y.lines.every((l) => l.minor && !told.has(l.ref))));
  assert.ok(search("famine", { limit: 5 }).matched > 0);
  assert.equal(search("zzqxv").matched, 0);
  assert.ok(search("zzqxv").whole);
});

test("every free word must answer, each in the words, the kind or the names", () => {
  const two = search("city tropical", { limit: 100 });
  assert.ok(two.matched > 0);
  for (const y of two.years)
    for (const l of y.lines) {
      const e = world.events.get(l.ref as HistoryEvent["id"])!,
        words = fold(why(world, e.id).claim);
      assert.ok(holds(words, "tropical"), words);
      assert.ok(holds(words, "city") || e.type.startsWith("city."), words);
    }
  assert.ok(two.matched <= search("city", { limit: 1 }).matched);
});

test("a year range, a rank, and both", () => {
  const want = events.filter((e) => {
    const y = yearOfMoment(e.t);
    return e.type === "settlement.founded" && y >= 10 && y <= 20;
  });
  assert.ok(want.length > 0);
  const r = search("kind:settlement.founded 10-20", { limit: 100 });
  assert.equal(r.matched, want.length);
  assert.ok(r.years.every((y) => y.year >= 10 && y.year <= 20));
  assert.equal(search("kind:settlement.founded from:10 to:20").matched, want.length);
  assert.equal(search("kind:settlement.founded year:10..20").matched, want.length);
  const one = search("15", { limit: 100 });
  assert.ok(one.matched > 0 && one.years.every((y) => y.year === 15));

  const wars = search("only wars", { limit: 100 });
  assert.ok(wars.matched > 0);
  assert.ok(wars.years.every((y) => y.lines.every((l) => l.kind === 0)));
  const sorrows = search("only:sorrows 30-40", { limit: 100 });
  assert.ok(sorrows.matched > 0);
  assert.ok(sorrows.years.every((y) => y.year >= 30 && y.lines.every((l) => l.kind === 2)));
  const firsts = search("only firsts", { limit: 10 });
  assert.ok(firsts.years.every((y) => y.lines.every((l) => l.kind === 1)));
});

test("a name filter finds what names the thing, or says its name", () => {
  const realms = annalsNames(world, {
    session: sitting,
    text: "commonwealth",
    key: "realm",
    most: 4,
  });
  assert.ok(realms.length > 0);
  assert.ok(realms.every((n) => n.key === "realm" && n.ref?.startsWith("pol:")));
  const realm = realms[0]!,
    r = search(`realm:"${realm.name}"`, { limit: 100 });
  assert.ok(r.matched > 0, realm.name);
  for (const y of r.years)
    for (const l of y.lines) {
      const e = world.events.get(l.ref as HistoryEvent["id"])!,
        town = realm.name.split(" of ").pop()!;
      assert.ok(
        e.subjects.includes(realm.ref as HistoryEvent["id"]) ||
          holdsWhole(fold(why(world, e.id).claim), fold(town)) ||
          holdsWhole(fold(why(world, e.id).claim), fold(realm.name)),
        why(world, e.id).claim,
      );
    }
  // Tapped: the very thing, by its ref.
  const tapped = annalsSearch(world, {
    words: [],
    filters: [{ key: "realm", value: realm.name, ref: realm.ref! }],
    only: [],
    from: null,
    to: null,
    session: sitting,
    newest: true,
    limit: 100,
  });
  assert.ok(tapped.matched > 0);
  const byRef = events.filter((e) => e.subjects.includes(realm.ref as HistoryEvent["id"]));
  assert.ok(tapped.matched >= byRef.length);

  // A town by part of its name, with a word.
  const towns = annalsNames(world, { session: sitting, text: "ci", most: 24 });
  assert.ok(towns.length <= 24);
  const town = annalsNames(world, {
    session: sitting,
    text: realm.name.split(" of ").pop()!,
    key: "town",
  })[0];
  assert.ok(town, "the seat's town is a name");
  assert.ok(search(`town:${town!.name}`).matched > 0);
  // A name that is nothing in the world is looked for in the words.
  assert.equal(search("town:Zzqxv").matched, 0);
});

test("suggestions are the world's own names, the best first, of one key when asked", () => {
  const any = annalsNames(world, { session: sitting, text: "kr", most: 8 });
  assert.ok(any.length > 0 && any.length <= 8);
  assert.ok(any.every((n) => holds(fold(n.name + " " + n.title), "kr") || n.key === "realm"));
  const kinds = annalsNames(world, { session: sitting, text: "cartel", key: "kind" });
  assert.equal(kinds[0]?.name, "money.cartel");
  assert.equal(kinds[0]?.title, "A cartel");
  assert.deepEqual(annalsNames(world, { session: sitting, text: "k" }), []);
});

test("nothing asked is nothing found, and a sitting's names are read once", () => {
  const r = search("   ");
  assert.equal(r.matched, 0);
  assert.equal(r.scanned, 0);
  sitting++;
  const t0 = performance.now();
  search("cartel");
  const cold = performance.now() - t0,
    t1 = performance.now();
  const warm = search("plague");
  const ms = performance.now() - t1;
  assert.ok(warm.whole);
  console.log(
    `# ${events.length} events: a first search of a sitting ${cold.toFixed(0)} ms, then ${ms.toFixed(1)} ms`,
  );
});
