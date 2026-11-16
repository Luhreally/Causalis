// One person read whole (round G, the individual): who someone the game names is, from their ref, and what their land, their home
// and their own seed make of them — what they are like, what they want, the work of their life, what they own and owe (rules/self.ts).
// History counts people by land and by work and keeps no one's purse or temper: a person is read here when they are looked at, from
// what history already holds of their land and from a key of their own (the key their name and their family are drawn from), so the
// same person read twice is the same person and nothing per person enters the world's year. Readings are kept in bounded caches,
// one per world, let go whole when they grow past their bound or the year turns.
import { YEAR, finish, hashString, mix, type Ref, type World } from "../kernel/index.ts";
import {
  DAY_WAGE,
  FAMILY_SIZE,
  G,
  GOODS,
  HOME_COST,
  MIDDLE_WAYS,
  OCC,
  WAGE_GOOD,
  careerOf,
  levelOf,
  crimeLean,
  holdingsOf,
  pairingOf,
  partnersOf,
  priceTerm,
  reckonDay,
  selfNature,
  traitsOf,
  usualPrice,
  wantsOf,
  type CareerStep,
  type CrimeKind,
  type CrimeScene,
  type Holdings,
  type Nature,
  type Pairing,
  type SelfTraits,
  type SelfWays,
  type Want,
} from "../rules/index.ts";
import {
  WAY,
  agentName,
  beliefOf,
  courtOf,
  creditOf,
  cultureOf,
  handOf,
  homePlanet,
  lawOf,
  lifeOf,
  marketsOf,
  orderOf,
  politiesOf,
  populationContext,
  wayOf,
  type Settlement,
} from "../sim/index.ts";
import { observer } from "../causal/index.ts";
import { parseSeatRef, parseTownsfolkRef } from "../bridge/index.ts";
import { breadCoin, landMadeHead, personLiving, rentOf } from "./home.ts";
import { folkWork, townRoster, workOf } from "./roster.ts";
import { familyOf, pairingOfWorld, seatHolder } from "./kin.ts";
import { seatTownOf } from "./leaders.ts";
import { landEra } from "./village.ts";
import { memoryOf } from "./inspect/memory.ts";

/** What someone is to their world: one of a town's many, a maker at a seat, a ruler, one of a court, one under the hand, one met. */
export type Station = "many" | "maker" | "ruler" | "court" | "hand" | "met";

/** Who someone is, as their ref and history tell it. */
export type Who = {
  readonly ref: string;
  readonly name: string;
  /** Their own key: what they are drawn from that their land is not. */
  readonly key: number;
  readonly sex: 0 | 1;
  readonly born: number;
  readonly alive: boolean;
  /** The year they are read in: now, or the year they died or left. */
  readonly year: number;
  readonly cell: number;
  readonly town: string | null;
  readonly station: Station;
  /** Their work then (an OCC; 0 a child), and the trade they keep where it is named. */
  readonly occupation: number;
  readonly trade: string | null;
  /** The year they took the seat, the reign or the line they hold, where history says (null: it doesn't). */
  readonly since: number | null;
  /** Their station's own standing (a ruler 1, one of a court 0.85; else 0). */
  readonly rank: number;
  /** One the god lives: their own purse, skill and standing. */
  readonly lived: {
    readonly purse: number;
    readonly skill: number;
    readonly standing: number;
    readonly owned: boolean;
  } | null;
};

/** What their land is, as a person reads it, in a year. */
export type LandSelf = {
  readonly cell: number;
  readonly year: number;
  readonly ways: SelfWays;
  readonly nature: Nature;
  readonly pairing: Pairing;
  readonly adulthood: number;
  readonly span: number;
  /** Its leanest month's share of what it needed, last year. */
  readonly fed: number;
  /** Its stores at usual worth a head (coin), less what it owes; what it owes the houses a head; each good's worth a head. */
  readonly worthHead: number;
  readonly owedHead: number;
  readonly goods: readonly number[];
  readonly madeHead: number;
  readonly bread: number;
  /** How its realm's wealth is owned, and its order. */
  readonly realm: Ref | null;
  readonly spread: number;
  readonly common: number;
  readonly caste: number;
  readonly legitimacy: number;
  readonly corruption: number;
  /** Its law of land's position (-1: no realm's law). */
  readonly landLaw: number;
  /** It keeps a faith; its realm forbids it. */
  readonly faith: boolean;
  readonly barred: boolean;
  readonly lettered: boolean;
  readonly learned: number;
  /** War, raids and strikes on it in the last three years, 0 … 1. */
  readonly danger: number;
  readonly lawless: number;
};

