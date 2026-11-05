// node tools/w2-gate.ts [--ci] [--soft] [--shots dir] [--earth file.save] [--alien file.save]: gate 74, wings (war-reach-plan.md W2),
// at a phone's size. Two worlds, Earth and one alien, each either a far save or (as on CI) run to a few centuries and two neighbouring
// realms taught to fly, given works and fuel and set at war: what the gate then sees is history's own year of war.
//   1. a machine's numbers read off the world: Titan's trivially easy, Mars's out of reach, a world where nothing burns shut, with a page saying why;
//   2. history struck: a war.strike with the war as its cause, in the war store, its town's people down;
//   3. the town: machines over it on a run, a load falling, hits, then its lots alight as any fire's, its fallen told as a raid's;
//   4. the land: machines going to the town, its mark;
//   5. the pages: the town's says it was bombed, by whom, how many died; the war's lists it; the machine's reads its numbers;
//   6. the same save loads and says the same, and no error in the page.
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
import { meansNumbers, worldChemistry } from "../src/gen/index.ts";
import { SPREAD } from "../src/bridge/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import {
  G,
  askWkg,
  canBurn,
  flyerOn,
  liftingEngine,
  principle,
  rowReadings,
  type Principle,
} from "../src/rules/index.ts";
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
console.log("gate 74, wings");

// 1. The numbers: pure, on real anchors.
const sky = (airBar: number, kelvin: number, pull: number) => ({ airBar, kelvin, pull });
const titan = askWkg(sky(1.45, 94, 0.138)),
  mars = askWkg(sky(0.006, 210, 0.38));
say(
  `flying asks ${titan.toFixed(1)} W/kg on Titan's numbers, ${mars.toFixed(0)} on Mars's, 80 on Earth's`,
);
check(titan < 5, `Titan's numbers ask ${titan} W/kg: a man's arms should do`);
check(mars > 100, `Mars's numbers ask ${mars} W/kg`);

type Forged = {
  readonly bytes: Buffer;
  readonly universe: "earth" | "alien";
  readonly seed: string;
  readonly strike: WarStrike;
  readonly by: string;
  readonly t: number;
  readonly span: number;
};

/** A far save as it is, its next strikes run to; else a world of a few centuries with two neighbouring realms given the air. */
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
        "steam-engine",
        "factories",
        "engines",
        "gunpowder",
        "powered-wings",
        "dropped-loads",
      ])
        if (!lore.get(p.seat, id))
          lore.learn(p.seat, id, { year: now(), event: told }, principle(id) as Principle);
      const m = markets.of(p.seat);
      m.stock[G.oil] = 1e6;
      m.stock[G.machines] = 1e6;
      m.works ??= told;
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
  // To the turn that brings a strike.
  let strike: WarStrike | undefined;
  // (A far world's first of some size: a lone machine's handful of homes is over before it can be seen.)
  for (let k = 0; k < (file ? 60 : 4) && !(strike && strike.homes >= 40); k++) {
    const had = wars.allStrikes().length;
    world.runTo(world.now + YEAR);
    const all = wars.allStrikes(),
      // (What the town has burned before lies in ash in all that is drawn: a town not struck lately burns where it can be seen.)
      lately = new Set(
        all
          .slice(0, had)
          .filter((s) => world.now / YEAR - s.year < 5)
          .map((s) => s.town),
      );
    strike = all
      .slice(had)
      .filter((s) => !lately.has(s.town))
      .sort((p, q) => q.homes - p.homes)[0];
  }
  if (!strike) throw new Error(`no strike came on ${seed}`);
  const event = world.events.get(strike.event)!,
    data = event.data as { a: string; span: number };
  const n = meansNumbers(ctx.generated),
    lifts = liftingEngine(n);
  check(!!lifts, `${seed}: no engine lifts a machine, and yet it struck`);
  if (lifts) {
    const f = flyerOn(lifts, n);
    say(
      `${seed}: pull ${n.pull.toFixed(2)}, a machine of ${Math.round(f.kg)} kg, wings ${f.spanM.toFixed(0)} m, ${Math.round(f.speed * 3.6)} km/h, ${Math.round(f.reachKm)} km out and back`,
    );
  }
  check(event.type === WAR_EVENTS.strike.type, "the strike's event is not a war.strike");
  check(
    event.causes.some((c) => c.ref === wars.get(strike.war)!.event),
    "the strike does not cite its war",
  );
  check(event.subjects[0] === strike.town, "the strike's event does not name its town first");
  say(
    `${seed}: year ${strike.year}, ${strike.flyers} machines on ${strike.town}: ${strike.dead} dead, ${strike.homes} homes, ${strike.stores} food; made in ${((performance.now() - started) / 1000).toFixed(0)} s`,
  );
  const bytes = gzipSync(
    JSON.stringify(saveWorld(world, rulesetId(world, u.version), { universe: u.name })),
  );
  return { bytes, universe, seed, strike, by: data.a, t: world.now, span: data.span };
}

