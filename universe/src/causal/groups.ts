// Groups in words (sim/order/groups.ts): a group risen where a shared stake beat what organising costs, its kind read off what it
// does (brigands, pirates and privateers, a free company, a militia, vigilantes, a commune, a mutual-aid society, a lending circle,
// a merchants' league, a sect, a revolutionary circle, a lodge), turned to another kind as its aims moved, hired or licensed by a
// realm, its groups allied, a leader dead and another in his place, and how its hold ended. Who, what, cost and effect: never how
// any crime is done or any weapon used.
import { yearOfMoment, type World } from "../kernel/index.ts";
import { ORG_EVENTS, politiesOf, realmName } from "../sim/index.ts";
import { registerDecisionWords, registerEventWords } from "./why.ts";

type Data = {
  realm?: string;
  group?: string;
  kind?: string;
  was?: string;
  aim?: string;
  into?: string;
  intoKind?: string;
  how?: string;
  leader?: string;
  before?: string;
  patron?: string;
  federation?: string;
  groups?: number;
  members?: number;
  since?: number;
} | null;

const d = (x: unknown) => (x as Data) ?? {},
  realm = (x: unknown) => d(x)?.realm ?? "a realm",
  year = (t: number) => `year ${yearOfMoment(t)}`,
  cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** A group's name with what it is: the Vorath pirates, the Asha sect, the Kesh mutual-aid society. */
export function orgWords(name: string | undefined, kind: string | undefined): string {
  return `the ${name ?? "nameless"} ${kind ?? "band"}`;
}
const group = (x: unknown) => orgWords(d(x)?.group, d(x)?.kind);

/** Many of a kind: "lending circles", "militias", "brigands". */
export function orgKinds(kind: string | undefined): string {
  const k = kind ?? "group";
  return k.endsWith("s") ? k : k.endsWith("y") ? `${k.slice(0, -1)}ies` : `${k}s`;
}
/** Becoming a kind: "turned brigands", "became a commune", "became an insurgent band". */
function becoming(kind: string | undefined): string {
  const k = kind ?? "something else";
  return k.endsWith("s") ? `turned ${k}` : `became ${/^[aeiou]/.test(k) ? "an" : "a"} ${k}`;
}

/** What each kind is, said once: what it does, for whom. */
export const ORG_IS: Readonly<Record<string, string>> = {
  brigands: "preying on the roads its seat cannot keep",
  pirates: "preying on the ships of a sea no navy holds",
  privateers: "preying on a foe's ships under a realm's licence",
  raiders: "raiding a foe's lands in a realm's pay",
  smugglers: "carrying what the law forbids or taxes",
  militia: "its people under arms to guard their own",
  vigilantes: "holding wrongdoers to account where the courts do not",
  commune: "a town ruling itself where its seat's hand does not reach",
  "mutual-aid society":
    "its members paying in so that the sick, the widowed and the buried are cared for",
  confraternity: "a faith's laymen caring for their own sick, poor and dead",
  brotherhood: "a sworn fellowship caring for its own, its doings kept among them",
  "lending circle": "its members pooling what they save and lending it in turn",
  "merchant league": "merchants of many towns banded for safe passage and rights",
  sect: "keeping its faith apart from the one its seat holds",
  "hidden sect": "keeping in secret a faith its seat forbids",
  "free company": "veterans who sell their arms to whoever pays",
  "sea company": "ships and crews sold to whoever pays",
  "revolutionary circle": "organising to overthrow its seat",
  insurgents: "under arms against its seat",
  resistance: "under arms against a foreign hand holding its land",
  lodge: "a sworn few keeping their counsel against the seat",
  party: "carrying an interest no great house speaks for in its people's choosing",
  "maroon community": "those who fled bondage or the law, holding a hard land apart",
  "monastic order":
    "the devout keeping their faith under a rule of their own on a land of their own",
  "learned society": "the learned banded for inquiry and the free word",
};

registerEventWords(
  ORG_EVENTS.rose.type,
  (_, e) =>
    `${cap(group(e.data))} formed in ${realm(e.data)}, ${ORG_IS[d(e.data)?.kind ?? ""] ?? "its people banded for a stake they share"}, ${d(e.data)?.leader ?? "one of them"} at its head, ${year(e.t)}`,
);
registerEventWords(
  ORG_EVENTS.turned.type,
  (_, e) =>
    `${cap(orgWords(d(e.data)?.group, d(e.data)?.was))} of ${realm(e.data)} ${becoming(d(e.data)?.kind)}, now ${ORG_IS[d(e.data)?.kind ?? ""] ?? "doing otherwise"}, ${year(e.t)}`,
);
registerEventWords(
  ORG_EVENTS.hired.type,
  (_, e) =>
    `${cap(d(e.data)?.patron ?? "A realm")} took ${group(e.data)} of ${realm(e.data)} into its pay${d(e.data)?.members ? `, some ${d(e.data)!.members} strong` : ""}, ${year(e.t)}`,
);
registerEventWords(
  ORG_EVENTS.unpaid.type,
  (_, e) =>
    `${cap(group(e.data))} of ${realm(e.data)} left the pay of ${d(e.data)?.patron ?? "a realm"}, whose treasury had nothing by it${d(e.data)?.members ? `: some ${d(e.data)!.members} under arms with no one to pay them` : ""}, ${year(e.t)}`,
);
registerEventWords(
  ORG_EVENTS.chartered.type,
  (_, e) => `${cap(realm(e.data))} granted ${group(e.data)} its rights, ${year(e.t)}`,
);
registerEventWords(
  ORG_EVENTS.leader.type,
  (_, e) =>
    `${d(e.data)?.before ?? "The head"} of ${group(e.data)} was gone, and ${d(e.data)?.leader ?? "another"} took his place, ${year(e.t)}`,
);
registerEventWords(
  ORG_EVENTS.federation.type,
  (_, e) =>
    `${d(e.data)?.groups ?? "Several"} ${orgKinds(d(e.data)?.kind)} of ${realm(e.data)} allied as the ${d(e.data)?.federation ?? "one"} federation, ${year(e.t)}`,
);
registerEventWords(ORG_EVENTS.ended.type, (_, e) => {
  const x = d(e.data),
    how = x?.how ?? "withered";
  const said =
    how === "crushed"
      ? "was broken by its realm"
      : how === "merged"
        ? `was taken into ${orgWords(x?.into, x?.intoKind ?? x?.kind)}`
        : how === "won"
          ? "had what it formed for, and disbanded"
          : how === "fallen with its realm"
            ? "fell with its realm"
            : "withered, its stake no longer worth what holding together cost";
  return `${cap(group(e.data))} of ${realm(e.data)} ${said}, ${year(e.t)}`;
});

const realmOf = (world: World, ref: string) => {
  const p = politiesOf(world).get(ref as Parameters<ReturnType<typeof politiesOf>["get"]>[0]);
  return p ? realmName(p) : "a realm";
};
for (const [type, words] of [
  [ORG_EVENTS.rose.type, "A group formed in"],
  [ORG_EVENTS.turned.type, "A group turned to other aims in"],
  [ORG_EVENTS.hired.type, "A group was taken into a realm's pay from"],
  [ORG_EVENTS.chartered.type, "A group was granted its rights in"],
  [ORG_EVENTS.federation.type, "Groups allied in"],
  [ORG_EVENTS.ended.type, "A group's hold ended in"],
] as const)
  registerDecisionWords(type, (world, x) => `${words} ${realmOf(world, x.subject)}`);
