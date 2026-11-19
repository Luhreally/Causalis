// What a land's underworld killed in a year, and what each killing was of (asked 2026-11-18: "a followed member can be killed in
// the group's war"): read from the reckoning kept beside the world for that year (sim/hand/deaths.ts LandKilling), never from the
// land's row as it stands now, so who died of it in a year gone by is the same whenever it is asked. A town's court reads its
// killings from here (host/inspect/grave.ts), and a town's lines die of them here (host/roster.ts): one reading, so the case of
// a killing and the death of the one killed are of the same killing. Pure: nothing is kept, nothing flows back.
import { finish, hashString, mix, type World } from "../kernel/index.ts";
import { GROUP_KINDS } from "../rules/index.ts";
import { deathNotesOf, type LandKilling } from "../sim/index.ts";
import { groupWords } from "../causal/index.ts";

const u = (h: number, n: number): number => finish(mix(h, n), 13) / 4294967296;
const banded = (x: number): number => Math.round(x * 20) / 20;

/** A group, a crew or a federation as a killing names it: its page and its name ("the Bothaath family"). */
export type Named = { readonly ref: string; readonly name: string; readonly event: string };

/** What a land's killing in a year was of, as its realm reckoned it. */
export type KillFacts = {
  /** Killed a year in a hundred thousand of its people. */
  readonly per: number;
  readonly control: number;
  readonly gangs: number;
  readonly street: number;
  readonly badge: number;
  readonly racket: boolean;
  readonly squad: boolean;
  readonly war: { readonly event: string; readonly a: Named; readonly b: Named } | null;
  readonly holder: Named | null;
  readonly crew: Named | null;
  /** The federations of its street, by name. */
  readonly feds: readonly [Named | null, Named | null];
};

const group = (realm: string, s: string | null, at = 0): Named | null => {
  if (!s) return null;
  const p = s.split("|");
  return {
    ref: `mob:${realm}:${p[at]}`,
    name: groupWords(p[at + 1]!, GROUP_KINDS[Number(p[at + 2])] ?? "protection"),
    event: p[at]!,
  };
};
const fed = (realm: string, s: string | null): Named | null => {
  if (!s) return null;
  const [event, name] = s.split("|");
  return { ref: `gfed:${realm}:${event}`, name: `the ${name} federation`, event: event! };
};

/** A reckoning kept, as what its killing was of (`realm`: the realm the land was of, for its groups' pages). */
export function factsOf(k: LandKilling, realm: string): KillFacts {
  const w = k.war?.split("|");
  return {
    per: k.per / 10,
    control: banded(k.control / 1000),
    gangs: k.gangs,
    street: k.street / 1000,
    badge: k.badge / 1000,
    racket: k.racket,
    squad: k.squad,
    war: w ? { event: w[0]!, a: group(realm, k.war, 1)!, b: group(realm, k.war, 4)! } : null,
    holder: group(realm, k.holder),
    crew: group(realm, k.crew),
    feds: [fed(realm, k.feds[0]), fed(realm, k.feds[1])],
  };
}

/**
 * A land taken over: the year's reckoning is the first to name its holder, and the reckoning that stood for the year before
 * named another group. Who lost it and who took it (null: the same holder, none before or none now, or no reckoning kept).
 */
export function takeoverOf(
  k: LandKilling,
  before: LandKilling | null,
  year: number,
  realm: string,
): { readonly lost: Named; readonly took: Named } | null {
  if (k.year !== year || !k.holder || !before?.holder) return null;
  const lost = group(realm, before.holder)!,
    took = group(realm, k.holder)!;
  return lost.event === took.event ? null : { lost, took };
}

/** One who collected for the group that held a land, killed as another took it: told of them in place of what the draw says. */
export function oustedOf(base: Slain, t: { readonly lost: Named; readonly took: Named }): Slain {
  return {
    ...base,
    words: `when ${t.took.name} took this land from ${t.lost.name}`,
    source: t.took.ref,
    of: t.lost,
    by: t.took,
    role: "its collector",
  };
}

/** What a land's underworld killed in a year, as kept (null: no reckoning kept stands for that year). */
export function killingKept(world: World, cell: number, year: number): LandKilling | null {
  return deathNotesOf(world)?.killingAt(cell, year) ?? null;
}

