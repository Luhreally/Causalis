// A ruler ruled by the god's hand in words (Lives L4): the marriage of state, and the commands' own lines. A law set,
// a tithe, a war and a peace are told by the words those already have, which say whose word it was.
import { yearOfMoment, type Ref } from "../kernel/index.ts";
import { principle } from "../rules/index.ts";
import {
  GOD_EVENTS,
  REIGN_EVENTS,
  ROLE_EVENTS,
  politiesOf,
  realmName,
  type BackArgs,
  type GodArgs,
  type ProposeArgs,
  type RoleArgs,
  type WarArgs,
  type WedArgs,
} from "../sim/index.ts";
import { registerCommandWords, registerEventWords } from "./why.ts";

registerEventWords(REIGN_EVENTS.wed.type, (_, e) => {
  const d = e.data as { realm?: string; other?: string; who?: string; to?: string } | null;
  return `By your hand: ${d?.who ?? "one of a ruling house"} of ${d?.realm ?? "a realm"} was wed to ${d?.to ?? "one of another"} of ${d?.other ?? "another realm"}, year ${yearOfMoment(e.t)}`;
});

type Words = Parameters<Parameters<typeof registerCommandWords>[1]>[0];
const called = (world: Words, ref: unknown) => {
  const r = typeof ref === "string" ? politiesOf(world).get(ref as Ref) : undefined;
  return r ? realmName(r) : "a realm";
};
registerCommandWords("reign.decree", (world, c) => {
  const a = c.args as { realm: Ref; ruler: string };
  return `Your act: you gave the word of ${a.ruler} in ${called(world, a.realm)}, year ${yearOfMoment(c.t)}`;
});
registerCommandWords("reign.war", (world, c) => {
  const a = c.args as WarArgs;
  return `Your act: as ${a.ruler} you took ${called(world, a.realm)} to war on ${called(world, a.against)}, year ${yearOfMoment(c.t)}`;
});
registerCommandWords("reign.peace", (world, c) => {
  const a = c.args as { realm: Ref; ruler: string; with: Ref };
  return `Your act: as ${a.ruler} you asked ${called(world, a.with)} for peace, year ${yearOfMoment(c.t)}`;
});
registerCommandWords("reign.rise", (world, c) => {
  const a = c.args as { realm: Ref; ruler: string };
  return `Your act: as ${a.ruler} you raised ${called(world, a.realm)} against the one it swore to, year ${yearOfMoment(c.t)}`;
});
registerCommandWords("reign.wed", (world, c) => {
  const a = c.args as WedArgs;
  return `Your act: as ${a.ruler} you wed ${a.who.name} to ${a.partner.name} of ${called(world, a.to)}, year ${yearOfMoment(c.t)}`;
});

// The god in one of a realm (2026-11-13): an omen the realm remembers, and what one of a court did by the god's hand.
const CHANNEL_ACT: Readonly<Record<string, string>> = {
  decree: "a word carried past the voices",
  law: "a law carried past the voices",
  tithe: "a tithe carried past the voices",
  war: "a host sent out past the voices",
  peace: "a foe made to hear of peace",
  envoy: "an envoy heard where none would be",
  wed: "a house given where it would give none",
  rise: "a rising past all standing",
  court: "a hand laid on one who plotted",
  heir: "an heir named past all standing",
  back: "a group brought to stand behind one at court",
  plot: "a move on the seat that could not fail",
};
registerEventWords(REIGN_EVENTS.channel.type, (_, e) => {
  const d = e.data as { realm?: string; who?: string; act?: string } | null;
  return `An omen at the seat of ${d?.realm ?? "a realm"}: the god spoke through ${d?.who ?? "one of its people"}, and ${CHANNEL_ACT[d?.act ?? ""] ?? "history turned"}, year ${yearOfMoment(e.t)}`;
});
registerEventWords(ROLE_EVENTS.backed.type, (_, e) => {
  const d = e.data as { realm?: string; who?: string; group?: string } | null;
  return `${cap(d?.group ?? "a group")} of ${d?.realm ?? "a realm"} came to stand behind ${d?.who ?? "one of its court"}, year ${yearOfMoment(e.t)}`;
});
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
registerCommandWords("role.propose", (world, c) => {
  const a = c.args as ProposeArgs,
    what =
      a.what === "war"
        ? `war on ${called(world, a.against)}`
        : a.what === "peace"
          ? `a truce with ${called(world, a.against)}`
          : a.what === "tithe"
            ? "a tithe"
            : `a law of ${a.law ?? "the realm"}`;
  return `Your act: as ${a.name} you put ${what} to ${called(world, a.realm)}${a.channel ? ", the god in you" : ""}, year ${yearOfMoment(c.t)}`;
});
registerCommandWords("role.back", (world, c) => {
  const a = c.args as BackArgs;
  return `Your act: as ${a.name} you courted ${a.group} in ${called(world, a.realm)}, year ${yearOfMoment(c.t)}`;
});
registerCommandWords("role.plot", (world, c) => {
  const a = c.args as RoleArgs;
  return `Your act: as ${a.name} you moved on the seat of ${called(world, a.realm)}${a.channel ? ", the god in you" : ""}, year ${yearOfMoment(c.t)}`;
});

