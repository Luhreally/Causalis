// The god's hand in a soldier (Phase 61; asked for 2026-10-27: "add in functionality to possess
// anything like worldbox/worldfall mod ... make sure it works right in mobile"): one of the men of a
// battle fought before a town, taken as it is fought. The figures of the field about him, where the
// page drew them, are made the bodies of a small world of its own (rules/fight.ts), each side armed
// as its realm's host is (sim/war/fell.ts hostTerms) and the day leaning the way history had it; it
// is stepped a battle second at a time by the bids the page sends, twenty to the second (a second of
// the battle is a minute of the world's). Letting go — or his falling, his flight off the field, the
// battle's end — fights it out without him by the same draws, and what the fight decided is the
// battle's: the side that broke beaten; the fallen as many as fell, each side's lands losing their
// men by the levy's rule or given back those history took; the battle's record kept again by its own
// rule (sim/war/fell.ts battleRecord); the land won or held with it — taken as history takes a land,
// given back, or its realm raised again at its seat. All told as the god's act (hand.fought), and
// kept so the field is drawn again as he fought it. Nothing is kept until a soldier is taken, so a
// world where none was keeps every hash.
import {
  YEAR,
  apportion,
  defineEventType,
  defineStream,
  drawWithoutReplacement,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import { cellRef } from "../../gen/index.ts";
import {
  BANDS,
  FIGHT_DAY,
  FIGHT_LAST,
  FIGHT_MOST,
  FIGHT_OUT_MOST,
  FIGHT_PACKED,
  LOOSES,
  MALE,
  POSSESS_HZ,
  apportionCapped,
  bidsOf,
  copyFight,
  fightDecided,
  combatMights,
  fightOut,
  fightSide,
  fightWorld,
  personFrame,
  stepFight,
  unpackFight,
  type FightScene,
  type FightWorld,
  type LandFell,
  type LocalDraw,
  type Looses,
} from "../../rules/index.ts";
import { COLS, row } from "../population/model.ts";
import type { PopulationContext } from "../population/systems.ts";
import { cutOff, endRealm, politiesOf, raiseRealm, realmName } from "../polity/polity.ts";
import { armsOf } from "../war/arms.ts";
import { battleRecord, fieldOf, hostTerms, type Take } from "../war/fell.ts";
import { FALL_PURPOSE, fighting, poolOf } from "../war/levy.ts";
import { WAR_EVENTS, warsOf, type Battle, type War } from "../war/war.ts";
import { handOf, type FightIdle, type HeldSoldier } from "./hand.ts";

export const FIGHT_EVENTS = {
  soldier: defineEventType("hand.soldier", 5),
  fought: defineEventType("hand.fought", 6),
};

/** The fight's own draws, keyed by the figure, the step (from the taking's first), and what for; and the fallen's. */
export const HAND_FIGHT = defineStream("hand.fight");

/** Taking a soldier: the battle and the field as the page drew it, and who he is. */
export type SoldierArgs = {
  /** The battle (its event). */
  readonly battle: string;
  /** The figures a side the field was laid at, the men a figure stands for, and where its lines meet (x, m). */
  readonly most: number;
  readonly per: number;
  readonly meet: number;
  /** The one taken: his figure, his side, his roll's ref, his name and his town ("": none told). */
  readonly figure: number;
  readonly side: 0 | 1;
  readonly ref: string;
  readonly name: string;
  readonly town: string;
  /** What each side looses and whether it rides, as the field drew it. */
  readonly looses: readonly [Looses, Looses];
  readonly mounted: readonly [boolean, boolean];
  /** Each side's figures on the field, and those of them fallen before now. */
  readonly figures: readonly [number, number];
  readonly before: readonly [number, number];
  /** The bodies about him, he first: FIGHT_PACKED numbers each (rules/fight.ts unpackFight). */
  readonly bodies: readonly number[];
  /** The roll's ref of each body ("": none named), and its name as the roll names it, in the same order. */
  readonly refs: readonly string[];
  readonly names: readonly string[];
};
/** A second of the fight's bids (or fewer, letting go): the step it begins at, the bids in letters. */
export type HeldArgs = { readonly step: number; readonly steps: string };

const finite = (v: unknown, most: number): boolean =>
  typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= most;
const text = (v: unknown, most: number, empty = true): boolean =>
  typeof v === "string" && v.length <= most && (empty || v.trim().length > 0);

/** A battle by its event: its war, where it stands in it (null: none such). */
export function battleBy(world: World, event: string): { war: War; k: number; b: Battle } | null {
  const wars = warsOf(world).all();
  for (let i = wars.length - 1; i >= 0; i--) {
    const w = wars[i]!;
    for (let k = w.battles.length - 1; k >= 0; k--)
      if (w.battles[k]!.event === event) return { war: w, k, b: w.battles[k]! };
  }
  return null;
}

/**
 * The battle second a moment is at in a battle of history's year (negative: before it): history
 * fights a year's battles at its end, the turn (kernel yearOfMoment: the turn's moment is the old
 * year's), and each is fought before its town the morning after (view/battleday.ts battleSpan).
 */
export function fightSecondAt(year: number, t: number): number {
  return (t - ((year + 1) * YEAR + FIGHT_DAY.from)) / FIGHT_DAY.second;
}

/** Why a soldier cannot be taken (null: he can). */
function soldierProblem(world: World, args: unknown): string | null {
  const store = handOf(world);
  if (store.resting?.possessed || store.held)
    return "your hand is in a body already: let it go first";
  const a = args as Partial<SoldierArgs> | null;
  if (!a || typeof a.battle !== "string") return "battle must be a battle's event";
  const found = battleBy(world, a.battle);
  if (!found) return `no battle ${a.battle}`;
  const { b } = found;
  if (!b.fielded || !b.fell) return "that battle's men were not kept: it cannot be fought again";
  if (store.foughtOf(a.battle)) return "the god has fought in that battle already";
  const s = fightSecondAt(b.year, world.now + 1);
  if (s < 0) return "that battle has not begun";
  const last = b.combat ? (b.combat.rout ?? 130) : FIGHT_LAST;
  if (s >= last) return "that battle is decided: its hosts have broken or disengaged";
  if (!Number.isInteger(a.most) || a.most! < 1 || a.most! > 400)
    return "most is the figures a side was drawn as";
  if (!finite(a.per, 1e7) || !Number.isInteger(a.per) || a.per! < 1)
    return "per is the men a figure stands for";
  if (!finite(a.meet, 100)) return "meet is where the lines meet on the field";
  if (!Number.isInteger(a.figure) || a.figure! < 0) return "figure must be one of the field's";
  if (a.side !== 0 && a.side !== 1) return "side is 0 (the attackers) or 1 (the defenders)";
  if (!text(a.ref, 120) || !text(a.name, 80, false) || !text(a.town, 80))
    return "he is named: his ref, his name and his town";
  const pair = <T>(v: unknown, ok: (x: unknown) => x is T): v is readonly [T, T] =>
    Array.isArray(v) && v.length === 2 && v.every(ok);
  if (!pair(a.looses, (x): x is Looses => (LOOSES as readonly unknown[]).includes(x)))
    return `each side looses one of ${LOOSES.join(", ")}`;
  if (!pair(a.mounted, (x): x is boolean => typeof x === "boolean"))
    return "each side rides, or does not";
  const count = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0;
  if (!pair(a.figures, count) || !pair(a.before, count))
    return "each side's figures, and its fallen before now";
  if (a.figures.some((n, k) => n < 1 || n > 400 || a.before![k]! > n))
    return "a side has at least one figure, and no more fallen than it drew";
  const v = a.bodies;
  if (
    !Array.isArray(v) ||
    v.length % FIGHT_PACKED ||
    !v.length ||
    v.length > FIGHT_MOST * FIGHT_PACKED ||
    !v.every((x) => finite(x, 1e4))
  )
    return `the bodies are ${FIGHT_PACKED} numbers each, ${FIGHT_MOST} at most`;
  for (let i = 0; i < v.length; i += FIGHT_PACKED)
    if (
      !Number.isInteger(v[i]) ||
      v[i]! < 0 ||
      (v[i + 1] !== 0 && v[i + 1] !== 1) ||
      Math.abs(v[i + 2]!) > 400 ||
      Math.abs(v[i + 3]!) > 400 ||
      v[i + 5]! < 0 ||
      v[i + 5]! > 1
    )
      return "a body is a figure of a side, where it stands, and its own draw";
  if (v[0] !== a.figure || v[1] !== a.side) return "he is the first of the bodies";
  if (
    !Array.isArray(a.refs) ||
    a.refs.length !== v.length / FIGHT_PACKED ||
    !a.refs.every((r) => text(r, 120)) ||
    !Array.isArray(a.names) ||
    a.names.length !== a.refs.length ||
    !a.names.every((r) => text(r, 80))
  )
    return "each body's ref and name, in the same order";
  return null;
}

/** The fight's draws for a soldier held. */
function drawsOf(world: World, h: Pick<HeldSoldier, "from">): LocalDraw {
  const at = h.from * POSSESS_HZ;
  return (subject, step, purpose, n = 0) =>
    world.rng.real(HAND_FIGHT, subject, at + step, purpose, n);
}

/**
 * The fight of the soldier held as the bids not yet sent would make it (the host's, for the page
 * between the seconds it sends): a copy stepped by them — the kept one untouched; or `onto`, a copy
 * already stepped by the second's first bids, stepped on by the rest. Null: no soldier is held, or
 * the bids are not.
 */
export function soldierAhead(world: World, letters: string, onto?: FightWorld): FightWorld | null {
  const h = handOf(world).held;
  if (!h || h.kind !== "soldier" || letters.length > POSSESS_HZ * 3) return null;
  const bids = bidsOf(letters);
  if (!bids) return null;
  const f = onto ?? copyFight(h.fight),
    draw = drawsOf(world, h);
  for (const bid of bids) stepFight(h.scene, f, bid, draw);
  return f;
}

/**
 * A fight let go of fought out to its end by the same draws (the host's, to draw the rest of a
 * battle the god fought): a copy of what the hand left, stepped `steps` on (or to its end).
 */
export function foughtOn(
  world: World,
  fought: { readonly from: number; readonly scene: FightScene; readonly left: FightWorld },
  steps = FIGHT_OUT_MOST,
  onto?: FightWorld,
): FightWorld {
  const f = onto ?? copyFight(fought.left);
  fightOut(fought.scene, f, drawsOf(world, fought), steps);
  return f;
}

/** Teach a peopled world the god's hand in a soldier: "possess.soldier", stepped by "possess.held", let go by "possess.leave". */
export function installFight(world: World, ctx: () => PopulationContext): void {
  const store = handOf(world);
  world.defineCommand({
    type: "possess.soldier",
    validate: (args) => soldierProblem(world, args),
    apply: (command, t) => {
      const c = ctx(),
        a = command.args as SoldierArgs,
        { war: w, b } = battleBy(world, a.battle)!,
        realms = politiesOf(world),
        terms = ([0, 1] as const).map((k) => {
          const p = realms.get(k === 0 ? w.attacker : w.defender)!;
          return hostTerms(c, p, armsOf(c, p));
        }),
        // (A people of another world fights at its own paces: Phase 61's alien bodies.)
        frame = personFrame(c.generated.life.people?.body ?? null),
        sceneAt = (): FightScene => {
          const men = b.fielded ?? a.figures,
            power = b.combat?.power ?? [
              men[0] * (b.power?.[0] ?? 1),
              men[1] * (b.power?.[1] ?? 1) * 1.5 * (b.seat ? 2 : 1),
            ],
            mights = combatMights(power, men),
            side = (k: 0 | 1) =>
              fightSide(terms[k]!, a.looses[k], a.mounted[k], mights[k], a.figures[k], a.before[k]);
          return {
            cohesion: true,
            sides: [side(0), side(1)],
            from: Math.max(0, fightSecondAt(b.year, t)),
            length: FIGHT_DAY.length,
            meet: a.meet,
            flanks: true,
            ...(frame ? { pace: frame.run } : {}),
          };
        },
        scene = sceneAt(),
        start = fightWorld(unpackFight(a.bodies, scene)),
        idle = copyFight(start);
      // The counterfactual uses the same forces and draws, once; it is never rerun to force a winner.
      fightOut(scene, idle, drawsOf(world, { from: t }), FIGHT_OUT_MOST);
      const decided = fightDecided(idle),
        event = world.events.emit({
          type: FIGHT_EVENTS.soldier.type,
          subjects: [w.ref, w.attacker, w.defender],
          place: c.provinces.get(b.land)?.ref ?? cellRef(0, b.land),
          causes: [
            { ref: command.id, role: "agent", weight: 0.8 },
            { ref: b.event, role: "enabler", weight: 0.2 },
          ],
          data: { name: a.name.trim(), town: a.town, side: a.side, ref: a.ref },
        });
      store.held = {
        kind: "soldier",
        command: command.id,
        event,
        from: t,
        battle: b.event,
        war: w.ref,
        name: a.name.trim(),
        town: a.town,
        ref: a.ref,
        side: a.side,
        figure: a.figure,
        most: a.most,
        per: a.per,
        scene,
        refs: [...a.refs],
        names: [...a.names],
        fight: start,
        inputs: [],
        idle: { beaten: decided.beaten, dead: decided.dead, down: decided.down },
      };
    },
  });
}

/** Why a second's bids for the soldier held cannot be taken (null: they can). */
export function soldierBidsProblem(h: HeldSoldier, args: unknown, whole: boolean): string | null {
  const a = args as Partial<HeldArgs> | null;
  if (!a || a.step !== h.fight.step) return `out of step: it stands at step ${h.fight.step}`;
  if (
    typeof a.steps !== "string" ||
    (whole ? a.steps.length !== POSSESS_HZ * 3 : a.steps.length > POSSESS_HZ * 3) ||
    !bidsOf(a.steps)
  )
    return whole
      ? `a second's bids are ${POSSESS_HZ}, three letters each`
      : `the bids of a second begun: at most ${POSSESS_HZ}, three letters each`;
  return null;
}

/** The soldier held stepped by a second's bids (fewer, letting go); let go where it ended for him. */
export function stepSoldier(
  world: World,
  c: PopulationContext,
  h: HeldSoldier,
  steps: string,
  cause: Ref,
  t: SimTime,
  release: boolean,
): void {
  if (steps) {
    const draw = drawsOf(world, h);
    for (const bid of bidsOf(steps)!) stepFight(h.scene, h.fight, bid, draw);
    h.inputs.push({ at: t, steps });
  }
  if (release || h.fight.ended) foughtOut(world, c, h, cause, t);
}

/**
 * `n` more of a land's men fallen (the hand's fight killed more than history did): drawn from its
 * levy's pool by the fight's own draws, written as deaths. Returns how many.
 */
function fallMore(
  c: PopulationContext,
  cell: number,
  n: number,
  year: number,
  t: number,
  subject: number,
  purpose: number,
): number {
  const prov = c.provinces.get(cell),
    pool = poolOf(c, cell, year),
    take = Math.min(n, pool.men);
  if (!prov || !(take > 0)) return 0;
  const drawn = drawWithoutReplacement(take, pool.counts, (i) =>
    c.world.rng.real(HAND_FIGHT, subject, t, purpose, i),
  );
  drawn.forEach((k, i) => {
    if (!k) return;
    const r = Math.floor(pool.rows[i]! / COLS),
      o = pool.rows[i]! % COLS;
    prov.counts.add(r, o, -k);
    c.history.addDeaths(cell, year, r % BANDS, k);
  });
  return take;
}

/**
 * `n` of a land's fallen given back (the hand's fight spared those history took): among its fighting
 * men, each age band no more than it lost this year and by those it lost, each band's by its work as
 * its levy's men are (no draws); taken off its year's dead. Returns how many.
 */
function spare(c: PopulationContext, cell: number, n: number, year: number): number {
  const prov = c.provinces.get(cell);
  if (!prov || n <= 0) return 0;
  const bands: number[] = [],
    lost: number[] = [];
  for (let b = 0; b < BANDS; b++)
    if (fighting(c.life, b)) {
      bands.push(b);
      lost.push(Math.max(0, c.history.deathsIn(cell, year, b)));
    }
  const each = apportionCapped(
    Math.min(
      n,
      lost.reduce((s, x) => s + x, 0),
    ),
    lost,
    lost,
  );
  let given = 0;
  each.forEach((k, j) => {
    if (!k) return;
    const b = bands[j]!,
      r = row(MALE, b),
      work: number[] = [];
    for (let o = 1; o < COLS; o++) work.push(prov.counts.get(r, o));
    const parts = work.some((x) => x > 0)
      ? apportion(k, work)
      : work.map((_, i) => (i === 0 ? k : 0));
    parts.forEach((m, i) => {
      if (m) prov.counts.add(r, i + 1, m);
    });
    c.history.addDeaths(cell, year, b, -k);
    given += k;
  });
  return given;
}

/** A side's lands as the hand's fight left them: each its share of `dead` by the men it sent (fallen more, or given back). */
function refall(
  c: PopulationContext,
  lands: readonly LandFell[],
  dead: number,
  year: number,
  t: number,
  subject: number,
): Take[] {
  const sent = lands.map((l) => l[1]),
    each = apportionCapped(dead, sent, sent);
  return lands.map(([cell, s, was], k): Take => {
    const want = each[k]!;
    if (want > was)
      return [cell, s, was + fallMore(c, cell, want - was, year, t, subject, FALL_PURPOSE + k)];
    if (want < was) return [cell, s, was - spare(c, cell, was - want, year)];
    return [cell, s, was];
  });
}

/**
 * The land the battle was fought for as the hand's fight left it, where its outcome is not
 * history's: taken as history takes a land (a seat's first victory only lays a siege), or what
 * history took given back — to its realm, or, its seat taken and its realm fallen, to a realm
 * raised again at its seat with the lands taken from it.
 */
function turnLand(
  c: PopulationContext,
  w: War,
  k: number,
  was: Battle,
  won: boolean,
  cause: Ref,
  t: SimTime,
): void {
  const world = c.world,
    realms = politiesOf(world),
    b = w.battles[k]!,
    land = b.land,
    a = realms.get(w.attacker),
    d = realms.get(w.defender);
  if (!a || !d) return;
  const earlier = w.battles.slice(0, k).some((x) => x.land === land && x.won),
    siege = !!b.seat && !earlier;
  const took = was.won && !siege,
    takes = won && !siege;
  if (took === takes) return;
  if (takes) {
    if (a.ended !== null || d.ended !== null || !d.members.includes(land)) return;
    const taken = world.events.emit({
      type: WAR_EVENTS.taken.type,
      subjects: [a.ref, d.ref],
      place: cellRef(0, land),
      causes: [{ ref: cause, role: "trigger", weight: 1 }],
      data: { a: realmName(a), b: realmName(d) },
    });
    realms.leave(d, land);
    realms.join(a, land);
    realms.setDiscontent(land, { level: 1, cause });
    if (land === d.seat) {
      for (const x of [...d.members]) {
        realms.leave(d, x);
        realms.join(a, x);
        realms.setDiscontent(x, { level: 0.6, cause });
      }
      endRealm(c, d, t, { ref: cause, role: "trigger", weight: 1 });
      cutOff(c, a, taken);
    } else cutOff(c, d, taken);
    return;
  }
  if (a.ended !== null || !a.members.includes(land)) return;
  if (d.ended === null) {
    realms.leave(a, land);
    realms.join(d, land);
    realms.setDiscontent(land, { level: 0, cause: null });
    cutOff(c, a, cause);
    return;
  }
  if (land !== d.seat) return;
  // Its seat held, its realm raised again there: the lands taken from it come back with it.
  const town = c.settlements
    .inProvince(land)
    .sort((x, y) => (x.name === d.town ? -1 : y.name === d.town ? 1 : y.population - x.population))
    .at(0);
  if (!town) return;
  const lands = a.members.filter((x) => realms.formerly(x) === d.ref);
  for (const x of lands) realms.leave(a, x);
  raiseRealm(c, town, lands, cause, t, d.ref);
  cutOff(c, a, cause);
}

/**
 * The battle as the hand's fight leaves it against the same fight with no hand in it (`idle`):
 * where the hand's fight broke another side than the idle one did (or broke one where the idle one
 * broke none, which stands for history's), its outcome is the day's — the attackers' where the
 * defenders broke; else history's, though the fight left alone had gone the other way. Each side's
 * fallen history's and the bodies more (or fewer) struck dead in his fight than in the idle one, so
 * many men each, within those it fielded. Where the hand changed nothing, history's battle to the man.
 */
export function handDay(
  b: Pick<Battle, "won" | "fallen" | "fielded">,
  idle: FightIdle,
  hand: FightIdle,
  per: number,
): { won: boolean; turned: boolean; fallen: [number, number] } {
  const history: 0 | 1 = b.won ? 1 : 0,
    was = idle.beaten >= 0 ? idle.beaten : history,
    is = hand.beaten >= 0 ? hand.beaten : was,
    won = is !== was ? is === 1 : b.won,
    turned = won !== b.won,
    fielded = b.fielded ?? [Infinity, Infinity],
    fallen = [0, 1].map((s) =>
      Math.max(0, Math.min(fielded[s]!, b.fallen[s]! + (hand.dead[s]! - idle.dead[s]!) * per)),
    ) as [number, number];
  return { won, turned, fallen };
}

/**
 * Let go of the soldier: the fight fought out without him, and what it decided against the same
 * fight with no hand in it made the battle's (handDay) — its victor, its fallen (each side's
 * lands), its record, the land — and told as the god's act.
 */
function foughtOut(
  world: World,
  c: PopulationContext,
  h: HeldSoldier,
  cause: Ref,
  t: SimTime,
): void {
  const store = handOf(world);
  store.held = null;
  const found = battleBy(world, h.battle);
  if (!found) return;
  const { war: w, k, b } = found,
    left = copyFight(h.fight),
    f = h.fight,
    ended = f.ended;
  fightOut(h.scene, f, drawsOf(world, h), FIGHT_OUT_MOST);
  const day = handDay(b, h.idle, fightDecided(f), h.per),
    won = day.won,
    realms = politiesOf(world),
    a = realms.get(w.attacker)!,
    d = realms.get(w.defender)!,
    fielded = b.fielded!,
    fallen = day.fallen,
    key = Number(b.event.split(":").at(-1)) || 0,
    takes = [0, 1].map((s) => refall(c, b.fell![s]!, fallen[s]!, b.year, t, key * 2 + s)),
    fa = takes[0]!.reduce((n, x) => n + x[2], 0),
    fb = takes[1]!.reduce((n, x) => n + x[2], 0),
    record = battleRecord(c, [
      {
        terms: hostTerms(c, a, armsOf(c, a)),
        field: fieldOf(fielded[0], fa),
        fallen: fa,
        takes: takes[0]!,
      },
      {
        terms: hostTerms(c, d, armsOf(c, d)),
        field: fieldOf(fielded[1], fb),
        fallen: fb,
        takes: takes[1]!,
      },
    ]),
    amended: Battle = {
      ...b,
      won,
      fallen: [fa, fb],
      ...record,
      ...(b.bore ? { bore: b.bore } : {}),
    };
  w.battles[k] = amended;
  w.fallen = [w.fallen[0] + fa - b.fallen[0], w.fallen[1] + fb - b.fallen[1]];
  warsOf(world).noteFell(amended);
  // What he did with his own hand, and how it ended for him: while the hand was in him, and after.
  const mine = f.deeds.filter((x) => x.by === h.figure),
    me = f.bodies[0]!,
    held = left.bodies[0]!,
    event = world.events.emit({
      type: FIGHT_EVENTS.fought.type,
      subjects: [w.ref, a.ref, d.ref],
      place: c.provinces.get(b.land)?.ref ?? cellRef(0, b.land),
      causes: [
        { ref: cause, role: "agent", weight: 0.7 },
        { ref: h.event, role: "enabler", weight: 0.3 },
        { ref: b.event, role: "enabler", weight: 0.2 },
      ],
      data: {
        name: h.name,
        town: h.town,
        ref: h.ref,
        side: h.side,
        realm: realmName(h.side === 0 ? a : d),
        foe: realmName(h.side === 0 ? d : a),
        year: b.year,
        won: won === (h.side === 0),
        turned: day.turned,
        attackerWon: won,
        fallen: [fa, fb],
        was: b.fallen,
        felled: mine.filter((x) => x.dead).length,
        wounded: mine.filter((x) => !x.dead).length,
        struck: mine.map((x) => h.refs[f.bodies.findIndex((y) => y.id === x.id)] ?? ""),
        seconds: Math.round(left.step / POSSESS_HZ),
        ended: ended || "let go",
        fate: held.doing === "dead" ? "fell" : held.doing === "down" ? "wounded" : "lived",
        after:
          held.doing === "dead" || held.doing === "down"
            ? ""
            : me.doing === "dead"
              ? "fell"
              : me.doing === "down"
                ? "wounded"
                : "lived",
      },
    });
  store.fought.push({
    battle: b.event,
    war: w.ref,
    event,
    name: h.name,
    town: h.town,
    ref: h.ref,
    side: h.side,
    figure: h.figure,
    most: h.most,
    per: h.per,
    from: h.from,
    to: t,
    scene: h.scene,
    refs: h.refs,
    names: h.names,
    left,
    was: b,
  });
  turnLand(c, w, k, b, won, event, t);
}
