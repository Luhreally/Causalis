// Wounds told (Phase 55 M226, M229; asked for 2026-10-26: "Wounds and lost limbs shown on the
// person and told on their page. Healers tending the wounded."): a person's wounds on their page —
// how one is with them now, then each, the latest first, opening the battle or the strike that
// dealt it; a town's wounded on its page — those healing now, those marked for good — and its
// healer; the healer's own page — who holds the seat and how long, what their craft knows, whom
// they tend now. Read from host/wounds.ts and the record alone: reading a page never moves history.
import type { Ref, World } from "../../kernel/index.ts";
import { loreOf, populationContext } from "../../sim/index.ts";
import {
  woundLookAt,
  woundNow,
  woundStage,
  woundWords,
  type Block,
  type Item,
  type PageModel,
  type Stat,
  type Tab,
  type Wound,
  type WoundLook,
} from "../../bridge/index.ts";
import { healerOf } from "../village.ts";
import { hospitalOf, townWounded, type Wounded } from "../wounds.ts";
import { townLink } from "./names.ts";
import { count, item, link, many, stat, yearNow } from "./words.ts";

/** The page of a town's healer (Phase 55 M229). */
export function healerRef(town: string): string {
  return `heal:${town}`;
}

const lower = (s: string) => (s ? s[0]!.toLowerCase() + s.slice(1) : s);
const healing = (w: Wound, t: number) => {
  const s = woundStage(w, t);
  return s === "away" || s === "abed" || s === "mending";
};
/** How a wound is with them at t (null: not yet dealt, or mended). */
function nowOf(w: Wound, t: number, sex: number | undefined): string | null {
  return woundStage(w, t) === "away" ? `Coming home wounded from ${w.where}` : woundNow(w, t, sex);
}

/** Their wounds' look at t, for their portrait (nothing, where none shows). */
export function lookOf(wounds: readonly Wound[], t: number): { look?: WoundLook } {
  if (!wounds.length) return {};
  const l = woundLookAt(wounds, t);
  return l.lost.length ||
    l.bound.length ||
    l.scars.length ||
    l.sling ||
    l.crutch ||
    l.limp ||
    l.stiff ||
    l.patch
    ? { look: l }
    : {};
}

/** Their wounds, for their page (null: none dealt yet): how one is with them now, then each, the latest first, each opening what dealt it. */
export function woundBlock(
  wounds: readonly Wound[],
  sex: number | undefined,
  t: number,
): Block | null {
  const dealt = wounds
    .filter((w) => w.at <= t)
    .sort((a, b) => b.at - a.at || (a.event < b.event ? -1 : a.event > b.event ? 1 : 0));
  if (!dealt.length) return null;
  const now = dealt.map((w) => nowOf(w, t, sex)).find((x) => x !== null);
  return {
    type: "list",
    title: "Their wounds",
    items: [
      ...(now ? [item(`Now: ${lower(now)}`)] : []),
      ...dealt.map((w) => item(woundWords(w, sex), w.event)),
    ],
  };
}

/** What a land's healers know (a line each), by the lore it knows by a year. */
function craftLines(world: World, cell: number, year: number): string[] {
  const knows = (id: string) => (loreOf(world).get(cell, id)?.year ?? Infinity) <= year;
  return [
    "Binds wounds with linen and herb salves, sets broken bones, and takes off a limb that cannot be saved.",
    ...(knows("medicine")
      ? ["Cleans a wound and stitches it, splints a break, and knows how the body works."]
      : []),
    ...(knows("sanitation") ? ["Keeps the sickroom clean and boils the linen."] : []),
    ...(knows("germs")
      ? ["Knows that a wound's fever comes of what gets into it, and keeps it out."]
      : []),
  ];
}

/** One of a town's wounded in a line: how they are now, or what marked them (the gravest). */
function woundedItem(w: Wounded, t: number): Item {
  const now = w.wounds.filter((x) => healing(x, t)).sort((a, b) => b.at - a.at)[0],
    marked =
      w.wounds.find((x) => x.outcome === "lost") ?? w.wounds.find((x) => x.outcome === "lame"),
    told = now ? nowOf(now, t, w.sex) : marked ? woundWords(marked, w.sex) : null;
  return item(`${w.name}: ${lower(told ?? "wounded")}`, w.ref);
}

