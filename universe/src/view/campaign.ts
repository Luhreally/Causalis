// A war watched unfolding on the globe (Phase 38 M193, asked for 2026-10-24: "i still cant see
// warfare and like wars like theres no coherent animations and battle between them"): the war
// played again on a clock of its own, a year in a few seconds — its host marching while it is
// fought, each of its battles flaring where it was fought as its turn comes (those of one year
// one after another through it), the fallen of each side mounting, the lands taken marked, the
// seat besieged — and told as it goes. Pure: what the war is at a moment of it.
import type { Campaign, CampaignBattle, WarAge, WarsMap } from "../bridge/index.ts";

/** How many of the war's years pass in a second of ours at its own pace. */
export const WAR_YEARS_A_SECOND = 0.4;
/** The war's speeds: held, half, its own, twice and four times. */
export const WAR_SPEEDS = [0, 0.5, 1, 2, 4] as const;

/** The years the war is watched over: from its declaring to a year past its end (or now). */
export function campaignSpan(c: Campaign): { from: number; to: number } {
  return { from: c.declared, to: Math.max(c.declared + 1, (c.ended ?? c.now) + 1) };
}

/** When each battle is seen fought: in its year, those of one year one after another through it. */
export function foughtAt(c: Campaign): number[] {
  return c.battles.map((b, i) => {
    const same = c.battles.filter((x) => x.year === b.year),
      k = c.battles.slice(0, i).filter((x) => x.year === b.year).length;
    return b.year + (k + 0.5) / same.length;
  });
}

/** A mark over the globe: its spot, its words, what it is (for its key). */
export type CampaignMark = { readonly key: string; readonly spot: number; readonly text: string };

export type CampaignNow = {
  readonly year: number;
  /** The war as the globe draws it then: its host marching while it is fought, its battles of that year and the two before. */
  readonly map: WarsMap;
  /** Its battles fought by then, the latest last. */
  readonly fought: readonly CampaignBattle[];
  /** The battles each side had won (the attacker's victories, the defender's holds), and the fallen of each. */
  readonly won: readonly [number, number];
  readonly fallen: readonly [number, number];
  /** The lands taken by then (a seat stormed among them). */
  readonly taken: readonly CampaignBattle[];
  /** Over the globe: each battle lately fought and how many fell, each land taken. */
  readonly marks: readonly CampaignMark[];
  /**
   * How far its host is along its way then (0 … 1: the map's war goes from where it last fought,
   * or set out, to where it fights next); null once the war is over.
   */
  readonly march: number | null;
  /** Whether the war is over by then. */
  readonly over: boolean;
  /** What is told then. */
  readonly words: string;
};

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const count = (n: number) => n.toLocaleString("en-US");

/** What came of a battle, in words. */
export function outcomeWords(c: Campaign, b: CampaignBattle): string {
  const a = c.attacker.name,
    d = c.defender.name;
  switch (b.outcome) {
    case "held":
      return `${d} held`;
    case "field":
      return `${a} won the field`;
    case "siege":
      return `${a} laid siege to ${d}'s seat`;
    case "taken":
      return `${a} took ${b.land}`;
    default:
      return `${a} stormed ${d}'s seat`;
  }
}

/**
 * Where a war's host is at `y`: on its way from where it last fought (or set out) to where it
 * fights next, as far along as the time between them has gone — there a little before its battle
 * is fought; standing where it fought once it fights there again, and after its last. Held there,
 * it is thrown back and comes on again (after its last, it falls back). A war with no battles
 * marches on what it wants over its whole course.
 */
function legAt(
  c: Campaign,
  y: number,
  at: readonly number[],
  span: { from: number; to: number },
): { from: number; to: number; k: number } {
  const stops = c.battles.flatMap((b, i) =>
      b.spot >= 0 ? [{ spot: b.spot, at: at[i]!, held: b.outcome === "held" }] : [],
    ),
    n = stops.findIndex((x) => x.at > y),
    done = n < 0 ? stops : stops.slice(0, n),
    last = done.at(-1),
    to = n >= 0 ? stops[n]!.spot : (last?.spot ?? c.to);
  let from = c.from;
  for (let i = done.length - 1; i >= 0; i--)
    if (done[i]!.spot !== to) {
      from = done[i]!.spot;
      break;
    }
  const toward = (t0: number, t1: number) => {
    const k = Math.max(0, Math.min(1, (y - t0) / Math.max(1e-6, (t1 - t0) * 0.85)));
    return k * k * (3 - 2 * k);
  };
  if (!stops.length) return { from, to, k: toward(span.from, span.to) };
  if (n < 0 || last?.spot === to) {
    if (!last?.held) return { from, to, k: 1 };
    const f = Math.max(0, Math.min(1, (y - last.at) / (n < 0 ? 0.8 : stops[n]!.at - last.at)));
    return { from, to, k: n < 0 ? 1 - 0.4 * f * f * (3 - 2 * f) : 1 - 0.3 * Math.sin(Math.PI * f) };
  }
  return { from, to, k: toward(last ? last.at : span.from, stops[n]!.at) };
}

