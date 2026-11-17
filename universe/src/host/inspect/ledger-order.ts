// The ledger's tables of who holds power outside the seat (asked 2026-11-16: "add the underworld to ledger"): the Underworld tab
// (every crime group of every realm — its kind, boss, lands, men, wealth, rackets and killing, and what its realm's state does —
// each realm's smuggling, forbidden trade organised, addiction and street, the wars between the groups and the street's
// federations), the Groups tab (every group of the general layer: brigands, pirates, militias, sects, parties, refuges, learned
// societies; its kind, aims, members, hold, standing and what it takes and gives) and the Houses tab (every great house, its power,
// wealth, offices, title and generations, and the houses whose hold ended). Pure reads of the order's stores (sim/order/
// underworld-kept.ts, groups-kept.ts, houses.ts) and Round B's rows, one pass over each a page build; no walk of the history.
// Who, what, cost and effect: never how any crime is done. Phone first: each table sorts by a tap, its greatest first.
import { worldCarryBlocks } from "./carriers.ts";
import type { Ref, World } from "../../kernel/index.ts";
import type { Block, Row, Span, Stat } from "../../bridge/index.ts";
import { GROUP_KINDS, ORG_AIMS, ORG_KINDS, ORG_STANDING, RACKETS } from "../../rules/index.ts";
import {
  BAR,
  BAR_STORE,
  INTOX,
  INTOX_STORE,
  ROOFLESS_STORE,
  ROOF_ROW,
  SMUGGLE,
  SMUGGLE_STORE,
  housesOf,
  kindName,
  kindOfGroup,
  moneyStore,
  orgsOf,
  originOf,
  societyStore,
  underworldOf,
  type CrimeGroup,
  type Federation,
  type GangWar,
  type GoneGroup,
  type GoneOrg,
  type HouseRecord,
  type Org,
  type OrgFed,
  type RealmHouses,
  type GoneHouse,
  type Polity,
} from "../../sim/index.ts";
import { grainSum, groupWords, orgWords } from "../../causal/index.ts";
import { fedRef, groupRef, opRef } from "../underworld.ts";
import { orgFedRef, orgRef } from "../groups.ts";
import { houseRef, roseBy } from "../family.ts";
import { AIM_WORDS } from "./groups.ts";
import { count, link, many, part, share, stat } from "./words.ts";
import {
  LEDGER_ROWS,
  allTold,
  honest,
  listedOf,
  mostLeast,
  mostLeastBlock,
  per,
  realmMean,
  standingRealm,
  type LedgerCtx,
  type Ranked,
} from "./ledger-kit.ts";

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s),
  grain = (n: number) => grainSum(Math.max(0, Math.round(n))),
  killed = (n: number) => (n >= 1 ? count(Math.round(n)) : n > 0 ? "few" : "none"),
  byRef = (a: { ref: string }, b: { ref: string }) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0);

/** A realm by its seat's name alone (its column says what it is). */
const realmCell = (r: Polity): Span => link(r.town, r.ref);

// —— The Underworld ——————————————————————————————————————————————————————————————————————————————————————

/** A crime group's kind, in a word or two. */
function crimeKind(g: CrimeGroup): string {
  if (g.squad) return "death squad";
  const k = kindOfGroup(g);
  return k === "cartel" ? "cartel" : k === "badge" ? "badge crew" : "family";
}

/** What a group lives on, in short words. */
const RACKET_SHORT: Readonly<Record<(typeof RACKETS)[number], string>> = {
  protection: "protection",
  smuggling: "smuggling",
  extortion: "extortion",
  kidnapping: "ransom",
  theft: "theft",
  shakedown: "seizures kept",
  killing: "killing",
};
const racketsShort = (bits: number): string =>
  RACKETS.filter((_, i) => bits & (1 << i))
    .map((r) => RACKET_SHORT[r])
    .join(", ") || "—";

/** What a realm's state does about its underworld, in a few words. */
function stanceOf(v: { crackdown: number; collusion: number }): string {
  if (v.crackdown >= 50) return `crackdown ${per(v.crackdown)}`;
  if (v.collusion >= 50) return `bought ${per(v.collusion)}`;
  return "lets be";
}