export type Motive = "turf" | "racket" | "street" | "squad" | "road";

/** What a land's killings are of, each with its weight among them (grave.ts's, by the same numbers). */
export function motivesOf(f: KillFacts, road = 0): { m: Motive; w: number }[] {
  const out: { m: Motive; w: number }[] = [];
  if (f.war) out.push({ m: "turf", w: 3 });
  if (f.holder && f.racket) out.push({ m: "racket", w: 0.5 + 2 * f.control });
  if (f.gangs > 0 && f.street > 0) out.push({ m: "street", w: 0.5 + 3 * f.street });
  if (f.crew && f.squad) out.push({ m: "squad", w: 2 * f.badge });
  if (road > 0) out.push({ m: "road", w: road });
  return out;
}

/** The key of a town's j-th killing of a year: its case's, and its death's. */
export const killingKey = (town: string, year: number, j: number): string =>
  `killing ${town} ${year} ${j}`;

/** Which of them a town's j-th killing of a year was of (null: of none), by its key's draw; and the key. */
export function motiveOf(
  motives: readonly { m: Motive; w: number }[],
  town: string,
  year: number,
  j: number,
): { m: Motive | null; h: number } {
  const h = hashString(killingKey(town, year, j)) >>> 0,
    all = motives.reduce((n, x) => n + x.w, 0);
  if (!(all > 0)) return { m: null, h };
  let v = u(h, 2) * all,
    m = motives[0]!.m;
  for (const x of motives) {
    v -= x.w;
    if (v < 0) {
      m = x.m;
      break;
    }
  }
  return { m, h };
}

/** How many of a town are killed in a year, of a killing a head a year: a whole number, a rate under one by its key's draw. */
export function killedOf(perHead: number, people: number, town: string, year: number): number {
  const rate = perHead * people;
  if (rate >= 1) return Math.round(rate);
  const b = banded(rate);
  return Math.min(
    1,
    Math.floor(b) + (u(hashString(`killed ${town} ${year}`) >>> 0, 1) < b - Math.floor(b) ? 1 : 0),
  );
}

/** A killing as its dead are told of it: what it was of, in words after "killed"; the page that tells of it; who did it. */
export type Slain = {
  readonly year: number;
  /** Which of the town's killings of the year (its case's number among them). */
  readonly j: number;
  readonly motive: Exclude<Motive, "road">;
  /** "in the war between the Bothaath family and the Shistas cartel". */
  readonly words: string;
  /** The war's event, the group's or the federation's page (null: the land's underworld). */
  readonly source: string | null;
  /** Whose they were, where they were of a group in it; and who killed them. */
  readonly of: Named | null;
  readonly by: Named | null;
  /** What they were for it ("one of those who kept its corner"; null: one of the town, of no group). */
  readonly role: string | null;
};

/** A killing's cause in words, and whose it was. */
export function slainOf(
  f: KillFacts,
  m: Exclude<Motive, "road">,
  h: number,
  year: number,
  j: number,
  member: string | null,
): Slain {
  const base = { year, j, motive: m, role: member };
  if (m === "turf" && f.war) {
    const a = u(h, 3) < 0.5 ? f.war.a : f.war.b,
      b = a === f.war.a ? f.war.b : f.war.a;
    return {
      ...base,
      words: `in the war between ${a.name} and ${b.name}`,
      source: f.war.event,
      of: member ? b : null,
      by: a,
    };
  }
  if (m === "racket" && f.holder)
    return {
      ...base,
      words: `by ${f.holder.name}, for not paying what it asks`,
      source: f.holder.ref,
      of: null,
      by: f.holder,
    };
  if (m === "squad" && f.crew)
    return {
      ...base,
      words: `by ${f.crew.name}, outside any court`,
      source: f.crew.ref,
      of: null,
      by: f.crew,
    };
  const f1 = f.feds[0],
    f2 = f.feds[1],
    rival = f1 && f2 ? (u(h, 3) < 0.5 ? f2 : f1) : (f1 ?? f2);
  return {
    ...base,
    motive: "street",
    words: "in a fight between the streets' gangs",
    source: rival?.ref ?? null,
    of: member ? (f1 && f2 ? (rival === f1 ? f2 : f1) : null) : null,
    by: rival ?? null,
  };
}
