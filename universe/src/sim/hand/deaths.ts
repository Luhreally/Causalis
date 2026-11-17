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

/** The most of the deaths the notes keep (as the hand's gone: the eldest let go first). */
const NOTES_MOST = 4000;

export class DeathNotes implements StateStore {
  readonly name = "readings.deaths";
  readonly observational = true;
  readonly outsideRules = true;
  private list: DeathNote[] = [];

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
    return this.list.length ? { list: this.list } : {};
  }
  load(state: unknown): void {
    this.list = [...((state as { list?: DeathNote[] } | null)?.list ?? [])];
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
