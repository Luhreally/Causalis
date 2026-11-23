// A realm's gates in words (sim/population/flight.ts, rules/borders.ts): its people barred from leaving or let go, its gates
// shut to strangers or opened; and why, as the decision weighed it.
import { yearOfMoment } from "../kernel/index.ts";
import { BORDER_EVENTS, politiesOf, realmName } from "../sim/index.ts";
import { registerDecisionWords, registerEventWords } from "./why.ts";

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
type Data = {
  realm?: string;
  which?: "exit" | "entry";
  band?: number;
  from?: number;
  words?: string;
} | null;

registerEventWords(BORDER_EVENTS.gate.type, (_world, e) => {
  const d = e.data as Data,
    realm = cap(d?.realm ?? "a realm"),
    year = `year ${yearOfMoment(e.t)}`,
    closer = (d?.band ?? 0) > (d?.from ?? 0);
  if (d?.which === "exit")
    return closer
      ? `${realm} held its people in: they were ${d?.words ?? "barred from leaving"}, ${year}`
      : `${realm} let its people go: they were ${d?.words ?? "free to leave"} again, ${year}`;
  return closer
    ? `${realm} closed its gates: it was ${d?.words ?? "shut to strangers"}, ${year}`
    : `${realm} opened its gates: it was ${d?.words ?? "open to strangers"}, ${year}`;
});

registerDecisionWords("population.gate", (world, d) => {
  const p = politiesOf(world).get(d.subject),
    o = d.outcome as { which?: string; band?: number } | null,
    name = cap(p ? realmName(p) : "a realm");
  return o?.which === "exit"
    ? `${name} weighed whether its people may leave it`
    : `${name} weighed whether strangers may come into it`;
});
