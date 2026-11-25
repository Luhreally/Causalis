// A beast raised to thought (the Frontier lane; the rules are rules/beyond.ts UPLIFT). A realm whose people write bodies and
// write words may raise the beast of its world whose body leans most toward a mind: a few thousand of its young written
// a larger brain and taught, set down as the god's settlers are (acts/peoples.ts act.settle) in an empty land beside the
// realm's, with the realm's speech and ways of their own body's making, and the land joined to the realm. What follows is
// the simulation's own: their land carries its share of them (sim/population/mix.ts), so its births, its deaths and its
// mouths are their own body's (rules/peoples.ts raisedBody: their own weight, blood and years), and those of them who move
// take that with them; whether they and their makers can have young together is read off the world's tree of life; and
// their ways drift as any people's do. Once in some centuries a realm
// at most, each beast kind once a world. One row a raising.
import {
  Hasher,
  YEAR,
  apportion,
  defineEventType,
  defineStream,
  yearOfMoment,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { cellRef, type Species } from "../../gen/index.ts";
import {
  FEMALE,
  G,
  MALE,
  OCC,
  UPLIFT,
  raisedBody,
  upliftScore,
  upliftWays,
  type UpliftBeast,
} from "../../rules/index.ts";
import { knows, loreOf } from "../lore/lore.ts";
import { politiesOf, type Polity } from "../polity/polity.ts";
import { cultureOf } from "../culture/culture.ts";
import { Province, row as rowOf } from "../population/model.ts";
import {
  POPULATION_EVENTS,
  livableFor,
  marketsOf,
  type PopulationContext,
} from "../population/systems.ts";
import { addKind, setDown } from "../population/mix.ts";
import { fold, homeLands, refNumber } from "./common.ts";

export const UPLIFT_EVENTS = {
  /** A beast kind raised to thought, set down in a land of the realm that raised it. */
  raised: defineEventType("frontier.uplift", 7),
};

const UPLIFT_STREAM = defineStream("frontier.uplift");

/** The shares of a new people by band of age, youngest first (as the first people's: population/world.ts). */
const PYRAMID = [0.16, 0.13, 0.12, 0.1, 0.17, 0.13, 0.09, 0.05, 0.03, 0.02];

export type Raising = {
  readonly realm: Ref;
  readonly year: number;
  /** The beast kind raised, its name, the land they were set down in, how many. */
  readonly species: string;
  readonly name: string;
  readonly cell: number;
  readonly founders: number;
  readonly event: Ref;
};

export class UpliftStore implements StateStore {
  readonly name = "frontier.uplift";
  raisings: Raising[] = [];
  private readonly digest: [number, number] = [0x811c9dc5, 0];

  dormant(): boolean {
    return !this.raisings.length;
  }
  pinned(): Ref[] {
    return this.raisings.map((r) => r.event);
  }
  hashInto(h: Hasher): void {
    if (this.dormant()) return;
    h.value(this.raisings).int(this.digest[0]).int(this.digest[1]);
  }
  save(): unknown {
    if (this.dormant()) return {};
    return { raisings: this.raisings, digest: [...this.digest] };
  }
  load(state: unknown): void {
    const s = (state ?? {}) as { raisings?: Raising[]; digest?: [number, number] };
    this.raisings = [...(s.raisings ?? [])];
    this.digest[0] = s.digest?.[0] ?? 0x811c9dc5;
    this.digest[1] = s.digest?.[1] ?? 0;
  }
  add(r: Raising): void {
    this.raisings.push(r);
    fold(this.digest, [refNumber(r.realm), r.year, r.cell, r.founders]);
  }
  /** A realm's last raising. */
  lastOf(realm: Ref): Raising | undefined {
    for (let i = this.raisings.length - 1; i >= 0; i--)
      if (this.raisings[i]!.realm === realm) return this.raisings[i];
    return undefined;
  }
}

export function upliftOf(world: World): UpliftStore | null {
  return world.peek<UpliftStore>("frontier.uplift") ?? null;
}

/** A beast as the uplift reads it (null: a grass, or the people themselves). */
export function beastOf(s: Species): UpliftBeast | null {
  if (!s.body) return null;
  return {
    size: s.size,
    herd: s.herd,
    docility: s.docility,
    level: s.level,
    warm: s.body.warm,
    arms: s.body.arms ?? 0,
  };
}

/** The beast kind of a world whose body leans most toward a mind, not yet raised (null: none can be). */
export function mostRaisable(ctx: PopulationContext, raised: ReadonlySet<string>): Species | null {
  let best: Species | null = null,
    most = 0;
  for (const s of ctx.generated.life.species) {
    if (s.died !== null || raised.has(s.ref)) continue;
    const b = beastOf(s),
      score = b ? upliftScore(b) : 0;
    if (score > most) {
      most = score;
      best = s;
    }
  }
  return best;
}

/** An empty land of the home world beside a realm's, that its people could live in (the lowest such, null: none). */
function landFor(ctx: PopulationContext, p: Polity): number | null {
  const g = ctx.generated,
    base = homeLands(g),
    realms = politiesOf(ctx.world);
  let best: number | null = null;
  for (const c of p.members) {
    if (c >= base) continue;
    for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++) {
      const m = g.grid.neighbours[k]!;
      if (m >= base || (best !== null && m >= best)) continue;
      if ((ctx.provinces.get(m)?.total() ?? 0) > 0 || realms.of(m)) continue;
      if (livableFor(ctx, m)) best = m;
    }
  }
  return best;
}

