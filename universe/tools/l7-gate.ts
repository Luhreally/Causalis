// node tools/l7-gate.ts [--ci] [--soft] [--shots dir] [--save file.save] [--alien file.save]: gate 88, what things cost and who pays (Lives L6, second slice), at a phone's size, by real touch.
// On far saves, else (as on CI) a young world run a few decades:
//   1. the rule: one reckoning, the words and the bands agreeing, the ramp in order;
//   2. 💰 pressed by touch: off and on side by side differ in the pixels, its colours there to be seen, a poor street and a rich one; off again, as it was; hashes the same;
//   3. a home tapped by touch through the lens: its page; its coin the lens's, the home's and a person's page's, one number;
//   4. a person's page: where they live, 🏠 Look in pressed by touch going to that home, what a day's work buys, what they pay, what is left;
//   5. the paths nobody watches: a child, one drawn nowhere, a ruler, a courtier, a people who keep no houses, a ruin, a village's ring, a town at war, a water people, a town with no market. No error, no raw ref, no sentence wrong at its zero or its one.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium, type Page } from "playwright";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type World,
} from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { COIN_WORDS, coinBand, coinOf, reckonDay, standingWords } from "../src/rules/index.ts";
import { politiesOf, populationContext, warsOf } from "../src/sim/index.ts";
import type { HomeMoney } from "../src/bridge/index.ts";
import { MONEY_RAMP, moneyStep } from "../src/view/money.ts";
import { linesOf, townRoster } from "../src/host/roster.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  saveFile = arg("--save"),
  alienFile = arg("--alien");
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
console.log("gate 88, what things cost and who pays");

// 1. The rule, pure.
{
  const a = {
    wages: 6.4,
    bread: 1.2,
    mouths: 4,
    madeHead: 25,
    standing: 0.5,
    court: false,
    rent: 0.5,
  };
  const day = reckonDay(a);
  check(Math.abs(day.earned - 6.4) < 1e-9, `a middling farmer's home earned ${day.earned}`);
  check(day.coin === coinOf(a), "the reckoning and its coin are two numbers");
  check(Math.abs(day.left - (6.4 - 4.8 - 0.5)) < 1e-9, `what is left is ${day.left}`);
  check(
    reckonDay({ ...a, wages: 1 }).left < 0 && reckonDay({ ...a, wages: 1 }).coin === 60,
    "one who falls short has more than the poorest have",
  );
  check(
    reckonDay({ ...a, standing: 0.9 }).coin > day.coin &&
      reckonDay({ ...a, court: true }).coin > day.coin,
    "standing or a seat at court moved nothing",
  );
  for (const c of [60, 199, 200, 1199, 1200, 5999, 6000, 39999, 40000, 1e7])
    check(COIN_WORDS[coinBand(c)] === standingWords(c), `the words and the band part at ${c}`);
  let last = -1;
  for (let c = 100; c <= 100000; c *= 1.3) {
    const s = moneyStep(c, 100, 100000);
    check(s >= last, `the ramp turns back at ${c}`);
    last = s;
  }
  check(
    last === MONEY_RAMP.length - 1 && moneyStep(100, 100, 100000) === 0,
    "the ramp does not reach its ends",
  );
}

type Forged = {
  readonly bytes: Buffer;
  readonly universe: "earth" | "alien";
  readonly seed: string;
};
const pack = (world: World, universe: "earth" | "alien"): Forged => {
  const u = universe === "earth" ? EARTH : ALIEN;
  return {
    bytes: gzipSync(
      JSON.stringify(saveWorld(world, rulesetId(world, u.version), { universe: u.name })),
    ),
    universe,
    seed: world.seed.text,
  };
};
const fromFile = (file: string, universe: "earth" | "alien"): Forged => {
  const u = universe === "earth" ? EARTH : ALIEN,
    doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
      typeof loadWorld
    >[0],
    probe = u.build(seedFromText(doc.seed)),
    world = loadWorld(doc, (s) => u.build(s), rulesetId(probe, u.version), {
      allowRulesetChange: true,
    }).world;
  return pack(world, universe);
};
const youngWorld = (): Forged => {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(30 * YEAR);
  return pack(world, "earth");
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4288, strictPort: false } }),
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
  page: Page = await context.newPage(),
  errors: string[] = [];
