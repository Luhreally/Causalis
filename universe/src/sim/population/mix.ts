// More than one people on a world (the breadth gaps, 2026-11-24; the rules are rules/peoples.ts). A world keeps one life
// table, its first people's, and one number of people a land. Where a land holds a people besides (a beast raised to
// thought: sim/frontier/uplift.ts; those born of two peoples), it carries its shares by people, in thousandths: a few
// numbers on that land alone. A world of one people holds nothing here, is hashed as if this were not there, and pays one
// look a month.
//   What a mixed land's births, deaths and mouths are is each people's own body's (its own table read on the world's bands),
//     weighed by its share: population/systems.ts vitalMonth and foodMonth read `mixFactors`.
//   Once a year each mixed land's shares move by each people's own births and deaths, as the land was fed and pressed; and
//     where two peoples of a land can have young together (their kinship in the tree of life, their chemistry), those born of
//     both are a people of their own, whose body is the blend. Where they cannot, the shares stay apart.
//   Those who move take their land's shares with them (migrateYear).
//   Natives and settlers: where a realm's colony comes down on a world whose own people live (sim/space/farlife.ts
//     landingsYear), those of them whose ground its land is are of its land from that year (`nativesDown`), as many as
//     their numbers give one land of their world, no more than the colony can know as neighbours (as many as itself), and
//     only where they can live on what the settlers grow (rules/biochem.ts eats). They are not of the settlers' tree of
//     life: the two have no young together, and the land's shares move by each one's own table.
import {
  YEAR,
  defineEventType,
  yearOfMoment,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { cellRef, treeOfLife, worldLife, type HomeWorld } from "../../gen/index.ts";
import {
  FEMALE,
  MALE,
  OCC,
  CLADES,
  PEOPLES,
  WAY,
  blendBody,
  crossBorn,
  crossFertility,
  generationOf,
  pairingOf,
  ratesOf,
  sharesAfter,
  type BodyPlan,
  type Kinship,
  type PeopleRates,
} from "../../rules/index.ts";
import { cultureOf } from "../culture/culture.ts";
import { homePlanet } from "../planet/store.ts";
import { apportion } from "../../kernel/index.ts";
import { lifeOfBody, peopleLife } from "./life.ts";
import { row as rowOf, type Province } from "./model.ts";
import type { PopulationContext } from "./systems.ts";

export const MIX_EVENTS = {
  /** A land's people are now mostly of another people than they were. */
  outgrew: defineEventType("peoples.outgrew", 4),
  /** Two peoples of a land have young together: a people born of both. */
  born: defineEventType("peoples.born-of-two", 6),
};

/** A people of a world besides its first. */
export type MixKind = {
  /** What it is keyed by: a raised beast's lineage ref, or the two it is born of. */
  readonly key: string;
  readonly name: string;
  /** Its own body; for those born of two, null: the blend of the two, by `blend`. */
  readonly body: BodyPlan | null;
  /** The lineage of the home world's tree it is of (null: none of its own). */
  readonly species: number | null;
  /** The two peoples it is born of (0: the world's first; n: the n-th here), and how much of the first is in it (thousandths). */
  readonly of: readonly [number, number] | null;
  blend: number;
  readonly since: number;
  readonly event: Ref | null;
};

/** Two peoples read against each other, once: whether they can have young together (thousandths of their crossings). */
export type Crossing = {
  readonly a: number;
  readonly b: number;
  readonly fertility: number;
  readonly decision: Ref;
};

type Factors = { births: number; deaths: number[]; appetite: number };

export class MixStore implements StateStore {
  readonly name = "population.mix";
  kinds: MixKind[] = [];
  /** A mixed land's shares, thousandths: the world's first people's, then each of `kinds`. */
  readonly lands = new Map<number, number[]>();
  crossings: Crossing[] = [];
  /** What is tallied since the world began: years a land's shares moved, young born of two (thousandths of a land's people). */
  tally = { moved: 0, crossed: 0 };
  // (Never saved: each people's numbers against the world's table, and each mixed land's weighed.)
  rates: (PeopleRates | undefined)[] = [];
  ratesOf = "";
  readonly factors = new Map<number, Factors>();

  dormant(): boolean {
    return !this.kinds.length;
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const k of this.kinds) if (k.event) out.push(k.event);
    for (const c of this.crossings) out.push(c.decision);
    return out;
  }
  private rows(): number[][] {
    return [...this.lands.entries()].sort((a, b) => a[0] - b[0]).map(([c, s]) => [c, ...s]);
  }
  hashInto(h: Hasher): void {
    if (this.dormant()) return;
    h.value(this.kinds.map((k) => [k.key, k.blend, k.since]))
      .value(this.rows())
      .value(this.crossings.map((c) => [c.a, c.b, c.fertility]));
  }
  save(): unknown {
    if (this.dormant()) return {};
    return { kinds: this.kinds, lands: this.rows(), crossings: this.crossings, tally: this.tally };
  }
  load(state: unknown): void {
    const s = (state ?? {}) as {
      kinds?: MixKind[];
      lands?: number[][];
      crossings?: Crossing[];
      tally?: { moved: number; crossed: number };
    };
    this.kinds = (s.kinds ?? []).map((k) => ({ ...k }));
    this.lands.clear();
    for (const r of s.lands ?? []) this.lands.set(r[0]!, r.slice(1));
    this.crossings = [...(s.crossings ?? [])];
    this.tally = { moved: s.tally?.moved ?? 0, crossed: s.tally?.crossed ?? 0 };
    this.rates = [];
    this.ratesOf = "";
    this.factors.clear();
  }
  /** A land's shares (thousandths, a number for each people of the world): the first people's alone where it is not mixed. */
  shares(cell: number): number[] {
    const s = this.lands.get(cell),
      out = new Array<number>(this.kinds.length + 1).fill(0);
    if (!s) out[0] = 1000;
    else for (let i = 0; i < s.length; i++) out[i] = s[i]!;
    return out;
  }
  /** Set a land's shares: kept only where it holds another people than the first. */
  set(cell: number, shares: readonly number[]): void {
    this.factors.delete(cell);
    const s = whole(shares);
    if (s[0] === 1000) this.lands.delete(cell);
    else this.lands.set(cell, s);
  }
}

