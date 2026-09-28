// Peoples read, and the god as each names it (Phase 14 M119, M120). A people is those who speak
// one tongue: their ways (the mean of their lands', with what pushed them most), their faiths
// and realms, their lands, their numbers through the years. And each people names the god by
// what it has seen of the god's hand — favour (rain, a fat harvest, healing, a spring, a shrine,
// inspiration, a blessing, settlers, friendship, a peace), wrath (drought, blight, plague, fire,
// a quake, fire from the sky, a flood, a curse, discord, a war) or a portent (the sun or the
// world's warmth changed, their ways or speech changed, a faith revealed, a rising, a union,
// the hand laid among them) — in its own tongue, with the epithet of what it has seen most.
// Pure reads of the world.
import { tongueName } from "../../gen/index.ts";
import type { Ref, World } from "../../kernel/index.ts";
import {
  WAY_TRAITS,
  beliefOf,
  cultureOf,
  languagesOf,
  politiesOf,
  populationContext,
  type Language,
} from "../../sim/index.ts";
import type { Block } from "../../bridge/index.ts";
import { realmColor } from "../colors.ts";
import { faithColor } from "../planet.ts";
import { claimOf, count, share } from "./words.ts";
import { faithLink, realmLink } from "./names.ts";

/** How a people reads an act of the god: a favour, a wrath, a portent. */
export type Reading = "favour" | "wrath" | "portent";

/** Each act as a people reads it, and the epithet it gives the god when it is what they have seen most. */
const SEEN: Readonly<Record<string, { reading: Reading; epithet: string; words: string }>> = {
  "act.rain+": { reading: "favour", epithet: "the Rain-Giver", words: "rain sent" },
  "act.rain-": { reading: "wrath", epithet: "the Withholder", words: "rain withheld" },
  "act.harvest+": { reading: "favour", epithet: "the Bountiful", words: "a fat harvest" },
  "act.harvest-": { reading: "wrath", epithet: "the Blighter", words: "blight" },
  "act.plague+": { reading: "favour", epithet: "the Mender", words: "the sick healed" },
  "act.plague-": { reading: "wrath", epithet: "the Pestilent", words: "plague" },
  "act.inspire+": { reading: "favour", epithet: "the Teacher", words: "inspiration" },
  "act.spring": { reading: "favour", epithet: "the Wellspring", words: "a spring opened" },
  "act.shrine": { reading: "favour", epithet: "the Watcher", words: "a shrine raised" },
  "act.bless": { reading: "favour", epithet: "the Kindly", words: "a blessing" },
  "act.fire": { reading: "wrath", epithet: "the Burner", words: "fire on a town" },
  "act.quake": { reading: "wrath", epithet: "the Earthshaker", words: "the ground shaken" },
  "act.meteor": { reading: "wrath", epithet: "the Star-Hurler", words: "fire from the sky" },
  "act.flood": { reading: "wrath", epithet: "the Drowner", words: "a river raised" },
  "act.curse": { reading: "wrath", epithet: "the Curser", words: "a curse" },
  "act.flare": { reading: "portent", epithet: "the Burning Eye", words: "the sun's anger or calm" },
  "act.settle": { reading: "favour", epithet: "the Giver of Lands", words: "settlers sent" },
  "act.friendship": { reading: "favour", epithet: "the Peacemaker", words: "friends made" },
  "act.discord": { reading: "wrath", epithet: "the Sower of Strife", words: "discord sown" },
  "act.ways": { reading: "portent", epithet: "the Shaper", words: "their ways changed" },
  "act.tongue": { reading: "portent", epithet: "the Word-Giver", words: "a tongue taught" },
  "act.union": { reading: "portent", epithet: "the Uniter", words: "two realms made one" },
  "belief.founded": { reading: "portent", epithet: "the Revealer", words: "a faith revealed" },
  "belief.converted": {
    reading: "portent",
    epithet: "the Caller",
    words: "a land turned to a faith",
  },
  "language.arose": {
    reading: "portent",
    epithet: "the Tongue-Maker",
    words: "a tongue of their own",
  },
  "polity.seceded": { reading: "portent", epithet: "the Stirrer", words: "a land stirred to rise" },
  "war.declared": { reading: "wrath", epithet: "the Warbringer", words: "a war begun" },
  "war.peace": { reading: "favour", epithet: "the Peacegiver", words: "a war ended" },
  "hand.laid": { reading: "portent", epithet: "the Near One", words: "your hand among them" },
  "act.warm": { reading: "portent", epithet: "the Kindler", words: "the world warmed or cooled" },
};

