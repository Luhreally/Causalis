// Arms past the greatest fire in history (War past the line, W6): a fire carried to another world, a world's sky burned, a world
// unmade. The stakes of W5 one rung up and then two, by its own sums (rules/worldfire.ts extends `chanceOfFall` and `worksChance`;
// nothing here is a second decision). The fleets are the wars between the stars history already holds: in the year before one
// arrives the world holds its breath, if its numbers reach a rung and its odds read badly enough; next year a ruler decides. A
// people's mirrors turned on a far mark take a great works over generations. A world unmade stays unmade: its people dead by the
// same ledgers, no ship goes there again, and every realm is told and remembers who did it. Nothing here stirs until a people
// can reach a rung: `FireState.far` is absent until the first word of it, so history holds bit for bit before then. It is not
// the top of any ladder either.
import {
  defineEventType,
  defineStream,
  yearOfMoment,
  type CauseRef,
  type Factor,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import { cellRef, type GalaxyStar } from "../../gen/index.ts";
import {
  FAR,
  FIRE,
  chanceOfRung,
  cruise,
  dreadAfter,
  farAnswerShare,
  farGoing,
  farWorksChance,
  fearOf,
  fieldsUnder,
  greatFallOf,
  hullMj,
  lightMj,
  needOf,
  rungOf,
  skyMj,
  starDriveFor,
  unmakeMj,
  type Command,
  type FarWorld,
  type Rung,
} from "../../rules/index.ts";
import { deathsIn, grieve } from "../acts/disasters.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { diplomacyOf } from "../diplomacy/diplomacy.ts";
import { knows } from "../lore/lore.ts";
import { endRealm, politiesOf, realmName, type Polity } from "../polity/polity.ts";
import type { PopulationContext } from "../population/systems.ts";
import { civilizationsNear } from "../space/contact.ts";
import { filledOf, starKey } from "../space/filled-store.ts";
import { lateOf } from "../space/late-store.ts";
import { folkOf, folkPeople } from "../space/natives.ts";
import { spaceOf } from "../space/space.ts";
import { starSitesOf } from "../space/stars.ts";
import { causes, starWarsOf, type StarWar } from "../space/starwar.ts";
import { clusterOf, worldsOf } from "../space/voyages.ts";
import {
  answerCost,
  fireOf,
  machinesOf,
  payWorks,
  farOf,
  type FarFall,
  type FarState,
  type FarWorks,
} from "./fire.ts";

export const FAR_EVENTS = {
  /** A realm begins turning its star's light. */
  begun: defineEventType("far.begun", 6),
  /** Its works are done: it can bring its star's light to a far mark. */
  held: defineEventType("far.held", 7),
  /** The year before a fleet comes in, with what its realm could bring. */
  crisis: defineEventType("far.crisis", 7),
  /** Held back. */
  stepped: defineEventType("far.stepped", 7),
  /** It fell, whichever rung. */
  fell: defineEventType("far.fell", 7),
  /** By the god's hand. */
  given: defineEventType("far.given", 6),
};

const CHOICE = defineStream("war.far");
const keyOf = (ref: Ref) => Number(ref.split(":")[2]);

/** A star of those a people could reach, by either of its names (null: it lies beyond any people's story). */
export function farStar(world: World, ref: string): GalaxyStar | null {
  const parts = ref.split(":"),
    zig = (n: number) => (n >= 0 ? 2 * n : -2 * n - 1),
    far = parts[0] === "gstar",
    sector = far
      ? zig(Number(parts[1])) + 1024 * zig(Number(parts[2])) + 1048576 * zig(Number(parts[3]))
      : Number(parts[1]),
    k = Number(far ? parts[4] : parts[2]);
  return clusterOf(world).find((s) => s.sector === sector && s.k === k) ?? null;
}

/** A world of a star as these sums read it (null: no such world). */
export function farWorldOf(world: World, star: GalaxyStar, planet: number): FarWorld | null {
  const p = worldsOf(world, star)[planet];
  return p ? { pull: p.gravity, radius: p.radius, airBar: p.pressure } : null;
}

/** What a realm commands now. */
export function commandOf(ctx: PopulationContext, p: Polity, year: number): Command {
  const { world, generated: g } = ctx,
    store = fireOf(world),
    drive = starDriveFor((id) => knows(ctx, p.seat, id)),
    m = lateOf(world)?.mirrors,
    tends = !!m && !!spaceOf(world).of(p.ref)?.station && knows(ctx, p.seat, "star-mirrors");
  return {
    fireMj: store.loadsOf(p.ref, year) * FIRE.mj,
    hullMj: drive ? hullMj(cruise(drive)) : 0,
    lightMj: tends
      ? lightMj(m.km2, g.star.luminosity, g.system.bodies[0]!.orbit.a, FAR.gatherYears)
      : 0,
    works: !!farWorksOf(world, p.ref)?.done,
  };
}

/** A realm's works of turning its star's light, standing or under way. */
export function farWorksOf(world: World, realm: Ref): FarWorks | null {
  return farOf(world)?.works.find((w) => w.realm === realm && w.gone === undefined) ?? null;
}

/** The world's state past the town's, made when first wanted. */
function farState(world: World): FarState {
  const s = fireOf(world).state;
  return (s.far ??= { works: [], crises: [], falls: [], firsts: {} });
}

/** The lands a world has that history keeps, that a ship has reached. */
function landsOn(world: World, star: Ref, planet: number): number[] {
  return (starSitesOf(world)?.all() ?? [])
    .filter(([, s]) => s.star === star && s.planet === planet && s.arrived)
    .map(([c]) => c);
}

/** It falls on a world: the dead by the same ledgers, the fields by the same harvest; and what it did told to every people in reach. */
export function strikeWorld(
  ctx: PopulationContext,
  o: {
    readonly rung: Rung;
    readonly by: Polity | null;
    readonly star: GalaxyStar;
    readonly planet: number;
    readonly mj: number;
    readonly byLight: boolean;
    readonly decision: Ref | null;
    readonly war: Ref | null;
    readonly enemy: Ref | null;
    readonly causes: readonly CauseRef[];
  },
  t: SimTime,
): FarFall {
  const { world } = ctx,
    year = yearOfMoment(t),
    store = fireOf(world),
    state = farState(world),
    realms = politiesOf(world),
    numbers = farWorldOf(world, o.star, o.planet)!,
    star = o.star.ref as Ref,
    lands = landsOn(world, star, o.planet),
    filled = filledOf(world)?.get(starKey(star, o.planet)),
    folk = folkOf(world, o.star, o.planet),
    onLands = lands.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0),
    theirs = folk ? folkPeople(folk, year) : 0,
    people = onLands + (filled?.people ?? 0) + theirs,
    share =
      o.rung === "world"
        ? 1
        : o.rung === "sky"
          ? FAR.skyDead
          : greatFallOf({ lots: Math.max(1, Math.round(people / 4)), people, miss: 300 }).share *
            FIRE.kills;
  // (Which wars aim here, read before the fall: once it is gone they have no aim left to read.)
  const aimedHere =
    o.rung === "world"
      ? starWarsOf(world)
          .all()
          .filter((w) => {
            if (w.ended) return false;
            if (w.ref === o.war) return true;
            const aim = aimOf(ctx, w, year);
            return aim?.star === star && aim.planet === o.planet;
          })
      : [];
  let dead = 0;
  for (const c of lands) {
    const n = ctx.provinces.get(c)?.total() ?? 0;
    dead += deathsIn(ctx, c, o.rung === "world" ? n : Math.round(n * share), t);
  }
  if (filled) {
    const gone = o.rung === "world" ? filled.people : Math.round(filled.people * share);
    filled.people -= gone;
    dead += gone;
  }
  dead += Math.round(theirs * share);
  const first = !state.firsts[o.rung],
    event = world.events.emit({
      type: FAR_EVENTS.fell.type,
      subjects: [...(o.by ? [o.by.ref] : []), ...(o.enemy ? [o.enemy] : []), star],
      place: o.by ? cellRef(0, o.by.seat) : null,
      causes: o.causes,
      data: {
        rung: o.rung,
        a: o.by ? realmName(o.by) : "",
        god: !o.by,
        ruler: o.by?.ruler.name ?? "",
        star,
        planet: o.planet,
        dead,
        mj: o.mj,
        need: needOf(o.rung, numbers),
        first,
        byLight: o.byLight,
      },
    }),
    fall: FarFall = {
      rung: o.rung,
      year,
      by: o.by?.ref ?? null,
      name: o.by ? realmName(o.by) : "",
      on: o.enemy,
      war: o.war,
      star,
      planet: o.planet,
      lands,
      people,
      dead,
      mj: o.mj,
      need: needOf(o.rung, numbers),
      byLight: o.byLight,
      event,
      decision: o.decision,
      ...(o.rung === "sky" ? { until: year + FAR.skyYears } : {}),
    };
  state.falls.push(fall);
  state.firsts[o.rung] ??= event;
  const s = store.state;
  s.dread = dreadAfter(o.rung, s.dread, first);
  // The harvest: the same sick fields a wind's fall leaves, for as long as a sky stays dark.
  if (o.rung === "sky")
    for (const c of lands) s.sick.push([c, year + FAR.skyYears, fieldsUnder(1)]);
  if (o.rung === "world") {
    // Nothing is left to hold, or to sail for: a realm with no other land ends with it, a realm with others only loses it.
    for (const c of lands) {
      const r = realms.of(c);
      if (!r) continue;
      realms.leave(r, c);
      if (!r.members.length && r.ended === null)
        endRealm(ctx, r, t, { ref: event, role: "trigger", weight: 1 });
    }
    if (filled) filled.gone = year;
    const barred = filledOf(world);
    if (barred) barred.barred = [...(barred.barred ?? []), star];
    for (const w of aimedHere) w.ended = event;
  } else if (o.rung === "sky" && o.war) {
    // (Its fleet's own speed was the strike, where a sky took that: it is spent, and there is no battle to come.)
    const w = starWarsOf(world)
      .all()
      .find((x) => x.ref === o.war);
    if (w && !w.ended && !o.byLight) w.ended = event;
  }
  // Every realm that hears remembers who did this; every people grieves, the more the greater it was.
  const regard = diplomacyOf(world),
    weight = o.rung === "world" ? 0.3 : o.rung === "sky" ? 0.15 : 0.05;
  for (const p of realms.living()) {
    if (o.by && p !== o.by)
      regard.remember(o.by.ref, p.ref, {
        name: `what fell on a world of another star`,
        value: -0.6,
        year,
        source: event,
      });
    grieve(world, p.seat, weight, event);
  }
  return fall;
}