/** Shares made thousandths of one whole (the largest takes what rounding leaves; one under PEOPLES.least is let go). */
function whole(shares: readonly number[]): number[] {
  const all = shares.reduce((a, x) => a + Math.max(0, x), 0);
  if (!(all > 0)) return shares.map((_, i) => (i === 0 ? 1000 : 0));
  const out = shares.map((x) => {
    const v = Math.round((1000 * Math.max(0, x)) / all);
    return v < PEOPLES.least ? 0 : v;
  });
  let top = 0;
  for (let i = 1; i < out.length; i++) if (out[i]! > out[top]!) top = i;
  out[top] = out[top]! + 1000 - out.reduce((a, x) => a + x, 0);
  return out;
}

/** A world's store of its peoples besides the first (null: a world of one people, or one not taught). */
export function mixOf(world: World): MixStore | null {
  const s = world.peek<MixStore>("population.mix");
  return s && s.kinds.length ? s : null;
}

const APE = (): BodyPlan => CLADES.find((c) => c.id === "ape")!.body as unknown as BodyPlan;

/** The body of a people of a world (0: its first). */
export function kindBody(g: HomeWorld, store: MixStore, kind: number): BodyPlan {
  if (kind <= 0) return g.life.people?.body ?? APE();
  const k = store.kinds[kind - 1]!;
  if (k.body) return k.body;
  // (Those born of two: between the two, read at a twentieth's step of how much of each is in them.)
  const step = Math.round(k.blend / 50) / 20;
  return blendBody(kindBody(g, store, k.of![0]), kindBody(g, store, k.of![1]), step);
}

/** The name of a people of a world. */
export function peopleNameOf(g: HomeWorld, store: MixStore | null, kind: number): string {
  if (kind <= 0 || !store)
    return g.life.people ? `the ${g.life.species[g.life.people.species]!.name}` : "its people";
  return store.kinds[kind - 1]?.name ?? "another people";
}

/** Each people's numbers against the world's table (kept while the world and how its peoples are blended stand). */
function ratesIn(g: HomeWorld, store: MixStore): (PeopleRates | undefined)[] {
  const key = `${g.digest}:${store.kinds.map((k) => Math.round(k.blend / 50)).join()}`;
  if (store.ratesOf !== key) {
    store.ratesOf = key;
    store.rates = [];
    store.factors.clear();
  }
  return store.rates;
}
function rateOf(g: HomeWorld, store: MixStore, kind: number): PeopleRates {
  const rates = ratesIn(g, store);
  return (rates[kind] ??= ratesOf(
    kind === 0 ? peopleLife(g) : lifeOfBody(kindBody(g, store, kind)),
    peopleLife(g),
  ));
}

/**
 * What a mixed land's births, each band's deaths and its mouths are multiplied by (null: a land of the world's first people
 * alone, as every land of a world of one people is).
 */
