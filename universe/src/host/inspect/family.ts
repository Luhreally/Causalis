// A family's page (asked 2026-11-16: "id also like to pin familes if possible too"): a realm's great house (round H) — who heads
// it, who of it history names, what it holds and how it stands, what has passed in it, how its hold ended — and a town's line —
// who holds it now, who held it before, its house, what befell them. Each can be followed and kept on the people bar, where it
// stands as its head. Pure reads of the houses store and the town's roster (host/family.ts).
import type { HistoryEvent, Ref, World } from "../../kernel/index.ts";
import {
  parseTownsfolkRef,
  type Block,
  type Item,
  type PageModel,
  type Stat,
} from "../../bridge/index.ts";
import { grainSum } from "../../causal/index.ts";
import { courtOf, originOf, politiesOf } from "../../sim/index.ts";
import { courtFigure, courtRef } from "../court.ts";
import { deathWords, rulerDeath } from "../death.ts";
import { realmColor } from "../colors.ts";
import {
  houseMembers,
  houseNews,
  houseOf,
  houseOfName,
  houseRef,
  lineEvents,
  lineMembers,
  lineOf,
  lineRef,
  type FamilyMember,
} from "../family.ts";
import { claimOf, count, item, link, many, part, share, stat, yearAt, yearNow } from "./words.ts";
import { landLink, realmLink, townLink } from "./names.ts";

/** Whence a house rose, in words. */
const FROM: Readonly<Record<string, string>> = {
  crown: "the ruler's family",
  "the court": "the court",
  "the army": "the army",
  "the temple": "the temple",
  traders: "the traders",
  crafters: "the crafters",
  farmers: "landholders",
  herders: "herd-holders",
  demagogue: "a demagogue risen on grievance",
  grifter: "a grifter risen on the skim",
  cadet: "a younger line of an estate parted",
};
/** How a hold ended, in words. */
const HOW: Readonly<Record<string, string>> = {
  purged: "purged by the crown",
  overthrown: "overthrown with the court",
  wed: "wed into",
  "died out": "died out, no heir left",
  faded: "faded from the great",
  exposed: "its grift found out",
};
/** The most of what has passed in a family a page lists. */
const PASSED = 12;

const th = (n: number) => share(n / 1000);
const grain = (n: number) => `${grainSum(Math.max(0, Math.round(n)))} grain's worth`;

/** Those of a family, each a link to their page. */
function membersBlock(title: string, members: readonly FamilyMember[]): Block {
  return {
    type: "list",
    title,
    items: members.map((m) => item([link(m.name, m.ref), `, ${m.role}`], m.ref)),
  };
}

/** What has passed in a family, newest first: the events that are its news. */
function passedItems(world: World, news: (e: HistoryEvent) => boolean, since: number): Item[] {
  const all = world.events.all(),
    out: Item[] = [];
  for (let i = all.length - 1; i >= 0 && out.length < PASSED; i--) {
    const e = all[i]!;
    if (yearAt(e.t) < since) break;
    if (!news(e)) continue;
    const y = yearAt(e.t);
    out.push(item([`Year ${y}: `, link(claimOf(world, e.id), e.id)], e.id, y));
  }
  return out;
}

