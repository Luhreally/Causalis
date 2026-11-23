// What a realm writes down of its rule, in words (the breadth round, 2026-11-23): a charter written or torn, a change of rule
// put to its people, powers taken past its people's say, its far towns' own councils, and who of its grown is heard.
import { yearOfMoment, type Ref } from "../kernel/index.ts";
import { CHARTER_EVENTS, politiesOf, realmName } from "../sim/index.ts";
import { registerDecisionWords, registerEventWords } from "./why.ts";

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s),
  year = (t: number) => `year ${yearOfMoment(t)}`;
type Data = Record<string, unknown> | null;
const str = (d: Data, k: string, or: string) =>
  typeof d?.[k] === "string" ? (d[k] as string) : or;
const num = (d: Data, k: string) => (typeof d?.[k] === "number" ? (d[k] as number) : 0);

registerEventWords(CHARTER_EVENTS.charter.type, (_world, e) => {
  const d = e.data as Data;
  return d?.how === "torn"
    ? `The charter of ${str(d, "realm", "a realm")}, written in year ${num(d, "since")}, was torn up by those who seized its seat, ${year(e.t)}`
    : `${cap(str(d, "realm", "a realm"))} wrote down its rule in a charter that binds its seat: changed only with ${num(d, "bar")} in a hundred of its people's say, ${year(e.t)}`;
});
registerEventWords(CHARTER_EVENTS.referendum.type, (_world, e) => {
  const d = e.data as Data;
  return `The people of ${str(d, "realm", "a realm")} were asked whether its rule should be a ${str(d, "to", "new one")}: ${num(d, "yes")} in a hundred said yes, against the ${num(d, "bar")} its charter asks, and it ${d?.passed ? "was so" : "was not"}, ${year(e.t)}`;
});
registerEventWords(CHARTER_EVENTS.emergency.type, (_world, e) => {
  const d = e.data as Data,
    realm = str(d, "realm", "a realm"),
    years = num(d, "years");
  return d?.how === "lapsed"
    ? `The powers the seat of ${realm} took in its danger lapsed after ${years} year${years === 1 ? "" : "s"}, and its people's say was given back, ${year(e.t)}`
    : d?.how === "kept"
      ? `The seat of ${realm} kept for good the powers it took in its danger ${years} years before, and its people's say stayed narrowed, ${year(e.t)}`
      : `In its danger the seat of ${realm} took powers past its people's say, ${year(e.t)}`;
});
registerEventWords(CHARTER_EVENTS.local.type, (_world, e) => {
  const d = e.data as Data,
    share = num(d, "share"),
    was = num(d, "was");
  return share > was
    ? `${cap(str(d, "realm", "a realm"))} left ${num(d, "lands")} of its far lands to councils of their own towns: ${share} in a hundred of its lands now rule themselves, ${year(e.t)}`
    : `${cap(str(d, "realm", "a realm"))} took its far towns back under its seat: ${share} in a hundred of its lands rule themselves now, ${was} before, ${year(e.t)}`;
});
registerEventWords(CHARTER_EVENTS.heard.type, (_world, e) => {
  const d = e.data as Data,
    heard = num(d, "heard"),
    was = num(d, "was");
  return heard > was
    ? `In ${str(d, "realm", "a realm")} more of those who bear were given a say: ${heard} in a hundred of its grown are heard now, ${was} before, ${year(e.t)}`
    : `In ${str(d, "realm", "a realm")} those who bear are kept from its choices as from its seats: ${heard} in a hundred of its grown are heard, ${year(e.t)}`;
});
registerDecisionWords("order.charter", (world, d) => {
  const p = politiesOf(world).get(d.subject as Ref);
  return `${cap(p ? realmName(p) : "a realm")} chose to write down its rule`;
});
registerDecisionWords("order.emergency", (world, d) => {
  const p = politiesOf(world).get(d.subject as Ref);
  return `The seat of ${p ? realmName(p) : "a realm"} chose to take powers past its people's say`;
});
