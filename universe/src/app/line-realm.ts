// Live a Line's civilization played (C1, 2026-11-28, the second fun audit: "the civ stage as something you play"). The
// realm that holds the line's land, ruled a year at a time: a council each year offers one thing to build (its town
// asked to raise what it can: town.ask, H1), one realm to court (an envoy: reign.envoy, D1) and one to fight or make
// peace with (reign.war, reign.peace, W7), each with what it would cost or why it cannot be, in the world's own words. One
// word a year; then the year is let pass and what it came to is told. Every act is a command the god game's ruler (L4)
// already gives, so a world where none is given runs exactly as it would have. Fetched with Live a Line only.
import type {
  HostClient,
  ReignDecrees,
  ReignEnvoys,
  ReignNow,
  ReignWars,
  TownOffers,
} from "../bridge/index.ts";

export type CouncilKind = "build" | "law" | "court" | "fight" | "peace";

/** One thing the council could do this year: what, what it would cost or why not, and the command that does it. */
export type CouncilChoice = {
  readonly kind: CouncilKind;
  readonly icon: string;
  readonly label: string;
  readonly words: string;
  readonly can: boolean;
  readonly type: string;
  readonly args: Readonly<Record<string, unknown>>;
};

/** How the realm stands: its people, lands, place among the realms it meets, host, standing (0 … 1), unrest (0 … 1). */
export type CouncilTally = {
  readonly people: number;
  readonly lands: number;
  readonly rank: number;
  readonly of: number;
  readonly host: number;
  readonly standing: number;
  readonly unrest: number;
};

export type Council = {
  readonly realm: string;
  readonly name: string;
  readonly ruler: string;
  /** "chief of Sairis". */
  readonly title: string;
  readonly tally: CouncilTally;
  readonly choices: readonly CouncilChoice[];
};

/** Words that open with a capital put mid-sentence ("A granary" → "a granary"). */
const mid = (words: string) => words.replace(/^(A|An|The) /, (w) => w.toLowerCase());

/** An envoy's errands, the warmest first: a gift of grain, a pact, an embassy. */
const ERRANDS = ["gift", "pact", "embassy"];

