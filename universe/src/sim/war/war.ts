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
  Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { cellRef } from "../../gen/index.ts";
import { BANDS, G, MALE, hostPower, type LifeHistory } from "../../rules/index.ts";

/** Whether an age band fights: the grown, before the last third of life (fifteen to fifty, for upright apes). */
function fighting(life: LifeHistory, band: number): boolean {
  return life.bands[band]! >= life.adulthood && life.bands[band]! < life.bands[7]!;
}
import { designsOf, hostFor } from "../design/design.ts";
import { COLS, row } from "../population/model.ts";
import type { PopulationContext } from "../population/systems.ts";
import { marketGoodRef, type MarketStore } from "../economy/market.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { cutOff, endRealm, politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { interestsOf, pressure } from "../polity/interests.ts";
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
/** Years after a peace before a realm is as ready for war as it was. */
export const WEARY_YEARS = 30;
const FIGHT = defineStream("war.fight");

export class WarStore implements StateStore {
  readonly name = "war.wars";
  private list: War[] = [];
  /** The same wars by ref. */
  private readonly byRef = new Map<string, War>();
  /** Wars that ended are folded into a digest once, at the end of their year, and not hashed again. */
  private digest = "";
  private readonly sealed = new Set<string>();

  /** Fold the wars that have ended into the digest (in ref order): they will not change again. */
  seal(): void {
    const ended = this.list
      .filter((w) => w.ended !== null && !this.sealed.has(w.ref))
      .sort((a, b) => (a.ref < b.ref ? -1 : 1));
    if (!ended.length) return;
    const h = new Hasher().string(this.digest);
    for (const w of ended) {
      h.value(w);
      this.sealed.add(w.ref);
    }
    this.digest = h.hex();
  }

  add(w: War): void {
    this.list.push(w);
    this.byRef.set(w.ref, w);
  }

  all(): readonly War[] {
    return this.list;
  }

  get(ref: Ref): War | undefined {
    return this.byRef.get(ref);
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
    h.string(this.digest).value(this.list.filter((w) => !this.sealed.has(w.ref)));
  }

  save(): unknown {
    return {
      wars: this.list,
      digest: this.digest,
      sealed: [...this.sealed].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    };
  }

  load(state: unknown): void {
    this.list = (state as { wars: War[] }).wars.map((w) => ({
      ...w,
      battles: [...w.battles],
      fallen: [...w.fallen] as [number, number],
    }));
    this.byRef.clear();
    for (const w of this.list) this.byRef.set(w.ref, w);
    const t = state as { digest?: string; sealed?: string[] };
    this.digest = t.digest ?? "";
    this.sealed.clear();
    for (const r of t.sealed ?? []) this.sealed.add(r);
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
    // What its host fights with: its design (realized now, if the realm is newer than it).
    arms = hostPower(designsOf(ctx.world).of(p.ref)?.parts ?? hostFor(ctx, p).parts);
  let men = 0;
  for (const c of p.members) {
    const prov = ctx.provinces.get(c);
    if (!prov) continue;
    for (let b = 0; b < BANDS; b++)
      if (fighting(ctx.life, b)) men += prov.counts.rowSum(row(MALE, b));
  }
  return men * share * arms;
}

/** The border lands of `b` next to `a`, richest in food first. */
function frontier(ctx: PopulationContext, a: Polity, b: Polity): number[] {
  const g = ctx.generated,
    markets = ctx.world.store<MarketStore>("economy.markets"),
    // A realm with ships fights for lands across the sea its traders have reached.
    sails = loreOf(ctx.world).effect(a.seat, "ships") > 0,
    theirs = new Set(b.members),
    out = new Set<number>();
  const near = (c: number, take: (n: number) => void) => {
    for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++) take(g.grid.neighbours[k]!);
    if (sails) for (const n of markets.seaPartners(c)) take(n);
  };
  for (const c of a.members)
    near(c, (n) => {
      if (theirs.has(n) && n !== b.seat) out.add(n);
    });
  // The seat itself is fought for only once nothing else of the realm stands before it.
  if (!out.size && theirs.has(b.seat))
    for (const c of a.members)
      near(c, (n) => {
        if (n === b.seat) out.add(n);
      });
  return [...out].sort((x, y) => stores(ctx, y) - stores(ctx, x) || x - y);
}

/** Whether a realm reaches a land only across the sea (none of its lands borders it). */
function overseas(ctx: PopulationContext, a: Polity, land: number): boolean {
  const g = ctx.generated;
  for (let k = g.grid.offsets[land]!; k < g.grid.offsets[land + 1]!; k++)
    if (a.members.includes(g.grid.neighbours[k]!)) return false;
  return true;
}