page.setDefaultTimeout(slow(60000));
page.on("pageerror", (e) => errors.push(`${e.message}\n${e.stack ?? ""}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const until = async (what: string, ok: () => Promise<boolean>, ms = slow(25000)) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(80);
  }
  problems.push(`${what} did not come`);
  return false;
};
const ask = <T>(type: string, args: unknown = {}) =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );
const shot = async (name: string) => {
  const b = await page.screenshot(shots ? { path: join(shots, `${name}.png`) } : {});
  return b.toString("base64");
};

async function loadSave(f: Forged) {
  const name = `${f.universe}:gate88`,
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
    [f.bytes.toString("base64"), name],
  );
  await page.goto(`${base}?${q}&load=${encodeURIComponent(name)}&hold=1`);
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  await page.waitForTimeout(slow(600));
}

async function press(selector: string): Promise<boolean> {
  const where = () =>
    k<{ x: number; y: number; w: number; h: number } | null>(`(() => {
    for (const e of document.querySelectorAll(${JSON.stringify(selector)})) {
      e.scrollIntoView({ block: "center" });
      const r = e.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
    }
    return null;
  })()`);
  let at = await where();
  if (!at) {
    problems.push(`nothing to press at ${selector}`);
    return false;
  }
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(slow(120));
    const now = await where();
    if (!now) break;
    if (now.x === at.x && now.y === at.y) break;
    at = now;
  }
  check(at.h >= 44 && at.w >= 44, `${selector} is ${Math.round(at.w)} by ${Math.round(at.h)} px`);
  check(
    at.x > 0 && at.x < 430 && at.y > 0 && at.y < 932,
    `${selector} lies off the screen, at ${Math.round(at.x)}, ${Math.round(at.y)}`,
  );
  await page.touchscreen.tap(at.x, at.y);
  await page.waitForTimeout(slow(300));
  return true;
}

const pageText = () => k<string>(`document.querySelector(".page-window")?.innerText ?? ""`);
const closePage = async () => {
  await k("globalThis.causalis.closePage?.()");
  await page.waitForTimeout(slow(200));
};
const readWell = (text: string, where: string) => {
  check(
    !/\b(dwell|dwelt|lot|bldg|folk|agent|prsn|rule|court|seat):[a-z0-9]/i.test(text),
    `a raw ref on ${where}: ${text.slice(0, 300)}`,
  );
  check(
    !/\b1 (rooms|people|years|homes|lots|days)\b/.test(text),
    `"1 ..." wrong on ${where}: ${text.slice(0, 300)}`,
  );
  check(
    !/\b0 (coin|days|ruins)\b|\b0\.0\b/.test(text),
    `a zero counted on ${where}: ${text.slice(0, 400)}`,
  );
  check(!/undefined|NaN|\[object/.test(text), `a broken word on ${where}: ${text.slice(0, 300)}`);
};
/** The page of someone by ref, read and shot. */
const openPage = async (ref: string, name: string): Promise<string> => {
  await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
  await page.waitForTimeout(slow(500));
  await shot(name);
  const text = await pageText();
  readWell(text, name);
  // (Its words can be read off a page that is hidden: `innerText` runs them together then. Someone must be able to see it.)
  check(
    await k<boolean>(`(() => {
      const r = document.querySelector(".page-window")?.getBoundingClientRect();
      return !!r && r.height > 40;
    })()`),
    `${name}: the page is not to be seen`,
  );
  return text;
};
/** The clock on a life's strip, as it reads. */
const hudTime = () =>
  k<string>(`document.querySelector(".life-hud .life-time")?.textContent ?? ""`);
/** A page that says where someone lives, by what it must say. */
const saysLiving = (text: string, where: string) => {
  check(/Their home/i.test(text), `${where} says not where they live: ${text.slice(0, 400)}`);
  check(
    /A day's work/i.test(text),
    `${where} says not what a day's work is: ${text.slice(0, 500)}`,
  );
};

/** The share of a shot's middle that differs from another's; the share of it near each colour of the ramp. */
const unlike = (a: string, b: string): Promise<number> =>
  page.evaluate(
    async ([p, q]) => {
      const read = async (d: string) => {
        const bm = await createImageBitmap(
            await (await fetch(`data:image/png;base64,${d}`)).blob(),
          ),
          c = new OffscreenCanvas(bm.width, bm.height),
          x = c.getContext("2d")!;
        x.drawImage(bm, 0, 0);
        return x.getImageData(
          0,
          Math.round(bm.height * 0.17),
          bm.width,
          Math.round(bm.height * 0.55),
        ).data;
      };
      const A = await read(p as string),
        B = await read(q as string);
      let n = 0;
      for (let i = 0; i < A.length; i += 16)
        if (
          Math.abs(A[i]! - B[i]!) +
            Math.abs(A[i + 1]! - B[i + 1]!) +
            Math.abs(A[i + 2]! - B[i + 2]!) >
          60
        )
          n++;
      return n / (A.length / 16);
    },
    [a, b] as const,
  );
