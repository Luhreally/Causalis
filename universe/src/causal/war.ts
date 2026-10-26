// Wars in words (docs/architecture §23, §13): who fought whom, for which land, how
// many fell, how it ended — and why: the declaration, whose factors reach the
// rivalry and its reasons, the famine and the dry year behind it, and the land
// they wanted, down to its ground.
import { yearOfMoment, type CauseRef } from "../kernel/index.ts";
import { WAR, WAR_EVENTS, politiesOf, realmName, warsOf } from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { count } from "./words.ts";
import { edges, registerDecisionWords, registerEventWords, registerExplainer } from "./why.ts";

registerExplainer(WAR.code, (world, ref) => {
  if (!world.storeNames().includes("war.wars")) return null;
  const w = warsOf(world).get(ref);
  if (!w) return null;
  const realms = politiesOf(world),
    a = realms.get(w.attacker),
    b = realms.get(w.defender),
    names = `${a ? realmName(a) : "a realm"} against ${b ? realmName(b) : "a realm"}`,
    fallen = w.fallen[0] + w.fallen[1],
    taken = w.battles.filter((x) => x.won).length;
  const claim = `The war of ${names}, from year ${w.declared}${w.ended !== null ? ` to year ${w.ended}` : ", still fought"}: ${count(w.battles.length)} battle${w.battles.length === 1 ? "" : "s"}, ${count(fallen)} fallen, ${taken ? `${count(taken)} land${taken === 1 ? "" : "s"} taken` : "no land taken"}`;
  const causes: CauseRef[] = [{ ref: w.event, role: "trigger", weight: 0.8 }];
  if (w.peace) causes.push({ ref: w.peace, role: "enabler", weight: 0.2 });
  return { ref, claim, basis: "recorded", t: null, causes: edges(world, causes) };
});

const text = (d: unknown, k: string) => {
  const v = (d as Readonly<Record<string, unknown>> | null)?.[k];
  return typeof v === "string" ? v : "a realm";
};
const year = (t: number) => `year ${yearOfMoment(t)}`;

// (A civil war says what it is fought over: M146.)
const CIVIL: Readonly<Record<string, string>> = {
  succession: "for the throne, in a war of succession",
  general: "in a general's revolt",
  pretender: "for a pretender's claim",
  revolution: "for the old court's return",
  freed: "to take back the freed",
};
registerEventWords(WAR_EVENTS.declared.type, (world, e) => {
  const civil = (e.data as { civil?: string } | null)?.civil;
  return civil
    ? `${cap(text(e.data, "a"))} rose against ${text(e.data, "b")} ${CIVIL[civil] ?? "in a civil war"}, marching on ${landWords(world, e.place)}, ${year(e.t)}`
    : `${cap(text(e.data, "a"))} went to war with ${text(e.data, "b")} for ${landWords(world, e.place)}, ${year(e.t)}`;
});
registerEventWords(WAR_EVENTS.battle.type, (world, e) => {
  const d = e.data as { won?: boolean; fallen?: number; tip?: boolean } | null;
  // (Where arms decided it, Phase 52 M217: the winner's.)
  return `${cap(text(e.data, "a"))} ${d?.won ? "won" : "lost"} a battle against ${text(e.data, "b")} in ${landWords(world, e.place)}${d?.tip ? `, ${text(e.data, d.won ? "a" : "b")}'s arms deciding it` : ""}; ${count(d?.fallen ?? 0)} fell, ${year(e.t)}`;
});
registerEventWords(
  WAR_EVENTS.taken.type,
  (world, e) =>
    `${cap(text(e.data, "a"))} took ${landWords(world, e.place)} from ${text(e.data, "b")}, ${year(e.t)}`,
);
registerEventWords(
  WAR_EVENTS.rebellion.type,
  (world, e) =>
    `${cap(landWords(world, e.place))} rose against ${text(e.data, "a")} and returned to ${text(e.data, "b")}, ${year(e.t)}`,
);
registerEventWords(WAR_EVENTS.peace.type, (_, e) => {
  const d = e.data as { years?: number; won?: boolean } | null;
  return `Peace between ${text(e.data, "a")} and ${text(e.data, "b")} after ${count(d?.years ?? 0)} year${d?.years === 1 ? "" : "s"}${d?.won ? ", the land they fought for won" : ""}, ${year(e.t)}`;
});
registerDecisionWords("war.declare", (world, d) => {
  const realm = politiesOf(world).get(d.subject);
  return `${cap(realm ? realmName(realm) : "A realm")} chose war`;
});

function cap(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}
