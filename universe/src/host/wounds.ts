// A town's wounded (Phase 55 M226, M229; asked for 2026-10-26: "Wounds and lost limbs shown on the
// person and told on their page. Healers tending the wounded."): every wound history dealt one of
// its people — at a battle its men were sent to (the roster's fates, M225; a met man's own), in a
// fire, a quake or a fire from the sky on it (the roster's strikes; this year's by the roster's own
// rule) — where on them by their body's own members, what came of it, who tended it, and its days:
// away with the levy till its column came home, abed, up with it bound, mended. Laid over a town's
// plan (village.plan) and told on their pages. Drawn from hashes of who and which, never from the
// world's streams, and read from the record: looking moves nothing.
import {
  DAY,
  YEAR,
  finish,
  hashString,
  mix,
  yearOfMoment,
  type Ref,
  type World,
} from "../kernel/index.ts";
import {
  CUTS_OFF,
  STRIKE_HURT,
  anatomyOf,
  blowOf,
  borneHome,
  healDays,
  maimedShare,
  tendedBy,
  unpackTowns,
  woundCare,
  woundOf,
  type Anatomy,
  type Blow,
} from "../rules/index.ts";
import { loreOf, populationContext, townsOf, type Battle, type War } from "../sim/index.ts";
import { observer, type Person } from "../causal/index.ts";
import {
  parseTownsfolkRef,
  type Away,
  type VillagePlan,
  type Wound,
  type WoundTended,
} from "../bridge/index.ts";
import { battleOf, battleWords, battlesOfYear, burialOf, type Burial } from "./burials.ts";
import { LINE, ROSTER_YEARS, townRoster, type Holder, type Roster } from "./roster.ts";
import { strikesOn } from "./town.ts";
import { healerOf } from "./village.ts";
import { hostPartWords } from "./chain.ts";
import { landTitle } from "./inspect/names.ts";

const HOUR = 3_600;
/** Days from a battle's turn till its men are home: fought on their own land, on a land beside it, further off. */
export const HOME_DAYS: Readonly<Record<Burial, number>> = { here: 0, home: 3, field: 9 };
/** The hour a column comes in from the road (h); the hour a battle is fought, its watched day's (Phase 40). */
export const HOME_HOUR = 16;
export const BATTLE_HOUR = 8;
type StrikeKind = "fire" | "quake" | "meteor";
/** What a strike's blow is: a fire's and a fire from the sky's a burn, a quake's a crushing. */
export const STRIKE_BLOW: Readonly<Record<StrikeKind, Blow>> = {
  fire: "fire",
  quake: "crush",
  meteor: "fire",
};
const STRIKE_WHERE: Readonly<Record<StrikeKind, string>> = {
  fire: "the fire in",
  quake: "the quake at",
  meteor: "the fire from the sky on",
};
/** What wounds of an arm not told by its worked stuff: one of it. */
const ONE_OF: Readonly<Record<string, string>> = {
  bow: "an arrow",
  "horn-bow": "an arrow",
  musket: "a musket ball",
  rifle: "a rifle bullet",
  repeater: "a rifle bullet",
  autoloader: "a bullet",
  automatic: "machine-gun fire",
  claws: "a claw",
  mandibles: "a mandible",
  tusks: "a tusk",
  grapple: "a grasping arm",
  "shell-darts": "a dart of shell",
};
/** The arms told by their worked stuff, as the host's words tell them ("bronze axes": "a bronze axe"). */
const WORKED: ReadonlySet<string> = new Set(["club", "spear", "axe", "sword"]);
/** A town's wounded told at most (the gate's and the pages' lists). */
const WOUNDED_MOST = 400;

const u = (seed: number, n: number) => finish(mix(seed, n), 13) / 4294967296;

/** A town as its wounds are read. */
type Town = {
  readonly ref: string;
  readonly name: string;
  readonly cell: number;
  readonly population: number;
};
/** A fate at a battle that came home with a wound. */
type Hurt = {
  readonly event: string;
  readonly side: 0 | 1;
  readonly year: number;
  readonly fate: "hurt" | "maimed";
};
/** A strike as a wound is dealt by it. */
type Strike = { readonly event: string; readonly kind: StrikeKind; readonly at: number };
/** This year's strikes on a town (the roster folds them from the next): its lines they killed and when, those they hurt. */
type ThisYear = {
  readonly gone: ReadonlyMap<number, number>;
  readonly hurt: ReadonlyMap<number, readonly Strike[]>;
};

