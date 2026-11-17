// The society sweep in words (sim/society): a realm first paying its old a pension and the care of its poor, and its law first
// written. Every number is the event's own.
import { yearOfMoment } from "../kernel/index.ts";
import { CARE_EVENTS, HOLDING_EVENTS, politiesOf, realmName } from "../sim/index.ts";
import { registerDecisionWords, registerEventWords } from "./why.ts";

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s),
  year = (t: number) => `year ${yearOfMoment(t)}`,
  realm = (d: { realm?: string } | null) => cap(d?.realm ?? "a realm"),
  subject = (world: Parameters<typeof politiesOf>[0], ref: string) => {
    const p = politiesOf(world).get(ref as never);
    return cap(p ? realmName(p) : "a realm");
  };

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
