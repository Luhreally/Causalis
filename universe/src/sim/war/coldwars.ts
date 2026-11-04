// Wars grown cold (Phase 63: deep time). A world of thousands of years has fought hundreds of
// thousands of battles, and nothing it does reads one that is decades past: a realm's memory of
// war reaches back thirty years, a battle's town tallies forty. Held as objects they were most of
// the heap; written out in every save, most of the save. So a war long over goes into a block:
// when each battle was, where, who won and how many fell in typed arrays by row, the rest in text
// by column (kernel/pack.ts), written once. And what the rules give again is not kept at all: the
// exchanges of a battle are the same draws over the same two hosts, its wounded the same rules over
// its dead, each proved the same as the battle's own before it is let go. Whatever a battle cannot
// be proved to give again stays in its block as it was.
//
// Nothing here is history: a battle reads back as it was fought, in or out of a block; but for the
// strengths its exchanges were fought at, kept only as near as gives the same exchanges again (how
// the two stand to each other, and about how great they were: nothing reads them once a battle is
// past being fought over).
import {
  Recent,
  Words,
  YEAR,
  codeOf,
  packList,
  refOfCode,
  unpackList,
  type Packed,
  type Ref,
} from "../../kernel/index.ts";
import {
  blowOf,
  fellColumns,
  fellOfColumns,
  resolveCombat,
  sideWounds,
  type CombatRecord,
  type CombatSide,
  type FellColumns,
  type LandFell,
} from "../../rules/index.ts";
import { fieldOf, type HostTerms } from "./fell.ts";
import type { Battle, CivilKind, War } from "./war.ts";

/** How many battles a block holds, at least (a war's battles stay together). */
export const COLD_BATTLES = 4096;

/** How many figures of the strengths a battle was fought at to try keeping, fewest first. */
const STRENGTH_FIGURES = [4, 5, 6, 9];
/** How many of the second's, where only how the two stand to each other moves the exchanges. */
const ROUGH_FIGURES = 2;

/** What the exchanges and the wounds read of a side's arms that a battle does not keep. */
export type Terms = readonly [
  shock: number,
  protection: number,
  range: number,
  fire: number,
  care: number,
];

export function termsOf(t: HostTerms): Terms {
  return [t.shock, t.protection, t.range, t.fire, t.care];
}

/** A battle's draws: the stream of its war, at the moment it was fought. */
export type BattleDraw = (key: number, t: number, round: number, side: number) => number;

/**
 * A side's lands in a block: cells, men sent, dead where the rules would not give them. After its
 * realm's first battle in the block the men are against what it last sent (menAgainst), and the
 * battles are taken in the order they were fought, near enough: by year, then as they stand. Where
 * the lands are those it sent then, no cells; where not, `a` says so of the men.
 */
type KeptSide = {
  readonly c?: readonly number[];
  readonly a?: 1;
  readonly s: readonly number[];
  readonly d?: readonly number[];
};

/** A side's lands in full. */
type FullSide = {
  readonly c: readonly number[];
  readonly s: readonly number[];
  readonly d?: readonly number[];
};

/**
 * A strength kept: as many figures as give the same exchanges again, each `[m, x]` being m × 10^x;
 * or `[v, 0]`, the strength as it was.
 */
export type KeptStrength = readonly [number, number];

/** What a battle keeps in its block, besides its row: only what the rules do not give again. */
type Rest = Omit<
  Battle,
  "year" | "land" | "won" | "fallen" | "event" | "combat" | "fell" | "fielded"
> & {
  readonly fielded?: readonly [number, number];
  /** Its exchanges, whole (those the rules would not give again). */
  readonly combat?: CombatRecord;
  /** The strengths they were fought at, and each side's terms by number in the block's list. */
  readonly p?: readonly [KeptStrength, KeptStrength];
  readonly x?: readonly [number, number];
  /** Its lands by column; or whole, where they would not read back so. */
  readonly k?: readonly [KeptSide, KeptSide];
  readonly fell?: readonly [readonly LandFell[], readonly LandFell[]];
};

/** A block's parts: the wars' rows and the battles' rows are read when a save loads, the rest when asked. */
type Block = {
  readonly wars: string;
  readonly head: string;
  readonly body: string;
  /** Its first battle's row, and how many. */
  readonly from: number;
  readonly rows: number;
};

type Body = {
  readonly size: number;
  readonly terms: readonly Terms[];
  readonly rest: readonly Rest[];
};

type WarRow = {
  /** Where it stands among all wars. */
  readonly at: number;
  readonly s: number;
  readonly a: string;
  readonly d: string;
  readonly y: number;
  readonly e: number;
  readonly p: number;
  /** Its fallen, where they are not its battles' added up. */
  readonly f?: readonly [number, number];
  readonly x: number;
  readonly q: number;
  readonly m?: string;
  readonly c?: CivilKind;
  /** Its battles. */
  readonly n: number;
};

type Head = {
  readonly y: readonly number[];
  readonly l: readonly number[];
  readonly w: readonly number[];
  readonly a: readonly number[];
  readonly b: readonly number[];
  readonly e: readonly number[];
};

function grownInt32(a: Int32Array, n: number) {
  const b = new Int32Array(n);
  b.set(a);
  return b;
}

function grownFloat64(a: Float64Array, n: number) {
  const b = new Float64Array(n);
  b.set(a);
  return b;
}

