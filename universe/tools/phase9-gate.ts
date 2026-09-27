// node tools/phase9-gate.ts [--ci] — the Phase 9 gate (docs/architecture §I.9, milestone 90):
//   1. every lineage of every world is a body of its own, named for it: bodies of many
//      makes across the worlds, every living beast one, every name its own, the open worlds'
//      names made of their bodies; every world's web of several levels;
//   2. the web of eating turns in history, each turn with its why: the default world's
//      waters fished down, its grain eaten, its hunters driven out, by seven centuries;
//   3. what the people do is seen: a village's day holds many tasks, its people keep out of
//      its walls and out of one another, and what they say is its own year's; its wars are
//      drawn — hosts on their ways, a battle's two hosts in a village fought over;
//   4. one zoom, from a person to the galaxy and back, each hand-over within the phone
//      floor's budget (Chromium on this machine's discrete GPU; --ci: the ladder only,
//      untimed);
//   5. the genesis plays through, from the galaxy's birth to where to begin, and begins.
// (npm run build first.)
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";
import { YEAR, seedFromText, sphereGrid } from "../src/kernel/index.ts";
import { EARTH } from "../src/host/planet.ts";
import { generateHomeWorld } from "../src/gen/index.ts";
import { EARTHLIKE, OPEN } from "../src/rules/index.ts";
import { ECOLOGY_EVENTS } from "../src/sim/index.ts";
import { why } from "../src/causal/index.ts";
import {
  BODY_R,
  battleOf,
  clearOf,
  keepApart,
  momentOf,
  sayOf,
  villageGround,
  warPaths,
  warTokens,
} from "../src/view/index.ts";
import type { VillagePlan, WarsMap } from "../src/bridge/index.ts";

const ci = process.argv.includes("--ci");
/** The phone floor runs at a quarter of this machine's pace; a hand-over's frame there. */
const PHONE = 4,
  HANDOVER = 1000;
/**
 * Chromium on the machine's own GPU (ANGLE over Direct3D 11), not its software stand-in —
 * its discrete one: on its integrated one a headless Chromium stalls a frame for up to half
 * a second every few seconds whatever it draws (measured at M90 in the land: 6 stalls in 20 s
 * with everything drawn, 7 with nothing, 1 with the drawing stopped — none of them ours).
 */
const GPU = [
  "--use-angle=d3d11",
  "--ignore-gpu-blocklist",
  "--enable-gpu",
  "--force_high_performance_gpu",
];

const problems: string[] = [];
const say = (line: string) => console.log(`  ${line}`);
console.log("the Phase 9 gate");

// 1. Bodies of their own, named for them; webs of several levels.
{
  const worlds = [
    generateHomeWorld(seedFromText("first light"), EARTHLIKE),
    ...["alien 7", "alien 41", "alien 55", "moss", "alien 3"].map((s) =>
      generateHomeWorld(seedFromText(s), OPEN),
    ),
  ];
  const makes = new Set<string>();
  worlds.forEach((w, k) => {
    const beasts = w.life.species.filter(
      (s) => s.died === null && s.niche !== "seed grass" && s.index !== w.life.people?.species,
    );
    for (const s of beasts) {
      if (!s.body) problems.push(`${s.name} has no body`);
      else
        makes.add(
          `${s.body.legs}/${s.body.wings}/${s.body.fins}/${s.body.covering}/${s.body.moves}/${s.body.segments}`,
        );
    }
    const names = beasts.map((s) => s.name);
    if (new Set(names).size !== names.length)
      problems.push(`world ${k}: two lineages share a name`);
    if (k > 0 && names.some((n) => /\b(ox|horse|deer|sheep|goat|bear|wolf|cat)\b/.test(n)))
      problems.push(`world ${k}: an open world's beast named as Earth's`);
    const levels = new Set(beasts.map((s) => s.level));
    if (beasts.length && !(levels.has(2) && (levels.has(3) || levels.has(4))))
      problems.push(`world ${k}: its web has one level only`);
  });
  say(`${makes.size} makes of body among the living beasts of ${worlds.length} worlds`);
  if (makes.size < 12) problems.push(`only ${makes.size} makes of body`);
}

