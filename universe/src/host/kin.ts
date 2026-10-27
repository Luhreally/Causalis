// A person's family and body (Phase 55 wave 5; asked for 2026-10-27: "i cant click on the soldiers
// on the field and see they family and anatomy etc in town vieww"). One of a town's people kept by
// their line (R1's roster) is one of the twelve their line stands for: the rest are their kin — a
// wife or a husband, the children the life table's births give them, their parents, brothers and
// sisters — and their house is the four lines that share a family's name and a home. The line's
// holders follow one another as the roster has them: where the one before was old enough to be the
// next one's father or mother (the life table's coming of age to the end of its births), they were,
// and the line passed to their child; where near in age, to a brother or a sister; else to a
// kinsman. One of a battle's levy known by his ref alone, a maker or a healer named for their seat,
// has kin by the same keyed rule, said plainly to be given, not kept; the people met and the hand's
// keep the families their household and the hand's lives hold. Everything is a hash of who and
// which, and the record's years: no state is kept, no stream drawn, so looking moves nothing, and
// two looks give the same family. The body is told by wave 3's wounds (host/wounds.ts) through the
// pure body model (bridge/body.ts).
import { YEAR, finish, hashString, mix, type Ref, type World } from "../kernel/index.ts";
import {
  cradleTongue,
  personName,
  tongueName,
  tonguePersonName,
  type Tongue,
} from "../gen/index.ts";
import { bandOf, type LifeHistory } from "../rules/index.ts";
import { agentName, cultureOf, handOf, populationContext } from "../sim/index.ts";
import { observer, type Person } from "../causal/index.ts";
import {
  bodyAt,
  bodyLine,
  parseSeatRef,
  parseTownsfolkRef,
  seatRef,
  type BodyFrame,
  type DeathBlow,
  type KinCard,
  type StruckMember,
  type StruckNow,
  type Wound,
} from "../bridge/index.ts";
import { battleWords } from "./burials.ts";
import { LINE, PER_TERM, houseName, townRoster, type Holder, type Roster } from "./roster.ts";
import { battleRoll, resolveLevyMan, type LevyMan } from "./roll.ts";
import { makerAt, makerKeyAt } from "./chain.ts";
import { healerOf } from "./village.ts";
import {
  battleDeath,
  bodyFrameOf,
  holderWounds,
  levyWounds,
  metWounds,
  strikeDeath,
} from "./wounds.ts";
import type { QueryHandler } from "./host.ts";

/** Of those grown a few years, the share who wed (keyed). */
const WED = 0.88;
/** How many years apart a couple are born at most (a man's wife the younger, a woman's husband the elder). */
const SPOUSE_GAP = 8;
/** How many years past coming of age the younger of a couple weds, at most. */
const WED_LATE = 8;
/** A line's holders told before and after the one whose page it is. */
const LINE_BACK = 3,
  LINE_ON = 3;
/** The most of a line's holders followed back or on to find who were brothers and sisters. */
const CHAIN_MOST = 6;

const u = (seed: number, n: number) => finish(mix(seed, n), 13) / 4294967296;

/** One of a person's kin: how they are kin, who, their page where they have one, their years, how they died. */
export type Kin = {
  /** To the one whose family it is: "wife", "son", "father", "brother", "cousin" … */
  readonly tie: string;
  readonly name: string;
  readonly ref: string | null;
  readonly sex: 0 | 1;
  readonly born: number;
  /** The year they died (null: they live). */
  readonly died: number | null;
  /** How they died, in words ("fell at the battle at Pounholt in 371"); null: in their bed, or not dead. */
  readonly how: string | null;
  /** The battle or the strike that killed them. */
  readonly event: string | null;
  /** A word more: "held the line before him", "born a Torrin". */
  readonly note: string | null;
};

/** A person's family: their parents, wife or husband, children, brothers and sisters, house, line. */
export type Family = {
  readonly self: Kin;
  readonly parents: readonly Kin[];
  readonly spouse: Kin | null;
  readonly children: readonly Kin[];
  readonly siblings: readonly Kin[];
  /** Their house now: the holders of the other lines its four share, under one roof. */
  readonly house: readonly Kin[];
  /** Their line's holders about them, the eldest first, they among them. */
  readonly line: readonly Kin[];
  /** What of it history keeps, and what is given by the keyed rule, said plainly. */
  readonly kept: string;
  /** The year it is told in. */
  readonly year: number;
};

/** "a Torrin": one born of a house. */
const articled = (house: string) => `a ${house}`;

/** One of the people a family is made of, before their tie is told. */
type Node = {
  readonly key: number;
  readonly ref: string | null;
  readonly name: string;
  readonly sex: 0 | 1;
  readonly born: number;
  readonly died: number | null;
  readonly how: string | null;
  readonly event: string | null;
};

/** A couple and their children: the births' key, the two, the years they were together, the children the record holds. */
type Unit = {
  readonly key: number;
  readonly ref: string;
  readonly father: Node | null;
  readonly mother: Node | null;
  readonly from: number;
  readonly to: number;
  /** The family name their children bear. */
  readonly house: string;
  /** Children a line holds (its holders), the eldest first. */
  readonly known: readonly Node[];
};

