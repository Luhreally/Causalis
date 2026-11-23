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
  year = (t: number) => `year ${yearOfMoment(t)}`,
  cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

const realmOf = (world: World, ref: string) => {
  const p = politiesOf(world).get(ref as Parameters<ReturnType<typeof politiesOf>["get"]>[0]);
  return p ? realmName(p) : "a realm";
};
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

registerEventWords(INST_EVENTS.founded.type, (world, e) => {
  const x = d(e.data);
  return `${cap(body(x))} was founded in ${realmOf(world, e.subjects[0] ?? "")}: it ${doesWords(x?.does, x?.of)}, kept by ${x?.fund ? FUND_WORDS[x.fund] : "those who pay for it"}, ${x?.leader ?? "one of them"} at its head, ${year(e.t)}`;
});
registerEventWords(INST_EVENTS.head.type, (_, e) => {
  const x = d(e.data);
  return `${x?.before ?? "The head"} of ${body(x)} was ${x?.how === "killed" ? "killed" : x?.how === "sentenced" ? "taken by the court" : x?.how === "disgraced" ? "put out in disgrace" : "gone"}, and ${x?.leader ?? "another"} took their place, ${year(e.t)}`;
});
registerEventWords(INST_EVENTS.standing.type, (world, e) => {
  const x = d(e.data),
    how = x?.how ?? "let be",
    was = bodyWords(x?.body, x?.was ?? x?.title),
    now = x?.was && x.was !== x.title ? `, now ${body(x)}` : "";
  const said =
    how === "chartered"
      ? // (One the seat itself has come to pay is its own, not a thing it grants leave to.)
        x?.answers === "seat"
        ? `${cap(realmOf(world, e.subjects[0] ?? ""))} made ${was} the seat's own${now}`
        : `${cap(realmOf(world, e.subjects[0] ?? ""))} granted ${was} its charter${now}`
      : how === "outlawed"
        ? `${cap(realmOf(world, e.subjects[0] ?? ""))} outlawed ${was}${now}`
        : how === "seized"
          ? `${cap(realmOf(world, e.subjects[0] ?? ""))} took ${was} for the seat${now}`
          : how === "sold back"
            ? `${cap(realmOf(world, e.subjects[0] ?? ""))} gave ${was} back to owners of its own${now}`
            : how === "kept anew"
              ? `${cap(was)} of ${realmOf(world, e.subjects[0] ?? "")} came to be kept by ${x?.fund ? FUND_WORDS[x.fund] : "another"}, and answers to ${x?.answers ? ANSWERS_WORDS[x.answers] : "them"}${now}`
              : `${cap(realmOf(world, e.subjects[0] ?? ""))} let ${was} be${now}`;
  return `${said}, ${year(e.t)}`;
});
registerEventWords(INST_EVENTS.strike.type, (world, e) => {
  const x = d(e.data) as NonNullable<Data> & {
      works?: string;
      worksTitle?: string;
      by?: string;
      killed?: number;
      closed?: number;
      slipped?: number;
      masters?: number;
    },
    realm = realmOf(world, e.subjects[0] ?? ""),
    works = x.works ? bodyWords(x.works, x.worksTitle) : null;
  // (A governed trade closed against a works.)
  if (x.closed)
    return `${cap(body(x))} of ${realm} closed its trade against ${works ?? "a works"}${x.slipped ? `, its members' rent ${x.slipped} in a hundred short of what it was` : ""}: ${x.outcome === "upheld" ? "the seat upheld its charter, and the works was held to what the trade allows" : "the seat sided with the works, and many left the trade's hold"}, ${year(e.t)}`;
  const ended =
    x.outcome === "won"
      ? `${x.masters ? "its masters" : "the works"} gave, and its wage rose`
      : x.outcome === "settled"
        ? "it ended by terms, each side giving half"
        : `it was broken by ${x.by ?? "force"}${x.killed ? `, ${x.killed} of those out killed` : ""}, and many left it`;
  return `${cap(body(x))} of ${realm} ${works ? (x.masters ? `struck against the masters of ${works}` : `stopped ${works}`) : "struck"}${x.lost ? `, ${x.lost} in a hundred of its land's year of craft lost` : ""}: ${ended}, ${year(e.t)}`;
});
registerEventWords(INST_EVENTS.told.type, (world, e) => {
  const x = d(e.data) as NonNullable<Data> & {
    of?: string;
    ofTitle?: string;
    who?: string;
    what?: string;
  };
  return `${cap(body(x))} of ${realmOf(world, e.subjects[0] ?? "")} told its readers that ${bodyWords(x.of, x.ofTitle)} was bought, and named ${x.who ?? "its head"}: its head was put out, and it is watched, ${year(e.t)}`;
});
registerEventWords(INST_EVENTS.parted.type, (world, e) => {
  const x = d(e.data);
  return `${cap(bodyWords(x?.from, x?.fromTitle))} of ${realmOf(world, e.subjects[0] ?? "")} parted at its head's passing: ${x?.leader ?? "one of its people"} led a third of it away as ${body(x)}, ${year(e.t)}`;
});
registerEventWords(INST_EVENTS.ended.type, (world, e) => {
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
  return `${cap(body(x))} of ${realmOf(world, e.subjects[0] ?? "")} ${said}, ${year(e.t)}`;
});
registerEventWords(INST_EVENTS.hand.type, (world, e) => {
  const x = d(e.data),
    act = x?.act ?? "bless";
  return `The god ${act === "bless" ? "blessed" : act === "curse" ? "cursed" : act === "charter" ? "granted its charter to" : act === "outlaw" ? "outlawed" : "took under its hand"} ${body(x)} of ${realmOf(world, e.subjects[0] ?? "")}, ${year(e.t)}`;
});

