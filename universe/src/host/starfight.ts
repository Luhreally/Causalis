// A fight among the stars, as the view reads it (Phase 67): the list of fights the world has
// had, and one fight's plan (who fought, what each side had, where, and what the record says
// came of it). Read only: it takes what history holds and writes nothing, draws no random
// number, and never enters the record. The ships, their places and their fates are the view's
// own, hashed from the fight's id.
import { yearOfMoment, type Ref, type World } from "../kernel/index.ts";
import { offworldSite, type Civilization } from "../gen/index.ts";
import { CLADES, starDriveFor } from "../rules/index.ts";
import { why } from "../causal/index.ts";
import {
  FLEET_MACHINES,
  civilizationsNear,
  holdWorld,
  homePlanet,
  nationsOf,
  loreOf,
  peopleStrength,
  peopleWords,
  peoplesOf,
  politiesOf,
  populationContext,
  realmName,
  spaceOf,
  speedOf,
  starWarsOf,
  type Raid,
  type StarWar,
} from "../sim/index.ts";
import { figureBody, starFolk } from "./folk.ts";
import { PEOPLE_COLORS } from "./peoples.ts";
import { realmColor } from "./colors.ts";
import { hostKinds } from "./arms.ts";
import { peopleBody } from "./village.ts";
import { link, stat } from "./inspect/words.ts";
import type { QueryHandler } from "./host.ts";
import type {
  FightArm,
  FightDrive,
  FightPlace,
  FightSide,
  PageModel,
  StarFightEntry,
  StarFightList,
  StarFightPlan,
  StarLanding,
} from "../bridge/index.ts";

/** The list of fights shows at most this many rows. */
export const FIGHTS_SHOWN = 60;

/** The drive a realm's strength asks: 4.5 and up antimatter, 2.8 and up a sail, else fusion. */
export function driveOfStrength(strength: number): FightDrive {
  if (strength >= 4.5) return "antimatter";
  if (strength >= 2.8) return "sail";
  return "fusion";
}

/** The drive a people's speed asks (light-years a year): under 0.12 fusion, under 0.25 a sail. */
export function driveOfSpeed(speed: number): FightDrive {
  if (speed < 0.12) return "fusion";
  if (speed < 0.25) return "sail";
  return "antimatter";
}

/** How much a fight is worth watching: a town it came down on, ships on both sides, an even fight. */
export function fightRank(e: {
  town: string | null;
  ships: boolean;
  strength: number;
  defence: number;
}): number {
  const p = e.strength / (e.strength + Math.max(e.defence, 0.1));
  return (e.town ? 4 : 0) + (e.ships ? 2 : 0) + (1 - Math.abs(p - 0.5) * 2);
}

/** The fight to watch first: the highest rank, the later year on a tie, then the earlier in the list. */
export function bestFight(fights: readonly StarFightEntry[]): string | null {
  let best: StarFightEntry | null = null;
  let bestRank = 0;
  for (const e of fights) {
    const rank = fightRank(e);
    if (best === null || rank > bestRank || (rank === bestRank && e.year > best.year)) {
      best = e;
      bestRank = rank;
    }
  }
  return best?.id ?? null;
}

/** A ship's ref read back: `ship:<fight with . for :>:<side>:<index>:<cls>:<0|1>:<name>`, or null. */
export function parseShipRef(ref: string): {
  fight: string;
  side: 0 | 1;
  index: number;
  cls: 0 | 1 | 2;
  broke: boolean;
  name: string;
} | null {
  const m = /^ship:([^:]+):([01]):(\d+):([012]):([01]):(.+)$/.exec(ref);
  if (!m) return null;
  return {
    fight: m[1]!,
    side: Number(m[2]) as 0 | 1,
    index: Number(m[3]),
    cls: Number(m[4]) as 0 | 1 | 2,
    broke: m[5] === "1",
    name: m[6]!,
  };
}

/** A battle's own numbers as its event keeps them. */
type FightData = {
  readonly strength: number;
  readonly defence: number;
  readonly year: number;
  readonly realm?: string;
};

/** One row before its plan is read: a fought war (by its arrival) or a raid (by its year). */
type Light = {
  readonly id: string;
  readonly year: number;
  readonly war: StarWar | null;
  readonly raid: Raid | null;
};

const newest = (a: { readonly year: number }, b: { readonly year: number }) => b.year - a.year;

/** Why, as a sentence, or "" where the record cannot say. */
function safeWhy(world: World, ref: Ref): string {
  try {
    return why(world, ref).claim;
  } catch {
    return "";
  }
}

/** The beam a side fires from its medium: a lance under water, a rifle on land and shore. */
function beamArmOf(medium: FightSide["medium"]): "beam-rifle" | "beam-lance" {
  return medium === "water" ? "beam-lance" : "beam-rifle";
}