function isWhole(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && Math.abs(v) <= 0x7fffffff;
}

/** A war's number, if its ref is as the minter writes it. */
function warNumber(ref: string): number {
  const n = Number(ref.slice(ref.lastIndexOf(":") + 1));
  return `war:0:${n}` === ref && isWhole(n) ? n : -1;
}

/** Whether a war and every battle of it can be kept in rows. */
function fits(w: War): boolean {
  if (warNumber(w.ref) < 0 || w.ended === null || !isWhole(w.ended)) return false;
  if (!isWhole(w.declared) || !isWhole(w.prize)) return false;
  if (codeOf(w.event) <= 0 || (w.peace !== null && codeOf(w.peace) <= 0)) return false;
  for (const b of w.battles) {
    if (!isWhole(b.year) || !isWhole(b.land) || typeof b.won !== "boolean") return false;
    if (typeof b.fallen[0] !== "number" || typeof b.fallen[1] !== "number") return false;
    if (codeOf(b.event) <= 0) return false;
  }
  return true;
}

/** Whether two battles' exchanges went the same (whatever strengths they say they were fought at). */
function sameCombat(a: CombatRecord, b: CombatRecord): boolean {
  if (a.model !== b.model || a.broken !== b.broken || a.reason !== b.reason || a.rout !== b.rout)
    return false;
  if (a.frames.length !== b.frames.length) return false;
  for (let k = 0; k < a.frames.length; k++) {
    const p = a.frames[k]!,
      q = b.frames[k]!;
    if (p.at !== q.at || p.pressure !== q.pressure) return false;
    if (p.dead[0] !== q.dead[0] || p.dead[1] !== q.dead[1]) return false;
    if (p.morale[0] !== q.morale[0] || p.morale[1] !== q.morale[1]) return false;
  }
  return true;
}

function sameLands(a: readonly LandFell[], b: readonly LandFell[]): boolean {
  if (a.length !== b.length) return false;
  for (let k = 0; k < a.length; k++) {
    const p = a[k]!,
      q = b[k]!;
    if (p.length !== q.length) return false;
    for (let j = 0; j < 4; j++) if (p[j] !== q[j]) return false;
  }
  return true;
}

/** The exchanges of a battle, as the rules give them from what its block keeps. */
function fought(
  key: number,
  year: number,
  fielded: readonly [number, number],
  strengths: readonly [number, number],
  terms: readonly [Terms, Terms],
  bore: Battle["bore"],
  size: number,
  draw: BattleDraw,
): CombatRecord {
  const side = (k: 0 | 1): CombatSide => {
      const t = terms[k];
      return {
        fielded: fielded[k],
        power: strengths[k],
        shock: t[0],
        protection: t[1],
        range: t[2],
        fire: t[3],
        care: t[4],
        blow: blowOf(bore?.[k]?.[0]),
      };
    },
    // (History fights a year's battles at its end: the moment of the turn.)
    t = (year + 1) * YEAR;
  return resolveCombat([side(0), side(1)], size, (round, s) => draw(key, t, round, s)).combat;
}

/** The exchanges a battle still warm was fought in, from its strengths, as the rules give them. */
export function foughtAgain(
  war: War,
  b: Battle,
  power: readonly [number, number],
  terms: readonly [Terms, Terms],
  size: number,
  draw: BattleDraw,
): CombatRecord | null {
  const key = warNumber(war.ref);
  if (key < 0 || !b.fielded || b.bore === undefined) return null;
  return fought(key, b.year, b.fielded, power, terms, b.bore, size, draw);
}

/** Whether a battle still warm gives its own exchanges again. */
export function givesItsExchanges(
  war: War,
  b: Battle,
  terms: readonly [Terms, Terms],
  size: number,
  draw: BattleDraw,
): boolean {
  const combat = b.combat;
  if (!combat || combat.model !== 2) return false;
  const again = foughtAgain(war, b, combat.power, terms, size, draw);
  return (
    !!again &&
    sameCombat(again, combat) &&
    again.power[0] === combat.power[0] &&
    again.power[1] === combat.power[1]
  );
}

/**
 * The strengths a battle's exchanges may be kept at: as near as gives the same exchanges again, or as
 * they were (null: nothing gives them again). The exchanges read how the two stand to each other,
 * not how great they are, so the second is kept roughly and the first scaled with it, to as few
 * figures as it takes; or, failing that, each to as few. A battle fought is proved by this as it is
 * fought, one more exchange among the two it has just had, so that going cold later costs no year.
 */
export function strengthsThatGiveIt(
  war: War,
  b: Battle,
  terms: readonly [Terms, Terms],
  size: number,
  draw: BattleDraw,
): readonly [KeptStrength, KeptStrength] | null {
  const key = warNumber(war.ref),
    combat = b.combat,
    fielded = b.fielded;
  if (key < 0 || !combat || !fielded || combat.model !== 2 || b.bore === undefined) return null;
  const again = (power: readonly [number, number]): boolean =>
      sameCombat(fought(key, b.year, fielded, power, terms, b.bore, size, draw), combat),
    power = combat.power;
  if (power[0] > 0 && power[1] > 0) {
    const rough = strengthTo(power[1], ROUGH_FIGURES),
      second = strengthOf(rough);
    for (const figures of STRENGTH_FIGURES) {
      const a: KeptStrength = strengthTo((power[0] * second) / power[1], figures);
      if (again([strengthOf(a), second])) return [a, rough];
    }
  }
  for (const figures of STRENGTH_FIGURES) {
    const a: KeptStrength = strengthTo(power[0], figures),
      c: KeptStrength = strengthTo(power[1], figures);
    if (again([strengthOf(a), strengthOf(c)])) return [a, c];
  }
  return again(power)
    ? [
        [power[0], 0],
        [power[1], 0],
      ]
    : null;
}