/** Where a war between the stars aims now (none: its cause is gone). */
function aimOf(
  ctx: PopulationContext,
  w: StarWar,
  year: number,
): { star: Ref; planet: number; defence: number } | null {
  const p = politiesOf(ctx.world).get(w.realm);
  if (!p || p.ended !== null) return null;
  const c = causes(ctx, p, year).find((x) => x.enemy === w.enemy);
  return c ? { star: c.star, planet: c.planet, defence: c.defence(w.arrives) } : null;
}

/** What the one who holds it fears in answer, by who the foe is. */
function fearFrom(ctx: PopulationContext, by: Polity, enemy: Ref, year: number): number {
  const realm = politiesOf(ctx.world).get(enemy);
  if (realm) return fearOf(realm.ended === null ? answerCost(ctx, by, realm, year) : 0);
  const civ = civilizationsNear(ctx.world).find((c) => c.ref === enemy);
  return fearOf(farAnswerShare(civ ? year - civ.stars : 0));
}

/** Last year's crises come to their ends: a ruler decides, once, and by the same sum. */
function farResolve(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    state = farOf(world);
  if (!state) return;
  const year = yearOfMoment(t),
    realms = politiesOf(world),
    s = fireOf(world).state;
  for (const c of state.crises) {
    if (c.ended !== null || c.year >= year) continue;
    const by = realms.get(c.holder),
      w = starWarsOf(world)
        .all()
        .find((x) => x.ref === c.war),
      star = clusterOf(world).find((x) => x.ref === c.star);
    if (
      !by ||
      by.ended !== null ||
      !w ||
      w.ended ||
      !star ||
      fireOf(world).unmade(c.star, c.planet)
    ) {
      c.ended = year;
      c.end = "gone";
      continue;
    }
    const valour = cultureOf(world).get(by.seat)?.traits[WAY.valour] ?? 0.5,
      fear = fearFrom(ctx, by, c.foe, year),
      chance = chanceOfRung(c.rung, { desperation: c.going, valour, fear, dread: s.dread }),
      draw = world.rng.real(CHOICE, keyOf(by.ref), t, 1),
      loose = c.answer ? c.answer === "loose" : draw < chance,
      factors: Factor[] = [
        {
          name: "how its fleet's odds read",
          value: Math.round(c.going * 100) / 100,
          contribution: c.going,
          source: { ref: w.event, role: "pressure", weight: 1 },
        },
        {
          name: "what could come back",
          value: Math.round(fear * 100) / 100,
          contribution: -fear,
          source: null,
        },
        {
          name: "a people who prize valour",
          value: Math.round(valour * 100) / 100,
          contribution: valour - 0.5,
          source: null,
        },
        {
          name: "the world's dread",
          value: Math.round(s.dread * 100) / 100,
          contribution: -s.dread,
          source: null,
        },
      ],
      decision = world.decisions.record({
        rule: "far.use",
        subject: by.ref,
        outcome: { loose, rung: c.rung, ruler: c.ruler, by: c.answer ? "word" : "numbers" },
        score: chance,
        threshold: draw,
        factors,
      });
    if (loose) {
      const fell = strikeWorld(
        ctx,
        {
          rung: c.rung,
          by,
          star,
          planet: c.planet,
          mj: c.mj,
          byLight: c.byLight,
          decision,
          war: w.ref,
          enemy: c.foe,
          causes: [
            { ref: decision, role: "agent", weight: 1 },
            { ref: c.event, role: "trigger", weight: 0.8 },
            { ref: w.event, role: "pressure", weight: 0.4 },
          ],
        },
        t,
      );
      c.ended = year;
      c.end = "fell";
      c.endEvent = fell.event;
      continue;
    }
    c.ended = year;
    c.end = "stepped";
    c.endEvent = world.events.emit({
      type: FAR_EVENTS.stepped.type,
      subjects: [by.ref, c.foe],
      place: cellRef(0, by.seat),
      causes: [
        { ref: decision, role: "agent", weight: 1 },
        { ref: c.event, role: "trigger", weight: 1 },
      ],
      data: { a: realmName(by), ruler: c.ruler, rung: c.rung, held: c.answer === "hold" },
    });
  }
}