/** What a family is read with: the people's life table and the land's speech. */
type Reading = {
  readonly world: World;
  readonly life: LifeHistory;
  /** Coming of age; the end of the last band that bears. */
  readonly grown: number;
  readonly bears: number;
  readonly now: number;
  readonly culture: ReturnType<typeof populationContext>["culture"];
  readonly tongue: Tongue | undefined;
  readonly family: Tongue;
};

function readingOf(world: World, cell: number): Reading {
  const ctx = populationContext(world),
    life = ctx.life,
    last = life.fertility.findLastIndex((f) => f > 0),
    tongue = cell >= 0 ? cultureOf(world).get(cell)?.tongue : undefined;
  return {
    world,
    life,
    grown: life.adulthood,
    bears: life.bands[last + 1] ?? life.bands.at(-1)! + life.oldest,
    now: Math.floor(world.now / YEAR),
    culture: ctx.culture,
    tongue,
    family: tongue ?? cradleTongue(ctx.culture),
  };
}

/** A given name in the land's tongue (or the cradle's names), by a key: as the roster's and the roll's are given. */
function givenOf(r: Reading, key: number, sex: 0 | 1): string {
  return r.tongue ? tonguePersonName(r.tongue, key, sex) : personName(r.culture, key, sex);
}
/** A family name of the land's, by a key (one no town's house need bear). */
function keyedSurname(r: Reading, key: number): string {
  return tongueName({ ...r.family, seed: r.family.seed ^ 0xf00d }, key);
}
/** A name's family part, after the given name it was made with (else its last word). */
function surnameOf(name: string, given: string): string {
  return name.startsWith(`${given} `)
    ? name.slice(given.length + 1)
    : (name.split(" ").at(-1) ?? name);
}

/**
 * The year one born in `born`, alive in `from`, dies by the life table (keyed by them; none outlive
 * its open band thrice over), or null: alive in `until`.
 */
function diesIn(r: Reading, key: number, born: number, from: number, until: number): number | null {
  const last = born + r.life.bands.at(-1)! + 3 * r.life.oldest;
  for (let y = Math.max(born, from); y <= until; y++) {
    if (y >= last) return y;
    const age = y - born;
    if (u(key, 4096 + age) < (r.life.mortality[bandOf(age, r.life)] ?? 1)) return y;
  }
  return null;
}

/** The years a mother bore children from `from` to `to`, by the life table's births at her age (keyed, one a year at most). */
function birthsOf(r: Reading, key: number, motherBorn: number, from: number, to: number): number[] {
  const out: number[] = [];
  for (let y = Math.max(from, motherBorn + 1); y <= to; y++) {
    const f = r.life.fertility[bandOf(y - motherBorn, r.life)] ?? 0;
    if (f > 0 && u(key, 8192 + (y - motherBorn)) < f) out.push(y);
  }
  return out;
}

/** How one died, in words, by the year and their age (they died in their bed). */
function bedWords(r: Reading, n: { born: number; died: number | null }): string | null {
  if (n.died === null) return null;
  const age = n.died - n.born;
  return age < 2
    ? `died a babe, in ${n.died}`
    : age < r.grown
      ? `died a child, in ${n.died}`
      : `died in ${n.died}, at ${age}`;
}

/** A keyed person of the family (no page): named in the land's speech, their death by the life table from `alive`. */
function keyedNode(
  r: Reading,
  key: number,
  sex: 0 | 1,
  born: number,
  surname: string,
  alive = born,
): Node {
  const died = diesIn(r, key, born, alive, r.now);
  return {
    key,
    ref: null,
    name: `${givenOf(r, key, sex)} ${surname}`,
    sex,
    born,
    died,
    how: bedWords(r, { born, died }),
    event: null,
  };
}

/** How two who held a line one after the other were kin, by their years apart: the next the child, a brother or sister, a kinsman. */
function tieOf(r: Reading, before: Node, after: Node): "child" | "sibling" | "kin" {
  const gap = after.born - before.born;
  // (One dead more than a year before the other was born was not their parent.)
  if (gap >= r.grown && gap <= r.bears)
    return before.died !== null && before.died < after.born - 1 ? "kin" : "child";
  return Math.abs(gap) < r.grown ? "sibling" : "kin";
}

/**
 * A couple and their children, as `x` weds: most do, a few years past coming of age (always, where
 * the line holds a child of theirs), to one born a few years apart (a man's wife the younger), of
 * another house; their children born by the life table's births while both live, those the line
 * holds among them, in the years nearest their own.
 */
