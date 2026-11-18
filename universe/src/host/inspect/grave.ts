// A town's grave matters (asked 2026-11-17: "the crimes and convictions in the towns seem to be very repetitive and minor"): the killings,
// the rackets, the forbidden trade, the bought officers, the outlawed circles, the spies and the bosses taken that the world already keeps,
// read as what a town's court hears of them. It reads, it never touches. Nothing here is invented: each matter stands on a row, a record or
// an event the world keeps (the underworld's rows and records, the groups', the bans, the bound, a land held by force, a spy found out, a
// house brought down, a boss taken), and where none of them stands there is no such matter. The court's own part (who of the town is
// named, what a year's book holds) is host/inspect/justice.ts; this file knows no one of a town's lines.
//
// What happened, who, why and what came of it: never how it was done, and nothing forbidden is named for what it is.
import {
  finish,
  hashString,
  mix,
  yearOfMoment,
  type HistoryEvent,
  type Ref,
  type World,
} from "../../kernel/index.ts";
import { cellRef } from "../../gen/index.ts";
import { AIM, GROUP_KINDS, ORG_KINDS, racketBit, type CrimeKind } from "../../rules/index.ts";
import {
  BAR,
  BAR_STORE,
  BOND,
  GANG_ROW,
  SMUGGLE,
  SMUGGLE_STORE,
  bossRef,
  collusionIn,
  deathNotesOf,
  gangsStore,
  groupsIn,
  housesRead,
  loreOf,
  moneyStore,
  occupationOf,
  orderOf,
  organisedIn,
  orgsOf,
  politiesOf,
  populationContext,
  protectedOf,
  realmName,
  underworldOf,
  type CrimeGroup,
  type Org,
  type Polity,
  type Settlement,
} from "../../sim/index.ts";
import type { CourtForm, CourtSentence, Line, Span } from "../../bridge/index.ts";
import { orgName, orgRef } from "../groups.ts";
import { groupRef, underName } from "../underworld.ts";
import { memoryOf } from "./memory.ts";
import { landLink, realmLink } from "./names.ts";
import { count, link } from "./words.ts";

export type GraveOffence =
  | "killing"
  | "robbery"
  | "kidnap"
  | "extort"
  | "contraband"
  | "smuggle"
  | "bribe"
  | "banned"
  | "spy"
  | "boss"
  | "crew"
  | "purge"
  | "bond"
  | "cruelty"
  | "witch"
  | "resist";

/** What came of a grave matter: wider than what a town's day shows of it (bridge CourtSentence). */
export type Outcome =
  | "death"
  | "gaol"
  | "labour"
  | "maim"
  | "exile"
  | "price"
  | "turned"
  | "sent"
  | "free"
  | "bought"
  | "frightened"
  | "pardon";

/** What the court is, as a grave matter needs it (host/inspect/justice.ts factsOf). */
export type CourtRead = {
  readonly form: CourtForm;
  /** How far its word reaches (0 … 1). */
  readonly reach: number;
  readonly convicts: boolean;
  readonly strict: boolean;
  readonly far: boolean;
  readonly grips: boolean;
  readonly coined: boolean;
  readonly bread: number;
  readonly food: string;
  /** Where in the town a thing can be said to have happened (its plan's own places). */
  readonly places: readonly string[];
};

/** Who stands: one of the town's lines (drawn by the court), or one the town's roster doesn't hold (a group's man, a boss, a spy). */
export type Stands =
  | { readonly kind: "folk"; readonly lean: CrimeKind | null; readonly rich?: boolean }
  | { readonly kind: "outside"; readonly ref: string; readonly name: string };

export type Draft = {
  readonly offence: GraveOffence;
  /** Its own key: the same matter, the same draws. */
  readonly key: string;
  readonly gravity: 3 | 4 | 5;
  readonly stands: Stands;
  /** One of the town wronged by it: the better off the likelier, anyone, or no one of its lines. */
  readonly wronged: "rich" | "any" | null;
  /** What they did, after their name; `them` is the one wronged, where one of the town is. */
  what(them: Span | null): Line;
  readonly why: readonly Line[];
  /** The group it is of (its page shows the case). */
  readonly group?: { readonly ref: string; readonly name: string };
  /** The event of history it stands on. */
  readonly event?: string;
  /** How far those it touches are held outside the law here by a group or a crew (0: by no one). */
  readonly hold: number;
  /** How far the court's own are paid by them (0 … 1). */
  readonly paid: number;
  /** Whether anyone was brought: a killing no one answers for is told as that. */
  readonly brought: boolean;
  /** One killed whom the world keeps by name (under the hand). */
  readonly victim?: { readonly name: string; readonly ref: string };
};

export type GraveRead = {
  readonly drafts: readonly Draft[];
  /** Those killed in the town in a year, by its land's rows (heads); of them, how many someone was brought for. */
  readonly killed: number;
  readonly answered: number;
  /** How far a group or a crew holds the town outside the law (0: none does). */
  readonly hold: number;
  /** How far the seat pardons its own (0 … 1): its houses' favours. */
  readonly favours: number;
};

const u = (h: number, n: number): number => finish(mix(h, n), 13) / 4294967296;
const key = (s: string): number => hashString(s) >>> 0;
const pct = (x: number): number => Math.round(x * 100);
const clamp = (x: number, lo = 0, hi = 1): number => Math.max(lo, Math.min(hi, x));
/** How many of a thing a year, of a rate: its whole part, and one more by its key's draw. */
const times = (rate: number, k: string, most: number): number =>
  Math.min(most, Math.floor(rate) + (u(key(k), 1) < rate - Math.floor(rate) ? 1 : 0));
/** A rate read in twentieths, so a year's small drift doesn't turn a year's book. */
const banded = (x: number): number => Math.round(x * 20) / 20;