/** Those who can begin turning their star's light: rarely, at a cost that lasts generations. */
function farWorks(ctx: PopulationContext, t: SimTime): void {
  const { world, generated: g } = ctx,
    m = lateOf(world)?.mirrors;
  if (!m) return;
  const year = yearOfMoment(t),
    realms = politiesOf(world),
    s = fireOf(world).state;
  for (const w of s.far?.works ?? []) {
    if (w.gone !== undefined) continue;
    const p = realms.get(w.realm);
    if (!p || p.ended !== null) {
      w.gone = year;
      continue;
    }
    if (w.done !== null) continue;
    w.paid += payWorks(ctx, p, FAR.worksShare);
    if (year - w.begun < FAR.worksYears) continue;
    w.done = year;
    w.held = world.events.emit({
      type: FAR_EVENTS.held.type,
      subjects: [p.ref],
      place: cellRef(0, w.cell),
      causes: [{ ref: w.event, role: "trigger", weight: 1 }],
      data: {
        a: realmName(p),
        place: w.place,
        years: year - w.begun,
        machines: Math.round(w.paid),
      },
    });
  }
  const home = g.system.bodies[0]!,
    gathered = lightMj(m.km2, g.star.luminosity, home.orbit.a, FAR.gatherYears),
    need = unmakeMj({ pull: home.gravity, radius: home.radius });
  // (Until a star's light gathered could unmake a world like its own, no one has a reason.)
  if (gathered < need) return;
  const able = realms
    .living()
    .filter(
      (p) =>
        !!spaceOf(world).of(p.ref)?.station &&
        knows(ctx, p.seat, "star-mirrors") &&
        !farWorksOf(world, p.ref),
    );
  if (!able.length) return;
  let richest = 0;
  for (const p of realms.living()) richest = Math.max(richest, machinesOf(ctx, p));
  for (const p of able) {
    const machines = machinesOf(ctx, p);
    if (richest <= 0 || machines < FAR.worksRich * richest) continue;
    const wars = starWarsOf(world)
        .all()
        .filter((w) => w.realm === p.ref && !w.ended).length,
      rivalHolds = !!s.far?.works.some((w) => w.done !== null && w.gone === undefined),
      chance = farWorksChance({
        hatred: wars ? 1 : 0.2,
        ratio: 1,
        rivalHolds,
        atWar: wars > 0,
        dread: s.dread,
      }),
      draw = world.rng.real(CHOICE, keyOf(p.ref), t, 0);
    if (!(draw < chance)) continue;
    const decision = world.decisions.record({
        rule: "far.works",
        subject: p.ref,
        outcome: { ruler: p.ruler.name, gathered, need },
        score: chance,
        threshold: draw,
        factors: [
          {
            name: "its star's light, gathered in its mirrors",
            value: m.km2,
            contribution: 1,
            source: { ref: m.begun, role: "enabler", weight: 1 },
          },
          {
            name: "wars between the stars under way",
            value: wars,
            contribution: wars ? 0.6 : 0,
            source: null,
          },
          {
            name: "the machines to pay for it",
            value: Math.round(machines),
            contribution: 0.5,
            source: null,
          },
        ],
      }),
      event = world.events.emit({
        type: FAR_EVENTS.begun.type,
        subjects: [p.ref],
        place: cellRef(0, p.seat),
        causes: [{ ref: decision, role: "trigger", weight: 1 }],
        data: {
          a: realmName(p),
          place: p.town,
          ruler: p.ruler.name,
          years: FAR.worksYears,
          share: Math.round(FAR.worksShare * 100),
        },
      });
    farState(world).works.push({
      realm: p.ref,
      cell: p.seat,
      place: p.town,
      begun: year,
      done: null,
      paid: 0,
      event,
      held: null,
    });
  }
}

