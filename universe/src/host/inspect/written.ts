// A world's whole history written out (B1, classic 66): what goes in the file and the pages' own words for it, read in
// slices so the world never stands long. There is no second writer here: a realm, a war and a person are their pages' own
// title, facts and lists, cut to what can be carried; a year is what The Years tells with no filter. What the file can't
// carry is counted and said, in the file itself. Pure reads.
import type { Ref, World } from "../../kernel/index.ts";
import { courtOf, politiesOf, warsOf } from "../../sim/index.ts";
import {
  ALL_LINES,
  ALL_WORTH,
  ANNAL_ALL,
  type Line,
  type PageModel,
  type WrittenAsk,
  type WrittenEntry,
  type WrittenIndex,
  type WrittenYear,
} from "../../bridge/index.ts";
import { courtRef } from "../court.ts";
import { annalsIndex, annalsRead } from "./annals.ts";
import { pageOf } from "./index.ts";
import { claimOf, yearNow } from "./words.ts";

/** The most of each a file carries, and of a list within a thing. A file of these is about as much as a phone opens at ease, and a few minutes' reading on one. */
const MOST_REALMS = 800,
  MOST_WARS = 800,
  MOST_PEOPLE = 600,
  MOST_ITEMS = 8;

/** Which tabs of a page go in, by kind of thing. */
const TABS: Readonly<Record<string, readonly string[]>> = {
  realms: ["overview", "rulers", "wars"],
  wars: ["overview"],
  people: ["overview"],
};
/** The same, as a page takes them: a realm's dozen other tabs are most of what its page costs, and none of them is told here. */
const ONLY: Readonly<Record<string, ReadonlySet<string>>> = {
  realms: new Set(TABS.realms),
  wars: new Set(TABS.wars),
  people: new Set(TABS.people),
};
/** Their page's lines a reader of a file has no use for: what is only true while playing. */
const NOT_ROWS = new Set(["Family", "By your hand"]);

const counted = (n: number) => n.toLocaleString("en-US");

/** What goes in, what doesn't, and the sentences saying so. */
export function writtenIndex(world: World): WrittenIndex {
  const realms = politiesOf(world),
    all = realms.all(),
    wars = warsOf(world).all(),
    annals = annalsIndex(world),
    year = yearNow(world),
    worth = annals.years.filter((_, i) => annals.masks[i]! & ANNAL_ALL),
    // (The realms that stand, the greatest first, then the last to fall.)
    realmRefs = [...all]
      .sort(
        (a, b) =>
          Number(a.ended !== null) - Number(b.ended !== null) ||
          (b.ended ?? 0) - (a.ended ?? 0) ||
          b.members.length - a.members.length ||
          a.founded - b.founded ||
          (a.ref < b.ref ? -1 : 1),
      )
      .slice(0, MOST_REALMS)
      .map((r) => r.ref as string),
    // (The wars that killed the most, then in their order.)
    warRefs = [...wars]
      .map((w, i) => ({ w, i, dead: w.fallen[0] + w.fallen[1] }))
      .sort((a, b) => b.dead - a.dead || a.i - b.i)
      .slice(0, MOST_WARS)
      .sort((a, b) => a.i - b.i)
      .map((x) => x.w.ref as string),
    court = courtOf(world),
    people: string[] = [],
    standing = [...realms.living()].sort(
      (a, b) => b.members.length - a.members.length || (a.ref < b.ref ? -1 : 1),
    );
  let rulers = 0;
  for (const r of standing) {
    if (people.length >= MOST_PEOPLE) break;
    rulers++;
    people.push(`rule:${r.ref}`);
    const c = court?.of(r.ref);
    if (c?.heir !== null && c?.heir !== undefined && c.figures.some((f) => f.id === c.heir))
      people.push(courtRef(r.ref, c.heir));
    if (c?.rival !== null && c?.rival !== undefined && c.figures.some((f) => f.id === c.rival))
      people.push(courtRef(r.ref, c.rival));
  }
  const fallen = realmRefs.filter((ref) => realms.get(ref as Ref)?.ended !== null);
  let lastRulers = 0;
  for (const ref of fallen) {
    if (people.length >= MOST_PEOPLE) break;
    lastRulers++;
    people.push(`rule:${ref}`);
  }
  const left = [
    `A year here tells what The Years tells with no filter, at most ${ALL_LINES} lines of it; ${counted(annals.years.length - worth.length)} more years hold only lesser things, and the world's own log keeps those for a while and then forgets them.`,
    ...(all.length > realmRefs.length
      ? [
          standing.length > realmRefs.length
            ? `${counted(realmRefs.length)} of ${counted(all.length)} realms are told: the greatest of those that stand.`
            : `${counted(realmRefs.length)} of ${counted(all.length)} realms are told: those that stand and the last to fall.`,
        ]
      : []),
    ...(wars.length > warRefs.length
      ? [
          `${counted(warRefs.length)} of ${counted(wars.length)} wars are told: those that killed the most.`,
        ]
      : []),
    `The people told are those who rule ${rulers < standing.length ? "the greatest realms " : ""}now, their heirs and rivals${lastRulers ? ", and the last rulers of realms that fell" : ""}: ${counted(people.length)} of them. The town's many and those who sat at a court and left it are not.`,
    `Of a realm, a war or a person, the page's first facts and its first ${MOST_ITEMS} lines of a list are told. Towns, lands, faiths and tongues have no entry here, and their names are only words.`,
  ];
  return {
    title: world.seed.text,
    sub: `Its history, to year ${counted(year)}`,
    year,
    realms: realmRefs,
    wars: warRefs,
    people,
    years: worth,
    left,
  };
}

