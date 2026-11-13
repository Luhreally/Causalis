// A ruler ruled by the god's hand (Lives L4), as the page reads it: how they stand now, what they could decree, whom
// they could fight, whom their house could wed, and how their rule ended. Each option says what it would cost or
// why not, in the very words the world refuses it with. Pure reads: asking moves nothing, and nothing is kept
// but a memo of the last reading of a moment.
import { yearOfMoment, type Ref, type World } from "../kernel/index.ts";
import {
  FEMALE,
  REIGN,
  ROLE,
  decreeCost,
  plotOdds,
  warCost,
  type PeaceOffer,
} from "../rules/index.ts";
import {
  LAWS,
  LAW_OF,
  LAW_POSITIONS,
  LEADERSHIP,
  OFFERS,
  SUCCESSION,
  bondsOf,
  courtOf,
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
  riseProblem,
  stationOf,
  termsOfOffer,
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
import {
  ROLE_EVENTS,
  backProblem,
  plotProblem,
  proposalVoices,
  proposeProblem,
  roleHeld,
  roleStationOf,
  dangerOf,
  type CourtFigure,
  type Court,
  type RoleStation,
} from "../sim/index.ts";
import {
  ERRANDS,
  boundTo,
  envoyProblem,
  giftOf,
  misreadOf,
  tiesOf,
  type RulerErrand,
} from "../sim/index.ts";
import { aimPhrase, grainSum, termsPhrase } from "../causal/index.ts";
import type {
  ReignEnvoys,
  ReignBond,
  ReignDecrees,
  ReignFall,
  ReignLaw,
  ReignMatch,
  ReignMatches,
  ReignNow,
  ReignOffer,
  ReignPerson,
  ReignRole,
  ReignCourt,
  ReignWar,
  ReignWars,
} from "../bridge/index.ts";
import { dramaOf, titleOf as courtTitle } from "./court.ts";
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
    foeName = foe ? realmName(foe) : "a realm now gone",
    declared = world.events.get(w.event),
    aim = aimPhrase(
      world,
      declared?.data ?? null,
      declared?.place ?? null,
      mine === 0 ? "mine" : "theirs",
      landTitle(world, w.prize, true),
    );
  return {
    ref: w.ref,
    foe: foe?.ref ?? "",
    foeName,
    words: mine === 0 ? `You went to war ${aim}` : `They came ${aim}`,
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

/** What binds a realm since a peace, in a ruler's words: the oath they swore, those sworn to them, what they pay and are paid. */
export function bondLines(world: World, r: Polity): ReignBond[] {
  const realms = politiesOf(world),
    ctx = populationContext(world),
    rank: Readonly<Record<ReignBond["kind"], number>> = {
      oath: 0,
      vassal: 1,
      pays: 2,
      paid: 3,
      truce: 4,
    };
  return bondsOf(world)
    .of(r.ref)
    .map((b): ReignBond => {
      const mine = b.from === r.ref,
        other = realms.get(mine ? b.to : b.from),
        otherName = other ? realmName(other) : "a realm now gone",
        grain = grainSum(b.grain),
        paid = b.paid ? `; ${grainSum(b.paid)} paid so far` : "",
        short = b.short
          ? `, and ${mine ? "you have" : "they have"} been short ${b.short} year${b.short === 1 ? "" : "s"}`
          : "",
        kind: ReignBond["kind"] =
          b.kind === "truce"
            ? "truce"
            : b.kind === "vassal"
              ? mine
                ? "oath"
                : "vassal"
              : mine
                ? "pays"
                : "paid",
        words =
          kind === "truce"
            ? `A truce holds you and ${otherName} from war until year ${b.until}.`
            : kind === "oath"
              ? `You have bent the knee to ${otherName}: you keep your lands and your seat, ${b.grain ? `pay ${grain} grain a year out of your lands' stores, ` : "pay nothing, as you have nothing to spare, "}and make no war of your own, until year ${b.until}${paid}${short}.`
              : kind === "vassal"
                ? `${otherName} has bent the knee to you: it ${b.grain ? `pays ${grain} grain a year to your seat` : "has nothing to pay"} and makes no war of its own, until year ${b.until}${paid}${short}.`
                : kind === "pays"
                  ? `You pay ${otherName} ${grain} grain a year out of your lands' stores, until year ${b.until}${paid}${short}.`
                  : `${otherName} pays you ${grain} grain a year, to your seat's stores, until year ${b.until}${paid}${short}.`;
      if (kind !== "oath")
        return { kind, other: other?.ref ?? "", otherName, words, grain: b.grain, until: b.until };
      const why = riseProblem(ctx, r);
      return {
        kind,
        other: other?.ref ?? "",
        otherName,
        words,
        grain: b.grain,
        until: b.until,
        can: !why,
        why: why ?? "It breaks your oath, and it is war.",
      };
    })
    .sort((x, y) => rank[x.kind] - rank[y.kind] || (x.other < y.other ? -1 : 1));
}

/** What a ruler could offer or demand in a war, each with what it comes to, or the answer they would give. */
function offersOf(
  world: World,
  r: Polity,
  foe: Polity | undefined,
  w: War,
  channel = false,
): ReignOffer[] {
  if (!foe || foe.ended !== null || w.civil) return [];
  const ctx = populationContext(world),
    year = yearOfMoment(world.now),
    label = (offer: PeaceOffer, land: string, grain: string): string =>
      offer === "truce"
        ? "🕊️ Ask for peace, nothing changed"
        : offer === "give-land"
          ? `🕊️ Offer ${land}`
          : offer === "give-tribute"
            ? `🕊️ Offer ${grain} grain a year`
            : offer === "take-land"
              ? `⚖️ Demand ${land}`
              : offer === "take-tribute"
                ? `⚖️ Demand ${grain} grain a year`
                : "⚖️ Demand they bend the knee";
  return OFFERS.map((offer) => {
    const bad = peaceProblem(ctx, r, foe, offer, channel),
      made = termsOfOffer(ctx, w, r, foe, offer, year),
      land = made.land !== null ? landTitle(world, made.land, true) : "a land",
      terms = termsPhrase(world, { terms: made.terms });
    return {
      id: offer,
      label: label(offer, land, grainSum(made.grain)),
      can: !bad,
      words: bad ?? (terms ? `They would agree: ${terms}.` : "They would agree."),
    };
  });
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
      // (Who took it took it; only one who followed came to it by the realm's own rule: Lives L5.)
      tie:
        e?.type !== "polity.succession" || (data as { how?: string } | null)?.how === "claim"
          ? "who took the seat"
          : r.succession === 0
            ? "of the same house"
            : `come to it ${SUCCESSION[r.succession]}`,
    },
  };
}

