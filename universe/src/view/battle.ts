// A battle fought before the eye (Phase 37 M184, asked for 2026-10-24: "i still cant see warfare
// and like wars like theres no coherent animations and battle between them or a way to make time
// in a way for me to see the carnage"): the battle history fought, played out on a clock of its
// own. The two hosts drawn up in their ranks under their banners — a figure for every man, or
// for so many — with what they fought with; the attackers coming on, arrows falling on them where
// either side has bows; the charge; the lines meeting, each front rank at the one before it, those
// behind stepping up as the front falls; the line giving way where it is beaten; the beaten
// breaking and running, the victors after them; the field after, the fallen where they fell, the
// victors cheering under their banners. At a seat, before its walls: held, a siege laid about it,
// or its gate broken and the town taken, burning. As many fall of each side as history says fell
// (so many figures for so many men). Pure: the same moment of a battle always looks the same.
// Metres on the field, x from the attackers' side (−) to the defenders' (+), z across.
import type { BattleNear } from "../bridge/index.ts";
import { cellMiddle, type MeadowState } from "./meadow.ts";

/** How long a battle plays at its own pace, in its seconds: two and a half minutes. */
export const BATTLE_LENGTH = 150;
/** The battle's speeds: paused, half, its own, twice and four times. */
export const BATTLE_SPEEDS = [0, 0.5, 1, 2, 4] as const;
/** The field's half-width (x) and half-depth (z), metres: the meadow it is fought on. */
export const FIELD = { x: 70, z: 45 } as const;

/** When each part of a battle begins (its seconds). */
export const MOMENTS = {
  advance: 10,
  arrows: 16,
  charge: 40,
  melee: 48,
  gate: 100,
  rout: 108,
  after: 130,
} as const;

/**
 * A wing's wheel about the other host's flank (where one host's front reaches far past the
 * other's): from when to when, and how far it turns (radians, short of a right angle).
 */
const WHEEL = { from: MOMENTS.melee + 3, to: MOMENTS.melee + 20, turn: 1.4 } as const;

/**
 * The wounded who crawl (of those struck down by blows and arrows, not cut down running): what
 * share of them, how long after they fall they begin, how fast they go (m a second), and for how
 * long at least and at most — back toward their own lines, before they lie still.
 */
const CRAWL = { share: 0.28, after: 1.2, pace: 0.32, least: 5, most: 13 } as const;

/** How a host strikes hand to hand: a thrust (spears, tusks), a blow (swords, axes, clubs, claws), a bite, a grapple. */
export type Stroke = "thrust" | "strike" | "bite" | "grapple";

/** What one who fought is at. */
export type Act =
  "stand" | "march" | "run" | "brace" | "fight" | "loose" | "fall" | "flee" | "cheer";

/** How a host is carried and what it fights with, as the field shows it. */
export type HostDrawn = {
  /** How many figures it is drawn as, in how many files and ranks. */
  readonly n: number;
  readonly files: number;
  readonly ranks: number;
  /** On horses (riders) or in chariots: drawn mounted, wider apart, faster. */
  readonly mounted: "horse" | "chariot" | null;
  /** Whether it looses arrows (or darts) before the lines meet. */
  readonly missiles: boolean;
  readonly stroke: Stroke;
  /** How many of its figures fall (as many as fell of its men, so many figures for so many). */
  readonly falls: number;
};

/** One who fought: their place in their host, their fate in the battle. */
export type Trooper = {
  readonly id: number;
  /** 0 the attackers, 1 the defenders. */
  readonly side: 0 | 1;
  readonly file: number;
  readonly rank: number;
  /** Where across the field their file stands (metres). */
  readonly z: number;
  /** A banner's bearer. */
  readonly bearer: boolean;
  /** When they fall (battle seconds; null: they live through it), and how. */
  falls: number | null;
  by: "arrow" | "blow" | "rout" | null;
  /** When they turn and run (the beaten; null: they hold). */
  flees: number | null;
  /** Of the victors' front, who go after the beaten. */
  pursues: boolean;
  /** Through the broken gate, at a seat stormed. */
  gate: boolean;
  /** Their own draw (0 … 1): their step, their pace. */
  readonly u: number;
  /** Where they lie, once worked out (they lie where they fell). */
  lies?: { x: number; z: number; yaw: number; run: boolean; fled: number };
};

/** A cannon brought to the field: where it stands (m), which way it points, when it fires. */
export type Cannon = {
  readonly side: 0 | 1;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly fires: readonly number[];
};

/** An arrow loosed: from where, at what, when, how long it flies; whom it strikes (-1: the ground). */
export type Arrow = {
  readonly side: 0 | 1;
  readonly from: { readonly x: number; readonly z: number };
  readonly to: { readonly x: number; readonly z: number };
  readonly at: number;
  readonly flight: number;
  readonly hits: number;
  /** A gun's ball (none seen in flight: its muzzle's flash and smoke), not an arrow. */
  readonly shot?: boolean;
};

export type BattleGround = {
  /** A ridge the defenders hold: its middle (x), its reach along and across, its height (m). */
  readonly hill: {
    readonly x: number;
    readonly rx: number;
    readonly rz: number;
    readonly h: number;
  } | null;
  /** A river between them: its middle (x) and half its width. */
  readonly river: { readonly x: number; readonly w: number } | null;
  /** A seat's walls: their line (x), how high, the gate's half-width; the town behind them. */
  readonly wall: {
    readonly x: number;
    readonly high: number;
    readonly gate: number;
    readonly stone: boolean;
  } | null;
};

export type BattleField = {
  readonly near: BattleNear;
  /** How many men a figure stands for. */
  readonly per: number;
  readonly hosts: readonly [HostDrawn, HostDrawn];
  readonly troopers: readonly Trooper[];
  /** Each side's files, each front first (who steps up as the front falls). */
  readonly files: readonly (readonly (readonly Trooper[])[])[];
  readonly arrows: readonly Arrow[];
  /**
   * At a seat's walls, the attackers' ladders: where along the walls (z, m), when each is raised
   * against them, and when thrown down (null: where the walls did not hold, they stay).
   */
  readonly ladders: readonly {
    readonly z: number;
    readonly up: number;
    readonly down: number | null;
    /** The one who climbs it (-1: none). */
    readonly climber: number;
  }[];
  /** The cannon each side brought, where its realm knew black powder (Phase 37 M188). */
  readonly cannon: readonly Cannon[];
  /** The side beaten: 1 where the attackers won, else 0. */
  readonly beaten: 0 | 1;
  readonly ground: BattleGround;
  /** Where the lines meet when they first meet (x), and how far the victors drive them (m). */
  readonly meet: number;
  readonly drive: number;
  /** What is told as the battle goes: from when, in words. */
  readonly moments: readonly { readonly at: number; readonly words: string }[];
  /**
   * The host whose front reaches far past the other's, in the open, and where the other's flanks
   * are (|z|, m): its files beyond them wheel about them once the lines have met (none: neither).
   */
  readonly wings: { readonly side: 0 | 1; readonly z: number } | null;
};

/** One who fought, now. */
export type TrooperNow = {
  readonly id: number;
  readonly side: 0 | 1;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Which way they face (radians: 0 toward +z, π/2 toward +x). */
  readonly yaw: number;
  readonly act: Act;
  /** Their stride's or their stroke's turn (seconds of its own). */
  readonly cycle: number;
  /** How far toppled (0 standing … 1 lying), and whether onto their back. */
  readonly down: number;
  readonly back: boolean;
  /** How much of them is drawn (they fade at the field's edge, run off it). */
  readonly size: number;
  readonly bearer: boolean;
  /** Wounded, dragging themselves back toward their own lines (1), or not (0). */
  readonly crawl: number;
};

