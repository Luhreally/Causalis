// The people bar (B1, classic 49): who matters at the place the eye is on, and why, read off the world. The ruler of the
// realm there; one moving against them, or who wants their seat; their heir; the ruler they are at war with; the last one
// to take a seat by force, anywhere. Where no realm stands, an elder of the town there. Those a person keeps and follows
// come first. The face and name are their page's own, so the two can't disagree. Pure reads: nothing is kept.
import { yearOfMoment, type Ref, type World } from "../kernel/index.ts";
import { courtOf, politiesOf, populationContext, type Polity } from "../sim/index.ts";
import type {
  BarAsk,
  BarPerson,
  BarRead,
  BarReadings,
  BarWhy,
  PageModel,
  Portrait,
} from "../bridge/index.ts";
import { courtRef } from "./court.ts";
import { townRoster } from "./roster.ts";
import { pageOf } from "./inspect/index.ts";
import { goneOf, readingsOf, warOfRealm } from "./inspect/barread.ts";
import { bare, claimOf } from "./inspect/words.ts";
import type { QueryHandler } from "./host.ts";

/** How many of a town's lines are looked through for an elder, and how many years back a seat taken is still news. */
const ELDER_LINES = 96,
  NEWS_YEARS = 40;
/** A seat taken by force, and what it says of the one who took it. */
const SEIZED = new Set(["strife.coup", "court.seized", "strife.throne", "strife.revolution"]);

/** A realm's people, for which rules the most. */
function peopleOf(world: World, r: Polity): number {
  const ctx = populationContext(world);
  return r.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0);
}

/** The realm that rules the most people: what a place holding no land of the world (the stars, say) reads. */
function greatestRealm(world: World): Polity | null {
  let best: Polity | null = null,
    most = 0;
  for (const r of politiesOf(world).living()) {
    const n = peopleOf(world, r);
    if (n > most || (n === most && best && r.ref < best.ref)) {
      best = r;
      most = n;
    }
  }
  return best;
}

/** The eldest of those a town keeps by name (of its first lines), for a land no realm holds. */
function elderOf(world: World, cell: number | null): { ref: string; town: string } | null {
  const ctx = populationContext(world),
    towns =
      cell !== null
        ? ctx.settlements.seenIn(cell)
        : ctx.provinces.all().flatMap((p) => (p.total() > 0 ? ctx.settlements.seenIn(p.cell) : [])),
    town = [...towns]
      .filter((t) => t.population > 0)
      .sort(
        (a, b) => b.population - a.population || (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0),
      )[0];
  if (!town) return null;
  const roster = townRoster(world, town.ref);
  let best: { ref: string; born: number } | null = null;
  for (let line = 0; line < ELDER_LINES; line++) {
    const h = roster.holder(line);
    if (!h) continue;
    if (!best || h.born < best.born) best = { ref: h.ref, born: h.born };
  }
  return best ? { ref: best.ref, town: town.name } : null;
}

/** Who took a seat by force last, anywhere but here: the great news of who rules. */
function seizedLast(world: World, here: Polity | null): { r: Polity; year: number } | null {
  const now = yearOfMoment(world.now);
  let best: { r: Polity; year: number } | null = null;
  for (const r of politiesOf(world).living()) {
    if (r === here || now - r.ruler.since > NEWS_YEARS) continue;
    const e = world.events.get(r.ruler.event as Ref);
    if (!e || !SEIZED.has(e.type)) continue;
    const year = yearOfMoment(e.t);
    if (!best || year > best.year || (year === best.year && r.ref < best.r.ref)) best = { r, year };
  }
  return best;
}

type Want = { readonly ref: string; readonly kind: BarWhy; readonly why: string };

/** Those the place and the world put on the bar, in the order they stand. */
function wantedAt(world: World, ask: BarAsk): Want[] {
  const realms = politiesOf(world),
    ctx = populationContext(world),
    cell = ask.cell ?? (ask.town ? (ctx.settlements.get(ask.town as Ref)?.cell ?? null) : null),
    there = cell !== null ? realms.of(cell) : undefined,
    held = there && there.ended === null ? there : null,
    // (Where no realm stands, an elder of its town; no town there, the eye is on sea or wilds or among the stars.)
    elder = !held && cell !== null ? elderOf(world, cell) : null,
    realm = held ?? (elder ? null : greatestRealm(world)),
    last = !realm ? (elder ?? elderOf(world, null)) : null,
    out: Want[] = [];
  if (last)
    out.push({
      ref: last.ref,
      kind: "elder",
      why: `An elder of ${last.town}, where no realm rules`,
    });
  if (realm) {
    out.push({
      ref: `rule:${realm.ref}`,
      kind: held ? "ruler" : "greatest",
      why: held ? `Rules ${realm.town}` : `Rules ${realm.town}, the most people on this world`,
    });
    const c = courtOf(world)?.of(realm.ref),
      plotter = c?.plot ? c.figures.find((f) => f.id === c.plot!.by) : undefined,
      rival = c && c.rival !== null ? c.figures.find((f) => f.id === c.rival) : undefined,
      heir = c && c.heir !== null ? c.figures.find((f) => f.id === c.heir) : undefined;
    if (plotter)
      out.push({
        ref: courtRef(realm.ref, plotter.id),
        kind: "plot",
        why: `Moving against ${realm.town}'s seat`,
      });
    else if (rival)
      out.push({
        ref: courtRef(realm.ref, rival.id),
        kind: "rival",
        why: `Wants ${realm.town}'s seat`,
      });
    if (heir && heir.id !== plotter?.id && heir.id !== rival?.id)
      out.push({ ref: courtRef(realm.ref, heir.id), kind: "heir", why: `Heir of ${realm.town}` });
    const war = warOfRealm(world, realm),
      foe = war ? realms.get(war.attacker === realm.ref ? war.defender : war.attacker) : undefined;
    if (foe && foe.ended === null)
      out.push({
        ref: `rule:${foe.ref}`,
        kind: "foe",
        why: `Rules ${foe.town}, at war with ${realm.town}`,
      });
  }
  const news = seizedLast(world, realm);
  if (news)
    out.push({
      ref: `rule:${news.r.ref}`,
      kind: "news",
      why: `Took ${news.r.town}'s seat in ${news.year}`,
    });
  return out;
}

