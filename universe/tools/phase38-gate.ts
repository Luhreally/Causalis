// node tools/phase38-gate.ts [--ci] [--soft] [--shots dir] — the Phase 38 gate (wars seen
// unfolding, M193: a war of history played again on the globe), on the built app:
//   1. the ledger offers its bloodiest war watched unfolding; out on the globe the world's clock is
//      held while the war plays on a clock of its own, its host marching on what it wanted;
//   2. its clock: held still by Space, run at its speeds by the numbers, drawn back and forth on
//      its course;
//   3. its battles come in their turns, each drawn and marked where it was fought, its fallen
//      tallied; at its end its whole is told and its host stands down;
//   4. a battle of it watched fought, and back to the war where it was left;
//   5. a war's own page offers it watched; left, the world's clock goes on as it went;
//   6. on a phone the war's bar keeps to the screen's width.
// (npm run build first; --soft draws in software, as CI's browser does; --shots keeps pictures.)
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
console.log("the Phase 38 gate");
if (shots) mkdirSync(shots, { recursive: true });

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4291, strictPort: false } }),
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
const k = <T>(p: Page, code: string): Promise<T> => p.evaluate(code) as Promise<T>;
const until = async (p: Page, what: string, ok: () => Promise<boolean>, ms = 60000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await p.waitForTimeout(250);
  }
  problems.push(`${what} did not come`);
  return false;
};
const shot = async (p: Page, name: string) => {
  if (shots) await p.screenshot({ path: join(shots, `${name}.png`) });
};
type Seen = {
  ref: string;
  title: string;
  year: number;
  span: { from: number; to: number };
  speed: number;
  words: string;
  fought: number;
  battles: number;
  won: number[];
  fallen: number[];
  taken: number;
  march: number | null;
  siege: number | null;
  follow: boolean;
  drawn: { marching: number; battle: number; fallen: number; tents: number };
  marks: string[];
  world: boolean;
  panel: boolean;
};
const seen = (p: Page) => k<Seen | null>(p, `globalThis.causalis.war()`);
type Course = {
  ref: string;
  declared: number;
  ended: number | null;
  battles: { event: string; year: number; land: string; fallen: [number, number] }[];
};

const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
watch(page);
await page.goto(`${base}?universe=earth&seed=${encodeURIComponent("first light")}&year=125`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  {
    timeout: 900000,
  },
);
await k(page, `globalThis.causalis.client.setSpeed(0)`);

// 1. The ledger offers its bloodiest war watched unfolding; out on the globe, the world held.
// (The world set going first, at the globe's years: held while the war is watched.)
await page.keyboard.press("Digit1");
await k(page, `globalThis.causalis.open("world:ledger#wars")`);
const offer = page.locator(".page-window button.act", {
  hasText: "Watch the bloodiest war unfold",
});
await until(page, "the ledger's war to watch", async () => (await offer.count()) > 0, slow(30000));
say(`the ledger: ${await offer.first().textContent()}`);
await offer.first().click();
await until(page, "the war watched", async () => (await seen(page)) !== null, slow(60000));
let w = await seen(page);
const c = await k<Course>(
  page,
  `globalThis.causalis.client.query({ type: "war.campaign", args: { ref: ${JSON.stringify(w?.ref ?? "")} } })`,
);
say(
  `${w?.title}: years ${c.declared}–${c.ended ?? "now"}, ${c.battles.length} battles, ${c.battles.reduce((n, b) => n + b.fallen[0] + b.fallen[1], 0)} fell`,
);
check(!!w && w.panel, "the war's bar shown");
check(w?.world === true, "the world's clock held while its war is watched");
check(!!w && w.year - w.span.from < 0.5, `the war from its declaring (${w?.year})`);
check(/march on .+, for /.test(w?.words ?? ""), `what it marches for, told ("${w?.words}")`);
await page.waitForTimeout(slow(1500));
w = await seen(page);
check(!!w && w.drawn.marching > 0, `its host drawn marching (${JSON.stringify(w?.drawn)})`);
await until(
  page,
  "the god's hand standing aside while a war of history is watched",
  () => k<boolean>(page, `document.body.classList.contains("palette-off")`),
  slow(5000),
);
await shot(page, "1-the-host-sets-out");

// 2. Its own clock: it plays at its own pace; Space holds it; the numbers its speeds; the course.
const y0 = (await seen(page))!.year;
await page.waitForTimeout(2000);
const y1 = (await seen(page))!.year;
say(`its own pace: year ${y0.toFixed(2)} → ${y1.toFixed(2)} in two seconds of ours`);
check(y1 - y0 > 0.2, `the war plays (${y0} → ${y1})`);
await page.keyboard.press("Space");
const held = (await seen(page))!;
await page.waitForTimeout(1200);
const still = (await seen(page))!;
check(held.speed === 0 && Math.abs(still.year - held.year) < 1e-6, "Space holds the war still");
check(
  (await k<{ stopped: boolean }>(page, `globalThis.causalis.clock()`)).stopped,
  "the world still held",
);
await page.keyboard.press("Digit4");
check((await seen(page))!.speed === 4, "4: the war at four times its pace");
await page.keyboard.press("Space");
check((await seen(page))!.speed === 0, "Space again holds it");
const course = await page.locator(".war-course").boundingBox();
if (course) await page.mouse.click(course.x + course.width * 0.8, course.y + course.height / 2);
w = await seen(page);
const want = w!.span.from + 0.8 * (w!.span.to - w!.span.from);
say(`drawn to four fifths of its course: year ${w?.year.toFixed(2)} — "${w?.words}"`);
check(
  !!w && Math.abs(w.year - want) < 0.2,
  `the course drawn to a moment (${w?.year} for ${want})`,
);

