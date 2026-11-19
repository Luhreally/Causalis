// What is going on in a town that belongs to something larger its land's kept state holds: a group that meets, a society that
// gives, a family that takes payment from those who trade, a street's gangs keeping a corner, what its realm bars sold in a back
// lane, soldiers posted in its streets, a head's house guarded, and one not of the town brought before its court. Every one is read
// from the rows the world keeps for the town's land and year (sim/order/underworld-kept.ts, groups-kept.ts, sim/money), and is not
// there where they hold nothing: a quiet village has none. Who of the town is in each is drawn from the town's own lines by a key
// of the thing itself, so the same people are in it year on year, and one going more or less moves no one else. Pure reads: nothing
// here flows back into the world. Words say what, who, at what cost and with what effect; never how.
import { envoyAtCourt } from "./ties.ts";
import { notablesIn } from "./notables.ts";
import { finish, hashString, mix, type Ref, type World } from "../../kernel/index.ts";
import {
  CONTRA_CAUSES,
  GROUP_KINDS,
  JUDGED,
  JUDGE_SENTENCES,
  OCC,
  PARTS as LIFE_PARTS,
  WARE_ARMS,
  WARE_INTOX,
  wareName,
  type PartId,
} from "../../rules/index.ts";
import {
  GANG_ROW,
  INTOX,
  INTOX_STORE,
  contrabandOf,
  gangsStore,
  groupsIn,
  kindName,
  deathNotesOf,
  groupOfBoss,
  WAS_MOST,
  creditOf,
  handOf,
  kindOfGroup,
  lifeOf,
  moneyStore,
  organisedIn,
  orgsOf,
  politiesOf,
  populationContext,
  realmName,
  soldiersIn,
  underworldOf,
  warsOf,
  type Org,
  type Polity,
  type Settlement,
} from "../../sim/index.ts";
import { groupWords, orgWords } from "../../causal/index.ts";
import {
  GOING_ICON,
  type Block,
  type Item,
  type Leader,
  type Stat,
  type TownGoing,
  type VillagePlan,
} from "../../bridge/index.ts";
import { fedRef, groupRef, opRef } from "../underworld.ts";
import { hostKinds } from "../arms.ts";
import { realmColor } from "../colors.ts";
import { orgRef } from "../groups.ts";
import { folkWork, townRoster, workOf } from "../roster.ts";
import {
  casesOf,
  courtFormOf,
  folkOf,
  heldCaseOf,
  lastCaseOf,
  ruledCase,
  type Case,
  type FolkSlot,
  type Party,
} from "./justice.ts";
import { musicOf } from "./customs.ts";
import { seatTownOf } from "../leaders.ts";
import { seatHolder } from "../kin.ts";
import { worthWords } from "../../bridge/index.ts";
import { courtLeaders } from "../court.ts";
import { count, item, link, many, stat, yearNow } from "./words.ts";

/** The towns of a land its underworld is seen in: its most peopled, as its crime is read of them (host/inspect/underworld.ts). */
const UNDER_TOWNS = 4;
/** No fewer people than this for a town's street to hold a racket, a corner or a back lane's trade. */
const UNDER_LEAST = 600;
/** The most groups a town's days show meeting, and the most of each thing's people drawn. */
export const LIFE_MOST = {
  groups: 3,
  members: 8,
  given: 5,
  payers: 6,
  corner: 6,
  soldiers: 6,
  guards: 2,
} as const;

/** The lines a town's goings draw their people from (its first), and the parts its underworld's things each keep to. */
const POOL = 96,
  PARTS = 8,
  PART = { collect: 0, guard: 1, corner: 3, patrol: 4, seller: 5, pays: 6, buys: 7 } as const,
  unit = (h: number, n: number): number => finish(mix(h, n), 13) / 4294967296;

/** A group's head as one of their town's key figures: who the hand can be laid from, and where they live. */
function headOf(
  world: World,
  realm: Polity,
  ref: string,
  head: { readonly name: string; readonly born: number; readonly since: number },
  group: string,
  did: string,
  why: string,
  s: Settlement,
): Leader {
  const year = yearNow(world);
  return {
    ref,
    kind: "head",
    name: head.name,
    title: `Head of ${group}, of ${realmName(realm)}`,
    did,
    why,
    town: s.ref,
    townName: s.name,
    as: {
      name: head.name,
      age: Math.max(lifeOf(world).adulthood, Math.min(300, year - head.born)),
      // (They live on what their group takes and trades, and hold no seat: a life lived as them works as a trader's does.)
      occupation: OCC.trader,
      // (No record says: by who they are, the same every read.)
      sex: (hashString(`${ref}|${head.name}`) >>> 0) & 1,
    },
    cannot: null,
  };
}

/**
 * A group's head by their page (`boss:<realm>:<event>`), as a key figure of the town they live in: the first town of their
 * group's home land, where the town's days show them (null: none such, or their town is not one that shows it).
 */
export function headLeader(world: World, ref: string): Leader | null {
  const m = /^boss:(pol:\d+:\d+):(ev:\d+:\d+)$/.exec(ref),
    realm = m ? politiesOf(world).get(m[1] as Ref) : undefined;
  if (!m || !realm) return null;
  const g =
    underworldOf(world)
      ?.of(realm.ref)
      ?.groups.find((x) => x.event === m[2]) ??
    orgsOf(world)
      ?.of(realm.ref)
      ?.orgs.find((x) => x.event === m[2]);
  if (!g) return null;
  const first = populationContext(world)
    .settlements.inProvince(g.home)
    .filter((t) => t.population > 0)
    .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))[0];
  return (first && townRolesOf(world, first.ref).heads.find((h) => h.ref === ref)) || null;
}

/** How a head went, after "who". */
const HEAD_WENT: Readonly<Record<"years" | "taken" | "struck", string>> = {
  years: "died of their years",
  taken: "was taken by the realm's soldiers",
  struck: "was killed",
};
/** A list's line with the one it names to be gone to and followed at a press (none: as it is). */
const toWho = (i: Item, who: string | undefined): Item => (who ? { ...i, who } : i);
const sentenceOf = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s),
  pct = (x: number) =>
    x > 0 && x < 0.01 ? "under 1%" : `${Math.round(Math.min(1, Math.max(0, x)) * 100)}%`;

/** A town's place among its land's towns by people (0: its greatest), of those standing a year or more. */
function rankIn(world: World, s: Settlement, year: number): number {
  const standing = populationContext(world)
    .settlements.inProvince(s.cell)
    .filter((t) => t.population > 0 && t.founded < year)
    .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1));
  const k = standing.findIndex((t) => t.ref === s.ref);
  return k < 0 ? standing.length : k;
}

/** How each kind of group gathers: where, and whether behind closed doors (absent: its people do not gather in a town). */
const GATHERS: Readonly<
  Record<string, { where: TownGoing["where"]; closed?: true; kind: "meeting" | "alms"; at: string }>
> = {
  "mutual-aid society": { where: "granary", kind: "alms", at: "giving" },
  confraternity: { where: "temple", kind: "meeting", at: "meeting" },
  brotherhood: { where: "home", kind: "meeting", at: "meeting" },
  "lending circle": { where: "home", kind: "meeting", at: "meeting" },
  "merchant league": { where: "market", kind: "meeting", at: "meeting" },
  commune: { where: "square", kind: "meeting", at: "assembly" },
  party: { where: "square", kind: "meeting", at: "meeting" },
  sect: { where: "temple", kind: "meeting", at: "gathering" },
  "monastic order": { where: "temple", kind: "meeting", at: "gathering" },
  "learned society": { where: "home", kind: "meeting", at: "meeting" },
  militia: { where: "square", kind: "meeting", at: "muster" },
  vigilantes: { where: "square", kind: "meeting", at: "muster" },
  lodge: { where: "home", closed: true, kind: "meeting", at: "meeting" },
  "hidden sect": { where: "home", closed: true, kind: "meeting", at: "gathering" },
  "revolutionary circle": { where: "home", closed: true, kind: "meeting", at: "meeting" },
  resistance: { where: "home", closed: true, kind: "meeting", at: "meeting" },
};

