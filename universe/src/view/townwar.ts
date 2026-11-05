// A town at war (Phase 40 M204, asked for 2026-10-25: "...like the more fluid views of wars and
// just actions of stuff yk"). Its land's wars as the land plays them (M203: view/warplay.ts), at
// its gates and on the world's clock:
// - its men muster on open ground past its homes and march out by its road;
// - before the land's heart (the town its battles are fought before, view/warplay's heartTown) the
//   hosts come by the road, draw up, close and fight as the year ends; at the turn the beaten fly
//   (behind its walls, a siege laid), the fallen lie where they fell, the victors hold the field
//   and march in — fought the morning after the turn, and in place where its own layer draws it
//   (Phase 55 M227: view/placed.ts), the fallen lying until they are borne in two days on;
// - a siege: the besiegers camped about it all year and storming its walls at the end; a town
//   stormed burns;
// - at the peace its men come home by the road.
// Pure: who stands where, at a moment of the world's.
import type { BattleOutcome, VillagePlan, WarsMap } from "../bridge/index.ts";
import {
  BATTLE_DAY,
  battleSecond,
  battleStage,
  battleTurnWords,
  borneShare,
  type BattleStage,
} from "./battleday.ts";
import { armLook } from "./arms.ts";
import type { VehicleNow } from "./battle.ts";
import { clearOf, keepOut, route, villageGround, type Ground, type Solid } from "./ground.ts";
import {
  drawnSquad,
  hostOrder,
  orderPlaces,
  shellsWalls,
  type HostOrder,
  type OrderPlace,
} from "./order.ts";
import { drillGround } from "./village.ts";
import { WAR_YEAR, warNow, type HostNow, type WarNow } from "./warplay.ts";
import type { Soldier } from "./war.ts";

type War = WarsMap["wars"][number];
type Side = War["attacker"];
type Flat = { readonly x: number; readonly z: number };

/** What a host is at, at a town. */
export type TownDoing =
  | "mustering"
  | "leaving"
  | "coming"
  | "drawn"
  | "engaged"
  | "guard"
  | "holding"
  | "fleeing"
  | "entering"
  | "besieging"
  | "assaulting"
  | "besieged"
  | "home";

/** Each doing's sign, as the host's label shows it (as a land's marks show theirs). */
export const TOWN_DOING_ICON: Readonly<Record<TownDoing, string>> = {
  mustering: "📯",
  leaving: "🚩",
  coming: "🚩",
  drawn: "🛡️",
  engaged: "⚔️",
  guard: "🏰",
  holding: "🚩",
  fleeing: "💨",
  entering: "🏴",
  besieging: "⛺",
  assaulting: "🪜",
  besieged: "🏰",
  home: "🏠",
};

/** A host of a war at a town now. */
export type TownHost = {
  /** 0 the attacker's, 1 the defender's. */
  readonly side: 0 | 1;
  readonly doing: TownDoing;
  /** How far through it (0 … 1). */
  readonly k: number;
  /** How much of the host is there (0 … 1). */
  readonly gathered: number;
  /** Leaving from the field before it (falling back, or going home), not from its muster. */
  readonly field?: boolean;
  /** In flight behind its walls (a siege laid), not away. */
  readonly inward?: boolean;
  /** Drawn up from its own gate (the town's guard), not come in from elsewhere. */
  readonly out?: boolean;
  /** What it is at, told. */
  readonly words: string;
};

/** A war as a town sees it now. */
export type TownWar = {
  readonly ref: string;
  /** The war's two sides (their names, colours, hosts' kinds). */
  readonly sides: readonly [Side, Side];
  readonly hosts: readonly TownHost[];
  /** The battle before it at its year's end: drawn up, engaged, its rout — and how far through (0 … 1). */
  readonly fight: {
    readonly stage: "drawn" | "engaged" | "rout";
    readonly k: number;
    /** The battle's key, as its land's fight is keyed (its war, and the turn it is fought at). */
    readonly key: string;
  } | null;
  /** The battle fought before it at the year's turn (its fallen lie there), and what came of it. */
  readonly fought: {
    readonly event: string;
    readonly won: boolean;
    readonly fallen: number;
    readonly outcome: BattleOutcome;
    /** Fought about its walls (a siege's storm), not on the field before it. */
    readonly walls: boolean;
    /** Its fallen borne in and buried (two days after it was fought: Phase 55 M227), lying there no more. */
    readonly buried: boolean;
  } | null;
  /**
   * The battle at the turn fought in place before it (Phase 55 M227; null: none now), from the turn
   * until its fallen are buried: the battle, the turn it is fought at, its stage, its own second now,
   * and how many of its fallen are borne in (0 … 1).
   */
  readonly placed: {
    readonly event: string;
    readonly turn: number;
    readonly stage: Exclude<BattleStage, "eve">;
    readonly s: number;
    readonly borne: number;
  } | null;
  /** The night before the battle at the turn before it (from six on its eve to eight): the hosts by their fires. */
  readonly eve: boolean;
  /** Whether a siege is about it this year (its besiegers' camp; the storm at the year's end). */
  readonly siege: boolean;
  /** How hard it burns (0 … 1): a town stormed (a land taken, a little). */
  readonly burning: number;
  /** The most pressing of what its hosts are at, told ("📯 Hyv: mustering for the war upon Taitrandath"). */
  readonly words: string;
};

/** What a town is to its land's wars: its land's spot (the globe's grid), and whether it is the land's heart. */
export type TownPlace = { readonly spot: number; readonly heart: boolean };

const YEAR = 365 * 86_400;
/** How much of a march's way (eased) a town sees: its column leaving by the road, and coming in by it. */
const OUT = 0.08,
  IN = 0.08;
/** Which of two at a town is the more pressing, shown when wars meet there. */
const PRESSING: Readonly<Record<TownDoing, number>> = {
  engaged: 10,
  assaulting: 10,
  drawn: 9,
  fleeing: 8,
  entering: 8,
  holding: 7,
  besieging: 7,
  besieged: 7,
  coming: 6,
  leaving: 6,
  mustering: 5,
  home: 4,
  guard: 3,
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};

/** A doing's sign for a war whose attackers bear `arm`: past the ladders they lay no camp and raise none (W1). */
export function townDoingIcon(doing: TownDoing, arm: string | undefined): string {
  return shellsWalls(arm) && (doing === "besieging" || doing === "assaulting")
    ? "💥"
    : TOWN_DOING_ICON[doing];
}