// 3. Its battles in their turns, drawn and marked where fought; at its end its whole, told.
const first = c.battles[0];
check(!!first, "a battle in the war");
if (first) {
  await k(page, `globalThis.causalis.warAt(${first.year + 0.999}, 0)`);
  await page.waitForTimeout(slow(900));
  w = await seen(page);
  const fell = first.fallen[0] + first.fallen[1];
  say(`its first battle: "${w?.words}" — marks ${JSON.stringify(w?.marks)}`);
  check(!!w && w.fought >= 1, "its first battle fought by the end of its year");
  check(
    !!w && w.drawn.battle > 0 && w.drawn.fallen > 0,
    `the battle drawn where it was fought (${JSON.stringify(w?.drawn)})`,
  );
  check(
    !!w && w.marks.some((m) => m.includes(`${fell.toLocaleString("en-US")} fell`)),
    `the battle marked with its fallen (${JSON.stringify(w?.marks)})`,
  );
  await shot(page, "2-a-battle-fought");
}
await k(page, `globalThis.causalis.warAt(${w!.span.to}, 0)`);
await page.waitForTimeout(slow(900));
w = await seen(page);
const sum = (i: 0 | 1) => c.battles.reduce((n, b) => n + b.fallen[i], 0);
say(`its end: "${w?.words}" — fallen ${w?.fallen.join(" and ")}`);
check(
  !!w && w.fallen[0] === sum(0) && w.fallen[1] === sum(1),
  "its fallen tallied as history counts them",
);
check(!!w && w.fought === c.battles.length, "every battle fought by its end");
if (c.ended !== null) {
  check(/the war ends/.test(w?.words ?? ""), `its end told ("${w?.words}")`);
  check(!!w && w.march === null && w.drawn.marching === 0, "its host stands down");
}
await shot(page, "3-its-end");

// 4. A battle of it watched fought, and back to the war where it was left.
const button = page.locator(".war-watch");
check(await button.isVisible(), "its latest battle offered watched");
const left = (await seen(page))!.year;
await button.click();
await until(
  page,
  "the battle's field",
  async () => (await k<unknown>(page, `globalThis.causalis.battle()`)) !== null,
  slow(60000),
);
const fought = await k<{ event: string } | null>(page, `globalThis.causalis.battle()`);
check(fought?.event === c.battles.at(-1)?.event, `the battle told of watched (${fought?.event})`);
check((await seen(page)) === null, "the war left while its battle is watched");
const back = page.locator(".battle-panel button", { hasText: "The war" });
check((await back.count()) > 0, "the battle's way back is to the war");
await back.first().click();
await until(page, "the war again", async () => (await seen(page)) !== null, slow(60000));
w = await seen(page);
check(!!w && Math.abs(w.year - left) < 1e-6, `back where it was left (${w?.year} for ${left})`);
check(w?.speed === 0, `held as it was left (${w?.speed})`);
await shot(page, "4-back-to-the-war");

// 5. A war's own page offers it watched; left, the world's clock goes on.
await page.locator(".war-panel button", { hasText: "Leave the war" }).click();
await until(page, "the war left", async () => (await seen(page)) === null, slow(10000));
await k(page, `globalThis.causalis.open(${JSON.stringify(c.ref)})`);
const own = page.locator(".page-window button.act", { hasText: "Watch the war unfold" });
await until(page, "the war page's watch", async () => (await own.count()) > 0, slow(30000));
await own.first().click();
await until(page, "the war watched from its page", async () => (await seen(page)) !== null);
check((await seen(page))?.ref === c.ref, "its page's war watched");
await page.locator(".war-panel button", { hasText: "Leave the war" }).click();
await until(page, "the war left again", async () => (await seen(page)) === null, slow(10000));
const after = await k<{ stopped: boolean; speed: number }>(page, `globalThis.causalis.clock()`);
check(!after.stopped && after.speed > 0, `the world's clock goes on (${JSON.stringify(after)})`);
await until(
  page,
  "the god's hand back once the war is left",
  async () => !(await k<boolean>(page, `document.body.classList.contains("palette-off")`)),
  slow(5000),
);

// 6. On a phone, the war's bar keeps to the screen.
await k(page, `globalThis.causalis.client.setSpeed(0)`);
await k(page, `globalThis.causalis.watchWar(${JSON.stringify(c.ref)})`);
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(slow(1200));
const fits = await k<{ wide: number; screen: number }>(
  page,
  `(() => { const b = document.querySelector(".war-panel:not([hidden]) .bar"), r = b?.getBoundingClientRect(); return { wide: b && r ? Math.max(b.scrollWidth, Math.round(r.right)) : 9999, screen: innerWidth }; })()`,
);
check(fits.wide <= fits.screen + 1, `the war's bar fits a phone (${fits.wide} in ${fits.screen})`);
await shot(page, "5-on-a-phone");

check(errors.length === 0, `errors: ${errors.slice(0, 3).join(" | ")}`);
await browser.close();
await server.close();
if (problems.length) {
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("the Phase 38 gate passes");