/** One reading of a town's wounds: its people's body; by year, its care, healer and hospital; by battle and side, the arm. */
type Reader = {
  readonly world: World;
  readonly town: Town;
  readonly body: Anatomy;
  readonly care: Map<string, number>;
  readonly healer: Map<number, string | null>;
  readonly hospital: Map<number, boolean>;
  readonly arms: Map<string, string | null>;
};
function readerOf(world: World, town: Town): Reader {
  return {
    world,
    town,
    body: anatomyOf(populationContext(world).generated.life.people?.body ?? null),
    care: new Map(),
    healer: new Map(),
    hospital: new Map(),
    arms: new Map(),
  };
}

/** The care known in a land by a year (rules/wounds.ts woundCare). */
function careOf(r: Reader, cell: number, year: number): number {
  const key = `${cell}:${year}`;
  let c = r.care.get(key);
  if (c === undefined) {
    const lore = loreOf(r.world);
    c = woundCare((id) => (lore.get(cell, id)?.year ?? Infinity) <= year);
    r.care.set(key, c);
  }
  return c;
}
/** Its healer in a year, in words ("by Sairis's healer, Mira Vell"); null: it had none. */
function healerWords(r: Reader, year: number): string | null {
  if (!r.healer.has(year)) {
    const h = r.town.ref ? healerOf(r.world, r.town, year) : null;
    r.healer.set(year, h ? `by ${r.town.name}'s healer, ${h.name}` : null);
  }
  return r.healer.get(year) ?? null;
}
/** Whether a town kept a hospital standing in a year (its pages too). */
export function hospitalOf(world: World, town: string, year: number): boolean {
  return !!townsOf(world)
    .get(town as Ref)
    ?.civics.some(
      (c) => c.kind === "hospital" && c.end <= year && (c.fell === null || c.fell > year),
    );
}
/** Whether it kept a hospital standing in a year. */
function hospitalIn(r: Reader, year: number): boolean {
  let h = r.hospital.get(year);
  if (h === undefined) {
    h = hospitalOf(r.world, r.town.ref, year);
    r.hospital.set(year, h);
  }
  return h;
}
/** What the foe bore that wounded, one of it ("a bronze axe", "an arrow"); null: no arm told. */
function armWords(r: Reader, war: War, b: Battle, foe: 0 | 1): string | null {
  const key = `${b.event}|${foe}`;
  if (r.arms.has(key)) return r.arms.get(key) ?? null;
  const bore = b.bore?.[foe] ?? null;
  let words: string | null = null;
  if (bore && Object.hasOwn(ONE_OF, bore[0])) words = ONE_OF[bore[0]]!;
  else if (bore && WORKED.has(bore[0])) {
    const realm = foe === 0 ? war.attacker : war.defender,
      w = hostPartWords(r.world, realm, { role: "arm", id: bore[0], material: bore[1] }).replace(
        /s$/,
        "",
      );
    words = `${/^[aeiou]/i.test(w) ? "an" : "a"} ${w}`;
  }
  r.arms.set(key, words);
  return words;
}
/** Who tended it, in words that follow "tended" or "bound". */
function byWords(r: Reader, tended: WoundTended, healer: string | null): string {
  return tended === "hospital"
    ? `at the hospital of ${r.town.name}`
    : tended === "healer"
      ? (healer ?? "by the healer")
      : tended === "household"
        ? "at home"
        : "by kin";
}

/** A wound one of the town's people came home with from a battle, sent from `cell` (null: no record of the battle). */
function battleWound(
  r: Reader,
  ref: string,
  f: Hurt,
  cell: number,
  household: boolean,
): Wound | null {
  const fought = battleOf(r.world, f.event);
  if (!fought) return null;
  const { war, b } = fought,
    foe = f.side === 0 ? 1 : 0,
    arm = b.bore?.[foe]?.[0] ?? null,
    blow = blowOf(arm),
    cuts = arm !== null && CUTS_OFF.has(arm),
    year = f.year + 1,
    care = careOf(r, cell, year),
    key = hashString(`wound ${ref} ${f.event}`),
    w = woundOf(r.body, f.fate, blow, cuts, care, u(key, 1), u(key, 2), u(key, 3)),
    ours = cell === r.town.cell,
    healer = ours ? healerWords(r, year) : null,
    tended = tendedBy(ours && !!r.town.ref && hospitalIn(r, year), healer !== null, household),
    days = healDays(w.outcome, w.member, blow, care, tended),
    at = year * 365 * DAY + BATTLE_HOUR * HOUR,
    home = (year * 365 + HOME_DAYS[burialOf(r.world, b.land, cell)]) * DAY + HOME_HOUR * HOUR,
    up = at + days.abed * DAY;
  return {
    event: f.event,
    from: "battle",
    year: f.year,
    where: battleWords(r.world, b.land),
    blow,
    arm: armWords(r, war, b, foe),
    member: w.member,
    words: r.body.words[w.member] ?? "~ body",
    outcome: w.outcome,
    how: w.how,
    lasting: w.lasting,
    at,
    home,
    up,
    mended: up + days.mending * DAY,
    tended,
    by: byWords(r, tended, healer),
    borne: borneHome(care, w.member, w.outcome, home < up),
  };
}

