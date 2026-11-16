// The planet in motion, on the home world's page (Round D): how far its ground has turned and why (its air, its ice's
// light, its star, the god's hand), its ice and seas against as it was made and the lands they drowned or bared, its
// seas' overturning and the coasts its currents warm, its field and what it keeps off, and its star's life. Pure reads.
import { yearOfMoment, type World } from "../../kernel/index.ts";
import { currentsOf } from "../../gen/index.ts";
import { STAR_LIFE, starLifeOf } from "../../rules/index.ts";
import { homeField, homePlanet, homeStarLife, motionOf, starEnded } from "../../sim/index.ts";
import type { Block, Item, Stat } from "../../bridge/index.ts";
import { landLink } from "./names.ts";
import { count, item, link, stat } from "./words.ts";

const signed = (d: number, unit: string) =>
  `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d) < 10 ? Math.abs(d).toFixed(1) : Math.round(Math.abs(d))} ${unit}`;
const km2 = (n: number) => `${count(Math.round(n / 1000) * 1000)} km²`;

/** How long a span of years reads. */
export function yearsWords(y: number): string {
  if (y >= 1e9) return `${(y / 1e9).toFixed(1)} billion years`;
  if (y >= 1e6) return `${(y / 1e6).toFixed(y >= 1e8 ? 0 : 1)} million years`;
  if (y >= 1e4) return `${count(Math.round(y / 1000) * 1000)} years`;
  return `${count(Math.round(y))} years`;
}

const STAGE_WORDS = {
  main: "burning its hydrogen, brightening slowly",
  subgiant: "its core's hydrogen spent, swelling",
  giant: "a swollen giant, near its end",
  ended: "ended",
} as const;

/** A star's life, for its page: how far through it is, how fast it brightens, when it swells and how it ends. */
export function starLifeBlocks(
  world: World,
  star: { readonly ref: string; readonly mass: number; readonly ageGyr: number },
  lifetimeGyr: number,
): Block[] {
  const year = yearOfMoment(world.now),
    life = starLifeOf(star.mass, star.ageGyr, lifetimeGyr, year),
    ended = starEnded(world, star.ref as never),
    rows: Stat[] = [
      stat(
        "How far through its life",
        life.outlasts
          ? `${Math.round(life.through * 1000) / 10} in a hundred: its life is longer than the universe has yet lasted`
          : `${Math.round(life.through * 1000) / 10} in a hundred of ${yearsWords(life.lifetimeGyr * 1e9)}`,
      ),
      stat(
        "Now",
        ended ? `ended in year ${ended.year}, as a ${ended.how}` : STAGE_WORDS[life.stage],
      ),
      stat(
        "Its light",
        life.stage === "ended"
          ? "gone"
          : `${life.risen >= 0 ? "up" : "down"} ${(Math.abs(life.risen) * 100).toPrecision(2)} in a hundred since the chronicle began; ${(life.perKyr * 100).toPrecision(2)} in a hundred more each thousand years`,
      ),
      ...(life.swellsIn !== null
        ? [stat("It swells to a giant", `in ${yearsWords(life.swellsIn)}`)]
        : []),
      ...(life.endsIn !== null
        ? [
            stat(
              "Its end",
              `in ${yearsWords(life.endsIn)}, as ${life.end === "supernova" ? `a supernova, stripping the air of worlds within ${STAR_LIFE.harmLy} light-years` : "a white dwarf, dim and small, its worlds left in the cold"}`,
            ),
          ]
        : []),
    ];
  return [
    {
      type: "facts",
      title: "Its life",
      rows,
    },
    {
      type: "text",
      lines: [
        [
          "A star brightens as it burns its hydrogen, warming its worlds; at the end it swells and its worlds burn, then it shrinks to an ember and they freeze. What its worlds' peoples live on goes with it: they must leave, or end.",
        ],
      ],
    },
  ];
}

