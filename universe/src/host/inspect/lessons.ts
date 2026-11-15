// What a land's people or a realm have learned, by how they came to it: from what has cost them (the lessons, rules/lessons.ts), each
// lesson with what its cause cost them, in numbers and years, what they do now and how far, whom they had it from, and whether it has
// worked, then what still costs them and is not yet answered, and where their losses press their finding; by their own thought and
// finding (their lore, by field); and from others. And, of a realm, what it believes of how to hold itself (rules/learn.ts), drawn:
// each number with where it stands, which end its evidence favours and how surely, through the years; the evidence itself on the
// years, its own fates and others' apart; and whom it has learned from and who from it. Every word of these is composed of what was
// kept and measured. Only reads.
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
import {
  designsOf,
  holdNow,
  learntOf,
  orderOf,
  politiesOf,
  taughtWords,
  type Polity,
  type RealmOrder,
  type Taught,
} from "../../sim/index.ts";
import {
  HOLD,
  HOLD_KINDS,
  beliefWords,
  leanOf,
  partWords,
  sureOf,
  type Hold,
} from "../../rules/index.ts";
import type { Ref } from "../../kernel/index.ts";
import type { BeliefRow, EvidenceMark, TaughtBy } from "../../bridge/index.ts";
import { realmColor } from "../colors.ts";
import { heldUnpacked, leanUnpacked, yearsOf } from "../years.ts";
import { link } from "./words.ts";
import { HOLD_ASKS } from "./order.ts";
import { thinPoints } from "./time.ts";

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