/** One person read whole. */
export type SelfRead = {
  readonly who: Who;
  readonly land: LandSelf;
  readonly age: number;
  readonly child: boolean;
  /** Their household's place in their land, 0 … 1, and whether it is their home's own (the town drawn) or their key's. */
  readonly standing: number;
  readonly drawn: boolean;
  readonly traits: SelfTraits;
  /** How hungry and how dangerous their young years were. */
  readonly youth: { readonly hunger: number; readonly danger: number };
  readonly wants: readonly Want[];
  readonly career: readonly CareerStep[];
  readonly holdings: Holdings;
  /** Their household: its mouths, their partners, their living young; what is left of its day (coin) and its rent. */
  readonly mouths: number;
  readonly partners: number;
  readonly young: number;
  readonly left: number;
  readonly rent: number;
};

const u = (seed: number, n: number): number => finish(mix(seed, n), 13) / 4294967296;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// —— Who ——————————————————————————————————————————————————————————————————————————————————————————————————————————

const OCC_OF_TRADE: Readonly<Record<string, number>> = { healer: OCC.crafter };

/** Who a ref is (null: no one the game names, or no longer to be found). */
export function whoOf(world: World, ref: string): Who | null {
  const ctx = populationContext(world),
    now = Math.floor(world.now / YEAR),
    grown = lifeOf(world).adulthood;
  if (ref.startsWith("folk:town:")) {
    const at = parseTownsfolkRef(ref),
      s = at ? ctx.settlements.get(at.town as Ref) : undefined;
    if (!at || !s) return null;
    const roster = townRoster(world, s.ref),
      h = at.n === null ? roster.holder(at.line) : roster.holderOf(at.line, at.n);
    if (!h) return null;
    const holds = roster.holder(h.line)?.n === h.n,
      year = holds ? now : (h.died ?? Math.min(now, h.end - 1));
    return {
      ref: h.ref,
      name: roster.nameOf(h),
      key: h.key,
      sex: h.sex,
      born: h.born,
      alive: holds,
      year,
      cell: s.cell,
      town: s.ref,
      station: "many",
      occupation: year - h.born < grown ? OCC.dependent : workOf(h.key, folkWork(world, s.cell)),
      trade: null,
      since: null,
      rank: 0,
      lived: null,
    };
  }
  if (ref.startsWith("agent:")) {
    const id = Number(ref.slice("agent:".length)),
      w = handOf(world).resting,
      a = w?.agents.find((x) => x.id === id);
    if (!w || !a) return null;
    const life = w.life && w.life.agent === id && !w.life.ended ? w.life : null;
    return {
      ref,
      name: agentName(ctx, a, ctx.settlements.get(w.village)!),
      key: hashString(`agent ${w.village} ${id}`) >>> 0,
      sex: a.sex === 0 ? 0 : 1,
      born: a.birthYear,
      alive: true,
      year: now,
      cell: w.cell,
      town: w.village,
      station: "hand",
      occupation: now - a.birthYear < grown ? OCC.dependent : a.occupation,
      trade: null,
      since: null,
      rank: 0,
      lived: life
        ? {
            purse: life.purse,
            skill: life.skill,
            standing: life.standing / 100,
            owned: life.owned,
          }
        : null,
    };
  }
  if (ref.startsWith("rule:")) {
    const r = politiesOf(world).get(ref.slice("rule:".length) as Ref);
    if (!r) return null;
    const town = seatTownOf(world, r);
    return {
      ref,
      name: r.ruler.name,
      key: hashString(`rule ${r.ref} ${r.ruler.event}`) >>> 0,
      sex: r.ruler.sex === 0 ? 0 : 1,
      born: r.ruler.born,
      alive: r.ended === null,
      year: r.ended ?? now,
      cell: r.seat,
      town: town?.ref ?? null,
      station: "ruler",
      occupation: OCC.leader,
      trade: null,
      since: r.ruler.since,
      rank: 1,
      lived: null,
    };
  }
  if (ref.startsWith("court:")) {
    const at = ref.lastIndexOf(":"),
      r = politiesOf(world).get(ref.slice("court:".length, at) as Ref),
      id = Number(ref.slice(at + 1)),
      c = r ? courtOf(world)?.of(r.ref) : undefined,
      f = c?.figures.find((x) => x.id === id),
      gone = f ? undefined : c?.gone.find((x) => x.id === id);
    const fig = f ?? gone;
    if (!r || !fig) return null;
    const town = seatTownOf(world, r),
      goneYear = gone && "year" in gone ? (gone as { year?: number }).year : undefined;
    return {
      ref,
      name: fig.name,
      key: hashString(`court ${ref}`) >>> 0,
      sex: fig.sex === 0 ? 0 : 1,
      born: fig.born,
      alive: !!f && r.ended === null,
      year: f ? now : (goneYear ?? now),
      cell: r.seat,
      town: town?.ref ?? null,
      station: "court",
      occupation: OCC.leader,
      trade: null,
      since: "since" in fig ? (fig as { since: number }).since : null,
      rank: 0.85,
      lived: null,
    };
  }
  if (ref.startsWith("prsn:")) {
    const p = observer(world).person(ref as Ref);
    if (!p) return null;
    const year = p.alive ? now : (p.diedYear ?? now);
    return {
      ref,
      name: `${p.name} ${p.surname}`,
      key: hashString(`prsn ${p.ref}`) >>> 0,
      sex: p.sex === 0 ? 0 : 1,
      born: p.birthYear,
      alive: p.alive,
      year,
      cell: p.cell,
      town: p.village,
      station: "met",
      occupation: year - p.birthYear < grown ? OCC.dependent : p.occupation,
      trade: null,
      since: null,
      rank: 0,
      lived: null,
    };
  }
  const seat = ref.startsWith("heal:")
    ? { town: ref.slice("heal:".length), trade: "healer", seat: 0 }
    : parseSeatRef(ref);
  if (seat) {
    const h = seatHolder(world, seat.town, seat.trade, seat.seat);
    if (!h) return null;
    return {
      ref,
      name: h.name,
      key: h.key,
      sex: h.sex,
      born: h.born,
      alive: true,
      year: now,
      cell: h.cell,
      town: seat.town,
      station: "maker",
      occupation: OCC_OF_TRADE[seat.trade] ?? OCC.crafter,
      trade: seat.trade,
      since: now - h.years,
      rank: 0,
      lived: null,
    };
  }
  return null;
}

