// node tools/w3-gate.ts [--ci] [--soft] [--shots dir] [--earth file.save] [--alien file.save]: gate 75, rockets (war-reach-plan.md W3),
// at a phone's size. Two worlds, Earth and one alien, each either a far save or (as on CI) run to a few centuries and two neighbouring
// realms taught to throw, given works and machines and set at war: what the gate then sees is history's own year of war.
//   1. a rocket's numbers read off the world: Earth's first some 300 km, a heavy world's none, a small light world's around it;
//   2. history struck: a war.strike of kind rocket with the war as its cause, in the war store, its land's works stopped;
//   3. the town: no machine over it, a streak down from high up, its flash, then its lots alight as any fire's;
//   4. the land: its way over the land, its mark;
//   5. the globe: its way from where it left to where it fell;
//   6. the pages: the town's says what fell on it and whose; the war's lists it apart from raids; the rocket's reads its numbers;
//   7. no error in the page. Everything seen is looked for in the pixels: a list count is not a sight.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium } from "playwright";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type World,
} from "../src/kernel/index.ts";
import { meansNumbers, meansOfWorld } from "../src/gen/index.ts";
import { SPREAD } from "../src/bridge/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { G, firstRocket, principle, rocketOn, type Principle } from "../src/rules/index.ts";
import {
  WAR,
  WAR_EVENTS,
  frontier,
  loreOf,
  politiesOf,
  populationContext,
  warsOf,
  type MarketStore,
  type Polity,
  type WarStrike,
} from "../src/sim/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots");
if (shots) mkdirSync(shots, { recursive: true });
const slow = (ms: number) => (ci || soft ? ms * 4 : ms);
const GPU = [
  "--enable-gpu",
  "--ignore-gpu-blocklist",
  "--use-angle=d3d11",
  "--force_high_performance_gpu",
];
const problems: string[] = [],
  check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
  },
  say = (s: string) => console.log(`  ${s}`);
console.log("gate 75, rockets");

// 1. The numbers: pure, on anchors anyone can state.
const ground = (pull: number, radius: number, airBar = 1, kelvin = 288) => ({
  pull,
  radius,
  airBar,
  kelvin,
});
const earthFirst = rocketOn(ground(1, 1), 4.2, 1),
  earthStages = rocketOn(ground(1, 1), 4.2, 3),
  heavy = firstRocket(ground(2.6, 1.4), 4.2),
  light = rocketOn(ground(0.15, 0.3), 4.2, 1);
say(
  `Earth's numbers: ${Math.round(earthFirst.reachKm)} km, in three stages ${Math.round(earthStages.reachKm)} km; pull 2.6: ${heavy ? "throws" : "none"}; pull 0.15, radius 0.3: ${light.around ? "around" : `${Math.round(light.reachKm)} km`}`,
);
check(
  earthFirst.reachKm > 220 && earthFirst.reachKm < 380,
  `Earth's first lands ${earthFirst.reachKm} km`,
);
check(earthStages.reachKm > 2000, `Earth's in stages lands ${earthStages.reachKm} km`);
check(heavy === null, "a world of pull 2.6 throws");
check(light.around, "a small light world's first rocket does not go around it");

type Forged = {
  readonly bytes: Buffer;
  readonly universe: "earth" | "alien";
  readonly seed: string;
  readonly strike: WarStrike;
  readonly by: string;
  readonly t: number;
};

