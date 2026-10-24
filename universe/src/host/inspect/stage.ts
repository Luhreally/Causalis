// A world's stage (Phase 31 M167, asked for 2026-10-24: "i should be able to be in my game and see
// the cell stage and every stage like spore"): what its peoples have come to, read from the
// chronicle's firsts — bands across the land, then villages, realms, cities, writing, iron,
// engines, electricity, orbit and other worlds — each with the year it was first reached and
// where. Before them all, the world's own beginning (its first cells, its beasts, its first
// people) is the genesis's to show.
import type { World } from "../../kernel/index.ts";
import type { Breakdown, Line, WorldFirst, WorldStage } from "../../bridge/index.ts";
import { firstsNow } from "./alerts.ts";
import { landLink } from "./names.ts";

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

/** The stage each first opens, by the first's words. */
const OPENS = new Map(
  WORLD_STAGES.flatMap((s) => (s.first === null ? [] : [[s.first, s.name] as const])),
);

/** The world's firsts, the earliest first (each its what, year, land and happening; its stage). */
export function worldFirstsNow(world: World): WorldFirst[] {
  return [...firstsNow(world)]
    .map((f) => {
      const stage = OPENS.get(f.what);
      return { what: f.what, year: f.year, land: f.land, ref: f.ref, ...(stage ? { stage } : {}) };
    })
    .sort((a, b) => a.year - b.year || (a.what < b.what ? -1 : a.what > b.what ? 1 : 0));
}

/** Where a world's peoples have come to: the stage reached last in order, and when each was. */
export function stageOf(world: World): WorldStage {
  const firsts = new Map(firstsNow(world).map((f) => [f.what, f]));
  const stages = WORLD_STAGES.map((s) => {
    const f = s.first === null ? null : firsts.get(s.first);
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
        ...(x.land !== null ? [", in ", landLink(world, x.land)] : []),
      ];
    }),
    more: "Before them all, its first cells, its beasts and its first people: “Its beginning” shows them",
  };
}
