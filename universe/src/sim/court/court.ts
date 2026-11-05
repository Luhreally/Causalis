// Courts (Lives L5): a realm is no longer a ruler and a line of events. It holds a few real people who could have the
// seat: an heir, the voices of the groups its orders hear, kin, and, where the numbers give one a reason, a rival. A
// principle says what it does and the world says how: whether the seat passes by blood or by voices comes from the
// realm's own orders and from how its people count kin (a people who keep no houses have no heirs by blood, and their
// drama is voices and standing); who is heard comes from the sway `interests.ts` already reads; every reason a rival
// has is a number history already holds. A plot takes a year from moving to its end, so a ruler played by the god's
// hand can step in; nobody needs to: the realm decides it by the same numbers. The army's own coups go through it, and
// a civil war's first cause can be a person.
//
// Only standing realms have a court, and a court holds a handful of people: nothing here runs per person or scans a
// town. A court whose realm has ended is let go at once: what it did stays in history's events, thinned by their age.
import {
  YEAR,
  defineEventType,
  defineStream,
  parseRef,
  yearOfMoment,
  type CauseRef,
  type Factor,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { tongueName, tonguePersonName } from "../../gen/index.ts";
import {
  COURT,
  REIGN,
  claimChance,
  doubtOf,
  fleeChance,
  mustCarry,
  plotChance,
  plotOdds,
  seizeCost,
  voicesHeard,
  weightOf,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { WAY, cultureOf, type Ways } from "../culture/culture.ts";
import { bandOfAge } from "../hand/hand.ts";
import { interestsOf } from "../polity/interests.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { orderOf, type RealmOrder } from "../order/order.ts";
import { rulerProblem } from "../order/reign.ts";
import { battlesOf, breakAway, farLands, foil, seize } from "../strife/strife.ts";

export const COURT_EVENTS = {
  /** An heir named by the voices or by a word, not an heir born. */
  heir: defineEventType("court.heir", 3),
  heirDied: defineEventType("court.heirdied", 3),
  regency: defineEventType("court.regency", 4),
  /** A claim made at a death, against the heir. */
  claim: defineEventType("court.claim", 4),
  /** A rival moves on the seat: it comes to its end within the year. */
  plot: defineEventType("court.plot", 4),
  /** A plot that carried the seat. */
  seized: defineEventType("court.seized", 5),
  /** A plot found: its maker dead or fled. */
  found: defineEventType("court.found", 5),
  /** A plotter bought off by a ruler's word. */
  bought: defineEventType("court.bought", 4),
};

const DEATH = defineStream("court.death"),
  FIGURE = defineStream("court.figure"),
  PLOT = defineStream("court.plot");

const clamp = (lo: number, hi: number, x: number) => Math.max(lo, Math.min(hi, x));

/** Whence a figure's weight comes: one of the groups a realm's orders hear, or the ruler's own house. */
export type CourtSeat = "house" | "the army" | "the court" | "the temple" | "traders";

/** One of a court: real, with a name and a year of birth, and few to a realm. */
export type CourtFigure = {
  readonly id: number;
  readonly name: string;
  readonly sex: number;
  readonly born: number;
  readonly seat: CourtSeat;
  /** To the ruler, for those of the house ("kin": of the house, of another reign). */
  tie: "child" | "sibling" | "kin" | null;
  readonly since: number;
  /** Their group's share of the realm's sway, at the last reckoning. */
  sway: number;
  /** The event that wronged them: the seat was to be theirs. */
  wronged?: Ref;
};

/** A figure gone from a court, for their page: how it ended and the event that says so. */
export type GoneFigure = {
  readonly id: number;
  readonly name: string;
  readonly sex: number;
  readonly born: number;
  readonly seat: CourtSeat;
  readonly year: number;
  readonly how: "died" | "seated" | "found" | "fled" | "stood down";
  readonly event: Ref | null;
};

/** A rival's move, from its start to its end a year on. */
export type Plot = {
  readonly by: number;
  readonly since: number;
  readonly event: Ref;
  readonly decision: Ref;
  /** The odds it had and how it will end if no one steps in (drawn when it began). */
  readonly odds: number;
  readonly won: boolean;
  /** The army's own reach for the seat (STRIFE's coup, under a figure's name). */
  readonly army: boolean;
};

/** A claim made at a death, kept only until the court's turn the same year tells it. */
type Dispute = {
  readonly by: number;
  readonly heir: number;
  readonly won: boolean;
  readonly score: number;
  readonly factors: readonly Factor[];
  readonly odds: number;
};

export type Court = {
  readonly realm: Ref;
  figures: CourtFigure[];
  heir: number | null;
  /** How the heir stands: by blood, or the one the voices lean to. */
  heirBy: "blood" | "voices" | "word" | null;
  rival: number | null;
  regent: number | null;
  plot: Plot | null;
  /** Before this year no one at court dares. */
  quiet: number;
  /** The event of the coming to rule this court last reckoned under. */
  ruler: Ref;
  /** What has passed at this court, newest last (bounded). */
  told: Ref[];
  gone: GoneFigure[];
  dispute?: Dispute;
};

export class CourtStore implements StateStore {
  readonly name = "court.states";
  private readonly courts = new Map<string, Court>();
  private next = 1;

  of(realm: Ref): Court | undefined {
    return this.courts.get(realm);
  }
  all(): IterableIterator<Court> {
    return this.courts.values();
  }
  add(c: Court): void {
    this.courts.set(c.realm, c);
  }
  drop(realm: string): void {
    this.courts.delete(realm);
  }
  /** The next figure's number. */
  mint(): number {
    return this.next++;
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const c of this.courts.values()) {
      out.push(c.ruler, ...c.told);
      if (c.plot) out.push(c.plot.event, c.plot.decision);
      for (const f of c.figures) if (f.wronged) out.push(f.wronged);
      for (const g of c.gone) if (g.event) out.push(g.event);
    }
    return out;
  }
  hashInto(h: Hasher): void {
    h.int(this.next).value([...this.courts.values()]);
  }
  save(): unknown {
    return { next: this.next, courts: [...this.courts.values()] };
  }
  load(state: unknown): void {
    const s = state as { next: number; courts: Court[] };
    this.next = s.next;
    this.courts.clear();
    for (const c of s.courts)
      this.courts.set(c.realm, {
        ...c,
        figures: c.figures.map((f) => ({ ...f })),
        told: [...c.told],
        gone: [...c.gone],
      });
  }
}

export function courtOf(world: World): CourtStore | null {
  return world.hasStore("court.states") ? world.store<CourtStore>("court.states") : null;
}

const figureOf = (c: Court, id: number | null): CourtFigure | undefined =>
  id === null ? undefined : c.figures.find((f) => f.id === id);
const keyOf = (r: Ref) => parseRef(r).b >>> 0;
const surname = (name: string) => name.split(" ").slice(1).join(" ");
const placeOf = (ctx: PopulationContext, p: Polity) => ctx.provinces.get(p.seat)?.ref ?? null;
const told = (c: Court, event: Ref) => {
  c.told = [...c.told, event].slice(-COURT.toldMost);
};

/** Whether a realm's seat passes by blood: its orders say so, and its people keep houses at all. */
export function byBlood(p: Polity, ways: Ways | undefined): boolean {
  return p.succession === 0 && (ways?.traits[WAY.kinship] ?? 0) >= REIGN.noHouses;
}

/** A person of a court, named in the realm's tongue, keyed by the realm and the moment. */
function person(
  world: World,
  ways: Ways,
  key: number,
  t: SimTime,
  salt: number,
  family: string | null,
): { name: string; sex: number; u: number } {
  const u = (n: number) => world.rng.real(FIGURE, key, t, salt * 8 + n),
    sex = u(1) < 0.5 ? 0 : 1,
    given = tonguePersonName(ways.tongue, Math.floor(u(2) * 1e6), sex),
    last =
      family ??
      tongueName({ ...ways.tongue, seed: ways.tongue.seed ^ 0x51f7 }, Math.floor(u(3) * 1e6));
  return { name: `${given} ${last}`, sex, u: u(4) };
}

/** One leaving a court: remembered for their page, a few to a court. */
function letGo(
  c: Court,
  f: CourtFigure,
  year: number,
  how: GoneFigure["how"],
  event: Ref | null,
): void {
  c.figures = c.figures.filter((x) => x !== f);
  if (c.heir === f.id) {
    c.heir = null;
    c.heirBy = null;
  }
  if (c.rival === f.id) c.rival = null;
  if (c.regent === f.id) c.regent = null;
  if (c.plot?.by === f.id) c.plot = null;
  c.gone = [
    ...c.gone,
    {
      id: f.id,
      name: f.name,
      sex: f.sex,
      born: f.born,
      seat: f.seat,
      year,
      how,
      event,
    },
  ].slice(-COURT.goneMost);
}

/** Who is heard at court, who is heir, who wants the seat: read from the world as it stands. */
function reckon(ctx: PopulationContext, p: Polity, c: Court, t: SimTime): void {
  const { world } = ctx,
    store = courtOf(world)!,
    year = yearOfMoment(t),
    grown = ctx.life.adulthood,
    ways = cultureOf(world).get(p.seat);
  if (!ways) return;
  const key = keyOf(p.ref),
    interests = interestsOf(ctx, p, t),
    swayIn = (g: string) => interests.find((i) => i.group === g)?.sway ?? 0,
    heard = COURT.voices
      .map((group) => ({ group: group as CourtSeat, sway: swayIn(group) }))
      .filter((v) => v.sway >= COURT.voiceLeast)
      .sort((a, b) => b.sway - a.sway || (a.group < b.group ? -1 : 1))
      .slice(0, voicesHeard(mustCarry(p.leadership, p.succession)));
  // Whose group is no longer heard stands down, and who has grown old at it, but for a regent and one in the midst of a move.
  for (const f of [...c.figures])
    if (
      f.seat !== "house" &&
      (!heard.some((v) => v.group === f.seat) || year - f.born >= grown * COURT.voiceRetires) &&
      f.id !== c.regent &&
      f.id !== c.plot?.by
    )
      letGo(c, f, year, "stood down", null);
  for (const v of heard) {
    const f = c.figures.find((x) => x.seat === v.group);
    if (f) {
      f.sway = v.sway;
      continue;
    }
    const n = person(world, ways, key, t, 4 + COURT.voices.indexOf(v.group as never), null);
    c.figures.push({
      id: store.mint(),
      name: n.name,
      sex: n.sex,
      born: year - Math.floor(grown * (COURT.voiceAge + n.u * COURT.voiceAgeMore)),
      seat: v.group,
      tie: null,
      since: year,
      sway: v.sway,
    });
  }
  // The house, where the seat passes by blood.
  const blood = byBlood(p, ways),
    family = surname(p.ruler.name),
    age = year - p.ruler.born;
  if (!blood) {
    for (const f of [...c.figures])
      if (f.seat === "house" && !f.wronged) letGo(c, f, year, "stood down", null);
  } else {
    const house = swayIn("the court") * COURT.kinSway;
    for (const f of c.figures) if (f.seat === "house") f.sway = house;
    // (A child is told to a court once past the first of their people's years, where most who die young die.)
    const first = ctx.life.bands[1] ?? 1;
    if (
      !c.figures.some((f) => f.tie === "child") &&
      age > grown + first &&
      world.rng.real(FIGURE, key, t, 1) < COURT.childChance
    ) {
      const n = person(world, ways, key, t, 1, family);
      c.figures.push({
        id: store.mint(),
        name: n.name,
        sex: n.sex,
        born: year - (first + Math.floor(n.u * (age - grown - first))),
        seat: "house",
        tie: "child",
        since: year,
        sway: house,
      });
    }
    if (
      !c.figures.some((f) => f.tie === "sibling") &&
      p.ruler.since === year &&
      world.rng.real(FIGURE, key, t, 2) < COURT.kinChance
    ) {
      const n = person(world, ways, key, t, 2, family);
      c.figures.push({
        id: store.mint(),
        name: n.name,
        sex: n.sex,
        born: Math.min(year - grown, p.ruler.born + 2 + Math.floor(n.u * 10)),
        seat: "house",
        tie: "sibling",
        since: year,
        sway: house,
      });
    }
    // (Kin of an older reign are let go, the eldest first.)
    const kin = c.figures
      .filter((f) => f.tie === "kin" && !f.wronged)
      .sort((a, b) => a.born - b.born || a.id - b.id);
    for (const f of kin.slice(0, Math.max(0, kin.length - COURT.kinMost)))
      letGo(c, f, year, "stood down", null);
  }
  // The heir: the eldest of the house; or the one the voices lean to. (A word already said stands, while they live.)
  const adults = c.figures.filter((f) => year - f.born >= grown),
    named = c.heirBy === "word" ? figureOf(c, c.heir) : undefined;
  if (named) {
    /* it stands */
  } else if (blood) {
    const heir =
      c.figures.find((f) => f.tie === "child") ?? c.figures.find((f) => f.tie === "sibling");
    c.heir = heir?.id ?? null;
    c.heirBy = heir ? "blood" : null;
  } else {
    const voices = adults
      .filter((f) => f.seat !== "house")
      .sort((a, b) => b.sway - a.sway || a.id - b.id);
    c.heir = voices[0]?.id ?? null;
    c.heirBy = voices[0] ? "voices" : null;
  }
  // The rival: of those grown and not the heir, who wants it most, and only if they want it.
  const heir = figureOf(c, c.heir),
    childHeir = !!heir && year - heir.born < grown,
    wantOf = (f: CourtFigure) =>
      COURT.wantWeight * weightOf(f.sway) +
      (f.wronged ? COURT.wantWronged : 0) +
      (f.id === c.regent ? COURT.wantRegent : 0) +
      (f.tie === "sibling" && childHeir ? COURT.wantChildHeir : 0),
    wanting = adults
      .filter((f) => f.id !== c.heir)
      .map((f) => ({ f, want: wantOf(f) }))
      .filter((x) => x.want >= COURT.rivalLeast)
      .sort((a, b) => b.want - a.want || a.f.id - b.f.id),
    held = figureOf(c, c.rival),
    top = wanting[0];
  if (c.plot) c.rival = c.plot.by;
  else if (!top) c.rival = null;
  else if (
    !held ||
    held.id === c.heir ||
    wantOf(held) < COURT.rivalLeast ||
    wantOf(held) + COURT.rivalStays < top.want
  )
    c.rival = top.f.id;
}

/**
 * How near a rival is to moving on the seat, and why. Each reason is a number the world already holds: their own weight,
 * a rule doubted, a seat held by others' leave, a child on the seat or heir to it, battles lost, a law the powerful are
 * against, no heir at all, a people who prize valour or keep to custom, how old the rule is, a wrong done to them.
 */
export function dangerOf(
  ctx: PopulationContext,
  p: Polity,
  c: Court,
  f: CourtFigure,
  o: RealmOrder,
): { score: number; weight: number; doubt: number; tradition: number; factors: Factor[] } {
  const { world } = ctx,
    year = yearOfMoment(world.now),
    grown = ctx.life.adulthood,
    ways = cultureOf(world).get(p.seat),
    trait = (w: number) => ways?.traits[w] ?? 0.5,
    weight = weightOf(f.sway),
    doubt = doubtOf(o.legitimacy),
    fought = battlesOf(world, p, year),
    defeats = fought.lost ? fought.lost / (fought.won + fought.lost) : 0,
    heir = figureOf(c, c.heir),
    childOn = year - p.ruler.born < grown,
    childHeir = !!heir && year - heir.born < grown,
    valour = trait(WAY.valour),
    tradition = trait(WAY.tradition),
    old = Math.min(1, Math.max(0, year - p.founded) / 200),
    lawAt = o.lawEvents.find((e) => e !== null) ?? null,
    who =
      f.seat === "house"
        ? `${f.name}, of the ruler's house`
        : `${f.name}, the voice of ${f.seat}`;
  const factors: Factor[] = [
    {
      name: who,
      value: f.sway,
      contribution: COURT.wantWeight * weight,
      source: null,
    },
    {
      name: "a rule doubted",
      value: o.legitimacy,
      contribution: 0.55 * doubt,
      source: o.crisis ? { ref: o.crisis, role: "pressure", weight: 1 } : null,
    },
    {
      name: "a seat held by others' leave",
      value: p.succession,
      contribution: p.succession === 0 ? 0 : 0.06,
      source: null,
    },
    {
      name: "a child on the seat",
      value: childOn ? year - p.ruler.born : 0,
      contribution: childOn ? 0.25 : 0,
      source: childOn ? { ref: p.ruler.event, role: "pressure", weight: 1 } : null,
    },
    {
      name: "a child heir",
      value: childHeir ? year - heir!.born : 0,
      contribution: childHeir && !childOn ? 0.1 : 0,
      source: null,
    },
    {
      name: "no heir",
      value: c.heir === null ? 1 : 0,
      contribution: c.heir === null ? 0.06 : 0,
      source: null,
    },
    {
      name: "battles lost",
      value: fought.lost,
      contribution: 0.2 * defeats,
      source: fought.last ? { ref: fought.last, role: "pressure", weight: 1 } : null,
    },
    {
      name: "a law the powerful are against",
      value: o.approval,
      contribution: 0.2 * Math.max(0, -o.approval),
      source: o.approval < 0 && lawAt ? { ref: lawAt, role: "pressure", weight: 1 } : null,
    },
    {
      name: "a wrong done to them",
      value: f.wronged ? 1 : 0,
      contribution: f.wronged ? COURT.wantWronged : 0,
      source: f.wronged ? { ref: f.wronged, role: "pressure", weight: 1 } : null,
    },
    {
      name: "a people who prize valour",
      value: valour,
      contribution: 0.2 * (valour - 0.5),
      source: null,
    },
    {
      name: "a people who keep to custom",
      value: tradition,
      contribution: -0.2 * (tradition - 0.5),
      source: null,
    },
    {
      name: "an old rule",
      value: old,
      contribution: -0.08 * old,
      source: { ref: p.event, role: "constraint", weight: 1 },
    },
  ];
  return {
    score: factors.reduce((s, x) => s + x.contribution, 0),
    weight,
    doubt,
    tradition,
    // (Told as they weigh: what has no weight here is not a reason.)
    factors: factors.filter((x) => x.contribution !== 0),
  };
}

/** A rival moves: it is known to history, and comes to its end a year on unless someone steps in. */
function begin(
  ctx: PopulationContext,
  p: Polity,
  c: Court,
  f: CourtFigure,
  decision: Ref,
  odds: number,
  won: boolean,
  army: boolean,
  t: SimTime,
): void {
  const { world } = ctx,
    event = world.events.emit({
      type: COURT_EVENTS.plot.type,
      subjects: [p.ref],
      place: placeOf(ctx, p),
      causes: [{ ref: decision, role: "trigger", weight: 1 }],
      data: {
        realm: realmName(p),
        fig: f.id,
        who: f.name,
        seat: f.seat,
        ruler: p.ruler.name,
        odds,
      },
    });
  told(c, event);
  c.rival = f.id;
  c.plot = { by: f.id, since: yearOfMoment(t), event, decision, odds, won, army };
}

/**
 * The army's reach for the seat, as `strifeYear` has weighed it, under the name of the one who holds its voice at court:
 * a year's warning, then the coup or its failure as they ever were. False if it has no voice here (the coup is at once).
 */
export function armyMoves(
  ctx: PopulationContext,
  p: Polity,
  decision: Ref,
  odds: number,
  won: boolean,
  t: SimTime,
): boolean {
  const c = courtOf(ctx.world)?.of(p.ref);
  if (!c || c.plot) return !!c?.plot;
  const f = c.figures.find((x) => x.seat === "the army");
  if (!f) return false;
  begin(ctx, p, c, f, decision, odds, won, true, t);
  return true;
}

/** The one who holds the army's voice, leaving a court for a coup's seat or a coup's end (null: none). */
export function armyVoice(
  world: World,
  p: Polity,
): { name: string; sex: number; born: number; fig: number } | null {
  const c = courtOf(world)?.of(p.ref),
    plot = c?.plot,
    by = plot?.army ? figureOf(c!, plot.by) : c?.figures.find((f) => f.seat === "the army");
  return by ? { name: by.name, sex: by.sex, born: by.born, fig: by.id } : null;
}

/** A coup's end, for the one whose it was. */
export function armyDone(world: World, p: Polity, event: Ref, seated: boolean): void {
  const c = courtOf(world)?.of(p.ref);
  if (!c) return;
  const f = c.plot?.army ? figureOf(c, c.plot.by) : c.figures.find((x) => x.seat === "the army"),
    year = yearOfMoment(world.now);
  told(c, event);
  if (f) letGo(c, f, year, seated ? "seated" : "found", event);
  c.plot = null;
  c.quiet = Math.max(c.quiet, year + (seated ? COURT.quietWon : COURT.quietFound));
}

/** Who follows a death, as the court holds it: the heir, unless a claim made at this hour carries the seat. */
export function courtFollows(
  ctx: PopulationContext,
  p: Polity,
  t: SimTime,
): { name: string; sex: number; born: number; how: string; fig: number } | null {
  const { world } = ctx,
    c = courtOf(world)?.of(p.ref),
    o = orderOf(world)?.of(p.ref);
  if (!c) return null;
  const heir = figureOf(c, c.heir),
    rival = figureOf(c, c.rival),
    year = yearOfMoment(t),
    key = keyOf(p.ref);
  let next = heir,
    how: string = c.heirBy ?? "blood";
  if (heir && rival && rival !== heir && o && year >= c.quiet) {
    const d = dangerOf(ctx, p, c, rival, o),
      chance = claimChance(d.score);
    if (chance > 0 && world.rng.real(PLOT, key, t, 4) < chance) {
      const odds = plotOdds(d.weight, d.doubt, d.tradition),
        won = world.rng.real(PLOT, key, t, 5) < odds;
      c.dispute = { by: rival.id, heir: heir.id, won, score: d.score, factors: d.factors, odds };
      if (won) {
        next = rival;
        how = "claim";
      }
    }
  }
  return next
    ? { name: next.name, sex: next.sex, born: next.born, how, fig: next.id }
    : null;
}

/** One of a court who raises lands at a death: they leave it, and rule what broke away. */
export function courtClaimant(
  world: World,
  p: Polity,
  not: number | undefined,
): { name: string; sex: number; born: number; fig: number } | null {
  const c = courtOf(world)?.of(p.ref),
    f = c ? figureOf(c, c.rival) : undefined;
  if (!c || !f || f.id === not) return null;
  letGo(c, f, yearOfMoment(world.now), "fled", null);
  return { name: f.name, sex: f.sex, born: f.born, fig: f.id };
}

/** One who loses, and may flee to the far lands and raise them: a civil war whose first cause is that person. */
function fled(
  ctx: PopulationContext,
  p: Polity,
  f: CourtFigure,
  event: Ref,
  t: SimTime,
  salt: number,
): boolean {
  const { world } = ctx;
  if (!(world.rng.real(PLOT, keyOf(p.ref), t, salt) < fleeChance(weightOf(f.sway)))) return false;
  const raised = breakAway(ctx, p, farLands(ctx, p), event, "pretender", t, f.name);
  if (raised) raised.ruler = { ...raised.ruler, sex: f.sex, born: f.born };
  return !!raised;
}

/** A plot comes to its end, as it was drawn when it began. */
function resolve(ctx: PopulationContext, p: Polity, c: Court, plot: Plot, t: SimTime): void {
  const { world } = ctx,
    f = figureOf(c, plot.by),
    year = yearOfMoment(t),
    o = orderOf(world)?.of(p.ref);
  if (!f) {
    c.plot = null;
    return;
  }
  const causes: CauseRef[] = [{ ref: plot.event, role: "trigger", weight: 1 }];
  if (plot.army) {
    // (They leave the court through armyDone, called by the coup and its failure.)
    if (plot.won) seize(ctx, p, causes, t);
    else foil(ctx, p, causes, t, weightOf(f.sway));
    return;
  }
  if (plot.won) {
    const old = p.ruler,
      heir = figureOf(c, c.heir),
      // (What it did, not how: they did not live the night, or were put out of the palace door.)
      dead = world.rng.real(PLOT, keyOf(p.ref), t, 6) < 0.5,
      event = world.events.emit({
        type: COURT_EVENTS.seized.type,
        subjects: [p.ref],
        place: placeOf(ctx, p),
        causes,
        data: { realm: realmName(p), fig: f.id, who: f.name, seat: f.seat, old: old.name, dead },
      });
    told(c, event);
    if (o) o.legitimacy = clamp(0.02, 0.98, o.legitimacy - COURT.wonCost);
    if (heir && heir !== f) heir.wronged = event;
    p.ruler = { name: f.name, sex: f.sex, born: f.born, since: year, event };
    letGo(c, f, year, "seated", event);
    c.quiet = year + COURT.quietWon;
    return;
  }
  const event = world.events.emit({
    type: COURT_EVENTS.found.type,
    subjects: [p.ref],
    place: placeOf(ctx, p),
    causes,
    data: { realm: realmName(p), fig: f.id, who: f.name, seat: f.seat, ruler: p.ruler.name },
  });
  told(c, event);
  if (o) o.legitimacy = clamp(0.02, 0.98, o.legitimacy + COURT.foundGain);
  c.quiet = year + COURT.quietFound;
  letGo(c, f, year, fled(ctx, p, f, event, t, 7) ? "fled" : "found", event);
}

/** A seat changed hands, by whatever road: who was close to the old ruler is not to the new, and all is reckoned again. */
function seatChanged(ctx: PopulationContext, p: Polity, c: Court, t: SimTime): void {
  const { world } = ctx,
    year = yearOfMoment(t),
    grown = ctx.life.adulthood,
    d = c.dispute;
  c.ruler = p.ruler.event;
  delete c.dispute;
  // A claim made at the death: told, and what comes of it.
  const by = d ? figureOf(c, d.by) : undefined;
  if (d && by) {
    const heir = figureOf(c, d.heir),
      decision = world.decisions.record({
        rule: "court.claim",
        subject: p.ref,
        outcome: { who: by.name, won: d.won, against: heir?.name ?? "" },
        score: d.score,
        threshold: COURT.claimLine,
        factors: [...d.factors],
      }),
      event = world.events.emit({
        type: COURT_EVENTS.claim.type,
        subjects: [p.ref],
        place: placeOf(ctx, p),
        causes: [
          { ref: decision, role: "trigger", weight: 1 },
          { ref: p.ruler.event, role: "enabler", weight: 0.5 },
        ],
        data: {
          realm: realmName(p),
          fig: d.by,
          who: by.name,
          seat: by.seat,
          heir: heir?.name ?? "",
          won: d.won,
        },
      });
    told(c, event);
    c.quiet = year + COURT.quietClaim;
    if (d.won && heir) heir.wronged = event;
    if (!d.won) {
      const gone = fled(ctx, p, by, event, t, 8);
      letGo(c, by, year, gone ? "fled" : "found", event);
    }
  }
  // Who now holds the seat has left the court; those of the old house are kin, no more.
  const holder = c.figures.find((f) => f.name === p.ruler.name);
  if (holder) letGo(c, holder, year, "seated", p.ruler.event);
  for (const f of c.figures) if (f.seat === "house") f.tie = "kin";
  if (c.heirBy !== "word" || !figureOf(c, c.heir)) {
    c.heir = null;
    c.heirBy = null;
  }
  c.regent = null;
  reckon(ctx, p, c, t);
  // A child on the seat: one who is grown and weighs most holds it for them.
  if (year - p.ruler.born < grown) {
    const regent = c.figures
      .filter((f) => year - f.born >= grown)
      .sort((a, b) => b.sway - a.sway || a.id - b.id)[0];
    if (regent) {
      c.regent = regent.id;
      const event = world.events.emit({
        type: COURT_EVENTS.regency.type,
        subjects: [p.ref],
        place: placeOf(ctx, p),
        causes: [{ ref: p.ruler.event, role: "trigger", weight: 1 }],
        data: {
          realm: realmName(p),
          fig: regent.id,
          who: regent.name,
          seat: regent.seat,
          ruler: p.ruler.name,
          age: year - p.ruler.born,
        },
      });
      told(c, event);
      reckon(ctx, p, c, t);
    }
  }
}

/** A court's year: its people's deaths, a plot's end, a seat changed, a reckoning, a rival's move. */
export function courtYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = courtOf(world),
    orders = orderOf(world);
  if (!store) return;
  const realms = politiesOf(world),
    year = yearOfMoment(t),
    life = ctx.life;
  for (const c of [...store.all()]) {
    const r = realms.get(c.realm);
    if (!r || r.ended !== null) store.drop(c.realm);
  }
  for (const p of realms.living()) {
    const key = keyOf(p.ref);
    let c = store.of(p.ref);
    if (!c) {
      c = {
        realm: p.ref,
        figures: [],
        heir: null,
        heirBy: null,
        rival: null,
        regent: null,
        plot: null,
        quiet: year + COURT.reckonEvery,
        ruler: p.ruler.event,
        told: [],
        gone: [],
      };
      store.add(c);
      reckon(ctx, p, c, t);
      continue;
    }
    if (c.ruler !== p.ruler.event) seatChanged(ctx, p, c, t);
    // Those at court die as anyone does: an heir's death is told, and the next is named.
    let heirGone: { who: string; fig: number; age: number } | null = null;
    for (const f of [...c.figures]) {
      const band = bandOfAge(year - f.born, life);
      if (!(world.rng.real(DEATH, f.id, t, 0) < life.mortality[band]!)) continue;
      if (f.id === c.heir && c.heirBy !== "voices")
        heirGone = { who: f.name, fig: f.id, age: year - f.born };
      letGo(c, f, year, "died", null);
    }
    if (c.plot && c.plot.since < year) resolve(ctx, p, c, c.plot, t);
    if (c.ruler !== p.ruler.event) seatChanged(ctx, p, c, t);
    if (heirGone) {
      reckon(ctx, p, c, t);
      // (The chronicle's only where it leaves no one to follow; a ruler played is told either way.)
      const event = world.events.emit({
        type: COURT_EVENTS.heirDied.type,
        subjects: [p.ref],
        place: placeOf(ctx, p),
        causes: [{ ref: p.ruler.event, role: "enabler", weight: 1 }],
        ...(c.heir === null ? { importance: 4 } : {}),
        data: { realm: realmName(p), fig: heirGone.fig, who: heirGone.who, age: heirGone.age },
      });
      told(c, event);
    }
    if (c.regent !== null && year - p.ruler.born >= life.adulthood) c.regent = null;
    if ((year + key) % COURT.reckonEvery === 0) reckon(ctx, p, c, t);
    // A rival moves when the numbers say the seat is weak.
    const o = orders?.of(p.ref),
      f = figureOf(c, c.rival);
    if (!o || !f || c.plot || c.quiet > year || f.seat === "the army" || year - p.founded < 5)
      continue;
    const danger = dangerOf(ctx, p, c, f, o),
      chance = plotChance(danger.score);
    if (!(chance > 0 && world.rng.real(PLOT, key, t, 0) < chance)) continue;
    rivalMoves(ctx, p, c, f, o, t);
  }
}

