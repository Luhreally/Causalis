// The underworld in words (sim/order/underworld.ts): a group risen (a protection family, a smuggling cartel, a crew of the realm's
// own enforcers), split when its boss was taken, at war with a rival over a rent or at peace once one held it, a crackdown and a
// pact, a cartel turned to other rackets when its ban ended, a boss dead or taken, a federation of street gangs and two at feud, a
// crew found out, and how a group's hold ended. Who, what, cost and effect: never how any crime is done.
import { yearOfMoment, type World } from "../kernel/index.ts";
import { POTENCY_EVENTS, UNDERWORLD_EVENTS, politiesOf, realmName } from "../sim/index.ts";
import { registerDecisionWords, registerEventWords } from "./why.ts";
import { count } from "./words.ts";

type Data = {
  realm?: string;
  group?: string;
  kind?: string;
  of?: string;
  against?: string;
  into?: string;
  how?: string;
  boss?: string;
  was?: string;
  successors?: number;
  strength?: number;
  share?: number;
  house?: string;
  federation?: string;
  towns?: number;
  fallen?: number;
  pact?: number;
  squad?: number;
  killed?: number;
  since?: number;
  /** A peace: of the strength the two had left, the stronger's part in a hundred; the year their war opened. A group ended at war: whom it fought. */
  holds?: number;
  warSince?: number;
  foe?: string;
  men?: number | readonly number[];
  /** A group ended in the reckoning its war opened: the war was never told as opened, this tells it. */
  opened?: number;
  /** A group taken over: its men past what the victor's lands could keep, and the splinter they made, where they made one. */
  rest?: number;
  splinter?: string;
} | null;

const d = (x: unknown) => (x as Data) ?? {},
  realm = (x: unknown) => d(x)?.realm ?? "a realm",
  year = (t: number) => `year ${yearOfMoment(t)}`,
  cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** A group's name with what it is: the Vorath family, the Asha cartel, the Kirath squad. */
export function groupWords(name: string | undefined, kind: string | undefined): string {
  const n = name ?? "a band";
  return kind === "cartel"
    ? `the ${n} cartel`
    : kind === "badge"
      ? `the ${n} squad`
      : `the ${n} family`;
}
const group = (x: unknown) => groupWords(d(x)?.group, d(x)?.kind);
const rival = (x: unknown) => groupWords(d(x)?.against, d(x)?.kind);

/**
 * Of a group that ended while at war with another of its road: that their war ended with it; of one ended in the reckoning it
 * went to war, that it had gone to war (no line ever told that war's opening: this is all that is told of it).
 */
const warOver = (x: Data): string =>
  !x?.foe
    ? ""
    : x.opened
      ? `; it had gone to war with ${groupWords(x.foe, x.kind)} over their road that year, a war over as it began`
      : `; its war with ${groupWords(x.foe, x.kind)} ended with it`;
/** Of a group taken over: its men the victor's lands could not keep, a splinter of their own or scattered. */
const restWords = (x: Data): string =>
  !x?.rest
    ? ""
    : x.splinter
      ? `; ${count(x.rest)} more, past what the victor's lands could keep, held out as ${groupWords(x.splinter, x.kind)}`
      : `; ${count(x.rest)} more, past what the victor's lands could keep, scattered`;

/** What each kind of group is, said once. */
const IS: Readonly<Record<string, string>> = {
  protection: "selling protection to its shops and farms and holding the deals its courts do not",
  cartel: "carrying what its law forbids or taxes past its borders",
  badge:
    "of its own enforcers, who keep what they seize and sell protection from their own crackdown",
};

