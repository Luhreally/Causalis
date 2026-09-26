// The observer ledger (docs/architecture §10, §14): the people the player has met.
//
// The simulation holds counts, never individuals. Meeting a family *collapses* one
// household out of a village's counts: a head, perhaps a spouse, children, perhaps
// an elder, each drawn from what the counts still leave unclaimed. Every fact is
// conditioned on the recorded history and claims its share of it — a place in the
// province's counts and the village's people, a birth in the birth ledger, a seat
// in each migration their past crosses, a death in the death ledger — so no one
// can be met who the history does not hold room for.
//
// The ledger is observational: saved with the world, never hashed into history,
// never read by the simulation. Looking cannot change what happens.
import {
  Hasher,
  YEAR,
  defineKind,
  defineStream,
  makeRef,
  type Ref,
  type StateStore,
  type World,
} from "../kernel/index.ts";
import type { Watch } from "./watch.ts";
import { cellRef, cradleTongue, tongueName, tonguePersonName } from "../gen/index.ts";
import { BANDS, FEMALE, HUMANLIKE, MALE, bandWidth } from "../rules/index.ts";
import {
  COLS,
  cultureOf,
  row,
  populationContext,
  type Flow,
  type PopulationContext,
} from "../sim/index.ts";

export const PERSON = defineKind("prsn", "person", "structural");
export const HOUSEHOLD = defineKind("hhold", "household", "structural");
export const MEMORY = defineKind("memo", "memory", "structural");

const COLLAPSE = defineStream("observe.collapse");
const LIFE = defineStream("observe.life");

export type Move = {
  readonly year: number;
  readonly from: number;
  readonly to: number;
  readonly flow: number;
  readonly event: Ref;
};
export type Role = "head" | "spouse" | "child" | "elder";

/** A copy of an event as the observer met it, kept even if history later forgets it. */
export type Remembered = {
  readonly id: Ref;
  readonly t: number;
  readonly type: string;
  readonly place: Ref | null;
  readonly subjects: readonly Ref[];
  readonly data: unknown;
};

export type LifeEvent = {
  readonly year: number;
  readonly age: number;
  readonly kind: string;
  readonly event: Ref | null;
};
export type Memory = {
  readonly ref: Ref;
  readonly year: number;
  readonly age: number;
  readonly kind: string;
  readonly event: Ref;
};

export type Person = {
  readonly ref: Ref;
  readonly seq: number;
  readonly household: Ref;
  readonly name: string;
  readonly surname: string;
  readonly sex: number;
  readonly birthYear: number;
  birthCell: number;
  bornBeforeChronicle: boolean;
  cell: number;
  village: Ref | null;
  occupation: number;
  readonly role: Role;
  alive: boolean;
  diedYear: number | null;
  moves: Move[];
  /** The year up to which the person's life has been followed. */
  resolvedTo: number;
  /** Their place in the counts: the claim key they hold now. */
  claimKey: string | null;
  depth: number;
  life?: LifeEvent[];
  /** The year their life was last told to. */
  lifeTo?: number;
  memories?: Memory[];
  traits?: Record<string, number>;
};

export type Household = {
  readonly ref: Ref;
  readonly seq: number;
  readonly surname: string;
  readonly cell: number;
  readonly village: Ref | null;
  readonly members: Ref[];
  readonly metIn: number;
};

export class ObserverLedger implements StateStore {
  readonly name = "observer.ledger";
  readonly observational = true;
  seq = 0;
  /** The year everyone met was last followed to and given their place in the counts. */
  settledAt = -1;
  readonly persons = new Map<number, Person>();
  readonly households = new Map<number, Household>();
  private readonly claims = new Map<string, number>();
  readonly remembered = new Map<string, Remembered>();
  /** What the observer follows (lands, villages, realms, people met), by ref. */
  readonly watches = new Map<string, Watch>();