// What shuts it: a world where nothing burns, and heavy pull. Words true both ways.
{
  const north = ALIEN.build(seedFromText("north 292")),
    numbers = meansNumbers(populationContext(north).generated);
  check(!canBurn(numbers), "north 292 burns");
  check(
    liftingEngine(numbers) === null,
    "on a world where nothing burns an engine lifted a machine",
  );
  const line = rowReadings({
    chem: worldChemistry(populationContext(north).generated),
    means: numbers,
  }).find((r) => r.id === "fly-under-power");
  check(!!line && !line.met && /nothing burns/.test(line.why), `north 292's page: ${line?.why}`);
  say(`north 292: “${line?.why}”`);
}

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4274, strictPort: false } }),
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
page.on("crash", () => problems.push("the page crashed"));
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
const pageText = () =>
  k<string>(`(document.querySelector(".page-window, .page, [role=dialog]")?.textContent ?? "")`);
const open = async (ref: string) => {
  await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
  await settle(700);
};
const closePage = () =>
  k(`document.querySelector(".page-window .close, .page-close, [aria-label='Close']")?.click()`);

/**
 * How many of a raid's machines can be told from what is around them on the screen: each looked for in the
 * pixels about where it should be, against the edge of that box. (A list count is not a sight: this gate once
 * counted machines over a town for hours while none was drawn.)
 */
async function machinesSeen(): Promise<{ seen: number; of: number }> {
  const at = await k<{ x: number; y: number }[]>("globalThis.causalis.raidersOnScreen()"),
    bar = await k<number>(
      `document.querySelector("#hud .panel, .village-panel")?.getBoundingClientRect().bottom ?? 240`,
    ),
    open = at.filter((p) => p.x > 24 && p.x < 330 && p.y > bar + 20 && p.y < 900);
  if (!open.length) return { seen: 0, of: 0 };
  const png = (await page.screenshot()).toString("base64");
  const seen = await page.evaluate(
    async ([data, spots]) => {
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
        const r = Math.round(16 * k),
          w = 2 * r,
          d = x.getImageData(Math.round(p.x * k) - r, Math.round(p.y * k) - r, w, w).data;
        // (Against the corners of the box.)
        const ref =
          (lum(d, 0) + lum(d, (w - 1) * 4) + lum(d, w * (w - 1) * 4) + lum(d, (w * w - 1) * 4)) / 4;
        let most = 0;
        for (let i = 0; i < d.length; i += 4) most = Math.max(most, Math.abs(lum(d, i) - ref));
        if (most > 30) n++;
      }
      return n;
    },
    [png, open],
  );
  return { seen, of: open.length };
}

