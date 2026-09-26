// War (docs/architecture §23), v1 on the province graph. Rivals — and realms whose
// people starve beside a neighbour's full stores — may go to war; the decision's
// factors reach what drove it: the rivalry's reasons (a faith, a taken land), the
// famine and the dry year behind it, the land they want and its ground. A realm
// fields a share of its grown people, larger where they prize valour or keep a
// standing army, better armed with bronze, iron, mounts and walls. Each year of war
// brings a battle for a border land: hills and rivers favour those who hold them,
// walls more so, supply thins with distance from the seat and with famine at home.
// The fallen are written into the ledgers of deaths. A land won changes hands; its
// people's grievance may raise it in rebellion back to the realm it was taken from.
// Weariness brings peace, and the war is remembered in the realms' regard.
import {
  YEAR,
  defineEventType,
  defineKind,
  defineStream,
  drawWithoutReplacement,
  yearOfMoment,
  type CauseRef,
  type Factor,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { cellRef } from "../../gen/index.ts";
import { BANDS, HUMANLIKE, MALE } from "../../rules/index.ts";
import { COLS, row } from "../population/model.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { loreOf } from "../lore/lore.ts";
import { RIVALRY, diplomacyOf, relationRef } from "../diplomacy/diplomacy.ts";
import { handOf } from "../hand/hand.ts";

export const WAR = defineKind("war", "war", "minted");

export const WAR_EVENTS = {
  declared: defineEventType("war.declared", 6),
  battle: defineEventType("war.battle", 4),
  taken: defineEventType("war.taken", 5),
  rebellion: defineEventType("war.rebellion", 5),
  peace: defineEventType("war.peace", 5),
};

export type Battle = {
  readonly year: number;
  readonly land: number;
  readonly won: boolean;
  readonly fallen: readonly [number, number];
  readonly event: Ref;
};

export type War = {
  readonly ref: Ref;
  readonly attacker: Ref;
  readonly defender: Ref;
  readonly declared: number;
  readonly event: Ref;
  /** The land the attacker wanted most. */
  readonly prize: number;
  battles: Battle[];
  /** What each side has lost, in the fallen. */
  fallen: [number, number];
  ended: number | null;
  peace: Ref | null;
};

const DECLARE = defineStream("war.declare");
const FIGHT = defineStream("war.fight");

export class WarStore implements StateStore {
  readonly name = "war.wars";
  private list: War[] = [];

  add(w: War): void {
    this.list.push(w);
  }

  all(): readonly War[] {
    return this.list;
  }

  get(ref: Ref): War | undefined {
    return this.list.find((w) => w.ref === ref);
  }

  /** The wars a realm is fighting now. */
  fighting(realm: Ref): War[] {
    return this.list.filter(
      (w) => w.ended === null && (w.attacker === realm || w.defender === realm),
    );
  }

  between(a: Ref, b: Ref): War | undefined {
    return this.list.find(
      (w) =>
        w.ended === null &&
        ((w.attacker === a && w.defender === b) || (w.attacker === b && w.defender === a)),
    );
  }

  pinned(): Ref[] {
    const refs: Ref[] = [];
    for (const w of this.list) {
      refs.push(w.event);
      if (w.peace) refs.push(w.peace);
      for (const b of w.battles) refs.push(b.event);
    }
    return refs;
  }

  hashInto(h: Hasher): void {
    h.value(this.list);
  }

  save(): unknown {
    return { wars: this.list };
  }

  load(state: unknown): void {
    this.list = (state as { wars: War[] }).wars.map((w) => ({
      ...w,
      battles: [...w.battles],
      fallen: [...w.fallen] as [number, number],
    }));
  }
}

export function warsOf(world: World): WarStore {
  return world.store<WarStore>("war.wars");
}

/** How many a realm can field, and how well armed: grown men, a share by valour and a standing army. */
export function strengthOf(ctx: PopulationContext, p: Polity): number {
  const culture = cultureOf(ctx.world),
    lore = loreOf(ctx.world),
    valour = culture.get(p.seat)?.traits[WAY.valour] ?? 0.5,
    share =
      0.04 +
      0.1 * valour +
      0.03 * lore.effect(p.seat, "arms") * (lore.get(p.seat, "standing-army") ? 1 : 0),
    arms =
      1 +
      0.25 * lore.effect(p.seat, "arms") +
      0.15 * lore.effect(p.seat, "armour") +
      0.2 * lore.effect(p.seat, "mounts");
  let men = 0;
  for (const c of p.members) {
    const prov = ctx.provinces.get(c);
    if (!prov) continue;
    for (let b = 0; b < BANDS; b++)
      if (HUMANLIKE.bands[b]! >= 15 && HUMANLIKE.bands[b]! < 50)
        men += prov.counts.rowSum(row(MALE, b));
  }
  return men * share * arms;
}

/** The border lands of `b` next to `a`, richest in food first. */
function frontier(ctx: PopulationContext, a: Polity, b: Polity): number[] {
  const g = ctx.generated,
    markets = ctx.world.store<MarketStore>("economy.markets"),
    out = new Set<number>();
  for (const c of a.members)
    for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++) {
      const n = g.grid.neighbours[k]!;
      if (b.members.includes(n) && n !== b.seat) out.add(n);
    }
  const food = (c: number) =>
    markets.get(c)?.stock.reduce((s, v, i) => (i < 3 ? s + v : s), 0) ?? 0;
  return [...out].sort((x, y) => food(y) - food(x) || x - y);
}

