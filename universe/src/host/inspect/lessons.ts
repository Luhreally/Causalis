// What a land's people or a realm have learned (the lessons, rules/lessons.ts): each lesson with what its cause cost them, in numbers
// and years, what they do now and how far, whom they had it from, and whether it has worked; then what still costs them and is not
// yet answered. Only reads.
import type { World } from "../../kernel/index.ts";
import { cellRef } from "../../gen/index.ts";
import { LESSON, LESSON_CAUSE, LESSON_RESPONSE, faded, pressOf } from "../../rules/index.ts";
import { lessonsOf, useIn, type CauseMark, type Use } from "../../sim/index.ts";
import type { Block, Line, Stat } from "../../bridge/index.ts";
import { count, item, many, stat, yearNow } from "./words.ts";
import { landLink, realmLink } from "./names.ts";

const capital = (s: string) => `${s[0]!.toUpperCase()}${s.slice(1)}`;

/** What a cause has cost them, in its own count, and the years it took. */
function costWords(cause: string, m: CauseMark, year: number): string {
  const c = LESSON_CAUSE.get(cause)!,
    years = Math.max(1, year - m.first),
    span = years === 1 ? "a year" : many(years, "year", "years"),
    // ("120 homes and 40 lives lost to quakes": the lives among the homes, where it takes both.)
    [unit, ...rest] = c.lost.split(" "),
    what =
      unit === "homes" && m.dead > 0
        ? m.lost > 0
          ? `${count(m.lost)} homes and ${many(m.dead, "life", "lives")} ${rest.join(" ")}`
          : `${many(m.dead, "life", "lives")} ${rest.join(" ")}`
        : `${count(m.lost)} ${c.lost}`;
  return `${what} in ${span} (${many(m.strikes, c.each[0], c.each[1])})`;
}

/** Whether it has worked: what each strike cost since, against before. */
function workedWords(cause: string, u: Use): string {
  const c = LESSON_CAUSE.get(cause)!;
  if (u.strikes < LESSON.judged || u.before <= 0)
    return u.strikes
      ? `too soon to tell: ${many(u.strikes, c.each[0], c.each[1])} since`
      : `none since to judge it by`;
  const ratio = u.since / u.strikes / u.before,
    over = `over ${many(u.strikes, c.each[0], c.each[1])} since`;
  if (ratio < 0.95)
    return `losses each ${c.each[0]} ${Math.round((1 - ratio) * 100)}% lower, ${over}`;
  if (ratio > 1.05)
    return `losses each ${c.each[0]} ${Math.round((ratio - 1) * 100)}% higher, ${over}: they lean on it less`;
  return `losses each ${c.each[0]} about as they were, ${over}`;
}

/** How far they lean on it, in words a person would say. */
function howFar(w: number): string {
  const tenths = Math.max(1, Math.min(10, Math.round(w * 10)));
  return tenths >= 10 ? "all of them" : `${tenths} in 10 of them`;
}

/** Whom they had it from: a land or a realm, as a link. */
function fromLine(world: World, from: string | null): Line {
  if (!from) return ["their own reckoning"];
  if (from.startsWith("cell:0:")) return ["the people of ", landLink(world, Number(from.slice(7)))];
  return [realmLink(world, from)];
}

/** The blocks of a land's or realm's What they have learned (none where nothing has cost them). */
export function lessonBlocks(world: World, holder: string): Block[] {
  const h = lessonsOf(world)?.get(holder);
  if (!h || (!h.causes.size && !h.uses.size)) return [];
  const year = yearNow(world),
    blocks: Block[] = [],
    learned = [...h.uses.entries()]
      .map(([id, u]) => ({ id, u, w: useIn(h, id, year), r: LESSON_RESPONSE.get(id) }))
      .filter((x) => x.r && x.w > 0)
      .sort((a, b) => a.u.taken - b.u.taken || (a.id < b.id ? -1 : 1));
  blocks.push({
    type: "text",
    title: "What they have learned",
    lines: [
      learned.length
        ? [
            `${many(learned.length, "lesson", "lessons")} from what has cost them, each taken up as the cost of its cause pressed on them and kept as long as it is worth keeping.`,
          ]
        : ["Nothing yet: what has cost them has not yet pressed them to change their ways."],
    ],
  });
  for (const { u, w, r } of learned) {
    const m = h.causes.get(r!.cause),
      rows: Stat[] = [];
    if (m) rows.push(stat("What it cost them", costWords(r!.cause, m, year)));
    rows.push(
      stat("What they do now", `${capital(r!.does)} (${howFar(w)})`, { why: u.ref ?? undefined }),
      stat("Since", [`year ${u.taken}, from `, ...fromLine(world, u.from)], {
        why: u.ref ?? undefined,
      }),
      stat("Has it worked", workedWords(r!.cause, u)),
    );
    blocks.push({ type: "facts", title: capital(r!.name), rows });
  }
  // What still costs them, and is not answered yet.
  const open: Stat[] = [];
  for (const [cause, m] of h.causes) {
    const c = LESSON_CAUSE.get(cause);
    if (!c || learned.some((x) => x.r!.cause === cause)) continue;
    const press = pressOf(faded(m.cost, year - m.at, LESSON.fade));
    if (press < LESSON.least) continue;
    open.push(
      stat(
        capital(c.words),
        `${costWords(cause, m, year)}; it presses them ${press >= 0.66 ? "hard" : press >= 0.33 ? "somewhat" : "a little"}`,
      ),
    );
  }
  if (open.length) blocks.push({ type: "facts", title: "What costs them still", rows: open });
  // (Nothing learned, and nothing that presses them now: no tab.)
  return learned.length || open.length ? blocks : [];
}

/** A realm's: what its hosts have learned, and what its lands have, lesson by lesson. */
export function realmLessonBlocks(
  world: World,
  realm: string,
  members: readonly number[],
): Block[] {
  const own = lessonBlocks(world, realm),
    store = lessonsOf(world),
    year = yearNow(world),
    held = new Map<string, { lands: number; best: number; at: number }>();
  for (const c of members) {
    const h = store?.get(cellRef(0, c));
    if (!h) continue;
    for (const id of h.uses.keys()) {
      const w = useIn(h, id, year);
      if (w <= 0) continue;
      const was = held.get(id) ?? { lands: 0, best: -1, at: 0 };
      was.lands++;
      const lost = h.causes.get(LESSON_RESPONSE.get(id)!.cause)?.lost ?? 0;
      if (lost > was.at) {
        was.at = lost;
        was.best = c;
      }
      held.set(id, was);
    }
  }
  if (!own.length && !held.size) return [];
  const blocks: Block[] = own.length
    ? own
    : [
        {
          type: "text",
          title: "What they have learned",
          lines: [["Its hosts have learned nothing yet from the battles they lost."]],
        },
      ];
  if (held.size)
    blocks.push({
      type: "list",
      title: "What its lands have learned",
      items: [...held.entries()]
        .sort((a, b) => b[1].lands - a[1].lands || (a[0] < b[0] ? -1 : 1))
        .map(([id, x]) =>
          item(
            [
              `${capital(LESSON_RESPONSE.get(id)!.name)}: ${many(x.lands, "land", "lands")} of ${count(members.length)}, the most struck `,
              landLink(world, x.best),
            ],
            cellRef(0, x.best),
          ),
        ),
    });
  return blocks;
}
