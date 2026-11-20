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

/** What a town's prison holds: its share of those its land's court holds, the court, and those held by name. */
export function prisonLines(world: World, cell: number, town: number): Line[] {
  const court = bodiesIn(world, cell).find((x) => x.g.does === DOES.judge)?.g,
    row = bodyLandsStore(world)?.get(cell),
    held = row ? row[BODY_ROW.held]! : 0,
    people = populationContext(world).provinces.get(cell)?.total() ?? 0;
  if (!court || !(held > 0))
    return [["No court holds anyone of this land now: it stands empty, or nearly."]];
  const here = Math.max(1, Math.round(held * Math.min(1, people > 0 ? (2 * town) / people : 1)));
  const lines: Line[] = [
    [
      `It keeps some ${count(Math.min(here, Math.round(held)))} of the ${count(Math.round(held))} whom `,
      link(
        bodyWords(court.name, bodyTitle(populationContext(world), court as Body)),
        bodyRef(court.event),
      ),
      " holds of this land: those it sentenced and did not fine, bind out or put to death.",
    ],
  ];
  for (const x of inmateItems(world, court)) lines.push(["Held by name: ", ...x.line]);
  return lines;
}