/** A page's own words, cut. */
function entryOf(
  world: World,
  ref: string,
  tabs: readonly string[],
  only: ReadonlySet<string>,
): WrittenEntry {
  const page: PageModel = pageOf(world, ref, undefined, true, only),
    rows: { label: string; value: Line }[] = [],
    lists: { title: string; items: Line[]; more: number }[] = [];
  const said = new Set<string>();
  const row = (label: string, value: Line) => {
    if (NOT_ROWS.has(label) || said.has(label)) return;
    said.add(label);
    rows.push({ label, value });
  };
  for (const s of page.stats) row(s.label, s.value);
  for (const tab of tabs) {
    const t = page.tabs.find((x) => x.id === tab);
    if (!t) continue;
    for (const b of t.blocks) {
      if (b.type === "facts" && tab === "overview") for (const r of b.rows) row(r.label, r.value);
      if (b.type === "list" && b.items.length) {
        const items = b.items.slice(0, MOST_ITEMS).map((i) => i.line);
        lists.push({
          title: b.title ?? t.name,
          items,
          more: b.items.length - items.length + (b.more ?? 0),
        });
      }
      if (b.type === "why" && tab === "overview") row(b.title ?? "Why", [claimOf(world, b.ref)]);
    }
  }
  return { ref: page.ref, title: page.title, sub: page.subtitle, rows, lists };
}

/** The year's lines The Years tells with no filter. */
function yearsOf(world: World, years: readonly number[]): WrittenYear[] {
  return annalsRead(world, years).map((y) => {
    const told = y.lines.filter((l) => l.worth >= ALL_WORTH).slice(0, ALL_LINES);
    return { year: y.year, lines: told.map((l) => l.line), events: told.map((l) => l.ref) };
  });
}

/** A slice of the file. */
export function writtenRead(
  world: World,
  ask: WrittenAsk,
): readonly WrittenEntry[] | WrittenYear[] {
  if (ask.kind === "years") return yearsOf(world, ask.years);
  return ask.refs.map((ref) => entryOf(world, ref, TABS[ask.kind]!, ONLY[ask.kind]!));
}