/** The raisings' year: a realm able to may raise the beast most like a mind. */
export function upliftYear(ctx: PopulationContext, t: SimTime): void {
  const world = ctx.world,
    store = upliftOf(world);
  if (!store) return;
  const year = yearOfMoment(t),
    raised = new Set(store.raisings.map((r) => r.species)),
    lore = loreOf(world);
  for (const p of politiesOf(world).living()) {
    if (!knows(ctx, p.seat, "made-bodies") || !knows(ctx, p.seat, "writing")) continue;
    const last = store.lastOf(p.ref);
    if (last && year - last.year < UPLIFT.gapYears) continue;
    if (!(world.rng.real(UPLIFT_STREAM, p.seat, t, 0) < UPLIFT.chance)) continue;
    const beast = mostRaisable(ctx, raised),
      body = beast ? beastOf(beast) : null,
      seatWays = cultureOf(world).get(p.seat);
    if (!beast || !body || !seatWays) continue;
    const cell = landFor(ctx, p);
    if (cell === null) continue;
    const known = lore.get(p.seat, "made-bodies"),
      founders = UPLIFT.founders,
      event = world.events.emit({
        type: UPLIFT_EVENTS.raised.type,
        place: cellRef(0, cell),
        subjects: [p.ref, beast.ref as Ref],
        causes: known ? [{ ref: known.event, role: "enabler", weight: 1 }] : [],
        data: { realm: p.town, beast: beast.name, founders, kg: Math.round(beast.size) },
      });
    // Set down as settlers are: a land, its people of every age, half a year's food brought, the realm's speech.
    let dest = ctx.provinces.get(cell);
    if (!dest) {
      dest = ctx.provinces.add(new Province(cell, year, event));
      world.events.emit({
        type: POPULATION_EVENTS.peopled.type,
        place: dest.ref,
        causes: [{ ref: event, role: "trigger", weight: 1 }],
        data: { people: founders },
      });
    }
    const life = ctx.life,
      held = dest.total();
    apportion(founders, PYRAMID.slice(0, life.bands.length)).forEach((k, b) => {
      const [women, men] = apportion(k, [1, 1]),
        occupation = life.bands[b]! >= life.adulthood ? OCC.forager : OCC.dependent;
      dest.counts.add(rowOf(FEMALE, b), occupation, women!);
      dest.counts.add(rowOf(MALE, b), occupation, men!);
    });
    // (A people of their own on the world: their land's births, deaths and mouths are their own body's from here.)
    const makers = ctx.generated.life.people?.body;
    if (makers)
      setDown(
        world,
        cell,
        addKind(world, {
          key: `raised:${beast.ref}`,
          name: `the ${beast.name}`,
          body: raisedBody(makers, { name: beast.name, size: beast.size, warm: body.warm }),
          species: beast.index,
          of: null,
          blend: 0,
          since: year,
          event,
        }),
        founders,
        held,
      );
    marketsOf(world)
      .of(cell)
      .move("carriedIn", G.wild, founders * 6);
    const traits = upliftWays(body);
    // (Their makers' speech, taught; their ways their own body's.)
    cultureOf(world).set({
      cell,
      traits: [...traits],
      base: [...traits],
      tongue: { ...seatWays.tongue },
      nudges: [],
      from: event,
    });
    politiesOf(world).join(p, cell);
    store.add({
      realm: p.ref,
      year,
      species: beast.ref,
      name: beast.name,
      cell,
      founders,
      event,
    });
    raised.add(beast.ref);
  }
}

/** Teach a world its raisings. */
export function installUplift(world: World, ctx: () => PopulationContext): UpliftStore {
  const store = world.register(new UpliftStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "209.frontier.uplift", every: YEAR, run: (t) => upliftYear(ctx(), t) });
  return store;
}
