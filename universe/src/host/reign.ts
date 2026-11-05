// A ruler ruled by the god's hand (Lives L4), as the page reads it: how they stand now, what they could decree, whom
// they could fight, whom their house could wed, and how their rule ended. Each option says what it would cost or
// why not, in the very words the world refuses it with. Pure reads: asking moves nothing, and nothing is kept
// but a memo of the last reading of a moment.
import { yearOfMoment, type Ref, type World } from "../kernel/index.ts";
import { FEMALE, REIGN, decreeCost, warCost } from "../rules/index.ts";
import {
  LAWS,
  LAW_OF,
  LAW_POSITIONS,
  LEADERSHIP,
  SUCCESSION,
  decreeProblem,
  diplomacyOf,
  fieldedOf,
  frontier,
  lawVoices,
  orderOf,
  peaceProblem,
  politiesOf,
  populationContext,
  realmName,
  stationOf,
  tieBetween,
  titheVoices,
  warProblem,
  warVoices,
  warsOf,
  wedProblem,
  type Law,
  type Polity,
  type Station,
  type War,
} from "../sim/index.ts";
import type {
  ReignDecrees,
  ReignFall,
  ReignLaw,
  ReignMatch,
  ReignMatches,
  ReignNow,
  ReignPerson,
  ReignWar,
  ReignWars,
} from "../bridge/index.ts";
import { familyOf, type Family } from "./kin.ts";
import { seatTownOf } from "./leaders.ts";
import { wealthBook } from "./wealth.ts";
import { bare, claimOf } from "./inspect/words.ts";
import { landTitle } from "./inspect/names.ts";
import type { QueryHandler } from "./host.ts";

const pct = (x: number) => Math.round(x * 100);
/** How many years back a war over is still told in the sheet. */
const LATELY = 5;
const realmOf = (world: World, ref: unknown): Polity | undefined =>
  typeof ref === "string" ? politiesOf(world).get(ref as Ref) : undefined;
/** A number of people, as a phone has room for it. */
const many = (n: number) =>
  n >= 1e6
    ? `${(n / 1e6).toFixed(1)}M`
    : n >= 1e4
      ? `${Math.round(n / 1000)}k`
      : `${Math.round(n)}`;

const LAW_TITLES: Readonly<Record<Law, string>> = {
  land: "Who owns the land",
  strangers: "What strangers are",
  faith: "What the faith asks",
  justice: "Whose justice",
};

/** What they are called, by who leads there: nothing more than the world's own words. */
function titleOf(r: Polity): string {
  const lead = LEADERSHIP[r.leadership]!,
    shared = lead === "council of elders" || lead === "assembly";
  return `${shared ? `head of the ${lead}` : lead} of ${r.town}`;
}

/** What their station comes to, in a sentence. */
function stationWords(st: Station): string {
  const answered =
      st.carry > 0
        ? `You hold your seat by others' leave: you must carry ${pct(st.carry)} in a hundred of the realm's voices.`
        : "Rule is yours alone: your word is answered at once.",
    held =
      st.legitimacy < REIGN.wordLine
        ? ` Only ${pct(st.legitimacy)} in a hundred hold your rule rightful: your word stops at the seat's door.`
        : st.beyond.length
          ? ` ${st.beyond.length} of your ${st.lands} lands lie past the seat's reach, and chafe at a word they did not want.`
          : "",
    written = st.writes ? "" : " Nothing is written here: custom is the law.";
  return `${answered}${held}${written}`;
}

/** The people of a realm, its lands' mean grievance by them. */
function peopleOf(world: World, r: Polity): { people: number; unrest: number } {
  const ctx = populationContext(world),
    realms = politiesOf(world);
  let people = 0,
    sore = 0;
  for (const c of r.members) {
    const n = ctx.provinces.get(c)?.total() ?? 0;
    people += n;
    sore += n * Math.min(1, realms.discontent(c).level);
  }
  return { people, unrest: people ? sore / people : 0 };
}