/** A wound a strike on the town dealt one of its people. */
function strikeWound(r: Reader, ref: string, s: Strike, household: boolean): Wound {
  const year = yearOfMoment(s.at),
    blow = STRIKE_BLOW[s.kind],
    care = careOf(r, r.town.cell, year),
    key = hashString(`wound ${ref} ${s.event}`),
    fate = u(key, 4) < maimedShare(blow, care) ? "maimed" : "hurt",
    w = woundOf(r.body, fate, blow, false, care, u(key, 1), u(key, 2), u(key, 3)),
    healer = healerWords(r, year),
    tended = tendedBy(hospitalIn(r, year), healer !== null, household),
    days = healDays(w.outcome, w.member, blow, care, tended),
    up = s.at + days.abed * DAY;
  return {
    event: s.event,
    from: s.kind,
    year,
    where: `${STRIKE_WHERE[s.kind]} ${r.town.name}`,
    blow,
    arm: null,
    member: w.member,
    words: r.body.words[w.member] ?? "~ body",
    outcome: w.outcome,
    how: w.how,
    lasting: w.lasting,
    at: s.at,
    home: s.at,
    up,
    mended: up + days.mending * DAY,
    tended,
    by: byWords(r, tended, healer),
    borne: false,
  };
}

/** Days away with the levy: the battles at this year's turn they did not fall at, from the turn till they came home. */
function awayOf(
  r: Reader,
  fates: readonly { readonly event: string; readonly year: number; readonly fate: string }[],
  cell: number,
  year: number,
): Away[] {
  const out: Away[] = [];
  for (const f of fates) {
    if (f.year !== year - 1 || f.fate === "fell") continue;
    const fought = battleOf(r.world, f.event);
    if (!fought) continue;
    out.push({
      event: f.event,
      from: year * 365 * DAY,
      until:
        (year * 365 + HOME_DAYS[burialOf(r.world, fought.b.land, cell)]) * DAY + HOME_HOUR * HOUR,
      where: battleWords(r.world, fought.b.land),
    });
  }
  return out;
}

/** Whether a line's holder has a household to tend them: another of the four lines a home of the town's many is drawn for, held. */
function hasHousehold(roster: Roster, line: number, lines: number): boolean {
  const first = line - (line % 4);
  for (let j = first; j < Math.min(first + 4, lines); j++)
    if (j !== line && roster.holder(j) !== null) return true;
  return false;
}

/**
 * This year's strikes on a town (the roster folds them from the next year), by the roster's own
 * rule (host/roster.ts's fold, spec-wave2 §5.3): each line's holder killed at the town's share of
 * the dead, or hurt at its share of the hurt, the strikes in the order they came.
 */
function thisYear(world: World, town: Town, roster: Roster): ThisYear {
  const gone = new Map<number, number>(),
    hurt = new Map<number, Strike[]>(),
    land = populationContext(world).provinces.get(town.cell)?.ref ?? null,
    count = Math.ceil(town.population / LINE),
    struck = strikesOn(world, town.ref as Ref, land)
      .filter((k) => yearOfMoment(k.at) >= roster.year && (k.dead ?? 0) > 0)
      .sort((a, b) => a.at - b.at || (a.event < b.event ? -1 : a.event > b.event ? 1 : 0));
  for (const k of struck) {
    const p = Math.min(1, (k.dead ?? 0) / Math.max(1, town.population)),
      hk = hashString(k.event);
    for (let line = 0; line < count; line++) {
      if (gone.has(line)) continue;
      const h = roster.holder(line);
      if (h === null || h.died !== null) continue;
      const v = u(finish(mix(hk, line), 3), 1);
      if (v < p) gone.set(line, k.at);
      else if (v < p + p * STRIKE_HURT[k.kind]) {
        const list = hurt.get(line) ?? [];
        list.push({ event: k.event, kind: k.kind, at: k.at });
        hurt.set(line, list);
      }
    }
  }
  return { gone, hurt };
}