/** A town's wounded, for its page (null: none, and no healer): those healing now, those marked for good, its healer. */
export function woundedTab(world: World, town: Ref): Tab | null {
  const s = populationContext(world).settlements.get(town);
  if (!s) return null;
  const t = world.now,
    healer = healerOf(world, s, yearNow(world)),
    wounded = townWounded(world, s.ref);
  if (!wounded.length && !healer) return null;
  const now = wounded.filter((w) => w.wounds.some((x) => healing(x, t))),
    marked = wounded.filter((w) => !now.includes(w)),
    blocks: Block[] = [
      {
        type: "facts",
        rows: [
          stat("Healing now", count(now.length)),
          stat("Marked for good", count(marked.length)),
          stat(
            "Healer",
            healer ? [link(healer.name, healerRef(s.ref))] : "none: its land knows no herb-lore",
          ),
        ],
      },
    ];
  if (now.length)
    blocks.push({ type: "list", title: "Healing now", items: now.map((w) => woundedItem(w, t)) });
  if (marked.length)
    blocks.push({
      type: "list",
      title: "Marked for good",
      items: marked.map((w) => woundedItem(w, t)),
    });
  blocks.push({
    type: "text",
    lines: [
      [
        "Its people kept by their line: the wounds they came home with from its battles, or took in a fire or a quake, are kept with them, not every hurt of every day.",
      ],
    ],
  });
  return { id: "wounded", name: "Wounded", blocks };
}

/** A town's healer's page (`heal:<town>`): who holds the seat and how long, what their craft knows, whom they tend now. */
export function healerPage(world: World, ref: string): PageModel {
  const town = ref.slice("heal:".length),
    s = populationContext(world).settlements.get(town as Ref),
    year = yearNow(world),
    h = s ? healerOf(world, s, year) : null;
  if (!s || !h)
    return {
      ref,
      kind: "unknown",
      icon: "❔",
      title: "A healer",
      subtitle: s
        ? ["None in ", townLink(world, s.ref), ": its land knows no herb-lore"]
        : ["Of a town now gone"],
      color: null,
      place: null,
      stats: [],
      tabs: [
        {
          id: "overview",
          name: "Overview",
          blocks: [{ type: "text", lines: [["No one holds a healer's seat there."]] }],
        },
      ],
      followable: false,
      year,
    };
  const t = world.now,
    tending = townWounded(world, s.ref).filter((w) =>
      w.wounds.some((x) => healing(x, t) && (x.tended === "healer" || x.tended === "hospital")),
    ),
    hospital = hospitalOf(world, s.ref, year),
    stats: Stat[] = [
      stat("Healer of", [townLink(world, s.ref)]),
      stat("At it", many(h.years, "year", "years")),
      stat("Tending", count(tending.length)),
      stat("Hospital", hospital ? "the town keeps one" : "none"),
    ];
  return {
    ref,
    kind: "person",
    icon: "🌿",
    title: h.name,
    subtitle: ["The healer of ", townLink(world, s.ref)],
    color: null,
    place: { scale: "village", town: s.ref },
    stats,
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          { type: "facts", rows: stats },
          { type: "text", lines: craftLines(world, s.cell, year).map((l) => [l]) },
          {
            type: "text",
            lines: [
              [
                "The town's healer, named as the holder of the seat its land's herb-lore keeps: history keeps the seat, what it knows and whom it tends, not the healer's own days.",
              ],
            ],
          },
        ],
      },
      {
        id: "wounded",
        name: "Tending",
        blocks: tending.length
          ? [
              {
                type: "list",
                title: "Whom they tend now",
                items: tending.map((w) => woundedItem(w, t)),
              },
            ]
          : [{ type: "text", lines: [["No one of the town's lines is in their care now."]] }],
      },
    ],
    followable: false,
    year,
  };
}
