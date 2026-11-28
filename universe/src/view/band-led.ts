// A band led by a hand (Live a Line's tribe, S6, 2026-11-28): the band of view/band.ts living as it does of itself, with a
// hand on it. Stepped through `LedBand.step`, which reads what the band's own step did (a night come, armfuls brought home,
// fresh ground camped on), and nothing of view/band.ts is changed for it: every band not led lives as it always did.
// A well-fed band has children; a starved one loses its weakest. Seed dug from the grass and eaten by the fire is dropped
// there, and where the band camps again days after, if a wild grain grows in its land, it has come up: the way sowing came
// to people, seen. The hand sends the hunters after a beast, walks the band on at first light to ground it chose, and sends
// the gatherers to the grass. Pure and keyed (the band's own draws); fetched only with Live a Line (tools/lint-rules.ts
// LAZY_ONLY).
import { bandHour, stepBand, type BandPerson, type BandState } from "./band.ts";
import { MEADOW_H, MEADOW_W, type Beast, type MeadowState } from "./meadow.ts";

/** Seed dropped at a camp comes up so many days after, if so many armfuls were eaten there; found within so far (m). */
const SPROUT_DAYS = 4,
  SPROUT_ARMFULS = 3,
  SPROUT_NEAR = 16;
/** Days running the store stands full (days of food) for a child; empty, for one lost. */
const FULL = 6,
  FULL_DAYS = 3,
  LEAN_DAYS = 3;
/** The band's hours and reach, as view/band.ts has them: they go out, come home; how far the hunters go (m). */
const OUT = 7.5,
  HOME = 18,
  HUNT_REACH = 64;
/** Their places about the fire, as view/band.ts lays them (ROOM, ROW): a body's room on a ring, and from ring to ring (m). */
const ROOM = 2.1,
  ROW = 2.6;

/** The i-th of n's place in rings about a fire (view/band.ts ringOf). */
function ringOf(i: number, n: number): { row: number; a: number } {
  for (let row = 0, first = 0; ; row++) {
    const here = Math.min(
      Math.max(1, Math.floor((2 * Math.PI * (3.2 + ROW * row)) / ROOM)),
      n - first,
    );
    if (i < first + here) return { row, a: (2 * Math.PI * (i - first + (row % 2) * 0.5)) / here };
    first += here;
  }
}

/**
 * Whether the hunters could take a beast: view/band.ts bandQuarry's rule, read here so that nothing more of the god game's
 * first chunks is asked for by this mode (each name it shares costs them bytes).
 */
export function takeable(m: MeadowState, q: Beast): boolean {
  const k = m.kinds[q.kind]!;
  return (
    !k.tame &&
    (k.feed === "graze" || k.feed === "browse" || k.feed === "great" || k.feed === "peck") &&
    k.size >= 8 &&
    k.size <= 1200 &&
    q.doing !== "coming"
  );
}

/**
 * Dry ground about a point to camp on, as view/band.ts campGround finds it: in from the meadow's edge, off the pond, clear
 * of the woods; the nearest such of sixteen keyed tries (the point itself, if none).
 */
function groundNear(
  m: MeadowState,
  rnd: () => number,
  at: { x: number; z: number },
): { x: number; z: number } {
  let best = { x: at.x, z: at.z },
    most = Infinity;
  for (let k = 0; k < 16; k++) {
    const a = rnd() * 2 * Math.PI,
      d = 8 * rnd(),
      x = at.x + Math.sin(a) * d,
      z = at.z + Math.cos(a) * d;
    if (Math.abs(x) > MEADOW_W / 2 - 12 || Math.abs(z) > MEADOW_H / 2 - 10) continue;
    if (m.pond && Math.hypot(x - m.pond.x, z - m.pond.z) < m.pond.r + 6) continue;
    if (m.shrubs.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + 3)) continue;
    if (d < most) {
      most = d;
      best = { x, z };
    }
  }
  return best;
}

export class LedBand {
  /** Days running the store has stood full at nightfall, or empty. */
  full = 0;
  lean = 0;
  /** Children born under the hand; people lost to hunger. */
  born = 0;
  lost = 0;
  /** As many as it may grow to (twice what it was). */
  readonly most: number;
  /** Whether a wild grain grows in the land: none, and no seed comes up. */
  readonly grain: boolean;
  /** Where seed was dropped (its camps), on what day, so many armfuls. */
  readonly seed: { x: number; z: number; day: number; n: number }[] = [];
  /** Its gatherers sent to the grass for seed (a wild grain's heads, where one grows), the woods let be. */
  grass = false;
  /** Where it came up (null: not yet). */
  sprouted: { x: number; z: number } | null = null;
  /** The ground the hand chose to walk on to at first light (null: none). */
  walkTo: { x: number; z: number } | null = null;
  private readonly leaf: number[] = [];

  constructor(b: BandState, grain: boolean) {
    this.grain = grain;
    this.most = b.people.length * 2;
  }