/** The moment a strike struck (its event; else the turn of the year after it). */
function strikeAt(world: World, event: string, year: number): number {
  return world.events.get(event as Ref)?.t ?? (year + 1) * YEAR;
}

/** A line holder's wounds, the first dealt first. */
function holderWoundsOf(r: Reader, roster: Roster, h: Holder, now: ThisYear): Wound[] {
  const household = hasHousehold(roster, h.line, Math.ceil(r.town.population / LINE)),
    out: Wound[] = [];
  for (const f of h.fates)
    if (f.fate === "hurt" || f.fate === "maimed") {
      const w = battleWound(r, h.ref, { ...f, fate: f.fate }, r.town.cell, household);
      if (w) out.push(w);
    }
  for (const s of h.struck)
    if (s.fate === "hurt")
      out.push(
        strikeWound(
          r,
          h.ref,
          { event: s.event, kind: s.kind, at: strikeAt(r.world, s.event, s.year) },
          household,
        ),
      );
  // (Those of this year, not yet the roster's.)
  if (roster.holder(h.line)?.ref === h.ref)
    for (const s of now.hurt.get(h.line) ?? []) out.push(strikeWound(r, h.ref, s, household));
  return out.sort((a, b) => a.at - b.at || (a.event < b.event ? -1 : a.event > b.event ? 1 : 0));
}

/** A met man's wounds from the battles he came home from these 39 years. */
function metWoundsOf(r: Reader, p: Person, year: number): Wound[] {
  const ledger = observer(r.world),
    household = !!ledger
      .household(p.household)
      ?.members.some((m) => m !== p.ref && ledger.person(m)?.alive),
    out: Wound[] = [];
  for (const w of p.wars ?? [])
    if ((w.fate === "hurt" || w.fate === "maimed") && w.year >= year - ROSTER_YEARS) {
      const made = battleWound(r, p.ref, { ...w, fate: w.fate }, w.cell, household);
      if (made) out.push(made);
    }
  return out.sort((a, b) => a.at - b.at || (a.event < b.event ? -1 : a.event > b.event ? 1 : 0));
}

/** A settlement as its wounds read it (a met man of the countryside: his land, with no town). */
function townOf(world: World, ref: string | null, cell: number): Town {
  const s = ref ? populationContext(world).settlements.get(ref as Ref) : undefined;
  return s
    ? { ref: s.ref, name: s.name, cell: s.cell, population: s.population }
    : { ref: "", name: landTitle(world, cell, true), cell, population: 0 };
}

/** A line holder's wounds (their page). */
export function holderWounds(world: World, town: string, h: Holder): Wound[] {
  const t = townOf(world, town, -1);
  if (!t.ref) return [];
  const roster = townRoster(world, t.ref),
    r = readerOf(world, t);
  return holderWoundsOf(r, roster, h, thisYear(world, t, roster));
}

/** A met man's wounds (his page). */
export function metWounds(world: World, p: Person): Wound[] {
  return metWoundsOf(
    readerOf(world, townOf(world, p.village, p.cell)),
    p,
    Math.floor(world.now / YEAR),
  );
}

/**
 * A town's plan with its people's wounds laid over it (Phase 55 M226): each line holder's and met
 * man's wounds and days away with the levy, and those this year's strikes killed. A seat's holder
 * (a maker, the healer) is named for the seat, not the line: none. The hand's people: none.
 */
export function withWounds(world: World, plan: VillagePlan): VillagePlan {
  if (plan.hand) return plan;
  const t = townOf(world, plan.ref, -1);
  if (!t.ref) return plan;
  const year = Math.floor(world.now / YEAR),
    roster = townRoster(world, t.ref, year),
    r = readerOf(world, t),
    now = thisYear(world, t, roster),
    ledger = observer(world);
  let changed = false;
  const people = plan.people.map((p) => {
    if (p.trade || p.healer) return p;
    let wounds: Wound[] = [],
      away: Away[] = [],
      gone: number | undefined;
    if (p.folk) {
      const at = parseTownsfolkRef(p.ref),
        h =
          at && at.town === t.ref
            ? at.n === null
              ? roster.holder(at.line)
              : roster.holderOf(at.line, at.n)
            : null;
      if (!h) return p;
      wounds = holderWoundsOf(r, roster, h, now);
      away = awayOf(r, h.fates, t.cell, year);
      gone = now.gone.get(h.line);
    } else {
      const q = ledger.person(p.ref as Ref);
      if (!q?.wars?.length) return p;
      wounds = metWoundsOf(r, q, year);
      away = q.wars.flatMap((w) => awayOf(r, [w], w.cell, year));
    }
    if (!wounds.length && !away.length && gone === undefined) return p;
    changed = true;
    return {
      ...p,
      ...(wounds.length ? { wounds } : {}),
      ...(away.length ? { away } : {}),
      ...(gone !== undefined ? { gone } : {}),
    };
  });
  return changed ? { ...plan, people } : plan;
}