  claimed(key: string): number {
    return this.claims.get(key) ?? 0;
  }
  /** Take one unit of `key`, if fewer than `limit` are taken. */
  claim(key: string, limit: number): boolean {
    const n = this.claims.get(key) ?? 0;
    if (n >= limit) return false;
    this.claims.set(key, n + 1);
    return true;
  }
  release(key: string): void {
    const n = this.claims.get(key) ?? 0;
    if (n <= 1) this.claims.delete(key);
    else this.claims.set(key, n - 1);
  }
  /** Drop every claim whose key starts with one of the prefixes. */
  releaseAll(prefixes: readonly string[]): void {
    for (const key of [...this.claims.keys()])
      if (prefixes.some((p) => key.startsWith(p))) this.claims.delete(key);
  }
  allClaims(): [string, number][] {
    return [...this.claims.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  }
  person(ref: Ref): Person | undefined {
    return this.persons.get(Number(ref.split(":")[2]));
  }
  household(ref: Ref): Household | undefined {
    return this.households.get(Number(ref.split(":")[2]));
  }
  /** Every household met, in the order they were met. */
  allHouseholds(): Household[] {
    return [...this.households.values()].sort((a, b) => a.seq - b.seq);
  }
  /** Everything followed, in the order it was taken up. */
  allWatches(): Watch[] {
    return [...this.watches.values()].sort((a, b) => a.since - b.since || (a.ref < b.ref ? -1 : 1));
  }
  /** How many of a village's people have been met and live there still. */
  claimedIn(village: Ref): number {
    return this.claimed(villageKey(village));
  }

  hashInto(h: Hasher): void {
    h.int(this.seq)
      .int(this.settledAt)
      .value([...this.persons.values()])
      .value([...this.households.values()])
      .value(this.allClaims());
    h.value([...this.remembered.values()]);
    if (this.watches.size) h.value(this.allWatches());
  }
  save(): unknown {
    return {
      seq: this.seq,
      settledAt: this.settledAt,
      persons: [...this.persons.values()],
      households: [...this.households.values()],
      claims: this.allClaims(),
      remembered: [...this.remembered.values()],
      watches: this.allWatches(),
    };
  }
  load(state: unknown): void {
    const s = state as {
      seq: number;
      settledAt: number;
      persons: Person[];
      households: Household[];
      claims: [string, number][];
      remembered: Remembered[];
      watches?: Watch[];
    };
    this.seq = s.seq;
    this.settledAt = s.settledAt;
    this.persons.clear();
    this.households.clear();
    this.claims.clear();
    this.remembered.clear();
    for (const p of s.persons) this.persons.set(p.seq, { ...p, moves: [...p.moves] });
    for (const h of s.households) this.households.set(h.seq, { ...h, members: [...h.members] });
    for (const [k, v] of s.claims) this.claims.set(k, v);
    for (const r of s.remembered) this.remembered.set(r.id, r);
    this.watches.clear();
    for (const w of s.watches ?? []) this.watches.set(w.ref, { ...w });
  }
}

export function observer(world: World): ObserverLedger {
  if (!world.storeNames().includes("observer.ledger")) world.register(new ObserverLedger());
  return world.store<ObserverLedger>("observer.ledger");
}

// ── Keys into the recorded history ────────────────────────────────────────────
const countKey = (cell: number, r: number, o: number) => `c:${cell}:${r}:${o}`;
const villageKey = (v: Ref) => `v:${v}`;
const birthKey = (cell: number, year: number) => `b:${cell}:${year}`;
const deathKey = (cell: number, year: number, band: number) => `d:${cell}:${year}:${band}`;
const flowKey = (i: number) => `f:${i}`;

function bandOfAge(age: number): number {
  let b = 0;
  while (b + 1 < BANDS && HUMANLIKE.bands[b + 1]! <= age) b++;
  return b;
}

/** A keyed coin: true with probability p (n distinguishes the questions asked). */
type Chance = (p: number, n: number) => boolean;

/** A province's population in a past year, from its yearly ledger line. */
function populationIn(ctx: PopulationContext, cell: number, year: number): number {
  const years = ctx.history.yearsOf(cell);
  for (let i = years.length - 1; i >= 0; i--)
    if (years[i]!.year <= year) return Math.max(1, years[i]!.population);
  return Math.max(1, ctx.provinces.get(cell)?.total() ?? 1);
}

function flowsIndexed(ctx: PopulationContext): Map<string, number[]> {
  const byKey = new Map<string, number[]>();
  ctx.history.flows().forEach((f, i) => {
    for (const key of [`in:${f.to}:${f.year}`, `out:${f.from}:${f.year}`]) {
      const a = byKey.get(key) ?? [];
      a.push(i);
      byKey.set(key, a);
    }
  });
  return byKey;
}

/** Walk a person's past back from where they live now: through each migration into
 * their province (claiming a seat in it) to a birth the ledger holds room for. */
function resolvePast(
  ctx: PopulationContext,
  ledger: ObserverLedger,
  person: Person,
  now: number,
  chance: Chance,
  index: Map<string, number[]>,
): void {
  const flows = ctx.history.flows();
  let cell = person.cell;
  const moves: Move[] = [];
  const takeFlow = (i: number) => {
    const f = flows[i]!;
    if (!ledger.claim(flowKey(i), f.count)) return false;
    moves.unshift({ year: f.year, from: f.from, to: f.to, flow: i, event: f.event });
    cell = f.from;
    return true;
  };
  for (let y = now - 1; y >= Math.max(person.birthYear, 0); y--) {
    const into = index.get(`in:${cell}:${y}`) ?? [],
      settled = ctx.provinces.get(cell)?.settledYear ?? 0;
    // In the year a province was first peopled, whoever is still placed there came
    // with its first people: no one lived there before.
    if (y === settled && settled > 0) {
      if (into.some((i) => takeFlow(i))) continue;
    }
    const pop = populationIn(ctx, cell, y);
    for (const i of into) {
      const room = flows[i]!.count - ledger.claimed(flowKey(i));
      if (room > 0 && chance(Math.min(1, room / pop), y * 64 + (i % 64)) && takeFlow(i)) break;
    }
  }
  person.moves = moves;
  person.birthCell = cell;
  person.bornBeforeChronicle = person.birthYear < 0;
  if (person.birthYear >= 0) {
    // A birth the ledger holds room for; failing the year itself, the nearest year that does.
    for (const dy of [0, -1, 1, -2, 2, -3, 3]) {
      const y = person.birthYear + dy;
      if (y >= 0 && ledger.claim(birthKey(cell, y), ctx.history.birthsIn(cell, y))) return;
    }
  }
}

/** A household met in a village (or among a province's foragers): drawn from what history leaves unclaimed. */
export function meetHousehold(world: World, cell: number, village: Ref | null): Household {
  settleAll(world);
  const ctx = populationContext(world),
    ledger = observer(world),
    p = ctx.provinces.get(cell);
  if (!p) throw new Error(`no one lives in ${cellRef(0, cell)}`);
  const now = Math.floor(world.now / YEAR),
    v = village ? ctx.settlements.get(village) : undefined;
  if (village && !v) throw new Error(`no village ${village}`);
  const room = () => (v ? v.population - ledger.claimed(villageKey(v.ref)) : Infinity);
  if (room() < 1) throw new Error(`everyone in ${v!.name} has been met`);
  const seq = ++ledger.seq,
    subject = seq,
    chance = (pr: number, n: number) => world.rng.real(COLLAPSE, subject, now, 1, n) < pr;
  const available = (r: number, o: number) =>
    p.counts.get(r, o) - ledger.claimed(countKey(cell, r, o));
  const pick = (cells: [number, number][], n: number): [number, number] | null => {
    const weights = cells.map(([r, o]) => Math.max(0, available(r, o))),
      total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) return null;
    let target = world.rng.real(COLLAPSE, subject, now, 2, n) * total;
    for (let i = 0; i < cells.length; i++) {
      if (target < weights[i]!) return cells[i]!;
      target -= weights[i]!;
    }
    return cells[cells.length - 1]!;
  };
  // Names in the tongue of the land they live in.
  const tongue = cultureOf(world).get(cell)?.tongue ?? cradleTongue(ctx.culture),
    surname = tongueName({ ...tongue, seed: tongue.seed ^ 0xf00d }, seq);
  const hhRef = makeRef(HOUSEHOLD, 0, seq),
    members: Person[] = [],
    index = flowsIndexed(ctx);
  const add = (r: number, o: number, role: Role, ageLimit?: [number, number]): Person | null => {
    if (room() < 1 || !ledger.claim(countKey(cell, r, o), p.counts.get(r, o))) return null;
    if (v) ledger.claim(villageKey(v.ref), v.population);
    const pseq = ++ledger.seq,
      sex = r < BANDS ? FEMALE : MALE,
      band = r % BANDS,
      lo = HUMANLIKE.bands[band]!,
      width = bandWidth(band);
    let age = lo + Math.floor(world.rng.real(COLLAPSE, pseq, now, 3) * width);
    if (ageLimit)
      age = Math.max(
        lo,
        Math.min(lo + width - 1, Math.max(ageLimit[0], Math.min(ageLimit[1], age))),
      );
    const person: Person = {
      ref: makeRef(PERSON, 0, pseq),
      seq: pseq,
      household: hhRef,
      name: tonguePersonName(tongue, pseq, sex === FEMALE ? 0 : 1),
      surname,
      sex,
      birthYear: now - age,
      birthCell: cell,
      bornBeforeChronicle: false,
      cell,
      village,
      occupation: o,
      role,
      alive: true,
      diedYear: null,
      moves: [],
      resolvedTo: now,
      claimKey: countKey(cell, r, o),
      depth: 2,
    };
    resolvePast(
      ctx,
      ledger,
      person,
      now,
      (pr, n) => world.rng.real(COLLAPSE, pseq, now, 4, n) < pr,
      index,
    );
    ledger.persons.set(pseq, person);
    members.push(person);
    return person;
  };
  const adults = (bands: number[], sexes: number[]) => {
    const out: [number, number][] = [];
    for (const s of sexes)
      for (const b of bands) for (let o = 1; o < COLS; o++) out.push([row(s, b), o]);
    return out;
  };
  // The head of the household: a grown person of working age.
  const headCell = pick(adults([4, 5, 6, 7, 8], [FEMALE, MALE]), 0);
  if (!headCell) throw new Error("no one in the counts is left to meet here");
  const head = add(headCell[0], headCell[1], "head")!;
  const headBand = headCell[0] % BANDS,
    headAge = now - head.birthYear;
  // A spouse, most of the time, of the other sex and about the same age.
  if (chance(0.78, 0)) {
    const other = head.sex === FEMALE ? MALE : FEMALE,
      bands = [headBand - 1, headBand, headBand + 1].filter((b) => b >= 3 && b < BANDS);
    const c = pick(adults(bands, [other]), 1);
    if (c) add(c[0], c[1], "spouse", [headAge - 8, headAge + 8]);
  }
  // Children, as many as the head's age suggests; each at least fifteen years younger.
  const expected = [0, 0, 0, 0, 1.3, 2.4, 2.1, 0.9, 0.2, 0][headBand]!;
  let children = 0;
  for (let k = 0; k < 8 && children < 7; k++) if (chance(expected / 8, 10 + k)) children++;
  for (let k = 0; k < children; k++) {
    const cells: [number, number][] = [];
    for (let b = 0; b <= 3; b++)
      if (HUMANLIKE.bands[b]! <= headAge - 15)
        for (const s of [FEMALE, MALE])
          for (let o = b < 3 ? 0 : 1; o < (b < 3 ? 1 : COLS); o++) cells.push([row(s, b), o]);
    const c = pick(cells, 20 + k);
    if (c) add(c[0], c[1], "child", [0, headAge - 15]);
  }
  // Sometimes an elder: a parent of the head.
  if (headBand <= 6 && chance(0.22, 30)) {
    const c = pick(
      adults(
        [headBand + 2, headBand + 3, headBand + 4].filter((b) => b < BANDS),
        [FEMALE, MALE],
      ),
      31,
    );
    if (c) add(c[0], c[1], "elder", [headAge + 16, headAge + 45]);
  }
  const household: Household = {
    ref: hhRef,
    seq,
    surname,
    cell,
    village,
    members: members.map((m) => m.ref),
    metIn: now,
  };
  ledger.households.set(seq, household);
  return household;
}

