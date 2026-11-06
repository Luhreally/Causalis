// What has been lost (K1, classic 81): the crafts a land has lost and not yet come back to, those no one living holds,
// and what was kept of them and where. Nothing here for a land that has lost nothing, and nothing for a world that never
// has. What a craft asks to be held is read off the tree: how deep it lies, and whose hands it wants.
import { Hasher, type Ref, type StateStore, type World } from "../../kernel/index.ts";
import { OCC, PRINCIPLE_DEPTH, type CivicKind, type Principle } from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { Province } from "../population/model.ts";

export type LostWhy =
  | "emptied"
  | "plague"
  | "hunger"
  | "war"
  | "strike"
  | "quake"
  | "stone"
  | "fire"
  | "flood"
  | "left";

/** What a people keeps things in, by what it is. */
export type KeepForm = "brood" | "reef" | "written" | "reciters" | "songs";

export type CraftBack = {
  readonly year: number;
  readonly how: "taught" | "found" | "kept";
  /** The land it came back from, the archive it was found in. */
  readonly from: number | null;
  readonly kept: number | null;
  readonly event: Ref;
};

export type LostCraft = {
  readonly id: string;
  readonly cell: number;
  readonly year: number;
  readonly event: Ref;
  readonly why: LostWhy;
  readonly cause: Ref | null;
  /** The land's people before it fell, those left, the hands left to hold this craft, those it wanted. */
  readonly then: number;
  readonly left: number;
  readonly hands: number;
  readonly need: number;
  /** How many other lands held it then. */
  readonly others: number;
  /** The archive that holds it (its number). */
  readonly kept: number | null;
  /** When it first came to this land (what it had of it). */
  readonly since: number;
  back: CraftBack | null;
};

export type WorldLoss = {
  readonly id: string;
  readonly year: number;
  readonly event: Ref;
  /** The last land that held it, its loss there. */
  readonly last: number;
  readonly lastEvent: Ref;
  found: { readonly year: number; readonly cell: number; readonly event: Ref } | null;
};

export type KeptRead = {
  readonly id: string;
  readonly cell: number;
  readonly year: number;
  readonly event: Ref;
};

export type Archive = {
  readonly n: number;
  readonly cell: number;
  readonly town: Ref;
  readonly name: string;
  readonly form: KeepForm;
  readonly civic: CivicKind | null;
  /** The lot its building stands on (-1: none of its own). */
  readonly at: number;
  readonly year: number;
  readonly event: Ref;
  /** What it holds, as it came to hold it. */
  crafts: string[];
  read: KeptRead[];
  /** When no one could any longer read it, and why. */
  faded: number | null;
};

/** The fewest hands that hold the shallowest craft, and how much more each step down the tree asks. */
export const HOLD_ROOT = 6,
  HOLD_STEP = 3;
/** A hive holds with many fewer: what one worker knows all do, and it goes only when the brood goes. */
export const HIVE_HOLDS = 8;
/** How long after a land loses a craft it can take it up again, however many hands it has. */
export const RETAKE_AFTER = 12;
/** A closed loss stands this long on its pages; then it is let go, its event with it. */
export const LOSS_KEPT = 150;
/** The most closed losses, and the most archives, a world keeps. */
export const MOST_CLOSED = 1500,
  MOST_ARCHIVES = 300;

const NEED_BY_DEPTH: readonly number[] = (() => {
  const out: number[] = [];
  let n = HOLD_ROOT;
  for (let d = 0; d < 80; d++) {
    out.push(n);
    n *= HOLD_STEP;
  }
  return out;
})();

/** How many hands a land wants to go on holding a craft: more, the deeper it lies. */
export function needOfHands(p: Principle): number {
  return NEED_BY_DEPTH[Math.min(79, PRINCIPLE_DEPTH.get(p.id) ?? 0)]!;
}

/** Whether a world's people are a hive. */
export function isHive(ctx: PopulationContext): boolean {
  const body = ctx.generated.life.people?.body;
  return (body?.social ?? 0) >= 0.9 && (body?.size ?? 100) < 100 && body?.medium !== "water";
}