// 2. The web's turns in history; 3. what the people do, and their wars, seen.
{
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(700 * YEAR);
  const told = (type: string) => world.events.all().filter((e) => e.type === type),
    turns = [
      ["waters fished down", ECOLOGY_EVENTS.fishFew.type],
      ["grain eaten", ECOLOGY_EVENTS.grainEaten.type],
      ["hunters driven out", ECOLOGY_EVENTS.huntersGone.type],
    ] as const;
  for (const [what, type] of turns) {
    const es = told(type);
    say(`the web by year 700: ${what} in ${es.length} lands`);
    if (!es.length) problems.push(`no land had its ${what}`);
    else if (!why(world, es.at(-1)!.id).claim) problems.push(`${what}: no why`);
  }
  // A village's day: its tasks, its walls kept, its talk its own.
  const q = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T,
    map = q<{ cell: number; people: number }[]>("people.map"),
    land = [...map].sort((a, b) => b.people - a.people)[0]!,
    town = q<{ ref: string }[]>("settlements", { cell: land.cell })[0]!,
    plan = q<VillagePlan>("village.plan", { ref: town.ref }),
    ground = villageGround(plan),
    tasks = new Set<string>(),
    signs = new Set<string>(),
    day = 700 * 365 + 150;
  let inside = 0,
    crowded = 0;
  for (let s = 0; s < 86_400; s += 300) {
    // Everyone as drawn: each where their day has them, stepped aside from the others.
    const now = plan.people.map((_, i) => momentOf(plan, i, day * 86_400 + s));
    keepApart(plan, now);
    now.forEach((m, i) => {
      if (m.hidden) return;
      if (m.task) tasks.add(m.task);
      const said = sayOf(plan, i, m, s / 7);
      if (said) signs.add(said);
      for (const h of ground.homes) if (clearOf(h, m) < 1.2 - 1e-6) inside++;
    });
    const live = now.filter((m) => !m.hidden);
    for (let a = 0; a < live.length; a++)
      for (let b = a + 1; b < live.length; b++)
        if (Math.hypot(live[a]!.x - live[b]!.x, live[a]!.z - live[b]!.z) < 2 * BODY_R - 1e-6)
          crowded++;
  }
  say(
    `a village's day: ${tasks.size} kinds of work and play, ${signs.size} signs said, ${inside} steps in a wall, ${crowded} in one another`,
  );
  if (tasks.size < 5) problems.push(`a village's day holds only ${tasks.size} tasks`);
  if (!signs.size) problems.push("no one in the village said anything");
  if (inside) problems.push(`people stood in a home ${inside} times`);
  if (crowded) problems.push(`people stood in one another ${crowded} times`);
  // Its wars on the globe, and a battle in a village fought over.
  const wars = q<WarsMap>("wars.map"),
    globe = EARTH.frames.globe!(world, {} as never) as unknown as {
      meta: { frequency: number };
      arrays: { elevation: Float32Array };
    },
    fine = sphereGrid(globe.meta.frequency),
    elevation = globe.arrays.elevation,
    paths = warPaths(wars, fine, elevation),
    marching = warTokens(paths, 3).length;
  say(
    `the wars of year 700 on the globe: ${wars.wars.length} wars, ${marching} marks marching or standing`,
  );
  if (!wars.wars.length || !marching) problems.push("no war was drawn on the globe");
  let battles = 0;
  for (const w of wars.wars)
    for (const b of w.battles) {
      const cell = map.find((m) => (m as { centre?: number }).centre === b.spot)?.cell;
      if (cell === undefined) continue;
      const v = q<{ ref: string }[]>("settlements", { cell })[0];
      if (!v) continue;
      const p = q<VillagePlan>("village.plan", { ref: v.ref });
      if (p.life?.battle && battleOf(p, 10, 12).length === 20) battles++;
    }
  say(`battles seen in the villages fought over: ${battles}`);
  if (!battles) problems.push("no battle was seen in a village fought over");
}

