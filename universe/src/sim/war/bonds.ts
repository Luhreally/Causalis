// Wars with aims, peace with terms (W7). What a war is about is read off what drove it, kept on its declaration's own
// event, and steers where the host goes and what a battle won takes. What a peace comes to goes by how the war went and
// how far each side is spent: land ceded, a tribute, an oath, a truce. Whatever binds is kept here, by the two realms'
// refs, and runs out by the world's clock. A tribute really moves, from the payer's lands to the other's seat, out of
// what each land has above three months of food, as a tithe does. Where people eat all they make there is nothing to
// take, and no one asks it: on a far world most realms are so, and a peace there comes to land, a truce, or an oath that
// pays nothing. One who can pay and then can't is short; three short years and it has stopped paying, which is
// remembered, and is a reason for the next war. A vassal keeps its lands and its ruler, pays what it can be asked,
// declares no war of its own, and rises when it is strong enough. No one bound holds anyone bound, so no chain is longer
// than one.
import {
  defineEventType,
  defineStream,
  yearOfMoment,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { cellRef } from "../../gen/index.ts";
import {
  FOODS,
  G,
  TERMS,
  dealOf,
  tributeOf,
  type AimKind,
  type BondKind,
  type Deal,
  type PeaceOffer as Offer,
} from "../../rules/index.ts";
import { mouths, type PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import { beliefOf } from "../belief/belief.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { diplomacyOf, type Relation } from "../diplomacy/diplomacy.ts";
import { heldAmongStars } from "../space/nation-store.ts";
import { WAR, WAR_EVENTS, frontier, strengthOf, warsOf, type War } from "./war.ts";

export const BOND_EVENTS = {
  /** A term run out by the clock, or ended by a fall. */
  ended: defineEventType("terms.ended", 3),
  /** Three short years: it has stopped paying. */
  unpaid: defineEventType("terms.unpaid", 4),
  /** A vassal rose. */
  rose: defineEventType("terms.rose", 5),
  /** A hungry host carried off a land's stores. */
  sacked: defineEventType("terms.sacked", 3),
};

/** What is kept of a term still running. */
export type Bond = {
  readonly kind: BondKind;
  /** Who pays, or swore; for a truce, the attacker. */
  readonly from: Ref;
  /** To whom; for a truce, the defender. */
  readonly to: Ref;
  readonly war: Ref;
  /** The peace that made it. */
  readonly event: Ref;
  /** What it pays a year (0: a truce). */
  readonly grain: number;
  readonly since: number;
  readonly until: number;
  /** What it has paid in all. */
  paid: number;
  /** Short years in a row, and the year the first of them fell. */
  short: number;
  shortSince: number;
};

const STREAM = defineStream("war.terms");
/** The term a realm remembers a tribute unpaid by. */
export const UNPAID_TERM = "a tribute unpaid";

export class BondStore implements StateStore {
  readonly name = "war.bonds";
  /** Those still running, the oldest first. */
  private bonds: Bond[] = [];

  all(): readonly Bond[] {
    return this.bonds;
  }
  add(b: Bond): void {
    this.bonds.push(b);
  }
  remove(b: Bond): void {
    this.bonds = this.bonds.filter((x) => x !== b);
  }
  /** Whatever binds a realm, either way. */
  of(realm: Ref): Bond[] {
    return this.bonds.filter((b) => b.from === realm || b.to === realm);
  }
  /** What holds two realms from war with each other. */
  between(a: Ref, b: Ref): Bond | undefined {
    return this.bonds.find((x) => (x.from === a && x.to === b) || (x.from === b && x.to === a));
  }
  /** The oath a realm has sworn. */
  oathOf(realm: Ref): Bond | undefined {
    return this.bonds.find((b) => b.kind === "vassal" && b.from === realm);
  }
  /** The oaths sworn to a realm. */
  vassalsOf(realm: Ref): Bond[] {
    return this.bonds.filter((b) => b.kind === "vassal" && b.to === realm);
  }
  vassals(): number {
    return this.bonds.filter((b) => b.kind === "vassal").length;
  }
  pinned(): Ref[] {
    return this.bonds.map((b) => b.event);
  }
  hashInto(h: Hasher): void {
    if (this.bonds.length) h.value(this.bonds);
  }
  save(): unknown {
    return { bonds: this.bonds };
  }
  load(state: unknown): void {
    this.bonds = ((state as { bonds?: Bond[] }).bonds ?? []).map((b) => ({ ...b }));
  }
}

export function bondsOf(world: World): BondStore {
  return world.store<BondStore>("war.bonds");
}

/** What is kept of a war's aim on its declaration (nothing: a war from before aims, or a civil one). */
export type WarAim = {
  readonly aim: AimKind;
  /** A land lost: the year (absent: not on record). */
  readonly lost?: number;
  /** A holy war: the two faiths, by their own names. */
  readonly faith?: string;
  readonly theirs?: string;
  /** A tribute unpaid: since when. */
  readonly owed?: number;
};

/** The aim on a declaration's data. */
export function aimOf(world: World, w: War): WarAim | null {
  const d = world.events.get(w.event)?.data as Partial<WarAim> | null | undefined;
  return d && typeof d.aim === "string" ? (d as WarAim) : null;
}

/** What the realm makes in a year: its lands' grain, as a tithe reads it. */
export function grainMade(ctx: PopulationContext, p: Polity): number {
  const markets = ctx.world.store<MarketStore>("economy.markets");
  let made = 0;
  for (const c of p.members) made += markets.get(c)?.years.at(-1)?.ledger[0]?.[G.grain] ?? 0;
  return made;
}

/** What one land can give up of grain: what it holds above three months of its food. */
function landSpare(ctx: PopulationContext, cell: number): number {
  const prov = ctx.provinces.get(cell),
    m = ctx.world.store<MarketStore>("economy.markets").get(cell);
  if (!prov || !m || heldAmongStars(ctx.world, cell)) return 0;
  return Math.floor(
    Math.max(0, Math.min(m.stock[G.grain]!, m.food(FOODS) - mouths(prov, ctx.life) * 3)),
  );
}

/** What a realm could give up of grain this year, over all its lands: nothing, where its people eat all they make. */
export function spareOf(ctx: PopulationContext, p: Polity): number {
  let n = 0;
  for (const c of p.members) n += landSpare(ctx, c);
  return n;
}

/** The land of a realm's it lost to `d`, within reach (`front`), the latest first: won from it in their wars, else last its own. */
function lostLand(
  ctx: PopulationContext,
  a: Polity,
  d: Polity,
  front: readonly number[],
): { land: number; year?: number } | null {
  const wars = warsOf(ctx.world).hotOf(a.ref);
  for (let i = wars.length - 1; i >= 0; i--) {
    const w = wars[i]!;
    if (w.attacker !== d.ref || w.defender !== a.ref) continue;
    for (let k = w.battles.length - 1; k >= 0; k--) {
      const b = w.battles[k]!;
      if (b.won && front.includes(b.land)) return { land: b.land, year: b.year };
    }
  }
  const realms = politiesOf(ctx.world);
  for (const c of front) if (realms.formerly(c) === a.ref) return { land: c };
  return null;
}

/** Of a frontier, the land nearest the seat. */
function nearestSeat(ctx: PopulationContext, front: readonly number[], seat: number): number {
  const p = ctx.generated.grid.positions;
  let best = front[0]!,
    near = Infinity;
  for (const c of front) {
    const dx = p[3 * c]! - p[3 * seat]!,
      dy = p[3 * c + 1]! - p[3 * seat + 1]!,
      dz = p[3 * c + 2]! - p[3 * seat + 2]!,
      d = dx * dx + dy * dy + dz * dz;
    if (d < near || (d === near && c < best)) {
      near = d;
      best = c;
    }
  }
  return best;
}

/** What a realm's war on another is about, and the land it goes for: read off what drove it. */
export function chooseAim(
  ctx: PopulationContext,
  a: Polity,
  d: Polity,
  r: Relation,
  covets: boolean,
  holy: number,
  press: number,
  ratio: number,
  front: readonly number[],
): { aim: WarAim; prize: number; source: Ref | null } {
  const { world } = ctx,
    first = front[0]!,
    faiths = beliefOf(world);
  // The hungry want the stores: the fullest land, whichever it is this year.
  if (covets) return { aim: { aim: "stores" }, prize: first, source: null };
  // A tribute unpaid is owed.
  const unpaid = r.terms.find((x) => x.name === UNPAID_TERM);
  if (unpaid?.source) {
    const e = world.events.get(unpaid.source),
      since = (e?.data as { since?: number } | null)?.since;
    return {
      aim: { aim: "tribute", ...(since !== undefined ? { owed: since } : {}) },
      prize: first,
      source: unpaid.source,
    };
  }
  // A land lost is an old grudge, and the host goes for it by name.
  const lost = lostLand(ctx, a, d, front);
  if (lost)
    return {
      aim: { aim: "back", ...(lost.year !== undefined ? { lost: lost.year } : {}) },
      prize: lost.land,
      source: null,
    };
  // A temple's war on unbelievers goes for their seat.
  const mine = faiths.of(a.seat),
    theirs = faiths.of(d.seat),
    zeal = r.terms.some((x) => x.name === `the zeal of ${realmName(a)}`);
  if (
    mine.faith &&
    theirs.faith &&
    mine.faith !== theirs.faith &&
    (zeal || holy >= TERMS.holyPress)
  )
    return {
      aim: {
        aim: "holy",
        faith: faiths.get(mine.faith)?.name ?? "their faith",
        theirs: faiths.get(theirs.faith)?.name ?? "another",
      },
      prize: nearestSeat(ctx, front, d.seat),
      source: mine.event,
    };
  // A much stronger realm whose court and host press for more would have it paid: by one who has something to pay.
  if (ratio >= TERMS.tributeRatio && press >= TERMS.tributePress && spareOf(ctx, d) > 0)
    return { aim: { aim: "tribute" }, prize: first, source: null };
  return { aim: { aim: "land" }, prize: first, source: null };
}

/** Whether a war's host goes for its prize by name while it can be reached (else for the fullest land). */
export const goesForPrize = (aim: AimKind | undefined): boolean =>
  aim === "land" || aim === "back" || aim === "holy";

/** Whether a battle won takes the land (a host that came for grain, for tribute or to be free leaves it). */
export const takesLand = (aim: AimKind | undefined): boolean =>
  aim !== "stores" && aim !== "tribute" && aim !== "free";

/** A hungry host's battle won: half that land's grain, carried to the hungriest of its own lands. */
export function sack(
  ctx: PopulationContext,
  a: Polity,
  b: Polity,
  land: number,
  cause: Ref,
): number {
  const { world } = ctx,
    markets = world.store<MarketStore>("economy.markets"),
    from = markets.get(land);
  if (!from) return 0;
  const n = Math.floor(from.stock[G.grain]! * TERMS.sack);
  let to = a.seat,
    least = Infinity;
  for (const c of a.members) {
    const prov = ctx.provinces.get(c),
      m = markets.get(c);
    if (!prov || !m) continue;
    const food = m.food(FOODS) / Math.max(1, mouths(prov, ctx.life));
    if (food < least) {
      least = food;
      to = c;
    }
  }
  const into = markets.get(to);
  if (n <= 0 || !into) return 0;
  into.move("in", G.grain, from.move("out", G.grain, n));
  world.events.emit({
    type: BOND_EVENTS.sacked.type,
    subjects: [a.ref, b.ref],
    place: cellRef(0, land),
    causes: [{ ref: cause, role: "trigger", weight: 1 }],
    data: { a: realmName(a), b: realmName(b), grain: n, to },
  });
  return n;
}

/** Whether a winner can take a loser's oath. */
export function canBind(world: World, winner: Polity, loser: Polity): boolean {
  const bonds = bondsOf(world),
    living = politiesOf(world).living().length;
  return (
    living >= TERMS.realmsLeast &&
    !bonds.oathOf(winner.ref) &&
    !bonds.oathOf(loser.ref) &&
    !bonds.vassalsOf(loser.ref).length &&
    bonds.vassalsOf(winner.ref).length < TERMS.vassalsMost &&
    bonds.vassals() + 1 <= Math.floor(living * TERMS.vassalShare)
  );
}

/** What a realm's people number. */
const peopleOf = (ctx: PopulationContext, p: Polity) =>
  p.members.reduce((s, c) => s + (ctx.provinces.get(c)?.total() ?? 0), 0);

/** The lands a war's attacker took, and holds: the prize first. */
function landsTaken(a: Polity, w: War): number[] {
  const out: number[] = [];
  if (a.members.includes(w.prize)) out.push(w.prize);
  for (const x of w.battles)
    if (x.won && x.land !== w.prize && a.members.includes(x.land) && !out.includes(x.land))
      out.push(x.land);
  return out;
}

/** What a peace says of itself: kept on its event, told by its words. Null: nothing can be said (one side fell). */
export type PeaceTerms = {
  /** What it came to: "land", "tribute", "vassal", "truce", "free" (a rising that won), or "fell" (one side is no more: `payer`). */
  readonly kind: "land" | "free" | "fell" | BondKind;
  /** Who gives, and to whom. */
  readonly payer?: string;
  readonly to?: string;
  /** Land ceded: how many, and the first. */
  readonly lands?: number;
  readonly land?: number;
  readonly grain?: number;
  readonly years?: number;
  readonly until?: number;
  /** A ruler's offer that made it. */
  readonly offer?: string;
  /** A truce after a host beaten back: who. */
  readonly beaten?: string;
};

/** What a peace comes to, for a war whose realms both stand. */
export function reckonPeace(
  ctx: PopulationContext,
  w: War,
  a: Polity,
  b: Polity,
  aim: AimKind | undefined,
  got: boolean,
  year: number,
): { deal: Deal; terms: PeaceTerms; payer: Polity | null; other: Polity | null; grain: number } {
  const { world } = ctx,
    won = w.battles.filter((x) => x.won).length,
    edge = 2 * won - w.battles.length,
    ratio = strengthOf(ctx, a) / Math.max(1, strengthOf(ctx, b)),
    lands = landsTaken(a, w),
    leader = edge > 0 || got || lands.length > 0 ? 0 : edge < 0 ? 1 : null,
    deal = dealOf({
      edge,
      ratio,
      spent: [
        w.fallen[0] / Math.max(1, peopleOf(ctx, a)),
        w.fallen[1] / Math.max(1, peopleOf(ctx, b)),
      ],
      lands: lands.length,
      aim: aim ?? null,
      got,
      canBind: leader === null ? false : canBind(world, leader === 0 ? a : b, leader === 0 ? b : a),
    });
  return termsOfDeal(ctx, deal, a, b, lands, aim, year);
}

/** A deal in terms: what it comes to in grain and years, a tribute that cannot be paid falling back on what it can. */
function termsOfDeal(
  ctx: PopulationContext,
  deal: Deal,
  a: Polity,
  b: Polity,
  lands: readonly number[],
  aim: AimKind | undefined,
  year: number,
): { deal: Deal; terms: PeaceTerms; payer: Polity | null; other: Polity | null; grain: number } {
  const ceded =
      lands.length > 0
        ? ({ payer: realmName(b), to: realmName(a), lands: lands.length, land: lands[0]! } as const)
        : {},
    plain = (kind: PeaceTerms["kind"]) => ({
      deal,
      terms: { kind, ...ceded },
      payer: null,
      other: null,
      grain: 0,
    }),
    truce = () => {
      const years = TERMS.truceYears;
      return {
        deal: { ...deal, bond: "truce" as const, years },
        terms: {
          kind: "truce" as const,
          years,
          until: year + years,
          ...ceded,
          ...(deal.winner === 1 ? { beaten: realmName(a) } : {}),
        },
        payer: a,
        other: b,
        grain: 0,
      };
    };
  if (deal.bond === "truce") return truce();
  if (deal.bond === null) {
    if (aim === "free" && deal.winner === 0) return plain("free");
    return lands.length ? plain("land") : truce();
  }
  const payer = deal.winner === 0 ? b : a,
    other = deal.winner === 0 ? a : b,
    asked = Math.floor(deal.share * grainMade(ctx, payer)),
    // (Nothing to spare: an oath still binds, and pays nothing; a tribute of nothing, or one more than can be borne, is a truce.)
    grain = spareOf(ctx, payer) >= asked ? asked : 0;
  if (deal.bond === "tribute" && (grain < 1 || owing(ctx.world, payer) >= TERMS.owesMost))
    return truce();
  return {
    deal,
    terms: {
      kind: deal.bond,
      payer: realmName(payer),
      to: realmName(other),
      grain,
      years: deal.years,
      until: year + deal.years,
      ...(lands.length ? { lands: lands.length, land: lands[0]! } : {}),
    },
    payer,
    other,
    grain,
  };
}

/** How many a realm is paying. */
export const owing = (world: World, p: Polity): number =>
  bondsOf(world)
    .of(p.ref)
    .filter((b) => b.from === p.ref && b.grain > 0).length;

/** What a ruler's offer comes to: what they give or ask, as a peace's terms; its land, where one passes. */
export function termsOfOffer(
  ctx: PopulationContext,
  w: War,
  r: Polity,
  foe: Polity,
  offer: Offer,
  year: number,
): {
  deal: Deal;
  terms: PeaceTerms;
  payer: Polity | null;
  other: Polity | null;
  grain: number;
  land: number | null;
} {
  const giving = offer === "give-land" || offer === "give-tribute",
    payer = giving ? r : foe,
    other = giving ? foe : r,
    peopleFallen = w.fallen[payer.ref === w.attacker ? 0 : 1] / Math.max(1, peopleOf(ctx, payer)),
    base: Deal = { winner: null, bond: null, share: 0, years: 0 };
  if (offer === "truce") {
    const years = TERMS.truceYears;
    return {
      deal: { ...base, bond: "truce", years },
      terms: { kind: "truce", years, until: year + years, offer },
      payer: r,
      other: foe,
      grain: 0,
      land: null,
    };
  }
  if (offer === "give-land" || offer === "take-land") {
    const land = landOffered(ctx, w, r, foe, offer);
    return {
      deal: base,
      terms: {
        kind: "land",
        payer: realmName(payer),
        to: realmName(other),
        lands: 1,
        ...(land !== null ? { land } : {}),
        offer,
      },
      payer: null,
      other: null,
      grain: 0,
      land,
    };
  }
  const knee = offer === "take-knee",
    { share, years } = knee
      ? { share: TERMS.oathShare, years: TERMS.oathYears }
      : tributeOf(
          Math.max(1, Math.abs(2 * w.battles.filter((x) => x.won).length - w.battles.length)),
          peopleFallen,
        ),
    asked = Math.floor(share * grainMade(ctx, payer)),
    // (An oath from one with nothing to spare pays nothing. A tribute they can't pay is never agreed: reign.ts.)
    grain = knee && spareOf(ctx, payer) < asked ? 0 : asked;
  return {
    deal: { ...base, bond: knee ? "vassal" : "tribute", share, years },
    terms: {
      kind: knee ? "vassal" : "tribute",
      payer: realmName(payer),
      to: realmName(other),
      grain,
      years,
      until: year + years,
      offer,
    },
    payer,
    other,
    grain,
    land: null,
  };
}

/** The land a ruler's offer would pass: their own richest on the border; asked of the other, what the war is for, or the other's richest. Never a seat. */
export function landOffered(
  ctx: PopulationContext,
  w: War,
  r: Polity,
  foe: Polity,
  offer: "give-land" | "take-land",
): number | null {
  if (offer === "give-land") {
    const land = frontier(ctx, foe, r).find((c) => c !== r.seat);
    return land ?? null;
  }
  if (w.attacker === r.ref && foe.members.includes(w.prize) && w.prize !== foe.seat) return w.prize;
  const land = frontier(ctx, r, foe).find((c) => c !== foe.seat);
  return land ?? null;
}

/** What a peace has agreed takes hold. `event` is the peace. */
export function bindPeace(
  ctx: PopulationContext,
  w: War,
  made: Pick<ReturnType<typeof reckonPeace>, "terms" | "payer" | "other" | "grain">,
  event: Ref,
  year: number,
): void {
  const { payer, other, grain } = made,
    kind = made.terms.kind;
  if (!payer || !other || (kind !== "truce" && kind !== "tribute" && kind !== "vassal")) return;
  bondsOf(ctx.world).add({
    kind,
    from: payer.ref,
    to: other.ref,
    war: w.ref,
    event,
    grain,
    since: year,
    until: year + (made.terms.years ?? 0),
    paid: 0,
    short: 0,
    shortSince: 0,
  });
}

/** A term done with: told, and let go. */
function endBond(
  ctx: PopulationContext,
  b: Bond,
  how: "clock" | "fell",
  by: Polity | undefined,
  year: number,
): void {
  const { world } = ctx,
    store = bondsOf(world),
    realms = politiesOf(world),
    from = realms.get(b.from),
    to = realms.get(b.to);
  store.remove(b);
  if (!from || !to) return;
  world.events.emit({
    type: BOND_EVENTS.ended.type,
    subjects: [b.from, b.to],
    place: ctx.provinces.get(from.ended === null ? from.seat : to.seat)?.ref ?? null,
    causes: [{ ref: b.event, role: "trigger", weight: 1 }],
    data: {
      a: realmName(from),
      b: realmName(to),
      kind: b.kind,
      how,
      years: year - b.since,
      paid: b.paid,
      ...(by ? { fell: realmName(by) } : {}),
    },
  });
}

/** A vassal rises: its oath is thrown off, and if any land lies between them, it is war. By the god's hand: `by`. */
export function riseUp(
  ctx: PopulationContext,
  b: Bond,
  t: SimTime,
  by?: string,
  cause?: Ref,
): Ref | null {
  const { world } = ctx,
    store = bondsOf(world),
    realms = politiesOf(world),
    v = realms.get(b.from)!,
    o = realms.get(b.to)!,
    year = yearOfMoment(t),
    front = frontier(ctx, v, o);
  store.remove(b);
  const rose = world.events.emit({
    type: BOND_EVENTS.rose.type,
    subjects: [v.ref, o.ref],
    place: ctx.provinces.get(v.seat)?.ref ?? null,
    causes: [
      ...(cause ? [{ ref: cause, role: "agent" as const, weight: 1 }] : []),
      { ref: b.event, role: "enabler", weight: 1 },
    ],
    data: {
      a: realmName(v),
      b: realmName(o),
      years: year - b.since,
      ...(by ? { by } : {}),
      war: front.length > 0,
    },
  });
  if (!front.length) return rose;
  const ref = world.minter.mint(WAR),
    event = world.events.emit({
      type: WAR_EVENTS.declared.type,
      subjects: [ref, v.ref, o.ref],
      place: cellRef(0, front[0]!),
      causes: [{ ref: rose, role: "trigger", weight: 1 }],
      data: { a: realmName(v), b: realmName(o), aim: "free", ...(by ? { by } : {}) },
    });
  warsOf(world).add({
    ref,
    attacker: v.ref,
    defender: o.ref,
    declared: year,
    event,
    prize: front[0]!,
    battles: [],
    fallen: [0, 0],
    ended: null,
    peace: null,
  });
  return rose;
}

/** The year's terms: what has run out, what falls due, who stops paying, who rises. */
export function bondsYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = bondsOf(world);
  if (!store.all().length) return;
  const realms = politiesOf(world),
    markets = world.store<MarketStore>("economy.markets"),
    year = yearOfMoment(t),
    // What a realm has yet to spare of what it made, this year, for all it owes.
    leeway = new Map<string, number>();
  for (const b of [...store.all()]) {
    const from = realms.get(b.from),
      to = realms.get(b.to);
    if (!from || !to || from.ended !== null || to.ended !== null) {
      endBond(ctx, b, "fell", from?.ended !== null ? from : to, year);
      continue;
    }
    if (year >= b.until) {
      endBond(ctx, b, "clock", undefined, year);
      continue;
    }
    if (b.kind === "truce") continue;
    // (An oath that asks nothing: its one who has nothing to spare owes nothing.)
    if (b.grain <= 0) continue;
    // A year's payment: out of what its lands have above three months of their food, the seat's first, and no more than the realm can bear.
    const into = markets.get(to.seat);
    let paid = 0;
    if (into) {
      const room = leeway.get(from.ref) ?? Math.floor(TERMS.yearMost * grainMade(ctx, from));
      let left = Math.min(b.grain, room);
      for (const c of [from.seat, ...from.members.filter((x) => x !== from.seat)]) {
        if (left <= 0) break;
        const out = markets.get(c),
          n = Math.min(left, landSpare(ctx, c));
        if (out && n > 0) {
          into.move("in", G.grain, out.move("out", G.grain, n));
          paid += n;
          left -= n;
        }
      }
      leeway.set(from.ref, room - paid);
    }
    b.paid += paid;
    if (paid >= b.grain * TERMS.shortShare) {
      b.short = 0;
      continue;
    }
    if (!b.short) b.shortSince = year;
    b.short++;
    if (b.short < TERMS.shortYears) continue;
    // It has stopped paying: remembered, and a reason for the next war.
    store.remove(b);
    const unpaid = world.events.emit({
      type: BOND_EVENTS.unpaid.type,
      subjects: [from.ref, to.ref],
      place: ctx.provinces.get(from.seat)?.ref ?? null,
      causes: [{ ref: b.event, role: "trigger", weight: 1 }],
      data: {
        a: realmName(from),
        b: realmName(to),
        kind: b.kind,
        since: b.shortSince,
        grain: b.grain,
        paid: b.paid,
      },
    });
    diplomacyOf(world).remember(from.ref, to.ref, {
      name: UNPAID_TERM,
      value: TERMS.unpaid,
      year,
      source: unpaid,
    });
  }
  // Those strong enough rise.
  for (const b of [...store.all()]) {
    if (b.kind !== "vassal") continue;
    const v = realms.get(b.from)!,
      o = realms.get(b.to)!;
    if (strengthOf(ctx, v) < TERMS.riseAt * strengthOf(ctx, o)) continue;
    if (world.rng.real(STREAM, Number(b.from.split(":")[2]), t, 1) >= TERMS.riseChance) continue;
    riseUp(ctx, b, t);
  }
}

/** Teach a peopled world what peace leaves behind. */
export function installBonds(world: World): BondStore {
  const store = world.register(new BondStore());
  world.addPinner(() => store.pinned());
  return store;
}
