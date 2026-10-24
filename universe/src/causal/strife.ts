// Strife in words (Phase 22 M145): a general seizing a realm's seat, a coup foiled and its
// plotters purged, a realm's own rule restored after its army's; the god's hand stirring an army
// against its seat, or giving a realm back its rule.
import { yearOfMoment } from "../kernel/index.ts";
import { cellRef } from "../gen/index.ts";
import { STRIFE_ACTS, STRIFE_EVENTS, politiesOf, realmName } from "../sim/index.ts";
import { landWords } from "./generated.ts";
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
