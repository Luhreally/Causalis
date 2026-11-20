// Deeds in words (sim/order/deeds.ts): a group or a body acting on someone the world keeps by name. Who struck at whom, how
// it went and what it cost them: never how it was done.
import { yearOfMoment, type World } from "../kernel/index.ts";
import { DEED_EVENTS, GROUP_HAND_EVENTS, politiesOf, realmName } from "../sim/index.ts";
import { groupWords } from "./underworld.ts";
import { orgWords } from "./groups.ts";
import { registerCommandWords, registerDecisionWords, registerEventWords } from "./why.ts";

type Struck = {
  realm?: string;
  group?: string;
  kind?: string;
  target?: string;
  who?: string;
  what?: string;
  outcome?: string;
  lost?: number;
} | null;

const year = (t: number) => `year ${yearOfMoment(t)}`,
  cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const realmOf = (world: World, ref: string) => {
  const p = politiesOf(world).get(ref as Parameters<ReturnType<typeof politiesOf>["get"]>[0]);
  return p ? realmName(p) : "a realm";
};

/** Whom a blow fell on: "Asha Vorath, ruler of Sestey", "Kel Dar, head of the Vav watch", "Ora Min, known for faith". */
export function struckAt(x: { who?: string; what?: string } | null | undefined): string {
  return `${x?.who ?? "one of name"}${x?.what ? `, ${x.what}` : ""}`;
}
/** How a blow went, for the one who struck: "killed", "struck at … who lived", "was found out before it could strike at". */
function struckWords(doer: string, x: Struck, realm: string): string {
  const at = struckAt(x),
    lost = x?.lost ? `; ${x.lost} of its own were taken in the answer` : "";
  switch (x?.outcome) {
    case "killed":
      return `${cap(doer)} of ${realm} killed ${at}${lost}`;
    case "foiled":
      return `${cap(doer)} of ${realm} was found out before it could strike at ${at}${lost}`;
    case "spared":
      return `${cap(doer)} of ${realm} struck at ${at}, whom the god's hand kept${lost}`;
    default:
      return `${cap(doer)} of ${realm} struck at ${at}, who lived${lost}`;
  }
}

registerEventWords(DEED_EVENTS.struck.type, (world, e) => {
  const x = e.data as Struck;
  return `${struckWords(orgWords(x?.group, x?.kind), x, x?.realm ?? realmOf(world, e.subjects[0] ?? ""))}, ${year(e.t)}`;
});
registerEventWords(DEED_EVENTS.crimeStruck.type, (world, e) => {
  const x = e.data as Struck;
  return `${struckWords(groupWords(x?.group, x?.kind as never), x, x?.realm ?? realmOf(world, e.subjects[0] ?? ""))}, ${year(e.t)}`;
});
for (const type of [DEED_EVENTS.struck.type, DEED_EVENTS.crimeStruck.type])
  registerDecisionWords(
    type,
    (world, x) => `A group struck at one of name in ${realmOf(world, x.subject)}`,
  );

type Sentenced = {
  realm?: string;
  body?: string;
  title?: string;
  who?: string;
  what?: string;
  charge?: string;
  sentence?: string;
  years?: number;
  bought?: number;
  harsh?: number;
} | null;
/** A sentence in words: "fined", "held for 12 years", "put to labour for 8 years", "put to death". */
export function sentenceWords(x: { sentence?: string; years?: number } | null | undefined): string {
  const years = x?.years ? ` for ${x.years} years` : "";
  return x?.sentence === "death"
    ? "put to death"
    : x?.sentence === "labour"
      ? `put to labour${years}`
      : x?.sentence === "fined"
        ? "fined and let go"
        : `held${years}`;
}
registerEventWords(DEED_EVENTS.sentenced.type, (world, e) => {
  const x = e.data as Sentenced;
  return `The ${x?.body ?? "nameless"} ${x?.title ?? "court"} of ${x?.realm ?? realmOf(world, e.subjects[0] ?? "")} tried ${struckAt(x)}, for ${x?.charge ?? "what they did"}: ${sentenceWords(x)}${x?.bought ? ", its judges bought" : ""}, ${year(e.t)}`;
});

// —— The hand on groups (sim/order/grouphand.ts) ——
type Handed = {
  realm?: string;
  group?: string;
  kind?: string;
  act?: string;
  by?: string;
  name?: string;
  what?: string;
  to?: string;
  until?: number;
  cost?: number;
} | null;
registerEventWords(GROUP_HAND_EVENTS.act.type, (world, e) => {
  const x = e.data as Handed,
    did =
      x?.act === "bless"
        ? "blessed"
        : x?.act === "curse"
          ? "cursed"
          : x?.act === "protect"
            ? "took under its hand"
            : x?.act === "charter"
              ? "granted its rights to"
              : "outlawed";
  return `The god ${did} ${orgWords(x?.group, x?.kind)} of ${x?.realm ?? realmOf(world, e.subjects[0] ?? "")}${x?.until ? `, until year ${x.until}` : ""}, ${year(e.t)}`;
});
registerEventWords(GROUP_HAND_EVENTS.charter.type, (world, e) => {
  const x = e.data as Handed,
    it = `the ${x?.name ?? "nameless"} ${x?.what ?? "group"}`,
    did =
      x?.to === "charter"
        ? `granted ${it} its charter`
        : x?.to === "outlaw"
          ? `outlawed ${it}`
          : `let ${it} be again`;
  return `${x?.by ?? "The ruler"} of ${x?.realm ?? realmOf(world, e.subjects[0] ?? "")} ${did}${x?.cost ? ", and was held the less rightful for it" : ""}, ${year(e.t)}`;
});
registerCommandWords("act.group", (_, c) => {
  const a = c.args as { act?: string };
  return `Your act: you laid your hand on a group (${a.act ?? "an act"}), ${year(c.t)}`;
});
registerCommandWords("reign.charter", (world, c) => {
  const a = c.args as { realm?: string; ruler?: string; to?: string };
  return `Your act: as ${a.ruler ?? "its ruler"} of ${realmOf(world, a.realm ?? "")} you gave your word on one of its groups, its bodies or its houses of lending (${a.to ?? "a decree"}), ${year(c.t)}`;
});

// —— A place struck ——
registerEventWords(DEED_EVENTS.razed.type, (world, e) => {
  const x = e.data as {
      realm?: string;
      group?: string;
      kind?: string;
      town?: string;
      body?: string;
      title?: string;
      lost?: number;
    } | null,
    where = `the house of the ${x?.body ?? "nameless"} ${x?.title ?? "body"} in ${x?.town ?? "its town"}`,
    lost = x?.lost ? `; ${x.lost} of its own were taken in the answer` : "";
  return `${cap(orgWords(x?.group, x?.kind))} of ${x?.realm ?? realmOf(world, e.subjects[0] ?? "")} struck at ${where}: three in ten of its hands left it, and half its purse was lost${lost}, ${year(e.t)}`;
});
registerDecisionWords(
  DEED_EVENTS.razed.type,
  (world, x) => `A group struck at a place in ${realmOf(world, x.subject)}`,
);