/** A realm's great house's page, by the event it rose by (`dyn:<realm>:<event>`). */
export function dynastyPage(world: World, ref: string): PageModel {
  const h = houseOf(world, ref);
  if (!h) throw new Error(`no house ${ref}`);
  const year = yearNow(world),
    r = h.realm,
    rec = h.record,
    members = houseMembers(world, h),
    head = members[0] ?? null,
    origin = rec ? originOf(rec) : h.gone ? originOf(h.gone) : null,
    since = rec?.since ?? h.gone?.since ?? yearAt(world.events.get(h.event)?.t ?? world.now),
    of = rec?.of !== undefined ? h.houses.find((x) => x.id === rec.of) : undefined;
  const facts: Stat[] = [
    stat("Realm", [realmLink(world, r.ref)]),
    stat("Risen from", origin ? (FROM[origin] ?? origin) : "the court", { why: h.event }),
    stat("Since", `year ${since}`, { why: h.event }),
  ];
  if (of)
    facts.push(
      stat("A younger line of", [link(`the house of ${of.name}`, houseRef(r.ref, of.event))]),
    );
  if (rec) {
    facts.push(
      stat(
        "Head",
        head
          ? [link(head.name, head.ref), `, ${head.role}`]
          : `born year ${rec.headBorn}, named by no record`,
      ),
      stat("Seated in", [landLink(world, rec.seat)]),
      stat(
        "Its line",
        `${rec.titled ? "titled, " : ""}generation ${rec.generation}${rec.heirs ? `, ${many(rec.heirs, "heir", "heirs")} at the last death` : ""}`,
      ),
    );
    if (rec.crown) facts.push(stat("Holds", "the seat itself"));
  }
  if (h.gone)
    facts.push(
      stat(
        "Its hold ended",
        [
          `in year ${h.gone.year}, `,
          link(
            `${HOW[h.gone.how] ?? h.gone.how}${h.gone.into ? ` the house of ${h.gone.into}` : ""}`,
            h.gone.event,
          ),
        ],
        { why: h.gone.event },
      ),
    );
  const blocks: Block[] = [{ type: "facts", rows: facts }];
  if (members.length) blocks.push(membersBlock("Of it, as history names them", members));
  else
    blocks.push({
      type: "text",
      lines: [
        [
          rec
            ? "History keeps a house's wealth, its offices and its line's years, not the names of its people: none of it sits at court or on the seat now."
            : "Its hold has ended: history keeps how, and no more of its people.",
        ],
      ],
    });
  if (rec)
    blocks.push({
      type: "facts",
      title: "What it holds",
      rows: [
        stat("Wealth", grain(rec.wealth), { parts: [part("taken in a year", grain(rec.income))] }),
        stat("Power", `${th(rec.power)} of the great houses' wealth and offices`),
        stat("Offices", th(rec.offices)),
        ...(rec.land ? [stat("Of its land's rent", th(rec.land))] : []),
        ...(rec.grants || rec.farm
          ? [stat("Licences · customs", `${th(rec.grants)} · ${th(rec.farm)}`)]
          : []),
      ],
    });
  // (Its dead, as history keeps them, and how each died: its rulers' reigns ended, those of its name gone from court. Asked 2026-11-16.)
  const dead = houseDead(world, h);
  if (dead.length) blocks.push({ type: "list", title: "Its dead", items: dead });
  const passed = passedItems(world, houseNews(world, h), since);
  blocks.push(
    passed.length
      ? { type: "list", title: "What has passed in it", items: passed }
      : {
          type: "text",
          title: "What has passed in it",
          lines: [["Nothing yet that history tells."]],
        },
  );
  return {
    ref: h.ref,
    kind: "family",
    icon: rec?.crown ? "👑" : rec ? "🏰" : "🕯️",
    title: `The house of ${h.name}`,
    subtitle: [
      rec ? (rec.crown ? "The ruling house of " : "A great house of ") : "Once a great house of ",
      realmLink(world, r.ref),
    ],
    color: realmColor(r.ref),
    place: rec ? { scale: "region", cell: rec.seat } : null,
    stats: [
      ...(head ? [stat("Head", [link(head.name, head.ref)])] : []),
      stat("Since", `year ${since}`),
      ...(rec ? [stat("Generation", count(rec.generation)), stat("Power", th(rec.power))] : []),
    ],
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year,
  };
}

