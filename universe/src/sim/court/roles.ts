// One of a court played by the god's hand, not the ruler (asked 2026-11-13: "when i rule as ruler or whatever politcal
// member, i should be able to influence the country accordingly depending on role"). Taking one keeps nothing, as taking
// a ruler keeps nothing. What they can do is read off where they stand, never set by hand: a voice of a group at court
// puts a law, the tithe, a war or a peace to the realm, and it carries only if the realm's voices do, their own group's
// counted wholly for it, and, where the ruler rules alone, only if they weigh enough to reach the ruler's ear; anyone
// at court can court a group to stand behind them, if they weigh enough for it to; and one with a claim, an heir, a
// rival, the army's voice, or one with a group behind them, can move on the seat, at the odds any rival's move has, the
// army's voice by turning the host on it. The god's will through them (`channel`) lifts what their station bounds: a
// proposal carries without the voices or the ruler's ear, a group stands behind them, a move on the seat carries.
// Never what the world has to do it with: no war with no land between, no host where no one can be sent, no law that has
// to be written where nothing is written. Every channelled act is told as an omen of its own.
import {
  defineEventType,
  yearOfMoment,
  type Factor,
  type Ref,
  type World,
} from "../../kernel/index.ts";
import { COURT, ROLE, carried, mustCarry } from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { interestsOf } from "../polity/interests.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { orderOf } from "../order/order.ts";
import { LAWS, type Law } from "../order/laws.ts";
import {
  applyDecree,
  applyPeace,
  applyWar,
  channelled,
  decreeProblem,
  godWill,
  lawVoices,
  peaceProblem,
  titheVoices,
  warProblem,
  warVoices,
  type Voices,
} from "../order/reign.ts";
import { warsOf } from "../war/war.ts";
import {
  backingOf,
  courtOf,
  courtTold,
  figureMoves,
  type Court,
  type CourtFigure,
  type CourtSeat,
} from "./court.ts";

export const ROLE_EVENTS = {
  /** A group come to stand behind one of a court. */
  backed: defineEventType("court.backed", 3),
};

/** Who a command is done as: one of a court, by their number and name. */
export type RoleArgs = {
  readonly realm: Ref;
  readonly fig: number;
  readonly name: string;
  readonly channel?: boolean;
};
/** What is put to the realm: a law's step, the tithe, a war on a realm, a truce with one. */
export type ProposeArgs = RoleArgs & {
  readonly what: "law" | "tithe" | "war" | "peace";
  readonly law?: Law;
  readonly to?: number;
  readonly against?: Ref;
  readonly prize?: number;
};
export type BackArgs = RoleArgs & { readonly group: CourtSeat };

/** What one of a court is, in the drama: their part, read off the court. */
export type RoleKind = "heir" | "rival" | "general" | "voice" | "kin";

export function roleKind(c: Court, f: CourtFigure): RoleKind {
  if (f.id === c.heir) return "heir";
  if (f.id === c.rival) return "rival";
  if (f.seat === "the army") return "general";
  return f.seat === "house" ? "kin" : "voice";
}

/** One of a court, as they stand: their part, their weight and those behind them, whether the ruler hears them. */
export type RoleStation = {
  readonly kind: RoleKind;
  readonly seat: CourtSeat;
  /** Their own group's share of the realm's sway (0 for one of the house), and that of those behind them. */
  readonly sway: number;
  readonly backing: number;
  readonly grown: boolean;
  /** Whether the ruler rules alone, and whether such a ruler hears them. */
  readonly alone: boolean;
  readonly heard: boolean;
  /** Whether they could move on the seat at all: an heir, a rival, the army's voice, or one with a group behind them. */
  readonly claim: boolean;
  /** The groups heard at court that they could court, and what each weighs. */
  readonly groups: readonly {
    readonly group: CourtSeat;
    readonly sway: number;
    readonly behind: boolean;
  }[];
};

const pct = (x: number) => Math.round(x * 100);

const figureOf = (c: Court, id: unknown): CourtFigure | undefined =>
  typeof id === "number" ? c.figures.find((f) => f.id === id) : undefined;

/** One of a court and their realm, if they are still at it (else why not). */
export function roleHeld(
  world: World,
  args: unknown,
): { r: Polity; c: Court; f: CourtFigure } | string {
  const a = args as Partial<RoleArgs> | null,
    r = typeof a?.realm === "string" ? politiesOf(world).get(a.realm) : undefined;
  if (!r || r.ended !== null) return "that realm has fallen";
  const c = courtOf(world)?.of(r.ref),
    f = c ? figureOf(c, a?.fig) : undefined;
  if (!c || !f || f.name !== a?.name) return `${String(a?.name)} is no longer at its court`;
  return { r, c, f };
}

