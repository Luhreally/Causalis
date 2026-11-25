// Bonds and freedoms in words (Phase 19 M137): captives carried off, the hungry sold into
// debt, farmers bound to the land, newcomers bound for their passage, the condemned at labour,
// the people called to the seat's works; the bound fleeing and rising, freed or crushed;
// movements among a realm's people, a realm's crisis of standing, and its law freeing the bound.
import { yearOfMoment } from "../kernel/index.ts";
import {
  LAW_EVENTS,
  BOUND_TRADE_EVENTS,
  CURRICULUM_EVENTS,
  LAW_POSITIONS,
  ORDER_ACTS,
  ORDER_EVENTS,
  politiesOf,
  realmName,
  type Law,
} from "../sim/index.ts";
import {
  OUTCOME,
  blameWords,
  holdWords,
  howWords,
  movedWords,
  tookWords,
  type Blame,
  type Hold,
} from "../rules/index.ts";
import { ELECTION_EVENTS, HOLD_EVENTS, homePlanet } from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { count } from "./words.ts";
import { registerDecisionWords, registerEventWords } from "./why.ts";
import type { World } from "../kernel/index.ts";

type Data = {
  realm?: string;
  count?: number;
  dead?: number;
  share?: number;
  cause?: string;
  seat?: boolean;
} | null;

const realm = (d: unknown) => (d as Data)?.realm ?? "a realm",
  n = (d: unknown, k: "count" | "dead" | "share") => (d as Data)?.[k] ?? 0,
  year = (t: number) => `year ${yearOfMoment(t)}`,
  cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s),
  people = (k: number) => `${count(k)} ${k === 1 ? "person" : "people"}`;

// How a realm is held, told anew (rules/holds.ts): read off its numbers and its people's body, as its page reads them.
registerEventWords(HOLD_EVENTS.held.type, (world, e) => {
  const d = e.data as { hold?: Hold; from?: number; to?: number } | null,
    by = { body: homePlanet(world).generated.life.people?.body, arm: null, far: null },
    h = d?.hold ?? "voice",
    now = holdWords(h, (d?.to ?? 50) / 100, by),
    was = holdWords(h, (d?.from ?? 50) / 100, by);
  return `${cap(realm(e.data))} came to be held so: ${now}, where it was ${was}, ${year(e.t)}`;
});
// A choice put to a realm's people (sim/order/elections.ts): whose candidate they gave their sway to.
registerEventWords(ELECTION_EVENTS.elected.type, (_, e) => {
  const d = e.data as {
      group?: string;
      share?: number;
      held?: boolean;
      was?: string | null;
      by?: string;
      party?: string;
      rival?: string;
      rivalGroup?: string;
    } | null,
    // (A group's name may carry its own "the": "the court", "the army", beside "farmers". It read "the the court".)
    the = (g: string) => (/^the /i.test(g) ? g : `the ${g}`),
    who = the(d?.group ?? "group"),
    by = `${Math.round((d?.share ?? 0) * 100)} in a hundred of its sway`,
    // (Who was chosen by name, of which party, and over whom: where the world keeps them.)
    under = d?.by ? `, under ${d.by}${d.party ? ` of the ${d.party} party` : ""}` : "",
    over = d?.rival ? `, over ${d.rival} of ${the(d.rivalGroup ?? "another group")}` : "";
  return d?.held
    ? `${cap(realm(e.data))} chose again: ${who} govern still${under}${over}, given ${by}, ${year(e.t)}`
    : `${cap(realm(e.data))} chose ${who} to govern${under}${d?.was ? `, in place of ${the(d.was)}` : ""}${over}, given ${by}, ${year(e.t)}`;
});
// A lesson of rule (sim/order/holds.ts): what befell it, or another, whom it blamed, and what it did.
registerEventWords(HOLD_EVENTS.lesson.type, (_, e) => {
  const d = e.data as {
      outcome?: string;
      blame?: Blame;
      of?: string;
      /** (A lesson told before evidence was measured kept its change in words.) */
      change?: string;
      leaned?: number[];
      came?: number[];
      moved?: number[];
    } | null,
    o = OUTCOME.get(d?.outcome ?? ""),
    well = d?.came ? d.came[0]! > 0 : undefined,
    change = d?.moved ? movedWords(d.moved.map((x) => x / 1000)) : (d?.change ?? ""),
    // (How the realm it befell stood and fared, put into words from the numbers the lesson kept: sim/order/holds.ts.)
    how =
      d?.leaned && d.came
        ? howWords(
            !!d.of,
            !!o?.good,
            d.leaned.map((x) => x / 100),
            d.came,
          )
        : "",
    what = d?.of
      ? `seeing ${(o?.of ?? "the fate of {them}").replace("{them}", d.of)}`
      : `after ${o?.words ?? "what befell it"}`,
    blame = !d?.blame
      ? "weighed it"
      : well === undefined
        ? blameWords(o, d.blame, !!d.of)
        : tookWords(d.blame, !!d.of, well);
  return `${cap(realm(e.data))}, ${what}${how}, ${blame}${change ? `, and ${change}` : ""}, ${year(e.t)}`;
});
registerEventWords(
  ORDER_EVENTS.captives.type,
  (world, e) =>
    `${cap(realm(e.data))} carried off ${people(n(e.data, "count"))} of ${landWords(world, e.place)}${(e.data as { held?: boolean } | null)?.held ? ", to be held until the peace" : " into bondage"}, ${year(e.t)}`,
);
registerEventWords(
  ORDER_EVENTS.bondage.type,
  (world, e) =>
    `In the hungry years ${people(n(e.data, "count"))} of ${landWords(world, e.place)} sold themselves into debt bondage, ${year(e.t)}`,
);
registerEventWords(
  ORDER_EVENTS.serfdom.type,
  (_, e) =>
    `The farmers of ${realm(e.data)} were bound to the land: ${n(e.data, "share")} in a hundred of its people serfs, ${year(e.t)}`,
);
registerEventWords(
  ORDER_EVENTS.indenture.type,
  (world, e) =>
    `${cap(people(n(e.data, "count")))} who came hungry to ${landWords(world, e.place)} were bound for seven years for their passage, ${year(e.t)}`,
);
registerEventWords(
  ORDER_EVENTS.convicts.type,
  (_, e) => `${cap(realm(e.data))} set its condemned to labour, ${year(e.t)}`,
);
registerEventWords(
  ORDER_EVENTS.corvee.type,
  (_, e) =>
    `${cap(realm(e.data))} called its people to labour on its works, ${n(e.data, "share")} days in a hundred, ${year(e.t)}`,
);
registerEventWords(
  ORDER_EVENTS.flight.type,
  (world, e) =>
    `${cap(people(n(e.data, "count")))} fled their bonds in ${landWords(world, e.place)}, ${year(e.t)}`,
);
registerEventWords(
  ORDER_EVENTS.revolt.type,
  (world, e) =>
    `The bound of ${landWords(world, e.place)} rose against ${realm(e.data)}, ${people(n(e.data, "count"))}, ${year(e.t)}`,
);
registerEventWords(ORDER_EVENTS.freed.type, (world, e) =>
  (e.data as Data)?.seat
    ? `The bound of ${landWords(world, e.place)} overthrew the court of ${realm(e.data)} and freed all its bound, ${year(e.t)}`
    : `The bound of ${landWords(world, e.place)} broke their chains and broke away from ${realm(e.data)}, ${year(e.t)}`,
);
registerEventWords(
  ORDER_EVENTS.crushed.type,
  (world, e) =>
    `The rising in ${landWords(world, e.place)} was crushed by ${realm(e.data)}: ${people(n(e.data, "dead"))} died, ${year(e.t)}`,
);
registerEventWords(ORDER_EVENTS.movement.type, (_, e) => {
  const cause = (e.data as Data)?.cause;
  return `A movement ${cause === "abolition" ? "to free the bound" : cause === "land" ? "to give the land to those who till it" : "to give the many a voice"} arose in ${realm(e.data)}, ${year(e.t)}`;
});
registerEventWords(
  ORDER_EVENTS.abolished.type,
  (_, e) =>
    `${cap(realm(e.data))} outlawed bondage: ${people(n(e.data, "count"))} freed (all but the condemned), ${year(e.t)}`,
);
registerEventWords(
  ORDER_EVENTS.crisis.type,
  (_, e) => `${cap(realm(e.data))} lost its people's faith in its rule, ${year(e.t)}`,
);

