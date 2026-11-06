// Lives L5: a court as the page reads it. Its people as a realm's figures (each with a page and a home, each to be taken
// as L1 and L3 take anyone), what each wants and why, every reason a number history already holds, and what a ruler
// played by the god's hand can answer when a plot comes or an heir dies. Pure reads: asking moves nothing, nothing is kept.
import { yearOfMoment, type Ref, type World } from "../kernel/index.ts";
import {
  COURT,
  OCC,
  REIGN,
  fearOf,
  fleeChance,
  mjWords,
  seizeCost,
  weightOf,
} from "../rules/index.ts";
import {
  WAY,
  byBlood,
  courtOf,
  cultureOf,
  dangerOf,
  interestsOf,
  orderOf,
  politiesOf,
  populationContext,
  realmName,
  type Court,
  type CourtFigure,
  type GoneFigure,
  type Polity,
  answerCost,
  fireOf,
} from "../sim/index.ts";
import type { Leader, ReignDrama } from "../bridge/index.ts";
import { bare, claimOf } from "./inspect/words.ts";
import { seatTownOf } from "./leaders.ts";

const pct = (x: number) => Math.round(x * 100);
const he = (sex: number) => (sex === 0 ? "she" : "he");
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** A figure's page. */
export const courtRef = (realm: string, id: number): string => `court:${realm}:${id}`;

/** A figure's page, read back (null: not one). */
export function parseCourtRef(ref: string): { realm: string; id: number } | null {
  if (!ref.startsWith("court:")) return null;
  const at = ref.lastIndexOf(":"),
    id = Number(ref.slice(at + 1));
  return at > 6 && Number.isInteger(id) ? { realm: ref.slice(6, at), id } : null;
}

/** A figure of a court, or one gone from it, by their page. */
export function courtFigure(
  world: World,
  ref: string,
): {
  r: Polity;
  c: Court | null;
  f: CourtFigure | null;
  gone: GoneFigure | null;
} | null {
  const at = parseCourtRef(ref),
    r = at ? politiesOf(world).get(at.realm as Ref) : undefined;
  if (!at || !r) return null;
  const c = courtOf(world)?.of(r.ref) ?? null,
    f = c?.figures.find((x) => x.id === at.id) ?? null,
    gone = c?.gone.find((x) => x.id === at.id) ?? null;
  return f || gone ? { r, c, f, gone } : null;
}

/** "the court holds", "traders hold". */
const holds = (seat: string) => `${seat} ${seat === "traders" ? "hold" : "holds"}`;

/** What a seat at court is called. */
const seatWords = (f: { seat: string }) =>
  f.seat === "house" ? "of the ruler's house" : `the voice of ${f.seat}`;

/** What they are to the realm's drama, in a title. */
export function titleOf(r: Polity, c: Court, f: CourtFigure): string {
  const held = f.id === c.regent ? "Regent, " : "",
    of = realmName(r);
  if (f.id === c.heir)
    return `${held}${f.seat === "house" ? "Heir" : `Heir, ${seatWords(f)},`} of ${of}`;
  if (f.id === c.rival) return `${held}Rival for the seat of ${of}, ${seatWords(f)}`;
  return `${held}${cap(seatWords(f))} at the court of ${of}`;
}

/** What they are, either side of their realm's name, for a page's line under its title. */
export function roleOf(c: Court, f: CourtFigure): readonly [string, string] {
  const held = f.id === c.regent ? "Regent, " : "",
    seat = f.seat === "house" ? "" : `, ${seatWords(f)}`;
  if (f.id === c.heir) return [`${held}Heir of `, seat];
  if (f.id === c.rival) return [`${held}Rival for the seat of `, seat];
  return [`${held}${cap(seatWords(f))} at the court of `, ""];
}

/** How one who is heir comes to be, in words and numbers. */
export function heirWhy(world: World, r: Polity, c: Court, f: CourtFigure): string {
  const year = yearOfMoment(world.now),
    age = year - f.born,
    grown = populationContext(world).life.adulthood,
    young =
      age < grown
        ? ` ${cap(he(f.sex))} is ${age}: a regent would hold the seat till ${he(f.sex)} is ${grown}.`
        : "";
  if (c.heirBy === "word") return `Named by ${r.ruler.name}'s own word.${young}`;
  if (c.heirBy === "voices")
    return `Rule here passes by others' leave, and the voices lean to them: ${holds(f.seat)} ${pct(f.sway)} in a hundred of the realm's sway, the most at court.`;
  return f.tie === "child"
    ? `The eldest child of ${r.ruler.name}, and rule here passes by birth.${young}`
    : `Of ${r.ruler.name}'s house: rule here passes by birth, and there is no child to follow.${young}`;
}

