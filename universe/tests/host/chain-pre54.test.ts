// Earth's pages stay as they were through Phase 54 (novel elements): every page and chain a world's
// own chemistry could touch — tools and their chains from the ground, a land's stuff, clay and stone,
// its ground and deposits, realms' arms and their designs, the workshops of the greatest towns, every
// substance, reaction and principle, the guide to matter, the camps' crafts — digested on the Earth
// seed before the change. On Earth the world's chemistry is the Sun's own, so none of it may move.
// (PRE54_RECORD=1 prints the digests to record.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type World } from "../../src/kernel/index.ts";
import { isProvinceWorld } from "../../src/gen/index.ts";
import { PRINCIPLES, REACTIONS, SUBSTANCES } from "../../src/rules/index.ts";
import { designsOf, homePlanet, politiesOf, populationContext } from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import {
  armsMade,
  hostWords,
  landClay,
  landStone,
  toolMade,
  townStuff,
} from "../../src/host/chain.ts";
import { groundBlocks } from "../../src/host/inspect/ground.ts";
import { campCraft } from "../../src/host/camp.ts";
import { landCamps } from "../../src/host/land.ts";
import { campRef } from "../../src/host/inspect/camp.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import type { VillagePlan } from "../../src/bridge/index.ts";

/** The digests taken before Phase 54, by what they cover. */
const BEFORE: Record<string, string> = {
  tools: "a9a2ac9b:18817",
  stuff: "d7f49f5e:13888",
  ground: "3c992ee4:44092",
  deposits: "401053d2:97902",
  arms: "ec33816c:12221",
  designs: "12091860:26200",
  workshops: "a5b6a8a4:83582",
  substances: "cec4f2c9:130586",
  reactions: "ea8b9849:68485",
  principles: "39b0fd2d:168050",
  guide: "ced49326:17137",
  camps: "cfc0a711:332618",
};

/** FNV-1a over a text, with its length. */
function digest(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${h.toString(16)}:${text.length}`;
}

/** The n most peopled lands of a world, the most first. */
function lands(world: World, n: number): number[] {
  return populationContext(world)
    .provinces.all()
    .map((p) => ({ cell: p.cell, people: p.total() }))
    .sort((a, b) => b.people - a.people || a.cell - b.cell)
    .slice(0, n)
    .map((x) => x.cell);
}

const world = EARTH.build(seedFromText("first light"));
world.runTo(700 * YEAR);
const early = EARTH.build(seedFromText("first light"));
early.runTo(40 * YEAR);
const page = (ref: string) => pageOf(world, ref);
const q = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T;

const top = lands(world, 20),
  g = homePlanet(world).generated,
  fine = isProvinceWorld(g) ? g.fine : g,
  realms = politiesOf(world)
    .living()
    .filter((p) => designsOf(world).of(p.ref))
    .slice(0, 12),
  towns = q<{ ref: string }[]>("towns.map").slice(0, 12);

const CATEGORIES: Record<string, () => unknown> = {
  tools: () => top.map((c) => toolMade(world, c, `pre54:${c}`, 700, false)),
  stuff: () => top.map((c) => [townStuff(world, c, 700), landClay(world, c), landStone(world, c)]),
  ground: () => top.map((c) => groundBlocks(world, c)),
  // (Every deposit's page: the most peopled lands may hold none.)
  deposits: () => fine.deposits.map((d) => page(d.ref)),
  arms: () =>
    realms.map((p) => {
      const parts = designsOf(world).of(p.ref)!.parts;
      return [
        hostWords(world, p.ref, parts),
        parts.map((part) => armsMade(world, p.ref, part, 700)),
      ];
    }),
  designs: () => realms.map((p) => page(designsOf(world).of(p.ref)!.ref)),
  workshops: () =>
    towns.flatMap((t) => {
      const plan = q<VillagePlan>("village.plan", { ref: t.ref });
      return (plan.town?.civics ?? [])
        .filter((c) => ["smithy", "kiln", "workshop", "factory"].includes(c.kind))
        .map((c) => page(`bldg:${t.ref}:${c.at}:${c.start}`));
    }),
  substances: () => SUBSTANCES.map((s) => page(`subst:${s.id}`)),
  reactions: () => REACTIONS.map((r) => page(`rxn:${r.id}`)),
  principles: () => PRINCIPLES.map((p) => page(`prin:${p.id}`)),
  guide: () => page("world:matter"),
  camps: () =>
    lands(early, 10).flatMap((c) =>
      landCamps(early, c).map((camp) => [
        campCraft(early, c, camp.tile),
        pageOf(early, campRef(c, camp.id)),
      ]),
    ),
};

for (const [name, of] of Object.entries(CATEGORIES)) {
  test(`Earth's ${name} as before Phase 54`, () => {
    const text = JSON.stringify(of());
    assert.ok(text.length > 100, `${name}: something to digest (${text.length} letters)`);
    if (process.env.PRE54_RECORD) {
      console.log(`  ${JSON.stringify(name)}: ${JSON.stringify(digest(text))},`);
      return;
    }
    assert.equal(digest(text), BEFORE[name], `${name} changed`);
  });
}