export type BattleNow = {
  readonly s: number;
  readonly troopers: readonly TrooperNow[];
  /** Arrows in flight: where, which way along (yaw) and up (pitch). */
  readonly flying: readonly { x: number; y: number; z: number; yaw: number; pitch: number }[];
  /** Arrows spent in the ground. */
  readonly spent: readonly { x: number; z: number; yaw: number }[];
  /** The blood of the fallen: where, how wide (m). */
  readonly blood: readonly { x: number; z: number; r: number }[];
  /** The blood thrown up as a blow or an arrow strikes home (m). */
  readonly spray: readonly { x: number; y: number; z: number; r: number }[];
  /** Powder smoke where guns have fired, drifting off; a muzzle's flash as one fires (m). */
  readonly smoke: readonly { x: number; y: number; z: number; r: number }[];
  readonly flashes: readonly { x: number; y: number; z: number; yaw: number }[];
  /** The cannon where they stand, each thrown back as it fires (recoil 1, easing to 0). */
  readonly cannon: readonly { x: number; z: number; yaw: number; recoil: number }[];
  /** Dust thrown up where they run and fight. */
  readonly dust: readonly { x: number; y: number; z: number; r: number }[];
  /** Each side's figures standing and fallen (of those drawn). */
  readonly standing: readonly [number, number];
  readonly fallen: readonly [number, number];
  /**
   * The ladders at a seat's walls: the foot of each (x, z, m), how far it is raised (radians up off
   * the ground toward the walls: past a right angle, thrown down away from them), how long (m).
   */
  readonly ladders: readonly { x: number; z: number; rise: number; long: number }[];
  /** How far the gate stands open (0 … 1), the fires in the town (0 … 1), the siege's tents pitched (0 … 1). */
  readonly gate: number;
  readonly burning: number;
  readonly camp: number;
  /** What is told now. */
  readonly words: string;
};

/** The most figures a side is drawn as (a phone draws fewer). */
export function mostFor(detail: number): number {
  return detail >= 2 ? 360 : 120;
}

