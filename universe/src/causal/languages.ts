// Languages, the sea and industry in words (docs/architecture §19, §13; Phase 3
// M31–M32): a language, its family and where it arose — and why: the speech it grew
// from, the distance and the rule that parted them; a land going over to its
// neighbours' or its rulers' speech; a language no one speaks; peoples of two
// families meeting; the first ships between two coasts; a land's first coal, oil and
// machines, and the knowledge and the buried past behind them.
import { yearOfMoment, type CauseRef, type Ref } from "../kernel/index.ts";
import { cellRef } from "../gen/index.ts";
import { ECONOMY_EVENTS, LANGUAGE, LANGUAGE_EVENTS, languagesOf } from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { count } from "./words.ts";
import { edges, registerDecisionWords, registerEventWords, registerExplainer } from "./why.ts";

type Data = Readonly<Record<string, unknown>> | null;
const text = (d: unknown, k: string) => {
  const v = (d as Data)?.[k];
  return typeof v === "string" ? v : null;
};
const num = (d: unknown, k: string) => {
  const v = (d as Data)?.[k];
  return typeof v === "number" ? v : null;
};
const year = (t: number) => `year ${yearOfMoment(t)}`;

registerExplainer(LANGUAGE.code, (world, ref) => {
  if (!world.storeNames().includes("culture.languages")) return null;
  const store = languagesOf(world),
    l = store.get(ref);
  if (!l) return null;
  const lands = store.speakers().get(l.index)?.length ?? 0,
    family =
      l.family === l.index ? "the first of its family" : `of the ${store.familyName(l)} tongues`,
    parent = l.parent === null ? null : store.at(l.parent),
    began =
      parent === null
        ? "the speech of the first people"
        : l.born === 0
          ? `it grew from ${parent.name} in the ages before the chronicle`
          : `it grew from ${parent.name} in ${landWords(world, cellRef(0, l.home))} in year ${l.born}`,
    spoken =
      l.died !== null
        ? `no land has spoken it since year ${l.died}`
        : `${count(lands)} land${lands === 1 ? "" : "s"} speak it`;
  const claim = `${l.name}, ${family}: ${began}; ${spoken}`;
  const causes: CauseRef[] = [{ ref: l.event, role: "trigger", weight: 0.8 }];
  if (parent) causes.push({ ref: parent.ref, role: "enabler", weight: 0.2 });
  return { ref, claim, basis: "recorded", t: null, causes: edges(world, causes) };
});

registerEventWords(LANGUAGE_EVENTS.arose.type, (world, e) => {
  const name = text(e.data, "name") ?? "a new tongue",
    from = text(e.data, "from"),
    kept = num(e.data, "kept");
  const when = yearOfMoment(e.t) === 0 ? "in the ages before the chronicle" : year(e.t);
  return `The speech of ${landWords(world, e.place)} grew apart${from ? ` from ${from}` : ""} into a tongue of its own, ${name}${kept === null ? "" : ` (keeping ${kept} of every hundred sounds)`}, ${when}`;
});
registerEventWords(LANGUAGE_EVENTS.shifted.type, (world, e) => {
  const name = text(e.data, "name") ?? "a neighbour's speech",
    from = text(e.data, "from"),
    realm = text(e.data, "realm");
  return `${cap(landWords(world, e.place))} took up ${name}${from ? ` in place of ${from}` : ""}${realm ? `, the speech of ${realm}` : ""}, ${year(e.t)}`;
});
registerEventWords(LANGUAGE_EVENTS.died.type, (world, e) => {
  const name = text(e.data, "name") ?? "A tongue",
    empty = (e.data as Data)?.["empty"] === true;
  return `${name} was no longer spoken${empty ? ": the lands that spoke it stood empty" : ""}, ${year(e.t)}`;
});
registerEventWords(LANGUAGE_EVENTS.contact.type, (world, e) => {
  const a = text(e.data, "a"),
    b = text(e.data, "b"),
    sea = (e.data as Data)?.["sea"] === true;
  return `Peoples of the ${a ?? "one"} and the ${b ?? "other"} tongues met for the first time${sea ? ", across the sea" : ""}, at ${landWords(world, e.place)}, ${year(e.t)}`;
});
registerEventWords(ECONOMY_EVENTS.seaRoute.type, (world, e) => {
  const to = (e.subjects[1] ?? null) as Ref | null;
  return `Ships first sailed from ${landWords(world, e.place)} to ${landWords(world, to)}, ${year(e.t)}`;
});
// Industry: a land's first coal, first oil and first machines.
registerEventWords(ECONOMY_EVENTS.mine.type, (world, e) => {
  const n = num(e.data, "coal");
  return `Coal was first dug in ${landWords(world, e.place)}${n ? `, ${count(n)} loads in the first year` : ""}, ${year(e.t)}`;
});
registerEventWords(
  ECONOMY_EVENTS.well.type,
  (world, e) => `Oil was first drawn from the ground of ${landWords(world, e.place)}, ${year(e.t)}`,
);
registerEventWords(
  ECONOMY_EVENTS.works.type,
  (world, e) => `The works of ${landWords(world, e.place)} first made machines, ${year(e.t)}`,
);
registerDecisionWords(
  "language.arise",
  (world, d) => `The speech of ${landWords(world, d.subject)} grew apart from its own`,
);

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
