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
import {
  HEAT_TREE,
  LATE_TREE,
  LAW_TREE,
  MEANS_TREE,
  SIGNAL_TREE,
} from "../../src/rules/principles.ts";
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

/**
 * The kinds' own roads (Phase 56), by name: each of the sixteen rows that were kind-bodied, none of
 * Earth's own, and all after them in the table.
 */
const KIND_ROWS = new Set([
  "diamond-grit",
  "pitch-ware",
  "cold-hammering",
  "carbide-blades",
  "sun-engines",
  "graphite-dynamos",
  "made-oxygen",
  "acid-leaching",
  "sulfur-concrete",
  "ice-ware",
  "ice-working",
  "heat-engines",
  "ground-dynamos",
  "cold-chemistry",
  "polymer-wire",
  "star-iron",
]);

/**
 * The digests taken before Phase 54, by what they cover. Re-recorded with Phase 55 M224b: Earth's
 * history moved with its deaths from its first battle on (every land of a realm sends men, and the
 * fallen are those the foe's arms strike down), and so did its towns, realms and pages.
 * Re-recorded for cohesion combat (earth-7): the surviving lands, realms, crafts and
 * discoveries change with the new campaigns. The matter guide and early camps stay identical.
 * Principles re-recorded for Phase 66: seven of them (electronics, guidance, stations, habitats, the
 * nuclear and fusion drives, the long sleep) now name what they open the way to past our ages; the
 * rest read as they did. Re-recorded for signals: thirteen (writing, philosophy, factories, electricity,
 * electronics, sea-works and the kinds' engines and dynamos) name the signal steps they open the way to;
 * every other word reads as it did.
 * Re-recorded for lessons (2026-11-12): a people's losses remembered and answered move its history
 * from the first years, and with it the towns, realms and their pages; and a smithy's page tells a
 * tool forged there, though its town has works. The guide to matter stays identical.
 */
const BEFORE: Record<string, string> = {
  tools: "a0a36af:18383",
  stuff: "3c320bd0:13619",
  ground: "9ec689ef:43974",
  deposits: "60101db1:97962",
  arms: "73cb8617:17184",
  designs: "3ae032a0:27911",
  workshops: "14207a5c:265436",
  substances: "5835b926:130632",
  reactions: "38d8a8a3:68570",
  // (Its pages no longer list what only a people of the water could find: F1, canBeFoundHere.)
  principles: "3f68db09:169878",
  guide: "ced49326:17137",
  camps: "efbd90a7:344430",
};

/**
 * What the digest reads of a page: its words. The pictures (`portrait`, `thumb`) are new in Phase 54
 * M223, and so are the links to elements (`elem:`) and the element rows' refs: each names words the
 * page already had, so a link reads as its text and an element's ref is left out. What a substance
 * can do (Phase 65) is two new blocks on its page: every other word of the page stays.
 */
const NEW_BLOCKS: ReadonlySet<unknown> = new Set(["What it can do", "What it would do here"]);
const WORDS = (key: string, value: unknown): unknown => {
  if (key === "portrait" || key === "thumb") return undefined;
  if (Array.isArray(value))
    return value.filter((x) => !NEW_BLOCKS.has((x as { title?: unknown } | null)?.title));
  if (key === "ref" && typeof value === "string" && value.startsWith("elem:")) return undefined;
  // (A link is a span, {text, ref}: only a span reads as its text; an element's row keeps its cells.)
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const { text, ref } = value as { text?: unknown; ref?: unknown };
    if (typeof text === "string" && typeof ref === "string" && ref.startsWith("elem:")) return text;
  }
  return value;
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
  // (Earth's own: the kinds' principles, Phase 56, are none of Earth's; those past our ages, Phase 66, came after, and so did signals.)
  principles: () =>
    PRINCIPLES.filter(
      (p) =>
        !KIND_ROWS.has(p.id) &&
        !HEAT_TREE.some((l) => l.id === p.id) &&
        !LAW_TREE.some((l) => l.id === p.id) &&
        !SIGNAL_TREE.some((l) => l.id === p.id) &&
        !LATE_TREE.some((l) => l.id === p.id) &&
        !MEANS_TREE.some((l) => l.id === p.id),
    ).map((p) => page(`prin:${p.id}`)),
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
    const text = JSON.stringify(of(), WORDS);
    assert.ok(text.length > 100, `${name}: something to digest (${text.length} letters)`);
    if (process.env.PRE54_RECORD) {
      console.log(`  ${JSON.stringify(name)}: ${JSON.stringify(digest(text))},`);
      return;
    }
    assert.equal(digest(text), BEFORE[name], `${name} changed`);
  });
}