/** A keyed draw (0 … 1). */
function unit(a: number, b: number): number {
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

function hashText(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

/** How a host's arm strikes hand to hand. */
export function strokeOf(arm: string | undefined): Stroke {
  switch (arm) {
    case "spear":
    case "tusks":
    case "shell-darts":
    // (A bayonet on the muzzle.)
    case "musket":
    case "rifle":
      return "thrust";
    case "mandibles":
      return "bite";
    case "grapple":
      return "grapple";
    default:
      return "strike";
  }
}

/** Whether a host's arm looses at a distance. */
export function loosesFrom(arm: string | undefined): boolean {
  return arm === "bow" || arm === "horn-bow" || arm === "shell-darts" || firesFrom(arm);
}

/** Whether a host's arm fires powder and shot (Phase 37 M188): a musket, a rifle. */
export function firesFrom(arm: string | undefined): boolean {
  return arm === "musket" || arm === "rifle";
}

/** The share of a host's dead that fall to what the other side looses: more to shot than to arrows. */
function loosedShare(arm: string | undefined): number {
  return arm === "rifle" ? 0.6 : arm === "musket" ? 0.45 : 0.25;
}

/** Metres between files and between ranks: riders and chariots stand wider. */
function spacing(mounted: HostDrawn["mounted"]): { file: number; rank: number } {
  return mounted === "chariot"
    ? { file: 3.6, rank: 4.6 }
    : mounted === "horse"
      ? { file: 2.6, rank: 3.6 }
      : { file: 1.55, rank: 1.9 };
}

/** The ground's height under a point (a ridge the defenders hold). */
export function battleGroundAt(g: BattleGround, x: number, z: number): number {
  const h = g.hill;
  if (!h) return 0;
  const a = (x - h.x) / h.rx,
    b = z / h.rz;
  return h.h * Math.max(0, 1 - a * a) * Math.max(0, 1 - b * b);
}

/**
 * A battle made ready to watch: its hosts drawn up, as many figures each as the men it had (or
 * one for so many: `most` the most of a side), and each one's fate in it — who falls, when and
 * how, who runs, who gives chase — as history's numbers have it.
 */
export function newBattle(near: BattleNear, most: number): BattleField {
  const key = hashText(near.event),
    a = near.attacker,
    d = near.defender,
    per = Math.max(1, Math.ceil(Math.max(a.fielded, d.fielded, 1) / most)),
    beaten: 0 | 1 = near.won ? 1 : 0,
    walls = near.walls > 0,
    ground: BattleGround = {
      hill: near.hills && !walls ? { x: 18, rx: 17, rz: 52, h: 3.6 } : null,
      river: near.river && !walls ? { x: 3, w: 3.2 } : null,
      wall: walls
        ? { x: 14, high: near.walls === 2 ? 3.4 : 2.6, gate: 3.6, stone: near.walls === 2 }
        : null,
    };
  // Each host as the field draws it.
  const drawnOf = (s: typeof a, side: 0 | 1): HostDrawn => {
    const n = Math.max(1, Math.round(s.fielded / per)),
      // (Behind its walls a seat's defenders stand them on foot, their horses within.)
      mount = side === 1 && walls ? undefined : s.host?.mount,
      mounted: HostDrawn["mounted"] =
        mount === "chariot" ? "chariot" : mount === "horse" || mount === "cavalry" ? "horse" : null,
      files = Math.max(1, Math.min(n, Math.round(Math.sqrt(n * (mounted ? 2.2 : 3.6))))),
      ranks = Math.ceil(n / files),
      // (As many fall as fell of its men: the victors keep some standing, the beaten a few.)
      most = side === beaten ? Math.ceil(n * 0.92) : n - 1,
      falls = Math.max(s.fallen > 0 && n > 1 ? 1 : 0, Math.min(most, Math.round(s.fallen / per)));
    return {
      n,
      files,
      ranks,
      mounted,
      missiles: loosesFrom(s.host?.arm),
      stroke: strokeOf(s.host?.arm),
      falls,
    };
  };
  const hosts = [drawnOf(a, 0), drawnOf(d, 1)] as const;
  // Where the lines meet: at the defenders' front (before their walls, on their ridge's brow,
  // past the river), and how far the victors drive the beaten before they break.
  const meet = ground.wall ? ground.wall.x - 1.3 : ground.river ? 8.4 : ground.hill ? 8 : 6,
    drive = ground.wall ? 0 : near.won ? 5 : -5;
  // Each one in their rank and file.
  const troopers: Trooper[] = [];
  for (const side of [0, 1] as const) {
    const h = hosts[side],
      gap = spacing(h.mounted).file;
    for (let i = 0; i < h.n; i++) {
      const file = i % h.files,
        rank = Math.floor(i / h.files),
        // (The last rank, short, stands to the middle.)
        inRank = rank === h.ranks - 1 ? h.n - rank * h.files : h.files,
        across = (file - (inRank - 1) / 2) * gap,
        u = unit(key + side * 7919, i);
      troopers.push({
        id: troopers.length,
        side,
        file,
        rank,
        z: Math.max(-FIELD.z + 3, Math.min(FIELD.z - 3, across + (u - 0.5) * gap * 0.3)),
        bearer: rank === 1 % h.ranks && (file === Math.floor(inRank / 2) || file % 14 === 7),
        falls: null,
        by: null,
        flees: null,
        pursues: false,
        gate: false,
        u,
      });
    }
  }
  // A front reaching far past the other's, in the open (no walls, no river between), closes its
  // wings about the other's flanks.
  const reach = [0, 1].map((side) =>
      troopers.reduce((m, t) => (t.side === side ? Math.max(m, Math.abs(t.z)) : m), 0),
    ),
    wider: 0 | 1 = reach[0]! >= reach[1]! ? 0 : 1,
    narrow = reach[wider === 0 ? 1 : 0]!,
    wings =
      !ground.wall && !ground.river && reach[wider]! > narrow + 6
        ? { side: wider, z: narrow + 1.5 }
        : null;
  // At a seat's walls, the attackers' ladders along their front, either side of the gate: raised
  // against the walls as they rush them, thrown down where the walls held.
  const ladders: { z: number; up: number; down: number | null; climber: number }[] = [];
  if (ground.wall) {
    const gate = ground.wall.gate,
      far = Math.max(gate + 4, Math.min(reach[0]!, FIELD.z - 5)),
      n = Math.max(2, Math.min(7, Math.round(hosts[0].files / 5))),
      each = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const out = i % 2 ? 1 : -1,
        k = Math.floor(i / 2);
      ladders.push({
        z: out * (gate + 3 + ((far - gate - 3) * (k + 0.5)) / each + (unit(key, 300 + i) - 0.5)),
        up: MOMENTS.melee + 0.5 + 2.5 * unit(key, 310 + i),
        down: near.outcome === "held" ? MOMENTS.rout - 4 + 3 * unit(key, 320 + i) : null,
        climber: -1,
      });
    }
    // (Who climbs each: the one at the front of the file nearest it.)
    const taken = new Set<number>();
    for (const l of ladders) {
      let best: Trooper | null = null;
      for (const t of troopers)
        if (
          t.side === 0 &&
          t.rank === 0 &&
          !taken.has(t.id) &&
          (!best || Math.abs(t.z - l.z) < Math.abs(best.z - l.z))
        )
          best = t;
      if (best) {
        taken.add(best.id);
        l.climber = best.id;
      }
    }
  }
  const field: BattleField = {
    near,
    per,
    hosts,
    troopers,
    files: [0, 1].map((side) =>
      Array.from({ length: hosts[side]!.files }, (_, f) =>
        troopers.filter((t) => t.side === side && t.file === f).sort((p, q) => p.rank - q.rank),
      ),
    ),
    arrows: [],
    cannon: cannonOf(near, key),
    ladders,
    beaten,
    ground,
    meet,
    drive,
    moments: momentsOf(near, wings),
    wings,
  };
  fates(field, key);
  return field;
}

/**
 * The cannon a side brings where its realm knows black powder: the attackers' behind their line
 * on its flanks, firing as they come on and until the lines meet (at a seat, until its gate is
 * broken); the defenders' at their line (on their walls, at a seat), firing the while.
 */
function cannonOf(near: BattleNear, key: number): Cannon[] {
  const out: Cannon[] = [];
  for (const side of [0, 1] as const) {
    const s = side === 0 ? near.attacker : near.defender;
    if (!s.cannon) continue;
    const n = Math.max(2, Math.min(6, Math.round(Math.sqrt(s.fielded) / 6))),
      walls = near.walls > 0,
      until = side === 0 && walls && near.outcome === "stormed" ? MOMENTS.gate : MOMENTS.melee - 2;
    for (let i = 0; i < n; i++) {
      const across = (i - (n - 1) / 2) * 9 + (unit(key + side, i + 71) - 0.5) * 2,
        x = side === 0 ? -40 - 3 * unit(key, i + 81) : walls ? 17 : 26 + 2 * unit(key, i + 91),
        fires: number[] = [];
      for (let at = MOMENTS.advance + 4 + 3 * unit(key + side * 13, i); at < until;)
        fires.push((at += 3.5 + 2.5 * unit(key + i, Math.round(at * 10))));
      out.push({
        side,
        x,
        z: across,
        yaw: side === 0 ? Math.PI / 2 : -Math.PI / 2,
        fires: fires.filter((f) => f < until),
      });
    }
  }
  return out;
}

/** What is told as the battle goes. */
function momentsOf(near: BattleNear, wings: BattleField["wings"]): { at: number; words: string }[] {
  const a = near.attacker.name,
    d = near.defender.name,
    cap = (s: string) => s[0]!.toUpperCase() + s.slice(1),
    town = near.town ?? "the town",
    arrows = loosesFrom(near.attacker.host?.arm) || loosesFrom(near.defender.host?.arm),
    guns = firesFrom(near.attacker.host?.arm) || firesFrom(near.defender.host?.arm);
  const out: { at: number; words: string }[] = [
    {
      at: 0,
      words: near.walls
        ? `${cap(a)} draw up before the walls of ${town}`
        : `The hosts draw up: ${a} against ${d}`,
    },
    { at: MOMENTS.advance, words: `${cap(a)} come on` },
  ];
  if (arrows)
    out.push({
      at: MOMENTS.arrows,
      words: guns ? "Volleys of shot ring out as they come" : "Arrows fall on them as they come",
    });
  out.push(
    { at: MOMENTS.charge, words: near.walls ? `${cap(a)} rush the walls` : `${cap(a)} charge` },
    { at: MOMENTS.melee, words: near.walls ? "They fight at the walls" : "The lines meet" },
  );
  if (wings) {
    const [wide, hemmed] = wings.side === 0 ? [a, d] : [d, a];
    out.push(
      { at: WHEEL.from + 2, words: `The wings of ${wide} close about ${hemmed}` },
      { at: WHEEL.to + 6, words: `${cap(hemmed)} are hemmed in, fighting on three sides` },
    );
  }
  if (near.outcome === "stormed") out.push({ at: MOMENTS.gate, words: "The gate is broken" });
  out.push({
    at: MOMENTS.rout,
    words:
      near.outcome === "held"
        ? near.walls
          ? `${cap(a)} fall back from the walls`
          : `${cap(a)} break and run`
        : near.outcome === "siege"
          ? `${cap(d)} fall back behind their walls`
          : near.outcome === "stormed"
            ? `${cap(a)} pour into ${town}`
            : `${cap(d)} break and run`,
  });
  out.push({
    at: MOMENTS.after,
    words:
      near.outcome === "held"
        ? `The field is ${d}'s`
        : near.outcome === "siege"
          ? `${cap(a)} make camp about ${town}: the siege is laid`
          : near.outcome === "stormed"
            ? `${cap(town)} is taken: it burns`
            : near.outcome === "taken"
              ? `The field is ${a}'s, and ${near.land} with it`
              : `The field is ${a}'s`,
  });
  return out;
}

/**
 * Each one's fate, in time's order: the arrows' dead from the volleys (where either side looses),
 * the dead of the blows along the line (always the front of a file, those behind stepping up), the
 * beaten turning to run — the rear first — and the dead of the rout among them; the victors' front
 * after them.
 */
function fates(field: BattleField, key: number): void {
  const { hosts, troopers, beaten, ground } = field,
    victor: 0 | 1 = beaten === 0 ? 1 : 0,
    bySide = [0, 1].map((side) => troopers.filter((t) => t.side === side)),
    // Each file's living, front first.
    alive = [0, 1].map((side) =>
      Array.from({ length: hosts[side]!.files }, (_, f) =>
        bySide[side]!.filter((t) => t.file === f).sort((p, q) => p.rank - q.rank),
      ),
    ),
    rnd = (() => {
      let n = 0;
      return () => unit(key, ++n);
    })(),
    kill = (t: Trooper, at: number, by: Trooper["by"]) => {
      t.falls = at;
      t.by = by;
      const file = alive[t.side]![t.file]!;
      file.splice(file.indexOf(t), 1);
    };
  // The beaten run: the rear ranks first.
  for (const t of bySide[beaten]!) {
    const h = hosts[beaten]!;
    t.flees = MOMENTS.rout + 3 * (1 - t.rank / Math.max(1, h.ranks - 1 || 1)) * 0.6 + 3 * t.u;
  }
  // How each side's dead fall: to the arrows where the other side looses, to the blows along the
  // line, and (the beaten) in the rout.
  const shares = (side: 0 | 1) => {
    const n = hosts[side]!.falls,
      other = side === 0 ? field.near.defender : field.near.attacker,
      arrows = hosts[side === 0 ? 1 : 0]!.missiles
        ? loosedShare(other.host?.arm)
        : ground.wall && side === 0
          ? 0.1
          : 0,
      rout = side === beaten ? (ground.wall && beaten === 1 ? 0.15 : 0.32) : 0,
      byArrow = Math.round(n * arrows),
      byRout = Math.round(n * rout);
    return { arrow: byArrow, rout: byRout, blow: n - byArrow - byRout };
  };
  type Death = { at: number; side: 0 | 1; by: "arrow" | "blow" | "rout" };
  const deaths: Death[] = [];
  const arrows: Arrow[] = [];
  for (const side of [0, 1] as const) {
    const s = shares(side),
      shooters = (side === 0 ? 1 : 0) as 0 | 1;
    // The arrows' dead, a share of each volley's.
    if (hosts[shooters]!.missiles || s.arrow) {
      const volleys = 9;
      for (let v = 0; v < volleys; v++) {
        const lands = MOMENTS.arrows + 2 + v * 3.2;
        for (let k = 0; k < Math.floor(s.arrow / volleys) + (v < s.arrow % volleys ? 1 : 0); k++)
          deaths.push({ at: lands + 0.15 * k, side, by: "arrow" });
      }
    }
    // The blows' dead along the line, more as the fight goes on.
    for (let k = 0; k < s.blow; k++) {
      const f = (k + 0.5) / Math.max(1, s.blow);
      deaths.push({
        at: MOMENTS.melee + 1.5 + (MOMENTS.rout - MOMENTS.melee - 3) * Math.pow(f, 0.85),
        side,
        by: "blow",
      });
    }
    // The rout's dead, as the victors catch them.
    for (let k = 0; k < s.rout; k++)
      deaths.push({
        at: MOMENTS.rout + 4 + 15 * ((k + rnd()) / Math.max(1, s.rout)),
        side,
        by: "rout",
      });
  }
  deaths.sort((p, q) => p.at - q.at || p.side - q.side);
  // Whose files are at the line: those across from the other host's.
  const reach = [0, 1].map((side) => {
    const ts = bySide[side]!;
    return ts.length ? Math.max(...ts.map((t) => Math.abs(t.z))) : 0;
  });
  const front = (side: 0 | 1) => {
    const files = alive[side]!,
      other = reach[side === 0 ? 1 : 0]! + 1.5,
      inReach = files.filter((f) => f.length && Math.abs(f[0]!.z) <= other);
    return inReach.length ? inReach : files.filter((f) => f.length);
  };
  // The host whose flanks the other's wings close about, and its outermost files still standing
  // (on one side or the other): where the wings bite.
  const hemmed = field.wings ? (field.wings.side === 0 ? 1 : 0) : -1,
    flank = (side: 0 | 1) => {
      const sign = rnd() < 0.5 ? -1 : 1,
        files = alive[side]!.filter((f) => f.length && Math.sign(f[0]!.z) === sign);
      if (!files.length) return undefined;
      const out = files.reduce((p, q) => (Math.abs(q[0]!.z) > Math.abs(p[0]!.z) ? q : p));
      return out[Math.floor(rnd() * out.length)];
    };
  for (const death of deaths) {
    let victim: Trooper | undefined;
    if (death.by === "blow") {
      // (Once the wings have closed about a host, many of its dead fall on its flanks.)
      if (death.side === hemmed && death.at >= WHEEL.to - 4 && rnd() < 0.4)
        victim = flank(death.side);
      const files = front(death.side);
      victim ??= files.length ? files[Math.floor(rnd() * files.length)]![0] : undefined;
    } else {
      const living = alive[death.side]!.flat().filter(
        (t) => death.by !== "rout" || (t.flees !== null && t.flees <= death.at - 0.6),
      );
      victim = living.length ? living[Math.floor(rnd() * living.length)] : undefined;
    }
    if (victim) kill(victim, death.at, death.by);
  }
  // The arrows themselves: each volley from the living archers at the other host — those that
  // strike, at whom they struck; the rest into the ground about them.
  for (const shooters of [0, 1] as const) {
    // (Those on a seat's walls throw down on the attackers, bows or none.)
    if (!hosts[shooters]!.missiles && !(ground.wall && shooters === 1)) continue;
    const target = (shooters === 0 ? 1 : 0) as 0 | 1,
      struck = troopers.filter((t) => t.side === target && t.by === "arrow");
    for (let v = 0; v < 9; v++) {
      const lands = MOMENTS.arrows + 2 + v * 3.2,
        archers = troopers.filter(
          (t) => t.side === shooters && (t.falls === null || t.falls > lands - 1.6),
        ),
        hitting = struck.filter((t) => t.falls! >= lands - 0.01 && t.falls! < lands + 3.19),
        loosed = Math.min(26, archers.length);
      for (let k = 0; k < loosed; k++) {
        const from = archers[Math.floor(unit(key + v, k * 3 + shooters) * archers.length)]!,
          hit = hitting[k],
          at = hit ? hit.falls! : lands + 0.15 * k,
          // (A ball is there as soon as it is fired.)
          shot = firesFrom((shooters === 0 ? field.near.attacker : field.near.defender).host?.arm),
          flight = shot ? 0.15 : 1.6,
          src = placeAt(field, from, at - flight),
          dst = hit
            ? placeAt(field, hit, at)
            : (() => {
                const anyone =
                    bySide[target]![Math.floor(unit(key + 31 * v, k) * bySide[target]!.length)]!,
                  p = placeAt(field, anyone, at);
                return {
                  x: p.x + (unit(key + v * 5, k + 99) - 0.5) * 9,
                  z: p.z + (unit(key + v * 7, k + 199) - 0.5) * 7,
                };
              })();
        arrows.push({
          side: shooters,
          from: { x: src.x, z: src.z },
          to: { x: dst.x, z: dst.z },
          at: at - flight,
          flight,
          hits: hit ? hit.id : -1,
          ...(shot ? { shot } : {}),
        });
      }
    }
  }
  (field as { arrows: readonly Arrow[] }).arrows = arrows;
  // The victors' front goes after the beaten; at a seat stormed, those before the gate go in.
  const wall = ground.wall;
  for (const t of bySide[victor]!) {
    const living = t.falls === null || t.falls > MOMENTS.rout;
    if (!living) continue;
    if (wall && field.near.outcome === "stormed" && victor === 0)
      t.gate = Math.abs(t.z) < wall.gate + 3 && t.rank < 6;
    t.pursues = !wall ? t.rank < 2 || unit(key + 17, t.id) < 0.2 : t.gate;
  }
}

/** The line's front, where the lines meet now (x). */
function meetAt(field: BattleField, s: number): number {
  return field.meet + field.drive * smooth((s - MOMENTS.melee) / (MOMENTS.rout - MOMENTS.melee));
}

/** How far a file has closed up by `s`: one rank for each who fell before them in it. */
function closedUp(field: BattleField, t: Trooper, s: number): number {
  let ahead = 0;
  for (const o of field.files[t.side]![t.file]!) {
    if (o === t) break;
    if (o.falls !== null && o.falls < s) ahead += clamp01((s - o.falls) / 1.6);
  }
  return t.rank - ahead;
}

/**
 * Where one who fought stands at `s` in their host's order (before any flight): in its line, or
 * wheeling with its wing.
 */
function inOrder(
  field: BattleField,
  t: Trooper,
  s: number,
): { x: number; z: number; run: boolean; yaw?: number } {
  return wheeled(field, t, s, lineOrder(field, t, s));
}

/**
 * Where a wing's file stands as it wheels about the other host's flank: turned about the flank's
 * corner at the line, as a door on its hinge, from facing the other's front to facing its flank,
 * running as it goes (those not of a wing, as they were).
 */
function wheeled(
  field: BattleField,
  t: Trooper,
  s: number,
  p: { x: number; z: number; run: boolean },
): { x: number; z: number; run: boolean; yaw?: number } {
  const w = field.wings;
  if (!w || t.side !== w.side || Math.abs(t.z) <= w.z || s <= WHEEL.from) return p;
  const turn = WHEEL.turn * smooth((s - WHEEL.from) / (WHEEL.to - WHEEL.from)),
    way = t.side === 0 ? 1 : -1,
    out = Math.sign(t.z),
    hinge = meetAt(field, s),
    // (Ahead of the hinge toward the other host, and out past its flank.)
    ahead = (p.x - hinge) * way,
    past = Math.abs(p.z) - w.z,
    c = Math.cos(turn),
    sn = Math.sin(turn);
  return {
    x: hinge + (ahead * c + past * sn) * way,
    z: out * (w.z + (past * c - ahead * sn)),
    run: p.run || s < WHEEL.to,
    yaw: Math.atan2(way * c, -out * sn),
  };
}

/** Where one who fought stands at `s` in their host's line (before any wheel or flight). */
function lineOrder(
  field: BattleField,
  t: Trooper,
  s: number,
): { x: number; z: number; run: boolean } {
  const h = field.hosts[t.side]!,
    gap = spacing(h.mounted),
    rank = closedUp(field, t, s),
    wall = field.ground.wall,
    meet = meetAt(field, s),
    sway = Math.sin(s * 0.7 + t.u * 6) * 0.25;
  if (t.side === 1) {
    // The defenders stand where they are found: on the walls, on the ridge, past the river.
    const front = s < MOMENTS.melee ? field.meet + 1 : meet + 1;
    if (wall) {
      const x =
        rank < 1 ? wall.x + 0.7 + 1.9 * Math.max(0, rank) : wall.x + 2.6 + (rank - 1) * gap.rank;
      return { x, z: t.z + sway * 0.4, run: false };
    }
    return { x: front + rank * gap.rank, z: t.z + (s >= MOMENTS.melee ? sway : 0), run: false };
  }
  // The attackers come on: walk, stand to loose where they bear bows, charge, and fight at the line.
  const start = -32 - (h.mounted ? 6 : 0),
    stop = field.meet - 16,
    loose = h.missiles ? field.meet - 30 : stop,
    walk =
      s < MOMENTS.advance
        ? start
        : h.missiles
          ? s < 26
            ? start + (loose - start) * smooth((s - MOMENTS.advance) / 16)
            : s < 36
              ? loose
              : loose + (stop - loose) * smooth((s - 36) / 4)
          : start +
            (stop - start) * smooth((s - MOMENTS.advance) / (MOMENTS.charge - MOMENTS.advance)),
    front =
      s < MOMENTS.charge
        ? walk
        : s < MOMENTS.melee
          ? stop +
            (field.meet - 1 - stop) *
              smooth((s - MOMENTS.charge) / (MOMENTS.melee - MOMENTS.charge))
          : meet - 1;
  return {
    x: front - rank * gap.rank,
    z: t.z + (s >= MOMENTS.melee ? sway : 0),
    run: s >= MOMENTS.charge && s < MOMENTS.melee,
  };
}

/** Where they run to: the beaten off their side of the field, or (defenders at a seat) into the town. */
function fleeTo(field: BattleField, t: Trooper): { x: number; z: number } {
  if (t.side === 1 && field.ground.wall) return { x: FIELD.x + 12, z: t.z * 0.5 };
  const way = t.side === 0 ? -1 : 1;
  return { x: way * (FIELD.x + 14), z: t.z * 1.25 + (t.u - 0.5) * 18 };
}

/** Where one who fought is at `s` (frozen where they fell, once fallen). */
export function placeAt(
  field: BattleField,
  t: Trooper,
  s: number,
): { x: number; z: number; yaw: number; run: boolean; fled: number } {
  if (t.falls !== null && s >= t.falls) return (t.lies ??= placed(field, t, t.falls));
  return placed(field, t, s);
}

function placed(
  field: BattleField,
  t: Trooper,
  when: number,
): { x: number; z: number; yaw: number; run: boolean; fled: number } {
  const facing = t.side === 0 ? Math.PI / 2 : -Math.PI / 2;
  // On a ladder, or over the walls from it.
  const climb = climbing(field, t, when);
  if (climb && (t.flees === null || when < t.flees))
    return { x: climb.x, z: climb.z, yaw: facing, run: climb.act === "run", fled: 0 };
  // Fled: from where the rout found them, toward their edge (or the town), running.
  if (t.flees !== null && when >= t.flees) {
    const p = inOrder(field, t, t.flees),
      to = fleeTo(field, t),
      dx = to.x - p.x,
      dz = to.z - p.z,
      far = Math.hypot(dx, dz) || 1,
      pace = (field.hosts[t.side]!.mounted ? 8 : 5.2) * (0.85 + 0.3 * t.u),
      gone = Math.min(far, pace * (when - t.flees));
    return {
      x: p.x + (dx / far) * gone,
      z: p.z + (dz / far) * gone,
      yaw: Math.atan2(dx, dz),
      run: gone < far,
      fled: gone,
    };
  }
  // After them: the victors' front, for a while; at a seat stormed, through the gate.
  if (t.pursues && when >= MOMENTS.rout + 1) {
    const p = inOrder(field, t, MOMENTS.rout + 1),
      wall = field.ground.wall;
    if (wall && t.gate) {
      // Into the gate, then up into the town.
      const at = when - (MOMENTS.rout + 1),
        door = {
          x: wall.x + 2,
          z: Math.max(-wall.gate + 0.8, Math.min(wall.gate - 0.8, t.z * 0.4)),
        },
        toDoor = Math.hypot(door.x - p.x, door.z - p.z) || 1,
        pace = 4.4 * (0.85 + 0.3 * t.u),
        gone = pace * at;
      if (gone < toDoor)
        return {
          x: p.x + ((door.x - p.x) / toDoor) * gone,
          z: p.z + ((door.z - p.z) / toDoor) * gone,
          yaw: Math.atan2(door.x - p.x, door.z - p.z),
          run: true,
          fled: 0,
        };
      const on = Math.min(28 + 10 * t.u, gone - toDoor);
      return {
        x: door.x + on,
        z: door.z + (t.u - 0.5) * on * 0.9,
        yaw: Math.PI / 2,
        run: on < 28,
        fled: 0,
      };
    }
    const way = field.beaten === 0 ? -1 : 1,
      chase = Math.min(7, when - (MOMENTS.rout + 1)),
      pace = (field.hosts[t.side]!.mounted ? 7.5 : 4.6) * (0.85 + 0.3 * t.u),
      stop = wall ? wall.x - 2.2 : way * FIELD.x,
      x = way > 0 ? Math.min(stop, p.x + pace * chase) : Math.max(stop, p.x - pace * chase);
    return { x, z: p.z, yaw: facing, run: chase < 7 && x !== stop, fled: 0 };
  }
  // At a siege laid, the attackers draw back from the walls to their camp.
  if (field.near.outcome === "siege" && t.side === 0 && when >= MOMENTS.after) {
    const p = inOrder(field, t, MOMENTS.after),
      back = 10 * smooth((when - MOMENTS.after) / 8);
    return { x: p.x - back, z: p.z, yaw: facing, run: false, fled: 0 };
  }
  const p = inOrder(field, t, when);
  return { x: p.x, z: p.z, yaw: p.yaw ?? facing, run: p.run, fled: 0 };
}

/**
 * Where one fallen comes to lie from where they fell (`p`), as far down as they are (0 … 1):
 * knocked back by the blow or the arrow, or pitched on along their way where they were cut down
 * running; turned as they went.
 */
function lying(
  t: Trooper,
  p: { x: number; z: number; yaw: number },
  down: number,
): { x: number; z: number; yaw: number } {
  const turn = (unit(t.id, 5) - 0.5) * (t.by === "rout" ? 0.9 : 1.8),
    back = (t.by === "rout" ? -0.6 : 0.25 + 0.75 * unit(t.id, 9)) * down;
  return {
    x: p.x - Math.sin(p.yaw) * back,
    z: p.z - Math.cos(p.yaw) * back,
    yaw: p.yaw + turn * down,
  };
}

/** Where the blood of one fallen spreads: under them, where their body lies (m). */
function bloodAt(t: Trooper, p: { x: number; z: number; yaw: number }): { x: number; z: number } {
  const l = lying(t, p, 1),
    // (On their back, their body lies behind their feet; on their face, before them.)
    along = t.by === "rout" ? 0.6 : -0.6;
  return { x: l.x + Math.sin(l.yaw) * along, z: l.z + Math.cos(l.yaw) * along };
}

/** What one who fought is at now, and how they stand. */
function trooperNow(field: BattleField, t: Trooper, s: number): TrooperNow {
  const p = placeAt(field, t, s),
    h = field.hosts[t.side]!,
    ground = field.ground,
    wall = ground.wall;
  let y = battleGroundAt(ground, p.x, p.z);
  // (On the walls, those of its front stand on its walk; in the river, wading.)
  if (wall && t.side === 1 && p.x > wall.x - 0.4 && Math.abs(p.z) > wall.gate)
    y = (wall.high - 1.1) * clamp01((wall.x + 2.4 - p.x) / 1.2);
  if (ground.river && Math.abs(p.x - ground.river.x) < ground.river.w) y = -0.55;
  const size = clamp01((FIELD.x + 10 - Math.abs(p.x)) / 10),
    cycle = s * (p.run ? 1.6 : 1) + t.u * 3;
  if (t.falls !== null && s >= t.falls) {
    const down = smooth((s - t.falls) / 0.7),
      dur = crawlsFor(field, t);
    if (dur) {
      // Wounded: face down, dragging themselves back toward their own lines a while.
      const c = crawledTo(field, t, s, dur);
      return {
        id: t.id,
        side: t.side,
        x: c.x,
        y: groundY(ground, c.x, c.z),
        z: c.z,
        yaw: c.yaw,
        act: "fall",
        cycle: s,
        down,
        back: false,
        size: 1,
        bearer: t.bearer,
        crawl: c.going ? 1 : 0,
      };
    }
    // Fallen: onto their back where struck from before them, on their face where they ran.
    const l = lying(t, p, down);
    return {
      id: t.id,
      side: t.side,
      x: l.x,
      y,
      z: l.z,
      yaw: l.yaw,
      act: "fall",
      cycle: 0,
      down,
      back: t.by !== "rout",
      size: 1,
      bearer: t.bearer,
      crawl: 0,
    };
  }
  const climb = climbing(field, t, s);
  if (climb && (t.flees === null || s < t.flees))
    return {
      id: t.id,
      side: t.side,
      x: p.x,
      y: climb.y,
      z: p.z,
      yaw: p.yaw,
      act: climb.act,
      cycle,
      down: 0,
      back: false,
      size: 1,
      bearer: t.bearer,
      crawl: 0,
    };
  let act: Act;
  if (t.flees !== null && s >= t.flees) act = "flee";
  else if (p.run) act = "run";
  else if (s >= MOMENTS.after && t.side !== field.beaten)
    act = unit(t.id, Math.floor(s / 3)) < 0.55 ? "cheer" : "stand";
  else if (s >= MOMENTS.melee) {
    // At the line: the front strikes, those behind press on.
    const rank = closedUp(field, t, s);
    act = rank < 0.6 || (h.mounted && rank < 1.6) ? "fight" : "brace";
  } else if (
    h.missiles &&
    s >= MOMENTS.arrows &&
    s < MOMENTS.charge - 1 &&
    (t.side === 1 || (s >= 26 && s < 36))
  )
    act = "loose";
  else if (t.side === 0 && s >= MOMENTS.advance && s < MOMENTS.charge) act = "march";
  else if (t.side === 1 && s >= MOMENTS.charge) act = "brace";
  else act = "stand";
  return {
    id: t.id,
    side: t.side,
    x: p.x,
    y,
    z: p.z,
    yaw: p.yaw,
    act,
    cycle,
    down: 0,
    back: false,
    size: p.fled > 0 ? size : 1,
    bearer: t.bearer,
    crawl: 0,
  };
}

/** A ladder raised against a seat's walls: where its foot stands (x, m), how it leans, how long it is. */
function ladderOn(w: NonNullable<BattleGround["wall"]>): {
  foot: number;
  lean: number;
  long: number;
} {
  const run = 1.3,
    high = w.high + 0.3;
  return {
    foot: w.x - (w.stone ? 0.7 : 0.21) - run,
    lean: Math.atan2(high, run),
    long: Math.hypot(run, high),
  };
}

/**
 * Where one who climbs a ladder is at `s` (null: not on it then): to its foot once it is raised,
 * up it, fighting at its top; down it again before it is thrown down where the walls held (or
 * before the field's end, at a siege laid), or over the walls onto their walk once the gate of a
 * seat stormed is broken.
 */
function climbing(
  field: BattleField,
  t: Trooper,
  s: number,
): { x: number; y: number; z: number; act: Act } | null {
  const l = field.ladders.find((x) => x.climber === t.id),
    w = field.ground.wall;
  if (!l || !w) return null;
  const { foot, lean, long } = ladderOn(w),
    start = l.up + 1.6,
    atFoot = start + 0.8,
    atTop = atFoot + 2.6,
    top = long - 0.55,
    stormed = field.near.outcome === "stormed",
    back = stormed ? null : (l.down ?? MOMENTS.rout + 1) - 2.6,
    on = (along: number) => ({
      x: foot + Math.cos(lean) * along,
      y: Math.sin(lean) * along,
      z: l.z,
    });
  if (s < start) return null;
  if (s < atFoot) {
    const from = lineOrder(field, t, start),
      f = smooth((s - start) / 0.8);
    return { x: from.x + (foot - from.x) * f, y: 0, z: from.z + (l.z - from.z) * f, act: "run" };
  }
  if (s < atTop) return { ...on(top * smooth((s - atFoot) / 2.6)), act: "march" };
  if (back === null) {
    if (s < MOMENTS.gate) return { ...on(top), act: "fight" };
    // Over the walls onto their walk, and there they stand.
    const at = on(top),
      f = smooth((s - MOMENTS.gate) / 1.2);
    return {
      x: at.x + (w.x - at.x) * f,
      y: at.y + (w.high - 1.1 - at.y) * f,
      z: l.z,
      act: s >= MOMENTS.after ? "cheer" : "stand",
    };
  }
  if (s < back) return { ...on(top), act: "fight" };
  if (s < back + 2) return { ...on(top * (1 - smooth((s - back) / 2))), act: "march" };
  if (s < back + 2.8) {
    const to = lineOrder(field, t, back + 2.8),
      f = smooth((s - back - 2) / 0.8);
    return { x: foot + (to.x - foot) * f, y: 0, z: l.z + (to.z - l.z) * f, act: "run" };
  }
  return null;
}

/** The ground's height where one lies (in the river, under its water). */
function groundY(ground: BattleGround, x: number, z: number): number {
  return ground.river && Math.abs(x - ground.river.x) < ground.river.w
    ? -0.55
    : battleGroundAt(ground, x, z);
}

/** How long one fallen crawls (seconds; 0: they lie where they fell). */
function crawlsFor(field: BattleField, t: Trooper): number {
  if (t.by === null || t.by === "rout") return 0;
  // (Not off a seat's walls: those struck down on them lie on its walk.)
  if (t.side === 1 && field.ground.wall) return 0;
  // (Nor riders: they lie with their horses.)
  if (field.hosts[t.side]!.mounted) return 0;
  return unit(t.id, 13) < CRAWL.share
    ? CRAWL.least + (CRAWL.most - CRAWL.least) * unit(t.id, 14)
    : 0;
}

/**
 * Where one wounded has dragged themselves to by `s`, from where they fell — back toward their own
 * lines, veering a little — whether they are still going, and how far they have come (m).
 */
function crawledTo(
  field: BattleField,
  t: Trooper,
  s: number,
  dur: number,
): { x: number; z: number; yaw: number; going: boolean; gone: number } {
  const from = placeAt(field, t, t.falls!),
    on = s - t.falls! - CRAWL.after,
    gone = CRAWL.pace * Math.max(0, Math.min(dur, on)),
    dx = t.side === 0 ? -1 : 1,
    dz = (unit(t.id, 15) - 0.5) * 0.5,
    n = Math.hypot(dx, dz);
  return {
    x: from.x + (dx / n) * gone,
    z: from.z + (dz / n) * gone,
    yaw: Math.atan2(dx, dz),
    going: on > 0 && on < dur,
    gone,
  };
}

/** The battle at `s` of its seconds (0 … BATTLE_LENGTH). */
export function battleAt(field: BattleField, s: number): BattleNow {
  const t = Math.max(0, Math.min(BATTLE_LENGTH, s)),
    troopers = field.troopers.map((x) => trooperNow(field, x, t)),
    standing: [number, number] = [0, 0],
    fallen: [number, number] = [0, 0];
  for (const x of field.troopers) {
    if (x.falls !== null && t >= x.falls) fallen[x.side]++;
    else standing[x.side]++;
  }
  // Arrows in flight, and those spent in the ground.
  const flying: BattleNow["flying"][number][] = [],
    spent: BattleNow["spent"][number][] = [];
  const smoke: BattleNow["smoke"][number][] = [],
    flashes: BattleNow["flashes"][number][] = [];
  for (const a of field.arrows) {
    const f = (t - a.at) / a.flight;
    if (f < 0) continue;
    if (a.shot) {
      // A gun fired: its flash at the muzzle, its smoke rolling out before it and drifting off
      // on the wind, rising and spreading, for a few seconds.
      const age = t - a.at,
        dx = a.to.x - a.from.x,
        dz = a.to.z - a.from.z,
        far = Math.hypot(dx, dz) || 1,
        ux = dx / far,
        uz = dz / far;
      if (age < 0.09)
        flashes.push({
          x: a.from.x + ux * 1.1,
          y: 1.35,
          z: a.from.z + uz * 1.1,
          yaw: Math.atan2(dx, dz),
        });
      if (age < 3.2)
        for (let k = 0; k < 2; k++) {
          const out = 1.2 + 1.6 * smooth(age / 1.2) + k * 0.7;
          smoke.push({
            x: a.from.x + ux * out + 0.6 * age,
            y: 1.3 + 0.32 * age + k * 0.25,
            z: a.from.z + uz * out + (k - 0.5) * 0.5,
            r: (0.35 + 1.05 * smooth(age / 2.2)) * (1 - 0.25 * k),
          });
        }
      continue;
    }
    const dx = a.to.x - a.from.x,
      dz = a.to.z - a.from.z,
      yaw = Math.atan2(dx, dz);
    if (f >= 1) {
      if (a.hits < 0) spent.push({ x: a.to.x, z: a.to.z, yaw });
      continue;
    }
    const far = Math.hypot(dx, dz),
      top = 2 + far * 0.22,
      // Up and over: a curve whose slope is the arrow's pitch.
      y = 1.6 + top * 4 * f * (1 - f) - 0.9 * f,
      climb = (top * 4 * (1 - 2 * f) - 0.9) / Math.max(1, far);
    flying.push({
      x: a.from.x + dx * f,
      y,
      z: a.from.z + dz * f,
      yaw,
      pitch: -Math.atan(climb),
    });
  }
  // The blood of the fallen, spreading under them; and thrown up as each is struck down, out
  // from them and falling.
  const blood: BattleNow["blood"][number][] = [],
    spray: BattleNow["spray"][number][] = [];
  for (const x of field.troopers) {
    if (x.falls === null || t < x.falls) continue;
    const p = placeAt(field, x, x.falls),
      dur = crawlsFor(field, x);
    if (dur) {
      // The wounded: a lesser pool where they fell, a smear every so far along the way they
      // dragged themselves, and where they came to lie still, their blood spreading.
      const c = crawledTo(field, x, t, dur);
      if (t > x.falls + 0.3)
        blood.push({ x: p.x, z: p.z, r: (0.45 + 0.4 * x.u) * smooth((t - x.falls - 0.3) / 3) });
      for (let d = 0.9; d < c.gone; d += 0.9)
        blood.push({
          x: p.x + ((c.x - p.x) * d) / c.gone,
          z: p.z + ((c.z - p.z) * d) / c.gone,
          r: 0.26 + 0.12 * unit(x.id, 80 + Math.round(d * 10)),
        });
      const still = t - (x.falls + CRAWL.after + dur);
      if (still > 0) blood.push({ x: c.x, z: c.z, r: (0.7 + 0.8 * x.u) * smooth(still / 4) });
    } else if (t > x.falls + 0.3) {
      const at = bloodAt(x, p);
      blood.push({
        x: at.x,
        z: at.z,
        r: (0.75 + 0.85 * x.u) * smooth((t - x.falls - 0.3) / 4),
      });
    }
    const age = t - x.falls;
    if (age < 0.6)
      for (let k = 0; k < 7; k++) {
        const a = unit(x.id, 40 + k) * 2 * Math.PI,
          out = 0.8 + 2.2 * unit(x.id, 50 + k),
          up = 1.2 + 2.4 * unit(x.id, 60 + k),
          y = 1.15 + up * age - 4.9 * age * age;
        if (y > 0.05)
          spray.push({
            x: p.x + Math.cos(a) * out * age,
            y,
            z: p.z + Math.sin(a) * out * age,
            r: 0.07 + 0.08 * unit(x.id, 70 + k),
          });
      }
  }
  // Dust where they run and where the lines meet.
  const dust: BattleNow["dust"][number][] = [];
  for (const x of troopers)
    if ((x.act === "run" || x.act === "flee" || x.act === "fight") && x.id % 5 === 0) {
      const ph = (t * 0.9 + x.id * 0.37) % 1;
      dust.push({
        x: x.x - Math.sin(x.yaw) * 0.6 * ph,
        y: 0.2 + 1.2 * ph,
        z: x.z - Math.cos(x.yaw) * 0.6 * ph,
        r: (0.5 + 1.1 * ph) * (x.act === "fight" ? 0.8 : 1),
      });
    }
  // The cannon: the smoke of their firing, a great cloud rolling out before each; the flash.
  const cannon: BattleNow["cannon"][number][] = [];
  for (const c of field.cannon) {
    const last = c.fires.filter((f) => f <= t).at(-1) ?? null,
      ux = Math.sin(c.yaw),
      uz = Math.cos(c.yaw);
    cannon.push({
      x: c.x,
      z: c.z,
      yaw: c.yaw,
      recoil: last === null ? 0 : Math.max(0, 1 - (t - last) / 0.6),
    });
    for (const f of c.fires) {
      const age = t - f;
      if (age < 0 || age >= 4.5) continue;
      if (age < 0.12) flashes.push({ x: c.x + ux * 2.4, y: 1.0, z: c.z + uz * 2.4, yaw: c.yaw });
      for (let k = 0; k < 4; k++) {
        const out = 2.4 + 4 * smooth(age / 1.5) + k * 1.4;
        smoke.push({
          x: c.x + ux * out + 0.6 * age,
          y: 1.0 + 0.45 * age + k * 0.35,
          z: c.z + uz * out + (unit(f * 10, k) - 0.5) * 2,
          r: (0.8 + 2.2 * smooth(age / 3)) * (1 - 0.15 * k),
        });
      }
    }
  }
  // The ladders at a seat's walls: lying at their feet a moment, raised against them, and where
  // the walls held, thrown down off them.
  const w = field.ground.wall,
    ladders: BattleNow["ladders"][number][] = [];
  if (w)
    for (const l of field.ladders) {
      if (t < l.up - 0.6) continue;
      const { foot, lean, long } = ladderOn(w);
      ladders.push({
        x: foot,
        z: l.z,
        rise:
          l.down !== null && t >= l.down
            ? lean + (Math.PI - lean) * smooth((t - l.down) / 1.4)
            : lean * smooth((t - l.up) / 1.6),
        long,
      });
    }
  const stormed = field.near.outcome === "stormed",
    moment = [...field.moments].reverse().find((m) => t >= m.at);
  return {
    s: t,
    troopers,
    flying,
    spent,
    blood,
    spray,
    smoke,
    flashes,
    cannon,
    dust,
    standing,
    fallen,
    ladders,
    gate: stormed ? smooth((t - MOMENTS.gate) / 3) : 0,
    burning: stormed ? smooth((t - MOMENTS.gate - 6) / 14) : 0,
    camp: field.near.outcome === "siege" ? smooth((t - MOMENTS.after - 4) / 10) : 0,
    words: moment?.words ?? "",
  };
}

/**
 * The meadow made the field a battle was fought on: no pool, no wood where the hosts stand,
 * march and run; its grass trodden short where they go (the blood of the fallen seen over it),
 * worn to the earth under the walls and the town behind them, none in the river.
 */
export function fieldMeadow(field: BattleField, meadow: MeadowState): void {
  const g = field.ground;
  meadow.pond = null;
  meadow.shrubs.splice(
    0,
    meadow.shrubs.length,
    ...meadow.shrubs.filter((s) => Math.abs(s.z) > 34 || Math.abs(s.x) > 64),
  );
  for (let i = 0; i < meadow.grass.length; i++) {
    const m = cellMiddle(i),
      u = unit(i, 77);
    meadow.grass[i] =
      g.river && Math.abs(m.x - g.river.x) < g.river.w / 2 + 0.6
        ? 0
        : g.wall && m.x > g.wall.x - 1.5
          ? 0.12
          : Math.abs(m.z) < TRODDEN.z && Math.abs(m.x) < TRODDEN.x
            ? 0.22 + 0.2 * u
            : 0.55 + 0.4 * u;
  }
}

/** Where the hosts tread the grass short (metres either way): over it, the blood is seen. */
export const TRODDEN = { x: 66, z: 40 } as const;

/** One who fought, by what they fought with. */
const FIGHTERS: Readonly<Record<string, string>> = {
  club: "a clubman",
  spear: "a spearman",
  musket: "a musketeer",
  rifle: "a rifleman",
  axe: "an axeman",
  sword: "a swordsman",
  bow: "a bowman",
  "horn-bow": "a bowman",
  claws: "a clawed fighter",
  mandibles: "a biter",
  tusks: "a tusker",
  grapple: "a grappler",
  "shell-darts": "a darter",
};

/** What struck one down from afar: an arrow, a dart, a ball, a bullet (the other side's arm). */
function shotBy(other: BattleNear["attacker"]): string {
  switch (other.host?.arm) {
    case "musket":
      return "a musket ball";
    case "rifle":
      return "a bullet";
    case "shell-darts":
      return "a dart";
    default:
      return "an arrow";
  }
}

const ORDINALS = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
];