/** The finest ship-craft a land knows: the event it was learned in. */
function shipCraft(ctx: PopulationContext, cell: number): Ref | null {
  const lore = loreOf(ctx.world);
  for (const id of ["astronomy", "shipbuilding", "sailing"]) {
    const k = lore.get(cell, id);
    if (k) return k.event;
  }
  return null;
}

/** A host landing from the sea fights at this share of its strength. */
const LANDING = 0.6;

/** A land's food in store (its grain, pulses and roots): what a coveting realm wants of it. */
function stores(ctx: PopulationContext, cell: number): number {
  const markets = ctx.world.store<MarketStore>("economy.markets");
  return markets.get(cell)?.stock.reduce((s, v, i) => (i < 3 ? s + v : s), 0) ?? 0;
}

/** Lose `n` grown men of a land to battle: drawn from its counts (never the hand's own), written as deaths. */
function fall(ctx: PopulationContext, cell: number, n: number, t: SimTime, key: number): number {
  const prov = ctx.provinces.get(cell);
  if (!prov || n <= 0) return 0;
  const year = yearOfMoment(t),
    windowed = handOf(ctx.world).composition(cell, year, ctx.life),
    rows: number[] = [],
    counts: number[] = [];
  for (let b = 0; b < BANDS; b++)
    if (fighting(ctx.life, b))
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

const pairKey = (a: Ref, b: Ref) => (a < b ? `${a}|${b}` : `${b}|${a}`);

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
  // A realm fresh from war is slow to go to war again: its fallen are still mourned.
  const lastPeace = new Map<string, War>(),
    fighting = new Set<string>();
  for (const w of wars.all()) {
    if (w.ended === null) fighting.add(pairKey(w.attacker, w.defender));
    else if (w.peace)
      for (const side of [w.attacker, w.defender])
        if ((lastPeace.get(side)?.ended ?? -1) < w.ended) lastPeace.set(side, w);
  }
  // Each realm's strength, reckoned once this year.
  const strengths = new Map<string, number>(),
    strength = (p: Polity) => {
      let s = strengths.get(p.ref);
      if (s === undefined) strengths.set(p.ref, (s = strengthOf(ctx, p)));
      return s;
    };
  for (const r of diplomacy.all()) {
    if (fighting.has(pairKey(r.a, r.b))) continue;
    const covets = r.terms.find((x) => /covets their stores/.test(x.name));
    // Without hatred or hunger there is no will to war, whatever else holds.
    if (!covets && -r.opinion - -RIVALRY <= 0) continue;
    const a0 = realms.get(r.a)!,
      b0 = realms.get(r.b)!;
    // The one who resents more, or hungers, attacks: the stronger of the two by default.
    const hungry = covets ? (covets.name.startsWith(realmName(a0)) ? a0 : b0) : null,
      [sa, sb] = [strength(a0), strength(b0)],
      attacker = hungry ?? (sa >= sb ? a0 : b0),
      defender = attacker === a0 ? b0 : a0,
      ratio = (attacker === a0 ? sa : sb) / Math.max(1, attacker === a0 ? sb : sa);
    const prize = frontier(ctx, attacker, defender)[0];
    if (prize === undefined) continue;
    const valour = culture.get(attacker.seat)?.traits[WAY.valour] ?? 0.5,
      hatred = Math.max(0, -r.opinion - (covets ? 0 : -RIVALRY)),
      last = lastPeace.get(attacker.ref),
      rested = last ? Math.min(1, (year - last.ended!) / WEARY_YEARS) : 1,
      // Its people's voices: traders who want peace with those they trade with hold it
      // back; a temple that wants war on unbelievers urges it on.
      voices = interestsOf(ctx, attacker, t),
      peace = pressure(voices, "peace", defender.ref),
      holy = pressure(voices, "war", defender.ref),
      swayed = (1 - 0.7 * Math.min(1, 2 * peace.total)) * (1 + Math.min(1, 2 * holy.total)),
      chance =
        Math.min(0.5, (hatred * 0.12 + (covets ? 0.08 : 0)) * Math.min(2, ratio) * (0.5 + valour)) *
        rested *
        swayed;
    if (
      chance <= 0 ||
      !(world.rng.real(DECLARE, Number(attacker.ref.split(":")[2]), t, 0) < chance)
    )
      continue;
    const factors: Factor[] = [
      {
        name: "their rivalry",
        value: r.opinion,
        contribution: Math.max(0, -r.opinion),
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
    // The rivalry's own reasons, as they stood — so the war's why holds when the realms are gone.
    for (const term of r.terms
      .filter((x) => x.value < 0 && x.source && !/covets their stores/.test(x.name))
      .sort((x, y) => x.value - y.value || (x.name < y.name ? -1 : 1))
      .slice(0, 2))
      factors.push({
        name: term.name,
        value: term.value,
        contribution: -term.value,
        source: { ref: term.source!, role: "pressure", weight: 1 },
      });
    for (const [voice, role, sign] of [
      [peace, "constraint", -1],
      [holy, "pressure", 1],
    ] as const)
      if (voice.strongest)
        factors.push({
          name: voice.strongest.name,
          value: voice.total,
          contribution: sign * Math.min(1, 2 * voice.total),
          source: voice.strongest.source ? { ref: voice.strongest.source, role, weight: 1 } : null,
        });
    // The land wanted is the one with the fullest stores.
    factors.push({
      name: "the stores of the land they want",
      value: stores(ctx, prize),
      contribution: 0.3,
      source: { ref: marketGoodRef(prize, G.grain), role: "enabler", weight: 1 },
    });
    if (last && rested < 1)
      factors.push({
        name: "the years since their last war",
        value: year - last.ended!,
        contribution: rested - 1,
        source: { ref: last.peace!, role: "constraint", weight: 1 },
      });
    // A land across the sea is fought for only with ships to carry the host.
    const ships = overseas(ctx, attacker, prize) ? shipCraft(ctx, attacker.seat) : null;
    if (ships)
      factors.push({
        name: "ships to carry the host",
        value: 1,
        contribution: 0.25,
        source: { ref: ships, role: "enabler", weight: 1 },
      });
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
      // No land left between them to fight over: the war ends, and history says so.
      w.ended = year;
      w.peace = world.events.emit({
        type: WAR_EVENTS.peace.type,
        subjects: [w.ref, a.ref, b.ref],
        place: ctx.provinces.get(a.seat)?.ref ?? null,
        causes: [{ ref: w.event, role: "trigger", weight: 1 }],
        data: { a: realmName(a), b: realmName(b), years: year - w.declared, won: false },
      });
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
        (1 + 0.3 * lore.effect(a.seat, "sieges")) *
        (overseas(ctx, a, land) ? LANDING : 1),
      hills = g.tectonics.elevation[land]! > 600 ? 1.3 : 1,
      river = g.water.river[land] ? 1.1 : 1,
      walls = 1 + 0.25 * lore.effect(land, "walls"),
      // Those who hold the land know its ground, and every village is a stronghold; at
      // its seat the whole realm stands.
      seat = land === b.seat,
      defend = strengthOf(ctx, b) * 1.5 * (seat ? 2 : 1) * hills * river * walls,
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
    // A seat is not taken in a day: the first victory there lays a siege, the second takes it.
    const besieged = seat && won && !w.battles.slice(0, -1).some((x) => x.land === land && x.won);
    if (won && !besieged) {
      const taken = world.events.emit({
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
      // A realm whose seat is taken falls, and its lands pass to its conqueror, aggrieved
      // (those not joined to the conqueror's own go their own way); else what the taken
      // land joined to its seat is cut off.
      if (land === b.seat) {
        for (const c of [...b.members]) {
          realms.leave(b, c);
          realms.join(a, c);
          realms.setDiscontent(c, { level: 0.6, cause: battle });
        }
        endRealm(ctx, b, t, { ref: battle, role: "trigger", weight: 1 });
        cutOff(ctx, a, taken);
      } else cutOff(ctx, b, taken);
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
      const rose = world.events.emit({
        type: WAR_EVENTS.rebellion.type,
        subjects: [p.ref, home.ref],
        place: cellRef(0, c),
        causes,
        data: { a: realmName(p), b: realmName(home) },
      });
      realms.leave(p, c);
      realms.join(home, c);
      realms.setDiscontent(c, { level: 0.2, cause: d.cause });
      cutOff(ctx, p, rose);
    }
  // The wars that ended this year will not change again: fold them into the digest.
  wars.seal();
}

/** Teach a peopled world its wars. */
export function installWar(world: World, ctx: () => PopulationContext): WarStore {
  const store = world.register(new WarStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "185.war.year", every: YEAR, run: (t) => warYear(ctx(), t) });
  return store;
}