function unitOf(
  r: Reading,
  x: Node,
  known: readonly Node[],
  house: string,
  spouseHouse: string,
): { readonly unit: Unit | null; readonly spouse: Node | null; readonly note: string } {
  const k = x.key,
    end = x.died ?? r.now,
    none = { unit: null, spouse: null, note: spouseHouse };
  if (!known.length && (u(k, 21) >= WED || end < x.born + r.grown + 2)) return none;
  const gap = Math.floor(u(k, 22) * SPOUSE_GAP),
    first = known[0]?.born,
    // (Their mother grown by the first child the line holds.)
    spouseBorn =
      x.sex === 1
        ? Math.min(x.born + gap, first !== undefined ? first - r.grown : Infinity)
        : x.born - gap,
    weds = Math.max(x.born, spouseBorn) + r.grown + Math.floor(u(k, 23) * WED_LATE),
    from = first !== undefined ? Math.min(weds, first) : weds;
  // (Not wed yet, or not before they died.)
  if (!known.length && from > end) return none;
  const sk = hashString(`spouse ${x.ref ?? k}`),
    spouse = keyedNode(r, sk, x.sex === 1 ? 0 : 1, spouseBorn, house, Math.min(from, end)),
    to = Math.min(end, spouse.died ?? r.now, r.now);
  return {
    unit: {
      key: hashString(`births ${x.ref ?? k}`),
      ref: x.ref ?? `${k}`,
      father: x.sex === 1 ? x : spouse,
      mother: x.sex === 1 ? spouse : x,
      from,
      to,
      house,
      known,
    },
    spouse,
    note: spouseHouse,
  };
}

/** A unit's children, the eldest first: its births, those the line holds put in the years nearest their own (any more after). */
function childrenOf(r: Reading, unit: Unit): Node[] {
  const mother = unit.mother!,
    years = birthsOf(r, unit.key, mother.born, unit.from, unit.to),
    out: (Node | null)[] = years.map(() => null),
    extra: Node[] = [];
  for (const kid of unit.known) {
    let best = -1;
    for (let i = 0; i < years.length; i++)
      if (
        out[i] === null &&
        (best < 0 || Math.abs(years[i]! - kid.born) < Math.abs(years[best]! - kid.born))
      )
        best = i;
    if (best >= 0) out[best] = kid;
    else extra.push(kid);
  }
  return [
    ...out.map(
      (n, i) =>
        n ??
        keyedNode(
          r,
          hashString(`child ${unit.ref} ${i}`),
          ((hashString(`child ${unit.ref} ${i}`) >>> 5) & 1) as 0 | 1,
          years[i]!,
          unit.house,
        ),
    ),
    ...extra,
  ].sort((a, b) => a.born - b.born || a.key - b.key);
}

/** The parents of `x` given by the keyed rule where no line holds them: a mother of the age that bears, a father a few years her elder, of the house. */
function keyedParents(r: Reading, x: Node, house: string, known: readonly Node[]): Unit {
  const fk = hashString(`father ${x.ref ?? x.key}`),
    mk = hashString(`mother ${x.ref ?? x.key}`),
    age = r.grown + Math.floor(u(mk, 2) * Math.max(1, r.bears - r.grown - 5)),
    motherBorn = x.born - age,
    mother = keyedNode(r, mk, 0, motherBorn, house, x.born),
    father = keyedNode(r, fk, 1, motherBorn - Math.floor(u(fk, 2) * SPOUSE_GAP), house, x.born - 1),
    from = x.born - Math.floor(u(mk, 3) * Math.max(1, x.born - (motherBorn + r.grown))),
    to = Math.min(father.died ?? r.now, mother.died ?? r.now, r.now);
  return {
    key: hashString(`births ${x.ref ?? x.key} parents`),
    ref: `${x.ref ?? x.key} parents`,
    father,
    mother,
    from,
    to,
    house,
    known,
  };
}

// —— A town's lines ———————————————————————————————————————————————————————————————————

/** A town's lines as a family is read from them. */
type Lines = Reading & {
  readonly town: string;
  readonly townName: string;
  readonly roster: Roster;
  readonly lines: number;
};

/** A holder as one of a family: their page, name, years; how they died (fell, a strike, or in their bed after their term). */
function holderNode(t: Lines, h: Holder): Node {
  const fell = h.fates.find((f) => f.fate === "fell"),
    struck = h.struck.find((s) => s.fate === "died"),
    died = h.died ?? (h.end <= t.now ? diesIn(t, h.key ^ 0x5eed, h.born, h.end, t.now) : null);
  return {
    key: h.key,
    ref: h.ref,
    name: t.roster.nameOf(h),
    sex: h.sex,
    born: h.born,
    died,
    how: fell
      ? `fell at ${battleWords(t.world, fell.land)} in ${fell.year}`
      : struck
        ? `died in the ${struck.kind === "meteor" ? "fire from the sky" : struck.kind} of ${struck.year}`
        : bedWords(t, { born: h.born, died }),
    event: fell?.event ?? struck?.event ?? null,
  };
}

/** The holder of a line before `h` (the one before him in his term, else the last of the term before); null: none known. */
function predOf(t: Lines, h: Holder): Holder | null {
  const tau = Math.floor((h.n - 1) / PER_TERM),
    r = (h.n - 1) % PER_TERM;
  if (r > 0) return t.roster.holderOf(h.line, h.n - 1);
  if (tau <= 0) return null;
  let last: Holder | null = null;
  for (let q = 0; q < PER_TERM; q++) {
    const x = t.roster.holderOf(h.line, (tau - 1) * PER_TERM + q + 1);
    if (!x) break;
    last = x;
    if (x.died === null) break;
  }
  return last;
}
/** The holder of a line after `h` (the next in his term where he died in it, else the next term's); null: none yet. */
function succOf(t: Lines, h: Holder): Holder | null {
  const tau = Math.floor((h.n - 1) / PER_TERM),
    r = (h.n - 1) % PER_TERM;
  if (h.died !== null && r + 1 < PER_TERM) {
    const x = t.roster.holderOf(h.line, h.n + 1);
    if (x) return x;
  }
  return t.roster.holderOf(h.line, (tau + 1) * PER_TERM + 1);
}

