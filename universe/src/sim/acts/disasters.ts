// The god's disasters (Phase 13 M112): the ground shaken, fire fallen from the sky, a river
// risen — each a logged command whose event cites it, and each following through the
// simulation's own ledgers: the dead written as deaths, the stores spilled as spoiled, the
// fields ruined as a failed harvest (an act on the harvest the land's own year reads), the
// grief a grievance its realm must answer for. A meteor leaves a crater on the map for ever
// (kept with the acts).
import {
  YEAR,
  apportion,
  defineEventType,
  yearOfMoment,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import { GOODS, BANDS } from "../../rules/index.ts";
import { cellRef, offworldSite } from "../../gen/index.ts";
import { lessened } from "../lore/lessons-store.ts";
import { COLS } from "../population/model.ts";
import type { PopulationContext } from "../population/systems.ts";
import { handOf } from "../hand/hand.ts";
import { politiesOf } from "../polity/polity.ts";
import { citiesOf, USE } from "../city/city.ts";
import { razeTown } from "../town/fabric.ts";
import type { MarketStore } from "../economy/market.ts";
import { actStrengthOf, actsOf, strengthMark, strengthProblem } from "./acts.ts";

export const DISASTER_EVENTS = {
  quake: defineEventType("act.quake", 6),
  meteor: defineEventType("act.meteor", 6),
  flood: defineEventType("act.flood", 5),
};

/** How hard each disaster strikes what it falls on. */
export const DISASTER = {
  /** The ground shaken: a share of the people dead, of the stores spilled, of a city's blocks down. */
  quake: { dead: 0.04, stores: 0.3, blocks: 0.25, grief: 0.25 },
  /** Fire from the sky: many dead, most of the stores burned, the fields burned for years. */
  meteor: { dead: 0.2, stores: 0.8, blocks: 0.5, blighted: 2, grief: 0.4 },
  /** A river risen: a few drowned, the stores wet, the fields drowned a year here and downriver. */
  flood: { dead: 0.005, stores: 0.4, drowned: 1, downriver: 3, grief: 0.1 },
} as const;

/**
 * A share of a land's people dead, of every age and trade alike (never those the hand holds
 * as themselves): written into the ledger of deaths. How many died.
 */
export function strike(ctx: PopulationContext, cell: number, share: number, t: SimTime): number {
  const p = ctx.provinces.get(cell);
  if (!p) return 0;
  const year = yearOfMoment(t),
    held = handOf(ctx.world).composition(cell, year, ctx.life);
  let dead = 0;
  for (let r = 0; r < 2 * BANDS; r++)
    for (let o = 0; o < COLS; o++) {
      const free = p.counts.get(r, o) - (held ? held[r * COLS + o]! : 0),
        n = Math.floor(free * share);
      if (n <= 0) continue;
      p.counts.add(r, o, -n);
      ctx.history.addDeaths(cell, year, r % BANDS, n);
      dead += n;
    }
  return dead;
}

/** So many of a land's people dead, shared over its ledgers to the last one (no draw): how many. */
export function deathsIn(ctx: PopulationContext, cell: number, dead: number, t: SimTime): number {
  const p = ctx.provinces.get(cell);
  if (!p) return 0;
  const year = yearOfMoment(t),
    held = handOf(ctx.world).composition(cell, year, ctx.life),
    free: number[] = [];
  let all = 0;
  for (let r = 0; r < 2 * BANDS; r++)
    for (let o = 0; o < COLS; o++) {
      const n = Math.max(0, Math.floor(p.counts.get(r, o) - (held ? held[r * COLS + o]! : 0)));
      free.push(n);
      all += n;
    }
  const shares = apportion(Math.min(Math.max(0, Math.floor(dead)), all), free);
  let fell = 0;
  for (let r = 0; r < 2 * BANDS; r++)
    for (let o = 0; o < COLS; o++) {
      const n = shares[r * COLS + o]!;
      if (n <= 0) continue;
      p.counts.add(r, o, -n);
      ctx.history.addDeaths(cell, year, r % BANDS, n);
      fell += n;
    }
  return fell;
}

/** A share of each good a land holds spilled, burned or soaked: written as spoiled. */
export function spill(ctx: PopulationContext, cell: number, share: number): void {
  const m = ctx.world.store<MarketStore>("economy.markets").get(cell);
  if (!m) return;
  for (let g = 0; g < GOODS.length; g++) m.move("spoiled", g, Math.floor(m.stock[g]! * share));
}

/**
 * A share of a land's cities' built blocks brought down (the middle first): how many; and as
 * great a share of every town's homes there, the heart first (Phase 23) — how many of each
 * town's, into `homes` where it is given (Phase 42 M201: its event tells them).
 */
export function raze(
  ctx: PopulationContext,
  cell: number,
  share: number,
  t: SimTime,
  homes?: Record<string, number>,
): number {
  let down = 0;
  for (const v of ctx.settlements.inProvince(cell)) down += razeOne(ctx, v, share, t, homes);
  return down;
}

/** The same for one town (N1: what the world shakes down, by how near each town is): its homes about `near`, if it is given. */
export function razeOne(
  ctx: PopulationContext,
  v: { readonly ref: Ref },
  share: number,
  t: SimTime,
  homes?: Record<string, number>,
  near?: number,
): number {
  let down = 0;
  const n = razeTown(ctx, v.ref, share, t, near);
  if (homes && n > 0) homes[v.ref] = n;
  const city = citiesOf(ctx.world).get(v.ref);
  if (!city) return 0;
  const built = city.uses
    .map((u, k) => ({ u, k }))
    .filter((b) => b.u !== USE.open && b.u !== USE.temple);
  for (const b of built.slice(0, Math.ceil(built.length * share))) {
    city.uses[b.k] = USE.open;
    down++;
  }
  return down;
}

/** A land's grief laid on its realm: its grievance deepened, the disaster its cause. */
export function grieve(world: World, cell: number, amount: number, cause: Ref): void {
  const realms = politiesOf(world);
  if (!realms.of(cell)) return;
  const d = realms.discontent(cell);
  realms.setDiscontent(cell, {
    level: d.level + amount,
    cause: amount >= 0.2 || !d.cause ? cause : d.cause,
  });
}

type LandArgs = { cell: number; strength?: number };

/**
 * A disaster at a strength (asked 2026-11-13: a slider on the god's hand): its shares of the dead, the stores and the
 * homes, its grief, how long the fields stay ruined and how far a flood runs downriver, each so many times the one of
 * old (a share never past the whole, nor the dead past nine in ten). At 1, exactly as it always was.
 */
export function disasterAt<K extends keyof typeof DISASTER>(
  kind: K,
  s: number,
): { [P in keyof (typeof DISASTER)[K]]: number } {
  const k = DISASTER[kind] as Readonly<Record<string, number>>,
    out: Record<string, number> = {};
  for (const [name, v] of Object.entries(k))
    out[name] =
      s === 1
        ? v
        : name === "dead"
          ? Math.min(0.9, v * s)
          : name === "stores" || name === "blocks"
            ? Math.min(1, v * s)
            : name === "grief"
              ? v * s
              : Math.max(1, Math.round(v * s));
  return out as { [P in keyof (typeof DISASTER)[K]]: number };
}

/** Teach a peopled world the god's disasters (their craters kept with the acts). */
export function installDisasters(world: World, ctx: () => PopulationContext): void {
  const peopled = (args: unknown): string | null => {
      const cell = (args as Partial<LandArgs> | null)?.cell;
      if (!Number.isInteger(cell)) return "a land is wanted";
      const strong = strengthProblem(args);
      if (strong) return strong;
      const c = ctx();
      if (offworldSite(c.generated, cell!)) return "that land is not of this world";
      return (c.provinces.get(cell!)?.total() ?? 0) > 0 ? null : "no one lives there";
    },
    // The fields ruined: the land's harvest fails for so many years, and the act says why.
    ruin = (command: Ref, event: Ref, cell: number, years: number, t: SimTime) =>
      actsOf(world).add({
        command,
        event,
        kind: "harvest",
        cell,
        sign: -1,
        from: t,
        until: t + years * YEAR,
      }),
    agent = (command: { id: Ref }) => [{ ref: command.id, role: "agent" as const, weight: 1 }];

  // The ground shaken.
  world.defineCommand({
    type: "act.quake",
    validate: peopled,
    apply: (command, t) => {
      const c = ctx(),
        cell = (command.args as LandArgs).cell,
        s = actStrengthOf(command.args),
        k = disasterAt("quake", s),
        // (Frames its people have learned to brace stand through it: exactly 1 where they have learned nothing.)
        learned = lessened(world, cellRef(0, cell), "quake", yearOfMoment(t)),
        dead = strike(c, cell, k.dead * learned, t),
        homes: Record<string, number> = {},
        blocks = raze(c, cell, k.blocks * learned, t, homes);
      spill(c, cell, k.stores);
      const event = world.events.emit({
        type: DISASTER_EVENTS.quake.type,
        subjects: [c.provinces.get(cell)!.ref],
        place: c.provinces.get(cell)!.ref,
        causes: agent(command),
        data: { dead, blocks, homes, ...strengthMark(s) },
      });
      grieve(world, cell, k.grief, event);
    },
  });

  // Fire from the sky.
  world.defineCommand({
    type: "act.meteor",
    validate: peopled,
    apply: (command, t) => {
      const c = ctx(),
        cell = (command.args as LandArgs).cell,
        s = actStrengthOf(command.args),
        k = disasterAt("meteor", s),
        dead = strike(c, cell, k.dead, t),
        homes: Record<string, number> = {},
        blocks = raze(c, cell, k.blocks, t, homes);
      spill(c, cell, k.stores);
      const event = world.events.emit({
        type: DISASTER_EVENTS.meteor.type,
        subjects: [c.provinces.get(cell)!.ref],
        place: c.provinces.get(cell)!.ref,
        causes: agent(command),
        data: { dead, blocks, years: k.blighted, homes, ...strengthMark(s) },
      });
      ruin(command.id, event, cell, k.blighted, t);
      actsOf(world).addCrater({ cell, year: yearOfMoment(t), event });
      grieve(world, cell, k.grief, event);
    },
  });

  // A river risen: a river land's fields drowned, and those downriver.
  world.defineCommand({
    type: "act.flood",
    validate: (args) => {
      const bad = peopled(args);
      if (bad) return bad;
      const g = ctx().generated,
        cell = (args as LandArgs).cell;
      return g.water.river[cell] || g.water.lake[cell] ? null : "no river runs there to rise";
    },
    apply: (command, t) => {
      const c = ctx(),
        g = c.generated,
        cell = (command.args as LandArgs).cell,
        s = actStrengthOf(command.args),
        k = disasterAt("flood", s),
        // Downriver: the lands its water runs on to, as far as it keeps to the land.
        lands = [cell];
      for (let at = cell, i = 0; i < k.downriver; i++) {
        const next = g.water.flowTo[at]!;
        if (next < 0 || g.tectonics.elevation[next]! <= 0 || lands.includes(next)) break;
        lands.push(next);
        at = next;
      }
      let dead = 0;
      for (const l of lands) {
        dead += strike(
          c,
          l,
          (l === cell ? k.dead : k.dead / 2) *
            lessened(world, cellRef(0, l), "flood", yearOfMoment(t)),
          t,
        );
        spill(c, l, l === cell ? k.stores : k.stores / 2);
      }
      const event = world.events.emit({
        type: DISASTER_EVENTS.flood.type,
        subjects: [c.provinces.get(cell)!.ref],
        place: c.provinces.get(cell)!.ref,
        causes: agent(command),
        data: { dead, lands: lands.length, ...strengthMark(s) },
      });
      for (const l of lands) if (c.provinces.get(l)) ruin(command.id, event, l, k.drowned, t);
      grieve(world, cell, k.grief, event);
    },
  });
}