/** The war at `year` (of the world's, fractional: those of one year come one after another). */
export function campaignAt(
  c: Campaign,
  year: number,
  at: readonly number[] = foughtAt(c),
): CampaignNow {
  const span = campaignSpan(c),
    y = Math.max(span.from, Math.min(span.to, year)),
    whole = Math.floor(y),
    fought = c.battles.filter((_, i) => at[i]! <= y),
    latest = fought.at(-1) ?? null,
    over = c.ended !== null && y >= c.ended + 0.999,
    won: [number, number] = [0, 0],
    fallen: [number, number] = [0, 0];
  for (const b of fought) {
    won[b.won ? 0 : 1]++;
    fallen[0] += b.fallen[0];
    fallen[1] += b.fallen[1];
  }
  const taken = fought.filter((b) => b.outcome === "taken" || b.outcome === "stormed"),
    // (A seat besieged: a victory at it, not stormed since, the war still fought.)
    siege = over
      ? null
      : ([...fought]
          .reverse()
          .find(
            (b) =>
              b.outcome === "siege" &&
              !fought.some((x) => x.cell === b.cell && x.outcome === "stormed" && x.year >= b.year),
          ) ?? null);
  const leg = legAt(c, y, at, span),
    map: WarsMap = {
      year: whole,
      garrisons: [],
      wars: [
        {
          ref: c.ref,
          attacker: c.attacker,
          defender: c.defender,
          from: leg.from,
          to: leg.to,
          declared: c.declared,
          ended: over ? c.ended : null,
          siege: siege && siege.spot >= 0 ? siege.spot : null,
          battles: fought
            .filter((b) => b.spot >= 0)
            .map((b) => ({
              spot: b.spot,
              year: b.year,
              won: b.won,
              fallen: b.fallen[0] + b.fallen[1],
              event: b.event,
            })),
        },
      ],
    };
  const marks: CampaignMark[] = [
    ...fought
      .filter((b) => b.spot >= 0 && whole - b.year <= 1)
      .map((b) => ({
        key: `battle:${b.event}`,
        spot: b.spot,
        text: `⚔️ ${count(b.fallen[0] + b.fallen[1])} fell · ${b.year}`,
      })),
    ...taken
      .filter((b) => b.spot >= 0)
      .map((b) => ({
        key: `taken:${b.event}`,
        spot: b.spot,
        text: `🏴 ${cap(b.outcome === "stormed" ? `${c.defender.name}'s seat` : b.land)} taken · ${b.year}`,
      })),
  ];
  const words = over
    ? `Year ${c.ended}: the war ends — ${
        taken.length
          ? `${taken.length === 1 ? "one land" : `${taken.length} lands`} taken`
          : "nothing taken"
      }, ${count(fallen[0] + fallen[1])} fallen`
    : latest
      ? `Year ${latest.year}: the battle at ${latest.land} — ${outcomeWords(c, latest)}; ${count(
          latest.fallen[0] + latest.fallen[1],
        )} fell`
      : `Year ${c.declared}: ${cap(c.attacker.name)} march on ${c.defender.name}, for ${c.prize}`;
  return {
    year: y,
    map,
    fought,
    won,
    fallen,
    taken,
    marks,
    march: over ? null : leg.k,
    over,
    words,
  };
}

// —— The wars of an age (M194) ——————————————————————————————————————————————————

/** How many of an age's years pass in a second of ours at its own pace. */
export const WAR_AGE_YEARS_A_SECOND = 2;
/** How many of an age's battles of a year are marked over the globe, the bloodiest. */
const WAR_AGE_MARKS = 8;