/** Read one person: a page's own name and face, and how they are. */
function personOf(
  world: World,
  want: Want,
  pinned: boolean,
  pinName: string | null,
): BarPerson | null {
  const page: PageModel = pageOf(world, want.ref, undefined, true);
  if (page.kind !== "person" && page.kind !== "agent")
    return pinned ? goneOne(want, pinName) : null;
  // (A seat's page tells whoever holds it now: the one pinned has left it.)
  if (pinName !== null && page.title !== pinName) return leftSeat(world, want, pinName);
  const readings = readingsOf(world, want.ref, page);
  if (!readings) return pinned ? goneOne(want, pinName) : null;
  return {
    key: `${want.ref}|${page.title}`,
    ref: page.ref,
    name: page.title,
    kind: want.kind,
    why: want.why,
    pinned,
    gone: goneOf(world, want.ref, page),
    portrait: (page.portrait as Portrait | undefined) ?? null,
    readings,
  };
}

const goneReadings = (words: string): BarReadings => ({
  mood: { glyph: "🕯️", label: "Mood", short: "gone", words, tone: "plain" },
  doing: { glyph: "🕯️", label: "Doing", short: "gone", words, tone: "plain" },
  health: { glyph: "🕯️", label: "Health", short: "gone", words, tone: "plain" },
});

/** One pinned whom history no longer tells of. */
function goneOne(want: Want, name: string | null): BarPerson {
  const who = name ?? "Someone";
  return {
    key: `${want.ref}|${who}`,
    ref: want.ref,
    name: who,
    kind: "pin",
    why: "You kept them: history tells no more of them",
    pinned: true,
    gone: true,
    portrait: null,
    readings: goneReadings("History tells no more of them."),
  };
}

/** One pinned who held a seat, and no longer does: pressed, how it passed. */
function leftSeat(world: World, want: Want, name: string): BarPerson {
  const r = want.ref.startsWith("rule:")
      ? politiesOf(world).get(want.ref.slice(5) as Ref)
      : undefined,
    how = r ? `${bare(claimOf(world, r.ruler.event))}.` : "History tells no more of them.";
  return {
    key: `${want.ref}|${name}`,
    ref: r ? r.ruler.event : want.ref,
    name,
    kind: "pin",
    why: r ? `No longer rules ${r.town}` : "You kept them: history tells no more of them",
    pinned: true,
    gone: true,
    portrait: null,
    readings: goneReadings(how),
  };
}

/** The bar at a place: those kept, those followed, and those the place puts there. Nobody yet: no one on it. */
export function barOf(world: World, ask: BarAsk): BarRead {
  const year = yearOfMoment(world.now),
    wanted = wantedAt(world, ask),
    byRef = new Map(wanted.map((w) => [w.ref, w])),
    seen = new Set<string>(),
    people: BarPerson[] = [];
  for (const pin of ask.pins) {
    if (seen.has(pin.ref)) continue;
    seen.add(pin.ref);
    const w = byRef.get(pin.ref),
      p = personOf(
        world,
        { ref: pin.ref, kind: "pin", why: w?.why ?? "You keep them here" },
        true,
        pin.name,
      );
    if (p) people.push(p);
  }
  for (const ref of ask.followed) {
    if (seen.has(ref)) continue;
    seen.add(ref);
    const w = byRef.get(ref),
      p = personOf(world, { ref, kind: "followed", why: w?.why ?? "You follow them" }, false, null);
    if (p) people.push(p);
  }
  for (const w of wanted) {
    if (seen.has(w.ref)) continue;
    seen.add(w.ref);
    const p = personOf(world, w, false, null);
    if (p) people.push(p);
  }
  return { year, people };
}

export const BAR_QUERIES: Readonly<Record<string, QueryHandler>> = {
  "people.bar": (world, args) => barOf(world, args as BarAsk),
};
