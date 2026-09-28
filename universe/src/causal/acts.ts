// The god's acts in words (docs/architecture §3.1): what the hand did, where and
// for how long — the root of whatever followed from it.
import { yearOfMoment, type Ref } from "../kernel/index.ts";
import { cellRef } from "../gen/index.ts";
import {
  ACT_EVENTS,
  DISASTER_EVENTS,
  HAND_EVENTS,
  LOCAL_ACT_EVENTS,
  PEOPLE_ACT_EVENTS,
  beliefOf,
  politiesOf,
  populationContext,
  realmName,
  type ActArgs,
  type ActKind,
  type ConvertArgs,
  type LandArgs,
  type PairArgs,
  type RealmArgs,
} from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { principleName } from "./lore.ts";
import { registerCommandWords, registerEventWords } from "./why.ts";

const DEEDS: Readonly<Record<ActKind, readonly [string, string]>> = {
  rain: ["withheld the rain over", "sent rain over"],
  harvest: ["blighted the harvest of", "blessed the harvest of"],
  plague: ["sent a plague on", "healed the sick of"],
  inspire: ["inspired the people of", "inspired the people of"],
};

function deed(kind: ActKind, sign: number): string {
  return DEEDS[kind][sign < 0 ? 0 : 1];
}

const span = (years: number) => (years ? ` for ${years} year${years === 1 ? "" : "s"}` : "");

for (const kind of Object.keys(DEEDS) as ActKind[]) {
  registerEventWords(ACT_EVENTS[kind].type, (world, e) => {
    const d = e.data as { sign?: number; years?: number } | null;
    return `By your hand: you ${deed(kind, d?.sign ?? 1)} ${landWords(world, e.place as Ref | null)}${span(d?.years ?? 0)}, year ${yearOfMoment(e.t)}`;
  });
  registerCommandWords(`act.${kind}`, (world, c) => {
    const a = c.args as ActArgs;
    return `Your act: you ${deed(kind, a.sign)} ${landWords(world, cellRef(0, a.cell))}${kind === "inspire" ? "" : span(a.years)}, year ${yearOfMoment(c.t)}`;
  });
}

// The hand on a village: its people lived as themselves while it rested there.
const villageName = (
  world: Parameters<Parameters<typeof registerEventWords>[1]>[0],
  ref: unknown,
) =>
  (typeof ref === "string" && populationContext(world).settlements.get(ref as Ref)?.name) ||
  "a village";
registerEventWords(HAND_EVENTS.laid.type, (world, e) => {
  const d = e.data as { name?: string; people?: number } | null;
  return `By your hand: you laid your hand on ${d?.name ?? villageName(world, e.subjects[0])}, and its ${d?.people ?? ""} people lived as themselves, year ${yearOfMoment(e.t)}`.replace(
    "its  people",
    "its people",
  );
});
registerEventWords(
  HAND_EVENTS.lifted.type,
  (world, e) =>
    `You lifted your hand from ${villageName(world, e.subjects[0])}, year ${yearOfMoment(e.t)}`,
);
registerCommandWords("hand.lay", (world, c) => {
  const v = (c.args as { village: string }).village;
  return `Your act: you laid your hand on ${villageName(world, v)}, year ${yearOfMoment(c.t)}`;
});
registerCommandWords(
  "hand.lift",
  (_, c) => `Your act: you lifted your hand, year ${yearOfMoment(c.t)}`,
);

