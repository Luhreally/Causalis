// Who a town's buildings belong to, read from what history keeps (bridge/rank.ts; asked 2026-11-17): how unevenly its land's
// wealth is held; its realm's seat, its hall the ruler's, greater as the realm is older and holds more lands; the great houses
// seated in its land where it is that land's heart, each on a home's lot of the high ground by the square, the greatest
// nearest. Nothing kept: which lot a house's hall stands on is read off its town's fabric as it stands.
import { YEAR, hashString, type Ref, type World } from "../kernel/index.ts";
import {
  giniOf,
  housesOf,
  levelsOf,
  loreOf,
  orgsOf,
  politiesOf,
  populationContext,
  quarterOf,
  townSeed,
  underworldOf,
  type Fabric,
} from "../sim/index.ts";
import { AGE_ROWS } from "../rules/index.ts";
import {
  HEART_BLOCKS,
  QUARTER,
  type RankHall,
  type RankMark,
  type RankSeat,
  type TownRank,
} from "../bridge/index.ts";
import { realmColor } from "./colors.ts";
import { houseRef } from "./family.ts";
import { groupRef, underName } from "./underworld.ts";
import { orgName, orgRef } from "./groups.ts";
import { townHolds } from "./strongholds.ts";

/** A boss's roof, a meeting house's, the temple's head's. */
const BOSS_COLOR = [0.5, 0.08, 0.12] as const,
  ORG_COLOR = [0.1, 0.55, 0.55] as const,
  TEMPLE_COLOR = [0.96, 0.9, 0.6] as const;

/** A realm so old (years) and holding so many lands keeps a palace; so many, a palace with wings. */
const PALACE = { years: 60, lands: 3 },
  WINGS = { years: 180, lands: 8 };
/** The most great houses' halls shown in a town; the tallest home a hall takes the lot of (a house or a townhouse). */
const CIVIC_HALL = "hall";
const MOST_HALLS = 4,
  HALL_LEVEL = 2;

/** A house's own colour: its realm's hue turned by its name. */
export function houseColor(realm: string, name: string): [number, number, number] {
  const [r, g, b] = realmColor(`${realm}|${name}`);
  return [0.25 + 0.75 * r, 0.25 + 0.75 * g, 0.25 + 0.75 * b];
}

/** Whether a land's people drive (its land knows the modern age's ways). */
function drivesIn(world: World, cell: number): boolean {
  const lore = loreOf(world),
    knows = (id: string) => !!lore.get(cell, id);
  return knows("electricity") || knows("sea-electricity") || AGE_ROWS.modern.some(knows);
}