export function mixFactors(world: World, cell: number): Factors | null {
  const store = mixOf(world);
  if (!store) return null;
  const s = store.lands.get(cell);
  if (!s) return null;
  const g = homePlanet(world).generated;
  ratesIn(g, store);
  let f = store.factors.get(cell);
  if (!f) {
    const bands = peopleLife(g).bands.length;
    f = { births: 0, deaths: new Array<number>(bands).fill(0), appetite: 0 };
    for (let k = 0; k < s.length; k++) {
      const share = s[k]! / 1000;
      if (!(share > 0)) continue;
      const r = rateOf(g, store, k);
      f.births += share * r.births;
      f.appetite += share * r.appetite;
      for (let b = 0; b < bands; b++) f.deaths[b] = f.deaths[b]! + share * r.deaths[b]!;
    }
    store.factors.set(cell, f);
  }
  return f;
}

/** A mixed land's mouths against the world's first people's (1 where it is not mixed). */
export function mixAppetite(world: World, cell: number): number {
  return mixFactors(world, cell)?.appetite ?? 1;
}

/** A people besides the world's first, made known to it (the same one where its key is known already): its number. */
export function addKind(world: World, kind: MixKind): number {
  const store = world.peek<MixStore>("population.mix");
  if (!store) return 0;
  const at = store.kinds.findIndex((k) => k.key === kind.key);
  if (at >= 0) return at + 1;
  store.kinds.push(kind);
  for (const [c, s] of store.lands) {
    s.push(0);
    store.factors.delete(c);
  }
  return store.kinds.length;
}

/** So many of a people set down on a land that held `before` (of the shares it had). */
export function setDown(
  world: World,
  cell: number,
  kind: number,
  count: number,
  before: number,
): void {
  const store = world.peek<MixStore>("population.mix");
  if (!store || !store.kinds.length || !(count > 0)) return;
  const s = store.shares(cell),
    all = Math.max(0, before) + count;
  store.set(
    cell,
    s.map((x, i) => (x * Math.max(0, before) + (i === kind ? 1000 * count : 0)) / all),
  );
}

/** The shares of a people set down by band of age, youngest first (as the first people's: population/world.ts). */
const PYRAMID = [0.16, 0.13, 0.12, 0.1, 0.17, 0.13, 0.09, 0.05, 0.03, 0.02];

/**
 * The natives of a world a colony came down on, those whose ground its land is: `count` of them are of its land from now,
 * of every age, a people of their own (their own body, of no tree the settlers are of). Their number among the land's.
 */
export function nativesDown(
  ctx: PopulationContext,
  dest: Province,
  native: { readonly ref: string; readonly name: string; readonly body: BodyPlan },
  count: number,
  year: number,
  event: Ref | null,
): number {
  const n = Math.floor(count);
  if (!(n > 0) || !ctx.world.peek<MixStore>("population.mix")) return 0;
  const kind = addKind(ctx.world, {
      key: `native:${native.ref}`,
      name: native.name,
      body: native.body,
      species: null,
      of: null,
      blend: 0,
      since: year,
      event,
    }),
    before = dest.total(),
    life = ctx.life;
  if (!kind) return 0;
  apportion(n, PYRAMID.slice(0, life.bands.length)).forEach((k, b) => {
    const [women, men] = apportion(k, [1, 1]),
      occupation = life.bands[b]! >= life.adulthood ? OCC.forager : OCC.dependent;
    dest.counts.add(rowOf(FEMALE, b), occupation, women!);
    dest.counts.add(rowOf(MALE, b), occupation, men!);
  });
  setDown(ctx.world, dest.cell, kind, n, before);
  return n;
}

/** Those who move take their land's shares with them: `count` from one land come to another that held `before`. */
export function mixMoved(
  world: World,
  from: number,
  to: number,
  count: number,
  before: number,
): void {
  const store = mixOf(world);
  if (!store || !(count > 0)) return;
  const a = store.lands.get(from),
    b = store.lands.get(to);
  if (!a && !b) return;
  const sa = store.shares(from),
    sb = store.shares(to),
    all = Math.max(0, before) + count;
  store.set(
    to,
    sb.map((x, i) => (x * Math.max(0, before) + sa[i]! * count) / all),
  );
}

