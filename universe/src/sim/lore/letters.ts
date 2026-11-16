// Who reads, land by land (rules/letters.ts): once a land has a script, those whose work wants letters read, and of those its
// fields can spare, as many as its schools reach, the more where word moves freely and where its faith holds its teaching
// written; a generation brings a land most of the way there, and a land that loses its script loses its readers as they die.
// One number a land, reckoned once in ten years in the land's own year (as its ways are weighed), and read each year by the
// lore's finding (sim/lore/lore.ts: inquiry). Nothing a person, nothing that grows with history.
import { YEAR, yearOfMoment, type Hasher, type SimTime, type StateStore, type World } from "../../kernel/index.ts";
import {
  HOLD,
  LETTERS,
  OCC,
  readersAfter,
  readersTarget,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { Province } from "../population/model.ts";
import { politiesOf } from "../polity/polity.ts";
import { townsOf } from "../town/fabric.ts";
import type { OrderStore } from "../order/order.ts";
import { loreOf } from "./lore.ts";

/** A land's readers are reckoned once in so many years, each land in its own year. */
export const LETTERS_EVERY = 10;

export class LettersStore implements StateStore {
  readonly name = "lore.letters";
  /** Each peopled land's readers, a share in thousandths. */
  private readonly read = new Map<number, number>();
  /** What else reads a land's scripture (its faith, sim/belief/belief.ts): set by the faiths when installed. */

  /** The share of a land's people who read (0 … 1). */
  of(cell: number): number {
    return (this.read.get(cell) ?? 0) / 1000;
  }

  set(cell: number, share: number): void {
    const v = Math.round(Math.max(0, Math.min(1, share)) * 1000);
    if (v) this.read.set(cell, v);
    else this.read.delete(cell);
  }

  /** The lands where anyone reads. */
  cells(): number[] {
    return [...this.read.keys()].sort((a, b) => a - b);
  }

  hashInto(h: Hasher): void {
    h.value([...this.read.entries()].sort((a, b) => a[0] - b[0]));
  }

  save(): unknown {
    return { read: [...this.read.entries()].sort((a, b) => a[0] - b[0]) };
  }

  load(state: unknown): void {
    this.read.clear();
    for (const [c, v] of (state as { read: [number, number][] }).read) this.read.set(c, v);
  }
}

/** A world's readers, where it keeps them (a world from before letters keeps none: no one reads there yet). */
export function lettersOf(world: World): LettersStore | null {
  return world.hasStore("lore.letters") ? world.store<LettersStore>("lore.letters") : null;
}

/** The share of a land's people who read (0 … 1). Only reads. */
export function readersOf(world: World, cell: number): number {
  return lettersOf(world)?.of(cell) ?? 0;
}

/** How far a land's faith holds its teaching written (0 … 1): set by the faiths (sim/belief/belief.ts), nothing before. */
let scriptureOf: (world: World, cell: number) => number = () => 0;
export function readsScripture(f: (world: World, cell: number) => number): void {
  scriptureOf = f;
}

/** What a land's teaching reaches now, and why: its script, its scribes, those its fields spare, its schools, its word, its faith. */
export function teachingOf(
  ctx: PopulationContext,
  p: Province,
): {
  target: number;
  script: boolean;
  scribes: number;
  spare: number;
  school: boolean;
  word: number;
  scripture: number;
} {
  const { world } = ctx,
    total = p.total(),
    script = loreOf(world).effect(p.cell, "writing") > 0,
    working = total - p.occupation(OCC.dependent),
    food = p.occupation(OCC.forager) + p.occupation(OCC.farmer) + p.occupation(OCC.herder),
    scribes =
      total > 0
        ? (LETTERS.scribes.leaders * p.occupation(OCC.leader) +
            LETTERS.scribes.traders * p.occupation(OCC.trader) +
            LETTERS.scribes.crafters * p.occupation(OCC.crafter)) /
          total
        : 0,
    spare = working > 0 ? Math.max(0, working - food) / working : 0,
    school = script && schoolIn(ctx, p.cell),
    word = wordIn(world, p.cell),
    scripture = scriptureOf(world, p.cell),
    target = readersTarget({ script, scribes, spare, school, word, scripture });
  return { target, script, scribes, spare, school, word, scripture };
}

/** Whether a school (or a house of higher learning) stands in one of a land's towns. */
function schoolIn(ctx: PopulationContext, cell: number): boolean {
  if (!ctx.world.hasStore("town.fabric")) return false;
  const fabrics = townsOf(ctx.world);
  for (const s of ctx.settlements.inProvince(cell)) {
    const f = fabrics.get(s.ref);
    if (f?.civics.some((c) => (c.kind === "school" || c.kind === "academy") && c.fell === null))
      return true;
  }
  return false;
}

/** How freely word moves in a land's realm (rules/holds.ts word; the middle where it keeps none). */
function wordIn(world: World, cell: number): number {
  if (!world.hasStore("order.bonds") || !world.hasStore("polity.states")) return 0.5;
  const realm = politiesOf(world).of(cell),
    held = realm ? world.store<OrderStore>("order.bonds").of(realm.ref)?.held : undefined;
  return held ? held[HOLD.word]! / 100 : 0.5;
}

/** The year's letters: each peopled land in its year of ten comes the decade's way toward what its teaching reaches. */
export function lettersYear(ctx: PopulationContext, t: SimTime): void {
  const store = lettersOf(ctx.world);
  if (!store) return;
  const year = yearOfMoment(t),
    span = ctx.generated.life.people?.body.span ?? 70;
  for (const p of ctx.provinces.all()) {
    if ((year + p.cell) % LETTERS_EVERY !== 0) continue;
    if (!p.total()) {
      store.set(p.cell, 0);
      continue;
    }
    const was = store.of(p.cell),
      { target } = teachingOf(ctx, p);
    if (!was && !target) continue;
    store.set(p.cell, readersAfter(was, target, LETTERS_EVERY, span));
  }
}

/** Teach a peopled world its letters. */
export function installLetters(world: World, ctx: () => PopulationContext): LettersStore {
  const store = world.register(new LettersStore());
  world.system({ key: "156.lore.letters", every: YEAR, run: (t) => lettersYear(ctx(), t) });
  return store;
}
