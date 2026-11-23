// What the world keeps of its faiths' heads (sim/belief/heads.ts; the rules are rules/faithheads.ts), and what the older systems read
// of it. One record a faith held by a people: how it finds its head, who heads it now (a notable: sim/notable), since when and
// how many it has had, the family of its line, and its standing with each realm that presses it. Bounded by the faiths held and
// the realms that hold them; a faith no one keeps is let go. This file reaches only the kernel, so any system can read it.
import { Hasher, type Ref, type StateStore, type World } from "../../kernel/index.ts";

/** How a realm stands with a faith's head: contested, the seat names its priests, its ruler cast out. */
export const CLASH_STATES = ["concord", "contested", "invested", "cast"] as const;
/** What a ruler presses: who names its priests, what its faithful give, whose word its faithful keep. */
export const CLASH_WHAT = ["offices", "tithes", "word"] as const;

export type Clash = {
  readonly realm: Ref;
  /** By CLASH_STATES: 0 a concord kept, 1 … 3 a quarrel. */
  state: number;
  /** The year it came to this, the event that told it, what is pressed (CLASH_WHAT). */
  since: number;
  event: Ref;
  readonly what: number;
  /** The year the ruler it is with came to the seat (a new ruler is another). */
  readonly ruler: number;
  /** Of the realm's people, the share who keep the faith (thousandths), as last weighed. */
  share: number;
  /** The year the contest opened. */
  readonly opened: number;
};

export type FaithHead = {
  readonly faith: Ref;
  /** How it finds its head (rules FAITH_FORMS), as read at the last succession. */
  form: number;
  /** Its head (a notable's id; 0: none yet), since when, and how many it has had. */
  id: number;
  since: number;
  heads: number;
  /** The family of its line (a line's heads share it; "" otherwise). */
  family: string;
  /** The event the head was told by (null: a small faith's head is not told). */
  event: Ref | null;
  clashes: Clash[];
  /** How many lands held it when last walked (sim/belief/heads.ts, every FAITH_HEAD.every years). */
  lands?: number;
};

export const FAITH_HEADS_STORE = "belief.heads";

export class FaithHeadsStore implements StateStore {
  readonly name = FAITH_HEADS_STORE;
  private readonly heads = new Map<Ref, FaithHead>();
  /** Realms cast out by a faith's head, and those whose seat names a faith's priests (read off the records, never saved). */
  private castIndex: Map<Ref, Clash> | null = null;
  private investIndex: Set<Ref> | null = null;
  private digest = "";

  dormant(): boolean {
    return this.heads.size === 0 && this.digest === "";
  }
  get(faith: Ref): FaithHead | undefined {
    return this.heads.get(faith);
  }
  set(h: FaithHead): void {
    this.heads.set(h.faith, h);
    this.moved();
  }
  drop(faith: Ref): void {
    if (this.heads.delete(faith)) this.moved();
  }
  /** In the order of their faiths' refs: the same after a save as before it. */
  all(): FaithHead[] {
    return [...this.heads.values()].sort((a, b) =>
      a.faith < b.faith ? -1 : a.faith > b.faith ? 1 : 0,
    );
  }
  /** A clash changed: read who is cast out and who names priests again. */
  moved(): void {
    this.castIndex = null;
    this.investIndex = null;
  }
  private index(): void {
    const cast = new Map<Ref, Clash>(),
      invest = new Set<Ref>();
    for (const h of this.all())
      for (const c of h.clashes) {
        if (c.state === 3) {
          const was = cast.get(c.realm);
          if (!was || c.share > was.share) cast.set(c.realm, c);
        } else if (c.state === 2) invest.add(c.realm);
      }
    this.castIndex = cast;
    this.investIndex = invest;
  }
  castOf(realm: Ref): Clash | undefined {
    if (!this.castIndex) this.index();
    return this.castIndex!.get(realm);
  }
  invests(realm: Ref): boolean {
    if (!this.investIndex) this.index();
    return this.investIndex!.has(realm);
  }
  /** The year's state folded in: a checkpoint hashes this. */
  fold(year: number): void {
    const h = new Hasher().string(this.digest).int(year).int(this.heads.size);
    for (const x of this.all()) {
      h.int(x.id).int(x.heads).int(x.form).int(x.clashes.length);
      for (const c of x.clashes) h.int(c.state).int(c.since).int(c.share);
    }
    this.digest = h.hex();
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const h of this.heads.values()) {
      if (h.event) out.push(h.event);
      for (const c of h.clashes) out.push(c.event);
    }
    return out;
  }
  hashInto(h: Hasher): void {
    h.int(this.heads.size).string(this.digest);
  }
  save(): unknown {
    return {
      heads: this.all(),
      digest: this.digest,
    };
  }
  load(state: unknown): void {
    const s = state as { heads?: FaithHead[]; digest?: string } | null;
    this.heads.clear();
    for (const h of s?.heads ?? [])
      this.heads.set(h.faith, { ...h, clashes: h.clashes.map((c) => ({ ...c })) });
    this.digest = s?.digest ?? "";
    this.moved();
  }
  /** What a probe or a page counts. */
  summary(): Record<string, number> {
    const out: Record<string, number> = { heads: 0, faiths: this.heads.size };
    for (const h of this.heads.values()) {
      if (h.id) out.heads!++;
      for (const c of h.clashes) {
        const k = CLASH_STATES[c.state] ?? "?";
        out[k] = (out[k] ?? 0) + 1;
      }
    }
    return out;
  }
}

export function faithHeadsOf(world: World): FaithHeadsStore | null {
  return world.peek<FaithHeadsStore>(FAITH_HEADS_STORE) ?? null;
}

/** Whether a realm's seat names the priests of a faith held in it, having taken it from the faith's head (sim/order/institutions.ts). */
export function investedIn(world: World, realm: Ref): boolean {
  return faithHeadsOf(world)?.invests(realm) ?? false;
}

/** The faith whose head cast out a realm's ruler, where one did. */
export function castOutOf(world: World, realm: Ref): Clash | undefined {
  return faithHeadsOf(world)?.castOf(realm);
}
