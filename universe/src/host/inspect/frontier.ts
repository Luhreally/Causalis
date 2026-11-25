// The Frontier on the pages (the galaxy's hazards and the far future): on a star's page, its weather; on the home star's,
// the dangers of its sky (its storms, the great stones, the galaxy's fire); on the home world's, what lies past our ages
// (the works in the sky, bodies written for a world, minds past their makers, the going up, the ships in the dark).
// Pure reads; weapons and works are told by what, who, what they cost and what they did, never how.
import { mindLink } from "./minds.ts";
import { yearOfMoment, type Ref, type World } from "../../kernel/index.ts";
import {
  BEYOND,
  CROSSING,
  GALACTIC,
  IMPACTS,
  STAR_DRIVES,
  activeGyr,
  cruise,
  flareRate,
  lorentz,
  meanStorms,
  strikeChance,
  usualStorm,
} from "../../rules/index.ts";
import {
  burstNow,
  galacticOf,
  galacticRates,
  homeFieldAt,
  homeTurn,
  homeTurns,
  homePlanet,
  homeStrikeRate,
  homeWeather,
  impactsOf,
  mindsOf,
  rogueRate,
  upliftOf,
  mirrorsLit,
  orbitalOf,
  shipToll,
  showerOf,
  starSitesOf,
  stirredOf,
  weatherOf,
  writableOf,
  writtenSoFar,
  writtenOf,
} from "../../sim/index.ts";
import type { Block, Row, Stat } from "../../bridge/index.ts";
import { landLink, realmLink } from "./names.ts";
import { count, item, stat } from "./words.ts";

/** One in so many years, in words. */
function everyWords(perYear: number): string {
  if (!(perYear > 0)) return "never";
  if (perYear >= 1) return `${perYear >= 10 ? count(perYear) : perYear.toFixed(1)} a year`;
  const y = 1 / perYear;
  if (y >= 1e9) return `once in ${(y / 1e9).toFixed(1)} billion years`;
  if (y >= 1e6) return `once in ${(y / 1e6).toFixed(1)} million years`;
  return `once in ${count(y >= 1000 ? Math.round(y / 100) * 100 : Math.round(y))} years`;
}

const times = (x: number) =>
  x >= 100 ? count(x) : x >= 10 ? x.toFixed(0) : x >= 1 ? x.toFixed(1) : x.toPrecision(2);

/** A star's weather: how often it flares as 1859's, how long it stays young in it, and its storms at a world so far out. */
export function starWeatherBlocks(
  star: { readonly mass: number; readonly ageGyr: number },
  au: number | null,
): Block[] {
  const rate = flareRate(star.mass, star.ageGyr),
    active = activeGyr(star.mass),
    rows: Stat[] = [
      stat("Flares as great as 1859's", everyWords(rate)),
      stat(
        "Its youth in this",
        star.ageGyr <= active
          ? `still spinning fast and flaring at its height, as it will for ${active < 1 ? `${Math.round(active * 1000)} million` : `${active.toFixed(1)} billion`} years of its life`
          : `slowed long since: it flared at its height for its first ${active < 1 ? `${Math.round(active * 1000)} million` : `${active.toFixed(1)} billion`} years`,
      ),
    ];
  if (au !== null)
    rows.push(
      stat(
        "At its world",
        `its usual greatest storm a year is ${times(usualStorm(rate, au))} times 1859's at Earth; its storms sum to ${times(meanStorms(rate, au))} a year`,
      ),
    );
  return [
    { type: "facts", title: "☀️ Its weather", rows },
    {
      type: "text",
      lines: [
        [
          "A star spins fast when young and its spin snaps its field in flares; it slows as its wind carries the spin off. A small red star churns through and through and stays young in this for billions of years, and its worlds lie close to it.",
        ],
      ],
    },
  ];
}

