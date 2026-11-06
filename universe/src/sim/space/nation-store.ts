// Realms among the stars, as history holds them (Phase 72, first slice): for each world of another star a people has come to, who
// holds it, since when and how; and for each realm that has held any, how many it holds, the most it ever held, what it has lost.
// A few dozen realms and one small row a world, read once a year. It imports nothing of the space rules, and it holds nothing and
// is no part of the world's hash until a world of another star has someone on it, so a history before that holds bit for bit.
import {
  defineKind,
  makeRef,
  type Hasher,
  type Ref,
  type StateStore,
  type World,
} from "../../kernel/index.ts";

/** A world's own people as a side in a war, and a far realm: named by the world it is ruled from. */
export const NATION = defineKind("snat", "a realm among the stars", "minted");
export const worldNation = (index: number): Ref => makeRef(NATION, 0, index);

export type Holding = {
  readonly key: string;
  readonly star: Ref;
  readonly planet: number;
  /** The land it began as (null: no land holds it). */
  readonly cell: number | null;
  /** Its place among the rows: the same for ever. */
  readonly index: number;
  /** Who holds it (null: its own people). */
  holder: Ref | null;
  how: "sent" | "taken" | "joined" | "own";
  since: number;
  /** The event of its coming to this (null: it came so, from its founding). */
  event: Ref | null;
  /** The last realm it went from, when, and the event. */
  left?: { readonly from: Ref; readonly year: number; readonly event: Ref };
  /** Cut off from what it never learned to make: since when, those it held then, and whether its ground has too little metal to make it at all. */
  dark?: {
    readonly since: number;
    readonly before: number;
    readonly event: Ref;
    readonly poor: boolean;
  };
  /** What its people took with them when they went their own way: the drive they knew, and whether they knew the lanes. */
  own?: { readonly drive: string | null; readonly lanes: boolean };
};

export type StarNation = {
  readonly ref: Ref;
  /** Its realm of the home world (null: a realm of worlds alone). */
  readonly realm: Ref | null;
  readonly name: string;
  /** The world it is ruled from (null: its realm's own land). */
  readonly seat: string | null;
  readonly founded: number;
  readonly event: Ref | null;
  worlds: number;
  greatest: number;
  greatestYear: number;
  /** The last year a fleet of it was lost. */
  lostFleet: number | null;
  /** The worlds it lost: each row's index, the year, the world's people then, and the year it had come to the realm. */
  lost: [number, number, number, number][];
  /** The event of its fall, and its year. */
  fell: { readonly year: number; readonly event: Ref } | null;
};

/** How many worlds' losses a realm's record keeps (a save's bound). */
const LOSSES_KEPT = 64;

export class NationStore implements StateStore {
  readonly name = "space.nations";
  private readonly rows = new Map<string, Holding>();
  private readonly cells = new Map<number, Holding>();
  private readonly nations = new Map<string, StarNation>();
  /** The world's firsts. */
  first: { greatest: Ref | null; left: Ref | null; fell: Ref | null; dark: Ref | null } = {
    greatest: null,
    left: null,
    fell: null,
    dark: null,
  };

  dormant(): boolean {
    return !this.rows.size;
  }
  get(key: string): Holding | undefined {
    return this.rows.get(key);
  }
  all(): Holding[] {
    return [...this.rows.values()];
  }
  add(h: Holding): void {
    this.rows.set(h.key, h);
    if (h.cell !== null) this.cells.set(h.cell, h);
  }
  /** The row of a land that is a world of another star. */
  ofCell(cell: number): Holding | undefined {
    return this.cells.get(cell);
  }
  nation(ref: string): StarNation | undefined {
    return this.nations.get(ref);
  }
  allNations(): StarNation[] {
    return [...this.nations.values()];
  }
  addNation(n: StarNation): void {
    this.nations.set(n.ref, n);
  }
  /** Let the longest fallen go, past a most kept. */
  trimFallen(most: number): void {
    if (this.nations.size <= most) return;
    const gone = this.allNations()
      .filter((n) => !n.worlds)
      .sort(
        (a, b) =>
          (a.fell?.year ?? a.greatestYear) - (b.fell?.year ?? b.greatestYear) ||
          (a.ref < b.ref ? -1 : 1),
      );
    for (const n of gone.slice(0, this.nations.size - most)) this.nations.delete(n.ref);
  }
  /** A world's going, on its realm's record. */
  noteLost(n: StarNation, index: number, year: number, people: number, since: number): void {
    n.lost.push([index, year, Math.round(people), since]);
    if (n.lost.length > LOSSES_KEPT) n.lost.shift();
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const h of this.rows.values()) {
      if (h.event) out.push(h.event);
      if (h.left) out.push(h.left.event);
      if (h.dark) out.push(h.dark.event);
    }
    for (const n of this.nations.values()) {
      if (n.event) out.push(n.event);
      if (n.fell) out.push(n.fell.event);
    }
    for (const r of [this.first.greatest, this.first.left, this.first.fell, this.first.dark])
      if (r) out.push(r);
    return out;
  }
  hashInto(h: Hasher): void {
    h.value(this.save());
  }
  save(): unknown {
    return { rows: this.all(), nations: this.allNations(), first: this.first };
  }
  load(state: unknown): void {
    const s = state as { rows: Holding[]; nations: StarNation[]; first: NationStore["first"] };
    this.rows.clear();
    this.cells.clear();
    this.nations.clear();
    for (const h of s.rows) this.add({ ...h });
    for (const n of s.nations)
      this.nations.set(n.ref, {
        ...n,
        lost: n.lost.map((l) => [...l] as [number, number, number, number]),
      });
    this.first = { ...s.first };
  }
}

/** The store of realms among the stars (none on a world with no space rules). */
export function nationsOf(world: World): NationStore | null {
  return world.hasStore("space.nations") ? world.store<NationStore>("space.nations") : null;
}

/** Whether a land of another star is ruled by the rule of the stars: who holds it is read there, not by its grievance. */
export function heldAmongStars(world: World, cell: number): boolean {
  return !!nationsOf(world)?.ofCell(cell)?.holder;
}
