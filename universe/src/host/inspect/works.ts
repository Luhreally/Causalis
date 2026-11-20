// Works as pages (sim/ideas/works.ts): a work someone of name made (who, for whom, when, as what, what it remembers, what it
// does), a land's works, and the world's side by side.
import type { World } from "../../kernel/index.ts";
import type { Block, PageModel, Place, Row, Stat } from "../../bridge/index.ts";
import { NOTE, WORK, WORK_FORMS, creditLeft, workRenownNow } from "../../rules/index.ts";
import {
  notablesOf,
  politiesOf,
  realmName,
  workId,
  workRef,
  worksOf,
  type Work,
} from "../../sim/index.ts";
import { workFormWords, workThemeWords } from "../../causal/index.ts";
import { bodyRef } from "../bodies.ts";
import { houseRef } from "../family.ts";
import { realmColor } from "../colors.ts";
import { count, link, many, sentence, stat, yearNow } from "./words.ts";
import { landLink, landTitle, spotOfLand } from "./names.ts";
import { namedRef } from "./notables.ts";

type Linked = ReturnType<typeof link>;

/** A work as a link. */
export function workLink(w: Work): Linked {
  return link(`"${w.title}"`, workRef(w.id));
}

function makerOf(world: World, w: Work): Linked {
  const kept = notablesOf(world),
    known = kept?.get(w.maker) ?? kept?.goneOf(w.maker);
  return known ? link(w.by, namedRef(w.maker)) : w.by;
}

/** Who paid for it, as a link where they still stand. */
function patronOf(world: World, w: Work): Linked[] {
  const p = w.patron,
    realm = politiesOf(world).get(p.realm);
  if (p.kind === "seat")
    return ["the seat of ", realm ? link(realmName(realm), realm.ref) : p.name];
  if (p.kind === "house") return ["the house of ", link(p.name, houseRef(p.realm, p.ref))];
  return [link(p.name, bodyRef(p.ref))];
}

const lines = (renown: number): string => `${(renown / NOTE.line).toFixed(1)} lines`;

export function workPage(world: World, ref: string): PageModel {
  const store = worksOf(world),
    w = store?.get(workId(ref));
  if (!store || !w) throw new Error(`no work ${ref}`);
  const year = yearNow(world),
    age = year - w.year,
    form = workFormWords(world, WORK_FORMS[w.form] ?? "told"),
    theme = workThemeWords(w.theme),
    now = workRenownNow(w.renown, age),
    credit = creditLeft(age),
    spot = spotOfLand(world, w.land),
    place: Place | null = spot === null ? null : { scale: "globe", spot },
    color = realmColor(`${ref}:work`),
    does: Stat[] = [
      stat("Carries a memory", `${theme} of year ${count(w.ofYear)}`, {
        why: w.of,
        parts: [
          {
            label: ["what its realm remembers of it fades the slower while the work is kept"],
            value: `${Math.round(WORK.remembers * 100)}% slower`,
          },
        ],
      }),
      stat("Adds to its land's renown", lines(now), {
        parts: [
          { label: ["its renown when made"], value: lines(w.renown) },
          { label: ["what the years have left of it"], value: lines(now) },
        ],
      }),
      stat(
        "Credits its patron",
        credit >= 1 ? "in full" : credit > 0 ? `${Math.round(credit * 100)}% left` : "no longer",
        {
          parts: [
            {
              label: [
                w.patron.kind === "seat"
                  ? "a seat is held the more rightful for works made for it"
                  : w.patron.kind === "house"
                    ? "a house stands higher among the great for works it paid for"
                    : "a body was held the better run for keeping its maker",
              ],
              value: "",
            },
          ],
        },
      ),
    ];
  return {
    ref,
    kind: "work",
    icon: "🎭",
    portrait: { kind: "sign", color, tenet: "teaching" },
    title: `"${w.title}"`,
    subtitle: [sentence(`${form} of ${theme}, made in year ${count(w.year)}`)],
    color,
    place,
    stats: [
      stat("Made", `year ${count(w.year)}`, { why: w.event }),
      stat("Renown", lines(now)),
      stat("Remembers", `year ${count(w.ofYear)}`, { why: w.of }),
    ],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "facts",
            rows: [
              stat("Made by", [makerOf(world, w)], { why: w.event }),
              stat("For", patronOf(world, w)),
              stat("As", form),
              stat("Kept in", [landLink(world, w.land)]),
              stat("Remembers", `${theme}, year ${count(w.ofYear)}`, { why: w.of }),
            ],
          },
          { type: "facts", title: "What it does", rows: does },
          { type: "why", title: "What it remembers", ref: w.of },
          { type: "why", title: "How it came to be made", ref: w.event },
        ],
      },
    ],
    followable: false,
    year,
  };
}

const rowOf = (world: World, w: Work, year: number, land: boolean): Row => {
  const form = workFormWords(world, WORK_FORMS[w.form] ?? "told"),
    theme = workThemeWords(w.theme),
    now = workRenownNow(w.renown, year - w.year);
  return {
    ref: workRef(w.id),
    cells: [
      [workLink(w)],
      [form],
      [makerOf(world, w)],
      patronOf(world, w),
      [`${theme} (${count(w.ofYear)})`],
      [`year ${count(w.year)}`],
      [lines(now)],
      ...(land ? [[landLink(world, w.land)]] : []),
    ],
    keys: [
      w.title,
      form,
      w.by,
      w.patron.name,
      theme,
      w.year,
      now,
      ...(land ? [landTitle(world, w.land)] : []),
    ],
  };
};
const COLUMNS = ["Work", "As", "By", "For", "Remembers", "Made", "Renown"];

/** A land's works for its page (null: none kept there). */
export function landWorksBlock(world: World, cell: number): Block | null {
  const works = worksOf(world)?.in(cell);
  if (!works || !works.length) return null;
  const year = yearNow(world);
  return {
    type: "table",
    title: "Works kept here",
    columns: COLUMNS,
    rows: [...works].sort((a, b) => b.year - a.year).map((w) => rowOf(world, w, year, false)),
  };
}

/** The world's works side by side: the most renowned (the ledger's Culture section, under the schools). */
export function worksLedger(world: World, most = 60): Block[] {
  const store = worksOf(world);
  if (!store || !store.all().length) return [];
  const year = yearNow(world),
    all = [...store.all()].sort(
      (a, b) =>
        workRenownNow(b.renown, year - b.year) - workRenownNow(a.renown, year - a.year) ||
        a.id - b.id,
    );
  return [
    {
      type: "table",
      title: "Works of name",
      columns: [...COLUMNS, "Kept in"],
      rows: all.slice(0, most).map((w) => rowOf(world, w, year, true)),
    },
    ...(all.length > most
      ? [
          {
            type: "text" as const,
            lines: [[`And ${many(all.length - most, "work", "works")} of less renown.`]],
          },
        ]
      : []),
  ];
}

/** The works a notable made, for their page (none: nothing). */
export function worksBy(world: World, maker: number): Work[] {
  return (worksOf(world)?.all() ?? []).filter((w) => w.maker === maker);
}
