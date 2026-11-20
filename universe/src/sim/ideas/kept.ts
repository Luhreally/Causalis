// What the world keeps of its schools of thought (sim/ideas/ideas.ts; the rules are rules/ideas.ts), and what the older systems
// read of them. A school is a short record; a land holds at most one, as it holds one faith: which, since when, and the land it
// came by. Nothing here grows with history but the schools themselves, and of those no land holds any more only IDEA.keepGone
// are remembered. This file reaches only the kernel and the rules, so every system can read it without a circle.
import {
  defineKind,
  makeRef,
  type Hasher,
  type Ref,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { IDEA, IDEA_PARTS, creedHeld, ideaStands, ideaSways } from "../../rules/index.ts";

/** A school's own reference: an event's subject, a page's address. */
export const SCHOOL = defineKind("idea", "school of thought", "structural");
export const schoolRef = (id: number): Ref => makeRef(SCHOOL, 0, id);
export const schoolId = (ref: string): number => Number(ref.slice(ref.lastIndexOf(":") + 1));

export type School = {
  readonly id: number;
  /** Its name, in its founders' tongue's word for their place. */
  readonly name: string;
  readonly founded: number;
  readonly event: Ref;
  readonly seat: number;
  /** The school it broke from, where it did. */
  readonly from: number | null;
  /** Its leanings, in hundredths: on force, voice, word and trust, then on the laws of land, strangers, faith and justice. */
  readonly creed: readonly number[];
  /**
   * Where it teaches each of the four numbers should stand (hundredths): what its founder's group wanted of the realm when it
   * was founded. Absent in a save from before it was kept (2026-11-19): read then as its leanings from the middle (`schoolStands`).
   */
  readonly stands?: readonly number[];
  /** Who founded it (a notable's id, their name as it was), and the group of their realm whose wants it speaks. */
  readonly founder: number;
  readonly by: string;
  readonly speaks: string;
  /** The realm it was founded under. */
  readonly realm: Ref | null;
  /** Whether its founder was one of faith (a teaching of the temple) rather than of knowledge. */
  readonly holy: boolean;
};

/** What a land is taught: the school, since when, and the land it came by (its own cell where it began there). */
export type Taught = { readonly school: number; readonly since: number; readonly via: number };

export const SCHOOLS_STORE = "ideas.schools";

type Saved = {
  next: number;
  schools: School[];
  held: [number, number, number, number][];
  splits: [number, number][];
  /** Those who founded a school the world has since forgotten (`forget`): absent in a save from before, and where there are none. */
  gone?: number[];
};

export class SchoolsStore implements StateStore {
  readonly name = SCHOOLS_STORE;
  /** Saved packed by column (kernel/pack.ts). */
  readonly packed = true;
  private next = 1;
  private list: School[] = [];
  private readonly byId = new Map<number, School>();
  private readonly held = new Map<number, Taught>();
  private readonly splits = new Map<number, number>();
  /** (Read off what is held, never saved: how many lands hold each.) */
  private readonly lands = new Map<number, number>();
  /**
   * Who has founded a school, those whose school the world has since forgotten among them: one of name founds once. (Those of
   * the schools kept are read off them; the rest are kept by `goneFounders`, saved and hashed: read off the schools alone on
   * loading, one whose school was forgotten could found again in a world loaded and not in the one that ran on. First light
   * saved at 1,500 and loaded was another world by 1,525.)
   */
  private readonly founders = new Set<number>();

  dormant(): boolean {
    return this.list.length === 0;
  }
  mint(): number {
    return this.next++;
  }
  add(s: School): void {
    this.list.push(s);
    this.byId.set(s.id, s);
    this.founders.add(s.founder);
  }
  all(): readonly School[] {
    return this.list;
  }
  get(id: number): School | undefined {
    return this.byId.get(id);
  }
  /** Whether one of name has founded a school already. */
  founded(notable: number): boolean {
    return this.founders.has(notable);
  }
  of(cell: number): Taught | undefined {
    return this.held.get(cell);
  }
  /** How many lands hold anything. */
  get holding(): number {
    return this.held.size;
  }
  landsOf(id: number): number {
    return this.lands.get(id) ?? 0;
  }
  /** The lands that hold a school, in order. */
  landList(id: number): number[] {
    const out: number[] = [];
    for (const [c, h] of this.held) if (h.school === id) out.push(c);
    return out.sort((a, b) => a - b);
  }
  set(cell: number, h: Taught | null): void {
    const was = this.held.get(cell);
    if (was) this.lands.set(was.school, (this.lands.get(was.school) ?? 1) - 1);
    if (h) {
      this.held.set(cell, h);
      this.lands.set(h.school, (this.lands.get(h.school) ?? 0) + 1);
    } else this.held.delete(cell);
  }
  lastSplit(id: number): number {
    return this.splits.get(id) ?? this.byId.get(id)?.founded ?? 0;
  }
  markSplit(id: number, year: number): void {
    this.splits.set(id, year);
  }
  /** Schools no land holds are remembered a while: the oldest of more than IDEA.keepGone forgotten (never one others broke from and still hold). */
  forget(): void {
    const gone = this.list.filter((s) => !this.landsOf(s.id));
    if (gone.length <= IDEA.keepGone) return;
    const parents = new Set<number>();
    for (const s of this.list) if (s.from !== null && this.landsOf(s.id)) parents.add(s.from);
    const drop = new Set(
      gone
        .filter((s) => !parents.has(s.id))
        .slice(0, gone.length - IDEA.keepGone)
        .map((s) => s.id),
    );
    if (!drop.size) return;
    this.list = this.list.filter((s) => !drop.has(s.id));
    for (const id of drop) {
      this.byId.delete(id);
      this.splits.delete(id);
      this.lands.delete(id);
    }
  }
  pinned(): Ref[] {
    return this.list.map((s) => s.event);
  }
  /** The founders of schools forgotten, in order: what of `founders` the schools kept do not tell. */
  private goneFounders(): number[] {
    const kept = new Set<number>();
    for (const s of this.list) kept.add(s.founder);
    const out: number[] = [];
    for (const f of this.founders) if (!kept.has(f)) out.push(f);
    return out.sort((a, b) => a - b);
  }
  private heldRows(): [number, number, number, number][] {
    return [...this.held]
      .map(([c, h]): [number, number, number, number] => [c, h.school, h.since, h.via])
      .sort((a, b) => a[0] - b[0]);
  }
  hashInto(h: Hasher): void {
    h.int(this.next).int(this.list.length);
    for (const s of this.list) {
      h.int(s.id).int(s.founded).int(s.seat).int(s.founder).string(s.name);
      for (let k = 0; k < IDEA_PARTS; k++) h.int(s.creed[k] ?? 0);
      if (s.stands) for (const v of s.stands) h.int(v);
    }
    const rows = this.heldRows();
    h.int(rows.length);
    for (const r of rows) h.int(r[0]).int(r[1]).int(r[2]).int(r[3]);
    for (const [id, y] of [...this.splits].sort((a, b) => a[0] - b[0])) h.int(id).int(y);
    // (Only where any is: a world that has forgotten no school hashes as it did.)
    const gone = this.goneFounders();
    if (gone.length) {
      h.int(-gone.length);
      for (const f of gone) h.int(f);
    }
  }
  save(): unknown {
    const s: Saved = {
      next: this.next,
      schools: this.list,
      held: this.heldRows(),
      splits: [...this.splits].sort((a, b) => a[0] - b[0]),
    };
    const gone = this.goneFounders();
    if (gone.length) s.gone = gone;
    return s;
  }
  load(state: unknown): void {
    const s = state as Partial<Saved> | null;
    this.next = s?.next ?? 1;
    this.list = [];
    this.byId.clear();
    this.founders.clear();
    this.held.clear();
    this.lands.clear();
    this.splits.clear();
    for (const x of s?.schools ?? []) this.add(x);
    for (const [c, school, since, via] of s?.held ?? []) this.set(c, { school, since, via });
    for (const [id, y] of s?.splits ?? []) this.splits.set(id, y);
    for (const f of s?.gone ?? []) this.founders.add(f);
  }
}

export function schoolsOf(world: World): SchoolsStore | null {
  return world.peek<SchoolsStore>(SCHOOLS_STORE) ?? null;
}

/** The school a land holds, where it holds one. Only reads. */
export function schoolIn(world: World, cell: number): School | undefined {
  const store = schoolsOf(world),
    h = store?.of(cell);
  return h ? store!.get(h.school) : undefined;
}

/** Where a school teaches each of the four numbers should stand (hundredths). */
export function schoolStands(s: School): readonly number[] {
  return s.stands ?? ideaStands(s.creed);
}

/** What a school draws a realm toward: which, how far it holds there (0 … 1), and its leanings (hundredths). */
export type SchoolPull = { readonly school: School; readonly hold: number };

/**
 * The school most of a realm's lands hold (its seat's counted twice), and how far it holds there: its share of the realm's lands
 * by how long each has held it (half of it in a generation of `span` years' lives). Null where no land of it holds one: every
 * reader is then exactly as it was. Only reads.
 */
export function schoolOver(
  world: World,
  members: readonly number[],
  seat: number,
  year: number,
  span: number,
): SchoolPull | null {
  const store = schoolsOf(world);
  if (!store || !store.holding) return null;
  let best = -1,
    bestW = 0,
    total = 0;
  const sums = new Map<number, number>();
  for (const c of members) {
    const w = c === seat ? 2 : 1;
    total += w;
    const h = store.of(c);
    if (!h) continue;
    const v = (sums.get(h.school) ?? 0) + w * creedHeld(year - h.since, span);
    sums.set(h.school, v);
    if (v > bestW || (v === bestW && h.school < best)) {
      best = h.school;
      bestW = v;
    }
  }
  const school = best >= 0 ? store.get(best) : undefined;
  return school && total > 0 ? { school, hold: Math.min(1, bestW / total) } : null;
}

/**
 * What a school adds to what a realm's groups want of one of its four numbers, where `wanted` is what they want of it by
 * their sway (0 … 1): the school's voice among theirs, for where it teaches the number should stand (rules/ideas.ts
 * ideaSways). And its pull on a law's support toward the new order (a law has three places to stand: the pull ends where the
 * law has come to the end it leans to).
 */
export function pullOnHold(p: SchoolPull | null, k: number, wanted: number): number {
  return p ? ideaSways(schoolStands(p.school)[k] ?? 50, wanted, p.hold) : 0;
}
export function pullOnLaw(p: SchoolPull | null, law: number): number {
  return p ? ((p.school.creed[4 + law] ?? 0) / 100) * IDEA.lawPull * p.hold : 0;
}
