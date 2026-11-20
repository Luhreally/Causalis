// The god's acts on one person (asked 2026-11-16: "if i have them pinned i should be able to bless, curse, inspire, play as them
// all that good stuff aswell"): a ruler, one of a court, one under the hand, one of a town's many. Each is a logged command whose
// event cites it, and what it does is bounded and lasts so many years, laid on the very draws that already decide a life:
//   - a blessing halves the chance their death rule draws against each year (BLESS_BY), a curse doubles it, for ACT_YEARS;
//   - protection spares them the next death by violence the world draws for them: a ruler's at a seat seized (the night they did
//     not live), one under the hand's where the draw fell in the share the land's killing gave it; it lasts PROTECT_YEARS or until used;
//   - healing lifts the wounds one under the hand carries;
//   - smiting ends them at their next reckoning (a ruler's or a court's at the year's turn, one under the hand's at the month's
//     end), told as struck by the god;
//   - inspiring: their land comes upon the next thing it could know, as one inspired under the hand does;
//   - a whisper to a ruler: their next choice of war doubled, or no war of their choosing while it holds (the war rule's own draw).
// Nothing is kept, nothing is hashed, not even a name, while no act holds anywhere: a world no one touches runs exactly as before,
// and every factor read here is exactly 1 where none holds.
import { notableRef, notablesOf } from "../notable/kept.ts";
import { favourNotable, strikeNotable } from "../notable/notables.ts";
import {
  YEAR,
  defineEventType,
  yearOfMoment,
  type Hasher,
  type Ref,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { politiesOf, realmName } from "../polity/polity.ts";
import { courtFigureDies, courtOf } from "../court/court.ts";
import { rulerDies } from "../polity/polity.ts";
import { bandOfAge, handOf } from "../hand/hand.ts";
import { handAgentDies } from "../hand/possess.ts";
import { underworldOf, type CrimeGroup } from "../order/underworld-kept.ts";
import { orgsOf, type Org } from "../order/groups-kept.ts";
import { housesOf } from "../order/houses.ts";
import { ORG, ORG_AIMS, UNDER } from "../../rules/index.ts";

import { loreOf } from "../lore/lore.ts";
import { agentName, nextPrinciple } from "./local.ts";
import { DeathNotes, deathNotesOf } from "../hand/deaths.ts";

export const PERSON_ACT_EVENTS = {
  /** An act of the god on one person. */
  act: defineEventType("person.act", 5),
  /** One the god protected, spared a death by violence. */
  spared: defineEventType("person.spared", 5),
  /** One struck down by the god. */
  struck: defineEventType("person.struck", 5),
  /** An act's years run out. */
  lifted: defineEventType("person.act-lifted", 3),
};

export const PERSON_ACTS = [
  "bless",
  "curse",
  "protect",
  "heal",
  "smite",
  "inspire",
  "whisper",
] as const;
export type PersonActKind = (typeof PERSON_ACTS)[number];

/** How long a blessing, a curse or a whisper holds, and a protection waits to be used, in years. */
export const ACT_YEARS = 10,
  PROTECT_YEARS = 20;
/** What a blessing and a curse lay on the chance their death rule draws against. */
export const BLESS_BY = 0.5,
  CURSE_BY = 2;
/** What a whisper to war lays on the war rule's chance for their realm (one to hold from war: none). */
export const WHISPER_WAR = 2,
  WHISPER_PEACE = 0;

/** An act on one person, and what has become of it. */
export type PersonAct = {
  /** Their page's ref: `rule:<realm>`, `court:<realm>:<id>`, `agent:<id>`, `folk:town:…`. */
  readonly ref: string;
  /** Which of them: a ruler's coming to rule (a seat's ref names whoever holds it), the town under the hand; else null. */
  readonly of: string | null;
  readonly kind: PersonActKind;
  readonly name: string;
  /** The year it was done, and the year it lifts (exclusive). */
  readonly from: number;
  readonly until: number;
  readonly command: Ref;
  readonly event: Ref;
  /** A whisper's aim. */
  readonly aim?: string;
  /** The event it was spent by (protection, a smiting, a whisper to war). */
  used?: Ref;
};

export class PersonActStore implements StateStore {
  readonly name = "acts.persons";
  private list: PersonAct[] = [];

  all(): readonly PersonAct[] {
    return this.list;
  }
  add(a: PersonAct): void {
    this.list.push(a);
  }
  drop(a: PersonAct): void {
    this.list = this.list.filter((x) => x !== a);
  }
  /** What holds on one in a year (none, nearly always). */
  on(ref: string, of: string | null, year: number): PersonAct[] {
    if (!this.list.length) return [];
    return this.list.filter(
      (a) => a.ref === ref && (a.of === null || a.of === of) && year < a.until && !a.used,
    );
  }
  /** Every act ever done on one, that history still keeps (spent and lifted among them). */
  ever(ref: string): PersonAct[] {
    return this.list.filter((a) => a.ref === ref);
  }
  pinned(): Ref[] {
    return this.list.flatMap((a) => [a.event, ...(a.used ? [a.used] : [])]);
  }
  /** No act holds: nothing in a world's hash, not even a name. */
  dormant(): boolean {
    return !this.list.length;
  }
  hashInto(h: Hasher): void {
    h.value(this.list);
  }
  save(): unknown {
    return this.list.length ? { list: this.list } : {};
  }
  load(state: unknown): void {
    this.list = ((state as { list?: PersonAct[] } | null)?.list ?? []).map((a) => ({ ...a }));
  }
}

export function personActsOf(world: World): PersonActStore | null {
  return world.peek<PersonActStore>("acts.persons") ?? null;
}

/** What the god's blessings and curses lay on one's chance of death this year: exactly 1 where none holds. */
export function hazardBy(world: World, ref: string, of: string | null, year: number): number {
  const store = personActsOf(world);
  if (!store || store.dormant()) return 1;
  let by = 1;
  for (const a of store.on(ref, of, year))
    if (a.kind === "bless") by *= BLESS_BY;
    else if (a.kind === "curse") by *= CURSE_BY;
  return by;
}

/** The act of a kind that holds on one now, unspent (null: none). */
export function actOn(
  world: World,
  ref: string,
  of: string | null,
  year: number,
  kind: PersonActKind,
): PersonAct | null {
  const store = personActsOf(world);
  if (!store || store.dormant()) return null;
  return store.on(ref, of, year).find((a) => a.kind === kind) ?? null;
}

/** A ruler's whisper on their realm's war rule now: what it lays on the chance (1: none), and its act. */
export function whisperOn(
  world: World,
  realm: Ref,
  ruler: Ref,
  year: number,
): { by: number; act: PersonAct | null } {
  const a = whisperIn(world, `rule:${realm}`, ruler, year, "war");
  if (!a) return { by: 1, act: null };
  return { by: a.aim === "peace" ? WHISPER_PEACE : WHISPER_WAR, act: a };
}

/** Which of a person's choices a whisper is to: its family ("war": to war or to peace; "law", "tariff", "bar", "wed", "aim"). */
export const whisperFamily = (aim: string): string =>
  aim === "war" || aim === "peace" ? "war" : (aim.split(":")[0] ?? aim);

/** The whisper of a family that holds on one now, unspent (null: none). */
export function whisperIn(
  world: World,
  ref: string,
  of: string | null,
  year: number,
  family: string,
): PersonAct | null {
  const store = personActsOf(world);
  if (!store || store.dormant()) return null;
  return (
    store
      .on(ref, of, year)
      .find(
        (a) => a.kind === "whisper" && a.aim !== undefined && whisperFamily(a.aim) === family,
      ) ?? null
  );
}

/**
 * What the god's blessings and curses lay on one's fortunes this year (asked 2026-11-16: "bless and curse reach more than death"):
 * a blessing doubles what goes their way (their host in battle, a child to their line, their group's strength), a curse halves it.
 * Exactly 1 where none holds. What goes against them (death, plots and coups, being taken) is hazardBy's, the other way.
 */
export function luckBy(world: World, ref: string, of: string | null, year: number): number {
  const store = personActsOf(world);
  if (!store || store.dormant()) return 1;
  let by = 1;
  for (const a of store.on(ref, of, year))
    if (a.kind === "bless") by /= BLESS_BY;
    else if (a.kind === "curse") by /= CURSE_BY;
  return by;
}

/** The fortunes of a realm's ruler now, in battle (luckBy on `rule:<realm>`): exactly 1 where none holds. */
export const rulerLuck = (world: World, realm: Ref, ruler: Ref, year: number): number =>
  luckBy(world, `rule:${realm}`, ruler, year);
/** What the god lays on plots and coups against a realm's ruler now (hazardBy): exactly 1 where none holds. */
export const rulerHazard = (world: World, realm: Ref, ruler: Ref, year: number): number =>
  hazardBy(world, `rule:${realm}`, ruler, year);

/** An act spent: by the event that spent it. */
export function spend(a: PersonAct, event: Ref): void {
  a.used = event;
}

/** The kinds of person the god acts on. */
export type PersonKind = "ruler" | "court" | "agent" | "holder" | "boss" | "house" | "notable";

export function personKind(ref: string): PersonKind | null {
  if (ref.startsWith("rule:pol:")) return "ruler";
  if (/^court:pol:\d+:\d+:\d+$/.test(ref)) return "court";
  if (/^agent:\d+$/.test(ref)) return "agent";
  if (ref.startsWith("folk:town:")) return "holder";
  // (One the world keeps by name: sim/notable. Their page's ref is the host's, `note:named:<id>`.)
  if (/^note:named:\d+$/.test(ref)) return "notable";
  if (/^boss:pol:\d+:\d+:ev:\d+:\d+$/.test(ref)) return "boss";
  if (/^dyn:pol:\d+:\d+:ev:\d+:\d+$/.test(ref)) return "house";
  return null;
}

/** A boss's or a group leader's ref, by their group's realm and the event it rose by: whoever heads it now. */
export const bossRef = (realm: string, event: string): string => `boss:${realm}:${event}`;
function parseBoss(ref: string): { realm: Ref; event: Ref } | null {
  const m = /^boss:(pol:\d+:\d+):(ev:\d+:\d+)$/.exec(ref);
  return m ? { realm: m[1] as Ref, event: m[2] as Ref } : null;
}

/** A group's head by their ref: an underworld group's boss, or a group's leader (null: no group so). */
export function groupOfBoss(
  world: World,
  ref: string,
):
  | { readonly kind: "under"; readonly g: CrimeGroup; readonly realm: Ref }
  | { readonly kind: "org"; readonly g: Org; readonly realm: Ref }
  | null {
  const at = parseBoss(ref);
  if (!at) return null;
  const crime = underworldOf(world)
    ?.of(at.realm)
    ?.groups.find((g) => g.event === at.event);
  if (crime) return { kind: "under", g: crime, realm: at.realm };
  const org = orgsOf(world)
    ?.of(at.realm)
    ?.orgs.find((g) => g.event === at.event);
  return org ? { kind: "org", g: org, realm: at.realm } : null;
}

/**
 * Which acts reach each kind of person, and why the rest do not. One of a court has no protection: no death by violence is drawn
 * for them (a move found puts them out of the court, a purge ends a house's hold, and neither draws a death).
 */
export const ACTS_FOR: Readonly<Record<PersonKind, readonly PersonActKind[]>> = {
  ruler: ["bless", "curse", "protect", "smite", "inspire", "whisper"],
  court: ["bless", "curse", "smite", "inspire"],
  agent: ["bless", "curse", "protect", "heal", "smite", "inspire"],
  holder: ["inspire"],
  boss: ["bless", "curse", "protect", "smite", "whisper"],
  house: ["whisper"],
  notable: ["bless", "curse", "protect", "smite", "inspire"],
};

/** The whispers each kind of person can be given (a group leader's: toward each aim but its first; a boss's: none of choice). */
export function whispersFor(world: World, kind: PersonKind, ref: string): string[] {
  if (kind === "ruler")
    return [
      "war",
      "peace",
      "goal:land",
      "goal:tribute",
      "goal:back",
      "terms:truce",
      "law:reform",
      "law:hold",
      "tariff:raise",
      "tariff:lower",
      "bar:ban",
      "bar:lift",
    ];
  if (kind === "house") {
    // (A house that holds the seat weds into none: its heirs are the realm's.)
    const m = /^dyn:(pol:\d+:\d+):(ev:\d+:\d+)$/.exec(ref),
      h = m
        ? housesOf(world)
            ?.of(m[1] as Ref)
            ?.houses.find((x) => x.event === m[2])
        : undefined;
    return h && !h.crown ? ["wed", "wed:alone"] : [];
  }
  if (kind === "boss") {
    const at = groupOfBoss(world, ref);
    if (at?.kind !== "org") return [];
    const first = ORG_AIMS[at.g.aim];
    return ORG_AIMS.filter((x) => x !== first).map((x) => `aim:${x}`);
  }
  return [];
}

/** One the god can act on, as history holds them now: their name, which of them, and their land (null: none such). */
export function personNow(
  c: PopulationContext,
  ref: string,
): {
  readonly kind: PersonKind;
  readonly name: string;
  readonly of: string | null;
  readonly cell: number;
  readonly subject: Ref;
  readonly fig?: number;
} | null {
  const world = c.world,
    kind = personKind(ref);
  if (kind === "ruler") {
    const r = politiesOf(world).get(ref.slice(5) as Ref);
    return r && r.ended === null
      ? { kind, name: r.ruler.name, of: r.ruler.event, cell: r.seat, subject: r.ref }
      : null;
  }
  if (kind === "court") {
    const parts = ref.split(":"),
      realm = `${parts[1]}:${parts[2]}:${parts[3]}` as Ref,
      id = Number(parts[4]),
      r = politiesOf(world).get(realm),
      f = courtOf(world)
        ?.of(realm)
        ?.figures.find((x) => x.id === id);
    return r && r.ended === null && f
      ? { kind, name: f.name, of: null, cell: r.seat, subject: r.ref, fig: id }
      : null;
  }
  if (kind === "agent") {
    const w = handOf(world).resting,
      id = Number(ref.slice(6)),
      a = w?.agents.find((x) => x.id === id);
    return w && a
      ? {
          kind,
          name: agentName(c, a, c.settlements.get(w.village)!),
          of: w.village,
          cell: w.cell,
          subject: w.village,
        }
      : null;
  }
  if (kind === "holder") {
    // (Kept by their line, which history does not hold: their town, and the name their page gives them.)
    const m = /^folk:(town:\d+:\d+):\d+:\d+$/.exec(ref),
      s = m ? c.settlements.get(m[1] as Ref) : undefined;
    return s ? { kind, name: s.name, of: null, cell: s.cell, subject: s.ref } : null;
  }
  if (kind === "boss") {
    // (Whoever heads the group now: an act is laid on them by name, and does not pass to the next.)
    const at = groupOfBoss(world, ref),
      r = at ? politiesOf(world).get(at.realm) : undefined;
    if (!at || !r || r.ended !== null) return null;
    const head = at.kind === "under" ? at.g.boss : at.g.leader;
    return { kind, name: head.name, of: head.name, cell: at.g.home, subject: r.ref };
  }
  if (kind === "notable") {
    const id = Number(ref.slice("note:named:".length)),
      n = notablesOf(world)?.get(id);
    return n
      ? { kind, name: n.name, of: null, cell: n.home, subject: notableRef(id), fig: id }
      : null;
  }
  if (kind === "house") {
    const m = /^dyn:(pol:\d+:\d+):(ev:\d+:\d+)$/.exec(ref),
      r = m ? politiesOf(world).get(m[1] as Ref) : undefined,
      h = m
        ? housesOf(world)
            ?.of(m[1] as Ref)
            ?.houses.find((x) => x.event === m[2])
        : undefined;
    return r && r.ended === null && h
      ? { kind, name: `the house of ${h.name}`, of: null, cell: h.seat, subject: r.ref }
      : null;
  }
  return null;
}

/** The args of an act on a person: who, what, and a whisper's aim; and for one of a town's many, their name as their page says it. */
export type PersonActArgs = {
  ref: string;
  kind: PersonActKind;
  aim?: string;
  name?: string;
};

/** Why an act cannot be done on one (null: it can). */
export function personActProblem(c: PopulationContext, args: unknown): string | null {
  const a = args as Partial<PersonActArgs> | null;
  if (typeof a?.ref !== "string") return "a person's ref is wanted";
  if (!(PERSON_ACTS as readonly string[]).includes(String(a.kind)))
    return `an act is one of ${PERSON_ACTS.join(", ")}`;
  const ref = a.ref,
    who = personNow(c, ref);
  if (!who) return "no one living history holds by that ref";
  const kind = a.kind as PersonActKind;
  if (!ACTS_FOR[who.kind].includes(kind)) return `that act does not reach ${whoWords(who.kind)}`;
  const year = yearOfMoment(c.world.now);
  if (kind === "whisper") {
    const aims = whispersFor(c.world, who.kind, ref);
    if (typeof a.aim !== "string" || !aims.includes(a.aim))
      return aims.length
        ? `a whisper is one of ${aims.join(", ")}`
        : "they make no choice a whisper reaches";
    if (whisperIn(c.world, ref, who.of, year, whisperFamily(a.aim)))
      return "a whisper on that choice holds on them already";
  }
  if (kind === "heal") {
    const w = handOf(c.world).resting,
      ag = w?.agents.find((x) => x.id === Number(ref.slice(6)));
    if (!ag?.struck?.length) return "they carry no wound to lift";
  }
  if (kind === "inspire" && !nextPrinciple(c, who.cell))
    return "their land has nothing it could come to know next";
  if (["protect", "smite"].includes(kind) && actOn(c.world, ref, who.of, year, kind))
    return "that holds on them already";
  return null;
}

/** Whether a smiting ends them at once (else at their group's next reckoning: a boss's, a group leader's). */
export const smitesAtOnce = (kind: PersonKind): boolean => kind !== "boss";
/** How often a group is reckoned, the most a smiting on its head waits (rules: UNDER.every, ORG.every). */
const GROUP_EVERY = Math.max(UNDER.every, ORG.every);

const whoWords = (k: PersonKind) =>
  ({
    ruler: "a ruler",
    court: "one of a court",
    agent: "one under your hand",
    holder: "one of a town's many: lay your hand on their town and every act reaches them",
    boss: "the head of a group",
    house: "a house",
    notable: "one known by name",
  })[k];

/** Teach a peopled world the god's acts on one person. */
export function installPersonActs(world: World, ctx: () => PopulationContext): void {
  const store = world.register(new PersonActStore());
  // (How those under the hand died, as their draws stood: a reading beside the world, sim/hand/deaths.ts.)
  world.register(new DeathNotes());
  world.addPinner(() => store.pinned());
  world.defineCommand({
    type: "act.person",
    validate: (args) => personActProblem(ctx(), args),
    apply: (command, t) => {
      const c = ctx(),
        a = command.args as PersonActArgs,
        who = personNow(c, a.ref)!,
        year = yearOfMoment(t),
        kind = a.kind,
        until =
          kind === "protect"
            ? year + PROTECT_YEARS
            : kind === "bless" || kind === "curse" || kind === "whisper"
              ? year + ACT_YEARS
              : kind === "smite"
                ? year + (smitesAtOnce(who.kind) ? 2 : GROUP_EVERY + 1)
                : year + 1,
        name = a.name && who.kind === "holder" ? a.name : who.name,
        place = c.provinces.get(who.cell)?.ref ?? null,
        r =
          who.kind === "ruler" || who.kind === "court" ? politiesOf(world).get(who.subject) : null,
        event = world.events.emit({
          type: PERSON_ACT_EVENTS.act.type,
          subjects: [who.subject],
          place,
          causes: [{ ref: command.id, role: "agent", weight: 1 }],
          data: {
            kind,
            who: a.ref,
            name,
            until,
            ...(a.aim ? { aim: a.aim } : {}),
            ...(who.fig !== undefined ? { fig: who.fig } : {}),
            ...(r ? { realm: realmName(r) } : {}),
          },
        });
      // (A blessing and a curse each take the other's place.)
      if (kind === "bless" || kind === "curse")
        for (const x of store.on(a.ref, who.of, year))
          if (x.kind === "bless" || x.kind === "curse") store.drop(x);
      const act: PersonAct = {
        ref: a.ref,
        of: who.of,
        kind,
        name,
        from: year,
        until,
        command: command.id,
        event,
        ...(a.aim ? { aim: a.aim } : {}),
      };
      // Healing and inspiring are done at once, and kept as done.
      if (kind === "heal") {
        const ag = handOf(world).resting!.agents.find((x) => x.id === Number(a.ref.slice(6)))!;
        delete ag.struck;
        act.used = event;
      }
      if (kind === "inspire") {
        const next = nextPrinciple(c, who.cell)!,
          found = world.events.emit({
            type: "lore.found",
            place,
            causes: [{ ref: event, role: "trigger", weight: 1 }],
            data: { principle: next.id },
          });
        loreOf(world).learn(who.cell, next.id, { year, event: found }, next);
        act.used = found;
      }
      store.add(act);
      // (One the world keeps by name carries a blessing, a curse or a guard on their own record, where their year reads it.)
      if (who.kind === "notable" && (kind === "bless" || kind === "curse" || kind === "protect"))
        favourNotable(world, who.fig!, kind, until, event);
      // A smiting ends them at the act's moment, by their own death's path: the seat passes, the court names its next, the
      // hand lets them go. (A group's head is struck at its next reckoning: its successor is its reckoning's to name.)
      if (kind === "smite" && smitesAtOnce(who.kind)) {
        const struck = struckBy(world, act, who.subject, place, {
          ...(r ? { realm: realmName(r) } : {}),
          ...(who.fig !== undefined ? { fig: who.fig } : {}),
          now: 1,
        });
        if (who.kind === "notable") strikeNotable(c, who.fig!, "struck", struck, t);
        else if (who.kind === "ruler") rulerDies(c, r!, t, struck);
        else if (who.kind === "court") courtFigureDies(c, r!, who.fig!, t, struck);
        else if (who.kind === "agent") {
          const w = handOf(world).resting!,
            ag = w.agents.find((x) => x.id === Number(a.ref.slice(6)))!;
          handAgentDies(c, w, ag, year);
          deathNotesOf(world)?.add({
            village: w.village,
            id: ag.id,
            t,
            year,
            age: year - ag.birthYear,
            band: bandOfAge(year - ag.birthYear, c.life),
            event: struck,
            how: "struck",
          });
        }
      }
    },
  });
  // At each year's turn, what has lifted is let go: told where it held for years, kept a while as done.
  world.system({
    key: "168.acts.persons",
    every: YEAR,
    run: (t) => {
      if (!store.all().length) return;
      const year = yearOfMoment(t),
        c = ctx();
      for (const a of [...store.all()]) {
        if (year < a.until) continue;
        if (!a.used && (a.kind === "bless" || a.kind === "curse" || a.kind === "whisper")) {
          const who = personNow(c, a.ref);
          world.events.emit({
            type: PERSON_ACT_EVENTS.lifted.type,
            subjects: who ? [who.subject] : [],
            place: who ? (c.provinces.get(who.cell)?.ref ?? null) : null,
            causes: [{ ref: a.event, role: "agent", weight: 1 }],
            data: { kind: a.kind, who: a.ref, name: a.name },
          });
        }
        // (What was done is remembered on their page for as long again, then let go.)
        if (year >= a.until + (a.until - a.from)) store.drop(a);
        else a.used ??= a.event;
      }
    },
  });
}

/** The god struck them down: told, and the event their death stands on. */
export function struckBy(
  world: World,
  a: PersonAct,
  subject: Ref,
  place: Ref | null,
  data: Record<string, unknown>,
): Ref {
  const event = world.events.emit({
    type: PERSON_ACT_EVENTS.struck.type,
    subjects: [subject],
    place,
    causes: [{ ref: a.event, role: "trigger", weight: 1 }],
    data: { who: a.ref, name: a.name, ...data },
  });
  spend(a, event);
  return event;
}

/** One the god protected, spared: told, and the protection spent. */
export function sparedBy(
  world: World,
  a: PersonAct,
  subject: Ref,
  place: Ref | null,
  data: Record<string, unknown>,
): Ref {
  const event = world.events.emit({
    type: PERSON_ACT_EVENTS.spared.type,
    subjects: [subject],
    place,
    causes: [{ ref: a.event, role: "agent", weight: 1 }],
    data: { who: a.ref, name: a.name, ...data },
  });
  spend(a, event);
  return event;
}