/** The Underworld tab: every crime group, each realm under the law, the wars between groups and the street's federations. */
export function underworldLedger(world: World, lc: LedgerCtx): Block[] {
  const under = underworldOf(world),
    smuggle = moneyStore(world, SMUGGLE_STORE),
    bars = moneyStore(world, BAR_STORE),
    intox = moneyStore(world, INTOX_STORE),
    roof = societyStore(world, ROOFLESS_STORE);
  type GroupAt = { r: Polity; g: CrimeGroup };
  const groups: GroupAt[] = [],
    wars: { r: Polity; w: GangWar }[] = [],
    feds: { r: Polity; f: Federation }[] = [],
    ended: { r: Polity; g: GoneGroup }[] = [],
    realmRows: Row[] = [],
    smuggled: Ranked[] = [],
    addicted: Ranked[] = [],
    killing: Ranked[] = [];
  let menAll = 0,
    wealthAll = 0,
    killedAll = 0,
    fought = 0;
  for (const r of lc.standing) {
    const v = under?.of(r.ref),
      sm = smuggle?.get(r.ref),
      bar = bars?.get(r.ref),
      add = intox ? realmMean(lc, r, (c) => intox.get(c)?.[INTOX.dependent]) : null,
      street = roof ? realmMean(lc, r, (c) => roof.get(c)?.[ROOF_ROW.street]) : null;
    if (v) {
      for (const g of v.groups) {
        groups.push({ r, g });
        menAll += g.members;
        wealthAll += g.wealth;
      }
      for (const w of v.wars) {
        wars.push({ r, w });
        if (w.ended === null) fought++;
      }
      for (const f of v.feds) feds.push({ r, f });
      for (const g of v.gone) ended.push({ r, g });
    }
    if (!v && !sm && !bar) continue;
    const dead = v ? v.killings + v.street + v.badge : 0;
    killedAll += dead;
    const name = realmCell(r);
    if (sm) smuggled.push({ name, value: sm[SMUGGLE.share]!, said: per(sm[SMUGGLE.share]!) });
    if (add !== null) addicted.push({ name, value: add, said: per(add) });
    if (v) killing.push({ name, value: dead, said: `${killed(dead)} a year` });
    realmRows.push({
      ref: `${r.ref}#underworld`,
      cells: [
        [name],
        [count(v?.groups.length ?? 0)],
        [sm ? per(sm[SMUGGLE.share]!) : "—"],
        [bar ? per(bar[BAR.cartel]!) : "—"],
        [add !== null ? per(add) : "—"],
        [street !== null ? per(street) : "—"],
        [v && v.crackdown >= 50 ? per(v.crackdown) : "none"],
        [v ? per(v.collusion) : "—"],
        [v ? killed(dead) : "—"],
      ],
      keys: [
        r.town,
        v?.groups.length ?? 0,
        sm?.[SMUGGLE.share] ?? -1,
        bar?.[BAR.cartel] ?? -1,
        add ?? -1,
        street ?? -1,
        v?.crackdown ?? -1,
        v?.collusion ?? -1,
        dead,
      ],
    });
  }
  if (!groups.length && !feds.length && !realmRows.length && !ended.length)
    return honest("No crime group has formed in this world yet.");
  const blocks: Block[] = [];
  if (!groups.length && !feds.length)
    blocks.push(
      ...honest(
        ended.length
          ? "No crime group holds any part of this world now."
          : "No crime group has formed in this world yet.",
      ),
    );
  else {
    blocks.push(
      allTold([
        stat("Crime groups", count(groups.length), {
          parts: [
            part("street federations", count(feds.length)),
            part("realms they work in", count(new Set(groups.map((x) => x.r.ref)).size)),
          ],
        }),
        stat("Their men", count(menAll)),
        stat("Their wealth", `${grain(wealthAll)} grain's worth`),
        stat("Killed a year in the realms' lands", killed(killedAll)),
        stat("Wars between them still fought", count(fought)),
      ]),
    );
    groups.sort((a, b) => b.g.wealth - a.g.wealth || byRef(a.r, b.r) || a.g.id - b.g.id);
    const shown = groups.slice(0, LEDGER_ROWS);
    if (shown.length)
      blocks.push(
        {
          type: "table",
          title: "Every crime group",
          columns: [
            "Group",
            "Realm",
            "Kind",
            "Boss",
            "Lands",
            "Men",
            "Wealth",
            "Rackets",
            "Killed a year",
            "The state",
          ],
          rows: shown.map(({ r, g }) => {
            const v = under!.of(r.ref)!,
              ref = groupRef(r.ref, g.event),
              badge = kindOfGroup(g) === "badge",
              kind = crimeKind(g);
            return {
              ref,
              cells: [
                [link(cap(groupWords(g.name, kindOfGroup(g))), ref)],
                [realmCell(r)],
                [kind],
                [g.boss.name],
                [badge ? "its towns" : count(g.lands.length)],
                [count(g.members)],
                [grain(g.wealth)],
                [racketsShort(g.rackets)],
                [killed(g.violence)],
                [stanceOf(v)],
              ],
              keys: [
                g.name,
                r.town,
                kind,
                g.boss.name,
                badge ? 0 : g.lands.length,
                g.members,
                g.wealth,
                racketsShort(g.rackets),
                g.violence,
                v.crackdown - v.collusion,
              ],
            };
          }),
          filter: 2,
        },
        ...listedOf(shown.length, groups.length, "richest groups"),
      );
  }
  if (realmRows.length)
    blocks.push({
      type: "table",
      title: "Each realm under the law",
      columns: [
        "Realm",
        "Groups",
        "Smuggled",
        "Forbidden trade organised",
        "Addicted",
        "On the street",
        "Crackdown",
        "Officers bought",
        "Killed a year",
      ],
      rows: realmRows.slice(0, LEDGER_ROWS),
    });
  blocks.push(
    ...listedOf(Math.min(LEDGER_ROWS, realmRows.length), realmRows.length, "most peopled realms"),
  );
  blocks.push(
    ...mostLeastBlock([
      mostLeast("Most smuggled past its borders", smuggled),
      mostLeast("Most of its people addicted", addicted),
      mostLeast("Most killing under the law", killing),
    ]),
  );
  // (Each ware smuggled, and the groups across the world that take most of its rent: carriers.ts.)
  blocks.push(...worldCarryBlocks(world, lc.standing));
  if (wars.length) {
    wars.sort(
      (a, b) =>
        (a.w.ended === null ? 0 : 1) - (b.w.ended === null ? 0 : 1) ||
        b.w.since - a.w.since ||
        byRef(a.r, b.r),
    );
    const shown = wars.slice(0, 60);
    blocks.push(
      {
        type: "table",
        title: "Wars between groups",
        columns: ["War", "Realm", "Years", "Dead"],
        rows: shown.map(({ r, w }) => ({
          ref: w.event,
          cells: [
            [
              link(
                `${cap(groupWords(w.names[0], kindOfGroup(w)))} against ${groupWords(w.names[1], kindOfGroup(w))}`,
                w.event,
              ),
            ],
            [realmCell(r)],
            [w.ended !== null ? `${w.since}–${w.ended}` : `${w.since}, still fought`],
            [count(Math.round(w.fallen))],
          ],
          keys: [w.names[0], r.town, w.since, w.fallen],
        })),
        fit: true,
      },
      ...listedOf(shown.length, wars.length, "latest wars"),
    );
  }
  if (feds.length) {
    feds.sort((a, b) => b.f.members - a.f.members || byRef(a.r, b.r) || a.f.id - b.f.id);
    const shown = feds.slice(0, 60);
    blocks.push(
      {
        type: "table",
        title: "The street's federations",
        columns: ["Federation", "Realm", "Gangs", "Towns", "Young men"],
        rows: shown.map(({ r, f }) => {
          const ref = fedRef(r.ref, f.event);
          return {
            ref,
            cells: [
              [link(`the ${f.name} federation`, ref)],
              [realmCell(r)],
              [count(f.gangs)],
              [count(f.towns.length)],
              [count(f.members)],
            ],
            keys: [f.name, r.town, f.gangs, f.towns.length, f.members],
          };
        }),
        fit: true,
      },
      ...listedOf(shown.length, feds.length, "greatest federations"),
    );
  }
  // How the holds of those gone ended, the latest first (each realm keeps a few).
  if (ended.length) {
    ended.sort((a, b) => b.g.year - a.g.year || byRef(a.r, b.r));
    const shown = ended.slice(0, 40);
    blocks.push(
      {
        type: "table",
        title: "Groups whose hold ended",
        columns: ["Group", "Realm", "Years", "How"],
        rows: shown.map(({ r, g }) => {
          const ref = groupRef(r.ref, g.rose);
          return {
            ref,
            cells: [
              [link(cap(groupWords(g.name, kindOfGroup(g))), ref)],
              [realmCell(r)],
              [`${g.since}–${g.year}`],
              [
                `${GONE_HOW[g.how] ?? g.how}${g.into ? ` ${groupWords(g.into, kindOfGroup(g))}` : ""}`,
              ],
            ],
            keys: [g.name, r.town, g.year, g.how],
          };
        }),
        fit: true,
      },
      ...listedOf(shown.length, ended.length, "latest ended"),
    );
  }
  // (Soldiers sent against groups, the world over: those under way.)
  const sent = lc.standing.flatMap((r) =>
    (under?.of(r.ref)?.ops ?? []).filter((o) => o.ended === null).map((o) => ({ r, o })),
  );
  if (sent.length)
    blocks.push({
      type: "list",
      title: "Soldiers sent against crime groups",
      items: sent.slice(0, LEDGER_ROWS).map(({ r, o }) => ({
        line: [
          realmCell(r),
          ": ",
          link(
            `${count(o.soldiers)} soldiers against ${groupWords(o.name, GROUP_KINDS[o.kind])}`,
            opRef(r.ref, o.event),
          ),
          `, since year ${o.since}: ${count(Math.round(o.fallen))} soldiers dead`,
        ],
        ref: opRef(r.ref, o.event),
        year: o.since,
      })),
    });
  return blocks;
}