// A realm's laws changed (M139): the land, strangers, faith, justice.
const LAW_NAMES: Readonly<Record<Law, string>> = {
  land: "its land",
  strangers: "strangers",
  faith: "other faiths",
  justice: "justice",
};
registerEventWords(LAW_EVENTS.changed.type, (_, e) => {
  const d = e.data as { law?: Law; from?: number; to?: number; by?: string } | null,
    law = d?.law ?? "land",
    from = LAW_POSITIONS[law][d?.from ?? 0],
    to = LAW_POSITIONS[law][d?.to ?? 0];
  return `${d?.by ? `By your hand, at the word of ${d.by}, ${realm(e.data)}` : cap(realm(e.data))} changed its law of ${LAW_NAMES[law]}: from ${from} to ${to}, ${year(e.t)}`;
});

// The trade in bound people between realms (sim/order/boundtrade.ts): who, how many, at what price.
registerEventWords(BOUND_TRADE_EVENTS.sold.type, (world, e) => {
  const d = e.data as { from?: string; price?: number; paid?: number } | null;
  return `The holders of ${realm(e.data)} bought ${people(n(e.data, "count"))} of the bound of ${landWords(world, e.place)} from ${d?.from ?? "another realm"}: a bound hand's work keeps a holder more at their seat than where they were held, and each fetched what ${d?.price ?? "some"} years of a worker's living come to${d?.paid ? `, ${count(d.paid)} of grain from its treasury in all` : ""}; they were carried there, ${year(e.t)}`;
});
registerDecisionWords(
  "order.bound-trade",
  (world, d) =>
    `The holders of ${realmOf(world, d.subject)} weighed buying the bound of another realm`,
);

