// The works in the sky (the Frontier lane; the rules are rules/beyond.ts). A realm with a station whose people make minds
// sets a works on its system's small bodies that builds the next of itself out of what it mines, doubling as the mirrors
// do, up to what of the belt it can reach (more where no giant has stirred the belt away); lit by the mirrors about the
// star it doubles faster, and faster still as far as the minds that tend it are past their makers. It sends down to the
// realm's seat as many machines a year as the realm's people wear out, from rock out of a shallow well, not a deep one.
// Untended thirty years it falls silent; a works whose minds have gone their own way sends nothing down. One small row a
// realm that began one.
import {
  Hasher,
  YEAR,
  defineEventType,
  defineStream,
  yearOfMoment,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { cellRef } from "../../gen/index.ts";
import {
  BEYOND,
  G,
  HABITAT,
  mirrorKw,
  mostWorksT,
  skyRoom,
  skyYear,
  worksMachines,
  worksNextYear,
} from "../../rules/index.ts";
import type { Province } from "../population/model.ts";
import { knows, loreOf } from "../lore/lore.ts";
import { politiesOf, type Polity } from "../polity/polity.ts";
import { homePlanet } from "../planet/store.ts";
import { marketsOf, type PopulationContext } from "../population/systems.ts";
import {
  FLIGHT_PACE,
  MACHINES_PER_COST,
  launcherOfRealm,
  machinesOfRealm,
  spaceOf,
  spendMachines,
} from "../space/space.ts";
import { GREAT_WORK_SHARE } from "../space/late.ts";
import { lateOf } from "../space/late-store.ts";
import { fold, realmPeople, refNumber } from "./common.ts";
import { stirredOf } from "./impacts.ts";
import { mindsFree, mindsPastOf } from "./minds.ts";

export const ORBITAL_EVENTS = {
  /** A realm's first works in the sky. */
  begun: defineEventType("frontier.sky-works", 6),
  /** A works left untended, fallen silent. */
  silent: defineEventType("frontier.sky-works-silent", 4),
  /** The first of a realm's people to live in wheels spun from the belt's rock. */
  habitats: defineEventType("frontier.spun-habitats", 6),
};

const ORBITAL = defineStream("frontier.orbital");

/** Years after their last tending the mirrors still count as lighting a works. */
const MIRRORS_LIGHT = 60;

export type Works = {
  readonly realm: Ref;
  readonly year: number;
  readonly begun: Ref;
  /** Its weight (t), the machines it has sent down in all, the year it was last tended. */
  tonnes: number;
  sent: number;
  tended: number;
  /** Sent down last year. */
  last: number;
  silent: Ref | null;
  /** The minds that tend it gone their own way (their event). */
  taken: Ref | null;
  /** Its spun habitats: those living in them, how many they hold, and the event of the first to go up (absent before). */
  sky?: number;
  room?: number;
  spun?: Ref | null;
};

export class OrbitalStore implements StateStore {
  readonly name = "frontier.orbital";
  readonly works = new Map<Ref, Works>();
  private readonly digest: [number, number] = [0x811c9dc5, 0];

  dormant(): boolean {
    return !this.works.size;
  }
  all(): Works[] {
    return [...this.works.values()].sort((a, b) => (a.realm < b.realm ? -1 : 1));
  }
  note(xs: readonly number[]): void {
    fold(this.digest, xs);
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const w of this.works.values())
      for (const r of [w.begun, w.silent, w.taken, w.spun]) if (r) out.push(r);
    return out;
  }
  hashInto(h: Hasher): void {
    if (this.dormant()) return;
    h.int(this.works.size).int(this.digest[0]).int(this.digest[1]);
  }
  save(): unknown {
    if (this.dormant()) return {};
    return { works: this.all(), digest: [...this.digest] };
  }
  load(state: unknown): void {
    const s = (state ?? {}) as { works?: Works[]; digest?: [number, number] };
    this.works.clear();
    for (const w of s.works ?? []) this.works.set(w.realm, { ...w });
    this.digest[0] = s.digest?.[0] ?? 0x811c9dc5;
    this.digest[1] = s.digest?.[1] ?? 0;
  }
}

