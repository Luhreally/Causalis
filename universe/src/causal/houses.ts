// Houses in words (round H, sim/order/houses.ts): a great house risen, one risen from outside (a demagogue, a grifter), a demagogue
// taken into the seat's favour, an estate parted, and how a house's hold ended: purged, overthrown, wed into another, dead out,
// faded from the great, exposed.
import { yearOfMoment, type World } from "../kernel/index.ts";
import { HOUSE_EVENTS, politiesOf, realmName } from "../sim/index.ts";
import { registerDecisionWords, registerEventWords } from "./why.ts";

type Data = {
  realm?: string;
  house?: string;
  origin?: string;
  of?: string;
  into?: string;
  since?: number;
  share?: number;
} | null;

const d = (x: unknown) => (x as Data) ?? {},
  realm = (x: unknown) => d(x)?.realm ?? "a realm",
  house = (x: unknown) => `the house of ${d(x)?.house ?? "a family"}`,
  year = (t: number) => `year ${yearOfMoment(t)}`,
  cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** Whence a house rose, in words. */
const FROM: Readonly<Record<string, string>> = {
  crown: "the ruler's own family",
  "the court": "those who lead at its seat",
  "the army": "its army",
  "the temple": "its temple",
  traders: "its traders",
  crafters: "its crafters",
  farmers: "the holders of its land",
  herders: "the holders of its herds",
};

registerEventWords(HOUSE_EVENTS.rose.type, (_, e) => {
  const o = d(e.data)?.origin ?? "the court";
  return `${cap(house(e.data))} rose in ${realm(e.data)}, of ${FROM[o] ?? "its great"}, ${year(e.t)}`;
});
registerEventWords(
  HOUSE_EVENTS.demagogue.type,
  (_, e) =>
    `${cap(d(e.data)?.house ?? "One")} rose in ${realm(e.data)} on its people's grievance, a following behind them, ${year(e.t)}`,
);
registerEventWords(
  HOUSE_EVENTS.grifter.type,
  (_, e) =>
    `${cap(house(e.data))} bought its way into ${realm(e.data)}'s offices and took its cut of what is skimmed, ${year(e.t)}`,
);
registerEventWords(HOUSE_EVENTS.office.type, (_, e) => {
  const share = Math.round((d(e.data)?.share ?? 0) * 100);
  return `${cap(d(e.data)?.house ?? "A demagogue")}, carrying ${share} in a hundred of ${realm(e.data)}'s people, was taken into the seat's favour, ${year(e.t)}`;
});
registerEventWords(
  HOUSE_EVENTS.parted.type,
  (_, e) =>
    `The estate of ${house({ house: d(e.data)?.of ?? d(e.data)?.house })} was parted among its heirs in ${realm(e.data)}: a younger line of its own, ${year(e.t)}`,
);
registerEventWords(
  HOUSE_EVENTS.purged.type,
  (_, e) =>
    `${cap(realm(e.data))}'s ruler purged ${house(e.data)}, grown too near the crown's own power; what it held was seized, ${year(e.t)}`,
);
registerEventWords(
  HOUSE_EVENTS.overthrown.type,
  (_, e) =>
    `${cap(house(e.data))}, great in ${realm(e.data)} since year ${d(e.data)?.since ?? "?"}, fell with the court its people overthrew, ${year(e.t)}`,
);
registerEventWords(
  HOUSE_EVENTS.wed.type,
  (_, e) =>
    `${cap(house(e.data))} of ${realm(e.data)}, its line down to one, wed into the house of ${d(e.data)?.into ?? "another"} and was its own no more, ${year(e.t)}`,
);
registerEventWords(
  HOUSE_EVENTS.diedout.type,
  (_, e) =>
    `${cap(house(e.data))} of ${realm(e.data)} died out, no heir left; its estate went to the crown, ${year(e.t)}`,
);
registerEventWords(
  HOUSE_EVENTS.faded.type,
  (_, e) => `${cap(house(e.data))} faded from among the great of ${realm(e.data)}, ${year(e.t)}`,
);
registerEventWords(
  HOUSE_EVENTS.exposed.type,
  (_, e) =>
    `${cap(house(e.data))}'s grift in ${realm(e.data)} was found out, its offices taken from it, ${year(e.t)}`,
);

const realmOf = (world: World, ref: string) => {
  const p = politiesOf(world).get(ref as Parameters<ReturnType<typeof politiesOf>["get"]>[0]);
  return p ? realmName(p) : "a realm";
};
registerDecisionWords(
  "houses.rose",
  (world, x) => `A house rose to greatness in ${realmOf(world, x.subject)}`,
);
registerDecisionWords(
  "houses.purged",
  (world, x) => `${cap(realmOf(world, x.subject))}'s ruler weighed purging a great house`,
);
registerDecisionWords(
  "houses.overthrown",
  (world, x) => `A great house of ${realmOf(world, x.subject)} fell with its court`,
);
registerDecisionWords(
  "houses.wed",
  (world, x) => `A failing line of ${realmOf(world, x.subject)} was wed into a greater house`,
);
registerDecisionWords(
  "houses.diedout",
  (world, x) => `A great house of ${realmOf(world, x.subject)} was left without heirs`,
);
registerDecisionWords(
  "houses.faded",
  (world, x) => `A house of ${realmOf(world, x.subject)} lost its place among the great`,
);
registerDecisionWords(
  "houses.exposed",
  (world, x) => `A grifter in ${realmOf(world, x.subject)}'s offices was found out`,
);
