// The lanes, told (Phase 68): the page for the law of this universe and the first jump's film, each read off what the
// seed and history hold. Nothing here writes.
import type { World } from "../kernel/index.ts";
import type { Block, JumpPlan, PageModel } from "../bridge/index.ts";
import { functionsOf, type GalaxyStar } from "../gen/index.ts";
import {
  LANE_LAW_SHARE,
  LANE_MACHINES_TONNE,
  LEAST_TIDE,
  PRINCIPLES,
  STAR_DRIVES,
  crossingYears,
  cruise,
  laneLights,
  laneThrows,
} from "../rules/index.ts";
import {
  LANE_ROW,
  arrivalsAt,
  clusterOf,
  folksNear,
  laneLawOf,
  laneMapOf,
  laneRoute,
  lanesOf,
  loreOf,
  populationContext,
  starSitesOf,
} from "../sim/index.ts";
import { homePlanet } from "../sim/index.ts";
import { stat, yearNow } from "./inspect/words.ts";

const n = (x: number) => Math.round(x).toLocaleString("en");
const plural = (k: number, one: string, many: string) => `${n(k)} ${k === 1 ? one : many}`;

/** The first year any land knew a thing (null: none has). */
function firstKnown(world: World, id: string): number | null {
  const lore = loreOf(world);
  let first: number | null = null;
  for (const p of populationContext(world).provinces.all()) {
    const k = lore.get(p.cell, id);
    if (k && (first === null || k.year < first)) first = k.year;
  }
  return first;
}

/** What the law's setting is, in words. */
function lawSetBy(world: World): string {
  const law = laneLawOf(world);
  return law.by === "dial"
    ? "The Creator's own hand, on this universe's making."
    : law.by === "earth"
      ? "It is so in the universe of every world like ours, as this game has it."
      : `The seed this universe fell from. About ${Math.round(LANE_LAW_SHARE * 3)} in 3 universes never seen have it.`;
}

/** What the ships and peoples of the lanes have done since the first. */
function didSince(world: World): { ships: number; peoples: number; soonest: string | null } {
  const sites = starSitesOf(world)?.all() ?? [],
    store = lanesOf(world),
    visits = store?.visits ?? [],
    arrived = visits.filter((v) => v.arrived),
    seen = new Set(arrived.map((v) => v.folk));
  let soonest: string | null = null;
  const v = arrived[0];
  if (v) {
    const f = folksNear(world).find((x) => x.ref === v.folk);
    soonest = `The ${f?.name ?? "people"} ${v.distance.toFixed(1)} light-years out were met in year ${v.arrives}, ${v.arrives - v.sailed} years after a ship left for them; on its drive alone it would have been ${n(v.byDrive)}.`;
  }
  return {
    ships: sites.filter(([, s]) => s.lane).length + visits.length,
    peoples: seen.size,
    soonest,
  };
}

