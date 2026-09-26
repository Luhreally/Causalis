// Realms in words (docs/architecture §21, §13): what a realm is — who leads, how
// rule passes, what law holds, how many lands, who rules now — and why: the
// decision that founded it, its ruler's coming to power, the ways of its people.
// And its events and decisions, said plainly.
import { yearOfMoment, type CauseRef } from "../kernel/index.ts";
import { POLITY, POLITY_EVENTS, cultureOf, politiesOf, realmName } from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { waysRef } from "./culture.ts";
import { count } from "./words.ts";
import { edges, registerDecisionWords, registerEventWords, registerExplainer } from "./why.ts";

const LEADS = [
  "a chief leads it",
  "a council of elders leads it",
  "an assembly of its people leads it",
  "a priest-king leads it",
];
const PASSES = ["rule passes by birth", "its leaders are chosen", "its leaders are acclaimed"];
const HOLDS = ["custom is its law", "decree is its law", "sacred law holds"];

/** How a realm is ruled, in words: "a chief leads it, rule passes by birth, custom is its law". */
export function governmentWords(p: {
  leadership: number;
  succession: number;
  law: number;
}): string {
  return `${LEADS[p.leadership]}, ${PASSES[p.succession]}, ${HOLDS[p.law]}`;
}

registerExplainer(POLITY.code, (world, ref) => {
  if (!world.storeNames().includes("polity.states")) return null;
  const p = politiesOf(world).get(ref);
  if (!p) return null;
  const year = yearOfMoment(world.now),
    claim =
      p.ended !== null
        ? `${realmName(p)}, founded in year ${p.founded}, ended in year ${p.ended}`
        : `${realmName(p)}: ${count(p.members.length)} land${p.members.length === 1 ? "" : "s"} ruled from ${p.town}; ${LEADS[p.leadership]}, ${PASSES[p.succession]}, ${HOLDS[p.law]}; ${p.ruler.name} has ruled since year ${p.ruler.since}, now ${year - p.ruler.born}`;
  const causes: CauseRef[] = [
    { ref: p.event, role: "trigger", weight: 0.5 },
    { ref: p.ruler.event, role: "agent", weight: 0.2 },
  ];
  if (cultureOf(world).get(p.seat))
    causes.push({ ref: waysRef(p.seat), role: "enabler", weight: 0.3 });
  return { ref, claim, basis: "recorded", t: null, causes: edges(world, causes) };
});

type Data = Readonly<Record<string, unknown>> | null;
const text = (d: unknown, k: string) => {
  const v = (d as Data)?.[k];
  return typeof v === "string" ? v : null;
};
const year = (t: number) => `year ${yearOfMoment(t)}`;
const realm = (d: unknown) => text(d, "name") ?? "a realm";

registerEventWords(
  POLITY_EVENTS.formed.type,
  (world, e) => `${cap(realm(e.data))} was founded in ${landWords(world, e.place)}, ${year(e.t)}`,
);
registerEventWords(
  POLITY_EVENTS.joined.type,
  (world, e) => `${cap(landWords(world, e.place))} joined ${realm(e.data)}, ${year(e.t)}`,
);
registerEventWords(
  POLITY_EVENTS.seceded.type,
  (world, e) => `${cap(landWords(world, e.place))} broke away from ${realm(e.data)}, ${year(e.t)}`,
);
registerEventWords(POLITY_EVENTS.succession.type, (_, e) => {
  const old = text(e.data, "old");
  return `${old ? `${old} died, and ` : ""}rule of ${realm(e.data)} passed on, ${year(e.t)}`;
});
registerEventWords(POLITY_EVENTS.split.type, (_, e) => {
  const lands = (e.data as Data)?.lands;
  return `${cap(realm(e.data))} broke apart at a death: ${typeof lands === "number" ? count(lands) : "its far"} land${lands === 1 ? "" : "s"} went their own way, ${year(e.t)}`;
});
registerEventWords(POLITY_EVENTS.reformed.type, (_, e) => {
  const to = text(e.data, "to");
  return `${cap(realm(e.data))} changed how it is ruled${to ? `: ${to}` : ""}, ${year(e.t)}`;
});
registerEventWords(
  POLITY_EVENTS.ended.type,
  (_, e) => `${cap(realm(e.data))} came to an end, ${year(e.t)}`,
);

registerEventWords(POLITY_EVENTS.tithe.type, (_, e) => {
  const d = e.data as { from?: number; to?: number } | null,
    from = d?.from ?? 0,
    to = d?.to ?? 0;
  return `${cap(realm(e.data))} ${to > from ? "raised" : "eased"} its tithe from ${from} to ${to} parts in a hundred of the grain, ${year(e.t)}`;
});

registerDecisionWords("polity.form", (world, d) => {
  const lead = text(d.outcome, "leadership");
  return `The people of ${landWords(world, d.subject)} gathered under ${lead ? `a ${lead}` : "one rule"}`;
});
registerDecisionWords(
  "polity.join",
  (world, d) => `${cap(landWords(world, d.subject))} chose to join a realm`,
);
registerDecisionWords("polity.tithe", (world, d) => {
  const p = politiesOf(world).get(d.subject);
  return `The seat of ${p ? realmName(p) : "a realm"} weighed what its people wanted of the tithe`;
});
registerDecisionWords(
  "polity.secede",
  (world, d) => `${cap(landWords(world, d.subject))} chose to break away`,
);

function cap(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}
