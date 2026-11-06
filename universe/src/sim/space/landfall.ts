// A landing on a world of natives (Phase 70, first slice), read and not lived: each real arrival on a people still on
// the ladder (sim/space/natives.ts) is a fight for the ground, decided by rules/landfall.ts from what each side had
// that year and a draw keyed to the arrival. Nothing here enters history: no store, no stream, no event, as Phase 69's
// natives. The same world always reads the same landing, and watching one changes nothing. What history does hold
// stays true and is told: a colony's halls stand whatever became of those who went out from them. A later slice can
// make this history (mines, bonded natives, risings, independence all want it): it would have to record the fight as an
// event with its causes, spend the comers' machines, and take the natives' dead off a stored count, and that costs a seed list.
import { hashString, type Ref, type World } from "../../kernel/index.ts";
import {
  CLADES,
  GRIP,
  STAR_DRIVES,
  affordancesOf,
  crossingYears,
  hasMachineHost,
  landfallFight,
  nativeHost,
  shipForce,
  woundCare,
  type BodyPlan,
  type ComerNumbers,
  type LandfallFight,
  type LifeChemistry,
  type NativeNumbers,
  type Part,
} from "../../rules/index.ts";
import { designsOf } from "../design/design.ts";
import { loreOf } from "../lore/lore.ts";
import { homePlanet } from "../planet/store.ts";
import { politiesOf } from "../polity/polity.ts";
import { populationContext } from "../population/systems.ts";
import { civilizationsNear } from "./contact.ts";
import {
  arrivalsAt,
  contactBetween,
  folkByRef,
  folkPeople,
  homeParty,
  partyOf,
  pastLadder,
  type Arrival,
  type ContactReading,
  type Folk,
  type FolkStage,
} from "./natives.ts";
import { peopleNature, peopleStrength, peoplesOf, speedOf, starPoint } from "./peoples.ts";
import { COLONISTS } from "./space.ts";
import { lanesOf, lawlessSeed } from "./lanes.ts";
import { starSitesOf } from "./stars.ts";

/** One landing, read. */
export type Landfall = {
  /** Its place among this people's landings, the first first. */
  readonly n: number;
  readonly arrival: Arrival;
  /** The realm or people who came. */
  readonly ref: Ref;
  /** How many ships, how long they were on the way, and from how far. */
  readonly ships: number;
  readonly years: number;
  readonly distance: number;
  readonly comers: ComerNumbers;
  readonly natives: NativeNumbers;
  readonly reading: ContactReading;
  readonly fight: LandfallFight;
  /** Whether those who came are there still, by what history holds now. */
  readonly stay: boolean;
};

/** Whether an arrival found a people with a fight to give: on the ladder, not in ruins, not themselves among the stars. */
const fights = (found: FolkStage) => found !== "ruins" && !pastLadder(found);

/** Whether anyone has come down on this people, to a fight. */
export function hasLandfall(world: World, f: Folk): boolean {
  return arrivalsAt(world, f).some((a) => fights(a.found));
}

/** What a host in a ship's hold carries: its realm's arm and guard, and no horse crosses the dark. */
function shipParts(parts: readonly Part[]): readonly Part[] {
  const arm = parts.find((p) => p.role === "arm"),
    guard = parts.find((p) => p.role === "guard");
  return [
    arm ?? { role: "arm", id: "automatic", material: "steel" },
    guard ?? { role: "guard", id: "bare", material: "hide" },
    hasMachineHost(parts)
      ? parts.find((p) => p.id === "machine-host")!
      : { role: "mount", id: "foot", material: "hide" },
  ];
}

