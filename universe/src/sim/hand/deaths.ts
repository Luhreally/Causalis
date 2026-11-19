// How one under the hand died, as the draw that took them stood (asked 2026-11-16: "reconstruct the causalistic path with all the
// probabilities and however u determine death"). Their month's death rule is one draw against a chance made of many parts — their
// age's line of the life table, raised or lowered by the month's hunger and sickness, the cold, the healers' reach, the smoke, the
// street, what is taken too much of, the aid of the land's societies, what the land's diet goes short of, the frail no one keeps,
// the land's killing, what they are like, a parent's care and the god's hand — and those parts change month by month, so no later
// reading can give them again. They are kept here at the moment of the draw: a reading beside the world, never read by its rules
// and no part of its hash, saved with it, and a save made without it loads (it begins empty). A death by a blow in a possessed
// body is kept by the blow's event.
import type { Hasher, Ref, StateStore, World } from "../../kernel/index.ts";
import { deathWithin, riskUnder } from "../../rules/index.ts";
import { actOn, sparedBy, struckBy, type PersonAct } from "../acts/person.ts";

/** A part of a month's chance of death: its name (a word the page tells), the factor it laid on the hazard, its event if any. */
export type DeathPart = readonly [name: string, by: number, source: string | null];

/** How one under the hand died. */
export type DeathNote = {
  /** The town under the hand, and their id in it. */
  readonly village: Ref;
  readonly id: number;
  /** The moment and year of the draw, their age and age band. */
  readonly t: number;
  readonly year: number;
  readonly age: number;
  readonly band: number;
  /**
   * A month's draw: the life table's chance a year at their band; the months it was reckoned for; the parts that raised or lowered
   * the hazard; the chance it came to over the months; and the draw (it fell under the chance). Absent for a blow.
   */
  readonly base?: number;
  readonly months?: number;
  readonly parts?: readonly DeathPart[];
  readonly chance?: number;
  readonly draw?: number;
  /** The god's act that struck them down, a blow's event (absent: their month's draw). */
  readonly event?: Ref;
  readonly how: "draw" | "blow" | "struck";
};

/**
 * How the head of a group went (an underworld boss, a group's leader): their group's head ref and name, the year and their age, how
 * (dead of their years by its draw; taken by the realm; struck down by the god), the chance of their years and the whole chance the
 * draw stood against, the draw, the event that told it. A boss dead of his years is not told in history: this is the one record.
 */
export type HeadNote = {
  readonly ref: string;
  readonly name: string;
  readonly year: number;
  readonly age: number;
  readonly how: "years" | "taken" | "struck";
  readonly years?: number;
  readonly chance?: number;
  readonly draw?: number;
  readonly event?: Ref;
};

/** The most of the deaths the notes keep (as the hand's gone: the eldest let go first). */
const NOTES_MOST = 4000;

/**
 * What a land's underworld killed, as its realm reckoned it (asked 2026-11-18: a town's named people die of it, host/roster.ts):
 * the year of the reckoning and how many years it stands for, the land, the killed a year in a million of its people, and what
 * the killing was of, as it stood then: how far a group held the land, its street gangs and their pull, how far a crew of the
 * realm's own worked it, whether the group that held it lives on what is paid to it, whether the crew kills; and by name, the
 * war between two groups both there, the group that held it, the crew, and the two federations of its street. The land's row
 * keeps these only as last reckoned; who died of them in a year gone by must not change when the row does.
 */
export type LandKilling = {
  readonly year: number;
  readonly years: number;
  readonly cell: number;
  readonly per: number;
  readonly control: number;
  readonly gangs: number;
  readonly street: number;
  readonly badge: number;
  readonly racket: boolean;
  readonly squad: boolean;
  /** `<event>|<a's event>|<a's name>|<a's kind>|<b's event>|<b's name>|<b's kind>`. */
  readonly war: string | null;
  /** `<event>|<name>|<kind>`: the group that held the land, the crew, and each federation (`<event>|<name>`). */
  readonly holder: string | null;
  readonly crew: string | null;
  readonly feds: readonly [string | null, string | null];
};
/** A killing note's numbers, one after another: its year, years, land, the six it reads, its flags, and five names by place (−1: none). */
const KILL_WIDE = 14;
/** How long a land's killings are kept: as long as a town's lines are read back (host/roster.ts ROSTER_YEARS), and a reckoning more. */
export const KILLINGS_KEPT = 46;