/** The first jump, for its film (null: none has been made). */
export function jumpPlan(world: World): JumpPlan | null {
  const j = lanesOf(world)?.first;
  if (!j) return null;
  const star = clusterOf(world).find((s) => s.ref === j.star),
    word =
      j.what === "settlers"
        ? ", with settlers,"
        : j.what === "fleet"
          ? ", going to war,"
          : ", sent to look,",
    who = j.what === "fleet" ? `The lead ship of a fleet of ${j.name}` : `A ship of ${j.name}`,
    drive = STAR_DRIVES.find((d) => d.id === j.drive)?.words ?? "its drive",
    years = j.arrives - j.year,
    did = didSince(world),
    lanes = plural(j.hops, "lane", "lanes"),
    thrown = j.thrown;
  return {
    star: j.star,
    planet: j.planet,
    year: j.year,
    arrives: j.arrives,
    thrown,
    title: `The first jump: ${j.name}, year ${j.year}`,
    leave: `${who} leaves its world, bound for a star ${j.distance} light-years off. Its drive alone would take ${n(j.byDrive)} years.`,
    opens: `Out where its star's pull has fallen away, a lane's mouth opens. It burns ${n(j.tonnes)} tonnes of annihilation fuel to hold it.`,
    jump: "It jumps.",
    through: `Through ${lanes}, ${j.ly} light-years, faster than light. In this universe that is allowed.`,
    short: thrown
      ? `The lane threw it out, ${thrown.short} light-years short of the next star. The rest is on its own drive: ${n(thrown.years)} years.`
      : null,
    out: `It comes out by another star, in year ${j.arrives}: ${n(years)} years, not ${n(j.byDrive)}.`,
    rows: [
      {
        head: "🚀 What",
        text: `${who}${word} through ${lanes} to ${star ? starWordsOf(star) : "another star"} ${j.distance} light-years away.`,
      },
      {
        head: "⏳ How long",
        text: `${n(years)} years. On ${drive} alone it would have been ${n(j.byDrive)}.`,
      },
      {
        head: "⛽ What it cost",
        text: `${n(j.tonnes)} tonnes of annihilation fuel, the work of ${n(j.machines)} machines, on top of the ship.`,
      },
      {
        head: "⚠ What it risked",
        text: thrown
          ? `A lane threw it out ${thrown.short} light-years short, which cost it ${n(thrown.years)} years on its own drive.`
          : "To be thrown out of a lane part way, and finish on its own drive. It came through.",
      },
      {
        head: "🌍 What it did",
        text: `${plural(did.ships, "ship has", "ships have")} gone by the lanes since it. ${did.soonest ?? (did.peoples ? `${plural(did.peoples, "people", "peoples")} met by them.` : "No people has been met by them yet.")}`,
      },
    ],
    foot: "Lanes between the stars are a law of this universe. Where the law is shut, no ship ever jumps.",
  };
}

const starWordsOf = (s: GalaxyStar) =>
  s.spectral === "white dwarf" ? "a white dwarf" : `a ${s.spectral} star`;