/** Those who came, by what history holds of them that year. */
function comersOf(
  world: World,
  f: Folk,
  a: Arrival,
  reading: ContactReading,
  life: LifeChemistry,
): Omit<Landfall, "n" | "arrival" | "natives" | "reading" | "fight"> | null {
  if (a.kind === "home") {
    // (A ship sent through the lanes to look holds no land, and is told by what it was (Phase 68).)
    const visit = a.visit !== undefined ? lanesOf(world)?.visits[a.visit] : undefined,
      kept = visit ? undefined : starSitesOf(world)?.get(a.cell!),
      site = visit
        ? {
            realm: visit.realm,
            departed: visit.sailed,
            drive: visit.drive,
            distance: visit.distance,
            from: -1,
          }
        : kept;
    if (!site) return null;
    const realm = politiesOf(world).get(site.realm),
      design = designsOf(world).at(site.realm, site.departed) ?? designsOf(world).of(site.realm),
      parts = shipParts(design?.parts ?? []),
      made = hasMachineHost(parts),
      drive = STAR_DRIVES.find((d) => d.id === site.drive) ?? STAR_DRIVES[0]!,
      // (By the lanes, the years it was on the way: a short way aboard keeps its people as it does its made soldiers.)
      years = visit
        ? visit.arrives - visit.sailed
        : kept?.lane
          ? kept.arrives - kept.departed
          : crossingYears(site.distance, drive),
      force = shipForce(1, COLONISTS, years, made),
      home = homeParty(world, life),
      lore = loreOf(world),
      seat = realm?.seat ?? site.from,
      known = (id: string) => (lore.get(seat, id)?.year ?? Infinity) <= site.departed;
    return {
      ref: site.realm,
      ships: 1,
      years,
      distance: site.distance,
      comers: {
        ...force,
        parts,
        breathes: reading.airThere.can,
        water: home.body.medium === "water",
        gravity: homePlanet(world).generated.system.bodies[0]!.gravity,
        strength: affordancesOf(home.body).strength,
        care: woundCare(known),
      },
      // (A land of the home world's, with anyone left alive in it; a ship sent to look has none.)
      stay: !visit && (populationContext(world).provinces.get(a.cell!)?.total() ?? 0) > 0,
    };
  }
  const civ = civilizationsNear(world).find((c) => c.ref === a.civ);
  if (!civ) return null;
  const strong = peopleStrength(civ, a.year),
    nature = peopleNature(world, civ),
    // (As a people's raid reckons itself: its strength among the stars, and how bold it is.)
    ships = Math.max(1, Math.round(strong * (0.5 + nature.bold))),
    from = starPoint(world, civ.star),
    to = starPoint(world, f.star),
    dx = from.x - to.x,
    dy = from.y - to.y,
    dz = from.z - to.z,
    distance = Math.sqrt(dx * dx + dy * dy + dz * dz),
    speed = Math.max(0.05, speedOf(civ, a.year)),
    years = distance / speed,
    // (What Phase 67 draws them with: beams at 2.2, minds at 3.5.)
    made = strong >= 3.5,
    water = civ.medium === "water",
    arm: Part =
      strong >= 2.2
        ? { role: "arm", id: water ? "beam-lance" : "beam-rifle", material: "crystal" }
        : { role: "arm", id: "automatic", material: "steel" },
    parts: readonly Part[] = [
      arm,
      made
        ? { role: "guard", id: "driven-plate", material: "crystal" }
        : { role: "guard", id: "helmet", material: "steel" },
      made
        ? { role: "mount", id: "machine-host", material: "crystal" }
        : { role: "mount", id: "foot", material: "hide" },
    ],
    theirs = folkByRef(world, civ.ref),
    body: BodyPlan =
      theirs?.body ?? (CLADES.find((c) => c.id === civ.clade)!.body as unknown as BodyPlan);
  return {
    ref: civ.ref,
    ships,
    years,
    distance,
    comers: {
      ...shipForce(ships, COLONISTS, years, made),
      parts,
      breathes: reading.airThere.can,
      water,
      gravity: civ.gravity,
      strength: affordancesOf(body).strength,
      // (A people among the stars has what care it has: est.)
      care: Math.min(1, 0.4 + 0.15 * strong),
    },
    stay: !!peoplesOf(world)
      ?.holdsOf(civ.ref)
      .some((h) => h.star === f.star),
  };
}

/** Every landing on a people, the first first (each a fight, read the same every time). */
export function landfallsOf(world: World, f: Folk, life: LifeChemistry): readonly Landfall[] {
  const out: Landfall[] = [];
  for (const a of arrivalsAt(world, f)) {
    if (!fights(a.found)) continue;
    const theirs = a.kind === "people" ? folkByRef(world, a.civ!) : null,
      party = theirs ? partyOf(theirs) : homeParty(world, life),
      reading = contactBetween(party, partyOf(f)),
      c = comersOf(world, f, a, reading, life);
    if (!c) continue;
    const body = affordancesOf(f.body),
      natives: NativeNumbers = {
        stage: a.found,
        people: folkPeople(f, a.year),
        parts: nativeHost(
          a.found,
          { manipulators: f.body.manipulators, dexterity: body.dexterity },
          GRIP,
          f.stone.keen,
          !!f.means.edge,
          !!f.means.handCharge,
        ),
        gravity: f.gravity,
        strength: body.strength,
        size: f.body.size,
        walls: a.found === "towns" || a.found === "cities" || a.found === "works",
      },
      key = `${lawlessSeed(world.seed.text)} landfall ${f.ref} ${a.year} ${a.kind} ${a.cell ?? a.civ}`,
      u = (s: string) => (hashString(`${key} ${s}`) >>> 0) / 4294967296,
      fight = landfallFight(c.comers, natives, reading.sickness.can, {
        where: u("where"),
        sickThere: u("sick there"),
        sickHome: u("sick home"),
        round: (r, side) => u(`round ${r} ${side}`),
      });
    out.push({ ...c, n: out.length, arrival: a, natives, reading, fight });
  }
  return out;
}
