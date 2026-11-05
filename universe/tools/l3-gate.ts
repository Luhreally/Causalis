// node tools/l3-gate.ts [--ci] [--soft] [--shots dir]: gate 70, Lives L3 at a phone's size. ROUGH: written, not yet run.
//   1. a world at year 450, its clock held; a town; 2. Live here is big enough, nothing changed until pressed;
//   3. the sheet: cards, each thing big enough; 4. Live as them: the strip, the tray; 5. a block chosen: they walk, then stay;
//   6. the market's buy buttons; 7. the Walk down to the hand and back; 8. months let go by, windows answered;
//   9. the book; 10. let go: the hand still rests; 11. no error in the page.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";
import type { LifeNow } from "../src/bridge/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  shotsAt = argv.indexOf("--shots"),
  shots = shotsAt >= 0 ? argv[shotsAt + 1] : undefined;
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
const root = fileURLToPath(new URL("..", import.meta.url)),
  started = performance.now(),
  server = await preview({ root, logLevel: "silent", preview: { port: 4270, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: ci || soft ? 1 : 3,
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
    await page.waitForTimeout(60);
  }
  problems.push(`${what} did not come`);
  return false;
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const centre = (sel: string) =>
  k<{ x: number; y: number } | null>(`(() => {
    const e = document.querySelector(${JSON.stringify(sel)});
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  })()`);
const tap = async (sel: string) => {
  await k(
    `document.querySelector(${JSON.stringify(sel)})?.scrollIntoView({ block: "center", inline: "center" })`,
  );
  let at: { x: number; y: number } | null = null;
  await until(`${sel} on the screen`, async () => !!(at = await centre(sel)));
  if (at) await page.touchscreen.tap((at as { x: number }).x, (at as { y: number }).y);
};
const big = (sel: string) =>
  k<boolean>(`(() => {
    const e = document.querySelector(${JSON.stringify(sel)});
    if (!e) return false;
    const r = e.getBoundingClientRect();
    return r.width >= 44 && r.height >= 44;
  })()`);
const fits = () => k<boolean>("document.documentElement.scrollWidth <= 430");
const seen = (sel: string) => centre(sel).then((c) => !!c);
const life = () => k<LifeNow | null>("globalThis.causalis.life.state()");
const t = () => k<number>("globalThis.causalis.client.status.t");

// 1. A world, its clock held, down in a town by day.
await page.goto(`${base}?universe=earth&seed=first%20light&year=450&hold=1`);
await page.waitForFunction(
  () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
  undefined,
  { timeout: 1_800_000 },
);
await k("globalThis.causalis.client.setSpeed(0)");
await k(`globalThis.causalis.client.advance(globalThis.causalis.client.status.t + 8 * 3600)`);
const book = await ask<{ realms: { ref: string }[] }>("wealth.book"),
  list = await ask<{ leaders: { town: string | null }[] }>("leaders.of", {
    realm: book.realms[0]!.ref,
  }),
  town = list.leaders[0]!.town!;
await k(`globalThis.causalis.goTo(${JSON.stringify(town)})`);
await until(
  "the town",
  () => k<boolean>(`globalThis.causalis.scale() === "village" && !!globalThis.causalis.planNow()`),
  slow(120000),
);
const before = await ask<unknown>("hashes");
say(`the town drawn in ${((performance.now() - started) / 1000).toFixed(0)} s`);

// 2. Live here.
check(await big(".town-live"), "Live here is too small to press");
check(same(await ask("hashes"), before), "looking changed the world");
await tap(".town-live");

// 3. The sheet.
await until("the sheet of lives", () => seen(".life-picker .life-card"));
const cards = await k<number>(`document.querySelectorAll(".life-picker .life-card").length`);
check(cards >= 4, `${cards} lives to choose from`);
check(await big(".life-picker .life-live"), "Live as them is too small to press");
check(await fits(), "the sheet is wider than the screen");
check(
  (await ask<{ village: string } | null>("hand"))?.village === town,
  "the hand is not on the town",
);
await shot("sheet");

// 4. A life.
await k(
  `document.querySelector('.life-card[data-kind="craft"] .life-live')?.setAttribute("data-first", "1")`,
);
await tap(`.life-card[data-kind="craft"] .life-live`);
await until("the strip", async () => (await seen(".life-strip")) && !!(await life()), slow(120000));
const l0 = (await life())!;
say(`${l0.name}: ${l0.what}, ${l0.purse} coin, wants ${l0.want?.label}`);
check(l0.offers.length >= 4, `${l0.offers.length} things to do`);
check(await big(".life-offer"), "an offer is too small to press");
check(await big(".life-letgo"), "Let go is too small to press");
check(await big(".life-walk"), "Walk is too small to press");
check(await fits(), "the strip is wider than the screen");
check(
  await k<boolean>(`document.body.classList.contains("living")`),
  "the page does not say it is living",
);
await shot("life");

// 5. A block, watched: the clock runs on, they walk, they stay.
await k("globalThis.causalis.life.pace()");
const t0 = await t();
await tap(`.life-offer[data-what="eat"]`);
await until("eating", async () => (await life())?.doing?.what === "eat", slow(30000));
await until("the clock running", async () => (await t()) > t0 + 60, slow(30000));
await shot("eating");

// 6. The market.
await tap(`.life-offer[data-what="market"]`);
await until("the market's buttons", () => seen(".life-buy"), slow(60000));
check(await big(".life-buy"), "a buy button is too small to press");
await shot("market");

// 7. Down to the hand and back.
await tap(".life-walk");
await until(
  "the hand pace",
  () => k<boolean>("!!globalThis.causalis.possess.state()"),
  slow(120000),
);
check(await seen(".possess-letgo"), "no way back up");
await page.waitForTimeout(slow(1500));
await shot("walk");
await tap(".possess-letgo");
if (!(await until("the day again", () => seen(".life-strip"), slow(40000))))
  say(
    `not back: ${await k<string>(`JSON.stringify({ possess: !!globalThis.causalis.possess.state(), inHand: globalThis.causalis.life.inHand(), life: !!globalThis.causalis.life.state(), scale: globalThis.causalis.scale(), speed: globalThis.causalis.client.status?.speed })`)}`,
  );

// 8. Months go by; what waits is answered.
const y0 = await t();
let farthest = 0;
await tap(".life-pace:nth-of-type(4)");
await until("the choices of how time goes", () => seen(".life-span"));
await tap(`.life-span[data-days="365"]`);
await until(
  "a year gone by",
  async () => {
    if (await seen(".life-window .life-choice")) await tap(".life-window .life-choice");
    const off = await k<number | null>(`(() => {
      const c = globalThis.causalis, h = c.life.home();
      return c.life.until() !== null && !c.rig.flying && h ? Math.hypot(c.rig.target.x * 10 - h.x, c.rig.target.z * 10 - h.z) : null;
    })()`);
    if (off !== null) farthest = Math.max(farthest, off);
    return (await t()) > y0 + 200 * 86_400;
  },
  slow(180000),
);
say(`the eye, while time went by, at most ${farthest.toFixed(0)} m from their home`);
await shot("year");

// 9. The book.
await tap(".life-bookbtn");
await until("the book", () => seen(".life-book .life-wintitle"));
check(await fits(), "the book is wider than the screen");
await shot("book");
await tap(".life-book .life-choice:last-child");

// 10. Let go.
await tap(".life-letgo");
await until("let go", async () => !(await life()) && !(await seen(".life-strip")), slow(60000));
check((await ask<{ village: string } | null>("hand"))?.village === town, "the hand left with them");
check(await seen(".town-live"), "Live here is not back");
const chronicle = await k<string>(`document.body.innerText`);
void chronicle;
await shot("after");

// 11. No error.
check(errors.length === 0, `errors in the page: ${errors.slice(0, 3).join(" | ")}`);
console.log(
  `Lives gate (70): ${((performance.now() - started) / 1000).toFixed(0)} s, ${problems.length} problems`,
);
for (const p of problems) console.log(`  - ${p}`);
await browser.close();
await server.close();
process.exit(problems.length ? 1 : 0);