/** Lose `n` grown men of a land to battle: drawn from its counts (never the hand's own), written as deaths. */
function fall(ctx: PopulationContext, cell: number, n: number, t: SimTime, key: number): number {
  const prov = ctx.provinces.get(cell);
  if (!prov || n <= 0) return 0;
  const year = yearOfMoment(t),
    windowed = handOf(ctx.world).composition(cell, year),
    rows: number[] = [],
    counts: number[] = [];
  for (let b = 0; b < BANDS; b++)
    if (HUMANLIKE.bands[b]! >= 15 && HUMANLIKE.bands[b]! < 50)
      for (let o = 1; o < COLS; o++) {
        const r = row(MALE, b);
        rows.push(r * COLS + o);
        counts.push(prov.counts.get(r, o) - (windowed ? windowed[r * COLS + o]! : 0));
      }
  const total = counts.reduce((a, b) => a + b, 0),
    take = Math.min(n, total);
  if (!take) return 0;
  const drawn = drawWithoutReplacement(take, counts, (i) =>
    ctx.world.rng.real(FIGHT, key, t, 9, i),
  );
  drawn.forEach((k, i) => {
    if (!k) return;
    const r = Math.floor(rows[i]! / COLS),
      o = rows[i]! % COLS;
    prov.counts.add(r, o, -k);
    ctx.history.addDeaths(cell, year, r % BANDS, k);
  });
  return take;
}