/** A host of a war now, at a town: what it is at there (null: not there). */
function atTown(h: HostNow, n: WarNow, w: War, place: TownPlace): TownHost | null {
  const S = place.spot,
    heart = place.heart,
    foe = (h.side === 0 ? w.defender : w.attacker).name,
    // (Past the ladders no one stands on the walls or storms them: W1.)
    shelled = shellsWalls(w.attacker.host?.arm),
    host = (
      doing: TownDoing,
      words: string,
      k = 1,
      more: { field?: boolean; inward?: boolean; out?: boolean; gathered?: number } = {},
    ): TownHost => ({
      side: h.side,
      doing,
      k: clamp01(k),
      gathered: clamp01(more.gathered ?? h.gathered),
      ...(more.field ? { field: true } : {}),
      ...(more.inward ? { inward: true } : {}),
      ...(more.out ? { out: true } : {}),
      words,
    });
  switch (h.doing) {
    case "mustering":
      return h.from === S ? host("mustering", `mustering for the war upon ${foe}`) : null;
    case "marching":
    case "rallying":
      // (Every town of the land it musters in sends its men; the heart alone sees them come.)
      if ((h.doing === "marching" || heart) && h.from === S && h.k < OUT)
        return host("leaving", `marching out to the war upon ${foe}`, h.k / OUT);
      if (heart && h.to === S && h.k > 1 - IN)
        return host(
          "coming",
          h.side === 0 ? `coming by the road to give battle` : `come to hold the land`,
          (h.k - (1 - IN)) / IN,
        );
      return null;
    case "facing":
      return heart && h.front === S
        ? host("drawn", `drawn up for battle`, 1, { out: h.side === 1 && h.from === S })
        : null;
    case "engaged":
      if (!heart || h.front !== S) return null;
      return n.siege === S && h.side === 1
        ? host("besieged", shelled ? `fighting in its streets` : `fighting on the walls`)
        : host("engaged", `fighting before the town`);
    case "garrisoned":
      return heart && h.from === S ? host("guard", `holding the town`) : null;
    case "holding":
      return heart && h.from === S ? host("holding", `holding the field`) : null;
    case "withdrawing":
      if (heart && h.from === S && h.k < 0.5)
        return host("leaving", `falling back from the field`, h.k / 0.5, { field: true });
      if (h.to === S && h.from !== S && h.k > 1 - IN)
        return host("home", `come back from the field`, (h.k - (1 - IN)) / IN);
      return null;
    case "routed": {
      // (Out of the town's sight, or behind its walls, as the rout ends.)
      const inward = h.to === S && n.fought?.outcome === "siege";
      return heart && h.from === S
        ? host("fleeing", inward ? `fled behind the walls` : `in flight`, n.after / WAR_YEAR.rout, {
            inward,
          })
        : null;
    }
    case "entering":
      return heart && h.to === S ? host("entering", `marching into the town`, h.k) : null;
    case "besieging":
      return heart && h.from === S
        ? host(
            "besieging",
            shelled ? `shelling the town` : `besieging the town`,
            n.fought ? (n.after - WAR_YEAR.rout) / (WAR_YEAR.after - WAR_YEAR.rout) : 1,
          )
        : null;
    case "assaulting":
      return heart && h.from === S
        ? host("assaulting", shelled ? `storming the town by its streets` : `storming the walls`)
        : null;
    case "besieged":
      return heart && h.from === S
        ? host("besieged", shelled ? `holding its streets under the shells` : `on the walls`)
        : null;
    case "returning":
      if (h.to === S && (h.from === h.to || h.k > 1 - IN))
        return host("home", `come home from the war`, h.from === h.to ? 1 : (h.k - (1 - IN)) / IN);
      if (heart && h.from === S && h.k < OUT)
        return host("leaving", `going home`, h.k / OUT, { field: true });
      return null;
  }
}

/**
 * The war a town sees at `y` (the world's years, fractional), as its land plays it: of the wars of
 * the map that reach it, the one most pressing there (a battle before it over a muster in it; the
 * first of the map where two press alike). Null: none reaches it.
 */
export function townWarNow(
  map: WarsMap,
  y: number,
  place: TownPlace,
  preferredBattle?: string,
): TownWar | null {
  let best: TownWar | null = null,
    bestScore = -1;
  for (const w of map.wars) {
    const n = warNow(w, y, map.year);
    if (!n) continue;
    const hosts: TownHost[] = [];
    for (const h of [n.attacker, n.defender]) {
      const t = h ? atTown(h, n, w, place) : null;
      if (t) hosts.push(t);
    }
    if (place.heart && n.held === place.spot && !hosts.some((h) => h.side === 1))
      hosts.push({
        side: 1,
        doing: "guard",
        k: 1,
        gathered: 1,
        words: `holding the town until their host comes`,
      });
    // (Its fallen lie there once it is fought: the morning after the turn, D4.)
    const fought =
        place.heart && n.fought && n.fought.battle.spot === place.spot && n.closing?.at !== n.turn
          ? n.fought
          : null,
      // A battle being fought in place keeps the town to the end, whatever another war of its land
      // is pressing, and past its rout: then its hosts, come from elsewhere, are at nothing of this town's.
      inPlace =
        place.heart && n.fought?.battle.spot === place.spot ? battleStage(y * YEAR, n.turn) : null,
      fightingHere = !!inPlace && inPlace !== "eve";
    if (!hosts.length && !fought && !fightingHere) continue;
    const chosen =
        preferredBattle !== undefined &&
        n.fought?.battle.event === preferredBattle &&
        !!battleStage(y * YEAR, n.turn),
      score =
        Math.max(0, ...hosts.map((h) => PRESSING[h.doing])) +
        (fought ? 0.5 : 0) +
        (fightingHere ? 1000 : 0) +
        (chosen ? 1e6 : 0);
    if (score <= bestScore) continue;
    bestScore = score;
    const c = place.heart && n.closing?.spot === place.spot ? n.closing : null,
      T = WAR_YEAR,
      // (Drawn up to the turn and through the night; engaged the next morning, D4: Phase 55 M227.)
      fight: TownWar["fight"] = c
        ? { stage: c.engaged ? "engaged" : "drawn", k: clamp01(c.k), key: `${w.ref}:${c.at}` }
        : fought && n.after < T.rout
          ? { stage: "rout", k: clamp01(n.after / T.rout), key: `${w.ref}:${n.turn}` }
          : null,
      // (A storm of its walls: the battle the year before laid the siege it ended.)
      walls =
        !!fought &&
        w.battles.some(
          (b) => b.year === n.turn - 2 && b.spot === place.spot && b.outcome === "siege",
        ),
      fire = fought?.outcome === "stormed" ? 1 : fought?.outcome === "taken" && !walls ? 0.35 : 0,
      // (Burning through the victors' entry, smouldering a season after.)
      burning = fire * (n.after < T.after ? 1 : clamp01(1 - (n.after - T.after) / 0.25)),
      top = [...hosts].sort((a, b) => PRESSING[b.doing] - PRESSING[a.doing])[0],
      sideName = (side: 0 | 1) => {
        const name = (side === 0 ? w.attacker : w.defender).name;
        return name.charAt(0).toUpperCase() + name.slice(1);
      },
      // The battle at the turn fought in place before its heart (Phase 55 M227): from the turn until
      // its fallen are buried; and the night before it, its hosts by their fires.
      t = y * YEAR,
      atTurn =
        place.heart && n.fought && n.fought.battle.spot === place.spot ? n.fought.battle : null,
      stage = atTurn ? battleStage(t, n.turn) : null,
      placed: TownWar["placed"] =
        atTurn && stage && stage !== "eve"
          ? {
              event: atTurn.event,
              turn: n.turn,
              stage,
              s: battleSecond(t, n.turn),
              borne: borneShare(t, n.turn),
            }
          : null,
      night = c && !c.engaged ? battleStage(t, c.at) : null,
      told = battleTurnWords(n.turn).replace(/^the/, "The");
    best = {
      ref: w.ref,
      sides: [w.attacker, w.defender],
      hosts,
      fight,
      fought: fought
        ? {
            event: fought.battle.event,
            won: fought.battle.won,
            fallen: fought.battle.fallen,
            outcome: fought.outcome,
            walls,
            buried: t >= n.turn * YEAR + BATTLE_DAY.buried,
          }
        : null,
      placed,
      eve: night === "eve" || night === "morning",
      siege: place.heart && (n.siege === place.spot || (walls && n.after < T.after)),
      burning,
      words:
        placed?.stage === "morning"
          ? `🛡️ ${sideName(0)} and ${w.defender.name} drawn up before the town: ${battleTurnWords(n.turn)}, at eight`
          : placed?.stage === "battle"
            ? `⚔️ ${told}, fought before the town`
            : top
              ? `${townDoingIcon(top.doing, w.attacker.host?.arm)} ${sideName(top.side)}: ${top.words}`
              : `⚔️ The field where ${sideName(0)} fought ${w.defender.name}`,
    };
  }
  return best;
}