/** A rival moves: its odds drawn and why it moved kept, a year before it comes to its end. */
export function rivalMoves(
  ctx: PopulationContext,
  p: Polity,
  c: Court,
  f: CourtFigure,
  o: RealmOrder,
  t: SimTime,
): void {
  const { world } = ctx,
    danger = dangerOf(ctx, p, c, f, o),
    odds = plotOdds(danger.weight, danger.doubt, danger.tradition),
    won = world.rng.real(PLOT, keyOf(p.ref), t, 1) < odds,
    decision = world.decisions.record({
      rule: "court.plot",
      subject: p.ref,
      outcome: { who: f.name, ruler: p.ruler.name },
      score: danger.score,
      threshold: COURT.line,
      factors: danger.factors,
    });
  begin(ctx, p, c, f, decision, odds, won, false, t);
}

/** A ruler's answer to a plot: "seize" them, or "buy" them off. */
export type CourtAnswerArgs = {
  readonly realm: Ref;
  readonly ruler: string;
  readonly answer: "seize" | "buy";
};
/** A ruler's word on who follows them. */
export type CourtNameArgs = { readonly realm: Ref; readonly ruler: string; readonly fig: number };

/** Why a ruler's word on a plot would not hold (null: it would). */
export function answerProblem(world: World, args: unknown): string | null {
  const bad = rulerProblem(world, args);
  if (bad) return bad;
  const a = args as Partial<CourtAnswerArgs>,
    c = courtOf(world)?.of(a.realm as Ref),
    o = orderOf(world)?.of(a.realm as Ref);
  if (a.answer !== "seize" && a.answer !== "buy") return "they can be seized or bought off";
  if (!c?.plot) return "no plot is afoot";
  if (a.answer === "seize" && o && o.legitimacy < REIGN.wordLine)
    return `Only ${Math.round(o.legitimacy * 100)} in a hundred hold your rule rightful: your word stops at the seat's door, and no one will lay a hand on them.`;
  return null;
}