/** The wounded and maimed of a side, as the rules give them. */
function woundsOf(
  k: 0 | 1,
  fallen: readonly [number, number],
  fielded: readonly [number, number],
  terms: readonly [Terms, Terms],
  bore: Battle["bore"],
  size: number,
): { wounded: number; maimed: number } {
  const foe = (1 - k) as 0 | 1;
  return sideWounds(fallen[k], fieldOf(fielded[k], fallen[k]), {
    blow: blowOf(bore?.[foe]?.[0]),
    shock: terms[foe][0],
    protection: terms[k][1],
    care: terms[k][4],
    size,
  });
}

/** A side's lands as a block keeps them, or null if they would not read back so. */
function keptSide(lands: readonly LandFell[], fallen: number, wounded: number): FullSide | null {
  if (lands.some((l) => l.length > 4)) return null;
  const c = fellColumns(lands, fallen),
    back = fellOfColumns(c, fallen, wounded);
  if (!sameLands(back, lands)) return null;
  return c.dead ? { c: c.cell, s: c.sent, d: c.dead } : { c: c.cell, s: c.sent };
}

/**
 * A side's men against what its realm last sent. A levy falls by the same share on every land, so
 * from one battle to the next each land sends what it sent then, scaled to all the side sends now
 * (some 60% of them to the man). A land it did not send then is as it is, and the last it did send
 * says how all the side's men changed: its own men follow from the rest.
 */
export function menAgainst(
  cells: readonly number[],
  men: readonly number[],
  was: ReadonlyMap<number, number>,
  wasAll: number,
): number[] {
  let all = 0,
    fresh = 0,
    before = 0,
    lastOf = -1;
  for (let k = 0; k < cells.length; k++) {
    const w = was.get(cells[k]!);
    all += men[k]!;
    if (w === undefined) fresh += men[k]!;
    else {
      before += w;
      lastOf = k;
    }
  }
  if (lastOf < 0) return [...men];
  const scale = before > 0 ? (all - fresh) / before : 1,
    out = men.map((n, k) => {
      const w = was.get(cells[k]!);
      return w === undefined ? n : n - Math.round(w * scale);
    });
  out[lastOf] = all - wasAll;
  return out;
}

/** A side's men, as menAgainst kept them. */
export function menOfKept(
  cells: readonly number[],
  kept: readonly number[],
  was: ReadonlyMap<number, number>,
  wasAll: number,
): number[] {
  let fresh = 0,
    before = 0,
    lastOf = -1;
  for (let k = 0; k < cells.length; k++) {
    const w = was.get(cells[k]!);
    if (w === undefined) fresh += kept[k]!;
    else {
      before += w;
      lastOf = k;
    }
  }
  if (lastOf < 0) return [...kept];
  const all = wasAll + kept[lastOf]!,
    scale = before > 0 ? (all - fresh) / before : 1;
  let left = all;
  const out = kept.map((n, k) => {
    if (k === lastOf) return 0;
    const w = was.get(cells[k]!),
      men = w === undefined ? n : n + Math.round(w * scale);
    left -= men;
    return men;
  });
  out[lastOf] = left;
  return out;
}

/** A side's lands against what its realm sent to its last battle in the block (or as they are). */
function againstLast(side: FullSide, last: FullSide | undefined): KeptSide {
  if (!last) return side;
  const was = sentBy(last),
    wasAll = sumOf(last.s),
    s = menAgainst(side.c, side.s, was, wasAll),
    back = menOfKept(side.c, s, was, wasAll);
  if (back.some((n, k) => n !== side.s[k])) return side;
  if (last.c.length === side.c.length && side.c.every((c, k) => c === last.c[k]))
    return side.d ? { s, d: side.d } : { s };
  return side.d ? { c: side.c, a: 1, s, d: side.d } : { c: side.c, a: 1, s };
}

/** What each land of a side sent. */
function sentBy(side: FullSide): Map<number, number> {
  const out = new Map<number, number>();
  for (let k = 0; k < side.c.length; k++) out.set(side.c[k]!, side.s[k]!);
  return out;
}

/** A side's lands, as againstLast kept them. */
function sideInFull(kept: KeptSide, last: FullSide | undefined): FullSide {
  if (kept.c && !kept.a) return kept as FullSide;
  const cells = kept.c ?? last!.c,
    s = menOfKept(cells, kept.s, sentBy(last!), sumOf(last!.s));
  return kept.d ? { c: cells, s, d: kept.d } : { c: cells, s };
}

/** A side's tallies by column in a save, against its realm's last (see fellAgainstLast). */
type KeptColumns = Omit<FellColumns, "cell"> & {
  /** Its lands, where they are not those of the last. */
  readonly cell?: readonly number[];
  /** Kept as they are (what would not come back to the man otherwise). */
  readonly whole?: 1;
};