// —— The year's events a court can stand on, found once for each count of the world's events ——————————————————————

const TOLD = new Set(["ties.spy", "houses.purged", "underworld.exposed"]);
const EVENTS = new WeakMap<World, { n: number; from: number; by: Map<string, HistoryEvent[]> }>();
/** The events of a kind in a year, at a land (those of the last few years are kept to hand). */
function eventsOf(world: World, type: string, year: number, cell: number): HistoryEvent[] {
  const all = world.events.all(),
    now = yearOfMoment(world.now);
  let kept = EVENTS.get(world);
  if (!kept || kept.n !== all.length || kept.from > year) {
    const by = new Map<string, HistoryEvent[]>(),
      from = Math.min(year, now - 3);
    for (let i = all.length - 1; i >= 0; i--) {
      const e = all[i]!,
        y = yearOfMoment(e.t);
      if (y < from) break;
      if (!TOLD.has(e.type) || !e.place) continue;
      const k = `${e.type}|${y}|${e.place}`,
        l = by.get(k);
      if (l) l.push(e);
      else by.set(k, [e]);
    }
    EVENTS.set(world, (kept = { n: all.length, from, by }));
  }
  return kept.by.get(`${type}|${year}|${cellRef(0, cell)}`) ?? [];
}

/** A land's chief town: its market town, else its greatest. */
export function chiefTown(world: World, cell: number): Settlement | null {
  let best: Settlement | null = null;
  for (const t of populationContext(world).settlements.inProvince(cell)) {
    if (t.population <= 0) continue;
    if (!best || Number(!!t.market) - Number(!!best.market) > 0) best = t;
    else if (!!t.market === !!best.market && t.population > best.population) best = t;
  }
  return best;
}

const has = (g: CrimeGroup, r: Parameters<typeof racketBit>[0]): boolean =>
  (g.rackets & racketBit(r)) !== 0;
const kindOf = (g: CrimeGroup) => GROUP_KINDS[g.kind] ?? "protection";

/** One of a group, as a court's book names him: the roster of a town holds no such man by name. */
const manOf = (name: string): string => `one of ${name}${name.endsWith("s") ? "'" : "'s"} own`;

// —— The reading ————————————————————————————————————————————————————————————————————————————————

/**
 * A town's grave matters of a year, from what the world keeps: each with what it stands on. `court` is the court as justice.ts
 * reads it; `calamity` a hunger or a sickness lately through its land (its memory's deed), `faithLaw` its realm's law of faith.
 */