/** What a group's people are there for, in a few words after "for" (by its kind). */
const FOR: Readonly<Record<string, string>> = {
  "mutual-aid society": "its sick, its widowed and its dead",
  confraternity: "its own, and those it buries",
  brotherhood: "its own",
  "lending circle": "what each pays in, lent to one of them in turn",
  "merchant league": "safe passage and its merchants' rights",
  commune: "the town's own rule",
  party: "its candidate and what its people want of the seat",
  sect: "its faith, which the seat presses",
  "monastic order": "its rule, its learning and its stores",
  "learned society": "what its members have found and written",
  militia: "the guarding of its own",
  vigilantes: "holding wrongdoers to account where courts are few",
  lodge: "its own counsel",
  "hidden sect": "a faith kept out of sight",
  "revolutionary circle": "what it means for the seat",
  resistance: "what it means for those who hold the land",
};

/** Every realm's groups at home in a land or holding any part of it, the strongest first. */
function orgsIn(world: World, cell: number): { r: Polity; g: Org }[] {
  const store = orgsOf(world);
  if (!store) return [];
  const realms = politiesOf(world),
    out: { r: Polity; g: Org }[] = [];
  for (const ref of store.realmsKept()) {
    const r = realms.get(ref as Ref);
    if (!r) continue;
    for (const g of store.of(ref)!.orgs)
      if (g.home === cell || g.lands.includes(cell)) out.push({ r, g });
  }
  return out.sort((a, b) => b.g.power - a.g.power || a.g.id - b.g.id);
}

/** A town's life beyond its work: what goes on, whom of its lines a part of it names, and those not of it who stand in it. */
export type TownLife = {
  readonly goings: readonly TownGoing[];
  /** Those of the town's lines a going names: to be drawn as themselves, however few the town draws. */
  readonly named: readonly Party[];
  /** Those not of the town who stand in it: soldiers posted, one brought before its court from outside. */
  readonly outsiders: readonly (VillagePlan["people"][number] & { readonly page: string })[];
  /** The court's cases this year and last whose accused is not of the town, each with who stands for them. */
  readonly tried: readonly { readonly c: Case; readonly ref: string }[];
  /**
   * Those history keeps by name who live in it and are someone there: the heads of the groups whose home it is. Each is one of
   * the town's key figures (host/leaders.ts): a body at their own house, the same one their page is of.
   */
  readonly heads: readonly Leader[];
  /** The names of those a going names who are not of its lines (its heads, its ruler and court): for a line that leads to one. */
  readonly known: readonly (readonly [string, string])[];
  /** Those of its underworld its court holds now: who they were for it, and the case that took them from it. */
  readonly past: readonly {
    readonly ref: string;
    readonly going: TownGoing;
    readonly case: Case;
  }[];
};

const NONE: TownLife = {
  goings: [],
  named: [],
  outsiders: [],
  tried: [],
  past: [],
  heads: [],
  known: [],
};
const KEPT = new WeakMap<World, { now: number; by: Map<string, TownLife> }>();
const ROLES = new WeakMap<World, { now: number; by: Map<string, TownLife> }>();

/**
 * A town's goings and who is of each, as its land's rows have them, before what its court has done with any of them: what the
 * court itself reads to know whom a case of a group is of (host/inspect/justice.ts). No case is read here.
 */
export function townRolesOf(world: World, town: string, year = yearNow(world)): TownLife {
  let kept = ROLES.get(world);
  if (!kept || kept.now !== world.now) ROLES.set(world, (kept = { now: world.now, by: new Map() }));
  const key = `${town}|${year}`,
    hit = kept.by.get(key);
  if (hit) return hit;
  const read = readRoles(world, town, year);
  kept.by.set(key, read);
  return read;
}

/** A town's life as its land's rows have it this year (kept while the world's moment stands). */
export function townLifeOf(world: World, town: string, year = yearNow(world)): TownLife {
  let kept = KEPT.get(world);
  if (!kept || kept.now !== world.now) KEPT.set(world, (kept = { now: world.now, by: new Map() }));
  const key = `${town}|${year}`,
    hit = kept.by.get(key);
  if (hit) return hit;
  const read = readLife(world, town, year);
  kept.by.set(key, read);
  // (Who was of each thing by the town's lines, as last read while no hand rested on it: under the hand, one it was laid
  // from is still that, by name. What the court had done by then is in it: one who took a part up from another held is of it.)
  if (year === yearNow(world) && handOf(world).resting?.village !== town) {
    let all = BY_LINES.get(world);
    if (!all) BY_LINES.set(world, (all = new Map()));
    const names = new Map(read.named.map((p) => [p.ref, p.name] as const));
    all.set(
      town,
      new Map(
        read.goings.map((g) => [
          g.key,
          new Set(g.who.flatMap((ref) => (names.has(ref) ? [names.get(ref)!] : []))),
        ]),
      ),
    );
  }
  return read;
}
const BY_LINES = new WeakMap<World, Map<string, Map<string, ReadonlySet<string>>>>();

/**
 * Who of a town is of each thing going on there now, by name, as its lines have it with no hand on it: what hand.lay is told
 * as `was`, so the hand keeps it (a save loaded with the hand resting has no other memory of it). Empty: nothing going on, or
 * the hand rests there already.
 */
export function linesWere(
  world: World,
  town: string,
): { readonly key: string; readonly names: readonly string[] }[] {
  if (handOf(world).resting?.village === town) return [];
  const read = townLifeOf(world, town),
    names = new Map(read.named.map((p) => [p.ref, p.name] as const));
  return read.goings
    .slice(0, WAS_MOST.goings)
    .map((g) => ({
      key: g.key,
      names: g.who
        .flatMap((ref) => (names.has(ref) ? [names.get(ref)!] : []))
        .slice(0, WAS_MOST.names),
    }))
    .filter((g) => g.names.length > 0);
}

/** What each kind's people are for their group, for one who was it ("its collector"). */
const ROLE_NAME: Readonly<Record<TownGoing["kind"], string>> = {
  collect: "its collector",
  seller: "its seller",
  guard: "a guard at its head's house",
  patrol: "one of those on its round",
  corner: "one of those who kept its corner",
  meeting: "a member",
  alms: "one of its givers",
  posted: "a soldier",
};

/**
 * A town's goings with what its court has done laid on them: one of its underworld the court holds (locked up, at labour, sent
 * away) is off what they were at, and another of the same lines' part takes it up in their place, saying from whom and since
 * when; the one held is told as who they were for it and what came of them. One let go is back at it. And those not of the town
 * its court hears, who are stood for at its sitting.
 */
function readLife(world: World, town: string, year: number): TownLife {
  const roles = townRolesOf(world, town, year),
    s = populationContext(world).settlements.get(town as Ref);
  if (!s || s.population <= 0) return NONE;
  const outsiders = [...roles.outsiders],
    folk = roles.goings.some((g) => UNDER_KINDS.has(g.kind)) ? folkOf(world, s, year) : null,
    after = afterCourt(roles, folk?.slots(POOL) ?? [], (ref) => heldCaseOf(world, town, ref)),
    past = after.past,
    named = [...after.named];
  // (Under the hand: one it was laid from, who was of a thing by the town's lines when it came to rest (having taken it up
  // from one the court held, as may be), is of it still, by the name they were known by, unless the court holds them now.)
  // (As the hand was told when it was laid, which a save keeps; else as last read here with no hand on it.)
  const resting = handOf(world).resting,
    kept = resting?.village === town ? resting.was : undefined,
    byLines: ReadonlyMap<string, ReadonlySet<string>> | undefined =
      resting?.village === town && folk
        ? kept
          ? new Map(kept.map((g) => [g.key, new Set(g.names)] as const))
          : BY_LINES.get(world)?.get(town)
        : undefined,
    all = byLines ? folk!.slots(POOL) : [],
    goings = !byLines
      ? after.goings
      : after.goings.map((g) => {
          const were = byLines.get(g.key),
            one = were
              ? all.find(
                  (x) =>
                    were.has(x.party.name) &&
                    !g.who.includes(x.party.ref) &&
                    !heldCaseOf(world, town, x.party.ref),
                )
              : undefined;
          if (!one) return g;
          named.push(one.party);
          return { ...g, who: [one.party.ref, ...g.who.slice(0, Math.max(0, g.who.length - 1))] };
        });
  // —— One not of the town before its court: someone stands for them at its sitting. ——
  const tried: { c: Case; ref: string }[] = [],
    stood = new Set<string>();
  for (const c of [...casesOf(world, town, year - 1), ...casesOf(world, town, year)]) {
    if (!c.accused.outside) continue;
    if (c.year !== year && c.day + c.days < year * 365) continue;
    // (One for each case: two cases may be of the same group's people, and they are not the same one.)
    const ref = `out:${c.ref}`;
    tried.push({ c, ref });
    if (stood.has(ref)) continue;
    stood.add(ref);
    outsiders.push({
      ref,
      page: c.accused.ref,
      name: cap(c.accused.name),
      role: `not of ${s.name}: brought before its court in year ${c.year}`,
      home: 0,
      age: 30 + ((hashString(ref) >>> 0) % 20),
      occupation: OCC.dependent,
      child: false,
      sex: c.accused.sex,
      folk: true,
      outsider: true,
    });
  }
  return { goings, named, outsiders, tried, past, heads: roles.heads, known: roles.known };
}

