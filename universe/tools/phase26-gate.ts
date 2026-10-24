// node tools/phase26-gate.ts [--ci] [--soft] [--shots dir] — the Phase 26 gate (a land's ways
// busy, and its towns watched growing; asked for 2026-10-24: "i cant see the cities form and
// evolve … bringing all of og causalisis into this game"), done in a real browser on the built
// app, on juniper's world at year 300:
//   1. a land on the sea that trades over it: its roads have carts or wagons going along them,
//      its sea lanes ships, as its era has them;
//   2. they go on while the clock runs, and stand while it is held;
//   3. a town's page sends the eye down to its land to watch it grow: the land shown, the eye on
//      the town, the clock a year a second; what its towns did lately is on their labels;
//   4. on a phone: the town's page has the way to watch it, within the screen.
// (npm run build first; --soft draws in software, as CI's browser does; --shots keeps a
// picture of each step.)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium, type Page } from "playwright";

const ci = process.argv.includes("--ci"),
  soft = process.argv.includes("--soft"),
  shots = process.argv.includes("--shots")
    ? process.argv[process.argv.indexOf("--shots") + 1]
    : undefined;
const GPU = [
  "--use-angle=d3d11",
  "--ignore-gpu-blocklist",
  "--enable-gpu",
  "--force_high_performance_gpu",
];
const problems: string[] = [];
const say = (line: string) => console.log(`  ${line}`);
const check = (ok: boolean, problem: string) => {
  if (!ok) problems.push(problem);
};
/** How long to wait on what the frames bring: longer where they come slowly. */
const slow = (ms: number) => (ci || soft ? ms * 4 : ms);
console.log("the Phase 26 gate");
if (shots) mkdirSync(shots, { recursive: true });

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4278, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const errors: string[] = [];
const watch = (p: Page) => {
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
};
const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
watch(page);
const k = <T>(code: string, p: Page = page): Promise<T> => p.evaluate(code) as Promise<T>;
const until = async (what: string, ok: () => Promise<boolean>, ms = 60000, p: Page = page) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok()) return true;
    await p.waitForTimeout(250);
  }
  problems.push(`${what} did not come`);
  return false;
};
const shot = async (name: string, p: Page = page) => {
  if (shots) await p.screenshot({ path: join(shots, `${name}.png`) });
};
const year = (p: Page = page) =>
  k<number>(
    `globalThis.causalis.client.advance(0).then((s) => Math.floor(s.t / (365 * 86400)))`,
    p,
  );
type Land = {
  towns: number;
  parts: number;
  fields: number;
  roads: number;
  lanes: number;
  traffic: Record<string, number>;
};
type Plan = {
  era: string;
  towns: { ref: string; name: string; population: number }[];
  roads: unknown[];
  lanes: { a: string; ships: number }[];
};
const QUERY = "?seed=juniper&year=300";
const ROAD_KINDS: Record<string, string> = {
  farm: "cart",
  metal: "wagon",
  industry: "wagon",
  modern: "truck",
};

const begin = async (p: Page) => {
  await p.goto(`${base}${QUERY}`);
  await p.waitForFunction(
    () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
    undefined,
    {
      timeout: 900000,
    },
  );
  await p.waitForTimeout(slow(1500));
  await k(`globalThis.causalis.client.setSpeed(0)`, p);
};
await begin(page);
// The most peopled land on the sea whose ships go out over it, with roads.
const towns = await k<{ ref: string; cell: number; people: number; name: string }[]>(
  `globalThis.causalis.client.query({ type: "towns.map", args: {} })`,
);
const byLand = new Map<number, number>();
for (const t of towns) byLand.set(t.cell, (byLand.get(t.cell) ?? 0) + t.people);
let cell = -1,
  plan: Plan | null = null;