registerEventWords(
  UNDERWORLD_EVENTS.rose.type,
  (_, e) =>
    `${cap(group(e.data))} rose in ${realm(e.data)}, ${IS[d(e.data)?.kind ?? "protection"] ?? IS.protection}, its boss ${d(e.data)?.boss ?? "unnamed"}, ${year(e.t)}`,
);
registerEventWords(
  UNDERWORLD_EVENTS.badge.type,
  (_, e) =>
    `A crew of ${realm(e.data)}'s own enforcers became a gang of its own, ${group(e.data)}: they keep what they seize and sell the trade protection from their own crackdown, ${year(e.t)}`,
);
registerEventWords(
  UNDERWORLD_EVENTS.split.type,
  (_, e) =>
    `${cap(group(e.data))} split from ${groupWords(d(e.data)?.of, d(e.data)?.kind)} in ${realm(e.data)} when its boss was taken, ${d(e.data)?.boss ?? "a lieutenant"} at its head, ${year(e.t)}`,
);
registerEventWords(
  UNDERWORLD_EVENTS.war.type,
  (_, e) =>
    `${cap(group(e.data))} and ${rival(e.data)} went to war in ${realm(e.data)} over a rent neither held alone, ${year(e.t)}`,
);
registerEventWords(UNDERWORLD_EVENTS.pax.type, (_, e) => {
  const x = d(e.data),
    fallen = x?.fallen ? `, after some ${count(x.fallen)} dead` : "";
  // (A war tired out with neither beaten: who made the peace, and how each came out of it.)
  if (x?.against && x.holds !== undefined) {
    const years = x.warSince !== undefined ? yearOfMoment(e.t) - x.warSince : 0,
      after = years > 0 ? ` after ${years} years of war` : "",
      stood =
        x.holds <= 52
          ? "the two left as strong as each other"
          : `${group(e.data)} the stronger, with ${x.holds} in 100 of the strength the two had left`;
    return `${cap(group(e.data))} and ${rival(e.data)} made peace in ${realm(e.data)}${after}${x.pact ? ", under a pact with its officers" : ""}, neither beaten: the rent they fought over was parted as each came out of it, ${stood}${fallen}, ${year(e.t)}`;
  }
  return x?.pact
    ? `The war among ${realm(e.data)}'s groups cooled under a pact with its officers${fallen}, ${year(e.t)}`
    : `${cap(group(e.data))} came to hold its rent in ${realm(e.data)}, and the killing over it fell away${fallen}, ${year(e.t)}`;
});
registerEventWords(
  UNDERWORLD_EVENTS.decapitated.type,
  (_, e) =>
    `${cap(realm(e.data))} took ${d(e.data)?.boss ?? "the boss"}, boss of ${group(e.data)}${(d(e.data)?.successors ?? 1) > 1 ? `; his lieutenants divided what he held, each for himself` : ""}, ${year(e.t)}`,
);
registerEventWords(
  UNDERWORLD_EVENTS.boss.type,
  (_, e) =>
    `${d(e.data)?.was ?? "The boss"} of ${group(e.data)} died, and ${d(e.data)?.boss ?? "another"} took his place, ${year(e.t)}`,
);
registerEventWords(
  UNDERWORLD_EVENTS.crackdown.type,
  (_, e) =>
    `${cap(realm(e.data))} turned on its underworld, its police and courts sent against the groups at a cost to its treasury, ${year(e.t)}`,
);
registerEventWords(
  UNDERWORLD_EVENTS.pact.type,
  (_, e) =>
    `${cap(realm(e.data))}'s officers and judges came to be bought by its groups${d(e.data)?.house ? `, the house of ${d(e.data)!.house} sheltering them` : ""}, ${year(e.t)}`,
);
registerEventWords(
  UNDERWORLD_EVENTS.turned.type,
  (_, e) =>
    `What ${group({ group: d(e.data)?.group, kind: "cartel" })} carried in ${realm(e.data)} was no longer worth carrying, and it turned to extortion and kidnapping, ${year(e.t)}`,
);
registerEventWords(UNDERWORLD_EVENTS.ended.type, (_, e) => {
  const x = d(e.data),
    how = x?.how ?? "withered";
  const said =
    how === "crushed"
      ? "was broken by the realm's crackdown"
      : how === "absorbed"
        ? `was taken into ${groupWords(x?.into, x?.kind)}`
        : how === "taken over"
          ? `lost its war with ${groupWords(x?.into, x?.kind)} and was taken over by it, its lands and the ${typeof x?.men === "number" ? `${count(x.men)} ` : ""}men ${x?.rest ? "it could keep" : "it had left"} the victor's${x?.fallen ? `, after some ${count(x.fallen)} dead` : ""}${restWords(x)}`
          : how === "put down"
            ? "was put down by the realm's soldiers: its boss taken, its armed men fewer than the seat's police could meet"
            : how === "split"
              ? "split among its lieutenants"
              : "withered, its rent no longer keeping it";
  return `${cap(group(e.data))} of ${realm(e.data)} ${said}${warOver(x)}, ${year(e.t)}`;
});
registerEventWords(
  UNDERWORLD_EVENTS.federation.type,
  (_, e) =>
    `The street gangs of ${d(e.data)?.towns ?? "several"} of ${realm(e.data)}'s towns allied as the ${d(e.data)?.federation ?? "one"} federation${d(e.data)?.against ? `, against the ${d(e.data)!.against}` : ""}, ${year(e.t)}`,
);
registerEventWords(
  UNDERWORLD_EVENTS.feud.type,
  (_, e) =>
    `The ${d(e.data)?.federation ?? "one"} and the ${d(e.data)?.against ?? "other"} federations came to stand against each other in ${realm(e.data)}'s towns, ${year(e.t)}`,
);
registerEventWords(
  UNDERWORLD_EVENTS.exposed.type,
  (_, e) =>
    `${cap(group(e.data))}, a crew of ${realm(e.data)}'s own enforcers, was found out${d(e.data)?.squad ? ", the killings it did outside the law brought to light" : ""}: purged, and its force reformed, ${year(e.t)}`,
);