/** A cause they lean on a lesson for, and one nothing answers yet, as their bars are coloured. */
const ANSWERED = [0.35, 0.8, 0.62] as const,
  UNANSWERED = [0.9, 0.42, 0.3] as const;

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
  // What presses them now, cause by cause (answered: one they lean on a lesson for), and the lessons they keep, on the years.
  const pressing = [...h.causes.keys()]
    .map((cause) => ({
      cause,
      c: LESSON_CAUSE.get(cause),
      press: pressIn(h, cause, year),
      answered: learned.some((x) => x.r!.cause === cause),
    }))
    .filter((x) => x.c && x.press >= LESSON.least)
    .sort((a, b) => b.press - a.press || (a.cause < b.cause ? -1 : 1));
  if (pressing.length > 1)
    blocks.push({
      type: "bars",
      title: "How hard each presses them now",
      unit: "share",
      wrap: true,
      bars: pressing.map((x) => ({
        label: [capital(x.c!.words)],
        value: x.press,
        color: x.answered ? ANSWERED : UNANSWERED,
      })),
    });
  if (learned.length) {
    const first = Math.min(...learned.map((x) => x.u.taken));
    if (year > first)
      blocks.push({
        type: "timeline",
        title: "The lessons they keep",
        from: first,
        to: year,
        wrap: true,
        rows: learned.map(({ u, w, r }) => ({
          label: [capital(r!.name)],
          from: u.taken,
          to: null,
          // (Fuller the more of them lean on it.)
          color: [0.25 + 0.2 * w, 0.45 + 0.45 * w, 0.5 + 0.5 * w] as const,
          words: howFar(w),
          ...(u.ref ? { ref: u.ref } : {}),
        })),
      });
  }
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
      // (A land that holds to it though nothing it lost is written down still names one.)
      if (lost > was.at || was.best < 0) {
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

/** What is their own, and what came from others, as their lines are coloured. */
const OWN = [0.78, 1, 0.29] as const,
  OTHERS = [0.44, 0.9, 1] as const;

/** The rows of what they found and what they learned from others shown at first: the latest; the rest at "show all". */
const FEW = 8;

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
  // (A realm's lessons of rule: what befell it and others it knew of, sim/order/holds.ts.)
  const rule: readonly Taught[] = orderOf(world)?.of(holder as Ref)?.taught ?? [];
  // (What a realm believes of how to hold itself, drawn.)
  const ruled = politiesOf(world).get(holder as Ref),
    believed = ruled ? believedBlocks(world, ruled) : [];
  if (!lessons.length && !came.length && !rule.length && !believed.length) return [];
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
        ...(rule.length
          ? [
              [
                `From what befell them and others: ${many(rule.length, "lesson", "lessons")} of how to rule${
                  rule.some((x) => x.of)
                    ? `, ${count(rule.filter((x) => x.of).length)} from another's fate`
                    : ""
                }.`,
              ],
            ]
          : []),
      ],
    },
  ];
  // What they know through the years: what they found themselves against what came to them from others, each as it grew.
  if (came.length > 2) {
    const grown = (list: readonly Came[]) => {
        const years = [...list].map((c) => c.year).sort((a, b) => a - b),
          points: { x: number; y: number }[] = [];
        years.forEach((x, i) => {
          if (points.at(-1)?.x === x) points[points.length - 1] = { x, y: i + 1 };
          else points.push({ x, y: i + 1 });
        });
        if (points.length && points.at(-1)!.x < yearNow(world))
          points.push({ x: yearNow(world), y: years.length });
        return thinPoints(points, 80);
      },
      series = [
        { name: "Found by their own thought", color: OWN, points: grown(found) },
        { name: "Learned from others", color: OTHERS, points: grown(taught) },
      ].filter((s) => s.points.length > 1);
    if (series.length)
      blocks.push({
        type: "lines",
        title: "What they know, as it grew",
        unit: "count",
        series,
      });
  }
  blocks.push(...believed);
  if (rule.length)
    blocks.push({
      type: "list",
      title: "From what befell them and others",
      items: rule.map((x) =>
        item(
          [
            x.event && world.events.get(x.event)
              ? link(`Year ${x.year}`, x.event)
              : `Year ${x.year}`,
            `: ${taughtWords(x)}.`,
          ],
          x.event && world.events.get(x.event) ? x.event : "",
          x.year,
        ),
      ),
    });
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
      few: FEW,
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
      few: FEW,
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

// —— What a realm believes of how to hold itself, drawn ——————————————————————————————————————————————

/** How firmly a belief is held, by how much evidence stands behind it and how one-sided it is. */
function firmly(lean: number): string {
  const a = Math.abs(lean);
  return a >= 0.45 ? "firmly" : a >= 0.2 ? "somewhat" : "faintly";
}

/** A log's values through the years kept, each as a point, with now. */
function through(
  log: { y: number[]; v: number[] } | undefined,
  read: (n: number) => number,
  now: number,
  last: number,
): { x: number; y: number }[] {
  const out = (log?.y ?? []).map((x, i) => ({ x, y: read(log!.v[i]!) }));
  if (out.at(-1)?.x === now) out[out.length - 1] = { x: now, y: last };
  else out.push({ x: now, y: last });
  return out;
}

/** The evidence a realm keeps that moved a number most. */
function heaviest(o: RealmOrder, k: number, own: number, toward: number): Taught | undefined {
  let best: Taught | undefined;
  for (const x of o.taught ?? []) {
    // (Of the kind the belief is said to come from, and the way it leans: its own fate where it is nearly all its own, another's
    // where nearly all seen, so the piece named never gainsays the line it is named in.)
    if (!x.moved || (own >= 0.75 && x.of) || (own <= 0.25 && !x.of)) continue;
    const v = x.moved[k] ?? 0;
    if (v * toward > 0 && Math.abs(v) > Math.abs(best?.moved?.[k] ?? 0)) best = x;
  }
  return best;
}

/**
 * What a realm believes of each of its numbers, the evidence for it on the years, and whom it learned from and who from it
 * (rules/learn.ts; sim/order/holds.ts): none where it keeps no numbers. Only reads.
 */
export function believedBlocks(world: World, r: Polity): Block[] {
  const store = orderOf(world),
    o = store?.of(r.ref);
  if (!o?.held) return [];
  const year = yearNow(world),
    ctx = populationContext(world),
    belief = learntOf(o),
    taught = o.taught ?? [],
    log = yearsOf(world)?.realms.get(r.ref),
    armPart = designsOf(world)
      .of(r.ref)
      ?.parts.find((x) => x.role === "arm"),
    arm = armPart ? partWords(armPart) : null,
    blocks: Block[] = [];
  // (A people that has seen little says so in words: four tracks with nothing on them tell less.)
  const little = !belief || HOLD_KINDS.every((h) => Math.abs(leanOf(belief, HOLD[h], year)) < 0.03);
  // (Of a living realm: one gone believes nothing now, and its kept pieces are told below.)
  if (little && r.ended === null)
    blocks.push({
      type: "text",
      title: "What it has seen work",
      lines: [
        [
          taught.length
            ? "Too little yet to believe anything of how a realm should be held: what it has seen says as much one way as the other."
            : "Nothing yet: nothing great has befallen it, and no realm whose fate it could see has stood much otherwise than most or fared much otherwise.",
        ],
      ],
    });
  if (belief && !little) {
    const rows: BeliefRow[] = HOLD_KINDS.map((h: Hold) => {
      const k = HOLD[h],
        lean = leanOf(belief, k, year),
        { sure, own } = sureOf(belief, k, year),
        on = heaviest(o, k, own, lean),
        words: (string | { text: string; ref: string })[] =
          Math.abs(lean) < 0.03
            ? [
                sure < 0.05
                  ? "Nothing it has seen says either way."
                  : "What it has seen says as much one way as the other.",
              ]
            : [
                `${capital(beliefWords(h, lean))}, ${firmly(lean)}: ${
                  own >= 0.75
                    ? "from its own fate"
                    : own <= 0.25
                      ? "from what befell others"
                      : "from its own fate and others'"
                }`,
                ...(on?.event && world.events.get(on.event)
                  ? [
                      ", most from ",
                      link(on.of ? `${on.of}, year ${on.year}` : `year ${on.year}`, on.event),
                    ]
                  : []),
                ".",
              ];
      return {
        label: HOLD_ASKS[h],
        low: holdNow(ctx, r, h, 0.05, arm),
        high: holdNow(ctx, r, h, 0.95, arm),
        now: o.held![k]! / 100,
        lean,
        sure,
        own,
        words,
        stood: through(log?.held, (n) => heldUnpacked(n)[k]! / 100, year, o.held![k]! / 100),
        leans: through(log?.lean, (n) => leanUnpacked(n)[k]!, year, lean),
      };
    });
    blocks.push({
      type: "beliefs",
      title: "What it has seen work",
      rows,
      note: "Each of its four numbers between its two ends: where it stands, and the end its evidence favours, brighter the more evidence there is, its own apart from what it saw befall others. Nothing here is a written lesson: it is how realms stood against how they fared.",
    });
  }
  const marks: EvidenceMark[] = taught
    .filter((x) => x.event && x.moved && world.events.get(x.event))
    .map((x) => {
      const most = Math.max(1, ...x.moved!.map((v) => Math.abs(v)));
      return {
        year: x.year,
        ref: x.event!,
        own: !x.of,
        color: realmColor(x.whose ?? r.ref),
        ...(x.whose ? { realm: x.whose } : {}),
        fared: (x.came?.[0] ?? 0) / 100,
        weight: (x.weight ?? 100) / 100,
        moved: x.moved!.map((v) => v / most),
        words: `Year ${x.year}: ${taughtWords(x)}.`,
      };
    });
  if (marks.length) {
    const first = Math.min(...marks.map((m) => m.year));
    blocks.push({
      type: "evidence",
      title: "Where it came from",
      from: Math.min(first, year - 20),
      to: year,
      marks,
    });
  }
  // Whom it learned from (kept, the few it learned most from), and who learned from it (every living realm that keeps it so).
  const realms = politiesOf(world),
    by = (list: [string, number][]): TaughtBy[] => {
      const all = list.reduce((s, x) => s + x[1], 0) || 1;
      return list.map(([ref, w]) => {
        const p = realms.get(ref as Ref);
        return {
          // (By its seat's name, as a chart's narrow columns hold it; its page says what it is.)
          name: p ? p.town : "a realm gone",
          ref,
          color: realmColor(ref),
          share: w / all,
        };
      });
    },
    to: [string, number][] = [];
  if (store)
    for (const q of realms.living()) {
      if (q.ref === r.ref) continue;
      const w = store.of(q.ref)?.from?.find((x) => x[0] === r.ref)?.[1];
      if (w) to.push([q.ref, w]);
    }
  to.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const from = o.from ?? [];
  if (from.length || to.length)
    blocks.push({
      type: "taught",
      title: "Whom it learned from, and who from it",
      self: { name: r.town, ref: r.ref, color: realmColor(r.ref) },
      from: by(from),
      to: by(to.slice(0, 6)),
    });
  return blocks;
}
