// node tools/phase25-gate.ts [--ci] [--soft] [--shots dir] — the Phase 25 gate (towns seen
// growing on the land, and what stands in a town each its own page; asked for 2026-10-24: "i cant
// see the cities form and evolve and get that type of detail i got from the og causalisis, i mean
// like the land view"), done in a real browser on the built app, on juniper's world at year 300:
//   1. the land of the greatest town draws its towns from their fabric — the greatest among them
//      — with their fields and its roads; the woods are cleared from them;
//   2. the land's clock runs a year a second and its towns are drawn still, as the years come;
//   3. in the greatest town, a tap on one of its buildings opens that building's page, a tap on
//      one of its homes that lot's (or the family's living there), its walls theirs;
//   4. on a phone: a building's page within the screen.
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
console.log("the Phase 25 gate");
if (shots) mkdirSync(shots, { recursive: true });

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4277, strictPort: false } }),
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
type Land = { towns: number; parts: number; fields: number; roads: number };
type Spots = {
  civic: { x: number; y: number; at: number; start: number } | null;
  lot: { x: number; y: number; lot: number } | null;
  walls: { x: number; y: number } | null;
  wallsAt: { x: number; z: number } | null;
};
const QUERY = "?seed=juniper&year=300";

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
const towns = await k<{ ref: string; cell: number; people: number; name: string }[]>(
    `globalThis.causalis.client.query({ type: "towns.map", args: {} })`,
  ),
  great = [...towns].sort((a, b) => b.people - a.people)[0]!;

// 1. The land of the greatest town: its towns from their fabric, their fields, its roads.
{
  await k(`globalThis.causalis.descend(${great.cell})`);
  await until(
    `${great.name} drawn on its land`,
    async () => !!(await k(`globalThis.causalis.landTown(${JSON.stringify(great.ref)})`)),
    slow(60000),
  );
  const land = await k<Land>(`globalThis.causalis.land()`),
    at = await k<{ x: number; z: number; r: number }>(
      `globalThis.causalis.landTown(${JSON.stringify(great.ref)})`,
    ),
    plan = await k<{ towns: { plan: unknown }[]; roads: unknown[] }>(
      `globalThis.causalis.client.query({ type: "towns.land", args: { cell: ${great.cell} } })`,
    );
  say(
    `${great.name}'s land: ${land.towns} towns drawn from their fabric (of ${plan.towns.length}), ${land.parts} parts, ${land.fields} fields, ${land.roads} pieces of road; ${great.name} reaches ${at.r.toFixed(2)} km`,
  );
  check(
    land.towns >= Math.min(3, plan.towns.length),
    "the land's towns are not drawn from their fabric",
  );
  check(
    land.towns === plan.towns.filter((t) => t.plan).length,
    "a town with a fabric not drawn from it",
  );
  check(land.parts > 500, `the land draws only ${land.parts} parts of its towns`);
  check(land.fields > 0, "no fields about the land's towns");
  check(plan.roads.length === 0 || land.roads > 0, "the land's roads are not drawn");
  check(at.r > 0.3, `${great.name} drawn no larger than a village (${at.r.toFixed(2)} km)`);
  await k(
    `(() => { const r = globalThis.causalis.rig; r.target.set(${at.x}, 0.5, ${at.z}); r.distance = ${Math.max(12, at.r * 7)}; r.pitch = -40; r.yaw = 30; })()`,
  );
  await page.waitForTimeout(slow(2000));
  await shot("1-land");
}

// 2. The land's clock a year a second: the years come, the towns drawn still.
{
  const y0 = await year();
  await page.mouse.move(683, 520);
  await page.keyboard.press("Digit4");
  await page.waitForTimeout(slow(6000));
  const y1 = await year(),
    land = await k<Land>(`globalThis.causalis.land()`);
  await k(`globalThis.causalis.client.setSpeed(0)`);
  say(`the land's clock: year ${y0} → ${y1}; ${land.towns} towns, ${land.parts} parts drawn`);
  check(y1 >= y0 + 2, `the land's clock did not run a year a second (${y0} → ${y1})`);
  check(land.towns > 0 && land.parts > 500, "the land's towns were lost as the years came");
  await shot("2-years");
}