  /** A step of the band's: what it did read, the hand's part laid on. */
  step(b: BandState, m: MeadowState): void {
    const day = b.day,
      gathered = b.gathered,
      camps = b.camps,
      going = b.going;
    // (Sent to the grass: the woods' leaf is nothing to them this step, so they dig the grass for its seed.)
    if (this.grass) {
      this.leaf.length = 0;
      for (const s of m.shrubs) {
        this.leaf.push(s.leaf);
        s.leaf = 0;
      }
    }
    stepBand(b, m);
    if (this.grass) m.shrubs.forEach((s, i) => (s.leaf = this.leaf[i] ?? s.leaf));
    // (Armfuls of the grass's seed eaten by the fire: some of it dropped there.)
    if (this.grass && b.gathered > gathered) {
      const at = this.seed.find((s) => Math.hypot(s.x - b.camp.x, s.z - b.camp.z) < 6);
      if (at) at.n += b.gathered - gathered;
      else this.seed.push({ x: b.camp.x, z: b.camp.z, day: b.day, n: b.gathered - gathered });
    }
    // (Packed up at first light: to the ground the hand chose, if it chose any.)
    if (!going && b.going && this.walkTo) {
      b.going = groundNear(m, b.rnd, this.walkTo);
      this.walkTo = null;
    }
    if (b.camps > camps) this.camped(b);
    if (b.day > day) this.night(b);
  }

  /** At nightfall: a child born to a band long well fed; the weakest lost to a band long starved. */
  private night(b: BandState): void {
    this.full = b.food >= FULL ? this.full + 1 : 0;
    this.lean = b.food <= 0.05 ? this.lean + 1 : 0;
    if (this.full >= FULL_DAYS && b.people.length < this.most) {
      this.full = 0;
      this.born++;
      const mother = b.people.find((p) => p.kin === "grown" && !p.hunter) ?? b.people[0]!,
        i = b.people.length,
        ring = ringOf(i, i + 1),
        child: BandPerson = {
          id: Math.max(...b.people.map((p) => p.id)) + 1,
          name: "",
          kin: "child",
          hunter: false,
          x: mother.x,
          z: mother.z,
          heading: mother.heading,
          speed: 0,
          doing: "resting",
          target: -1,
          timer: 1,
          carry: 0,
          carrying: null,
          seat: ring.a + 0.12 * (b.rnd() - 0.5),
          row: ring.row,
          phase: b.rnd(),
          making: null,
        };
      b.people.push(child);
      b.news.push(
        `A child is born to the band, fed well these three days: they are ${b.people.length} now.`,
      );
    }
    if (this.lean >= LEAN_DAYS && b.people.length > 4) {
      this.lean = 0;
      this.lost++;
      const weakest =
        b.people.find((p) => p.kin === "old") ??
        b.people.find((p) => p.kin === "child") ??
        b.people.at(-1)!;
      b.people.splice(b.people.indexOf(weakest), 1);
      b.news.push(
        `${weakest.name || (weakest.kin === "old" ? "One of the old" : "A child")} died in the hungry days: the band is ${b.people.length} now.`,
      );
    }
  }

  /** Come to fresh ground: if it is where they dropped seed days since, and a wild grain grows here, it has come up. */
  private camped(b: BandState): void {
    if (!this.grain || this.sprouted) return;
    const old = this.seedNear(b.camp.x, b.camp.z, b.day);
    if (!old) return;
    this.sprouted = { x: old.x, z: old.z };
    b.news.push(
      "Where they camped before, the seed they dropped about the fire has come up: wild grain, growing thick on the old camp's ground.",
    );
  }

  /** Seed dropped near a point long enough since, and enough of it, to have come up there. */
  seedNear(x: number, z: number, day: number): { x: number; z: number } | null {
    return (
      this.seed.find(
        (s) =>
          s.n >= SPROUT_ARMFULS &&
          day - s.day >= SPROUT_DAYS &&
          Math.hypot(s.x - x, s.z - z) < SPROUT_NEAR,
      ) ?? null
    );
  }
}

/** The hunters sent after a beast: null, or why they cannot go. */
export function orderHunt(b: BandState, m: MeadowState, id: number): string | null {
  const q = m.beasts.find((x) => x.id === id),
    hour = bandHour(b);
  if (!q) return "it is gone";
  if (b.going) return "the band is walking on";
  if (hour < OUT || hour >= HOME) return "the hunters go out by day";
  if (!b.people.some((p) => p.hunter)) return "the band has no hunters";
  if (b.kill) return "a kill is being cut up";
  if (!takeable(m, q)) return "too great a beast for them to take";
  if (Math.hypot(q.x - b.camp.x, q.z - b.camp.z) > HUNT_REACH) return "too far from the camp";
  b.quarry = q.id;
  b.hunts++;
  b.tries++;
  b.chase = 0;
  return null;
}

/**
 * The band told to walk on to ground about a point: it packs up at the next first light, as a band does (view/band.ts's
 * own morning), and walks there. Null, or why it cannot.
 */
export function orderWalk(b: BandState, l: LedBand, x: number, z: number): string | null {
  if (b.going) return "the band is walking on already";
  if (Math.hypot(x - b.camp.x, z - b.camp.z) < 10) return "that is where they are camped";
  if (Math.hypot(x - b.camp.x, z - b.camp.z) > HUNT_REACH * 2.5) return "too far to walk in a day";
  l.walkTo = { x, z };
  // (Long enough here to pack up at the next first light.)
  b.here = Math.max(b.here, 99);
  return null;
}