/** One reason a rival has, in words, with its number and the event it rests on. */
export type CourtReason = {
  readonly words: string;
  readonly weight: number;
  readonly why: string | null;
};

const REASONS: Readonly<Record<string, (value: number) => string>> = {
  "a rule doubted": (v) => `only ${pct(v)} in a hundred hold the rule rightful`,
  "a seat held by others' leave": () => "the seat is held by others' leave",
  "a child on the seat": (v) => `the ruler is ${v}`,
  "a child heir": (v) => `the heir is ${v}`,
  "no heir": () => "there is no heir",
  "battles lost": (v) => `${v} battle${v === 1 ? "" : "s"} lost these five years`,
  "a law the powerful are against": (v) =>
    `the laws stand ${pct(-v)} in a hundred against what the powerful want`,
  "a wrong done to them": () => "the seat was to be theirs",
  "a people who prize valour": (v) => `a people who prize valour (${pct(v)} in a hundred)`,
};

/** Why a rival wants the seat: their reasons, the weightiest first. */
export function reasonsOf(world: World, r: Polity, c: Court, f: CourtFigure): CourtReason[] {
  const o = orderOf(world)?.of(r.ref);
  if (!o) return [];
  const d = dangerOf(populationContext(world), r, c, f, o),
    own: CourtReason = {
      words:
        f.seat === "house"
          ? `of the ruler's own house, carrying ${pct(f.sway)} in a hundred of the realm's sway`
          : `${holds(f.seat)} ${pct(f.sway)} in a hundred of the realm's sway`,
      weight: COURT.wantWeight * d.weight,
      why: null,
    },
    // (Their own weight is told above, and is no reason of REASONS.)
    rest: CourtReason[] = d.factors.flatMap((x) => {
      const say = REASONS[x.name];
      return say && x.contribution > 0.005
        ? [{ words: say(x.value), weight: x.contribution, why: x.source?.ref ?? null }]
        : [];
    });
  return [own, ...rest].sort((a, b) => b.weight - a.weight);
}

/** What a voice wants: what their group presses for hardest; else to keep what they have. */
function wantOf(world: World, r: Polity, f: CourtFigure): { words: string; why: string | null } {
  if (f.seat === "house") return { words: "A place near the seat, and to keep it.", why: null };
  const ctx = populationContext(world),
    d = interestsOf(ctx, r, world.now)
      .find((i) => i.group === f.seat)
      ?.demands.slice()
      .sort((a, b) => b.strength - a.strength)[0];
  return d
    ? {
        words: `${cap(holds(f.seat)).replace(/ holds?$/, "")} want ${d.want}: ${d.name}.`,
        why: d.source,
      }
    : {
        words: `${cap(holds(f.seat))} ${pct(f.sway)} in a hundred of the realm's sway, and wants it kept.`,
        why: null,
      };
}

/** What a figure wants, in a line. */
export function wantWords(world: World, r: Polity, c: Court, f: CourtFigure): string {
  if (f.id === c.rival) {
    const top = reasonsOf(world, r, c, f).slice(0, 3);
    return `Wants the seat: ${top.map((x) => x.words).join("; ")}.`;
  }
  if (f.id === c.heir) return heirWhy(world, r, c, f);
  return wantOf(world, r, f).words;
}

/** What a figure last did that history tells (null: nothing yet). */
function lastDeed(world: World, c: Court, id: number): Ref | null {
  for (let i = c.told.length - 1; i >= 0; i--) {
    const e = world.events.get(c.told[i]!);
    if ((e?.data as { fig?: number } | null)?.fig === id) return e!.id;
  }
  return null;
}

/** A figure as one of a realm's key people: a page, a home in the seat's town, a body to take. */
export function courtLeader(world: World, r: Polity, c: Court, f: CourtFigure): Leader {
  const living = r.ended === null,
    town = seatTownOf(world, r),
    year = yearOfMoment(world.now),
    home = living && town ? town : null,
    age = year - f.born,
    deed = lastDeed(world, c, f.id);
  return {
    ref: courtRef(r.ref, f.id),
    kind: f.id === c.heir ? "heir" : f.id === c.rival ? "rival" : "voice",
    name: f.name,
    title: titleOf(r, c, f),
    did: deed ? `${bare(claimOf(world, deed))}.` : `At court since year ${f.since}, ${age} now.`,
    why: deed,
    wants: wantWords(world, r, c, f),
    town: home?.ref ?? null,
    townName: home?.name ?? null,
    as: home
      ? {
          name: f.name,
          age: Math.min(300, age),
          occupation: f.seat === "traders" ? OCC.trader : OCC.leader,
          sex: f.sex,
        }
      : null,
    cannot: home ? null : "History keeps no town for them.",
  };
}

