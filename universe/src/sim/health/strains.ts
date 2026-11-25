// Sicknesses that evolve (Round D; the rules are rules/pathogens.ts). Once a year, after sickness has spread
// (health.ts healthYear), each sickness that burned this year is tried by the hosts it passed through: its harm moves
// toward the harm that spreads it best for how it passes and how crowded the lands it burns are, and its reach with it
// along its trade-off, the faster the more hosts it took; where most of those it burns among were spared it, a strain
// they are not spared may rise, a sickness of its own. A sickness passing among one people narrows to them; one that
// can still live in herds waits in them when it sleeps, comes back to a herding land, and is never gone while herds
// are kept. And its hosts answer it (2026-11-24, rules/heredity.ts resistAfter, harmAmong): those of a people it kills
// leave no more young, so the share of them that resists it grows by as many as it killed, slowly at first; its harm among
// hosts who resist it is the less, below the harm that spreads it best, and the next year's selection draws it back up:
// each one's trait moved by the other's pressure. One number more a sickness.
// One row of numbers a sickness, a few dozen at most; its harm and reach a decade, thinned as they age.
import {
  YEAR,
  defineStream,
  yearOfMoment,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import {
  EVOLVE,
  FIRST_RANGE,
  HEREDITY,
  harmAmong,
  resistAfter,
  bestDeadliness,
  reachFor,
  selectionPace,
  strainChance,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { switchedOff } from "../acts/switches.ts";
import { loreOf } from "../lore/lore.ts";
import { herdKept } from "../belief/taboo.ts";
import { HEALTH_EVENTS, SICK, branchSickness, healthOf, strike, type Sickness } from "./health.ts";

const STRAIN = defineStream("health.strain");
const SPILL = defineStream("health.spill");

/** A sickness's line: what it was when it rose, its parent, how wide its hosts, its harm and reach a decade. */
export type StrainLine = {
  readonly ref: Ref;
  readonly parent: Ref | null;
  /** Its reach and harm as it rose: its trade-off's anchor. */
  readonly first: { readonly reach: number; readonly deadliness: number };
  /** How wide its host range is (0: its people alone … 1: any kind of its world's life). */
  range: number;
  /** Strains it has thrown up. */
  strains: number;
  /** The last year selection moved it, and how many hosts it took then. */
  tried: number;
  taken: number;
  /** [year, harm ×1000, reach ×1000], once a decade it burned, thinned as they age. */
  past: number[][];
  /** Of its hosts, the share that resists it (millionths; absent: as many as happen to before it has tried them). */
  resist?: number;
  /** Its hosts' resisting it told (once doubled from where it stood). */
  resisted?: 1;
};

const PAST_MOST = 30;

export class StrainStore implements StateStore {
  readonly name = "health.strains";
  lines: StrainLine[] = [];
  get(ref: Ref | string): StrainLine | undefined {
    return this.lines.find((l) => l.ref === ref);
  }
  dormant(): boolean {
    return this.lines.length === 0;
  }
  hashInto(h: Hasher): void {
    if (this.lines.length) h.value(this.lines);
  }
  save(): unknown {
    return this.lines.length ? { lines: this.lines } : {};
  }
  load(state: unknown): void {
    const s = (state ?? {}) as { lines?: StrainLine[] };
    this.lines = (s.lines ?? []).map((l) => ({ ...l, past: l.past.map((r) => [...r]) }));
  }
}

export function strainsOf(world: World): StrainStore | null {
  return world.peek<StrainStore>("health.strains") ?? null;
}

/** A sickness's line, begun as it rose (its range by where it rose) where it has none yet. */
function lineOf(store: StrainStore, s: Sickness, parent: Ref | null, range?: number): StrainLine {
  let l = store.get(s.ref);
  if (!l) {
    l = {
      ref: s.ref,
      parent,
      first: { reach: s.reach, deadliness: s.deadliness },
      range: range ?? FIRST_RANGE[s.source] ?? 0.2,
      strains: 0,
      tried: -1,
      taken: 0,
      past: [],
    };
    store.lines.push(l);
  }
  return l;
}

function note(l: StrainLine, year: number, s: Sickness): void {
  if (l.past.length && year - l.past.at(-1)![0]! < 10) return;
  l.past.push([year, Math.round(s.deadliness * 1000), Math.round(s.reach * 1000)]);
  if (l.past.length > PAST_MOST) {
    const half = l.past.length >> 1;
    l.past = [...l.past.slice(0, half).filter((_, i) => i % 2 === 0), ...l.past.slice(half)];
  }
}

/** The year's selection on every sickness that burned, its new strains, and the herds' sicknesses come back. */
export function strainsYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    health = healthOf(world),
    store = strainsOf(world),
    lore = loreOf(world);
  if (!health || !store) return;
  const year = yearOfMoment(t),
    // (A sickness gone this year may yet live on in the herds: tried below.)
    // (One settled among the young is followed no longer: health.ts settle.)
    living = health.sicknesses.filter(
      (s) => s.settled === null && (s.ended === null || s.ended === year),
    );
  if (!living.length && !store.lines.length) return;
  // The lands each burned in this year: how many it took there, how crowded they were, how many there are spared it.
  const burned = new Map<
    Ref,
    { taken: number; people: number; spared: number; lands: number; cell: number; drained: number }
  >();
  for (const l of [...health.lands.values()].sort((a, b) => a.cell - b.cell)) {
    const o = l.last;
    if (!o || o.year !== year) continue;
    const s = health.get(o.sickness);
    if (!s) continue;
    const people = ctx.provinces.get(l.cell)?.total() ?? 0,
      b = burned.get(s.ref) ?? {
        taken: 0,
        people: 0,
        spared: 0,
        lands: 0,
        cell: l.cell,
        drained: 0,
      };
    b.taken += Math.min(people + o.dead, o.dead / Math.max(1e-3, s.deadliness));
    b.people += people;
    b.spared += health.immune(l.cell, s.ref);
    if (lore.get(l.cell, "sanitation")) b.drained += people;
    b.lands++;
    if (people > (ctx.provinces.get(b.cell)?.total() ?? 0)) b.cell = l.cell;
    burned.set(s.ref, b);
  }
  const off = switchedOff(world, "plagues");
  for (const s of living) {
    const l = lineOf(store, s, null),
      b = s.ended === null ? burned.get(s.ref) : undefined;
    if (b) {
      // Selection: harm toward what spreads it best among hosts this crowded, reach along its trade-off.
      const crowded = b.people / b.lands,
        drained = b.people > 0 ? b.drained / b.people : 0,
        best = bestDeadliness(s.route, crowded, drained, s.lasting),
        pace = selectionPace(b.taken);
      s.deadliness += pace * (best - s.deadliness);
      s.reach += pace * (reachFor(s.route, s.deadliness, l.first, drained, s.lasting) - s.reach);
      // Its hosts answer: those it killed (of those it burned among) left none, and the share that resists it is the more;
      // its harm among them the less by it. (The next year's selection draws its harm back toward what spreads it best.)
      const dead = Math.min(b.taken * s.deadliness, b.taken),
        was = (l.resist ?? HEREDITY.standing * 1e6) / 1e6,
        now = resistAfter(was, dead / Math.max(1, b.people + dead), HEREDITY.heritability.sickness),
        kept = Math.round(now * 1e6);
      if (kept !== Math.round(was * 1e6)) {
        l.resist = kept;
        s.deadliness = Math.max(0.002, (s.deadliness * harmAmong(now)) / harmAmong(was));
        if (!l.resisted && now >= 2 * HEREDITY.standing) {
          l.resisted = 1;
          world.events.emit({
            type: HEALTH_EVENTS.resisted.type,
            subjects: [s.ref],
            place: ctx.provinces.get(b.cell)?.ref ?? null,
            causes: [{ ref: s.event, role: "trigger", weight: 1 }],
            data: {
              sickness: s.name,
              resist: Math.round(now * 1000),
              harm: Math.round(s.deadliness * 1000),
              year,
            },
          });
        }
      }
      // It narrows to the people it passes among.
      l.range = Math.max(0, l.range * (1 - EVOLVE.narrows));
      l.tried = year;
      l.taken = Math.round(b.taken);
      note(l, year, s);
      // A strain the spared are not spared.
      const spared = b.spared / b.lands,
        chance = strainChance(spared, b.taken, s.lasting);
      if (
        !off &&
        chance > 0 &&
        health.about(year) < SICK.most &&
        world.rng.real(STRAIN, health.sicknesses.indexOf(s), t, 0) < chance
      ) {
        const u = (k: number) => world.rng.real(STRAIN, health.sicknesses.indexOf(s), t, k),
          deadliness = Math.min(0.6, s.deadliness * (1 + EVOLVE.drift * (2 * u(1) - 1))),
          // (Its harm and its reach either way from its parent's: drawn only upward, a sickness's strains climbed to reach
          // all but every one of those it came to.)
          reach = Math.min(0.95, s.reach * (1 + EVOLVE.drift * (2 * u(2) - 1))),
          event = health.land(b.cell)?.last?.event ?? s.event,
          child = branchSickness(ctx, s, b.cell, { reach, deadliness }, event, t, EVOLVE.cross);
        lineOf(store, child, s.ref, l.range);
        l.strains++;
      }
    }
    if (off) continue;
    // Asleep in the herds: back to the herding land it rose in, and never gone while they keep them.
    const unseen = year - s.last;
    if (l.range < EVOLVE.reservoir || unseen < SICK.sleeps) continue;
    const home = ctx.provinces.get(s.cell);
    if (!home?.herding || home.total() <= 0) continue;
    if (s.ended === year) s.ended = null;
    const imm = health.immune(s.cell, s.ref),
      // (Less as far as their creed keeps them off the herd: sim/belief/taboo.ts. Exactly as before where it forbids none.)
      chance = EVOLVE.spill * l.range * (1 - imm) * (1 - herdKept(world, s.cell));
    if (world.rng.real(SPILL, health.sicknesses.indexOf(s), t, 0) >= chance) continue;
    const event = world.events.emit({
      type: HEALTH_EVENTS.spilled.type,
      subjects: [s.ref],
      place: home.ref,
      causes: [
        { ref: home.herding, role: "enabler", weight: 1 },
        { ref: s.event, role: "enabler", weight: 0.5 },
      ],
      data: { sickness: s.name, range: Math.round(l.range * 100) },
    });
    strike(ctx, s, s.cell, t, {
      causes: [{ ref: event, role: "trigger", weight: 1 }],
      from: null,
      via: null,
    });
  }
}

/** A sickness's line, for its page. */
export function strainLine(world: World, ref: Ref | string): StrainLine | null {
  return strainsOf(world)?.get(ref) ?? null;
}

/** Teach a peopled world that its sicknesses evolve. */
export function installStrains(world: World, ctx: () => PopulationContext): StrainStore {
  const store = world.register(new StrainStore());
  world.system({ key: "188.health.year.strains", every: YEAR, run: (t) => strainsYear(ctx(), t) });
  return store;
}
