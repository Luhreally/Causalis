// The political map's data (Phase 10 M96): every realm with its colour, its lands' middles
// and its seat, for its name to be written across them; how every land stands toward one
// realm (the diplomacy lens); where the wars are (the war lens); the world's headline
// numbers for the top bar; and its towns where they stand on the globe (M95), so what is
// seen of them there is what is zoomed into. Pure reads of the world as it stands.
import { isProvinceWorld, offworldSite, regionPoint } from "../gen/index.ts";
import {
  beliefOf,
  citiesOf,
  diplomacyOf,
  homePlanet,
  languagesOf,
  politiesOf,
  populationContext,
  PROVINCE_TILE_KM,
  realmName,
  REGION_SIZE,
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
  return { lands: [...at.entries()], taken: takenLands(world) };
}

/** A land taken by force is marked while it still resents its taking this much. */
const RESENT = 0.35;

/**
 * The lands taken by force, each with the colour of the realm it was taken from (Phase 11
 * M104): a grand strategy map marks them — while the war that took them goes on, or while they
 * still resent the battle they were taken in. A land since taken back, or lost again, is left
 * out.
 */
export function takenLands(world: World): [number, readonly [number, number, number]][] {
  const realms = politiesOf(world),
    out = new Map<number, readonly [number, number, number]>();
  // Still resenting its taking: its grievance is the battle it was taken in.
  for (const p of realms.all()) {
    if (p.ended !== null) continue;
    for (const c of p.members) {
      const d = realms.discontent(c),
        e = d.level >= RESENT && d.cause ? world.events.get(d.cause) : undefined;
      // (Taken there by the realm that holds it still — not passed on since, by a rising or
      // a breaking away, to another that took it from no one.)
      if (e?.type !== WAR_EVENTS.battle.type || e.place !== `cell:0:${c}`) continue;
      const [, taker, loser] = e.subjects;
      if (taker === p.ref && loser && loser !== p.ref) out.set(c, realmColor(loser));
    }
  }
  const fought = new Map<string, number>();
  for (const w of warsOf(world).all())
    if (w.ended === null)
      for (const key of [`${w.attacker}|${w.defender}`, `${w.defender}|${w.attacker}`])
        fought.set(key, Math.min(fought.get(key) ?? Infinity, w.declared));
  if (!fought.size) return [...out];
  for (const e of world.events.all()) {
    if (e.type !== WAR_EVENTS.taken.type || !e.place) continue;
    const [taker, loser] = e.subjects,
      since = fought.get(`${taker}|${loser}`);
    if (since === undefined || Math.floor(e.t / YEAR) < since) continue;
    const land = Number(e.place.split(":")[2]);
    // (Still the taker's: else it went back, or on.)
    if (realms.of(land)?.ref === taker) out.set(land, realmColor(loser!));
  }
  // (Held by another now: taken back, or on.)
  for (const [land, color] of out)
    if (!realms.of(land) || realmColor(realms.of(land)!.ref).every((v, i) => v === color[i]))
      out.delete(land);
  return [...out];
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

/**
 * The world's largest towns where they stand on the globe (unit directions), the largest
 * first: each its name, people, whether a city, and its realm's colour.
 */
export function townsMap(world: World, most = 400) {
  const pw = homePlanet(world).generated,
    ctx = populationContext(world),
    realms = politiesOf(world),
    cities = citiesOf(world);
  if (!isProvinceWorld(pw)) return [];
  return [...ctx.settlements.all()]
    .filter((t) => t.population > 0 && !offworldSite(pw, t.cell))
    .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))
    .slice(0, most)
    .map((t) => {
      const [x, y, z] = regionPoint(
          pw.fine,
          pw.centre[t.cell]!,
          REGION_SIZE,
          PROVINCE_TILE_KM,
          t.tile,
        ),
        realm = realms.of(t.cell);
      return {
        ref: t.ref,
        name: t.name,
        cell: t.cell,
        people: t.population,
        city: !!cities.get(t.ref),
        at: [x, y, z] as [number, number, number],
        color: realm ? realmColor(realm.ref) : null,
      };
    });
}

export const MAP_QUERIES = {
  "realms.map": (world: World) => realmsMap(world),
  "diplomacy.map": (world: World, args: unknown) =>
    diplomacyMap(world, (args as { realm: string }).realm),
  "war.lens": (world: World) => warLens(world),
  "world.stats": (world: World) => worldStats(world),
  "towns.map": (world: World) => townsMap(world),
};