/** How a crime group's hold ended, in words (as its realm's Underworld tab says it). */
const GONE_HOW: Readonly<Record<string, string>> = {
  crushed: "broken by the crackdown",
  withered: "withered with its rent",
  absorbed: "taken into",
  split: "split among its lieutenants",
  exposed: "found out, purged and reformed",
  "fallen with its realm": "fell with its realm",
};

// —— The Groups ——————————————————————————————————————————————————————————————————————————————————————————

/** A group's two greatest aims of a tenth and more, in short words with their shares. */
function aimsOf(aims: readonly number[]): string {
  return (
    ORG_AIMS.map((a, i) => [a, aims[i] ?? 0] as const)
      .filter(([, w]) => w >= 100)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([a, w]) => `${AIM_WORDS[a]} (${per(w)})`)
      .join("; ") || "little yet"
  );
}

/** How a group's hold ended, in words. */
const ORG_HOW: Readonly<Record<string, string>> = {
  crushed: "broken by its realm",
  withered: "withered",
  merged: "taken into",
  won: "had what it formed for, and disbanded",
  "fallen with its realm": "fell with its realm",
};

/** The Groups tab: every group of every realm, by kind, its federations and how holds ended. */
export function groupsLedger(world: World, lc: LedgerCtx): Block[] {
  const store = orgsOf(world);
  type At = { r: Polity; g: Org };
  const all: At[] = [],
    feds: { r: Polity; f: OrgFed }[] = [],
    gone: { r: Polity; g: GoneOrg }[] = [];
  const kinds = new Map<string, { n: number; members: number }>();
  let members = 0,
    takes = 0,
    gives = 0,
    violence = 0,
    outlawed = 0,
    hired = 0;
  for (const r of lc.standing) {
    const v = store?.of(r.ref);
    if (!v) continue;
    for (const g of v.orgs) {
      all.push({ r, g });
      const k = kindName(g),
        was = kinds.get(k) ?? { n: 0, members: 0 };
      kinds.set(k, { n: was.n + 1, members: was.members + g.members });
      members += g.members;
      takes += g.takes;
      gives += g.gives;
      violence += g.violence;
      if (ORG_STANDING[g.standing] === "outlawed") outlawed++;
      if (g.patron) hired++;
    }
    for (const f of v.feds) feds.push({ r, f });
    for (const g of v.gone) gone.push({ r, g });
  }
  if (!all.length && !gone.length) return honest("No group has formed in this world yet.");
  const blocks: Block[] = [];
  if (!all.length) blocks.push(...honest("No group holds together in this world now."));
  else {
    blocks.push(
      allTold([
        stat("Groups", count(all.length), {
          parts: [part("of kinds", count(kinds.size)), part("federations", count(feds.length))],
        }),
        stat("Their members", count(members)),
        stat("Outlawed", count(outlawed), {
          parts: [part("paid or licensed by a realm", count(hired))],
        }),
        stat("What they take of others a year", `${grain(takes)} grain's worth`),
        stat("What they give their own a year", `${grain(gives)} grain's worth`),
        stat("The killing they do and suffer a year", killed(violence)),
      ]),
    );
    const byKind = [...kinds].sort((a, b) => b[1].members - a[1].members || (a[0] < b[0] ? -1 : 1));
    blocks.push({
      type: "table",
      title: "Groups by kind",
      columns: ["Kind", "Groups", "Members"],
      rows: byKind.map(([k, x]) => ({
        cells: [[cap(kindsWord(k))], [count(x.n)], [count(x.members)]],
        keys: [k, x.n, x.members],
      })),
      fit: true,
    });
    all.sort((a, b) => b.g.members - a.g.members || byRef(a.r, b.r) || a.g.id - b.g.id);
    const shown = all.slice(0, LEDGER_ROWS);
    blocks.push(
      {
        type: "table",
        title: "Every group",
        columns: [
          "Group",
          "Kind",
          "Realm",
          "Aims",
          "Members",
          "Lands",
          "Standing",
          "Takes · gives a year",
          "Killed a year",
          "Since",
        ],
        rows: shown.map(({ r, g }) => {
          const ref = orgRef(r.ref, g.event),
            kind = kindName(g),
            payer = g.patron ? standingRealm(world, g.patron) : undefined,
            standing = ORG_STANDING[g.standing] ?? "let be";
          return {
            ref,
            cells: [
              [link(cap(orgWords(g.name, kind)), ref)],
              [kind],
              [realmCell(r)],
              [aimsOf(g.aims)],
              [count(g.members)],
              [count(g.lands.length)],
              payer ? ["hired by ", realmCell(payer)] : [standing],
              [g.takes || g.gives ? `${grain(g.takes)} · ${grain(g.gives)}` : "—"],
              [killed(g.violence)],
              [`${g.since}`],
            ],
            keys: [
              g.name,
              kind,
              r.town,
              ORG_AIMS[g.aim] ?? "",
              g.members,
              g.lands.length,
              payer ? "hired" : standing,
              g.takes - g.gives,
              g.violence,
              g.since,
            ],
          };
        }),
        filter: 1,
      },
      ...listedOf(shown.length, all.length, "greatest groups"),
    );
    const most: Ranked[] = shown.map(({ r, g }) => ({
      name: link(cap(orgWords(g.name, kindName(g))), orgRef(r.ref, g.event)),
      value: g.members,
      said: many(g.members, "member", "members"),
    }));
    const realmsBy = new Map<string, { r: Polity; n: number }>();
    for (const { r } of all) realmsBy.set(r.ref, { r, n: (realmsBy.get(r.ref)?.n ?? 0) + 1 });
    blocks.push(
      ...mostLeastBlock([
        mostLeast("Most members", most),
        mostLeast(
          "Most groups in a realm",
          [...realmsBy.values()].map(({ r, n }) => ({
            name: realmCell(r),
            value: n,
            said: many(n, "group", "groups"),
          })),
        ),
      ]),
    );
  }
  if (feds.length)
    blocks.push({
      type: "table",
      title: "Their federations",
      columns: ["Federation", "Realm", "Groups", "Strength"],
      rows: feds
        .sort((a, b) => b.f.members.length - a.f.members.length || byRef(a.r, b.r))
        .slice(0, 60)
        .map(({ r, f }) => {
          const ref = orgFedRef(r.ref, f.event);
          return {
            ref,
            cells: [
              [link(`the ${f.name} federation`, ref)],
              [realmCell(r)],
              [count(f.members.length)],
              [per(f.strength)],
            ],
            keys: [f.name, r.town, f.members.length, f.strength],
          };
        }),
      fit: true,
    });
  if (gone.length) {
    gone.sort((a, b) => b.g.year - a.g.year || byRef(a.r, b.r));
    blocks.push({
      type: "table",
      title: "How their holds ended, the latest first",
      columns: ["Group", "Realm", "Years", "How"],
      rows: gone.slice(0, 40).map(({ r, g }) => {
        const ref = orgRef(r.ref, g.rose),
          kind = ORG_KINDS[g.kind] ?? "brotherhood";
        return {
          ref,
          cells: [
            [link(cap(orgWords(g.name, kind)), ref)],
            [realmCell(r)],
            [`${g.since}–${g.year}`],
            [`${ORG_HOW[g.how] ?? g.how}${g.into ? ` the ${g.into}` : ""}`],
          ],
          keys: [g.name, r.town, g.year, g.how],
        };
      }),
      fit: true,
    });
  }
  return blocks;
}