export function orbitalOf(world: World): OrbitalStore | null {
  return world.hasStore("frontier.orbital") ? world.store<OrbitalStore>("frontier.orbital") : null;
}

/** Whether the mirrors about the star light the works now. */
export function mirrorsLit(world: World, year: number): boolean {
  const m = lateOf(world)?.mirrors;
  return !!m && year - m.tended <= MIRRORS_LIGHT;
}

/** A grown land's people of every age and trade alike, so many taken from it (no draw): how many. */
function takeFrom(p: Province, n: number): number {
  const all = p.total();
  if (all <= 0 || n <= 0) return 0;
  const share = Math.min(1, n / all);
  let moved = 0;
  for (let r = 0; r < p.counts.rows && moved < n; r++)
    for (let o = 0; o < p.counts.cols && moved < n; o++) {
      const m = Math.min(n - moved, Math.floor(p.counts.get(r, o) * share));
      if (m <= 0) continue;
      p.counts.add(r, o, -m);
      moved += m;
    }
  return moved;
}

/** The light a works' habitats live by (kW): the mirrors', where they light it and its realm tends them, else its own engines'. */
function skyKw(ctx: PopulationContext, w: Works, p: Polity, lit: boolean): number {
  const g = homePlanet(ctx.world).generated,
    m = lateOf(ctx.world)?.mirrors,
    own = w.tonnes * HABITAT.ownKwPerT;
  if (!lit || !m || !knows(ctx, p.seat, "star-mirrors")) return own;
  return own + mirrorKw(m.km2, g.star.luminosity, g.system.bodies[0]!.orbit.a);
}

/**
 * The spun habitats' year: where its people know how to hold halls and spin fibre, the works' rock is hollowed into wheels
 * as many can live in as its rock shields and its light keeps; those in them grow, and more come up from the realm's seat
 * while there is room. (They leave the land's counts and are held on the works' row.)
 */
function habitatsYear(
  ctx: PopulationContext,
  store: OrbitalStore,
  w: Works,
  p: Polity,
  lit: boolean,
  year: number,
): void {
  if (w.taken || !knows(ctx, p.seat, "habitats") || !knows(ctx, p.seat, "drawn-carbon")) return;
  const room = skyRoom(w.tonnes, skyKw(ctx, w, p, lit)),
    sky = w.sky ?? 0;
  w.room = room;
  if (room <= 0 && sky <= 0) return;
  const seat = ctx.provinces.get(p.seat),
    next = skyYear(sky, room, realmPeople(ctx, p)),
    came = seat ? takeFrom(seat, next.came) : 0;
  w.sky = next.sky - next.came + came;
  if (!w.spun && w.sky > 0)
    w.spun = ctx.world.events.emit({
      type: ORBITAL_EVENTS.habitats.type,
      place: cellRef(0, p.seat),
      subjects: [p.ref],
      causes: [{ ref: w.begun, role: "enabler", weight: 1 }],
      data: { realm: p.town, people: w.sky, room },
    });
  store.note([refNumber(w.realm), year, w.sky, room]);
}

