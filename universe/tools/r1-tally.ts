// node tools/r1-tally.ts [--young text year | file universe]...: roads built and travelled (R1), read over whole worlds. Roads a century and what they took; how
// many gangs are out, how far along; what fraction of a town's ways reads worn, and whether that goes with who really walked them; cars and riders by age;
// how a world's people get about. Looking moves nothing: run a world on with this and it comes to the same.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { YEAR, loadWorld, rulesetId, seedFromText, type World } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { landPlan } from "../src/host/land.ts";
import { getAbout, roadKm, roadStuff } from "../src/host/roads.ts";
import { landEra } from "../src/host/village.ts";
import { townSite } from "../src/host/village.ts";
import { villagePlan } from "../src/host/village.ts";
import { roadPage } from "../src/host/inspect/road.ts";
import { populationContext } from "../src/sim/index.ts";
import { lotStates } from "../src/bridge/index.ts";
import {
  aboardNow,
  carClear,
  carNow,
  longWalks,
  ridesOf,
  roadNow,
  townScene,
  wornOf,
  worksShare,
} from "../src/view/index.ts";
import { momentOf } from "../src/view/village.ts";

const S =
  process.env.R1_S ??
  "C:/Users/danie/AppData/Local/Temp/claude/012ed59c4c3b9498/970ae8a7-18ac-474f-b847-1a4244a20182/scratchpad/";