/** Where one of a court stands now. */
export function roleStationOf(
  ctx: PopulationContext,
  r: Polity,
  c: Court,
  f: CourtFigure,
): RoleStation {
  const year = yearOfMoment(ctx.world.now),
    interests = interestsOf(ctx, r, ctx.world.now),
    swayOf = (g: string) => interests.find((i) => i.group === g)?.sway ?? 0,
    sway = f.seat === "house" ? 0 : f.sway,
    backing = backingOf(f),
    alone = mustCarry(r.leadership, r.succession) === 0,
    kind = roleKind(c, f);
  return {
    kind,
    seat: f.seat,
    sway,
    backing,
    grown: year - f.born >= ctx.life.adulthood,
    alone,
    heard: !alone || f.id === c.heir || sway + backing >= ROLE.ear,
    claim: kind === "heir" || kind === "rival" || kind === "general" || backing > 0,
    groups: COURT.voices
      .filter((g) => g !== f.seat)
      .map((g) => ({
        group: g as CourtSeat,
        sway: swayOf(g),
        behind: !!f.backing?.some((b) => b.group === g),
      }))
      .filter((g) => g.sway >= COURT.voiceLeast),
  };
}

/** The voices on a proposal, with their own group's and those behind them counted wholly for it. */
export function proposalVoices(
  ctx: PopulationContext,
  r: Polity,
  st: RoleStation,
  a: Partial<ProposeArgs>,
): Voices | null {
  const t = ctx.world.now,
    o = orderOf(ctx.world)?.of(r.ref);
  let v: Voices | null = null;
  if (a.what === "law" && o && typeof a.to === "number")
    v = lawVoices(ctx, r, o, a.law as Law, a.to, t);
  else if (a.what === "tithe" && typeof a.to === "number") v = titheVoices(ctx, r, a.to, t);
  else if (a.what === "war") {
    const foe = typeof a.against === "string" ? politiesOf(ctx.world).get(a.against) : undefined;
    if (foe) v = warVoices(ctx, r, foe, t);
  }
  if (!v) return null;
  const forIt = v.forIt + st.sway + st.backing;
  return { ...v, forIt, share: carried(forIt, v.against) };
}

/** Why a proposal would not carry (null: it would). */
export function proposeProblem(
  ctx: PopulationContext,
  r: Polity,
  c: Court,
  f: CourtFigure,
  a: Partial<ProposeArgs>,
): string | null {
  const st = roleStationOf(ctx, r, c, f),
    channel = !!a.channel,
    t = ctx.world.now,
    realms = politiesOf(ctx.world);
  if (!st.grown) return "You are a child: no one at court hears you yet.";
  if (!channel && st.sway + st.backing <= 0)
    return "You speak for no group at court: court one, and it will speak through you.";
  // What the world has to do it with, first, as a ruler would be told; their station's bounds after.
  let bad: string | null = null;
  if (a.what === "law" || a.what === "tithe") {
    if (a.what === "law" && !(LAWS as readonly unknown[]).includes(a.law))
      return `a law is wanted: ${LAWS.join(", ")}`;
    bad = decreeProblem(ctx, r, a.what === "tithe" ? "tithe" : a.law, a.to, t, true);
  } else if (a.what === "war") {
    const foe = typeof a.against === "string" ? (realms.get(a.against) ?? null) : null;
    bad = warProblem(ctx, r, foe && foe.ended === null ? foe : null, a.prize, t, true);
  } else if (a.what === "peace") {
    const foe = typeof a.against === "string" ? (realms.get(a.against) ?? null) : null;
    bad = peaceProblem(ctx, r, foe && foe.ended === null ? foe : null, "truce", channel);
  } else return "Put a law, the tithe, a war or a peace.";
  if (bad || channel) return bad;
  if (!st.heard)
    return `${r.ruler.name} rules alone, and hears only those who weigh ${pct(ROLE.ear)} in a hundred of the realm's sway: you weigh ${pct(st.sway + st.backing)}${st.backing ? ", with those behind you" : ""}.`;
  if (a.what === "peace") return null;
  const v = proposalVoices(ctx, r, st, a)!;
  if (v.share >= ROLE.majority) return null;
  return `It must carry ${pct(ROLE.majority)} in a hundred of the realm's voices, and with your own it has ${pct(v.share)}${v.names.length ? `: ${v.names.join(" and ")} stand against it` : ""}.`;
}

/** Why a group would not stand behind them (null: it would). */
export function backProblem(
  ctx: PopulationContext,
  r: Polity,
  c: Court,
  f: CourtFigure,
  group: unknown,
  channel: boolean,
): string | null {
  const st = roleStationOf(ctx, r, c, f),
    g = st.groups.find((x) => x.group === group);
  if (!st.grown) return "You are a child: no one at court stands behind a child.";
  if (group === f.seat) return "You are their voice already.";
  if (!g) return "They are not heard at this court.";
  if (g.behind) return `${cap(g.group)} stand behind you already.`;
  if (channel) return null;
  const voice = c.figures.find((x) => x.seat === g.group);
  if (voice && (voice.id === c.rival || voice.id === c.plot?.by))
    return `Their voice, ${voice.name}, wants the seat for themself: ${g.group} will not stand behind another.`;
  const mine = (f.seat === "house" ? f.sway : st.sway) + st.backing;
  if (mine < ROLE.backs * g.sway)
    return `${cap(g.group)} hold ${pct(g.sway)} in a hundred of the realm's sway, and you ${pct(mine)}: they stand behind no one of less than half their weight.`;
  return null;
}