/** A town's line's page (`line:<town>:<line>`): who holds it now, who held it before, what befell them. */
export function linePage(world: World, ref: string): PageModel {
  const l = lineOf(world, ref);
  if (!l) throw new Error(`no line ${ref}`);
  const year = yearNow(world),
    members = lineMembers(l),
    head = l.holder ? members[0]! : null,
    own = lineEvents(l),
    since = l.before.at(-1)?.from ?? l.holder?.from ?? year;
  const blocks: Block[] = [
    {
      type: "facts",
      rows: [
        stat("Town", [townLink(world, l.town)]),
        stat("House", `the ${l.house}, whose home's lines share the name`),
        stat(
          "Head",
          head && l.holder
            ? [link(head.name, head.ref), `, since year ${l.holder.from}`]
            : "no one: it stands empty",
        ),
      ],
    },
    membersBlock("Of it, as history names them", members),
    {
      type: "text",
      lines: [
        [
          `One of every twelve of ${l.townName}'s people is kept by name, the holder of a line: the line stands for them and their kin, and passes to a child, a brother or a sister, or another of the house.`,
        ],
      ],
    },
  ];
  const passed = passedItems(world, (e) => own.has(e.id), since);
  if (passed.length) blocks.push({ type: "list", title: "What befell them", items: passed });
  return {
    ref: lineRef(l.town, l.line),
    kind: "family",
    icon: "🌳",
    title: `The ${l.house} line`,
    subtitle: ["A line of ", townLink(world, l.town)],
    color: null,
    place: { scale: "village", town: l.town },
    stats: [
      ...(head ? [stat("Head", [link(head.name, head.ref)])] : []),
      stat("Held", many(members.length, "holder named", "holders named")),
    ],
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year,
  };
}

/** The family a person's page is of, where they are of one history keeps: a ruler's or a courtier's house, a townsman's line. */
function familyOfPerson(world: World, ref: string): { ref: string; name: string } | null {
  if (ref.startsWith("rule:")) {
    const r = politiesOf(world).get(ref.slice("rule:".length) as Ref),
      h = r && r.ended === null ? houseOfName(world, r.ref, r.ruler.name) : null,
      read = h ? houseOf(world, h) : null;
    return read ? { ref: read.ref, name: `the house of ${read.name}` } : null;
  }
  if (ref.startsWith("court:")) {
    const at = courtFigure(world, ref),
      h = at?.f ? houseOfName(world, at.r.ref, at.f.name) : null,
      read = h ? houseOf(world, h) : null;
    return read ? { ref: read.ref, name: `the house of ${read.name}` } : null;
  }
  const at = parseTownsfolkRef(ref);
  if (!at) return null;
  const l = lineOf(world, lineRef(at.town, at.line));
  return l ? { ref: l.ref, name: `the ${l.house} line` } : null;
}

/** A person's page with a link to their family's own, first in its overview and its Family tab. */
export function withFamilyLink(world: World, ref: string, page: PageModel): PageModel {
  if (page.kind !== "person") return page;
  const f = familyOfPerson(world, page.ref.startsWith("folk:") ? page.ref : ref);
  if (!f) return page;
  const row: Block = {
    type: "facts",
    rows: [stat(f.ref.startsWith("line:") ? "Line" : "House", [link(f.name, f.ref)])],
  };
  return {
    ...page,
    // (And on their Family tab, over the tree: the family itself, to follow and keep.)
    tabs: page.tabs.map((t) =>
      t.id === "overview" || t.id === "family" ? { ...t, blocks: [row, ...t.blocks] } : t,
    ),
  };
}

/** The dead of a house history keeps: its rulers whose reigns ended in death, and those of its name who died at court. */
function houseDead(world: World, h: NonNullable<ReturnType<typeof houseOf>>): Item[] {
  const out: Item[] = [],
    surname = (n: string) => n.split(" ").slice(1).join(" ");
  for (const e of world.events.all()) {
    if (e.type !== "polity.succession" && e.type !== "court.seized") continue;
    if (!e.subjects.includes(h.realm.ref)) continue;
    const old = (e.data as { old?: string } | null)?.old;
    if (!old || surname(old) !== h.name) continue;
    const a = rulerDeath(world, e);
    if (a && a.cause !== "removed")
      out.push(
        item(
          [`${old}, who ruled: `, link(a.short, e.id), ` (${a.year})`],
          e.id,
          a.year ?? undefined,
        ),
      );
  }
  for (const g of courtOf(world)?.of(h.realm.ref)?.gone ?? []) {
    if (g.how !== "died" || surname(g.name) !== h.name) continue;
    const ref = courtRef(h.realm.ref, g.id),
      words = deathWords(world, ref);
    out.push(item([link(g.name, ref), `: ${words ?? `died in ${g.year}`}`], ref, g.year));
  }
  return out.sort((x, y) => (y.year ?? 0) - (x.year ?? 0)).slice(0, 24);
}