/** A war as its ruler reads it. */
function warLine(world: World, r: Polity, w: War): ReignWar {
  const mine = w.attacker === r.ref ? 0 : 1,
    foe = politiesOf(world).get(mine === 0 ? w.defender : w.attacker),
    last = w.battles.at(-1),
    place = last ? landTitle(world, last.land, true) : "",
    foeName = foe ? realmName(foe) : "a realm now gone";
  return {
    ref: w.ref,
    foe: foe?.ref ?? "",
    foeName,
    words:
      mine === 0
        ? `You went to war for ${landTitle(world, w.prize, true)}`
        : `They came for ${landTitle(world, w.prize, true)}`,
    since: w.declared,
    fallen: [w.fallen[mine]!, w.fallen[1 - mine]!],
    battles: w.battles.length,
    last: last
      ? {
          ref: last.event,
          words: `Battle at ${place}, year ${last.year}: ${last.won === (mine === 0) ? "you won" : "you lost"}`,
        }
      : null,
  };
}

/** The family a ruler's page tells. */
const familyAt = (world: World, r: Polity): Family | null => familyOf(world, `rule:${r.ref}`);

/** Those of a house living, who could be wed: its ruler if free, then its grown children not wed, eldest first. */
function freeOf(world: World, r: Polity): { people: ReignPerson[]; ruler: boolean } {
  const f = familyAt(world, r),
    year = yearOfMoment(world.now),
    grown = populationContext(world).life.adulthood,
    matches = orderOf(world)?.of(r.ref)?.matches ?? [],
    wed = (name: string) => matches.some((m) => m.who === name),
    out: ReignPerson[] = [];
  const living = f?.spouse && f.spouse.died === null;
  if (!living && !wed(r.ruler.name) && year - r.ruler.born >= grown)
    out.push({ name: r.ruler.name, sex: r.ruler.sex, born: r.ruler.born, tie: "self" });
  for (const k of [...(f?.children ?? [])].sort((a, b) => a.born - b.born))
    if (k.died === null && year - k.born >= grown && !wed(k.name))
      out.push({ name: k.name, sex: k.sex, born: k.born, tie: k.tie });
  return { people: out, ruler: !living && !wed(r.ruler.name) };
}

/** How their rule ended, in words: null while they rule. */
function fallOf(world: World, r: Polity | undefined, ruler: string): ReignFall | null {
  if (!r) return null;
  if (r.ended === null && r.ruler.name === ruler) return null;
  if (r.ended !== null)
    return {
      how: "realm",
      title: `${realmName(r)} has fallen`,
      words: `${ruler} ruled it to its end, in year ${r.ended}. There is no seat to go on from.`,
      event: null,
      heir: null,
    };
  const year = yearOfMoment(world.now),
    e = world.events.get(r.ruler.event),
    data = e?.data as { old?: string; age?: number } | null | undefined,
    died = e?.type === "polity.succession" && data?.old === ruler,
    told = bare(claimOf(world, r.ruler.event));
  return {
    how: died ? "died" : "overthrown",
    title: died ? `${ruler} has died` : `${ruler} rules no more`,
    words: died
      ? `${ruler} died at ${data?.age ?? "a great age"}, and ${r.ruler.name} holds the seat of ${r.town}.`
      : `${told}. ${r.ruler.name} holds the seat of ${r.town}.`,
    event: e?.id ?? null,
    heir: {
      name: r.ruler.name,
      age: year - r.ruler.born,
      tie: r.succession === 0 ? "of the same house" : `come to it ${SUCCESSION[r.succession]}`,
    },
  };
}

const MEMO = new WeakMap<World, { key: string; now: ReignNow }>();

