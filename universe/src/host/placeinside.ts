// Inside a building of a town kept in detail (town mode, O3: all interiors). Every lot is laid on a grid of tiles a metre
// square over its own ground (the lot as its town's plan measures it, a building over as many lots as it takes), and
// what is inside is set on those tiles from what the place holds, never made up: a home's rooms are its households', a
// bed for each its room gives them (E's NeedsDay), the hearth, the table and the pantry with what it holds; a building's
// hall has a bench for each who works there, as many as its floor takes, and its goods heaped by what it holds; the
// town's works made here hang on its walls. Those here now stand where they are at: abed in their bed, at work at a
// bench, else about the room. Nothing lies over another thing, nothing past its room's walls, none two on one tile. The
// place is only read: nothing of this is kept, and the tick never asks for it.
import { DAY, type World } from "../kernel/index.ts";
import { FOODS, GOODS, OCC } from "../rules/index.ts";
import {
  PLACE_AT,
  placeInsideRef,
  placeLotRef,
  type PlaceInspectInside,
  type PlaceInsideThing,
} from "../bridge/index.ts";
import {
  ACT,
  actWords,
  placeIndexOf,
  placeLot,
  placeNeedsDay,
  placeWorks,
  WORK_QUALITY,
  BENCHLESS_WORTH,
  benchesFit,
  benchless,
  lotGrid,
  lotsOf,
  type Place,
} from "./place.ts";
import { lotWords, placeWho, tradeWords } from "./placeplan.ts";

/** The most households of a lot whose rooms are laid side by side (a block of flats: the rest are on the floors above). */
const ROOMS_ACROSS = 3;
/** A room's floor a head (m²) under which it is cramped, and from which it is roomy (est: a bed, a seat and room to pass). */
const CRAMPED = 6,
  ROOMY = 12;
/** The most of its goods a building's floor shows heaped (the most held first). */
const HEAPS = 6;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const amount = (n: number): string =>
  n >= 100 ? String(Math.round(n)) : n >= 10 ? n.toFixed(1) : n.toFixed(2);

export { lotGrid };

/** A floor's tile: free, an aisle beside a thing (stood in, not built on), or a thing's. */
const AISLE = 1,
  TAKEN = 2;
type Room = { name: string; x: number; y: number; w: number; d: number; words?: string };
/** A floor's tiles, each taken or not, and things set on them where they fit. */
class Floor {
  readonly taken: Uint8Array;
  readonly things: PlaceInsideThing[] = [];
  readonly w: number;
  readonly d: number;
  constructor(w: number, d: number) {
    this.w = w;
    this.d = d;
    this.taken = new Uint8Array(w * d);
  }
  free(x: number, y: number, w: number, d: number, room: Room): boolean {
    if (x < room.x || y < room.y || x + w > room.x + room.w || y + d > room.y + room.d)
      return false;
    for (let j = y; j < y + d; j++)
      for (let i = x; i < x + w; i++) if (this.taken[j * this.w + i]) return false;
    return true;
  }
  /** A thing set on the first tiles of a room it fits on (from its back wall or its front), or null where none are free. */
  set(room: Room, t: Omit<PlaceInsideThing, "x" | "y">, fromBack = false): PlaceInsideThing | null {
    for (let a = 0; a < room.d; a++) {
      const y = fromBack ? room.y + room.d - t.d - a : room.y + a;
      for (let x = room.x; x + t.w <= room.x + room.w; x++)
        if (this.free(x, y, t.w, t.d, room)) {
          // (Its tiles taken, and an aisle a tile wide about it kept clear of any other thing: walked in, not built on.)
          for (let j = Math.max(0, y - 1); j < Math.min(this.d, y + t.d + 1); j++)
            for (let i = Math.max(0, x - 1); i < Math.min(this.w, x + t.w + 1); i++)
              if (!this.taken[j * this.w + i]) this.taken[j * this.w + i] = AISLE;
          for (let j = y; j < y + t.d; j++)
            for (let i = x; i < x + t.w; i++) this.taken[j * this.w + i] = TAKEN;
          const thing = { ...t, x, y };
          this.things.push(thing);
          return thing;
        }
    }
    return null;
  }
  /** A tile of a room no thing stands on and no one stands on yet (null: none). */
  open(room: Room, stood: Set<number>, from: number): { x: number; y: number } | null {
    const n = room.w * room.d;
    for (let a = 0; a < n; a++) {
      const k = (from + a) % n,
        x = room.x + (k % room.w),
        y = room.y + Math.floor(k / room.w),
        at = y * this.w + x;
      if (this.taken[at] !== TAKEN && !stood.has(at)) return { x, y };
    }
    return null;
  }
}