// —— Their land ———————————————————————————————————————————————————————————————————————————————————————————————————

const LANDS = new WeakMap<World, Map<string, LandSelf>>();
const LANDS_MOST = 512;

const ERA_LEARNED: Readonly<Record<string, number>> = {
  forage: 0.1,
  farm: 0.3,
  metal: 0.5,
  industry: 0.75,
  modern: 0.95,
};

/** What a land is to its people in a year (the record's last year before it, where history keeps one). */
export function landSelf(world: World, cell: number, year: number): LandSelf {
  let m = LANDS.get(world);
  if (!m) LANDS.set(world, (m = new Map()));
  const key = `${cell}|${year}|${Math.floor(world.now / YEAR)}`,
    hit = m.get(key);
  if (hit) return hit;
  const made = readLand(world, cell, year);
  if (m.size >= LANDS_MOST) m.clear();
  m.set(key, made);
  return made;
}

function readLand(world: World, cell: number, year: number): LandSelf {
  const ctx = populationContext(world),
    life = lifeOf(world),
    body = homePlanet(world).generated.life.people?.body,
    nature = selfNature(body),
    traits = cultureOf(world).get(cell)?.traits,
    ways: SelfWays = traits
      ? {
          kinship: traits[WAY.kinship] ?? 0.5,
          hierarchy: traits[WAY.hierarchy] ?? 0.5,
          piety: traits[WAY.piety] ?? 0.5,
          valour: traits[WAY.valour] ?? 0.5,
          trade: traits[WAY.trade] ?? 0.5,
          openness: traits[WAY.openness] ?? 0.5,
          tradition: traits[WAY.tradition] ?? 0.5,
          thrift: traits[WAY.thrift] ?? 0.5,
        }
      : MIDDLE_WAYS,
    ledger = ctx.history.yearsOf(cell),
    rec = ledger.findLast((y) => y.year <= year - 1),
    fed = rec ? rec.fed / 1000 : 1,
    people = ctx.provinces.get(cell)?.total() ?? 0,
    market = marketsOf(world).get(cell),
    goods = GOODS.map((g, i) =>
      people > 0 ? (Math.max(0, market?.stock[i] ?? 0) * g.value) / people : 0,
    ),
    stores = goods.reduce((a, b) => a + b, 0);
  let owed = 0;
  for (const loan of creditOf(world)?.loans ?? [])
    if (loan.ended === null && loan.cell === cell) owed += loan.owed;
  const owedHead = people > 0 ? owed / people : 0,
    realm = politiesOf(world).of(cell),
    order = realm ? orderOf(world)?.of(realm.ref) : undefined,
    way = realm ? wayOf(world, realm.ref) : null,
    belief = beliefOf(world).of(cell),
    seatFaith = realm ? beliefOf(world).of(realm.seat).faith : null,
    barred =
      !!order &&
      lawOf(order, "faith").position === 0 &&
      !!belief.faith &&
      !!seatFaith &&
      belief.faith !== seatFaith,
    // (What befell the land in the three years before: its battles, raids, fires and risings.)
    deeds = memoryOf(world).byCell.get(cell) ?? [],
    struck = deeds.filter(
      (d) => d.year < year && d.year >= year - 3 && DANGER_KINDS.has(d.kind),
    ).length,
    grain = market?.price[G.grain] ?? usualPrice(G.grain);
  return {
    cell,
    year,
    ways,
    nature,
    pairing: pairingOf(body, life.adulthood),
    adulthood: life.adulthood,
    span: body?.span ?? 70,
    fed,
    worthHead: Math.max(0, stores - owedHead),
    owedHead,
    goods,
    madeHead: landMadeHead(world, cell),
    bread: breadCoin(grain),
    realm: realm?.ref ?? null,
    spread: way ? way[3]! : 0.5,
    common: way ? way[4]! : 0.2,
    caste: order?.caste ?? 0.3,
    legitimacy: order?.legitimacy ?? 0.5,
    corruption: order?.corruption ?? 0,
    landLaw: order ? lawOf(order, "land").position : -1,
    faith: !!belief.faith,
    barred,
    lettered: loreOfWriting(world, cell),
    learned: ERA_LEARNED[landEra(world, cell)] ?? 0.3,
    danger: clamp01(0.35 * struck),
    lawless: !realm
      ? 0.5
      : clamp01(1.5 * (0.5 - (order?.legitimacy ?? 0.5)) + 0.6 * (order?.corruption ?? 0)),
  };
}