export function graveRead(
  world: World,
  s: Settlement,
  year: number,
  realm: Polity | undefined,
  court: CourtRead,
  faithLaw: number,
): GraveRead {
  const drafts: Draft[] = [],
    none: GraveRead = { drafts, killed: 0, answered: 0, hold: 0, favours: 0 };
  // (A hive turns from its own, and keeps no court for more: its matters are what its own do, which justice.ts reads.)
  if (court.form === "hive") return none;
  const cell = s.cell,
    pop = s.population,
    size = clamp((Math.log10(Math.max(10, pop)) - 2) / 2, 0, 2.5),
    chief = chiefTown(world, cell)?.ref === s.ref,
    row = groupsIn(world, cell),
    rec = realm ? underworldOf(world)?.of(realm.ref) : undefined,
    orgRow = organisedIn(world, cell),
    orgs = realm ? orgsOf(world)?.of(realm.ref) : undefined,
    order = realm ? orderOf(world)?.of(realm.ref) : undefined,
    collusion = realm ? banded(collusionIn(world, realm.ref)) : 0,
    control = banded(row?.control ?? 0),
    holder =
      rec && row && row.group !== null ? rec.groups.find((g) => g.id === row.group) : undefined,
    here = (rec?.groups ?? []).filter((g) => g.lands.includes(cell)),
    crew = row && row.badge > 0 ? rec?.groups.find((g) => kindOf(g) === "badge") : undefined,
    named = (g: CrimeGroup) => {
      const ref = groupRef(realm!.ref, g.event);
      return { ref, name: underName(world, ref) ?? `the ${g.name} ${kindOf(g)}` };
    },
    orgNamed = (g: Org) => {
      const ref = orgRef(realm!.ref, g.event);
      return {
        ref,
        name: orgName(world, ref) ?? `the ${g.name} ${ORG_KINDS[g.kind] ?? "brotherhood"}`,
      };
    },
    // (How far a group or a crew holds the town outside the law: nothing where neither does.)
    hold = clamp(control + (crew ? 0.5 * banded(row!.badge) : 0)),
    paid = hold > 0 ? clamp(collusion * 2 + (order ? order.corruption : 0)) : 0,
    place = (k: string): string =>
      court.places.length ? court.places[Math.floor(u(key(k), 7) * court.places.length)]! : "",
    under: Span = link("its underworld", `${cellRef(0, cell)}#underworld`);

  // —— Killing: only where the land's rows keep those killed, and only as many ——
  const preying = (orgs?.orgs ?? []).filter(
      (g) => g.aim === AIM.prey && g.standing === 0 && g.lands.includes(cell),
    ),
    perHead = (row ? row.violence : 0) / 1e5 + (orgRow ? orgRow.violence : 0) / 1e5,
    killedRate = perHead * pop,
    killed =
      killedRate >= 1
        ? Math.round(killedRate)
        : times(banded(killedRate), `killed ${s.ref} ${year}`, 1),
    clear = clamp(0.5 * court.reach * (1 - 0.7 * control) * (1 - 0.5 * collusion), 0.02, 0.45);
  if (killed > 0 && realm) {
    const war = rec?.wars.find(
        (w) =>
          w.since < year &&
          (w.ended === null || w.ended >= year - 1) &&
          here.some((g) => g.id === w.a) &&
          here.some((g) => g.id === w.b),
      ),
      fa = gangsStore(world)?.at(cell, GANG_ROW.fedA) ?? 0,
      fb = gangsStore(world)?.at(cell, GANG_ROW.fedB) ?? 0,
      fed = (id: number) => (id > 0 ? rec?.feds.find((f) => f.id === id - 1) : undefined),
      motives: { m: string; w: number }[] = [];
    if (war) motives.push({ m: "turf", w: 3 });
    if (holder && (has(holder, "protection") || has(holder, "extortion") || has(holder, "killing")))
      motives.push({ m: "racket", w: 0.5 + 2 * control });
    if (row && row.gangs > 0 && row.street > 0)
      motives.push({ m: "street", w: 0.5 + 3 * row.street });
    if (crew?.squad) motives.push({ m: "squad", w: 2 * row!.badge });
    if (preying.length && orgRow && orgRow.violence > 0)
      motives.push({ m: "road", w: 0.5 + orgRow.violence / Math.max(1, row?.violence ?? 1) });
    const all = motives.reduce((n, x) => n + x.w, 0),
      shown = all > 0 ? Math.min(3, killed) : 0;
    for (let j = 0; j < shown; j++) {
      const k = `killing ${s.ref} ${year} ${j}`,
        h = key(k);
      let v = u(h, 2) * all,
        m = motives[0]!.m;
      for (const x of motives) {
        v -= x.w;
        if (v < 0) {
          m = x.m;
          break;
        }
      }
      const at = place(k),
        where = at ? ` ${at}` : "";
      if (m === "turf" && war) {
        const a = here.find((g) => g.id === (u(h, 3) < 0.5 ? war.a : war.b))!,
          b = here.find((g) => g.id === (a.id === war.a ? war.b : war.a))!,
          A = named(a),
          B = named(b);
        drafts.push({
          offence: "killing",
          key: k,
          gravity: 5,
          stands: { kind: "outside", ref: A.ref, name: manOf(A.name) },
          wronged: null,
          what: (them) => ["killed ", them ?? manOf(B.name), `${where}, in the war between them`],
          why: [
            [
              link(sentenceCase(A.name), A.ref),
              " and ",
              link(B.name, B.ref),
              " were at war over what this land pays: ",
              link("their war", war.event),
              ".",
            ],
          ],
          group: A,
          event: war.event,
          hold,
          paid,
          brought: u(h, 4) < clear,
        });
      } else if (m === "racket" && holder) {
        const G = named(holder),
          who = ["a trader", "a carter", "one who kept a stall", "one who kept a workshop"][
            Math.floor(u(h, 5) * 4)
          ]!;
        drafts.push({
          offence: "killing",
          key: k,
          gravity: 5,
          stands: { kind: "outside", ref: G.ref, name: manOf(G.name) },
          wronged: null,
          what: (them) => [
            "killed ",
            them ?? who,
            `${where}, who would not pay what the group asks`,
          ],
          why: [
            [
              link(sentenceCase(G.name), G.ref),
              ` holds ${pct(control)} in a hundred of this land outside the law, and lives on what its trade pays to be left alone.`,
            ],
          ],
          group: G,
          hold,
          paid,
          brought: u(h, 4) < clear,
        });
      } else if (m === "street") {
        const f1 = fed(fa),
          f2 = fed(fb),
          rival = f1 && f2 ? (u(h, 3) < 0.5 ? f2 : f1) : (f1 ?? f2);
        drafts.push({
          offence: "killing",
          key: k,
          gravity: 5,
          stands: { kind: "folk", lean: "harm" },
          wronged: null,
          what: (them) => [
            "killed ",
            them ?? `a youth of ${rival ? `the ${rival.name} gangs` : "another street's gang"}`,
            `${where}, in a fight between their streets`,
          ],
          why: [
            [
              `${count(row!.gangs)} small gangs hold its streets, and they fight over them: `,
              under,
              ".",
            ],
          ],
          hold: 0.5 * hold,
          paid: 0,
          brought: u(h, 4) < clear,
        });
      } else if (m === "squad" && crew) {
        const G = named(crew);
        drafts.push({
          offence: "killing",
          key: k,
          gravity: 5,
          stands: { kind: "outside", ref: G.ref, name: manOf(G.name) },
          wronged: null,
          what: (them) => [
            "killed ",
            them ?? "one the crew had hunted",
            `${where}, outside any court`,
          ],
          why: [
            [
              link(sentenceCase(G.name), G.ref),
              " wears the realm's badge and kills those it hunts, outside the law.",
            ],
          ],
          group: G,
          hold: clamp(hold + 0.3),
          paid: clamp(paid + 0.3),
          brought: u(h, 4) < clear * 0.15,
        });
      } else if (preying.length) {
        const o = preying[Math.floor(u(h, 3) * preying.length)]!,
          G = orgNamed(o);
        drafts.push({
          offence: "killing",
          key: k,
          gravity: 5,
          stands: { kind: "outside", ref: G.ref, name: manOf(G.name) },
          wronged: null,
          what: (them) => [
            "killed ",
            them ??
              ["a carter", "a trader bound for the market", "a herder driving beasts to town"][
                Math.floor(u(h, 5) * 3)
              ]!,
            [
              " on the road into the town, for what was carried",
              " on the road out of the town, for what they had with them",
              " a day's walk from the town, for their load",
            ][Math.floor(u(h, 6) * 3)]!,
          ],
          why: [
            [
              link(sentenceCase(G.name), G.ref),
              " prey on this land's roads, and the realm has outlawed them.",
            ],
          ],
          group: G,
          hold: 0,
          paid: 0,
          brought: u(h, 4) < clear * 0.6,
        });
      }
    }
  }
  const answered = Math.min(killed, Math.round(killed * clear));

  // —— What a group that holds the land lives on ——
  const prot = protectedOf(world, cell);
  if (
    realm &&
    holder &&
    (has(holder, "protection") || has(holder, "extortion")) &&
    prot.protection + prot.extortion > 0
  ) {
    const G = named(holder),
      n = times(
        size * clamp(6 * banded(prot.protection + prot.extortion)),
        `extort ${s.ref} ${year}`,
        2,
      );
    for (let j = 0; j < n; j++) {
      const k = `extort ${s.ref} ${year} ${j}`,
        at = place(k);
      drafts.push({
        offence: "extort",
        key: k,
        gravity: 4,
        stands: { kind: "outside", ref: G.ref, name: manOf(G.name) },
        wronged: "rich",
        what: (them) =>
          [
            [
              "made ",
              them ?? "a trader",
              ` pay to be left to trade${at ? ` ${at}` : ""}, and came back for more`,
            ],
            [
              "told ",
              them ?? "a trader",
              " what their trade would pay the group each month, and came to collect it",
            ],
            [
              "took a share of what ",
              them ?? "a trader",
              ` earns${at ? ` ${at}` : ""}, by threat to them and their house`,
            ],
          ][Math.floor(u(key(k), 8) * 3)]!,
        why: [
          [
            link(sentenceCase(G.name), G.ref),
            ` takes pay of ${pct(prot.protection + prot.extortion)} in a hundred of this land's trade: `,
            under,
            ".",
          ],
        ],
        group: G,
        hold,
        paid,
        brought: true,
      });
    }
  }
  // Robbery with violence, and those held for a price: where the outlawed prey on its roads, or a group lives on it.
  const robbers = here.filter((g) => has(g, "theft") || has(g, "kidnapping")),
    prey = banded(orgRow?.prey ?? 0);
  if (realm && (preying.length || robbers.length)) {
    const n = times(size * clamp(0.3 + 20 * prey) * 0.8, `robbery ${s.ref} ${year}`, 2);
    for (let j = 0; j < n; j++) {
      const k = `robbery ${s.ref} ${year} ${j}`,
        h = key(k),
        pool = [...preying.map((o) => orgNamed(o)), ...robbers.map((g) => named(g))],
        G = pool[Math.floor(u(h, 3) * pool.length)]!,
        ransom = u(h, 5) < 0.3 && (preying.length > 0 || robbers.some((g) => has(g, "kidnapping")));
      drafts.push({
        offence: ransom ? "kidnap" : "robbery",
        key: k,
        gravity: ransom ? 5 : 4,
        stands: { kind: "outside", ref: G.ref, name: manOf(G.name) },
        wronged: "rich",
        what: (them) =>
          ransom
            ? ["held ", them ?? "a trader", " on the road until their kin paid to have them back"]
            : [
                "robbed ",
                them ?? "a trader",
                [
                  " on the road into the town, and left them hurt",
                  " of all they carried to market, and beat them",
                  " on the road, with others, and left them for dead",
                ][Math.floor(u(h, 6) * 3)]!,
              ],
        why: [
          [
            link(sentenceCase(G.name), G.ref),
            preying.length
              ? " prey on this land's roads, and the realm has outlawed them."
              : " lives on what it takes on this land's roads.",
          ],
        ],
        group: G,
        hold: preying.length ? 0 : hold,
        paid: preying.length ? 0 : paid,
        brought: true,
      });
    }
  }

  // —— What the realm forbids, and what goes round its toll ——
  const bar = realm ? moneyStore(world, BAR_STORE)?.get(realm.ref) : undefined,
    barred = banded((bar?.[BAR.barred] ?? 0) / 1000);
  if (realm && barred > 0) {
    const cartels = here.filter((g) => kindOf(g) === "cartel"),
      n = times(size * clamp(4 * barred), `contraband ${s.ref} ${year}`, 2);
    for (let j = 0; j < n; j++) {
      const k = `contraband ${s.ref} ${year} ${j}`,
        h = key(k),
        c =
          cartels.length && u(h, 3) < 0.5
            ? named(cartels[Math.floor(u(h, 4) * cartels.length)]!)
            : null,
        at = place(k);
      drafts.push({
        offence: "contraband",
        key: k,
        gravity: 3,
        stands: c
          ? { kind: "outside", ref: c.ref, name: manOf(c.name) }
          : { kind: "folk", lean: "cheat" },
        wronged: null,
        what: () => [
          u(h, 5) < 0.5
            ? `sold what the realm forbids${at ? ` ${at}` : ""}`
            : "was found carrying what the realm forbids, more than one person takes",
        ],
        why: [
          [
            realmLink(world, realm.ref),
            ` forbids ${pct(barred)} in a hundred of what its people take to calm, wake or ease them, and they take it still: `,
            under,
            ".",
          ],
          ...(c ? [[link(sentenceCase(c.name), c.ref), " carries it here."] as Line] : []),
        ],
        ...(c ? { group: c } : {}),
        hold: c ? hold : 0,
        paid: c ? paid : 0,
        brought: true,
      });
    }
  }
  const smug = realm ? moneyStore(world, SMUGGLE_STORE)?.get(realm.ref) : undefined,
    round = banded((smug?.[SMUGGLE.share] ?? 0) / 1000);
  if (realm && round > 0 && s.market) {
    const n = times(size * clamp(1.5 * round) * 0.7, `smuggle ${s.ref} ${year}`, 1);
    for (let j = 0; j < n; j++) {
      const k = `smuggle ${s.ref} ${year} ${j}`,
        wares = (rec?.wareRent ?? 0) > 0 && u(key(k), 5) < 0.4;
      drafts.push({
        offence: "smuggle",
        key: k,
        gravity: 3,
        stands: { kind: "folk", lean: "cheat" },
        wronged: null,
        what: () => [
          wares
            ? "brought to market wares the realm bars from sale"
            : "brought goods to market round the realm's toll",
        ],
        why: [
          [
            `${pct(round)} in a hundred of what should pay `,
            realmLink(world, realm.ref),
            "'s toll goes round it: ",
            link("its underworld", `${realm.ref}#underworld`),
            ".",
          ],
        ],
        hold: 0,
        paid: 0,
        brought: true,
      });
    }
  }

  // —— The law's own men paid: where the realm is skimmed, or a group pays its officers ——
  const corr = order ? banded(order.corruption) : 0,
    office = court.form === "magistrate" || court.form === "bench";
  if (realm && office && (corr >= 0.05 || (hold > 0 && collusion > 0))) {
    const payer = holder && holder.bribes > 0 ? named(holder) : null,
      n = times(
        size * clamp(3 * corr + 5 * collusion) * 0.4 * court.reach,
        `bribe ${s.ref} ${year}`,
        1,
      );
    for (let j = 0; j < n; j++) {
      const k = `bribe ${s.ref} ${year} ${j}`,
        h = key(k),
        who = [
          "an officer of the town's watch",
          "a clerk of the court",
          "a keeper of the town's toll",
        ][Math.floor(u(h, 3) * 3)]!;
      drafts.push({
        offence: "bribe",
        key: k,
        gravity: 4,
        stands: { kind: "outside", ref: payer?.ref ?? realm.ref, name: who },
        wronged: null,
        what: () =>
          payer
            ? ["took the pay of ", link(payer.name, payer.ref), " to look away"]
            : ["took pay to turn what came before them"],
        why: [
          payer
            ? [
                link(sentenceCase(payer.name), payer.ref),
                " pays officers and judges here, and one of them was found out.",
              ]
            : [
                `${pct(corr)} in a hundred of what `,
                realmLink(world, realm.ref),
                " raises is skimmed by those who serve it.",
              ],
        ],
        ...(payer ? { group: payer } : {}),
        hold: payer ? hold : 0,
        paid: payer ? paid : 0,
        brought: true,
      });
    }
  }

  // —— Those of a circle the realm has outlawed ——
  if (realm && orgs) {
    const outlawed = orgs.orgs.filter(
      (g) =>
        g.standing === 0 &&
        g.lands.includes(cell) &&
        (g.aim === AIM.worship || g.aim === AIM.rebel || g.aim === AIM.conspire),
    );
    for (const g of outlawed.slice(0, 2)) {
      const G = orgNamed(g),
        // (As hard as its realm turns on what it outlaws: sim/order/groups.ts suppression.)
        n = times(
          size * 0.9 * banded(orgs.suppression / 1000),
          `banned ${s.ref} ${year} ${g.id}`,
          1,
        );
      for (let j = 0; j < n; j++) {
        const k = `banned ${s.ref} ${year} ${g.id} ${j}`,
          plot = g.aim !== AIM.worship && (orgRow?.plot ?? 0) > 0;
        drafts.push({
          offence: "banned",
          key: k,
          gravity: g.aim === AIM.worship ? 3 : 4,
          stands: { kind: "folk", lean: "defy" },
          wronged: null,
          what: () =>
            g.aim === AIM.worship
              ? [
                  "was found to keep the rites of ",
                  link(G.name, G.ref),
                  ", which the realm has outlawed",
                ]
              : [
                  "was named as one of ",
                  link(G.name, G.ref),
                  ", which the realm has outlawed",
                  plot ? ", and as one who plotted with them against the seat" : "",
                ],
          why: [
            [
              link(sentenceCase(G.name), G.ref),
              ` ${g.members === 1 ? "is" : "are"} outlawed by `,
              realmLink(world, realm.ref),
              `, and ${count(g.members)} strong in its lands.`,
            ],
          ],
          group: G,
          hold: 0,
          paid: 0,
          brought: true,
        });
      }
    }
  }

  // —— What an event of the year before brought to the land's chief town ——
  if (realm && chief) {
    // (A spy found out is told at the seat of the realm that found them: its first subject, the sender its second.)
    for (const e of eventsOf(world, "ties.spy", year - 1, cell)) {
      if (e.subjects[0] !== realm.ref) continue;
      const from = e.subjects[1],
        sender = from ? politiesOf(world).get(from as Ref) : undefined;
      if (!from) continue;
      drafts.push({
        offence: "spy",
        key: `spy ${e.id}`,
        gravity: 5,
        stands: {
          kind: "outside",
          ref: from,
          name: `an agent of ${sender ? realmName(sender) : "another realm"}`,
        },
        wronged: null,
        what: () => [
          "was found to have sent word of ",
          realmLink(world, realm.ref),
          " to those who sent them",
        ],
        why: [["A spy was found out here: ", link(`what happened in year ${year - 1}`, e.id), "."]],
        event: e.id,
        hold: 0,
        paid: 0,
        brought: true,
      });
    }
    for (const e of eventsOf(world, "houses.purged", year - 1, cell)) {
      if (!e.subjects.includes(realm.ref)) continue;
      const d = e.data as { house?: string } | null;
      drafts.push({
        offence: "purge",
        key: `purge ${e.id}`,
        gravity: 5,
        stands: {
          kind: "outside",
          ref: e.id,
          name: `the head of the house of ${d?.house ?? "a great name"}`,
        },
        wronged: null,
        what: () => ["was tried at the seat's word, and their house brought down with them"],
        why: [
          [
            "The seat turned on one of its great houses: ",
            link(`what happened in year ${year - 1}`, e.id),
            ".",
          ],
        ],
        event: e.id,
        hold: 0,
        paid: 0,
        brought: true,
      });
    }
    for (const e of eventsOf(world, "underworld.exposed", year - 1, cell)) {
      if (!e.subjects.includes(realm.ref)) continue;
      const d = e.data as { group?: string; killed?: number } | null,
        gone = rec?.gone.find((g) => g.event === e.id),
        ref = gone ? groupRef(realm.ref, gone.rose) : e.id,
        name = (gone && underName(world, ref)) || `the ${d?.group ?? "town"} crew`;
      drafts.push({
        offence: "crew",
        key: `crew ${e.id}`,
        gravity: 4,
        stands: { kind: "outside", ref, name: `an officer of ${name}` },
        wronged: null,
        what: () => [
          "was found to have kept what the crew seized in the realm's name",
          (d?.killed ?? 0) > 0 ? ", and to have had a part in those it killed" : "",
        ],
        why: [
          [
            "A crew that wore the realm's badge was found out: ",
            link(`what happened in year ${year - 1}`, e.id),
            ".",
          ],
        ],
        group: { ref, name },
        event: e.id,
        hold: 0,
        paid: 0,
        brought: true,
      });
    }
    // A boss the realm took, tried in his group's home.
    const notes = deathNotesOf(world);
    if (notes && rec)
      for (const g of rec.groups) {
        if (g.home !== cell) continue;
        const head = bossRef(realm.ref, g.event);
        for (const n of notes.headsOf(head)) {
          if (n.how !== "taken" || n.year !== year - 1) continue;
          const G = named(g);
          drafts.push({
            offence: "boss",
            key: `boss ${head} ${n.year}`,
            gravity: 5,
            stands: { kind: "outside", ref: `${head}:${n.year}`, name: n.name },
            wronged: null,
            what: () => [
              "was taken by the realm and answered for what ",
              link(G.name, G.ref),
              " did under them",
            ],
            why: [
              n.event
                ? [
                    "The realm took the head of the group: ",
                    link(`what happened in year ${n.year}`, n.event),
                    ".",
                  ]
                : ["The realm took the head of the group."],
            ],
            group: G,
            ...(n.event ? { event: n.event } : {}),
            hold: hold,
            paid: clamp(paid + (g.house ? 0.2 : 0)),
            brought: true,
          });
        }
      }
  }

  // —— The bound ——
  const store = orderOf(world),
    bound = banded(store?.bound(cell) ?? 0);
  if (realm && order && bound >= 0.05 && order.abolished === null && court.form !== "reef") {
    if ((order.firsts[BOND.debt] ?? null) !== null) {
      const n = times(size * clamp(4 * bound) * 0.6, `bond ${s.ref} ${year}`, 1);
      for (let j = 0; j < n; j++)
        drafts.push({
          offence: "bond",
          key: `bond ${s.ref} ${year} ${j}`,
          gravity: 3,
          stands: { kind: "folk", lean: "cheat", rich: true },
          wronged: "any",
          what: (them) => [
            "held ",
            them ?? "one of the town",
            " bound for a debt, past what the debt came to",
          ],
          why: [
            [
              `${pct(bound)} in a hundred of those in `,
              landLink(world, cell, true),
              " are held bound, some of them for what they owe: ",
              link("what bound them", store?.land(cell)?.cause ?? realm.ref),
              ".",
            ],
          ],
          hold: 0,
          paid: 0,
          brought: true,
        });
    }
    if (office) {
      const n = times(size * clamp(4 * bound) * 0.4, `cruelty ${s.ref} ${year}`, 1);
      for (let j = 0; j < n; j++)
        drafts.push({
          offence: "cruelty",
          key: `cruelty ${s.ref} ${year} ${j}`,
          gravity: 4,
          stands: { kind: "folk", lean: "harm", rich: true },
          wronged: null,
          what: () => ["was brought for the hurt done to one bound to their house"],
          why: [
            [
              `${pct(bound)} in a hundred of those in `,
              landLink(world, cell, true),
              " are held bound, and the law here hears what is done to them.",
            ],
          ],
          hold: 0,
          paid: 0,
          brought: true,
        });
    }
  }

  // —— One named for a calamity, where one faith is the law and no one knows what sickness is ——
  if (realm && faithLaw === 0 && !loreOf(world).get(cell, "germs")) {
    const deeds = memoryOf(world).byCell.get(cell) ?? [],
      ill = deeds.findLast(
        (d) => (d.kind === "plague" || d.kind === "hunger") && d.year < year && d.year >= year - 2,
      );
    if (ill) {
      const n = times(size * 0.5 + 0.15, `witch ${s.ref} ${year}`, 1);
      for (let j = 0; j < n; j++)
        drafts.push({
          offence: "witch",
          key: `witch ${s.ref} ${year} ${j}`,
          gravity: 4,
          stands: { kind: "folk", lean: null },
          wronged: null,
          what: () => [
            "was named by their neighbours as the cause of ",
            link(
              ill.kind === "plague"
                ? (ill.what ?? "the sickness")
                : `the hunger of year ${ill.year}`,
              ill.kind === "plague" ? (ill.whatRef ?? ill.id) : ill.id,
            ),
          ],
          why: [
            [
              "Their realm keeps one faith, and no one here knows what brings a sickness or a failed year: ",
              link("its law of faith", realm.ref),
              ".",
            ],
          ],
          hold: 0,
          paid: 0,
          brought: true,
        });
    }
  }

  // —— A land held by force, where its people resist ——
  const held = occupationOf(world)?.of(cell);
  if (realm && held && held.since < year && (held.resistance > 0 || held.rising)) {
    const n = times(size * clamp(0.3 + banded(held.resistance)), `resist ${s.ref} ${year}`, 2);
    for (let j = 0; j < n; j++)
      drafts.push({
        offence: "resist",
        key: `resist ${s.ref} ${year} ${j}`,
        gravity: 4,
        stands: { kind: "folk", lean: "defy" },
        wronged: null,
        what: () => [
          "sheltered those who fight the hold of ",
          realmLink(world, held.holder),
          " on this land",
        ],
        why: [
          [
            landLink(world, cell, true),
            " has been held by force by ",
            realmLink(world, held.holder),
            ` since year ${held.since}, and its people resist`,
            ...(held.event ? [": ", link("their rising", held.event)] : []),
            ".",
          ],
        ],
        ...(held.event ? { event: held.event } : {}),
        hold: 0,
        paid: 0,
        brought: true,
      });
  }

  return {
    drafts,
    killed,
    answered,
    hold,
    favours: realm ? (housesRead(world, realm.ref)?.favours ?? 0) : 0,
  };
}