/** A fleet a year out, its realm able to reach a rung, its odds reading badly: the world holds its breath. */
function farBrinks(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    year = yearOfMoment(t),
    store = fireOf(world),
    s = store.state,
    realms = politiesOf(world);
  for (const w of starWarsOf(world).all()) {
    if (w.ended || w.arrives !== year + 1) continue;
    const last = Math.max(
      s.crises.at(-1)?.year ?? -Infinity,
      s.far?.crises.at(-1)?.year ?? -Infinity,
    );
    if (year - last < FAR.quiet) return;
    const p = realms.get(w.realm);
    if (!p || p.ended !== null) continue;
    const aim = aimOf(ctx, w, year);
    if (!aim || store.unmade(aim.star, aim.planet)) continue;
    const star = clusterOf(world).find((x) => x.ref === aim.star);
    if (!star) continue;
    const numbers = farWorldOf(world, star, aim.planet);
    if (!numbers) continue;
    const c = commandOf(ctx, p, year),
      rung = rungOf(c, numbers);
    if (!rung) continue;
    const going = farGoing(w.strength, aim.defence);
    if (going < FAR.line[rung]) continue;
    const event = world.events.emit({
      type: FAR_EVENTS.crisis.type,
      subjects: [p.ref, w.enemy, aim.star],
      place: cellRef(0, p.seat),
      causes: [
        { ref: w.event, role: "pressure", weight: 0.8 },
        { ref: p.ruler.event, role: "enabler", weight: 0.3 },
      ],
      data: {
        a: realmName(p),
        ruler: p.ruler.name,
        rung,
        going: Math.round(going * 100) / 100,
        distance: Math.round(star.distance * 10) / 10,
      },
    });
    farState(world).crises.push({
      year,
      holder: p.ref,
      foe: w.enemy,
      war: w.ref,
      star: aim.star,
      planet: aim.planet,
      rung,
      going,
      mj: rung === "carried" ? FIRE.mj : Math.max(c.hullMj, c.works ? c.lightMj : 0),
      byLight: rung !== "carried" && c.works && c.lightMj > c.hullMj,
      ruler: p.ruler.name,
      event,
      ended: null,
    });
    return;
  }
}

