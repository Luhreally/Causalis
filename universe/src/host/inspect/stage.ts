// A world's stage (Phase 31 M167, asked for 2026-10-24: "i should be able to be in my game and see
// the cell stage and every stage like spore"): what its peoples have come to, read from the
// chronicle's firsts — bands across the land, then villages, realms, cities, writing, iron,
// engines, electricity, orbit and other worlds — each with the year it was first reached and
// where. Before them all, the world's own beginning (its first cells, its beasts, its first
// people) is the genesis's to show. On a world where nothing burns (Phase 56) its own ages stand in
// for iron, engines and electricity.
import type { World } from "../../kernel/index.ts";
import { KIND_AGES, PRINCIPLES, PRINCIPLE_INDEX, kindBurns } from "../../rules/index.ts";
import type { Breakdown, Line, WorldFirst, WorldStage } from "../../bridge/index.ts";
import { kindName, kindOf } from "../kinds.ts";
import { firstsNow } from "./alerts.ts";
import { landLink } from "./names.ts";
import { sentence } from "./words.ts";

/** The stages in their order, each with the first that reaches it (the bands: from the start). */
export const WORLD_STAGES: readonly {
  readonly id: string;
  readonly icon: string;
  readonly name: string;
  readonly first: string | null;
}[] = [
  { id: "bands", icon: "🔥", name: "Bands", first: null },
  { id: "villages", icon: "🏘️", name: "Villages", first: "🏘️ A town" },
  { id: "realms", icon: "👑", name: "Realms", first: "👑 A realm" },
  { id: "cities", icon: "🏙️", name: "Cities", first: "🏙️ A city" },
  { id: "writing", icon: "📜", name: "Writing", first: "💡 Writing" },
  { id: "iron", icon: "⚔️", name: "Iron", first: "💡 Iron" },
  { id: "engines", icon: "⚙️", name: "Engines", first: "💡 The steam engine" },
  { id: "electricity", icon: "⚡", name: "Electricity", first: "💡 Electricity" },
  { id: "orbit", icon: "🛰️", name: "Orbit", first: "🛰️ A satellite" },
  { id: "worlds", icon: "🪐", name: "Other worlds", first: "🪐 A colony" },
];

type StageDef = (typeof WORLD_STAGES)[number];
type Found = ReturnType<typeof firstsNow>[number];

/** Earth's stages a kind's own ages stand in for, where nothing burns (Phase 56). */
const KIND_STAGES: Readonly<Record<string, "metal" | "industry" | "modern">> = {
  iron: "metal",
  engines: "industry",
  electricity: "modern",
};

/**
 * A world's stages, each with the firsts that reach it: Earth's; or, on a world where nothing burns
 * (Phase 56), its own ages in place of iron, engines and electricity, each reached by the first of
 * the principles that bring it.
 */
function stagesOf(world: World): { def: StageDef; firsts: readonly string[] }[] {
  const kind = kindOf(world);
  return WORLD_STAGES.map((def) => {
    const era = KIND_STAGES[def.id];
    if (kind === "rocky" || kindBurns(kind) || !era)
      return { def, firsts: def.first === null ? [] : [def.first] };
    const age = KIND_AGES[kind][era],
      firsts = age.by.map(
        (id) => `💡 ${sentence(kindName(world, PRINCIPLES[PRINCIPLE_INDEX.get(id)!]!))}`,
      );
    return {
      def: { id: def.id, icon: age.icon, name: sentence(age.name), first: firsts[0] ?? null },
      firsts,
    };
  });
}

/** The earliest of the world's firsts with these words (null: none yet). */
function earliest(found: readonly Found[], whats: readonly string[]): Found | null {
  return found.filter((f) => whats.includes(f.what)).sort((a, b) => a.year - b.year)[0] ?? null;
}

/** The world's firsts, the earliest first (each its what, year, land and happening; its stage). */
export function worldFirstsNow(world: World): WorldFirst[] {
  const found = firstsNow(world),
    // (A stage is opened by the earliest of the firsts that reach it.)
    opens = new Map<string, string>();
  for (const { def, firsts } of stagesOf(world)) {
    const f = earliest(found, firsts);
    if (f) opens.set(f.what, def.name);
  }
  return [...found]
    .map((f) => {
      const stage = opens.get(f.what);
      return { what: f.what, year: f.year, land: f.land, ref: f.ref, ...(stage ? { stage } : {}) };
    })
    .sort((a, b) => a.year - b.year || (a.what < b.what ? -1 : a.what > b.what ? 1 : 0));
}

/** Where a world's peoples have come to: the stage reached last in order, and when each was. */
export function stageOf(world: World): WorldStage {
  const found = firstsNow(world);
  const stages = stagesOf(world).map(({ def: s, firsts }) => {
    const f = earliest(found, firsts);
    return {
      id: s.id,
      icon: s.icon,
      name: s.name,
      first: s.first,
      year: s.first === null ? 0 : (f?.year ?? null),
      land: f?.land ?? null,
      ref: f?.ref ?? null,
    };
  });
  const now = [...stages].reverse().find((s) => s.year !== null) ?? stages[0]!;
  return { id: now.id, icon: now.icon, name: now.name, stages };
}

/** The stage's chip, broken down: each stage, when it was first reached and where, or not yet. */
export function stageBreakdown(world: World): Breakdown {
  const s = stageOf(world);
  return {
    title: `${s.icon} The world's stage: ${s.name}`,
    lines: s.stages.map((x): Line => {
      const head = `${x.icon} ${x.name}: `;
      if (x.first === null) return [head, "its bands across the land, from its first year"];
      if (x.year === null) return [head, "not yet"];
      return [
        head,
        `since year ${x.year.toLocaleString("en-US")}`,
        ...(x.land !== null ? [", in ", landLink(world, x.land, true)] : []),
      ];
    }),
    more: "Before them all, its first cells, its beasts and its first people: “Its beginning” shows them",
  };
}