/** What each land of a side sent, and what each of its towns did. */
function sentOfColumns(side: FellColumns): {
  men: Map<number, number>;
  towns: Map<number, readonly number[] | null>;
} {
  const men = new Map<number, number>(),
    towns = new Map<number, readonly number[] | null>();
  for (let k = 0; k < side.cell.length; k++) {
    men.set(side.cell[k]!, side.sent[k]!);
    towns.set(side.cell[k]!, side.towns[k]!);
  }
  return { men, towns };
}

/** Its men as a land's towns sent them: what they sent the last time, scaled with what the land sends now. */
function townsScaled(
  towns: readonly number[] | null,
  then: readonly number[] | null | undefined,
  scale: number | null,
  sign: 1 | -1,
): readonly number[] | null {
  if (!towns || !then || then.length !== towns.length || scale === null) return towns;
  return towns.map((n, q) => n + sign * Math.round(then[q]! * scale));
}

function columnsAgainst(now: FellColumns, last: FellColumns | undefined): KeptColumns {
  if (!last) return now;
  const { men, towns } = sentOfColumns(last),
    kept: KeptColumns = {
      ...(last.cell.length === now.cell.length && now.cell.every((c, k) => c === last.cell[k])
        ? {}
        : { cell: now.cell }),
      sent: menAgainst(now.cell, now.sent, men, sumOf(last.sent)),
      ...(now.dead ? { dead: now.dead } : {}),
      towns: now.towns.map((t, k) => {
        const was = men.get(now.cell[k]!);
        return townsScaled(t, towns.get(now.cell[k]!), was ? now.sent[k]! / was : null, -1);
      }),
    };
  return JSON.stringify(columnsInFull(kept, last)) === JSON.stringify(now)
    ? kept
    : { ...now, whole: 1 };
}

function columnsInFull(kept: KeptColumns, last: FellColumns | undefined): FellColumns {
  if (!last || kept.whole) {
    const { whole: _, ...full } = kept;
    return full as FellColumns;
  }
  const { men, towns } = sentOfColumns(last),
    cell = kept.cell ?? last.cell,
    sent = menOfKept(cell, kept.sent, men, sumOf(last.sent));
  return {
    cell,
    sent,
    ...(kept.dead ? { dead: kept.dead } : {}),
    towns: kept.towns.map((t, k) => {
      const was = men.get(cell[k]!);
      return townsScaled(t, towns.get(cell[k]!), was ? sent[k]! / was : null, 1);
    }),
  };
}

/** A war in a save, as much of it as its tallies by column ask. */
type WarmWar<B> = {
  readonly attacker: string;
  readonly defender: string;
  readonly battles: readonly B[];
};

/** Each battle's tallies by column gone through, by year and each realm's in turn. */
function acrossBattles<B extends { readonly year: number }, W extends WarmWar<B>>(
  wars: readonly W[],
  step: (side: FellColumns, last: FellColumns | undefined) => { out: unknown; full: FellColumns },
): W[] {
  const copies = wars.map((w) => ({ ...w, battles: [...w.battles] })),
    rows: { war: number; k: number; year: number }[] = [];
  copies.forEach((w, war) =>
    w.battles.forEach((b, k) => {
      if ((b as { fellColumns?: unknown }).fellColumns) rows.push({ war, k, year: b.year });
    }),
  );
  const last = new Map<string, FellColumns>();
  for (const { war, k } of rows.sort((p, q) => p.year - q.year)) {
    const w = copies[war]!,
      b = w.battles[k]! as B & { fellColumns: readonly [FellColumns, FellColumns] },
      one = step(b.fellColumns[0], last.get(w.attacker)),
      other = step(b.fellColumns[1], last.get(w.defender));
    last.set(w.attacker, one.full);
    last.set(w.defender, other.full);
    w.battles[k] = { ...b, fellColumns: [one.out, other.out] };
  }
  return copies as unknown as W[];
}

/**
 * Warm battles' tallies by column as a save keeps them: each side against its realm's last, as in a
 * block (menAgainst), and a land's towns against what they sent then, scaled with the land.
 */
export function fellAgainstLast<B extends { readonly year: number }, W extends WarmWar<B>>(
  wars: readonly W[],
): W[] {
  return acrossBattles<B, W>(wars, (side, last) => ({
    out: columnsAgainst(side, last),
    full: side,
  }));
}

/** Warm battles' tallies as fellAgainstLast kept them. */
export function fellFromLast<B extends { readonly year: number }, W extends WarmWar<B>>(
  wars: readonly W[],
): W[] {
  return acrossBattles<B, W>(wars, (side, last) => {
    const full = columnsInFull(side, last);
    return { out: full, full };
  });
}

/** A block's rows by the year of each, and within a year as they stand. */
function byYear(year: ArrayLike<number>, from: number, n: number): number[] {
  return Array.from({ length: n }, (_, k) => k).sort(
    (p, q) => year[from + p]! - year[from + q]! || p - q,
  );
}

/** A strength as it reads back. */
function strengthOf([m, x]: KeptStrength): number {
  return x === 0 ? m : Number(`${m}e${x}`);
}

/** A strength to so many figures, as a block keeps it. */
function strengthTo(v: number, figures: number): KeptStrength {
  if (!(v > 0) || !Number.isFinite(v)) return [v, 0];
  const [m, e] = v.toExponential(figures - 1).split("e") as [string, string],
    x = Number(e) - (figures - 1);
  return [Number(m.replace(".", "")), x];
}