/** How two peoples of a world stand in its tree of life: the generations since their lines parted. */
export function kinshipOf(g: HomeWorld, store: MixStore, a: number, b: number): Kinship {
  if (a === b) return { sameTree: true, generations: 0 };
  const ka = a > 0 ? store.kinds[a - 1]! : null,
    kb = b > 0 ? store.kinds[b - 1]! : null;
  // (Those born of two stand half as far from each of the two as the two from each other; from any other, as the nearer does.)
  for (const [k, other] of [
    [ka, b],
    [kb, a],
  ] as const)
    if (k?.of) {
      const [x, y] = k.of,
        kx = kinshipOf(g, store, x, other),
        ky = kinshipOf(g, store, y, other);
      if (other === x || other === y) {
        const far = kinshipOf(g, store, x, y);
        return { sameTree: far.sameTree, generations: far.generations / 2 };
      }
      return kx.generations <= ky.generations ? kx : ky;
    }
  const sa = a === 0 ? (g.life.people?.species ?? null) : ka!.species,
    sb = b === 0 ? (g.life.people?.species ?? null) : kb!.species;
  if (sa === null || sb === null) return { sameTree: false, generations: Infinity };
  const tree = treeOfLife(g),
    la = tree.ofSpecies[sa] ?? -1,
    lb = tree.ofSpecies[sb] ?? -1,
    years =
      (generationOf(lifeOfBody(kindBody(g, store, a))) +
        generationOf(lifeOfBody(kindBody(g, store, b)))) /
      2;
  if (la < 0 || lb < 0) return { sameTree: true, generations: Infinity };
  // The lines back to the root: the two parted when the later-leaving of the two branches below their last mother in common began.
  const up = (id: number): number[] => {
    const out: number[] = [];
    for (let n = id; n >= 0; n = tree.nodes[n]!.parent) out.push(n);
    return out.reverse();
  };
  const pa = up(la),
    pb = up(lb);
  let i = 0;
  while (i < pa.length && i < pb.length && pa[i] === pb[i]) i++;
  const from = (p: number[]) => (i < p.length ? tree.nodes[p[i]!]!.from : 0),
    myr = Math.max(from(pa), from(pb));
  return { sameTree: true, generations: (myr * 1e6) / Math.max(1, years) };
}

/** Two peoples of a world read against each other (once: kept, with its decision). */
function crossingOf(
  ctx: PopulationContext,
  store: MixStore,
  a: number,
  b: number,
  cell: number,
): Crossing {
  const [x, y] = a < b ? [a, b] : [b, a];
  let c = store.crossings.find((k) => k.a === x && k.b === y);
  if (!c) {
    const g = ctx.generated,
      kin = kinshipOf(g, store, x, y),
      // (Peoples of one world's life are made as it is; one of another tree would bring its own: none stands on a land yet.)
      chem = worldLife(g),
      read = crossFertility(kin, chem, chem),
      because = [x, y].map((k) => (k > 0 ? store.kinds[k - 1]!.event : null)).find((e) => e),
      decision = ctx.world.decisions.record({
        rule: "peoples.young-together",
        subject: cellRef(0, cell),
        outcome: {
          a: peopleNameOf(g, store, x),
          b: peopleNameOf(g, store, y),
          can: read.fertility > 0,
          why: read.why,
        },
        score: read.fertility,
        threshold: 0.001,
        factors: [
          {
            name: "generations since their lines parted",
            value: Number.isFinite(kin.generations) ? Math.round(kin.generations) : -1,
            contribution: read.fertility,
            source: because ? { ref: because, role: "enabler", weight: 1 } : null,
          },
          {
            name: "of one tree of life",
            value: kin.sameTree ? 1 : 0,
            contribution: kin.sameTree ? 0 : -1,
            source: null,
          },
        ],
      });
    c = { a: x, b: y, fertility: Math.round(read.fertility * 1000), decision };
    store.crossings.push(c);
  }
  return c;
}