/** The name of a line's house, and of another house of the town by a key (where it has another). */
function lineHouse(t: Lines, line: number): string {
  return houseName(t.family, t.town, line);
}
function otherHouse(t: Lines, line: number, key: number): string {
  const groups = Math.ceil(t.lines / 4),
    own = Math.floor(line / 4);
  if (groups < 2) return keyedSurname(t, key);
  const g = Math.floor(u(key, 24) * (groups - 1));
  return houseName(t.family, t.town, 4 * (g >= own ? g + 1 : g));
}

/**
 * Who were brothers and sisters along a line about `h`: back to the eldest of them (the one before
 * not their parent but near their age), then on while the next is. The eldest's parents are theirs.
 */
function siblingChain(t: Lines, h: Holder): { eldest: Holder; chain: Holder[] } {
  let eldest = h;
  for (let i = 0; i < CHAIN_MOST; i++) {
    const p = predOf(t, eldest);
    if (!p || tieOf(t, holderNode(t, p), holderNode(t, eldest)) !== "sibling") break;
    eldest = p;
  }
  const chain = [eldest];
  for (let i = 0; i < CHAIN_MOST; i++) {
    const s = succOf(t, chain.at(-1)!);
    if (!s || tieOf(t, holderNode(t, chain.at(-1)!), holderNode(t, s)) !== "sibling") break;
    chain.push(s);
  }
  return { eldest, chain };
}

/** The children of `h` the line holds: the one after him, where he is his child, and their brothers and sisters after. */
function lineChildren(t: Lines, h: Holder): Node[] {
  const s = succOf(t, h);
  if (!s || tieOf(t, holderNode(t, h), holderNode(t, s)) !== "child") return [];
  return siblingChain(t, s).chain.map((x) => holderNode(t, x));
}

const MAN_TIES = { parent: "father", spouse: "husband", child: "son", sibling: "brother" } as const;
const WOMAN_TIES = {
  parent: "mother",
  spouse: "wife",
  child: "daughter",
  sibling: "sister",
} as const;
const tieWord = (sex: 0 | 1, tie: keyof typeof MAN_TIES) => (sex ? MAN_TIES : WOMAN_TIES)[tie];

function kinOf(n: Node, tie: string, note: string | null = null): Kin {
  return {
    tie,
    name: n.name,
    ref: n.ref,
    sex: n.sex,
    born: n.born,
    died: n.died,
    how: n.how,
    event: n.event,
    note,
  };
}

/** A line holder's family (their page, their card): by the roster's holders about them and the keyed rule. */
function holderFamily(t: Lines, h: Holder): Family {
  const self = holderNode(t, h),
    house = lineHouse(t, h.line),
    // Their parents: the holder before them where old enough to be, else (a brother or sister
    // before them) the eldest's, else given by the keyed rule.
    { eldest, chain } = siblingChain(t, h),
    before = predOf(t, eldest),
    beforeNode = before ? holderNode(t, before) : null,
    known = chain.map((x) => holderNode(t, x)),
    parentUnit =
      before && beforeNode && tieOf(t, beforeNode, known[0]!) === "child"
        ? unitOf(
            t,
            beforeNode,
            known,
            house,
            `born ${articled(otherHouse(t, before.line, before.key))}`,
          ).unit
        : null,
    parents = parentUnit ?? keyedParents(t, known[0]!, house, known),
    // (One of the line wed always where it holds a child of theirs.)
    own = unitOf(
      t,
      self,
      lineChildren(t, h),
      house,
      `born ${articled(otherHouse(t, h.line, h.key))}`,
    ),
    siblings = childrenOf(t, parents).filter((n) => n.ref !== h.ref),
    children = own.unit ? childrenOf(t, own.unit) : [],
    // Their house now: the other three lines of its four, as the town draws them under one roof.
    first = h.line - (h.line % 4),
    houseNow: Kin[] = [];
  for (let j = first; j < Math.min(first + 4, t.lines); j++) {
    if (j === h.line) continue;
    const x = t.roster.holder(j);
    if (!x) continue;
    const n = holderNode(t, x),
      d = n.born - self.born;
    houseNow.push(
      kinOf(
        n,
        Math.abs(d) < t.grown
          ? "cousin"
          : d < 0
            ? n.sex
              ? "uncle"
              : "aunt"
            : n.sex
              ? "nephew"
              : "niece",
        "of the house, under the same roof",
      ),
    );
  }
  // Their line: the holders before them and after, the tie of each to the one before.
  const back: Holder[] = [];
  for (let x = predOf(t, h); x && back.length < LINE_BACK; x = predOf(t, x)) back.unshift(x);
  const on: Holder[] = [];
  for (let x = succOf(t, h); x && on.length < LINE_ON; x = succOf(t, x)) on.push(x);
  const held = [...back, h, ...on],
    line = held.map((x, i) => {
      const n = holderNode(t, x),
        prev = i > 0 ? holderNode(t, held[i - 1]!) : null,
        tie = prev ? tieOf(t, prev, n) : null,
        how =
          tie === "child"
            ? `${tieWord(n.sex, "child")} of the one before`
            : tie === "sibling"
              ? `${tieWord(n.sex, "sibling")} of the one before`
              : tie === "kin"
                ? "a kinsman of the one before"
                : "the first told";
      return kinOf(
        n,
        x.ref === h.ref ? "self" : "line",
        `held it ${x.from}–${x.died === null && x.end > t.now ? "now" : x.end - 1}; ${how}`,
      );
    });
  return {
    self: kinOf(self, "self"),
    parents: [parents.father, parents.mother]
      .filter((n): n is Node => n !== null)
      .map((n) =>
        kinOf(
          n,
          tieWord(n.sex, "parent"),
          n.ref && before && n.ref === before.ref ? "held the line before" : null,
        ),
      ),
    spouse: own.spouse ? kinOf(own.spouse, tieWord(own.spouse.sex, "spouse"), own.note) : null,
    children: children.map((n) =>
      kinOf(n, tieWord(n.sex, "child"), n.ref ? "holds the line after" : null),
    ),
    siblings: siblings.map((n) =>
      kinOf(n, tieWord(n.sex, "sibling"), n.ref ? "held the line" : null),
    ),
    house: houseNow,
    line,
    kept: `One of every ${LINE} of ${t.townName} is kept by name, the holder of a line: the line stands for them and their kin. The holders before and after are history's (the roster's); the rest — a wife or a husband, the children the life table's births give, the parents and the brothers and sisters no line holds — are given by the same keyed rule each time, from their names and years.`,
    year: t.now,
  };
}

