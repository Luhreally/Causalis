// Strife in words (Phase 22 M145): a general seizing a realm's seat, a coup foiled and its
// plotters purged, a realm's own rule restored after its army's; the god's hand stirring an army
// against its seat, or giving a realm back its rule. (M146: a throne taken in a civil war, a rising
// put down, a revolution won or drowned in blood; a pretender raised by the god's hand.)
import { yearOfMoment, type Ref } from "../kernel/index.ts";
import { cellRef } from "../gen/index.ts";
import { STRIFE_ACTS, STRIFE_EVENTS, politiesOf, realmName } from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { count } from "./words.ts";
import { registerCommandWords, registerDecisionWords, registerEventWords } from "./why.ts";

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s),
  year = (t: number) => `year ${yearOfMoment(t)}`;
type Data = {
  realm?: string;
  general?: string;
  from?: string;
  to?: string;
  years?: number;
} | null;

registerEventWords(STRIFE_EVENTS.coup.type, (world, e) => {
  const d = e.data as Data,
    p = e.subjects[0] ? politiesOf(world).get(e.subjects[0]) : undefined;
  return `${d?.general ?? "A general"} seized the seat of ${d?.realm ?? "a realm"} in a coup: it became ${p ? realmName(p) : "a protectorate"}, ruled by its army, ${year(e.t)}`;
});
registerEventWords(STRIFE_EVENTS.foiled.type, (_world, e) => {
  const d = e.data as Data;
  return `A coup in ${d?.realm ?? "a realm"} was foiled: ${d?.general ?? "its general"} and the plotters were purged, ${year(e.t)}`;
});
registerEventWords(STRIFE_EVENTS.restored.type, (_world, e) => {
  const d = e.data as Data,
    years = d?.years ?? 0;
  return `${cap(d?.realm ?? "a realm")} was given back its own rule after ${years} year${years === 1 ? "" : "s"} of its army's: it is ${d?.to ?? "itself"} again, ${year(e.t)}`;
});
registerEventWords(STRIFE_EVENTS.throne.type, (_world, e) => {
  const d = e.data as (Data & { a?: string; b?: string; ruler?: string; kind?: string }) | null;
  return d?.kind === "freed"
    ? `${cap(d?.a ?? "a realm")} took back the freed of ${d?.b ?? "a realm"}, and bound them again, ${year(e.t)}`
    : `${d?.ruler ?? "A claimant"} of ${d?.a ?? "a realm"} took the seat of ${d?.b ?? "a realm"}, and its throne, ${year(e.t)}`;
});
registerEventWords(STRIFE_EVENTS.subdued.type, (_world, e) => {
  const d = e.data as (Data & { a?: string; b?: string }) | null;
  return `The rising of ${d?.a ?? "a realm"} was put down: its lands returned to ${d?.b ?? "its realm"}, ${year(e.t)}`;
});
registerEventWords(STRIFE_EVENTS.parted.type, (_world, e) => {
  const d = e.data as (Data & { a?: string; b?: string }) | null;
  return `${cap(d?.a ?? "a realm")} kept the lands it rose with, parted from ${d?.b ?? "its realm"} for good, ${year(e.t)}`;
});
registerDecisionWords("strife.subdue", (world, d) => {
  const p = politiesOf(world).get(d.subject),
    o = d.outcome as { subdued?: boolean; rebel?: string } | null,
    rebel = o?.rebel ? politiesOf(world).get(o.rebel as Ref) : undefined;
  return o?.subdued
    ? `${cap(p ? realmName(p) : "a realm")} put down the rising of ${rebel ? realmName(rebel) : "its far lands"}`
    : `${cap(p ? realmName(p) : "a realm")} could not put down the rising of ${rebel ? realmName(rebel) : "its far lands"}`;
});
registerEventWords(STRIFE_EVENTS.revolution.type, (_world, e) => {
  const d = e.data as (Data & { cause?: string }) | null;
  return `The people of ${d?.realm ?? "a realm"} rose at its seat for ${d?.cause === "land" ? "the land" : "a voice"} and overthrew its court: it is ${d?.to ?? "a commonwealth"} now, ${year(e.t)}`;
});
registerEventWords(STRIFE_EVENTS.repressed.type, (_world, e) => {
  const d = e.data as (Data & { cause?: string; dead?: number }) | null;
  return `The people of ${d?.realm ?? "a realm"} rose at its seat for ${d?.cause === "land" ? "the land" : "a voice"}, and were drowned in blood${d?.dead ? `: ${count(d.dead)} dead` : ""}, ${year(e.t)}`;
});
registerEventWords(
  STRIFE_ACTS.pretender.type,
  (world, e) =>
    `By the god's hand a pretender rose in ${landWords(world, e.place)} against ${(e.data as Data)?.realm ?? "a realm"}, ${year(e.t)}`,
);
registerCommandWords(
  "act.pretender",
  (world, c) =>
    `Your act: you raised a pretender in ${landWords(world, cellRef(0, (c.args as { cell: number }).cell))}, year ${yearOfMoment(c.t)}`,
);
registerDecisionWords("strife.civil", (world, d) => {
  const p = politiesOf(world).get(d.subject),
    kind = (d.outcome as { kind?: string } | null)?.kind;
  return `${cap(p ? realmName(p) : "a realm")} went to war ${kind === "freed" ? "to take back the freed" : "for the throne"}`;
});
registerDecisionWords("strife.revolution", (world, d) => {
  const p = politiesOf(world).get(d.subject),
    won = (d.outcome as { won?: boolean } | null)?.won;
  return `The people of ${p ? realmName(p) : "a realm"} rose at its seat${won ? "" : ", and were crushed"}`;
});
registerEventWords(
  STRIFE_ACTS.incite.type,
  (_world, e) =>
    `By the god's hand the army of ${(e.data as Data)?.realm ?? "a realm"} was stirred against its seat, ${year(e.t)}`,
);
registerEventWords(
  STRIFE_ACTS.restore.type,
  (_world, e) =>
    `By the god's hand ${(e.data as Data)?.realm ?? "a realm"} was given back its own rule, ${year(e.t)}`,
);
registerCommandWords(
  "act.incite",
  (world, c) =>
    `Your act: you stirred the army of the realm holding ${landWords(world, cellRef(0, (c.args as { cell: number }).cell))} against its seat, year ${yearOfMoment(c.t)}`,
);
registerCommandWords(
  "act.restore",
  (world, c) =>
    `Your act: you gave the realm holding ${landWords(world, cellRef(0, (c.args as { cell: number }).cell))} back its own rule, year ${yearOfMoment(c.t)}`,
);

registerDecisionWords("strife.coup", (world, d) => {
  const p = politiesOf(world).get(d.subject),
    won = (d.outcome as { won?: boolean } | null)?.won;
  return `The army of ${p ? realmName(p) : "a realm"} reached for its seat${won ? "" : ", and was foiled"}`;
});
registerDecisionWords("strife.restore", (world, d) => {
  const p = politiesOf(world).get(d.subject);
  return `${cap(p ? realmName(p) : "a realm")} was given back its own rule`;
});