// The finer acts: on a village or a city, and on one of the people under the hand.
const named = (d: unknown, fallback: string) => {
  const v = (d as { name?: unknown } | null)?.name;
  return typeof v === "string" && v ? v : fallback;
};
registerEventWords(
  LOCAL_ACT_EVENTS.shrine.type,
  (world, e) =>
    `By your hand: a shrine rose in ${named(e.data, villageName(world, e.subjects[0]))}, year ${yearOfMoment(e.t)}`,
);
registerEventWords(LOCAL_ACT_EVENTS.fire.type, (world, e) => {
  const blocks = (e.data as { blocks?: number } | null)?.blocks ?? 0;
  return `By your hand: fire swept ${named(e.data, villageName(world, e.subjects[0]))}, and ${blocks} of its blocks burned, year ${yearOfMoment(e.t)}`;
});
registerEventWords(
  LOCAL_ACT_EVENTS.spring.type,
  (world, e) =>
    `By your hand: a spring welled up at ${named(e.data, villageName(world, e.subjects[0]))}, year ${yearOfMoment(e.t)}`,
);
registerEventWords(LOCAL_ACT_EVENTS.inspireOne.type, (_, e) => {
  const p = (e.data as { principle?: string | null } | null)?.principle ?? null;
  return `By your hand: ${named(e.data, "one of your people")} was inspired${p ? `, and came upon ${principleName(p)}` : ", though there was nothing new their land could learn"}, year ${yearOfMoment(e.t)}`;
});
registerEventWords(LOCAL_ACT_EVENTS.blessOne.type, (_, e) => {
  const d = e.data as { age?: number; until?: number } | null;
  return `By your hand: ${named(e.data, "one of your people")}${d?.age !== undefined ? `, ${d.age},` : ""} was blessed, and spared death${d?.until ? ` until year ${d.until}` : ""} while your hand rests, year ${yearOfMoment(e.t)}`;
});
const place = (world: Parameters<typeof villageName>[0], c: { args: unknown }) =>
  villageName(world, (c.args as { village?: string }).village);
registerCommandWords(
  "act.shrine",
  (world, c) => `Your act: you raised a shrine in ${place(world, c)}, year ${yearOfMoment(c.t)}`,
);
registerCommandWords(
  "act.fire",
  (world, c) => `Your act: you sent fire on ${place(world, c)}, year ${yearOfMoment(c.t)}`,
);
registerCommandWords(
  "act.spring",
  (world, c) => `Your act: you opened a spring at ${place(world, c)}, year ${yearOfMoment(c.t)}`,
);
registerCommandWords(
  "act.inspire-one",
  (_, c) => `Your act: you inspired one of the people under your hand, year ${yearOfMoment(c.t)}`,
);
registerCommandWords(
  "act.bless-one",
  (_, c) => `Your act: you blessed one of the people under your hand, year ${yearOfMoment(c.t)}`,
);

// The god's hold on the peoples (Phase 12 M107): realms set at war and at peace, made friends
// or rivals; a land stirred to rise, a land turned to a faith.
type WordsWorld = Parameters<Parameters<typeof registerEventWords>[1]>[0];
const realmCalled = (world: WordsWorld, ref: unknown) => {
  const r = typeof ref === "string" ? politiesOf(world).get(ref as Ref) : undefined;
  return r ? realmName(r) : "a realm";
};
const pairWords = (world: WordsWorld, c: { args: unknown }) => {
  const a = c.args as PairArgs;
  return [realmCalled(world, a.a), realmCalled(world, a.b)] as const;
};
registerCommandWords("act.war", (world, c) => {
  const [a, b] = pairWords(world, c);
  return `Your act: you set ${a} upon ${b}, year ${yearOfMoment(c.t)}`;
});
registerCommandWords("act.peace", (world, c) => {
  const [a, b] = pairWords(world, c);
  return `Your act: you ended the war between ${a} and ${b}, year ${yearOfMoment(c.t)}`;
});
registerCommandWords("act.friendship", (world, c) => {
  const [a, b] = pairWords(world, c);
  return `Your act: you made friends of ${a} and ${b}, year ${yearOfMoment(c.t)}`;
});
registerCommandWords("act.discord", (world, c) => {
  const [a, b] = pairWords(world, c);
  return `Your act: you sowed discord between ${a} and ${b}, year ${yearOfMoment(c.t)}`;
});
registerCommandWords(
  "act.rise",
  (world, c) =>
    `Your act: you stirred ${landWords(world, cellRef(0, (c.args as LandArgs).cell))} to rise, year ${yearOfMoment(c.t)}`,
);
registerCommandWords("act.convert", (world, c) => {
  const a = c.args as ConvertArgs;
  return `Your act: you turned ${landWords(world, cellRef(0, a.cell))} to ${beliefOf(world).get(a.faith)?.name ?? "a faith"}, year ${yearOfMoment(c.t)}`;
});
registerEventWords(PEOPLE_ACT_EVENTS.friendship.type, (_, e) => {
  const d = e.data as { a?: string; b?: string } | null;
  return `By your hand: ${d?.a ?? "a realm"} and ${d?.b ?? "a realm"} were made friends, year ${yearOfMoment(e.t)}`;
});
registerEventWords(PEOPLE_ACT_EVENTS.discord.type, (_, e) => {
  const d = e.data as { a?: string; b?: string } | null;
  return `By your hand: discord was sown between ${d?.a ?? "a realm"} and ${d?.b ?? "a realm"}, year ${yearOfMoment(e.t)}`;
});