export class DeathNotes implements StateStore {
  readonly name = "readings.deaths";
  /** Saved packed by column (kernel/pack.ts). */
  readonly packed = true;
  readonly observational = true;
  readonly outsideRules = true;
  private list: DeathNote[] = [];
  private heads: HeadNote[] = [];
  /** Lands' killings as reckoned (KILL_WIDE numbers each, the eldest first), and the names they speak of. */
  private kills: number[] = [];
  private names: string[] = [];
  private byCell: Map<number, number[]> | null = null;

  /** A land's killings as its realm reckons them in `year`, to stand `years` years (one reckoning of a land a year: the last told). */
  addKilling(k: LandKilling): void {
    const name = (s: string | null): number => {
      if (s === null) return -1;
      const at = this.names.indexOf(s);
      return at >= 0 ? at : this.names.push(s) - 1;
    };
    // (Reckoned again in the same year: told anew.)
    for (let i = this.kills.length - KILL_WIDE; i >= 0; i -= KILL_WIDE) {
      if (this.kills[i]! < k.year) break;
      if (this.kills[i] === k.year && this.kills[i + 2] === k.cell) this.kills.splice(i, KILL_WIDE);
    }
    this.kills.push(
      k.year,
      k.years,
      k.cell,
      Math.round(k.per),
      Math.round(k.control),
      Math.round(k.gangs),
      Math.round(k.street),
      Math.round(k.badge),
      (k.racket ? 1 : 0) | (k.squad ? 2 : 0),
      name(k.war),
      name(k.holder),
      name(k.crew),
      name(k.feds[0]),
      name(k.feds[1]),
    );
    this.byCell = null;
  }
  /** Those kept from before `year` let go, and the names no note speaks of any more. */
  forgetKillings(year: number): void {
    let from = 0;
    while (from < this.kills.length && this.kills[from]! < year) from += KILL_WIDE;
    if (!from) return;
    this.kills.splice(0, from);
    const names: string[] = [],
      moved = new Map<number, number>();
    for (let i = 0; i < this.kills.length; i += KILL_WIDE)
      for (let j = 9; j < KILL_WIDE; j++) {
        const at = this.kills[i + j]!;
        if (at < 0) continue;
        let to = moved.get(at);
        if (to === undefined) moved.set(at, (to = names.push(this.names[at]!) - 1));
        this.kills[i + j] = to;
      }
    this.names = names;
    this.byCell = null;
  }
  /** What a land's underworld killed in a year, as reckoned for it (null: no reckoning kept stands for that year). */
  killingAt(cell: number, year: number): LandKilling | null {
    if (!this.kills.length) return null;
    if (!this.byCell) {
      this.byCell = new Map();
      for (let i = 0; i < this.kills.length; i += KILL_WIDE) {
        const c = this.kills[i + 2]!,
          at = this.byCell.get(c);
        if (at) at.push(i);
        else this.byCell.set(c, [i]);
      }
    }
    const at = this.byCell.get(cell);
    if (!at) return null;
    for (let x = at.length - 1; x >= 0; x--) {
      const i = at[x]!,
        from = this.kills[i]!;
      if (from > year) continue;
      if (year >= from + this.kills[i + 1]!) return null;
      const k = this.kills,
        name = (j: number): string | null =>
          k[i + j]! >= 0 ? (this.names[k[i + j]!] ?? null) : null;
      return {
        year: from,
        years: k[i + 1]!,
        cell,
        per: k[i + 3]!,
        control: k[i + 4]!,
        gangs: k[i + 5]!,
        street: k[i + 6]!,
        badge: k[i + 7]!,
        racket: (k[i + 8]! & 1) !== 0,
        squad: (k[i + 8]! & 2) !== 0,
        war: name(9),
        holder: name(10),
        crew: name(11),
        feds: [name(12), name(13)],
      };
    }
    return null;
  }
  /** How many reckonings of lands' killings are kept. */
  get killings(): number {
    return this.kills.length / KILL_WIDE;
  }