const DANGER_KINDS: ReadonlySet<string> = new Set(["battle", "struck", "fire", "rising", "fall"]);
const HARD_KINDS: ReadonlySet<string> = new Set(["hunger", "plague"]);

function loreOfWriting(world: World, cell: number): boolean {
  const era = landEra(world, cell);
  return era !== "forage" && era !== "farm";
}

/** How hungry and dangerous a land's years from `from` to `to` were (each 0 … 1), by what its people remember of them. */
export function yearsOn(
  world: World,
  cell: number,
  from: number,
  to: number,
): { readonly hunger: number; readonly danger: number } {
  const memory = memoryOf(world);
  let kept = YEARS_ON.get(memory);
  if (!kept) YEARS_ON.set(memory, (kept = new Map()));
  const at = `${cell}|${from}|${to}`,
    hit = kept.get(at);
  if (hit) return hit;
  const made = readYearsOn(memory.byCell.get(cell) ?? [], from, to);
  if (kept.size >= 8192) kept.clear();
  kept.set(at, made);
  return made;
}

const YEARS_ON = new WeakMap<object, Map<string, { hunger: number; danger: number }>>();

function readYearsOn(
  deeds: readonly { readonly year: number; readonly kind: string }[],
  from: number,
  to: number,
): { hunger: number; danger: number } {
  let hard = 0,
    danger = 0;
  for (const d of deeds) {
    if (d.year < from || d.year >= to) continue;
    if (HARD_KINDS.has(d.kind)) hard++;
    else if (DANGER_KINDS.has(d.kind)) danger++;
  }
  // (Years, not events: a long hunger is one deed, a war of many battles many.)
  const span = Math.max(1, to - from);
  return {
    hunger: clamp01((hard * 3) / span + (hard ? 0.25 : 0)),
    danger: clamp01((danger * 1.5) / span + (danger ? 0.15 : 0)),
  };
}