/** Who a sheet is read for: the ruler, or one of a court (by number), and whether the god is in them. */
type As = { readonly fig: number | null; readonly channel: boolean };
const asOf = (args: unknown): As => {
  const a = args as { fig?: unknown; channel?: unknown } | null;
  return { fig: typeof a?.fig === "number" ? a.fig : null, channel: a?.channel === true };
};
/** The one of a court a sheet is read for (null: the ruler, or one gone). */
function heldFig(world: World, r: Polity, as: As): { c: Court; f: CourtFigure } | null {
  if (as.fig === null) return null;
  const c = courtOf(world)?.of(r.ref),
    f = c?.figures.find((x) => x.id === as.fig);
  return c && f ? { c, f } : null;
}

/** What one of a court can do, in a sentence: their part, their weight, whether the ruler hears them. */
function roleWords(r: Polity, f: CourtFigure, st: RoleStation): string {
  const weight = `${pct(st.sway + st.backing)} in a hundred of the realm's sway${st.backing ? ", with those behind you" : ""}`,
    part =
      st.kind === "general"
        ? `You hold the army's voice at court: the host is yours to turn, and you weigh ${weight}.`
        : st.kind === "heir"
          ? `You are heir to the seat of ${r.town}, and weigh ${weight}.`
          : st.kind === "rival"
            ? `You want the seat of ${r.town}, and weigh ${weight}.`
            : f.seat === "house"
              ? `You are of the ruler's house, and speak for no group at court.`
              : `You are the voice of ${f.seat} at court, and weigh ${weight}.`,
    say =
      st.sway + st.backing > 0
        ? st.heard
          ? ` You cannot decree: you put a thing to the realm, and it carries only if ${pct(ROLE.majority)} in a hundred of its voices do.`
          : ` ${r.ruler.name} rules alone and hears only those who weigh ${pct(ROLE.ear)} in a hundred: court a group to be heard.`
        : " Court a group, and it will speak through you.";
  return `${part}${say}`;
}