// What a realm's schools teach (sim/order/curriculum.ts): by who pays for them.
registerEventWords(CURRICULUM_EVENTS.turned.type, (_, e) => {
  const d = e.data as {
    teaches?: string;
    share?: number;
    payer?: string;
    paid?: number;
    reach?: number;
    from?: string;
  } | null;
  return `The schools of ${realm(e.data)} ${d?.from ? `turned from ${d.from} to teach` : "came to teach"} ${d?.teaches ?? "what their payers want"} first, ${d?.share ?? "most"} parts in a hundred of what they teach: ${d?.payer ?? "those who pay"} keep${d?.payer?.startsWith("those") || d?.payer?.endsWith("s") ? "" : "s"} ${d?.paid ?? "most"} in a hundred of them, and they reach ${d?.reach ?? "some"} in a hundred of its young, ${year(e.t)}`;
});
registerDecisionWords(
  "order.curriculum",
  (world, d) => `What the schools of ${realmOf(world, d.subject)} teach, by who pays for them`,
);

// A reform its clerks held back (sim/order/laws.ts: its clerks a group of their own, rules/lawgain.ts clerkGains).
registerEventWords(LAW_EVENTS.held.type, (_, e) => {
  const d = e.data as { law?: Law; from?: number; to?: number } | null,
    law = d?.law ?? "land";
  return `The clerks of ${realm(e.data)} held back a change of its law of ${LAW_NAMES[law]}, from ${LAW_POSITIONS[law][d?.from ?? 0]} to ${LAW_POSITIONS[law][d?.to ?? 0]}: its groups would have carried it, and the offices the clerks live by would have closed with it, ${year(e.t)}`;
});
registerDecisionWords(
  "order.clerks",
  (world, d) => `The clerks of ${realmOf(world, d.subject)} stood against a change of law`,
);

// The god's hand on bonds and freedoms (M138).
registerEventWords(
  ORDER_ACTS.unchain.type,
  (_, e) =>
    `The god broke the chains of ${people(n(e.data, "count"))} held in ${realm(e.data)}, ${year(e.t)}`,
);
registerEventWords(
  ORDER_ACTS.stir.type,
  (world, e) =>
    `The god stirred the bound of ${landWords(world, e.place)} to rise against ${realm(e.data)}, ${year(e.t)}`,
);
registerEventWords(ORDER_ACTS.decree.type, (_, e) => {
  const d = e.data as { law?: Law; to?: number } | null,
    law = d?.law ?? "land";
  return `By the god's decree ${realm(e.data)} took a new law of ${LAW_NAMES[law]}: ${LAW_POSITIONS[law][d?.to ?? 0]}, ${year(e.t)}`;
});
registerEventWords(
  ORDER_ACTS.mandate.type,
  (_, e) =>
    `A sign from the heavens ${(e.data as { sign?: number } | null)?.sign === -1 ? "against" : "for"} the rule of ${realm(e.data)}, ${year(e.t)}`,
);

const realmOf = (world: World, ref: string) => {
  const p = politiesOf(world).get(ref as Parameters<ReturnType<typeof politiesOf>["get"]>[0]);
  return p ? realmName(p) : "a realm";
};
registerDecisionWords(
  "order.elected",
  (world, d) => `The people of ${realmOf(world, d.subject)} chose who would govern them`,
);
registerDecisionWords(
  "order.captives",
  (world, d) =>
    `${cap(realmOf(world, d.subject))} weighed carrying off the people of a land it took`,
);
registerDecisionWords(
  "order.bondage",
  (world, d) => `The hungry of ${landWords(world, d.subject)} weighed selling themselves for grain`,
);
registerDecisionWords(
  "order.serfdom",
  (world, d) => `${cap(realmOf(world, d.subject))} bound its farmers to the land`,
);
registerDecisionWords(
  "order.indenture",
  (world, d) =>
    `Those who came hungry to ${landWords(world, d.subject)} were bound for their passage`,
);
registerDecisionWords(
  "order.flight",
  (world, d) => `The bound of ${landWords(world, d.subject)} weighed flight`,
);
registerDecisionWords(
  "order.revolt",
  (world, d) => `The bound of ${landWords(world, d.subject)} rose`,
);
registerDecisionWords(
  "order.abolish",
  (world, d) => `${cap(realmOf(world, d.subject))} weighed freeing its bound`,
);
registerDecisionWords(
  "order.law",
  (world, d) => `${cap(realmOf(world, d.subject))} weighed changing a law`,
);
// (A decision read "order.held for pol:0:832: score 0.20 against 0.06" on its page: it had no words.)
const HELD_WHAT: Readonly<Record<string, string>> = {
  force: "who bears its arms",
  voice: "who carries its choices",
  word: "how freely word moves in it",
  trust: "what it keeps with others",
};
registerDecisionWords("order.held", (world, d) => {
  const o = d.outcome as { hold?: string } | null;
  return `${cap(realmOf(world, d.subject))} weighed ${HELD_WHAT[o?.hold ?? ""] ?? "how it is held"}`;
});
registerDecisionWords(
  "order.legitimacy",
  (world, d) => `${cap(realmOf(world, d.subject))}'s people weighed its right to rule`,
);