/**
 * A town's goings with those its court holds taken off them, and who takes each one's place: pure of what holds whom (`held`:
 * the case that holds one now, or none), so it is the same for the same answers.
 */
export function afterCourt(
  roles: Pick<TownLife, "goings" | "named">,
  pool: readonly FolkSlot[],
  held: (ref: string) => Case | null,
): Pick<TownLife, "goings" | "named" | "past"> {
  const named = new Map(roles.named.map((p) => [p.ref, p] as const)),
    past: TownLife["past"][number][] = [],
    goings = roles.goings.map((g) => {
      if (!UNDER_KINDS.has(g.kind)) return g;
      const who: string[] = [],
        took: Record<string, string> = {};
      for (const ref of g.who) {
        const c = held(ref);
        if (!c) {
          who.push(ref);
          continue;
        }
        const was = named.get(ref)?.name ?? "another";
        past.push({ ref, going: g, case: c });
        // Who takes it up: the next of the same part of the town's lines by the thing's own key, the same one while it lasts.
        const part = pool.find((x) => x.party.ref === ref),
          h = hashString(`${g.key}|after|${c.ref}`) >>> 0,
          next = pool
            .filter(
              (x) =>
                part &&
                x.id % PARTS === part.id % PARTS &&
                !g.who.includes(x.party.ref) &&
                !who.includes(x.party.ref) &&
                !held(x.party.ref),
            )
            .sort((p, q) => unit(h, p.id) - unit(h, q.id) || p.id - q.id)[0];
        if (!next) continue;
        named.set(next.party.ref, next.party);
        who.push(next.party.ref);
        took[next.party.ref] = `took it up from ${was} in year ${c.year}`;
      }
      return who.length === g.who.length && !Object.keys(took).length
        ? g
        : { ...g, who, ...(Object.keys(took).length ? { took } : {}) };
    });
  return { goings: goings.filter((g) => g.who.length), named: [...named.values()], past };
}
const UNDER_KINDS: ReadonlySet<string> = new Set([
  "collect",
  "seller",
  "guard",
  "patrol",
  "corner",
]);