/** What the god in them lifts, in a line. */
const CHANNEL_WORDS =
  "🌟 The god is in them: their word carries past the voices, their standing and what others will hear, and is told as an omen. Nothing comes from nothing: no host where none can go, no land where none lies between.";
const MORTAL_WORDS = "🧍 As a mortal: everything is bounded by their station.";

const MEMO = new WeakMap<World, { key: string; now: ReignNow }>();

/** How the ruler stands now (null: no such realm). */
export function reignNow(
  world: World,
  realm: unknown,
  ruler: unknown,
  role: { fig: number; name: string } | null = null,
): ReignNow | null {
  const r = realmOf(world, realm);
  if (!r || typeof ruler !== "string") return null;
  const key = `${r.ref}|${ruler}|${role?.fig ?? ""}|${world.now}|${world.events.count}`,
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
    court = courtOf(world)?.of(r.ref),
    named = court?.figures.find((f) => f.id === court.heir),
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
    bonds: bondLines(world, r),
    heir: named
      ? `${named.name}, ${year - named.born}, ${court?.heirBy === "voices" ? "whom the voices lean to" : court?.heirBy === "word" ? "named by your word" : "your heir"}`
      : r.succession !== 0
        ? `Rule passes ${SUCCESSION[r.succession]}`
        : heir
          ? `${heir.name}, ${year - heir.born}, your eldest`
          : "No child living",
    spouse: spouse ? `${spouse.name}, ${year - spouse.born}` : null,
    told,
    fell,
    drama: fell || role ? null : dramaOf(world, r),
    role: role ? roleNow(world, r, role) : null,
  };
  MEMO.set(world, { key, now });
  return now;
}

/** One of a court as the bar reads them: who, what they are, what they can do; or how they left it. */
function roleNow(world: World, r: Polity, role: { fig: number; name: string }): ReignRole {
  const c = courtOf(world)?.of(r.ref),
    f = c?.figures.find((x) => x.id === role.fig && x.name === role.name),
    year = yearOfMoment(world.now);
  if (!c || !f || r.ended !== null) {
    const gone = c?.gone.find((g) => g.id === role.fig),
      seated = r.ended === null && r.ruler.name === role.name,
      how = r.ended !== null ? "fell" : seated ? "seated" : (gone?.how ?? "stood down"),
      words =
        how === "fell"
          ? `${realmName(r)} has fallen, and its court with it.`
          : seated
            ? `${role.name} holds the seat of ${r.town} now.`
            : how === "died"
              ? `${role.name} has died.`
              : how === "found"
                ? `${role.name}'s move was found: they are gone from the court.`
                : how === "fled"
                  ? `${role.name} fled the court, and raised the far lands.`
                  : `${role.name} has left the court.`;
    return {
      fig: role.fig,
      name: role.name,
      title: "",
      kind: "voice",
      age: 0,
      sway: 0,
      words,
      ref: `court:${r.ref}:${role.fig}`,
      gone: { how, words, seated, event: gone?.event ?? (seated ? r.ruler.event : null) },
    };
  }
  const st = roleStationOf(populationContext(world), r, c, f);
  return {
    fig: f.id,
    name: f.name,
    title: courtTitle(r, c, f),
    kind: st.kind,
    age: year - f.born,
    sway: st.sway + st.backing,
    words: roleWords(r, f, st),
    ref: `court:${r.ref}:${f.id}`,
    gone: null,
  };
}