/** The hands a land has that could hold a craft: those whose work it is, or one in ten of all. */
export function handsHolding(ctx: PopulationContext, prov: Province, p: Principle): number {
  const d = p.drivers,
    own =
      (d.crafters ?? 0) * prov.occupation(OCC.crafter) +
      (d.farmers ?? 0) * prov.occupation(OCC.farmer) +
      (d.herders ?? 0) * prov.occupation(OCC.herder) +
      (d.traders ?? 0) * prov.occupation(OCC.trader) +
      (d.leaders ?? 0) * prov.occupation(OCC.leader),
    hands = Math.max(own, prov.total() / 10);
  return isHive(ctx) ? hands * HIVE_HOLDS : hands;
}

export class LostStore implements StateStore {
  readonly name = "lore.lost";
  private readonly open = new Map<number, Map<string, LostCraft>>();
  /** Those that came back, kept a while for their pages. */
  closed: LostCraft[] = [];
  private readonly world = new Map<string, WorldLoss>();
  /** Those no one held for a while, and someone came to again. */
  foundAgain: WorldLoss[] = [];
  archives: Archive[] = [];
  /** Those that can still be found: read each year. */
  private live: Archive[] = [];
  private nextArchive = 0;
  private readonly byTown = new Map<string, Archive>();
  private digest = "";

  /** What a land has lost and not come back to, if anything. */
  ofLand(cell: number): ReadonlyMap<string, LostCraft> | undefined {
    return this.open.get(cell);
  }
  /** The lands that have lost something. */
  lands(): readonly number[] {
    return [...this.open.keys()].sort((a, b) => a - b);
  }
  /** Everything lost and not yet back. */
  allOpen(): LostCraft[] {
    const out: LostCraft[] = [];
    for (const m of this.open.values()) out.push(...m.values());
    return out.sort((a, b) => a.year - b.year || a.cell - b.cell || (a.id < b.id ? -1 : 1));
  }
  /** A craft no one living holds. */
  worldLoss(id: string): WorldLoss | undefined {
    return this.world.get(id);
  }
  worldLosses(): WorldLoss[] {
    return [...this.world.values()].sort((a, b) => a.year - b.year || (a.id < b.id ? -1 : 1));
  }
  /** Every loss of a craft told, the newest first: those open, and those come back. */
  losses(id: string): LostCraft[] {
    const out: LostCraft[] = [];
    for (const m of this.open.values()) {
      const l = m.get(id);
      if (l) out.push(l);
    }
    for (const l of this.closed) if (l.id === id) out.push(l);
    return out.sort((a, b) => b.year - a.year || a.cell - b.cell);
  }
  /** Every archive that has held anything, by number. */
  archive(n: number): Archive | undefined {
    return this.archives.find((a) => a.n === n);
  }
  archiveOfTown(town: string): Archive | undefined {
    return this.byTown.get(town);
  }
  archivesIn(cell: number): Archive[] {
    return this.archives.filter((a) => a.cell === cell);
  }
  liveArchives(): readonly Archive[] {
    return this.live;
  }