function readRoles(world: World, town: string, year: number): TownLife {
  const s = populationContext(world).settlements.get(town as Ref);
  if (!s || s.population <= 0) return NONE;
  const r = politiesOf(world).of(s.cell),
    rank = rankIn(world, s, year),
    folk = folkOf(world, s, year),
    work = folkWork(world, s.cell),
    grown = lifeOf(world).adulthood,
    goings: TownGoing[] = [],
    named = new Map<string, Party>(),
    outsiders: (VillagePlan["people"][number] & { page: string })[] = [],
    heads: Leader[] = [],
    known: (readonly [string, string])[] = [];
  /**
   * So many of the town's own by a thing's key: of its first lines' holders (POOL of them), ordered by the key and their line, so
   * the same people are of it year on year. Each thing of its underworld draws from lines of its own (`part`: one in PARTS of
   * the pool), so no one is two things in it and no thing coming or going moves another's people. The lawful groups' people are
   * drawn from all of it, and may be of more than one thing, as people are.
   */
  const pool = folk.slots(POOL),
    // (Under the hand its people are the hand's, drawn anew; but one the hand was laid from is among them by the name they
    // were known by, and is still what they were for their group: who its lines' holders were of each thing, by name, first.)
    hand = handOf(world).resting,
    lines = hand && hand.village === s.ref ? folkOf(world, s, year, true).slots(POOL) : null,
    order = (
      of: readonly FolkSlot[],
      key: string,
      weigh: ((key: number, born: number) => number) | undefined,
      part: number,
      not: ReadonlySet<string>,
    ) => {
      const h = hashString(key) >>> 0;
      return of
        .filter((x) => (part < 0 || x.id % PARTS === part) && !not.has(x.party.ref))
        .map((x) => ({
          x,
          // (Those it leans to first, then by the draw.)
          at: (weigh && weigh(x.key, x.born) >= 1 ? 0 : 1) + unit(h, x.id),
        }))
        .sort((p, q) => p.at - q.at || p.x.id - q.x.id)
        .map((y) => y.x);
    },
    draw = (
      key: string,
      n: number,
      weigh?: (key: number, born: number) => number,
      part = -1,
      not: ReadonlySet<string> = new Set(),
    ): string[] => {
      const were = lines
          ? new Set(
              order(lines, key, weigh, part, new Set())
                .slice(0, n)
                .map((x) => x.party.name),
            )
          : null,
        known = were ? pool.filter((x) => were.has(x.party.name) && !not.has(x.party.ref)) : [],
        from = [...known, ...order(pool, key, weigh, part, not).filter((x) => !known.includes(x))],
        out: string[] = [];
      for (const x of from.slice(0, n)) {
        named.set(x.party.ref, x.party);
        out.push(x.party.ref);
      }
      return out;
    };
  const young = (_: number, born: number) => (year - born < grown + 14 ? 4 : 0.2),
    old = (_: number, born: number) => (year - born >= 55 ? 4 : 0.3),
    trading = (key: number) => {
      const w = workOf(key, work);
      return w === OCC.trader ? 6 : w === OCC.crafter ? 3 : 0.2;
    };

  // —— Its groups: those at home in its land or holding it, where the town is one its people gather in. ——
  if (rank < 2) {
    let shown = 0;
    for (const { r: realm, g } of orgsIn(world, s.cell)) {
      if (shown >= LIFE_MOST.groups) break;
      // (A group at home here gathers in its land's first town; one that only holds the land, there too.)
      if (rank > 0 && g.home !== s.cell) continue;
      const kind = kindName(g),
        how = GATHERS[kind];
      if (!how) continue;
      const name = orgWords(g.name, kind),
        ref = orgRef(realm.ref, g.event),
        key = `${ref}|${town}`,
        n = Math.min(LIFE_MOST.members, Math.max(3, Math.round(Math.log10(g.members + 1) * 2))),
        land = organisedIn(world, s.cell),
        who = draw(key, how.kind === "alms" ? 3 : n);
      if (!who.length) continue;
      shown++;
      if (how.kind === "alms") {
        const to = draw(`${key}|given`, LIFE_MOST.given, old, -1, new Set(who));
        goings.push({
          kind: "alms",
          key,
          of: { ref, name },
          words: `${cap(name)} gives bread and care to its own in need`,
          doing: `Giving out bread for ${name}, to its own in need`,
          why: [
            ...(land?.spared
              ? [`${pct(land.spared)} of this land's deaths are spared by what its people pool`]
              : []),
            `it has ${count(g.members)} members${g.gives >= 10 ? ` and gives ${count(Math.round(g.gives))} grain's worth a year` : ""}`,
          ].join("; "),
          who,
          to,
          toDoing: `Taking the bread ${name} gives its own in need`,
          where: how.where,
        });
        continue;
      }
      // (Its head, at its home land's first town: one of the town's key figures, who leads what it holds there.)
      const leads = rank === 0 && g.home === s.cell ? `boss:${realm.ref}:${g.event}` : null;
      if (leads) {
        heads.push(
          headOf(
            world,
            realm,
            leads,
            g.leader,
            name,
            `Leads ${name} since year ${g.leader.since}.`,
            g.event,
            s,
          ),
        );
        known.push([leads, g.leader.name]);
        who.unshift(leads);
      }
      goings.push({
        ...(leads
          ? { lead: `Leading the ${how.at} of ${name}${how.closed ? ", behind closed doors" : ""}` }
          : {}),
        kind: "meeting",
        key,
        of: { ref, name },
        words: how.closed
          ? `${cap(name)} meets behind closed doors`
          : `${cap(name)} holds its ${how.at}`,
        doing: how.closed
          ? `Gone in to the ${how.at} of ${name}, behind closed doors`
          : `At the ${how.at} of ${name}`,
        why: `${count(g.members)} members under ${g.leader.name}, for ${FOR[kind] ?? "its own"}`,
        since: g.since,
        who,
        where: how.where,
        ...(how.closed ? { closed: true as const } : {}),
      });
    }
  }

  // —— Its realm's seat: the ruler holds court with those of the court, every day; and looks over the levy while it is at war. ——
  if (r && r.ended === null && seatTownOf(world, r)?.ref === town) {
    const court = courtLeaders(world, r),
      ruler = `rule:${r.ref}`,
      foe = warsOf(world)
        .fighting(r.ref)
        .find((x) => x.ended === null),
      other = foe
        ? politiesOf(world).get(foe.attacker === r.ref ? foe.defender : foe.attacker)
        : null;
    // (One come from another seat, at its court this year or last: heard there. host/inspect/ties.ts)
    const envoy = envoyAtCourt(world, town as Ref).envoy;
    known.push([ruler, r.ruler.name], ...court.map((c) => [c.ref, c.name] as const));
    goings.push({
      kind: "meeting",
      key: `${r.ref}|court`,
      of: { ref: r.ref, name: `the court of ${realmName(r)}` },
      words: `${r.ruler.name} holds court at the seat of ${realmName(r)}`,
      doing: `At court before ${r.ruler.name}`,
      lead: envoy
        ? `Holding court at the seat, hearing ${envoy.name}`
        : "Holding court at the seat",
      why: court.length
        ? `${many(court.length, "one of the court attends", "of the court attend")}; ${r.ruler.name} has ruled since year ${r.ruler.since}`
        : `${r.ruler.name} has ruled since year ${r.ruler.since}`,
      since: r.ruler.since,
      who: [ruler, ...court.map((c) => c.ref)],
      where: "home",
      every: true,
      hours: [9, 12],
    });
    if (other)
      goings.push({
        kind: "meeting",
        key: `${r.ref}|review`,
        of: { ref: foe!.ref, name: `the war against ${realmName(other)}` },
        words: `${r.ruler.name} looks over the levy drilled for the war against ${realmName(other)}`,
        doing: `Looking over the levy drilled for the war against ${realmName(other)}`,
        why: `${realmName(r)} has been at war with ${realmName(other)} since year ${foe!.declared}`,
        who: [ruler],
        where: "square",
        every: true,
        hours: [17.5, 19],
      });
  }

  // —— Those who hold its offices and head its great things (host/inspect/notables.ts): what each does in its day. ——
  for (const n of notablesIn(world, town)) {
    if (n.away) continue;
    known.push([n.ref, n.name]);
    if (n.kind === "priest")
      goings.push({
        kind: "meeting",
        key: `${n.ref}|keep`,
        of: n.of,
        words: `${n.name} keeps the temple of ${s.name}`,
        doing: `Keeping the temple of ${s.name}`,
        why: `for ${n.of.name}, since year ${n.since}`,
        who: [n.ref],
        where: "temple",
        every: true,
        hours: [7.5, 10],
      });
    else if (n.kind === "merchant")
      goings.push({
        kind: "meeting",
        key: `${n.ref}|stall`,
        of: n.of,
        words: `${n.name}, the richest of its merchants, is at their stall`,
        doing: "At their stall, on market day",
        why: `one of those ${s.name}'s market is known by`,
        who: [n.ref],
        where: "market",
        market: true,
        hours: [8.5, 12],
      });
    else if (n.kind === "house" || n.kind === "general") {
      // (At court before the ruler, where they live at the realm's seat.)
      const court = goings.find((g) => g.key.endsWith("|court"));
      if (court) (court.who as string[]).push(n.ref);
    }
  }

  // —— Its underworld: only in its land's few greatest towns, and only what its land's row holds. ——
  const under = groupsIn(world, s.cell),
    rec = r ? underworldOf(world)?.of(r.ref) : undefined,
    streets = rank < UNDER_TOWNS && s.population >= UNDER_LEAST;
  if (r && rec && under && streets) {
    const holder = under.group !== null ? rec.groups.find((g) => g.id === under.group) : undefined,
      // (Soldiers sent into this land, under way: those they are against lie low, and the street's gangs keep off it.)
      op = (rec.ops ?? []).find((o) => o.ended === null && o.lands.includes(s.cell)),
      // (A war of the holder's with another group, under way: its people say so.)
      war = holder
        ? rec.wars.find((x) => x.ended === null && (x.a === holder.id || x.b === holder.id))
        : undefined,
      atWar =
        war && holder
          ? `; it is at war with ${groupWords(war.names[war.a === holder.id ? 1 : 0], GROUP_KINDS[war.kind])} since year ${war.since}`
          : "";
    // A family that takes payment from those who trade.
    if (holder && kindOfGroup(holder) === "protection" && under.protection >= 0.03) {
      const name = groupWords(holder.name, "protection"),
        ref = groupRef(r.ref, holder.event),
        // (By the town alone: whoever comes to hold the land, the same one collects, now for them.)
        key = `${town}|collect`,
        who = draw(key, s.population >= 20_000 ? 2 : 1, undefined, PART.collect),
        to = draw(
          `${key}|pay`,
          Math.min(LIFE_MOST.payers, Math.max(2, Math.round(under.protection * 20))),
          trading,
          PART.pays,
        );
      if (who.length && to.length)
        goings.push({
          kind: "collect",
          key,
          of: { ref, name },
          words: `${cap(name)} takes payment from those who trade here`,
          doing: `Collecting for ${name}, from those who pay it to be left to trade`,
          why: `${pct(under.protection)} of this land's trade is under its protection, and its hold here is ${pct(under.control)}${atWar}`,
          since: holder.since,
          ...(op && op.target === holder.id
            ? {
                quiet: `Lying low while soldiers sent against ${name} are in the streets: its collecting waits`,
              }
            : {}),
          who,
          to,
          toDoing: `Paying ${name}'s collector what is asked, to be left to trade`,
          where: "market",
        });
    }
    // A head's house, guarded: in its home land's first town.
    if (rank === 0) {
      let houses = 0;
      for (const g of rec.groups) {
        if (g.home !== s.cell || kindOfGroup(g) === "badge" || houses >= 2) continue;
        const name = groupWords(g.name, GROUP_KINDS[g.kind]),
          ref = `boss:${r.ref}:${g.event}`,
          key = `${ref}|${town}|guard`,
          who = draw(
            key,
            g.members >= 30 ? LIFE_MOST.guards : 1,
            young,
            PART.guard + ((hashString(g.event) >>> 0) % 2),
          );
        if (!who.length) continue;
        houses++;
        // (Who headed it before, where history keeps a note of them: taken, killed, or dead of their years.)
        const before = (deathNotesOf(world)?.headsOf(ref) ?? [])
            .filter((n) => n.year <= year)
            .sort((p, q) => p.year - q.year)
            .at(-1),
          after = before
            ? `, having taken its head from ${before.name}, who ${HEAD_WENT[before.how]} in year ${before.year}`
            : "";
        // (Its head, whom history keeps by name: one of the town's key figures, at that house. Their page is their own.)
        heads.push(
          headOf(
            world,
            r,
            ref,
            g.boss,
            name,
            `Heads ${name} since year ${g.boss.since}${after}.`,
            g.event,
            s,
          ),
        );
        known.push([ref, g.boss.name]);
        goings.push({
          to: [ref],
          toDoing: `At home, where ${name} is headed from, guards at the door`,
          since: g.boss.since,
          kind: "guard",
          key,
          of: { ref, name: `${g.boss.name}, who heads ${name}` },
          words: `${g.boss.name}, who heads ${name}, keeps a house here, and it is guarded`,
          doing: `Guarding the house of ${g.boss.name}, who heads ${name}`,
          why: `${name} has ${count(g.members)} men, and this is its home land${before ? `; ${g.boss.name} took over from ${before.name}, who ${HEAD_WENT[before.how]} in year ${before.year}` : ""}`,
          // (One gone from a group's head has a page of their own, by the year they went.)
          ...(before ? { before: { ref: `${ref}:${before.year}`, name: before.name } } : {}),
          who,
          where: "house",
        });
      }
    }
    // Its street's gangs, keeping a corner.
    if (under.gangs > 0 && under.street >= 0.02) {
      const row = gangsStore(world),
        fed = [row?.at(s.cell, GANG_ROW.fedA) ?? 0, row?.at(s.cell, GANG_ROW.fedB) ?? 0]
          .filter((x) => x > 0)
          .map((x) => rec.feds.find((f) => f.id === x - 1))
          .find((f) => !!f),
        ref = fed ? fedRef(r.ref, fed.event) : `${r.ref}#underworld`,
        name = fed ? `the ${fed.name} federation` : "the town's small gangs",
        key = `${r.ref}|${town}|corner`,
        who = draw(
          key,
          Math.min(LIFE_MOST.corner, Math.max(3, 2 + Math.round(under.street * 20))),
          young,
          PART.corner,
        );
      const gangHead = notablesIn(world, town).find((n) => n.kind === "gang");
      if (gangHead) who.push(gangHead.ref);
      if (who.length >= 2)
        goings.push({
          kind: "corner",
          key,
          of: { ref, name },
          words: fed
            ? `A corner is held by a gang of the ${fed.name} federation`
            : `A corner is held by one of its ${many(under.gangs, "small gang", "small gangs")}`,
          doing: fed
            ? `Keeping a corner with a gang of the ${fed.name} federation`
            : "Keeping a corner with one of the town's small gangs",
          watch: fed
            ? `On watch down the street for a gang of the ${fed.name} federation`
            : "On watch down the street for one of the town's small gangs",
          why: `${many(under.gangs, "small gang", "small gangs")} in its land's towns, their pull on its young ${pct(under.street)}`,
          ...(fed ? { since: fed.since } : {}),
          ...(op ? { quiet: "Off the corner while soldiers are posted in the streets" } : {}),
          who,
          where: "corner",
        });
    }
    // A crew of the realm's own enforcers working the town: two of it on their round.
    const crew = under.badge > 0 ? rec.groups.find((g) => kindOfGroup(g) === "badge") : undefined;
    // (Its head, at the realm's seat: one of that town's key figures, as a family's head is of theirs.)
    if (crew && seatTownOf(world, r)?.ref === town) {
      const ref = `boss:${r.ref}:${crew.event}`,
        name = groupWords(crew.name, "badge");
      heads.push(
        headOf(
          world,
          r,
          ref,
          crew.boss,
          name,
          `Heads ${name} since year ${crew.boss.since}.`,
          crew.event,
          s,
        ),
      );
      known.push([ref, crew.boss.name]);
    }
    if (crew) {
      const name = groupWords(crew.name, "badge"),
        ref = groupRef(r.ref, crew.event),
        key = `${ref}|${town}|patrol`,
        who = draw(key, 2, undefined, PART.patrol);
      if (who.length)
        goings.push({
          kind: "patrol",
          key,
          of: { ref, name },
          words: `${cap(name)}, enforcers of ${realmName(r)} ${crew.squad ? "who kill outside the law" : "who keep what they seize"}, walk its streets`,
          doing: `On their round of the streets with ${name}`,
          // (A crew that keeps what it seizes and is paid by those it leaves alone: one call of its round is where it is paid.)
          ...(!crew.squad && crew.income > 0
            ? { toDoing: `Calling where ${name} is paid to leave a trade alone` }
            : {}),
          why: `it works ${pct(under.badge)} of this land, and has ${count(crew.members)} men`,
          since: crew.since,
          who,
          where: "square",
        });
    }
    // Soldiers sent into its land against a group, posted in its streets.
    for (const o of rec.ops ?? []) {
      if (o.ended !== null || !o.lands.includes(s.cell)) continue;
      const here = soldiersIn(world, r.ref as Ref, s.cell),
        n = Math.min(LIFE_MOST.soldiers, Math.max(2, Math.round(here / 150))),
        against = groupWords(o.name, GROUP_KINDS[o.kind]),
        arm = hostKinds(world, r.ref)?.arm ?? "",
        page = opRef(r.ref, o.event),
        who: string[] = [];
      for (let k = 0; k < n; k++) {
        // (Their town in it: the page a line leads to by it lands on them.)
        const ref = `out:${town}:${page}:${k}`;
        who.push(ref);
        outsiders.push({
          ref,
          page,
          name: `A soldier of ${realmName(r)}`,
          role: `a soldier of ${realmName(r)}, not of ${s.name}: posted here against ${against}${arm ? `, armed as its host is, with the ${arm}` : ""}`,
          home: 0,
          age: 20 + ((hashString(ref) >>> 0) % 14),
          occupation: OCC.dependent,
          child: false,
          sex: 1,
          folk: true,
          outsider: true,
          host: true,
        });
      }
      goings.push({
        kind: "posted",
        key: `${page}|${town}`,
        of: { ref: page, name: `the soldiers sent against ${against}` },
        words: `Soldiers of ${realmName(r)} are posted in its streets, sent against ${against} in year ${o.since}`,
        doing: `Posted in the streets: one of ${count(here || o.soldiers)} soldiers sent into this land against ${against}`,
        why: [
          `${count(o.soldiers)} sent in year ${o.since}`,
          ...(o.fallen >= 1 ? [`${count(Math.round(o.fallen))} of them dead since`] : []),
          ...(o.displaced >= 1
            ? [`${count(Math.round(o.displaced))} people driven from their homes`]
            : []),
        ].join("; "),
        who,
        where: "square",
      });
      break;
    }
  }

  // —— What its realm bars, sold in a back lane: only where a bar stands (not a tax), the ware crosses unseen, and, of what
  // calms, wakes and eases, the land's people take it. ——
  if (r && streets) {
    const row = moneyStore(world, INTOX_STORE)?.get(s.cell),
      ware = contrabandOf(world, r.ref).find((w) => {
        const cause = CONTRA_CAUSES[w.cause];
        if (w.share < 0.1 || !cause || cause === "tariff" || cause === "excise") return false;
        return w.ware >= WARE_INTOX && w.ware < WARE_ARMS
          ? (row?.[INTOX.use + (w.ware - WARE_INTOX)] ?? 0) > 0
          : true;
      });
    if (ware) {
      const cause = CONTRA_CAUSES[ware.cause]!,
        what = wareName(ware.ware),
        realm = realmName(r),
        barred =
          cause === "war"
            ? `which ${realm} forbids from its enemy`
            : cause === "sanction"
              ? `which ${realm} shuts out from a realm it fears`
              : cause === "licence"
                ? "which a house holds the only licence to sell"
                : cause === "harm"
                  ? `which ${realm} bars to its people`
                  : `which ${realm} forbids`,
        cartel = rec?.groups.find((g) => kindOfGroup(g) === "cartel"),
        of = cartel
          ? { ref: groupRef(r.ref, cartel.event), name: groupWords(cartel.name, "cartel") }
          : { ref: `${r.ref}#underworld`, name: `the forbidden trade of ${realm}` },
        key = `${r.ref}|${town}|seller`,
        who = draw(key, s.population >= 20_000 ? 2 : 1, undefined, PART.seller),
        to = draw(`${key}|buy`, 2, undefined, PART.buys);
      if (who.length)
        goings.push({
          kind: "seller",
          key,
          of,
          words: `${cap(what)}, ${barred}, ${/s$/.test(what) ? "are" : "is"} sold in a back lane`,
          doing: `Selling ${what}, ${barred}${cartel ? `: carried in by ${of.name}` : ""}`,
          why: `${pct(ware.share)} of what ${realm} takes of it crosses its borders unseen`,
          who,
          to,
          toDoing: `Buying ${what}, ${barred}, in a back lane`,
          where: "lane",
        });
    }
  }

  return { goings, named: [...named.values()], outsiders, tried: [], past: [], heads, known };
}