/** The home star's sky: its storms, the great stones, the galaxy's fire. */
export function homeHazardBlocks(world: World): Block[] {
  const g = homePlanet(world).generated,
    year = yearOfMoment(world.now),
    hw = homeWeather(world),
    field = homeFieldAt(g, year),
    turn = homeTurn(g, year),
    turns = homeTurns(g).rate,
    weather = weatherOf(world),
    impacts = impactsOf(world),
    galactic = galacticOf(world),
    blocks: Block[] = [
      ...starWeatherBlocks({ mass: g.star.mass, ageGyr: g.star.ageGyr + year / 1e9 }, hw.au),
    ];
  // Its storms.
  const ws = weather?.state;
  blocks.push({
    type: "facts",
    title: "⚡ Its storms at the world",
    rows: [
      stat(
        "Its field",
        field.dynamo
          ? `keeps ${Math.round(field.shelter * 1000) / 10} in a hundred of the star's particles off; its storms ring in it and drive currents in long wires`
          : "none: the storms come down through the air instead",
      ),
      // (Its field turning over: how often by its core, and whether it is now.)
      stat(
        "Its field turning over",
        turns.chance <= 0
          ? field.dynamo
            ? "never: it has no one pole to turn"
            : "it has none to turn"
          : turn
            ? `now, from year ${turn.from} to ${turn.to}: it stands at ${Math.round(turn.weak * 100)}% of its strength, to come back the other way up, and flares and bursts reach the ground`
            : `about once in ${count(Math.round(turns.turnYears / turns.chance / 1000) * 1000)} years, for some ${count(turns.turnYears)}: then it sinks to a tenth`,
      ),
      stat("Grids it has burned", count(ws?.storms ?? 0)),
      stat("Machines burned", count(ws?.machines ?? 0)),
      stat("Dead in the dark after", count(ws?.dead ?? 0)),
      stat("Realms rebuilt against them", count(weather?.hardened.size ?? 0)),
    ],
  });
  const storms = [...(weather?.storms ?? [])].reverse();
  if (storms.length)
    blocks.push({
      type: "table",
      title: "Storms told",
      columns: ["Year", "Storm", "Grids", "Machines", "Dead"],
      fit: true,
      rows: storms.slice(0, 12).map((s): Row => ({
        ref: s.event,
        cells: [
          [String(s.year)],
          [`${times(s.storm / 100)} × 1859`],
          [s.lands ? count(s.lands) : "none"],
          [count(s.machines)],
          [count(s.dead)],
        ],
        keys: [s.year, s.storm, s.lands, s.machines, s.dead],
      })),
    });
  // The great stones.
  const rate = homeStrikeRate(world, year),
    st = impacts?.state;
  blocks.push({
    type: "facts",
    title: "☄️ The great stones",
    rows: [
      stat(
        "Struck",
        `${times(rate)} times an Earth's now: its system ${g.star.ageGyr.toFixed(1)} billion years old, its belt ${stirredOf(g) ? "stirred by a giant past the frost line" : "left whole, no giant to stir it"}${showerOf(world) ? ", and a shower of comets falling since a star passed close" : ""}`,
      ),
      ...IMPACTS.map((c) =>
        stat(
          `A stone of ${count(c.metres)} m`,
          `${Math.round(strikeChance(c, rate, 100) * 10000) / 100} in a hundred within a century`,
        ),
      ),
      stat("Fallen", count(st?.fell ?? 0)),
      stat("Turned aside", count(st?.turned ?? 0)),
      stat("Their dead", count(st?.dead ?? 0)),
      ...(st && st.dust > 0
        ? [
            stat(
              "The sky",
              `darkened by their dust: ${Math.round(st.dust * 1000) / 10} in a hundred`,
              st.dark ? { why: st.dark } : {},
            ),
          ]
        : []),
    ],
  });
  const seen = (impacts?.stones ?? []).filter((s) => s.found || s.struck || s.turned);
  if (seen.length)
    blocks.push({
      type: "list",
      title: "Stones seen",
      items: [...seen]
        .reverse()
        .slice(0, 12)
        .map((s) =>
          item(
            [
              `${s.comet ? "A comet" : "A stone"} ${count(s.metres)} m wide, `,
              ...(s.turned
                ? ["turned aside by ", realmLink(world, s.foundBy)]
                : s.struck
                  ? [`fell in ${s.year} on `, landLink(world, s.cell), `: ${count(s.dead)} dead`]
                  : [`found by `, realmLink(world, s.foundBy), `, to fall in ${s.year}`]),
            ],
            s.turned ?? s.struck ?? s.found,
          ),
        ),
    });
  // The galaxy's fire.
  const r = galacticRates(world),
    burst = burstNow(world);
  blocks.push({
    type: "facts",
    title: "💥 The galaxy's fire",
    rows: [
      stat(`A great star dying within ${GALACTIC.reachLy} light-years`, everyWords(r.supernova)),
      stat("A burst of gamma rays aimed at it", everyWords(r.gamma)),
      stat("A new star seen by eye", everyWords(r.guest)),
      stat("A rogue world through its far cloud", everyWords(rogueRate())),
      ...(galactic?.rogue
        ? [
            stat(
              "A rogue world passed",
              `in ${galactic.rogue.year}, ${count(galactic.rogue.au)} AU off: ${galactic.rogue.times} times the stones until ${galactic.rogue.until}${galactic.rogue.orbit ? ", the world's own orbit stirred" : ""}`,
              { why: galactic.rogue.event },
            ),
          ]
        : []),
      ...(burst
        ? [
            stat(
              "Now",
              `under a ${burst.kind === "gamma" ? "burst of gamma rays" : burst.kind === "white dwarf" ? "white dwarf's blast" : "great star's death"} ${count(burst.distance)} light-years off: deaths ${Math.round((burst.harm / 1000 - 1) * 100)} in a hundred higher until ${burst.year + burst.years}`,
              { why: burst.event },
            ),
          ]
        : []),
    ],
  });
  const guests = [...(galactic?.guests ?? [])].reverse();
  if (guests.length)
    blocks.push({
      type: "list",
      title: "New stars seen",
      items: guests.map((x) =>
        item(`In ${x.year}, a great star dying some ${x.kly} thousand light-years off`, x.event),
      ),
    });
  return blocks;
}