/** A town's lines read (null: no such town). */
function linesOf(world: World, town: string): Lines | null {
  const s = populationContext(world).settlements.get(town as Ref);
  if (!s) return null;
  const roster = townRoster(world, s.ref);
  return {
    ...readingOf(world, s.cell),
    town: s.ref,
    townName: s.name,
    roster,
    lines: Math.max(
      Math.ceil(s.population / LINE),
      ...roster.battles.map((b) => b.lines),
      ...roster.strikes.map((x) => x.lines),
    ),
  };
}

/** A line holder by their ref (null: none). */
function holderOfRef(t: Lines, ref: string): Holder | null {
  const at = parseTownsfolkRef(ref);
  if (!at || at.town !== t.town || at.line >= t.lines) return null;
  return at.n === null ? t.roster.holder(at.line) : t.roster.holderOf(at.line, at.n);
}

// —— Those known by a ref or a seat ———————————————————————————————————————————————————————

/** The family of one known by their own key alone (a levy man, a maker): all of it given by the keyed rule. */
function keyedFamily(r: Reading, self: Node, surname: string, kept: string): Family {
  const parents = keyedParents(r, self, surname, [self]),
    own = unitOf(
      r,
      self,
      [],
      surname,
      `born ${articled(keyedSurname(r, hashString(`spouse house ${self.ref ?? self.key}`)))}`,
    ),
    children = own.unit ? childrenOf(r, own.unit) : [];
  return {
    self: kinOf(self, "self"),
    parents: [parents.father, parents.mother]
      .filter((n): n is Node => n !== null)
      .map((n) => kinOf(n, tieWord(n.sex, "parent"))),
    spouse: own.spouse ? kinOf(own.spouse, tieWord(own.spouse.sex, "spouse"), own.note) : null,
    children: children.map((n) => kinOf(n, tieWord(n.sex, "child"))),
    siblings: childrenOf(r, parents)
      .filter((n) => n.key !== self.key)
      .map((n) => kinOf(n, tieWord(n.sex, "sibling"))),
    house: [],
    line: [],
    kept,
    year: r.now,
  };
}

/** One of a battle's levy, as his family is read: his ref's man, his years, how he fell. */
function levyFamily(world: World, man: LevyMan): Family {
  const r = readingOf(world, man.place?.cell ?? man.land),
    key = hashString(man.ref),
    given = givenOf(r, key, 1),
    born = man.year - man.age,
    died = man.fate === "fell" ? man.year : diesIn(r, key ^ 0x5eed, born, man.year + 1, r.now),
    self: Node = {
      key,
      ref: man.ref,
      name: man.name,
      sex: 1,
      born,
      died,
      how:
        man.fate === "fell"
          ? `fell at ${battleWords(world, man.land)} in ${man.year}`
          : bedWords(r, { born, died }),
      event: man.fate === "fell" ? man.event : null,
    };
  return keyedFamily(
    r,
    self,
    surnameOf(man.name, given),
    "A man of the levy known by the battle's roll alone: no line of a town holds him, so history keeps no one of his. His kin here are given by the keyed rule a line's are given by, from his name and his years — the same each time, but none of them kept.",
  );
}