// The god's hand through one it entered (2026-11-13): each thing done, told as done by the god in them.
const many = (n: number) => `${Math.round(n)}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const craftName = (id: string) => {
  if (id === "cultivation") return "cultivation";
  try {
    return principle(id).name;
  } catch {
    return id;
  }
};
const listed = (xs: readonly string[]) =>
  xs.length < 2 ? (xs[0] ?? "nothing") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;
/** What the god's hand did, in words: "1,000,000 men stood up at Doudrethath for ...". */
export function godDone(d: Record<string, unknown> | null): string {
  const of = String(d?.of ?? "a realm"),
    other = String(d?.with ?? "another realm"),
    at = String(d?.at ?? "its seat"),
    worth = (n: unknown) => (Number(n) >= 100 ? many(Number(n)) : Number(n).toFixed(1));
  switch (d?.what) {
    case "host":
      return `${many(Number(d.men))} men stood up at ${at} for ${of}, bearing ${String(d.arms)}${d.best ? ", the best arms its world's matter allows" : ""}`;
    case "grain":
      return `${many(Number(d.grain))} measures of grain filled the stores of ${of}, a year's bread for all its people`;
    case "wealth":
      return `the stores of ${of} were doubled, from ${worth(d.before)} to ${worth(d.after)} a head`;
    case "poorer":
      return `the stores of ${of} were halved, from ${worth(d.before)} to ${worth(d.after)} a head`;
    case "people":
      return `${many(Number(d.people))} more people were in the lands of ${of}`;
    case "town":
      return `a town of ${many(Number(d.people))} stood up on an empty land beside ${at}, and is of ${of}`;
    case "craft":
    case "age": {
      const crafts = Array.isArray(d.crafts) ? (d.crafts as string[]).map(craftName) : [];
      return `${d.what === "age" ? "an age of learning came to" : "a craft came to"} ${of}: ${listed(crafts)}`;
    }
    case "rightful":
    case "wrongful":
      return `${Math.round(Number(d.to) * 100)} in a hundred held the rule of ${of} rightful, where ${Math.round(Number(d.from) * 100)} had`;
    case "calm":
      return `every land of ${of} was content with its rule`;
    case "stir":
      return `every land of ${of} rose in grievance against its rule`;
    case "peace":
      return `the war of ${of} and ${other} ended in a truce`;
    case "war":
      return `${of} went to war on ${other}`;
    case "pact":
      return `${of} and ${other} swore a pact`;
    case "swear":
      return `${other} swore itself to ${of}`;
    case "annex":
      return `a land of ${other} was taken into ${of}`;
  }
  return "history turned";
}
registerEventWords(GOD_EVENTS.did.type, (_, e) => {
  const d = e.data as Record<string, unknown> | null;
  return `By the god in ${String(d?.by ?? "one it entered")}: ${godDone(d)}, year ${yearOfMoment(e.t)}`;
});
registerCommandWords("reign.god", (world, c) => {
  const a = c.args as GodArgs;
  return `Your act: the god in ${a.ruler ?? a.name ?? "them"} of ${called(world, a.realm)} (${a.what}), year ${yearOfMoment(c.t)}`;
});