/** Why they could not move on the seat (null: they could). */
export function plotProblem(
  ctx: PopulationContext,
  r: Polity,
  c: Court,
  f: CourtFigure,
  channel: boolean,
): string | null {
  const st = roleStationOf(ctx, r, c, f),
    year = yearOfMoment(ctx.world.now);
  if (!st.grown) return "You are a child: no one would follow a child to the seat.";
  if (c.plot)
    return c.plot.by === f.id ? "Your move is afoot already." : "Another's move is afoot already.";
  if (!orderOf(ctx.world)?.of(r.ref)) return "This realm has no order yet to seize.";
  if (channel) return null;
  if (!st.claim)
    return "You have no claim the court would follow: court a group to stand behind you first.";
  if (c.quiet > year)
    return `No one at court dares move before year ${c.quiet}: the last move is too fresh in mind.`;
  if (
    warsOf(ctx.world)
      .fighting(r.ref)
      .some((w) => w.ended === null && w.civil)
  )
    return "The realm is at war with itself already.";
  return null;
}

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** Teach a peopled world what one of a court can do by the god's hand: "role.propose", "role.back", "role.plot". */
export function installRoles(world: World, ctx: () => PopulationContext): void {
  const held = (args: unknown) => roleHeld(world, args),
    put = (f: CourtFigure, command: Ref, channel: boolean | undefined): Factor[] => [
      {
        name: `put to the realm by ${f.name}`,
        value: 1,
        contribution: 1,
        source: { ref: command, role: "agent", weight: 1 },
      },
      ...godWill(channel),
    ];

  world.defineCommand({
    type: "role.propose",
    validate: (args) => {
      const h = held(args);
      return typeof h === "string" ? h : proposeProblem(ctx(), h.r, h.c, h.f, args as ProposeArgs);
    },
    apply: (command, t) => {
      const a = command.args as ProposeArgs,
        c = ctx(),
        { r, f } = held(a) as { r: Polity; c: Court; f: CourtFigure },
        realms = politiesOf(world),
        word = { by: f.name, cause: command.id, extra: put(f, command.id, a.channel) };
      if (a.what === "war") applyWar(world, c, r, realms.get(a.against!)!, a.prize, t, word);
      else if (a.what === "peace")
        applyPeace(world, c, r, realms.get(a.against!)!, "truce", t, word);
      else applyDecree(world, c, r, a.what === "tithe" ? "tithe" : a.law!, a.to!, t, word);
      if (a.channel) channelled(world, c, r, command.id, f.name, a.what);
    },
  });

  world.defineCommand({
    type: "role.back",
    validate: (args) => {
      const h = held(args);
      if (typeof h === "string") return h;
      const a = args as Partial<BackArgs>;
      return backProblem(ctx(), h.r, h.c, h.f, a.group, !!a.channel);
    },
    apply: (command, t) => {
      const a = command.args as BackArgs,
        c = ctx(),
        { r, c: court, f } = held(a) as { r: Polity; c: Court; f: CourtFigure },
        g = roleStationOf(c, r, court, f).groups.find((x) => x.group === a.group)!,
        event = world.events.emit({
          type: ROLE_EVENTS.backed.type,
          subjects: [r.ref],
          place: c.provinces.get(r.seat)?.ref ?? null,
          causes: [{ ref: command.id, role: "agent", weight: 1 }],
          data: { realm: realmName(r), fig: f.id, who: f.name, group: a.group, sway: g.sway },
        });
      f.backing = [
        ...(f.backing ?? []),
        { group: a.group, sway: g.sway, year: yearOfMoment(t), event },
      ];
      courtTold(court, event);
      if (a.channel) channelled(world, c, r, command.id, f.name, "back");
    },
  });

  world.defineCommand({
    type: "role.plot",
    validate: (args) => {
      const h = held(args);
      return typeof h === "string"
        ? h
        : plotProblem(ctx(), h.r, h.c, h.f, !!(args as RoleArgs).channel);
    },
    apply: (command, t) => {
      const a = command.args as RoleArgs,
        c = ctx(),
        { r, c: court, f } = held(a) as { r: Polity; c: Court; f: CourtFigure };
      figureMoves(c, r, court, f, orderOf(world)!.of(r.ref)!, t, command.id, !!a.channel);
      if (a.channel) channelled(world, c, r, command.id, f.name, "plot");
    },
  });
}