// 4. One zoom; 5. the genesis.
{
  const root = fileURLToPath(new URL("..", import.meta.url)),
    server = await preview({
      root,
      logLevel: "silent",
      preview: { port: 4252, strictPort: false },
    }),
    base = server.resolvedUrls!.local[0]!,
    browser = await chromium.launch({ args: ci ? [] : GPU }),
    page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  await page.goto(`${base}?universe=earth&year=200`);
  await page.waitForFunction(
    () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
    undefined,
    {
      timeout: 900000,
    },
  );
  await page.evaluate(async () => {
    const k = (globalThis as any).causalis,
      map = await k.client.query({ type: "people.map" }),
      top = [...map].sort((a: any, b: any) => b.people - a.people)[0];
    k.faceSpot(top.centre, 1.5);
  });
  await page.waitForTimeout(800);
  const ladder: [string, "in" | "out", string][] = [
    ["the land", "in", "region"],
    ["the village", "in", "village"],
    ["its land", "out", "region"],
    ["the world", "out", "globe"],
    ["the sky", "out", "system"],
    ["the stars", "out", "cluster"],
    ["the galaxy", "out", "galaxy"],
    ["the stars", "in", "cluster"],
    ["the sky", "in", "system"],
    ["the world", "in", "globe"],
  ];
  const worst: number[] = [];
  for (const [what, way, want] of ladder) {
    // Out, as a viewer comes to it: zoomed near the far edge first, where the next scale
    // out is readied while they look.
    if (way === "out") {
      await page.evaluate(
        "(() => { const r = globalThis.causalis.rig, o = r.options, lo = Math.log(o.minDistance), hi = Math.log(o.maxDistance); r.userZoomed = true; r.distance = Math.exp(lo + (hi - lo) * 0.96); })()",
      );
      await page.waitForTimeout(1500);
    }
    await page.evaluate(
      "(() => { const g = globalThis; g.__gaps = []; let last = performance.now(); function tick() { const n = performance.now(); g.__gaps.push(n - last); last = n; if (g.__gaps.length < 150) requestAnimationFrame(tick); } requestAnimationFrame(tick); })()",
    );
    await page.evaluate((w) => (globalThis as any).causalis.zoomThrough(w), way);
    await page.waitForTimeout(2600);
    const scale = await page.evaluate(() => (globalThis as any).causalis.scale()),
      gap = await page.evaluate(() => Math.max(...((globalThis as any).__gaps as number[])));
    worst.push(gap);
    if (scale !== want) problems.push(`zooming ${way} to ${what} came to ${scale}`);
  }
  const most = Math.round(Math.max(...worst));
  say(
    `  each hand-over's longest frame (ms): ${ladder.map(([what, way], k) => `${way} to ${what} ${Math.round(worst[k]!)}`).join(" · ")}`,
  );
  say(
    `one zoom, a person to the galaxy and back: ${ladder.length} hand-overs, the longest frame ${most} ms here (${most * PHONE} ms on the phone floor)`,
  );
  if (!ci && most * PHONE > HANDOVER)
    problems.push(`a hand-over takes a ${most * PHONE} ms frame on the phone floor`);
  // The genesis, through to where to begin, and begun.
  await page.goto(`${base}?universe=earth&genesis=1`);
  await page.waitForSelector(".genesis h2", { timeout: 600000 });
  const seen: string[] = [];
  for (let k = 0; k < 14 && !(await page.$(".genesis .choice")); k++) {
    seen.push((await page.textContent(".genesis h2")) ?? "");
    await page.waitForTimeout(1200);
    await page.click(".genesis-row button:not(.link)");
    await page.waitForTimeout(400);
  }
  const choices = await page.$$(".genesis .choice");
  say(
    `the genesis: ${seen.length} stages told (${seen.map((t) => t.split(":")[0]).join(" · ")}), ${choices.length} places to begin`,
  );
  if (seen.length < 10 || choices.length < 5)
    problems.push("the genesis did not play through to where to begin");
  else {
    await choices[0]!.click();
    await page.waitForFunction(
      () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
      undefined,
      {
        timeout: 300000,
      },
    );
    const at = await page.evaluate(() => location.search);
    say(`begun at the first people: ${at}`);
    if (/genesis/.test(at)) problems.push("choosing where to begin did not begin the world");
  }
  await browser.close();
  await server.close();
}

console.log(
  problems.length
    ? `\nthe Phase 9 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`
    : "\nthe Phase 9 gate passes",
);
process.exit(problems.length ? 1 : 0);
