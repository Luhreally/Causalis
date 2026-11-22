// A stronghold's or seat's page (bridge/strongholds.ts; asked 2026-11-21): whose it is, what it is built of, the battles it
// answers, why it stands as it does now, and why it stands where it does. Pure reads of the world.
import type { Ref, World } from "../../kernel/index.ts";
import { populationContext, townsOf } from "../../sim/index.ts";
import {
  HOLD_WORDS,
  holdPlaces,
  townLots,
  type Line,
  type PageModel,
  type Stat,
} from "../../bridge/index.ts";
import { townRank } from "../rank.ts";
import { townPlan } from "../town.ts";
import { townSite } from "../village.ts";
import { link, many, stat, yearNow } from "./words.ts";
import { townLink } from "./names.ts";
import { townPartOf } from "./fabric.ts";

const STATE_WORDS = {
  held: "manned",
  kept: "kept up and lived in",
  ruin: "a ruin",
} as const;

/** The page of a town's stronghold or seat: `hold:<town>:<k>`. */
export function holdPage(world: World, ref: string): PageModel {
  const at = townPartOf(ref),
    f = at ? townsOf(world).get(at.town) : undefined,
    s = at ? populationContext(world).settlements.get(at.town) : undefined,
    h = at && f ? townRank(world, at.town, f)?.holds?.find((x) => x.k === at.rest[0]) : undefined,
    year = yearNow(world);
  if (!at || !s || !h) return unknown(world, ref, at?.town ?? null, year);
  const hold = h.hold,
    what = hold.form ?? hold.show!,
    title = `${cap(HOLD_WORDS[what].split(",")[0]!)}`,
    // (Where it stands, as its town's view lays it: bridge/holdplaces.ts.)
    site = townSite(world, at.town as Ref),
    plan = site ? townPlan(world, at.town as Ref, site.axis, f!.next, site.water) : null,
    lots = plan
      ? townLots(plan.family, plan.seed, plan.axis, plan.lots, plan.water, plan.site ?? null)
      : null,
    places = plan && lots ? holdPlaces(plan, lots).filter((p) => p.hold.k === h.k) : [],
    spot = places[0],
    stats: Stat[] = [
      stat("Whose", [link(cap(h.name), h.ref)]),
      ...(hold.form
        ? [
            stat("Raised", `year ${hold.raised}`, { why: hold.answers.at(-1)?.event ?? null }),
            stat("Now", STATE_WORDS[hold.state]),
            stat("Built of", hold.stone ? "stone" : "earth and timber"),
            stat("Answers", many(hold.answers.length, "battle", "battles")),
          ]
        : []),
      ...(hold.show ? [stat("Seat", HOLD_WORDS[hold.show].split(",")[0]!)] : []),
    ],
    lines: Line[] = h.whys.map((w) => [w]);
  if (spot)
    lines.push([
      `It stands ${Math.round(Math.hypot(spot.x, spot.z))} m from the square, where an attacker would face the most: ${
        spot.climb >= 2 ? `${spot.climb} m up the town's rise` : "on the level"
      }${spot.wet >= 0.15 ? `, water on ${Math.round(spot.wet * 12)} of its twelve sides` : ""}, off the roads in.`,
    ]);
  if (h.hamlet)
    lines.push([
      `Its land is an estate: ${h.hamlet} cottages of the tenants who work it stand about it in a hamlet.`,
    ]);
  return {
    ref,
    kind: "building",
    icon: hold.form && hold.state !== "ruin" ? "🏰" : hold.form ? "🧱" : "🏛️",
    title: `${title} of ${h.name}`,
    subtitle: ["By ", townLink(world, s.ref)],
    color: null,
    place: { scale: "village", town: s.ref },
    stats,
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          { type: "facts", rows: [...stats, stat("Town", [townLink(world, s.ref)])] },
          { type: "text", lines },
          ...(hold.answers.some((t) => t.event)
            ? [
                {
                  type: "list" as const,
                  title: "Battles it answers",
                  items: hold.answers
                    .filter((t) => t.event)
                    .map((t) => ({
                      line: [
                        link(`The battle of year ${t.year}`, t.event!),
                        t.foe ? ` against ${t.foe}` : "",
                        t.weight < 1 ? ", beside its land" : ", on its land",
                      ],
                    })),
                },
              ]
            : []),
        ],
      },
    ],
    followable: false,
    year,
  };
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function unknown(world: World, ref: string, town: string | null, year: number): PageModel {
  return {
    ref,
    kind: "unknown",
    icon: "❔",
    title: "A stronghold",
    subtitle: town ? ["By ", townLink(world, town)] : ["By a town now gone"],
    color: null,
    place: null,
    stats: [],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [{ type: "text", lines: [["Nothing stands there that is known."]] }],
      },
    ],
    followable: false,
    year,
  };
}
