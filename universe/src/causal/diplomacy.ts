// Two realms' regard in words (docs/architecture §21, §13): friends, at peace,
// wary, rivals — and why, term by term, each resting on what it names: the faith
// they share or do not, the trade road between them, the land one took, the
// famine that makes one covet the other's stores.
import { parseRef, yearOfMoment, type CauseRef, type Ref } from "../kernel/index.ts";
import {
  DIPLOMACY_EVENTS,
  PACT,
  POLITY,
  RELATION,
  RIVALRY,
  diplomacyOf,
  politiesOf,
  realmName,
} from "../sim/index.ts";
import { edges, registerEventWords, registerExplainer } from "./why.ts";

/** How two realms stand, in a word. */
export function standingWords(opinion: number, pact: boolean): string {
  if (pact) return "sworn friends";
  if (opinion > PACT) return "friendly";
  if (opinion >= 0) return "at peace";
  if (opinion > RIVALRY) return "wary of each other";
  return "rivals";
}

registerExplainer(RELATION.code, (world, ref) => {
  if (!world.storeNames().includes("diplomacy.relations")) return null;
  const { a, b } = parseRef(ref),
    ra = `${POLITY.code}:0:${a}` as Ref,
    rb = `${POLITY.code}:0:${b}` as Ref,
    rel = diplomacyOf(world).get(ra, rb),
    realms = politiesOf(world),
    pa = realms.get(ra),
    pb = realms.get(rb);
  if (!rel || !pa || !pb) return null;
  const terms = [...rel.terms].sort((x, y) => Math.abs(y.value) - Math.abs(x.value)),
    claim = `${realmName(pa)} and ${realmName(pb)} are ${standingWords(rel.opinion, !!rel.pact)} (${rel.opinion >= 0 ? "+" : ""}${rel.opinion.toFixed(2)}): ${terms
      .map((t) => `${t.name} ${t.value >= 0 ? "+" : ""}${t.value.toFixed(2)}`)
      .join(", ")}`;
  const total = terms.reduce((s, t) => s + Math.abs(t.value), 0) || 1,
    causes: CauseRef[] = terms
      .filter((t) => t.source)
      .map((t) => ({
        ref: t.source!,
        role: t.value >= 0 ? "enabler" : "pressure",
        weight: Math.abs(t.value) / total,
      }));
  if (rel.pact) causes.push({ ref: rel.pact, role: "enabler", weight: 0.1 });
  return { ref, claim, basis: "recorded", t: null, causes: edges(world, causes.slice(0, 6)) };
});

const data = (d: unknown, k: string) => {
  const v = (d as Readonly<Record<string, unknown>> | null)?.[k];
  return typeof v === "string" ? v : "";
};
registerEventWords(
  DIPLOMACY_EVENTS.pact.type,
  (_, e) =>
    `${cap(data(e.data, "a"))} and ${data(e.data, "b")} swore friendship, for ${data(e.data, "reason")}, year ${yearOfMoment(e.t)}`,
);
registerEventWords(
  DIPLOMACY_EVENTS.broken.type,
  (_, e) =>
    `The friendship of ${data(e.data, "a")} and ${data(e.data, "b")} broke over ${data(e.data, "reason")}, year ${yearOfMoment(e.t)}`,
);

function cap(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}