/** What the god's hand did among the peoples, told by the events it caused rather than its own. */
const BY_HAND = new Set([
  "hand.laid",
  "belief.founded",
  "belief.converted",
  "language.arose",
  "polity.seceded",
  "war.declared",
  "war.peace",
]);

/** The last reading of what the lands have seen, while history holds no new event. */
let seenKept: {
  world: World;
  at: number;
  events: number;
  seen: Map<number, Map<string, number>>;
} | null = null;

/** What each land has seen of the god's hand: each kind of act, how many times. */
export function godSeen(world: World): Map<number, Map<string, number>> {
  const events = world.events.all().length;
  if (
    seenKept &&
    seenKept.world === world &&
    seenKept.at === world.now &&
    seenKept.events === events
  )
    return seenKept.seen;
  const seen = readSeen(world);
  seenKept = { world, at: world.now, events, seen };
  return seen;
}

function readSeen(world: World): Map<number, Map<string, number>> {
  const ctx = populationContext(world),
    realms = politiesOf(world),
    out = new Map<number, Map<string, number>>(),
    seen = (cell: number, key: string) => {
      if (!SEEN[key]) return;
      let m = out.get(cell);
      if (!m) out.set(cell, (m = new Map()));
      m.set(key, (m.get(key) ?? 0) + 1);
    },
    cellOf = (place: string | null | undefined) =>
      place?.startsWith("cell:0:") ? Number(place.slice(7)) : -1,
    peopled = ctx.provinces.all().map((p) => p.cell);
  for (const e of world.events.all()) {
    if (!e.type.startsWith("act.")) {
      // (A faith revealed, a land turned to one, a tongue of its own, a rising: seen where
      // they fell; a war the god began or ended, by both realms' lands.)
      if (!BY_HAND.has(e.type)) continue;
      if (!e.causes.some((c) => c.role === "agent" && c.ref.startsWith("cmd:"))) continue;
      if (e.type.startsWith("war."))
        for (const ref of e.subjects.slice(1, 3))
          for (const c of realms.get(ref as Ref)?.members ?? []) seen(c, e.type);
      else seen(cellOf(e.place), e.type);
      continue;
    }
    const d = e.data as { sign?: number } | null;
    switch (e.type) {
      case "act.rain":
      case "act.harvest":
      case "act.plague":
      case "act.inspire":
        seen(cellOf(e.place), `${e.type}${(d?.sign ?? 1) < 0 ? "-" : "+"}`);
        break;
      case "act.spring":
      case "act.shrine":
      case "act.fire":
      case "act.quake":
      case "act.meteor":
      case "act.flood":
      case "act.settle":
      case "act.ways":
      case "act.tongue":
        seen(cellOf(e.place), e.type);
        break;
      case "act.friendship":
      case "act.discord":
        // (Both realms' lands feel it.)
        for (const ref of e.subjects.slice(0, 2))
          for (const c of realms.get(ref as Ref)?.members ?? []) seen(c, e.type);
        break;
      case "act.bless":
      case "act.curse":
      case "act.union": {
        // (A realm's lands all feel it.)
        const r = realms.get(e.subjects[0] as Ref);
        for (const c of r?.members ?? []) seen(c, e.type);
        break;
      }
      case "act.flare":
      case "act.warm":
        // (The sky is seen by every land.)
        for (const c of peopled) seen(c, e.type);
        break;
    }
  }
  return out;
}

/** An act as a people speaks of having seen it. */
export function seenWords(key: string): string {
  return SEEN[key]?.words ?? key;
}

/** A land's reading of the god: favour, wrath and portents it has seen. */
export function beliefOfLand(seen: Map<string, number> | undefined): Record<Reading, number> {
  const out = { favour: 0, wrath: 0, portent: 0 };
  for (const [key, n] of seen ?? []) out[SEEN[key]!.reading] += n;
  return out;
}

