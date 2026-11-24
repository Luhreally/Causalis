// A land's page, the planet's breadth (2026-11-23): what its warmth, rain, seasons, light and rock grow there and how its cover
// stands (rules/biomes.ts); its monsoon, the great storms its seas breed and its slopes' failing, with the last that struck it;
// and the world's air at rest, its seas' souring, its frozen ground's thaw, its slow swings and its star's companion.
import type { World } from "../../kernel/index.ts";
import { isProvinceWorld } from "../../gen/index.ts";
import {
  CARBON_CYCLE,
  cycloneChance,
  cycloneSpin,
  monsoonOf,
  seasSoured,
  shellsLeft,
  slideChance,
} from "../../rules/index.ts";
import {
  airOf,
  carbonWorld,
  coverAt,
  homeCycles,
  homePlanet,
  landSlope,
  populationContext,
  riverMovesOn,
  skyOf,
  struckOn,
} from "../../sim/index.ts";
import type { Block } from "../../bridge/index.ts";
import { count, stat } from "./words.ts";

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** What a land grows, and the storms, monsoon and slides it is open to. */
export function landBreadthBlocks(world: World, cell: number): Block[] {
  const g = homePlanet(world).generated,
    fine = isProvinceWorld(g) ? g.fine : g;
  if (g.tectonics.elevation[cell] === undefined) return [];
  const cover = coverAt(g, cell),
    sky = skyOf(fine),
    lat = (g.grid.lat[cell]! * 180) / Math.PI,
    monsoon = monsoonOf(g.climate.seasonality[cell]!, lat, g.climate.inland[cell]!),
    blocks: Block[] = [];
  blocks.push({
    type: "facts",
    title: "What it grows",
    rows: [
      stat(
        "Growth",
        `${pct(cover.growth)} of the most any land grows: the lesser of what its warmth and its rain allow, over the part of its year it grows in`,
      ),
      stat(
        "Its sky and rock",
        `light ${sky.light.toFixed(2)} of Earth's${sky.light < 0.9 || sky.light > 1.1 ? ", its life's pigment fitted to it" : ""}; rock ${sky.rock.toFixed(2)} of Earth's goodness`,
      ),
      stat("Its rain against its demand", `${cover.moist.toFixed(2)} (1: even)`),
      stat("Its cover", `${pct(cover.woody)} woods, ${pct(cover.open)} grass and open ground`),
    ],
  });
  let ctx;
  try {
    ctx = populationContext(world);
  } catch {
    ctx = null;
  }
  const rows = [];
  if (monsoon > 0.05)
    rows.push(
      stat("Monsoon", `${pct(monsoon)}: its rain comes in one season, and swings the more`),
    );
  if (g.tectonics.elevation[cell]! > 0) {
    let sea = -Infinity;
    for (let k = g.grid.offsets[cell]!; k < g.grid.offsets[cell + 1]!; k++) {
      const m = g.grid.neighbours[k]!;
      if (g.tectonics.elevation[m]! <= 0) sea = Math.max(sea, g.climate.temperature[m]!);
    }
    const storm = cycloneChance(sea, cycloneSpin(lat, g.planet.dayHours));
    if (storm > 0)
      rows.push(
        stat(
          "Great storms",
          `about one in ${Math.round(1 / storm)} years, off a sea at ${sea.toFixed(1)} degrees`,
        ),
      );
    if (ctx) {
      const slope = landSlope(ctx, cell),
        slide = slideChance(slope, 1, 0);
      if (slide > 0)
        rows.push(
          stat(
            "Slopes",
            `steep (${slope.toFixed(3)}): bared of woods, one slide in ${Math.round(1 / slide)} years at its usual rain`,
          ),
        );
    }
  }
  for (const m of riverMovesOn(world, cell).slice(0, 2))
    rows.push(
      stat(
        `River moved, year ${m.year}`,
        "a great flood broke it out of its bed for a lower way across the plain",
      ),
    );
  const struck = struckOn(world, cell).slice(0, 3);
  for (const s of struck)
    rows.push(
      stat(
        s.kind === "storm" ? `Storm, year ${s.year}` : `Slide, year ${s.year}`,
        `${count(s.dead)} dead, ${Math.round(s.fields / 10)}% of the harvest`,
      ),
    );
  if (rows.length) blocks.push({ type: "facts", title: "Its storms, slopes and rivers", rows });
  return blocks;
}

/** The world's air at rest, its seas, its frozen ground, its slow swings and its star's companion. */
export function worldBreadthBlock(world: World): Block {
  const g = homePlanet(world).generated,
    cw = carbonWorld(g),
    air = world.hasStore("climate.air") ? airOf(world).air : null,
    rest = air?.rest,
    cycles = homeCycles(g),
    companion = g.system.companion,
    rows = [
      stat(
        "Its air at rest",
        cw.facts.weathers
          ? `${count(Math.round(rest ?? CARBON_CYCLE.rest))} parts in a million of carbon: where its rain's wearing of its rock (land ${pct(cw.facts.land)} of its face, ${cw.facts.warmth.toFixed(1)} degrees, ${Math.round(cw.facts.rain)} mm) takes down what its fire below breathes out`
          : "as it was made: its liquid wears no rock to stone",
      ),
    ];
  if (air && rest !== undefined) {
    const sour = seasSoured(air.carbon, rest);
    if (cw.facts.weathers && sour > 0.01)
      rows.push(
        stat(
          "Its seas",
          `${sour.toFixed(2)} of a pH more acid than at rest; their shells and reefs give ${pct(shellsLeft(sour))}`,
        ),
      );
    if ((air.thawed ?? 0) > 0)
      rows.push(
        stat(
          "Its frozen ground",
          `${count(Math.round(air.thawed ?? 0))} ppm of its carbon thawed, ${count(Math.round(air.rotted ?? 0))} rotted into the air`,
        ),
      );
  }
  rows.push(
    stat(
      "Its slow swings",
      `its axis wobbles round once in ${count(Math.round(cycles.precessYears))} years; its tilt nods ${cycles.tiltAmp.toFixed(1)} degrees over ${count(Math.round(cycles.tiltYears))}${cycles.steadied ? ", steadied by its moon" : ", with no great moon to steady it"}; its orbit's ellipse breathes by ${cycles.eccAmp.toFixed(3)}`,
    ),
  );
  if (companion)
    rows.push(
      stat(
        "Its star's companion",
        `a star of ${companion.mass.toFixed(2)} Suns ${count(Math.round(companion.a))} times Earth's distance out, ${companion.moons >= 1 ? `${count(Math.round(companion.moons))} times as bright as a full moon` : "a bright star"} in its sky`,
      ),
    );
  return { type: "facts", title: "Its planet's slow work", rows };
}