const rampShares = (d: string): Promise<number[]> =>
  page.evaluate(
    async ([data, ramp]) => {
      const bm = await createImageBitmap(
          await (await fetch(`data:image/png;base64,${data}`)).blob(),
        ),
        c = new OffscreenCanvas(bm.width, bm.height),
        x = c.getContext("2d")!;
      x.drawImage(bm, 0, 0);
      const px = x.getImageData(
          0,
          Math.round(bm.height * 0.17),
          bm.width,
          Math.round(bm.height * 0.55),
        ).data,
        hues = (ramp as number[][]).map((c2) => {
          const m = Math.max(...c2);
          return c2.map((v) => v / m);
        }),
        seen = hues.map(() => 0);
      for (let i = 0; i < px.length; i += 8) {
        const m = Math.max(px[i]!, px[i + 1]!, px[i + 2]!);
        if (m < 40) continue;
        let best = -1,
          bestD = 0.09;
        hues.forEach((h, j) => {
          const d2 =
            Math.abs(px[i]! / m - h[0]!) +
            Math.abs(px[i + 1]! / m - h[1]!) +
            Math.abs(px[i + 2]! / m - h[2]!);
          if (d2 < bestD) {
            bestD = d2;
            best = j;
          }
        });
        if (best >= 0) seen[best]!++;
      }
      return seen.map((n) => n / (px.length / 8));
    },
    [d, MONEY_RAMP as unknown as number[][]] as const,
  );

/** The town the eye goes down to. */
async function goDown(ref: string): Promise<void> {
  await k(`globalThis.causalis.goTo(${JSON.stringify(ref)})`);
  await until(
    "the town",
    () =>
      k<boolean>(
        `globalThis.causalis.scale() === "village" && globalThis.causalis.planNow()?.ref === ${JSON.stringify(ref)}`,
      ),
    slow(60000),
  );
  await page.waitForTimeout(slow(800));
}
type MoneyState = {
  on: boolean;
  town: string | null;
  homes: number;
  shown: number;
  drawnMs: number;
  counts: number[];
  ruins: number;
  lo: number;
  hi: number;
  tenure: string | null;
  legend: string;
};
type Spot = { n: number; x: number; y: number; colour: number };
const money = () => k<MoneyState>("globalThis.causalis.money.state()"),
  moneySpots = () => k<Spot[]>("globalThis.causalis.money.spots()");
/** 💰 by touch, and its homes laid. */
const lensOn = async (): Promise<MoneyState> => {
  await press(".town-money");
  await until("the lens on", async () => {
    const s = await money();
    return s.on && !!s.legend;
  });
  await page.waitForTimeout(slow(400));
  return money();
};
const lensOff = async (): Promise<void> => {
  await press(".town-money");
  await until("the lens off", async () => !(await money()).on);
  await page.waitForTimeout(slow(300));
};
/** A lens's look at a town: on and off in the pixels, its legend read. */
const looked = async (name: string): Promise<MoneyState> => {
  const off = await shot(`${name}-off`),
    s = await lensOn(),
    on = await shot(`${name}-on`),
    parted = await unlike(off, on);
  say(
    `${name}: ${s.homes} homes (${s.ruins} ruins), ${s.lo}…${s.hi} coin, ${s.tenure}; ${(parted * 100).toFixed(0)}% of the shot differs; legend: ${s.legend.replace(/\s+/g, " ")}`,
  );
  readWell(s.legend, `${name}'s legend`);
  if (s.homes > 3)
    check(parted > 0.01, `${name}: on and off look alike, ${(parted * 100).toFixed(1)}%`);
  check(!/\b0 coin\b/.test(s.legend), `${name}: its legend says ${s.legend}`);
  return s;
};