const sentenceCase = (t: string): string => (t ? t[0]!.toUpperCase() + t.slice(1) : t);

// —— What came of it ————————————————————————————————————————————————————————————————————————————

const YEARS_WORD = [
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
  "eleven",
  "twelve",
];
const yearsWords = (n: number): string => (n === 1 ? "a year" : `${YEARS_WORD[n] ?? n} years`);

export type Came = {
  readonly outcome: Outcome;
  /** As the town's day shows it. */
  readonly sentence: CourtSentence;
  readonly days: number;
  readonly came: string;
  readonly cost: string;
};

/**
 * What came of a grave matter, by who judges, how old their world is and who stands. One of a town's lines is never put to death
 * by a reading (the roster holds its dead by what history did): for them the gravest is long years, the works or being sent away.
 * Let go because the judge was paid, or because no one would speak, only where a group or a crew holds the town (`hold`).
 */
export function cameOfGrave(
  court: CourtRead,
  d: Draft,
  favours: number,
  h: number,
  repeat: boolean,
  /** Told otherwise than another of its year: the draw of what was laid on them turned, and other words. */
  turn = 0,
): Came {
  const folk = d.stands.kind === "folk",
    v = turn ? (u(h, 31) + 0.37 * turn) % 1 : u(h, 31),
    say = <T>(l: readonly T[]): T => l[turn % l.length]!,
    g = Math.min(5, d.gravity + (repeat ? 1 : 0) + (court.strict && u(h, 32) < 0.4 ? 1 : 0)),
    years = Math.max(1, Math.round((g - 2.5) * 2 + u(h, 33) * (g - 2) * 2)) + turn,
    term = yearsWords(years),
    days = years * 365,
    their = folk ? "their home" : "those who waited on them",
    reef = court.form === "reef",
    writ = court.form === "magistrate" || court.form === "bench";
  // Bought, or no one would speak: a group's or a crew's hold on the town.
  if (
    d.hold > 0 &&
    u(h, 34) < (d.offence === "boss" ? Math.min(0.3, 0.6 * d.paid) : Math.min(0.45, 0.9 * d.paid))
  )
    return {
      outcome: "bought",
      sentence: "bribe",
      days: 1,
      came: writ
        ? say([
            "was let go: those who judged had been paid",
            "was let go before it was heard: the court's own had been paid",
            "walked out of the court: it had been paid for",
          ])
        : say(["was let go: those who heard it had been paid", "was let go: it had been paid for"]),
      cost: `Nothing to them. ${d.group ? `${sentenceCase(d.group.name)} paid` : "It was paid"}, to no one who would say so.`,
    };
  if (d.hold > 0 && u(h, 35) < Math.min(0.4, 0.8 * d.hold))
    return {
      outcome: "frightened",
      sentence: "free",
      days: 1,
      came: say([
        "was let go: no one who saw it would say so before the court",
        "was let go: those who had spoken took back what they said",
        "was let go: on the day, no one came to speak against them",
      ]),
      cost: `Nothing to them. Those who saw it live where ${d.group ? d.group.name : "the group"} can find them.`,
    };
  // A spy found out is sent back over the border, or dies for it (sim/war/spies.ts): history has found them, and no one lets them go.
  if (d.offence === "spy") {
    if (court.far || court.form === "bench" || v < 0.5)
      return {
        outcome: "sent",
        sentence: "banish",
        days: 730,
        came: say([
          "was held, and sent back over the border",
          "was sent home to those who sent them, and their name told to every gate",
        ]),
        cost: "Their work here, and their name in it.",
      };
    return {
      outcome: "death",
      sentence: "banish",
      days: 730,
      came: say(["was put to death as a spy", "was condemned as a spy, and died for it"]),
      cost: "Their life.",
    };
  }
  // Not guilty: a bench can find anyone so; elsewhere, seldom.
  if (u(h, 36) < (court.form === "bench" ? 0.18 : d.offence === "witch" ? 0.3 : 0.06))
    return {
      outcome: "free",
      sentence: "free",
      days: 1,
      came:
        court.form === "bench"
          ? "was found not guilty by the bench"
          : d.offence === "witch"
            ? "was heard and let go: those who judged would not have it"
            : "was heard and let go: it could not be shown",
      cost: "Nothing but the days it took, and what is said of them now.",
    };
  // A pardon by the seat, as far as it favours its own.
  if (writ && g >= 4 && u(h, 37) < 0.06 * favours)
    return {
      outcome: "pardon",
      sentence: "free",
      days: 1,
      came: "was found guilty, and pardoned by the seat before the sentence was carried out",
      cost: "Nothing, by the seat's favour.",
    };
  // (Death only for what is gravest of itself, on one a town's roster doesn't hold, where their age still has it.)
  const death = !folk && !court.far && d.gravity >= 5,
    exile = (forGood: boolean): Came => ({
      outcome: "exile",
      sentence: "banish",
      days: 730,
      came: reef
        ? "was sent out on the current, not to come back"
        : forGood
          ? "was sent out of the realm, not to come back"
          : "was walked out of town and sent away for two years",
      cost: folk
        ? "Their home, and everyone they knew."
        : "Their place here, and all they held in it.",
    }),
    gaol = (): Came => ({
      outcome: "gaol",
      sentence: "cell",
      days,
      came: !court.grips
        ? `was shut in the pit for ${term}`
        : court.far
          ? `was sealed in the realm's holding for ${term}`
          : `was locked up for ${term}`,
      cost: `${sentenceCase(term)} of their life, that ${their} went without.`,
    }),
    labour = (): Came => ({
      outcome: "labour",
      sentence: "labour",
      days,
      came: court.convicts
        ? `was bound to the realm's works for ${term}`
        : `was set to hard labour for ${term}`,
      cost: `${sentenceCase(term)} at the works, unpaid, and ${their} went without.`,
    }),
    die = (by: string): Came => ({
      outcome: "death",
      sentence: "banish",
      days: 730,
      came: by,
      cost: "Their life.",
    });
  switch (court.form) {
    case "reef":
      // (A people of the water builds no cell: the post, or the current.)
      return g >= 4 || v < 0.5
        ? exile(true)
        : {
            outcome: "turned",
            sentence: "stocks",
            days: 4 + Math.floor(u(h, 38) * 4),
            came: `was tied to the reef post for ${YEARS_WORD[4 + Math.floor(u(h, 38) * 4)]} days`,
            cost: "Those days' work, and everyone swam past.",
          };
    case "elders":
      return g >= 5 || v < 0.45
        ? exile(true)
        : {
            outcome: "turned",
            sentence: "shame",
            days: 1,
            came: "was named before the ring, and no one of the town may deal with them for a year",
            cost: "A year with no one's help, among people who all know why.",
          };
    case "kin": {
      // (Custom and vengeance: a price, the kin's own hand, or no law's keeping.)
      if (death && v < 0.4)
        return die(
          say([
            "was given over to the kin of the dead, and did not live",
            "was left to the kin of the dead, who took a life for a life",
          ]),
        );
      if (v < 0.7) {
        const worth = g * (20 + Math.floor(u(h, 39) * 40));
        return {
          outcome: "price",
          sentence: "fine",
          days: 1,
          came: `was made to pay a blood-price of ${YEARS_WORD[Math.round(worth / 30)] ?? Math.round(worth / 30)} months' ${court.food}`,
          cost: court.coined
            ? `${Math.round(worth * court.bread)} coin, ${worth} days' ${court.food} for one person, paid before the families.`
            : `${worth} days' ${court.food}, paid before the families.`,
        };
      }
      return {
        ...exile(true),
        came: "was put outside the law: no family need answer for what is done to them",
      };
    }
    case "magistrate":
      if (death && v < 0.5)
        return die(
          say([
            "was put to death at the ruler's word",
            "was condemned by the magistrate, and died for it",
            "was put to death before the town",
          ]),
        );
      if (court.strict && !court.far && court.grips && g >= 4 && u(h, 40) < 0.2)
        return {
          outcome: "maim",
          sentence: "stocks",
          days: 1,
          came: "was marked before the town, to be known by it for life, and let go",
          cost: "A mark they carry for life, that everyone can read.",
        };
      return court.convicts && v < 0.55 ? labour() : v < 0.86 ? gaol() : exile(true);
    default:
      // The bench: one law for all. Death only for the gravest, where their age still has it.
      if (death && d.offence !== "purge" && v < 0.2)
        return die(
          say([
            "was sentenced to death by the bench, and it was done",
            "was condemned by the bench, and died for it",
          ]),
        );
      return court.convicts && v < 0.35 ? labour() : v < 0.92 ? gaol() : exile(true);
  }
}