/** The works' year: tended, grown and sending down; a realm able to begins one. */
export function orbitalYear(ctx: PopulationContext, t: SimTime): void {
  const world = ctx.world,
    store = orbitalOf(world);
  if (!store) return;
  const year = yearOfMoment(t),
    g = homePlanet(world).generated,
    realms = politiesOf(world),
    space = spaceOf(world),
    most = mostWorksT(stirredOf(g)),
    lit = mirrorsLit(world, year),
    markets = marketsOf(world);
  for (const w of store.all()) {
    const p = realms.get(w.realm),
      alive = !!p && p.ended === null && !!space.of(w.realm)?.station;
    if (!w.taken) {
      const free = mindsFree(world, w.realm);
      if (free) {
        w.taken = free;
        store.note([refNumber(w.realm), year, 3]);
      }
    }
    if (!alive || !p) {
      if (!w.silent && year - w.tended > BEYOND.untended) {
        w.silent = world.events.emit({
          type: ORBITAL_EVENTS.silent.type,
          causes: [{ ref: w.begun, role: "trigger", weight: 1 }],
          data: { tonnes: Math.round(w.tonnes) },
        });
        store.note([refNumber(w.realm), year, 4]);
      }
      w.last = 0;
      continue;
    }
    // (A span stepped at once grows it by the span: a deep-time path.)
    const span = Math.max(1, year - w.tended);
    w.tended = year;
    w.silent = null;
    w.tonnes = worksNextYear(w.tonnes, most, lit, mindsPastOf(world, w.realm), span);
    const sent = w.taken ? 0 : span * worksMachines(w.tonnes, realmPeople(ctx, p) + (w.sky ?? 0)),
      m = markets.get(p.seat);
    w.last = m && sent > 0 ? m.move("made", G.machines, sent) : 0;
    w.sent += w.last;
    store.note([refNumber(w.realm), year, Math.round(w.tonnes), w.last]);
    habitatsYear(ctx, store, w, p, lit, year);
  }
  // A realm able to begins its works: a station, and minds to tend what builds itself.
  for (const p of realms.living()) {
    if (store.works.has(p.ref) || !space.of(p.ref)?.station) continue;
    if (!knows(ctx, p.seat, "machine-minds")) continue;
    const launcher = launcherOfRealm(ctx, p);
    if (!launcher) continue;
    const cost = launcher.cost * BEYOND.firstWorksT * MACHINES_PER_COST,
      machines = machinesOfRealm(ctx, p);
    if (machines * GREAT_WORK_SHARE < cost) continue;
    if (!(world.rng.real(ORBITAL, p.seat, t, 0) < FLIGHT_PACE * 0.3)) continue;
    spendMachines(ctx, p, cost);
    const known = loreOf(world).get(p.seat, "machine-minds"),
      decision = world.decisions.record({
        rule: "frontier.sky-works",
        subject: p.ref,
        outcome: { tonnes: BEYOND.firstWorksT },
        score: machines,
        threshold: cost / GREAT_WORK_SHARE,
        factors: [
          {
            name: `a belt of ${(most / 1e9).toPrecision(2)} billion tonnes within reach${stirredOf(g) ? ", stirred thin by a giant" : ", left whole by no giant"}`,
            value: most,
            contribution: 1,
            source: { ref: g.star.ref as Ref, role: "enabler", weight: 1 },
          },
          {
            name: "machines enough to send up the first works",
            value: machines / Math.max(1, cost),
            contribution: 0.4,
            source: { ref: p.ref, role: "agent", weight: 1 },
          },
        ],
      }),
      begun = world.events.emit({
        type: ORBITAL_EVENTS.begun.type,
        place: cellRef(0, p.seat),
        subjects: [p.ref],
        causes: [
          { ref: decision, role: "trigger", weight: 1 },
          ...(known ? [{ ref: known.event, role: "enabler" as const, weight: 0.8 }] : []),
        ],
        data: { realm: p.town, tonnes: BEYOND.firstWorksT, lit },
      });
    store.works.set(p.ref, {
      realm: p.ref,
      year,
      begun,
      tonnes: BEYOND.firstWorksT,
      sent: 0,
      tended: year,
      last: 0,
      silent: null,
      taken: null,
    });
    store.note([refNumber(p.ref), year, 1]);
  }
}

/** Teach a world its works in the sky. */
export function installOrbital(world: World, ctx: () => PopulationContext): OrbitalStore {
  const store = world.register(new OrbitalStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "209.frontier.orbital", every: YEAR, run: (t) => orbitalYear(ctx(), t) });
  return store;
}