/** A realm as one side of a fight: as the attacker of a war, or as the defender of a raid. */
function realmSide(
  world: World,
  ref: string,
  year: number,
  strength: number,
  attacker: boolean,
): FightSide {
  const body = peopleBody(world);
  const medium = body?.medium ?? "land";
  const common = {
    ref,
    kind: "realm" as const,
    color: realmColor(ref),
    strength,
    machines: attacker ? FLEET_MACHINES : null,
    gravity: homePlanet(world).generated.planet.gravity,
    medium,
    clade: body?.clade ?? null,
  };
  const R = politiesOf(world).get(ref as Ref);
  if (!R) {
    return {
      ...common,
      name: "a realm now gone",
      words: "a realm now gone",
      drive: driveOfStrength(strength),
      arm: "missile",
      beamArm: null,
      minds: false,
      sky: "fleet",
    };
  }
  // What the realm's seat knew by the year of the fight (a fleet, by the year it sailed).
  const known = (id: string) => (loreOf(world).get(R.seat, id)?.year ?? Infinity) <= year;
  const arm: FightArm = known("beam-arms") ? "beam" : "missile";
  const base = {
    ...common,
    name: R.town,
    words: realmName(R),
    arm,
    beamArm: arm === "beam" ? beamArmOf(medium) : null,
    minds: known("machine-minds"),
  };
  if (attacker) return { ...base, sky: "fleet", drive: driveOfStrength(strength) };
  const prog = spaceOf(world).of(ref as Ref);
  const yr = (e: Ref | null | undefined) => {
    const ev = e ? world.events.get(e) : undefined;
    return ev ? yearOfMoment(ev.t) : Infinity;
  };
  const sat = yr(prog?.satellite) <= year;
  const station = yr(prog?.station) <= year;
  const d = starDriveFor(known);
  return {
    ...base,
    drive: (d?.id ?? "none") as FightDrive,
    sky: d ? "fleet" : sat || station ? "platforms" : "none",
  };
}

/** A people of the stars as one side of a fight. */
function peopleSide(world: World, civ: Civilization, year: number, strength: number): FightSide {
  const i = civilizationsNear(world).indexOf(civ);
  const w = peopleWords(world, civ);
  const ps = peopleStrength(civ, year);
  const medium = civ.medium as FightSide["medium"];
  return {
    ref: civ.ref,
    kind: "people",
    name: `the ${w.name}`,
    words: `${w.kind}, ${civ.distance.toFixed(1)} light-years out`,
    color: PEOPLE_COLORS[i % PEOPLE_COLORS.length]!,
    strength,
    machines: null,
    gravity: civ.gravity,
    medium,
    clade: civ.clade,
    drive: driveOfSpeed(speedOf(civ, year)),
    arm: ps >= 2.2 ? "beam" : "missile",
    beamArm: ps >= 2.2 ? beamArmOf(medium) : null,
    minds: ps >= 3.5,
    sky: "fleet",
  };
}

/** Those who hold a world of another star against a fleet of a realm (Phase 72): a realm's own, or a realm of worlds, or its own people. */
function worldSide(world: World, w: StarWar, year: number, strength: number): FightSide {
  const R = politiesOf(world).get(w.enemy as Ref);
  if (R) return realmSide(world, w.enemy, year, strength, false);
  const body = peopleBody(world),
    medium = body?.medium ?? "land",
    store = nationsOf(world),
    n = store?.nation(w.enemy),
    h = store?.get(w.at!.key),
    drive = h?.own?.drive ?? null;
  return {
    ref: w.enemy,
    kind: "realm",
    name: n?.name ?? "its own people",
    words: n ? `a realm of worlds, ruled from out here` : "a world gone its own way",
    color: realmColor(w.enemy),
    strength,
    machines: null,
    gravity: homePlanet(world).generated.planet.gravity,
    medium,
    clade: body?.clade ?? null,
    drive: (drive ?? "none") as FightDrive,
    arm: "missile",
    beamArm: null,
    minds: false,
    sky: drive ? "fleet" : "platforms",
  };
}

/** A war for a world, fought: the fleet over that world. */
function worldWarPlan(world: World, w: StarWar, nowYear: number): StarFightPlan | null {
  const ev = w.battle ? world.events.get(w.battle) : undefined;
  const d = ev?.data as FightData | null | undefined;
  if (!w.battle || !ev || !d || !w.at) return null;
  return {
    id: w.ref,
    road: "starwar",
    year: d.year,
    sailed: w.sailed,
    attacker: realmSide(world, w.realm, w.sailed, d.strength, true),
    defender: worldSide(world, w, d.year, d.defence),
    won: w.won === true,
    place: {
      kind: "foreign",
      star: w.at.star,
      planet: w.at.planet,
      words: "over a world among the stars that went its own way",
    },
    event: w.battle,
    war: w.ref,
    claim: safeWhy(world, w.battle),
    why: safeWhy(world, w.event),
    landing: null,
    nowYear,
  };
}