/** A far save as it is, its next rockets run to; else a world of a few centuries with two neighbouring realms taught to throw. */
function worldWithStrike(
  universe: "earth" | "alien",
  seed: string,
  year: number,
  file?: string,
): Forged {
  const u = universe === "earth" ? EARTH : ALIEN,
    started = performance.now();
  let world: World;
  if (file) {
    const doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
        typeof loadWorld
      >[0],
      probe = u.build(seedFromText(doc.seed));
    world = loadWorld(doc, (s) => u.build(s), rulesetId(probe, u.version), {
      allowRulesetChange: true,
    }).world;
  } else {
    world = u.build(seedFromText(seed));
    world.runTo(year * YEAR);
  }
  const ctx = populationContext(world),
    wars = warsOf(world),
    now = () => Math.floor((world.now - 1) / YEAR);
  if (!file) {
    // Two neighbours, the greatest with a frontier between them, given what the far years give them.
    const realms = politiesOf(world),
      living = [...realms.living()].sort((a, b) => b.members.length - a.members.length);
    let pair: [Polity, Polity] | null = null;
    for (const a of living) {
      for (const b of living)
        if (a !== b && frontier(ctx, a, b).length) {
          pair = [a, b];
          break;
        }
      if (pair) break;
    }
    if (!pair) throw new Error("no two realms border each other");
    const [a, b] = pair,
      lore = loreOf(world),
      markets = world.store<MarketStore>("economy.markets"),
      told = world.events.emit({
        type: WAR_EVENTS.declared.type,
        subjects: [a.ref, b.ref],
        place: ctx.provinces.get(a.seat)!.ref,
        causes: [],
        data: { a: "", b: "" },
      });
    for (const p of [a, b]) {
      for (const id of [
        "gunpowder",
        "electricity",
        "astronomy",
        "rocketry",
        "electronics",
        "guidance",
        "thrown-loads",
      ])
        if (!lore.get(p.seat, id))
          lore.learn(p.seat, id, { year: now(), event: told }, principle(id) as Principle);
      for (const c of p.members) {
        const m = markets.of(c);
        m.stock[G.machines] = 1e6;
        m.works ??= told;
      }
    }
    const ref = world.minter.mint(WAR);
    wars.add({
      ref,
      attacker: a.ref,
      defender: b.ref,
      declared: now(),
      event: told,
      prize: frontier(ctx, a, b)[0]!,
      battles: [],
      fallen: [0, 0],
      ended: null,
      peace: null,
    });
  }
  // To the turn that brings a fall of rockets of some size (a lone lot is over before it can be seen).
  let strike: WarStrike | undefined;
  for (let k = 0; k < (file ? 60 : 4) && !(strike && strike.homes >= 6); k++) {
    const had = wars.allStrikes().length;
    world.runTo(world.now + YEAR);
    const all = wars
      .allStrikes()
      .slice(had)
      .filter((s) => s.kind === "rocket");
    strike = [...all].sort((p, q) => q.homes - p.homes)[0];
  }
  if (!strike) throw new Error(`no rockets fell on ${seed}`);
  const event = world.events.get(strike.event)!,
    data = event.data as { a: string; km: number },
    n = meansNumbers(ctx.generated),
    charge = meansOfWorld(ctx.generated).worksCharge;
  check(!!firstRocket(n, charge?.mj), `${seed}: its numbers say no rocket, and yet one fell`);
  check(event.type === WAR_EVENTS.strike.type, "the strike's event is not a war.strike");
  check(
    event.causes.some((c) => c.ref === wars.get(strike.war)!.event),
    "the strike does not cite its war",
  );
  check(event.subjects[0] === strike.town, "the strike's event does not name its town first");
  check(strike.from !== undefined, "the strike does not say where they left from");
  say(
    `${seed}: pull ${n.pull.toFixed(2)}, radius ${n.radius.toFixed(2)}, on ${charge?.name}: year ${strike.year}, ${strike.flyers} thrown from ${data.km} km, ${strike.landed} landed on ${strike.town}: ${strike.dead} dead, ${strike.homes} homes, ${strike.machines} machines, works stopped ${strike.idled}; made in ${((performance.now() - started) / 1000).toFixed(0)} s`,
  );
  const bytes = gzipSync(
    JSON.stringify(saveWorld(world, rulesetId(world, u.version), { universe: u.name })),
  );
  return { bytes, universe, seed, strike, by: data.a, t: world.now };
}

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4275, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: ci || soft ? 1 : 2,
    hasTouch: true,
    isMobile: true,
  }),
  page = await context.newPage(),
  errors: string[] = [];