/** The god as a people names it: a name in its tongue, and the epithet of what it has seen most. */
export function godNamed(
  world: World,
  l: Language,
  seen: Map<number, Map<string, number>>,
): { name: string; epithet: string | null; seen: [string, number][] } {
  const lands = languagesOf(world).speakers().get(l.index) ?? [],
    all = new Map<string, number>();
  for (const c of lands) for (const [k, n] of seen.get(c) ?? []) all.set(k, (all.get(k) ?? 0) + n);
  const ranked = [...all].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)),
    name = tongueName({ ...l.standard, seed: l.standard.seed ^ 0x60d }, 7);
  return {
    name,
    epithet: ranked[0] ? SEEN[ranked[0][0]]!.epithet : null,
    seen: ranked.map(([k, n]) => [SEEN[k]!.words, n]),
  };
}

/** A people (those who speak a tongue) read: its god, its ways, its faiths and realms, its numbers. */
export function peopleBlocks(world: World, l: Language): Block[] {
  const ctx = populationContext(world),
    lands = (languagesOf(world).speakers().get(l.index) ?? []).filter(
      (c) => (ctx.provinces.get(c)?.total() ?? 0) > 0,
    );
  if (!lands.length) return [{ type: "text", lines: [["No one speaks it now."]] }];
  const culture = cultureOf(world),
    peopleOf = (c: number) => ctx.provinces.get(c)?.total() ?? 0,
    total = lands.reduce((n, c) => n + peopleOf(c), 0),
    // Their ways: each land's, weighed by its people.
    ways = WAY_TRAITS.map(
      (_, i) =>
        lands.reduce((s, c) => s + (culture.get(c)?.traits[i] ?? 0.5) * peopleOf(c), 0) / total,
    ),
    // What pushed them most, of all their lands.
    pushes = lands
      .flatMap((c) => culture.get(c)?.nudges ?? [])
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount) || b.year - a.year)
      .slice(0, 6),
    faiths = new Map<string, number>(),
    realms = new Map<string, number>();
  for (const c of lands) {
    const f = beliefOf(world).of(c).faith;
    if (f) faiths.set(f, (faiths.get(f) ?? 0) + peopleOf(c));
    const r = politiesOf(world).of(c);
    if (r) realms.set(r.ref, (realms.get(r.ref) ?? 0) + peopleOf(c));
  }
  const god = godNamed(world, l, godSeen(world)),
    through = new Map<number, number>();
  for (const c of lands)
    for (const y of ctx.history.yearsOf(c))
      through.set(y.year, (through.get(y.year) ?? 0) + y.population);
  const blocks: Block[] = [
    {
      type: "facts",
      title: "The god, as they name it",
      rows: [
        {
          label: "Its name",
          value: [`${god.name}${god.epithet ? `, ${god.epithet}` : ""}`],
        },
        {
          label: "From what they have seen",
          value: [
            god.seen.length
              ? god.seen.map(([w, n]) => `${w} ×${n}`).join(", ")
              : "nothing yet of your hand",
          ],
        },
      ],
    },
    {
      type: "bars",
      title: `Their ways (${count(total)} people in ${count(lands.length)} lands)`,
      unit: "share",
      bars: WAY_TRAITS.map((t, i) => ({ label: [t], value: ways[i]! })),
    },
  ];
  if (pushes.length)
    blocks.push({
      type: "list",
      title: "What pushed their ways most",
      items: pushes.map((n) => ({
        line: [
          { text: claimOf(world, n.event), ref: n.event },
          ` — ${WAY_TRAITS[n.trait]} ${n.amount > 0 ? "+" : "−"}${share(Math.abs(n.amount))}`,
        ],
        ref: n.event,
        year: n.year,
      })),
    });
  if (faiths.size)
    blocks.push({
      type: "bars",
      title: "Their faiths, by the people who hold each",
      unit: "people",
      bars: [...faiths]
        .sort((a, b) => b[1] - a[1])
        .map(([f, n]) => ({
          label: [faithLink(world, f)],
          ref: f,
          value: n,
          color: faithColor(f),
        })),
    });
  if (realms.size)
    blocks.push({
      type: "bars",
      title: "The realms they live in",
      unit: "people",
      bars: [...realms]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([r, n]) => ({
          label: [realmLink(world, r)],
          ref: r,
          value: n,
          color: realmColor(r),
        })),
    });
  if (through.size >= 2)
    blocks.push({
      type: "lines",
      title: "Their numbers through the years (the lands that speak it now)",
      unit: "people",
      series: [
        {
          name: l.name,
          ref: l.ref,
          color: [0.6, 0.86, 0.9],
          points: [...through].sort((a, b) => a[0] - b[0]).map(([x, y]) => ({ x, y })),
        },
      ],
    });
  return blocks;
}