for (const [c] of [...byLand].sort((a, b) => b[1] - a[1])) {
  const p = await k<Plan>(
    `globalThis.causalis.client.query({ type: "towns.land", args: { cell: ${c}, most: 2500 } })`,
  );
  if (p.lanes.length && p.roads.length >= 3 && p.era !== "forage") {
    cell = c;
    plan = p;
    break;
  }
}
check(!!plan, "no land on the sea with roads and ships going out from it");
const port = plan
  ? plan.towns.find((t) => t.ref === plan!.lanes[0]!.a)!
  : { ref: "", name: "", population: 0 };
const roadKind = plan ? (ROAD_KINDS[plan.era] ?? "cart") : "cart",
  shipKind = plan && (plan.era === "industry" || plan.era === "modern") ? "steam" : "sail";

// 1. Its roads busy, its sea lanes sailed.
if (plan) {
  say(
    `land ${cell} (${plan.era}): ${plan.towns.length} towns, ${plan.roads.length} roads, ${plan.lanes.length} sea lanes from ${port.name}`,
  );
  await k(`globalThis.causalis.descend(${cell})`);
  await until(
    "the land's towns drawn",
    async () => !!(await k(`globalThis.causalis.landTown(${JSON.stringify(port.ref)})`)),
    slow(60000),
  );
  await until(
    "what goes along its ways",
    async () => Object.keys((await k<Land>(`globalThis.causalis.land()`)).traffic).length > 0,
    slow(20000),
  );
  const land = await k<Land>(`globalThis.causalis.land()`);
  say(
    `drawn: ${land.roads} pieces of road, ${land.lanes} sea lanes; going: ${JSON.stringify(land.traffic)}`,
  );
  check((land.traffic[roadKind] ?? 0) > 0, `no ${roadKind}s on the roads of a ${plan.era} land`);
  check(land.lanes > 0, "the land's sea lanes are not laid over its sea");
  check((land.traffic[shipKind] ?? 0) > 0, `no ships (${shipKind}) on its sea lanes`);
  // Close over a carrier on the road, and over a ship.
  for (const [kind, d, name] of [
    [roadKind, 2.2, "1-road"],
    [shipKind, 5, "1-ship"],
  ] as const) {
    const at = await k<{ x: number; z: number } | null>(
      `globalThis.causalis.landCarrier(${JSON.stringify(kind)})`,
    );
    if (!at) continue;
    await k(
      `(() => { const r = globalThis.causalis.rig; r.target.set(${at.x}, 0.3, ${at.z}); r.distance = ${d}; r.pitch = -35; r.yaw = 40; })()`,
    );
    await page.waitForTimeout(slow(1500));
    await shot(name);
  }
}

// 2. On while the clock runs, standing while it is held.
if (plan) {
  const where = () =>
    k<{ x: number; z: number } | null>(
      `globalThis.causalis.landCarrier(${JSON.stringify(roadKind)})`,
    );
  await page.mouse.move(683, 520);
  await page.keyboard.press("Digit1");
  await page.waitForTimeout(slow(800));
  const a = await where();
  await page.waitForTimeout(slow(2000));
  const b = await where(),
    moved = a && b ? Math.hypot(b.x - a.x, b.z - a.z) : 0;
  await k(`globalThis.causalis.client.setSpeed(0)`);
  await page.waitForTimeout(slow(800));
  const c = await where();
  await page.waitForTimeout(slow(2000));
  const d = await where(),
    stood = c && d ? Math.hypot(d.x - c.x, d.z - c.z) : 1;
  say(
    `a ${roadKind} went ${moved.toFixed(3)} km while the clock ran, ${stood.toFixed(3)} km while it was held`,
  );
  check(moved > 0.05, `a ${roadKind} did not go along its road while the clock ran`);
  check(stood < 1e-6, `a ${roadKind} went on while the clock was held`);
}