/** What they could decree, or put to the realm. */
function reignDecrees(
  world: World,
  realm: unknown,
  as: As = { fig: null, channel: false },
): ReignDecrees | null {
  const r = realmOf(world, realm),
    o = r ? orderOf(world)?.of(r.ref) : null;
  if (!r) return null;
  const ctx = populationContext(world),
    t = world.now,
    st = stationOf(ctx, r),
    held = heldFig(world, r, as),
    rs = held ? roleStationOf(ctx, r, held.c, held.f) : null,
    word = (cost: number, against: number) =>
      `${held ? "Costs the realm" : "Costs"} ${pct(cost)} in a hundred of ${held ? "its" : "your"} standing${against > 0.02 && st.beyond.length ? `; ${st.beyond.length} lands past ${held ? "the seat's" : "your"} reach will chafe` : ""}.`,
    /** Why it could not be done, as the one held would be told (null: it can). */
    why = (law: Law | "tithe", to: number): string | null =>
      held
        ? proposeProblem(ctx, r, held.c, held.f, {
            what: law === "tithe" ? "tithe" : "law",
            ...(law === "tithe" ? {} : { law }),
            to,
            channel: as.channel,
          })
        : decreeProblem(ctx, r, law, to, t, as.channel),
    /** The voices as they would stand, the one held counted for it. */
    voicesFor = (law: Law | "tithe", to: number) =>
      held && rs
        ? (proposalVoices(ctx, r, rs, {
            what: law === "tithe" ? "tithe" : "law",
            ...(law === "tithe" ? {} : { law }),
            to,
          }) ?? (law === "tithe" ? titheVoices(ctx, r, to, t) : lawVoices(ctx, r, o!, law, to, t)))
        : law === "tithe"
          ? titheVoices(ctx, r, to, t)
          : lawVoices(ctx, r, o!, law, to, t),
    laws: ReignLaw[] = [];
  if (o)
    for (const law of LAWS) {
      const k = LAW_OF[law],
        now = o.laws[k]!,
        options = [now - 1, now + 1]
          .filter((to) => to >= 0 && to <= 2)
          .map((to) => {
            const bad = why(law, to),
              v = voicesFor(law, to);
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
  // (What leaves and comes to the seat's stores by a peace, as it is spent: W7.)
  const bound = bondLines(world, r),
    owes = bound
      .filter((b) => b.kind === "oath" || b.kind === "pays")
      .reduce((n, b) => n + b.grain, 0),
    owed = bound
      .filter((b) => b.kind === "vassal" || b.kind === "paid")
      .reduce((n, b) => n + b.grain, 0),
    spends = `${owes ? ` You pay ${grainSum(owes)} grain a year in tribute out of your lands' stores.` : ""}${owed ? ` You are paid ${grainSum(owed)} grain a year in tribute.` : ""}`;
  const tithe = Math.round(r.tribute * 100),
    steps = [tithe - REIGN.titheStep, tithe + REIGN.titheStep].filter(
      (to) => to >= REIGN.titheLeast && to <= REIGN.titheMost,
    );
  laws.push({
    law: "tithe",
    title: "The tithe of grain to the seat",
    now: `${tithe} parts in a hundred`,
    options: steps.map((to) => {
      const bad = why("tithe", to),
        v = voicesFor("tithe", to);
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
  const mode = as.channel ? `${CHANNEL_WORDS} ` : "";
  if (held && rs)
    return {
      words: `${mode}${roleWords(r, held.f, rs)} ${pct(st.legitimacy)} in a hundred hold ${r.ruler.name}'s rule rightful.${spends}`,
      laws,
    };
  return {
    words: `${mode}${stationWords(st)} ${pct(st.legitimacy)} in a hundred hold your rule rightful.${spends} What you set is weighed again by the realm in its turn.`,
    laws,
  };
}

/** Those a foe would call, if it were attacked, in words (D1). */
function calledWords(world: World, foe: Polity): string {
  const year = yearOfMoment(world.now),
    realms = politiesOf(world),
    names = boundTo(world, foe, year)
      .flatMap((b) => {
        const q = realms.get(b.realm);
        return q && q.ended === null ? [q.town] : [];
      })
      .slice(0, 3);
  return names.length ? ` They would call ${names.join(", ")}.` : "";
}

/** Whom they fight, and whom they could. */
function reignWars(
  world: World,
  realm: unknown,
  as: As = { fig: null, channel: false },
): ReignWars | null {
  const r = realmOf(world, realm);
  if (!r) return null;
  const held = heldFig(world, r, as),
    ties = tiesOf(world),
    year0 = yearOfMoment(world.now),
    /** What they believe of a foe's host, and what the foe knows of theirs. */
    knownOf = (foe: Polity): string => {
      const truth = fieldedOf(populationContext(world), foe),
        mine = misreadOf(world, r.ref, foe.ref, year0);
      return `You believe their host is about ${many(Math.round(truth * mine))}${ties.embassyOf(r.ref, foe.ref) ? ", and your people at their seat keep it true" : ""}. ${ties.embassyOf(foe.ref, r.ref) ? "Their people at your seat know your host truly." : "They know your host only by rumour."}`;
    };
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
          standingFoe = foe && foe.ended === null ? foe : null,
          bad = held
            ? proposeProblem(ctx, r, held.c, held.f, {
                what: "peace",
                against: line.foe as Ref,
                channel: as.channel,
              })
            : peaceProblem(ctx, r, standingFoe, "truce", as.channel);
        // (One of a court can only put a truce to the realm; the ruler offers or demands.)
        const offers = held
          ? standingFoe && !w.civil
            ? [
                {
                  id: "truce",
                  label: "🕊️ Put a truce to the realm",
                  can: !bad,
                  words: bad ?? "They would hear it, and the realm would make it.",
                },
              ]
            : []
          : offersOf(world, r, standingFoe ?? undefined, w, as.channel);
        return {
          ...line,
          can: !bad,
          peace: bad ?? "They will hear of it.",
          offers,
        };
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
          bad = held
            ? proposeProblem(ctx, r, held.c, held.f, {
                what: "war",
                against: foe.ref,
                channel: as.channel,
              })
            : warProblem(ctx, r, foe, undefined, t, as.channel),
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
              `Your ${many(host)} against their ${many(theirs)}. Costs ${pct(warCost(!!regard?.pact, opinion < 0))} in a hundred of your standing${regard?.pact ? ", and breaks your pact" : ""}.${v.names.length && v.against > v.forIt ? ` ${v.names.join(" and ")} would rather not.` : ""}${calledWords(world, foe)}`,
            aims: lands.slice(0, 3).map((cell) => ({ cell, name: landTitle(world, cell, true) })),
            known: knownOf(foe),
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
      .map((w) => {
        const said = w.peace ? termsPhrase(world, world.events.get(w.peace)?.data ?? null) : null;
        return {
          ...warLine(world, r, w),
          came: said
            ? `Over in year ${w.ended}: ${said}.`
            : `Over in year ${w.ended}: ${
                r.members.includes(w.prize) === (w.attacker === r.ref)
                  ? w.attacker === r.ref
                    ? `you took ${landTitle(world, w.prize, true)}`
                    : `you held ${landTitle(world, w.prize, true)}`
                  : w.attacker === r.ref
                    ? `${landTitle(world, w.prize, true)} is not yours`
                    : `${landTitle(world, w.prize, true)} is lost`
              }.`,
        };
      });
  return {
    words: `${as.channel ? `${CHANNEL_WORDS} ` : ""}${held ? `You cannot make war or peace yourself: you put it to the realm, and it carries only if its voices do. ` : ""}${held ? "The realm" : "You"} can field ${many(host)} of ${held ? "its" : "your"} ${many(people)} people.${
      foes.length ? "" : wars.length ? "" : " No realm lies within reach."
    }`,
    host,
    wars,
    bonds: bondLines(world, r),
    lately,
    foes,
  };
}

/** Whom their house could wed. */
function reignMatches(world: World, realm: unknown, channel = false): ReignMatches | null {
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
      const bad = wedProblem(ctx, r, other, who, partner, channel),
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

/** Whom they could send to, and what for. */
function reignEnvoys(world: World, realm: unknown, channel = false): ReignEnvoys | null {
  const r = realmOf(world, realm);
  if (!r) return null;
  const ctx = populationContext(world),
    diplomacy = diplomacyOf(world),
    realms = politiesOf(world),
    ties = tiesOf(world),
    met = diplomacy
      .of(r.ref)
      .flatMap((x) => {
        const q = realms.get(x.a === r.ref ? x.b : x.a);
        return q && q.ended === null ? [{ q, x }] : [];
      })
      .sort((a, b) => b.x.opinion - a.x.opinion || (a.q.ref < b.q.ref ? -1 : 1))
      .slice(0, 8);
  const year = yearOfMoment(world.now),
    gift = giftOf(ctx, r);
  return {
    words: met.length
      ? `Your envoys go by road to their seats. Word kept at a seat makes what you know of its host the truer; ${ties.embassiesOf(r.ref).length} of yours stand at others' seats now.`
      : "No border or road lies between you and anyone: no one could reach them.",
    realms: met.map(({ q, x }) => {
      const factor = misreadOf(world, r.ref, q.ref, year),
        truth = fieldedOf(ctx, q);
      return {
        ref: q.ref,
        name: realmName(q),
        regard: x.pact
          ? "sworn to you by a pact"
          : x.opinion < -0.4
            ? "your rivals"
            : x.opinion < 0
              ? "wary of you"
              : "at peace with you",
        known: `You believe their host is about ${many(Math.round(truth * factor))}.${ties.embassyOf(r.ref, q.ref) ? " Your people there keep it true." : " No one of yours is there to say."}`,
        errands: ERRANDS.map((errand: RulerErrand) => {
          const bad = envoyProblem(ctx, r, q, errand, channel);
          return {
            errand,
            label:
              errand === "embassy"
                ? "📜 Keep a house at their seat"
                : errand === "pact"
                  ? "🤝 Ask a pact"
                  : gift > 0
                    ? `🌾 Send a gift of ${grainSum(gift)} grain`
                    : "🌾 Send a gift",
            can: !bad,
            words:
              bad ??
              (errand === "embassy"
                ? "They will take them in, and you will know their host the truer."
                : errand === "pact"
                  ? "They will swear. If either of you is attacked, the other will be called."
                  : "They will think the better of you, fading as memories fade."),
          };
        }),
      };
    }),
  };
}

/** One of a court's own sheet: the groups they could court to stand behind them, and a move on the seat. */
function reignCourt(world: World, realm: unknown, as: As): ReignCourt | null {
  const r = realmOf(world, realm),
    held = r ? heldFig(world, r, as) : null;
  if (!r || !held) return null;
  const ctx = populationContext(world),
    { c, f } = held,
    st = roleStationOf(ctx, r, c, f),
    o = orderOf(world)?.of(r.ref),
    d = o ? dangerOf(ctx, r, c, f, o) : null,
    odds = d ? plotOdds(d.weight, d.doubt, d.tradition) : 0,
    bad = plotProblem(ctx, r, c, f, as.channel),
    army = f.seat === "the army";
  return {
    words: `${as.channel ? `${CHANNEL_WORDS} ` : ""}${roleWords(r, f, st)}`,
    groups: st.groups.map((g) => {
      const why = backProblem(ctx, r, c, f, g.group, as.channel);
      return {
        group: g.group,
        label: `🤝 Court ${g.group}`,
        can: !why,
        behind: g.behind,
        words: g.behind
          ? `${g.group[0]!.toUpperCase()}${g.group.slice(1)} stand behind you: ${pct(g.sway)} in a hundred of the realm's sway is yours to put things with.`
          : (why ??
            `They hold ${pct(g.sway)} in a hundred of the realm's sway, and will stand behind you: what you put to the realm carries with them, and a move on the seat weighs the more.`),
      };
    }),
    plot: {
      label: army ? "⚔️ Turn the host on the seat" : `🗡️ Move on the seat of ${r.town}`,
      can: !bad,
      odds: as.channel ? 1 : odds,
      words:
        bad ??
        (as.channel
          ? `It carries: the god's will through you takes the seat from ${r.ruler.name} within the year.`
          : `By the numbers ${pct(odds)} in a hundred it takes the seat from ${r.ruler.name} within the year; if it fails you are found, and dead or fled.${army ? " The army goes with you, or turns on you." : ""}`),
    },
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
  "reign.now": (world, args) => {
    const a = args as RealmArgs & { fig?: unknown; name?: unknown };
    return reignNow(
      world,
      a.realm,
      a.ruler,
      typeof a.fig === "number" && typeof a.name === "string" ? { fig: a.fig, name: a.name } : null,
    );
  },
  /** What they could decree, or put to the realm as one of its court; channelled or not. */
  "reign.decrees": (world, args) => reignDecrees(world, (args as RealmArgs).realm, asOf(args)),
  /** Whom they fight and whom they could. */
  "reign.wars": (world, args) => reignWars(world, (args as RealmArgs).realm, asOf(args)),
  /** Whom their house could wed. */
  "reign.matches": (world, args) =>
    reignMatches(world, (args as RealmArgs).realm, asOf(args).channel),
  /** Whom they could send an envoy to (D1). */
  "reign.envoys": (world, args) =>
    reignEnvoys(world, (args as RealmArgs).realm, asOf(args).channel),
  /** One of a court's own: the groups to court, a move on the seat. */
  "reign.court": (world, args) => reignCourt(world, (args as RealmArgs).realm, asOf(args)),
  /** What has been done by a ruler's word in a realm. */
  "reign.deeds": (world, args) => reignDeeds(world, (args as RealmArgs).realm),
};