  /** A group's head gone, kept as the draw stood. */
  addHead(n: HeadNote): void {
    this.heads.push(n);
    if (this.heads.length > NOTES_MOST) this.heads.splice(0, this.heads.length - NOTES_MOST);
  }
  /** Every head of a group gone that the notes keep, the eldest first. */
  headsOf(ref: string): HeadNote[] {
    return this.heads.filter((n) => n.ref === ref);
  }
  /** How a group's head went, by their group's head ref and their name (undefined: no note kept). */
  head(ref: string, name: string): HeadNote | undefined {
    for (let i = this.heads.length - 1; i >= 0; i--) {
      const n = this.heads[i]!;
      if (n.ref === ref && n.name === name) return n;
    }
    return undefined;
  }

  add(n: DeathNote): void {
    this.list.push(n);
    if (this.list.length > NOTES_MOST) this.list.splice(0, this.list.length - NOTES_MOST);
  }
  /** How one died (undefined: no note kept). */
  of(village: string, id: number): DeathNote | undefined {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const n = this.list[i]!;
      if (n.id === id && n.village === village) return n;
    }
    return undefined;
  }
  get size(): number {
    return this.list.length;
  }
  hashInto(h: Hasher): void {
    // (A reading: no part of the world's hash.)
    h.int(0);
  }
  save(): unknown {
    return this.list.length || this.heads.length || this.kills.length
      ? {
          list: this.list,
          ...(this.heads.length ? { heads: this.heads } : {}),
          ...(this.kills.length ? { kills: this.kills, names: this.names } : {}),
        }
      : {};
  }
  load(state: unknown): void {
    const s = state as {
      list?: DeathNote[];
      heads?: HeadNote[];
      kills?: number[];
      names?: string[];
    } | null;
    this.list = [...(s?.list ?? [])];
    this.heads = [...(s?.heads ?? [])];
    this.kills = [...(s?.kills ?? [])];
    this.names = [...(s?.names ?? [])];
    this.byCell = null;
  }
}

export function deathNotesOf(world: World): DeathNotes | null {
  return world.hasStore("readings.deaths") ? world.store<DeathNotes>("readings.deaths") : null;
}

/** The part of a month's hazard the land's killing lays (what protection spares). */
export const KILLING = "the land's killing";

/**
 * One under the hand whose month's draw fell under their chance, or whom the god struck down: whether they die (false: the god's
 * protection spared them, the draw having fallen in the share the land's killing gave their chance), and how, kept for their page.
 */
export function handDeath(
  world: World,
  d: {
    readonly village: Ref;
    readonly id: number;
    readonly place: Ref;
    readonly t: number;
    readonly year: number;
    readonly age: number;
    readonly band: number;
    readonly base: number;
    readonly months: number;
    readonly draw: number;
    readonly chance: number;
    readonly smite: PersonAct | null;
    /** The parts laid on the hazard, then those laid on the chance after it. */
    readonly hazard: readonly DeathPart[];
    readonly after: readonly DeathPart[];
  },
): boolean {
  const me = `agent:${d.id}`;
  if (!d.smite) {
    const guard = actOn(world, me, d.village, d.year, "protect");
    if (guard) {
      // (Their chance without the land's killing: the draw past it fell in the killing's share.)
      const m = d.hazard.reduce((x, p) => (p[0] === KILLING ? x : x * p[1]), 1),
        without = Math.min(
          1,
          deathWithin(riskUnder(d.base, m), d.months) * d.after.reduce((x, p) => x * p[1], 1),
        );
      if (d.draw >= without) {
        sparedBy(world, guard, d.village, d.place, { agent: d.id, age: d.age });
        return false;
      }
    }
  }
  const struck = d.smite
    ? struckBy(world, d.smite, d.village, d.place, { agent: d.id, age: d.age })
    : null;
  deathNotesOf(world)?.add({
    village: d.village,
    id: d.id,
    t: d.t,
    year: d.year,
    age: d.age,
    band: d.band,
    base: d.base,
    months: d.months,
    // (Only the parts that moved it: a factor of exactly 1 laid nothing.)
    parts: [...d.hazard, ...d.after.map((p) => [`${p[0]}*`, p[1], p[2]] as DeathPart)].filter(
      (p) => p[1] !== 1,
    ),
    chance: d.chance,
    draw: d.draw,
    ...(struck ? { event: struck } : {}),
    how: struck ? "struck" : "draw",
  });
  return true;
}

/** One under the hand dead of a blow in a possessed body: kept by the blow's event. */
export function blowDeath(
  world: World,
  d: { village: Ref; id: number; t: number; year: number; age: number; band: number; event: Ref },
): void {
  deathNotesOf(world)?.add({ ...d, how: "blow" });
}