/** A world held node side, to look through its towns for one of a kind. */
type Held = {
  readonly world: World;
  readonly towns: { ref: string; name: string; population: number; cell: number }[];
  readonly money: (town: string) => HomeMoney | null;
  readonly plan: (town: string) => {
    ref: string;
    people: {
      ref: string;
      child: boolean;
      occupation: number;
      figure?: string;
      home: number;
    }[];
    homes: unknown[];
    town: unknown;
  };
};
const held = (f: Forged): Held => {
  const doc = JSON.parse(gunzipSync(f.bytes).toString("utf8")) as Parameters<typeof loadWorld>[0],
    u = f.universe === "earth" ? EARTH : ALIEN,
    world = loadWorld(
      doc,
      (s) => u.build(s),
      rulesetId(u.build(seedFromText(doc.seed)), u.version),
      {
        allowRulesetChange: true,
      },
    ).world,
    towns = [...populationContext(world).settlements.all()]
      .filter((s) => s.population > 0)
      .sort((a, b) => b.population - a.population);
  return {
    world,
    towns,
    money: (town) => u.queries["home.money"]!(world, { town }) as HomeMoney | null,
    plan: (town) =>
      u.queries["village.plan"]!(world, {
        ref: town,
        folk: 120,
        figures: true,
      }) as ReturnType<Held["plan"]>,
  };
};
const hunt = <T>(w: Held, test: (town: Held["towns"][number], m: HomeMoney) => T | null) => {
  for (const s of w.towns.slice(0, 500)) {
    const m = w.money(s.ref),
      got = m ? test(s, m) : null;
    if (got) return { town: s, got };
  }
  // (And the small ones: a village's ring is at the far end of the list.)
  for (const s of w.towns.slice(-200)) {
    const m = w.money(s.ref),
      got = m ? test(s, m) : null;
    if (got) return { town: s, got };
  }
  return null;
};

// The tally over a world: rich and poor in its worst towns, not two examples.
const tally = (w: Held) => {
  const all = COIN_WORDS.map(() => 0);
  let homes = 0,
    spreads = 0,
    towns = 0,
    t = 0;
  for (const s of [...w.towns.slice(0, 20), ...w.towns.slice(-20)]) {
    const t0 = performance.now(),
      m = w.money(s.ref);
    t += performance.now() - t0;
    if (!m || !m.counts.reduce((a, b) => a + b, 0)) continue;
    towns++;
    m.counts.forEach((c, i) => (all[i]! += c));
    homes += m.counts.reduce((a, b) => a + b, 0);
    spreads += m.hi / Math.max(1, m.lo);
  }
  say(
    `tally of ${towns} towns, ${homes} homes: ${COIN_WORDS.map((word, i) => `${word} ${((100 * all[i]!) / Math.max(1, homes)).toFixed(0)}%`).join(", ")}; mean spread ${(spreads / Math.max(1, towns)).toFixed(0)}×; ${(t / 40).toFixed(1)} ms a town, plan and all`,
  );
};

// 2–4. A far world (or a young one).
const made = saveFile ? fromFile(saveFile, "earth") : youngWorld();
const world = held(made);
tally(world);
await loadSave(made);
const town = world.towns[Math.min(world.towns.length - 1, Math.floor(world.towns.length * 0.02))]!;
say(`${world.towns.length} towns; looking at ${town.name}, ${Math.round(town.population)} people`);
await goDown(town.ref);
const before = JSON.stringify(await ask<unknown>("hashes"));

// Nothing for one who never turns it on: no layer laid, no question asked.
const never = await money();
check(!never.on && never.homes === 0, "the lens read something before it was turned on");
const offShot = await shot("town-off");
const first = await lensOn();
const onShot = await shot("town-on");
const parted = await unlike(offShot, onShot);
const shares = await rampShares(onShot);
const seenSteps = shares.filter((s) => s > 0.002).length;
say(
  `the lens: ${first.homes} homes, ${first.shown} laid in ${first.drawnMs} ms; ${first.lo}…${first.hi} coin; ${(parted * 100).toFixed(0)}% of the shot differs; ramp in the pixels ${shares.map((s) => (s * 100).toFixed(1)).join("/")}%`,
);
check(first.shown > 0, "the lens laid nothing");
check(parted > 0.08, `on and off look alike in the shot: ${(parted * 100).toFixed(1)}%`);
check(seenSteps >= 3, `only ${seenSteps} of the ramp's colours are to be seen in the shot`);
check(/coin/.test(first.legend) && /spend/i.test(first.legend), `its legend says ${first.legend}`);
readWell(first.legend, "the legend");
// Its colours are on the screen where the homes are: most of them tally with what the host says.
const spots = await moneySpots();
check(spots.length > 0, "no home of the lens is on the screen");