/** Why a ruler cannot name one as heir (null: they can). */
export function nameProblem(world: World, args: unknown): string | null {
  const bad = rulerProblem(world, args);
  if (bad) return bad;
  const a = args as Partial<CourtNameArgs>,
    c = courtOf(world)?.of(a.realm as Ref),
    o = orderOf(world)?.of(a.realm as Ref),
    f = c && typeof a.fig === "number" ? figureOf(c, a.fig) : undefined;
  if (!f) return "they are not at court";
  if (o && o.legitimacy < REIGN.wordLine)
    return `Only ${Math.round(o.legitimacy * 100)} in a hundred hold your rule rightful: your word stops at the seat's door.`;
  return null;
}

/** Teach a peopled world its courts, and a ruler's word in them. */
export function installCourts(world: World, ctx: () => PopulationContext): CourtStore {
  const store = world.register(new CourtStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "189.strife.court", every: YEAR, run: (t) => courtYear(ctx(), t) });
  world.defineCommand({
    type: "court.answer",
    validate: (args) => answerProblem(world, args),
    apply: (command, t) => {
      const a = command.args as CourtAnswerArgs,
        c = ctx(),
        r = politiesOf(world).get(a.realm)!,
        court = store.of(r.ref)!,
        o = orderOf(world)?.of(r.ref),
        plot = court.plot!,
        f = figureOf(court, plot.by)!,
        year = yearOfMoment(t),
        weight = weightOf(f.sway),
        cause: CauseRef[] = [
          { ref: command.id, role: "agent", weight: 1 },
          { ref: plot.event, role: "trigger", weight: 1 },
        ],
        cost = a.answer === "seize" ? seizeCost(weight) : COURT.buyCost;
      if (o) o.legitimacy = clamp(0.02, 0.98, o.legitimacy - cost);
      const event = world.events.emit({
        type: a.answer === "seize" ? COURT_EVENTS.found.type : COURT_EVENTS.bought.type,
        subjects: [r.ref],
        place: placeOf(c, r),
        causes: cause,
        data: {
          realm: realmName(r),
          fig: f.id,
          who: f.name,
          seat: f.seat,
          ruler: r.ruler.name,
          by: r.ruler.name,
        },
      });
      told(court, event);
      court.plot = null;
      if (a.answer === "buy") {
        court.quiet = year + COURT.quietBought;
        return;
      }
      court.quiet = year + COURT.quietFound;
      letGo(court, f, year, fled(c, r, f, event, t, 9) ? "fled" : "found", event);
    },
  });
  world.defineCommand({
    type: "court.name",
    validate: (args) => nameProblem(world, args),
    apply: (command, t) => {
      const a = command.args as CourtNameArgs,
        c = ctx(),
        r = politiesOf(world).get(a.realm)!,
        court = store.of(r.ref)!,
        o = orderOf(world)?.of(r.ref),
        f = figureOf(court, a.fig)!,
        event = world.events.emit({
          type: COURT_EVENTS.heir.type,
          subjects: [r.ref],
          place: placeOf(c, r),
          causes: [{ ref: command.id, role: "agent", weight: 1 }],
          data: { realm: realmName(r), fig: f.id, who: f.name, by: r.ruler.name },
        });
      told(court, event);
      if (o && court.heirBy !== "word") o.legitimacy = clamp(0.02, 0.98, o.legitimacy - COURT.nameCost);
      court.heir = f.id;
      court.heirBy = "word";
      if (court.rival === f.id) court.rival = null;
    },
  });
  return store;
}
