// A far people's life, as history holds it (round F): one small row a people, taken up in the year its life first matters to
// history (sim/space/farlife.ts) and stepped on from there by rules/farlife.ts. Its numbers kept whole; what it was through the
// years kept as a few dozen samples, thinned as they grow (a faded record, never a growing one); the last things done to it. A
// checkpoint hashes a running digest of every row as it was set, not every row (as the ground's store does).
import type { Hasher, Ref, StateStore, World } from "../../kernel/index.ts";
import { farStrength, type FarState } from "../../rules/index.ts";

/** Something done to a far people: by a landing, a fleet, a lesson or goods, a sickness, a breaking. */
export type FarTold = {
  readonly year: number;
  readonly what:
    | "landing"
    | "sickness"
    | "raid"
    | "battle"
    | "lesson"
    | "goods"
    | "broke"
    | "mended"
    | "fell"
    // (Its star ended: the sweep, Nature lane.)
    | "star";
  /** Of what: whose ship or fleet, whom from (a ref), and how much (a share of them, a rung's part). */
  readonly by: Ref | null;
  readonly amount: number;
  readonly event: Ref | null;
};

export type FarRow = {
  readonly ref: Ref;
  /** History follows this people (gen/civilizations.ts), or it is a people only come down on. */
  readonly followed: boolean;
  /** The year history took its life up, and the year its life was stepped to. */
  readonly since: number;
  last: number;
  /** Its numbers, whole (see pack). */
  s: number[];
  fell: number | null;
  /** Whom it fears most, and why that much (the threat's reading's level), as of its last step. */
  fearOf: Ref | null;
  /** Its samples: [year, people, made W, readers ‰, holding together ‰, fear ‰, rung] each, the oldest thinned. */
  ring: number[];
  /** The last few things done to it. */
  told: FarTold[];
  /** The event of its breaking, while it is broken. */
  broke: Ref | null;
  /** The years its rung changed since history took it up, and to what (year, rung, …: its first is the year it was taken up). */
  rungs: number[];
  /** Why it fell, where it did. */
  why: string | null;
};

/** How many changes of rung a row keeps (the oldest go, past the first). */
export const FAR_RUNG_CHANGES = 32;

/** Note a row's rung as of a year, where it changed. */
export function rungInto(row: FarRow, year: number, rung: number): void {
  if (row.rungs[row.rungs.length - 1] === rung) return;
  row.rungs.push(year, rung);
  if (row.rungs.length > 2 * FAR_RUNG_CHANGES) row.rungs.splice(2, 2);
}

/** How many samples a row keeps, and things told. */
export const FAR_RING = 40;
export const FAR_TOLD = 8;
const SAMPLE = 7;

/** A state as kept: whole numbers. */
export function pack(s: FarState): number[] {
  return [
    Math.round(s.people),
    Math.round(s.peak),
    Math.round(s.fed * 1000),
    Math.round(s.wph),
    Math.round(s.made),
    Math.round(s.letters * 1000),
    Math.round(s.spare * 1000),
    Math.round(s.cohesion * 1000),
    Math.round(s.fear * 1000),
    Math.round(s.know * 1000),
    Math.round(s.worn * 1000),
    Math.round(s.fuel * 1e6),
    Math.round(s.warmed * 100),
    Math.round(s.war * 1000),
    Math.round(s.sick * 1000),
    s.broken ? 1 : 0,
    s.rung,
    s.top,
  ];
}

/** A row's numbers, to step or read. */
export function unpack(row: Pick<FarRow, "s" | "fell">): FarState {
  const x = row.s;
  return {
    people: x[0]!,
    peak: x[1]!,
    fed: x[2]! / 1000,
    wph: x[3]!,
    made: x[4]!,
    letters: x[5]! / 1000,
    spare: x[6]! / 1000,
    cohesion: x[7]! / 1000,
    fear: x[8]! / 1000,
    know: x[9]! / 1000,
    worn: x[10]! / 1000,
    fuel: x[11]! / 1e6,
    warmed: x[12]! / 100,
    war: x[13]! / 1000,
    sick: x[14]! / 1000,
    broken: x[15] === 1,
    rung: x[16]!,
    top: x[17]!,
    fell: row.fell,
  };
}

