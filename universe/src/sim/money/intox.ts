// Intoxicants (Round B; the rule is rules/intox.ts, what is kept ./kept.ts). Asked 2026-11-16: "are drugs in the game and that
// nuance to society and civs?"
//   186.money.intox, a land every five years in its turn, stepped five years at once: what its own life puts within reach of each kind
//     (its growing lineages, each holding one kind or none, drawn once from the world's seed on its own stream, thicker where many
//     grow and many eat them; a ferment where its life makes sugar and its people brew), what its people take of it by their ways and
//     years, less what its realm forbids and does not slip past its borders; and what that gives and costs them.
//   188.money.prohibition, a realm a year: whether it forbids them (who would and who would not, rules/intox.ts prohibits); what its
//     treasury takes of their trade, by excise or by holding it itself; what its lands want against what their life gives, bought
//     from realms it meets that have more, paid in its money metal out of its seat's market (a drain its rulers resent); and, where
//     forbidden, worth much and the realm's reach weak, those who carry it organised (a cartel), which widens what slips past.
// What it costs flows back: the work its crafts lose (or gain, of what wakes), a land's grievance for those who need it, the deaths of
// those who take too much in its people's year; the excise is its treasury's; what is forbidden is a wedge its smugglers cross.
// Pages say what, who, cost and effect: never how anything is made.
import {
  defineEventType,
  defineStream,
  dmath,
  yearOfMoment,
  type Ref,
  type SimTime,
} from "../../kernel/index.ts";
import { lives, offworldSite, worldLife } from "../../gen/index.ts";
import {
  EXCISE_MOST,
  GEAR,
  HOLD,
  bulkSlip,
  dosePrice,
  potencyHarm,
  INTOX_KINDS,
  INTOX_ALSO,
  INTOX_LINEAGE,
  OCC,
  cartel,
  intoxAvailable,
  intoxEffects,
  intoxUse,
  intoxWant,
  INTOX_HOLD,
  lawKeeps,
  prohibits,
  type IntoxKind,
} from "../../rules/index.ts";
import { marketsOf, mouths, type PopulationContext } from "../population/systems.ts";
import { loreOf } from "../lore/lore.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { interestsOf, type Group } from "../polity/interests.ts";
import { capacityOf, orderOf } from "../order/order.ts";
import { holdsOf } from "../order/holds.ts";
import { diplomacyOf } from "../diplomacy/diplomacy.ts";
import { warsOf } from "../war/war.ts";
import { hiddenOf, organisedOf, potencyOf, underworldOf } from "../order/underworld-kept.ts";
import {
  BAR,
  BAR_STORE,
  COIN,
  COIN_STORE,
  FISC,
  INTOX,
  INTOX_STORE,
  KINDS_STORE,
  KIND_ROW,
  TREASURY_STORE,
  kindBarred,
  kindReach,
  refNumber,
  moneyStore,
  sanctionBetween,
  smuggledOf,
  LAWS_EVERY,
  lawTurn,
  stepped,
} from "./kept.ts";
import { whisperIn } from "../acts/person.ts";

export const INTOX_EVENTS = {
  /** A realm forbade what calms, wakes, brings visions and eases pain; and let it be again. */
  barred: defineEventType("money.prohibited", 3),
  allowed: defineEventType("money.allowed", 2),
  /** Those who carry a forbidden trade in a realm organised. */
  cartel: defineEventType("money.cartel", 3),
  /** A realm's money metal drained abroad for what its people take, resented. */
  drain: defineEventType("money.drain", 3),
};

/** Which kind each growing lineage holds: one draw a lineage from the world's seed, on its own stream (no other draw moves). */
const LINEAGE = defineStream("money.intox");
/** A land is weighed once in this many years, in its turn. */
export const INTOX_EVERY = 5;
/** How many users' year of it a grower's year gives (est: a field of a hectare or so); and how much more it costs where forbidden. */
export const GROWER_USERS = 40;
export const RISK = 4;
/** At most this share of an importer's seat's money metal goes abroad for it in a year. */
export const DRAIN_MOST = 0.05;

