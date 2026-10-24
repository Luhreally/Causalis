// Sickness in words (Phase 20 M140): a sickness's nature and its rising; its coming to a land —
// whence, by what, and how many it took; its waking where it slept; the god's ward and the god's
// pestilence.
import { yearOfMoment, type CauseRef, type Ref } from "../kernel/index.ts";
import { cellRef } from "../gen/index.ts";
import {
  HEALTH_ACTS,
  HEALTH_EVENTS,
  SICKNESS,
  healthOf,
  type Route,
  type Sickness,
  type Source,
  type Via,
} from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { count } from "./words.ts";
import {
  edges,
  registerCommandWords,
  registerDecisionWords,
  registerEventWords,
  registerExplainer,
} from "./why.ts";

/** How a sickness passes, in words. */
export const ROUTE_WORDS: Readonly<Record<Route, string>> = {
  breath: "on the breath",
  water: "in foul water",
  vermin: "by vermin",
  touch: "by touch",
};
/** Where a sickness rose, in words. */
export const SOURCE_WORDS: Readonly<Record<Source, string>> = {
  herds: "among the herds",
  crowds: "in the crowds",
  marsh: "in the hot marshes",
  "the god": "by the god's hand",
};
/** What carried a sickness, in words. */
export const VIA_WORDS: Readonly<Record<Via, string>> = {
  near: "from the land next door",
  road: "down a trade road",
  sea: "over the sea",
  army: "with an army",
  god: "by the god's hand",
};

/** A share, as "one in N" or "N in a hundred". */
export function oneIn(x: number): string {
  if (x <= 0) return "none";
  if (x >= 0.995) return "all";
  if (x >= 0.1) return `${Math.round(x * 100)} in a hundred`;
  return `one in ${Math.round(1 / x)}`;
}

/** How long the survivors of a sickness are spared it, in words. */
export function sparedWords(s: Pick<Sickness, "lasting">): string {
  return s.lasting >= 60 ? "for life" : `for some ${s.lasting} years`;
}

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s),
  year = (t: number) => `year ${yearOfMoment(t)}`;
type Data = {
  sickness?: string;
  source?: Source;
  route?: Route;
  from?: number | null;
  via?: Via | null;
  people?: number;
  dead?: number;
  bound?: number;
} | null;

registerExplainer(SICKNESS.code, (world, ref) => {
  const s = healthOf(world)?.get(ref);
  if (!s) return null;
  const claim = `${cap(s.name)}: it passes ${ROUTE_WORDS[s.route]}; of those it reaches who never had it, ${oneIn(s.reach)} take it, and of those ${oneIn(s.deadliness)} die; the survivors are spared it ${sparedWords(s)}. It rose ${SOURCE_WORDS[s.source]} of ${landWords(world, cellRef(0, s.cell))} in year ${s.year}, and has come to ${count(s.struck)} land${s.struck === 1 ? "" : "s"}, killing ${count(s.dead)}`;
  const causes: CauseRef[] = [{ ref: s.event, role: "trigger", weight: 1 }];
  return { ref, claim, basis: "recorded", t: null, causes: edges(world, causes) };
});

registerEventWords(HEALTH_EVENTS.rose.type, (world, e) => {
  const d = e.data as Data;
  return `A new sickness, ${d?.sickness ?? "a sickness"}, rose ${SOURCE_WORDS[d?.source ?? "herds"]} of ${landWords(world, e.place)}; it passes ${ROUTE_WORDS[d?.route ?? "breath"]}, ${year(e.t)}`;
});
registerEventWords(HEALTH_EVENTS.outbreak.type, (world, e) => {
  const d = e.data as Data,
    from =
      d?.from !== null && d?.from !== undefined
        ? ` ${VIA_WORDS[d.via ?? "near"]}, from ${landWords(world, cellRef(0, d.from))}`
        : d?.via === "god"
          ? " by the god's hand"
          : "",
    dead = d?.dead ?? 0,
    people = d?.people ?? 0;
  return `${cap(d?.sickness ?? "a sickness")} came to ${landWords(world, e.place)}${from}: ${count(dead)} of its ${count(people)} died${people && dead / people >= 0.15 ? ", a great dying" : ""}, ${year(e.t)}`;
});
registerEventWords(
  HEALTH_ACTS.ward.type,
  (world, e) =>
    `By the god's ward the people of ${landWords(world, e.place)} were spared every sickness they knew, ${year(e.t)}`,
);
registerCommandWords(
  "act.ward",
  (world, c) =>
    `Your act: you warded ${landWords(world, cellRef(0, (c.args as { cell: number }).cell))} against sickness, year ${yearOfMoment(c.t)}`,
);
registerCommandWords("act.loose", (world, c) => {
  const a = c.args as { cell: number; sickness?: string | null },
    s = a.sickness ? healthOf(world)?.get(a.sickness) : undefined;
  return `Your act: you loosed ${s ? s.name : "a new sickness"} on ${landWords(world, cellRef(0, a.cell))}, year ${yearOfMoment(c.t)}`;
});

registerDecisionWords(
  "health.rise",
  (world, d) => `A new sickness rose in ${landWords(world, d.subject)}`,
);
registerDecisionWords("health.spread", (world, d) => {
  const s = healthOf(world)?.get(d.subject),
    o = d.outcome as { land?: Ref; via?: Via } | null;
  return `${cap(s?.name ?? "a sickness")} was carried ${VIA_WORDS[o?.via ?? "near"]} to ${o?.land ? landWords(world, o.land) : "a land"}`;
});
registerDecisionWords("health.wake", (world, d) => {
  const s = healthOf(world)?.get(d.subject),
    o = d.outcome as { land?: Ref } | null;
  return `${cap(s?.name ?? "a sickness")} woke where it slept, in ${o?.land ? landWords(world, o.land) : "its land"}`;
});