// —— Drawn ————————————————————————————————————————————————————————————————————

/** A town's war drawn now: its soldiers, its besiegers' tents, its fires, where each host stands. */
export type TownWarScene = {
  /**
   * Each side's `2 × each`: its host (`each`, the attackers' first), then the fallen of a battle
   * fought before it (`each`, lying where they fell). Those not there are drawn at size 0.
   */
  readonly soldiers: readonly Soldier[];
  readonly tents: readonly { readonly x: number; readonly z: number; readonly yaw: number }[];
  /** Its houses burning: where, how high the flames (0 … 1). */
  readonly fires: readonly { readonly x: number; readonly z: number; readonly size: number }[];
  /** The hosts' fires the night before a battle before it, behind their lines (Phase 55 M227). */
  readonly camp: readonly { readonly x: number; readonly z: number }[];
  /** Where each side's host stands (the middle of those drawn), for its label; null: none there. */
  readonly middles: readonly [Flat | null, Flat | null];
  /** Past the line (W1), a machine gun's team's gun on its tripod: where, which way, whether it fires. */
  readonly teamGuns?: readonly (Flat & { readonly yaw: number; readonly firing: boolean })[];
  /** Past the ladders (W1), the besiegers' guns standing off: where, and which way they lay. */
  readonly battery?: readonly (Flat & { readonly yaw: number })[];
  /** Where their shells are landing in the town's lots, a burst at a time by the screen's clock. */
  readonly shells?: readonly Flat[];
  /** An armoured host's cars (as the close field's: render/vehicles.ts), in the town's metres. */
  readonly cars?: readonly VehicleNow[];
};

/** The besiegers' camp: how far past the homes; how many tents. */
const CAMP_OUT = 55,
  TENTS = 12;
/** How far past its homes a column comes into view by the road, and goes out of it (metres). */
const ROAD_OUT = 230;
/** Where the hosts meet, past its homes along its road (as a battle about a village always met). */
const FRONT = 40;
/** A column's rows apart, and its two files (metres). */
const ROW = 2.2,
  FILE = 1.6;

/** A keyed number in [0, 1). */
const unit = (a: number, b: number) => {
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};
const hashText = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
};
/** The yaw that faces a soldier along (dx, dz). */
const facing = (dx: number, dz: number) => Math.atan2(dx, dz);

/** A way through the town's ground: its points, and how far along each lies. */
type Path = {
  readonly points: readonly Flat[];
  readonly at: readonly number[];
  readonly length: number;
};
function pathOf(points: readonly Flat[]): Path {
  const at = [0];
  for (let i = 1; i < points.length; i++)
    at.push(
      at[i - 1]! + Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.z - points[i - 1]!.z),
    );
  return { points, at, length: at[at.length - 1]! };
}
/** Where along a path `d` metres from its start lies, and which way it runs there. */
function along(p: Path, d: number): { x: number; z: number; dx: number; dz: number } {
  let i = 1;
  while (i < p.points.length - 1 && p.at[i]! < d) i++;
  const a = p.points[i - 1]!,
    b = p.points[i]!,
    len = Math.max(1e-6, p.at[i]! - p.at[i - 1]!),
    t = clamp01((d - p.at[i - 1]!) / len);
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    dx: (b.x - a.x) / len,
    dz: (b.z - a.z) / len,
  };
}

// —— Past the line (W1: view/order.ts) ————————————————————————————————————————————————

/** The least the hosts stand apart past the line, as the line's own two stood (m). */
const LEAST_APART = 64;
/** How far from where it would stand a squad goes for what stands between it and the fire (m). */
const COVER_REACH = 34,
  /** How far behind it they stand (m). */
  COVER_BEHIND = 2.2;
/** How many bounds a fight is come on in, and how much of each is the rush. */
const BOUNDS = 4,
  RUSH = 0.42;
/** How far past its homes the besiegers' guns stand (m), how many, how far apart, and the shells a look. */
const BATTERY_OUT = 210,
  BATTERY = 4,
  BATTERY_APART = 24,
  SHELLS = 10;
/** How far ahead of its gunner a team's gun is set, and of its squad a car stands (m). */
const GUN_SET = 7.5,
  CAR_AHEAD = 16;

/** Each host past the line, placed once for a war at a town and kept: its figures' places. */
type Spread = {
  readonly order: readonly [HostOrder, HostOrder];
  readonly places: readonly [readonly OrderPlace[], readonly OrderPlace[]];
  /** Drawn up before the town. */
  readonly field: readonly [readonly Flat[], readonly Flat[]];
  /** How far each side comes on over the fight, toward the other (m). */
  readonly gain: readonly [number, number];
  /** About its walls: the besiegers where they lie, the besieged in its yards and behind its walls. */
  readonly about: readonly [readonly Flat[], readonly Flat[]];
  /** The storm's way for a besieger's squad (found when first asked for), and each figure's place off its leader. */
  readonly storm: (squad: number) => Path;
  readonly off: readonly Flat[];
  /** Its own guard at its edge (one in two of its host). */
  readonly guard: readonly Flat[];
  /** Whether its besiegers stand off and shell it, not raise ladders. */
  readonly shelling: boolean;
  readonly battery: readonly (Flat & { readonly yaw: number })[];
  readonly shells: readonly Flat[];
};

const SPREADS = new WeakMap<VillagePlan, Map<string, Spread>>();