/** Who a town's buildings belong to (null: no such town). */
export function townRank(world: World, ref: Ref, f: Fabric, lots = f.next): TownRank | null {
  const ctx = populationContext(world),
    s = ctx.settlements.get(ref);
  if (!s) return null;
  const year = Math.floor(world.now / YEAR),
    realm = politiesOf(world).of(s.cell),
    gini = giniOf(world, s.cell) ?? 0,
    seated: RankSeat | undefined =
      realm && realm.ended === null && realm.seat === s.cell && realm.town === s.name
        ? {
            realm: realm.ref,
            name: s.name,
            ruler: `rule:${realm.ref}`,
            color: realmColor(realm.ref),
            grade: (year - realm.founded >= WINGS.years && realm.members.length >= WINGS.lands
              ? 2
              : year - realm.founded >= PALACE.years && realm.members.length >= PALACE.lands
                ? 1
                : 0) as 0 | 1 | 2,
          }
        : undefined;
  // Lots for the halls: a home's lot of the high ground by the square, else of its heart, a block to each.
  const seed = townSeed(ref),
    n = Math.min(lots, f.next),
    taken = new Set<number>();
  let levels: Int8Array | null = null;
  const lotFor = (name: string, quarter: number = QUARTER.high, heart = true): number => {
    levels ??= levelsOf(f, 0, n);
    const k = hashString(`hall ${name}`) % 8;
    for (let b = heart ? 0 : HEART_BLOCKS; b < Math.ceil(n / 8) && b < HEART_BLOCKS * 8; b++) {
      if (taken.has(b) || (b >= HEART_BLOCKS && quarterOf(seed, b) !== quarter)) continue;
      for (let j = 0; j < 8; j++) {
        const p = b * 8 + ((k + j) % 8),
          l = p < n ? levels[p]! : -1;
        if (l >= 0 && l <= HALL_LEVEL) {
          taken.add(b);
          return p;
        }
      }
    }
    return -1;
  };
  // (A seat with no hall of law standing yet: the ruler keeps a house of their own, the first to choose its ground.)
  let seat = seated;
  if (seated && !f.civics.some((c) => c.kind === CIVIC_HALL && c.fell === null && c.at < n)) {
    const at = lotFor(`seat ${seated.realm}`);
    if (at >= 0) seat = { ...seated, lot: at };
  }
  // The great houses seated in its land: their halls in its greatest town.
  const halls: RankHall[] = [],
    kept = realm ? housesOf(world)?.of(realm.ref) : undefined,
    here = (kept?.houses ?? []).filter((h) => h.seat === s.cell && !h.crown);
  if (here.length && realm) {
    const heart = ctx.settlements
      .seenIn(s.cell)
      .filter((t) => t.population > 0)
      .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))[0];
    if (heart?.ref === ref) {
      let all = 0;
      for (const h of kept!.houses) all += h.wealth;
      for (const h of [...here]
        .sort((a, b) => b.wealth - a.wealth || a.id - b.id)
        .slice(0, MOST_HALLS)) {
        const at = lotFor(h.name);
        if (at < 0) continue;
        halls.push({
          lot: at,
          name: h.name,
          ref: houseRef(realm.ref, h.event),
          color: houseColor(realm.ref, h.name),
          share: all > 0 ? h.wealth / all : 0,
        });
      }
    }
  }
  // The other leaders, each on the best lot of their own quarter (the nearest its square): the bosses of the crime groups
  // whose home this land is, in its lee; the meeting houses of its groups, toward its way in; the temple's head by the temple.
  const marks: RankMark[] = [],
    greatest = () =>
      ctx.settlements
        .seenIn(s.cell)
        .filter((t) => t.population > 0)
        .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))[0]?.ref === ref;
  if (realm) {
    const mobs = (underworldOf(world)?.of(realm.ref)?.groups ?? []).filter(
        (g) => g.home === s.cell,
      ),
      orgs = (orgsOf(world)?.of(realm.ref)?.orgs ?? []).filter((g) => g.home === s.cell);
    if ((mobs.length || orgs.length) && greatest()) {
      for (const g of [...mobs].sort((a, b) => b.power - a.power || a.id - b.id).slice(0, 2)) {
        const at = lotFor(`boss ${g.name}`, QUARTER.lee, false),
          name = underName(world, groupRef(realm.ref, g.event)) ?? g.name;
        if (at >= 0)
          marks.push({
            lot: at,
            ref: `boss:${realm.ref}:${g.event}`,
            name: `${g.boss.name}, boss of ${name}`,
            title:
              "Their house stands in the town's lee, off its square, under a roof of their colour.",
            color: BOSS_COLOR,
          });
      }
      for (const g of [...orgs].sort((a, b) => b.power - a.power || a.id - b.id).slice(0, 2)) {
        const at = lotFor(`org ${g.name}`, QUARTER.road, false),
          name = orgName(world, orgRef(realm.ref, g.event)) ?? g.name;
        if (at >= 0)
          marks.push({
            lot: at,
            ref: orgRef(realm.ref, g.event),
            name: `the meeting house of ${name}`,
            title: "It stands toward the town's way in, where its people come and go.",
            color: ORG_COLOR,
          });
      }
    }
  }
  const temple = f.civics.find((c) => c.kind === "temple" && c.fell === null && c.at < n);
  if (temple) {
    levels ??= levelsOf(f, 0, n);
    for (let p = temple.at + temple.lots; p < Math.min(n, temple.at + temple.lots + 24); p++) {
      const l = levels[p]!;
      if (l < 0 || l > HALL_LEVEL || halls.some((h) => h.lot === p) || seat?.lot === p) continue;
      if (marks.some((m) => m.lot === p)) continue;
      marks.push({
        lot: p,
        ref: `bldg:${ref}:${temple.at}:${temple.start}`,
        name: "the temple's head",
        title: "They live by the temple they keep.",
        color: TEMPLE_COLOR,
      });
      break;
    }
  }
  const lore = loreOf(world),
    stuff = lore.get(s.cell, "electricity")
      ? "concrete"
      : lore.get(s.cell, "steam-engine")
        ? "brick"
        : lore.get(s.cell, "masonry")
          ? "stone"
          : undefined;
  // Its strongholds and seats: its realm's where it is seated here, its land's great houses' where it is the land's greatest.
  const holds = townHolds(world, ref, realm, s.cell, !!seated, greatest());
  return {
    gini,
    drives: drivesIn(world, s.cell),
    ...(holds.length ? { holds } : {}),
    ...(seat ? { seat } : {}),
    ...(halls.length ? { halls } : {}),
    ...(marks.length ? { marks } : {}),
    ...(stuff ? { stuff } : {}),
  };
}
