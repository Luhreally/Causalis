// Courts in words (Lives L5). A plot is told by what it did, who and why, never how. The why walks down to a person and a
// number: each decision's factors name the one who moved, with the sway they carry, and what the seat's weakness came to.
import { yearOfMoment, type Ref } from "../kernel/index.ts";
import { COURT_EVENTS, politiesOf, realmName } from "../sim/index.ts";
import { registerCommandWords, registerDecisionWords, registerEventWords } from "./why.ts";

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s),
  year = (t: number) => `year ${yearOfMoment(t)}`;
type Data = {
  realm?: string;
  who?: string;
  seat?: string;
  ruler?: string;
  old?: string;
  heir?: string;
  won?: boolean;
  dead?: boolean;
  age?: number;
  by?: string;
} | null;
const voice = (d: Data) =>
  d?.seat && d.seat !== "house"
    ? `, the voice of ${d.seat},`
    : d?.seat === "house"
      ? ", of the ruler's house,"
      : "";

registerEventWords(COURT_EVENTS.heir.type, (_, e) => {
  const d = e.data as Data;
  return `${d?.who ?? "One of the court"} was named heir of ${d?.realm ?? "a realm"}${d?.by ? ` by the word of ${d.by}` : ""}, ${year(e.t)}`;
});
registerEventWords(COURT_EVENTS.heirDied.type, (_, e) => {
  const d = e.data as Data;
  return `${d?.who ?? "The heir"}, heir of ${d?.realm ?? "a realm"}, died at ${d?.age ?? "a young age"}, ${year(e.t)}`;
});
registerEventWords(COURT_EVENTS.regency.type, (_, e) => {
  const d = e.data as Data;
  return `The seat of ${d?.realm ?? "a realm"} came to ${d?.ruler ?? "a child"}, ${d?.age ?? "a child"} years old, and ${d?.who ?? "one of the court"}${voice(d)} holds it for them, ${year(e.t)}`;
});
registerEventWords(COURT_EVENTS.claim.type, (_, e) => {
  const d = e.data as Data;
  return `${d?.who ?? "One of the court"}${voice(d)} claimed the seat of ${d?.realm ?? "a realm"} against ${d?.heir ?? "its heir"}, and ${d?.won ? "took it" : "was beaten"}, ${year(e.t)}`;
});
registerEventWords(COURT_EVENTS.plot.type, (_, e) => {
  const d = e.data as Data;
  return `${d?.who ?? "One of the court"}${voice(d)} moved against ${d?.ruler ?? "the ruler"} of ${d?.realm ?? "a realm"}, ${year(e.t)}`;
});
registerEventWords(COURT_EVENTS.seized.type, (_, e) => {
  const d = e.data as Data;
  return `${d?.who ?? "One of the court"}${voice(d)} took the seat of ${d?.realm ?? "a realm"} from ${d?.old ?? "its ruler"}, who ${d?.dead ? "did not live the night" : "was put out of the palace door"}, ${year(e.t)}`;
});
registerEventWords(COURT_EVENTS.found.type, (_, e) => {
  const d = e.data as Data;
  return d?.by
    ? `By the word of ${d.by}, ${d?.who ?? "one of the court"}${voice(d)} was seized for moving against the seat of ${d?.realm ?? "a realm"}, ${year(e.t)}`
    : `A plot was found in ${d?.realm ?? "a realm"}: ${d?.who ?? "one of the court"}${voice(d)} moved against ${d?.ruler ?? "its ruler"}, and failed, ${year(e.t)}`;
});
registerEventWords(COURT_EVENTS.bought.type, (_, e) => {
  const d = e.data as Data;
  return `${cap(d?.by ?? "The ruler")} of ${d?.realm ?? "a realm"} bought ${d?.who ?? "a plotter"} off, and the plot went no further, ${year(e.t)}`;
});
registerDecisionWords("court.plot", (world, d) => {
  const p = politiesOf(world).get(d.subject as Ref),
    o = d.outcome as { who?: string; ruler?: string } | null;
  return `${o?.who ?? "One of the court"} moved against ${o?.ruler ?? "the ruler"} of ${p ? realmName(p) : "a realm"}`;
});
registerDecisionWords("court.claim", (world, d) => {
  const p = politiesOf(world).get(d.subject as Ref),
    o = d.outcome as { who?: string; against?: string; won?: boolean } | null;
  return `${o?.who ?? "One of the court"} claimed the seat of ${p ? realmName(p) : "a realm"} against ${o?.against ?? "its heir"}`;
});
type Words = Parameters<Parameters<typeof registerCommandWords>[1]>[0];
const called = (world: Words, ref: unknown) => {
  const r = typeof ref === "string" ? politiesOf(world).get(ref as Ref) : undefined;
  return r ? realmName(r) : "a realm";
};
registerCommandWords("court.answer", (world, c) => {
  const a = c.args as { realm: Ref; ruler: string; answer: string };
  return `Your act: as ${a.ruler} you ${a.answer === "seize" ? "had a plotter seized" : "bought a plotter off"} in ${called(world, a.realm)}, year ${yearOfMoment(c.t)}`;
});
registerCommandWords("court.name", (world, c) => {
  const a = c.args as { realm: Ref; ruler: string };
  return `Your act: as ${a.ruler} you named an heir in ${called(world, a.realm)}, year ${yearOfMoment(c.t)}`;
});