/** The coasts its currents warm and cool the most (its lands, by the mean of their fine lands'). */
function coasts(world: World): {
  warm: [number, number][];
  cold: [number, number][];
  warmed: number;
} {
  const g = homePlanet(world).generated,
    f = g.fine,
    c = currentsOf(f).warmth,
    rows: [number, number][] = [];
  let warmed = 0;
  for (let p = 0; p < g.offworld.base; p++) {
    let sum = 0,
      n = 0;
    for (let k = g.childOffsets[p]!; k < g.childOffsets[p + 1]!; k++) {
      const x = g.children[k]!;
      if (f.tectonics.elevation[x]! <= 0) continue;
      sum += c[x]!;
      n++;
    }
    if (!n) continue;
    const mean = sum / n;
    if (Math.abs(mean) >= 0.3) rows.push([p, mean]);
    if (mean >= 1) warmed++;
  }
  rows.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  return {
    warm: rows.filter((r) => r[1] > 0).slice(0, 3),
    cold: rows
      .filter((r) => r[1] < 0)
      .slice(-3)
      .reverse(),
    warmed,
  };
}

/** The home world's ground in motion, on its page. */
export function motionBlocks(world: World): Block[] {
  const store = motionOf(world),
    g = homePlanet(world).generated,
    field = homeField(g.fine),
    year = yearOfMoment(world.now),
    blocks: Block[] = [];
  const s = store?.state;
  if (s && store) {
    let made = 0,
      now = 0;
    const r = 6371 * g.planet.radius;
    for (let i = 0; i < store.cells.length; i++) {
      const a = g.fine.grid.areas[store.cells[i]!]! * r * r;
      if (store.made[i]! >= 30) made += a;
      if (store.ice[i]! >= 30) now += a;
    }
    const lands = [...store.lands.values()],
      drowned = lands.filter((l) => l.drowned),
      bared = lands.filter((l) => l.bared),
      thawed = lands.filter((l) => l.thawed),
      iced = lands.filter((l) => l.iced),
      sea = s.seaIce + s.swell;
    blocks.push(
      {
        type: "text",
        title: "🌊 The ground in motion",
        lines: [
          [
            "Its ground follows its air, its ice and its star: ice sheets grow by their snow and waste by their summers, the seas rise by what the ice gives them and swell as their deep warms, and the land under a risen sea is drowned, the shelf a fallen one bares is land. Woods, grass, tundra and desert follow the warmth by the rule that named them when the world was made.",
          ],
        ],
      },
      {
        type: "facts",
        title: "Its warmth",
        rows: [
          stat("Its ground", `${signed(s.ground, "degrees")} against as it was made`),
          stat("From its air", signed(s.ground - s.albedo - s.star, "degrees")),
          stat("From its ice's light", signed(s.albedo, "degrees")),
          stat("From its star", signed(s.star, "degrees")),
        ],
      },
      {
        type: "facts",
        title: "Ice and seas",
        rows: [
          stat("Ice sheets", `${km2(now)}, against ${km2(made)} as it was made`),
          stat(
            "Its seas",
            `${signed(sea, "m")}: ${signed(s.seaIce, "m")} of ice gone into them, ${signed(s.swell, "m")} as their deep warms`,
            s.seaEvent ? { why: s.seaEvent } : {},
          ),
          stat("Lands drowned", count(drowned.length)),
          stat("Lands bared", count(bared.length)),
          stat("Lands thawed", count(thawed.length)),
          stat("Lands iced over", count(iced.length)),
        ],
      },
    );
    const turned: Item[] = [...drowned, ...bared, ...thawed, ...iced]
      .slice(0, 12)
      .map((l) =>
        item(
          [
            landLink(world, l.cell),
            l.drowned
              ? ` — ${Math.round(l.share / 10)} in a hundred drowned`
              : l.bared
                ? ` — ${Math.round(-l.share / 10)} in a hundred bared`
                : l.thawed
                  ? " — its ice gone"
                  : " — iced over",
          ],
          l.drowned ?? l.bared ?? l.thawed ?? l.iced,
        ),
      );
    if (turned.length) blocks.push({ type: "list", title: "Lands it has turned", items: turned });
    for (const [title, i, units, scale, note] of [
      ["Its seas", 2, "m", 10, "Metres against as the world was made."],
      [
        "Its ground's warmth",
        1,
        "degrees",
        100,
        "Degrees against as the world was made: its air, its ice, its star and the god's hand.",
      ],
      ["Its ice sheets", 3, "thousand km²", 1, "What its sheets cover."],
      [
        "Its seas' overturning",
        4,
        "of a hundred",
        1,
        "How hard its seas turn over, against as made: melt and warmth weaken it.",
      ],
    ] as const) {
      const points = store.past.map((r) => ({ x: r[0]!, y: r[i]! / scale }));
      if (points.length >= 2)
        blocks.push({
          type: "series",
          title,
          units,
          unit: "price",
          points,
          latest: `${points.at(-1)!.y.toFixed(1)} ${units}`,
          note,
        });
    }
  }
  // Its currents.
  const c = coasts(world),
    pct = Math.round((s?.overturn ?? 1) * 100);
  blocks.push({
    type: "facts",
    title: "Its currents",
    rows: [
      stat(
        "Its seas' overturning",
        `${pct} in a hundred of its strength as it was made${pct < 100 ? ": its warm coasts lose that share of what their currents bring them" : ""}`,
        s?.overturnEvent ? { why: s.overturnEvent } : {},
      ),
      stat("Coasts its currents warm", count(c.warmed)),
      ...c.warm.map(([p, d], i) =>
        stat(i ? "" : "Warmed most", [landLink(world, p), ` ${signed(d, "degrees")}`]),
      ),
      ...c.cold.map(([p, d], i) =>
        stat(i ? "" : "Cooled most", [landLink(world, p), ` ${signed(d, "degrees")}`]),
      ),
    ],
  });
  blocks.push({
    type: "text",
    lines: [
      [
        `Its winds' ${g.climate.bands} bands a side drive a gyre between each pair; turned by its spin, each presses a narrow, fast current against its basin's western shore, warm where it comes from the tropics and cold where from the poles, and where the trades blow along an eastern shore cold water wells up from below.`,
      ],
    ],
  });
  // Its field.
  blocks.push({
    type: "facts",
    title: "Its field",
    rows: [
      stat(
        "Its core",
        field.dynamo
          ? `molten and turning over: a field for ${yearsWords(Math.max(0, field.coreGyr - Math.min(g.star.ageGyr, 12.6)) * 1e9)} more`
          : "frozen: it makes no field",
      ),
      stat(
        "Its field",
        field.dynamo
          ? `${field.moment.toFixed(2)} of Earth's, ${field.dipole ? "one strong pair of poles" : "tangled, of many poles (it turns too slowly)"}`
          : "none",
      ),
      stat("Its star's wind", `${field.wind.toFixed(2)} of the Sun's at Earth`),
      stat(
        "It holds the wind off",
        `${field.standoff.toFixed(1)} of its radii out (Earth's about ten)`,
      ),
      stat(
        "It keeps off",
        `${Math.round(field.shelter * 100)} in a hundred of its star's particles`,
      ),
      stat(
        "What reaches its ground",
        field.dose <= 1.001
          ? "no more of the sky's particles than Earth's"
          : `${field.dose.toFixed(2)} times Earth's: a few more die of it each year, and its star's flares reach its ground`,
      ),
      stat(
        "Its air stripped",
        `${(field.stripped * 100).toPrecision(2)} in a hundred a billion years`,
      ),
    ],
  });
  // Its star.
  const life = homeStarLife(g.fine, year);
  blocks.push({
    type: "list",
    items: [
      item(
        [
          link("Its star", g.star.ref),
          `: ${STAGE_WORDS[life.stage]}, ${(life.perKyr * 100).toPrecision(2)} in a hundred brighter each thousand years`,
        ],
        g.star.ref,
      ),
    ],
  });
  if (s?.dying)
    blocks.push({
      type: "text",
      title: "☠️ A world dying",
      lines: [
        [
          link("Over half the land its people could live on is gone", s.dying),
          ": they must leave it for other worlds, or end with it.",
        ],
      ],
    });
  return blocks;
}