/**
 * The years an age's wars are watched over: from its first year (or its first war's declaring, if
 * later: no years of peace to wait through first) to a year past its last.
 */
export function warAgeSpan(a: WarAge): { from: number; to: number } {
  const first = a.wars.reduce((n, c) => Math.min(n, c.declared), Infinity);
  if (!a.wars.length) return { from: a.from, to: a.to + 1 };
  return { from: Math.max(a.from, Math.min(a.to, first)), to: a.to + 1 };
}

export type WarAgeNow = {
  readonly year: number;
  /** Every war of the age under way then (or lately ended), as the globe draws them. */
  readonly map: WarsMap;
  /** How far along its way each one's host is (by the war's ref). */
  readonly marching: ReadonlyMap<string, number>;
  /** Over the globe: the bloodiest battles of the year, and the lands taken in it. */
  readonly marks: readonly CampaignMark[];
  /** How many of its wars are under way then; its battles fought since its first year, their fallen. */
  readonly under: number;
  readonly fought: number;
  readonly fallen: number;
  /** Its latest battle by then, and the war it was of (null: none yet). */
  readonly latest: { readonly war: Campaign; readonly battle: CampaignBattle } | null;
  readonly words: string;
};

/**
 * The wars of an age at `year` (M194): each war under way as it is then (its host on its way, its
 * battles flaring in their turns, campaignAt), the year's bloodiest battles and the lands taken in
 * it marked, the age's battles and fallen tallied, its latest battle told. `at`: when each war's
 * battles are seen fought (foughtAt), kept between frames.
 */
export function warAgeAt(
  a: WarAge,
  year: number,
  at: readonly (readonly number[])[] = a.wars.map((c) => foughtAt(c)),
): WarAgeNow {
  const span = warAgeSpan(a),
    y = Math.max(span.from, Math.min(span.to, year)),
    whole = Math.floor(y),
    wars: WarsMap["wars"][number][] = [],
    marching = new Map<string, number>(),
    marked: { mark: CampaignMark; fell: number }[] = [];
  let under = 0,
    fought = 0,
    fallen = 0,
    latest: WarAgeNow["latest"] = null,
    latestAt = -Infinity;
  for (let i = 0; i < a.wars.length; i++) {
    const c = a.wars[i]!,
      t = at[i]!;
    for (let j = 0; j < c.battles.length; j++) {
      const b = c.battles[j]!,
        fell = b.fallen[0] + b.fallen[1];
      if (t[j]! > y || b.year < a.from) continue;
      fought++;
      fallen += fell;
      if (t[j]! > latestAt) {
        latestAt = t[j]!;
        latest = { war: c, battle: b };
      }
      if (b.spot < 0 || b.year !== whole) continue;
      marked.push({
        mark: {
          key: `battle:${b.event}`,
          spot: b.spot,
          text: `⚔️ ${count(fell)} fell · ${b.year}`,
        },
        fell,
      });
      if (b.outcome === "taken" || b.outcome === "stormed")
        marked.push({
          mark: {
            key: `taken:${b.event}`,
            spot: b.spot,
            text: `🏴 ${cap(b.outcome === "stormed" ? `${c.defender.name}'s seat` : b.land)} taken · ${b.year}`,
          },
          fell,
        });
    }
    if (y < c.declared || y >= campaignSpan(c).to) continue;
    const n = campaignAt(c, y, t);
    if (!n.over) under++;
    wars.push(n.map.wars[0]!);
    if (n.march !== null) marching.set(c.ref, n.march);
  }
  const marks = marked
      .sort((p, q) => q.fell - p.fell)
      .slice(0, WAR_AGE_MARKS)
      .map((m) => m.mark),
    last = latest as WarAgeNow["latest"],
    words = last
      ? `Year ${last.battle.year}: the battle at ${last.battle.land} — ${outcomeWords(
          last.war,
          last.battle,
        )}; ${count(last.battle.fallen[0] + last.battle.fallen[1])} fell`
      : `Year ${whole}: ${
          under ? `${under === 1 ? "a war" : `${under} wars`} under way` : "the world at peace"
        }`;
  return {
    year: y,
    map: { year: whole, garrisons: [], wars },
    marching,
    marks,
    under,
    fought,
    fallen,
    latest: last,
    words,
  };
}