/** What stands between a squad and the fire, near where it would stand: just behind it (null: nothing there). */
function coverAt(ground: Ground, p: Flat, awayX: number, awayZ: number): Flat | null {
  let best: Solid | null = null,
    near = COVER_REACH;
  const look = (s: Solid) => {
    const d = clearOf(s, p);
    if (d < near) {
      near = d;
      best = s;
    }
  };
  for (const h of ground.homes) look(h);
  for (const s of ground.town?.solids ?? []) look(s);
  const s = best as Solid | null;
  if (!s) return null;
  const ax = s.ax ?? 1,
    az = s.az ?? 0,
    along = Math.abs(ax * awayX + az * awayZ),
    athwart = Math.abs(-az * awayX + ax * awayZ),
    extent = s.r + (s.half ?? 0) * along + (s.across ?? 0) * athwart + COVER_BEHIND;
  return { x: s.x + awayX * extent, z: s.z + awayZ * extent };
}

/** The whole of a host's figures moved with their squad's leader to what covers it. */
function takeCover(
  ground: Ground,
  order: HostOrder,
  places: readonly OrderPlace[],
  at: readonly Flat[],
  away: (p: Flat) => Flat,
): Flat[] {
  if (!order.cover) return [...at];
  const out: Flat[] = [];
  let shift = { x: 0, z: 0 },
    squad = -1;
  places.forEach((place, i) => {
    if (place.squad !== squad) {
      squad = place.squad;
      const p = at[i]!,
        a = away(p),
        c = coverAt(ground, p, a.x, a.z);
      shift = c ? { x: c.x - p.x, z: c.z - p.z } : { x: 0, z: 0 };
    }
    out.push({ x: at[i]!.x + shift.x, z: at[i]!.z + shift.z });
  });
  return out;
}

function makeSpread(
  plan: VillagePlan,
  war: TownWar,
  each: number,
  order: readonly [HostOrder, HostOrder],
): Spread {
  const ground = villageGround(plan),
    way = Math.atan2(plan.road.z, plan.road.x),
    ux = Math.cos(way),
    uz = Math.sin(way),
    reach = ground.homesReach,
    front = reach + FRONT,
    key = hashText(war.ref),
    at = (out: number, across: number): Flat => ({
      x: ux * out - uz * across,
      z: uz * out + ux * across,
    }),
    apart = Math.max(order[0].standOff, order[1].standOff, LEAST_APART),
    // (The defenders' forward edge at the town's edge, or among its homes: no further in than half its reach.)
    edge0 = front + apart * 0.6,
    edge1 = Math.max(reach * 0.5, front - apart * 0.4),
    teams = [armLook(war.sides[0].host?.arm).team, armLook(war.sides[1].host?.arm).team],
    places = [
      orderPlaces(order[0], each, teams[0], key + 1, 220),
      orderPlaces(order[1], each, teams[1], key + 2, edge1 + reach * 0.45),
    ] as const,
    open = edge0 - edge1,
    closes = [order[0].standOff === 0, order[1].standOff === 0],
    gain: [number, number] = [
      closes[0] ? (closes[1] ? open / 2 : open - 2) : closes[1] ? 0 : apart * 0.45,
      closes[1] ? (closes[0] ? open / 2 : open - 2) : 0,
    ],
    field = [
      takeCover(
        ground,
        order[0],
        places[0],
        places[0].map((q) => at(edge0 + q.depth, q.across)),
        () => ({ x: ux, z: uz }),
      ),
      takeCover(
        ground,
        order[1],
        places[1],
        places[1].map((q) => at(edge1 - q.depth, q.across)),
        () => ({ x: -ux, z: -uz }),
      ),
    ] as const,
    camp = reach + CAMP_OUT,
    wallOut = reach + 1.6,
    wallIn = Math.max(4, reach - 2),
    shelling = shellsWalls(war.sides[0].host?.arm),
    drawn0 = drawnSquad(order[0].squad),
    drawn1 = drawnSquad(order[1].squad),
    squads0 = Math.max(1, Math.ceil(each / drawn0)),
    squads1 = Math.max(1, Math.ceil(each / drawn1)),
    // Each squad's leader's place: the besiegers on three sides of it, standing off; a closed ring where they
    // raise ladders still, their squads a little out of true.
    leader0 = Array.from({ length: squads0 }, (_, j): Flat => {
      const a = shelling
          ? way + ((j + 0.5) / squads0 - 0.5) * 1.55 * Math.PI + (unit(j, key + 31) - 0.5) * 0.18
          : way + ((j + 0.5) / squads0) * 2 * Math.PI + (unit(key, 5) - 0.5) * 0.3,
        r = shelling
          ? reach + Math.max(CAMP_OUT, order[0].standOff * 0.7) * (0.85 + 0.3 * unit(j, key + 37))
          : camp - 6 + (unit(j, key + 41) - 0.5) * 16;
      return { x: Math.cos(a) * r, z: Math.sin(a) * r };
    }),
    leader1 = Array.from({ length: squads1 }, (_, j): Flat => {
      const a = way + ((j + 0.5) / squads1) * 2 * Math.PI + (unit(j, key + 43) - 0.5) * 0.3,
        r = wallIn * (0.5 + 0.5 * unit(j, key + 47));
      return { x: Math.cos(a) * r, z: Math.sin(a) * r };
    }),
    // (Each one about their squad's leader, as they stand in their order.)
    offOf = (i: number, drawn: number, side: 0 | 1): Flat => {
      const w = Math.min(order[side].spacing, 7),
        n = i % drawn,
        rank = Math.ceil(n / 2);
      return { x: (n % 2 ? -1 : 1) * rank * w, z: rank * w * 0.6 };
    },
    off = places[0].map((_, i) => offOf(i, drawn0, 0)),
    about = [
      places[0].map((q, i) => ({
        x: leader0[q.squad]!.x + off[i]!.x,
        z: leader0[q.squad]!.z + off[i]!.z,
      })),
      takeCover(
        ground,
        order[1],
        places[1],
        places[1].map((q, i) => {
          const o = offOf(i, drawn1, 1);
          return { x: leader1[q.squad]!.x + o.x, z: leader1[q.squad]!.z + o.z };
        }),
        (p) => {
          const d = Math.max(1e-6, Math.hypot(p.x, p.z));
          return { x: -p.x / d, z: -p.z / d };
        },
      ),
    ] as const,
    // The storm: squads by the streets to the town's middle, where they stand off and shell; to its walls where they raise ladders.
    ways: Path[] = [],
    storm = (j: number) => {
      const kept = ways[j];
      if (kept) return kept;
      const l = leader0[j]!,
        d = Math.max(1e-6, Math.hypot(l.x, l.z)),
        r = shelling ? reach * (0.25 + 0.3 * unit(j, key + 53)) : wallOut,
        to = { x: (l.x / d) * r, z: (l.z / d) * r },
        walk = route(ground, l, to, 1.2);
      return (ways[j] = pathOf(walk.length > 1 ? walk : [l, to]));
    },
    half = Math.ceil(each / 2),
    guardPlaces = orderPlaces(order[1], half, teams[1], key + 3, Math.max(20, reach * 0.5)),
    guard = takeCover(
      ground,
      order[1],
      guardPlaces,
      guardPlaces.map((q) => at(reach + 4 - q.depth, q.across)),
      () => ({ x: -ux, z: -uz }),
    ),
    battery = shelling
      ? Array.from({ length: BATTERY }, (_, g) => {
          const p = at(reach + BATTERY_OUT + (g % 2) * 7, (g - (BATTERY - 1) / 2) * BATTERY_APART);
          return { x: p.x, z: p.z, yaw: facing(-ux, -uz) };
        })
      : [],
    homes = plan.homes,
    shells = shelling
      ? Array.from({ length: SHELLS }, (_, j) => {
          const h = homes.length ? homes[Math.floor(unit(j, key + 59) * homes.length)]! : null;
          return h
            ? { x: h.x, z: h.z }
            : at(reach * (unit(j, key + 61) - 0.3), (unit(j, key + 67) - 0.5) * reach * 1.2);
        })
      : [];
  return { order, places, field, gain, about, storm, off, guard, shelling, battery, shells };
}