/** The kinds a world's lineage holds (pure: the world's seed and the lineage): one of its own, or none, and others besides. */
export function kindsOf(world: PopulationContext["world"], species: number): IntoxKind[] {
  const r = world.rng,
    out: IntoxKind[] = [];
  const own =
    r.unit(LINEAGE, species, 0, 0) < INTOX_LINEAGE
      ? INTOX_KINDS[r.index(INTOX_KINDS.length, LINEAGE, species, 0, 1)]!
      : null;
  INTOX_KINDS.forEach((k, i) => {
    if (k === own || r.unit(LINEAGE, species, i + 1, 2) < INTOX_ALSO) out.push(k);
  });
  return out;
}

/** A world's lineages that grow and live now, and how many of them hold each kind (for its pages: why a kind is absent). */
export function intoxLineages(ctx: PopulationContext): { growing: number; holding: number[] } {
  const holding = INTOX_KINDS.map(() => 0),
    growing = ctx.generated.life.species.filter(
      (s) => s.died === null && (s.niche === "seed grass" || s.niche === "growth"),
    );
  for (const s of growing)
    for (const k of kindsOf(ctx.world, s.index)) holding[INTOX_KINDS.indexOf(k)]!++;
  return { growing: growing.length, holding };
}

// —— 186.money.intox ——————————————————————————————————————————————————————————————————————————————————————

export function intoxYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = moneyStore(world, INTOX_STORE);
  if (!store) return;
  const year = yearOfMoment(t),
    g = ctx.generated,
    lore = loreOf(world),
    culture = cultureOf(world),
    realms = politiesOf(world),
    wars = warsOf(world),
    sugar = worldLife(g).sugar !== null,
    growing = g.life.species.filter(
      (s) => s.died === null && (s.niche === "seed grass" || s.niche === "growth"),
    );
  for (const prov of ctx.provinces.all()) {
    const c = prov.cell;
    if ((c + year) % INTOX_EVERY !== 0) continue;
    const pop = prov.total();
    if (pop <= 0) {
      store.drop(c);
      continue;
    }
    // What its own life holds: on its own world, where its people's body and its life are one chemistry; off it, only what they brew.
    const home = !offworldSite(g, c),
      here: IntoxKind[] = [];
    let grows = 0;
    if (home)
      for (const s of growing) {
        if (!lives(g.life, c, s.index)) continue;
        grows++;
        here.push(...kindsOf(world, s.index));
      }
    const own = intoxAvailable(
        here,
        Math.min(1, grows / 4),
        g.life.diversity[c] ?? 0,
        sugar && !!lore.get(c, "brewing"),
        home,
      ),
      ways = culture.get(c),
      workers = Math.max(1, pop - prov.occupation(OCC.dependent)),
      realm = realms.of(c),
      // (Each kind as its realm's law on it keeps it, less what slips past.)
      barred = barRead(world, realm?.ref),
      // (What its own life holds, or what its realm brings in from abroad of each, the more: 0 where none is brought.)
      have = {} as Record<IntoxKind, number>,
      wants = {
        piety: ways?.traits[WAY.piety] ?? 0.5,
        toil: dmath.clamp(
          0.2 + 0.5 * lore.effect(c, "industry") + prov.occupation(OCC.crafter) / workers,
          0,
          1,
        ),
        pain: dmath.clamp(0.2 + (realm && wars.fighting(realm.ref).length ? 0.4 : 0), 0, 1),
        hardship: dmath.clamp(1 - prov.leanest / 1000, 0, 1),
      };
    INTOX_KINDS.forEach((k, i) => {
      have[k] = realm && home ? Math.max(own[k], kindReach(world, realm.ref, i)) : own[k];
    });
    const want = intoxWant(wants),
      use = intoxUse(have, wants, barred),
      fx = intoxEffects(use),
      // (How strong what they take has grown under a ban: more need it, more die of it. Exactly 1 where none is kept.)
      harm = potencyHarm(potencyOf(world, realm?.ref).potency, potencyOf(world, realm?.ref).made);
    // (Within reach: what its own life gives; what comes from abroad is its realm's, KIND_ROW.reach.)
    store.set(c, [
      ...INTOX_KINDS.map((k) => own[k] * 1000),
      ...INTOX_KINDS.map((k) => use[k] * 1000),
      Math.min(1, fx.dependent * harm.binds) * 1000,
      fx.lost * 1000,
      Math.min(0.01, fx.deaths * harm.deaths) * 1e6,
      fx.rites * 1000,
      fx.eased * 1000,
      ...INTOX_KINDS.map((k) => want[k] * 1000),
    ]);
  }
}

