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
import { BEYOND, G, mostWorksT, worksMachines, worksNextYear } from "../../rules/index.ts";
import { knows, loreOf } from "../lore/lore.ts";
import { politiesOf } from "../polity/polity.ts";
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
      for (const r of [w.begun, w.silent, w.taken]) if (r) out.push(r);
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
    const sent = w.taken ? 0 : span * worksMachines(w.tonnes, realmPeople(ctx, p)),
      m = markets.get(p.seat);
    w.last = m && sent > 0 ? m.move("made", G.machines, sent) : 0;
    w.sent += w.last;
    store.note([refNumber(w.realm), year, Math.round(w.tonnes), w.last]);
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
