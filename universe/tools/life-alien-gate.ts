// node tools/life-alien-gate.ts [--ci] [--soft] [--shots dir] — gate 112, life read from each world's own numbers (B3 to B5 of
// the life plan, docs/architecture/asks-2026-11-12-plan.md Part B; asked 2026-11-12: "make sure the aliens and how life
// emerges from worlds are real primitives and i see all diffrent types of species etc and novel creatures"), on the
// built app at a phone's size (430 by 932):
//   1. eight alien worlds' people and living beasts drawn as the pages draw them, their outlines read off the pixels:
//      two worlds' beasts share under a third of their outlines, and their peoples' outlines differ;
//   2. a world's Life page names who rose there, and the people's own page shows its body by what it does (how it
//      stands, its legs, what it grasps with) and the lineage it rose from;
//   3. a world where life arose and no people rose says why, on its Life page and in what's next.
// --shots keeps each world's sheet, a contact sheet of the eight, the people's page and the no-people world's.
// (npm run build first; --soft draws in software, as CI's browser does.)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";

const argv = process.argv.slice(2),
  ci = argv.includes("--ci"),
  soft = argv.includes("--soft"),
  shots = argv.includes("--shots") ? argv[argv.indexOf("--shots") + 1] : undefined;
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
console.log("gate 112: life read from each world's own numbers");
if (shots) mkdirSync(shots, { recursive: true });

type Outline = { mask: string; aspect: number; cover: number };
type Sheet = { people: Outline | null; beasts: (Outline & { name: string; look: boolean })[] };

/** Eight open worlds where a people rose (tools/life-probe.ts), and one where life arose and none did. */
const WORLDS = [3, 7, 9, 12, 15, 16, 29, 41].map((i) => `alien ${i}`),
  NO_PEOPLE = "alien 20";

/** How alike two outlines are (as ui/life-sheet.ts alike): shared cells over covered cells, other proportions apart. */
function alike(a: Outline, b: Outline): number {
  let both = 0,
    either = 0;
  for (let i = 0; i < a.mask.length; i++) {
    const x = a.mask[i] === "1",
      y = b.mask[i] === "1";
    if (x && y) both++;
    if (x || y) either++;
  }
  const shape = Math.min(a.aspect, b.aspect) / Math.max(a.aspect, b.aspect);
  return either ? (both / either) * Math.min(1, 0.4 + 0.6 * shape) : 1;
}
const SAME = 0.8;

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4329, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const errors: string[] = [];
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, hasTouch: true });
page.on("pageerror", (e) => errors.push(e.message));
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const slow = (ms: number) => (ci || soft ? ms * 4 : ms);
const until = async (what: string, ok: () => Promise<boolean>, ms = slow(30000)) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(100);
  }
  problems.push(`${what} did not come`);
  return false;
};
const pageText = () =>
  k<string>(
    `(() => { const e = document.querySelector(".page-window"); return e && e.getBoundingClientRect().height > 0 ? e.innerText : ""; })()`,
  );
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};

/** A world opened and drawn. */
async function open(seed: string): Promise<boolean> {
  await page.goto(`${base}?universe=alien&seed=${encodeURIComponent(seed)}&hold=1`);
  try {
    await page.waitForFunction(
      () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
      undefined,
      { timeout: ci || soft ? 900000 : 300000 },
    );
    return true;
  } catch {
    problems.push(`${seed}: the world did not open`);
    return false;
  }
}

/** A world's Life page, and its roles tab pressed where it is on the screen. */
async function rolesTab(): Promise<boolean> {
  await k(`globalThis.causalis.open("world:life")`);
  if (
    !(await until(
      "the Life page",
      async () => (await k<string | null>("globalThis.causalis.pageOpen()")) === "world:life",
    ))
  )
    return false;
  await page.waitForTimeout(slow(600));
  const at = await k<{ x: number; y: number } | null>(`(() => {
    for (const e of document.querySelectorAll(".page-window .tabs .tab")) {
      if ((e.textContent ?? "").trim() !== "Its roles") continue;
      e.scrollIntoView({ block: "nearest", inline: "center" });
      const r = e.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  })()`);
  if (!at) {
    problems.push("the Life page has no roles tab");
    return false;
  }
  await page.touchscreen.tap(at.x, at.y);
  await page.waitForTimeout(slow(600));
  return true;
}

// 1. Eight worlds' life, side by side.
const SHOTS: { seed: string; png: string }[] = [],
  sheets: { seed: string; sheet: Sheet }[] = [];
for (const seed of WORLDS) {
  if (!(await open(seed))) continue;
  const sheet = await k<Sheet>(`globalThis.causalis.lifeSheet(11)`);
  await page.waitForTimeout(300);
  const png = await page.screenshot();
  if (shots) writeFileSync(join(shots, `${seed.replace(/\s+/g, "-")}.png`), png);
  SHOTS.push({ seed, png: png.toString("base64") });
  await k(`globalThis.causalis.closeLifeSheet?.()`);
  sheets.push({ seed, sheet });
  say(
    `${seed}: ${sheet.beasts.length} beasts drawn, its people ${sheet.people ? "drawn" : "not drawn"}`,
  );
  check(sheet.beasts.length >= 4, `${seed}: only ${sheet.beasts.length} beasts drawn`);
  check(!!sheet.people, `${seed}: its people not drawn`);
}
check(sheets.length === WORLDS.length, `only ${sheets.length} of ${WORLDS.length} worlds drawn`);
let pairs = 0,
  sharedSum = 0;