// —— One person, whole ——————————————————————————————————————————————————————————————————————————————————————————

const SELVES = new WeakMap<World, { year: number; map: Map<string, SelfRead | null> }>();
const SELVES_MOST = 2048;

/**
 * Someone the game names, read whole (null: no one). `deep`: their home is looked for in the town drawn (a page asks so; a list of
 * many reads each by their key alone).
 */
export function selfOf(world: World, ref: string, deep = true): SelfRead | null {
  const year = Math.floor(world.now / YEAR);
  let kept = SELVES.get(world);
  if (!kept || kept.year !== year) SELVES.set(world, (kept = { year, map: new Map() }));
  const key = `${ref}|${deep ? 1 : 0}`;
  if (kept.map.has(key)) return kept.map.get(key)!;
  const who = whoOf(world, ref),
    made = who ? readSelf(world, who, deep) : null;
  if (kept.map.size >= SELVES_MOST) kept.map.clear();
  kept.map.set(key, made);
  return made;
}

/** A day's wage of a work at a land's prices, at its usual (coin). */
function wageAt(world: World, cell: number, occupation: number): number {
  const good = WAGE_GOOD[occupation] ?? -1,
    m = marketsOf(world).get(cell),
    ratio = good >= 0 ? (m?.price[good] ?? usualPrice(good)) / GOODS[good]!.value : 1;
  return (DAY_WAGE[occupation] ?? 0) * priceTerm(ratio);
}

function readSelf(world: World, who: Who, deep: boolean): SelfRead {
  const land = landSelf(world, who.cell, who.year),
    age = who.year - who.born,
    child = age < land.adulthood,
    // (Their home in the town drawn, if they live in one: its standing is their household's place. Else their key's.)
    living = deep && who.alive ? personLiving(world, who.ref, who.town) : null,
    drawn = !!living,
    standing = who.lived
      ? clamp01(Math.max(who.lived.standing, living?.day.standing ?? 0))
      : (living?.day.standing ?? (who.rank > 0 ? Math.max(0.7, who.rank) : u(who.key, 41))),
    draw = (i: number) => u(who.key, 100 + i),
    youth = yearsOn(world, who.cell, who.born, who.born + land.adulthood),
    traits = traitsOf(
      land.nature,
      {
        ways: land.ways,
        hunger: youth.hunger,
        danger: youth.danger,
        standing,
        lettered: land.lettered,
      },
      draw,
    );
  // Their kin, as their family is read (as their kind pairs).
  const family = familyOf(world, who.ref),
    recent = (d: number | null) => d !== null && d >= who.year - 3 && d <= who.year,
    alive = (k: { died: number | null }) => k.died === null || k.died > who.year,
    young = family ? family.children.filter(alive).length : who.station === "met" ? 1 : 0,
    wed = !!family?.spouse && alive(family.spouse),
    pairing = family ? land.pairing : pairingOfWorld(world),
    partners = family
      ? wed
        ? pairing === "harem"
          ? Math.max(1, partnersOf(pairing, !child, standing, u(who.key, 43), true))
          : 1
        : 0
      : partnersOf(pairing, !child, standing, u(who.key, 43), u(who.key, 44) < 0.7),
    mourning =
      !!family?.children.some((k) => recent(k.died)) ||
      !!(family?.spouse && recent(family.spouse.died)),
    parents = !!family?.parents.some(alive);
  // Their household's day: their home's where it is drawn, else their work's at their land's prices and their place.
  const rent = living
      ? living.day.rent
      : who.station === "ruler" || land.landLaw < 0
        ? 0
        : (rentOf(world, who.cell, 0)?.pays ?? 0) * (standing >= 0.8 ? 0 : 1),
    mouths = living ? living.day.mouths : child ? FAMILY_SIZE : Math.max(1, 1 + partners + young),
    day = living
      ? living.day
      : reckonDay({
          // (A child's home is their parents': two at their land's first work, as a home whose earners aren't named is reckoned.)
          wages: child
            ? 2 * wageAt(world, who.cell, OCC.farmer)
            : wageAt(world, who.cell, who.occupation) +
              (partners > 0 ? partners * wageAt(world, who.cell, OCC.farmer) : 0),
          bread: land.bread,
          mouths,
          madeHead: land.madeHead,
          standing,
          court: who.station === "court" || who.station === "ruler",
          rent,
        }),
    left = day.left / Math.max(0.3, land.bread);
  const wants = wantsOf(traits, {
    nature: land.nature,
    ways: land.ways,
    child,
    old: clamp01(age / Math.max(1, land.span)),
    fed: land.fed,
    left,
    standing,
    rank: who.rank,
    danger: land.danger,
    lawless: land.lawless,
    partnered: partners > 0,
    children: young,
    parents,
    mourning,
    faith: land.faith,
    barred: land.barred,
    lettered: land.lettered,
    learned: land.learned,
  });
  const work = folkWork(world, who.cell),
    working = yearsOn(world, who.cell, who.born + land.adulthood, who.year + 1),
    read = careerOf(
      {
        born: who.born,
        year: who.year,
        adulthood: land.adulthood,
        span: land.span,
        occupation: who.occupation === OCC.dependent ? OCC.farmer : who.occupation,
        since: who.since,
        seated: who.station === "ruler" || who.station === "court" || who.station === "maker",
        kinds: work.kinds,
        counts: work.counts,
        ways: land.ways,
        traits,
        standing,
        hardTimes: working.hunger,
      },
      (i) => u(who.key, 200 + i),
    ),
    // (One the god lives has their own hours at their work: their rank at it now is theirs.)
    career = who.lived
      ? read.map((c, i) => (i === read.length - 1 ? { ...c, rank: levelOf(who.lived!.skill) } : c))
      : read;
  const ownsHome =
      who.lived?.owned ??
      (who.station === "ruler" ||
        land.landLaw === 2 ||
        (land.landLaw < 0 && !land.realm) ||
        standing >= 0.8),
    holdings = holdingsOf({
      worthHead: land.worthHead,
      owedHead: land.owedHead,
      goods: land.goods,
      spread: land.spread,
      common: land.common,
      caste: land.caste,
      standing,
      mouths,
      ownsHome,
      homeWorth: HOME_COST * (0.5 + standing) * Math.sqrt(Math.max(0.3, land.madeHead / 25)),
      left: day.left,
      rent: day.rent,
      purse: who.lived?.purse ?? null,
    });
  return {
    who,
    land,
    age,
    child,
    standing,
    drawn,
    traits,
    youth,
    wants,
    career,
    holdings,
    mouths,
    partners,
    young,
    left: day.left,
    rent: day.rent,
  };
}

