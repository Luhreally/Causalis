// A meeting of fleets laid out for the eye (2026-11-19): pure arithmetic, no drawing. History says each side's tonnes, what
// it lost, its flagship and whether she went down, what its shipwrights knew and who held the sea after (bridge/seafight.ts).
// Here that is two lines of hulls: as many as its tonnes make of the ships its wrights could build (at most `most` a side,
// each then standing for several), sized by their kind, passing each other on opposite courses. Of each line as many go
// down as history's share of its tonnes sunk, the flagship among them only where history lost her. The beaten side bears
// away after; the other holds the sea. The same meeting always lays out the same: no clock but `s`, no draw but a hash.
import type { SeaFightNear, SeaRig } from "../bridge/index.ts";

/** How long a meeting is watched (s), and its moments: the lines come up, pass, part. */
export const SEA_LENGTH = 80;
export const SEA_MOMENTS = { meet: 16, part: 60 } as const;

/** A kind of ship as drawn: tonnes a hull, its length (units), masts, funnels, oars, turrets. */
export const SEA_SHIPS: Readonly<
  Record<
    SeaRig,
    {
      readonly tons: number;
      readonly long: number;
      readonly masts: number;
      readonly funnels: number;
      readonly oars: boolean;
      readonly turrets: number;
    }
  >
> = {
  oared: { tons: 80, long: 1.5, masts: 1, funnels: 0, oars: true, turrets: 0 },
  planked: { tons: 300, long: 1.8, masts: 2, funnels: 0, oars: false, turrets: 0 },
  tall: { tons: 1500, long: 2.3, masts: 3, funnels: 0, oars: false, turrets: 0 },
  steam: { tons: 4000, long: 2.7, masts: 2, funnels: 1, oars: false, turrets: 0 },
  works: { tons: 12000, long: 3.2, masts: 0, funnels: 2, oars: false, turrets: 2 },
};

export type SeaHull = {
  readonly side: 0 | 1;
  /** Where she sails in her line: along it (units from its middle), and which of its columns. */
  readonly along: number;
  readonly column: number;
  readonly flag: boolean;
  /** Her length; the flagship is the greatest of her line. */
  readonly long: number;
  /** When she begins to go down (null: she comes through). */
  readonly sinks: number | null;
  /** When her guns first speak, and how often (s). */
  readonly fires: number;
  readonly every: number;
};

export type SeaField = {
  readonly near: SeaFightNear;
  readonly hulls: readonly SeaHull[];
  /** Each side's hulls drawn, how many ships a hull stands for, and how many of its hulls go down. */
  readonly drawn: readonly [number, number];
  readonly per: readonly [number, number];
  readonly down: readonly [number, number];
  /** How far apart the lines pass (units), and how long the longer line is. */
  readonly gap: number;
  readonly reach: number;
};

export type SeaHullNow = {
  x: number;
  z: number;
  /** Her heading (rad), how far she has settled (0 … 1: gone), and her bow lifted as she goes (rad). */
  yaw: number;
  sunk: number;
  tip: number;
  /** Her guns' smoke now: how old the last broadside is (s; negative: none yet). */
  fired: number;
};

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}
const unit = (a: number, b: number): number => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};
const ease = (k: number) => {
  const x = Math.max(0, Math.min(1, k));
  return x * x * (3 - 2 * x);
};

/** How many hulls a side is drawn as: its ships, at most `most`, never none while it had tonnes. */
function hullsOf(tons: number, rig: SeaRig, most: number): { drawn: number; per: number } {
  const ships = Math.max(tons > 0 ? 1 : 0, Math.round(tons / SEA_SHIPS[rig].tons)),
    drawn = Math.min(most, ships);
  return { drawn, per: drawn ? Math.max(1, Math.round(ships / drawn)) : 1 };
}

