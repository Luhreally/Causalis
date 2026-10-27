// node tools/phase35-gate.ts [--ci] [--soft] [--shots dir] — the Phase 35 gate (the world's making
// under the god's hand, M179–M181: THE OBSERVATORY's Creator, who sets a world's conditions and
// watches what comes of them), on the built app:
//   1. a new world never seen made from the title screen: its star, its pull, its orbit, its seas
//      and its air on dials, each laid in its seed's text, the world it makes told as they turn;
//   2. begun so: its home world as made (a dim red star, a heavy pull), and its page says so;
//   3. its genesis: the star chosen as it lights, the world made again and watched on from there
//      (held to be seen), and the pull chosen as it forms;
//   4. a world like ours offers none.
// (npm run build first; --soft draws in software, as CI's browser does; --shots keeps pictures.)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";

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
console.log("the Phase 35 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Genesis = { stage: string; paused: boolean };
type System = {
  star: { spectral: string };
  bodies: { ref: string; kind: string; gravity: number }[];
};
type Page = { tabs: { blocks: { type: string; title?: string; lines?: unknown }[] }[] };

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4288, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const errors: string[] = [];
const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const text = async (sel: string) => ((await page.textContent(sel).catch(() => "")) ?? "").trim();
const until = async (what: string, ok: () => Promise<boolean>, ms = 60000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(250);
  }
  problems.push(`${what} did not come`);
  return false;
};
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const genesis = () => k<Genesis>(`globalThis.causalis.genesis()`);
const next = () => page.click(".genesis-row button:not(.link)");
const seedNow = () => page.inputValue(".seed-input");

// 1. A new world never seen, made on the title screen.
await page.goto(base);
await page.waitForSelector(".title-menu .choice", { timeout: slow(60000) });
await page.click(".title-menu .choice:has-text('New world')");
const hiddenAtFirst = await page.isHidden(".making-row");
await page.click(".choice-row .choice[data-id='alien']");
await page.fill(".seed-input", "violet hollow");
await page.dispatchEvent(".seed-input", "input");
const dials = await page.$$eval(".making-dial", (b) => b.map((x) => x.textContent ?? ""));
// The star turned to a dim red one, the pull turned twice (light, then heavy).
await page.click(".making-dial[data-subject='star']");
await page.click(".making-dial[data-subject='pull']");
await page.click(".making-dial[data-subject='pull']");
const made = await seedNow();
const told = await until(
  "the world it makes, told",
  async () => /^⭐ an M\w* star, [\d,]+ K · 1\.[4-6]\d g/.test(await text(".seed-made")),
  slow(30000),
);
const madeWords = await text(".seed-made"),
  life = await text(".seed-life"),
  lit = await page.$$eval(".making-dial.on", (b) => b.map((x) => x.textContent ?? ""));
await shot("1-made-on-the-title");
say(
  `the title: ${dials.length} dials (${dials.join(", ")}); turned: “${made}” — ${lit.join(", ")}; told “${madeWords}”; “${life}”`,
);
check(hiddenAtFirst, "the making dials show for a world like ours");
// (Seven since Phase 56: its carbon and its ices.)
check(dials.length === 7, `${dials.length} making dials`);
check(made === "violet hollow ~pull heavy ~star red", `the seed's text reads “${made}”`);
check(lit.length === 2, "the dials turned are not lit");
check(told, "the world a made seed makes is not told");
check(/Life arises/.test(life), "a peopled made world not told so");

// 2. Begun so: its home world as made, and its page says so.
await page.click(".title-form .begin");
await page.waitForURL(/universe=alien&seed=violet/, { timeout: slow(60000) });
await until(
  "the made world begun",
  async () => ((await k<number>("globalThis.causalis?.drawn?.() ?? 0")) ?? 0) > 0,
  slow(180000),
);
const seedBegun = await k<string>("globalThis.causalis.seed"),
  system = await k<System>(`globalThis.causalis.client.query({ type: "planet.system" })`),
  home = system.bodies.find((b) => b.kind === "home")!,
  homePage = await k<Page>(
    `globalThis.causalis.client.query({ type: "page", args: { ref: ${JSON.stringify(home.ref)} } })`,
  ),
  byHand = homePage.tabs[0]?.blocks.find((b) => b.title === "Made by your hand");