/** What one on a ladder is at, in words. */
const CLIMB_WORDS: Partial<Record<Act, string>> = {
  run: "making for a ladder",
  march: "on a ladder",
  fight: "fighting at the top of a ladder",
  stand: "over the walls",
  cheer: "over the walls",
};

/**
 * One who fought, told (the one followed, Phase 37 M186): who they were in their host, and what
 * had become of them by `s` — waiting in the line, coming on, in the press, fallen and how,
 * running from the field, after the beaten.
 */
export function trooperWords(field: BattleField, id: number, s: number): string {
  const t = field.troopers[id];
  if (!t) return "";
  const side = t.side === 0 ? field.near.attacker : field.near.defender,
    h = field.hosts[t.side]!,
    who =
      h.mounted === "chariot"
        ? "a chariot's warrior"
        : h.mounted === "horse"
          ? "a rider"
          : t.bearer
            ? "a banner's bearer"
            : (FIGHTERS[side.host?.arm ?? ""] ?? "one"),
    rank = ORDINALS[t.rank] ?? `${t.rank + 1}th`,
    won = t.side === field.beaten ? false : true,
    // (Of a wing that wheels about the other host's flank.)
    wing = !!field.wings && field.wings.side === t.side && Math.abs(t.z) > field.wings.z,
    crawls = crawlsFor(field, t),
    climb = climbing(field, t, s),
    fate =
      t.falls !== null && s >= t.falls && crawls && s < t.falls + CRAWL.after + crawls
        ? "struck down, dragging themselves back toward their lines"
        : t.falls !== null && s >= t.falls
          ? t.by === "arrow"
            ? `fell to ${shotBy(t.side === 0 ? field.near.defender : field.near.attacker)}`
            : t.by === "rout"
              ? "cut down as they ran"
              : "fell in the press"
          : t.flees !== null && s >= t.flees
            ? "running from the field"
            : climb
              ? (CLIMB_WORDS[climb.act] ?? "on a ladder")
              : t.gate && s >= MOMENTS.gate
                ? "through the broken gate"
                : t.pursues && s >= MOMENTS.rout && s < MOMENTS.after
                  ? "after the beaten"
                  : s < MOMENTS.advance
                    ? "waiting in the line"
                    : s < MOMENTS.melee
                      ? t.side === 0
                        ? "coming on"
                        : "holding the line"
                      : s < MOMENTS.rout
                        ? wing && s > WHEEL.from
                          ? s < WHEEL.to
                            ? "wheeling about their flank"
                            : "falling on their flank"
                          : "in the press"
                        : won
                          ? "standing on the field, its victor"
                          : "standing still",
    each = field.per > 1 ? ` (a figure for ${field.per.toLocaleString("en-US")} men)` : "";
  return `👁 ${who[0]!.toUpperCase()}${who.slice(1)} of ${side.name}, in the ${rank} rank${each}: ${fate}.`;
}

/** The men standing and fallen of each side at `s`, as history counts them (so many for each figure). */
export function menAt(
  field: BattleField,
  now: BattleNow,
): { standing: [number, number]; fallen: [number, number] } {
  const men = (side: 0 | 1) => {
    const n = field.hosts[side]!.n,
      fielded = side === 0 ? field.near.attacker.fielded : field.near.defender.fielded,
      fell = side === 0 ? field.near.attacker.fallen : field.near.defender.fallen,
      drawnFalls = field.hosts[side]!.falls,
      // (As the figures fall, so the men: all who fell, once all the figures to fall have.)
      down = drawnFalls ? Math.round((now.fallen[side] / drawnFalls) * fell) : 0;
    return { fallen: down, standing: Math.max(0, fielded - down), n };
  };
  const a = men(0),
    d = men(1);
  return { standing: [a.standing, d.standing], fallen: [a.fallen, d.fallen] };
}