// A house of higher learning (2026-11-22: sim/order/institutions.ts higherStep): raised where learning, what is paid and one who
// gives for it meet; shut by its seat or the faith that holds its land.
registerEventWords(INST_EVENTS.raised.type, (world, e) => {
  const x = d(e.data) as (Data & { patron?: string; society?: string }) | null;
  return `${cap(bodyWords(x?.body, x?.was ?? "school"))} of ${realmOf(world, e.subjects[0] ?? "")} was raised to a house of higher learning, ${bodyWords(x?.body, x?.title ?? "academy")}${x?.patron ? `, ${x.patron} giving for it` : ""}${x?.society ? `, the ${x.society} learned society its first fellows` : ""}${x?.leader ? `, ${x.leader} at its head` : ""}, ${year(e.t)}`;
});
registerEventWords(INST_EVENTS.closed.type, (world, e) => {
  const x = d(e.data) as (Data & { by?: string; faith?: string }) | null,
    by =
      x?.by === "faith"
        ? `the ${x?.faith ?? "faith that holds its land"} faithful, who hold that inquiry angers the power behind the world`
        : `its seat, which lets no word be free`;
  return `${cap(bodyWords(x?.body, x?.was ?? "academy"))} of ${realmOf(world, e.subjects[0] ?? "")} was shut as a house of higher learning by ${by}; it teaches on as ${bodyWords(x?.body, x?.title ?? "school")}, ${year(e.t)}`;
});

for (const [type, words] of [
  [INST_EVENTS.founded.type, "A body was founded in"],
  [INST_EVENTS.raised.type, "A house of teaching was raised to higher learning in"],
  [INST_EVENTS.closed.type, "A house of higher learning was shut in"],
  [INST_EVENTS.standing.type, "A body's standing changed in"],
  [INST_EVENTS.strike.type, "Workers struck in"],
  [INST_EVENTS.told.type, "A voice told of a body that was bought in"],
  [INST_EVENTS.parted.type, "A body parted in two in"],
  [INST_EVENTS.ended.type, "A body's hold ended in"],
] as const)
  registerDecisionWords(type, (world, x) => `${words} ${realmOf(world, x.subject)}`);