// 3. Watch it grow: from the town's page down to its land, the clock a year a second, the
// towns' doings on their labels.
if (plan) {
  // (Up to the world first: the watch takes the eye down to the land.)
  await page.locator("button", { hasText: "‹ The world" }).first().click();
  await until(
    "the world",
    async () => (await k<string>(`globalThis.causalis.scale?.() ?? ""`)) === "globe",
    slow(20000),
  );
  await page.waitForTimeout(slow(1000));
  await k(`globalThis.causalis.open(${JSON.stringify(port.ref)})`);
  const button = page.locator(".page-window button", { hasText: "Watch it grow" });
  await until(
    "the town's page with its watch",
    async () => (await button.count()) > 0,
    slow(20000),
  );
  if ((await button.count()) > 0) {
    const y0 = await year();
    await button.first().click();
    await until(
      "the land of the town watched",
      async () =>
        (await k<string>(`globalThis.causalis.scale?.() ?? ""`)) === "region" &&
        !!(await k(`globalThis.causalis.landTown(${JSON.stringify(port.ref)})`)),
      slow(60000),
    );
    const lit = await k<string>(
      `document.querySelector(".timebar .speeds button.on")?.getAttribute("aria-label") ?? ""`,
    );
    say(`the clock: “${lit}”`);
    check(
      /year a second/i.test(lit),
      `watching it grow, the clock is not a year a second (“${lit}”)`,
    );
    // The eye on the town, once it has flown there.
    await page.waitForTimeout(slow(2000));
    const eye = await k<{ x: number; z: number }>(
        `(() => { const t = globalThis.causalis.rig.target; return { x: t.x, z: t.z }; })()`,
      ),
      town = await k<{ x: number; z: number; r: number }>(
        `globalThis.causalis.landTown(${JSON.stringify(port.ref)})`,
      ),
      off = Math.hypot(eye.x - town.x, eye.z - town.z);
    say(`the eye ${off.toFixed(2)} km from ${port.name}`);
    check(off < 3, `the eye is ${off.toFixed(1)} km from ${port.name}`);
    // What the towns did lately, on their labels, as the years come.
    let news: string[] = [];
    await until(
      "what the towns did, on their labels",
      async () => {
        news = await page.$$eval("span.label", (x) =>
          x.map((e) => e.textContent ?? "").filter((t) => t.includes(" · ")),
        );
        return news.length > 0;
      },
      slow(30000),
    );
    const y1 = await year();
    await shot("3-growing");
    await k(`globalThis.causalis.client.setSpeed(0)`);
    say(
      `years ${y0} → ${y1}; on the labels: ${news
        .slice(0, 4)
        .map((t) => `“${t}”`)
        .join(", ")}`,
    );
    check(y1 >= y0 + 2, `the years did not come (${y0} → ${y1})`);
  }
}

// 4. On a phone: the town's page, with the way to watch it, within the screen.
if (plan) {
  const phone = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  watch(phone);
  await begin(phone);
  await k(`globalThis.causalis.open(${JSON.stringify(port.ref)})`, phone);
  await phone.waitForTimeout(slow(2000));
  const fit = await phone.evaluate(() => {
    const b = [...document.querySelectorAll(".page-window button")].find((x) =>
        /Watch it grow/.test(x.textContent ?? ""),
      ),
      r = b?.getBoundingClientRect();
    return {
      over: document.documentElement.scrollWidth - innerWidth,
      button: r ? [r.left, r.right] : null,
    };
  });
  say(`on a phone: the watch at ${JSON.stringify(fit.button)}`);
  check(fit.over <= 0, `the page runs ${fit.over}px off a phone's side`);
  check(
    !!fit.button && fit.button[0]! >= -0.5 && fit.button[1]! <= 390.5,
    "the way to watch a town grow is not within a phone's screen",
  );
  await shot("4-phone", phone);
}

check(errors.length === 0, `errors: ${errors.slice(0, 3).join(" | ")}`);
await browser.close();
await new Promise<void>((done) => server.httpServer.close(() => done()));
console.log(
  problems.length
    ? `\nthe Phase 26 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`
    : "\nthe Phase 26 gate passes",
);
process.exit(problems.length ? 1 : 0);