/** A war between the stars, fought: its plan, or null where the record cannot give one. */
function warPlan(world: World, w: StarWar, nowYear: number): StarFightPlan | null {
  if (!w.battle) return null;
  if (w.at) return worldWarPlan(world, w, nowYear);
  const ev = world.events.get(w.battle);
  const d = ev?.data as FightData | null | undefined;
  const civ = civilizationsNear(world).find((c) => c.ref === w.enemy);
  if (!ev || !d || !civ) return null;
  return {
    id: w.ref,
    road: "starwar",
    year: d.year,
    sailed: w.sailed,
    attacker: realmSide(world, w.realm, w.sailed, d.strength, true),
    defender: peopleSide(world, civ, d.year, d.defence),
    won: w.won === true,
    place: {
      kind: "foreign",
      star: civ.star,
      planet: civ.planet,
      words: `over the world of the ${peopleWords(world, civ).name}, ${civ.distance.toFixed(1)} light-years from home`,
    },
    event: w.battle,
    war: w.ref,
    claim: safeWhy(world, w.battle),
    why: safeWhy(world, w.event),
    landing: null,
    nowYear,
  };
}

/** The town a won raid on a realm came down on, with its raiders and its defenders, or null. */
function landingOf(
  world: World,
  r: Raid,
  civ: Civilization,
  attacker: FightSide,
  defender: FightSide,
  realm: string,
): StarLanding | null {
  const clade = CLADES.find((c) => c.id === civ.clade);
  if (!clade) return null;
  const peopled = populationContext(world)
    .settlements.inProvince(r.cell)
    .filter((s) => s.population > 0);
  const t =
    peopled.find((s) => s.name === realm) ?? peopled.sort((a, b) => b.population - a.population)[0];
  if (!t) return null;
  return {
    town: t.ref,
    townName: t.name,
    cell: r.cell,
    people: t.population,
    dead: r.dead,
    razed: 0.1,
    raiders: {
      ref: civ.ref,
      name: attacker.name,
      kind: peopleWords(world, civ).kind,
      body: figureBody(clade.body, starFolk(civ)),
      color: attacker.color,
    },
    defenders: {
      ref: r.other,
      name: defender.name,
      color: defender.color,
      host: hostKinds(world, r.other, { year: r.year }),
    },
  };
}

/** A raid by a people, fought: its plan, or null where the record cannot give one. */
function raidPlan(world: World, r: Raid, nowYear: number): StarFightPlan | null {
  const ev = world.events.get(r.event);
  const d = ev?.data as FightData | null | undefined;
  const civs = civilizationsNear(world);
  const civ = civs.find((c) => c.ref === r.civ);
  if (!ev || !d || !civ) return null;
  const them = civs.find((c) => c.ref === r.other);
  const attacker = peopleSide(world, civ, r.year, d.strength);
  const defender = them
    ? peopleSide(world, them, r.year, d.defence)
    : realmSide(world, r.other, r.year, d.defence, false);
  const cause = ev.causes[0]?.ref;
  const causeEv = cause ? world.events.get(cause) : undefined;
  const claim = safeWhy(world, r.event);
  const generated = homePlanet(world).generated;
  // Against a realm's land on the home world: over the town's own ground, else a world among the stars.
  const onRealm = !them && r.cell >= 0 && offworldSite(generated, r.cell) === null;
  const place: FightPlace = onRealm
    ? {
        kind: "home",
        cell: r.cell,
        spot: generated.centre[r.cell] ?? 0,
        words: `over ${d.realm ?? defender.name}`,
      }
    : {
        kind: "foreign",
        star: r.star,
        planet: holdWorld(world, them ?? civ, r.star) ?? 0,
        words: "over a world among the stars",
      };
  const landing =
    onRealm && r.won && r.dead > 0
      ? landingOf(world, r, civ, attacker, defender, d.realm ?? "")
      : null;
  return {
    id: r.event,
    road: "raid",
    year: r.year,
    sailed: causeEv ? yearOfMoment(causeEv.t) : r.year,
    attacker,
    defender,
    won: r.won,
    place,
    event: r.event,
    war: null,
    claim,
    why: cause ? safeWhy(world, cause) : claim,
    landing,
    nowYear,
  };
}

/** One fight's plan: a war's `swar:0:n` or a raid's event ref, as the record has it; else null. */
export function starFightPlan(world: World, id: string): StarFightPlan | null {
  const nowYear = yearOfMoment(world.now);
  const war = starWarsOf(world)
    .all()
    .find((w) => (w.ref === id || w.battle === id) && w.won !== null);
  if (war) return warPlan(world, war, nowYear);
  const raid = (peoplesOf(world)?.raids ?? []).find((r) => r.event === id);
  return raid ? raidPlan(world, raid, nowYear) : null;
}

