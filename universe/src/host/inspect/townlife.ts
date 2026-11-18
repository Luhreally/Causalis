// What is going on in a town that belongs to something larger its land's kept state holds: a group that meets, a society that
// gives, a family that takes payment from those who trade, a street's gangs keeping a corner, what its realm bars sold in a back
// lane, soldiers posted in its streets, a head's house guarded, and one not of the town brought before its court. Every one is read
// from the rows the world keeps for the town's land and year (sim/order/underworld-kept.ts, groups-kept.ts, sim/money), and is not
// there where they hold nothing: a quiet village has none. Who of the town is in each is drawn from the town's own lines by a key
// of the thing itself, so the same people are in it year on year, and one going more or less moves no one else. Pure reads: nothing
// here flows back into the world. Words say what, who, at what cost and with what effect; never how.
import { hashString, type Ref, type World } from "../../kernel/index.ts";
import {
  CONTRA_CAUSES,
  GROUP_KINDS,
  OCC,
  WARE_ARMS,
  WARE_INTOX,
  wareName,
} from "../../rules/index.ts";
import {
  GANG_ROW,
  INTOX,
  INTOX_STORE,
  contrabandOf,
  gangsStore,
  groupsIn,
  kindName,
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
  type Org,
  type Polity,
  type Settlement,
} from "../../sim/index.ts";
import { groupWords, orgWords } from "../../causal/index.ts";
import {
  GOING_ICON,
  type Block,
  type Item,
  type Stat,
  type TownGoing,
  type VillagePlan,
} from "../../bridge/index.ts";
import { fedRef, groupRef, opRef } from "../underworld.ts";
import { orgRef } from "../groups.ts";
import { folkWork, workOf } from "../roster.ts";
import { casesOf, folkOf, type Case, type Party } from "./justice.ts";
import { musicOf } from "./customs.ts";
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
};

const NONE: TownLife = { goings: [], named: [], outsiders: [], tried: [] };
const KEPT = new WeakMap<World, { now: number; by: Map<string, TownLife> }>();

/** A town's life as its land's rows have it this year (kept while the world's moment stands). */
export function townLifeOf(world: World, town: string, year = yearNow(world)): TownLife {
  let kept = KEPT.get(world);
  if (!kept || kept.now !== world.now) KEPT.set(world, (kept = { now: world.now, by: new Map() }));
  const key = `${town}|${year}`,
    hit = kept.by.get(key);
  if (hit) return hit;
  const read = readLife(world, town, year);
  kept.by.set(key, read);
  return read;
}