page.setDefaultTimeout(slow(60000));
page.on("pageerror", (e) => errors.push(`${e.message}\n${e.stack ?? ""}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const ask = <T>(type: string, args: unknown = {}) =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const until = async (what: string, ok: () => Promise<boolean>, ms = slow(60000)) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(80);
  }
  problems.push(`${what} did not come`);
  return false;
};
const settle = (ms: number) => page.waitForTimeout(slow(ms));
const advanceTo = async (t: number) => {
  await k(`globalThis.causalis.client.advance(${Math.round(t)})`);
  await until(`the clock at ${t}`, async () =>
    k<boolean>(`globalThis.causalis.client.status.t >= ${Math.round(t)} - 1`),
  );
};
const open = async (ref: string) => {
  await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
  await settle(700);
};
const closePages = () =>
  k(
    `document.querySelectorAll(".page-window .close, .page-close, [aria-label='Close']").forEach((e) => e.click())`,
  );

/**
 * How many of these spots on the screen can be told from what is around them: each looked for in the pixels about
 * where it should be, against the edge of that box (machinesSeen in w2-gate.ts). Those under the top bar are left out.
 */
async function seenAt(
  spots: readonly { x: number; y: number }[],
  r0 = 16,
): Promise<{ seen: number; of: number }> {
  const bar = await k<number>(
      `document.querySelector("#hud .panel, .village-panel")?.getBoundingClientRect().bottom ?? 120`,
    ),
    open = spots.filter((p) => p.x > r0 + 4 && p.x < 430 - r0 - 4 && p.y > bar + 10 && p.y < 900);
  if (!open.length) return { seen: 0, of: 0 };
  const png = (await page.screenshot()).toString("base64");
  const seen = await page.evaluate(
    async ([data, spots, r0]) => {
      const bitmap = await createImageBitmap(
          await (await fetch(`data:image/png;base64,${data as string}`)).blob(),
        ),
        c = new OffscreenCanvas(bitmap.width, bitmap.height),
        x = c.getContext("2d")!,
        k = bitmap.width / innerWidth;
      x.drawImage(bitmap, 0, 0);
      const lum = (d: Uint8ClampedArray, i: number) =>
        d[i]! * 0.3 + d[i + 1]! * 0.59 + d[i + 2]! * 0.11;
      let n = 0;
      for (const p of spots as { x: number; y: number }[]) {
        const r = Math.round((r0 as number) * k),
          w = 2 * r,
          d = x.getImageData(Math.round(p.x * k) - r, Math.round(p.y * k) - r, w, w).data;
        const ref =
          (lum(d, 0) + lum(d, (w - 1) * 4) + lum(d, w * (w - 1) * 4) + lum(d, (w * w - 1) * 4)) / 4;
        let most = 0;
        for (let i = 0; i < d.length; i += 4) most = Math.max(most, Math.abs(lum(d, i) - ref));
        if (most > 30) n++;
      }
      return n;
    },
    [png, open, r0] as const,
  );
  return { seen, of: open.length };
}

/** A world as the page takes it up: kept under its own name, then opened by it. */
async function takeUp(f: Forged): Promise<void> {
  const name = `${f.universe}:gate75`,
    q = `universe=${f.universe}&seed=${encodeURIComponent(f.seed)}`;
  await page.goto(`${base}?${q}&hold=1`);
  await page.waitForFunction(
    () => !!(globalThis as { causalis?: { client?: unknown } }).causalis?.client,
    undefined,
    { timeout: slow(120000) },
  );
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  const b64 = f.bytes.toString("base64");
  await page.evaluate(
    async ([data, keep]) => {
      const bytes = Uint8Array.from(atob(data as string), (c) => c.charCodeAt(0));
      const c = (
        globalThis as unknown as {
          causalis: {
            client: {
              importSave(b: Uint8Array): Promise<unknown>;
              save(n: string): Promise<unknown>;
            };
          };
        }
      ).causalis.client;
      await c.importSave(bytes);
      await c.save(keep as string);
    },
    [b64, name],
  );
  await page.goto(`${base}?${q}&load=${encodeURIComponent(name)}&hold=1`);
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  await k("globalThis.causalis.client.setSpeed(0)");
}

async function watch(f: Forged, tag: string): Promise<void> {
  await takeUp(f);
  const { strike } = f;
  // The town: no machine over it; a streak from high up, its flash, its lots alight.
  await k(`globalThis.causalis.goTo(${JSON.stringify(strike.town)})`);
  await until(
    `${tag}: the town`,
    async () =>
      k<boolean>(
        `globalThis.causalis.scale() === "village" && globalThis.causalis.planNow?.()?.ref === ${JSON.stringify(strike.town)}`,
      ),
    slow(120000),
  );
  await settle(1500);
  const struck = await k<
    { kind: string; at: number; homes: number; raid?: { by: string; rocket?: boolean } }[]
  >(
    `(globalThis.causalis.planNow()?.town?.struck ?? []).filter((s) => s.event === ${JSON.stringify(strike.event)})`,
  );
  check(
    struck.length === 1 && !!struck[0]!.raid?.rocket,
    `${tag}: the town's plan does not tell the rockets`,
  );
  check(!!struck[0]?.raid?.by, `${tag}: the fall does not say whose`);
  const at = struck[0]?.at ?? f.t,
    from = at + SPREAD.rocketFrom;
  // The eye goes to it by itself before they come.
  await advanceTo(from - 8);
  await until(
    `${tag}: the eye on the sky`,
    async () =>
      k<boolean>(
        // (Low over the roofs; or, over a city of spires, from above their tops.)
        `(Math.abs(globalThis.causalis.rig.pitch + 8) < 1 || Math.abs(globalThis.causalis.rig.pitch + 24) < 1) && !globalThis.causalis.rig.flying`,
      ),
    slow(30000),
  );
  await shot(`${tag}-2-clear-sky`);
  await advanceTo(from);
  await settle(1000);
  const during = await k<{
    raid: { flyers: number; streaks: number; bursts: number; by: string | null };
    alight: number;
  } | null>("globalThis.causalis.blaze()");
  say(`${tag}: as the first lands ${JSON.stringify(during?.raid)}`);
  check((during?.raid.streaks ?? 0) > 0, `${tag}: no streak over the town`);
  check((during?.raid.flyers ?? 1) === 0, `${tag}: machines over the town for a rocket`);
  const whose = await k<(string | undefined)[]>(
    `(globalThis.causalis.planNow()?.town?.struck ?? []).filter((s) => s.raid?.rocket && s.at === ${at}).map((s) => s.raid.by)`,
  );
  check(
    whose.includes(during?.raid.by ?? ""),
    `${tag}: said to be ${during?.raid.by}'s, not of ${whose.join(", ")}`,
  );
  const sky = await seenAt(
    await k<{ x: number; y: number }[]>("globalThis.causalis.streaksOnScreen()"),
  );
  say(`${tag}: ${sky.seen} of ${sky.of} streaks where the screen shows sky can be told from it`);
  check(
    sky.of > 0 && sky.seen === sky.of,
    `${tag}: ${sky.seen} of ${sky.of} streaks can be seen on the screen`,
  );
  await shot(`${tag}-3-streak`);
  await advanceTo(from + 2);
  await settle(800);
  const flash = await k<{ raid: { bursts: number } } | null>("globalThis.causalis.blaze()");
  say(`${tag}: its flash ${JSON.stringify(flash?.raid)}`);
  check((flash?.raid.bursts ?? 0) > 0, `${tag}: no flash where it landed`);
  await shot(`${tag}-4-flash`);
  await advanceTo(from + SPREAD.rocketAll + 600);
  await settle(1500);
  const after = await k<{ raid: { streaks: number }; alight: number } | null>(
    "globalThis.causalis.blaze()",
  );
  say(`${tag}: after it, ${after?.alight} lots alight`);
  check((after?.alight ?? 0) > 0, `${tag}: no lot burns after the fall`);
  check((after?.raid.streaks ?? 1) === 0, `${tag}: the streak stays over the town`);
  await shot(`${tag}-5-lots-burning`);
  // The pages.
  await open(strike.town);
  const townWords = JSON.stringify(await ask<unknown>("page", { ref: strike.town }));
  check(
    /Rockets fell on it/.test(townWords),
    `${tag}: the town's page does not say what fell on it`,
  );
  check(
    whose.some((w) => w && townWords.includes(w)),
    `${tag}: the town's page does not say by whom`,
  );
  await shot(`${tag}-6-town-page`);
  await open(strike.war);
  const warWords = JSON.stringify(await ask<unknown>("page", { ref: strike.war }));
  check(/Rockets thrown/.test(warWords), `${tag}: the war's page lists no rockets`);
  await shot(`${tag}-7-war-page`);
  await open("prin:thrown-loads");
  const prin = JSON.stringify(await ask<unknown>("page", { ref: "prin:thrown-loads" }));
  check(/The rocket here/.test(prin), `${tag}: the rocket's page reads no numbers`);
  await shot(`${tag}-8-rocket-page`);
  await closePages();
  // The land, the days after: its way drawn over it.
  await k(`globalThis.causalis.goTo(${JSON.stringify(`cell:0:${strike.cell}`)})`);
  await until(
    `${tag}: the land`,
    async () => k<boolean>(`globalThis.causalis.scale() === "region"`),
    slow(120000),
  );
  await settle(1500);
  await advanceTo(f.t + 86_400 * 30);
  await settle(1500);
  const land = await k<{
    raids: number;
    flyers: number;
    arcs: number;
    words: readonly string[];
  } | null>("globalThis.causalis.landRaids?.() ?? null");
  say(`${tag}: on the land ${JSON.stringify(land)}`);
  check((land?.arcs ?? 0) > 0, `${tag}: no rocket's way over the land`);
  check((land?.flyers ?? 1) === 0, `${tag}: machines drawn for a rocket on the land`);
  await k("globalThis.causalis.faceLandArc()");
  await settle(1200);
  const onLand = await seenAt(
    await k<{ x: number; y: number }[]>("globalThis.causalis.landArcsOnScreen()"),
    18,
  );
  say(`${tag}: ${onLand.seen} of ${onLand.of} ways on the land's screen can be told from it`);
  check(
    onLand.of > 0 && onLand.seen >= Math.ceil(onLand.of / 2),
    `${tag}: a rocket's way on the land can't be seen (${onLand.seen} of ${onLand.of})`,
  );
  await shot(`${tag}-9-land`);
  // The globe, its way from where it left to where it fell.
  await k(`globalThis.causalis.zoomThrough("out")`);
  await until(
    `${tag}: the globe`,
    async () => k<boolean>(`globalThis.causalis.scale() === "globe"`),
    slow(60000),
  );
  await k(`globalThis.causalis.closePage?.()`);
  await k(`globalThis.causalis.faceSpot(${strike.cell}, 2.1)`);
  await settle(2500);
  const onGlobe = await seenAt(
    await k<{ x: number; y: number }[]>("globalThis.causalis.globeArcsOnScreen()"),
    12,
  );
  say(`${tag}: ${onGlobe.seen} of ${onGlobe.of} ways on the globe's screen can be told from it`);
  check(
    onGlobe.seen > 0,
    `${tag}: no rocket's way can be seen on the globe (${onGlobe.seen} of ${onGlobe.of})`,
  );
  await shot(`${tag}-10-globe`);
}

try {
  await watch(worldWithStrike("earth", "first light", 450, arg("--earth")), "earth");
  await watch(worldWithStrike("alien", "harrow 348", 400, arg("--alien")), "alien");
} catch (e) {
  problems.push(`${(e as Error).message}\n${(e as Error).stack ?? ""}`);
}
for (const e of errors) problems.push(`in the page: ${e}`);
await browser.close();
await server.close();
if (problems.length) {
  console.error(`gate 75 FAILED:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("gate 75 passed");
process.exit(0);