/** The year's shares: each mixed land's moved by its peoples' own births and deaths, and by those born of two. */
export function mixYear(ctx: PopulationContext, t: SimTime): void {
  const world = ctx.world,
    store = mixOf(world);
  if (!store || !store.lands.size) return;
  const g = ctx.generated,
    year = yearOfMoment(t),
    culture = cultureOf(world);
  for (const cell of [...store.lands.keys()].sort((a, b) => a - b)) {
    const p = ctx.provinces.get(cell);
    if (!p || p.total() <= 0) {
      store.set(cell, [1000]);
      continue;
    }
    const before = store.shares(cell),
      n = before.length,
      rates = before.map((_, k) => rateOf(g, store, k)),
      fed = p.fed / 1000,
      // (As vitalMonth reads a month: births by how it ate, squared; deaths the more pressing the leaner.)
      next = sharesAfter(
        before.map((x) => x / 1000),
        rates,
        fed * fed,
        1 + 2.5 * (1 - fed),
      );
    // Those born of two: the two most of the land.
    const order = next.map((_, k) => k).sort((x, y) => next[y]! - next[x]! || x - y),
      a = order[0]!,
      b = order[1]!;
    if (n > 1 && next[b]! > 0) {
      const cross = crossingOf(ctx, store, a, b, cell),
        brood = [a, b].some((k) => {
          const body = kindBody(g, store, k);
          return pairingOf(body, lifeOfBody(body).adulthood) === "brood";
        });
      if (cross.fertility > 0 && !brood) {
        const open = culture.get(cell)?.traits[WAY.openness] ?? 0.5,
          born =
            crossBorn(next[a]!, next[b]!, open, cross.fertility / 1000) *
            fed *
            fed *
            ((rates[a]!.born + rates[b]!.born) / 2);
        if (born > 0) {
          // The people they are: one of the two where it is itself born of the other, else a people of both.
          const ka = a > 0 ? store.kinds[a - 1]! : null,
            kb = b > 0 ? store.kinds[b - 1]! : null,
            back = ka?.of?.includes(b) ? a : kb?.of?.includes(a) ? b : 0;
          let into = back;
          if (!into) {
            const [x, y] = a < b ? [a, b] : [b, a],
              key = `born:${x}x${y}`;
            into = store.kinds.findIndex((k) => k.key === key) + 1;
            if (!into) {
              const event = world.events.emit({
                type: MIX_EVENTS.born.type,
                place: p.ref,
                subjects: [p.ref],
                causes: [{ ref: cross.decision, role: "trigger", weight: 1 }],
                data: {
                  a: peopleNameOf(g, store, x),
                  b: peopleNameOf(g, store, y),
                  bear: Math.round(cross.fertility / 10),
                  year,
                },
              });
              into = addKind(world, {
                key,
                name: `those born of ${peopleNameOf(g, store, x)} and ${peopleNameOf(g, store, y)}`,
                body: null,
                species: null,
                of: [x, y],
                blend: 500,
                since: year,
                event,
              });
              next.push(0);
            }
          }
          if (into === a || into === b) {
            // (Born of the mixed and one of their two: half of them the mixed's already; the mixed lean the more that way.)
            const other = into === a ? b : a,
              kind = store.kinds[into - 1]!,
              took = Math.min(next[other]!, born / 2),
              toward = kind.of![0] === other ? 1000 : 0,
              lands = Math.max(1, store.lands.size);
            next[other] = next[other]! - took;
            kind.blend = Math.round(
              kind.blend +
                (((toward + kind.blend) / 2 - kind.blend) * (took / (next[into]! + took))) / lands,
            );
            next[into] = next[into]! + took;
          } else {
            const took = Math.min(born, 2 * next[a]!, 2 * next[b]!);
            next[a] = next[a]! - took / 2;
            next[b] = next[b]! - took / 2;
            next[into] = (next[into] ?? 0) + took;
          }
          store.tally.crossed += Math.round(born * 1000);
        }
      }
    }
    store.set(cell, next);
    const after = store.shares(cell),
      was = top(before),
      now = top(after);
    if (after.some((x, k) => x !== (before[k] ?? 0))) store.tally.moved++;
    if (now !== was) {
      const r = rateOf(g, store, now),
        r0 = rateOf(g, store, was),
        decision = world.decisions.record({
          rule: "peoples.share",
          subject: p.ref,
          outcome: { most: peopleNameOf(g, store, now), were: peopleNameOf(g, store, was) },
          score: after[now]! / 1000,
          threshold: 0.5,
          factors: [
            {
              name: "born a head a year, against the others'",
              value: r.born,
              contribution: r.born - r0.born,
              source: null,
            },
            {
              name: "dying a head a year, against the others'",
              value: r.dying,
              contribution: r0.dying - r.dying,
              source: null,
            },
            { name: "how the land is fed", value: fed, contribution: 0, source: null },
          ],
        });
      world.events.emit({
        type: MIX_EVENTS.outgrew.type,
        place: p.ref,
        subjects: [p.ref],
        causes: [{ ref: decision, role: "trigger", weight: 1 }],
        data: {
          most: peopleNameOf(g, store, now),
          were: peopleNameOf(g, store, was),
          share: Math.round(after[now]! / 10),
          year,
        },
      });
    }
  }
}

function top(s: readonly number[]): number {
  let at = 0;
  for (let i = 1; i < s.length; i++) if (s[i]! > s[at]!) at = i;
  return at;
}

/** Teach a world that it may hold more than one people. */
export function installMix(world: World, ctx: () => PopulationContext): MixStore {
  const store = world.register(new MixStore());
  world.addPinner(() => store.pinned());
  // (After the year's births, deaths and moves; before the ledger.)
  world.system({ key: "135.population.mix", every: YEAR, run: (t) => mixYear(ctx(), t) });
  return store;
}
