// A people's ways in words (docs/architecture §19, §13): what sets them apart —
// their strongest leanings, each between two poles — and why: the events that
// pushed them, the people they came from, the land. And how their speech has
// drifted from the first people's.
import { defineKind, makeRef, parseRef, type CauseRef, type Ref } from "../kernel/index.ts";
import { cellRef, cradleTongue, tongueLikeness, type Tongue } from "../gen/index.ts";
import { WAY_TRAITS, cultureOf, populationContext, type Ways } from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { edges, registerExplainer } from "./why.ts";

/** A people's ways, as a thing to ask why of. */
export const WAYS = defineKind("ways", "a people's ways", "structural");
export function waysRef(cell: number): Ref {
  return makeRef(WAYS, 0, cell);
}

/** Each trait's two poles, in words: [low, high]. */
export const WAY_WORDS: Readonly<Record<string, readonly [string, string]>> = {
  kinship: ["stand on their own", "hold to their kin"],
  hierarchy: ["hold all equal", "keep to rank"],
  piety: ["care little for the gods", "are devout"],
  valour: ["shun fighting", "prize valour"],
  trade: ["keep to what they make", "trade eagerly"],
  openness: ["are wary of strangers", "welcome strangers"],
  tradition: ["take to new ways", "keep the old ways"],
  thrift: ["share and feast", "save against hard times"],
};

/** A people's strongest leanings, most marked first: "trade eagerly, keep to rank". */
export function waysWords(w: Ways, most = 3): string[] {
  return WAY_TRAITS.map((t, i) => ({ t, v: w.traits[i]! }))
    .filter(({ v }) => Math.abs(v - 0.5) > 0.06)
    .sort((a, b) => Math.abs(b.v - 0.5) - Math.abs(a.v - 0.5) || (a.t < b.t ? -1 : 1))
    .slice(0, most)
    .map(({ t, v }) => WAY_WORDS[t]![v > 0.5 ? 1 : 0]);
}

function listWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

/** How much of the first people's speech a tongue keeps, as a whole percentage. */
export function kept(t: Tongue, culture: number): number {
  return Math.round(100 * tongueLikeness(t, cradleTongue(culture)));
}

registerExplainer(WAYS.code, (world, ref) => {
  if (!world.storeNames().includes("culture.ways")) return null;
  const cell = parseRef(ref).b,
    w = cultureOf(world).get(cell);
  if (!w) return null;
  const words = waysWords(w),
    ctx = populationContext(world);
  const claim = `The people of ${landWords(world, cellRef(0, cell))} ${
    words.length ? listWords(words) : "keep to the middle of every way"
  }; their speech keeps ${kept(w.tongue, ctx.culture)}% of the first people's sounds`;
  const total = w.nudges.reduce((s, n) => s + Math.abs(n.amount), 0) || 1;
  const causes: CauseRef[] = w.nudges.map((n) => ({
    ref: n.event,
    role: "pressure",
    weight: (0.7 * Math.abs(n.amount)) / total,
  }));
  if (w.from) causes.push({ ref: w.from, role: "enabler", weight: 0.2 });
  causes.push({ ref: cellRef(0, cell), role: "constraint", weight: 0.1 });
  return { ref, claim, basis: "recorded", t: null, causes: edges(world, causes) };
});
