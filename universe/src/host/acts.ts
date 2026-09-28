// The god's acts where they fall (Phase 12 M106): each act in force or cast lately, placed on
// the globe for its play — rain over a land, fire on a town, a pall of plague, a thread of gold
// between two realms made friends — and a land as the god's palette sees it before an act is
// cast on it. Pure reads of the world as it stands.
import { YEAR, type Ref, type World } from "../kernel/index.ts";
import { isProvinceWorld, offworldSite, regionPoint } from "../gen/index.ts";
import {
  ACT_EVENTS,
  BELIEF_EVENTS,
  LOCAL_ACT_EVENTS,
  PEOPLE_ACT_EVENTS,
  POLITY_EVENTS,
  PROVINCE_TILE_KM,
  REGION_SIZE,
  WAR_EVENTS,
  actsOf,
  beliefOf,
  citiesOf,
  homePlanet,
  politiesOf,
  populationContext,
  realmName,
  warsOf,
  type Act,
} from "../sim/index.ts";
import type { ActKindShown, ActMark, ActsMap, PaletteLand } from "../bridge/index.ts";
import { realmColor } from "./colors.ts";
import { faithColor } from "./planet.ts";
import { landTitle } from "./inspect/names.ts";

/** How long an act done in a moment (a fire, a war set, a land turned) plays on after it. */
export const ACT_SHOWN = 2 * YEAR;

type P3 = readonly [number, number, number];

/** What an act in force shows as, by its kind and which way it goes. */
function shownAs(a: Act): ActKindShown {
  switch (a.kind) {
    case "rain":
      return a.sign > 0 ? "rain" : "drought";
    case "harvest":
      return a.sign > 0 ? "bounty" : "blight";
    case "plague":
      return a.sign > 0 ? "healing" : "plague";
    default:
      return "inspiration";
  }
}

/** Every act in force, or done lately, where it falls on the home world's globe. */
export function actsMap(world: World): ActsMap {
  const g = homePlanet(world).generated,
    now = world.now,
    year = Math.floor(now / YEAR),
    out: ActMark[] = [];
  if (!isProvinceWorld(g)) return { year, acts: out };
  const p = g.fine.grid.positions,
    ctx = populationContext(world),
    realms = politiesOf(world),
    landAt = (cell: number): P3 | null => {
      const s = g.centre[cell];
      return s === undefined || s < 0 || offworldSite(g, cell)
        ? null
        : [p[s * 3]!, p[s * 3 + 1]!, p[s * 3 + 2]!];
    },
    cellOf = (ref: unknown) =>
      typeof ref === "string" && ref.startsWith("cell:0:") ? Number(ref.slice(7)) : -1,
    townAt = (ref: unknown): P3 | null => {
      const t = typeof ref === "string" ? ctx.settlements.get(ref as Ref) : undefined;
      if (!t || offworldSite(g, t.cell)) return null;
      return regionPoint(g.fine, g.centre[t.cell]!, REGION_SIZE, PROVINCE_TILE_KM, t.tile);
    },
    seatOf = (ref: unknown) => {
      const r = typeof ref === "string" ? realms.get(ref as Ref) : undefined;
      return r ? landAt(r.seat) : null;
    };
  // The acts on a land in force (and inspiration, for a while after).
  for (const a of actsOf(world).all()) {
    const lasting = a.until > a.from,
      end = lasting ? a.until : a.from + ACT_SHOWN;
    if (a.from > now || now >= end) continue;
    const at = landAt(a.cell);
    if (!at) continue;
    out.push({
      kind: shownAs(a),
      at,
      to: null,
      color: null,
      left: (end - now) / (end - a.from),
      event: a.event,
    });
  }
  // What was done in a moment lately: on a town, between two realms, on a land.
  const events = world.events.all(),
    since = now - ACT_SHOWN,
    byAct = (e: (typeof events)[number]) => e.causes[0]?.role === "agent";
  for (let i = events.length - 1; i >= 0 && events[i]!.t > since; i--) {
    const e = events[i]!,
      left = 1 - (now - e.t) / ACT_SHOWN;
    let mark: Omit<ActMark, "left" | "event"> | null = null;
    switch (e.type) {
      case LOCAL_ACT_EVENTS.fire.type:
      case LOCAL_ACT_EVENTS.spring.type:
      case LOCAL_ACT_EVENTS.shrine.type: {
        const at = townAt(e.subjects[0]);
        if (at)
          mark = {
            kind:
              e.type === LOCAL_ACT_EVENTS.fire.type
                ? "fire"
                : e.type === LOCAL_ACT_EVENTS.spring.type
                  ? "spring"
                  : "shrine",
            at,
            to: null,
            color: null,
          };
        break;
      }
      case PEOPLE_ACT_EVENTS.friendship.type:
      case PEOPLE_ACT_EVENTS.discord.type: {
        const at = seatOf(e.subjects[0]),
          to = seatOf(e.subjects[1]);
        if (at && to)
          mark = {
            kind: e.type === PEOPLE_ACT_EVENTS.friendship.type ? "friendship" : "discord",
            at,
            to,
            color: null,
          };
        break;
      }
      case WAR_EVENTS.declared.type:
      case WAR_EVENTS.peace.type: {
        const at = seatOf(e.subjects[1]),
          to = seatOf(e.subjects[2]);
        if (byAct(e) && at && to)
          mark = {
            kind: e.type === WAR_EVENTS.declared.type ? "war" : "peace",
            at,
            to,
            color: realmColor(e.subjects[1]!),
          };
        break;
      }
      case POLITY_EVENTS.seceded.type: {
        const at = landAt(cellOf(e.place));
        if (byAct(e) && at) mark = { kind: "rising", at, to: null, color: null };
        break;
      }
      case BELIEF_EVENTS.converted.type: {
        const at = landAt(cellOf(e.place));
        if (byAct(e) && at)
          mark = { kind: "conversion", at, to: null, color: faithColor(e.subjects[0]!) };
        break;
      }
    }
    if (mark) out.push({ ...mark, left, event: e.id });
  }
  return { year, acts: out };
}

/** A land as the god's palette sees it (null: no land of the home world's people). */
export function paletteLand(world: World, cell: number): PaletteLand | null {
  const g = homePlanet(world).generated,
    ctx = populationContext(world),
    prov = ctx.provinces.get(cell);
  if (!prov || offworldSite(g, cell)) return null;
  const r = politiesOf(world).of(cell),
    belief = beliefOf(world).of(cell),
    faith = belief.faith ? beliefOf(world).get(belief.faith) : undefined,
    cities = citiesOf(world);
  return {
    cell,
    name: landTitle(world, cell),
    people: prov.total(),
    realm:
      r && r.ended === null
        ? {
            ref: r.ref,
            name: realmName(r),
            color: realmColor(r.ref),
            lands: r.members.filter((c) => !offworldSite(g, c)),
            seat: r.seat === cell,
            foes: warsOf(world)
              .fighting(r.ref)
              .map((w) => (w.attacker === r.ref ? w.defender : w.attacker)),
          }
        : null,
    faith: faith ? { ref: faith.ref, name: faith.name, color: faithColor(faith.ref) } : null,
    towns: [...ctx.settlements.inProvince(cell)]
      .filter((t) => t.population > 0)
      .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))
      .map((t) => ({
        ref: t.ref,
        name: t.name,
        people: t.population,
        city: !!cities.get(t.ref),
        shrine: !!t.shrine,
        spring: !!t.spring,
      })),
  };
}