// A home tapped by touch through the lens: its page, its coin one number.
const onScreen = spots.filter((s) => s.x > 30 && s.x < 400 && s.y > 240 && s.y < 640);
const tapHome = onScreen[Math.floor(onScreen.length / 2)];
check(!!tapHome, "no home to tap on the screen");
const moneyNow = await ask<HomeMoney>("home.money", { town: town.ref });
if (tapHome) {
  await page.touchscreen.tap(tapHome.x, tapHome.y);
  const opened = await until("a home's page, through the lens", () =>
    k<boolean>(`String(globalThis.causalis.pageOpen() ?? "").startsWith("dwell:")`),
  );
  await page.waitForTimeout(slow(300));
  await shot("lens-home-page");
  const text = await pageText();
  readWell(text, "a home's page, through the lens");
  check(/They pay/i.test(text), `a home's page says not what they pay: ${text.slice(0, 300)}`);
  if (opened) {
    const ref = await k<string>("globalThis.causalis.pageOpen()"),
      n = Number(ref.split(":").at(-1)),
      inside = await ask<{ coin: number } | null>("home.inside", { town: town.ref, n }),
      at = moneyNow.n.indexOf(n);
    check(at >= 0, `the home tapped, ${n}, is not among those the lens read`);
    if (inside && at >= 0)
      check(
        Math.abs(inside.coin - moneyNow.coin[at]!) <= 1,
        `a home has ${inside.coin} coin inside and ${moneyNow.coin[at]} under the lens`,
      );
    say(`tapped home ${n}: ${inside ? Math.round(inside.coin) : "?"} coin`);
  }
  await closePage();
}
await lensOff();
const backShot = await shot("town-off-again");
const backed = await unlike(offShot, backShot);
say(`off again: ${(backed * 100).toFixed(1)}% of the shot differs from before`);
check(backed < parted / 3, `the lens left something behind: ${(backed * 100).toFixed(1)}%`);

// A person's page: where they live, what a day's work buys, what is left; 🏠 Look in by touch.
const plan = await k<Held["plan"] extends (t: string) => infer R ? R : never>(
  "globalThis.causalis.planNow()",
);
const earner = plan.people.find((p) => !p.child && p.occupation > 0 && !p.figure);
const child = plan.people.find((p) => p.child);
check(!!earner, "no one grown is drawn in the town");
if (earner) {
  const text = await openPage(earner.ref, "person-page");
  saysLiving(text, "a grown person's page");
  check(
    /To live there/i.test(text),
    `a person's page says not what they pay: ${text.slice(0, 500)}`,
  );
  check(/What is left/i.test(text), `a person's page says not what is left: ${text.slice(0, 500)}`);
  check(/coin a day, as /i.test(text), `no wage on a person's page: ${text.slice(0, 500)}`);
  // One number: what their page says is left is what their home has to spend.
  const left = /(?:leaves|more than comes in)/.test(text);
  check(left, `no sum at the end of what is left: ${text.slice(0, 600)}`);
  await k(`document.querySelector(".page-window .home-look")?.scrollIntoView({ block: "start" })`);
  await page.waitForTimeout(slow(200));
  await shot("person-block");
  await press(".page-window .home-look");
  await until("their home", async () => {
    const s = await k<{ lifted: boolean; flying: boolean } | null>(
      "globalThis.causalis.home.state()",
    );
    return !!s && s.lifted && !s.flying;
  });
  await page.waitForTimeout(slow(300));
  await shot("person-home");
  const s = await k<{
    folk: { name: string }[];
    coin: number;
    ref: string;
  } | null>("globalThis.causalis.home.state()");
  check(!!s, "Look in, from a person's page, opened nothing");
  if (s) {
    check(s.folk.length > 0, "their home, by their page, holds no one");
    const near = /leaves ([\d.,]+) coin/.exec(text);
    if (near) {
      const per = (s.coin - 60) / 600,
        said = Number(near[1]!.replace(/,/g, ""));
      check(
        Math.abs(per - said) <= Math.max(0.6, said * 0.06),
        `their page says ${said} is left a day, their home's coin says ${per.toFixed(1)}`,
      );
    }
    say(`a person: home ${s.ref}, ${Math.round(s.coin)} coin`);
  }
  await press(".home-leave");
  await page.waitForTimeout(slow(400));
}
if (child) {
  const text = await openPage(child.ref, "child-page");
  check(/a child/i.test(text), `a child's page says not so: ${text.slice(0, 400)}`);
  check(!/coin a day, as /.test(text), `a child earns, by their page: ${text.slice(0, 500)}`);
  saysLiving(text, "a child's page");
  await closePage();
} else say("no child drawn here");

