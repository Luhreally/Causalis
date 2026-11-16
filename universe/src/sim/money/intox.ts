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
  HOLD,
  INTOX_KINDS,
  INTOX_LINEAGE,
  OCC,
  cartel,
  intoxAvailable,
  intoxEffects,
  intoxUse,
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
import {
  BAR,
  BAR_STORE,
  COIN,
  COIN_STORE,
  FISC,
  INTOX,
  INTOX_STORE,
  TREASURY_STORE,
  moneyStore,
  sanctionBetween,
  smuggledOf,
} from "./kept.ts";

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

/** The kind a world's lineage holds, or null (pure: the world's seed and the lineage). */
function kindOf(ctx: PopulationContext, species: number): IntoxKind | null {
  const r = ctx.world.rng;
  if (!(r.unit(LINEAGE, species, 0, 0) < INTOX_LINEAGE)) return null;
  return INTOX_KINDS[r.index(INTOX_KINDS.length, LINEAGE, species, 0, 1)]!;
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
        const k = kindOf(ctx, s.index);
        if (k) here.push(k);
      }
    const have = intoxAvailable(
        here,
        Math.min(1, grows / 4),
        g.life.diversity[c] ?? 0,
        sugar && !!lore.get(c, "brewing"),
        home,
      ),
      ways = culture.get(c),
      workers = Math.max(1, pop - prov.occupation(OCC.dependent)),
      realm = realms.of(c),
      barred = realm ? barRead(world, realm.ref) : 0,
      use = intoxUse(
        have,
        {
          piety: ways?.traits[WAY.piety] ?? 0.5,
          toil: dmath.clamp(
            0.2 + 0.5 * lore.effect(c, "industry") + prov.occupation(OCC.crafter) / workers,
            0,
            1,
          ),
          pain: dmath.clamp(0.2 + (realm && wars.fighting(realm.ref).length ? 0.4 : 0), 0, 1),
          hardship: dmath.clamp(1 - prov.leanest / 1000, 0, 1),
        },
        barred,
      ),
      fx = intoxEffects(use);
    store.set(c, [
      ...INTOX_KINDS.map((k) => have[k] * 1000),
      ...INTOX_KINDS.map((k) => use[k] * 1000),
      fx.dependent * 1000,
      fx.lost * 1000,
      fx.deaths * 1e6,
      fx.rites * 1000,
      fx.eased * 1000,
    ]);
  }
}

/** How far a realm's law keeps intoxicants from its people: what it forbids, less what slips past its borders. */
function barRead(world: PopulationContext["world"], realm: string): number {
  const b = (moneyStore(world, BAR_STORE)?.at(realm, BAR.barred) ?? 0) / 1000;
  return b * (1 - smuggledOf(world, realm));
}

// —— 188.money.prohibition ————————————————————————————————————————————————————————————————————————————————