/** What a town's feasts dance to: its realm's music as its culture is read (host/inspect/customs.ts; none: nothing kept). */
export function townCustoms(world: World, town: string): Pick<VillagePlan, "customs"> {
  const s = populationContext(world).settlements.get(town as Ref),
    r = s ? politiesOf(world).of(s.cell) : undefined,
    mu = r ? musicOf(world, r) : null;
  if (!r || !mu) return {};
  const played = mu.heard
    ? mu.instruments
        .slice(0, 2)
        .map((i) => i.what)
        .join(" and ")
    : mu.medium;
  if (!played) return {};
  return {
    customs: {
      music: `${played}, ${mu.feel}`,
      of: { ref: `${r.ref}#culture`, name: `the music of ${realmName(r)}` },
    },
  };
}

// —— What a page reads of it ——————————————————————————————————————————————————————————————————————————————

const KIND_ICON = GOING_ICON;

/** When each kind of thing is seen in a town's day, in words. */
const WHEN: Readonly<Record<TownGoing["kind"], string>> = {
  meeting: "of an evening, one day in seven",
  alms: "at noon, one day in seven",
  collect: "of a morning, on its market's days",
  corner: "from mid-afternoon until dark, every day",
  seller: "at dusk, every day",
  posted: "day and night",
  guard: "from dawn until late, every day",
  patrol: "through the day, every day",
};