/** How the ruler stands now (null: no such realm). */
export function reignNow(world: World, realm: unknown, ruler: unknown): ReignNow | null {
  const r = realmOf(world, realm);
  if (!r || typeof ruler !== "string") return null;
  const key = `${r.ref}|${ruler}|${world.now}|${world.events.count}`,
    hit = MEMO.get(world);
  if (hit?.key === key) return hit.now;
  const ctx = populationContext(world),
    year = yearOfMoment(world.now),
    st = stationOf(ctx, r),
    { people, unrest } = peopleOf(world, r),
    book = wealthBook(world),
    me = book.realms.find((x) => x.ref === r.ref),
    fell = fallOf(world, r, ruler),
    met = diplomacyOf(world)
      .of(r.ref)
      .map((x) => (x.a === r.ref ? x.b : x.a)),
    rows = book.realms.filter((x) => met.includes(x.ref as Ref) && !x.few),
    near = [...rows].sort((a, b) => b.people - a.people || (a.ref < b.ref ? -1 : 1)).slice(0, 3),
    family = fell ? null : familyAt(world, r),
    spouse = family?.spouse && family.spouse.died === null ? family.spouse : null,
    heir = [...(family?.children ?? [])]
      .filter((k) => k.died === null)
      .sort((a, b) => a.born - b.born)[0],
    told: { year: number; words: string; ref: string }[] = [],
    events = world.events.all();
  for (let i = events.length - 1; i >= 0 && told.length < 4 && i > events.length - 4000; i--) {
    const e = events[i]!;
    if (e.importance >= 3 && e.subjects.includes(r.ref))
      told.push({ year: yearOfMoment(e.t), words: bare(claimOf(world, e.id)), ref: e.id });
  }
  const now: ReignNow = {
    realm: r.ref,
    realmName: realmName(r),
    ruler: fell ? ruler : r.ruler.name,
    rulerRef: `rule:${r.ref}`,
    age: year - r.ruler.born,
    since: r.ruler.since,
    title: titleOf(r),
    town: seatTownOf(world, r)?.ref ?? null,
    station: stationWords(st),
    carry: st.carry,
    people,
    lands: r.members.length,
    beyond: st.beyond.length,
    host: Math.round(fieldedOf(ctx, r)),
    legitimacy: st.legitimacy,
    unrest,
    tithe: Math.round(r.tribute * 100),
    head: me?.head ?? 0,
    rank: me?.rankHead ?? 0,
    of: book.realms.length,
    neighbours: near.map((x) => ({
      ref: x.ref,
      short: x.short,
      head: x.head,
      people: x.people,
      color: x.color,
    })),
    wars: warsOf(world)
      .fighting(r.ref)
      .filter((w) => w.ended === null)
      .map((w) => warLine(world, r, w)),
    heir:
      r.succession !== 0
        ? `Rule passes ${SUCCESSION[r.succession]}`
        : heir
          ? `${heir.name}, ${year - heir.born}, your eldest`
          : "No child living",
    spouse: spouse ? `${spouse.name}, ${year - spouse.born}` : null,
    told,
    fell,
  };
  MEMO.set(world, { key, now });
  return now;
}

/** What they could decree. */
function reignDecrees(world: World, realm: unknown): ReignDecrees | null {
  const r = realmOf(world, realm),
    o = r ? orderOf(world)?.of(r.ref) : null;
  if (!r) return null;
  const ctx = populationContext(world),
    t = world.now,
    st = stationOf(ctx, r),
    word = (cost: number, against: number) =>
      `Costs ${pct(cost)} in a hundred of your standing${against > 0.02 && st.beyond.length ? `; ${st.beyond.length} lands past your reach will chafe` : ""}.`,
    laws: ReignLaw[] = [];
  if (o)
    for (const law of LAWS) {
      const k = LAW_OF[law],
        now = o.laws[k]!,
        options = [now - 1, now + 1]
          .filter((to) => to >= 0 && to <= 2)
          .map((to) => {
            const bad = decreeProblem(ctx, r, law, to, t),
              v = lawVoices(ctx, r, o, law, to, t);
            return {
              to,
              label: LAW_POSITIONS[law][to]!,
              can: !bad,
              words:
                bad ??
                `${word(decreeCost(v.against), v.against)}${v.names.length ? ` ${v.names.join(" and ")} stand against it.` : ""}`,
            };
          });
      laws.push({ law, title: LAW_TITLES[law], now: LAW_POSITIONS[law][now]!, options });
    }
  const tithe = Math.round(r.tribute * 100),
    steps = [tithe - REIGN.titheStep, tithe + REIGN.titheStep].filter(
      (to) => to >= REIGN.titheLeast && to <= REIGN.titheMost,
    );
  laws.push({
    law: "tithe",
    title: "The tithe of grain to the seat",
    now: `${tithe} parts in a hundred`,
    options: steps.map((to) => {
      const bad = decreeProblem(ctx, r, "tithe", to, t),
        v = titheVoices(ctx, r, to, t);
      return {
        to,
        label: `${to < tithe ? "Lighter" : "Heavier"}: ${to} in a hundred`,
        can: !bad,
        words:
          bad ??
          `${word(decreeCost(v.against), v.against)}${v.names.length ? ` ${v.names.join(" and ")} want otherwise.` : ""}`,
      };
    }),
  });
  return {
    words: `${stationWords(st)} ${pct(st.legitimacy)} in a hundred hold your rule rightful. What you set is weighed again by the realm in its turn.`,
    laws,
  };
}

