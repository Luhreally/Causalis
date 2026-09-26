// The god's acts in words (docs/architecture §3.1): what the hand did, where and
// for how long — the root of whatever followed from it.
import { yearOfMoment, type Ref } from "../kernel/index.ts";
import { cellRef } from "../gen/index.ts";
import { ACT_EVENTS, type ActArgs, type ActKind } from "../sim/index.ts";
import { landWords } from "./generated.ts";
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