/** "What is going on here": each thing a line, whose it is linked, one of its people to go to (null: nothing). */
export function townGoingsBlock(world: World, town: string): Block | null {
  const life = townLifeOf(world, town);
  if (!life.goings.length && !life.tried.length) return null;
  const names = new Map([
      ...[...life.named, ...life.outsiders].map((p) => [p.ref, p.name] as const),
      ...life.known,
    ]),
    items: Item[] = life.goings.map((g) => {
      const first = g.who.find((ref) => names.has(ref));
      return toWho(
        item(
          [
            `${KIND_ICON[g.kind]} `,
            link(g.words, g.of.ref),
            `, ${WHEN[g.kind]}: ${g.why}.`,
            ...(first
              ? [
                  " Go to ",
                  link(names.get(first)!.replace(/^A /, "a "), first),
                  g.kind === "posted" ? ", one of them." : ", who is of it.",
                ]
              : []),
            ...(g.before ? [" Before: ", link(g.before.name, g.before.ref), "."] : []),
          ],
          g.of.ref,
        ),
        first,
      );
    });
  const year = yearNow(world);
  for (const { c } of life.tried)
    if (c.year === year && world.now < c.day * 86400 + 14 * 3600)
      items.push(
        item(
          [
            "⚖️ ",
            link(cap(c.accused.name), c.accused.ref),
            ", not of the town, is to stand before its court: ",
            link("the case", c.ref),
            ".",
          ],
          c.ref,
        ),
      );
  return items.length ? { type: "list", title: "Going on here", items } : null;
}

/** What one of a town's lines is part of, for their own page (none: nothing). */
export function partOfStats(world: World, town: string, ref: string): Stat[] {
  const out: Stat[] = [],
    life = townLifeOf(world, town),
    year = yearNow(world);
  // One the court holds: who they were for it, what came of them, until when; the case a press away.
  for (const p of life.past) {
    if (p.ref !== ref) continue;
    const c = p.case,
      until = Math.floor((c.day + c.days) / 365);
    out.push(
      stat("Was", [
        link(cap(p.going.of.name), p.going.of.ref),
        `: ${ROLE_NAME[p.going.kind]} here until year ${c.year}. `,
        link(`${sentenceOf(c.accused.name.split(" ")[0]!)} ${c.came}`, c.ref),
        c.sentence === "banish"
          ? `: gone from ${populationContext(world).settlements.get(town as Ref)?.name ?? "the town"}, alive, and not to come back before year ${until}`
          : until > year
            ? `: not at it again before year ${until}`
            : "",
        ".",
      ]),
    );
  }
  for (const g of life.goings) {
    const mine = g.who.includes(ref),
      theirs = !mine && !!g.to?.includes(ref);
    if (!mine && !theirs) continue;
    // (One let go by the court, or back from what it laid on them: at it again, and it is said.)
    const c = mine ? lastCaseOf(world, town, ref) : null;
    out.push(
      stat(mine ? "Part of" : g.kind === "alms" ? "Given by" : "Pays", [
        link(cap(g.of.name), g.of.ref),
        `: ${(mine ? (g.quiet ?? g.doing) : (g.toDoing ?? g.doing)).replace(/^./, (x) => x.toLowerCase())}${g.quiet && mine ? "" : `, ${WHEN[g.kind]}`}${mine && g.took?.[ref] ? `; ${g.took[ref]}` : ""}${g.since !== undefined ? `. It has stood since year ${g.since}` : ""}`,
        ...(c
          ? [
              `. Brought before the court in year ${c.year}: `,
              link(`${c.accused.name.split(" ")[0]} ${c.came}`, c.ref),
              ", and is at it again",
            ]
          : []),
      ]),
    );
  }
  return out;
}

/** What was read of a world's towns let go (a test that sets a land's rows by hand reads them afresh). */
export function forgetTownLife(world: World): void {
  KEPT.delete(world);
  ROLES.delete(world);
}

/** The most lands of a group read for its people in their towns, and the most towns of each. */
const HERE = { lands: 3, towns: 1 } as const;

/**
 * "Its people here": those of a group, a head's house or a land's underworld who are someone in a town, each by name with what
 * they are at for it: their page is a press away, and from it Go to, Follow and Pin. From the same reading the towns are drawn of.
 */
export function peopleHereBlock(world: World, ref: string): Block | null {
  const ctx = populationContext(world),
    m = /^(mob|org|boss):(pol:\d+:\d+):(ev:\d+:\d+)$/.exec(ref),
    cellAt = /^cell:\d+:(\d+)$/.exec(ref),
    realm = m ? politiesOf(world).get(m[2] as Ref) : undefined;
  let cells: number[] = [];
  if (cellAt) cells = [Number(cellAt[1])];
  else if (m && realm) {
    const g =
      m[1] === "org"
        ? orgsOf(world)
            ?.of(realm.ref)
            ?.orgs.find((x) => x.event === m[3])
        : underworldOf(world)
            ?.of(realm.ref)
            ?.groups.find((x) => x.event === m[3]);
    if (!g) return null;
    // (A crew of enforcers holds no land of its own: it works its realm's, its seat's first.)
    cells = [...new Set([g.home, ...g.lands, realm.seat])].slice(0, HERE.lands);
  } else return null;
  const mine = (of: string) =>
      cellAt
        ? /^(mob|gfed|boss|uop):|#underworld$/.test(of)
        : of === ref ||
          (m && of === `boss:${m[2]}:${m[3]}`) ||
          (m?.[1] === "boss" && of === `mob:${m[2]}:${m[3]}`),
    items: Item[] = [];
  for (const cell of cells) {
    const towns = ctx.settlements
      .inProvince(cell)
      .filter((t) => t.population > 0)
      .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))
      .slice(0, HERE.towns);
    for (const t of towns) {
      const life = townLifeOf(world, t.ref),
        names = new Map([...life.named.map((p) => [p.ref, p.name] as const), ...life.known]);
      // (Its head first, where they live there: one of the town's key figures, gone to and followed from their page.)
      for (const h of life.heads)
        if (
          (m && h.ref === `boss:${m[2]}:${m[3]}`) ||
          (cellAt &&
            !!underworldOf(world)
              ?.of(h.ref.split(":").slice(1, 4).join(":") as Ref)
              ?.groups.some((x) => h.ref.endsWith(x.event)))
        )
          items.push(
            toWho(
              item(
                [
                  link(h.name, h.ref),
                  ` of ${t.name}: ${h.title.replace(/^Head/, "head")}, at their own house.`,
                ],
                h.ref,
              ),
              h.ref,
            ),
          );
      for (const g of life.goings) {
        if (!mine(g.of.ref)) continue;
        for (const who of g.who) {
          const name = names.get(who);
          if (!name || items.length >= 24) continue;
          items.push(
            toWho(
              item(
                [
                  link(name, who),
                  ` of ${t.name}: ${(g.quiet ?? g.doing).replace(/^./, (c) => c.toLowerCase())}`,
                  ...(cellAt ? [" (", link(g.of.name, g.of.ref), ")"] : []),
                  ".",
                ],
                who,
              ),
              who,
            ),
          );
        }
      }
    }
  }
  return items.length
    ? {
        type: "list",
        title: "Its people here",
        items,
      }
    : null;
}

