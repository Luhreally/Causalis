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
  politiesOf,
  populationContext,
  quarterOf,
  townSeed,
  type Fabric,
} from "../sim/index.ts";
import { AGE_ROWS } from "../rules/index.ts";
import { HEART_BLOCKS, QUARTER, type RankHall, type TownRank } from "../bridge/index.ts";
import { realmColor } from "./colors.ts";
import { houseRef } from "./family.ts";

/** A realm so old (years) and holding so many lands keeps a palace; so many, a palace with wings. */
const PALACE = { years: 60, lands: 3 },
  WINGS = { years: 180, lands: 8 };
/** The most great houses' halls shown in a town; the tallest home a hall takes the lot of (a house or a townhouse). */
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
    seat =
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
  // The great houses seated in its land: their halls in its heart (its greatest town near its middle).
  const halls: RankHall[] = [],
    kept = realm ? housesOf(world)?.of(realm.ref) : undefined,
    here = (kept?.houses ?? []).filter((h) => h.seat === s.cell && !h.crown);
  if (here.length && realm) {
    const towns = ctx.settlements.seenIn(s.cell).filter((t) => t.population > 0),
      heart = [...towns].sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))[0];
    if (heart?.ref === ref) {
      let all = 0;
      for (const h of kept!.houses) all += h.wealth;
      const seed = townSeed(ref),
        n = Math.min(lots, f.next),
        levels = levelsOf(f, 0, n),
        taken = new Set<number>();
      const great = [...here]
        .sort((a, b) => b.wealth - a.wealth || a.id - b.id)
        .slice(0, MOST_HALLS);
      for (const h of great) {
        // (A home's lot of the high ground by the square, else of its heart: the first no other hall has taken a block of.)
        let at = -1;
        const k = hashString(`hall ${h.name}`) % 8;
        for (let b = 0; b < Math.ceil(n / 8) && b < HEART_BLOCKS * 6 && at < 0; b++) {
          if (taken.has(b) || (b >= HEART_BLOCKS && quarterOf(seed, b) !== QUARTER.high)) continue;
          for (let j = 0; j < 8 && at < 0; j++) {
            const p = b * 8 + ((k + j) % 8),
              l = p < n ? levels[p]! : -1;
            if (l >= 0 && l <= HALL_LEVEL) at = p;
          }
          if (at >= 0) taken.add(b);
        }
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
  return {
    gini,
    drives: drivesIn(world, s.cell),
    ...(seat ? { seat } : {}),
    ...(halls.length ? { halls } : {}),
  };
}