/** The realm's council this year, read off the world (null: no such realm, or its ruler gone). */
export async function councilOf(
  client: HostClient,
  realm: string,
  ruler: string,
  /** The line's own town (or village), asked to build. */
  town: string | null,
): Promise<Council | null> {
  const who = { realm, ruler },
    quiet = <T>(p: Promise<T>) => p.catch(() => null);
  const [now, wars, envoys, offers, decrees] = await Promise.all([
    quiet(client.query<ReignNow | null>({ type: "reign.now", args: who })),
    quiet(client.query<ReignWars | null>({ type: "reign.wars", args: { realm } })),
    quiet(client.query<ReignEnvoys | null>({ type: "reign.envoys", args: { realm } })),
    town
      ? quiet(client.query<TownOffers | null>({ type: "town.offers", args: { ref: town } }))
      : Promise.resolve(null),
    quiet(client.query<ReignDecrees | null>({ type: "reign.decrees", args: { realm } })),
  ]);
  if (!now) return null;
  const choices: CouncilChoice[] = [];
  // —— Build: the line's town asked to raise what it can.
  if (offers) {
    const o = offers.raises[0] ?? offers.firsts[0];
    if (offers.shut || !o)
      choices.push({
        kind: "build",
        icon: "🏗️",
        label: `Ask ${offers.name} to build`,
        words: offers.shut ?? offers.no[0]?.why ?? "it has nothing it could raise now",
        can: false,
        type: "town.ask",
        args: {},
      });
    else
      choices.push({
        kind: "build",
        icon: o.icon || "🏗️",
        label:
          o.kind === "raise"
            ? `Ask ${offers.name} to raise ${mid(o.name)}`
            : `Ask ${offers.name} to put ${mid(o.name)} first`,
        words: o.note,
        can: true,
        type: "town.ask",
        args: { village: offers.town, kind: o.kind, what: o.what, by: who },
      });
  }
  // —— A law: the first of its laws a decree could set otherwise than it stands, as its ruler may decree it.
  if (decrees) {
    let law: CouncilChoice | null = null;
    for (const l of decrees.laws) {
      const o = l.options.find((x) => x.can && x.label !== l.now);
      if (!o) continue;
      law = {
        kind: "law",
        icon: "📜",
        label: `Decree it: ${l.title.replace(/^./, (c) => c.toLowerCase())}, ${o.label} (now ${l.now})`,
        words: o.words,
        can: true,
        type: "reign.decree",
        args: { ...who, law: l.law, to: o.to },
      };
      break;
    }
    if (law) choices.push(law);
  }
  // —— Court: an envoy to a realm it meets, the warmest errand that can be done.
  if (envoys?.realms.length) {
    const court = (
      r: (typeof envoys.realms)[number],
      e: (typeof r.errands)[number],
    ): CouncilChoice => ({
      kind: "court",
      icon: "🤝",
      label: `${e.label} to ${r.name}`,
      words: e.words,
      can: e.can,
      type: "reign.envoy",
      args: { ...who, to: r.ref, errand: e.errand },
    });
    let best: CouncilChoice | null = null;
    for (const errand of ERRANDS) {
      for (const r of envoys.realms) {
        const e = r.errands.find((x) => x.errand === errand && x.can);
        if (e) {
          best = court(r, e);
          break;
        }
      }
      if (best) break;
    }
    // (None can be sent: the first, with why not.)
    const first = envoys.realms[0]!;
    best ??= first.errands[0] ? court(first, first.errands[0]) : null;
    if (best) choices.push(best);
  }
  // —— At war: peace, on the best terms it could have; else war on the weakest it could fight.
  const war = wars?.wars[0];
  if (war) {
    const offer = war.offers.find((o) => o.can) ?? war.offers[0];
    if (offer)
      choices.push({
        kind: "peace",
        icon: "🕊️",
        label: `Make peace with ${war.foeName}: ${offer.label.toLowerCase()}`,
        words: offer.words,
        can: war.can && offer.can,
        type: "reign.peace",
        args: { ...who, with: war.foe, offer: offer.id },
      });
  } else if (wars?.foes.length) {
    const foe = [...wars.foes].sort(
      (a, b) => Number(b.can) - Number(a.can) || a.host - b.host || (a.ref < b.ref ? -1 : 1),
    )[0]!;
    choices.push({
      kind: "fight",
      icon: "⚔️",
      label: `War on ${foe.name}`,
      words: foe.words,
      can: foe.can,
      type: "reign.war",
      args: { ...who, against: foe.ref },
    });
  }
  return {
    realm,
    name: now.realmName,
    ruler: now.ruler,
    title: now.title,
    tally: {
      people: now.people,
      lands: now.lands,
      rank: now.rank,
      of: now.of,
      host: now.host,
      standing: now.legitimacy,
      unrest: now.unrest,
    },
    choices,
  };
}

/** What a year came to, in words, each a change from the tally before it (none: nothing moved). */
export function yearWords(was: CouncilTally, now: CouncilTally): string[] {
  const out: string[] = [],
    signed = (n: number) => `${n > 0 ? "+" : "−"}${Math.abs(n).toLocaleString("en")}`;
  if (now.people !== was.people)
    out.push(`${signed(now.people - was.people)} people (${now.people.toLocaleString("en")})`);
  if (now.lands !== was.lands)
    out.push(
      `${signed(now.lands - was.lands)} ${Math.abs(now.lands - was.lands) === 1 ? "land" : "lands"} (${now.lands})`,
    );
  if (now.rank !== was.rank)
    out.push(
      `${now.rank < was.rank ? "up" : "down"} to ${now.rank} of the ${now.of} realms it meets`,
    );
  if (now.host !== was.host)
    out.push(`its host ${signed(now.host - was.host)} (${now.host.toLocaleString("en")})`);
  const st = Math.round((now.standing - was.standing) * 100);
  if (st) out.push(`its ruler's standing ${signed(st)} in a hundred`);
  return out;
}

/** Whether a year went well for the realm: more people or lands, or a better place, and no land lost. */
export function yearWent(was: CouncilTally, now: CouncilTally): "grew" | "fell" | "held" {
  if (now.lands < was.lands || now.rank > was.rank) return "fell";
  if (now.lands > was.lands || now.rank < was.rank || now.people > was.people) return "grew";
  return now.people < was.people ? "fell" : "held";
}