/** The year's wars: declarations, a battle in each war, rebellions, peace. */
export function warYear(ctx: PopulationContext, t: SimTime): void {
  const { world, generated: g } = ctx,
    wars = warsOf(world),
    realms = politiesOf(world),
    diplomacy = diplomacyOf(world),
    culture = cultureOf(world),
    lore = loreOf(world),
    year = yearOfMoment(t);

  // 1. Declarations: rivals, and realms who covet a neighbour's stores in a famine.
  for (const r of diplomacy.all()) {
    if (wars.between(r.a, r.b)) continue;
    const a0 = realms.get(r.a)!,
      b0 = realms.get(r.b)!;
    // The one who resents more, or hungers, attacks: the stronger of the two by default.
    const covets = r.terms.find((x) => /covets their stores/.test(x.name)),
      hungry = covets ? (covets.name.startsWith(realmName(a0)) ? a0 : b0) : null,
      [sa, sb] = [strengthOf(ctx, a0), strengthOf(ctx, b0)],
      attacker = hungry ?? (sa >= sb ? a0 : b0),
      defender = attacker === a0 ? b0 : a0,
      ratio = (attacker === a0 ? sa : sb) / Math.max(1, attacker === a0 ? sb : sa);
    const prize = frontier(ctx, attacker, defender)[0];
    if (prize === undefined) continue;
    const valour = culture.get(attacker.seat)?.traits[WAY.valour] ?? 0.5,
      hatred = Math.max(0, -r.opinion - (covets ? 0 : -RIVALRY)),
      chance = Math.min(
        0.5,
        (hatred * 0.6 + (covets ? 0.15 : 0)) * Math.min(2, ratio) * (0.5 + valour),
      );
    if (
      chance <= 0 ||
      !(world.rng.real(DECLARE, Number(attacker.ref.split(":")[2]), t, 0) < chance)
    )
      continue;
    const factors: Factor[] = [
      {
        name: "their rivalry",
        value: r.opinion,
        contribution: hatred,
        source: { ref: relationRef(r.a, r.b), role: "pressure", weight: 1 },
      },
      {
        name: "the land they want",
        value: prize,
        contribution: 0.3,
        source: { ref: cellRef(0, prize), role: "enabler", weight: 1 },
      },
      { name: "their strength", value: ratio, contribution: Math.min(2, ratio) / 2, source: null },
      {
        name: "a people who prize valour",
        value: valour,
        contribution: valour - 0.5,
        source: null,
      },
    ];
    if (covets?.source)
      factors.push({
        name: "hunger",
        value: 1,
        contribution: 0.3,
        source: { ref: covets.source, role: "trigger", weight: 1 },
      });
    const decision = world.decisions.record({
      rule: "war.declare",
      subject: attacker.ref,
      outcome: { against: defender.ref, prize },
      score: chance,
      threshold: 0,
      factors,
    });
    const ref = world.minter.mint(WAR),
      event = world.events.emit({
        type: WAR_EVENTS.declared.type,
        subjects: [ref, attacker.ref, defender.ref],
        place: cellRef(0, prize),
        causes: [{ ref: decision, role: "trigger", weight: 1 }],
        data: { a: realmName(attacker), b: realmName(defender) },
      });
    wars.add({
      ref,
      attacker: attacker.ref,
      defender: defender.ref,
      declared: year,
      event,
      prize,
      battles: [],
      fallen: [0, 0],
      ended: null,
      peace: null,
    });
  }

  // 2. A battle in each war: for the land the attacker wants, held by the defender.
  for (const w of wars.all()) {
    if (w.ended !== null || w.declared === year) continue;
    const a = realms.get(w.attacker)!,
      b = realms.get(w.defender)!;
    if (a.ended !== null || b.ended !== null) {
      w.ended = year;
      continue;
    }
    const land = frontier(ctx, a, b)[0];
    if (land === undefined) {
      w.ended = year;
      continue;
    }
    const key = Number(w.ref.split(":")[2]),
      far = (() => {
        // Supply thins with distance from the seat.
        const dx = g.grid.positions[3 * land]! - g.grid.positions[3 * a.seat]!,
          dy = g.grid.positions[3 * land + 1]! - g.grid.positions[3 * a.seat + 1]!,
          dz = g.grid.positions[3 * land + 2]! - g.grid.positions[3 * a.seat + 2]!;
        // In steps between neighbouring lands (about 0.0175 of the world's radius apart).
        return Math.sqrt(dx * dx + dy * dy + dz * dz) / 0.0175;
      })(),
      hungry = a.members.some((c) => {
        const f = ctx.provinces.get(c)?.lastFamine;
        const e = f ? world.events.get(f) : undefined;
        return e && t - e.t <= YEAR;
      }),
      attack =
        strengthOf(ctx, a) *
        (1 / (1 + 0.15 * far)) *
        (hungry ? 0.7 : 1) *
        (1 + 0.3 * lore.effect(a.seat, "sieges")),
      hills = g.tectonics.elevation[land]! > 600 ? 1.3 : 1,
      river = g.water.river[land] ? 1.1 : 1,
      walls = 1 + 0.25 * lore.effect(land, "walls"),
      // Those who hold the land know its ground, and every village is a stronghold.
      defend = strengthOf(ctx, b) * 1.5 * hills * river * walls,
      odds = attack / Math.max(1, attack + defend),
      won = world.rng.real(FIGHT, key, t, 0) < odds;
    // The fallen: a share of the smaller host, more on the losing side.
    const clash = Math.min(attack, defend),
      lostA = Math.round(clash * (won ? 0.08 : 0.18)),
      lostB = Math.round(clash * (won ? 0.18 : 0.08)),
      fromA = a.members.includes(a.seat) ? a.seat : a.members[0]!,
      fa = fall(ctx, fromA, lostA, t, key * 2),
      fb = fall(ctx, land, lostB, t, key * 2 + 1);
    w.fallen = [w.fallen[0] + fa, w.fallen[1] + fb];
    const battle = world.events.emit({
      type: WAR_EVENTS.battle.type,
      subjects: [w.ref, a.ref, b.ref],
      place: cellRef(0, land),
      causes: [{ ref: w.event, role: "trigger", weight: 1 }],
      data: { a: realmName(a), b: realmName(b), won, fallen: fa + fb },
    });
    w.battles.push({ year, land, won, fallen: [fa, fb], event: battle });
    if (won) {
      world.events.emit({
        type: WAR_EVENTS.taken.type,
        subjects: [a.ref, b.ref],
        place: cellRef(0, land),
        causes: [{ ref: battle, role: "trigger", weight: 1 }],
        data: { a: realmName(a), b: realmName(b) },
      });
      realms.leave(b, land);
      realms.join(a, land);
      // A land taken by force resents its taker.
      realms.setDiscontent(land, { level: 1, cause: battle });
    }
    // 3. Peace: weariness — the fallen against their people — or the prize won.
    const peopleA = a.members.reduce((s, c) => s + (ctx.provinces.get(c)?.total() ?? 0), 0),
      weary = w.fallen[0] / Math.max(1, peopleA) + w.fallen[1] / Math.max(1, peopleA),
      years = year - w.declared,
      prizeWon = a.members.includes(w.prize);
    // A beaten attacker often gives up; a won prize, a weary people or long years end it too.
    const repulsed = !won && world.rng.real(FIGHT, key, t, 6) < 0.5;
    if (
      prizeWon ||
      repulsed ||
      weary > 0.02 ||
      years >= 6 ||
      world.rng.real(FIGHT, key, t, 5) < 0.12
    ) {
      w.ended = year;
      w.peace = world.events.emit({
        type: WAR_EVENTS.peace.type,
        subjects: [w.ref, a.ref, b.ref],
        place: ctx.provinces.get(a.seat)?.ref ?? null,
        causes: [{ ref: battle, role: "trigger", weight: 1 }],
        data: { a: realmName(a), b: realmName(b), years, won: prizeWon },
      });
      diplomacy.remember(a.ref, b.ref, {
        name: "a war between them",
        value: -0.45,
        year,
        source: w.event,
      });
    }
  }

  // 4. Rebellion: a taken land still aggrieved rises back to the realm it was taken from.
  for (const p of realms.living())
    for (const c of [...p.members]) {
      if (c === p.seat) continue;
      const d = realms.discontent(c),
        former = realms.formerly(c),
        home = former ? realms.get(former) : undefined;
      if (!home || home.ended !== null || d.level < 0.8) continue;
      const touches = (() => {
        for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++)
          if (home.members.includes(g.grid.neighbours[k]!)) return true;
        return false;
      })();
      if (!touches || !(world.rng.real(FIGHT, c, t, 7) < 0.1 * d.level)) continue;
      const causes: CauseRef[] = d.cause ? [{ ref: d.cause, role: "pressure", weight: 1 }] : [];
      world.events.emit({
        type: WAR_EVENTS.rebellion.type,
        subjects: [p.ref, home.ref],
        place: cellRef(0, c),
        causes,
        data: { a: realmName(p), b: realmName(home) },
      });
      realms.leave(p, c);
      realms.join(home, c);
      realms.setDiscontent(c, { level: 0.2, cause: d.cause });
    }
}

/** Teach a peopled world its wars. */
export function installWar(world: World, ctx: () => PopulationContext): WarStore {
  const store = world.register(new WarStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "185.war.year", every: YEAR, run: (t) => warYear(ctx(), t) });
  return store;
}