  addLoss(l: LostCraft): void {
    let m = this.open.get(l.cell);
    if (!m) this.open.set(l.cell, (m = new Map()));
    m.set(l.id, l);
    this.fold(`-${l.cell}:${l.id}:${l.year}`);
  }
  /** A land has it again. */
  closeLoss(l: LostCraft, back: CraftBack): void {
    const m = this.open.get(l.cell);
    m?.delete(l.id);
    if (m && !m.size) this.open.delete(l.cell);
    l.back = back;
    this.closed.push(l);
    this.fold(`+${l.cell}:${l.id}:${back.year}`);
  }
  addWorldLoss(w: WorldLoss): void {
    this.world.set(w.id, w);
    this.fold(`!${w.id}:${w.year}`);
  }
  closeWorldLoss(w: WorldLoss, found: NonNullable<WorldLoss["found"]>): void {
    this.world.delete(w.id);
    w.found = found;
    this.foundAgain.push(w);
    this.fold(`?${w.id}:${found.year}`);
  }
  /** A town's archive, begun if it has none. */
  archiveFor(a: Omit<Archive, "n" | "crafts" | "read" | "faded">): Archive {
    const had = this.byTown.get(a.town);
    if (had && had.faded === null) return had;
    const made: Archive = { ...a, n: this.nextArchive++, crafts: [], read: [], faded: null };
    this.archives.push(made);
    this.live.push(made);
    this.byTown.set(made.town, made);
    this.fold(`a${made.n}:${made.town}`);
    return made;
  }
  keep(a: Archive, id: string): void {
    if (!a.crafts.includes(id)) a.crafts.push(id);
    this.fold(`k${a.n}:${id}`);
    if (!this.live.includes(a) && a.faded === null) this.live.push(a);
  }
  /** Found again from it. */
  read(a: Archive, r: KeptRead): void {
    a.read.push(r);
    this.fold(`r${a.n}:${r.id}:${r.cell}`);
  }
  fade(a: Archive, year: number): void {
    a.faded = year;
    this.live = this.live.filter((x) => x !== a);
    this.fold(`f${a.n}`);
  }
  /** No more to read in it, for now. */
  rest(a: Archive): void {
    this.live = this.live.filter((x) => x !== a);
    this.fold(`z${a.n}`);
  }

  /** Let go what has stood long enough. */
  prune(year: number): void {
    if (this.closed.length) {
      let i = 0;
      while (i < this.closed.length && year - this.closed[i]!.back!.year > LOSS_KEPT) i++;
      if (this.closed.length - i > MOST_CLOSED) i = this.closed.length - MOST_CLOSED;
      if (i) this.closed.splice(0, i);
    }
    if (this.archives.length > MOST_ARCHIVES) {
      const liveNow = new Set(this.live.map((a) => a.n)),
        drop = new Set(
          this.archives
            .filter((a) => !liveNow.has(a.n))
            .slice(0, this.archives.length - MOST_ARCHIVES)
            .map((a) => a.n),
        );
      for (const a of this.archives)
        if (drop.has(a.n) && this.byTown.get(a.town) === a) this.byTown.delete(a.town);
      this.archives = this.archives.filter((a) => !drop.has(a.n));
    }
  }

  private fold(s: string): void {
    this.digest = new Hasher().string(this.digest).string(s).hex();
  }

  pinned(): Ref[] {
    const refs: Ref[] = [];
    for (const m of this.open.values()) for (const l of m.values()) refs.push(l.event);
    for (const w of this.world.values()) refs.push(w.event, w.lastEvent);
    return refs;
  }

  hashInto(h: Hasher): void {
    h.string(this.digest);
  }

  save(): unknown {
    return {
      open: this.allOpen(),
      closed: this.closed,
      world: this.worldLosses(),
      foundAgain: this.foundAgain,
      archives: this.archives,
      live: this.live.map((a) => a.n),
      nextArchive: this.nextArchive,
      digest: this.digest,
    };
  }

  load(state: unknown): void {
    const s = state as {
      open: LostCraft[];
      closed: LostCraft[];
      world: WorldLoss[];
      foundAgain: WorldLoss[];
      archives: Archive[];
      live: number[];
      nextArchive: number;
      digest: string;
    };
    this.open.clear();
    this.world.clear();
    this.byTown.clear();
    for (const l of s.open) {
      let m = this.open.get(l.cell);
      if (!m) this.open.set(l.cell, (m = new Map()));
      m.set(l.id, l);
    }
    this.closed = s.closed;
    for (const w of s.world) this.world.set(w.id, w);
    this.foundAgain = s.foundAgain;
    this.archives = s.archives;
    for (const a of this.archives) this.byTown.set(a.town, a);
    this.live = s.live.map((n) => this.archives.find((a) => a.n === n)!).filter(Boolean);
    this.nextArchive = s.nextArchive;
    this.digest = s.digest;
  }
}

export function lostOf(world: World): LostStore {
  return world.store<LostStore>("lore.lost");
}