/** A war's hosts past the line, as they stand at a town (kept with its plan: reckoned once). */
function spreadOf(
  plan: VillagePlan,
  war: TownWar,
  each: number,
  order: readonly [HostOrder, HostOrder],
): Spread {
  let kept = SPREADS.get(plan);
  if (!kept) SPREADS.set(plan, (kept = new Map()));
  const a = war.sides[0].host,
    d = war.sides[1].host,
    k = `${war.ref}|${each}|${a?.arm}|${a?.mount}|${d?.arm}|${d?.mount}`;
  let s = kept.get(k);
  if (!s) {
    if (kept.size > 8) kept.clear();
    s = makeSpread(plan, war, each, order);
    kept.set(k, s);
  }
  return s;
}

/** How far on a squad has come at `e` of the fight, by bounds: the checkerboard's two halves in turn, and whether it rushes now. */
function bounded(e: number, squad: number): { g: number; rush: boolean } {
  const c = e * BOUNDS - (squad % 2) * 0.5;
  if (c <= 0) return { g: 0, rush: false };
  const whole = Math.floor(c),
    f = c - whole;
  return { g: Math.min(1, (whole + smooth(f / RUSH)) / BOUNDS), rush: f < RUSH && e < 1 };
}

/**
 * Who of a host fell (a keyed turn through it: as many as `count`, the same ones as it grows) —
 * at what point of the fight each falls (0 … 1).
 */
const falls = (i: number, side: number, each: number, count: number) =>
  (i * 11 + side * 3) % Math.max(1, each) < count;
const fallsAt = (i: number, side: number) => 0.3 + 0.6 * unit(i, side * 13 + 1);

/**
 * A town's war drawn as it stands now: `each` of a side's host, placed by what it is
 * at — on its muster ground, in column on the road, in two ranks on its line before the town or
 * closing and fighting at the line between, about its walls, in flight — and the fallen of the
 * battle fought before it lying where they fell, the beaten the more, until they are buried; the
 * night before a battle, its hosts' fires. `placed`: the battle at the turn drawn in place by its
 * own layer (Phase 55 M227), so none of its hosts here while it is fought, nor its fallen. Pure.
 */