for (const A of sheets)
  for (const B of sheets) {
    if (A === B || !A.sheet.beasts.length) continue;
    let shared = 0;
    for (const a of A.sheet.beasts) {
      let best = 0;
      for (const b of B.sheet.beasts) best = Math.max(best, alike(a, b));
      if (best >= SAME) shared++;
    }
    pairs++;
    sharedSum += shared / A.sheet.beasts.length;
  }
const meanShare = pairs ? sharedSum / pairs : 1;
say(
  `beasts: a world's outlines found in another's ${Math.round(100 * meanShare)}% (mean over ${pairs} pairs)`,
);
check(
  meanShare < 1 / 3,
  `two worlds share ${Math.round(100 * meanShare)}% of their beasts' outlines`,
);
const peoples = sheets.filter((s) => s.sheet.people);
let peoplePairs = 0,
  peopleSame = 0;
for (let i = 0; i < peoples.length; i++)
  for (let j = i + 1; j < peoples.length; j++) {
    peoplePairs++;
    if (alike(peoples[i]!.sheet.people!, peoples[j]!.sheet.people!) >= 0.9) peopleSame++;
  }
say(`peoples: ${peopleSame} of ${peoplePairs} pairs of worlds' peoples drawn with one outline`);
check(
  peopleSame <= peoplePairs * 0.1,
  `${peopleSame} of ${peoplePairs} pairs of peoples share an outline`,
);

// 2. Who rose, on the Life page; their own page, their body by what it does.
const first = WORLDS[0]!;
if (await open(first)) {
  await rolesTab();
  await until("the Life page's roles", async () =>
    (await pageText()).includes("Who rose to thought"),
  );
  const roles = await pageText();
  check(/the places its world offers/i.test(roles), `${first}: the Life page gives no places`);
  check(/roles? its energy fills/i.test(roles), `${first}: the Life page gives no roles filled`);
  await shot("roles");
  // (The people's name, pressed where it is on the screen.)
  const at = await k<{ x: number; y: number; ref: string } | null>(`(() => {
    for (const e of document.querySelectorAll(".page-window a.ref-link")) {
      const line = e.parentElement?.textContent ?? "";
      if (!line.startsWith("Who rose to thought")) continue;
      e.scrollIntoView({ block: "center" });
      const r = e.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, ref: e.getAttribute("href").slice(1) };
    }
    return null;
  })()`);
  check(!!at, `${first}: no link to the people who rose`);
  if (at) {
    await page.waitForTimeout(slow(300));
    await page.touchscreen.tap(at.x, at.y);
    await until(
      "the people's page",
      async () => (await k<string | null>("globalThis.causalis.pageOpen()")) === at.ref,
    );
    await until("the people's body", async () => (await pageText()).includes("to grasp with"));
    const text = await pageText(),
      body = /Its body\s*\n?\s*(It [^\n]*to grasp with[^\n]*)/.exec(text)?.[1] ?? "";
    say(`${first}: their page — ${body || "(no body by what it does)"}`);
    check(
      /It (stands|goes|strides|flies)/.test(body),
      `${first}: the people's page says not how its body stands`,
    );
    check(/legs? under it|no legs/.test(body), `${first}: the people's page says not its legs`);
    check(text.includes("Rose from"), `${first}: the people's page says not what they rose from`);
    await shot("people-page");
  }
}

// 3. A world where life arose and no people did: why, on its Life page and in what's next.
if (await open(NO_PEOPLE)) {
  await rolesTab();
  await until("the no-people world's roles", async () =>
    (await pageText()).includes("No people rose here"),
  );
  const text = await pageText(),
    why = /No people rose here: ([^\n]*)/.exec(text)?.[1] ?? "";
  say(`${NO_PEOPLE}: ${why || "(says not why)"}`);
  check(
    /no lineage rose to thought/.test(why),
    `${NO_PEOPLE}: its Life page says not why no people rose`,
  );
  check(
    why.length > 60,
    `${NO_PEOPLE}: its why is too short to say anything (${why.length} letters)`,
  );
  await shot("no-people");
  await k(`globalThis.causalis.closePage?.()`);
  await k(`globalThis.causalis.open("world:next")`).catch(() => null);
  await page.waitForTimeout(slow(1500));
  const next = await pageText();
  if (next.includes("Nothing, by its own hand"))
    check(
      next.includes("no lineage rose"),
      `${NO_PEOPLE}: what's next says not why no people rose`,
    );
  say(
    `${NO_PEOPLE}: what's next ${next.includes("no lineage rose") ? "says why" : "(not shown as a page)"}`,
  );
}

if (shots && SHOTS.length) {
  const sheet = await browser.newPage({ viewport: { width: 1376, height: 940 } });
  await sheet.setContent(
    `<body style="margin:0;background:#05070f;display:grid;grid-template-columns:repeat(4,344px);gap:0">${SHOTS.map(
      (s) =>
        `<figure style="margin:0;position:relative"><img src="data:image/png;base64,${s.png}" style="width:344px;display:block"><figcaption style="position:absolute;bottom:2px;left:4px;color:#fff;font:12px Verdana;background:#000a;padding:1px 4px">${s.seed}</figcaption></figure>`,
    ).join("")}</body>`,
  );
  await sheet.waitForTimeout(500);
  await sheet.screenshot({ path: join(shots, "life-alien-sheet.png"), fullPage: true });
  say(`contact sheet: ${join(shots, "life-alien-sheet.png")}`);
}

for (const e of errors.slice(0, 5)) say(`page error: ${e}`);
check(!errors.length, `${errors.length} page errors`);
await browser.close();
await server.close();
if (problems.length) {
  console.log("gate 112 fails:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("gate 112 passes");
process.exit(0);