// 3. In the greatest town: a building, a home, its walls — each tapped, its page.
{
  await k(`globalThis.causalis.watch(${JSON.stringify(great.ref)})`);
  await until(
    "the greatest town",
    async () => (await k<string>(`globalThis.causalis.scale?.() ?? ""`)) === "village",
    slow(60000),
  );
  await page.waitForTimeout(slow(3000));
  await k(`globalThis.causalis.client.setSpeed(0)`);
  // Near enough to tap: over its square, looking down.
  await k(
    `(() => { const r = globalThis.causalis.rig; r.target.set(0, 0, 0); r.distance = 30; r.pitch = -70; r.yaw = 0; })()`,
  );
  await page.waitForTimeout(slow(2500));
  const spots = await k<Spots | null>(`globalThis.causalis.townOnScreen()`);
  say(`on the screen: ${JSON.stringify(spots)}`);
  check(!!spots?.civic, `none of ${great.name}'s buildings is on the screen`);
  const tapped: string[] = [],
    seen = (p: { x: number; y: number } | null) =>
      !!p && p.x > 20 && p.x < 1346 && p.y > 120 && p.y < 780;
  const tap = async (x: number, y: number, want: RegExp, title: RegExp, what: string) => {
    const ref = await k<string | null>(`globalThis.causalis.refAt(${x}, ${y})`);
    tapped.push(`${what}: ${ref}`);
    if (!ref || !want.test(ref)) {
      problems.push(`a tap on ${what} found ${ref ?? "nothing"}`);
      return;
    }
    await page.mouse.click(x, y);
    const shown = { title: "" };
    await until(
      `${what}'s page`,
      async () => {
        shown.title = await k<string>(
          `(() => { const w = document.querySelector(".page-window"); return w && !w.hidden ? (w.querySelector(".page-title")?.textContent ?? "") : ""; })()`,
        );
        return title.test(shown.title);
      },
      slow(20000),
    );
    say(`${what} tapped: “${shown.title}”`);
    await shot(`3-${what.replace(/\W+/g, "-")}`);
    await k(`document.querySelector(".page-window .close")?.click()`);
    await page.waitForTimeout(500);
  };
  if (seen(spots?.civic ?? null))
    await tap(spots!.civic!.x, spots!.civic!.y, /^bldg:/, /^The .+ of /, "a building");
  if (seen(spots?.lot ?? null))
    await tap(
      spots!.lot!.x,
      spots!.lot!.y,
      /^(lot|hhold):/,
      /^(A .+ of |The .+ household)/,
      "a home",
    );
  // Walls: the greatest town's, else those of another town of its land that has them standing,
  // the eye turned to them.
  const walled = (
    await k<{
      towns: { ref: string; name: string; population: number; plan: { walls: unknown } | null }[];
    }>(`globalThis.causalis.client.query({ type: "towns.land", args: { cell: ${great.cell} } })`)
  ).towns
    .filter((t) => t.plan?.walls)
    .sort(
      (a, b) =>
        Number(b.ref === great.ref) - Number(a.ref === great.ref) || b.population - a.population,
    );
  let walls = false;
  for (const t of walled.slice(0, 3)) {
    if (t.ref !== great.ref) {
      await k(`globalThis.causalis.watch(${JSON.stringify(t.ref)})`);
      await page.waitForTimeout(slow(5000));
      await k(`globalThis.causalis.client.setSpeed(0)`);
    }
    const at = (await k<Spots | null>(`globalThis.causalis.townOnScreen()`))?.wallsAt;
    if (!at) continue;
    await k(
      `(() => { const r = globalThis.causalis.rig; r.target.set(${at.x}, 0, ${at.z}); r.distance = 14; r.pitch = -70; })()`,
    );
    await page.waitForTimeout(slow(2000));
    const w = await k<{ x: number; y: number } | null>(
      `(() => { const s = globalThis.causalis.townOnScreen(); return s && s.walls ? s.walls : null; })()`,
    );
    check(!!w && seen(w), `${t.name}'s walls not brought on to the screen`);
    if (w && seen(w)) await tap(w.x, w.y, /^walls:/, /^The walls of /, `${t.name}'s walls`);
    walls = true;
    break;
  }
  if (!walls) say("no town of the land has walls standing: none tapped");
  say(tapped.join("; "));
  // The town's own page: its buildings.
  await k(`globalThis.causalis.open(${JSON.stringify(great.ref)})`);
  await page.waitForTimeout(slow(1500));
  const tabs = await page.$$eval(".page-window .tab", (x) => x.map((e) => e.textContent ?? ""));
  check(
    tabs.some((t) => /Buildings/.test(t)),
    `the town's page has no Buildings tab (${tabs.join(", ")})`,
  );
}

// 4. On a phone: a building's page within the screen.
{
  const phone = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  watch(phone);
  await begin(phone);
  const plan = await k<{
    towns: { ref: string; plan: { civics: { at: number; start: number }[] } | null }[];
  }>(
    `globalThis.causalis.client.query({ type: "towns.land", args: { cell: ${great.cell}, most: 2000 } })`,
    phone,
  );
  const t = plan.towns.find((x) => x.ref === great.ref),
    c = t?.plan?.civics[0];
  if (c) {
    await k(
      `globalThis.causalis.open(${JSON.stringify(`bldg:${great.ref}:${c.at}:${c.start}`)})`,
      phone,
    );
    await phone.waitForTimeout(slow(2000));
    const fit = await phone.evaluate(() => {
      const w = document.querySelector(".page-window")?.getBoundingClientRect();
      return {
        over: document.documentElement.scrollWidth - innerWidth,
        window: w ? [w.left, w.right] : null,
        title: document.querySelector(".page-window .page-title")?.textContent ?? "",
      };
    });
    say(`on a phone: “${fit.title}”, ${JSON.stringify(fit.window)}`);
    check(fit.over <= 0, `the page runs ${fit.over}px off a phone's side`);
    check(
      !!fit.window && fit.window[0]! >= -0.5 && fit.window[1]! <= 390.5,
      "a building's page runs off a phone",
    );
    check(/^The /.test(fit.title), `a building's page on a phone: “${fit.title}”`);
    await shot("4-phone", phone);
  }
}

check(errors.length === 0, `errors: ${errors.slice(0, 3).join(" | ")}`);
await browser.close();
await new Promise<void>((done) => server.httpServer.close(() => done()));
console.log(
  problems.length
    ? `\nthe Phase 25 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`
    : "\nthe Phase 25 gate passes",
);
process.exit(problems.length ? 1 : 0);
