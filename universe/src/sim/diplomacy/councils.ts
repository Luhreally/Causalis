// Bodies of realms that arise from treaties made again and again (round E, order). Every pact two realms swear and every peace
// they make at a war's end binds them a little (a treaty's weight, fading by half in a generation's thirty years). Where three
// realms not yet sitting in one are each bound to the other two by more than a treaty and a half, they sit together in a
// council, called after the seat of the one most bound; a realm bound to half its members or more (two at the least) joins it;
// a member that goes to war on another, or whose bonds to the rest fade below half a treaty, leaves; and a council of fewer than
// three ends. Those who sit in one council think the better of each other (a term of their regard, sim/diplomacy). No table of
// bodies: who sits where is what their treaties made. A few numbers a pair of realms that made a treaty, at most sixteen councils.
// Among the stars the same (the breadth round, 2026-11-23; galactic bodies were a word only): a people of another world binds itself
// to a realm or another people as they trade and teach (sim/space/peoples.ts exchanges) and make peace after a war among the stars
// (sim/space/starwar.ts), and three so bound sit in one body, a concord of worlds; a raid or a star war among its members parts them,
// and those who sit together raid each other no more (sim/space/peoples.ts).
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
import { civilizationsNear } from "../space/contact.ts";
import { farLifeOf } from "../space/farlife-store.ts";
import { peopleWords, peoplesOf } from "../space/peoples.ts";
import { starWarsOf } from "../space/starwar.ts";

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
  /**
   * Among the stars, where word is years on the way and treaties few: what a year of two peoples (or a people and a realm) speaking
   * well of each other binds them by, at a regard of 1 (est.: a tenth of a treaty; at a trader's regard it comes to a treaty and a
   * half in some thirty years, if it holds).
   */
  spoken: 0.1,
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
  /** Saved packed by column (kernel/pack.ts). */
  readonly packed = true;
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
  bond(a: Ref, b: Ref, year: number, pact: Ref | null = null, by = 1): void {
    const key = pairKey(a, b),
      x = this.bonds.get(key);
    if (!x) {
      this.bonds.set(key, { w: by, last: year, pact });
      return;
    }
    x.w = x.w * dmath.pow(0.5, (year - x.last) / COUNCILS.fade) + by;
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
  /** Whom each realm is bound to at all, as the bonds stand now (made at the asking). */
  partners(): Map<Ref, Set<Ref>> {
    const out = new Map<Ref, Set<Ref>>(),
      add = (a: Ref, b: Ref) => {
        const set = out.get(a);
        if (set) set.add(b);
        else out.set(a, new Set([b]));
      };
    for (const k of this.bonds.keys()) {
      const [a, b] = k.split("|") as [Ref, Ref];
      add(a, b);
      add(b, a);
    }
    return out;
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
  return world.peek<CouncilStore>("diplomacy.councils") ?? null;
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
    // (A people of the stars sits as long as it stands: neither fallen nor gone from the peoples followed.)
    peoples = new Map(civilizationsNear(world, year).map((c) => [c.ref as string, c])),
    standing = (r: Ref) => peoples.has(r) && farLifeOf(world)?.get(r)?.fell == null,
    alive = (r: Ref) => (r.startsWith("civ:") ? standing(r) : realms.get(r)?.ended === null);
  // 1. The treaties of the year: each pact newly sworn, each peace made at a war's end.
  for (const rel of diplomacyOf(world).all())
    if (rel.pact && rel.pact !== store.pactSeen(rel.a, rel.b))
      store.bond(rel.a, rel.b, year, rel.pact);
  for (const w of warsOf(world).hot())
    if (w.ended === year && alive(w.attacker) && alive(w.defender))
      store.bond(w.attacker, w.defender, year);
  // (Among the stars: goods traded and lessons taught between peoples of two worlds, and a peace made after a star war.)
  const among = peoplesOf(world),
    starWars = world.hasStore("space.starwars") ? starWarsOf(world).all() : [];
  if (among) {
    for (const x of among.exchanges)
      if (x.year === year && x.civ !== x.other && alive(x.civ) && alive(x.other))
        store.bond(x.civ, x.other, year);
    // (And each year two who can speak across the dark, and think well of each other, are bound a little: COUNCILS.spoken.)
    for (const m of among.meetings)
      if (m.talking && m.regard > 0 && m.with !== "land" && alive(m.civ) && alive(m.other))
        store.bond(m.civ, m.other, year, null, COUNCILS.spoken * Math.min(1, m.regard));
  }
  for (const w of starWars) {
    const ended = w.ended ? world.events.get(w.ended) : undefined;
    if (ended && yearOfMoment(ended.t) === year && alive(w.realm) && alive(w.enemy))
      store.bond(w.realm, w.enemy, year);
  }
  /** Whether one of a council fights another of it among the stars this year: a raid between peoples, a star war under way. */
  const starFight = (m: Ref, members: readonly Ref[]) =>
    (among?.raids.some((r) => r.year === year && r.civ === m && members.includes(r.other)) ??
      false) ||
    starWars.some(
      (w) =>
        w.ended === null &&
        ((w.realm === m && members.includes(w.enemy)) ||
          (w.enemy === m && members.includes(w.realm))),
    );
  // (A pair faded to nothing, or of a realm gone, is let go.)
  for (const [a, b] of store.pairs())
    if (!alive(a) || !alive(b) || store.bondOf(a, b, year) < 0.05) store.drop(a, b);
  const bondOf = (a: Ref, b: Ref) => store.bondOf(a, b, year),
    tell = (c: Council, kind: "founded" | "joined" | "left" | "ended", who: Member | null) =>
      world.events.emit({
        type: COUNCIL_EVENTS.council.type,
        // (An event names four at the most: who came or went, and the first of those who sit.)
        subjects: who
          ? [who.ref, ...c.members.filter((m) => m !== who.ref)].slice(0, 4)
          : c.members.slice(0, 4),
        place: who && who.seat !== null ? (ctx.provinces.get(who.seat)?.ref ?? null) : null,
        causes: [{ ref: c.event, role: "enabler", weight: 1 }],
        data: {
          council: c.name,
          kind,
          realm: who ? who.name : null,
          ...(c.members.some((m) => m.startsWith("civ:")) ? { among: true } : {}),
        },
      }),
    memberOf = (r: Ref): Member | null => {
      const civ = peoples.get(r);
      if (civ) return { ref: r, name: peopleWords(world, civ).name, seat: null, town: null };
      const p = realms.get(r);
      return p ? { ref: r, name: realmNameOf(p), seat: p.seat, town: p.town } : null;
    };
  // 2. Members leave: one gone, one at war on another member, one whose bonds to the rest have faded.
  for (const c of store.sitting()) {
    for (const m of [...c.members]) {
      const p = memberOf(m);
      const warring =
          warsOf(world)
            .hotOf(m)
            .some((w) => w.ended === null && w.attacker === m && c.members.includes(w.defender)) ||
          starFight(m, c.members),
        bound = c.members.reduce((s, o) => s + (o === m ? 0 : bondOf(m, o)), 0);
      if (!p || !alive(m) || warring || bound < COUNCILS.drift) {
        c.members = c.members.filter((x) => x !== m);
        if (p && alive(m)) tell(c, "left", p);
      }
    }
    if (c.members.length < 3) {
      c.ended = year;
      tell(c, "ended", null);
    }
  }
  // 3. Realms join: bound to half its members or more, two at the least.
  // (Asked only of those a realm is bound to at all, which nothing here changes: every realm in no council was asked its bond
  // to every member of every council, a pair's key spelt and looked for each time, and nearly none of them is bound to any.)
  const free: Member[] = [
      ...realms.living().map((p) => memberOf(p.ref)!),
      ...[...peoples.keys()].filter((r) => alive(r as Ref)).map((r) => memberOf(r as Ref)!),
    ].filter((p) => !store.councilOf(p.ref)),
    partners = store.partners();
  for (const c of store.sitting())
    for (const p of free) {
      const mine = partners.get(p.ref);
      if (!mine || store.councilOf(p.ref)) continue;
      const to = c.members.filter((m) => mine.has(m) && bondOf(p.ref, m) >= 1).length;
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
    const ps = three.map((r) => memberOf(r)).filter((x): x is Member => x !== null);
    if (ps.length < 3) continue;
    const most = [...ps].sort(
        (x, y) =>
          three!.reduce((s, o) => s + bondOf(y.ref, o), 0) -
            three!.reduce((s, o) => s + bondOf(x.ref, o), 0) || (x.ref < y.ref ? -1 : 1),
      )[0]!,
      // (A body of more than one world is a concord, called after the one most bound: a realm by its seat, a people by its name.)
      worlds = three.some((r) => r.startsWith("civ:")),
      name = worlds ? `the concord of ${most.town ?? most.name}` : `the council of ${most.town}`,
      event = world.events.emit({
        type: COUNCIL_EVENTS.council.type,
        subjects: [...three].sort(order),
        place: most.seat !== null ? (ctx.provinces.get(most.seat)?.ref ?? null) : null,
        causes: [
          ...three.flatMap((r) => {
            const rel = diplomacyOf(world).get(r, r === three![0] ? three![1]! : three![0]!);
            return rel?.pact ? [{ ref: rel.pact, role: "enabler" as const, weight: 0.5 }] : [];
          }),
        ],
        data: {
          council: name,
          kind: "founded",
          realm: most.name,
          ...(worlds ? { among: true } : {}),
        },
      });
    store.found(name, year, event, [...three].sort(order));
  }
}

const realmNameOf = (p: Polity) => realmName(p);
/** One who may sit: a realm (its seat and town) or a people of the stars (neither). */
type Member = {
  readonly ref: Ref;
  readonly name: string;
  readonly seat: number | null;
  readonly town: string | null;
};
