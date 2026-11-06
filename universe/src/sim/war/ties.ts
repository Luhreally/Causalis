// What binds realms when it is called on (D1). A realm attacked calls those bound to it: who it is sworn to, who is sworn to it, those of its league, those of
// its pacts, those it has married into. Each comes or doesn't, for reasons kept with the answer. One who comes opens its own war on the foe, told as coming
// for its friend; a war a call began calls no one, so no chain is longer than one, and no more than a few come to any war. One who won't is remembered for it.
// A league gathers against a realm grown to be feared, seldom, and holds as long as the fear does. A marriage gives a real claim: when a house dies out,
// someone of the marriage comes forward, and the realm takes them, or passes to their house, or war comes of it, or it passes them by. A people with no houses
// makes its bonds as it is: a hive gives of its brood, a people of the water graft reef to reef, those who choose their rulers foster each other's young. An
// envoy carries each of these, and an embassy kept makes what each knows of the other's host the truer. Keeps little: open leagues, embassies, the calls of
// the last century and the envoys of the last few years. A war's link to its call is kept on its declaration's own event, as its aim is.
import {
  Hasher,
  dmath,
  defineEventType,
  defineStream,
  yearOfMoment,
  type Factor,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { cellRef, offworldSite, tonguePersonName } from "../../gen/index.ts";
import {
  COULD_NOT,
  TIES,
  callOdds,
  claimEnd,
  isFeared,
  type CallWhy,
  type ClaimEnd,
  type TieBond,
  type TieForm,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { homePlanet } from "../planet/store.ts";
import { endRealm, politiesOf, realmName, type Polity, type Ruler } from "../polity/polity.ts";
import { DIPLOMACY_EVENTS, diplomacyOf, type Relation } from "../diplomacy/diplomacy.ts";
import { courtOf } from "../court/court.ts";
import { orderOf, realmOrder, type StateMatch } from "../order/order.ts";
import { beliefOf } from "../belief/belief.ts";
import { WAR, WAR_EVENTS, WEARY_YEARS, frontier, strengthOf, warsOf, type War } from "./war.ts";
import { bondsOf } from "./bonds.ts";

export const TIE_EVENTS = {
  /** One called came or did not. */
  answered: defineEventType("ties.answered", 4),
  /** A league gathered, and ended. */
  league: defineEventType("ties.league", 6),
  leagueEnded: defineEventType("ties.league.ended", 5),
  /** A marriage, or what a people has for one. */
  match: defineEventType("ties.match", 3),
  /** Someone of a marriage came forward, and what came of it. */
  claim: defineEventType("ties.claim", 5),
  /** An envoy set out; an embassy opened or was recalled. */
  envoy: defineEventType("ties.envoy", 2),
  embassy: defineEventType("ties.embassy", 3),
};

/** One called, and how it answered. */
export type Call = {
  readonly war: Ref;
  readonly called: Ref;
  readonly friend: Ref;
  readonly foe: Ref;
  readonly bond: TieBond;
  readonly came: boolean;
  readonly why: CallWhy;
  readonly year: number;
  readonly event: Ref;
  /** The war it opened, where it came. */
  readonly opened?: Ref;
};

/** Those gathered against a realm. */
export type League = {
  readonly event: Ref;
  readonly against: Ref;
  /** Who gathered them, whose town it is named for. */
  readonly town: string;
  members: Ref[];
  readonly since: number;
  /** The realm's share of the world's strength when they gathered. */
  readonly share: number;
  until: number | null;
  ended: Ref | null;
  why: string | null;
};

/** What an envoy carries. */
export type Errand = "call" | "league" | "match" | "embassy" | "claim" | "pact" | "gift";

/** One sent from one seat to another. */
export type Envoy = {
  readonly event: Ref;
  readonly from: Ref;
  readonly to: Ref;
  readonly errand: Errand;
  readonly year: number;
  readonly name: string;
  readonly sex: number;
  /** What it was for: the event behind it. */
  readonly cause: Ref | null;
  readonly answer: "yes" | "no";
};

export type Embassy = {
  readonly a: Ref;
  readonly b: Ref;
  readonly since: number;
  readonly event: Ref;
};

const STREAM = defineStream("war.ties");
const refKey = (r: Ref) => Number(r.split(":")[2]) >>> 0;
const pairOf = (a: Ref, b: Ref) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export class TieStore implements StateStore {
  readonly name = "war.ties";
  private calls: Call[] = [];
  private leagueList: League[] = [];
  private embassyList: Embassy[] = [];
  private envoyList: Envoy[] = [];
  /** The wars of this year and last whose calls have gone out. */
  private asked: [Ref, number][] = [];
  /** What is folded in once, as it happens: the hash does not grow with what is kept. */
  private digest = "";
  /** The embassies by their two realms (a cache). */
  private readonly pairs = new Map<string, Embassy>();

  note(c: Call): void {
    this.calls.push(c);
    this.digest = new Hasher().string(this.digest).value(c).hex();
  }
  allCalls(): readonly Call[] {
    return this.calls;
  }
  callsOf(realm: Ref): Call[] {
    return this.calls.filter((c) => c.called === realm || c.friend === realm);
  }
  callsIn(war: Ref): Call[] {
    return this.calls.filter((c) => c.war === war);
  }
  leagues(): readonly League[] {
    return this.leagueList;
  }
  open(): League[] {
    return this.leagueList.filter((l) => l.until === null);
  }
  leagueBy(event: string): League | undefined {
    return this.leagueList.find((l) => l.event === event);
  }
  addLeague(l: League): void {
    this.leagueList.push(l);
  }
  /** The league a realm stands in, open now. */
  leagueOf(realm: Ref): League | undefined {
    return this.leagueList.find((l) => l.until === null && l.members.includes(realm));
  }
  /** Whether two stand in one league. */
  sameLeague(a: Ref, b: Ref): boolean {
    return this.leagueList.some(
      (l) => l.until === null && l.members.includes(a) && l.members.includes(b),
    );
  }
  /** The league a realm's war on another would meet. */
  leagueAgainst(realm: Ref, on: Ref): League | undefined {
    return this.leagueList.find(
      (l) => l.until === null && l.against === realm && l.members.includes(on),
    );
  }
  embassies(): readonly Embassy[] {
    return this.embassyList;
  }
  embassyOf(a: Ref, b: Ref): Embassy | undefined {
    if (!this.embassyList.length) return undefined;
    if (this.pairs.size !== this.embassyList.length) {
      this.pairs.clear();
      for (const e of this.embassyList) this.pairs.set(pairOf(e.a, e.b), e);
    }
    return this.pairs.get(pairOf(a, b));
  }
  embassiesOf(a: Ref): Embassy[] {
    return this.embassyList.filter((e) => e.a === a || e.b === a);
  }
  addEmbassy(e: Embassy): void {
    this.embassyList.push(e);
  }
  dropEmbassy(e: Embassy): void {
    this.embassyList = this.embassyList.filter((x) => x !== e);
    this.pairs.clear();
  }
  envoys(): readonly Envoy[] {
    return this.envoyList;
  }
  addEnvoy(e: Envoy): void {
    this.envoyList.push(e);
    this.digest = new Hasher().string(this.digest).string(e.event).hex();
  }
  wasAsked(war: Ref): boolean {
    return this.asked.some((a) => a[0] === war);
  }
  ask(war: Ref, year: number): void {
    this.asked.push([war, year]);
  }
  /** Let go of what is past keeping. */
  trim(year: number): void {
    this.asked = this.asked.filter((a) => a[1] >= year - 2);
    if (this.calls.length && this.calls[0]!.year < year - TIES.callYears)
      this.calls = this.calls.filter((c) => c.year >= year - TIES.callYears);
    if (this.envoyList.length && this.envoyList[0]!.year < year - TIES.envoyYears)
      this.envoyList = this.envoyList.filter((e) => e.year >= year - TIES.envoyYears);
  }
  pinned(): Ref[] {
    const refs: Ref[] = [];
    for (const c of this.calls) refs.push(c.event);
    for (const l of this.leagueList) {
      refs.push(l.event);
      if (l.ended) refs.push(l.ended);
    }
    for (const e of this.embassyList) refs.push(e.event);
    for (const e of this.envoyList) refs.push(e.event);
    return refs;
  }
  hashInto(h: Hasher): void {
    if (this.digest) h.string(this.digest);
    if (this.leagueList.length) h.value(this.leagueList);
    if (this.embassyList.length) h.value(this.embassyList);
  }
  save(): unknown {
    return {
      calls: this.calls,
      leagues: this.leagueList,
      embassies: this.embassyList,
      envoys: this.envoyList,
      asked: this.asked,
      digest: this.digest,
    };
  }
  load(state: unknown): void {
    const s = state as {
      calls?: Call[];
      leagues?: League[];
      embassies?: Embassy[];
      envoys?: Envoy[];
      asked?: [Ref, number][];
      digest?: string;
    };
    this.calls = s.calls ?? [];
    this.leagueList = (s.leagues ?? []).map((l) => ({ ...l, members: [...l.members] }));
    this.embassyList = s.embassies ?? [];
    this.pairs.clear();
    this.envoyList = s.envoys ?? [];
    this.asked = s.asked ?? [];
    this.digest = s.digest ?? "";
  }
}

export function tiesOf(world: World): TieStore {
  return world.store<TieStore>("war.ties");
}

/** Teach a peopled world what binds realms. */
export function installTies(world: World): TieStore {
  const store = world.register(new TieStore());
  world.addPinner(() => store.pinned());
  return store;
}

/** How far a realm's reading of another's strength is off, this decade: a factor (1: true). Keyed, so it does not change while it is read. */
export function misreadOf(world: World, seer: Ref, seen: Ref, year: number): number {
  const kept = tiesOf(world).embassyOf(seer, seen),
    spread = kept ? TIES.misreadKept : TIES.misread,
    u = world.rng.real(STREAM, refKey(seer), Math.floor(year / 10), 40 + refKey(seen));
  return dmath.exp(spread * (2 * u - 1));
}

/** What a people has for a marriage, read off what they are. */
export function tieFormOf(world: World, p: Polity): TieForm {
  const body = homePlanet(world).generated.life.people?.body;
  if ((body?.social ?? 0) >= 0.9 && (body?.size ?? 100) < 100 && body?.medium !== "water")
    return "brood";
  if (body?.medium === "water") return "graft";
  const kin = cultureOf(world).get(p.seat)?.traits[WAY.kinship] ?? 0.5;
  return p.succession === 0 && kin >= 0.15 ? "wed" : "foster";
}

/** The form two realms' bond takes: the less of a house either keeps. */
export function tieFormBetween(world: World, a: Polity, b: Polity): TieForm {
  const fa = tieFormOf(world, a),
    fb = tieFormOf(world, b);
  return fa === fb ? fa : fa === "wed" ? fb : fa;
}

/** Those of a marriage still of an age to come forward, from a realm's own record. */
export function livingMatches(world: World, realm: Ref, year: number): StateMatch[] {
  const realms = politiesOf(world);
  return (orderOf(world)?.of(realm)?.matches ?? []).filter((m) => {
    const q = realms.get(m.with);
    return q && q.ended === null && year - m.year <= TIES.claimYears;
  });
}

/** Those bound to a realm, and by what: the order they are called in. */
export function boundTo(
  world: World,
  d: Polity,
  year: number,
  pacts?: ReadonlyMap<string, Ref[]>,
): { realm: Ref; bond: TieBond; source: Ref | null }[] {
  const bonds = bondsOf(world),
    out: { realm: Ref; bond: TieBond; source: Ref | null }[] = [],
    has = new Set<string>([d.ref]),
    add = (realm: Ref, bond: TieBond, source: Ref | null) => {
      if (has.has(realm)) return;
      has.add(realm);
      out.push({ realm, bond, source });
    },
    oath = bonds.oathOf(d.ref);
  if (oath) add(oath.to, "overlord", oath.event);
  for (const b of bonds.vassalsOf(d.ref)) add(b.from, "vassal", b.event);
  const league = tiesOf(world).leagueOf(d.ref);
  if (league) for (const m of league.members) add(m, "league", league.event);
  if (pacts) for (const q of pacts.get(d.ref) ?? []) add(q, "pact", null);
  else
    for (const r of diplomacyOf(world).of(d.ref))
      if (r.pact) add(r.a === d.ref ? r.b : r.a, "pact", r.pact);
  for (const m of livingMatches(world, d.ref, year)) add(m.with, "kin", m.event);
  return out;
}

/** Where a host called to a friend's side can fight: on its own border with the foe, else, marching through its friend's lands, on theirs. */
export function allyFront(
  ctx: PopulationContext,
  ally: Polity,
  friend: Polity,
  foe: Polity,
): number[] {
  const own = frontier(ctx, ally, foe);
  if (own.length) return own;
  return diplomacyOf(ctx.world).get(ally.ref, friend.ref) ? frontier(ctx, friend, foe) : [];
}

/** An envoy sets out, named in their own people's tongue, and is told. */
export function sendEnvoy(
  ctx: PopulationContext,
  from: Polity,
  to: Polity,
  errand: Errand,
  cause: Ref | null,
  answer: "yes" | "no",
  t: SimTime,
): Envoy {
  const { world } = ctx,
    ways = cultureOf(world).get(from.seat),
    key = refKey(from.ref),
    purpose = 200 + (world.events.count % 1000),
    sex = world.rng.real(STREAM, key, t, purpose) < 0.5 ? 0 : 1,
    number = Math.floor(world.rng.real(STREAM, key, t, purpose + 1) * 1e6),
    name = ways ? tonguePersonName(ways.tongue, number, sex) : from.ruler.name.split(" ")[0]!,
    event = world.events.emit({
      type: TIE_EVENTS.envoy.type,
      subjects: [from.ref, to.ref],
      place: ctx.provinces.get(from.seat)?.ref ?? null,
      causes: cause ? [{ ref: cause, role: "trigger", weight: 1 }] : [],
      data: {
        a: realmName(from),
        b: realmName(to),
        who: name,
        sex,
        errand,
        answer,
        fromTown: from.town,
        toTown: to.town,
      },
    }),
    envoy: Envoy = {
      event,
      from: from.ref,
      to: to.ref,
      errand,
      year: yearOfMoment(t),
      name,
      sex,
      cause,
      answer,
    };
  tiesOf(world).addEnvoy(envoy);
  return envoy;
}

/** One who came opens its own war on the foe. Told as coming for its friend. */
function comeToWar(
  ctx: PopulationContext,
  w: War,
  ally: Polity,
  friend: Polity,
  foe: Polity,
  bond: TieBond,
  front: readonly number[],
  answered: Ref,
  t: SimTime,
): Ref {
  const { world } = ctx,
    ref = world.minter.mint(WAR),
    year = yearOfMoment(t),
    event = world.events.emit({
      type: WAR_EVENTS.declared.type,
      subjects: [ref, ally.ref, foe.ref],
      place: cellRef(0, front[0]!),
      causes: [{ ref: answered, role: "trigger", weight: 1 }],
      data: {
        a: realmName(ally),
        b: realmName(foe),
        aim: "ally",
        friend: realmName(friend),
        friendRef: friend.ref,
        call: w.ref,
        bond,
      },
    });
  warsOf(world).add({
    ref,
    attacker: ally.ref,
    defender: foe.ref,
    declared: year,
    event,
    prize: front[0]!,
    battles: [],
    fallen: [0, 0],
    ended: null,
    peace: null,
  });
  return ref;
}

/** Whether a realm's pact with one it now wars on is over: broken by the war, remembered. */
export function warBreaksPact(
  ctx: PopulationContext,
  r: Relation,
  attacker: Polity,
  defender: Polity,
  event: Ref,
  year: number,
): void {
  if (!r.pact) return;
  const { world } = ctx,
    diplomacy = diplomacyOf(world),
    broken = world.events.emit({
      type: DIPLOMACY_EVENTS.broken.type,
      subjects: [r.a, r.b],
      place: ctx.provinces.get(attacker.seat)?.ref ?? null,
      causes: [
        { ref: r.pact, role: "enabler", weight: 0.4 },
        { ref: event, role: "trigger", weight: 0.6 },
      ],
      data: {
        a: realmName(attacker),
        b: realmName(defender),
        reason: `the war ${realmName(attacker)} made on them`,
      },
    });
  diplomacy.remember(r.a, r.b, { name: "a broken pact", value: -0.4, year, source: broken });
  r.pact = null;
}

/** How one of those called answers: reads the world, draws, and does what comes of it. */
function answerOne(
  ctx: PopulationContext,
  w: War,
  friend: Polity,
  foe: Polity,
  called: Polity,
  bond: TieBond,
  t: SimTime,
  rested: (p: Polity) => number,
): boolean {
  const { world, generated: g } = ctx,
    year = yearOfMoment(t),
    wars = warsOf(world),
    bonds = bondsOf(world),
    store = tiesOf(world),
    diplomacy = diplomacyOf(world);
  // Already at it, with the foe; or at war with the friend itself: there's no call to answer.
  if (wars.between(called.ref, foe.ref) || wars.between(called.ref, friend.ref)) return false;
  const regard = diplomacy.get(called.ref, friend.ref);
  // (No border or road between them: no one could carry the call.)
  if (!regard) return false;
  const foeRegard = diplomacy.get(called.ref, foe.ref),
    front = allyFront(ctx, called, friend, foe),
    between = bonds.between(called.ref, foe.ref),
    oath = bonds.oathOf(called.ref);
  let could: CallWhy | null = null;
  if (between) could = "truce";
  else if (oath && oath.to !== friend.ref) could = "sworn";
  else if (foeRegard?.pact) could = "both";
  else if (offworldSite(g, called.seat) || !front.length) could = "noway";
  const foeRatio = strengthOf(ctx, foe) / Math.max(1, strengthOf(ctx, called)),
    odds = callOdds({
      bond,
      foeRatio,
      regard: regard.opinion,
      foeRegard: foeRegard?.opinion ?? 0,
      wars: wars.fighting(called.ref).length,
      rested: rested(called),
      valour: cultureOf(world).get(called.seat)?.traits[WAY.valour] ?? 0.5,
    }),
    draw = world.rng.real(STREAM, refKey(called.ref), t, 10 + (refKey(w.ref) % 1000)),
    came = could === null && draw < odds.chance,
    why: CallWhy = could ?? (came ? "bound" : odds.against),
    factors: Factor[] = [
      {
        name: "what they are sworn to",
        value: 1,
        contribution: TIES.comes[bond],
        source: null,
      },
      { name: "the foe's strength", value: foeRatio, contribution: -foeRatio / 10, source: null },
      {
        name: "what they think of the one calling",
        value: regard.opinion,
        contribution: regard.opinion,
        source: null,
      },
    ],
    decision = world.decisions.record({
      rule: "ties.call",
      subject: called.ref,
      outcome: { to: friend.ref, against: foe.ref, came, why },
      score: odds.chance,
      threshold: draw,
      factors,
    }),
    event = world.events.emit({
      type: TIE_EVENTS.answered.type,
      subjects: [called.ref, friend.ref, foe.ref],
      place: ctx.provinces.get(called.seat)?.ref ?? null,
      causes: [
        { ref: w.event, role: "trigger", weight: 1 },
        { ref: decision, role: "enabler", weight: 0.6 },
      ],
      data: {
        a: realmName(called),
        b: realmName(friend),
        foe: realmName(foe),
        bond,
        came,
        why,
        war: w.ref,
      },
    }),
    opened = came ? comeToWar(ctx, w, called, friend, foe, bond, front, event, t) : undefined;
  store.note({
    war: w.ref,
    called: called.ref,
    friend: friend.ref,
    foe: foe.ref,
    bond,
    came,
    why,
    year,
    event,
    ...(opened ? { opened } : {}),
  });
  sendEnvoy(ctx, friend, called, "call", event, came ? "yes" : "no", t);
  // What it costs: for one who came, the war itself, and the thanks; for one who would not, what the other remembers, and their standing.
  if (came)
    diplomacy.remember(called.ref, friend.ref, {
      name: "they came when called",
      value: TIES.cameAt,
      year,
      source: event,
    });
  else if (!COULD_NOT.has(why)) {
    diplomacy.remember(called.ref, friend.ref, {
      name: "they stood aside when called",
      value: TIES.refusedAt,
      year,
      source: event,
    });
    const o = orderOf(world)?.of(called.ref);
    if (o) o.legitimacy = Math.max(0.02, o.legitimacy - TIES.shame);
    // A pact that doesn't answer is over. An overlord who doesn't come is owed no oath.
    if (bond === "pact" && regard.pact) {
      const broken = world.events.emit({
        type: DIPLOMACY_EVENTS.broken.type,
        subjects: [regard.a, regard.b],
        place: ctx.provinces.get(called.seat)?.ref ?? null,
        causes: [
          { ref: regard.pact, role: "enabler", weight: 0.4 },
          { ref: event, role: "trigger", weight: 0.6 },
        ],
        data: {
          a: realmName(called),
          b: realmName(friend),
          reason: "a call they would not answer",
        },
      });
      diplomacy.remember(called.ref, friend.ref, {
        name: "a broken pact",
        value: -0.4,
        year,
        source: broken,
      });
      regard.pact = null;
    }
    if (bond === "overlord") {
      const held = bonds.oathOf(friend.ref);
      if (held && held.to === called.ref) bonds.remove(held);
    }
  }
  return came;
}

/** The calls of this year's wars. A war a call began calls no one. */
export function answerCalls(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    wars = warsOf(world),
    store = tiesOf(world),
    realms = politiesOf(world),
    year = yearOfMoment(t),
    hot = wars.hot(),
    fresh: War[] = [];
  for (let i = hot.length - 1; i >= 0; i--) {
    const w = hot[i]!;
    if (w.declared < year - 1) {
      // (They are in the order declared: all before are older.)
      break;
    }
    if (w.ended === null && !w.civil && !store.wasAsked(w.ref)) fresh.push(w);
  }
  if (!fresh.length) return;
  fresh.reverse();
  // Each pact a realm is in, read once.
  const pacts = new Map<string, Ref[]>();
  for (const r of diplomacyOf(world).all())
    if (r.pact) {
      (pacts.get(r.a) ?? pacts.set(r.a, []).get(r.a)!).push(r.b);
      (pacts.get(r.b) ?? pacts.set(r.b, []).get(r.b)!).push(r.a);
    }
  const lastPeace = new Map<string, number>(),
    rested = (p: Polity) => {
      let last = lastPeace.get(p.ref);
      if (last === undefined) {
        last = -Infinity;
        for (const x of wars.hotOf(p.ref)) if (x.ended !== null && x.ended > last) last = x.ended;
        lastPeace.set(p.ref, last);
      }
      return last === -Infinity ? 1 : Math.min(1, (year - last) / WEARY_YEARS);
    };
  for (const w of fresh) {
    store.ask(w.ref, year);
    const said = world.events.get(w.event)?.data as { aim?: string } | null | undefined;
    if (said?.aim === "ally") continue;
    const a = realms.get(w.attacker),
      d = realms.get(w.defender);
    if (!a || !d || a.ended !== null || d.ended !== null) continue;
    // Those bound to the one attacked; and where it's the league's own who marches on what it fears, the rest of the league with it.
    const marching = store.leagueAgainst(d.ref, a.ref),
      lists: [Polity, Polity, { realm: Ref; bond: TieBond }[]][] = [
        [d, a, boundTo(world, d, year, pacts)],
        ...(marching
          ? [
              [a, d, marching.members.map((m) => ({ realm: m, bond: "league" as TieBond }))] as [
                Polity,
                Polity,
                { realm: Ref; bond: TieBond }[],
              ],
            ]
          : []),
      ];
    let come = 0;
    for (const [friend, foe, bound] of lists)
      for (const b of bound) {
        if (come >= TIES.callMost) break;
        const called = realms.get(b.realm);
        if (!called || called.ended !== null || called === foe || called === friend) continue;
        if (answerOne(ctx, w, friend, foe, called, b.bond, t, rested)) come++;
      }
  }
}

/** Who stands near a realm, and how many of them fear it. */
function fearers(
  ctx: PopulationContext,
  h: Polity,
  strength: (p: Polity) => number,
  by: ReadonlyMap<string, Relation[]>,
): Polity[] {
  const { world } = ctx,
    realms = politiesOf(world),
    store = tiesOf(world),
    bonds = bondsOf(world),
    mine = strength(h),
    out: Polity[] = [];
  for (const r of by.get(h.ref) ?? []) {
    if (r.pact) continue;
    const q = realms.get(r.a === h.ref ? r.b : r.a);
    if (!q || q.ended !== null || bonds.between(q.ref, h.ref) || bonds.oathOf(q.ref)) continue;
    if (store.leagueOf(q.ref)) continue;
    const theirs = strength(q);
    if (theirs > 0 && mine / theirs >= TIES.fearRatio && r.opinion < TIES.matchAt) out.push(q);
  }
  out.sort((x, y) => strength(y) - strength(x) || (x.ref < y.ref ? -1 : 1));
  return out;
}

/** A realm's battles won in the years read. */
function wonLately(world: World, h: Polity, year: number): number {
  let n = 0;
  for (const w of warsOf(world).hotOf(h.ref)) {
    if (w.ended !== null && w.ended < year - TIES.fearYears) continue;
    const own = w.attacker === h.ref;
    for (const b of w.battles) if (b.year >= year - TIES.fearYears && b.won === own) n++;
  }
  return n;
}

/** Every five years: those whose fear has gone let go, and those who fear one realm enough may gather against it. */
function fearYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    year = yearOfMoment(t),
    store = tiesOf(world),
    realms = politiesOf(world),
    living = realms.living();
  if (year % 5 !== 0) return;
  const open = store.open();
  if (living.length < TIES.leagueRealms && !open.length) return;
  // What a realm can field, without its arms, is read of every realm; its arms only of those it matters for.
  const memo = new Map<string, number>(),
    strength = (p: Polity) => {
      let s = memo.get(p.ref);
      if (s === undefined) memo.set(p.ref, (s = strengthOf(ctx, p)));
      return s;
    },
    people = (p: Polity) => {
      let n = 0;
      for (const c of p.members) n += ctx.provinces.get(c)?.total() ?? 0;
      return n;
    };
  const sized = living
      .map((p) => ({ p, n: people(p) }))
      .sort((x, y) => y.n - x.n || (x.p.ref < y.p.ref ? -1 : 1)),
    all = sized.reduce((s, x) => s + x.n, 0),
    shareOf = (p: Polity) => people(p) / Math.max(1, all);
  // Those whose fear has gone.
  for (const l of open) {
    const h = realms.get(l.against);
    l.members = l.members.filter((m) => {
      const q = realms.get(m);
      return q && q.ended === null && !bondsOf(world).oathOf(m);
    });
    const faded = !h || h.ended !== null || shareOf(h) < l.share * TIES.leagueFade,
      old = year - l.since >= TIES.leagueYears,
      few = l.members.length < 2;
    if (!faded && !old && !few) continue;
    const why = !h || h.ended !== null ? "fell" : faded ? "faded" : old ? "old" : "few";
    l.until = year;
    l.why = why;
    l.ended = world.events.emit({
      type: TIE_EVENTS.leagueEnded.type,
      subjects: [l.against, ...l.members.slice(0, 3)],
      place: h ? (ctx.provinces.get(h.seat)?.ref ?? null) : null,
      causes: [{ ref: l.event, role: "trigger", weight: 1 }],
      data: {
        town: l.town,
        against: h ? realmName(h) : "a realm",
        years: year - l.since,
        why,
        ...(h ? { form: tieFormOf(world, h) } : {}),
      },
    });
  }
  // One at a time on most worlds, and a while between.
  const most = living.length > 300 ? 2 : 1;
  if (store.open().length >= most || living.length < TIES.leagueRealms) return;
  const last = store.leagues().at(-1);
  if (last && (last.until ?? year) > year - TIES.leagueRest) return;
  const relations = diplomacyOf(world).all(),
    by = new Map<string, Relation[]>();
  for (const r of relations) {
    (by.get(r.a) ?? by.set(r.a, []).get(r.a)!).push(r);
    (by.get(r.b) ?? by.set(r.b, []).get(r.b)!).push(r);
  }
  // Only the very largest are read: no one fears the rest.
  for (const { p: h, n } of sized.slice(0, 3)) {
    const share = n / Math.max(1, all);
    if (!isFeared(share, wonLately(world, h, year))) continue;
    const fear = fearers(ctx, h, strength, by);
    if (fear.length < TIES.leagueLeast) continue;
    if (!(world.rng.real(STREAM, refKey(h.ref), t, 5) < TIES.leagueChance)) continue;
    const members = fear.slice(0, TIES.leagueMost),
      leader = members[0]!,
      decision = world.decisions.record({
        rule: "ties.league",
        subject: h.ref,
        outcome: { members: members.map((m) => m.ref), share },
        score: share,
        threshold: TIES.fearShare,
        factors: [
          {
            name: "its share of the world's people",
            value: share,
            contribution: share,
            source: null,
          },
          {
            name: "those who fear it",
            value: fear.length,
            contribution: fear.length / 10,
            source: null,
          },
        ],
      }),
      event = world.events.emit({
        type: TIE_EVENTS.league.type,
        subjects: [h.ref, ...members.slice(0, 3).map((m) => m.ref)],
        place: ctx.provinces.get(h.seat)?.ref ?? null,
        causes: [{ ref: decision, role: "trigger", weight: 1 }],
        data: {
          town: leader.town,
          against: realmName(h),
          members: members.map((m) => realmName(m)),
          share,
          form: tieFormOf(world, h),
        },
      });
    store.addLeague({
      event,
      against: h.ref,
      town: leader.town,
      members: members.map((m) => m.ref),
      since: year,
      share,
      until: null,
      ended: null,
      why: null,
    });
    for (const m of members.slice(1)) sendEnvoy(ctx, leader, m, "league", event, "yes", t);
    break;
  }
}

/** Someone of the house, of age, for a marriage: its ruler where they have no child of an age, else a child, named here. */
function ofTheHouse(
  ctx: PopulationContext,
  p: Polity,
  t: SimTime,
  sex: number | null,
  purpose: number,
): { name: string; sex: number; born: number; tie: string } | null {
  const { world } = ctx,
    year = yearOfMoment(t),
    grown = ctx.life.adulthood,
    ruler = p.ruler,
    fig = courtOf(world)
      ?.of(p.ref)
      ?.figures.find(
        (f) => f.tie === "child" && year - f.born >= grown && (sex === null || f.sex === sex),
      );
  if (fig) return { name: fig.name, sex: fig.sex === 0 ? 0 : 1, born: fig.born, tie: "child" };
  if (year - ruler.born < 2 * grown) {
    if (sex !== null && ruler.sex !== sex) return null;
    return { name: ruler.name, sex: ruler.sex, born: ruler.born, tie: "self" };
  }
  const ways = cultureOf(world).get(p.seat);
  if (!ways) return null;
  const u = (n: number) => world.rng.real(STREAM, refKey(p.ref), t, purpose + n),
    s = sex ?? (u(0) < 0.5 ? 0 : 1);
  return {
    name: `${tonguePersonName(ways.tongue, Math.floor(u(1) * 1e6), s)} ${ruler.name.split(" ").slice(1).join(" ")}`.trim(),
    sex: s,
    born: year - grown - Math.floor(u(2) * 10),
    tie: "child",
  };
}

/** What a marriage is remembered as. */
export const TIE_TERM: Readonly<Record<TieForm, string>> = {
  wed: "a marriage between their houses",
  foster: "young fostered between them",
  brood: "a gift of brood between them",
  graft: "a reef grafted between them",
};

/** The year's new bonds: marriages, or what a people has for them; embassies opened; what's gone let go. */
function bondsMade(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    year = yearOfMoment(t),
    store = tiesOf(world),
    realms = politiesOf(world),
    orders = orderOf(world);
  if (!orders) return;
  // Let go of embassies whose realms fell, or who are at war.
  for (const e of [...store.embassies()]) {
    const a = realms.get(e.a),
      b = realms.get(e.b);
    if (!a || !b || a.ended !== null || b.ended !== null) store.dropEmbassy(e);
    else if (warsOf(world).between(e.a, e.b)) {
      store.dropEmbassy(e);
      world.events.emit({
        type: TIE_EVENTS.embassy.type,
        subjects: [e.a, e.b],
        place: ctx.provinces.get(a.seat)?.ref ?? null,
        causes: [{ ref: e.event, role: "trigger", weight: 1 }],
        data: { a: realmName(a), b: realmName(b), recalled: true },
      });
    }
  }
  const diplomacy = diplomacyOf(world),
    culture = cultureOf(world);
  for (const r of diplomacy.all()) {
    if (r.opinion < TIES.matchAt && !r.pact) continue;
    const a = realms.get(r.a),
      b = realms.get(r.b);
    if (!a || !b || a.ended !== null || b.ended !== null) continue;
    if (warsOf(world).between(a.ref, b.ref)) continue;
    const key = refKey(a.ref) ^ (refKey(b.ref) << 7);
    // An embassy, between those sworn.
    if (
      r.pact &&
      !store.embassyOf(a.ref, b.ref) &&
      store.embassiesOf(a.ref).length < TIES.embassiesMost &&
      store.embassiesOf(b.ref).length < TIES.embassiesMost &&
      world.rng.real(STREAM, key, t, 3) < TIES.embassyChance
    )
      openEmbassy(ctx, a, b, r.pact, t);
    if (!(world.rng.real(STREAM, key, t, 2) < TIES.matchChance)) continue;
    const oa = realmOrder(
        orders,
        a,
        culture.get(a.seat),
        beliefOf(world).of(a.seat).faith !== null,
      ),
      ob = realmOrder(orders, b, culture.get(b.seat), beliefOf(world).of(b.seat).faith !== null),
      liveA = livingMatches(world, a.ref, year),
      liveB = livingMatches(world, b.ref, year);
    if (liveA.length >= TIES.matchesMost || liveB.length >= TIES.matchesMost) continue;
    if (liveA.some((m) => m.with === b.ref)) continue;
    const form = tieFormBetween(world, a, b),
      who = ofTheHouse(ctx, a, t, null, 60),
      to = who ? ofTheHouse(ctx, b, t, form === "wed" ? 1 - who.sex : null, 70) : null;
    if (!who || !to) continue;
    if (who.tie === "self" && liveA.some((m) => m.who === who.name)) continue;
    if (to.tie === "self" && liveB.some((m) => m.who === to.name)) continue;
    const event = world.events.emit({
        type: TIE_EVENTS.match.type,
        subjects: [a.ref, b.ref],
        place: ctx.provinces.get(a.seat)?.ref ?? null,
        causes: [{ ref: r.pact ?? a.event, role: "enabler", weight: 1 }],
        data: {
          realm: realmName(a),
          other: realmName(b),
          who: who.name,
          to: to.name,
          form,
          whoTown: a.town,
          toTown: b.town,
        },
      }),
      keep = (
        o: typeof oa,
        p: Polity,
        withRealm: Ref,
        one: NonNullable<typeof who>,
        other: NonNullable<typeof who>,
      ) => {
        o.matches = [
          ...(o.matches ?? []).filter((m) => year - m.year <= TIES.claimYears),
          {
            with: withRealm,
            who: one.name,
            whoSex: one.sex,
            whoBorn: one.born,
            to: other.name,
            toSex: other.sex,
            toBorn: other.born,
            year,
            event,
            form,
            tie: one.tie,
            of: p.ruler.name,
          },
        ];
      };
    keep(oa, a, b.ref, who, to);
    keep(ob, b, a.ref, to, who);
    diplomacy.remember(a.ref, b.ref, {
      name: TIE_TERM[form],
      value: TIES.tieOther + (form === "wed" ? 0.1 : 0),
      year,
      source: event,
    });
    sendEnvoy(ctx, a, b, "match", event, "yes", t);
  }
}

/** An embassy opened between two realms, by an envoy. */
export function openEmbassy(
  ctx: PopulationContext,
  a: Polity,
  b: Polity,
  cause: Ref,
  t: SimTime,
): Ref {
  const { world } = ctx,
    event = world.events.emit({
      type: TIE_EVENTS.embassy.type,
      subjects: [a.ref, b.ref],
      place: ctx.provinces.get(b.seat)?.ref ?? null,
      causes: [{ ref: cause, role: "enabler", weight: 1 }],
      data: { a: realmName(a), b: realmName(b) },
    });
  tiesOf(world).addEmbassy({ a: a.ref, b: b.ref, since: yearOfMoment(t), event });
  sendEnvoy(ctx, a, b, "embassy", event, "yes", t);
  return event;
}

/** The year's ties, after peace's terms and before its declarations. */
export function tiesYear(ctx: PopulationContext, t: SimTime): void {
  const store = tiesOf(ctx.world);
  store.trim(yearOfMoment(t));
  fearYear(ctx, t);
  bondsMade(ctx, t);
}

/** A seat fallen empty: whether someone of a marriage comes forward, and what comes of it. A new ruler where one is seated; a realm ended where it passes. */
export function claimAtDeath(
  ctx: PopulationContext,
  p: Polity,
  old: Ruler,
  death: Ref,
  named: boolean,
  t: SimTime,
): { end: ClaimEnd; ruler?: { name: string; sex: number; born: number } } | null {
  const { world, generated: g } = ctx,
    year = yearOfMoment(t),
    key = refKey(p.ref);
  // Someone the court names is someone: the house goes on. No court to say: by the rule's chance.
  if (named) return null;
  const c = courtOf(world)?.of(p.ref);
  if (!c && !(world.rng.real(STREAM, key, t, 30) < TIES.heirless)) return null;
  const live = livingMatches(world, p.ref, year);
  if (!live.length || offworldSite(g, p.seat)) return null;
  const realms = politiesOf(world),
    // The latest bond first.
    m = [...live].sort((x, y) => y.year - x.year)[0]!,
    q = realms.get(m.with)!,
    form = m.form ?? "wed",
    regard = diplomacyOf(world).get(p.ref, q.ref)?.opinion ?? 0,
    share = strengthOf(ctx, p) / Math.max(1, strengthOf(ctx, q)),
    reach = frontier(ctx, q, p).length > 0 && !bondsOf(world).between(p.ref, q.ref),
    atWar = !!warsOf(world).between(p.ref, q.ref),
    // A vassal, or one sworn to the other, passes no realm; one at war with them takes no one of theirs.
    bound = !!bondsOf(world).oathOf(q.ref) || !!bondsOf(world).oathOf(p.ref),
    drawn = claimEnd(form, regard, share, reach, world.rng.real(STREAM, key, t, 31)),
    end: ClaimEnd = atWar
      ? "passedby"
      : drawn === "passes" && (bound || q.members.length + p.members.length > 400)
        ? "seated"
        : drawn,
    u = (n: number) => world.rng.real(STREAM, key, t, 32 + n),
    grown = ctx.life.adulthood,
    // A child of the marriage if one could be grown, else the one wed.
    child = year - m.year >= grown,
    ways = cultureOf(world).get(p.seat),
    sex = child ? (u(0) < 0.5 ? 0 : 1) : m.whoSex,
    house = m.who.split(" ").slice(1).join(" "),
    // (The one wed may be who has just died: then the one they were wed to, of the other house.)
    widowed = !child && m.who === old.name,
    name =
      child && ways
        ? `${tonguePersonName(ways.tongue, Math.floor(u(1) * 1e6), sex)} ${house}`.trim()
        : widowed
          ? m.to
          : m.who,
    born = child ? m.year + Math.floor(u(2) * 3) : widowed ? m.toBorn : m.whoBorn,
    event = world.events.emit({
      type: TIE_EVENTS.claim.type,
      subjects: [p.ref, q.ref],
      place: ctx.provinces.get(p.seat)?.ref ?? null,
      causes: [
        { ref: death, role: "trigger", weight: 1 },
        { ref: m.event, role: "enabler", weight: 1 },
      ],
      data: {
        realm: realmName(p),
        other: realmName(q),
        old: old.name,
        who: name,
        tie: child ? "child" : widowed ? "widowed" : "self",
        town: p.town,
        wed: m.who,
        to: m.to,
        form,
        end,
        wedYear: m.year,
      },
    });
  sendEnvoy(ctx, q, p, "claim", event, end === "passedby" ? "no" : "yes", t);
  if (end === "passedby")
    diplomacyOf(world).remember(p.ref, q.ref, {
      name: "a seat they were passed by for",
      value: TIES.passedByAt,
      year,
      source: event,
    });
  if (end === "war") {
    const front = frontier(ctx, q, p),
      ref = world.minter.mint(WAR),
      prize = front.includes(p.seat) ? p.seat : front[0]!,
      declared = world.events.emit({
        type: WAR_EVENTS.declared.type,
        subjects: [ref, q.ref, p.ref],
        place: cellRef(0, prize),
        causes: [{ ref: event, role: "trigger", weight: 1 }],
        data: {
          a: realmName(q),
          b: realmName(p),
          aim: "claim",
          aimed: true,
          claimant: name,
          seat: p.town,
        },
      });
    warsOf(world).add({
      ref,
      attacker: q.ref,
      defender: p.ref,
      declared: year,
      event: declared,
      prize,
      battles: [],
      fallen: [0, 0],
      ended: null,
      peace: null,
    });
  }
  if (end === "passes") {
    for (const land of [...p.members]) {
      realms.leave(p, land);
      realms.join(q, land);
    }
    endRealm(ctx, p, t, { ref: event, role: "trigger", weight: 1 });
    return { end };
  }
  return {
    end,
    ...(end === "seated" ? { ruler: { name, sex: widowed ? m.toSex : sex, born } } : {}),
  };
}

/** What a war's other side hears of what a league holds: the factor a realm's own war on one of a league goes by. */
export function leagueHold(world: World, attacker: Ref, defender: Ref): number {
  return tiesOf(world).leagueAgainst(attacker, defender) ? TIES.leagueHold : 1;
}