/** A realm's court as its people: the heir, the rival, then the voices, the weightiest first. */
export function courtLeaders(world: World, r: Polity): Leader[] {
  const c = courtOf(world)?.of(r.ref);
  if (!c || r.ended !== null) return [];
  const rank = (f: CourtFigure) => (f.id === c.heir ? 0 : f.id === c.rival ? 1 : 2);
  return [...c.figures]
    .sort((a, b) => rank(a) - rank(b) || b.sway - a.sway || a.id - b.id)
    .map((f) => courtLeader(world, r, c, f));
}

/** How the seat passes here, from the realm's own orders and how its people count kin. */
export function seatWords_(world: World, r: Polity): string {
  const ways = cultureOf(world).get(r.seat),
    kin = ways?.traits[WAY.kinship] ?? 0,
    // (What is true of this people, in the numbers a rival's daring is read from.)
    people = ways
      ? ` Those of ${r.town} count kin at ${pct(kin)} in a hundred, prize valour at ${pct(ways.traits[WAY.valour]!)} and keep to custom at ${pct(ways.traits[WAY.tradition]!)}: the more valour and the less custom, the more a rival dares.`
      : "";
  if (byBlood(r, ways))
    return `Rule here passes by birth: whoever the house has as heir takes the seat, unless something stops them.${people}`;
  if (kin < REIGN.noHouses)
    return `This people keep no houses: no one is heir by blood. Whoever the voices lean to when the seat falls empty takes it.${people}`;
  return `Rule here passes by others' leave: whoever the voices lean to when the seat falls empty takes it.${people}`;
}

