// Choices put to a realm's people, where its rule has them (round E, order): a realm whose rule passes by choice and whose
// choices are carried by more than a few (rules/holds.ts voice past HOLDING.voiceMid) holds an election every term, a term as
// long as a third of the years its people take to grow (rules/life.ts adulthood: some five years among upright apes). Its
// groups each put one of their own forward, the greatest of them by sway; every group gives its sway to the candidate whose
// group wants the realm held most as it wants it (sim/order/wants.ts: what each has learned to want), and against the
// governing group as far as the realm fared ill in its term (fewer people, lands lost, a famine, a war lost). The group whose
// candidate is given the most governs until the next, its wants weighed half again in how the realm is held. A decision whose
// factors are each group's sway and where it went, and the event. A few numbers a realm, a few past elections kept.
import { notableSpeaks } from "../notable/kept.ts";
import {
  defineEventType,
  dmath,
  parseRef,
  yearOfMoment,
  type Factor,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { HOLDING } from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { interestsOf, type Group } from "../polity/interests.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { holdsOf } from "./holds.ts";
import { wantsOf } from "./wants.ts";
import { orgPartyOf, orgsOf } from "./groups-kept.ts";
import { notablesOf } from "../notable/kept.ts";
import { ORG } from "../../rules/index.ts";

export const ELECTION_EVENTS = {
  /** A realm's people chose who governs it. */
  elected: defineEventType("order.elected", 4),
};

/** How many groups put one of their own forward, at the most; and how many past elections a realm keeps. */
const RUNNING = 3,
  KEPT = 6;
/** How far a term that went ill turns those who gave the governing group their sway against it (a share of their sway). */
const SWING = 0.5;

/** One election: its year, who governs after it, each candidate's share of what was given, and its event. */
export type Election = {
  readonly year: number;
  readonly group: Group;
  readonly held: boolean;
  readonly votes: readonly (readonly [Group, number])[];
  readonly event: Ref;
  /** Who was chosen, by name, where the group that won put forward one the world keeps (a party's head, one who speaks for
   * it), and the party; and each other group's candidate so kept. Absent where no one was. */
  readonly who?: string;
  readonly party?: string;
  readonly ran?: readonly (readonly [Group, string])[];
};

/** A group's candidate, where the world keeps one by name. */
export type Candidate = {
  readonly name: string;
  readonly born?: number;
  /** Their party (sim/order/groups.ts), its name and its number in its realm. */
  readonly party?: string;
  readonly gid?: number;
};

/**
 * Whom a group of a realm puts forward: the head of the party that carries it, where it is organised in one (sim/order/groups.ts);
 * else one of name who speaks for it (sim/notable: whoever it last carried to govern); else no one the world keeps by name
 * (one of its own, untold). A pure reading.
 */
export function candidateOf(world: World, realm: Ref, group: Group): Candidate | null {
  let party: {
    name: string;
    leader: { name: string; born: number };
    id: number;
    members: number;
  } | null = null;
  for (const g of orgsOf(world)?.of(realm)?.orgs ?? [])
    if (g.identity === group && g.organised && (!party || g.members > party.members)) party = g;
  if (party)
    return { name: party.leader.name, born: party.leader.born, party: party.name, gid: party.id };
  const n = notablesOf(world)?.holder("speaks", realm);
  return n && n.post?.group === group ? { name: n.name, born: n.born } : null;
}

type RealmVotes = {
  /** The year of its next election. */
  next: number;
  /** The group governing since the last (null: none chosen yet). */
  governing: Group | null;
  /** What it was at the last: people, lands (for how its term went). */
  people: number;
  lands: number;
  past: Election[];
};

export class ElectionStore implements StateStore {
  readonly name = "order.elections";
  /** Saved packed by column (kernel/pack.ts). */
  readonly packed = true;
  private readonly realms = new Map<Ref, RealmVotes>();
  dormant(): boolean {
    return this.realms.size === 0;
  }
  of(realm: Ref): Readonly<RealmVotes> | undefined {
    return this.realms.get(realm);
  }
  /** The group governing a realm by its people's choice (null: none). */
  governing(realm: Ref): Group | null {
    return this.realms.get(realm)?.governing ?? null;
  }
  ensure(realm: Ref, make: () => RealmVotes): RealmVotes {
    let v = this.realms.get(realm);
    if (!v) this.realms.set(realm, (v = make()));
    return v;
  }
  forget(realm: Ref): void {
    this.realms.delete(realm);
  }
  realmsKept(): Ref[] {
    return [...this.realms.keys()];
  }
  pinned(): Ref[] {
    return [...this.realms.values()].flatMap((v) => v.past.map((e) => e.event));
  }
  hashInto(h: Hasher): void {
    const realms = [...this.realms.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    h.int(realms.length);
    for (const r of realms) {
      const v = this.realms.get(r)!;
      h.string(r)
        .int(v.next)
        .string(v.governing ?? "")
        .int(v.people)
        .int(v.lands)
        .value(v.past);
    }
  }
  save(): unknown {
    return [...this.realms].sort(([a], [b]) => (a < b ? -1 : 1));
  }
  load(state: unknown): void {
    this.realms.clear();
    for (const [r, v] of (state as [Ref, RealmVotes][]) ?? []) this.realms.set(r, v);
  }
}

export function electionsOf(world: World): ElectionStore | null {
  return world.peek<ElectionStore>("order.elections") ?? null;
}

/** Whether a realm's rule has elections: rule passed by choice, its choices carried by more than a few. */
export function chooses(world: World, p: Polity): boolean {
  return p.succession === 1 && (holdsOf(world, p.ref)[1] ?? 0) >= HOLDING.voiceMid;
}

/** A realm's term, in years: a third of the years its people take to grow, at least two. */
export function termOf(ctx: PopulationContext): number {
  return Math.max(2, Math.round(ctx.life.adulthood / 3));
}

/** How near two groups' wants are (1: the same; 0: as far apart as can be), over the four numbers. */
function nearness(a: readonly number[], b: readonly number[]): number {
  let d = 0;
  for (let k = 0; k < 4; k++) d += (a[k]! - b[k]!) * (a[k]! - b[k]!);
  return 1 - dmath.sqrt(d / 4);
}

/** The year's elections: each realm whose rule has them, in the year of its next. */
export function electionsYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = electionsOf(world);
  if (!store) return;
  const year = yearOfMoment(t),
    living = politiesOf(world).living(),
    term = termOf(ctx),
    wants = wantsOf(world);
  if (year % 10 === 0) {
    const alive = new Set(living.map((p) => p.ref));
    for (const r of store.realmsKept()) if (!alive.has(r)) store.forget(r);
  }
  for (const p of living) {
    if (!chooses(world, p)) {
      if (store.of(p.ref)) store.forget(p.ref);
      continue;
    }
    const people = p.members.reduce((s, c) => s + (ctx.provinces.get(c)?.total() ?? 0), 0),
      v = store.ensure(p.ref, () => ({
        // (Its first in a year of its own within a term, so that realms do not all choose at once.)
        next: year + 1 + (parseRef(p.ref).b % term),
        governing: null,
        people,
        lands: p.members.length,
        past: [],
      }));
    if (year < v.next) continue;
    const interests = interestsOf(ctx, p, t).filter((i) => i.sway > 0),
      want = (g: string) => wants?.wantOf(p.ref, g) ?? holdsOf(world, p.ref),
      // (An interest organised in a party, sim/order/groups.ts, puts one of its own forward whatever its sway; nothing changes
      // where none is.)
      party = (g: Group) => orgPartyOf(world, p.ref, g),
      greatest = [...interests]
        .sort((a, b) => b.sway - a.sway || (a.group < b.group ? -1 : 1))
        .slice(0, RUNNING)
        .map((i) => i.group),
      running = [
        ...greatest,
        ...interests
          .filter((i) => !greatest.includes(i.group) && party(i.group) > 0)
          .map((i) => i.group),
      ];
    if (running.length < 2) {
      v.next = year + term;
      continue;
    }
    // (How the term went: its people and lands against the last election's, a famine in its lands, a war it lost.)
    const fell = (a: number, b: number) => (b > 0 ? Math.max(0, 1 - a / b) : 0),
      ill = Math.min(
        1,
        4 * fell(people, v.people) +
          2 * fell(p.members.length, v.lands) +
          (p.members.some((c) => {
            const f = ctx.provinces.get(c)?.lastFamine;
            const e = f ? world.events.get(f) : undefined;
            return !!e && yearOfMoment(e.t) > year - term;
          })
            ? 0.3
            : 0),
      ),
      given = new Map<Group, number>(running.map((g) => [g, 0])),
      gave = new Map<Group, Group>();
    for (const i of interests) {
      // (Each group's sway to the one whose wants are nearest its own; against the governing group as its term went ill.)
      let best: Group | null = null,
        bestBy = -Infinity;
      for (const g of running) {
        const own = g === i.group ? party(g) : 0,
          by =
            nearness(want(i.group), want(g)) -
            (g === v.governing ? SWING * ill : 0) +
            (g === i.group ? 0.05 : 0) +
            // (A party holds its own interest's votes to its candidate.)
            (own > 0 ? ORG.discipline * own : 0);
        if (by > bestBy) {
          bestBy = by;
          best = g;
        }
      }
      if (!best) continue;
      // (And brings out its own the more: those it organises go to vote.)
      const out = best === i.group ? party(best) : 0,
        // (And one of name who speaks for a group brings out a few more of its own: sim/notable. Exactly as before where no one
        // does. Only its own: given as a pull on every group's choice, the group last chosen was chosen again each term, and
        // on tide 207 twice the elections were held from the eighth century on.)
        spoken = best === i.group ? notableSpeaks(world, p.ref, best) : 0;
      given.set(
        best,
        given.get(best)! + (out > 0 ? i.sway * (1 + ORG.turnout * out) : i.sway) * (1 + spoken),
      );
      gave.set(i.group, best);
    }
    // (Who each group put forward, where the world keeps them by name: read before the choice, told with it.)
    const ran = running
      .map((g) => [g, candidateOf(world, p.ref, g)] as const)
      .filter((x): x is readonly [Group, Candidate] => x[1] !== null);
    const all = [...given.values()].reduce((s, x) => s + x, 0),
      ranked = [...given]
        .map(([g, x]) => [g, all > 0 ? Math.round((x / all) * 1000) / 1000 : 0] as const)
        .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)),
      [winner, top] = ranked[0]!,
      held = winner === v.governing,
      factors: Factor[] = interests.map((i) => ({
        name: `${i.group} gave their sway to ${gave.get(i.group) === i.group ? "their own" : `the ${gave.get(i.group)}' candidate`}`,
        value: i.sway,
        contribution: gave.get(i.group) === winner ? i.sway : -i.sway,
        source: null,
      }));
    if (v.governing && ill > 0)
      factors.push({
        name: "how its term went: fewer people, lands lost or a famine",
        value: ill,
        contribution: -SWING * ill,
        source: null,
      });
    const decision = world.decisions.record({
        rule: "order.elected",
        subject: p.ref,
        outcome: { group: winner, held },
        score: top,
        threshold: 0,
        factors,
      }),
      chosen = ran.find(([g]) => g === winner)?.[1] ?? null,
      // (The candidate of the group given the most after the winner's.)
      rival =
        ranked
          .slice(1)
          .map(([g]) => ran.find(([x]) => x === g))
          .find((x) => !!x) ?? null,
      event = world.events.emit({
        type: ELECTION_EVENTS.elected.type,
        // (A vote that changed who governs is told as the chronicle tells; one that kept them is let go with the ordinary
        // years, unless something cites it: kept whole, a world's elections were 8,000 of the events kept at 3,100.)
        importance: held ? 3 : ELECTION_EVENTS.elected.importance,
        subjects: [p.ref],
        place: ctx.provinces.get(p.seat)?.ref ?? null,
        causes: [{ ref: decision, role: "trigger", weight: 1 }],
        data: {
          realm: realmName(p),
          group: winner,
          share: top,
          held,
          was: v.governing,
          // (Who was chosen, and against whom, where they are kept by name. `by` is whom the deed is: sim/notable reads it.)
          ...(chosen
            ? {
                by: chosen.name,
                ...(chosen.born !== undefined ? { born: chosen.born } : {}),
                ...(chosen.party ? { party: chosen.party, gids: [chosen.gid] } : {}),
              }
            : {}),
          ...(rival ? { rival: rival[1].name, rivalGroup: rival[0] } : {}),
        },
      });
    v.past.push({
      year,
      group: winner,
      held,
      votes: ranked,
      event,
      ...(chosen ? { who: chosen.name } : {}),
      ...(chosen?.party ? { party: chosen.party } : {}),
      // (Who else ran is told by the event, with the rival's name: kept on every record it was 60 KB of a save.)
      ...(rival ? { ran: [[rival[0], rival[1].name] as const] } : {}),
    });
    if (v.past.length > KEPT) v.past.splice(0, v.past.length - KEPT);
    v.governing = winner;
    v.people = people;
    v.lands = p.members.length;
    v.next = year + term;
  }
}

/** How much more the governing group's wants weigh in how its realm is held (1: as any group's). */
export const GOVERNS_BY = 1.5;