/** What lies past our ages, on the home world's page. */
export function frontierBlocks(world: World): Block[] {
  const year = yearOfMoment(world.now),
    blocks: Block[] = [
      {
        type: "text",
        title: "🛰️ Past our ages",
        lines: [
          [
            "What a people makes of its sky and of itself once it can: works on its system's small bodies that build the next of themselves, children written for the worlds they live on, minds that come to think more than their makers, and those who go up into them.",
          ],
        ],
      },
    ];
  const works = orbitalOf(world)?.all() ?? [];
  blocks.push(
    works.length
      ? {
          type: "table",
          title: "Works in the sky",
          columns: ["Realm", "Tonnes", "Sent down", "In all", "Living in it"],
          fit: true,
          rows: works.map((w): Row => ({
            ref: w.begun,
            cells: [
              [realmLink(world, w.realm)],
              [count(w.tonnes)],
              [w.taken ? "taken by its minds" : w.silent ? "silent" : `${count(w.last)} machines`],
              [count(w.sent)],
              [w.sky ? `${count(w.sky)} of ${count(w.room ?? 0)}` : "none"],
            ],
            keys: [w.realm, w.tonnes, w.last, w.sent, w.sky ?? 0],
          })),
        }
      : {
          type: "facts",
          title: "Works in the sky",
          rows: [
            stat(
              "None yet",
              "a realm with a station whose people make minds may set one on the system's small bodies",
            ),
          ],
        },
  );
  if (works.length && mirrorsLit(world, year))
    blocks.push({
      type: "text",
      lines: [["The mirrors about the star light the works: they double twice as fast."]],
    });
  const written = writtenOf(world)?.all() ?? [];
  if (written.length)
    blocks.push({
      type: "list",
      title: "Bodies written for their worlds",
      items: written.map((r) => {
        const sites = starSitesOf(world),
          far = sites?.all().find(([, s]) => s.realm === r.realm && s.arrived)?.[0],
          so = writtenSoFar(world, r),
          share = far !== undefined ? writableOf(world, far, so.limbs) : null;
        return item(
          [
            realmLink(world, r.realm),
            ` — since ${r.year}, ${Math.round(so.written * 100)} in a hundred of the way${r.limbs ? `, ${Math.round(so.limbs * 100)} in a hundred of them with limbs of machines` : ""}`,
            ...(share !== null
              ? [
                  `; at `,
                  landLink(world, far!),
                  ` its bodies can bear ${Math.round(share * 100)} in a hundred of its halls' upkeep`,
                ]
              : []),
          ],
          r.event,
        );
      }),
    });
  const raised = upliftOf(world)?.raisings ?? [];
  if (raised.length)
    blocks.push({
      type: "list",
      title: "Beasts raised to thought",
      items: raised.map((r) =>
        item(
          [
            `${r.name}, raised by `,
            realmLink(world, r.realm),
            ` in ${r.year}: ${count(r.founders)} set down in `,
            landLink(world, r.cell),
          ],
          r.event,
        ),
      ),
    });
  const minds = mindsOf(world);
  if (minds?.rows.size)
    blocks.push({
      type: "table",
      title: "Minds past their makers",
      columns: ["Realm", "Spoken of as", "Since", "Against its people", "Now"],
      fit: true,
      rows: minds.all().map((m): Row => ({
        ref: m.free ?? m.passed ?? m.realm,
        cells: [
          [realmLink(world, m.realm)],
          [mindLink(world, m.realm) ?? "not yet one"],
          [String(m.begun)],
          [
            m.past >= 0
              ? `${times(10 ** (m.past / 100))} times`
              : `one in ${count(10 ** (-m.past / 100))}`,
          ],
          [m.free ? "gone their own way" : m.passed ? "past them, kept" : "growing"],
        ],
        keys: [m.realm, m.name ?? "", m.begun, m.past, m.free ? 2 : m.passed ? 1 : 0],
      })),
    });
  if (minds && minds.up > 0)
    blocks.push({
      type: "facts",
      title: "Gone up into minds",
      rows: [
        stat("People", count(minds.up), minds.world ? { why: minds.world } : {}),
        stat("Lands half gone", count([...minds.lands.values()].filter((l) => l.gone).length)),
        stat(
          "Who goes",
          `as many of a land as its ways are open, its piety holding some back: some ${Math.round(BEYOND.goingUp * 100)} in a hundred of them a year`,
        ),
      ],
    });
  // Ships in the dark.
  const sailing = (starSitesOf(world)?.all() ?? []).filter(([, s]) => s.arrived === null);
  if (sailing.length)
    blocks.push({
      type: "table",
      title: "Ships in the dark",
      columns: ["Ship", "Speed", "Aboard", "Deaths"],
      fit: true,
      rows: sailing.slice(0, 12).map(([cell, s]): Row => {
        const d = STAR_DRIVES.find((x) => x.id === s.drive),
          v = d ? cruise(d) : 0,
          home = s.arrives - s.departed;
        return {
          ref: s.voyage as Ref,
          cells: [
            [landLink(world, cell)],
            [`${Math.round(v * 1000) / 10} in a hundred of light's`],
            [`${count(home / lorentz(v))} of ${count(home)} years`],
            [`${Math.round((shipToll(s.drive) - 1) * 100)} in a hundred higher`],
          ],
          keys: [cell, v, home, shipToll(s.drive)],
        };
      }),
    });
  blocks.push({
    type: "text",
    lines: [
      [
        `Out of any star's wind the galaxy's rays come from every side, some ${CROSSING.raysSv} sieverts a year to a body unshielded; the dust ahead strikes as the cube of a ship's speed; and a ship's clock runs slow by Lorentz's factor.`,
      ],
    ],
  });
  return blocks;
}