/** What each grave matter is called. */
export const GRAVE_NAMES: Readonly<Record<GraveOffence, string>> = {
  killing: "A killing",
  robbery: "Robbery with violence",
  kidnap: "Holding a person for a price",
  extort: "Taking pay by threat",
  contraband: "Selling what is forbidden",
  smuggle: "Going round the toll",
  bribe: "Taking pay to look away",
  banned: "Belonging to an outlawed circle",
  spy: "Spying for another realm",
  boss: "The head of a group, taken",
  crew: "A crew under the badge, found out",
  purge: "A great house brought down",
  bond: "Holding one bound past their debt",
  cruelty: "Cruelty to one bound",
  witch: "Named for a calamity",
  resist: "Sheltering those who resist",
};

/** What leads one of a town to each (rules/self.ts), where one of its lines stands. */
export const GRAVE_KIND: Readonly<Record<GraveOffence, CrimeKind>> = {
  killing: "harm",
  robbery: "harm",
  kidnap: "harm",
  extort: "steal",
  contraband: "cheat",
  smuggle: "cheat",
  bribe: "cheat",
  banned: "defy",
  spy: "defy",
  boss: "harm",
  crew: "cheat",
  purge: "defy",
  bond: "cheat",
  cruelty: "harm",
  witch: "defy",
  resist: "defy",
};

/** A killing no one answered for, in a few words: why no one was brought. */
export function unansweredWhy(d: Draft): string {
  if (d.group && d.hold >= 0.3)
    return `No one was brought. ${sentenceCase(d.group.name)} holds too much of the town for anyone to say who.`;
  if (d.group) return "No one was brought: those who did it were gone before the court's men came.";
  return "No one was brought: no one would say who.";
}
