// node tools/lessons-gate.ts [--ci] [--soft] [--shots dir]: gate 110, what a people has learned from what has cost it (asked
// 2026-11-12: "they should learn at some point if they have this many earthquakes ... armies that lose a learn"). On first light at
// 430 by 932, by real touch:
//   1. the world's own record: some land and some realm lean on a lesson read off what history did to them;
//   2. a land with lessons: its page, its Learned tab pressed, What they have learned with its numbers (what it cost them, in how
//      many years), what they do now and whether it worked; no raw ids, nothing past the screen's edges;
//   3. its realm, pressed from the land's page: a realm's Learned tab, the same checks, where it has one;
//   4. the annals tell when a lesson was first taken up;
//   5. no page errors.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  at = argv.indexOf("--shots"),
  shots = at >= 0 ? argv[at + 1] : undefined,
  YEAR_AT = ci ? 700 : 900;
if (shots) mkdirSync(shots, { recursive: true });
const slow = (ms: number) => (ci || soft ? ms * 4 : ms);
const GPU = ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"];
const problems: string[] = [];
const check = (ok: boolean, what: string) => {
  if (!ok) problems.push(what);
};
const say = (s: string) => console.log(`  ${s}`);
console.log("the gate of lessons learned (110)");

/** Words a page must never show: a raw id, a number gone wrong, a word left unfilled. */
const BAD = /\b(?:cell|pol|ev|town|war):\d+(?::\d+)?\b|undefined|NaN|null|\[object/;

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4327, strictPort: false } }),
  site = server.resolvedUrls!.local[0]!,
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
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const until = async (what: string, ok: () => Promise<boolean>, ms = slow(20000)) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(80);
  }
  problems.push(`${what} did not come`);
  return false;
};
/** Press a thing by touch where it stands, once it has stopped moving. */
async function press(selector: string, what: string): Promise<boolean> {
  const where = () =>
    k<{ x: number; y: number } | null>(`(() => {
    for (const e of document.querySelectorAll(${JSON.stringify(selector)})) {
      e.scrollIntoView({ block: "center" });
      const r = e.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  })()`);
  let spot = await where();
  if (!spot) {
    problems.push(`nothing to press for ${what}`);
    return false;
  }
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(slow(100));
    const now = await where();
    if (!now || (now.x === spot.x && now.y === spot.y)) break;
    spot = now;
  }
  await page.touchscreen.tap(spot.x, spot.y);
  await page.waitForTimeout(slow(400));
  return true;
}
const pageNow = () => k<string | null>("globalThis.causalis.pageOpen() ?? null");
const pageText = () =>
  k<string>(
    `(() => { const e = document.querySelector(".page-window"); return e && e.getBoundingClientRect().height > 0 ? e.innerText : ""; })()`,
  );
/** Whatever of the page's open tab lies past the screen's sides, or is cut off within its own box. */
const offScreen = () =>
  k<string[]>(`(() => {
    const w = document.querySelector(".page-window"), out = [];
    if (!w) return ["no page"];
    const a = w.getBoundingClientRect();
    if (a.left < -1 || a.right > innerWidth + 1) out.push("the page " + Math.round(a.left) + " to " + Math.round(a.right));
    for (const e of w.querySelectorAll("*")) {
      const r = e.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) continue;
      if (r.left < -1 || r.right > innerWidth + 1)
        out.push((e.className || e.tagName) + " " + Math.round(r.left) + " to " + Math.round(r.right) + ": " + (e.textContent || "").slice(0, 40));
      if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX === "hidden")
        out.push((e.className || e.tagName) + " cut off: " + (e.textContent || "").slice(0, 40));
    }
    return out.slice(0, 6);
  })()`);
/** Open a page, then press its Learned tab by touch; what the tab says (empty: none such). */
async function learnedTab(ref: string, what: string): Promise<string> {
  const tabAt = await k<number>(
    `[...document.querySelectorAll(".page-window .tabs .tab")].findIndex((b) => /^\\s*Learned/.test(b.textContent))`,
  );
  if (tabAt < 0) {
    problems.push(`no Learned tab on ${what} (${ref})`);
    return "";
  }
  await press(`.page-window .tabs .tab:nth-child(${tabAt + 1})`, `${what}'s Learned tab`);
  await page.waitForTimeout(slow(400));
  return pageText();
}
/** The section's checks: its title, its numbers, no raw ids, nothing off the screen. */
async function checkSection(text: string, what: string): Promise<void> {
  check(
    /What they have learned/.test(text),
    `${what}: no “What they have learned”: ${text.slice(0, 200)}`,
  );
  check(
    /\d[\d,]* [\w' ]*(?:lost to|went hungry)[^\n]* in (?:a year|[\d,]+ years) \([\d,]+ \w/.test(
      text,
    ),
    `${what}: what it cost them is not told in numbers and years: ${text.slice(0, 300)}`,
  );
  check(
    !BAD.test(text),
    `${what}: a raw id or a word gone wrong: ${(text.match(BAD) ?? [""])[0]} in ${text.slice(0, 300)}`,
  );
  const off = await offScreen();
  check(off.length === 0, `${what}: off the screen: ${off.join(" | ")}`);
}

