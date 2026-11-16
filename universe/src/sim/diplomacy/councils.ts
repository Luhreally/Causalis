// Bodies of realms that arise from treaties made again and again (round E, order). Every pact two realms swear and every peace
// they make at a war's end binds them a little (a treaty's weight, fading by half in a generation's thirty years). Where three
// realms not yet sitting in one are each bound to the other two by more than a treaty and a half, they sit together in a
// council, called after the seat of the one most bound; a realm bound to half its members or more (two at the least) joins it;
// a member that goes to war on another, or whose bonds to the rest fade below half a treaty, leaves; and a council of fewer than
// three ends. Those who sit in one council think the better of each other (a term of their regard, sim/diplomacy). No table of
// bodies: who sits where is what their treaties made. A few numbers a pair of realms that made a treaty, at most sixteen councils.
import {
  defineEventType,
  dmath,
  yearOfMoment,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { warsOf } from "../war/war.ts";
import { diplomacyOf } from "./diplomacy.ts";

export const COUNCIL_EVENTS = {
  /** A council of realms founded, joined, left or ended. */
  council: defineEventType("ties.council", 5),
};

export const COUNCILS = {
  /** A treaty's weight fades by half in this many years. */
  fade: 30,
  /** Bound by more than this, two realms may sit together; below `drift` to the rest, a member leaves. */
  bound: 1.5,
  drift: 0.5,
  /** At most this many councils a world. */
  most: 16,
  /** How much better two who sit in one council think of each other (a term of their regard). */
  regard: 0.15,
} as const;

type Bond = { w: number; last: number; pact: Ref | null };
export type Council = {
  readonly id: number;
  readonly name: string;
  readonly founded: number;
  readonly event: Ref;
  members: Ref[];
  ended: number | null;
};

const pairKey = (a: Ref, b: Ref) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const order = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export class CouncilStore implements StateStore {
  readonly name = "diplomacy.councils";
  private readonly bonds = new Map<string, Bond>();
  private readonly list: Council[] = [];
  private next = 1;
  dormant(): boolean {
    return this.bonds.size === 0 && this.list.length === 0;
  }
  /** How bound two realms are by their treaties, as of a year (a treaty's worth each, faded). */
  bondOf(a: Ref, b: Ref, year: number): number {
    const x = this.bonds.get(pairKey(a, b));
    return x ? x.w * dmath.pow(0.5, (year - x.last) / COUNCILS.fade) : 0;
  }
  bond(a: Ref, b: Ref, year: number, pact: Ref | null = null): void {
    const key = pairKey(a, b),
      x = this.bonds.get(key);
    if (!x) {
      this.bonds.set(key, { w: 1, last: year, pact });
      return;
    }
    x.w = x.w * dmath.pow(0.5, (year - x.last) / COUNCILS.fade) + 1;
    x.last = year;
    if (pact) x.pact = pact;
  }
  pactSeen(a: Ref, b: Ref): Ref | null {
    return this.bonds.get(pairKey(a, b))?.pact ?? null;
  }
  /** The pairs bound at all, each once: [a, b]. */
  pairs(): [Ref, Ref][] {
    return [...this.bonds.keys()].sort(order).map((k) => k.split("|") as [Ref, Ref]);
  }
  /** Let go a pair whose bond has faded to nothing, or one of whose realms has ended. */
  drop(a: Ref, b: Ref): void {
    this.bonds.delete(pairKey(a, b));
  }
  councils(): readonly Council[] {
    return this.list;
  }
  sitting(): Council[] {
    return this.list.filter((c) => c.ended === null);
  }
  /** The council a realm sits in (null: none). */
  councilOf(realm: Ref): Council | null {
    return this.list.find((c) => c.ended === null && c.members.includes(realm)) ?? null;
  }
  found(name: string, founded: number, event: Ref, members: Ref[]): Council {
    const c: Council = { id: this.next++, name, founded, event, members, ended: null };
    this.list.push(c);
    // (Of those that ended, only the newest few are kept: a world's councils stay a few.)
    const ended = this.list.filter((x) => x.ended !== null);
    if (this.list.length > 2 * COUNCILS.most && ended.length)
      this.list.splice(this.list.indexOf(ended[0]!), 1);
    return c;
  }
  pinned(): Ref[] {
    return this.list.map((c) => c.event);
  }
  hashInto(h: Hasher): void {
    h.int(this.next);
    for (const k of [...this.bonds.keys()].sort(order)) {
      const x = this.bonds.get(k)!;
      h.string(k)
        .float(x.w)
        .int(x.last)
        .string(x.pact ?? "");
    }
    h.value(this.list);
  }
  save(): unknown {
    return {
      next: this.next,
      bonds: [...this.bonds].sort(([a], [b]) => (a < b ? -1 : 1)),
      list: this.list,
    };
  }
  load(state: unknown): void {
    const s = state as { next: number; bonds: [string, Bond][]; list: Council[] } | null;
    this.bonds.clear();
    this.list.length = 0;
    if (!s) return;
    this.next = s.next;
    for (const [k, b] of s.bonds) this.bonds.set(k, b);
    this.list.push(...s.list);
  }
}

export function councilsOf(world: World): CouncilStore | null {
  return world.hasStore("diplomacy.councils")
    ? world.store<CouncilStore>("diplomacy.councils")
    : null;
}

/** Whether two realms sit in one council, and which (null: they do not). */
export function sitTogether(world: World, a: Ref, b: Ref): Council | null {
  const c = councilsOf(world)?.councilOf(a);
  return c && c.members.includes(b) ? c : null;
}

/** The year's treaties counted, and the councils they make: founded, joined, left and ended. */
export function councilsYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = councilsOf(world);
  if (!store) return;
  const year = yearOfMoment(t),
    realms = politiesOf(world),
    alive = (r: Ref) => realms.get(r)?.ended === null;
  // 1. The treaties of the year: each pact newly sworn, each peace made at a war's end.
  for (const rel of diplomacyOf(world).all())
    if (rel.pact && rel.pact !== store.pactSeen(rel.a, rel.b))
      store.bond(rel.a, rel.b, year, rel.pact);
  for (const w of warsOf(world).hot())
    if (w.ended === year && alive(w.attacker) && alive(w.defender))
      store.bond(w.attacker, w.defender, year);
  // (A pair faded to nothing, or of a realm gone, is let go.)
  for (const [a, b] of store.pairs())
    if (!alive(a) || !alive(b) || store.bondOf(a, b, year) < 0.05) store.drop(a, b);
  const bondOf = (a: Ref, b: Ref) => store.bondOf(a, b, year),
    tell = (c: Council, kind: "founded" | "joined" | "left" | "ended", who: Polity | null) =>
      world.events.emit({
        type: COUNCIL_EVENTS.council.type,
        // (An event names four at the most: who came or went, and the first of those who sit.)
        subjects: who
          ? [who.ref, ...c.members.filter((m) => m !== who.ref)].slice(0, 4)
          : c.members.slice(0, 4),
        place: who ? (ctx.provinces.get(who.seat)?.ref ?? null) : null,
        causes: [{ ref: c.event, role: "enabler", weight: 1 }],
        data: { council: c.name, kind, realm: who ? realmNameOf(who) : null },
      });
  // 2. Members leave: one gone, one at war on another member, one whose bonds to the rest have faded.
  for (const c of store.sitting()) {
    for (const m of [...c.members]) {
      const p = realms.get(m);
      const warring = warsOf(world)
          .hotOf(m)
          .some((w) => w.ended === null && w.attacker === m && c.members.includes(w.defender)),
        bound = c.members.reduce((s, o) => s + (o === m ? 0 : bondOf(m, o)), 0);
      if (!p || p.ended !== null || warring || bound < COUNCILS.drift) {
        c.members = c.members.filter((x) => x !== m);
        if (p && p.ended === null) tell(c, "left", p);
      }
    }
    if (c.members.length < 3) {
      c.ended = year;
      tell(c, "ended", null);
    }
  }
  // 3. Realms join: bound to half its members or more, two at the least.
  const free = realms.living().filter((p) => !store.councilOf(p.ref));
  for (const c of store.sitting())
    for (const p of free) {
      if (store.councilOf(p.ref)) continue;
      const to = c.members.filter((m) => bondOf(p.ref, m) >= 1).length;
      if (to >= 2 && to * 2 >= c.members.length) {
        c.members.push(p.ref);
        c.members.sort(order);
        tell(c, "joined", p);
      }
    }
  // 4. Founded: three realms in none, each bound to the other two by more than COUNCILS.bound.
  if (store.sitting().length >= COUNCILS.most) return;
  const strong = new Map<Ref, Ref[]>();
  for (const [a, b] of store.pairs()) {
    if (store.councilOf(a) || store.councilOf(b) || bondOf(a, b) <= COUNCILS.bound) continue;
    (strong.get(a) ?? strong.set(a, []).get(a)!).push(b);
    (strong.get(b) ?? strong.set(b, []).get(b)!).push(a);
  }
  for (const a of [...strong.keys()].sort(order)) {
    if (store.councilOf(a) || store.sitting().length >= COUNCILS.most) continue;
    const near = (strong.get(a) ?? []).filter((x) => !store.councilOf(x)).sort(order);
    let three: Ref[] | null = null;
    for (let i = 0; i < near.length && !three; i++)
      for (let j = i + 1; j < near.length && !three; j++)
        if (bondOf(near[i]!, near[j]!) > COUNCILS.bound) three = [a, near[i]!, near[j]!];
    if (!three) continue;
    const ps = three.map((r) => realms.get(r)!),
      most = [...ps].sort(
        (x, y) =>
          three!.reduce((s, o) => s + bondOf(y.ref, o), 0) -
            three!.reduce((s, o) => s + bondOf(x.ref, o), 0) || (x.ref < y.ref ? -1 : 1),
      )[0]!,
      name = `the council of ${most.town}`,
      event = world.events.emit({
        type: COUNCIL_EVENTS.council.type,
        subjects: [...three].sort(order),
        place: ctx.provinces.get(most.seat)?.ref ?? null,
        causes: [
          ...three.flatMap((r) => {
            const rel = diplomacyOf(world).get(r, r === three![0] ? three![1]! : three![0]!);
            return rel?.pact ? [{ ref: rel.pact, role: "enabler" as const, weight: 0.5 }] : [];
          }),
        ],
        data: { council: name, kind: "founded", realm: realmNameOf(most) },
      });
    store.found(name, year, event, [...three].sort(order));
  }
}

const realmNameOf = (p: Polity) => realmName(p);
