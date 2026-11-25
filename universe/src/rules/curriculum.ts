// What education teaches (the last breadth gaps, 2026-11-24): schools were buildings that made readers. What is taught in
// them is what those who pay for them live by, weighed by what each pays:
// - a faith's tithes teach its creed; and letters as far as its teaching is written (half of it at the most);
// - the seat's treasury teaches what it rules by: letters as far as its will is done through office (its capacity), arms as
//   far as it holds its people by them (force);
// - a great house's gift teaches its sons what keeps a house: arms as far as the realm is held by them, else letters;
// - those who pay for their own young teach them their living: traders reckoning and letters, crafters their craft;
// - a trade's dues teach its craft.
// So a realm's schooling has four contents (letters, craft, creed, arms), shares summing to one, and a reach: its teachers
// against its young (CURRICULUM.class pupils a teacher; CURRICULUM.young of a people of an age to be taught).
// What it moves, each by its share times the reach:
// - craft: its crafters make the more (CURRICULUM.skill at the most: a schooled hand against an unschooled, est);
// - creed: a land of the seat's faith leaves it the less readily (CURRICULUM.holds at the most);
// - arms: its host is the better drilled (CURRICULUM.drill at the most);
// - letters: readers, as sim/lore/letters.ts already reckons them from its schools.
// Pure functions.
import { dmath } from "../kernel/index.ts";

export const CONTENTS = ["letters", "craft", "creed", "arms"] as const;
export type Content = (typeof CONTENTS)[number];
export const CONTENT_WORDS: Readonly<Record<Content, string>> = {
  letters: "letters and reckoning",
  craft: "the crafts",
  creed: "its faith's creed",
  arms: "arms and command",
};

export const CURRICULUM = {
  /** Pupils to a teacher (est), and the share of a people of an age to be taught (est). */
  class: 30,
  young: 0.15,
  /** The most a schooling all of craft, reaching every young one, adds to what its crafters make (est). */
  skill: 0.15,
  /** The most a schooling all of creed takes from the chance a land leaves its seat's faith. */
  holds: 0.6,
  /** The most a schooling all of arms adds to how drilled its host is. */
  drill: 0.15,
  /** A faith's teaching written is at most this much letters. */
  written: 0.5,
} as const;

/** Who pays for a realm's schooling (what each gives a year, any one unit), and what each lives by. */
export type Payers = {
  readonly tithes: number;
  readonly treasury: number;
  readonly patron: number;
  readonly customers: number;
  readonly dues: number;
  /** How far the faith's teaching is written (0 … 1). */
  readonly scripture: number;
  /** How far the seat's will is done through office, and how far it holds its people by arms (0 … 1 each). */
  readonly capacity: number;
  readonly force: number;
  /** Its traders and crafters (heads): of those who pay for their young, a trader pays as five crafters do. */
  readonly traders: number;
  readonly crafters: number;
};

/** What a realm's schools teach: the share of each content (summing to one; all zero where no one pays), and the first. */
export function curriculumOf(p: Payers): { shares: Record<Content, number>; lead: Content | null } {
  const s: Record<Content, number> = { letters: 0, craft: 0, creed: 0, arms: 0 },
    pos = (x: number) => (x > 0 && Number.isFinite(x) ? x : 0),
    written = CURRICULUM.written * dmath.clamp(p.scripture, 0, 1),
    c = dmath.clamp(p.capacity, 0, 1),
    f = dmath.clamp(p.force, 0, 1),
    pen = c + f > 0 ? c / (c + f) : 0.5,
    trade = pos(p.traders),
    craft = 0.2 * pos(p.crafters),
    reckoning = trade + craft > 0 ? trade / (trade + craft) : 0.5;
  s.creed += pos(p.tithes) * (1 - written);
  s.letters += pos(p.tithes) * written;
  s.letters += pos(p.treasury) * pen;
  s.arms += pos(p.treasury) * (1 - pen);
  s.arms += pos(p.patron) * f;
  s.letters += pos(p.patron) * (1 - f);
  s.letters += pos(p.customers) * reckoning;
  s.craft += pos(p.customers) * (1 - reckoning);
  s.craft += pos(p.dues);
  const all = s.letters + s.craft + s.creed + s.arms;
  if (!(all > 0)) return { shares: s, lead: null };
  let lead: Content = "letters";
  for (const k of CONTENTS) {
    s[k] /= all;
    if (s[k] > s[lead] + 1e-12) lead = k;
  }
  return { shares: s, lead };
}

/** How far a realm's schooling reaches its young (0 … 1): its `teachers` against its `people`. */
export function schoolingReach(teachers: number, people: number): number {
  return people > 0
    ? dmath.clamp((Math.max(0, teachers) * CURRICULUM.class) / (people * CURRICULUM.young), 0, 1)
    : 0;
}
