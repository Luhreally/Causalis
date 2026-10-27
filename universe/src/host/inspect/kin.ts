// A person's family and body on their page (Phase 55 wave 5; asked for 2026-10-27: "i cant click on
// the soldiers on the field and see they family and anatomy etc in town vieww"): every page of one
// of the town's people — a line holder's, a levy man's, a maker's or the healer's, a person met's,
// one of the hand's — gets the same two tabs by the same rules, so a soldier's page and a smith's
// are one kind of page. Family: their kin as host/kin.ts reads them (a person met's and the hand's
// keep their own household's tree). Body: their people's plan, each member as it is now, every
// wound with where, when, by what arm, who tended it and what it leaves them able to do, the blow
// that killed, and the body drawn. Their overview opens with the card's two lines. Read from the
// record alone: reading a page never moves history.
import type { Ref, World } from "../../kernel/index.ts";
import { OCC, article } from "../../rules/index.ts";
import { lifeOf, populationContext } from "../../sim/index.ts";
import {
  STATE_WORDS,
  ableWords,
  bodyAt,
  bodyLine,
  deathWords,
  memberWords,
  parseSeatRef,
  woundLookAt,
  woundWords,
  type Block,
  type BodyFrame,
  type BodyNow,
  type Item,
  type PageModel,
  type Portrait,
  type Stat,
  type Tab,
  type Wound,
} from "../../bridge/index.ts";
import {
  bodyOf,
  familyLine,
  familyOf,
  kinCard,
  seatHolder,
  toldAt,
  type BodyRead,
  type Family,
  type Kin,
} from "../kin.ts";
import { landEra, peopleBody } from "../village.ts";
import { townLink } from "./names.ts";
import { item, link, many, stat } from "./words.ts";
import { bodyMatter } from "../biochem.ts";

/** A seat's trade's sign on its page. */
const TRADE_ICON: Readonly<Record<string, string>> = {
  smith: "🔨",
  potter: "🏺",
  weaver: "🧵",
  founder: "🔥",
  machinist: "⚙️",
};
/** What a seat's maker works at, for their years at it. */
const BENCH: Readonly<Record<string, string>> = {
  smith: "anvil",
  potter: "wheel",
  weaver: "loom",
  founder: "furnace",
  machinist: "machines",
};

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const whose = (sex: 0 | 1) => (sex ? "his" : "her");

/** How one died, without the year their years already tell: "died a babe", "died at 61", "fell at the battle at Pounholt". */
const howShort = (how: string) =>
  how.replace(/,? in -?\d+$/, "").replace(/^died in -?\d+, at (\d+)$/, "died at $1");

/** One of the kin in a tree's cell: their name (their page where they have one), their tie and years, how they died. */
function cell(k: Kin, year: number, self = false) {
  const years =
    k.died === null
      ? `${year - k.born}`
      : `${k.born}–${k.died}${k.how ? `, ${howShort(k.how)}` : ""}`;
  return {
    name: [link(k.name, self ? null : k.ref)],
    note: self
      ? years
      : `${k.tie}, ${years}${k.note && k.note.startsWith("born") ? `, ${k.note}` : ""}`,
    woman: k.sex === 0,
    ...(self ? { self: true } : {}),
    ...(k.died !== null ? { dead: true } : {}),
  };
}

/** A family's tab: the card's line, their tree, their line's holders, their house now, what is kept. */
export function familyTab(f: Family): Tab {
  const s = f.self,
    year = f.year,
    him = s.sex ? "Him" : "Her",
    rows: { label: string; people: ReturnType<typeof cell>[] }[] = [];
  if (f.parents.length)
    rows.push({ label: "Parents", people: f.parents.map((k) => cell(k, year)) });
  rows.push({
    label: f.spouse ? `${him}, and ${whose(s.sex)} ${f.spouse.tie}` : him,
    people: [cell(s, year, true), ...(f.spouse ? [cell(f.spouse, year)] : [])],
  });
  if (f.children.length)
    rows.push({ label: "Children", people: f.children.map((k) => cell(k, year)) });
  if (f.siblings.length)
    rows.push({
      label: "Brothers and sisters",
      people: f.siblings.map((k) => cell(k, year)),
    });
  const blocks: Block[] = [
    { type: "text", lines: [[familyLine(f)]] },
    { type: "tree", title: `${s.sex ? "His" : "Her"} family`, rows },
  ];
  if (f.line.length > 1)
    blocks.push({
      type: "list",
      title: `${s.sex ? "His" : "Her"} line`,
      items: f.line.map((k) =>
        item(
          [k.tie === "self" ? k.name : link(k.name, k.ref), `: ${k.note ?? ""}`],
          k.tie === "self" ? null : k.ref,
        ),
      ),
    });
  if (f.house.length)
    blocks.push({
      type: "list",
      title: "Under the same roof, now",
      items: f.house.map((k) =>
        item(
          [
            link(k.name, k.ref),
            `, ${whose(s.sex)} ${k.tie}, ${k.died === null ? year - k.born : `${k.born}–${k.died}`}`,
          ],
          k.ref,
        ),
      ),
    });
  blocks.push({ type: "text", lines: [[f.kept]] });
  return { id: "family", name: "Family", blocks };
}