/** Those of a town the game names, for a reading of them all: its first lines' holders (the ones any device draws first). */
export function townSelves(world: World, s: Settlement, most: number): SelfRead[] {
  const roster = townRoster(world, s.ref),
    out: SelfRead[] = [];
  for (let k = 0; out.length < most && k < most * 2; k++) {
    const h = roster.holder(k);
    if (!h) continue;
    const read = selfOf(world, h.ref, false);
    if (read) out.push(read);
  }
  return out;
}

/**
 * How far one of a town leans to each wrong in a year, for whom its court has brought (justice.ts): read from what is fixed of them by
 * that year — their key, their kind, their young years, their household's place by their key, and the town's year as its court reads
 * it — and not from their people's ways, which are the same for all of a town and drift as years pass: a year's cases are told the
 * same long after. (Their page reads their lean from all of them, as they are now.)
 */
export function leanThen(
  world: World,
  cell: number,
  key: number,
  born: number,
  scene: CrimeScene,
  barred: boolean,
): Record<CrimeKind, number> {
  const body = homePlanet(world).generated.life.people?.body,
    youth = yearsOn(world, cell, born, born + lifeOf(world).adulthood),
    standing = u(key, 41),
    traits = traitsOf(
      selfNature(body),
      {
        ways: MIDDLE_WAYS,
        hunger: youth.hunger,
        danger: youth.danger,
        standing,
        lettered: false,
      },
      (i) => u(key, 100 + i),
    );
  return crimeLean({ traits, standing, hunger: 0, faith: barred ? 0.5 : 0 }, scene);
}

/** A key's household place, as a list of a town's many reads it (their own home's, where the town is drawn, on their page). */
export const keyedStanding = (key: number): number => u(key, 41);