await page.goto(`${site}?universe=earth&seed=first%20light&year=${YEAR_AT}&hold=1`);
await page.waitForFunction(
  () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
  undefined,
  { timeout: slow(600000) },
);
await k("globalThis.causalis.client.setSpeed(0)");
await page.waitForTimeout(slow(2000));
await k("globalThis.causalis.closePage?.()");

// 1. The world's own record.
type Held = { ref: string; lessons: string[]; lost: number };
const held = await k<Held[]>(`globalThis.causalis.client.query({ type: "lessons.held" })`),
  lands = held.filter((h) => h.ref.startsWith("cell:")),
  realms = held.filter((h) => h.ref.startsWith("pol:"));
say(`at year ${YEAR_AT}: ${lands.length} lands and ${realms.length} realms lean on a lesson`);
check(lands.length > 0, `no land has learned anything by year ${YEAR_AT}`);
const counts = new Map<string, number>();
for (const h of held) for (const l of h.lessons) counts.set(l, (counts.get(l) ?? 0) + 1);
say(`lessons: ${[...counts.entries()].map(([l, n]) => `${l} ${n}`).join(", ")}`);

// 2. A land with lessons, the most learned.
const land = lands[0];
if (land) {
  await k(`globalThis.causalis.open(${JSON.stringify(land.ref)})`);
  if (await until("the land's page", async () => (await pageNow()) === land.ref)) {
    const text = await learnedTab(land.ref, "a land");
    say(`the land's tab: ${text.replace(/\s+/g, " ").slice(0, 400)}`);
    await checkSection(text, "a land");
    check(
      /What they do now/.test(text) && /Has it worked/.test(text),
      `a land: no “what they do now” or “has it worked”`,
    );
    await shot("1-land");
    // 3. Its realm, pressed from the page's own link.
    const realm = await k<string | null>(
      `(() => { const a = document.querySelector('.page-window a.ref-link[href^="#pol:"]'); return a ? a.getAttribute("href").slice(1) : null; })()`,
    );
    const target = realms.find((r) => r.ref === realm) ? realm : (realms[0]?.ref ?? null);
    if (realm && target === realm) {
      await press(`.page-window a.ref-link[href="#${realm}"]`, "the land's realm");
      await until("its realm's page", async () => (await pageNow()) === realm);
    } else if (target) await k(`globalThis.causalis.open(${JSON.stringify(target)})`);
    if (target && (await until("a realm's page", async () => (await pageNow()) === target))) {
      const text = await learnedTab(target, "a realm");
      say(`the realm's tab: ${text.replace(/\s+/g, " ").slice(0, 400)}`);
      await checkSection(text, "a realm");
      await shot("2-realm");
    } else say("no realm with a lesson to open");
  }
}

// 4. The Years tell the first taking up of a lesson in all the world, in the year it was.
const firsts = await k<{ lesson: string; year: number }[]>(
  `globalThis.causalis.client.query({ type: "lessons.firsts" })`,
);
say(`firsts: ${firsts.map((f) => `${f.lesson} ${f.year}`).join(", ")}`);
const firstYear = firsts[0]?.year ?? NaN;
if (Number.isFinite(firstYear)) {
  const years = await k<unknown>(
    `globalThis.causalis.client.query({ type: "annals.read", args: { years: [${firstYear}] } })`,
  );
  const words = JSON.stringify(years);
  say(
    `the Years at ${firstYear}: ${(words.match(/[^"]*began to[^"]*/) ?? ["(none)"])[0].slice(0, 200)}`,
  );
  check(
    /began to/.test(words),
    `the Years do not tell the first lesson taken up, in year ${firstYear}`,
  );
} else problems.push("no lesson taken up to look for in the Years");

check(errors.length === 0, `page errors: ${errors.slice(0, 3).join(" | ")}`);
await browser.close();
await server.close();
if (problems.length) {
  console.log(`gate 110 FAILED:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("gate 110 passed");
process.exit(0);
