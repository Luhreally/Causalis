// What a town kept in detail shows laid over its lots (town mode, N5: a colony sim's overlays): for one reading at a time,
// each lot's value 0 … 1 and what it is in words, read off the place as it stands in one pass over its people. Only asked
// while an overlay is shown (`place.overlay`); the place is only read.
import { DAY, type World } from "../kernel/index.ts";
import type { PlaceOverlay, PlaceOverlayKind, PlaceOverlayLot } from "../bridge/index.ts";
import type { QueryHandler } from "./host.ts";
import {
  MOOD_UNHEEDING,
  WORK_QUALITY,
  enterPlace,
  homesFor,
  ordersOf,
  placeNeedsDay,
  placeMeetFor,
  placeSites,
  placeZone,
  ZONE,
  type Place,
} from "./place.ts";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const signed = (x: number) => `${x > 0 ? "+" : ""}${Math.round(x)}`;

/** Each lot's reading of one kind, and what its ends mean. */
export function placeOverlay(world: World, place: Place, kind: PlaceOverlayKind): PlaceOverlay {
  const { people: p, houses, bldgs } = place,
    lots: PlaceOverlayLot[] = [];
  // (Who lives on each lot, and who works at each: one pass.)
  const living = new Map<number, number[]>(),
    working = new Map<number, number[]>();
  for (let i = 0; i < p.n; i++) {
    const home = houses.home[p.house[i]!]!;
    if (home >= 0) living.set(home, [...(living.get(home) ?? []), i]);
    if (p.work[i]! >= 0) working.set(p.work[i]!, [...(working.get(p.work[i]!) ?? []), i]);
  }
  const worst = (i: number) =>
    Math.max(p.needs[i * 4]!, p.needs[i * 4 + 1]!, p.needs[i * 4 + 2]!, p.needs[i * 4 + 3]!) /
    65535;
  const sites = new Set(placeSites(world, place).map((s) => s.lot));
  if (kind === "needs" || kind === "mood") {
    const by = kind === "needs" ? living : new Map([...living, ...working]);
    for (const [lot, who] of by) {
      if (!who.length) continue;
      if (kind === "needs") {
        const m = who.reduce((n, i) => n + worst(i), 0) / who.length,
          top = Math.max(...who.map(worst));
        lots.push({
          lot,
          v: m,
          words: `Most pressing need ${pct(m)} on average among ${who.length} living here; the worst ${pct(top)}`,
        });
      } else {
        const m = who.reduce((n, i) => n + p.mood[i]!, 0) / who.length,
          low = who.filter((i) => p.mood[i]! < MOOD_UNHEEDING).length;
        lots.push({
          lot,
          v: (m + 100) / 200,
          words: `Mood ${signed(m)} on average among ${who.length} ${living.has(lot) ? "living" : "working"} here${low ? `; ${low} too unhappy to follow orders` : ""}`,
        });
      }
    }
    return {
      of: kind,
      lots,
      low: kind === "needs" ? "Served" : "Low (−100)",
      high: kind === "needs" ? "Pressing" : "Glad (+100)",
      good: kind === "needs" ? "low" : "high",
      fire: null,
    };
  }
  if (kind === "room") {
    const homes = homesFor(world, place.town, p.n + 64);
    homes.lot.forEach((lot, k) => {
      const n = living.get(lot)?.length ?? 0,
        holds = homes.holds[k]!;
      if (holds <= 0) return;
      lots.push({
        lot,
        v: Math.min(1, n / holds / 1.5),
        words: `${n} living here, room for ${holds}${n > holds ? `: ${n - holds} more than it holds` : ""}`,
      });
    });
    return { of: kind, lots, low: "Empty", high: "Half again full", good: "low", fire: null };
  }
  // Comfort and beauty (Q1, E's NeedsDay): each home's beds for those under it, and the finest work in sight of its door.
  if (kind === "comfort") {
    const nd = placeNeedsDay(world, place),
      of = new Map<number, { room: number; fine: number; n: number }>();
    for (let h = 0; h < houses.n; h++) {
      const lot = houses.home[h]!;
      if (lot < 0 || !houses.members[h] || h >= nd.room.length) continue;
      const x = of.get(lot) ?? { room: Infinity, fine: -1, n: 0 };
      x.room = Math.min(x.room, nd.room[h]!);
      x.fine = Math.max(x.fine, nd.fine[h]!);
      x.n += houses.members[h]!;
      of.set(lot, x);
    }
    for (const [lot, x] of of) {
      const crowd = Math.max(0, Math.min(1, 1 - x.room)),
        plain = x.fine < 0 ? 1 : Math.max(0, 1 - (x.fine + 1) / WORK_QUALITY.length);
      lots.push({
        lot,
        v: (crowd + plain) / 2,
        words: `${x.room >= 1 ? "A bed each" : `${Math.round(x.room * 100)}% of a bed each`} for the ${x.n} under its roof; ${x.fine < 0 ? "no work of the town's in sight of its door" : `a ${WORK_QUALITY[x.fine]} work in sight of its door`}`,
      });
    }
    return {
      of: kind,
      lots,
      low: "Roomy and fair",
      high: "Crowded and plain",
      good: "low",
      fire: null,
    };
  }
  // Its zones (O2): each meeting place and the homes it gathers, and each lot kept clear.
  if (kind === "zones") {
    const zones = ordersOf(world, place.town)?.zones ?? [],
      gathered = new Map<number, number>();
    if (zones.length)
      for (const home of new Set(houses.home))
        if (home >= 0) {
          const at = placeMeetFor(world, place, home);
          if (at >= 0) gathered.set(at, (gathered.get(at) ?? 0) + 1);
        }
    for (let k = 0; k < zones.length; k += 2) {
      const lot = zones[k]!,
        z = placeZone(world, place, lot);
      if (zones[k + 1] === ZONE.meet) {
        const n = gathered.get(lot) ?? 0;
        lots.push({
          lot,
          v: 0,
          words: `A meeting place: those of ${n} ${n === 1 ? "home" : "homes"} come here for company and games`,
        });
      } else
        lots.push({
          lot,
          v: 1,
          words: z.holds
            ? "Kept clear: none go here but to a fire"
            : "Zoned clear, but a store cannot be kept clear",
        });
    }
    return { of: kind, lots, low: "Meeting place", high: "Kept clear", good: "low", fire: null };
  }
  if (kind === "work") {
    const shut = ordersOf(world, place.town)?.shut ?? [];
    let most = 1;
    for (let b = 1; b < bldgs.lot.length; b++)
      most = Math.max(most, working.get(bldgs.lot[b]!)?.length ?? 0);
    for (let b = 1; b < bldgs.lot.length; b++) {
      const lot = bldgs.lot[b]!,
        n = working.get(lot)?.length ?? 0;
      lots.push({
        lot,
        v: n / most,
        words: shut.includes(lot)
          ? `Its work stopped by your order (${n} keep it as their work)`
          : sites.has(lot)
            ? `Going up: ${n} at it`
            : `${n} work here`,
      });
    }
    return {
      of: kind,
      lots,
      low: "None at work",
      high: "The most at work",
      good: "high",
      fire: null,
    };
  }
  if (kind === "age") {
    const today = place.t / DAY;
    let oldest = 1;
    for (let b = 1; b < bldgs.lot.length; b++)
      oldest = Math.max(oldest, (today - bldgs.start[b]!) / 365);
    for (let b = 1; b < bldgs.lot.length; b++) {
      const years = Math.max(0, (today - bldgs.start[b]!) / 365);
      lots.push({
        lot: bldgs.lot[b]!,
        v: sites.has(bldgs.lot[b]!) ? 0 : years / oldest,
        words: sites.has(bldgs.lot[b]!)
          ? "Going up now"
          : `${Math.floor(years)} ${Math.floor(years) === 1 ? "year" : "years"} standing`,
      });
    }
    return { of: kind, lots, low: "New", high: "The oldest", good: "none", fire: null };
  }
  // Danger: a fire burning, and how far a cry from it carries (who hears it and turns out); the lots near it are the page's
  // to reckon, from where it draws them.
  const fire =
    place.fire.length >= 3 && place.t < place.fire[1]!
      ? { lot: place.fire[0]!, reach: place.fire[2]! }
      : null;
  return {
    of: kind,
    lots: fire ? [{ lot: fire.lot, v: 1, words: "Burning now" }] : [],
    low: "Out of a cry's reach",
    high: "Burning",
    good: "low",
    fire,
  };
}

/** `place.overlay`: { ref: the town, of: which reading }. */
export function placeOverlayQueries(): Readonly<Record<string, QueryHandler>> {
  const KINDS: readonly PlaceOverlayKind[] = [
    "needs",
    "mood",
    "room",
    "comfort",
    "work",
    "age",
    "danger",
    "zones",
  ];
  return {
    "place.overlay": (world, args) => {
      const a = args as { ref?: unknown; of?: unknown };
      if (typeof a?.ref !== "string" || !KINDS.includes(a.of as PlaceOverlayKind)) return null;
      const place = enterPlace(world, a.ref);
      return place ? placeOverlay(world, place, a.of as PlaceOverlayKind) : null;
    },
  };
}