// One of the town's many, past those it draws: a line the roster holds, looked for node side.
{
  const roster = townRoster(world.world, town.ref as never),
    lines = linesOf(town.population),
    drawn = new Set(plan.people.map((p) => p.ref));
  let line = -1;
  for (let l = Math.min(lines - 1, 3000); l > 400 && line < 0; l--) {
    const h = roster.holder(l);
    if (h && !drawn.has(h.ref)) line = l;
  }
  if (line >= 0) {
    const text = await openPage(`folk:${town.ref}:${line}`, "person-undrawn");
    check(/not to be seen/i.test(text), `one past those drawn: ${text.slice(0, 500)}`);
    check(/Lives in/i.test(text), `one past those drawn lives nowhere: ${text.slice(0, 500)}`);
    await closePage();
  } else say("no line past those drawn in this town");
}

// A ruler's page and a courtier's, wherever they sit.
const figure = hunt(world, (s) => {
  const p = world.plan(s.ref).people;
  const ruler = p.find((x) => x.figure?.startsWith("rule:")),
    court = p.find((x) => x.figure?.startsWith("court:"));
  return ruler ? { ruler: ruler.figure!, court: court?.figure ?? null } : null;
});
if (figure) {
  const r = await openPage(figure.got.ruler, "ruler-page");
  saysLiving(r, "a ruler's page");
  check(/goes with the seat/i.test(r), `a ruler pays rent, by their page: ${r.slice(0, 700)}`);
  check(/🏠|look in/i.test(r), `a ruler's page offers no look in: ${r.slice(0, 300)}`);
  await closePage();
  if (figure.got.court) {
    const c = await openPage(figure.got.court, "court-page");
    saysLiving(c, "a courtier's page");
    await closePage();
  } else say("no courtier drawn");
} else say("no ruler in this world");

// A people who keep no houses.
const halls = hunt(world, (s, m) => (m.tenure === "halls" ? m : null));
if (halls) {
  await goDown(halls.town.ref);
  const s = await looked("halls");
  check(/no houses/i.test(s.legend), `a people of halls, by the legend: ${s.legend}`);
  const one = (
    await k<{ ref: string; child: boolean; occupation: number }[]>(
      "globalThis.causalis.planNow().people",
    )
  ).find((p) => !p.child && p.occupation > 0);
  if (one) {
    const t = await openPage(one.ref, "hall-person-page");
    saysLiving(t, "a page of one who keeps no house");
    check(/sleeping hall/i.test(t), `their home is not a hall, by their page: ${t.slice(0, 500)}`);
    check(/no family holds it/i.test(t), `one of a hall pays, by their page: ${t.slice(0, 700)}`);
    await closePage();
  }
  await lensOff();
} else say("no people of halls in this world");

// A town of many ruins.
const ruined = hunt(world, (_, m) => (m.ruins > 0 ? m : null));
if (ruined) {
  await goDown(ruined.town.ref);
  const s = await looked("ruins");
  check(/ruin/i.test(s.legend), `a town of ruins, by its legend: ${s.legend}`);
  const n = ruined.got.n[ruined.got.coin.findIndex((c) => c < 0)]!;
  const t = await openPage(`dwell:${ruined.town.ref}:${n}`, "ruin-page");
  check(/no one/i.test(t), `a ruin's page: ${t.slice(0, 300)}`);
  await closePage();
  await lensOff();
} else say("no ruins in this world");