const WORLDS: {
  name: string;
  u: "earth" | "alien";
  file?: string;
  seed?: string;
  year?: number;
}[] = [
  { name: "first light 2000", u: "earth", file: `${S}p68/earth-out/earth--first_light--2000.save` },
  { name: "harrow 348 3000", u: "alien", file: `${S}p72/final/harrow.save` },
  {
    name: "kestrel 557 2000 (water)",
    u: "alien",
    file: `${S}w2-list-out/alien--kestrel_557--2000.save`,
  },
  {
    name: "vale 471 2000 (no fire, no grip)",
    u: "alien",
    file: `${S}w2-list-out/alien--vale_471--2000.save`,
  },
  {
    name: "gale 710 2000 (carbon)",
    u: "alien",
    file: `${S}w2-list-out/alien--gale_710--2000.save`,
  },
  {
    name: "harrow 259 2000 (hive)",
    u: "alien",
    file: `${S}w2-list-out/alien--harrow_259--2000.save`,
  },
  { name: "first light 300 (young)", u: "earth", seed: "first light", year: 300 },
];
const only = process.argv[2];
const open = (w: (typeof WORLDS)[number]): World => {
  const U = w.u === "earth" ? EARTH : ALIEN;
  if (w.file) {
    const doc = JSON.parse(gunzipSync(readFileSync(w.file)).toString("utf8"));
    return loadWorld(
      doc,
      (s) => U.build(s),
      rulesetId(U.build(seedFromText(doc.seed)), U.version),
      {
        allowRulesetChange: true,
      },
    ).world;
  }
  const world = U.build(seedFromText(w.seed!));
  world.runTo(w.year! * YEAR);
  return world;
};
const BAD = /undefined|NaN|\[object|\bnull\b/;
const plain = (b: { text?: string; lines?: readonly (readonly unknown[])[] }) =>
  (b.lines ?? [])
    .map((l) => l.map((s) => (typeof s === "string" ? s : (s as { text: string }).text)).join(""))
    .join(" | ");

for (const spec of WORLDS) {
  if (only && !spec.name.includes(only)) continue;
  const t0 = Date.now(),
    world = open(spec),
    ctx = populationContext(world),
    y = world.now / YEAR,
    tile = 2.4,
    size = 128;
  let roads = 0,
    gangs = 0,
    gangsNew = 0,
    stopped = 0,
    cuts = 0,
    km = 0,
    planMs = 0,
    plans = 0;
  const byLook: Record<string, number> = {},
    centuries = new Map<number, { roads: number; km: number; tonnes: number }>(),
    stuffs = new Map<string, number>(),
    shares: number[] = [];
  let firstGang: { ref: string; cell: number; town: string } | null = null,
    lines: string[] = [];
  const cells: number[] = [];
  const seen = new Set<number>();
  for (const s of ctx.settlements.all()) {
    if (s.population > 0 && !seen.has(s.cell)) {
      seen.add(s.cell);
      cells.push(s.cell);
    }
  }
  for (const cell of cells.slice(0, 400)) {
    const a = Date.now(),
      plan = landPlan(world, cell, 60);
    planMs += Date.now() - a;
    plans++;
    for (const r of plan.roads) {
      roads++;
      const n = roadNow(r, y),
        long = roadKm(size, tile, r.from, r.to);
      km += long;
      byLook[n.behind] = (byLook[n.behind] ?? 0) + 1;
      for (const st of r.stages ?? []) {
        if (st.until > y) continue;
        const c = Math.floor(st.until / 100) * 100,
          e = centuries.get(c) ?? { roads: 0, km: 0, tonnes: 0 },
          stuff = roadStuff(world, cell, st.what);
        e.roads++;
        e.km += long;
        e.tonnes += stuff.tonnes * long;
        centuries.set(c, e);
        stuffs.set(stuff.short, (stuffs.get(stuff.short) ?? 0) + 1);
      }
      if (n.works) {
        gangs++;
        if (!n.works.again) gangsNew++;
        if (n.stopped) stopped++;
        shares.push(worksShare(n.works, y));
        if (!firstGang && r.ref) firstGang = { ref: r.ref, cell, town: r.a };
      }
      if (r.cut && y >= r.cut.from && y < r.cut.until) cuts++;
    }
  }
  console.log(
    `\n== ${spec.name}: ${((Date.now() - t0) / 1000) | 0}s to read; ${cells.length} peopled lands`,
  );
  console.log(
    `  roads ${roads}, ${Math.round(km)} km; by look ${JSON.stringify(byLook)}; plan ${(planMs / Math.max(1, plans)).toFixed(1)} ms a land`,
  );
  console.log(
    `  gangs out ${gangs} (${gangsNew} new, ${gangs - gangsNew} laying afresh), stopped ${stopped}, cut ${cuts}; share along: ${shares
      .slice(0, 8)
      .map((x) => x.toFixed(2))
      .join(" ")}`,
  );
  console.log(
    `  stuffs: ${[...stuffs]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k, v]) => `${k} ${v}`)
      .join("; ")}`,
  );
  console.log(
    `  by century (finished stages): ${[...centuries]
      .sort((a, b) => a[0] - b[0])
      .slice(-6)
      .map(([c, e]) => `${c}: ${e.roads} ${Math.round(e.km)} km ${Math.round(e.tonnes / 1000)} kt`)
      .join("; ")}`,
  );
  const about = getAbout(world, cells[0]!, landEra(world, cells[0]!));
  console.log(`  gets about: ${JSON.stringify(about)}`);
  if (firstGang) {
    const page = roadPage(world, firstGang.ref),
      text = page.tabs[0]!.blocks.map((b) => plain(b as never)).join(" || ");
    console.log(`  a road: ${page.title}: ${text}`);
    console.log(
      `  stats: ${page.stats.map((s) => `${s.label}: ${JSON.stringify(s.value).slice(0, 80)}`).join("; ")}`,
    );
    if (BAD.test(text)) console.log(`  BAD WORDS in ${firstGang.ref}`);
  }
  // A town: its worn ground against who really walked; cars and riders.
  const towns = [...ctx.settlements.all()]
      .filter((s) => s.population > 0)
      .sort((a, b) => b.population - a.population),
    pick = [towns[0], towns[Math.floor(towns.length / 3)], towns.at(-1)].filter(Boolean);
  for (const s of pick) {
    const site = townSite(world, s!.ref);
    if (!site) continue;
    const a0 = Date.now(),
      plan = villagePlan(world, s!.ref, 12, 300),
      a1 = Date.now();
    if (!plan.town) {
      console.log(`  ${s!.name}: no town plan (${s!.population})`);
      continue;
    }
    const scene = townScene(plan.town, world.now),
      b0 = Date.now(),
      worn = wornOf(scene),
      b1 = Date.now(),
      day = Math.floor(world.now / 86400),
      rides = ridesOf(plan),
      c1 = Date.now();
    // Who really walked: at each worn stretch's middle and at an unworn one's, how many went within a street of it over a day.
    const WALK = 6,
      nearCount = (x: number, z: number) => {
        let n = 0;
        for (let i = 0; i < plan.people.length; i += 2) {
          for (let h = 6; h < 20; h += 1) {
            const m = momentOf(plan, i, day * 86400 + h * 3600);
            if (Math.hypot(m.x - x, m.z - z) < WALK * 3) n++;
          }
        }
        return n;
      },
      top = worn.pieces.slice(0, 6),
      low = worn.pieces.slice(-6),
      topN = top.reduce((n, p) => n + nearCount(p.x, p.z), 0),
      lowN = low.reduce((n, p) => n + nearCount(p.x, p.z), 0);
    // Cars: clear of walls; riders: long walks.
    let clear = 0,
      cars = 0,
      riding = 0,
      longs = 0;
    for (const o of rides.owners.values()) {
      cars++;
      if (carClear(plan, o.door)) clear++;
      const c = carNow(plan, o, day * 86400 + 12 * 3600, true);
      if (!c.riding && carClear(plan, c)) clear++;
      else if (c.riding) clear++;
    }
    for (const i of rides.riders) {
      const w = longWalks(plan, i, day, 130);
      if (w.length) longs++;
      if (aboardNow(plan, i, day * 86400 + 7 * 3600, true)) riding++;
    }
    const bands = [0, 0, 0, 0, 0];
    for (const p of worn.pieces) bands[p.band]!++;
    void lotStates;
    console.log(
      `  ${s!.name} (${s!.population} people, ${plan.town.lots} lots drawn of ${plan.town.whole}): worn ${worn.worn} of ${worn.ways} ways (${Math.round((100 * worn.worn) / Math.max(1, worn.ways))}%), bands ${bands.join("/")}, green ${worn.pieces.filter((p) => p.green > 0.5).length}, read in ${b1 - b0} ms; plan ${a1 - a0} ms; walkers by the most worn ${topN}, by the least ${lowN}; cars ${cars} (clear ${clear} of ${cars * 2}), riders ${rides.riders.size}, long walks ${longs}, aboard at 7am ${riding}, lines ${rides.lines.length}; rides read in ${c1 - b1} ms`,
    );
  }
  lines = [];
  void lines;
}