/** Who holds a seat now: their name, years at it, key, sex and birth year (null: no such town, or no healer's seat). */
export function seatHolder(
  world: World,
  town: string,
  trade: string,
  seat: number,
): {
  readonly name: string;
  readonly years: number;
  readonly key: number;
  readonly sex: 0 | 1;
  readonly born: number;
  readonly cell: number;
  readonly townName: string;
} | null {
  const s = populationContext(world).settlements.get(town as Ref);
  if (!s) return null;
  const year = Math.floor(world.now / YEAR),
    m =
      trade === "healer" ? healerOf(world, s, year) : makerAt(world, s.cell, s, trade, seat, year);
  if (!m) return null;
  const who = makerKeyAt(s, s.cell, trade, trade === "healer" ? 0 : seat, year),
    grown = populationContext(world).life.adulthood;
  return {
    name: m.name,
    years: m.years,
    key: who.key,
    sex: who.sex,
    born: who.took - grown - 1 - Math.floor(u(who.key, 31) * 12),
    cell: s.cell,
    townName: s.name,
  };
}

function seatFamily(world: World, town: string, trade: string, seat: number): Family | null {
  const h = seatHolder(world, town, trade, seat);
  if (!h) return null;
  const r = readingOf(world, h.cell),
    self: Node = {
      key: h.key,
      ref: trade === "healer" ? `heal:${town}` : seatRef(town, trade, seat),
      name: h.name,
      sex: h.sex,
      born: h.born,
      died: null,
      how: null,
      event: null,
    };
  return keyedFamily(
    r,
    self,
    surnameOf(h.name, givenOf(r, h.key, h.sex)),
    `Named as the holder of ${trade === "healer" ? "the healer's seat" : `a ${trade}'s seat`} of ${h.townName}: history keeps the seat and the years at it, not the one who holds it, so their kin here are given by the keyed rule a line's are given by — the same each time, but none of them kept.`,
  );
}

/** The family of anyone of a town with a page that has none of its own: a line holder, a levy man, a seat's holder (null: none, or a person met or the hand's, whose household tells theirs). */
export function familyOf(world: World, ref: string): Family | null {
  if (ref.startsWith("folk:town:")) {
    const at = parseTownsfolkRef(ref),
      t = at ? linesOf(world, at.town) : null,
      h = t ? holderOfRef(t, ref) : null;
    return t && h ? holderFamily(t, h) : null;
  }
  if (ref.startsWith("lv:")) {
    const man = resolveLevyMan(world, ref);
    return man ? levyFamily(world, man) : null;
  }
  if (ref.startsWith("heal:")) return seatFamily(world, ref.slice("heal:".length), "healer", 0);
  const seat = parseSeatRef(ref);
  return seat ? seatFamily(world, seat.town, seat.trade, seat.seat) : null;
}

// —— The family in a line ——————————————————————————————————————————————————————————————

const NUMBERS = [
  "no",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];
const number = (n: number) => NUMBERS[n] ?? `${n}`;
const givenPart = (name: string) => name.split(" ")[0] ?? name;
const whose = (sex: 0 | 1) => (sex ? "his" : "her");

/**
 * A family in a line, for a card: "husband of Aela, father of three; his father Orm fell at the
 * battle at Pounholt in 371" — and once they fell, those they left: "his widow Aela and two
 * children live on".
 */
export function familyLine(f: Family): string {
  const s = f.self,
    alive = (k: Kin) => k.died === null,
    living = f.children.filter(alive),
    grown = s.died === null ? f.year - s.born : s.died - s.born,
    parts: string[] = [];
  if (s.died !== null) {
    // Who they left: a widow or widower and children; else their parents; else brothers and sisters.
    const left: { words: string; many: boolean }[] = [],
      some = (n: number, one: string, more: string) => ({
        words: n === 1 ? `a ${one}` : `${number(n)} ${more}`,
        many: n > 1,
      });
    if (f.spouse && (f.spouse.died === null || f.spouse.died > s.died))
      left.push({
        words: `${whose(s.sex)} ${f.spouse.sex ? "widower" : "widow"} ${givenPart(f.spouse.name)}`,
        many: false,
      });
    if (living.length) left.push(some(living.length, "child", "children"));
    if (!left.length)
      for (const p of f.parents.filter(alive))
        left.push({ words: `${whose(s.sex)} ${p.tie} ${givenPart(p.name)}`, many: false });
    if (!left.length) {
      const kin = f.siblings.filter(alive),
        brothers = kin.filter((k) => k.sex === 1).length;
      if (brothers) left.push(some(brothers, "brother", "brothers"));
      if (kin.length > brothers) left.push(some(kin.length - brothers, "sister", "sisters"));
    }
    const many = left.length > 1 || left.some((x) => x.many);
    parts.push(
      `${s.how ?? `died in ${s.died}`}${left.length ? `; ${left.map((x) => x.words).join(" and ")} ${many ? "live" : "lives"} on` : ""}`,
    );
    return cap(parts.join("; "));
  }
  if (f.spouse)
    parts.push(
      f.spouse.died === null
        ? `${s.sex ? "husband" : "wife"} of ${givenPart(f.spouse.name)}`
        : `${s.sex ? "widower" : "widow"} of ${givenPart(f.spouse.name)}`,
    );
  else if (grown >= 18) parts.push("unwed");
  if (living.length) parts.push(`${s.sex ? "father" : "mother"} of ${number(living.length)}`);
  const father = f.parents.find((p) => p.sex === 1),
    mother = f.parents.find((p) => p.sex === 0),
    fallen = f.parents.find((p) => p.event !== null && p.how !== null);
  const head = parts.join(", ");
  let tail = "";
  if (fallen) tail = `${whose(s.sex)} ${fallen.tie} ${givenPart(fallen.name)} ${fallen.how}`;
  else if (!f.spouse && father && father.died === null)
    tail = `${s.sex ? "son" : "daughter"} of ${givenPart(father.name)}`;
  else if (!f.spouse && mother && mother.died === null)
    tail = `${s.sex ? "son" : "daughter"} of ${givenPart(mother.name)}`;
  const line = [head, tail].filter((x) => x).join("; ");
  return cap(line || "No kin of theirs is told");
}
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** A person met's family in a line, as their household's roles have it. */
function metLine(world: World, p: Person): string {
  const ledger = observer(world),
    hh = ledger.household(p.household),
    members = (hh?.members ?? [])
      .map((m) => ledger.person(m))
      .filter((m): m is Person => !!m && m.ref !== p.ref),
    by = (role: string) => members.filter((m) => m.role === role),
    head = members.find((m) => m.role === "head"),
    spouse = members.find((m) => m.role === "spouse"),
    sex = (p.sex === 0 ? 0 : 1) as 0 | 1,
    parts: string[] = [];
  switch (p.role) {
    case "head":
    case "spouse": {
      const partner = p.role === "head" ? spouse : head;
      if (partner)
        parts.push(
          `${partner.alive ? (sex ? "husband" : "wife") : sex ? "widower" : "widow"} of ${partner.name}`,
        );
      const kids = by("child").filter((m) => m.alive).length;
      if (kids) parts.push(`${sex ? "father" : "mother"} of ${number(kids)}`);
      break;
    }
    case "child": {
      const parent = head ?? spouse;
      if (parent) parts.push(`${sex ? "son" : "daughter"} of ${parent.name}`);
      const kin = by("child").filter((m) => m.alive).length;
      if (kin) parts.push(`one of ${number(kin + 1)} children`);
      break;
    }
    case "elder":
      if (head) parts.push(`${sex ? "father" : "mother"} of ${head.name}`);
      break;
  }
  return cap(
    parts.join(", ") || (hh ? `of the ${hh.surname} household` : "No kin of theirs is told"),
  );
}

/** One of the hand's people's family in a line: their partner, their children, their parents. */
function agentLine(world: World, ref: string): string | null {
  const id = Number(ref.slice(ref.indexOf(":") + 1)),
    w = handOf(world).resting,
    a = w?.agents.find((x) => x.id === id);
  if (!w || !a) return null;
  const ctx = populationContext(world),
    town = ctx.settlements.get(w.village)!,
    all = [...(w.gone ?? []), ...w.agents],
    find = (k: number | undefined) => (k === undefined ? undefined : all.find((x) => x.id === k)),
    name = (k: (typeof all)[number]) => agentName(ctx, k as typeof a, town).split(" ")[0]!,
    partner = find(a.partner),
    children = w.agents.filter((k) => k.mother === id || k.father === id).length,
    sex = (a.sex === 0 ? 0 : 1) as 0 | 1,
    parts: string[] = [];
  if (partner)
    parts.push(
      `${"died" in partner ? (sex ? "widower" : "widow") : sex ? "husband" : "wife"} of ${name(partner)}`,
    );
  if (children) parts.push(`${sex ? "father" : "mother"} of ${number(children)}`);
  const mother = find(a.mother);
  if (!parts.length && mother) parts.push(`${sex ? "son" : "daughter"} of ${name(mother)}`);
  return cap(parts.join(", ") || "No kin of theirs lives");
}

// —— The body ——————————————————————————————————————————————————————————————————————————

/** A body as it is read for a page or a card: their people's plan, their wounds, the blow that killed them, their sex. */
export type BodyRead = {
  readonly frame: BodyFrame;
  readonly wounds: readonly Wound[];
  readonly death: DeathBlow | null;
  readonly sex: 0 | 1;
};

/** Anyone's body by their ref (null: no one): a line holder's, a levy man's, a person met's, a seat's holder's, one of the hand's. */
export function bodyOf(world: World, ref: string): BodyRead | null {
  const frame = bodyFrameOf(world);
  if (ref.startsWith("folk:town:")) {
    const at = parseTownsfolkRef(ref),
      t = at ? linesOf(world, at.town) : null,
      h = t ? holderOfRef(t, ref) : null;
    if (!t || !h) return null;
    const fell = h.fates.find((f) => f.fate === "fell"),
      struck = h.struck.find((s) => s.fate === "died");
    return {
      frame,
      wounds: holderWounds(world, t.town, h),
      death: fell
        ? battleDeath(
            world,
            t.town,
            h.ref,
            fell,
            populationContext(world).settlements.get(t.town as Ref)!.cell,
          )
        : struck
          ? strikeDeath(world, t.town, h.ref, struck)
          : null,
      sex: h.sex,
    };
  }
  if (ref.startsWith("lv:")) {
    const man = resolveLevyMan(world, ref);
    if (!man) return null;
    return {
      frame,
      wounds: levyWounds(world, man),
      death:
        man.fate === "fell"
          ? battleDeath(world, man.place?.ref ?? null, man.ref, man, man.place?.cell ?? man.land)
          : null,
      sex: 1,
    };
  }
  if (ref.startsWith("prsn:")) {
    const p = observer(world).person(ref as Ref);
    if (!p) return null;
    const fell = p.wars?.find((w) => w.fate === "fell");
    return {
      frame,
      wounds: metWounds(world, p),
      death: fell ? battleDeath(world, p.village, p.ref, fell, fell.cell) : null,
      sex: (p.sex === 0 ? 0 : 1) as 0 | 1,
    };
  }
  if (ref.startsWith("agent:")) {
    const id = Number(ref.slice(ref.indexOf(":") + 1)),
      a = handOf(world).resting?.agents.find((x) => x.id === id);
    return a ? { frame, wounds: [], death: null, sex: (a.sex === 0 ? 0 : 1) as 0 | 1 } : null;
  }
  const seat = ref.startsWith("heal:")
    ? { town: ref.slice("heal:".length), trade: "healer", seat: 0 }
    : parseSeatRef(ref);
  const h = seat ? seatHolder(world, seat.town, seat.trade, seat.seat) : null;
  return h ? { frame, wounds: [], death: null, sex: h.sex } : null;
}

/**
 * A battle being watched as it is fought (its event), and the blows one of it has taken so far: their
 * body told as those blows leave it, over the wounds history dealt them before it — not yet as the
 * battle's end deals it.
 */
export type During = { readonly event: string; readonly struck: readonly StruckNow[] };

/**
 * The moment a body is told at on a card or a page, outside a battle being watched: a battle's
 * blows from its turn on — history has it fought in its year, and the family, the page and the town
 * at war tell it so from then, though it is watched fought at its hour the morning after.
 */
export function toldAt(read: BodyRead, t: number): number {
  let at = t;
  for (const x of [read.death, ...read.wounds])
    if (x && x.from === "battle" && t >= (x.year + 1) * YEAR) at = Math.max(at, x.at);
  return at;
}

/** A card's lines for anyone by their ref, their body as it is at `t` (world seconds; default now), or in a battle being fought. */
export function kinCard(
  world: World,
  ref: string,
  t: number = world.now,
  during: During | null = null,
): KinCard {
  const b = bodyOf(world, ref);
  let family: string | null = null;
  if (ref.startsWith("prsn:")) {
    const p = observer(world).person(ref as Ref);
    family = p ? metLine(world, p) : null;
  } else if (ref.startsWith("agent:")) family = agentLine(world, ref);
  else {
    const f = familyOf(world, ref),
      // (In the battle being fought, one not yet struck down is told as he was before it.)
      standing = !!during && b?.death?.event === during.event && !during.struck.some((s) => s.fell);
    family = f
      ? familyLine(standing ? { ...f, self: { ...f.self, died: null, how: null } } : f)
      : null;
  }
  if (!b) return { family, body: null };
  const wounds = during ? b.wounds.filter((w) => w.event !== during.event) : b.wounds,
    death = during && b.death?.event === during.event ? null : b.death,
    at = toldAt({ ...b, wounds, death }, t);
  return {
    family,
    body: bodyLine(bodyAt(b.frame, wounds, at, death, during?.struck ?? []), wounds, at, b.sex),
  };
}

/**
 * Where history's blows fell on the men a battle's roll names (Phase 55 wave 5), by their refs: the
 * blow that killed each of its fallen, the wound of each of its hurt — so the battle seen near
 * strikes each named man where his page says he was struck.
 */
export function battleMembers(
  world: World,
  event: string,
  most?: number,
): Readonly<Record<string, StruckMember>> {
  const roll = battleRoll(world, event, most),
    out: Record<string, StruckMember> = {};
  if (!roll) return out;
  for (const side of [roll.attacker, roll.defender]) {
    for (const e of side.fell) {
      const d = bodyOf(world, e.ref)?.death;
      if (d && d.event === event) out[e.ref] = { member: d.member, cut: false };
    }
    for (const e of side.hurt) {
      const w = bodyOf(world, e.ref)?.wounds.find((x) => x.event === event);
      if (w) out[e.ref] = { member: w.member, cut: w.how === "cut off" };
    }
  }
  return out;
}

/** Kin and body for the client (Phase 55 wave 5): a card's lines, and the people's body plan. */
export const KIN_QUERIES: Readonly<Record<string, QueryHandler>> = {
  "kin.card": (world, args) => {
    const a = args as { ref: string; t?: number; during?: During };
    return kinCard(
      world,
      a.ref,
      typeof a.t === "number" && Number.isFinite(a.t) ? a.t : world.now,
      a.during && typeof a.during.event === "string" && Array.isArray(a.during.struck)
        ? a.during
        : null,
    );
  },
  "people.anatomy": (world) => bodyFrameOf(world),
  "battle.members": (world, args) => {
    const a = args as { event: string; most?: number };
    return battleMembers(world, a.event, a.most);
  },
};