/** A raid that won on a realm's land and killed: its town is drawn, so it is always kept. */
function isLander(row: Light, civs: readonly Civilization[]): boolean {
  const r = row.raid;
  return r !== null && r.won && r.dead > 0 && r.cell >= 0 && civs.every((c) => c.ref !== r.other);
}

/** The fights the world has had: the newest first, at most FIGHTS_SHOWN, and the counts. */
export function starFights(world: World): StarFightList {
  const wars = starWarsOf(world).all();
  const peoples = peoplesOf(world);
  const raids = peoples?.raids ?? [];
  const light: Light[] = [
    ...wars
      .filter((w) => w.won !== null)
      .map((w) => ({ id: w.ref, year: w.arrives, war: w, raid: null })),
    ...raids.map((r) => ({ id: r.event, year: r.year, war: null, raid: r })),
  ];
  if (light.length === 0) {
    return { fights: [], total: 0, open: 0, best: null, first: null, firstYear: null };
  }
  const open =
    wars.filter((w) => w.won === null).length +
    (peoples?.ships ?? []).filter((s) => s.kind === "fleet" && !s.arrived).length;
  let first = light[0]!;
  for (const row of light) {
    if (
      row.year < first.year ||
      (row.year === first.year && row.raid !== null && first.raid === null)
    )
      first = row;
  }
  const civs = civilizationsNear(world);
  const landers = light
    .filter((row) => isLander(row, civs))
    .sort(newest)
    .slice(0, FIGHTS_SHOWN);
  const others = light
    .filter((row) => !isLander(row, civs))
    .sort(newest)
    .slice(0, FIGHTS_SHOWN - landers.length);
  const kept = [...landers, ...others].sort(newest);
  const fights: StarFightEntry[] = [];
  for (const row of kept) {
    const plan = starFightPlan(world, row.id);
    if (!plan) continue;
    fights.push({
      id: row.id,
      road: plan.road,
      year: plan.year,
      attacker: plan.attacker.name,
      defender: plan.defender.name,
      attackerColor: plan.attacker.color,
      defenderColor: plan.defender.color,
      won: plan.won,
      strength: plan.attacker.strength,
      defence: plan.defender.strength,
      dead: row.raid?.dead ?? 0,
      town: plan.landing?.townName ?? null,
      ships: plan.attacker.sky !== "none" && plan.defender.sky !== "none",
      claim: plan.claim,
      page: row.id,
    });
  }
  return {
    fights,
    total: light.length,
    open,
    best: bestFight(fights),
    first: first.id,
    firstYear: first.year,
  };
}

/** The page of one ship in a fight: its fleet's people, its arm, its drive, and how it fared. */
export function shipPage(world: World, ref: string): PageModel {
  const parts = parseShipRef(ref);
  if (!parts) throw new Error(`no ship ${ref}`);
  const id = parts.fight.replace(/\./g, ":");
  const plan = starFightPlan(world, id);
  if (!plan) throw new Error(`no ship ${ref}`);
  const side = parts.side === 0 ? plan.attacker : plan.defender;
  return {
    ref,
    kind: "starwar",
    icon: "🚀",
    title: `The ${parts.name}`,
    subtitle: [
      `A ${["great ship", "ship of the line", "escort"][parts.cls]} of `,
      link(side.name, side.ref),
    ],
    color: side.color,
    place: null,
    stats: [
      stat("Of", [link(side.name, side.ref)]),
      stat("Arm", side.arm === "beam" ? "beams" : "missiles"),
      stat("Drive", side.drive === "none" ? "none between the stars" : side.drive),
      stat("In this fight", parts.broke ? "broke up" : "came through"),
      stat("Year", `${plan.year}`),
    ],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "text",
            lines: [
              [
                "History keeps a fleet as a whole, not ship by ship. This ship is drawn from the fight's own numbers, and is always the same.",
              ],
            ],
          },
          {
            type: "facts",
            rows: [
              stat("The fight", [link(plan.claim, plan.event)]),
              ...(plan.war ? [stat("The war", [link("A war among the stars", plan.war)])] : []),
            ],
          },
          { type: "tool", tool: "watch.starfight", args: { id, label: "▶ Watch it" } },
          { type: "why", ref: plan.event },
        ],
      },
    ],
    followable: false,
    year: plan.nowYear,
  };
}

export const STARFIGHT_QUERIES: Readonly<Record<string, QueryHandler>> = {
  "star.fights": (world) => starFights(world),
  "star.fight": (world, args) => starFightPlan(world, (args as { id: string }).id),
};