/** Follow a person's life forward to now: deaths and moves drawn from the recorded
 * rates and claimed from the ledgers. Their place in the counts is left to settleAll. */
function followLife(
  world: World,
  ctx: PopulationContext,
  ledger: ObserverLedger,
  person: Person,
  index: Map<string, number[]>,
): void {
  const now = Math.floor(world.now / YEAR),
    flows = ctx.history.flows(),
    hh = ledger.household(person.household)!;
  for (let y = person.resolvedTo; y < now && person.alive; y++) {
    const age = y - person.birthYear,
      band = bandOfAge(Math.max(0, age)),
      summary = ctx.history.yearsOf(person.cell).find((s) => s.year === y),
      stress = summary ? 1 + 2.5 * (1 - summary.fed / 1000) : 1,
      q = HUMANLIKE.mortality[band]! * stress;
    if (
      world.rng.real(LIFE, person.seq, y, 0) < q &&
      ledger.claim(deathKey(person.cell, y, band), ctx.history.deathsIn(person.cell, y, band))
    ) {
      person.alive = false;
      person.diedYear = y;
      break;
    }
    // A household moves together: one draw for all of them.
    const out = index.get(`out:${person.cell}:${y}`) ?? [],
      pop = populationIn(ctx, person.cell, y);
    for (const i of out) {
      const f = flows[i]!;
      if (
        world.rng.real(LIFE, hh.seq, y, 1 + (i % 64)) < f.count / pop &&
        ledger.claim(flowKey(i), f.count)
      ) {
        person.moves.push({ year: y, from: f.from, to: f.to, flow: i, event: f.event });
        person.cell = f.to;
        person.village = null;
        break;
      }
    }
  }
  person.resolvedTo = Math.max(person.resolvedTo, now);
}