/** Whom they fight, and whom they could. */
function reignWars(world: World, realm: unknown): ReignWars | null {
  const r = realmOf(world, realm);
  if (!r) return null;
  const ctx = populationContext(world),
    t = world.now,
    diplomacy = diplomacyOf(world),
    realms = politiesOf(world),
    host = Math.round(fieldedOf(ctx, r)),
    { people } = peopleOf(world, r),
    wars = warsOf(world)
      .fighting(r.ref)
      .filter((w) => w.ended === null)
      .map((w) => {
        const line = warLine(world, r, w),
          foe = realms.get(line.foe as Ref),
          bad = peaceProblem(ctx, r, foe && foe.ended === null ? foe : null);
        return { ...line, can: !bad, peace: bad ?? "They will hear of it." };
      }),
    fighting = new Set(wars.map((w) => w.foe)),
    met = diplomacy.of(r.ref).map((x) => (x.a === r.ref ? x.b : x.a)),
    foes = met
      .flatMap((ref) => {
        const foe = realms.get(ref);
        if (!foe || foe.ended !== null || fighting.has(ref)) return [];
        const lands = frontier(ctx, r, foe);
        if (!lands.length) return [];
        const regard = diplomacy.get(r.ref, foe.ref),
          opinion = regard?.opinion ?? 0,
          bad = warProblem(ctx, r, foe, undefined, t),
          v = warVoices(ctx, r, foe, t),
          theirs = Math.round(fieldedOf(ctx, foe));
        return [
          {
            ref: foe.ref,
            name: realmName(foe),
            host: theirs,
            opinion,
            regard: regard?.pact
              ? "sworn to you by a pact"
              : opinion < -0.4
                ? "your rivals"
                : opinion < 0
                  ? "wary of you"
                  : "at peace with you",
            can: !bad,
            words:
              bad ??
              `Your ${many(host)} against their ${many(theirs)}. Costs ${pct(warCost(!!regard?.pact, opinion < 0))} in a hundred of your standing${regard?.pact ? ", and breaks your pact" : ""}.${v.names.length && v.against > v.forIt ? ` ${v.names.join(" and ")} would rather not.` : ""}`,
            aims: lands.slice(0, 3).map((cell) => ({ cell, name: landTitle(world, cell, true) })),
          },
        ];
      })
      .sort((a, b) => a.opinion - b.opinion || (a.ref < b.ref ? -1 : 1))
      .slice(0, 8),
    year = yearOfMoment(t),
    lately = warsOf(world)
      .hotOf(r.ref)
      .filter((w) => w.ended !== null && w.ended >= year - LATELY)
      .slice(-4)
      .reverse()
      .map((w) => ({
        ...warLine(world, r, w),
        came: `Over in year ${w.ended}: ${
          r.members.includes(w.prize) === (w.attacker === r.ref)
            ? w.attacker === r.ref
              ? `you took ${landTitle(world, w.prize, true)}`
              : `you held ${landTitle(world, w.prize, true)}`
            : w.attacker === r.ref
              ? `${landTitle(world, w.prize, true)} is not yours`
              : `${landTitle(world, w.prize, true)} is lost`
        }.`,
      }));
  return {
    words: `You can field ${many(host)} of your ${many(people)} people.${
      foes.length ? "" : wars.length ? "" : " No realm lies within your reach."
    }`,
    host,
    wars,
    lately,
    foes,
  };
}