/**
 * A people's body plan in words: "a head, a chest, two arms, two hands, two legs and two eyes";
 * "a head, a body, two mandibles and legs on each side"; "a mantle and tentacles".
 */
export function planWords(frame: BodyFrame): string {
  const counts = new Map<string, number>();
  for (const m of frame.members) {
    const words = frame.words[m] ?? m,
      many = /^one of ~ (left |right )/.test(words)
        ? " on each side"
        : words.startsWith("one of ~ ")
          ? " "
          : "",
      w =
        words
          .replace(/^one of ~ (left |right )?/, "")
          .replace(/^~ (left |right )?/, "")
          .replace(/^an? /, "") + many;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  const NUM = ["", "a", "two", "three", "four", "five", "six"],
    parts = [...counts].map(([w, n]) =>
      w.endsWith(" ")
        ? w.trim()
        : w.endsWith(" on each side")
          ? w
          : n === 1
            ? `${/^[aeiou]/.test(w) ? "an" : "a"} ${w}`
            : `${NUM[n] ?? n} ${w}s`,
    );
  return parts.length > 1
    ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)!}`
    : (parts[0] ?? "");
}

/** What a wound leaves them able to do, in a sentence (null: nothing lasting). */
function leaves(w: Wound, sex: 0 | 1): string | null {
  const they = sex ? "He" : "She";
  switch (w.lasting) {
    case "crutch":
      return `${they} walks on a crutch.`;
    case "limp":
      return `${they} limps.`;
    case "stiff":
      return `${they} keeps the limb stiff.`;
    case "patch":
      return `${they} sees with one eye, a patch over the other.`;
    case "stump":
      return w.member.startsWith("leg")
        ? `${they} goes on what is left.`
        : `${they} works with what is left.`;
    default:
      return null;
  }
}

/** A wound told on the Body tab: where, when, by what, who tended it, what it leaves. */
function woundItem(w: Wound, sex: 0 | 1): Item {
  const told = woundWords(w, sex),
    tended = w.outcome === "lost" && w.how !== "put out" ? "" : ` Tended ${w.by}.`,
    after = leaves(w, sex);
  return item(`${told}${tended}${after ? ` ${after}` : ""}`, w.event, w.year);
}

/** Each member's line on the Body tab: its name, how it is, the wound or blow that made it so. */
function memberItem(b: BodyNow, read: BodyRead, i: number): Item {
  const m = b.members[i]!,
    name = cap(m.words.replace("~", whose(read.sex))),
    last = m.wounds.length ? read.wounds[m.wounds.at(-1)!]! : null,
    why =
      m.state === "killed" && b.death
        ? ` (${deathWords(b.death, read.sex)})`
        : last && m.state !== "whole"
          ? ` (${last.from === "battle" ? "at" : "in"} ${last.where}, ${last.year})`
          : "";
  return item(`${name}: ${STATE_WORDS[m.state]}${why}`, last?.event ?? b.death?.event ?? null);
}

/** A body's tab: how it is now, what it can do, its plan, the body drawn, each member, each wound. */
export function bodyTab(
  read: BodyRead,
  person: Extract<Portrait, { kind: "person" }>,
  t: number,
  matter: readonly Stat[] = [],
): Tab {
  const b = bodyAt(read.frame, read.wounds, t, read.death),
    able = ableWords(b, read.sex),
    dealt = read.wounds
      .map((w, i) => ({ w, i }))
      .filter(({ w }) => w.at <= t)
      .sort((x, y) => y.w.at - x.w.at || x.i - y.i),
    blocks: Block[] = [
      {
        type: "facts",
        rows: [
          stat("Now", bodyLine(b, read.wounds, t, read.sex)),
          ...(able ? [stat("Able", able)] : []),
          stat("Body", cap(planWords(read.frame))),
          ...matter,
        ],
      },
      {
        type: "body",
        person: { ...person, look: woundLookAt(read.wounds, t) },
        members: b.members.map((m) => ({
          member: m.member,
          words: m.words.replace("~", whose(read.sex)),
          state: m.state,
        })),
      },
      {
        type: "list",
        title: "Each member",
        items: b.members.map((_, i) => memberItem(b, read, i)),
      },
    ];
  if (dealt.length)
    blocks.push({
      type: "list",
      title: `${read.sex ? "His" : "Her"} wounds`,
      items: dealt.map(({ w }) => woundItem(w, read.sex)),
    });
  blocks.push({
    type: "text",
    lines: [
      [
        `${read.sex ? "His" : "Her"} body by ${whose(read.sex)} people's plan, each member as history's wounds left it: those of the battles ${read.sex ? "he" : "she"} went to and the fires and quakes that struck ${whose(read.sex)} town, kept with ${read.sex ? "him" : "her"} — not every hurt of every day.`,
      ],
    ],
  });
  return { id: "body", name: "Body", blocks };
}

/** Their picture as a person, from their page's where it has one, else as their people look. */
function personOf(
  world: World,
  page: PageModel,
  ref: string,
  cell: number,
): Extract<Portrait, { kind: "person" }> {
  if (page.portrait?.kind === "person") return page.portrait;
  const body = peopleBody(world);
  return {
    kind: "person",
    ref,
    age: 30,
    span: body?.span ?? 70,
    occupation: OCC.farmer,
    child: false,
    era: landEra(world, cell),
    body,
  };
}

/** The pages a family and a body are told on: the town's people, the levy, the seats, the people met, the hand's. */
const KIN_PAGES = /^(folk:town:|lv:|seat:|heal:|prsn:|agent:)/;

/**
 * A page with its family and body (Phase 55 wave 5): the card's two lines first in its overview,
 * a Family tab where it has none (after its overview), a Body tab after its family. Other pages,
 * and those of no one, as they are.
 */
export function withKin(world: World, ref: string, page: PageModel): PageModel {
  if (!KIN_PAGES.test(ref) || (page.kind !== "person" && page.kind !== "agent")) return page;
  const read = bodyOf(world, ref);
  if (!read) return page;
  const card = kinCard(world, ref),
    family = page.tabs.some((t) => t.id === "family") ? null : familyOf(world, ref),
    cellOf =
      page.place?.scale === "region"
        ? page.place.cell
        : page.place?.scale === "village"
          ? (populationContext(world).settlements.get(page.place.town as Ref)?.cell ?? -1)
          : -1,
    person = personOf(world, page, ref, cellOf),
    body = bodyTab(
      read,
      person,
      toldAt(read, world.now),
      // (Its bones, or a people in a shell its shell, and its blood, by its world's life: Phase 57.)
      bodyMatter(world, person.body?.skin),
    ),
    lines: Block = {
      type: "facts",
      rows: [
        ...(card.family ? [stat("Family", card.family)] : []),
        ...(card.body ? [stat("Body", card.body)] : []),
      ],
    },
    tabs: Tab[] = page.tabs.map((t) =>
      t.id === "overview" ? { ...t, blocks: [lines, ...t.blocks] } : t,
    ),
    after = tabs.findIndex((t) => t.id === "overview") + 1;
  if (family) tabs.splice(after, 0, familyTab(family));
  const kin = tabs.findIndex((t) => t.id === "family");
  tabs.splice(kin >= 0 ? kin + 1 : after, 0, body);
  return { ...page, tabs };
}

/** A maker's page, by the seat they hold (`seat:<town>:<trade>:<seat>`): who holds it, how long, their town. */
export function seatPage(world: World, ref: string): PageModel {
  const seat = parseSeatRef(ref),
    h = seat ? seatHolder(world, seat.town, seat.trade, seat.seat) : null;
  if (!seat || !h) throw new Error(`no seat ${ref}`);
  const year = Math.floor(world.now / (365 * 86400)),
    age = year - h.born,
    body = peopleBody(world),
    stats = [
      stat("Age", `${age}`),
      stat("At it", many(h.years, "year", "years")),
      stat("Of", [townLink(world, seat.town)]),
    ];
  return {
    ref,
    kind: "person",
    icon: TRADE_ICON[seat.trade] ?? "🛠️",
    portrait: {
      kind: "person",
      ref,
      age,
      span: body?.span ?? 70,
      occupation: OCC.crafter,
      child: age < lifeOf(world).adulthood,
      era: landEra(world, h.cell),
      body,
    },
    title: h.name,
    subtitle: [`${cap(article(seat.trade))} ${seat.trade} of `, townLink(world, seat.town)],
    color: null,
    place: { scale: "village", town: seat.town },
    stats,
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "facts",
            rows: [
              stat("Born", `year ${h.born}`),
              stat("Who", `a ${h.sex ? "man" : "woman"} of ${h.townName}`),
              stat(
                "Seat",
                `${article(seat.trade)} ${seat.trade}'s, ${many(h.years, "year", "years")} at the ${BENCH[seat.trade] ?? "bench"}`,
              ),
            ],
          },
          {
            type: "text",
            lines: [
              [
                "Named as the holder of one of the town's seats at the trade: each seat passes to another every so many years, and history keeps the seat and what it made, not the maker's own days.",
              ],
            ],
          },
        ],
      },
    ],
    followable: false,
    year,
  };
}