/** The law's own page: what it says here, who found it, what it costs and what it has done. */
export function lawPage(world: World): PageModel {
  const law = laneLawOf(world),
    year = yearNow(world),
    g = homePlanet(world).generated,
    home = g.star.ref as string,
    fn = functionsOf(g).find((f) => f.id === "open-a-lane"),
    row = PRINCIPLES.find((p) => p.id === LANE_ROW)!,
    found = firstKnown(world, LANE_ROW),
    first = lanesOf(world)?.first ?? null,
    map = laneMapOf(world),
    reached = clusterOf(world).filter((s) => laneRoute(world, home, s.ref)).length,
    nearestFolk = folksNear(world)
      .map((f) => ({
        f,
        d: Math.hypot(
          ...(() => {
            const s = map.stars[map.at.get(f.star)!]!;
            return [s.x, s.y, s.z];
          })(),
        ),
      }))
      .sort((a, b) => a.d - b.d)[0];
  const best = STAR_DRIVES.reduce((a, b) => (cruise(b) > cruise(a) ? b : a)),
    needs = row.needs.map((id) => id.split("|")).flat(),
    known = needs.map((id) => {
      const y = firstKnown(world, id),
        p = PRINCIPLES.find((x) => x.id === id);
      return stat(p?.name ?? id, y !== null ? `Known since year ${y}` : "Not yet known");
    });
  const blocks: Block[] = [];
  if (!law.open) {
    const rows = [
      stat(
        "What it says",
        "No lane runs between any two stars here, whatever anyone comes to know.",
      ),
      stat("So", "No ship ever jumps. Every crossing is made on a drive, slower than light."),
      ...(nearestFolk
        ? [
            stat(
              `The ${nearestFolk.f.name}, the nearest people`,
              `${nearestFolk.d.toFixed(1)} light-years off: ${n(crossingYears(nearestFolk.d, best))} years by the fastest drive there can be.`,
            ),
          ]
        : []),
      stat("Word between the stars", "Goes at light's speed, and no faster, for ever."),
    ];
    blocks.push({ type: "facts", title: "Why no one ever jumps here", rows });
  } else {
    blocks.push({
      type: "facts",
      title: "What it asks of a people",
      rows: [
        ...known,
        stat(
          fn ? `To ${fn.name}` : "To open a lane",
          fn?.met ? `${fn.by}: ${fn.why}` : (fn?.why ?? "Nothing here can."),
        ),
        stat(
          "Found",
          found !== null
            ? `First sounded in year ${found}, by a land that knew all of these.`
            : "Not yet, by anyone. Until someone does, light's speed holds for them.",
        ),
      ],
    });
    blocks.push({
      type: "facts",
      title: "What a lane costs",
      rows: [
        stat(
          "Time",
          `From ${laneLights(LEAST_TIDE)} to ${laneLights(1)} times light's speed, the faster the stronger the tide along it; and a ship's own drive from mouth to mouth at each star on the way.`,
        ),
        stat(
          "What a ship must carry",
          `About 20 tonnes of annihilation fuel a light-year on a middling lane, more on a thin one. A tonne is the work of ${n(LANE_MACHINES_TONNE)} machines.`,
        ),
        stat(
          "What it risks",
          `A lane throws out from ${Math.round(laneThrows(1) * 1000) / 10} to ${Math.round(laneThrows(LEAST_TIDE) * 100)} ships in 100, the more the thinner it is. A ship thrown out finishes that lane on its own drive.`,
        ),
        stat(
          "A ship with no lane",
          `Crosses as it always did, on its drive. ${n(map.stars.length - 1 - reached)} of these ${n(map.stars.length - 1)} stars have no way by lanes from home.`,
        ),
      ],
    });
    if (first) {
      const did = didSince(world);
      blocks.push({
        type: "facts",
        title: "The first jump",
        rows: [
          stat("Who", `${first.name}, year ${first.year}`),
          stat(
            "How",
            `Through ${plural(first.hops, "lane", "lanes")}, ${first.ly} light-years, ${n(first.arrives - first.year)} years. On its drive alone, ${n(first.byDrive)}.`,
          ),
          stat(
            "Since",
            `${plural(did.ships, "ship has", "ships have")} gone by the lanes. ${did.soonest ?? ""}`.trim(),
          ),
        ],
      });
      blocks.push({ type: "tool", tool: "watch.jump", args: {} });
    } else
      blocks.push({
        type: "facts",
        title: "The first jump",
        rows: [
          stat(
            "Not yet",
            found !== null
              ? "A people knows how. No ship of theirs has gone yet."
              : "No ship has gone by a lane, and none can until someone sounds them.",
          ),
        ],
      });
  }
  return {
    ref: "world:law",
    kind: "world",
    icon: "🌀",
    title: law.open
      ? "A law of this universe: lanes between the stars"
      : "A law of this universe: no lanes",
    subtitle: [
      law.open
        ? `In this universe lanes run between the stars, and a ship in one goes faster than light. It is a law of this universe, not of every one. Year ${year}.`
        : `In this universe nothing goes faster than light, and no lane runs between the stars. It is a law of this universe, not of every one. Year ${year}.`,
    ],
    color: null,
    place: null,
    stats: [
      stat("The law", law.open ? "Open" : "Shut"),
      stat("Set by", lawSetBy(world)),
      ...(law.open
        ? [
            stat("Lanes", n(map.lanes.length)),
            stat("Stars home can reach by them", `${n(reached)} of ${n(map.stars.length - 1)}`),
          ]
        : []),
      ...(law.open && first
        ? [
            stat(
              "Worlds with a people who have been met",
              n(folksNear(world).filter((f) => arrivalsAt(world, f).length).length),
            ),
          ]
        : []),
    ],
    tabs: [{ id: "law", name: "The law", blocks }],
    followable: false,
    year,
  };
}