/** What a ruler played by the god's hand must answer now, if anything: a plot against them, an heir dead this year. */
export function dramaOf(world: World, r: Polity): ReignDrama | null {
  const c = courtOf(world)?.of(r.ref),
    o = orderOf(world)?.of(r.ref);
  if (!c || !o) return null;
  const year = yearOfMoment(world.now),
    legit = pct(o.legitimacy);
  // The brink (W5): the strongest way to feel it. Asked once, and the clock is held until it is answered.
  const far = fireOf(world).farOpenFor(r.ref);
  if (far && !far.answer) {
    const can = o.legitimacy >= REIGN.wordLine,
      what =
        far.rung === "world"
          ? "unmake that world, with everyone on it, for ever"
          : far.rung === "sky"
            ? "burn its whole sky, and starve whoever lives under it"
            : "carry the greatest fire to it";
    return {
      key: far.event,
      kind: "fire",
      title: "Everyone in reach of the stars holds their breath",
      who: null,
      words: `Your fleet is a year from a world of another star, and by your own reckoning its odds stand ${pct(1 - far.going)} in a hundred. You could ${what}: ${mjWords(far.mj)}. Every people in reach of the stars is watching, and it will be remembered for as long as anyone remembers anything.`,
      event: far.event,
      choices: [
        {
          id: "hold",
          label: "✋ Hold your hand",
          can: true,
          words: "You step back. Your fleet comes in and fights as any fleet does.",
        },
        {
          id: "loose",
          label: far.rung === "world" ? "🌑 Unmake it" : far.rung === "sky" ? "🔥 Burn its sky" : "☢️ Loose it",
          can,
          words: can
            ? "It falls at the year's end. No ruler anywhere will ever think of you the same way."
            : `Only ${legit} in a hundred hold your rule rightful: no one would turn the key.`,
        },
        {
          id: "let",
          label: "⏳ Say nothing",
          can: true,
          words: "You say nothing, and the realm decides it by the same numbers.",
        },
      ],
    };
  }
  const brink = fireOf(world).openFor(r.ref);
  if (brink && !brink.answer) {
    const foe = politiesOf(world).get(brink.foe),
      ctx = populationContext(world),
      cost = foe ? answerCost(ctx, r, foe, year) : 0,
      chance = fearOf(cost),
      people = r.members.reduce((n, k) => n + (ctx.provinces.get(k)?.total() ?? 0), 0),
      dead = Math.round(cost * people),
      foeName = foe ? realmName(foe) : "your foe",
      can = o.legitimacy >= REIGN.wordLine && brink.war !== null;
    return {
      key: brink.event,
      kind: "fire",
      title: "The whole world holds its breath",
      who: null,
      words: brink.war
        ? `Your war with ${foeName} goes badly: by your own reckoning ${pct(brink.desperation)} in a hundred of all you hold stands to be lost. You hold the greatest fire. ${dead > 0 ? `If they answer, some ${dead.toLocaleString("en-US")} of your people die: it frightens you ${pct(chance)} in a hundred.` : "They have nothing to answer with."} Every realm in the world is watching, and it will be remembered for as long as anyone remembers anything.`
        : `You and ${foeName} both hold the greatest fire, and this year one of you has come too close. ${dead > 0 ? `If it came to it, some ${dead.toLocaleString("en-US")} of your people die.` : ""} Every realm in the world is watching.`,
      event: brink.event,
      choices: [
        {
          id: "hold",
          label: "✋ Hold your hand",
          can: true,
          words: `You step back. ${brink.war ? "The war ends where it stands." : ""} It costs you nothing but what they will say of you.`,
        },
        ...(brink.war
          ? [
              {
                id: "loose",
                label: "☢️ Loose it",
                can,
                words: can
                  ? "A town of theirs is lost at the year's end, and all the world's skies darken after it. No ruler anywhere will ever think of you the same way."
                  : `Only ${legit} in a hundred hold your rule rightful: no one would turn the key.`,
              },
            ]
          : []),
        {
          id: "let",
          label: "⏳ Say nothing",
          can: true,
          words: "You say nothing, and the realm decides it by the same numbers.",
        },
      ],
    };
  }
  if (c.plot) {
    const f = c.figures.find((x) => x.id === c.plot!.by);
    if (!f) return null;
    const weight = weightOf(f.sway),
      odds = pct(c.plot.odds),
      flees = pct(fleeChance(weight));
    return {
      key: c.plot.event,
      kind: "plot",
      title: `A plot against you`,
      who: courtRef(r.ref, f.id),
      words: `${f.name}, ${seatWords(f)}, has moved against you. By the numbers ${odds} in a hundred it takes the seat within the year. ${wantWords(world, r, c, f)}`,
      event: c.plot.event,
      choices: [
        {
          id: "seize",
          label: `✊ Seize ${f.name}`,
          can: o.legitimacy >= REIGN.wordLine,
          words:
            o.legitimacy >= REIGN.wordLine
              ? `Costs ${pct(seizeCost(weight))} in a hundred of your standing. It ends the plot. ${flees} in a hundred ${he(f.sex)} gets away to the far lands and raises them against you.`
              : `Only ${legit} in a hundred hold your rule rightful: no one will lay a hand on them.`,
        },
        {
          id: "buy",
          label: `🤝 Buy ${f.name} off`,
          can: true,
          words: `Costs ${pct(COURT.buyCost)} in a hundred of your standing. ${cap(he(f.sex))} stays at your court and no one there dares for ${COURT.quietBought} years.`,
        },
        {
          id: "let",
          label: "⏳ Let it come",
          can: true,
          words: `You do nothing, and the realm decides it by the same numbers.`,
        },
      ],
    };
  }
  for (let i = c.told.length - 1; i >= 0; i--) {
    const e = world.events.get(c.told[i]!);
    if (e?.type !== "court.heirdied" || yearOfMoment(e.t) < year - 1) continue;
    const d = e.data as { who?: string; age?: number },
      grown = populationContext(world).life.adulthood,
      heir = c.figures.find((f) => f.id === c.heir),
      others = c.figures
        .filter((f) => f.id !== c.heir && year - f.born >= grown)
        .sort((a, b) => b.sway - a.sway || a.id - b.id)
        .slice(0, 3);
    return {
      key: e.id,
      kind: "heir",
      title: `${d.who ?? "Your heir"} has died`,
      who: null,
      words: `${d.who ?? "Your heir"}, your heir, died at ${d.age ?? "a young age"}. ${heir ? `${heir.name} stands to follow you now.` : "No one stands to follow you now."}`,
      event: e.id,
      choices: [
        ...others.map((f) => ({
          id: `name:${f.id}`,
          label: `👑 Name ${f.name}, ${year - f.born}`,
          can: o.legitimacy >= REIGN.wordLine,
          words:
            o.legitimacy >= REIGN.wordLine
              ? `${cap(seatWords(f))}, ${pct(f.sway)} in a hundred of the realm's sway. Costs ${pct(COURT.nameCost)} in a hundred of your standing.`
              : `Only ${legit} in a hundred hold your rule rightful: your word stops at the seat's door.`,
        })),
        {
          id: "let",
          label: heir ? `⏳ Let ${heir.name} stand` : "⏳ Name no one",
          can: true,
          words: "You say nothing, and the realm goes on by its own custom.",
        },
      ],
    };
  }
  return null;
}
