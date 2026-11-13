// What a land's people or a realm have learned, by how they came to it: from what has cost them (the lessons, rules/lessons.ts), each
// lesson with what its cause cost them, in numbers and years, what they do now and how far, whom they had it from, and whether it has
// worked, then what still costs them and is not yet answered, and where their losses press their finding; by their own thought and
// finding (their lore, by field); and from others. Only reads.
import type { World } from "../../kernel/index.ts";
import { cellRef } from "../../gen/index.ts";
import {
  FIELDS,
  LESSON,
  LESSON_CAUSE,
  LESSON_RESPONSE,
  PRINCIPLES,
  causesAnswered,
  faded,
  fieldOf,
  pressOf,
  principle,
  pushOf,
  type Field,
  type Principle,
} from "../../rules/index.ts";
import {
  findableAt,
  knows,
  lessonDoes,
  lessonsOf,
  loreOf,
  populationContext,
  pressIn,
  useIn,
  type CauseMark,
  type Use,
} from "../../sim/index.ts";
import { principleName } from "../../causal/index.ts";
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
    ctx = populationContext(world),
    blocks: Block[] = [],
    learned = [...h.uses.entries()]
      .map(([id, u]) => ({ id, u, w: useIn(h, id, year), r: LESSON_RESPONSE.get(id) }))
      .filter((x) => x.r && x.w > 0)
      .sort((a, b) => a.u.taken - b.u.taken || (a.id < b.id ? -1 : 1));
  blocks.push({
    type: "text",
    title: "From what has cost them",
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
      stat("What they do now", `${capital(lessonDoes(ctx, holder, r!))} (${howFar(w)})`, {
        why: u.ref ?? undefined,
      }),
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

/** A realm's: what its hosts have learned and its seat knows, and what its lands have learned, lesson by lesson. */
export function realmLessonBlocks(
  world: World,
  realm: string,
  members: readonly number[],
  seat: number | null = null,
): Block[] {
  const own = learnedBlocks(world, realm, seat),
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

// —— All they have learned, by how they came to it ——————————————————————————————————————————————————

type Came = { id: string; year: number; field: Field; from: number | null; event: string };

/** What a land knows, each by how it came to it: found by its own people, or learned from another land (whom). */
function cameBy(world: World, cell: number): Came[] {
  const out: Came[] = [];
  for (const [id, k] of loreOf(world).of(cell)) {
    const e = world.events.get(k.event),
      teacher = e && e.type === "lore.learned" ? e.causes[0]?.ref : undefined,
      at = teacher ? world.events.get(teacher)?.place : undefined,
      from = at && at.startsWith("cell:0:") ? Number(at.slice(7)) : null;
    out.push({
      id,
      year: k.year,
      field: fieldOf(principle(id)),
      from: e?.type === "lore.found" ? null : (from ?? -1),
      event: k.event,
    });
  }
  return out;
}

/** What a principle opened the way to, of what the land knows: those that need it. */
function opened(id: string, knowsHere: (id: string) => boolean): string[] {
  return PRINCIPLES.filter(
    (q) => knowsHere(q.id) && q.needs.some((n) => n.split("|").includes(id)),
  ).map((q) => q.id);
}

/** A few names, in words: "a, b and c". */
function andList(names: readonly string[]): string {
  return names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/**
 * What presses a holder's finding, in words: each cause that presses it, toward the principles open to it next whose effects answer
 * that cause (sim/lore/lore.ts, rules/lessons.ts pushOf). None where nothing presses it.
 */
function pressedLines(world: World, holder: string, cell: number): Line[] {
  const h = lessonsOf(world)?.get(holder);
  if (!h?.causes.size) return [];
  const year = yearNow(world),
    ctx = populationContext(world),
    lines: Line[] = [];
  let open: Principle[] | undefined;
  for (const [cause] of h.causes) {
    const press = pressIn(h, cause, year);
    if (press < 0.1) continue;
    const toward = (open ??= findableAt(ctx, cell))
      .filter((p) => causesAnswered(p).includes(cause))
      .slice(0, 3);
    if (!toward.length) continue;
    const c = LESSON_CAUSE.get(cause)!;
    lines.push([
      `Its losses to ${c.words} press it toward ${andList(toward.map((p) => principleName(p.id, world)))}: found up to ${Math.round(pushOf([cause], () => press) * 10) / 10} times as readily.`,
    ]);
  }
  return lines;
}

/**
 * Everything a land's people, or a realm at its seat, have learned, by how they came to it: from what has cost them (the lessons),
 * by their own thought and finding (each principle its lore holds that it found, by field), and from others (what came to it from
 * a neighbour or by sea, and from whom). The few most telling first; the rest at "show all". Only reads.
 */
export function learnedBlocks(world: World, holder: string, cell: number | null): Block[] {
  const lessons = lessonBlocks(world, holder),
    came = cell === null ? [] : cameBy(world, cell),
    found = came.filter((c) => c.from === null),
    taught = came.filter((c) => c.from !== null);
  if (!lessons.length && !came.length) return [];
  const ctx = populationContext(world),
    here = (id: string) => cell !== null && knows(ctx, cell, id),
    taken = lessonsOf(world)?.get(holder),
    lessonCount = taken
      ? [...taken.uses.keys()].filter((id) => useIn(taken, id, yearNow(world)) > 0).length
      : 0,
    byField = new Map<Field, number>();
  for (const c of found) byField.set(c.field, (byField.get(c.field) ?? 0) + 1);
  const fields = FIELDS.filter((f) => byField.has(f)),
    teachers = new Map<number, number>();
  for (const c of taught)
    if (c.from !== null && c.from >= 0) teachers.set(c.from, (teachers.get(c.from) ?? 0) + 1);
  const most = [...teachers.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  const blocks: Block[] = [
    {
      type: "text",
      title: "What they have learned",
      lines: [
        [
          `From what has cost them: ${lessonCount ? many(lessonCount, "lesson", "lessons") : "nothing yet"}.`,
        ],
        [
          `By their own thought and finding: ${found.length ? `${count(found.length)} (${fields.map((f) => `${f} ${byField.get(f)}`).join(", ")})` : "nothing yet"}.`,
        ],
        [
          `From others: ${taught.length ? count(taught.length) : "nothing yet"}`,
          ...(most ? [", the most from the people of ", landLink(world, most[0], true)] : []),
          ".",
        ],
      ],
    },
  ];
  blocks.push(...lessons);
  const pressed = cell === null ? [] : pressedLines(world, holder, cell);
  if (pressed.length)
    blocks.push({ type: "text", title: "Where their losses press them", lines: pressed });
  if (found.length) {
    // (The latest first; what opened most, told beneath.)
    const rows = [...found].sort((a, b) => b.year - a.year || (a.id < b.id ? -1 : 1));
    blocks.push({
      type: "table",
      title: "By their own thought and finding",
      columns: ["Found", "Field", "Year"],
      rows: rows.map((c) => ({
        ref: `prin:${c.id}`,
        cells: [[principleName(c.id, world)], [c.field], [String(c.year)]],
        keys: [principleName(c.id, world), FIELDS.indexOf(c.field), c.year],
      })),
    });
    const opening = found
      .map((c) => ({ c, to: opened(c.id, here) }))
      .filter((x) => x.to.length)
      .sort((a, b) => b.to.length - a.to.length || a.c.year - b.c.year)
      .slice(0, 3);
    if (opening.length)
      blocks.push({
        type: "text",
        title: "What it opened",
        lines: opening.map(({ c, to }) => [
          `${capital(principleName(c.id, world))}, found in year ${c.year}, opened the way to ${andList(to.slice(0, 3).map((id) => principleName(id, world)))}${to.length > 3 ? ` and ${many(to.length - 3, "more", "more")}` : ""}.`,
        ]),
      });
  }
  if (taught.length) {
    const rows = [...taught].sort((a, b) => b.year - a.year || (a.id < b.id ? -1 : 1));
    blocks.push({
      type: "table",
      title: "From others",
      columns: ["Learned", "From", "Year"],
      rows: rows.map((c) => ({
        ref: `prin:${c.id}`,
        cells: [
          [principleName(c.id, world)],
          [c.from !== null && c.from >= 0 ? landLink(world, c.from, true) : "those beside them"],
          [String(c.year)],
        ],
        keys: [principleName(c.id, world), c.from ?? -1, c.year],
      })),
    });
  }
  return blocks;
}