/** What falls past the town's, in its year: after the town's own, before the fleets come in. Nothing at all until a people can. */
export function farYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx;
  if (!world.hasStore("space.starwars")) return;
  const year = yearOfMoment(t);
  farResolve(ctx, t);
  farWorks(ctx, t);
  farBrinks(ctx, t);
  // (A ship that was on its way when its world was unmade comes to nothing.)
  for (const f of farOf(world)?.falls ?? [])
    if (f.rung === "world")
      for (const c of landsOn(world, f.star, f.planet)) {
        const n = ctx.provinces.get(c)?.total() ?? 0;
        if (n > 0) deathsIn(ctx, c, n, t);
        const r = politiesOf(world).of(c);
        if (r && year >= f.year) {
          politiesOf(world).leave(r, c);
          if (!r.members.length && r.ended === null)
            endRealm(ctx, r, t, { ref: f.event, role: "trigger", weight: 1 });
        }
      }
}

/** Teach a peopled world the god's hand past the town's, and how a ruler's word reaches a far crisis (`fire.answer`). */
export function installFar(world: World, ctx: () => PopulationContext): void {
  const starOf = (args: unknown): GalaxyStar | null => {
    const a = args as { star?: unknown } | null;
    return typeof a?.star === "string" ? farStar(world, a.star) : null;
  };
  world.defineCommand({
    type: "far.strike",
    validate: (args) => {
      const a = args as { planet?: unknown; rung?: unknown } | null,
        star = starOf(args),
        planet = a?.planet;
      if (!star) return "a star of those a people could reach is wanted";
      if (typeof planet !== "number" || !worldsOf(world, star)[planet]) return "no such world";
      if (a?.rung !== "carried" && a?.rung !== "sky" && a?.rung !== "world")
        return "a fire carried, a sky or a world";
      if (fireOf(world).unmade(star.ref as string, planet)) return "it is already gone";
      if (a.rung === "sky" && !Number.isFinite(skyMj(farWorldOf(world, star, planet)!)))
        return "it has no sky to burn";
      return null;
    },
    apply: (command, t) => {
      const a = command.args as { planet: number; rung: Rung },
        star = starOf(command.args)!,
        numbers = farWorldOf(world, star, a.planet)!;
      strikeWorld(
        ctx(),
        {
          rung: a.rung,
          by: null,
          star,
          planet: a.planet,
          mj: needOf(a.rung, numbers),
          byLight: false,
          decision: null,
          war: null,
          enemy: null,
          causes: [{ ref: command.id, role: "agent", weight: 1 }],
        },
        t,
      );
    },
  });
  world.defineCommand({
    type: "far.give",
    validate: (args) => {
      const ref = (args as { realm?: unknown } | null)?.realm,
        p = typeof ref === "string" ? politiesOf(world).get(ref as Ref) : undefined;
      if (!p || p.ended !== null) return "a realm is wanted";
      return farWorksOf(world, p.ref) ? "it has its works already" : null;
    },
    apply: (command, t) => {
      const p = politiesOf(world).get((command.args as { realm: Ref }).realm)!,
        year = yearOfMoment(t),
        event = world.events.emit({
          type: FAR_EVENTS.given.type,
          subjects: [p.ref],
          place: cellRef(0, p.seat),
          causes: [{ ref: command.id, role: "agent", weight: 1 }],
          data: { a: realmName(p) },
        });
      farState(world).works.push({
        realm: p.ref,
        cell: p.seat,
        place: p.town,
        begun: year,
        done: year,
        paid: 0,
        event,
        held: event,
        given: true,
      });
    },
  });
}
