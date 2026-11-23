// A prison's page lines, and a court's held by name (sim/order/deeds.ts, sim/order/institutions.ts): who is held where, by
// which court, since when and until when. Level: the count held is a number a land (the court's, by its law and how it is
// manned); those named are the few the world keeps by name whom a court sentenced (a group's head, a boss, one of name).
// Pure reads.
import type { World } from "../../kernel/index.ts";
import type { Item, Line } from "../../bridge/index.ts";
import { DOES } from "../../rules/index.ts";
import {
  BODY_ROW,
  bodyLandsStore,
  bodyTitle,
  populationContext,
  type Body,
} from "../../sim/index.ts";
import { bodiesIn, bodyRef } from "../bodies.ts";
import { bodyWords } from "../../causal/index.ts";
import { count, item, link, yearNow } from "./words.ts";
import { lockedNow, type Case } from "./justice.ts";
import { townHeld, townPrison, townSentences } from "../sentenced.ts";

/** Those a court holds by name now, as list items: who, what they were, since and until. */
export function inmateItems(world: World, court: Readonly<Body>): Item[] {
  const year = yearNow(world);
  return (court.inmates ?? [])
    .filter((x) => x.u > year)
    .map((x) =>
      item(
        [
          link(x.n, x.r),
          `, ${x.w}: ${x.l ? "at labour" : "held"} since year ${x.y}, until year ${x.u}`,
        ],
        null,
        x.y,
      ),
    );
}

/**
 * What a town's prison holds: its share of those its land's court holds (a number: the court's, by its law and how it is
 * manned), the court, and who of them is known by name and why: those the court sentenced whom the world keeps (a group's
 * head, a boss, one of name), and those of the town's own lines whose case this year or last keeps them locked up or at the
 * works (host/inspect/justice.ts: the town's cases are the few of the court's many that are told one by one).
 */
export function prisonLines(world: World, cell: number, town: number, townRef?: string): Line[] {
  // (Where its land's court's sentences are kept, the prison holds its own count, and names its own: host/sentenced.ts.)
  const kept = townRef ? sentencedLines(world, cell, townRef) : null;
  if (kept) return kept;
  const court = bodiesIn(world, cell).find((x) => x.g.does === DOES.judge)?.g,
    row = bodyLandsStore(world)?.get(cell),
    held = row ? row[BODY_ROW.held]! : 0,
    people = populationContext(world).provinces.get(cell)?.total() ?? 0,
    // (The town's own lines, each once: one held by last year's case and tried again this year is one person.)
    own = (townRef ? lockedNow(world, townRef) : []).filter(
      (c, i, all) =>
        !c.accused.outside && all.findIndex((x) => x.accused.ref === c.accused.ref) === i,
    ),
    named = court ? inmateItems(world, court) : [];
  if (!court || !(held > 0)) {
    // (No court of its land holds anyone: only those its own town's cases keep.)
    const lines: Line[] = [
      [
        own.length
          ? "No court holds anyone of this land now: it keeps only those this town's own cases have locked up."
          : "No court holds anyone of this land now: it stands empty, or nearly.",
      ],
    ];
    for (const c of own) lines.push(ownLine(c));
    return lines;
  }
  // (Never fewer than those its cases name: the named are of the held.)
  const here = Math.max(
      own.length + named.length,
      Math.min(
        Math.round(held),
        Math.round(held * Math.min(1, people > 0 ? (2 * town) / people : 1)),
      ),
    ),
    all = Math.max(here, Math.round(held));
  const lines: Line[] = [
    [
      `It keeps some ${count(here)} of the ${count(all)} whom `,
      link(
        bodyWords(court.name, bodyTitle(populationContext(world), court as Body)),
        bodyRef(court.event),
      ),
      " holds of this land: those it sentenced and did not fine, bind out or put to death.",
    ],
    [
      own.length + named.length
        ? `Of them, ${count(own.length + named.length)} ${own.length + named.length === 1 ? "is" : "are"} known by name; the rest are a number the court keeps.`
        : "None of them is known by name now: they are a number the court keeps.",
    ],
  ];
  for (const x of named) lines.push(["Held by name: ", ...x.line]);
  for (const c of own) lines.push(ownLine(c));
  return lines;
}

/** A town's share of a land's count, said as a round number where it is one ("some 1,200"), and as it is where few. */
const about = (n: number): string => (n >= 20 ? `some ${count(n)}` : count(n));

/**
 * A town's prison as its land's court's sentences fill it (sim/order/sentences.ts): those it holds of the town (the town's share of
 * the land's count, by its people), how many at the works, what the court did this year past, and those of the town's own lines
 * it holds by name (host/sentenced.ts), and the few the world keeps by name. Null where no sentences are kept for the land.
 */
function sentencedLines(world: World, cell: number, townRef: string): Line[] | null {
  const here = townPrison(world, townRef);
  if (!here) return null;
  const court = bodiesIn(world, cell).find((x) => x.g.does === DOES.judge)?.g,
    year = yearNow(world),
    last = townSentences(world, townRef, year - 1),
    held = townHeld(world, townRef),
    named = court ? inmateItems(world, court) : [],
    courtLink = court
      ? link(
          bodyWords(court.name, bodyTitle(populationContext(world), court as Body)),
          bodyRef(court.event),
        )
      : "its land's court",
    lines: Line[] = [
      here.inside > 0
        ? [
            `It holds ${about(here.inside)} of this town's people whom `,
            courtLink,
            ` sentenced${here.labour > 0 ? `, ${count(here.labour)} of them put to labour at the realm's works` : ""}.`,
          ]
        : ["It stands empty, or nearly: no one of this town is held by its court now."],
    ];
  if (last && last.brought > 0)
    lines.push([
      `Last year the court heard ${about(last.brought)} of the town's people: ${[
        last.fined ? `${count(last.fined)} fined` : "",
        last.held ? `${count(last.held)} held` : "",
        last.labour ? `${count(last.labour)} put to labour` : "",
        last.death ? `${count(last.death)} put to death` : "",
        last.acquitted ? `${count(last.acquitted)} found not guilty` : "",
      ]
        .filter(Boolean)
        .join(", ")}.`,
    ]);
  for (const x of named) lines.push(["Held by name: ", ...x.line]);
  // (The first few by name; the town's page lists them all.)
  for (const h of held.slice(0, PRISON_NAMED))
    lines.push([
      "Of the town: ",
      link(h.name, h.holder.ref),
      `, ${h.labour ? "at labour" : "held"} since year ${h.year}, until year ${h.until}`,
    ]);
  if (held.length > PRISON_NAMED)
    lines.push([`And ${count(held.length - PRISON_NAMED)} more of the town's own named.`]);
  return lines;
}
const PRISON_NAMED = 6;

/** One of the town's own held by a case: who, what they do, since when, and what for (their case's page). */
function ownLine(c: Case): Line {
  return [
    "Held by name: ",
    link(c.accused.name, c.accused.ref),
    `, ${c.accused.work}: ${c.sentence === "labour" ? "at labour" : "locked up"} since year ${c.year}, ${c.accused.name.split(" ")[0]} `,
    link(c.whatWords, c.ref),
  ];
}
