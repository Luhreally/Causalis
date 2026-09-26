// Faiths in words (docs/architecture §19, §13): who the faithful worship, where
// and when the faith began and how far it has spread — and why: the omen that
// founded it (a famine, a drought, the god's own act), the faith it split from,
// the roads it travelled.
import { yearOfMoment, type CauseRef } from "../kernel/index.ts";
import { cellRef } from "../gen/index.ts";
import { BELIEF_EVENTS, DEITIES, FAITH, beliefOf, type Tenet } from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { count } from "./words.ts";
import { edges, registerEventWords, registerExplainer } from "./why.ts";

registerExplainer(FAITH.code, (world, ref) => {
  if (!world.storeNames().includes("belief.faiths")) return null;
  const store = beliefOf(world),
    f = store.get(ref);
  if (!f) return null;
  const lands = store.lands(f.ref).length;
  const claim = `${cap(f.name)}: they worship ${DEITIES[f.tenet]}; the faith began in ${landWords(world, cellRef(0, f.seat))} in year ${f.founded}, and ${lands ? `${count(lands)} land${lands === 1 ? "" : "s"} hold it` : "no land holds it now"}`;
  const causes: CauseRef[] = [{ ref: f.event, role: "trigger", weight: 0.8 }];
  if (f.from) causes.push({ ref: f.from, role: "enabler", weight: 0.2 });
  return { ref, claim, basis: "recorded", t: null, causes: edges(world, causes) };
});

type Data = Readonly<Record<string, unknown>> | null;
const text = (d: unknown, k: string) => {
  const v = (d as Data)?.[k];
  return typeof v === "string" ? v : null;
};
const year = (t: number) => `year ${yearOfMoment(t)}`;

registerEventWords(BELIEF_EVENTS.founded.type, (world, e) => {
  const tenet = text(e.data, "tenet") as Tenet | null,
    name = text(e.data, "name") ?? "a faith";
  return `In ${landWords(world, e.place)} people took it as a sign and began to worship ${tenet ? DEITIES[tenet] : "a new god"}: ${name}, ${year(e.t)}`;
});
registerEventWords(
  BELIEF_EVENTS.converted.type,
  (world, e) =>
    `${cap(landWords(world, e.place))} took up the faith of ${text(e.data, "name") ?? "a neighbour"}, ${year(e.t)}`,
);
registerEventWords(BELIEF_EVENTS.schism.type, (world, e) => {
  const from = text(e.data, "from");
  return `${cap(text(e.data, "name") ?? "A faith")} broke from ${from ?? "its elders"} in ${landWords(world, e.place)}, ${year(e.t)}`;
});

function cap(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}