// A village's ring.
const ring = hunt(world, (_, m) => (m.n.length && m.n[0]! >= 1_000_000 ? m : null));
if (ring) {
  await goDown(ring.town.ref);
  const s = await looked("ring");
  check(s.shown > 0, "a village's ring has nothing laid on it");
  // (The eye stands back from a ring as the lens comes on, and lifts and comes back for a card: a place read while it moves is nowhere, and on a slow machine it moves for many seconds.)
  const still = async (): Promise<Spot[]> => {
    let was = "";
    for (let i = 0; i < 60; i++) {
      await k(
        `new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))`,
      );
      const now = JSON.stringify(await moneySpots());
      if (now === was) break;
      was = now;
    }
    return moneySpots();
  };
  // (A finger among many homes, the clearest of the others first, on the bare ground of the
  // screen; the next if what opened was not a home, as gate 53 taps a gunner. What it opened
  // instead is told: a runner's tap that misses says where it went.)
  const inView = (x: Spot) => x.x > 30 && x.x < 400 && x.y > 240 && x.y < 640,
    clearest = (all: Spot[]) =>
      all
        .filter(inView)
        .map((a) => ({
          a,
          room: Math.min(
            ...all.filter((b) => b !== a).map((b) => Math.hypot(a.x - b.x, a.y - b.y)),
            999,
          ),
        }))
        .sort((p, q) => q.room - p.room)
        .map((p) => p.a);
  const ringHome = () =>
    k<boolean>(`String(globalThis.causalis.pageOpen() ?? "").startsWith("dwell:")`);
  let homePage = false,
    tried = 0;
  for (let n = 0; n < 4; n++) {
    const at = clearest(await still())[n];
    if (!at) break;
    const bare = await k<boolean>(
      `document.elementFromPoint(${at.x}, ${at.y})?.tagName === "CANVAS"`,
    );
    if (!bare) continue;
    tried++;
    await page.touchscreen.tap(at.x, at.y);
    const end = Date.now() + slow(6000);
    while (Date.now() < end && !(homePage = await ringHome())) await page.waitForTimeout(100);
    if (homePage) break;
    const now = await k<{ open: string | null; scale: string; on: boolean; body: string }>(
      `({ open: globalThis.causalis.pageOpen(), scale: globalThis.causalis.scale(), on: globalThis.causalis.money.state().on, body: document.body.className })`,
    );
    say(`a tap at ${Math.round(at.x)}, ${Math.round(at.y)} took ${JSON.stringify(now)}`);
    await closePage();
  }
  check(tried > 0, "no home of a ring on the screen");
  if (tried) check(homePage, "a ring home's page did not come");
  if (homePage) {
    await page.waitForTimeout(slow(300));
    await shot("ring-page");
    readWell(await pageText(), "a ring home's page");
    await closePage();
  }
  await lensOff();
} else say("no village's ring in this world");

// A town at war.
{
  const realms = politiesOf(world.world),
    war = warsOf(world.world)
      .all()
      .find((x) => x.ended === null),
    seat = war ? realms.get(war.defender)?.seat : undefined,
    there = seat === undefined ? undefined : world.towns.find((s) => s.cell === seat);
  if (there) {
    await goDown(there.ref);
    await looked("war");
    await lensOff();
  } else say("no town at war in this world");
}

// A town with no market: a stand-in whose land has none is read at usual prices, and says what is known.
{
  const none = hunt(world, (s) =>
    world.world ? (populationContext(world.world).provinces.get(s.cell) ? null : s) : null,
  );
  if (none) say(`a town of no land: ${none.town.name}`);
}

const after = JSON.stringify(await ask<unknown>("hashes"));
check(before === after, "the lens or a person's page moved a hash");

