// What the world did by itself, on its page (N1): what happened, where, who died, and why here, with its land and its plates to open.
import { yearOfMoment, type HistoryEvent, type World } from "../../kernel/index.ts";
import { isProvinceWorld } from "../../gen/index.ts";
import { NATURE, faultRate, yearsBetween, type FaultKind } from "../../rules/index.ts";
import { populationContext } from "../../sim/index.ts";
import type { Block, Span } from "../../bridge/index.ts";
import { landLink, townLink } from "./names.ts";
import { link } from "./words.ts";

const MEETS: Readonly<Record<FaultKind, string>> = {
  convergent: "one goes down under the other",
  transform: "they grind past each other",
  divergent: "they draw apart",
  within: "",
};

/** A number said with its thousands marked. */
const said = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** What is told of a natural quake, fire, star or mountain beyond its claim (none: it is none of these). */
export function wildBlocks(world: World, e: HistoryEvent): Block[] {
  const d = (e.data ?? {}) as Record<string, unknown>;
  if (d.natural !== true) return [];
  const g = populationContext(world).generated;
  if (!isProvinceWorld(g)) return [];
  const m = /^cell:\d+:(\d+)$/.exec(e.place ?? ""),
    cell = m ? Number(m[1]) : -1,
    land: Span = cell >= 0 ? landLink(world, cell) : "the land",
    plate = (i: unknown): Span | null => {
      const p = typeof i === "number" ? g.tectonics.plates[i] : undefined;
      return p ? link(p.continental ? "a plate of land" : "a plate of sea floor", p.ref) : null;
    },
    out: Block[] = [];
  const dead = typeof d.dead === "number" ? d.dead : 0,
    homesBy = (d.homes && typeof d.homes === "object" ? d.homes : {}) as Record<string, number>,
    towns = Object.entries(homesBy)
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .slice(0, 6);
  if (towns.length)
    out.push({
      type: "text",
      title: "Who it struck",
      lines: [
        [`${said(dead)} died in `, land, "."],
        ...towns.map(([ref, n]): Span[] => [
          townLink(world, ref),
          `: ${said(n)} home${n === 1 ? "" : "s"} down.`,
        ]),
      ],
    });
  if (e.type === "act.quake") {
    const kind = (typeof d.kind === "string" ? d.kind : "within") as FaultKind,
      a = plate(d.plate),
      b = plate(d.across),
      mag = typeof d.mag === "number" ? d.mag : NATURE.quake.least,
      own = g.tectonics.plates[typeof d.plate === "number" ? d.plate : 0],
      rate = faultRate(kind, typeof d.steps === "number" ? d.steps : 99, own?.speed ?? 1),
      every = yearsBetween(rate, mag);
    out.push({
      type: "text",
      title: "Why here",
      lines: [
        typeof d.beside === "number"
          ? [
              "The shock had its middle in ",
              landLink(world, d.beside),
              ", and came on through the ground.",
            ]
          : a && b && kind !== "within"
            ? [
                land,
                " lies where ",
                a,
                " meets ",
                b,
                `: ${MEETS[kind]}, and what they have held back lets go.`,
              ]
            : a
              ? [land, " lies on ", a, ", far from where it meets another: a shock here is seldom."]
              : [land, " shook with no plate to blame."],
        [`A land like this has a shock so great once in about ${said(every)} years.`],
        ["As it is told of any world that shakes: ten times rarer for each step up in magnitude."],
      ],
    });
  }
  if (e.type === "wild.fire") {
    const rain = typeof d.rain === "number" ? d.rain : 1,
      flashes = typeof d.flashes === "number" ? d.flashes : 0,
      lands = typeof d.lands === "number" ? d.lands : 1,
      days = typeof d.days === "number" ? d.days : 0,
      reached = (Array.isArray(d.towns) ? d.towns : []) as string[];
    out.push({
      type: "text",
      title: "Why here",
      lines: [
        [
          `Only ${Math.round(rain * 100)} parts in a hundred of the rain `,
          land,
          ` usually has fell that year, on its ${typeof d.cover === "string" ? d.cover : "ground"}.`,
        ],
        [`Its weather brings ${flashes} flashes to a km² in a year, and one of them caught.`],
        [
          `It burned for ${said(days)} days over ${said(typeof d.km2 === "number" ? d.km2 : 0)} km²${lands > 1 ? ` and ${lands} lands` : ""}, and it stopped where there was water, or nothing left to burn.`,
        ],
        reached.length
          ? [
              `It came to ${reached.slice(0, 5).join(", ")}${reached.length > 5 ? " and more" : ""}.`,
            ]
          : ["It reached no town."],
      ],
    });
  }
  if (e.type === "act.fire") {
    out.push({
      type: "text",
      title: "Why here",
      lines: [
        [
          `The fire came out of the ${typeof d.cover === "string" ? d.cover : "land"} about the town, on the land's own dry year, and no one set it.`,
        ],
        ...e.causes.slice(0, 1).map((c): Span[] => [link("The fire on the land", c.ref)]),
      ],
    });
  }
  if (e.type === "wild.star" || e.type === "act.meteor") {
    const ground = d.ground === true,
      air = typeof d.air === "number" ? d.air : null,
      seen = typeof d.seen === "number" ? d.seen : null;
    out.push({
      type: "text",
      title: "What it left",
      lines: [
        [
          `A stone some ${typeof d.metres === "number" ? d.metres : 20} metres across`,
          ground
            ? ", whole enough to reach the ground: it leaves a pit that stays."
            : ", which burst in the air and left no pit.",
        ],
        ...(air !== null && seen !== null
          ? [
              [
                `Its world has ${air} bar of air to stop one, and ${seen} land${seen === 1 ? "" : "s"} saw it fall.`,
              ] as Span[],
            ]
          : []),
        [
          "Any world's sky brings these: a stone this size each few decades somewhere, greater ones far more seldom.",
        ],
      ],
    });
  }
  if (e.type === "wild.rise") {
    const a = plate(d.plate),
      b = plate(d.across);
    out.push({
      type: "text",
      title: "Why here",
      lines: [
        a && b
          ? [land, " lies where ", a, " goes down under ", b, ", and what melts below it comes up."]
          : [land, " lies over a hot place in its world's mantle."],
        [
          `It stood ${said(typeof d.metres === "number" ? d.metres : 0)} metres in its first year, of ${typeof d.rock === "string" ? d.rock : "rock"}.`,
        ],
      ],
    });
  }
  void yearOfMoment;
  return out;
}