await shot("2-the-made-world");
say(
  `begun “${seedBegun}”: a star of ${system.star.spectral}, ${home.gravity.toFixed(2)} g; its page: ${byHand ? JSON.stringify(byHand.lines) : "nothing of the hand"}`,
);
check(seedBegun.includes("~pull heavy") && seedBegun.includes("~star red"), "begun unmade");
check(/^M/.test(system.star.spectral), `its star is ${system.star.spectral}, not a red dwarf`);
check(home.gravity > 1.4, `its pull is ${home.gravity.toFixed(2)} g`);
check(
  !!byHand && /a dim red star · a great world, its pull heavy/.test(JSON.stringify(byHand)),
  "the home world's page does not tell the hand's making",
);

// 3. Its genesis: the star chosen as it lights; the pull as it forms.
await page.goto(`${base}?universe=alien&seed=${encodeURIComponent("violet hollow")}&genesis=1`);
await page.waitForSelector(".genesis h2", { timeout: slow(600000) });
await next();
await until("the star's stage", async () => (await genesis()).stage === "star", slow(30000));
// (Its acts drawn as the stage is entered.)
await until(
  "the star's acts",
  async () => (await page.$$(".genesis-acts button:has-text('White')")).length > 0,
  slow(30000),
);
const starActs = await page.$$eval(".genesis-acts button", (b) =>
  b.map((x) => x.textContent ?? ""),
);
await page.click(".genesis-acts button:has-text('White')");
await page.waitForURL(/from=star/, { timeout: slow(60000) });
await page.waitForSelector(".genesis h2", { timeout: slow(600000) });
const atStar = await genesis(),
  laidStar = await text(".genesis-laid"),
  whiteOn = await page.$$eval(".genesis-acts button.on", (b) => b.map((x) => x.textContent ?? ""));
await shot("3-a-white-star");
await next();
await until("the world forming", async () => (await genesis()).stage === "forming", slow(30000));
await until(
  "the forming world's acts",
  async () => (await page.$$(".genesis-acts button:has-text('Pull: heavy')")).length > 0,
  slow(30000),
);
const formingActs = await page.$$eval(".genesis-acts button", (b) => b.length);
await page.click(".genesis-acts button:has-text('Pull: heavy')");
await page.waitForURL(/from=forming/, { timeout: slow(60000) });
await page.waitForSelector(".genesis h2", { timeout: slow(600000) });
const atForming = await genesis(),
  laidBoth = await text(".genesis-laid"),
  url = decodeURIComponent(page.url());
await shot("3-a-great-world-forming");
say(
  `the genesis: the star's acts ${starActs.join(" · ")}; made white: at “${atStar.stage}”${atStar.paused ? ", held" : ""}, “${laidStar}”, lit ${whiteOn.join(", ")}; the forming's acts ${formingActs}; made heavy: at “${atForming.stage}”, “${laidBoth}”`,
);
check(starActs.length === 4, `${starActs.length} acts on the star`);
check(
  atStar.stage === "star" && atStar.paused,
  "the world made again is not watched on from its star, held",
);
check(/a white star/.test(laidStar), "the hand's star is not told");
check(whiteOn.length === 1 && /White/.test(whiteOn[0] ?? ""), "the star chosen is not lit");
check(formingActs === 8, `${formingActs} acts on the forming world`);
check(atForming.stage === "forming", "the world made again is not watched on from its forming");
check(
  /a white star/.test(laidBoth) && /its pull heavy/.test(laidBoth),
  "the hand's makings are not told together",
);
check(url.includes("~pull heavy") && url.includes("~star white"), `made as “${url}”`);

// 4. A world like ours offers none.
await page.goto(`${base}?universe=earth&seed=${encodeURIComponent("first light")}&genesis=1`);
await page.waitForSelector(".genesis h2", { timeout: slow(600000) });
await next();
await until("Earth's star", async () => (await genesis()).stage === "star", slow(30000));
await until(
  "Earth's star told",
  async () => /A star, and its worlds/.test(await text(".genesis h2")),
  slow(30000),
);
const earthActs = await page.$$eval(".genesis-acts button", (b) => b.length);
say(`a world like ours: ${earthActs} acts on its star`);
check(earthActs === 0, "a world like ours is offered a remaking");

check(errors.length === 0, `errors: ${errors.slice(0, 3).join(" | ")}`);
await browser.close();
await new Promise<void>((done) => server.httpServer.close(() => done()));
console.log(
  problems.length
    ? `\nthe Phase 35 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`
    : "\nthe Phase 35 gate passes",
);
process.exit(problems.length ? 1 : 0);