/** What is inside a lot of a place now (O3), on its grid of tiles: its rooms, what stands in them, and who is there. */
export function placeInside(world: World, place: Place, lot: number): PlaceInspectInside | null {
  if (lot < 0 && lot !== PLACE_AT.square) return null;
  if (lot === PLACE_AT.square || lot === PLACE_AT.fields || lot === PLACE_AT.walls) return null;
  const r = placeLot(place, lot),
    p = place.people,
    who = placeWho(world, place),
    homes = r.households.length > 0,
    lots = homes ? 1 : lotsOf(place, lot),
    { w, d } = lotGrid(lots),
    floor = new Floor(w, d),
    rooms: Room[] = [],
    bedOf = new Map<number, PlaceInsideThing>(),
    // (Each household's room, by its place among the rooms.)
    roomOfHouse = new Map<number, number>(),
    benches: PlaceInsideThing[] = [],
    said: string[] = [];
  if (homes) {
    // A home: each household's own room, side by side, its hearth and table at the front, its beds at the back.
    const nd = placeNeedsDay(world, place),
      shown = r.households.slice(0, ROOMS_ACROSS),
      across = Math.floor(w / shown.length);
    shown.forEach((hh, k) => {
      const members: number[] = [];
      for (let i = 0; i < p.n; i++) if (p.house[i] === hh.house) members.push(i);
      const room: Room = {
        name: `The ${cap(
          who(members[0] ?? 0)
            .name.split(" ")
            .slice(-1)[0] ?? "",
        )} household`,
        x: k * across,
        y: 0,
        w: k === shown.length - 1 ? w - k * across : across,
        d,
      };
      roomOfHouse.set(hh.house, rooms.length);
      rooms.push(room);
      floor.set(room, {
        kind: "hearth",
        glyph: "🔥",
        name: "The hearth",
        w: 2,
        d: 1,
        words: "Where they warm themselves and cook",
      });
      floor.set(room, {
        kind: "table",
        glyph: "🍽",
        name: "A table",
        w: 2,
        d: 1,
        words: `Where its ${members.length} eat`,
      });
      let held = 0;
      for (let f = 0; f < FOODS.length; f++)
        held += place.houses.pantry[hh.house * FOODS.length + f]! / 1e6;
      floor.set(room, {
        kind: "pantry",
        glyph: "🧺",
        name: "The pantry",
        w: 1,
        d: 1,
        words: `${amount(held)} person-months of food`,
      });
      // (Its beds, as its room gives them: those who have none sleep on the floor.)
      const room0 = nd.room[hh.house] ?? 1,
        beds = Math.min(members.length, Math.max(0, Math.round(room0 * members.length)));
      let made = 0;
      for (const i of members.slice(0, beds)) {
        const bed = floor.set(
          room,
          { kind: "bed", glyph: "🛏", name: `${who(i).name}'s bed`, w: 1, d: 2, words: "" },
          true,
        );
        if (!bed) break;
        bedOf.set(i, bed);
        made++;
      }
      const floorSleep = members.length - made,
        area = room.w * room.d,
        head = area / Math.max(1, members.length);
      // (Its room read, O4: its floor a head, its beds, its hearth; under CRAMPED a head it is cramped, from ROOMY roomy.)
      room.words = `${members.length} in ${area} m² (${Math.round(head)} a head), ${made === members.length ? "a bed each" : `${made} ${made === 1 ? "bed" : "beds"} for ${members.length}`}, a hearth: ${head < CRAMPED ? "cramped" : head >= ROOMY ? "roomy" : "snug"}`;
      if (floorSleep > 0)
        said.push(
          `${floorSleep} of the ${members.length} of ${room.name.replace(/^The /, "the ")} ${floorSleep === 1 ? "sleeps" : "sleep"} on the floor: ${made === beds ? "their home has no more beds for them" : "no more beds fit their room"}.`,
        );
    });
    if (r.households.length > shown.length)
      said.push(
        `${r.households.length - shown.length} more ${r.households.length - shown.length === 1 ? "household lives" : "households live"} on the floors above.`,
      );
  } else {
    // A building: its hall, a bench for each who works here as its floor takes, its goods heaped by what it holds.
    const room: Room = { name: cap(lotWords(place, lot).replace(/^the /, "")), x: 0, y: 0, w, d };
    rooms.push(room);
    const workers = r.working.map((id) => placeIndexOf(place, id)).filter((i) => i >= 0);
    let benched = 0;
    for (const i of workers) {
      const occ = p.sexOcc[i]! & 15,
        bench = floor.set(room, {
          kind: "bench",
          glyph: "🛠",
          name: `A ${tradeWords(occ, false).replace(/^an? /, "")}'s bench`,
          w: 2,
          d: 1,
          words: `${who(i).name}'s`,
        });
      if (!bench) break;
      benches.push(bench);
      bedOf.set(i, bench);
      benched++;
    }
    if (workers.length > benched) {
      const none = benchless(place),
        makers = workers.filter((i) => none[i] && (p.sexOcc[i]! & 15) === OCC.crafter).length;
      said.push(
        `${workers.length - benched} more work here than its floor has benches for: at the yard and the door${makers ? `, ${makers} of them makers making at ${Math.round(BENCHLESS_WORTH * 100)}% of the pace` : ""}.`,
      );
    }
    room.words = `${benched} ${benched === 1 ? "bench" : "benches"} (its floor takes ${benchesFit(lots)}) for the ${workers.length} who work here; ${w * d} m²${workers.length > benched ? ": crowded" : ""}`;
    const heaps = r.stock
      .map((n, g) => ({ n, g }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, HEAPS);
    for (const { n, g } of heaps)
      floor.set(
        room,
        {
          kind: "goods",
          glyph: "📦",
          name: cap(GOODS[g]!.name),
          w: n >= 100 ? 2 : 1,
          d: n >= 100 ? 2 : 1,
          words: `${amount(n)} held here`,
        },
        true,
      );
  }
  // The town's works made here, on its walls (the first room's back corner).
  for (const x of placeWorks(world, place, lot).slice(0, 4))
    floor.set(
      rooms[0]!,
      {
        kind: "work",
        glyph: "🖼",
        name: `${cap(WORK_QUALITY[x.quality] ?? "plain")} ${x.form}`,
        w: 1,
        d: 1,
        words: `Made on day ${(x.day % 365) + 1} of the year ${Math.floor(x.day / 365)}`,
      },
      true,
    );
  // Those here now: abed in their bed, at work at their bench, else about the room, none two on one tile.
  const stood = new Set<number>(),
    people: PlaceInspectInside["people"][number][] = [];
  for (const id of r.here) {
    const i = placeIndexOf(place, id);
    if (i < 0) continue;
    const mine = bedOf.get(i),
      room =
        rooms.find((m) => mine && mine.x >= m.x && mine.x < m.x + m.w) ??
        rooms[roomOfHouse.get(p.house[i]!) ?? 0]!,
      onIt =
        mine &&
        ((mine.kind === "bed" && p.act[i] === ACT.sleep) ||
          (mine.kind === "bench" && p.act[i] === ACT.work))
          ? { x: mine.x, y: mine.y }
          : null,
      at =
        onIt && !stood.has(onIt.y * w + onIt.x)
          ? onIt
          : floor.open(room, stood, (id * 7) % (room.w * room.d));
    if (!at) continue;
    stood.add(at.y * w + at.x);
    people.push({
      id,
      ref: who(i).ref,
      name: who(i).name,
      x: at.x,
      y: at.y,
      words: actWords(p, i),
    });
  }
  if (r.here.length > people.length)
    said.push(`${r.here.length - people.length} more here now than its floor has room to stand.`);
  const name = cap(lotWords(place, lot));
  return {
    kind: "inside",
    lot,
    ref: placeInsideRef(place.town, lot),
    lotRef: placeLotRef(place.town, lot),
    name,
    icon: homes ? "🏠" : "🏢",
    w,
    d,
    rooms: rooms.map((m) => ({ ...m, words: m.words ?? "" })),
    things: floor.things,
    people,
    words: [
      `${w} by ${d} metres, a tile a metre, on day ${(Math.floor(place.t / DAY) % 365) + 1}.`,
      ...said,
    ].join(" "),
  };
}
