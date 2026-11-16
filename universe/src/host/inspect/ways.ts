// What makes a people's ways what they are, for a land's page (rules/ways.ts, sim/culture/culture.ts): of its most marked ways,
// what presses each toward the end it lies at: the parts of their body and of their land, what they have seen go well, their
// faith, their forebears' wandering, and what they have lived through lately. And a realm's ways through the years, as its seat
// held them (host/years.ts). Pure readings, made when a page is read.
import type { World } from "../../kernel/index.ts";
import type { Block, Line } from "../../bridge/index.ts";
import {
  BODY_PARTS,
  LAND_PARTS,
  WAY_TRAITS,
  bodyReading,
  landReading,
  partsFor,
  wayPartWords,
} from "../../rules/index.ts";
import {
  bodyWays,
  cultureOf,
  landRead,
  landWays,
  populationContext,
  waysLearned,
  waysTarget,
  type Ways,
} from "../../sim/index.ts";
import { WAY_WORDS } from "../../causal/index.ts";
import { yearNow } from "./words.ts";

/** At least this far from the middle, a way is told; a reason pressing it at least this far is named. */
const MARKED = 0.06,
  NAMED = 0.008;

/** One reason a way lies where it does: in words, and how far it presses (toward the high end above nothing). */
export type WayReason = {
  readonly words: string;
  readonly press: number;
  /** What its people are and what they have seen (0), or the chance of their forebears' wandering and their latest years (1). */
  readonly chance?: 1;
};

/** Of each way, what presses it, the heaviest first: body, land, lessons, faith, forebears, what was lived through lately. */
export function waysReasons(world: World, w: Ways, k: number): WayReason[] {
  const ctx = populationContext(world),
    g = ctx.generated,
    body = g.life.people?.body,
    year = yearNow(world),
    out: WayReason[] = [];
  for (const x of partsFor(BODY_PARTS, bodyReading(body), k))
    out.push({ words: wayPartWords(x.part, x.value), press: x.press });
  const land = landReading(landRead(g, w.cell, ctx.medium, ctx.life.appetite));
  for (const x of partsFor(LAND_PARTS, land, k))
    out.push({ words: wayPartWords(x.part, x.value), press: x.press });
  const learned = waysLearned(w, year)[k]!;
  if (Math.abs(learned) >= NAMED)
    out.push({
      words: learned > 0 ? "what they have seen go well" : "what they have seen go ill",
      press: learned,
    });
  const target = waysTarget(world, w, year)[k]!,
    held = target - Math.max(0.02, Math.min(0.98, w.base[k]! + learned));
  if (Math.abs(held) >= NAMED) out.push({ words: "their faith", press: held });
  const made = 0.5 + bodyWays(body)[k]! + landWays(g, w.cell, ctx.medium, ctx.life.appetite)[k]!,
    forebears = w.base[k]! - made;
  if (Math.abs(forebears) >= 0.03)
    out.push({ words: "their forebears' ways", press: forebears, chance: 1 });
  const lately = w.traits[k]! - target;
  if (Math.abs(lately) >= 0.02)
    out.push({ words: "what they have lived through lately", press: lately, chance: 1 });
  // (What they are and have seen first, the heaviest first; their forebears' chance and their latest years after.)
  return out
    .filter((x) => x.words)
    .sort(
      (a, b) =>
        (a.chance ?? 0) - (b.chance ?? 0) ||
        Math.abs(b.press) - Math.abs(a.press) ||
        (a.words < b.words ? -1 : 1),
    );
}

/** A land's most marked ways, each with what presses it there (at most three of each): for the land's People tab. */
export function waysWhyBlock(world: World, cell: number): Block | null {
  const w = cultureOf(world).get(cell);
  if (!w) return null;
  const marked = WAY_TRAITS.map((t, k) => ({ t, k, v: w.traits[k]! }))
    .filter((x) => Math.abs(x.v - 0.5) > MARKED)
    .sort((a, b) => Math.abs(b.v - 0.5) - Math.abs(a.v - 0.5) || a.k - b.k)
    .slice(0, 3);
  if (!marked.length) return null;
  const lines: Line[] = marked.map(({ t, k, v }) => {
    const high = v > 0.5,
      reasons = waysReasons(world, w, k),
      toward = reasons.filter((r) => r.press > 0 === high).slice(0, 3),
      against = reasons.find((r) => r.press > 0 !== high);
    const why = toward.length ? toward.map((r) => r.words).join("; ") : "how their forebears lived";
    return [
      `They ${WAY_WORDS[t]![high ? 1 : 0]}: ${why}${against ? `, though ${against.words} pulls them back` : ""}.`,
    ];
  });
  return { type: "text", title: "What makes them so", lines };
}
