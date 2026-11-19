// Institutions in words (sim/order/institutions.ts): a body founded where what is paid for a thing wanted keeps the hands it
// takes, its title read off what it does and who pays (rules/institutions.ts instTitle); kept by another payer, chartered,
// outlawed or seized; a strike won or broken; a head gone and another in their place; a great one parted in two; and how its
// hold ended. Who, what, cost and effect: never how.
import { yearOfMoment, type World } from "../kernel/index.ts";
import { INST_EVENTS, politiesOf, realmName } from "../sim/index.ts";
import {
  ANSWERS_WORDS,
  DOES_WORDS,
  FUND_WORDS,
  madeWords,
  type InstAnswers,
  type InstDoes,
  type InstFund,
} from "../rules/index.ts";
import { registerDecisionWords, registerEventWords } from "./why.ts";

type Data = {
  realm?: string;
  body?: string;
  title?: string;
  was?: string;
  does?: InstDoes;
  fund?: InstFund;
  answers?: InstAnswers;
  keeper?: string;
  of?: string;
  how?: string;
  into?: string;
  intoTitle?: string;
  from?: string;
  fromTitle?: string;
  leader?: string;
  before?: string;
  lost?: number;
  outcome?: string;
  act?: string;
  since?: number;
} | null;

const d = (x: unknown) => (x as Data) ?? {},
  realm = (x: unknown) => d(x)?.realm ?? "a realm",
  year = (t: number) => `year ${yearOfMoment(t)}`,
  cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** A body's name with what it is: the Vav watch, the Golmere iron company, the Grihe cloth guild. */
export function bodyWords(name: string | undefined, title: string | undefined): string {
  return `the ${name ?? "nameless"} ${title ?? "body"}`;
}
const body = (x: unknown) => bodyWords(d(x)?.body, d(x)?.title);

/** What a body does, with what it works where it is of a trade: "makes and sells iron". */
export function doesWords(does: InstDoes | undefined, of?: string): string {
  if (!does) return "does what is wanted of it";
  return does === "make" && of ? `${DOES_WORDS.make} ${madeWords(of)}` : DOES_WORDS[does];
}

registerEventWords(INST_EVENTS.founded.type, (_, e) => {
  const x = d(e.data);
  return `${cap(body(x))} was founded in ${realm(x)}: it ${doesWords(x?.does, x?.of)}, kept by ${x?.fund ? FUND_WORDS[x.fund] : "those who pay for it"}, ${x?.leader ?? "one of them"} at its head, ${year(e.t)}`;
});
registerEventWords(INST_EVENTS.head.type, (_, e) => {
  const x = d(e.data);
  return `${x?.before ?? "The head"} of ${body(x)} was gone, and ${x?.leader ?? "another"} took their place, ${year(e.t)}`;
});
registerEventWords(INST_EVENTS.standing.type, (_, e) => {
  const x = d(e.data),
    how = x?.how ?? "let be",
    was = bodyWords(x?.body, x?.was ?? x?.title),
    now = x?.was && x.was !== x.title ? `, now ${body(x)}` : "";
  const said =
    how === "chartered"
      ? `${cap(realm(x))} granted ${was} its charter${now}`
      : how === "outlawed"
        ? `${cap(realm(x))} outlawed ${was}${now}`
        : how === "seized"
          ? `${cap(realm(x))} took ${was} for the seat${now}`
          : how === "sold back"
            ? `${cap(realm(x))} gave ${was} back to owners of its own${now}`
            : how === "kept anew"
              ? `${cap(was)} of ${realm(x)} came to be kept by ${x?.fund ? FUND_WORDS[x.fund] : "another"}, and answers to ${x?.answers ? ANSWERS_WORDS[x.answers] : "them"}${now}`
              : `${cap(realm(x))} let ${was} be${now}`;
  return `${said}, ${year(e.t)}`;
});
registerEventWords(INST_EVENTS.strike.type, (_, e) => {
  const x = d(e.data);
  return `${cap(body(x))} of ${realm(x)} struck${x?.lost ? `, ${x.lost} in a hundred of its land's year of craft lost` : ""}: ${x?.outcome === "won" ? "the works gave, and its wage rose" : "it was broken, and many left it"}, ${year(e.t)}`;
});
registerEventWords(INST_EVENTS.parted.type, (_, e) => {
  const x = d(e.data);
  return `${cap(bodyWords(x?.from, x?.fromTitle))} of ${realm(x)} parted at its head's passing: ${x?.leader ?? "one of its people"} led a third of it away as ${body(x)}, ${year(e.t)}`;
});
registerEventWords(INST_EVENTS.ended.type, (_, e) => {
  const x = d(e.data),
    how = x?.how ?? "withered";
  const said =
    how === "failed"
      ? "failed, what its customers paid no longer keeping it"
      : how === "suppressed"
        ? "was put down by its seat"
        : how === "taken over"
          ? `was taken over by ${bodyWords(x?.into, x?.intoTitle ?? x?.title)}`
          : how === "merged"
            ? `was merged into ${bodyWords(x?.into, x?.intoTitle ?? x?.title)}`
            : how === "lost with its land"
              ? "was lost with its land"
              : "withered, what was paid for it no longer keeping the hands its work takes";
  return `${cap(body(x))} of ${realm(x)} ${said}, ${year(e.t)}`;
});
registerEventWords(INST_EVENTS.hand.type, (_, e) => {
  const x = d(e.data),
    act = x?.act ?? "bless";
  return `The god ${act === "bless" ? "blessed" : act === "curse" ? "cursed" : "took under its hand"} ${body(x)} of ${realm(x)}, ${year(e.t)}`;
});

const realmOf = (world: World, ref: string) => {
  const p = politiesOf(world).get(ref as Parameters<ReturnType<typeof politiesOf>["get"]>[0]);
  return p ? realmName(p) : "a realm";
};
for (const [type, words] of [
  [INST_EVENTS.founded.type, "A body was founded in"],
  [INST_EVENTS.standing.type, "A body's standing changed in"],
  [INST_EVENTS.strike.type, "Workers struck in"],
  [INST_EVENTS.parted.type, "A body parted in two in"],
  [INST_EVENTS.ended.type, "A body's hold ended in"],
] as const)
  registerDecisionWords(type, (world, x) => `${words} ${realmOf(world, x.subject)}`);