/** One of a town's wounded: their ref, name, sex and wounds. */
export type Wounded = {
  readonly ref: string;
  readonly name: string;
  readonly sex: number;
  readonly wounds: readonly Wound[];
};
/** A town's wounded of its lines: those with a wound healing now, then those it marked for good, at most so many. */
export function townWounded(world: World, town: string): Wounded[] {
  const t = townOf(world, town, -1);
  if (!t.ref) return [];
  const roster = townRoster(world, t.ref),
    r = readerOf(world, t),
    now = thisYear(world, t, roster),
    lines = Math.ceil(t.population / LINE),
    out: { w: Wounded; healing: boolean; marked: boolean }[] = [];
  for (let k = 0; k < lines && out.length < WOUNDED_MOST; k++) {
    const h = roster.holder(k);
    if (!h || (!h.fates.length && !h.struck.length && !now.hurt.has(k))) continue;
    const wounds = holderWoundsOf(r, roster, h, now);
    if (!wounds.length) continue;
    const healing = wounds.some((w) => w.at <= world.now && world.now < w.mended),
      marked = wounds.some(
        (w) => w.at <= world.now && (w.outcome === "lost" || w.outcome === "lame"),
      );
    if (healing || marked)
      out.push({ w: { ref: h.ref, name: roster.nameOf(h), sex: h.sex, wounds }, healing, marked });
  }
  return out
    .sort(
      (a, b) =>
        Number(b.healing) - Number(a.healing) ||
        (a.w.ref < b.w.ref ? -1 : a.w.ref > b.w.ref ? 1 : 0),
    )
    .map((x) => x.w);
}

/** A town whose levy comes home this year from the battles at its turn (the look tools: village.wounded). */
export type WoundedTown = {
  readonly ref: string;
  readonly name: string;
  readonly population: number;
  /** Lots its fabric has taken (0: none drawn lot by lot). */
  readonly lots: number;
  readonly healer: boolean;
  readonly hospital: boolean;
  /** Of its line holders coming home: wounded, borne on litters, maimed; and when the first column comes in (world seconds). */
  readonly wounded: number;
  readonly borne: number;
  readonly maimed: number;
  readonly at: number;
};
/** The towns whose levy comes home wounded this year, the most borne first (of the most wounded by the record, so many looked at). */
export function woundedTowns(world: World, most = 20): WoundedTown[] {
  const ctx = populationContext(world),
    year = Math.floor(world.now / YEAR),
    hurt = new Map<string, number>();
  for (const { b } of battlesOfYear(world, year - 1))
    for (const side of [0, 1] as const)
      for (const land of b.fell?.[side] ?? []) {
        if (land[4] === undefined) continue;
        const towns = ctx.settlements.inProvince(land[0]);
        unpackTowns(land[4]).forEach((t, k) => {
          const s = towns[k];
          if (s && t[2] > 0) hurt.set(s.ref, (hurt.get(s.ref) ?? 0) + t[2]);
        });
      }
  const out: WoundedTown[] = [];
  for (const [ref] of [...hurt.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, 3 * most)) {
    const t = townOf(world, ref, -1),
      roster = townRoster(world, ref, year),
      r = readerOf(world, t),
      now = thisYear(world, t, roster),
      lines = Math.ceil(t.population / LINE);
    let wounded = 0,
      borne = 0,
      maimed = 0,
      at = Infinity;
    for (let k = 0; k < lines; k++) {
      const h = roster.holder(k);
      if (!h?.fates.some((f) => f.year === year - 1)) continue;
      for (const w of holderWoundsOf(r, roster, h, now))
        if (w.from === "battle" && w.year === year - 1) {
          wounded++;
          if (w.borne) borne++;
          if (w.outcome === "lost") maimed++;
          at = Math.min(at, w.home);
        }
    }
    if (!wounded) continue;
    out.push({
      ref,
      name: t.name,
      population: t.population,
      lots: townsOf(world).get(ref as Ref)?.next ?? 0,
      healer: !!healerOf(world, t, year),
      hospital: hospitalIn(r, year),
      wounded,
      borne,
      maimed,
      at,
    });
  }
  return out
    .sort(
      (a, b) =>
        b.borne - a.borne ||
        b.wounded - a.wounded ||
        b.population - a.population ||
        (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0),
    )
    .slice(0, most);
}