/**
 * Bring everyone met up to now, together: follow each life, then give each living
 * person, in the order they were met, their place in today's counts and villages.
 * Their trade may change if theirs has no room; if the counts hold no room for them
 * at all, history holds them as having gone. Done once per year of the world.
 */
export function settleAll(world: World): void {
  const ledger = observer(world),
    now = Math.floor(world.now / YEAR);
  if (ledger.settledAt === now) return;
  const ctx = populationContext(world),
    index = flowsIndexed(ctx),
    people = [...ledger.persons.values()].sort((a, b) => a.seq - b.seq);
  for (const person of people) followLife(world, ctx, ledger, person, index);
  ledger.releaseAll(["c:", "v:"]);
  for (const person of people) {
    person.claimKey = null;
    if (!person.alive) continue;
    const p = ctx.provinces.get(person.cell),
      band = bandOfAge(now - person.birthYear),
      r = row(person.sex, band);
    if (!p) {
      person.alive = false;
      person.diedYear = now - 1;
      continue;
    }
    const grownUp = HUMANLIKE.bands[band]! >= HUMANLIKE.adulthood;
    const order = [person.occupation, ...Array.from({ length: COLS }, (_, o) => o)].filter(
      (o, i, a) => a.indexOf(o) === i && (o === 0) === !grownUp,
    );
    const o = order.find((o) => ledger.claim(countKey(person.cell, r, o), p.counts.get(r, o)));
    if (o === undefined) {
      // No room left for them in the counts: history holds them as having gone.
      person.alive = false;
      person.diedYear = now - 1;
      continue;
    }
    person.occupation = o;
    person.claimKey = countKey(person.cell, r, o);
    if (person.village) {
      const v = ctx.settlements.get(person.village);
      if (!v || !ledger.claim(villageKey(v.ref), v.population)) person.village = null;
    }
  }
  ledger.settledAt = now;
}

/** Follow a person (and everyone else met) to now. */
export function catchUp(world: World, person: Person): void {
  void person;
  settleAll(world);
}

export { flowsIndexed, populationIn };
export type { Flow };