/** A meeting laid out: at most `most` hulls a side. */
export function newSeaFight(near: SeaFightNear, most = 20): SeaField {
  const key = hash(near.event),
    hulls: SeaHull[] = [],
    drawn: [number, number] = [0, 0],
    per: [number, number] = [1, 1],
    down: [number, number] = [0, 0];
  let reach = 0;
  // (With guns on either side they pass apart; with none, hull to hull.)
  const guns = near.sides[0].guns || near.sides[1].guns,
    longest = Math.max(SEA_SHIPS[near.sides[0].rig].long, SEA_SHIPS[near.sides[1].rig].long),
    gap = guns ? longest * 3.2 : longest * 1.1;
  for (const side of [0, 1] as const) {
    const s = near.sides[side],
      kind = SEA_SHIPS[s.rig],
      h = hullsOf(s.tons, s.rig, most),
      n = h.drawn,
      // (More than a dozen: two columns abreast.)
      columns = n > 12 ? 2 : 1,
      inColumn = Math.ceil(n / columns),
      space = kind.long * 1.75,
      // (Of its hulls as many go down as its tonnes' share sunk; the flagship among them only where history lost her.)
      share = s.tons > 0 ? s.sunk / s.tons : 0,
      goes = Math.min(n, Math.max(s.flagLost ? 1 : 0, Math.round(n * share))),
      flagAt = s.flagship && n ? Math.floor((inColumn - 1) / 2) : -1,
      order = [...Array(n).keys()]
        .filter((i) => i !== flagAt)
        .sort((a, b) => unit(key + side, a) - unit(key + side, b)),
      sinking = new Map<number, number>(),
      others = s.flagLost && flagAt >= 0 ? goes - 1 : Math.min(goes, order.length);
    for (let k = 0; k < others; k++)
      sinking.set(
        order[k]!,
        SEA_MOMENTS.meet +
          3 +
          ((k + 0.5) / Math.max(1, others)) * (SEA_MOMENTS.part - SEA_MOMENTS.meet - 10),
      );
    // (A flagship lost goes late: the meeting turns on her.)
    if (s.flagLost && flagAt >= 0) sinking.set(flagAt, SEA_MOMENTS.part - 12);
    drawn[side] = n;
    per[side] = h.per;
    down[side] = sinking.size;
    reach = Math.max(reach, inColumn * space);
    for (let i = 0; i < n; i++) {
      const c = i % columns,
        row = Math.floor(i / columns),
        flag = i === flagAt;
      hulls.push({
        side,
        along: ((inColumn - 1) / 2 - row) * space,
        column: c,
        flag,
        long: kind.long * (flag ? 1.3 : 0.86 + 0.2 * unit(key + 31 + side, i)),
        sinks: sinking.get(i) ?? null,
        fires: SEA_MOMENTS.meet + 6 * unit(key + 57 + side, i),
        every: 3.2 + 2.2 * unit(key + 91 + side, i),
      });
    }
  }
  return { near, hulls, drawn, per, down, gap, reach };
}

/** How long a hull takes to go down (s). */
export const SEA_SINKS = 9;

/** Where a line's middle is along its course at a moment (units; side 0 sails toward +x). */
function lineAt(field: SeaField, side: 0 | 1, s: number): number {
  const far = field.reach * 0.5 + 9,
    pass = -far + 2 * far * ease(s / SEA_MOMENTS.part) * 0.82;
  if (s <= SEA_MOMENTS.part) return pass;
  // After: the beaten bear away under all they have; the others shorten sail and hold the sea.
  const at = -far + 2 * far * 0.82,
    beaten = field.near.won !== side,
    t = s - SEA_MOMENTS.part;
  return at + (beaten ? 0.9 * t : 0.25 * t * Math.max(0, 1 - t / 20));
}

/** A hull at a moment of the meeting. */
export function seaHullAt(field: SeaField, h: SeaHull, s: number, out: SeaHullNow): SeaHullNow {
  const dir = h.side ? -1 : 1,
    // (She loses her way as she goes down.)
    going = h.sinks !== null ? Math.max(0, s - h.sinks) : 0,
    sunk = Math.min(1, going / SEA_SINKS),
    at = h.sinks !== null && s > h.sinks ? h.sinks + SEA_SINKS * 0.5 * (1 - (1 - sunk) ** 2) : s,
    beaten = field.near.won !== h.side,
    after = Math.max(0, s - SEA_MOMENTS.part),
    // (The beaten, bearing away, stand off from the sea they lost.)
    off = beaten ? Math.min(1, after / 14) : 0,
    abeam = field.gap / 2 + h.column * h.long * 1.2 + off * 6;
  out.x = dir * (lineAt(field, h.side, at) + h.along);
  out.z = (h.side ? 1 : -1) * abeam;
  out.yaw = (h.side ? Math.PI : 0) + (h.side ? 1 : -1) * off * 0.5 + sunk * 0.25;
  out.sunk = sunk;
  out.tip = sunk * 0.5;
  const fighting =
    field.near.sides[h.side].guns &&
    going === 0 &&
    s >= h.fires &&
    s <= SEA_MOMENTS.part + 2 &&
    Math.abs(out.x) < field.reach * 0.5 + 6;
  out.fired = fighting ? (s - h.fires) % h.every : -1;
  return out;
}

/** The meeting's tally at a moment: each side's hulls gone down, and that as history's tonnes. */
export function seaTally(
  field: SeaField,
  s: number,
): { gone: [number, number]; tons: [number, number] } {
  const gone: [number, number] = [0, 0];
  for (const h of field.hulls) if (h.sinks !== null && s >= h.sinks) gone[h.side]++;
  const tons = [0, 1].map((i) =>
    field.down[i]! > 0 ? Math.round((field.near.sides[i]!.sunk * gone[i]!) / field.down[i]!) : 0,
  ) as [number, number];
  return { gone, tons };
}

/** What is happening now, in a line. */
export function seaWords(field: SeaField, s: number): string {
  const n = field.near,
    w = n.sides[n.won],
    l = n.sides[1 - n.won]!,
    guns = n.sides[0].guns || n.sides[1].guns;
  if (s < SEA_MOMENTS.meet) return "The two lines come up on each other";
  if (s < SEA_MOMENTS.part)
    return guns ? "They pass, and fire as they pass" : "They close, hull to hull";
  return l.flagLost && l.flagship
    ? `The ${l.flagship} is gone; the fleet of ${l.name} bears away, and ${w.name} holds the sea`
    : `The fleet of ${l.name} bears away, and ${w.name} holds the sea`;
}