/** Whom their house could wed. */
function reignMatches(world: World, realm: unknown): ReignMatches | null {
  const r = realmOf(world, realm);
  if (!r) return null;
  const ctx = populationContext(world),
    diplomacy = diplomacyOf(world),
    realms = politiesOf(world),
    mine = freeOf(world, r),
    matches: ReignMatch[] = [];
  let met = 0,
    bars = "";
  for (const relation of diplomacy.of(r.ref)) {
    const other = realms.get(relation.a === r.ref ? relation.b : relation.a);
    if (!other || other.ended !== null) continue;
    met++;
    const theirs = freeOf(world, other);
    // (L3's limit binds: the two must be of different sexes; L5 fixes the kin words first.)
    let found = false;
    for (const who of mine.people) {
      const partner = theirs.people.find((p) => p.sex !== who.sex);
      if (!partner) continue;
      const bad = wedProblem(ctx, r, other, who, partner),
        tie = tieBetween(world, r, other);
      found = true;
      matches.push({
        to: other.ref,
        toName: realmName(other),
        who,
        partner,
        can: !bad,
        words:
          bad ??
          `What your realms think of each other goes from ${relation.opinion.toFixed(2)} to ${Math.min(1, relation.opinion + tie).toFixed(2)}, fading as memories fade. Under ${(-0.4).toFixed(2)} they are rivals; over 0.40 they swear a pact.`,
        opinion: relation.opinion,
        after: Math.min(1, relation.opinion + tie),
      });
      break;
    }
    if (!found && !bars)
      bars = mine.people.length ? "No one of the other sex is free in the houses you meet." : "";
  }
  matches.sort((a, b) => Number(b.can) - Number(a.can) || b.opinion - a.opinion);
  const sex = (p: ReignPerson) => (p.sex === FEMALE ? "she" : "he"),
    who = mine.people[0];
  return {
    words: !mine.people.length
      ? "No one of your house is free to wed: you are wed, and no child of yours is grown and free."
      : !met
        ? "Your house has met no other: no border or road lies between you and anyone."
        : !matches.length
          ? bars || "No one suits in the houses you meet."
          : `${who!.tie === "self" ? "You are free to wed" : `${who!.name}, your ${who!.tie}, is free: ${sex(who!)} could be wed`}. A marriage ties two houses: it moves what your realms think of each other, which is what war and pacts read.`,
    matches: matches.slice(0, 8),
  };
}

/** What has been done by a ruler's word in a realm, oldest first: an event's type, its causes, whose word it was. */
function reignDeeds(
  world: World,
  realm: unknown,
): { type: string; causes: string[]; by: string }[] {
  const r = realmOf(world, realm);
  if (!r) return [];
  return world.events.all().flatMap((e) => {
    const by = (e.data as { by?: unknown } | null)?.by;
    return typeof by === "string" && e.subjects.includes(r.ref)
      ? [{ type: e.type, causes: e.causes.map((c) => c.ref), by }]
      : [];
  });
}

type RealmArgs = { realm?: unknown; ruler?: unknown };

export const REIGN_QUERIES: Readonly<Record<string, QueryHandler>> = {
  /** How a ruler stands, and how their rule ended (null: no such realm). */
  "reign.now": (world, args) =>
    reignNow(world, (args as RealmArgs).realm, (args as RealmArgs).ruler),
  /** What they could decree. */
  "reign.decrees": (world, args) => reignDecrees(world, (args as RealmArgs).realm),
  /** Whom they fight and whom they could. */
  "reign.wars": (world, args) => reignWars(world, (args as RealmArgs).realm),
  /** Whom their house could wed. */
  "reign.matches": (world, args) => reignMatches(world, (args as RealmArgs).realm),
  /** What has been done by a ruler's word in a realm. */
  "reign.deeds": (world, args) => reignDeeds(world, (args as RealmArgs).realm),
};
