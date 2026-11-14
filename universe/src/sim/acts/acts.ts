// The god's acts on the aggregate (docs/architecture §3.1, §9): a grammar of target
// (a province) × domain (the rain, the harvest, health, knowledge) × sign ×
// duration. Each is a logged command; applying it records the act as an event that
// cites the command, and from then on the owning system reads it through its
// ordinary inputs — a rate on the rain, a rate on the harvest, a rate on deaths, a
// way of life granted — so what follows is the simulation's own, and every
// consequence cites the act.
import {
  YEAR,
  defineEventType,
  dmath,
  type Hasher,
  type Ref,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { cellRef } from "../../gen/index.ts";
import { FORTUNE_STRENGTHS } from "./fortune.ts";

export const ACT_KINDS = ["rain", "harvest", "plague", "inspire"] as const;
export type ActKind = (typeof ACT_KINDS)[number];

export const ACT_EVENTS = {
  rain: defineEventType("act.rain", 5),
  harvest: defineEventType("act.harvest", 5),
  plague: defineEventType("act.plague", 5),
  inspire: defineEventType("act.inspire", 5),
};

/** An act in force: where, what, which way, until when, and the event that records it. */
export type Act = {
  readonly command: Ref;
  readonly event: Ref;
  readonly kind: ActKind;
  readonly cell: number;
  /** +1 gives (rain, a good harvest, healing), −1 takes away (drought, blight, plague). */
  readonly sign: 1 | -1;
  readonly from: number;
  readonly until: number;
  /** How strong it was laid, where not at the strength it always had (1: absent). */
  readonly strength?: number;
};

export type ActArgs = { cell: number; sign: 1 | -1; years: number; strength?: number };

/**
 * How strong one of the god's acts can be laid (asked 2026-11-13: sliders on the god's hand), weakest first: 1 is the
 * strength it always had, and is what it does when none is asked. The same stops as a realm's fortune.
 */
export const ACT_STRENGTHS = FORTUNE_STRENGTHS;
/** Why a strength asked is not one an act is laid at (null: it is, or none was asked). */
export function strengthProblem(args: unknown): string | null {
  const s = (args as { strength?: unknown } | null)?.strength;
  return s === undefined ||
    (typeof s === "number" && (ACT_STRENGTHS as readonly number[]).includes(s))
    ? null
    : `a strength is one of ${ACT_STRENGTHS.join(", ")}`;
}
/** A strength asked of an act (1 where none was). */
export const actStrengthOf = (args: unknown): number => {
  const s = (args as { strength?: unknown } | null)?.strength;
  return typeof s === "number" ? s : 1;
};
/** What a strength other than the one of old adds to an act's record and its event (nothing at 1). */
export const strengthMark = (s: number): { strength?: number } => (s === 1 ? {} : { strength: s });
/**
 * How an act moves what it touches at its strength: raised by `k` (sent rain, a fat harvest, a plague's deaths) a
 * strength of 1 + k·s; lowered by `k` (rain withheld, blight, healing) to (1 − k)^s, so no strength takes it below nothing.
 * At the strength of old, exactly 1 ± k.
 */
export function actFactor(raise: boolean, k: number, s: number | undefined): number {
  if (s === undefined || s === 1) return raise ? 1 + k : 1 - k;
  return raise ? 1 + k * s : dmath.pow(1 - k, s);
}

/** A crater a meteor left (Phase 13 M112): its land, its year, the event. */
export type Crater = { readonly cell: number; readonly year: number; readonly event: Ref };

export class ActStore implements StateStore {
  readonly name = "acts.active";
  private list: Act[] = [];
  /** The same acts by land, in the order laid (derived: neither hashed nor saved). */
  private byCell = new Map<number, Act[]>();
  /** The craters meteors left, on the map for ever (hashed and saved only once there are any). */
  private pits: Crater[] = [];
  /**
   * What the god has changed in a nature (Phase 16): a person's ways of being, a lineage's
   * docility and growth — by ref, each trait's push, and the acts that pushed (hashed and
   * saved only once there are any).
   */
  private natures = new Map<string, { traits: Record<string, number>; events: Ref[] }>();

  add(a: Act): void {
    this.list.push(a);
    const here = this.byCell.get(a.cell);
    if (here) here.push(a);
    else this.byCell.set(a.cell, [a]);
  }

  all(): readonly Act[] {
    return this.list;
  }

  addCrater(c: Crater): void {
    this.pits.push(c);
  }

  craters(): readonly Crater[] {
    return this.pits;
  }

  /** The god's pushes to a nature, by trait (undefined: none). */
  nature(ref: string): Readonly<Record<string, number>> | undefined {
    return this.natures.get(ref)?.traits;
  }

  /** The acts that pushed a nature. */
  natureEvents(ref: string): readonly Ref[] {
    return this.natures.get(ref)?.events ?? [];
  }

  /** Push one trait of a nature by `amount`, remembering the act's event. */
  pushNature(ref: string, trait: string, amount: number, event: Ref): void {
    let n = this.natures.get(ref);
    if (!n) this.natures.set(ref, (n = { traits: {}, events: [] }));
    n.traits[trait] = (n.traits[trait] ?? 0) + amount;
    n.events.push(event);
  }

  /** The act of a kind in force over a province at time t (the latest, if several). */
  at(cell: number, kind: ActKind, t: number): Act | null {
    let found: Act | null = null;
    for (const a of this.byCell.get(cell) ?? [])
      if (a.cell === cell && a.kind === kind && a.from <= t && t < a.until) found = a;
    return found;
  }

  /** Acts are part of the story for ever, and a crater's meteor. */
  pinned(): Ref[] {
    return [
      ...this.list.map((a) => a.event),
      ...this.pits.map((c) => c.event),
      ...[...this.natures.values()].flatMap((n) => n.events),
    ];
  }

  hashInto(h: Hasher): void {
    h.value(this.list);
    if (this.pits.length) h.value(this.pits);
    if (this.natures.size) h.value([...this.natures].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
  }

  save(): unknown {
    return {
      acts: this.list,
      ...(this.pits.length ? { craters: this.pits } : {}),
      ...(this.natures.size ? { natures: [...this.natures] } : {}),
    };
  }

  load(state: unknown): void {
    const s = state as {
      acts: Act[];
      craters?: Crater[];
      natures?: [string, { traits: Record<string, number>; events: Ref[] }][];
    };
    this.list = [];
    this.byCell.clear();
    for (const a of s.acts) this.add(a);
    this.pits = [...(s.craters ?? [])];
    this.natures = new Map(
      (s.natures ?? []).map(([k, v]) => [k, { traits: { ...v.traits }, events: [...v.events] }]),
    );
  }
}

export function actsOf(world: World): ActStore {
  return world.store<ActStore>("acts.active");
}

/** How strongly each kind of act moves what it touches. */
export const ACT_STRENGTH = {
  /** Rain: withheld, a year's rain is this share lower; sent, this share higher. */
  rain: 0.55,
  /** The harvest: blighted, this share lower; blessed, this share higher. */
  harvest: 0.5,
  /** Plague: deaths this many times as likely; healing: this share fewer. */
  plague: 3,
  healing: 0.5,
} as const;

function validate(args: unknown, count: number, peopled: (cell: number) => boolean): string | null {
  const a = args as Partial<ActArgs> | null;
  if (!a || !Number.isInteger(a.cell) || a.cell! < 0 || a.cell! >= count)
    return "cell must be a place on the world";
  if (a.sign !== 1 && a.sign !== -1) return "sign must be 1 or -1";
  if (!Number.isInteger(a.years) || a.years! < 1 || a.years! > 10)
    return "years must be from 1 to 10";
  const strong = strengthProblem(a);
  if (strong) return strong;
  if (!peopled(a.cell!)) return "no one lives there";
  return null;
}

/**
 * Teach a world with people the god's acts. `peopled` says whether a province has
 * people; `inspire` grants a province the next way of life it lacks and returns
 * what it granted (or null), citing the act's event.
 */
export function installActs(
  world: World,
  cells: number,
  peopled: (cell: number) => boolean,
  inspire: (cell: number, event: Ref, t: number) => string | null,
): ActStore {
  const store = world.register(new ActStore());
  world.addPinner(() => store.pinned());
  for (const kind of ACT_KINDS)
    world.defineCommand({
      type: `act.${kind}`,
      validate: (args) => validate(args, cells, peopled),
      apply: (command, t) => {
        const a = command.args as ActArgs,
          years = kind === "inspire" ? 0 : a.years,
          // (Inspiring grants the next way of life: it has no strength.)
          strong = strengthMark(kind === "inspire" ? 1 : actStrengthOf(a));
        const event = world.events.emit({
          type: ACT_EVENTS[kind].type,
          place: cellRef(0, a.cell),
          causes: [{ ref: command.id, role: "agent", weight: 1 }],
          data: { sign: a.sign, years, ...strong },
        });
        store.add({
          command: command.id,
          event,
          kind,
          cell: a.cell,
          sign: a.sign,
          from: t,
          until: t + years * YEAR,
          ...strong,
        });
        if (kind === "inspire") inspire(a.cell, event, t);
      },
    });
  return store;
}