// One lived as, and another under the hand: their own pages. (Taking a body is what moves history: it comes after the hashes.)
{
  await goDown(town.ref);
  const homes = await ask<{ n: number; state: string; people: number }[]>("home.survey", {
      town: town.ref,
    }),
    lived = homes.find((s) => s.state === "stands" && s.people > 0);
  if (lived) {
    const why = await k<string | null>(
      `globalThis.causalis.home.open(${JSON.stringify({ town: town.ref, n: lived.n })})`,
    );
    check(!why, `their home did not open: ${why}`);
    await until("its roof lifted", async () => {
      const s = await k<{ lifted: boolean; flying: boolean } | null>(
        "globalThis.causalis.home.state()",
      );
      return !!s && s.lifted && !s.flying;
    });
    await page.waitForTimeout(slow(300));
    const one = (
      await k<{ kind: string; x: number; y: number }[]>("globalThis.causalis.home.spots()")
    ).find((s) => s.kind === "person" && s.y > 180 && s.y < 800);
    if (one) {
      await page.touchscreen.tap(one.x, one.y);
      await until("their sheet", () => k<boolean>(`!document.querySelector(".home-who").hidden`));
      await press(".home-live");
      await until(
        "their life",
        () => k<boolean>(`document.body.classList.contains("living")`),
        slow(90000),
      );
      await page.waitForTimeout(slow(1200));
      const life = await k<{ agent: number; purse: number } | null>(
        "globalThis.causalis.life.state()",
      );
      check(!!life, "no life is being lived");
      if (life) {
        // (By touch, as anyone has it: the family button, then their page.)
        await press(".life-bookbtn");
        await until("their Book", () => k<boolean>(`!document.querySelector(".life-book").hidden`));
        await shot("lived-book");
        const theirPage = await k<{ x: number; y: number } | null>(`(() => {
          for (const b of document.querySelectorAll(".life-book .life-choice"))
            if (/their page/i.test(b.textContent)) {
              const r = b.getBoundingClientRect();
              return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
            }
          return null;
        })()`);
        check(!!theirPage, "no way to their page from their Book");
        if (theirPage) await page.touchscreen.tap(theirPage.x, theirPage.y);
        await until("their page", () =>
          k<boolean>(`String(globalThis.causalis.pageOpen() ?? "").startsWith("agent:")`),
        );
        await page.waitForTimeout(slow(500));
        await shot("lived-page-touched");
        const stopped = await k<{ stopped: boolean }>("globalThis.causalis.clock()");
        check(stopped.stopped, "their day went on behind their page");
        const held0 = await hudTime();
        await page.waitForTimeout(slow(900));
        const held1 = await hudTime();
        say(`their day, while their page is read: ${held0} then ${held1}`);
        check(held1 === held0, `their day went on behind their page: ${held0} then ${held1}`);
        await k("document.querySelector('.life-book').hidden = true");
        await closePage();
        const text = await openPage(`agent:${life.agent}`, "lived-page");
        saysLiving(text, "the page of one lived as");
        // (What it says they pay, and the sum under it, are one number.)
        check(
          !/To live there\s*Nothing/i.test(text) || !/, and [\d.,]+ of rent/.test(text),
          `one lived as pays nothing and pays rent: ${text.slice(text.search(/To live there/i), text.search(/To live there/i) + 300)}`,
        );
        const purse = /In the purse\s+([\d,]+) coin/i.exec(text);
        check(
          !!purse,
          `one lived as has no purse on their page: ${text.slice(Math.max(0, text.search(/Their home/i) - 80), text.search(/Their home/i) + 900)}`,
        );
        if (purse) {
          const said = Number(purse[1]!.replace(/,/g, ""));
          say(`one lived as: ${said} in the purse, ${Math.round(life.purse)} on their strip`);
          check(
            Math.abs(said - life.purse) <= Math.max(2, life.purse * 0.05),
            `their page says ${said} in the purse, their strip ${life.purse}`,
          );
        }
        await closePage();
        // Another under the hand, of the same town: their own page, with no purse of theirs to read.
        const other = (
          await k<{ ref: string; child: boolean }[]>("globalThis.causalis.planNow().people")
        ).find((p) => p.ref.startsWith("agent:") && p.ref !== `agent:${life.agent}` && !p.child);
        if (other) {
          const theirs = await openPage(other.ref, "hand-page");
          saysLiving(theirs, "the page of one under the hand");
          check(!/In the purse/i.test(theirs), "one not lived as has a purse");
          await closePage();
        } else say("no other under the hand is drawn");
      }
    } else say("no one in at this hour, to live as");
  } else say("no home with anyone in it, to live as");
}

// A water people's town, a far save given (or nothing on CI).
if (alienFile) {
  const alien = fromFile(alienFile, "alien"),
    w2 = held(alien);
  tally(w2);
  await loadSave(alien);
  const t = w2.towns[Math.min(w2.towns.length - 1, Math.floor(w2.towns.length * 0.02))]!;
  await goDown(t.ref);
  const s = await looked("water");
  check(s.shown > 0, "a water people's town has no lens");
  const one = (
    await k<{ ref: string; child: boolean; occupation: number }[]>(
      "globalThis.causalis.planNow().people",
    )
  ).find((p) => !p.child && p.occupation > 0);
  if (one) {
    const text = await openPage(one.ref, "water-person-page");
    saysLiving(text, "a water person's page");
    if (await k<boolean>(`globalThis.causalis.planNow()?.body?.medium === "water"`))
      check(!/\bbread\b/i.test(text), `a water people have bread: ${text.slice(0, 700)}`);
    await closePage();
  }
  await lensOff();
}

for (const e of errors) problems.push(`page error: ${e.slice(0, 400)}`);
await browser.close();
await server.close();
if (problems.length) {
  console.log(`gate 88: ${problems.length} problems`);
  for (const p of problems) console.log(`  x ${p}`);
  process.exit(1);
}
console.log("gate 88: passed");
process.exit(0);