// The god's disasters and makings (Phase 13 M112, M113).
const landOf = (world: WordsWorld, c: { args: unknown }) =>
  landWords(world, cellRef(0, (c.args as LandArgs).cell));
/** A number said with its thousands marked, whatever the device's locale: 12,345. */
const said = (n: unknown) =>
  typeof n === "number" ? String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "some";
registerEventWords(DISASTER_EVENTS.quake.type, (world, e) => {
  const d = e.data as { dead?: number; blocks?: number } | null;
  return `By your hand: the ground shook under ${landWords(world, e.place as Ref | null)}, and ${said(d?.dead)} died${d?.blocks ? `, and ${d.blocks} of its cities' blocks fell` : ""}, year ${yearOfMoment(e.t)}`;
});
registerEventWords(DISASTER_EVENTS.meteor.type, (world, e) => {
  const d = e.data as { dead?: number; years?: number } | null;
  return `By your hand: fire fell from the sky on ${landWords(world, e.place as Ref | null)}: ${said(d?.dead)} died, and its fields burned for ${d?.years ?? 2} years, year ${yearOfMoment(e.t)}`;
});
registerEventWords(DISASTER_EVENTS.flood.type, (world, e) => {
  const d = e.data as { dead?: number; lands?: number } | null,
    down = (d?.lands ?? 1) - 1;
  return `By your hand: the river rose over ${landWords(world, e.place as Ref | null)}${down > 0 ? ` and ${down} land${down === 1 ? "" : "s"} downriver` : ""}, and ${said(d?.dead)} drowned, year ${yearOfMoment(e.t)}`;
});
registerCommandWords(
  "act.quake",
  (world, c) =>
    `Your act: you shook the ground under ${landOf(world, c)}, year ${yearOfMoment(c.t)}`,
);
registerCommandWords(
  "act.meteor",
  (world, c) =>
    `Your act: you sent fire from the sky on ${landOf(world, c)}, year ${yearOfMoment(c.t)}`,
);
registerCommandWords(
  "act.flood",
  (world, c) =>
    `Your act: you raised the river over ${landOf(world, c)}, year ${yearOfMoment(c.t)}`,
);
registerEventWords(PEOPLE_ACT_EVENTS.settle.type, (world, e) => {
  const d = e.data as { count?: number } | null;
  return `By your hand: ${said(d?.count)} settlers came into ${landWords(world, e.place as Ref | null)} from ${landWords(world, (e.subjects[0] as Ref | undefined) ?? null)}, year ${yearOfMoment(e.t)}`;
});
registerCommandWords(
  "act.settle",
  (world, c) => `Your act: you sent settlers into ${landOf(world, c)}, year ${yearOfMoment(c.t)}`,
);
registerEventWords(PEOPLE_ACT_EVENTS.union.type, (_, e) => {
  const d = e.data as { a?: string; b?: string } | null;
  return `By your hand: ${d?.b ?? "a realm"} joined ${d?.a ?? "a realm"}, and the two were one realm, year ${yearOfMoment(e.t)}`;
});
registerCommandWords("act.union", (world, c) => {
  const [a, b] = pairWords(world, c);
  return `Your act: you made one realm of ${a} and ${b}, year ${yearOfMoment(c.t)}`;
});
for (const [kind, words] of [
  ["bless", "blessed with content"],
  ["curse", "cursed with unrest"],
] as const) {
  registerEventWords(PEOPLE_ACT_EVENTS[kind].type, (_, e) => {
    const d = e.data as { name?: string } | null;
    return `By your hand: the lands of ${d?.name ?? "a realm"} were ${words}, year ${yearOfMoment(e.t)}`;
  });
  registerCommandWords(`act.${kind}`, (world, c) => {
    const r = realmCalled(world, (c.args as RealmArgs).realm);
    return `Your act: you ${kind === "bless" ? "blessed" : "cursed"} the lands of ${r}, year ${yearOfMoment(c.t)}`;
  });
}
