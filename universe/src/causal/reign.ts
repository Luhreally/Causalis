// A ruler ruled by the god's hand in words (Lives L4): the marriage of state, and the commands' own lines. A law set,
// a tithe, a war and a peace are told by the words those already have, which say whose word it was.
import { yearOfMoment, type Ref } from "../kernel/index.ts";
import { REIGN_EVENTS, politiesOf, realmName, type WarArgs, type WedArgs } from "../sim/index.ts";
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
registerCommandWords("reign.wed", (world, c) => {
  const a = c.args as WedArgs;
  return `Your act: as ${a.ruler} you wed ${a.who.name} to ${a.partner.name} of ${called(world, a.to)}, year ${yearOfMoment(c.t)}`;
});
