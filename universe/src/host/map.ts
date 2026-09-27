// The political map's data (Phase 10 M96): every realm with its colour, its lands' middles
// and its seat, for its name to be written across them; how every land stands toward one
// realm (the diplomacy lens); where the wars are (the war lens); and the world's headline
// numbers for the top bar. Pure reads of the world as it stands.
import { offworldSite } from "../gen/index.ts";
import {
  beliefOf,
  citiesOf,
  diplomacyOf,
  homePlanet,
  languagesOf,
  politiesOf,
  populationContext,
  realmName,
  warsOf,
  WAR_EVENTS,
} from "../sim/index.ts";
import { YEAR, type Ref, type World } from "../kernel/index.ts";
import { realmColor } from "./colors.ts";

/** Every realm of the home world: its name, colour, its lands' middles (spots) and its seat's. */
export function realmsMap(world: World) {
  const g = homePlanet(world).generated,
    ctx = populationContext(world);
  return politiesOf(world)
    .all()
    .filter((r) => r.ended === null)
    .map((r) => {
      const lands = r.members.filter((c) => !offworldSite(g, c));
      return {
        ref: r.ref,
        name: realmName(r),
        short: r.town,
        color: realmColor(r.ref),
        spots: lands.map((c) => g.centre[c]!).filter((s) => s >= 0),
        seat: g.centre[r.seat] ?? -1,
        people: lands.reduce((s, c) => s + (ctx.provinces.get(c)?.total() ?? 0), 0),
      };
    })
    .filter((r) => r.spots.length > 0);
}

export type Standing = "self" | "pact" | "friendly" | "neutral" | "rival" | "war";

/** How every land of the home world stands toward one realm: its own, sworn, friendly … at war. */
export function diplomacyMap(world: World, focus: string) {
  const realms = politiesOf(world),
    me = realms.get(focus as Ref),
    g = homePlanet(world).generated,
    lands: [number, Standing][] = [];
  if (!me) return { focus: null, name: null, lands };
  const fighting = new Set(
    warsOf(world)
      .fighting(me.ref)
      .map((w) => (w.attacker === me.ref ? w.defender : w.attacker)),
  );
  const diplomacy = diplomacyOf(world);
  for (const r of realms.all()) {
    if (r.ended !== null) continue;
    let standing: Standing = "neutral";
    if (r.ref === me.ref) standing = "self";
    else if (fighting.has(r.ref)) standing = "war";
    else {
      const x = diplomacy.get(me.ref, r.ref);
      if (x?.pact) standing = "pact";
      else if (x && x.opinion > 0.25) standing = "friendly";
      else if (x && x.opinion < -0.25) standing = "rival";
    }
    for (const c of r.members) if (!offworldSite(g, c)) lands.push([c, standing]);
  }
  return { focus: me.ref, name: realmName(me), lands };
}

export type WarStanding = "attacker" | "defender" | "prize" | "taken";

/** Where the wars are: the lands of realms attacking and defending, what they fight for, what was lately taken. */
export function warLens(world: World) {
  const realms = politiesOf(world),
    g = homePlanet(world).generated,
    year = Math.floor(world.now / YEAR),
    at = new Map<number, WarStanding>();
  for (const w of warsOf(world).all()) {
    if (w.ended !== null) continue;
    for (const [ref, side] of [
      [w.attacker, "attacker"],
      [w.defender, "defender"],
    ] as const)
      for (const c of realms.get(ref)?.members ?? [])
        if (!offworldSite(g, c) && !at.has(c)) at.set(c, side);
    at.set(w.prize, "prize");
  }
  // What war took lately (these two years).
  const events = world.events.all();
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    if (Math.floor(e.t / YEAR) < year - 2) break;
    if (e.type === WAR_EVENTS.taken.type && e.place) at.set(Number(e.place.split(":")[2]), "taken");
  }
  return { lands: [...at.entries()] };
}

/** The world's headline numbers, for the top bar. */
export function worldStats(world: World) {
  const ctx = populationContext(world),
    g = homePlanet(world).generated,
    provinces = ctx.provinces.all(),
    home = provinces.filter((p) => !offworldSite(g, p.cell) && p.total() > 0),
    realms = politiesOf(world)
      .all()
      .filter((r) => r.ended === null),
    beliefs = beliefOf(world),
    faiths = new Set<string>(),
    tongues = new Set<number>();
  for (const p of home) {
    const f = beliefs.of(p.cell).faith;
    if (f) faiths.add(f);
    const l = languagesOf(world).of(p.cell);
    if (l) tongues.add(l.index);
  }
  const towns = ctx.settlements.all(),
    cities = towns.filter((t) => citiesOf(world).get(t.ref)).length,
    famine = home.filter((p) => p.fed < 850).length;
  return {
    year: Math.floor(world.now / YEAR),
    people: provinces.reduce((s, p) => s + p.total(), 0),
    lands: home.length,
    towns: towns.length,
    cities,
    realms: realms.length,
    wars: warsOf(world)
      .all()
      .filter((w) => w.ended === null).length,
    faiths: faiths.size,
    tongues: tongues.size,
    hungry: famine,
    colonies: provinces.filter((p) => offworldSite(g, p.cell) && p.total() > 0).length,
  };
}

export const MAP_QUERIES = {
  "realms.map": (world: World) => realmsMap(world),
  "diplomacy.map": (world: World, args: unknown) =>
    diplomacyMap(world, (args as { realm: string }).realm),
  "war.lens": (world: World) => warLens(world),
  "world.stats": (world: World) => worldStats(world),
};