function sideOfKept(k: FullSide, fallen: number, wounded: number): LandFell[] {
  const towns = k.c.map(() => null);
  return fellOfColumns(
    { cell: k.c, sent: k.s, ...(k.d ? { dead: k.d } : {}), towns },
    fallen,
    wounded,
  );
}

function sumOf(list: readonly number[]): number {
  let n = 0;
  for (const v of list) n += v;
  return n;
}

/** A battle gone cold, read through its row: the row's typed arrays, and its block when asked. */
class ColdBattle implements Battle {
  readonly #c: ColdWars;
  readonly #row: number;

  constructor(c: ColdWars, row: number) {
    this.#c = c;
    this.#row = row;
  }

  get year(): number {
    return this.#c.year[this.#row]!;
  }
  get land(): number {
    return this.#c.land[this.#row]!;
  }
  get won(): boolean {
    return this.#c.won[this.#row] === 1;
  }
  get fallen(): readonly [number, number] {
    return [this.#c.fallen[2 * this.#row]!, this.#c.fallen[2 * this.#row + 1]!];
  }
  get event(): Ref {
    return refOfCode(this.#c.event[this.#row]!);
  }
  get fielded(): Battle["fielded"] {
    return this.#c.whole(this.#row).fielded;
  }
  get seat(): Battle["seat"] {
    return this.#c.whole(this.#row).seat;
  }
  get power(): Battle["power"] {
    return this.#c.whole(this.#row).power;
  }
  get armed(): Battle["armed"] {
    return this.#c.whole(this.#row).armed;
  }
  get designs(): Battle["designs"] {
    return this.#c.whole(this.#row).designs;
  }
  get tip(): Battle["tip"] {
    return this.#c.whole(this.#row).tip;
  }
  get combat(): Battle["combat"] {
    return this.#c.combatOf(this.#row);
  }
  get wounded(): Battle["wounded"] {
    return this.#c.whole(this.#row).wounded;
  }
  get maimed(): Battle["maimed"] {
    return this.#c.whole(this.#row).maimed;
  }
  get bore(): Battle["bore"] {
    return this.#c.whole(this.#row).bore;
  }
  get fell(): Battle["fell"] {
    return this.#c.whole(this.#row).fell;
  }
  /** As JSON writes a battle. */
  toJSON(): Battle {
    return this.#c.plain(this.#row);
  }
}

/** A war gone cold: over long since, and never to change again. */
export class ColdWar implements War {
  readonly ref: Ref;
  readonly attacker: Ref;
  readonly defender: Ref;
  readonly declared: number;
  readonly prize: number;
  readonly ended: number;
  readonly embargo?: Ref;
  readonly civil?: CivilKind;
  /** Where it stands among all wars. */
  readonly at: number;
  /** Its battles' rows. */
  readonly from: number;
  readonly count: number;
  /** Its number, as its draws are keyed. */
  readonly number: number;
  readonly #c: ColdWars;
  readonly #event: number;
  readonly #peace: number;
  readonly #fa: number;
  readonly #fb: number;

  constructor(c: ColdWars, r: WarRow, from: number, fallen: readonly [number, number]) {
    this.#c = c;
    this.number = r.s;
    this.ref = `war:0:${r.s}` as Ref;
    this.attacker = r.a as Ref;
    this.defender = r.d as Ref;
    this.declared = r.y;
    this.prize = r.p;
    this.ended = r.x;
    this.at = r.at;
    this.from = from;
    this.count = r.n;
    this.#event = r.e;
    this.#peace = r.q;
    this.#fa = fallen[0];
    this.#fb = fallen[1];
    if (r.m !== undefined) this.embargo = r.m as Ref;
    if (r.c !== undefined) this.civil = r.c;
  }

  get event(): Ref {
    return refOfCode(this.#event);
  }
  get peace(): Ref | null {
    return this.#peace ? refOfCode(this.#peace) : null;
  }
  get fallen(): [number, number] {
    return [this.#fa, this.#fb];
  }
  /** Its battles, in the order they were fought: made as asked (read .length for free as count). */
  get battles(): Battle[] {
    const out = new Array<Battle>(this.count);
    for (let k = 0; k < this.count; k++) out[k] = new ColdBattle(this.#c, this.from + k);
    return out;
  }
  /** Its event's, its peace's and its battles' events' numbers, in the order a war pins them. */
  pins(into: number[]): void {
    into.push(this.#event);
    if (this.#peace) into.push(this.#peace);
    const events = this.#c.event;
    for (let r = this.from; r < this.from + this.count; r++) into.push(events[r]!);
  }
  /** As JSON writes a war. */
  toJSON(): War {
    return {
      ref: this.ref,
      attacker: this.attacker,
      defender: this.defender,
      declared: this.declared,
      event: this.event,
      prize: this.prize,
      battles: this.battles.map((b) => (b as ColdBattle).toJSON()),
      fallen: this.fallen,
      ended: this.ended,
      peace: this.peace,
      ...(this.embargo !== undefined ? { embargo: this.embargo } : {}),
      ...(this.civil !== undefined ? { civil: this.civil } : {}),
    };
  }
}

/** The wars gone cold, and their battles' rows. */
export class ColdWars {
  /** Battles. */
  n = 0;
  year = new Int32Array(1024);
  land = new Int32Array(1024);
  won = new Int32Array(1024);
  fallen = new Float64Array(2048);
  event = new Int32Array(1024);
  /** Which war of `wars` each row is of. */
  warOf = new Int32Array(1024);
  /** The wars, in the order they went cold. */
  wars: ColdWar[] = [];
  blocks: Block[] = [];
  words = new Words();
  /** A battle's draws (the world's: a store is not given one until it is installed). */
  draw: BattleDraw | null = null;
  private readonly bodies = new Recent<{
    body: Body;
    sides: (readonly [FullSide, FullSide] | undefined)[];
    whole: (Battle | undefined)[];
    combat: (CombatRecord | undefined)[];
  }>();

  private room(n: number): void {
    if (n <= this.year.length) return;
    const cap = Math.max(n, this.year.length * 2);
    this.year = grownInt32(this.year, cap);
    this.land = grownInt32(this.land, cap);
    this.won = grownInt32(this.won, cap);
    this.fallen = grownFloat64(this.fallen, 2 * cap);
    this.event = grownInt32(this.event, cap);
    this.warOf = grownInt32(this.warOf, cap);
  }

  /** Whether a war may go cold. */
  static fits(w: War): boolean {
    return fits(w);
  }

  /** The block a row is in. */
  private blockOf(row: number): number {
    const blocks = this.blocks;
    let lo = 0,
      hi = blocks.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1;
      if (blocks[mid]!.from <= row) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  private read(b: number) {
    return this.bodies.get(b, () => {
      const kept = JSON.parse(this.blocks[b]!.body) as {
          size: number;
          terms: Packed;
          rest: Packed;
        },
        rest = unpackList(kept.rest, this.words) as Rest[],
        from = this.blocks[b]!.from,
        design = new Map<string, unknown>();
      // (A battle's arms' designs, a 0 for its realm's last in the block.)
      rest.forEach((r, k) => {
        if (!r.designs) return;
        const w = this.wars[this.warOf[from + k]!]!,
          a = r.designs[0] === (0 as unknown) ? design.get(w.attacker) : r.designs[0],
          b = r.designs[1] === (0 as unknown) ? design.get(w.defender) : r.designs[1];
        design.set(w.attacker, a);
        design.set(w.defender, b);
        (r as { designs: unknown }).designs = [a, b];
      });
      // (Each side against its realm's last, so in the order they were kept.)
      const last = new Map<string, FullSide>(),
        sides = new Array<readonly [FullSide, FullSide] | undefined>(rest.length);
      for (const k of byYear(this.year, from, rest.length)) {
        const r = rest[k]!;
        if (!r.k) continue;
        const w = this.wars[this.warOf[from + k]!]!,
          one = sideInFull(r.k[0], last.get(w.attacker)),
          other = sideInFull(r.k[1], last.get(w.defender));
        last.set(w.attacker, one);
        last.set(w.defender, other);
        sides[k] = [one, other];
      }
      return {
        body: {
          size: kept.size,
          terms: unpackList(kept.terms, this.words) as Terms[],
          rest,
        },
        sides,
        whole: new Array<Battle | undefined>(rest.length),
        combat: new Array<CombatRecord | undefined>(rest.length),
      };
    });
  }

  /** A row's battle, all but its exchanges. */
  whole(row: number): Battle {
    const b = this.blockOf(row),
      local = row - this.blocks[b]!.from,
      part = this.read(b),
      known = part.whole[local];
    if (known) return known;
    const r = part.body.rest[local]!,
      fallen: [number, number] = [this.fallen[2 * row]!, this.fallen[2 * row + 1]!],
      fell = r.fell,
      kept = part.sides[local],
      // (Its men in the field, from its lands' where it does not keep them.)
      fielded: Battle["fielded"] =
        r.fielded ?? (kept ? [sumOf(kept[0].s), sumOf(kept[1].s)] : undefined),
      terms = r.x ? ([part.body.terms[r.x[0]]!, part.body.terms[r.x[1]]!] as const) : null,
      wounded: Battle["wounded"] = r.wounded,
      maimed: Battle["maimed"] = r.maimed;
    let hurt = wounded,
      torn = maimed;
    if (!hurt && terms && fielded) {
      const w0 = woundsOf(0, fallen, fielded, terms, r.bore, part.body.size),
        w1 = woundsOf(1, fallen, fielded, terms, r.bore, part.body.size);
      hurt = [w0.wounded, w1.wounded];
      torn = [w0.maimed, w1.maimed];
    }
    const out: { -readonly [K in keyof Battle]: Battle[K] } = {
      year: this.year[row]!,
      land: this.land[row]!,
      won: this.won[row] === 1,
      fallen,
      event: refOfCode(this.event[row]!),
    };
    if (fielded) out.fielded = fielded;
    if (r.seat !== undefined) out.seat = r.seat;
    if (r.power !== undefined) out.power = r.power;
    if (r.armed !== undefined) out.armed = r.armed;
    if (r.designs !== undefined) out.designs = r.designs;
    if (r.tip !== undefined) out.tip = r.tip;
    if (hurt !== undefined) out.wounded = hurt;
    if (torn !== undefined) out.maimed = torn;
    if (r.bore !== undefined) out.bore = r.bore;
    if (kept && hurt)
      out.fell = [sideOfKept(kept[0], fallen[0], hurt[0]), sideOfKept(kept[1], fallen[1], hurt[1])];
    else if (fell) out.fell = fell;
    return (part.whole[local] = out);
  }

  /** A row's exchanges. */
  combatOf(row: number): CombatRecord | undefined {
    const b = this.blockOf(row),
      local = row - this.blocks[b]!.from,
      part = this.read(b),
      known = part.combat[local];
    if (known) return known;
    const r = part.body.rest[local]!;
    if (!r.p || !r.x) return r.combat;
    const whole = this.whole(row),
      made = fought(
        this.wars[this.warOf[row]!]!.number,
        whole.year,
        whole.fielded!,
        [strengthOf(r.p[0]), strengthOf(r.p[1])],
        [part.body.terms[r.x[0]]!, part.body.terms[r.x[1]]!],
        r.bore,
        part.body.size,
        this.draw!,
      );
    return (part.combat[local] = made);
  }

  /** A row's battle as a plain record: as it was when it went cold. */
  plain(row: number): Battle {
    const whole = this.whole(row),
      combat = this.combatOf(row);
    // (In the order a battle is written, as JSON would give it.)
    const { wounded, maimed, bore, fell, ...first } = whole;
    return {
      ...first,
      ...(combat ? { combat } : {}),
      ...(wounded !== undefined ? { wounded } : {}),
      ...(maimed !== undefined ? { maimed } : {}),
      ...(bore !== undefined ? { bore } : {}),
      ...(fell !== undefined ? { fell } : {}),
    };
  }

  /** What a battle keeps in its block, the rest proved to come back. */
  private restOf(
    w: War,
    b: Battle,
    terms: readonly [Terms, Terms] | undefined,
    size: number,
    lists: {
      index: Map<string, number>;
      terms: Terms[];
      design: Map<string, unknown>;
    },
    draw: BattleDraw,
    proved: ReadonlyMap<string, readonly [KeptStrength, KeptStrength]>,
  ): Rest {
    const out: { -readonly [K in keyof Rest]: Rest[K] } = {};
    if (b.seat !== undefined) out.seat = b.seat;
    if (b.power !== undefined) out.power = b.power;
    if (b.armed !== undefined) out.armed = b.armed;
    if (b.designs !== undefined) {
      const d = b.designs,
        sameA = lists.design.has(w.attacker) && lists.design.get(w.attacker) === d[0],
        sameB = lists.design.has(w.defender) && lists.design.get(w.defender) === d[1];
      lists.design.set(w.attacker, d[0]);
      lists.design.set(w.defender, d[1]);
      out.designs = [sameA ? 0 : d[0], sameB ? 0 : d[1]] as unknown as Battle["designs"];
    }
    if (b.tip !== undefined) out.tip = b.tip;
    if (b.bore !== undefined) out.bore = b.bore;
    const termNumber = (t: Terms): number => {
      const text = t.join(",");
      let n = lists.index.get(text);
      if (n === undefined) {
        n = lists.terms.length;
        lists.index.set(text, n);
        lists.terms.push(t);
      }
      return n;
    };
    // The exchanges, if the rules give them again from what is kept: as proved when it was fought,
    // for a battle fought since this world was last loaded (and not fought over again since).
    const combat = b.combat,
      fielded = b.fielded,
      kept =
        combat && terms
          ? (proved.get(b.event) ?? strengthsThatGiveIt(w, b, terms, size, draw))
          : null,
      regenerated = kept !== null;
    if (kept) {
      out.p = kept;
      out.x = [termNumber(terms![0]), termNumber(terms![1])];
    } else if (combat) out.combat = combat;
    // The wounded, likewise (with the exchanges' terms: a battle that kept those).
    const wounded = b.wounded,
      maimed = b.maimed,
      healed =
        regenerated && wounded && maimed
          ? ([0, 1] as const).every((k) => {
              const w2 = woundsOf(k, b.fallen, fielded!, terms!, b.bore, size);
              return w2.wounded === wounded[k] && w2.maimed === maimed[k];
            })
          : false;
    if (!healed) {
      if (wounded !== undefined) out.wounded = wounded;
      if (maimed !== undefined) out.maimed = maimed;
    }
    // The lands, by column where they read back so, and the men in the field from them.
    const fell = b.fell;
    if (fell && wounded) {
      const k0 = keptSide(fell[0], b.fallen[0], wounded[0]),
        k1 = keptSide(fell[1], b.fallen[1], wounded[1]);
      if (k0 && k1) {
        // (Whole for now: freeze keeps each against its realm's last, once all are here.)
        out.k = [k0, k1];
        if (fielded && (sumOf(k0.s) !== fielded[0] || sumOf(k1.s) !== fielded[1]))
          out.fielded = fielded;
      } else {
        out.fell = fell;
        if (fielded) out.fielded = fielded;
      }
    } else {
      if (fell) out.fell = fell;
      if (fielded) out.fielded = fielded;
    }
    return out;
  }

  /**
   * The wars go cold, as one block (they are over, and every battle of theirs past reading by
   * anything a year does). Returns each one's cold self.
   */
  freeze(
    wars: readonly { readonly war: War; readonly at: number }[],
    termsOfBattle: (event: Ref) => readonly [Terms, Terms] | undefined,
    size: number,
    proved: ReadonlyMap<string, readonly [KeptStrength, KeptStrength]>,
  ): ColdWar[] {
    const draw = this.draw!,
      words = this.words,
      rows: WarRow[] = [],
      lists = {
        index: new Map<string, number>(),
        terms: [] as Terms[],
        design: new Map<string, unknown>(),
      },
      rest: Rest[] = [],
      warOfRow: War[] = [],
      y: number[] = [],
      l: number[] = [],
      w: number[] = [],
      a: number[] = [],
      b: number[] = [],
      e: number[] = [];
    for (const { war, at } of wars) {
      let fa = 0,
        fb = 0;
      for (const battle of war.battles) {
        fa += battle.fallen[0];
        fb += battle.fallen[1];
      }
      rows.push({
        at,
        s: warNumber(war.ref),
        a: war.attacker,
        d: war.defender,
        y: war.declared,
        e: codeOf(war.event),
        p: war.prize,
        ...(fa === war.fallen[0] && fb === war.fallen[1] ? {} : { f: war.fallen }),
        x: war.ended!,
        q: war.peace ? codeOf(war.peace) : 0,
        ...(war.embargo !== undefined ? { m: war.embargo } : {}),
        ...(war.civil !== undefined ? { c: war.civil } : {}),
        n: war.battles.length,
      });
      for (const battle of war.battles) {
        y.push(battle.year);
        l.push(battle.land);
        w.push(battle.won ? 1 : 0);
        a.push(battle.fallen[0]);
        b.push(battle.fallen[1]);
        e.push(codeOf(battle.event));
        rest.push(this.restOf(war, battle, termsOfBattle(battle.event), size, lists, draw, proved));
        warOfRow.push(war);
      }
    }
    // Each side against its realm's last, in the order they were fought.
    const last = new Map<string, FullSide>();
    for (const k of byYear(y, 0, y.length)) {
      const r = rest[k] as { k?: readonly [KeptSide, KeptSide] };
      if (!r.k) continue;
      const war = warOfRow[k]!,
        one = r.k[0] as FullSide,
        other = r.k[1] as FullSide;
      r.k = [againstLast(one, last.get(war.attacker)), againstLast(other, last.get(war.defender))];
      last.set(war.attacker, one);
      last.set(war.defender, other);
    }
    const block: Block = {
      wars: JSON.stringify(packList(rows, words)),
      head: JSON.stringify(packList([{ y, l, w, a, b, e }], words)),
      body: JSON.stringify({
        size,
        terms: packList(lists.terms, words),
        rest: packList(rest, words),
      }),
      from: this.n,
      rows: y.length,
    };
    this.blocks.push(block);
    return this.enter(rows, { y, l, w, a, b, e });
  }

  /** A block's rows join the typed arrays, and its wars their cold selves. */
  private enter(rows: readonly WarRow[], h: Head): ColdWar[] {
    const out: ColdWar[] = [],
      n = h.y.length;
    this.room(this.n + n);
    for (let k = 0; k < n; k++) {
      const r = this.n + k;
      this.year[r] = h.y[k]!;
      this.land[r] = h.l[k]!;
      this.won[r] = h.w[k]!;
      this.fallen[2 * r] = h.a[k]!;
      this.fallen[2 * r + 1] = h.b[k]!;
      this.event[r] = h.e[k]!;
    }
    let row = this.n;
    for (const w of rows) {
      let fa = 0,
        fb = 0;
      for (let k = 0; k < w.n; k++) {
        fa += this.fallen[2 * (row + k)]!;
        fb += this.fallen[2 * (row + k) + 1]!;
      }
      const cold = new ColdWar(this, w, row, w.f ?? [fa, fb]),
        number = this.wars.length;
      for (let k = 0; k < w.n; k++) this.warOf[row + k] = number;
      this.wars.push(cold);
      out.push(cold);
      row += w.n;
    }
    this.n = row;
    return out;
  }

  /** The wars with a battle fought in the years [from, to). */
  warsIn(from: number, to: number): Set<ColdWar> {
    const out = new Set<ColdWar>(),
      year = this.year;
    for (let r = 0; r < this.n; r++)
      if (year[r]! >= from && year[r]! < to) out.add(this.wars[this.warOf[r]!]!);
    return out;
  }

  /** A battle by its event: its war, and where it stands in it. */
  battleBy(event: string): { war: ColdWar; k: number; b: Battle } | null {
    const code = codeOf(event);
    if (code <= 0 || !this.n) return null;
    const row = this.event.subarray(0, this.n).indexOf(code);
    if (row < 0) return null;
    const war = this.wars[this.warOf[row]!]!;
    return { war, k: row - war.from, b: new ColdBattle(this, row) };
  }

  save(): unknown {
    return {
      blocks: this.blocks.map((b) => [b.wars, b.head, b.body]),
      words: this.words.list,
    };
  }

  /** What a save kept. Returns the cold wars. */
  load(state: unknown): ColdWar[] {
    const s = state as {
      blocks: readonly (readonly [string, string, string])[];
      words: readonly string[];
    };
    this.words = new Words(s.words);
    this.blocks = [];
    this.wars = [];
    this.bodies.clear();
    this.n = 0;
    for (const [wars, head, body] of s.blocks) {
      const rows = unpackList(JSON.parse(wars) as Packed, this.words) as WarRow[],
        h = unpackList(JSON.parse(head) as Packed, this.words)[0] as Head;
      this.blocks.push({ wars, head, body, from: this.n, rows: h.y.length });
      this.enter(rows, h);
    }
    return this.wars;
  }
}