/** A world as the page takes it up: kept under its own name, then opened by it. */
async function takeUp(f: Forged): Promise<void> {
  const name = `${f.universe}:gate74`,
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
    {
      kind: string;
      at: number;
      homes: number;
      dead?: number;
      raid?: { by: string; flyers: number; span: number };
    }[]
  >(
    `(globalThis.causalis.planNow()?.town?.struck ?? []).filter((s) => s.event === ${JSON.stringify(strike.event)})`,
  );
  check(
    struck.length === 1 && struck[0]!.kind === "raid",
    `${tag}: the town's plan does not tell the raid`,
  );
  check(!!struck[0]?.raid?.by, `${tag}: the raid does not say whose`);
  const at = struck[0]?.at ?? f.t,
    from = at + SPREAD.raidFrom;
  // The eye goes to it by itself as the machines come.
  await advanceTo(from - 20);
  await until(
    `${tag}: the eye on the raid`,
    async () =>
      k<boolean>(
        `Math.abs(globalThis.causalis.rig.pitch + 8) < 1 && !globalThis.causalis.rig.flying`,
      ),
    slow(30000),
  );
  await shot(`${tag}-0-coming`);
  await advanceTo(from + 4);
  await settle(1200);
  const during = await k<{
    raid: { flyers: number; falling: number; bursts: number; by: string | null };
    alight: number;
    fires: number;
  } | null>("globalThis.causalis.blaze()");
  say(`${tag}: over the town ${JSON.stringify(during?.raid)}, alight ${during?.alight}`);
  check((during?.raid.flyers ?? 0) > 0, `${tag}: no machine over the town`);
  const sky = await machinesSeen();
  say(`${tag}: ${sky.seen} of ${sky.of} machines where the screen shows sky can be told from it`);
  check(
    sky.of > 0 && sky.seen >= Math.ceil(sky.of / 2),
    `${tag}: ${sky.seen} of ${sky.of} machines can be seen on the screen`,
  );
  check(
    during?.raid.by === f.by,
    `${tag}: the machines are said to be ${during?.raid.by}'s, not ${f.by}'s`,
  );
  await shot(`${tag}-1-raid-run`);
  await advanceTo(from + 24);
  await settle(1200);
  const hits = await k<{
    raid: { flyers: number; falling: number; bursts: number };
    alight: number;
  } | null>("globalThis.causalis.blaze()");
  say(`${tag}: half way ${JSON.stringify(hits?.raid)}, alight ${hits?.alight}`);
  check(
    (hits?.raid.falling ?? 0) + (hits?.raid.bursts ?? 0) > 0,
    `${tag}: no load falling or landing at the run's height`,
  );
  await shot(`${tag}-2-load-falling`);
  await advanceTo(from + 1500);
  await settle(1500);
  const after = await k<{ raid: { flyers: number }; alight: number; fires: number } | null>(
    "globalThis.causalis.blaze()",
  );
  say(`${tag}: after it, ${after?.alight} lots alight`);
  check((after?.alight ?? 0) > 0, `${tag}: no lot burns after the raid`);
  check((after?.raid.flyers ?? 0) === 0, `${tag}: the machines stay over the town`);
  await shot(`${tag}-3-lots-burning`);
  // The pages.
  await open(strike.town);
  const town = (await ask<unknown>("page", { ref: strike.town })) as object,
    townWords = JSON.stringify(town);
  check(/Bombed/.test(townWords), `${tag}: the town's page does not say it was bombed`);
  check(townWords.includes(f.by), `${tag}: the town's page does not say by whom`);
  await shot(`${tag}-4-town-page`);
  await open(strike.war);
  const warWords = JSON.stringify(await ask<unknown>("page", { ref: strike.war }));
  check(/Struck from the air/.test(warWords), `${tag}: the war's page lists no strike`);
  await shot(`${tag}-5-war-page`);
  await open("prin:powered-wings");
  const prin = JSON.stringify(await ask<unknown>("page", { ref: "prin:powered-wings" }));
  check(/The machine here/.test(prin), `${tag}: the machine's page reads no numbers`);
  await shot(`${tag}-6-machine-page`);
  await closePage();
  // Played again from the town's page: that morning, the world's clock held, its machines over the town and to be seen.
  const told = JSON.stringify(await ask<unknown>("page", { ref: strike.town }));
  check(told.includes('"watch.raid"'), `${tag}: the town's page offers no way to watch its raid`);
  const clock = await k<number>("globalThis.causalis.client.status.t");
  check(
    await k<boolean>(`globalThis.causalis.watchRaid(${JSON.stringify(strike.event)})`),
    `${tag}: the raid could not be played again`,
  );
  await until(
    `${tag}: the raid's machines played again`,
    async () =>
      (await k<{ raid: { flyers: number } } | null>("globalThis.causalis.blaze()"))?.raid.flyers! >
      0,
    slow(30000),
  );
  await settle(3000);
  const again = await k<{ raid: { flyers: number; falling: number; bursts: number } } | null>(
    "globalThis.causalis.blaze()",
  );
  say(`${tag}: played again ${JSON.stringify(again?.raid)}`);
  check(
    (await machinesSeen()).seen > 0 || (again?.raid.falling ?? 0) + (again?.raid.bursts ?? 0) > 0,
    `${tag}: nothing of the raid to be seen played again`,
  );
  await until(
    `${tag}: the raid's loads played again`,
    async () => {
      const r = (
        await k<{ raid: { falling: number; bursts: number } } | null>("globalThis.causalis.blaze()")
      )?.raid;
      return (r?.falling ?? 0) + (r?.bursts ?? 0) > 0;
    },
    slow(45000),
  );
  await shot(`${tag}-6b-played-again`);
  check(
    (await k<number>("globalThis.causalis.client.status.t")) === clock,
    `${tag}: the world's clock ran on while it was played again`,
  );
  await k("globalThis.causalis.stopRaidFilm()");
  check(
    (await k<number | null>("globalThis.causalis.raidFilming()")) === null,
    `${tag}: the raid went on playing when stopped`,
  );
  // The land.
  await open(`cell:0:${strike.cell}`);
  await k(`globalThis.causalis.goTo(${JSON.stringify(`cell:0:${strike.cell}`)})`);
  await until(
    `${tag}: the land`,
    async () => k<boolean>(`globalThis.causalis.scale() === "region"`),
    slow(120000),
  );
  await settle(1500);
  await k(
    `document.querySelectorAll(".page-window .close, .page-close").forEach((e) => e.click())`,
  );
  const land = await k<{ raids: number; flyers: number; words: readonly string[] } | null>(
    "globalThis.causalis.landRaids?.() ?? null",
  );
  say(`${tag}: on the land ${JSON.stringify(land)}`);
  check((land?.raids ?? 0) > 0, `${tag}: no strike marked on the land`);
  await shot(`${tag}-7-land`);
}

try {
  const earth = worldWithStrike("earth", "first light", 450, arg("--earth"));
  await watch(earth, "earth");
  await watch(worldWithStrike("alien", "harrow 348", 400, arg("--alien")), "alien");
} catch (e) {
  problems.push(`${(e as Error).message}\n${(e as Error).stack ?? ""}`);
}
for (const e of errors) problems.push(`in the page: ${e}`);
await browser.close();
await server.close();
if (problems.length) {
  console.error(`gate 74 FAILED:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("gate 74 passed");
process.exit(0);