/** A group's, a head's or a land's page with its people in their towns (none: as it was). */
export function withPeopleHere<
  P extends { tabs: readonly { id: string; blocks: readonly Block[] }[] },
>(world: World, ref: string, page: P): P {
  if (!/^(mob|org|boss|cell):/.test(ref)) return page;
  const block = peopleHereBlock(world, ref.replace(/#.*$/, ""));
  if (!block) return page;
  const tab = ref.startsWith("cell:") ? page.tabs.findIndex((t) => t.id === "underworld") : 0;
  if (tab < 0 || !page.tabs[tab]) return page;
  return {
    ...page,
    tabs: page.tabs.map((t, i) => (i === tab ? { ...t, blocks: [...t.blocks, block] } : t)),
  } as P;
}

/**
 * Those of a fight's town who are of the two that fought, as the town's days have them now: each by name with what they are
 * for their side, their page a press away (null: none of either is someone there, or it was fought more than a year ago, when
 * who is of them now says nothing of who was). Who fell is counted by history and is not told of them: one of a town's lines
 * dies as its roster has them.
 */
export function fightPeopleBlock(
  world: World,
  fight: {
    readonly town: string;
    readonly year: number;
    readonly sides: readonly { readonly ref: string; readonly name: string }[];
  },
): Block | null {
  // (Those of the town's lines its year's killings took who were of either side or killed by one: the same its roster and
  // their own pages tell, host/roster.ts. Of a year gone by: a year's own dead are counted from the next.)
  const fell = fightFallen(world, fight);
  if (fell.length)
    return {
      type: "list",
      title: "Of the town, killed in it",
      items: fell.map((m) =>
        item(
          [
            link(m.name, m.ref),
            `, ${m.age}: killed ${m.words}${m.role ? `; ${m.role.replace(/\bits\b/, "their")}` : ", one of the town's many"}.`,
          ],
          m.ref,
        ),
      ),
    };
  if (yearNow(world) - fight.year > 1) return null;
  const roles = townRolesOf(world, fight.town),
    names = new Map(roles.named.map((p) => [p.ref, p.name] as const)),
    items: Item[] = [];
  for (const side of fight.sides) {
    const head = side.ref.replace(/^mob:/, "boss:");
    for (const g of roles.goings) {
      if (g.of.ref !== side.ref && g.of.ref !== head) continue;
      for (const who of g.who) {
        const name = names.get(who);
        if (name)
          items.push(
            toWho(
              item(
                [
                  link(name, who),
                  `, of ${side.name.replace(/^The /, "the ")}: ${ROLE_NAME[g.kind].replace(/\bits\b/, "their")} in the town`,
                ],
                who,
              ),
              who,
            ),
          );
      }
    }
  }
  return items.length ? { type: "list", title: "Of the town, on either side", items } : null;
}

/**
 * Those of a fight's town its land's underworld killed in the fight's year who were of either side, or killed by one (their
 * names, pages, ages and what the killing was of): none for the year the world stands in.
 */
export function fightFallen(
  world: World,
  fight: {
    readonly town: string;
    readonly year: number;
    readonly sides: readonly { readonly ref: string; readonly name: string }[];
  },
): { ref: string; name: string; age: number; words: string; role: string | null }[] {
  if (fight.year >= yearNow(world)) return [];
  const roster = townRoster(world, fight.town),
    refs = new Set(fight.sides.flatMap((s) => [s.ref, s.ref.replace(/^mob:/, "boss:")]));
  return (roster.killings.find((k) => k.year === fight.year)?.men ?? [])
    .filter(
      (m) => (m.slain.of && refs.has(m.slain.of.ref)) || (m.slain.by && refs.has(m.slain.by.ref)),
    )
    .map((m) => ({
      ref: m.holder.ref,
      name: roster.nameOf(m.holder),
      age: fight.year - m.holder.born,
      words: m.slain.words,
      role: m.slain.role,
    }));
}

/** A town's soldiers posted, as its plan carries them: their realm's colour and the arm its host is fielded with (none: none posted). */
export function townPosted(world: World, town: string): Pick<VillagePlan, "posted"> {
  if (!townRolesOf(world, town).goings.some((g) => g.kind === "posted")) return {};
  const s = populationContext(world).settlements.get(town as Ref),
    r = s ? politiesOf(world).of(s.cell) : undefined;
  if (!r) return {};
  const c = realmColor(r.ref);
  return { posted: { color: [c[0], c[1], c[2]], arm: hostKinds(world, r.ref)?.arm ?? "" } };
}

/** One of the tray's lines for what one lived is for a group of their town: told at a press; with `part`, hours spent on it. */
export type RoleOffer = {
  what: "role";
  target: number;
  icon: string;
  label: string;
  can: boolean;
  words: string;
  /** What a press spends hours on (the command `life.part`'s own; absent: it only tells). */
  part?: {
    what: PartId;
    of: string;
    name: string;
    n: number;
    case?: string;
    sentence?: string;
    form?: string;
    accused?: string;
  };
};

/** What each part is, before it is played: who it touches, what it brings, what it risks. */
const PART_SAYS: Readonly<Record<Exclude<PartId, "judge">, (name: string, n: number) => string>> = {
  rounds: (name, n) =>
    `Make the rounds for ${name}: ${many(n, "pays", "pay")} here to be left to trade. What they give is ${name}'s, three parts in ten yours to keep. Some will be short.`,
  watch: (name) =>
    `Hold the corner for ${name} until dark: see who comes, and give warning in time.`,
  sell: (name, n) =>
    `Sell what the realm bars in the back lane: about ${n} come for it. Four parts in ten are yours; the rest is theirs who carry it in (${name}).`,
  lielow: () => "Keep out of sight for some hours: nothing earned, nothing risked.",
  door: (name) => `Hold the door of the house ${name} is headed from: paid by the house.`,
  receive: (name) =>
    `Receive those who come to your house with what they owe or ask of ${name}: coin to you, and you are seen.`,
  settle: (name) =>
    `Hear two of ${name}'s own who are at odds, and say how it will be: it holds together the better, if both take it.`,
  send: (name, n) =>
    `Send your collector round for ${name}: ${many(n, "pays", "pay")} here. Seven parts in ten come to the house.`,
  answer: (name) =>
    `Answer the group ${name} is at war with, in this town: its ground or yours, your standing with your own on it.`,
  paywatch: (name) =>
    `Pay the watch to look elsewhere when ${name}'s people are about, for thirty days.`,
  patrol: (name) => `Walk the round of the streets with ${name}: the realm's pay for the hours.`,
  lead: (name, n) => `Lead the meeting of ${name}: about ${n} come.`,
  attend: (name) => `Go to the meeting of ${name}, among its own.`,
  alms: (name, n) =>
    `Give out bread for ${name} to ${n} of its own in need: a little of your own coin beside what it pools.`,
  lend: (name, n) =>
    `Hear the ${n} who come to borrow from ${name}, and lend to one of them from the house's chest: a little for the day's dealing is yours.`,
  callin: (name) =>
    `Call in what one who owes ${name} is behind with: they may have it, or not. The town does not love it.`,
  forgive: (name) =>
    `Forgive one who owes ${name} what they cannot pay: the town speaks well of it, the house's family does not.`,
  refuse: (name, n) =>
    `Turn away the ${n} who come to borrow from ${name}: nothing risked, nothing earned.`,
};

/**
 * What one lived is for the groups of their town, for the tray of a life: what a collector, a lookout, a seller, a guard, a
 * head, an officer of a crew, a member, a giver and the court's judge can spend hours on (rules/part.ts), each offered only to
 * the one who is that for the thing, and saying what it is, for whom, what it brings and what it risks. One the court holds
 * plays no part until it lets them go.
 */
export function roleOffers(
  world: World,
  town: string,
  ref: string,
  /** The name they are known by: one the hand was laid from who heads a group or holds an office is that one, by it. */
  name?: string,
): RoleOffer[] {
  const life = townLifeOf(world, town),
    out: RoleOffer[] = [],
    held = life.past.find((p) => p.ref === ref),
    soldiers = life.goings.some((g) => g.kind === "posted"),
    risk = soldiers ? " Soldiers are posted in the streets: what you carry may be taken." : "",
    add = (
      id: Exclude<PartId, "judge">,
      of: { ref: string; name: string },
      n: number,
      more = "",
      can = true,
    ) =>
      out.push({
        what: "role",
        target: -1,
        icon: LIFE_PARTS[id].icon,
        label: LIFE_PARTS[id].label,
        can: can && !held,
        words: `${PART_SAYS[id](of.name, n)}${more}`,
        part: { what: id, of: of.ref, name: of.name, n },
      });
  for (const h of life.heads) {
    if (h.name !== name) continue;
    const guarded = life.goings.find((g) => g.to?.includes(h.ref)),
      leads = life.goings.find((g) => g.who[0] === h.ref),
      group = h.title.replace(/^Head of /, "").replace(/, of .*$/, ""),
      of = { ref: h.ref, name: group };
    out.push({
      what: "role",
      target: -1,
      icon: "🕴️",
      label: "Your house",
      can: true,
      words: `You are ${h.title.replace(/^Head/, "head")}. ${h.did}${guarded ? " Your house is guarded from dawn until late, and those who collect for you bring what they take to its door." : ""}${leads ? ` You lead what it holds here: ${leads.words.replace(/^./, (c) => c.toLowerCase())}, ${WHEN[leads.kind]}.` : ""}`,
    });
    if (leads) add("lead", leads.of, Math.max(1, leads.who.length - 1));
    // (A head outside the law: what their house is headed for.)
    const at = groupOfBoss(world, h.ref);
    if (at?.kind !== "under") continue;
    const collect = life.goings.find(
        (g) => g.kind === "collect" && g.of.ref === groupRef(at.realm, at.g.event),
      ),
      war = /at war with/.test(collect?.why ?? "") || /at war with/.test(guarded?.why ?? "");
    add("receive", of, 3);
    add("settle", of, 2);
    if (collect) add("send", of, collect.to?.length ?? 2, risk, !collect.quiet);
    add(
      "answer",
      of,
      1,
      war ? "" : ` ${cap(group)} is at war with no one now.`,
      !!at.g && underAtWar(world, at.realm, at.g.id),
    );
    add("paywatch", of, 1);
    if (soldiers) add("lielow", of, 1);
  }
  for (const g of life.goings) {
    if (!g.who.includes(ref)) continue;
    const quiet = g.quiet ? ` ${g.quiet}.` : "",
      why = ` ${cap(g.why)}.`;
    switch (g.kind) {
      case "collect":
        add("rounds", g.of, g.to?.length ?? 2, `${why}${risk}${quiet}`, !g.quiet);
        add("lielow", g.of, 1);
        break;
      case "corner":
        add("watch", g.of, g.who.length, `${why}${quiet}`, !g.quiet);
        break;
      case "seller":
        add("sell", g.of, Math.max(2, g.to?.length ?? 2), `${why}${risk}`);
        add("lielow", g.of, 1);
        break;
      case "guard":
        add("door", g.of, 1, why);
        break;
      case "patrol":
        add("patrol", g.of, 3, why);
        break;
      case "alms":
        add("alms", g.of, g.to?.length ?? 3, why);
        break;
      case "meeting":
        add("attend", g.of, Math.max(1, g.who.length - 1), why);
        break;
      default:
        break;
    }
  }
  // The court's judge: the next small wrong to be heard this year, and what the court's form lets them lay on it.
  const judge = notablesIn(world, town).find((n) => n.kind === "judge" && n.name === name),
    s = judge ? populationContext(world).settlements.get(town as Ref) : undefined,
    form = s ? courtFormOf(world, s) : null,
    year = yearNow(world),
    next =
      judge && form && JUDGE_SENTENCES[form]
        ? [...casesOf(world, town, year)]
            .filter((c) => !c.grave && c.day * 86400 > world.now && !ruledCase(world, c.ref))
            .sort((a, b) => a.day - b.day)[0]
        : undefined;
  if (judge && form && next)
    for (const sentence of JUDGE_SENTENCES[form]!)
      out.push({
        what: "role",
        target: -1,
        icon: LIFE_PARTS.judge.icon,
        label: JUDGED[sentence]!.label,
        can: true,
        words: `Hear the case of ${next.accused.name}, who ${next.whatWords}, to be heard on day ${next.day - year * 365} of the year: ${JUDGED[sentence]!.label.replace(/^./, (c) => c.toLowerCase())}. The court's book will read as you rule.`,
        part: {
          what: "judge",
          of: judge.ref,
          name: judge.of.name,
          n: 1,
          case: next.ref,
          sentence,
          form,
          accused: next.accused.name,
        },
      });
  else if (judge)
    out.push({
      what: "role",
      target: -1,
      icon: LIFE_PARTS.judge.icon,
      label: "Your bench",
      can: true,
      words: `You are ${judge.title.replace(/^./, (c) => c.toLowerCase())}. No small wrong waits to be heard before the year is out.`,
    });
  // The head of the town's house of lending: at its table, with those who come to borrow and those who owe.
  const house = creditOf(world)?.houseIn(town),
    lender = house && house.failed === null ? seatHolder(world, town, "lender", 0) : null;
  if (house && lender && lender.name === name) {
    const credit = creditOf(world)!,
      loans = credit.open().filter((l) => l.house === house.ref),
      out_ = credit.outstanding(house.ref),
      s = populationContext(world).settlements.get(town as Ref),
      askers = Math.max(1, Math.min(8, Math.round(Math.log10(Math.max(10, s?.population ?? 10))))),
      owing = Math.max(1, Math.min(8, loans.length)),
      of = { ref: house.ref, name: house.name.replace(/^The /, "the ") };
    out.push({
      what: "role",
      target: -1,
      icon: "🏦",
      label: "Your house",
      can: true,
      words: `You head ${of.name}, lending since year ${house.year}. It holds ${worthWords(house.capital)} grain's worth of its own, ${loans.length ? `and ${worthWords(out_)} is out to ${loans.length === 1 ? "one who owes" : `${loans.length} who owe`} it` : "and nothing is out: no one owes it now"}.`,
    });
    const none = loans.length ? "" : " No one owes it now.";
    add("lend", of, askers, "", house.capital > 0);
    add("refuse", of, askers);
    add("callin", of, owing, none, loans.length > 0);
    add("forgive", of, owing, none, loans.length > 0);
  }
  if (held)
    out.push({
      what: "role",
      target: -1,
      icon: "⚖️",
      label: "The court",
      can: true,
      words: `You were ${ROLE_NAME[held.going.kind].replace(/\bits\b/, "the")} for ${held.going.of.name} until year ${held.case.year}: you ${held.case.came.replace(/^was /, "were ")}. You play no part for it until the court lets you go.`,
    });
  return out;
}

/** Whether a group outside the law is at war with another now. */
function underAtWar(world: World, realm: string, id: number): boolean {
  return !!underworldOf(world)
    ?.of(realm as Ref)
    ?.wars.some((x) => x.ended === null && (x.a === id || x.b === id));
}
const ROLE_LABEL: Readonly<Record<TownGoing["kind"], string>> = {
  collect: "Your rounds",
  seller: "Your lane",
  guard: "Your door",
  patrol: "Your round",
  corner: "Your corner",
  meeting: "Your meeting",
  alms: "Your giving",
  posted: "Your post",
};

/**
 * What the court holds one of a town to now, for the people bar's chip and their page's "Doing": in the cell or at its works
 * until when, sent out of the realm or away from the town; the case that did it (null: nothing holds them).
 */
export function heldReading(
  world: World,
  town: string,
  ref: string,
): { readonly short: string; readonly words: string; readonly case: string } | null {
  const c = heldCaseOf(world, town, ref);
  if (!c) return null;
  const until = Math.floor((c.day + c.days) / 365),
    lasts = until > yearNow(world) ? ` until ${until}` : "",
    short =
      c.sentence === "banish"
        ? c.outcome === "exile"
          ? "sent out of the realm"
          : "sent away"
        : c.sentence === "labour"
          ? `at the works${lasts}`
          : c.sentence === "stocks"
            ? "in the stocks"
            : `in the cell${lasts}`;
  return {
    short,
    words: `${sentenceOf(c.accused.name.split(" ")[0]!)} ${c.came}, in year ${c.year}: ${short}${c.sentence === "banish" ? ", alive" : ""}.`,
    case: c.ref,
  };
}