export function prohibitionYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    bars = moneyStore(world, BAR_STORE),
    lands = moneyStore(world, INTOX_STORE);
  if (!bars || !lands) return;
  const year = yearOfMoment(t),
    realms = politiesOf(world),
    markets = marketsOf(world),
    lore = loreOf(world),
    order = orderOf(world),
    coin = moneyStore(world, COIN_STORE),
    fisc = moneyStore(world, TREASURY_STORE),
    living = [...realms.living()].sort((a, b) => (a.ref < b.ref ? -1 : 1));
  type Read = {
    p: Polity;
    demand: number;
    supply: number;
    price: number;
    users: number;
    lost: number;
    rites: number;
    dealt: number;
  };
  const reads = new Map<string, Read>();
  for (const p of living) {
    let demand = 0,
      supply = 0,
      people = 0,
      lost = 0,
      rites = 0,
      dealt = 0,
      wage = 0;
    for (const c of p.members) {
      const prov = ctx.provinces.get(c),
        row = lands.get(c),
        m = markets.get(c);
      if (!prov || !row || !m) continue;
      const n = prov.total();
      let used = 0,
        given = 0;
      for (let k = 0; k < INTOX_KINDS.length; k++) {
        used += row[INTOX.use + k]! / 1000;
        given += row[INTOX.have + k]! / 1000;
      }
      demand += n * used;
      // (What its life could give: a share of its farmers could grow it for so many users each, where it grows at all.)
      supply += Math.min(1, given) * prov.occupation(OCC.farmer) * 0.05 * GROWER_USERS;
      people += n;
      lost += n * (row[INTOX.lost]! / 1000);
      rites += n * (row[INTOX.rites]! / 1000);
      wage +=
        n *
        Math.max(
          m.wage[OCC.farmer]!,
          m.wage[OCC.forager]!,
          (12 * mouths(prov, ctx.life)) / Math.max(1, n),
        );
      for (let gd = 0; gd < m.price.length; gd++)
        dealt += (m.book("in", gd) + m.book("out", gd)) * m.price[gd]!;
    }
    if (people <= 0) continue;
    const was = bars.get(p.ref),
      barred = (was?.[BAR.barred] ?? 0) / 1000,
      // A user's year of it costs a grower's share of a year, dearer as it runs short, and dearer by the risk where it is forbidden.
      price = ((wage / people / GROWER_USERS) *
        dmath.pow(dmath.clamp((demand + 1) / (supply + 1), 0.25, 4), 0.8) *
        (1 + RISK * barred)) as number;
    reads.set(p.ref, {
      p,
      demand,
      supply,
      price,
      users: demand / people,
      lost: lost / people,
      rites: rites / people,
      dealt,
    });
  }
  // Trade between realms that meet: from what has more than its people take to what has less, paid in the buyer's money metal.
  const bought = new Map<string, number>(),
    paid = new Map<string, number>();
  for (const rel of diplomacyOf(world).all()) {
    const a = reads.get(rel.a),
      b = reads.get(rel.b);
    if (!a || !b || warsOf(world).between(rel.a, rel.b)) continue;
    const shut = sanctionBetween(world, rel.a, rel.b);
    for (const [seller, buyer] of [
      [a, b],
      [b, a],
    ] as const) {
      const spare = seller.supply - seller.demand,
        short = buyer.demand - buyer.supply;
      if (spare <= 0 || short <= 0) continue;
      const n = Math.min(spare, short) * 0.5 * (1 - shut);
      bought.set(buyer.p.ref, (bought.get(buyer.p.ref) ?? 0) + n);
      paid.set(buyer.p.ref, (paid.get(buyer.p.ref) ?? 0) + n * seller.price);
      seller.supply -= n;
      buyer.supply += n;
      // The metal it pays in leaves its seat for the seller's.
      const good = coin?.get(buyer.p.ref)?.[COIN.good] ?? -1,
        from = markets.get(buyer.p.seat),
        to = markets.get(seller.p.seat);
      if (good >= 0 && from && to && from.price[good]! > 0) {
        const units = Math.floor(
          Math.min(DRAIN_MOST * from.stock[good]!, (n * seller.price) / from.price[good]!),
        );
        if (units > 0) to.move("in", good, from.take("out", good, units));
      }
    }
  }
  for (const r of reads.values()) {
    const p = r.p,
      was = bars.get(p.ref),
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
      drained = 0.8 * drainedWas + 0.2 * (paid.get(p.ref) ?? 0),
      drain = drained / Math.max(1, r.dealt),
      cap = capacityOf(ctx, p).value,
      want = prohibits({
        temple: sway.get("the temple") ?? 0,
        rites: r.rites,
        court: (sway.get("the court") ?? 0) + (sway.get("the army") ?? 0),
        lost: Math.max(0, r.lost) + 2 * drain,
        force: held[HOLD.force]!,
        voice: held[HOLD.voice]!,
        word: held[HOLD.word]!,
        traders: sway.get("traders") ?? 0,
        excise: lastExcise / Math.max(1, revenue + lastExcise),
        users: r.users,
      }),
      barredWas = (was?.[BAR.barred] ?? 0) / 1000,
      barred = barredWas + 0.2 * (want.level - barredWas),
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
      organised = cartel(barred, profit * 2, cap, o?.corruption ?? 0),
      place = ctx.provinces.get(p.seat)?.ref ?? null;
    let told = was?.[BAR.told] ?? 0;
    const tell = (type: string, data: Record<string, unknown>, subjects: Ref[] = [p.ref]) =>
      world.events.emit({
        type,
        subjects,
        place,
        causes: [],
        data: { realm: realmName(p), ...data },
      });
    if (barred >= 0.5 && barredWas < 0.5) {
      const decision = world.decisions.record({
        rule: INTOX_EVENTS.barred.type,
        subject: p.ref,
        outcome: { barred: Math.round(barred * 100) },
        score: want.level,
        threshold: 0.5,
        factors: want.parts.map(([name, v]) => ({
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
        data: { realm: realmName(p), users: Math.round(r.users * 100) },
      });
    } else if (barred < 0.25 && barredWas >= 0.25 && told & 1) tell(INTOX_EVENTS.allowed.type, {});
    if (barred >= 0.5) told |= 1;
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
      ...want.parts.map(([, v]) => v * 1000),
      excise * 1000,
      monopoly ? 1 : 0,
      taken,
      r.demand,
      r.supply,
      r.price * 1000,
      bought.get(p.ref) ?? 0,
      drained,
      drain * 1000,
      organised * 1000,
      told,
    ]);
  }
}
