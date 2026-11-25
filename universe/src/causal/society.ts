// The society sweep in words (sim/society): a realm first paying its old a pension and the care of its poor, and its law first
// written. Every number is the event's own.
import { yearOfMoment } from "../kernel/index.ts";
import {
  CARE_EVENTS,
  HOLDING_EVENTS,
  ORPHAN_EVENTS,
  UNABLE_EVENTS,
  politiesOf,
  realmName,
} from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { count } from "./words.ts";
import { registerDecisionWords, registerEventWords } from "./why.ts";

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s),
  year = (t: number) => `year ${yearOfMoment(t)}`,
  realm = (d: { realm?: string } | null) => cap(d?.realm ?? "a realm"),
  subject = (world: Parameters<typeof politiesOf>[0], ref: string) => {
    const p = politiesOf(world).get(ref as never);
    return cap(p ? realmName(p) : "a realm");
  };

// Orphans (sim/society/roofless.ts; rules/orphans.ts): the young a year's dying left, and who took them in.
registerEventWords(ORPHAN_EVENTS.left.type, (world, e) => {
  const d = e.data as {
    orphans?: number;
    kin?: number;
    houses?: number;
    street?: number;
    dead?: number;
  } | null;
  return `The year's dead in ${landWords(world, e.place)}, ${d?.dead ?? "many"} in a thousand of its people, left ${count(d?.orphans ?? 0)} of its young with no hearth to rear them: kin took in ${d?.kin ?? "some"} in a hundred of them, its faith's houses and its realm's ${d?.houses ?? "some"}, and ${d?.street ?? "the rest"} were left to the street, ${year(e.t)}`;
});

registerEventWords(CARE_EVENTS.pensions.type, (_w, e) => {
  const d = e.data as { realm?: string; level?: number; old?: number } | null;
  return `${realm(d)} began to pay its old a pension, ${d?.level ?? 0} in a hundred of them, its frail ${d?.old ?? 0} in a hundred of its people, ${year(e.t)}`;
});
registerEventWords(CARE_EVENTS.publicCare.type, (_w, e) => {
  const d = e.data as { realm?: string; level?: number } | null;
  return `${realm(d)} began to pay for the care of the poor its healers did not reach, ${d?.level ?? 0} in a hundred of them, ${year(e.t)}`;
});
registerEventWords(HOLDING_EVENTS.written.type, (_w, e) => {
  const d = e.data as { realm?: string; written?: number } | null;
  return `${realm(d)}'s law came to be written: its judges judge by it more than by custom, ${year(e.t)}`;
});
registerDecisionWords(
  CARE_EVENTS.pensions.type,
  (w, d) => `${subject(w, d.subject)} paid its old a pension`,
);
registerDecisionWords(
  CARE_EVENTS.publicCare.type,
  (w, d) => `${subject(w, d.subject)} paid for its poor's care`,
);
registerDecisionWords(
  HOLDING_EVENTS.written.type,
  (w, d) => `${subject(w, d.subject)} wrote its law down`,
);
registerEventWords(UNABLE_EVENTS.many.type, (world, e) => {
  const d = e.data as {
      share?: number;
      war?: number;
      sick?: number;
      smoke?: number;
      mishap?: number;
      kept?: number;
    } | null,
    parts: [string, number][] = [
      ["maimed in its realm's wars", d?.war ?? 0],
      ["weakened by its settled sicknesses", d?.sick ?? 0],
      ["short of breath in its foul air", d?.smoke ?? 0],
      ["hurt at their work", d?.mishap ?? 0],
    ],
    most = parts.sort((a, b) => b[1] - a[1])[0]!;
  return `${cap(landWords(world, e.place))} had ${d?.share ?? "many"} in a hundred of its grown unable to work${most[1] > 0 ? `, most of them ${most[0]}` : ""}${d?.kept === undefined ? "" : `, and ${d.kept} in a hundred of them kept by kin, temple, savings or pension`}, ${year(e.t)}`;
});
registerDecisionWords(
  UNABLE_EVENTS.many.type,
  (w, d) => `${cap(landWords(w, d.subject as never))} counted its unable`,
);
