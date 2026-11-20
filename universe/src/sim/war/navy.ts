// Fleets, the sea fought for, and blockades, year by year (the last sweep, war; the rules are rules/navy.ts). 184.war.navy, before
// the war's year: each realm that knows ships and touches the sea builds toward the fleet it would keep, as its coasts' shipwrights
// and timber allow, and its hulls wear. It keeps as many as its sea interest, its footing (sim/war/arming.ts) and a feared rival's
// fleet within reach ask. In each war between realms the sea joins, the fleets fight for it, and each side's command of the sea
// is kept for the year. The war's year reads it for a host landed over the sea and for a coastal seat fed under siege. The
// economy's next year reads the blockade it lays on the beaten side's sea trade. The treasury reads what a fleet costs. No
// draws. One small row a realm with ships at sea, one a war fought at sea; none before the first hull, so the store is dormant
// until then.
import {
  defineEventType,
  yearOfMoment,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import {
  GOODS,
  NAVY,
  OCC,
  TON_YEAR,
  blockadeOf,
  seaCarried,
  fleetYear,
  hullQuality,
  landingShare,
  refitYears,
  seaMeets,
  navyWanted,
  seaBattle,
} from "../../rules/index.ts";
import { marketsOf, type PopulationContext } from "../population/systems.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { loreOf } from "../lore/lore.ts";
import { seaRange } from "../economy/sea.ts";
import { woodsRead } from "../ecology/woods.ts";
import { armsOf } from "./arms.ts";
import { footingOf, rivalsOf } from "./arming.ts";
import { warsOf, type War } from "./war.ts";

export const NAVY_EVENTS = {
  /** A realm's fleet won the sea in a war, or its foe's blockade closed its sea trade. */
  sea: defineEventType("war.sea", 4),
};

/** A realm's ships, as kept. */
export type Ships = {
  readonly realm: Ref;
  /** Tonnes of warships in commission, built this year and sunk this year; the tonnes it would keep. */
  tons: number;
  built: number;
  sunk: number;
  wanted: number;
  /** What a tonne is worth in a fight. */
  quality: number;
  /** Tonnes of merchant shipping its coastal traders keep (pressed to carry a host at war). */
  merchant: number;
  /** Its coasts' share of its people. */
  coast: number;
  /** How far its sea trade is cut by a foe's command of the sea (0 … 1). */
  blockaded: number;
  /** What its fleet costs it a year (grain's worth). */
  cost: number;
};

/** A war fought at sea: each side's command of it this year, what each has lost there, and what was told. */
export type SeaWar = {
  readonly war: Ref;
  command: [number, number];
  sunk: [number, number];
  won: Ref | null;
  blockade: Ref | null;
  /** The year the fleets last met; the year each may sail again after its refit; the meetings each has lost (absent: an older save's, none). */
  met?: number;
  refit?: [number, number];
  beaten?: [number, number];
};

const r3 = (x: number) => Math.round(x * 1000) / 1000;

function fold(d: [number, number], xs: readonly number[]): void {
  let a = d[0],
    b = d[1];
  for (const x of xs) {
    const lo = x | 0,
      hi = Math.floor(x / 4294967296) | 0;
    a = Math.imul(a ^ lo, 0x01000193) ^ hi;
    b = Math.imul(b + lo + 0x9e3779b9, 0x85ebca6b) ^ (b >>> 13);
  }
  d[0] = a;
  d[1] = b;
}

const refNumber = (r: Ref): number => {
  const n = Number(r.split(":").at(-1));
  return Number.isFinite(n) ? n : r.length;
};

export class NavyStore implements StateStore {
  readonly name = "war.navy";
  private readonly fleets = new Map<Ref, Ships>();
  private readonly seas = new Map<Ref, SeaWar>();
  private readonly digest: [number, number] = [0x811c9dc5, 0];
  private sets = 0;
  dormant(): boolean {
    return this.fleets.size === 0 && this.seas.size === 0;
  }
  of(realm: Ref): Readonly<Ships> | undefined {
    return this.fleets.get(realm);
  }
  sea(war: Ref): Readonly<SeaWar> | undefined {
    return this.seas.get(war);
  }
  realms(): Ref[] {
    return [...this.fleets.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
  wars(): Ref[] {
    return [...this.seas.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
  set(f: Ships): void {
    this.fleets.set(f.realm, f);
    fold(this.digest, [
      refNumber(f.realm),
      Math.round(f.tons),
      Math.round(f.wanted),
      Math.round(f.merchant),
      Math.round(f.blockaded * 1000),
    ]);
    this.sets++;
  }
  setSea(s: SeaWar): void {
    this.seas.set(s.war, s);
    fold(this.digest, [
      refNumber(s.war),
      Math.round(s.command[0] * 1000),
      Math.round(s.sunk[0]),
      Math.round(s.sunk[1]),
      s.met ?? 0,
    ]);
    this.sets++;
  }
  drop(realm: Ref): void {
    this.fleets.delete(realm);
  }
  dropSea(war: Ref): void {
    this.seas.delete(war);
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const s of this.seas.values()) {
      if (s.won) out.push(s.won);
      if (s.blockade) out.push(s.blockade);
    }
    return out;
  }
  hashInto(h: Hasher): void {
    h.int(this.fleets.size)
      .int(this.seas.size)
      .int(this.sets)
      .int(this.digest[0])
      .int(this.digest[1]);
  }
  save(): unknown {
    return {
      fleets: this.realms().map((r) => this.fleets.get(r)),
      seas: this.wars().map((w) => this.seas.get(w)),
      digest: [...this.digest],
      sets: this.sets,
    };
  }
  load(state: unknown): void {
    this.fleets.clear();
    this.seas.clear();
    const s = state as {
      fleets?: Ships[];
      seas?: SeaWar[];
      digest?: [number, number];
      sets?: number;
    } | null;
    for (const f of s?.fleets ?? []) this.fleets.set(f.realm, { ...f });
    for (const w of s?.seas ?? [])
      this.seas.set(w.war, {
        ...w,
        command: [...w.command],
        sunk: [...w.sunk],
        ...(w.refit ? { refit: [...w.refit] } : {}),
        ...(w.beaten ? { beaten: [...w.beaten] } : {}),
      });
    this.digest[0] = s?.digest?.[0] ?? 0x811c9dc5;
    this.digest[1] = s?.digest?.[1] ?? 0;
    this.sets = s?.sets ?? 0;
  }
}

export function navyOf(world: World): NavyStore | null {
  return world.peek<NavyStore>("war.navy") ?? null;
}

// —— What the other systems read ——————————————————————————————————————————————————————————————————————

/** A side's command of the sea in a war this year (0 … 1), or null where the sea was not fought for. */
export function seaCommand(world: World, war: Ref, side: 0 | 1): number | null {
  const s = navyOf(world)?.sea(war);
  return s ? s.command[side] : null;
}

/**
 * The share of its strength a host landed over the sea fights at: by its fleet's command of the sea and how much of it the
 * hulls carry. `base` (the old even landing) where the sea was not fought for and the realm keeps no ships.
 */
export function landingOf(world: World, w: War, side: 0 | 1, men: number, base: number): number {
  const store = navyOf(world);
  if (!store) return base;
  const f = store.of(side === 0 ? w.attacker : w.defender),
    s = store.sea(w.ref);
  if (!f && !s) return base;
  return landingShare(s ? s.command[side] : 0.5, seaCarried(f?.tons ?? 0, f?.merchant ?? 0, men));
}

/** How far a realm's sea trade is cut by a foe's command of the sea (0 where none is). */
export function blockadeOn(world: World, realm: Ref | null | undefined): number {
  return realm ? (navyOf(world)?.of(realm)?.blockaded ?? 0) : 0;
}

/** What a realm's fleet costs it a year (grain's worth): 0 where it keeps none. */
export function navyCost(world: World, realm: Ref): number {
  return navyOf(world)?.of(realm)?.cost ?? 0;
}

/** Of a coastal seat's food, the share its realm's ships bring in under siege in a war: 0 where it holds no sea. */
export function seaRelief(world: World, w: War, side: 0 | 1): number {
  const c = seaCommand(world, w.ref, side);
  return c === null ? 0 : NAVY.relief * c;
}

/** Whether a land touches the sea. */
export function coastal(ctx: PopulationContext, cell: number): boolean {
  return (ctx.generated.climate.inland[cell] ?? 0) === 1;
}

// —— The year ——————————————————————————————————————————————————————————————————————————————————————

/** Whether the sea joins two realms: a coast of one reaches a land of the other over it, or their coasts touch. */
function seaBetween(ctx: PopulationContext, a: Polity, b: Polity): boolean {
  const g = ctx.generated,
    markets = marketsOf(ctx.world),
    theirs = new Set(b.members);
  for (const c of a.members) {
    if (!coastal(ctx, c)) continue;
    for (const n of markets.seaPartners(c)) if (theirs.has(n)) return true;
    for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++) {
      const n = g.grid.neighbours[k]!;
      if (theirs.has(n) && coastal(ctx, n)) return true;
    }
  }
  return false;
}

/** What a realm's coasts and works give its fleet: its coasts' share, what its wrights can build, its merchantmen, what a worker makes. */
function shoresOf(
  ctx: PopulationContext,
  p: Polity,
): { coast: number; canBuild: number; merchant: number; made: number; worth: number } {
  const markets = marketsOf(ctx.world),
    lore = loreOf(ctx.world),
    steel = lore.effect(p.seat, "power") > 0 && seaRange(lore, p.seat) >= 16;
  let people = 0,
    shore = 0,
    wrights = 0,
    wooded = 0,
    coasts = 0,
    traders = 0,
    made = 0,
    workers = 0;
  for (const c of p.members) {
    const prov = ctx.provinces.get(c),
      m = markets.get(c);
    if (!prov || prov.total() <= 0) continue;
    const n = prov.total();
    people += n;
    workers += Math.max(1, n - prov.occupation(OCC.dependent));
    if (m) for (let g = 0; g < GOODS.length; g++) made += m.book("made", g) * m.price[g]!;
    if (!coastal(ctx, c)) continue;
    shore += n;
    coasts++;
    wrights += prov.occupation(OCC.crafter) * NAVY.wrights;
    traders += prov.occupation(OCC.trader);
    wooded += woodsRead(ctx, c).now;
  }
  // (Timber from its coasts' woods, and what it brings in besides; from steam on, its works give the hulls.)
  const timber = steel ? 1 : 0.25 + 0.75 * Math.min(1, coasts ? (2 * wooded) / coasts : 0);
  return {
    coast: people > 0 ? shore / people : 0,
    canBuild: (wrights / NAVY.build) * timber,
    merchant: traders * NAVY.merchant,
    made,
    worth: workers > 0 ? made / workers : 0,
  };
}

/** Every realm's fleet built and worn, the sea fought for in each war it joins, and the blockades it lays. */
export function navyYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = navyOf(world);
  if (!store) return;
  const realms = politiesOf(world),
    wars = warsOf(world),
    lore = loreOf(world),
    living = realms.living(),
    alive = new Set(living.map((p) => p.ref));
  for (const r of store.realms()) if (!alive.has(r)) store.drop(r);
  const hot = wars.hot().filter((w) => w.ended === null && !w.civil),
    { rivals } = rivalsOf(world, alive),
    between = new Map<string, boolean>(),
    sea = (a: Polity, b: Polity) => {
      const key = a.ref < b.ref ? `${a.ref}|${b.ref}` : `${b.ref}|${a.ref}`;
      let s = between.get(key);
      if (s === undefined) between.set(key, (s = seaBetween(ctx, a, b) || seaBetween(ctx, b, a)));
      return s;
    };
  // 1. Each realm's fleet: built toward what it would keep, and worn.
  const fleets = new Map<Ref, Ships>(),
    wrights = new Map<Ref, number>(),
    year = yearOfMoment(t);
  for (const p of living) {
    const was = store.of(p.ref),
      steps = seaRange(lore, p.seat);
    if (steps <= 0 && !was) continue;
    const shores = shoresOf(ctx, p);
    if (shores.coast <= 0 && !was) continue;
    const atSea = wars.fighting(p.ref).some((w) => {
        const q = realms.get(w.attacker === p.ref ? w.defender : w.attacker);
        return !!q && !w.civil && sea(p, q);
      }),
      // (A feared rival's fleet within reach, by the fear.)
      rival = (rivals.get(p.ref) ?? []).reduce((most, r) => {
        const q = realms.get(r.of),
          theirs = store.of(r.of)?.tons ?? 0;
        return q && theirs > 0 && sea(p, q) ? Math.max(most, r.level * theirs) : most;
      }, 0),
      wanted =
        steps > 0
          ? navyWanted({
              made: shores.made,
              worth: shores.worth,
              coast: shores.coast,
              atSea,
              footing: footingOf(world, p.ref),
              rival,
            })
          : 0,
      grown = fleetYear(was?.tons ?? 0, wanted, steps > 0 ? shores.canBuild : 0),
      arms = armsOf(ctx, p),
      f: Ships = {
        realm: p.ref,
        tons: Math.round(grown.tons),
        built: Math.round(grown.built),
        sunk: 0,
        wanted: Math.round(wanted),
        quality: r3(hullQuality(arms.power, arms.fire + arms.breach, steps)),
        merchant: steps > 0 ? Math.round(shores.merchant) : 0,
        coast: r3(shores.coast),
        blockaded: 0,
        cost: Math.round(grown.tons * TON_YEAR * shores.worth),
      };
    if (f.tons <= 0 && f.merchant <= 0) {
      if (was) store.drop(p.ref);
      continue;
    }
    fleets.set(p.ref, f);
    wrights.set(p.ref, steps > 0 ? shores.canBuild : 0);
  }
  // 2. The sea fought for in each war it joins, where either side has warships.
  const fought = new Set<Ref>();
  for (const w of hot) {
    const a = realms.get(w.attacker),
      b = realms.get(w.defender);
    if (!a || !b || a.ended !== null || b.ended !== null || !sea(a, b)) continue;
    const fa = fleets.get(a.ref),
      fb = fleets.get(b.ref);
    if (!(fa?.tons ?? 0) && !(fb?.tons ?? 0)) continue;
    const all = seaBattle(fa?.tons ?? 0, fa?.quality ?? 0, fb?.tons ?? 0, fb?.quality ?? 0),
      kept = store.sea(w.ref),
      refit: [number, number] = [kept?.refit?.[0] ?? 0, kept?.refit?.[1] ?? 0],
      beaten: [number, number] = [kept?.beaten?.[0] ?? 0, kept?.beaten?.[1] ?? 0],
      // (The fleets meet where both are at sea and the weaker will give battle; else each holds what its strength commands,
      // the weaker in port, and nothing is sunk: rules seaMeets.)
      meets = seaMeets(all.command, [refit[0] >= year, refit[1] >= year], beaten),
      s = meets ? all : { command: all.command, sunk: [0, 0] as [number, number] };
    if (meets) {
      const lost = all.command[0] >= all.command[1] ? 1 : 0;
      beaten[lost]++;
      refit[0] = year + refitYears(all.sunk[0], wrights.get(a.ref) ?? 0);
      refit[1] = year + refitYears(all.sunk[1], wrights.get(b.ref) ?? 0);
    }
    const row: SeaWar = {
      war: w.ref,
      command: [r3(s.command[0]), r3(s.command[1])],
      sunk: [
        Math.round((kept?.sunk[0] ?? 0) + s.sunk[0]),
        Math.round((kept?.sunk[1] ?? 0) + s.sunk[1]),
      ],
      won: kept?.won ?? null,
      blockade: kept?.blockade ?? null,
      ...(meets ? { met: year } : kept?.met !== undefined ? { met: kept.met } : {}),
      ...(meets || kept?.refit ? { refit } : {}),
      ...(meets || kept?.beaten ? { beaten } : {}),
    };
    if (fa) {
      fa.sunk += Math.round(s.sunk[0]);
      fa.tons = Math.max(0, Math.round(fa.tons - s.sunk[0]));
    }
    if (fb) {
      fb.sunk += Math.round(s.sunk[1]);
      fb.tons = Math.max(0, Math.round(fb.tons - s.sunk[1]));
    }
    // (Each side blockaded as far as the other commands the sea: the greatest of its wars.)
    for (const [side, f] of [
      [0, fa],
      [1, fb],
    ] as const)
      if (f) f.blockaded = r3(Math.max(f.blockaded, blockadeOf(row.command[1 - side]!)));
    // (Told: the sea won from a foe that had ships, and a blockade closing a side's trade.)
    const tell = (kind: "won" | "blockade", by: Polity, on: Polity) =>
      world.events.emit({
        type: NAVY_EVENTS.sea.type,
        subjects: [w.ref, by.ref, on.ref],
        place: null,
        causes: [{ ref: w.event, role: "trigger", weight: 1 }],
        data: { a: realmName(by), b: realmName(on), kind, sunk: row.sunk },
      });
    const leader = row.command[0] >= row.command[1] ? 0 : 1,
      [by, on] = leader === 0 ? [a, b] : [b, a],
      theirs = leader === 0 ? fb : fa;
    if (!row.won && row.command[leader]! >= 0.8 && (theirs?.tons ?? 0) + row.sunk[1 - leader]! > 0)
      row.won = tell("won", by, on);
    if (
      !row.blockade &&
      blockadeOf(row.command[leader]!) >= 0.5 &&
      on.members.some((c) => coastal(ctx, c))
    )
      row.blockade = tell("blockade", by, on);
    store.setSea(row);
    fought.add(w.ref);
  }
  // (A war no longer fought at sea, or over, keeps nothing.)
  for (const r of store.wars()) if (!fought.has(r)) store.dropSea(r);
  for (const f of fleets.values()) store.set(f);
}