function readLife(world: World, town: string, year: number): TownLife {
  const s = populationContext(world).settlements.get(town as Ref);
  if (!s || s.population <= 0) return NONE;
  const r = politiesOf(world).of(s.cell),
    rank = rankIn(world, s, year),
    folk = folkOf(world, s, year),
    work = folkWork(world, s.cell),
    grown = lifeOf(world).adulthood,
    goings: TownGoing[] = [],
    named = new Map<string, Party>(),
    outsiders: (VillagePlan["people"][number] & { page: string })[] = [];
  /** So many of the town's own by a thing's key: the same lines each year, whoever else is drawn for another. */
  const draw = (
    key: string,
    n: number,
    weigh?: (key: number, born: number) => number,
    not: Set<string> = new Set(),
  ): string[] => {
    const h = hashString(key) >>> 0,
      out: string[] = [];
    for (let k = 0; k < n; k++) {
      const p = folk.pick(h, k * 64, not, weigh);
      if (!p) continue;
      not.add(p.ref);
      named.set(p.ref, p);
      out.push(p.ref);
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
        const to = draw(`${key}|given`, LIFE_MOST.given, old, new Set(who));
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
      goings.push({
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
        who,
        where: how.where,
        ...(how.closed ? { closed: true as const } : {}),
      });
    }
  }

  // —— Its underworld: only in its land's few greatest towns, and only what its land's row holds. ——
  const under = groupsIn(world, s.cell),
    rec = r ? underworldOf(world)?.of(r.ref) : undefined,
    streets = rank < UNDER_TOWNS && s.population >= UNDER_LEAST;
  if (r && rec && under && streets) {
    const holder = under.group !== null ? rec.groups.find((g) => g.id === under.group) : undefined;
    // A family that takes payment from those who trade.
    if (holder && kindOfGroup(holder) === "protection" && under.protection >= 0.03) {
      const name = groupWords(holder.name, "protection"),
        ref = groupRef(r.ref, holder.event),
        key = `${ref}|${town}|collect`,
        who = draw(key, s.population >= 20_000 ? 2 : 1),
        to = draw(
          `${key}|pay`,
          Math.min(LIFE_MOST.payers, Math.max(2, Math.round(under.protection * 20))),
          trading,
          new Set(who),
        );
      if (who.length && to.length)
        goings.push({
          kind: "collect",
          key,
          of: { ref, name },
          words: `${cap(name)} takes payment from those who trade here`,
          doing: `Collecting for ${name}, from those who pay it to be left to trade`,
          why: `${pct(under.protection)} of this land's trade is under its protection, and its hold here is ${pct(under.control)}`,
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
          who = draw(key, g.members >= 30 ? LIFE_MOST.guards : 1, young);
        if (!who.length) continue;
        houses++;
        goings.push({
          kind: "guard",
          key,
          of: { ref, name: `${g.boss.name}, who heads ${name}` },
          words: `${g.boss.name}, who heads ${name}, keeps a house here, and it is guarded`,
          doing: `Guarding the house of ${g.boss.name}, who heads ${name}`,
          why: `${name} has ${count(g.members)} men, and this is its home land`,
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
        );
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
          who,
          where: "corner",
        });
    }
    // Soldiers sent into its land against a group, posted in its streets.
    for (const o of rec.ops ?? []) {
      if (o.ended !== null || !o.lands.includes(s.cell)) continue;
      const here = soldiersIn(world, r.ref as Ref, s.cell),
        n = Math.min(LIFE_MOST.soldiers, Math.max(2, Math.round(here / 150))),
        against = groupWords(o.name, GROUP_KINDS[o.kind]),
        page = opRef(r.ref, o.event),
        who: string[] = [];
      for (let k = 0; k < n; k++) {
        const ref = `out:${page}:${k}`;
        who.push(ref);
        outsiders.push({
          ref,
          page,
          name: `A soldier of ${realmName(r)}`,
          role: `a soldier of ${realmName(r)}, not of ${s.name}: posted here against ${against}`,
          home: 0,
          age: 20 + ((hashString(ref) >>> 0) % 14),
          occupation: OCC.dependent,
          child: false,
          sex: 1,
          folk: true,
          outsider: true,
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
        who = draw(key, s.population >= 20_000 ? 2 : 1),
        to = draw(`${key}|buy`, 2, undefined, new Set(who));
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
  return { goings, named: [...named.values()], outsiders, tried };
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
};

/** "What is going on here": each thing a line, whose it is linked, one of its people to go to (null: nothing). */
export function townGoingsBlock(world: World, town: string): Block | null {
  const life = townLifeOf(world, town);
  if (!life.goings.length && !life.tried.length) return null;
  const names = new Map(life.named.map((p) => [p.ref, p.name] as const)),
    items: Item[] = life.goings.map((g) => {
      const first = g.who.find((ref) => names.has(ref));
      return item(
        [
          `${KIND_ICON[g.kind]} `,
          link(g.words, g.of.ref),
          `, ${WHEN[g.kind]}: ${g.why}.`,
          ...(first ? [" Go to ", link(names.get(first)!, first), ", who is of it."] : []),
        ],
        g.of.ref,
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
  const out: Stat[] = [];
  for (const g of townLifeOf(world, town).goings) {
    const mine = g.who.includes(ref),
      theirs = !mine && !!g.to?.includes(ref);
    if (!mine && !theirs) continue;
    out.push(
      stat(mine ? "Part of" : g.kind === "alms" ? "Given by" : "Pays", [
        link(cap(g.of.name), g.of.ref),
        `: ${(mine ? g.doing : (g.toDoing ?? g.doing)).replace(/^./, (c) => c.toLowerCase())}, ${WHEN[g.kind]}`,
      ]),
    );
  }
  return out;
}

/** What was read of a world's towns let go (a test that sets a land's rows by hand reads them afresh). */
export function forgetTownLife(world: World): void {
  KEPT.delete(world);
}
