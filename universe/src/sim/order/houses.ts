// Houses (round H; the rules are rules/houses.ts): the families, cronies and grifters who keep power for themselves. A realm is
// reckoned once in HOUSES.every years, in its turn (by its ref's number and the year), and stepped as many years at once:
//   - who its ruler must pay: its selectorate and winning coalition, from its groups' sway (sim/polity/interests.ts), whether it
//     chooses (sim/order/elections.ts: the winner's share is what a coalition must hold there) and how its rule passes;
//   - how much of what the seat hands out goes as favours: what is skimmed between its lands and its seat (sim/order corruption, cut
//     from its taxes and its seat's granary: sim/money treasury), its offices' pay where kin hold them, the rents of the licences it
//     grants and the margin of the customs it farms out (sim/money tariffs);
//   - a few great houses, each a small record: one for the ruler's own family, one for each group great enough in the coalition,
//     a demagogue risen on grievance, a grifter on the skim, a cadet line of an estate parted. Each holds wealth (grain's worth),
//     a share of its land's rent, of the realm's offices and of its grants, takes in what those give it and spends of what it holds;
//   - each line's head ages by its people's life table, dies, and leaves the heirs it gives: an estate kept whole or parted, a cadet
//     line founded, a lesser line wed into a greater, a line dead out (its estate escheats to the crown);
//   - a crown that keeps the arms purges a house grown too near its own power (its wealth seized for the treasury); a revolution ends
//     the titled houses and the ruler's own; a coup or a throne taken leaves the old ruler's house fallen from the seat.
// What flows back, read by the older systems: how loyal its coalition is and how many offices kin hold move its corruption
// (sim/order/order.ts); offices held by titled houses set its caste; offices held by kin and not the able thin its reach
// (capacityOf); a house that outweighs the crown feeds a coup (sim/strife coupDanger), a demagogue's following a rising
// (revolutionDanger); the rents of licences, farms and grifters breed grievance in its lands each year; estates seized or escheated
// go to its treasury's reserve. One record a realm, six houses at most; a realm's record goes with it.
import {
  YEAR,
  Hasher,
  defineEventType,
  defineStream,
  dmath,
  parseRef,
  yearOfMoment,
  type Factor,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { tongueName } from "../../gen/index.ts";
import {
  G,
  HOLD,
  HOUSES,
  rentChafes,
  HOUSE_ORIGINS,
  LANDED_HOUSES,
  REIGN,
  coalitionOf,
  courtedShares,
  crownKeep,
  diesWithin,
  farmedOut,
  followingWanted,
  generationOf,
  griftWanted,
  heirsExpected,
  heirsFor,
  kinInOffice,
  licenceRent,
  licensed,
  parted,
  privateShare,
  purgeChance,
  rivalWeight,
  type HouseEnd,
  type HouseOrigin,
} from "../../rules/index.ts";
import { adults, type PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { loreOf } from "../lore/lore.ts";
import { interestsOf } from "../polity/interests.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { grieve } from "../acts/disasters.ts";
import {
  BIND,
  BIND_STORE,
  DUTY,
  FISC,
  SHARE,
  SHARES_STORE,
  TARIFF_STORE,
  TREASURY_STORE,
  giniOf,
  moneyStore,
  refNumber,
  stepped,
  taxGrievance,
} from "../money/kept.ts";
import { capacityOf, orderOf } from "./order.ts";
import { holdsOf } from "./holds.ts";
import { LAW_OF } from "./laws.ts";
import { chooses, electionsOf } from "./elections.ts";
import { orgPartyOf } from "./groups-kept.ts";
import { ORG } from "../../rules/index.ts";
import { spend, whisperIn } from "../acts/person.ts";

export const HOUSE_EVENTS = {
  /** A great house rose: of a group great in the coalition, of the ruler's own family, a cadet line. */
  rose: defineEventType("houses.rose", 3),
  /** One rose from outside: a demagogue on grievance, a grifter on the skim. */
  demagogue: defineEventType("houses.demagogue", 4),
  grifter: defineEventType("houses.grifter", 3),
  /** A demagogue carried more of the people than those who govern: taken into the seat's favour. */
  office: defineEventType("houses.office", 4),
  /** How a house's hold ended. */
  purged: defineEventType("houses.purged", 4),
  overthrown: defineEventType("houses.overthrown", 4),
  wed: defineEventType("houses.wed", 3),
  diedout: defineEventType("houses.diedout", 3),
  faded: defineEventType("houses.faded", 2),
  exposed: defineEventType("houses.exposed", 3),
  /** An estate parted among heirs, a cadet line founded. */
  parted: defineEventType("houses.parted", 2),
};

const DRAW = defineStream("houses.lines");

/** One great house: whole numbers but for its name (shares in thousandths, wealth in grain's worth). */
export type HouseRecord = {
  readonly id: number;
  readonly name: string;
  /** Its origin, by HOUSE_ORIGINS. */
  readonly origin: number;
  readonly since: number;
  /** The land it is seated in; the house it is a cadet line of (absent: none). */
  readonly seat: number;
  readonly of?: number;
  wealth: number;
  /** Its share of its seat land's rent, of the realm's offices, of its trade under licence and of its customs farmed out. */
  land: number;
  offices: number;
  grants: number;
  farm: number;
  /** What it took in a year, last reckoned (grain's worth); its power (thousandths: its wealth and offices among the houses'). */
  income: number;
  power: number;
  /** 1: its standing passes with its blood. */
  titled: number;
  /** 1: it holds the seat. */
  crown: number;
  /** Its head's year of birth; the generation its line is in; its heirs at the last death. */
  headBorn: number;
  generation: number;
  heirs: number;
  /** 1: a demagogue in the seat's favour. */
  office?: number;
  readonly event: Ref;
};

/** A house whose hold ended: its name and origin, when and how, who took it in, and the event. */
export type GoneHouse = {
  readonly name: string;
  readonly origin: number;
  readonly since: number;
  readonly year: number;
  readonly how: HouseEnd;
  readonly into?: string;
  readonly event: Ref;
};

/** A realm's houses and who its ruler must pay. Shares in thousandths; heads whole; grain's worth a year. */
export type RealmHouses = {
  /** The year it was last reckoned. */
  last: number;
  /** Its selectorate, its winning coalition and its working people (heads); the loyalty norm, its favours' share. */
  selectorate: number;
  winning: number;
  all: number;
  loyalty: number;
  favours: number;
  /** The coalition's groups and the share of each in it (thousandths). */
  members: [string, number][];
  /** Offices held by kin, and by titled houses; how far the greatest other house outweighs the crown. */
  nepotism: number;
  hereditary: number;
  rival: number;
  /** A demagogue's following, a grifter's take (thousandths). */
  following: number;
  grift: number;
  /** The share of an estate parted at a death; what is skimmed, and the rents of licences and farms (grain's worth a year). */
  parted: number;
  skim: number;
  rents: number;
  /** The rents' burden on what its people earn (thousandths), bred into grievance yearly. */
  burden: number;
  /** The burden its people have grown used to (thousandths): what they bear past it is what aggrieves them most. */
  used?: number;
  /** The ruler's coming to rule when last reckoned. */
  crownEvent: Ref | null;
  next: number;
  houses: HouseRecord[];
  gone: GoneHouse[];
};

export class HouseStore implements StateStore {
  readonly name = "order.houses";
  /** Saved packed by column (kernel/pack.ts). */
  readonly packed = true;
  private readonly realms = new Map<Ref, RealmHouses>();
  /** Every realm's record folded in as it is set: a checkpoint hashes this, not every house (O(1) a checkpoint). */
  private digest = "";
  private sets = 0;
  dormant(): boolean {
    return this.realms.size === 0 && this.sets === 0;
  }
  of(realm: Ref): Readonly<RealmHouses> | undefined {
    return this.realms.get(realm);
  }
  /** Set a realm's record, folding it into the digest. */
  put(realm: Ref, v: RealmHouses): void {
    this.realms.set(realm, v);
    this.digest = new Hasher().string(this.digest).string(realm).value(v).hex();
    this.sets++;
  }
  forget(realm: Ref): void {
    if (!this.realms.delete(realm)) return;
    this.digest = new Hasher().string(this.digest).string(`-${realm}`).hex();
    this.sets++;
  }
  realmsKept(): Ref[] {
    return [...this.realms.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const v of this.realms.values()) {
      for (const h of v.houses) out.push(h.event);
      for (const g of v.gone) out.push(g.event);
    }
    return out;
  }
  hashInto(h: Hasher): void {
    h.int(this.realms.size).int(this.sets).string(this.digest);
  }
  save(): unknown {
    return {
      realms: this.realmsKept().map((r) => [r, this.realms.get(r)!]),
      digest: this.digest,
      sets: this.sets,
    };
  }
  load(state: unknown): void {
    this.realms.clear();
    const s = state as {
      realms?: [Ref, RealmHouses][];
      digest?: string;
      sets?: number;
    } | null;
    for (const [r, v] of s?.realms ?? []) this.realms.set(r, v);
    this.digest = s?.digest ?? "";
    this.sets = s?.sets ?? 0;
  }
}

export function housesOf(world: World): HouseStore | null {
  return world.hasStore("order.houses") ? world.store<HouseStore>("order.houses") : null;
}

/** What the older systems read of a realm's houses (each 0 … 1; null where none are kept). */
export type HousesRead = {
  readonly loyalty: number;
  readonly favours: number;
  readonly nepotism: number;
  readonly hereditary: number;
  readonly rival: number;
  readonly following: number;
  readonly grift: number;
};

/** A realm's houses, as the older systems read them (null: none reckoned). */
export function housesRead(world: World, realm: Ref): HousesRead | null {
  const v = housesOf(world)?.of(realm);
  if (!v) return null;
  return {
    loyalty: v.loyalty / 1000,
    favours: v.favours / 1000,
    nepotism: v.nepotism / 1000,
    hereditary: v.hereditary / 1000,
    rival: v.rival / 1000,
    following: v.following / 1000,
    grift: v.grift / 1000,
  };
}

/**
 * The family of a realm's great house risen of a group (its voice at court is one of them: sim/court/court.ts), if one stands;
 * the greatest of them. Null where none does.
 */
export function houseOfGroup(world: World, realm: Ref, group: string): string | null {
  const v = housesOf(world)?.of(realm);
  if (!v) return null;
  const of = v.houses
    .filter((h) => !h.crown && HOUSE_ORIGINS[h.origin] === group)
    .sort((a, b) => b.power - a.power || a.id - b.id)[0];
  return of?.name ?? null;
}

/** The origin of a house, in words. */
export const originOf = (h: { readonly origin: number }): HouseOrigin =>
  HOUSE_ORIGINS[h.origin] ?? "the court";
const ORIGIN = (o: HouseOrigin): number => HOUSE_ORIGINS.indexOf(o);
const surname = (name: string) => name.split(" ").slice(1).join(" ");
const keyOf = (r: Ref) => parseRef(r).b >>> 0;
const per = (x: number) => Math.round(dmath.clamp(x, 0, 1) * 1000);

/** Add to a realm's treasury's reserve (an estate seized or escheated: grain's worth). */
function toTreasury(world: World, realm: Ref, grain: number): void {
  const s = moneyStore(world, TREASURY_STORE),
    row = s?.get(realm);
  if (!s || !row || !(grain > 0)) return;
  const next = [...row];
  next[FISC.reserve] = row[FISC.reserve]! + grain;
  s.set(realm, next);
}

/** The ended house, kept for its realm's page (a few). */
function end(
  v: RealmHouses,
  h: HouseRecord,
  year: number,
  how: HouseEnd,
  event: Ref,
  into?: string,
): void {
  v.houses = v.houses.filter((x) => x !== h);
  v.gone = [
    ...v.gone,
    {
      name: h.name,
      origin: h.origin,
      since: h.since,
      year,
      how,
      ...(into ? { into } : {}),
      event,
    },
  ].slice(-HOUSES.gone);
}

type Facts = {
  readonly ctx: PopulationContext;
  readonly p: Polity;
  readonly v: RealmHouses;
  readonly t: SimTime;
  readonly year: number;
  readonly key: number;
};

/** A house's name in its realm's tongue (as its rulers' families are named: sim/polity crown). */
function nameOf(f: Facts, salt: number): string | null {
  const ways = cultureOf(f.ctx.world).get(f.p.seat);
  if (!ways) return null;
  const u = f.ctx.world.rng.real(DRAW, f.key, f.t, 1000 + salt);
  return tongueName({ ...ways.tongue, seed: ways.tongue.seed ^ 0x51f7 }, Math.floor(u * 1e6));
}

/** A house rises: its record and its event. */
function rise(
  f: Facts,
  name: string,
  origin: HouseOrigin,
  seat: number,
  wealth: number,
  land: number,
  titled: boolean,
  factors: Factor[],
  of?: HouseRecord,
): HouseRecord {
  const { ctx, p, v, year } = f,
    world = ctx.world,
    type =
      origin === "demagogue"
        ? HOUSE_EVENTS.demagogue.type
        : origin === "grifter"
          ? HOUSE_EVENTS.grifter.type
          : origin === "cadet"
            ? HOUSE_EVENTS.parted.type
            : HOUSE_EVENTS.rose.type,
    decision = world.decisions.record({
      rule: "houses.rose",
      subject: p.ref,
      outcome: { house: name, origin },
      score: factors.reduce((s, x) => s + x.contribution, 0),
      threshold: 0,
      factors,
    }),
    event = world.events.emit({
      type,
      subjects: [p.ref],
      place: ctx.provinces.get(seat)?.ref ?? null,
      causes: [
        { ref: decision, role: "trigger", weight: 1 },
        ...(of ? [{ ref: of.event, role: "enabler" as const, weight: 1 }] : []),
      ],
      data: { realm: realmName(p), house: name, origin, ...(of ? { of: of.name } : {}) },
    }),
    grown = ctx.life.adulthood,
    h: HouseRecord = {
      id: v.next++,
      name,
      origin: ORIGIN(origin),
      since: year,
      seat,
      ...(of ? { of: of.id } : {}),
      wealth: Math.round(Math.max(0, wealth)),
      land: Math.round(Math.max(0, land)),
      offices: 0,
      grants: 0,
      farm: 0,
      income: 0,
      power: 0,
      titled: titled ? 1 : 0,
      crown: 0,
      headBorn: year - Math.round(grown * 2),
      generation: 1,
      heirs: 0,
      event,
    };
  v.houses.push(h);
  return h;
}

/** A house's hold ends: told, and its record let go. */
function ended(
  f: Facts,
  h: HouseRecord,
  how: HouseEnd,
  factors: Factor[],
  cause: Ref | null,
  into?: HouseRecord,
): Ref {
  const { ctx, p, v, year } = f,
    world = ctx.world,
    type = {
      purged: HOUSE_EVENTS.purged.type,
      overthrown: HOUSE_EVENTS.overthrown.type,
      wed: HOUSE_EVENTS.wed.type,
      "died out": HOUSE_EVENTS.diedout.type,
      faded: HOUSE_EVENTS.faded.type,
      exposed: HOUSE_EVENTS.exposed.type,
    }[how],
    decision = world.decisions.record({
      rule: `houses.${how === "died out" ? "diedout" : how}`,
      subject: p.ref,
      outcome: { house: h.name, how, ...(into ? { into: into.name } : {}) },
      score: factors.reduce((s, x) => s + x.contribution, 0),
      threshold: 0,
      factors,
    }),
    event = world.events.emit({
      type,
      subjects: [p.ref],
      place: ctx.provinces.get(h.seat)?.ref ?? null,
      causes: [
        { ref: decision, role: "trigger", weight: 1 },
        { ref: h.event, role: "enabler", weight: 1 },
        ...(cause ? [{ ref: cause, role: "trigger" as const, weight: 1 }] : []),
      ],
      data: {
        realm: realmName(p),
        house: h.name,
        origin: originOf(h),
        how,
        since: h.since,
        ...(into ? { into: into.name } : {}),
      },
    });
  end(v, h, year, how, event, into?.name);
  return event;
}

/** A realm's record as first reckoned. */
function fresh(year: number): RealmHouses {
  return {
    last: year,
    selectorate: 0,
    winning: 0,
    all: 0,
    loyalty: 0,
    favours: 0,
    members: [],
    nepotism: 0,
    hereditary: 0,
    rival: 0,
    following: 0,
    grift: 0,
    parted: 0,
    skim: 0,
    rents: 0,
    burden: 0,
    crownEvent: null,
    next: 1,
    houses: [],
    gone: [],
  };
}

/** One realm's houses, stepped `span` years. */
function stepRealm(
  ctx: PopulationContext,
  p: Polity,
  v: RealmHouses,
  span: number,
  t: SimTime,
): void {
  const { world } = ctx,
    year = yearOfMoment(t),
    f: Facts = { ctx, p, v, t, year, key: keyOf(p.ref) },
    o = orderOf(world)?.of(p.ref),
    ways = cultureOf(world).get(p.seat),
    kinship = ways?.traits[WAY.kinship] ?? 0.5,
    keeps = kinship >= REIGN.noHouses,
    held = holdsOf(world, p.ref),
    force = held[HOLD.force] ?? 0.5,
    voice = held[HOLD.voice] ?? 0.3,
    word = held[HOLD.word] ?? 0.5,
    caste = o?.caste ?? 0.3,
    corruption = o?.corruption ?? 0,
    lore = loreOf(world),
    writing = lore.effect(p.seat, "writing") > 0,
    cap = capacityOf(ctx, p).value,
    u = (k: number) => world.rng.real(DRAW, f.key, t, k);

  // 1. Who its ruler must pay.
  const interests = interestsOf(ctx, p, t),
    franchise = chooses(world, p),
    last = franchise ? electionsOf(world)?.of(p.ref)?.past.at(-1) : undefined,
    need = last ? dmath.clamp(last.votes[0]?.[1] ?? HOUSES.needs, 0.2, HOUSES.needs) : HOUSES.needs,
    seat = ctx.provinces.get(p.seat),
    crowd = p.succession === 2 && seat ? adults(seat, ctx.life) * 0.5 : 0,
    // (An interest organised in a party weighs the more in who the ruler must pay, its sway carried by its party: sim/order/
    // groups.ts. Exactly as before where none is.)
    organised = interests.map((i) => orgPartyOf(world, p.ref, i.group)),
    weighed = organised.some((x) => x > 0)
      ? (() => {
          const raw = interests.map((i, k) => i.sway * (1 + ORG.partyWeighs * organised[k]!)),
            all = raw.reduce((s, x) => s + x, 0) || 1;
          return raw.map((x) => x / all);
        })()
      : interests.map((i) => i.sway),
    coalition = coalitionOf(
      interests.map((i, k) => ({ group: i.group, sway: weighed[k]!, heads: i.people })),
      need,
      franchise,
      crowd,
    ),
    favours = privateShare(coalition.winning, coalition.all),
    inside = new Map(coalition.members),
    swayOfGroup = new Map(interests.map((i) => [i.group as string, i.sway]));
  v.selectorate = Math.round(coalition.selectorate);
  v.winning = Math.round(coalition.winning);
  v.all = Math.round(coalition.all);
  v.loyalty = per(coalition.loyalty);
  v.favours = per(favours);
  v.members = coalition.members.map(([g, x]) => [g, per(x)]);

  // 2. What the seat hands out: the skim, offices' pay, licences and farms.
  const fisc = moneyStore(world, TREASURY_STORE)?.get(p.ref),
    duty = moneyStore(world, TARIFF_STORE)?.get(p.ref),
    c = dmath.clamp(corruption, 0, 0.9),
    taken = fisc ? fisc[FISC.take + 1]! + fisc[FISC.take + 2]! + fisc[FISC.take + 3]! : 0,
    market = world.store<MarketStore>("economy.markets").get(p.seat),
    granary = market
      ? Math.floor(market.stock[G.grain]! * corruption * 0.04) * market.price[G.grain]!
      : 0,
    skim = (taken * c) / (1 - c) + granary,
    trade = fisc ? fisc[FISC.base + 1]! / 2 : 0,
    earned = fisc ? fisc[FISC.base + 3]! : 0,
    measured = fisc ? fisc[FISC.measured + 1]! / 1000 : 0,
    tariffs = fisc ? fisc[FISC.tariffs]! : 0,
    imported = trade > 0 ? dmath.clamp((duty?.[DUTY.imports] ?? 0) / trade, 0, 1) : 0,
    licence = writing && trade > 0 ? licensed(favours, cap) : 0,
    farm = tariffs > 0 ? farmedOut(favours, measured) : 0,
    // (A licence's rent is on what its holders sell: no more than its people spend of what they earn, nor than its markets trade,
    // which count a good each time it moves.)
    rent = licence * Math.min(trade, earned) * licenceRent(imported),
    margin = farm * tariffs * HOUSES.farmMargin,
    nepotism = kinInOffice({
      favours,
      examined: writing && !!lore.get(p.seat, "bureaucracy"),
      word,
      caste,
      houses: keeps,
    }),
    officePay = fisc ? fisc[FISC.clerks]! * nepotism : 0;
  v.nepotism = per(nepotism);
  v.skim = Math.round(skim);
  v.rents = Math.round(rent + margin);

  // 3. A change at the seat since it was last reckoned: who now rules, and how they came to.
  const family = surname(p.ruler.name),
    changed = v.crownEvent !== null && v.crownEvent !== p.ruler.event,
    came = changed ? world.events.get(p.ruler.event) : undefined;
  if (came?.type === "strife.revolution") {
    // (The many overthrow the court: the ruler's house and every titled house are done; the rest keep what they hold
    // but their offices, licences and farms, and half their land goes to those who till it.)
    for (const h of [...v.houses])
      if (h.crown || h.titled)
        ended(
          f,
          h,
          "overthrown",
          [
            {
              name: "the many rose and overthrew the court",
              value: 1,
              contribution: 1,
              source: { ref: came.id, role: "trigger", weight: 1 },
            },
          ],
          came.id,
        );
      else {
        h.offices = 0;
        h.grants = 0;
        h.farm = 0;
        h.land = Math.round(h.land / 2);
      }
  }
  // (The ruler's family's house holds the seat: its main line, or a cadet line where the main is gone.)
  const ruling =
    keeps && family !== ""
      ? (v.houses.find((h) => h.name === family && originOf(h) !== "cadet") ??
        v.houses.find((h) => h.name === family))
      : undefined;
  for (const h of v.houses) h.crown = h === ruling ? 1 : 0;
  if (keeps && family !== "" && !v.houses.some((h) => h.crown)) {
    if (v.houses.length >= HOUSES.most) dropWeakest(f);
    const h = rise(
      f,
      family,
      came?.type === "strife.coup" ? "the army" : "crown",
      p.seat,
      HOUSES.stakeYears * (skim * crownKeep(coalition.loyalty) + officePay / 4),
      landAtRise(world, p.seat, v),
      caste >= HOUSES.titled,
      [
        {
          name: "the family that holds the seat",
          value: 1,
          contribution: 1,
          source: { ref: p.ruler.event, role: "trigger", weight: 1 },
        },
      ],
    );
    h.crown = 1;
  }
  v.crownEvent = p.ruler.event;

  // 4. Houses of the groups great in the coalition, where its people keep houses.
  if (keeps)
    for (const [group, part] of coalition.members) {
      const share = ((swayOfGroup.get(group) ?? 0) * part) / Math.max(1e-6, need),
        origin = group as HouseOrigin;
      if (share < HOUSES.riseLeast || !HOUSE_ORIGINS.includes(origin)) continue;
      if (v.houses.some((h) => originOf(h) === origin)) continue;
      if (v.houses.length >= HOUSES.most) break;
      const name = nameOf(f, ORIGIN(origin));
      if (!name || v.houses.some((h) => h.name === name)) continue;
      const home = LANDED_HOUSES.has(origin) ? richestLand(world, p) : p.seat;
      rise(
        f,
        name,
        origin,
        home,
        HOUSES.stakeYears *
          ((skim * (1 - crownKeep(coalition.loyalty)) * favours + officePay) * share +
            landRent(world, home, LANDED_HOUSES.has(origin) ? landAtRise(world, home, v) : 0)),
        LANDED_HOUSES.has(origin) ? landAtRise(world, home, v) : 0,
        caste >= HOUSES.titled,
        [
          {
            name: `the ${group}' share of the sway its ruler must hold`,
            value: Math.round(share * 100) / 100,
            contribution: share,
            source: null,
          },
          {
            name: "a people who count kin",
            value: Math.round(kinship * 100) / 100,
            contribution: kinship - REIGN.noHouses,
            source: null,
          },
        ],
      );
    }

  // 5. Those who rise from outside: a demagogue on grievance, a grifter on the skim.
  let people = 0,
    sore = 0;
  for (const m of p.members) {
    const n = ctx.provinces.get(m)?.total() ?? 0;
    people += n;
    sore += n * Math.min(1, politiesOf(world).discontent(m).level);
  }
  const grievance = people > 0 ? sore / people : 0,
    taxed = taxGrievance(world, p.ref),
    gini = giniOf(world, p.seat) ?? 0.35,
    legitimacy = o?.legitimacy ?? 0.5,
    wanted = followingWanted({ grievance, taxed, unequal: gini, word, legitimacy }),
    following =
      v.following / 1000 + (wanted - v.following / 1000) * stepped(HOUSES.following, span),
    justice = o?.laws[LAW_OF.justice] ?? 1,
    griftAim = griftWanted(corruption, cap, !!lore.get(p.seat, "currency"), justice),
    grift = v.grift / 1000 + (griftAim - v.grift / 1000) * stepped(HOUSES.following, span);
  v.following = per(following);
  v.grift = per(grift);
  const demagogue = v.houses.find((h) => originOf(h) === "demagogue"),
    grifter = v.houses.find((h) => originOf(h) === "grifter");
  if (demagogue && following < HOUSES.endFollowing)
    ended(
      f,
      demagogue,
      "faded",
      [
        {
          name: "a following that fell away",
          value: following,
          contribution: -following,
          source: null,
        },
      ],
      null,
    );
  else if (!demagogue && following >= HOUSES.riseFollowing) {
    if (v.houses.length >= HOUSES.most) dropWeakest(f);
    const name = nameOf(f, 77);
    if (name && !v.houses.some((h) => h.name === name))
      rise(f, name, "demagogue", p.seat, 0, 0, false, [
        { name: "grievance in its lands", value: grievance, contribution: grievance, source: null },
        { name: "taxes beyond what is borne", value: taxed, contribution: 2 * taxed, source: null },
        {
          name: "wealth held by few",
          value: gini,
          contribution: Math.max(0, gini - 0.35),
          source: null,
        },
        { name: "word that carries", value: word, contribution: 0.3 + 0.7 * word, source: null },
        { name: "a rule doubted", value: legitimacy, contribution: 1.3 - legitimacy, source: null },
      ]);
  }
  if (grifter && grift < HOUSES.endGrift)
    ended(
      f,
      grifter,
      "exposed",
      [
        { name: "less skimmed", value: corruption, contribution: -corruption, source: null },
        { name: "a reach that watches its offices", value: cap, contribution: cap, source: null },
      ],
      null,
    );
  else if (!grifter && grift >= HOUSES.riseGrift) {
    if (v.houses.length >= HOUSES.most) dropWeakest(f);
    const name = nameOf(f, 78);
    if (name && !v.houses.some((h) => h.name === name))
      rise(f, name, "grifter", p.seat, 0, 0, false, [
        {
          name: "what is skimmed",
          value: corruption,
          contribution: 1.5 * corruption,
          source: null,
        },
        {
          name: "a reach too thin to watch its offices",
          value: cap,
          contribution: 1 - cap,
          source: null,
        },
      ]);
  }
  // (A demagogue who carries more of its people than those chosen to govern is taken into the seat's favour.)
  const dem = v.houses.find((h) => originOf(h) === "demagogue");
  if (dem && last && !dem.office && following > (last.votes[0]?.[1] ?? 1)) {
    dem.office = 1;
    world.events.emit({
      type: HOUSE_EVENTS.office.type,
      subjects: [p.ref],
      place: ctx.provinces.get(p.seat)?.ref ?? null,
      causes: [
        { ref: dem.event, role: "trigger", weight: 1 },
        { ref: last.event, role: "enabler", weight: 1 },
      ],
      data: { realm: realmName(p), house: dem.name, share: per(following) / 1000 },
    });
  }

  // 6. What each house takes in, and holds.
  const isIn = (h: HouseRecord) =>
      !!h.crown ||
      inside.has(originOf(h)) ||
      originOf(h) === "grifter" ||
      (originOf(h) === "cadet" && h.titled === 1) ||
      (originOf(h) === "demagogue" && !!h.office),
    // (A demagogue brings its following to bear, as a share of all the houses hold.)
    allHeld = Math.max(
      1,
      v.houses.reduce((s, h) => s + h.wealth, 0),
    ),
    courted = courtedShares(
      v.houses.map((h) => ({
        wealth: h.wealth + (originOf(h) === "demagogue" ? following * allHeld : 0),
        inside: isIn(h),
        titled: !!h.titled,
      })),
      caste,
    ),
    griftTake = v.houses.some((h) => originOf(h) === "grifter") ? skim * grift : 0,
    left = Math.max(0, skim - griftTake),
    keep = crownKeep(coalition.loyalty),
    others = v.houses.map((h, i) => (h.crown ? 0 : courted[i]!)),
    othersSum = others.reduce((s, x) => s + x, 0),
    fade = 1 - dmath.pow(1 - HOUSES.spends, span),
    stays = 1 - fade;
  let rents = 0;
  for (const [i, h] of v.houses.entries()) {
    const share = courted[i]!,
      favour = othersSum > 0 ? others[i]! / othersSum : 0;
    h.offices = per(nepotism * share);
    h.grants = per(licence * share);
    h.farm = per(farm * share);
    const income =
      (h.crown ? keep * left : 0) +
      left * (1 - keep) * favours * favour +
      officePay * share +
      (rent + margin) * share +
      landRent(world, h.seat, h.land) +
      (originOf(h) === "grifter" ? griftTake : 0);
    rents += (rent + margin) * share;
    h.income = Math.round(income);
    // (What it holds, spent of a share a year and added to by what it takes in, over the years since last reckoned.)
    h.wealth = Math.round(h.wealth * stays + (income * fade) / HOUSES.spends);
  }
  v.burden = earned > 0 ? per((rents + griftTake) / earned) : 0;
  // (What its people are used to bearing comes a share of the way to what they bear, a year.)
  const usedWas = (v.used ?? 0) / 1000;
  v.used = per(usedWas + (v.burden / 1000 - usedWas) * stepped(HOUSES.inured, span));

  // 7. Each line's head ages and dies; its heirs.
  const life = ctx.life,
    expected = heirsExpected(life),
    generation = generationOf(life),
    open = (moneyStore(world, BIND_STORE)?.at(p.seat, BIND.open) ?? 0) / 1000,
    share = parted(caste, open, kinship);
  v.parted = per(share);
  const greatest = () => Math.max(1, ...v.houses.map((h) => h.wealth));
  for (const h of [...v.houses]) {
    if (!v.houses.includes(h)) continue;
    const age = year - h.headBorn;
    if (!(u(h.id * 16 + 1) < diesWithin(life, age, span))) continue;
    // (The ruling house's line is its court's to tell, heir by heir (sim/court): it does not die out while it holds the seat.)
    const drawn = keeps ? heirsFor(expected, u(h.id * 16 + 2)) : 0,
      heirs = h.crown ? Math.max(1, drawn) : drawn;
    h.heirs = heirs;
    h.generation++;
    h.headBorn = Math.min(year - life.adulthood, h.headBorn + Math.round(generation));
    if (originOf(h) === "demagogue" || originOf(h) === "grifter") {
      // (One risen from outside leaves no claim: what they gathered goes with them.)
      if (heirs === 0 || u(h.id * 16 + 3) < 0.5)
        ended(
          f,
          h,
          "faded",
          [{ name: "its head dead", value: age, contribution: 1, source: null }],
          null,
        );
      continue;
    }
    if (heirs === 0) {
      // (Dead out: its estate escheats to the crown.)
      const crown = v.houses.find((x) => x.crown && x !== h);
      toTreasury(world, p.ref, h.wealth);
      if (crown && crown.seat === h.seat) crown.land = Math.min(1000, crown.land + h.land);
      ended(
        f,
        h,
        "died out",
        [
          {
            name: "heirs its people's lives give a line",
            value: Math.round(expected * 100) / 100,
            contribution: -expected,
            source: null,
          },
        ],
        null,
      );
      continue;
    }
    // (An only heir of a lesser line weds into a greater: half the time it is the one who takes the other's name.)
    const into = [...v.houses]
      .filter((x) => x !== h && originOf(x) !== "demagogue" && originOf(x) !== "grifter")
      .sort((a, b) => b.crown - a.crown || b.wealth - a.wealth || a.id - b.id)[0];
    // (A god's whisper to the house: to wed, it weds where it may; to stand alone, it does not. Exactly an even chance where none.)
    const whispered = whisperIn(world, `dyn:${p.ref}:${h.event}`, null, year, "wed"),
      weds = whispered ? (whispered.aim === "wed" ? 1 : 0) : 0.5;
    if (
      heirs === 1 &&
      !h.crown &&
      into &&
      h.wealth < HOUSES.wedBelow * greatest() &&
      u(h.id * 16 + 4) < weds
    ) {
      into.wealth += h.wealth;
      if (into.seat === h.seat) into.land = Math.min(1000, into.land + h.land);
      const wed = ended(
        f,
        h,
        "wed",
        [
          { name: "an only heir", value: 1, contribution: 1, source: null },
          {
            name: "a lesser line beside a greater",
            value: Math.round((h.wealth / greatest()) * 100) / 100,
            contribution: HOUSES.wedBelow - h.wealth / greatest(),
            source: { ref: into.event, role: "enabler", weight: 1 },
          },
        ],
        null,
        into,
      );
      if (whispered) spend(whispered, wed);
      continue;
    }
    // (The estate parted among the heirs, or kept whole for one; a cadet line where the younger's part is great enough.)
    if (heirs >= 2 && share > 0) {
      const part = (share * (heirs - 1)) / heirs,
        wealth = h.wealth * part,
        land = Math.round(h.land * part);
      h.wealth = Math.round(h.wealth - wealth);
      h.land -= land;
      if (v.houses.length < HOUSES.most && wealth >= HOUSES.cadetLeast * h.wealth)
        rise(
          f,
          h.name,
          "cadet",
          h.seat,
          wealth,
          land,
          !!h.titled,
          [
            {
              name: "an estate parted among heirs",
              value: Math.round(share * 100) / 100,
              contribution: share,
              source: { ref: h.event, role: "enabler", weight: 1 },
            },
            { name: "heirs", value: heirs, contribution: heirs - 1, source: null },
          ],
          h,
        );
    }
  }

  // 8. Power, and a crown that keeps the arms purging one grown too near its own.
  const wealthAll = Math.max(
      1,
      v.houses.reduce((s, h) => s + h.wealth, 0),
    ),
    officesAll = Math.max(
      1,
      v.houses.reduce((s, h) => s + h.offices, 0),
    );
  for (const h of v.houses) {
    const origin = originOf(h);
    let power = 0.6 * (h.wealth / wealthAll) + 0.4 * (h.offices / officesAll);
    if (origin === "the army") power *= 1 + force;
    if (origin === "demagogue") power = Math.max(power, following);
    if (h.crown) power += 0.5 * force * cap;
    h.power = per(power);
  }
  const crown = v.houses.find((h) => h.crown),
    crownPower = crown ? crown.power / 1000 : 0.5 * force * cap,
    rivals = v.houses.filter((h) => !h.crown).sort((a, b) => b.power - a.power || a.id - b.id);
  v.rival = per(rivalWeight(rivals[0] ? rivals[0].power / 1000 : 0, crownPower));
  for (const h of rivals) {
    const a = purgeChance(h.power / 1000, crownPower, force, voice),
      chance = 1 - dmath.pow(1 - a, span);
    if (!(chance > 0 && u(h.id * 16 + 5) < chance)) continue;
    toTreasury(world, p.ref, h.wealth * HOUSES.seized);
    if (crown && crown.seat === h.seat) crown.land = Math.min(1000, crown.land + h.land);
    ended(
      f,
      h,
      "purged",
      [
        {
          name: "its power beside the crown's",
          value: Math.round((h.power / 1000 / Math.max(1e-6, crownPower)) * 100) / 100,
          contribution: h.power / 1000 / Math.max(1e-6, crownPower) - HOUSES.purgeAt,
          source: { ref: h.event, role: "pressure", weight: 1 },
        },
        { name: "arms kept to the seat", value: force, contribution: force, source: null },
        {
          name: "a choice carried by few",
          value: voice,
          contribution: 1 - voice,
          source: o?.heldEvents?.[HOLD.voice]
            ? { ref: o.heldEvents[HOLD.voice]!, role: "enabler", weight: 1 }
            : null,
        },
      ],
      null,
    );
    break;
  }
  v.hereditary = Math.min(
    1000,
    v.houses.reduce((s, h) => s + (h.titled ? h.offices : 0), 0),
  );
  v.last = year;
}

/** Where a house is let go of account to make room: the least of those not holding the seat ("faded" from the great). */
function dropWeakest(f: Facts): void {
  const weakest = [...f.v.houses]
    .filter((h) => !h.crown)
    .sort((a, b) => a.wealth - b.wealth || a.id - b.id)[0];
  if (weakest)
    ended(
      f,
      weakest,
      "faded",
      [
        {
          name: "the least of the great houses",
          value: weakest.wealth,
          contribution: 0,
          source: null,
        },
      ],
      null,
    );
}

/** A land's rent a year (grain's worth), and a house's share of it. */
function landRent(world: World, cell: number, land: number): number {
  return ((moneyStore(world, SHARES_STORE)?.at(cell, SHARE.rent) ?? 0) * land) / 1000;
}

/** What of a land's rent a landed house rising takes (thousandths): a share of what its richest tenth hold, past those already seated there. */
function landAtRise(world: World, cell: number, v: RealmHouses): number {
  const top = moneyStore(world, SHARES_STORE)?.at(cell, SHARE.top) ?? 300,
    held = v.houses.filter((h) => h.seat === cell).reduce((s, h) => s + h.land, 0);
  return Math.max(0, Math.min(Math.round(top / 3), 900 - held));
}

/** The member land whose fields give the most rent (where a landed house is seated). */
function richestLand(world: World, p: Polity): number {
  const shares = moneyStore(world, SHARES_STORE);
  let best = p.seat,
    most = -1;
  for (const c of p.members) {
    const r = shares?.at(c, SHARE.rent) ?? 0;
    if (r > most) {
      most = r;
      best = c;
    }
  }
  return best;
}

/**
 * 188.order.houses, a year: each realm in its turn (its ref's number and the year, HOUSES.every), stepped as many years as since it
 * was last; a realm not yet reckoned at once. And each year, the rents its houses take breed grievance in its lands.
 */
export function housesYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = housesOf(world);
  if (!store) return;
  const year = yearOfMoment(t),
    living = politiesOf(world).living();
  if (year % 10 === 0) {
    const alive = new Set(living.map((p) => p.ref));
    for (const r of store.realmsKept()) if (!alive.has(r)) store.forget(r);
  }
  for (const p of living) {
    const was = store.of(p.ref);
    if (!was || (refNumber(p.ref) + year) % HOUSES.every === 0) {
      const v: RealmHouses = was ? copyOf(was) : fresh(year),
        span = was ? Math.max(1, Math.min(50, year - was.last)) : 1;
      stepRealm(ctx, p, v, span, t);
      store.put(p.ref, v);
    }
    // (The rents its houses take, as last reckoned, breed grievance in its lands year by year.)
    const now = store.of(p.ref);
    // (A burden its people have long borne chafes the less: the most of it is what they bear past what they are used to.)
    const chafes = now ? rentChafes(now.burden / 1000, (now.used ?? 0) / 1000) : 0;
    if (now && chafes > 0) {
      const cause = [...now.houses].sort(
        (a, b) => b.grants + b.farm - a.grants - a.farm || a.id - b.id,
      )[0];
      if (cause)
        for (const c of p.members) grieve(world, c, HOUSES.rentGrieves * chafes, cause.event);
    }
  }
}

/** A realm's record, copied to be stepped (the store's own is set back whole, and folded into its digest). */
function copyOf(v: Readonly<RealmHouses>): RealmHouses {
  return {
    ...v,
    members: v.members.map(([g, x]) => [g, x]),
    houses: v.houses.map((h) => ({ ...h })),
    gone: [...v.gone],
  };
}

/** Register the houses on a peopled world (sim/order/order.ts installOrder). */
export function installHouses(world: World, ctx: () => PopulationContext): HouseStore {
  const store = world.register(new HouseStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "188.order.houses", every: YEAR, run: (t) => housesYear(ctx(), t) });
  return store;
}
