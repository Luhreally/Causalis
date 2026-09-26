// The god's acts in words (docs/architecture §3.1): what the hand did, where and
// for how long — the root of whatever followed from it.
import { yearOfMoment, type Ref } from "../kernel/index.ts";
import { cellRef } from "../gen/index.ts";
import {
  ACT_EVENTS,
  HAND_EVENTS,
  LOCAL_ACT_EVENTS,
  populationContext,
  type ActArgs,
  type ActKind,
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