export function townWarScene(
  plan: VillagePlan,
  war: TownWar,
  each: number,
  placed = false,
): TownWarScene {
  const ground = villageGround(plan),
    way = Math.atan2(plan.road.z, plan.road.x),
    ux = Math.cos(way),
    uz = Math.sin(way),
    reach = ground.homesReach,
    front = reach + FRONT,
    key = hashText(war.ref),
    at = (out: number, across: number): Flat => ({
      x: ux * out - uz * across,
      z: uz * out + ux * across,
    }),
    muster = drillGround(plan),
    road = at(reach + ROAD_OUT, 0),
    gate = at(reach + 12, 0),
    // (The defenders rallying to the land come in across the open ground, the road the attackers'.)
    aside = (unit(key, 3) < 0.5 ? -1 : 1) * (reach + ROAD_OUT),
    soldiers: Soldier[] = [],
    tents: { x: number; z: number; yaw: number }[] = [],
    fires: { x: number; z: number; size: number }[] = [],
    nightFires: { x: number; z: number }[] = [],
    sum = [
      { x: 0, z: 0, n: 0 },
      { x: 0, z: 0, n: 0 },
    ],
    // Each host's order from the fire it stands against (W1). Before the magazine both are lines, and
    // nothing past here reads further than this.
    orders = [
      hostOrder(war.sides[0].host, war.sides[1].host),
      hostOrder(war.sides[1].host, war.sides[0].host),
    ] as const,
    apart = orders[0].line && orders[1].line ? null : spreadOf(plan, war, each, orders),
    teamGuns: { x: number; z: number; yaw: number; firing: boolean }[] = [],
    cars: VehicleNow[] = [];
  /** Whether a side stands past the line. */
  const spread = (side: number) => (apart && !apart.order[side]!.line ? apart : null);
  /** Where one past the line stands at `e` of the fight before the town, and whether their squad rushes. */
  const fieldNow = (i: number, side: 0 | 1, e: number) => {
    const s = apart!,
      p = s.field[side][i]!,
      o = s.order[side],
      squad = s.places[side][i]!.squad,
      { g, rush } = o.bounds ? bounded(e, squad) : { g: clamp01(e), rush: e > 0 && e < 1 },
      dir = side === 0 ? -1 : 1,
      d = dir * g * s.gain[side];
    return { x: p.x + ux * d, z: p.z + uz * d, rush: rush && s.gain[side] > 0, g };
  };
  /** Where a besieger past the line stands at `e` of the storm (by its squad's way), or one besieged. */
  const wallsNow = (i: number, side: 0 | 1, e: number) => {
    const s = apart!;
    if (side === 1) return { ...s.about[1][i]!, rush: false, g: 0 };
    const o = s.order[0],
      squad = s.places[0][i]!.squad,
      { g, rush } = o.bounds ? bounded(e, squad) : { g: clamp01(e), rush: e > 0 && e < 1 },
      way = s.storm(squad),
      p = along(way, g * way.length),
      off = s.off[i]!;
    return { x: p.x + off.x, z: p.z + off.z, rush, g };
  };
  /** A soldier's place in two ranks across the road (`out` metres along it), facing `toward`. */
  const rankOf = (i: number, side: number) => {
    const file = (i >> 1) - (Math.ceil(each / 2) - 1) / 2,
      rank = i & 1;
    return { across: file * 3.2 + (unit(i, side * 7 + key) - 0.5) * 1.2, rank };
  };
  const lineAt = (i: number, side: number, out: number, step: number): Flat => {
    const { across, rank } = rankOf(i, side);
    return at(out + rank * step, across);
  };
  /** The attackers' line, the defenders', and where each meets the other. */
  const attackLine = (i: number) => lineAt(i, 0, front + 34, 4),
    defendLine = (i: number) => lineAt(i, 1, front - 30, -4),
    meetOf = (i: number, side: number) =>
      side === 0 ? lineAt(i, 0, front + 1.6, 2.6) : lineAt(i, 1, front - 1.6, -2.6);
  /** About its walls: each soldier's turn about the town (the defenders' paired with the besiegers'). */
  const ringAngle = (i: number) =>
      way + ((i + 0.5) / each) * 2 * Math.PI + (unit(key, 5) - 0.5) * 0.3,
    ringAt = (i: number, r: number): Flat => {
      const a = ringAngle(i);
      return { x: Math.cos(a) * r, z: Math.sin(a) * r };
    },
    camp = reach + CAMP_OUT,
    wallOut = reach + 1.6,
    wallIn = Math.max(4, reach - 2);
  /** A block of four files on the muster ground, facing the road. */
  const blockAt = (i: number, middle: Flat): Flat => {
    const col = (i % 4) - 1.5,
      row = Math.floor(i / 4),
      dx = road.x - middle.x,
      dz = road.z - middle.z,
      d = Math.max(1e-6, Math.hypot(dx, dz)),
      fx = dx / d,
      fz = dz / d;
    return {
      x: middle.x - fz * col * 1.9 - fx * row * 1.9,
      z: middle.z + fx * col * 1.9 - fz * row * 1.9,
    };
  };
  const push = (
    i: number,
    side: 0 | 1,
    p: Flat,
    yaw: number,
    doing: Soldier["doing"],
    size = 1,
    keep = true,
  ) => {
    const q = { x: p.x, z: p.z };
    if (keep && doing !== "fallen") keepOut(ground, q, 1.2);
    soldiers[side * 2 * each + i] = { x: q.x, z: q.z, yaw, side, doing, size };
    if (size > 0.5 && doing !== "fallen") {
      sum[side]!.x += q.x;
      sum[side]!.z += q.z;
      sum[side]!.n++;
    }
  };
  const hide = (i: number, side: 0 | 1) => {
    soldiers[side * 2 * each + i] = { x: 0, z: 0, yaw: 0, side, doing: "advance", size: 0 };
  };
  /** A column on a way: its head `k` of the way and the column's length along; those not on it at its ends. */
  const column = (
    i: number,
    side: 0 | 1,
    path: Path,
    k: number,
    start: ((i: number) => Flat) | null,
    end: ((i: number) => Flat) | null,
    endYaw: number,
    doing: Soldier["doing"] = "advance",
  ) => {
    const rows = Math.ceil(each / 2),
      row = i >> 1,
      file = (i & 1) - 0.5,
      head = k * (path.length + rows * ROW),
      d = head - row * ROW;
    if (d <= 0) {
      if (start)
        push(
          i,
          side,
          start(i),
          facing(path.points[1]!.x - path.points[0]!.x, path.points[1]!.z - path.points[0]!.z),
          "stand",
        );
      else hide(i, side);
      return;
    }
    if (d >= path.length) {
      if (end) push(i, side, end(i), endYaw, "stand");
      else hide(i, side);
      return;
    }
    const p = along(path, d);
    push(
      i,
      side,
      { x: p.x - p.dz * file * FILE, z: p.z + p.dx * file * FILE },
      facing(p.dx, p.dz),
      doing,
    );
  };
  const fight = war.fight,
    fought = war.fought,
    // (Drawn in place by its own layer: its hosts while it is fought, its fallen till they are buried.)
    inPlace = placed && war.placed !== null,
    fighting = inPlace && (war.placed!.stage === "morning" || war.placed!.stage === "battle"),
    beaten: 0 | 1 = fought ? (fought.won ? 1 : 0) : 1,
    // (As many fell, the beaten two in three of them, as fell of those who fought — at least a few.)
    share = fought ? Math.max(0.1, Math.min(0.5, fought.fallen / (fought.fallen + 400))) : 0,
    down = Math.round(share * 2 * each),
    during = Math.round(each * 0.2),
    deadOf = (side: number) =>
      !fought
        ? 0
        : Math.max(
            during,
            side === beaten
              ? Math.min(each, Math.round(down * 0.65))
              : down - Math.min(each, Math.round(down * 0.65)),
          ),
    /** Where each fought in the battle fought before it: at the line, or about its walls. */
    foughtAt = (i: number, side: number): Flat =>
      spread(side)
        ? fought?.walls
          ? wallsNow(i, side as 0 | 1, fallsAt(i, side))
          : fieldNow(i, side as 0 | 1, fallsAt(i, side))
        : fought?.walls
          ? ringAt(i, side === 0 ? wallOut : wallIn)
          : meetOf(i, side),
    /** Facing the foe there. */
    foughtFacing = (p: Flat, side: number) =>
      fought?.walls
        ? side === 0
          ? facing(-p.x, -p.z)
          : facing(p.x, p.z)
        : side === 0
          ? facing(-ux, -uz)
          : facing(ux, uz);
  for (const side of [0, 1] as const) {
    const h = war.hosts.find((x) => x.side === side) ?? null,
      shown = h ? Math.round(h.gathered * each) : 0;
    for (let i = 0; i < each; i++) {
      // The fallen of the battle fought before it, where they fell until buried; its host without them.
      const fell = !!fought && falls(i, side, each, deadOf(side)),
        dead = fell && !fought.buried && !inPlace;
      if (dead) {
        const p = foughtAt(i, side);
        soldiers[side * 2 * each + each + i] = {
          x: p.x,
          z: p.z,
          yaw: foughtFacing(p, side),
          side,
          doing: "fallen",
          size: 1,
        };
      } else
        soldiers[side * 2 * each + each + i] = {
          x: 0,
          z: 0,
          yaw: 0,
          side,
          doing: "fallen",
          size: 0,
        };
      if (!h || i >= shown || fighting || (fell && h.doing !== "mustering" && h.doing !== "home")) {
        hide(i, side);
        continue;
      }
      const k = h.k;
      switch (h.doing) {
        case "mustering":
          push(
            i,
            side,
            blockAt(i, muster),
            facing(road.x - muster.x, road.z - muster.z),
            i % 3 ? "drill" : "stand",
          );
          break;
        case "leaving": {
          const from = h.field
              ? spread(side)
                ? (j: number) => fieldNow(j, side, 1)
                : (j: number) => meetOf(j, side)
              : (j: number) => blockAt(j, muster),
            path = pathOf(h.field ? [at(front, 0), road] : [muster, at(reach + 30, 0), road]);
          column(i, side, path, k, from, null, 0);
          break;
        }
        case "coming": {
          const sp = spread(side);
          if (sp) {
            // Past the line they come on across the open, squad by squad, not by the road in column.
            const squads = sp.places[side][each - 1]!.squad + 1,
              e = clamp01(k * 1.4 - (0.4 * sp.places[side][i]!.squad) / squads),
              from = side === 0 ? road : at(front - 30, aside),
              to = sp.field[side][i]!,
              t = smooth(e);
            if (e <= 0) hide(i, side);
            else
              push(
                i,
                side,
                { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t },
                e < 1
                  ? facing(to.x - from.x, to.z - from.z)
                  : side === 0
                    ? facing(-ux, -uz)
                    : facing(ux, uz),
                e < 1 ? "advance" : "stand",
              );
            break;
          }
          const end = side === 0 ? attackLine : defendLine,
            to = side === 0 ? at(front + 34, 0) : at(front - 30, 0),
            path = pathOf(side === 0 ? [road, to] : [at(front - 30, aside), to]);
          column(i, side, path, k, null, end, side === 0 ? facing(-ux, -uz) : facing(ux, uz));
          break;
        }
        case "home": {
          const path = pathOf([road, at(reach + 30, 0), muster]);
          column(i, side, path, k, null, (j) => blockAt(j, muster), facing(-ux, -uz));
          break;
        }
        case "guard": {
          // (A guard across the road at the town's edge, facing out: one in two of its host.)
          if (i % 2) {
            hide(i, side);
            break;
          }
          const j = i >> 1,
            n = Math.ceil(each / 2),
            sg = spread(side);
          if (sg) {
            // (Past the line: squads behind what stands at its edge, their leaders up.)
            const p = sg.guard[j]!;
            push(
              i,
              side,
              p,
              facing(ux, uz),
              j % drawnSquad(sg.order[side].squad) ? "prone" : "stand",
            );
            break;
          }
          push(i, side, at(reach + 4, (j - (n - 1) / 2) * 2.4), facing(ux, uz), "stand");
          break;
        }
        case "drawn":
        case "engaged":
        case "holding": {
          const sp = spread(side);
          if (sp) {
            const face = side === 0 ? facing(-ux, -uz) : facing(ux, uz),
              place = sp.places[side][i]!,
              leads = i % drawnSquad(sp.order[side].squad) === 0;
            if (h.doing === "holding") {
              const p = fought ? foughtAt(i, side) : fieldNow(i, side, 0);
              push(i, side, p, fought ? foughtFacing(p, side) : face, leads ? "stand" : "prone");
              break;
            }
            if (fight?.stage !== "engaged") {
              // Drawn up: squads apart and down, their leaders up; those of its own gate come out first.
              const out = h.out ? smooth((fight?.k ?? 1) / 0.35) : 1,
                to = sp.field[side][i]!;
              push(
                i,
                side,
                { x: gate.x + (to.x - gate.x) * out, z: gate.z + (to.z - gate.z) * out },
                face,
                out < 1 ? "advance" : leads && !place.gun ? "stand" : "prone",
              );
              break;
            }
            // Engaged: nobody closes who can fire. Squads come on by bounds, the rest firing; those with
            // nothing to fire with come on the same way and close at the end.
            const e = fight.k,
              now = fieldNow(i, side, e),
              closes = sp.order[side].standOff === 0;
            if (falls(i, side, each, during) && e > fallsAt(i, side))
              push(i, side, foughtAt(i, side), face, "fallen");
            else
              push(
                i,
                side,
                now,
                face,
                now.rush
                  ? "advance"
                  : closes
                    ? now.g >= 1
                      ? "fight"
                      : "prone"
                    : place.gun || i % 3 === 2
                      ? "prone"
                      : "fire",
              );
            break;
          }
          const line = side === 0 ? attackLine(i) : defendLine(i),
            meet = meetOf(i, side),
            face = side === 0 ? facing(-ux, -uz) : facing(ux, uz);
          if (h.doing === "holding") {
            // (Where they won it: on the field, or about the walls they stormed.)
            const p = fought ? foughtAt(i, side) : meet;
            push(i, side, p, fought ? foughtFacing(p, side) : face, "stand");
            break;
          }
          if (fight?.stage !== "engaged") {
            // Drawn up: the defenders come out of the town to their line (its own guard, out of its gate).
            const out = h.out ? smooth((fight?.k ?? 1) / 0.35) : 1,
              p = { x: gate.x + (line.x - gate.x) * out, z: gate.z + (line.z - gate.z) * out };
            push(i, side, p, face, out < 1 ? "advance" : "stand");
            break;
          }
          // Engaged: closing from the lines, then fighting at the line between, falling.
          const e = fight.k,
            close = smooth(e / 0.25),
            p = { x: line.x + (meet.x - line.x) * close, z: line.z + (meet.z - line.z) * close };
          if (falls(i, side, each, during) && e > fallsAt(i, side))
            push(i, side, meet, face, "fallen");
          else push(i, side, p, face, close < 1 ? "advance" : "fight");
          break;
        }
        case "fleeing": {
          // The beaten fly from the line: behind the walls (a siege laid), or away past the town.
          // (Scattering across the open ground either hand, away from the victors.)
          const from = foughtAt(i, side),
            to = h.inward
              ? spread(side)
                ? apart!.about[1][i]!
                : ringAt(i, wallIn)
              : at(
                  front - 20 - unit(i, key + 9) * 60,
                  (unit(i, key) < 0.5 ? -1 : 1) * (reach + ROAD_OUT),
                ),
            e = smooth(k),
            p = { x: from.x + (to.x - from.x) * e, z: from.z + (to.z - from.z) * e };
          push(
            i,
            side,
            p,
            facing(to.x - from.x, to.z - from.z),
            "fall back",
            h.inward ? 1 : 1 - smooth((k - 0.7) / 0.3),
            !h.inward,
          );
          break;
        }
        case "entering": {
          // (Over its walls where they stormed them; else in at its gate.)
          const inner = at(Math.max(0, reach * 0.35), 0),
            path = pathOf(
              fought?.walls ? [foughtAt(i, side), inner] : [foughtAt(i, side), gate, inner],
            );
          column(
            i,
            side,
            path,
            k,
            (j) => foughtAt(j, side),
            (j) => blockAt(j, at(Math.max(0, reach * 0.35), 0)),
            facing(-ux, -uz),
          );
          break;
        }
        case "besieging":
        case "assaulting": {
          const sp = spread(side);
          if (sp) {
            // Past the line: down about it, their guns at it; then the storm, squads by its streets.
            const storm = h.doing === "assaulting" && fight?.stage === "engaged" ? fight.k : 0,
              rest = sp.about[0][i]!,
              settle = h.doing === "besieging" ? smooth(k) : 1,
              from = foughtAt(i, side),
              now = wallsNow(i, 0, storm),
              p =
                h.doing === "besieging" && settle < 1
                  ? {
                      x: from.x + (rest.x - from.x) * settle,
                      z: from.z + (rest.z - from.z) * settle,
                    }
                  : now,
              place = sp.places[0][i]!,
              leads = i % drawnSquad(sp.order[0].squad) === 0,
              toward = facing(-p.x, -p.z);
            if (
              h.doing === "assaulting" &&
              falls(i, side, each, during) &&
              storm > fallsAt(i, side)
            )
              push(i, side, wallsNow(i, 0, fallsAt(i, side)), toward, "fallen");
            else
              push(
                i,
                side,
                p,
                toward,
                now.rush
                  ? "advance"
                  : storm > 0
                    ? place.gun || i % 3 === 2
                      ? "prone"
                      : "fire"
                    : leads && !place.gun
                      ? "stand"
                      : "prone",
              );
            break;
          }
          // Camped about it, by their tents; storming its walls as the year ends.
          const storm = h.doing === "assaulting" && fight?.stage === "engaged" ? fight.k : 0,
            close = smooth(storm / 0.3),
            r = camp - 6 + (wallOut - (camp - 6)) * close,
            ring = ringAt(i, r),
            // (From the field won, the year's first weeks, to its place about the town.)
            settle = h.doing === "besieging" ? smooth(k) : 1,
            from = foughtAt(i, side),
            p = {
              x: from.x + (ring.x - from.x) * settle,
              z: from.z + (ring.z - from.z) * settle,
            };
          if (h.doing === "assaulting" && falls(i, side, each, during) && storm > fallsAt(i, side))
            push(i, side, ringAt(i, wallOut), facing(-p.x, -p.z), "fallen");
          else
            push(
              i,
              side,
              p,
              facing(-p.x, -p.z),
              h.doing === "assaulting" ? (close < 1 ? "advance" : "fight") : "stand",
              1,
              false,
            );
          break;
        }
        case "besieged": {
          // On its walls, facing out; fighting there as they are stormed.
          const storm = fight?.stage === "engaged" ? fight.k : 0,
            sp = spread(side);
          if (sp) {
            // Past the line: in its yards and behind its walls, firing at the storm as it comes.
            const q = sp.about[1][i]!,
              place = sp.places[1][i]!,
              leads = i % drawnSquad(sp.order[1].squad) === 0,
              out = facing(q.x, q.z);
            if (storm > 0 && falls(i, side, each, during) && storm > fallsAt(i, side))
              push(i, side, q, out, "fallen");
            else
              push(
                i,
                side,
                q,
                out,
                storm > 0
                  ? place.gun || i % 3 === 2
                    ? "prone"
                    : "fire"
                  : leads && !place.gun
                    ? "stand"
                    : "prone",
              );
            break;
          }
          const p = ringAt(i, wallIn);
          if (storm > 0 && falls(i, side, each, during) && storm > fallsAt(i, side))
            push(i, side, p, facing(p.x, p.z), "fallen", 1, false);
          else push(i, side, p, facing(p.x, p.z), storm > 0 ? "fight" : "stand", 1, false);
          break;
        }
      }
    }
    for (let i = 0; i < each; i++) if (!soldiers[side * 2 * each + i]) hide(i, side);
    // Past the line: a machine gun's team's guns where their gunners lie, and an armoured host's cars.
    const sp = spread(side);
    if (sp && h && !fighting) {
      sp.places[side].forEach((place, i) => {
        const q = soldiers[side * 2 * each + i]!;
        if (place.gun && q.size > 0.5 && (q.doing === "prone" || q.doing === "fire"))
          teamGuns.push({
            x: q.x + Math.sin(q.yaw) * GUN_SET,
            z: q.z + Math.cos(q.yaw) * GUN_SET,
            yaw: q.yaw,
            firing: fight?.stage === "engaged",
          });
      });
      if (
        war.sides[side].host?.mount === "armoured" &&
        ["drawn", "engaged", "holding", "guard", "besieging", "assaulting"].includes(h.doing)
      ) {
        const many = Math.max(1, Math.min(4, Math.round(each / 6))),
          e = fight?.stage === "engaged" ? fight.k : 0;
        for (let c = 0; c < many; c++) {
          // (Each with a squad of its host, ahead of it, by its way.)
          const i = Math.floor(((c + 0.5) / many) * each),
            q = soldiers[side * 2 * each + i],
            yaw = q ? q.yaw : 0,
            p = q && q.size > 0.5 ? q : foughtAt(i, side),
            knocked = fight?.stage === "engaged" ? (c % 3 === 2 ? smooth((e - 0.6) / 0.1) : 0) : 0;
          cars.push({
            id: c + side * 8,
            side,
            x: p.x + Math.sin(yaw) * CAR_AHEAD,
            y: 0,
            z: p.z + Math.cos(yaw) * CAR_AHEAD,
            yaw,
            turret: fight?.stage === "engaged" ? 0.2 * Math.sin(c * 2.1 + e * 9) : 0,
            recoil:
              fight?.stage === "engaged" ? Math.max(0, Math.sin(e * 90 + c * 2) - 0.8) * 5 : 0,
            knocked,
            burning: knocked,
          });
        }
      }
    }
  }
  // The besiegers' tents about the town, and their camp's fires (none while the battle before it
  // is fought in place: its hosts and their fires are its own layer's then).
  // (Past the ladders there is no such camp: its besiegers stand off, their guns further off, and shell it.)
  const shelled =
    !fighting &&
    !!apart?.shelling &&
    (war.siege || war.hosts.some((h) => h.doing === "besieging" || h.doing === "assaulting"));
  if (
    !fighting &&
    !apart?.shelling &&
    (war.siege || war.hosts.some((h) => h.doing === "besieging" || h.doing === "assaulting"))
  )
    for (let j = 0; j < TENTS; j++) {
      const a = way + ((j + 0.25) / TENTS) * 2 * Math.PI + (unit(key, 5) - 0.5) * 0.3,
        r = camp + 4 + unit(j, key) * 6;
      tents.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, yaw: a });
    }
  // The night before a battle before it: the hosts' fires behind their lines across the road.
  if (war.eve && !inPlace && war.hosts.some((h) => h.doing === "drawn"))
    for (let k = 0; k < 6; k++) {
      const across = (k - 2.5) * 9;
      // (Past the line, by a squad's place behind what it stands at: none in a row for the guns to read.)
      if (apart) {
        for (const side of [0, 1] as const) {
          const p = apart.field[side][Math.floor(((k + 0.5) / 6) * each)]!;
          nightFires.push({ x: p.x + (side ? -ux : ux) * 9, z: p.z + (side ? -uz : uz) * 9 });
        }
        continue;
      }
      nightFires.push(at(front + 34 + 12, across), at(front - 30 - 8, across + 4));
    }
  // The town shelled: some of what the shells have landed on alight (a land's fire, as a town stormed burns).
  if (shelled)
    for (let j = 0; j < 5; j++) {
      const p = apart!.shells[j];
      if (p) fires.push({ x: p.x, z: p.z, size: 0.45 + 0.3 * unit(j, key + 71) });
    }
  // A town stormed burns: its houses nearest the road it was stormed from, and about its gate.
  if (war.burning > 0) {
    const homes = [...plan.homes]
        .map((h) => ({ x: h.x, z: h.z, d: Math.hypot(h.x - gate.x, h.z - gate.z) }))
        .sort((a, b) => a.d - b.d),
      count = Math.max(2, Math.round(12 * war.burning));
    for (let j = 0; j < count; j++) {
      const home = homes[j],
        p =
          home ??
          at(reach * (0.3 + 0.6 * unit(j, key + 1)), (unit(j, key + 2) - 0.5) * reach * 1.2);
      fires.push({ x: p.x, z: p.z, size: war.burning * (0.6 + 0.4 * unit(j, key + 3)) });
    }
  }
  const middle = (s: 0 | 1): Flat | null =>
    sum[s]!.n ? { x: sum[s]!.x / sum[s]!.n, z: sum[s]!.z / sum[s]!.n } : null;
  const past: Partial<TownWarScene> = apart
    ? {
        teamGuns,
        cars,
        ...(shelled ? { battery: apart.battery, shells: apart.shells } : {}),
      }
    : {};
  return { soldiers, tents, fires, camp: nightFires, middles: [middle(0), middle(1)], ...past };
}
