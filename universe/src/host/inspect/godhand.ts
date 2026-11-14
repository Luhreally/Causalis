// What the god's hand through one it entered did to a realm (2026-11-13), on its page: the hosts it stood up for it and
// how many of them still stand, and each thing it did to it lately, in the annals' own words. Pure reads.
import { yearOfMoment, type World } from "../../kernel/index.ts";
import { GOD_EVENTS, godHostsOf, type Polity } from "../../sim/index.ts";
import type { Block, Line } from "../../bridge/index.ts";
import { claimOf, link } from "./words.ts";

/** How many years a thing the god's hand did is told on the page. */
const TOLD_FOR = 30;
/** How far back among the world's events the page looks for them. */
const LOOK_BACK = 20000;
const many = (n: number) => `${Math.round(n)}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** The god's hosts standing for a realm, and what the god's hand did to it lately (nothing, for nearly every realm). */
export function godBlocks(world: World, r: Polity): Block[] {
  const year = yearOfMoment(world.now),
    hosts = godHostsOf(world)?.of(r.ref) ?? [],
    done: Line[] = [],
    events = world.events.all();
  for (let i = events.length - 1; i >= 0 && i > events.length - LOOK_BACK && done.length < 8; i--) {
    const e = events[i]!;
    if (yearOfMoment(e.t) < year - TOLD_FOR) break;
    if (e.type === GOD_EVENTS.did.type && e.subjects.includes(r.ref))
      done.push([link(claimOf(world, e.id), e.id)]);
  }
  if (!hosts.length && !done.length) return [];
  return [
    {
      type: "text",
      title: "🌟 The god's hand on it",
      lines: [
        ...hosts.map((h) => [
          link(`${many(h.raised)} stood up by the god at ${r.town} in year ${h.year}`, h.event),
          `, bearing ${h.arms}: ${many(h.men)} stand in its host.`,
        ]),
        ...done,
      ],
    },
  ];
}
