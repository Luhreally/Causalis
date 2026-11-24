// Faiths in words (docs/architecture §19, §13): who the faithful worship, where
// and when the faith began and how far it has spread — and why: the omen that
// founded it (a famine, a drought, the god's own act), the faith it split from,
// the roads it travelled.
import { yearOfMoment, type CauseRef } from "../kernel/index.ts";
import { cellRef } from "../gen/index.ts";
import {
  BELIEF_EVENTS,
  DEITIES,
  FAITH,
  TABOO_EVENTS,
  beliefOf,
  taboosOf,
  type Tenet,
} from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { count } from "./words.ts";
import { edges, registerEventWords, registerExplainer } from "./why.ts";

registerExplainer(FAITH.code, (world, ref) => {
  if (!world.hasStore("belief.faiths")) return null;
  const store = beliefOf(world),
    f = store.get(ref);
  if (!f) return null;
  const lands = store.lands(f.ref).length;
  // (And the herd its creed forbids them, where its herds' sicknesses taught it to: sim/belief/taboo.ts.)
  const ban = taboosOf(world)?.of(f.ref)?.forbids,
    claim = `${cap(f.name)}: they worship ${DEITIES[f.tenet]}; the faith began in ${landWords(world, cellRef(0, f.seat))} in year ${f.founded}, and ${lands ? `${count(lands)} land${lands === 1 ? "" : "s"} hold it` : "no land holds it now"}${ban ? `; since year ${ban.since} their creed forbids them the ${ban.beast}, its flesh and its touch` : ""}`;
  const causes: CauseRef[] = [{ ref: f.event, role: "trigger", weight: 0.8 }];
  if (f.from) causes.push({ ref: f.from, role: "enabler", weight: 0.2 });
  if (ban) causes.push({ ref: ban.event, role: "enabler", weight: 0.2 });
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
  const by = text(e.data, "by");
  const realm = text(e.data, "realm");
  // (A realm's lands breaking from a faith whose head cast its ruler out: sim/belief/heads.ts.)
  if (realm)
    return `The lands of ${realm} broke from ${from ?? "their faith"} as ${text(e.data, "name") ?? "a faith of their own"}${by ? `, led out by ${by}` : ""}, ${year(e.t)}`;
  return `${cap(text(e.data, "name") ?? "A faith")} broke from ${from ?? "its elders"} in ${landWords(world, e.place)}${by ? `, led out by ${by}` : ""}, ${year(e.t)}`;
});

function cap(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

// A creed's taboo (sim/belief/taboo.ts): the herd its believers' deaths taught them to keep off, or the ban let go.
registerEventWords(TABOO_EVENTS.taboo.type, (_world, e) => {
  const d = e.data as Data,
    faith = text(d, "faith") ?? "a faith",
    beast = text(d, "beast") ?? "the herd",
    dead = typeof d?.["dead"] === "number" ? (d["dead"] as number) : null,
    food = typeof d?.["food"] === "number" ? (d["food"] as number) : null;
  return d?.["lifted"]
    ? `${cap(faith)} let go their creed's ban on the ${beast}: the sickness it brought long forgotten, and ${food ?? "some"} parts in a hundred of their food in it, ${year(e.t)}`
    : `${cap(faith)} came to forbid the ${beast}, its flesh and its touch: those of them who lived off it died the more of the sickness it brought${dead === null ? "" : `, ${dead} in a thousand of them who need not have`}, against ${food ?? "a share"} parts in a hundred of their food it gave, ${year(e.t)}`;
});