/** The share of what a realm's law forbids of them that slips past it: its borders, their little bulk, its cartels' hidden carriage. */
function slipsPast(world: PopulationContext["world"], realm: string): number {
  const s = smuggledOf(world, realm),
    // (What slips past for its little bulk, and in its cartels' hidden carriage: sim/order/underworld.ts. 0 where none is kept.)
    slips = Math.min(
      0.6,
      bulkSlip(potencyOf(world, realm).potency) + GEAR.slips * hiddenOf(world, realm as Ref),
    );
  return 1 - (1 - s) * (1 - slips);
}

/** How far a realm's law keeps each kind from its people: what it forbids of it, less what slips past (none where no realm). */
function barRead(
  world: PopulationContext["world"],
  realm: string | undefined,
): Record<IntoxKind, number> {
  const out = { calming: 0, waking: 0, visions: 0, easing: 0 } as Record<IntoxKind, number>;
  if (!realm) return out;
  const past = slipsPast(world, realm);
  INTOX_KINDS.forEach((k, i) => (out[k] = kindBarred(world, realm, i) * (1 - past)));
  return out;
}

// —— 188.money.prohibition ————————————————————————————————————————————————————————————————————————————————

export function prohibitionYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    bars = moneyStore(world, BAR_STORE),
    lands = moneyStore(world, INTOX_STORE),
    kinds = moneyStore(world, KINDS_STORE);
  if (!bars || !lands) return;
  const year = yearOfMoment(t),
    realms = politiesOf(world),
    markets = marketsOf(world),
    lore = loreOf(world),
    order = orderOf(world),
    coin = moneyStore(world, COIN_STORE),
    fisc = moneyStore(world, TREASURY_STORE),
    living = [...realms.living()].sort((a, b) => (a.ref < b.ref ? -1 : 1)),
    N = INTOX_KINDS.length;
  type Read = {
    p: Polity;
    demand: number;
    supply: number;
    price: number;
    users: number;
    rites: number;
    dealt: number;
    /** Whether it reckons its bar this year (money.ts LAWS_EVERY); else it only trades. */
    turn: boolean;
    /** By kind: its people's use, what its lands' life could give, what they would take where their law allows (users). */
    use: number[];
    grow: number[];
    wanted: number[];
    /** By kind: its people's work lost to it (people-weighted shares, summed). */
    lostBy: number[];
    /** By kind: those who need it and those who die of it a year (people-weighted shares, summed). */
    needBy: number[];
    deadBy: number[];
    people: number;
    /** The share of what it forbids that slips past its law. */
    past: number;
  };
  const reads = new Map<string, Read>();
  for (const p of living) {
    const turn = !bars.get(p.ref) || lawTurn(p, year);
    let people = 0,
      rites = 0,
      dealt = 0,
      wage = 0,
      supply = 0;
    const use = new Array<number>(N).fill(0),
      grow = new Array<number>(N).fill(0),
      wanted = new Array<number>(N).fill(0),
      lostBy = new Array<number>(N).fill(0),
      needBy = new Array<number>(N).fill(0),
      deadBy = new Array<number>(N).fill(0),
      past = slipsPast(world, p.ref),
      kept = INTOX_KINDS.map((_, k) => 1 - lawKeeps(kindBarred(world, p.ref, k) * (1 - past)));
    for (const c of p.members) {
      const prov = ctx.provinces.get(c),
        row = lands.get(c),
        m = markets.get(c);
      if (!prov || !row || !m) continue;
      const n = prov.total(),
        // (What a share of its farmers could grow, for so many users each, where it grows at all.)
        growers = prov.occupation(OCC.farmer) * 0.05 * GROWER_USERS;
      let given = 0;
      for (let k = 0; k < N; k++) {
        const u = row[INTOX.use + k]! / 1000,
          own = row[INTOX.have + k]! / 1000,
          // (A row kept before what is wanted was: what is taken where it is within reach.)
          w = row[INTOX.want + k] ? row[INTOX.want + k]! / 1000 : own > 0 ? u / own / kept[k]! : 0;
        use[k]! += n * u;
        grow[k]! += Math.min(1, own) * growers;
        wanted[k]! += n * w * kept[k]!;
        // (rules/intox.ts kindCost, inlined: a land a kind a year.)
        const hold = INTOX_HOLD[INTOX_KINDS[k]!];
        lostBy[k]! += n * (hold.work >= 0 ? u * hold.binds * hold.work : u * hold.work * 0.2);
        needBy[k]! += n * u * hold.binds;
        deadBy[k]! += n * u * hold.binds * hold.kills;
        given += own;
      }
      supply += Math.min(1, given) * growers;
      people += n;
      rites += n * (row[INTOX.rites]! / 1000);
      wage +=
        n *
        Math.max(
          m.wage[OCC.farmer]!,
          m.wage[OCC.forager]!,
          (12 * mouths(prov, ctx.life)) / Math.max(1, n),
        );
      if (turn)
        for (let gd = 0; gd < m.price.length; gd++)
          dealt += (m.book("in", gd) + m.book("out", gd)) * m.price[gd]!;
    }
    if (people <= 0) continue;
    const demand = use.reduce((a, b) => a + b, 0),
      was = bars.get(p.ref),
      barred = (was?.[BAR.barred] ?? 0) / 1000,
      // A user's year of it costs a grower's share of a year, dearer as it runs short, and dearer by the risk where it is forbidden.
      price = ((wage / people / GROWER_USERS) *
        dmath.pow(dmath.clamp((demand + 1) / (supply + 1), 0.25, 4), 0.8) *
        (1 + RISK * barred) *
        // (A dose of a stronger form costs less: its bulk's cost spread over more doses. Exactly 1 where none is kept.)
        dosePrice(potencyOf(world, p.ref).potency)) as number;
    reads.set(p.ref, {
      p,
      demand,
      supply,
      price,
      users: demand / people,
      rites: rites / people,
      dealt,
      turn,
      use,
      grow,
      wanted,
      lostBy,
      needBy,
      deadBy,
      people,
      past,
    });
  }
  // Trade between realms that meet, kind by kind: from what grows more than its people take to what wants more than its lands
  // grow, paid in the buyer's money metal. A realm where a kind grows nowhere wants it all the same, as far as its law allows.
  const bought = new Map<string, number[]>(),
    paid = new Map<string, number[]>(),
    from = new Map<string, [number, number][]>(),
    spare = new Map<string, number[]>(),
    // (What of its seat's money metal a buyer may still pay out this year, to every seller together: DRAIN_MOST.)
    metalLeft = new Map<string, number>();
  for (const r of reads.values())
    spare.set(
      r.p.ref,
      r.grow.map((g, k) => g - r.use[k]!),
    );
  for (const rel of diplomacyOf(world).all()) {
    const a = reads.get(rel.a),
      b = reads.get(rel.b);
    if (!a || !b || warsOf(world).between(rel.a, rel.b)) continue;
    const shut = sanctionBetween(world, rel.a, rel.b);
    if (shut >= 1) continue;
    for (const [seller, buyer] of [
      [a, b],
      [b, a],
    ] as const) {
      const left = spare.get(seller.p.ref)!;
      let worth = 0;
      for (let k = 0; k < N; k++) {
        if (left[k]! <= 0) continue;
        let got = bought.get(buyer.p.ref);
        const short = buyer.wanted[k]! - buyer.grow[k]! - (got?.[k] ?? 0);
        if (short <= 0) continue;
        const n = Math.min(left[k]!, short) * 0.5 * (1 - shut);
        left[k]! -= n;
        if (!got) {
          bought.set(buyer.p.ref, (got = new Array<number>(N).fill(0)));
          paid.set(buyer.p.ref, new Array<number>(N).fill(0));
          from.set(
            buyer.p.ref,
            INTOX_KINDS.map((): [number, number] => [0, 0]),
          );
        }
        const most = from.get(buyer.p.ref)!;
        got[k]! += n;
        paid.get(buyer.p.ref)![k]! += n * seller.price;
        if (n > most[k]![1]) most[k] = [refNumber(seller.p.ref) + 1, n];
        worth += n * seller.price;
      }
      if (worth <= 0) continue;
      // The metal it pays in leaves its seat for the seller's: once for all it bought of them.
      const good = coin?.get(buyer.p.ref)?.[COIN.good] ?? -1,
        fromM = markets.get(buyer.p.seat),
        to = markets.get(seller.p.seat);
      if (good >= 0 && fromM && to && fromM.price[good]! > 0) {
        const room = metalLeft.get(buyer.p.ref) ?? DRAIN_MOST * fromM.stock[good]!,
          units = Math.floor(Math.min(room, worth / fromM.price[good]!));
        if (units > 0) to.move("in", good, fromM.take("out", good, units));
        metalLeft.set(buyer.p.ref, room - Math.max(0, units));
      }
    }
  }
  const sum = (xs: readonly number[] | undefined) => (xs ?? []).reduce((a, b) => a + b, 0);
  for (const r of reads.values()) {
    const p = r.p,
      was = bars.get(p.ref),
      kwas = kinds?.get(p.ref),
      got = bought.get(p.ref),
      cost = paid.get(p.ref),
      most = from.get(p.ref),
      // (Each kind's law as it stands: its own, or the one law on all four where none is kept by kind.)
      barredWasBy = INTOX_KINDS.map((_, k) => kindBarred(world, p.ref, k)),
      kindRow = (barredBy: readonly number[], told: number) => {
        const row: number[] = [];
        for (let k = 0; k < N; k++)
          row.push(
            barredBy[k]! * 1000,
            got?.[k] ?? 0,
            most?.[k]?.[0] ?? 0,
            r.wanted[k]! > 0 ? Math.min(1, (got?.[k] ?? 0) / r.wanted[k]!) * 1000 : 0,
            r.past * 1000,
          );
        row.push(told);
        return row;
      };
    // (Between its reckonings it trades, and what it pays abroad fades and gathers year by year: the rest stands.)
    if (!r.turn && was) {
      const row = [...was];
      row[BAR.demand] = r.demand;
      row[BAR.supply] = r.supply;
      row[BAR.price] = r.price * 1000;
      row[BAR.imported] = sum(got);
      row[BAR.drained] = 0.8 * was[BAR.drained]! + 0.2 * sum(cost);
      bars.set(p.ref, row);
      kinds?.set(p.ref, kindRow(barredWasBy, kwas?.[KIND_ROW.told] ?? 0));
      continue;
    }
    const years = was ? LAWS_EVERY : 1,
      held = holdsOf(world, p.ref),
      o = order?.of(p.ref),
      sway = new Map<Group, number>();
    for (const i of interestsOf(ctx, p, t)) sway.set(i.group, i.sway);
    const fr = fisc?.get(p.ref),
      revenue = fr
        ? fr[FISC.tariffs]! +
          fr[FISC.seigniorage]! +
          fr[FISC.take]! +
          fr[FISC.take + 1]! +
          fr[FISC.take + 2]! +
          fr[FISC.take + 3]!
        : 0,
      lastExcise = was?.[BAR.revenue] ?? 0,
      drainedWas = was?.[BAR.drained] ?? 0,
      drained = 0.8 * drainedWas + 0.2 * sum(cost),
      drain = drained / Math.max(1, r.dealt),
      cap = capacityOf(ctx, p).value,
      // (What its crackdown costs and what its smugglers take, each a share of what its treasury takes in: what a ban, where one
      // stands, costs to keep. sim/order/underworld.ts; nothing where none is reckoned.)
      under = underworldOf(world)?.of(p.ref),
      enforce = under ? under.cost / Math.max(1, revenue) : 0,
      rents = under ? under.smuggleRent / Math.max(1, revenue) : 0,
      // Each kind weighed on its own: the temple whose rites do not use it, the court whose people's work it takes and whose money it
      // drains abroad, and those its harm falls on as far as they are heard; against the traders, the treasury, those who take it
      // (of it alone), and, where it is forbidden already, what keeping the ban costs.
      wants = INTOX_KINDS.map((k, i) =>
        prohibits({
          dependent: r.needBy[i]! / r.people,
          deaths: r.deadBy[i]! / r.people,
          crafters: sway.get("crafters") ?? 0,
          enforce: Math.min(1, enforce) * barredWasBy[i]!,
          rents: Math.min(1, rents) * barredWasBy[i]!,
          corruption: o?.corruption ?? 0,
          temple: sway.get("the temple") ?? 0,
          rites: k === "visions" ? r.rites : 0,
          court: (sway.get("the court") ?? 0) + (sway.get("the army") ?? 0),
          lost:
            Math.max(0, r.lostBy[i]! / r.people) +
            2 * drain * (sum(cost) > 0 ? (cost?.[i] ?? 0) / sum(cost) : 0),
          force: held[HOLD.force]!,
          voice: held[HOLD.voice]!,
          word: held[HOLD.word]!,
          traders: sway.get("traders") ?? 0,
          excise: lastExcise / Math.max(1, revenue + lastExcise),
          users: r.use[i]! / r.people,
        }),
      ),
      // (A god's whisper to its ruler: to bar them wholly, or to lift the bar, every kind. Exactly as wanted where none.)
      whispered = whisperIn(world, `rule:${p.ref}`, p.ruler.event, year, "bar"),
      // (A kind none of its people take and none of its lands grow is weighed by no one: no law on it is argued.)
      barredBy = wants.map((w, k) => {
        const level = whispered
          ? whispered.aim === "bar:ban"
            ? 1
            : 0
          : r.use[k]! > 0 || r.grow[k]! > 0
            ? w.level
            : 0;
        return barredWasBy[k]! + stepped(0.2, years) * (level - barredWasBy[k]!);
      }),
      // (The one law on them all, as the older systems read it: each kind's, weighed by what is taken of it, or would be.)
      weights = INTOX_KINDS.map((_, k) => r.use[k]! + 0.1 * r.wanted[k]!),
      weight = sum(weights),
      barred = weight > 0 ? barredBy.reduce((a, b, k) => a + b * weights[k]!, 0) / weight : 0,
      // (Its parts as told: those of the kind it forbids most, the most taken of those as far.)
      lead = INTOX_KINDS.map((_, k) => k).sort(
        (a, b) => barredBy[b]! - barredBy[a]! || r.use[b]! - r.use[a]! || a - b,
      )[0]!,
      want = wants[lead]!,
      // A realm held hard and reaching far keeps the trade to itself; else it lays an excise as far as it sees what is sold.
      monopoly = held[HOLD.force]! > 0.6 && cap > 0.5 && !!lore.get(p.seat, "writing"),
      excise =
        EXCISE_MOST *
        (monopoly
          ? 1
          : (lore.get(p.seat, "currency") ? 0.8 : 0.3) * (1 - (sway.get("traders") ?? 0))),
      worth = r.demand * r.price,
      taken = worth * excise * (1 - barred) * (1 - smuggledOf(world, p.ref)),
      profit = (RISK * barred) / (1 + RISK * barred) + excise,
      // (Where its underworld is reckoned, its cartels' own organisation: sim/order/underworld.ts. Else as it was weighed alone.)
      organised = organisedOf(world, p.ref) ?? cartel(barred, profit * 2, cap, o?.corruption ?? 0),
      place = ctx.provinces.get(p.seat)?.ref ?? null;
    let told = was?.[BAR.told] ?? 0,
      kindTold = kwas?.[KIND_ROW.told] ?? 0;
    const tell = (type: string, data: Record<string, unknown>, subjects: Ref[] = [p.ref]) =>
      world.events.emit({
        type,
        subjects,
        place,
        causes: [],
        data: { realm: realmName(p), ...data },
      });
    // A kind forbidden, told once each time it is: what it is, how many take it, and who would and would not.
    for (let k = 0; k < N; k++) {
      const now = barredBy[k]!,
        then = barredWasBy[k]!,
        bit = 1 << k;
      if (now >= 0.5 && then < 0.5 && !(kindTold & bit) && r.use[k]! > 0) {
        kindTold |= bit;
        const decision = world.decisions.record({
          rule: INTOX_EVENTS.barred.type,
          subject: p.ref,
          outcome: { barred: Math.round(now * 100), kind: INTOX_KINDS[k] },
          score: wants[k]!.level,
          threshold: 0.5,
          factors: wants[k]!.parts.map(([name, v]) => ({
            name,
            value: Math.round(v * 100) / 100,
            contribution: v,
            source: null,
          })),
        });
        world.events.emit({
          type: INTOX_EVENTS.barred.type,
          subjects: [p.ref],
          place,
          causes: [{ ref: decision, role: "trigger", weight: 1 }],
          data: {
            realm: realmName(p),
            kind: INTOX_KINDS[k],
            users: Math.round((r.use[k]! / r.people) * 100),
          },
        });
      } else if (now < 0.25 && then >= 0.25 && kindTold & bit) {
        kindTold &= ~bit;
        tell(INTOX_EVENTS.allowed.type, { kind: INTOX_KINDS[k] });
      }
    }
    if (barredBy.some((b) => b >= 0.5)) told |= 1;
    if (organised >= 0.3 && !(told & 2)) {
      told |= 2;
      tell(INTOX_EVENTS.cartel.type, { strength: Math.round(organised * 100) });
    }
    if (drain >= 0.02 && !(told & 4)) {
      told |= 4;
      // (Whom it paid most: those it meets that had more than their people took.)
      const sellers = diplomacyOf(world)
        .all()
        .filter((rel) => rel.a === p.ref || rel.b === p.ref)
        .map((rel) => (rel.a === p.ref ? rel.b : rel.a))
        .map((q) => reads.get(q))
        .filter((q): q is Read => !!q && q.supply > q.demand)
        .sort(
          (x, y) => y.supply - y.demand - (x.supply - x.demand) || (x.p.ref < y.p.ref ? -1 : 1),
        );
      const seller = sellers[0];
      const e = tell(
        INTOX_EVENTS.drain.type,
        { share: Math.round(drain * 1000) / 10, of: seller ? realmName(seller.p) : null },
        seller ? [p.ref, seller.p.ref] : [p.ref],
      );
      if (seller)
        diplomacyOf(world).remember(p.ref, seller.p.ref, {
          name: "its money drained abroad for what its people take",
          value: -0.15,
          year,
          source: e,
        });
    }
    bars.set(p.ref, [
      barred * 1000,
      ...want.parts.slice(0, 6).map(([, v]) => v * 1000),
      excise * 1000,
      monopoly ? 1 : 0,
      taken,
      r.demand,
      r.supply,
      r.price * 1000,
      sum(got),
      drained,
      drain * 1000,
      organised * 1000,
      told,
      ...want.parts.slice(6).map(([, v]) => v * 1000),
    ]);
    kinds?.set(p.ref, kindRow(barredBy, kindTold));
  }
}