// —— The Houses ——————————————————————————————————————————————————————————————————————————————————————————

/** Whence a house rose, said short. */
const FROM: Readonly<Record<string, string>> = {
  crown: "the ruler's family",
  "the court": "the court",
  "the army": "the army",
  "the temple": "the temple",
  traders: "traders",
  crafters: "crafters",
  farmers: "landholders",
  herders: "herd-holders",
  demagogue: "a demagogue",
  grifter: "a grifter",
  cadet: "a younger line",
};
/** How a house's hold ended, in words. */
const HOUSE_HOW: Readonly<Record<string, string>> = {
  purged: "purged by the crown",
  overthrown: "overthrown with the court",
  wed: "wed into",
  "died out": "died out",
  faded: "faded from the great",
  exposed: "its grift found out",
};

/** A house gone from the great: its own page, where the event it rose by is still kept; else how its hold ended. */
function goneRef(world: World, realm: Ref, g: GoneHouse): string {
  const rose = roseBy(world, g);
  return rose ? houseRef(realm, rose) : g.event;
}

/** The Houses tab: every great house of every realm, and the houses whose hold ended. */
export function housesLedger(world: World, lc: LedgerCtx): Block[] {
  const store = housesOf(world);
  type Rec = Readonly<RealmHouses>;
  const houses: { r: Polity; h: HouseRecord }[] = [],
    gone: { r: Polity; g: GoneHouse }[] = [],
    realms: { r: Polity; v: Rec }[] = [];
  for (const r of lc.standing) {
    const v = store?.of(r.ref);
    if (!v) continue;
    realms.push({ r, v });
    for (const h of v.houses) houses.push({ r, h });
    for (const g of v.gone) gone.push({ r, g });
  }
  if (!houses.length && !gone.length) return honest("No great house has risen in this world yet.");
  const blocks: Block[] = [];
  let wealth = 0,
    titled = 0,
    crowns = 0;
  for (const { h } of houses) {
    wealth += h.wealth;
    if (h.titled) titled++;
    if (h.crown) crowns++;
  }
  const totals: Stat[] = [
    stat("Great houses", count(houses.length), {
      parts: [
        part("in realms", count(new Set(houses.map((x) => x.r.ref)).size)),
        part("holding the seat", count(crowns)),
      ],
    }),
    stat("Titled, their standing theirs by birth", count(titled)),
    stat("Their wealth", `${grain(wealth)} grain's worth`),
    stat("Houses whose hold ended, kept", count(gone.length)),
  ];
  blocks.push(allTold(totals));
  if (!houses.length) blocks.push(...honest("No great house holds power in this world now."));
  else {
    houses.sort((a, b) => b.h.wealth - a.h.wealth || byRef(a.r, b.r) || a.h.id - b.h.id);
    const shown = houses.slice(0, LEDGER_ROWS),
      name = (h: HouseRecord) => `${h.name}${h.crown ? " 👑" : ""}`;
    blocks.push(
      {
        type: "table",
        title: "Every great house",
        columns: [
          "House",
          "Realm",
          "Risen from",
          "Power",
          "Wealth",
          "Offices",
          "Titled",
          "Generation",
          "Since",
        ],
        rows: shown.map(({ r, h }) => {
          const ref = houseRef(r.ref, h.event),
            from = FROM[originOf(h)] ?? originOf(h);
          return {
            ref,
            cells: [
              [link(name(h), ref)],
              [realmCell(r)],
              [from],
              [per(h.power)],
              [grain(h.wealth)],
              [per(h.offices)],
              [h.titled ? "yes" : "no"],
              [count(h.generation)],
              [`${h.since}`],
            ],
            keys: [
              h.name,
              r.town,
              from,
              h.power,
              h.wealth,
              h.offices,
              h.titled,
              h.generation,
              h.since,
            ],
          };
        }),
      },
      ...listedOf(shown.length, houses.length, "richest houses"),
    );
    const ranked = (value: (h: HouseRecord) => number, said: (n: number) => string) =>
      shown.map(({ r, h }) => ({
        name: link(name(h), houseRef(r.ref, h.event)),
        value: value(h),
        said: said(value(h)),
      }));
    blocks.push(
      ...mostLeastBlock([
        mostLeast(
          "Richest house",
          ranked(
            (h) => h.wealth,
            (n) => `${grain(n)} grain's worth`,
          ),
        ),
        mostLeast(
          "Most generations",
          ranked(
            (h) => h.generation,
            (n) => `generation ${count(n)}`,
          ),
        ),
      ]),
    );
  }
  // Who each realm's ruler must pay (one line a realm that has great houses, its most peopled first).
  const paying = realms.filter(({ v }) => v.houses.length > 0).slice(0, LEDGER_ROWS);
  if (paying.length)
    blocks.push({
      type: "table",
      title: "Who each ruler must pay",
      columns: ["Realm", "Houses", "With a say", "Enough to rule", "Offices held by kin"],
      rows: paying.map(({ r, v }) => ({
        ref: `${r.ref}#houses`,
        cells: [
          [realmCell(r)],
          [count(v.houses.length)],
          [count(v.selectorate)],
          [`${count(v.winning)} (${share(v.selectorate > 0 ? v.winning / v.selectorate : 0)})`],
          [per(v.nepotism)],
        ],
        keys: [r.town, v.houses.length, v.selectorate, v.winning, v.nepotism],
      })),
      fit: true,
    });
  if (gone.length) {
    gone.sort((a, b) => b.g.year - a.g.year || byRef(a.r, b.r));
    const shown = gone.slice(0, 60);
    blocks.push(
      {
        type: "table",
        title: "Ended houses, the latest first",
        columns: ["House", "Realm", "Since", "Ended", "How"],
        rows: shown.map(({ r, g }) => {
          const ref = goneRef(world, r.ref, g);
          return {
            ref,
            cells: [
              [link(`the house of ${g.name}`, ref)],
              [realmCell(r)],
              [`${g.since}`],
              [`${g.year}`],
              [`${HOUSE_HOW[g.how] ?? g.how}${g.into ? ` the house of ${g.into}` : ""}`],
            ],
            keys: [g.name, r.town, g.since, g.year, g.how],
          };
        }),
        fit: true,
      },
      ...listedOf(shown.length, gone.length, "latest ended houses"),
    );
  }
  return blocks;
}

/** Many of a kind: "lending circles", "militias", "brigands". */
function kindsWord(kind: string): string {
  return kind.endsWith("s") ? kind : kind.endsWith("y") ? `${kind.slice(0, -1)}ies` : `${kind}s`;
}