const realmOf = (world: World, ref: string) => {
  const p = politiesOf(world).get(ref as Parameters<ReturnType<typeof politiesOf>["get"]>[0]);
  return p ? realmName(p) : "a realm";
};
for (const [type, words] of [
  [UNDERWORLD_EVENTS.rose.type, "A crime group rose in"],
  [UNDERWORLD_EVENTS.badge.type, "Enforcers turned to a crew of their own in"],
  [UNDERWORLD_EVENTS.split.type, "A group split when its boss was taken in"],
  [UNDERWORLD_EVENTS.war.type, "Groups went to war over a rent in"],
  [UNDERWORLD_EVENTS.pax.type, "A war among groups ended in"],
  [UNDERWORLD_EVENTS.decapitated.type, "A boss was taken in"],
  [UNDERWORLD_EVENTS.crackdown.type, "The state turned on its groups in"],
  [UNDERWORLD_EVENTS.pact.type, "Officers came to be bought in"],
  [UNDERWORLD_EVENTS.turned.type, "A cartel turned to other rackets in"],
  [UNDERWORLD_EVENTS.ended.type, "A group's hold ended in"],
  [UNDERWORLD_EVENTS.federation.type, "Street gangs allied in"],
  [UNDERWORLD_EVENTS.exposed.type, "A crew of enforcers was found out in"],
] as const)
  registerDecisionWords(type, (world, x) => `${words} ${realmOf(world, x.subject)}`);

// (How strong what is forbidden has grown: the iron law of prohibition.)
registerEventWords(
  POTENCY_EVENTS.stronger.type,
  (_, e) =>
    `A stronger form of what ${realm(e.data)} forbids reached its streets, ${(e.data as { strength?: number } | null)?.strength ?? "twice"} times as strong as the grown: forbidden and hunted, the trade carries the most it can in the least bulk, ${year(e.t)}`,
);
registerEventWords(
  POTENCY_EVENTS.made.type,
  (_, e) =>
    `Made forms took the place of grown ones in what ${realm(e.data)} forbids${d(e.data)?.group ? `, carried by ${group(e.data)}` : ""}: stronger, and the more deadly, ${year(e.t)}`,
);
registerDecisionWords(
  POTENCY_EVENTS.stronger.type,
  (world, x) => `What ${realmOf(world, x.subject)} forbids grew stronger`,
);
registerDecisionWords(
  POTENCY_EVENTS.made.type,
  (world, x) => `Made forms replaced grown ones in what ${realmOf(world, x.subject)} forbids`,
);

// (Escalation: soldiers sent against a group, and what came of it.)
type OpData = {
  soldiers?: number;
  dead?: number;
  fallen?: number;
  taken?: number;
  how?: string;
  why?: string;
  to?: string;
};
const op = (x: unknown) => (x as OpData | null) ?? {};
registerEventWords(
  UNDERWORLD_EVENTS.operation.type,
  (_, e) =>
    `${cap(realm(e.data))} sent ${op(e.data).soldiers ?? "its"} soldiers against ${group(e.data)}, its police no match for it, ${year(e.t)}`,
);
registerEventWords(
  UNDERWORLD_EVENTS.clash.type,
  (_, e) =>
    `Soldiers and the men of ${group(e.data)} fought in ${realm(e.data)}'s towns: some ${op(e.data).dead ?? "few"} dead in the years of raids and clashes, ${op(e.data).soldiers ?? 0} of them soldiers, ${year(e.t)}`,
);
registerEventWords(
  UNDERWORLD_EVENTS.armyTook.type,
  (_, e) =>
    `The army took ${d(e.data)?.boss ?? "the boss"}, boss of ${group(e.data)}${(d(e.data)?.successors ?? 1) > 1 ? "; his lieutenants divided what he held, each for himself, and the killing grew" : ""}, ${year(e.t)}`,
);
registerEventWords(
  UNDERWORLD_EVENTS.truce.type,
  (_, e) =>
    `${cap(realm(e.data))} made a truce with ${group(e.data)}, after years of fighting that had not broken it: the killing fell, for a while, ${year(e.t)}`,
);
registerEventWords(
  UNDERWORLD_EVENTS.disarmed.type,
  (_, e) =>
    `The fighters of ${group(e.data)} laid down their arms on ${realm(e.data)}'s terms, too few now to go on${warOver(d(e.data))}, ${year(e.t)}`,
);
registerEventWords(UNDERWORLD_EVENTS.withdrew.type, (_, e) => {
  const x = op(e.data);
  return x.how === "bought"
    ? `${cap(realm(e.data))}'s soldiers were withdrawn from the towns of ${group(e.data)}: its wealth outbid the seat's purse, and its officers were bought, ${year(e.t)}`
    : `${cap(realm(e.data))} withdrew its soldiers from the towns of ${group(e.data)}${x.why ? `, for ${x.why}` : ""}, ${year(e.t)}`;
});
registerDecisionWords(
  UNDERWORLD_EVENTS.operation.type,
  (world, x) => `${cap(realmOf(world, x.subject))} weighed sending soldiers against a crime group`,
);
registerDecisionWords(
  UNDERWORLD_EVENTS.disarmed.type,
  (world, x) => `A crime group of ${realmOf(world, x.subject)} weighed laying down its arms`,
);
