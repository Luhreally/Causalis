// A blessing or a curse laid on a realm for years (2026-11-13), on its page: how strong, for how long, what it lays on
// it this year, and what it has done since it was laid; once lifted, what it did, for a while after. Pure reads.
import { yearOfMoment, type World } from "../../kernel/index.ts";
import {
  FORTUNE_WEIGHT,
  PEOPLE_ACT_EVENTS,
  fortunesOf,
  orderOf,
  populationContext,
  type Polity,
} from "../../sim/index.ts";
import { fortuneHow, fortuneWhat } from "../../causal/index.ts";
import type { Block } from "../../bridge/index.ts";
import { claimOf, link } from "./words.ts";

/** How many years after it lifts a fortune is still told on the page. */
const TOLD_AFTER = 10;
const many = (n: number) => `${Math.round(n)}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const pct = (x: number) => Math.round(x * 100);

/** The fortunes on a realm, and the last one lifted lately. */
export function fortuneBlocks(world: World, r: Polity): Block[] {
  const out: Block[] = [],
    year = yearOfMoment(world.now),
    ctx = populationContext(world);
  for (const f of fortunesOf(world)?.over(r.ref) ?? []) {
    const curse = f.sign < 0,
      people = r.members.reduce((n, k) => n + (ctx.provinces.get(k)?.total() ?? 0), 0),
      last = f.told.at(-1) ?? f.event,
      d = world.events.get(last)?.data as { harvest?: number; sick?: number } | null | undefined,
      legit = orderOf(world)?.of(r.ref)?.legitimacy ?? 0,
      pull = FORTUNE_WEIGHT.pull * Math.max(0, f.strength - 1);
    out.push({
      type: "text",
      title: curse ? "🌑 Under the god's curse" : "🌟 Under the god's blessing",
      lines: [
        [
          link(`Laid in year ${yearOfMoment(f.from)}`, f.event),
          `, ${fortuneHow(f.strength, f.years)}: year ${f.laid} of ${f.years}, laid again at each year's turn.`,
        ],
        [
          `This year it lays ${fortuneWhat(f.sign, f.strength, d?.harvest, d?.sick)} on ${r.members.length} land${r.members.length === 1 ? "" : "s"}${d?.harvest ? `: the harvest ${curse ? "blighted" : "blessed"} on ${d.harvest}` : ""}${d?.sick ? `, ${curse ? "sickness" : "healing"} on ${d.sick}` : ""}${pull ? `; it pulls ${pct(pull)} in a hundred ${curse ? "against" : "for"} its rule` : ""}.`,
        ],
        [
          `Since it was laid: its people ${many(f.people)} to ${many(people)}, its lands ${f.lands} to ${r.members.length}, ${pct(f.legitimacy)} to ${pct(legit)} in a hundred holding its rule rightful.`,
        ],
      ],
    });
  }
  if (out.length) return out;
  // (Lifted lately: what it did, told by the world's own line for it.)
  const events = world.events.all();
  for (let i = events.length - 1; i >= 0 && i > events.length - 6000; i--) {
    const e = events[i]!;
    if (yearOfMoment(e.t) < year - TOLD_AFTER) break;
    if (e.type !== PEOPLE_ACT_EVENTS.fortuneEnd.type || !e.subjects.includes(r.ref)) continue;
    out.push({
      type: "text",
      title:
        (e.data as { sign?: number } | null)?.sign === 1
          ? "🌟 The god's blessing, lifted"
          : "🌑 The god's curse, lifted",
      lines: [[link(claimOf(world, e.id), e.id)]],
    });
    break;
  }
  return out;
}