/** Add a sample to a row's ring; past its bound, every other of its older half goes (the far past kept the thinner). */
export function sampleInto(row: FarRow, year: number, s: FarState): void {
  row.ring.push(
    year,
    Math.round(s.people),
    Math.round(s.made),
    Math.round(s.letters * 1000),
    Math.round(s.cohesion * 1000),
    Math.round(s.fear * 1000),
    s.rung,
  );
  const n = row.ring.length / SAMPLE;
  if (n <= FAR_RING) return;
  const half = Math.floor(n / 2),
    out: number[] = [];
  for (let i = 0; i < n; i++)
    if (i >= half || i % 2 === 0) out.push(...row.ring.slice(i * SAMPLE, (i + 1) * SAMPLE));
  row.ring = out;
}

/** A row's samples, read. */
export function ringOf(row: FarRow): {
  year: number;
  people: number;
  made: number;
  letters: number;
  cohesion: number;
  fear: number;
  rung: number;
}[] {
  const out = [];
  for (let i = 0; i + SAMPLE <= row.ring.length; i += SAMPLE) {
    const r = row.ring;
    out.push({
      year: r[i]!,
      people: r[i + 1]!,
      made: r[i + 2]!,
      letters: r[i + 3]! / 1000,
      cohesion: r[i + 4]! / 1000,
      fear: r[i + 5]! / 1000,
      rung: r[i + 6]!,
    });
  }
  return out;
}

/** Fold whole numbers into a running digest (two 32-bit words), as the ground's store does. */
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

/** A ref's whole number, for the digest. */
const refNumber = (ref: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < ref.length; i++) h = Math.imul(h ^ ref.charCodeAt(i), 0x01000193);
  return h >>> 0;
};

export class FarLifeStore implements StateStore {
  readonly name = "space.farlife";
  private readonly rows = new Map<string, FarRow>();
  private readonly digest: [number, number] = [0x811c9dc5, 0];
  private sets = 0;

  get(ref: string): FarRow | undefined {
    return this.rows.get(ref);
  }
  /** Set a row's numbers (and fold them into the digest). */
  set(row: FarRow): void {
    this.rows.set(row.ref, row);
    fold(this.digest, [
      refNumber(row.ref),
      row.last,
      row.fell ?? -1,
      ...row.s,
      row.fearOf ? refNumber(row.fearOf) : 0,
      row.told.length,
    ]);
    this.sets++;
  }
  all(): FarRow[] {
    return [...this.rows.values()].sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
  }
  /** It holds nothing yet: hashed as if it were not there. */
  dormant(): boolean {
    return this.rows.size === 0;
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const r of this.rows.values()) {
      if (r.broke) out.push(r.broke);
      for (const t of r.told) if (t.event) out.push(t.event);
    }
    return out;
  }
  hashInto(h: Hasher): void {
    h.int(this.rows.size).int(this.sets).int(this.digest[0]).int(this.digest[1]);
  }
  save(): unknown {
    return { rows: this.all(), digest: [...this.digest], sets: this.sets };
  }
  load(state: unknown): void {
    this.rows.clear();
    const s = state as { rows?: FarRow[]; digest?: [number, number]; sets?: number } | null;
    for (const r of s?.rows ?? [])
      this.rows.set(r.ref, {
        ...r,
        s: [...r.s],
        ring: [...r.ring],
        told: r.told.map((t) => ({ ...t })),
        rungs: [...(r.rungs ?? [])],
        why: r.why ?? null,
      });
    this.digest[0] = s?.digest?.[0] ?? 0x811c9dc5;
    this.digest[1] = s?.digest?.[1] ?? 0;
    this.sets = s?.sets ?? 0;
  }
}

/** A world's far lives (null on a world that keeps none). */
export function farLifeOf(world: World): FarLifeStore | null {
  return world.peek<FarLifeStore>("space.farlife") ?? null;
}

/** A far people's numbers as history holds them, where it holds them. */
export function heldState(world: World, ref: string): FarState | null {
  const row = farLifeOf(world)?.get(ref);
  return row ? unpack(row) : null;
}

/** How strong a far people is among the stars as history holds it (null: history holds no life of it yet). */
export function heldStrength(world: World, ref: string): number | null {
  const s = heldState(world, ref);
  return s ? farStrength(s) : null;
}

/** Tell something done to a row (the latest few kept). */
export function tellOn(row: FarRow, t: FarTold): void {
  row.told.push(t);
  if (row.told.length > FAR_TOLD) row.told.splice(0, row.told.length - FAR_TOLD);
}
